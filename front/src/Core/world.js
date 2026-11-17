// Mundo de Ballitas, sin React ni render: lo usan la sim y el 3D.
//
// ═══════════════════════════ CONTRATO DE DATOS ═══════════════════════════
// Unidades de mundo; Y es "arriba" (la gravedad tira hacia -Y). Todo `pos`/`dir` es THREE.Vector3.
// Escala global:
//   WORLD_SCALE (2.8): factor de separación entre centros de nodos, panza/arco/apertura de ways,
//                      amplitudes y caídas (`drop`) de obstáculos.
//   TUBE_SCALE  (1.8): factor del radio de los tubos (`P.radius`); `BALL_R` queda fijo (0.5)
//                      para dejar espacio interior a pórticos, gradas y decoración.
//   TIME_SCALE  (2.5): definido en sim.js; escala objetivo del tiempo de viaje por circuito y
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
//                  to (idx del otro nodo), dir, pos }  (8+ por nodo, repartidos por toda la esfera)
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
//
// ─── CARRILES SOBRE LA PARED (la pista es un riel 3D pegado al interior del tubo) ───
//   segment.lanes[2-4] = { id (0..3, mismo id = mismo ángulo en todo el way), angle (0..2π alrededor
//                          del eje; 0 = suelo en las uniones, π/2 y 3π/2 paredes, π techo), offset
//                          (vaivén angular del carril: θ(u) = angle + offset·sin(πu), nominal en los
//                          extremos), width (ancho del riel, unidades de mundo), name }
//     Siempre existe el carril 0. Salida, llegada y tramos `air` tienen los 4 (son los tramos anchos
//     de fork/merge); los obstáculos de cada ruta, de 2 a 4.
//   segment.switches[] = { u (inicio, 0..1 a lo largo), uEnd (ancla de llegada estimada), from, to (ids
//                          de lanes), kind (clave de MECHANISMS; si el tramo tiene `event`, es esa clave),
//                          name (nombre temático del mini mundo), emoji, style ('salto': vuela por el
//                          interior con arco | 'pared': rueda pegada a la pared | 'portal': teletransporte
//                          corto), duration (s), risk, fail (probabilidad base de fallo), reward { p, e },
//                          boost (multiplicador de velocidad al usarlo) }
//     Ancla de un mecanismo para dibujarlo: laneFrame(seg, from, u) y laneFrame(seg, to, uEnd).
//   Un carril que no existe en el tramo siguiente sigue por el más cercano en ángulo (nearestLane).
//   Marcos: transporte paralelo del tubo (sin torsión), con la torsión residual repartida para que en
//   cada unión (fork/cross/merge) el ángulo 0 apunte al suelo del mundo.
//   wallFrame(seg, angle, u, rho?) y laneFrame(seg, laneId, u) -> { pos (centro de la ballita a `rho`
//     del eje; por defecto radius - BALL_R, 0 en `air`), wall (punto del cristal), axis, dir (eje->pared),
//     tangent, up (apunta al eje: la gravedad de la ballita es hacia su pared), side (= tangent × up), angle }
//
// Helpers: frameAt(curve, u), cityPath(node, a, b), slerpDir(a, b, t, out), mulberry32(seed),
//          wallFrame, laneFrame, laneAngle, nearestLane, lowestLane, angDiff.
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
  bosque: scaleParam({ n: 2, bow: 34, arch: 8, spread: 23, phase: 1.2, coil: 1.35, turns: 1, radius: 1.5, fav: ['pantano', 'cascada', 'espiral', 'zigzag', 'rampa'] }),
  mar: scaleParam({ n: 3, bow: 38, arch: 0, spread: 23, phase: 2.2, coil: 1.1, turns: 0, radius: 1.35, fav: ['cascada', 'geiser', 'embudo', 'rizo', 'trampolin'] }),
  desierto: scaleParam({ n: 2, bow: 40, arch: 18, spread: 20, phase: 0, coil: 1, turns: 0, radius: 1.4, fav: ['turbina', 'caida', 'espiral', 'canon', 'rampa'] }),
  hielo: scaleParam({ n: 3, bow: 35, arch: -9, spread: 23, phase: 3, coil: 0.9, turns: 2, radius: 1.2, fav: ['hielo_resbaloso', 'cascada', 'espiral', 'zigzag', 'sacacorchos'] }),
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
  zigzag: { name: 'Zigzag', emoji: '〰️', w: 1.2, boost: 0, drag: 1.3, speedK: 0.85, risk: 0.3 },
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
}
// Mecanismos propios del paisaje de cada mini mundo (clave -> nombre temático).
export const THEME_MECHS = {
  sombrio: { iman: 'Imán de sombras', remolino: 'Remolino umbrío', portal: 'Grieta-portal' },
  bosque: { rampa: 'Tronco-rampa', tirolina: 'Liana-tirolina', resorte: 'Hongo-resorte' },
  mar: { remolino: 'Remolino marino', geiser: 'Chorro de ballena', cinta: 'Corriente marina' },
  desierto: { turbina: 'Tolvanera', rampa: 'Duna-rampa', resorte: 'Cactus-resorte' },
  hielo: { rampa: 'Ventisquero', cinta: 'Glaciar deslizante', bumper: 'Carámbano-bumper' },
  volcan: { erupcion: 'Erupción', geiser: 'Fumarola', rampa: 'Colada-rampa' },
  cristal: { portal: 'Prisma-portal', iman: 'Imán de cuarzo', bumper: 'Geoda-bumper' },
  nubes: { turbina: 'Ráfaga', trampolin: 'Nube-trampolín', tirolina: 'Arcoíris-tirolina' },
  neon: { bumper: 'Bumper neón', portal: 'Portal neón', cinta: 'Cinta láser' },
  jardin: { resorte: 'Flor-resorte', tirolina: 'Enredadera', trampolin: 'Nenúfar-trampolín' },
}
export const LANE_NAMES = ['suelo', 'pared derecha', 'techo', 'pared izquierda']

