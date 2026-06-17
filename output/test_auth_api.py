import pytest
from fastapi.testclient import TestClient
from routes import app

client = TestClient(app)

def test_auth_mutation_success():
    response = client.post("/api/auth", json={"name": "test_run", "value": "verified"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"
