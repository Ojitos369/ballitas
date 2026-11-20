// Aire lateral corto entre carriles del MISMO tramo fuera de uniones (clase tramo:libre, categoría lateral):
// agrupa las muestras por tramo y dice en qué parte del recorrido caen, entre qué carriles y por qué no cuentan como
// calzada fundida (ángulo entre normales y desnivel por la normal).
//   uso: node tools/diag_lateral.mjs <semilla> [detalle=0|1]
import * as W from '../src/Core/world.js'
const seed = +(process.argv[2] ?? 369); const det = +(process.argv[3] ?? 0)
const { buildWorld, ribbonClearance, clearanceSamples, ROUTE_JOIN, PORT_ZONE, braidDelay, braidRamps } = W
const world = buildWorld(seed); const S = clearanceSamples(world)
const zona = (i, r) => {
  for (const j of r.way.junctions) if ((S.X[i] - j.pos.x) ** 2 + (S.Y[i] - j.pos.y) ** 2 + (S.Z[i] - j.pos.z) ** 2 < ROUTE_JOIN ** 2) return true
  return world.nodes.some((n) => Math.hypot(S.X[i] - n.pos.x, S.Y[i] - n.pos.y, S.Z[i] - n.pos.z) < PORT_ZONE)
}
const c = ribbonClearance(world, S, { maxList: 1e6 })
const G = new Map(); let tot = 0
for (const h of c.hits) {
  if (h.cat !== 'lateral') continue
  const A = S.ribs[S.R[h.a]]; const B = S.ribs[S.R[h.b]]
  if (A.seg !== B.seg || zona(h.a, A) || zona(h.b, B)) continue
  tot++
  const sg = A.seg; const [da, db] = braidDelay(sg); const [qa, qb] = braidRamps(sg)
  const key = `w${A.way.idx} ${sg.kind}/r${sg.route} #${A.way.segments.indexOf(sg)} L ${sg.length.toFixed(0)}${sg.fila ? ' fila' : ''} cerrado ${da.toFixed(0)}+${qa.toFixed(0)} / ${db.toFixed(0)}+${qb.toFixed(0)}`
  const g = G.get(key) || { n: 0, x: [Infinity, 0], min: Infinity, ang: [Infinity, 0], cy: [Infinity, 0], lanes: new Map(), us: [] }; G.set(key, g)
  const i = h.a; const j = h.b
  const xa = ((i - A.start) / A.n) * sg.length; const xb = ((j - B.start) / B.n) * sg.length
  const dot = S.UX[i] * S.UX[j] + S.UY[i] * S.UY[j] + S.UZ[i] * S.UZ[j]; const an = (Math.acos(Math.min(1, dot)) * 180) / Math.PI
  const cy = Math.abs((S.X[j] - S.X[i]) * S.UX[i] + (S.Y[j] - S.Y[i]) * S.UY[i] + (S.Z[j] - S.Z[i]) * S.UZ[i])
  g.n++; g.x = [Math.min(g.x[0], xa, xb), Math.max(g.x[1], xa, xb)]; if (h.d < g.min) g.min = h.d
  g.ang = [Math.min(g.ang[0], an), Math.max(g.ang[1], an)]; g.cy = [Math.min(g.cy[0], cy), Math.max(g.cy[1], cy)]
  const lk = `${A.lane}-${B.lane}`; g.lanes.set(lk, (g.lanes.get(lk) || 0) + 1)
  if (det) g.us.push(`${lk}@${xa.toFixed(0)}/${xb.toFixed(0)}:${h.d.toFixed(1)}u ${an.toFixed(1)}° ${cy.toFixed(1)}`)
}
console.log(`semilla ${seed}: tramo:libre lateral ${tot}`)
const f = (a) => a.map((x) => x.toFixed(1)).join('-')
for (const [k, g] of [...G].sort((a, b) => b[1].n - a[1].n)) {
  console.log(`${String(g.n).padStart(5)}  ${k}  x ${f(g.x)}  mín ${g.min.toFixed(2)}  normales ${f(g.ang)}°  desnivel ${f(g.cy)}  carriles ${[...g.lanes].map(([a, b]) => `${a}:${b}`).join(' ')}`)
  if (det) console.log('       ' + g.us.join(' | '))
}
