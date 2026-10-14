# Módulo 4 — Reverse proxy, seguridad y Vendedores

**Responsable:** ___ · **Revisás los PR de:** M5 · **Te revisa:** M3
Antes de empezar, leé [00-plan-general.md](00-plan-general.md) §2, §5.1, §5.3 y §5.9.

**En una frase:** armás la puerta de entrada única (Nginx enruta `/api/` al backend y `/` al frontend, y agrega los headers de seguridad), endurecés los contenedores y hacés el CRUD de Vendedores.

---

## Día 1 — Reverse proxy

**`proxy/nginx.conf`:**

```nginx
server {
  listen 8080;
  server_tokens off;                 # no revela la versión de Nginx
  client_max_body_size 1m;

  # DNS interno de Docker, resuelto en cada request: el proxy encuentra al backend aunque se recree
  resolver 127.0.0.11 valid=10s ipv6=off;
  set $backend  http://backend:4000;
  set $frontend http://frontend:8080;

  # Headers de seguridad: se ponen UNA vez acá y valen para todo.
  # Ojo: si una location tiene su propio add_header, deja de heredar estos.
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;
  add_header Content-Security-Policy "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-ancestors 'none'" always;

  location = /healthz { access_log off; return 200 "ok\n"; }

  location /api/ {
    proxy_pass $backend;             # pasa /api/... tal cual
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_connect_timeout 3s;
    proxy_read_timeout 15s;
    # SIN proxy_intercept_errors: el 503 DB_UNAVAILABLE del backend tiene que llegar tal cual
    error_page 502 504 = @backend_caido;
  }

  location @backend_caido {
    default_type application/json;
    return 503 '{"error":{"code":"BACKEND_UNAVAILABLE","message":"El servidor no responde. Reintentá en unos segundos."}}';
  }

  location / {
    proxy_pass $frontend;
    proxy_set_header Host $host;
  }
}
```

**`proxy/Dockerfile`:** no hay nada que compilar, así que alcanza con una sola etapa. La versión de Nginx tiene que ser la misma que la del frontend.

```dockerfile
FROM nginxinc/nginx-unprivileged:<mayor.menor>-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=3 CMD wget -q --spider http://127.0.0.1:8080/healthz || exit 1
```

**Listo cuando:**

```bash
docker compose exec proxy nginx -t                       # syntax is ok
curl -sI http://localhost:8080/ | grep -iE "x-frame|x-content-type|referrer|content-security"
curl -s http://localhost:8080/api/health                 # llega al backend
docker compose stop backend
curl -si http://localhost:8080/api/health                # 503 BACKEND_UNAVAILABLE
docker compose start backend                             # vuelve solo, sin reiniciar el proxy
```

---

## Día 2 — CRUD de Vendedores

Seguí la **receta de §5.7**. Lo propio de tu entidad:

| Campo | Validación zod |
|---|---|
| `nombre`, `apellido` | trim, 1–60 caracteres |
| `email` | `z.email()`, se guarda en minúsculas |
| `activo` | boolean, por defecto `true` |

**Mensajes:**
- `404`: "Vendedor no encontrado".
- `409` (cuando `err.constraint === 'vendedores_email_key'`): "Ya existe un vendedor con ese email".

**Datos de ejemplo:** 4 vendedores con emails `@example.com` (3 activos y 1 inactivo).

**Test 3:** `POST` con `email: 'no-es-un-mail'` → `400`.

**Pantalla `/vendedores`:** columnas Apellido y nombre · Email · Activo · Acciones.

---

## Día 3 — Seguridad en capas

**1. Hardening en `docker-compose.yml`.** Va en `backend`, `frontend`, `proxy` y `cloudflared`. El servicio `db` lo endurece M1, porque necesita capabilities propias.

```yaml
x-hardening: &hardening
  cap_drop: [ALL]                         # ningún privilegio de Linux
  security_opt: [no-new-privileges:true]  # nadie puede escalar privilegios
  read_only: true                         # filesystem de solo lectura
  restart: unless-stopped

services:
  backend:     { <<: *hardening, init: true, tmpfs: [/tmp], mem_limit: 256m, pids_limit: 100 }
  frontend:    { <<: *hardening, tmpfs: [/tmp], mem_limit: 128m, pids_limit: 50 }
  proxy:       { <<: *hardening, tmpfs: [/tmp], mem_limit: 128m, pids_limit: 50 }
  cloudflared: { <<: *hardening, mem_limit: 128m, pids_limit: 50 }
```

En el archivo real, sumá estas claves a cada servicio sin borrar las que ya tiene.

**2. Revisión de seguridad rápida** con `code-review-expert` (usá su `references/security-checklist.md`):
- el SQL de los 5 services está parametrizado;
- no hay claves en el repo;
- ningún error devuelve el stack;
- ninguna imagen usa `latest`.

**Listo cuando:**

```bash
docker compose up -d --build && docker compose ps        # todo healthy
docker exec concesionaria_proxy touch /etc/nginx/x       # Read-only file system
docker exec concesionaria_proxy wget -q -T 2 -O- http://db:5432   # bad address 'db' → el proxy no llega a la base
docker exec concesionaria_backend node -e "fetch('https://example.com').then(()=>console.log('TIENE internet')).catch(()=>console.log('sin internet'))"
```

---

## Día 4 — Exposición: "Seguridad en capas y reverse proxy"

Slides:
- Seguridad en el Dockerfile: multi-stage, no-root, versiones fijas, HEALTHCHECK.
- Seguridad en el compose: `cap_drop`, `read_only`, `no-new-privileges` y límites.
- Redes internas y secretos en `.env`.
- Qué es un reverse proxy, con `nginx.conf` explicado.

Demo: `curl -I` mostrando los headers, y el `wget` a `db` que falla.

Para estudiar: `/sigma Explicame cómo funciona un reverse proxy con Nginx y las opciones de hardening de Docker Compose (cap_drop, read_only, no-new-privileges, redes internal). Lo expongo en 5 minutos.`

---

## Prompts útiles

- **Para arrancar cada día:** `Usá la skill writing-plans. La spec es el Día 1 de docs/plan/modulo-4-proxy-seguridad-vendedores.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m4-dia1.md.`
- **Si el proxy no arranca:** `Usá systematic-debugging: con read_only el proxy no arranca. Logs: <pegar>.`
- **Para el review de M5:** `Usá code-review-expert para revisar la rama de M5 contra main.`
