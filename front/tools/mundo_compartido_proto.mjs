// Prototipo del mundo compartido (docs/mundo_compartido.md). NO es código de producción: mide y demuestra.
//   node tools/mundo_compartido_proto.mjs [semilla=369] [minutosSimulados=10]
// Mide: buildWorld (frío y con elecciones), ms por tick de sim.js en Node, bytes de la instantánea (JSON, gzip, deflate,
// brotli), error de interpolación a 5/10/20 Hz (lineal en mundo frente a paramétrica sobre la pista), determinismo
// (misma semilla + mismas entradas => mismo estado) y las reglas de control (fila, decisiones, 3 rutas sin decidir)
// sobre una subclase de Sim (SimMundo) que es el borrador de los cambios de sim.js.
import { performance } from 'node:perf_hooks'
import { createHash } from 'node:crypto'
import { gzipSync, deflateRawSync, brotliCompressSync } from 'node:zlib'
import { Sim, TRAVEL_SLOW } from '../src/Core/sim.js'
import { mulberry32, buildWorld, setWorldPicks, laneFrame, switchPath, CARRILES, BALL_R } from '../src/Core/world.js'

const SEED = Number(process.argv[2] || 369)
const MINUTOS = Number(process.argv[3] || 10)
const HZ = 30 // tick fijo del servidor
const DT = 1 / HZ

// ───────────────────────── borrador de los cambios de sim.js ─────────────────────────
const MAX_SIN_DECIDIR = 3
export class SimMundo extends Sim {
  constructor(o) { super(o); this.fila = []; this.eventos = [] }

  // ── fila ──
  formar(espectador, nombre) {
    if (this.fila.some((f) => f.espectador === espectador)) return { ok: false, error: 'ya_en_fila' }
    const limpio = String(nombre || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16)
    if (!limpio) return { ok: false, error: 'nombre' }
    this.fila.push({ espectador, nombre: limpio, t: this.t })
    return { ok: true, puesto: this.fila.length }
  }

  spawn() {
    const b = super.spawn()
    b.ctrl = null; b.formadaPor = null; b.dec = {}; b.sinDecidir = 0; b.viajeDecidido = false; b.rutaFija = null; b.carrilFijo = null
    const f = this.fila?.shift() // en el constructor de Sim aún no hay fila
    if (f) {
      let n = f.nombre; for (let i = 2; this.nombres.has(n); i++) n = `${f.nombre} ${i}`
      this.nombres.add(n); b.name = n; b.formadaPor = f.espectador
      if (!this.ballitas.some((o) => o.ctrl === f.espectador)) b.ctrl = f.espectador // un control por espectador
      this.eventos.push({ t: this.t, k: 'entra', id: b.id, de: f.espectador })
    }
    return b
  }

