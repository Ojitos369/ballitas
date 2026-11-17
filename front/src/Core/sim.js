// Simulación de bollitas: genoma, decisiones, vida/muerte y evolución genética.
// Sin React ni render: la UI sólo lee `sim.bollitas` y llama `sim.tick(dt)`.
//
// ═══════════════════════════ CONTRATO: BOLLITA ═══════════════════════════
// (la forma del mundo y WORLD_SCALE/TUBE_SCALE están al inicio de world.js)
// Escala temporal:
//   TIME_SCALE (2.5): factor objetivo de duración de viaje por circuito (~2-3x más tiempo para
//                     disfrutar cada tramo). Los costos por segundo (DRAIN_E, DRAIN_P, PPS_K) y por
//                     unidad de longitud (TRAVEL_E_LEN), así como FRIC/VMAX, están calibrados para
//                     caminos largos sin agotar energía ni romper la selección natural.
// b = {
//   id, name, gen, arch { key, hi, title }, genome, p, e (0..100), age, visits, score, cause, bornAt,
//   genome: { traits { valentia, curiosidad, apetito, sociabilidad, animo, velocidad }, hue,
//             prefs[destino.idx], ways[way.idx], routes[route.idx], kinds[índice en OBSTACLES] }  (todo 0..1)
//   pos, dir, up: THREE.Vector3 siempre válidos. En la ciudad `up` es la normal de la esfera; en un tubo
//                 apunta de la pared al eje (la bollita rueda por la pared); en el aire, hacia +Y.
//   phase, timer (segundos restantes estimados), dur (duración estimada de la fase)
//   speed: velocidad actual (unidades/s); roll: ángulo (rad) de balanceo dentro del tubo, 0 = abajo;
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
//   dying   animación de muerte          gone  se elimina de `sim.bollitas` en este mismo tick
// sim = { world, bollitas[], t, stats { nacidas, muertas, mejorEdad, genMax }, feed[] { t, text }, pool[] }
// sim.tick(dt), sim.favorites(b) -> { destino, way, route, kind }, sim.where(b) -> texto para el panel.
// ══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three'
import { buildWorld, cityPath, slerpDir, NODE_R, BALL_R, OBSTACLES, KINDS } from './world.js'
import { voice, moodOf, archetype } from './personality.js'

export const POP = 10
export const TIME_SCALE = 2.5
const TRAITS = ['valentia', 'curiosidad', 'apetito', 'sociabilidad', 'animo', 'velocidad']
const GENES = ['prefs', 'ways', 'routes', 'kinds']
// Equilibrio: un ciclo destino + viaje dura ~60-65 s (el viaje ~2.5x más largo) y sólo rinde un destino.
const DRAIN_E = 0.22 // energía/s siempre
const DRAIN_P = 0.25 // puntos/s siempre
const TRAVEL_E_LEN = 0.0055 // energía por unidad de distancia recorrida en tubo (× ecost del tema)
const PPS_K = 0.35 / TIME_SCALE // escala de los puntos/s del tema
// Física del tubo
const TUBE_SPEED_K = 2.4 // escala la velocidad base dentro de los tubos largos (~900u)
const GRAV = 24
const FRIC = 0.14
const VMAX = 48
const ROLL_K = 40 // muelle que lleva la bollita hacia donde la empujan gravedad y centrífuga
const ROLL_C = 5 // amortiguación: oscila un par de veces y se asienta
const WOW = ['canon', 'trampolin', 'rizo', 'caida', 'embudo', 'geiser', 'erupcion', 'turbina', 'hielo_resbaloso', 'pantano', 'portal', 'cascada'] // obstáculos que merecen comentario
const FALLBACK_VOICES = {
  geiser: ['¡Al chorro del géiser!', '¡Arriba voy!'],
  erupcion: ['¡Erupción! ¡A volar!', '¡El cráter me lanza!'],
  turbina: ['¡Viento de lado!', '¡Qué impulso!'],
  hielo_resbaloso: ['¡Qué rápido patina!', '¡A toda velocidad!'],
  pantano: ['Uy, qué pegajoso…', 'Me frena el pantano…'],
  portal: ['¡Salto espacial!', '¡Teletransporte!'],
  cascada: ['¡Por la cascada!', '¡Agua va!'],
}
const Y = new THREE.Vector3(0, 1, 0)
const clamp = (x, a, b) => Math.min(b, Math.max(a, x))
const mean = (arr, f) => arr.reduce((s, x) => s + f(x), 0) / arr.length
const tmp = new THREE.Vector3()
const tmp2 = new THREE.Vector3()
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

