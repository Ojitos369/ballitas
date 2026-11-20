import { Sim, nombreUnico, MAX_SIN_DECIDIR, MAX_FILA, MAX_NOMBRE } from '../sim.js'
import { iniciarBack } from '../api.js'
import { opcionesDe } from './opciones.js'

const YO = 'local' // único espectador del mundo local

// Adaptador local (docs/mundo_compartido.md, 2.4): una fachada cuyo prototipo es la Sim. Todo lo que la interfaz lee
// (world, ballitas, t, stats, feed, rng, where, favorites…) cae en la sim viva; los métodos de control se definen
// SOLO en la fachada, así las llamadas internas de la sim (`this.dejar(...)` en arrive) siguen usando las suyas.
export function crearLocal({ semilla = 369, registrarBack = true } = {}) {
  // ?rutas=0: rutas dinámicas apagadas (todas activas, como antes); sirve para comparar
  const sinRutas = typeof location !== 'undefined' && new URLSearchParams(location.search).get('rutas') === '0'
  const sim = new Sim({ seed: semilla, ...(sinRutas ? { rutas: false } : {}) })
  if (registrarBack) iniciarBack(sim)
  const listeners = new Map()
  const emit = (e, x) => listeners.get(e)?.forEach((fn) => { try { fn(x) } catch { /* un oyente roto no para la sim */ } })
  const idDe = (b) => (b && typeof b === 'object' ? b.id : b)
  const auto = (b) => { const a = b.ctrl ? sim.predecir(b) : null; b.auto = a ? { way: a.way.idx, r: a.route.r } : null }
  const marcar = (b) => { b.mia = b.ctrl === YO; auto(b) }
  sim.hooks.entra = (b, esp) => { marcar(b); emit('entra', { b, de: esp, nombre: b.name, mia: esp === YO }); emit('cambio') }
  sim.hooks.libre = (b, motivo) => { b.mia = false; b.auto = null; emit('libre', { b, motivo, mia: true }); emit('cambio') }
  sim.hooks.decide = (b) => { auto(b); emit('cambio') }
  // rutas dinámicas: `mundo.activas` y `mundo.rutasRev` son los de la sim (por prototipo); aquí solo se avisa
  sim.hooks.rutas = (c) => { emit('rutas', { on: c.on, off: c.off }); emit('cambio') }
  sim.hooks.invalida = (b, que) => { emit('invalida', { b, que, mia: b.ctrl === YO }); emit('cambio') }
  let tAuto = 0
  const mundo = Object.create(sim)
  Object.defineProperty(mundo, 'fila', { get: () => sim.fila.map((f) => ({ nombre: f.nombre, de: f.espectador, t: f.t, mia: f.espectador === YO })) })
  return Object.assign(mundo, {
    modo: 'local', estado: 'sin_servidor', yo: { corto: YO }, espectadores: 1,
    reglas: { maxSinDecidir: MAX_SIN_DECIDIR, maxFila: MAX_FILA, maxNombre: MAX_NOMBRE }, puede: { velocidad: true },
    tick(dt) {
      sim.tick(dt)
      if (sim.t - tAuto >= 1) { tAuto = sim.t; for (const b of sim.ballitas) if (b.ctrl) marcar(b) }
    },
    nombreSugerido: () => nombreUnico(Math.random, new Set([...sim.nombres, ...sim.fila.map((f) => f.nombre)])),
    formar: async (nombre) => { const r = sim.formar(YO, nombre); if (r.ok) emit('cambio'); return r },
    salirFila: async () => { const r = sim.salirFila(YO); emit('cambio'); return { ok: r.ok } },
    tomar: async (b) => sim.tomar(idDe(b), YO),
    dejar: async (b) => sim.dejar(idDe(b), YO),
    decidir: async (b, dec) => sim.decidir(idDe(b), YO, dec),
    opciones: (b) => opcionesDe(sim, b),
    on(e, fn) { if (!listeners.has(e)) listeners.set(e, new Set()); listeners.get(e).add(fn); return () => listeners.get(e)?.delete(fn) },
    cerrar() { listeners.clear() },
  })
}
