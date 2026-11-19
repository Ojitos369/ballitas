// Mundo de Ballitas, sin React ni render: lo usan la sim y el 3D.
//
// ═══════════════════════════ CONTRATO DE DATOS ═══════════════════════════
// Unidades de mundo; Y es "arriba" (la gravedad tira hacia -Y). Todo `pos`/`dir` es THREE.Vector3.
// Escala global:
//   WORLD_SCALE (2.8): factor de separación entre centros de nodos, panza/arco/apertura de ways,
//                      amplitudes y caídas (`drop`) de obstáculos.
//   TUBE_SCALE  (1.8): factor del radio de los tubos (`P.radius`); `BALL_R` queda fijo (0.5)
//                      para dejar espacio interior a pórticos, gradas y decoración.
//   SIZE_K      (2.8): ampliación del mapa (SPHERE_R, panza y arco de los caminos) sin agrandar las pistas.
//   TRACK_K     (4.7): escala uniforme de todo lo espacial del trazado (incluidos NODE_R, LANE_W y el efecto de
//                      WORLD_SCALE/TUBE_SCALE); BALL_R no escala: calzada LANE_W = 4.89 u (~6 ballitas de ancho).
//   PORT_ZONE: radio desde el centro de un nodo donde los caminos que llegan a él se unen (inPort); fuera de él y de
//              las uniones fork/cross/merge (ROUTE_JOIN), todo par de caminos guarda >= 1.5 radios de pista de huelgo:
//              circuitos distintos, ida contra vuelta, rutas de un mismo sentido y carriles trenzados entre sí
//              (tools/overlap.mjs, layout.test.js).
//   TIME_SCALE  (4.5): definido en sim.js; escala objetivo del tiempo de viaje por circuito y
//                      de las tasas de desgaste/puntos para compensar caminos más largos.
// buildWorld(seed) es determinista y devuelve:
//
// world = { nodes[5], destinos[], circuits[10], ways[20], waysFrom[nodo] -> way[], routes[], segments[] }
//
// node = {
//   idx, name, color, pos (centro), radius (= NODE_R; el nodo es una ESFERA),
//   verts[]:    { dir (normal unitaria), pos (punto de la superficie) }  vértices de la red de carreteras
//   roads[]:    { a, b (índices de verts), length, points[] }  arco de círculo máximo; `points` ya
//               muestreado sobre la superficie (para pintar la carretera)
//   ports[4]:   { to (idx del otro nodo), dir (normal hacia ese nodo), in, out (índices de verts),
//                 wayIn, wayOut (way que llega a `in` / que sale de `out`) }
//   portTo[j]:  el puerto que mira al nodo j (hueco en el índice propio)
//   terminals[]: { vert (índice en node.verts), kind: 'out'|'in', way (way que sale/llega),
//                  to (idx del otro nodo), dir, pos,  (8+ por nodo, repartidos por toda la esfera)
//                  gate: tipo de boca. Salidas ('out'): OUT_GATES = 'arco_salida' | 'parrilla_semaforo' |
//                    'tunel_rampa' | 'lanzadera_aros' | 'puente_banderas'. Llegadas ('in'): IN_GATES =
//                    'meta_cuadros' | 'embudo_llegada' | 'portal_llegada' | 'arco_meta' | 'tunel_frenado'.
//                    Nunca coinciden entrada y salida; varían entre caminos (también en way.gates {out, in}
//                    y en segment.gate de la salida/llegada).
//                  approach: { kind: 'parrilla' (recta de salida) | 'recta_meta' (recta final), len (u),
//                    dir (unitario, sale del planeta a lo largo de la recta) }. La recta ocupa los primeros
//                    `len` de la salida (GRID_LEN) o los últimos de la llegada (FINISH_LEN); la puerta va en
//                    la boca (pos) y la meta/semáforo al final de la recta. }
//   destinos[]: los destinos (edificios) de este nodo
//   hop[a][b]:  siguiente vértice del camino más corto a -> b (ver cityPath)
// }
// destino = { idx (global), node, kind: 'puntos'|'energia', name, dp, de, vert, dir (normal), pos }
//   puntos: dp > 0 y de < 0; energia: de > 0 y dp < 0.
//
// circuit = { idx, a, b, theme (THEMES[idx]), ways: [ida a>b, vuelta b>a], mid (punto medio, para rótulos) }
//
// way (un sentido del circuito; es una pequeña red de tubos) = {
//   idx (global), id 'a>b', circuit, from, to, theme, params (PARAMS del tema: silueta),
//   segments[]:  TODOS los tramos del sentido (compartidos y de cada ruta); segments[0] es la salida
//   routes[2-3]: rutas alternativas
//   junctions[3]: { pos, kind: 'fork'|'cross'|'merge' }  uniones compartidas por todas las rutas
//   length (media de las rutas)
// }
//   Topología: salida -> fork -> [ruta r: 3 obstáculos (entrada, evento, salida)] -> cross
//              -> [ruta r: 3 obstáculos (entrada, evento, salida)] -> merge -> llegada.
//   En `fork` y en `cross` la ballita elige ruta, así que puede cambiar de ruta a mitad de circuito.
//
// route = { idx (global), r (local), name 'A'|'B'|'C', way, segments[8] (salida, 6 obstáculos, llegada),
//           kinds[6] (los obstáculos, todos distintos), length,
//           profile: { speed: 'rapida'|'media'|'lenta', thrill: 0..1, label } }
//
// segment = {
//   idx (global), i (índice en way.segments), way, route (r local, o -1 si es compartido),
//   kind (clave de KINDS), name, emoji,
//   curve (THREE.CatmullRomCurve3; curve.getPoint(1) de uno == getPoint(0) de cada `next`),
//   length, radius (radio interior del tubo de cristal),
//   air (true: va por el aire, SIN tubo: trampolin, canon, caida, geiser, erupcion, portal),
//   boost (velocidad mínima con la que sale disparada al entrar), drag (multiplicador de rozamiento),
//   speedK (multiplicador de velocidad del tramo: >1 rápido, <1 lento),
//   event (string con la clave del evento o null),
//   risk (0..1), next[] (índices `i` de los tramos siguientes; [] en la llegada),
//   tramo[] (kinds del medio-recorrido de ruta al que pertenece; lo usa la sim para decidir)
// }
//   Continuidad: posición siempre; tangente también salvo al salir de un tramo `air` o entrar a un embudo.
//   Trazado tipo circuito: los obstáculos de pista (rampa, horquilla, turbina, hielo_resbaloso, pantano,
//   cascada) se componen con piezas (PLANS): rectas largas y curvas de radio constante con entrada y salida
//   de curvatura progresiva (clotoide); ruta rápida = curvas abiertas, lenta = cerradas y con más relieve,
//   espectacular = peraltes fuertes y saltos. Hélices, embudo y rizo entran/salen sin quiebros.
//
// CAMINOS TRENZADOS
// segment.lanes[3-5] = { id estable, roll, width, name }. Los caminos comparten puntas y
// divergen en el tramo abierto. segment._braid conserva sus muestras 3D.
// laneFrame(seg,id,u) -> {pos,road,surface,tangent,up,side,relief,roll} y alias axis/wall/dir/angle.
// laneLength mide el camino; laneCurve devuelve su THREE.Curve.
// switches = {u,uLand,uEnd,apex,from,to,kind,...}; el vuelo entre las anclas lo da switchArc(seg,sw,t).
// El id se conserva entre tramos cuando existe; los cambios de camino ocurren al aterrizar de un arco.
//
// CARRILES Y EVENTOS DE CAMBIO (ruta > camino > carril)
// Cada camino (lane) tiene CARRILES = 5 carriles laterales: carrilLat(c, edge) es su desvío lateral (u) dentro de la
// calzada, de -edge (c = 0) a +edge (c = 4); edge = CARRIL_EDGE para la calzada LANE_W. Cada switch es un EVENTO de un carril:
//   { u, uLand, uEnd, from (camino origen), to (camino destino, siempre otro), carril (0..4, carril origen del evento),
//     kind (CAMBIOS: salto, botado, caida, rampa, portal, elevador, laberinto, o uno temático: geiser, tirolina, erupcion),
//     via (trayectoria: 'arco' | 'caida' | 'elevador' | 'portal' | 'laberinto'), style (= via), apex, duration, ... }
// Todos los carriles de todos los caminos tienen eventos, repartidos a lo largo del tramo abierto. El kind sale de la
// geometría en `u` (caida sólo hacia un camino más bajo, elevador hacia uno más alto, portal si está lejos,
// salto/rampa/botado/laberinto a nivel) y del tema. switchPath(seg, sw, t) -> { pos, tangent, up, vis } recorre la
// trayectoria (vis 0..1: el portal la oculta a mitad de camino). La sim elige carril al azar al entrar a una ruta y
// al aterrizar, y sólo toma los eventos de su carril.
// Helpers: frameAt(curve, u), cityPath(node, a, b), slerpDir(a, b, t, out), mulberry32(seed),
//          wallFrame, laneFrame, laneAngle, laneRelief, reliefSlope, segmentCurvature, nearestLane,
//          lowestLane, angDiff. Constantes: GRID_LEN, FINISH_LEN, OUT_GATES, IN_GATES.
// Catálogos de mecanismos: MECHANISMS (física, riesgo y recompensa), THEME_MECHS (los de cada mini
// mundo, con nombre temático: tronco-rampa, liana-tirolina, erupción...), LANE_NAMES.
// La forma de cada ballita y sus fases están documentadas al inicio de sim.js.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export const WORLD_SCALE = 2.8
export const TUBE_SCALE = 1.8
// Ampliación del mapa (esfera de nodos, panza y arco de los caminos) sin agrandar las pistas: más espacio entre caminos.
export const SIZE_K = 2.8
// Escala uniforme del trazado: TODO lo espacial (nodos, radios, separaciones, anchos, trenzas, rectas, márgenes, alturas y
// pasos de muestreo) se multiplica por TRACK_K; la ballita no (BALL_R fijo). Las holguras en radios de pista quedan como con
// TRACK_K = 1 y la calzada (LANE_W) queda TRACK_K veces más ancha respecto a la ballita: ~6 ballitas de ancho.
export const TRACK_K = 4.7
const TK = TRACK_K
const WS = WORLD_SCALE * TK
export const NODE_R = 8.5 * TK
export const BALL_R = 0.4
export const MIN_GAP_K = 1.5 // huelgo mínimo, en radios de pista, entre caminos de cualquier ruta (fuera de uniones)
const Y = new THREE.Vector3(0, 1, 0)
const X = new THREE.Vector3(1, 0, 0)
const TAU = Math.PI * 2
const PORT_K = 0.22 // separación angular (tan) entre la entrada y la salida de un puerto

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// risk: atractivo para valientes. ecost: multiplicador del gasto de energía al recorrerlo.
// pps: puntos por segundo mientras se rueda (+ regala, - quita).
export const THEMES = [
  { id: 'sombrio', name: 'Camino Sombrío', emoji: '🌑', risk: 0.9, ecost: 1.2, pps: -0.5 },
  { id: 'bosque', name: 'Camino del Bosque', emoji: '🌲', risk: 0.3, ecost: 0.8, pps: 0.2 },
  { id: 'mar', name: 'Camino del Mar', emoji: '🌊', risk: 0.5, ecost: 1.0, pps: 0.1 },
  { id: 'desierto', name: 'Camino del Desierto', emoji: '🌵', risk: 0.6, ecost: 1.5, pps: -0.2 },
  { id: 'hielo', name: 'Camino de Hielo', emoji: '❄️', risk: 0.5, ecost: 0.5, pps: -0.1 },
  { id: 'volcan', name: 'Camino del Volcán', emoji: '🌋', risk: 1.0, ecost: 1.7, pps: 0.6 },
  { id: 'cristal', name: 'Camino de Cristal', emoji: '💎', risk: 0.4, ecost: 0.9, pps: 0.4 },
  { id: 'nubes', name: 'Camino de las Nubes', emoji: '☁️', risk: 0.2, ecost: 0.6, pps: 0 },
  { id: 'neon', name: 'Camino Neón', emoji: '🌃', risk: 0.7, ecost: 1.1, pps: 0.5 },
  { id: 'jardin', name: 'Camino del Jardín', emoji: '🌸', risk: 0.1, ecost: 0.7, pps: 0.15 },
]

// Silueta propia de cada circuito. n: rutas; bow: panza lateral; arch: joroba (+) o valle (-);
// spread: cuánto se abren las rutas entre sí; phase: giro de las rutas alrededor del eje;
// coil: escala de hélices, rizos y embudos; turns: vueltas extra; radius: radio del tubo;
// fav: obstáculos que el tema reparte primero.
const scaleParam = ({ bow, arch, spread, radius, ...rest }) => ({
  ...rest,
  bow: +(bow * WORLD_SCALE * SIZE_K).toFixed(1) * TK,
  arch: +(arch * WORLD_SCALE * SIZE_K).toFixed(1) * TK,
  spread: +(spread * WORLD_SCALE).toFixed(1) * TK,
  radius: +(radius * TUBE_SCALE).toFixed(2) * TK,
})
export const PARAMS = {
  sombrio: scaleParam({ n: 3, bow: 36, arch: -16, spread: 21, phase: 0.4, coil: 0.8, turns: 1, radius: 1.15, fav: ['pantano', 'erupcion', 'caida', 'embudo', 'sacacorchos'] }),
  bosque: scaleParam({ n: 2, bow: 34, arch: 8, spread: 23, phase: 1.2, coil: 1.35, turns: 1, radius: 1.5, fav: ['pantano', 'cascada', 'espiral', 'horquilla', 'rampa'] }),
  mar: scaleParam({ n: 3, bow: 38, arch: 0, spread: 23, phase: 2.2, coil: 1.1, turns: 0, radius: 1.35, fav: ['cascada', 'geiser', 'embudo', 'rizo', 'trampolin'] }),
  desierto: scaleParam({ n: 2, bow: 40, arch: 18, spread: 20, phase: 0, coil: 1, turns: 0, radius: 1.4, fav: ['turbina', 'caida', 'espiral', 'canon', 'rampa'] }),
  hielo: scaleParam({ n: 3, bow: 35, arch: -9, spread: 23, phase: 3, coil: 0.9, turns: 2, radius: 1.2, fav: ['hielo_resbaloso', 'cascada', 'espiral', 'horquilla', 'sacacorchos'] }),
  volcan: scaleParam({ n: 3, bow: 34, arch: 26, spread: 20, phase: 1.6, coil: 1.2, turns: 1, radius: 1.3, fav: ['erupcion', 'canon', 'caida', 'espiral', 'rizo'] }),
  cristal: scaleParam({ n: 2, bow: 37, arch: 6, spread: 21, phase: 0.8, coil: 0.75, turns: 2, radius: 1.1, fav: ['portal', 'hielo_resbaloso', 'espiral', 'embudo', 'sacacorchos'] }),
  nubes: scaleParam({ n: 3, bow: 39, arch: 20, spread: 23, phase: 2.6, coil: 1.3, turns: 0, radius: 1.6, fav: ['geiser', 'turbina', 'embudo', 'caida', 'trampolin'] }),
  neon: scaleParam({ n: 3, bow: 34, arch: 5, spread: 21, phase: 3.6, coil: 1, turns: 1, radius: 1.25, fav: ['portal', 'turbina', 'caida', 'cascada', 'rizo'] }),
  jardin: scaleParam({ n: 2, bow: 34, arch: 11, spread: 23, phase: 1.9, coil: 1.15, turns: 0, radius: 1.45, fav: ['cascada', 'geiser', 'pantano', 'espiral', 'trampolin'] }),
}

// w: cuánta cuerda ocupa. drop: desnivel que necesita (obstáculos de gravedad).
// boost/drag/speedK/event/risk/air: ver el contrato (segment).
export const KINDS = {
  salida: { name: 'Lanzadera', emoji: '🚀', boost: 14, drag: 1, speedK: 1.2, risk: 0.2 },
  llegada: { name: 'Llegada', emoji: '🏁', boost: 0, drag: 1.5, speedK: 0.9, risk: 0 },
  rampa: { name: 'Rampa', emoji: '🛝', w: 1, boost: 0, drag: 1, speedK: 1.05, risk: 0.1 },
  horquilla: { name: 'Horquilla', emoji: '↩️', w: 1.2, boost: 0, drag: 1.2, speedK: 0.85, risk: 0.3 },
  rizo: { name: 'Rizo', emoji: '➰', w: 1.1, boost: 17, drag: 0.6, speedK: 1.3, risk: 0.8 },
  sacacorchos: { name: 'Sacacorchos', emoji: '🧬', w: 1.1, boost: 11, drag: 1, speedK: 1.1, risk: 0.5 },
  trampolin: { name: 'Trampolín', emoji: '🤸', w: 1.2, boost: 15, drag: 0, speedK: 1.25, risk: 0.7, air: true },
  canon: { name: 'Cañón', emoji: '💥', w: 1.6, boost: 30, drag: 0, speedK: 1.55, risk: 1, air: true },
  turbina: { name: 'Turbina', emoji: '💨', w: 1.3, boost: 21, drag: 0.5, speedK: 1.35, risk: 0.6, event: true },
  hielo_resbaloso: { name: 'Hielo resbaloso', emoji: '🧊', w: 1.5, boost: 12, drag: 0.15, speedK: 1.65, risk: 0.45, event: true },
  pantano: { name: 'Pantano', emoji: '🫧', w: 1.3, boost: 0, drag: 3.2, speedK: 0.52, risk: 0.2, event: true },
  portal: { name: 'Portal', emoji: '🌀', w: 0.95, boost: 34, drag: 0, speedK: 2.0, risk: 0.65, air: true, event: true },
  geiser: { name: 'Géiser', emoji: '⛲', w: 1.3, boost: 25, drag: 0, speedK: 1.35, risk: 0.75, air: true, event: true },
  erupcion: { name: 'Erupción', emoji: '🌋', w: 1.4, boost: 31, drag: 0, speedK: 1.45, risk: 0.95, air: true, event: true },
  espiral: { name: 'Espiral', emoji: '🌀', w: 0.9, boost: 0, drag: 0.8, speedK: 1.0, risk: 0.5, drop: 12 * WS },
  caida: { name: 'Caída libre', emoji: '🪂', w: 0.75, boost: 0, drag: 0, speedK: 1.45, risk: 0.9, drop: 13 * WS, air: true },
  cascada: { name: 'Cascada', emoji: '🪜', w: 1.2, boost: 0, drag: 1.1, speedK: 1.15, risk: 0.4, drop: 10 * WS, event: true },
  embudo: { name: 'Embudo', emoji: '🌪️', w: 0.85, boost: 0, drag: 4, speedK: 0.65, risk: 0.5, drop: 9 * WS },
}
// Mecanismos que cambian de carril. style: salto (vuelo por el interior), pared (rueda pegada),
// portal (teletransporte corto). dur: segundos base. fail: probabilidad base de fallar (cae al
// carril más bajo). reward: puntos/energía al completarlo. boost: multiplicador de velocidad.
export const MECHANISMS = {
  rampa: { name: 'Rampa', emoji: '🛝', style: 'salto', dur: 0.9, risk: 0.2, fail: 0.04, reward: { p: 0.8, e: -0.3 }, boost: 1.05 },
  trampolin: { name: 'Trampolín', emoji: '🤸', style: 'salto', dur: 1.0, risk: 0.45, fail: 0.08, reward: { p: 1.8, e: -0.6 }, boost: 1.1 },
  turbina: { name: 'Turbina', emoji: '💨', style: 'salto', dur: 1.1, risk: 0.5, fail: 0.1, reward: { p: 2, e: -0.8 }, boost: 1.15 },
  portal: { name: 'Portal', emoji: '🌀', style: 'portal', dur: 0.6, risk: 0.55, fail: 0.12, reward: { p: 3, e: -1 }, boost: 1.2 },
  iman: { name: 'Imán', emoji: '🧲', style: 'pared', dur: 1.2, risk: 0.15, fail: 0.03, reward: { p: 0.6, e: 0 }, boost: 1 },
  bumper: { name: 'Bumper', emoji: '🔴', style: 'salto', dur: 0.6, risk: 0.6, fail: 0.15, reward: { p: 2.4, e: -0.5 }, boost: 1.05 },
  resorte: { name: 'Resorte', emoji: '🌀', style: 'salto', dur: 0.8, risk: 0.35, fail: 0.07, reward: { p: 1.2, e: -0.3 }, boost: 1.08 },
  remolino: { name: 'Remolino', emoji: '🌪️', style: 'pared', dur: 1.5, risk: 0.4, fail: 0.08, reward: { p: 1.2, e: 0.3 }, boost: 0.95 },
  erupcion: { name: 'Erupción', emoji: '🌋', style: 'salto', dur: 1.3, risk: 0.9, fail: 0.22, reward: { p: 4, e: -1.5 }, boost: 1.25 },
  geiser: { name: 'Géiser', emoji: '⛲', style: 'salto', dur: 1.1, risk: 0.7, fail: 0.16, reward: { p: 3, e: -1 }, boost: 1.18 },
  cinta: { name: 'Cinta transportadora', emoji: '➿', style: 'pared', dur: 1.6, risk: 0.05, fail: 0.01, reward: { p: 0.3, e: 1.2 }, boost: 1 },
  tirolina: { name: 'Tirolina', emoji: '🪢', style: 'salto', dur: 1.5, risk: 0.5, fail: 0.1, reward: { p: 2.2, e: 0 }, boost: 1.1 },
  cascada: { name: 'Cascada', emoji: '🪜', style: 'pared', dur: 1.2, risk: 0.35, fail: 0.06, reward: { p: 1.2, e: 0.6 }, boost: 1.05 },
  pantano: { name: 'Pantano', emoji: '🫧', style: 'pared', dur: 2.0, risk: 0.15, fail: 0.04, reward: { p: 0.3, e: 1.5 }, boost: 0.85 },
  hielo_resbaloso: { name: 'Hielo resbaloso', emoji: '🧊', style: 'pared', dur: 0.9, risk: 0.45, fail: 0.1, reward: { p: 1.8, e: -0.3 }, boost: 1.12 },
  canon: { name: 'Cañón', emoji: '💥', style: 'salto', dur: 0.9, risk: 0.95, fail: 0.2, reward: { p: 3.6, e: -1.2 }, boost: 1.25 },
  caida: { name: 'Caída', emoji: '🕳️', style: 'caida', dur: 1.0, risk: 0.8, fail: 0.18, reward: { p: 2.6, e: -0.5 }, boost: 1.1 },
  arbol: { name: 'Árbol puente', emoji: '🌳', style: 'salto', dur: 1.1, risk: 0.3, fail: 0.05, reward: { p: 1.1, e: 0.2 }, boost: 1.05 },
  viento: { name: 'Ráfaga de viento', emoji: '💨', style: 'salto', dur: 0.9, risk: 0.4, fail: 0.08, reward: { p: 1.4, e: -0.1 }, boost: 1.1 },
  salto: { name: 'Salto', emoji: '🦘', style: 'arco', dur: 1.0, risk: 0.4, fail: 0.07, reward: { p: 1.4, e: -0.4 }, boost: 1.08 },
  botado: { name: 'Botado', emoji: '🏀', style: 'arco', dur: 1.15, risk: 0.5, fail: 0.09, reward: { p: 1.8, e: -0.3 }, boost: 1.1 },
  elevador: { name: 'Elevador', emoji: '🛗', style: 'elevador', dur: 1.8, risk: 0.1, fail: 0.02, reward: { p: 0.6, e: 0.4 }, boost: 1 },
  laberinto: { name: 'Laberinto', emoji: '🌀', style: 'laberinto', dur: 2.8, risk: 0.25, fail: 0.04, reward: { p: 2, e: -0.6 }, boost: 0.95 },
}
// Catálogo de eventos de cambio de camino por carril y su trayectoria (switchPath).
export const CARRILES = 5
export const CAMBIOS = { salto: 'arco', botado: 'arco', rampa: 'arco', caida: 'caida', portal: 'portal', elevador: 'elevador', laberinto: 'laberinto', geiser: 'arco', erupcion: 'arco', tirolina: 'arco' }
// Cambios temáticos que se suman a los de geometría: arriba (lanzadores), abajo (descensos), nivel.
const THEME_CAMBIOS = {
  mar: { arriba: ['geiser'] }, volcan: { arriba: ['erupcion'] }, jardin: { arriba: ['geiser'], abajo: ['tirolina'] },
  bosque: { abajo: ['tirolina'] }, nubes: { abajo: ['tirolina'] },
  cristal: { nivel: ['portal'] }, neon: { nivel: ['portal'] }, sombrio: { nivel: ['portal'] },
}
// Mecanismos propios del paisaje de cada mini mundo (clave -> nombre temático).
export const THEME_MECHS = {
  sombrio: { iman: 'Imán de sombras', remolino: 'Remolino umbrío', portal: 'Grieta-portal' },
  bosque: { rampa: 'Tronco-rampa', tirolina: 'Liana-tirolina', resorte: 'Hongo-resorte', arbol: 'Puente de árbol' },
  mar: { remolino: 'Remolino marino', geiser: 'Chorro de ballena', cinta: 'Corriente marina', viento: 'Viento de cola' },
  desierto: { turbina: 'Tolvanera', rampa: 'Duna-rampa', resorte: 'Cactus-resorte', viento: 'Viento del desierto' },
  hielo: { rampa: 'Ventisquero', cinta: 'Glaciar deslizante', bumper: 'Carámbano-bumper' },
  volcan: { erupcion: 'Erupción', geiser: 'Fumarola', rampa: 'Colada-rampa' },
  cristal: { portal: 'Prisma-portal', iman: 'Imán de cuarzo', bumper: 'Geoda-bumper' },
  nubes: { turbina: 'Ráfaga', trampolin: 'Nube-trampolín', tirolina: 'Arcoíris-tirolina', viento: 'Corriente de aire' },
  neon: { bumper: 'Bumper neón', portal: 'Portal neón', cinta: 'Cinta láser' },
  jardin: { resorte: 'Flor-resorte', tirolina: 'Enredadera', trampolin: 'Nenúfar-trampolín', arbol: 'Rama puente' },
}
export const LANE_NAMES = ['suelo', 'pared derecha', 'techo', 'pared izquierda', 'espiral']

