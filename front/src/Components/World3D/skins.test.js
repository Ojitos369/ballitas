import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim, randomGenome } from '../../Core/sim.js'
import { mulberry32 } from '../../Core/world.js'
import { archetype } from '../../Core/personality.js'
import { generateSkin } from './skins.js'

// Recorre todo el skin y devuelve la ruta del primer número no finito.
const noFinito = (v, ruta = 'skin') => {
  if (typeof v === 'number') return Number.isFinite(v) ? null : ruta
  if (v && typeof v === 'object') for (const k in v) { const r = noFinito(v[k], `${ruta}.${k}`); if (r) return r }
  return null
}

test('500 skins generados solo contienen números finitos', () => {
  const rng = mulberry32(2024)
  const { world } = new Sim({ rng: mulberry32(1) })
  for (let i = 0; i < 500; i++) {
    const g = randomGenome(world, rng)
    const skin = generateSkin(g, archetype(g))
    assert.equal(noFinito(skin), null, `skin ${i}`)
    assert.ok(Number.isFinite(skin.browThick) && skin.browThick > 0)
  }
})
