# Módulo 5 — Cloudflare Tunnel, chaos test y Sucursales

**Responsable:** ___ · **Revisás los PR de:** M1 · **Te revisa:** M4
Antes de empezar, leé [00-plan-general.md](00-plan-general.md) §2, §5.1 y §5.5.

**En una frase:** publicás la app en internet **sin abrir puertos** con `cloudflared`, demostrás con un chaos test que si la base se cae la app no, escribís el README y hacés el CRUD de Sucursales.

---

## Día 1 — Túnel de Cloudflare

**1. Probalo suelto primero.** Con cualquier cosa corriendo en tu máquina (por ejemplo `python -m http.server 5173`), ejecutá:

```bash
docker run --rm cloudflare/cloudflared:<AAAA.M.P> tunnel --no-autoupdate --url http://host.docker.internal:5173
```

Te va a dar una URL `https://…trycloudflare.com`. Abrila desde el celular con datos móviles. `cloudflared` abre una conexión **saliente** hacia Cloudflare, así que no hace falta abrir ningún puerto. Fijá la versión de la imagen con la última de Docker Hub.

**2. Agregá el servicio al compose** cuando M1 lo haya subido:

```yaml
  cloudflared:
    image: cloudflare/cloudflared:<AAAA.M.P>
    container_name: concesionaria_tunnel
    command: tunnel --no-autoupdate --url http://proxy:8080   # apunta al PROXY, no al frontend
    depends_on:
      proxy: { condition: service_healthy }
    networks: [edge_net]
    profiles: [tunnel]
    restart: unless-stopped
```

**3. Scripts `scripts/tunnel-url.sh` y `.ps1`:**
- Buscan en `docker compose logs cloudflared` la URL que cumple `https://[a-z0-9-]+\.trycloudflare\.com`, reintentando hasta 30 s.
- Imprimen **solo la URL**. Si no la encuentran, salen con código 1.

**4. `README.md`:** por ahora, solo la sección "Cómo levantarlo" (`cp .env.example .env` → `docker compose up -d --build` → `http://localhost:8080`).

**Listo cuando:**
- `docker compose --profile tunnel up -d` y `./scripts/tunnel-url.sh` te dan una URL;
- esa URL abre la app desde el celular;
- `cloudflared` no publica ningún puerto.

---

## Día 2 — CRUD de Sucursales

Seguí la **receta de §5.7**. Lo propio de tu entidad:

| Campo | Validación zod |
|---|---|
| `nombre` | trim, 1–60 caracteres |
| `direccion` | trim, 1–100 caracteres |
| `localidad` | `'La Plata'`, `'City Bell'`, `'Gonnet'`, `'Berisso'` o `'Ensenada'`; por defecto `'La Plata'` |
| `telefono` | opcional, 6–20 caracteres |

**Mensajes:**
- `404`: "Sucursal no encontrada".
- `409` (cuando `err.constraint === 'sucursales_nombre_key'`): "Ya existe una sucursal con ese nombre".

**Datos de ejemplo:**

| Nombre | Dirección | Localidad |
|---|---|---|
| Casa Central | Av. 7 N° 1500 | La Plata |
| City Bell | Calle 14 G N° 300 | City Bell |
| Berisso | Av. Montevideo N° 900 | Berisso |
| Gonnet | Camino Centenario N° 2500 | Gonnet |

**Test 3:** `POST` con `localidad: 'Quilmes'` → `400`.

**Pantalla `/sucursales`:** columnas Nombre · Dirección · Localidad · Teléfono · Acciones.

---

## Día 3 — Chaos test, README y prueba por el túnel

**1. `scripts/chaos-test.sh` y `.ps1`.** Es la consigna central del TP: **matar la base mientras la app está en uso y demostrar que el backend sobrevive.**

| Paso | Qué hace | Qué tiene que pasar |
|---|---|---|
| 1 | `GET` de los 5 recursos (`/api/modelos`, `/api/clientes`, `/api/autos`, `/api/vendedores`, `/api/sucursales`) | todos `200`. Guarda `docker inspect concesionaria_backend --format "{{.State.Pid}} {{.State.StartedAt}}"` |
| 2 | `docker stop concesionaria_db` | — |
| 3 | `GET` de los 5 recursos | todos `503` con `DB_UNAVAILABLE` |
| 4 | `GET /api/health` | `200` con `"db":"down"` |
| 5 | `docker inspect` del backend | **el mismo PID y el mismo `StartedAt`**: el proceso nunca se reinició |
| 6 | `docker start concesionaria_db`, y esperar a que esté `healthy` | — |
| 7 | `GET` de los 5 recursos, reintentando hasta 30 s | todos `200` otra vez |

El script imprime `PASS`/`FAIL` en cada paso y termina con código `0` (todo pasó) o `1`. En PowerShell usá `curl.exe`, no `curl`.

**2. README final:**
- qué es (con el aviso "Proyecto académico, no afiliado a Honda");
- arquitectura (el diagrama del contrato);
- cómo levantarlo;
- cómo publicarlo con el túnel;
- el chaos test paso a paso;
- tabla "medida de seguridad → archivo donde está";
- quién hizo cada módulo.

**3. Prueba por el túnel:** desde el celular, recorré las 5 secciones y hacé un alta en cada una.

**Listo cuando:**
- `./scripts/chaos-test.sh` termina con código `0`, con el hardening de M1 y M4 aplicado;
- durante la prueba, el banner de M3 aparece y desaparece solo.

**Grabá un video corto** de esto como plan B para la exposición.

---

## Día 4 — Exposición: "Chaos testing + bonus Cloudflare Tunnel"

Slides:
- Qué pide la consigna de chaos testing.
- Los 4 pasos: app funcionando → se cae la base → 503 → se recupera sola.
- Por qué Cloudflare Tunnel no necesita abrir puertos.
- Quick Tunnel vs named tunnel.
- Cierre con los 3 pilares del TP.

Demo: `scripts/chaos-test` con el navegador a la vista, y la URL pública en el celular.

**Plan B si el túnel falla en vivo:** instalá antes `winget install --id Cloudflare.cloudflared` y corré `cloudflared tunnel --url http://localhost:8080`.

Además **coordinás el ensayo** con los 5.

Para estudiar: `/sigma Explicame qué es el chaos testing y cómo funciona Cloudflare Tunnel (conexión saliente, Quick Tunnel vs named tunnel). Lo expongo en 5 minutos.`

---

## Prompts útiles

- **Para arrancar cada día:** `Usá la skill writing-plans. La spec es el Día 1 de docs/plan/modulo-5-cloudflare-chaos-sucursales.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m5-dia1.md.`
- **Si el chaos test falla:** `Usá systematic-debugging: el chaos test da 500 en /api/autos con la base caída en vez de 503. Salida: <pegar>.`
- **Para el review de M1:** `Usá code-review-expert para revisar la rama de M1 contra main.`
