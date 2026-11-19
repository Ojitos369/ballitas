import { buildWorld } from '../src/Core/world.js'
const [seed] = process.argv.slice(2)
globalThis.__RELAX_DBG = []
const w = buildWorld(+seed)
const d = globalThis.__RELAX_DBG.filter((x) => x.it === 0).at(-1); const S = d.S; const cnt = new Map()
const tag = (i) => { const r = S.ribs[S.R[i]]; return `w${r.way.idx} ${r.seg.kind}/r${r.seg.route}` }
const tagu = (i) => { const r = S.ribs[S.R[i]]; return `L${r.lane}@${((i - r.start) / r.n).toFixed(2)}` }
for (let q = 0; q < d.hits.length; q += 3) { const k = `${tag(d.hits[q])} x ${tag(d.hits[q + 1])}`; const e = cnt.get(k) || { n: 0, min: 99, ej: '' }; e.n++; if (d.hits[q + 2] < e.min) { e.min = d.hits[q + 2]; e.ej = `${tagu(d.hits[q])} vs ${tagu(d.hits[q + 1])}` } cnt.set(k, e) }
console.log(`seed ${seed}: choques iniciales ${d.left}; relax ${JSON.stringify(w.relax)}`)
for (const [k, e] of [...cnt].sort((a, b) => b[1].n - a[1].n).slice(0, 14)) console.log(`  ${e.n} ${k} min ${e.min.toFixed(1)} (${e.ej})`)
