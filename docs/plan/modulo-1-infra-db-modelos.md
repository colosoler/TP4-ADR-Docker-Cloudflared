# Módulo 1 — Docker Compose, base de datos y Modelos

| | |
|---|---|
| **Responsable** | _(nombre)_ |
| **Revisás los PR de** | M2 |
| **Revisa tus PR** | M5 |
| **Contrato** | [00-plan-general.md](00-plan-general.md): leé §2, §5.1, §5.2, §5.6 y §5.9 antes de empezar |

## Tu módulo en una frase

Armás el **mapa del sistema**: el `docker-compose.yml` que levanta los contenedores con sus redes, volumen y healthchecks; la base de datos con un rol de mínimo privilegio; y el **CRUD de Modelos** (el catálogo de Honda).

## Entregables

- **Fase 0**
  - [ ] `docker-compose.yml`
  - [ ] `docker-compose.dev.yml`
  - [ ] `.env.example`
  - [ ] `.gitignore`
  - [ ] `.gitattributes`
  - [ ] `db/init/00_roles.sh`
- **Fase 1**
  - [ ] `db/init/01_modelos.sql`
  - [ ] `backend/src/modules/modelos/*`
  - [ ] `frontend/src/features/modelos/*`
- **Fase 2**
  - [ ] Hardening del servicio `db` en el compose
  - [ ] `scripts/db-backup.sh` y `.ps1`
  - [ ] `scripts/db-restore.sh` y `.ps1`
- **Fase 3**
  - [ ] Exposición: "Docker desde cero"

## Skills que vas a usar

| Skill | Cuándo | Prompt para copiar en Claude Code |
|---|---|---|
| `writing-plans` | Al empezar cada fase | `Usá la skill writing-plans. La spec es la Fase 0 de docs/plan/modulo-1-infra-db-modelos.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m1-fase0-compose.md.` (cambiá fase y nombre en cada fase) |
| `supabase-postgres-best-practices` | Fase 0 (roles) y Fase 1 (tabla) | `Cargá la skill supabase-postgres-best-practices y revisá db/init/00_roles.sh contra references/security-privileges.md: el rol de la app tiene que tener solo SELECT/INSERT/UPDATE/DELETE.` |
| `nodejs-typescript-app` | Fase 1 (API) | `Cargá la skill nodejs-typescript-app e implementá backend/src/modules/modelos siguiendo el patrón router → service del contrato (§5.8 de 00-plan-general.md).` |
| `test-driven-development` | Fase 1 (cada endpoint) | `Con la skill test-driven-development, escribí primero los tests de modelos.test.ts que lista mi documento de módulo, mostrame que fallan, y después implementá.` |
| `react-typescript-app` | Fase 1 (pantalla) | `Cargá la skill react-typescript-app y armá frontend/src/features/modelos usando los componentes compartidos de src/shared (DataTable, Modal, ConfirmDialog, FormField).` |
| `systematic-debugging` | Cuando algo no levanta | `Usá systematic-debugging: el contenedor concesionaria_db no queda healthy. Estos son los logs: <pegar docker compose logs db>.` |
| `verification-before-completion` | Antes de cada PR | `Usá verification-before-completion: corré los comandos de verificación de mi fase y armá la evidencia para pegar en el PR.` |
| `code-review-expert` | Cuando revisás a M2 | `Usá code-review-expert para revisar la rama m2/fase0-backend contra main.` |
| `sigma` | Fase 3 | Ver "Tu parte de la exposición". |

---

## Fase 0 — Docker Compose y base de datos (días 1–3)

### Archivos

```
docker-compose.yml
docker-compose.dev.yml
.env.example
.gitignore
.gitattributes
db/init/00_roles.sh
```

### Pasos

**1. `.gitignore`** (reemplaza el mínimo del Paso 0):

```gitignore
.env
backend/.env
node_modules/
dist/
coverage/
backups/
*.log
__pycache__/
.claude/settings.local.json
.DS_Store
```

**2. `.gitattributes`.** Evita el error `\r: command not found` en Windows:

```gitattributes
* text=auto
*.sh text eol=lf
*.sql text eol=lf
*.conf text eol=lf
Dockerfile text eol=lf
```

**3. `.env.example`:** copiá exactamente el bloque de §5.2 del contrato. Después creá tu `.env` local a partir de él, con claves de verdad.

**4. `db/init/00_roles.sh`.** Crea el rol que usa el backend, con permiso para leer y escribir filas pero **no** para crear, alterar o borrar tablas. Corre antes que los `.sql` porque los scripts van en orden alfabético. Las tablas las crea después el admin, y `ALTER DEFAULT PRIVILEGES` hace que el rol de la app reciba permisos sobre ellas automáticamente.

