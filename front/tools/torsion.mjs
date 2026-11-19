// Torsión de las cintas: ángulo máximo (grados) entre muestras consecutivas (paso CLR_STEP, ~4.7 u) de la NORMAL de la
// cinta (giro: cinta retorcida) y de su TANGENTE (quiebro: cinta plegada o rota), por tipo de tramo. Una cinta puede
// respetar el aire y estar retorcida: esto lo mide. Meta en hélices (espiral, sacacorchos): normal < 25°.
//   uso: node tools/torsion.mjs [nSemillas=10] [semilla0=369] [detalle]
import { pathToFileURL } from 'node:url'
import { buildWorld, clearanceSamples } from '../src/Core/world.js'

const DEG = 180 / Math.PI
const PUNTA = 15 // (u) las puntas del tramo (enlace con el vecino, calzada única) se cuentan aparte: clave '<tipo>:punta'
export function torsion(world, S = clearanceSamples(world)) {
  const out = {}
  for (const r of S.ribs) {
    const k0 = r.seg.kind; const pn = Math.ceil(PUNTA / r.ds); for (let i = r.start + 1; i <= r.start + r.n; i++) { const q = i - r.start; const k = q <= pn || q > r.n - pn ? k0 + ':punta' : k0; const o = out[k] ||= { up: 0, tan: 0, atUp: '', atTan: '', n25: 0, cintas: 0 }
    o.cintas++
      const du = Math.acos(Math.max(-1, Math.min(1, S.UX[i] * S.UX[i - 1] + S.UY[i] * S.UY[i - 1] + S.UZ[i] * S.UZ[i - 1]))) * DEG
      const dt = Math.acos(Math.max(-1, Math.min(1, S.TX[i] * S.TX[i - 1] + S.TY[i] * S.TY[i - 1] + S.TZ[i] * S.TZ[i - 1]))) * DEG
      const at = `w${r.way.idx} ${k0}/r${r.seg.route} L${r.lane}@${((i - r.start) / r.n).toFixed(2)}`
      if (du >= 25 || dt >= 25) o.n25++
      if (du > o.up) { o.up = du; o.atUp = at }
      if (dt > o.tan) { o.tan = dt; o.atTan = at }
    }
  }
  return out
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] ?? 10); const s0 = +(process.argv[3] ?? 369); const ac = {}
  for (let seed = s0; seed < s0 + n; seed++) {
    const t = torsion(buildWorld(seed))
    for (const k in t) {
      const a = ac[k] ||= { up: 0, tan: 0, atUp: '', atTan: '', n25: 0, cintas: 0 }
      a.n25 += t[k].n25; a.cintas += t[k].cintas
      if (t[k].up > a.up) { a.up = t[k].up; a.atUp = `s${seed} ${t[k].atUp}` }
      if (t[k].tan > a.tan) { a.tan = t[k].tan; a.atTan = `s${seed} ${t[k].atTan}` }
    }
    if (process.argv[4]) console.log(`seed ${seed}: ` + ['espiral', 'sacacorchos'].map((k) => t[k] ? `${k} normal ${t[k].up.toFixed(1)}° tangente ${t[k].tan.toFixed(1)}° (>=25°: ${t[k].n25})` : '').join(' ; '))
  }
  for (const k of Object.keys(ac).sort()) console.log(`${k.padEnd(16)} cintas ${String(ac[k].cintas).padStart(4)}  normal max ${ac[k].up.toFixed(1)}° (${ac[k].atUp})  tangente max ${ac[k].tan.toFixed(1)}° (${ac[k].atTan})  muestras >=25°: ${ac[k].n25}`)
}
