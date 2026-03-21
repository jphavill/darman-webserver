import pytest
from fastapi.security import HTTPAuthorizationCredentials

from api.dependencies.auth import require_write_token
from core.errors import ServiceUnavailableAppError, UnauthorizedAppError


def test_require_write_token_missing_config(monkeypatch):
    monkeypatch.delenv("ADMIN_API_TOKEN", raising=False)

    with pytest.raises(ServiceUnavailableAppError) as exc:
        require_write_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="token"))

    assert exc.value.status_code == 503


def test_require_write_token_rejects_invalid_token(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "expected")

    with pytest.raises(UnauthorizedAppError) as exc:
        require_write_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="wrong"))

    assert exc.value.status_code == 401


def test_require_write_token_accepts_valid_token(monkeypatch):
    monkeypatch.setenv("ADMIN_API_TOKEN", "expected")
    require_write_token(HTTPAuthorizationCredentials(scheme="Bearer", credentials="expected"))
