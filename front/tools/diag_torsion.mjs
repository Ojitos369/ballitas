// Detalle de la torsión de hélices en una semilla: por tramo y carril, nº de muestras >= 25° y en qué u; quiebro del eje.
//   uso: node tools/diag_torsion.mjs <semilla> [tipos=espiral,sacacorchos]
import { buildWorld, clearanceSamples, wallFrame } from '../src/Core/world.js'
const seed = +(process.argv[2] ?? 369); const kinds = new Set((process.argv[3] ?? 'espiral,sacacorchos').split(','))
const w = buildWorld(seed); const S = clearanceSamples(w); const DEG = 180 / Math.PI
const ang = (a, b, i) => Math.acos(Math.max(-1, Math.min(1, S[a + 'X'][i] * S[a + 'X'][i - 1] + S[a + 'Y'][i] * S[a + 'Y'][i - 1] + S[a + 'Z'][i] * S[a + 'Z'][i - 1]))) * DEG
const bySeg = new Map()
for (const r of S.ribs) if (kinds.has(r.seg.kind)) { if (!bySeg.has(r.seg)) bySeg.set(r.seg, []); bySeg.get(r.seg).push(r) }
for (const [seg, ribs] of bySeg) {
  // quiebro del eje al mismo paso
  const n = ribs[0].n; let ax = 0; let axAt = 0; let p0 = null; let t0 = null; let rmin = Infinity; let rmax = 0
  const A = wallFrame(seg, 0, 0, 0, {}).axis.clone(); const B = wallFrame(seg, 0, 1, 0, {}).axis.clone(); const c = B.clone().sub(A).normalize()
  for (let i = 0; i <= n; i++) {
    const p = wallFrame(seg, 0, i / n, 0, {}).axis.clone()
    if (p0) { const t = p.clone().sub(p0).normalize(); if (t0) { const a = Math.acos(Math.max(-1, Math.min(1, t.dot(t0)))) * DEG; if (a > ax) { ax = a; axAt = i / n } } t0 = t }
    p0 = p; const q = p.clone().sub(A); q.addScaledVector(c, -q.dot(c)); const l = q.length(); if (i > n * 0.15 && i < n * 0.85) { rmin = Math.min(rmin, l); rmax = Math.max(rmax, l) }
  }
  console.log(`w${seg.way?.idx ?? '?'} ${seg.kind}/r${seg.route} L ${seg.length.toFixed(0)} cuerda ${A.distanceTo(B).toFixed(0)} radio[0.15-0.85] ${rmin.toFixed(0)}-${rmax.toFixed(0)} eje max ${ax.toFixed(1)}° @${axAt.toFixed(2)} fan ${JSON.stringify(seg.fan || null)}`)
  for (const r of ribs) {
    let nu = 0; let mu = 0; let mt = 0; const us = []
    for (let i = r.start + 1; i <= r.start + r.n; i++) { const du = ang('U', 0, i); const dt = ang('T', 0, i); if (du >= 25 || dt >= 25) { nu++; us.push(((i - r.start) / r.n).toFixed(2)) } mu = Math.max(mu, du); mt = Math.max(mt, dt) }
    console.log(`   L${r.lane} normal ${mu.toFixed(0)}° tangente ${mt.toFixed(0)}° n>=25: ${nu} en u=${[...new Set(us)].slice(0, 14).join(',')}`)
  }
}
