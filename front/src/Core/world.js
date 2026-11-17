// Mundo de Ballitas, sin React ni render: lo usan la sim y el 3D.
//
// ═══════════════════════════ CONTRATO DE DATOS ═══════════════════════════
// Unidades de mundo; Y es "arriba" (la gravedad tira hacia -Y). Todo `pos`/`dir` es THREE.Vector3.
// Escala global:
//   WORLD_SCALE (2.8): factor de separación entre centros de nodos, panza/arco/apertura de ways,
//                      amplitudes y caídas (`drop`) de obstáculos.
//   TUBE_SCALE  (1.8): factor del radio de los tubos (`P.radius`); `BALL_R` queda fijo (0.5)
//                      para dejar espacio interior a pórticos, gradas y decoración.
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
export const NODE_R = 7.5
export const BALL_R = 0.5
const TRIM_LEN = 18 // distancia desde el puerto donde ya no se evalúa separación entre salidas/llegadas
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
  bow: +(bow * WORLD_SCALE).toFixed(1),
  arch: +(arch * WORLD_SCALE).toFixed(1),
  spread: +(spread * WORLD_SCALE).toFixed(1),
  radius: +(radius * TUBE_SCALE).toFixed(2),
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
  espiral: { name: 'Espiral', emoji: '🌀', w: 0.9, boost: 0, drag: 0.8, speedK: 1.0, risk: 0.5, drop: 12 * WORLD_SCALE },
  caida: { name: 'Caída libre', emoji: '🪂', w: 0.75, boost: 0, drag: 0, speedK: 1.45, risk: 0.9, drop: 13 * WORLD_SCALE, air: true },
  cascada: { name: 'Cascada', emoji: '🪜', w: 1.2, boost: 0, drag: 1.1, speedK: 1.15, risk: 0.4, drop: 10 * WORLD_SCALE, event: true },
  embudo: { name: 'Embudo', emoji: '🌪️', w: 0.85, boost: 0, drag: 4, speedK: 0.65, risk: 0.5, drop: 9 * WORLD_SCALE },
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
  caida: { name: 'Caída libre', emoji: '🪂', style: 'salto', dur: 1.0, risk: 0.8, fail: 0.18, reward: { p: 2.6, e: -0.5 }, boost: 1.1 },
  arbol: { name: 'Árbol puente', emoji: '🌳', style: 'salto', dur: 1.1, risk: 0.3, fail: 0.05, reward: { p: 1.1, e: 0.2 }, boost: 1.05 },
  viento: { name: 'Ráfaga de viento', emoji: '💨', style: 'salto', dur: 0.9, risk: 0.4, fail: 0.08, reward: { p: 1.4, e: -0.1 }, boost: 1.1 },
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
export const SPHERE_R = 52 * WORLD_SCALE * Math.sqrt(NODE_DEFS.length)

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
    const n = clamp(Math.ceil(s.length / 0.25), 24, 2000)
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
export const LANE_W = +(BALL_R * 2.6).toFixed(2)
export const BRAID_A = 4.6 // separación nominal (u) de cada camino respecto al central en el tramo abierto
const BRAID_PAD = 4 // holgura del envolvente para ancho de pista, ballita y arcos
const BRAID_MIN = 2.2 // distancia mínima entre caminos distintos donde ya están abiertos (env >= 0.5)
const BRAID_RAMP = 18 // largo (u) de la apertura/cierre de la trenza en cada punta del tramo
export const ROLL_KINDS = ['plano', 'cabeza', 'lado_der', 'lado_izq', 'tirabuzon', 'tirabuzon_inv']

