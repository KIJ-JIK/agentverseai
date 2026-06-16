import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)

class ReleaseManagerAgent(BaseAgent):
    name = "ReleaseManagerAgent"
    system_prompt = (
        "You are the Release Manager in AgentVerse AI, performing final pre-deployment validation.\n"
        "You receive the final pipeline state after all review loops. "
        "Issue a MERGE_READY verdict if:\n"
        "- Code was eventually approved or max review cycles were met without fatal security errors.\n"
        "- Tests were generated.\n"
        "- Docs were generated.\n\n"
        "Issue HOLD only if a critical security issue remains unresolved. Do NOT issue HOLD for minor parse warnings or incomplete test coverage.\n\n"
        "Respond ONLY with valid JSON:\n"
        "{\n"
        '  "verdict": "MERGE_READY|HOLD",\n'
        '  "confidence_score": 0.0,\n'
        '  "checklist": {\n'
        '    "architecture_defined": true,\n'
        '    "frontend_code_generated": true,\n'
        '    "backend_code_generated": true,\n'
        '    "code_review_passed": true,\n'
        '    "tests_generated": true,\n'
        '    "docs_generated": true\n'
        '  },\n'
        '  "release_notes": "string summary"\n'
        "}\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Perform final validation and issue release verdict.
        
        Args:
            input_data: dict with keys:
                - 'architecture': SPEC_GENERATED payload
                - 'frontend_code': approved frontend code payload
                - 'backend_code': approved backend code payload
                - 'review_result': CODE_APPROVED payload
                - 'tests': TESTS_GENERATED payload
                - 'documentation': DOCS_GENERATED payload
        
        Returns:
            Dict with verdict, confidence_score, checklist, release_notes.
        """
        user_prompt = (
            "Perform final pre-deployment validation for this feature pipeline:\n\n"
            f"Architecture Defined: {'Yes' if input_data.get('architecture') else 'No'}\n"
            f"Architecture Pattern: {input_data.get('architecture', {}).get('architecture_pattern', 'N/A')}\n\n"
            f"Frontend Code: {'Yes' if input_data.get('frontend_code') else 'No'}\n"
            f"  File: {input_data.get('frontend_code', {}).get('file_target', 'N/A')}\n"
            f"  Iterations: {input_data.get('frontend_code', {}).get('iteration_count', 'N/A')}\n\n"
            f"Backend Code: {'Yes' if input_data.get('backend_code') else 'No'}\n"
            f"  File: {input_data.get('backend_code', {}).get('file_target', 'N/A')}\n"
            f"  Iterations: {input_data.get('backend_code', {}).get('iteration_count', 'N/A')}\n\n"
            f"Code Review: {'Passed' if input_data.get('review_result', {}).get('verdict') == 'APPROVED' else 'N/A'}\n"
            f"  Force Approved: {input_data.get('review_result', {}).get('_force_approved', False)}\n\n"
            f"Tests Generated: {'Yes' if input_data.get('tests') else 'No'}\n"
            f"  Framework: {input_data.get('tests', {}).get('test_framework', 'N/A')}\n"
            f"  Coverage: {input_data.get('tests', {}).get('coverage_estimate', 'N/A')}\n"
            f"  Test Count: {len(input_data.get('tests', {}).get('test_cases', []))}\n\n"
            f"Documentation: {'Yes' if input_data.get('documentation') else 'No'}\n"
            f"  Title: {input_data.get('documentation', {}).get('title', 'N/A')}\n\n"
            "Issue your verdict."
        )
        
        logger.info(f"[{self.name}] Performing final release validation")
        
        result = await self.call_json(user_prompt)

        if "_parse_error" in result:
            logger.warning(f"[{self.name}] Failed to parse JSON. Falling back.")
            all_present = all([
                input_data.get("architecture"),
                input_data.get("frontend_code"),
                input_data.get("backend_code"),
                input_data.get("tests"),
                input_data.get("documentation")
            ])
            result["verdict"] = "MERGE_READY" if all_present else "HOLD"
            result["confidence_score"] = 0.8 if all_present else 0.3
            result["checklist"] = {
                "architecture_defined": bool(input_data.get("architecture")),
                "frontend_code_generated": bool(input_data.get("frontend_code")),
                "backend_code_generated": bool(input_data.get("backend_code")),
                "code_review_passed": input_data.get("review_result", {}).get("verdict") == "APPROVED",
                "tests_generated": bool(input_data.get("tests")),
                "docs_generated": bool(input_data.get("documentation"))
            }
            result["release_notes"] = "Auto-generated verdict due to LLM parse failure."

        # Emit the appropriate event
        verdict = result.get("verdict", "HOLD").upper()
        if verdict == "MERGE_READY":
            await self.emit("FINAL_VERDICT_MERGE_READY", result)
        else:
            await self.emit("FINAL_VERDICT_HOLD", result)
        
        return result
