import os
import secrets

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from core.errors import ServiceUnavailableAppError, UnauthorizedAppError
from core.settings import get_settings


bearer_scheme = HTTPBearer(auto_error=False)


def require_write_token(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    admin_api_token = os.getenv("ADMIN_API_TOKEN") or get_settings().admin_api_token
    if not admin_api_token:
        raise ServiceUnavailableAppError("Write token is not configured")

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedAppError("Missing bearer token")

    if not secrets.compare_digest(credentials.credentials, admin_api_token):
        raise UnauthorizedAppError("Invalid bearer token")
