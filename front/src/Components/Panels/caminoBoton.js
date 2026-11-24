// Color y modo del borde animado de los botones de la barra de la ballita (sin React: se prueba con node --test).
// 'actual' = camino en el que está; 'siguiente' = camino que tomará; 'neutro' = aún no se sabe.
const TEMAS = {
  sombrio: '#9b7bff', bosque: '#5be38c', mar: '#38bdf8', desierto: '#f5b041', hielo: '#99f6ff',
  volcan: '#ff6b57', cristal: '#e879f9', nubes: '#cbd5e1', neon: '#22d3ee', jardin: '#f472b6',
}
// Mismos tonos que themeColor (Control/previas.js); se duplican para no arrastrar el canvas al módulo puro.
export const colorTema = (id) => TEMAS[id] || '#8aa7ff'
export const COLOR_NEUTRO = '#9aa7c7'

// Tolera campos ausentes: en remoto `auto` solo existe para la controlada y los índices pueden no resolverse.
export function caminoDeBoton(b, world) {
  const tema = (w) => w?.theme?.id
  const info = (w, modo, nombre) => ({ color: colorTema(tema(w)), modo, nombre: nombre || w?.theme?.name || 'camino' })
  if (!b) return { color: COLOR_NEUTRO, modo: 'neutro', nombre: '' }
  if (b.phase === 'travel' && b.way) return info(b.way, 'actual', b.way.theme?.name)
  const ways = world?.ways
  const decWay = b.dec?.ruta ? ways?.[b.dec.ruta.way] : null
  if (decWay) return info(decWay, 'siguiente')
  const autoWay = b.auto && b.mia !== false ? ways?.[b.auto.way] : null
  if (autoWay) return info(autoWay, 'siguiente')
  const pw = b.plannedRoute?.way
  if (pw) return info(pw, 'siguiente')
  const dest = b.nextDest
  const nodo = dest != null && typeof dest.node === 'number' ? world?.nodes?.[dest.node] : null
  if (nodo?.color) return { color: nodo.color, modo: 'siguiente', nombre: nodo.name || 'destino' }
  return { color: COLOR_NEUTRO, modo: 'neutro', nombre: '' }
}
