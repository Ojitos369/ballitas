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

## No cumplido
- **Paso 2 (`ways:union` ≤ 3 252): no investigado.** Sigue en 4 389.
- **Paso 3 (`tramo:libre` gálibo 0 y lateral ≤ 500; `ruta:libre` gálibo 0): no abordado.** Las hélices de radio pequeño siguen igual.
- **Paso 4:** espiral y embudo siguen en ~100° / ~80° en la punta.
- La nota de conocimiento no se pudo leer: permiso denegado fuera del worktree y `front/_capturas/conocimiento_separacion.md` no existe en este worktree.

Conocimiento consultado: separacion_visible_en_marco_local (NO leída en esta sesión: sin permiso de lectura y sin copia en el worktree).
