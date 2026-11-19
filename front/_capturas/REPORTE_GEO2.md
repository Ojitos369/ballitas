# REPORTE GEO2 — cruces en puerto, torsión y coste

Rama `cambio/20261119-142256-geo2-cruces-torsion`. Pedido: «Siguen encimandose algunos caminos, todos por regla deben
tener separaciones y buena distancia...».

Conocimiento consultado: separacion_visible_en_marco_local.

## Qué cambió en esta continuación

1. **Causa del coste localizada (paso 1).** Se midió la rama apagando cada cambio con su interruptor de entorno
   (`HELI_RMIN=0`, `NO_LINK_FIX`, `NO_PORT_X`, `NO_FIX_PTS`), 10 semillas (369-378):

   | Variante | Generación media | Cinta del mundo (triángulos diezmados, semillas 369-378) |
   |---|---|---|
   | main | 6.39 s | 3.92 M de media |
   | rama (7d6ae4b) | 8.67 s (1.36 ×) | 3.93 M de media (+0.2 %) |
   | rama sin radio mínimo de hélice | 8.54 s | igual (±0.1 % por semilla, medido en 369-376) |
   | rama sin empalme de hélices | 8.44 s | no medido (la medición se cortó) |
   | rama **sin regla de cruces en puerto** | **6.64 s** | no medido |
   | rama sin salida/llegada como obstáculo | 8.62 s | no medido |

   - La sospecha del radio mínimo de hélice **no se confirma**: `heliR` ya quita vueltas en la proporción en que crece el
     radio, la cinta mide lo mismo y los triángulos del mundo no cambian (±0.3 % frente a main).
   - El tiempo extra es de la **regla de cruces en puerto**: los candidatos con cruce quedan con holgura mínima, la
     búsqueda recorre más candidatos y cada uno se construía con su búsqueda de fila de rutas.
   - La diferencia de triángulos y FPS «en POV» de la sonda `geo.mjs` no era del cambio: seguía UNA ballita 30 s y lo
     que veía dependía de la ruta que le tocara. En los datos del orquestador la misma build dio 831 mil y 1 141 mil
     triángulos en dos tandas, y la ballita pasó por tramos distintos en cada corrida (sacacorchos>pantano, canon>portal,
     solo salida...).

2. **Poda exacta del cruce en puerto** (`world.js`, `tryCand` + `portCrossWay`, commit 1fc123d). La salida y la llegada
   no dependen de la fila de rutas, así que el cruce se mide en el candidato grueso con el muestreo fino de esos dos
   tramos; si cruza y el mejor candidato ya iguala `PORT_X_SCORE`, no se construye el camino fino. El mundo sale
   **idéntico** (misma huella de elecciones y largo en las 10 semillas con y sin poda: `tools/huella.mjs`,
   `NO_PORT_PODA=1`). En la semilla 369 ahorra 189 construcciones finas.

3. **Sonda `_capturas/geo3.mjs`**: mismo A/B que `geo.mjs`, pero rota por las ballitas en viaje (una cada 3 s, 60 s,
   21 cambios) y da además triángulos y FPS por tipo de tramo.

No se tocó la geometría: radio mínimo de hélice (60 u), empalme y obstáculos quedan como estaban.

## Métricas antes / después

| Métrica | main | rama antes (7d6ae4b) | rama ahora | Meta | ¿Cumple? |
|---|---|---|---|---|---|
| Generación media, 10 semillas, equipo libre | 6.21 s | 8.67 s (1.36 ×) | 7.94 s (**1.28 ×**) | ≤ 1.3 × | Sí (justo) |
| FPS escritorio, POV rotando ballitas, 2 tandas | 50.7 (51.9 / 49.4) | — | 51.0 (52.3 / 49.7) (+0.6 %) | ≥ −5 % | Sí |
| FPS móvil, ídem | 56.2 (55.9 / 56.5) | — | 60.3 (64.0 / 56.6) (+7 %) | ≥ −5 % | Sí |
| Triángulos en pantalla, escritorio | 851 mil (863 / 840) | — | 918 mil (944 / 893) (**+7.9 %**) | ≤ +5 % | **No** (ver nota) |
| Triángulos en pantalla, móvil | 728 mil (698 / 758) | — | 734 mil (731 / 737) (+0.9 %) | ≤ +5 % | Sí |
| Triángulos de cinta del mundo (diezmo, 10 semillas) | 3.92 M | 3.93 M | 3.93 M (+0.2 %) | — | — |
| ruta:libre gálibo / lateral | 25 / 108 | 0 / 0 | **0 / 0** | 0 | Sí |
| tramo:libre gálibo / lateral | 90 / 2 214 | 0 / 906 | **0 / 906** | gálibo 0 | Sí |
| ways:union gálibo | 4 389 | 2 910 | **2 910** | ≤ 3 252 | Sí |
| rutas:union gálibo | 1 160 | 812 | **812** | — | — |
| Mundos fallidos / pares en falta fuera de uniones | — | 0 / 0 | 0/10 / 0/10 | 0 | Sí |
| Pruebas | — | 82/82 | **82/82** | verde | Sí |

