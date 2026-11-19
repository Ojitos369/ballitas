# REPORTE_SEP — separación de caminos

## Sesión 2 (2026-11-19)

**Resultado: la meta NO se cumplió.** La rama queda en el estado del anillo (WIP de la sesión 1, comiteado) con main mezclado. El intento de esta sesión (fila paralela sin giro) está guardado en el commit `f831007` y revertido en `1ec3d53` porque empeoraba pruebas y tiempos.

### Qué se hizo
1. `76977a5` wip: anillo + fila (rizo, embudo) + medidor `tools/separacion.mjs`. `pnpm test` con ese estado: 2 fallos, el tope de tiempo de `sim.test.js:446` (carga) y `layout.test.js` semilla 7 (carriles del anillo a 7.05 u en `w15 sacacorchos/r2 L0@0.93 vs L1@0.92`).
2. `f831007` experimento: se quitó el giro `theta = … + u·TAU`. Carriles lado a lado a lo largo de `T × up` (ángulo 0 de `wallFrame`), normal compartida (`rollAt` = 0), hueco `rowGap(n) = min(26, 2·BRAID_A/(n−1))` con `BRAID_A = 36` y envolvente igual al de antes (`ENV_PAD`).
3. `1ec3d53` revierte el experimento. Después, `git merge main` sin conflictos.

### Mediciones (`node tools/separacion.mjs`, metas 28.2 u de altura y 11.7 u de aire)
Antes = anillo WIP, 3 semillas (369-371), medición del orquestador. Después = experimento de fila, 10 semillas (369-378). Las cifras no son comparables una a una por el número de semillas; entre paréntesis, la fila con 3 semillas (con `BRAID_A = 35`).

| Clase | Anillo WIP (3 semillas) | Fila sin giro (10 semillas) |
|---|---|---|
| tramo:libre gálibo | 72 876 (minH 19.3) | 3 540 (minH 12.8) (3 semillas: 305) |
| tramo:libre lateral | 114 (minD 4.8) | 934 920 (minD 4.2) (3 semillas: 319 010) |
| ruta:libre gálibo / lateral | 19 (13.7) / 29 (6.5) | 72 (9.8) / 148 (2.1) |
| rutas:libre | 0 pares | 2 pares, lateral 28 (minD 7.7) |
| ways:libre | 0 pares | 1 par, lateral 11 (minD 7.6) |
| ways:union gálibo / lateral | 506 (15.4) / 466 (3.8) | 1 827 (14.9) / 1 803 (0.0) |
| rutas:union gálibo | 739 (17.3) | 8 487 (13.4) |
| tramo:union | minH −0.6, minD 0.0 | minH −0.9, minD 0.0 |

Tiempo de generación (misma máquina, cargada): main 4.3 / 5.8 / 4.5 s (semillas 369-371); fila 14.6 / 21.7 (mundo fallido) / 7.1 s. Límite pedido: 1.3 × main. No se midió el anillo en la misma tanda (el orquestador dio 3.8-6.6 s).

### Por qué no sirve la fila tal como quedó
- Quita casi todos los cruces por encima dentro del tramo (gálibo 72 876 → 305 en las mismas 3 semillas), que es lo que se ve en la captura del usuario.
- Pero 5 carriles con aire ≥ 11.7 u necesitan un semiancho de ~52 u (hoy 28 u). Con `BRAID_A = 52` y también con `SIZE_K = 3.9`, `SPREAD_K = 1.9` el reparto falla (mundos `[FALLÓ]`, 20-35 s por mundo). No se encontró en esta sesión qué restricción lo impide (sospecha: abanico de rutas junto a los hubs y zona de puertos).
- Limitada al envolvente actual, la fila de 4 y 5 carriles queda con 6-12 u de aire (de ahí el lateral de tramo), se pellizca en las aperturas de salida/llegada y se dobla sobre sí misma en espiral y sacacorchos; `layout.test.js` falla en las semillas 369, 7 y 11 (huelgo) y 369 (cintas visibles).
- Sin `braidCap` la fila no se estrecha en curvas cerradas dentro de su plano; con él, los carriles se acercan a menos de `RIBBON_CLEAR`.

