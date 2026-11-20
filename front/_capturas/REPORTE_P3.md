# Reporte PIEZA P3 — Interfaz de control de ballitas

Fecha: 2026-11-19
Rama: `cambio/20261119-220104-p3-interfaz`
Commit de código verificado: `003fc6e` (este reporte y la sonda se añaden en el commit final de cierre)

Conocimiento consultado: vista_limpia_con_jerarquia_de_foco

## Qué cambió

Se implementó la interfaz completa de control (secciones 2.4, 3 y 5 de `docs/mundo_compartido.md`) de forma aislada sobre `control.html` y `mundoFalso.js`, sin tocar `Core/`, `Pages/`, `Panels/`, `World3D/` ni `back/`:

- `front/vite.config.js`: añadida la entrada Rollup `control.html` en `build.rollupOptions.input`.
- `front/control.html` y `front/src/Components/Control/demo.jsx`: entrada independiente de Vite que monta la escena 3D y paneles existentes junto con `<Control mundo selected onSelect />` sobre `crearMundoFalso()`.
- `front/src/Components/Control/mundoFalso.js` y `mundoFalso.test.js`: implementación en memoria del contrato 2.4 (`yo`, `fila`, `espectadores`, `reglas`, `puede`, `nombreSugerido`, `formar`, `salirFila`, `tomar`, `dejar`, `decidir`, `opciones`, `on`, `cerrar`) sobre una subclase de `Sim`, incluyendo las reglas de fila FIFO al morir otra ballita, inactividad a 3 llegadas (`sinDecidir`), predicción `auto` sin consumir RNG y cálculo puro de `opciones(b)` según 3.5.
- `front/src/Components/Control/previas.js`: miniaturas 2D cacheadas sin montar WebGL por tarjeta (esfera 2D en canvas con color, anillo orbital y emojis de edificios para planetas; polilínea SVG proyectada desde `route.segments[].curve` para rutas; corte de 5 carriles para carril inicial).
- `front/src/Components/Control/Formar.jsx` y `Fila.jsx`: formulario con nombre sugerido editable (recordado en `localStorage['ballitas:nombre']`), botón de sugerir otro nombre (`🎲`), validaciones inline, lista de fila FIFO con puesto propio resaltado (`#N`), etiqueta «Siguiente» y botón «Salir de la fila».
- `front/src/Components/Control/Decisiones.jsx`: barra inferior sobre `nav.puntos` con botón «Tomar control» (si la seleccionada está libre), cabecera con nombre de tu ballita, aviso «Te quedan N rutas sin decidir», botón «Dejar de controlar» y los tres botones («Planeta destino», «Ruta», «Carril inicial») mostrando la decisión fija o «Automático: …», con publicación dinámica de altura (`--ctrl-bar-top`) para elevar `.tarjeta` y `.pov-joy-wrap` sin solapes hasta 360 px.
- `front/src/Components/Control/Selector.jsx` y `Tarjeta.jsx`: diálogo modal con rejilla de `<Tarjeta>` (agrupadas por planeta en rutas cuando no hay destino fijo), panel de detalle lateral/inferior con todo 3.5 (qué se gana, qué se pierde, balance proyectado en rojo si ≤ 0, compañeras, visitados, obstáculos, eventos y regla de carril), navegación por teclado (foco visible, flechas, Enter, Esc cierra el selector con prioridad sobre el Esc de POV) e inspección táctil al primer toque sin confirmar accidentalmente.
- `front/src/Components/Control/index.jsx` y `front/src/static/css/control.css`: orquestación de eventos `cambio`/`entra`/`libre`, toasts de entrada/liberación y estilos integrados con `main.css`.

### Contrato `opciones(b)` consumido por P3 (para alinear con P2)

`mundo.opciones(b)` devuelve `{ origen, planetas, rutas, carriles }`:
- `planetas[]`: `{ idx, wayIdx, name, color, theme: { id, name, emoji, risk, ecost, pps }, destinos: [{ idx, name, kind, dp, de }], maxDp, maxDe, mejorRuta: { r, name, dE, dP, duracion }, llegarE, llegarP, muere, peers, visitado, esAuto }`.
- `rutas[]`: `{ wayIdx, r, routeIdx, name, to, toName, toColor, theme, profile, kinds: [{ key, name, emoji, risk }], length, dE, dP, duracion, llegarE, llegarP, muere, eventos, tramosConEvento, vecesRecorrida, peers, esAuto }`.
- `carriles[]`: `{ carril, nombre, lado, lat, evento: { kind, name, emoji, style, segName, segEmoji, u, reward: { p, e }, fail, risk } | null, probFallo, penalizacion: { velPct, puntos } | null, rutaBase: { wayIdx, r, name, themeName, toName, esElegida } }`.

## Métricas antes / después

- **Apertura del selector de tarjetas** (clic en botón → primer `rAF` con diálogo montado; meta `< 100 ms`):
  - Escritorio (1280×720): **85,5 ms**.
  - Móvil (412×915): **44,1 ms**.
