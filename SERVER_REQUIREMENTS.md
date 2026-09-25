# Requisitos para subir Kinexy al servidor

## Obligatorio antes del despliegue

- VPS Linux con acceso `root` o sudo.
- Node.js 20 LTS o superior, npm, PM2, Nginx, PostgreSQL 14+ y `pg_dump`.
- Al menos 1 GB libre para desplegar; reservar más espacio para fotos y respaldos.
- DNS y SSL válidos para `kinexy.grupoamayo.com` y `api.kinexy.grupoamayo.com`.
- Base PostgreSQL, usuario y contraseña exclusivos de Kinexy.
- `JWT_SECRET` aleatorio de al menos 64 caracteres.
- Contraseña inicial del superadministrador de al menos 12 caracteres.
- Client ID de Google con el origen `https://kinexy.grupoamayo.com` autorizado.
- `OWNER_SUPERADMIN_EMAIL=mjhossephy@gmail.com`; esta cuenta se conserva como superadministrador protegido.
- Directorio `/www/wwwroot/kinexy/backend/uploads` escribible por el usuario de PM2.

## Decisiones comerciales necesarias

- Precios de los paquetes de tokens en soles (`YAPE_PRICE_40`, `YAPE_PRICE_80`, `YAPE_PRICE_180`, `YAPE_PRICE_460`).
- Persona o equipo responsable de aprobar pagos Yape desde moderación.
- Procedimiento para comprobar código de operación y evitar fraude o reutilización.
- Política de devoluciones, contracargos y liquidación a creadores.
- Confirmar si la activación de creadoras seguirá gratis (`CREATOR_ACTIVATION_FREE=true`).

## Servicios externos recomendados antes de crecer

- Almacenamiento S3/R2 para no depender del disco de una sola VPS.
- Correo transaccional para recuperación de contraseña y avisos de seguridad.
- Monitoreo de disponibilidad y errores (UptimeRobot, Better Stack o Sentry).
- Servicio de verificación de identidad y mayoría de edad.
- Antivirus/moderación de archivos y revisión de contenido.
- Backups fuera de la VPS y prueba documentada de restauración.

## Orden de instalación

1. Descomprimir el paquete en `/www/wwwroot/kinexy`.
2. Crear PostgreSQL y completar `backend/.env` desde `.env.production.example`.
3. Copiar/adaptar los bloques Nginx, emitir SSL y ejecutar `nginx -t`.
4. Instalar dependencias del backend con `npm ci --omit=dev`.
5. Arrancar `kinexy-api` con PM2.
6. Ejecutar `bash deploy/preflight.sh`.
7. Ejecutar `bash deploy/verify.sh`.
8. Probar manualmente registro, imagen, aprobación, Yape, tokens, chat y desbloqueo con cuentas separadas.

Después del primer arranque, ingresar con `mjhossephy@gmail.com` mediante Google. El backend elevará o conservará esa cuenta como `superadmin`; ninguna ruta administrativa permite degradarla o eliminarla.

## Criterio para abrir al público

No abrir pagos hasta que `verify.sh` termine correctamente, exista al menos un respaldo restaurable y se complete una transacción real de bajo valor desde solicitud hasta aprobación, acreditación y desbloqueo.
