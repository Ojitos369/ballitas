// Layout sin choques: ningún camino (circuito) colinda con otro. Ver tools/overlap.mjs para la medición completa.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorld } from './world.js'
import { measure, MIN_GAP_K } from '../../tools/overlap.mjs'

const SEEDS = [1, 2, 3, 27, 369, 7, 11, 40] // 27: semilla que antes dejaba un camino sin hueco

for (const seed of SEEDS) {
  test(`huelgo entre caminos distintos >= ${MIN_GAP_K} radios de pista (semilla ${seed})`, () => {
    const m = measure(buildWorld(seed))
    assert.ok(m.cross.slack >= 0, `semilla ${seed}: huelgo ${m.cross.gap.toFixed(2)} (holgura ${m.cross.slack.toFixed(2)}) entre ways ${m.cross.a} y ${m.cross.b}: ${m.cross.info}`)
  })
}
