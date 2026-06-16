"""
DevFlow AI — Database CRUD Test Suite
======================================
Verifies database operations, schemas, and queries.
"""

import sys
import unittest
import uuid
from pathlib import Path

# Ensure clean imports from project root
sys.path.insert(0, str(Path(__file__).parent))

from core.database import (
    create_session,
    update_session,
    save_agent_state,
    save_artifact,
    save_event,
    get_session_state,
    get_user_sessions,
)

class TestDatabaseOperations(unittest.TestCase):

    def test_end_to_end_db_workflow(self):
        user_id = f"test_user_{uuid.uuid4()}"
        prompt = "Create a login form"

        # 1. Test session creation
        session_id = create_session(user_id, prompt)
        self.assertIsNotNone(session_id)
        self.assertEqual(len(session_id), 36) # UUID string format

        # 2. Test initial session state loading
        state = get_session_state(session_id)
        self.assertEqual(state["session_id"], session_id)
        self.assertEqual(state["status"], "RUNNING")
        self.assertEqual(state["review_cycle"], 0)
        self.assertEqual(state["agents"]["ArchitectAgent"], "IDLE")
        self.assertEqual(state["agents"]["FrontendDevAgent"], "IDLE")

        # 3. Test updating session status and review cycle
        update_session(session_id, "COMPLETE", 2)
        
        # 4. Test updating agent status cards
        save_agent_state(session_id, "ArchitectAgent", "COMPLETE")
        save_agent_state(session_id, "FrontendDevAgent", "PROCESSING")

        # 5. Test saving artifacts
        mock_fe_code = {
            "file_target": "LoginForm.jsx",
            "language": "react",
            "source_code": "export default function LoginForm() {}",
            "iteration_count": 1
        }
        save_artifact(session_id, "frontend_code", mock_fe_code)

        # 6. Test logging events
        mock_event = {
            "event_id": str(uuid.uuid4()),
            "event_type": "CODE_EMITTED",
            "sender": "FrontendDevAgent",
            "timestamp": "2026-06-16T12:00:00Z",
            "payload_data": {"file_target": "LoginForm.jsx"}
        }
        save_event(session_id, mock_event)

        # 7. Load updated state and verify assertions
        updated_state = get_session_state(session_id)
        self.assertEqual(updated_state["status"], "COMPLETE")
        self.assertEqual(updated_state["review_cycle"], 2)
        self.assertEqual(updated_state["agents"]["ArchitectAgent"], "COMPLETE")
        self.assertEqual(updated_state["agents"]["FrontendDevAgent"], "PROCESSING")
        
        # Verify artifact payload
        self.assertEqual(updated_state["artifacts"]["frontend_code"]["file_target"], "LoginForm.jsx")
        self.assertEqual(updated_state["artifacts"]["frontend_code"]["iteration_count"], 1)

        # Verify event log entry
        self.assertEqual(len(updated_state["events"]), 1)
        self.assertEqual(updated_state["events"][0]["sender"], "FrontendDevAgent")
        self.assertEqual(updated_state["events"][0]["event_type"], "CODE_EMITTED")

        # 8. Verify user session query list
        sessions = get_user_sessions(user_id)
        self.assertEqual(len(sessions), 1)
        self.assertEqual(sessions[0]["session_id"], session_id)
        self.assertEqual(sessions[0]["prompt"], prompt)
        self.assertEqual(sessions[0]["status"], "COMPLETE")
        print("\n[Database Test] All operations verified successfully!")

if __name__ == "__main__":
    unittest.main()
