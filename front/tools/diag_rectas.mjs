// Desglose de los tramos con > 15 % en recta (k < 1/400) por tipo y estado (sinuoso / fila / corto). uso: node tools/diag_rectas.mjs [semilla]
import * as W from '../src/Core/world.js'
const w = W.buildWorld(+(process.argv[2] ?? 369)); const F = {}; const by = {}; const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b))))
for (const way of w.ways) for (const s of way.segments) { if (s.air || !s.lanes) continue
  const n = Math.max(8, Math.ceil(s.length / 4.7)); let recta = 0; let tot = 0; let rAb = 0; let tAb = 0; const env = s._braid.env; const eN = env.length - 1
  for (const l of s.lanes) { const ds = W.laneLength(s, l.id) / n; let pT = null; let ppT = null
    for (let i = 0; i <= n; i++) { const T = W.laneFrame(s, l.id, i / n, F).tangent.clone(); if (ppT) { const r = ang(T, ppT) / (2 * ds) < 1 / 400; const ab = env[Math.round((i / n) * eN)] >= 0.999; tot++; if (r) recta++; if (ab) { tAb++; if (r) rAb++ } } ppT = pT; pT = T } }
  const [da, db] = W.braidDelay(s); const [qa, qb] = W.braidRamps(s); const Lu = s.length - da - db - qa - qb
  const k = `${s.kind}|${s._braid.sin ? 'sinuoso' : s._braid.fila ? 'fila' : Lu < 260 ? 'corto' : 'revertido'}`; const o = by[k] ||= { n: 0, rectos: 0, fr: 0, frAb: 0, L: 0, Lu: 0 }
  o.n++; o.fr += recta / tot; o.frAb += tAb ? rAb / tAb : 0; o.L += s.length; o.Lu += Lu; if (recta / tot > 0.15) o.rectos++ }
for (const [k, o] of Object.entries(by).sort((a, b) => b[1].rectos - a[1].rectos)) console.log(k.padEnd(26), `tramos ${o.n} rectos ${o.rectos} recta media ${(100 * o.fr / o.n).toFixed(0)} % (abierto ${(100 * o.frAb / o.n).toFixed(0)} %) largo medio ${(o.L / o.n).toFixed(0)} abierto ${(o.Lu / o.n).toFixed(0)}`)
