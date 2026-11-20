# PIEZA DET — cobertura de detalles en el camino

## Estado y línea base

Semilla 369: 20 rutas, 352 tramos totales (incluye tramos aéreos), 491 523 u de calzada no aérea y 236 tramos no aéreos de más de 150 u. Por ruta hay 13 220–38 785 u y entre 9–14 tramos largos.

| Cobertura | Línea base inspeccionada | Causa observada |
|---|---|---|
| Bordes/berma | El perfil de pista y sus bandas se generan a lo largo de cada segmento no aéreo; STEP=1.5·TRACK_K. No hay datos separados de «piece count» por cada 100 u. | El montaje visual está sujeto a LOD/capa cercana y a generación progresiva de las mallas de pista. |
| Partículas | La generación de paisaje utiliza capacidades por capa de 30–160 instancias en pantalla. | El buffer fijo se llena en los primeros tramos activos y puede dejar sin cupo los tramos siguientes. |
| Decoración | `decor.jsx` acumula los candidatos de toda la ruta y al final los limita a 150 piezas, y la flora a 200. | Tope global por ruta; no densidad por longitud. Los primeros candidatos consumen el cupo de tramos posteriores. |
| Bordillos/barreras | `colocacion.js` acumula candidatos de todos los tramos y limita a 40 pianos y 32 barreras. | Tope global por ruta. La colocación también rechaza cuando `colocar()` no encuentra sitio. |
| Estructuras | Pool de modelo de 128 y 48 arcos. | Saturación del buffer cercano; puede descartar geometría aunque el tramo esté en caché. |

La línea base no contiene un conteo visual por cada bloque de 100 u: los caches de colocación son privados y no publican el origen por tramo ni la razón de descarte. Los totales geométricos y los topes anteriores sí son reproducibles; atribuir cada hueco individual a colocación, recorte o LOD necesita sonda en navegador. No se reportan como medición exacta los huecos que aún no medí.

## Conocimiento consultado

Conocimiento consultado: `rendimiento_web/mds/aparicion_gradual_en_el_borde_de_recorte.md`, `rendimiento_web/mds/precarga_por_etapas_con_presupuesto.md`, `geometria_procedural/mds/separacion_visible_en_marco_local.md`.

## Cambios en curso

- Eliminé los topes globales de decoración y flora por ruta.
- Eliminé topes globales para bordillos y barreras; la colocación aún reintenta espacio con `colocar()`.
- Aumenté la capacidad del paisaje según longitud de visibilidad y la de pools/arcos de estructuras.

Pendiente: pruebas, revisión visual, benchmark A/B con `geo3.mjs` y `opt_vista.mjs`, y validación específica de piezas negras.
