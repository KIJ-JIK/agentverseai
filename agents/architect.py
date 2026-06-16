import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class ArchitectAgent(BaseAgent):
    name = "ArchitectAgent"
    system_prompt = (
        "You are a senior software architect. Given a feature request, produce a structured JSON architecture specification.\n"
        "You MUST respond with ONLY valid JSON, no explanation text before or after.\n"
        "Output schema:\n"
        "{\n"
        '  "architecture_pattern": "string (e.g. REST + React SPA)",\n'
        '  "frontend_spec": {\n'
        '    "components": ["list of React component names"],\n'
        '    "state_hooks": ["list of useState/useEffect hooks needed"]\n'
        '  },\n'
        '  "backend_spec": {\n'
        '    "endpoints": [{"path": "/api/...", "method": "GET|POST|PUT|DELETE", "description": "string"}],\n'
        '    "db_tables": ["list of database table names"]\n'
        '  },\n'
        '  "task_matrix": [\n'
        '    {"id": "T001", "assigned_to": "FrontendDevAgent|BackendDevAgent", "objective": "string"}\n'
        '  ]\n'
        "}\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Process a feature request and generate an architecture specification.

        Args:
            input_data: dict with key 'feature_request' containing the raw NL request string.

        Returns:
            Parsed architecture spec dict.
        """
        feature_request = input_data.get("feature_request", "")
        user_prompt = f"Feature Request:\n{feature_request}\n\nGenerate the architecture specification JSON."

        logger.info(f"[{self.name}] Processing feature request: {feature_request[:80]}...")

        result = await self.call_json(user_prompt)

        # Emit event
        await self.emit("SPEC_GENERATED", result)

        return result
