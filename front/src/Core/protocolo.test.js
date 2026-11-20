import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim } from './sim.js'
import { mulberry32 } from './world.js'
import { rapida, leerRapida, lenta, difLenta, aplicarLenta, instantanea, filaPublica, validar, R, FASES, MAX_BYTES, MAX_LOG, V } from './protocolo.js'

const sim = new Sim({ rng: mulberry32(369), seed: 369 })
const cortoDe = (e) => `c-${e.length}`

test('protocolo: la tupla rápida tiene 26 campos, ida y vuelta, y la instantánea de 10 ballitas pesa ≤ 1 800 B', () => {
  let max = 0; let suma = 0; let n = 0; const fases = new Set(); let vuelos = 0
  for (let i = 0; i < 9000; i++) {
    sim.tick(1 / 30)
    if (i % 3) continue
    const snap = instantanea(i, sim.t, sim.ballitas)
    const txt = JSON.stringify(snap); const bytes = Buffer.byteLength(txt)
    assert.ok(!txt.includes('null'), 'sin NaN ni indefinidos')
    max = Math.max(max, bytes); suma += bytes; n++
    if (i % 300) continue
    const vuelta = JSON.parse(txt)
    sim.ballitas.forEach((b, j) => {
      const r = vuelta.b[j]; const o = leerRapida(r)
      assert.equal(r.length, 26)
      assert.equal(o.id, b.id); assert.equal(o.phase, b.phase); fases.add(o.phase)
      assert.ok(Math.abs(o.pos[0] - b.pos.x) <= 0.005 + 1e-9 && Math.abs(o.segT - b.segT) <= 5e-6 + 1e-12)
      assert.equal(o.seg, b.seg ? b.seg.i : -1); assert.equal(o.lane, b.lane); assert.equal(o.carril, b.carril)
      assert.equal(o.airborne, !!b.airborne); assert.equal(o.onLane, !!b.onLane); assert.equal(o.enVuelo, !!b.flight)
      if (b.flight) { vuelos++; assert.equal(b.seg.switches[o.evento], b.flight.sw); assert.equal(o.fallido, !!b.flight.failed) } else assert.equal(o.evento, -1)
      assert.equal(o.walkI, b.walk ? b.walk.i : -1)
      assert.equal(r[R.fase], FASES.indexOf(b.phase))
    })
  }
  assert.ok(max <= 1800, `instantánea máxima ${max} B`)
  assert.ok(fases.has('travel') && fases.has('toDest'))
  console.log(`  instantánea rápida: media ${Math.round(suma / n)} B, máx ${max} B (${n} muestras, ${vuelos} en vuelo)`)
})

test('protocolo: la parte lenta no filtra el id secreto y difLenta solo envía lo que cambió', () => {
  const b = sim.ballitas[0]
  sim.tomar(b.id, 'secreto-uuid-1234')
  const l = lenta(b, { cortoDe, auto: sim.predecir(b) })
  const txt = JSON.stringify(l)
  assert.ok(!txt.includes('secreto-uuid'), 'el id del espectador no viaja')
  assert.equal(l.ctrl, cortoDe('secreto-uuid-1234')); assert.equal(l.formadaPor, null)
  assert.ok(l.log.length <= MAX_LOG); assert.ok(Number.isInteger(l.auto.way) && Number.isInteger(l.auto.r))
  for (const k of ['id', 'name', 'gen', 'padres', 'arch', 'genome', 'bornAt', 'node', 'vert', 'dest', 'way', 'route', 'plannedRoute', 'nextDest', 'walk', 'dur', 'plan', 'mood', 'thought', 'react', 'age', 'score', 'visits', 'cause', 'visited', 'mechs', 'lastSwitch', 'log', 'ctrl', 'formadaPor', 'dec', 'sinDecidir', 'auto']) assert.ok(k in l, k)
  const textos = {}
  const d0 = difLenta(textos, l); assert.equal(Object.keys(d0).length, Object.keys(l).length) // primera vez: todo
  assert.equal(difLenta(textos, lenta(b, { cortoDe, auto: sim.predecir(b) })), null)
  sim.decidir(b.id, 'secreto-uuid-1234', { carril: 2 })
  const d1 = difLenta(textos, lenta(b, { cortoDe, auto: sim.predecir(b) }))
  assert.deepEqual(d1, { id: b.id, dec: { carril: 2 } })
  const copia = JSON.parse(txt); aplicarLenta(copia, d1); assert.deepEqual(copia.dec, { carril: 2 })
  sim.formar('otro-secreto', 'Pelusa')
  assert.deepEqual(filaPublica(sim.fila, cortoDe).map((f) => [f.nombre, f.de]), [['Pelusa', 'c-12']])
  sim.dejar(b.id, 'secreto-uuid-1234'); sim.salirFila('otro-secreto')
})

test('protocolo: validar acepta el contrato y rechaza lo demás', () => {
  const j = (o) => validar(JSON.stringify(o))
  const id = '123e4567-e89b-12d3-a456-426614174000'
  assert.deepEqual(j({ k: 'hola', v: V, id }).m, { k: 'hola', q: undefined, v: V, id, epoca: undefined, n: undefined })
  assert.equal(j({ k: 'hola', v: 2, id }).error, 'version')
  assert.equal(j({ k: 'hola', v: V, id: 'x' }).error, 'formato')
  assert.equal(j({ k: 'hola', v: V, id: { a: 1 } }).error, 'formato')
  assert.equal(validar('{').error, 'formato'); assert.equal(validar('[]').error, 'formato'); assert.equal(validar('null').error, 'formato')
  assert.equal(j({ k: 'borrarTodo' }).error, 'formato')
  assert.equal(validar('x'.repeat(MAX_BYTES + 1)).error, 'tamano'); assert.equal(validar(Buffer.from('{}')).error, 'tamano')
  assert.deepEqual(j({ k: 'formar', q: 7, nombre: 'Luli', extra: 1 }).m, { k: 'formar', q: 7, nombre: 'Luli' })
  assert.equal(j({ k: 'formar', nombre: 5 }).error, 'nombre'); assert.equal(j({ k: 'formar', q: 3, nombre: 5 }).q, 3)
  assert.deepEqual(j({ k: 'tomar', b: 4 }).m, { k: 'tomar', q: undefined, b: 4 })
  assert.equal(j({ k: 'tomar', b: '4' }).error, 'no_existe'); assert.equal(j({ k: 'dejar', b: 1.5 }).error, 'no_existe')
  assert.deepEqual(j({ k: 'decidir', b: 1, destino: 2, ruta: null, carril: 4, __proto__: 1 }).m.dec, { destino: 2, ruta: null, carril: 4 })
  assert.deepEqual(j({ k: 'decidir', b: 1 }).m.dec, {})
  assert.equal(j({ k: 'decidir', b: 1, ruta: { way: 'a', r: 0 } }).error, 'ruta')
  assert.equal(j({ k: 'decidir', b: 1, destino: 'x' }).error, 'destino'); assert.equal(j({ k: 'decidir', b: 1, carril: [] }).error, 'carril')
  assert.deepEqual(j({ k: 'ping', c: 12.5 }).m, { k: 'ping', q: undefined, c: 12.5 })
})
