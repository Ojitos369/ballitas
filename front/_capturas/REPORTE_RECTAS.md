# REPORTE RECTAS — que ningún camino sea directo (salidas, llegadas, horquillas y rizos)

Conocimiento consultado: separacion_visible_en_marco_local (resumen del brief: separación medida en el marco local de la
cinta visible con su ancho real; gálibo por la normal, aire lateral; excluir solo lo fundido; torsión aparte; prueba
negativa. La nota del vault no se pudo abrir desde este worktree: lectura fuera del directorio denegada).

Base: `dd36440` (main, producción). Rama `cambio/20261119-191536-rectas`. Sin push, sin merge a main, sin deploy.

## Qué cambió (`front/src/Core/world.js`)
1. **`ondula(curve, kind)` — eje ondulado antes del reparto y de `buildBraid`.** En `shape()` las curvas de `salida`,
   `llegada`, `horquilla` y `rizo` se remuestrean (paso 12 u) y se desplazan por un tirabuzón suave en un marco de
   transporte paralelo: desvío lateral y en altura a la vez (`OND_L` = 160 u de paso, `OND_RC` = 120 u de radio de
   curvatura añadido, amplitud 5.4 u en horquillas y rizos; en salidas y llegadas el radio es ×1.6, `OND_PUERTO`, amplitud 3.4 u). Al ser un tirabuzón y no una senoide, la curvatura es casi constante: no deja
   puntos de inflexión rectos. Peso:
   - 0 en las puntas de unión (rampa de 40 u: posición y rumbo intactos) y en la parrilla/meta (`GRID_LEN`/`FINISH_LEN` + 2·TK);
   - 0 donde el eje ya gira (radio < ~150 u), así no se pliega ni estrecha el círculo del rizo ni la vuelta de la horquilla;
   - en salidas y llegadas solo en la zona de puerto y la rampa de apertura (hasta `a0 + 0.35·rw`): el tramo abierto ya lo
     retuerce `sinuarCaminos`, cuyo desvío se limita por el radio del eje (ondular ahí le quitaría separación).
   - paso ligado a la longitud de la zona (`clamp(Z / 1.5, 110, 160)`); zonas de menos de 150 u no se ondulan (pliegues).
   Como va en `shape()`, la búsqueda de huecos valida ya la curva ondulada y la fila se construye sobre ella.
   Interruptores de diagnóstico: `NO_ONDULA=1`, `OND_L`, `OND_RC`.
2. **Fila paralela tendida por la lateral peraltada** (`buildBraid`, rama sin fila fundida): antes los carriles se colocaban
   por la lateral SIN peralte aunque su superficie sí lo llevaba; con el eje ondulado (peralte continuo) quedaban
   escalonados: `tramo:libre` lateral 1 351 en la semilla 369 (falló `layout.test.js:71`). Con la lateral peraltada: 132.
   Diagnóstico: `NO_ROW_BANK=1`.
3. Descartado: paso 220 u (amplitud 10.2 u). Daba 8.7 % de rectas pero el reparto necesitaba 18 intentos en 10 semillas
   (main: 13) y la generación subía. Con 160 u los intentos son idénticos a los de main semilla por semilla.
4. Herramientas: `tools/rectas10.mjs` (rectas en N semillas, por tipo, con intentos y tiempo) y `_capturas/rectas_cap.mjs`
   (POV de zona de puerto, horquilla y rizo).

