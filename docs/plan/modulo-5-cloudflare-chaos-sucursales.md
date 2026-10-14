# Módulo 5 — Cloudflare Tunnel, chaos testing y Sucursales

| | |
|---|---|
| **Responsable** | _(nombre)_ |
| **Revisás los PR de** | M1 |
| **Revisa tus PR** | M4 |
| **Contrato** | [00-plan-general.md](00-plan-general.md): leé §2, §5.1, §5.3, §5.5, §5.7 y §5.8 antes de empezar |

## Tu módulo en una frase

Publicás la app en internet **sin abrir puertos** con un contenedor `cloudflared` (Quick Tunnel). Demostrás con un **chaos test automatizado** que si la base se cae la app no. Además hacés el **CRUD de Sucursales** y el README final.

## Entregables

- **Fase 0**
  - [ ] Servicio `cloudflared` en `docker-compose.yml`
  - [ ] `scripts/tunnel-url.sh` y `.ps1`
  - [ ] Esqueleto de `README.md`
  - [ ] Primera versión de `scripts/chaos-test.sh` y `.ps1`
- **Fase 1**
  - [ ] `db/init/05_sucursales.sql`
  - [ ] `backend/src/modules/sucursales/*`
  - [ ] `frontend/src/features/sucursales/*`
- **Fase 2**
  - [ ] Chaos test completo
  - [ ] README final
  - [ ] Prueba end-to-end por el túnel
  - [ ] Coordinación del ensayo
- **Fase 3**
  - [ ] Exposición: "Chaos testing + bonus Cloudflare Tunnel"

## Skills que vas a usar

| Skill | Cuándo | Prompt para copiar en Claude Code |
|---|---|---|
| `writing-plans` | Al empezar cada fase | `Usá la skill writing-plans. La spec es la Fase 0 de docs/plan/modulo-5-cloudflare-chaos-sucursales.md y el contrato es docs/plan/00-plan-general.md. Guardá el plan en docs/tareas/m5-fase0-tunel.md.` |
| `supabase-postgres-best-practices` | Fase 1 (tabla) | `Cargá supabase-postgres-best-practices y revisá db/init/05_sucursales.sql contra references/schema-constraints.md y schema-data-types.md.` |
| `nodejs-typescript-app` | Fase 1 (API) | `Cargá nodejs-typescript-app e implementá backend/src/modules/sucursales según mi módulo y §5.8 del contrato.` |
| `test-driven-development` | Fase 1 | `Con test-driven-development, escribí primero los 7 tests de sucursales.test.ts que lista mi módulo, verificá que fallan y después implementá.` |
| `react-typescript-app` | Fase 1 (pantalla) | `Cargá react-typescript-app y armá frontend/src/features/sucursales usando los componentes compartidos y frontend/DESIGN.md.` |
| `systematic-debugging` | Si el túnel o el chaos test fallan | `Usá systematic-debugging: el chaos test muestra 500 en /api/autos con la base caída en vez de 503. Salida: <pegar>.` |
| `verification-before-completion` | Antes de cada PR, y es la base del chaos test | `Usá verification-before-completion: corré scripts/chaos-test.sh completo y armá la evidencia para el PR.` |
| `code-review-expert` | Cuando revisás a M1 | `Usá code-review-expert para revisar la rama m1/fase0-compose contra main.` |
| `sigma` | Fase 3 | Ver "Tu parte de la exposición". |

---

## Fase 0 — Túnel y esqueletos (días 1–3)

### Archivos

```
docker-compose.yml        (agregás el servicio cloudflared)
scripts/tunnel-url.sh  scripts/tunnel-url.ps1
scripts/chaos-test.sh  scripts/chaos-test.ps1   (primera versión)
README.md                 (esqueleto)
```

### Pasos

**1. Entender el Quick Tunnel antes de que exista el compose (días 1–2).**
1. Levantá cualquier cosa local, por ejemplo el frontend con `npm run dev --prefix frontend` cuando M3 lo tenga, o `python -m http.server 5173`.
2. Ejecutá:
   ```bash
   docker run --rm cloudflare/cloudflared:<AAAA.M.P> tunnel --no-autoupdate --url http://host.docker.internal:5173
   ```
3. En el log aparece una URL `https://…trycloudflare.com`. Abrila desde el celular, con datos móviles.

Ahí está todo el concepto: `cloudflared` abre una conexión **saliente** hacia Cloudflare, y Cloudflare reenvía las visitas por esa conexión. **No se abre ningún puerto en el router.** Buscá en Docker Hub la última versión de `cloudflare/cloudflared` y fijala (nada de `latest`).

**2. Servicio en `docker-compose.yml`** (cuando M1 haya mergeado el compose: hacé rebase sobre `main`):

