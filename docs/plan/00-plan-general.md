# Concesionaria Honda La Plata — Plan general del TP

> **Proyecto académico.** No está afiliado a Honda Motor de Argentina ni a ninguna concesionaria real. Los precios y datos son ficticios.

Este documento es **el contrato del grupo**. Acá están los nombres, puertos, rutas, tablas y reglas que los 5 módulos tienen que respetar para que todo encaje. Cada integrante tiene además su propio documento:

| Módulo | Documento | Infraestructura | Entidad (CRUD) |
|---|---|---|---|
| M1 | [modulo-1-infra-db-modelos.md](modulo-1-infra-db-modelos.md) | docker-compose, base de datos | Modelos |
| M2 | [modulo-2-backend-clientes.md](modulo-2-backend-clientes.md) | Backend Express + resiliencia | Clientes |
| M3 | [modulo-3-frontend-autos.md](modulo-3-frontend-autos.md) | Frontend React + banner de caída | Autos |
| M4 | [modulo-4-proxy-seguridad-vendedores.md](modulo-4-proxy-seguridad-vendedores.md) | Reverse proxy + hardening | Vendedores |
| M5 | [modulo-5-cloudflare-chaos-sucursales.md](modulo-5-cloudflare-chaos-sucursales.md) | Cloudflare Tunnel + chaos testing | Sucursales |

**Si algo de este contrato no te alcanza o está mal, no lo cambies en tu código.** Avisá al grupo, se acuerda el cambio y se edita este archivo en un PR propio.

---

## 1. Qué vamos a construir

Una app web interna para una concesionaria Honda de La Plata, con 5 secciones. Cada sección es un CRUD simple sobre una tabla independiente:

- **Modelos:** el catálogo (City, Civic, HR-V, ZR-V, CR-V, WR-V).
- **Autos:** las unidades en stock y su estado (disponible / reservado / vendido).
- **Clientes:** nombre, DNI y teléfono.
- **Vendedores:** el equipo de ventas.
- **Sucursales:** dónde está la concesionaria en el Gran La Plata.

El dominio es chico a propósito, igual que el CRUD de tareas del TP de ejemplo: lo importante es la infraestructura. Usamos la misma arquitectura que el TP de ejemplo, apoyada en sus tres pilares, y sumamos el bonus:

1. **Seguridad en capas:** Dockerfile + docker-compose + código de la app.
2. **Un solo punto de entrada:** reverse proxy con Nginx.
3. **Resiliencia real:** si la base se cae, el backend responde 503, sigue vivo y se recupera solo.
4. **Bonus:** la publicamos en internet con **Cloudflare Tunnel** (Quick Tunnel, sin cuenta ni dominio).

No usamos GitHub Actions ni CI. Todo se levanta con Docker Compose en la máquina de cada uno.

---

## 2. Arquitectura

