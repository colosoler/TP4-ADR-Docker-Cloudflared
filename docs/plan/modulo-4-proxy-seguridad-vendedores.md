# Módulo 4 — Reverse proxy, seguridad en capas y Vendedores

| | |
|---|---|
| **Responsable** | _(nombre)_ |
| **Revisás los PR de** | M5 |
| **Revisa tus PR** | M3 |
| **Contrato** | [00-plan-general.md](00-plan-general.md): leé §2, §5.1, §5.3, §5.4, §5.7 y §5.9 antes de empezar |

## Tu módulo en una frase

Armás la **puerta de entrada única**: el reverse proxy Nginx que enruta `/api/` al backend y `/` al frontend y agrega los headers de seguridad. Después **endurecés los contenedores** (`cap_drop`, `read_only`, `no-new-privileges`, límites). Además hacés el **CRUD de Vendedores**.

## Entregables

- **Fase 0**
  - [ ] `proxy/Dockerfile`
  - [ ] `proxy/nginx.conf`
- **Fase 1**
  - [ ] `db/init/04_vendedores.sql`
  - [ ] `backend/src/modules/vendedores/*`
  - [ ] `frontend/src/features/vendedores/*`
- **Fase 2**
  - [ ] Hardening en el compose de `backend`, `frontend`, `proxy` y `cloudflared`
  - [ ] Rate limit en el proxy
  - [ ] Revisión de seguridad de todo el repo
- **Fase 3**
  - [ ] Exposición: "Seguridad en capas y reverse proxy"

## Skills que vas a usar

| Skill | Cuándo | Prompt para copiar en Claude Code |
|---|---|---|
| `writing-plans` | Al empezar cada fase | `Usá la skill writing-plans. La spec es la Fase 0 de docs/plan/modulo-4-proxy-seguridad-vendedores.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m4-fase0-proxy.md.` |
| `supabase-postgres-best-practices` | Fase 1 (tabla) | `Cargá supabase-postgres-best-practices y revisá db/init/04_vendedores.sql contra references/schema-constraints.md y schema-data-types.md.` |
| `nodejs-typescript-app` | Fase 1 (API) | `Cargá nodejs-typescript-app e implementá backend/src/modules/vendedores según mi módulo y §5.8 del contrato.` |
| `test-driven-development` | Fase 1 | `Con test-driven-development, escribí primero los 7 tests de vendedores.test.ts que lista mi módulo, verificá que fallan y después implementá.` |
| `react-typescript-app` | Fase 1 (pantalla) | `Cargá react-typescript-app y armá frontend/src/features/vendedores usando los componentes compartidos y frontend/DESIGN.md.` |
| `code-review-expert` | Fase 2 (revisión de seguridad) y cuando revisás a M5 | `Usá code-review-expert con references/security-checklist.md sobre TODO el repo (backend, frontend, proxy, compose). Quiero la lista de hallazgos P0–P3.` |
| `systematic-debugging` | Si algo falla | `Usá systematic-debugging: con read_only: true el proxy no arranca. Logs: <pegar>.` |
| `verification-before-completion` | Antes de cada PR | `Usá verification-before-completion con los comandos de "Cómo verificarlo" de mi fase.` |
| `sigma` | Fase 3 | Ver "Tu parte de la exposición". |

---

## Fase 0 — Reverse proxy (días 1–3)

### Archivos

```
proxy/Dockerfile
proxy/nginx.conf
```

### `proxy/nginx.conf`

```nginx
server {
  listen 8080;
  server_name _;
  server_tokens off;            # no revela la versión de Nginx
  client_max_body_size 1m;

  # DNS interno de Docker. Resolver en cada request (y no solo al arrancar) hace que:
  #  - el proxy arranque aunque el backend todavía no exista;
  #  - si el backend se recrea con otra IP, el proxy la encuentre.
  resolver 127.0.0.11 valid=10s ipv6=off;
  set $backend_upstream  http://backend:4000;
  set $frontend_upstream http://frontend:8080;

  # Headers de seguridad: se agregan UNA vez acá y aplican a todo lo que pasa por el proxy.
  # "always" = también en las respuestas de error.
  # OJO: si una location define su propio add_header, deja de heredar estos. No agregues add_header en las locations.
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
  add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'" always;

  location = /healthz {
    access_log off;
    default_type text/plain;
    return 200 "ok\n";
  }

  location /api/ {
    proxy_pass $backend_upstream;           # sin URI: pasa /api/... tal cual
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_connect_timeout 3s;
    proxy_read_timeout 15s;
    # SIN proxy_intercept_errors: el 503 DB_UNAVAILABLE del backend tiene que llegar tal cual al navegador.
    # Esto solo atrapa los errores que genera Nginx (backend apagado o colgado).
    error_page 502 504 = @backend_caido;
  }

  location @backend_caido {
    default_type application/json;
    return 503 '{"error":{"code":"BACKEND_UNAVAILABLE","message":"El servidor no responde. Reintentá en unos segundos."}}';
  }

  location / {
    proxy_pass $frontend_upstream;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_connect_timeout 3s;
  }
}
```

