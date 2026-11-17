// Cliente del back (FastAPI, base relativa `/api`). Tolerante a fallos: si el back no responde,
// todo devuelve null y el juego sigue con los catálogos locales. Tras un fallo se deja de insistir 30 s.
import { aplicarCatalogo, generateSkin } from '../Components/World3D/skins.js'

const BASE = '/api'
const TIMEOUT_MS = 4000
const REINTENTO_MS = 30000
let caidoHasta = 0

async function req(method, path, body) {
  if (Date.now() < caidoHasta) return null
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(BASE + path, {
      method,
      signal: ctl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!r.ok) return null // 4xx: dato rechazado, el back sigue vivo
    return await r.json()
  } catch {
    caidoHasta = Date.now() + REINTENTO_MS
    return null
  } finally {
    clearTimeout(timer)
  }
}

// El navegador cachea la respuesta (ETag + Cache-Control del back).
export const cargarCatalogo = () => req('GET', '/catalogo')

// Conecta una Sim con el back: aplica el catálogo, registra el mundo y cada nacimiento/muerte.
export function iniciarBack(sim) {
  if (sim.hooks.nace) return // ya conectada (StrictMode monta dos veces)
  cargarCatalogo().then((c) => c && aplicarCatalogo(c.piezas))

  const mundo = req('POST', '/mundos', { semilla: sim.seed, params: { pop: sim.pop } })
  const ids = new Map() // id de la sim -> Promise<id en el back | null>

  sim.hooks.nace = (b) => {
    ids.set(b.id, mundo.then(async (m) => {
      if (!m) return null
      const skin = generateSkin(b.genome, b.arch)
      const r = await req('POST', '/ballitas', {
        mundo_id: m.id, ref: b.id, nombre: b.name, genoma: b.genome, arquetipo: b.arch, skin,
        padres: b.padres ?? [], generacion: b.gen,
      })
      return r?.id ?? null
    }))
  }
  sim.hooks.muere = (b) => {
    ids.get(b.id)?.then((id) => id && req('PATCH', `/ballitas/${id}`, {
      estado: 'muerta', puntos: Math.round(b.score * 100) / 100, edad: Math.round(b.age * 10) / 10, causa: b.cause,
    }))
    ids.delete(b.id) // la promesa ya está encadenada; no crece el mapa
  }
  for (const b of sim.ballitas) sim.hooks.nace(b) // las del arranque nacieron antes de conectar
}
