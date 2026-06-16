"""
AgentVerse AI — End-to-End Pipeline Database Integration Test
============================================================
Runs the orchestrator in MOCK_MODE, passing a session ID,
and asserts that all agent actions, state transitions, artifacts,
and events are successfully logged to the database.
"""

import asyncio
import sys
from pathlib import Path

# Ensure clean imports from project root
sys.path.insert(0, str(Path(__file__).parent))

from agents.pipeline_orchestrator import PipelineOrchestrator
from core.database import create_session, get_session_state

async def main():
    print("=" * 60)
    print("Starting Pipeline Database Integration Test")
    print("=" * 60)

    user_id = "hackathon_test_developer"
    prompt = "Create a database dashboard showing logins"
    
    # 1. Create session in DB
    print("[Test] Initializing session in database...")
    session_id = create_session(user_id, prompt)
    print(f"[Test] Session created: {session_id}")

    # 2. Run orchestrator
    print("\n[Test] Kicking off orchestrator...")
    orchestrator = PipelineOrchestrator()
    final_state = await orchestrator.run_pipeline(prompt, session_id=session_id)
    print("[Test] Orchestrator run completed.")

    # 3. Retrieve state from database and compare
    print("\n[Test] Querying final session state from the database...")
    db_state = get_session_state(session_id)

    # 4. Assertions
    print("\n[Test] Running validations...")
    assert db_state.get("session_id") == session_id, "Session ID mismatch!"
    assert db_state.get("status") == "COMPLETE", f"Expected COMPLETE, got {db_state.get('status')}"
    
    # Check agents
    for agent, status in db_state.get("agents", {}).items():
        assert status == "COMPLETE", f"Agent {agent} status is {status}, expected COMPLETE"
        
    # Check artifacts exist
    assert "architecture" in db_state["artifacts"] and db_state["artifacts"]["architecture"], "Architecture missing!"
    assert "frontend_code" in db_state["artifacts"] and db_state["artifacts"]["frontend_code"], "Frontend code missing!"
    assert "backend_code" in db_state["artifacts"] and db_state["artifacts"]["backend_code"], "Backend code missing!"
    assert "tests" in db_state["artifacts"] and db_state["artifacts"]["tests"], "Tests missing!"
    assert "documentation" in db_state["artifacts"] and db_state["artifacts"]["documentation"], "Documentation missing!"
    assert "release_verdict" in db_state["artifacts"] and db_state["artifacts"]["release_verdict"], "Release verdict missing!"

    # Check events were appended
    events = db_state.get("events", [])
    print(f"[Test] Total events stored in DB for this run: {len(events)}")
    assert len(events) > 0, "No events recorded in database!"

    print("\n" + "=" * 60)
    print("[OK] DATABASE INTEGRATION TEST PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
