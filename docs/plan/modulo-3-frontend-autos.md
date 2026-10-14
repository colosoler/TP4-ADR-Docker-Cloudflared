# Módulo 3 — Frontend React, diseño y Autos

| | |
|---|---|
| **Responsable** | _(nombre)_ |
| **Revisás los PR de** | M4 |
| **Revisa tus PR** | M2 |
| **Contrato** | [00-plan-general.md](00-plan-general.md): leé §4, §5.3, §5.4, §5.5, §5.7 y §5.8 antes de empezar |

## Tu módulo en una frase

Armás el **esqueleto del frontend** que usan los 5: React + Vite + TypeScript, la dirección visual, los componentes compartidos y el **aviso de "base caída" con reintento automático**. También armás el Dockerfile con Nginx no-root y el **CRUD de Autos** (las unidades en stock).

## Entregables

- **Fase 0**
  - [ ] `frontend/` completo: Vite + TS + Tailwind, `vite.config.ts`, `Dockerfile`, `nginx.conf`, `.dockerignore`
  - [ ] `frontend/DESIGN.md`
  - [ ] Archivos de `src/`: `main.tsx`, `App.tsx`, `api/client.ts`, `shared/*`
  - [ ] Las 5 páginas placeholder en `src/features/`
- **Fase 1**
  - [ ] `db/init/03_autos.sql`
  - [ ] `backend/src/modules/autos/*`
  - [ ] `frontend/src/features/autos/*`
- **Fase 2**
  - [ ] Auditoría y pulido de UI con `impeccable`
  - [ ] Accesibilidad
  - [ ] Responsive
- **Fase 3**
  - [ ] Exposición: "La app y el frontend"

## Skills que vas a usar

| Skill | Cuándo | Prompt para copiar en Claude Code |
|---|---|---|
| `writing-plans` | Al empezar cada fase | `Usá la skill writing-plans. La spec es la Fase 0 de docs/plan/modulo-3-frontend-autos.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m3-fase0-frontend.md.` |
| `frontend-design` | Fase 0, una sola vez | Ver el paso 3 de la Fase 0 (tiene el brief completo). |
| `react-typescript-app` | Fase 0 y 1 | `Cargá la skill react-typescript-app y armá el esqueleto de frontend/ según la Fase 0 de mi módulo: api/client.ts, React Query y los componentes compartidos con las firmas EXACTAS de §5.8 del contrato. Tailwind v4 con @tailwindcss/vite, tokens en @theme.` |
| `test-driven-development` | Fase 0 (client y format) y Fase 1 (API de autos) | `Con test-driven-development, escribí primero los tests de api/client.ts y shared/format.ts que lista mi módulo, y después implementá.` |
| `supabase-postgres-best-practices` | Fase 1 (tabla) | `Cargá supabase-postgres-best-practices y revisá db/init/03_autos.sql contra references/schema-data-types.md y schema-constraints.md.` |
| `nodejs-typescript-app` | Fase 1 (API) | `Cargá nodejs-typescript-app e implementá backend/src/modules/autos según mi módulo y §5.8 del contrato.` |
| `impeccable` | Fase 2 | `Usá la skill impeccable para auditar el frontend completo (las 5 secciones) en http://localhost:5173: jerarquía, estados vacíos/carga/error, accesibilidad y responsive.` Después: `…aplicá polish sobre los componentes compartidos.` |
| `emil-design-eng` | Fase 2, opcional | `Con emil-design-eng revisá las transiciones del Modal, el Toast y el banner de caída: que se sientan rápidas y respeten prefers-reduced-motion.` |
| `systematic-debugging` | Si algo falla | `Usá systematic-debugging: al recargar /clientes en localhost:8080 aparece un 404 de Nginx.` |
| `verification-before-completion` | Antes de cada PR | `Usá verification-before-completion con los comandos de "Cómo verificarlo" de mi fase.` |
| `code-review-expert` | Cuando revisás a M4 | `Usá code-review-expert para revisar la rama m4/fase0-proxy contra main.` |
| `sigma` | Fase 3 | Ver "Tu parte de la exposición". |

---

## Fase 0 — Esqueleto del frontend (días 1–3)

