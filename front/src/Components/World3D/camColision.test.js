import { test } from 'node:test'
import assert from 'node:assert/strict'
import { crearRejilla, construir, rayoRejilla, rayoBruto, cercanoRejilla } from './camColision.js'

// Cinta ondulada de n×m cuadros (como una pista) + una losa grande inclinada (triángulos "big").
function malla(n = 120, m = 6, w = 0.8) {
  const pos = []; const idx = []
  const P = (i, j) => [i * w, Math.sin(i * 0.15) * 3, j * w + Math.cos(i * 0.07) * 2]
  for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) pos.push(...P(i, j))
  for (let i = 0; i < n; i++) for (let j = 0; j < m; j++) {
    const a = i * (m + 1) + j; const b = a + m + 1
    idx.push(a, b, a + 1, a + 1, b, b + 1)
  }
  const base = pos.length / 3
  pos.push(-500, 40, -500, 500, 45, -500, 0, 42, 500)
  idx.push(base, base + 1, base + 2)
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) }
}

function rng(s) { return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }

test('la rejilla por partes coincide con la fuerza bruta en 400 rayos', () => {
  const { pos, idx } = malla()
  const g = crearRejilla(pos, idx)
  let pasos = 0
  while (!construir(g, 97)) pasos++
  assert.ok(pasos > 5, 'construye en varias pasadas')
  assert.ok(g.big.length >= 1, 'la losa grande va a la lista big')
  const r = rng(7)
  let impactos = 0
  for (let k = 0; k < 400; k++) {
    const o = [r() * 96, r() * 50 - 8, r() * 8 - 2]
    const d = [(r() - 0.5) * 20, (r() - 0.5) * 30, (r() - 0.5) * 20]
    const a = rayoRejilla(g, ...o, ...d, 1)
    const b = rayoBruto(g, ...o, ...d, 1)
    if (Number.isFinite(b)) impactos++
    if (Number.isFinite(b)) assert.ok(Math.abs(a - b) < 1e-6, `rayo ${k}: ${a} vs ${b}`)
    else assert.equal(a, Infinity)
  }
  assert.ok(impactos > 30, `suficientes impactos (${impactos})`)
})

test('punto más cercano: distancia a la cinta y nada fuera del radio', () => {
  const { pos, idx } = malla()
  const g = crearRejilla(pos, idx); construir(g)
  const out = [0, 0, 0]
  const x = 20; const y = Math.sin(x / 0.8 * 0.15) * 3; const z = 2 + Math.cos(x / 0.8 * 0.07) * 2
  const d = cercanoRejilla(g, x, y + 0.25, z, 0.6, out)
  assert.ok(d < 0.26 && d > 0.15, `d=${d}`)
  assert.ok(Math.abs(out[0] - x) < 0.2)
  assert.equal(cercanoRejilla(g, x, y + 5, z, 0.6, out), Infinity)
})

test('geometría sin índice y vacía', () => {
  const g = crearRejilla(new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]), null)
  construir(g)
  const t = rayoRejilla(g, 0.2, 1, 0.2, 0, -2, 0, 1)
  assert.ok(Math.abs(t - 0.5) < 1e-9)
  const v = crearRejilla(new Float32Array(0), null)
  assert.equal(construir(v), true)
  assert.equal(rayoRejilla(v, 0, 0, 0, 1, 0, 0), Infinity)
})
