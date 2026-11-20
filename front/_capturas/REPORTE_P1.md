# REPORTE P1 — Servidor de sim, WebSocket e infraestructura del mundo compartido

Fecha: 2026-11-19. Rama `cambio/20261119-215912-p1-servidor`. Sin push, sin merge y sin despliegue.

Conocimiento consultado: ninguno aplica (pendiente); sección 8 de docs/mundo_compartido.md

## Qué cambió

| Archivo | Cambio |
|---|---|
| `front/src/Core/sim.js` | Sección 4 del diseño dentro de `Sim`: `fila`, `formar`, `salirFila`, `tomar`, `dejar`, `decidir`, `origenSiguiente`, `predecir`, `prevision`, `restringir`; `spawn` toma la primera de la fila antes de generar el nombre; `goWay`, `pickNext`, `enterSeg`, `flightStep`, `arrive` y `watch` aplican decisiones, inactividad y fin del control. Exporta `DRAIN_E`, `DRAIN_P`, `TRAVEL_E_LEN`, `PPS_K`, `TUBE_SPEED_K`, `MAX_SIN_DECIDIR`, `MAX_FILA`, `MAX_NOMBRE`, `GRACIA_DESCONEXION`, `MAX_CONTROL_POR_ESPECTADOR`, `MAX_FILA_POR_ESPECTADOR`, `limpiarNombre`. Ganchos nuevos: `entra`, `libre`, `decide`. Nuevo `sim.rngDialogos` (azar cosmético separado de la `rng` de la sim) |
| `front/src/Core/sim.test.js` | 2 pruebas nuevas (fila y entrada al morir otra; validaciones, decisiones cumplidas, un solo uso, 3 llegadas sin decidir) |
| `front/src/Core/protocolo.js` + `protocolo.test.js` | Constantes, `rapida`/`leerRapida` (tupla de 26), `lenta`, `difLenta`/`aplicarLenta`, `instantanea`, `filaPublica`, `validar` (forma de los mensajes del cliente). 3 pruebas |
| `back/mundo/servidor.mjs` | Servidor autoritativo: sim a 30 Hz, `d` + `i` cada 3 ticks, bienvenida, límites (512 B, 5 mensajes/s, cierre 1008), plazo de `hola`, gracia por desconexión, registro del mundo y las ballitas en el back, `/salud` |
| `back/mundo/servidor.bundle.mjs` | Generado (692 KB): lo que corre el contenedor |
| `back/mundo/empaquetar.mjs`, `cliente_prueba.mjs`, `medir.mjs`, `huella.mjs`, `README.md` | Empaquetado, cliente de consola, medidas y huella |
| `back/apis/mundo_ws.py`, `back/apis/urls.py` | Relevo WebSocket hacia `ws://127.0.0.1:8379` |
| `back/requirements.txt` | `websockets==17.4` (sin él, uvicorn 0.38 no acepta WebSocket) |
| `back/supervisord.conf` | `[program:mundo]`: `node --watch /usr/src/app/mundo/servidor.bundle.mjs` |
| `back/dockerfile` | `COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node` |
| `migrate_view.py` | Al final genera `back/mundo/servidor.bundle.mjs` (no hace falta copiar nada: el paquete ya vive en `back/mundo`) |
| `front/package.json`, `front/pnpm-lock.yaml` | Dependencia `ws`; guiones `build:mundo` y `mundo`; `protocolo.test.js` en `pnpm test` |

## Cambios respecto al contrato (avisar a P2 y P3)

1. **La URL del WebSocket es `/api/ws`, no `/ws`.** `back/apis/urls.py` cuelga de `/api` y `back/urls.py` no estaba en
   mis archivos permitidos. Ventaja: el proxy de Vite ya reenvía `/api` (para WebSocket en `pnpm dev` hay que poner
   `ws: true` en `front/vite.config.js`, que tampoco es mío). Si se prefiere `/ws`: una línea en `back/urls.py`,
   `urls_router.include_router(mundo_ws_router)` con `from apis.mundo_ws import router as mundo_ws_router`.
2. **`d` lleva un campo opcional nuevo, `ev`**: `[{ k: 'entra', b: id, de: corto } | { k: 'libre', b: id, motivo }]`,
   con `motivo` = `dejar`, `inactivo`, `desconectado` o `muerte`. Sirve para `mundo.on('entra' | 'libre')`. Sin él no
   había forma de saber por qué se perdió el control. Quien no lo lea no se rompe.
3. **`age` y `score` viajan como enteros** en `Lenta` (así cambian como mucho una vez por segundo, que es lo que
   pedía el contrato). `thought.until`, `react.until` y `lastSwitch.until` van en segundos de sim con 2 decimales.
4. **`hola`, `ok`, `error` y `pong` devuelven `q`** cuando el mensaje lo traía. El error `ritmo` no lo trae (se
   responde antes de leer el mensaje). Errores nuevos de forma: `formato`, `tamano`, `version`, `hola`.
5. **Campos que solo viajan al nacer** (en `hola` y en `d.nace`, nunca en `d.b`): `name`, `gen`, `padres`, `arch`,
   `genome`, `bornAt`, `formadaPor`.
6. `decidir` con `destino: null` borra también la ruta (una ruta implica su planeta).
7. `tomar` una ballita que ya controlas responde `ya_controlas` (no `ocupada`).
8. La `auto` de cada ballita controlada se recalcula una vez por segundo y además al tomar y al decidir.
9. `dialogos.js` sigue usando `sim.rng` desde el render (no es archivo mío). En el servidor no hay render, así que
   no afecta. Queda listo `sim.rngDialogos` (por defecto `Math.random`): cambiar `sim.rng` por
   `sim.rngDialogos ?? sim.rng` en `dialogos.js` evita que el modo local con semilla pierda el determinismo.

## Pendiente de medir al cerrar (se completa abajo)
