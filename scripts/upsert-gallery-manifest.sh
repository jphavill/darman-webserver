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

curl --fail --show-error --silent \
  -X POST "$API_BASE_URL/v1/photos/batch-upsert" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  --data-binary "@$MANIFEST_PATH"

printf '\nUpsert complete.\n'
