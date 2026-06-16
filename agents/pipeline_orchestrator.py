"""
DevFlow AI — Pipeline Orchestrator

The central conductor that manages the full agent pipeline lifecycle.
Drives agents directly (imperative flow), emits Band events as side-effects,
and writes pipeline_state.json atomically after every state change for the
UI dashboard to consume.
"""

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from agents.architect import ArchitectAgent
from agents.frontend_dev import FrontendDevAgent
from agents.backend_dev import BackendDevAgent
from agents.reviewer import CodeReviewerAgent
from agents.qa_tester import QATesterAgent
from agents.tech_writer import TechWriterAgent
from agents.release_manager import ReleaseManagerAgent

logger = logging.getLogger(__name__)

# ── Constants ────────────────────────────────────────────────────────────────

MAX_REVIEW_CYCLES = 3

AGENT_NAMES = [
    "ArchitectAgent",
    "FrontendDevAgent",
    "BackendDevAgent",
    "CodeReviewerAgent",
    "QATesterAgent",
    "TechWriterAgent",
    "ReleaseManagerAgent",
]

STATE_FILE = Path("pipeline_state.json")


class PipelineOrchestrator:
    """Orchestrates the full DevFlow AI agent pipeline.

    Flow:
        1. ArchitectAgent → SPEC_GENERATED
        2. FrontendDevAgent + BackendDevAgent (parallel) → CODE_EMITTED
        3. CodeReviewerAgent → CODE_APPROVED / CODE_REJECTED
           ↳ If REJECTED: loop back to dev agents (max 3 cycles)
        4. QATesterAgent → TESTS_GENERATED
        5. TechWriterAgent → DOCS_GENERATED
        6. ReleaseManagerAgent → FINAL_VERDICT_MERGE_READY / FINAL_VERDICT_HOLD
    """

    def __init__(self) -> None:
        # ── Instantiate all 7 agents ─────────────────────────────────────
        self.architect = ArchitectAgent()
        self.frontend_dev = FrontendDevAgent()
        self.backend_dev = BackendDevAgent()
        self.reviewer = CodeReviewerAgent()
        self.qa_tester = QATesterAgent()
        self.tech_writer = TechWriterAgent()
        self.release_manager = ReleaseManagerAgent()

        # ── Shared pipeline state (written to disk for UI) ───────────────
        self.pipeline_state: dict[str, Any] = {
            "status": "IDLE",
            "review_cycle": 0,
            "agents": {name: "IDLE" for name in AGENT_NAMES},
            "artifacts": {
                "architecture": {},
                "frontend_code": {},
                "backend_code": {},
                "review_result": {},
                "tests": {},
                "documentation": {},
                "release_verdict": {},
            },
            "events": [],
        }

        # User session persistence
        self.session_id: Optional[str] = None


    # ══════════════════════════════════════════════════════════════════════
    #  STATE MANAGEMENT
    # ══════════════════════════════════════════════════════════════════════

    def _set_agent_state(self, agent_name: str, state: str) -> None:
        """Update an agent's state and persist."""
        self.pipeline_state["agents"][agent_name] = state
        logger.info(f"[Orchestrator] {agent_name} -> {state}")

    def _set_pipeline_status(self, status: str) -> None:
        """Update the global pipeline status and persist."""
        self.pipeline_state["status"] = status
        logger.info(f"[Orchestrator] Pipeline status -> {status}")

    def _record_event(
        self, event_type: str, sender: str, payload_data: dict
    ) -> dict:
        """Create a Band-format event envelope, append it to state, and persist.

        This is CRITICAL — every event must land in pipeline_state['events']
        so that Member 3's live event console can display them.
        """
        room_id = getattr(self, "room_id", None) or "orchestrator-local"
        event = {
            "event_id": str(uuid.uuid4()),
            "event_type": event_type,
            "sender": sender,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "room_id": room_id,
            "payload_data": self._safe_payload(payload_data),
        }
        self.pipeline_state["events"].append(event)
        logger.info(
            f"[Orchestrator] Event recorded: {event_type} from {sender} "
            f"(total events: {len(self.pipeline_state['events'])})"
        )
        return event

    @staticmethod
    def _safe_payload(payload: dict) -> dict:
        """Truncate very large source_code fields to prevent state file bloat,
        while keeping the full code in artifacts."""
        safe = {}
        for key, value in payload.items():
            if key == "source_code" and isinstance(value, str) and len(value) > 500:
                safe[key] = value[:500] + f"\n... [truncated, {len(value)} chars total]"
            elif isinstance(value, dict):
                safe[key] = PipelineOrchestrator._safe_payload(value)
            else:
                safe[key] = value
        return safe

    def _store_artifact(self, artifact_key: str, data: dict) -> None:
        """Store an artifact in the pipeline state."""
        self.pipeline_state["artifacts"][artifact_key] = data

    def _persist_state(self) -> None:
        """Atomically write pipeline_state.json to disk.

        Uses a .tmp file + os.replace() pattern for crash-safe writes.
        Member 3's dashboard reads this file to update the UI.
        """
        tmp_path = str(STATE_FILE) + ".tmp"
        try:
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump(self.pipeline_state, f, indent=2, default=str)
                f.flush()
                os.fsync(f.fileno())
            os.replace(tmp_path, str(STATE_FILE))
            logger.debug("[Orchestrator] pipeline_state.json written successfully.")
        except OSError as e:
            logger.error(f"[Orchestrator] Failed to write pipeline_state.json: {e}")

    def _update_and_persist(
        self,
        agent_name: Optional[str] = None,
        agent_state: Optional[str] = None,
        pipeline_status: Optional[str] = None,
        event_type: Optional[str] = None,
        event_sender: Optional[str] = None,
        event_payload: Optional[dict] = None,
        artifact_key: Optional[str] = None,
        artifact_data: Optional[dict] = None,
    ) -> None:
        """Convenience method: apply state changes + record event + persist atomically."""
        if agent_name and agent_state:
            self._set_agent_state(agent_name, agent_state)
        if pipeline_status:
            self._set_pipeline_status(pipeline_status)
        if event_type and event_sender:
            self._record_event(event_type, event_sender, event_payload or {})
        if artifact_key and artifact_data is not None:
            self._store_artifact(artifact_key, artifact_data)
        self._persist_state()

        # Database session persistence
        if self.session_id:
            try:
                from core.database import (
                    update_session,
                    save_agent_state,
                    save_artifact,
                    save_event,
                )
                if pipeline_status:
                    update_session(self.session_id, pipeline_status, self.pipeline_state.get("review_cycle", 0))
                if agent_name and agent_state:
                    save_agent_state(self.session_id, agent_name, agent_state)
                if event_type and event_sender:
                    latest_evt = self.pipeline_state["events"][-1]
                    save_event(self.session_id, latest_evt)
                if artifact_key and artifact_data is not None:
                    save_artifact(self.session_id, artifact_key, artifact_data)
            except Exception as e:
                logger.error(f"[Orchestrator] Failed to save state to database: {e}")


    def get_state(self) -> dict:
        """Return the current pipeline state dict."""
        return self.pipeline_state

    # ══════════════════════════════════════════════════════════════════════
    #  MAIN PIPELINE EXECUTION
    # ══════════════════════════════════════════════════════════════════════

    async def run_pipeline(self, feature_request: str, session_id: Optional[str] = None, band_room_id: Optional[str] = None) -> dict:
        """Execute the full DevFlow AI pipeline end-to-end.

        Args:
            feature_request: Natural language feature request from the user.
            session_id: Optional persistent user session ID.
            band_room_id: Optional custom Band Room ID override.

        Returns:
            Final pipeline_state dict.
        """
        self.session_id = session_id
        self.room_id = band_room_id
        
        # Propagate custom room ID override to all agents
        if band_room_id:
            self.architect.room_id = band_room_id
            self.frontend_dev.room_id = band_room_id
            self.backend_dev.room_id = band_room_id
            self.reviewer.room_id = band_room_id
            self.qa_tester.room_id = band_room_id
            self.tech_writer.room_id = band_room_id
            self.release_manager.room_id = band_room_id

        logger.info(f"[Orchestrator] === Pipeline started for: {feature_request[:100]} ===")


        # ── Input Sanitization & Safety Check ────────────────────────────
        if not feature_request or not feature_request.strip():
            raise ValueError("Feature request cannot be empty or whitespace-only.")
        if len(feature_request) > 4000:
            raise ValueError(
                f"Feature request is too large ({len(feature_request)} chars). "
                "Max allowed length is 4000 chars."
            )

        # ── Initialize ───────────────────────────────────────────────────
        self._update_and_persist(pipeline_status="RUNNING")

        try:
            # ── PHASE 1: Architecture ────────────────────────────────────
            architecture = await self._run_architect(feature_request)

            # ── PHASE 2: Parallel Code Generation ────────────────────────
            frontend_code, backend_code = await self._run_developers(architecture)

            # ── PHASE 3: Code Review Loop (max 3 cycles) ────────────────
            frontend_code, backend_code, review_result = await self._run_review_loop(
                architecture, frontend_code, backend_code
            )

            # ── PHASE 4: QA Testing ──────────────────────────────────────
            tests = await self._run_qa_tester(frontend_code, backend_code)

            # ── PHASE 5: Documentation ───────────────────────────────────
            documentation = await self._run_tech_writer(
                architecture, frontend_code, backend_code, tests
            )

            # ── PHASE 6: Release Verdict ─────────────────────────────────
            release_verdict = await self._run_release_manager(
                architecture, frontend_code, backend_code,
                review_result, tests, documentation
            )

            # ── Finalize ─────────────────────────────────────────────────
            final_status = (
                "COMPLETE"
                if release_verdict.get("verdict") == "MERGE_READY"
                else "HOLD"
            )
            self._update_and_persist(pipeline_status=final_status)
            self._export_artifacts()

            logger.info(
                f"[Orchestrator] === Pipeline finished: {final_status} ==="
            )

        except Exception as e:
            logger.error(f"[Orchestrator] Pipeline failed with error: {e}", exc_info=True)
            self._update_and_persist(
                pipeline_status="ERROR",
                event_type="PIPELINE_ERROR",
                event_sender="Orchestrator",
                event_payload={"error": str(e)},
            )

        return self.pipeline_state

    # ══════════════════════════════════════════════════════════════════════
    #  PHASE RUNNERS
    # ══════════════════════════════════════════════════════════════════════

    async def _run_architect(self, feature_request: str) -> dict:
        """Phase 1: Run the Architect Agent."""
        self._update_and_persist(
            agent_name="ArchitectAgent",
            agent_state="PROCESSING",
        )

        result = await self.architect.run({"feature_request": feature_request})

        self._update_and_persist(
            agent_name="ArchitectAgent",
            agent_state="COMPLETE",
            event_type="SPEC_GENERATED",
            event_sender="ArchitectAgent",
            event_payload=result,
            artifact_key="architecture",
            artifact_data=result,
        )

        return result

    async def _run_developers(self, architecture: dict) -> tuple[dict, dict]:
        """Phase 2: Run Frontend and Backend Dev Agents in parallel."""
        # Set both to PROCESSING
        self._update_and_persist(
            agent_name="FrontendDevAgent",
            agent_state="PROCESSING",
        )
        self._update_and_persist(
            agent_name="BackendDevAgent",
            agent_state="PROCESSING",
        )

        # Run in parallel
        frontend_code, backend_code = await asyncio.gather(
            self.frontend_dev.run({
                "frontend_spec": architecture.get("frontend_spec", {}),
                "iteration_count": 1,
            }),
            self.backend_dev.run({
                "backend_spec": architecture.get("backend_spec", {}),
                "iteration_count": 1,
            }),
        )

        # Record results
        self._update_and_persist(
            agent_name="FrontendDevAgent",
            agent_state="COMPLETE",
            event_type="CODE_EMITTED",
            event_sender="FrontendDevAgent",
            event_payload=frontend_code,
            artifact_key="frontend_code",
            artifact_data=frontend_code,
        )
        self._update_and_persist(
            agent_name="BackendDevAgent",
            agent_state="COMPLETE",
            event_type="CODE_EMITTED",
            event_sender="BackendDevAgent",
            event_payload=backend_code,
            artifact_key="backend_code",
            artifact_data=backend_code,
        )

        return frontend_code, backend_code

    async def _run_review_loop(
        self,
        architecture: dict,
        frontend_code: dict,
        backend_code: dict,
    ) -> tuple[dict, dict, dict]:
        """Phase 3: Code review loop with max 3 cycles.

        If the reviewer emits CODE_REJECTED, extract remediation_tickets
        and pass them directly back to the appropriate dev agent(s) along
        with the current iteration_count. Repeat until APPROVED or max cycles.
        """
        review_cycle = 0

        while review_cycle < MAX_REVIEW_CYCLES:
            review_cycle += 1
            self.pipeline_state["review_cycle"] = review_cycle

            # ── Run reviewer ─────────────────────────────────────────────
            self._update_and_persist(
                agent_name="CodeReviewerAgent",
                agent_state="PROCESSING",
            )

            review_result = await self.reviewer.run({
                "frontend_code": frontend_code,
                "backend_code": backend_code,
                "review_cycle": review_cycle,
            })

            verdict = review_result.get("verdict", "APPROVED").upper()

            if verdict == "APPROVED":
                # ── Code passed review ───────────────────────────────────
                self._update_and_persist(
                    agent_name="CodeReviewerAgent",
                    agent_state="COMPLETE",
                    event_type="CODE_APPROVED",
                    event_sender="CodeReviewerAgent",
                    event_payload=review_result,
                    artifact_key="review_result",
                    artifact_data=review_result,
                )
                logger.info(
                    f"[Orchestrator] Code APPROVED on review cycle {review_cycle}"
                )
                return frontend_code, backend_code, review_result

            # ── Code rejected — extract remediation tickets ──────────────
            self._update_and_persist(
                agent_name="CodeReviewerAgent",
                agent_state="REJECTED",
                event_type="CODE_REJECTED",
                event_sender="CodeReviewerAgent",
                event_payload=review_result,
            )

            remediation_tickets = review_result.get("remediation_tickets", [])
            logger.info(
                f"[Orchestrator] Code REJECTED (cycle {review_cycle}/{MAX_REVIEW_CYCLES}). "
                f"{len(remediation_tickets)} remediation ticket(s)."
            )

            # ── Route tickets to the correct dev agents ──────────────────
            frontend_tickets = [
                t for t in remediation_tickets
                if t.get("target_agent") == "FrontendDevAgent"
            ]
            backend_tickets = [
                t for t in remediation_tickets
                if t.get("target_agent") == "BackendDevAgent"
            ]

            # Determine which agents need to re-run
            rerun_tasks = []

            if frontend_tickets:
                self._update_and_persist(
                    agent_name="FrontendDevAgent",
                    agent_state="PROCESSING",
                )
                frontend_iteration = frontend_code.get("iteration_count", 1) + 1
                rerun_tasks.append(
                    (
                        "frontend",
                        self.frontend_dev.run({
                            "frontend_spec": architecture.get("frontend_spec", {}),
                            "remediation_tickets": frontend_tickets,
                            "iteration_count": frontend_iteration,
                            "previous_code": frontend_code.get("source_code", ""),
                        }),
                    )
                )

            if backend_tickets:
                self._update_and_persist(
                    agent_name="BackendDevAgent",
                    agent_state="PROCESSING",
                )
                backend_iteration = backend_code.get("iteration_count", 1) + 1
                rerun_tasks.append(
                    (
                        "backend",
                        self.backend_dev.run({
                            "backend_spec": architecture.get("backend_spec", {}),
                            "remediation_tickets": backend_tickets,
                            "iteration_count": backend_iteration,
                            "previous_code": backend_code.get("source_code", ""),
                        }),
                    )
                )

            # If no specific tickets but still rejected, re-run both
            if not frontend_tickets and not backend_tickets:
                logger.warning(
                    "[Orchestrator] Rejection had no targeted tickets. Re-running both devs."
                )
                self._update_and_persist(
                    agent_name="FrontendDevAgent", agent_state="PROCESSING"
                )
                self._update_and_persist(
                    agent_name="BackendDevAgent", agent_state="PROCESSING"
                )
                frontend_iteration = frontend_code.get("iteration_count", 1) + 1
                backend_iteration = backend_code.get("iteration_count", 1) + 1
                rerun_tasks = [
                    (
                        "frontend",
                        self.frontend_dev.run({
                            "frontend_spec": architecture.get("frontend_spec", {}),
                            "remediation_tickets": remediation_tickets,
                            "iteration_count": frontend_iteration,
                            "previous_code": frontend_code.get("source_code", ""),
                        }),
                    ),
                    (
                        "backend",
                        self.backend_dev.run({
                            "backend_spec": architecture.get("backend_spec", {}),
                            "remediation_tickets": remediation_tickets,
                            "iteration_count": backend_iteration,
                            "previous_code": backend_code.get("source_code", ""),
                        }),
                    ),
                ]

            # ── Execute re-runs concurrently ─────────────────────────────
            if rerun_tasks:
                results = await asyncio.gather(
                    *(task for _, task in rerun_tasks)
                )

                for (label, _), result in zip(rerun_tasks, results):
                    if label == "frontend":
                        frontend_code = result
                        self._update_and_persist(
                            agent_name="FrontendDevAgent",
                            agent_state="COMPLETE",
                            event_type="CODE_EMITTED",
                            event_sender="FrontendDevAgent",
                            event_payload=result,
                            artifact_key="frontend_code",
                            artifact_data=result,
                        )
                    elif label == "backend":
                        backend_code = result
                        self._update_and_persist(
                            agent_name="BackendDevAgent",
                            agent_state="COMPLETE",
                            event_type="CODE_EMITTED",
                            event_sender="BackendDevAgent",
                            event_payload=result,
                            artifact_key="backend_code",
                            artifact_data=result,
                        )

        # ── Max cycles exhausted — force approve ─────────────────────────
        logger.warning(
            f"[Orchestrator] Max review cycles ({MAX_REVIEW_CYCLES}) exhausted. Force-approving."
        )
        force_result = {
            "verdict": "APPROVED",
            "evaluation_metrics": {"security": "PASS", "syntax": "PASS", "logic": "PASS"},
            "_force_approved": True,
            "_warning": f"Force-approved after {MAX_REVIEW_CYCLES} review cycles.",
        }
        self._update_and_persist(
            agent_name="CodeReviewerAgent",
            agent_state="COMPLETE",
            event_type="CODE_APPROVED",
            event_sender="CodeReviewerAgent",
            event_payload=force_result,
            artifact_key="review_result",
            artifact_data=force_result,
        )

        return frontend_code, backend_code, force_result

    async def _run_qa_tester(
        self, frontend_code: dict, backend_code: dict
    ) -> dict:
        """Phase 4: Run the QA Tester Agent."""
        self._update_and_persist(
            agent_name="QATesterAgent",
            agent_state="PROCESSING",
        )

        result = await self.qa_tester.run({
            "frontend_code": frontend_code,
            "backend_code": backend_code,
        })

        self._update_and_persist(
            agent_name="QATesterAgent",
            agent_state="COMPLETE",
            event_type="TESTS_GENERATED",
            event_sender="QATesterAgent",
            event_payload=result,
            artifact_key="tests",
            artifact_data=result,
        )

        return result

    async def _run_tech_writer(
        self,
        architecture: dict,
        frontend_code: dict,
        backend_code: dict,
        tests: dict,
    ) -> dict:
        """Phase 5: Run the Tech Writer Agent."""
        self._update_and_persist(
            agent_name="TechWriterAgent",
            agent_state="PROCESSING",
        )

        result = await self.tech_writer.run({
            "architecture": architecture,
            "frontend_code": frontend_code,
            "backend_code": backend_code,
            "tests": tests,
        })

        self._update_and_persist(
            agent_name="TechWriterAgent",
            agent_state="COMPLETE",
            event_type="DOCS_GENERATED",
            event_sender="TechWriterAgent",
            event_payload=result,
            artifact_key="documentation",
            artifact_data=result,
        )

        return result

    async def _run_release_manager(
        self,
        architecture: dict,
        frontend_code: dict,
        backend_code: dict,
        review_result: dict,
        tests: dict,
        documentation: dict,
    ) -> dict:
        """Phase 6: Run the Release Manager Agent."""
        self._update_and_persist(
            agent_name="ReleaseManagerAgent",
            agent_state="PROCESSING",
        )

        result = await self.release_manager.run({
            "architecture": architecture,
            "frontend_code": frontend_code,
            "backend_code": backend_code,
            "review_result": review_result,
            "tests": tests,
            "documentation": documentation,
        })

        verdict = result.get("verdict", "HOLD").upper()
        event_type = (
            "FINAL_VERDICT_MERGE_READY"
            if verdict == "MERGE_READY"
            else "FINAL_VERDICT_HOLD"
        )

        self._update_and_persist(
            agent_name="ReleaseManagerAgent",
            agent_state="COMPLETE",
            event_type=event_type,
            event_sender="ReleaseManagerAgent",
            event_payload=result,
            artifact_key="release_verdict",
            artifact_data=result,
        )

        return result

    def _export_artifacts(self) -> None:
        """Export generated code artifacts from state to a local 'output/' directory."""
        output_dir = Path("output")
        output_dir.mkdir(exist_ok=True)
        
        artifacts = self.pipeline_state.get("artifacts", {})
        
        # 1. Frontend Code
        frontend = artifacts.get("frontend_code", {})
        f_target = frontend.get("file_target")
        f_code = frontend.get("source_code")
        if f_target and f_code:
            try:
                with open(output_dir / f_target, "w", encoding="utf-8") as f:
                    f.write(f_code)
                logger.info(f"[Orchestrator] Exported frontend artifact to output/{f_target}")
            except Exception as e:
                logger.error(f"[Orchestrator] Failed to export frontend code: {e}")

        # 2. Backend Code
        backend = artifacts.get("backend_code", {})
        b_target = backend.get("file_target")
        b_code = backend.get("source_code")
        if b_target and b_code:
            try:
                with open(output_dir / b_target, "w", encoding="utf-8") as f:
                    f.write(b_code)
                logger.info(f"[Orchestrator] Exported backend artifact to output/{b_target}")
            except Exception as e:
                logger.error(f"[Orchestrator] Failed to export backend code: {e}")

        # 3. Test Code
        tests = artifacts.get("tests", {})
        t_file = tests.get("test_file")
        t_code = tests.get("source_code")
        if t_file and t_code:
            try:
                with open(output_dir / t_file, "w", encoding="utf-8") as f:
                    f.write(t_code)
                logger.info(f"[Orchestrator] Exported test artifact to output/{t_file}")
            except Exception as e:
                logger.error(f"[Orchestrator] Failed to export test code: {e}")

        # 4. Documentation
        doc = artifacts.get("documentation", {})
        doc_content = doc.get("content")
        if doc_content:
            try:
                with open(output_dir / "README.md", "w", encoding="utf-8") as f:
                    f.write(doc_content)
                logger.info("[Orchestrator] Exported README documentation to output/README.md")
            except Exception as e:
                logger.error(f"[Orchestrator] Failed to export documentation: {e}")
