// Simulación de ballitas: genoma, decisiones, vida/muerte y evolución genética.
// Sin React ni render: la UI sólo lee `sim.ballitas` y llama `sim.tick(dt)`.
//
// ═══════════════════════════ CONTRATO: BALLITA ═══════════════════════════
// (la forma del mundo y WORLD_SCALE/TUBE_SCALE están al inicio de world.js)
// Escala temporal:
//   TIME_SCALE (4.5): factor objetivo de duración real de viaje (antes 2.5; ver TRAVEL_SLOW). Factor de duración de viaje por circuito (~2-3x más tiempo para
//                     disfrutar cada tramo). Los costos por segundo (DRAIN_E, DRAIN_P, PPS_K) y por
//                     unidad de longitud (TRAVEL_E_LEN), así como FRIC/VMAX, están calibrados para
//                     caminos largos sin agotar energía ni romper la selección natural.
// b = {
//   id, name, gen, arch { key, hi, title }, genome, p, e (0..100), age, visits, score, cause, bornAt,
//   genome: { traits { valentia, curiosidad, apetito, sociabilidad, animo, velocidad }, hue,
//             prefs[destino.idx], ways[way.idx], routes[route.idx], kinds[índice en OBSTACLES] }  (todo 0..1)
//   pos, dir, up: THREE.Vector3 siempre válidos. En la ciudad `up` es la normal de la esfera; en un tubo
//                 apunta de la pared al eje (la ballita rueda PEGADA a la pared por su carril: su gravedad
//                 es hacia esa pared, sea suelo, pared o techo).
//   phase, timer (segundos restantes estimados), dur (duración estimada de la fase)
//   speed: velocidad actual (unidades/s); roll: ángulo (rad) entre su pared y el suelo del mundo, 0 = abajo;
//   Carriles (ver world.js): lane (id del carril en seg.lanes), ang (ángulo actual alrededor del eje, continuo),
//     off (distancia actual al eje; radius - BALL_R pegada a la pared, menor al volar por el interior),
//     rail (distancia de reposo, se acerca a radius - BALL_R o a 0 en tramos `air`),
//     carril (0..CARRILES-1): carril lateral dentro del camino; se sortea al entrar a una ruta y al aterrizar de un evento;
//       sólo toma los eventos (seg.switches) con sw.carril === carril. Su línea de carrera es carrilLat(carril).
//     sw: evento en curso o null = { s (switch de seg.switches), t, dur, style, fail, failed };
//     flight { sw, t (0..1), dur, from, to, failed }: recorre switchPath(seg, sw, t); vis (0..1) la oculta en un portal,
//     mechs { [kind]: veces usado }. Posición = wallFrame(seg, ang, segT, off).pos;
//   Contacto con la pista (para animar al chibi: aplastar al aterrizar, estirar en el aire...):
//     hy: altura sobre su pared hacia el eje (= laneRelief si va apoyada; off = rail - hy); vy: su velocidad,
//     airborne: true si vuela (tras una cresta/rampa, o por un tramo `air`); cae hacia su pared con G_WALL
//       y al aterrizar rebota amortiguado (BOUNCE) si el golpe es fuerte,
//     impact (0..1): fuerza del último golpe (aterrizaje o borde del carril); decae ~3/s,
//     slope: componente vertical (mundo) de la tangente real de la pista (>0 sube: frena; <0 baja: acelera),
//     lat (u): desvío lateral dentro del carril (la curva la empuja hacia fuera; nunca pasa de width/2),
//     latV su velocidad, edge (-1|0|1): roza un borde del carril, onLane: sigue su carril (no transita a otro).
//
//   mood, thought { text, emoji, until }, react, log[], flags
//   visitedRoutes { [route.idx]: count }, plannedRoute, plan { destino, ruta, razon }
//   Dónde está / a dónde va (lo que no aplica vale null):
//     node:  nodo en el que está (durante el viaje, el de origen)   vert: vértice de la ciudad
//     dest:  destino elegido en el nodo
//     way:   sentido de circuito elegido (way.to = nodo al que va; way.circuit, way.theme)
//     route: última ruta elegida dentro del way      seg: tramo/obstáculo actual      segT: avance 0..1
// }
// Fases:
//   born    recién nacida, quieta en un cruce de la ciudad
//   toDest  va por carretera hasta `dest`
//   at      usando el destino (ya aplicó dp/de)
//   toPort  va por carretera al puerto de salida hacia `way.to`
//   travel  dentro del circuito `way`, en el tramo `seg`
//   dying   animación de muerte          gone  se elimina de `sim.ballitas` en este mismo tick
// sim = { world, ballitas[], t, stats { nacidas, muertas, mejorEdad, genMax }, feed[] { t, text }, pool[] }
// sim.tick(dt), sim.favorites(b) -> { destino, way, route, kind }, sim.where(b) -> texto para el panel.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import {
  buildWorld, cityPath, slerpDir, NODE_R, BALL_R, TRACK_K, SIZE_K, LANE_W, OBSTACLES, KINDS,
  wallFrame, laneFrame, laneLength, switchPath, laneAngle, nearestLane, lowestLane, angDiff,
  segmentTangent, laneRelief, reliefSlope, segmentCurvature, CARRILES, carrilLat,
} from './world.js'
import { voice, moodOf, archetype } from './personality.js'