const FLEX = ['rampa', 'horquilla', 'rizo', 'sacacorchos', 'trampolin', 'canon', 'turbina', 'hielo_resbaloso', 'pantano', 'portal', 'geiser', 'erupcion'] // unen dos puntos cualesquiera
const GRAV = ['espiral', 'caida', 'cascada', 'embudo'] // necesitan bajar
// Orden de los genes `kinds` del genoma.
export const OBSTACLES = [...FLEX, ...GRAV]

const DEST_NAMES = {
  puntos: ['Arcade', 'Torneo', 'Mercado', 'Galería', 'Concurso', 'Subasta', 'Carrera', 'Feria'],
  energia: ['Fuente', 'Siesta', 'Banquete', 'Spa', 'Hamaca', 'Hoguera', 'Manantial', 'Picnic'],
}

// Los nodos viven sobre una esfera grande centrada en el origen; su radio crece con el número de nodos.
const NODE_DEFS = [
  { name: 'Eco', color: '#c77dff', n: 8, bias: 0.5 },
  { name: 'Cima', color: '#6bcb77', n: 3, bias: 0.35 },
  { name: 'Delta', color: '#4d96ff', n: 5, bias: 0.5 },
  { name: 'Alba', color: '#ffb347', n: 4, bias: 0.5 },
  { name: 'Brasa', color: '#ff6b6b', n: 6, bias: 0.65 },
]
export const SPHERE_R = 52 * WS * Math.sqrt(NODE_DEFS.length) * SIZE_K

// Direcciones unitarias repartidas por Fibonacci y relajadas por repulsión (sin pares antípodas exactos).
function sphereDirs(n) {
  const d = Array.from({ length: n }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / n; const r = Math.sqrt(1 - y * y); const a = i * Math.PI * (3 - Math.sqrt(5)) + 0.7
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
  })
  for (let it = 0; it < 60; it++) {
    const f = d.map((p, i) => d.reduce((s, q, j) => (i === j ? s : s.addScaledVector(p.clone().sub(q), 1 / Math.pow(p.distanceTo(q), 3))), new THREE.Vector3()))
    d.forEach((p, i) => p.addScaledVector(f[i], 0.02).normalize())
  }
  // un giro fijo evita pares polares alineados con la gravedad
  return d.map((p) => p.applyAxisAngle(X, 0.5).applyAxisAngle(Y, 0.3))
}

const ri = (rng, a, b) => Math.round(a + rng() * (b - a))
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const shuffle = (arr, rng) => {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]] }
  return arr
}

// Interpolación esférica entre dos direcciones unitarias.
export function slerpDir(a, b, t, out = new THREE.Vector3()) {
  const w = a.angleTo(b)
  if (w < 1e-4) return out.copy(a)
  const s = Math.sin(w)
  const ka = Math.sin((1 - t) * w) / s
  return out.copy(a).multiplyScalar(ka).addScaledVector(b, Math.sin(t * w) / s)
}

// Vértices (índices) del camino más corto por carretera entre dos vértices de un nodo.
export function cityPath(node, a, b) {
  const path = [a]
  while (a !== b) { a = node.hop[a][b]; path.push(a) }
  return path
}

// Marco local de un punto de una curva: T avance, N lateral, B "arriba". Es sin estado: en tramos
// verticales o rizos B salta; para barrer sin torsión usa curve.computeFrenetFrames(n).
export function frameAt(curve, u, out = {}) {
  const T = curve.getTangentAt(u)
  const N = new THREE.Vector3().crossVectors(Math.abs(T.y) > 0.98 ? X : Y, T).normalize()
  out.P = curve.getPointAt(u); out.T = T; out.N = N; out.B = new THREE.Vector3().crossVectors(T, N)
  return out
}

// ───────────────────────── carriles: marcos sobre la pared ─────────────────────────
const wrapAng = (a) => ((a % TAU) + TAU) % TAU
// diferencia angular más corta de a hacia b, en (-π, π]
export function angDiff(a, b) {
  let d = (b - a) % TAU
  if (d > Math.PI) d -= TAU
  if (d <= -Math.PI) d += TAU
  return d
}

// "Suelo" canónico de una sección: la gravedad del mundo proyectada en el plano normal a T.
function canonDown(T, out = new THREE.Vector3()) {
  out.set(0, -1, 0).addScaledVector(T, T.y)
  if (out.lengthSq() < 0.02) out.set(1, 0, 0).addScaledVector(T, -T.x)
  return out.normalize()
}

// Transporte paralelo a lo largo de una cadena de tramos contiguos. D (dirección eje->suelo) parte del
// suelo canónico; si `pinEnd`, la torsión residual se reparte por longitud para acabar también en el
// suelo canónico (así todas las rutas coinciden en las uniones). Resultado en seg._fr = { n, D }.
const FRAME_TMP = new THREE.Vector3()
function sampleChain(segs, pinEnd) {
  const q = new THREE.Quaternion()
  const T = new THREE.Vector3(); const Tprev = new THREE.Vector3()
  const D = new THREE.Vector3(); let hasPrev = false; let total = 0
  const data = []
  for (const s of segs) {
    // El transporte discreto pierde la torsión de curvas muy cerradas si se muestrea
    // cada 0.25 unidades; el marco se cachea en el tramo.
    const n = clamp(Math.ceil(s.length / (0.25 * TK)), 24, 2000)
    const Ts = new Float32Array((n + 1) * 3); const Ds = new Float32Array((n + 1) * 3)
    for (let i = 0; i <= n; i++) {
      const t = s.curve.getUtoTmapping(i / n)
      s.curve.getTangent(t, T)
      if (!hasPrev) { canonDown(T, D); hasPrev = true }
      else { q.setFromUnitVectors(Tprev, T); D.applyQuaternion(q) }
      D.addScaledVector(T, -D.dot(T))
      if (D.lengthSq() < 1e-8) canonDown(T, D)
      D.normalize()
      Ts[i * 3] = T.x; Ts[i * 3 + 1] = T.y; Ts[i * 3 + 2] = T.z
      Ds[i * 3] = D.x; Ds[i * 3 + 1] = D.y; Ds[i * 3 + 2] = D.z
      Tprev.copy(T)
    }
    data.push({ s, n, Ts, Ds, start: total }); total += s.length
  }
  if (pinEnd && total > 0) {
    const C = canonDown(Tprev)
    const phi = Math.atan2(Tprev.dot(new THREE.Vector3().crossVectors(D, C)), D.dot(C))
    const T = new THREE.Vector3(); const d = new THREE.Vector3()
    for (const { s, n, Ts, Ds, start } of data) {
      for (let i = 0; i <= n; i++) {
        T.fromArray(Ts, i * 3); d.fromArray(Ds, i * 3)
        d.applyAxisAngle(T, (phi * (start + (s.length * i) / n)) / total)
        Ds[i * 3] = d.x; Ds[i * 3 + 1] = d.y; Ds[i * 3 + 2] = d.z
      }
    }
  }
  for (const { s, n, Ts, Ds } of data) s._fr = { n, T: Ts, D: Ds, arcLengths: s.curve.getLengths() }
}
const ensureFrames = (seg) => { if (!seg._fr) sampleChain([seg], false) }

// Equivalente a Curve.getUtoTmapping sobre la caché ya calculada, sin asignaciones.
function arcParamAt(fr, u) {
  const lengths = fr.arcLengths; const last = lengths.length - 1
  if (last <= 0 || !Number.isFinite(u)) return 0
  const target = clamp(u, 0, 1) * lengths[last]
  let low = 0; let high = last
  while (low <= high) {
    const i = Math.floor(low + (high - low) / 2)
    if (lengths[i] < target) low = i + 1
    else if (lengths[i] > target) high = i - 1
    else return i / last
  }
  const before = lengths[high]; const after = lengths[low]
  const fraction = after > before ? (target - before) / (after - before) : 0
  return (high + fraction) / last
}

// Marco sobre la pared a ángulo `angle` y avance `u`. Ver el contrato al inicio del archivo.
export function wallFrame(seg, angle, u, rho = seg.air ? 0 : seg.radius - BALL_R, out = {}) {
  ensureFrames(seg)
  u = Number.isFinite(u) ? clamp(u, 0, 1) : 0
  const fr = seg._fr; const f = u * fr.n; const i = Math.min(fr.n - 1, Math.floor(f)); const k = f - i; const A = fr.D
  const T = out.tangent || (out.tangent = new THREE.Vector3())
  T.fromArray(fr.T, i * 3); FRAME_TMP.fromArray(fr.T, (i + 1) * 3); T.lerp(FRAME_TMP, k).normalize()
  const w = out.dir || (out.dir = new THREE.Vector3())
  w.set(
    A[i * 3] + (A[i * 3 + 3] - A[i * 3]) * k,
    A[i * 3 + 1] + (A[i * 3 + 4] - A[i * 3 + 1]) * k,
    A[i * 3 + 2] + (A[i * 3 + 5] - A[i * 3 + 2]) * k,
  )
  w.addScaledVector(T, -w.dot(T))
  if (w.lengthSq() < 1e-8) canonDown(T, w)
  w.normalize().applyAxisAngle(T, angle)
  const axis = out.axis || (out.axis = new THREE.Vector3())
  const curveU = arcParamAt(fr, u)
  seg.curve.getPoint(curveU, axis)
  out.axis = axis; out.dir = w; out.angle = angle; out.tangent = T
  out.pos = (out.pos || new THREE.Vector3()).copy(axis).addScaledVector(w, rho)
  out.wall = (out.wall || new THREE.Vector3()).copy(axis).addScaledVector(w, seg.radius)
  out.up = (out.up || new THREE.Vector3()).copy(w).negate()
  out.side = (out.side || new THREE.Vector3()).crossVectors(T, out.up).normalize()
  return out
}

// Tangente de la tabla cacheada del tramo. Evita getTangentAt (que vuelve a mapear
// la longitud de arco en cada llamada) durante la simulación.
export function segmentTangent(seg, u, out = new THREE.Vector3()) {
  ensureFrames(seg)
  const fr = seg._fr
  const f = clamp(u, 0, 1) * fr.n
  const i = Math.min(fr.n - 1, Math.floor(f)); const k = f - i; const j = i * 3
  return out.set(
    fr.T[j] + (fr.T[j + 3] - fr.T[j]) * k,
    fr.T[j + 1] + (fr.T[j + 4] - fr.T[j + 1]) * k,
    fr.T[j + 2] + (fr.T[j + 5] - fr.T[j + 2]) * k,
  ).normalize()
}

const laneOf = (seg, id) => seg.lanes?.find((l) => l.id === id) || seg.lanes?.[0] || null
const lerpArr = (arr, u) => {
  const n = arr.length - 1; const f = clamp(Number.isFinite(u) ? u : 0, 0, 1) * n; const i = Math.min(n - 1, Math.floor(f))
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i)
}

// ───────────────────────── caminos trenzados ─────────────────────────
// ancho de calzada de cada camino: 1.04 u con TRACK_K = 1 (1.3 ballitas); escala con el trazado, no con la ballita
export const LANE_W = +(0.4 * 2.6).toFixed(2) * TK
// Semiancho útil de la calzada para el centro de la ballita y desvío lateral (u) del carril c (0..CARRILES-1).
export const CARRIL_EDGE = LANE_W / 2 - BALL_R * 0.85
export const carrilLat = (c, edge = CARRIL_EDGE) => ((clamp(c, 0, CARRILES - 1) / (CARRILES - 1)) - 0.5) * 2 * edge
export const BRAID_A = 5.2 * TK // separación nominal (u) de cada camino respecto al central en el tramo abierto
const BRAID_PAD = 4.5 * TK // holgura del envolvente para ancho de pista, ballita y arcos
const BRAID_OPEN = 16 * TK // retardo (u) extra antes de abrir la trenza en las rectas de parrilla/meta
const BRAID_RAMP = 18 * TK // largo (u) de la apertura/cierre de la trenza en cada punta del tramo
export const ROLL_KINDS = ['plano', 'cabeza', 'lado_der', 'lado_izq', 'tirabuzon', 'tirabuzon_inv']

// Apertura de la trenza en `u` (0 en las puntas y en las rectas de parrilla/meta, 1 con los caminos abiertos).
// Sólo depende del largo y del tipo de tramo: la búsqueda de huecos la usa antes de construir los caminos.
export function braidEnv(seg, u, hubs = true) {
  const L = seg.length; const x = clamp(Number.isFinite(u) ? u : 0, 0, 1) * L
  const [a, b] = braidDelay(seg, hubs)
  const r = Math.max(4 * TK, Math.min(hubs ? OPEN_RAMP : BRAID_RAMP, (L - a - b) * 0.3))
  return smooth01((x - a) / r) * smooth01((L - b - x) / r)
}
// Largo (u) en cada punta del tramo donde los carriles van juntos (una sola calzada) antes de abrirse la trenza. Los
// carriles reales se abren en abanico poco después de la punta (NODE_OPEN junto al nodo, HUB_OPEN junto a una unión
// fork/cross/merge, rampa OPEN_RAMP): así las cintas que nacen juntas se separan antes de JOINT_MAX. hubs = false da el
// envolvente de la búsqueda de huecos (braidRadius, routeExtent), que conserva la apertura tardía de siempre
// (parrilla/meta + BRAID_OPEN): las elecciones del reparto no cambian y el envolvente queda del lado holgado.
const NODE_OPEN = 8 * TK
const HUB_OPEN = 6 * TK
const OPEN_RAMP = 16 * TK
export function braidDelay(seg, hubs = true) {
  if (!hubs) return [seg.kind === 'salida' ? GRID_LEN + 2 * TK + BRAID_OPEN : 0, seg.kind === 'llegada' ? FINISH_LEN + 2 * TK + BRAID_OPEN : 0]
  return [seg.kind === 'salida' ? NODE_OPEN : seg.hubA ? HUB_OPEN : 0, seg.kind === 'llegada' ? NODE_OPEN : seg.hubB ? HUB_OPEN : 0]
}
// Radio del envolvente de la trenza alrededor del eje (para separar pistas distintas; la búsqueda de huecos no cuenta
// HUB_OPEN, así sus elecciones no cambian y el envolvente queda del lado holgado).
export const braidRadius = (seg, u) => Math.max(seg.radius, BRAID_A * braidEnv(seg, u, false) + BRAID_PAD)

// Giro propio (rad) del camino alrededor de su avance; 0 (mod 2π) en las puntas.
function rollAt(seg, lane, u) {
  if (!lane || lane.roll === 'plano' || !seg._braid) return 0
  const e = braidEnv(seg, u)
  if (lane.roll === 'cabeza') return Math.PI * e
  if (lane.roll === 'lado_der') return (Math.PI / 2) * e
  if (lane.roll === 'lado_izq') return (-Math.PI / 2) * e
  const [a, b] = seg._braid.full
  return (lane.roll === 'tirabuzon' ? 1 : -1) * TAU * smooth01((clamp(u, 0, 1) - a) / (b - a))
}
export const laneRoll = (seg, laneId, u) => rollAt(seg, laneOf(seg, laneId), u)

