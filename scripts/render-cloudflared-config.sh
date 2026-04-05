#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TEMPLATE_PATH="$REPO_ROOT/cloudflared/config.template.yml"
OUTPUT_PATH="$REPO_ROOT/cloudflared/config.yml"

if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$REPO_ROOT/.env"
  set +a
fi

required_vars=(CLOUDFLARE_TUNNEL_ID ROOT_DOMAIN WWW_DOMAIN)

for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    printf 'Missing required environment variable: %s\n' "$var_name" >&2
    exit 1
  fi
done

python3 - "$TEMPLATE_PATH" "$OUTPUT_PATH" <<'PY'
import os
import sys
from string import Template

template_path = sys.argv[1]
output_path = sys.argv[2]

with open(template_path, "r", encoding="utf-8") as f:
    template = Template(f.read())

rendered = template.substitute(os.environ)

if "${" in rendered:
    raise RuntimeError("Unresolved placeholders remain in rendered cloudflared config")

with open(output_path, "w", encoding="utf-8") as f:
    f.write(rendered)
PY

printf 'Rendered %s from template\n' "$OUTPUT_PATH"
