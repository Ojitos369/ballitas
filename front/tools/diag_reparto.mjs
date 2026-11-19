// Diagnóstico del reparto: cuenta por motivo los candidatos rechazados al colocar los caminos de una semilla.
//   uso: node tools/diag_reparto.mjs [semilla=369] [n=1]
import * as W from '../src/Core/world.js'
const s0 = +(process.argv[2] ?? 369); const n = +(process.argv[3] ?? 1)
W.DIAG.on = true
for (let seed = s0; seed < s0 + n; seed++) {
  W.DIAG.rechazos = {}
  const t = performance.now(); const w = W.buildWorld(seed); const ms = performance.now() - t
  console.log(`seed ${seed} ${w.failed ? '[FALLO]' : 'ok'} intento ${w.attempt} gen ${ms.toFixed(0)} ms`)
  const g = {}; for (const [k, v] of Object.entries(W.DIAG.rechazos)) { const c = k.replace(/(tubo<CLEAR):(\w+)\/(\w+)\/(\w+)/, (m, a, p, q, s) => a + ':' + (/salida|llegada/.test(p + q) ? 'con_salida_o_llegada' : 'entre_tramos') + (s === 'true' ? ':mismo_circuito' : '')).replace(/\(mejor.*/, ''); g[c] = (g[c] || 0) + v }
  for (const [k, v] of Object.entries(g).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(6)}  ${k}`)
  for (const f of (w.failLog || []).slice(0, 8)) console.log('  fallo', JSON.stringify({ attempt: f.attempt, way: f.way, minTube: f.minTube && +f.minTube.toFixed(1), minNode: f.minNode && +f.minNode.toFixed(1), minHub: f.minHub && +f.minHub.toFixed(1), minAt: f.minAt }))
}