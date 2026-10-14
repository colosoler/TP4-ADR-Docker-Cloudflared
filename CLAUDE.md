# Concesionaria Honda La Plata — TP Docker + Cloudflare Tunnel

Proyecto académico en grupo (5 integrantes, no afiliado a Honda). Es un CRUD con:
- Node.js 24 + Express 5 + TypeScript;
- React 19 + Vite + TypeScript;
- PostgreSQL 17;
- Nginx como reverse proxy;
- Docker Compose y Cloudflare Tunnel (Quick Tunnel).

## Antes de tocar código

El TP dura **4 días**:

| Día | Qué se hace |
|---|---|
| 1 | Infraestructura |
| 2 | El CRUD de cada uno |
| 3 | Hardening y chaos test |
| 4 | Ensayo |

**No agregues nada que el plan no pida.**

1. **Identificá en qué módulo trabaja la persona (M1–M5).** Si no lo dice, preguntale. Después leé:
   - `docs/plan/00-plan-general.md`: el **contrato** del grupo (servicios, puertos, redes, variables de entorno, rutas de la API, formato de error, DDL, reglas entre módulos, firmas compartidas);
   - el documento de su módulo en `docs/plan/modulo-N-*.md`.
2. **El contrato manda.** No cambies nombres, rutas, puertos, campos ni firmas por tu cuenta. Si algo no alcanza, frená y avisale a la persona: el cambio se acuerda en el grupo y se edita en `00-plan-general.md`.
3. **Tocá solo los archivos del módulo de la persona** (ver §4 del contrato). Desde el día 2, cada uno trabaja solo en:
   - `backend/src/modules/<su-entidad>/`;
   - `frontend/src/features/<su-entidad>/`;
   - su archivo de `db/init/`.

## Qué skill usar (en `.claude/skills/`)

| Tarea | Skill |
|---|---|
| Arrancar una fase: pasar el documento del módulo a tareas | `writing-plans`. Guardar en `docs/tareas/m<N>-fase<F>-<tema>.md`. Menciona sub-skills `superpowers:*` que no están instaladas: ejecutá el plan inline, tarea por tarea. |
| Código del backend (Express, rutas, services, errores) | `nodejs-typescript-app`, con las diferencias del contrato: estructura por entidad, Express 5 sin `asyncHandler`, sin `cors()`, logs solo a consola, Vitest |
| SQL, tablas, roles, pool | `supabase-postgres-best-practices` |
| Código del frontend (componentes, React Query, cliente de API) | `react-typescript-app`, con Tailwind v4 y tokens en `@theme` |
| Dirección visual (solo M3, una vez) | `frontend-design` |
| Auditar y pulir la UI | `impeccable` (opcional, M3 el día 3) |
| Cualquier feature o fix | `test-driven-development`: test primero |
| Algo falla | `systematic-debugging`: causa raíz antes de parchear |
| Antes de decir "listo" o abrir un PR | `verification-before-completion`: evidencia real, no "debería andar" |
| Revisar el PR de un compañero | `code-review-expert` |
| Estudiar para la exposición | `sigma` |

No aplican en este proyecto:
- `java-spring-boot-app`;
- `supabase` (usamos un Postgres propio);
- `animate-expo`;
- `book-study`, `wiki-ingest`, `skill-forge`, `skill-review`.

## Reglas de código

- **TypeScript:** `strict`, sin `any`.
- **Dominio simple a propósito:** 5 tablas independientes (modelos, clientes, autos, vendedores, sucursales), sin relaciones entre sí ni reglas de negocio cruzadas. No agregues claves foráneas, transacciones ni filtros que el contrato no pida.
- **Dominio en español**, sin tildes ni ñ en los identificadores: `autos`, `anio`, `sucursales`.
- **Textos:** los de la UI y los mensajes de error, en español.
- **SQL:** siempre parametrizado (`$1`, `$2`). Nunca concatenar input del usuario.
- **Acceso a la base:** solo con `query()` de `backend/src/db/pool.ts`, nunca `pool.query` directo. Así la caída de la base responde 503.
- **Validación:** con zod dentro del handler (`schema.parse(...)`). El `errorHandler` traduce los errores al formato `{ error: { code, message, details? } }`.
- **Logs:** solo a stdout. Nunca escribir en disco (los contenedores son `read_only`). Nunca loguear DNI, emails ni bodies.
- **Frontend:** rutas de la API relativas (`apiGet('/autos')`), sin URLs absolutas. Fuentes con `@fontsource`, nunca Google Fonts por URL (lo bloquea la CSP).
- **Docker:** imágenes con versión fija, nunca `latest`.
- **Git:** nunca commitear `.env`, `node_modules/`, `dist/` ni backups.

## Comandos

```bash
docker compose up -d --build                      # levantar todo → http://localhost:8080
docker compose ps                                 # todos (healthy)
docker compose logs -f <servicio>
docker compose down -v && docker compose up -d --build   # re-ejecuta db/init (BORRA los datos)
docker compose --profile tunnel up -d             # + Cloudflare Tunnel; URL: ./scripts/tunnel-url.sh
npm run dev --prefix frontend                     # Vite en :5173 contra el stack en Docker (/api → :8080)

# Verificación
npm test --prefix backend
npm test --prefix frontend
npx tsc --noEmit -p backend
npx tsc --noEmit -p frontend
./scripts/chaos-test.sh                           # la base se cae, la app no
```