### No hecho
- Paso 1 (meta en 10 semillas), paso 2 (ampliar el mapa con éxito), paso 3 (≤ 1.3 × main) y paso 4 (prueba nueva en `layout.test.js`, build y capturas en navegador). No se abrió navegador.
- La nota `separacion_visible_en_marco_local.md` no se pudo leer en esta sesión (permiso de lectura denegado fuera del worktree).

### Propuesta para continuar
1. Partir de `f831007` (`git cherry-pick` o `git revert 1ec3d53`).
2. Resolver primero el reparto con envolvente ancho (medir qué criterio de `placeWay`/`routeSlack` rechaza con `BRAID_A = 52`) o decidir con el usuario bajar a 3 carriles por camino (caben con 26 u de hueco en el envolvente actual).
3. Fila en espiral y sacacorchos como copias trasladadas a lo largo del eje de la hélice (como rizo y embudo), con `PITCH` acorde al ancho nuevo.
4. Aperturas: dirección de la fila con transporte paralelo y sin curvas en su plano más cerradas que el semiancho.

Conocimiento consultado: separacion_visible_en_marco_local (no se pudo releer en esta sesión: permiso denegado).

### Estado final de la rama
`pnpm test` tras revertir y mezclar main: 77 pruebas, 76 pasan, 1 falla (`layout.test.js` semilla 7, carriles del anillo a 7.05 u en un sacacorchos). No se hizo build ni navegador.

## Sesión 3 (2026-11-19)

**Resultado: meta intermedia cumplida (reparto ancho sin mundos fallidos, 1.36 × main); meta final NO cumplida; `pnpm test` con 13 fallos de 77. No integrable todavía.** No se abrió navegador ni se hizo `git merge main` final.

### Paso 1: qué rechazaba el envolvente ancho (diagnóstico)
Instrumentación tras interruptor: `DIAG.on` en `world.js` (contador `rej(motivo)` en cada rechazo de `placeWay`, `evalCand` y la fila de rutas) y `node tools/diag_reparto.mjs [semilla] [n]`.
Semilla 369 con el envolvente ancho: casi todo el rechazo es `tubo<CLEAR` (envolvente contra envolvente de otro camino), y la mayor parte con una **salida o llegada** implicada (1 657 de 2 653 en la criba gruesa; los tres caminos fallidos eran `llegada/llegada`, `salida/portal` y `llegada/salida`). `routeSlack` (72 intentos con roce, ninguno sin hueco), `nodo_ajeno` (82), `uniones_cerca` (18) y los `return null` por rozar el nodo (15) son marginales. Conclusión: no era `ROUTE_MARGIN` ni `PERMS`; era el **abanico de salidas y llegadas alrededor de cada nodo**: el nodo, la parrilla y `PORT_ZONE` seguían en unidades viejas mientras el envolvente crecía 1.52 veces, así que las bocas vecinas se abrían antes de tener sitio.

### Paso 2: reparto escalado
- `ANCHO_K = 1.52` (envolvente nuevo 69.3 u / 45.6 u de main) aplicado a: `SIZE_K` (esfera de nodos, panza, arco, `BOWS`), `spread` (× 1.14 extra porque `routeExtent` creció 56.8 / 49.9), `FAN_D`, `ROUTE_JOIN`, `ROUTE_CELL`, `SPATIAL_CELL`, `HUB_MIN` (antes 24·TK suelto), `BRAID_OPEN`, `BRAID_RAMP`, radios de espiral, sacacorchos, embudo y rizo, desniveles (`drop`) y pasos de muestreo de la búsqueda (mismo número de muestras que main).
- `BRAID_A = 52`, `ROW_GAP = 26` (5 carriles, 14.3 u de aire entre bermas), `FILA_GAP = ROW_GAP` (la calzada fundida de rizo y embudo también con aire; `PITCH` sale de `FILA_W` = 141 u).
- `BRAID_OPEN` suma `(NODE_R + GRID_LEN)·(ANCHO_K − 1)`: `PORT_ZONE` pasa de 198 a 292 u (crece en proporción). `NODE_OPEN` = fin de la zona de puerto: dentro de ella los carriles van fundidos en una sola calzada (antes se abrían a 38 u del nodo, entre las salidas vecinas, a 0.8 u de otro camino).
- `SPHERE_R` pasa a ~6 510 u (antes ~4 280).

