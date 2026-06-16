def test_register_key_success(client):
    response = client.post("/api/keys", json={"key": "test_key"})
    assert response.status_code == 200
    assert response.json()["status"] == "success"

def test_register_key_empty(client):
    response = client.post("/api/keys", json={"key": ""})
    assert response.status_code == 400
