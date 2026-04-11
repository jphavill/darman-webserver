# AGENTS.md
Guidance for agentic coding tools in `darman-webserver`.

## Quick Context
- Backend: FastAPI + SQLAlchemy + Alembic + pytest.
- Frontend: Angular 17 + Vitest.
- Local development usually runs through Docker Compose.

## Repository Structure
- `backend/` API, services, schemas, DB models, migrations, backend tests.
- `frontend/` Angular app, services, components, frontend tests.
- `media/` image artifacts served by Caddy.
- `scripts/` helper scripts for media/gallery workflows.
- `Makefile` convenience wrappers for Docker commands.

## Build, Run, and Test Commands

### Docker stack
```bash
make up
make down
make rebuild
make rebuild SERVICE=backend
make rebuild SERVICE=frontend
make migrate
``` 

### Root Make test modes
```bash
# Run backend + frontend
make test

# Backend tests (container mode default)
make test SERVICE=backend

# Backend tests in host .venv
make test SERVICE=backend BACKEND_MODE=host

# Frontend tests (local npm default)
make test SERVICE=frontend

# Frontend tests in Docker with dependency cache
make test SERVICE=frontend FRONTEND_MODE=cached
```

### Backend setup (host)
- Use the existing .venv at the root of the project for python environment
```bash
source .venv/bin/activate
pip install -r backend/requirements.txt
```

Run backend from `backend/`:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Backend tests (pytest)
Notes:
- `backend/pytest.ini` sets `testpaths = tests`.
- `backend/tests/conftest.py` starts/checks Postgres with Docker and runs Alembic.
- Ensure you have enabled the `.venv` python environment at the root of the project.

Run all backend tests:
```bash
cd backend && pytest
```

Run one backend file:
```bash
cd backend && pytest tests/services/test_photos.py
```

Run one backend test function (important for fast iteration):
```bash
cd backend && pytest tests/services/test_photos.py::test_update_photo_supports_partial_updates
```

Run one backend router test file:
```bash
cd backend && pytest tests/api/routers/test_photos.py
```

### Frontend install/build/test
```bash
cd frontend && npm install
cd frontend && npm start
cd frontend && npm run build
cd frontend && npm test
```

Run frontend tests in watch mode:
```bash
cd frontend && npm run test:watch
```

Run one frontend spec file:
```bash
cd frontend && npm test -- src/app/pages/sprint-page/sprint-page.component.spec.ts
```

Run one frontend test by name:
```bash
cd frontend && npm test -- -t "creates the component class"
```

### Alembic
Preferred in Docker local mode:
```bash
make migrate
```

Host-based:
```bash
alembic -c backend/alembic.ini upgrade head
alembic -c backend/alembic.ini revision --autogenerate -m "describe change"
```

## Lint / Format Status
- No dedicated lint script is configured for backend or frontend.
- No `pyproject.toml`, `.eslintrc*`, or Prettier config was found.
- Match existing style and use tests/build as validation gates.

## Backend Code Style

### Imports
- Order: standard library, third-party, local modules.
- Keep import groups separated by a single blank line.
- Use explicit imports rather than wildcards.

### Layering and organization
- Keep routers thin (`backend/api/routers/*`): parse/validate, then delegate.
- Put business logic and DB query composition in `backend/services/*`.
- Keep request/response schemas in `backend/schemas.py`.
- Keep ORM table models in `backend/models.py`.

### Typing and validation
- Add type hints to public functions.
- Keep function return types explicit.
- Docker backend runs Python 3.11.

### SQLAlchemy patterns
- Use injected `Session` from `get_db`.
- Use `one_or_none()` for lookups that map to 404 behavior.
- Use Postgres upsert pattern where needed:
  `insert(...).on_conflict_do_update(...)`.
- Commit at service boundary and refresh records when returning new DB state.

## Frontend Code Style
- TypeScript strict mode is enabled in `frontend/tsconfig.json`.
- Prefer typed models and `Observable<T>` return types in services.
- Keep HTTP calls in service classes, not in component templates.
- Existing components are standalone (`standalone: true`); follow this pattern.
- Naming: PascalCase class names, kebab-case filenames.
- Vitest tests should be concise and behavior-focused.
- Keep all frontend hex color values in `frontend/src/theme.css`; In `.css` files, use `var(--token-name)`. In `.ts` files resolve tokens through `src/app/shared/theme/theme-tokens.ts`.

## Test Expectations
- When behavior changes, update tests in the same area.
- Use single-test runs while iterating, then run impacted suite before finishing.
- Backend tests are split by layer (`backend/tests/services`, `backend/tests/api/routers`).
- Frontend tests are discovered by `src/**/*.spec.ts` (Vitest config).