// Apertura de la trenza en `u` (0 en las puntas y en las rectas de parrilla/meta, 1 con los caminos abiertos).
// Sólo depende del largo y del tipo de tramo: la búsqueda de huecos la usa antes de construir los caminos.
export function braidEnv(seg, u) {
  const L = seg.length; const x = clamp(Number.isFinite(u) ? u : 0, 0, 1) * L
  const a = seg.kind === 'salida' ? GRID_LEN + 2 : 0; const b = seg.kind === 'llegada' ? FINISH_LEN + 2 : 0
  const r = Math.max(4, Math.min(BRAID_RAMP, (L - a - b) * 0.3))
  return smooth01((x - a) / r) * smooth01((L - b - x) / r)
}
// Radio del envolvente de la trenza alrededor del eje (para separar pistas distintas).
export const braidRadius = (seg, u) => Math.max(seg.radius, BRAID_A * braidEnv(seg, u) + BRAID_PAD)

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
  const du = Math.min(0.01, 0.4 / seg.length); const u0 = Math.max(0, u - du); const u1 = Math.min(1, u + du)
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
  constructor(seg, id) { super(); this.seg = seg; this.id = id; this.f = {}; this.arcLengthDivisions = clamp(Math.ceil(laneLength(seg, id)), 50, 1000) }
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
  const d = A.pos.distanceTo(B.pos); const h = sw.apex
  return {
    p0: A.pos.clone(), p3: B.pos.clone(), u0: A.up.clone(), u1: B.up.clone(),
    p1: A.pos.clone().addScaledVector(A.up, h).addScaledVector(A.tangent, d * 0.3),
    p2: B.pos.clone().addScaledVector(B.up, h).addScaledVector(B.tangent, -d * 0.3),
  }
}
export function switchArc(seg, sw, t, out = {}) {
  const c = sw._arc || (sw._arc = arcCtrl(seg, sw))
  t = Number.isFinite(t) ? clamp(t, 0, 1) : 0
  const s = 1 - t
  const pos = out.pos || (out.pos = new THREE.Vector3())
  pos.copy(c.p0).multiplyScalar(s * s * s).addScaledVector(c.p1, 3 * s * s * t).addScaledVector(c.p2, 3 * s * t * t).addScaledVector(c.p3, t * t * t)
  const T = out.tangent || (out.tangent = new THREE.Vector3())
  T.subVectors(c.p1, c.p0).multiplyScalar(3 * s * s).addScaledVector(FRAME_TMP.subVectors(c.p2, c.p1), 6 * s * t)
    .addScaledVector(FRAME_TMP.subVectors(c.p3, c.p2), 3 * t * t)
  if (T.lengthSq() < 1e-10) T.subVectors(c.p3, c.p0)
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
const BANK_GAIN = { rapida: 14, lenta: 16, media: 24, shared: 10 } // peralte (rad) por unidad de curvatura (1/u)
const BANK_MAX = 0.55; const BANK_RATE = 0.025 // rad máx. y rad por unidad de longitud
// lomas (+) y badenes (-) por carril: cuántas y de qué altura; jumps: rampas de salto extra
const RELIEF = {
  rapida: { n: [1, 2], h: [0.1, 0.22], jumps: 0 },
  lenta: { n: [3, 5], h: [0.15, 0.4], jumps: 0 },
  media: { n: [2, 3], h: [0.15, 0.32], jumps: 2 },
  shared: { n: [1, 2], h: [0.08, 0.18], jumps: 0 },
}
const RELIEF_BASE = 0.15 // altura base del firme (así caben los badenes sin atravesar el cristal)
const KICK_DROP = 0.9 // largo (u) de la caída tras la cresta de una rampa: ahí la ballita despega

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
  const w = Math.max(1, Math.round(2 / ds)); const cx = box(kx, w); const cy = box(ky, w)
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
  const nr = clamp(Math.ceil(L / 0.5), 32, 2400)
  s._relief = { n: nr, h: new Map() }
  for (const lane of s.lanes) {
    const feats = []
    for (let j = ri(rng, R.n[0], R.n[1]); j > 0; j--) {
      feats.push({ c: (0.12 + rng() * 0.76) * L, w: 4 + rng() * 5, h: (R.h[0] + rng() * (R.h[1] - R.h[0])) * (rng() < 0.35 ? -1 : 1) })
    }
    // [cresta, altura, subida]: una rampa por estación (varios mecanismos en la misma u comparten rampa)
    const kicks = [...new Set((s.switchesByLane?.get(lane.id) || []).map((sw) => sw.u))].map((u) => [u * L, 0.3, 5])
    for (let j = 0; j < R.jumps; j++) kicks.push([(0.2 + rng() * 0.6) * L, 0.5, 7])
    const arr = new Float32Array(nr + 1)
    for (let i = 0; i <= nr; i++) {
      const x = (i / nr) * L; let h = RELIEF_BASE
      for (const f of feats) { const q = Math.abs(x - f.c) / f.w; if (q < 1) h += f.h * Math.cos((q * Math.PI) / 2) ** 2 }
      for (const [p, kh, up] of kicks) {
        if (x > p - up && x <= p) h += kh * smooth01((x - p + up) / up)
        else if (x > p && x < p + KICK_DROP) h += kh * (1 - (x - p) / KICK_DROP)
      }
      arr[i] = clamp(h, 0, hMax) * smooth01(x / 6) * smooth01((L - x) / 6)
    }
    s._relief.h.set(lane.id, arr)
  }
}

