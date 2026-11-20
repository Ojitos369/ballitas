// Implementación en memoria del contrato 2.4 (`mundo`) sobre Sim + SimMundo para probar P3 sin P1 ni P2.
import { Sim, TRAVEL_SLOW, nombreUnico } from '../../Core/sim.js'
import { CARRILES, KINDS, TRACK_K, carrilLat } from '../../Core/world.js'

// Constantes de sim.js (no exportadas en main antes de P1) para calcular previsiones según 3.5.
const DRAIN_E = 0.22
const DRAIN_P = 0.25
const TRAVEL_E_LEN = 0.0055 / TRACK_K
const PPS_K = 0.35 / 2.5
const TUBE_SPEED_K = 2.4

const MAX_SIN_DECIDIR = 3
const MAX_FILA = 30
const MAX_NOMBRE = 16

function leerOcrearId() {
  try {
    let id = localStorage.getItem('ballitas:espectador')
    if (!id) {
      id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `esp-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('ballitas:espectador', id)
    }
    return id
  } catch {
    return `esp-${Math.random().toString(36).slice(2)}`
  }
}

function hashCorto(str) {
  let h1 = 0xdeadbeef ^ str.length
  let h2 = 0x41c6ce57 ^ str.length
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  return (h1 >>> 0).toString(16).padStart(8, '0')
}

export function previsionRuta(sim, b, way, route) {
  const obs = route.segments.slice(1, -1)
  const velMedia = obs.reduce((s, o) => s + (o.speedK ?? 1), 0) / Math.max(1, obs.length)
  const eta = route.length / (sim.cruise(b) * TUBE_SPEED_K * velMedia + 8 * TRACK_K)
  const dE = -(eta * DRAIN_E + route.length * TRAVEL_E_LEN * way.theme.ecost)
  const dP = eta * (way.theme.pps * PPS_K - DRAIN_P)
  const duracion = eta / TRAVEL_SLOW
  return { eta, dE, dP, duracion }
}

class SimControl extends Sim {
  constructor(opts = {}) {
    super(opts)
    this.fila = []
    this._yoCorto = opts.yoCorto || 'yo000001'
    this._onEvent = opts.onEvent || (() => {})
    for (const b of this.ballitas) this._initControlFields(b)
  }

  _initControlFields(b) {
    b.ctrl = b.ctrl ?? null
    b.formadaPor = b.formadaPor ?? null
    b.dec = b.dec ?? {}
    b.sinDecidir = b.sinDecidir ?? 0
    b.viajeDecidido = false
    b.rutaFija = null
    b.carrilFijo = null
    b.mia = b.ctrl === this._yoCorto
    b.auto = this.predecir(b)
    b._autoAt = this.t
  }

  origenSiguiente(b) {
    if (!b) return 0
    return b.phase === 'toPort' || b.phase === 'travel' ? (b.way?.to ?? b.node) : b.node
  }

  predecir(b) {
    if (!b || b.phase === 'dying' || b.phase === 'gone') return null
    const origen = this.origenSiguiente(b)
    const ways = this.world.waysFrom[origen]
    if (!ways?.length) return null
    const peers = this.peerCounts(b)
    let best = null
    let bs = -Infinity
    for (const way of ways) {
      const dests = this.world.nodes[way.to]?.destinos || []
      for (const route of way.routes) {
        for (const nextDest of dests) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1, false)
          if (u.total > bs) {
            bs = u.total
            best = { way: way.idx, r: route.r }
          }
        }
      }
    }
    return best
  }

  formar(espectador, nombre) {
    if (this.fila.some((f) => f.espectador === espectador)) return { ok: false, error: 'ya_en_fila' }
    if (this.fila.length >= MAX_FILA) return { ok: false, error: 'fila_llena' }
    const limpio = String(nombre || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, MAX_NOMBRE)
    if (!limpio) return { ok: false, error: 'nombre' }
    this.fila.push({ espectador, nombre: limpio, t: this.t })
    this._onEvent('cambio')
    return { ok: true, puesto: this.fila.length }
  }

  salirFila(espectador) {
    const idx = this.fila.findIndex((f) => f.espectador === espectador)
    if (idx < 0) return { ok: false, error: 'no_en_fila' }
    this.fila.splice(idx, 1)
    this._onEvent('cambio')
    return { ok: true }
  }

  tomar(id, espectador) {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || b.phase === 'dying' || b.phase === 'gone') return { ok: false, error: 'no_existe' }
    if (b.ctrl) return { ok: false, error: 'ocupada' }
    if (this.ballitas.some((o) => o.ctrl === espectador && o.phase !== 'gone')) return { ok: false, error: 'ya_controlas' }
    b.ctrl = espectador
    b.mia = espectador === this._yoCorto
    b.sinDecidir = 0
    b.dec = {}
    b.auto = this.predecir(b)
    this._onEvent('cambio')
    return { ok: true }
  }

  dejar(id, espectador, motivo = 'dejar') {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || b.ctrl !== espectador) return { ok: false, error: 'no_controlas' }
    const eraMia = b.mia
    b.ctrl = null
    b.mia = false
    b.dec = {}
    b.sinDecidir = 0
    this._onEvent('libre', { b, motivo, mia: eraMia })
    this._onEvent('cambio')
    return { ok: true }
  }

  decidir(id, espectador, dec) {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || b.ctrl !== espectador) return { ok: false, error: 'no_controlas' }
    const origen = this.origenSiguiente(b)
    const n = { ...(b.dec || {}) }
    if ('destino' in dec) {
      if (dec.destino == null) delete n.destino
      else if (!this.world.waysFrom[origen].some((w) => w.to === dec.destino)) return { ok: false, error: 'destino' }
      else n.destino = dec.destino
    }
    if ('ruta' in dec) {
      if (dec.ruta == null) delete n.ruta
      else {
        const w = this.world.waysFrom[origen].find((x) => x.idx === dec.ruta.way)
        if (!w || !w.routes[dec.ruta.r]) return { ok: false, error: 'ruta' }
        n.ruta = { way: w.idx, r: dec.ruta.r }
        n.destino = w.to
      }
    }
    if ('carril' in dec) {
      if (dec.carril == null) delete n.carril
      else if (!Number.isInteger(dec.carril) || dec.carril < 0 || dec.carril >= CARRILES) return { ok: false, error: 'carril' }
      else n.carril = dec.carril
    }
    if (n.ruta && n.destino !== this.world.ways[n.ruta.way].to) delete n.ruta
    b.dec = n
    this._onEvent('cambio')
    return { ok: true, dec: { ...n } }
  }

  spawn() {
    const f = this.fila?.shift()
    const b = super.spawn()
    b.ctrl = null
    b.formadaPor = null
    b.dec = {}
    b.sinDecidir = 0
    b.viajeDecidido = false
    b.rutaFija = null
    b.carrilFijo = null
    b.mia = false
    if (f) {
      let n = f.nombre
      for (let i = 2; this.nombres.has(n); i++) n = `${f.nombre} ${i}`
      this.nombres.add(n)
      b.name = n
      b.formadaPor = f.espectador
      if (!this.ballitas.some((o) => o.ctrl === f.espectador && o.phase !== 'gone')) {
        b.ctrl = f.espectador
        b.mia = f.espectador === this._yoCorto
      }
      b.auto = this.predecir(b)
      this._onEvent('entra', { b, de: f.espectador, nombre: n, mia: f.espectador === this._yoCorto })
      this._onEvent('cambio')
    } else if (this.world) {
      b.auto = this.predecir(b)
    }
    return b
  }

  goWay(b) {
    const d = b.ctrl ? (b.dec || {}) : {}
    let ways = this.world.waysFrom[b.node]
    let ruta = null
    const usado = []
    if (d.ruta) {
      const w = ways.find((x) => x.idx === d.ruta.way)
      if (w?.routes[d.ruta.r]) {
        ways = [w]
        ruta = w.routes[d.ruta.r]
        usado.push('ruta', 'destino')
      }
    }
    if (!ruta && d.destino != null) {
      const w = ways.filter((x) => x.to === d.destino)
      if (w.length) {
        ways = w
        usado.push('destino')
      }
    }
    const peers = this.peerCounts(b)
    let best = null
    let bs = -Infinity
    for (const way of ways) {
      for (const route of ruta ? [ruta] : way.routes) {
        for (const nextDest of this.world.nodes[way.to].destinos) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1)
          if (u.total > bs) {
            bs = u.total
            best = { way, route, nextDest, razon: u.razon }
          }
        }
      }
    }
    b.way = best.way
    b.plannedRoute = best.route
    b.nextDest = best.nextDest
    b.rutaFija = ruta
    b.carrilFijo = d.carril ?? null
    if (d.carril != null) usado.push('carril')
    b.viajeDecidido = usado.length > 0
    b.dec = {}
    const destNode = this.world.nodes[best.way.to]
    b.plan = {
      destino: `${destNode.name} · ${best.nextDest.name}`,
      ruta: `${best.way.theme.name} · Ruta ${best.route.name}`,
      razon: usado.length ? 'lo decidió quien me controla' : best.razon,
      manual: usado,
    }
    this.walkTo(b, this.world.nodes[b.node].portTo[best.way.to].out, 'toPort')
    this.say(b, 'camino', { c: best.way.theme.name, n: destNode.name })
    b.auto = this.predecir(b)
    if (usado.length > 0 || b.ctrl) this._onEvent('cambio')
  }

  pickNext(b) {
    if (b.rutaFija) {
      const i = b.seg.next.find((j) => b.way.segments[j].route === b.rutaFija.r)
      if (i != null) return b.way.segments[i]
    }
    return super.pickNext(b)
  }

  enterSeg(b, seg) {
    const prev = b.phase === 'travel' ? b.seg : null
    super.enterSeg(b, seg)
    if (b.carrilFijo != null && (!prev || seg.route !== prev.route)) b.carril = b.carrilFijo
  }

  flightStep(b, s, dt) {
    super.flightStep(b, s, dt)
    if (!b.flight) b.carrilFijo = null
  }

  arrive(b) {
    if (b.ctrl) {
      const pendientes = Object.keys(b.dec || {}).length > 0
      if (b.viajeDecidido || pendientes) {
        if (b.sinDecidir !== 0) {
          b.sinDecidir = 0
          this._onEvent('cambio')
        }
      } else if (++b.sinDecidir >= MAX_SIN_DECIDIR) {
        this.dejar(b.id, b.ctrl, 'inactivo')
      } else {
        this._onEvent('cambio')
      }
    }
    b.viajeDecidido = false
    b.rutaFija = null
    b.carrilFijo = null
    super.arrive(b)
  }

  watch(b) {
    const estabaViva = b.phase !== 'dying' && b.phase !== 'gone'
    super.watch(b)
    if (estabaViva && b.phase === 'dying' && b.ctrl) {
      this.dejar(b.id, b.ctrl, 'muerte')
    }
  }

  tick(dt) {
    super.tick(dt)
    for (const b of this.ballitas) {
      if (this.t - (b._autoAt ?? -9) >= 1) {
        b.auto = this.predecir(b)
        b._autoAt = this.t
      }
    }
  }
}

/**
 * Calcula las opciones válidas y previsiones (sección 3.5) para la ballita `b` sin mutar estado.
 */
export function calcularOpciones(sim, b) {
  if (!sim || !b || b.phase === 'dying' || b.phase === 'gone') {
    return { origen: null, planetas: [], rutas: [], carriles: [] }
  }
  const world = sim.world
  const origen = sim.origenSiguiente(b)
  const ways = world.waysFrom[origen] || []
  const peers = sim.peerCounts(b)
  const auto = b.auto || sim.predecir(b)

  const rutas = []
  const planetas = ways.map((way) => {
    const destNode = world.nodes[way.to]
    const rutasWay = way.routes.map((route) => {
      const prev = previsionRuta(sim, b, way, route)
      const llegarE = b.e + prev.dE
      const llegarP = b.p + prev.dP
      const eventos = route.segments.reduce((sum, seg) => sum + (seg.switches?.length || 0), 0)
      const tramosConEvento = route.segments.filter((seg) => (seg.switches?.length || 0) > 0).length
      const item = {
        wayIdx: way.idx,
        r: route.r,
        routeIdx: route.idx,
        name: route.name,
        to: way.to,
        toName: destNode.name,
        toColor: destNode.color,
        theme: {
          id: way.theme.id,
          name: way.theme.name,
          emoji: way.theme.emoji,
          risk: way.theme.risk,
          ecost: way.theme.ecost,
          pps: way.theme.pps,
        },
        profile: route.profile,
        kinds: route.kinds.map((k) => ({
          key: k,
          name: KINDS[k]?.name ?? k,
          emoji: KINDS[k]?.emoji ?? '•',
          risk: KINDS[k]?.risk ?? 0,
        })),
        length: route.length,
        dE: prev.dE,
        dP: prev.dP,
        duracion: prev.duracion,
        llegarE,
        llegarP,
        muere: llegarE <= 0 || llegarP <= 0,
        eventos,
        tramosConEvento,
        vecesRecorrida: b.visitedRoutes?.[route.idx] || 0,
        peers: peers.byRoute.get(route.idx) || 0,
        esAuto: auto?.way === way.idx && auto?.r === route.r,
      }
      rutas.push(item)
      return item
    })

    let mejorRuta = rutasWay[0]
    for (const r of rutasWay) {
      const scoreR = (b.e < 45 ? r.dE * 2 + r.dP : r.dE + r.dP)
      const scoreBest = (b.e < 45 ? mejorRuta.dE * 2 + mejorRuta.dP : mejorRuta.dE + mejorRuta.dP)
      if (scoreR > scoreBest) mejorRuta = r
    }

    const destinos = destNode.destinos.map((d) => ({
      idx: d.idx,
      name: d.name,
      kind: d.kind,
      dp: d.dp,
      de: d.de,
    }))
    const maxDp = Math.max(0, ...destinos.map((d) => d.dp))
    const maxDe = Math.max(0, ...destinos.map((d) => d.de))

    return {
      idx: way.to,
      wayIdx: way.idx,
      name: destNode.name,
      color: destNode.color,
      theme: {
        id: way.theme.id,
        name: way.theme.name,
        emoji: way.theme.emoji,
        risk: way.theme.risk,
        ecost: way.theme.ecost,
        pps: way.theme.pps,
      },
      destinos,
      maxDp,
      maxDe,
      mejorRuta: mejorRuta
        ? {
            r: mejorRuta.r,
            name: mejorRuta.name,
            dE: mejorRuta.dE,
            dP: mejorRuta.dP,
            duracion: mejorRuta.duracion,
          }
        : null,
      llegarE: mejorRuta ? mejorRuta.llegarE : b.e,
      llegarP: mejorRuta ? mejorRuta.llegarP : b.p,
      muere: mejorRuta ? mejorRuta.muere : false,
      peers: peers.byNode.get(way.to) || 0,
      visitado: b.visited?.includes(way.to) || false,
      esAuto: auto?.way === way.idx,
    }
  })

  // Ruta base para calcular los 5 carriles: elegida > del planeta elegido > automática > primera disponible.
  let rutaRef = null
  let rutaRefEsElegida = false
  if (b.dec?.ruta) {
    rutaRef = world.ways[b.dec.ruta.way]?.routes[b.dec.ruta.r] || null
    rutaRefEsElegida = !!rutaRef
  }
  if (!rutaRef && b.dec?.destino != null) {
    const wayDest = ways.find((w) => w.to === b.dec.destino)
    if (wayDest) {
      if (auto && auto.way === wayDest.idx) rutaRef = wayDest.routes[auto.r]
      else rutaRef = wayDest.routes[0]
    }
  }
  if (!rutaRef && auto) {
    rutaRef = world.ways[auto.way]?.routes[auto.r] || null
  }
  if (!rutaRef) {
    rutaRef = ways[0]?.routes[0] || null
  }

  const valentia = b.genome?.traits?.valentia ?? 0.5
  const carriles = Array.from({ length: CARRILES }, (_, c) => {
    let primerSw = null
    let primerSeg = null
    if (rutaRef) {
      for (const seg of rutaRef.segments) {
        if (!seg.switches?.length) continue
        let cand = null
        for (const sw of seg.switches) {
          if (sw.from === 0 && sw.carril === c && (!cand || sw.u < cand.u)) cand = sw
        }
        if (cand) {
          primerSw = cand
          primerSeg = seg
          break
        }
      }
    }
    const probFallo = primerSw ? Math.max(0, Math.min(1, primerSw.fail * (1.25 - valentia * 0.5))) : 0
    return {
      carril: c,
      nombre: `Carril ${c + 1} de ${CARRILES}`,
      lado: c === 0 ? 'Borde izquierdo' : c === CARRILES - 1 ? 'Borde derecho' : c === 2 ? 'Centro' : c < 2 ? 'Izquierda' : 'Derecha',
      lat: carrilLat(c),
      evento: primerSw
        ? {
            kind: primerSw.kind,
            name: primerSw.name,
            emoji: primerSw.emoji,
            style: primerSw.style,
            segName: primerSeg?.name || '',
            segEmoji: primerSeg?.emoji || '',
            u: primerSw.u,
            reward: { ...primerSw.reward },
            fail: primerSw.fail,
            risk: primerSw.risk,
          }
        : null,
      probFallo,
      penalizacion: primerSw ? { velPct: 30, puntos: +(1 + 3 * primerSw.risk).toFixed(1) } : null,
      rutaBase: rutaRef
        ? {
            wayIdx: rutaRef.way,
            r: rutaRef.r,
            name: rutaRef.name,
            themeName: world.ways[rutaRef.way]?.theme?.name || '',
            toName: world.nodes[world.ways[rutaRef.way]?.to]?.name || '',
            esElegida: rutaRefEsElegida,
          }
        : null,
    }
  })

  return { origen, planetas, rutas, carriles }
}

/**
 * Crea un `mundo` en memoria que implementa el contrato 2.4 para desarrollo y pruebas de P3.
 */
export function crearMundoFalso({ semilla = 369, conRelleno = true } = {}) {
  const idSecreto = leerOcrearId()
  const yoCorto = hashCorto(idSecreto)
  const listeners = { cambio: new Set(), entra: new Set(), libre: new Set() }

  const emit = (ev, payload) => {
    const set = listeners[ev]
    if (!set) return
    for (const fn of [...set]) {
      try { fn(payload) } catch {}
    }
  }

  const sim = new SimControl({ seed: semilla, yoCorto, onEvent: emit })

  // Opcional: poblar la demo con una ballita controlada por otro espectador y un espectador en la fila
  // para poder observar estados compartidos desde el segundo 0.
  if (conRelleno && sim.ballitas.length >= 2) {
    sim.tomar(sim.ballitas[1].id, 'peer9f2a')
    sim.formar('peer4c10', 'Cometa')
  }

  const mundo = {
    get world() { return sim.world },
    get ballitas() { return sim.ballitas },
    get t() { return sim.t },
    get stats() { return sim.stats },
    get feed() { return sim.feed },
    get seed() { return sim.seed },
    get pop() { return sim.pop },
    get rng() { return sim.rng },
    tick(dt) { sim.tick(dt) },
    where(b) { return sim.where(b) },
    favorites(b) { return sim.favorites(b) },
    probWays(b, node) { return sim.probWays(b, node) },

    modo: 'local',
    estado: 'listo',
    yo: { corto: yoCorto },
    get fila() {
      return sim.fila.map((f) => ({
        nombre: f.nombre,
        de: f.espectador,
        t: f.t,
        mia: f.espectador === yoCorto,
      }))
    },
    espectadores: conRelleno ? 3 : 1,
    reglas: { maxSinDecidir: MAX_SIN_DECIDIR, maxFila: MAX_FILA, maxNombre: MAX_NOMBRE },
    puede: { velocidad: true },

    nombreSugerido() {
      const usados = new Set(sim.ballitas.map((b) => b.name))
      for (const f of sim.fila) usados.add(f.nombre)
      return nombreUnico(Math.random, usados)
    },
    async formar(nombre) {
      return sim.formar(yoCorto, nombre)
    },
    async salirFila() {
      return sim.salirFila(yoCorto)
    },
    async tomar(b) {
      const id = typeof b === 'number' ? b : b?.id
      return sim.tomar(id, yoCorto)
    },
    async dejar(b) {
      const id = typeof b === 'number' ? b : b?.id
      return sim.dejar(id, yoCorto, 'dejar')
    },
    async decidir(b, dec) {
      const id = typeof b === 'number' ? b : b?.id
      return sim.decidir(id, yoCorto, dec)
    },
    opciones(b) {
      return calcularOpciones(sim, b)
    },
    on(evento, fn) {
      if (!listeners[evento]) listeners[evento] = new Set()
      listeners[evento].add(fn)
      return () => listeners[evento].delete(fn)
    },
    cerrar() {
      for (const s of Object.values(listeners)) s.clear()
    },

    // Auxiliar solo para demo/pruebas en `control.html` (simula muerte para ver entrada inmediata de la fila).
    _sim: sim,
  }

  return mundo
}
