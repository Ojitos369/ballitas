// Estado de la precarga de cada camino (vida/precarga.js) y aviso a las capas que esperan sus datos. Módulo aparte,
// sin dependencias de las capas, para que pista.jsx o index.js lo consulten sin importarse en círculo.
import { startTransition, useEffect, useState } from 'react'

// Orden de cálculo: primero lo barato y cercano a la pista; estructuras y paisaje (por tramos) al final.
export const ETAPAS_NOMBRES = ['pista', 'modelos', 'prisma', 'anillos', 'eventos', 'uniones', 'criaturas', 'decor', 'kart', 'estructuras', 'paisaje']
const IDX = Object.fromEntries(ETAPAS_NOMBRES.map((n, i) => [n, i]))

const estado = new WeakMap() // way -> índice de la siguiente etapa por calcular
const oyentes = new WeakMap() // way -> Set(cb)

export const etapaActual = (way) => estado.get(way) ?? 0
export const etapaHecha = (way, nombre) => etapaActual(way) > IDX[nombre]

// Retención acotada (pieza MEM): la precarga guardaba la vida calculada de TODO el mundo en WeakMaps por camino o
// tramo, cuyas llaves (los caminos) viven siempre: el montón crecía de 120 MB a 1,4 GB en 6 min a 8×. Cada módulo
// con cachés por camino registra cómo olvidarlas; Paths expulsa los caminos lejanos menos usados (olvidarVida).
const olvidos = []
const conVida = new Map() // way -> último uso (performance.now()); caminos con algo calculado
/** Registra `fn(way)`, que borra de las cachés del módulo lo calculado para `way` (y sus tramos). */
export function registrarOlvido(fn) { olvidos.push(fn) }
/** Marca `way` como usado ahora (precarga, montaje o cercanía). */
export function tocarVida(way) { conVida.set(way, performance.now()) }
export const caminosConVida = () => conVida
/** Libera lo calculado para `way`: la próxima vez que haga falta se recalcula igual (generadores con semilla). */
export function olvidarVida(way) {
  for (const fn of olvidos) fn(way)
  estado.delete(way); conVida.delete(way)
}
/** Libera la GPU de las geometrías propias (no compartidas) dentro de `v` (recorrido corto de objetos planos). */
export function liberarGeos(v, prof = 0, vistos = new Set()) {
  if (!v || typeof v !== 'object' || vistos.has(v) || prof > 4) return
  vistos.add(v)
  if (v.isBufferGeometry) { if (!v.userData?.shared) v.dispose(); return }
  if (v.isObject3D || v.isMaterial || v.isTexture || v.isVector3 || v.isQuaternion || v.isMatrix4 || ArrayBuffer.isView(v)) return
  if (Array.isArray(v)) { if (v.length && (typeof v[0] !== 'object' || v.length > 4096)) return; for (const x of v) liberarGeos(x, prof + 1, vistos); return }
  if (v instanceof Map) { for (const x of v.values()) liberarGeos(x, prof + 1, vistos); return }
  for (const k in v) liberarGeos(v[k], prof + 1, vistos)
}

export function marcarEtapa(way, k) {
  estado.set(way, k); conVida.set(way, performance.now())
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