// Carriles y mecanismos de un way (rng propio: no altera la generación de las rutas).
function buildBraid(s) {
  const N = clamp(Math.ceil(s.length / 1.5), 48, 1200)
  const lanes = s.lanes; const P = lanes.map(() => new Float32Array((N + 1) * 3)); const env = new Float32Array(N + 1)
  const tangent = new THREE.Vector3(); const ref = new THREE.Vector3(); const priorRef = new THREE.Vector3(); const side = new THREE.Vector3(); const center = new THREE.Vector3()
  for (let i = 0; i <= N; i++) {
    const u = i / N; const f = wallFrame(s, 0, u, 0, {})
    center.copy(f.axis); segmentTangent(s, u, tangent)
    if (i) ref.copy(priorRef).addScaledVector(tangent, -priorRef.dot(tangent))
    else ref.crossVectors(tangent, Y)
    if (ref.lengthSq() < 1e-8) ref.set(1, 0, 0).addScaledVector(tangent, -tangent.x)
    ref.normalize(); side.crossVectors(tangent, ref).normalize()
    priorRef.copy(ref)
    env[i] = braidEnv(s, u)
    for (let j = 0; j < lanes.length; j++) {
      const lane = lanes[j]; const id = lane.id; const dst = P[id] || (P[id] = new Float32Array((N + 1) * 3))
      const ringCount = Math.max(1, lanes.length - 1)
      const theta = id === 0 ? 0 : ((id - 1) * TAU / ringCount + u * TAU)
      const radius = id === 0 ? 0 : BRAID_A * env[i]
      const q = center.clone().addScaledVector(ref, Math.cos(theta) * radius).addScaledVector(side, Math.sin(theta) * radius)
      q.toArray(dst, i * 3)
    }
  }
  s._braid = { N, P, env, full: [BRAID_RAMP / s.length, 1 - BRAID_RAMP / s.length], len: [], curves: [] }
}

