# Darman Webserver

A Docker-based webserver stack with Angular frontend, Python backend, PostgreSQL, Caddy reverse proxy, and optional Cloudflare Tunnel.

## Prerequisites

- Docker
- Docker Compose
- Node.js 20+ (for local Angular development without Docker)

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your desired values:
    - `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` - PostgreSQL credentials/database name
    - `ADMIN_API_TOKEN` - Admin login bootstrap token for creating admin sessions
    - `ADMIN_SESSION_COOKIE_SECURE` - Set to `true` in non-local environments (default is secure)
    - `ROOT_DOMAIN` / `WWW_DOMAIN` - Domains used by the production Caddy config
    - `CORS_ALLOW_ORIGINS` - Comma-separated list of allowed CORS origins
    - `CLOUDFLARE_TUNNEL_TOKEN` / `CLOUDFLARE_TUNNEL_ID` - Required for production tunnel and cloudflared config rendering
    - `RATE_LIMIT_*` - Optional global request rate-limit controls

3. Create a local media folder for images:
   ```bash
   mkdir -p media
   ```

## Quick Start

### Local Development (fastest iteration)

```bash
# Option A: Run Angular dev server locally (no Docker needed)
cd frontend
npm install
npm start
# Access at http://localhost:4200
```

### With Docker (full stack)

```bash
# Local mode (no tunnel, ports 80/443 exposed)
docker compose -f docker-compose.local.yml up -d --build

# Production mode (with Cloudflare Tunnel)
./scripts/render-cloudflared-config.sh
docker compose up -d --build
```

Access at:
- Local: http://localhost
- Production: `https://$WWW_DOMAIN`

## Project Admin (Create/Edit/Publish)

The home page project sections (`Software Projects` and `Physical Projects`) are now fully API-backed and editable from the UI when logged in as admin.

What you can do in admin mode:
- Create new projects
- Edit existing project title/short description/long markdown/type
- Publish or unpublish projects
- Reorder projects within each section
- Upload project images directly from the browser (`jpg`, `jpeg`, `png`, `webp`, `heic`)
- Set a hero image, reorder gallery images, and delete images

Key behavior and limits:
- Public users only see published projects
- Admin users can view unpublished projects
- Maximum 12 images per project
- Uploaded images are processed to WebP and stored in `./media/projects`
- Public URLs are served from `/media/projects/<filename>.webp`
- Markdown is rendered as basic markdown (raw HTML is not rendered)

How to use it locally:
1. Start the local stack (`make up` or `docker compose -f docker-compose.local.yml up -d --build`)
2. Open `http://localhost`
3. Click your name in the top nav to open admin login
4. Sign in using `ADMIN_API_TOKEN` from your `.env`
5. Open `Manage Projects` on the home page

## Image Hosting (Local Folder via Caddy)

This stack is configured so Caddy serves files from `./media` at the URL path `/media/*`.

- Host path: `./media`
- Container path: `/srv/media` (read-only in Caddy)
- Public URL pattern: `/media/<filename>`

Example homepage image URL currently used by the Angular app:

`/media/GOPR4391-Enhanced-NR.jpg`

### Add or update static media

1. Add files directly under `./media`.
2. Reference them in the frontend as `/media/<filename>`.

- Media is not synced through github. To transfer to the server use scp:
```bash
scp media/{filename} jh://home/jphavill/dockerStuff/darman-webserver/media/
```

### Gallery photo workflow

Photo gallery uploads are handled directly in the admin UI on the Photos page.

- Upload one or multiple files in the browser.
- The backend stores both thumbnail and full WebP variants.
- Metadata is written directly to the `photos` table (no manifest files or batch upsert step).

## Running the Project

### Local Development Mode

For local testing (e.g., with Orbstack on Mac), use:

```bash
docker compose -f docker-compose.local.yml up -d
```

This starts:
- Frontend (Angular app served via nginx)
- Backend (Python/FastAPI, with `--reload` in local mode)
- PostgreSQL database
- Caddy reverse proxy (ports 80/443)

Local Docker mode explicitly sets `ADMIN_SESSION_COOKIE_SECURE=false` so admin session cookies work over `http://localhost`.
All other environments default to `ADMIN_SESSION_COOKIE_SECURE=true` unless explicitly overridden.

The Cloudflare Tunnel token is **not required** in local mode.

