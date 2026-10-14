# Concesionaria Honda La Plata — Plan general del TP

> **Proyecto académico.** No está afiliado a Honda Motor ni a ninguna concesionaria real. Los datos y precios son ficticios.

Este documento es **el contrato del grupo**: los nombres, puertos, rutas y tablas que todos respetan para que las piezas encajen. El TP dura **4 días**. Cada integrante tiene además su documento:

| Módulo | Documento | Infraestructura | CRUD |
|---|---|---|---|
| M1 | [modulo-1-infra-db-modelos.md](modulo-1-infra-db-modelos.md) | Docker Compose + base de datos | Modelos |
| M2 | [modulo-2-backend-clientes.md](modulo-2-backend-clientes.md) | Backend + resiliencia | Clientes |
| M3 | [modulo-3-frontend-autos.md](modulo-3-frontend-autos.md) | Frontend + aviso de caída | Autos |
| M4 | [modulo-4-proxy-seguridad-vendedores.md](modulo-4-proxy-seguridad-vendedores.md) | Reverse proxy + hardening | Vendedores |
| M5 | [modulo-5-cloudflare-chaos-sucursales.md](modulo-5-cloudflare-chaos-sucursales.md) | Cloudflare Tunnel + chaos test | Sucursales |

**Si algo de este contrato no te alcanza, no lo cambies en tu código:** avisá al grupo y se edita acá.

---

## 1. Qué construimos

Una app interna con **5 CRUD simples sobre tablas independientes**: Autos (stock), Modelos, Clientes, Vendedores y Sucursales.

El dominio es chico a propósito, como el CRUD de tareas del TP de ejemplo. Lo que importa es la infraestructura:

1. **Seguridad en capas:** Dockerfile + docker-compose + código.
2. **Un solo punto de entrada:** reverse proxy con Nginx.
3. **Resiliencia:** si la base se cae, el backend responde 503, sigue vivo y se recupera solo.
4. **Bonus:** la app se publica en internet con **Cloudflare Tunnel** (Quick Tunnel, sin cuenta ni dominio).

Sin GitHub Actions ni CI: todo se levanta con Docker Compose.

---

## 2. Arquitectura

```
                        Internet
                           │  https://<palabras-al-azar>.trycloudflare.com
                    ┌──────▼───────┐
                    │ cloudflared  │  conexión SALIENTE a Cloudflare (profile "tunnel")
                    └──────┬───────┘
  Navegador ───────────────┤  http://localhost:8080
               ┌───────────▼──────────┐   edge_net   ┌────────────┐
               │ proxy  (Nginx :8080) ├─────────────►│ frontend   │ Nginx sirve el build de React
               │ único puerto público │      /       └────────────┘
               └───────────┬──────────┘
                           │ /api/          app_net (internal: sin internet)
                    ┌──────▼──────┐
                    │ backend     │ Express + TypeScript (:4000)
                    └──────┬──────┘
                           │                data_net (internal: sin internet)
                    ┌──────▼──────┐
                    │ db          │ PostgreSQL (:5432) + volumen db_data
                    └─────────────┘
```

- **Un solo puerto:** solo el proxy publica uno al host (`8080`).
- **3 redes en vez de 2** (mejora sobre el TP de ejemplo): la base solo comparte red con el backend; ni el proxy ni el frontend llegan a ella.
- **Sin internet hacia adentro:** backend y base no tienen salida a internet. Solo `edge_net` la tiene, porque `cloudflared` la necesita.
- **Sin CORS:** el navegador habla siempre con un único origen.

---

## 3. Stack

**Nada de `latest`:** toda imagen lleva una versión fija, y el `package-lock.json` se commitea.