**Asegurate de poder explicar cada línea: es tu exposición.** Sobre `'unsafe-inline'` en `style-src`: solo afecta estilos, no scripts. En la Fase 2 probá sacarlo; si la consola del navegador no muestra errores de CSP, se va.

### `proxy/Dockerfile`

En el proxy no hay nada que compilar, así que alcanza con una sola etapa. La versión de Nginx tiene que ser **la misma** que usa M3 en el frontend.

```dockerfile
FROM nginxinc/nginx-unprivileged:<mayor.menor>-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
```

### Criterios de aceptación

- [ ] `docker compose exec proxy nginx -t` dice `syntax is ok` y `test is successful`.
- [ ] `curl -I http://localhost:8080/` muestra los 5 headers de seguridad, y el header `Server` no incluye la versión.
- [ ] `/healthz` responde `ok`.
- [ ] `/api/health` llega al backend.
- [ ] Con el backend detenido, `/api/health` responde `503` con el JSON `BACKEND_UNAVAILABLE`, sin quedarse colgado. Al levantarlo, vuelve solo, **sin reiniciar el proxy**.
- [ ] Con la base detenida, `/api/<recurso>` devuelve el `503 DB_UNAVAILABLE` **del backend**, no el del proxy.

### Cómo verificarlo

```bash
docker compose up -d --build
docker compose exec proxy nginx -t
curl -sI http://localhost:8080/ | grep -iE "x-frame|x-content-type|referrer|permissions|content-security|^server"
curl -s http://localhost:8080/healthz
curl -s http://localhost:8080/api/health

docker compose stop backend
curl -si http://localhost:8080/api/health          # → 503 BACKEND_UNAVAILABLE
docker compose start backend
sleep 10 && curl -s http://localhost:8080/api/health

docker stop concesionaria_db
curl -si http://localhost:8080/api/clientes        # → 503 DB_UNAVAILABLE (cuando M2 tenga clientes)
docker start concesionaria_db
```

---

## Fase 1 — CRUD de Vendedores (días 4–9)

Es el mismo molde que siguen los otros 4 módulos (§5.7 del contrato).

### Tabla: `db/init/04_vendedores.sql`

Copiá el DDL de `vendedores` de §5.6 **tal cual** y agregá 4 vendedores ficticios:
- con emails `@example.com` (dominio reservado para ejemplos);
- 3 activos y 1 inactivo.

Para que se aplique: `docker compose down -v && docker compose up -d --build`.

### Endpoints (`backend/src/modules/vendedores/`)

| Método y ruta | Respuesta |
|---|---|
| `GET /api/vendedores` | `200`, `order by apellido, nombre` |
| `GET /api/vendedores/:id` | `200` o `404` "Vendedor no encontrado" |
| `POST /api/vendedores` | `201`; `400`; `409` "Ya existe un vendedor con ese email" |
| `PUT /api/vendedores/:id` | `200`, `400`, `404` o `409` |
| `DELETE /api/vendedores/:id` | `204` o `404` |

Forma en el JSON:

```json
{ "id": 1, "nombre": "Martín", "apellido": "Ríos", "email": "martin.rios@example.com",
  "activo": true, "createdAt": "…", "updatedAt": "…" }
```

### Validaciones (`vendedores.schema.ts`, zod)

Un solo esquema para `POST` y `PUT`:

| Campo | Regla |
|---|---|
| `nombre`, `apellido` | trim, 1–60 caracteres |
| `email` | `z.email()`; se guarda en minúsculas y con trim; mensaje "El email no es válido" |
| `activo` | boolean; por defecto `true` |

Si el `insert` o el `update` tiran `23505` con `err.constraint === 'vendedores_email_key'`, el service lanza `ConflictError('Ya existe un vendedor con ese email')`.

