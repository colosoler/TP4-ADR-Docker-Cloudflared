# M3 Día 1 — Esqueleto del frontend: Implementation Plan

> **Para quien ejecute:** según `CLAUDE.md`, las sub-skills `superpowers:*` no están instaladas: este plan se ejecuta inline, tarea por tarea. Los pasos usan checkboxes (`- [ ]`). **Commitear al final de cada tarea**, en la rama `m3/dia1-frontend`.

**Goal:** Dejar armado el esqueleto de `frontend/` que los 5 integrantes usan desde el día 2: cliente de API, diseño, componentes compartidos, aviso de "base caída", rutas e imagen Docker con Nginx no-root.

**Architecture:** SPA de React 19 + Vite, servida por Nginx no-root detrás del proxy (M4). Todo el tráfico a la API va por rutas relativas `/api/...` (sin CORS). React Query maneja el estado del servidor; un store mínimo con `useSyncExternalStore` guarda "la base está caída", y lo alimentan el polling de `/api/health` y el `onError` de `QueryCache`/`MutationCache`.

**Tech Stack:** React 19, Vite 7, TypeScript 5.8 (strict), Tailwind v4 (`@tailwindcss/vite`, tokens en `@theme`), TanStack Query 5, React Router 7, Vitest 3, `@fontsource`, `nginxinc/nginx-unprivileged:1.30-alpine`.

**Spec:** `docs/plan/modulo-3-frontend-autos.md` (Día 1) · contrato: `docs/plan/00-plan-general.md` §5.3, §5.4, §5.5, §5.8.

## Global Constraints

- TypeScript `strict`, sin `any`.
- Rutas de la API relativas a `/api`: `apiGet('/autos')`. Nunca URLs absolutas.
- Fuentes con `@fontsource/*`. **Nada de Google Fonts por URL** (lo bloquea la CSP).
- Textos de la UI en español.
- Imágenes Docker con versión fija, nunca `latest`.
- Firmas de §5.8 sin cambios: `ApiError(status, code, message, details?)`, `apiGet<T>(path)`, `apiPost<T>(path, body)`, `apiPut<T>(path, body)`, `apiDelete(path)`, `<DataTable rows columns rowKey loading emptyMessage />`, `<Modal open onClose title>`, `<ConfirmDialog open title message onConfirm onCancel loading />`, `<FormField label htmlFor error>`, `useToast(): { showToast(message, type?) }`, `formatPrecio(n)` → `"$ 42.500.000,00"`.
- Rutas del menú, en orden: `/autos` (home; `/` redirige), `/modelos`, `/clientes`, `/vendedores`, `/sucursales`.
- Banner: texto exacto **"La base de datos no responde. Reintentamos cada 5 segundos."**, con `role="status"`; polling cada 30 s (todo anda) y cada 5 s (caído).
- No agregar nada que el plan no pida.
- Nunca commitear `.env`, `node_modules/` ni `dist/`.

### Decisión a confirmar con Lucas (excepción de TDD)

El plan del módulo pide tests **solo para `client.ts`**, y las dependencias del Día 1 no incluyen jsdom ni Testing Library. Por eso las Tasks 2–6 (estilos, componentes visuales, hook de polling y Docker) se verifican con build, typecheck y los chequeos manuales del "Listo cuando", no con tests unitarios. La skill `test-driven-development` pide permiso para esta excepción.

---

### Task 1: Proyecto Vite + cliente de API (TDD)

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/.dockerignore`
- Create: `frontend/src/api/client.ts`
- Test: `frontend/src/api/client.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `class ApiError extends Error { status: number; code: string; details?: ErrorDetail[] }`, `interface ErrorDetail { path: string; message: string }`, `apiGet<T>(path: string): Promise<T>`, `apiPost<T>(path: string, body: unknown): Promise<T>`, `apiPut<T>(path: string, body: unknown): Promise<T>`, `apiDelete(path: string): Promise<void>`.

- [ ] **Step 1: Archivos del proyecto**

`frontend/package.json`:
```json
{
  "name": "concesionaria-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@fontsource/barlow-condensed": "^5.2.0",
    "@fontsource/ibm-plex-sans": "^5.2.0",
    "@tailwindcss/vite": "^4.1.0",
    "@tanstack/react-query": "^5.80.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-router": "^7.6.0",
    "tailwindcss": "^4.1.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0",
    "@vitejs/plugin-react": "^4.6.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.0",
    "vitest": "^3.2.0"
  }
}
```