| Pieza | Tecnología | Imagen |
|---|---|---|
| Base de datos | PostgreSQL 17 | `postgres:17-alpine` |
| Backend | Node 24 + TypeScript + Express 5 + `pg` + `zod` 4; tests con Vitest + Supertest | `node:24-alpine` |
| Frontend | React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query 5 + React Router 7 | build: `node:24-alpine` |
| Frontend y proxy | Nginx no-root | `nginxinc/nginx-unprivileged:<mayor.menor>-alpine` (la misma en los dos) |
| Túnel | Cloudflare Tunnel | `cloudflare/cloudflared:<AAAA.M.P>` |

Las versiones de Nginx y cloudflared las fija quien las incorpora (M3, M4, M5), con la última estable de Docker Hub.

---

## 4. Estructura del repo y dueños

```
/
├── CLAUDE.md                          reglas para Claude Code
├── README.md                          M5
├── docker-compose.yml                 M1 (base y hardening de db) · M4 (hardening del resto) · M5 (servicio cloudflared)
├── .env.example  .gitignore  .gitattributes                         M1
├── db/init/00_roles.sh                M1  rol de la app con permisos mínimos
├── db/init/01_modelos.sql  02_clientes.sql  03_autos.sql  04_vendedores.sql  05_sucursales.sql   M1…M5
├── backend/                           M2 arma el esqueleto
│   └── src/
│       ├── index.ts  app.ts  config.ts  logger.ts  errors.ts           M2
│       ├── db/pool.ts  middleware/errorHandler.ts  shared/schemas.ts   M2
│       ├── routes/index.ts  routes/health.ts                           M2
│       └── modules/{modelos,clientes,autos,vendedores,sucursales}/     uno por módulo
├── frontend/                          M3 arma el esqueleto
│   └── src/
│       ├── main.tsx  App.tsx  api/client.ts  shared/                   M3
│       └── features/{modelos,clientes,autos,vendedores,sucursales}/    uno por módulo
├── proxy/Dockerfile  proxy/nginx.conf M4
├── scripts/chaos-test.*  scripts/tunnel-url.*                          M5
└── docs/plan/ (este plan)  docs/tareas/ (planes que genera cada uno con writing-plans)
```

**Regla para no pisarnos:**
- El día 1, M2 deja creadas las 5 carpetas de `backend/src/modules/` (con un router vacío ya registrado), y M3 hace lo mismo con las 5 páginas de `frontend/src/features/`.
- Desde el día 2, cada uno toca **solo su carpeta de backend, su carpeta de frontend y su archivo SQL**.

---

## 5. Contrato

### 5.1 Servicios

| Servicio | `container_name` | Puerto interno | Redes | Publica | Healthcheck |
|---|---|---|---|---|---|
| `db` | `concesionaria_db` | 5432 | `data_net` | no | `pg_isready` |
| `backend` | `concesionaria_backend` | 4000 | `data_net`, `app_net` | no | `GET /api/health` |
| `frontend` | `concesionaria_frontend` | 8080 | `edge_net` | no | `GET /` |
| `proxy` | `concesionaria_proxy` | 8080 | `edge_net`, `app_net` | **`8080:8080`** | `GET /healthz` |
| `cloudflared` | `concesionaria_tunnel` | — | `edge_net` | no | — |

- `data_net` y `app_net` son `internal: true`.
- El volumen `db_data` va montado en `/var/lib/postgresql/data`.
- `cloudflared` solo arranca con `--profile tunnel`.
- Orden de arranque (`depends_on` con `service_healthy`): db → backend → proxy (que también espera al frontend) → cloudflared.

### 5.2 Variables de entorno

El `.env` **nunca se commitea**. Lo que se sube es el `.env.example`:

```dotenv
POSTGRES_DB=concesionaria
POSTGRES_USER=concesionaria_admin
POSTGRES_PASSWORD=cambiar_esta_clave_admin
APP_DB_USER=concesionaria_app
APP_DB_PASSWORD=cambiar_esta_clave_app
```

