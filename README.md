# Darman Webserver

A Docker-based webserver stack with frontend, backend, PostgreSQL, Caddy reverse proxy, and optional Cloudflare Tunnel.

## Prerequisites

- Docker
- Docker Compose

## Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your desired values.

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
```
