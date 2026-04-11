#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

NPM_CACHE_DIR="${NPM_CACHE_DIR:-$REPO_ROOT/.cache/npm}"
FRONTEND_DEPS_CACHE_ROOT="${FRONTEND_DEPS_CACHE_ROOT:-$REPO_ROOT/.cache/frontend-node_modules}"
NPM_CACHE_TTL_DAYS="${NPM_CACHE_TTL_DAYS:-21}"
FRONTEND_TEST_CACHE_TTL_DAYS="${FRONTEND_TEST_CACHE_TTL_DAYS:-21}"

mkdir -p "$NPM_CACHE_DIR" "$FRONTEND_DEPS_CACHE_ROOT"
find "$NPM_CACHE_DIR" -mindepth 1 -type f -mtime "+$NPM_CACHE_TTL_DAYS" -delete
find "$FRONTEND_DEPS_CACHE_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$FRONTEND_TEST_CACHE_TTL_DAYS" -exec rm -rf {} +
