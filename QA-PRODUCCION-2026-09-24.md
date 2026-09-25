# Auditoría funcional de producción — 24/09/2026

Sitio probado: `https://kinexy.grupoamayo.com`

## Resultado general

La API y PostgreSQL responden, el registro y varias funciones sociales operan. La beta no está lista para cobrar dinero ni recibir tráfico real hasta desplegar la reparación de almacenamiento y OAuth, activar un método de recarga y corregir la persistencia y el tiempo real del chat.

## Pruebas correctas

- Registro separado de cliente y creadora.
- Rechazo de menores de 18 años (`403`).
- Inicio de sesión tradicional y recuperación de sesión.
- Separación de roles; un cliente no accede a usuarios administrativos (`403`).
- Billeteras y consulta de historial.
- Perfil enviado a revisión y oculto mientras está pendiente.
- Publicación pública de texto.
- Comentarios, me gusta y lectura de mensajes.
- Chat desde creadora hacia cliente.
- Recepción del mensaje en la cuenta cliente sin recargar manualmente (consulta periódica de cuatro segundos).
- Vista de chat adaptable a 390 x 844 sin desbordamiento horizontal.
- Bloqueo del primer mensaje cliente-creadora hasta aportar 10 tokens (`402`).
- Rechazo de tips cuando no existe saldo (`409`).
- Rechazo de compra de membresía cuando no existe saldo (`409`).
- Recarga de demostración desactivada en producción (`404`).
- Solicitud semanal de publicación registrada como pendiente.
- Notificaciones de cliente y creadora.
- Transmisiones en vivo desactivadas (`410`).
- CORS no concede acceso a un origen ajeno.
- Las pruebas de rutas hacia `.env` devuelven el frontend y no exponen el archivo.
- Ocho pruebas automatizadas locales aprobadas.

## Fallos críticos reproducidos

1. **Imágenes:** un PNG válido devuelve `500`. El proceso de la API no puede escribir en `/www/wwwroot/kinexy/backend/uploads`.
2. **Google OAuth:** el frontend reconoce la cuenta, pero `/api/auth/google` devuelve `503` porque `GOOGLE_CLIENT_ID` no está cargado en el proceso de producción.
3. **Perfil roto:** la versión desplegada acepta rutas de fotos inexistentes. La corrección incluida exige que el archivo exista antes de crear el perfil.
4. **No hay forma de comprar tokens:** Yape responde como desactivado y no tiene paquetes configurados. Los pagos de membresía también informan `payments_enabled: false`. Los bloqueos por tokens funcionan, pero el cliente no puede cargar saldo para completarlos.
5. **No hay anuncios visibles:** el directorio público devuelve cero perfiles. El único perfil de QA permanece pendiente y la creadora no tiene un plan semanal aprobado.
6. **Chat no es tiempo real real:** los mensajes se consultan cada cuatro segundos. El indicador “escribiendo” usa `localStorage`, así que solo funciona dentro del mismo navegador y no entre dos usuarios o dispositivos.
7. **Persistencia incompleta en la versión desplegada:** mensajes, publicaciones y objetos sociales se mantienen en memoria del proceso. Un reinicio puede perderlos. El paquete reparado persiste estas colecciones en PostgreSQL mediante el estado de la aplicación.
8. **Archivos ausentes devuelven `500`:** `/uploads/qa-placeholder.png` responde error interno; debería responder `404`.
9. **Cabeceras del frontend:** la API entrega `X-Content-Type-Options: nosniff`, pero el documento HTML principal no la incluye. HTTPS y HSTS sí están activos.

## Cobertura por flujo

| Flujo | Resultado | Observación |
|---|---|---|
| Registro cliente/creadora | Correcto | Se crean roles separados |
| Control de mayoría de edad | Correcto | Menor rechazado con `403` |
| Login por correo | Correcto | Probado en ambas cuentas |
| Login con Google | Bloqueado | Falta variable del servidor |
| Subida de imagen | Roto | Devuelve `500` |
| Publicación de texto | Correcto | Se creó, comentó y dio me gusta |
| Publicación con foto | Bloqueado | Depende de la subida rota |
| Revisión moderador/admin | No verificable | No se proporcionaron credenciales administrativas válidas |
| Chat creadora a cliente | Parcial | Entrega por polling; sin indicador remoto real |
| Primer mensaje pagado | Bloqueo correcto | No puede completarse sin recarga activa |
| Tips | Bloqueo correcto | No puede completarse sin recarga activa |
| Fotos por tokens | No completable | No hay saldo comprable y falla la subida |
| Membresías | Parcial | Planes visibles; pagos desactivados |
| Plan semanal de creadora | Parcial | Solicitud pendiente; falta probar aprobación |
| Directorio público | Vacío | Cero perfiles publicados |
| Móvil | Correcto en chat | Sin desbordamiento a 390 px |

## Prioridad antes de publicar

1. Ejecutar la reparación del servidor y configurar `GOOGLE_CLIENT_ID`.
2. Corregir permisos de `backend/uploads` y verificar una subida real.
3. Activar Yape o una pasarela real y probar recarga, débito, tip y desbloqueo de extremo a extremo.
4. Aprobar un plan y un perfil desde moderación; comprobar que aparece en el directorio.
5. Desplegar persistencia de mensajes y reemplazar el indicador local por WebSocket/SSE.
6. Repetir la matriz con cuentas de moderador, administrador y superadministrador.

## Bloqueos esperados

- Un perfil pendiente no aparece en el directorio.
- Una creadora sin plan semanal aprobado no es pública.
- Cliente sin tokens no puede abrir chat, enviar tip ni desbloquear contenido.
- Una solicitud Yape necesita revisión de moderador antes de acreditar tokens o activar el plan.

## Datos creados para QA

- `qa.creator.full.1790228786977@kinexy.test`
- `qa.client.full.1790228786977@kinexy.test`
- Perfil temporal: `QA Perfil Full`
- Solicitud de plan con código prefijado `QA-`

Eliminar estos datos desde superadministración al cerrar la auditoría.

## Reparación

### Correcciones incluidas en el paquete v3

- El servidor devuelve `404` para archivos de `/uploads` que no existen.
- El indicador “Está escribiendo…” consulta el estado del otro usuario mediante la API y funciona entre navegadores/dispositivos.
- El frontend incluye su código fuente y una compilación de producción nueva.
- React Router se actualizó a `7.18.4`; las auditorías de dependencias de frontend y backend informan cero vulnerabilidades.
- La persistencia de mensajes, publicaciones y actividad social está incluida en el estado PostgreSQL de la aplicación.
- La validación impide crear perfiles o contenido privado con archivos inexistentes.
- La comprobación de disponibilidad informa si Google OAuth está configurado y si el directorio de cargas es escribible.

### Verificación local final

- 8 de 8 pruebas integrales aprobadas.
- Compilación Vite aprobada (76 módulos).
- Inicio, login, registro de creadora y API `/ready`: `200`.
- Archivo inexistente: `404`.
- Auditoría npm del frontend: 0 vulnerabilidades.
- Auditoría npm del backend: 0 vulnerabilidades.

Después de desplegar el paquete actualizado:

```bash
cd /www/wwwroot/kinexy
chmod +x deploy/repair-production.sh deploy/verify.sh
sudo bash deploy/repair-production.sh
sudo bash deploy/verify.sh
```
