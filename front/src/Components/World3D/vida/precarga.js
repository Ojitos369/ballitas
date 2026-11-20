// Precarga de la vida de un camino por porciones con presupuesto: los mismos datos que cada capa construía de golpe
// al montarse (pista, piezas kart, decoración, anillos, eventos, uniones, criaturas) o al acercarse la cámara a cada
// tramo (estructuras, paisaje) se calculan antes, en huecos libres o con unos ms por cuadro, y quedan en las cachés
// de cada módulo. Montar el camino después ya no congela el hilo. Nada de aspecto ni colocación cambia aquí: solo cuándo.
import { trackGeoPaso } from './pista.jsx'
import { KART_KIT_PIECES, kartPaso } from './kartPista.jsx'
import { decorKit, decorPaso } from './decor.jsx'
import { buildAnillosData } from './anillos.jsx'
import { eventosPaso } from './eventos.jsx'
import { buildUnionesData } from './uniones.jsx'
import { getWayFaunaData } from './criaturas.jsx'
import { estructurasModelos, estructurasPaso } from './estructuras.jsx'
import { paisajePaso } from './paisaje.jsx'
import { precargarKit } from '../Modelos.jsx'
import { precargarModelos } from './modelos.js'
import { ETAPAS_NOMBRES, etapaActual, marcarEtapa, tocarVida } from './etapas.js'
import { prismaPaso } from './colocacion.js'
import { PRISMA_STATS } from '../../../Core/world.js'

/** Piezas del kit GLB que montará la vida de `way` (kart, decoración, anillos y eventos). */
export function kitDeCamino(way) {
  return [...KART_KIT_PIECES, ...decorKit(way), 'anillo_neon_lod', 'caja_evento_lod', 'turbo_placa', 'pilar', `rebote_${way.theme?.id}`]
}

const una = (fn) => (way) => { fn(way); return true }
const FN = {
  pista: trackGeoPaso,
  // los GLB se piden al empezar: llegan (y se compilan en el precalentado de Paths) mientras se calcula el resto
  modelos: (way) => { precargarKit(kitDeCamino(way)); precargarModelos(estructurasModelos(way)); return true },
  // muestras del prisma libre de las cintas cercanas (colocación con gálibo ajeno), por porciones y antes de anillos
  prisma: prismaPaso,
  anillos: una(buildAnillosData),
  eventos: eventosPaso,
  uniones: una(buildUnionesData),
  criaturas: una(getWayFaunaData),
  decor: decorPaso,
  kart: kartPaso,
  estructuras: estructurasPaso,
  paisaje: paisajePaso,
}
const ETAPAS = ETAPAS_NOMBRES.map((n) => [n, FN[n]])
// Con la pista lista el camino ya se monta: cada capa aparece (precompilada) cuando su etapa termina (useEtapa).
const MONTABLE = ETAPAS_NOMBRES.indexOf('modelos') + 1

/** Tiempos por etapa (ms acumulados y peor porción), visibles con ?stats=1 en window.__precarga. */
// listo[idx] / montado[idx]: performance.now() en que la vida del camino quedó calculada / montada (para las sondas)
export const PRECARGA = { ms: {}, max: {}, caminos: 0, listo: {}, montado: {} }
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stats') === '1') { window.__precarga = PRECARGA; window.__prismaStats = PRISMA_STATS }

/** true si montar la vida de `way` ya no construye nada pesado de golpe. */
export const vidaMontable = (way) => etapaActual(way) >= MONTABLE
/** true si toda la vida de `way` (incluidos los tramos de estructuras y paisaje) está calculada. */
export const vidaCompleta = (way) => etapaActual(way) >= ETAPAS.length

/** Avanza la precarga de `way` hasta que `agotado()` diga basta; true cuando está completa. */
export function precargaPaso(way, agotado) {
  tocarVida(way) // MEM: cuenta en la caché acotada desde la primera porción
  let k = etapaActual(way)
  while (k < ETAPAS.length) {
    const [nombre, fn] = ETAPAS[k]
    const t0 = performance.now()
    const ok = fn(way, agotado)
    const dt = performance.now() - t0
    PRECARGA.ms[nombre] = Math.round((PRECARGA.ms[nombre] ?? 0) + dt)
    if (dt > (PRECARGA.max[nombre] ?? 0)) PRECARGA.max[nombre] = Math.round(dt * 10) / 10
    if (!ok) return false
    marcarEtapa(way, ++k)
    if (k === ETAPAS.length) { PRECARGA.caminos++; PRECARGA.listo[way.idx] = Math.round(performance.now()) }
    if (agotado()) return k >= ETAPAS.length
  }
  return true
}
