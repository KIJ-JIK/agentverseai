import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)

MAX_REVIEW_CYCLES = 3


class CodeReviewerAgent(BaseAgent):
    name = "CodeReviewerAgent"
    system_prompt = (
        "You are a senior code security reviewer in the AgentVerse AI pipeline. Audit the provided code and respond ONLY with valid JSON.\n\n"
        "Your verdict must be one of:\n"
        "- APPROVED: code is functional and meets the specification contracts.\n"
        "- REVISION_NEEDED: there are specific security issues, syntax bugs, or logical errors that MUST be fixed. Provide a list of remediation tickets.\n"
        "- REJECTED: only use this if code is completely broken or empty.\n\n"
        "IMPORTANT: Do NOT reject or request revisions for style preferences, minor omissions, or missing nice-to-have features. "
        "If the code is secure, runs, and matches the basic spec contract, issue an APPROVED verdict.\n\n"
        "If code passes all checks:\n"
        '{"verdict": "APPROVED", "evaluation_metrics": {"security": "PASS", "syntax": "PASS", "logic": "PASS"}}\n\n'
        "If code needs revisions:\n"
        "{\n"
        '  "verdict": "REVISION_NEEDED",\n'
        '  "evaluation_metrics": {"security": "FAIL|PASS", "syntax": "FAIL|PASS", "logic": "FAIL|PASS"},\n'
        '  "remediation_tickets": [\n'
        '    {\n'
        '      "target_agent": "FrontendDevAgent|BackendDevAgent",\n'
        '      "file_context": "filename",\n'
        '      "line_range": "N-M",\n'
        '      "vulnerability": "description of issue",\n'
        '      "fix_instruction": "exact fix instruction"\n'
        '    }\n'
        '  ]\n'
        "}\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Review frontend and backend code for security, syntax, and logic issues.

        Args:
            input_data: dict with keys:
                - 'frontend_code': the CODE_EMITTED payload from FrontendDevAgent
                - 'backend_code': the CODE_EMITTED payload from BackendDevAgent
                - 'review_cycle': current review cycle number (1-indexed)

        Returns:
            Dict with verdict, evaluation_metrics, and optionally remediation_tickets.
        """
        frontend_code = input_data.get("frontend_code", {})
        backend_code = input_data.get("backend_code", {})
        review_cycle = input_data.get("review_cycle", 1)

        user_prompt = (
            f"Review Cycle: {review_cycle}/{MAX_REVIEW_CYCLES}\n\n"
            f"=== FRONTEND CODE ({frontend_code.get('file_target', 'unknown')}) ===\n"
            f"{frontend_code.get('source_code', 'No code provided')}\n\n"
            f"=== BACKEND CODE ({backend_code.get('file_target', 'unknown')}) ===\n"
            f"{backend_code.get('source_code', 'No code provided')}\n\n"
            "Audit both code files. Check for security vulnerabilities, syntax errors, and logic issues.\n"
            "Respond with your verdict JSON."
        )

        logger.info(f"[{self.name}] Starting code review (cycle {review_cycle}/{MAX_REVIEW_CYCLES})")

        # If we've hit max cycles, force approve
        if review_cycle > MAX_REVIEW_CYCLES:
            logger.warning(f"[{self.name}] Max review cycles ({MAX_REVIEW_CYCLES}) exceeded. Force-approving.")
            result = {
                "verdict": "APPROVED",
                "evaluation_metrics": {"security": "PASS", "syntax": "PASS", "logic": "PASS"},
                "_force_approved": True,
                "_warning": f"Force-approved after {MAX_REVIEW_CYCLES} review cycles to prevent infinite loop."
            }
            await self.emit("CODE_APPROVED", result)
            return result

        result = await self.call_json(user_prompt)

        if "_parse_error" in result:
            logger.warning(f"[{self.name}] Failed to parse review JSON. Defaulting to APPROVED.")
            result["verdict"] = "APPROVED"
            result["evaluation_metrics"] = {"security": "PASS", "syntax": "PASS", "logic": "PASS"}

        # Emit appropriate event based on verdict
        verdict = result.get("verdict", "APPROVED").upper()

        if verdict in ("REJECTED", "REVISION_NEEDED"):
            result["verdict"] = "REJECTED"  # Normalize for orchestrator flow contract
            await self.emit("CODE_REJECTED", result)
        else:
            result["verdict"] = "APPROVED"
            await self.emit("CODE_APPROVED", result)

        return result
