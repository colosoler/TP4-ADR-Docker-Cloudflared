# Módulo 2 — Backend Express, resiliencia y Clientes

| | |
|---|---|
| **Responsable** | _(nombre)_ |
| **Revisás los PR de** | M3 |
| **Revisa tus PR** | M1 |
| **Contrato** | [00-plan-general.md](00-plan-general.md): leé §4, §5.2, §5.3, §5.4, §5.5 y §5.8 antes de empezar |

## Tu módulo en una frase

Armás el **esqueleto del backend** que usan los 5: Express + TypeScript, el manejo de errores único y la conexión a Postgres **resiliente** (si la base se cae, responde 503 y el proceso sigue vivo). También armás el Dockerfile multi-stage no-root y el **CRUD de Clientes**.

## Entregables

- **Fase 0**
  - [ ] `backend/` completo: `package.json`, `package-lock.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `Dockerfile`, `.dockerignore`, `.env.example`
  - [ ] Archivos de `src/`: `index.ts`, `app.ts`, `config.ts`, `logger.ts`, `errors.ts`, `db/pool.ts`, `middleware/errorHandler.ts`, `shared/schemas.ts`, `routes/index.ts`, `routes/health.ts`
  - [ ] Las 5 carpetas de `src/modules/` con su router vacío
- **Fase 1**
  - [ ] `db/init/02_clientes.sql`
  - [ ] `backend/src/modules/clientes/*`
  - [ ] `frontend/src/features/clientes/*`
- **Fase 2**
  - [ ] Tests de resiliencia
  - [ ] Apagado ordenado (SIGTERM)
  - [ ] Backend probado con `read_only`
  - [ ] Log de requests
- **Fase 3**
  - [ ] Exposición: "Dockerfile, backend y resiliencia"

## Skills que vas a usar

| Skill | Cuándo | Prompt para copiar en Claude Code |
|---|---|---|
| `writing-plans` | Al empezar cada fase | `Usá la skill writing-plans. La spec es la Fase 0 de docs/plan/modulo-2-backend-clientes.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m2-fase0-backend.md.` |
| `nodejs-typescript-app` | Fase 0 y 1 | `Cargá la skill nodejs-typescript-app y armá el esqueleto de backend/ según la Fase 0 de mi módulo. Diferencias con la skill: estructura por entidad (src/modules/<entidad>), Express 5 sin asyncHandler, sin cors(), logs solo a consola, Vitest en lugar de Jest.` |
| `supabase-postgres-best-practices` | Fase 0 (pool) y Fase 1 (tabla) | `Cargá supabase-postgres-best-practices y revisá la config del Pool en src/db/pool.ts contra references/conn-pooling.md, conn-limits.md y conn-idle-timeout.md.` |
| `test-driven-development` | Siempre que escribas código | `Con test-driven-development, escribí primero los tests de errorHandler y health que lista mi módulo, verificá que fallan y después implementá.` |
| `systematic-debugging` | Si el chaos test o un healthcheck falla | `Usá systematic-debugging: con la base caída el backend responde 500 en vez de 503. Logs: <pegar>.` |
| `verification-before-completion` | Antes de cada PR | `Usá verification-before-completion con los comandos de "Cómo verificarlo" de mi fase.` |
| `code-review-expert` | Cuando revisás a M3 | `Usá code-review-expert para revisar la rama m3/fase0-frontend contra main.` |
| `sigma` | Fase 3 | Ver "Tu parte de la exposición". |

---

## Fase 0 — Esqueleto del backend (días 1–3)

**Lo usan los 5: tiene que estar mergeado para el día 3.**

### Archivos

```
backend/
├── package.json  package-lock.json  tsconfig.json  tsconfig.build.json  vitest.config.ts
├── Dockerfile  .dockerignore  .env.example
└── src/
    ├── index.ts  app.ts  config.ts  logger.ts  errors.ts
    ├── db/pool.ts
    ├── middleware/errorHandler.ts       (+ errorHandler.test.ts)
    ├── shared/schemas.ts
    ├── routes/index.ts  routes/health.ts (+ health.test.ts)
    └── modules/{modelos,clientes,autos,vendedores,sucursales}/<entidad>.routes.ts
```

### Pasos

**1. Proyecto.**

- **Dependencias** (`npm install`): `express@5`, `pg`, `zod@4`.
- **Dependencias de desarrollo** (`npm install -D`): `typescript`, `tsx`, `vitest`, `supertest`, `@types/express`, `@types/pg`, `@types/supertest`, `@types/node`.
- **Scripts:**
  ```json
  {
    "dev": "tsx watch --env-file=.env src/index.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
  ```
- **`tsconfig.json`:** el de la skill `nodejs-typescript-app`, con `rootDir: "src"`, `outDir: "dist"` e `include: ["src"]`.
- **`tsconfig.build.json`:** extiende el anterior y agrega `"exclude": ["src/**/*.test.ts"]`.
- **`backend/.env.example`** (para correr fuera de Docker): `PGHOST=localhost`, `PGPORT=5432`, `PGDATABASE=concesionaria`, `PGUSER=concesionaria_app`, `PGPASSWORD=cambiar_esta_clave_app`, `PORT=4000`, `NODE_ENV=development`.

