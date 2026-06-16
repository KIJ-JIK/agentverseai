"""
DevFlow AI — LLM Router
=========================
Routes each agent's LLM request to the correct API cluster:

- **AI/ML API** (reasoning): Architect, Code Reviewer, Release Manager
- **Featherless AI** (code-gen): Frontend Dev, Backend Dev, QA Tester, Tech Writer

All base URLs, API keys, and model IDs are pulled from ``config.settings``
so nothing is hardcoded.  Falls back to rich mock responses when
``MOCK_MODE=True`` or when the required API key is missing.
"""

import asyncio
import json
import logging
import time
import urllib.error
import urllib.request

from config.settings import settings

logger = logging.getLogger(__name__)

# ── Agent → cluster mapping ──────────────────────────────────────────────────
AIML_AGENTS = ["ArchitectAgent", "CodeReviewerAgent", "ReleaseManagerAgent"]
FEATHERLESS_AGENTS = [
    "FrontendDevAgent",
    "BackendDevAgent",
    "QATesterAgent",
    "TechWriterAgent",
]


# ══════════════════════════════════════════════════════════════════════════════
#  RATE LIMITER  (protects API keys & token budgets)
# ══════════════════════════════════════════════════════════════════════════════

RATE_LIMIT_MAX_REQUESTS = 5
RATE_LIMIT_WINDOW_SECONDS = 10
_request_timestamps: list[float] = []


async def _rate_limit_throttle() -> None:
    global _request_timestamps
    now = time.time()
    _request_timestamps = [
        t for t in _request_timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS
    ]
    if len(_request_timestamps) >= RATE_LIMIT_MAX_REQUESTS:
        sleep_time = RATE_LIMIT_WINDOW_SECONDS - (now - _request_timestamps[0])
        if sleep_time > 0:
            logger.warning(
                f"[Rate Limiter] Throttling LLM requests. "
                f"Sleeping for {sleep_time:.2f}s..."
            )
            await asyncio.sleep(sleep_time)
            await _rate_limit_throttle()
            return
    _request_timestamps.append(time.time())


# ══════════════════════════════════════════════════════════════════════════════
#  SYNCHRONOUS LLM CALL  (runs inside asyncio.to_thread)
# ══════════════════════════════════════════════════════════════════════════════