### Tests (`vendedores.test.ts`) — escribilos ANTES de implementar

Con Supertest contra `app` y `vendedores.service` mockeado con `vi.mock`:

1. `GET /api/vendedores` → `200` y devuelve el array del service.
2. `GET /api/vendedores/abc` → `400`.
3. `GET /api/vendedores/999` cuando el service lanza `NotFoundError` → `404` con `error.code === 'NOT_FOUND'`.
4. `POST` con `email: 'no-es-un-mail'` → `400` y `error.details[0].path === 'email'`.
5. `POST` válido con `email: ' Martin.Rios@Example.com '` → `201`, y el service recibe `'martin.rios@example.com'`.
6. `POST` cuando el service lanza `ConflictError` → `409`.
7. `DELETE /api/vendedores/1` → `204`.

### Pantalla (`frontend/src/features/vendedores/`)

- **`VendedoresPage.tsx`**
  - `DataTable` con columnas: Apellido y nombre · Email · Estado (badge Activo/Inactivo) · Acciones (Editar, Eliminar).
  - Botón "Nuevo vendedor" que abre `VendedorForm` en un `Modal`.
  - "Eliminar" abre `ConfirmDialog`.
- **`VendedorForm.tsx`**
  - Campos: nombre, apellido, email, activo (checkbox).
  - Los errores `400` y `409` de la API se muestran debajo de cada campo (`details[].path` → `FormField error`).
  - Al guardar: toast "Vendedor guardado" e `invalidateQueries({ queryKey: ['vendedores'] })`.

### Criterios de aceptación

- [ ] Los 7 tests pasan: `npm test --prefix backend`.
- [ ] En `http://localhost:8080/vendedores` se puede listar, crear, editar y borrar.
- [ ] Un email repetido muestra "Ya existe un vendedor con ese email" en el campo email.
- [ ] Con la base detenida, `curl -si http://localhost:8080/api/vendedores` responde `503` `DB_UNAVAILABLE`.

---

## Fase 2 — Seguridad en capas (días 10–12)

### 1. Hardening en `docker-compose.yml` de `backend`, `frontend`, `proxy` y `cloudflared`

El servicio `db` lo endurece M1 (necesita capabilities específicas). Definí un bloque reutilizable arriba del archivo y aplicalo a los otros 4:

```yaml
x-hardening: &hardening
  cap_drop: [ALL]                     # ningún privilegio de Linux
  security_opt:
    - no-new-privileges:true          # ningún proceso puede escalar privilegios
  read_only: true                     # filesystem de solo lectura
  restart: unless-stopped

services:
  backend:
    <<: *hardening
    init: true                        # tini como PID 1: reenvía SIGTERM y recoge procesos zombis
    tmpfs: [/tmp]
    mem_limit: 256m
    pids_limit: 100
  frontend:
    <<: *hardening
    tmpfs: [/tmp]                     # nginx-unprivileged escribe sus temporales en /tmp
    mem_limit: 128m
    pids_limit: 50
  proxy:
    <<: *hardening
    tmpfs: [/tmp]
    mem_limit: 128m
    pids_limit: 50
  cloudflared:
    <<: *hardening
    mem_limit: 128m
    pids_limit: 50
```

Los avisos `can not modify /etc/nginx/conf.d/default.conf (read-only file system?)` de los scripts del entrypoint de Nginx son esperables y no son un error.

### 2. Rate limit en el proxy

Va al principio de `proxy/nginx.conf`, **fuera** del bloque `server` (ese archivo se incluye dentro de `http`):

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

