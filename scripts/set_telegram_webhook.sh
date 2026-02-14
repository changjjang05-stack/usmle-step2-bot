#!/usr/bin/env bash
set -euo pipefail

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${PUBLIC_BASE_URL:-}" ]; then
  echo "Usage:"
  echo "  export TELEGRAM_BOT_TOKEN=..."
  echo "  export PUBLIC_BASE_URL=https://your-domain"
  exit 1
fi

curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${PUBLIC_BASE_URL}/telegram/webhook\"}"

echo
echo "[ok] webhook set to ${PUBLIC_BASE_URL}/telegram/webhook"
