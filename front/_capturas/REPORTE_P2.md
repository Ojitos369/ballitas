# Informe P2 — cliente del mundo compartido

## Cambios

- Se añadió `crearMundo()` con selección remota por WebSocket y respaldo local tras 5 s. `?local=1` fuerza el modo local; este modo omite el registro HTTP para que el preview aislado no produzca errores de red. La instancia local normal conserva `iniciarBack`.
- El adaptador local concentra el único `new Sim()` de `front/src`; si los métodos de control todavía no existen, responde `sin_soporte`.
- El remoto decodifica las tuplas rápidas de la sección 2.3, conserva referencias y vectores de ballitas, aplica cambios lentos, resuelve referencias al mundo y reconecta con esperas de 1, 2, 4, 8 y 15 s. La selección explícita `?local=1` y el fallback por falta de WebSocket quedan documentados en el código.
- La interpolación paramétrica usa `laneFrame`, longitud de carril para cruces de tramo y `switchPath` durante eventos. Los casos no interpolables usan respaldo lineal; los saltos de más de 30 u y los cambios de fase se saltan.
- La interfaz recibe el adaptador en lugar de construir `Sim`; oculta el control de velocidad en remoto y muestra el modo/conexión.

## Validación y métricas

| Comprobación | Resultado |
|---|---|
| Build de producción | `npx vite build`: pasa (19,4 s; bundle principal 2,16 MB sin minificar). |
| Preview local en puerto 4302 | Capturas de vista general y POV abiertas y revisadas; 10 ballitas visibles, la vista general y el POV en carretera se dibujan. Consola: 0 errores tras desactivar el registro HTTP en `?local=1`. |
| Pruebas nuevas P2 | 2/2 pasan: decodificación de la tupla rápida y respaldo al cruzar entre vuelo y pista. |
| `pnpm test` | 82/83 pasan. Única falla: `sim.test.js:446`, 3195 ms frente al límite de 3000 ms. Repetida aislada: 4264 ms; corresponde al umbral sensible a carga ya señalado en el encargo. |
| Error de interpolación P2 a 10 Hz | **No medido** con tramas grabadas del prototipo. Referencia del diseño: 0,016 u media / 0,188 u p99 sin respaldo; metas: ≤0,05 / ≤0,5 u. |
| Costo por cuadro y reconexión tras reinicio | **No medidos** en el navegador contra el servidor P1. El preview no expone `/ws`; por tanto no se afirma el objetivo <0,3 ms ni reconexión visible <3 s. |
| Remoto en navegador | **Pendiente** mientras P1 no esté conectado al endpoint `/ws` del preview. |

Capturas: [vista general](p2_local_general.jpg), [POV](p2_local_pov.jpg). Sonda: [p2_local.mjs](p2_local.mjs). Resultado de consola: [p2_local_resultado.json](p2_local_resultado.json).

Conocimiento consultado: ninguno aplica (módulos revisados: rendimiento_web, medicion_y_pruebas, ui_visual, grafica_3d). Nota propuesta en la sección 8 de `docs/mundo_compartido.md`.

## Commits

- `ecc6701` — adaptadores local/remoto e interfaz.
- `51de600` — reconexión, favorito remoto y fallback local.
- `4a43d02` — corrección de interpolación en transiciones.

Hash final antes del informe: `4a43d02`.