  // ── control ──
  tomar(id, espectador) {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || b.phase === 'dying' || b.phase === 'gone') return { ok: false, error: 'no_existe' }
    if (b.ctrl) return { ok: false, error: 'ocupada' }
    if (this.ballitas.some((o) => o.ctrl === espectador)) return { ok: false, error: 'ya_controlas' }
    b.ctrl = espectador; b.sinDecidir = 0; b.dec = {}
    return { ok: true }
  }

  dejar(id, espectador, motivo = 'dejar') {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || b.ctrl !== espectador) return { ok: false, error: 'no_controlas' }
    b.ctrl = null; b.dec = {}; b.sinDecidir = 0
    this.eventos.push({ t: this.t, k: 'libre', id, motivo })
    return { ok: true }
  }

  // dec = { destino?: idx de nodo | null, ruta?: { way, r } | null, carril?: 0..4 | null }; null borra esa decisión.
  decidir(id, espectador, dec) {
    const b = this.ballitas.find((o) => o.id === id)
    if (!b || b.ctrl !== espectador) return { ok: false, error: 'no_controlas' }
    const origen = b.phase === 'toPort' || b.phase === 'travel' ? b.way.to : b.node // de dónde saldrá el siguiente viaje
    const n = { ...b.dec }
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
        n.ruta = { way: w.idx, r: dec.ruta.r }; n.destino = w.to // la ruta fija también el planeta
      }
    }
    if ('carril' in dec) {
      if (dec.carril == null) delete n.carril
      else if (!Number.isInteger(dec.carril) || dec.carril < 0 || dec.carril >= CARRILES) return { ok: false, error: 'carril' }
      else n.carril = dec.carril
    }
    if (n.ruta && n.destino !== this.world.ways[n.ruta.way].to) delete n.ruta // cambió el planeta: la ruta ya no aplica
    b.dec = n
    return { ok: true, dec: n }
  }

  // ── ganchos: misma decisión automática, restringida a lo que eligió el controlador ──
  goWay(b) {
    const d = b.ctrl ? b.dec : {}
    let ways = this.world.waysFrom[b.node]; let ruta = null; const usado = []
    if (d.ruta) {
      const w = ways.find((x) => x.idx === d.ruta.way)
      if (w?.routes[d.ruta.r]) { ways = [w]; ruta = w.routes[d.ruta.r]; usado.push('ruta', 'destino') }
    }
    if (!ruta && d.destino != null) {
      const w = ways.filter((x) => x.to === d.destino)
      if (w.length) { ways = w; usado.push('destino') }
    }
    const peers = this.peerCounts(b)
    let best = null; let bs = -Infinity
    for (const way of ways) {
      for (const route of ruta ? [ruta] : way.routes) {
        for (const nextDest of this.world.nodes[way.to].destinos) {
          const u = this.planUtility(b, way, route, nextDest, peers, 1)
          if (u.total > bs) { bs = u.total; best = { way, route, nextDest, razon: u.razon } }
        }
      }
    }
    b.way = best.way; b.plannedRoute = best.route; b.nextDest = best.nextDest
    b.rutaFija = ruta
    b.carrilFijo = d.carril ?? null; if (d.carril != null) usado.push('carril')
    b.viajeDecidido = usado.length > 0
    b.dec = {} // las decisiones son de un solo uso
    const destNode = this.world.nodes[best.way.to]
    b.plan = {
      destino: `${destNode.name} · ${best.nextDest.name}`, ruta: `${best.way.theme.name} · Ruta ${best.route.name}`,
      razon: usado.length ? 'lo decidió quien me controla' : best.razon, manual: usado,
    }
    this.walkTo(b, this.world.nodes[b.node].portTo[best.way.to].out, 'toPort')
    this.say(b, 'camino', { c: best.way.theme.name, n: destNode.name })
  }

  pickNext(b) {
    if (b.rutaFija) {
      const i = b.seg.next.find((j) => b.way.segments[j].route === b.rutaFija.r)
      if (i != null) return b.way.segments[i] // en fork y en cross sigue la ruta decidida
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
    if (!b.flight) b.carrilFijo = null // aterrizó de un evento: carril al azar, como hoy
  }

  arrive(b) {
    if (b.ctrl) {
      const pendientes = Object.keys(b.dec).length > 0
      if (b.viajeDecidido || pendientes) b.sinDecidir = 0
      else if (++b.sinDecidir >= MAX_SIN_DECIDIR) this.dejar(b.id, b.ctrl, 'inactivo')
    }
    b.viajeDecidido = false; b.rutaFija = null; b.carrilFijo = null
    super.arrive(b)
  }
}

// ───────────────────────── instantánea ─────────────────────────
const FASES = ['born', 'toDest', 'at', 'toPort', 'travel', 'dying', 'gone']
const r2 = (x) => Math.round(x * 100) / 100
const r3 = (x) => Math.round(x * 1000) / 1000
const r5 = (x) => Math.round(x * 1e5) / 1e5
const v3 = (v) => [r2(v.x), r2(v.y), r2(v.z)]
const u3 = (v) => [r3(v.x), r3(v.y), r3(v.z)]

