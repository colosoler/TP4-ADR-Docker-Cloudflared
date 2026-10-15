# M2 · Día 1 — Esqueleto del backend: plan de implementación

> **Cómo ejecutarlo:** tarea por tarea, en la misma sesión (las sub-skills `superpowers:*` que menciona `writing-plans` no están instaladas en este repo). Los pasos usan checkboxes (`- [ ]`) para ir marcando el avance.

**Objetivo:** dejar el esqueleto del backend (Express 5 + TypeScript) que los 5 módulos usan el día 2, con la conexión a Postgres resiliente (si la base se cae, responde 503 y el proceso sigue vivo) y su Dockerfile multi-stage no-root.

**Arquitectura:** `app.ts` arma Express (JSON, rutas bajo `/api`, 404 y `errorHandler`) y se exporta sin `listen`, para testearlo con Supertest; `index.ts` solo escucha. Todo acceso a la base pasa por `query()` de `db/pool.ts`, que convierte los errores de conexión en `ServiceUnavailableError` (503), y el `errorHandler` traduce cualquier error al formato de §5.4. Cada entidad tiene su carpeta en `modules/`, con un router vacío ya registrado.

**Stack:** Node 24 · TypeScript (`strict`) · Express 5 · `pg` 8 · zod 4 · Vitest + Supertest · tsx · Docker (`node:24-alpine`).

**Spec:** `docs/plan/modulo-2-backend-clientes.md`, sección "Día 1". **Contrato:** `docs/plan/00-plan-general.md` (§4, §5.2–§5.5, §5.8, §7 y §10).

**Rama:** `m2/dia1-backend`, con PR a `main`. Revisa M1 con `code-review-expert`.

## Restricciones globales

- Express 5 **sin `asyncHandler`**: los errores de los handlers `async` llegan solos al `errorHandler`.
- **Sin `cors()`**: todo entra por el proxy, con un único origen.
- TypeScript `strict`, **sin `any`**.
- Logs **solo a stdout** (`console.log`), nunca a archivos (el contenedor es `read_only`). Nunca loguear DNI, emails ni bodies.
- Acceso a la base **solo con `query()`** de `src/db/pool.ts`. El `pool` no se exporta.
- SQL siempre parametrizado (`$1`, `$2`).
- Formato de error: `{ "error": { "code", "message", "details?" } }`. `message` va en español; `details` solo en los `400`.
- `GET /api/health` responde **siempre `200`**: `{ "status": "ok", "db": "up" }`, o `"db": "down"` con la base caída.
- El backend no lee el `.env`: `pg` lee solo `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER` y `PGPASSWORD`; el puerto sale de `PORT=4000`.
- Imagen con versión fija: `node:24-alpine`. El `package-lock.json` se commitea.
- Nunca se commitea: `.env`, `node_modules/`, `dist/`.
- Solo se tocan `backend/` y este plan. Los 5 `modules/<entidad>/<entidad>.routes.ts` se crean vacíos; desde el día 2 cada uno es de su dueño.
- **Test primero** (skill `test-driven-development`): ver fallar el test antes de escribir el código.

## Decisiones tomadas al armar el plan

- **Versiones** (las últimas estables al 14/10/2026): express 5.3, pg 8.23, zod 4.6, typescript 7.0, tsx 4.23, vitest 5.0, supertest 7.3 y `@types/node` 24 (la versión de Node que usamos). El `tsc` de TypeScript 7 es un binario nativo estático: anda igual en Windows y en `node:24-alpine`.
- **`tsconfig.json`:** el de la skill `nodejs-typescript-app`, con `rootDir: "src"`, `outDir: "dist"` e `include: ["src/**/*.ts"]` (con `rootDir: "src"`, el `./**/*.ts` de la skill no compila). Se agrega `"types": ["node"]`: desde TypeScript 6, `types` vale `[]` por defecto y, sin eso, `tsc` no encuentra `console` ni `process`.
- **Tests al lado del código** (`src/**/*.test.ts`), como pide la receta del día 2. `tsconfig.json` los incluye (así `tsc --noEmit` también los chequea) y `tsconfig.build.json` los excluye (no llegan a `dist/` ni a la imagen).
- **Tests extra.** Además de los que pide el módulo (health y `errorHandler`), hay tests chicos para `logger`, `pool` (parsers, y `query`/`checkDb` contra una base inalcanzable y una colgada, sin mocks), `idParamSchema` y el armado de `app` (404, JSON mal formado, sin `x-powered-by`). Los tests unitarios de `isConnectionError` quedan para el día 3, como dice el módulo.
- **`idParamSchema`** es el de la spec, con el mensaje en español ("El ID tiene que ser un número entero positivo"); sin eso, zod responde en inglés.
- **Exports con nombre:** `app`, `routes`, `healthRouter`, `<entidad>Router`, `logger`, `config`, `errorHandler`, `query`, `checkDb`, `isConnectionError` e `idParamSchema`.
- **`config.ts`** (figura en §4) solo tiene `port`: `Number(process.env.PORT) || 4000`.
- **Docker antes de que estén M3 y M4.** Sin el proxy ni el frontend, `docker compose up` no puede levantar todo: la verificación se hace con `docker compose up -d --build db backend` y `docker exec` (Tarea 7). Cuando se mergee el proxy, vale el `curl http://localhost:8080/api/health` del "Listo cuando".

