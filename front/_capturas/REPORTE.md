# REPORTE — caminos con espacio (2.ª continuación)

Estado al iniciar: commits 371316d, 04bc9d2, 435abdd (medidor nuevo), dae565f (wip generación, sin verificar).

## Bitácora
- (inicio) Leyendo el wip dae565f y midiendo una semilla.
- wip dae565f medido: semilla 1 gen 37282 ms, attempt 2, 2 fallos -> revertido. Plan: filtrar estructuras (anillos/arcos/pórticos/kit) que invaden el prisma de cintas ajenas en la colocación (world.colision.prisma).
- ANTES (medidor nuevo sobre generación vieja 435abdd, semilla 1, máquina cargada ~3x): galibo 71086 pares (altura libre mín 12.6 u), lateral 4647 (aire mín 3.2 u), union 101877 (solape no coplanar hasta 117.5 u de la punta), estructuras 6246/25847 piezas (penetración máx 26.4 u, arco_neon w17). gen 20550 ms (en máquina cargada).
- Paso (a): colocacion.js descarta anillos, arcos (haz y carril), arcos de parrilla/meta, costillas de túnel y pórticos cuya esfera invade el prisma (calzada x GALIBO_H) de otra cinta: world.prismaLibre (caché de clearanceSamples por mundo). Propio = su carril; arco de haz = todo el tramo; pórtico = todo su camino (exención declarada).
- Línea PEOR antes (3 semillas, gen vieja): ESPACIO semillas con fallo: galibo 3/3 (altura libre mín 11.7u, meta 28.2) | lateral 3/3 (aire mín 3.2u, meta 11.7) | union 3/3 (hasta 117.5u) | estructuras 3/3 (pen máx 26.4u; ~6300/25800 piezas). gen medio 13478 ms (máquina cargada).
