import os
import re
import secrets
import subprocess
import time
from collections.abc import Generator

import psycopg2
import pytest
from fastapi.testclient import TestClient
from psycopg2 import sql
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.rate_limit import clear_rate_limit_state
from core.settings import get_settings


POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
BASE_POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
PYTEST_XDIST_WORKER = os.getenv("PYTEST_XDIST_WORKER", "master")


def _default_test_postgres_db(base_postgres_db: str, worker: str) -> str:
    if worker and worker != "master":
        return f"{base_postgres_db}_{worker}_test"
    return f"{base_postgres_db}_test"


DEFAULT_TEST_POSTGRES_DB = _default_test_postgres_db(BASE_POSTGRES_DB, PYTEST_XDIST_WORKER)
TEST_POSTGRES_DB = os.getenv("TEST_POSTGRES_DB", DEFAULT_TEST_POSTGRES_DB)
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


def _truncate_all_tables() -> None:
    from database import Base
    import models  # noqa: F401

    table_identifiers = []
    for table in Base.metadata.sorted_tables:
        if table.schema:
            table_identifiers.append(
                sql.SQL("{}.{}").format(sql.Identifier(table.schema), sql.Identifier(table.name))
            )
        else:
            table_identifiers.append(sql.Identifier(table.name))

    if not table_identifiers:
        return

    conn = psycopg2.connect(
        host=TEST_POSTGRES_HOST,
        port=TEST_POSTGRES_PORT,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
        dbname=TEST_POSTGRES_DB,
    )
    conn.autocommit = True

    try:
        with conn.cursor() as cur:
            truncate_statement = sql.SQL("TRUNCATE TABLE {} RESTART IDENTITY CASCADE").format(
                sql.SQL(", ").join(table_identifiers)
            )
            cur.execute(truncate_statement)
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


@pytest.fixture(autouse=True)
def clean_database() -> None:
    # Primary isolation mechanism: full-table truncate before every test.
    _truncate_all_tables()


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    from database import SessionLocal, engine

    connection = engine.connect()
    session = None

    try:
        current_db = connection.execute(text("SELECT current_database()")).scalar_one()
        if not isinstance(current_db, str) or not current_db.endswith("_test"):
            raise RuntimeError(
                f"Refusing to run tests against non-test database '{current_db}'. Database name must end with '_test'."
            )
        # Secondary safeguard for tests that use direct DB sessions.
        session = SessionLocal(bind=connection)
        yield session
    finally:
        if session is not None:
            session.close()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    from database import get_db
    from main import app

    def override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            test_client.cookies.clear()
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture()
def admin_auth_headers(client: TestClient, db_session: Session):
    from services.admin_sessions import create_admin_session

    def _get(token: str = "secret") -> dict[str, str]:
        settings = get_settings()
        admin_api_token = os.getenv("ADMIN_API_TOKEN") or settings.admin_api_token
        if not admin_api_token or not secrets.compare_digest(token, admin_api_token):
            raise AssertionError("admin_auth_headers called with invalid admin token")

        created = create_admin_session(db=db_session, ttl_seconds=settings.admin_session_ttl_seconds)
        client.cookies.set(
            settings.admin_session_cookie_name,
            created.session_token,
            path=settings.admin_session_cookie_path,
        )
        client.cookies.set(
            settings.admin_csrf_cookie_name,
            created.csrf_token,
            path=settings.admin_session_cookie_path,
        )
        return {settings.admin_csrf_header_name: created.csrf_token}

    return _get


@pytest.fixture(autouse=True)
def admin_cookie_test_settings(monkeypatch: pytest.MonkeyPatch) -> Generator[None, None, None]:
    monkeypatch.setenv("ADMIN_SESSION_COOKIE_SECURE", "false")
    monkeypatch.setenv("RATE_LIMIT_ENABLED", "false")
    monkeypatch.setenv("RATE_LIMIT_TRUST_PROXY", "false")
    yield


@pytest.fixture(autouse=True)
def clear_settings_cache(admin_cookie_test_settings: None) -> Generator[None, None, None]:
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def clear_rate_limits() -> Generator[None, None, None]:
    clear_rate_limit_state()
    yield
    clear_rate_limit_state()