```
                        Internet
                           │  https://<palabras-al-azar>.trycloudflare.com
                    ┌──────▼───────┐
                    │ cloudflared  │  abre una conexión SALIENTE a Cloudflare
                    └──────┬───────┘  (profile "tunnel")
                           │
  Navegador ───────────────┤  http://localhost:8080
                           │
               ┌───────────▼──────────┐   edge_net   ┌────────────┐
               │ proxy  (Nginx :8080) ├─────────────►│ frontend   │ Nginx sirve el build de React
               │ único puerto         │      /       │ (:8080)    │
               │ publicado            │              └────────────┘
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

- **Un solo puerto publicado:** solo el proxy publica un puerto al host (`8080`). El resto vive puertas adentro de Docker.
- **Tres redes en vez de dos (mejora sobre el TP):** la base solo comparte red con el backend. Ni el proxy ni el frontend pueden llegar a ella.
- **Sin internet hacia adentro:** `app_net` y `data_net` son `internal: true`, así que backend y db no tienen salida a internet. Solo `edge_net` la tiene, porque `cloudflared` la necesita.
- **Mismo origen:** el navegador habla siempre con un único origen (`localhost:8080` o la URL del túnel), así que **no hace falta CORS**.

---

## 3. Stack y versiones

**Regla: nada de `latest`.** Toda imagen lleva una versión fija. Las dependencias npm quedan fijadas en `package-lock.json`, que **se commitea**.

| Pieza | Tecnología | Versión / imagen |
|---|---|---|
| Base de datos | PostgreSQL | `postgres:17-alpine` (no usamos la 18: cambió la ruta de datos del volumen) |
| Backend | Node.js + TypeScript 5 + Express 5 + `pg` + `zod` 4 | build y runtime: `node:24-alpine` (Node 24 LTS; Node 20 ya no tiene soporte) |
| Tests backend | Vitest + Supertest | — |
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v4 (`@tailwindcss/vite`) + TanStack Query 5 + React Router 7 | build: `node:24-alpine` |
| Servidor del frontend | Nginx no-root | `nginxinc/nginx-unprivileged:<mayor.menor>-alpine` |
| Reverse proxy | Nginx no-root | `nginxinc/nginx-unprivileged:<mayor.menor>-alpine` (la misma versión que el frontend) |
| Túnel | Cloudflare Tunnel | `cloudflare/cloudflared:<AAAA.M.P>` |

Para Nginx y cloudflared, quien los incorpora (M3, M4, M5) busca en Docker Hub la última versión estable y la fija con el número exacto. Ejemplo: `nginxinc/nginx-unprivileged:1.28-alpine`.

---

## 4. Estructura del repositorio (y quién es dueño de cada cosa)

```
/
├── CLAUDE.md                          (coordinación)  reglas para Claude Code
├── README.md                          M5
├── docker-compose.yml                 M1 base · M4 hardening de backend/frontend/proxy/cloudflared · M5 servicio cloudflared · M1 hardening de db
├── docker-compose.dev.yml             M1  (solo para desarrollo local)
├── .env.example                       M1
├── .gitignore  .gitattributes         M1
├── db/
│   └── init/
│       ├── 00_roles.sh                M1  rol de mínimo privilegio
│       ├── 01_modelos.sql             M1
│       ├── 02_clientes.sql            M2
│       ├── 03_autos.sql               M3
│       ├── 04_vendedores.sql          M4
│       └── 05_sucursales.sql          M5
├── backend/                           M2 (esqueleto) · cada uno su carpeta en src/modules/
│   ├── Dockerfile  .dockerignore  package.json  package-lock.json  tsconfig.json  vitest.config.ts
│   └── src/
│       ├── index.ts                   M2  arranca el server (listen + señales)
│       ├── app.ts                     M2  crea la app Express (se exporta para los tests)
│       ├── config.ts                  M2
│       ├── logger.ts                  M2  logs solo a consola (stdout)
│       ├── errors.ts                  M2  AppError y subclases
│       ├── db/pool.ts                 M2  pool, query(), checkDb()
│       ├── middleware/errorHandler.ts M2
│       ├── shared/schemas.ts          M2  idParamSchema y helpers de zod
│       ├── routes/index.ts            M2  registra los 6 routers (health + 5 entidades)
│       ├── routes/health.ts           M2
│       └── modules/
│           ├── modelos/               M1
│           ├── clientes/              M2
│           ├── autos/                 M3
│           ├── vendedores/            M4
│           └── sucursales/            M5
├── frontend/                          M3 (esqueleto) · cada uno su carpeta en src/features/
│   ├── Dockerfile  .dockerignore  nginx.conf  package.json  vite.config.ts  index.html
│   └── src/
│       ├── main.tsx  App.tsx          M3
│       ├── api/client.ts              M3
│       ├── shared/components/         M3  Layout, DataTable, Modal, ConfirmDialog, FormField, Toast, DbDownBanner, EmptyState
│       ├── shared/hooks/              M3  useToast, useDbStatus
│       ├── shared/format.ts           M3  formatPrecio
│       └── features/
│           ├── modelos/               M1
│           ├── clientes/              M2
│           ├── autos/                 M3
│           ├── vendedores/            M4
│           └── sucursales/            M5
├── proxy/                             M4
│   ├── Dockerfile
│   └── nginx.conf
├── scripts/                           M1 backup/restore · M5 chaos-test y tunnel-url
└── docs/
    ├── plan/                          este plan
    └── tareas/                        planes de tareas que genera cada uno con la skill writing-plans
