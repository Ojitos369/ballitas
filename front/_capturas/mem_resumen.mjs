// Resume una instantánea de montón por constructor (lector por bytes: admite archivos > 512 MB).
// uso: node --max-old-space-size=12000 mem_resumen.mjs a.heapsnapshot b.heapsnapshot [filtro]
import { readFileSync } from 'node:fs'
function nums(buf, start) { // lee un arreglo JSON de enteros desde '[' en start
  const out = []; let i = start + 1, v = 0, en = false
  for (; ; i++) { const c = buf[i]; if (c >= 48 && c <= 57) { v = v * 10 + c - 48; en = true } else { if (en) { out.push(v); v = 0; en = false } if (c === 93) break } }
  return { out, fin: i }
}
function resumen(f) {
  const buf = readFileSync(f)
  const iNodes = buf.indexOf('"nodes":['); const meta = JSON.parse(buf.subarray(buf.indexOf('{', 1), iNodes).toString().replace(/,\s*$/, '').replace(/^\{"snapshot":/, '').trim().replace(/^"snapshot":/, ''))
  const mm = (meta.snapshot || meta).meta
  const { out: nodes } = nums(buf, iNodes + 8)
  const iStr = buf.indexOf('"strings":['); let fin = buf.lastIndexOf(']')
  const strings = JSON.parse(buf.subarray(iStr + 10, fin + 1).toString())
  const nf = mm.node_fields.length; const types = mm.node_types[0]
  const iT = mm.node_fields.indexOf('type'), iN = mm.node_fields.indexOf('name'), iS = mm.node_fields.indexOf('self_size')
  const agg = new Map()
  for (let i = 0; i < nodes.length; i += nf) {
    const t = types[nodes[i + iT]]; let n = strings[nodes[i + iN]]
    if (t === 'string' || t === 'concatenated string' || t === 'sliced string') n = '(string)'
    else if (t === 'code') n = '(code)'
    else if (t === 'closure') n = '(closure) ' + n.slice(0, 40)
    else n = t + ':' + n.slice(0, 70)
    const a = agg.get(n) || { c: 0, s: 0 }; a.c++; a.s += nodes[i + iS]; agg.set(n, a)
  }
  return agg
}
const [fa, fb] = process.argv.slice(2)
const A = resumen(fa); const B = resumen(fb)
const filas = [...B].map(([k, b]) => { const a = A.get(k) || { c: 0, s: 0 }; return { k, dc: b.c - a.c, ds: b.s - a.s, c: b.c, s: b.s } })
filas.sort((x, y) => y.ds - x.ds)
for (const r of filas.slice(0, 50)) console.log((r.ds / 1048576).toFixed(2).padStart(8), 'MB', String(r.dc).padStart(9), 'obj', String(r.c).padStart(9), r.k)