// Ángulo de la superficie del camino (convención de wallFrame: 0 = suelo, π = de cabeza): giro propio + peralte.
export function laneAngle(seg, laneId, u) {
  const l = laneOf(seg, laneId)
  if (!l) return 0
  const a = rollAt(seg, l, u)
  const bk = seg._bank
  if (!bk) return a
  const x = lerpArr(bk.x, u); const y = lerpArr(bk.y, u); const m = Math.hypot(x, y)
  return m < 1e-6 ? a : a + m * Math.sin(angDiff(a, Math.atan2(y, x)))
}
// Altura del relieve del carril (unidades de mundo, de la pared hacia el eje) en `u`. 0 en los extremos.
export function laneRelief(seg, laneId, u) {
  const arr = seg._relief?.h.get(laneOf(seg, laneId)?.id)
  return arr ? lerpArr(arr, u) : 0
}
// Pendiente del relieve: d(altura)/d(longitud de arco).
export function reliefSlope(seg, laneId, u) {
  const r = seg._relief; const arr = r?.h.get(laneOf(seg, laneId)?.id)
  if (!arr) return 0
  const f = clamp(Number.isFinite(u) ? u : 0, 0, 1) * r.n; const i = Math.min(r.n - 1, Math.floor(f))
  return ((arr[i + 1] - arr[i]) * r.n) / seg.length
}
// Curvatura del eje en `u`: k (1/u) y `out`, ángulo (convención de carriles) que apunta hacia fuera de la curva.
export function segmentCurvature(seg, u) {
  const c = seg._curv
  if (!c) return { k: 0, out: 0 }
  const x = lerpArr(c.x, u); const y = lerpArr(c.y, u)
  return { k: Math.hypot(x, y), out: Math.atan2(-y, -x) }
}
// Centro del camino (sin relieve) en `u`, interpolado de las muestras de la trenza.
function roadAt(seg, laneId, u, out) {
  const br = seg._braid
  if (!br) return out.copy(wallFrame(seg, 0, u, 0, LF_W).axis)
  const P = br.P[laneOf(seg, laneId)?.id ?? 0] || br.P[0]
  const f = clamp(Number.isFinite(u) ? u : 0, 0, 1) * br.N; const i = Math.min(br.N - 1, Math.floor(f)); const k = f - i; const j = i * 3
  return out.set(P[j] + (P[j + 3] - P[j]) * k, P[j + 1] + (P[j + 4] - P[j + 1]) * k, P[j + 2] + (P[j + 5] - P[j + 2]) * k)
}
const LF_W = {}; const LF_P0 = new THREE.Vector3(); const LF_P1 = new THREE.Vector3()
// Punto de la superficie (relieve incluido) y normal cruda (`up`, sin ortogonalizar) del camino en `u`.
function surfAt(seg, laneId, u, out, up) {
  const d = wallFrame(seg, laneAngle(seg, laneId, u), u, 0, LF_W).dir
  if (up) up.copy(d).negate()
  roadAt(seg, laneId, u, out)
  return seg.air ? out : out.addScaledVector(d, -laneRelief(seg, laneId, u))
}
// Marco del camino `laneId` en `u` (ver el contrato al inicio del archivo).
export function laneFrame(seg, laneId, u, out = {}) {
  u = Number.isFinite(u) ? clamp(u, 0, 1) : 0
  const up = out.up || (out.up = new THREE.Vector3())
  const surface = out.surface || (out.surface = new THREE.Vector3())
  surfAt(seg, laneId, u, surface, up)
  const road = out.road || (out.road = new THREE.Vector3())
  roadAt(seg, laneId, u, road)
  // tangente y normal reales de la superficie (relieve, trenza, giro y peralte incluidos)
  const du = Math.min(0.01, (0.4 * TK) / seg.length); const u0 = Math.max(0, u - du); const u1 = Math.min(1, u + du)
  const T = out.tangent || (out.tangent = new THREE.Vector3())
  T.subVectors(surfAt(seg, laneId, u1, LF_P1), surfAt(seg, laneId, u0, LF_P0))
  if (T.lengthSq() > 1e-12) T.normalize(); else segmentTangent(seg, u, T)
  up.addScaledVector(T, -up.dot(T))
  if (up.lengthSq() < 1e-10) canonDown(T, up).negate()
  up.normalize()
  out.side = (out.side || new THREE.Vector3()).crossVectors(T, up).normalize()
  out.pos = (out.pos || new THREE.Vector3()).copy(surface).addScaledVector(up, BALL_R)
  // alias del contrato viejo (tubo): axis = centro del camino, wall = superficie, dir = hacia la superficie
  out.axis = road; out.wall = surface; out.dir = (out.dir || new THREE.Vector3()).copy(up).negate()
  out.angle = laneAngle(seg, laneId, u); out.roll = laneRoll(seg, laneId, u)
  out.lane = laneOf(seg, laneId)
  out.relief = seg.air ? 0 : laneRelief(seg, laneId, u)
  return out
}
// Largo (u de mundo) del camino `laneId` del tramo (sin relieve).
export function laneLength(seg, laneId) {
  const br = seg._braid
  if (!br) return seg.length
  const id = laneOf(seg, laneId)?.id ?? 0
  if (br.len[id] == null) {
    const P = br.P[id]; let s = 0
    for (let i = 1; i <= br.N; i++) s += Math.hypot(P[i * 3] - P[i * 3 - 3], P[i * 3 + 1] - P[i * 3 - 2], P[i * 3 + 2] - P[i * 3 - 1])
    br.len[id] = s
  }
  return br.len[id]
}
// Curva (THREE.Curve) de la superficie del camino: getPoint(t) = laneFrame(seg, laneId, t).surface (t = `u` del
// tramo, no longitud de arco del camino; getPointAt sí reparte por longitud). Cacheada por tramo y camino.
class LaneCurve extends THREE.Curve {
  constructor(seg, id) { super(); this.seg = seg; this.id = id; this.f = {}; this.arcLengthDivisions = clamp(Math.ceil(laneLength(seg, id) / TK), 50, 1000) }
  getPoint(t, out = new THREE.Vector3()) { return out.copy(laneFrame(this.seg, this.id, t, this.f).surface) }
}
export function laneCurve(seg, laneId) {
  const id = laneOf(seg, laneId)?.id ?? 0
  const c = seg._braid?.curves || (seg._braid ? (seg._braid.curves = []) : [])
  return c[id] || (c[id] = new LaneCurve(seg, id))
}

// Arco balístico de un evento de intercambio: Bézier cúbica que despega por la normal del camino origen en
// sw.u y aterriza por la normal del destino en sw.uLand (llega desde su lado "arriba"). t 0..1.
const ARC_A = {}; const ARC_B = {}
function arcCtrl(seg, sw) {
  const A = laneFrame(seg, sw.from, sw.u, ARC_A); const B = laneFrame(seg, sw.to, sw.uLand, ARC_B)
  const p0 = A.pos.clone().addScaledVector(A.side, sw.carril != null ? carrilLat(sw.carril) : 0) // despega desde su carril
  const d = p0.distanceTo(B.pos); const h = sw.apex
  return {
    p0, p3: B.pos.clone(), u0: A.up.clone(), u1: B.up.clone(), s0: A.side.clone(), t0: A.tangent.clone(), t1: B.tangent.clone(),
    p1: p0.clone().addScaledVector(A.up, h).addScaledVector(A.tangent, d * 0.3),
    p2: B.pos.clone().addScaledVector(B.up, h).addScaledVector(B.tangent, -d * 0.3),
  }
}
// Trayectoria de un evento según su `via` (ver el contrato): arco balístico (switchArc), caída libre (avance constante y
// descenso acelerado), elevador (sube vertical y luego entra al camino), portal (desaparece y aparece, sin arco) y
// laberinto (avance lento en zigzag lateral hasta el destino). t 0..1 -> { pos, tangent, up, vis }.
const SP_A = new THREE.Vector3(); const SP_B = new THREE.Vector3(); const SP_D = new THREE.Vector3(); const SP_V = new THREE.Vector3()
function pathPos(c, via, t, out) {
  const D = SP_D.subVectors(c.p3, c.p0); const V = SP_V.copy(Y).multiplyScalar(D.y); D.sub(V) // D: horizontal, V: vertical
  if (via === 'caida') return out.copy(c.p0).addScaledVector(D, t).addScaledVector(V, t * t)
  if (via === 'elevador') return out.copy(c.p0).addScaledVector(V, smooth01(t / 0.65)).addScaledVector(D, smooth01((t - 0.55) / 0.45))
  if (via === 'portal') return t < 0.5 ? out.copy(c.p0).addScaledVector(c.t0, t * 2 * TK) : out.copy(c.p3).addScaledVector(c.t1, (t - 1) * 2 * TK)
  // laberinto: pasillos en zigzag (onda triangular lateral) que se cierran al llegar
  const tri = 1 - 4 * Math.abs(((t * 3 + 0.25) % 1) - 0.5)
  return out.copy(c.p0).addScaledVector(D, smooth01(t)).addScaledVector(V, smooth01(t)).addScaledVector(c.s0, tri * 1.1 * TK * Math.sin(Math.PI * t))
}
export function switchPath(seg, sw, t, out = {}) {
  const via = sw.via || 'arco'
  if (via === 'arco') { switchArc(seg, sw, t, out); out.vis = 1; return out }
  const c = sw._arc || (sw._arc = arcCtrl(seg, sw))
  t = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  const pos = pathPos(c, via, t, out.pos || (out.pos = new THREE.Vector3()))
  const T = out.tangent || (out.tangent = new THREE.Vector3())
  if (via === 'portal') T.copy(t < 0.5 ? c.t0 : c.t1)
  else {
    T.subVectors(pathPos(c, via, Math.min(1, t + 0.01), SP_B), pathPos(c, via, Math.max(0, t - 0.01), SP_A))
    if (T.lengthSq() < 1e-10) T.copy(c.t0)
    T.normalize()
  }
  const up = out.up || (out.up = new THREE.Vector3())
  up.copy(c.u0).lerp(c.u1, via === 'portal' ? (t < 0.5 ? 0 : 1) : smooth01(t)).addScaledVector(T, -up.dot(T))
  if (up.lengthSq() < 1e-8) up.copy(c.u1)
  up.normalize()
  out.vis = via === 'portal' ? clamp(Math.abs(t - 0.5) / 0.18, 0, 1) : 1
  return out
}
// Parábola balística (gravedad -Y): avance lineal de p0 a p3 más una joroba vertical de altura sw.apex; el botado da
// un bote grande y otro chico (rebota en el rebotante a 60 % del vuelo).
const arcLift = (bote, t) => bote ? (t < 0.6 ? 4 * (t / 0.6) * (1 - t / 0.6) : 1.4 * ((t - 0.6) / 0.4) * (1 - (t - 0.6) / 0.4)) : 4 * t * (1 - t)
const arcLiftD = (bote, t) => bote ? (t < 0.6 ? (4 / 0.6) * (1 - (2 * t) / 0.6) : (1.4 / 0.4) * (1 - (2 * (t - 0.6)) / 0.4)) : 4 * (1 - 2 * t)
export function switchArc(seg, sw, t, out = {}) {
  const c = sw._arc || (sw._arc = arcCtrl(seg, sw))
  t = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  const bote = sw.kind === 'botado'
  const pos = out.pos || (out.pos = new THREE.Vector3())
  pos.copy(c.p0).lerp(c.p3, t).addScaledVector(Y, sw.apex * arcLift(bote, t))
  const T = out.tangent || (out.tangent = new THREE.Vector3())
  T.subVectors(c.p3, c.p0).addScaledVector(Y, sw.apex * arcLiftD(bote, t))
  if (T.lengthSq() < 1e-10) T.copy(c.t0)
  T.normalize()
  const up = out.up || (out.up = new THREE.Vector3())
  up.copy(c.u0).lerp(c.u1, smooth01(t)).addScaledVector(T, -up.dot(T))
  if (up.lengthSq() < 1e-8) up.copy(c.u1)
  up.normalize()
  return out
}
// Camino del tramo más cercano a un ángulo (contrato viejo; los caminos ya no son ángulos de un tubo).
export function nearestLane(seg, angle) {
  let best = 0; let bd = Infinity
  for (const l of seg.lanes || []) {
    const d = Math.abs(angDiff(angle, l.angle))
    if (d < bd) { bd = d; best = l.id }
  }
  return best
}
// Carril físicamente más bajo (respecto a la gravedad del mundo) en `u`: ahí cae si un mecanismo falla.
export function lowestLane(seg, u) {
  let best = 0; let bd = -Infinity
  for (const l of seg.lanes || []) {
    const d = -wallFrame(seg, laneAngle(seg, l.id, u), u, 0).dir.y
    if (d > bd) { bd = d; best = l.id }
  }
  return best
}

// ───────────────────────── relieve y peralte de los carriles ─────────────────────────
const ROLES = ['rapida', 'lenta', 'media']
const BANK_GAIN = { rapida: 14 * TK, lenta: 16 * TK, media: 24 * TK, shared: 10 * TK } // peralte (rad) por unidad de curvatura (1/u)
const BANK_MAX = 0.55; const BANK_RATE = 0.025 / TK // rad máx. y rad por unidad de longitud
// lomas (+) y badenes (-) por carril: cuántas y de qué altura (× TK); jumps: rampas de salto extra
const RELIEF = {
  rapida: { n: [1, 2], h: [0.1, 0.22], jumps: 0 },
  lenta: { n: [3, 5], h: [0.15, 0.4], jumps: 0 },
  media: { n: [2, 3], h: [0.15, 0.32], jumps: 2 },
  shared: { n: [1, 2], h: [0.08, 0.18], jumps: 0 },
}
const RELIEF_BASE = 0.15 * TK // altura base del firme (así caben los badenes sin atravesar el cristal)
const KICK_DROP = 0.9 * TK // largo (u) de la caída tras la cresta de una rampa: ahí la ballita despega

// Curvatura suavizada, peralte y relieve de un tramo de tubo. Usa los marcos ya cacheados.
function buildSurface(s, rng) {
  s._curv = s._bank = s._relief = null
  if (s.air) return
  ensureFrames(s)
  const { n, T, D } = s._fr; const ds = s.length / n
  const kx = new Float32Array(n + 1); const ky = new Float32Array(n + 1)
  const t = new THREE.Vector3(); const d = new THREE.Vector3(); const k = new THREE.Vector3(); const b = new THREE.Vector3(); const t0 = new THREE.Vector3()
  for (let i = 0; i <= n; i++) {
    const i0 = Math.max(0, i - 1); const i1 = Math.min(n, i + 1)
    t0.fromArray(T, i0 * 3); k.fromArray(T, i1 * 3).sub(t0).divideScalar((i1 - i0) * ds)
    t.fromArray(T, i * 3); d.fromArray(D, i * 3); b.crossVectors(t, d)
    kx[i] = k.dot(d); ky[i] = k.dot(b)
  }
  // media móvil de ~4 u: la curvatura del spline no tiembla
  const box = (a, w) => {
    const pre = new Float64Array(a.length + 1); for (let i = 0; i < a.length; i++) pre[i + 1] = pre[i] + a[i]
    return a.map((_, i) => { const lo = Math.max(0, i - w); const hi = Math.min(a.length - 1, i + w); return (pre[hi + 1] - pre[lo]) / (hi - lo + 1) })
  }
  const w = Math.max(1, Math.round((2 * TK) / ds)); const cx = box(kx, w); const cy = box(ky, w)
  s._curv = { x: cx, y: cy }
  const role = s.route >= 0 ? ROLES[s.route] : 'shared'
  // peralte hacia fuera de la curva, acotado y con ritmo limitado; nulo en los extremos (uniones)
  const g = BANK_GAIN[role]; const bx = cx.map((x) => -x * g); const by = cy.map((y) => -y * g)
  const step = BANK_RATE * ds
  const pinMag = () => {
    const m = bx.map((x, i) => Math.min(BANK_MAX, Math.hypot(x, by[i])))
    m[0] = 0
    for (let i = 1; i <= n; i++) m[i] = Math.min(m[i], m[i - 1] + step)
    m[n] = 0
    for (let i = n - 1; i >= 0; i--) m[i] = Math.min(m[i], m[i + 1] + step)
    for (let i = 0; i <= n; i++) { const h = Math.hypot(bx[i], by[i]); const f = h > 1e-9 ? m[i] / h : 0; bx[i] *= f; by[i] *= f }
  }
  pinMag()
  // también el cambio de dirección del peralte va a ritmo limitado (al salir de hélices gira rápido)
  for (const dir of [1, -1]) {
    for (let i = dir > 0 ? 1 : n - 1; dir > 0 ? i <= n : i >= 0; i += dir) {
      const dx = bx[i] - bx[i - dir]; const dy = by[i] - by[i - dir]; const l = Math.hypot(dx, dy)
      if (l > step) { bx[i] = bx[i - dir] + (dx * step) / l; by[i] = by[i - dir] + (dy * step) / l }
    }
  }
  pinMag()
  s._bank = { x: bx, y: by }
  // relieve por carril: lomas, badenes, rampa antes de cada mecanismo y saltos en la ruta espectacular
  const R = RELIEF[role]; const L = s.length; const hMax = 0.45 * (s.radius - BALL_R)
  const nr = clamp(Math.ceil(L / (0.5 * TK)), 32, 8000) // tramos largos (mapa grande) siguen muestreados a ~0.5 u (× TK)
  s._relief = { n: nr, h: new Map() }
  for (const lane of s.lanes) {
    const feats = []
    for (let j = ri(rng, R.n[0], R.n[1]); j > 0; j--) {
      feats.push({ c: (0.12 + rng() * 0.76) * L, w: (4 + rng() * 5) * TK, h: (R.h[0] + rng() * (R.h[1] - R.h[0])) * TK * (rng() < 0.35 ? -1 : 1) })
    }
    // [cresta, altura, subida]: una rampa por estación (varios mecanismos en la misma u comparten rampa)
    const kicks = [...new Set((s.switchesByLane?.get(lane.id) || []).filter((sw) => sw.kind === 'rampa').map((sw) => sw.u))].map((u) => [u * L, 0.3 * TK, 5 * TK])
    for (let j = 0; j < R.jumps; j++) {
      let p = (0.2 + rng() * 0.6) * L
      while (kicks.some(([q]) => Math.abs(q - p) < 2.5 * KICK_DROP)) p += 2.5 * KICK_DROP // sus caídas no se apilan (pendiente máx. del relieve)
      kicks.push([Math.min(p, L - 8 * TK), 0.5 * TK, 7 * TK])
    }
    const arr = new Float32Array(nr + 1)
    for (let i = 0; i <= nr; i++) {
      const x = (i / nr) * L; let h = RELIEF_BASE
      for (const f of feats) { const q = Math.abs(x - f.c) / f.w; if (q < 1) h += f.h * Math.cos((q * Math.PI) / 2) ** 2 }
      for (const [p, kh, up] of kicks) {
        if (x > p - up && x <= p) h += kh * smooth01((x - p + up) / up)
        else if (x > p && x < p + KICK_DROP) h += kh * (1 - (x - p) / KICK_DROP)
      }
      arr[i] = clamp(h, 0, hMax) * smooth01(x / (6 * TK)) * smooth01((L - x) / (6 * TK))
    }
    s._relief.h.set(lane.id, arr)
  }
}

// Cota del radio de la trenza por proximidad del eje a sí mismo (hélices, rizos, embudos): dos tramos del mismo camino
// separados por más de LANE_SELF de arco deben dejar LANE_GAP entre sus carriles más cercanos.
const LANE_SELF = 25 * TK
const LANE_GAP = LANE_W * (1 + MIN_GAP_K / 2) // centro a centro mínimo entre carriles: su ancho + 1.5 radios de pista (radio de carril = LANE_W / 2)
const LANE_MARGIN = LANE_W * 0.6 // holgura extra sobre LANE_GAP: el muestreo y el suavizado de la cota no dejan los carriles al ras
function braidCap(C, N, step) {
  const CELL = 13 * TK; const grid = new Map(); const key = (x, y, z) => `${x},${y},${z}`
  for (let i = 0; i <= N; i++) {
    const k = key(Math.floor(C[i * 3] / CELL), Math.floor(C[i * 3 + 1] / CELL), Math.floor(C[i * 3 + 2] / CELL)); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i)
  }
  const cap = new Float32Array(N + 1).fill(Infinity); const minJ = Math.ceil(LANE_SELF / step)
  for (let i = 0; i <= N; i++) {
    const x = Math.floor(C[i * 3] / CELL); const y = Math.floor(C[i * 3 + 1] / CELL); const z = Math.floor(C[i * 3 + 2] / CELL)
    let d2 = Infinity
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const b = grid.get(key(x + dx, y + dy, z + dz)); if (!b) continue
      for (const j of b) {
        if (Math.abs(j - i) < minJ) continue
        const e = (C[i * 3] - C[j * 3]) ** 2 + (C[i * 3 + 1] - C[j * 3 + 1]) ** 2 + (C[i * 3 + 2] - C[j * 3 + 2]) ** 2
        if (e < d2) d2 = e
      }
    }
    if (d2 < Infinity) cap[i] = (Math.sqrt(d2) - LANE_GAP - LANE_MARGIN) / 2
  }
  // curvatura: el carril exterior no puede pasar de 0.8 veces el radio de curvatura del eje
  for (let i = 1; i < N; i++) {
    const ax = C[i * 3] - C[i * 3 - 3]; const ay = C[i * 3 + 1] - C[i * 3 - 2]; const az = C[i * 3 + 2] - C[i * 3 - 1]
    const bx = C[i * 3 + 3] - C[i * 3]; const by = C[i * 3 + 4] - C[i * 3 + 1]; const bz = C[i * 3 + 5] - C[i * 3 + 2]
    const la = Math.hypot(ax, ay, az); const lb = Math.hypot(bx, by, bz)
    if (la < 1e-6 || lb < 1e-6) continue
    const ang = Math.acos(clamp((ax * bx + ay * by + az * bz) / (la * lb), -1, 1))
    // sin bajar del mínimo que separa carriles (central contra anillo): en codos muy cerrados manda la separación
    if (ang > 1e-4) cap[i] = Math.min(cap[i], Math.max(LANE_GAP + LANE_MARGIN, 0.8 * ((la + lb) / 2 / ang)))
  }
  // el mínimo se extiende y se suaviza: el radio de la trenza no da saltos
  const w = Math.max(2, Math.ceil((6 * TK) / step)); const lo = new Float32Array(N + 1); const out = new Float32Array(N + 1)
  for (let i = 0; i <= N; i++) { let m = Infinity; for (let j = Math.max(0, i - w); j <= Math.min(N, i + w); j++) m = Math.min(m, cap[j]); lo[i] = m }
  for (let i = 0; i <= N; i++) { let t = 0; let n = 0; for (let j = Math.max(0, i - w); j <= Math.min(N, i + w); j++) { t += Math.min(lo[j], 1e3 * TK); n++ } out[i] = t / n }
  return out
}