## Estructura de archivos

```
backend/
├── .dockerignore                 node_modules, dist, .env
├── Dockerfile                    multi-stage, no-root, HEALTHCHECK
├── package.json  package-lock.json
├── tsconfig.json                 strict, CommonJS, src → dist (incluye los tests)
├── tsconfig.build.json           igual, sin los *.test.ts
└── src/
    ├── index.ts                  app.listen(config.port)
    ├── app.ts                    Express: JSON, /api, 404, errorHandler (sin listen)
    ├── app.test.ts
    ├── config.ts                 port
    ├── logger.ts                 logger.info / logger.error → stdout
    ├── logger.test.ts
    ├── errors.ts                 AppError, NotFoundError, ConflictError, ServiceUnavailableError
    ├── db/pool.ts                parsers, Pool, on('error'), isConnectionError, query, checkDb
    ├── db/pool.test.ts
    ├── middleware/errorHandler.ts
    ├── middleware/errorHandler.test.ts
    ├── shared/schemas.ts         idParamSchema
    ├── shared/schemas.test.ts
    ├── routes/index.ts           /health + los 5 recursos
    ├── routes/health.ts          GET / → { status, db }
    ├── routes/health.test.ts
    └── modules/{modelos,clientes,autos,vendedores,sucursales}/<entidad>.routes.ts   Router() vacío
```

Todos los comandos se corren **desde la raíz del repo**. Para correr un solo archivo de tests: `npm test --prefix backend -- src/logger.test.ts`.

---

### Tarea 1: Proyecto y logger

**Archivos:**
- Crear: `backend/package.json`, `backend/tsconfig.json`, `backend/tsconfig.build.json`, `backend/src/logger.ts`
- Generado por npm: `backend/package-lock.json`
- Test: `backend/src/logger.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `logger.info(message: string, data?: Record<string, unknown>): void` y `logger.error(...)` con la misma firma. Escriben una línea en stdout: `<fecha ISO> <NIVEL> <mensaje> <data en JSON>`.

- [ ] **Paso 1: `backend/package.json`**

```json
{
  "name": "concesionaria-backend",
  "version": "1.0.0",
  "private": true,
  "description": "API REST de la Concesionaria Honda La Plata (TP Docker + Cloudflare Tunnel)",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/index.js",
    "test": "vitest run",
    "dev": "tsx watch src/index.ts"
  }
}
```

- [ ] **Paso 2: `backend/tsconfig.json` y `backend/tsconfig.build.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "dist", "src/**/*.test.ts"]
}
```

- [ ] **Paso 3: instalar las dependencias** (genera `package-lock.json`)

```bash
cd backend
npm install express@5 pg zod@4
npm install -D typescript tsx vitest supertest @types/express @types/pg @types/supertest @types/node@24
cd ..
```

- [ ] **Paso 4: escribir el test que falla** — `backend/src/logger.test.ts`

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('logger', () => {
  it('escribe una línea con la fecha, el nivel, el mensaje y los datos', () => {
    const consola = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.info('Backend escuchando', { port: 4000 });

    expect(consola).toHaveBeenCalledOnce();
    expect(consola.mock.calls[0][0]).toMatch(/^\d{4}-\d{2}-\d{2}T\S+ INFO Backend escuchando \{"port":4000\}$/);
  });

  it('los errores también van a stdout (nunca a un archivo)', () => {
    const consola = vi.spyOn(console, 'log').mockImplementation(() => {});

    logger.error('Se cayó algo');

    expect(consola).toHaveBeenCalledOnce();
    expect(consola.mock.calls[0][0]).toMatch(/ ERROR Se cayó algo$/);
  });
});
```

- [ ] **Paso 5: correrlo y verlo fallar**

Correr: `npm test --prefix backend -- src/logger.test.ts`
Esperado: FAIL, porque no existe `./logger`.

- [ ] **Paso 6: implementación mínima** — `backend/src/logger.ts`

```ts
type Level = 'info' | 'error';
type LogData = Record<string, unknown>;

// Todo va a stdout: el contenedor es de solo lectura y Docker junta la salida
// (docker compose logs backend). Nunca pasar DNI, emails ni bodies en `data`.
function write(level: Level, message: string, data?: LogData): void {
  const extra = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`${new Date().toISOString()} ${level.toUpperCase()} ${message}${extra}`);
}

export const logger = {
  info: (message: string, data?: LogData): void => write('info', message, data),
  error: (message: string, data?: LogData): void => write('error', message, data),
};
```

