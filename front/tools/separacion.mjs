// Desglose del medidor de espacio visible (world.ribbonClearance) por clase de par de cintas:
//   tramo : carriles de un mismo tramo (la trenza).
//   ruta  : tramos distintos de una misma ruta (o tramo compartido salida/llegada contra una ruta) del mismo camino.
//   rutas : rutas distintas de un mismo camino (way).
//   ways  : caminos (ways) distintos.
// Sufijo de zona: `:union` si alguna de las dos muestras está a menos de ROUTE_JOIN de una unión (fork/cross/merge) de su
// camino o de PORT_ZONE del centro de un nodo; `:libre` fuera de ellas. La meta de la pieza SEP es 0 casos en
// rutas:libre y ways:libre.
//   uso: node tools/separacion.mjs [nSemillas=10] [semilla0=369] [json]
import { pathToFileURL } from 'node:url'
import * as W from '../src/Core/world.js'

const { buildWorld, ribbonClearance, ROUTE_JOIN, PORT_ZONE, GALIBO_H, AIRE_LAT } = W

export function medir(world) {
  const S = W.clearanceSamples(world)
  const zona = (i, r) => {
    const x = S.X[i]; const y = S.Y[i]; const z = S.Z[i]
    for (const j of r.way.junctions) if ((x - j.pos.x) ** 2 + (y - j.pos.y) ** 2 + (z - j.pos.z) ** 2 < ROUTE_JOIN ** 2) return true
    for (const n of world.nodes) if ((x - n.pos.x) ** 2 + (y - n.pos.y) ** 2 + (z - n.pos.z) ** 2 < PORT_ZONE ** 2) return true
    return false
  }
  const clase = (i, j, A, B) => {
    const k = A.seg === B.seg ? 'tramo' : A.way !== B.way ? 'ways' : (A.seg.route < 0 || B.seg.route < 0 || A.seg.route === B.seg.route) ? 'ruta' : 'rutas'
    return `${k}:${zona(i, A) || zona(j, B) ? 'union' : 'libre'}`
  }
  const c = ribbonClearance(world, S, { clase })
  return { clases: c.clases || {}, total: { galibo: c.galibo, lateral: c.lateral, union: c.union }, muestras: S.X.length }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = +(process.argv[2] ?? 10); const s0 = +(process.argv[3] ?? 369)
  const KS = ['ways:libre', 'rutas:libre', 'ruta:libre', 'tramo:libre', 'ways:union', 'rutas:union', 'ruta:union', 'tramo:union']
  const ac = {}; let tot = 0; let malas = 0
  const f = (v) => (v === Infinity ? '-' : v.toFixed(1))
  console.log(`metas: altura libre >= ${GALIBO_H.toFixed(1)} u, aire lateral >= ${AIRE_LAT.toFixed(1)} u`)
  for (let seed = s0; seed < s0 + n; seed++) {
    const t = performance.now(); const w = buildWorld(seed); const ms = performance.now() - t; tot += ms
    const m = medir(w)
    const parts = []
    for (const k of KS) {
      const c = m.clases[k]; if (!c) continue
      const a = ac[k] ||= { galibo: 0, lateral: 0, union: 0, pares: 0, minH: Infinity, minD: Infinity, semillas: 0, atH: '', atD: '' }
      a.galibo += c.galibo; a.lateral += c.lateral; a.union += c.union; a.pares += c.pares.size; a.semillas++
      if (c.minH < a.minH) { a.minH = c.minH; a.atH = `s${seed} ${c.atH}` }
      if (c.minD < a.minD) { a.minD = c.minD; a.atD = `s${seed} ${c.atD}` }
      parts.push(`${k} pares ${c.pares.size} (gal ${c.galibo} minH ${f(c.minH)} | lat ${c.lateral} minD ${f(c.minD)} | uni ${c.union})`)
    }
    const mal = (m.clases['ways:libre']?.pares.size ?? 0) + (m.clases['rutas:libre']?.pares.size ?? 0)
    if (mal) malas++
    console.log(`seed ${seed}${w.failed ? ' [FALLÓ]' : ''} gen ${ms.toFixed(0)}ms meta(ways+rutas libre) ${mal} pares :: ${parts.join(' ; ')}`)
  }
  console.log('— RESUMEN —')
  for (const k of KS) { const a = ac[k]; if (a) console.log(`${k}: semillas ${a.semillas}/${n}, pares ${a.pares}, galibo ${a.galibo} (minH ${f(a.minH)} ${a.atH}), lateral ${a.lateral} (minD ${f(a.minD)} ${a.atD}), union ${a.union}`) }
  console.log(`semillas con pares de rutas/caminos distintos en falta fuera de uniones: ${malas}/${n}; gen medio ${(tot / n).toFixed(0)} ms`)
}
