import hashlib
import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from models import AdminSession


@dataclass(frozen=True)
class CreatedAdminSession:
    session_token: str
    csrf_token: str


def _hash_token(raw_value: str) -> str:
    return hashlib.sha256(raw_value.encode("utf-8")).hexdigest()


def create_admin_session(db: Session, ttl_seconds: int) -> CreatedAdminSession:
    session_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=ttl_seconds)

    db.add(
        AdminSession(
            session_token_hash=_hash_token(session_token),
            csrf_token_hash=_hash_token(csrf_token),
            expires_at=expires_at,
        )
    )
    db.commit()

    return CreatedAdminSession(
        session_token=session_token,
        csrf_token=csrf_token,
    )


def find_active_admin_session(db: Session, session_token: str | None) -> AdminSession | None:
    if not session_token:
        return None

    now = datetime.now(timezone.utc)
    return (
        db.query(AdminSession)
        .filter(
            AdminSession.session_token_hash == _hash_token(session_token),
            AdminSession.revoked_at.is_(None),
            AdminSession.expires_at > now,
        )
        .one_or_none()
    )


def verify_csrf_token(admin_session: AdminSession, csrf_token: str) -> bool:
    return secrets.compare_digest(admin_session.csrf_token_hash, _hash_token(csrf_token))


def revoke_admin_session(db: Session, admin_session: AdminSession) -> None:
    admin_session.revoked_at = datetime.now(timezone.utc)
    db.add(admin_session)
    db.commit()