- [ ] **Paso 7: correrlo y verlo pasar**

Correr: `npm test --prefix backend -- src/logger.test.ts` y `npx tsc --noEmit -p backend`
Esperado: 2 tests PASS; `tsc` sin salida (exit 0).

- [ ] **Paso 8: commit**

```bash
git add backend/package.json backend/package-lock.json backend/tsconfig.json backend/tsconfig.build.json backend/src/logger.ts backend/src/logger.test.ts
git commit -m "M2: proyecto del backend y logger a stdout"
```

---

### Tarea 2: Errores y `errorHandler`

**Archivos:**
- Crear: `backend/src/errors.ts`, `backend/src/middleware/errorHandler.ts`
- Test: `backend/src/middleware/errorHandler.test.ts`

**Interfaces:**
- Consume: `logger.error` (Tarea 1).
- Produce:
  - `type ErrorDetail = { path: string; message: string }`
  - `class AppError extends Error { statusCode: number; code: string; details?: ErrorDetail[] }`, con constructor `(statusCode, code, message, details?)`
  - `new NotFoundError(message)` → 404 `NOT_FOUND` · `new ConflictError(message)` → 409 `CONFLICT` · `new ServiceUnavailableError()` → 503 `DB_UNAVAILABLE`
  - `errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void`

- [ ] **Paso 1: escribir los tests que fallan** — `backend/src/middleware/errorHandler.test.ts`

```ts
import express, { type Express } from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ConflictError, NotFoundError, ServiceUnavailableError } from '../errors';
import { logger } from '../logger';
import { errorHandler } from './errorHandler';

// App mínima: un POST que ejecuta `lanzar` y, al final, el errorHandler
function appQueLanza(lanzar: () => unknown): Express {
  const app = express();
  app.use(express.json());
  app.post('/', () => {
    lanzar();
  });
  app.use(errorHandler);
  return app;
}

function pgError(code: string): Error {
  return Object.assign(new Error(`error de Postgres ${code}`), { code });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('errorHandler', () => {
  it('ZodError → 400 VALIDATION_ERROR con details', async () => {
    const schema = z.object({ dni: z.string().regex(/^\d{7,8}$/, 'El DNI debe tener 7 u 8 dígitos') });

    const res = await request(appQueLanza(() => schema.parse({ dni: '123' }))).post('/').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ path: 'dni', message: 'El DNI debe tener 7 u 8 dígitos' }],
      },
    });
  });

  it('pg 23505 → 409 CONFLICT', async () => {
    const res = await request(appQueLanza(() => { throw pgError('23505'); })).post('/').send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'Ya existe un registro con ese valor' } });
  });

  it('ServiceUnavailableError → 503 DB_UNAVAILABLE', async () => {
    const res = await request(appQueLanza(() => { throw new ServiceUnavailableError(); })).post('/').send({});

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'DB_UNAVAILABLE', message: 'La base de datos no está disponible. Reintentá en unos segundos.' },
    });
  });

  it("Error('boom') → 500 INTERNAL_ERROR, sin stack en el body (el stack va al log)", async () => {
    const logError = vi.spyOn(logger, 'error').mockImplementation(() => {});

    const res = await request(appQueLanza(() => { throw new Error('boom'); })).post('/').send({});

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Error interno del servidor' } });
    expect(res.text).not.toContain('boom');
    expect(logError).toHaveBeenCalledOnce();
    expect(JSON.stringify(logError.mock.calls[0])).toContain('Error: boom');
  });

  it('NotFoundError → 404 NOT_FOUND con su mensaje', async () => {
    const res = await request(appQueLanza(() => { throw new NotFoundError('Cliente no encontrado'); })).post('/').send({});

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Cliente no encontrado' } });
  });

  it('ConflictError → 409 CONFLICT con su mensaje', async () => {
    const res = await request(appQueLanza(() => { throw new ConflictError('Ya existe un cliente con ese DNI'); })).post('/').send({});

    expect(res.status).toBe(409);
    expect(res.body).toEqual({ error: { code: 'CONFLICT', message: 'Ya existe un cliente con ese DNI' } });
  });

  it.each(['23514', '22P02'])('pg %s → 400 VALIDATION_ERROR', async (code) => {
    const res = await request(appQueLanza(() => { throw pgError(code); })).post('/').send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos' } });
  });

  it('JSON mal formado → 400 "El cuerpo no es un JSON válido"', async () => {
    const res = await request(appQueLanza(() => undefined))
      .post('/')
      .set('Content-Type', 'application/json')
      .send('{"dni": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'El cuerpo no es un JSON válido' } });
  });
});
```

- [ ] **Paso 2: correrlos y verlos fallar**

Correr: `npm test --prefix backend -- src/middleware/errorHandler.test.ts`
Esperado: FAIL, porque no existen `../errors` ni `./errorHandler`.

- [ ] **Paso 3: `backend/src/errors.ts`**

