#!/usr/bin/env bash

set -euo pipefail

DRY_RUN=0
BACKUP_DIR="${BACKUP_DIR:-/mnt/nas/databaseBackups}"

usage() {
  printf 'Usage: %s [--dry-run]\n' "$0"
  printf '\n'
  printf 'Deploy flow:\n'
  printf '  1) git pull --ff-only origin main\n'
  printf '  2) frontend tests (node:20-alpine container)\n'
  printf '  3) backend tests (backend service container)\n'
  printf '  4) postgres backup to %s\n' "$BACKUP_DIR"
  printf '  5) remove backups older than 14 days\n'
  printf '  6) make prod\n'
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

if [ ! -f "$REPO_ROOT/Makefile" ]; then
  printf 'Could not find Makefile at repo root: %s\n' "$REPO_ROOT"
  exit 1
fi

for cmd in git docker make find; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$cmd"
    exit 1
  fi
done

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
run_in_dir "$REPO_ROOT" git pull --ff-only origin main

log "Running frontend tests in Docker"
run_in_dir "$REPO_ROOT" docker run --rm -v "$REPO_ROOT/frontend:/app" -w /app node:20-alpine sh -lc "npm ci && npm test"

log "Running backend tests in Docker"
run_in_dir "$REPO_ROOT" docker compose -f docker-compose.yml up -d postgres
run_in_dir "$REPO_ROOT" docker compose -f docker-compose.yml run --rm -e TEST_BOOTSTRAP_POSTGRES=0 -e TEST_POSTGRES_HOST=postgres backend pytest

log "Creating database backup"
run_cmd mkdir -p "$BACKUP_DIR"
run_cmd docker exec -t postgres sh -lc "pg_dump -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -Fc -f \"$CONTAINER_BACKUP_PATH\""
run_cmd docker cp "postgres:$CONTAINER_BACKUP_PATH" "$LOCAL_BACKUP_PATH"
run_cmd docker exec -t postgres rm -f "$CONTAINER_BACKUP_PATH"
run_cmd mv "$LOCAL_BACKUP_PATH" "$FINAL_BACKUP_PATH"

log "Pruning backups older than 14 days"
run_cmd find "$BACKUP_DIR" -maxdepth 1 -type f -name 'data_backup_*.dump' -mtime +14 -delete

log "Deploying production stack"
run_in_dir "$REPO_ROOT" make prod

log "Deploy complete"
printf 'Backup created: %s\n' "$FINAL_BACKUP_PATH"
