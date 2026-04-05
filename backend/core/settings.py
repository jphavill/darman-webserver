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
    rate_limit_enabled: bool
    rate_limit_window_seconds: int
    rate_limit_max_requests: int
    rate_limit_trust_proxy: bool
    rate_limit_ip_header: str
    media_root_path: str
    projects_media_subdir: str
    projects_thumb_width: int
    projects_full_max_width: int
    projects_thumb_webp_quality: int
    projects_full_webp_quality: int
    projects_max_image_pixels: int
    projects_max_upload_bytes: int


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
        rate_limit_enabled=_parse_bool(
            os.getenv("RATE_LIMIT_ENABLED", "true"),
            default=True,
        ),
        rate_limit_window_seconds=int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")),
        rate_limit_max_requests=int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "120")),
        rate_limit_trust_proxy=_parse_bool(
            os.getenv("RATE_LIMIT_TRUST_PROXY", "false"),
            default=False,
        ),
        rate_limit_ip_header=os.getenv("RATE_LIMIT_IP_HEADER", "CF-Connecting-IP"),
        media_root_path=os.getenv("MEDIA_ROOT_PATH", "/app/media"),
        projects_media_subdir=os.getenv("PROJECTS_MEDIA_SUBDIR", "projects"),
        projects_thumb_width=int(os.getenv("PROJECTS_THUMB_WIDTH", "640")),
        projects_full_max_width=int(os.getenv("PROJECTS_FULL_MAX_WIDTH", "1600")),
        projects_thumb_webp_quality=int(os.getenv("PROJECTS_THUMB_WEBP_QUALITY", "80")),
        projects_full_webp_quality=int(os.getenv("PROJECTS_FULL_WEBP_QUALITY", "86")),
        projects_max_image_pixels=int(os.getenv("PROJECTS_MAX_IMAGE_PIXELS", "40000000")),
        projects_max_upload_bytes=int(os.getenv("PROJECTS_MAX_UPLOAD_BYTES", "104857600")),
    )
