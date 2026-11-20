// Escalón entre dos carriles vecinos de un tramo a lo largo de su rampa de apertura: desnivel por la normal del
// carril A hasta el carril B (con y sin relieve), ángulo entre la fila (centro A -> centro B) y la lateral de A, peralte.
//   uso: node tools/diag_escalon.mjs <semilla> <way> <tramo#> <carrilA> <carrilB> <x0> <x1> [paso=6]
import * as W from '../src/Core/world.js'
const [seed, wi, si, la, lb, x0, x1, st = 6] = process.argv.slice(2).map(Number)
const world = W.buildWorld(seed); const s = world.ways[wi].segments[si]
console.log(`w${wi} ${s.kind} L ${s.length.toFixed(0)} cerrado ${W.braidDelay(s).map((x) => x.toFixed(0))} rampas ${W.braidRamps(s).map((x) => x.toFixed(0))}`)
const A = {}; const B = {}; const deg = 180 / Math.PI
for (let x = x0; x <= x1; x += st) {
  const u = x / s.length; const a = W.laneFrame(s, la, u, A); const b = W.laneFrame(s, lb, u, B)
  const d = b.surface.clone().sub(a.surface); const dr = b.axis.clone().sub(a.axis)
  const fila = Math.asin(dr.clone().normalize().dot(a.up)) * deg
  console.log(`x ${x.toFixed(0).padStart(5)} env ${W.braidEnv(s, u).toFixed(2)} centros ${dr.length().toFixed(1)}  desnivel ${d.dot(a.up).toFixed(2)} (sin relieve ${dr.dot(a.up).toFixed(2)}; relieve ${a.relief.toFixed(2)} / ${b.relief.toFixed(2)})  fila vs lateral ${fila.toFixed(1)}°  normales ${(Math.acos(Math.min(1, a.up.dot(b.up))) * deg).toFixed(1)}°  ángulo ${(a.angle * deg).toFixed(1)}° / ${(b.angle * deg).toFixed(1)}°  avance ${dr.dot(a.tangent).toFixed(2)}`)
}