```sh
#!/bin/sh
set -e

psql -v ON_ERROR_STOP=1 \
     -v app_user="$APP_DB_USER" \
     -v app_password="$APP_DB_PASSWORD" \
     -v db_name="$POSTGRES_DB" \
     --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
CREATE ROLE :"app_user" LOGIN PASSWORD :'app_password';
GRANT CONNECT ON DATABASE :"db_name" TO :"app_user";
GRANT USAGE ON SCHEMA public TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO :"app_user";
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO :"app_user";
EOSQL
```

**5. `docker-compose.yml`.** Tiene que cumplir **todo** §5.1 del contrato. Por servicio:

| Servicio | Lo que tiene que tener |
|---|---|
| `db` | `image: postgres:17-alpine`; `container_name: concesionaria_db`; `environment` con `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `APP_DB_USER`, `APP_DB_PASSWORD` tomados del `.env` (`${VAR}`); volúmenes `db_data:/var/lib/postgresql/data` y `./db/init:/docker-entrypoint-initdb.d:ro`; healthcheck (abajo); `networks: [data_net]`; `restart: unless-stopped`; **sin `ports`** |
| `backend` | `build: ./backend`; `container_name: concesionaria_backend`; `environment` con `PGHOST=db`, `PGPORT=5432`, `PGDATABASE=${POSTGRES_DB}`, `PGUSER=${APP_DB_USER}`, `PGPASSWORD=${APP_DB_PASSWORD}`, `PORT=4000`, `NODE_ENV=production`; `depends_on: db: condition: service_healthy`; `networks: [data_net, app_net]`; `restart: unless-stopped`; **sin `ports`**. El healthcheck viene del Dockerfile de M2. |
| `frontend` | `build: ./frontend`; `container_name: concesionaria_frontend`; `networks: [edge_net]`; `restart: unless-stopped`; **sin `ports`**. El healthcheck viene del Dockerfile de M3. |
| `proxy` | `build: ./proxy`; `container_name: concesionaria_proxy`; `ports: ["8080:8080"]` (**el único**); `depends_on` de `backend` y `frontend`, ambos con `condition: service_healthy`; `networks: [edge_net, app_net]`; `restart: unless-stopped`. El healthcheck viene del Dockerfile de M4. |

`cloudflared` lo agrega M5 en su rama. Lo demás, arriba de todo y al final del archivo:

```yaml
name: concesionaria

services:
  db:
    # ...
    healthcheck:
      # $$ hace que la variable la resuelva el shell DEL CONTENEDOR, no compose
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10
      start_period: 10s

networks:
  edge_net: {}
  app_net:
    internal: true
  data_net:
    internal: true

volumes:
  db_data: {}
```

**6. `docker-compose.dev.yml`.** Solo para desarrollo. Una red `internal` no puede publicar puertos, por eso se suma `dev_net`, y el puerto se publica **solo en 127.0.0.1**:

```yaml
services:
  db:
    ports:
      - "127.0.0.1:5432:5432"
    networks: [data_net, dev_net]

networks:
  dev_net: {}
```

Uso: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db`.

**7. Probar el compose.**
- Mientras los demás terminan su Fase 0: `docker compose config --quiet` valida el YAML sin construir nada.
- Para integrar: hacé merge local de las ramas de M2, M3 y M4 en una rama de prueba, o esperá a que estén en `main`.

### Criterios de aceptación

- [ ] `docker compose config --quiet` termina sin errores.
- [ ] `docker compose up -d --build` → `docker compose ps` muestra `db`, `backend`, `frontend` y `proxy` como `(healthy)`.
- [ ] Solo el proxy publica un puerto.
- [ ] `data_net` y `app_net` son internas.
- [ ] El rol de la app existe y **no** puede crear tablas.
- [ ] Al borrar y recrear los contenedores (sin `-v`), los datos siguen en el volumen.

### Cómo verificarlo

```bash
docker compose config --quiet
docker compose up -d --build
docker compose ps

# Solo el proxy tiene puertos
docker compose ps --format "table {{.Name}}\t{{.Ports}}"

# Redes internas: tiene que imprimir true
docker network inspect concesionaria_data_net --format "{{.Internal}}"
docker network inspect concesionaria_app_net --format "{{.Internal}}"

# Rol de mínimo privilegio
docker exec concesionaria_db psql -U concesionaria_app -d concesionaria -c "select current_user"
docker exec concesionaria_db psql -U concesionaria_app -d concesionaria -c "create table prueba (id int)"
#   → tiene que fallar con: permission denied for schema public

# El volumen sobrevive
docker compose down && docker compose up -d
docker volume ls     # aparece concesionaria_db_data
```

