#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN="${1:-}"
SITE_ROOT="${2:-}"

if [[ ! "$DOMAIN" =~ ^([A-Za-z0-9-]+\.)+[A-Za-z]{2,63}$ ]]; then
  echo "Uso: $0 dominio.tld /ruta/absoluta/de/kinexy" >&2
  exit 1
fi

if [[ -z "$SITE_ROOT" || "$SITE_ROOT" != /* ]]; then
  echo "La ruta del sitio debe ser absoluta." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sed \
  -e "s|__DOMAIN__|${DOMAIN}|g" \
  -e "s|__SITE_ROOT__|${SITE_ROOT}|g" \
  "$SCRIPT_DIR/nginx-domain.template.conf"