```ts
export type ErrorDetail = { path: string; message: string };

// Error "esperado": el errorHandler responde con su statusCode, code y message
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(statusCode: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

// new NotFoundError('Cliente no encontrado') → 404
export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
  }
}

// new ConflictError('Ya existe un cliente con ese DNI') → 409
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

// La base no responde → 503. Lo lanza query() de db/pool.ts.
export class ServiceUnavailableError extends AppError {
  constructor() {
    super(503, 'DB_UNAVAILABLE', 'La base de datos no está disponible. Reintentá en unos segundos.');
  }
}
```

- [ ] **Paso 4: `backend/src/middleware/errorHandler.ts`**

```ts
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorDetail } from '../errors';
import { logger } from '../logger';

type ErrorBody = { error: { code: string; message: string; details?: ErrorDetail[] } };

function errorBody(code: string, message: string, details?: ErrorDetail[]): ErrorBody {
  return { error: details ? { code, message, details } : { code, message } };
}

function pgErrorCode(err: unknown): string | undefined {
  if (typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string') {
    return err.code;
  }
  return undefined;
}

// express.json() lanza un SyntaxError con type 'entity.parse.failed' si el body no es JSON
function isInvalidJson(err: unknown): boolean {
  return err instanceof SyntaxError && 'type' in err && err.type === 'entity.parse.failed';
}

// Traduce cualquier error al formato del contrato (§5.4): { error: { code, message, details? } }.
// Express 5 le pasa también los errores de los handlers async: no hace falta asyncHandler.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorBody(err.code, err.message, err.details));
    return;
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    res.status(400).json(errorBody('VALIDATION_ERROR', 'Datos inválidos', details));
    return;
  }
  if (isInvalidJson(err)) {
    res.status(400).json(errorBody('VALIDATION_ERROR', 'El cuerpo no es un JSON válido'));
    return;
  }
  const pgCode = pgErrorCode(err);
  if (pgCode === '23505') {
    res.status(409).json(errorBody('CONFLICT', 'Ya existe un registro con ese valor'));
    return;
  }
  if (pgCode === '23514' || pgCode === '22P02') {
    res.status(400).json(errorBody('VALIDATION_ERROR', 'Datos inválidos'));
    return;
  }
  // El stack va solo al log, nunca a la respuesta
  logger.error('Error no controlado', {
    method: req.method,
    path: req.path,
    stack: err instanceof Error ? err.stack : String(err),
  });
  res.status(500).json(errorBody('INTERNAL_ERROR', 'Error interno del servidor'));
}
```

- [ ] **Paso 5: correrlos y verlos pasar**

Correr: `npm test --prefix backend -- src/middleware/errorHandler.test.ts` y `npx tsc --noEmit -p backend`
Esperado: 9 tests PASS; `tsc` sin salida.

- [ ] **Paso 6: commit**

```bash
git add backend/src/errors.ts backend/src/middleware
git commit -m "M2: errores de la app y errorHandler con el formato del contrato"
```

---

### Tarea 3: `db/pool.ts`, el corazón del chaos test

**Archivos:**
- Crear: `backend/src/db/pool.ts`
- Test: `backend/src/db/pool.test.ts`

**Interfaces:**
- Consume: `ServiceUnavailableError` (Tarea 2) y `logger.error` (Tarea 1).
- Produce:
  - `query<T>(text: string, params?: unknown[]): Promise<T[]>`: devuelve `rows`; si el error es de conexión lanza `ServiceUnavailableError`, y cualquier otro lo relanza tal cual.
  - `checkDb(): Promise<boolean>`: `select 1` con un límite de 1,5 s; nunca lanza.
  - `isConnectionError(err: unknown): boolean` (sus tests unitarios son del día 3).

- [ ] **Paso 1: escribir los tests que fallan** — `backend/src/db/pool.test.ts`

Sin mocks: la "base caída" es un puerto donde no escucha nadie, y la "base colgada" es un servidor TCP que acepta la conexión y nunca contesta.

