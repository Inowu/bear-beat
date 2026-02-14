#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/backend/docker-compose.test.yml"
CONTAINER_NAME="bearbeat-test-db"
COMPOSE_PROJECT="bearbeat-test"

TEST_MYSQL_PORT="${TEST_MYSQL_PORT:-3306}"
TEST_DB_NAME="${TEST_DB_NAME:-bearbeat_test}"
DATABASE_URL="mysql://root:root@127.0.0.1:${TEST_MYSQL_PORT}/${TEST_DB_NAME}"

KEEP_DB="${TEST_KEEP_DB:-0}"

cleanup() {
  if [[ "$KEEP_DB" == "1" ]]; then
    echo "[test:local] Keeping test DB running (TEST_KEEP_DB=1)."
    return
  fi

  echo "[test:local] Stopping test DB..."
  docker compose \
    -p "$COMPOSE_PROJECT" \
    -f "$COMPOSE_FILE" \
    down -v >/dev/null 2>&1 || true
}

trap cleanup EXIT

echo "[test:local] Starting MySQL (port ${TEST_MYSQL_PORT}, db ${TEST_DB_NAME})..."
docker compose \
  -p "$COMPOSE_PROJECT" \
  -f "$COMPOSE_FILE" \
  up -d

echo "[test:local] Waiting for MySQL healthcheck..."
deadline=$((SECONDS + 90))
while true; do
  status="$(docker inspect --format='{{.State.Health.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "")"
  if [[ "$status" == "healthy" ]]; then
    break
  fi
  if [[ "$status" == "unhealthy" ]]; then
    echo "[test:local] MySQL container is unhealthy."
    exit 1
  fi
  if (( SECONDS >= deadline )); then
    echo "[test:local] Timed out waiting for MySQL to become healthy."
    exit 1
  fi
  sleep 2
done

echo "[test:local] Applying Prisma migrations (CI parity)..."
DATABASE_URL="$DATABASE_URL" \
JWT_SECRET="test-secret" \
NODE_ENV="test" \
npx prisma migrate deploy --schema backend/prisma/schema.prisma

echo "[test:local] Running backend tests..."
DATABASE_URL="$DATABASE_URL" \
JWT_SECRET="test-secret" \
NODE_ENV="test" \
npm test --workspace=backend -- --runInBand

echo "[test:local] OK"