// Carriles y mecanismos de un way (rng propio: no altera la generación de las rutas).
function buildBraid(s) {
  const N = clamp(Math.ceil(s.length / (1.5 * TK)), 48, 1200)
  const lanes = s.lanes; const P = lanes.map(() => new Float32Array((N + 1) * 3)); const env = new Float32Array(N + 1)
  const tangent = new THREE.Vector3(); const ref = new THREE.Vector3(); const priorRef = new THREE.Vector3(); const side = new THREE.Vector3(); const center = new THREE.Vector3()
  const C = new Float32Array((N + 1) * 3); const R = new Float32Array((N + 1) * 3); const S = new Float32Array((N + 1) * 3)
  for (let i = 0; i <= N; i++) {
    const u = i / N; const f = wallFrame(s, 0, u, 0, {})
    center.copy(f.axis); segmentTangent(s, u, tangent)
    if (i) ref.copy(priorRef).addScaledVector(tangent, -priorRef.dot(tangent))
    else ref.crossVectors(tangent, Y)
    if (ref.lengthSq() < 1e-8) ref.set(1, 0, 0).addScaledVector(tangent, -tangent.x)
    ref.normalize(); side.crossVectors(tangent, ref).normalize()
    priorRef.copy(ref)
    env[i] = braidEnv(s, u)
    center.toArray(C, i * 3); ref.toArray(R, i * 3); side.toArray(S, i * 3)
  }
  const cap = braidCap(C, N, s.length / N)
  const rad = new Float32Array(N + 1)
  for (let i = 0; i <= N; i++) rad[i] = Math.max(0, Math.min(BRAID_A * env[i], cap[i]))
  for (let i = 0; i <= N; i++) {
    const u = i / N
    for (let j = 0; j < lanes.length; j++) {
      const id = lanes[j].id; const dst = P[id] || (P[id] = new Float32Array((N + 1) * 3))
      const ringCount = Math.max(1, lanes.length - 1)
      const theta = id === 0 ? 0 : ((id - 1) * TAU / ringCount + u * TAU)
      const radius = id === 0 ? 0 : rad[i]
      for (let k = 0; k < 3; k++) dst[i * 3 + k] = C[i * 3 + k] + R[i * 3 + k] * Math.cos(theta) * radius + S[i * 3 + k] * Math.sin(theta) * radius
    }
  }
  const [da, db] = braidDelay(s)
  s._braid = { N, P, env, rad, full: [Math.min(0.45, (da + OPEN_RAMP) / s.length), Math.max(0.55, 1 - (db + OPEN_RAMP) / s.length)], len: [], curves: [] }
}

function buildLanes(way) {
  const rng = mulberry32(90000 + way.idx * 131)
  const laneCount = 3 + Math.floor(rng() * 3)
  const theme = way.theme.id
  const mechs = Object.keys(THEME_MECHS[theme])
  const width = LANE_W
  const extra = THEME_CAMBIOS[theme] || {}
  const mk = (s, u, from, to, kind, carril) => {
    const M = MECHANISMS[kind]; const sk = s.speedK ?? 1; const via = CAMBIOS[kind]
    const duration = +((M.dur / Math.sqrt(sk)) * (s.drag > 2 ? 1.25 : 1)).toFixed(2)
    const span = via === 'portal' ? 0 : (duration * (14 * TK * sk + (s.boost || 0) * 0.4)) / s.length
    const uLand = +Math.min(0.96, u + Math.max(via === 'portal' ? 0.05 : 0.08, span)).toFixed(4)
    return {
      u: +u.toFixed(4), uLand, uEnd: uLand, from, to, carril, kind, via, apex: +((kind === 'botado' ? 5.5 : 3.5) + Math.abs(to - from) * 0.6).toFixed(2) * TK,
      name: THEME_MECHS[theme][kind] || M.name, emoji: M.emoji, style: via, duration,
      risk: M.risk, fail: M.fail, reward: { ...M.reward }, boost: M.boost,
    }
  }
  const fA = {}; const fB = {}
  // kind por geometría (desnivel vertical y distancia entre caminos en u) y por tema; `pref`: el del obstáculo si encaja
  const pickKind = (s, from, to, u, pref) => {
    const a = laneFrame(s, from, u, fA).pos; const b = laneFrame(s, to, u, fB).pos
    const dy = b.y - a.y; const dist = a.distanceTo(b)
    let opts
    if (dy < -0.45 * dist) opts = ['caida', 'caida', 'salto', ...(extra.abajo || [])]
    else if (dy > 0.45 * dist) opts = ['elevador', 'elevador', 'rampa', ...(extra.arriba || [])]
    else if (dist > 7 * TK) opts = ['portal']
    else opts = ['salto', 'rampa', 'botado', 'laberinto', ...(extra.nivel || [])]
    return pref && opts.includes(pref) ? pref : opts[Math.floor(rng() * opts.length)]
  }
  way.segments.forEach((s) => {
    const ids = Array.from({ length: laneCount }, (_, id) => id)
    s.lanes = ids.map((id) => ({ id, roll: id === 0 ? 'plano' : ROLL_KINDS[1 + ((id - 1 + way.idx) % (ROLL_KINDS.length - 1))], angle: 0, offset: 0, width, name: LANE_NAMES[id] || `camino ${id + 1}` }))
    buildBraid(s)
    s.switches = []
    // tramo abierto de la trenza (los caminos separados): ahí van los eventos, uno por carril de cada camino
    const [fa, fb] = s._braid.full
    let a = fa + 0.02; let b = Math.min(fb - 0.02, 0.9)
    if (b - a < 0.15) { a = 0.2; b = 0.8 }
    const pref = CAMBIOS[s.kind] ? s.kind : CAMBIOS[s.event] ? s.event : null
    for (const id of ids) {
      const others = ids.filter((x) => x !== id); const shift = Math.floor(rng() * others.length)
      for (let c = 0; c < CARRILES; c++) {
        const u = a + ((c + 0.15 + rng() * 0.7) / CARRILES) * (b - a)
        const to = others[(c + shift) % others.length]
        s.switches.push(mk(s, u, id, to, pickKind(s, id, to, u, pref), (c * 2 + id) % CARRILES)) // carriles barajados entre caminos
      }
    }
    // Índice de eventos por camino origen para que cada tick consulte sólo los de ese camino, ordenados por posición.
    s.switchesByLane = new Map(ids.map((id) => [id, s.switches.filter((sw) => sw.from === id).sort((x, y) => x.u - y.u)]))
  })
  const srng = mulberry32(91000 + way.idx * 37)
  for (const s of way.segments) buildSurface(s, srng)
  for (const s of way.segments) for (const sw of s.switches) delete sw._arc
}

const TERM_MIN_ANG = 0.58 // fallback de separación angular entre terminales si la distribución no admite 0.82

// Elecciones de la búsqueda de huecos ({theta, bowExtra, salt} por camino), calculadas aparte (worker/caché):
// con ellas buildWorld se salta la búsqueda cara y produce el mismo mundo.
const PICKS = new Map()
// shortcut: la caché de elecciones se invalida a mano; sube WORLD_GEN al cambiar cualquier cosa de la generación
export const WORLD_GEN = 8
export const setWorldPicks = (seed, picks) => PICKS.set(seed, picks)
// Si algún camino no encuentra hueco, se rehace el mundo con otra semilla de reparto (determinista).
const MAX_ATTEMPTS = 6
export function buildWorld(seed = 369, onProgress = null) {
  const known = PICKS.get(seed)
  if (known) return buildWorldAttempt(seed, onProgress, known[0]?.attempt ?? 0) // las elecciones guardan el intento con que se calcularon
  let world; const failLog = []
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    world = buildWorldAttempt(seed, onProgress, attempt)
    if (world.failLog) failLog.push(...world.failLog.map((f) => ({ attempt, ...f })))
    if (!world.failed) break
  }
  world.failLog = failLog
  return world
}
function buildWorldAttempt(seed, onProgress, attempt) {
  const rng = mulberry32(seed + attempt * 7919)
  const world = { attempt, failed: false,  nodes: [], destinos: [], circuits: [], ways: [], waysFrom: [], routes: [], segments: [], picks: [] }
  const known = PICKS.get(seed)
  const placeWay = (w, c, a, b, placed) => {
    const way = placeWayAt(w, c, a, b, placed, known?.[world.picks.length])
    world.picks.push(way.pick)
    onProgress?.(world.picks.length)
    return way
  }
  const dirs = sphereDirs(NODE_DEFS.length)
  NODE_DEFS.forEach((d, idx) => world.nodes.push({ idx, name: d.name, color: d.color, pos: dirs[idx].clone().multiplyScalar(SPHERE_R), radius: NODE_R }))
  world.nodes.forEach((node) => buildCity(world, node, NODE_DEFS[node.idx], rng))
  world.waysFrom = world.nodes.map(() => [])
  const placed = []
  for (let a = 0; a < world.nodes.length; a++) {
    for (let b = a + 1; b < world.nodes.length; b++) {
      const c = { idx: world.circuits.length, a, b, theme: THEMES[world.circuits.length % THEMES.length], ways: [] }
      world.circuits.push(c)
      c.ways.push(placeWay(world, c, a, b, placed), placeWay(world, c, b, a, placed))
      c.mid = c.ways[0].junctions[1].pos.clone().lerp(c.ways[1].junctions[1].pos, 0.5)
      if (world.failed && !known && attempt < MAX_ATTEMPTS - 1) return world // se rehará con otro reparto: no gastar en el resto
    }
  }
  // carriles: repulsión de cintas visibles y luego el índice de colisión (world.colision)
  indexarColisiones(world, relaxRibbons(world))
  return world
}

// ───────────────────────── ciudad sobre la esfera ─────────────────────────
function buildCity(world, node, def, rng) {
  const dirs = []
  node.ports = []; node.portTo = []; node.terminals = []
  // Piscina de direcciones Fibonacci sobre toda la esfera para repartir terminales
  const M = 36; const rot0 = rng() * TAU; const pool = []
  for (let i = 0; i < M; i++) {
    const y = 1 - (2 * (i + 0.5)) / M; const r = Math.sqrt(1 - y * y); const a = i * Math.PI * (3 - Math.sqrt(5)) + rot0
    pool.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r))
  }
  const pickTerminal = (biasDir) => {
    for (const minAng of [0.82, TERM_MIN_ANG]) {
      const minDot = Math.cos(minAng)
      const cands = pool.filter((d) => dirs.every((u) => u.dot(d) < minDot))
      if (!cands.length) continue
      const weights = cands.map((d) => {
        const dot = d.dot(biasDir)
        return Math.pow(Math.max(0.05, (dot + 1) * 0.5), 3) * (dot > -0.25 ? 4 : 1)
      })
      const total = weights.reduce((s, w) => s + w, 0)
      let r = rng() * total
      for (let i = 0; i < cands.length; i++) {
        r -= weights[i]
        if (r <= 0) return dirs.push(cands[i].clone()) - 1
      }
      return dirs.push(cands[cands.length - 1].clone()) - 1
    }
    return dirs.push(biasDir.clone()) - 1
  }
  const pendingTerms = []
  for (const o of world.nodes) {
    if (o === node) continue
    // hacia el otro nodo siguiendo la superficie de la esfera grande (tangente) y un poco hacia fuera
    const up = node.pos.clone().normalize()
    const tan = o.pos.clone().normalize().addScaledVector(up, -o.pos.clone().normalize().dot(up)).normalize()
    const side = new THREE.Vector3().crossVectors(up, tan) // salida y llegada del mismo par abren a lados opuestos
    const base = tan.multiplyScalar(0.85).addScaledVector(up, 0.5)
    const dir = base.clone().normalize()
    const out = pickTerminal(base.clone().addScaledVector(side, 0.45).normalize())
    const inn = pickTerminal(base.clone().addScaledVector(side, -0.45).normalize())
    node.portTo[o.idx] = { to: o.idx, dir, in: inn, out, wayIn: null, wayOut: null }
    node.ports.push(node.portTo[o.idx])
    pendingTerms.push({ vert: out, kind: 'out', to: o.idx }, { vert: inn, kind: 'in', to: o.idx })
  }
  const nPort = dirs.length
  // resto de cruces: espiral de Fibonacci (reparto uniforme), sin pisar los terminales
  const N = 28; const rot = rng() * TAU
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N; const r = Math.sqrt(1 - y * y); const a = i * Math.PI * (3 - Math.sqrt(5)) + rot
    const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
    if (dirs.every((q) => q.dot(d) < 0.94)) dirs.push(d)
  }
  node.verts = dirs.map((dir) => ({ dir, pos: node.pos.clone().addScaledVector(dir, NODE_R) }))
  node.terminals = pendingTerms.map((t) => ({
    vert: t.vert, kind: t.kind, way: null, to: t.to,
    dir: node.verts[t.vert].dir, pos: node.verts[t.vert].pos,
  }))

  node.roads = []
  const adj = dirs.map(() => [])
  const link = (a, b) => {
    if (a === b || adj[a].includes(b)) return
    adj[a].push(b); adj[b].push(a)
    const ang = dirs[a].angleTo(dirs[b]); const k = Math.max(2, Math.ceil(ang / 0.1)); const points = []
    for (let i = 0; i <= k; i++) points.push(slerpDir(dirs[a], dirs[b], i / k).multiplyScalar(NODE_R).add(node.pos))
    node.roads.push({ a, b, length: ang * NODE_R, points })
  }
  dirs.forEach((d, i) => dirs.map((q, j) => [d.dot(q), j]).filter((x) => x[1] !== i)
    .sort((x, y) => y[0] - x[0]).slice(0, 3).forEach(([, j]) => link(i, j)))
  // los 3 vecinos más cercanos pueden dejar islas: se cosen por el par más próximo
  for (;;) {
    const seen = new Set([0]); const q = [0]
    while (q.length) for (const j of adj[q.pop()]) if (!seen.has(j)) { seen.add(j); q.push(j) }
    if (seen.size === dirs.length) break
    let best = null
    for (const i of seen) dirs.forEach((d, j) => { if (!seen.has(j) && (!best || d.dot(dirs[i]) > best[0])) best = [d.dot(dirs[i]), i, j] })
    link(best[1], best[2])
  }
  // Floyd-Warshall: la red es diminuta y así elegir camino es una consulta
  const dist = dirs.map((_, i) => dirs.map((_, j) => (i === j ? 0 : Infinity)))
  node.hop = dirs.map(() => dirs.map((_, j) => j))
  for (const r of node.roads) dist[r.a][r.b] = dist[r.b][r.a] = r.length
  for (let k = 0; k < dirs.length; k++) for (let i = 0; i < dirs.length; i++) for (let j = 0; j < dirs.length; j++) {
    if (dist[i][k] + dist[k][j] < dist[i][j]) { dist[i][j] = dist[i][k] + dist[k][j]; node.hop[i][j] = node.hop[i][k] }
  }

  node.destinos = []
  const spots = shuffle(dirs.map((_, i) => i).slice(nPort), rng)
  const names = { puntos: [...DEST_NAMES.puntos], energia: [...DEST_NAMES.energia] }
  for (let j = 0; j < def.n; j++) {
    // al menos uno de cada tipo; el resto según el sesgo del nodo
    const kind = j === 0 ? 'puntos' : j === 1 ? 'energia' : rng() < def.bias ? 'puntos' : 'energia'
    const vert = spots[j]
    const d = {
      idx: world.destinos.length, node: node.idx, kind,
      name: names[kind].splice(Math.floor(rng() * names[kind].length), 1)[0],
      // puntos dan puntos y cuestan energía; energía al revés
      dp: kind === 'puntos' ? ri(rng, 10, 25) : -ri(rng, 4, 10),
      de: kind === 'energia' ? ri(rng, 14, 32) : -ri(rng, 5, 12),
      vert, dir: node.verts[vert].dir, pos: node.verts[vert].pos,
    }
    node.destinos.push(d); world.destinos.push(d)
  }
}

// ───────────────────────── formas de los obstáculos ─────────────────────────
// Cada forma devuelve los puntos de paso entre A y B. Ta/Tb: tangente pactada con el tramo vecino.
const basis = (A, B) => {
  const C = B.clone().sub(A); const L = C.length()
  const c = L < 1e-6 ? new THREE.Vector3(0, 0, 1) : C.clone().divideScalar(L)
  const u = new THREE.Vector3().crossVectors(c, Math.abs(c.y) > 0.95 ? X : Y).normalize()
  return { C, L, c, u, v: new THREE.Vector3().crossVectors(u, c) } // v apunta "arriba" respecto a la cuerda
}
// A + C*t + suma de (vector, escala)
const at = (A, C, t, ...offs) => {
  const p = A.clone().addScaledVector(C, t)
  for (let i = 0; i < offs.length; i += 2) p.addScaledVector(offs[i], offs[i + 1])
  return p
}
// Hélice alrededor de la cuerda A0->B con radio variable rad(t). Con `spin`, el giro avanza en
// proporción al radio: entra y sale abriéndose suave, sin tornillo de radio cero.
const coil = (A, B, turns, rad, A0 = A, ease = (t) => t, spin = false) => {
  const { u, v } = basis(A, B); const C = B.clone().sub(A0); const n = Math.ceil(turns * 16); const pts = []
  const cum = [0]
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + (spin ? rad((i - 0.5) / n) : 1))
  for (let i = 1; i < n; i++) {
    const t = i / n; const a = (cum[i] / cum[n]) * turns * TAU
    pts.push(at(A0, C, ease(t), u, Math.cos(a) * rad(t), v, Math.sin(a) * rad(t)))
  }
  return pts
}
const PITCH = 2 * BRAID_A + LANE_W * (1 + MIN_GAP_K / 2) + 2 * TK // paso mínimo (u) entre vueltas de hélices y rizos: dos trenzas abiertas sin tocarse
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }
const bump = (t) => smooth01(Math.min(1, 2.2 * t, 2.2 * (1 - t))) // el radio nace y muere en la cuerda, sin quiebros

// ───────────────────────── piezas de pista (trazado tipo circuito) ─────────────────────────
// Plan de un obstáculo "de pista": lista de piezas [giro (rad, + a la izquierda), largo relativo];
// giro 0 = recta. Cada curva tiene radio constante con rampas de curvatura de entrada y salida
// (clotoide): nunca hay cambios de dirección cortos y alternados.
const PLANS = {
  rampa: [[0, 1.4], [0.45, 1.3], [0, 0.6], [-0.45, 1.3], [0, 1.4]], // curva y contracurva abiertas
  horquilla: [[0, 0.7], [0.9, 0.8], [0, 0.3], [-1.8, 1.5], [0, 0.3], [0.9, 0.8], [0, 0.7]], // vuelta cerrada
  turbina: [[0, 2.2], [0.5, 2.4], [0, 0.4], [-0.5, 2.4], [0, 2.2]], // recta larga y barrido rápido
  hielo_resbaloso: [[0, 3], [0.4, 2], [0, 1], [-0.4, 2], [0, 3]], // rectas largas y curva peraltada
  pantano: [[0, 0.6], [0.8, 1], [0, 0.5], [-1.6, 1.6], [0, 0.5], [0.8, 1], [0, 0.6]], // curvas lentas
  cascada: [[0, 1], [0.6, 3], [0, 0.6], [-0.6, 3], [0, 1]], // gran curva en bajada
}
const ROLE_TURN = { rapida: 0.7, lenta: 1.25, media: 1 } // rápida: curvas abiertas; lenta: cerradas
const ROLE_HILL = { rapida: 0.015, lenta: 0.05, media: 0.035 } // subidas/bajadas suaves (× cuerda)

// Puntos de paso de un obstáculo de pista entre A y B. El rumbo arranca en Ta y acaba en Tb; el
// trazado se escala para caer justo en B y se limita su desvío lateral (no invade otras rutas).
function trackPts(kind, A, B, Ta, Tb, opt) {
  const rng = opt.rng || Math.random
  const { L, c, u, v } = basis(A, B)
  const roll = (rng() - 0.5) * 0.7 // parte de la curva se vuelve subida/bajada
  const side = u.clone().multiplyScalar(Math.cos(roll)).addScaledVector(v, Math.sin(roll))
  const up = new THREE.Vector3().crossVectors(side, c)
  const kT = (ROLE_TURN[opt.role] ?? 1) * (0.85 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1)
  const pieces = PLANS[kind].map(([turn, len]) => [turn * kT, len * (0.8 + rng() * 0.4)])
  const head = (T) => (T ? clamp(Math.atan2(T.dot(side), T.dot(c)), -1.2, 1.2) : 0)
  const psi0 = head(Ta); const psi1 = head(Tb)
  const S = pieces.reduce((s, p) => s + p[1], 0)
  const kappa = (s) => {
    let acc = 0
    for (const [turn, len] of pieces) {
      if (s < acc + len) { const x = (s - acc) / len; return turn ? (turn / (0.75 * len)) * Math.min(1, x / 0.25, (1 - x) / 0.25) : 0 }
      acc += len
    }
    return 0
  }
  const M = 240; const ds = S / M; const xs = new Float32Array(M + 1); const ys = new Float32Array(M + 1)
  const hill = (ROLE_HILL[opt.role] ?? 0.02) * L * (rng() < 0.5 ? -1 : 1)
  let scale = 1; let kx = 1
  for (let pass = 0; pass < 4; pass++) {
    let psiPlan = 0; let x = 0; let y = 0
    for (let i = 0; i <= M; i++) {
      xs[i] = x; ys[i] = y
      const psi = psiPlan * scale + psi0 + (psi1 - psi0) * smooth01(i / M)
      psiPlan += kappa((i + 0.5) * ds) * ds
      x += Math.cos(psi) * ds; y += Math.sin(psi) * ds
    }
    kx = L / Math.max(xs[M], 1e-3)
    let ymax = 0
    for (let i = 0; i <= M; i++) ymax = Math.max(ymax, Math.abs((ys[i] - ys[M] * smooth01(i / M)) * kx))
    const lim = 0.12 * L
    if (xs[M] > 0.35 * S && ymax <= lim) break
    scale *= Math.min(0.8, lim / Math.max(ymax, 1e-3))
  }
  // pendiente vertical de los extremos: la tangente 3D casa con Ta/Tb sin puntos de enlace; la
  // transición sólo ocupa el 18% de cada punta (no infla el tramo entero)
  const TAUE = 0.18; const G = (x) => (x < 1 ? x - (x * x) / 2 : 0.5) // curvatura de un solo signo en cada punta
  const slope = (T) => (T ? clamp(T.dot(up) / Math.max(0.2, Math.hypot(T.dot(c), T.dot(side))), -2, 2) : 0)
  const m0 = slope(Ta); const m1 = slope(Tb)
  const n = clamp(Math.round(L / (2.5 * TK)), 12, 120); const pts = []
  for (let j = 1; j < n; j++) {
    const i = Math.round((j / n) * M); const t = i / M; const along = xs[i] * kx; const tx = along / L
    const y = (ys[i] - ys[M] * smooth01(t)) * kx
    const z = hill * Math.sin(Math.PI * t) + L * TAUE * (m0 * G(tx / TAUE) - m1 * G((1 - tx) / TAUE) - (m0 * tx - m1 * (1 - tx)) / 2)
    pts.push(A.clone().addScaledVector(c, along).addScaledVector(side, y).addScaledVector(up, z))
  }
  return pts
}