```ts
import { createServer, type AddressInfo, type Socket } from 'node:net';
import { types } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '../errors';
import { checkDb, query } from './pool';

// Puerto donde no escucha nadie: una base caída de verdad
const PUERTO_SIN_BASE = 1;

// pg lee PGHOST y PGPORT cada vez que abre una conexión
function apuntarLaBaseA(port: number): void {
  vi.stubEnv('PGHOST', '127.0.0.1');
  vi.stubEnv('PGPORT', String(port));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parsers de tipos', () => {
  it('bigint (ids) y numeric (precios) llegan como number, no como texto', () => {
    expect(types.getTypeParser(types.builtins.INT8, 'text')('42')).toBe(42);
    expect(types.getTypeParser(types.builtins.NUMERIC, 'text')('42500000.50')).toBe(42500000.5);
  });
});

describe('query()', () => {
  it('con la base inalcanzable lanza ServiceUnavailableError (503)', async () => {
    apuntarLaBaseA(PUERTO_SIN_BASE);

    await expect(query('select 1')).rejects.toBeInstanceOf(ServiceUnavailableError);
  });
});

describe('checkDb()', () => {
  it('con la base inalcanzable devuelve false, sin lanzar', async () => {
    apuntarLaBaseA(PUERTO_SIN_BASE);

    await expect(checkDb()).resolves.toBe(false);
  });

  it('con la base colgada corta a los 1,5 s y devuelve false', async () => {
    const conexiones: Socket[] = [];
    const baseColgada = createServer((socket) => {
      conexiones.push(socket); // acepta y nunca contesta
    });
    await new Promise<void>((resolve) => baseColgada.listen(0, '127.0.0.1', resolve));
    apuntarLaBaseA((baseColgada.address() as AddressInfo).port);

    const inicio = Date.now();
    const resultado = await checkDb();
    const demora = Date.now() - inicio;

    conexiones.forEach((socket) => socket.destroy());
    baseColgada.close();

    expect(resultado).toBe(false);
    expect(demora).toBeGreaterThanOrEqual(1_400);
    expect(demora).toBeLessThan(2_500);
  });
});
```

- [ ] **Paso 2: correrlos y verlos fallar**

Correr: `npm test --prefix backend -- src/db/pool.test.ts`
Esperado: FAIL, porque no existe `./pool`.

- [ ] **Paso 3: implementación** — `backend/src/db/pool.ts`

```ts
import { Pool, types } from 'pg';
import { ServiceUnavailableError } from '../errors';
import { logger } from '../logger';

// Sin esto, pg devuelve los bigint (ids) y los numeric (precios) como texto
types.setTypeParser(types.builtins.INT8, (v) => Number(v));
types.setTypeParser(types.builtins.NUMERIC, (v) => Number(v));

// Los datos de conexión salen de PGHOST, PGPORT, PGDATABASE, PGUSER y PGPASSWORD (los lee pg solo).
// Timeouts cortos: con la base caída, la request falla en ~3 s en vez de quedarse colgada.
// El pool no se exporta: todo el acceso a la base pasa por query().
const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 3_000,
  query_timeout: 10_000,
});

// Sin este listener, un error en una conexión inactiva (por ejemplo, porque se cayó la base)
// mata todo el proceso de Node
pool.on('error', (err) => {
  logger.error('Se cortó una conexión inactiva con la base', { message: err.message });
});

const CONNECTION_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'ECONNRESET',
  'EHOSTUNREACH',
  '57P01', // admin_shutdown: apagaron la base
  '57P03', // cannot_connect_now: la base está arrancando
  '08000', // connection_exception
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '08003', // connection_does_not_exist
  '08006', // connection_failure
]);

const CONNECTION_ERROR_MESSAGES = [
  'Connection terminated',
  'timeout exceeded when trying to connect',
  'Query read timeout',
];

export function isConnectionError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('code' in err && typeof err.code === 'string' && CONNECTION_ERROR_CODES.has(err.code)) {
    return true;
  }
  const message = 'message' in err && typeof err.message === 'string' ? err.message : '';
  return CONNECTION_ERROR_MESSAGES.some((texto) => message.includes(texto));
}

// Usar SIEMPRE esto, nunca pool.query directo: si no, la caída de la base da 500 en vez de 503
export async function query<T>(text: string, params?: unknown[]): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows;
  } catch (err) {
    if (isConnectionError(err)) throw new ServiceUnavailableError();
    throw err;
  }
}

const CHECK_DB_TIMEOUT_MS = 1_500;

// Para /api/health: true o false, nunca lanza y nunca tarda más de 1,5 s
export async function checkDb(): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), CHECK_DB_TIMEOUT_MS);
  });
  const ping = pool.query('select 1').then(
    () => true,
    () => false,
  );
  try {
    return await Promise.race([ping, timeout]);
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Paso 4: correrlos y verlos pasar**

Correr: `npm test --prefix backend -- src/db/pool.test.ts` y `npx tsc --noEmit -p backend`
Esperado: 4 tests PASS; `tsc` sin salida.

- [ ] **Paso 5: commit**

```bash
git add backend/src/db
git commit -m "M2: pool de Postgres resiliente: query() da 503 con la base caida y checkDb()"
```

---

### Tarea 4: `shared/schemas.ts`

**Archivos:**
- Crear: `backend/src/shared/schemas.ts`
- Test: `backend/src/shared/schemas.test.ts`

**Interfaces:**
- Consume: nada.
- Produce: `idParamSchema`, un `z.object({ id })` que convierte el `:id` a un entero positivo. Uso: `const { id } = idParamSchema.parse(req.params)`.

- [ ] **Paso 1: escribir los tests que fallan** — `backend/src/shared/schemas.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { idParamSchema } from './schemas';