// Parte RÁPIDA (cada instantánea): tupla posicional. Parte LENTA (solo al cambiar): objeto con nombres.
export function rapido(b) {
  const f = b.flight
  return [
    b.id, FASES.indexOf(b.phase), r2(b.p), r2(b.e), r2(b.speed), r2(b.timer),
    v3(b.pos), u3(b.dir), u3(b.up),
    b.seg ? b.seg.i : -1, r5(b.segT), b.lane, b.carril, r3(b.lat), r3(b.hy), r3(b.off), r3(b.ang), r3(b.roll), r3(b.slope),
    r2(b.impact), r2(b.vis), (b.airborne ? 1 : 0) | (b.onLane ? 2 : 0) | (f ? 4 : 0) | (f?.failed ? 8 : 0),
    f ? b.seg.switches.indexOf(f.sw) : -1, f ? r3(f.t) : 0,
    b.walk ? b.walk.i : -1, b.walk ? r3(b.walk.t) : 0,
  ]
}
export function lento(b) {
  return {
    id: b.id, name: b.name, gen: b.gen, padres: b.padres, arch: b.arch, genome: b.genome, bornAt: r2(b.bornAt),
    node: b.node, vert: b.vert, dest: b.dest?.idx ?? null, way: b.way?.idx ?? null, route: b.route?.idx ?? null,
    plannedRoute: b.plannedRoute?.idx ?? null, nextDest: b.nextDest?.idx ?? null,
    walk: b.walk ? b.walk.path : null, dur: r2(b.dur), plan: b.plan, mood: b.mood, thought: b.thought, react: b.react,
    age: r2(b.age), score: r2(b.score), visits: b.visits, cause: b.cause, visited: b.visited, mechs: b.mechs,
    lastSwitch: b.lastSwitch ?? null, log: b.log.slice(0, 8),
    ctrl: b.ctrl ?? null, formadaPor: b.formadaPor ?? null, dec: b.dec ?? {}, sinDecidir: b.sinDecidir ?? 0,
  }
}
const tam = (o) => {
  const s = Buffer.from(JSON.stringify(o))
  return { json: s.length, gzip: gzipSync(s).length, deflate: deflateRawSync(s).length, brotli: brotliCompressSync(s).length }
}
const hash = (sim) => createHash('sha1').update(JSON.stringify({
  t: sim.t, stats: sim.stats, pool: sim.pool.map((x) => [x.id, x.fitness]), fila: sim.fila,
  b: sim.ballitas.map((b) => [b.id, b.name, b.phase, b.p, b.e, b.age, b.pos.x, b.pos.y, b.pos.z, b.seg?.idx ?? -1, b.segT, b.lane, b.carril, b.ctrl]),
})).digest('hex').slice(0, 16)
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0 }
const media = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

// Entradas deterministas (función del número de tick): forman, deciden, toman y dejan.
function entradas(sim, n, variante = 0) {
  if (n % 900 === 30) sim.formar(`e${(n / 900) % 4 | 0}`, `Forma ${n / 900 | 0}`)
  if (n % 240 === 7) {
    for (const b of sim.ballitas) {
      if (!b.ctrl || b.ctrl === 'e3') continue // e3 nunca decide: debe perder el control a las 3 rutas
      const origen = b.phase === 'toPort' || b.phase === 'travel' ? b.way.to : b.node
      const ws = sim.world.waysFrom[origen]; const w = ws[((n / 240 | 0) + variante) % ws.length]
      const k = (n / 240 | 0) % 3
      if (k === 0) sim.decidir(b.id, b.ctrl, { destino: w.to })
      else if (k === 1) sim.decidir(b.id, b.ctrl, { ruta: { way: w.idx, r: 0 }, carril: 2 })
      else sim.decidir(b.id, b.ctrl, { carril: 4 })
    }
  }
  if (n % 3000 === 1500) { const libre = sim.ballitas.find((b) => !b.ctrl && b.phase !== 'dying'); if (libre) sim.tomar(libre.id, 'e9') }
}

