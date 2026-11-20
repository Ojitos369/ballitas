# Mundo compartido con control de ballitas — arquitectura y contrato

Fecha: 2026-11-19. Pieza de DISEÑO. No cambia producción: solo este documento y el prototipo
`front/tools/mundo_compartido_proto.mjs` (cifras crudas en `docs/mundo_compartido_medidas.json`).

Reproducir las medidas: `cd front && node tools/mundo_compartido_proto.mjs 369 10` (Node 24.19, Windows 11, ~2 min).

## 0. Resumen

- **Arquitectura: servidor autoritativo (A)**. Un proceso Node corre `sim.js` tal cual, a 30 ticks/s, y emite por
  WebSocket una instantánea a 10 Hz que los clientes interpolan **sobre la pista** (coordenadas paramétricas), no en
  línea recta. El lockstep (B) se descarta: lo impiden espectadores tardíos, el determinismo entre navegadores y el
  propio código de la interfaz.
- **Costo medido**: 0,126 ms por tick (0,38 % de un núcleo a 30 Hz); instantánea de 10 ballitas = 1 640 B en JSON,
  731 B comprimida; 16 KB/s por espectador sin comprimir, 7,1 KB/s comprimido.
- **Despliegue**: proceso Node en el mismo contenedor (supervisord), FastAPI reenvía `/ws`; el túnel y el puerto 8378
  no cambian.
- **Control**: fila FIFO común; la formada nace con el genoma del algoritmo genético de hoy; las decisiones restringen
  el mismo optimizador automático (lo que no se elige lo sigue eligiendo la sim). Demostrado en el prototipo: 5 de 5
  viajes cumplieron planeta, ruta y carril; quien no decide pierde el control exactamente a las 3 llegadas.
- **Tres piezas en paralelo** con archivos disjuntos (sección 5).

## 1. Arquitectura

### 1.1 Lo que se midió

| Medida | Valor | Cómo |
|---|---|---|
| `buildWorld(369)` en frío | 8,5–10,1 s (3 corridas) | búsqueda de huecos incluida |
| `buildWorld(369)` con elecciones (`setWorldPicks`) | 2,7 s | las elecciones pesan 1 560 B en JSON (322 B comprimidas) |
| Tick de la sim (10 ballitas, dt = 1/30, con fila y decisiones) | media 0,126 ms · p50 0,118 · p99 0,270 · máx 43,7 ms | 17 400 ticks; el máximo es un pico aislado (primer uso de cachés o recolector) |
| CPU del servidor a 30 Hz | 0,38 % de un núcleo | 0,126 ms × 30 |
| Velocidad de reproducción | 7 930 ticks/s | 1 h de mundo se repite en 13,6 s; 1 día en 5,4 min |
| Serializar una instantánea | 0,037 ms (p99 0,086) | `JSON.stringify` |
| Instantánea rápida, 10 ballitas | 1 640 B JSON (máx 1 718) · 749 B gzip · 731 B deflate | tupla posicional por ballita |
| Ancho de banda a 10 Hz | 16,0 KB/s JSON · 7,1 KB/s deflate, por espectador | |
| Estado lento, por ballita | 3 853 B JSON · 2 020 B deflate | nombre, genoma, plan, registro (8 entradas)… solo al cambiar |
| Mensaje de bienvenida completo | 40 214 B JSON · 16 026 B deflate · 13 338 B brotli | lo que recibe quien llega tarde |
| Serialización ingenua (objetos con nombres, sin separar rápido y lento) | 50 863 B por instantánea | 31 veces la rápida: por eso se separa |
| Memoria del proceso Node | ≤ 488 MB residentes, 90 MB de montículo | cota superior: proceso con varios mundos y sims a la vez (sección 6) |
| Muertes | 0,6 por minuto (una cada ~100 s; muestra de 10 min, 6 muertes) | marca el ritmo de la fila |
| Tres rutas completas | 197–339 s | tiempo hasta perder el control por inactividad |

Error de posición al reconstruir entre instantáneas (radio de la ballita = 0,4 u; velocidad máxima vista 536 u/s):

| Frecuencia | Lineal en mundo (media / p99) | Paramétrica sobre la pista (media / p99 / máx) | Muestras que caen al respaldo lineal |
|---|---|---|---|
| 5 Hz | 0,70 / 8,29 u | 0,048 / 0,447 / 1,89 u | 3,7 % |
| 10 Hz | 0,28 / 2,81 u | 0,016 / 0,188 / 1,29 u | 1,9 % |
| 15 Hz | 0,18 / 1,43 u | 0,009 / 0,103 / 1,15 u | 1,2 % |

Lectura: interpolar en línea recta saca a la ballita de la pista (p99 de 2,8 u = 7 radios a 10 Hz). Interpolar el
avance `segT`, el desvío `lat` y la altura `hy` y recolocar con `laneFrame` (lo mismo que hace la sim) deja el error
en 0,016 u de media. El respaldo lineal solo se usa al cruzar de tramo o al empezar un vuelo (1,9 % de las muestras a
10 Hz); ahí están los máximos (14 u), y se elimina interpolando en dos trozos (hasta el final del tramo A y desde el
inicio del B). Los saltos legítimos (portal, llegada al planeta: hasta 289 u en un tick) no se interpolan: se saltan.

Determinismo (9 000 ticks, semilla 369, entradas de formar, tomar y decidir programadas por número de tick):

| Corrida | Huella del estado |
|---|---|
| A | `ebb6c5f2d9c20866` |
| B, mismas entradas | `ebb6c5f2d9c20866` (igual; también igual en un segundo proceso) |
| Mismas entradas con otro planeta elegido | `2de02059e764c546` (diverge, como debe) |
| Otra semilla | `52b7dd0fa35b287a` (diverge) |

En Node, con `rng` sembrada (`new Sim({ rng: mulberry32(s) })`, que ya existe) y dt fijo, la sim es determinista.

### 1.2 Comparación

