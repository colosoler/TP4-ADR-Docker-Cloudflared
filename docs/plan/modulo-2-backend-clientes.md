# Módulo 2 — Backend, resiliencia y Clientes

**Responsable:** ___ · **Revisás los PR de:** M3 · **Te revisa:** M1
Antes de empezar, leé [00-plan-general.md](00-plan-general.md) §5.2, §5.3, §5.4, §5.5 y §5.8.

**En una frase:** armás el esqueleto del backend que usan los 5, con la conexión a Postgres **resiliente** (si la base se cae, responde 503 y el proceso sigue vivo), su Dockerfile y el CRUD de Clientes.

---

## Día 1 — Esqueleto del backend ⚠️ los demás lo necesitan el día 2

**1. Proyecto.**
- **Dependencias:** `express@5`, `pg`, `zod@4`.
- **Dependencias de desarrollo:** `typescript`, `tsx`, `vitest`, `supertest` y los `@types` (`express`, `pg`, `supertest`, `node`).
- **Scripts:** `build: tsc -p tsconfig.build.json` · `start: node dist/index.js` · `test: vitest run` · `dev: tsx watch src/index.ts`.
- **`tsconfig.json`:** el de la skill `nodejs-typescript-app`, con `rootDir: "src"` y `outDir: "dist"`.
- **`tsconfig.build.json`:** igual, pero excluye `src/**/*.test.ts`.

**2. `src/errors.ts`:**

| Clase | Código | `code` |
|---|---|---|
| `AppError` | — | — |
| `NotFoundError(mensaje)` | 404 | `NOT_FOUND` |
| `ConflictError(mensaje)` | 409 | `CONFLICT` |
| `ServiceUnavailableError()` | 503 | `DB_UNAVAILABLE` |

El mensaje de `ServiceUnavailableError` es "La base de datos no está disponible. Reintentá en unos segundos."

**3. `src/db/pool.ts` — el corazón del chaos test.**

- **Parsers de tipos** (sin esto, los IDs y los precios llegan como texto):
  ```ts
  types.setTypeParser(types.builtins.INT8, (v) => Number(v));
  types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));
  ```
- **Pool:** `new Pool({ max: 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 3_000, query_timeout: 10_000 })`. Con timeouts cortos, si la base se cae la request falla en ~3 s en vez de quedarse colgada.
- **`pool.on('error', …)`:** solo loguea. **Sin este listener, un error en una conexión inactiva mata todo el proceso de Node.**
- **`isConnectionError(err)`:** devuelve `true` si pasa cualquiera de estas dos cosas:
  - `err.code` es uno de: `ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ETIMEDOUT`, `ECONNRESET`, `EHOSTUNREACH`, `57P01`, `57P03`, `08000`, `08001`, `08003`, `08006`;
  - el mensaje contiene `Connection terminated`, `timeout exceeded when trying to connect` o `Query read timeout`.
- **`query(text, params)`:** devuelve `rows`. Si el error es de conexión, lanza `ServiceUnavailableError`; cualquier otro error lo relanza tal cual.
- **`checkDb()`:** hace `select 1` con un límite de 1,5 s (`Promise.race`). Devuelve `true` o `false`; nunca lanza.

**4. `src/middleware/errorHandler.ts`:** traduce los errores al formato de §5.4.

| Error | Respuesta |
|---|---|
| `AppError` | su código, `code` y mensaje |
| `ZodError` | `400` `VALIDATION_ERROR`, con `details = issues.map(i => ({ path: i.path.join('.'), message: i.message }))` |
| pg `23505` | `409` "Ya existe un registro con ese valor" |
| pg `23514`, `22P02` | `400` |
| JSON mal formado | `400` "El cuerpo no es un JSON válido" |
| cualquier otro | `500` "Error interno del servidor": **sin stack** en la respuesta (el stack va al log) |