**Lo usan los 5: tiene que estar mergeado para el día 3.**

### Archivos

```
frontend/
├── Dockerfile  .dockerignore  nginx.conf  DESIGN.md
├── package.json  package-lock.json  vite.config.ts  tsconfig*.json  index.html
└── src/
    ├── main.tsx  App.tsx  index.css
    ├── api/client.ts                       (+ client.test.ts)
    ├── shared/format.ts                    (+ format.test.ts)
    ├── shared/hooks/useToast.tsx  shared/hooks/useDbStatus.ts
    ├── shared/components/Layout.tsx  DataTable.tsx  Modal.tsx  ConfirmDialog.tsx
    │                     FormField.tsx  Toast.tsx  DbDownBanner.tsx  EmptyState.tsx
    └── features/{modelos,clientes,autos,vendedores,sucursales}/<Entidad>Page.tsx  (placeholders)
```

### Pasos

**1. Proyecto.**
1. `npm create vite@latest frontend -- --template react-ts`.
2. Dependencias: `react-router`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite` y las fuentes elegidas como paquetes `@fontsource/<fuente>`. **Nada de Google Fonts por URL:** la CSP del proxy lo bloquea.
3. Dependencias de desarrollo: `vitest`.
4. Scripts: los de Vite más `"test": "vitest run"`.

**2. `vite.config.ts`.** Plugins `react()` y `tailwindcss()`, más el proxy de desarrollo para que `/api` funcione igual que detrás de Nginx:

```ts
server: { proxy: { '/api': 'http://localhost:4000' } }
```

**3. Dirección visual con `frontend-design`.** Pegale este brief:

> Herramienta interna para una concesionaria Honda de La Plata. Se usa en el salón de ventas, en notebook y a veces en tablet. Tiene 5 secciones simples (autos en stock, modelos, clientes, vendedores, sucursales), cada una con una tabla y un formulario.
>
> Prioridades:
> - tablas muy legibles;
> - estados de los autos (disponible / reservado / vendido) distinguibles de un vistazo;
> - formularios cortos;
> - errores claros.
>
> Restricciones:
> - Es un proyecto académico: **no usar logos ni marcas oficiales de Honda**. Puede haber un acento rojo.
> - Las fuentes van con `@fontsource`.
> - Tiene que funcionar a 360 px de ancho.
> - Con Tailwind v4: los tokens van en `@theme`, dentro de `src/index.css`.

Guardá el resultado en `frontend/DESIGN.md`. Es **la referencia para tus 4 compañeros cuando armen su pantalla**, así que tiene que incluir:
- paleta (4–6 colores con nombre y hex);
- tipografías y escala;
- espaciados;
- cómo se ve un badge de estado;
- cómo se ven los botones primario, secundario y destructivo.

Los tokens van en `src/index.css` (`@import "tailwindcss";` + `@theme { … }`).

**4. `api/client.ts`.** Firmas exactas de §5.8 del contrato. Reglas:
- Las rutas son relativas a `/api`: `apiGet('/modelos')` llama a `/api/modelos`. No hay URLs absolutas ni variables de entorno: funciona igual en `localhost:8080`, en Vite y por el túnel.
- Si `!response.ok`, intenta leer el JSON `{ error: { code, message, details } }` y lanza `ApiError(status, code, message, details)`. Si el body no es JSON (por ejemplo, un 502 en HTML), lanza:
  - `code: 'BACKEND_UNAVAILABLE'` y mensaje "El servidor no responde" si `status >= 500`;
  - `code: 'UNKNOWN'` en otro caso.
- Si `fetch` mismo falla (sin red), lanza `ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor')`.
- Un `204` devuelve `undefined`.

**5. `shared/format.ts`:**

| Función | Qué hace | Ejemplo |
|---|---|---|
| `formatPrecio(n)` | `Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })`. La usan Modelos y Autos. | `42500000` → `"$ 42.500.000,00"` |

**6. `main.tsx`: React Query + detección de caída.**
- **Configuración del `QueryClient`:**
  - `refetchOnWindowFocus: false`;
  - `retry`: no reintenta si es un `ApiError` con status 4xx o 503 (de eso se encarga el banner); en los demás casos reintenta una vez.
