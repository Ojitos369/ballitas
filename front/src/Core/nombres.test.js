import test from 'node:test'
import assert from 'node:assert/strict'
import { nombreUnico } from './sim.js'

test('nombreUnico: 2000 nombres sin repetir', () => {
  const usados = new Set(); let s = 1
  const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 2000; i++) nombreUnico(rng, usados)
  assert.equal(usados.size, 2000)
})
