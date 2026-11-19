// Cuñas: muestras del TERRENO (berma) de un carril que quedan por encima del firme de OTRA cinta a menos de 0.5 u
// (se ven como cuñas del color del terreno sobre la calzada vecina, donde la fila se abre o dos tramos van fundidos).
// Reproduce el muestreo de vida/pista.jsx (paso 1.5·TK, perfil de bermaPerfil) y lo comprueba con una prueba
// independiente del recorte: punto dentro de la calzada (±CALZADA_HALF) de una muestra de clearanceSamples.
//   uso: node tools/cunas.mjs [nSemillas=3] [semilla0=369] [sin]     (sin = sin recorte: el «antes»)
import { pathToFileURL } from 'node:url'
import * as W from '../src/Core/world.js'

const { TRACK_K: TK, CALZADA_HALF: E } = W
const STEP = 1.5 * TK; const CELL = 10; const ALTO = 0.5
const key = (x, y, z) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)},${Math.floor(z / CELL)}`

export function cunas(world) {
  const S = W.clearanceSamples(world); const grid = new Map()
  for (let i = 0; i < S.X.length; i++) { const k = key(S.X[i], S.Y[i], S.Z[i]); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(i) }
  const ribDe = new Map(); for (const r of S.ribs) ribDe.set(r.seg, (ribDe.get(r.seg) || new Map()).set(r.lane, r))
  const out = { n: 0, tramo: 0, camino: 0, otro: 0, puntos: 0, peor: 0, at: '', recortadas: 0, muestras: 0 }
  const F = {}; const pf = {}; const libre = [0, 0]
  for (const way of world.ways) {
    const ix = W.bermaIndice(); const tiras = []
    for (const seg of way.segments) {
      if (seg.air || !seg.lanes) continue
      for (const lane of seg.lanes) {
        const n = Math.max(4, Math.ceil(seg.length / STEP)); const rib = tiras.length; const k0 = ix.n
        for (let i = 0; i <= n; i++) { const f = W.laneFrame(seg, lane.id, i / n, F); W.bermaAdd(ix, rib, f.surface, f.side, f.up, f.tangent, seg.length / n / 2) }
        tiras.push({ seg, lane, n, k0 })
      }
    }
    for (const t of tiras) {
      const propia = ribDe.get(t.seg)?.get(t.lane.id); const LL = new Float32Array(t.n + 1); const RR = new Float32Array(t.n + 1); W.bermaLibres(ix, t.k0, t.n, LL, RR)
      for (let i = 0; i <= t.n; i++) {
        const k = t.k0 + i; const o = k * 12; const V = ix.V
        libre[0] = LL[i]; libre[1] = RR[i]; out.muestras++
        for (let s = 0; s < 2; s++) {
          const P = W.bermaPerfil(libre[s], pf); if (P.w < W.RIBBON_TERR) out.recortadas++
          if (P.w <= 1e-6) continue
          const sg = s ? 1 : -1
          for (const [fx, y] of [[0.25, (P.yE + P.yM) / 2], [0.5, P.yM], [1, P.yO]]) {
            const x = sg * (E + P.w * fx)
            const px = V[o] + V[o + 3] * x + V[o + 6] * y; const py = V[o + 1] + V[o + 4] * x + V[o + 7] * y; const pz = V[o + 2] + V[o + 5] * x + V[o + 8] * y
            out.puntos++
            const cx = Math.floor(px / CELL); const cy = Math.floor(py / CELL); const cz = Math.floor(pz / CELL); let hit = null
            for (let dx = -1; dx <= 1 && !hit; dx++) for (let dy = -1; dy <= 1 && !hit; dy++) for (let dz = -1; dz <= 1 && !hit; dz++) {
              const b = grid.get(`${cx + dx},${cy + dy},${cz + dz}`); if (!b) continue
              for (const j of b) {
                const r = S.ribs[S.R[j]]; if (r === propia) continue
                const ex = px - S.X[j]; const ey = py - S.Y[j]; const ez = pz - S.Z[j]
                if (Math.abs(ex * S.TX[j] + ey * S.TY[j] + ez * S.TZ[j]) > r.ds / 2) continue
                if (Math.abs(ex * S.SX[j] + ey * S.SY[j] + ez * S.SZ[j]) > E - 0.1) continue
                const h = ex * S.UX[j] + ey * S.UY[j] + ez * S.UZ[j]
                if (h > 0.005 && h < ALTO) { hit = { r, h }; break }
              }
            }
            if (hit) {
              out.n++; out[hit.r.seg === t.seg ? 'tramo' : hit.r.way === way ? 'camino' : 'otro']++
              if (hit.h > out.peor) { out.peor = hit.h; out.at = `w${way.idx} ${t.seg.kind}/r${t.seg.route} L${t.lane.id}@${(i / t.n).toFixed(2)} sobre ${hit.r.seg.kind}/r${hit.r.seg.route} L${hit.r.lane}` }
            }
          }
        }
      }
    }
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] ?? 3); const s0 = +(process.argv[3] ?? 369); W.BERMA.off = process.argv[4] === 'sin'
  let tot = 0
  for (let seed = s0; seed < s0 + n; seed++) {
    const c = cunas(W.buildWorld(seed)); tot += c.n
    console.log(`seed ${seed}: cuñas ${c.n} de ${c.puntos} puntos de berma (mismo tramo ${c.tramo}, mismo camino ${c.camino}, otro camino ${c.otro}); lados recortados ${c.recortadas} de ${c.muestras * 2}; peor ${c.peor.toFixed(3)} u ${c.at}`)
  }
  console.log(`total cuñas${W.BERMA.off ? ' (SIN recorte)' : ''}: ${tot}`)
}