function correr(seed, ticks, variante = 0) {
  const sim = new SimMundo({ rng: mulberry32(seed), seed: SEED })
  for (let n = 0; n < ticks; n++) { entradas(sim, n, variante); sim.tick(DT) }
  return sim
}

// ───────────────────────── mediciones ─────────────────────────
const out = { node: process.version, semilla: SEED, hz: HZ, minutosSimulados: MINUTOS }

let t0 = performance.now()
const w0 = buildWorld(SEED)
out.buildWorldFrioMs = Math.round(performance.now() - t0)
out.picksBytes = tam(w0.picks)
setWorldPicks(SEED, w0.picks)
t0 = performance.now(); buildWorld(SEED); out.buildWorldConPicksMs = Math.round(performance.now() - t0)

// 1) costo del tick (sim con fila y decisiones activas) y de serializar
const N = Math.round(MINUTOS * 60 * HZ)
{
  const sim = new SimMundo({ rng: mulberry32(SEED), seed: SEED })
  for (let n = 0; n < 20 * HZ; n++) { entradas(sim, n); sim.tick(DT) } // calienta: nacen y entran a los caminos
  const ms = []; const ser = []; let bytesR = []; let gz = []; let df = []
  for (let n = 20 * HZ; n < N; n++) {
    entradas(sim, n)
    const a = performance.now(); sim.tick(DT); const b = performance.now()
    ms.push(b - a)
    if (n % 3 === 0) { // instantánea a 10 Hz
      const snap = { k: 'i', n, t: r3(sim.t), b: sim.ballitas.map(rapido) }
      const c = performance.now(); const s = Buffer.from(JSON.stringify(snap)); ser.push(performance.now() - c)
      bytesR.push(s.length)
      if (n % 30 === 0) { gz.push(gzipSync(s).length); df.push(deflateRawSync(s).length) }
    }
  }
  out.tick = { n: ms.length, mediaMs: +media(ms).toFixed(4), p50: +pct(ms, 0.5).toFixed(4), p99: +pct(ms, 0.99).toFixed(4), maxMs: +Math.max(...ms).toFixed(3) }
  out.tick.cpuPct30Hz = +((out.tick.mediaMs * HZ) / 10).toFixed(2) // % de un núcleo
  out.tick.ticksPorSegundo = Math.round(1000 / out.tick.mediaMs)
  out.serializarMs = { media: +media(ser).toFixed(4), p99: +pct(ser, 0.99).toFixed(4) }
  out.instantaneaRapida = { ballitas: sim.ballitas.length, jsonMedia: Math.round(media(bytesR)), jsonMax: Math.max(...bytesR), gzipMedia: Math.round(media(gz)), deflateMedia: Math.round(media(df)) }
  out.instantaneaRapida.kbPorSegundo10Hz = { json: +((media(bytesR) * 10) / 1024).toFixed(1), deflate: +((media(df) * 10) / 1024).toFixed(1) }
  const lentos = sim.ballitas.map(lento)
  out.estadoLento = { porBallita: tam(lentos[0]), las10: tam(lentos) }
  out.instantaneaCompleta = tam({ k: 'hola', n: N, t: sim.t, b: sim.ballitas.map((b) => ({ ...lento(b), r: rapido(b) })), fila: sim.fila, stats: sim.stats, feed: sim.feed })
  out.ingenuo = tam(sim.ballitas.map((b) => ({ ...lento(b), pos: b.pos, dir: b.dir, up: b.up, phase: b.phase, p: b.p, e: b.e, speed: b.speed, segT: b.segT, seg: b.seg?.idx, lane: b.lane, carril: b.carril, lat: b.lat, hy: b.hy, off: b.off, ang: b.ang, log: b.log })))
  out.poblacion = { muertas: sim.stats.muertas, nacidas: sim.stats.nacidas, muertesPorMinuto: +(sim.stats.muertas / (sim.t / 60)).toFixed(2), segundosEntreMuertes: +(sim.t / Math.max(1, sim.stats.muertas)).toFixed(1) }
  out.control = {
    entraronDeLaFila: sim.eventos.filter((e) => e.k === 'entra').length,
    liberadasPorInactividad: sim.eventos.filter((e) => e.k === 'libre' && e.motivo === 'inactivo').length,
    filaAlFinal: sim.fila.length,
  }
}