- **Detección de caída:** en el `onError` de `QueryCache` y de `MutationCache`, si el error es un `ApiError` con `status === 503` o `status === 0`, avisa al store de `useDbStatus` que el sistema está caído.

**7. `shared/hooks/useDbStatus.ts` + `DbDownBanner.tsx`. El aviso de caída.**
- **El store:** uno chico (`useSyncExternalStore`) con `{ caida: boolean }`.
- **Polling de salud:** consulta `GET /api/health`:
  - cada **30 s** cuando todo anda;
  - cada **5 s** cuando está caído.

  `db: 'down'` o cualquier error → `caida = true`. `db: 'up'` cuando estaba caído → `caida = false`, `queryClient.invalidateQueries()` (recarga todo) y toast "Conexión recuperada".
- **El banner:** visible mientras `caida` sea `true`, arriba de todo, con `role="status"` y `aria-live="polite"`. Texto: **"La base de datos no responde. Los datos en pantalla pueden estar desactualizados; reintentamos cada 5 segundos."**

**8. Componentes compartidos** (firmas exactas de §5.8):

| Componente | Requisitos |
|---|---|
| `Layout` | Encabezado con el nombre "Honda La Plata · Gestión comercial"; menú con las 5 secciones en el orden del contrato y la activa resaltada; `DbDownBanner`; pie con "Proyecto académico — no afiliado a Honda Motor". |
| `DataTable` | Tabla semántica (`<table>`, `<th scope="col">`); skeleton mientras `loading`; `emptyMessage` si no hay filas; en pantallas chicas, scroll horizontal dentro de su contenedor (nunca de la página). |
| `Modal` | `role="dialog"` y `aria-modal`; cierra con Esc y al hacer clic afuera; el foco entra al abrir y vuelve al botón que lo abrió al cerrar. |
| `ConfirmDialog` | Arma su contenido sobre `Modal`; botón destructivo; con `loading`, deshabilita los botones. |
| `FormField` | `<label htmlFor>`; el `error` se muestra abajo y se asocia con `aria-describedby`. |
| `Toast` + `useToast` | Un provider en `App`; `aria-live`; se va solo a los 3 s. |
| `EmptyState` | Título, descripción y acción opcional. |

**9. Rutas (`App.tsx`)** según §5.8:
- `/` redirige a `/autos`;
- las 5 secciones;
- una página "No encontrada" para cualquier otra ruta.

Cada `features/<entidad>/<Entidad>Page.tsx` placeholder muestra el título de la sección y el texto "En construcción — módulo N". Así cada dueño, en la Fase 1, solo reemplaza **su** archivo.

**10. `nginx.conf`** (sirve la SPA; sin esto, recargar `/clientes` da 404):

```nginx
server {
  listen 8080;
  server_name _;
  server_tokens off;
  root /usr/share/nginx/html;
  index index.html;

  location /assets/ {
    try_files $uri =404;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }

  location / {
    try_files $uri $uri/ /index.html;
    add_header Cache-Control "no-cache";
  }
}
```

**11. `Dockerfile`** (multi-stage, no-root). La versión de Nginx tiene que coincidir con la que usa M4 en el proxy:

```dockerfile
# Etapa 1: compilar la app (tsc + vite build)
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Etapa 2: solo los archivos estáticos sobre Nginx no-root
FROM nginxinc/nginx-unprivileged:<mayor.menor>-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
```

**`.dockerignore`:** `node_modules`, `dist`, `.env*`.

### Tests de la Fase 0 (antes de implementar)

- **`client.test.ts`** (con `fetch` mockeado):
  1. Un `400` con JSON de error → `ApiError` con `status`, `code` y `details`.
  2. Un `502` con HTML → `ApiError` con `code: 'BACKEND_UNAVAILABLE'`.
  3. `fetch` rechaza → `ApiError` con `status: 0`.
  4. Un `204` → `undefined`.
- **`format.test.ts`:**
  1. `formatPrecio(42500000)` contiene `42.500.000`.
  2. `formatPrecio(0.5)` contiene `0,50`.

### Criterios de aceptación

