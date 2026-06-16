"""
AgentVerse AI — Base Agent
========================
Abstract base class that every pipeline agent inherits from.
Provides the ``emit()`` helper (Band event publishing) and ``call_json()``
(LLM call + JSON parse) so agents can focus purely on their domain logic.
"""

import abc
import json
import logging

from core.band_wrapper import publish_event
from core.llm_router import call_llm
from config.settings import settings

logger = logging.getLogger(__name__)


class BaseAgent(abc.ABC):
    """Base class for all AgentVerse AI agents."""

    @property
    @abc.abstractmethod
    def name(self) -> str:
        """The identifier name of the agent."""
        pass

    @property
    @abc.abstractmethod
    def system_prompt(self) -> str:
        """The system prompt defining the agent's persona and rules."""
        pass

    @abc.abstractmethod
    async def run(self, input_data: dict) -> dict:
        """Execute the agent logic.

        Args:
            input_data: A dictionary containing the inputs for this stage.

        Returns:
            A dictionary containing the generated artifacts and metadata.
        """
        pass

    # ── Shared helpers available to every agent ──────────────────────────

    async def emit(self, event_type: str, payload: dict) -> None:
        """Publish an event to the Band communication layer.

        This wraps ``band_wrapper.publish_event`` so individual agents
        never need to know about the transport details.

        Args:
            event_type: A pipeline event tag (e.g. ``SPEC_GENERATED``).
            payload: The event payload dict.
        """
        logger.info(f"[{self.name}] Emitting {event_type}")
        room_id = getattr(self, "room_id", None) or settings.BAND_ROOM_ID
        await publish_event(
            event_type=event_type,
            sender=self.name,
            payload_data=payload,
            room_id=room_id,
        )

    async def call_json(self, user_prompt: str) -> dict:
        """Call the LLM and parse the response as JSON.

        Falls back to wrapping the raw text if JSON parsing fails.

        Args:
            user_prompt: The user-facing prompt to send to the LLM.

        Returns:
            Parsed JSON dict from the LLM response.
        """
        raw = await call_llm(
            agent_name=self.name,
            system_prompt=self.system_prompt,
            user_prompt=user_prompt,
        )

        # Try to extract JSON (handles markdown code-block wrapping)
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1]) if len(lines) > 2 else cleaned

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            logger.warning(
                f"[{self.name}] Failed to parse LLM response as JSON: {exc}"
            )
            return {"_raw_response": raw, "_parse_error": str(exc)}
