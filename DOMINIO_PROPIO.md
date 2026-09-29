# Kinexy en dominio propio

Kinexy usa un solo dominio público para la web, API, archivos subidos y tiempo real. Esto evita errores de CORS, sesiones y fotos rotas.

Antes de publicar, apunta los registros DNS `A` de `tudominio.com` y `www.tudominio.com` a la IP de la VPS. Espera a que ambos resuelvan antes de emitir el certificado SSL.

En la VPS, desde la carpeta del proyecto, genera la configuración de Nginx. El siguiente comando solamente genera el archivo; no recarga Nginx:

```bash
cd /www/wwwroot/GA/DATAX/kinexy
bash deploy/render-domain-config.sh tudominio.com /www/wwwroot/GA/DATAX/kinexy > /tmp/kinexy-tudominio.com.conf
```

Revisa el archivo generado y configúralo como sitio en aaPanel con esa misma raíz: `/www/wwwroot/GA/DATAX/kinexy/frontend/dist`. Después emite SSL para `tudominio.com` y `www.tudominio.com` y fuerza HTTPS desde aaPanel.

En `backend/.env` cambia estas dos líneas y reinicia el API:

```env
FRONTEND_URL=https://tudominio.com
PUBLIC_BASE_URL=https://tudominio.com
```

```bash
cd /www/wwwroot/GA/DATAX/kinexy/backend
pm2 restart kinexy-api --update-env
pm2 save
```

En Google Cloud Console agrega `https://tudominio.com` y `https://www.tudominio.com` en **Authorized JavaScript origins** del cliente OAuth. No se necesita una URL de redirección adicional para el flujo actual de Kinexy.

Verifica al final:

```bash
curl -fsS https://tudominio.com/api/health
curl -I https://tudominio.com/uploads/
```

No borres el sitio anterior hasta haber comprobado inicio de sesión, Google, subida de foto, chat, billetera y WhatsApp en el dominio nuevo.