```

**Regla de oro para no pisarnos:**
- En la **Fase 0**, M2 deja creadas las 5 carpetas de `backend/src/modules/` con un router vacío ya registrado. M3 hace lo mismo con las 5 rutas y páginas placeholder en `frontend/src/features/`.
- Desde la **Fase 1**, cada uno toca **solo su carpeta de backend, su carpeta de frontend y su archivo SQL**.

> Nota: la skill `nodejs-typescript-app` organiza el backend por capas (`routes/`, `services/`). Nosotros usamos sus mismos patrones (router → service → db, `AppError`, `errorHandler`), pero **agrupados por entidad**, para que 5 personas trabajen en paralelo sin conflictos de merge.

---

## 5. Contrato compartido

### 5.1 Servicios, puertos y redes

| Servicio | `container_name` | Build / imagen | Puerto interno | Redes | Publica al host | Healthcheck |
|---|---|---|---|---|---|---|
| `db` | `concesionaria_db` | `postgres:17-alpine` | 5432 | `data_net` | no | `pg_isready` |
| `backend` | `concesionaria_backend` | `./backend` | 4000 | `data_net`, `app_net` | no | `GET /api/health` |
| `frontend` | `concesionaria_frontend` | `./frontend` | 8080 | `edge_net` | no | `GET /` |
| `proxy` | `concesionaria_proxy` | `./proxy` | 8080 | `edge_net`, `app_net` | **`8080:8080`** | `GET /healthz` |
| `cloudflared` | `concesionaria_tunnel` | `cloudflare/cloudflared` | — | `edge_net` | no | — |

- **Redes:** `data_net` y `app_net` son `internal: true`; `edge_net` es una red común.
- **Volumen:** `db_data` montado en `/var/lib/postgresql/data`.
- **Perfil `tunnel`:** `cloudflared` solo arranca con `docker compose --profile tunnel up -d`.
- **Orden de arranque (`depends_on` con `condition: service_healthy`):**
  - `backend` espera a `db`;
  - `proxy` espera a `backend` y `frontend`;
  - `cloudflared` espera a `proxy`.

### 5.2 Variables de entorno

El archivo `.env` **nunca se commitea**. Lo que se commitea es `.env.example`, con valores de ejemplo que hay que cambiar:

```dotenv
# Usuario administrador de Postgres: solo lo usan los scripts de init
POSTGRES_DB=concesionaria
POSTGRES_USER=concesionaria_admin
POSTGRES_PASSWORD=cambiar_esta_clave_admin

# Rol con privilegios mínimos que usa el backend (lo crea db/init/00_roles.sh)
APP_DB_USER=concesionaria_app
APP_DB_PASSWORD=cambiar_esta_clave_app
```

El backend **no** lee el `.env`. En el compose recibe las variables estándar de libpq, que `pg` lee solo:

| Variable del backend | Valor en compose |
|---|---|
| `PGHOST` | `db` |
| `PGPORT` | `5432` |
| `PGDATABASE` | `${POSTGRES_DB}` |
| `PGUSER` | `${APP_DB_USER}` |
| `PGPASSWORD` | `${APP_DB_PASSWORD}` |
| `PORT` | `4000` |
| `NODE_ENV` | `production` |

Para desarrollo local fuera de Docker, el backend usa `backend/.env` (también ignorado por git), con `PGHOST=localhost` (ver §9.3).

### 5.3 Convenciones de la API

- Todo cuelga de `/api`. El JSON va en **camelCase** y la base usa **snake_case**. El mapeo se hace en el SQL con alias: `select precio_base as "precioBase"`.
- **Sin paginación ni filtros** (son pocos datos), pero los listados **siempre tienen un orden explícito** (`order by`).
- `createdAt` y `updatedAt` salen en ISO UTC (`"2026-10-20T13:00:00.000Z"`).
- Los IDs y precios salen como **número** JSON. `pool.ts` configura los parsers de `pg` para eso: ver el [módulo 2](modulo-2-backend-clientes.md).
- `PUT` es reemplazo completo: se mandan todos los campos editables.
- Cada `UPDATE` setea `updated_at = now()` en el SQL (no usamos triggers).
- **SQL siempre parametrizado** (`$1`, `$2`, …). Nunca se concatena input del usuario.

Los 5 recursos tienen los mismos 5 endpoints: `GET` · `GET /:id` · `POST` · `PUT /:id` · `DELETE /:id`.

| Recurso | Orden del listado | Dueño |
|---|---|---|
| `/api/modelos` | `order by nombre` | M1 |
| `/api/clientes` | `order by apellido, nombre` | M2 |
| `/api/autos` | `order by modelo, anio desc` | M3 |
| `/api/vendedores` | `order by apellido, nombre` | M4 |
| `/api/sucursales` | `order by nombre` | M5 |
| `/api/health` | solo `GET` (ver §5.5) | M2 |

**Códigos de respuesta:**

| Caso | Código |
|---|---|
| `GET` OK | `200` |
| `POST` OK | `201` + el recurso creado |
| `PUT` OK | `200` + el recurso actualizado |
| `DELETE` OK | `204` sin cuerpo |
| Body o ID inválidos (zod, o `check` de la base) | `400` `VALIDATION_ERROR` |
| ID inexistente | `404` `NOT_FOUND` |
| Valor duplicado en un campo `unique` | `409` `CONFLICT` |
| Base caída | `503` `DB_UNAVAILABLE` (lo genera el backend) |
| Backend caído | `503` `BACKEND_UNAVAILABLE` (lo genera el proxy) |
| Demasiadas requests | `429` `RATE_LIMITED` (lo genera el proxy) |
| Cualquier otro error | `500` `INTERNAL_ERROR` (sin stack trace en producción) |

### 5.4 Formato único de error

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos",
    "details": [
      { "path": "dni", "message": "El DNI debe tener 7 u 8 dígitos" }
    ]
  }
}
```

