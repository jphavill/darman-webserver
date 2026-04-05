import os
import re
import subprocess
import time
from collections.abc import Generator

import psycopg2
import pytest
from fastapi.testclient import TestClient
from psycopg2 import sql
from sqlalchemy import text

from core.settings import get_settings


POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
BASE_POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
TEST_POSTGRES_DB = os.getenv("TEST_POSTGRES_DB", f"{BASE_POSTGRES_DB}_test")
TEST_POSTGRES_HOST = os.getenv("TEST_POSTGRES_HOST", os.getenv("POSTGRES_HOST", "localhost"))
TEST_POSTGRES_PORT = int(os.getenv("TEST_POSTGRES_PORT", os.getenv("POSTGRES_PORT", "5432")))
TEST_BOOTSTRAP_POSTGRES = os.getenv("TEST_BOOTSTRAP_POSTGRES", "1") == "1"

if not re.fullmatch(r"[A-Za-z0-9_]+", TEST_POSTGRES_DB):
    raise RuntimeError(
        f"Invalid TEST_POSTGRES_DB '{TEST_POSTGRES_DB}'. Use only letters, numbers, and underscores."
    )
if not TEST_POSTGRES_DB.endswith("_test"):
    raise RuntimeError(
        f"Unsafe TEST_POSTGRES_DB '{TEST_POSTGRES_DB}'. Test database names must end with '_test'."
    )

TEST_DATABASE_URL = (
    f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{TEST_POSTGRES_HOST}:{TEST_POSTGRES_PORT}/{TEST_POSTGRES_DB}"
)

os.environ["DATABASE_URL"] = TEST_DATABASE_URL


def _run(command: str, *, cwd: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, shell=True, check=True, capture_output=True, text=True)


def _wait_for_postgres(timeout_seconds: int = 30) -> None:
    start = time.time()
    while True:
        try:
            with psycopg2.connect(
                host=TEST_POSTGRES_HOST,
                port=TEST_POSTGRES_PORT,
                user=POSTGRES_USER,
                password=POSTGRES_PASSWORD,
                dbname=BASE_POSTGRES_DB,
            ):
                return
        except psycopg2.OperationalError as exc:
            if time.time() - start > timeout_seconds:
                raise RuntimeError(f"Postgres did not become ready: {exc}") from exc
            time.sleep(1)


def _ensure_test_database() -> None:
    conn = psycopg2.connect(
        host=TEST_POSTGRES_HOST,
        port=TEST_POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        dbname=BASE_POSTGRES_DB,
    )
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (TEST_POSTGRES_DB,))
            if cur.fetchone() is None:
                cur.execute(
                    sql.SQL("CREATE DATABASE {}")
                    .format(sql.Identifier(TEST_POSTGRES_DB))
                )
    finally:
        conn.close()


@pytest.fixture(scope="session", autouse=True)
def ensure_test_database() -> Generator[None, None, None]:
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    backend_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

    if TEST_BOOTSTRAP_POSTGRES:
        _run("docker compose -f docker-compose.local.yml up -d postgres", cwd=repo_root)

    _wait_for_postgres()
    _ensure_test_database()
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
            "TRUNCATE TABLE admin_sessions, photos, sprint_entries, people RESTART IDENTITY CASCADE"
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