// 2) decisiones: ¿se cumplen? (planeta, ruta completa de fork a merge, carril hasta el primer evento)
{
  const sim = new SimMundo({ rng: mulberry32(SEED + 1), seed: SEED })
  const r = { viajes: 0, destinoOk: 0, rutaOk: 0, rutaTotal: 0, carrilOk: 0, carrilTotal: 0 }
  sim.tomar(sim.ballitas[0].id, 'yo')
  const vigila = new Map() // id -> { destino, ruta, carril, rutasVistas }
  for (let n = 0; n < 40 * 60 * HZ; n++) {
    const mia = sim.ballitas.find((b) => b.ctrl === 'yo')
    if (!mia) { const l = sim.ballitas.find((b) => !b.ctrl && b.phase !== 'dying'); if (l) sim.tomar(l.id, 'yo') }
    if (mia && mia.phase === 'at' && !Object.keys(mia.dec).length) {
      const ws = sim.world.waysFrom[mia.node]; const w = ws[r.viajes % ws.length]; const ri = r.viajes % w.routes.length
      sim.decidir(mia.id, 'yo', { ruta: { way: w.idx, r: ri }, carril: r.viajes % CARRILES })
      vigila.set(mia.id, { to: w.to, r: ri, carril: r.viajes % CARRILES, vistas: new Set(), carrilVisto: null, llego: false })
    }
    const antes = mia ? { phase: mia.phase, node: mia.node } : null
    sim.tick(DT)
    if (mia && vigila.has(mia.id)) {
      const v = vigila.get(mia.id)
      if (mia.phase === 'travel') {
        if (mia.seg.route >= 0) v.vistas.add(mia.seg.route)
        if (v.carrilVisto == null && !mia.flight) v.carrilVisto = mia.carril
      }
      if (antes.phase === 'travel' && mia.phase !== 'travel' && mia.phase !== 'dying') {
        r.viajes++; if (mia.node === v.to) r.destinoOk++
        r.rutaTotal++; if (v.vistas.size === 1 && v.vistas.has(v.r)) r.rutaOk++
        r.carrilTotal++; if (v.carrilVisto === v.carril) r.carrilOk++
        vigila.delete(mia.id)
      }
    }
  }
  out.decisiones = r
}

// 2b) inactividad: quien controla y nunca decide pierde el control al completar 3 rutas
{
  const sim = new SimMundo({ rng: mulberry32(SEED + 2), seed: SEED })
  const res = []
  for (let n = 0; n < 60 * 60 * HZ && res.length < 3; n++) {
    if (!sim.ballitas.some((b) => b.ctrl === 'mudo')) {
      const l = sim.ballitas.find((b) => !b.ctrl && b.phase !== 'dying' && b.phase !== 'born')
      if (l) { sim.tomar(l.id, 'mudo'); l._t0 = sim.t; l._llegadas = 0 }
    }
    const mia = sim.ballitas.find((b) => b.ctrl === 'mudo'); const fase = mia?.phase
    sim.tick(DT)
    if (mia && fase === 'travel' && mia.phase !== 'travel' && mia.phase !== 'dying') mia._llegadas++
    if (mia && !mia.ctrl && mia.phase !== 'dying' && mia.phase !== 'gone') res.push({ llegadas: mia._llegadas, segundos: Math.round(sim.t - mia._t0) })
  }
  out.inactividad = res
}

