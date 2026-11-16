// Simulación de bollitas: genoma, decisiones, vida/muerte y evolución genética.
// Sin React ni render: la UI sólo lee `sim.bollitas` y llama `sim.tick(dt)`.
//
// ═══════════════════════════ CONTRATO: BOLLITA ═══════════════════════════
// (la forma del mundo está al inicio de world.js)
// b = {
//   id, name, gen, arch { key, hi, title }, genome, p, e (0..100), age, visits, score, cause, bornAt,
//   genome: { traits { valentia, curiosidad, apetito, sociabilidad, animo, velocidad }, hue,
//             prefs[destino.idx], ways[way.idx], routes[route.idx], kinds[índice en OBSTACLES] }  (todo 0..1)
//   pos, dir, up: THREE.Vector3 siempre válidos. En la ciudad `up` es la normal de la esfera; en un tubo
//                 apunta de la pared al eje (la bollita rueda por la pared); en el aire, hacia +Y.
//   phase, timer (segundos restantes estimados), dur (duración estimada de la fase)
//   speed: velocidad actual (unidades/s); roll: ángulo (rad) de balanceo dentro del tubo, 0 = abajo;
//   mood, thought { text, emoji, until }, react, log[], flags
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
const TRAITS = ['valentia', 'curiosidad', 'apetito', 'sociabilidad', 'animo', 'velocidad']
const GENES = ['prefs', 'ways', 'routes', 'kinds']
// Equilibrio: un ciclo destino + viaje dura ~35 s y sólo rinde un destino, así que el desgaste es lento.
const DRAIN_E = 0.42 // energía/s siempre
const DRAIN_P = 0.43 // puntos/s siempre
const TRAVEL_E = 0.2 // energía/s extra rodando (× ecost del tema)
const PPS_K = 0.35 // escala de los puntos/s del tema
// Física del tubo
const GRAV = 16
const FRIC = 0.3
const VMAX = 30
const ROLL_K = 40 // muelle que lleva la bollita hacia donde la empujan gravedad y centrífuga
const ROLL_C = 5 // amortiguación: oscila un par de veces y se asienta
const WOW = ['canon', 'trampolin', 'rizo', 'caida', 'embudo'] // obstáculos que merecen comentario
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
      visited: [node.idx], log: [], flags: {},
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
    const v = voice(b, event, ctx, this.rng)
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
    b.dest = best; b.way = b.route = b.seg = null
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

  goWay(b) {
    const g = b.genome; const t = g.traits
    let best = null; let bs = -Infinity
    for (const L of this.world.waysFrom[b.node]) {
      const cost = this.eta(b, L) * (DRAIN_E + TRAVEL_E * L.theme.ecost)
      const sc = g.ways[L.idx] * 0.8
        + t.curiosidad * (b.visited.includes(L.to) ? 0 : 0.6)
        + t.valentia * L.theme.risk * 0.7
        - (b.e - cost < 10 ? 3 : 0)
        + this.rng() * 0.3
      if (sc > bs) { bs = sc; best = L }
    }
    b.way = best
    this.walkTo(b, this.world.nodes[b.node].portTo[best.to].out, 'toPort')
    this.say(b, 'camino', { c: best.theme.name, n: this.world.nodes[best.to].name })
  }

  // ───────────── circuito: rodar por los tubos ─────────────
  eta(b, way) { return way.length / (this.cruise(b) + 4) }

  enterSeg(b, seg) {
    if (b.phase !== 'travel') { b.phase = 'travel'; b.dur = b.timer = this.eta(b, b.way); b.snap = 0.3; b.prevT.set(0, 0, 0) }
    b.seg = seg; b.segT = 0
    if (seg.route >= 0) b.route = b.way.routes[seg.route]
    b.speed = Math.max(b.speed, seg.boost, this.cruise(b))
    if (WOW.includes(seg.kind)) this.say(b, seg.kind)
  }

  // En cada bifurcación: genes de ruta y de obstáculo, valentía ante el riesgo y un punto de curiosidad.
  pickNext(b) {
    const g = b.genome; const t = g.traits; const way = b.way
    let best = null; let bs = -Infinity
    for (const i of b.seg.next) {
      const o = way.segments[i]
      const sc = (o.route < 0 ? 0 : g.routes[way.routes[o.route].idx] * 0.8
        + mean(o.tramo, (k) => g.kinds[OBSTACLES.indexOf(k)]) * 0.6
        + t.valentia * mean(o.tramo, (k) => KINDS[k].risk) * 0.6)
        + this.rng() * (0.15 + t.curiosidad * 0.6)
      if (sc > bs) { bs = sc; best = o }
    }
    return best
  }

  travelStep(b, dt) {
    const L = b.way
    let s = b.seg
    b.e -= TRAVEL_E * L.theme.ecost * dt
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
    b.speed = clamp(b.speed, this.cruise(b) * (s.kind === 'embudo' ? 0.6 : 1), VMAX)

    // balanceo: la bollita busca el punto de la pared hacia el que la aprietan gravedad y centrífuga
    const w = b.wall
    w.addScaledVector(T, -w.dot(T))
    if (w.lengthSq() < 1e-6) w.crossVectors(T, Math.abs(T.y) > 0.9 ? tmp.set(1, 0, 0) : Y)
    w.normalize()
    const down = tmp.copy(Y).addScaledVector(T, -T.y).negate() // gravedad proyectada en la sección del tubo
    const push = tmp2.copy(down).multiplyScalar(GRAV)
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
