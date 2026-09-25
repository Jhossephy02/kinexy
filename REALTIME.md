# Actualización en tiempo real

Kinexy mantiene un canal SSE autenticado en `GET /api/events`. El frontend lo abre al iniciar sesión, reconecta automáticamente cuando cambia la red y recibe eventos sin recargar la página.

Se actualizan inmediatamente:

- mensajes, conversaciones, lectura y burbuja “está escribiendo”;
- saldo, tips, aportes, desbloqueos y solicitudes Yape;
- perfiles, publicaciones, comentarios y me gusta;
- colas de aprobación, avisos y paneles de moderación;
- Creator Studio, directorio y ficha pública.

Nginx debe usar la configuración incluida en `deploy/nginx-frontend.conf`. La ruta `/api/events` tiene `proxy_buffering off` y un tiempo de lectura de una hora. Después de copiarla al servidor:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

El polling de 60 segundos queda solamente como respaldo si una red móvil interrumpe el canal.
