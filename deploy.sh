#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
ENV_FILE="${BACKEND_DIR}/.env"
NGINX_CONF="/etc/nginx/sites-enabled/thebearbeatapi.lat"

log() {
  printf "==> %s\n" "$*"
}

die() {
  printf "Error: %s\n" "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

require_cmd git
require_cmd npm
require_cmd pm2
require_cmd grep
require_cmd sed
require_cmd sudo
require_cmd nginx
require_cmd systemctl

[ -d "$BACKEND_DIR" ] || die "Backend directory not found: $BACKEND_DIR"
[ -f "$ENV_FILE" ] || die "Env file not found: $ENV_FILE"
[ -f "$NGINX_CONF" ] || die "Nginx config not found: $NGINX_CONF"

upsert_env() {
  local key="$1"
  local value="$2"

  # Escape sed replacement chars for the chosen delimiter (|)
  local escaped_value="$value"
  escaped_value="${escaped_value//\\/\\\\}"
  escaped_value="${escaped_value//&/\\&}"
  escaped_value="${escaped_value//|/\\|}"

  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i.bak "s|^${key}=.*|${key}=${escaped_value}|" "$ENV_FILE"
    rm -f "${ENV_FILE}.bak"
  else
    printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
  fi
}

ensure_env_default() {
  local key="$1"
  local value="$2"

  if grep -q "^${key}=" "$ENV_FILE"; then
    return 0
  fi
  printf "\n%s=%s\n" "$key" "$value" >> "$ENV_FILE"
}

log "Pulling latest changes..."
# Descartar cambios locales (ej. package-lock.json) para que pull no falle
git -C "$ROOT_DIR" reset --hard HEAD
git -C "$ROOT_DIR" pull --ff-only

log "Ensuring ANALYTICS_IP_SALT is set (privacy: hash IPs in internal analytics)..."
if ! grep -q '^ANALYTICS_IP_SALT=' "$ENV_FILE"; then
  # Don't print the salt to logs. Generate once and keep it in .env.
  if command -v openssl >/dev/null 2>&1; then
    salt="$(openssl rand -hex 32)"
  elif command -v python3 >/dev/null 2>&1; then
    salt="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
    )"
  else
    die "Missing required command to generate ANALYTICS_IP_SALT: install openssl or python3"
  fi
  printf "\nANALYTICS_IP_SALT=%s\n" "$salt" >> "$ENV_FILE"
fi

log "Ensuring NODE_ENV is set to production (payments + webhooks rely on it in some modules)..."
ensure_env_default "NODE_ENV" "production"

log "Ensuring required production flags are set (Conekta + client URL)..."
upsert_env "CLIENT_URL" "https://thebearbeat.com"
# Only set defaults; don't override manual disables (critical during incident response).
ensure_env_default "CONEKTA_PBB_ENABLED" "1"
ensure_env_default "CONEKTA_OXXO_ENABLED" "1"
# Default free trial config (Stripe only). Override in backend/.env if needed.
ensure_env_default "BB_TRIAL_DAYS" "7"
ensure_env_default "BB_TRIAL_GB" "100"

current_port="$(grep -Eo 'proxy_pass\s+http://(localhost|127\.0\.0\.1):[0-9]+' "$NGINX_CONF" \
  | head -n 1 \
  | sed -E 's/.*:([0-9]+)$/\1/')"

[ -n "$current_port" ] || die "Could not determine current proxy port from $NGINX_CONF"

case "$current_port" in
  5000)
    target_port=6000
    target_process="bearbeat-green"
    ;;
  6000)
    target_port=5000
    target_process="bearbeat-blue"
    ;;
  *)
    die "Unexpected proxy port: $current_port (expected 5000 or 6000)"
    ;;
esac

log "Installing dependencies (monorepo workspaces)..."
( cd "$ROOT_DIR" && npm install )

log "Running Prisma migrations..."
( cd "$BACKEND_DIR" && npx prisma migrate deploy )

log "Building backend..."
( cd "$BACKEND_DIR" && npm run build )

log "Ensuring pm2 automation runner is running (single instance)..."
automation_process="bearbeat-automation"
automation_script="${BACKEND_DIR}/build/automationRunner.js"
if pm2 describe "$automation_process" >/dev/null 2>&1; then
  pm2 restart "$automation_process"
else
  pm2 start "$automation_script" --name "$automation_process"
fi

log "Updating backend PORT to $target_port"
if grep -q '^PORT=' "$ENV_FILE"; then
  sed -i.bak "s/^PORT=.*/PORT=$target_port/" "$ENV_FILE"
  rm -f "${ENV_FILE}.bak"
else
  printf "\nPORT=%s\n" "$target_port" >> "$ENV_FILE"
fi

log "Restarting pm2 process: $target_process"
pm2 restart "$target_process"

log "Updating nginx proxy_pass to port $target_port"
# Dos sed separados para evitar que el | (alternancia) confunda a BSD sed
sudo sed -i.bak -E "s#(proxy_pass[[:space:]]+http://localhost:)[0-9]+;#\1${target_port};#" "$NGINX_CONF"
sudo sed -i.bak -E "s#(proxy_pass[[:space:]]+http://127\.0\.0\.1:)[0-9]+;#\1${target_port};#" "$NGINX_CONF"
sudo rm -f "${NGINX_CONF}.bak"

log "Testing nginx configuration..."
sudo nginx -t

log "Reloading nginx..."
sudo systemctl reload nginx

log "Deploy complete."
