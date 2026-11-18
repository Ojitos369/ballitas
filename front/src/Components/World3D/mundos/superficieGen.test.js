import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWorld } from '../../../Core/world.js'
import { BIOMES, resolveNodeBiome } from './biomas.js'
import { generarSuperficie, terminalesDe } from './superficieGen.js'

const world = buildWorld(369)
const gen = (n) => generarSuperficie(world.nodes[n], resolveNodeBiome(world.nodes[n], world), world)

test('superficie: determinista por semilla del nodo', () => {
  assert.equal(JSON.stringify(gen(0)), JSON.stringify(gen(0)))
})

test('superficie: distinta entre nodos', () => {
  assert.notEqual(JSON.stringify(gen(0).celdas), JSON.stringify(gen(1).celdas))
  assert.notEqual(JSON.stringify(gen(0).edificios), JSON.stringify(gen(1).edificios))
})

test('superficie: un puerto y una calle por camino del nodo, sin pisarse', () => {
  for (const node of world.nodes) {
    const s = gen(node.idx)
    const terms = terminalesDe(node)
    assert.ok(terms.length >= 4)
    assert.equal(s.puertos.length, terms.length)
    assert.equal(s.calles.length, terms.length)
    s.puertos.forEach((p, i) => {
      assert.equal(p.kind, terms[i].kind)
      assert.equal(p.to, terms[i].to)
    })
    const a = s.puertos.map((p) => p.ang).sort((x, y) => x - y)
    for (let i = 1; i < a.length; i++) assert.ok(a[i] - a[i - 1] > 0.1)
    assert.ok(s.edificios.length > 5 && s.flora.length > 5)
  }
})

test('superficie: funciona con los 10 biomas', () => {
  for (const b of Object.values(BIOMES)) {
    const s = generarSuperficie(world.nodes[2], b, world)
    assert.ok(s.celdas.length > 200)
  }
})
