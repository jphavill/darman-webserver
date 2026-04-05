import pytest

from api.dependencies.auth import validate_admin_api_key
from core.errors import ServiceUnavailableAppError, UnauthorizedAppError


def test_validate_admin_api_key_missing_config(monkeypatch):
    monkeypatch.delenv("ADMIN_API_TOKEN", raising=False)

    with pytest.raises(ServiceUnavailableAppError) as exc:
        validate_admin_api_key("token")

    assert exc.value.status_code == 503


def test_validate_admin_api_key_rejects_invalid_token(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "expected")

    with pytest.raises(UnauthorizedAppError) as exc:
        validate_admin_api_key("wrong")

    assert exc.value.status_code == 401


def test_validate_admin_api_key_accepts_valid_token(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "expected")
    validate_admin_api_key("expected")