def _sync_call_llm(
    url: str, api_key: str, model: str, system_prompt: str, user_prompt: str
) -> str:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    }
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.2,
    }

    req = urllib.request.Request(
        url + "/chat/completions",
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            res_body = response.read().decode("utf-8")
            res_json = json.loads(res_body)
            return res_json["choices"][0]["message"]["content"]
    except urllib.error.HTTPError as e:
        err_content = e.read().decode("utf-8")
        logger.error(f"LLM API Error: Status {e.code}, Response: {err_content}")
        raise RuntimeError(f"LLM API Error {e.code}: {err_content}")
    except Exception as e:
        logger.error(f"Failed to connect to LLM API: {e}")
        raise


# ══════════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

async def call_llm(agent_name: str, system_prompt: str, user_prompt: str) -> str:
    """Route LLM request to AI/ML API or Featherless AI depending on agent role.

    Falls back to mock responses if ``MOCK_MODE=True`` or if the required
    API keys are missing.
    """
    # ── Mock Mode Fallback ───────────────────────────────────────────────
    if settings.MOCK_MODE:
        logger.info(f"[Mock LLM] Generating mock response for {agent_name}")
        return get_mock_response(agent_name, user_prompt)

    # Apply rate limiting
    await _rate_limit_throttle()

    # ── Determine routing (all values from settings, nothing hardcoded) ──
    if agent_name in AIML_AGENTS:
        url = settings.AIML_BASE_URL
        api_key = settings.AIML_API_KEY
        model = settings.AIML_MODEL
        provider = "AI/ML API"
    else:
        url = settings.FEATHERLESS_BASE_URL
        api_key = settings.FEATHERLESS_API_KEY
        model = settings.FEATHERLESS_MODEL
        provider = "Featherless AI"

    # If keys are missing, fall back to mock
    if not api_key:
        logger.warning(
            f"API key for {provider} is missing. "
            f"Falling back to MOCK response for {agent_name}."
        )
        return get_mock_response(agent_name, user_prompt)

    logger.info(
        f"Routing {agent_name} request to {provider} using model {model}..."
    )
    try:
        return await asyncio.to_thread(
            _sync_call_llm, url, api_key, model, system_prompt, user_prompt
        )
    except Exception as e:
        logger.error(
            f"Error calling {provider} for {agent_name}: {e}. "
            "Falling back to mock response."
        )
        return get_mock_response(agent_name, user_prompt)


# ══════════════════════════════════════════════════════════════════════════════
#  MOCK RESPONSES
# ══════════════════════════════════════════════════════════════════════════════

def get_mock_response(agent_name: str, user_prompt: str) -> str:
    """Return pre-generated valid responses matching the schemas expected by each agent."""

    if agent_name == "ArchitectAgent":
        return json.dumps(
            {
                "architecture_pattern": "REST + React SPA",
                "frontend_spec": {
                    "components": [
                        "Header",
                        "KeyGenerator",
                        "AgentList",
                        "LogsConsole",
                    ],
                    "state_hooks": ["useState", "useEffect"],
                },
                "backend_spec": {
                    "endpoints": [
                        {
                            "path": "/api/keys",
                            "method": "GET",
                            "description": "Retrieve registered Band API keys",
                        },
                        {
                            "path": "/api/agent/create",
                            "method": "POST",
                            "description": "Register and start a new Band agent",
                        },
                    ],
                    "db_tables": ["api_keys", "registered_agents"],
                },
                "task_matrix": [
                    {
                        "id": "T001",
                        "assigned_to": "FrontendDevAgent",
                        "objective": "Create KeyGenerator component with key input form",
                    },
                    {
                        "id": "T002",
                        "assigned_to": "BackendDevAgent",
                        "objective": "Implement /api/agent/create endpoint with Band SDK",
                    },
                ],
            },
            indent=2,
        )

    elif agent_name == "FrontendDevAgent":
        return json.dumps(
            {
                "file_target": "KeyGenerator.jsx",
                "language": "react",
                "source_code": (
                    "import React, { useState } from 'react';\n\n"
                    "export default function KeyGenerator({ onKeySubmit }) {\n"
                    "  const [key, setKey] = useState('');\n\n"
                    "  const handleSubmit = (e) => {\n"
                    "    e.preventDefault();\n"
                    "    if (key.trim()) {\n"
                    "      onKeySubmit(key);\n"
                    "      setKey('');\n"
                    "    }\n"
                    "  };\n\n"
                    "  return (\n"
                    '    <div className="p-6 bg-slate-800 rounded-lg shadow-xl border border-slate-700">\n'
                    '      <h3 className="text-xl font-bold text-sky-400 mb-4">Band API Key Registration</h3>\n'
                    '      <form onSubmit={handleSubmit} className="flex gap-4">\n'
                    "        <input\n"
                    '          type="text"\n'
                    "          value={key}\n"
                    "          onChange={(e) => setKey(e.target.value)}\n"
                    '          placeholder="Enter Band API Key"\n'
                    '          className="flex-1 bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white"\n'
                    "        />\n"
                    '        <button type="submit" className="bg-sky-500 hover:bg-sky-600 px-4 py-2 rounded font-bold">\n'
                    "          Register Key\n"
                    "        </button>\n"
                    "      </form>\n"
                    "    </div>\n"
                    "  );\n"
                    "}"
                ),
                "iteration_count": 1,
            },
            indent=2,
        )

    elif agent_name == "BackendDevAgent":
        return json.dumps(
            {
                "file_target": "routes.py",
                "language": "python",
                "source_code": (
                    "from fastapi import FastAPI, HTTPException, Depends\n"
                    "from pydantic import BaseModel\n"
                    "from sqlalchemy.orm import Session\n"
                    "import os\n\n"
                    "app = FastAPI()\n\n"
                    "class KeySubmit(BaseModel):\n"
                    "    key: str\n\n"
                    '@app.post("/api/keys")\n'
                    "def register_key(data: KeySubmit):\n"
                    "    if not data.key:\n"
                    '        raise HTTPException(status_code=400, detail="Key cannot be empty")\n'
                    "    # Simulate DB write\n"
                    '    return {"status": "success", "message": "Key registered successfully"}\n'
                ),
                "iteration_count": 1,
            },
            indent=2,
        )

    elif agent_name == "CodeReviewerAgent":
        if "PREVIOUS CODE WAS REJECTED" in user_prompt:
            return json.dumps(
                {
                    "verdict": "APPROVED",
                    "evaluation_metrics": {
                        "security": "PASS",
                        "syntax": "PASS",
                        "logic": "PASS",
                    },
                },
                indent=2,
            )
        else:
            return json.dumps(
                {
                    "verdict": "REJECTED",
                    "evaluation_metrics": {
                        "security": "FAIL",
                        "syntax": "PASS",
                        "logic": "PASS",
                    },
                    "remediation_tickets": [
                        {
                            "target_agent": "BackendDevAgent",
                            "file_context": "routes.py",
                            "line_range": "10-15",
                            "vulnerability": "Missing rate limit check or payload validation",
                            "fix_instruction": (
                                "Add input sanitization and rate limiting check for key "
                                "submission endpoints to avoid spamming the database."
                            ),
                        }
                    ],
                },
                indent=2,
            )

    elif agent_name == "QATesterAgent":
        return json.dumps(
            {
                "test_framework": "pytest",
                "test_file": "test_routes.py",
                "test_cases": ["test_register_key_success", "test_register_key_empty"],
                "source_code": (
                    'def test_register_key_success(client):\n'
                    '    response = client.post("/api/keys", json={"key": "test_key"})\n'
                    '    assert response.status_code == 200\n'
                    '    assert response.json()["status"] == "success"\n\n'
                    'def test_register_key_empty(client):\n'
                    '    response = client.post("/api/keys", json={"key": ""})\n'
                    '    assert response.status_code == 400\n'
                ),
                "coverage_estimate": "85%",
            },
            indent=2,
        )

    elif agent_name == "TechWriterAgent":
        return json.dumps(
            {
                "doc_type": "README",
                "title": "Band Key Generator Module",
                "content": (
                    "# Band Key Generator\n\n"
                    "Allows secure submission and registration of Band API keys."
                ),
            },
            indent=2,
        )

    elif agent_name == "ReleaseManagerAgent":
        return json.dumps(
            {
                "verdict": "MERGE_READY",
                "summary": (
                    "All tests passed. Code reviews are approved. "
                    "Security vulnerability fixed."
                ),
                "reasons": [
                    "Review loop successfully remediated initial vulnerability.",
                    "Unit tests show 85% coverage.",
                ],
            },
            indent=2,
        )

    return "{}"