---

## Fase 1 — CRUD de Modelos (días 4–9)

Es el mismo molde que siguen los otros 4 módulos (§5.7 del contrato).

### Tabla: `db/init/01_modelos.sql`

Copiá el DDL de `modelos` de §5.6 **tal cual** y agregá estos datos de ejemplo (los precios son ficticios):

| nombre | segmento | precio_base | activo |
|---|---|---|---|
| City | sedan | 32000000 | true |
| Civic | sedan | 52000000 | true |
| HR-V | suv | 42000000 | true |
| ZR-V | suv | 50000000 | true |
| CR-V | suv | 68000000 | true |
| Fit | hatchback | 25000000 | false |

Para que se aplique: `docker compose down -v && docker compose up -d --build`.

### Endpoints (`backend/src/modules/modelos/`)

| Método y ruta | Respuesta |
|---|---|
| `GET /api/modelos` | `200`, `order by nombre` |
| `GET /api/modelos/:id` | `200` o `404` "Modelo no encontrado" |
| `POST /api/modelos` | `201`; `400`; `409` "Ya existe un modelo con ese nombre" |
| `PUT /api/modelos/:id` | `200`, `400`, `404` o `409` |
| `DELETE /api/modelos/:id` | `204` o `404` |

Forma en el JSON:

```json
{ "id": 3, "nombre": "HR-V", "segmento": "suv", "precioBase": 42000000, "activo": true,
  "createdAt": "2026-10-14T15:00:00.000Z", "updatedAt": "2026-10-14T15:00:00.000Z" }
```

### Validaciones (`modelos.schema.ts`, zod)

Un solo esquema para `POST` y `PUT`:

| Campo | Regla |
|---|---|
| `nombre` | trim, 1–40 caracteres |
| `segmento` | `'sedan' \| 'hatchback' \| 'suv'`; mensaje "El segmento debe ser sedan, hatchback o suv" |
| `precioBase` | número positivo, máximo `9999999999.99` |
| `activo` | boolean; por defecto `true` |

Si el `insert` o el `update` tiran `23505` con `err.constraint === 'modelos_nombre_key'`, el service lanza `ConflictError('Ya existe un modelo con ese nombre')`.

### Tests (`modelos.test.ts`) — escribilos ANTES de implementar

Con Supertest contra `app` y `modelos.service` mockeado con `vi.mock`:

1. `GET /api/modelos` → `200` y devuelve el array del service.
2. `GET /api/modelos/abc` → `400`.
3. `GET /api/modelos/999` cuando el service lanza `NotFoundError` → `404` con `error.code === 'NOT_FOUND'`.
4. `POST` con `segmento: 'pickup'` → `400` y `error.details[0].path === 'segmento'`.
5. `POST` válido → `201` con el cuerpo que devuelve el service.
6. `POST` cuando el service lanza `ConflictError` → `409`.
7. `DELETE /api/modelos/1` → `204`.

### Pantalla (`frontend/src/features/modelos/`)

- **`ModelosPage.tsx`**
  - `DataTable` con columnas: Nombre · Segmento · Precio base (`formatPrecio`) · Estado (badge Activo/Inactivo) · Acciones (Editar, Eliminar).
  - Botón "Nuevo modelo" que abre `ModeloForm` en un `Modal`.
  - "Eliminar" abre `ConfirmDialog`.
- **`ModeloForm.tsx`**
  - Campos: nombre, segmento (select), precio base, activo (checkbox).
  - Los errores `400` y `409` de la API se muestran debajo de cada campo (`details[].path` → `FormField error`).
  - Al guardar: toast "Modelo guardado" e `invalidateQueries({ queryKey: ['modelos'] })`.

### Criterios de aceptación

- [ ] Los 7 tests pasan: `npm test --prefix backend`.
- [ ] En `http://localhost:8080/modelos` se puede listar, crear, editar y borrar.
- [ ] Un nombre repetido muestra "Ya existe un modelo con ese nombre" en el campo nombre.
- [ ] Con la base detenida, `curl -si http://localhost:8080/api/modelos` responde `503` `DB_UNAVAILABLE`.

---

## Fase 2 — Endurecer la base y backups (días 10–12)

### 1. Hardening del servicio `db` en `docker-compose.yml`