| Criterio | A) Autoritativo + instantáneas | B) Lockstep determinista | C) Híbrido (A + sim local que predice) |
|---|---|---|---|
| Espectador que llega tarde | Recibe la bienvenida (16 KB comprimida) y ya ve el mundo | Tiene que repetir toda la historia (13,6 s por hora de mundo, 5,4 min por día) o recibir un volcado completo del estado, que hoy no existe: la `rng` es un cierre sin estado exportable y las ballitas guardan referencias a objetos del mundo y `THREE.Vector3` | Como A |
| Ancho de banda | 7–16 KB/s por espectador | ~0 (solo entradas) | Como A o algo menos |
| CPU del servidor | 0,38 % de un núcleo | ~0 (o lo mismo si además valida) | Como A |
| CPU del cliente | Solo interpolar (no corre la sim) | Corre la sim (igual que hoy) | Corre la sim y además corrige |
| Determinismo exigido | Ninguno entre máquinas | Bit a bit entre Chrome, Firefox, Safari y Node | Aproximado |
| Pestaña en segundo plano | Al volver pide lo último y ya | Debe repetir todo lo perdido (`rAF` se detiene) | Como A |
| Reconexión | Bienvenida nueva | Volcado o repetición | Como A |
| Riesgo | Bajo: el cliente no puede desincronizarse | Alto: una sola diferencia y cada quien ve un mundo distinto sin enterarse | Medio: dos fuentes de verdad |
| Trabajo | Servidor + adaptador + interpolador | Volcado de estado, paso fijo, auditoría de toda la aritmética, detección de desincronía | El de A más la reconciliación |

Por qué B no sirve aquí (hechos del código):

1. **Trigonometría**: `world.js` y `sim.js` usan `Math.sin`, `cos`, `atan2`, `hypot` y `acos` en todo el trazado; el
   estándar no fija sus últimos bits y cada motor (V8, SpiderMonkey, JavaScriptCore) da resultados distintos. La
   búsqueda de huecos de `buildWorld` toma decisiones discretas con esos números: un bit puede cambiar el mundo.
2. **La interfaz consume la misma `rng`**: `dialogos.js` usa `sim.rng` desde el ciclo de dibujo. En lockstep, cada
   cliente avanzaría la secuencia a su ritmo de cuadros.
3. **Paso variable**: `SimDriver` (Scene.jsx) llama `sim.tick` con el dt de cada cuadro troceado a 0,05 s; habría que
   pasar a paso fijo y perder la suavidad que motivó ese cambio.
4. **Orden de iteración**: `peerCounts` y `_near` usan `Map` (orden de inserción, estable), pero `spawnQueue.filter`
   y los empates del torneo dependen del orden exacto de las entradas: cualquier entrada aplicada en otro tick diverge.
5. **Volcado**: no hay forma de transmitir el estado completo de la sim; escribirlo y mantenerlo fiel es el mismo
   trabajo que la instantánea de A, con el riesgo añadido de que un campo olvidado desincroniza en silencio.

C no aporta: no hay entrada del jugador que necesite respuesta inmediata (las decisiones son «para la siguiente»),
así que no hay latencia que ocultar con predicción.

**Recomendación: A**, con estos parámetros:

- Tick fijo del servidor: 30 Hz (dt = 1/30 s; dentro del rango que la sim ya tolera: hoy recibe hasta 0,05 s).
- Instantánea rápida cada 3 ticks (10 Hz); cambios lentos en un mensaje aparte solo cuando hay.
- Cliente: dibuja 150 ms en el pasado (1,5 intervalos) e interpola entre las dos instantáneas que lo rodean.
- El mundo (geometría) se sigue construyendo en cada cliente con `buildWorld(semilla)`; el servidor envía sus
  **elecciones** (`picks`, 322 B) en la bienvenida, así todos comparten las decisiones discretas del trazado aunque sus
  decimales difieran, y el cliente se ahorra la búsqueda (8,5 s → 2,7 s). Las diferencias de últimos bits que queden
  son invisibles porque el cliente no simula: recoloca sobre su propia pista.
- La velocidad de simulación (control `speed` del Hud) deja de existir en modo remoto: el mundo va a 1×.

### 1.3 Integración en el despliegue actual

Hoy: navegador → Cloudflare (ballitas.ojitos3695.com) → túnel → host 127.0.0.1:8378 → contenedor `ballitas-py`,
uvicorn :8000 (supervisord). `uvicorn==0.38.0` sin extras **no acepta WebSocket** (falta `websockets` o `wsproto`).

Recomendado (no toca el túnel ni los puertos):

```
navegador ──wss://ballitas.ojitos3695.com/ws──▶ Cloudflare ─▶ túnel ─▶ 8378 ─▶ uvicorn :8000
                                                                              │  @app.websocket("/ws"): relevo
                                                                              ▼
                                                               node mundo (127.0.0.1:8379, mismo contenedor)
                                                                              │  POST/PATCH http://127.0.0.1:8000/api/...
                                                                              ▼  (registro de mundo y ballitas en SQLite)
```

- **Proceso Node en el mismo contenedor**, como `[program:mundo]` de supervisord:
  `command=node --watch /usr/src/app/mundo/servidor.bundle.mjs` (`--watch` reinicia al cambiar el archivo tras
  `git pull`, igual que `--reload` en uvicorn), `autorestart=true`, registros en `/usr/src/logs/mundo*.log`.
- **Node en la imagen**: en `dockerfile`, `COPY --from=node:22-slim /usr/local/bin/node /usr/local/bin/node`
  (un binario, sin npm). Requiere reconstruir la imagen una vez.
- **Un solo archivo para el servidor**: `servidor.bundle.mjs` se genera con esbuild (ya viene con Vite) a partir de
  `back/mundo/servidor.mjs` + `front/src/Core/{sim,world,personality,dialogos}.js` + `three` + `ws`. Así hay **una sola
  fuente de la sim** (la del front) y el contenedor no necesita `node_modules`. Lo produce el mismo paso que copia el
  build (`migrate_view.py`) y se comitea junto con `back/media/dist`.
- **Relevo en FastAPI**: `back/apis/mundo_ws.py` con `@router.websocket("/ws")` que abre
  `ws://127.0.0.1:8379` con la librería `websockets` y copia tramas en ambos sentidos (dos tareas `asyncio`).
  `requirements.txt`: añadir `websockets`. Costo: el relevo mueve 16 KB/s por espectador; sobra para decenas.
- **Cloudflare**: el túnel reenvía WebSocket sin configuración; corta conexiones inactivas a los 100 s, por eso el
  cliente envía `ping` cada 25 s. Compresión: `permessage-deflate` activado en `ws` (731 B por instantánea).
