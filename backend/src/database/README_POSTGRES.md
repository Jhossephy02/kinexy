# PostgreSQL para Kinexy

No se detectó `psql` instalado en este equipo. El backend ya tiene la conexión preparada mediante `pg` y usa JSON local mientras `DATABASE_URL` esté vacío o PostgreSQL no responda.

## Crear la base de datos

Desde `psql` o pgAdmin:

```sql
CREATE DATABASE kinexy;
```

Después, configurar `backend/.env`:

```env
DATABASE_URL=postgresql://USUARIO:CONTRASEÑA@localhost:5432/kinexy
PGSSL=false
```

Al iniciar el backend se crean automáticamente las tablas `users` y `profiles`. También se puede ejecutar:

```powershell
cd backend
npm run seed
```

El seed inserta tres usuarios demo con contraseñas cifradas y seis perfiles iniciales. El esquema SQL completo está en [schema.sql](./schema.sql).

## Comportamiento de conexión

- Con `DATABASE_URL` válido: usa PostgreSQL y muestra `[DB: postgres]`.
- Sin PostgreSQL disponible: usa `backend/data/kinexy.json` y muestra `[DB: json]`.
- Las rutas API no cambian entre ambos modos, por lo que el panel anunciante puede construirse ahora sin bloquear el trabajo por la instalación de PostgreSQL.
