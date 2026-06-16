"""
DevFlow AI — Band Bus Wrapper
===============================
Abstracts the Band multi-agent coordination bus behind a clean async API.

When ``MOCK_MODE=True`` (default for local dev), all events are written
to / read from a local JSON file (``.band_mock_bus.json``) instead of
hitting the live Band REST API.  This lets the entire pipeline run
offline without any external dependencies.

Public API
----------
- ``publish_event(event_type, sender, payload_data, room_id)``
- ``subscribe_events(callback_fn, max_iterations, poll_interval)``
"""

import asyncio
import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Optional
import uuid

from config.settings import settings

logger = logging.getLogger(__name__)

# ── Mock Bus file path ───────────────────────────────────────────────────────
MOCK_BUS_FILE = Path(".band_mock_bus.json")


# ══════════════════════════════════════════════════════════════════════════════
#  MOCK BAND BUS (local file-based event bus for MOCK_MODE)
# ══════════════════════════════════════════════════════════════════════════════

class MockBandBus:
    """File-backed event bus used when ``MOCK_MODE=True``.

    Events are stored as a JSON array in ``.band_mock_bus.json``.
    Reads and writes use a simple ``_lock`` to avoid partial-write
    corruption when the async pipeline is publishing from multiple agents.
    """

    _lock = asyncio.Lock()

    @classmethod
    async def publish(
        cls,
        event_type: str,
        sender: str,
        payload_data: dict,
        room_id: str,
    ) -> dict:
        """Append an event to the mock bus file.

        Returns the event dict that was written.
        """
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "sender": sender,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "room_id": room_id,
            "payload_data": payload_data,
        }

        async with cls._lock:
            events = cls._read_file()
            events.append(event)
            cls._write_file(events)

        logger.info(
            f"[MockBandBus] Published: {event_type} from {sender} "
            f"(total events in file: {len(events)})"
        )
        return event

    @classmethod
    async def read_events(cls) -> list[dict]:
        """Read all events currently in the mock bus file."""
        async with cls._lock:
            return cls._read_file()

    # ── Private file helpers ─────────────────────────────────────────────

    @staticmethod
    def _read_file() -> list[dict]:
        """Read the mock bus JSON file (non-async, called inside lock)."""
        if not MOCK_BUS_FILE.exists():
            return []
        try:
            with open(MOCK_BUS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data if isinstance(data, list) else []
        except (json.JSONDecodeError, OSError) as exc:
            logger.warning(f"[MockBandBus] Failed to read bus file: {exc}")
            return []

    @staticmethod
    def _write_file(events: list[dict]) -> None:
        """Write events list to the mock bus JSON file atomically."""
        tmp = str(MOCK_BUS_FILE) + ".tmp"
        try:
            with open(tmp, "w", encoding="utf-8") as f:
                json.dump(events, f, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp, str(MOCK_BUS_FILE))
        except OSError as exc:
            logger.error(f"[MockBandBus] Failed to write bus file: {exc}")


# ══════════════════════════════════════════════════════════════════════════════
#  LIVE BAND API HELPERS
# ══════════════════════════════════════════════════════════════════════════════

_cached_owner_id: Optional[str] = None


def _sync_publish_event(
    api_key: str,
    room_id: str,
    sender: str,
    event_type: str,
    payload_data: dict,
) -> None:
    """Publish an event to the Band REST API using the official Thenvoi SDK."""
    global _cached_owner_id

    try:
        from thenvoi_rest import RestClient
        from thenvoi_rest.types.chat_event_request import ChatEventRequest
        from thenvoi_rest.types.chat_message_request import ChatMessageRequest
    except ImportError as e:
        logger.error(f"[Band] Failed to import thenvoi_rest: {e}")
        return

    # Initialize SDK RestClient
    base_url = settings.BAND_BASE_URL
    if base_url == "https://api.band.bot/v1" or not base_url:
        client = RestClient(api_key=api_key)
    else:
        client = RestClient(api_key=api_key, base_url=base_url)

    # 1. Build and publish Chat Event
    content = f"[{sender}] Emitted event {event_type}"
    if "verdict" in payload_data:
        content += f" - Verdict: {payload_data['verdict']}"
    elif "file_target" in payload_data:
        content += f" - File: {payload_data['file_target']}"
    elif "test_file" in payload_data:
        content += f" - Test File: {payload_data['test_file']}"

    try:
        event_req = ChatEventRequest(
            content=content,
            message_type="task",
            metadata={
                "event_type": event_type,
                "sender": sender,
                "payload": payload_data,
            }
        )
        client.agent_api_events.create_agent_chat_event(
            chat_id=room_id,
            event=event_req
        )
        logger.info(f"Successfully published event {event_type} to Band for {sender}.")
    except Exception as e:
        logger.error(f"Failed to publish event to Band: {e}")

    # 2. Fetch room participants to find the owner for mentions
    owner_id = _cached_owner_id
    if not owner_id:
        try:
            participants_resp = client.agent_api_participants.list_agent_chat_participants(chat_id=room_id)
            for participant in participants_resp.data:
                if participant.type == "User" or participant.role == "owner":
                    owner_id = participant.id
                    _cached_owner_id = owner_id
                    break
        except Exception as e:
            logger.warning(f"Failed to fetch participants for owner ID: {e}")

    # 3. Post a human-readable chat message with owner mention
    if owner_id:
        msg_content = f"🤖 **{sender}** has emitted event: **{event_type}**"
        if "verdict" in payload_data:
            msg_content += f"\n*   **Verdict**: `{payload_data['verdict']}`"
        if "file_target" in payload_data:
            msg_content += f"\n*   **File**: `{payload_data['file_target']}`"
        if "test_file" in payload_data:
            msg_content += f"\n*   **Test Suite**: `{payload_data['test_file']}`"
            if "coverage_estimate" in payload_data:
                msg_content += f" (Coverage: {payload_data['coverage_estimate']})"
        if "title" in payload_data:
            msg_content += f"\n*   **Document**: `{payload_data['title']}`"
        if "architecture_pattern" in payload_data:
            msg_content += f"\n*   **Pattern**: `{payload_data['architecture_pattern']}`"

        try:
            msg_req = ChatMessageRequest(
                content=msg_content,
                mentions=[{"id": owner_id}]
            )
            client.agent_api_messages.create_agent_chat_message(
                chat_id=room_id,
                message=msg_req
            )
            logger.info(f"Successfully posted chat message for {event_type}.")
        except Exception as e:
            logger.error(f"Failed to post chat message to Band: {e}")


# ══════════════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ══════════════════════════════════════════════════════════════════════════════

async def publish_event(
    event_type: str,
    sender: str,
    payload_data: dict,
    room_id: str,
) -> None:
    """Publish an agent event to the Band communication room.

    In ``MOCK_MODE`` the event is written to the local file bus.
    Otherwise it is POSTed to the live Band REST API.
    """
    if settings.MOCK_MODE:
        await MockBandBus.publish(event_type, sender, payload_data, room_id)
        return

    api_key = settings.get_band_api_key(sender)
    if not api_key:
        logger.warning(
            f"[Band] No API key for {sender}. Falling back to MockBandBus."
        )
        await MockBandBus.publish(event_type, sender, payload_data, room_id)
        return

    logger.info(f"Publishing event {event_type} from {sender} to Band room {room_id}...")
    try:
        await asyncio.to_thread(
            _sync_publish_event, api_key, room_id, sender, event_type, payload_data
        )
    except Exception as e:
        logger.error(f"Error publishing event to Band: {e}")


async def subscribe_events(
    callback_fn: Callable,
    max_iterations: Optional[int] = None,
    poll_interval: float = 2.0,
) -> None:
    """Poll the event bus and invoke *callback_fn* for every new event.

    In ``MOCK_MODE``, reads from ``.band_mock_bus.json``.
    Keeps a set of already-processed event IDs so each event is delivered
    exactly once.

    Args:
        callback_fn: An async callable invoked with each new event dict.
        max_iterations: Stop after this many poll cycles (``None`` = forever).
        poll_interval: Seconds between polls (default 2).
    """
    processed_ids: set[str] = set()
    iterations = 0

    logger.info(
        f"[subscribe_events] Starting event polling "
        f"(mock={settings.MOCK_MODE}, interval={poll_interval}s, "
        f"max_iterations={max_iterations})"
    )

    while True:
        iterations += 1

        if settings.MOCK_MODE:
            events = await MockBandBus.read_events()
        else:
            # TODO: implement live Band polling via GET /events when API docs are available
            events = []

        new_events = [
            e for e in events if e.get("event_id") not in processed_ids
        ]

        for event in new_events:
            processed_ids.add(event["event_id"])
            try:
                await callback_fn(event)
            except Exception as exc:
                logger.error(
                    f"[subscribe_events] Callback error for event "
                    f"{event.get('event_id')}: {exc}"
                )

        if max_iterations is not None and iterations >= max_iterations:
            logger.info(
                f"[subscribe_events] Reached max_iterations={max_iterations}. Stopping."
            )
            break

        await asyncio.sleep(poll_interval)
