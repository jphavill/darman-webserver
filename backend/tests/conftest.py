import os
import re
import subprocess
import time
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from core.settings import get_settings


POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
BASE_POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
TEST_POSTGRES_DB = os.getenv("TEST_POSTGRES_DB", f"{BASE_POSTGRES_DB}_test")

if not re.fullmatch(r"[A-Za-z0-9_]+", TEST_POSTGRES_DB):
    raise RuntimeError(
        f"Invalid TEST_POSTGRES_DB '{TEST_POSTGRES_DB}'. Use only letters, numbers, and underscores."
    )
if not TEST_POSTGRES_DB.endswith("_test"):
    raise RuntimeError(
        f"Unsafe TEST_POSTGRES_DB '{TEST_POSTGRES_DB}'. Test database names must end with '_test'."
    )

TEST_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@localhost:5432/{TEST_POSTGRES_DB}"

os.environ["DATABASE_URL"] = TEST_DATABASE_URL


def _run(command: str, *, cwd: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, shell=True, check=True, capture_output=True, text=True)


def _ensure_test_database(repo_root: str) -> None:
    exists_result = subprocess.run(
        (
            "docker compose -f docker-compose.local.yml exec -T postgres "
            f"psql -U {POSTGRES_USER} -d postgres -tAc \"SELECT 1 FROM pg_database WHERE datname = '{TEST_POSTGRES_DB}'\""
        ),
        cwd=repo_root,
        shell=True,
        capture_output=True,
        text=True,
    )
    if exists_result.returncode != 0:
        raise RuntimeError(f"Failed to check test database existence: {exists_result.stderr.strip()}")

    if exists_result.stdout.strip() != "1":
        _run(
            (
                "docker compose -f docker-compose.local.yml exec -T postgres "
                f"psql -U {POSTGRES_USER} -d postgres -c \"CREATE DATABASE {TEST_POSTGRES_DB}\""
            ),
            cwd=repo_root,
        )


@pytest.fixture(scope="session", autouse=True)
def ensure_test_database() -> Generator[None, None, None]:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    _run("docker compose -f docker-compose.local.yml up -d postgres", cwd=repo_root)

    start = time.time()
    while True:
        result = subprocess.run(
            (
                "docker compose -f docker-compose.local.yml exec -T postgres "
                f"pg_isready -U {POSTGRES_USER} -d postgres"
            ),
            cwd=repo_root,
            shell=True,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            break
        if time.time() - start > 30:
            raise RuntimeError(f"Postgres did not become ready: {result.stderr.strip()}")
        time.sleep(1)

    _ensure_test_database(repo_root=repo_root)
    _run("alembic -c alembic.ini upgrade head", cwd=backend_root)
    yield


@pytest.fixture()
def db_session() -> Generator:
    from database import SessionLocal

    session = SessionLocal()

    current_db = session.execute(text("SELECT current_database()")).scalar_one()
    if not isinstance(current_db, str) or not current_db.endswith("_test"):
        raise RuntimeError(
            f"Refusing to truncate non-test database '{current_db}'. Database name must end with '_test'."
        )

    session.execute(
        text(
            "TRUNCATE TABLE photos, sprint_entries, people RESTART IDENTITY CASCADE"
        )
    )
    session.commit()

    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session) -> Generator[TestClient, None, None]:
    from database import get_db
    from main import app

    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(autouse=True)
def clear_settings_cache() -> Generator[None, None, None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
