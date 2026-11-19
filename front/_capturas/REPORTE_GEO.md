# REPORTE_GEO — pendientes de separación de caminos (2026-11-19)

**Resultado: cuñas resueltas y medidas (13 015 → 0 en la semilla 369, 0 en 369-371); torsión en puntas de salida/llegada de 47-72° a < 5°; cinta diezmada en recta. NO se cumplen: `ways:union` ≤ 3 252, `tramo:libre` gálibo 0 y lateral ≤ 500, `ruta:libre` gálibo 0, torsión en puntas de espiral/embudo (sigue ~100° / ~80°).** Sin push ni deploy.

## Qué cambió
1. **Cuñas (paso 1)** — `world.js` (`bermaIndice`, `bermaAdd`, `bermaLibre`, `bermaLibres`, `bermaPerfil`), `vida/pista.jsx`.
   - Causa: la berma (terreno) y el bordillo de cada cinta van 0.02-0.06 u **por encima** del firme. Donde la fila va fundida o a medio abrir, la berma de un carril quedaba sobre la calzada del vecino (las cuñas azules de `sep7/desk_helice1_sacacorchos_w4_pov.jpg`; el azul es el efecto de cáusticas del tema mar sobre el terreno).
   - Arreglo: `pista.jsx` hace dos pasadas por camino. La primera guarda el marco de cada muestra de cada carril y lo registra en un índice espacial; la segunda emite la malla preguntando, por muestra y por lado, cuánto sitio hay hasta el bordillo de la cinta más cercana de otro carril que vaya a su misma altura (desnivel < 1.5 u). La berma toma **la mitad del hueco** (las dos bermas vecinas se encuentran en medio: no quedan huecos negros); si las calzadas se solapan, el bordillo y el borde del firme se hunden bajo el firme vecino. Se toma el mínimo con las dos muestras vecinas porque la apertura empieza entre dos muestras.
   - No se usó `prismaLibreGlobal` del ejemplo: es una consulta por esfera contra todo el mundo; el índice propio reutiliza los marcos que la pista ya calcula (sin `laneFrame` extra) y da el hueco exacto, no solo sí/no.
2. **Medida nueva** `tools/cunas.mjs` (`node tools/cunas.mjs [n] [semilla] [sin]`): reproduce el muestreo y el perfil de la pista y comprueba, con una prueba independiente del recorte (punto dentro de ±`CALZADA_HALF` de una muestra de `clearanceSamples`, entre 0.005 y 0.5 u sobre su firme), 3 puntos de berma por lado y muestra. `sin` apaga el recorte (`BERMA.off`) para el «antes».
3. **Torsión en puntas (paso 4, parcial)** — `RELAX_PIN` de 4·TK a 12·TK. Medido: en salida/llegada el quiebre de la punta lo ponía la relajación (con `NO_RELAX` baja a 1.5°): las cintas empujadas volvían a su punta anclada en solo 19 u.
4. **Triángulos (paso 5, parcial)** — `pista.jsx` diezma la cinta en recta: salta hasta 2 muestras (paso máximo 21 u) si tangente y normal giran < 1.5°, la berma va entera y las muestras saltadas quedan a < 0.08 u de la cuerda (badenes y relieve no se aplanan). No se tocó `decor.jsx`: sus topes (`MAX_DECO_TOTAL` 150, `MAX_FLORA_TOTAL` 200) ya son por tramo y no crecen con `ANCHO_K`.
5. Prueba nueva en `layout.test.js`: «cuñas: ninguna berma sobre el firme de otra cinta (semilla 369)» (0 con recorte y > 1 000 sin él, para que la medida no pueda pasar en vacío).

## Mediciones
Cuñas (`tools/cunas.mjs`, puntos de berma sobre el firme de otra cinta a < 0.5 u):
| Semilla | Antes (sin recorte) | Después |
|---|---|---|
| 369 | 13 015 (12 824 mismo tramo, 191 otro tramo del camino, 0 de otro camino) | **0** |
| 370 | — | **0** |

Torsión en puntas (`tools/torsion.mjs 3 369`, normal / tangente, grados entre muestras):
| Clase | Antes | Después |
|---|---|---|
| salida:punta | 47.0 / 71.8 (10 semillas) | **1.3 / 0.8** |
| llegada:punta | 42.7 / 60.1 | **3.4 / 4.9** |
| salida (interior) | 128.1 / 107.5 | 61.5 / 60.0 |
| llegada (interior) | 66.5 / 99.7 | 59.4 / 69.7 |
| espiral:punta | 100.5 / 101.2 | 100.5 / 101.2 (**sin cambio**) |
| embudo:punta | 79.8 / 82.6 | 79.8 / 82.6 (**sin cambio**) |
| sacacorchos:punta | 57.1 / 58.6 | 35.0 / 36.3 (3 semillas) |

Meta < 45° en puntas: cumplida en salida, llegada, sacacorchos, horquilla, rizo y tramos de pista; **no** en espiral ni embudo. Lo descartado: alargar el enlace Bézier de las puntas (`lead` × 1.52 y × 2.2 con 22 % de la cuerda) no baja la espiral (118° / 130°): el quiebre está en la última muestra del carril (u 0.99 → 1.00), no en el eje; no se llegó a la causa.

