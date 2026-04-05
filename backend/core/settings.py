import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    database_url: str
    admin_api_token: str | None
    api_root_path: str
    cors_allow_origins: list[str]
    admin_session_ttl_seconds: int
    admin_session_cookie_name: str
    admin_session_cookie_secure: bool
    admin_session_cookie_samesite: str
    admin_session_cookie_path: str
    admin_csrf_cookie_name: str
    admin_csrf_header_name: str


def _parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


def _parse_bool(value: str, default: bool) -> bool:
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


@lru_cache
def get_settings() -> Settings:
    cors_default = "https://www.jasonhavill.com,http://localhost,http://localhost:4200"
    return Settings(
        database_url=os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/postgres",
        ),
        admin_api_token=os.getenv("ADMIN_API_TOKEN"),
        api_root_path=os.getenv("API_ROOT_PATH", "/api"),
        cors_allow_origins=_parse_csv(os.getenv("CORS_ALLOW_ORIGINS", cors_default)),
        admin_session_ttl_seconds=int(os.getenv("ADMIN_SESSION_TTL_SECONDS", "28800")),
        admin_session_cookie_name=os.getenv("ADMIN_SESSION_COOKIE_NAME", "admin_session"),
        admin_session_cookie_secure=_parse_bool(os.getenv("ADMIN_SESSION_COOKIE_SECURE", "true"), default=True),
        admin_session_cookie_samesite=os.getenv("ADMIN_SESSION_COOKIE_SAMESITE", "strict"),
        admin_session_cookie_path=os.getenv("ADMIN_SESSION_COOKIE_PATH", "/"),
        admin_csrf_cookie_name=os.getenv("ADMIN_CSRF_COOKIE_NAME", "XSRF-TOKEN"),
        admin_csrf_header_name=os.getenv("ADMIN_CSRF_HEADER_NAME", "X-XSRF-TOKEN"),
    )