export const POP = 10
export const TIME_SCALE = 4.5
// El viaje por tubos corre en cámara lenta: física, drenajes y mecanismos avanzan TRAVEL_SLOW s por segundo real,
// así el equilibrio (energía/puntos por tramo) queda igual que con la escala 2.5 calibrada.
export const TRAVEL_SLOW = 2.5 / TIME_SCALE
const TRAITS = ['valentia', 'curiosidad', 'apetito', 'sociabilidad', 'animo', 'velocidad']
const GENES = ['prefs', 'ways', 'routes', 'kinds']
// Equilibrio: un ciclo destino + viaje dura ~60-65 s (el viaje ~2.5x más largo) y sólo rinde un destino.
export const DRAIN_E = 0.22 // energía/s siempre
export const DRAIN_P = 0.25 // puntos/s siempre
// Mundo compartido (docs/mundo_compartido.md, sección 3): control de ballitas por espectadores.
export const MAX_SIN_DECIDIR = 3 // llegadas seguidas sin decisión antes de perder el control
export const MAX_FILA = 30
export const MAX_NOMBRE = 16
export const GRACIA_DESCONEXION = 60 // s; la aplica el servidor (la sim no sabe de conexiones)
export const MAX_CONTROL_POR_ESPECTADOR = 1
export const MAX_FILA_POR_ESPECTADOR = 1
// Limpia un nombre propuesto: letras, números, espacio, _ y -; '' si no queda nada.
export const limpiarNombre = (nombre) => String(nombre ?? '').replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE).trim()
export const TRAVEL_E_LEN = 0.0055 / TRACK_K // energía por unidad de distancia recorrida en tubo (× ecost del tema); el trazado mide TRACK_K veces más
export const PPS_K = 0.35 / 2.5 // escala de los puntos/s del tema
const MAP_SPEED_K = (SIZE_K / 2.5) * 1.42 * 1.14 // SIZE_K ya lleva ANCHO_K (1.52); 1.14 = el extra de `spread` de las rutas en world.js (los viajes duraban 142.6 s; meta: la duración de main) // compensa la ampliación de arcos, alturas y desvíos de rutas
// Física del tubo. Distancias, velocidades y aceleraciones escalan con el trazado (TRACK_K): mismos tiempos de carrera.
export const TUBE_SPEED_K = 2.4 // escala la velocidad base dentro de los tubos largos (~900u)
const GRAV = 24 * TRACK_K
const FRIC = 0.14
const VMAX = 48 * TRACK_K * MAP_SPEED_K
const LANE_EASE = 3.5 // rapidez con la que la ballita sigue el vaivén de su carril
const RAIL_EASE = 6 // rapidez con la que se pega a la pared (o se separa en el aire)
const G_WALL = 24 * TRACK_K // gravedad hacia la pared del carril: tras una cresta la ballita vuela y cae a su pista
const BOUNCE = 0.35 // restitución al aterrizar (rebote amortiguado)
const LAT_K = 30 // el carril es una canaleta: muelle que la devuelve al centro
const LAT_C = 7 // amortiguación lateral
const LAT_EDGE = 0.4 // restitución al chocar con el borde del carril
const RACE_GAP = 2.5 // (u de avance) vecinas a menos de esto en el mismo carril: la de atrás se abre para adelantar
const WOW = ['canon', 'trampolin', 'rizo', 'caida', 'embudo', 'geiser', 'erupcion', 'turbina', 'hielo_resbaloso', 'pantano', 'portal', 'cascada'] // obstáculos que merecen comentario
const FALLBACK_VOICES = {
  geiser: ['¡Al chorro del géiser!', '¡Arriba voy!'],
  erupcion: ['¡Erupción! ¡A volar!', '¡El cráter me lanza!'],
  turbina: ['¡Viento de lado!', '¡Qué impulso!'],
  hielo_resbaloso: ['¡Qué rápido patina!', '¡A toda velocidad!'],
  pantano: ['Uy, qué pegajoso…', 'Me frena el pantano…'],
  portal: ['¡Salto espacial!', '¡Teletransporte!'],
  cascada: ['¡Por la cascada!', '¡Agua va!'],
  carril: ['¡Cambio de carril!', '¡Por la pared!', '¡A la otra pared!', '¡Al techo!'],
  falla: ['¡Uy, me caí!', '¡Fallé el salto!', '¡Al suelo otra vez!'],
}
const Y = new THREE.Vector3(0, 1, 0)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const mean = (arr, f) => arr.reduce((s, x) => s + f(x), 0) / arr.length
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
const tmp3 = new THREE.Vector3()
// acerca v a un objetivo unitario sin pasar por el vector nulo
const ease = (v, target, k) => { v.lerp(target, k); if (v.lengthSq() < 1e-6) v.copy(target); return v.normalize() }

export function randomGenome(world, rng) {
  const traits = {}
  TRAITS.forEach((k) => { traits[k] = rng() })
  return {
    traits,
    hue: rng(),
    prefs: world.destinos.map(() => rng()),
    ways: world.ways.map(() => rng()),
    routes: world.routes.map(() => rng()),
    kinds: OBSTACLES.map(() => rng()),
  }
}

// Cruce uniforme gen a gen + mutación gaussiana aproximada.
export function breed(a, b, rng, rate = 0.15) {
  const pick = (x, y) => (rng() < 0.5 ? x : y)
  const mut = (v) => (rng() < rate ? clamp(v + (rng() + rng() + rng() - 1.5) * 0.5, 0, 1) : v)
  const child = { traits: {}, hue: (mut(pick(a.hue, b.hue)) + 1) % 1 }
  TRAITS.forEach((k) => { child.traits[k] = mut(pick(a.traits[k], b.traits[k])) })
  GENES.forEach((k) => { child[k] = a[k].map((v, i) => mut(pick(v, b[k][i]))) })
  return child
}

// Nombres de sílabas al azar (inicio + medio opcional + final), sin repetir en toda la simulación.
const SIL_INI = ['Pe', 'Mo', 'Ca', 'Ta', 'Chi', 'Nu', 'Go', 'Bu', 'Pi', 'Mi', 'Fre', 'O', 'Tru', 'Ki', 'Lu', 'Ru', 'Bi', 'Ga', 'Zu', 'Ñe', 'Bo', 'Che', 'Fi', 'La']
const SIL_MED = ['', '', 'lu', 'ti', 'ra', 'pi', 'ne', 'mo', 'ca', 'si', 'li', 'ru']
const SIL_FIN = ['sa', 'ti', 'ca', 'pa', 'ba', 'to', 'lla', 'chi', 'na', 'jo', 'ki', 'ña', 'rí', 'lín', 'tón', 'mi']

export function nombreUnico(rng, usados) {
  const p = (a) => a[Math.floor(rng() * a.length)]
  for (let i = 0; ; i++) {
    const n = p(SIL_INI) + p(SIL_MED) + p(SIL_FIN) + (i > 50 ? p(SIL_FIN) : '') // tras muchos choques, una sílaba más
    if (!usados.has(n)) { usados.add(n); return n }
  }
}

export class Sim {
  constructor({ rng = Math.random, pop = POP, seed } = {}) {
    this.rng = rng
    this.world = buildWorld(seed)
    this.seed = seed ?? 369 // misma semilla por defecto que buildWorld; se registra en el back
    // { nace(b), muere(b), entra(b, espectador), libre(b, motivo), decide(b, dec) }: observadores opcionales; no afectan a la sim
    this.hooks = {}
    this.fila = [] // { espectador, nombre, t }: ballitas formadas que esperan a que muera otra (FIFO)
    this.pop = pop
    this.t = 0
    this.nextId = 1
    this.ballitas = []
    this.pool = [] // muertas con su genoma: base de la selección
    this.spawnQueue = []
    this.stats = { nacidas: 0, muertas: 0, mejorEdad: 0, genMax: 1 }
    this.feed = [] // eventos globales recientes
    this.nombres = new Set() // nombres ya usados: nunca se repiten
    for (let i = 0; i < pop; i++) this.spawn()
  }

  genomeForNewborn() {
    const { pool, rng } = this
    if (pool.length < 3 || rng() < 0.1) return { genome: randomGenome(this.world, rng), gen: 1, padres: [] } // inmigrante
    const tour = () => {
      let best = null
      for (let i = 0; i < 3; i++) {
        const c = pool[Math.floor(rng() * pool.length)]
        if (!best || c.fitness > best.fitness) best = c
      }
      return best
    }
    const a = tour(); const b = tour()
    return { genome: breed(a.genome, b.genome, rng), gen: Math.max(a.gen, b.gen) + 1, padres: [a.id, b.id] }
  }

