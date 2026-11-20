// Atribuye tamaño propio a la WeakMap/Map (y propiedad del valor) por la que pasa la primera ruta de retención.
// uso: node --max-old-space-size=14000 mem_tablas.mjs snap.heapsnapshot
import { readFileSync } from 'node:fs'
function nums(buf, start) { const out = []; let i = start + 1, v = 0, en = false
  for (; ; i++) { const c = buf[i]; if (c >= 48 && c <= 57) { v = v * 10 + c - 48; en = true } else { if (en) { out.push(v); v = 0; en = false } if (c === 93) break } } return { out, fin: i } }
const [f] = process.argv.slice(2)
const buf = readFileSync(f)
const head = buf.subarray(0, 4000).toString(); const mm = JSON.parse(head.slice(head.indexOf('"meta":') + 7, head.indexOf(',"node_count"')))
const nodes = nums(buf, buf.indexOf('"nodes":[') + 8).out
const edges = nums(buf, buf.indexOf('"edges":[') + 8).out
const strings = JSON.parse(buf.subarray(buf.indexOf('"strings":[') + 10, buf.lastIndexOf(']') + 1).toString())
const nf = mm.node_fields.length, ef = mm.edge_fields.length, types = mm.node_types[0], etypes = mm.edge_types[0]
const iE = mm.node_fields.indexOf('edge_count'), iS = mm.node_fields.indexOf('self_size'), iN = mm.node_fields.indexOf('name')
const N = nodes.length / nf
const ret = new Int32Array(N).fill(-1); const retE = new Int32Array(N).fill(-1)
for (let n = 0, e = 0; n < N; n++) { const k = nodes[n * nf + iE] * ef; for (let j = e; j < e + k; j += ef) { const et = etypes[edges[j]]; if (et === 'weak' || et === 'shortcut') continue; const to = edges[j + 2] / nf; if (ret[to] === -1 && to !== n) { ret[to] = n; retE[to] = j } } e += k }
const attr = new Array(N); const ST = 0
const label = (n) => { const j = retE[n]; if (j < 0) return null; const et = etypes[edges[j]]; if (et === 'internal' || et === 'hidden') { const s = strings[edges[j + 1]]; if (typeof s === 'string' && s.includes('pair in WeakMap')) return 'WM ' + s.replace(/.*\(table @/, '@').replace(/\)$/, '') } return null }
for (let n = 0; n < N; n++) {
  if (attr[n] !== undefined) continue
  const pila = []; let x = n; let a = null
  while (x >= 0 && attr[x] === undefined && pila.length < 200) { pila.push(x); const l = label(x); if (l) { const nm = []; for (let j = 0; j < pila.length - 1; j++) {} a = l; break } x = ret[x] }
  if (a === null) a = x >= 0 && attr[x] !== undefined ? attr[x] : '-'
  // etiqueta con la propiedad del valor justo debajo de la tabla
  for (let i = pila.length - 1; i >= 0; i--) { const y = pila[i]; if (a !== '-' && a.startsWith('WM') && i === pila.length - 1) { attr[y] = a; continue } if (a !== '-' && a.startsWith('WM') && a.split(' ').length === 2) { const j = retE[y]; const p = etypes[edges[j]] === 'property' ? strings[edges[j + 1]] : '' ; attr[y] = a + ' ' + p; a = attr[y]; continue } attr[y] = a }
}
const tot = new Map(); for (let n = 0; n < N; n++) { const k = attr[n]; tot.set(k, (tot.get(k) || 0) + nodes[n * nf + iS]) }
const byTable = new Map(); for (const [k, v] of tot) { const t = k.split(' ').slice(0, 2).join(' '); byTable.set(t, (byTable.get(t) || 0) + v) }
console.log('--- por tabla'); for (const [k, v] of [...byTable].sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log((v / 1048576).toFixed(1).padStart(8), k)
console.log('--- por tabla+propiedad'); for (const [k, v] of [...tot].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log((v / 1048576).toFixed(1).padStart(8), k)
