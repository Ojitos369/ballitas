// Protocolo del mundo compartido (docs/mundo_compartido.md, sección 2). Lo usan el servidor (back/mundo/servidor.mjs)
// y el cliente (Core/mundo/remoto.js). Sin dependencias: solo lee campos de la ballita y devuelve datos planos.
// Tramas de texto JSON; todo mensaje lleva `k`. Los del cliente pueden llevar `q`, que vuelve en `ok` o `error`.
export const V = 1
export const HZ = 30 // ticks por segundo del servidor
export const CADA = 3 // ticks por instantánea rápida (10 Hz)
export const MAX_BYTES = 512 // por mensaje del cliente
export const MAX_RITMO = 5 // mensajes por segundo y conexión
export const PLAZO_HOLA = 5000 // ms para enviar `hola`
export const PING_CADA = 25000 // ms (el túnel corta conexiones inactivas a los 100 s)
export const MAX_LOG = 8 // entradas del registro de cada ballita que viajan
export const FASES = ['born', 'toDest', 'at', 'toPort', 'travel', 'dying']
export const CLIENTE = ['hola', 'formar', 'salirFila', 'tomar', 'dejar', 'decidir', 'ping']
export const ERRORES = [
  'ya_en_fila', 'nombre', 'fila_llena', 'no_existe', 'ocupada', 'ya_controlas', 'no_controlas', 'destino', 'ruta', 'carril',
  'ritmo', 'tamano', 'formato', 'hola', 'version', 'desconocido',
]
// Índices de la tupla `Rapida`
export const R = {
  id: 0, fase: 1, p: 2, e: 3, speed: 4, timer: 5, pos: 6, dir: 7, up: 8, seg: 9, segT: 10, lane: 11, carril: 12, lat: 13,
  hy: 14, off: 15, ang: 16, roll: 17, slope: 18, impact: 19, vis: 20, banderas: 21, evento: 22, flightT: 23, walkI: 24, walkT: 25,
}
export const B_AIRBORNE = 1; export const B_ONLANE = 2; export const B_VUELO = 4; export const B_FALLIDO = 8

const r2 = (x) => Math.round(x * 100) / 100 || 0 // `|| 0` quita el -0 y los NaN (JSON no los admite)
const r3 = (x) => Math.round(x * 1000) / 1000 || 0
const r5 = (x) => Math.round(x * 1e5) / 1e5 || 0
const v2 = (v) => [r2(v.x), r2(v.y), r2(v.z)]
const v3 = (v) => [r3(v.x), r3(v.y), r3(v.z)]

// Parte RÁPIDA de una ballita (cada instantánea): tupla posicional.
export function rapida(b) {
  const f = b.flight
  return [
    b.id, Math.max(0, FASES.indexOf(b.phase)), r2(b.p), r2(b.e), r2(b.speed), r2(b.timer),
    v2(b.pos), v3(b.dir), v3(b.up),
    b.seg ? b.seg.i : -1, r5(b.segT), b.lane, b.carril, r3(b.lat), r3(b.hy), r3(b.off), r3(b.ang), r3(b.roll), r3(b.slope),
    r2(b.impact), r2(b.vis), (b.airborne ? B_AIRBORNE : 0) | (b.onLane ? B_ONLANE : 0) | (f ? B_VUELO : 0) | (f?.failed ? B_FALLIDO : 0),
    f && b.seg ? b.seg.switches.indexOf(f.sw) : -1, f ? r3(f.t) : 0,
    b.walk ? b.walk.i : -1, b.walk ? r3(b.walk.t) : 0,
  ]
}

// Tupla -> objeto con nombres (índices sin resolver contra el mundo: eso lo hace el adaptador remoto).
export function leerRapida(r) {
  const fl = r[R.banderas]
  return {
    id: r[R.id], phase: FASES[r[R.fase]], p: r[R.p], e: r[R.e], speed: r[R.speed], timer: r[R.timer],
    pos: r[R.pos], dir: r[R.dir], up: r[R.up], seg: r[R.seg], segT: r[R.segT], lane: r[R.lane], carril: r[R.carril],
    lat: r[R.lat], hy: r[R.hy], off: r[R.off], ang: r[R.ang], roll: r[R.roll], slope: r[R.slope], impact: r[R.impact], vis: r[R.vis],
    airborne: !!(fl & B_AIRBORNE), onLane: !!(fl & B_ONLANE), enVuelo: !!(fl & B_VUELO), fallido: !!(fl & B_FALLIDO),
    evento: r[R.evento], flightT: r[R.flightT], walkI: r[R.walkI], walkT: r[R.walkT],
  }
}

const idx = (o) => (o ? o.idx : null)
const corto = (cortoDe, e) => (e == null ? null : cortoDe ? cortoDe(e) : e)