```yaml
  cloudflared:
    image: cloudflare/cloudflared:<AAAA.M.P>
    container_name: concesionaria_tunnel
    command: tunnel --no-autoupdate --url http://proxy:8080
    depends_on:
      proxy:
        condition: service_healthy
    networks: [edge_net]       # la única red con salida a internet
    profiles: [tunnel]         # solo arranca con --profile tunnel
    restart: unless-stopped
```

- **No publica puertos.**
- Apunta al **proxy**, no al frontend: así todo lo que entra por el túnel pasa por el reverse proxy, con sus headers y su rate limit.
- La URL cambia cada vez que se reinicia el contenedor. Es lo esperado en un Quick Tunnel.

**3. `scripts/tunnel-url.sh` y `.ps1`.** Buscan en `docker compose logs cloudflared` la URL que cumple `https://[a-z0-9-]+\.trycloudflare\.com`. Reintentan cada 2 s hasta 30 s.
- Cuando la encuentran, imprimen **solo la URL** por stdout (cualquier otro mensaje va a stderr), así se puede usar dentro de otro comando: `curl -sI "$(./scripts/tunnel-url.sh)"`.
- Si no aparece, salen con código 1 y el mensaje "No se encontró la URL del túnel. ¿Levantaste con --profile tunnel?".

**4. Esqueleto de `README.md`.** Con los títulos de las secciones del README final (Fase 2) y ya completa la sección "Cómo levantarlo":

```bash
cp .env.example .env        # y cambiá las claves
docker compose up -d --build
# abrir http://localhost:8080
docker compose --profile tunnel up -d
./scripts/tunnel-url.sh     # URL pública
```

**5. Primera versión de `scripts/chaos-test.sh` y `.ps1`.** Solo con lo que ya existe en la Fase 0:
1. `GET /api/health` → `"db":"up"`.
2. Guarda `docker inspect concesionaria_backend --format "{{.State.Pid}} {{.State.StartedAt}} {{.RestartCount}}"`.
3. `docker stop concesionaria_db`.
4. `GET /api/health` → `"db":"down"` y status `200`.
5. Comprueba que el `inspect` del backend da lo mismo que en el paso 2.
6. `docker start concesionaria_db`; espera a que esté `healthy` (hasta 60 s).
7. `GET /api/health` → `"db":"up"`.

Imprime `PASS`/`FAIL` por paso y sale con `0` si todo pasó, `1` si no. **En PowerShell 5.1 usá `curl.exe`, no `curl`:** `curl` es un alias de `Invoke-WebRequest` y se comporta distinto.

### Criterios de aceptación

- [ ] `docker compose --profile tunnel up -d` levanta `concesionaria_tunnel`, y `scripts/tunnel-url` imprime una URL.
- [ ] Esa URL abre la app desde el celular, con datos móviles y fuera de tu red.
- [ ] `docker compose ps` muestra que `cloudflared` no publica puertos.
- [ ] Sin `--profile tunnel`, `cloudflared` no arranca.
- [ ] La primera versión del chaos test pasa (código de salida `0`).

### Cómo verificarlo

```bash
docker compose --profile tunnel up -d --build
./scripts/tunnel-url.sh                       # → https://xxxx.trycloudflare.com
curl -sI "$(./scripts/tunnel-url.sh)" | grep -iE "^HTTP|x-frame|content-security"
docker compose ps --format "table {{.Name}}\t{{.Ports}}"
./scripts/chaos-test.sh; echo "código de salida: $?"
```

---

## Fase 1 — CRUD de Sucursales (días 4–9)

Es el mismo molde que siguen los otros 4 módulos (§5.7 del contrato).

### Tabla: `db/init/05_sucursales.sql`

Copiá el DDL de `sucursales` de §5.6 **tal cual** y agregá estos datos de ejemplo (las direcciones son ficticias):

| nombre | direccion | localidad | telefono |
|---|---|---|---|
| Casa Central | Av. 7 N° 1500 | La Plata | 221 400-1000 |
| City Bell | Calle 14 G N° 300 | City Bell | 221 400-2000 |
| Berisso | Av. Montevideo N° 900 | Berisso | 221 400-3000 |
| Gonnet | Camino Centenario N° 2500 | Gonnet | (sin teléfono) |

Para que se aplique: `docker compose down -v && docker compose up -d --build`.

### Endpoints (`backend/src/modules/sucursales/`)

| Método y ruta | Respuesta |
|---|---|
| `GET /api/sucursales` | `200`, `order by nombre` |
| `GET /api/sucursales/:id` | `200` o `404` "Sucursal no encontrada" |
| `POST /api/sucursales` | `201`; `400`; `409` "Ya existe una sucursal con ese nombre" |
| `PUT /api/sucursales/:id` | `200`, `400`, `404` o `409` |
| `DELETE /api/sucursales/:id` | `204` o `404` |

Forma en el JSON:

