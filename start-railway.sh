#!/usr/bin/env bash
set -euo pipefail

export N8N_USER_FOLDER="${N8N_USER_FOLDER:-/home/node/.n8n}"
export N8N_HOST="${N8N_HOST:-0.0.0.0}"
export N8N_PORT="${N8N_PORT:-${PORT:-5678}}"
export N8N_PROTOCOL="${N8N_PROTOCOL:-https}"
export N8N_DEFAULT_BINARY_DATA_MODE="${N8N_DEFAULT_BINARY_DATA_MODE:-filesystem}"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS="${N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS:-true}"
export GENERIC_TIMEZONE="${GENERIC_TIMEZONE:-Asia/Shanghai}"

mkdir -p "$N8N_USER_FOLDER" /data /shared/out

cleanup() {
  kill "${ROOT_RENDERER_PID:-}" "${TERMS_RENDERER_PID:-}" "${N8N_PID:-}" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

echo "Starting root renderer on 127.0.0.1:3010"
(
  cd /app/root-renderer
  PORT=3010 node server.js
) &
ROOT_RENDERER_PID=$!

echo "Starting terms renderer on 127.0.0.1:3020"
(
  cd /app/terms-renderer
  PORT=3020 OUT_ROOT=/shared/out PUBLIC_BASE_URL=http://127.0.0.1:3020 node server.js
) &
TERMS_RENDERER_PID=$!

echo "Starting n8n on 0.0.0.0:${N8N_PORT}"
n8n start &
N8N_PID=$!

wait -n "$ROOT_RENDERER_PID" "$TERMS_RENDERER_PID" "$N8N_PID"
