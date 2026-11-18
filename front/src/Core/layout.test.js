// Layout sin choques: ningún camino colinda con otro, tampoco dentro de una misma ruta. Ver tools/overlap.mjs para la medición completa.
// Categorías (holgura = huelgo - 1.5 radios de pista, debe ser >= 0 fuera de puertos de nodo y uniones diseñadas):
//   cross: circuitos distintos; same: ida contra vuelta del mismo circuito; route: rutas de un mismo sentido entre sí;
//   lane: carriles trenzados de un mismo tramo entre sí.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildWorld, ribbonHits, ribbonSamples, RIBBON_CLEAR } from './world.js'
import { measure, MIN_GAP_K } from '../../tools/overlap.mjs'

const SEEDS = [1, 2, 3, 27, 369, 7, 11, 40] // 27: semilla que antes dejaba un camino sin hueco
const WORLDS = new Map(); const mundo = (s) => WORLDS.get(s) ?? WORLDS.set(s, buildWorld(s)).get(s)
const CATS = { cross: 'circuitos distintos', same: 'ida y vuelta', route: 'rutas del mismo sentido', lane: 'carriles trenzados' }

for (const seed of SEEDS) {
  test(`huelgo >= ${MIN_GAP_K} radios de pista entre todo par de caminos (semilla ${seed})`, () => {
    const m = measure(mundo(seed))
    for (const [k, name] of Object.entries(CATS)) {
      assert.ok(m[k].slack >= 0, `semilla ${seed}, ${name}: huelgo ${m[k].gap.toFixed(2)} (holgura ${m[k].slack.toFixed(2)}) ways ${m[k].a}/${m[k].b}: ${m[k].info}`)
    }
  })
}

// Cintas visibles (lo que dibuja pista.jsx): ningún par de cintas a menos de RIBBON_CLEAR fuera de las uniones diseñadas.
for (const seed of [1, 369]) {
  test(`cintas visibles sin choque (semilla ${seed})`, () => {
    const { hits, S } = ribbonHits(mundo(seed))
    const tag = (i) => { const r = S.ribs[S.R[i]]; return `w${r.way.idx} ${r.seg.kind} L${r.lane}@${((i - r.start) / r.n).toFixed(2)}` }
    assert.equal(hits.length, 0, `semilla ${seed}: ${hits.length / 3} choques, p. ej. ${hits.length ? `${tag(hits[0])} vs ${tag(hits[1])} a ${hits[2].toFixed(2)} < ${RIBBON_CLEAR.toFixed(2)}` : ''}`)
  })
}

test('contrato world.colision: lejos libre, centro de cinta ocupado salvo que se ignore', () => {
  const w = mundo(369); const col = w.colision
  assert.ok(col && typeof col.libre === 'function' && typeof col.cercano === 'function')
  assert.equal(col.libre(new THREE.Vector3(1e5, 1e5, 1e5), 1), true)
  assert.equal(col.cercano(new THREE.Vector3(1e5, 1e5, 1e5)), null)
  const S = ribbonSamples(w); const r = S.ribs.find((x) => x.n > 40)
  const i = r.start + (r.n >> 1); const p = new THREE.Vector3(S.X[i], S.Y[i], S.Z[i])
  assert.equal(col.libre(p, 0), false)
  assert.equal(col.cercano(p).seg, r.seg)
  assert.equal(col.libre(p, 0, { way: r.way, seg: r.seg, lane: r.lane }), true)
  assert.equal(col.libre(p, 0, { way: r.way.idx, si: r.way.segments.indexOf(r.seg), lane: r.lane }), true)
})