- **Registro en el back**: lo que hoy hace cada navegador (`iniciarBack`: `POST /mundos`, `POST /ballitas`,
  `PATCH /ballitas/{id}`) lo hace el servidor Node con `fetch` a `127.0.0.1:8000`; en modo remoto el cliente ya no
  registra nada. Las tablas no cambian.
- **Arranque y reinicio**: el servidor guarda las elecciones del mundo en `back/data/picks_<WORLD_GEN>_<semilla>.json`
  (arranque en 2,7 s en vez de 8,5–10 s). En la versión 1 el estado de la sim **no se conserva** al reiniciar: nace un
  mundo nuevo con otra `epoca`, la fila se pierde y los clientes se reinician solos al ver la época nueva. Conservar
  el estado en disco queda como mejora.
- Alternativa descartada por ahora: publicar un segundo puerto (8379) y una regla de ruta `/ws` en la configuración
  del túnel. Ahorra el relevo en Python, pero obliga a tocar el túnel del servidor (fuera del repo). Es el camino si
  algún día hay cientos de espectadores.
- Alternativa descartada: portar la sim a Python (3 100 líneas de `world.js` + three: dos fuentes de verdad).

## 2. Contrato

Versión del protocolo: `v = 1`. Tramas de texto JSON. Todo mensaje lleva `k` (tipo). Los del cliente pueden llevar
`q` (número de petición, entero), que el servidor devuelve en `ok` o `error`.

### 2.1 Identificación del espectador

- `localStorage['ballitas:espectador']` = `crypto.randomUUID()` (se crea la primera vez). Es **secreto**: es lo único
  que prueba quién eres. Nunca se reenvía a otros clientes.
- Identidad pública: `corto` = primeros 8 hexadecimales de SHA-1 del id; es lo que aparece en `ctrl`, `formadaPor` y
  la fila. El servidor le dice al cliente su propio `corto` en la bienvenida.
- Varias pestañas con el mismo id son el mismo espectador. Sin almacenamiento local: id en memoria (se pierde al
  recargar).
- `localStorage['ballitas:nombre']` guarda el último nombre usado al formar (comodidad).

### 2.2 Cliente → servidor

| `k` | Campos | Efecto |
|---|---|---|
| `hola` | `v: 1`, `id: string` (uuid), `epoca?: string`, `n?: number` | Primer mensaje obligatorio (5 s de plazo). Responde `hola`. |
| `formar` | `nombre: string` (1–16 caracteres; letras, números, espacio, `_`, `-`) | Entra al final de la fila. Errores: `ya_en_fila`, `nombre`, `fila_llena`. |
| `salirFila` | — | Quita su entrada de la fila. |
| `tomar` | `b: number` (id de ballita) | Toma una ballita sin controlador. Errores: `no_existe`, `ocupada`, `ya_controlas`. |
| `dejar` | `b: number` | Deja de controlar. Error: `no_controlas`. |
| `decidir` | `b: number`, y cualquiera de `destino: number \| null` (idx de nodo), `ruta: { way: number, r: number } \| null` (idx global del sentido y número local de ruta), `carril: 0..4 \| null` | Fija o borra (`null`) decisiones «para la siguiente». Los campos ausentes no cambian. Errores: `no_controlas`, `destino`, `ruta`, `carril`. Responde `ok` con `dec` resultante. |
| `ping` | `c: number` (reloj del cliente, ms) | Responde `pong`. Cada 25 s. |

Límites: 512 B por mensaje, 5 mensajes/s por conexión (exceso: `error: 'ritmo'`; reincidencia: cierre 1008).

### 2.3 Servidor → cliente

| `k` | Campos |
|---|---|
| `hola` | `v`, `epoca: string` (cambia en cada arranque del servidor), `semilla: number`, `worldGen: number`, `picks: object[]`, `hz: 30`, `cada: 3` (ticks por instantánea), `n: number` (tick), `t: number` (segundos de sim), `yo: { corto: string }`, `b: Lenta[]` (cada una con `r: Rapida`), `fila: Fila[]`, `stats`, `feed`, `espectadores: number`, `reglas: { maxSinDecidir: 3, maxFila: 30, maxNombre: 16 }` |
| `i` | `n`, `t`, `b: Rapida[]` — 10 Hz |
| `d` | `n`, y solo lo que cambió: `b?: Partial<Lenta>[]` (cada una con `id`), `nace?: Lenta[]` (con `r`), `fila?: Fila[]` (completa), `stats?`, `feed?`, `espectadores?`. Se envía **antes** de la `i` del mismo tick. |
| `ok` | `q`, y según el caso `puesto?: number`, `dec?: Dec` |
| `error` | `q?`, `error: string` (código) |
| `pong` | `c`, `n`, `t` |

Si `worldGen` no coincide con el `WORLD_GEN` del cliente, el cliente tiene un build viejo: recarga la página.
Una ballita deja de existir cuando una `i` ya no trae su id (tras pasar por la fase `dying`).

`Fila = { nombre: string, de: string (corto), t: number }`, en orden (el índice 0 es la siguiente en entrar).

`Dec = { destino?: number, ruta?: { way: number, r: number }, carril?: number }`.

**`Rapida`** — tupla posicional (índices fijos; codificador y decodificador en `front/src/Core/protocolo.js`):

| # | Campo | Tipo y redondeo | # | Campo | Tipo y redondeo |
|---|---|---|---|---|---|
| 0 | `id` | entero | 13 | `lat` | 3 decimales |
| 1 | fase | 0 `born`, 1 `toDest`, 2 `at`, 3 `toPort`, 4 `travel`, 5 `dying` | 14 | `hy` | 3 decimales |
| 2 | `p` | 2 decimales | 15 | `off` | 3 decimales |
| 3 | `e` | 2 decimales | 16 | `ang` | 3 decimales |
| 4 | `speed` | 2 decimales | 17 | `roll` | 3 decimales |
| 5 | `timer` | 2 decimales | 18 | `slope` | 3 decimales |
| 6 | `pos` | `[x, y, z]`, 2 decimales | 19 | `impact` | 2 decimales |
| 7 | `dir` | `[x, y, z]`, 3 decimales | 20 | `vis` | 2 decimales |
| 8 | `up` | `[x, y, z]`, 3 decimales | 21 | banderas | bit 1 `airborne`, 2 `onLane`, 4 en vuelo, 8 vuelo fallido |
| 9 | `seg` | `seg.i` (índice en `way.segments`) o −1 | 22 | evento | índice de `flight.sw` en `seg.switches`, o −1 |
| 10 | `segT` | 5 decimales | 23 | `flight.t` | 3 decimales |
| 11 | `lane` | entero | 24 | `walk.i` | entero o −1 |
| 12 | `carril` | 0..4 | 25 | `walk.t` | 3 decimales |

