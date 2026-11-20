# REPORTE SINUOSO — caminos de una misma ruta muy separados y sinuosos

Estado: **ENTREGA PARCIAL, NO INTEGRAR TODAVÍA.** La geometría nueva funciona y cumple la meta 1 (separación) y parte de
la 2 (giro de la normal), pero `pnpm test` queda en rojo (3 fallos vistos), no hubo tiempo para build, navegador, capturas,
FPS, cuñas ni `git merge main`. Hash: ver `git log` de la rama `cambio/20261119-174850-sinuoso` (commit «feat(sinuoso)» + este informe).

Conocimiento consultado: separacion_visible_en_marco_local

## Qué cambió
- `front/src/Core/world.js`
  - `sinuarCaminos(world)`: pasada global tras colocar todos los caminos (ways) y antes de `relaxRibbons`. En el tramo
    abierto de cada tramo en fila paralela (no toca rizo, embudo, espiral, sacacorchos, horquilla ni tramos con menos de
    260 u abiertas), cada camino deja la fila y sigue una hélice ancha alrededor del eje (radio hasta `SIN_R` = 240 u,
    pendiente ≤ 0.4, todos los caminos del tramo con el mismo paso y repartidos en ángulo) más un tirabuzón corto propio
    (radio 24 u, paso ~330 u). Marco del eje por transporte paralelo (sin torsión).
  - Choques: rejilla con todas las cintas del mundo (originales de las aún no movidas, finales de las movidas), tramos
    aéreos, nodos y cáscara radial; distancia centro a centro exigida 47.7 u (gálibo 28.2 + cintas 11.7 + quilla +
    margen). Donde choca, el desvío se reduce con rampas largas (`SIN_BLEND` 210 u) hasta, como mucho, la fila original.
  - Giro propio de la normal por camino (`_braid.sroll`, leído en `rollAt`): la calzada mira al eje del tramo y se mece
    con el tirabuzón; ritmo limitado a 0.035 rad/u.
  - `ajustarEventos`: en los tramos sinuosos, vía del evento según distancia y desnivel (caída, elevador, arco, portal),
    `apex` = 3.5·TK + 0.22·distancia, duración = distancia / 120 u/s (0.9 a 4.5 s), y trayectoria muestreada (24 puntos)
    contra una rejilla de todas las cintas; si atraviesa alguna, pasa a la siguiente vía y al final a portal.
  - Interruptor de diagnóstico: `NO_SINUOSO=1` (mide el «antes» en la misma tanda); `SIN_R` por entorno.
- `front/tools/sinuoso.mjs`: medidor nuevo (separación entre caminos del mismo tramo en tramo abierto, fracción en
  recta por tramo, giro de la normal por 300 u, torsión máxima, eventos con trayectoria inválida, vías y duraciones).
- `front/tools/diag_sin.mjs`: busca el mayor quiebro entre vértices de la trenza.

## Métricas (tools/sinuoso.mjs)
Antes: 8 semillas de producción (369-376). Después: 2 semillas (369-370); no hubo tiempo para las 10.

| Métrica | Antes | Después | Meta | ¿Cumple? |
|---|---|---|---|---|
| Separación mediana al camino vecino (tramo abierto) | 26.0 u | 168.0 u (×6.5) | ≥ ×4 | sí |
| Separación mediana de todos los pares | 36.4 u | 192.8 u (×5.3) | ≥ ×4 | sí |
| Tramos con > 15 % en recta (k < 1/400 u) | ~155/236 por semilla | 112/236 por semilla (224/472) | 0 | **no** |
| Giro de la normal por 300 u | 60-65° | 131.9° | ≥ 90° | sí |
| Torsión máx. de la normal entre muestras | 33-54° | 78.5° | < 25° | **no** |
| Quiebro máx. de tangente entre muestras | (no medido) | 79° | — | **no** |
| Eventos con trayectoria inválida | ~11 % (todas en fila) | 9.35 % total; 13 de 2 210 en tramos sinuosos (0.6 %) | 0 | **no** |
| Caminos desviados completos / reducidos / anulados | — | 174 / 268 / 0 de 442 | — | — |
| Generación | 4.6-13.9 s (equipo cargado) | 12.9-14.1 s | ≤ 1.5 × | sin medir en limpio |

Umbral de recta: curvatura < 1/400 u⁻¹ (radio > 400 u), medida entre muestras a 4.7 u.

## Qué NO se cumplió y por qué
1. **`pnpm test` en rojo.** Fallos vistos en la única corrida (la salida se recortó; puede haber más arriba):
   - `sim.test.js:446` reconstrucción con elecciones precalculadas: 3 344 ms contra el tope de 3 000 ms. La pasada añade
     coste de generación (y el equipo estaba cargado); hay que perfilar `sinuarCaminos` (muestrear cada 3 vértices, rejilla tipada).
   - `sim.test.js:458` «elevador sólo hacia uno más alto»: `ajustarEventos` decide el desnivel entre `sw.u` (origen) y
     `sw.uLand` (destino); la prueba lo comprueba de otra forma (revisar la prueba y usar el mismo criterio).
   - Otro fallo anterior con `actual: 3075, expected: 0` cuyo nombre no quedó en la salida (probablemente una prueba de
     choques/separación de layout o de sim): repetir `pnpm test` y leer la cabecera.
