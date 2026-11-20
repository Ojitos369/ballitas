# PIEZA LEJOS — caminos visibles desde el mapa

## Cambio

El tubo y el neón del LOD lejano siguen `laneCurve`/`laneLength` para cada `seg.lanes[]` y consultan las curvas del mundo al construir cada way. El muestreo adaptativo usa 12–16 intervalos; las capas se fusionan por way. Se mantienen los materiales del tema, el desvanecido, el ancho de neón de 3,2 px y el clic en el tubo para elegir el camino.

## A/B de producción

Misma sesión de navegador y viewport, 31 s por estado con el primer segundo descartado. Los triángulos son el promedio de `renderer.info`.

| Vista | Antes: FPS / triángulos | Después: FPS / triángulos | Cambio |
|---|---:|---:|---:|
| Escritorio 1600×900 | 37,6 / 217 628 | 42,1 / 210 609 | FPS +12 %; triángulos −3,2 % |
| Móvil 412×915 | 64,5 / 209 165 | 94,7 / 197 448 | FPS +46,8 %; triángulos −5,6 % |

El máximo permitido según la semilla 369 es 427 484 triángulos (2 × 213 742); ambas vistas quedan por debajo. No hubo errores de página en las sondas.

## Capturas y juicio

Antes y después: `lejos_antes/{desk,movil}_libre.png` y `lejos_despues/{desk,movil}_libre.png`. Acercamiento a una ruta: `lejos_despues/desk_acercamiento.png`.

En escritorio y móvil se distinguen caminos paralelos separados que se retuercen; en el acercamiento de escritorio se ve la calzada y un ramal vecino cerca de un cambio.

## Verificación final

`npx vite build`: pasó. La ejecución paralela `pnpm test` dio 81/82; solo falló `sim.test.js:446` al medir 4 301 ms frente al límite de 3 000 ms. Tres reintentos aislados quedaron entre 3 028 y 4 036 ms. La suite completa pasó 82/82 al ejecutarla serialmente con `pnpm exec node --test --test-concurrency=1 ...` (537 488 ms); la reconstrucción sensible tardó 2 419 ms.

`main` sigue en `dd36440`, el mismo commit base de esta rama; la mezcla final no aporta cambios adicionales a `world.js`.

Conocimiento consultado: `ui_visual/mds/vista_limpia_con_jerarquia_de_foco.md`; `rendimiento_web/mds/aparicion_gradual_en_el_borde_de_recorte.md`.
