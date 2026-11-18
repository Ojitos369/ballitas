import { test } from 'node:test'
import assert from 'node:assert/strict'
import { angleDiff, clampYaw, decayOffset, POV_YAW_MAX, povZoomView, POV_ZOOM_EYE, raySpherePenetration } from './povLook.js'

test('angleDiff cruza ±180° sin salto', () => {
  const d = angleDiff(-Math.PI + 0.1, Math.PI - 0.1)
  assert.ok(Math.abs(d - 0.2) < 1e-9)
  assert.ok(Math.abs(angleDiff(Math.PI - 0.1, -Math.PI + 0.1) + 0.2) < 1e-9)
})

test('clampYaw limita al cono frontal', () => {
  assert.equal(clampYaw(3), POV_YAW_MAX) // hacia atrás: se queda en el borde
  assert.equal(clampYaw(-3), -POV_YAW_MAX)
  assert.ok(Math.abs(clampYaw(0.3) - 0.3) < 1e-9)
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

test('raySpherePenetration detecta una envolvente sobre el brazo de camara', () => {
  const origin = { x: 0, y: 0, z: 0 }
  const end = { x: 0, y: 0, z: 10 }
  assert.equal(raySpherePenetration(origin, end, { x: 0, y: 0, z: 5 }, 2), 2)
  assert.equal(raySpherePenetration(origin, end, { x: 3, y: 0, z: 5 }, 2), 0)
  assert.equal(raySpherePenetration(origin, end, { x: 0, y: 0, z: 12 }, 3), 0)
})

test('povZoomView: continuo, espalda a ojos a zoom óptico', () => {
  const a = povZoomView(0)
  assert.ok(a.back > 2 && a.body)
  const e = povZoomView(POV_ZOOM_EYE)
  assert.equal(e.back, 0)
  assert.ok(!e.body && e.fov > 70)
  assert.ok(povZoomView(1).fov < 30 && povZoomView(1).back === 0)
  let prev = povZoomView(0)
  for (let z = 0.01; z <= 1; z += 0.01) {
    const v = povZoomView(z)
    assert.ok(Math.abs(v.back - prev.back) < 0.1 && Math.abs(v.fov - prev.fov) < 2.5)
    prev = v
  }
})
