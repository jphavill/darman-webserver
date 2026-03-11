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
- Backend (Python/FastAPI)
- PostgreSQL database
- Caddy reverse proxy (ports 80/443)

The Cloudflare Tunnel token is **not required** in local mode.

Access at: http://localhost

If you run only the Angular dev server (`npm start` inside `frontend`), media URLs (`/media/*`) are proxied to `http://localhost` via `frontend/proxy.conf.json`. Keep the local Caddy stack running so those image requests resolve.

### Production Mode

For production deployment with Cloudflare Tunnel:

```bash
docker compose up -d
```

This includes the `cloudflared` service which connects to Cloudflare Tunnel.

**Required:** Set `CLOUDFLARE_TUNNEL_TOKEN` in your `.env` file before running.

## Rapid Angular Development

### Local Angular Dev Server

The fastest way to iterate on Angular changes without Docker:

```bash
cd frontend
npm install
npm start
```

This runs the Angular dev server on http://localhost:4200 with hot module replacement (HMR). Changes save and reload instantly.

**Note:** The backend/DB won't be available in this mode. The Angular app will load but API calls will fail unless you also run the backend separately or proxy to a staging environment.

For full Docker-based development, see [frontend/README.md](./frontend/README.md).

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

# Rebuild only frontend
docker compose -f docker-compose.local.yml build frontend
docker compose -f docker-compose.local.yml up -d frontend

# View running containers
docker ps

# Shell into a container
docker exec -it <container-name> sh
```