const FLEX = ['rampa', 'zigzag', 'rizo', 'sacacorchos', 'trampolin', 'canon', 'turbina', 'hielo_resbaloso', 'pantano', 'portal', 'geiser', 'erupcion'] // unen dos puntos cualesquiera
const GRAV = ['espiral', 'caida', 'cascada', 'embudo'] // necesitan bajar
// Orden de los genes `kinds` del genoma.
export const OBSTACLES = [...FLEX, ...GRAV]

const DEST_NAMES = {
  puntos: ['Arcade', 'Torneo', 'Mercado', 'Galería', 'Concurso', 'Subasta', 'Carrera', 'Feria'],
  energia: ['Fuente', 'Siesta', 'Banquete', 'Spa', 'Hamaca', 'Hoguera', 'Manantial', 'Picnic'],
}

// Boceto del usuario: uno al centro y cuatro alrededor (arriba, abajo, izquierda, derecha), no coplanares.
const NODE_DEFS = [
  { name: 'Eco', color: '#c77dff', pos: [0, 0, 0], n: 8, bias: 0.5 },
  { name: 'Cima', color: '#6bcb77', pos: [10, 76, -32], n: 3, bias: 0.35 },
  { name: 'Delta', color: '#4d96ff', pos: [-8, -74, 34], n: 5, bias: 0.5 },
  { name: 'Alba', color: '#ffb347', pos: [-82, 10, 26], n: 4, bias: 0.5 },
  { name: 'Brasa', color: '#ff6b6b', pos: [84, -10, -22], n: 6, bias: 0.65 },
].map((d) => ({ ...d, pos: d.pos.map((v) => v * WORLD_SCALE) }))

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
export function laneAngle(seg, laneId, u) {
  const l = laneOf(seg, laneId)
  return l ? l.angle + l.offset * Math.sin(Math.PI * clamp(u, 0, 1)) : 0
}
export function laneFrame(seg, laneId, u, out = {}) {
  wallFrame(seg, laneAngle(seg, laneId, u), u, undefined, out)
  out.lane = laneOf(seg, laneId)
  return out
}
// Carril del tramo más cercano a un ángulo (así un carril que acaba sigue por el vecino).
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