Separación (`node tools/separacion.mjs 10 369`, gálibo / lateral):
| Clase | Inicio (16a8379) | Final |
|---|---|---|
| ways:libre, rutas:libre | 0 pares | **0 pares** |
| ruta:libre | 26 / 111 | 25 / 108 |
| tramo:libre | 144 / 2 125 | 90 / 2 214 |
| ways:union | 4 376 / 2 615 | 4 389 / 2 617 |
| rutas:union | 1 027 / 463 | 1 160 / 463 |
| ruta:union | 889 / 146 | 892 / 148 |
| tramo:union | 540 / 6 660 | 429 / 6 646 |

Triángulos de la cinta, todo el mundo (`node tools/diezmo.mjs 1 369`): 6 252 720 → 3 942 792 (**−36.9 %**).

## Pruebas y build
- `pnpm test`: **81 de 81** (80 anteriores + la de cuñas), con todo el cambio incluido. Una pasada anterior (solo recorte, equipo cargado con dos medidores en paralelo) falló el tope de 3 000 ms de `sim.test.js:446` con 3 276 ms; en la pasada final pasó.
- `npx vite build` correcto. `git merge main`: «Already up to date» (main no avanzó), así que no hizo falta repetir pruebas.

## Navegador (build de producción, puerto 4301, Edge, `_capturas/geo.mjs`, semilla 369)
30 s en POV siguiendo la ballita 1 (mismo método que `sep7.mjs`); main = 16a8379 compilado en el scratchpad. Tanda 1: rama primero; tanda 2: main primero (orden invertido a propósito).
| | FPS | Triángulos | Heap (MB) | Tramos |
|---|---|---|---|---|
| Escritorio, tanda 1, rama | 41.4 | 565 mil | 346 | salida, embudo (w13) |
| Escritorio, tanda 1, main | 53.4 | 834 mil | 433 | salida, horquilla, pantano (w4) |
| Escritorio, tanda 2, main | 58.8 | 715 mil | 423 | salida, caída, géiser (w10) |
| Escritorio, tanda 2, rama | 58.3 | 559 mil | 386 | salida (w3) |
| Móvil, tanda 1, rama | 46.4 | 689 mil | 408 | salida, cañón, portal, caída, espiral (w12) |
| Móvil, tanda 1, main | 55.7 | 765 mil | 470 | salida, caída, portal, cañón, trampolín (w2) |
| Móvil, tanda 2, main | 54.9 | 642 mil | 461 | salida, rampa, pantano (w16) |
| Móvil, tanda 2, rama | 61.7 | 753 mil | 446 | salida, cañón, portal (w15) |

- **FPS: meta ≥ −5 % NO demostrada.** Tanda 1 (rama primero): −22 % escritorio, −17 % móvil. Tanda 2 (rama después): −1 % y +12 %. Medias: escritorio 49.9 / 56.1 (−11 %), móvil 54.1 / 55.3 (−2 %). El que corre primero sale peor en la tanda 1 y había otras piezas trabajando en el equipo; además la ballita 1 toma un camino distinto en cada carga. No distingo «la rama es más lenta al arrancar» de «carga del equipo». Sospecha sin medir: la consulta de vecinos del recorte alarga la precarga de pistas en los huecos libres del primer minuto (`bermaLibres` no se reparte entre cuadros).
- **Triángulos:** rama 641 mil de media / main de hoy 739 mil (**−13 %**); frente al main anterior de la sesión 7 (687 mil): **−7 %** (meta ≤ +10 %: cumplida en estas tandas, con rutas distintas). **Heap:** 396 / 447 MB (−11 %); frente al main anterior (396 MB): igual.
- Consola: sin `pageerror` en las 8 corridas.
- Candado: mi sonda heredó de `sep7.mjs` un tope de 40 esperas (20 min); al agotarse tomó el candado aunque seguía reciente (13:53). Comprobé que en ese momento el único navegador de sonda abierto era el mío. Las dos tandas cerraron su navegador y su preview y borraron el candado.

Capturas en `front/_capturas/geo/` (rama; 16 tomadas, abiertas 4):
- `desk_apertura2_espiral_w18_a.jpg`: espiral con los 5 carriles en paralelo, cada uno con sus bordillos y la berma verde repartida entre vecinos; ninguna cuña sobre el firme. Las vueltas lejanas se ven poligonales (paso de 7 u, igual que antes).
- `desk_apertura2_espiral_w18_b.jpg`: calzada única limpia, bordillos continuos, decoración en la berma exterior.
- `movil_apertura3_rizo_w12_a.jpg`: rizo con los 5 carriles subiendo en paralelo, separados y sin terreno sobre el firme.
- `movil_apertura1_pantano_w2_a.jpg`: calzada limpia con bordillos; sin cuñas.
- No abiertas: las otras 12 (6 son de tramos aéreos —caída, erupción, trampolín— que no tienen fila). La meta «4 aperturas en escritorio y 4 en móvil» queda en **1 de escritorio y 2 de móvil vistas**; no se repitió el Camino del Mar de la captura original.

## No cumplido
- **Paso 2 (`ways:union` ≤ 3 252): no investigado.** Sigue en 4 389.
- **Paso 3 (`tramo:libre` gálibo 0 y lateral ≤ 500; `ruta:libre` gálibo 0): no abordado.** Las hélices de radio pequeño siguen igual.
- **Paso 4:** espiral y embudo siguen en ~100° / ~80° en la punta.
- La nota de conocimiento no se pudo leer: permiso denegado fuera del worktree y `front/_capturas/conocimiento_separacion.md` no existe en este worktree.

Conocimiento consultado: separacion_visible_en_marco_local (NO leída en esta sesión: sin permiso de lectura y sin copia en el worktree).