Tiempo de generación, misma tanda, semillas 369-378: main media **5.89 s** (4.2 / 6.2 / 3.8 / 5.3 / 5.2 / 6.2 / 4.0 / 5.4 / 10.4 / 8.1); rama media **8.02 s** = 1.36 × (6.4 / 14.0 / 9.2 / 7.8 / 4.9 / 4.9 / 6.8 / 5.2 / 14.3 / 6.7), **0 mundos fallidos de 10** (medido antes del cambio de `NODE_OPEN`; no se repitió después). Solo con el factor, sin lo de `PORT_ZONE` y `spread`: 15.4 s y 3 fallidos.

### Mediciones (`node tools/separacion.mjs 3 369`, 3 semillas; no dio tiempo a las 10)
| Clase | Fila sin giro, sesión 2 (3 semillas) | Sesión 3 (3 semillas) |
|---|---|---|
| ways:libre | (10 semillas: 1 par, lateral 11) | **0 pares** |
| rutas:libre | (10 semillas: 2 pares, lateral 28) | **0 pares** |
| tramo:libre gálibo / lateral | 305 / 319 010 | 7 (minH 15.9, llegada) / 8 715 (minD 5.0, espiral) |
| ruta:libre gálibo / lateral | — | 66 (minH 19.7) / 16 (minD 6.7) |
| ways:union gálibo / lateral | — | 1 024 (minH 16.4) / 567 (minD 8.2) |
| rutas:union gálibo / lateral | — | 2 588 (minH 14.9) / 661 (minD 3.2) |
| ruta:union gálibo / lateral | — | 162 (minH 16.0) / 350 (minD 0.0) |
| tramo:union gálibo / lateral | — | 50 349 (minH −2.0) / 12 582 (minD 0.0) |

`tramo:union` sube porque los carriles fundidos de la zona de puerto se cuentan como invasión de gálibo entre sí (minH −2: no son coplanares exactos). Falta definir y medir «fundido coplanar» ahí.

### `pnpm test`: 77 pruebas, 64 pasan, 13 fallan
- 7 de «carriles trenzados» (semillas 1, 2, 3, 369, 7, 11, 40) y 2 de «choques de cintas» (semillas 1 y 369, ~200 choques): todos en `salida`/`llegada`, carriles vecinos a 2.5-5 u en la rampa de apertura al salir de la zona de puerto (la rampa `OPEN_RAMP` = 52 u es corta para abrir 104 u de fila, y cae fuera de `JOINT_MAX`).
- 2 de la semilla 27 (rutas del mismo sentido, huelgo 15.08, faltan 1.42 u; huelgo visual 6.68 u): `canon/r0` contra `geiser/r1`.
- «duración media de viaje fuera de rango 2-3x: 142.6 s»: el mapa es 1.52 veces mayor y la velocidad no cambió. Necesita decisión (subir velocidad en `sim.js`, prohibido para esta pieza, o cambiar el rango).
- «reconstrucción lenta: 3 555 ms» (tope 3 000 ms de `sim.test.js:446`): no se repitió para separar carga del equipo de coste real.

### No hecho
- Paso 3 (espiral y sacacorchos siguen en fila lateral que se dobla: de ahí el lateral de `tramo:libre`), paso 4 con 10 semillas, prueba nueva en `layout.test.js`, build, navegador y capturas, `git merge main` final.
- No se comprobó cómo quedan cámara, niebla y estrellas con `SPHERE_R` 1.52 veces mayor (`Scene.jsx` es de otra pieza): casi seguro hay que alejar la vista libre inicial y la niebla en la misma proporción.

### Siguiente paso concreto
1. Apertura de salida/llegada: rampa propia para nodos (`OPEN_RAMP` ≥ ~3 × semiancho, ~160 u) empezando dentro de `PORT_ZONE`, de modo que los vecinos ya estén a `RIBBON_CLEAR` al salir de la zona exenta; con eso deberían caer los 9 fallos de carriles y choques.
2. Añadir `espiral` y `sacacorchos` a `FILA_KINDS` (ya hay radio y `PITCH` escalados) y medir `tramo:libre`.
3. Semilla 27: subir el extra de `spread` (1.14) o `ROUTE_MARGIN`.
4. Decidir con el usuario la duración del viaje y el ajuste de cámara; después 10 semillas, prueba nueva, build y navegador.

Conocimiento consultado: separacion_visible_en_marco_local