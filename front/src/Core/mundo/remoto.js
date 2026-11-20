// Adaptador REMOTO del mundo compartido (docs/mundo_compartido.md, 2.4): habla con el servidor autoritativo por
// WebSocket (protocolo en ../protocolo.js) y expone la misma forma que la Sim local. No simula: interpola.
import * as THREE from 'three'
import { buildWorld, setWorldPicks, WORLD_GEN, KINDS, OBSTACLES, CARRILES } from '../world.js'
import { nombreUnico } from '../sim.js'
import { V, PING_CADA } from '../protocolo.js'
import { crearInterpolador } from './interpola.js'
import { opcionesDe } from './opciones.js'

// Esperas de reconexión (ms). El contrato decía 1, 2, 4, 8 y 15 s; se sondea cada 2 s el primer medio minuto para
// cumplir «recuperado en < 3 s tras volver el servidor» (un reinicio tarda 4–6 s) y luego se espacia.
const ESPERAS = [1000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 2000, 4000, 8000, 15000]
const CAMPOS_MUNDO = { dest: 'destinos', way: 'ways', route: 'routes', plannedRoute: 'routes', nextDest: 'destinos' }

function leerId() {
  try {
    let x = localStorage.getItem('ballitas:espectador')
    if (!x) { x = crypto.randomUUID(); localStorage.setItem('ballitas:espectador', x) }
    return x
  } catch { return crypto.randomUUID() } // sin almacenamiento: id en memoria
}

