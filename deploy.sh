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
require_cmd grep
require_cmd sed
require_cmd sudo
require_cmd nginx
require_cmd systemctl

ensure_pm2() {
  if command -v pm2 >/dev/null 2>&1; then
    return 0
  fi

  # When using nvm, global npm packages are per-Node-version. After switching
  # Node versions (ex. to Node 24 LTS), pm2 may no longer be present.
  log "pm2 not found; installing pm2@5.3.1 globally for current Node..."
  npm install -g "pm2@5.3.1"
}

ensure_pm2
require_cmd pm2

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

use_repo_node_version() {
  local nvmrc_path="${BACKEND_DIR}/.nvmrc"
  [ -f "$nvmrc_path" ] || return 0

  local target_version
  target_version="$(tr -d ' \t\r\n' < "$nvmrc_path")"
  [ -n "$target_version" ] || return 0

  if [ -s "${HOME}/.nvm/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "${HOME}/.nvm/nvm.sh"
    if command -v nvm >/dev/null 2>&1; then
      log "Selecting Node ${target_version} from backend/.nvmrc..."
      nvm install "$target_version" >/dev/null
      nvm use "$target_version" >/dev/null
    fi
  fi

  if command -v node >/dev/null 2>&1; then
    local current_node
    current_node="$(node -v)"
    if [[ "${current_node#v}" != "${target_version#v}"* ]]; then
      log "Warning: backend/.nvmrc expects ${target_version}, current Node is ${current_node}."
    fi
  fi
}

log "Pulling latest changes..."
# Descartar cambios locales (ej. package-lock.json) para que pull no falle
git -C "$ROOT_DIR" reset --hard HEAD
git -C "$ROOT_DIR" pull --ff-only

use_repo_node_version

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

log "Ensuring EMAIL_PREFERENCES_SECRET is set (sign unsubscribe links)..."
existing_email_pref_secret="$({ grep '^EMAIL_PREFERENCES_SECRET=' "$ENV_FILE" | head -n 1 | sed 's/^EMAIL_PREFERENCES_SECRET=//'; } || true)"
existing_email_pref_secret="$(printf '%s' "$existing_email_pref_secret" | tr -d ' \t\r\n')"
if [ -z "$existing_email_pref_secret" ]; then
  if command -v openssl >/dev/null 2>&1; then
    secret="$(openssl rand -hex 32)"
  elif command -v python3 >/dev/null 2>&1; then
    secret="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
    )"
  else
    die "Missing required command to generate EMAIL_PREFERENCES_SECRET: install openssl or python3"
  fi
  upsert_env "EMAIL_PREFERENCES_SECRET" "$secret"
fi

log "Ensuring NODE_ENV is set to production (payments + webhooks rely on it in some modules)..."
ensure_env_default "NODE_ENV" "production"

log "Ensuring required production flags are set (Conekta + client URL)..."
upsert_env "CLIENT_URL" "https://thebearbeat.com"
# Only set defaults; don't override manual disables (critical during incident response).
ensure_env_default "CONEKTA_PBB_ENABLED" "1"
ensure_env_default "CONEKTA_OXXO_ENABLED" "1"

log "Ensuring Amazon SES env vars are set (email sending)..."
# Non-secret defaults. Credentials can be injected below or set directly in backend/.env.
ensure_env_default "AWS_REGION" "us-east-2"
ensure_env_default "SES_FROM_EMAIL" "noreply@thebearbeat.com"
ensure_env_default "SES_FROM_NAME" "Bear Beat"
ensure_env_default "PUBLIC_API_URL" "https://thebearbeatapi.lat"

log "Optionally injecting AWS SES credentials from deploy environment..."
# Usage (avoid printing secrets):
#   DEPLOY_AWS_ACCESS_KEY_ID="AKIA..." \\
#   DEPLOY_AWS_SECRET_ACCESS_KEY="..." \\
#   ./deploy.sh
if [ -n "${DEPLOY_AWS_ACCESS_KEY_ID:-}" ]; then
  upsert_env "AWS_ACCESS_KEY_ID" "${DEPLOY_AWS_ACCESS_KEY_ID}"
