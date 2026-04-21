"""
IVRs API: CRUD endpoints for IVR flow definitions.

IVRs are stored in the merged YAML config under the top-level `ivrs:` key.
This module provides list, get, create, update, delete operations.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional, List
import logging

from . import config as config_api

router = APIRouter()
logger = logging.getLogger(__name__)


class IVRListResponse(BaseModel):
    """Response for listing all IVRs."""
    ivrs: List[str]


class IVRGetResponse(BaseModel):
    """Response for getting a single IVR."""
    name: str
    description: Optional[str] = None
    languages: List[str] = ["en"]
    routes: Dict[str, str] = {}
    greeting_audio: Dict[str, str] = {}
    enabled: bool = True
    flow: Optional[Dict[str, Any]] = None
    status: str = "draft"


class IVRPutRequest(BaseModel):
    """Request for creating or updating an IVR."""
    name: str
    description: Optional[str] = None
    languages: List[str] = ["en"]
    routes: Dict[str, str] = {}
    greeting_audio: Dict[str, str] = {}
    enabled: bool = True
    flow: Optional[Dict[str, Any]] = None
    status: str = "draft"


def _get_ivrs_from_config() -> Dict[str, Any]:
    """Read the IVRs section from the merged config."""
    config = config_api._read_merged_config_dict()
    return config.get("ivrs", {}) or {}


def _get_ivr_names() -> List[str]:
    """Return all IVR names in the config."""
    ivrs = _get_ivrs_from_config()
    return list(ivrs.keys())


def _get_ivr(name: str) -> Optional[Dict[str, Any]]:
    """Get a single IVR definition by name."""
    ivrs = _get_ivrs_from_config()
    return ivrs.get(name)


@router.get("/ivrs", response_model=IVRListResponse)
async def list_ivrs():
    """List all IVR flow names."""
    return {"ivrs": _get_ivr_names()}


@router.get("/ivrs/{name}", response_model=IVRGetResponse)
async def get_ivr(name: str):
    """Get a single IVR flow definition."""
    ivr = _get_ivr(name)
    if not ivr:
        raise HTTPException(status_code=404, detail=f"IVR '{name}' not found")
    return ivr


@router.put("/ivrs/{name}", response_model=IVRGetResponse)
async def put_ivr(name: str, req: IVRPutRequest):
    """Create or update an IVR flow."""
    ivrs = _get_ivrs_from_config()

    # Validate languages
    valid_langs = {"en", "fr", "nl", "lu", "es", "de", "pt"}
    for lang in req.languages:
        if lang not in valid_langs:
            raise HTTPException(status_code=400, detail=f"Invalid language: {lang}")

    # Preserve existing data if not provided
    existing = ivrs.get(name, {})

    ivrs[name] = {
        "name": name,
        "description": req.description if req.description is not None else existing.get("description"),
        "languages": req.languages if req.languages else existing.get("languages", ["en"]),
        "routes": req.routes if req.routes is not None else existing.get("routes", {}),
        "greeting_audio": req.greeting_audio if req.greeting_audio is not None else existing.get("greeting_audio", {}),
        "enabled": req.enabled if req.enabled is not None else existing.get("enabled", True),
        "flow": req.flow if req.flow is not None else existing.get("flow", {"nodes": {}, "rootHead": None}),
        "status": req.status if req.status is not None else existing.get("status", "draft"),
    }

    config_api._save_field_to_config("ivrs", ivrs)
    return ivrs[name]


@router.delete("/ivrs/{name}")
async def delete_ivr(name: str):
    """Delete an IVR flow."""
    ivrs = _get_ivrs_from_config()
    if name not in ivrs:
        raise HTTPException(status_code=404, detail=f"IVR '{name}' not found")

    del ivrs[name]
    config_api._save_field_to_config("ivrs", ivrs)
    return {"status": "ok"}
