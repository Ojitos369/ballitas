# REPORTE MEM: retención de memoria en el cliente

Rama `cambio/20261120-072937-mem-retencion` (base main 2bb9668). Preview en el puerto 4307, Edge con `--expose-gc` y gc forzado antes de cada lectura.

## Diagnóstico
- **La sim no crece (paso 1a).** Solo la `Sim` en Node, 86 400 ticks (48 min simulados, lo mismo que 6 min a 8×) y gc forzado: el montón pasa de 57,7 a 59,7 MB. `nombres` (70), `pool` (24) y `feed` (8) están acotados. El crecimiento está en el render.
- **Instantáneas (paso 2)** a los 10 s y 70 s (167 → 288 MB): crecen `Qt` (Quaternion), `W` (Vector3), objetos `{up, surface, road, tangent, side, pos, …}`, arreglos `pos/quat/scale` y 58 MB de `JSArrayBufferData` (atributos de geometría). La ruta de retención es siempre `WeakMap (llave: way o seg) → valor de caché → flora / barreras / bordillos / arches / ribbonGeo / layers / laneDashes`.
- **Mundo fijo:** 21 objetos camino, 353 tramos y 1 mundo en ambas instantáneas (`mem_formas.mjs`). No se crean mundos ni caminos nuevos.
- **Causa:** la precarga de fondo (`vida/precarga.js`) calcula la vida (pista, decoración, anillos, eventos, criaturas, kart, estructuras y paisaje por tramo) de **todo** el mundo y la guarda en WeakMaps cuyas llaves (los caminos) nunca mueren. Las tres fuentes principales son:
  1. el paisaje por tramo (`segCache`: `layers`, `libre`, `local`, agua);
  2. las estructuras por tramo (`segDataCache`: `ribbonGeo`, `arches`, `byModel`);
  3. la colocación y la flora o barreras por camino (`segStructPlacementCache`, `decorCache`, `dataCache`) y la geometría de pista (`geoCache`).
- **No es fuga:** `CLR_CACHE` del mundo (`grid`, unos 41 MB) se mantiene estable entre instantáneas.
- **Paso 1b (modo remoto en el navegador): no se hizo** por tiempo. La causa está en la precarga del cliente, que corre igual en modo remoto.

## Cambios (cada uno con su porqué)
- `vida/etapas.js`: se añaden `registrarOlvido`, `tocarVida`, `caminosConVida`, `olvidarVida` y `liberarGeos`. Es un registro central para olvidar la vida de un camino; además libera la GPU de las geometrías propias, sin tocar las marcadas `userData.shared` ni las de kit.
- `pista.jsx`, `colocacion.js`, `decor.jsx`, `eventos.jsx`, `criaturas.jsx`, `estructuras.jsx` y `paisaje.jsx`: cada uno registra cómo borrar sus cachés por camino y por tramo, incluidos los generadores a medias. Todo se recalcula igual porque usa generadores con semilla por camino.
- `precarga.js`: `precargaPaso` marca el camino como usado, así cuenta desde la primera porción.
- `Paths.jsx`:
  - `VIDA_CACHE_MAX = 6`. Cada evaluación (0,12 s) marca como recientes los caminos urgentes, montados, en retiro y cercanos, y el de la primera ballita. Si hay más de 6 caminos calculados, olvida el menos usado de los demás (uno por evaluación).
  - La precarga de fondo («resto del mundo» y ballitas distintas de la primera) solo corre si cabe en la caché; si no, se expulsaría en bucle.
  - Un camino olvidado que vuelve a hacer falta pasa por el flujo de siempre: cola urgente y luego montaje.

## Métricas (mem_sonda.mjs, 6 min a 8×, modo local, MB tras gc)
| | serie cada 30 s | min 3 → min 6 |
|---|---|---|
| main (orquestador) | 120,348,507,605,674,751,858,969,1112,1236,1315,1422,1464 | +353 |
| tope 8 (c576dc0) | 110,385,527,534,479,523,538,491,490,530,581,577,603 | +65 |
| **tope 6 (4836635)** | 110,365,453,443,451,460,418,455,499,441,476,480,476 | **+58 punto a punto; +20 media(3–4 min) → media(5–6 min)** |

La meseta queda entre 418 y 499 MB. Que sube y baja ±40 MB según qué caminos estén en caché.

## Validación
- `pnpm test`: 97/97 en verde. Hoy hay 97 pruebas, no 76; el tope de `sim.test.js` no se tocó.
- `vite build`: correcto.
- No se tocaron `sim.js`, `world.js`, `protocolo.js` ni el servidor, así que la huella de la sim y `build:mundo` no cambian.
- Capturas tras 150 s a 8×, con caminos ya expulsados (`mem_general.jpg`, `mem_pov.jpg`): están todos los caminos y no hay errores en la consola. La tecla 3 abrió la vista de seguimiento al 50 %, no un POV de cerca.
- Servidor de Node (`mem_servidor.mjs`, 30×, 10 clientes, `heapUsed` sin gc forzado): ver la sección «Servidor» abajo.

## No cumplido / pendiente
- Meta ≤ 50 MB entre el min 3 y el 6: punto a punto da +58 MB (el min 3 cayó en un valle); la tendencia media da +20 MB.
- Falta el modo remoto en el navegador (≤ 30 MB).
- Falta el A/B de FPS en POV con `geo3.mjs` (2 tandas) y las capturas a los 6 min. Riesgo a vigilar: al volver a un camino expulsado hay que recalcular su vida (cola urgente con presupuesto por cuadro), así que su detalle puede tardar más en aparecer que antes.
- Si se quiere bajar más la meseta: tope 4–5, o datos de colocación más compactos (hoy cada pieza guarda objetos con varios Vector3/Quaternion).

## Sondas (en _capturas)
- `mem_sonda.mjs`: serie de montón.
- `mem_snap.mjs`: instantáneas por CDP.
- `mem_resumen.mjs`: diferencia por constructor.
- `mem_tablas.mjs`: atribución por WeakMap.
- `mem_ruta.mjs`: rutas de retención.
- `mem_formas.mjs`: cuenta de caminos y mundos.
- `mem_servidor.mjs`: memoria del servidor.
- `mem_capturas.mjs`: capturas.

Conocimiento consultado: índice `Agents/conocimiento/catalogo.csv` (módulos medicion_y_pruebas, rendimiento_web, geometria_procedural, ui_visual, grafica_3d). Ninguna nota trata la retención de memoria ni la expulsión de cachés: queda como conocimiento pendiente («caché acotada con expulsión para precarga por etapas»).