- [ ] `npm test --prefix frontend` y `npm run build --prefix frontend` pasan.
- [ ] La imagen corre como `nginx`, no como root.
- [ ] En `http://localhost:8080` se ve el layout y se navega por las 5 secciones; recargar en `/clientes` funciona.
- [ ] Con la base detenida, el banner aparece en ≤ 30 s. Al arrancarla de nuevo, desaparece en ≤ 5 s y aparece el toast "Conexión recuperada".
- [ ] `frontend/DESIGN.md` existe y tus compañeros lo pueden seguir.

### Cómo verificarlo

```bash
npm ci --prefix frontend
npm test --prefix frontend
npm run build --prefix frontend

docker build -t concesionaria-frontend ./frontend
docker run --rm concesionaria-frontend whoami          # → nginx

docker compose up -d --build
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/clientes   # → 200 (fallback de SPA)
docker stop concesionaria_db      # mirar el navegador: aparece el banner
docker start concesionaria_db     # el banner desaparece y aparece el toast
```

---

## Fase 1 — CRUD de Autos (días 4–9)

Es el mismo molde que siguen los otros 4 módulos (§5.7 del contrato). Autos es la home de la app (`/` redirige a `/autos`).

### Tabla: `db/init/03_autos.sql`

Copiá el DDL de `autos` de §5.6 **tal cual** y agregá estos datos de ejemplo (los precios son ficticios):

| modelo | anio | color | precio | estado |
|---|---|---|---|---|
| HR-V EXL | 2026 | Gris Meteoro | 42500000 | disponible |
| City EX | 2026 | Blanco Tafeta | 32500000 | disponible |
| Civic Touring | 2025 | Negro Cristal | 53000000 | reservado |
| ZR-V Touring | 2026 | Azul Obsidiana | 51000000 | disponible |
| CR-V e:HEV | 2026 | Rojo Radiante | 69000000 | disponible |
| WR-V EXL | 2025 | Plata Lunar | 36500000 | vendido |

Para que se aplique: `docker compose down -v && docker compose up -d --build`.

### Endpoints (`backend/src/modules/autos/`)

| Método y ruta | Respuesta |
|---|---|
| `GET /api/autos` | `200`, `order by modelo, anio desc` |
| `GET /api/autos/:id` | `200` o `404` "Auto no encontrado" |
| `POST /api/autos` | `201` o `400` |
| `PUT /api/autos/:id` | `200`, `400` o `404` |
| `DELETE /api/autos/:id` | `204` o `404` |

Autos no tiene campos únicos, así que no hay `409`.

Forma en el JSON:

```json
{ "id": 1, "modelo": "HR-V EXL", "anio": 2026, "color": "Gris Meteoro",
  "precio": 42500000, "estado": "disponible", "createdAt": "…", "updatedAt": "…" }
```

### Validaciones (`autos.schema.ts`, zod)

Un solo esquema para `POST` y `PUT`:

| Campo | Regla |
|---|---|
| `modelo` | trim, 1–40 caracteres |
| `anio` | entero entre 2015 y 2030; mensaje "El año debe estar entre 2015 y 2030" |
| `color` | trim, 1–30 caracteres |
| `precio` | número positivo, máximo `9999999999.99` |
| `estado` | `'disponible' \| 'reservado' \| 'vendido'`; por defecto `'disponible'` |

### Tests (`autos.test.ts`) — escribilos ANTES de implementar

Con Supertest contra `app` y `autos.service` mockeado con `vi.mock`:

1. `GET /api/autos` → `200` y devuelve el array del service.
2. `GET /api/autos/abc` → `400`.
3. `GET /api/autos/999` cuando el service lanza `NotFoundError` → `404` con `error.code === 'NOT_FOUND'`.
4. `POST` con `anio: 1990` → `400` y `error.details[0].path === 'anio'`.
5. `POST` válido sin `estado` → `201`, y el service recibe `estado: 'disponible'`.
6. `POST` con `estado: 'roto'` → `400` y `error.details[0].path === 'estado'`.
7. `DELETE /api/autos/1` → `204`.

### Pantalla (`frontend/src/features/autos/`)

- **`AutosPage.tsx`**
  - `DataTable` con columnas: Modelo · Año · Color · Precio (`formatPrecio`) · Estado (badge de color según `DESIGN.md`) · Acciones (Editar, Eliminar).
  - Botón "Nuevo auto" que abre `AutoForm` en un `Modal`.
  - "Eliminar" abre `ConfirmDialog`.
