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
   - `ADMIN_API_TOKEN` - Bearer token required for sprint data inserts (`POST /api/v1/sprints`)
   - `CLOUDFLARE_TUNNEL_TOKEN` - Required for production only (Cloudflare Zero Trust tunnel token)

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
docker compose up -d --build
```

Access at:
- Local: http://localhost
- Production: https://www.jasonhavill.com

## Image Hosting (Local Folder via Caddy)

This stack is configured so Caddy serves files from `./media` at the URL path `/media/*`.

- Host path: `./media`
- Container path: `/srv/media` (read-only in Caddy)
- Public URL pattern: `/media/<filename>`

Example homepage image URL currently used by the Angular app:

`/media/GOPR4391-Enhanced-NR.jpg`

### Add or update an image

1. Put a source image anywhere on your machine (for example in `~/Pictures`).
2. Run:
   ```bash
   ./scripts/prepare-media.sh ~/Pictures/your-image.jpg 1600
   ```
3. The script creates an optimized WebP in `./media` with a content-hashed name.
4. Copy the printed URL (`/media/<name>.webp`) into the frontend component.

- Media is not synced through github. To transfer to the server use scp
```bash
scp media/{filename}.webp jh://home/jphavill/dockerStuff/darman-webserver/media/
```

### Batch gallery workflow (thumb + full)

For the photo gallery, generate both thumbnail and full-size variants from a directory plus metadata CSV.

1. Create a metadata CSV (example columns below):

```csv
filename,id,alt_text,caption,captured_at,is_published
IMG_1001.JPG,,Fog over the valley,Morning inversion near the ridge,2026-03-16T09:45:00-07:00,true
IMG_1002.JPG,,Workbench detail,New fixture test fit,2026-03-15T18:22:00-07:00,true
```

- `id` can be left blank on first run; the script writes generated UUIDs to a resolved CSV.

2. Process all photos in a directory:

```bash
./scripts/prepare-gallery-batch.py \
  --input-dir ~/Pictures/gallery-upload \
  --metadata ~/Pictures/gallery-upload/metadata.csv \
  --thumb-width 640 \
  --thumb-quality 82 \
  --full-quality 95 \
  --manifest-out ./media/gallery-manifest.json
```

- `media/gallery-manifest.json` is merged by `id` when it already exists (new IDs append, existing IDs update), so you can process new batches from different source directories without re-including older files.

3. Copy generated files to the server media folder:

```bash
scp media/gallery/* jh://home/jphavill/dockerStuff/darman-webserver/media/gallery/
```

4. Upsert metadata into Postgres via API:

```bash
./scripts/upsert-gallery-manifest.sh ./media/gallery-manifest.json "$ADMIN_API_TOKEN" http://localhost/api
```

The gallery API stores both `thumb_url` and `full_url` for each UUID photo record.

### Hashing + resizing workflow

`scripts/prepare-media.sh` does this automatically:

1. Auto-orients and strips metadata
2. Resizes to max width (default `1600` px)
3. Converts to WebP (`quality 82`)
4. Computes SHA-256 hash of output bytes
5. Writes file as `<slug>-<12-char-hash>.webp`

This lets you cache images aggressively in Caddy (`immutable`) and safely publish updates by changing the filename.

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

The Cloudflare Tunnel token is **not required** in local mode.

Access at: http://localhost

### Production Mode

For production deployment with Cloudflare Tunnel:

```bash
docker compose up -d
```

This includes the `cloudflared` service which connects to Cloudflare Tunnel.

**Required:** Set `CLOUDFLARE_TUNNEL_TOKEN` in your `.env` file before running.

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
docker volume rm yourproject_postgres_data
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