Nota sobre los triángulos en escritorio (+7.9 %): no hay geometría de más (el mundo tiene los mismos triángulos de
cinta y la misma longitud); lo que cae en pantalla depende de por dónde pasan las ballitas durante el minuto medido, y
el mundo de la rama es otro (WORLD_GEN 10). El ruido es del mismo orden: dos tandas de la misma build difieren un 5 %
y por tipo de tramo se va de 443 mil a 1 304 mil. En el tramo más muestreado (salida) la rama da 1 017 mil frente a
1 026 mil de main en escritorio, y 733 mil frente a 802 mil en móvil. Con esta sonda no puedo afirmar que sea ≤ +5 %,
así que queda como **no cumplido / no concluyente**; los FPS, que son el efecto que importa, no bajan.

Los tiempos con el equipo cargado (otros delegados) salen ruidosos: en una corrida intermedia la poda no se distinguía
(10.91 s con poda, 10.67 s sin ella, main 8.45 s = 1.29 ×). La cifra de la tabla es la de la corrida final con el equipo
libre; el tiempo de CPU del proceso (`tools/tiempos_cpu.mjs`) da una razón peor, 10.38 s frente a 7.39 s (1.40 ×).

## Torsión (paso 3, `node tools/torsion.mjs 10`)

Ángulo máximo de la normal entre muestras consecutivas en las puntas (15 u):

| Tramo | Normal máx. en punta | Tangente máx. en punta | Meta < 45° |
|---|---|---|---|
| espiral | 33.7° (s369 w11) | 9.4° | Sí |
| embudo | 33.2° (s374 w14) | 8.6° | Sí |
| sacacorchos | 32.2° (s371 w4) | 9.3° | Sí |
| rizo | 29.8° | 3.5° | Sí |
| horquilla | 33.2° | 3.6° | Sí |

Fuera de las puntas quedan por encima de 45°, y fuera del alcance de esta pieza: salida 54.3° de normal y 60.7° de
tangente (s374 w5, s377 w7, al 2-4 % del tramo, junto al planeta), llegada 46.1° / 70.2° (s370 w15, al 98 %) y un
quiebro de tangente de 53.4° en el cuerpo de un embudo (s375 w15).

## Capturas (`_capturas/geo3/`, rama, POV)

- `desk_espiral_w18_a/b.jpg`, `movil_espiral_w16_a/b.jpg`: espiral con una sola calzada limpia, sin cintas encimadas.
- `desk_embudo_w16_a/b.jpg`, `movil_embudo_w2_a/b.jpg`: en móvil se ve la calzada del embudo limpia; la de escritorio
  (`_b`) quedó mirando a la decoración del tema neón y no sirve para juzgar la calzada.
- `desk_salida_w3_a/b.jpg`, `movil_salida_w16_a/b.jpg`: salida junto al nodo (no las abrí).
- Sin errores de página en las 8 corridas. Navegador y `vite preview` cerrados; candado borrado.

## Qué no se cumplió

- Triángulos en pantalla en escritorio: +7.9 % medido (meta ≤ +5 %), dentro del ruido de la sonda y sin geometría de más.
- La generación cumple por poco (1.28 ×) y solo medida con el equipo libre. Para bajarla más habría que medir el cruce
  en puerto antes de construir el candidato grueso (hoy la regla hace recorrer más candidatos); no se hizo.
- No se aplicaron las opciones de geometría del brief (radio menor con calzada fundida, más diezmado en hélices, tope de
  decoración): la medición muestra que el radio no era la causa.

## Herramientas nuevas

- `tools/huella.mjs`: huella del mundo por semilla (comprueba que un cambio de rendimiento no altera el mundo).
- `tools/tiempos_cpu.mjs`: tiempo de CPU de `buildWorld` por semilla.
- `tools/diag_poda.mjs`: motivos de rechazo de candidatos (cuenta la poda).
- `_capturas/geo3.mjs`: sonda A/B rotando ballitas.