describe('idParamSchema', () => {
  it('convierte el :id de texto a número', () => {
    expect(idParamSchema.parse({ id: '7' })).toEqual({ id: 7 });
  });

  it.each(['abc', '0', '-3', '1.5'])('rechaza el id %j con un mensaje en español', (id) => {
    const result = idParamSchema.safeParse({ id });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ['id'],
      message: 'El ID tiene que ser un número entero positivo',
    });
  });
});
```

- [ ] **Paso 2: correrlos y verlos fallar**

Correr: `npm test --prefix backend -- src/shared/schemas.test.ts`
Esperado: FAIL, porque no existe `./schemas`.

- [ ] **Paso 3: implementación** — `backend/src/shared/schemas.ts`

```ts
import { z } from 'zod';

const ID_INVALIDO = 'El ID tiene que ser un número entero positivo';

// Uso: const { id } = idParamSchema.parse(req.params)
export const idParamSchema = z.object({
  id: z.coerce.number({ error: ID_INVALIDO }).int({ error: ID_INVALIDO }).positive({ error: ID_INVALIDO }),
});
```

- [ ] **Paso 4: correrlos y verlos pasar**

Correr: `npm test --prefix backend -- src/shared/schemas.test.ts` y `npx tsc --noEmit -p backend`
Esperado: 5 tests PASS; `tsc` sin salida.

- [ ] **Paso 5: commit**

```bash
git add backend/src/shared
git commit -m "M2: idParamSchema compartido"
```

---

### Tarea 5: `app.ts`, rutas, health y las 5 carpetas de `modules/`

**Archivos:**
- Crear: `backend/src/app.ts`, `backend/src/routes/index.ts`, `backend/src/routes/health.ts`
- Crear: `backend/src/modules/{modelos,clientes,autos,vendedores,sucursales}/<entidad>.routes.ts`
- Test: `backend/src/routes/health.test.ts`, `backend/src/app.test.ts`

**Interfaces:**
- Consume: `checkDb` (Tarea 3), `NotFoundError` (Tarea 2), `errorHandler` (Tarea 2).
- Produce:
  - `app: Express`, exportado sin `listen` (lo usan los tests de los 5 módulos el día 2: `request(app).get('/api/clientes')`).
  - `routes: Router` (montado en `/api`) y `healthRouter: Router`.
  - `modelosRouter`, `clientesRouter`, `autosRouter`, `vendedoresRouter` y `sucursalesRouter`: un `Router()` vacío en cada `modules/<entidad>/<entidad>.routes.ts`, ya registrado. El día 2 cada dueño le agrega sus 5 endpoints **sin cambiar el nombre del export**.

- [ ] **Paso 1: escribir los tests que fallan** — `backend/src/routes/health.test.ts`

```ts
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { app } from '../app';
import { checkDb } from '../db/pool';

vi.mock('../db/pool', () => ({ checkDb: vi.fn() }));

describe('GET /api/health', () => {
  it('con la base arriba responde 200 con db "up"', async () => {
    vi.mocked(checkDb).mockResolvedValue(true);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });

  it('con la base caída responde 200 igual, con db "down"', async () => {
    vi.mocked(checkDb).mockResolvedValue(false);

    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', db: 'down' });
  });
});
```

Y `backend/src/app.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from './app';

