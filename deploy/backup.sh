#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/kinexy}"
APP_DIR="${APP_DIR:-/www/wwwroot/kinexy}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

if [[ ! -r "$APP_DIR/backend/.env" ]]; then
  echo "No se puede leer $APP_DIR/backend/.env" >&2
  exit 1
fi

DATABASE_URL="$(cd "$APP_DIR/backend" && node -e "require('dotenv').config(); process.stdout.write(process.env.DATABASE_URL || '')")"
test -n "$DATABASE_URL" || { echo "DATABASE_URL no está configurado" >&2; exit 1; }

pg_dump --format=custom --no-owner --file="$BACKUP_DIR/kinexy-$STAMP.dump" "$DATABASE_URL"
tar -czf "$BACKUP_DIR/kinexy-uploads-$STAMP.tar.gz" -C "$APP_DIR/backend" uploads
test -s "$BACKUP_DIR/kinexy-$STAMP.dump"
test -s "$BACKUP_DIR/kinexy-uploads-$STAMP.tar.gz"
find "$BACKUP_DIR" -type f -mtime +14 -delete
echo "Respaldo creado: $STAMP"
