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

log "Pulling latest changes..."
# Descartar cambios locales (ej. package-lock.json) para que pull no falle
git -C "$ROOT_DIR" reset --hard HEAD
git -C "$ROOT_DIR" pull --ff-only

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

log "Building backend..."
( cd "$BACKEND_DIR" && npm run build )

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