**`Lenta`** — objeto (solo al nacer y cuando cambia algún campo; en `d` viajan solo los que cambiaron):

```
{ id, name, gen, padres: number[], arch: { key, hi, title }, genome, bornAt,
  node, vert, dest: idx|null, way: idx|null, route: idx|null, plannedRoute: idx|null, nextDest: idx|null,
  walk: number[]|null (camino de vértices), dur, plan: { destino, ruta, razon, carril?, manual?: string[] }|null,
  mood, thought: { text, emoji, until }|null, react: { mood, until }|null,
  age, score, visits, cause, visited: number[], mechs, lastSwitch|null, log: object[] (máx 8),
  ctrl: corto|null, formadaPor: corto|null, dec: Dec, sinDecidir: 0..3, auto: { way: idx, r: number }|null }
```

`age` y `score` se reenvían como mucho una vez por segundo. `auto` es la decisión que tomaría hoy la sim sin ruido
(`sim.predecir(b)`), se recalcula una vez por segundo y solo para ballitas con controlador: es la «decisión por
defecto» que la interfaz muestra en cada botón.

### 2.4 Adaptador del front: el objeto `mundo`

`front/src/Core/mundo/index.js` exporta `crearMundo({ modo, url, semilla }) → Promise<Mundo>`. La interfaz recibe
`mundo` donde hoy recibe `sim` (misma forma, por eso los paneles y la escena casi no cambian):

```
Mundo = {
  // ── lo que la interfaz ya usa de sim (inventario del código actual) ──
  world,                      // buildWorld(semilla): Detail, ListaBallitas, ViewTabs, Ballita, Scene, Main, Llegada
  ballitas: Ballita[],        // MISMO arreglo y MISMOS objetos durante toda la vida de cada ballita (la interfaz
                              // guarda `selected` por referencia y espera ver `phase === 'gone'` al morir)
  t: number,                  // Ballita.jsx (globos)
  stats, feed, seed, pop,
  rng: () => number,          // dialogos.js; en remoto es Math.random (solo cosmético)
  tick(dt): void,             // Scene.jsx SimDriver. Local: sim.tick. Remoto: avanza el reloj de dibujo e interpola
  where(b): string,           // Detail
  favorites(b): object,       // Detail
  // ── nuevo ──
  modo: 'local' | 'remoto',
  estado: 'conectando' | 'listo' | 'reconectando' | 'sin_servidor',
  yo: { corto: string },
  fila: Fila[],               // cada entrada con `mia: boolean`
  espectadores: number,
  reglas: { maxSinDecidir, maxFila, maxNombre },
  puede: { velocidad: boolean },                    // false en remoto: el Hud oculta el control de velocidad
  nombreSugerido(): string,                         // nombreUnico(Math.random, nombres en uso)
  formar(nombre): Promise<{ ok, puesto?, error? }>,
  salirFila(): Promise<{ ok, error? }>,
  tomar(b): Promise<{ ok, error? }>,
  dejar(b): Promise<{ ok, error? }>,
  decidir(b, dec: Partial<Dec con null>): Promise<{ ok, dec?, error? }>,
  opciones(b): { origen: idx, planetas: Planeta[], rutas: Ruta[], carriles: Carril[] },   // sección 3.5; pura
  on(evento, fn): () => void, // 'cambio' (fila, control, estado), 'entra', 'libre'; devuelve la baja
  cerrar(): void,
}
```

Campos de cada ballita que la interfaz lee hoy y que el adaptador remoto debe dar con el mismo tipo:
`id, name, gen, arch, genome, padres, p, e, age, score, cause, phase, timer, dur, speed, mood, thought, react, log,
plan, node, vert, dest (objeto de world.destinos), way (objeto), route (objeto), seg (objeto), segT, lane, carril,
ang, off, hy, lat, roll, slope, impact, vis, airborne, onLane, snap, walk { path, i, t },
flight { sw (objeto de seg.switches), t, failed, from, to } | null, sw { s, failed } | null, pos, dir, up
(THREE.Vector3 persistentes, se mutan en sitio)`. Nuevos: `ctrl, formadaPor, mia (ctrl === yo.corto), dec,
sinDecidir, auto`.

Reglas del adaptador **remoto** (`mundo/remoto.js` + `mundo/interpola.js`):

- Resuelve índices contra su `world`: `way = world.ways[idx]`, `seg = way.segments[i]`, `route = world.routes[idx]`,
  `dest = world.destinos[idx]`, `flight.sw = seg.switches[k]`.
- Reloj: `tServidor ≈ performance.now()/1000 + desfase`, con el desfase suavizado a partir de `t` de cada `i`;
  se dibuja en `tServidor − 0,15 s`.
- Colocación por fase entre las instantáneas A y B (u = fracción):
  - `travel`, mismo tramo y camino, sin vuelo: interpola `segT`, `lat`, `hy`; `F = laneFrame(seg, lane, segT)`;
    `pos = F.pos + F.side·lat + F.up·hy`; `dir = F.tangent`; `up = F.up`.
  - `travel`, tramo distinto: dos trozos (de `segT_A` a 1 en A, de 0 a `segT_B` en B), repartidos por longitud
    (`laneLength`).
  - vuelo (mismo evento): `switchPath(seg, sw, t)` con `t` interpolado.
  - ciudad (`born`, `toDest`, `at`, `toPort`): interpola `pos` y la reproyecta a la esfera del nodo
    (`node.pos + normalizado · (NODE_R + BALL_R)`).
  - salto de más de 30 u entre A y B, cambio de fase a o desde `travel`, o `vis` < 0,5: sin interpolar (se salta).
  - `dir` y `up`: interpolación normalizada. Los escalares de animación (`impact`, `slope`, `speed`…): lineal.
