import test from 'node:test'
import assert from 'node:assert/strict'
import { caminoDeBoton, colorTema, COLOR_NEUTRO } from './caminoBoton.js'

const mar = { idx: 0, theme: { id: 'mar', name: 'Mar' } }
const bosque = { idx: 1, theme: { id: 'bosque', name: 'Bosque' } }
const world = { ways: [mar, bosque], nodes: [{ color: '#123456', name: 'Eco' }] }

test('en camino: color del tema actual, modo actual', () => {
  assert.deepEqual(caminoDeBoton({ phase: 'travel', way: bosque }, world), { color: colorTema('bosque'), modo: 'actual', nombre: 'Bosque' })
})
test('en planeta: decisión > automático > ruta planeada > destino > neutro', () => {
  assert.equal(caminoDeBoton({ phase: 'at', dec: { ruta: { way: 0, r: 0 } }, auto: { way: 1, r: 0 } }, world).color, colorTema('mar'))
  assert.equal(caminoDeBoton({ phase: 'at', dec: {}, auto: { way: 1, r: 0 } }, world).color, colorTema('bosque'))
  assert.equal(caminoDeBoton({ phase: 'at', plannedRoute: { way: mar } }, world).modo, 'siguiente')
  assert.equal(caminoDeBoton({ phase: 'at', nextDest: { node: 0 } }, world).color, '#123456')
  assert.deepEqual(caminoDeBoton({ phase: 'at' }, world), { color: COLOR_NEUTRO, modo: 'neutro', nombre: '' })
})
test('tolera objetos parciales', () => {
  assert.equal(caminoDeBoton(null, null).modo, 'neutro')
  assert.equal(caminoDeBoton({ phase: 'travel' }, {}).modo, 'neutro')
  assert.equal(caminoDeBoton({ phase: 'at', auto: { way: 9 } }, world).modo, 'neutro')
  assert.equal(caminoDeBoton({ phase: 'travel', way: { theme: null } }, world).color, colorTema())
})
