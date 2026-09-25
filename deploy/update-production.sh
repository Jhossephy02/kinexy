#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/kinexy}"
BACKEND_DIR="$APP_DIR/backend"

bash "$APP_DIR/deploy/preflight.sh"
bash "$APP_DIR/deploy/backup.sh"

cd "$BACKEND_DIR"
npm ci --omit=dev

UPLOAD_DIR_VALUE="$(node -e "require('dotenv').config(); process.stdout.write(process.env.UPLOAD_DIR || '')")"
process_pid="$(pm2 pid kinexy-api | tail -n 1 | tr -d '[:space:]')"
if [[ "$process_pid" =~ ^[0-9]+$ ]] && [[ "$process_pid" != "0" ]]; then
  process_user="$(ps -o user= -p "$process_pid" | xargs)"
  process_group="$(id -gn "$process_user")"
  chown -R "$process_user:$process_group" "$UPLOAD_DIR_VALUE"
fi
chmod 750 "$UPLOAD_DIR_VALUE"
chmod 600 "$BACKEND_DIR/.env"

pm2 restart kinexy-api --update-env
pm2 save
nginx -t
systemctl reload nginx
sleep 3
bash "$APP_DIR/deploy/verify.sh"

printf '\nActualización aplicada y verificada.\n'
