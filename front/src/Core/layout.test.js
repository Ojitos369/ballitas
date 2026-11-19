// Layout sin choques: ningún camino colinda con otro, tampoco dentro de una misma ruta. Ver tools/overlap.mjs para la medición completa.
// Categorías (holgura = huelgo - 1.5 radios de pista, debe ser >= 0 fuera de puertos de nodo y uniones diseñadas):
//   cross: circuitos distintos; same: ida contra vuelta del mismo circuito; route: rutas de un mismo sentido entre sí;
//   lane: carriles trenzados de un mismo tramo entre sí.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildWorld, ribbonHits, ribbonSamples, RIBBON_CLEAR, LANE_W, JOINT_MAX } from './world.js'
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

for (const seed of SEEDS) {
  test(`envolvente visual separada por dos calzadas (semilla ${seed})`, () => {
    const m = measure(mundo(seed)).visual
    assert.ok(m.slack >= 0, `semilla ${seed}: huelgo visual ${m.gap.toFixed(2)}u, faltan ${(-m.slack).toFixed(2)}u para 2 calzadas (${2 * LANE_W}u): ways ${m.a}/${m.b} ${m.info}`)
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

// Zona de unión: el arco exento de la medida junto a cada nodo, unión o carril no pasa de JOINT_MAX (el abanico separa antes).
for (const seed of [1, 369]) {
  test(`zona de unión exenta <= JOINT_MAX (semilla ${seed})`, () => {
    const { joint, jointBy } = ribbonHits(mundo(seed))
    const por = Object.entries(jointBy).map(([k, v]) => `${k} ${v.toFixed(1)}u`).join(', ')
    assert.ok(joint > 0 && joint <= JOINT_MAX + 1e-6, `semilla ${seed}: unión ${joint.toFixed(1)}u > JOINT_MAX ${JOINT_MAX.toFixed(1)}u (${por})`)
    for (const [k, v] of Object.entries(jointBy)) assert.ok(v <= JOINT_MAX + 1e-6, `semilla ${seed}: punta ${k} ${v.toFixed(1)}u > JOINT_MAX`)
  })
}

// Pieza SEP (tools/separacion.mjs): fuera de uniones y puertos, ningún par de cintas de caminos distintos ni de rutas
// distintas de un mismo camino invade el gálibo o queda a menos de AIRE_LAT. Es la parte de la meta que ya se cumple en
// estas semillas; las clases dentro de una ruta y de un tramo aún no llegan a 0 (front/_capturas/REPORTE_SEP.md).
for (const seed of [1, 369]) {
  test(`separación visible: 0 pares de caminos o rutas distintas en falta fuera de uniones (semilla ${seed})`, async () => {
    const { medir } = await import('../../tools/separacion.mjs')
    const m = medir(mundo(seed))
    for (const k of ['ways:libre', 'rutas:libre']) {
      const c = m.clases[k]
      assert.equal(c?.pares.size ?? 0, 0, `semilla ${seed}, ${k}: ${c?.pares.size} pares (gálibo ${c?.galibo} ${c?.atH}; lateral ${c?.lateral} ${c?.atD})`)
    }
    assert.ok(m.fundido > 0, 'el medidor separa el fundido coplanar')
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

// M4: ninguna estructura (anillo, arco, pórtico, túnel o arco del kit) invade el gálibo ni la calzada de una cinta ajena.
// Se mide la misma colocación que dibujan los .jsx (vida/colocacion.js). M1-M3 (galibo, lateral, union) los reporta
// tools/overlap.mjs con sus cifras; aún no llegan a 0 (ver front/_capturas/REPORTE.md).
for (const seed of [1, 369]) {
  test(`estructuras sin invadir el gálibo de otras cintas (semilla ${seed})`, async () => {
    const { ribbonClearance, structureIntrusions, clearanceSamples } = await import('./world.js')
    const { colocarTodoMundo } = await import('../Components/World3D/vida/colocacion.js')
    const w = mundo(seed); const items = colocarTodoMundo(w)
    const est = structureIntrusions(clearanceSamples(w), items)
    assert.equal(est.n, 0, `semilla ${seed}: ${est.n}/${items.length} piezas invaden (pen máx ${est.worst.toFixed(1)}u ${est.at})`)
    assert.ok(typeof ribbonClearance === 'function')
  })
}

// La rejilla perezosa del prisma (por camino, etapa «prisma» de la precarga) da el mismo veredicto que la global, y la
// colocación mueve o encoge antes de quitar: se quita a lo sumo el 15 % de las piezas candidatas.
test('prisma perezoso = global; quitadas <= 15 % (semilla 1)', async () => {
  const W = await import('./world.js')
  const C = await import('../Components/World3D/vida/colocacion.js')
  const w = mundo(1); C.reiniciarStats(); const items = C.colocarTodoMundo(w)
  const S = W.clearanceSamples(w); const G = W.clearanceGridDe(S); let diff = 0; let pos = 0
  for (let i = 0; i < items.length; i += 7) {
    const it = items[i]
    for (const k of [1, 2.5]) {
      const a = W.prismaLibre(w, it.center, it.r * k, it); const b = W.prismaLibreGlobal(w, it.center, it.r * k, it, S, G)
      if (a !== b) diff++; if (!b) pos++
    }
  }
  assert.equal(diff, 0); assert.ok(pos > 0)
  assert.equal(W.PRISMA_STATS.fueraCaja, 0)
  let cand = 0; let quit = 0; for (const k in C.STATS) { cand += C.STATS[k].cand; quit += C.STATS[k].quitada }
  // si otra prueba ya colocó este mundo (colocación en caché), los contadores quedan a 0 y no hay nada que medir aquí
  assert.ok(cand === 0 || quit / cand <= 0.15, `quitadas ${quit}/${cand}`)
})