**5. El resto de `src/`:**
- **`app.ts`:** `app.disable('x-powered-by')`, `express.json({ limit: '100kb' })`, `app.use('/api', routes)`, un `404` "Ruta no encontrada" y, al final, el `errorHandler`. **Sin `cors()`:** todo entra por el proxy. Exporta `app` sin `listen`, para los tests.
- **`index.ts`:** `app.listen(4000)`.
- **`logger.ts`:** escribe **solo a la consola**, nunca a archivos (el contenedor es de solo lectura).
- **`shared/schemas.ts`:** `idParamSchema = z.object({ id: z.coerce.number().int().positive() })`.
- **`routes/health.ts`:** `GET /` → `200 { status: 'ok', db: (await checkDb()) ? 'up' : 'down' }`.
- **`routes/index.ts`:** registra `/health`, `/modelos`, `/clientes`, `/autos`, `/vendedores` y `/sucursales`. Para eso, creá los 5 archivos `modules/<entidad>/<entidad>.routes.ts` con un `Router()` vacío; así cada compañero solo toca su carpeta.

**6. `Dockerfile`** (multi-stage, no-root):

```dockerfile
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/index.js"]
```

Y un `.dockerignore` con `node_modules`, `dist` y `.env`.

**7. Tests (antes del código):**
- `health`: con `checkDb` en `true` → `db: 'up'`; en `false` → **también `200`**, con `db: 'down'`.
- `errorHandler`:
  - `ZodError` → `400` con `details`;
  - pg `23505` → `409`;
  - `ServiceUnavailableError` → `503`;
  - `Error('boom')` → `500` y sin `stack` en el body.

**Listo cuando:**

```bash
npm test --prefix backend
docker build -t backend-test ./backend && docker run --rm backend-test whoami   # → node
curl -s http://localhost:8080/api/health          # → {"status":"ok","db":"up"}
docker stop concesionaria_db
curl -s http://localhost:8080/api/health          # → "db":"down", y el backend sigue corriendo
docker start concesionaria_db
```

---

## Día 2 — CRUD de Clientes

Seguí la **receta de §5.7**. Lo propio de tu entidad:

| Campo | Validación zod |
|---|---|
| `nombre`, `apellido` | trim, 1–60 caracteres |
| `dni` | acepta puntos ("38.123.456"): se quitan y después tiene que cumplir `^\d{7,8}$` |
| `telefono` | opcional, 6–20 caracteres |

**Mensajes:**
- `404`: "Cliente no encontrado".
- `409` (cuando `err.constraint === 'clientes_dni_key'`): "Ya existe un cliente con ese DNI".

**Datos de ejemplo:** 6 clientes ficticios, con DNI de 8 dígitos y teléfonos `221 …`.

**Test 3:** `POST` con `dni: '123'` → `400`.

**Pantalla `/clientes`:** columnas Apellido y nombre · DNI · Teléfono · Acciones.

---

## Día 3 — Resiliencia a prueba

- **Tests de `isConnectionError`:** `true` con `ECONNREFUSED` y con "Connection terminated"; `false` con `23505`.
- **Solo lectura:** con el `read_only: true` que agrega M4, el backend tiene que seguir `healthy`.
- **Ayudá a M5 con el chaos test:** con la base caída, los 5 recursos tienen que dar `503`. Si alguno da `500`, es porque usa `pool.query` en vez de `query()`: avisale al dueño.

---

## Día 4 — Exposición: "Dockerfile y resiliencia"

Slides:
- Anatomía de un Dockerfile, con **el nuestro** como ejemplo.
- Multi-stage: por qué la imagen final no tiene TypeScript.
- Usuario no-root.
- HEALTHCHECK.
- `pool.on('error')` y el 503.

Demo: `docker exec concesionaria_backend whoami` y mostrar `pool.ts`.

Para estudiar: `/sigma Explicame un Dockerfile multi-stage de Node con usuario no-root y HEALTHCHECK, y cómo node-postgres maneja la caída de la base. Lo expongo en 5 minutos.`

---

## Prompts útiles

- **Para arrancar cada día:** `Usá la skill writing-plans. La spec es el Día 1 de docs/plan/modulo-2-backend-clientes.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m2-dia1.md.`
- **Para armar el esqueleto:** `Cargá nodejs-typescript-app y armá el backend según el Día 1 de mi módulo: estructura por entidad, Express 5 sin asyncHandler, sin cors(), logs a consola, Vitest.`
- **Para el review de M3:** `Usá code-review-expert para revisar la rama de M3 contra main.`
