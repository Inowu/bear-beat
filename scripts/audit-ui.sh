#!/usr/bin/env bash
set -euo pipefail

# Full-site UI audit (screenshots + UI inventory + a11y + error copy)
#
# Outputs:
# - Reports (tracked): docs/audit/*
# - Screenshots (optional): audit/screenshots/*
#
# Requirements:
# - Local FE running on http://localhost:3000 (npm start)
# - Local BE running on http://localhost:5001 (npm start)
# - Seeded admin user (optional but recommended) via:
#   AUDIT_SEED_PASSWORD=... npm run seed:audit-user --workspace=backend
#
# Usage:
#   AUDIT_LOGIN_EMAIL=... AUDIT_LOGIN_PASSWORD=... ./scripts/audit-ui.sh

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

export AUDIT_BASE_URL="${AUDIT_BASE_URL:-http://localhost:3000}"
export AUDIT_API_BASE_URL="${AUDIT_API_BASE_URL:-http://localhost:5001}"

mkdir -p docs/audit
mkdir -p audit/screenshots

echo "[audit-ui] Running auditFullSite -> $AUDIT_BASE_URL (api=$AUDIT_API_BASE_URL)"
echo "[audit-ui] Reports: $REPO_ROOT/docs/audit"
echo "[audit-ui] Screenshots: $REPO_ROOT/audit/screenshots"

npm run audit:fullsite --workspace=backend

echo "[audit-ui] Done."
