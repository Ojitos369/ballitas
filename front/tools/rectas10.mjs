// Tramos con > 15 % en recta (curvatura < 1/400 entre muestras de 4.7 u, mismo criterio que diag_rectas.mjs) en varias
// semillas, con desglose por tipo, tiempo de generación y quiebro máximo del eje. uso: node tools/rectas10.mjs [n=10] [semilla0=369]
// (NO_ONDULA=1 da la referencia sin el eje ondulado)
import * as W from '../src/Core/world.js'
const n0 = +(process.argv[2] ?? 10); const s0 = +(process.argv[3] ?? 369); const F = {}; const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
let TR = 0; let TT = 0; let ms = 0; const by = {}
for (let seed = s0; seed < s0 + n0; seed++) {
  const t = performance.now(); const w = W.buildWorld(seed); const dt = performance.now() - t; ms += dt; let rectos = 0; let tramos = 0
  for (const way of w.ways) for (const s of way.segments) { if (s.air || !s.lanes) continue
    const n = Math.max(8, Math.ceil(s.length / 4.7)); let recta = 0; let tot = 0
    for (const l of s.lanes) { const ds = W.laneLength(s, l.id) / n; let pT = null; let ppT = null
      for (let i = 0; i <= n; i++) { const T = W.laneFrame(s, l.id, i / n, F).tangent.clone(); if (ppT) { tot++; if (ang(T, ppT) / (2 * ds) < 1 / 400) recta++ } ppT = pT; pT = T } }
    const o = by[s.kind] ||= { n: 0, rectos: 0 }; o.n++; tramos++; if (recta / tot > 0.15) { rectos++; o.rectos++ } }
  TR += rectos; TT += tramos
  console.log(`semilla ${seed}: ${rectos}/${tramos} (${(100 * rectos / tramos).toFixed(1)} %) gen ${(dt / 1000).toFixed(1)} s intento ${w.attempt}${w.failed ? ' [FALLO]' : ''}`)
}
console.log(`TOTAL ${TR}/${TT} (${(100 * TR / TT).toFixed(1)} %) generación media ${(ms / n0 / 1000).toFixed(2)} s`)
console.log(Object.entries(by).sort((a, b) => b[1].rectos - a[1].rectos).map(([k, o]) => `${k} ${o.rectos}/${o.n}`).join(' | '))
