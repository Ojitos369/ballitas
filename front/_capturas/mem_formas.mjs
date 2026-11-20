// Cuenta objetos con forma de camino (routes+segments+theme) y de mundo (ways+nodes) en una instantánea.
import { readFileSync } from 'node:fs'
function nums(buf, start) { const out = []; let i = start + 1, v = 0, en = false
  for (; ; i++) { const c = buf[i]; if (c >= 48 && c <= 57) { v = v * 10 + c - 48; en = true } else { if (en) { out.push(v); v = 0; en = false } if (c === 93) break } } return { out, fin: i } }
for (const f of process.argv.slice(2)) {
  const buf = readFileSync(f)
  const head = buf.subarray(0, 4000).toString(); const mm = JSON.parse(head.slice(head.indexOf('"meta":') + 7, head.indexOf(',"node_count"')))
  const nodes = nums(buf, buf.indexOf('"nodes":[') + 8).out
  const edges = nums(buf, buf.indexOf('"edges":[') + 8).out
  const strings = JSON.parse(buf.subarray(buf.indexOf('"strings":[') + 10, buf.lastIndexOf(']') + 1).toString())
  const nf = mm.node_fields.length, ef = mm.edge_fields.length, etypes = mm.edge_types[0]
  const iE = mm.node_fields.indexOf('edge_count'), iId = mm.node_fields.indexOf('id')
  let ways = 0, worlds = 0, segs = 0; const wid = []
  for (let n = 0, e = 0; n * nf < nodes.length; n++) { const k = nodes[n * nf + iE] * ef; const p = new Set(); for (let j = e; j < e + k; j += ef) if (etypes[edges[j]] === 'property') p.add(strings[edges[j + 1]]); e += k
    if (p.has('routes') && p.has('segments') && p.has('theme')) { ways++; wid.push(nodes[n * nf + iId]) }
    if (p.has('ways') && p.has('nodes') && p.has('waysFrom')) worlds++
    if (p.has('way') && p.has('route') && p.has('curve')) segs++ }
  console.log(f.split(/[\\/]/).pop(), 'ways', ways, 'worlds', worlds, 'segs', segs)
}
