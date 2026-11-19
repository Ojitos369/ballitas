# REPORTE CAR: vista delantera de los caminos y eventos solo del carril

Conocimiento consultado: rendimiento_web/aparicion_gradual_en_el_borde_de_recorte.md, rendimiento_web/revelado_urgente_frente_a_calentado_de_fondo.md, medicion_y_pruebas (catálogo; comparación A/B en la misma sesión, evidencia de lo dibujado, sondas con candado). No apliqué precarga_por_etapas_con_presupuesto: la precarga de los datos no cambió.

## Qué cambió
1. **Alcance delantero (cono)**, en `InstanceCuller.jsx` (`kDelante`, `d2Delante`). Con una ballita seguida (Seguir o POV, `FOCO.b`), la distancia de recorte se divide por K en el rumbo de la cámara: K completo hasta ±14°, que baja a 1 en el borde del cono (±37°). Detrás y a los lados no cambia. K = 2.8. Se aplica en:
   - el culler global (decoración y flora; recompacta también si la cámara gira más de 10°),
   - `estructuras.jsx` (piezas y arcos, también en la vista general: el camino siguiente se ve al fondo de la recta),
   - `paisaje.jsx` (capas).
   Los tramos activos incluyen también los que quedan alrededor de un punto adelantado en el rumbo. Lo que entra solo gracias al alcance delantero se coloca al final, así que si se llena el tope de la malla se descarta lo lejano y nunca lo cercano.
   Interruptor en caliente: `window.__aparece.delante = 1` deja el comportamiento de antes.
   - Primer intento: una elipse K·R × R. A ±25° solo alargaba el alcance 1.5×, así que la cambié por el cono.
2. **Eventos solo del carril** (`eventos.jsx`). Con ballita seguida en viaje, se dibujan solo las piezas del kit, iconos, agujeros, chevrones, marcas, haces, anillos de origen y de aterrizaje, puntos de trayectoria, remolinos y estelas de su `way` + `lane` + `carril`. Durante un vuelo se dibuja solo el evento del vuelo. En otros caminos (way) no se dibuja ninguno.
   - No se monta ni se desmonta nada: cada malla reserva sitio para todas sus piezas y solo se reescriben las visibles (`InstancedSel`). Al pasar de 0 a más de 0 piezas, el InstanceCuller la revela de forma gradual.
   - Sin ballita seguida, o fuera de viaje, se comporta como antes. Las divisorias de carril, las cajas de tramo y las placas turbo no son de un evento y se mantienen.
   - Interruptor (con `?stats=1`): `window.__eventosCarril.off`.
3. **«Afectar»** (`sim.js`): ya era correcto. `checkSwitches` filtra por `sw.from === b.lane && sw.carril === b.carril`, y al aterrizar el carril se sortea antes del siguiente paso. Añadí una prueba en `sim.test.js` («sólo le afecta un evento de su carril y camino, también justo después de aterrizar en otro camino») y no hubo que corregir nada.
4. **Medición** (solo con `?stats=1`): `userData.__crece` / `__creceC` es la distancia real de la pieza más cercana que aún crece en el cono delantero (±25° / ±12°). La sonda es `ab_carril.mjs` (A/B alternando tramos de 5 s en la misma sesión, en POV).

## Métricas (A = antes, B = nuevo; misma sesión, POV, build de producción, 60 s)
| Métrica | Escritorio 1280×720 A | B | Móvil 412×915 A | B |
|---|---|---|---|---|
| Pieza creciendo más cercana, centro ±12° (mediana, u) | 49.0 | 141.5 (**2.89×**) | 54.7 | 146.8 (**2.68×**) |
| Ídem, cono ±25° (u) | 46.5 | 129.6 (2.79×) | 53.9 | 143.2 (2.66×) |
| Muestras con una pieza creciendo a < 40 u delante | 1 % | 0 % | 0 % | 0 % |
| FPS medio | 52.97 | 53.68 (+1.4 %) | 66.15 | 62.68 (−5.2 %) |
| FPS p5 | 34.22 | 33.08 (−3.3 %) | 37.40 | 37.38 (0 %) |
| Peor cuadro medio por tramo (ms) | 46.3 | 47.5 | 38.1 | 41.8 |
| Triángulos | 826 k | 777 k (−6 %) | 703 k | 744 k (+5.7 %) |
| Instancias de eventos dibujadas | 4294 | **180 (−95.8 %)** | 3682 | **178 (−95.2 %)** |

Las metas de coste (FPS ≥ −8 %, p5 ≥ −10 %) se cumplen en las dos vistas. Con K = 2.5, en la corrida anterior de escritorio, el resultado fue 2.26× en el centro con −2.7 % de FPS: por eso subí a 2.8.

Capturas: `car_cap/escritorio_A0.jpg` y `car_cap/escritorio_B0.jpg` (sobre la pista; las abrí: la arboleda está completa hasta el fondo de la recta y en B no aparecen las marcas de eventos de otros caminos). En `car/*.jpg` hay capturas tomadas durante vuelos (cámara en el aire), que no sirven para comparar.

## Qué no se cumplió o queda abierto
- **Pico de cuadro al cambiar de carril:** no lo medí aislado. El peor cuadro por tramo es parecido en A y B (46 frente a 47 ms en escritorio), pero hay tramos sueltos de 67–80 ms en ambos modos. Ya no se monta nada al cambiar, solo se reescriben unas decenas de matrices.
- **«Ninguna pieza crece en el tercio inferior»:** lo medí por cono angular y distancia, no por píxeles de pantalla. Las piezas que siguen creciendo dentro del cono están a 110–150 u.
- Solo se recorrieron 1–2 caminos por corrida (la sonda sigue a una ballita): 15/17 y 10/16, en tres corridas. No llegué a 3 rutas en una misma corrida.
- `pnpm test`: 76 de 77 pasan. Falla «elecciones precalculadas» por el tope de 3000 ms: la versión base de la prueba también falla ahora (3.5–3.7 s) con el equipo cargado por otras piezas (14 procesos de Edge), mientras que antes había pasado en 2.6 s.