2. **Quiebros (torsión 78°, tangente 79°)** en vértices sueltos con la trenza abierta (ej. semilla 369, way 17, salida,
   camino 4, vértice 133 de 219). Ya se quitaron dos causas (marco del eje con torsión; mínimo sin suavizar en la reducción).
   Sospecha del resto: empujes de `relaxRibbons` sobre caminos ya desviados o la reducción a mitades por iteración.
   Siguiente paso: correr `diag_sin.mjs` con la relajación apagada para separar las dos causas.
3. **Rectas:** quedan los tramos que la pasada no toca: calzada fundida (rizo, embudo, espiral, sacacorchos, horquilla),
   zonas de puerto/parrilla y tramos con menos de 260 u abiertas. Siguiente paso: un tirabuzón común (todos los caminos
   juntos) también en las zonas fundidas y en los tramos cortos.
4. **61 % de los caminos salen «reducidos»**: falta desglosar la causa (hermanos, cáscara radial, nodos, otras rutas).
5. **Sin hacer:** build, navegador (capturas POV y vista libre), FPS con geo3.mjs, triángulos, cunas.mjs, separacion.mjs,
   torsion.mjs en 10 semillas, `layout.test.js`, `sim.js` (la duración del vuelo sigue acotada por el `clamp` de sim.js:729:
   los eventos lejanos vuelan entre 0.35× y 1× de `sw.duration`), `git merge main`. No se abrió navegador ni se creó el candado.

## Fallos exactos de `pnpm test` (segunda corrida: 82 pruebas, 78 pasan, 4 fallan)
- «separación visible: 0 pares de caminos o rutas distintas en falta fuera de uniones» (semilla 1 y semilla 369; en la
  primera corrida una dio 3 075 pares): el medidor en marco local (`ribbonClearance`) SÍ ve caminos de rutas o ways
  distintos por debajo del gálibo/aire. La comprobación isotrópica de 47.7 u de `sinuarCaminos` no basta (salta
  vértices de dos en dos y no mira el prisma a lo largo de la normal girada): es una regresión real de la meta 4.
- «elecciones precalculadas (worker/caché)»: 3 034 y 3 344 ms contra el tope de 3 000 ms.
- «carriles: ... kind según la geometría»: «elevador sólo hacia uno más alto».

## Siguiente paso concreto
0. Validar el resultado de la pasada con `ribbonClearance` por clase (tools/separacion.mjs) y endurecer `choca`.
1. `pnpm test` completo y arreglar los tres fallos (coste de la pasada primero).
2. `node tools/diag_sin.mjs` con y sin relajación hasta dejar el quiebro máximo bajo 25°.
3. `node tools/sinuoso.mjs 10`, `separacion.mjs`, `torsion.mjs`, `cunas.mjs`; luego build + capturas en el puerto 4301.

---

# Sesión 2 (continuación sobre el mismo worktree)

Estado: **pruebas en verde (82/82), build correcto, cuñas 0; integrable en lo geométrico.** Quedan fuera de meta las rectas
(paso 5). Navegador y FPS: ver «Navegador» al final de esta sección.

Conocimiento consultado: separacion_visible_en_marco_local

## Qué cambió en la sesión 2 (`front/src/Core/world.js`)
1. **Causa real del rojo de separación:** no eran rutas ni caminos (ways) distintos (`ways:libre` y `rutas:libre` ya daban 0),
   sino los **hermanos** (caminos del mismo tramo): `tramo:libre` gálibo 3 075 (main: 0). La comprobación entre hermanos era
   isótropa (0.9 × hueco de fila) y no miraba la normal ya girada.
   - `hermano()`: prueba en el **marco común de la fila** (lateral `RW` y normal `U0` con el peralte, por estación): prisma de
     gálibo (semiancho calzada + cinta ajena, alto gálibo + quilla) y aire entre bordes (caja redondeada, como `relate` del
     medidor), **solo con lo que va a la par** (|d·T| menor que un paso). Trampa encontrada: sin el filtro «a la par», en
     las curvas la fila original se veía a sí misma en falta y se revertían 75 tramos.
   - **Giro propio solo lejos de los hermanos:** a menos de `SIN_ROLLD` (51.7 u) de un hermano el camino conserva la normal de
     la fila (así vale la prueba del marco común); el giro crece desde ahí con el ritmo limitado (envolvente 1-Lipschitz).
   - **Reparto en zigzag que conserva el orden de la fila:** el camino j toma el ángulo ±α_j (cos α_j creciente con j, signos
     alternos: quedan repartidos en la vuelta completa) respecto de la dirección de la fila en los centros de las dos rampas;
     la hélice gira entre ambos un número entero de vueltas más lo que gire la fila. Al pasar de fila a hélice ningún camino
     cruza a otro. Tres intentos por tramo (radio ×1, ×0.6, ×0.35); si ninguno cabe, el tramo se queda en fila.
