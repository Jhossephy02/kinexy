#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/www/wwwroot/kinexy}"
BACKEND_DIR="$APP_DIR/backend"
ENV_FILE="$BACKEND_DIR/.env"
FRONTEND_URL="${FRONTEND_URL:-https://kinexy.grupoamayo.com}"

fail() { printf 'ERROR: %s\n' "$1" >&2; exit 1; }
ok() { printf 'OK: %s\n' "$1"; }

for command in node npm pm2 curl nginx pg_dump; do
  command -v "$command" >/dev/null 2>&1 || fail "falta el comando $command"
done
ok "Node, npm, PM2, curl, Nginx y PostgreSQL están instalados"

test -d "$BACKEND_DIR" || fail "no existe $BACKEND_DIR"
test -f "$ENV_FILE" || fail "no existe $ENV_FILE"
test -f "$APP_DIR/frontend/dist/index.html" || fail "falta frontend/dist/index.html"

NODE_ENV_VALUE="$(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); process.stdout.write(process.env.NODE_ENV || '')")"
DATABASE_URL_VALUE="$(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); process.stdout.write(process.env.DATABASE_URL || '')")"
JWT_VALUE="$(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); process.stdout.write(process.env.JWT_SECRET || '')")"
GOOGLE_VALUE="$(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); process.stdout.write(process.env.GOOGLE_CLIENT_ID || '')")"
OWNER_VALUE="$(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); process.stdout.write(process.env.OWNER_SUPERADMIN_EMAIL || '')")"
UPLOAD_VALUE="$(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); process.stdout.write(process.env.UPLOAD_DIR || '')")"

test "$NODE_ENV_VALUE" = "production" || fail "NODE_ENV debe ser production"
test -n "$DATABASE_URL_VALUE" || fail "DATABASE_URL está vacío"
test ${#JWT_VALUE} -ge 32 || fail "JWT_SECRET debe tener al menos 32 caracteres"
[[ "$JWT_VALUE" != *REEMPLAZAR* ]] || fail "JWT_SECRET conserva un valor de ejemplo"
test -n "$GOOGLE_VALUE" || fail "GOOGLE_CLIENT_ID está vacío"
test "$OWNER_VALUE" = "mjhossephy@gmail.com" || fail "OWNER_SUPERADMIN_EMAIL debe ser mjhossephy@gmail.com"
test -n "$UPLOAD_VALUE" || fail "UPLOAD_DIR está vacío"
test -d "$UPLOAD_VALUE" || fail "no existe UPLOAD_DIR: $UPLOAD_VALUE"
test -w "$UPLOAD_VALUE" || fail "el proceso actual no puede escribir en UPLOAD_DIR"
ok "variables obligatorias y almacenamiento validados"

(cd "$BACKEND_DIR" && node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.PGSSL==='true'?{rejectUnauthorized:false}:false}); p.query('SELECT 1').then(()=>p.end()).catch(e=>{console.error(e.message);process.exit(1)})") || fail "PostgreSQL no responde"
ok "PostgreSQL responde"

available_kb="$(df -Pk "$APP_DIR" | awk 'NR==2 {print $4}')"
test "${available_kb:-0}" -ge 1048576 || fail "queda menos de 1 GB libre en el disco"
ok "espacio en disco suficiente"

nginx -t >/dev/null || fail "la configuración de Nginx es inválida"
curl -fsSI "$FRONTEND_URL" >/dev/null || fail "el dominio público no responde por HTTPS"
ok "Nginx y HTTPS responden"

printf '\nPreflight completado. Ya se puede ejecutar update-production.sh.\n'
