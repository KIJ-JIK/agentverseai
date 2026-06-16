import logging
from core.base_agent import BaseAgent

logger = logging.getLogger(__name__)


class FrontendDevAgent(BaseAgent):
    name = "FrontendDevAgent"
    system_prompt = (
        "You are an expert React developer. Given a frontend specification, write production-quality React component code.\n"
        "Respond ONLY with valid JSON:\n"
        "{\n"
        '  "file_target": "ComponentName.jsx",\n'
        '  "language": "react",\n'
        '  "source_code": "full escaped JSX code string",\n'
        '  "iteration_count": 1,\n'
        '  "changes_made": "string listing exact changes applied"\n'
        "}\n"
        "Use Tailwind CSS classes. Use functional components with hooks. No class components.\n\n"
        "When you receive revision/remediation comments (CODE_REJECTED):\n"
        "1. Read each comment carefully.\n"
        "2. Fix only the specific issues and bugs mentioned.\n"
        "3. Keep unchanged sections intact to preserve original functionality.\n"
        "4. Document your fixes in the 'changes_made' field.\n"
    )

    async def run(self, input_data: dict) -> dict:
        """Generate React frontend code from a frontend specification.

        Args:
            input_data: dict with keys:
                - 'frontend_spec': the frontend specification from the architect
                - 'remediation_tickets' (optional): list of reviewer fix instructions
                - 'iteration_count' (optional): current iteration number

        Returns:
            Dict with file_target, language, source_code, iteration_count.
        """
        frontend_spec = input_data.get("frontend_spec", {})
        remediation_tickets = input_data.get("remediation_tickets", [])
        iteration_count = input_data.get("iteration_count", 1)

        import json
        user_prompt = f"Frontend Specification:\n{json.dumps(frontend_spec, indent=2)}\n"

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

        user_prompt += "\nGenerate the React component code as JSON."

        logger.info(f"[{self.name}] Generating frontend code (iteration {iteration_count})")

        result = await self.call_json(user_prompt)
        
        result["iteration_count"] = iteration_count
        if "_parse_error" in result:
            result["file_target"] = "App.jsx"
            result["language"] = "react"
            result["source_code"] = result.pop("_raw_response", "")

        await self.emit("CODE_EMITTED", result)
        return result
