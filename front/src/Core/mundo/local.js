import { Sim, nombreUnico } from '../sim.js'
import { iniciarBack } from '../api.js'

export function crearLocal({ semilla = 369, registrarBack = true } = {}) {
  const sim = new Sim({ seed: semilla })
  if (registrarBack) iniciarBack(sim)
  const listeners = new Map()
  const emit = (e, x) => listeners.get(e)?.forEach((fn) => fn(x))
  return Object.assign(sim, {
    modo: 'local', estado: 'sin_servidor', yo: { corto: 'local' }, fila: [], espectadores: 1,
    reglas: { maxSinDecidir: 3, maxFila: 30, maxNombre: 16 }, puede: { velocidad: true },
    nombreSugerido: () => nombreUnico(Math.random, sim.nombres),
    formar(nombre) { return sim.formar?.(nombre) ?? Promise.resolve({ ok: false, error: 'sin_soporte' }) },
    salirFila: () => Promise.resolve({ ok: false, error: 'sin_soporte' }),
    tomar: (b) => Promise.resolve(sim.tomar?.(b, 'local') ?? { ok: false, error: 'sin_soporte' }),
    dejar: (b) => Promise.resolve(sim.dejar?.(b, 'local') ?? { ok: false, error: 'sin_soporte' }),
    decidir: (b, d) => Promise.resolve(sim.decidir?.(b, 'local', d) ?? { ok: false, error: 'sin_soporte' }),
    opciones(b) { return { origen: b.node, planetas: sim.world.destinos, rutas: sim.world.waysFrom[b.node] ?? [], carriles: [0, 1, 2, 3, 4] } },
    on(e, fn) { if (!listeners.has(e)) listeners.set(e, new Set()); listeners.get(e).add(fn); return () => listeners.get(e)?.delete(fn) },
    cerrar() {},
  })
}
