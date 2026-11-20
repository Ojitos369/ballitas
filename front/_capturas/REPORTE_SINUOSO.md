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

## Siguiente paso concreto
1. `pnpm test` completo y arreglar los tres fallos (coste de la pasada primero).
2. `node tools/diag_sin.mjs` con y sin relajación hasta dejar el quiebro máximo bajo 25°.
3. `node tools/sinuoso.mjs 10`, `separacion.mjs`, `torsion.mjs`, `cunas.mjs`; luego build + capturas en el puerto 4301.