**2. `errors.ts`.** Exactamente las firmas de §5.8 del contrato:

| Clase | Código HTTP | `code` | Mensaje |
|---|---|---|---|
| `NotFoundError(mensaje)` | 404 | `NOT_FOUND` | el que recibe, por ejemplo "Sucursal no encontrada" |
| `ConflictError(mensaje)` | 409 | `CONFLICT` | el que recibe |
| `ServiceUnavailableError()` | 503 | `DB_UNAVAILABLE` | "La base de datos no está disponible. Reintentá en unos segundos." |

**3. `db/pool.ts`. El corazón del chaos test:**

- **Parsers de tipos.** Así los IDs y precios llegan como número y las fechas `date` como texto:
  ```ts
  types.setTypeParser(types.builtins.INT8, (v) => Number(v));
  types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
  types.setTypeParser(types.builtins.DATE, (v) => v);
  ```
- **Pool:** `new Pool({ max: 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 3_000, query_timeout: 10_000 })`. Toma las credenciales de las variables `PG*`. Los timeouts cortos hacen que, con la base caída, la request falle en ~3 s con 503 en vez de quedar colgada.
- **`pool.on('error', …)`:** solo loguea. **Sin este listener, un error en una conexión inactiva mata todo el proceso de Node.**
- **`isConnectionError(err): boolean`:** devuelve `true` en dos casos:
  - si `err.code` es uno de: `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`, `ECONNRESET`, `EHOSTUNREACH`, `EPIPE`, `57P01`, `57P02`, `57P03`, `08000`, `08001`, `08003`, `08004`, `08006`;
  - si el mensaje contiene `Connection terminated`, `timeout exceeded when trying to connect` o `Query read timeout`.
- **`query<T>(text, params)`:** devuelve `rows`. Si `isConnectionError(err)`, lanza `ServiceUnavailableError`; cualquier otro error lo relanza tal cual.
- **`checkDb()`:** hace `select 1` con un límite de 1,5 s (con `Promise.race`); devuelve `true` o `false`, nunca lanza. El límite corto hace que `/api/health` responda rápido aunque la base no conteste, así el healthcheck de Docker no lo marca *unhealthy* en medio del chaos test.

**4. `middleware/errorHandler.ts`.** Traduce cualquier error al formato de §5.4:

| Error | Respuesta |
|---|---|
| `AppError` (y subclases) | su `statusCode`, `code`, `message` y `details` |
| `ZodError` | `400` `VALIDATION_ERROR` "Datos inválidos"; `details = issues.map(i => ({ path: i.path.join('.'), message: i.message }))` |
| pg `23505` (unique) | `409` "Ya existe un registro con ese valor" |
| pg `23514`, `22P02`, `22003` | `400` `VALIDATION_ERROR` |
| JSON mal formado (`err.type === 'entity.parse.failed'`) | `400` "El cuerpo no es un JSON válido" |
| cualquier otro | `500` `INTERNAL_ERROR` "Error interno del servidor": **sin stack** en la respuesta; el stack va al log |

