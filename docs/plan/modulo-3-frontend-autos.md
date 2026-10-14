# Módulo 3 — Frontend, diseño y Autos

**Responsable:** ___ · **Revisás los PR de:** M4 · **Te revisa:** M2
Antes de empezar, leé [00-plan-general.md](00-plan-general.md) §5.3, §5.4, §5.5 y §5.8.

**En una frase:** armás el esqueleto del frontend que usan los 5: diseño, componentes compartidos y el **aviso de "base caída" con reintento automático**. También armás su Dockerfile con Nginx no-root y el CRUD de Autos, que es la home de la app.

---

## Día 1 — Esqueleto del frontend ⚠️ los demás lo necesitan el día 2

**1. Proyecto.**
- Crealo con `npm create vite@latest frontend -- --template react-ts`.
- **Dependencias:** `react-router`, `@tanstack/react-query`, `tailwindcss`, `@tailwindcss/vite` y las fuentes con `@fontsource/<fuente>`. **Nada de Google Fonts por URL.**
- **Dependencia de desarrollo:** `vitest`.
- **`vite.config.ts`:** plugins `react()` y `tailwindcss()`, más `server: { proxy: { '/api': 'http://localhost:8080' } }`. Así, con el stack levantado en Docker, `npm run dev` funciona con recarga en caliente.

**2. Diseño.** Corré la skill `frontend-design` con este brief:

> "App interna de una concesionaria Honda de La Plata: 5 secciones simples (autos, modelos, clientes, vendedores, sucursales), cada una con una tabla y un formulario. Prioridades: tablas legibles, que los estados de los autos (disponible/reservado/vendido) se distingan de un vistazo, que funcione a 360 px. Sin logos oficiales de Honda (puede haber un acento rojo). Tailwind v4 con los tokens en `@theme`."

Guardá el resultado en `frontend/DESIGN.md`: paleta, tipografías, botones y badges. **Tus compañeros lo siguen para hacer sus pantallas.**

**3. `src/api/client.ts`:**
- Las rutas son relativas a `/api`: `apiGet('/autos')`. Nada de URLs absolutas.
- Si la respuesta no es OK:
  - lee el JSON de error y lanza `ApiError(status, code, message, details)`;
  - si el body no es JSON (por ejemplo, un 502 en HTML), lanza el `ApiError` con `code: 'BACKEND_UNAVAILABLE'`.
- Si `fetch` falla (sin red): `ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor')`.
- Un `204` devuelve `undefined`.

**4. Aviso de caída** (`shared/hooks/useDbStatus.ts` + `shared/components/DbDownBanner.tsx`):
- **Polling de `GET /api/health`:** cada **30 s** cuando todo anda y cada **5 s** cuando está caído.
- **Cuándo se marca caído:** si la respuesta es `db: 'down'`, si la request falla, o si cualquier query o mutation de React Query devuelve `503` o status `0` (se detecta en el `onError` de `QueryCache` y `MutationCache`, en `main.tsx`).
- **Cuando vuelve:** se oculta el banner, `queryClient.invalidateQueries()` recarga todo y aparece el toast "Conexión recuperada".
- **Texto del banner** (con `role="status"`): **"La base de datos no responde. Reintentamos cada 5 segundos."**

**5. Componentes compartidos** (con las firmas de §5.8):
- `Layout`: menú con las 5 secciones, el banner y el pie "Proyecto académico — no afiliado a Honda".
- `DataTable`: tabla semántica, estado de carga y mensaje si no hay filas. En pantallas chicas scrollea dentro de su contenedor.
- `Modal`: cierra con Esc; el foco entra al abrir y vuelve al cerrar.
- `ConfirmDialog`, `FormField` (label + error), `Toast` + `useToast` y `formatPrecio`.

**6. Rutas (`App.tsx`):**
- `/` redirige a `/autos`.
- Las 5 secciones de §5.8, cada una con una página que por ahora dice "En construcción — módulo N".
- Una página para rutas que no existen.

