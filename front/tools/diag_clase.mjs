// Detalle de una clase del medidor de separación: agrupa los casos por par de tramos y dice dónde caen.
//   uso: node tools/diag_clase.mjs <semilla> <clase=ways:union> [cat=galibo|lateral]
import * as W from '../src/Core/world.js'
const seed = +(process.argv[2] ?? 369); const want = process.argv[3] ?? 'ways:union'; const cat = process.argv[4] ?? 'galibo'
const { buildWorld, ribbonClearance, clearanceSamples, ROUTE_JOIN, PORT_ZONE } = W
const world = buildWorld(seed); const S = clearanceSamples(world)
const nodo = (i) => { let m = Infinity; let id = -1; world.nodes.forEach((n, k) => { const d = Math.hypot(S.X[i] - n.pos.x, S.Y[i] - n.pos.y, S.Z[i] - n.pos.z); if (d < m) { m = d; id = k } }); return [m, id] }
const zona = (i, r) => {
  for (const j of r.way.junctions) if ((S.X[i] - j.pos.x) ** 2 + (S.Y[i] - j.pos.y) ** 2 + (S.Z[i] - j.pos.z) ** 2 < ROUTE_JOIN ** 2) return true
  return nodo(i)[0] < PORT_ZONE
}
const G = new Map()
const clase = (i, j, A, B) => {
  const k = A.seg === B.seg ? 'tramo' : A.way !== B.way ? 'ways' : (A.seg.route < 0 || B.seg.route < 0 || A.seg.route === B.seg.route) ? 'ruta' : 'rutas'
  const c = `${k}:${zona(i, A) || zona(j, B) ? 'union' : 'libre'}`
  if (c === want) G._last = [i, j, A, B]
  return c
}
// ribbonClearance llama a clase() una vez por caso anotado; se recuenta aquí por par de tramos
const c = ribbonClearance(world, S, { clase: (i, j, A, B) => { const k = clase(i, j, A, B); if (k === want) { const key = `w${A.way.idx} ${A.seg.kind}/r${A.seg.route} #${A.way.segments.indexOf(A.seg)}  x  w${B.way.idx} ${B.seg.kind}/r${B.seg.route} #${B.way.segments.indexOf(B.seg)}`; const g = G.get(key) || { n: 0, ua: [1, 0], ub: [1, 0], nd: Infinity, nid: -1, lanes: new Set(), dn: [Infinity, 0] }; G.set(key, g); g.n++; const ua = (i - A.start) / A.n; const ub = (j - B.start) / B.n; g.ua = [Math.min(g.ua[0], ua), Math.max(g.ua[1], ua)]; g.ub = [Math.min(g.ub[0], ub), Math.max(g.ub[1], ub)]; const [d, id] = nodo(i); if (d < g.nd) { g.nd = d; g.nid = id } g.dn = [Math.min(g.dn[0], d), Math.max(g.dn[1], d)]; g.lanes.add(`${A.lane}-${B.lane}`); g.LA = A.seg.length; g.LB = B.seg.length } return k } })
const cl = c.clases[want]
console.log(`${want}: galibo ${cl?.galibo} (minH ${cl?.minH?.toFixed(1)} ${cl?.atH}) lateral ${cl?.lateral} (minD ${cl?.minD?.toFixed(1)} ${cl?.atD}) union ${cl?.union}; PORT_ZONE ${PORT_ZONE.toFixed(0)} ROUTE_JOIN ${ROUTE_JOIN.toFixed(0)}`)
void cat
for (const [k, g] of [...G].sort((a, b) => b[1].n - a[1].n).slice(0, 25)) console.log(`${String(g.n).padStart(5)}  ${k}  uA ${g.ua.map((x) => x.toFixed(2)).join('-')} (L ${g.LA.toFixed(0)}) uB ${g.ub.map((x) => x.toFixed(2)).join('-')} (L ${g.LB.toFixed(0)}) nodo ${g.nid} d ${g.dn.map((x) => x.toFixed(0)).join('-')} carriles ${g.lanes.size}`)