describe('app', () => {
  it('una ruta que no existe responde 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: 'Ruta no encontrada' } });
  });

  it('un body que no es JSON responde 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/clientes')
      .set('Content-Type', 'application/json')
      .send('{"nombre": ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'VALIDATION_ERROR', message: 'El cuerpo no es un JSON válido' } });
  });

  it('no expone el header x-powered-by', async () => {
    const res = await request(app).get('/api/no-existe');

    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
```

- [ ] **Paso 2: correrlos y verlos fallar**

Correr: `npm test --prefix backend -- src/routes/health.test.ts src/app.test.ts`
Esperado: FAIL, porque no existe `../app` (ni `./app`).

- [ ] **Paso 3: los 5 routers vacíos**

`backend/src/modules/modelos/modelos.routes.ts`:

```ts
import { Router } from 'express';

// Día 2 (M1): los 5 endpoints de Modelos, con la receta de §5.7
export const modelosRouter: Router = Router();
```

`backend/src/modules/clientes/clientes.routes.ts`:

```ts
import { Router } from 'express';

// Día 2 (M2): los 5 endpoints de Clientes, con la receta de §5.7
export const clientesRouter: Router = Router();
```

`backend/src/modules/autos/autos.routes.ts`:

```ts
import { Router } from 'express';

// Día 2 (M3): los 5 endpoints de Autos, con la receta de §5.7
export const autosRouter: Router = Router();
```

`backend/src/modules/vendedores/vendedores.routes.ts`:

```ts
import { Router } from 'express';

// Día 2 (M4): los 5 endpoints de Vendedores, con la receta de §5.7
export const vendedoresRouter: Router = Router();
```

`backend/src/modules/sucursales/sucursales.routes.ts`:

```ts
import { Router } from 'express';

// Día 2 (M5): los 5 endpoints de Sucursales, con la receta de §5.7
export const sucursalesRouter: Router = Router();
```

- [ ] **Paso 4: `backend/src/routes/health.ts` y `backend/src/routes/index.ts`**

```ts
import { Router } from 'express';
import { checkDb } from '../db/pool';

export const healthRouter: Router = Router();

// Siempre 200 mientras Node esté vivo: así el healthcheck de Docker no mata al backend
// cuando se cae la base, y el frontend se entera de cuándo volvió
healthRouter.get('/', async (_req, res) => {
  const dbUp = await checkDb();
  res.json({ status: 'ok', db: dbUp ? 'up' : 'down' });
});
```

```ts
import { Router } from 'express';
import { autosRouter } from '../modules/autos/autos.routes';
import { clientesRouter } from '../modules/clientes/clientes.routes';
import { modelosRouter } from '../modules/modelos/modelos.routes';
import { sucursalesRouter } from '../modules/sucursales/sucursales.routes';
import { vendedoresRouter } from '../modules/vendedores/vendedores.routes';
import { healthRouter } from './health';

// Todo cuelga de /api (ver app.ts). Cada módulo solo toca su archivo de modules/.
export const routes: Router = Router();

routes.use('/health', healthRouter);
routes.use('/modelos', modelosRouter);
routes.use('/clientes', clientesRouter);
routes.use('/autos', autosRouter);
routes.use('/vendedores', vendedoresRouter);
routes.use('/sucursales', sucursalesRouter);
```

- [ ] **Paso 5: `backend/src/app.ts`**

```ts
import express, { type Express } from 'express';
import { NotFoundError } from './errors';
import { errorHandler } from './middleware/errorHandler';
import { routes } from './routes';

// Se exporta sin listen (eso lo hace index.ts) para poder testearla con Supertest.
// Sin cors(): el navegador habla siempre con un único origen, el proxy.
export const app: Express = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use('/api', routes);
app.use((_req, _res, next) => {
  next(new NotFoundError('Ruta no encontrada'));
});
app.use(errorHandler);
```

- [ ] **Paso 6: correrlos y verlos pasar**

Correr: `npm test --prefix backend` y `npx tsc --noEmit -p backend`
Esperado: 25 tests PASS (los 6 archivos); `tsc` sin salida.

- [ ] **Paso 7: commit**

```bash
git add backend/src/app.ts backend/src/app.test.ts backend/src/routes backend/src/modules
git commit -m "M2: app de Express, /api/health y routers vacios de los 5 modulos"
```

---

### Tarea 6: `config.ts`, `index.ts` y build

**Archivos:**
- Crear: `backend/src/config.ts`, `backend/src/index.ts`

**Interfaces:**
- Consume: `app` (Tarea 5) y `logger` (Tarea 1).
- Produce: `config.port: number` y el proceso que escucha en `:4000`.

`index.ts` solo hace `listen`: no tiene lógica para testear con Vitest. Se verifica levantándolo de verdad, con la base inalcanzable.

- [ ] **Paso 1: `backend/src/config.ts`**

```ts
// El compose pasa PORT=4000 (§5.2). Las variables PG* las lee pg solo (ver db/pool.ts).
export const config = {
  port: Number(process.env.PORT) || 4000,
};
```

- [ ] **Paso 2: `backend/src/index.ts`**

```ts
import { app } from './app';
import { config } from './config';
import { logger } from './logger';

app.listen(config.port, (error) => {
  if (error) {
    logger.error('No se pudo levantar el servidor', { message: error.message });
    process.exit(1);
  }
  logger.info(`Backend escuchando en el puerto ${config.port}`);
});
```

- [ ] **Paso 3: build**

Correr: `npm run build --prefix backend` y después `find backend/dist -name "*.test.*"`
Esperado: el build termina sin errores y el `find` no lista nada (los tests no llegan a `dist/`).

- [ ] **Paso 4: levantarlo con la base inalcanzable**

En Git Bash / WSL:

```bash
PGHOST=127.0.0.1 PGPORT=1 node backend/dist/index.js &
sleep 1
curl -s http://localhost:4000/api/health       # → {"status":"ok","db":"down"}
curl -s http://localhost:4000/api/no-existe    # → {"error":{"code":"NOT_FOUND","message":"Ruta no encontrada"}}
kill %1
```

En PowerShell (en una terminal el servidor, en otra los `curl.exe`; se corta con Ctrl+C):

```powershell
$env:PGHOST='127.0.0.1'; $env:PGPORT='1'; node backend/dist/index.js
curl.exe -s http://localhost:4000/api/health
Remove-Item Env:PGHOST, Env:PGPORT
```

Esperado: el log `... INFO Backend escuchando en el puerto 4000`, health con `"db":"down"` y **el proceso sigue vivo**.

- [ ] **Paso 5: commit**

```bash
git add backend/src/config.ts backend/src/index.ts
git commit -m "M2: index.ts y config del puerto"
```

---

### Tarea 7: Dockerfile, `.dockerignore` y verificación con Docker

**Archivos:**
- Crear: `backend/Dockerfile`, `backend/.dockerignore`

**Interfaces:**
- Consume: los scripts `build` y `start` (Tarea 1) y `GET /api/health` (Tarea 5).
- Produce: la imagen del servicio `backend` del compose: corre como `node`, escucha en `4000` y tiene `HEALTHCHECK`.

- [ ] **Paso 1: `backend/Dockerfile`** (tal cual el módulo)

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

- [ ] **Paso 2: `backend/.dockerignore`**

```
node_modules
dist
.env
```

- [ ] **Paso 3: la imagen corre como no-root**

```bash
docker build -t backend-test ./backend
docker run --rm backend-test whoami      # → node
```

- [ ] **Paso 4: backend + base con el compose de M1**

Mientras no estén el proxy (M4) y el frontend (M3), se levantan solo `db` y `backend`. El backend no publica puertos, así que se le pregunta desde adentro con `docker exec`.

```bash
cp .env.example .env                       # solo si no existe; cambiar las claves
docker compose up -d --build db backend
docker compose ps                          # db y backend (healthy); el backend tarda ~10 s
docker exec concesionaria_backend node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>r.text()).then(console.log)"
# → {"status":"ok","db":"up"}
docker stop concesionaria_db
docker exec concesionaria_backend node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>r.text()).then(console.log)"
# → {"status":"ok","db":"down"}
docker compose ps backend                  # sigue Up: el proceso no se cayó
docker start concesionaria_db
docker exec concesionaria_backend node -e "fetch('http://127.0.0.1:4000/api/health').then(r=>r.text()).then(console.log)"
# → {"status":"ok","db":"up"} cuando la base vuelve a estar healthy (se recupera solo)
docker compose logs backend                # la línea "Se cortó una conexión inactiva con la base", y ningún crash
```

Con el proxy de M4 ya en `main`, es exactamente el "Listo cuando" del módulo:

```bash
curl -s http://localhost:8080/api/health          # → {"status":"ok","db":"up"}
docker stop concesionaria_db
curl -s http://localhost:8080/api/health          # → "db":"down", y el backend sigue corriendo
docker start concesionaria_db
```

- [ ] **Paso 5: commit**

```bash
git add backend/Dockerfile backend/.dockerignore
git commit -m "M2: Dockerfile multi-stage no-root con HEALTHCHECK"
```

---

### Tarea 8: Verificación final (Definition of Done) y PR

Con la skill `verification-before-completion`: se pega la salida **real** de cada comando, no "debería andar".

- [ ] **Paso 1: tests y tipos**

```bash
npm test --prefix backend          # → 6 archivos, 25 tests, 0 fallas
npx tsc --noEmit -p backend        # → sin salida, exit 0
npm run build --prefix backend     # → sin errores
```

- [ ] **Paso 2: el "Listo cuando" del Día 1** — los comandos de la Tarea 7 (pasos 3 y 4).

- [ ] **Paso 3: nada que no deba ir al repo**

```bash
git status --short                 # sin .env, node_modules/ ni dist/
git check-ignore backend/node_modules backend/dist .env   # → las tres rutas (después de npm ci y del build; si una carpeta no existe, no aparece)
```

- [ ] **Paso 4: checklist contra la spec** (Día 1 de `modulo-2-backend-clientes.md`)

- [ ] 1. Dependencias, scripts, `tsconfig.json` y `tsconfig.build.json` → Tarea 1
- [ ] 2. `errors.ts` con las 4 clases, códigos y el mensaje del 503 → Tarea 2
- [ ] 3. `pool.ts`: parsers, `Pool` con los timeouts, `pool.on('error')`, `isConnectionError`, `query`, `checkDb` → Tarea 3
- [ ] 4. `errorHandler`: `AppError`, `ZodError`, `23505`, `23514`/`22P02`, JSON mal formado, 500 sin stack → Tarea 2
- [ ] 5. `app.ts`, `index.ts`, `logger.ts`, `shared/schemas.ts`, `routes/health.ts`, `routes/index.ts` y los 5 routers vacíos → Tareas 1, 4, 5 y 6
- [ ] 6. `Dockerfile` y `.dockerignore` → Tarea 7
- [ ] 7. Tests de health (up/down, los dos `200`) y de `errorHandler` (400, 409, 503, 500 sin stack) → Tareas 2 y 5

- [ ] **Paso 5: push y PR**

```bash
git push -u origin m2/dia1-backend
```

PR a `main` con título `Módulo 2: esqueleto del backend` y, en la descripción, la salida de los pasos 1 a 3. Revisa M1 (`code-review-expert`); no se mergea con hallazgos P0 o P1. Orden de merge del día 1: M2 y M3 → M4 → M1 → M5.
