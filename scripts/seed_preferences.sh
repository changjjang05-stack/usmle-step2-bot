#!/usr/bin/env bash
set -euo pipefail

if [ -z "${BASE_URL:-}" ] || [ -z "${USER_ID:-}" ]; then
  echo "Usage:"
  echo "  export BASE_URL=http://localhost:8787"
  echo "  export USER_ID=default-user"
  echo "  export SUBJECTS='Internal Medicine,Cardiology'"
  exit 1
fi

subjects_json="[]"
if [ -n "${SUBJECTS:-}" ]; then
  subjects_json=$(printf '%s' "$SUBJECTS" | awk -F',' '
    BEGIN { printf "[" }
    {
      for (i=1; i<=NF; i++) {
        gsub(/^ +| +$/, "", $i);
        printf "\"%s\"", $i;
        if (i < NF) printf ",";
      }
    }
    END { printf "]" }'
  )
fi

curl -sS -X POST "${BASE_URL}/preferences" \
  -H "Content-Type: application/json" \
  -d "{
    \"user_id\": \"${USER_ID}\",
    \"preferred_subjects\": ${subjects_json},
    \"daily_total\": 12,
    \"am_count\": 6,
    \"pm_count\": 6
  }"

echo
echo "[ok] preferences updated"