const NAMES = ['Pelusa', 'Moti', 'Canica', 'Tapioca', 'Chispa', 'Nube', 'Gotita', 'Burbuja', 'Pixel', 'Mochi',
  'Fresita', 'Oliva', 'Trufa', 'Cometa', 'Bombón', 'Churro', 'Kiwi', 'Lentejuela', 'Migajita', 'Ñoño',
  'Pepita', 'Zumo', 'Tuerca', 'Brillo', 'Galleta', 'Lunita', 'Rulo', 'Bizcocho', 'Canela', 'Peque']

export class Sim {
  constructor({ rng = Math.random, pop = POP, seed } = {}) {
    this.rng = rng
    this.world = buildWorld(seed)
    this.pop = pop
    this.t = 0
    this.nextId = 1
    this.bollitas = []
    this.pool = [] // muertas con su genoma: base de la selección
    this.spawnQueue = []
    this.stats = { nacidas: 0, muertas: 0, mejorEdad: 0, genMax: 1 }
    this.feed = [] // eventos globales recientes
    for (let i = 0; i < pop; i++) this.spawn()
  }

  genomeForNewborn() {
    const { pool, rng } = this
    if (pool.length < 3 || rng() < 0.1) return { genome: randomGenome(this.world, rng), gen: 1 } // inmigrante
    const tour = () => {
      let best = null
      for (let i = 0; i < 3; i++) {
        const c = pool[Math.floor(rng() * pool.length)]
        if (!best || c.fitness > best.fitness) best = c
      }
      return best
    }
    const a = tour(); const b = tour()
    return { genome: breed(a.genome, b.genome, rng), gen: Math.max(a.gen, b.gen) + 1 }
  }

  spawn() {
    const { genome, gen } = this.genomeForNewborn()
    const node = this.world.nodes[Math.floor(this.rng() * this.world.nodes.length)]
    const vert = Math.floor(this.rng() * node.verts.length)
    const up = node.verts[vert].dir.clone()
    const b = {
      id: this.nextId++, gen, genome, node: node.idx, vert, p: 60, e: 60, age: 0, visits: 0, score: 0,
      name: `${NAMES[Math.floor(this.rng() * NAMES.length)]} ${gen > 1 ? 'G' + gen : ''}`.trim(),
      phase: 'born', timer: 0.8, dur: 0.8, bornAt: this.t,
      dest: null, way: null, route: null, seg: null, segT: 0, walk: null,
      visited: [node.idx], visitedRoutes: {}, plannedRoute: null, nextDest: null, plan: null,
      log: [], flags: {},
      pos: node.pos.clone().addScaledVector(up, NODE_R + BALL_R),
      dir: new THREE.Vector3().crossVectors(up, Math.abs(up.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : Y).normalize(), up,
      // estado del balanceo en el tubo: `wall` va del eje a la bollita, `off` es su distancia al eje
      wall: up.clone().negate(), off: 0, roll: 0, rollVel: 0, prevT: new THREE.Vector3(), snap: 0,
      thought: null, react: null, mood: 'feliz', speed: 0, cause: null,
    }
    b.arch = archetype(genome)
    this.bollitas.push(b)
    this.stats.nacidas++
    this.stats.genMax = Math.max(this.stats.genMax, gen)
    this.say(b, 'nace')
    return b
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
    for (const b of this.bollitas) this.step(b, dt)
    for (let i = this.bollitas.length - 1; i >= 0; i--) {
      if (this.bollitas[i].phase === 'gone') this.bollitas.splice(i, 1)
    }
    // reaparece una nueva por cada muerta, tras un respiro
    while (this.bollitas.length + this.spawnQueue.length < this.pop) this.spawnQueue.push(this.t + 1.5)
    this.spawnQueue = this.spawnQueue.filter((at) => (at <= this.t ? (this.spawn(), false) : true))
  }

  step(b, dt) {
    if (b.phase === 'dying') {
      b.timer -= dt
      if (b.timer <= 0) b.phase = 'gone'
      return
    }
    b.age += dt
    b.e -= DRAIN_E * dt
    b.p -= DRAIN_P * dt
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
        this.travelStep(b, dt)
        break
    }
    b.p = Math.min(100, b.p); b.e = Math.min(100, b.e)
    this.watch(b)
  }

