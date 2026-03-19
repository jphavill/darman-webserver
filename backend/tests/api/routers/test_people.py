def _insert_sprint(client, token: str, payload: dict):
    return client.post(
        "/v1/sprints",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )


def _delete_person(client, token: str, person_id: int):
    return client.delete(
        f"/v1/people/{person_id}",
        headers={"Authorization": f"Bearer {token}"},
    )


def test_get_people_returns_active_people_alphabetically(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert_sprint(
        client,
        "secret",
        {"name": "Zoe", "sprint_time_ms": 10200, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert_sprint(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 10300, "sprint_date": "2026-03-01", "location": "Track B"},
    )

    response = client.get("/v1/people")
    assert response.status_code == 200
    body = response.json()
    assert [row["name"] for row in body] == ["Alex", "Zoe"]


def test_get_people_prefix_filters_by_normalized_name(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert_sprint(
        client,
        "secret",
        {"name": "Jason", "sprint_time_ms": 10200, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert_sprint(
        client,
        "secret",
        {"name": "Jared", "sprint_time_ms": 10300, "sprint_date": "2026-03-01", "location": "Track B"},
    )
    _insert_sprint(
        client,
        "secret",
        {"name": "Blake", "sprint_time_ms": 10400, "sprint_date": "2026-03-01", "location": "Track C"},
    )

    response = client.get("/v1/people", params={"q": "ja"})
    assert response.status_code == 200
    body = response.json()
    assert [row["name"] for row in body] == ["Jared", "Jason"]


def test_get_people_excludes_inactive_people(client, db_session):
    from models import Person

    db_session.add(Person(name="Inactive User", normalized_name="inactive user", is_active=False))
    db_session.add(Person(name="Active User", normalized_name="active user", is_active=True))
    db_session.commit()

    response = client.get("/v1/people")
    assert response.status_code == 200
    assert [row["name"] for row in response.json()] == ["Active User"]


def test_delete_person_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert_sprint(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 10200, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    person_id = client.get("/v1/people", params={"q": "alex"}).json()[0]["id"]

    response = client.delete(f"/v1/people/{person_id}")
    assert response.status_code == 401


def test_delete_person_cascades_to_sprint_entries(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert_sprint(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 10200, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert_sprint(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 10100, "sprint_date": "2026-03-02", "location": "Track B"},
    )
    person_id = client.get("/v1/people", params={"q": "alex"}).json()[0]["id"]

    deleted = _delete_person(client, "secret", person_id)
    assert deleted.status_code == 204

    people_response = client.get("/v1/people")
    assert people_response.status_code == 200
    assert people_response.json() == []

    sprints_response = client.get("/v1/sprints")
    assert sprints_response.status_code == 200
    assert sprints_response.json()["total"] == 0
