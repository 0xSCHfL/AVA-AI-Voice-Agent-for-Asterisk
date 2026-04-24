import importlib.util
import sys
import types
from pathlib import Path

import pytest

HAS_PYDANTIC = importlib.util.find_spec("pydantic") is not None

if "structlog" not in sys.modules:
    structlog_stub = types.ModuleType("structlog")

    class _Logger:
        def __getattr__(self, name):
            return lambda *args, **kwargs: None

    structlog_stub.get_logger = lambda *args, **kwargs: _Logger()
    sys.modules["structlog"] = structlog_stub

if "prometheus_client" not in sys.modules:
    prometheus_stub = types.ModuleType("prometheus_client")

    class _Metric:
        def __init__(self, *args, **kwargs):
            pass

        def labels(self, *args, **kwargs):
            return self

        def set(self, *args, **kwargs):
            pass

        def inc(self, *args, **kwargs):
            pass

        def dec(self, *args, **kwargs):
            pass

    prometheus_stub.Counter = _Metric
    prometheus_stub.Gauge = _Metric
    sys.modules["prometheus_client"] = prometheus_stub

if HAS_PYDANTIC:
    from src.core.models import CallSession
    from src.core.session_store import SessionStore
    from src.core.workflow_engine import WorkflowEngine
    from src.core.workflow_models import Workflow


class _WorkflowLoader:
    def __init__(self, workflow):
        self.workflow = workflow

    def get(self, name):
        return self.workflow if name == self.workflow.name else None


class _FakeEngine:
    def __init__(self, transcripts):
        self.transcripts = list(transcripts)
        self.capture_started = False
        self.capture_stopped = False
        self.ensure_pipeline_called = False

    def _begin_workflow_transcript_capture(self, call_id):
        self.capture_started = True

    def _end_workflow_transcript_capture(self, call_id):
        self.capture_stopped = True

    def _clear_workflow_transcripts(self, call_id):
        pass

    async def _ensure_pipeline_runner(self, session, *, forced=False):
        self.ensure_pipeline_called = bool(forced)

    async def _wait_for_workflow_transcript(self, call_id, timeout_sec):
        if not self.transcripts:
            return None
        return self.transcripts.pop(0)


def _load_workflows_module(monkeypatch):
    fastapi_stub = types.ModuleType("fastapi")

    class _Router:
        def __init__(self, *args, **kwargs):
            pass

        def get(self, *args, **kwargs):
            return lambda fn: fn

        post = put = delete = get

    class _HTTPException(Exception):
        def __init__(self, status_code=500, detail=None):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    fastapi_stub.APIRouter = _Router
    fastapi_stub.HTTPException = _HTTPException
    monkeypatch.setitem(sys.modules, "fastapi", fastapi_stub)

    for package_name in ("admin_ui", "admin_ui.backend", "admin_ui.backend.api"):
        package = types.ModuleType(package_name)
        package.__path__ = []
        monkeypatch.setitem(sys.modules, package_name, package)

    config_stub = types.ModuleType("admin_ui.backend.api.config")
    config_stub._read_merged_config_dict = lambda: {}
    config_stub._read_base_config_dict = lambda: {}
    config_stub._write_local_override_config = lambda data: None
    monkeypatch.setitem(sys.modules, "admin_ui.backend.api.config", config_stub)

    module_path = Path(__file__).resolve().parents[1] / "admin_ui/backend/api/workflows.py"
    spec = importlib.util.spec_from_file_location("admin_ui.backend.api.workflows", module_path)
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, "admin_ui.backend.api.workflows", module)
    spec.loader.exec_module(module)
    return module


@pytest.mark.skipif(not HAS_PYDANTIC, reason="pydantic is not installed")
@pytest.mark.asyncio
async def test_prompt_step_routes_on_simple_edge_label():
    workflow = Workflow(
        name="fr_confirm",
        variables={"speech_timeout_sec": "1"},
        steps=[
            {
                "id": "start",
                "type": "prompt",
                "prompt": "Bonjour. Dites oui pour continuer.",
                "conditions": [{"if": "oui", "goto": "accepted"}],
            },
            {
                "id": "accepted",
                "type": "prompt",
                "prompt": "Merci.",
            },
        ],
    )
    session_store = SessionStore()
    session = CallSession(call_id="call-1", caller_channel_id="call-1")
    session.pipeline_name = "local_hybrid"
    await session_store.upsert_call(session)

    fake_engine = _FakeEngine(["Oui, bien sur"])
    workflow_engine = WorkflowEngine(
        workflow_name="fr_confirm",
        session=session,
        session_store=session_store,
        workflow_loader=_WorkflowLoader(workflow),
        engine=fake_engine,
    )
    spoken = []

    async def fake_speak(text):
        spoken.append(text)

    workflow_engine._speak_and_wait = fake_speak

    result = await workflow_engine.execute()

    assert result.completed is True
    assert spoken == ["Bonjour. Dites oui pour continuer.", "Merci."]
    assert result.variables["last_utterance"] == "Oui, bien sur"
    assert fake_engine.capture_started is True
    assert fake_engine.capture_stopped is True
    assert fake_engine.ensure_pipeline_called is True


@pytest.mark.skipif(not HAS_PYDANTIC, reason="pydantic is not installed")
def test_canvas_single_labeled_edge_becomes_prompt_condition(monkeypatch):
    workflows_module = _load_workflows_module(monkeypatch)

    steps = workflows_module._build_workflow_steps(
        nodes=[
            {
                "id": "start",
                "type": "conversation",
                "isStart": True,
                "data": {"firstMessage": "Bonjour. Dites oui."},
            },
            {
                "id": "accepted",
                "type": "conversation",
                "data": {"firstMessage": "Merci."},
            },
        ],
        edges=[
            {
                "id": "edge-1",
                "from": "start",
                "to": "accepted",
                "label": "oui",
            }
        ],
    )

    assert steps[0]["type"] == "prompt"
    assert steps[0]["prompt"] == "Bonjour. Dites oui."
    assert steps[0]["conditions"] == [{"if": "oui", "goto": "accepted"}]
    assert "next" not in steps[0]
