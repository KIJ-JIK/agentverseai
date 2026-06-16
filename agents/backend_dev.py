import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class BackendDevAgent(BaseAgent):
    name = "BackendDevAgent"
    system_prompt = (
        "You are an expert Python/FastAPI developer. Given a backend specification, write production-quality FastAPI code.\n"
        "Respond ONLY with valid JSON:\n"
        "{\n"
        '  "file_target": "routes.py",\n'
        '  "language": "python",\n'
        '  "source_code": "full escaped Python code string",\n'
        '  "iteration_count": 1,\n'
        '  "changes_made": "string listing exact changes applied"\n'
        "}\n"
        "Use SQLAlchemy ORM for database operations. Always use parameterized queries. Include proper error handling and HTTP status codes.\n\n"
        "When you receive revision/remediation comments (CODE_REJECTED):\n"
        "1. Read each comment carefully.\n"
        "2. Fix only the specific issues and bugs mentioned.\n"
        "3. Keep unchanged sections intact to preserve original functionality.\n"
        "4. Document your fixes in the 'changes_made' field.\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Generate FastAPI backend code from a backend specification.

        Args:
            input_data: dict with keys:
                - 'backend_spec': the backend specification from the architect
                - 'remediation_tickets' (optional): list of reviewer fix instructions
                - 'iteration_count' (optional): current iteration number

        Returns:
            Dict with file_target, language, source_code, iteration_count.
        """
        backend_spec = input_data.get("backend_spec", {})
        remediation_tickets = input_data.get("remediation_tickets", [])
        iteration_count = input_data.get("iteration_count", 1)

        import json
        user_prompt = f"Backend Specification:\n{json.dumps(backend_spec, indent=2)}\n"

        if remediation_tickets:
            user_prompt += "\n⚠️ PREVIOUS CODE WAS REJECTED. Fix the following issues:\n"
            for ticket in remediation_tickets:
                user_prompt += (
                    f"  - File: {ticket.get('file_context', 'N/A')}\n"
                    f"    Lines: {ticket.get('line_range', 'N/A')}\n"
                    f"    Issue: {ticket.get('vulnerability', 'N/A')}\n"
                    f"    Fix: {ticket.get('fix_instruction', 'N/A')}\n"
                )
            user_prompt += f"\nThis is iteration #{iteration_count}. Apply ALL fixes.\n"

        user_prompt += "\nGenerate the FastAPI backend code as JSON."

        logger.info(f"[{self.name}] Generating backend code (iteration {iteration_count})")

        result = await self.call_json(user_prompt)

        result["iteration_count"] = iteration_count
        if "_parse_error" in result:
            result["file_target"] = "routes.py"
            result["language"] = "python"
            result["source_code"] = result.pop("_raw_response", "")

        await self.emit("CODE_EMITTED", result)
        return result