```json
{ "id": 1, "nombre": "Casa Central", "direccion": "Av. 7 N° 1500", "localidad": "La Plata",
  "telefono": "221 400-1000", "createdAt": "…", "updatedAt": "…" }
```

### Validaciones (`sucursales.schema.ts`, zod)

Un solo esquema para `POST` y `PUT`:

| Campo | Regla |
|---|---|
| `nombre` | trim, 1–60 caracteres |
| `direccion` | trim, 1–100 caracteres |
| `localidad` | `'La Plata' \| 'City Bell' \| 'Gonnet' \| 'Berisso' \| 'Ensenada'`; por defecto `'La Plata'` |
| `telefono` | opcional y nullable; trim, 6–20 caracteres |

Si el `insert` o el `update` tiran `23505` con `err.constraint === 'sucursales_nombre_key'`, el service lanza `ConflictError('Ya existe una sucursal con ese nombre')`.

### Tests (`sucursales.test.ts`) — escribilos ANTES de implementar

Con Supertest contra `app` y `sucursales.service` mockeado con `vi.mock`:

1. `GET /api/sucursales` → `200` y devuelve el array del service.
2. `GET /api/sucursales/abc` → `400`.
3. `GET /api/sucursales/999` cuando el service lanza `NotFoundError` → `404` con `error.code === 'NOT_FOUND'`.
4. `POST` con `localidad: 'Quilmes'` → `400` y `error.details[0].path === 'localidad'`.
5. `POST` válido sin `localidad` → `201`, y el service recibe `localidad: 'La Plata'`.
6. `POST` cuando el service lanza `ConflictError` → `409`.
7. `DELETE /api/sucursales/1` → `204`.

### Pantalla (`frontend/src/features/sucursales/`)

- **`SucursalesPage.tsx`**
  - `DataTable` con columnas: Nombre · Dirección · Localidad · Teléfono · Acciones (Editar, Eliminar).
  - Botón "Nueva sucursal" que abre `SucursalForm` en un `Modal`.
  - "Eliminar" abre `ConfirmDialog`.
- **`SucursalForm.tsx`**
  - Campos: nombre, dirección, localidad (select), teléfono.
  - Los errores `400` y `409` de la API se muestran debajo de cada campo (`details[].path` → `FormField error`).
  - Al guardar: toast "Sucursal guardada" e `invalidateQueries({ queryKey: ['sucursales'] })`.

### Criterios de aceptación

- [ ] Los 7 tests pasan: `npm test --prefix backend`.
- [ ] En `http://localhost:8080/sucursales` se puede listar, crear, editar y borrar.
- [ ] Un nombre repetido muestra "Ya existe una sucursal con ese nombre" en el campo nombre.
- [ ] Con la base detenida, `curl -si http://localhost:8080/api/sucursales` responde `503` `DB_UNAVAILABLE`.

---

## Fase 2 — Chaos testing, README y prueba end-to-end (días 10–12)

### 1. Chaos test completo (`scripts/chaos-test.sh` y `.ps1`)

Es la consigna central del TP: **matar la base mientras la app está en uso y demostrar que el backend sobrevive.**

| Paso | Qué hace | Qué tiene que pasar |
|---|---|---|
| 0 | Precondición | `docker compose ps` con todo `healthy` |
| 1 | `GET` de los 5 recursos (`/api/modelos`, `/api/clientes`, `/api/autos`, `/api/vendedores`, `/api/sucursales`) | todos `200`. Guarda PID, `StartedAt` y `RestartCount` del backend |
| 2 | Tira la base: `docker stop concesionaria_db`, o `docker kill concesionaria_db` si se pasa `--kill` / `-Kill` (más abrupto) | — |
| 3 | Durante 15 s, cada 1 s, `GET` de los 5 recursos | todos `503` con `"code":"DB_UNAVAILABLE"` (cada request tarda ≤ 3 s) |
| 4 | `GET /api/health` | `200` con `"db":"down"` |
| 5 | El backend sobrevivió | mismo PID, mismo `StartedAt`, mismo `RestartCount`, `State.Running = true` |
| 6 | Levanta la base: `docker start concesionaria_db` | queda `healthy` (hasta 60 s) |
| 7 | `GET` de los 5 recursos | `200` otra vez, reintentando hasta 30 s, **sin reiniciar el backend** |
| 8 | Resumen | tabla `PASS`/`FAIL` con la hora de cada paso; código de salida `0` o `1` |

Si un recurso da `500` en vez de `503`, su dueño está usando el pool directo. Avisale (M2 te ayuda a diagnosticar).

**Prueba visual.** Con el navegador abierto en `/autos`, tanto en `localhost:8080` como en la URL del túnel, corré el script:
- el banner de M3 aparece mientras la base está caída;
- desaparece solo cuando vuelve;
- los datos se recargan sin tocar nada.

