# PIEZA DET — detalles presentes a lo largo del camino

## Línea base medida y resultado

Sonda determinista semilla 369: 20 rutas, 352 tramos (352 contados; incluye los segmentos fuera de calzada), 491 523 u de calzada no aérea, 236 segmentos de más de 150 u. Longitud por ruta: 13 220–38 785 u.

| Elemento | Antes | Después / estado | Causa y alcance |
|---|---|---|---|
| Decoración | Topes globales de 150 piezas y 200 plantas por ruta: entre 27 y 70 combinaciones tramo/carril tenían huecos >150 u | 0 combinaciones tramo/carril con huecos >150 u en las 20 rutas | El muestreo determinista queda proporcional a la longitud, paso ~4·TRACK_K. |
| Bordes/berma | Generación por segmento con STEP=1.5·TRACK_K; la inspección estructural confirma que siguen el firme, pero la sonda no extrajo su perfil visual como puntos por cada 100 u | Sin cambios al perfil; no cuantificado como instancias por cada 100 u | Son geometría de pista, no decoración. Su visibilidad depende de montaje/culler cercano. |
| Partículas/paisaje | Buffer por capa con capacidades de 30–160; el cap podía agotarse al sumar segmentos activos | Capacidad de cada capa aumentada según paso y ventana de 560 u. Sonda agrega por capa, por eso aún detecta capas individuales con separaciones >150 u en 7 rutas; no significa que falte todo paisaje en esos intervalos | El paso de cada especie/capa es intencionalmente distinto. No se verificó cobertura agregada visual continua para cada ruta; meta de 100% no demostrada. |
| Colocación de estructuras | Anillos: 373/6585 quitados (5.7%); arcos: 16/39126; pórticos y arcos kart: 0 | Prueba de colocación existente sigue priorizando mover/encoger antes de quitar; se amplió el pool (anillos 384, arcos 96) | Los anillos quitados no tienen aún conteo final por distancia/carril en el informe. |

La sonda nueva `front/tools/medir_detalles.mjs` registra por ruta, segmento y carril puntos de decoración y paisaje, calcula huecos mayores de 150 u y guarda `front/_capturas/det/medicion.json`. La decoración fue cero huecos después de quitar los caps globales. En línea base su distribución uniforme por `capStride` dejaba muchos huecos: los topes no priorizaban sistemáticamente los primeros tramos, repartían candidatos y reducían demasiado su densidad.

## Cambios

- Decoración y flora se generan con densidad por longitud, sin límite global por ruta; paso determinista de ~19 u escalado con `TRACK_K`.
- Se eliminaron los caps globales de bordillos/barreras. Colocación mantiene intento de mover y estrechar antes de descartar.
- Se ampliaron pools de estructuras y buffers de capas de paisaje en función del paso y la ventana activa.
- En cada ranura de pool de pórticos/anillos se escribe explícitamente color de instancia (blanco si no trae tinte) para evitar heredar color de una pieza anterior. No se fuerza emissive.
- Culler acepta radio/frontera por malla. En la ruta enfocada, decoración/estructuras/paisaje usan radio 110 con frontera 0.98, que revela por completo antes de ~300 u; capas cercanas activan decoración hasta 310 u. El resto conserva sus parámetros globales.

## Validación

- `pnpm test`: 91/91 pasó. `elecciones precalculadas`: 2182 ms, límite 3000 ms intacto.
- `npx vite build`: pasó; Vite avisó que el chunk principal supera 500 kB.
- Capturas finales geo3 abiertas y juzgadas: `desk_espiral_w2_a.jpg` muestra berma continua, arcos verdes encendidos y vegetación; `movil_espiral_w3_a.jpg` muestra bordes, carriles de partículas y detalles próximos completos, sin piezas sólidas negras visibles. Las 6 capturas de cada viewport incluyen espiral/embudo/salida; la selección aleatoria no pasó por Camino de Cristal ni garantiza 3 rutas con estructuras, así que el caso literal del pórtico rosa y cero negros en 3 rutas queda parcialmente sin validar.
- Geo3, medias de dos tandas, main vs rama: escritorio 66.65 vs 59.3 FPS (−11.0%), móvil 75.6 vs 59.3 FPS (−21.6%); tris de muestreo escritorio 820k vs 799k (−2.5%), móvil 691k vs 1.011M (+46.2%). Las rutas/estados de simulación no se emparejaron y la variación fue grande, pero ambas medias de FPS incumplen el límite de −8% POV y móvil supera +20% tris. `opt_vista.mjs` en una sesión, 2 tandas alternadas en rama escritorio: 118.33 vs 119.15 FPS on/off (−0.7%), tris +0.5%, CPU render −7.3%; general desk cumple −3%, pero no se corrió comparación main/rama ni móvil.
- No se ejecutó merge a main según las reglas comunes de este worktree. Validación de borde/berma por cada 100 u, cobertura agregada continua de partículas, FPS dentro del presupuesto POV, y cero negros específicamente en 3 rutas con estructuras quedan pendientes/no demostrados.

Conocimiento consultado: `rendimiento_web/mds/aparicion_gradual_en_el_borde_de_recorte.md`, `rendimiento_web/mds/precarga_por_etapas_con_presupuesto.md`, `geometria_procedural/mds/separacion_visible_en_marco_local.md`.