// Puntos interiores de una Bézier cúbica de P0 (rumbo T0) a P1 (rumbo T1): una sola curva amplia.
function bezierPts(P0, T0, P1, T1) {
  const d = P0.distanceTo(P1); const k = d * 0.42; const n = clamp(Math.round(d / (2.5 * TK)), 4, 80); const pts = []
  const c1 = at(P0, T0, k); const c2 = at(P1, T1, -k)
  for (let i = 1; i < n; i++) {
    const t = i / n; const s = 1 - t
    pts.push(P0.clone().multiplyScalar(s * s * s).addScaledVector(c1, 3 * s * s * t).addScaledVector(c2, 3 * s * t * t).addScaledVector(P1, t * t * t))
  }
  return pts
}

const SHAPES = {
  // las vueltas guardan un paso mínimo (PITCH): entre dos vueltas caben los carriles de la trenza
  espiral: (A, B, P) => coil(A, B, Math.min(2 + P.turns, Math.max(1.2, A.distanceTo(B) / PITCH)), (t) => 3.2 * WS * P.coil * bump(t), A, undefined, true),
  sacacorchos: (A, B, P) => coil(A, B, Math.min(3 + P.turns, Math.max(1.5, A.distanceTo(B) / PITCH)), (t) => (P.radius * 1.85 + 4.7 * TK) * bump(t), A, undefined, true),
  // remolino que se cierra: empieza en el borde del cono (A) y acaba en su vértice (B)
  embudo: (A, B, P) => { const R = 4.0 * WS * P.coil; return coil(A, B, Math.min(3, Math.max(1.2, A.distanceTo(B) / (2 * PITCH))), (t) => R * (1 - t), at(A, basis(A, B).u, -R), (t) => 0.5 * t + 0.5 * t * t) },
  // tiro horizontal: parábola de caída libre
  caida: (A, B) => { const { C } = basis(A, B); return [1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(A.x + C.x * (i / 8), A.y + C.y * (i / 8) ** 2, A.z + C.z * (i / 8))) },
  // un salto largo (un solo arco: sin botes alternados)
  trampolin: (A, B) => { const { C, L } = basis(A, B); const h = 2.5 * WS + L * 0.15; return Array.from({ length: 11 }, (_, i) => at(A, C, (i + 1) / 12, Y, h * Math.sin(((i + 1) / 12) * Math.PI))) },
  canon: (A, B) => { const { C, L } = basis(A, B); return Array.from({ length: 9 }, (_, i) => at(A, C, (i + 1) / 10, Y, L * 1.0 * ((i + 1) / 10) * (1 - (i + 1) / 10))) },
  portal: (A, B) => {
    const { C, v } = basis(A, B)
    return [at(A, C, 0.35, v, 0.9 * WS), at(A, C, 0.65, v, 0.9 * WS)]
  },
  geiser: (A, B) => {
    const { C, L } = basis(A, B); const h = Math.min(9.5 * WS, 3.8 * WS + L * 0.22)
    return Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; return at(A, C, Math.pow(t, 1.15), Y, h * Math.sin(Math.PI * Math.pow(t, 0.8))) })
  },
  erupcion: (A, B) => {
    const { C, L, u } = basis(A, B); const h = Math.min(11 * WS, 4.5 * WS + L * 0.26)
    return Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; return at(A, C, t, Y, h * 4 * t * (1 - t), u, Math.sin(t * Math.PI) * 1.4 * WS) })
  },
}
SHAPES.salida = SHAPES.llegada = () => []

export const OUT_GATES = ['arco_salida', 'parrilla_semaforo', 'tunel_rampa', 'lanzadera_aros', 'puente_banderas']
export const IN_GATES = ['meta_cuadros', 'embudo_llegada', 'portal_llegada', 'arco_meta', 'tunel_frenado']
const ownsStart = (k) => KINDS[k].air || k === 'embudo' // su arranque lo dicta la forma, no el vecino
export const GRID_LEN = 14 * TK // recta de parrilla de la salida, en unidades de mundo
// radio (desde el centro de un nodo) de la zona de puerto, donde los caminos que llegan a él se unen
export const PORT_ZONE = NODE_R + GRID_LEN + BRAID_OPEN + BRAID_PAD
export const FINISH_LEN = 10 * TK // recta final de meta de la llegada

function shape(kind, A, B, P, Ta, Tb, midPt = null, opt = {}) {
  const lead = Math.min(2.5 * WS, A.distanceTo(B) * 0.15); const air = KINDS[kind].air
  const cr = (pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  if (PLANS[kind]) return cr([A, ...trackPts(kind, A, B, Ta, Tb, opt), B])
  if (kind === 'rizo') {
    // curva de entrada, círculo vertical (desplazado de lado lo justo para no cortarse) y curva de salida
    const { C, L, c, u, v } = basis(A, B); const r = Math.min(Math.max(3.4 * WS * P.coil, 13 * TK), L * 0.3); const sh = Math.max(P.radius * 2.4, PITCH) // el paso del rizo deja pasar los carriles de la trenza
    const loop = []
    for (let k = 0; k <= 24; k++) { const a = (k / 24) * TAU; loop.push(at(A, C, 0.5, c, r * Math.sin(a), v, r * (1 - Math.cos(a)), u, sh * (k / 24 - 0.5))) }
    const tIn = c.clone().addScaledVector(u, sh / (TAU * r)).normalize()
    return cr([A, ...bezierPts(A, Ta || c, loop[0], tIn), ...loop, ...bezierPts(loop[24], tIn, B, Tb || c), B])
  }
  if (kind === 'salida' || kind === 'llegada') {
    // salida: recta de parrilla que sale del planeta y una sola curva amplia hasta la unión;
    // llegada: curva amplia y recta final de meta que entra al planeta
    const out = kind === 'salida'
    const G0 = out ? at(A, Ta, GRID_LEN) : A; const G1 = out ? B : at(B, Tb, -FINISH_LEN)
    const T0 = out ? Ta : Ta.clone().normalize(); const T1 = Tb.clone().normalize()
    const pts = out ? [A, at(A, Ta, GRID_LEN * 0.5), G0] : [A]
    let P0 = G0; let D0 = T0
    for (const W of midPt ? [midPt, G1] : [G1]) {
      const D1 = W === G1 ? T1 : G1.clone().sub(P0).normalize()
      pts.push(...bezierPts(P0, D0, W, D1)); pts.push(W.clone()); P0 = W; D0 = D1
    }
    if (!out) pts.push(at(B, Tb, -FINISH_LEN * 0.5), B)
    return cr(pts)
  }
  const leadA = Ta && !ownsStart(kind); const leadB = Tb && !air
  // la forma sin sus puntas (dentro del enlace); se une a A y B con una curva Bézier que respeta Ta/Tb
  const body = SHAPES[kind](A, B, P).filter((p) => !(leadA && p.distanceTo(A) < lead * 1.1) && !(leadB && p.distanceTo(B) < lead * 1.1))
  const dirOf = (p, q) => q.clone().sub(p).normalize()
  const pts = [A]
  if (midPt) pts.push(midPt)
  if (leadA && body.length >= 2) pts.push(...bezierPts(A, Ta, body[0], dirOf(body[0], body[1])))
  else if (leadA) pts.push(at(A, Ta, lead))
  pts.push(...body)
  const nb = body.length
  if (leadB && nb >= 2) pts.push(...bezierPts(body[nb - 1], dirOf(body[nb - 2], body[nb - 1]), B, Tb))
  else if (leadB) pts.push(at(B, Tb, -lead))
  pts.push(B)
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal')
}

// Punto de rodeo para salida/llegada si la normal del terminal apunta lejos del hub.
function wrapMid(node, dir, target) {
  const toTarget = target.clone().sub(node.pos).normalize()
  if (dir.dot(toTarget) >= 0.35) return null
  return node.pos.clone().addScaledVector(slerpDir(dir, toTarget, 0.55), NODE_R + GRID_LEN + 3 * TK)
}

// Extensión real de la ruta en `u` (carriles abiertos de la trenza + ancho de pista), para medir rutas de un mismo sentido.
export const routeExtent = (seg, u) => Math.max(seg.radius, BRAID_A * braidEnv(seg, u, false) + LANE_W / 2 + 0.5 * TK)
export const ROUTE_JOIN = 56 * TK // radio (u, euclidiano) alrededor de fork/cross/merge donde las rutas aún se abren en abanico por diseño
export const SPREAD_K = 1.3 // separación lateral entre rutas de un mismo sentido, sobre P.spread
// Si dos rutas de una mitad se tocan (routeSlack < ROUTE_MARGIN) se prueba otra fila: otro orden de las rutas (PERMS) y luego más apertura.
const SPREAD_STEPS = [1, 1.4, 1.9]
const PERMS = { 2: [[0, 1], [1, 0]], 3: [[0, 1, 2], [2, 1, 0], [1, 0, 2], [0, 2, 1], [1, 2, 0], [2, 0, 1]] }
const ROUTE_MARGIN = 1.5 * TK // (u) el muestreo de la búsqueda (cada ~5 u) es más grueso que el de tools/overlap.mjs
const FAN_D = 105 * TK // distancia (u) del hub a los puntos de paso Q0/Q1: las rutas se abren en abanico en ese tramo

// Par en zona de puerto: uno de los dos puntos está a menos de PORT_ZONE de un nodo al que también llega (o del que sale) el otro camino.
// Misma regla en tools/overlap.mjs.
export const inPort = (p, q) => (p.zn >= 0 && (q.f === p.zn || q.t === p.zn)) || (q.zn >= 0 && (p.f === q.zn || p.t === q.zn))
function sampleWayPoints(way, steps = 14) {
  const pts = []
  // arranque (head) o remate (tail) de cada mitad de ruta: ahí las rutas confluyen en la unión
  for (const s of way.segments) {
    // fino (28): un punto cada ~1.5 u para no saltarse cruces entre tubos; grueso (14): descarte rápido
    const n = steps === 28 ? Math.max(12, Math.ceil(s.length / (1.5 * TK))) : steps
    for (let k = 0; k <= n; k++) {
      const u = k / n
      const p = s.curve.getPointAt(u)
      // zona de puerto: cerca del centro de uno de sus dos nodos los caminos se unen y no se mide separación entre ellos
      const zn = way.ends.findIndex((n) => p.distanceToSquared(n.pos) < PORT_ZONE * PORT_ZONE)
      let hubD2 = Infinity
      for (const j of way.junctions) hubD2 = Math.min(hubD2, j.pos.distanceToSquared(p))
      const hubD = Math.sqrt(hubD2)
      pts.push({ p, r: braidRadius(s, u), kind: s.kind, zn: zn < 0 ? -1 : way.ends[zn].idx, f: way.from, t: way.to, c: way.circuit.idx, route: s.route, hubD, ext: routeExtent(s, u), tube: s.radius })
    }
  }
  return pts
}

// Huelgo mínimo entre rutas distintas de un mismo sentido (fuera de las uniones), menos 1.5 radios de pista.
// `only` (mitad 0/1): sólo pares en que al menos un punto es de esa mitad.
// Celda ROUTE_CELL: todo par a menos de ROUTE_CELL se mide; más lejos la holgura ya pasa de ROUTE_CELL - 2·ext - 1.5·radio (> ROUTE_MARGIN).
const ROUTE_CELL = 20 * TK
function routeSlack(pts, only = -1) {
  // borde de la unión medido 6 u antes: allí las rutas convergen y el muestreo grueso (~5 u) se saltaba el punto más cercano
  const grid = new Map(); const pool = pts.filter((q) => q.route >= 0 && q.hubD >= ROUTE_JOIN - 6 * TK)
  const cell = (v) => Math.floor(v / ROUTE_CELL)
  for (const q of pool) { const key = cellKey(cell(q.p.x), cell(q.p.y), cell(q.p.z)); let b = grid.get(key); if (!b) grid.set(key, b = []); b.push(q) }
  let min = ROUTE_CELL
  for (const q of pool) {
    if (only >= 0 && q.h !== only) continue // con `only`, q recorre esa mitad y o todas
    const x = cell(q.p.x); const y = cell(q.p.y); const z = cell(q.p.z)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const bucket = grid.get(cellKey(x + dx, y + dy, z + dz)); if (!bucket) continue
      for (const o of bucket) {
        if (only >= 0 ? o.route === q.route : o.route <= q.route) continue
        const r = q.ext + o.ext + MIN_GAP_K * Math.max(q.tube, o.tube); const d2 = q.p.distanceToSquared(o.p)
        const lim = r + min
        if (lim > 0 && d2 < lim * lim) min = Math.sqrt(d2) - r
      }
    }
  }
  return min
}

const SPATIAL_CELL = 32 * TK // >= 2 * (BRAID_A + BRAID_PAD) + TARGET: el vecindario ±1 cubre toda la holgura medida
const CAND_ARC_DIV = 48
// clave numérica de celda (sin cadenas): coordenadas de celda en ±1024
const cellKey = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024)
const pointCell = (p) => cellKey(Math.floor(p.x / SPATIAL_CELL), Math.floor(p.y / SPATIAL_CELL), Math.floor(p.z / SPATIAL_CELL))
function indexPlacedWay(placed, entry) {
  placed.push(entry)
  const grid = placed.grid || (placed.grid = new Map())
  const gridC = placed.gridC || (placed.gridC = new Map()) // rejilla rala (1 de cada 4 puntos): sólo la usa la criba gruesa, que únicamente poda
  entry.pts.forEach((q, i) => {
    const key = pointCell(q.p)
    for (const g of i % 4 === 0 ? [grid, gridC] : [grid]) { let bucket = g.get(key); if (!bucket) g.set(key, bucket = []); bucket.push(q) }
  })
}

function placeWayAt(world, circuit, from, to, placed, pick) {
  if (pick) {
    const w = buildWay(world, circuit, from, to, pick.theta, pick.bowExtra, true, pick.salt)
    w.pick = pick
    return w
  }
  return placeWay(world, circuit, from, to, placed)
}

// holgura que se busca primero: los primeros caminos no deben agotar el espacio de los demás
const TARGET = 6 * TK // holgura (u) sobre los 1.5 radios de pista
const TARGET_LOW = 3 * TK // holgura que se acepta al cerrar una pasada completa de la búsqueda
const SPINE_MAX = 1.6 * SPHERE_R // radio máximo de la espina (sobre ella van rizos, saltos y arcos; la cáscara llega a 1.8 R)
const LAYER_K = 0.42 // grosor de la cáscara de altitud de los caminos (fracción de SPHERE_R): los cruces se resuelven por altura
function placeWay(world, circuit, from, to, placed) {
  const a = world.nodes[from]; const b = world.nodes[to]
  const others = world.nodes.filter((o) => o !== a && o !== b)
  const baseTheta = ((circuit.idx * 0.6180339887 + (from < to ? 0 : 0.5) + (world.attempt || 0) * 0.137) % 1) * TAU
  const N_ANG = 12
  let best = null; let bestScore = -Infinity

  // floor: puntaje a superar. Se corta en cuanto el resultado ya no puede superarlo NI cumplir okRes (mismo desenlace en tryCand).
  const evalCand = (cand, steps, floor = -Infinity) => {
    const pts = sampleWayPoints(cand, steps)
    let minNode = Infinity
    const nodeMargin = PORT_ZONE // un camino ajeno no debe pasar por la zona de puertos de un nodo
    const nodeAcceptSq = (nodeMargin + BRAID_A + BRAID_PAD + 2.5 * TK) ** 2
    for (const pt of pts) {
      for (const o of others) {
        const d2 = pt.p.distanceToSquared(o.pos)
        if (d2 < nodeAcceptSq) minNode = Math.min(minNode, Math.sqrt(d2) - pt.r - nodeMargin)
      }
      if (pt.kind !== 'salida' && pt.p.distanceToSquared(a.pos) <= (NODE_R + pt.r) ** 2) return null
      if (pt.kind !== 'llegada' && pt.p.distanceToSquared(b.pos) <= (NODE_R + pt.r) ** 2) return null
      if (pt.kind === 'salida' && pt.p.distanceToSquared(a.pos) <= (NODE_R - 0.005 * TK) ** 2) return null
      if (pt.kind === 'llegada' && pt.p.distanceToSquared(b.pos) <= (NODE_R - 0.005 * TK) ** 2) return null
    }
    if (minNode === Infinity) minNode = 1.5 * TK
    let minTube = Infinity; let minHub = Infinity; let minAt = null
    for (const prev of placed) {
      for (const h1 of cand.junctions) for (const h2 of prev.hubs) minHub = Math.min(minHub, h1.pos.distanceTo(h2.pos))
    }
    if ((minNode < 1.5 * TK || minHub < 24 * TK) && Math.min(TARGET, minNode + TK, minHub * 0.2) <= floor) return { minTube: -Infinity, minNode, minHub, minAt: null }
    const grid = steps === 14 ? placed.gridC : placed.grid
    let lastKey = NaN; let near = null // puntos consecutivos comparten celda: se reúnen sus 27 cubetas una sola vez
    if (grid) for (const pt of pts) {
      const x = Math.floor(pt.p.x / SPATIAL_CELL); const y = Math.floor(pt.p.y / SPATIAL_CELL); const z = Math.floor(pt.p.z / SPATIAL_CELL)
      const ck = cellKey(x, y, z)
      if (ck !== lastKey) {
        lastKey = ck; near = []
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          const bucket = grid.get(cellKey(x + dx, y + dy, z + dz)); if (bucket) near.push(bucket)
        }
      }
      for (const bucket of near) {
        for (const q of bucket) {
          if (inPort(pt, q)) continue // puerto común (la ida y la vuelta de un circuito también deben guardar huelgo entre sí fuera de él)
          const r = pt.r + q.r + MIN_GAP_K * Math.max(pt.tube, q.tube); const d2 = pt.p.distanceToSquared(q.p) // holgura sobre 1.5 radios de pista (igual que tools/overlap.mjs)
          if (d2 < (r + TARGET) ** 2 && Math.sqrt(d2) - r < minTube) {
            minTube = Math.sqrt(d2) - r; minAt = [pt.kind, q.kind, pt.c === q.c]
            if ((minTube < CLEAR ? minTube - 10 * TK : minTube) <= floor) return { minTube, minNode, minHub, minAt } // minTube < TARGET: okRes ya es falso
          }
        }
      }
    }
    return { minTube, minNode, minHub, minAt }
  }

  const CLEAR = 0.6 * TK // holgura mínima (u) sobre los 1.5 radios de pista entre envolventes de caminos distintos (margen del muestreo)
  const okRes = (r, thr) => r.minTube >= thr && r.minNode >= 1.5 * TK && r.minHub >= 24 * TK
  const scoreOf = (r) => Math.min(TARGET, r.minTube < CLEAR ? r.minTube - 10 * TK : Math.min(r.minTube, r.minNode + TK, r.minHub * 0.2))
  const commit = (c) => {
    const w = buildWay(world, circuit, from, to, c.theta, c.bowExtra, true, c.salt)
    w.pick = { theta: c.theta, bowExtra: c.bowExtra, salt: c.salt, attempt: world.attempt }
    indexPlacedWay(placed, { pts: sampleWayPoints(w, 28), hubs: w.junctions })
    return w
  }
  let bestRes = null
  // Evalúa un candidato y anota el mejor. La malla gruesa sólo sobreestima el huelgo: sirve de cota para saltarse la fina.
  // Cota rápida sin construir el camino: sus tres uniones son puntos por los que pasan todas sus rutas.
  const P = PARAMS[circuit.theme.id]; const hubR = Math.max(P.radius, BRAID_PAD) // envolvente en una punta de tramo (trenza cerrada)
  const bounds = new Map()
  const hubBound = (theta, bowExtra) => {
    const key = `${theta},${bowExtra}`; if (bounds.has(key)) return bounds.get(key) // no depende de la sal
    const { J } = waySpine(world, circuit, from, to, theta, bowExtra); const hs = HUB_STOPS.map(J)
    let minTube = Infinity; let minNode = Infinity; let minHub = Infinity
    for (const prev of placed) for (const h2 of prev.hubs) for (const h of hs) minHub = Math.min(minHub, h.distanceTo(h2.pos))
    for (const h of hs) {
      for (const o of others) { const d = h.distanceTo(o.pos); if (d < PORT_ZONE + BRAID_A + BRAID_PAD + 2.5 * TK) minNode = Math.min(minNode, d - hubR - PORT_ZONE) }
      if (!placed.grid) continue
      const x = Math.floor(h.x / SPATIAL_CELL); const y = Math.floor(h.y / SPATIAL_CELL); const z = Math.floor(h.z / SPATIAL_CELL)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const bucket = placed.grid.get(cellKey(x + dx, y + dy, z + dz)); if (!bucket) continue
        for (const q of bucket) { const g = h.distanceTo(q.p) - hubR - q.r - MIN_GAP_K * Math.max(P.radius, q.tube); if (g < minTube) minTube = g }
      }
    }
    const s = scoreOf({ minTube, minNode, minHub }); bounds.set(key, s); return s
  }
  const tryCand = (theta, bowExtra, salt) => {
    if (hubBound(theta, bowExtra) <= bestScore) return false // ponytail: cota heurística (minNode puede sesgarla), basta para podar
    // criba gruesa sin búsqueda de fila de rutas (sólo cota para podar); la fina mide el camino exacto que se colocaría
    const coarse = evalCand(buildWay(world, circuit, from, to, theta, bowExtra, false, salt, false), 14, bestScore)
    if (!coarse || scoreOf(coarse) <= bestScore) return false
    const res = evalCand(buildWay(world, circuit, from, to, theta, bowExtra, false, salt), 28, bestScore)
    if (!res) return false
    const score = scoreOf(res)
    if (score > bestScore) { bestScore = score; best = { theta, bowExtra, salt }; bestRes = res }
    return okRes(res, TARGET)
  }
  const BOWS = [-12, 0, 10, 20, 32, 46, 62, 80, 100].map((x) => x * WS * SIZE_K)
  const search = () => {
    for (const [half, salt] of [[0, 0], [0.5, 1], [0.25, 2]]) {
      for (const bowExtra of BOWS) {
        for (let k = 0; k < N_ANG; k++) {
          if (tryCand((baseTheta + ((k + half) / N_ANG) * TAU) % TAU, bowExtra, salt)) return true
        }
        if (bestRes && okRes(bestRes, TARGET_LOW)) return true // holgura cómoda tras cada panza: no recorrer las demás
      }
      if (bestRes && okRes(bestRes, TARGET_LOW)) return true // tras cada pasada completa basta una holgura cómoda: no agotar las demás
    }
    return false
  }
  if (!search() && !(bestRes && okRes(bestRes, CLEAR))) {
    // fases intermedias y más apertura de panza
    extra: for (const salt of [3, 4]) for (const bow of [-30, 0, 40, 120, 200, 300]) for (let k = 0; k < N_ANG; k += 2) {
      if (tryCand((baseTheta + ((k + 0.375) / N_ANG) * TAU) % TAU, bow * WS * SIZE_K, salt) || (bestRes && okRes(bestRes, CLEAR))) break extra
    }
  }
  if (best && bestRes && okRes(bestRes, CLEAR)) return commit(best)
  world.failed = true
  ;(world.failLog ||= []).push({ way: world.ways.length, circuit: circuit.idx, ...bestRes })
  return commit(best || { theta: baseTheta, bowExtra: 0, salt: 0 })
}