function buildLanes(way) {
  const rng = mulberry32(90000 + way.idx * 131)
  const laneCount = 3 + Math.floor(rng() * 3)
  const theme = way.theme.id
  const mechs = Object.keys(THEME_MECHS[theme])
  const width = LANE_W
  const mk = (s, u, from, to, kind, dur) => {
    const M = MECHANISMS[kind]; const sk = s.speedK ?? 1
    const duration = +(dur ?? (M.dur / Math.sqrt(sk)) * (s.drag > 2 ? 1.25 : 1)).toFixed(2)
    const span = (duration * (14 * sk + (s.boost || 0) * 0.4)) / s.length
    return {
      u: +u.toFixed(3), uLand: +Math.min(0.94, u + Math.max(0.08, span)).toFixed(3), uEnd: +Math.min(0.94, u + Math.max(0.08, span)).toFixed(3), from, to, kind, apex: +(3.5 + Math.abs(to - from) * 0.6).toFixed(2),
      name: THEME_MECHS[theme][kind] || M.name, emoji: M.emoji, style: M.style, duration,
      risk: M.risk, fail: M.fail, reward: { ...M.reward }, boost: M.boost,
    }
  }
  way.segments.forEach((s, i) => {
    const ids = Array.from({ length: laneCount }, (_, id) => id)
    s.lanes = ids.map((id) => ({ id, roll: id === 0 ? 'plano' : ROLL_KINDS[1 + ((id - 1 + way.idx) % (ROLL_KINDS.length - 1))], angle: 0, offset: 0, width, name: LANE_NAMES[id] || `camino ${id + 1}` }))
    buildBraid(s)
    s.switches = []
    if (s.air) {
      // el propio obstáculo aéreo catapulta: decide en qué pared aterriza
      const dur = clamp((s.length / (14 * (s.speedK ?? 1) + s.boost * 0.6)) * 0.8, 0.6, 3.5)
      for (const id of ids) {
      const to = id === 0 ? [laneCount - 1] : [id === laneCount - 1 ? 0 : id + 1]
        for (const t of new Set(to)) if (t !== id) s.switches.push(mk(s, 0.12, id, t, s.kind, dur))
      }
      s.switchesByLane = new Map(ids.map((id) => [id, s.switches.filter((sw) => sw.from === id)]))
      return
    }
    const primary = s.event && MECHANISMS[s.event] ? s.event : mechs[i % mechs.length]
    let secondary = mechs[(i + 1) % mechs.length]
    if (secondary === primary) secondary = mechs[(i + 2) % mechs.length]
    const u1 = 0.22 + rng() * 0.12; const u2 = 0.62 + rng() * 0.14
    // Eventos en anillo entre caminos vecinos; algunos incluyen un salto extra.
    for (let id = 0; id < laneCount; id++) {
      const to = (id + 1) % laneCount
      s.switches.push(mk(s, u1, id, to, id % 2 ? secondary : primary))
      if (rng() < 0.35) s.switches.push(mk(s, u2, id, (id + 2) % laneCount, primary))
    }
    if (s.kind === 'salida') for (let id = 2; id < laneCount; id++) s.switches.push(mk(s, u1, 0, id, id % 2 ? secondary : primary))
    // Índice de estaciones por carril origen para que cada tick consulte sólo las
    // opciones de ese carril, ya ordenadas por posición.
    s.switchesByLane = new Map(ids.map((id) => [id, s.switches.filter((sw) => sw.from === id).sort((a, b) => a.u - b.u)]))
  })
  const srng = mulberry32(91000 + way.idx * 37)
  for (const s of way.segments) buildSurface(s, srng)
  for (const s of way.segments) for (const sw of s.switches) delete sw._arc
}

const TERM_MIN_ANG = 0.45 // separación angular mínima entre terminales de un nodo

// Elecciones de la búsqueda de huecos ({theta, bowExtra, salt} por camino), calculadas aparte (worker/caché):
// con ellas buildWorld se salta la búsqueda cara y produce el mismo mundo.
const PICKS = new Map()
// shortcut: la caché de elecciones se invalida a mano; sube WORLD_GEN al cambiar cualquier cosa de la generación
export const WORLD_GEN = 2
export const setWorldPicks = (seed, picks) => PICKS.set(seed, picks)
export function buildWorld(seed = 369, onProgress = null) {
  const rng = mulberry32(seed)
  const world = { nodes: [], destinos: [], circuits: [], ways: [], waysFrom: [], routes: [], segments: [], picks: [] }
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
    }
  }
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
    for (const minAng of [0.68, TERM_MIN_ANG]) {
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
const smooth01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }
const bump = (t) => smooth01(Math.min(1, 4 * t, 4 * (1 - t))) // el radio nace y muere en la cuerda, sin quiebros

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
  const n = clamp(Math.round(L / 2.5), 12, 120); const pts = []
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
  const d = P0.distanceTo(P1); const k = d * 0.42; const n = clamp(Math.round(d / 2.5), 4, 80); const pts = []
  const c1 = at(P0, T0, k); const c2 = at(P1, T1, -k)
  for (let i = 1; i < n; i++) {
    const t = i / n; const s = 1 - t
    pts.push(P0.clone().multiplyScalar(s * s * s).addScaledVector(c1, 3 * s * s * t).addScaledVector(c2, 3 * s * t * t).addScaledVector(P1, t * t * t))
  }
  return pts
}