**7. `nginx.conf` y `Dockerfile`:**

```nginx
server {
  listen 8080;
  server_tokens off;
  root /usr/share/nginx/html;
  location /assets/ { try_files $uri =404; expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri $uri/ /index.html; }   # recargar /clientes no da 404
}
```

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:<mayor.menor>-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
```

**8. Tests de `client.ts`** (antes del código):
- un `400` con JSON → `ApiError` con `details`;
- un `502` con HTML → `code: 'BACKEND_UNAVAILABLE'`;
- `fetch` falla → `status: 0`.

**Listo cuando:**
- `npm test --prefix frontend` y `npm run build --prefix frontend` pasan.
- `docker run --rm <imagen> whoami` da `nginx`.
- En `http://localhost:8080` se navega por las 5 secciones, y recargar `/clientes` funciona.
- Con `docker stop concesionaria_db`, el banner aparece en ≤ 30 s. Con `docker start`, desaparece en ≤ 5 s.

---

## Día 2 — CRUD de Autos

Seguí la **receta de §5.7**. Lo propio de tu entidad:

| Campo | Validación zod |
|---|---|
| `modelo` | trim, 1–40 caracteres |
| `anio` | entero entre 2015 y 2030 |
| `color` | trim, 1–30 caracteres |
| `precio` | número positivo |
| `estado` | `'disponible'`, `'reservado'` o `'vendido'`; por defecto `'disponible'` |

**Mensajes:**
- `404`: "Auto no encontrado".
- Autos no tiene campos únicos, así que no hay `409`.

**Datos de ejemplo:**

| Modelo | Año | Color | Precio | Estado |
|---|---|---|---|---|
| HR-V EXL | 2026 | Gris | 42.500.000 | disponible |
| City EX | 2026 | Blanco | 32.500.000 | disponible |
| Civic Touring | 2025 | Negro | 53.000.000 | reservado |
| ZR-V Touring | 2026 | Azul | 51.000.000 | disponible |
| WR-V EXL | 2025 | Plata | 36.500.000 | vendido |

**Test 3:** `POST` con `anio: 1990` → `400`.

**Pantalla `/autos`:** columnas Modelo · Año · Color · Precio (`formatPrecio`) · Estado (badge de color, según `DESIGN.md`) · Acciones.

---

## Día 3 — Repaso de la UI

- **Recorré las 5 pantallas.** Revisá que tengan los mismos textos de botones ("Guardar", "Cancelar", "Eliminar"), los mismos estados de carga y de lista vacía, y que se puedan usar con el teclado y a 360 px de ancho. Si algo no está bien en la pantalla de otro, avisale a su dueño.
- **Opcional:** `/impeccable` para un pulido rápido de los componentes compartidos.
- **Durante el chaos test de M5:** verificá que el banner aparezca y desaparezca solo.

---

## Día 4 — Exposición: "La app y el frontend"

Slides:
- La app en 4 piezas.
- Cómo se construye el frontend y lo sirve Nginx no-root.
- Por qué no hace falta CORS.
- Cómo detecta la caída de la base (503 → banner → reintento).

Demo: recorrido por las 5 secciones. La caída de la base en vivo la hace M5.

Para estudiar: `/sigma Explicame cómo se construye una SPA de React con Vite y se sirve con Nginx en un contenedor, y cómo TanStack Query maneja errores y reintentos. Lo expongo en 5 minutos.`

---

## Prompts útiles

- **Para arrancar cada día:** `Usá la skill writing-plans. La spec es el Día 1 de docs/plan/modulo-3-frontend-autos.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m3-dia1.md.`
- **Para armar el esqueleto:** `Cargá react-typescript-app y armá el esqueleto de frontend/ según el Día 1 de mi módulo, con las firmas de §5.8 del contrato.`
- **Para el review de M4:** `Usá code-review-expert para revisar la rama de M4 contra main.`
