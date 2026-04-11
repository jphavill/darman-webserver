#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NPM_CACHE_DIR="${NPM_CACHE_DIR:-$REPO_ROOT/.cache/npm}"
FRONTEND_DEPS_CACHE_ROOT="${FRONTEND_DEPS_CACHE_ROOT:-$REPO_ROOT/.cache/frontend-node_modules}"
FRONTEND_NODE_IMAGE="${FRONTEND_NODE_IMAGE:-node:22-alpine}"
FRONTEND_LOCKFILE="${FRONTEND_LOCKFILE:-$REPO_ROOT/frontend/package-lock.json}"
FRONTEND_CACHE_KEY="${FRONTEND_CACHE_KEY:-}"

compute_frontend_cache_key() {
  local frontend_lock_hash
  local frontend_image_hash

  frontend_lock_hash="$(shasum -a 256 "$FRONTEND_LOCKFILE" | cut -d ' ' -f 1)"
  frontend_image_hash="$(printf '%s' "$FRONTEND_NODE_IMAGE" | shasum -a 256 | cut -d ' ' -f 1 | cut -c 1-12)"
  printf '%s\n' "${frontend_lock_hash}-img${frontend_image_hash}-linux"
}

if [ ! -f "$FRONTEND_LOCKFILE" ]; then
  printf 'Missing frontend lockfile: %s\n' "$FRONTEND_LOCKFILE"
  exit 1
fi

mkdir -p "$NPM_CACHE_DIR" "$FRONTEND_DEPS_CACHE_ROOT"

if [ -z "$FRONTEND_CACHE_KEY" ]; then
  FRONTEND_CACHE_KEY="$(compute_frontend_cache_key)"
fi

FRONTEND_DEPS_CACHE_DIR="$FRONTEND_DEPS_CACHE_ROOT/$FRONTEND_CACHE_KEY"
mkdir -p "$FRONTEND_DEPS_CACHE_DIR"

CONTAINER_SCRIPT="$(cat <<'EOF'
set -eu
needs_install=1

if [ -f node_modules/.cache_key ] && [ "$(cat node_modules/.cache_key)" = "$FRONTEND_CACHE_KEY" ]; then
  if npm ls --depth=0 >/dev/null 2>&1; then
    needs_install=0
  fi
fi

if [ "$needs_install" -eq 1 ]; then
  mkdir -p node_modules
  find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  npm ci --prefer-offline --no-audit
  printf '%s\n' "$FRONTEND_CACHE_KEY" > node_modules/.cache_key
fi

npm test
EOF
)"

docker run --rm \
  -u "$(id -u):$(id -g)" \
  -v "$REPO_ROOT/frontend:/app" \
  -v "$NPM_CACHE_DIR:/npm-cache" \
  -v "$FRONTEND_DEPS_CACHE_DIR:/app/node_modules" \
  -w /app \
  -e NPM_CONFIG_CACHE=/npm-cache \
  -e FRONTEND_CACHE_KEY="$FRONTEND_CACHE_KEY" \
  "$FRONTEND_NODE_IMAGE" \
  sh -lc "$CONTAINER_SCRIPT"