# Detrás de cloudflared todas las requests llegan desde la IP del contenedor del túnel.
# La IP real del visitante viene en CF-Connecting-IP. Solo confiamos en ese header si la request viene de una red de Docker.
set_real_ip_from 172.16.0.0/12;
set_real_ip_from 192.168.0.0/16;
set_real_ip_from 10.0.0.0/8;
real_ip_header CF-Connecting-IP;
```

Dentro de `location /api/` agregá `limit_req zone=api burst=20 nodelay;`, `limit_req_status 429;` y `error_page 429 = @demasiadas;`. Después creá la `location @demasiadas`, que responde `429` con el JSON `RATE_LIMITED` del contrato (§5.4).

### 3. Revisión de seguridad de todo el repo

Con `code-review-expert` y su `references/security-checklist.md`, buscá:

- **SQL:** que esté parametrizado en los 5 services (`grep -rn "query(\`" backend/src` y revisar que nada concatene input).
- **Errores:** que ninguno filtre stack traces; que los logs no tengan DNI ni emails.
- **Secretos:** `git grep -n -i "password"` solo tiene que aparecer en `.env.example` y en el compose (como `${VAR}`).
- **Dependencias:** `npm audit --omit=dev` en `backend` y `frontend`, sin vulnerabilidades *high* o *critical*.
- **CSP:** probá sacar `'unsafe-inline'` de `style-src`.
- **Imágenes:** ninguna usa `latest`: `grep -rn "latest" docker-compose.yml */Dockerfile`.

Los hallazgos de otros módulos se los pasás a su dueño. Los P0 y P1 se corrigen antes del ensayo.

### Criterios de aceptación

- [ ] `docker compose ps`: todo `(healthy)` con el hardening puesto.
- [ ] `docker inspect` de los 4 servicios muestra `CapDrop [ALL]`, `ReadonlyRootfs true` y `no-new-privileges`.
- [ ] El proxy **no** llega a la base.
- [ ] El backend **sí** llega a la base.
- [ ] El backend **no** tiene internet.
- [ ] Una ráfaga de 60 requests produce algunos `429`.
- [ ] La revisión de seguridad no deja ningún P0 ni P1 abierto.

### Cómo verificarlo

```bash
docker compose up -d --build && docker compose ps

docker inspect concesionaria_backend --format "{{.HostConfig.CapDrop}} {{.HostConfig.ReadonlyRootfs}} {{.HostConfig.SecurityOpt}}"
docker exec concesionaria_proxy touch /etc/nginx/prueba                      # → Read-only file system

# Aislamiento de redes
docker exec concesionaria_proxy wget -q -T 2 -O- http://db:5432              # → bad address 'db'
docker exec concesionaria_backend node -e "require('net').connect(5432,'db').on('connect',()=>{console.log('backend llega a db');process.exit(0)}).on('error',e=>{console.log(e.code);process.exit(1)})"
docker exec concesionaria_backend node -e "fetch('https://example.com').then(()=>console.log('TIENE internet')).catch(e=>console.log('sin internet:', e.cause?.code))"

# Rate limit
for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/api/health; done | sort | uniq -c
```

---

## Review cruzado

Revisás los PR de **M5** (túnel, chaos test y Sucursales) con `code-review-expert`. Fijate en:

- **Túnel:** que no haya ningún token ni credencial de Cloudflare en el repo, y que la imagen de `cloudflared` tenga versión fija y esté en el `profile: tunnel`.
- **Chaos test:** que el script falle (código de salida ≠ 0) si algún paso no da lo esperado.
- **Sucursales:** que el SQL esté parametrizado y que un nombre repetido dé `409` (traducido desde el `23505`, no con un "select y después insert", que tiene condición de carrera).

---

## Tu parte de la exposición (≈5 min): Seguridad en capas y reverse proxy

Slides:
1. Seguridad dentro de cada Dockerfile: multi-stage, no-root, versiones fijas, HEALTHCHECK.
2. Seguridad en el compose: `cap_drop`, `read_only` + `tmpfs`, `no-new-privileges`, límites. Para qué sirve cada uno.
3. Red y secretos: las 3 redes, `internal: true`, `.env` fuera del repo, rol de base con mínimo privilegio.
4. Reverse proxy: qué es, por qué esconde la topología y cómo enruta por path.
5. `nginx.conf` explicado: headers, CSP, `error_page`, rate limit con `CF-Connecting-IP`.

Demo:
- `curl -I` con los headers;
- `wget` a `db` desde el proxy → `bad address`;
- `docker exec … touch` → `Read-only file system`.

Para estudiar: `/sigma Quiero entender cómo funciona un reverse proxy con Nginx (proxy_pass, add_header, error_page, limit_req, real_ip) y las opciones de hardening de Docker Compose (cap_drop, read_only, no-new-privileges, redes internal, mem_limit, pids_limit). Lo tengo que exponer en 5 minutos.`

---

## Definition of Done del módulo

- [ ] Fase 0, Fase 1 y Fase 2 con todos sus criterios de aceptación en verde.
- [ ] Se cumple la Definition of Done general (§11 del contrato).
- [ ] El chaos test de M5 pasa con todo el hardening aplicado.
- [ ] Slides y demo listas y ensayadas.
