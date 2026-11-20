// Rutas de retención de ejemplo por constructor: node --max-old-space-size=14000 mem_ruta.mjs snap.heapsnapshot Qt,W,Object
import { readFileSync } from 'node:fs'
function nums(buf, start) { const out = []; let i = start + 1, v = 0, en = false
  for (; ; i++) { const c = buf[i]; if (c >= 48 && c <= 57) { v = v * 10 + c - 48; en = true } else { if (en) { out.push(v); v = 0; en = false } if (c === 93) break } } return { out, fin: i } }
const [f, clases] = process.argv.slice(2)
const buf = readFileSync(f)
const head = buf.subarray(0, 4000).toString(); const mm = JSON.parse(head.slice(head.indexOf('"meta":') + 7, head.indexOf(',"node_count"'))) 
const nodes = nums(buf, buf.indexOf('"nodes":[') + 8).out
const edges = nums(buf, buf.indexOf('"edges":[') + 8).out
const strings = JSON.parse(buf.subarray(buf.indexOf('"strings":[') + 10, buf.lastIndexOf(']') + 1).toString())
const nf = mm.node_fields.length, ef = mm.edge_fields.length, types = mm.node_types[0], etypes = mm.edge_types[0]
const iT = mm.node_fields.indexOf('type'), iN = mm.node_fields.indexOf('name'), iE = mm.node_fields.indexOf('edge_count'), iS = mm.node_fields.indexOf('self_size')
const N = nodes.length / nf
const firstEdge = new Uint32Array(N + 1); for (let n = 0, e = 0; n < N; n++) { firstEdge[n] = e; e += nodes[n * nf + iE] * ef } firstEdge[N] = edges.length
const ret = new Int32Array(N).fill(-1); const retName = new Array(N)
for (let n = 0; n < N; n++) for (let e = firstEdge[n]; e < firstEdge[n + 1]; e += ef) {
  const to = edges[e + 2] / nf; const et = etypes[edges[e]]; if (et === 'weak' || et === 'shortcut') continue
  if (ret[to] === -1) { ret[to] = n; const nm = edges[e + 1]; retName[to] = (et === 'element' || et === 'hidden') ? `[${nm}]` : strings[nm] }
}
const name = (n) => types[nodes[n * nf + iT]] + ':' + String(strings[nodes[n * nf + iN]]).slice(0, 50)
for (const cl of clases.split(',')) {
  const ids = []; for (let n = 0; n < N; n++) if (types[nodes[n * nf + iT]] === 'object' && strings[nodes[n * nf + iN]] === cl) ids.push(n)
  console.log(`\n== ${cl}: ${ids.length}`)
  const props = []; const n0 = ids[ids.length - 1]; for (let e = firstEdge[n0]; e < firstEdge[n0 + 1]; e += ef) if (etypes[edges[e]] === 'property') props.push(strings[edges[e + 1]]); console.log('props:', props.slice(0, 25).join(','))
  const chains = new Map()
  for (const n of ids.filter((_, i) => i % Math.max(1, (ids.length / 2000) | 0) === 0)) {
    let c = []; let x = n; for (let k = 0; k < 9 && x >= 0; k++) { c.push(retName[x] + '<' + name(ret[x] >= 0 ? ret[x] : x)); x = ret[x] }
    const key = c.map((s) => s.replace(/\[\d+\]/g, '[i]')).join(' | '); chains.set(key, (chains.get(key) || 0) + 1)
  }
  for (const [k, v] of [...chains].sort((a, b) => b[1] - a[1]).slice(0, 4)) console.log(v, k)
}
