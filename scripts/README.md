# Scripts

This directory contains utility scripts used for deployment and media verification.

## Available scripts

- `deploy-prod.sh`
  - Production deployment helper.

- `render-cloudflared-config.sh`
  - Renders Cloudflare tunnel config from template.

- `check_frontend_hex_colors.py`
  - Validates frontend color token usage.

## Gallery workflow

Gallery photo uploads are now handled directly in the admin UI and API (`POST /api/v1/photos`).