- Ballita que desaparece: la marca `phase = 'gone'` y la saca de `ballitas` (misma semántica que hoy).
- Reconexión: reintentos a 1, 2, 4, 8 y 15 s (máximo); al reconectar envía `hola` con su `epoca`; si la del servidor
  es otra, vacía `ballitas` (todas a `gone`) y vuelve a empezar. Pestaña que vuelve a ser visible: descarta el búfer.

Adaptador **local** de respaldo (`mundo/local.js`): envuelve `new Sim()` (como hoy, `rng = Math.random`, `tick`
variable, registro con `iniciarBack`) y expone la misma interfaz; `formar`, `tomar`, `dejar` y `decidir` llaman a los
métodos nuevos de la sim (sección 4) con el id local y devuelven promesas ya resueltas. `puede.velocidad = true`.
Se usa con `?mundo=local`, en `pnpm dev` sin servidor, y como caída automática si el WebSocket no conecta en 5 s
(`estado = 'sin_servidor'`, con aviso visible «sin conexión: mundo local»).

## 3. Reglas del control

Constantes (en `sim.js`): `MAX_SIN_DECIDIR = 3`, `MAX_FILA = 30`, `MAX_NOMBRE = 16`, `GRACIA_DESCONEXION = 60 s`.

### 3.1 Formar y fila

1. Cualquier espectador puede **formar** una ballita: nombre por defecto (`mundo.nombreSugerido()`, el mismo generador
   de sílabas de la sim, sin repetir los que están vivos), editable, 1–16 caracteres. El servidor lo limpia; si ya
   existe en el mundo le añade ` 2`, ` 3`…
2. La fila es **una sola, común y FIFO**. Cada espectador puede tener **una** entrada en la fila a la vez. Tope de 30.
3. Todos ven la fila completa (nombre y quién la formó) y su puesto.
4. **Entrada**: cuando una ballita muere, la sim programa un nacimiento 1,5 s después (como hoy). En ese nacimiento,
   si la fila tiene alguien, nace la primera de la fila; si está vacía, nace como hoy.
5. **Genoma de la formada: el mismo algoritmo genético de hoy** (`genomeForNewborn`: torneo + cruce + mutación sobre
   las muertas, 10 % de inmigrantes). Formar aporta el nombre y el control, no los genes. Razones: la evolución sigue
   intacta aunque todas las ballitas vengan de la fila (con genoma al azar cada formada sería una inmigrante y la
   selección desaparecería); no hace falta más interfaz; la generación (`gen`) sigue teniendo sentido. El nombre de la
   formada no lleva el sufijo `G<n>`; la generación se ve en el detalle.
6. La entrada en la fila sobrevive a la desconexión. Si al nacer su dueño no está conectado, o ya controla otra,
   nace sin controlador.

### 3.2 Quién controla

1. Cada ballita tiene **cero o un** controlador. Cada espectador controla **como máximo una** ballita.
2. Al nacer desde la fila la controla quien la formó (salvo 3.1.6).
3. **Dejar**: botón «dejar de controlar». La ballita sigue viva en automático.
4. **Inactividad**: en cada llegada a un planeta (`arrive`) de una ballita controlada: si ese viaje usó alguna decisión
   del controlador **o** hay alguna decisión pendiente para el siguiente, el contador `sinDecidir` vuelve a 0; si no,
   sube 1. Al llegar a 3 pierde el control (motivo `inactivo`). Medido: 197–339 s.
5. **Tomar**: cualquier espectador que no controle ninguna puede tomar una ballita sin controlador (nacida sola,
   dejada, liberada por inactividad o de un dueño ausente). Gana el primer mensaje que llega al servidor.
6. **Desconexión**: si el controlador se queda sin ninguna conexión abierta, tiene 60 s para volver (mismo id); pasado
   ese plazo la ballita queda libre (motivo `desconectado`).
7. Al morir la ballita se acaba el control. El espectador puede formar otra.

### 3.3 Decisiones «para la siguiente»

Tres decisiones, cada una opcional, de **un solo uso**, sobre el **siguiente viaje** (el que empieza en el próximo
`goWay`). El «origen» de ese viaje es `b.node`, o `b.way.to` si la ballita ya va de camino (`toPort` o `travel`).

| Decisión | Valor | Se consume en | Efecto |
|---|---|---|---|
| Planeta destino | idx de nodo ≠ origen | `goWay(b)`: al terminar su estancia en el edificio (fase `at` → `toPort`) | El optimizador automático solo considera el sentido origen → ese planeta |
| Ruta | `{ way, r }` de un sentido que sale del origen | `goWay(b)` fija `plannedRoute`; se impone en cada bifurcación (`pickNext`: en `fork` y en `cross`) | Recorre esa ruta entera; hoy la sim puede cambiar de ruta a mitad de circuito, con ruta decidida no |
| Carril inicial | 0..4 | `enterSeg` del primer tramo (la salida) y cada vez que el viaje entra en un tramo de otra ruta | Sustituye al sorteo. Vale **hasta el primer evento**: al aterrizar de un cambio de camino cae en un carril al azar, como hoy |

Reglas exactas:

- **Lo que no se elige lo elige la sim**: `goWay` es el mismo recorrido de `planUtility` sobre sentidos × rutas ×
  edificios del planeta destino, restringido a lo decidido. El edificio al llegar (`nextDest`, y luego `goDest`)
  siempre es automático. Sin controlador o sin decisiones, el resultado es idéntico al de hoy.
- **Elegir ruta implica planeta**: una ruta pertenece a un sentido. Al decidir ruta, el servidor fija también
  `destino = way.to`. Si luego se cambia el planeta, la ruta se borra.
- **Validez al decidir**: el servidor rechaza un planeta igual al origen o una ruta que no sale del origen.
- **Validez al consumir**: se vuelve a comprobar en `goWay` contra `b.node`. Lo que ya no valga se ignora y lo toma la
  decisión automática (ejemplo: decidió ruta de X y la ballita, por una decisión anterior, salió hacia otro planeta).
- **Decidir tarde**: si la ballita ya salió (`toPort` o `travel`), las decisiones son para el viaje posterior, y las
  tarjetas se calculan desde el planeta al que va.
