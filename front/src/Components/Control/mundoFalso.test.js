import test from 'node:test'
import assert from 'node:assert/strict'
import { crearMundoFalso } from './mundoFalso.js'

test('mundoFalso: formar, fila, salirFila y nacimiento desde fila', async () => {
  const mundo = crearMundoFalso({ semilla: 369, conRelleno: false })
  assert.equal(mundo.fila.length, 0)
  const sugerido = mundo.nombreSugerido()
  assert.ok(sugerido.length >= 2 && sugerido.length <= 16)

  const res = await mundo.formar('  Estrella_1  ')
  assert.equal(res.ok, true)
  assert.equal(res.puesto, 1)
  assert.equal(mundo.fila.length, 1)
  assert.equal(mundo.fila[0].mia, true)
  assert.equal(mundo.fila[0].nombre, 'Estrella_1')

  const dup = await mundo.formar('Otra')
  assert.equal(dup.ok, false)
  assert.equal(dup.error, 'ya_en_fila')

  const salir = await mundo.salirFila()
  assert.equal(salir.ok, true)
  assert.equal(mundo.fila.length, 0)

  await mundo.formar('Estrella')
  // Forzar muerte de la primera ballita y simular hasta que nazca la de la fila
  const victima = mundo.ballitas[0]
  victima.e = 0
  let entro = null
  mundo.on('entra', (ev) => { entro = ev })
  for (let i = 0; i < 150; i++) mundo.tick(1 / 30)
  assert.ok(entro, 'debía nacer la ballita formada al morir otra')
  assert.equal(entro.nombre, 'Estrella')
  assert.equal(entro.b.mia, true)
  assert.equal(mundo.fila.length, 0)
})

test('mundoFalso: tomar, decidir (ruta fija planeta), opciones y dejar', async () => {
  const mundo = crearMundoFalso({ semilla: 369, conRelleno: true })
  const libre = mundo.ballitas.find((b) => !b.ctrl)
  assert.ok(libre)

  const t1 = await mundo.tomar(libre)
  assert.equal(t1.ok, true)
  assert.equal(libre.mia, true)

  const op = mundo.opciones(libre)
  assert.ok(op.planetas.length >= 3)
  assert.ok(op.rutas.length >= 6)
  assert.equal(op.carriles.length, 5)
  for (const p of op.planetas) {
    assert.ok(p.destinos.length >= 1)
    assert.ok(Number.isFinite(p.llegarE))
    assert.ok(Number.isFinite(p.llegarP))
  }
  for (const r of op.rutas) {
    assert.ok(r.kinds.length >= 1)
    assert.ok(r.duracion > 0)
  }

  // Elegir una ruta fija también el planeta destino
  const r0 = op.rutas[0]
  const d1 = await mundo.decidir(libre, { ruta: { way: r0.wayIdx, r: r0.r }, carril: 2 })
  assert.equal(d1.ok, true)
  assert.equal(libre.dec.destino, r0.to)
  assert.equal(libre.dec.carril, 2)

  // Cambiar el planeta a otro distinto debe borrar la ruta incompatible
  const otroP = op.planetas.find((p) => p.idx !== r0.to)
  const d2 = await mundo.decidir(libre, { destino: otroP.idx })
  assert.equal(d2.ok, true)
  assert.equal(libre.dec.destino, otroP.idx)
  assert.equal(libre.dec.ruta, undefined)

  // Dejar libera el control y borra decisiones
  const dj = await mundo.dejar(libre)
  assert.equal(dj.ok, true)
  assert.equal(libre.ctrl, null)
  assert.equal(libre.mia, false)
  assert.deepEqual(libre.dec, {})
})
