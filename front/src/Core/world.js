// Mundo de Bollitas, sin React ni render: lo usan la sim y el 3D.
//
// ═══════════════════════════ CONTRATO DE DATOS ═══════════════════════════
// Unidades de mundo; Y es "arriba" (la gravedad tira hacia -Y). Todo `pos`/`dir` es THREE.Vector3.
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
//   Topología: salida -> fork -> [ruta r: 2 obstáculos] -> cross -> [ruta r: 2 obstáculos] -> merge -> llegada.
//   En `fork` y en `cross` la bollita elige ruta, así que puede cambiar de ruta a mitad de circuito.
//
// route = { idx (global), r (local), name 'A'|'B'|'C', way, segments[6] (salida, 4 obstáculos, llegada),
//           kinds[4] (los obstáculos, todos distintos), length }
//
// segment = {
//   idx (global), i (índice en way.segments), way, route (r local, o -1 si es compartido),
//   kind (clave de KINDS), name, emoji,
//   curve (THREE.CatmullRomCurve3; curve.getPoint(1) de uno == getPoint(0) de cada `next`),
//   length, radius (radio interior del tubo de cristal),
//   air (true: va por el aire, SIN tubo: trampolin, canon, caida),
//   boost (velocidad mínima con la que sale disparada al entrar), drag (multiplicador de rozamiento),
//   risk (0..1), next[] (índices `i` de los tramos siguientes; [] en la llegada),
//   tramo[] (kinds del medio-recorrido de ruta al que pertenece; lo usa la sim para decidir)
// }
//   Continuidad: posición siempre; tangente también salvo al salir de un tramo `air` o entrar a un embudo.
//
// Helpers: frameAt(curve, u), cityPath(node, a, b), slerpDir(a, b, t, out), mulberry32(seed).
// La forma de cada bollita y sus fases están documentadas al inicio de sim.js.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'

export const NODE_R = 7.5
export const BALL_R = 0.5
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
export const PARAMS = {
  sombrio: { n: 3, bow: 18, arch: -14, spread: 10, phase: 0.4, coil: 0.8, turns: 1, radius: 1.15, fav: ['caida', 'embudo', 'sacacorchos', 'canon'] },
  bosque: { n: 2, bow: 16, arch: 6, spread: 11, phase: 1.2, coil: 1.35, turns: 1, radius: 1.5, fav: ['espiral', 'cascada', 'zigzag', 'rampa'] },
  mar: { n: 3, bow: 20, arch: 0, spread: 11, phase: 2.2, coil: 1.1, turns: 0, radius: 1.35, fav: ['cascada', 'embudo', 'rizo', 'trampolin'] },
  desierto: { n: 2, bow: 22, arch: 16, spread: 9, phase: 0, coil: 1, turns: 0, radius: 1.4, fav: ['caida', 'espiral', 'canon', 'rampa'] },
  hielo: { n: 3, bow: 17, arch: -7, spread: 11, phase: 3, coil: 0.9, turns: 2, radius: 1.2, fav: ['cascada', 'espiral', 'zigzag', 'sacacorchos'] },
  volcan: { n: 3, bow: 16, arch: 24, spread: 9, phase: 1.6, coil: 1.2, turns: 1, radius: 1.3, fav: ['caida', 'espiral', 'canon', 'rizo'] },
  cristal: { n: 2, bow: 19, arch: 4, spread: 10, phase: 0.8, coil: 0.75, turns: 2, radius: 1.1, fav: ['espiral', 'embudo', 'rizo', 'sacacorchos'] },
  nubes: { n: 3, bow: 21, arch: 18, spread: 11, phase: 2.6, coil: 1.3, turns: 0, radius: 1.6, fav: ['embudo', 'caida', 'trampolin', 'canon'] },
  neon: { n: 3, bow: 16, arch: 3, spread: 10, phase: 3.6, coil: 1, turns: 1, radius: 1.25, fav: ['caida', 'cascada', 'rizo', 'zigzag'] },
  jardin: { n: 2, bow: 16, arch: 9, spread: 11, phase: 1.9, coil: 1.15, turns: 0, radius: 1.45, fav: ['cascada', 'espiral', 'rampa', 'trampolin'] },
}

