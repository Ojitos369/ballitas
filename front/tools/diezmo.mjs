// Triángulos de la cinta de pista con y sin el diezmado en recta de vida/pista.jsx (misma regla: hasta DIEZMO − 1
// muestras saltadas si tangente y normal giran < 1.5°, berma entera y cuerda < 0.08 u). 24 triángulos por paso.
//   uso: node tools/diezmo.mjs [nSemillas=1] [semilla0=369]
import * as THREE from 'three'
import * as W from '../src/Core/world.js'

const TK = W.TRACK_K; const STEP = 1.5 * TK; const TERR = W.RIBBON_TERR; const DIEZMO = 3; const COS = Math.cos(1.5 * Math.PI / 180)
const n0 = +(process.argv[2] ?? 1); const s0 = +(process.argv[3] ?? 369)
for (let seed = s0; seed < s0 + n0; seed++) {
  const world = W.buildWorld(seed); let antes = 0; let despues = 0; let largo = 0
  for (const way of world.ways) {
    const ix = W.bermaIndice(); const tiras = []; const F = {}
    for (const seg of way.segments) {
      if (seg.air || !seg.lanes) continue
      for (const lane of seg.lanes) {
        const n = Math.max(4, Math.ceil(seg.length / STEP)); const t = { n, k0: ix.n, P: [], T: [], U: [] }
        for (let i = 0; i <= n; i++) { const f = W.laneFrame(seg, lane.id, i / n, F); t.P.push(f.surface.clone()); t.T.push(f.tangent.clone()); t.U.push(f.up.clone()); W.bermaAdd(ix, tiras.length, f.surface, f.side, f.up, f.tangent, seg.length / n / 2) }
        tiras.push(t); largo += seg.length
      }
    }
    const ab = new THREE.Vector3(); const am = new THREE.Vector3()
    for (const t of tiras) {
      const { n } = t; const L = new Float32Array(n + 1); const R = new Float32Array(n + 1); W.bermaLibres(ix, t.k0, n, L, R)
      const llena = (i) => L[i] >= 2 * TERR && R[i] >= 2 * TERR
      const cuerda = (a, c) => { ab.subVectors(t.P[c], t.P[a]); const l2 = ab.lengthSq() || 1; for (let m = a + 1; m < c; m++) { am.subVectors(t.P[m], t.P[a]); if (am.addScaledVector(ab, -am.dot(ab) / l2).lengthSq() > 0.0064) return false } return true }
      let pasos = 0
      for (let a = 0; a < n;) { let b = a + 1; while (b < n && b - a < DIEZMO && llena(a) && llena(b) && llena(b + 1) && t.T[b + 1].dot(t.T[a]) > COS && t.U[b + 1].dot(t.U[a]) > COS && cuerda(a, b + 1)) b++; pasos++; a = b }
      antes += n; despues += pasos
    }
  }
  console.log(`seed ${seed}: cinta ${(largo / 1000).toFixed(1)} mil u de carril; triángulos sin diezmar ${antes * 24}, diezmados ${despues * 24} (${((despues / antes - 1) * 100).toFixed(1)} %)`)
}
