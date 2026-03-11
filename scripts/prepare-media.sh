#!/usr/bin/env bash

set -euo pipefail

if [ "${1:-}" = "" ]; then
  printf 'Usage: %s <input-image> [max-width]\n' "$0"
  exit 1
fi

INPUT_PATH="$1"
MAX_WIDTH="${2:-1600}"
MEDIA_DIR="$(pwd)/media"

if [ ! -f "$INPUT_PATH" ]; then
  printf 'Input file does not exist: %s\n' "$INPUT_PATH"
  exit 1
fi

mkdir -p "$MEDIA_DIR"

BASE_NAME="$(basename "$INPUT_PATH")"
NAME_ONLY="${BASE_NAME%.*}"
SAFE_NAME="$(printf '%s' "$NAME_ONLY" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9' '-')"
SAFE_NAME="${SAFE_NAME#-}"
SAFE_NAME="${SAFE_NAME%-}"
TMP_DIR="$(mktemp -d)"
TMP_OUTPUT="$TMP_DIR/output.webp"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

if command -v magick >/dev/null 2>&1; then
  magick "$INPUT_PATH" -auto-orient -strip -resize "${MAX_WIDTH}x>" -quality 82 "$TMP_OUTPUT"
elif command -v docker >/dev/null 2>&1; then
  docker run --rm \
    -v "$(dirname "$INPUT_PATH"):/input:ro" \
    -v "$TMP_DIR:/output" \
    dpokidov/imagemagick \
    "/input/$BASE_NAME" -auto-orient -strip -resize "${MAX_WIDTH}x>" -quality 82 "/output/output.webp"
else
  printf 'Install ImageMagick (magick) or Docker to process images.\n'
  exit 1
fi

HASH="$(shasum -a 256 "$TMP_OUTPUT" | cut -c1-12)"
OUTPUT_FILE="${SAFE_NAME}-${HASH}.webp"
OUTPUT_PATH="$MEDIA_DIR/$OUTPUT_FILE"

cp "$TMP_OUTPUT" "$OUTPUT_PATH"

printf 'Created: %s\n' "$OUTPUT_PATH"
printf 'Public URL: /media/%s\n' "$OUTPUT_FILE"
