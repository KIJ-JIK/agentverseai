import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)

class QATesterAgent(BaseAgent):
    name = "QATesterAgent"
    system_prompt = (
        "You are a QA engineer specializing in test-driven development. Given source code, write comprehensive unit tests.\n"
        "Respond ONLY with valid JSON:\n"
        "{\n"
        '  "test_framework": "pytest|jest",\n'
        '  "test_file": "test_filename",\n'
        '  "test_cases": ["list of test function names"],\n'
        '  "source_code": "full test code string",\n'
        '  "coverage_estimate": "percentage string"\n'
        "}\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Generate unit tests for approved frontend and backend code.
        
        Args:
            input_data: dict with keys:
                - 'frontend_code': approved frontend CODE_EMITTED payload
                - 'backend_code': approved backend CODE_EMITTED payload
        
        Returns:
            Dict with test_framework, test_file, test_cases, source_code, coverage_estimate.
        """
        frontend_code = input_data.get("frontend_code", {})
        backend_code = input_data.get("backend_code", {})
        
        user_prompt = (
            "Generate comprehensive unit tests for the following code:\n\n"
            f"=== FRONTEND CODE ({frontend_code.get('file_target', 'unknown')}) ===\n"
            f"{frontend_code.get('source_code', 'No code provided')}\n\n"
            f"=== BACKEND CODE ({backend_code.get('file_target', 'unknown')}) ===\n"
            f"{backend_code.get('source_code', 'No code provided')}\n\n"
            "Write tests for both frontend (Jest) and backend (pytest). "
            "Focus on edge cases, security validations, and API contract testing.\n"
            "Respond with the test suite JSON."
        )
        
        logger.info(f"[{self.name}] Generating test suites for approved code")
        
        result = await self.call_json(user_prompt)

        if "_parse_error" in result:
            logger.warning(f"[{self.name}] Failed to parse JSON. Falling back.")
            result["test_framework"] = "pytest"
            result["test_file"] = "test_suite.py"
            result["test_cases"] = ["test_fallback"]
            result["source_code"] = result.pop("_raw_response", "")
            result["coverage_estimate"] = "N/A"
        
        await self.emit("TESTS_GENERATED", result)
        return result