Access at: http://localhost

### Production Mode

For production deployment with Cloudflare Tunnel:

```bash
docker compose up -d
```

This includes the `cloudflared` service which connects to Cloudflare Tunnel.

**Required:** Set `CLOUDFLARE_TUNNEL_TOKEN`, `CLOUDFLARE_TUNNEL_ID`, `ROOT_DOMAIN`, and `WWW_DOMAIN` in your `.env` file before running.

Global rate limiting applies to all requests, including authenticated admin requests. Production compose (`docker-compose.yml`) trusts proxy headers and local compose (`docker-compose.local.yml`) does not.

Render `cloudflared/config.yml` from `cloudflared/config.template.yml` before starting production compose.

## Common Commands

```bash
# Start services
docker compose -f docker-compose.local.yml up -d

# View logs
docker compose -f docker-compose.local.yml logs -f

# Stop services
docker compose -f docker-compose.local.yml down

# Rebuild after code changes
docker compose -f docker-compose.local.yml up -d --build

# Bring stack up without rebuilding
docker compose -f docker-compose.local.yml up -d

# Rebuild only backend
docker compose -f docker-compose.local.yml up -d --build backend

# Rebuild only frontend
docker compose -f docker-compose.local.yml up -d --build frontend

# View running containers
docker ps

# Shell into a container
docker exec -it <container-name> sh
```

## Database Migrations (Alembic)

Alembic files live in `backend/alembic/` and migration revisions are in `backend/alembic/versions/`.

```bash
# Preferred in Docker local mode
make migrate

# Or directly
docker compose -f docker-compose.local.yml exec backend alembic -c alembic.ini upgrade head

# Host-based option (uses your local .venv)
# postgres is exposed on localhost:5432 in docker-compose.local.yml
source .venv/bin/activate

# Apply all migrations
alembic -c backend/alembic.ini upgrade head

# Create a new migration after model changes
alembic -c backend/alembic.ini revision --autogenerate -m "describe change"
```

If you see `connection to server at "localhost", port 5432 failed: Connection refused`, it means your host process cannot reach Postgres yet. In local Docker mode, prefer running migrations via `make migrate` (inside the backend container).

## Running Tests

### Backend tests (pytest)

Backend tests run from `backend/` and use the root `.venv` Python environment.

```bash
# from repo root
source .venv/bin/activate
cd backend
pytest
```

Run a single backend test file:

```bash
cd backend
pytest tests/services/test_photos.py
```

Run a single backend test function:

```bash
cd backend
pytest tests/services/test_photos.py::test_update_photo_supports_partial_updates
```

### Frontend tests (Vitest)

Frontend tests run from `frontend/`.

```bash
cd frontend
npm install
npm test
```

Run frontend tests in watch mode:

```bash
cd frontend
npm run test:watch
```

Run a single frontend spec file:

```bash
cd frontend
npm test -- src/app/pages/sprint-page/sprint-page.component.spec.ts
```

Run a single frontend test by name:

```bash
cd frontend
npm test -- -t "creates the component class"
```

## Backend Test Database Safety

Backend pytest uses a dedicated test database and will refuse destructive test setup unless the active database name ends with `_test`.

- Default test DB name: `${POSTGRES_DB}_test` (for example, `postgres_test`)
- Override with: `TEST_POSTGRES_DB=<name_that_ends_in__test>`

This prevents local development data from being truncated during test runs.

## Database backup and restore
- Make backup
```bash
docker exec -t postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/data_backup.dump'
docker cp postgres:/tmp/data_backup.dump ./data_backup.dump
mv data_backup.dump /mnt/nas
```

- Restore backup to clean db

```bash
docker cp ./data_backup.dump postgres:/tmp/data_backup.dump
docker exec -it postgres sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/data_backup.dump'
```

- If needed nuke database
```bash
docker compose stop postgres
docker compose rm -f postgres
docker volume ls
docker volume rm darman-webserver_postgres_data
docker compose up -d postgres
```
## Makefile Shortcuts

Use these shortcuts for the same local Docker workflows:

```bash
# Start local stack
make up

# View logs
make logs

# Stop local stack
make down

# Full rebuild
make rebuild

# Rebuild backend only
make rebuild-backend

# Rebuild frontend only
make rebuild-frontend
```