Los services pueden atrapar un `23505` y relanzar un `ConflictError` con un mensaje más específico (ver Clientes).

**5. `app.ts`:**
1. `express()` y `app.disable('x-powered-by')`.
2. `express.json({ limit: '100kb' })`.
3. `app.use('/api', routes)`.
4. Un handler de rutas inexistentes: `404` `NOT_FOUND` "Ruta no encontrada".
5. Por último, `errorHandler`.
6. `export default app`, sin `listen`, así los tests lo usan directo.

**No uses `cors()`.** Todo pasa por el mismo origen gracias al proxy (y a Vite en desarrollo).

**6. `index.ts`:** `app.listen(config.port)` y loguea "Backend escuchando en :4000".

**7. `logger.ts`:** `info`, `warn` y `error` escriben **solo a stdout/stderr**, con fecha y nivel. Si usás winston como la skill, **solo `transports.Console`**: el `File` de la skill rompe con `read_only: true`.

**8. `shared/schemas.ts`:** `export const idParamSchema = z.object({ id: z.coerce.number().int().positive() })`.

**9. Rutas.**
- `routes/health.ts`: `GET /` responde `{ status: 'ok', db: (await checkDb()) ? 'up' : 'down' }`, siempre con `200`.
- `routes/index.ts`: registra `/health`, `/modelos`, `/clientes`, `/autos`, `/vendedores` y `/sucursales`.
- Creá los 5 archivos `modules/<entidad>/<entidad>.routes.ts`, cada uno con `const router = Router(); export default router;`. Así, desde la Fase 1, cada compañero solo toca su carpeta.

**10. `Dockerfile`** (multi-stage, no-root):

```dockerfile
# Etapa 1: solo dependencias de producción
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Etapa 2: compilar TypeScript
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Etapa 3: imagen final mínima
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Los archivos quedan de root y el proceso corre como "node": no puede modificar su propio código
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "dist/index.js"]
```

**`.dockerignore`:** `node_modules`, `dist`, `coverage`, `.env`, `*.log`.

### Tests de la Fase 0 (escribilos primero)

- **`health.test.ts`** (con `checkDb` mockeado):
  - si devuelve `true` → `200 { status: 'ok', db: 'up' }`;
  - si devuelve `false` → **también `200**, con `db: 'down'`.
- **`errorHandler.test.ts`.** Montá una app de prueba con rutas que lancen cada tipo de error y verificá status y body:
  1. `ZodError` → `400` con `details`.
  2. `NotFoundError('Cliente no encontrado')` → `404` con ese mensaje.
  3. Error pg `23505` → `409`.
  4. Error pg `23514` (falla un `check`) → `400` `VALIDATION_ERROR`.
  5. `ServiceUnavailableError` → `503` `DB_UNAVAILABLE`.
  6. `Error('boom')` → `500` y el body **no** contiene `stack`.
  7. `GET /api/no-existe` contra la `app` real → `404` `NOT_FOUND`.

### Criterios de aceptación

- [ ] `npm test --prefix backend` y `npx tsc --noEmit -p backend` pasan.
- [ ] La imagen construye y el proceso corre como `node`.
- [ ] La imagen final no tiene TypeScript ni Vitest.
- [ ] Con el compose de M1 levantado, `/api/health` responde por el proxy.
- [ ] Con la base detenida, el contenedor del backend sigue corriendo y `/api/health` dice `"db":"down"`.

### Cómo verificarlo

```bash
npm ci --prefix backend
npm test --prefix backend
npx tsc --noEmit -p backend

docker build -t concesionaria-backend ./backend
docker run --rm concesionaria-backend whoami                      # → node
docker run --rm concesionaria-backend sh -c "ls node_modules/.bin | grep -E 'tsc|vitest' || echo sin-devDependencies"

