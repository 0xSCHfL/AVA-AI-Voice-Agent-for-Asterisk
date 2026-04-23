"""
WorkflowEngine: executes structured conversation flows.

The WorkflowEngine runs before the AI provider session starts and executes
workflow steps (prompt, collect, action, branch) in order. It manages
transitions, variable substitution, and tool execution.

When a workflow completes or terminates, the engine either:
- Hands off to the normal provider session (with workflow_variables in session)
- Terminates the call directly (transfer or hangup) — skipping the provider
"""

import asyncio
import json
import logging
import re
import tempfile
from typing import Optional, Dict, Any, List

from .workflow_models import (
    Workflow,
    WorkflowStep,
    StepResult,
    WorkflowResult,
    StepType,
)
from .session_store import SessionStore
from .models import CallSession

logger = logging.getLogger(__name__)


# Intent classification prompt template
INTENT_CLASSIFICATION_PROMPT = """You are a workflow intent classifier.
Workflow: {workflow_name}
Available intents and their step IDs:
{intents}

User said: "{utterance}"

Classify the user's intent. Return ONLY valid JSON:
{{"intent": "matched_intent_name", "confidence": 0.95}}

Do not add any explanation. Only return the JSON object."""

# Entity extraction prompt template
ENTITY_EXTRACTION_PROMPT = """Extract the following entity from the user's speech.

Entity name: {entity_name}
Entity description: {description}
Example format: {example}

User said: "{utterance}"

Return ONLY valid JSON with the extracted value:
{{"{entity_name}": "extracted_value"}}

If the entity cannot be determined, return:
{{"{entity_name}": null}}

Do not add any explanation. Only return the JSON object."""


