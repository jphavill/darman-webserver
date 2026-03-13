def test_system_router_root(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["message"] == "API is running"


def test_system_router_health(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
