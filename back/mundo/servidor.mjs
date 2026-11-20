// Servidor autoritativo del mundo compartido (docs/mundo_compartido.md). Corre sim.js a 30 Hz y difunde por WebSocket
// una instantánea rápida a 10 Hz y los cambios lentos cuando los hay. FastAPI reenvía /ws hacia aquí (apis/mundo_ws.py).
//   node back/mundo/servidor.mjs            (desarrollo: importa la sim del front)
//   node back/mundo/servidor.bundle.mjs     (contenedor: un solo archivo, lo genera empaquetar.mjs)
// Variables: MUNDO_PUERTO (8379), MUNDO_HOST (127.0.0.1), MUNDO_SEMILLA (369), MUNDO_SEMILLA_RNG (al azar),
//   MUNDO_DATOS (../data: elecciones del mundo), MUNDO_API (http://127.0.0.1:8000/api; vacío = no registrar),
//   MUNDO_GRACIA_S (60), MUNDO_VELOCIDAD (1; ticks de sim por tick real, solo para pruebas), MUNDO_MAX_CONEXIONES (500).
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { performance } from 'node:perf_hooks'
// ruta relativa: back/ no tiene node_modules; `ws` vive en el front (y el empaquetado lo incluye)
import { WebSocketServer } from '../../front/node_modules/ws/wrapper.mjs'
import { Sim, MAX_SIN_DECIDIR, MAX_FILA, MAX_NOMBRE, GRACIA_DESCONEXION } from '../../front/src/Core/sim.js'
import { mulberry32, setWorldPicks, WORLD_GEN } from '../../front/src/Core/world.js'
import * as P from '../../front/src/Core/protocolo.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const ESTATICOS = new Set(['name', 'gen', 'padres', 'arch', 'genome', 'bornAt', 'formadaPor']) // no cambian tras nacer
const pct = (xs, q) => { const s = Float64Array.from(xs).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0 }

