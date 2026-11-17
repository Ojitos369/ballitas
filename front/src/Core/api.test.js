import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim } from './sim.js'
import { iniciarBack } from './api.js'
import { SKIN_PARTS } from '../Components/World3D/skins.js'

const tick = () => new Promise((r) => setTimeout(r, 20))

test('con back: catálogo aplicado, mundo y nacimientos/muertes registrados', async () => {
  const llamadas = []
  globalThis.fetch = async (url, o = {}) => {
    llamadas.push(`${o.method} ${url}`)
    const ok = (j) => ({ ok: true, json: async () => j })
    if (url === '/api/catalogo') return ok({ piezas: { hat: { sombrero_test: { id: 'sombrero_test', label: 'T', emoji: 'x', category: 'hat', defaults: { scale: 2 } } } } })
    if (url === '/api/mundos') return ok({ id: 7 })
    if (url === '/api/ballitas') return ok({ id: 100 + JSON.parse(o.body).ref })
    return ok({})
  }
  const sim = new Sim({ pop: 3, seed: 5 })
  iniciarBack(sim)
  await tick()
  assert.equal(SKIN_PARTS.hat.sombrero_test.scale, 2)
  assert.equal(llamadas.filter((l) => l === 'POST /api/ballitas').length, 3)
  const b = sim.ballitas[0]; b.e = 0; sim.watch(b)
  await tick()
  assert.ok(llamadas.includes(`PATCH /api/ballitas/${100 + b.id}`))
})

test('sin back: nada lanza y la sim sigue', async () => {
  globalThis.fetch = async () => { throw new Error('sin red') }
  const sim = new Sim({ pop: 3, seed: 5 })
  iniciarBack(sim)
  for (let i = 0; i < 20; i++) sim.tick(0.1)
  await tick()
  assert.equal(sim.ballitas.length >= 3, true)
})
