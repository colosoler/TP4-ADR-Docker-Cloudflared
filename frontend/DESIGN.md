# DESIGN.md — Concesionaria La Plata (frontend)

Guía visual para las pantallas de los 5 CRUD, hecha con la skill `frontend-design` sobre el brief del módulo 3. **Seguila tal cual** para que las 5 secciones se vean iguales. Todo está definido en `src/index.css`: tokens en `@theme` y clases con `@utility`.

## Dirección

**"La planilla de stock del salón."** Una app que usa el personal de la concesionaria todo el día. Toma su lenguaje del mundo del salón de ventas: el tablero de stock, las fichas de los autos y las **etiquetas de las llaves**. Los neutros son fríos, de taller, y el encabezado es grafito. El rojo es un acento puntual (sin logos de Honda).

- **Firma:** los estados de los autos son **etiquetas de llave**, con el agujero del llavero y el texto en mayúsculas condensadas. Es lo único llamativo de la interfaz; todo lo demás es sobrio.
- **Lo que se descartó:** fondo crema con acento terracota (el look genérico de las IA), fondo negro con un acento fosforescente y un estilo diario con filetes. Ninguno sale del mundo de una concesionaria.

## Tipografía

| Rol | Fuente | Dónde |
|---|---|---|
| Display | **Barlow Condensed 600**, en mayúsculas y con tracking | títulos de página (`titulo-pagina`), menú, encabezados de tabla, etiquetas de estado |
| Texto | **IBM Plex Sans 400/500/600** | todo lo demás: celdas, formularios, botones, mensajes |

- Se instalan con `@fontsource/barlow-condensed` y `@fontsource/ibm-plex-sans`. **Nada de Google Fonts por URL** (lo bloquea la CSP).
- Barlow se usa con mesura: nunca en párrafos ni en celdas.
- Las tablas usan `tabular-nums`, así que años y precios quedan alineados.
- Los inputs miden 16 px en el celular (para que iOS no haga zoom) y 14 px desde `sm:`.

## Paleta (tokens de `@theme`)

| Token | Hex | Uso |
|---|---|---|
| `fondo` | `#eceef1` | fondo de la página |
| `superficie` | `#ffffff` | tablas, modales, inputs |
| `hundido` | `#f4f5f7` | encabezado de tabla, hover del botón secundario |
| `borde` / `borde-fuerte` | `#d5d9df` / `#aab1bb` | separadores / bordes de inputs y botones |
| `tinta` / `tinta-suave` | `#1f2328` / `#59616c` | texto principal / secundario |
| `grafito` | `#1f2328` | encabezado de la app |
| `marca` | `#c8102e` | botón primario, sección activa, foco (y nada más) |
| `peligro` / `peligro-claro` | `#b3121f` / `#fdecec` | errores, botón "Eliminar", banner de caída |
| `disponible` · `reservado` · `vendido` | `#157f3d` · `#9a5200` · `#5b6573` | etiquetas de estado |

## Etiquetas de estado (la firma)

| Clase | Cómo se ve | Para |
|---|---|---|
| `badge-disponible` | **llena** en verde, texto blanco | auto disponible |
| `badge-reservado` | **tinte** ámbar con borde | auto reservado |
| `badge-vendido` | **solo contorno** en gris, texto tachado | auto vendido |
| `badge-activo` / `badge-inactivo` | llena en verde / solo contorno en gris | campo `activo` de modelos y vendedores |

El relleno (lleno, tinte o contorno) cambia en cada estado, así que se distinguen aunque no se vea el color.

```tsx
const ETIQUETA = { disponible: 'badge-disponible', reservado: 'badge-reservado', vendido: 'badge-vendido' } as const;
<span className={ETIQUETA[auto.estado]}>{auto.estado}</span>
```

## Botones

Los textos son fijos en las 5 pantallas: **"Nuevo &lt;entidad&gt;"**, **"Guardar"**, **"Cancelar"**, **"Editar"** y **"Eliminar"**. Mientras se guarda, el botón queda `disabled` y dice "Guardando…".

| Clase | Cuándo |
|---|---|
| `btn-primario` | "Nuevo …" y "Guardar" (uno solo por vista) |
| `btn-secundario` | "Cancelar" |
| `btn-peligro` | "Eliminar" dentro del `ConfirmDialog` |
| `btn-texto` | "Editar" y "Eliminar" en la columna Acciones |

## Formularios

```tsx
<FormField label="Año" htmlFor="anio" error={errores.anio}>
  <input id="anio" type="number" className="campo"
         aria-invalid={!!errores.anio}
         aria-describedby={errores.anio ? 'anio-error' : undefined} />
</FormField>
```

- En el celular va un campo por fila. Desde `sm:` podés usar `grid gap-4 sm:grid-cols-2`.
- Los errores `400` (`error.details[].path`) y `409` se muestran **debajo de su campo**.
- La botonera va al final: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`, con "Cancelar" y "Guardar".

## Estructura de una pantalla

```tsx
<section>
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <h1 className="titulo-pagina">Autos</h1>
    <button className="btn-primario" onClick={abrirNuevo}>Nuevo auto</button>
  </div>
  <DataTable rows={data} columns={columnas} rowKey={(a) => a.id} loading={isLoading}
             emptyMessage="Todavía no hay autos cargados. Usá “Nuevo auto” para cargar el primero." />
</section>
```

- **Lista vacía:** decí qué falta y cómo cargarlo, como en el ejemplo.
- **Carga:** la resuelve `DataTable` ("Cargando…").
- **Precios:** siempre con `formatPrecio(n)`, que da `$ 42.500.000,00`.
- **Al guardar o eliminar:** el toast repite el verbo del botón (`showToast('Auto guardado')`, `showToast('Auto eliminado')`). Si hay error, `showToast(error.message, 'error')`.

## Responsive (360 px)

- La tabla scrollea **dentro** de su contenedor; la página nunca scrollea en horizontal.
- El menú scrollea en horizontal en pantallas chicas.
- Margen lateral: 16 px (`px-4`) en el celular y 24 px (`sm:px-6`) desde 640 px.

## Accesibilidad

- El foco visible es rojo en todo lo interactivo. No lo saques.
- Se respeta `prefers-reduced-motion`.
- `Modal` cierra con Esc y devuelve el foco al botón que lo abrió.
- Todo input tiene su `<label>` a través de `FormField`.