- `code` es uno de: `VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `DB_UNAVAILABLE`, `BACKEND_UNAVAILABLE`, `RATE_LIMITED`, `INTERNAL_ERROR`.
- `message` está en español y se le puede mostrar al usuario.
- `details` es opcional. Solo aparece en `VALIDATION_ERROR` y tiene un elemento por campo.

### 5.5 Health

`GET /api/health` responde **siempre `200` mientras el proceso de Node esté vivo**:

```json
{ "status": "ok", "db": "up" }
```

Con la base caída responde igual `200`, pero con `"db": "down"`. Así el healthcheck de Docker del backend no lo marca *unhealthy* durante el chaos test. El frontend usa este endpoint para saber cuándo volvió la base.

### 5.6 Esquema de la base de datos (DDL)

Son **5 tablas independientes**: no hay claves foráneas entre ellas. Cada dueño copia **tal cual** su bloque a su archivo de `db/init/` y agrega al final sus datos de ejemplo (`insert`). El número del archivo coincide con el número del módulo.

Seguimos `supabase-postgres-best-practices`:
- PK `bigint generated always as identity`;
- `text` con `check` (no `varchar(n)`);
- `numeric(12,2)` para precios;
- `timestamptz`;
- todo en minúsculas y snake_case.

Los scripts solo corren cuando el volumen está vacío (ver §5.9).

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
```

```sql
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
```