`frontend/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "types": ["vite/client"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite.config.ts"]
}
```

`frontend/vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Con el stack levantado en Docker, `npm run dev` habla con el proxy de :8080.
    proxy: { '/api': 'http://localhost:8080' },
  },
});
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#1f2328" />
    <title>Concesionaria La Plata</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`frontend/.dockerignore`:
```
node_modules
dist
.env
*.log
```

Run: `npm install --prefix frontend`
Expected: crea `frontend/package-lock.json` y termina sin errores.

- [ ] **Step 2: Escribir los tests que fallan**

`frontend/src/api/client.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiGet, apiPost } from './client';

function mockFetch(impl: () => Promise<Response>) {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api/client', () => {
  it('un 400 con JSON lanza ApiError con code, message y details', async () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Datos inválidos',
        details: [{ path: 'anio', message: 'El año debe estar entre 2015 y 2030' }],
      },
    };
    const fetchMock = mockFetch(async () =>
      new Response(JSON.stringify(body), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const error = await apiPost('/autos', { anio: 1990 }).catch((e: unknown) => e);

    expect(fetchMock).toHaveBeenCalledWith('/api/autos', expect.objectContaining({ method: 'POST' }));
    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(400);
    expect(apiError.code).toBe('VALIDATION_ERROR');
    expect(apiError.message).toBe('Datos inválidos');
    expect(apiError.details).toEqual([{ path: 'anio', message: 'El año debe estar entre 2015 y 2030' }]);
  });

  it('un 502 con HTML lanza ApiError con code BACKEND_UNAVAILABLE', async () => {
    mockFetch(async () =>
      new Response('<html><body>502 Bad Gateway</body></html>', {
        status: 502,
        headers: { 'Content-Type': 'text/html' },
      }),
    );

    const error = await apiGet('/autos').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).code).toBe('BACKEND_UNAVAILABLE');
  });

  it('si fetch falla lanza ApiError con status 0 y NETWORK_ERROR', async () => {
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    const error = await apiGet('/autos').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).code).toBe('NETWORK_ERROR');
    expect((error as ApiError).message).toBe('No hay conexión con el servidor');
  });
});
```

- [ ] **Step 3: Stub mínimo para que el test compile y falle por la razón correcta**

`frontend/src/api/client.ts`:
```ts
// STUB para ver el test en ROJO (Task 1, paso 3). Se reemplaza en el paso 5.
export interface ErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

const noImplementado = (): never => {
  throw new Error('No implementado');
};

export const apiGet = <T>(_path: string): Promise<T> => Promise.resolve().then(noImplementado);
export const apiPost = <T>(_path: string, _body: unknown): Promise<T> => Promise.resolve().then(noImplementado);
export const apiPut = <T>(_path: string, _body: unknown): Promise<T> => Promise.resolve().then(noImplementado);
export const apiDelete = (_path: string): Promise<void> => Promise.resolve().then(noImplementado);
```

- [ ] **Step 4: Correr los tests y verificar que fallan**

Run: `npm test --prefix frontend`
Expected: **3 failed**. Cada uno falla porque el error recibido es `Error: No implementado`, no un `ApiError` (por ejemplo, `expected Error: No implementado to be an instance of ApiError`). Si falla por otra causa (un import roto, un typo), se arregla eso antes de seguir.

- [ ] **Step 5: Implementación mínima**

`frontend/src/api/client.ts`:
```ts
// Cliente de la API. Las rutas son relativas a /api: apiGet('/autos').
// Nunca URLs absolutas: el navegador habla siempre con un único origen (sin CORS).

const API_BASE = '/api';

export interface ErrorDetail {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ErrorDetail[];

  constructor(status: number, code: string, message: string, details?: ErrorDetail[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

interface ErrorBody {
  error: { code: string; message: string; details?: ErrorDetail[] };
}

function isErrorBody(value: unknown): value is ErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) return false;
  const error = (value as { error: unknown }).error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string' &&
    typeof (error as { message?: unknown }).message === 'string'
  );
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    if (isErrorBody(body)) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // El body no es JSON (por ejemplo, un 502 en HTML): cae al error genérico de abajo.
  }
  return new ApiError(
    response.status,
    'BACKEND_UNAVAILABLE',
    'El servidor no responde. Probá de nuevo en unos segundos.',
  );
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, headers: { Accept: 'application/json' } };
  if (body !== undefined) {
    init.headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'No hay conexión con el servidor');
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const apiGet = <T>(path: string): Promise<T> => request<T>(path, 'GET');

