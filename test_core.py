"""
DevFlow AI — Core Smoke Test
==============================
Run with:  python test_core.py
Requires:  MOCK_MODE=True in your .env (default).
"""

import asyncio
import sys
from pathlib import Path

# Ensure clean imports from project root
sys.path.insert(0, str(Path(__file__).parent))

from config.settings import get_settings
from core.band_wrapper import publish_event, subscribe_events
from core.llm_router import call_llm
from core.base_agent import BaseAgent


class DummyAgent(BaseAgent):
    """Minimal agent used to verify the base class contract."""

    name = "ArchitectAgent"
    system_prompt = "You are a dummy test agent."

    async def run(self, input_data: dict) -> dict:
        return await self.call_json(input_data.get("prompt", ""))


async def main():
    settings = get_settings()
    print(f"MOCK_MODE: {settings.MOCK_MODE}")
    print(f"AIML_BASE_URL: {settings.AIML_BASE_URL}")
    print(f"FEATHERLESS_BASE_URL: {settings.FEATHERLESS_BASE_URL}")
    print(f"BAND_ROOM_ID: {settings.BAND_ROOM_ID}")

    # ── 1. Test call_json via DummyAgent ─────────────────────────────────
    agent = DummyAgent()
    output = await agent.run({"prompt": "Hello"})
    print("\n[LLM Output]")
    print(output)

    # ── 2. Test emit (publishes to MockBandBus) ──────────────────────────
    print("\n[Publishing Event via emit()]")
    await agent.emit("SPEC_GENERATED", output)
    print("Event published successfully!")

    # ── 3. Test subscribe_events (reads from MockBandBus, 1 iteration) ──
    print("\n[Subscribing to Events (max 1 iteration)]")

    async def callback(evt):
        print(f"  Received Event: {evt.get('event_type')} from {evt.get('sender')}")

    await subscribe_events(max_iterations=1, callback_fn=callback)

    print("\n[OK] All smoke tests passed!")


if __name__ == "__main__":
    asyncio.run(main())
