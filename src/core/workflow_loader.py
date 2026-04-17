"""
Workflow loader: loads and validates workflow definitions from YAML config.

Loads the `workflows:` section from the main config dict, validates each
workflow against the schema, and provides lookup by name.
"""

import logging
from typing import Dict, Optional, List

from .workflow_models import Workflow

logger = logging.getLogger(__name__)


class WorkflowLoadError(Exception):
    """Raised when workflow loading or validation fails."""
    pass


class WorkflowLoader:
    """
    Loads workflow definitions from the YAML config dict.

    Workflows are defined under the top-level `workflows:` key in
    ai-agent.yaml (or ai-agent.local.yaml). Each key is a workflow name,
    and the value is the workflow definition.
    """

    def __init__(self, config: Dict):
        """
        Initialize with the loaded YAML config dict.

        Args:
            config: The full parsed YAML config (from loaders.py)
        """
        self._config = config
        self._workflows: Dict[str, Workflow] = {}
        self._loaded = False

    def load(self) -> None:
        """
        Load and validate all workflows from config.

        Called automatically on first access, but can be called manually
        to reload after config changes.
        """
        raw_workflows = self._config.get("workflows", {})

        if not raw_workflows:
            logger.debug("No workflows section found in config")
            self._workflows = {}
            self._loaded = True
            return

        loaded = {}
        for name, definition in raw_workflows.items():
            try:
                workflow = Workflow(name=name, **definition)
                loaded[name] = workflow
                logger.debug(f"Loaded workflow: {name} with {len(workflow.steps)} steps")
            except Exception as e:
                raise WorkflowLoadError(
                    f"Failed to load workflow '{name}': {e}"
                ) from e

        self._workflows = loaded
        self._loaded = True
        logger.info(f"Loaded {len(self._workflows)} workflow(s): {list(self._workflows.keys())}")

    @property
    def workflows(self) -> Dict[str, Workflow]:
        """All loaded workflows keyed by name."""
        if not self._loaded:
            self.load()
        return self._workflows

    def get(self, name: str) -> Optional[Workflow]:
        """
        Get a workflow by name.

        Args:
            name: Workflow name as defined in YAML

        Returns:
            Workflow instance, or None if not found
        """
        if not self._loaded:
            self.load()
        return self._workflows.get(name)

    def list_names(self) -> List[str]:
        """List all workflow names."""
        if not self._loaded:
            self.load()
        return list(self._workflows.keys())

    def reload(self, config: Dict) -> None:
        """
        Reload workflows from a new config dict.

        Used after config changes are saved via the Admin UI.

        Args:
            config: The updated full YAML config dict
        """
        self._config = config
        self._loaded = False
        self.load()