fi
if [ -n "${DEPLOY_AWS_SECRET_ACCESS_KEY:-}" ]; then
  upsert_env "AWS_SECRET_ACCESS_KEY" "${DEPLOY_AWS_SECRET_ACCESS_KEY}"
fi

log "Optionally injecting Stripe OXXO secrets from deploy environment..."
# Usage (avoid printing secrets):
#   DEPLOY_STRIPE_OXXO_KEY="sk_live_..." \\
#   DEPLOY_STRIPE_OXXO_WH_PI_SECRET="whsec_..." \\
#   ./deploy.sh
if [ -n "${DEPLOY_STRIPE_OXXO_KEY:-}" ]; then
  upsert_env "STRIPE_OXXO_KEY" "${DEPLOY_STRIPE_OXXO_KEY}"
fi
if [ -n "${DEPLOY_STRIPE_OXXO_WH_PI_SECRET:-}" ]; then
  upsert_env "STRIPE_OXXO_WH_PI_SECRET" "${DEPLOY_STRIPE_OXXO_WH_PI_SECRET}"
fi
# Default free trial config (Stripe only). Override in backend/.env if needed.
ensure_env_default "BB_TRIAL_DAYS" "7"
ensure_env_default "BB_TRIAL_GB" "100"
ensure_env_default "AUTOMATION_EMAIL_MAX_PER_RUN" "120"
ensure_env_default "AUTOMATION_EMAIL_TRIAL_NO_DOWNLOAD_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_PAID_NO_DOWNLOAD_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_REGISTERED_NO_PURCHASE_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_ACTIVE_NO_DOWNLOAD_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_VERIFY_WHATSAPP_24H_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_CHECKOUT_ABANDONED_1H_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_CHECKOUT_ABANDONED_24H_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_TRIAL_EXPIRING_24H_TEMPLATE_ID" "1"
ensure_env_default "AUTOMATION_EMAIL_PLANS_OFFER_TEMPLATE_ID" "1"
ensure_env_default "TRACK_METADATA_SCAN_ON_BOOT" "0"
ensure_env_default "TRACK_METADATA_SCAN_INTERVAL_MINUTES" "60"
ensure_env_default "TRACK_METADATA_SPOTIFY_ENABLED" "0"
ensure_env_default "TRACK_METADATA_SPOTIFY_SCAN_ON_REBUILD" "0"
ensure_env_default "TRACK_METADATA_SPOTIFY_SCAN_MAX" "400"
ensure_env_default "TRACK_METADATA_SPOTIFY_MAX_PER_CALL" "6"
ensure_env_default "TRACK_METADATA_SPOTIFY_MISS_RETRY_HOURS" "24"

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
# Production already has one failed migration attempt for this id. Resolve it first
# (no-op if not present) and then run deploy normally.
( cd "$BACKEND_DIR" && npx prisma migrate resolve --rolled-back 20260211130500_add_track_metadata_index >/dev/null 2>&1 || true )
( cd "$BACKEND_DIR" && npx prisma migrate deploy )

log "Ensuring PayPal webhook IDs are configured..."
( cd "$BACKEND_DIR" && npm run paypal:webhooks:ensure )

log "Building backend..."
( cd "$BACKEND_DIR" && npm run build )

log "Refreshing track metadata index (non-blocking if unavailable)..."
if grep -q '^SONGS_PATH=' "$ENV_FILE"; then
  if ! ( cd "$BACKEND_DIR" && npm run metadata:scan ); then
    log "Warning: metadata:scan failed; continuing deploy."
  fi
else
  log "Skipping metadata:scan (SONGS_PATH not configured)."
fi

if grep -q '^TRACK_METADATA_SPOTIFY_ENABLED=1' "$ENV_FILE"; then
  log "Backfilling Spotify covers for track metadata (optional)..."
  if ! ( cd "$BACKEND_DIR" && npm run metadata:spotify-covers ); then
    log "Warning: metadata:spotify-covers failed; continuing deploy."
  fi
fi

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
