#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/kinexy}"
ENV_FILE="$APP_DIR/backend/.env"
GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-833887082629-5apktee9ltdbvjsblegr689olfn1ts2a.apps.googleusercontent.com}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "No existe $ENV_FILE" >&2
  exit 1
fi

cp "$ENV_FILE" "$ENV_FILE.before-google-oauth"
if grep -q '^GOOGLE_CLIENT_ID=' "$ENV_FILE"; then
  sed -i "s|^GOOGLE_CLIENT_ID=.*|GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID|" "$ENV_FILE"
else
  printf '\nGOOGLE_CLIENT_ID=%s\n' "$GOOGLE_CLIENT_ID" >> "$ENV_FILE"
fi

cd "$APP_DIR/backend"
pm2 restart kinexy-api --update-env
sleep 2
curl -fsS http://127.0.0.1:8000/api/ready | grep -q '"google_oauth":true'
status="$(curl -sS -o /tmp/kinexy-google-oauth-check.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"credential":"invalid-deployment-check"}' \
  http://127.0.0.1:8000/api/auth/google)"
test "$status" = "401"
rm -f /tmp/kinexy-google-oauth-check.json
echo "Google OAuth quedó activo en Kinexy."
