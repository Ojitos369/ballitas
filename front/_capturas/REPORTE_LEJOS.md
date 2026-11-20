# PIEZA LEJOS — caminos visibles desde el mapa

## Avance

La vista libre ya construye el tubo de cristal y la tira de neón a partir de `laneCurve`/`laneLength` para cada `seg.lanes[]`. El muestreo se limita a 12–16 intervalos según la curvatura, y las mallas de cada capa se fusionan por camino. Se mantienen los materiales y el shader de ancho mínimo de 3,2 px; el clic sigue en el tubo de selección. Las curvas se consultan desde `world.js` al construir cada camino.

## Referencia anterior

Build de producción, semilla inicial 369, viewport libre:

- Escritorio 1600×900: 222 484 triángulos de media; 64,9 FPS en una muestra de 30 s.
- Móvil 412×915: 209 097 triángulos de media; 73,6 FPS en una muestra de 30 s.
- Capturas: `lejos_antes/desk_libre.png`, `lejos_antes/movil_libre.png`; vistas cercanas: `lejos_antes/desk_acercamiento.png`, `lejos_antes/movil_acercamiento.png`.

## Verificación

`npx vite build` pasó tras el cambio. Faltan la comparación de rendimiento posterior, el juicio de capturas finales, `pnpm test` y la integración de `main`.

Conocimiento consultado: `ui_visual/mds/vista_limpia_con_jerarquia_de_foco.md`; `rendimiento_web/mds/aparicion_gradual_en_el_borde_de_recorte.md`.
