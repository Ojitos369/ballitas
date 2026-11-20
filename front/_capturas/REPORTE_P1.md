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

10. `d.nace` es un «alta o actualización»: quien conecta justo entre un nacimiento y el siguiente `d` recibe esa
    ballita en `hola.b` y otra vez en `d.nace`. El cliente debe tratarla por `id`, no añadirla dos veces.

## Metas y medidas

Equipo: Windows 11, Node 24.19. **El equipo estuvo cargado todo el tiempo por las otras piezas en paralelo
(30–46 % de CPU total, pruebas y `vite preview` de otros worktrees)**: los tiempos de este informe son peores que en
reposo. Lo que depende del tiempo debe repetirse con el equipo libre.

| Meta | Resultado | ¿Cumple? |
|---|---|---|
| `pnpm test` completo en verde | 87 pruebas (76 + 6 que ya había en otros archivos + 5 nuevas): **86 pasan, 1 falla**: `sim.test.js:446`, la del tope de 3000 ms, con 3056, 3703 y 3103 ms en tres intentos. No toqué el tope ni `world.js` (`git diff` vacío). `buildWorld(369)` con elecciones, medido aparte en ese momento: 3437, 3254 y 3144 ms (el diseño midió 2,7 s en reposo) | **No en esta máquina cargada**; repetir en reposo |
| Huella idéntica sin entradas (semilla 369, 18 000 ticks) | Antes de mis cambios `adeb1c63fc36c666`, después `adeb1c63fc36c666` (`node back/mundo/huella.mjs`; la huella incluye `feed` y `plan.razon`, y excluye fila y control, que antes no existían). Repetida al final con el mismo resultado | Sí |
| Tick p99 < 1 ms | Sin red, 17 400 ticks con fila y decisiones (`medir.mjs`): media 0,154 · p50 0,138 · **p99 0,428** · máx 9,97 ms. En el servidor vivo con 50 clientes y el equipo cargado: media 0,48 · **p99 1,43** · máx 382 ms | Sí sin red; **no en vivo con el equipo cargado** |
| Instantánea ≤ 1 800 B (10 ballitas) | media 1 644 B, máx 1 718 B, 732 B con deflate | Sí |
| Bienvenida ≤ 20 KB comprimida | JSON 41,4 KB de media (máx 42,2 KB); deflate máx 16,6 KB (17,3 KB con nivel 3, el que usa `ws`) | Sí |
| 50 clientes a 10 Hz con < 10 % de un núcleo | **5,94 % de un núcleo** en 10 min (sin compresión, como conecta el relevo); cada cliente recibió 9,98 Hz y 17,3 KB/s. Con `permessage-deflate` en los 50 (clientes directos) fue bastante más: ~14 % acumulado en una corrida parcial que corté a los 4 min, sin medida limpia | Sí por el camino de producción |
| Memoria estable 10 min | RSS entre 133 y 232 MB (190,9 al empezar, 140,4 al acabar); montículo en diente de sierra entre 64 y 112 MB. Sin crecimiento. Referencia del diseño: ≤ 488 MB | Sí |
| Arranque < 4 s con elecciones guardadas | 3 484, 3 863 y 4 822 ms en Windows; 5 561 ms dentro del contenedor (Docker Desktop, carpeta montada). En frío (sin elecciones): 17,5 s | **A medias**: 2 de 3 en local; no en el contenedor de prueba |
| El WebSocket responde `hola` a través de uvicorn | Sí, en 92 ms con uvicorn + Node directos y en 44 ms dentro del contenedor | Sí |

Otras medidas:

- Difusión a 50 clientes (un `d` más un `i`): media 4,6 ms, p99 17 ms por tanda. Es lo que más CPU gasta.
- **Relevo de FastAPI con 50 clientes: 17,9 % de un núcleo de Python** (ventana de 46 s, incluye las 50 conexiones),
  62 MB. Alcanza para decenas de espectadores, como preveía el diseño; es el primer cuello de botella si crecen.
- Registro en el back: el servidor creó el mundo (`POST /api/mundos`, con `compartido`, `epoca` y `rng` en `params`) y
  las ballitas. No envía `skin` (el generador vive en `Components/World3D`, fuera de mi alcance); el campo es opcional.
- `vite build`: correcto (15,6 s).

## Cliente de consola (`back/mundo/cliente_prueba.mjs`)

- `basico` por el relevo (`ws://127.0.0.1:8478/api/ws`): **41/41**. Cubre `hola`, 10 Hz, `ping`, errores `hola`,
  `formato`, `tamano`, `version`, `ritmo` y cierre 1008, formar y fila visible para todos, tomar (`no_existe`,
  `ocupada`, `ya_controlas`), decidir (`destino`, `ruta`, `carril`, la ruta fija el planeta, `null` borra), dejar, y
  que quien solo miraba toma la que quedó libre.
- `completo` (servidor propio a 30x): **21/21**. Decisión consumida al salir, llegó al planeta decidido, salió por el
  carril decidido, recorrió una sola ruta; **pierde el control tras 3 rutas sin decidir** (motivo `inactivo`, 246 y
  348 s de sim en dos corridas); **la primera de la fila entra al morir otra**, controlada por quien la formó, la
  segunda en la siguiente muerte, y con la fila vacía nace como siempre; reconectar dentro del plazo conserva el
  control; pasado el plazo queda libre (`desconectado`); la formada de un dueño ausente nace sin controlador.

## Infraestructura probada en local

- **uvicorn directo + Node directo** (venv en `back/.venv`, puertos 8478 y 8479): relevo, registro y pruebas de arriba.
- **Docker**: `docker compose up` no se usó tal cual (el `docker-compose.yml` exige `.env` y fija el nombre
  `ballitas-py` y el puerto 8378). Construí la imagen con el `dockerfile` nuevo y la corrí con otro nombre y puerto
  (`ballitas-p1-prueba`, 127.0.0.1:8477) montando `back/` y con `/usr/bin/supervisord`: `node -v` = v22.23.5,
  `mundo` y `runserver` en RUNNING, `hola` 10/10 y `basico` 41/41 por el relevo. Contenedor e imagen de prueba
  eliminados al terminar.
- No desplegué ni toqué producción ni el túnel.

## Para el orquestador al desplegar

1. Reconstruir la imagen una vez (`dockerfile` y `requirements.txt` cambiaron).
2. `back/mundo/servidor.bundle.mjs` está comiteado; regenerarlo tras integrar P2 y P3 si tocan `sim.js`, `world.js`
   o `protocolo.js` (`cd front && pnpm build:mundo`, o `python migrate_view.py`).
3. El servidor escribe `back/data/picks_10_369.json` en el primer arranque (carpeta ya ignorada por git).
4. Decidir la URL (`/api/ws` o `/ws`, punto 1 de los cambios) y avisar a P2.
5. `front/pnpm-lock.yaml` cambió por la dependencia `ws` (no estaba en mi lista, pero es inseparable de `package.json`).

## Qué no se cumplió

- `pnpm test`: 86 de 87; falla solo el tope de 3000 ms, con el equipo cargado.
- Tick p99 < 1 ms en el servidor vivo (1,43 ms con el equipo cargado; 0,43 ms sin red).
- Arranque < 4 s: 3,5–4,8 s en local y 5,6 s en el contenedor de prueba.
- La carga con compresión no quedó medida de forma limpia.
- No hay limpieza del origen (`Origin`) en el relevo ni tope de conexiones por IP: hoy solo hay un tope global
  (300 en el relevo, 500 en Node).