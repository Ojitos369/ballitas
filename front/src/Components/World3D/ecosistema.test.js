import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildWorld } from '../../Core/world.js'
import { buildEcosistema, ecoGeometry, ecoTris } from './ecosistema.js'

// Marcos mínimos sobre la curva (en Paths.jsx se usan los de buildCurveFrames).
const getFrames = (s) => s.curve
const sample = (curve, u) => {
  const T = curve.getTangentAt(Math.min(1, Math.max(0, u)))
  const up = new THREE.Vector3(0, 1, 0)
  if (Math.abs(T.y) > 0.95) up.set(1, 0, 0)
  up.addScaledVector(T, -up.dot(T)).normalize()
  return { pos: curve.getPointAt(Math.min(1, Math.max(0, u))), T, up, right: new THREE.Vector3().crossVectors(up, T).normalize() }
}

const world = buildWorld(369)

test('cada camino tiene transiciones y detalles, y la salida es determinista', () => {
  for (const way of world.ways) {
    const a = buildEcosistema(way, getFrames, sample)
    const b = buildEcosistema(way, getFrames, sample)
    assert.ok(a.some((g) => g.key.startsWith('mouth:')), `way ${way.idx} sin boca natural`)
    assert.ok(a.some((g) => g.key.startsWith('s:')), `way ${way.idx} sin detalles`)
    assert.deepEqual(a.map((g) => [g.key, g.items.map((i) => i.m.elements.map((v) => +v.toFixed(5)))]), b.map((g) => [g.key, g.items.map((i) => i.m.elements.map((v) => +v.toFixed(5)))]))
  }
})

test('presupuesto: <= 0.4M triángulos añadidos con TODO el mundo montado', () => {
  let total = 0; let worst = 0
  for (const way of world.ways) {
    let t = 0
    for (const g of buildEcosistema(way, getFrames, sample)) t += ecoTris(g.key) * g.items.length
    total += t; worst = Math.max(worst, t)
  }
  console.log(`eco: ${total} tris en ${world.ways.length} caminos (peor camino ${worst}; 5 caminos peores ${worst * 5})`)
  assert.ok(total <= 400000, `total ${total}`)
})

test('las geometrías llevan los atributos de animación y nombre de rastreo', () => {
  const g = ecoGeometry('mouth:volcan')
  for (const k of ['position', 'color', 'aFx', 'aCen']) assert.ok(g.attributes[k], k)
  assert.equal(g.name, 'eco:mouth:volcan')
})