class WorkflowEngine:
    """
    Executes a workflow definition step-by-step.

    The engine handles:
    - Variable substitution: {{variable_name}} in prompts/parameters
    - Step execution: prompt, collect, action, branch step types
    - Transition routing: goto, conditions, intent classification
    - Tool execution: via tool registry for action steps
    """

    def __init__(
        self,
        workflow_name: str,
        session: CallSession,
        session_store: SessionStore,
        workflow_loader,  # WorkflowLoader instance
        engine=None,  # Engine reference for ARI client, TTS, LLM access
    ):
        """
        Initialize the workflow engine.

        Args:
            workflow_name: Name of the workflow to execute
            session: CallSession for this call
            session_store: SessionStore for session updates
            workflow_loader: WorkflowLoader instance to resolve workflow by name
            engine: Engine instance for ARI client, TTS, LLM access
        """
        self.workflow_name = workflow_name
        self.session = session
        self.session_store = session_store
        self.workflow_loader = workflow_loader
        self.engine = engine

        # Runtime state
        self.workflow: Optional[Workflow] = None
        self.current_step_index: int = 0
        self.variables: Dict[str, str] = {}
        self.steps_completed: int = 0
        self.step_history: list = []

    async def execute(self) -> WorkflowResult:
        """
        Execute the workflow until completion or termination.

        Returns:
            WorkflowResult indicating how the workflow ended:
            - completed: ran all steps normally, provider session should follow
            - transferred: workflow transferred the call
            - hangup: workflow hung up the call
        """
        self.workflow = self.workflow_loader.get(self.workflow_name)
        if not self.workflow:
            logger.error(
                "Workflow not found",
                workflow=self.workflow_name,
                call_id=self.session.call_id,
            )
            return WorkflowResult(
                completed=False,
                reason=f"Workflow '{self.workflow_name}' not found",
            )

        # Initialize workflow variables with defaults
        self.variables = dict(self.workflow.variables)
        # Override with any pre-existing pre_call_results
        self.variables.update(self.session.pre_call_results)

        if not getattr(self.session, "language", None):
            workflow_language = str(getattr(self.workflow, "language", "") or "").strip()
            if workflow_language:
                self.session.language = workflow_language

        logger.info(
            "Starting workflow",
            workflow=self.workflow_name,
            call_id=self.session.call_id,
            num_steps=len(self.workflow.steps),
        )

        try:
            while self.current_step_index < len(self.workflow.steps):
                step = self.workflow.steps[self.current_step_index]
                result = await self._execute_step(step)

                # Update session with workflow state
                await self._update_session()

                if result.status == "error":
                    logger.error(
                        "Step error",
                        step=step.id,
                        call_id=self.session.call_id,
                        message=result.message,
                    )
                    return WorkflowResult(
                        completed=False,
                        reason=result.message or f"Error in step '{step.id}'",
                    )

                if result.status == "routing":
                    # Routing step decides the next step
                    next_id = result.next_step_id
                    if next_id:
                        target_index = self.workflow.get_step_index(next_id)
                        if target_index >= 0:
                            self.current_step_index = target_index
                        else:
                            logger.error(
                                "Invalid goto step",
                                step=step.id,
                                goto=next_id,
                                call_id=self.session.call_id,
                            )
                            return WorkflowResult(
                                completed=False,
                                reason=f"Invalid goto step: {next_id}",
                            )
                    else:
                        # No goto set, fall through to next step
                        self.current_step_index += 1

                elif result.status == "waiting":
                    # Waiting for user input (collect step succeeded)
                    self.current_step_index += 1

                elif result.status == "action_required":
                    # Action/tool was executed, routing based on result
                    next_id = result.next_step_id
                    if next_id:
                        target_index = self.workflow.get_step_index(next_id)
                        if target_index >= 0:
                            self.current_step_index = target_index
                        else:
                            logger.warning(
                                "Invalid action goto, using next",
                                step=step.id,
                                goto=next_id,
                            )
                            self.current_step_index += 1
                    else:
                        self.current_step_index += 1

                else:
                    # completed or unknown status — move to next step
                    self.current_step_index += 1

                self.steps_completed += 1

            # Workflow completed all steps normally
            logger.info(
                "Workflow completed",
                workflow=self.workflow_name,
                call_id=self.session.call_id,
                steps_executed=self.steps_completed,
            )
            return WorkflowResult(
                completed=True,
                variables=self.variables,
                steps_completed=self.steps_completed,
            )

        except Exception as e:
            logger.exception(
                "Workflow execution error",
                workflow=self.workflow_name,
                call_id=self.session.call_id,
                step_index=self.current_step_index,
            )
            return WorkflowResult(
                completed=False,
                reason=f"Workflow error: {e}",
            )

    async def _execute_step(self, step: WorkflowStep) -> StepResult:
        """
        Execute a single workflow step based on its type.

        Args:
            step: The WorkflowStep to execute

        Returns:
            StepResult with status and routing info
        """
        logger.debug(
            "Executing step",
            step=step.id,
            type=step.type.value if step.type else step.type,
            call_id=self.session.call_id,
        )

        # Execute side-effect actions first
        await self._execute_side_effect_actions(step)

        if step.type == StepType.PROMPT:
            return await self._execute_prompt_step(step)
        elif step.type == StepType.COLLECT:
            return await self._execute_collect_step(step)
        elif step.type == StepType.ACTION:
            return await self._execute_action_step(step)
        elif step.type == StepType.BRANCH:
            return await self._execute_branch_step(step)
        else:
            return StepResult(
                status="error",
                message=f"Unknown step type: {step.type}",
            )

    async def _execute_prompt_step(self, step: WorkflowStep) -> StepResult:
        """
        Execute a prompt step: speak text and wait for user response.

        The TTS handle is used to speak the resolved prompt text.
        This blocks until TTS playback completes and VAD detects silence.

        Args:
            step: The prompt step

        Returns:
            StepResult with status="completed" and extracted_variables (if any)
        """
        prompt = self._resolve_variables(step.prompt or "")

        if not prompt:
            return StepResult(status="completed")

        # Speak the prompt
        await self._speak_and_wait(prompt)

        return StepResult(status="completed", extracted_variables={})

    async def _execute_collect_step(self, step: WorkflowStep) -> StepResult:
        """
        Execute a collect step: prompt for and extract an entity.

        Speaks the prompt, collects user speech, extracts the entity value
        using intent classification, validates against pattern if provided,
        and retries on failure up to max_attempts.

        Args:
            step: The collect step with entity and validation config

        Returns:
            StepResult with status="completed" or "waiting", extracted_variables
        """
        prompt = self._resolve_variables(step.prompt or f"Please provide your {step.entity}.")
        entity_name = step.entity
        validation = step.validation
        max_attempts = validation.max_attempts if validation else 3
        retry_prompt = validation.retry_prompt if validation else "I didn't understand. Please try again."
        pattern = validation.pattern if validation else None

        attempt = 0
        while attempt < max_attempts:
            await self._speak_and_wait(prompt)

            # Get the user's response
            user_response = await self._wait_for_user_speech()
            if user_response is None:
                # Timeout or silence — treat as no input
                attempt += 1
                if attempt < max_attempts:
                    prompt = retry_prompt
                    continue
                else:
                    return StepResult(
                        status="completed",
                        message="Max collect attempts reached",
                        extracted_variables={},
                    )

            # Extract entity from user response using LLM
            extracted = await self._extract_entity(user_response, entity_name)
            if not extracted or not extracted.get(entity_name):
                attempt += 1
                if attempt < max_attempts:
                    prompt = retry_prompt
                    continue
                else:
                    return StepResult(
                        status="completed",
                        message="Failed to extract entity",
                        extracted_variables={},
                    )

            value = str(extracted.get(entity_name, "")).strip()
            if not value or value.lower() == "null":
                attempt += 1
                if attempt < max_attempts:
                    prompt = retry_prompt
                    continue
                else:
                    return StepResult(
                        status="completed",
                        message="Entity was null",
                        extracted_variables={},
                    )

            # Validate against pattern if provided
            if pattern:
                if not re.match(pattern, value):
                    attempt += 1
                    if attempt < max_attempts:
                        prompt = retry_prompt
                        continue
                    else:
                        return StepResult(
                            status="completed",
                            message="Entity validation failed",
                            extracted_variables={},
                        )

            # Store the extracted variable
            self.variables[entity_name] = value
            return StepResult(
                status="completed",
                extracted_variables={entity_name: value},
            )

        return StepResult(status="completed", extracted_variables={})

    async def _execute_action_step(self, step: WorkflowStep) -> StepResult:
        """
        Execute an action step: run a tool and use result for routing.

        Resolves tool parameters with variables, executes the tool via
        the registry, and routes based on result or goto/failure_default.

        Args:
            step: The action step with tool and parameters

        Returns:
            StepResult with action_result and next_step_id for routing
        """
        if not step.tool:
            return StepResult(status="error", message="Action step has no tool")

        # Resolve parameters with variables
        resolved_params = self._resolve_dict(step.parameters)

        logger.debug(
            "Executing action",
            tool=step.tool,
            call_id=self.session.call_id,
        )

        try:
            result = await self._execute_tool(step.tool, resolved_params)
            self.variables[f"tool_result_{step.tool}"] = str(result)
            self.variables["last_tool_status"] = "success"
            self.variables["last_tool_result"] = str(result)

            # Determine next step
            next_step_id = step.next
            if step.conditions:
                for condition in step.conditions:
                    cond_expr = self._resolve_variables(condition.if_)
                    if self._evaluate_condition(cond_expr):
                        next_step_id = condition.goto
                        break
                if not next_step_id:
                    next_step_id = step.default

            return StepResult(
                status="completed",
                next_step_id=next_step_id,
                action_result=result,
            )

        except Exception as e:
            logger.warning(
                "Action tool failed",
                tool=step.tool,
                error=str(e),
                call_id=self.session.call_id,
            )
            self.variables["last_tool_status"] = "failed"
            self.variables["last_tool_error"] = str(e)

            if step.continue_on_failure and step.failure_default:
                return StepResult(
                    status="completed",
                    next_step_id=step.failure_default,
                    action_result={"error": str(e)},
                )

            return StepResult(
                status="completed",
                next_step_id=step.next,
                action_result={"error": str(e)},
            )

    async def _execute_branch_step(self, step: WorkflowStep) -> StepResult:
        """
        Execute a branch step: evaluate conditions to determine next step.

        Conditions are evaluated in order. The first matching condition's
        goto is used. If no conditions match, the default is used.

        Args:
            step: The branch step with conditions

        Returns:
            StepResult with next_step_id for routing
        """
        if not step.conditions:
            # No conditions — just use default or next
            return StepResult(
                status="completed",
                next_step_id=step.default or step.next,
            )

        for condition in step.conditions:
            cond_expr = self._resolve_variables(condition.if_)
            if self._evaluate_condition(cond_expr):
                return StepResult(
                    status="routing",
                    next_step_id=condition.goto,
                )

        # No condition matched — use default
        return StepResult(
            status="routing",
            next_step_id=step.default or step.next,
        )

    async def _execute_side_effect_actions(self, step: WorkflowStep) -> None:
        """Execute side-effect tools on a step (non-blocking)."""
        if not step.actions:
            return

        for action in step.actions:
            resolved_params = self._resolve_dict(action.parameters)
            try:
                # Fire and forget — don't wait for result
                asyncio.create_task(
                    self._execute_tool(action.tool, resolved_params)
                )
            except Exception as e:
                logger.warning(
                    "Side-effect action failed",
                    tool=action.tool,
                    error=str(e),
                    call_id=self.session.call_id,
                )

    def _get_workflow_language(self) -> str:
        """Resolve workflow language from session first, then workflow config, then English."""
        session_language = str(getattr(self.session, "language", "") or "").strip()
        if session_language:
            return session_language

        workflow_language = ""
        if self.workflow:
            workflow_language = str(getattr(self.workflow, "language", "") or "").strip()
        if workflow_language:
            return workflow_language

        return "en"

    async def _speak_and_wait(self, text: str) -> None:
        """
        Speak text via TTS using the engine's TTS pipeline and wait for completion.

        Synthesizes audio from text and plays it to the caller channel via ARI.
        This blocks until playback finishes.

        Args:
            text: Text to speak
        """
        if not self.engine:
            logger.warning(
                "No engine reference, skipping speak",
                call_id=self.session.call_id,
            )
            return

        try:
            # Get TTS adapter from pipeline orchestrator
            tts_adapter = None
            if hasattr(self.engine, "pipeline_orchestrator"):
                resolution = getattr(self.engine.pipeline_orchestrator, "current_resolution", None)
                if resolution:
                    tts_adapter = resolution.tts_adapter

            if not tts_adapter:
                # Try to get from session's pipeline
                pipeline_name = getattr(self.session, "pipeline_name", None)
                if pipeline_name and hasattr(self.engine, "pipeline_orchestrator"):
                    try:
                        resolution = await self.engine.pipeline_orchestrator.resolve(
                            pipeline_name,
                            self.session.call_id,
                            {},
                        )
                        tts_adapter = resolution.tts_adapter
                    except Exception:
                        pass

            if not tts_adapter:
                logger.warning(
                    "No TTS adapter available for workflow",
                    call_id=self.session.call_id,
                )
                return

            language = self._get_workflow_language()

            # Synthesize audio frames
            audio_frames = []
            async for frame in tts_adapter.synthesize(
                self.session.call_id,
                text,
                {"language": language},
            ):
                audio_frames.append(frame)

            if not audio_frames:
                return

            # Concatenate all frames
            audio_data = b"".join(audio_frames)

            # Write to a temporary WAV file for ARI playback
            # ARI requires a media URI - we use file: prefix
            with tempfile.NamedTemporaryFile(suffix=".ulaw", delete=False) as f:
                f.write(audio_data)
                temp_path = f.name

            # Play via ARI
            ari_client = getattr(self.engine, "ari_client", None)
            if ari_client and self.session.caller_channel_id:
                # Play on the caller channel directly
                await ari_client.play_media(
                    self.session.caller_channel_id,
                    f"file:{temp_path}",
                )

            logger.debug(
                "Workflow spoke text",
                call_id=self.session.call_id,
                language=language,
                text_len=len(text),
            )

        except Exception as e:
            logger.error(
                "TTS speak failed",
                error=str(e),
                call_id=self.session.call_id,
            )

    async def _wait_for_user_speech(self) -> Optional[str]:
        """
        Wait for user speech input and return transcribed text.

        This method is a placeholder. In a real implementation, this would:
        1. Wait for VAD to detect speech
        2. Capture audio until silence
        3. Send to STT for transcription

        For now, returns None (no automatic speech capture implemented yet).
        This would need integration with the audio stream from Asterisk.

        Returns:
            Transcribed user speech, or None if no input
        """
        # TODO: Integrate with actual audio capture/VAD from Asterisk
        # This requires the audio socket or external media path to be active
        # and passing audio to an STT adapter for transcription.
        logger.debug(
            "_wait_for_user_speech called (not yet implemented)",
            call_id=self.session.call_id,
        )
        return None

    async def _extract_entity(self, text: str, entity_name: str) -> Dict[str, str]:
        """
        Extract an entity value from user speech using LLM.

        Uses the pipeline's LLM adapter to extract the named entity from
        the user's response via a structured prompt.

        Args:
            text: User's transcribed speech
            entity_name: Name of the entity to extract

        Returns:
            Dict with entity_name -> extracted value
        """
        if not text:
            return {}

        if not self.engine:
            logger.warning(
                "No engine reference for entity extraction",
                call_id=self.session.call_id,
            )
            return {}

        try:
            # Get LLM adapter from pipeline orchestrator
            llm_adapter = None
            if hasattr(self.engine, "pipeline_orchestrator"):
                resolution = getattr(self.engine.pipeline_orchestrator, "current_resolution", None)
                if resolution:
                    llm_adapter = resolution.llm_adapter

            if not llm_adapter:
                # Try to get from session's pipeline
                pipeline_name = getattr(self.session, "pipeline_name", None)
                if pipeline_name and hasattr(self.engine, "pipeline_orchestrator"):
                    try:
                        resolution = await self.engine.pipeline_orchestrator.resolve(
                            pipeline_name,
                            self.session.call_id,
                            {},
                        )
                        llm_adapter = resolution.llm_adapter
                    except Exception:
                        pass

            if not llm_adapter:
                logger.warning(
                    "No LLM adapter available for entity extraction",
                    call_id=self.session.call_id,
                )
                return {}

            prompt = ENTITY_EXTRACTION_PROMPT.format(
                entity_name=entity_name,
                description=f"Extract the {entity_name} from the user's speech",
                example=f'{{"{entity_name}": "John Smith"}}',
                utterance=text,
            )

            result = await llm_adapter.generate(
                self.session.call_id,
                prompt,
                {},
                {},
            )

            if isinstance(result, str):
                response_text = result
            elif hasattr(result, "text"):
                response_text = result.text
            else:
                response_text = str(result)

            # Parse JSON response
            response_text = response_text.strip()
            # Try to extract JSON from the response
            json_match = re.search(r"\{[^{}]*\}", response_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                return parsed

            # Try parsing the whole response as JSON
            try:
                parsed = json.loads(response_text)
                return parsed
            except json.JSONDecodeError:
                logger.warning(
                    "Failed to parse entity extraction response",
                    response=response_text[:200],
                    call_id=self.session.call_id,
                )
                return {}

        except Exception as e:
            logger.error(
                "Entity extraction failed",
                error=str(e),
                entity=entity_name,
                call_id=self.session.call_id,
            )
            return {}

    async def _classify_intent(self, utterance: str) -> Dict[str, Any]:
        """
        Classify user intent from utterance using LLM.

        Uses the pipeline's LLM adapter to classify intent based on
        available transitions in the workflow.

        Args:
            utterance: User's transcribed speech

        Returns:
            Dict with intent name and confidence
        """
        if not utterance or not self.engine:
            return {"intent": None, "confidence": 0.0}

        try:
            # Get LLM adapter
            llm_adapter = None
            if hasattr(self.engine, "pipeline_orchestrator"):
                resolution = getattr(self.engine.pipeline_orchestrator, "current_resolution", None)
                if resolution:
                    llm_adapter = resolution.llm_adapter

            if not llm_adapter:
                return {"intent": None, "confidence": 0.0}

            # Build intents string from branch conditions
            intents_lines = []
            for step in self.workflow.steps:
                if step.type == StepType.BRANCH and step.conditions:
                    for cond in step.conditions:
                        # Use the condition expression as the intent description
                        intents_lines.append(f"- {cond.goto}: {cond.if_}")

            intents_str = "\n".join(intents_lines) or "None"

            prompt = INTENT_CLASSIFICATION_PROMPT.format(
                workflow_name=self.workflow_name,
                intents=intents_str,
                utterance=utterance,
            )

            result = await llm_adapter.generate(
                self.session.call_id,
                prompt,
                {},
                {},
            )

            response_text = result.text if hasattr(result, "text") else str(result)
            response_text = response_text.strip()

            json_match = re.search(r"\{[^{}]*\}", response_text, re.DOTALL)
            if json_match:
                parsed = json.loads(json_match.group(0))
                return parsed

            try:
                parsed = json.loads(response_text)
                return parsed
            except json.JSONDecodeError:
                return {"intent": None, "confidence": 0.0}

        except Exception as e:
            logger.error(
                "Intent classification failed",
                error=str(e),
                call_id=self.session.call_id,
            )
            return {"intent": None, "confidence": 0.0}

    async def _execute_tool(self, tool_name: str, parameters: Dict[str, Any]) -> Any:
        """
        Execute a registered tool by name using proper ToolExecutionContext.

        Args:
            tool_name: Name of the tool to execute
            parameters: Resolved tool parameters

        Returns:
            Tool execution result
        """
        from ..tools.registry import tool_registry
        from ..tools.context import ToolExecutionContext

        tool = tool_registry.get(tool_name)
        if not tool:
            raise ValueError(f"Tool not found: {tool_name}")

        # Build proper ToolExecutionContext
        context = ToolExecutionContext(
            call_id=self.session.call_id,
            caller_channel_id=self.session.caller_channel_id,
            bridge_id=self.session.bridge_id,
            caller_number=self.session.caller_number,
            called_number=self.session.called_number,
            caller_name=self.session.caller_name,
            context_name=self.session.context_name,
            session_store=self.session_store,
            ari_client=getattr(self.engine, "ari_client", None) if self.engine else None,
            config=getattr(self.engine, "config", None) if self.engine else None,
            provider_name=getattr(self.session, "provider_name", "workflow") or "workflow",
            provider_session=None,
        )

        result = await tool.execute(parameters, context)
        return result

    def _resolve_variables(self, text: str) -> str:
        """
        Substitute {{variable_name}} placeholders in text.

        Args:
            text: Text containing {{variable}} placeholders

        Returns:
            Text with placeholders replaced by variable values
        """
        if not text:
            return text

        def replacer(match):
            var_name = match.group(1).strip()
            return self.variables.get(var_name, match.group(0))

        return re.sub(r'\{\{([^}]+)\}\}', replacer, text)

    def _resolve_dict(self, d: Dict[str, Any]) -> Dict[str, Any]:
        """
        Resolve {{variables}} in all string values of a dict.

        Args:
            d: Dict with potentially nested string values

        Returns:
            Dict with all string values resolved
        """
        result = {}
        for k, v in d.items():
            if isinstance(v, str):
                result[k] = self._resolve_variables(v)
            elif isinstance(v, dict):
                result[k] = self._resolve_dict(v)
            elif isinstance(v, list):
                result[k] = [
                    self._resolve_variables(item) if isinstance(item, str) else item
                    for item in v
                ]
            else:
                result[k] = v
        return result

    def _evaluate_condition(self, expression: str) -> bool:
        """
        Evaluate a simple condition expression.

        Supports:
        - "{{var}} == 'value'" (string equality)
        - "{{var}} == 'value' or {{var2}} == 'value2'"
        - "{{var}} in ['value1', 'value2']"
        - "{{tool_result_toolname}}" comparisons

        Args:
            expression: Condition expression string

        Returns:
            True if condition matches, False otherwise
        """
        try:
            # Replace {{var}} with quoted string values
            def quote_var(match):
                var_name = match.group(1).strip()
                value = self.variables.get(var_name, "")
                escaped = str(value).replace("'", "\\'")
                return f"'{escaped}'"

            expr = re.sub(r'\{\{([^}]+)\}\}', quote_var, expression)

            # Handle 'in' operator with list
            in_match = re.match(r"(.*?) in \[(.*?)\]", expr, re.DOTALL)
            if in_match:
                left = in_match.group(1).strip()
                items = [s.strip().strip("'\"") for s in in_match.group(2).split(",")]
                var_match = re.search(r"'([^']+)'", left)
                if var_match:
                    var_value = var_match.group(1)
                    return var_value in items

            # Simple == evaluation with restricted globals
            return bool(eval(expr, {"__builtins__": {}}))
        except Exception as e:
            logger.warning(
                "Condition evaluation failed",
                expression=expression,
                error=str(e),
            )
            return False

    async def _update_session(self) -> None:
        """Update CallSession with current workflow state."""
        self.session.workflow_name = self.workflow_name
        self.session.workflow_step_index = self.current_step_index
        self.session.workflow_variables = dict(self.variables)
        self.session.workflow_step_history = list(self.step_history)
        await self.session_store.upsert_call(self.session)
