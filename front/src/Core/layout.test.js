// Layout sin choques: ningún camino colinda con otro, tampoco dentro de una misma ruta. Ver tools/overlap.mjs para la medición completa.
// Categorías (holgura = huelgo - 1.5 radios de pista, debe ser >= 0 fuera de puertos de nodo y uniones diseñadas):
//   cross: circuitos distintos; same: ida contra vuelta del mismo circuito; route: rutas de un mismo sentido entre sí;
//   lane: carriles trenzados de un mismo tramo entre sí.
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildWorld } from './world.js'
import { measure, MIN_GAP_K } from '../../tools/overlap.mjs'

const SEEDS = [1, 2, 3, 27, 369, 7, 11, 40] // 27: semilla que antes dejaba un camino sin hueco
const CATS = { cross: 'circuitos distintos', same: 'ida y vuelta', route: 'rutas del mismo sentido', lane: 'carriles trenzados' }

for (const seed of SEEDS) {
  test(`huelgo >= ${MIN_GAP_K} radios de pista entre todo par de caminos (semilla ${seed})`, () => {
    const m = measure(buildWorld(seed))
    for (const [k, name] of Object.entries(CATS)) {
      assert.ok(m[k].slack >= 0, `semilla ${seed}, ${name}: huelgo ${m[k].gap.toFixed(2)} (holgura ${m[k].slack.toFixed(2)}) ways ${m[k].a}/${m[k].b}: ${m[k].info}`)
    }
  })
}
