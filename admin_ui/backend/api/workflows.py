"""
Workflows API: CRUD endpoints for workflow definitions.

Workflows are stored in the merged YAML config under the top-level `workflows:` key.
This module provides list, get, create, update, delete, and validate operations.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging
import copy

from . import config as config_api

router = APIRouter()
logger = logging.getLogger(__name__)


class WorkflowDefinition(BaseModel):
    """A single workflow definition."""
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    variables: Dict[str, str] = {}
    steps: List[Dict[str, Any]]
    _canvas: Optional[Dict[str, Any]] = None


class WorkflowListResponse(BaseModel):
    """Response for listing all workflows."""
    workflows: List[str]  # workflow names


class WorkflowGetResponse(BaseModel):
    """Response for getting a single workflow."""
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    variables: Dict[str, str] = {}
    steps: List[Dict[str, Any]]
    _canvas: Optional[Dict[str, Any]] = None
    # Global AI guidance (Hybrid mode - Option C)
    global_prompt: Optional[str] = None
    global_voice_provider: Optional[str] = None
    global_voice_name: Optional[str] = None
    # Context binding
    context: Optional[str] = None


class WorkflowPutRequest(BaseModel):
    """Request for creating or updating a workflow."""
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    variables: Dict[str, str] = {}
    steps: List[Dict[str, Any]]
    _canvas: Optional[Dict[str, Any]] = None
    # Global AI guidance (Hybrid mode - Option C)
    global_prompt: Optional[str] = None
    global_voice_provider: Optional[str] = None
    global_voice_name: Optional[str] = None
    # Context binding: which AI_CONTEXT this workflow should be assigned to
    context: Optional[str] = None


class WorkflowValidateResponse(BaseModel):
    """Response for workflow validation."""
    valid: bool
    errors: List[str] = []


def _get_workflows_from_config() -> Dict[str, Any]:
    """Read the workflows section from the merged config."""
    config = config_api._read_merged_config_dict()
    return config.get("workflows", {}) or {}


def _get_workflow_names() -> List[str]:
    """Return all workflow names in the config."""
    workflows = _get_workflows_from_config()
    return list(workflows.keys())


def _get_workflow(name: str) -> Optional[Dict[str, Any]]:
    """Get a single workflow definition by name."""
    workflows = _get_workflows_from_config()
    return workflows.get(name)


def _normalize_canvas_node(node: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a canvas node to VNode format.

    Handles two formats:
    - VNode format (internal): { id, type, label, x, y, data: { firstMessage, prompt, ... } }
    - Canvas save format:       { name, type, prompt, metadata: { position: { x, y } },
                                  messagePlan: { firstMessage, ... }, ... }
    """
    normalized = dict(node)

    # name → id (and ensure every node has an id)
    if "id" not in normalized:
        if "name" in normalized:
            normalized["id"] = normalized.pop("name")
        else:
            normalized["id"] = f"node_{id(normalized)}"

    # metadata.position.x/y → x/y
    metadata = normalized.get("metadata") or {}
    if isinstance(metadata, dict):
        position = metadata.get("position") or {}
        if isinstance(position, dict):
            if "x" not in normalized:
                normalized["x"] = position.get("x", 0)
            if "y" not in normalized:
                normalized["y"] = position.get("y", 0)
        # Remove metadata after extraction
        normalized.pop("metadata", None)

    # Flatten messagePlan.firstMessage → data.firstMessage
    message_plan = normalized.pop("messagePlan", None) or {}
    if isinstance(message_plan, dict):
        first_message = message_plan.get("firstMessage")
        if first_message:
            data = normalized.get("data") or {}
            if isinstance(data, dict):
                data.setdefault("firstMessage", first_message)
            else:
                normalized["data"] = {"firstMessage": first_message}

    # prompt at root → data.prompt
    prompt = normalized.pop("prompt", None)
    if prompt:
        data = normalized.get("data") or {}
        if isinstance(data, dict):
            data.setdefault("prompt", prompt)
        else:
            normalized["data"] = {"prompt": prompt}

    # Ensure data is a dict
    if "data" not in normalized or not isinstance(normalized.get("data"), dict):
        normalized["data"] = {}

    # Preserve isStart flag
    if "isStart" not in normalized:
        normalized["isStart"] = node.get("isStart", False)

    return normalized