2. **Eventos (`ajustarEventos`):** la vía `caida`/`elevador` exige el desnivel del vuelo (u → uLand) **y** el de la prueba
   (los dos caminos en la misma `u`, margen 1.5·TK); los eventos entre vecinos de tramos sinuosos se revalidan (si la
   geometría nueva los contradice pasan a arco; si su vuelo corta una cinta, a portal).
3. **Coste:** `choca` y los eventos comparten una sola rejilla y solo visitan las celdas que toca la esfera; descarte rápido
   entre hermanos por la distancia en la misma estación. Cronómetros en `world.sinuosoT`.
4. **Quiebros:** la causa no era `relaxRibbons` (mismo histograma con `NO_RELAX=1`), sino la amplificación de los pequeños
   quiebros del eje a R del eje (R / paso). Alisado laplaciano (6 pasadas, 0.5) del camino ya desviado.
5. Herramientas: `tools/diag_sin.mjs` (quiebros por zona), `tools/diag_rectas.mjs` (rectas por tipo), `tools/perfil_sin.mjs`
   (coste con elecciones precalculadas), `_capturas/sinuoso_cap.mjs` (capturas POV de tramos sinuosos).

## Métricas (10 semillas, 369-378, salvo donde se indica)
| Métrica | main / antes | Sesión 1 | Sesión 2 | Meta | ¿Cumple? |
|---|---|---|---|---|---|
| `ways:libre` + `rutas:libre` (pares en falta) | 0 | 0 | **0 en 10/10** | 0 | sí |
| `tramo:libre` gálibo (semilla 369) | 0 | 3 075 | **0** (10 semillas: 0) | 0 | sí |
| `tramo:libre` lateral (semilla 369) | 25 (mín 5.9) | 3 417 (mín 4.7) | **25 (mín 5.9)**, igual que main | ≤ 150, ≥ 5 | sí |
| `ruta:libre` gálibo / lateral | 0 / 0 | 0 / 0 | **0 / 0** | 0 / ≤ 20 | sí |
| Separación mediana al camino vecino | 26.0 u | 168.0 u | **191.7 u (×7.4)** | ≥ ×4 | sí |
| Separación mediana de todos los pares | 36.4 u | 192.8 u | **221.0 u** | — | sí |
| Giro de la normal por 300 u | 60-65° | 131.9° | **128.5°** | ≥ 90° | sí |
| Quiebro máx. en tramo abierto sinuoso (369) | — | 55-79° | **17.6°** (0 vértices ≥ 25°) | < 25° | sí |
| Caminos completos / reducidos / en fila | — | 174 / 268 / 0 de 442 | **~400 / ~17 / ~25 de ~442** (90 % completos) | — | — |
| Eventos inválidos en tramos sinuosos | — | 13 de 2 210 | **0-4 por semilla de ~2 100** (portales que aterrizan en calzada fundida, patrón que ya tiene main) | 0 | casi |
| Eventos inválidos, total | ~11 % | 9.35 % | 8.81 % (el resto está en tramos no sinuosos, igual que main) | — | — |
| Reconstrucción con elecciones (sola, 369) | ~1 640 ms | ~2 300 ms | **~2 100 ms (1.28 ×)**; en la batería 2 638 ms | ≤ 2 600 sola, ≤ 1.5 × | sí |
| Tramos con > 15 % en recta | ~155/236 | 112/236 | **91/236 por semilla (910/2 360, 38.6 %)** | ≤ 10 % | **no** |
| `pnpm test` | 76/76 | 78/82 | **82/82** | verde | sí |
| `tools/cunas.mjs` (3 semillas) | 0 | sin medir | **0** | 0 | sí |

La «torsión máx. de la normal» de `sinuoso.mjs` (54.3°) está en `salida @0.04`, zona de puerto que esta pieza no toca
(main: 33-54°).

## Qué NO se cumplió
- **Rectas (paso 5): 38.6 % de los tramos con > 15 % en recta (meta ≤ 10 %).** Desglose de la semilla 369 (`diag_rectas.mjs`):
  salida y llegada sinuosas 34 de 39 (en su tramo abierto solo 9-12 % de recta; lo recto es la parrilla/meta y la calzada
  única del puerto, ~450 u), horquilla 21 de 21 y rizo 15 de 17 (calzada fundida, 37-39 %), rampa en fila 6.
  Se probó una **ondulación común** (traslación rígida de toda la calzada por un tirabuzón de 24 u): bajaba a 130/472 pero
  escalonaba los carriles fundidos (la fila deja de ser perpendicular al avance: `tramo:libre` lateral 213 → 9 750,
  gálibo 0 → 3) y subía la reconstrucción a ~3 100 ms. **Revertida, no está en la rama.** Para hacerlo bien hay que
  ondular el EJE antes de `buildBraid` (que la fila se construya ya sobre el eje ondulado) y revalidar el reparto.
- **Eventos inválidos en sinuosos: 0-4 por semilla** (no 0): portales cuyo aterrizaje cae donde los caminos ya van fundidos.
- Sin tocar `sim.js`: la duración del vuelo sigue acotada por el `clamp` de sim.js (0.35×-1× de `sw.duration`).