// Carriles y mecanismos de un way (rng propio: no altera la generación de las rutas).
function buildLanes(way) {
  const rng = mulberry32(90000 + way.idx * 131)
  const jit = (rng() - 0.5) * 0.5
  const set = [0, Math.PI / 2 + jit, Math.PI, (3 * Math.PI) / 2 + jit].map(wrapAng)
  const theme = way.theme.id
  const mechs = Object.keys(THEME_MECHS[theme])
  const width = +(BALL_R * 2.6).toFixed(2)
  const mk = (s, u, from, to, kind, dur) => {
    const M = MECHANISMS[kind]; const sk = s.speedK ?? 1
    const duration = +(dur ?? (M.dur / Math.sqrt(sk)) * (s.drag > 2 ? 1.25 : 1)).toFixed(2)
    const span = (duration * (14 * sk + (s.boost || 0) * 0.4)) / s.length
    return {
      u: +u.toFixed(3), uEnd: +Math.min(1, u + span).toFixed(3), from, to, kind,
      name: THEME_MECHS[theme][kind] || M.name, emoji: M.emoji, style: M.style, duration,
      risk: M.risk, fail: M.fail, reward: { ...M.reward }, boost: M.boost,
    }
  }
  way.segments.forEach((s, i) => {
    let ids
    if (s.air || s.kind === 'salida' || s.kind === 'llegada') ids = [0, 1, 2, 3]
    else { const n = 2 + Math.floor(rng() * 3); ids = [0, ...shuffle([1, 2, 3], rng).slice(0, n - 1)].sort((x, y) => x - y) }
    s.lanes = ids.map((id) => ({
      id, angle: set[id], offset: s.air || id === 0 ? 0 : +((rng() - 0.5) * 0.6).toFixed(3), width, name: LANE_NAMES[id],
    }))
    s.switches = []
    if (s.air) {
      // el propio obstáculo aéreo catapulta: decide en qué pared aterriza
      const dur = clamp((s.length / (14 * (s.speedK ?? 1) + s.boost * 0.6)) * 0.8, 0.6, 3.5)
      for (const id of ids) {
        const to = id === 0 ? [2, rng() < 0.5 ? 1 : 3] : [0, (id + 2) % 4]
        for (const t of new Set(to)) if (t !== id) s.switches.push(mk(s, 0.12, id, t, s.kind, dur))
      }
      s.switchesByLane = new Map(ids.map((id) => [id, s.switches.filter((sw) => sw.from === id)]))
      return
    }
    const primary = s.event && MECHANISMS[s.event] ? s.event : mechs[i % mechs.length]
    let secondary = mechs[(i + 1) % mechs.length]
    if (secondary === primary) secondary = mechs[(i + 2) % mechs.length]
    const u1 = 0.22 + rng() * 0.12; const u2 = 0.62 + rng() * 0.14
    const others = ids.filter((id) => id !== 0)
    // estación 1: desde el suelo a cada pared/techo; estación 2: vuelta al suelo y un cruce entre paredes
    others.forEach((id, j) => s.switches.push(mk(s, u1, 0, id, j === 0 ? primary : secondary)))
    others.forEach((id, j) => s.switches.push(mk(s, u2, id, 0, j === 0 ? secondary : primary)))
    if (others.length >= 2) s.switches.push(mk(s, u2, others[0], others[1], primary))
    // Índice de estaciones por carril origen para que cada tick consulte sólo las
    // opciones de ese carril, ya ordenadas por posición.
    s.switchesByLane = new Map(ids.map((id) => [id, s.switches.filter((sw) => sw.from === id).sort((a, b) => a.u - b.u)]))
  })
}

const TERM_MIN_ANG = 0.45 // separación angular mínima entre terminales de un nodo