def _canvas_step_to_engine_step(node: Dict[str, Any], outgoing_edge_label: Optional[str] = None) -> Dict[str, Any]:
    """
    Convert a canvas workflow node to an engine WorkflowStep dict.

    Canvas node types → engine step types:
      conversation  → PROMPT (speak prompt text, collect reply)
      api_request   → ACTION (generic_http_lookup tool)
      transfer_call → ACTION (unified_transfer tool)
      end_call      → ACTION (hangup_call tool)
      tool          → ACTION (named tool)

    Edge labels (conditions) become branch conditions on the outgoing step.
    """
    # Normalize in case the canvas saved in its own format
    node = _normalize_canvas_node(node)

    step_id = node.get("id", "")
    node_type = node.get("type", "conversation")
    label = node.get("label", "")
    data = node.get("data") or {}

    if node_type == "conversation":
        # Build prompt text: firstMessage + prompt field
        parts = []
        fm = data.get("firstMessage") or data.get("prompt") or ""
        if fm:
            parts.append(fm.strip())
        prompt_text = "\n\n".join(parts)
        return {
            "id": step_id,
            "type": "prompt",
            "prompt": prompt_text,
        }

    elif node_type == "api_request":
        url = data.get("url") or ""
        return {
            "id": step_id,
            "type": "action",
            "tool": "generic_http_lookup",
            "parameters": {"url": url},
            "next": node.get("next"),
        }

    elif node_type == "transfer_call":
        destination = data.get("destination") or ""
        return {
            "id": step_id,
            "type": "action",
            "tool": "unified_transfer",
            "parameters": {"destination": destination},
            "next": node.get("next"),
        }

    elif node_type == "end_call":
        farewell = data.get("farewell") or ""
        return {
            "id": step_id,
            "type": "action",
            "tool": "hangup_call",
            "parameters": {"farewell": farewell},
        }

    elif node_type == "tool":
        tool_name = data.get("toolName") or ""
        return {
            "id": step_id,
            "type": "action",
            "tool": tool_name,
            "parameters": {},
            "next": node.get("next"),
        }

    # Fallback: conversation node
    return {
        "id": step_id,
        "type": "prompt",
        "prompt": label,
    }