export function conectarRemoto({ url, semilla = 369, timeout = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    let ws = null; let terminado = false; let conectado = false; let cerrado = false
    let epoca = null; let seq = 0; let intento = 0; let pingTimer = null; let reintento = null
    let estado = 'conectando'; let desfase = 0; let interp = null
    const idSecreto = leerId()
    const listeners = new Map(); const pendientes = new Map(); const registry = new Map(); const ballitas = []
    const emitir = (e, x) => listeners.get(e)?.forEach((fn) => { try { fn(x) } catch { /* un oyente roto no corta la red */ } })
    const timer = setTimeout(() => fallar(new Error('timeout')), timeout)
    function fallar(e) { if (terminado) return; terminado = true; clearTimeout(timer); try { ws?.close() } catch { /* ya cerrado */ } reject(e) }
    const idDe = (b) => (b && typeof b === 'object' ? b.id : b)
    const enviar = (k, p = {}) => new Promise((res) => {
      if (!ws || ws.readyState !== 1) return res({ ok: false, error: 'sin_conexion' })
      const q = ++seq
      pendientes.set(q, res)
      ws.send(JSON.stringify({ k, q, ...p }))
      setTimeout(() => { if (pendientes.delete(q)) res({ ok: false, error: 'timeout' }) }, 5000)
    })

    const api = {
      world: null, ballitas, t: 0, stats: {}, feed: [], seed: semilla, pop: 0, rng: Math.random, rngDialogos: Math.random,
      modo: 'remoto', get estado() { return estado }, yo: { corto: '' }, fila: [], espectadores: 0,
      reglas: { maxSinDecidir: 3, maxFila: 30, maxNombre: 16 }, puede: { velocidad: false },
      get tDibujo() { return interp?.tDibujo ?? 0 }, // segundos de sim que se están dibujando (sondas)
      tick() { // el dt no importa: el reloj es el del servidor
        const ahora = performance.now() / 1000 + desfase
        api.t = ahora - 0.15
        interp?.cuadro(ahora)
      },
      where(b) { return where(api, b) },
      favorites(b) {
        const top = (a) => (a || []).reduce((i, v, n) => (v > a[i] ? n : i), 0); const g = b.genome; const w = api.world
        return { destino: w.destinos[top(g.prefs)], way: w.ways[top(g.ways)], route: w.routes[top(g.routes)], kind: KINDS[OBSTACLES[top(g.kinds)]] }
      },
      nombreSugerido() { return nombreUnico(Math.random, new Set([...ballitas.map((b) => b.name), ...api.fila.map((f) => f.nombre)])) },
      async formar(nombre) { const r = await enviar('formar', { nombre }); if (r.ok) try { localStorage.setItem('ballitas:nombre', nombre) } catch { /* comodidad */ } return r },
      salirFila() { return enviar('salirFila') },
      tomar(b) { return enviar('tomar', { b: idDe(b) }) },
      dejar(b) { return enviar('dejar', { b: idDe(b) }) },
      decidir(b, dec) { return enviar('decidir', { b: idDe(b), ...dec }) },
      opciones(b) { return opcionesDe(api, b) },
      on(e, fn) { if (!listeners.has(e)) listeners.set(e, new Set()); listeners.get(e).add(fn); return () => listeners.get(e)?.delete(fn) },
      cerrar() { cerrado = true; clearInterval(pingTimer); clearTimeout(reintento); document.removeEventListener?.('visibilitychange', alVer); try { ws?.close() } catch { /* ya cerrado */ } },
    }

    // Alta o actualización de la parte lenta (por id: `d.nace` puede repetir una ballita que ya vino en `hola`).
    // Solo se tocan los campos PRESENTES: los parciales de `d.b` traen únicamente lo que cambió.
    function aplicarLenta(l) {
      let b = registry.get(l.id)
      if (!b) {
        b = {
          id: l.id, name: '', gen: 1, padres: [], arch: null, genome: { prefs: [], ways: [], routes: [], kinds: [], traits: {} },
          pos: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, 1), up: new THREE.Vector3(0, 1, 0), phase: 'born',
          p: 60, e: 60, age: 0, score: 0, visits: 0, speed: 0, timer: 0, dur: 1, node: 0, vert: 0,
          dest: null, way: null, route: null, plannedRoute: null, nextDest: null, seg: null, segT: 0, lane: 0, carril: 0,
          ang: 0, off: 0, hy: 0, lat: 0, roll: 0, slope: 0, impact: 0, vis: 1, airborne: false, onLane: true, snap: 0,
          walk: null, walkPath: null, flight: null, sw: null, log: [], visited: [], visitedRoutes: {}, mechs: {}, flags: {},
          mood: 'feliz', thought: null, react: null, plan: null, cause: null, lastSwitch: null,
          ctrl: null, formadaPor: null, mia: false, dec: {}, sinDecidir: 0, auto: null,
        }
        registry.set(b.id, b); ballitas.push(b)
      }
      const w = api.world
      for (const k in l) {
        const v = l[k]
        if (k === 'id' || k === 'r') continue
        if (k in CAMPOS_MUNDO) b[k] = v == null ? null : w[CAMPOS_MUNDO[k]][v] ?? null
        else if (k === 'walk') b.walkPath = v
        else if (k === 'dec') b.dec = v || {}
        else b[k] = v
      }
      b.mia = !!b.ctrl && b.ctrl === api.yo.corto
      return b
    }
    const filaDe = (f) => (f || []).map((x) => ({ ...x, mia: x.de === api.yo.corto }))

    function alHola(m) {
      if (m.worldGen !== WORLD_GEN) { // build viejo: en el primer intento cae al mundo local; ya conectado, recarga
        if (!conectado) fallar(new Error('worldGen')); else location.reload()
        return
      }
      const mundoNuevo = !!epoca && epoca !== m.epoca
      if (mundoNuevo || conectado) { // reconexión: se descarta todo y se rehace desde la bienvenida
        if (mundoNuevo) { for (const b of ballitas) b.phase = 'gone'; ballitas.length = 0; registry.clear() }
        interp?.vaciar()
      }
      if (!api.world || api.seed !== m.semilla) { setWorldPicks(m.semilla, m.picks); api.world = buildWorld(m.semilla); interp = null }
      api.seed = m.semilla; epoca = m.epoca; api.yo = m.yo || api.yo
      api.stats = m.stats || {}; api.feed = m.feed || []; api.espectadores = m.espectadores || 0; api.reglas = m.reglas || api.reglas
      api.fila = filaDe(m.fila)
      const vivos = new Set(m.b.map((l) => l.id))
      for (let i = ballitas.length - 1; i >= 0; i--) if (!vivos.has(ballitas[i].id)) quitar(i) // murieron mientras no había conexión
      for (const l of m.b) aplicarLenta(l)
      if (!interp) interp = crearInterpolador(api.world, ballitas, registry)
      interp.ingestar({ t: m.t, n: m.n, b: m.b.map((l) => l.r) })
      desfase = m.t - performance.now() / 1000
      api.tick()
      estado = 'listo'; intento = 0
      const primera = !conectado
      conectado = true; clearTimeout(timer)
      if (!pingTimer) pingTimer = setInterval(() => { if (ws?.readyState === 1) ws.send(JSON.stringify({ k: 'ping', c: performance.now() })) }, PING_CADA)
      if (primera) resolve(api)
      emitir('cambio', api)
    }
    function quitar(i) { const b = ballitas[i]; b.phase = 'gone'; registry.delete(b.id); ballitas.splice(i, 1) }

    function alInstante(m) {
      // reloj: el desfase se suaviza con cada instantánea (el retraso de red varía)
      desfase += (m.t - (performance.now() / 1000 + desfase)) * 0.08
      const vivos = new Set()
      for (const r of m.b) vivos.add(r[0]) // una desconocida se ignora hasta que llegue su `nace` (va en el `d` anterior a esta `i`)
      interp?.ingestar({ t: m.t, n: m.n, b: m.b })
      let murio = false
      for (let i = ballitas.length - 1; i >= 0; i--) if (!vivos.has(ballitas[i].id)) { quitar(i); murio = true }
      if (murio) emitir('cambio', api)
    }

    function alCambio(m) {
      const mias = new Set(ballitas.filter((b) => b.mia).map((b) => b.id)) // antes de aplicar: `libre` llega con ctrl ya en null
      for (const l of m.nace || []) aplicarLenta(l)
      for (const l of m.b || []) if (registry.has(l.id)) aplicarLenta(l)
      if (m.fila) api.fila = filaDe(m.fila)
      if (m.stats) api.stats = m.stats
      if (m.feed) api.feed = m.feed
      if (m.espectadores != null) api.espectadores = m.espectadores
      for (const ev of m.ev || []) { // cambio de contrato de P1: eventos de control
        const b = registry.get(ev.b)
        if (ev.k === 'entra') emitir('entra', { b, de: ev.de, nombre: b?.name ?? '', mia: ev.de === api.yo.corto })
        else if (ev.k === 'libre') emitir('libre', { b, motivo: ev.motivo, mia: mias.has(ev.b) })
      }
      emitir('cambio', api)
    }

    function abrir() {
      clearTimeout(reintento)
      if (cerrado) return
      try { ws = new WebSocket(url) } catch (e) { fallar(e); return }
      const este = ws
      ws.onopen = () => este.send(JSON.stringify({ k: 'hola', v: V, id: idSecreto, ...(epoca ? { epoca } : {}) }))
      ws.onerror = () => { if (!conectado) fallar(new Error('websocket')) }
      ws.onclose = () => {
        if (terminado || cerrado || este !== ws) return
        if (!conectado) { fallar(new Error('websocket')); return }
        for (const [q, res] of pendientes) { pendientes.delete(q); res({ ok: false, error: 'sin_conexion' }) }
        if (estado !== 'reconectando') { estado = 'reconectando'; emitir('cambio', api) }
        reintento = setTimeout(abrir, ESPERAS[Math.min(intento++, ESPERAS.length - 1)])
      }
      ws.onmessage = (ev) => {
        let m
        try { m = JSON.parse(ev.data) } catch { return }
        if (m.k === 'i') alInstante(m)
        else if (m.k === 'd') alCambio(m)
        else if (m.k === 'hola' && m.b) alHola(m)
        else if (m.k === 'ok' || m.k === 'error') {
          const res = pendientes.get(m.q)
          if (res) { pendientes.delete(m.q); res(m.k === 'ok' ? { ...m, ok: true } : { ok: false, error: m.error }) }
        }
      }
    }
    // Pestaña que vuelve a ser visible: el búfer es viejo (rAF estuvo parado) y, si no había conexión, se reintenta ya.
    function alVer() {
      if (document.visibilityState !== 'visible' || !conectado) return
      interp?.vaciar()
      if (estado === 'reconectando') { intento = 0; abrir() }
    }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', alVer)
    abrir()
  })
}

function where(api, b) {
  const w = api.world; const n = w.nodes[b.node]?.name || ''
  if (b.phase === 'travel' && b.way) {
    const a = w.nodes[b.way.to]?.name || ''
    const tramo = b.seg ? `: ${b.seg.emoji} ${b.seg.name}` : ''
    return `De ${n} a ${a} por ${b.way.theme.emoji} ${b.way.theme.name}${b.route ? `, ruta ${b.route.name}` : ''}${tramo} · carril ${(b.carril || 0) + 1}/${CARRILES}`
  }
  if (b.phase === 'toPort' && b.way) return `En ${n}, hacia el puerto de ${w.nodes[b.way.to]?.name || ''}`
  if (!b.dest) return `En ${n}`
  return `En ${n}: ${b.phase === 'toDest' ? 'va a ' : ''}${b.dest.name}`
}
