// Estado de la precarga de cada camino (vida/precarga.js) y aviso a las capas que esperan sus datos. Módulo aparte,
// sin dependencias de las capas, para que pista.jsx o index.js lo consulten sin importarse en círculo.
import { startTransition, useEffect, useState } from 'react'

// Orden de cálculo: primero lo barato y cercano a la pista; estructuras y paisaje (por tramos) al final.
export const ETAPAS_NOMBRES = ['pista', 'modelos', 'anillos', 'eventos', 'uniones', 'criaturas', 'decor', 'kart', 'estructuras', 'paisaje']
const IDX = Object.fromEntries(ETAPAS_NOMBRES.map((n, i) => [n, i]))

const estado = new WeakMap() // way -> índice de la siguiente etapa por calcular
const oyentes = new WeakMap() // way -> Set(cb)

export const etapaActual = (way) => estado.get(way) ?? 0
export const etapaHecha = (way, nombre) => etapaActual(way) > IDX[nombre]

export function marcarEtapa(way, k) {
  estado.set(way, k)
  const s = oyentes.get(way)
  if (s) for (const cb of [...s]) cb()
}

/** true cuando la etapa `nombre` de `way` ya está en caché; re-renderiza (en transición) al completarse. */
export function useEtapa(way, nombre) {
  const [lista, setLista] = useState(() => etapaHecha(way, nombre))
  useEffect(() => {
    if (etapaHecha(way, nombre)) { setLista(true); return undefined }
    setLista(false)
    let s = oyentes.get(way)
    if (!s) oyentes.set(way, s = new Set())
    const cb = () => { if (etapaHecha(way, nombre)) { s.delete(cb); startTransition(() => setLista(true)) } }
    s.add(cb)
    return () => s.delete(cb)
  }, [way, nombre])
  return lista
}
