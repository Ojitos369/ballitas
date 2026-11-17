import { test } from 'node:test'
import assert from 'node:assert/strict'
import { angleDiff, clampYaw, decayOffset, POV_YAW_MAX } from './povLook.js'

test('angleDiff cruza ±180° sin salto', () => {
  const d = angleDiff(-Math.PI + 0.1, Math.PI - 0.1)
  assert.ok(Math.abs(d - 0.2) < 1e-9)
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) + 0.2) < 1e-9)
})

test('clampYaw limita al cono frontal', () => {
  assert.equal(clampYaw(3), POV_YAW_MAX) // hacia atrás: se queda en el borde
  assert.equal(clampYaw(-3), -POV_YAW_MAX)
  assert.equal(clampYaw(0.3), 0.3)
  assert.ok(Math.abs(clampYaw(Math.PI * 2 + 0.3) - 0.3) < 1e-9)
})

test('decayOffset espera 1.5 s y luego vuelve a 0', () => {
  assert.equal(decayOffset(1, 0.016, 0.5), 1)
  let v = 1
  for (let i = 0; i < 600; i++) v = decayOffset(v, 0.016, 2)
  assert.equal(v, 0)
  let c = 1
  for (let i = 0; i < 200; i++) c = decayOffset(c, 0.016, 0, true)
  assert.equal(c, 0)
})