const SHAPES = {
  espiral: (A, B, P) => coil(A, B, 2 + P.turns, (t) => 3.2 * WORLD_SCALE * P.coil * bump(t), A, undefined, true),
  sacacorchos: (A, B, P) => coil(A, B, 3 + P.turns, (t) => (P.radius * 1.85 + 1.2) * bump(t), A, undefined, true),
  // remolino que se cierra: empieza en el borde del cono (A) y acaba en su vértice (B)
  embudo: (A, B, P) => { const R = 4.0 * WORLD_SCALE * P.coil; return coil(A, B, 3, (t) => R * (1 - t), at(A, basis(A, B).u, -R), (t) => t * t) },
  // tiro horizontal: parábola de caída libre
  caida: (A, B) => { const { C } = basis(A, B); return [1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(A.x + C.x * (i / 8), A.y + C.y * (i / 8) ** 2, A.z + C.z * (i / 8))) },
  // un salto largo (un solo arco: sin botes alternados)
  trampolin: (A, B) => { const { C, L } = basis(A, B); const h = 2.5 * WORLD_SCALE + L * 0.15; return Array.from({ length: 11 }, (_, i) => at(A, C, (i + 1) / 12, Y, h * Math.sin(((i + 1) / 12) * Math.PI))) },
  canon: (A, B) => { const { C, L } = basis(A, B); return Array.from({ length: 9 }, (_, i) => at(A, C, (i + 1) / 10, Y, L * 1.0 * ((i + 1) / 10) * (1 - (i + 1) / 10))) },
  portal: (A, B) => {
    const { C, v } = basis(A, B)
    return [at(A, C, 0.35, v, 0.9 * WORLD_SCALE), at(A, C, 0.65, v, 0.9 * WORLD_SCALE)]
  },
  geiser: (A, B) => {
    const { C, L } = basis(A, B); const h = Math.min(9.5 * WORLD_SCALE, 3.8 * WORLD_SCALE + L * 0.22)
    return Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; return at(A, C, Math.pow(t, 1.35), Y, h * Math.sin(Math.PI * Math.pow(t, 0.55))) })
  },
  erupcion: (A, B) => {
    const { C, L, u } = basis(A, B); const h = Math.min(11 * WORLD_SCALE, 4.5 * WORLD_SCALE + L * 0.26)
    return Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; return at(A, C, t, Y, h * 4 * t * (1 - t), u, Math.sin(t * Math.PI) * 1.4 * WORLD_SCALE) })
  },
}
SHAPES.salida = SHAPES.llegada = () => []

export const OUT_GATES = ['arco_salida', 'parrilla_semaforo', 'tunel_rampa', 'lanzadera_aros', 'puente_banderas']
export const IN_GATES = ['meta_cuadros', 'embudo_llegada', 'portal_llegada', 'arco_meta', 'tunel_frenado']
const ownsStart = (k) => KINDS[k].air || k === 'embudo' // su arranque lo dicta la forma, no el vecino
export const GRID_LEN = 14 // recta de parrilla de la salida, en unidades de mundo
export const FINISH_LEN = 10 // recta final de meta de la llegada