```sql
-- db/init/03_autos.sql  (M3)
create table autos (
  id          bigint generated always as identity primary key,
  modelo      text not null check (length(modelo) between 1 and 40),
  anio        smallint not null check (anio between 2015 and 2030),
  color       text not null check (length(color) between 1 and 30),
  precio      numeric(12,2) not null check (precio > 0),
  estado      text not null default 'disponible'
                check (estado in ('disponible', 'reservado', 'vendido')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

```sql
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
```

```sql
-- db/init/05_sucursales.sql  (M5)
create table sucursales (
  id          bigint generated always as identity primary key,
  nombre      text not null unique check (length(nombre) between 1 and 60),
  direccion   text not null check (length(direccion) between 1 and 100),
  localidad   text not null default 'La Plata'
                check (localidad in ('La Plata', 'City Bell', 'Gonnet', 'Berisso', 'Ensenada')),
  telefono    text check (length(telefono) between 6 and 20),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

**Datos de ejemplo:** cada dueño agrega entre 4 y 6 filas creíbles para La Plata. Los precios y datos son ficticios. Los emails usan `@example.com`, un dominio reservado para ejemplos.

### 5.7 Las 5 entidades siguen el mismo molde

No hay reglas entre módulos: cada tabla es independiente. Así, cada integrante hace **exactamente el mismo trabajo**, y el foco del TP queda en Docker, seguridad, proxy y resiliencia.

| Entidad | Ruta | Campos (JSON) | Único (→ `409` si se repite) | Dueño |
|---|---|---|---|---|
| Modelos | `/api/modelos` | `nombre`, `segmento`, `precioBase`, `activo` | `nombre` | M1 |
| Clientes | `/api/clientes` | `nombre`, `apellido`, `dni`, `telefono` | `dni` | M2 |
| Autos | `/api/autos` | `modelo`, `anio`, `color`, `precio`, `estado` | — | M3 |
| Vendedores | `/api/vendedores` | `nombre`, `apellido`, `email`, `activo` | `email` | M4 |
| Sucursales | `/api/sucursales` | `nombre`, `direccion`, `localidad`, `telefono` | `nombre` | M5 |

Además de sus campos, todas las respuestas incluyen `id`, `createdAt` y `updatedAt`.

**Lo que hace cada uno en la Fase 1** (el detalle está en su documento de módulo):

1. **Tabla:** el archivo `db/init/0N_<entidad>.sql` con el DDL de §5.6 y los datos de ejemplo.
2. **API:** `backend/src/modules/<entidad>/` con los 5 endpoints. Los esquemas zod repiten las reglas de los `check` del DDL.
3. **Tests:** 7 tests de rutas con Vitest + Supertest, escritos antes del código.
4. **Pantalla:** `frontend/src/features/<entidad>/` con listado (`DataTable`), alta y edición (`Modal` + formulario) y borrado (`ConfirmDialog`). Los errores `400` y `409` se muestran en el campo que corresponde.

### 5.8 Piezas compartidas (las usan todos)

**Backend:** las arma M2 en la Fase 0. Firmas exactas:

```ts
// src/errors.ts
type ErrorCode = 'VALIDATION_ERROR' | 'NOT_FOUND' | 'CONFLICT' | 'DB_UNAVAILABLE' | 'INTERNAL_ERROR';
class AppError extends Error { statusCode: number; code: ErrorCode; details?: { path: string; message: string }[] }
class NotFoundError extends AppError            // new NotFoundError('Sucursal no encontrada') → 404
class ConflictError extends AppError            // new ConflictError('Ya existe un cliente con ese DNI') → 409
class ServiceUnavailableError extends AppError  // 503 DB_UNAVAILABLE

// src/db/pool.ts
function query<T>(text: string, params?: unknown[]): Promise<T[]>;
function checkDb(): Promise<boolean>;

// src/shared/schemas.ts
const idParamSchema: z.ZodType<{ id: number }>;  // uso: const { id } = idParamSchema.parse(req.params)
```

**Validación:** dentro de cada handler, con `schema.parse(req.body)` o `idParamSchema.parse(req.params)`. Si falla, zod lanza un `ZodError` y el `errorHandler` lo convierte en `400`. Express 5 pasa solo los errores de las funciones `async` al `errorHandler`, así que **no hace falta** `asyncHandler`.

**Estructura de cada entidad en el backend** (`backend/src/modules/<entidad>/`):

| Archivo | Contenido |
|---|---|
| `<entidad>.schema.ts` | un esquema zod para el body (se usa tanto en `POST` como en `PUT`) y su tipo inferido |
| `<entidad>.service.ts` | funciones con el SQL: `list`, `getById`, `create`, `update`, `remove` |
| `<entidad>.routes.ts` | `export default` un `Router` de Express |
| `<entidad>.test.ts` | Vitest + Supertest contra `app`, con el service mockeado (`vi.mock`) |

**Frontend:** lo arma M3 en la Fase 0. Firmas exactas:

```ts
// src/api/client.ts — las rutas son relativas a /api: apiGet('/modelos')
class ApiError extends Error { status: number; code: string; details?: { path: string; message: string }[] }
function apiGet<T>(path: string): Promise<T>;
function apiPost<T>(path: string, body: unknown): Promise<T>;
function apiPut<T>(path: string, body: unknown): Promise<T>;
function apiDelete(path: string): Promise<void>;

// src/shared/components
type Column<T> = { header: string; cell: (row: T) => React.ReactNode; className?: string };
<DataTable<T> rows={T[]} columns={Column<T>[]} rowKey={(row: T) => number} loading={boolean} emptyMessage={string} />
<Modal open={boolean} onClose={() => void} title={string}>{children}</Modal>
<ConfirmDialog open title message confirmLabel onConfirm={() => void} onCancel={() => void} loading={boolean} />
<FormField label={string} htmlFor={string} error={string | undefined}>{input}</FormField>
<EmptyState title={string} description={string} action={React.ReactNode} />

// src/shared/hooks
useToast(): { showToast(message: string, type?: 'success' | 'error'): void }

// src/shared/format.ts
formatPrecio(n: number): string          // "$ 42.500.000,00" (es-AR, ARS)
```

**Estructura de cada entidad en el frontend** (`frontend/src/features/<entidad>/`):

| Archivo | Contenido |
|---|---|
| `types.ts` | tipos de la entidad |
| `api.ts` | funciones que llaman a `apiGet`/`apiPost`/… |
| `<Entidad>Page.tsx` | listado + botón "Nuevo" + editar/borrar |
| `<Entidad>Form.tsx` | formulario de alta/edición dentro de un `Modal` |

**Query keys de React Query:** `['modelos']`, `['clientes']`, `['autos']`, `['vendedores']`, `['sucursales']`.

**Rutas del frontend y orden del menú:**

| Ruta | Sección |
|---|---|
| `/autos` | Autos (también es la home: `/` redirige acá) |
| `/modelos` | Modelos |
| `/clientes` | Clientes |
| `/vendedores` | Vendedores |
| `/sucursales` | Sucursales |

### 5.9 Problemas conocidos (leelos antes de perder una tarde)

| Problema | Qué hacer |
|---|---|
| Agregaste o cambiaste un `.sql` de `db/init/` y no se aplica | Los scripts de init solo corren con el volumen vacío. `docker compose down -v` (**borra los datos**) y después `docker compose up -d --build`. |
| `00_roles.sh` falla con `\r: command not found` | Windows lo guardó con fin de línea CRLF. El `.gitattributes` fuerza LF (`*.sh text eol=lf`). Si lo clonaste antes de que existiera el `.gitattributes`: borrá el archivo y recuperalo con `git checkout -- db/init/00_roles.sh`. |
| Querés conectarte a la base desde tu máquina y el puerto no aparece | Una red `internal: true` no puede publicar puertos. Usá el override de desarrollo: `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db` (publica `127.0.0.1:5432`). |
| `ids` o precios llegan como texto (`"1"`, `"42500000.00"`) | `pg` devuelve `bigint` y `numeric` como string por defecto. `pool.ts` registra los parsers (M2). |
| Postgres no arranca con `read_only: true` | Necesita tmpfs en `/var/run/postgresql` y `/tmp` (M1). |
| Nginx no arranca con `read_only: true` | La imagen `nginx-unprivileged` escribe sus temporales en `/tmp`: hace falta `tmpfs: [/tmp]`. Los avisos "read-only file system" de los scripts del entrypoint son esperables. |
| El rate limit del proxy frena a todos juntos detrás del túnel | Con cloudflared todas las requests llegan desde la IP de ese contenedor. El proxy toma la IP real de `CF-Connecting-IP` (M4). |
| La CSP bloquea una fuente de Google Fonts | Las fuentes se instalan con `@fontsource/*` (npm), así la CSP queda en `'self'` (M3 + M4). |
| Un 503 de la base se transforma en "BACKEND_UNAVAILABLE" | No activar `proxy_intercept_errors` en el proxy: el 503 del backend tiene que pasar tal cual (M4). |
| PowerShell rompe el backup binario de `pg_dump` | No redirigir con `>`: se genera dentro del contenedor y se copia con `docker cp` (M1). |

---

## 6. Reparto: cada uno hace lo mismo

Cada módulo tiene **una pieza de infraestructura** (Fase 0), **un CRUD completo** (Fase 1: tabla + API + tests + pantalla) y **una tarea de hardening/QA** (Fase 2). Los 5 CRUD son del mismo tamaño (§5.7), así que la diferencia de carga solo está en la infraestructura, y esa está repartida pareja.

| | Fase 0 — infraestructura | Fase 1 — CRUD | Fase 2 — hardening / QA |
|---|---|---|---|
| **M1** | docker-compose, redes, volumen, healthchecks, `.env.example`, roles de la db, override de desarrollo | Modelos | Endurecer el servicio `db` + script de backup/restore |
| **M2** | Esqueleto del backend + resiliencia (`pool.ts`, errores, 503) + Dockerfile multi-stage | Clientes | Tests de resiliencia, apagado ordenado, backend con `read_only` |
| **M3** | Esqueleto del frontend + diseño + componentes compartidos + banner de caída + Dockerfile | Autos | Pulido de UI, accesibilidad, responsive |
| **M4** | Reverse proxy Nginx + headers de seguridad + Dockerfile | Vendedores | Hardening del compose (backend/frontend/proxy/túnel), rate limit, revisión de seguridad |
| **M5** | Servicio cloudflared (Quick Tunnel) + esqueleto del README y del chaos test | Sucursales | Chaos test completo, README final, prueba end-to-end por el túnel |

---

## 7. Fases y cronograma

Los días son relativos al día en que se reparte el trabajo. Ajústenlos a la fecha de entrega.

| Fase | Días | Qué se hace | Hito (todo el grupo) |
|---|---|---|---|
| **Paso 0** | día 0 | El coordinador sube el repo con `.claude/`, `CLAUDE.md` y `docs/plan/` (ver §9.1) | Todos clonan y abren Claude Code |
| **Fase 0** | días 1–3 | Cada uno arma su pieza de infraestructura en paralelo, respetando el contrato | **Hito 0:** `docker compose up -d --build` → `http://localhost:8080` muestra el layout con las 5 secciones y `http://localhost:8080/api/health` responde 200. Con `--profile tunnel`, la URL pública también funciona. |
| **Fase 1** | días 4–9 | Cada uno hace su CRUD completo | **Hito 1:** los 5 CRUD andan en `localhost:8080` y por el túnel |
| **Fase 2** | días 10–12 | Hardening y QA | **Hito 2:** `docker compose ps` todo healthy con el hardening aplicado, y `scripts/chaos-test` pasa |
| **Fase 3** | días 13–14 | Integración final, slides y ensayo | Ensayo completo de la exposición con demo en vivo |

**Orden de merge sugerido en la Fase 0:**

1. Primero M2 (backend) y M3 (frontend). Se pueden construir solos con `docker build`.
2. Después M4 (proxy).
3. Después M1 (compose), que los une.
4. Por último M5 (túnel), que agrega su servicio al compose.

M1 puede ir probando el compose con las ramas de los demás antes de que se mergeen.

---

## 8. Flujo de trabajo con git (sin CI)

- **Ramas:** una por módulo y fase: `m<N>/fase<F>-<tema>`. Ejemplos: `m1/fase0-compose`, `m3/fase1-autos`, `m4/fase2-hardening`.
- **PR a `main`:** cada rama se integra con un Pull Request en GitHub. No hay GitHub Actions: la "CI" es la verificación que cada uno pega en el PR.
- **Review cruzado rotativo** con la skill `code-review-expert`:

  | Revisa | → | A |
  |---|---|---|
  | M1 | → | M2 |
  | M2 | → | M3 |
  | M3 | → | M4 |
  | M4 | → | M5 |
  | M5 | → | M1 |

  No se mergea con hallazgos **P0** o **P1** abiertos.
- **Evidencia en el PR**, generada con la skill `verification-before-completion`: la salida real de los comandos de verificación de tu módulo (tests, `tsc`, `docker compose ps`, `curl`). Nada de "debería andar".
- Nunca se commitea `.env`, `node_modules/`, `dist/` ni backups.

---

## 9. Puesta en marcha

### 9.1 Paso 0 (lo hace el coordinador una sola vez)

1. Crear un `.gitignore` mínimo para el primer commit (M1 lo completa en la Fase 0):
   ```gitignore
   .env
   node_modules/
   dist/
   __pycache__/
   .claude/settings.local.json
   ```
2. Commitear y pushear `.claude/skills/`, `.claude/launch.json`, `CLAUDE.md` y `docs/plan/` a `main`.
3. Pasarle a cada integrante su número de módulo.

### 9.2 Cada integrante

1. Instalar:
   - Git;
   - Docker Desktop (en Windows con WSL 2);
   - Node.js 24 LTS;
   - Claude Code (extensión de VS Code o CLI).

   `cloudflared` **no** hace falta instalarlo: corre como contenedor.
2. Clonar:
   ```bash
   git clone https://github.com/colosoler/TP4-ADR-Docker-Cloudflared.git
   ```
3. Abrir Claude Code en la carpeta del repo. Las skills de `.claude/skills/` se cargan solas.
4. Leer `CLAUDE.md`, este documento y **tu** documento de módulo.
5. Crear tu rama y pedirle a Claude el plan de tareas de tu fase (ver el prompt en tu documento de módulo).
6. Cuando M1 haya mergeado el compose: copiar `.env.example` a `.env` y cambiar las claves.

### 9.3 Comandos de todos los días

```bash
# Levantar todo (como en producción)
docker compose up -d --build
docker compose ps                      # todos tienen que decir (healthy)
docker compose logs -f backend         # logs de un servicio

# Con el túnel de Cloudflare
docker compose --profile tunnel up -d --build
./scripts/tunnel-url.sh                # o .\scripts\tunnel-url.ps1 en Windows

# Reiniciar la base desde cero (re-ejecuta db/init/; BORRA LOS DATOS)
docker compose down -v && docker compose up -d --build

# Desarrollo con recarga en caliente
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d db
npm run dev --prefix backend           # http://localhost:4000 (usa backend/.env con PGHOST=localhost)
npm run dev --prefix frontend          # http://localhost:5173 (Vite redirige /api a :4000)

# Verificación
npm test --prefix backend
npx tsc --noEmit -p backend
npx tsc --noEmit -p frontend
```

---

## 10. Mapa de skills (`.claude/skills`)

Las skills se usan escribiendo `/nombre-de-la-skill` en Claude Code, o pidiéndolo en lenguaje natural ("usá la skill X"). Cada documento de módulo trae prompts listos para copiar.

| Skill | Para qué la usamos | Quién | Cuándo |
|---|---|---|---|
| `writing-plans` | Convertir tu documento de módulo en un plan de tareas chicas (TDD), guardado en `docs/tareas/` | Todos | Al empezar cada fase |
| `nodejs-typescript-app` | Patrones de Express + TS: router → service, `AppError`, `errorHandler`, config | M2 (esqueleto) · todos (su API) | Fase 0 y 1 |
| `supabase-postgres-best-practices` | Tipos y constraints, PK identity, rol de mínimo privilegio, config del pool | Todos (su tabla) · M1 (roles) · M2 (pool) | Fase 0 y 1 |
| `react-typescript-app` | Cliente de API, React Query, Modal, Toast, estructura del frontend | M3 (esqueleto) · todos (su pantalla) | Fase 0 y 1 |
| `frontend-design` | Definir **una sola vez** la dirección visual y los tokens (color, tipografía, espaciado) | M3 | Fase 0 |
| `impeccable` | Auditar y pulir la UI (jerarquía, estados vacíos y de error, accesibilidad, responsive) | M3 · cada uno sobre su pantalla | Fase 2 |
| `emil-design-eng` | Detalles de interacción (toasts, modales, foco) — opcional | M3 | Fase 2 |
| `test-driven-development` | Escribir el test con Vitest + Supertest **antes** de cada endpoint | Todos | Fase 0 y 1 |
| `systematic-debugging` | Cuando algo falla (redes de Docker, healthchecks, el chaos test): causa raíz antes de parchear | Todos | Siempre |
| `verification-before-completion` | Correr los comandos de verificación y pegar la evidencia antes de decir "listo" o abrir un PR | Todos | Antes de cada PR |
| `code-review-expert` | Review cruzado de PRs (SOLID, seguridad, calidad). M4 usa su checklist de seguridad en la Fase 2 | Todos | Cada PR |
| `sigma` | Tutor 1 a 1 para estudiar el tema que vas a exponer | Todos | Fase 3 |

**Skills que no usamos (y por qué):**
- `java-spring-boot-app`: el backend es Node.
- `supabase`: usamos un Postgres propio, no Supabase.
- `animate-expo`: es para React Native.
- `book-study` y `wiki-ingest`: son para estudiar libros y armar wikis.
- `skill-forge` y `skill-review`: sirven para crear o revisar skills.
- `design-taste-frontend`: está pensada para landing pages. Solo es opcional si se agrega una portada.

> La skill `writing-plans` menciona sub-skills `superpowers:*` que no están instaladas. Ejecutá el plan en la misma sesión, tarea por tarea.

---

## 11. Definition of Done (vale para cada fase de cada módulo)

- [ ] Lo que pide tu documento de módulo para esa fase está hecho, y se cumplen todos sus criterios de aceptación.
- [ ] `npm test --prefix backend` pasa (si tocaste el backend).
- [ ] `npx tsc --noEmit` pasa en el proyecto que tocaste.
- [ ] `docker compose up -d --build` levanta todo y `docker compose ps` muestra todos los servicios `healthy`.
- [ ] Lo probaste a mano en `http://localhost:8080` (y por el túnel a partir del Hito 1).
- [ ] No tocaste archivos de otro módulo sin acordarlo. Si cambiaste el contrato, lo actualizaste en este documento.
- [ ] Sin secretos en el repo (`git diff` no muestra claves; `.env` está ignorado).
- [ ] El PR tiene la evidencia de `verification-before-completion` y el review cruzado está aprobado, sin P0/P1.

---

## 12. Exposición (5 partes, ~5 minutos cada una)

Seguimos la estructura del TP de ejemplo, repartida en 5:

| Orden | Quién | Tema | Demo |
|---|---|---|---|
| 1 | M1 | **Docker desde cero:** qué problema resuelve, contenedor vs VM, imagen vs contenedor, Docker Compose, volúmenes y redes, nuestra arquitectura con 3 redes | `docker compose up -d --build` y `docker compose ps` |
| 2 | M2 | **Dockerfile y backend:** anatomía de un Dockerfile, multi-stage, usuario no-root, HEALTHCHECK, resiliencia en el código (`pool.on('error')`, 503) | Mostrar `pool.ts` y `errorHandler.ts` |
| 3 | M3 | **La app:** el CRUD en vivo y el frontend; cómo detecta la caída de la base y reintenta solo | Recorrido por las 5 secciones |
| 4 | M4 | **Seguridad en capas y reverse proxy:** Dockerfile, compose (`cap_drop`, `read_only`, `no-new-privileges`, límites), redes internas, secretos, `nginx.conf` | `curl -I` mostrando los headers; la db inalcanzable desde el proxy |
| 5 | M5 | **Chaos testing + bonus Cloudflare Tunnel:** la base se cae y la app no; publicar en internet sin abrir puertos | `scripts/chaos-test`, el banner en el navegador, la URL `trycloudflare` desde el celular |

Cada uno prepara sus slides con el mismo estilo que el TP de ejemplo y estudia su tema con la skill `sigma`.