## Métricas (10 semillas, 369-378)
| Métrica | main (dd36440) | Rama | Meta | ¿Cumple? |
|---|---|---|---|---|
| Tramos con > 15 % en recta | 910/2 360 (38.6 %) | RECTAS_FINAL | ≤ 10 % | RECTAS_OK |
| … salida / llegada / horquilla / rizo (rectos) | 34 de 39, 21 de 21, 15 de 17 (semilla 369) | **6/200, 9/200, 1/210, 0/170** | — | sí |
| `ways:libre` + `rutas:libre` | 0 | **0 en 10/10** | 0 | sí |
| `ruta:libre` gálibo / lateral | 0 / 0 | **0 / 0** | — | sí |
| `tramo:libre` gálibo | 0 | **0** | 0 | sí |
| `tramo:libre` lateral (10 semillas) | 907 (mín 5.9 u) | **3 362 (mín 2.7 u)** | (prueba: semilla 369 ≤ 150, ≥ 5) | 369: 132 / 5.9, pasa; **regresión en otras semillas** |
| Intentos de reparto (suma de 10 semillas) | 13 | **13** (mismos por semilla) | — | sí |
| Quiebro máx. en tramo abierto sinuoso (369) | 17.6° | **19.0°** (0 ≥ 25°) | < 25° | sí |
| Torsión en puntas (normal máx., `torsion.mjs`, 10 semillas) | 35.1° (horquilla) | **34.1°** (espiral; horquilla 33.6°, rizo 31.6°, salida 14.6°, llegada 4.2°) | < 45° | sí |
| Cuñas (`cunas.mjs`, semillas 369-371) | 0 | **0** | 0 | sí |
| Generación (misma tanda) | GEN_MAIN | GEN_RAMA | ≤ 1.15 × | GEN_OK |
| `pnpm test` | 82/82 | **79/82 en la última corrida completa** (ver abajo) | 82/82 | **no** |
| FPS escritorio / móvil (`geo3.mjs`, 2 tandas) | 31.2 / 31.85 | **29.55 / 36.55** (−5.3 % / +14.8 %) | ≥ −5 % | escritorio **no** por 0.3 puntos (dentro del ruido); móvil sí |

Lo que queda en recta tras el cambio (212): rampa 87/190, embudo 32/260, pantano 21/200, turbina 16/180, sacacorchos
15/140, hielo 11/120, espiral 10/440 (tipos que esta pieza no ondula).

## Qué NO se cumplió
- **`tramo:libre` lateral sube de 907 a 3 362 muestras en 10 semillas (mínimo 5.9 → 2.7 u).** Gálibo sigue en 0 y la
  prueba (semilla 369) pasa, pero en otras semillas hay más muestras de aire lateral corto entre hermanos. El peor caso
  está en la rampa de apertura de las llegadas (`llegada @0.89-0.90`, carriles 1 y 4): la fila se abre mientras el eje
  hace el tirabuzón. Siguiente paso: abrir la fila con el peralte ya estabilizado (limitar el giro del peralte dentro de
  `[NODE_OPEN, a0]`) o bajar ahí la amplitud a ~3 u y medir con `tools/diag_clase.mjs <semilla> tramo:libre lateral`.
- **Rampas (87/190 con > 15 % en recta)**: no estaban en el pedido de esta pieza; son el grueso de lo que queda.
- Captura POV de horquilla en móvil: ninguna ballita pasó por una horquilla en los 100 s de espera de la segunda sonda
  (sí la hay de la primera: `rectas/movil_horquilla_w19_horquilla_a.jpg`).

## Navegador (build de producción, `vite preview` 4301, Edge con GPU, semilla 369)
Sonda `_capturas/rectas_cap.mjs`; dos corridas (`_capturas/rectas/` y `_capturas/rectas2/`). Abrí las que cito:
- `rectas2/desk_puerto_w10_llegada_b.jpg` (POV, llegada a 0.86, zona de puerto): la calzada baja haciendo una S (primero a
  la izquierda, luego a la derecha) por dentro de los arcos de meta del tema volcán; bordillos continuos, sin escalones
  entre carriles. Antes este trozo era una recta de ~450 u.
- `rectas2/movil_puerto_w2_llegada_b.jpg` (412×915, llegada a 0.87): la cinta serpentea en S cuesta arriba hacia los
  arcos, con los bordillos rojos siguiendo la curva; terreno y árboles a los lados sin cortes.
- `rectas2/desk_horquilla_w12_horquilla_b.jpg` (horquilla a 0.53): calzada curvándose a la izquierda con el horizonte
  ladeado; al fondo la cinta sigue ondulando; cristales y arcos bien asentados sobre el firme.
- `rectas/movil_horquilla_w19_horquilla_a.jpg` (412×915, horquilla a 0.38): curva a la derecha con peralte; arcos y
  estructuras sobre el terreno, sin huecos.
- `rectas/desk_rizo_w5_rizo_b.jpg` (rizo a 0.84, salida del círculo): la calzada no sale recta, se tuerce hacia los aros;
  el rizo y otras cintas se ven arriba a la derecha.