// w: cuánta cuerda ocupa. drop: desnivel que necesita (obstáculos de gravedad).
// boost/drag/risk/air: ver el contrato (segment).
export const KINDS = {
  salida: { name: 'Lanzadera', emoji: '🚀', boost: 12, drag: 1, risk: 0.2 },
  llegada: { name: 'Llegada', emoji: '🏁', boost: 0, drag: 1.5, risk: 0 },
  rampa: { name: 'Rampa', emoji: '🛝', w: 1, boost: 0, drag: 1, risk: 0.1 },
  zigzag: { name: 'Zigzag', emoji: '〰️', w: 1.2, boost: 0, drag: 1.3, risk: 0.3 },
  rizo: { name: 'Rizo', emoji: '➰', w: 1.1, boost: 15, drag: 0.6, risk: 0.8 },
  sacacorchos: { name: 'Sacacorchos', emoji: '🧬', w: 1.1, boost: 9, drag: 1, risk: 0.5 },
  trampolin: { name: 'Trampolín', emoji: '🤸', w: 1.2, boost: 13, drag: 0, risk: 0.7, air: true },
  canon: { name: 'Cañón', emoji: '💥', w: 1.7, boost: 26, drag: 0, risk: 1, air: true },
  espiral: { name: 'Espiral', emoji: '🌀', w: 0.8, boost: 0, drag: 0.8, risk: 0.5, drop: 12 },
  caida: { name: 'Caída libre', emoji: '🪂', w: 0.6, boost: 0, drag: 0, risk: 0.9, drop: 13, air: true },
  cascada: { name: 'Cascada', emoji: '🪜', w: 1, boost: 0, drag: 1.2, risk: 0.4, drop: 10 },
  embudo: { name: 'Embudo', emoji: '🌪️', w: 0.7, boost: 0, drag: 4, risk: 0.5, drop: 9 },
}
const FLEX = ['rampa', 'zigzag', 'rizo', 'sacacorchos', 'trampolin', 'canon'] // unen dos puntos cualesquiera
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
  { name: 'Cima', color: '#6bcb77', pos: [7, 52, -20], n: 3, bias: 0.35 },
  { name: 'Delta', color: '#4d96ff', pos: [-5, -50, 23], n: 5, bias: 0.5 },
  { name: 'Alba', color: '#ffb347', pos: [-56, 6, 16], n: 4, bias: 0.5 },
  { name: 'Brasa', color: '#ff6b6b', pos: [58, -7, -13], n: 6, bias: 0.65 },
]

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

export function buildWorld(seed = 369) {
  const rng = mulberry32(seed)
  const world = { nodes: [], destinos: [], circuits: [], ways: [], waysFrom: [], routes: [], segments: [] }
  NODE_DEFS.forEach((d, idx) => world.nodes.push({ idx, name: d.name, color: d.color, pos: new THREE.Vector3(...d.pos), radius: NODE_R }))
  world.nodes.forEach((node) => buildCity(world, node, NODE_DEFS[node.idx], rng))
  world.waysFrom = world.nodes.map(() => [])
  for (let a = 0; a < world.nodes.length; a++) {
    for (let b = a + 1; b < world.nodes.length; b++) {
      const c = { idx: world.circuits.length, a, b, theme: THEMES[world.circuits.length % THEMES.length], ways: [] }
      world.circuits.push(c)
      c.ways.push(buildWay(world, c, a, b), buildWay(world, c, b, a))
      c.mid = c.ways[0].junctions[1].pos.clone().lerp(c.ways[1].junctions[1].pos, 0.5)
    }
  }
  return world
}

