import test from 'node:test'
import assert from 'node:assert/strict'
import { decodificarRapida } from './interpola.js'

test('decodifica la tupla rápida de la sección 2.3 sin alterar índices', () => {
  const r=[7,4,1.2,3.4,5.6,.7,[1,2,3],[0,0,1],[0,1,0],2,.34567,3,4,.125,.25,.5,.6,.7,.8,9.1,.9,7,1,.42,5,.75]
  const b=decodificarRapida(r)
  assert.equal(b.id,7); assert.equal(b.phase,'travel'); assert.equal(b.seg,2); assert.equal(b.segT,.34567)
  assert.equal(b.flags,7); assert.equal(b.event,1); assert.equal(b.walkI,5); assert.equal(b.walkT,.75)
})