export async function crearServidor(o = {}) {
  const env = process.env
  const cfg = {
    puerto: Number(o.puerto ?? env.MUNDO_PUERTO ?? 8379),
    host: o.host ?? env.MUNDO_HOST ?? '127.0.0.1',
    semilla: Number(o.semilla ?? env.MUNDO_SEMILLA ?? 369),
    semillaRng: Number(o.semillaRng ?? env.MUNDO_SEMILLA_RNG ?? randomBytes(4).readUInt32LE(0)),
    datos: o.datos ?? env.MUNDO_DATOS ?? path.join(AQUI, '..', 'data'),
    api: o.api ?? env.MUNDO_API ?? 'http://127.0.0.1:8000/api',
    gracia: Number(o.gracia ?? env.MUNDO_GRACIA_S ?? GRACIA_DESCONEXION),
    velocidad: Math.max(1, Math.round(Number(o.velocidad ?? env.MUNDO_VELOCIDAD ?? 1))),
    maxConexiones: Number(o.maxConexiones ?? env.MUNDO_MAX_CONEXIONES ?? 500),
    log: o.log ?? ((...a) => console.log(new Date().toISOString(), ...a)),
  }
  const t0 = performance.now()

  // ── mundo: elecciones guardadas (arranque en ~3 s en vez de ~9 s) ──
  const archivoPicks = path.join(cfg.datos, `picks_${WORLD_GEN}_${cfg.semilla}.json`)
  let conPicks = false
  try {
    const picks = JSON.parse(fs.readFileSync(archivoPicks, 'utf8'))
    if (Array.isArray(picks) && picks.length) { setWorldPicks(cfg.semilla, picks); conPicks = true }
  } catch { /* primera vez: se calculan */ }
  const sim = new Sim({ rng: mulberry32(cfg.semillaRng), seed: cfg.semilla })
  if (!conPicks) {
    try { fs.mkdirSync(cfg.datos, { recursive: true }); fs.writeFileSync(archivoPicks, JSON.stringify(sim.world.picks)) } catch (e) { cfg.log('no se pudieron guardar las elecciones:', e.message) }
  }
  const epoca = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
  const arranqueMs = Math.round(performance.now() - t0)
  cfg.log(`mundo listo en ${arranqueMs} ms (elecciones ${conPicks ? 'guardadas' : 'calculadas'}) semilla=${cfg.semilla} rng=${cfg.semillaRng} epoca=${epoca}`)

  // ── espectadores: id secreto -> { corto, conexiones, gracia } ──
  const cortos = new Map()
  const cortoDe = (id) => {
    let c = cortos.get(id)
    if (!c) { if (cortos.size > 5000) cortos.clear(); cortos.set(id, c = createHash('sha1').update(id).digest('hex').slice(0, 8)) }
    return c
  }
  const espectadores = new Map()
  const conectado = (id) => (espectadores.get(id)?.conexiones.size ?? 0) > 0
  const nConectados = () => { let n = 0; for (const e of espectadores.values()) if (e.conexiones.size) n++; return n }

  // ── estado difundido ──
  let n = 0 // tick de sim
  let cuadro = 0 // tick real
  const textos = new Map() // id de ballita -> JSON de cada campo lento ya enviado
  const autos = new Map() // id de ballita -> sim.predecir(b) (solo controladas; se refresca una vez por segundo)
  let eventos = [] // { k: 'entra' | 'libre', b, de?, motivo? } desde el último `d`
  const ultimo = { fila: '[]', stats: '', feed: '', espectadores: -1 }
  const reglas = { maxSinDecidir: MAX_SIN_DECIDIR, maxFila: MAX_FILA, maxNombre: MAX_NOMBRE }
  const lentaDe = (b) => P.lenta(b, { cortoDe, auto: autos.get(b.id) ?? null })
  const refrescarAuto = (b) => { if (b.ctrl) autos.set(b.id, sim.predecir(b)); else autos.delete(b.id) }
  const feedPublico = () => sim.feed.map((f) => ({ t: Math.round(f.t * 100) / 100, text: f.text }))

  sim.hooks.entra = (b, esp) => {
    // nació de la fila pero su dueño no está conectado: nace sin controlador (3.1.6)
    if (b.ctrl === esp && !conectado(esp)) { sim.dejar(b.id, esp, 'desconectado'); return }
    if (b.ctrl === esp) eventos.push({ k: 'entra', b: b.id, de: cortoDe(esp) })
  }
  sim.hooks.libre = (b, motivo) => { eventos.push({ k: 'libre', b: b.id, motivo }); autos.delete(b.id) }

  // ── registro en el back (lo que antes hacía cada navegador con iniciarBack); tolerante a fallos ──
  let caidoHasta = 0; let mundoBack = null
  async function pedir(metodo, ruta, cuerpo) {
    if (!cfg.api || Date.now() < caidoHasta) return null
    try {
      const r = await fetch(cfg.api + ruta, { method: metodo, signal: AbortSignal.timeout(4000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
      return r.ok ? await r.json() : null
    } catch { caidoHasta = Date.now() + 30000; return null }
  }
  const idMundo = async () => {
    if (!mundoBack) { const p = pedir('POST', '/mundos', { semilla: cfg.semilla, params: { pop: sim.pop, compartido: true, epoca, rng: cfg.semillaRng } }); mundoBack = p; const m = await p; if (!m && mundoBack === p) mundoBack = null }
    return (await mundoBack)?.id ?? null
  }
  const idsBack = new Map()
  if (cfg.api) {
    sim.hooks.nace = (b) => {
      const datos = { ref: b.id, nombre: b.name, genoma: b.genome, arquetipo: b.arch, padres: b.padres ?? [], generacion: b.gen }
      idsBack.set(b.id, idMundo().then(async (m) => (m ? (await pedir('POST', '/ballitas', { mundo_id: m, ...datos }))?.id ?? null : null)))
    }
    sim.hooks.muere = (b) => {
      const cambio = { estado: 'muerta', puntos: Math.round(b.score * 100) / 100, edad: Math.round(b.age * 10) / 10, causa: b.cause }
      idsBack.get(b.id)?.then((id) => id && pedir('PATCH', `/ballitas/${id}`, cambio)); idsBack.delete(b.id)
    }
    for (const b of sim.ballitas) sim.hooks.nace(b) // las del arranque nacieron antes de conectar los ganchos
  }

  // ── red ──
  const conexiones = new Set() // las que ya dijeron hola
  const httpServer = http.createServer((req, res) => {
    if (req.url === '/salud') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(salud())); return }
    res.writeHead(426, { 'Content-Type': 'text/plain' }); res.end('WebSocket')
  })
  const wss = new WebSocketServer({
    server: httpServer, maxPayload: 4096,
    // el relevo de FastAPI no la negocia (salto local); un cliente directo sí
    perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 }, concurrencyLimit: 8 },
  })
  const enviar = (ws, m) => { if (ws.readyState === 1) ws.send(typeof m === 'string' ? m : JSON.stringify(m)) }
  let bytesDifundidos = 0; let mensajesDifundidos = 0
  const difundir = (txt) => {
    for (const ws of conexiones) {
      if (ws.readyState !== 1) continue
      if (ws.bufferedAmount > 1 << 20) { ws.terminate(); continue } // cliente atascado: fuera (volverá con una bienvenida)
      ws.send(txt)
    }
    bytesDifundidos += txt.length; mensajesDifundidos++
  }

  function bienvenida(c, q) {
    return {
      k: 'hola', q, v: P.V, epoca, semilla: cfg.semilla, worldGen: WORLD_GEN, picks: sim.world.picks, hz: P.HZ, cada: P.CADA,
      n, t: Math.round(sim.t * 1000) / 1000, yo: { corto: c.corto },
      b: sim.ballitas.map((b) => ({ ...lentaDe(b), r: P.rapida(b) })), fila: P.filaPublica(sim.fila, cortoDe),
      stats: sim.stats, feed: feedPublico(), espectadores: nConectados(), reglas,
    }
  }

  function alHola(ws, c, m) {
    if (c.id) return enviar(ws, { k: 'error', q: m.q, error: 'hola' })
    clearTimeout(c.plazo)
    c.id = m.id; c.corto = cortoDe(m.id)
    let e = espectadores.get(c.id)
    if (!e) espectadores.set(c.id, e = { corto: c.corto, conexiones: new Set(), gracia: null })
    clearTimeout(e.gracia); e.gracia = null
    e.conexiones.add(ws); conexiones.add(ws)
    enviar(ws, bienvenida(c, m.q))
  }

  function alMensaje(ws, c, datos, binario) {
    // ritmo: 5 mensajes/s por conexión; el exceso responde `ritmo` y la reincidencia cierra
    const ahora = performance.now()
    c.fichas = Math.min(P.MAX_RITMO, c.fichas + ((ahora - c.visto) / 1000) * P.MAX_RITMO); c.visto = ahora
    if (c.fichas < 1) {
      if (ahora - c.ultimoExceso > 10000) c.excesos = 0
      c.ultimoExceso = ahora
      if (++c.excesos > P.MAX_RITMO * 2) return ws.close(1008, 'ritmo')
      return enviar(ws, { k: 'error', error: 'ritmo' })
    }
    c.fichas -= 1
    if (binario) return enviar(ws, { k: 'error', error: 'formato' })
    const v = P.validar(datos.toString('utf8'))
    if (v.error) return enviar(ws, { k: 'error', q: v.q, error: v.error })
    const m = v.m
    if (m.k === 'hola') return alHola(ws, c, m)
    if (!c.id) return enviar(ws, { k: 'error', q: m.q, error: 'hola' })
    let r
    switch (m.k) {
      case 'ping': return enviar(ws, { k: 'pong', q: m.q, c: m.c, n, t: Math.round(sim.t * 1000) / 1000 })
      case 'formar': r = sim.formar(c.id, m.nombre); break
      case 'salirFila': r = { ok: sim.salirFila(c.id).ok }; break
      case 'tomar': r = sim.tomar(m.b, c.id); { const b = r.ok && sim.viva(m.b); if (b) refrescarAuto(b) } break
      case 'dejar': r = sim.dejar(m.b, c.id); break
      case 'decidir': r = sim.decidir(m.b, c.id, m.dec); { const b = r.ok && sim.viva(m.b); if (b) refrescarAuto(b) } break
      default: r = { ok: false, error: 'desconocido' }
    }
    if (r.ok) { const { ok, ...resto } = r; enviar(ws, { k: 'ok', q: m.q, ...resto }) } else enviar(ws, { k: 'error', q: m.q, error: r.error })
  }

  function alCerrar(ws, c) {
    clearTimeout(c.plazo); conexiones.delete(ws)
    const e = c.id && espectadores.get(c.id)
    if (!e) return
    e.conexiones.delete(ws)
    if (e.conexiones.size) return
    const soltar = () => {
      for (const b of sim.ballitas) if (b.ctrl === c.id) sim.dejar(b.id, c.id, 'desconectado')
      if (!e.conexiones.size) espectadores.delete(c.id)
    }
    // sin ninguna conexión abierta: plazo de gracia para volver con el mismo id; la entrada en la fila sobrevive
    if (sim.controladas(c.id)) e.gracia = setTimeout(soltar, cfg.gracia * 1000)
    else espectadores.delete(c.id)
  }

  wss.on('connection', (ws) => {
    if (wss.clients.size > cfg.maxConexiones) return ws.close(1013, 'lleno')
    const c = { id: null, corto: null, fichas: P.MAX_RITMO, visto: performance.now(), excesos: 0, ultimoExceso: 0, plazo: null }
    c.plazo = setTimeout(() => ws.close(1008, 'hola'), P.PLAZO_HOLA)
    ws.on('message', (d, bin) => { try { alMensaje(ws, c, d, bin) } catch (e) { cfg.log('error en mensaje:', e.stack || e); enviar(ws, { k: 'error', error: 'desconocido' }) } })
    ws.on('close', () => alCerrar(ws, c))
    ws.on('error', () => ws.terminate())
  })

  // ── ciclo: sim a 30 Hz; cada 3 ticks reales, cambios lentos (`d`) y luego la instantánea (`i`) ──
  const msTick = new Float32Array(18000); let iTick = 0; let nTick = 0; let maxTick = 0
  const msDif = new Float32Array(6000); let iDif = 0; let nDif = 0

  function cambiosLentos() {
    const d = { k: 'd', n }; let hay = false
    if (cuadro % P.HZ === 0) for (const b of sim.ballitas) refrescarAuto(b)
    const vivos = new Set()
    for (const b of sim.ballitas) {
      vivos.add(b.id)
      let tx = textos.get(b.id)
      if (!tx) {
        textos.set(b.id, tx = {}); const l = lentaDe(b); P.difLenta(tx, l)
        ;(d.nace || (d.nace = [])).push({ ...l, r: P.rapida(b) }); hay = true
        continue
      }
      const l = lentaDe(b); for (const k of ESTATICOS) delete l[k]
      const dif = P.difLenta(tx, l)
      if (dif) { (d.b || (d.b = [])).push(dif); hay = true }
    }
    if (textos.size > vivos.size) for (const id of textos.keys()) if (!vivos.has(id)) { textos.delete(id); autos.delete(id) }
    const fila = JSON.stringify(P.filaPublica(sim.fila, cortoDe)); if (fila !== ultimo.fila) { ultimo.fila = fila; d.fila = JSON.parse(fila); hay = true }
    const stats = JSON.stringify(sim.stats); if (stats !== ultimo.stats) { ultimo.stats = stats; d.stats = sim.stats; hay = true }
    const feed = JSON.stringify(feedPublico()); if (feed !== ultimo.feed) { ultimo.feed = feed; d.feed = JSON.parse(feed); hay = true }
    const esp = nConectados(); if (esp !== ultimo.espectadores) { ultimo.espectadores = esp; d.espectadores = esp; hay = true }
    if (eventos.length) { d.ev = eventos; eventos = []; hay = true }
    return hay ? d : null
  }
  // estado inicial ya «enviado»: quien conecta lo recibe en la bienvenida
  for (const b of sim.ballitas) { const tx = {}; P.difLenta(tx, lentaDe(b)); textos.set(b.id, tx) }
  ultimo.stats = JSON.stringify(sim.stats); ultimo.feed = JSON.stringify(feedPublico()); ultimo.espectadores = 0

  function tickReal() {
    for (let k = 0; k < cfg.velocidad; k++) {
      const a = performance.now(); sim.tick(1 / P.HZ); const ms = performance.now() - a
      msTick[iTick] = ms; iTick = (iTick + 1) % msTick.length; nTick++; if (ms > maxTick) maxTick = ms
      n++
    }
    cuadro++
    if (cuadro % P.CADA) return
    const a = performance.now()
    const d = cambiosLentos()
    if (conexiones.size) {
      if (d) difundir(JSON.stringify(d))
      difundir(JSON.stringify(P.instantanea(n, sim.t, sim.ballitas)))
    }
    msDif[iDif] = performance.now() - a; iDif = (iDif + 1) % msDif.length; nDif++
  }
  // reloj sin deriva: si el proceso se retrasa recupera hasta 5 ticks; más allá los descarta (el mundo va más lento, no a saltos)
  const inicio = performance.now(); let hechos = 0
  const reloj = setInterval(() => {
    let debidos = Math.floor(((performance.now() - inicio) * P.HZ) / 1000) - hechos
    if (debidos > 5) { hechos += debidos - 5; debidos = 5 }
    for (; debidos > 0; debidos--) { hechos++; try { tickReal() } catch (e) { cfg.log('error en tick:', e.stack || e) } }
  }, 1000 / P.HZ / 2)

  const cpu0 = process.cpuUsage(); const reloj0 = performance.now()
  function salud() {
    const cpu = process.cpuUsage(cpu0); const m = process.memoryUsage()
    const ts = msTick.subarray(0, Math.min(nTick, msTick.length)); const ds = msDif.subarray(0, Math.min(nDif, msDif.length))
    return {
      ok: true, epoca, semilla: cfg.semilla, worldGen: WORLD_GEN, n, t: Math.round(sim.t), arranqueMs, conPicks, velocidad: cfg.velocidad,
      conexiones: conexiones.size, espectadores: nConectados(), ballitas: sim.ballitas.length, fila: sim.fila.length, stats: sim.stats,
      tickMs: { n: nTick, media: +(ts.reduce((a, b) => a + b, 0) / Math.max(1, ts.length)).toFixed(4), p50: +pct(ts, 0.5).toFixed(4), p99: +pct(ts, 0.99).toFixed(4), max: +maxTick.toFixed(3) },
      difusionMs: { n: nDif, media: +(ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length)).toFixed(4), p99: +pct(ds, 0.99).toFixed(4) },
      cpuPct: +(((cpu.user + cpu.system) / 1000 / (performance.now() - reloj0)) * 100).toFixed(2), cpuMs: Math.round((cpu.user + cpu.system) / 1000),
      vivoS: Math.round((performance.now() - reloj0) / 1000), rssMB: +(m.rss / 1048576).toFixed(1), heapMB: +(m.heapUsed / 1048576).toFixed(1),
      difundido: { mensajes: mensajesDifundidos, bytes: bytesDifundidos },
    }
  }

  await new Promise((ok, mal) => { httpServer.once('error', mal); httpServer.listen(cfg.puerto, cfg.host, ok) })
  const puerto = httpServer.address().port
  cfg.log(`escuchando ws://${cfg.host}:${puerto} (velocidad ${cfg.velocidad}x, gracia ${cfg.gracia} s, api ${cfg.api || 'sin registro'})`)
  const cerrar = () => new Promise((ok) => {
    clearInterval(reloj)
    for (const e of espectadores.values()) clearTimeout(e.gracia)
    for (const ws of wss.clients) ws.terminate()
    wss.close(() => httpServer.close(() => ok()))
  })
  return { sim, cfg, puerto, epoca, salud, bienvenida, cerrar, arranqueMs }
}

// Ejecución directa (también empaquetado)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const s = await crearServidor()
  const fin = () => s.cerrar().then(() => process.exit(0))
  process.on('SIGTERM', fin); process.on('SIGINT', fin)
}
