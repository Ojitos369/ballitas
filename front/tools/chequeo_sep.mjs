// Chequeo rápido de la pieza SEP: lo mismo que afirma layout.test.js (huelgos, envolvente visual, cintas, zona de unión)
// por semilla, sin pasar por toda la batería.  uso: node tools/chequeo_sep.mjs 1,369,27 [clases]
import { buildWorld, ribbonHits, RIBBON_CLEAR, JOINT_MAX } from '../src/Core/world.js'
import { measure } from './overlap.mjs'
import { medir } from './separacion.mjs'

const seeds = (process.argv[2] ?? '1,369').split(',').map(Number)
for (const seed of seeds) {
  const t = performance.now(); const w = buildWorld(seed); const ms = performance.now() - t
  const m = measure(w); const out = []
  for (const k of ['cross', 'same', 'route', 'lane']) if (m[k].slack < 0) out.push(`${k} holgura ${m[k].slack.toFixed(2)} [${m[k].info}]`)
  if (m.visual.slack < 0) out.push(`visual faltan ${(-m.visual.slack).toFixed(2)} [${m.visual.info}]`)
  const { hits, joint, jointBy, S } = ribbonHits(w)
  const tag = (i) => { const r = S.ribs[S.R[i]]; return `w${r.way.idx} ${r.seg.kind} L${r.lane}@${((i - r.start) / r.n).toFixed(2)}` }
  if (hits.length) out.push(`${hits.length / 3} choques p.ej. ${tag(hits[0])} vs ${tag(hits[1])} a ${hits[2].toFixed(2)} < ${RIBBON_CLEAR.toFixed(2)}`)
  if (!(joint > 0 && joint <= JOINT_MAX + 1e-6)) out.push(`union ${joint.toFixed(1)} > ${JOINT_MAX.toFixed(1)}`)
  console.log(`seed ${seed}${w.failed ? ' [FALLÓ]' : ''} gen ${ms.toFixed(0)}ms union ${JSON.stringify(Object.fromEntries(Object.entries(jointBy).map(([k, v]) => [k, +v.toFixed(1)])))} :: ${out.length ? out.join(' | ') : 'OK'}`)
  if (process.argv[3] === 'clases') {
    const c = medir(w).clases
    for (const k of Object.keys(c).sort()) console.log(`   ${k}: pares ${c[k].pares.size} gal ${c[k].galibo} (minH ${c[k].minH.toFixed(1)} ${c[k].atH}) lat ${c[k].lateral} (minD ${c[k].minD.toFixed(1)} ${c[k].atD}) uni ${c[k].union} (${c[k].atU})`)
  }
}
