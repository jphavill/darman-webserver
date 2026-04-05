from core.settings import get_settings


def _apply_env_settings() -> None:
    get_settings.cache_clear()


def test_admin_session_requires_auth(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    response = client.get("/v1/system/admin/session")

    assert response.status_code == 401


def test_admin_session_login_rejects_invalid_api_key(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    response = client.post("/v1/system/admin/session", json={"api_key": "wrong"})

    assert response.status_code == 401


def test_admin_session_login_and_read_returns_feature_flags(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200
    assert "admin_session" in login.cookies
    assert "XSRF-TOKEN" in login.cookies
    set_cookie_values = login.headers.get_list("set-cookie")
    lowered = [value.lower() for value in set_cookie_values]
    assert any("admin_session=" in value and "httponly" in value and "samesite=strict" in value for value in lowered)
    assert any("xsrf-token=" in value and "samesite=strict" in value for value in lowered)

    response = client.get("/v1/system/admin/session")

    assert response.status_code == 200
    assert response.json() == {
        "feature_flags": {
            "photos_view_unpublished": True,
            "photos_manage_publication": True,
            "projects_view_unpublished": True,
            "projects_manage_publication": True,
            "projects_manage_content": True,
        }
    }


def test_admin_session_login_cookies_are_not_secure_in_tests(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")

    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200

    set_cookie_values = login.headers.get_list("set-cookie")
    lowered = [value.lower() for value in set_cookie_values]

    assert any("admin_session=" in value for value in lowered)
    assert any("xsrf-token=" in value for value in lowered)
    assert all("; secure" not in value for value in lowered)


def test_admin_session_logout_requires_csrf_header(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200

    logout = client.delete("/v1/system/admin/session")
    assert logout.status_code == 403


def test_admin_session_logout_clears_session(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200
    csrf = login.cookies.get("XSRF-TOKEN")
    assert csrf

    logout = client.delete("/v1/system/admin/session", headers={"X-XSRF-TOKEN": csrf})
    assert logout.status_code == 204

    after = client.get("/v1/system/admin/session")
    assert after.status_code == 401


def test_rate_limit_applies_to_admin_login_attempts(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")
    _apply_env_settings()

    first = client.post("/v1/system/admin/session", json={"api_key": "wrong"})
    second = client.post("/v1/system/admin/session", json={"api_key": "wrong"})

    assert first.status_code == 401
    assert second.status_code == 429


def test_rate_limit_applies_to_public_get_requests(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")
    _apply_env_settings()

    first = client.get("/v1/people")
    second = client.get("/v1/people")

    assert first.status_code == 200
    assert second.status_code == 429


def test_rate_limit_is_disabled_when_configured_off(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")
    _apply_env_settings()

    first_get = client.get("/v1/people")
    second_get = client.get("/v1/people")
    assert first_get.status_code == 200
    assert second_get.status_code == 200

    first_login = client.post("/v1/system/admin/session", json={"api_key": "wrong"})
    second_login = client.post("/v1/system/admin/session", json={"api_key": "wrong"})
    assert first_login.status_code == 401
    assert second_login.status_code == 401


def test_authenticated_admin_requests_are_rate_limited(client, monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "secret")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")
    _apply_env_settings()

    login = client.post("/v1/system/admin/session", json={"api_key": "secret"})
    assert login.status_code == 200

    response = client.get("/v1/system/admin/session")
    assert response.status_code == 429


def test_invalid_admin_session_does_not_bypass_rate_limit(client, monkeypatch):
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "true")
    monkeypatch.setenv("RATE_LIMIT_MAX_REQUESTS", "1")
    _apply_env_settings()

    client.cookies.set("admin_session", "invalid")

    first = client.get("/v1/system/admin/session")
    second = client.get("/v1/system/admin/session")

    assert first.status_code == 401
    assert second.status_code == 429