# Con el stack completo
docker compose up -d --build
curl -s http://localhost:8080/api/health                          # → {"status":"ok","db":"up"}
docker stop concesionaria_db
curl -s http://localhost:8080/api/health                          # → {"status":"ok","db":"down"}
docker compose ps backend                                         # sigue Up (healthy)
docker start concesionaria_db
```

---

## Fase 1 — CRUD de Clientes (días 4–9)

Es el mismo molde que siguen los otros 4 módulos (§5.7 del contrato).

### Tabla: `db/init/02_clientes.sql`

Copiá el DDL de `clientes` de §5.6 **tal cual** y agregá 6 clientes ficticios, con DNI de 8 dígitos y teléfonos con característica 221 (La Plata).

Para que se aplique: `docker compose down -v && docker compose up -d --build`.

### Endpoints (`backend/src/modules/clientes/`)

| Método y ruta | Respuesta |
|---|---|
| `GET /api/clientes` | `200`, `order by apellido, nombre` |
| `GET /api/clientes/:id` | `200` o `404` "Cliente no encontrado" |
| `POST /api/clientes` | `201`; `400`; `409` "Ya existe un cliente con ese DNI" |
| `PUT /api/clientes/:id` | `200`, `400`, `404` o `409` |
| `DELETE /api/clientes/:id` | `204` o `404` |

Forma en el JSON:

```json
{ "id": 1, "nombre": "Lucía", "apellido": "Gómez", "dni": "38123456",
  "telefono": "221 555-1234", "createdAt": "…", "updatedAt": "…" }
```

### Validaciones (`clientes.schema.ts`, zod)

Un solo esquema para `POST` y `PUT`:

| Campo | Regla |
|---|---|
| `nombre`, `apellido` | trim, 1–60 caracteres |
| `dni` | se aceptan puntos ("38.123.456"): se quitan y después tiene que cumplir `^\d{7,8}$`; mensaje "El DNI debe tener 7 u 8 dígitos" |
| `telefono` | opcional y nullable; trim, 6–20 caracteres |

Si el `insert` o el `update` tiran `23505` con `err.constraint === 'clientes_dni_key'`, el service lanza `ConflictError('Ya existe un cliente con ese DNI')`.

### Tests (`clientes.test.ts`) — escribilos ANTES de implementar

Con Supertest contra `app` y `clientes.service` mockeado con `vi.mock`:

1. `GET /api/clientes` → `200` y devuelve el array del service.
2. `GET /api/clientes/abc` → `400`.
3. `GET /api/clientes/999` cuando el service lanza `NotFoundError` → `404` con `error.code === 'NOT_FOUND'`.
4. `POST` con `dni: '123'` → `400` y `error.details[0].path === 'dni'`.
5. `POST` válido con `dni: '38.123.456'` → `201`, y el service recibe `dni: '38123456'`.
6. `POST` cuando el service lanza `ConflictError` → `409`.
7. `DELETE /api/clientes/1` → `204`.

### Pantalla (`frontend/src/features/clientes/`)

- **`ClientesPage.tsx`**
  - `DataTable` con columnas: Apellido y nombre · DNI · Teléfono · Acciones (Editar, Eliminar).
  - Botón "Nuevo cliente" que abre `ClienteForm` en un `Modal`.
  - "Eliminar" abre `ConfirmDialog`.
- **`ClienteForm.tsx`**
  - Campos: nombre, apellido, DNI, teléfono.
  - Los errores `400` y `409` de la API se muestran debajo de cada campo (`details[].path` → `FormField error`).
  - Al guardar: toast "Cliente guardado" e `invalidateQueries({ queryKey: ['clientes'] })`.

### Criterios de aceptación

- [ ] Los 7 tests pasan: `npm test --prefix backend`.
- [ ] En `http://localhost:8080/clientes` se puede listar, crear, editar y borrar.
- [ ] Un DNI repetido muestra "Ya existe un cliente con ese DNI" en el campo DNI.
- [ ] Con la base detenida, `curl -si http://localhost:8080/api/clientes` responde `503` `DB_UNAVAILABLE`.

---