const FLEX_PLAIN = FLEX.filter((k) => !KINDS[k].event)
const GRAV_PLAIN = GRAV.filter((k) => !KINDS[k].event)
const EVENT_FLEX = FLEX.filter((k) => KINDS[k].event)
const EVENT_ALL = OBSTACLES.filter((k) => KINDS[k].event)

// Espina del sentido: J(s) de la boca de salida (s=0) a la de llegada (s=1); las uniones están en HUB_STOPS.
const HUB_STOPS = [0.16, 0.5, 0.84]
function waySpine(world, circuit, from, to, theta, bowExtra) {
  const a = world.nodes[from]; const b = world.nodes[to]; const P = PARAMS[circuit.theme.id]
  const S = a.verts[a.portTo[to].out].pos; const E = b.verts[b.portTo[from].in].pos
  // geodésica: círculo máximo de S a E sobre la esfera; n1 = lateral sobre la superficie, n2 = radial hacia fuera
  const dS = S.clone().normalize(); const dE = E.clone().normalize()
  let axis = new THREE.Vector3().crossVectors(dS, dE)
  if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3().crossVectors(dS, Math.abs(dS.y) > 0.9 ? X : Y)
  axis.normalize()
  const arcA = dS.angleTo(dE); const rS = S.length(); const rE = E.length()
  const radial = (s) => dS.clone().applyAxisAngle(axis, arcA * s)
  const ct = Math.cos(theta); const st = Math.sin(theta) // capa de altitud del camino: ±LAYER_K del radio (el grosor de la cáscara)
  const bow = P.bow + bowExtra
  const J = (s) => {
    const f = Math.pow(Math.sin(Math.PI * s), 0.72)
    const r = radial(s)
    const lat = new THREE.Vector3().crossVectors(axis, r)
    const p = r.clone().multiplyScalar(rS + (rE - rS) * s + SPHERE_R * LAYER_K * f * st + P.arch * f * 0.5).addScaledVector(lat, (from < to ? 1 : -1) * bow * f * ct * 0.7) // el sentido contrario ya trae el eje invertido: se compensa para que ida y vuelta queden en lados opuestos
    return p.lengthSq() > SPINE_MAX ** 2 ? p.setLength(SPINE_MAX) : p // panzas de reserva enormes: se quedan dentro de la cáscara
  }
  return { J, axis }
}

// ───────────────────────── un sentido de un circuito ─────────────────────────
function buildWay(world, circuit, from, to, theta = 0, bowExtra = 0, commit = true, salt = 0, rowSearch = true) {
  const { nodes } = world
  const a = nodes[from]; const b = nodes[to]; const theme = circuit.theme; const P = PARAMS[theme.id]
  const rng = mulberry32(7000 + circuit.idx * 31 + (from < to ? 0 : 1))
  const pOut = a.portTo[to]; const pIn = b.portTo[from]
  const S = a.verts[pOut.out].pos; const nS = a.verts[pOut.out].dir
  const E = b.verts[pIn.in].pos; const nE = b.verts[pIn.in].dir
  const { J, axis } = waySpine(world, circuit, from, to, theta, bowExtra)
  const n1 = axis.clone() // lateral de respaldo para la fila de rutas
  const stops = HUB_STOPS
  const hubs = stops.map(J)
  const hubT = stops.map((s) => J(s + 0.02).sub(J(s - 0.02)).normalize())

  const way = {
    idx: world.ways.length, id: `${from}>${to}`, circuit, from, to, ends: [a, b], theme, params: P, segments: [], routes: [],
    junctions: hubs.map((pos, i) => ({ pos, kind: ['fork', 'cross', 'merge'][i] })), length: 0,
  }
  const seg = (kind, curve, route, tramo) => {
    const K = KINDS[kind]
    if (!commit) curve.arcLengthDivisions = CAND_ARC_DIV // candidato: longitudes aproximadas bastan para medir holguras (el elegido se reconstruye fino)
    const s = {
      idx: commit ? world.segments.length : -1, i: way.segments.length, way, route, kind, name: K.name, emoji: K.emoji,
      curve, length: curve.getLength(), radius: P.radius, air: !!K.air, boost: K.boost * TK, drag: K.drag, // boost en u/s: escala con el trazado
      speedK: K.speedK ?? 1, event: K.event ? kind : null, risk: K.risk,
      next: [], tramo,
    }
    way.segments.push(s)
    if (commit) world.segments.push(s)
    return s
  }
  // rectas de parrilla/meta: salen del planeta inclinadas hacia su unión (las bocas vecinas divergen)
  const gridDir = (n, target, from, k) => { const t = target.clone().sub(from); t.addScaledVector(n, -t.dot(n)); return n.clone().addScaledVector(t.normalize(), k).normalize() }
  const tilt = [0.12, 0.04, 0.22][salt % 3] // casi radial: las bocas vecinas divergen en vez de cruzarse
  const gOut = gridDir(nS, hubs[0], S, tilt); const gIn = gridDir(nE, hubs[2], E, tilt)
  const launch = seg('salida', shape('salida', S, hubs[0], P, gOut, hubT[0], wrapMid(a, nS, hubs[0])), -1, [])

  // Reparto por identidad de ruta (A rápida/arriesgada, B lenta/segura, C espectacular) y tema.
  // Cada mitad sigue el ritmo: [tramo de entrada, evento, salida].
  const usedInWay = new Set()
  const usedEventMixes = new Set()
  const pickKind = (pool, role, usedInRoute, needEvent = false, rot = 0) => {
    const cands = pool.filter((k) => !usedInRoute.has(k))
    const list = cands.length ? cands : pool
    let best = list[0]; let bestScore = -Infinity
    for (let idx = 0; idx < list.length; idx++) {
      const k = list[(idx + rot) % list.length]
      const K = KINDS[k]; const sk = K.speedK ?? 1
      let sc = (P.fav.includes(k) ? 0.9 : 0) + (usedInWay.has(k) ? -1.8 : 0.8) + rng() * 0.9
      if (needEvent && K.event) sc += 2.2
      if (role === 'rapida') sc += (sk - 1) * 2.5 + K.risk * 1.1 + (sk < 0.9 ? -2.5 : 0)
      else if (role === 'lenta') sc += (1.15 - sk) * 2.6 + (0.6 - K.risk) * 1.3 + (sk > 1.45 ? -2.5 : 0)
      else sc += (K.event ? 0.7 : 0.4) + K.risk * 0.7 + (K.air ? 0.5 : 0)
      if (sc > bestScore) { bestScore = sc; best = k }
    }
    usedInRoute.add(best); usedInWay.add(best)
    return best
  }

  const heads = [[], []]; const tails = [[], []]; const plans = []
  for (let r = 0; r < P.n; r++) {
    const role = r === 0 ? 'rapida' : r === 1 ? 'lenta' : 'media'
    const usedInRoute = new Set()
    const halves = []
    for (let h = 0; h < 2; h++) {
      const evPool = h === 0 && (role === 'media' || P.fav.includes('cascada')) ? EVENT_ALL : EVENT_FLEX
      const ev = pickKind(evPool, role, usedInRoute, true, circuit.idx * 3 + r + h)
      if (KINDS[ev].drop) {
        const f1 = pickKind(FLEX_PLAIN, role, usedInRoute, false, circuit.idx + r + h)
        const f2 = pickKind(FLEX_PLAIN, role, usedInRoute, false, circuit.idx * 2 + r + h + 1)
        halves.push([f1, ev, f2])
      } else {
        const g = pickKind(GRAV_PLAIN, role, usedInRoute, false, circuit.idx + r + h)
        const f = pickKind(FLEX_PLAIN, role, usedInRoute, false, circuit.idx * 2 + r + h)
        halves.push(rng() < 0.5 ? [g, ev, f] : [f, ev, g])
      }
    }
    // Garantizar que las rutas de un mismo way no repitan exactamente la misma mezcla de eventos
    const mixKey = () => halves.map((t) => t[1]).sort().join(',')
    if (usedEventMixes.has(mixKey())) {
      const alt = EVENT_FLEX.find((k) => !usedInRoute.has(k))
      if (alt) {
        if (KINDS[halves[1][1]].drop) halves[1][0] = pickKind(GRAV_PLAIN, role, usedInRoute, false, r)
        halves[1][1] = alt; usedInRoute.add(alt); usedInWay.add(alt)
      }
    }
    usedEventMixes.add(mixKey())

    plans.push({ role, halves })
  }
  // Curvas de cada mitad: primero los puntos de paso de TODAS las rutas (para separarlos), luego sus formas.
  const curves = plans.map(() => [])
  const fixDrop = (Q, A, B, kinds) => {
    const [Q0, Q1] = Q; const [k0, k1, k2] = kinds
    const gIdx = kinds.findIndex((k) => KINDS[k].drop)
    if (gIdx === 0) {
      const drop = Math.max(KINDS[k0].drop, 0.7 * Math.hypot(Q0.x - A.x, Q0.z - A.z))
      Q0.y = Math.min(Q0.y, A.y - drop)
    } else if (gIdx === 1) {
      const drop = Math.max(KINDS[k1].drop, 0.7 * Math.hypot(Q1.x - Q0.x, Q1.z - Q0.z))
      const midY = (Q0.y + Q1.y) * 0.5
      Q0.y = Math.max(Q0.y, midY + drop * 0.55)
      Q1.y = Math.min(Q1.y, Q0.y - drop)
    } else if (gIdx === 2) {
      const drop = Math.max(KINDS[k2].drop, 0.7 * Math.hypot(Q1.x - B.x, Q1.z - B.z))
      Q1.y = Math.max(Q1.y, B.y + drop)
    }
  }
  // muestras de las rutas de cada mitad (u por cuerda acumulada: no depende de la tabla de longitudes del candidato)
  const halfPts = [[], []]
  const sampleHalf = (h) => {
    const out = []
    plans.forEach(({ halves }, r) => curves[r][h].forEach((cv, m) => {
      let L0 = 0; let q0 = cv.getPoint(0)
      for (let k = 1; k <= 24; k++) { const q = cv.getPoint(k / 24); L0 += q.distanceTo(q0); q0 = q }
      // 24 cuerdas subestiman el largo de hélices y rizos: u se normaliza con el acumulado fino (si no, acc/L > 1 cierra la trenza y la extensión sale corta)
      const n = clamp(Math.ceil(L0 / (5 * TK)), 8, 200); const ps = []; const accs = []; let acc = 0; let prev = null
      for (let k = 0; k <= n; k++) { const p = cv.getPoint(k / n); if (prev) acc += p.distanceTo(prev); prev = p; ps.push(p); accs.push(acc) }
      const pseudo = { length: acc, kind: halves[h][m], radius: P.radius }
      for (let k = 0; k <= n; k++) {
        const p = ps[k]
        const hubD = Math.min(p.distanceTo(hubs[0]), p.distanceTo(hubs[1]), p.distanceTo(hubs[2]))
        out.push({ p, h, route: r, hubD, ext: routeExtent(pseudo, accs[k] / acc), tube: P.radius })
      }
    }))
    halfPts[h] = out
  }
  // Por mitad: la primera apertura/orientación de la fila sin roces entre rutas; si ninguna, la de mayor holgura (layout.test lo detecta).
  const perms = PERMS[P.n]
  for (let h = 0; h < 2; h++) {
    if (!rowSearch) { buildHalf(h, SPREAD_STEPS[0], perms[0]); continue }
    let best = null; let last = null
    search: for (const mul of SPREAD_STEPS) for (const perm of perms) {
      buildHalf(h, mul, perm); sampleHalf(h); last = { mul, perm }
      const rs = routeSlack(h ? halfPts[0].concat(halfPts[1]) : halfPts[0], h)
      if (rs >= ROUTE_MARGIN) { best = null; break search }
      if (!best || rs > best.rs) best = { mul, perm, rs }
    }
    if (best && (best.mul !== last.mul || best.perm !== last.perm)) { buildHalf(h, best.mul, best.perm); sampleHalf(h) }
  }
  // perm[r]: puesto de la ruta r en la fila (0 = un lado, n-1 = el otro)
  function buildHalf(h, mul, perm) {
    const spread = P.spread * SPREAD_K * mul
    const A = hubs[h]; const B = hubs[h + 1]; const chord = B.clone().sub(A)
    // Las rutas van en fila a los lados de la cuerda, en horizontal: el desnivel (eje Y) de cada una no puede hacer que se crucen,
    // y en la segunda mitad la fila gira (cada ruta cambia de lado, se trenza) sólo en la unión.
    const side = new THREE.Vector3().crossVectors(Y, chord)
    if (side.length() < 0.05 * chord.length()) side.copy(n1) // cuerda casi vertical: cualquier horizontal sirve (n1 lo es si el eje del way lo es)
    side.normalize()
    const Qs = plans.map(({ halves }, r) => {
      const [k0, k1, k2] = halves[h]
      const w0 = KINDS[k0].w; const w1 = KINDS[k1].w; const w2 = KINDS[k2].w
      const wSum = w0 + w1 + w2
      const f0 = Math.min(clamp(w0 / wSum, 0.24, 0.38), FAN_D / chord.length())
      const f1 = Math.max(clamp((w0 + w1) / wSum, 0.62, 0.78), 1 - FAN_D / chord.length())
      // fila centrada en la cuerda (como mucho una ruta por lado): con la cuerda empinada, dos rutas del mismo lado que bajan
      // (gravedad) quedarían alineadas con la unión y se pisarían por mucho que se abra la fila. Cada ruta sigue de su lado en
      // ambas mitades: en la unión cross la cola y la cabeza de un mismo lado son de la misma ruta, nunca de dos distintas.
      const off = (perm[r] - (P.n - 1) / 2) * spread
      return [at(A, chord, f0, side, off), at(A, chord, f1, side, off)]
    })
    plans.forEach(({ halves }, r) => fixDrop(Qs[r], A, B, halves[h])) // el obstáculo de gravedad baja de verdad: se fuerza su desnivel
    plans.forEach(({ role, halves }, r) => {
      const kinds = halves[h]
      const [Q0, Q1] = Qs[r]
      // las paradas intermedias tampoco se hunden por dentro de la esfera
      for (const Q of [Q0, Q1]) if (Q.length() < SPHERE_R * 0.53) Q.setLength(SPHERE_R * 0.53)
      const Tbase = [Q1.clone().sub(A).normalize(), B.clone().sub(Q0).normalize()]
      const pts = [A, Q0, Q1, B]
      const cs = [null, null, null]
      for (let pass = 0; pass < 3; pass++) {
        for (let m = 0; m < 3; m++) {
          if (cs[m]) continue
          const needPrev = m > 0 && !ownsStart(kinds[m]) && KINDS[kinds[m - 1]].air
          const needNext = m < 2 && ownsStart(kinds[m + 1])
          if ((needPrev && !cs[m - 1]) || (needNext && !cs[m + 1])) continue
          const Ta = m === 0 ? hubT[h] : ownsStart(kinds[m]) ? null : (KINDS[kinds[m - 1]].air ? cs[m - 1].getTangent(1) : Tbase[m - 1])
          const Tb = m === 2 ? hubT[h + 1] : ownsStart(kinds[m + 1]) ? cs[m + 1].getTangent(0) : Tbase[m]
          // semilla propia por way, ruta y tramo: cada camino traza sus curvas a su manera
          const trk = { role, rng: mulberry32(7700 + salt * 1009 + circuit.idx * 97 + (from < to ? 0 : 53) + r * 11 + h * 5 + m) }
          cs[m] = shape(kinds[m], pts[m], pts[m + 1], P, Ta, Tb, null, trk)
        }
      }
      curves[r][h] = cs
    })
  }
  plans.forEach(({ role, halves }, r) => {
    const own = []
    for (let h = 0; h < 2; h++) {
      const kinds = halves[h]; const cs = curves[r][h]
      const [k0, k1, k2] = kinds
      const s0 = seg(k0, cs[0], r, kinds)
      const s1 = seg(k1, cs[1], r, kinds)
      const s2 = seg(k2, cs[2], r, kinds)
      s0.hubA = true; s2.hubB = true // nacen/mueren en una unión de rutas (braidDelay)
      s0.next = [s1.i]; s1.next = [s2.i]
      heads[h].push(s0); tails[h].push(s2); own.push(s0, s1, s2)
    }
    const avgSpeedK = own.reduce((sum, s) => sum + s.speedK, 0) / own.length
    const avgRisk = own.reduce((sum, s) => sum + s.risk, 0) / own.length
    const hasAir = own.some((s) => s.air)
    const thrill = clamp(Number((avgRisk * 0.65 + (hasAir ? 0.18 : 0) + Math.max(0, avgSpeedK - 1) * 0.3).toFixed(2)), 0, 1)
    const speed = role === 'rapida' ? 'rapida' : role === 'lenta' ? 'lenta' : (avgSpeedK >= 1.18 ? 'rapida' : avgSpeedK <= 0.96 ? 'lenta' : 'media')
    const label = speed === 'rapida' ? (thrill >= 0.55 ? 'Veloz y arriesgada' : 'Rápida')
      : speed === 'lenta' ? (thrill <= 0.42 ? 'Lenta y segura' : 'Tranquila')
      : (thrill >= 0.45 ? 'Espectacular' : 'Equilibrada')
    way.routes.push({
      idx: world.routes.length + r, r, name: 'ABC'[r], way, segments: own, kinds: own.map((s) => s.kind),
      length: 0, profile: { speed, thrill, label },
    })
  })
  launch.hubB = true
  const landing = seg('llegada', shape('llegada', hubs[2], E, P, hubT[2], gIn.clone().negate(), wrapMid(b, nE, hubs[2])), -1, [])
  landing.hubA = true
  launch.next = heads[0].map((s) => s.i)
  tails[0].forEach((s) => { s.next = heads[1].map((x) => x.i) })
  tails[1].forEach((s) => { s.next = [landing.i] })
  for (const rt of way.routes) {
    rt.segments = [launch, ...rt.segments, landing]
    rt.length = rt.segments.reduce((sum, s) => sum + s.length, 0)
    if (commit) world.routes.push(rt)
  }
  way.length = way.routes.reduce((sum, rt) => sum + rt.length, 0) / way.routes.length
  if (commit) {
    // marcos de pared: salida -> fork, cada medio-recorrido de ruta entre uniones, merge -> llegada
    sampleChain([launch], true)
    for (const rt of way.routes) {
      const own = rt.segments.slice(1, -1)
      sampleChain(own.slice(0, 3), true); sampleChain(own.slice(3, 6), true)
    }
    sampleChain([landing], false)
    buildLanes(way)
    pOut.wayOut = way; pIn.wayIn = way
    const tOut = a.terminals.find((t) => t.kind === 'out' && t.to === to)
    const tIn = b.terminals.find((t) => t.kind === 'in' && t.to === from)
    // bocas: tipo de puerta distinto en salida y llegada, y variado entre caminos
    way.gates = { out: OUT_GATES[(way.idx + from) % OUT_GATES.length], in: IN_GATES[(way.idx * 2 + to) % IN_GATES.length] }
    launch.gate = way.gates.out; landing.gate = way.gates.in
    if (tOut) Object.assign(tOut, { way, gate: way.gates.out, approach: { kind: 'parrilla', len: GRID_LEN, dir: gOut } })
    if (tIn) Object.assign(tIn, { way, gate: way.gates.in, approach: { kind: 'recta_meta', len: FINISH_LEN, dir: gIn } })
    world.ways.push(way); world.waysFrom[from].push(way)
  }
  return way
}


