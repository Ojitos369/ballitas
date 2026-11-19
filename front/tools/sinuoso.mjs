// Medidor de la pieza SINUOSO (marco local de cada cinta: laneFrame con su tangente, lateral y normal reales).
//   sep     : distancia (u) entre caminos de un MISMO tramo en el tramo abierto (apertura de la trenza >= 0.999), a igual u:
//             mediana del vecino más cercano y mediana de todos los pares.
//   recta   : fracción de la longitud de cada tramo (media de sus caminos) con curvatura < K_RECTA (radio > 400 u). Cuenta
//             los tramos con más de 15 % en recta.
//   normal  : giro acumulado de la normal de la calzada (grados) por cada 300 u de recorrido (media ponderada por largo).
//   torsion : máximo giro de la normal y de la tangente entre muestras consecutivas (paso ~4.7 u).
//   eventos : cambios de camino cuya trayectoria (switchPath, 24 muestras) pasa a menos de EV_CLEAR de una cinta ajena.
//   uso: node tools/sinuoso.mjs [nSemillas=10] [semilla0=369]     (NO_SINUOSO=1 mide el «antes» en la misma tanda)
import * as W from '../src/Core/world.js'

const { buildWorld, laneFrame, laneLength, switchPath, RIBBON_HALF } = W
const DEG = 180 / Math.PI; const K_RECTA = 1 / 400; const STEP = 4.7; const EV_CLEAR = RIBBON_HALF + 1
const med = (a) => { if (!a.length) return 0; const b = Float64Array.from(a).sort(); return b[b.length >> 1] }
const ang = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.dot(b))))

export function medir(world) {
  const o = { nn: [], pares: [], tramos: 0, rectos: 0, peorRecta: 0, atRecta: '', giro: 0, largo: 0, maxUp: 0, maxTan: 0, atUp: '', ev: 0, evMal: 0, evVia: {}, evDur: [], evDist: [], rectaTot: 0 }
  const F = {}; const pts = []; const cell = 24; const grid = new Map()
  const key = (x, y, z) => ((Math.floor(x / cell) + 512) * 1024 + (Math.floor(y / cell) + 512)) * 1024 + (Math.floor(z / cell) + 512)
  const segs = world.ways.flatMap((w) => w.segments.filter((s) => !s.air && s.lanes).map((s) => [w, s]))
  let si = 0
  for (const [way, seg] of segs) {
    si++
    const n = Math.max(8, Math.ceil(seg.length / STEP)); const env = seg._braid.env; const eN = env.length - 1
    const P = seg.lanes.map(() => []); let recta = 0; let tot = 0
    for (const l of seg.lanes) {
      const L = laneLength(seg, l.id); const ds = L / n; let pT = null; let ppT = null; let pU = null
      for (let i = 0; i <= n; i++) {
        const f = laneFrame(seg, l.id, i / n, F); const p = f.surface.clone(); P[l.id].push(p)
        const k = key(p.x, p.y, p.z); let b = grid.get(k); if (!b) grid.set(k, b = []); b.push(pts.length); pts.push([p, si * 8 + l.id])
        const T = f.tangent.clone(); const U = f.up.clone()
        if (pU) {
          const du = ang(U, pU) * DEG; const dt = ang(T, pT) * DEG; o.giro += du; o.largo += ds
          if (du > o.maxUp) { o.maxUp = du; o.atUp = `w${way.idx} ${seg.kind}/r${seg.route} L${l.id}@${(i / n).toFixed(2)}` }
          if (dt > o.maxTan) o.maxTan = dt
        }
        if (ppT) { tot++; if (ang(T, ppT) / (2 * ds) < K_RECTA) recta++ }
        ppT = pT; pT = T; pU = U
      }
    }
    o.tramos++; const fr = tot ? recta / tot : 0; o.rectaTot += fr
    if (fr > 0.15) o.rectos++
    if (fr > o.peorRecta) { o.peorRecta = fr; o.atRecta = `w${way.idx} ${seg.kind}/r${seg.route} L=${seg.length.toFixed(0)}` }
    const nl = seg.lanes.length
    for (let i = 0; i <= n; i += 2) {
      if (env[Math.round((i / n) * eN)] < 0.999) continue
      for (let a = 0; a < nl; a++) {
        let m = Infinity
        for (let b = 0; b < nl; b++) { if (a === b) continue; const d = P[a][i].distanceTo(P[b][i]); if (d < m) m = d; if (b > a) o.pares.push(d) }
        o.nn.push(m)
      }
    }
  }
  // eventos: trayectoria contra las cintas ajenas (las de origen y destino se excluyen)
  const out = {}; si = 0
  for (const [, seg] of segs) {
    si++
    for (const sw of seg.switches || []) {
      o.ev++; o.evVia[sw.via] = (o.evVia[sw.via] || 0) + 1; o.evDur.push(sw.duration)
      let mal = false; let prev = null; let len = 0
      for (let q = 0; q <= 24 && !mal; q++) {
        const t = q / 24; const r = switchPath(seg, sw, t, out); if (prev) len += r.pos.distanceTo(prev); prev = r.pos.clone()
        if (sw.via === 'portal' && r.vis < 1) continue
        const p = r.pos; const cx = Math.floor(p.x / cell); const cy = Math.floor(p.y / cell); const cz = Math.floor(p.z / cell)
        for (let dx = -1; dx <= 1 && !mal; dx++) for (let dy = -1; dy <= 1 && !mal; dy++) for (let dz = -1; dz <= 1 && !mal; dz++) {
          const b = grid.get(((cx + dx + 512) * 1024 + (cy + dy + 512)) * 1024 + (cz + dz + 512)); if (!b) continue
          for (const j of b) { const [pp, own] = pts[j]; if (own === si * 8 + sw.from || own === si * 8 + sw.to) continue; if (pp.distanceTo(p) < EV_CLEAR) { mal = true; break } }
        }
      }
      if (sw.via !== 'portal') o.evDist.push(len)
      if (mal) { o.evMal++; if (seg._braid.sin) o.evMalSin = (o.evMalSin || 0) + 1 }
    }
  }
  return o
}