- Las decisiones pendientes se ven en `b.dec` (todos los espectadores las ven) y se pueden cambiar o borrar hasta que
  se consumen. Al perder o dejar el control se borran.
- Decisiones usadas: `b.plan.manual = ['destino' | 'ruta' | 'carril', …]` y `b.plan.razon = 'lo decidió quien me
  controla'`.

Prototipo: 5 viajes con ruta + carril decididos: 5/5 llegaron al planeta, 5/5 recorrieron solo esa ruta, 5/5 salieron
en el carril pedido.

### 3.4 Decisión por defecto

Es la automática de la sim. Cada botón muestra, cuando no hay decisión, «Automático: <lo que la sim elegiría ahora>»
con `b.auto` (predicción sin ruido de `sim.predecir(b)`; la elección real ocurre al salir y puede diferir porque
energía, puntos y compañeras cambian). El carril por defecto es «al azar».

### 3.5 Tarjetas, vista previa y lo que se muestra al pasar el cursor

`mundo.opciones(b)` devuelve todo ya calculado. Fórmulas de previsión (las de `planUtility`, en segundos de sim):
`eta = route.length / (cruise(b)·TUBE_SPEED_K·velMedia + 8·TRACK_K)` con `velMedia` = media de `speedK` de los 6
obstáculos; `dE = −(eta·DRAIN_E + route.length·TRAVEL_E_LEN·theme.ecost)`; `dP = eta·(theme.pps·PPS_K − DRAIN_P)`;
duración real ≈ `eta / TRAVEL_SLOW`.

**Planeta** (una tarjeta por cada `way` de `world.waysFrom[origen]`):

| Dato | Fuente |
|---|---|
| Nombre y color | `world.nodes[way.to].name`, `.color` |
| Vista previa | esfera con su color y los emojis de sus edificios (la textura del planeta si es barata de obtener) |
| Camino que lleva | `way.theme.emoji`, `way.theme.name` |
| **Se gana** | edificios del planeta: `node.destinos[]` con `kind`, `name`, `dp`, `de`; resumen «hasta +máx(dp) puntos» y «hasta +máx(de) energía» |
| **Se pierde** | el costo de cada edificio (`de` < 0 en los de puntos, `dp` < 0 en los de energía) y el viaje: `dE`, `dP` y duración de la mejor ruta, más `theme.risk` |
| Balance | «llegarías con ~E energía y ~P puntos» = estado actual + viaje; en rojo si alguna baja de 0 (moriría) |
| Otros | cuántas ballitas van o están ahí (`peerCounts(b).byNode`), si ya lo visitó (`b.visited`) |

**Ruta** (tarjetas de `way.routes`; si no hay planeta elegido, agrupadas por planeta):

| Dato | Fuente |
|---|---|
| Nombre | `route.name` (A, B o C), `route.profile.label` |
| Vista previa | polilínea de `route.segments[].curve` proyectada (SVG), coloreada con el tema |
| Velocidad y emoción | `route.profile.speed` (`rapida`, `media`, `lenta`), `route.profile.thrill` (0..1) |
| Obstáculos | `route.kinds[6]` → `KINDS[k].emoji`, `.name`, `.risk` |
| **Se gana / se pierde** | `dP`, `dE`, duración (fórmulas de arriba), longitud `route.length` |
| Eventos | recuento de `seg.switches` de sus tramos |
| Otros | veces recorrida (`b.visitedRoutes[route.idx]`), compañeras en ella (`byRoute`) |

**Carril** (5 tarjetas, 0..4; se calculan sobre la ruta elegida o, si no hay, sobre `b.auto`):

| Dato | Fuente |
|---|---|
| Nombre | «Carril n de 5» (0 = borde izquierdo, 4 = derecho: `carrilLat(c)`) |
| Vista previa | corte de la calzada con 5 carriles y el elegido resaltado |
| Primer evento que encontrará | primer `sw` (menor `u`, desde el primer tramo de la ruta) con `sw.carril === c` y `sw.from` = camino inicial: `sw.emoji`, `sw.name`, `sw.kind` |
| **Se gana** | `sw.reward.p`, `sw.reward.e` si lo completa |
| **Se pierde** | probabilidad de fallar `sw.fail·(1,25 − valentía·0,5)`; al fallar: −30 % de velocidad y −(1 + 3·`sw.risk`) puntos |
| Aviso fijo | «tras el primer evento el carril vuelve a ser al azar; usar el evento lo decide la ballita» |

## 4. Cambios en `sim.js`

El prototipo los implementa como subclase (`SimMundo` en `front/tools/mundo_compartido_proto.mjs`); en producción van
dentro de `Sim`. Condición de aceptación: **sin fila ni controladores, la sim da exactamente el mismo estado que
hoy** con la misma semilla (misma secuencia de la `rng`); ver `equivalencia` en la sección 6.

```js
// La rng con semilla YA existe: new Sim({ rng: mulberry32(s), seed }). El servidor la usa y registra `s`.
// El cliente local sigue con Math.random. No se añade estado exportable a la rng (no hace falta en A).

// Estado nuevo
sim.fila = []            // { espectador, nombre, t }
sim.hooks                // se añaden: entra(b, espectador), libre(b, motivo), decide(b, dec)
b.ctrl = null            // espectador que controla
b.formadaPor = null
b.dec = {}               // { destino?, ruta?: { way, r }, carril? } pendientes
b.sinDecidir = 0         // llegadas seguidas sin decisión
b.viajeDecidido = false  // el viaje en curso usó alguna decisión
b.rutaFija = null        // route impuesta en fork y cross durante este viaje
b.carrilFijo = null      // carril impuesto hasta el primer aterrizaje

// API
formar(espectador, nombre) -> { ok: true, puesto } | { ok: false, error: 'ya_en_fila' | 'nombre' | 'fila_llena' }
salirFila(espectador)      -> { ok }
tomar(id, espectador)      -> { ok } | { ok: false, error: 'no_existe' | 'ocupada' | 'ya_controlas' }
dejar(id, espectador, motivo = 'dejar') -> { ok } | { ok: false, error: 'no_controlas' }
decidir(id, espectador, dec) -> { ok: true, dec } | { ok: false, error: 'no_controlas' | 'destino' | 'ruta' | 'carril' }
origenSiguiente(b)         -> idx de nodo desde el que saldrá el siguiente viaje
predecir(b)                -> { way, route } | null     // sin ruido y sin consumir rng (como probWays)
prevision(b, way, route)   -> { seg, dE, dP }           // fórmulas de 3.5; también exportar DRAIN_E, DRAIN_P,
                                                        // TRAVEL_E_LEN, PPS_K, TUBE_SPEED_K
// Métodos existentes que cambian
spawn()        // si hay fila: toma la primera ANTES de generar el nombre (así `say('nace')` y hooks.nace ven el nombre
               // real; el prototipo lo renombra después, eso no vale en producción); asigna formadaPor y ctrl
goWay(b)       // restringe sentidos y rutas con b.dec válidas; fija rutaFija, carrilFijo, viajeDecidido; vacía b.dec
pickNext(b)    // si rutaFija y algún `next` es de esa ruta, lo devuelve; si no, lo de hoy
enterSeg(b, s) // tras el sorteo: si carrilFijo != null y (primer tramo o cambia seg.route) -> b.carril = carrilFijo
flightStep()   // al aterrizar: carrilFijo = null
arrive(b)      // regla de inactividad (3.2.4) y limpieza de rutaFija, carrilFijo, viajeDecidido
watch(b)       // al morir: ctrl = null (hooks.libre con motivo 'muerte')
```

