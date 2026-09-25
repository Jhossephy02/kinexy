# Estado de preparación para producción

## Verificado en este paquete

- Backend sin secretos reales ni base local incluida.
- PostgreSQL es obligatorio cuando `NODE_ENV=production`.
- El arranque rechaza un `JWT_SECRET` ausente, corto o de ejemplo.
- El administrador inicial exige una contraseña de al menos 12 caracteres.
- Rutas demo de acreditación deshabilitadas en producción.
- CORS limitado al dominio configurado en `FRONTEND_URL`.
- Nginx sirve la SPA, envía `/api` y `/uploads` al backend y añade cabeceras de seguridad.
- PM2 reinicia el proceso y limita memoria.
- Existe comprobación `/api/ready` que valida la conexión PostgreSQL.
- Opiniones, reportes, membresías, chat con aporte y tips ya no devuelven HTTP 501 bajo PostgreSQL.
- Estado social y de Creator Studio se conserva en PostgreSQL mediante `creator_store`; los movimientos de tokens se ejecutan en transacciones SQL.
- `npm audit --omit=dev`: 0 vulnerabilidades conocidas al generar el paquete.
- 8 pruebas de integración aprobadas.
- La ruta de Nginx para `/uploads/` usa `^~`, evitando que las fotografías sean interceptadas por la regla de archivos estáticos del frontend.
- Los límites de carga de Nginx y Express están alineados en 8 MB.
- `preflight.sh` comprueba herramientas, secretos, PostgreSQL, permisos, espacio, Nginx y HTTPS antes de actualizar.

## Valores externos que el propietario debe proporcionar

1. Acceso a la VPS/aaPanel y DNS de `grupoamayo.com`.
2. Contraseña nueva para PostgreSQL y valor aleatorio para `JWT_SECRET`.
3. Contraseña inicial del superadministrador.
4. Publicar/configurar OAuth en Google Cloud para `https://kinexy.grupoamayo.com`.
5. Precios reales de los paquetes Yape y procedimiento operativo para validar comprobantes.
6. Certificados TLS de Let's Encrypt para el dominio y subdominio API.
7. Correo transaccional, almacenamiento externo y monitoreo siguen siendo integraciones recomendadas; el paquete usa disco local para uploads.

## Riesgos operativos pendientes

- Yape funciona con aprobación manual. No verifica automáticamente una operación con el proveedor.
- Los uploads viven en la VPS; deben incluirse en backups y conviene migrarlos a almacenamiento de objetos antes de escalar a varias instancias.
- Chat y notificaciones usan sondeo HTTP, no WebSocket. Funcionan, pero no ofrecen entrega instantánea garantizada a gran escala.
- Las políticas legales, privacidad, verificación de identidad/edad, moderación y tratamiento fiscal deben revisarse con profesionales antes de abrir pagos al público.
- Debe realizarse una prueba en la VPS con PostgreSQL real, TLS y OAuth real antes de anunciar el servicio.
