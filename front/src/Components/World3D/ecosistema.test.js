import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildWorld } from '../../Core/world.js'
import { readFileSync } from 'node:fs'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { buildEcosistema, ecoGeometry, ecoTris, geoDeGltf, MODELOS_ECO, modeloListo, registrarModelo } from './ecosistema.js'

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

// Triángulos del mundo entero con la geometría que haya ahora mismo (procedural o con GLB registrados).
const mundoTris = () => {
  let total = 0; let worst = 0; let conModelo = 0
  for (const way of world.ways) {
    let t = 0
    for (const g of buildEcosistema(way, getFrames, sample)) { const n = ecoTris(g.key) * g.items.length; t += n; if (g.key.startsWith('m:')) conModelo += n }
    total += t; worst = Math.max(worst, t)
  }
  return { total, worst, conModelo }
}

test('sin GLB cargados, las claves m: caen a la forma procedural', () => {
  assert.ok(!modeloListo('saguaro_grande'))
  const antes = mundoTris()
  for (const k of ['m:saguaro_grande', 'm:volcan_erupcion', 'm:geiser:volcan', 'm:rampa_hielo:hielo', 'm:cascada_roca:bosque', 'm:puente_cristal']) {
    const g = ecoGeometry(k)
    for (const a of ['position', 'color', 'aFx', 'aCen']) assert.ok(g.attributes[a], `${k} ${a}`)
  }
  console.log(`eco (fallback procedural): ${antes.total} tris`)
  assert.ok(antes.total <= 485000)
})

test('con los 18 GLB cargados desde disco: atributos de animación, estáticos/animados y presupuesto', async () => {
  const dir = new URL('../../../public/models/', import.meta.url)
  const base = mundoTris()
  for (const n of MODELOS_ECO) {
    const b = readFileSync(new URL(n + '.glb', dir))
    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)
    const scene = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', (g) => res(g.scene), rej))
    registrarModelo(n, geoDeGltf(scene))
  }
  assert.ok(MODELOS_ECO.every(modeloListo))
  const g = ecoGeometry('m:volcan_erupcion')
  for (const a of ['position', 'color', 'aFx', 'aCen']) assert.ok(g.attributes[a], a)
  assert.equal(g.name, 'eco:m:volcan_erupcion')
  const ks = new Set(Array.from({ length: g.attributes.aFx.count }, (_, i) => g.attributes.aFx.getX(i)))
  assert.ok(ks.has(8) && ks.has(9) && ks.has(0), `volcán: lava k=8, balística k=9 y roca estática: ${[...ks]}`)
  const alga = ecoGeometry('m:alga_larga')
  assert.equal(alga.attributes.aFx.getX(0), 1) // vaivén
  const col = ecoGeometry('m:saguaro_grande').attributes.color
  let rojo = 0; for (let i = 0; i < col.count; i++) if (col.getX(i) > 0.9) rojo++
  assert.ok(rojo > 0, 'usa COLOR_1 (no el COLOR_0 en blanco)')
  const t = mundoTris()
  console.log(`eco: ${t.total} tris (procedural ${base.total}, con GLB ${t.conModelo}; peor camino ${t.worst}; 5 caminos peores ${t.worst * 5})`)
  assert.ok(t.total - base.total <= 200000, `+${t.total - base.total} sobre el procedural`)
  assert.ok(t.conModelo > 0 && t.total <= 485000, `total ${t.total}`)
})

test('las geometrías llevan los atributos de animación y nombre de rastreo', () => {
  const g = ecoGeometry('mouth:volcan')
  for (const k of ['position', 'color', 'aFx', 'aCen']) assert.ok(g.attributes[k], k)
  assert.equal(g.name, 'eco:mouth:volcan')
})
