import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    database_url: str
    admin_api_token: str | None
    api_root_path: str
    cors_allow_origins: list[str]


def _parse_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


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
    )