// ───────────────────────── ciudad sobre la esfera ─────────────────────────
function buildCity(world, node, def, rng) {
  const dirs = []
  node.ports = []; node.portTo = []
  for (const o of world.nodes) {
    if (o === node) continue
    const dir = o.pos.clone().sub(node.pos).normalize()
    // la salida a un lado y la entrada al otro: así ida y vuelta nunca se cruzan
    const s = new THREE.Vector3().crossVectors(dir, Y).normalize()
    const out = dirs.push(dir.clone().addScaledVector(s, PORT_K).normalize()) - 1
    const inn = dirs.push(dir.clone().addScaledVector(s, -PORT_K).normalize()) - 1
    node.portTo[o.idx] = { to: o.idx, dir, in: inn, out, wayIn: null, wayOut: null }
    node.ports.push(node.portTo[o.idx])
  }
  const nPort = dirs.length
  // resto de cruces: espiral de Fibonacci (reparto uniforme), sin pisar los puertos
  const N = 26; const rot = rng() * TAU
  for (let i = 0; i < N; i++) {
    const y = 1 - (2 * (i + 0.5)) / N; const r = Math.sqrt(1 - y * y); const a = i * Math.PI * (3 - Math.sqrt(5)) + rot
    const d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)
    if (dirs.every((q) => q.dot(d) < 0.95)) dirs.push(d)
  }
  node.verts = dirs.map((dir) => ({ dir, pos: node.pos.clone().addScaledVector(dir, NODE_R) }))

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
  const C = B.clone().sub(A); const L = C.length(); const c = C.clone().divideScalar(L)
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
  zigzag: (A, B, P) => { const { C, u } = basis(A, B); return [1, 2, 3, 4, 5, 6].map((i) => at(A, C, i / 7, u, (i % 2 ? 3 : -3) * P.coil)) },
  espiral: (A, B, P) => coil(A, B, 2 + P.turns, (t) => 3.6 * P.coil * bump(t)),
  sacacorchos: (A, B, P) => coil(A, B, 3 + P.turns, (t) => (P.radius + 0.6) * bump(t)),
  // remolino que se cierra: empieza en el borde del cono (A) y acaba en su vértice (B)
  embudo: (A, B, P) => { const R = 4.5 * P.coil; return coil(A, B, 3, (t) => R * (1 - t), at(A, basis(A, B).u, -R), (t) => t * t) },
  rizo: (A, B, P) => {
    const { C, L, c, u, v } = basis(A, B); const r = Math.min(3.4 * P.coil, L * 0.3); const sh = P.radius * 2.4
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
  trampolin: (A, B) => { const { C, L } = basis(A, B); const h = 2.5 + L * 0.15; return Array.from({ length: 15 }, (_, i) => at(A, C, (i + 1) / 16, Y, h * Math.abs(Math.sin(((i + 1) / 16) * TAU)))) },
  canon: (A, B) => { const { C, L } = basis(A, B); return Array.from({ length: 9 }, (_, i) => at(A, C, (i + 1) / 10, Y, L * 1.2 * ((i + 1) / 10) * (1 - (i + 1) / 10))) },
}
SHAPES.salida = SHAPES.llegada = () => []

const TENSION = { zigzag: 0.25, cascada: 0.2 } // esquinas marcadas; el resto, centrípeta (sin rebasar)
const ownsStart = (k) => KINDS[k].air || k === 'embudo' // su arranque lo dicta la forma, no el vecino

function shape(kind, A, B, P, Ta, Tb) {
  const lead = Math.min(2.5, A.distanceTo(B) * 0.15); const air = KINDS[kind].air
  const pts = [A]
  if (Ta && !ownsStart(kind)) pts.push(at(A, Ta, lead))
  pts.push(...SHAPES[kind](A, B, P))
  if (Tb && !air) pts.push(at(B, Tb, -lead))
  pts.push(B)
  const t = TENSION[kind]
  return new THREE.CatmullRomCurve3(pts, false, t ? 'catmullrom' : 'centripetal', t)
}

