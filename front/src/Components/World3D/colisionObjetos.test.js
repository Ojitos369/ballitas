import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildWorld, mulberry32 } from '../../Core/world.js'
import { buildEcosistema } from './ecosistema.js'
import { colisionDe, colocar, ESTADO, registrarMundo } from './colisionObjetos.js'

const getFrames = (s) => s.curve
const sample = (curve, u) => {
  const T = curve.getTangentAt(Math.min(1, Math.max(0, u)))
  const up = new THREE.Vector3(0, 1, 0)
  if (Math.abs(T.y) > 0.95) up.set(1, 0, 0)
  up.addScaledVector(T, -up.dot(T)).normalize()
  return { pos: curve.getPointAt(Math.min(1, Math.max(0, u))), T, up, right: new THREE.Vector3().crossVectors(up, T).normalize() }
}
const posDe = (m) => new THREE.Vector3().setFromMatrixPosition(m)

for (const seed of [369, 7]) {
  const world = registrarMundo(buildWorld(seed))
  const col = colisionDe(world)

  test(`seed ${seed}: ningún objeto del ecosistema toca cintas ni tubos de otro camino`, () => {
    ESTADO.colocados = 0; ESTADO.descartados = 0
    let n = 0
    for (const way of world.ways) {
      for (const g of buildEcosistema(way, getFrames, sample)) {
        if (g.key.startsWith('mouth:') || g.key.startsWith('cascada:') || g.key.startsWith('portal:') || g.key.startsWith('rampa:') || g.key.startsWith('m:cascada')) continue
        for (const it of g.items) { n++; assert.ok(col.libre(posDe(it.m), 0, { way: way.idx }), `${g.key} del camino ${way.idx} choca con otro camino`) }
      }
    }
    console.log(`seed ${seed}: ${n} objetos de ecosistema; colocar: ${ESTADO.colocados} colocados, ${ESTADO.descartados} descartados por falta de sitio`)
  })

  test(`seed ${seed}: colocar repele, no deja nada dentro de una cinta ajena y es determinista`, () => {
    const rng = mulberry32(seed)
    const way = world.ways[0]; const seg = way.segments.find((s) => !s.air)
    const cand = []
    for (let i = 0; i < 40; i++) { // puntos pegados a las cintas de cualquier camino
      const w = world.ways[Math.floor(rng() * world.ways.length)]; const s = w.segments.find((x) => !x.air && x.lanes?.length) ?? seg
      const f = sample(s.curve, rng())
      cand.push(f.pos.addScaledVector(f.right, (rng() - 0.5) * 6))
    }
    const run = () => cand.map((p, i) => colocar(world, { pos: p, seed: i + 1 }, 0.6, null, 6))
    const a = run(); const b = run()
    a.forEach((p, i) => {
      assert.deepEqual(p?.toArray(), b[i]?.toArray())
      if (p) assert.ok(col.libre(p, 0.6, null), 'colocado sobre una cinta')
    })
  })
}
