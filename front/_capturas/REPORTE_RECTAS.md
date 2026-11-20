# REPORTE RECTAS — que ningún camino sea directo (salidas, llegadas, horquillas y rizos)

Conocimiento consultado: separacion_visible_en_marco_local (resumen del brief: separación medida en el marco local de la
cinta visible con su ancho real; gálibo por la normal, aire lateral; excluir solo lo fundido; torsión aparte; prueba
negativa. La nota del vault no se pudo abrir desde este worktree: lectura fuera del directorio denegada).

Base: `dd36440` (main, producción). Rama `cambio/20261119-191536-rectas`. Sin push, sin merge a main, sin deploy.

## Qué cambió (`front/src/Core/world.js`)
1. **`ondula(curve, kind)` — eje ondulado antes del reparto y de `buildBraid`.** En `shape()` las curvas de `salida`,
   `llegada`, `horquilla` y `rizo` se remuestrean (paso 12 u) y se desplazan por un tirabuzón suave en un marco de
   transporte paralelo: desvío lateral y en altura a la vez (`OND_L` = 160 u de paso, `OND_RC` = 120 u de radio de
   curvatura añadido, amplitud 5.4 u). Al ser un tirabuzón y no una senoide, la curvatura es casi constante: no deja
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
| Tramos con > 15 % en recta | 910/2 360 (38.6 %) | **212/2 360 (9.0 %)** | ≤ 10 % | sí |
| … salida / llegada / horquilla / rizo (rectos) | 34 de 39, 21 de 21, 15 de 17 (semilla 369) | **6/200, 9/200, 1/210, 0/170** | — | sí |
| `ways:libre` + `rutas:libre` | 0 | **0 en 10/10** | 0 | sí |
| `ruta:libre` gálibo / lateral | 0 / 0 | **0 / 0** | — | sí |
| `tramo:libre` gálibo | 0 | **0** | 0 | sí |
| `tramo:libre` lateral (10 semillas) | 907 (mín 5.9 u) | **3 362 (mín 2.7 u)** | (prueba: semilla 369 ≤ 150, ≥ 5) | 369: 132 / 5.9, pasa; **regresión en otras semillas** |
| Intentos de reparto (suma de 10 semillas) | 13 | **13** (mismos por semilla) | — | sí |
| Quiebro máx. en tramo abierto sinuoso (369) | 17.6° | **19.0°** (0 ≥ 25°) | < 25° | sí |
| Torsión en puntas (normal máx., `torsion.mjs`) | — | PENDIENTE_TORSION | < 45° | PENDIENTE |
| Cuñas (`cunas.mjs`) | 0 | PENDIENTE_CUNAS | 0 | PENDIENTE |
| Generación (misma tanda) | PENDIENTE_GEN | PENDIENTE_GEN | ≤ 1.15 × | PENDIENTE |
| `pnpm test` | 82/82 | PENDIENTE_TEST | 82/82 | PENDIENTE |
| FPS (`geo3.mjs`, 2 tandas) | PENDIENTE_FPS | PENDIENTE_FPS | ≥ −5 % | PENDIENTE |

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
PENDIENTE_FPS_TABLA

## Cierre
PENDIENTE_CIERRE

Conocimiento consultado: separacion_visible_en_marco_local