def _build_workflow_steps(nodes: List[Dict[str, Any]], edges: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Convert canvas nodes + edges into engine WorkflowStep dicts.

    Edges with labels become branch conditions on the source step.
    Handles two node formats: VNode (id at root) and canvas save format (name at root,
    metadata.position.x/y). Also resolves edges that reference the original internal
    node IDs ("start", random uids) to the normalized node IDs.
    """
    # Normalize all nodes first to get consistent ids
    normalized_nodes = [_normalize_canvas_node(n) for n in nodes]

    # Build name→id and original_id→normalized_id maps for edge resolution
    name_to_id: Dict[str, str] = {}
    id_to_normalized_id: Dict[str, str] = {}
    for i, node in enumerate(normalized_nodes):
        nid = node.get("id", f"node_{i}")
        name_to_id[node.get("name", "") or nid] = nid
        # Track original index-based id too
        id_to_normalized_id[nodes[i].get("id", f"node_{i}")] = nid
        id_to_normalized_id[nodes[i].get("name", "") or f"node_{i}"] = nid

    # Update start-node id: if any node is isStart, it gets id "start" in VNode format
    # Find the isStart node in original nodes and map its id to "start"
    for orig in nodes:
        if orig.get("isStart") and orig.get("id"):
            id_to_normalized_id[orig["id"]] = "start"
            break

    # Normalize edges: resolve from/to to normalized node ids
    normalized_edges = []
    for edge in edges:
        ne = dict(edge)
        from_id = edge.get("from", "")
        to_id = edge.get("to", "")

        # Resolve from: first check if it's a known id, else check if it's a name
        if from_id in id_to_normalized_id:
            ne["from"] = id_to_normalized_id[from_id]
        elif from_id in name_to_id:
            ne["from"] = name_to_id[from_id]

        # Resolve to: same logic
        if to_id in id_to_normalized_id:
            ne["to"] = id_to_normalized_id[to_id]
        elif to_id in name_to_id:
            ne["to"] = name_to_id[to_id]

        normalized_edges.append(ne)

    # Index edges by source node id -> {edge_id: label}
    edge_map: Dict[str, Dict[str, str]] = {}
    for edge in normalized_edges:
        fid = edge.get("from")
        if fid:
            edge_map.setdefault(fid, {})
            edge_map[fid][edge.get("id", "")] = edge.get("label") or ""

    engine_steps = []
    for node in normalized_nodes:
        node_id = node.get("id", "")
        outgoing = edge_map.get(node_id, {})
        labeled = {eid: lbl for eid, lbl in outgoing.items() if lbl}

        step = _canvas_step_to_engine_step(node)

        # Attach branch conditions if multiple outgoing edges have labels
        if len(labeled) > 1:
            conditions = []
            for eid, lbl in labeled.items():
                target = next((e.get("to") for e in normalized_edges if e.get("id") == eid), None)
                if target:
                    conditions.append({"if": lbl, "goto": target})
            if conditions:
                step["conditions"] = conditions
                step["type"] = "branch"
                step.pop("tool", None)
                step.pop("parameters", None)

        elif len(labeled) == 1:
            # Single labeled edge → attach as goto
            eid = next(iter(labeled.keys()))
            target = next((e.get("to") for e in normalized_edges if e.get("id") == eid), None)
            if target:
                step["next"] = target

        engine_steps.append(step)

    return engine_steps


def _assign_workflow_to_context(workflow_name: str, context_name: str) -> None:
    """
    Bind a workflow to an AI_CONTEXT in the config.

    This creates or updates the contexts.<name>.workflow entry in the
    local override config so the engine picks up the workflow at call start.
    It also injects the workflow's global_prompt into the context's prompt
    field so the engine's existing prompt injection (line ~10057 in engine.py)
    picks it up automatically.

    Args:
        workflow_name: Name of the workflow to bind
        context_name: AI_CONTEXT name to bind it to
    """
    merged = config_api._read_merged_config_dict()
    base = config_api._read_base_config_dict()

    # Ensure contexts block exists
    merged.setdefault("contexts", {})
    base_contexts = base.get("contexts", {})

    # Get workflow's global_prompt to inject into context prompt
    workflow_def = merged["workflows"].get(workflow_name, {})
    wf_global_prompt = workflow_def.get("global_prompt")

    # Build context value — preserve existing fields, override workflow + prompt
    existing_ctx = merged["contexts"].get(context_name, {})
    if isinstance(existing_ctx, dict):
        ctx_value = dict(existing_ctx)
    else:
        ctx_value = {}

    ctx_value["workflow"] = workflow_name

    # If workflow has a global_prompt, inject it as the context's prompt
    # so the engine's existing prompt injection picks it up automatically
    if wf_global_prompt:
        ctx_value["prompt"] = wf_global_prompt

    merged["contexts"][context_name] = ctx_value

    override = config_api._compute_local_override(base, merged)
    import yaml
    content = yaml.dump(override, default_flow_style=False, sort_keys=False)
    config_api._write_local_config(content)
    logger.info(f"Workflow '{workflow_name}' assigned to context '{context_name}' (global_prompt injected)")


def _validate_workflow_steps(steps: List[Dict[str, Any]]) -> List[str]:
    """
    Validate workflow steps structure.
    Returns a list of error messages (empty if valid).
    """
    errors = []
    step_ids = set()

    if not steps:
        errors.append("Workflow must have at least one step")
        return errors

    for i, step in enumerate(steps):
        if not isinstance(step, dict):
            errors.append(f"Step {i} is not a valid object")
            continue

        step_id = step.get("id")
        if not step_id:
            errors.append(f"Step {i} is missing required field: id")
        elif step_id in step_ids:
            errors.append(f"Duplicate step id: '{step_id}'")
        else:
            step_ids.add(step_id)

        step_type = step.get("type")
        if not step_type:
            errors.append(f"Step '{step_id or i}' is missing required field: type")
        elif step_type not in ("conversation", "api_request", "transfer_call", "end_call", "tool"):
            errors.append(f"Step '{step_id or i}' has invalid type: '{step_type}' (must be conversation, api_request, transfer_call, end_call, or tool)")

        # Validate conversation/api_request/transfer_call/end_call/tool steps (no special fields required)

    return errors


@router.get("/workflows", response_model=WorkflowListResponse)
async def list_workflows() -> WorkflowListResponse:
    """List all workflow names."""
    try:
        names = _get_workflow_names()
        return WorkflowListResponse(workflows=names)
    except Exception as e:
        logger.exception("Failed to list workflows")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workflows/contexts", response_model=List[str])
async def list_contexts() -> List[str]:
    """
    Return all available AI_CONTEXT names from the merged config.
    Used by the UI to populate the context binding dropdown.
    """
    merged = config_api._read_merged_config_dict()
    contexts = merged.get("contexts", {})
    return list(contexts.keys())


@router.get("/workflows/{name}", response_model=WorkflowGetResponse)
async def get_workflow(name: str) -> WorkflowGetResponse:
    """Get a single workflow definition by name."""
    workflow = _get_workflow(name)
    if not workflow:
        raise HTTPException(status_code=404, detail=f"Workflow '{name}' not found")

    return WorkflowGetResponse(
        name=name,
        description=workflow.get("description"),
        version=workflow.get("version", "1.0"),
        variables=workflow.get("variables", {}),
        steps=workflow.get("steps", []),
        _canvas=workflow.get("_canvas"),
        global_prompt=workflow.get("global_prompt"),
        global_voice_provider=workflow.get("global_voice_provider"),
        global_voice_name=workflow.get("global_voice_name"),
        context=workflow.get("context"),
    )


@router.put("/workflows/{name}", response_model=WorkflowGetResponse)
async def put_workflow(name: str, req: WorkflowPutRequest) -> WorkflowGetResponse:
    """
    Create or update a workflow.

    The workflow is written to the local override config (ai-agent.local.yaml)
    so it persists across config updates and is gitignored.
    """
    # Validate steps
    errors = _validate_workflow_steps(req.steps)
    if errors:
        raise HTTPException(status_code=400, detail={"errors": errors})

    # Validate name matches URL
    if req.name != name:
        raise HTTPException(status_code=400, detail="Workflow name in body does not match URL path")

    # Read current merged config
    merged = config_api._read_merged_config_dict()
    workflows = merged.get("workflows", {})

    # Update the workflow
    # Convert canvas nodes + edges to engine workflow steps if _canvas is provided
    engine_steps = req.steps
    if req._canvas and req._canvas.get("nodes") is not None:
        nodes = req._canvas["nodes"]
        edges = req._canvas.get("edges") or []
        engine_steps = _build_workflow_steps(nodes, edges)

    workflows[name] = {
        "description": req.description,
        "version": req.version,
        "variables": req.variables,
        "steps": engine_steps,
        "_canvas": req._canvas,
        # Hybrid mode fields
        "global_prompt": req.global_prompt,
        "global_voice_provider": req.global_voice_provider,
        "global_voice_name": req.global_voice_name,
        # Context binding
        "context": req.context,
    }
    merged["workflows"] = workflows

    # Compute minimal local override
    base = config_api._read_base_config_dict()
    desired = merged

    override = config_api._compute_local_override(base, desired)

    # Write to local config
    import yaml
    content = yaml.dump(override, default_flow_style=False, sort_keys=False)
    config_api._write_local_config(content)

    logger.info(f"Workflow saved: {name}")

    # If context binding was provided, assign this workflow to the context
    if req.context:
        _assign_workflow_to_context(name, req.context)

    return WorkflowGetResponse(
        name=req.name,
        description=req.description,
        version=req.version,
        variables=req.variables,
        steps=req.steps,
        _canvas=req._canvas,
        global_prompt=req.global_prompt,
        global_voice_provider=req.global_voice_provider,
        global_voice_name=req.global_voice_name,
        context=req.context,
    )


@router.delete("/workflows/{name}")
async def delete_workflow(name: str) -> Dict[str, str]:
    """Delete a workflow by name."""
    # Read current merged config
    merged = config_api._read_merged_config_dict()
    workflows = merged.get("workflows", {})

    if name not in workflows:
        raise HTTPException(status_code=404, detail=f"Workflow '{name}' not found")

    # Remove the workflow
    del workflows[name]
    merged["workflows"] = workflows

    # Compute minimal local override
    base = config_api._read_base_config_dict()
    desired = merged

    override = config_api._compute_local_override(base, desired)

    # Write to local config
    import yaml
    content = yaml.dump(override, default_flow_style=False, sort_keys=False)
    config_api._write_local_config(content)

    logger.info(f"Workflow deleted: {name}")

    return {"deleted": name}


@router.post("/workflows/{name}/validate", response_model=WorkflowValidateResponse)
async def validate_workflow(name: str, req: WorkflowPutRequest) -> WorkflowValidateResponse:
    """Validate a workflow definition without saving it."""
    errors = _validate_workflow_steps(req.steps)

    # Additional name check
    if req.name != name:
        errors.append("Workflow name in body does not match URL path")

    return WorkflowValidateResponse(
        valid=len(errors) == 0,
        errors=errors,
    )


@router.post("/workflows/validate", response_model=WorkflowValidateResponse)
async def validate_workflow_body(req: WorkflowPutRequest) -> WorkflowValidateResponse:
    """Validate a workflow definition by value (no name in URL)."""
    errors = _validate_workflow_steps(req.steps)
    return WorkflowValidateResponse(
        valid=len(errors) == 0,
        errors=errors,
    )
