// Detalle de la torsión en una punta de tramo: por muestra (paso del medidor) imprime el giro de la normal y de la
// tangente del carril, el giro del eje (wallFrame) y el ángulo de la fila (roll), para ver de dónde sale el quiebre.
//   uso: node tools/diag_punta.mjs <semilla> <way> <tipo> <ruta> [carril=0] [punta=1 (fin) | 0 (inicio)] [n=10]
import { buildWorld, clearanceSamples, wallFrame, laneFrame, laneAngle } from '../src/Core/world.js'
const [seed, wi, kind, route, lane = 0, end = 1, cnt = 10] = process.argv.slice(2).map((x, i) => (i === 2 ? x : +x))
const w = buildWorld(seed); const S = clearanceSamples(w); const DEG = 180 / Math.PI
const r = S.ribs.find((q) => q.way.idx === wi && q.seg.kind === kind && q.seg.route === route && q.lane === lane)
if (!r) { console.log('no hay cinta'); process.exit(1) }
const seg = r.seg; const dot = (a, i, j) => Math.acos(Math.max(-1, Math.min(1, S[a + 'X'][i] * S[a + 'X'][j] + S[a + 'Y'][i] * S[a + 'Y'][j] + S[a + 'Z'][i] * S[a + 'Z'][j]))) * DEG
console.log(`w${wi} ${kind}/r${route} L${lane} largo ${seg.length.toFixed(0)} n ${r.n} ds ${r.ds.toFixed(2)} fan ${JSON.stringify(seg.fan || null)} fila ${!!seg.fila} N braid ${seg._braid?.N}`)
const F0 = {}; const F1 = {}
for (let q = 0; q <= cnt; q++) {
  const k = end ? r.n - cnt + q : q; const i = r.start + k; const u = k / r.n
  const a = wallFrame(seg, 0, u, 0, F0); const b = k ? wallFrame(seg, 0, (k - 1) / r.n, 0, F1) : a
  const ejeT = Math.acos(Math.max(-1, Math.min(1, a.tangent.dot(b.tangent)))) * DEG; const ejeD = Math.acos(Math.max(-1, Math.min(1, a.dir.dot(b.dir)))) * DEG
  console.log(`u ${u.toFixed(4)} x ${(u * seg.length).toFixed(1)}  carril: normal ${k ? dot('U', i, i - 1).toFixed(1) : '-'}° tangente ${k ? dot('T', i, i - 1).toFixed(1) : '-'}°  eje: T ${ejeT.toFixed(1)}° D ${ejeD.toFixed(1)}°  angulo ${(laneAngle(seg, lane, u) * DEG).toFixed(1)}°  env ${seg._braid?.env ? seg._braid.env[Math.round(u * seg._braid.N)].toFixed(3) : '-'} relieve ${laneFrame(seg, lane, u, {}).relief.toFixed(2)}`)
}