function shape(kind, A, B, P, Ta, Tb, midPt = null, opt = {}) {
  const lead = Math.min(2.5 * WORLD_SCALE, A.distanceTo(B) * 0.15); const air = KINDS[kind].air
  const cr = (pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  if (PLANS[kind]) return cr([A, ...trackPts(kind, A, B, Ta, Tb, opt), B])
  if (kind === 'rizo') {
    // curva de entrada, círculo vertical (desplazado de lado lo justo para no cortarse) y curva de salida
    const { C, L, c, u, v } = basis(A, B); const r = Math.min(3.4 * WORLD_SCALE * P.coil, L * 0.3); const sh = P.radius * 2.4
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
  return node.pos.clone().addScaledVector(slerpDir(dir, toTarget, 0.55), NODE_R + GRID_LEN + 3)
}

function sampleWayPoints(way, steps = 14) {
  const pts = []
  for (const s of way.segments) {
    // fino (28): un punto cada ~1.5 u para no saltarse cruces entre tubos; grueso (14): descarte rápido
    const n = steps === 28 ? Math.max(12, Math.ceil(s.length / 1.5)) : steps
    for (let k = 0; k <= n; k++) {
      const u = k / n
      const trim = (s.kind === 'salida' && u * s.length < TRIM_LEN) || (s.kind === 'llegada' && (1 - u) * s.length < TRIM_LEN)
      pts.push({ p: s.curve.getPointAt(u), r: braidRadius(s, u), kind: s.kind, trim })
    }
  }
  return pts
}

const SPATIAL_CELL = 24
const CAND_ARC_DIV = +(globalThis.__AD ?? 48)
// clave numérica de celda (sin cadenas): coordenadas de celda en ±1024
const cellKey = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024)
const pointCell = (p) => cellKey(Math.floor(p.x / SPATIAL_CELL), Math.floor(p.y / SPATIAL_CELL), Math.floor(p.z / SPATIAL_CELL))
function indexPlacedWay(placed, entry) {
  placed.push(entry)
  const grid = placed.grid || (placed.grid = new Map())
  for (const q of entry.pts) {
    if (q.trim) continue
    const key = pointCell(q.p); let bucket = grid.get(key)
    if (!bucket) grid.set(key, bucket = [])
    bucket.push(q)
  }
}

function placeWayAt(world, circuit, from, to, placed, pick) {
  if (pick) {
    const w = buildWay(world, circuit, from, to, pick.theta, pick.bowExtra, true, pick.salt)
    w.pick = pick
    return w
  }
  return placeWay(world, circuit, from, to, placed)
}

function placeWay(world, circuit, from, to, placed) {
  const a = world.nodes[from]; const b = world.nodes[to]
  const others = world.nodes.filter((o) => o !== a && o !== b)
  const baseTheta = ((circuit.idx * 0.6180339887 + (from < to ? 0 : 0.5)) % 1) * TAU
  const N_ANG = 16
  let best = null; let bestScore = -Infinity

  const evalCand = (cand, steps) => {
    const pts = sampleWayPoints(cand, steps)
    let minNode = Infinity
    const nodeMargin = NODE_R + 3 * WORLD_SCALE
    const nodeAcceptSq = (nodeMargin + 1.5) ** 2
    for (const pt of pts) {
      for (const o of others) {
        const d2 = pt.p.distanceToSquared(o.pos)
        if (d2 < nodeAcceptSq) minNode = Math.min(minNode, Math.sqrt(d2) - pt.r - nodeMargin)
      }
      if (pt.kind !== 'salida' && pt.p.distanceToSquared(a.pos) <= (NODE_R + pt.r) ** 2) return null
      if (pt.kind !== 'llegada' && pt.p.distanceToSquared(b.pos) <= (NODE_R + pt.r) ** 2) return null
      if (pt.kind === 'salida' && pt.p.distanceToSquared(a.pos) <= (NODE_R - 0.005) ** 2) return null
      if (pt.kind === 'llegada' && pt.p.distanceToSquared(b.pos) <= (NODE_R - 0.005) ** 2) return null
    }
    if (minNode === Infinity) minNode = 1.5
    let minTube = Infinity; let minHub = Infinity
    for (const prev of placed) {
      for (const h1 of cand.junctions) for (const h2 of prev.hubs) minHub = Math.min(minHub, h1.pos.distanceTo(h2.pos))
    }
    const grid = placed.grid
    if (grid) for (const pt of pts) {
      if (pt.trim) continue
      const x = Math.floor(pt.p.x / SPATIAL_CELL); const y = Math.floor(pt.p.y / SPATIAL_CELL); const z = Math.floor(pt.p.z / SPATIAL_CELL)
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const bucket = grid.get(cellKey(x + dx, y + dy, z + dz))
        if (!bucket) continue
        for (const q of bucket) {
          const r = pt.r + q.r; const d2 = pt.p.distanceToSquared(q.p)
          if (d2 < (r + 4.8) ** 2) minTube = Math.min(minTube, Math.sqrt(d2) - r)
        }
      }
    }
    return { minTube, minNode, minHub }
  }

  // más pasadas (ángulos intermedios y otra semilla de trazado) sólo si la anterior no encontró hueco
  for (const [half, salt] of [[0, 0], [0.5, 1], [0.25, 2]]) for (const bowExtra of bestScore >= 2.5 ? [] : [-12, 0, 10, 20, 32, 46, 62, 80, 100].map((x) => x * WORLD_SCALE)) {
    for (let k = 0; k < N_ANG; k++) {
      const theta = (baseTheta + ((k + half) / N_ANG) * TAU) % TAU
      const cand = buildWay(world, circuit, from, to, theta, bowExtra, false, salt)
      const coarse = evalCand(cand, 14)
      if (!coarse) continue
      const res = coarse.minTube >= 0 && coarse.minNode >= 0 ? evalCand(cand, 28) : coarse // el grueso sólo descarta: su mínimo nunca es menor que el real
      if (!res) continue
      const score = res.minTube < 4.0 ? res.minTube - 10 : Math.min(res.minTube, res.minNode + 1, res.minHub * 0.2)
      if (score > bestScore) { bestScore = score; best = { theta, bowExtra, salt } }
      if (res.minTube >= 4.0 && res.minNode >= 1.5 && res.minHub >= 24) {
        const w = buildWay(world, circuit, from, to, theta, bowExtra, true, salt)
        w.pick = { theta, bowExtra, salt }
        indexPlacedWay(placed, { pts: sampleWayPoints(w, 28), hubs: w.junctions })
        return w
      }
    }
  }
  // Si la búsqueda normal sólo encontró un respaldo, probar fases intermedias y más apertura de panza.
  extraSearch: if (bestScore < 2.5) for (const salt of [3, 4]) for (const bow of [0, 120]) for (let k = 0; k < N_ANG; k += 3) {
    const theta = (baseTheta + ((k + 0.375) / N_ANG) * TAU) % TAU
    const bowExtra = bow * WORLD_SCALE
    const cand = buildWay(world, circuit, from, to, theta, bowExtra, false, salt)
    const coarse = evalCand(cand, 14); if (!coarse) continue
    const res = coarse.minTube >= 0 && coarse.minNode >= 0 ? evalCand(cand, 28) : coarse
    if (res && res.minTube >= 4 && res.minNode >= 1.5 && res.minHub >= 24) {
      best = { theta, bowExtra, salt }; bestScore = 4; break extraSearch
    }
    if (res) {
      const score = res.minTube < 4 ? res.minTube - 10 : Math.min(res.minTube, res.minNode + 1, res.minHub * 0.2)
      if (score > bestScore) { bestScore = score; best = { theta, bowExtra, salt } }
    }
  }
  const chosen = best || { theta: baseTheta, bowExtra: 0, salt: 0 }
  const w = buildWay(world, circuit, from, to, chosen.theta, chosen.bowExtra, true, chosen.salt)
  w.pick = { theta: chosen.theta, bowExtra: chosen.bowExtra, salt: chosen.salt }
  indexPlacedWay(placed, { pts: sampleWayPoints(w, 28), hubs: w.junctions })
  return w
}

