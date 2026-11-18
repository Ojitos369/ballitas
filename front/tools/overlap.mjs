// Mide el huelgo entre caminos: distancia centro-a-centro menos la suma de radios
// (braidRadius: el envolvente de la trenza, que ya incluye el radio de pista).
// Categorías (todas deben cumplir huelgo >= MIN_GAP_K radios de pista, salvo uniones diseñadas):
//   cross : circuitos distintos.
//   same  : ida contra vuelta del mismo circuito.
//   route : rutas distintas dentro de un mismo sentido (extensión real de carriles, routeExtent; se excluye la zona de unión fork/cross/merge, ROUTE_JOIN).
//   lane  : cintas visibles de carriles de un mismo tramo entre sí (ver measureRibbons).
//   cintas: toda cinta visible contra toda cinta (geometría que dibuja pista.jsx), fuera de uniones diseñadas.
// Zona de puerto (sólo cross/same, medidos sobre el eje): dos ways que llegan al mismo nodo se unen allí; no se mide un par
// si uno de sus puntos está a menos de PORT_ZONE del centro de un nodo de ambos ways (world.inPort). Las cintas no tienen
// esa zona: sólo la excepción de unión de world.ribbonHits.
//   uso: node tools/overlap.mjs [nSemillas=20] [semilla0=1] [rutaModulo=../src/Core/world.js] [-] [malas]
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const modPath = process.argv[4] && process.argv[4] !== '-' ? pathToFileURL(resolve(process.argv[4])).href : '../src/Core/world.js'
const W = await import(modPath)
const { buildWorld, braidRadius, routeExtent, NODE_R, GRID_LEN, ribbonHits, RIBBON_CLEAR } = W
const inPort = W.inPort ?? ((p, q) => p.zn >= 0 && p.zn === q.zn)
export const MIN_GAP_K = W.MIN_GAP_K ?? 1.5 // huelgo mínimo, en radios de pista (seg.radius mayor del par)
const PORT_ZONE = W.PORT_ZONE ?? NODE_R + GRID_LEN + 20
const ROUTE_JOIN = W.ROUTE_JOIN ?? 56 // radio (u, euclidiano) alrededor de fork/cross/merge donde las rutas se abren en abanico por diseño
const CELL = 40

function sampleWay(way) {
  const out = []
  const ends = [way.from, way.to]
  for (const s of way.segments) {
    const n = Math.max(12, Math.ceil(s.length / 1.5))
    for (let k = 0; k <= n; k++) {
      const u = k / n; const p = s.curve.getPointAt(u)
      const hubD = Math.min(...way.junctions.map((j) => j.pos.distanceTo(p))) // abanico de la unión (fork/cross/merge)
      out.push({ p, r: braidRadius(s, u), ext: routeExtent ? routeExtent(s, u) : braidRadius(s, u), tube: s.radius, way: way.idx, c: way.circuit.idx, kind: s.kind, route: s.route, u, hubD, shared: s.route < 0, f: way.from, t: way.to, zn: ends.find((i) => p.distanceTo(way.__nodes[i].pos) < PORT_ZONE) ?? -1 })
    }
  }
  return out
}

// Cintas visibles (world.ribbonHits): toda cinta de carril contra toda cinta (también del mismo tramo y consigo misma),
// con su superficie real (relieve y puntas incluidos) y semiancho RIBBON_HALF; choque si d < RIBBON_CLEAR. Holgura =
// d - RIBBON_CLEAR del peor par fuera de uniones (>= 0 cumple; 1.00 = ningún par a menos de RIBBON_CLEAR + 1).
// lane = los choques de cintas de un mismo tramo; cintas = todos.
function measureRibbons(world) {
  const { hits, slack, joint, S } = ribbonHits(world)
  const { ribs, R } = S
  const lane = { gap: Infinity, slack: Infinity, info: '' }; const cint = { gap: Infinity, slack: Math.min(1, slack), info: '', n: hits.length / 3, joint }
  const tag = (r, i) => `w${r.way.idx} ${r.seg.kind}/r${r.seg.route} L${r.lane}@${((i - r.start) / r.n).toFixed(2)}`
  for (let k = 0; k < hits.length; k += 3) {
    const A = ribs[R[hits[k]]]; const B = ribs[R[hits[k + 1]]]; const d = hits[k + 2]; const info = `${tag(A, hits[k])} vs ${tag(B, hits[k + 1])}`
    if (d < cint.gap) Object.assign(cint, { gap: d, info })
    if (A.seg === B.seg && d - RIBBON_CLEAR < lane.slack) Object.assign(lane, { gap: d, slack: d - RIBBON_CLEAR, info })
  }
  if (lane.slack === Infinity) lane.slack = Math.max(0, cint.slack)
  if (cint.gap === Infinity) cint.gap = RIBBON_CLEAR + cint.slack
  if (lane.gap === Infinity) lane.gap = RIBBON_CLEAR + lane.slack
  return { lane, cintas: cint }
}

