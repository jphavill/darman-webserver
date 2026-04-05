from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from api.dependencies.auth import require_admin_mutation, require_authenticated_admin_session, validate_admin_api_key
from core.settings import get_settings
from database import get_db
from models import AdminSession
from schemas import AdminFeatureFlags, AdminSessionCreateRequest, AdminSessionResponse
from services.admin_sessions import create_admin_session, revoke_admin_session


router = APIRouter()


@router.get("/")
def read_root() -> dict[str, str]:
    return {"message": "API is running"}


def _set_admin_cookies(response: Response, session_token: str, csrf_token: str) -> None:
    settings = get_settings()
    max_age = settings.admin_session_ttl_seconds
    response.set_cookie(
        key=settings.admin_session_cookie_name,
        value=session_token,
        max_age=max_age,
        httponly=True,
        secure=settings.admin_session_cookie_secure,
        samesite=settings.admin_session_cookie_samesite,
        path=settings.admin_session_cookie_path,
    )
    response.set_cookie(
        key=settings.admin_csrf_cookie_name,
        value=csrf_token,
        max_age=max_age,
        httponly=False,
        secure=settings.admin_session_cookie_secure,
        samesite=settings.admin_session_cookie_samesite,
        path=settings.admin_session_cookie_path,
    )


def _clear_admin_cookies(response: Response) -> None:
    settings = get_settings()
    response.delete_cookie(
        key=settings.admin_session_cookie_name,
        path=settings.admin_session_cookie_path,
        secure=settings.admin_session_cookie_secure,
        samesite=settings.admin_session_cookie_samesite,
    )
    response.delete_cookie(
        key=settings.admin_csrf_cookie_name,
        path=settings.admin_session_cookie_path,
        secure=settings.admin_session_cookie_secure,
        samesite=settings.admin_session_cookie_samesite,
    )


@router.post("/v1/system/admin/session", response_model=AdminSessionResponse)
def create_admin_session_route(
    payload: AdminSessionCreateRequest,
    response: Response,
    db: Session = Depends(get_db),
) -> AdminSessionResponse:
    validate_admin_api_key(payload.api_key)
    session = create_admin_session(db=db, ttl_seconds=get_settings().admin_session_ttl_seconds)
    _set_admin_cookies(response=response, session_token=session.session_token, csrf_token=session.csrf_token)
    return AdminSessionResponse(feature_flags=AdminFeatureFlags())


@router.get("/v1/system/admin/session", response_model=AdminSessionResponse)
def read_admin_session(
    _session: AdminSession = Depends(require_authenticated_admin_session),
) -> AdminSessionResponse:
    return AdminSessionResponse(feature_flags=AdminFeatureFlags())


@router.delete("/v1/system/admin/session", status_code=204)
def delete_admin_session_route(
    response: Response,
    db: Session = Depends(get_db),
    admin_session: AdminSession = Depends(require_admin_mutation),
) -> Response:
    revoke_admin_session(db=db, admin_session=admin_session)
    _clear_admin_cookies(response)
    response.status_code = 204
    return response