- **FPS con selector abierto vs cerrado** (meta `±15 %`, sin caída medible):
  - Antes (con `backdrop-filter: blur(6px)` en `.ctrl-modal-fondo`, comparando contra mapa base): escritorio 76,4 → 42,0 FPS; móvil 81,3 → 37,8 FPS.
  - Después (eliminado `backdrop-filter` a pantalla completa y medido A/B en la misma vista POV): escritorio **32,9 → 46,6 FPS**; móvil **44,0 → 75,6 FPS** (0 caída atribuible al modal).
- **Solapes y ancho mínimo (360 px)** (medido en `p3_sonda.mjs`):
  - Antes: en 360×640 `solapeDecTarjeta: true`, `solapeDecJoy: true`; en móvil `solapeHubBarra: true`.
  - Después (`--ctrl-bar-top` dinámico + ajuste `<= 390 px`): `overflowX: false`, `solapeDecTarjeta: false`, `solapeDecJoy: false`, `solapeDecPuntos: false`, `solapeHubJoy: false`, `solapeHubBarra: false` en **1280×720**, **412×915** y **360×640**.
- **Errores de consola/página en navegador**: **0** en escritorio y móvil.
- **Pruebas y build**:
  - `node --test src/Components/Control/mundoFalso.test.js`: **2/2 verdes**.
  - `cd front && pnpm test`: **82/82 verdes** (0 fallos, incluida `elecciones precalculadas` en 2139,6 ms).
  - `npx vite build`: compilación limpia de `dist/index.html` y `dist/control.html` (18,97 s y 24,12 s).

## Capturas revisadas (`front/_capturas/p3/`)

1. `desk_01_formar.jpg` — Escritorio 1280×720: panel superior derecho con campo editable `AstroP3`, botón sugerir `🎲`, botón `Formar` y fila `#1 Cometa` sin tapar el mapa 3D.
2. `desk_02_fila.jpg` — Escritorio 1280×720: fila actualizada (`2/30`) mostrando `Tu puesto: #2 de 2`, botón `Salir de la fila` y la fila `#2 AstroP3 (tú)` resaltada.
3. `desk_00_barra_pov.jpg` — Escritorio 1280×720 en POV: barra inferior centrada sobre `nav.puntos` con `⏳ Te quedan 2 rutas sin decidir`, botones en `Automático`, `Dejar de controlar`, sin tapar `.tarjeta` (izq) ni `.ctrl-hub` (der).
4. `desk_03_selector_planeta_hover.jpg` — Escritorio 1280×720: selector de planetas con miniaturas 2D (esferas + edificios), insignia `Auto` en Eco, borde `⚠ Riesgo` en Brasa, foco de teclado en Alba e inspección hover de Cima con detalle completo (qué se gana, qué se pierde, balance y botón `Elegir Cima`).
5. `desk_04_selector_ruta.jpg` — Escritorio 1280×720: selector de rutas agrupado por planeta con polilíneas SVG coloreadas por tema y detalle lateral de `Ruta B · Lenta y segura` (obstáculos, duración, estaciones y aviso de que fija el planeta).
6. `desk_05_selector_carril.jpg` — Escritorio 1280×720: selector de 5 carriles con corte SVG de la calzada y detalle del primer evento (`Elevador`), recompensa, probabilidad de fallo y aviso fijo de retorno al azar tras el primer evento.
7. `movil_01_formar.jpg` — Móvil 412×915: panel `Formar` y fila `1/30` desplegado limpio bajo la barra superior sin invadir los puntos inferiores.
8. `movil_02_fila.jpg` — Móvil 412×915: puesto propio `#2 AstroP3 (tú)` y botón `Salir de la fila` completamente legibles sobre la escena.
9. `movil_00_barra_pov.jpg` — Móvil 412×915 en POV: pastilla `#2 en fila · AstroP3` alineada en segunda fila junto a `Cine`, barra inferior completa sobre `nav.puntos` y `.tarjeta` + joystick virtual elevados por encima sin ningún solape.
10. `movil_03_selector_planeta_hover.jpg` — Móvil 412×915: rejilla 2×2 de planetas, tarjeta `Cima` inspeccionada por toque, detalle inferior desplazable y botón `Elegir Cima` fijo abajo siempre accesible.
11. `movil_04_selector_ruta.jpg` — Móvil 412×915: tarjetas de ruta por planeta con trazos SVG y panel inferior con obstáculos y botón `Elegir Ruta A (Alba)` fijo abajo.
12. `movil_05_selector_carril.jpg` — Móvil 412×915: los 5 carriles en rejilla de 2 columnas con detalle completo de `Carril 1 de 5`, primer evento `Portal` y botón `Elegir Carril 1 de 5`.

## Qué no se cumplió

Nada dentro del alcance de P3. El montaje final de `<Control>` en `front/src/Pages/Main/index.jsx` no se tocó por regla de aislamiento para el orquestador.
