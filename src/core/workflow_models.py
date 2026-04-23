"""
Workflow data models for structured conversation flows.

Defines the YAML-parsable schema for workflow definitions and the runtime
execution state used by WorkflowEngine.
"""

from pydantic import BaseModel, Field, model_validator
from typing import Dict, List, Optional, Any, Union
from enum import Enum


class StepType(str, Enum):
    """Types of workflow steps."""
    PROMPT = "prompt"       # Speak text, wait for user response
    COLLECT = "collect"    # Extract entity from user speech
    ACTION = "action"      # Execute a tool
    BRANCH = "branch"      # Decision point based on conditions


class WorkflowStepValidation(BaseModel):
    """Validation rules for a collect step."""
    pattern: Optional[str] = None          # Regex pattern to validate
    max_attempts: int = 3                  # Max retry attempts before failing
    retry_prompt: Optional[str] = None     # Prompt on validation failure


class WorkflowStepAction(BaseModel):
    """A tool call executed as a side-effect within a step."""
    tool: str
    parameters: Dict[str, Any] = Field(default_factory=dict)


class WorkflowCondition(BaseModel):
    """A single if/got condition in a branch step."""
    if_: str = Field(alias="if", description="Condition expression, e.g. '{{claim_type}} == claim'")
    goto: str = Field(description="Step ID to jump to if condition matches")

    class Config:
        populate_by_name = True


class WorkflowStep(BaseModel):
    """
    A single step in a workflow.

    Steps are executed in order unless a branch or goto redirects flow.
    Each step type has different execution behavior:
    - prompt: Speak text, hold until user responds
    - collect: Prompt for specific entity, extract from user response
    - action: Execute a tool, use result for routing
    - branch: Evaluate conditions to determine next step
    """
    id: str = Field(description="Unique step identifier (used in goto)")
    type: StepType = Field(description="Step type determining execution behavior")
    description: Optional[str] = Field(default=None, description="Human-readable description")

    # Text to speak (prompt and collect steps)
    prompt: Optional[str] = Field(default=None, description="Text or SSML to speak")

    # Collect step: entity extraction
    entity: Optional[str] = Field(
        default=None,
        description="Variable name to extract from user response and store"
    )
    validation: Optional[WorkflowStepValidation] = Field(
        default=None,
        description="Validation rules for collect step"
    )

    # Action step: tool execution
    tool: Optional[str] = Field(
        default=None,
        description="Registered tool name to execute"
    )
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        description="Tool parameters (supports {{variable}} substitution)"
    )
    continue_on_failure: bool = Field(
        default=False,
        description="If True, continue to failure_default on tool failure instead of aborting"
    )
    failure_default: Optional[str] = Field(
        default=None,
        description="Step ID to jump to on tool failure"
    )

    # Branch step: conditional routing
    conditions: List[WorkflowCondition] = Field(
        default_factory=list,
        description="Conditions evaluated in order; first match wins"
    )
    default: Optional[str] = Field(
        default=None,
        description="Step ID to goto if no conditions match"
    )

    # Universal
    actions: List[WorkflowStepAction] = Field(
        default_factory=list,
        description="Side-effect tools to execute (don't block routing)"
    )
    next: Optional[str] = Field(
        default=None,
        description="Fallthrough next step ID if no goto/conditions"
    )


class Workflow(BaseModel):
    """
    A named workflow definition loaded from YAML config.

    Workflows define structured conversation flows that replace free-form
    AI conversation for a defined set of steps, then hand off to the
    normal provider session (or terminate the call directly).
    """
    name: str = Field(description="Unique workflow name")
    description: Optional[str] = Field(default=None, description="Human-readable description")
    version: str = Field(default="1.0", description="Workflow version for change tracking")

    # Workflow-level variables with default values
    variables: Dict[str, str] = Field(
        default_factory=dict,
        description="Default values for workflow variables (overridable per-call)"
    )

    # --- Self-contained AI config ---
    # Provider (full-agent like openai_realtime, google_live, deepgram, etc.)
    provider: Optional[str] = Field(
        default=None,
        description="AI provider for this workflow (mutually exclusive with pipeline)"
    )
    # Pipeline (modular STT→LLM→TTS like local_hybrid, telnyx, etc.)
    pipeline: Optional[str] = Field(
        default=None,
        description="Pipeline for this workflow (mutually exclusive with provider)"
    )
    # TTS voice
    voice_provider: Optional[str] = Field(
        default=None,
        description="TTS voice provider (openai, elevenlabs, google, etc.)"
    )
    voice_name: Optional[str] = Field(
        default=None,
        description="TTS voice name (alloy, emily, etc.)"
    )
    # System prompt / instructions
    prompt: Optional[str] = Field(
        default=None,
        description="System instructions for the AI"
    )
    language: Optional[str] = Field(
        default=None,
        description="Default language for workflow execution, e.g. fr-FR"
    )
    # Tools this workflow can call
    tools: List[str] = Field(
        default_factory=list,
        description="Tool names this workflow can use during execution"
    )

    # Legacy alias for backward compat (Hybrid Option C)
    global_prompt: Optional[str] = Field(default=None, alias="global_prompt")

    # Ordered list of steps
    steps: List[WorkflowStep] = Field(
        description="Steps executed in order",
        min_length=1
    )

    @model_validator(mode='before')
    @classmethod
    def _resolve_prompt_alias(cls, values):
        """If prompt is None but global_prompt is set, use global_prompt as prompt."""
        if isinstance(values, dict):
            prompt = values.get('prompt')
            global_prompt = values.get('global_prompt')
            if prompt is None and global_prompt is not None:
                values['prompt'] = global_prompt
        return values

    def get_step(self, step_id: str) -> Optional[WorkflowStep]:
        """Find a step by ID."""
        for step in self.steps:
            if step.id == step_id:
                return step
        return None

    def get_step_index(self, step_id: str) -> int:
        """Get the index of a step by ID. Returns -1 if not found."""
        for i, step in enumerate(self.steps):
            if step.id == step_id:
                return i
        return -1


class WorkflowResult(BaseModel):
    """
    Result of a complete workflow execution.

    Returned by WorkflowEngine.execute() to indicate how the workflow
    terminated and what data was collected.
    """
    completed: bool = Field(
        default=False,
        description="True if workflow finished all steps normally"
    )
    transferred: bool = Field(
        default=False,
        description="True if workflow terminated by transferring the call"
    )
    hangup: bool = Field(
        default=False,
        description="True if workflow terminated by hanging up"
    )
    reason: Optional[str] = Field(
        default=None,
        description="Human-readable reason for termination"
    )
    variables: Dict[str, str] = Field(
        default_factory=dict,
        description="All workflow variables and their final values"
    )
    steps_completed: int = Field(
        default=0,
        description="Number of steps that were executed"
    )


class StepResult(BaseModel):
    """
    Result of executing a single workflow step.

    Returned by WorkflowEngine.execute_step() to communicate what
    happened and what should happen next.
    """
    status: str = Field(
        description="completed | waiting | action_required | routing | error"
    )
    next_step_id: Optional[str] = Field(
        default=None,
        description="Step ID to execute next (for routing status)"
    )
    extracted_variables: Dict[str, str] = Field(
        default_factory=dict,
        description="Variables extracted during this step"
    )
    action_result: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Result from an action/tool execution"
    )
    message: Optional[str] = Field(
        default=None,
        description="Human-readable status message"
    )