export const apiPost = <T>(path: string, body: unknown): Promise<T> => request<T>(path, 'POST', body);

export const apiPut = <T>(path: string, body: unknown): Promise<T> => request<T>(path, 'PUT', body);

export const apiDelete = (path: string): Promise<void> => request<void>(path, 'DELETE');
```

- [ ] **Step 6: Correr los tests y verificar que pasan**

Run: `npm test --prefix frontend`
Expected: **3 passed**, sin errores ni warnings.

Run: `npx tsc --noEmit -p frontend`
Expected: sin salida (exit 0).

- [ ] **Step 7: Commit**

---

### Task 2: Diseño (skill `frontend-design`) y `formatPrecio`

**Files:**
- Create: `frontend/src/index.css`, `frontend/DESIGN.md`, `frontend/src/shared/format.ts`

**Interfaces:**
- Consumes: nada.
- Produces: tokens de Tailwind (`bg-fondo`, `text-tinta`, `bg-marca`, `font-display`, …); clases `btn-primario`, `btn-secundario`, `btn-peligro`, `btn-texto`, `campo`, `badge-disponible`, `badge-reservado`, `badge-vendido`, `badge-activo`, `badge-inactivo`, `titulo-pagina`; `formatPrecio(n: number): string`.

- [ ] **Step 1: Correr `frontend-design` con el brief del módulo**

Brief: *"App interna de una concesionaria Honda de La Plata: 5 secciones simples (autos, modelos, clientes, vendedores, sucursales), cada una con una tabla y un formulario. Prioridades: tablas legibles, que los estados de los autos (disponible/reservado/vendido) se distingan de un vistazo, que funcione a 360 px. Sin logos oficiales de Honda (puede haber un acento rojo). Tailwind v4 con los tokens en `@theme`."*

Resultado: la dirección es "planilla de stock del salón"; la firma son los estados como etiquetas de llave; la tipografía es Barlow Condensed (display) + IBM Plex Sans (texto). Se descartó el look crema con acento, que es uno de los defaults genéricos que la skill dice evitar.

- [ ] **Step 2: Tokens y clases**

`frontend/src/index.css`:
```css
@import "tailwindcss";

/*
 * Tokens del diseño (skill frontend-design). Ver frontend/DESIGN.md antes de armar una pantalla.
 * Dirección: "planilla de stock del salón". Neutros fríos de taller, encabezado grafito,
 * rojo solo como acento. Firma: los estados son etiquetas de llave.
 */
@theme {
  --font-display: "Barlow Condensed", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "IBM Plex Sans", ui-sans-serif, system-ui, sans-serif;

  /* Neutros fríos */
  --color-fondo: #eceef1;
  --color-superficie: #ffffff;
  --color-hundido: #f4f5f7;
  --color-borde: #d5d9df;
  --color-borde-fuerte: #aab1bb;
  --color-tinta: #1f2328;
  --color-tinta-suave: #59616c;
  --color-grafito: #1f2328;

  /* Acento rojo (sin logos oficiales): acción primaria, sección activa, foco */
  --color-marca: #c8102e;
  --color-marca-oscuro: #a00d25;

  /* Estados de los autos */
  --color-disponible: #157f3d;
  --color-reservado: #9a5200;
  --color-reservado-claro: #fff1dc;
  --color-vendido: #5b6573;

  /* Avisos */
  --color-peligro: #b3121f;
  --color-peligro-claro: #fdecec;
  --color-exito: #157f3d;
}

