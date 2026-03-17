import os
import subprocess
import time
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text


POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "postgres")
TEST_DATABASE_URL = f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}@localhost:5432/{POSTGRES_DB}"

os.environ["DATABASE_URL"] = TEST_DATABASE_URL


def _run(command: str, *, cwd: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, shell=True, check=True, capture_output=True, text=True)


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
                f"pg_isready -U {POSTGRES_USER} -d {POSTGRES_DB}"
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

    _run("alembic -c alembic.ini upgrade head", cwd=backend_root)
    yield


@pytest.fixture()
def db_session() -> Generator:
    from database import SessionLocal

    session = SessionLocal()
    session.execute(
        text(
            "TRUNCATE TABLE photos, person_best_times, sprint_entries, people RESTART IDENTITY CASCADE"
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