// ───────────────────────── colisión de cintas visibles ─────────────────────────
// Cada carril se ve como una cinta (calzada + bordillo + berma, pista.jsx) de semiancho RIBBON_HALF, centrada en la
// superficie del carril (relieve incluido). Dos cintas chocan si dos muestras (paso <= 1.5 u) quedan a menos de
// RIBBON_CLEAR: que una ballita quepa entre ambas, también si una pasa por encima de otra. Una cinta contra sí misma
// sólo cuenta a más de RIB_SELF de arco. Única excepción, las uniones diseñadas: dos cintas que nacen en un mismo punto
// (punta de tramo donde los carriles convergen, fork/cross/merge, nodo) pueden tocarse sólo en el tramo contiguo a ese
// punto mientras aún no se separan JOINT_SEP (prefijo contiguo desde la unión), y como mucho hasta que la trenza termina de abrirse:
// braidDelay + BRAID_RAMP en esa punta. En la zona cerrada (braidDelay: parrilla, recta de meta y junto a las uniones de
// rutas) los carriles de un mismo tramo van juntos, coinciden por diseño y ni se comparan.
export const RIBBON_CURB = 0.17 * TK
export const RIBBON_TERR = 0.55 * TK
export const RIBBON_HALF = LANE_W / 2 + RIBBON_CURB + RIBBON_TERR
export const RIBBON_GAP = 0.8 * TK // hueco entre cintas: una ballita con TRACK_K = 1 (escala con el trazado)
export const RIBBON_CLEAR = 2 * RIBBON_HALF + RIBBON_GAP
// Margen que sobresale de la berma para cubrir los anillos neón y la decoración lateral.
// El anillo de anillos.jsx usa escala (H + CURB + TERR * 0.55) * 2.15; se toma su
// envolvente completa respecto del centro del carril para medir el espacio que ve la cámara.
export const VISUAL_PAD = Math.max(0, (LANE_W / 2 + RIBBON_CURB + RIBBON_TERR * 0.55) * 2.15 - RIBBON_HALF)
const RIB_STEP = 1.5 * TK
const RIB_SELF = 12 * TK
// histéresis de la unión: dos cintas que nacen juntas quedan exentas hasta separarse esto (una ballita y un margen);
// desde ahí ya no pueden volver a bajar de RIBBON_CLEAR
export const JOINT_SEP = RIBBON_CLEAR + 0.4 * TK
// tope (u de arco desde la punta) de la zona exenta de una unión: más allá, todo par a menos de RIBBON_CLEAR es choque
export const JOINT_MAX = 25 * TK

function ribbonEndKey(world, x, y, z) {
  for (const n of world.nodes) if ((x - n.pos.x) ** 2 + (y - n.pos.y) ** 2 + (z - n.pos.z) ** 2 < (NODE_R + TK) ** 2) return 'n' + n.idx
  const q = 20 / TK
  return `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`
}
const ribbonsOf = (world) => world.ways.flatMap((way) => way.segments.filter((s) => !s.air && s.lanes).flatMap((seg) => seg.lanes.map((l) => [way, seg, l.id])))
// Índices de muestra de la zona cerrada de la trenza y del tope de unión en cada punta.
function ribMeta(r) {
  const k = r.n / r.seg.length; const [a, b] = braidDelay(r.seg)
  r.closed = [Math.floor(a * k), Math.floor(b * k)]; r.capI = [JOINT_MAX / r.ds, JOINT_MAX / r.ds]
  return r
}
function packRibbons(ribs, xs, rs) {
  const N = rs.length; const X = new Float64Array(N); const Yy = new Float64Array(N); const Z = new Float64Array(N)
  for (let i = 0; i < N; i++) { X[i] = xs[i * 3]; Yy[i] = xs[i * 3 + 1]; Z[i] = xs[i * 3 + 2] }
  return { ribs, X, Y: Yy, Z, R: Int32Array.from(rs) }
}

// Muestras exactas de lo que dibuja la pista (laneFrame(...).surface), para medir: { ribs[], X, Y, Z, R }.
export function ribbonSamples(world) {
  const ribs = []; const xs = []; const rs = []; const F = {}
  for (const [way, seg, id] of ribbonsOf(world)) {
    const L = laneLength(seg, id); const n = Math.max(4, Math.ceil(Math.max(seg.length, L) / RIB_STEP))
    const r = { idx: ribs.length, way, seg, lane: id, start: rs.length, n, ds: L / n, ends: [] }
    for (let i = 0; i <= n; i++) {
      const p = laneFrame(seg, id, i / n, F).surface
      xs.push(p.x, p.y, p.z); rs.push(r.idx)
      if (i === 0 || i === n) r.ends.push(ribbonEndKey(world, p.x, p.y, p.z))
    }
    ribs.push(ribMeta(r))
  }
  return packRibbons(ribs, xs, rs)
}

// Muestras sobre los vértices de la trenza (surface = P + O, O = relieve a lo largo de la normal): baratas y movibles.
function braidRibbons(world) {
  const ribs = []; const xs = []; const rs = []; const W = {}
  for (const [way, seg, id] of ribbonsOf(world)) {
    const br = seg._braid; const N = br.N; const P = br.P[id]; const O = new Float32Array((N + 1) * 3)
    const r = { idx: ribs.length, way, seg, lane: id, start: rs.length, n: N, ds: laneLength(seg, id) / N, ends: [], P, O }
    for (let i = 0; i <= N; i++) {
      const u = i / N; const d = wallFrame(seg, laneAngle(seg, id, u), u, 0, W).dir; const h = -laneRelief(seg, id, u)
      O[i * 3] = d.x * h; O[i * 3 + 1] = d.y * h; O[i * 3 + 2] = d.z * h
      const x = P[i * 3] + O[i * 3]; const y = P[i * 3 + 1] + O[i * 3 + 1]; const z = P[i * 3 + 2] + O[i * 3 + 2]
      xs.push(x, y, z); rs.push(r.idx)
      if (i === 0 || i === N) r.ends.push(ribbonEndKey(world, x, y, z))
    }
    ribs.push(ribMeta(r))
  }
  return packRibbons(ribs, xs, rs)
}

// Par de muestras i < j a menos de sqrt(L2): se anota en out (Map(cintaA * 65536 + cintaB -> [i, j, d, ...])). Se saltan la
// misma cinta a menos de RIB_SELF de arco y los carriles de un mismo tramo dentro de su zona cerrada (coinciden por diseño).
function testPair(S, i, j, L2, out) {
  const { ribs, X, Y: Yy, Z, R } = S; const ri = R[i]; const rj = R[j]; const A = ribs[ri]; const B = ribs[rj]
  if (ri === rj && (j - i) * A.ds < RIB_SELF) return
  if (A.seg === B.seg && ((i - A.start < A.closed[0] && j - B.start < B.closed[0]) || (A.start + A.n - i < A.closed[1] && B.start + B.n - j < B.closed[1]))) return
  const d2 = (X[i] - X[j]) ** 2 + (Yy[i] - Yy[j]) ** 2 + (Z[i] - Z[j]) ** 2
  if (d2 >= L2) return
  const key = ri * 65536 + rj; let l = out.get(key); if (!l) out.set(key, l = []); l.push(i, j, Math.sqrt(d2))
}
// Rejilla de celdas de lado `lim` con las muestras que pasan `keep`.
function sampleGrid(S, lim, keep) {
  const { X, Y: Yy, Z } = S; const cell = (v) => Math.floor(v / lim); const grid = new Map()
  for (let i = 0; i < X.length; i++) { if (!keep(i)) continue; const k = cellKey(cell(X[i]), cell(Yy[i]), cell(Z[i])); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i) }
  return grid
}
// Visita las muestras de las 27 celdas alrededor de la muestra i.
function nearCells(S, grid, lim, i, fn) {
  const x = Math.floor(S.X[i] / lim); const y = Math.floor(S.Y[i] / lim); const z = Math.floor(S.Z[i] / lim)
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    const b = grid.get(cellKey(x + dx, y + dy, z + dz)); if (b) for (const j of b) fn(j)
  }
}
// Todos los pares de muestras a menos de `lim`.
function gatherPairs(S, lim) {
  const sh = S.shadow; const grid = sampleGrid(S, lim, (i) => !(sh && sh[i])); const out = new Map(); const L2 = lim * lim
  for (const b of grid.values()) for (const i of b) nearCells(S, grid, lim, i, (j) => { if (j > i) testPair(S, i, j, L2, out) })
  return out
}

// Juzga pares (d < hitD choca) con la excepción de uniones (prefijo: pares a menos de JOINT_SEP). { hits: [i, j, d, ...], slack (peor d - RIBBON_CLEAR fuera
// de uniones; Infinity si no hubo pares), joint (arco máximo exento desde una unión, u) }.
function judgePairs(S, pairs, hitD) {
  const { ribs, R } = S; const hits = []; let slack = Infinity; let joint = 0
  // desglose de la zona exenta por tipo de punta: nodo (puerto), unión de rutas (fork/cross/merge) y carriles de un mismo tramo
  const jointBy = { nodo: 0, union: 0, carril: 0 }
  // prefijo contiguo desde la punta e que sigue chocando con la otra cinta (la zona cerrada cuenta si es el mismo tramo)
  const pre = (set, r, e, ss) => { let c = ss ? r.closed[e] : 0; while (c <= r.n && c < r.capI[e] && set.has(e ? r.n - c : c)) c++; return c }
  for (const l of pairs.values()) {
    const A = ribs[R[l[0]]]; const B = ribs[R[l[1]]]
    let zones = null
    if (A !== B) {
      for (let ea = 0; ea < 2; ea++) for (let eb = 0; eb < 2; eb++) if (A.ends[ea] === B.ends[eb]) (zones ||= []).push([ea, eb, A.seg === B.seg])
      if (zones) {
        const inA = new Set(); const inB = new Set()
        for (let k = 0; k < l.length; k += 3) if (l[k + 2] < JOINT_SEP) { inA.add(l[k] - A.start); inB.add(l[k + 1] - B.start) }
        zones = zones.map(([ea, eb, ss]) => [ea, pre(inA, A, ea, ss), eb, pre(inB, B, eb, ss)])
      }
    }
    for (let k = 0; k < l.length; k += 3) {
      const ia = l[k] - A.start; const ib = l[k + 1] - B.start; const d = l[k + 2]
      const z = zones && zones.find(([ea, ca, eb, cb]) => (ea ? A.n - ia : ia) < ca && (eb ? B.n - ib : ib) < cb)
      if (z) {
        if (d < hitD) {
          const ja = Math.max((z[0] ? A.n - ia : ia) * A.ds, (z[2] ? B.n - ib : ib) * B.ds)
          joint = Math.max(joint, ja)
          const t = A.ends[z[0]][0] === 'n' ? 'nodo' : A.seg === B.seg ? 'carril' : 'union'
          if (ja > jointBy[t]) jointBy[t] = ja
        }
        continue
      }
      slack = Math.min(slack, d - RIBBON_CLEAR)
      if (d < hitD) hits.push(l[k], l[k + 1], d)
    }
  }
  return { hits, slack, joint, jointBy }
}

// Choques reales entre cintas visibles (ver arriba). { hits: [i, j, d, ...] (índices de muestra en S), slack, joint, S }.
export function ribbonHits(world, S = ribbonSamples(world)) {
  return { ...judgePairs(S, gatherPairs(S, JOINT_SEP + 0.6 * TK), RIBBON_CLEAR), S }
}

// ───────────────────────── espacio visible entre cintas (medidor en el marco local) ─────────────────────────
// Lo que ve la cámara de seguimiento, medido en el marco real de cada carril (laneFrame: up/side/tangent con relieve,
// giro y peralte). Para cada muestra de la cinta A y cada trozo cercano de la cinta B (rectángulo de semiancho
// RIBBON_HALF, largo de su paso y grosor de quilla QUILLA, expresado en los ejes de A):
//   galibo : B entra en el prisma libre sobre la calzada de A (ancho CALZADA_HALF·2, alto GALIBO_H a lo largo de up).
//   lateral: el aire entre los bordes visibles (bermas incluidas) de A y B es menor que AIRE_LAT.
//   union  : en la zona de unión (prefijo contiguo desde una punta común) dos cintas sólo pueden solaparse si son
//            coplanares (normales con dot >= COPLANAR_DOT y desnivel <= COPLANAR_Y): se leen como una calzada que se
//            ensancha o bifurca. Mientras se separan sin solaparse (aire < AIRE_LAT) quedan exentas; el largo de esa
//            zona se reporta (unionSep). Un solape no coplanar dentro de la unión es choque.
// La prueba es asimétrica (B sobre A no es A sobre B): se evalúan los dos sentidos. Una cinta contra sí misma cuenta a
// más de RIB_SELF de arco (rizos, hélices).
export const GALIBO_H = 6 * TK
export const AIRE_LAT = 2 * RIBBON_HALF
export const CALZADA_HALF = LANE_W / 2 + RIBBON_CURB
export const QUILLA = 0.75 // quilla de la cinta bajo el firme (pista.jsx profile: 0.48 · k, k <= 1.55)
export const COPLANAR_DOT = 0.98
export const COPLANAR_Y = 0.25
const CLR_STEP = 1 * TK
const CLR_LIM = GALIBO_H + 2 * RIBBON_HALF + QUILLA + 2 * CLR_STEP

// Muestras densas con marco: { ribs[], X,Y,Z, UX..,SX..,TX.., H (semipaso), R }.
export function clearanceSamples(world) {
  const ribs = []; const F = {}; const cols = { X: [], Y: [], Z: [], UX: [], UY: [], UZ: [], SX: [], SY: [], SZ: [], TX: [], TY: [], TZ: [], R: [] }
  for (const [way, seg, id] of ribbonsOf(world)) {
    const L = laneLength(seg, id); const n = Math.max(4, Math.ceil(Math.max(seg.length, L) / CLR_STEP))
    const r = { idx: ribs.length, way, seg, lane: id, start: cols.X.length, n, ds: L / n, ends: [] }
    for (let i = 0; i <= n; i++) {
      const f = laneFrame(seg, id, i / n, F); const p = f.surface
      cols.X.push(p.x); cols.Y.push(p.y); cols.Z.push(p.z)
      cols.UX.push(f.up.x); cols.UY.push(f.up.y); cols.UZ.push(f.up.z)
      cols.SX.push(f.side.x); cols.SY.push(f.side.y); cols.SZ.push(f.side.z)
      cols.TX.push(f.tangent.x); cols.TY.push(f.tangent.y); cols.TZ.push(f.tangent.z)
      cols.R.push(r.idx)
      if (i === 0 || i === n) r.ends.push(ribbonEndKey(world, p.x, p.y, p.z))
    }
    ribs.push(r)
  }
  const S = { ribs }
  for (const k in cols) S[k] = k === 'R' ? Int32Array.from(cols.R) : Float64Array.from(cols[k])
  return S
}

// Relación de la muestra j (trozo de B) vista desde la muestra i (marco de A). Devuelve en `o`: gal (B en el prisma de
// A), dist (aire entre bordes, u; 0 si se solapan), over (las cintas se solapan), cop (coplanares), abreast (B a la
// altura de i a lo largo de A). hA/hB: semipaso a lo largo de cada cinta.
function relate(S, i, j, hA, hB, o) {
  const H = RIBBON_HALF; const q = QUILLA / 2
  const ux = S.UX[i]; const uy = S.UY[i]; const uz = S.UZ[i]; const sx = S.SX[i]; const sy = S.SY[i]; const sz = S.SZ[i]
  const tx = S.TX[i]; const ty = S.TY[i]; const tz = S.TZ[i]
  const bux = S.UX[j]; const buy = S.UY[j]; const buz = S.UZ[j]
  // centro del trozo de B (a media quilla bajo su firme), en ejes de A
  const dx = S.X[j] - bux * q - S.X[i]; const dy = S.Y[j] - buy * q - S.Y[i]; const dz = S.Z[j] - buz * q - S.Z[i]
  const cx = dx * sx + dy * sy + dz * sz; const cy = dx * ux + dy * uy + dz * uz; const cz = dx * tx + dy * ty + dz * tz
  const bsx = S.SX[j]; const bsy = S.SY[j]; const bsz = S.SZ[j]; const btx = S.TX[j]; const bty = S.TY[j]; const btz = S.TZ[j]
  // semiextensión del trozo de B a lo largo de cada eje de A (caja orientada -> caja en ejes de A)
  const ext = (ax, ay, az) => H * Math.abs(bsx * ax + bsy * ay + bsz * az) + hB * Math.abs(btx * ax + bty * ay + btz * az) + q * Math.abs(bux * ax + buy * ay + buz * az)
  const ex = ext(sx, sy, sz); const ey = ext(ux, uy, uz); const ez = ext(tx, ty, tz)
  o.abreast = Math.abs(cz) - ez <= hA
  o.gal = o.abreast && Math.abs(cx) - ex < CALZADA_HALF && cy - ey < GALIBO_H && cy + ey > 0
  // cinta de A: x en ±H, y en [-QUILLA, 0.03]
  const gx = Math.abs(cx) - ex - H; const gy = cy >= 0 ? cy - ey - 0.03 : -cy - ey - QUILLA
  o.over = gx < 0 && gy < 0
  o.dist = Math.hypot(Math.max(gx, 0), Math.max(gy, 0))
  const dot = ux * bux + uy * buy + uz * buz
  o.cop = dot >= COPLANAR_DOT && Math.abs(cy + q) <= COPLANAR_Y
  return o
}

// Medidor de espacio entre cintas (ver arriba). { galibo, lateral, union: { n, worst, at }, unionSep (u máx. de una zona
// de unión sin aire), hits: [{ cat, a, b, ... }] (los primeros), S }. worst: galibo -> mínima altura libre sobre la
// calzada; lateral -> mínimo aire entre bordes.
export function ribbonClearance(world, S = clearanceSamples(world), { maxList = 400 } = {}) {
  const { ribs, X, Y: Yy, Z, R } = S; const N = X.length; const lim = CLR_LIM; const L2 = lim * lim
  const cell = (v) => Math.floor(v / lim); const grid = new Map()
  for (let i = 0; i < N; i++) { const k = cellKey(cell(X[i]), cell(Yy[i]), cell(Z[i])); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i) }
  const half = (i) => { const r = ribs[R[i]]; return r.ds * 0.5 + 0.05 }
  // pares por par de cintas: [i, j, flags] con flags bit0 gal(A<-B) bit1 gal(B<-A) bit2 over bit3 cop; dist aparte
  const pairs = new Map(); const o1 = {}; const o2 = {}
  for (let i = 0; i < N; i++) {
    const x = cell(X[i]); const y = cell(Yy[i]); const z = cell(Z[i]); const ri = R[i]; const A = ribs[ri]
    for (let ddx = -1; ddx <= 1; ddx++) for (let ddy = -1; ddy <= 1; ddy++) for (let ddz = -1; ddz <= 1; ddz++) {
      const b = grid.get(cellKey(x + ddx, y + ddy, z + ddz)); if (!b) continue
      for (const j of b) {
        if (j <= i) continue
        const rj = R[j]
        if (ri === rj && (j - i) * A.ds < RIB_SELF) continue
        const d2 = (X[i] - X[j]) ** 2 + (Yy[i] - Yy[j]) ** 2 + (Z[i] - Z[j]) ** 2; if (d2 >= L2) continue
        const hA = half(i); const hB = half(j)
        relate(S, i, j, hA, hB, o1); relate(S, j, i, hB, hA, o2)
        if (!o1.abreast && !o2.abreast) continue
        const dist = Math.min(o1.abreast ? o1.dist : Infinity, o2.abreast ? o2.dist : Infinity)
        const gal = (o1.gal ? 1 : 0) | (o2.gal ? 2 : 0)
        if (!gal && dist >= AIRE_LAT) continue
        const key = ri * 65536 + rj; let l = pairs.get(key); if (!l) pairs.set(key, l = [])
        l.push(i, j, gal | ((o1.over || o2.over) ? 4 : 0) | ((o1.cop && o2.cop) ? 8 : 0), dist)
      }
    }
  }
  const out = { galibo: { n: 0, worst: Infinity, at: '' }, lateral: { n: 0, worst: Infinity, at: '' }, union: { n: 0, worst: 0, at: '' }, unionSep: 0, unionSepAt: '', hits: [], S }
  const tag = (i) => { const r = ribs[R[i]]; return `w${r.way.idx} ${r.seg.kind}/r${r.seg.route} L${r.lane}@${((i - r.start) / r.n).toFixed(2)}` }
  const cap = JOINT_MAX
  for (const l of pairs.values()) {
    const A = ribs[R[l[0]]]; const B = ribs[R[l[1]]]
    // zonas de unión: puntas comunes; prefijo contiguo (desde la punta) de muestras con algún par cercano
    let zones = null
    if (A !== B) {
      for (let ea = 0; ea < 2; ea++) for (let eb = 0; eb < 2; eb++) if (A.ends[ea] === B.ends[eb]) (zones ||= []).push([ea, eb])
      if (zones) {
        const inA = new Set(); const inB = new Set()
        for (let k = 0; k < l.length; k += 4) { inA.add(l[k] - A.start); inB.add(l[k + 1] - B.start) }
        const pre = (set, r, e) => { let c = 0; while (c <= r.n && c * r.ds < cap && (set.has(e ? r.n - c : c) || set.has(e ? r.n - c - 1 : c + 1))) c++; return c }
        zones = zones.map(([ea, eb]) => [ea, pre(inA, A, ea), eb, pre(inB, B, eb)])
      }
    }
    for (let k = 0; k < l.length; k += 4) {
      const i = l[k]; const j = l[k + 1]; const fl = l[k + 2]; const dist = l[k + 3]
      const ia = i - A.start; const ib = j - B.start
      const z = zones && zones.find(([ea, ca, eb, cb]) => (ea ? A.n - ia : ia) < ca && (eb ? B.n - ib : ib) < cb)
      if (z) {
        const s = Math.max((z[0] ? A.n - ia : ia) * A.ds, (z[2] ? B.n - ib : ib) * B.ds)
        if ((fl & 7) && !(fl & 8)) {
          out.union.n++
          if (s > out.union.worst) Object.assign(out.union, { worst: s, at: `${tag(i)} vs ${tag(j)}` })
          if (out.hits.length < maxList) out.hits.push({ cat: 'union', a: i, b: j, s })
        } else if (s > out.unionSep) { out.unionSep = s; out.unionSepAt = `${tag(i)} vs ${tag(j)}` }
        continue
      }
      if (fl & 3) {
        out.galibo.n++
        // altura libre aproximada: distancia vertical del firme de A al punto más bajo de B (o al revés)
        const ii = fl & 1 ? i : j; const jj = fl & 1 ? j : i
        const hy = (X[jj] - X[ii]) * S.UX[ii] + (Yy[jj] - Yy[ii]) * S.UY[ii] + (Z[jj] - Z[ii]) * S.UZ[ii]
        if (hy < out.galibo.worst) Object.assign(out.galibo, { worst: hy, at: `${tag(ii)} bajo ${tag(jj)}` })
        if (out.hits.length < maxList) out.hits.push({ cat: 'galibo', a: ii, b: jj, h: hy })
      } else if (dist < AIRE_LAT) {
        out.lateral.n++
        if (dist < out.lateral.worst) Object.assign(out.lateral, { worst: dist, at: `${tag(i)} vs ${tag(j)}` })
        if (out.hits.length < maxList) out.hits.push({ cat: 'lateral', a: i, b: j, d: dist })
      }
    }
  }
  return out
}