```yaml
  db:
    # ...lo de la Fase 0...
    cap_drop: [ALL]
    cap_add:          # lo mínimo para que el entrypoint de Postgres arranque
      - CHOWN         # chown del directorio de datos y del socket
      - DAC_OVERRIDE  # leer y escribir archivos de otro dueño durante el init
      - FOWNER        # chmod sobre archivos que no son de root
      - SETGID        # su-exec: pasar de root al usuario postgres
      - SETUID
    security_opt:
      - no-new-privileges:true
    read_only: true
    tmpfs:
      - /tmp
      - /var/run/postgresql
    shm_size: 128m
    mem_limit: 512m
    pids_limit: 200
```

- Si Postgres no arranca, usá `systematic-debugging`.
- Si el error es de permisos en `/var/run/postgresql`, probá con `- /var/run/postgresql:uid=70,gid=70` (en Alpine, `postgres` es el uid 70).
- **Para la exposición:** sacá una capability por vez, anotá con qué error falla y volvé a ponerla. Así podés explicar por qué está cada una.

### 2. Scripts de backup y restore (`scripts/`)

**PowerShell no puede redirigir `pg_dump -Fc` con `>`: corrompe el archivo binario.** Por eso el dump se genera dentro del contenedor y se copia con `docker cp`. Las variables `POSTGRES_USER` y `POSTGRES_DB` ya existen dentro del contenedor, así que el script no necesita leer el `.env`.

`scripts/db-backup.sh` (el `.ps1` hace los mismos pasos):

```sh
#!/bin/sh
set -e
mkdir -p backups
archivo="backups/concesionaria_$(date +%Y%m%d_%H%M%S).dump"
docker exec concesionaria_db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/backup.dump'
docker cp concesionaria_db:/tmp/backup.dump "$archivo"
docker exec concesionaria_db rm /tmp/backup.dump
echo "Backup guardado en $archivo"
```

`scripts/db-restore.sh <archivo>` hace el camino inverso:
1. `docker cp "$1" concesionaria_db:/tmp/restore.dump`
2. `docker exec concesionaria_db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists /tmp/restore.dump'`
3. Borra `/tmp/restore.dump` del contenedor.

### Criterios de aceptación

- [ ] `db` queda `(healthy)` con el hardening puesto.
- [ ] `docker inspect concesionaria_db --format "{{.HostConfig.CapDrop}} {{.HostConfig.CapAdd}} {{.HostConfig.ReadonlyRootfs}}"` muestra `[ALL]`, las 5 caps y `true`.
- [ ] `docker exec concesionaria_db touch /etc/prueba` falla con `Read-only file system`.
- [ ] Backup → borrar un modelo desde la UI → restore → el modelo vuelve a aparecer.
- [ ] El chaos test de M5 sigue pasando con el hardening.

---

## Review cruzado

Revisás los PR de **M2** (esqueleto del backend y Clientes) con `code-review-expert`. Fijate especialmente en:

- **SQL:** siempre parametrizado (`$1`), nunca concatenado.
- **`pool.ts`:** que tenga `pool.on('error')` y que los errores de conexión terminen en `503`.
- **Dockerfile:** multi-stage, `USER node`, sin `devDependencies` en la imagen final.
- **Secretos:** que no haya ninguno en el código.

---

## Tu parte de la exposición (≈5 min): Docker desde cero

Slides, siguiendo el estilo del TP de ejemplo:
1. ¿Qué problema resuelve Docker? ("en mi máquina funciona").
2. Contenedor vs máquina virtual.
3. Imagen vs contenedor.
4. Docker Compose: por qué y comandos esenciales.
5. Volúmenes (`db_data`) y redes. Explicá **nuestras 3 redes** con el diagrama del contrato y por qué la base queda aislada.

Demo: `docker compose up -d --build`, `docker compose ps` (todos healthy), y `docker compose down` / `up` mostrando que los datos siguen ahí.

Para estudiar: `/sigma Quiero entender Docker desde cero para exponerlo en 5 minutos: contenedores vs máquinas virtuales, imagen vs contenedor, Docker Compose, volúmenes y redes internal. Haceme preguntas hasta que lo pueda explicar sin leer.`

---

## Definition of Done del módulo

- [ ] Fase 0, Fase 1 y Fase 2 con todos sus criterios de aceptación en verde.
- [ ] Se cumple la Definition of Done general (§11 del contrato).
- [ ] `.env` no está en el repo; `.env.example` sí.
- [ ] Slides y demo listas y ensayadas.