const n = +(process.argv[2] ?? 10); const s0 = +(process.argv[3] ?? 369)
const A = { nn: [], pares: [], tramos: 0, rectos: 0, peor: 0, at: '', giro: 0, largo: 0, maxUp: 0, atUp: '', maxTan: 0, ev: 0, evMal: 0, via: {}, dur: [], dist: [], ms: 0, rectaTot: 0 }
for (let seed = s0; seed < s0 + n; seed++) {
  const t = performance.now(); const w = buildWorld(seed); const ms = performance.now() - t; A.ms += ms
  const m = medir(w)
  for (const v of m.nn) A.nn.push(v); for (const v of m.pares) A.pares.push(v)
  A.tramos += m.tramos; A.rectos += m.rectos; A.giro += m.giro; A.largo += m.largo; A.ev += m.ev; A.evMal += m.evMal; A.rectaTot += m.rectaTot
  if (m.peorRecta > A.peor) { A.peor = m.peorRecta; A.at = `s${seed} ${m.atRecta}` }
  if (m.maxUp > A.maxUp) { A.maxUp = m.maxUp; A.atUp = `s${seed} ${m.atUp}` }
  A.maxTan = Math.max(A.maxTan, m.maxTan)
  for (const k in m.evVia) A.via[k] = (A.via[k] || 0) + m.evVia[k]
  for (const v of m.evDur) A.dur.push(v); for (const v of m.evDist) A.dist.push(v)
  console.log(`seed ${seed}${w.failed ? ' [FALLÓ]' : ''} gen ${ms.toFixed(0)} ms | sep vecino ${med(m.nn).toFixed(1)} pares ${med(m.pares).toFixed(1)} | rectos ${m.rectos}/${m.tramos} | normal ${(m.giro / m.largo * 300).toFixed(0)}°/300u | torsión máx ${m.maxUp.toFixed(1)}° | eventos mal ${m.evMal}/${m.ev} (en sinuosos ${m.evMalSin || 0}) tan máx ${m.maxTan.toFixed(0)}°${w.sinuoso ? ` | sinuoso ${JSON.stringify(w.sinuoso)}` : ''}`)
}
console.log('— RESUMEN —')
console.log(`separación en tramo abierto: mediana vecino ${med(A.nn).toFixed(1)} u, mediana pares ${med(A.pares).toFixed(1)} u (muestras ${A.nn.length})`)
console.log(`tramos con > 15 % en recta (k < 1/400): ${A.rectos}/${A.tramos}; recta media ${(A.rectaTot / A.tramos * 100).toFixed(1)} %; peor ${(A.peor * 100).toFixed(0)} % (${A.at})`)
console.log(`giro de la normal: ${(A.giro / A.largo * 300).toFixed(1)}° por 300 u; torsión máx normal ${A.maxUp.toFixed(1)}° (${A.atUp}), tangente ${A.maxTan.toFixed(1)}°`)
console.log(`eventos: ${A.ev}, trayectoria inválida ${A.evMal} (${(100 * A.evMal / Math.max(1, A.ev)).toFixed(2)} %), vías ${JSON.stringify(A.via)}, duración mediana ${med(A.dur).toFixed(2)} s (máx ${Math.max(...A.dur).toFixed(2)}), vuelo mediano ${med(A.dist).toFixed(0)} u (máx ${Math.max(0, ...A.dist).toFixed(0)})`)
console.log(`generación media ${(A.ms / n).toFixed(0)} ms`)