## Fase 2 — Resiliencia a prueba de balas (días 10–12)

1. **Tests de `pool.ts`** (`db/pool.test.ts`):
   - `isConnectionError` con cada código de la lista y con los 3 mensajes (todos `true`), y con `23505` y `Error('x')` (`false`).
   - `query()` con `pool.query` mockeado:
     - si falla con `ECONNREFUSED` → lanza `ServiceUnavailableError`;
     - si falla con `23505` → relanza el error original, sin tocarlo.
2. **Apagado ordenado** en `index.ts`. Ante `SIGTERM` o `SIGINT`:
   1. loguea "Apagando…";
   2. ejecuta `server.close()` y después `pool.end()`;
   3. sale con `process.exit(0)`.

   Con un timeout de seguridad de 8 s que fuerza `process.exit(1)`. Sin esto, `docker stop` espera 10 s y mata el proceso (código 137).
3. **Backend con `read_only`.** M4 agrega `read_only: true` y `tmpfs: [/tmp]` al backend en el compose. Verificá que nada del código escriba en disco; si algo falla, corregilo vos.
4. **Log de requests:** un middleware que escribe una línea por request (`GET /api/clientes 200 12ms`). **Sin bodies ni query strings**, para no loguear DNI ni emails.
5. **Ayudá a M5 con el chaos test:** confirmá que con la base caída cada endpoint de los 5 módulos responde `503` y no `500`. Si alguno da `500`, es porque usó el `pool` directo en vez de `query()`: avisale al dueño.

### Criterios de aceptación

- [ ] Los tests de `pool.test.ts` pasan.
- [ ] `docker compose stop backend` termina en menos de 3 s, y `docker inspect concesionaria_backend --format "{{.State.ExitCode}}"` da `0`.
- [ ] Con `read_only: true` el backend sigue `(healthy)`, y `docker exec concesionaria_backend touch /app/x` falla.
- [ ] Con la base caída, `GET` de los 5 recursos → `503 DB_UNAVAILABLE`. Pegá la salida en el PR.

---

## Review cruzado

Revisás los PR de **M3** (esqueleto del frontend y Autos) con `code-review-expert`. Fijate en:

- **`api/client.ts`:** que convierta cualquier respuesta de error en un `ApiError` con `status` y `code`, incluso si el body no es JSON.
- **Banner de caída:** que el reintento cada 5 s se corte cuando vuelve la base.
- **Dockerfile:** que no tenga URLs ni claves hardcodeadas y que sea multi-stage.
- **Autos:** que el formulario use los componentes compartidos y muestre los errores `400` en el campo que corresponde.

---

## Tu parte de la exposición (≈5 min): Dockerfile, backend y resiliencia

Slides:
1. Anatomía de un Dockerfile (`FROM`, `WORKDIR`, `COPY`, `RUN`, `EXPOSE`, `CMD`), usando **nuestro** Dockerfile.
2. Multi-stage: por qué la imagen final no tiene TypeScript. Compará el tamaño con una imagen single-stage.
3. Usuario no-root + código de root: el proceso no puede modificarse a sí mismo.
4. HEALTHCHECK.
5. Resiliencia en el código: `pool.on('error')`, `isConnectionError` → `ServiceUnavailableError` → 503, y por qué `/api/health` siempre responde 200.

Demo: `docker exec concesionaria_backend whoami` (→ `node`) y mostrar `pool.ts` y `errorHandler.ts` en el editor.

Para estudiar: `/sigma Quiero entender a fondo un Dockerfile multi-stage de Node con usuario no-root y HEALTHCHECK, y cómo node-postgres maneja la caída de la base (pool.on('error'), timeouts, errores de conexión). Lo tengo que exponer en 5 minutos.`

---

## Definition of Done del módulo

- [ ] Fase 0, Fase 1 y Fase 2 con todos sus criterios de aceptación en verde.
- [ ] Se cumple la Definition of Done general (§11 del contrato).
- [ ] Ningún archivo de `src/` escribe en disco ni loguea datos personales.
- [ ] Slides y demo listas y ensayadas.
