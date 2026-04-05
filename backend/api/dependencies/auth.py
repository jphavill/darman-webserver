import os
import secrets

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from core.errors import ForbiddenAppError, ServiceUnavailableAppError, UnauthorizedAppError
from core.settings import get_settings
from database import get_db
from models import AdminSession
from services.admin_sessions import find_active_admin_session, verify_csrf_token


def validate_admin_api_key(api_key: str) -> None:
    admin_api_token = os.getenv("ADMIN_API_TOKEN") or get_settings().admin_api_token
    if not admin_api_token:
        raise ServiceUnavailableAppError("Write token is not configured")

    if not secrets.compare_digest(api_key, admin_api_token):
        raise UnauthorizedAppError("Invalid API key")


def require_admin_session(
    request: Request,
    db: Session = Depends(get_db),
) -> AdminSession | None:
    settings = get_settings()
    session_token = request.cookies.get(settings.admin_session_cookie_name)
    return find_active_admin_session(db=db, session_token=session_token)


def require_authenticated_admin_session(
    admin_session: AdminSession | None = Depends(require_admin_session),
) -> AdminSession:
    if not admin_session:
        raise UnauthorizedAppError("Missing or invalid admin session")

    return admin_session


def require_admin_mutation(
    request: Request,
    admin_session: AdminSession = Depends(require_authenticated_admin_session),
) -> AdminSession:
    settings = get_settings()
    header_token = request.headers.get(settings.admin_csrf_header_name)
    cookie_token = request.cookies.get(settings.admin_csrf_cookie_name)

    if not header_token or not cookie_token:
        raise ForbiddenAppError("Missing CSRF token")

    if not secrets.compare_digest(header_token, cookie_token):
        raise ForbiddenAppError("CSRF token mismatch")

    if not verify_csrf_token(admin_session=admin_session, csrf_token=header_token):
        raise ForbiddenAppError("Invalid CSRF token")

    return admin_session
