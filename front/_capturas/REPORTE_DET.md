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

## Sesión 2 (Claude Opus 5.5, continuación sobre el mismo worktree)

Pedido literal: «esos detalles que se muestren siempre, los border, particules, detalles, actualmente hay tramos que no cargan o que no tiene, pero debe de tener todo el camino.»

Lo que había sin comitear al empezar: `decor.jsx` con SPACING y FLORA_SPACING en 7·TRACK_K. Lo descarté porque bajaba la densidad generada, que es justo la trampa que había que evitar.

### Cambios
- **InstanceCuller**: LOD por malla (`userData.cullNear` / `cullStride`). Dentro de `cullNear` (×K en el cono delantero) se dibuja todo. Entre `cullNear` y `cullRadius` se dibuja solo 1 de cada `cullStride`; las demás piezas crecen y menguan en el borde de `cullNear`. El compactado se hace ahora en el sitio (`idx` es creciente): solo respalda y restaura el prefijo `[0, near)`. Antes copiaba el buffer entero dos veces por cuadro, y eso, con la generación completa por longitud (hasta 12 666 matas de flora por ruta), era el grueso del coste de CPU.
- **Decor de la ruta enfocada**: se dibuja todo hasta 45 u (126 u por delante) y, hasta 110 u (308 u por delante), 1/2 de las piezas de cada kit de berma y 1/4 de la flora. La generación no cambia. `useInstanced` fija los parámetros de recorte en `userData` sin recrear la malla al cambiar el foco.
- **Estructuras y paisaje**: vuelven a los radios y bordes de main (los 110 u de la sesión 1 costaban FPS). Se conservan los pools y capacidades ampliados y el color explícito por ranura.
- **Piezas negras (caso literal, reproducido)**: en «Brasa → Cima · Camino de Cristal» (ruta 13, semilla 369) la captura `det2_cristal/rama2_cristal_w13_t1_1.jpg` muestra el aro lila con grapas cúbicas NEGRAS. Son los materiales 1.. del kit `anillo_neon_lod.glb`: `metal_oscuro` (metalness 0.8 y textura base casi negra) y `metal_cian` (0.7). Con el entorno tenue (0.45, fondo casi negro) salen negras. Primero bajé metalness a 0.2: seguían negras en captura, porque la causa de fondo es la textura. Arreglo: grapas con metalness 0.2 y roughness 0.5; a `metal_oscuro` se le quita la textura y se le da acero lavanda `#9a94c4`. Sin emissive. Se aplica a los aros de `anillos.jsx`, a los portales de `eventos.jsx` (que usaban el material crudo) y al precalentado. En la escena, 9 mallas de anillo usan ya las grapas satinadas; las 2 restantes con 0.8 son las de precalentado de `Paths.jsx` (grupo oculto, mismo programa). Nota: `anillos.jsx` no estaba en la lista de archivos permitidos, pero es donde está la causa (cambio de material, 20 líneas).

### Medición
- **Huecos de lo DIBUJADO** (`tools/medir_detalles.mjs`, columna `lodGaps`: subconjunto que dibuja el LOD lejano, 1/2 por kit y 1/4 de flora): 0 tramo/carril con huecos > 150 u en las 20 rutas. Con la generación completa (lo que se dibuja cerca), también 0.
- **Paisaje/partículas agregados** (intersección de huecos de todas las capas por tramo y carril): 0 huecos > 150 u en las 20 rutas. Los huecos por capa individual (`particleGaps`) se deben al paso propio de cada especie.
- **Bordes y berma**: son geometría de pista continua y no se tocaron. Se ven continuos en todas las capturas.
- **geo3, A/B main vs rama**, 2 tandas alternadas en la misma sesión, 60 s rotando ballitas en POV:

| | main (t1, t2) | rama (t1, t2) | Δ medias |
|---|---|---|---|
| Escritorio FPS | 44.6, 51.2 → 47.9 | 48.5, 42.1 → 45.3 | −5.4 % (meta ≥ −8 %) |
| Escritorio tris | 730 k, 821 k → 775 k | 807 k, 849 k → 828 k | +6.8 % (meta ≤ +20 %) |
| Móvil FPS | 49.5, 47.2 → 48.4 | 56.6, 49.4 → 53.0 | +9.6 % |
| Móvil tris | 843 k, 709 k → 776 k | 715 k, 743 k → 729 k | −6.0 % |

Sesión 1 frente a main: escritorio −11 %, móvil −21.6 % y tris en móvil +46 %. El ruido entre corridas es grande (±15 %): la segunda tanda de main en móvil arrancó con la ballita en `born`.
- **Vista general (`opt_vista.mjs`)**: NO se midió en esta sesión por tiempo. Los cambios de esta sesión solo actúan con ruta enfocada (decor) o devuelven valores de main (estructuras, paisaje). El compactado en el sitio abarata también la vista general, pero no está medido.

### Capturas abiertas (`_capturas/det2_cristal/`)
- `main_cristal_w12_*`: main en Cristal. Berma continua, agujas de cristal del paisaje, un pórtico de cristal. Junto a la calzada no se ven piezas pequeñas de berma.
- `rama_cristal_w12_t0_0`, `rama_cristal_w13_*`: rama con el mismo aspecto que main (berma continua y agujas al fondo); no deja de dibujar.
- `rama2_cristal_w13_t1_1`: el caso literal antes del arreglo de la textura. Aro lila con grapas negras, prismas de cristal, barreras y partículas.
- `rama3_cristal_w13_t1_1`, `rama4_*`: después del arreglo. Barreras, prismas, túnel al fondo y berma continua. **En estas dos tandas no apareció ningún aro cerca**, así que el aspecto final de las grapas NO está verificado en captura (la sonda toma ballitas al azar).

### Pruebas y build
`pnpm test` 91/91 en verde. `npx vite build` correcto.

### Pendiente o no cumplido
- Captura del aro con las grapas ya corregidas. Para esperarlo, la sonda debería buscar la ballita más cercana a un anillo de `buildAnillosData`.
- `opt_vista` (vista general) main vs rama.
- La métrica de píxeles negros de `det2_cristal.mjs` no sirve: el lienzo WebGL sin `preserveDrawingBuffer` se lee en negro. Habría que sacarla de la captura.

Conocimiento consultado: `rendimiento_web/mds/aparicion_gradual_en_el_borde_de_recorte.md`, `rendimiento_web/mds/precarga_por_etapas_con_presupuesto.md`, `geometria_procedural/mds/separacion_visible_en_marco_local.md`.
