# Scripts

This directory contains utility scripts used for deployment and media verification.

## Available scripts

- `deploy-prod.sh`
  - Production deployment helper.
  - Uses `make cache-prune` and `make test SERVICE=frontend FRONTEND_MODE=cached` for frontend test cache lifecycle.

- `render-cloudflared-config.sh`
  - Renders Cloudflare tunnel config from template.

- `check_frontend_hex_colors.py`
  - Validates frontend color token usage.

- `run-frontend-tests-cached.sh`
  - Runs frontend tests in Docker with cache-keyed `node_modules` reuse and npm cache mounts.
  - Computes the frontend dependency cache key (lockfile hash + node image hash).

- `prune-frontend-test-cache.sh`
  - Shared cache-pruning primitive used by local Make targets and production deploy flow.

## Deploy/frontend cache knobs

- `NPM_CACHE_TTL_DAYS` (default `21`)
- `FRONTEND_TEST_CACHE_TTL_DAYS` (default `21`)
- `FRONTEND_NODE_IMAGE` (default `node:22-alpine`)

Cache keying is centralized in `run-frontend-tests-cached.sh` and uses `frontend/package-lock.json` hash + the `FRONTEND_NODE_IMAGE` reference, so changing image tags automatically rolls dependency snapshots.

## Gallery workflow

Gallery photo uploads are now handled directly in the admin UI and API (`POST /api/v1/photos`).
