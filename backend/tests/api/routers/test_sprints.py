def _auth_headers(client, token: str) -> dict[str, str]:
    login = client.post("/v1/system/admin/session", json={"api_key": token})
    assert login.status_code == 200
    csrf = login.cookies.get("XSRF-TOKEN")
    assert csrf
    return {"X-XSRF-TOKEN": csrf}


def _insert(client, token: str, payload: dict):
    return client.post(
        "/v1/sprints",
        headers=_auth_headers(client, token),
        json=payload,
    )


def _delete(client, token: str, sprint_id: int):
    return client.delete(
        f"/v1/sprints/{sprint_id}",
        headers=_auth_headers(client, token),
    )


def _patch_update(client, token: str, sprint_id: int, payload: dict):
    return client.patch(
        f"/v1/sprints/{sprint_id}",
        headers=_auth_headers(client, token),
        json=payload,
    )


def _get_person_id(client, query: str) -> int:
    people_response = client.get("/v1/people", params={"q": query})
    assert people_response.status_code == 200
    return people_response.json()[0]["id"]


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


def test_update_sprint_updates_runner_by_existing_name(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    original = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    _insert(
        client,
        "secret",
        {
            "name": "Jamie",
            "sprint_time_ms": 10300,
            "sprint_date": "2026-03-01",
            "location": "Track B",
        },
    )

    response = _patch_update(client, "secret", original.json()["id"], {"name": "Jamie"})
    assert response.status_code == 200
    assert response.json()["name"] == "Jamie"


def test_update_sprint_supports_person_id(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    original = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    _insert(
        client,
        "secret",
        {
            "name": "Jamie",
            "sprint_time_ms": 10300,
            "sprint_date": "2026-03-01",
            "location": "Track B",
        },
    )
    jamie_id = _get_person_id(client, "jam")

    response = _patch_update(client, "secret", original.json()["id"], {"person_id": jamie_id})
    assert response.status_code == 200
    assert response.json()["name"] == "Jamie"


def test_update_sprint_rejects_unknown_name(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    created = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )

    response = _patch_update(client, "secret", created.json()["id"], {"name": "New Person"})
    assert response.status_code == 422
    assert response.json()["detail"] == "person name does not exist"


def test_update_sprint_rejects_name_and_person_id(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    created = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    _insert(
        client,
        "secret",
        {
            "name": "Jamie",
            "sprint_time_ms": 10300,
            "sprint_date": "2026-03-01",
            "location": "Track B",
        },
    )
    jamie_id = _get_person_id(client, "jam")

    response = _patch_update(
        client,
        "secret",
        created.json()["id"],
        {"name": "Jamie", "person_id": jamie_id},
    )
    assert response.status_code == 422


def test_update_sprint_rejects_inactive_person_id(client, monkeypatch, db_session):
    from models import Person

    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    created = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )

    inactive = Person(name="Inactive Runner", normalized_name="inactive runner", is_active=False)
    db_session.add(inactive)
    db_session.commit()

    response = _patch_update(client, "secret", created.json()["id"], {"person_id": inactive.id})
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


def test_list_sprints_supports_text_filter_types(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    payloads = [
        {"name": "Alex", "sprint_time_ms": 10500, "sprint_date": "2026-03-01", "location": "Track A"},
        {"name": "Alexa", "sprint_time_ms": 9900, "sprint_date": "2026-03-03", "location": "Track B"},
        {"name": "Blake", "sprint_time_ms": 10100, "sprint_date": "2026-03-02", "location": "Track A"},
    ]
    for payload in payloads:
        response = _insert(client, "secret", payload)
        assert response.status_code == 200

    equals_response = client.get(
        "/v1/sprints",
        params={
            "name": "Alex",
            "name_filter_type": "equals",
            "sort_by": "name",
            "sort_dir": "asc",
        },
    )
    assert equals_response.status_code == 200
    equals_body = equals_response.json()
    assert equals_body["total"] == 1
    assert equals_body["rows"][0]["name"] == "Alex"

    not_contains_response = client.get(
        "/v1/sprints",
        params={
            "name": "lex",
            "name_filter_type": "notContains",
            "sort_by": "name",
            "sort_dir": "asc",
        },
    )
    assert not_contains_response.status_code == 200
    not_contains_body = not_contains_response.json()
    assert not_contains_body["total"] == 1
    assert not_contains_body["rows"][0]["name"] == "Blake"


def test_delete_sprint_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    created = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    sprint_id = created.json()["id"]
    client.cookies.clear()

    response = client.delete(f"/v1/sprints/{sprint_id}")
    assert response.status_code == 401


def test_delete_sprint_removes_entry(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    created = _insert(
        client,
        "secret",
        {
            "name": "Alex",
            "sprint_time_ms": 10500,
            "sprint_date": "2026-03-01",
            "location": "Track A",
        },
    )
    sprint_id = created.json()["id"]

    deleted = _delete(client, "secret", sprint_id)
    assert deleted.status_code == 204

    response = client.get("/v1/sprints")
    assert response.status_code == 200
    assert response.json()["total"] == 0


def test_get_locations_returns_distinct_sorted_locations(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 10200, "sprint_date": "2026-03-01", "location": "UNB Track"},
    )
    _insert(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 10150, "sprint_date": "2026-03-02", "location": "UNB Track"},
    )
    _insert(
        client,
        "secret",
        {
            "name": "Jamie",
            "sprint_time_ms": 9990,
            "sprint_date": "2026-03-02",
            "location": "Fredericton High School Track",
        },
    )

    response = client.get("/v1/locations")
    assert response.status_code == 200
    assert response.json() == ["Fredericton High School Track", "UNB Track"]


def test_get_sprint_comparison_progression_reindexes_points(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 5200, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 5100, "sprint_date": "2026-03-02", "location": "Track A"},
    )
    _insert(
        client,
        "secret",
        {"name": "Blake", "sprint_time_ms": 5300, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert(
        client,
        "secret",
        {"name": "Blake", "sprint_time_ms": 5250, "sprint_date": "2026-03-02", "location": "Track A"},
    )
    _insert(
        client,
        "secret",
        {"name": "Blake", "sprint_time_ms": 5210, "sprint_date": "2026-03-03", "location": "Track A"},
    )

    alex_id = _get_person_id(client, "alex")
    blake_id = _get_person_id(client, "blake")

    response = client.get(
        "/v1/sprints/comparison",
        params={"mode": "progression", "person_ids": f"{alex_id},{blake_id}", "run_window": "all"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "progression"
    assert body["run_window"] == "all"
    assert len(body["series"]) == 2

    alex_series = next(series for series in body["series"] if series["person_name"] == "Alex")
    assert [point["x"] for point in alex_series["points"]] == [1, 2]
    assert [point["y"] for point in alex_series["points"]] == [5200, 5100]

    blake_series = next(series for series in body["series"] if series["person_name"] == "Blake")
    assert [point["x"] for point in blake_series["points"]] == [1, 2, 3]
    assert [point["y"] for point in blake_series["points"]] == [5300, 5250, 5210]


def test_get_sprint_comparison_progression_respects_run_window_and_location(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    for index in range(12):
        location = "Track A" if index % 2 == 0 else "Track B"
        _insert(
            client,
            "secret",
            {
                "name": "Alex",
                "sprint_time_ms": 6000 - (index * 10),
                "sprint_date": f"2026-03-{index + 1:02d}",
                "location": location,
            },
        )

    alex_id = _get_person_id(client, "alex")
    response = client.get(
        "/v1/sprints/comparison",
        params={
            "mode": "progression",
            "person_ids": str(alex_id),
            "location": "Track A",
            "run_window": "10",
        },
    )
    assert response.status_code == 200
    body = response.json()

    points = body["series"][0]["points"]
    assert len(points) == 6
    assert [point["y"] for point in points] == [6000, 5980, 5960, 5940, 5920, 5900]


def test_get_sprint_comparison_progression_supports_all_run_windows(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    for index in range(60):
        _insert(
            client,
            "secret",
            {
                "name": "Taylor",
                "sprint_time_ms": 7000 - index,
                "sprint_date": f"2026-04-{(index % 28) + 1:02d}",
                "location": "Track Z",
            },
        )

    taylor_id = _get_person_id(client, "taylor")

    expected_lengths = {
        "all": 60,
        "10": 10,
        "20": 20,
        "50": 50,
    }
    for run_window, expected in expected_lengths.items():
        response = client.get(
            "/v1/sprints/comparison",
            params={
                "mode": "progression",
                "person_ids": str(taylor_id),
                "location": "Track Z",
                "run_window": run_window,
            },
        )
        assert response.status_code == 200
        points = response.json()["series"][0]["points"]
        assert len(points) == expected


def test_get_sprint_comparison_daily_best_returns_one_point_per_day(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert(
        client,
        "secret",
        {"name": "Casey", "sprint_time_ms": 5050, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert(
        client,
        "secret",
        {"name": "Casey", "sprint_time_ms": 4990, "sprint_date": "2026-03-01", "location": "Track A"},
    )
    _insert(
        client,
        "secret",
        {"name": "Casey", "sprint_time_ms": 4980, "sprint_date": "2026-03-02", "location": "Track B"},
    )

    casey_id = _get_person_id(client, "casey")

    response = client.get(
        "/v1/sprints/comparison",
        params={"mode": "daily_best", "person_ids": str(casey_id), "location": "Track A"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "daily_best"
    points = body["series"][0]["points"]
    assert points == [{"x": "2026-03-01", "y": 4990, "label": "2026-03-01"}]


def test_get_sprint_comparison_rejects_invalid_person_ids(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    _insert(
        client,
        "secret",
        {"name": "Alex", "sprint_time_ms": 5050, "sprint_date": "2026-03-01", "location": "Track A"},
    )

    invalid = client.get("/v1/sprints/comparison", params={"person_ids": "999999", "mode": "progression"})
    assert invalid.status_code == 422



def test_get_sprint_comparison_allows_more_than_four_person_ids(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    for index in range(1, 6):
        _insert(
            client,
            "secret",
            {
                "name": f"Runner {index}",
                "sprint_time_ms": 5000 + index,
                "sprint_date": "2026-03-01",
                "location": "Track A",
            },
        )

    person_ids = [str(_get_person_id(client, f"runner {index}")) for index in range(1, 6)]
    response = client.get(
        "/v1/sprints/comparison",
        params={"person_ids": ",".join(person_ids), "mode": "progression", "run_window": "all"},
    )

    assert response.status_code == 200
    body = response.json()
    assert len(body["series"]) == 5
