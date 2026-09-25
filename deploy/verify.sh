#!/usr/bin/env bash
set -euo pipefail
PUBLIC_URL="${PUBLIC_URL:-https://kinexy.grupoamayo.com}"
API_URL="${API_URL:-https://api.kinexy.grupoamayo.com}"

printf '\n[1/7] PM2\n'
pm2 describe kinexy-api >/dev/null
test "$(pm2 pid kinexy-api | tail -n 1 | tr -d '[:space:]')" != "0"
printf 'Proceso kinexy-api activo\n'
printf '\n[2/7] API local y PostgreSQL\n'
ready="$(curl -fsS http://127.0.0.1:8000/api/ready)"
grep -q '"database":"postgres"' <<<"$ready"
grep -q '"uploads_writable":true' <<<"$ready"
grep -q '"google_oauth":true' <<<"$ready"
printf 'API local lista con PostgreSQL\n'
printf '\n[3/7] API pública\n'
curl -fsS "$API_URL/api/ready" | grep -q '"database":"postgres"'
printf 'API pública lista con PostgreSQL\n'
printf '\n[4/7] Frontend + proxy API\n'
curl -fsSI "$PUBLIC_URL" | grep -qi '^HTTP/.* 200'
curl -fsS "$PUBLIC_URL/api/ready" | grep -q '"database":"postgres"'
curl -fsS "$PUBLIC_URL/api/ready" | grep -q '"uploads_writable":true'
printf '\n[5/7] Archivos y cabeceras\n'
test -r /www/wwwroot/kinexy/backend/.env
test -w /www/wwwroot/kinexy/backend/uploads
missing_status="$(curl -sS -o /tmp/kinexy-missing-upload.json -w '%{http_code}' "$PUBLIC_URL/uploads/kinexy-verification-missing.png")"
test "$missing_status" = "404"
grep -qi '^x-content-type-options: nosniff' < <(curl -fsSI "$PUBLIC_URL")
printf 'Entorno y uploads listos\n'

printf '\n[6/7] Google OAuth\n'
oauth_status="$(curl -sS -o /tmp/kinexy-google-oauth-check.json -w '%{http_code}' \
  -H 'Content-Type: application/json' \
  -d '{"credential":"invalid-deployment-check"}' \
  "$PUBLIC_URL/api/auth/google")"
test "$oauth_status" = "401"
grep -q 'No se pudo verificar' /tmp/kinexy-google-oauth-check.json
rm -f /tmp/kinexy-google-oauth-check.json /tmp/kinexy-missing-upload.json
printf 'Google OAuth configurado en frontend y API\n'

printf '\n[7/7] Estado de pagos\n'
curl -fsS "$PUBLIC_URL/api/payments/yape/packs"
printf '\nVerificación técnica completada. Si Yape aparece disabled, configura los precios antes de cobrar.\n'