// slack = huelgo - K * radio de pista (>= 0 cumple).
export function measure(world) {
  const grid = new Map(); const key = (x, y, z) => `${x},${y},${z}`
  for (const w of world.ways) w.__nodes = world.nodes
  const all = world.ways.map(sampleWay)
  for (const pts of all) for (const q of pts) {
    const k = key(Math.floor(q.p.x / CELL), Math.floor(q.p.y / CELL), Math.floor(q.p.z / CELL))
    let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(q)
  }
  const mk = () => ({ gap: Infinity, slack: Infinity, a: -1, b: -1, info: '' })
  const cross = mk(); const same = mk(); const route = mk()
  for (const pts of all) for (const q of pts) {
    const x = Math.floor(q.p.x / CELL); const y = Math.floor(q.p.y / CELL); const z = Math.floor(q.p.z / CELL)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const b = grid.get(key(x + dx, y + dy, z + dz)); if (!b) continue
      for (const o of b) {
        let tgt
        if (o.way < q.way) continue
        if (o.way === q.way) {
          // rutas distintas del mismo sentido, fuera de las uniones
          if (q.shared || o.shared || q.route === o.route || q.hubD < ROUTE_JOIN || o.hubD < ROUTE_JOIN) continue
          tgt = route
        } else {
          if (inPort(q, o)) continue // puerto común: uno de los dos puntos está en la zona de puerto de un nodo de ambos
          tgt = q.c === o.c ? same : cross
        }
        const gap = q.p.distanceTo(o.p) - (tgt === route ? q.ext + o.ext : q.r + o.r)
        const slack = gap - MIN_GAP_K * Math.max(q.tube, o.tube)
        if (slack < tgt.slack) Object.assign(tgt, { gap, slack, a: q.way, b: o.way, info: `${q.kind}/r${q.route}@${q.u.toFixed(2)} vs ${o.kind}/r${o.route}@${o.u.toFixed(2)}` })
      }
    }
  }
  // caminos contra la zona de puertos de nodos ajenos
  let node = Infinity
  for (const pts of all) for (const q of pts) {
    const w = world.ways[q.way]
    for (const n of world.nodes) if (n.idx !== w.from && n.idx !== w.to) node = Math.min(node, q.p.distanceTo(n.pos) - PORT_ZONE - q.r)
  }
  return { cross, same, route, ...measureRibbons(world), node }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] ?? 20); const s0 = +(process.argv[3] ?? 1)
  const KEYS = ['cross', 'same', 'route', 'lane', 'cintas']
  const worst = {}; const worstS = {}; for (const k of KEYS) { worst[k] = Infinity; worstS[k] = Infinity }
  let maxJoint = 0
  let bad = 0; let tot = 0; let minNode = Infinity; let maxMs = 0
  const fmt = (m) => `${m.gap.toFixed(2)} (holg ${m.slack.toFixed(2)})`
  for (let seed = s0; seed < s0 + n; seed++) {
    const t = performance.now(); const w = buildWorld(seed); const ms = performance.now() - t
    const m = measure(w); tot += ms; maxMs = Math.max(maxMs, ms)
    const ok = KEYS.every((k) => m[k].slack >= 0); maxJoint = Math.max(maxJoint, m.cintas.joint)
    if (!ok) bad++
    for (const k of Object.keys(worst)) { worst[k] = Math.min(worst[k], m[k].gap); worstS[k] = Math.min(worstS[k], m[k].slack) }
    minNode = Math.min(minNode, m.node)
    if (process.argv[5] === 'malas' && ok) continue // 5º arg: sólo semillas que incumplen
    console.log(`seed ${seed}${w.failed ? ' [FALLÓ]' : ''}: circuitos ${fmt(m.cross)} | ida/vuelta ${fmt(m.same)} | rutas ${fmt(m.route)} [${m.route.info}] | carriles ${fmt(m.lane)} [${m.lane.info}] | cintas ${fmt(m.cintas)} ${m.cintas.n} choques [${m.cintas.info}] unión ${m.cintas.joint.toFixed(1)}u | relax ${w.relax ? `${w.relax.it}it/${w.relax.left}` : "-"} | nodo ${m.node.toFixed(2)} | gen ${ms.toFixed(0)}ms`)
  }
  console.log(`PEOR (huelgo/holgura): circuitos ${worst.cross.toFixed(2)}/${worstS.cross.toFixed(2)}; ida-vuelta ${worst.same.toFixed(2)}/${worstS.same.toFixed(2)}; rutas ${worst.route.toFixed(2)}/${worstS.route.toFixed(2)}; carriles ${worst.lane.toFixed(2)}/${worstS.lane.toFixed(2)}; cintas ${worst.cintas.toFixed(2)}/${worstS.cintas.toFixed(2)} (unión máx ${maxJoint.toFixed(1)}u); nodo ajeno ${minNode.toFixed(2)}; semillas malas ${bad}/${n}; gen medio ${(tot / n).toFixed(0)}ms (máx ${maxMs.toFixed(0)})`)
}
