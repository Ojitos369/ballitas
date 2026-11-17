// Prepara las elecciones del mundo (caché local → worker → nada: buildWorld calcula directo) sin bloquear la UI.
import { setWorldPicks, WORLD_GEN } from './world.js'

export const TOTAL_WAYS = 20

export function cargarMundo(seed = 369, onProgress = () => {}) {
  const key = `ballitas:picks:${WORLD_GEN}:${seed}`
  try {
    const hit = JSON.parse(localStorage.getItem(key))
    if (Array.isArray(hit) && hit.length === TOTAL_WAYS) { setWorldPicks(seed, hit); return Promise.resolve('cache') }
  } catch { /* sin almacenamiento: se calcula */ }
  if (typeof Worker === 'undefined') return Promise.resolve('directo')
  return new Promise((resolve) => {
    let worker
    try { worker = new Worker(new URL('./worldWorker.js', import.meta.url), { type: 'module' }) } catch { resolve('directo'); return }
    worker.onmessage = ({ data }) => {
      if (data.progress) { onProgress(data.progress / TOTAL_WAYS); return }
      setWorldPicks(seed, data.picks)
      try { localStorage.setItem(key, JSON.stringify(data.picks)) } catch { /* cuota llena: da igual */ }
      worker.terminate(); resolve('worker')
    }
    worker.onerror = () => { worker.terminate(); resolve('directo') } // el hilo principal calcula como antes
  })
}
