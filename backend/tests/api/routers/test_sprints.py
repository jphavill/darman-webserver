def _insert(client, token: str, payload: dict):
    return client.post(
        "/v1/sprints",
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
    )


def test_post_sprint_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = client.post(
        "/v1/sprints",
        json={
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    assert response.status_code == 401


def test_post_sprint_creates_entry_with_new_name(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Alex"
    assert body["sprint_time_ms"] == 10500


def test_post_sprint_supports_person_id(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    created = _insert(
        client,
        "secret",
        {
            "name": "Jamie",
            "sprint_time_ms": 10300,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    person_name = created.json()["name"]

    people_response = client.get("/v1/people", params={"q": "jam"})
    person_id = people_response.json()[0]["id"]

    second = _insert(
        client,
        "secret",
        {
            "person_id": person_id,
            "name": "ignored",
            "sprint_time_ms": 10100,
            "sprint_date": "2026-03-02",
            "location": "Track B",
        },
    )
    assert second.status_code == 200
    assert second.json()["name"] == person_name


def test_post_sprint_reuses_existing_name_with_case_whitespace_variation(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    first = _insert(
        client,
        "secret",
        {
            "name": "  JaSon   Doe ",
            "sprint_time_ms": 10800,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    assert first.status_code == 200

    second = _insert(
        client,
        "secret",
        {
            "name": "jason doe",
            "sprint_time_ms": 10100,
            "sprint_date": "2026-03-02",
            "location": "Track A",
        },
    )
    assert second.status_code == 200
    assert second.json()["name"] == "JaSon Doe"

    people = client.get("/v1/people", params={"q": "jason"})
    assert people.status_code == 200
    assert len(people.json()) == 1


def test_post_sprint_rejects_invalid_or_blank_names(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    blank = _insert(
        client,
        "secret",
        {
            "name": "   ",
            "sprint_time_ms": 10100,
            "sprint_date": "2026-03-02",
            "location": "Track A",
        },
    )
    assert blank.status_code == 422

    missing_identity = _insert(
        client,
        "secret",
        {
            "sprint_time_ms": 10100,
            "sprint_date": "2026-03-02",
            "location": "Track A",
        },
    )
    assert missing_identity.status_code == 422


def test_post_sprint_rejects_invalid_person_id(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    response = _insert(
        client,
        "secret",
        {
            "person_id": 99999,
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    assert response.status_code == 422
    assert response.json()["detail"] == "person_id is invalid"


def test_best_endpoint_returns_fastest_per_person(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10800,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10100,
            "sprint_date": "2026-03-02",
            "location": "Track A",
        },
    )
    _insert(
        client,
        "secret",
        {
            "name": "Blake",
            "sprint_time_ms": 9900,
            "sprint_date": "2026-03-02",
            "location": "Track B",
        },
    )

    response = client.get("/v1/sprints/best")
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2

    alex = next(row for row in body["rows"] if row["name"] == "Alex")
    assert alex["best_time_ms"] == 10100


def test_list_sprints_supports_filter_order_and_pagination(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    payloads = [
        {"name": "Alex", "sprint_time_ms": 10500, "sprint_date": "2026-03-01", "location": "Track A"},
        {"name": "Alex", "sprint_time_ms": 9900, "sprint_date": "2026-03-03", "location": "Track B"},
        {"name": "Jamie", "sprint_time_ms": 10100, "sprint_date": "2026-03-02", "location": "Track A"},
    ]
    for payload in payloads:
        response = _insert(client, "secret", payload)
        assert response.status_code == 200

    response = client.get(
        "/v1/sprints",
        params={
            "name": "Alex",
            "sort_by": "sprint_time_ms",
            "sort_dir": "asc",
            "limit": 1,
            "offset": 0,
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert len(body["rows"]) == 1
    assert body["rows"][0]["sprint_time_ms"] == 9900