  spawn() {
    const { genome, gen, padres } = this.genomeForNewborn()
    const node = this.world.nodes[Math.floor(this.rng() * this.world.nodes.length)]
    const vert = Math.floor(this.rng() * node.verts.length)
    const up = node.verts[vert].dir.clone()
    // la primera de la fila entra ANTES de generar el nombre (say('nace') y hooks.nace ven el nombre real)
    const f = this.fila.length ? this.fila.shift() : null
    let name
    if (f) {
      name = f.nombre
      for (let i = 2; this.nombres.has(name) || this.ballitas.some((o) => o.name === name); i++) name = `${f.nombre} ${i}`
      this.nombres.add(name)
    } else name = `${nombreUnico(this.rng, this.nombres)} ${gen > 1 ? 'G' + gen : ''}`.trim()
    const b = {
      id: this.nextId++, gen, genome, padres, node: node.idx, vert, p: 60, e: 60, age: 0, visits: 0, score: 0,
      name,
      // control (mundo compartido): quién la controla, quién la formó y sus decisiones «para la siguiente»
      ctrl: f && this.controladas(f.espectador) < MAX_CONTROL_POR_ESPECTADOR ? f.espectador : null,
      formadaPor: f ? f.espectador : null, dec: {}, sinDecidir: 0, viajeDecidido: false, rutaFija: null, carrilFijo: null,
      phase: 'born', timer: 0.8, dur: 0.8, bornAt: this.t,
      dest: null, way: null, route: null, seg: null, segT: 0, walk: null,
      visited: [node.idx], visitedRoutes: {}, plannedRoute: null, nextDest: null, plan: null,
      log: [], flags: {},
      pos: node.pos.clone().addScaledVector(up, NODE_R + BALL_R),
      dir: new THREE.Vector3().crossVectors(up, Math.abs(up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : Y).normalize(), up,
      // estado del balanceo en el tubo: `wall` va del eje a la ballita, `off` es su distancia al eje
      wall: up.clone().negate(), off: 0, rail: 0, roll: 0, snap: 0,
      lane: 0, carril: 0, ang: 0, sw: null, mechs: {}, vis: 1,
      hy: 0, vy: 0, airborne: false, flight: null, impact: 0, slope: 0, lat: 0, latV: 0, edge: 0, onLane: true,
      thought: null, react: null, mood: 'feliz', speed: 0, cause: null,
    }
    b.arch = archetype(genome)
    this.ballitas.push(b)
    this.stats.nacidas++
    this.stats.genMax = Math.max(this.stats.genMax, gen)
    this.say(b, 'nace')
    this.hooks.nace?.(b)
    if (f) this.hooks.entra?.(b, f.espectador)
    return b
  }

  // ───────────── mundo compartido: fila, control y decisiones (docs/mundo_compartido.md, secciones 3 y 4) ─────────────
  viva(id) { const b = this.ballitas.find((o) => o.id === id); return b && b.phase !== 'dying' && b.phase !== 'gone' ? b : null }
  controladas(espectador) { let n = 0; for (const o of this.ballitas) if (o.ctrl === espectador) n++; return n }

  formar(espectador, nombre) {
    if (this.fila.filter((f) => f.espectador === espectador).length >= MAX_FILA_POR_ESPECTADOR) return { ok: false, error: 'ya_en_fila' }
    const limpio = limpiarNombre(nombre)
    if (!limpio) return { ok: false, error: 'nombre' }
    if (this.fila.length >= MAX_FILA) return { ok: false, error: 'fila_llena' }
    this.fila.push({ espectador, nombre: limpio, t: this.t })
    return { ok: true, puesto: this.fila.length }
  }

  salirFila(espectador) {
    const n = this.fila.length
    this.fila = this.fila.filter((f) => f.espectador !== espectador)
    return { ok: true, quitadas: n - this.fila.length }
  }

  tomar(id, espectador) {
    const b = this.viva(id)
    if (!b) return { ok: false, error: 'no_existe' }
    if (b.ctrl) return { ok: false, error: b.ctrl === espectador ? 'ya_controlas' : 'ocupada' }
    if (this.controladas(espectador) >= MAX_CONTROL_POR_ESPECTADOR) return { ok: false, error: 'ya_controlas' }
    b.ctrl = espectador; b.sinDecidir = 0; b.dec = {}
    this.hooks.entra?.(b, espectador)
    return { ok: true }
  }

  dejar(id, espectador, motivo = 'dejar') {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || !b.ctrl || b.ctrl !== espectador) return { ok: false, error: 'no_controlas' }
    b.ctrl = null; b.dec = {}; b.sinDecidir = 0
    this.hooks.libre?.(b, motivo)
    return { ok: true }
  }

  // Nodo desde el que saldrá el siguiente viaje: el actual, o el de llegada si ya va de camino.
  origenSiguiente(b) { return (b.phase === 'toPort' || b.phase === 'travel') && b.way ? b.way.to : b.node }

  // dec = { destino?: idx de nodo | null, ruta?: { way, r } | null, carril?: 0..4 | null }; null borra; lo ausente no cambia.
  decidir(id, espectador, dec) {
    const b = this.viva(id)
    if (!b || !b.ctrl || b.ctrl !== espectador) return { ok: false, error: 'no_controlas' }
    const ways = this.world.waysFrom[this.origenSiguiente(b)]
    const n = { ...b.dec }
    if (dec && 'destino' in dec) {
      if (dec.destino == null) { delete n.destino; delete n.ruta }
      else if (!ways.some((w) => w.to === dec.destino)) return { ok: false, error: 'destino' }
      else n.destino = dec.destino
    }
    if (dec && 'ruta' in dec) {
      if (dec.ruta == null) delete n.ruta
      else {
        const w = typeof dec.ruta === 'object' ? ways.find((x) => x.idx === dec.ruta.way) : null
        if (!w || !Number.isInteger(dec.ruta.r) || !w.routes[dec.ruta.r]) return { ok: false, error: 'ruta' }
        n.ruta = { way: w.idx, r: dec.ruta.r }; n.destino = w.to // elegir ruta fija también el planeta
      }
    }
    if (dec && 'carril' in dec) {
      if (dec.carril == null) delete n.carril
      else if (!Number.isInteger(dec.carril) || dec.carril < 0 || dec.carril >= CARRILES) return { ok: false, error: 'carril' }
      else n.carril = dec.carril
    }
    if (n.ruta && n.destino !== this.world.ways[n.ruta.way].to) delete n.ruta // cambió el planeta: la ruta ya no aplica
    b.dec = n
    this.hooks.decide?.(b, n)
    return { ok: true, dec: { ...n } }
  }

  // Sentidos y ruta que admite el siguiente viaje desde `nodo` según las decisiones `d` (lo que no vale se ignora).
  restringir(nodo, d) {
    let ways = this.world.waysFrom[nodo]; let ruta = null; const usado = []
    if (d.ruta) {
      const w = ways.find((x) => x.idx === d.ruta.way)
      if (w?.routes[d.ruta.r]) { ways = [w]; ruta = w.routes[d.ruta.r]; usado.push('destino', 'ruta') }
    }
    if (!ruta && d.destino != null) {
      const w = ways.filter((x) => x.to === d.destino)
      if (w.length) { ways = w; usado.push('destino') }
    }
    return { ways, ruta, usado }
  }