La gracia por desconexión y los límites de ritmo viven en el servidor, no en la sim (la sim no sabe de conexiones);
el servidor llama `sim.dejar(id, espectador, 'desconectado')`.

Nota para el servidor: `enterSeg` sigue llamando a la `rng` aunque el carril esté decidido, y `goWay` evalúa menos
candidatos cuando hay decisiones; por eso una decisión cambia la secuencia aleatoria posterior. No importa en A.

## 5. Plan de piezas paralelas

Las tres parten de este documento y no comparten archivos. Orden de integración: P1 → P2 → P3; el orquestador hace
el montaje final (dos líneas en `Pages/Main/index.jsx`) y la prueba de punta a punta.

### P1 — Servidor de sim, WebSocket e infraestructura

- **Archivos**: `front/src/Core/sim.js`, `front/src/Core/sim.test.js`, `front/src/Core/protocolo.js` (+ prueba;
  codifica y decodifica `Rapida`/`Lenta`, constantes del protocolo), `back/mundo/*` (`servidor.mjs`, `empaquetar.mjs`),
  `back/apis/mundo_ws.py` y su alta en `back/apis/urls.py`, `back/requirements.txt`, `back/supervisord.conf`,
  `back/dockerfile`, `migrate_view.py` (raíz del repo), `front/package.json` (dependencia `ws`, guion `build:mundo`).
- **Expone**: secciones 2.2, 2.3 y 4. **Consume**: nada de las otras.
- **Sin las otras**: se prueba con un cliente de consola (`back/mundo/cliente_prueba.mjs`) que conecta, forma, decide
  y comprueba las respuestas.
- **Metas**: `pnpm test` completo (76 + nuevas); huella idéntica a la sim actual sin entradas (semilla 369, 18 000
  ticks); tick p99 < 1 ms; instantánea ≤ 1 800 B para 10 ballitas; bienvenida ≤ 20 KB comprimida; 50 clientes de
  prueba a 10 Hz con < 10 % de un núcleo y memoria residente estable 10 min (medir y anotar; referencia ≤ 488 MB); arranque < 4 s con elecciones guardadas;
  `wss://…/ws` responde `hola` a través de uvicorn en local (`docker compose up`).

### P2 — Cliente: adaptador remoto y local, y la interfaz leyendo de él

- **Archivos**: `front/src/Core/mundo/*` (`index.js`, `remoto.js`, `local.js`, `interpola.js`, `opciones.js`,
  pruebas), `front/src/Pages/Main/index.jsx` (cambia `new Sim()` por `crearMundo()`), `front/src/Core/api.js`
  (registro solo en local), `front/src/Components/Panels/Hud.jsx` (oculta la velocidad si `!mundo.puede.velocidad`,
  indicador de conexión), `front/src/Components/World3D/Scene.jsx` solo si algún acceso lo exige.
- **Consume**: 2.2, 2.3 (de P1) y los métodos de 4 en el adaptador local. **Expone**: 2.4.
- **Sin P1**: trae una copia del decodificador hasta integrar (o importa `protocolo.js` cuando exista); el local
  llama `sim.formar?.()` y responde `{ ok: false, error: 'sin_soporte' }` si no existe; el remoto se prueba contra
  una grabación de tramas generada con el prototipo (`rapido`/`lento` ya emiten este formato).
- **Metas**: error de interpolación frente a la verdad ≤ 0,05 u de media y ≤ 0,5 u p99 a 10 Hz (prueba en Node con
  tramas grabadas; referencia medida: 0,016 / 0,188 sin respaldo); ningún `new Sim` fuera de `mundo/local.js`;
  costo por cuadro del adaptador < 0,3 ms con 10 ballitas; reconexión visible < 3 s tras reiniciar el servidor;
  modo local idéntico al de hoy (mismas 76 pruebas, misma captura); consola sin errores en ambos modos.

### P3 — Interfaz de control

- **Archivos**: `front/src/Components/Control/*` (`index.jsx`, `Formar.jsx`, `Fila.jsx`, `Decisiones.jsx`,
  `Selector.jsx`, `Tarjeta.jsx`, `previas.js`, `mundoFalso.js`, `demo.jsx`), `front/control.html` (entrada de Vite
  propia para la demo), `front/src/static/css/control.css`.
- **Consume**: 2.4 (`mundo.fila`, `yo`, `formar`, `tomar`, `dejar`, `decidir`, `opciones`, `on`, y `b.ctrl`, `b.mia`,
  `b.dec`, `b.auto`, `b.sinDecidir`). **Expone**: `<Control mundo selected onSelect />`.
- **Sin P1 ni P2**: `mundoFalso.js` implementa 2.4 en memoria sobre `buildWorld` (o sobre la `SimMundo` del
  prototipo) y `control.html` lo monta; así se valida en navegador sin tocar `Main/index.jsx`.
- **Contenido**: formar (nombre sugerido editable + botón), fila con puesto propio, barra inferior con tres botones
  (planeta, ruta, carril) que muestran la decisión o «Automático: …», selector de tarjetas con vista previa y detalle
  al pasar el cursor (3.5; en táctil, al tocar), botón de dejar y de tomar, aviso «te quedan n rutas sin decidir».