// Parte LENTA (al nacer y cuando cambia algún campo). `cortoDe(espectador)` convierte el id secreto en el público;
// `auto` es sim.predecir(b) ya resuelto (o null). El id secreto NUNCA sale de aquí.
export function lenta(b, { cortoDe = null, auto = null } = {}) {
  return {
    id: b.id, name: b.name, gen: b.gen, padres: b.padres, arch: b.arch, genome: b.genome, bornAt: r2(b.bornAt),
    node: b.node, vert: b.vert, dest: idx(b.dest), way: idx(b.way), route: idx(b.route), plannedRoute: idx(b.plannedRoute),
    nextDest: idx(b.nextDest), walk: b.walk ? b.walk.path : null, dur: r2(b.dur), plan: b.plan, mood: b.mood,
    thought: b.thought ? { text: b.thought.text, emoji: b.thought.emoji, until: r2(b.thought.until) } : null,
    react: b.react ? { mood: b.react.mood, until: r2(b.react.until) } : null,
    age: Math.floor(b.age), score: Math.round(b.score), visits: b.visits, cause: b.cause, visited: b.visited, mechs: b.mechs,
    lastSwitch: b.lastSwitch ? { ...b.lastSwitch, until: r2(b.lastSwitch.until) } : null, log: b.log.slice(0, MAX_LOG),
    ctrl: corto(cortoDe, b.ctrl), formadaPor: corto(cortoDe, b.formadaPor), dec: b.dec ?? {}, sinDecidir: b.sinDecidir ?? 0,
    auto: auto ? { way: auto.way.idx, r: auto.route.r } : null,
  }
}

// Campos de `ahora` que difieren de `antes` (comparación por JSON de cada campo). Devuelve null si no cambió nada.
// `textos` guarda el JSON anterior de cada campo (lo mantiene quien llama, uno por ballita).
export function difLenta(textos, ahora) {
  let d = null
  for (const k in ahora) {
    if (k === 'id') continue
    const s = JSON.stringify(ahora[k])
    if (textos[k] !== s) { textos[k] = s; (d || (d = { id: ahora.id }))[k] = ahora[k] }
  }
  return d
}

// Aplica un parcial de `d.b` sobre el objeto lento que guarda el cliente.
export const aplicarLenta = (obj, parcial) => Object.assign(obj, parcial)

export const filaPublica = (fila, cortoDe) => fila.map((f) => ({ nombre: f.nombre, de: cortoDe(f.espectador), t: r2(f.t) }))
export const instantanea = (n, t, ballitas) => ({ k: 'i', n, t: r3(t), b: ballitas.map(rapida) })

// ── rutas dinámicas: qué sentidos (way.idx) están activos ──
// `hola.activas`: lista ordenada, o null si la sim las tiene apagadas (todas valen).
export const rutasActivas = (sim) => (sim.activas ? [...sim.activas].sort((a, b) => a - b) : null)
// Acumula cambios `{ on, off }` entre dos `d`: lo que aparece y desaparece en el mismo intervalo se anula.
export function acumularRutas(acc, cambio) {
  const a = acc || { on: [], off: [] }
  for (const i of cambio.on || []) { const k = a.off.indexOf(i); if (k >= 0) a.off.splice(k, 1); else if (!a.on.includes(i)) a.on.push(i) }
  for (const i of cambio.off || []) { const k = a.on.indexOf(i); if (k >= 0) a.on.splice(k, 1); else if (!a.off.includes(i)) a.off.push(i) }
  return a
}
// Aplica `d.rutas` sobre el Set del cliente; devuelve lo que cambió de verdad (para el evento y la animación).
export function aplicarRutas(set, cambio) {
  const on = []; const off = []
  for (const i of cambio?.on || []) if (Number.isInteger(i) && !set.has(i)) { set.add(i); on.push(i) }
  for (const i of cambio?.off || []) if (set.delete(i)) off.push(i)
  return { on, off }
}

const UUID = /^[0-9a-zA-Z_-]{8,64}$/
const entero = (x) => Number.isInteger(x)

// Valida la FORMA de un mensaje del cliente (el fondo lo valida la sim: ids existentes, destino, ruta...).
// Devuelve { m } con el mensaje saneado (solo los campos del contrato) o { error }.
export function validar(texto) {
  if (typeof texto !== 'string' || texto.length > MAX_BYTES) return { error: 'tamano' }
  let m
  try { m = JSON.parse(texto) } catch { return { error: 'formato' } }
  if (!m || typeof m !== 'object' || Array.isArray(m) || !CLIENTE.includes(m.k)) return { error: 'formato' }
  const q = entero(m.q) ? m.q : undefined
  const mal = (error = 'formato') => ({ error, q })
  switch (m.k) {
    case 'hola':
      if (m.v !== V) return mal('version')
      if (typeof m.id !== 'string' || !UUID.test(m.id)) return mal()
      return { m: { k: 'hola', q, v: V, id: m.id, epoca: typeof m.epoca === 'string' ? m.epoca.slice(0, 40) : undefined, n: entero(m.n) ? m.n : undefined } }
    case 'formar':
      if (typeof m.nombre !== 'string' || m.nombre.length > 64) return mal('nombre')
      return { m: { k: 'formar', q, nombre: m.nombre } }
    case 'salirFila': return { m: { k: 'salirFila', q } }
    case 'tomar': case 'dejar':
      if (!entero(m.b)) return mal('no_existe')
      return { m: { k: m.k, q, b: m.b } }
    case 'decidir': {
      if (!entero(m.b)) return mal('no_controlas')
      const dec = {}
      if ('destino' in m) { if (m.destino !== null && !entero(m.destino)) return mal('destino'); dec.destino = m.destino }
      if ('ruta' in m) {
        if (m.ruta !== null && !(m.ruta && typeof m.ruta === 'object' && entero(m.ruta.way) && entero(m.ruta.r))) return mal('ruta')
        dec.ruta = m.ruta === null ? null : { way: m.ruta.way, r: m.ruta.r }
      }
      if ('carril' in m) { if (m.carril !== null && !entero(m.carril)) return mal('carril'); dec.carril = m.carril }
      return { m: { k: 'decidir', q, b: m.b, dec } }
    }
    case 'ping': return { m: { k: 'ping', q, c: Number.isFinite(m.c) ? m.c : 0 } }
  }
  return mal()
}
