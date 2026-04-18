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


class WorkflowPutRequest(BaseModel):
    """Request for creating or updating a workflow."""
    name: str
    description: Optional[str] = None
    version: str = "1.0"
    variables: Dict[str, str] = {}
    steps: List[Dict[str, Any]]
    _canvas: Optional[Dict[str, Any]] = None


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
    workflows[name] = {
        "description": req.description,
        "version": req.version,
        "variables": req.variables,
        "steps": req.steps,
        "_canvas": req._canvas,
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

    return WorkflowGetResponse(
        name=req.name,
        description=req.description,
        version=req.version,
        variables=req.variables,
        steps=req.steps,
        _canvas=req._canvas,
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