El backend no lee el `.env`. En el compose recibe estas variables, que `pg` lee solo:
- `PGHOST=db`
- `PGPORT=5432`
- `PGDATABASE=${POSTGRES_DB}`
- `PGUSER=${APP_DB_USER}`
- `PGPASSWORD=${APP_DB_PASSWORD}`
- `PORT=4000`
- `NODE_ENV=production`

### 5.3 API

Los 5 recursos tienen los mismos 5 endpoints: `GET` · `GET /:id` · `POST` · `PUT /:id` · `DELETE /:id`. No hay filtros ni paginación.

| Recurso | Orden del listado | Dueño |
|---|---|---|
| `/api/modelos` | `order by nombre` | M1 |
| `/api/clientes` | `order by apellido, nombre` | M2 |
| `/api/autos` | `order by modelo, anio desc` | M3 |
| `/api/vendedores` | `order by apellido, nombre` | M4 |
| `/api/sucursales` | `order by nombre` | M5 |
| `/api/health` | solo `GET` (§5.5) | M2 |

**Convenciones:**
- JSON en camelCase y base en snake_case. El mapeo se hace con alias en el SQL: `precio_base as "precioBase"`.
- `PUT` reemplaza el registro completo.
- Cada `UPDATE` pone `updated_at = now()`.
- **SQL siempre parametrizado** (`$1`, `$2`).

| Caso | Código |
|---|---|
| `GET` / `PUT` OK | `200` |
| `POST` OK | `201` con el recurso creado |
| `DELETE` OK | `204` |
| Body o ID inválidos | `400` `VALIDATION_ERROR` |
| ID inexistente | `404` `NOT_FOUND` |
| Valor duplicado en un campo `unique` | `409` `CONFLICT` |
| Base caída | `503` `DB_UNAVAILABLE` (lo genera el backend) |
| Backend caído | `503` `BACKEND_UNAVAILABLE` (lo genera el proxy) |
| Otro error | `500` `INTERNAL_ERROR` (sin stack trace) |

### 5.4 Formato de error

Todos los errores tienen esta forma:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Datos inválidos",
             "details": [{ "path": "dni", "message": "El DNI debe tener 7 u 8 dígitos" }] } }