// Estructuras (esferas { center, r, way, seg, lane }) que invaden el prisma de gálibo o cortan la calzada de una cinta
// AJENA a su carril. { n, worst (máx. penetración, u), at, list }.
export function structureIntrusions(S, items, { maxList = 200 } = {}) {
  const { ribs, X, Y: Yy, Z, R } = S; const lim = CLR_LIM; const cell = (v) => Math.floor(v / lim); const grid = new Map()
  for (let i = 0; i < X.length; i++) { const k = cellKey(cell(X[i]), cell(Yy[i]), cell(Z[i])); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i) }
  const out = { n: 0, worst: 0, at: '', list: [] }
  const tag = (i) => { const r = ribs[R[i]]; return `w${r.way.idx} ${r.seg.kind}/r${r.seg.route} L${r.lane}@${((i - r.start) / r.n).toFixed(2)}` }
  for (const it of items) {
    const c = it.center; const r = it.r; const rings = Math.ceil((r + lim) / lim)
    const x0 = cell(c.x); const y0 = cell(c.y); const z0 = cell(c.z); let worst = 0; let wi = -1
    for (let dx = -rings; dx <= rings; dx++) for (let dy = -rings; dy <= rings; dy++) for (let dz = -rings; dz <= rings; dz++) {
      const b = grid.get(cellKey(x0 + dx, y0 + dy, z0 + dz)); if (!b) continue
      for (const i of b) {
        const rb = ribs[R[i]]
        if (rb.way.idx === (it.way?.idx ?? it.way) && rb.seg === it.seg && rb.lane === it.lane) continue
        const ex = c.x - X[i]; const ey = c.y - Yy[i]; const ez = c.z - Z[i]
        const cz = ex * S.TX[i] + ey * S.TY[i] + ez * S.TZ[i]; if (Math.abs(cz) > r + rb.ds * 0.5) continue
        const cx = Math.abs(ex * S.SX[i] + ey * S.SY[i] + ez * S.SZ[i]); const cy = ex * S.UX[i] + ey * S.UY[i] + ez * S.UZ[i]
        // penetración en el prisma [±CALZADA_HALF] x [-QUILLA, GALIBO_H]
        const p = Math.min(CALZADA_HALF - (cx - r), (cy + r) + QUILLA, GALIBO_H - (cy - r))
        if (p > worst) { worst = p; wi = i }
      }
    }
    if (wi >= 0) {
      out.n++
      if (worst > out.worst) Object.assign(out, { worst, at: `${it.kind} w${it.way?.idx ?? it.way} L${it.lane} en ${tag(wi)}` })
      if (out.list.length < maxList) out.list.push({ kind: it.kind, item: it, i: wi, p: worst })
    }
  }
  return out
}

// Repulsión: cada par de muestras en choque empuja sus cintas en direcciones opuestas, sobre los vértices de la trenza.
// Entre tramos distintos se mueve el haz entero (todos los carriles del tramo a la vez: no se aprietan contra sus
// hermanos); entre carriles del mismo tramo, o una cinta consigo misma, sólo esos carriles. Cada desplazamiento se suaviza
// a lo largo del tramo (curva continua y transitable), se ancla a 0 en las puntas (las uniones no se mueven) y un resorte
// lo devuelve hacia la forma original. Se repite hasta 0 choques o RELAX_IT pasadas.
const RELAX_IT = 60
const RELAX_MARGIN = JOINT_SEP - RIBBON_CLEAR // (u) se separa un poco más de RIBBON_CLEAR: el dibujo interpola entre vértices
const RELAX_DONE = 0.3 * TK // (u) se para cuando ningún par fuera de uniones queda a menos de RIBBON_CLEAR + esto
const RELAX_PIN = 4 * TK // (u) rampa de anclaje en cada punta
const RELAX_SPRING = 0.004
const RELAX_SIG = 6 // (vértices, ~1.5 u cada uno) ancho de la campana con que se reparte cada empuje
const RELAX_K = 18
// empuje de cada par en choque, sobre su déficit: más que el déficit porque el suavizado gaussiano lo reparte y lo diluye
// (con la trenza abierta cerca de las uniones hay más pares; 3.5 converge en la mitad de pasadas que 1.5)
const RELAX_PUSH = 3.5
const RELAX_EPS = 0.03 * TK // (u) una muestra desplazada menos que esto desde su última búsqueda conserva sus pares
function relaxRibbons(world) {
  const t0 = performance.now()
  const S = braidRibbons(world); const { ribs, X, Y: Yy, Z, R } = S; const N = X.length
  // tramos: desplazamiento común del haz (G) y lista de sus cintas; la zona cerrada la representa el primer carril
  const segs = new Map(); const shadow = S.shadow = new Uint8Array(N)
  for (const r of ribs) {
    let g = segs.get(r.seg)
    if (!g) {
      segs.set(r.seg, g = { ribs: [], n: r.n, ds: r.seg.length / r.n, D: new Float32Array((r.n + 1) * 3), F: new Float32Array((r.n + 1) * 3), c: new Uint16Array(r.n + 1), on: false })
    } else for (let i = 0; i <= r.n; i++) if (i < r.closed[0] || r.n - i < r.closed[1]) shadow[r.start + i] = 1
    g.ribs.push(r); r.g = g
  }
  const D = new Float32Array(N * 3); const F = new Float32Array(N * 3); const cnt = new Uint16Array(N)
  const pinOf = (i, n, ds) => smooth01((Math.min(i, n - i) * ds) / RELAX_PIN)
  const G = Array.from({ length: RELAX_K + 1 }, (_, d) => Math.exp(-(d * d) / (2 * RELAX_SIG * RELAX_SIG)))
  // reparte los empujes (F, promediados por c) en campanas gaussianas de amplitud completa sobre A (desde el índice o):
  // cerca de un choque manda la media de los empujes vecinos; lejos, decae. Luego ancla las puntas y aplica el resorte.
  const push = (A, Fv, c, fo, o, n, ds) => {
    for (let j = 0; j <= n; j++) {
      let sx = 0; let sy = 0; let sz = 0; let sw = 0
      for (let i = Math.max(0, j - RELAX_K); i <= Math.min(n, j + RELAX_K); i++) {
        const q = fo + i; if (!c[q]) continue
        const w = G[Math.abs(i - j)] / c[q]; sw += G[Math.abs(i - j)]; sx += w * Fv[q * 3]; sy += w * Fv[q * 3 + 1]; sz += w * Fv[q * 3 + 2]
      }
      const k = sw > 0 ? Math.min(1, sw) / sw : 0; const t = (o + j) * 3; const pw = pinOf(j, n, ds) * (1 - RELAX_SPRING)
      A[t] = (A[t] + sx * k) * pw; A[t + 1] = (A[t + 1] + sy * k) * pw; A[t + 2] = (A[t + 2] + sz * k) * pw
    }
  }
  const hitD = RIBBON_CLEAR + RELAX_MARGIN; const L2 = hitD * hitD; const act = new Uint8Array(ribs.length); const live = new Set()
  // cada pasada busca los pares de las muestras de tramos que se mueven contra las demás que se mueven (posición actual)
  // y contra las quietas (rejilla fija de la posición inicial)
  const still = sampleGrid(S, hitD, (i) => !shadow[i])
  // muestras ya desplazadas (moved) y, de ellas, las sucias (dirty): se movieron más de RELAX_EPS desde su última búsqueda
  // de vecinos. Sólo las sucias buscan vecinos de nuevo; los pares de las demás se arrastran de la pasada anterior con la
  // distancia recalculada (un par nuevo entre dos limpias se pierde a lo sumo por 2·RELAX_EPS, dentro de RELAX_MARGIN).
  const moved = new Uint8Array(N); const dirty = new Uint8Array(N); let prev = null
  const LX = Float64Array.from(X); const LY = Float64Array.from(Yy); const LZ = Float64Array.from(Z); const E2 = RELAX_EPS * RELAX_EPS
  let it = 0; let left = 0
  for (; it < RELAX_IT; it++) {
    let pairs
    if (!it) pairs = gatherPairs(S, hitD)
    else {
      pairs = new Map()
      for (const [k, l] of prev) {
        let a = null
        for (let q = 0; q < l.length; q += 3) {
          const i = l[q]; const j = l[q + 1]; if (dirty[i] || dirty[j]) continue
          let d = l[q + 2]
          if (moved[i] || moved[j]) { const d2 = (X[i] - X[j]) ** 2 + (Yy[i] - Yy[j]) ** 2 + (Z[i] - Z[j]) ** 2; if (d2 >= L2) continue; d = Math.sqrt(d2) }
          (a ||= []).push(i, j, d)
        }
        if (a) pairs.set(k, a)
      }
      const mov = sampleGrid(S, hitD, (i) => moved[i] && !shadow[i])
      for (const b of mov.values()) for (const i of b) {
        if (!dirty[i]) continue
        nearCells(S, mov, hitD, i, (j) => { if (j > i || !dirty[j]) testPair(S, Math.min(i, j), Math.max(i, j), L2, pairs) })
        nearCells(S, still, hitD, i, (j) => { if (!moved[j]) testPair(S, Math.min(i, j), Math.max(i, j), L2, pairs) })
      }
    }
    prev = pairs
    const { hits } = judgePairs(S, pairs, hitD)
    left = hits.length / 3
    if (globalThis.__RELAX_DBG) globalThis.__RELAX_DBG.push({ it, left, hits: hits.slice(0, 3000), t: performance.now() - t0, S })
    let deep = 0; for (let q = 2; q < hits.length; q += 3) if (hits[q] < RIBBON_CLEAR + RELAX_DONE) deep++
    if (!deep) break // lo que queda ya pasa la medida con holgura: no se gastan más pasadas en el margen
    F.fill(0); cnt.fill(0)
    for (const g of live) { g.F.fill(0); g.c.fill(0) }
    for (let q = 0; q < hits.length; q += 3) {
      const a = hits[q]; const b = hits[q + 1]; const d = hits[q + 2]; const m = (hitD - d) * RELAX_PUSH
      const A = ribs[R[a]]; const B = ribs[R[b]]
      let nx = X[a] - X[b]; let ny = Yy[a] - Yy[b]; let nz = Z[a] - Z[b]
      if (d > 1e-3) { nx /= d; ny /= d; nz /= d } else { const o = (a - A.start) * 3; nx = A.O[o]; ny = A.O[o + 1]; nz = A.O[o + 2]; const l = Math.hypot(nx, ny, nz); if (l > 1e-6) { nx /= l; ny /= l; nz /= l } else { nx = 0; ny = 1; nz = 0 } }
      for (const [r, s, sg, o] of [[A, a, 1, b], [B, b, -1, a]]) {
        if (A.seg !== B.seg) {
          // el haz se aparta desde la muestra ajena hacia su propio eje (carril central): si la otra cinta lo atraviesa
          // por dentro, sus carriles empujarían en sentidos opuestos y se anularían
          const g = r.g; const i = s - r.start; const c = g.ribs[0].start + i
          let ex = X[c] - X[o]; let ey = Yy[c] - Yy[o]; let ez = Z[c] - Z[o]; const el = Math.hypot(ex, ey, ez)
          if (el > 0.3 * TK) { ex /= el; ey /= el; ez /= el } else { ex = sg * nx; ey = sg * ny; ez = sg * nz }
          g.F[i * 3] += ex * m; g.F[i * 3 + 1] += ey * m; g.F[i * 3 + 2] += ez * m; g.c[i]++
          if (!g.on) { g.on = true; live.add(g); for (const x of g.ribs) act[x.idx] = 1 }
        } else {
          F[s * 3] += sg * nx * m; F[s * 3 + 1] += sg * ny * m; F[s * 3 + 2] += sg * nz * m; cnt[s]++
          if (!r.g.on) { r.g.on = true; live.add(r.g); for (const x of r.g.ribs) act[x.idx] = 1 }
        }
      }
    }
    for (const g of live) {
      push(g.D, g.F, g.c, 0, 0, g.n, g.ds)

      const rep = g.ribs[0]
      for (const r of g.ribs) {
        const s0 = r.start
        push(D, F, cnt, s0, s0, r.n, g.ds)

        for (let i = 0; i <= r.n; i++) {
          const s = s0 + i; const o = i * 3
          if (shadow[s]) { const t = rep.start + i; D[s * 3] = D[t * 3]; D[s * 3 + 1] = D[t * 3 + 1]; D[s * 3 + 2] = D[t * 3 + 2] }
          X[s] = r.P[o] + r.O[o] + g.D[o] + D[s * 3]; Yy[s] = r.P[o + 1] + r.O[o + 1] + g.D[o + 1] + D[s * 3 + 1]; Z[s] = r.P[o + 2] + r.O[o + 2] + g.D[o + 2] + D[s * 3 + 2]
          if (!moved[s] && Math.abs(g.D[o]) + Math.abs(g.D[o + 1]) + Math.abs(g.D[o + 2]) + Math.abs(D[s * 3]) + Math.abs(D[s * 3 + 1]) + Math.abs(D[s * 3 + 2]) > 1e-3) moved[s] = 1
          dirty[s] = 0
          if (moved[s] && (X[s] - LX[s]) ** 2 + (Yy[s] - LY[s]) ** 2 + (Z[s] - LZ[s]) ** 2 > E2) { dirty[s] = 1; LX[s] = X[s]; LY[s] = Yy[s]; LZ[s] = Z[s] }
        }
      }
    }
  }
  // se fija el desplazamiento en la trenza: laneFrame, la sim y la pista lo leen de ahí
  for (const g of live) {
    for (const r of g.ribs) for (let i = 0; i <= r.n; i++) for (let k = 0; k < 3; k++) r.P[i * 3 + k] += g.D[i * 3 + k] + D[(r.start + i) * 3 + k]
    const seg = g.ribs[0].seg; seg._braid.len = []; seg._braid.curves = []
    for (const sw of seg.switches || []) delete sw._arc
  }
  world.relax = { it, left, segs: live.size, ms: Math.round(performance.now() - t0) }
  return S
}
// ───────────────────────── contrato world.colision ─────────────────────────
// world.colision = { libre(p, r, ignora), cercano(p) } (p: THREE.Vector3). libre: true si una esfera de radio r en p no toca
// ninguna cinta visible (semiancho RIBBON_HALF) ni ningún tubo (seg.radius alrededor del eje de los tramos con tubo).
// ignora = { way, seg, lane } (objetos o índices; los que se den deben coincidir todos): no choca con esa cinta; el tubo
// de un tramo se ignora si coinciden way/seg. ignora = { way, si, lane } (si = índice del tramo en el camino): se ignoran
// los tubos de los tramos si-1..si+1 y, si se da lane, ese carril en ellos (sin lane, las cintas sí cuentan). cercano(p): { d, way, seg, lane } de la cinta más cercana (d = distancia a
// la línea de su superficie), o null a más de COL_FAR. Índice por celdas: cada consulta mira un vecindario fijo, O(1).
const COL_CELL = 4 * TK
const COL_FAR = 24 * TK
export function indexarColisiones(world, S = braidRibbons(world)) {
  const { ribs, X, Y: Yy, Z, R } = S
  // tubos: ejes de los tramos sin vuelo, como una "cinta" más de radio seg.radius
  const tubes = []; const tx = []; const P = new THREE.Vector3()
  for (const way of world.ways) for (const seg of way.segments) {
    if (seg.air) continue
    const n = Math.max(4, Math.ceil(seg.length / RIB_STEP)); const t = { way, seg, start: tx.length / 3, n }
    for (let i = 0; i <= n; i++) { seg.curve.getPointAt(i / n, P); tx.push(P.x, P.y, P.z) }
    tubes.push(t)
  }
  const cell = (v) => Math.floor(v / COL_CELL)
  const grid = new Map(); const tgrid = new Map()
  const add = (g, x, y, z, i) => { const k = cellKey(cell(x), cell(y), cell(z)); let b = g.get(k); if (!b) g.set(k, b = []); b.push(i) }
  for (let i = 0; i < R.length; i++) add(grid, X[i], Yy[i], Z[i], i)
  const tR = new Int32Array(tx.length / 3)
  tubes.forEach((t, ti) => { for (let i = 0; i <= t.n; i++) { tR[t.start + i] = ti; add(tgrid, tx[(t.start + i) * 3], tx[(t.start + i) * 3 + 1], tx[(t.start + i) * 3 + 2], t.start + i) } })
  const same = (a, b) => b == null || a === b || a?.idx === b
  // con `si` (índice del tramo en su camino) cuentan también los tramos vecinos (si ± 1): el objeto vive en la unión
  const near = (o, ig) => same(o.way, ig.way) && Math.abs(o.way.segments.indexOf(o.seg) - ig.si) <= 1
  const skip = (o, ig) => ig && (ig.si != null ? ig.lane != null && o.lane === ig.lane && near(o, ig)
    : (ig.way != null || ig.seg != null || ig.lane != null) && same(o.way, ig.way) && same(o.seg, ig.seg) && (ig.lane == null || o.lane === ig.lane))
  // distancia de p al trozo de polilínea [i, i+1] (o al punto si es el último)
  const segDist = (px, py, pz, A, i, last) => {
    const ax = A(i, 0); const ay = A(i, 1); const az = A(i, 2)
    if (last) return Math.hypot(px - ax, py - ay, pz - az)
    const bx = A(i + 1, 0) - ax; const by = A(i + 1, 1) - ay; const bz = A(i + 1, 2) - az
    const l2 = bx * bx + by * by + bz * bz; const t = l2 > 0 ? clamp(((px - ax) * bx + (py - ay) * by + (pz - az) * bz) / l2, 0, 1) : 0
    return Math.hypot(px - ax - bx * t, py - ay - by * t, pz - az - bz * t)
  }
  const RA = (i, k) => (k === 0 ? X[i] : k === 1 ? Yy[i] : Z[i]); const TA = (i, k) => tx[i * 3 + k]
  const ribLast = (i) => i === ribs[R[i]].start + ribs[R[i]].n
  // visita las muestras de celdas a distancia de Chebyshev `ring` (ring 0 = la propia celda)
  const visitRing = (g, p, ring, fn) => {
    const x = cell(p.x); const y = cell(p.y); const z = cell(p.z)
    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== ring) continue
      const b = g.get(cellKey(x + dx, y + dy, z + dz)); if (b) for (const i of b) fn(i)
    }
  }
  const maxTube = Math.max(0, ...world.ways.map((w) => w.params.radius))
  function libre(p, r = 0, ignora = null) {
    const lim = r + RIBBON_HALF; const rings = Math.ceil((lim + RIB_STEP) / COL_CELL)
    for (let g = 0; g <= rings; g++) {
      let hit = false
      visitRing(grid, p, g, (i) => {
        if (hit) return
        const rb = ribs[R[i]]; if (skip(rb, ignora)) return
        if (segDist(p.x, p.y, p.z, RA, i, ribLast(i)) < lim || (i > rb.start && segDist(p.x, p.y, p.z, RA, i - 1, false) < lim)) hit = true
      })
      if (hit) return false
    }
    const tr = Math.ceil((r + maxTube + RIB_STEP) / COL_CELL)
    for (let g = 0; g <= tr; g++) {
      let hit = false
      visitRing(tgrid, p, g, (i) => {
        if (hit) return
        const t = tubes[tR[i]]; if (ignora && (ignora.si != null ? near(t, ignora) : same(t.way, ignora.way) && same(t.seg, ignora.seg) && (ignora.way != null || ignora.seg != null))) return
        const last = i === t.start + t.n
        if (segDist(p.x, p.y, p.z, TA, i, last) < r + t.seg.radius) hit = true
      })
      if (hit) return false
    }
    return true
  }
  function cercano(p) {
    let best = null
    for (let g = 0; g * COL_CELL <= COL_FAR; g++) {
      if (best && (g - 1) * COL_CELL > best.d + RIB_STEP) break
      visitRing(grid, p, g, (i) => {
        const d = segDist(p.x, p.y, p.z, RA, i, ribLast(i))
        if (!best || d < best.d) { const rb = ribs[R[i]]; best = { d, way: rb.way, seg: rb.seg, lane: rb.lane } }
      })
    }
    return best && best.d <= COL_FAR ? best : null
  }
  world.colision = { libre, cercano }
  return world.colision
}
