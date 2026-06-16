import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)

class TechWriterAgent(BaseAgent):
    name = "TechWriterAgent"
    system_prompt = (
        "You are a technical documentation writer. Given a feature's architecture spec and code, write a developer README.\n"
        "Respond ONLY with valid JSON:\n"
        "{\n"
        '  "doc_type": "README",\n'
        '  "title": "string",\n'
        '  "content": "full Markdown string with sections: Overview, Setup, API Endpoints, Components, Architecture"\n'
        "}\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Generate README documentation from architecture spec and approved code.
        
        Args:
            input_data: dict with keys:
                - 'architecture': the SPEC_GENERATED payload from ArchitectAgent
                - 'frontend_code': approved frontend code payload
                - 'backend_code': approved backend code payload
                - 'tests': the TESTS_GENERATED payload from QATesterAgent
        
        Returns:
            Dict with doc_type, title, content (Markdown string).
        """
        architecture = input_data.get("architecture", {})
        frontend_code = input_data.get("frontend_code", {})
        backend_code = input_data.get("backend_code", {})
        tests = input_data.get("tests", {})
        
        import json
        user_prompt = (
            "Generate a comprehensive developer README.md for this feature:\n\n"
            f"=== ARCHITECTURE ===\n{json.dumps(architecture, indent=2)}\n\n"
            f"=== FRONTEND ({frontend_code.get('file_target', 'N/A')}) ===\n"
            f"{frontend_code.get('source_code', 'N/A')[:2000]}\n\n"
            f"=== BACKEND ({backend_code.get('file_target', 'N/A')}) ===\n"
            f"{backend_code.get('source_code', 'N/A')[:2000]}\n\n"
            f"=== TESTS ({tests.get('test_file', 'N/A')}) ===\n"
            f"Framework: {tests.get('test_framework', 'N/A')}\n"
            f"Coverage: {tests.get('coverage_estimate', 'N/A')}\n\n"
            "Write a complete README with: Overview, Setup, API Endpoints, Components, Architecture, and Testing sections."
        )
        
        logger.info(f"[{self.name}] Generating documentation")
        
        result = await self.call_json(user_prompt)

        if "_parse_error" in result:
            logger.warning(f"[{self.name}] Failed to parse JSON. Falling back.")
            result["doc_type"] = "README"
            result["title"] = "Feature Documentation"
            result["content"] = result.pop("_raw_response", "")
        
        await self.emit("DOCS_GENERATED", result)
        return result