- **`AutoForm.tsx`**
  - Campos: modelo, año, color, precio, estado (select).
  - Los errores `400` de la API se muestran debajo de cada campo (`details[].path` → `FormField error`).
  - Al guardar: toast "Auto guardado" e `invalidateQueries({ queryKey: ['autos'] })`.

### Criterios de aceptación

- [ ] Los 7 tests pasan: `npm test --prefix backend`.
- [ ] En `http://localhost:8080/autos` se puede listar, crear, editar y borrar.
- [ ] Los 3 estados se distinguen de un vistazo, y la pantalla se ve bien a 360 px de ancho.
- [ ] Con la base detenida, `curl -si http://localhost:8080/api/autos` responde `503` `DB_UNAVAILABLE`.

---

## Fase 2 — UI pulida y accesible (días 10–12)

1. **Auditoría con `impeccable`** de las 5 secciones (con todo levantado en Vite o en `:8080`):
   - los problemas de componentes compartidos los corregís vos;
   - los de una pantalla puntual, se los pasás a su dueño en una lista (issue o mensaje), con captura y propuesta.
2. **Consistencia:** las 5 pantallas usan los mismos estados de carga (skeleton), vacío (`EmptyState`) y error (toast con el `message` de la API), y los mismos textos de botones: "Guardar", "Cancelar", "Eliminar".
3. **Accesibilidad:**
   - todo se puede usar con teclado (Tab, Enter, Esc);
   - foco visible;
   - contraste AA;
   - cada input con su label;
   - el banner y los toasts se anuncian (`aria-live`);
   - se respeta `prefers-reduced-motion`.
4. **Responsive:**
   - a 360 px nada se corta;
   - las tablas scrollean dentro de su contenedor;
   - el menú se adapta.
5. **Microinteracciones** (opcional, con `emil-design-eng`): Modal, Toast y banner.

### Criterios de aceptación

- [ ] La auditoría de `impeccable` no deja hallazgos críticos abiertos.
- [ ] Lighthouse (pestaña de Chrome DevTools) da **Accesibilidad ≥ 90** en `/autos`.
- [ ] Se puede dar de alta un auto usando solo el teclado.
- [ ] A 360 px de ancho no hay scroll horizontal de la página en ninguna sección.

---

## Review cruzado

Revisás los PR de **M4** (proxy y Vendedores) con `code-review-expert`. Fijate en:

- **`nginx.conf`:**
  - `curl -I http://localhost:8080/` muestra los headers de seguridad;
  - **no** usa `proxy_intercept_errors`;
  - la CSP no rompe la app: abrí la consola del navegador y buscá errores de CSP.
- **Vendedores:** el email se guarda en minúsculas, y un email repetido da `409` y se muestra en el campo email.

---

## Tu parte de la exposición (≈5 min): La app y el frontend

Slides:
1. La app en 4 piezas (como la slide 13 del TP de ejemplo), adaptada a la concesionaria.
2. Cómo se construye y sirve el frontend: `vite build`, archivos estáticos, Nginx no-root y fallback de SPA.
3. Cómo el frontend habla con el backend sin CORS: rutas relativas `/api` y un solo origen.
4. Cómo detecta la caída: 503 → banner → polling cada 5 s → recarga automática.

Demo: recorrido rápido por las 5 secciones (dar de alta un auto y verlo en la lista). La caída de la base en vivo la hace M5. Vos mostrás el código del banner.

Para estudiar: `/sigma Quiero entender cómo se construye una SPA de React con Vite y se sirve con Nginx dentro de un contenedor (incluido el fallback a index.html), y cómo TanStack Query maneja errores, reintentos e invalidación de cache. Lo tengo que exponer en 5 minutos.`

---

## Definition of Done del módulo

- [ ] Fase 0, Fase 1 y Fase 2 con todos sus criterios de aceptación en verde.
- [ ] Se cumple la Definition of Done general (§11 del contrato).
- [ ] `DESIGN.md` está actualizado con lo que realmente quedó.
- [ ] Slides y demo listas y ensayadas.