- **Metas**: selector abierto en < 100 ms; sin caída de cuadros medible con el panel abierto (±15 % de ruido);
  utilizable a 360 px de ancho y con teclado; capturas revisadas de los tres selectores y sus detalles.

## 6. Prototipo

`front/tools/mundo_compartido_proto.mjs`. Contiene `SimMundo` (borrador de la sección 4), los codificadores
`rapido(b)` y `lento(b)` (formato de 2.3) y las mediciones de 1.1. Salida completa: `docs/mundo_compartido_medidas.json`.

Comprobaciones que hace: tick y bytes; fila (6 ballitas entraron de la fila en 10 min); decisiones (5/5); inactividad
(3 casos, los 3 liberados en la tercera llegada); determinismo (tabla de 1.1); interpolación (tabla de 1.1).

Equivalencia con la sim actual (sin entradas, semilla 369, 18 000 ticks = 10 min): huella de `Sim` actual `b11c0191785ad5e6`, huella de `SimMundo` `b11c0191785ad5e6`: **iguales**. Los ganchos no alteran la sim cuando nadie los usa. Memoria de ese proceso (que además corrió todas las mediciones: varios mundos y sims): 488 MB residentes, 90 MB de montículo; es una cota superior, el servidor real con un solo mundo debe medirse en P1.

Límites del prototipo: no abre sockets ni mide el relevo de FastAPI (cifras de red = bytes de carga útil, sin
cabeceras de trama, 2–4 B cada una); el determinismo se comprobó en Node en esta máquina, no entre navegadores (no se
necesita en A); la muestra de muertes es corta (6 en 10 min).

## 7. Decisiones abiertas para el usuario

1. **Espera en la fila**: con 10 ballitas muere una cada ~100 s; el quinto de la fila espera unos 8 minutos. Si es
   demasiado: subir la población, o permitir «plazas extra» (hasta N formadas por encima de las 10). El pedido dice
   «al morir otra», así que el diseño lo respeta tal cual.
2. **Una ballita por espectador** (control y fila). Es una propuesta para repartir; se cambia con dos constantes.
3. **Elegir ruta fija también el planeta** (3.3). La alternativa (ruta por letra A/B/C aplicada al sentido que salga)
   no permite vista previa.
4. **Genoma de la formada = algoritmo genético** (3.1.5). Alternativa futura: dejar elegir rasgos.
5. **Reinicio del servidor = mundo nuevo** en la versión 1.

## 8. Conocimiento propuesto

Para que el orquestador lo pase a `Agents/conocimiento/` (módulo nuevo sugerido: `red_y_multijugador`).

### Simulación autoritativa con instantáneas e interpolación paramétrica

**Abstracción.** Cuando varios espectadores deben ver la misma simulación y esta no fue escrita para ser determinista
bit a bit, se corre **una** copia en el servidor y se transmite estado, no entradas. El estado se parte en dos:
*rápido* (lo que cambia cada tick: tupla posicional, redondeada, a 10 Hz) y *lento* (identidad, textos, planes: objeto
con nombres, solo al cambiar). El cliente no simula: dibuja ~1,5 intervalos en el pasado e interpola. Si los objetos
se mueven sobre geometría conocida por el cliente (pista, curva, grafo), se interpola **el parámetro** (tramo +
avance + desvío) y se recoloca con la misma función que usa la simulación; interpolar la posición en línea recta corta
las curvas.

**Ejemplo.** Ballitas: `sim.js` en Node a 30 Hz (0,126 ms por tick); instantánea de 10 entidades = 1,6 KB (0,7 KB
comprimida); error de reconstrucción a 10 Hz: 0,28 u lineal frente a 0,016 u paramétrica (`laneFrame(seg, lane,
segT)` + desvíos). El adaptador del cliente expone la misma forma que el objeto de simulación local, así la interfaz
no distingue local de remoto.

```js
// cliente, por cuadro
const u = (tDibujo - A.t) / (B.t - A.t)
if (a.seg === b.seg && a.lane === b.lane) {            // mismo tramo: paramétrica
  const F = laneFrame(seg, a.lane, mix(a.segT, b.segT, u))
  pos.copy(F.pos).addScaledVector(F.side, mix(a.lat, b.lat, u)).addScaledVector(F.up, mix(a.hy, b.hy, u))
} else if (a.pos.distanceTo(b.pos) > SALTO) pos.copy(b.pos)   // teletransporte: no interpolar
else pos.lerpVectors(a.pos, b.pos, u)                          // respaldo (o dos trozos por longitud)
```

**Trampas.**
- Lockstep exige determinismo entre motores: `Math.sin` y compañía no son idénticos entre V8, SpiderMonkey y
  JavaScriptCore; basta que la interfaz consuma la misma `rng` o que el paso sea variable para divergir en silencio.
- Serializar el objeto entero cuesta 30 veces más que la tupla rápida: separar rápido y lento antes de medir.
- Las referencias a objetos del mundo viajan como índices; el cliente las resuelve contra **su** mundo, que debe
  compartir las decisiones discretas de generación (enviar las elecciones, no confiar en recalcularlas).
- La interfaz suele guardar entidades por referencia: el adaptador debe mutar los mismos objetos, no recrearlos.
- Los saltos legítimos (portales, cambios de fase) interpolados dibujan una entidad cruzando el mapa.
- Un servidor ASGI puede no traer WebSocket (uvicorn sin extras); los proxies cortan conexiones inactivas (latido).
- El identificador del espectador guardado en el navegador es un secreto: a los demás se les envía un derivado.

**Verificación.** (1) Huella del estado: dos corridas con la misma semilla y entradas coinciden; cambiando una entrada
divergen. (2) Sin entradas externas, la simulación modificada da la misma huella que la original. (3) Error de
reconstrucción (media y p99) frente a la verdad tick a tick, por frecuencia, en unidades del tamaño del objeto.
(4) Bytes por instantánea y por segundo, crudos y comprimidos. (5) ms por tick y % de núcleo a la frecuencia elegida.
(6) En navegador real: llegar tarde, recargar, reiniciar el servidor y pestaña en segundo plano.