@layer base {
  html {
    -webkit-text-size-adjust: 100%;
  }
  body {
    @apply bg-fondo font-sans text-tinta antialiased;
  }
  :focus-visible {
    @apply outline-2 outline-offset-2 outline-marca;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}

/* Clases compartidas. Con @utility se pueden componer entre sí con @apply. */

/* Botones: "Nuevo …", "Guardar", "Cancelar", "Editar", "Eliminar" */
@utility btn {
  @apply inline-flex min-h-10 items-center justify-center gap-2 rounded border px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60;
}
@utility btn-primario {
  @apply btn border-marca bg-marca text-white hover:border-marca-oscuro hover:bg-marca-oscuro;
}
@utility btn-secundario {
  @apply btn border-borde-fuerte bg-superficie text-tinta hover:bg-hundido;
}
@utility btn-peligro {
  @apply btn border-peligro bg-peligro text-white hover:bg-marca-oscuro;
}
@utility btn-texto {
  @apply inline-flex min-h-9 items-center rounded px-2 text-sm font-medium text-tinta-suave underline-offset-4 hover:text-tinta hover:underline;
}

/* Campos de formulario (input, select) */
@utility campo {
  @apply block min-h-10 w-full rounded border border-borde-fuerte bg-superficie px-3 text-base text-tinta placeholder:text-tinta-suave/70 sm:text-sm;
  &[aria-invalid="true"] {
    @apply border-peligro bg-peligro-claro;
  }
}

/*
 * Firma: etiqueta de llave. Rectángulo con el agujero del llavero a la izquierda.
 * El relleno cambia por estado: lleno (disponible) · tinte (reservado) · solo contorno (vendido),
 * así se distinguen de un vistazo aunque no se vea el color.
 */
@utility etiqueta {
  @apply inline-flex min-h-6 items-center gap-1.5 rounded-sm border py-0.5 pr-2.5 pl-1.5 font-display text-[0.8125rem] leading-none font-semibold tracking-wider whitespace-nowrap uppercase before:size-2 before:shrink-0 before:rounded-full before:border before:border-current before:bg-superficie before:content-[''];
}
@utility badge-disponible {
  @apply etiqueta border-disponible bg-disponible text-white before:border-white/70 before:bg-disponible;
}
@utility badge-reservado {
  @apply etiqueta border-reservado bg-reservado-claro text-reservado;
}
@utility badge-vendido {
  @apply etiqueta border-borde-fuerte bg-transparent text-vendido line-through decoration-1;
}
/* Booleano "activo" de modelos y vendedores */
@utility badge-activo {
  @apply badge-disponible;
}
@utility badge-inactivo {
  @apply etiqueta border-borde-fuerte bg-transparent text-vendido;
}

/* Encabezado de cada sección */
@utility titulo-pagina {
  @apply font-display text-3xl leading-none font-semibold tracking-wide text-tinta uppercase;
}
```

- [ ] **Step 3: Guía para el grupo**

`frontend/DESIGN.md`: ver el archivo. Documenta la paleta, la tipografía, los botones, las etiquetas, los formularios, la estructura de pantalla, el comportamiento a 360 px y la accesibilidad.

- [ ] **Step 4: `formatPrecio`**

`frontend/src/shared/format.ts`:
```ts
const precioFormatter = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** formatPrecio(42500000) → "$ 42.500.000,00" */
export function formatPrecio(n: number): string {
  return `$ ${precioFormatter.format(n)}`;
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit -p frontend`
Expected: exit 0.

- [ ] **Step 6: Commit**

---

### Task 3: Componentes compartidos

**Files:**
- Create: `frontend/src/shared/components/Toast.tsx`, `Modal.tsx`, `ConfirmDialog.tsx`, `FormField.tsx`, `DataTable.tsx`

**Interfaces:**
- Consumes: clases de la Task 2.
- Produces: `ToastProvider`, `useToast(): { showToast(message: string, type?: 'success' | 'error'): void }`, `Modal({ open, onClose, title, children })`, `ConfirmDialog({ open, title, message, onConfirm, onCancel, loading? })`, `FormField({ label, htmlFor, error?, children })`, `DataTable<T>({ rows, columns: Column<T>[], rowKey, loading?, emptyMessage? })`, `interface Column<T> { header: string; cell: (row: T) => ReactNode }`.

- [ ] **Step 1: Toast**

`frontend/src/shared/components/Toast.tsx`:
```tsx
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURACION_MS = 4000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => dismiss(id), DURACION_MS);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:items-end"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-md border-l-4 bg-tinta px-4 py-3 text-sm text-white shadow-lg ${
              t.type === 'error' ? 'border-marca' : 'border-exito'
            }`}
          >
            <span className="flex-1">{t.message}</span>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              className="-my-1 -mr-1 rounded px-1 text-white/70 hover:text-white"
              aria-label="Cerrar aviso"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast tiene que usarse dentro de <ToastProvider>');
  return ctx;
}
```

