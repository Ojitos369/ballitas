// Tarjetas del selector (docs/mundo_compartido.md, 3.5). Pura: no muta nada. `s` es «algo con forma de sim»:
// { world, ballitas } (la Sim local o el adaptador remoto); los cálculos usan los métodos de Sim por prototipo,
// así local y remoto comparten las mismas fórmulas. La forma devuelta es la que consume Components/Control.
import { Sim } from '../sim.js'
import { CARRILES, KINDS, carrilLat } from '../world.js'

const temaDe = (t) => ({ id: t.id, name: t.name, emoji: t.emoji, risk: t.risk, ecost: t.ecost, pps: t.pps })
const VACIO = { origen: null, planetas: [], rutas: [], carriles: [] }

export function opcionesDe(s, b) {
  if (!s?.world || !b || typeof b !== 'object' || b.phase === 'dying' || b.phase === 'gone' || !b.genome?.traits) return VACIO
  const world = s.world
  // vista con los métodos de Sim (sin construir una): solo lee world y ballitas
  const v = Object.assign(Object.create(Sim.prototype), { world, ballitas: s.ballitas || [] })
  const origen = v.origenSiguiente(b)
  const ways = world.waysFrom[origen] || []
  const peers = v.peerCounts(b)
  const auto = b.auto || null // { way: idx, r }

  const rutas = []
  const planetas = ways.map((way) => {
    const destNode = world.nodes[way.to]
    const rutasWay = way.routes.map((route) => {
      const prev = v.prevision(b, way, route)
      const llegarE = b.e + prev.dE; const llegarP = b.p + prev.dP
      const item = {
        wayIdx: way.idx, r: route.r, routeIdx: route.idx, name: route.name, to: way.to, toName: destNode.name, toColor: destNode.color,
        theme: temaDe(way.theme), profile: route.profile,
        kinds: route.kinds.map((k) => ({ key: k, name: KINDS[k]?.name ?? k, emoji: KINDS[k]?.emoji ?? '•', risk: KINDS[k]?.risk ?? 0 })),
        length: route.length, dE: prev.dE, dP: prev.dP, duracion: prev.seg, llegarE, llegarP, muere: llegarE <= 0 || llegarP <= 0,
        eventos: route.segments.reduce((n, seg) => n + (seg.switches?.length || 0), 0),
        tramosConEvento: route.segments.filter((seg) => (seg.switches?.length || 0) > 0).length,
        vecesRecorrida: b.visitedRoutes?.[route.idx] || 0, peers: peers.byRoute.get(route.idx) || 0,
        esAuto: auto?.way === way.idx && auto?.r === route.r,
      }
      rutas.push(item)
      return item
    })
    const nota = (r) => (b.e < 45 ? r.dE * 2 + r.dP : r.dE + r.dP)
    let mejor = rutasWay[0]
    for (const r of rutasWay) if (nota(r) > nota(mejor)) mejor = r
    const destinos = destNode.destinos.map((d) => ({ idx: d.idx, name: d.name, kind: d.kind, dp: d.dp, de: d.de }))
    return {
      idx: way.to, wayIdx: way.idx, name: destNode.name, color: destNode.color, theme: temaDe(way.theme), destinos,
      maxDp: Math.max(0, ...destinos.map((d) => d.dp)), maxDe: Math.max(0, ...destinos.map((d) => d.de)),
      mejorRuta: mejor ? { r: mejor.r, name: mejor.name, dE: mejor.dE, dP: mejor.dP, duracion: mejor.duracion } : null,
      llegarE: mejor ? mejor.llegarE : b.e, llegarP: mejor ? mejor.llegarP : b.p, muere: mejor ? mejor.muere : false,
      peers: peers.byNode.get(way.to) || 0, visitado: b.visited?.includes(way.to) || false, esAuto: auto?.way === way.idx,
    }
  })

  // Ruta base de los 5 carriles: elegida > la del planeta elegido > automática > primera disponible.
  let rutaRef = null; let esElegida = false
  if (b.dec?.ruta) { rutaRef = world.ways[b.dec.ruta.way]?.routes[b.dec.ruta.r] || null; esElegida = !!rutaRef }
  if (!rutaRef && b.dec?.destino != null) {
    const w = ways.find((x) => x.to === b.dec.destino)
    if (w) rutaRef = auto && auto.way === w.idx ? w.routes[auto.r] : w.routes[0]
  }
  if (!rutaRef && auto) rutaRef = world.ways[auto.way]?.routes[auto.r] || null
  if (!rutaRef) rutaRef = ways[0]?.routes[0] || null

  const valentia = b.genome.traits.valentia ?? 0.5
  const carriles = Array.from({ length: CARRILES }, (_, c) => {
    let sw = null; let segSw = null
    if (rutaRef) {
      for (const seg of rutaRef.segments) {
        let cand = null
        for (const x of seg.switches || []) if (x.from === 0 && x.carril === c && (!cand || x.u < cand.u)) cand = x
        if (cand) { sw = cand; segSw = seg; break }
      }
    }
    return {
      carril: c, nombre: `Carril ${c + 1} de ${CARRILES}`,
      lado: c === 0 ? 'Borde izquierdo' : c === CARRILES - 1 ? 'Borde derecho' : c === 2 ? 'Centro' : c < 2 ? 'Izquierda' : 'Derecha',
      lat: carrilLat(c),
      evento: sw ? { kind: sw.kind, name: sw.name, emoji: sw.emoji, style: sw.style, segName: segSw?.name || '', segEmoji: segSw?.emoji || '', u: sw.u, reward: { ...sw.reward }, fail: sw.fail, risk: sw.risk } : null,
      probFallo: sw ? Math.max(0, Math.min(1, sw.fail * (1.25 - valentia * 0.5))) : 0,
      penalizacion: sw ? { velPct: 30, puntos: +(1 + 3 * sw.risk).toFixed(1) } : null,
      rutaBase: rutaRef ? {
        wayIdx: rutaRef.way, r: rutaRef.r, name: rutaRef.name, themeName: world.ways[rutaRef.way]?.theme?.name || '',
        toName: world.nodes[world.ways[rutaRef.way]?.to]?.name || '', esElegida,
      } : null,
    }
  })
  return { origen, planetas, rutas, carriles }
}