const FLEX_PLAIN = FLEX.filter((k) => !KINDS[k].event)
const GRAV_PLAIN = GRAV.filter((k) => !KINDS[k].event)
const EVENT_FLEX = FLEX.filter((k) => KINDS[k].event)
const EVENT_ALL = OBSTACLES.filter((k) => KINDS[k].event)

// ───────────────────────── un sentido de un circuito ─────────────────────────
function buildWay(world, circuit, from, to, theta = 0, bowExtra = 0, commit = true, salt = 0) {
  const { nodes } = world
  const a = nodes[from]; const b = nodes[to]; const theme = circuit.theme; const P = PARAMS[theme.id]
  const rng = mulberry32(7000 + circuit.idx * 31 + (from < to ? 0 : 1))
  const pOut = a.portTo[to]; const pIn = b.portTo[from]
  const S = a.verts[pOut.out].pos; const nS = a.verts[pOut.out].dir
  const E = b.verts[pIn.in].pos; const nE = b.verts[pIn.in].dir
  const { C } = basis(S, E)
  // geodésica: círculo máximo de S a E sobre la esfera; n1 = lateral sobre la superficie, n2 = radial hacia fuera
  const dS = S.clone().normalize(); const dE = E.clone().normalize()
  let axis = new THREE.Vector3().crossVectors(dS, dE)
  if (axis.lengthSq() < 1e-6) axis = new THREE.Vector3().crossVectors(dS, Math.abs(dS.y) > 0.9 ? X : Y)
  axis.normalize()
  const arcA = dS.angleTo(dE); const rS = S.length(); const rE = E.length()
  const radial = (s) => dS.clone().applyAxisAngle(axis, arcA * s)
  const ct = Math.cos(theta); const st = Math.sin(theta) // capa de altitud del camino: ±35% del radio (el grosor de la cáscara)
  const bow = P.bow + bowExtra
  const J = (s) => {
    const f = Math.pow(Math.sin(Math.PI * s), 0.72)
    const r = radial(s)
    const lat = new THREE.Vector3().crossVectors(axis, r)
    return r.clone().multiplyScalar(rS + (rE - rS) * s + SPHERE_R * 0.35 * f * st + P.arch * f * 0.5).addScaledVector(lat, (from < to ? 1 : -1) * bow * f * ct * 0.7) // el sentido contrario ya trae el eje invertido: se compensa para que ida y vuelta queden en lados opuestos
  }
  const n1 = axis.clone(); const n2 = dS.clone().add(dE).normalize() // marco local para la apertura de rutas
  const stops = [0.16, 0.5, 0.84]
  const hubs = stops.map(J)
  const hubT = stops.map((s) => J(s + 0.02).sub(J(s - 0.02)).normalize())

  const way = {
    idx: world.ways.length, id: `${from}>${to}`, circuit, from, to, theme, params: P, segments: [], routes: [],
    junctions: hubs.map((pos, i) => ({ pos, kind: ['fork', 'cross', 'merge'][i] })), length: 0,
  }
  const seg = (kind, curve, route, tramo) => {
    const K = KINDS[kind]
    if (!commit) curve.arcLengthDivisions = CAND_ARC_DIV // candidato: longitudes aproximadas bastan para medir holguras (el elegido se reconstruye fino)
    const s = {
      idx: commit ? world.segments.length : -1, i: way.segments.length, way, route, kind, name: K.name, emoji: K.emoji,
      curve, length: curve.getLength(), radius: P.radius, air: !!K.air, boost: K.boost, drag: K.drag,
      speedK: K.speedK ?? 1, event: K.event ? kind : null, risk: K.risk,
      next: [], tramo,
    }
    way.segments.push(s)
    if (commit) world.segments.push(s)
    return s
  }
  // rectas de parrilla/meta: salen del planeta inclinadas hacia su unión (las bocas vecinas divergen)
  const gridDir = (n, target, from, k) => { const t = target.clone().sub(from); t.addScaledVector(n, -t.dot(n)); return n.clone().addScaledVector(t.normalize(), k).normalize() }
  const tilt = [0.5, 0.2, 0.8][salt % 3]; const gOut = gridDir(nS, hubs[0], S, tilt); const gIn = gridDir(nE, hubs[2], E, tilt)
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

  const heads = [[], []]; const tails = [[], []]
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

    const own = []
    for (let h = 0; h < 2; h++) {
      const A = hubs[h]; const B = hubs[h + 1]
      const kinds = halves[h]
      const [k0, k1, k2] = kinds
      const w0 = KINDS[k0].w; const w1 = KINDS[k1].w; const w2 = KINDS[k2].w
      const wSum = w0 + w1 + w2
      const f0 = clamp(w0 / wSum, 0.24, 0.38)
      const f1 = clamp((w0 + w1) / wSum, 0.62, 0.78)
      // las rutas se abren alrededor del eje y en la segunda mitad giran: se trenzan
      const ang = P.phase + ((r + h * 0.5) * TAU) / P.n
      const chord = B.clone().sub(A)
      const Q0 = at(A, chord, f0, n1, Math.cos(ang) * P.spread, n2, Math.sin(ang) * P.spread)
      const Q1 = at(A, chord, f1, n1, Math.cos(ang) * P.spread, n2, Math.sin(ang) * P.spread)
      // el obstáculo de gravedad baja de verdad: se fuerza su desnivel moviendo los puntos intermedios
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

      // las paradas intermedias tampoco se hunden por dentro de la esfera
      for (const Q of [Q0, Q1]) if (Q.length() < SPHERE_R * 0.7) Q.setLength(SPHERE_R * 0.7)
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
      const s0 = seg(k0, cs[0], r, kinds)
      const s1 = seg(k1, cs[1], r, kinds)
      const s2 = seg(k2, cs[2], r, kinds)
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
  }
  const landing = seg('llegada', shape('llegada', hubs[2], E, P, hubT[2], gIn.clone().negate(), wrapMid(b, nE, hubs[2])), -1, [])
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