```

- `message` va en español y se le puede mostrar al usuario.
- `details` solo aparece en los `400`.

### 5.5 Health

`GET /api/health` responde **siempre `200`** mientras el proceso de Node esté vivo: `{ "status": "ok", "db": "up" }`. Con la base caída devuelve `"db": "down"`.

Así el healthcheck de Docker no mata al backend en el chaos test, y el frontend sabe cuándo volvió la base.

### 5.6 Tablas (DDL)

Son 5 tablas **independientes, sin claves foráneas**. Cada dueño copia su bloque **tal cual** a su archivo y agrega al final 4–6 filas de ejemplo (`insert`). Los emails de ejemplo usan `@example.com`.

```sql
-- db/init/01_modelos.sql  (M1)
create table modelos (
  id           bigint generated always as identity primary key,
  nombre       text not null unique check (length(nombre) between 1 and 40),
  segmento     text not null check (segmento in ('sedan', 'hatchback', 'suv')),
  precio_base  numeric(12,2) not null check (precio_base > 0),
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- db/init/02_clientes.sql  (M2)
create table clientes (
  id          bigint generated always as identity primary key,
  nombre      text not null check (length(nombre) between 1 and 60),
  apellido    text not null check (length(apellido) between 1 and 60),
  dni         text not null unique check (dni ~ '^[0-9]{7,8}$'),
  telefono    text check (length(telefono) between 6 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- db/init/03_autos.sql  (M3)
create table autos (
  id          bigint generated always as identity primary key,
  modelo      text not null check (length(modelo) between 1 and 40),
  anio        smallint not null check (anio between 2015 and 2030),
  color       text not null check (length(color) between 1 and 30),
  precio      numeric(12,2) not null check (precio > 0),
  estado      text not null default 'disponible' check (estado in ('disponible', 'reservado', 'vendido')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- db/init/04_vendedores.sql  (M4)
create table vendedores (
  id          bigint generated always as identity primary key,
  nombre      text not null check (length(nombre) between 1 and 60),
  apellido    text not null check (length(apellido) between 1 and 60),
  email       text not null unique check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- db/init/05_sucursales.sql  (M5)
create table sucursales (
  id          bigint generated always as identity primary key,
  nombre      text not null unique check (length(nombre) between 1 and 60),
  direccion   text not null check (length(direccion) between 1 and 100),
  localidad   text not null default 'La Plata' check (localidad in ('La Plata', 'City Bell', 'Gonnet', 'Berisso', 'Ensenada')),
  telefono    text check (length(telefono) between 6 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

### 5.7 Receta del CRUD (día 2): igual para los 5

Tu documento de módulo solo trae los datos propios de tu entidad: campos, validaciones, datos de ejemplo y mensaje de `409`.

1. **Tabla:** `db/init/0N_<entidad>.sql` con el DDL de §5.6 + datos de ejemplo. Para que se aplique: `docker compose down -v && docker compose up -d --build`.
2. **Backend** (`backend/src/modules/<entidad>/`):
   - `<entidad>.schema.ts`: **un** esquema zod para el body, que se usa en `POST` y en `PUT`.
   - `<entidad>.service.ts`: `list`, `getById`, `create`, `update` y `remove`, todos con `query()`. Si no existe el registro, `NotFoundError('… no encontrado')`. Si el SQL tira `23505`, `ConflictError('Ya existe …')`.
   - `<entidad>.routes.ts`: los 5 endpoints, con `idParamSchema` para el `:id`.
3. **4 tests** en `<entidad>.test.ts`, **escritos antes del código**: Vitest + Supertest contra `app`, con el service mockeado con `vi.mock`.
   1. `GET /api/<entidad>` → `200` con el array del service.
   2. `GET /api/<entidad>/999` cuando el service lanza `NotFoundError` → `404`.
   3. `POST` con un campo inválido → `400` y `error.details[0].path` igual a ese campo.
   4. `POST` válido → `201`.
4. **Frontend** (`frontend/src/features/<entidad>/`):
   - `types.ts` y `api.ts`.
   - `<Entidad>Page.tsx`: `DataTable` + botón "Nuevo" + Editar/Eliminar; eliminar pide confirmación con `ConfirmDialog`.
   - `<Entidad>Form.tsx`: dentro de un `Modal`. Los errores `400` y `409` se muestran en su campo. Al guardar: toast e `invalidateQueries`.
5. **Está listo cuando:**
   - los 4 tests pasan;
   - en `http://localhost:8080/<ruta>` se puede listar, crear, editar y borrar;
   - con la base detenida (`docker stop concesionaria_db`), `GET /api/<entidad>` responde `503 DB_UNAVAILABLE`.

### 5.8 Piezas compartidas

**Backend** (lo arma M2 el día 1):

```ts
// src/errors.ts
class AppError extends Error { statusCode: number; code: string; details?: { path: string; message: string }[] }
class NotFoundError extends AppError            // new NotFoundError('Sucursal no encontrada') → 404
class ConflictError extends AppError            // new ConflictError('Ya existe un cliente con ese DNI') → 409
class ServiceUnavailableError extends AppError  // 503 DB_UNAVAILABLE

// src/db/pool.ts — usar SIEMPRE query(), nunca pool.query directo (si no, la caída da 500 en vez de 503)
function query<T>(text: string, params?: unknown[]): Promise<T[]>;
function checkDb(): Promise<boolean>;

// src/shared/schemas.ts
const idParamSchema;   // const { id } = idParamSchema.parse(req.params)
```

**Cómo se valida:** con `schema.parse(req.body)` dentro del handler. El `errorHandler` convierte el `ZodError` en `400`. Express 5 ya pasa los errores `async` al `errorHandler`, así que no hace falta `asyncHandler`.

**Frontend** (lo arma M3 el día 1):

```ts
// src/api/client.ts — rutas relativas a /api: apiGet('/autos')
class ApiError extends Error { status: number; code: string; details?: { path: string; message: string }[] }
apiGet<T>(path) · apiPost<T>(path, body) · apiPut<T>(path, body) · apiDelete(path)

// src/shared/components
<DataTable rows columns rowKey loading emptyMessage />   // columns: { header, cell: (row) => ReactNode }[]
<Modal open onClose title> · <ConfirmDialog open title message onConfirm onCancel loading />
<FormField label htmlFor error>{input}</FormField>
useToast(): { showToast(message, type?: 'success' | 'error') }
formatPrecio(n): string   // "$ 42.500.000,00"
```

**Query keys y rutas del menú**, en este orden:

| Ruta | Query key | Nota |
|---|---|---|
| `/autos` | `['autos']` | es la home: `/` redirige acá |
| `/modelos` | `['modelos']` | |
| `/clientes` | `['clientes']` | |
| `/vendedores` | `['vendedores']` | |
| `/sucursales` | `['sucursales']` | |

### 5.9 Problemas conocidos

| Problema | Solución |
|---|---|
| Cambiaste un `.sql` y no se aplica | Los scripts de init solo corren con el volumen vacío: `docker compose down -v && docker compose up -d --build` (borra los datos). |
| `00_roles.sh` falla con `\r: command not found` | Tiene fin de línea CRLF de Windows. El `.gitattributes` lo fuerza a LF. Si ya lo tenías: borrá el archivo y ejecutá `git checkout -- db/init/00_roles.sh`. |
| Los IDs o precios llegan como texto | `pool.ts` registra los parsers de `pg` para `bigint` y `numeric` (M2). |
| Postgres o Nginx no arrancan con `read_only` | Postgres necesita tmpfs en `/var/run/postgresql` y `/tmp`; Nginx, en `/tmp`. |
| La CSP bloquea una fuente | Instalá las fuentes con `@fontsource/*`; nada de Google Fonts por URL. |
| Con la base caída el proxy devuelve `BACKEND_UNAVAILABLE` | No uses `proxy_intercept_errors`: el `503` del backend tiene que pasar tal cual. |
| `curl` se comporta raro en PowerShell | En PowerShell 5.1, `curl` es un alias de `Invoke-WebRequest`: usá `curl.exe`. |

---

## 6. Cronograma: 4 días

| Día | Qué hace cada uno | Hito del grupo |
|---|---|---|
| **1** | Su pieza de infraestructura (§4) | `docker compose up -d --build`: `http://localhost:8080` muestra el menú con las 5 secciones y `/api/health` responde 200. Con `--profile tunnel`, la URL pública también anda. |
| **2** | Su CRUD (§5.7) | Los 5 CRUD funcionan en localhost y por el túnel |
| **3** | Hardening y QA | Todo `healthy` con el hardening puesto, y `scripts/chaos-test` pasa |
| **4** | Slides y ensayo | Exposición ensayada con la demo en vivo |

- **M2 y M3 son urgentes el día 1:** el esqueleto del backend y el del frontend los usan todos el día 2.
- **Orden de merge del día 1:** M2 y M3 → M4 (proxy) → M1 (compose) → M5 (túnel).

---

## 7. Git

- **Ramas:** `m<N>/dia<D>-<tema>` (por ejemplo `m3/dia2-autos`), con PR a `main`.
- **Review cruzado** con la skill `code-review-expert`: M1 revisa a M2, M2 a M3, M3 a M4, M4 a M5 y M5 a M1. No se mergea con hallazgos P0 o P1.
- **Evidencia:** en el PR se pega la salida real de los comandos de verificación (skill `verification-before-completion`).
- **Nunca se commitea:** `.env`, `node_modules/` ni `dist/`.

---

## 8. Puesta en marcha y comandos

1. **Instalar:** Git, Docker Desktop (en Windows con WSL 2), Node 24 y Claude Code. `cloudflared` no hace falta: corre en un contenedor.
2. **Clonar** con `git clone https://github.com/colosoler/TP4-ADR-Docker-Cloudflared.git` y abrir Claude Code en la carpeta. Las skills de `.claude/skills/` se cargan solas.
3. **Leer** `CLAUDE.md`, este documento y tu documento de módulo.
4. **Pedirle a Claude el plan del día:** `Usá la skill writing-plans. La spec es el Día 1 de docs/plan/<tu archivo> y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m<N>-dia1.md.`
5. **Cuando esté el compose de M1:** `cp .env.example .env` y cambiar las claves.

```bash
docker compose up -d --build                         # levantar todo → http://localhost:8080
docker compose ps                                    # todos (healthy)
docker compose logs -f backend                       # ver logs
docker compose down -v && docker compose up -d --build   # reiniciar la base (BORRA datos)
docker compose --profile tunnel up -d                # + túnel; URL: ./scripts/tunnel-url.sh
npm run dev --prefix frontend                        # Vite en :5173 contra el stack en Docker
npm test --prefix backend                            # tests
```

---

## 9. Skills (`.claude/skills`)

Se usan con `/nombre-de-la-skill` o pidiéndolas por nombre en Claude Code.

| Skill | Para qué |
|---|---|
| `writing-plans` | Convertir el día de tu módulo en tareas chicas. Menciona sub-skills `superpowers:*` que no están: ejecutá el plan en la misma sesión. |
| `nodejs-typescript-app` | Backend: router → service, errores, `errorHandler` |
| `supabase-postgres-best-practices` | Tablas, constraints, roles, configuración del pool |
| `react-typescript-app` | Frontend: cliente de API, React Query, Modal, Toast |
| `frontend-design` | La dirección visual (solo M3, el día 1) |
| `impeccable` | Pulido rápido de la UI (M3, el día 3; opcional) |
| `test-driven-development` | Escribir el test antes del código |
| `systematic-debugging` | Cuando algo falla: buscar la causa antes de parchear |
| `verification-before-completion` | Evidencia antes de decir "listo" o abrir un PR |
| `code-review-expert` | El review cruzado |
| `sigma` | Estudiar tu tema de la exposición |

**No aplican:** `java-spring-boot-app`, `supabase`, `animate-expo`, `book-study`, `wiki-ingest`, `skill-forge`, `skill-review`, `design-taste-frontend`, `emil-design-eng`.

---

## 10. Definition of Done (cada día)

- [ ] Se cumple el "Listo cuando" del día en tu documento de módulo.
- [ ] `npm test --prefix backend` y `npx tsc --noEmit` pasan en lo que tocaste.
- [ ] `docker compose ps`: todo `healthy`.
- [ ] Sin secretos en el repo.
- [ ] El PR tiene la evidencia y el review cruzado aprobado.

---

## 11. Exposición (5 partes de ~5 minutos)

| Orden | Quién | Tema | Demo |
|---|---|---|---|
| 1 | M1 | Docker desde cero: contenedor vs VM, imagen vs contenedor, Compose, volúmenes y nuestras 3 redes | `docker compose up` / `ps` |
| 2 | M2 | Dockerfile multi-stage, no-root, HEALTHCHECK y resiliencia en el código (503) | `pool.ts` y `errorHandler.ts` |
| 3 | M3 | La app en vivo y cómo el frontend detecta la caída | recorrido por las 5 secciones |
| 4 | M4 | Seguridad en capas y reverse proxy | `curl -I` con los headers; la base inalcanzable desde el proxy |
| 5 | M5 | Chaos testing en vivo + bonus Cloudflare Tunnel | `scripts/chaos-test` + la URL pública en el celular |