export function buildWorld(seed = 369) {
  const rng = mulberry32(seed)
  const world = { nodes: [], destinos: [], circuits: [], ways: [], waysFrom: [], routes: [], segments: [] }
  NODE_DEFS.forEach((d, idx) => world.nodes.push({ idx, name: d.name, color: d.color, pos: new THREE.Vector3(...d.pos), radius: NODE_R }))
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
    const dir = o.pos.clone().sub(node.pos).normalize()
    const out = pickTerminal(dir)
    const inn = pickTerminal(dir)
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
// Hélice alrededor de la cuerda A0->B con radio variable rad(t).
const coil = (A, B, turns, rad, A0 = A, ease = (t) => t) => {
  const { u, v } = basis(A, B); const C = B.clone().sub(A0); const n = Math.ceil(turns * 10); const pts = []
  for (let i = 1; i < n; i++) {
    const t = i / n; const a = t * turns * TAU
    pts.push(at(A0, C, ease(t), u, Math.cos(a) * rad(t), v, Math.sin(a) * rad(t)))
  }
  return pts
}
const bump = (t) => Math.min(1, 5 * t, 5 * (1 - t)) // el radio nace y muere en la cuerda

const SHAPES = {
  rampa: (A, B) => { const { C, L, u, v } = basis(A, B); return [at(A, C, 0.33, u, L * 0.1, v, -L * 0.05), at(A, C, 0.67, u, -L * 0.1, v, -L * 0.05)] },
  zigzag: (A, B, P) => { const { C, u } = basis(A, B); return [1, 2, 3, 4, 5, 6].map((i) => at(A, C, i / 7, u, (i % 2 ? 2.6 : -2.6) * WORLD_SCALE * P.coil)) },
  espiral: (A, B, P) => coil(A, B, 2 + P.turns, (t) => 3.2 * WORLD_SCALE * P.coil * bump(t)),
  sacacorchos: (A, B, P) => coil(A, B, 3 + P.turns, (t) => (P.radius * 1.85 + 1.2) * bump(t)),
  // remolino que se cierra: empieza en el borde del cono (A) y acaba en su vértice (B)
  embudo: (A, B, P) => { const R = 4.0 * WORLD_SCALE * P.coil; return coil(A, B, 3, (t) => R * (1 - t), at(A, basis(A, B).u, -R), (t) => t * t) },
  rizo: (A, B, P) => {
    const { C, L, c, u, v } = basis(A, B); const r = Math.min(3.4 * WORLD_SCALE * P.coil, L * 0.3); const sh = P.radius * 2.4
    const pts = [at(A, C, 0.3, u, -sh / 2)]
    // círculo vertical; se desplaza de lado lo justo para que el tubo no se corte a sí mismo
    for (let k = 0; k <= 12; k++) { const a = (k / 12) * TAU; pts.push(at(A, C, 0.5, c, r * Math.sin(a), v, r * (1 - Math.cos(a)), u, sh * (k / 12 - 0.5))) }
    return [...pts, at(A, C, 0.7, u, sh / 2)]
  },
  cascada: (A, B) => {
    const { C } = basis(A, B); const k = 5; const pts = []
    const step = (h, y) => new THREE.Vector3(A.x + C.x * h, A.y + C.y * y, A.z + C.z * h)
    for (let i = 0; i < k; i++) { pts.push(step((i + 0.75) / k, (i + 0.08) / k)); if (i < k - 1) pts.push(step((i + 1) / k, (i + 1) / k)) }
    return pts
  },
  // tiro horizontal: parábola de caída libre
  caida: (A, B) => { const { C } = basis(A, B); return [1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(A.x + C.x * (i / 8), A.y + C.y * (i / 8) ** 2, A.z + C.z * (i / 8))) },
  // dos botes
  trampolin: (A, B) => { const { C, L } = basis(A, B); const h = 2.5 * WORLD_SCALE + L * 0.15; return Array.from({ length: 15 }, (_, i) => at(A, C, (i + 1) / 16, Y, h * Math.abs(Math.sin(((i + 1) / 16) * TAU)))) },
  canon: (A, B) => { const { C, L } = basis(A, B); return Array.from({ length: 9 }, (_, i) => at(A, C, (i + 1) / 10, Y, L * 1.0 * ((i + 1) / 10) * (1 - (i + 1) / 10))) },
  turbina: (A, B, P) => {
    const { C, u, v } = basis(A, B); const amp = 2.8 * WORLD_SCALE * P.coil
    return Array.from({ length: 7 }, (_, i) => { const t = (i + 1) / 8; return at(A, C, t, u, amp * Math.sin(t * Math.PI * 1.5), v, 1.1 * WORLD_SCALE * Math.sin(t * Math.PI)) })
  },
  hielo_resbaloso: (A, B, P) => {
    const { C, u, v } = basis(A, B)
    return [at(A, C, 0.25, u, 1.7 * WORLD_SCALE * P.coil, v, -0.7 * WORLD_SCALE), at(A, C, 0.5, u, 0, v, -1.4 * WORLD_SCALE), at(A, C, 0.75, u, -1.7 * WORLD_SCALE * P.coil, v, -0.7 * WORLD_SCALE)]
  },
  pantano: (A, B) => {
    const { C, u, v } = basis(A, B)
    return [1, 2, 3, 4, 5].map((i) => { const t = i / 6; return at(A, C, t, v, -1.3 * WORLD_SCALE * Math.sin(t * Math.PI), u, (i % 2 ? 1.2 : -1.2) * WORLD_SCALE) })
  },
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

const TENSION = { zigzag: 0.25, cascada: 0.2 } // esquinas marcadas; el resto, centrípeta (sin rebasar)
const ownsStart = (k) => KINDS[k].air || k === 'embudo' // su arranque lo dicta la forma, no el vecino

function shape(kind, A, B, P, Ta, Tb, midPt = null) {
  const lead = Math.min(2.5 * WORLD_SCALE, A.distanceTo(B) * 0.15); const air = KINDS[kind].air
  const pts = [A]
  if (Ta && !ownsStart(kind)) pts.push(at(A, Ta, lead))
  if (midPt) pts.push(midPt)
  pts.push(...SHAPES[kind](A, B, P))
  if (Tb && !air) pts.push(at(B, Tb, -lead))
  pts.push(B)
  const t = TENSION[kind]
  return new THREE.CatmullRomCurve3(pts, false, t ? 'catmullrom' : 'centripetal', t)
}

// Punto de rodeo para salida/llegada si la normal del terminal apunta lejos del hub.
function wrapMid(node, dir, target) {
  const toTarget = target.clone().sub(node.pos).normalize()
  if (dir.dot(toTarget) >= 0.35) return null
  return node.pos.clone().addScaledVector(slerpDir(dir, toTarget, 0.55), NODE_R + 7.0)
}

function sampleWayPoints(way, steps = 14) {
  const pts = []
  for (const s of way.segments) {
    for (let k = 0; k <= steps; k++) {
      const u = k / steps
      const trim = (s.kind === 'salida' && u * s.length < TRIM_LEN) || (s.kind === 'llegada' && (1 - u) * s.length < TRIM_LEN)
      const cached = steps === 28 && k % 2 === 0 ? s._placementCoarse?.[k / 2] : null
      const p = cached || s.curve.getPointAt(u)
      if (steps === 14) (s._placementCoarse || (s._placementCoarse = []))[k] = p
      pts.push({ p, r: s.radius, kind: s.kind, trim })
    }
  }
  return pts
}

const SPATIAL_CELL = 12
const pointCell = (p) => `${Math.floor(p.x / SPATIAL_CELL)},${Math.floor(p.y / SPATIAL_CELL)},${Math.floor(p.z / SPATIAL_CELL)}`
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

function placeWay(world, circuit, from, to, placed) {
  const a = world.nodes[from]; const b = world.nodes[to]
  const others = world.nodes.filter((o) => o !== a && o !== b)
  const baseTheta = ((circuit.idx * 0.6180339887 + (from < to ? 0 : 0.5)) % 1) * TAU
  const N_ANG = 18
  let best = null; let bestScore = -Infinity

  const evalCand = (cand, steps) => {
    const pts = sampleWayPoints(cand, steps)
    let minNode = Infinity
    const nodeMargin = NODE_R + 3 * WORLD_SCALE
    const nodeAcceptSq = (nodeMargin + 1.5) ** 2
    for (const pt of pts) {
      for (const o of others) {
        const d2 = pt.p.distanceToSquared(o.pos)
        if (d2 < nodeAcceptSq) minNode = Math.min(minNode, Math.sqrt(d2) - nodeMargin)
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
        const bucket = grid.get(`${x + dx},${y + dy},${z + dz}`)
        if (!bucket) continue
        for (const q of bucket) {
          const r = pt.r + q.r; const d2 = pt.p.distanceToSquared(q.p)
          if (d2 < (r + 4.8) ** 2) minTube = Math.min(minTube, Math.sqrt(d2) - r)
        }
      }
    }
    return { minTube, minNode, minHub }
  }

  for (const bowExtra of [-12, 0, 10, 20, 32, 46, 62, 80, 100].map((x) => x * WORLD_SCALE)) {
    for (let k = 0; k < N_ANG; k++) {
      const theta = (baseTheta + (k / N_ANG) * TAU) % TAU
      const cand = buildWay(world, circuit, from, to, theta, bowExtra, false)
      const coarse = evalCand(cand, 14)
      if (!coarse) continue
      const res = coarse.minTube >= 2.5 && coarse.minNode >= 0 ? evalCand(cand, 28) : coarse
      if (!res) continue
      const score = res.minTube < 4.0 ? res.minTube - 10 : Math.min(res.minTube, res.minNode + 1, res.minHub * 0.2)
      if (score > bestScore) { bestScore = score; best = { theta, bowExtra } }
      if (res.minTube >= 4.8 && res.minNode >= 1.5 && res.minHub >= 24) {
        const w = buildWay(world, circuit, from, to, theta, bowExtra, true)
        indexPlacedWay(placed, { pts: sampleWayPoints(w, 28), hubs: w.junctions })
        return w
      }
    }
  }
  const chosen = best || { theta: baseTheta, bowExtra: 0 }
  const w = buildWay(world, circuit, from, to, chosen.theta, chosen.bowExtra, true)
  indexPlacedWay(placed, { pts: sampleWayPoints(w, 28), hubs: w.junctions })
  return w
}

const FLEX_PLAIN = FLEX.filter((k) => !KINDS[k].event)
const GRAV_PLAIN = GRAV.filter((k) => !KINDS[k].event)
const EVENT_FLEX = FLEX.filter((k) => KINDS[k].event)
const EVENT_ALL = OBSTACLES.filter((k) => KINDS[k].event)

// ───────────────────────── un sentido de un circuito ─────────────────────────
function buildWay(world, circuit, from, to, theta = 0, bowExtra = 0, commit = true) {
  const { nodes } = world
  const a = nodes[from]; const b = nodes[to]; const theme = circuit.theme; const P = PARAMS[theme.id]
  const rng = mulberry32(7000 + circuit.idx * 31 + (from < to ? 0 : 1))
  const pOut = a.portTo[to]; const pIn = b.portTo[from]
  const S = a.verts[pOut.out].pos; const nS = a.verts[pOut.out].dir
  const E = b.verts[pIn.in].pos; const nE = b.verts[pIn.in].dir
  const { C, u, v } = basis(S, E)
  const ct = Math.cos(theta); const st = Math.sin(theta)
  const n1 = u.clone().multiplyScalar(ct).addScaledVector(v, st)
  const n2 = v.clone().multiplyScalar(ct).addScaledVector(u, -st)
  // si la recta pasa junto a otro nodo (pares opuestos y el del centro), la panza crece para rodearlo
  const near = Math.min(...nodes.filter((o) => o !== a && o !== b).map((o) => new THREE.Line3(S, E).closestPointToPoint(o.pos, true, new THREE.Vector3()).distanceTo(o.pos)))
  const bow = P.bow + (near < 38 * WORLD_SCALE ? 28 * WORLD_SCALE : 0) + bowExtra
  const J = (s) => {
    const f = Math.pow(Math.sin(Math.PI * s), 0.72)
    return at(S, C, s, n1, bow * f, n2, P.arch * f)
  }
  const stops = [0.16, 0.5, 0.84]
  const hubs = stops.map(J)
  const hubT = stops.map((s) => J(s + 0.02).sub(J(s - 0.02)).normalize())

  const way = {
    idx: world.ways.length, id: `${from}>${to}`, circuit, from, to, theme, params: P, segments: [], routes: [],
    junctions: hubs.map((pos, i) => ({ pos, kind: ['fork', 'cross', 'merge'][i] })), length: 0,
  }
  const seg = (kind, curve, route, tramo) => {
    const K = KINDS[kind]
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
  const launch = seg('salida', shape('salida', S, hubs[0], P, nS, hubT[0], wrapMid(a, nS, hubs[0])), -1, [])

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
          cs[m] = shape(kinds[m], pts[m], pts[m + 1], P, Ta, Tb)
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
  const landing = seg('llegada', shape('llegada', hubs[2], E, P, hubT[2], nE.clone().negate(), wrapMid(b, nE, hubs[2])), -1, [])
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
    if (tOut) tOut.way = way
    if (tIn) tIn.way = way
    world.ways.push(way); world.waysFrom[from].push(way)
  }
  return way
}