- [ ] **Step 2: Modal** (sobre `<dialog>`: Esc cierra; el foco entra al abrir y vuelve al cerrar)

`frontend/src/shared/components/Modal.tsx`:
```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * Modal sobre <dialog> nativo: Esc cierra, el foco entra al abrir
 * y vuelve al elemento que lo abrió al cerrar.
 */
export function Modal({ open, onClose, title, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      returnFocusRef.current?.focus();
    }
  }, [open]);

  // Si se desmonta abierto, devolvemos el foco igual.
  useEffect(() => () => returnFocusRef.current?.focus(), []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Esc: lo controla el padre a través de `open`.
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        // Click en el fondo (fuera de la caja) cierra.
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-borde bg-superficie p-0 text-tinta shadow-xl backdrop:bg-tinta/50"
    >
      {open && (
        <div className="p-5 sm:p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 rounded px-2 text-xl leading-none text-tinta-suave hover:text-tinta"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
```

- [ ] **Step 3: ConfirmDialog**

`frontend/src/shared/components/ConfirmDialog.tsx`:
```tsx
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, loading = false }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={loading ? () => undefined : onCancel} title={title}>
      <p className="text-sm text-tinta-suave">{message}</p>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secundario" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="button" className="btn-peligro" onClick={onConfirm} disabled={loading}>
          {loading ? 'Eliminando…' : 'Eliminar'}
        </button>
      </div>
    </Modal>
  );
}
```

- [ ] **Step 4: FormField**