  // Decisión automática que tomaría hoy la sim para el siguiente viaje, con las decisiones pendientes aplicadas.
  // Sin ruido y sin consumir la rng (como probWays): la elección real ocurre en goWay y puede diferir.
  predecir(b) {
    if (b.phase === 'dying' || b.phase === 'gone') return null
    const { ways, ruta } = this.restringir(this.origenSiguiente(b), b.ctrl ? b.dec : {})
    const peers = this.peerCounts(b)
    let best = null; let bs = -Infinity
    for (const way of ways) {
      for (const route of ruta ? [ruta] : way.routes) {
        for (const nextDest of this.world.nodes[way.to].destinos) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1, false).total
          if (u > bs) { bs = u; best = { way, route } }
        }
      }
    }
    return best
  }

  // Previsión de un viaje (fórmulas de planUtility): duración real en s, y cambio de energía y puntos.
  prevision(b, way, route) {
    const obs = route.segments.slice(1, -1)
    const vel = obs.reduce((s, o) => s + (o.speedK ?? 1), 0) / Math.max(1, obs.length)
    const eta = route.length / (this.cruise(b) * TUBE_SPEED_K * vel + 8 * TRACK_K)
    return { seg: eta / TRAVEL_SLOW, dE: -(eta * DRAIN_E + route.length * TRAVEL_E_LEN * way.theme.ecost), dP: eta * (way.theme.pps * PPS_K - DRAIN_P) }
  }

  say(b, event, ctx = {}) {
    let v
    try {
      v = voice(b, event, ctx, this.rng)
    } catch {
      const fb = FALLBACK_VOICES[event] || ['¡Guau!']
      v = { text: fb[Math.floor(this.rng() * fb.length)], emoji: KINDS[event]?.emoji || '✨' }
    }
    b.thought = { ...v, until: this.t + 3.5 }
    b.log.unshift({ t: Math.round(b.age), ...v })
    if (b.log.length > 30) b.log.pop()
  }

  tick(dt) {
    this.t += dt
    // ballitas por tramo (para su línea de carrera: adelantar y separarse de las vecinas)
    const near = this._near || (this._near = new Map()); near.clear()
    for (const b of this.ballitas) if (b.phase === 'travel' && b.seg) { let l = near.get(b.seg); if (!l) near.set(b.seg, l = []); l.push(b) }
    for (const b of this.ballitas) this.step(b, dt)
    for (let i = this.ballitas.length - 1; i >= 0; i--) {
      if (this.ballitas[i].phase === 'gone') this.ballitas.splice(i, 1)
    }
    // reaparece una nueva por cada muerta, tras un respiro
    while (this.ballitas.length + this.spawnQueue.length < this.pop) this.spawnQueue.push(this.t + 1.5)
    this.spawnQueue = this.spawnQueue.filter((at) => (at <= this.t ? (this.spawn(), false) : true))
  }

  step(b, dt) {
    if (b.phase === 'dying') {
      b.timer -= dt
      if (b.timer <= 0) b.phase = 'gone'
      return
    }
    b.age += dt
    const sd = b.phase === 'travel' ? dt * TRAVEL_SLOW : dt // tiempo de simulación del viaje
    b.e -= DRAIN_E * sd
    b.p -= DRAIN_P * sd
    b.timer = Math.max(0, b.timer - dt)
    if (b.react && b.react.until < this.t) b.react = null

    switch (b.phase) {
      case 'born':
        if (b.timer <= 0) this.goDest(b)
        break
      case 'toDest':
        if (this.walkStep(b, dt)) this.arriveDest(b)
        break
      case 'at':
        if (b.timer <= 0) this.goWay(b)
        break
      case 'toPort':
        if (this.walkStep(b, dt)) this.enterSeg(b, b.way.segments[0])
        break
      case 'travel':
        this.travelStep(b, sd)
        break
    }
    b.p = clamp(b.p, 0, 100); b.e = clamp(b.e, 0, 100)
    this.watch(b)
  }

  watch(b) {
    if (b.e <= 0 || b.p <= 0) {
      b.cause = b.e <= 0 ? 'energía' : 'puntos'
      this.say(b, 'muere')
      b.phase = 'dying'; b.timer = 1.4; b.speed = 0
      b.mood = 'asustada'
      this.pool.push({ id: b.id, genome: b.genome, gen: b.gen, fitness: b.age + b.score * 0.2 })
      this.pool.sort((x, y) => y.fitness - x.fitness)
      this.pool.length = Math.min(this.pool.length, 24)
      this.stats.muertas++
      if (b.ctrl) { b.ctrl = null; b.dec = {}; this.hooks.libre?.(b, 'muerte') } // al morir se acaba el control
      this.hooks.muere?.(b)
      this.stats.mejorEdad = Math.max(this.stats.mejorEdad, b.age)
      this.feed.unshift({ t: this.t, text: `${b.name} murió por falta de ${b.cause} (${Math.round(b.age)}s)` })
      this.feed.length = Math.min(this.feed.length, 8)
      return
    }
    if (b.e < 25 && !b.flags.hambre) { b.flags.hambre = true; this.say(b, 'hambre') }
    if (b.e > 40) b.flags.hambre = false
    if (b.p < 25 && !b.flags.miedo) { b.flags.miedo = true; this.say(b, 'miedo') }
    if (b.p > 40) b.flags.miedo = false
    b.mood = b.react ? b.react.mood : moodOf(b)
  }

  // Coloca la ballita. Tras un cambio de fase (`snap`) la posición se funde en vez de saltar.
  place(b, P, T, U, dt) {
    if (b.snap > 0) b.snap -= dt
    if (b.snap > 0) b.pos.lerp(P, Math.min(1, dt * 12)); else b.pos.copy(P)
    const k = Math.min(1, dt * 10)
    ease(b.dir, T, k); ease(b.up, U, k)
  }

  // ───────────── ciudad: caminar por las carreteras de la esfera ─────────────
  cruise(b) { return (4 + b.genome.traits.velocidad * 3) * TRACK_K * MAP_SPEED_K }

  walkTo(b, vert, phase) {
    const node = this.world.nodes[b.node]
    const path = cityPath(node, b.vert, vert)
    let len = 0
    for (let i = 1; i < path.length; i++) len += node.verts[path[i - 1]].dir.angleTo(node.verts[path[i]].dir) * NODE_R
    b.walk = { path, i: 0, t: 0 }
    b.phase = phase; b.speed = this.cruise(b); b.snap = 0.3
    b.dur = b.timer = len / b.speed
  }

  // Avanza por el camino; devuelve true al llegar al último vértice.
  walkStep(b, dt) {
    const node = this.world.nodes[b.node]; const w = b.walk; const last = w.path.length - 1
    let d = b.speed * dt
    while (w.i < last) {
      const len = node.verts[w.path[w.i]].dir.angleTo(node.verts[w.path[w.i + 1]].dir) * NODE_R
      const left = (1 - w.t) * len
      if (d < left) { w.t += d / len; break }
      d -= left; w.i++; w.t = 0
    }
    if (w.i >= last) {
      const v = node.verts[b.vert = w.path[last]]
      b.pos.copy(node.pos).addScaledVector(v.dir, NODE_R + BALL_R); b.up.copy(v.dir); b.speed = 0
      return true
    }
    const A = node.verts[w.path[w.i]].dir; const B = node.verts[w.path[w.i + 1]].dir
    const n = slerpDir(A, B, w.t, tmp).normalize()
    const T = tmp2.copy(B).addScaledVector(n, -B.dot(n)).normalize()
    b.vert = w.path[w.i]
    this.place(b, new THREE.Vector3().copy(node.pos).addScaledVector(n, NODE_R + BALL_R), T, n, dt)
    return false
  }

  goDest(b) {
    const g = b.genome; const t = g.traits
    const destinos = this.world.nodes[b.node].destinos
    const viable = destinos.filter((s) => {
      const path = cityPath(this.world.nodes[b.node], b.vert, s.vert)
      let distance = 0
      for (let i = 1; i < path.length; i++) {
        distance += this.world.nodes[b.node].verts[path[i - 1]].dir.angleTo(this.world.nodes[b.node].verts[path[i]].dir) * NODE_R
      }
      const time = distance / this.cruise(b)
      return b.e - DRAIN_E * time + s.de > 0 && b.p - DRAIN_P * time + s.dp > 0
    })
    const options = viable.length ? viable : destinos
    let best = null; let bs = -Infinity
    for (const s of options) {
      const gain = (s.dp * (1 - b.p / 100) + s.de * (1 - b.e / 100)) / 20
      const sc = g.prefs[s.idx] * 0.8 + t.apetito * gain * 3 + this.rng() * (0.2 + t.curiosidad) * 0.9
      if (sc > bs) { bs = sc; best = s }
    }
    b.dest = best; b.way = b.route = b.seg = b.plannedRoute = null
    b.plan = {
      destino: best.name,
      ruta: this.world.nodes[b.node].name,
      razon: best.kind === 'energia' && b.e < 55 ? 'busco energía' : 'quiero puntos',
    }
    this.walkTo(b, best.vert, 'toDest')
  }

  arriveDest(b) {
    const s = b.dest
    b.p += s.dp; b.e += s.de
    b.score += Math.max(0, s.dp)
    b.visits++
    const win = s.kind === 'puntos'
    b.react = { mood: win ? 'euforica' : 'feliz', until: this.t + 1.2 }
    this.say(b, win ? 'ganaP' : 'ganaE', { s: s.name })
    b.phase = 'at'; b.dur = b.timer = 1.5 + (1 - b.genome.traits.apetito) * 1.5
  }

  // Conteo de compañeras por way, ruta y nodo para evaluar sociabilidad.
  peerCounts(self) {
    const byWay = new Map(); const byRoute = new Map(); const byNode = new Map()
    for (const o of this.ballitas) {
      if (o === self || o.phase === 'dying' || o.phase === 'gone') continue
      if (o.way) byWay.set(o.way.idx, (byWay.get(o.way.idx) || 0) + 1)
      if (o.route) byRoute.set(o.route.idx, (byRoute.get(o.route.idx) || 0) + 1)
      const n = o.phase === 'travel' && o.way ? o.way.to : o.node
      byNode.set(n, (byNode.get(n) || 0) + 1)
    }
    return { byWay, byRoute, byNode }
  }

  // Utilidad anticipada de recorrer `route` de `way` y visitar `nextDest` al llegar.
  // `ruido` false: el término aleatorio se sustituye por su media y NO consume la RNG (solo para predecir, ver probWays).
  planUtility(b, way, route, nextDest, peers, halfFactor = 1, ruido = true) {
    const g = b.genome; const t = g.traits
    const obs = route.segments.slice(1, -1)
    const avgSpeedK = obs.reduce((s, o) => s + (o.speedK ?? 1), 0) / Math.max(1, obs.length)
    const len = route.length * halfFactor
    const eta = len / (this.cruise(b) * TUBE_SPEED_K * avgSpeedK + 8 * TRACK_K)
    const costE = eta * DRAIN_E + len * TRAVEL_E_LEN * way.theme.ecost
    const circuitP = (eta * way.theme.pps * PPS_K) / 10

    const remE = b.e - costE
    const hunger = clamp((55 - b.e) / 55, 0, 1)
    const needP = clamp((65 - b.p) / 65, 0, 1)
    const destE = nextDest ? (nextDest.de * (0.35 + hunger * 1.6) * (0.4 + t.apetito)) / 22 : 0
    const destP = nextDest ? (nextDest.dp * (0.45 + needP * 1.3)) / 22 : 0
    const survival = remE < 8 ? -4.5 : remE < 18 ? -1.5 : 0

    const riskLevel = (way.theme.risk + (route.profile?.thrill ?? 0.5)) * 0.5
    const riskScore = (t.valentia - 0.45) * riskLevel * 1.8 - (b.p < 28 ? riskLevel * 0.8 : 0)

    const seenRoute = Math.max(0, (b.visitedRoutes[route.idx] || 0) - (halfFactor < 1 && b.route === route ? 1 : 0))
    const noveltyNode = b.visited.includes(way.to) ? 0 : 0.45
    const curiosityScore = t.curiosidad * ((1 / (1 + seenRoute)) * 1.15 + noveltyNode)

    const peerCount = (peers.byWay.get(way.idx) || 0) * 0.5 + (peers.byRoute.get(route.idx) || 0) + (peers.byNode.get(way.to) || 0) * 0.4
    const socialScore = (t.sociabilidad - 0.45) * Math.min(3, peerCount) * 0.7

    const sp = route.profile?.speed
    const moodScore = (t.animo - 0.5) * (sp === 'rapida' ? 0.65 : sp === 'lenta' ? -0.4 : 0.35)
    const geneScore = g.ways[way.idx] * 0.45 + g.routes[route.idx] * 0.45 + (nextDest ? g.prefs[nextDest.idx] * 0.45 : 0)
    const noise = (ruido ? this.rng() : 0.5) * (0.16 + t.curiosidad * 0.28)

    const total = circuitP + destE + destP + survival + riskScore + curiosityScore + socialScore + moodScore + geneScore + noise

    let razon = 'explorar circuito'
    if (destE >= 0.75 && hunger > 0.35) razon = 'busco energía'
    else if (curiosityScore >= 0.7 && seenRoute === 0) razon = 'ruta inexplorada'
    else if (socialScore >= 0.4) razon = 'seguir al grupo'
    else if (socialScore <= -0.35 && peerCount === 0) razon = 'evitar multitudes'
    else if (riskScore >= 0.45) razon = 'busco adrenalina'
    else if (riskLevel < 0.42 && t.valentia < 0.45) razon = 'camino seguro'
    else if (destP >= 0.55) razon = 'quiero puntos'
    else if (sp === 'rapida') razon = 'me apetece velocidad'

    return { total, razon }
  }

  // Caminos que salen de `node` ordenados de más a menos probable para `b` (misma utilidad que goWay con el ruido en
  // su media). No consume la RNG ni toca a la ballita: la elección real sigue ocurriendo en goWay, al salir del nodo,
  // y puede diferir (energía, puntos y compañeras cambian hasta ese instante). Solo sirve para precargar en orden.
  probWays(b, node = b.node) {
    const ways = this.world.waysFrom[node] ?? []
    if (ways.length < 2) return ways.map((w) => w.idx)
    const peers = this.peerCounts(b)
    const sc = new Map()
    for (const way of ways) {
      let best = -Infinity
      for (const route of way.routes) {
        for (const nextDest of this.world.nodes[way.to].destinos) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1, false).total
          if (u > best) best = u
        }
      }
      sc.set(way.idx, best)
    }
    return ways.map((w) => w.idx).sort((x, y) => sc.get(y) - sc.get(x))
  }

  goWay(b) {
    // mismo optimizador de siempre, restringido a lo que decidió quien la controla (un solo uso; lo inválido se ignora)
    const d = b.ctrl ? b.dec : {}
    const { ways, ruta, usado } = this.restringir(b.node, d)
    const peers = this.peerCounts(b)
    let best = null; let bs = -Infinity
    for (const way of ways) {
      const dests = this.world.nodes[way.to].destinos
      for (const route of ruta ? [ruta] : way.routes) {
        for (const nextDest of dests) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1)
          if (u.total > bs) { bs = u.total; best = { way, route, nextDest, razon: u.razon } }
        }
      }
    }
    b.way = best.way
    b.plannedRoute = best.route
    b.nextDest = best.nextDest
    b.rutaFija = ruta
    b.carrilFijo = d.carril ?? null; if (d.carril != null) usado.push('carril')
    b.viajeDecidido = usado.length > 0
    if (b.ctrl) b.dec = {}
    const destNode = this.world.nodes[best.way.to]
    b.plan = {
      destino: `${destNode.name} · ${best.nextDest.name}`,
      ruta: `${best.way.theme.name} · Ruta ${best.route.name}`,
      razon: usado.length ? 'lo decidió quien me controla' : best.razon,
    }
    if (usado.length) b.plan.manual = usado
    this.walkTo(b, this.world.nodes[b.node].portTo[best.way.to].out, 'toPort')
    this.say(b, 'camino', { c: best.way.theme.name, n: destNode.name })
  }

  // ───────────── circuito: rodar por los tubos ─────────────
  eta(b, way) { return way.length / (this.cruise(b) * TUBE_SPEED_K + 8 * TRACK_K) }

  enterSeg(b, seg) {
    const prev = b.phase === 'travel' ? b.seg : null
    if (!prev) {
      b.phase = 'travel'; b.dur = b.timer = this.eta(b, b.way) / TRAVEL_SLOW; b.snap = 0.3
      b.lane = 0; b.ang = laneAngle(seg, 0, 0); b.sw = null; b.off = b.rail = 0
      this.resetSurface(b)
    } else if (segmentTangent(prev, 1, tmp).angleTo(segmentTangent(seg, 0, tmp2)) > 0.35 && b.rail > 0.3 * TRACK_K) {
      // quiebro de tangente (entrada a un embudo, etc.): se funde la posición en vez de saltar
      b.snap = Math.max(b.snap, 0.2)
    }
    const prevRoute = b.route
    if (prev && (b.sw || b.flight)) {
      b.lane = seg.lanes?.some((l) => l.id === b.lane) ? b.lane : nearestLane(seg, b.ang)
      b.sw = null; b.flight = null; b.vis = 1
      b.rail = b.off
      this.resetSurface(b)
    }
    // al entrar a una ruta (o al principio del viaje) toma un carril al azar: él marca el camino que seguirá
    if (!prev || seg.route !== prev.route) {
      b.carril = Math.floor(this.rng() * CARRILES)
      if (b.carrilFijo != null) b.carril = b.carrilFijo // carril decidido: vale hasta el primer evento
    }
    b.seg = seg; b.segT = 0
    if (!b.sw && !seg.lanes?.some((l) => l.id === b.lane)) b.lane = nearestLane(seg, b.ang)
    if (seg.route >= 0) {
      b.route = b.way.routes[seg.route]
      if (b.route !== prevRoute) b.visitedRoutes[b.route.idx] = (b.visitedRoutes[b.route.idx] || 0) + 1
    }
    b.speed = Math.max(b.speed, seg.boost * 1.35 * MAP_SPEED_K, this.cruise(b) * TUBE_SPEED_K * (seg.speedK ?? 1))
    if (WOW.includes(seg.kind)) this.say(b, seg.kind)
  }

  // En cada bifurcación (fork/cross): evalúa la utilidad del tramo restante hasta llegar al destino planeado.
  pickNext(b) {
    if (b.seg.next.length === 1) return b.way.segments[b.seg.next[0]]
    if (b.rutaFija) { // ruta decidida: se impone en fork y en cross
      const i = b.seg.next.find((j) => b.way.segments[j].route === b.rutaFija.r)
      if (i != null) return b.way.segments[i]
    }
    const g = b.genome; const way = b.way
    const peers = this.peerCounts(b)
    const halfFactor = b.seg.kind === 'salida' ? 1 : 0.5
    let best = null; let bestRoute = null; let bestRazon = null; let bs = -Infinity
    for (const i of b.seg.next) {
      const o = way.segments[i]
      if (o.route < 0) {
        if (0 > bs) { bs = 0; best = o }
        continue
      }
      const rt = way.routes[o.route]
      const u = this.planUtility(b, way, rt, b.nextDest, peers, halfFactor)
      const kindPref = mean(o.tramo, (k) => g.kinds[OBSTACLES.indexOf(k)]) * 0.5
      const planBonus = b.plannedRoute === rt ? 0.35 : 0
      const sc = u.total + kindPref + planBonus
      if (sc > bs) { bs = sc; best = o; bestRoute = rt; bestRazon = u.razon }
    }
    if (bestRoute && bestRoute !== b.plannedRoute) {
      b.plannedRoute = bestRoute
      if (b.plan) {
        b.plan.ruta = `${way.theme.name} · Ruta ${bestRoute.name}`
        b.plan.razon = bestRazon
      }
    }
    return best
  }

  travelStep(b, dt) {
    const L = b.way
    let s = b.seg
    b.e -= TRAVEL_E_LEN * L.theme.ecost * b.speed * dt
    b.p += L.theme.pps * PPS_K * dt
    if (b.flight) return this.flightStep(b, s, dt)

    let t0 = b.segT
    b.segT += (b.speed * dt) / laneLength(s, b.lane)
    while (b.segT >= 1) {
      if (!b.sw) this.checkSwitches(b, s, t0, 1) // los mecanismos del final del tramo también cuentan
      if (!s.next.length) return this.arrive(b)
      const over = (b.segT - 1) * laneLength(s, b.lane)
      this.enterSeg(b, this.pickNext(b))
      s = b.seg; b.segT = over / laneLength(s, b.lane); t0 = 0
    }
    if (!b.sw) this.checkSwitches(b, s, t0, b.segT)
    const T = laneFrame(s, b.lane, b.segT, b._frame || (b._frame = {})).tangent

    // pendiente real: el relieve inclina la pista hacia el eje (b.wall = dirección eje->pared)
    const rs = s.air || b.sw || b.airborne ? 0 : reliefSlope(s, b.lane, b.segT)
    b.slope = (T.y - b.wall.y * rs) / Math.hypot(1, rs)
    // velocidad: la gravedad acelera al bajar y frena al subir; el tubo roza, el aire no
    b.speed += (-GRAV * b.slope - FRIC * s.drag * b.speed) * dt
    // cuesta arriba puede ir más lenta que su crucero (se nota la subida)
    const climb = 1 - 0.45 * clamp(b.slope * 4, 0, 1)
    const minV = climb * this.cruise(b) * TUBE_SPEED_K * clamp(s.kind === 'embudo' ? 0.6 : (s.speedK ?? 1), 0.45, 1.8)
    let maxV = VMAX * (s.kind === 'portal' ? 1.35 : s.kind === 'hielo_resbaloso' ? 1.2 : 1)
    if (b.sw && !b.sw.failed) maxV *= 1.15
    b.speed = clamp(b.speed, minV, maxV)

    // carril: la ballita va pegada a su pared (o vuela entre paredes si hay un mecanismo en curso)
    this.laneStep(b, s, dt)
    const F = laneFrame(s, b.lane, b.segT, b._frame || (b._frame = {}))
    b.wall.copy(F.dir); b.roll = F.roll
    const pos = tmp.copy(F.pos).addScaledVector(F.side, b.lat).addScaledVector(F.up, b.hy)
    this.place(b, pos, F.tangent, F.up, dt)
  }

  // Recorre la trayectoria del evento en curso (switchPath: arco, caída, elevador, portal o laberinto). El avance segT
  // va de sw.u a sw.uLand con el vuelo; al terminar queda en el camino destino, en un carril al azar.
  flightStep(b, s, dt) {
    const f = b.flight; f.t = Math.min(1, f.t + dt / f.dur)
    const F = switchPath(s, f.sw, f.t, b._flightFrame || (b._flightFrame = {}))
    b.segT = f.sw.u + (f.sw.uLand - f.sw.u) * f.t
    b.airborne = true; b.off = 0; b.wall.copy(F.up).negate(); b.roll = 0; b.vis = F.vis
    this.place(b, F.pos, F.tangent, F.up, dt)
    if (f.t < 1) return
    b.lane = f.sw.to; b.segT = f.sw.uLand; b.flight = null; b.sw = null; b.impact = 1; b.vis = 1
    b.carril = Math.floor(this.rng() * CARRILES) // cae en un carril al azar del camino destino
    b.carrilFijo = null // el carril decidido valía hasta el primer evento
    b.lastSwitch = { kind: f.sw.kind, name: f.sw.name, lane: b.seg.lanes?.find((l) => l.id === f.sw.to)?.name ?? 'carril', carril: b.carril, until: this.t + 8 }
    if (f.failed) { b.speed *= 0.7; b.p -= 1 + f.sw.risk * 3; b.react = { mood: 'asustada', until: this.t + 1.2 }; this.say(b, 'falla', { m: f.sw.name }) }
    else { b.p += f.sw.reward.p; b.e += f.sw.reward.e; b.score += Math.max(0, f.sw.reward.p) }
    this.resetSurface(b)
    b.ang = laneAngle(s, b.lane, b.segT); b.rail = b.off = s.air ? 0 : s.radius - BALL_R
  }

  // Sigue su carril. Mantiene ang/off continuos y off <= radio útil.
  laneStep(b, s, dt) {
    const R = s.air ? 0 : s.radius - BALL_R
    b.rail += (R - b.rail) * Math.min(1, dt * RAIL_EASE)
    b.impact = Math.max(0, b.impact - dt * 3)
    this.surfaceStep(b, s, dt)
    const target = laneAngle(s, b.lane, b.segT) + (R > 0 ? b.lat / R : 0)
    const d = angDiff(b.ang, target)
    // en su carril lo sigue exacto (la canaleta la contiene); si viene de otro, se acerca suave
    b.onLane = Math.abs(d) < 0.05
    b.ang += b.onLane ? d : d * Math.min(1, dt * LANE_EASE)
    b.off = Math.max(0, b.rail - b.hy)
  }
  resetSurface(b) {
    b.hy = 0; b.vy = 0; b.airborne = false; b.lat = 0; b.latV = 0; b.edge = 0
  }

  // Línea de carrera en la calzada (u laterales, |x| <= edge): va por su carril (b.carril, carrilLat);
  // en curva fuerte se va al interior (contra el empuje) y, si una vecina del mismo carril va a menos de RACE_GAP de avance
  // con solape lateral, se aparta por el lado libre (la que viene detrás y más rápida, con más decisión: adelanta).
  // El muelle lateral (LAT_K, LAT_C) la lleva suave hacia esta línea.
  raceLine(b, s, push, edge) {
    let x = carrilLat(b.carril ?? 2, edge)
    // en curva fuerte se cierra un poco al interior, sin abandonar su carril (máx. ~medio carril)
    if (Math.abs(push) > 0.5 * TRACK_K) x -= Math.sign(push) * (edge / CARRILES) * clamp(Math.abs(push) / (6 * TRACK_K), 0, 1)
    const L = laneLength(s, b.lane)
    for (const o of this._near?.get(s) || []) {
      if (o === b || o.lane !== b.lane || o.flight) continue
      const ds = (o.segT - b.segT) * L; if (Math.abs(ds) > RACE_GAP) continue
      const dl = b.lat - o.lat; const side = Math.abs(dl) > 0.05 ? Math.sign(dl) : (b.id > o.id ? 1 : -1)
      const room = 2.2 * BALL_R - Math.abs(dl) // solape lateral con la vecina
      if (room > 0) x += side * room * (ds > 0 && b.speed > o.speed ? 1.6 : 1)
    }
    return clamp(x, -edge, edge)
  }

  // Contacto con la pista: relieve (sube/baja, despega en crestas, cae y rebota) y bordes del carril.
  // b.hy: altura sobre la pared (hacia el eje); b.vy su velocidad; b.lat: desvío lateral (u) dentro del carril.
  surfaceStep(b, s, dt) {
    if (s.air || b.rail < 1e-3) {
      // tramo aéreo: vuela por el eje; sin pista que tocar
      b.hy = 0; b.vy = 0; b.airborne = !!s.air; b.lat *= 0.9; b.latV = 0; b.edge = 0
      return
    }
    const h = laneRelief(s, b.lane, b.segT)
    const vs = b.speed * reliefSlope(s, b.lane, b.segT) // velocidad con la que sube el firme bajo ella
    const ceil = 0.85 * b.rail // no cruza el eje: ahí rebota
    if (b.airborne) {
      b.vy -= G_WALL * dt; b.hy += b.vy * dt
      if (b.hy > ceil) { b.hy = ceil; if (b.vy > 0) { b.vy *= -BOUNCE; b.impact = Math.max(b.impact, 0.3) } }
      if (b.hy <= h) {
        const hit = vs - b.vy // > 0: velocidad de choque contra el firme
        b.hy = h
        b.impact = Math.max(b.impact, clamp(hit / (6 * TRACK_K), 0, 1))
        b.speed *= 1 - 0.05 * clamp(hit / (6 * TRACK_K), 0, 1)
        if (hit > 2.5 * TRACK_K) b.vy = vs + hit * BOUNCE // rebote amortiguado
        else { b.airborne = false; b.vy = vs }
      }
    } else if (vs - b.vy < -G_WALL * dt * 1.5 && b.speed > 3 * TRACK_K) {
      // el firme cae más rápido de lo que la gravedad la baja: despega en la cresta
      b.airborne = true; b.vy -= G_WALL * dt; b.hy = Math.max(h, b.hy + b.vy * dt)
    } else {
      b.hy = h; b.vy = vs
    }
    // lateral: la curva la empuja hacia fuera; la canaleta la recoge y los bordes la contienen
    const { k, out } = segmentCurvature(s, b.segT)
    const push = 0.5 * b.speed * b.speed * k * Math.sin(angDiff(b.ang, out))
    const lane = s.lanes?.find((l) => l.id === b.lane)
    const edge = Math.max(0.05, (lane?.width ?? LANE_W) / 2 - BALL_R * 0.85)
    b.latV += (push - LAT_K * (b.lat - this.raceLine(b, s, push, edge)) - LAT_C * b.latV) * dt
    b.lat += b.latV * dt
    b.edge = 0
    if (Math.abs(b.lat) > edge) {
      const sg = Math.sign(b.lat)
      b.lat = sg * edge; b.edge = sg
      if (b.latV * sg > 0) {
        b.impact = Math.max(b.impact, clamp(Math.abs(b.latV) / (8 * TRACK_K), 0, 0.6))
        b.latV *= -LAT_EDGE; b.speed *= 0.995
      }
    }
  }

  // Utilidad de usar un mecanismo (misma lógica que planUtility: riesgo, curiosidad, hambre, grupo, genes).
  laneUtility(b, s, sw, peers) {
    const g = b.genome; const t = g.traits
    const hunger = clamp((55 - b.e) / 55, 0, 1)
    const needP = clamp((65 - b.p) / 65, 0, 1)
    const riskScore = (t.valentia - 0.45) * sw.risk * 2 - (b.p < 28 ? sw.risk * 0.6 : 0)
    const curiosity = (t.curiosidad * 0.9) / (1 + (b.mechs[sw.kind] || 0))
    const food = (sw.reward.e / 3) * (0.2 + hunger * 1.6) * (0.4 + t.apetito)
    const pts = (sw.reward.p / 6) * (0.3 + needP)
    const onLane = peers.filter((o) => o.lane === sw.to).length
    const social = (t.sociabilidad - 0.45) * Math.min(2, onLane) * 0.5
    const gi = OBSTACLES.indexOf(sw.kind)
    const gene = gi >= 0 ? g.kinds[gi] * 0.4 : 0.2
    const failCost = -sw.fail * (1.5 - t.valentia)
    const noise = this.rng() * (0.2 + t.curiosidad * 0.3)
    return riskScore + curiosity + food + pts + social + gene + failCost + noise
  }

  // ¿Cruzó una estación de mecanismos en (t0, t1] estando en el carril de origen? Decide si la usa.
  checkSwitches(b, s, t0, t1) {
    if (!s.switches?.length) return
    const cands = s.switchesByLane?.get(b.lane) || s.switches
    let first = null
    for (const sw of cands) {
      if (sw.from !== b.lane || sw.carril !== b.carril || sw.u <= t0 || sw.u > t1) continue
      if (!first || sw.u < first.u) first = sw
    }
    if (!first) return
    const u = first.u
    const t = b.genome.traits
    const peers = this.ballitas.filter((o) => o !== b && o.phase === 'travel' && o.seg === s)
    let best = null
    let bs = 0.1 + (0.45 - t.valentia) * 0.5 + this.rng() * 0.3 // seguir por el mismo camino (un solo evento por carril: umbral más bajo)
    for (const sw of cands) {
      if (sw.from !== b.lane || sw.carril !== b.carril || Math.abs(sw.u - u) > 1e-6) continue
      const sc = this.laneUtility(b, s, sw, peers)
      if (sc > bs) { bs = sc; best = sw }
    }
    if (best) this.startSwitch(b, s, best)
  }

  startSwitch(b, s, sw) {
    const fail = this.rng() < sw.fail * (1.25 - b.genome.traits.valentia * 0.5)
    b.sw = { s: sw, t: 0, dur: sw.duration, style: sw.style, fail, failed: fail }
    // el impulso lanza: el vuelo avanza ~1.8 veces más rápido que rodando (entre un tercio y toda la duración nominal); el laberinto va 1.5 veces más lento
    const roll = ((sw.uLand - sw.u) * laneLength(s, sw.from)) / Math.max(1, b.speed * sw.boost)
    const dur = sw.via === 'laberinto' ? clamp(roll * 1.5, 0.6 * sw.duration, sw.duration) : clamp(roll / 2.5, 0.35 * sw.duration, sw.duration)
    b.flight = { sw, t: 0, dur, from: b.lane, to: sw.to, failed: fail }
    b.airborne = true; b.vy = 0; b.lat = 0; b.latV = 0
    b.speed *= sw.boost
    b.mechs[sw.kind] = (b.mechs[sw.kind] || 0) + 1
    if (b.plan) b.plan.carril = `${sw.emoji} ${sw.name}`
    if (!b.thought || b.thought.until < this.t) this.say(b, 'carril', { m: sw.name })
  }
  arrive(b) {
    const L = b.way; const node = this.world.nodes[L.to]
    // inactividad: una llegada sin decisión usada ni pendiente cuenta; a la tercera pierde el control
    if (b.ctrl) {
      if (b.viajeDecidido || Object.keys(b.dec).length > 0) b.sinDecidir = 0
      else if (++b.sinDecidir >= MAX_SIN_DECIDIR) this.dejar(b.id, b.ctrl, 'inactivo')
    }
    b.viajeDecidido = false; b.rutaFija = null; b.carrilFijo = null
    b.node = L.to; b.vert = node.portTo[L.from].in
    b.visited = [L.to, ...b.visited].slice(0, 3)
    b.speed = 0; b.roll = b.off = b.rail = 0
    this.resetSurface(b); b.slope = 0; b.onLane = true
    b.sw = null; b.lane = 0; b.ang = 0
    this.say(b, 'llega', { n: node.name })
    this.goDest(b)
  }

  // Para el panel: lo que más le gusta (genes más altos).
  favorites(b) {
    const top = (arr) => arr.reduce((bi, v, i) => (v > arr[bi] ? i : bi), 0)
    const g = b.genome; const w = this.world
    return { destino: w.destinos[top(g.prefs)], way: w.ways[top(g.ways)], route: w.routes[top(g.routes)], kind: KINDS[OBSTACLES[top(g.kinds)]] }
  }

  // Para el panel: dónde está y a dónde va, en una frase.
  where(b) {
    const w = this.world; const n = w.nodes[b.node].name
    if (b.phase === 'travel') {
      const lane = b.seg.lanes?.find((l) => l.id === b.lane)?.name
      const camino = `Camino: ${b.way.theme.name} · carril ${b.carril + 1}/${CARRILES}`
      const cambio = b.sw ? `⤴ ${b.sw.s.name} al camino ${lane ?? 'siguiente'}, carril aleatorio` : b.lastSwitch?.until > this.t ? `⤴ ${b.lastSwitch.name} al camino ${b.lastSwitch.lane}, carril ${b.lastSwitch.carril + 1}` : ''
      const via = cambio ? ` · ${cambio}` : ''
      return `De ${n} a ${w.nodes[b.way.to].name} por ${b.way.theme.emoji} ${b.way.theme.name}${b.route ? `, ruta ${b.route.name}` : ''}: ${b.seg.emoji} ${b.seg.name} · ${camino}${via}`
    }
    if (b.phase === 'toPort') return `En ${n}, hacia el puerto de ${w.nodes[b.way.to].name}`
    if (!b.dest) return `En ${n}`
    return `En ${n}: ${b.phase === 'toDest' ? 'va a ' : ''}${b.dest.name}`
  }
}
