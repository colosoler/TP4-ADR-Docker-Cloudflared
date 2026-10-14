# Módulo 1 — Docker Compose, base de datos y Modelos

**Responsable:** ___ · **Revisás los PR de:** M2 · **Te revisa:** M5
Antes de empezar, leé [00-plan-general.md](00-plan-general.md) §2, §5.1, §5.2 y §5.6.

**En una frase:** armás el `docker-compose.yml` que levanta todo, la base de datos con un usuario de permisos mínimos y el CRUD de Modelos.

---

## Día 1 — Docker Compose y base de datos

**Archivos:** `docker-compose.yml`, `.env.example`, `.gitignore`, `.gitattributes`, `db/init/00_roles.sh`.

**1. `.gitignore`:** agregale `coverage/` y `*.log` a lo que ya tiene.

**2. `.gitattributes`:** fuerza fin de línea LF. Sin esto, el `.sh` se rompe en Windows.

```gitattributes
* text=auto
*.sh text eol=lf
*.sql text eol=lf
*.conf text eol=lf
Dockerfile text eol=lf
```

**3. `.env.example`:** copiá el bloque de §5.2. Después creá tu `.env` a partir de él, con claves de verdad.

**4. `db/init/00_roles.sh`:** crea el usuario que usa el backend. Puede leer y escribir filas, pero **no** crear ni borrar tablas.

```sh
#!/bin/sh
set -e
psql -v ON_ERROR_STOP=1 -v app_user="$APP_DB_USER" -v app_password="$APP_DB_PASSWORD" \
     -v db_name="$POSTGRES_DB" --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
EOSQL
```

**5. `docker-compose.yml`:** tiene que cumplir todo §5.1.

| Servicio | Qué lleva |
|---|---|
| `db` | `image: postgres:17-alpine`; `environment` con las 5 variables del `.env` (`${VAR}`); volúmenes `db_data:/var/lib/postgresql/data` y `./db/init:/docker-entrypoint-initdb.d:ro`; `networks: [data_net]` |
| `backend` | `build: ./backend`; las variables `PG*`, `PORT` y `NODE_ENV` de §5.2; `depends_on: db` (healthy); `networks: [data_net, app_net]` |
| `frontend` | `build: ./frontend`; `networks: [edge_net]` |
| `proxy` | `build: ./proxy`; `ports: ["8080:8080"]` (**el único puerto**); `depends_on` de `backend` y `frontend` (healthy); `networks: [edge_net, app_net]` |

Todos llevan su `container_name` de §5.1 y `restart: unless-stopped`. El servicio `cloudflared` lo agrega M5.

```yaml
name: concesionaria

services:
  db:
    # ...
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]   # $$ = lo resuelve el contenedor
      interval: 5s
      timeout: 3s
      retries: 10

networks:
  edge_net: {}
  app_net: { internal: true }
  data_net: { internal: true }

volumes:
  db_data: {}
```

**Listo cuando:**

```bash
docker compose config --quiet                                   # sin errores
docker compose up -d --build && docker compose ps               # db, backend, frontend, proxy (healthy)
docker compose ps --format "table {{.Name}}\t{{.Ports}}"        # solo el proxy tiene puerto
docker network inspect concesionaria_data_net --format "{{.Internal}}"   # true
docker exec concesionaria_db psql -U concesionaria_app -d concesionaria -c "create table x (id int)"
#   → tiene que fallar: permission denied for schema public
```

---

## Día 2 — CRUD de Modelos

Seguí la **receta de §5.7**. Lo propio de tu entidad:

| Campo | Validación zod |
|---|---|
| `nombre` | trim, 1–40 caracteres |
| `segmento` | `'sedan'`, `'hatchback'` o `'suv'` |
| `precioBase` | número positivo |
| `activo` | boolean, por defecto `true` |

**Mensajes:**
- `404`: "Modelo no encontrado".
- `409` (cuando `err.constraint === 'modelos_nombre_key'`): "Ya existe un modelo con ese nombre".

**Datos de ejemplo:**

| Nombre | Segmento | Precio base | Activo |
|---|---|---|---|
| City | sedan | 32.000.000 | sí |
| Civic | sedan | 52.000.000 | sí |
| HR-V | suv | 42.000.000 | sí |
| ZR-V | suv | 50.000.000 | sí |
| CR-V | suv | 68.000.000 | sí |
| Fit | hatchback | 25.000.000 | **no** |

**Test 3:** `POST` con `segmento: 'pickup'` → `400`.

**Pantalla `/modelos`:** columnas Nombre · Segmento · Precio base (`formatPrecio`) · Activo · Acciones.

---

## Día 3 — Endurecer la base

Agregá esto al servicio `db`:

```yaml
    cap_drop: [ALL]
    cap_add: [CHOWN, DAC_OVERRIDE, FOWNER, SETGID, SETUID]   # lo mínimo para que arranque Postgres
    security_opt: [no-new-privileges:true]
    read_only: true
    tmpfs: [/tmp, /var/run/postgresql]
    mem_limit: 512m
    pids_limit: 200
```

**Listo cuando:**
- `db` sigue `healthy`;
- `docker exec concesionaria_db touch /etc/x` falla con `Read-only file system`;
- el chaos test de M5 pasa.

**Para la exposición:** sacá una capability por vez, anotá con qué error falla Postgres y volvé a ponerla.

---

## Día 4 — Exposición: "Docker desde cero"

Slides:
- Qué problema resuelve Docker.
- Contenedor vs máquina virtual.
- Imagen vs contenedor.
- Docker Compose.
- Volúmenes y nuestras 3 redes.

Demo: `docker compose up -d --build` y `docker compose ps`.

Para estudiar: `/sigma Explicame Docker desde cero (contenedor vs VM, imagen vs contenedor, Compose, volúmenes, redes internal) para exponerlo en 5 minutos.`

---

## Prompts útiles

- **Para arrancar cada día:** `Usá la skill writing-plans. La spec es el Día 1 de docs/plan/modulo-1-infra-db-modelos.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m1-dia1.md.`
- **Para revisar el rol de la base:** `Cargá supabase-postgres-best-practices y revisá db/init/00_roles.sh contra references/security-privileges.md.`
- **Si algo no levanta:** `Usá systematic-debugging: concesionaria_db no queda healthy. Logs: <pegar docker compose logs db>.`
- **Para el review de M2:** `Usá code-review-expert para revisar la rama de M2 contra main.`