// ───────────────────────── un sentido de un circuito ─────────────────────────
function buildWay(world, circuit, from, to) {
  const { nodes } = world
  const a = nodes[from]; const b = nodes[to]; const theme = circuit.theme; const P = PARAMS[theme.id]
  const rng = mulberry32(7000 + circuit.idx * 31 + (from < to ? 0 : 1))
  const pOut = a.portTo[to]; const pIn = b.portTo[from]
  const S = a.verts[pOut.out].pos; const nS = a.verts[pOut.out].dir
  const E = b.verts[pIn.in].pos; const nE = b.verts[pIn.in].dir
  const { C, u: n1, v: n2 } = basis(S, E)
  // si la recta pasa junto a otro nodo (pares opuestos y el del centro), la panza crece para rodearlo
  const near = Math.min(...nodes.filter((o) => o !== a && o !== b).map((o) => new THREE.Line3(S, E).closestPointToPoint(o.pos, true, new THREE.Vector3()).distanceTo(o.pos)))
  const bow = P.bow + (near < 20 ? 14 : 0)
  const J = (s) => at(S, C, s, n1, bow * Math.sin(Math.PI * s), n2, P.arch * Math.sin(Math.PI * s))
  const stops = [0.17, 0.5, 0.83]
  const hubs = stops.map(J)
  const hubT = stops.map((s) => J(s + 0.02).sub(J(s - 0.02)).normalize())

  const way = {
    idx: world.ways.length, id: `${from}>${to}`, circuit, from, to, theme, params: P, segments: [], routes: [],
    junctions: hubs.map((pos, i) => ({ pos, kind: ['fork', 'cross', 'merge'][i] })), length: 0,
  }
  const seg = (kind, curve, route, tramo) => {
    const K = KINDS[kind]
    const s = {
      idx: world.segments.length, i: way.segments.length, way, route, kind, name: K.name, emoji: K.emoji,
      curve, length: curve.getLength(), radius: P.radius, air: !!K.air, boost: K.boost, drag: K.drag, risk: K.risk,
      next: [], tramo,
    }
    way.segments.push(s); world.segments.push(s)
    return s
  }
  const launch = seg('salida', shape('salida', S, hubs[0], P, nS, hubT[0]), -1, [])

  // se reparten sin repetir dentro de una ruta: primero los favoritos del tema
  const deck = (all) => [...P.fav.filter((k) => all.includes(k)), ...shuffle(all.filter((k) => !P.fav.includes(k)), rng)]
  const grav = deck(GRAV); const flex = deck(FLEX)
  const heads = [[], []]; const tails = [[], []]
  for (let r = 0; r < P.n; r++) {
    const own = []
    for (let h = 0; h < 2; h++) {
      const A = hubs[h]; const B = hubs[h + 1]; const g = grav[(2 * r + h) % grav.length]; const f = flex[(2 * r + h) % flex.length]
      const kinds = rng() < 0.5 ? [g, f] : [f, g]
      const frac = clamp(KINDS[kinds[0]].w / (KINDS[g].w + KINDS[f].w), 0.36, 0.64)
      // las rutas se abren alrededor del eje y en la segunda mitad giran: se trenzan
      const ang = P.phase + ((r + h * 0.5) * TAU) / P.n
      const Q = at(A, B.clone().sub(A), frac, n1, Math.cos(ang) * P.spread, n2, Math.sin(ang) * P.spread)
      // el obstáculo de gravedad baja de verdad: se fuerza su desnivel moviendo el punto intermedio
      const end = kinds[0] === g ? A : B
      const drop = Math.max(KINDS[g].drop, 0.7 * Math.hypot(Q.x - end.x, Q.z - end.z))
      Q.y = kinds[0] === g ? Math.min(Q.y, A.y - drop) : Math.max(Q.y, B.y + drop)

      let T = B.clone().sub(A).normalize(); let c0; let c1
      if (ownsStart(kinds[1])) {
        c1 = shape(kinds[1], Q, B, P, null, hubT[h + 1]); T = c1.getTangent(0)
        c0 = shape(kinds[0], A, Q, P, hubT[h], T)
      } else {
        c0 = shape(kinds[0], A, Q, P, hubT[h], T)
        if (KINDS[kinds[0]].air) T = c0.getTangent(1)
        c1 = shape(kinds[1], Q, B, P, T, hubT[h + 1])
      }
      const s0 = seg(kinds[0], c0, r, kinds); const s1 = seg(kinds[1], c1, r, kinds)
      s0.next = [s1.i]
      heads[h].push(s0); tails[h].push(s1); own.push(s0, s1)
    }
    way.routes.push({ idx: world.routes.length + r, r, name: 'ABC'[r], way, segments: own, kinds: own.map((s) => s.kind), length: 0 })
  }
  const landing = seg('llegada', shape('llegada', hubs[2], E, P, hubT[2], nE.clone().negate()), -1, [])
  launch.next = heads[0].map((s) => s.i)
  tails[0].forEach((s) => { s.next = heads[1].map((x) => x.i) })
  tails[1].forEach((s) => { s.next = [landing.i] })
  for (const rt of way.routes) {
    rt.segments = [launch, ...rt.segments, landing]
    rt.length = rt.segments.reduce((sum, s) => sum + s.length, 0)
    world.routes.push(rt)
  }
  way.length = way.routes.reduce((sum, rt) => sum + rt.length, 0) / way.routes.length
  pOut.wayOut = way; pIn.wayIn = way
  world.ways.push(way); world.waysFrom[from].push(way)
  return way
}
