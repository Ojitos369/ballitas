// Mide el huelgo entre caminos distintos: distancia centro-a-centro menos la suma de radios
// (braidRadius: el envolvente de la trenza, que ya incluye el radio de pista).
// "Camino" = circuito (sus dos carriles, ida y vuelta, pueden compartir corredor: se reporta aparte).
// Zona de puerto: dos ways que llegan al mismo nodo se unen allí (a menos de PORT_ZONE de su centro, sin medir).
//   uso: node tools/overlap.mjs [nSemillas=20] [semilla0=1] [rutaModulo=../src/Core/world.js]
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const modPath = process.argv[4] && process.argv[4] !== '-' ?pathToFileURL(resolve(process.argv[4])).href : '../src/Core/world.js'
const W = await import(modPath)
const { buildWorld, braidRadius, NODE_R, GRID_LEN } = W
export const MIN_GAP_K = 1.5 // huelgo mínimo, en radios de pista (seg.radius mayor del par)
const PORT_ZONE = W.PORT_ZONE ?? NODE_R + GRID_LEN + 20
const CELL = 40

function sampleWay(way) {
  const out = []
  const ends = [way.from, way.to]
  for (const s of way.segments) {
    const n = Math.max(12, Math.ceil(s.length / 1.5))
    for (let k = 0; k <= n; k++) {
      const u = k / n; const p = s.curve.getPointAt(u)
      out.push({ p, r: braidRadius(s, u), tube: s.radius, way: way.idx, c: way.circuit.idx, kind: s.kind, route: s.route, u, zone: ends.find((i) => p.distanceTo(way.__nodes[i].pos) < PORT_ZONE) ?? -1 })
    }
  }
  return out
}

// Peor par entre circuitos distintos (`cross`) y entre carriles del mismo circuito (`same`).
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
  const cross = mk(); const same = mk()
  for (const pts of all) for (const q of pts) {
    const x = Math.floor(q.p.x / CELL); const y = Math.floor(q.p.y / CELL); const z = Math.floor(q.p.z / CELL)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const b = grid.get(key(x + dx, y + dy, z + dz)); if (!b) continue
      for (const o of b) {
        if (o.way <= q.way) continue
        if (q.zone >= 0 && q.zone === o.zone) continue // puerto común
        const gap = q.p.distanceTo(o.p) - q.r - o.r
        const slack = gap - MIN_GAP_K * Math.max(q.tube, o.tube)
        const tgt = q.c === o.c ? same : cross
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
  return { cross, same, node }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] ?? 20); const s0 = +(process.argv[3] ?? 1)
  let minGap = Infinity; let minSlack = Infinity; let minSame = Infinity; let bad = 0; let tot = 0; let minNode = Infinity; let maxMs = 0
  for (let seed = s0; seed < s0 + n; seed++) {
    const t = performance.now(); const w = buildWorld(seed); const ms = performance.now() - t
    const m = measure(w); tot += ms; maxMs = Math.max(maxMs, ms)
    if (m.cross.slack < 0) bad++
    minGap = Math.min(minGap, m.cross.gap); minSlack = Math.min(minSlack, m.cross.slack); minNode = Math.min(minNode, m.node); minSame = Math.min(minSame, m.same.gap)
    if (process.argv[5] === 'malas' && m.cross.slack >= 0) continue // 5º arg: sólo semillas que incumplen
    console.log(`seed ${seed}: entre circuitos ${m.cross.gap.toFixed(2)} (holgura vs ${MIN_GAP_K}r: ${m.cross.slack.toFixed(2)}) ways ${m.cross.a}-${m.cross.b} [${m.cross.info}]; mismo circuito ${m.same.gap.toFixed(2)}; nodo ajeno ${m.node.toFixed(2)}; gen ${ms.toFixed(0)}ms`)
  }
  console.log(`PEOR entre circuitos: huelgo ${minGap.toFixed(2)}, holgura ${minSlack.toFixed(2)}; mismo circuito ${minSame.toFixed(2)}; nodo ajeno ${minNode.toFixed(2)}; semillas malas ${bad}/${n}; gen medio ${(tot / n).toFixed(0)}ms (máx ${maxMs.toFixed(0)})`)
}