**Grabá un video corto de esta prueba como plan B por si la demo en vivo falla.**

### 2. README final

Secciones:
1. **Qué es:** con el aviso "Proyecto académico, no afiliado a Honda".
2. **Arquitectura:** el diagrama de §2 del contrato.
3. **Requisitos.**
4. **Cómo levantarlo.**
5. **Publicarlo en internet:** Quick Tunnel, cómo obtener la URL y por qué no hace falta abrir puertos.
6. **Chaos test paso a paso:** a mano y con el script.
7. **Seguridad aplicada:** tabla "medida → archivo donde está" (multi-stage, no-root, versiones fijas, HEALTHCHECK, `cap_drop`, `read_only`, `no-new-privileges`, límites, 3 redes, `.env`, rol de mínimo privilegio, headers, CSP, rate limit). Pediles a M1, M2 y M4 que la validen.
8. **Estructura del repo y quién hizo cada módulo.**
9. **Comandos útiles:** §9.3 del contrato.
10. **Problemas conocidos:** link a §5.9.
11. **Próximos pasos:** *named tunnel*, que requiere una cuenta de Cloudflare y un dominio propio. Así se obtiene una URL fija: `command: tunnel --no-autoupdate run` con `TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN}` en el `.env`.

### 3. Prueba end-to-end por el túnel

- Desde un celular con datos móviles, recorré las 5 secciones por la URL `trycloudflare` y hacé un alta en cada una.
- `curl -sI https://<url>/` muestra los headers de seguridad del proxy.
- En `docker compose logs proxy` se ve **la IP real del visitante**, no la del contenedor del túnel. Eso confirma el `CF-Connecting-IP` de M4.

### 4. Coordinación del ensayo (Fase 3)

- Armá el guion de la exposición con el orden de §12 del contrato y los comandos de cada demo.
- **Plan B si el túnel en contenedor falla en vivo:**
  1. Instalá `cloudflared` en la máquina de la demo, de antemano: `winget install --id Cloudflare.cloudflared`.
  2. Ejecutá `cloudflared tunnel --url http://localhost:8080`.

  Funciona igual que el comando del TP de ejemplo.
- Ensayo completo cronometrado con los 5.

### Criterios de aceptación

- [ ] `./scripts/chaos-test.sh` y `.\scripts\chaos-test.ps1` terminan con código `0` sobre el stack completo **con el hardening de M1 y M4 aplicado**.
- [ ] Pegaste su salida en el PR.
- [ ] El README permite que alguien que no estuvo en el grupo clone, levante, publique y corra el chaos test.
- [ ] La prueba end-to-end por el túnel está hecha.
- [ ] Hay un ensayo completo.

---

## Review cruzado

Revisás los PR de **M1** (compose, base y Modelos) con `code-review-expert`. Fijate en:

- **Compose:**
  - ningún puerto publicado salvo el del proxy;
  - `data_net` y `app_net` con `internal: true`;
  - el healthcheck de `db` usa `$$`;
  - todas las imágenes tienen versión fija.
- **Secretos:** `.env` en el `.gitignore` y fuera del repo; `.env.example` sin claves reales.
- **`00_roles.sh`:** el rol de la app no puede crear tablas, y el archivo tiene fin de línea LF.
- **Scripts de backup:** no redirigen binarios con `>` en PowerShell.

---

## Tu parte de la exposición (≈5 min): Chaos testing + bonus Cloudflare Tunnel

Slides:
1. **Chaos testing:** qué pide la consigna y los 4 pasos (como la slide 22 del TP de ejemplo).
2. **Cómo lo resolvimos:** `pool.on('error')` → 503 → banner con reintento. Remitís a lo que ya explicó M2.
3. **"¿Cómo hago para que esto esté en internet?":** las dos malas opciones y Cloudflare Tunnel con su conexión saliente.
4. **Quick Tunnel vs named tunnel.**
5. **Cierre:** los tres pilares del TP.

Demo en vivo:
1. Correr `scripts/chaos-test` con el navegador visible: aparece el banner, el backend mantiene el mismo PID y la app se recupera sola.
2. Mostrar la URL `trycloudflare` abierta desde un celular.

Para estudiar: `/sigma Quiero entender qué es el chaos testing y cómo funciona Cloudflare Tunnel: por qué una conexión saliente evita abrir puertos, qué es un Quick Tunnel de TryCloudflare y en qué se diferencia de un named tunnel con dominio propio. Lo tengo que exponer en 5 minutos.`

---

## Definition of Done del módulo

- [ ] Fase 0, Fase 1 y Fase 2 con todos sus criterios de aceptación en verde.
- [ ] Se cumple la Definition of Done general (§11 del contrato).
- [ ] No hay tokens ni credenciales de Cloudflare en el repo.
- [ ] Slides, demo y video de respaldo listos; ensayo hecho.
