#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/kinexy}"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
UPLOAD_DIR="$BACKEND_DIR/uploads"
CLIENT_ID="833887082629-5apktee9ltdbvjsblegr689olfn1ts2a.apps.googleusercontent.com"

test -f "$ENV_FILE" || { echo "No existe $ENV_FILE" >&2; exit 1; }
cp "$ENV_FILE" "$ENV_FILE.before-oauth-and-uploads"

set_env() {
  local key="$1" value="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${value}|" "$ENV_FILE"
  else
    printf '\n%s=%s\n' "$key" "$value" >> "$ENV_FILE"
  fi
}

set_env GOOGLE_CLIENT_ID "$CLIENT_ID"
set_env OWNER_SUPERADMIN_EMAIL "mjhossephy@gmail.com"
set_env UPLOAD_DIR "$UPLOAD_DIR"
set_env MAX_FILE_SIZE "8388608"

mkdir -p "$UPLOAD_DIR"
process_pid="$(pm2 pid kinexy-api | tail -n 1 | tr -d '[:space:]')"
if [[ "$process_pid" =~ ^[0-9]+$ ]] && [[ "$process_pid" != "0" ]]; then
  process_user="$(ps -o user= -p "$process_pid" | xargs)"
  process_group="$(id -gn "$process_user")"
  chown -R "$process_user:$process_group" "$UPLOAD_DIR"
fi
chmod 750 "$UPLOAD_DIR"

cd "$BACKEND_DIR"
pm2 restart kinexy-api --update-env
sleep 3

ready="$(curl -fsS http://127.0.0.1:8000/api/ready)"
grep -q '"database":"postgres"' <<<"$ready"
grep -q '"google_oauth":true' <<<"$ready"
grep -q '"uploads_writable":true' <<<"$ready"
echo "OAuth y almacenamiento de imágenes están activos."