  watch(b) {
    if (b.e <= 0 || b.p <= 0) {
      b.cause = b.e <= 0 ? 'energía' : 'puntos'
      this.say(b, 'muere')
      b.phase = 'dying'; b.timer = 1.4; b.speed = 0
      b.mood = 'asustada'
      this.pool.push({ genome: b.genome, gen: b.gen, fitness: b.age + b.score * 0.2 })
      this.pool.sort((x, y) => y.fitness - x.fitness)
      this.pool.length = Math.min(this.pool.length, 24)
      this.stats.muertas++
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

  // Coloca la bollita. Tras un cambio de fase (`snap`) la posición se funde en vez de saltar.
  place(b, P, T, U, dt) {
    if (b.snap > 0) { b.snap -= dt; b.pos.lerp(P, Math.min(1, dt * 12)) } else b.pos.copy(P)
    const k = Math.min(1, dt * 10)
    ease(b.dir, T, k); ease(b.up, U, k)
  }

  // ───────────── ciudad: caminar por las carreteras de la esfera ─────────────
  cruise(b) { return 4 + b.genome.traits.velocidad * 3 }

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
    let best = null; let bs = -Infinity
    for (const s of this.world.nodes[b.node].destinos) {
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
    for (const o of this.bollitas) {
      if (o === self || o.phase === 'dying' || o.phase === 'gone') continue
      if (o.way) byWay.set(o.way.idx, (byWay.get(o.way.idx) || 0) + 1)
      if (o.route) byRoute.set(o.route.idx, (byRoute.get(o.route.idx) || 0) + 1)
      const n = o.phase === 'travel' && o.way ? o.way.to : o.node
      byNode.set(n, (byNode.get(n) || 0) + 1)
    }
    return { byWay, byRoute, byNode }
  }

  // Utilidad anticipada de recorrer `route` de `way` y visitar `nextDest` al llegar.
  planUtility(b, way, route, nextDest, peers, halfFactor = 1) {
    const g = b.genome; const t = g.traits
    const obs = route.segments.slice(1, -1)
    const avgSpeedK = obs.reduce((s, o) => s + (o.speedK ?? 1), 0) / Math.max(1, obs.length)
    const len = route.length * halfFactor
    const eta = len / (this.cruise(b) * TUBE_SPEED_K * avgSpeedK + 8)
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

    const seenRoute = b.visitedRoutes[route.idx] || 0
    const noveltyNode = b.visited.includes(way.to) ? 0 : 0.45
    const curiosityScore = t.curiosidad * ((1 / (1 + seenRoute)) * 1.15 + noveltyNode)

    const peerCount = (peers.byWay.get(way.idx) || 0) * 0.5 + (peers.byRoute.get(route.idx) || 0) + (peers.byNode.get(way.to) || 0) * 0.4
    const socialScore = (t.sociabilidad - 0.45) * Math.min(3, peerCount) * 0.7

    const sp = route.profile?.speed
    const moodScore = (t.animo - 0.5) * (sp === 'rapida' ? 0.65 : sp === 'lenta' ? -0.4 : 0.35)
    const geneScore = g.ways[way.idx] * 0.45 + g.routes[route.idx] * 0.45 + (nextDest ? g.prefs[nextDest.idx] * 0.45 : 0)
    const noise = this.rng() * (0.16 + t.curiosidad * 0.28)

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

  goWay(b) {
    const peers = this.peerCounts(b)
    let best = null; let bs = -Infinity
    for (const way of this.world.waysFrom[b.node]) {
      const dests = this.world.nodes[way.to].destinos
      for (const route of way.routes) {
        for (const nextDest of dests) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1)
          if (u.total > bs) { bs = u.total; best = { way, route, nextDest, razon: u.razon } }
        }
      }
    }
    b.way = best.way
    b.plannedRoute = best.route
    b.nextDest = best.nextDest
    const destNode = this.world.nodes[best.way.to]
    b.plan = {
      destino: `${destNode.name} · ${best.nextDest.name}`,
      ruta: `${best.way.theme.name} · Ruta ${best.route.name}`,
      razon: best.razon,
    }
    this.walkTo(b, this.world.nodes[b.node].portTo[best.way.to].out, 'toPort')
    this.say(b, 'camino', { c: best.way.theme.name, n: destNode.name })
  }

  // ───────────── circuito: rodar por los tubos ─────────────
  eta(b, way) { return way.length / (this.cruise(b) * TUBE_SPEED_K + 8) }

  enterSeg(b, seg) {
    if (b.phase !== 'travel') { b.phase = 'travel'; b.dur = b.timer = this.eta(b, b.way); b.snap = 0.3; b.prevT.set(0, 0, 0) }
    const prevRoute = b.route
    b.seg = seg; b.segT = 0
    if (seg.route >= 0) {
      b.route = b.way.routes[seg.route]
      if (b.route !== prevRoute) b.visitedRoutes[b.route.idx] = (b.visitedRoutes[b.route.idx] || 0) + 1
    }
    b.speed = Math.max(b.speed, seg.boost * 1.35, this.cruise(b) * TUBE_SPEED_K * (seg.speedK ?? 1))
    if (WOW.includes(seg.kind)) this.say(b, seg.kind)
  }

  // En cada bifurcación (fork/cross): evalúa la utilidad del tramo restante hasta llegar al destino planeado.
  pickNext(b) {
    if (b.seg.next.length === 1) return b.way.segments[b.seg.next[0]]
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

    b.segT += (b.speed * dt) / s.length
    while (b.segT >= 1) {
      if (!s.next.length) return this.arrive(b)
      const over = (b.segT - 1) * s.length
      this.enterSeg(b, this.pickNext(b))
      s = b.seg; b.segT = over / s.length
    }
    const P = s.curve.getPointAt(b.segT); const T = s.curve.getTangentAt(b.segT)

    // velocidad: la gravedad acelera al bajar y frena al subir; el tubo roza, el aire no
    b.speed += (-GRAV * T.y - FRIC * s.drag * b.speed) * dt
    const minV = this.cruise(b) * TUBE_SPEED_K * clamp(s.kind === 'embudo' ? 0.6 : (s.speedK ?? 1), 0.45, 1.8)
    const maxV = VMAX * (s.kind === 'portal' ? 1.35 : s.kind === 'hielo_resbaloso' ? 1.2 : 1)
    b.speed = clamp(b.speed, minV, maxV)

    // balanceo: la bollita busca el punto de la pared hacia el que la aprietan gravedad y centrífuga
    const w = b.wall
    w.addScaledVector(T, -w.dot(T))
    if (w.lengthSq() < 1e-6) w.crossVectors(T, Math.abs(T.y) > 0.9 ? tmp.set(1, 0, 0) : Y)
    w.normalize()
    const down = tmp.copy(Y).addScaledVector(T, -T.y).negate() // gravedad proyectada en la sección del tubo
    const push = tmp2.copy(down).multiplyScalar(GRAV)
    if (s.kind === 'turbina') {
      const lat = new THREE.Vector3().crossVectors(T, Y)
      if (lat.lengthSq() > 1e-4) push.addScaledVector(lat.normalize(), 20 * Math.sin(b.segT * Math.PI * 2))
    }
    if (b.prevT.lengthSq() > 0 && !s.air) {
      // curvatura ≈ ΔT/Δs; acotada para que el quiebro de una unión no la lance
      const kv = b.prevT.sub(T).multiplyScalar(b.speed / dt) // = -(dT/ds)·v²
      push.add(kv.clampLength(0, 60))
    }
    b.prevT.copy(T)
    const force = push.length()
    const delta = force > 1e-3 ? Math.atan2(T.dot(new THREE.Vector3().crossVectors(w, push)), w.dot(push)) : 0
    b.rollVel += (ROLL_K * delta * Math.min(1, force / GRAV) - ROLL_C * b.rollVel) * dt
    w.applyAxisAngle(T, b.rollVel * dt)
    b.roll = down.lengthSq() > 1e-4 ? Math.atan2(T.dot(new THREE.Vector3().crossVectors(down, w)), down.dot(w)) : 0

    b.off += ((s.air ? 0 : s.radius - BALL_R) - b.off) * Math.min(1, dt * 6)
    this.place(b, P.addScaledVector(w, b.off), T, new THREE.Vector3().copy(w).negate(), dt)
  }

  arrive(b) {
    const L = b.way; const node = this.world.nodes[L.to]
    b.node = L.to; b.vert = node.portTo[L.from].in
    b.visited = [L.to, ...b.visited].slice(0, 3)
    b.speed = 0; b.roll = b.rollVel = b.off = 0
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
    if (b.phase === 'travel') return `De ${n} a ${w.nodes[b.way.to].name} por el ${b.way.theme.emoji} ${b.way.theme.name}${b.route ? `, ruta ${b.route.name}` : ''}: ${b.seg.emoji} ${b.seg.name}`
    if (b.phase === 'toPort') return `En ${n}, hacia el puerto de ${w.nodes[b.way.to].name}`
    if (!b.dest) return `En ${n}`
    return `En ${n}: ${b.phase === 'toDest' ? 'va a ' : ''}${b.dest.name}`
  }
}
