#!/usr/bin/env bash

set -euo pipefail

if [ "${1:-}" = "" ] || [ "${2:-}" = "" ]; then
  printf 'Usage: %s <manifest-json-path> <admin-token> [api-base-url]\n' "$0"
  printf 'Example: %s media/gallery-manifest.json "$ADMIN_API_TOKEN" http://localhost/api\n' "$0"
  exit 1
fi

MANIFEST_PATH="$1"
ADMIN_TOKEN="$2"
API_BASE_URL="${3:-http://localhost/api}"

if [ ! -f "$MANIFEST_PATH" ]; then
  printf 'Manifest file does not exist: %s\n' "$MANIFEST_PATH"
  exit 1
fi

COOKIE_JAR="$(mktemp)"
CSRF_TOKEN=""
SESSION_CREATED=0

cleanup() {
  if [ "$SESSION_CREATED" -eq 1 ] && [ -n "$CSRF_TOKEN" ]; then
    curl --silent --show-error \
      -X DELETE "$API_BASE_URL/v1/system/admin/session" \
      -H "X-XSRF-TOKEN: $CSRF_TOKEN" \
      -b "$COOKIE_JAR" >/dev/null || true
  fi

  rm -f "$COOKIE_JAR"
}

trap cleanup EXIT

curl --fail --show-error --silent \
  -X POST "$API_BASE_URL/v1/system/admin/session" \
  -H "Content-Type: application/json" \
  -c "$COOKIE_JAR" \
  --data "{\"api_key\":\"$ADMIN_TOKEN\"}" >/dev/null

SESSION_CREATED=1
CSRF_TOKEN="$(awk '$6 == "XSRF-TOKEN" { token = $7 } END { print token }' "$COOKIE_JAR")"

if [ "$CSRF_TOKEN" = "" ]; then
  printf 'Login succeeded but CSRF cookie is missing.\n'
  exit 1
fi

curl --fail --show-error --silent \
  -X POST "$API_BASE_URL/v1/photos/batch-upsert" \
  -H "X-XSRF-TOKEN: $CSRF_TOKEN" \
  -H "Content-Type: application/json" \
  -b "$COOKIE_JAR" \
  --data-binary "@$MANIFEST_PATH"

printf '\nUpsert complete.\n'
