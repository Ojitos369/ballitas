# REPORTE AG4 — precarga con antelación (informe vivo)

## Cambios
- dd297d4 sim.probWays(b, node): caminos del nodo ordenados por la utilidad de goWay con el ruido en su media; no consume la RNG (prueba nueva en sim.test.js: dos simulaciones idénticas, una llamando a probWays, terminan iguales). La elección real NO se adelanta: depende de energía, puntos y compañeras hasta el instante de goWay y de la RNG; se usan pesos.
- 438191a Paths: precarga en anchura (todos los candidatos hasta montables) y luego en profundidad (completos, del más probable al menos); presupuesto adaptativo (sobrante del cuadro descontando la precarga del anterior, suelo 3 ms, techo 8 ms en pista y 12 ms en planeta, tope 400 ms/s); MAX_ACTIVE_VIDA_PRE 3 → 4 (los 4 caminos que salen del planeta montados ocultos).

## Cifras
### Tanda 1 (rama 438191a, escritorio, 00:38-00:45)
- antelacion 180 s: 1 sola entrada (la sonda seguía a una ballita que viajó 160 s): way 18 montado 5.8 s antes de entrar, NO listo. caminos completos al final: 6.
- Coste de precarga acumulado de 6+ caminos (ms): estructuras 13199, paisaje 8779, decor 5430, kart 3552, pista 1036, prisma 682, eventos 211, anillos 79, uniones 38, modelos 18, criaturas 16 → ≈ 33 s ≈ 5.5 s de CPU por camino; dominan estructuras (≈ 2.2 s/camino) y paisaje (≈ 1.5 s/camino). Peor porción: estructuras 40 ms (no troceable sin tocar la colocación: placeSegArchesAndProps de un tirón), pista 22.8, anillos 16.5, prisma 14.5.
- recorrido 3×60 s: fps 62, p1 35.1, >100 ms 1/min, max_post 99 ms, pops_min 191.3, popEventos_min 38.7, errores 0. Pops por causa: oculto 345 (60 %), nuevo 117, vacio 112. Por fase de la seguida: travel 357, toPort 196, at 15, toDest 6. Top: malla sin nombre MeshBasic 217.
  La sonda ampliada cuenta igual que la anterior (solo añade causa y camino); aun así se compara con main en la misma tanda.

### Tanda 2 (rama 7e81ef7: tramos por delante dibujados, 00:46-00:53)
- antelacion 180 s, estrategia «frío» (cambia de ballita tras cada entrada): 4 entradas, todas entre 20 y 27 s tras cargar (arranque en frío): montadas 2.4 / 1.6 / 7.2 / 1.0 s antes de entrar, ninguna «listo» (0 caminos completos a los 8 s, 7 al final). Presupuesto: 3458 cuadros con trabajo urgente, 6.9 ms concedidos de media, 25 s usados; después de ~30 s la cola urgente queda vacía (los candidatos ya completos) y solo sigue el fondo.
- recorrido 3×60 s: fps 53 (tanda 1: 62), p1 32.2, >100 ms 1/min, max_post 75 ms, pops_min 172, popEventos_min 41.3, errores 0.
  Pops por causa: vacio:suyo 186 (InstancedMesh del camino seguido que pasa de 0 a n instancias por el recorte por distancia de cada pieza: farolas, banderines, decoración y modelos del kit), oculto:otro 122 (LOD de visibilidad de OTROS caminos), oculto:suyo 112 (capas del camino seguido que se revelan), nuevo:otro 46, nuevo:suyo 17, oculto sin camino 31 (ballitas/planeta), vacio:otro 2. Por fase: travel 455, toPort 61.
  → Lo que el usuario ve como pop NO viene sobre todo de «camino recién montado» (nuevo: 63 = 12 %) sino del recorte por distancia por pieza dentro del camino (36 %) y de los LOD de visibilidad (45 %).
- La bajada de FPS se atribuyó a dibujar los tramos por delante (más instancias y cintas); 3c6b071 los deja solo calculándose.

## M4 (descarga)
- Montados con vida a la vez: como mucho MAX_ACTIVE_VIDA_PRE = 4 queridos (en el planeta: los 4 caminos que salen; en viaje: el actual + los 3 más probables del nodo siguiente) + los retirados ocultos durante DESCARGA_S = 6 s (se desmonta uno por evaluación de 0.12 s). Por qué 4: cada planeta tiene 4 puertos de salida (sim.test.js: «4 puertos»), así el elegido ya está montado aunque la predicción falle.

### Tanda 3: main frente a rama 3c6b071, escritorio, en la misma tanda (01:04-01:22)
| métrica | main 97c26a7 | rama 3c6b071 |
|---|---|---|
| entrada.mjs ×3, peor cuadro (ms) | 67 / 62 / 50 | 53 / 52 / 77 |
| recorrido fps / p1 | 59.6 / 30.9 | 47.8 / 26.7 |
| cuadros > 100 ms por min | 0.7 | 1.3 |
| max_post (ms) | 90 | 103 |
| pops_min / popEventos_min | 156.7 / 42.3 | 222.7 / 51.3 |
| pops por causa | oculto 256, vacio 186, nuevo 28 | oculto:otro 297, vacio:suyo 168, oculto:suyo 96, vacio:otro 28, nuevo 46, oculto sin camino 33 |
| antelacion estable 170 s | 2 entradas, 0 % (sin `listo` en main) | 1 entrada, 0 %: montado 5.3 s antes, no listo |
| errores de consola | 0 | 0 |
- VEREDICTO: la rama EMPEORA en escritorio (−20 % FPS, +42 % pops). Causa más probable: con MAX_ACTIVE_VIDA_PRE 4, cada camino montado se añade también a `nearDesired` (Paths.jsx, «for (const id of nextMounted) nearDesired.add(id)»), así que monta y revela su exterior cercano y su Ecosistema → «oculto:otro» pasa de ~122 a 297 y sube el coste de dibujo; además, el techo de 8 ms por cuadro en la pista. 1e8a81a vuelve a 3 y a 5 ms, SIN MEDIR (no quedó tiempo). NO INTEGRAR sin repetir esta tanda.
- M1 no se alcanzó: una camino completo cuesta ≈ 5.5 s de CPU (estructuras ≈ 2.2 s y paisaje ≈ 1.5 s); con unos 180-400 ms/s de presupuesto sin bajar los FPS, completar un camino lleva 15-30 s, y las entradas que se miden en 3 min caen casi todas en el arranque en frío (20-27 s tras cargar).
- No medidos por falta de tiempo: móvil, memoria 300 s y estable.mjs.
