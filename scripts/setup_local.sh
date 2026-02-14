#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env ]; then
  cp .env.example .env
  echo "[ok] .env created from .env.example"
else
  echo "[ok] .env already exists"
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "[error] psql is required to apply sql/schema.sql"
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[info] DATABASE_URL is not exported in current shell."
  echo "      Run: export DATABASE_URL='postgresql://...'"
  exit 1
fi

psql "$DATABASE_URL" -f sql/schema.sql
echo "[ok] schema applied"

npm install
echo "[ok] dependencies installed"
echo "[done] You can now run: npm run dev"