// 3) determinismo
{
  const n = Math.min(N, 5 * 60 * HZ)
  const a = hash(correr(SEED, n)); const b = hash(correr(SEED, n))
  const c = hash(correr(SEED, n, 1)) // mismas entradas salvo el planeta elegido
  const d = hash(correr(SEED + 1, n))
  out.determinismo = { ticks: n, corridaA: a, corridaB: b, iguales: a === b, entradaUnTickDespues: c, divergeConEntradaDistinta: a !== c, otraSemilla: d, divergeConOtraSemilla: a !== d }
}

// 4) error de interpolación: verdad a 30 Hz, instantáneas cada k ticks
{
  const sim = new SimMundo({ rng: mulberry32(SEED), seed: SEED })
  for (let n = 0; n < 20 * HZ; n++) sim.tick(DT)
  const cuadros = []
  for (let n = 0; n < 3 * 60 * HZ; n++) {
    sim.tick(DT)
    cuadros.push(new Map(sim.ballitas.map((b) => [b.id, {
      pos: b.pos.clone(), phase: b.phase, seg: b.seg, segT: b.segT, lane: b.lane, lat: b.lat, hy: b.hy, snap: b.snap,
      fsw: b.flight?.sw ?? null, ft: b.flight?.t ?? 0, speed: b.speed,
    }])))
  }
  const F = {}; const P = {}
  out.interpolacion = {}
  for (const k of [6, 3, 2]) { // 5, 10 y 15 Hz
    const lin = []; const par = []; const linViaje = []; const puro = []; let respaldo = 0
    for (let i = 0; i + k < cuadros.length; i += k) {
      const A = cuadros[i]; const B = cuadros[i + k]
      for (let j = 1; j < k; j++) {
        const u = j / k
        for (const [id, real] of cuadros[i + j]) {
          const a = A.get(id); const b = B.get(id)
          if (!a || !b || real.snap > 0 || a.snap > 0 || b.snap > 0) continue
          const eLin = a.pos.clone().lerp(b.pos, u).distanceTo(real.pos)
          lin.push(eLin)
          if (real.phase !== 'travel') { par.push(eLin); continue }
          linViaje.push(eLin)
          let p = null
          if (a.fsw && a.fsw === b.fsw && a.seg === b.seg) p = switchPath(a.seg, a.fsw, a.ft + (b.ft - a.ft) * u, P).pos
          else if (!a.fsw && !b.fsw && a.seg === b.seg && a.lane === b.lane && a.phase === 'travel' && b.phase === 'travel') {
            const fr = laneFrame(a.seg, a.lane, a.segT + (b.segT - a.segT) * u, F)
            p = fr.pos.clone().addScaledVector(fr.side, a.lat + (b.lat - a.lat) * u).addScaledVector(fr.up, a.hy + (b.hy - a.hy) * u)
          }
          par.push(p ? p.distanceTo(real.pos) : eLin); if (p) puro.push(p.distanceTo(real.pos)); else respaldo++
        }
      }
    }
    const res = (xs) => ({ media: +media(xs).toFixed(3), p99: +pct(xs, 0.99).toFixed(3), max: +Math.max(...xs).toFixed(3) })
    out.interpolacion[`${HZ / k}Hz`] = { muestras: lin.length, linealTodo: res(lin), linealEnViaje: res(linViaje), parametrica: res(par), parametricaSinRespaldo: res(puro), pctRespaldoLineal: +((100 * respaldo) / Math.max(1, linViaje.length)).toFixed(2) }
  }
  out.interpolacion.radioBallita = BALL_R
  out.interpolacion.velocidadMaxVista = +Math.max(...cuadros.flatMap((c) => [...c.values()].map((x) => x.speed * (x.phase === 'travel' ? TRAVEL_SLOW : 1)))).toFixed(1)
}

console.log(JSON.stringify(out, null, 2))