`frontend/src/shared/components/FormField.tsx`:
```tsx
import type { ReactNode } from 'react';

interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  children: ReactNode;
}

/**
 * Label + campo + error. El input de adentro tiene que llevar:
 *   id={htmlFor}  className="campo"  aria-invalid={!!error}
 *   aria-describedby={error ? `${htmlFor}-error` : undefined}
 */
export function FormField({ label, htmlFor, error, children }: FormFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-tinta">
        {label}
      </label>
      {children}
      {error && (
        <p id={`${htmlFor}-error`} className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5: DataTable** (tabla semántica, estado de carga, lista vacía, scroll dentro del contenedor)

`frontend/src/shared/components/DataTable.tsx`:
```tsx
import type { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  rows: T[] | undefined;
  columns: Column<T>[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyMessage?: string;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading = false,
  emptyMessage = 'Todavía no hay registros.',
}: DataTableProps<T>) {
  const data = rows ?? [];

  return (
    // En pantallas chicas la tabla scrollea dentro de su contenedor, no la página.
    <div className="overflow-x-auto rounded-lg border border-borde bg-superficie">
      <table className="w-full min-w-[36rem] border-collapse text-left text-sm tabular-nums" aria-busy={loading}>
        <thead className="border-b border-borde bg-hundido font-display text-[0.8125rem] font-semibold tracking-wider text-tinta-suave uppercase">
          <tr>
            {columns.map((col) => (
              <th key={col.header} scope="col" className="px-4 py-3 whitespace-nowrap">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-tinta-suave">
                Cargando…
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-10 text-center text-tinta-suave">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={rowKey(row)} className="border-t border-borde hover:bg-fondo">
                {columns.map((col) => (
                  <td key={col.header} className="px-4 py-3 align-middle">
                    {col.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Verificar**

Run: `npx tsc --noEmit -p frontend`
Expected: exit 0.

- [ ] **Step 7: Commit**

---

### Task 4: Aviso de caída

**Files:**
- Create: `frontend/src/shared/hooks/useDbStatus.ts`, `frontend/src/shared/components/DbDownBanner.tsx`, `frontend/src/main.tsx`

**Interfaces:**
- Consumes: `apiGet`, `ApiError` (Task 1); `useToast` (Task 3).
- Produces: `useDbStatus(): { dbCaida: boolean }`, `marcarDbCaida(): void`, `DbDownBanner({ visible: boolean })`.

- [ ] **Step 1: Hook con polling y store global**

`frontend/src/shared/hooks/useDbStatus.ts`:
```ts
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { apiGet } from '../../api/client';
import { useToast } from '../components/Toast';

const POLL_OK_MS = 30_000;
const POLL_CAIDO_MS = 5_000;

interface Health {
  status: string;
  db: 'up' | 'down';
}

// Estado global "la base está caída". Lo escriben el polling de /api/health
// y el onError de QueryCache/MutationCache (main.tsx) ante un 503 o status 0.
let caido = false;
const listeners = new Set<() => void>();

function setCaido(valor: boolean) {
  if (caido === valor) return;
  caido = valor;
  listeners.forEach((l) => l());
}

export function marcarDbCaida(): void {
  setCaido(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => caido;

async function dbResponde(): Promise<boolean> {
  try {
    const health = await apiGet<Health>('/health');
    return health.db === 'up';
  } catch {
    return false;
  }
}

/**
 * Hace polling de GET /api/health: cada 30 s si todo anda, cada 5 s si está caído.
 * Cuando la base vuelve, recarga todas las queries y muestra "Conexión recuperada".
 * Se usa una sola vez, en el Layout.
 */
export function useDbStatus(): { dbCaida: boolean } {
  const dbCaida = useSyncExternalStore(subscribe, getSnapshot);
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const anterior = useRef(dbCaida);

  // Transición caído → arriba.
  useEffect(() => {
    if (anterior.current && !dbCaida) {
      void queryClient.invalidateQueries();
      showToast('Conexión recuperada', 'success');
    }
    anterior.current = dbCaida;
  }, [dbCaida, queryClient, showToast]);

  // Chequeo inicial al montar.
  useEffect(() => {
    let cancelado = false;
    void dbResponde().then((ok) => {
      if (!cancelado) setCaido(!ok);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  // Polling. Si el estado cambia, el efecto se reinicia con el intervalo nuevo.
  useEffect(() => {
    let cancelado = false;
    let timer: ReturnType<typeof setTimeout>;

    const programar = () => {
      timer = setTimeout(async () => {
        const ok = await dbResponde();
        if (cancelado) return;
        setCaido(!ok);
        if (getSnapshot() === dbCaida) programar();
      }, dbCaida ? POLL_CAIDO_MS : POLL_OK_MS);
    };
    programar();

    return () => {
      cancelado = true;
      clearTimeout(timer);
    };
  }, [dbCaida]);

  return { dbCaida };
}
```

- [ ] **Step 2: Banner**

`frontend/src/shared/components/DbDownBanner.tsx`:
```tsx
export function DbDownBanner({ visible }: { visible: boolean }) {
  return (
    // El contenedor con role="status" siempre está en el DOM para que el lector de pantalla anuncie el cambio.
    <div role="status">
      {visible && (
        <div className="border-b border-peligro/30 bg-peligro-claro">
          <p className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 text-sm font-medium text-peligro sm:px-6">
            <span aria-hidden="true" className="size-2 shrink-0 animate-pulse rounded-full bg-peligro" />
            La base de datos no responde. Reintentamos cada 5 segundos.
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: `main.tsx`: fuentes, QueryClient con detección de 503 o status 0, providers**

`frontend/src/main.tsx`:
```tsx
import '@fontsource/barlow-condensed/600.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import './index.css';

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ApiError } from './api/client';
import { App } from './App';
import { ToastProvider } from './shared/components/Toast';
import { marcarDbCaida } from './shared/hooks/useDbStatus';

// Un 503 (DB_UNAVAILABLE / BACKEND_UNAVAILABLE) o status 0 (sin red) en cualquier
// query o mutation muestra el banner de "base caída" sin esperar al próximo polling.
function detectarCaida(error: unknown) {
  if (error instanceof ApiError && (error.status === 503 || error.status === 0)) {
    marcarDbCaida();
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: detectarCaida }),
  mutationCache: new MutationCache({ onError: detectarCaida }),
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('No se encontró #root');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit -p frontend`
Expected: exit 0. El comportamiento se verifica en la Task 6, con el stack levantado.

- [ ] **Step 5: Commit**

---

### Task 5: Layout, rutas y páginas

**Files:**
- Create: `frontend/src/shared/components/Layout.tsx`, `frontend/src/shared/components/NotFoundPage.tsx`, `frontend/src/App.tsx`
- Create: `frontend/src/features/{autos,modelos,clientes,vendedores,sucursales}/<Entidad>Page.tsx`

**Interfaces:**
- Consumes: `useDbStatus`, `DbDownBanner` (Task 4).
- Produces: `App`, `Layout`, `NotFoundPage`, `AutosPage`, `ModelosPage`, `ClientesPage`, `VendedoresPage`, `SucursalesPage`. **Desde el día 2, cada integrante reemplaza el contenido de su página.**

- [ ] **Step 1: Layout** (menú con las 5 secciones, banner y pie "Proyecto académico — no afiliado a Honda")

`frontend/src/shared/components/Layout.tsx`:
```tsx
import { NavLink, Outlet } from 'react-router';
import { useDbStatus } from '../hooks/useDbStatus';
import { DbDownBanner } from './DbDownBanner';

const SECCIONES = [
  { to: '/autos', label: 'Autos' },
  { to: '/modelos', label: 'Modelos' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/vendedores', label: 'Vendedores' },
  { to: '/sucursales', label: 'Sucursales' },
] as const;

export function Layout() {
  const { dbCaida } = useDbStatus();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-grafito text-white">
        <div className="mx-auto flex max-w-6xl flex-col px-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-6 sm:px-6">
          <p className="flex items-center gap-2 pt-4 pb-1 font-display text-lg leading-none font-semibold tracking-wider uppercase sm:py-4">
            <span aria-hidden="true" className="h-5 w-1 bg-marca" />
            Concesionaria La Plata
          </p>
          <nav aria-label="Secciones" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex">
              {SECCIONES.map((s) => (
                <li key={s.to}>
                  <NavLink
                    to={s.to}
                    className={({ isActive }) =>
                      `flex h-full items-center border-b-[3px] px-3 py-3 font-display text-[0.9375rem] font-semibold tracking-wider whitespace-nowrap uppercase transition-colors sm:py-0 ${
                        isActive
                          ? 'border-marca text-white'
                          : 'border-transparent text-white/65 hover:text-white'
                      }`
                    }
                  >
                    {s.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <DbDownBanner visible={dbCaida} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>

      <footer className="border-t border-borde">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-tinta-suave sm:px-6">
          Proyecto académico — no afiliado a Honda
        </p>
      </footer>
    </div>
  );
}
```

- [ ] **Step 2: Página 404**

`frontend/src/shared/components/NotFoundPage.tsx`:
```tsx
import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <section className="py-10">
      <h1 className="titulo-pagina">Página no encontrada</h1>
      <p className="mt-2 text-tinta-suave">La dirección que abriste no existe.</p>
      <Link to="/autos" className="btn-secundario mt-6">
        Volver a Autos
      </Link>
    </section>
  );
}
```

- [ ] **Step 3: Páginas "En construcción"** (una por módulo)

`frontend/src/features/autos/AutosPage.tsx`:
```tsx
export function AutosPage() {
  return (
    <section>
      <h1 className="titulo-pagina">Autos</h1>
      <p className="mt-2 text-tinta-suave">En construcción — módulo 3</p>
    </section>
  );
}
```

`frontend/src/features/modelos/ModelosPage.tsx`:
```tsx
export function ModelosPage() {
  return (
    <section>
      <h1 className="titulo-pagina">Modelos</h1>
      <p className="mt-2 text-tinta-suave">En construcción — módulo 1</p>
    </section>
  );
}
```

`frontend/src/features/clientes/ClientesPage.tsx`:
```tsx
export function ClientesPage() {
  return (
    <section>
      <h1 className="titulo-pagina">Clientes</h1>
      <p className="mt-2 text-tinta-suave">En construcción — módulo 2</p>
    </section>
  );
}
```

`frontend/src/features/vendedores/VendedoresPage.tsx`:
```tsx
export function VendedoresPage() {
  return (
    <section>
      <h1 className="titulo-pagina">Vendedores</h1>
      <p className="mt-2 text-tinta-suave">En construcción — módulo 4</p>
    </section>
  );
}
```

`frontend/src/features/sucursales/SucursalesPage.tsx`:
```tsx
export function SucursalesPage() {
  return (
    <section>
      <h1 className="titulo-pagina">Sucursales</h1>
      <p className="mt-2 text-tinta-suave">En construcción — módulo 5</p>
    </section>
  );
}
```

- [ ] **Step 4: Rutas**

`frontend/src/App.tsx`:
```tsx
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AutosPage } from './features/autos/AutosPage';
import { ClientesPage } from './features/clientes/ClientesPage';
import { ModelosPage } from './features/modelos/ModelosPage';
import { SucursalesPage } from './features/sucursales/SucursalesPage';
import { VendedoresPage } from './features/vendedores/VendedoresPage';
import { Layout } from './shared/components/Layout';
import { NotFoundPage } from './shared/components/NotFoundPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/autos" replace />} />
          <Route path="autos" element={<AutosPage />} />
          <Route path="modelos" element={<ModelosPage />} />
          <Route path="clientes" element={<ClientesPage />} />
          <Route path="vendedores" element={<VendedoresPage />} />
          <Route path="sucursales" element={<SucursalesPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Verificar**

Run: `npm test --prefix frontend && npm run build --prefix frontend`
Expected: 3 passed; el build termina con exit 0 y genera `frontend/dist/`.

Run: `npm run dev --prefix frontend` y abrir `http://localhost:5173`.
Expected: `/` redirige a `/autos`; las 5 secciones navegan; `/cualquier-cosa` muestra "Página no encontrada"; a 360 px de ancho la página no scrollea en horizontal.

- [ ] **Step 6: Commit**

---

### Task 6: Nginx, Dockerfile y verificación del "Listo cuando"

**Files:**
- Create: `frontend/nginx.conf`, `frontend/Dockerfile`

**Interfaces:**
- Consumes: el build de las Tasks 1–5.
- Produces: imagen que escucha en `:8080` como usuario `nginx`, con `HEALTHCHECK`. M4 usa la misma versión de `nginx-unprivileged` (`1.30-alpine`).

- [ ] **Step 1: `nginx.conf`** (tal cual el plan del módulo)

```nginx
server {
  listen 8080;
  server_tokens off;
  root /usr/share/nginx/html;
  location /assets/ { try_files $uri =404; expires 1y; add_header Cache-Control "public, immutable"; }
  location / { try_files $uri $uri/ /index.html; }   # recargar /clientes no da 404
}
```

- [ ] **Step 2: `Dockerfile`** (`1.30` es la estable actual de Nginx)

```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1:8080/ || exit 1
```

- [ ] **Step 3: Verificar la imagen**

Run: `docker build -t concesionaria-frontend frontend`
Expected: `naming to docker.io/library/concesionaria-frontend` y exit 0.

Run: `docker run --rm concesionaria-frontend whoami`
Expected: `nginx`

- [ ] **Step 4: Verificar con el stack** (cuando estén mergeados M1, M2 y M4)

Run: `docker compose up -d --build` y después `docker compose ps`
Expected: `concesionaria_frontend` en `(healthy)`.

- En `http://localhost:8080` se navega por las 5 secciones y recargar `/clientes` no da 404.
- `docker stop concesionaria_db` → el banner aparece en ≤ 30 s.
- `docker start concesionaria_db` → el banner desaparece en ≤ 5 s y aparece el toast "Conexión recuperada".

- [ ] **Step 5: Evidencia para el PR** (skill `verification-before-completion`): pegar la salida real de `npm test`, `npm run build`, `npx tsc --noEmit -p frontend` y `docker run --rm concesionaria-frontend whoami`.

- [ ] **Step 6: Commit** y PR de `m3/dia1-frontend` a `main` (lo revisa M2).

---

## Self-review

- **Cobertura de la spec:** punto 1 (proyecto) → Task 1 · 2 (diseño) → Task 2 · 3 (`client.ts`) → Task 1 · 4 (aviso de caída) → Task 4 · 5 (componentes) → Tasks 3 y 5 · 6 (rutas) → Task 5 · 7 (`nginx.conf` + `Dockerfile`) → Task 6 · 8 (tests de `client.ts`) → Task 1 · "Listo cuando" → Tasks 5 y 6. Sin huecos.
- **Placeholders:** ninguno. La versión de Nginx está fijada (`1.30-alpine`).
- **Consistencia de tipos:** `marcarDbCaida` (Task 4) es el nombre que importa `main.tsx`; `Column<T>` se usa igual en `DataTable` y en `DESIGN.md`; `useToast().showToast(message, type?)` es igual en Toast, useDbStatus y `DESIGN.md`.
- **Fuera del plan, agregado y justificado:** `.dockerignore` (sin él, `COPY . .` copiaría el `node_modules` de Windows a la imagen) y `badge-activo`/`badge-inactivo` (los usan M1 y M4 para el campo `activo`).