- **Tomas no válidas (no las cuento):** `rectas/desk_puerto_w2_salida_a.jpg` y `rectas/movil_puerto_w19_salida_a.jpg`
  salieron en vista lejana o con el cielo vacío (la cámara aún no había entrado en POV: en la primera versión de la sonda
  la tecla de POV se pulsaba demasiado pronto); igual `rectas/desk_rizo_w5_rizo_a.jpg` y `rectas/movil_rizo_w12_rizo_a.jpg`
  (cámara en tránsito hacia la ballita). Corregido en la segunda corrida.
- Consola: sin `pageerror`; dos «500 (Internal Server Error)» de recursos del backend que el preview local no sirve
  (igual que en main).

## FPS (`_capturas/geo3.mjs`, A/B contra main en la misma sesión, 2 tandas)
| | Rama t1 | Main t1 | Rama t2 | Main t2 | Media rama | Media main | Diferencia |
|---|---|---|---|---|---|---|---|
| FPS escritorio (1400×900) | 32.1 | 28.6 | 27.0 | 33.8 | 29.55 | 31.2 | −5.3 % |
| FPS móvil (412×915) | 36.4 | 28.1 | 36.7 | 35.6 | 36.55 | 31.85 | +14.8 % |
| Triángulos escritorio | 826 573 | 625 842 | 788 819 | 789 314 | 807 696 | 707 578 | +14.2 % |
| Triángulos móvil | 818 504 | 579 555 | 682 258 | 695 938 | 750 381 | 637 747 | +17.7 % |

**Medición poco fiable:** corrió a la vez que mis baterías de Node (pruebas y `separacion.mjs`), por eso los FPS absolutos son
la mitad de los de la sesión anterior (~53 / ~61) y main varía de 28.6 a 33.8 entre tandas (±9 %). Las diferencias
(−5.3 % y +14.8 %, de signo opuesto) están dentro de ese ruido: no demuestran ni regresión ni mejora. El `dist` medido es
el del commit `960b8f8` (antes de bajar la amplitud en puertos). Sin errores de página en las 8 corridas. Hay que repetir
el A/B con el equipo libre antes de integrar. Resultados en `_capturas/rectas_fps/resumen.json`.

## Cierre
- **`pnpm test`: NO está en verde.** Última corrida completa (commit `960b8f8`, con navegador y baterías en paralelo): 79/82.
  1. `envolvente visual separada por dos calzadas (semilla 2)`: llegadas vecinas a 9.47 u, faltaban 0.30 u. **Corregido**
     en `0494d00` (amplitud 3.4 u en salidas y llegadas); esa prueba y las demás de «envolvente visual» pasan (9 de 10 del filtro).
  2. `separación visible (semilla 1)`: `tramo:libre` lateral **153 con tope 150** (mínimo 6.07 u, sobre el tope de 5).
     **Sigue en rojo.** Con `NO_ONDULA=1` pasa; con `NO_ROW_BANK=1` sigue en 153: lo causa la ondulación, no el cambio de
     la fila. No baja al reducir la amplitud en puertos (×2.4 → 161), así que viene de horquillas/rizos o de la rampa de
     apertura. Es la misma regresión de aire lateral descrita arriba.
  3. `elecciones precalculadas` (`sim.test.js:446`, tope 3 000 ms): 3 077 y 4 068 ms, las dos veces con el equipo cargado
     (navegador y baterías a la vez). **No la pude repetir con el equipo libre**: pendiente de confirmar que no es del cambio.
- **Generación ≤ 1.15 ×: sin medir en la misma tanda** (no hubo equipo libre). Indicio: con paso 160 u el reparto usa los
  mismos intentos que main en las 10 semillas, y en una tanda con la misma carga dio 13.14 s frente a 12.26 s (1.07 ×).
- `git merge main`: main sigue en `dd36440`, la base de la rama (nada que mezclar).
- `npx vite build`: correcto (en `960b8f8`). Navegador y `vite preview` cerrados, candado borrado, puerto 4301 libre.
- **No integrable todavía.** Por orden: (1) bajar el aire lateral entre hermanos en las rampas de apertura sobre eje
  ondulado hasta pasar la semilla 1; (2) repetir `pnpm test`, FPS y generación con el equipo libre; (3) rampas.
- Hash final: `0494d00`.

Conocimiento consultado: separacion_visible_en_marco_local
