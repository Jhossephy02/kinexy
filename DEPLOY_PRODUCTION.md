# Kinexy — paquete de producción

## Estructura
- `frontend/dist/`: React/Vite ya compilado. No requiere `node_modules` del frontend.
- `backend/`: API Node.js/Express y esquema PostgreSQL.
- `deploy/`: PM2, Nginx y verificación.

Dominios previstos:
- Frontend: `https://kinexy.grupoamayo.com`
- API: `https://api.kinexy.grupoamayo.com`

El frontend usa rutas relativas `/api` y `/uploads`. Por eso el Nginx del frontend también debe proxyear esas rutas a `127.0.0.1:8000`.

## 1. Descomprimir

```bash
mkdir -p /www/wwwroot/kinexy
cd /www/wwwroot/kinexy
unzip /ruta/kinexy-production-ready.zip
```

Al terminar deben existir directamente:

```text
/www/wwwroot/kinexy/backend
/www/wwwroot/kinexy/frontend
/www/wwwroot/kinexy/deploy
```

## 2. Backend

Node.js 20 LTS o superior recomendado.

```bash
cd /www/wwwroot/kinexy/backend
npm ci --omit=dev
cp .env.production.example .env
```

Editar `.env` y reemplazar los valores `REEMPLAZAR_*`.

Generar JWT:

```bash
openssl rand -hex 64
```

La base de datos esperada es PostgreSQL en `127.0.0.1:5432`, base `kinexy`, usuario `kinexy`.

Proteger el entorno:

```bash
chmod 600 /www/wwwroot/kinexy/backend/.env
mkdir -p /www/wwwroot/kinexy/backend/uploads
chmod 775 /www/wwwroot/kinexy/backend/uploads
```

## 3. PM2

```bash
npm install -g pm2
pm2 start /www/wwwroot/kinexy/deploy/ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Ejecutar también el comando adicional que imprima `pm2 startup`, y luego otra vez `pm2 save`.

Prueba local:

```bash
curl http://127.0.0.1:8000/api/ready
```

Debe indicar `status: ready` y `database: postgres`. Si PostgreSQL no responde, esta comprobación falla.

## 4. Nginx

Usar como referencia:
- `deploy/nginx-frontend.conf`
- `deploy/nginx-api.conf`

En aaPanel se pueden crear ambos sitios/subdominios y pegar sus bloques de `location`, o adaptar los vhosts que aaPanel genere.

Comprobar antes de recargar:

```bash
nginx -t
systemctl reload nginx
```

## 5. DNS y SSL

Crear registros A hacia la VPS para:

```text
kinexy.grupoamayo.com
api.kinexy.grupoamayo.com
```

Después emitir certificados Let's Encrypt desde aaPanel y activar Force HTTPS.

## 6. Comprobación previa y verificación

```bash
bash /www/wwwroot/kinexy/deploy/preflight.sh
bash /www/wwwroot/kinexy/deploy/verify.sh
```

Para actualizaciones posteriores, después de descomprimir la versión nueva sobre el proyecto:

```bash
bash /www/wwwroot/kinexy/deploy/update-production.sh
```

Este comando valida el entorno, crea un respaldo, instala dependencias, corrige permisos, reinicia PM2, recarga Nginx y ejecuta la verificación final.

## Google OAuth

El frontend ya está compilado con el Client ID incluido en `.env.production.example`. En Google Cloud Console deben autorizarse los orígenes/redirects de producción correspondientes a `https://kinexy.grupoamayo.com`.

## 7. Respaldo diario

El script `deploy/backup.sh` respalda PostgreSQL y uploads, y conserva 14 días por defecto. Prográmalo desde cron después de verificar manualmente una restauración.

```bash
chmod +x /www/wwwroot/kinexy/deploy/backup.sh
BACKUP_DIR=/var/backups/kinexy /www/wwwroot/kinexy/deploy/backup.sh
```

## 8. Prueba final antes de abrir al público

Ejecuta `node --test` dentro de `backend`, `npm audit --omit=dev` y `deploy/verify.sh`. Revisa además `PRODUCTION_READINESS.md`: allí se separa lo que ya está preparado de las credenciales y servicios externos todavía necesarios.

Consulta también `SERVER_REQUIREMENTS.md` para la lista de credenciales, decisiones comerciales y servicios que todavía debe proporcionar el propietario.
