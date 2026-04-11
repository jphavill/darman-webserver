#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=0
BACKUP_DIR="${BACKUP_DIR:-/mnt/nas/databaseBackups}"
NPM_CACHE_TTL_DAYS="${NPM_CACHE_TTL_DAYS:-21}"
FRONTEND_TEST_CACHE_TTL_DAYS="${FRONTEND_TEST_CACHE_TTL_DAYS:-21}"

usage() {
  printf 'Usage: %s [--dry-run]\n' "$0"
  printf '\n'
  printf 'Deploy flow:\n'
  printf '  1) git pull --ff-only origin main\n'
  printf '  2) frontend tests (hash-aware frontend test image)\n'
  printf '  3) backend tests (hash-aware backend image + postgres-test)\n'
  printf '  4) postgres backup to %s\n' "$BACKUP_DIR"
  printf '  5) remove backups older than 14 days\n'
  printf '  6) render cloudflared config\n'
  printf '  7) docker compose down/selective-build/up\n'
}

log() {
  printf '\n[%s] %s\n' "$(date +"%Y-%m-%d %H:%M:%S")" "$1"
}

print_cmd() {
  printf '>> '
  printf '%q ' "$@"
  printf '\n'
}

run_cmd() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] '
    print_cmd "$@"
    return 0
  fi

  print_cmd "$@"
  "$@"
}

run_in_dir() {
  local dir="$1"
  shift

  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] (cd %q && ' "$dir"
    printf '%q ' "$@"
    printf ')\n'
    return 0
  fi

  (
    cd "$dir"
    print_cmd "$@"
    "$@"
  )
}

for arg in "$@"; do
  case "$arg" in
    -n|--dry-run)
      DRY_RUN=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'Unknown option: %s\n\n' "$arg"
      usage
      exit 1
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NPM_CACHE_DIR="${NPM_CACHE_DIR:-$REPO_ROOT/.cache/npm}"
FRONTEND_DEPS_CACHE_ROOT="${FRONTEND_DEPS_CACHE_ROOT:-$REPO_ROOT/.cache/frontend-node_modules}"
FRONTEND_NODE_IMAGE="${FRONTEND_NODE_IMAGE:-node:22-alpine}"

run_frontend_tests_with_cache() {
  run_in_dir "$REPO_ROOT" make test SERVICE=frontend FRONTEND_MODE=cached COMPOSE_FILE=docker-compose.yml NPM_CACHE_DIR="$NPM_CACHE_DIR" FRONTEND_DEPS_CACHE_ROOT="$FRONTEND_DEPS_CACHE_ROOT" FRONTEND_NODE_IMAGE="$FRONTEND_NODE_IMAGE"
}

determine_build_services() {
  local build_frontend=0
  local build_backend=0
  local changed_file
  local frontend_image_id
  local backend_image_id

  for changed_file in "$@"; do
    [ -n "$changed_file" ] || continue
    case "$changed_file" in
      frontend/*)
        build_frontend=1
        ;;
      backend/*)
        build_backend=1
        ;;
      docker-compose.yml|docker-compose.local.yml)
        build_frontend=1
        build_backend=1
        ;;
    esac
  done

  frontend_image_id="$(docker compose -f "$REPO_ROOT/docker-compose.yml" images -q frontend 2>/dev/null || true)"
  backend_image_id="$(docker compose -f "$REPO_ROOT/docker-compose.yml" images -q backend 2>/dev/null || true)"
  [ -n "$frontend_image_id" ] || build_frontend=1
  [ -n "$backend_image_id" ] || build_backend=1

  [ "$build_frontend" -eq 1 ] && printf 'frontend\n'
  [ "$build_backend" -eq 1 ] && printf 'backend\n'
}

if [ ! -f "$REPO_ROOT/docker-compose.yml" ]; then
  printf 'Could not find docker-compose.yml at repo root: %s\n' "$REPO_ROOT"
  exit 1
fi

for cmd in git docker find make; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$cmd"
    exit 1
  fi
done

export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
export COMPOSE_DOCKER_CLI_BUILD="${COMPOSE_DOCKER_CLI_BUILD:-1}"

CURRENT_BRANCH="$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  printf 'Refusing to deploy from branch "%s". Switch to "main" first.\n' "$CURRENT_BRANCH"
  exit 1
fi

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="data_backup_${TIMESTAMP}.dump"
CONTAINER_BACKUP_PATH="/tmp/${BACKUP_FILE}"
LOCAL_BACKUP_PATH="$REPO_ROOT/${BACKUP_FILE}"
FINAL_BACKUP_PATH="$BACKUP_DIR/${BACKUP_FILE}"

log "Pulling latest main"
PRE_PULL_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
run_in_dir "$REPO_ROOT" git pull --ff-only origin main
POST_PULL_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"

log "Running frontend tests in Docker"
run_frontend_tests_with_cache

log "Running backend tests"
run_in_dir "$REPO_ROOT" make test SERVICE=backend COMPOSE_FILE=docker-compose.yml

log "Creating database backup"
run_cmd mkdir -p "$BACKUP_DIR"
run_cmd docker exec -t postgres sh -lc "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc -f \"$CONTAINER_BACKUP_PATH\""
run_cmd docker cp "postgres:$CONTAINER_BACKUP_PATH" "$LOCAL_BACKUP_PATH"
run_cmd docker exec -t postgres rm -f "$CONTAINER_BACKUP_PATH"
run_cmd mv "$LOCAL_BACKUP_PATH" "$FINAL_BACKUP_PATH"

log "Pruning backups older than 14 days"
run_cmd find "$BACKUP_DIR" -maxdepth 1 -type f -name 'data_backup_*.dump' -mtime +14 -delete

log "Rendering cloudflared config"
run_in_dir "$REPO_ROOT" bash scripts/render-cloudflared-config.sh

BUILD_SERVICES=()
CHANGED_FILES=()
if [ "$PRE_PULL_SHA" != "$POST_PULL_SHA" ]; then
  while IFS= read -r changed_file; do
    [ -n "$changed_file" ] || continue
    CHANGED_FILES+=("$changed_file")
  done < <(git -C "$REPO_ROOT" diff --name-only "$PRE_PULL_SHA" "$POST_PULL_SHA")
fi

while IFS= read -r service; do
  [ -n "$service" ] || continue
  BUILD_SERVICES+=("$service")
done < <(determine_build_services "${CHANGED_FILES[@]}")

log "Deploying production stack"
run_in_dir "$REPO_ROOT" docker compose -f docker-compose.yml down
if [ "${#BUILD_SERVICES[@]}" -gt 0 ]; then
  log "Building updated services: ${BUILD_SERVICES[*]}"
  run_in_dir "$REPO_ROOT" docker compose -f docker-compose.yml build --parallel "${BUILD_SERVICES[@]}"
else
  log "No backend/frontend changes detected; skipping image build"
fi
run_in_dir "$REPO_ROOT" docker compose -f docker-compose.yml up -d --remove-orphans

log "Deploy complete"
printf 'Backup created: %s\n' "$FINAL_BACKUP_PATH"
