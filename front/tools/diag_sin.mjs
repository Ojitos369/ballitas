// Mayor quiebro (grados entre aristas consecutivas de la trenza) en el tramo abierto (apertura 1) de los tramos sinuosos y,
// aparte, en el resto. uso: node tools/diag_sin.mjs [semilla=369]   (NO_SINUOSO=1 / NO_RELAX=1 para separar causas)
import * as W from '../src/Core/world.js'
const w = W.buildWorld(+(process.argv[2] ?? 369)); const top = { abierto: [], resto: [] }; const hist = { abierto: [0, 0, 0, 0], resto: [0, 0, 0, 0] }
for (const way of w.ways) for (const s of way.segments) { const br = s._braid; if (!br || s.air) continue
  for (const l of s.lanes) { const P = br.P[l.id]; for (let i = 1; i < br.N; i++) { const a = [P[i*3]-P[i*3-3], P[i*3+1]-P[i*3-2], P[i*3+2]-P[i*3-1]]; const b = [P[i*3+3]-P[i*3], P[i*3+4]-P[i*3+1], P[i*3+5]-P[i*3+2]]; const la = Math.hypot(...a), lb = Math.hypot(...b)
    const an = Math.acos(Math.max(-1, Math.min(1, (a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(la*lb))))*57.3; const k = br.sin && br.env[i] >= 0.999 ? 'abierto' : 'resto'
    hist[k][an < 15 ? 0 : an < 25 ? 1 : an < 40 ? 2 : 3]++
    top[k].push([+an.toFixed(1), `w${way.idx} ${s.kind} L${l.id} i${i}/${br.N} paso ${la.toFixed(1)}/${lb.toFixed(1)} giro ${(br.sroll?.[l.id]?.[i] ?? 0).toFixed(2)}`]) } } }
for (const k in top) { top[k].sort((x, y) => y[0] - x[0]); console.log(k, 'histograma [<15, 15-25, 25-40, >=40]:', hist[k].join(' '), '| peores:', top[k].slice(0, 5).map((x) => x.join('° ')).join(' ; ')) }
console.log('sinuoso', JSON.stringify(w.sinuoso || null), 'relax', JSON.stringify(w.relax))
