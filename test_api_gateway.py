"""
DevFlow AI — API Gateway Test Suite
====================================
Verifies API gateway routing, authentication, and IDOR protection.
"""

import sys
import unittest
from pathlib import Path
from fastapi.testclient import TestClient

# Ensure clean imports from project root
sys.path.insert(0, str(Path(__file__).parent))

from api_gateway import app, get_current_user, AuthenticatedUser
from core.database import create_session, SessionLocal, UserSession

class TestApiGateway(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        # Reset dependency overrides
        app.dependency_overrides = {}

    def test_mock_auth_flow_and_history(self):
        """Verifies that the mock auth is bypassed and list sessions succeeds."""
        response = self.client.get("/api/sessions")
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

    def test_trigger_pipeline_run(self):
        """Verifies that starting a run returns a session_id and executes in background."""
        payload = {"feature_request": "Build a contact form component"}
        response = self.client.post("/api/sessions", json=payload)
        
        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["status"], "success")
        self.assertIn("session_id", data)
        self.assertIsNotNone(data["session_id"])

    def test_idor_security_protection(self):
        """Strict verification of Checklist Item 1 (IDOR protection).

        Asserts that User B is blocked (403 Forbidden) from viewing User A's session.
        """
        # 1. Create a session in DB belonging to User A ('user_alpha')
        user_alpha_id = "user_alpha_uuid"
        db = SessionLocal()
        try:
            session_id = create_session(user_alpha_id, "Feature spec for Alpha")
        finally:
            db.close()

        # 2. Configure dependency override to simulate User B ('user_beta') logging in
        def override_get_current_user():
            return AuthenticatedUser(
                user_id="user_beta_uuid",
                email="beta@devflow.ai"
            )
        
        app.dependency_overrides[get_current_user] = override_get_current_user

        # 3. Attempt to fetch User A's session details as User B
        response = self.client.get(f"/api/sessions/{session_id}")
        
        # Assert that access is forbidden
        self.assertEqual(response.status_code, 403)
        self.assertEqual(
            response.json()["detail"],
            "Access denied. You do not have permission to view this session."
        )
        print("\n[Security Test] IDOR protection verified! User B blocked from accessing User A's session.")

        # 4. Configure dependency override to simulate User A ('user_alpha') logging in
        def override_get_current_user_alpha():
            return AuthenticatedUser(
                user_id=user_alpha_id,
                email="alpha@devflow.ai"
            )
        
        app.dependency_overrides[get_current_user] = override_get_current_user_alpha

        # 5. Attempt to fetch User A's session details as User A (should succeed)
        success_response = self.client.get(f"/api/sessions/{session_id}")
        self.assertEqual(success_response.status_code, 200)
        self.assertEqual(success_response.json()["session_id"], session_id)
        print("[Security Test] Authorization verified! User A successfully accessed their own session.")

if __name__ == "__main__":
    unittest.main()
