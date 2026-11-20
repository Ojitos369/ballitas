// Cliente de consola del mundo compartido: conecta, forma, decide, deja y toma, y comprueba las respuestas.
//   node back/mundo/cliente_prueba.mjs hola   [url]            solo saluda (sirve contra el relevo: ws://127.0.0.1:8000/ws)
//   node back/mundo/cliente_prueba.mjs basico [url]            contrato a velocidad real (~15 s): errores, tomar, decidir, dejar
//   node back/mundo/cliente_prueba.mjs completo                arranca su propio servidor acelerado (30x) y comprueba además:
//                                                              decisiones cumplidas, 3 rutas sin decidir, fila al morir otra, gracia
//   node back/mundo/cliente_prueba.mjs carga [url] [n=50] [s=600]   n clientes escuchando a 10 Hz; mide CPU y memoria con /salud
// url por defecto: ws://127.0.0.1:8379
import { spawn } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from '../../front/node_modules/ws/wrapper.mjs'
import { V, R, FASES, leerRapida, aplicarLenta } from '../../front/src/Core/protocolo.js'

const AQUI = path.dirname(fileURLToPath(import.meta.url))
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
let fallos = 0; let pasos = 0
const ok = (cond, texto) => { pasos++; if (cond) console.log(`  ✔ ${texto}`); else { fallos++; console.log(`  ✘ ${texto}`) } }

class Cliente {
  constructor(url, nombre, id = randomUUID()) { this.url = url; this.nombre = nombre; this.id = id; this.q = 0; this.pend = new Map(); this.b = new Map(); this.fila = []; this.ev = []; this.sueltos = []; this.oyentes = new Set(); this.recibidos = 0; this.bytes = 0; this.cierre = null }
  conectar({ hola = true } = {}) {
    return new Promise((res, rej) => {
      const ws = this.ws = new WebSocket(this.url)
      ws.on('error', rej)
      ws.on('close', (codigo) => { this.cierre = codigo; this.avisar() })
      ws.on('message', (d) => this.recibe(d))
      ws.on('open', async () => { if (!hola) return res(null); try { res(await this.pide({ k: 'hola', v: V, id: this.id })) } catch (e) { rej(e) } })
    })
  }
  recibe(d) {
    const txt = d.toString(); this.recibidos++; this.bytes += txt.length
    const m = JSON.parse(txt)
    if (m.k === 'i') { this.n = m.n; this.t = m.t; this.ies = (this.ies || 0) + 1; this.vivas = new Set(m.b.map((r) => r[R.id])); this.rapidas = m.b; for (const id of this.b.keys()) if (!this.vivas.has(id)) { this.muertas = (this.muertas || 0) + 1; this.b.delete(id) } }
    else if (m.k === 'd') {
      for (const l of m.nace || []) { this.b.set(l.id, l); this.nacidas = [...(this.nacidas || []), l] }
      for (const p of m.b || []) { const o = this.b.get(p.id); if (o) aplicarLenta(o, p) }
      if (m.fila) this.fila = m.fila
      if (m.stats) this.stats = m.stats
      if (m.espectadores != null) this.espectadores = m.espectadores
      for (const e of m.ev || []) this.ev.push(e)
    } else if (m.k === 'hola') { this.hola = m; this.yo = m.yo; this.fila = m.fila; this.stats = m.stats; this.espectadores = m.espectadores; this.b = new Map(m.b.map((l) => [l.id, l])) }
    if (m.k === 'hola' || m.k === 'ok' || m.k === 'error' || m.k === 'pong') { const q = m.q ?? (m.k === 'error' ? this.pend.keys().next().value : undefined); const p = this.pend.get(q); if (p) { m.q = q; this.pend.delete(q); p(m) } else this.sueltos.push(m) }
    this.avisar()
  }
  avisar() { for (const f of this.oyentes) f() }
  crudo(texto) { this.ws.send(texto) }
  pide(m, ms = 5000) {
    const q = ++this.q
    return new Promise((res, rej) => { const t = setTimeout(() => { this.pend.delete(q); rej(new Error(`${this.nombre}: sin respuesta a ${m.k}`)) }, ms); this.pend.set(q, (r) => { clearTimeout(t); res(r) }); this.ws.send(JSON.stringify({ ...m, q })) })
  }
  // espera a que `f()` devuelva algo verdadero (se reevalúa con cada mensaje)
  hasta(f, ms, texto = '') {
    return new Promise((res, rej) => {
      const mira = () => { let v; try { v = f() } catch { v = null } if (v) { fin(); res(v) } }
      const t = setTimeout(() => { fin(); rej(new Error(`${this.nombre}: no ocurrió en ${ms} ms: ${texto}`)) }, ms)
      const fin = () => { clearTimeout(t); this.oyentes.delete(mira) }
      this.oyentes.add(mira); mira()
    })
  }
  libre() { return [...this.b.values()].find((l) => !l.ctrl && this.vivas?.has(l.id) && this.rapidas.find((r) => r[R.id] === l.id)[R.fase] !== FASES.indexOf('dying')) }
  cerrar() { this.ws.close() }
}

async function arrancarServidor(env) {
  const hijo = spawn(process.execPath, [path.join(AQUI, 'servidor.mjs')], { env: { ...process.env, MUNDO_PUERTO: '0', MUNDO_API: '', ...env }, stdio: ['ignore', 'pipe', 'inherit'] })
  let salida = ''
  const puerto = await new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('el servidor no arrancó en 40 s')), 40000)
    hijo.stdout.on('data', (d) => { salida += d; const m = /escuchando ws:\/\/[^:]+:(\d+)/.exec(salida); if (m) { clearTimeout(t); res(Number(m[1])) } })
    hijo.on('exit', (c) => rej(new Error(`el servidor terminó (${c})`)))
  })
  return { puerto, url: `ws://127.0.0.1:${puerto}`, parar: () => hijo.kill(), arranque: /mundo listo en (\d+) ms \(elecciones (\w+)\)/.exec(salida) }
}
const salud = async (url) => (await fetch(url.replace(/^ws/, 'http').replace(/\/ws$/, '') + '/salud')).json()

// ───────────── hola ─────────────
async function pruebaHola(url) {
  console.log(`hola → ${url}`)
  const a = new Cliente(url, 'A'); const t0 = performance.now(); const h = await a.conectar(); const ms = Math.round(performance.now() - t0)
  ok(h.k === 'hola' && h.v === V, `responde hola (v=${h.v}) en ${ms} ms`)
  ok(typeof h.epoca === 'string' && h.semilla === 369 && Number.isInteger(h.worldGen), `epoca ${h.epoca}, semilla ${h.semilla}, worldGen ${h.worldGen}`)
  ok(Array.isArray(h.picks) && h.picks.length === 20, `picks: ${h.picks?.length} sentidos`)
  ok(h.hz === 30 && h.cada === 3, 'hz 30, cada 3')
  ok(h.yo.corto === createHash('sha1').update(a.id).digest('hex').slice(0, 8), `yo.corto = sha1(id)[0..8] = ${h.yo.corto}`)
  ok(!JSON.stringify(h).includes(a.id), 'la bienvenida no contiene el id secreto')
  ok(h.b.length === 10 && h.b.every((l) => l.r.length === 26 && l.genome && l.name && 'ctrl' in l && 'dec' in l && 'auto' in l), `10 ballitas con parte lenta y rápida (${JSON.stringify(h).length} B)`)
  ok(h.reglas.maxSinDecidir === 3 && h.reglas.maxFila === 30 && h.reglas.maxNombre === 16, 'reglas 3 / 30 / 16')
  await a.hasta(() => a.ies >= 10, 5000, '10 instantáneas')
  const n0 = a.n; const i0 = a.ies; const r0 = performance.now(); await espera(3000)
  const hz = (a.ies - i0) / ((performance.now() - r0) / 1000)
  ok(hz > 8.5 && hz < 11.5, `instantáneas a ${hz.toFixed(1)} Hz (tick ${n0} → ${a.n})`)
  const p = await a.pide({ k: 'ping', c: 123 }); ok(p.k === 'pong' && p.c === 123 && p.n > 0, 'ping → pong')
  a.cerrar(); return h
}

// ───────────── contrato a velocidad real ─────────────
async function pruebaBasica(url) {
  console.log(`básico → ${url}`)
  const a = new Cliente(url, 'A'); const b = new Cliente(url, 'B'); const c = new Cliente(url, 'C')
  await a.conectar(); await b.conectar(); await c.conectar()
  await a.hasta(() => a.espectadores === 3, 3000, 'espectadores = 3'); ok(true, 'los tres ven espectadores = 3')
  // sin hola / formato / tamaño
  const x = new Cliente(url, 'X'); await x.conectar({ hola: false })
  x.crudo(JSON.stringify({ k: 'formar', nombre: 'Sin hola' })); await x.hasta(() => x.sueltos.find((m) => m.error === 'hola'), 3000, 'error hola'); ok(true, 'mensaje antes de hola → error hola')
  x.crudo('{no json'); await x.hasta(() => x.sueltos.find((m) => m.error === 'formato'), 3000, 'formato'); ok(true, 'JSON roto → error formato')
  x.crudo(JSON.stringify({ k: 'formar', nombre: 'x'.repeat(600) })); await x.hasta(() => x.sueltos.find((m) => m.error === 'tamano'), 3000, 'tamano'); ok(true, 'más de 512 B → error tamano')
  x.crudo(JSON.stringify({ k: 'hola', v: 99, id: x.id })); await x.hasta(() => x.sueltos.find((m) => m.error === 'version'), 3000, 'version'); ok(true, 'versión distinta → error version')
  await espera(1100)
  for (let i = 0; i < 30; i++) x.crudo(JSON.stringify({ k: 'ping', c: i }))
  await x.hasta(() => x.sueltos.find((m) => m.error === 'ritmo'), 3000, 'ritmo'); ok(true, 'ráfaga de 30 mensajes → error ritmo')
  await x.hasta(() => x.cierre === 1008, 3000, 'cierre 1008'); ok(true, 'reincidencia → cierre 1008')
  // formar
  let r = await a.pide({ k: 'formar', nombre: 'Prueba A' }); ok(r.k === 'ok' && r.puesto === 1, 'A forma: ok, puesto 1')
  r = await a.pide({ k: 'formar', nombre: 'Otra' }); ok(r.error === 'ya_en_fila', 'A forma otra vez → ya_en_fila')
  r = await b.pide({ k: 'formar', nombre: '!!!' }); ok(r.error === 'nombre', 'nombre vacío tras limpiar → nombre')
  r = await b.pide({ k: 'formar', nombre: 'Prueba <B>' }); ok(r.k === 'ok' && r.puesto === 2, 'B forma: puesto 2')
  await c.hasta(() => c.fila.length === 2, 3000, 'fila de 2')
  ok(c.fila[0].nombre === 'Prueba A' && c.fila[0].de === a.yo.corto && c.fila[1].nombre === 'Prueba B', `todos ven la fila: ${c.fila.map((f) => `${f.nombre} (${f.de})`).join(', ')}`)
  r = await b.pide({ k: 'salirFila' }); ok(r.k === 'ok', 'B sale de la fila'); await c.hasta(() => c.fila.length === 1, 3000, 'fila de 1')
  await espera(1200)
  // tomar
  r = await b.pide({ k: 'tomar', b: 99999 }); ok(r.error === 'no_existe', 'tomar una que no existe → no_existe')
  const l = b.libre(); r = await b.pide({ k: 'tomar', b: l.id }); ok(r.k === 'ok', `B toma la ballita ${l.id} (${l.name})`)
  await c.hasta(() => c.b.get(l.id)?.ctrl === b.yo.corto, 3000, 'ctrl visible'); ok(true, 'los demás ven ctrl = corto de B')
  ok(c.ev.some((e) => e.k === 'entra' && e.b === l.id && e.de === b.yo.corto), 'evento entra difundido')
  r = await c.pide({ k: 'tomar', b: l.id }); ok(r.error === 'ocupada', 'C toma la misma → ocupada')
  r = await b.pide({ k: 'tomar', b: b.libre().id }); ok(r.error === 'ya_controlas', 'B toma una segunda → ya_controlas')
  r = await c.pide({ k: 'decidir', b: l.id, carril: 1 }); ok(r.error === 'no_controlas', 'C decide sobre la de B → no_controlas')
  await espera(1200)
  // decidir
  await b.hasta(() => b.b.get(l.id)?.auto, 3000, 'auto'); const auto = b.b.get(l.id).auto
  ok(Number.isInteger(auto.way) && Number.isInteger(auto.r), `decisión por defecto visible: auto = sentido ${auto.way}, ruta ${auto.r}`)
  r = await b.pide({ k: 'decidir', b: l.id, destino: 77 }); ok(r.error === 'destino', 'planeta inválido → destino')
  r = await b.pide({ k: 'decidir', b: l.id, carril: 9 }); ok(r.error === 'carril', 'carril 9 → carril')
  r = await b.pide({ k: 'decidir', b: l.id, ruta: { way: 999, r: 0 } }); ok(r.error === 'ruta', 'ruta inválida → ruta')
  r = await b.pide({ k: 'decidir', b: l.id, ruta: { way: auto.way, r: (auto.r + 1) % 3 }, carril: 4 })
  ok(r.k === 'ok' && r.dec.ruta.way === auto.way && Number.isInteger(r.dec.destino) && r.dec.carril === 4, `decidir ruta + carril → ok, dec = ${JSON.stringify(r.dec)} (la ruta fija el planeta)`)
  await espera(1200)
  await c.hasta(() => c.b.get(l.id)?.dec?.carril === 4, 3000, 'dec visible'); ok(true, 'todos ven la decisión pendiente')
  r = await b.pide({ k: 'decidir', b: l.id, carril: null }); ok(r.k === 'ok' && !('carril' in r.dec) && r.dec.ruta, 'carril: null borra solo el carril')
  // dejar y tomar otro
  r = await c.pide({ k: 'dejar', b: l.id }); ok(r.error === 'no_controlas', 'C deja la de B → no_controlas')
  r = await b.pide({ k: 'dejar', b: l.id }); ok(r.k === 'ok', 'B deja de controlar')
  await c.hasta(() => c.b.get(l.id) && c.b.get(l.id).ctrl === null && Object.keys(c.b.get(l.id).dec).length === 0, 3000, 'libre'); ok(c.ev.some((e) => e.k === 'libre' && e.b === l.id && e.motivo === 'dejar'), 'queda libre, sin decisiones, evento libre(dejar)')
  await espera(1200)
  r = await c.pide({ k: 'tomar', b: l.id }); ok(r.k === 'ok', 'C (que solo miraba) toma el control de la que quedó libre')
  r = await c.pide({ k: 'dejar', b: l.id }); r = await a.pide({ k: 'salirFila' })
  a.cerrar(); b.cerrar(); c.cerrar()
}

// ───────────── reglas con el tiempo acelerado ─────────────
async function pruebaCompleta() {
  const s = await arrancarServidor({ MUNDO_VELOCIDAD: '30', MUNDO_GRACIA_S: '3' })
  console.log(`completo → ${s.url} (30x; arranque ${s.arranque?.[1]} ms, elecciones ${s.arranque?.[2]})`)
  try {
    await pruebaHolaAcelerado(s.url)
    const a = new Cliente(s.url, 'A'); const b = new Cliente(s.url, 'B'); const c = new Cliente(s.url, 'C')
    await a.conectar(); await b.conectar(); await c.conectar()
    // 1) decisiones cumplidas: B toma, decide ruta + carril, y se comprueba el viaje completo
    let hecho = false
    for (let intento = 0; intento < 6 && !hecho; intento++) {
      await b.hasta(() => b.libre(), 20000, 'alguna libre'); const l = b.libre()
      const rt = await b.pide({ k: 'tomar', b: l.id }); if (rt.k !== 'ok') { console.log(`  (tomar ${l.id}: ${rt.error}; reintento)`); await espera(500); continue }
      try {
        await b.hasta(() => !b.b.has(l.id) || b.b.get(l.id).auto, 5000, 'auto')
        const auto = b.b.get(l.id).auto; const dec = { ruta: { way: auto.way, r: (auto.r + 1) % 3 }, carril: 3 }
        const r = await b.pide({ k: 'decidir', b: l.id, ...dec }); if (r.k !== 'ok') { console.log(`  (decidir: ${r.error}, la previsión ya era vieja a 30x; reintento)`); await b.pide({ k: 'dejar', b: l.id }); await espera(500); continue }
        const destino = r.dec.destino
        await b.hasta(() => !b.b.has(l.id) || b.b.get(l.id).plan?.manual?.includes('ruta'), 60000, 'decisión consumida')
        const o = b.b.get(l.id); if (!o) { console.log('  (murió antes de salir; reintento)'); continue }
        ok(o.way === dec.ruta.way && o.plan.manual.includes('carril') && o.plan.razon === 'lo decidió quien me controla' && Object.keys(o.dec).length === 0, `la decisión se consume al salir: plan = ${o.plan.ruta}, manual = ${o.plan.manual}`)
        const rutas = new Set(); let carril0 = null
        const mira = () => { const t = b.rapidas?.find((x) => x[R.id] === l.id); if (!t) return; const rr = leerRapida(t); if (rr.phase === 'travel') { if (b.b.get(l.id)?.route != null) rutas.add(b.b.get(l.id).route); if (carril0 == null && !rr.enVuelo) carril0 = rr.carril } }
        b.oyentes.add(mira)
        await b.hasta(() => !b.b.has(l.id) || (b.b.get(l.id).node === destino && b.b.get(l.id).way === null), 90000, 'llegada')
        b.oyentes.delete(mira)
        if (!b.b.has(l.id)) { console.log('  (murió en el viaje; reintento)'); continue }
        ok(true, `llegó al planeta decidido (${destino})`)
        ok(carril0 === 3, `salió por el carril decidido (visto ${carril0})`)
        ok(rutas.size === 1, `recorrió una sola ruta (${[...rutas]})`)
        ok(b.b.get(l.id).ctrl === b.yo.corto && b.b.get(l.id).sinDecidir === 0, 'tras decidir, sinDecidir = 0 y conserva el control')
        await b.pide({ k: 'dejar', b: l.id }); hecho = true
      } catch (e) { console.log(`  (reintento: ${e.message})`); await b.pide({ k: 'dejar', b: l.id }).catch(() => {}) }
    }
    ok(hecho, 'viaje con decisiones comprobado')
    // 2) tres rutas sin decidir: C toma y no decide nunca
    hecho = false
    for (let intento = 0; intento < 8 && !hecho; intento++) {
      await c.hasta(() => c.libre(), 20000, 'alguna libre'); const l = c.libre()
      const rt = await c.pide({ k: 'tomar', b: l.id }); if (rt.k !== 'ok') { console.log(`  (tomar ${l.id}: ${rt.error}; reintento)`); await espera(500); continue }
      await c.hasta(() => !c.b.has(l.id) || c.b.get(l.id).ctrl === c.yo.corto, 5000, 'control visible')
      const vistos = new Set(); const mira = () => { const o = c.b.get(l.id); if (o) vistos.add(o.sinDecidir) }
      c.oyentes.add(mira); const t0 = c.t
      try { await c.hasta(() => !c.b.has(l.id) || c.b.get(l.id).ctrl === null, 120000, 'pierde el control') } finally { c.oyentes.delete(mira) }
      const ev = c.ev.find((e) => e.k === 'libre' && e.b === l.id)
      if (ev?.motivo !== 'inactivo') { console.log(`  (la ballita ${l.id} quedó libre por ${ev?.motivo}; reintento)`); continue }
      ok(vistos.has(1) && vistos.has(2), `sinDecidir subió 1, 2 (visto ${[...vistos]})`)
      ok(true, `pierde el control tras 3 rutas sin decidir (motivo inactivo, ${Math.round(c.t - t0)} s de sim)`)
      const r = await a.pide({ k: 'tomar', b: l.id }); ok(r.k === 'ok', 'otro espectador toma la que quedó libre')
      await a.pide({ k: 'dejar', b: l.id }); hecho = true
    }
    ok(hecho, 'inactividad comprobada')
    // 3) fila: la primera entra al morir otra, controlada por quien la formó; la segunda espera su turno
    await espera(1000)
    const muertas0 = a.stats.muertas; a.nacidas = []
    ok((await a.pide({ k: 'formar', nombre: 'Primera' })).puesto === 1 && (await b.pide({ k: 'formar', nombre: 'Segunda' })).puesto === 2, 'A y B forman (puestos 1 y 2)')
    await a.hasta(() => a.nacidas.length >= 1, 120000, 'nace la primera')
    const p = a.nacidas[0]
    ok(p.name === 'Primera' && p.formadaPor === a.yo.corto && p.ctrl === a.yo.corto && p.r?.length === 26, `al morir otra entra la primera de la fila: «${p.name}», controlada por quien la formó`)
    ok(a.stats.muertas > muertas0, `entró después de una muerte (muertas ${muertas0} → ${a.stats.muertas})`)
    ok(a.fila.length === 1 && a.fila[0].nombre === 'Segunda', 'la segunda pasa al primer puesto')
    ok(a.ev.some((e) => e.k === 'entra' && e.b === p.id && e.de === a.yo.corto), 'evento entra')
    await a.hasta(() => a.nacidas.length >= 2, 120000, 'nace la segunda')
    ok(a.nacidas[1].name === 'Segunda' && a.nacidas[1].ctrl === b.yo.corto && a.fila.length === 0, 'en la siguiente muerte entra la segunda; la fila queda vacía')
    await a.hasta(() => a.nacidas.length >= 3, 120000, 'nace una sin fila')
    ok(a.nacidas[2].formadaPor === null && a.nacidas[2].ctrl === null, `con la fila vacía nace como siempre («${a.nacidas[2].name}»)`)
    // 4) desconexión: volver dentro del plazo conserva el control; pasado el plazo queda libre
    if (a.b.has(p.id) && a.b.get(p.id).ctrl === a.yo.corto) {
      a.cerrar(); await espera(1000)
      const a2 = new Cliente(s.url, 'A2', a.id); await a2.conectar()
      await espera(4000)
      if (c.b.has(p.id)) {
        ok(c.b.get(p.id).ctrl === a.yo.corto, 'reconectar dentro del plazo conserva el control')
        await a2.pide({ k: 'decidir', b: p.id, carril: 0 }) // evita perderlo por inactividad mientras se prueba
        a2.cerrar()
        await c.hasta(() => !c.b.has(p.id) || c.b.get(p.id).ctrl === null, 15000, 'libre por desconexión')
        const ev = c.ev.filter((e) => e.k === 'libre' && e.b === p.id).at(-1)
        ok(ev?.motivo === 'desconectado' || ev?.motivo === 'muerte', `sin conexión y pasado el plazo queda libre (motivo ${ev?.motivo})`)
      } else console.log('  (la ballita murió antes de probar la desconexión)')
    } else console.log('  (la ballita de A ya no estaba para probar la desconexión)')
    // 5) formada con el dueño desconectado: nace sin controlador
    const d = new Cliente(s.url, 'D'); await d.conectar(); c.nacidas = []
    await d.pide({ k: 'formar', nombre: 'Huerfana' }); d.cerrar()
    await c.hasta(() => c.nacidas.find((l) => l.name === 'Huerfana'), 120000, 'nace la huérfana')
    const h = c.nacidas.find((l) => l.name === 'Huerfana')
    ok(h.ctrl === null && h.formadaPor === d.yo.corto, 'la entrada en la fila sobrevive a la desconexión; nace sin controlador')
    console.log('  salud:', JSON.stringify(await salud(s.url)))
    b.cerrar(); c.cerrar()
  } finally { s.parar() }
}
async function pruebaHolaAcelerado(url) {
  const a = new Cliente(url, 'H'); const h = await a.conectar()
  ok(h.k === 'hola' && h.b.length === 10, 'servidor acelerado responde hola'); a.cerrar()
}

// ───────────── carga ─────────────
async function pruebaCarga(url, n, seg) {
  console.log(`carga → ${url}: ${n} clientes durante ${seg} s`)
  const cs = []
  for (let i = 0; i < n; i++) { const c = new Cliente(url, `c${i}`); await c.conectar(); cs.push(c) }
  const base = url.replace(/\/ws$/, ''); const directo = !/\/ws$/.test(url)
  const muestras = []; const s0 = directo ? await salud(base) : null; const t0 = performance.now()
  const cada = Math.max(5, Math.round(seg / 20))
  for (let t = cada; t <= seg; t += cada) {
    await espera(t * 1000 - (performance.now() - t0))
    const hz = cs.reduce((a, c) => a + (c.ies || 0), 0) / n / ((performance.now() - t0) / 1000)
    const s = directo ? await salud(base) : null
    muestras.push({ t, hz: +hz.toFixed(2), rssMB: s?.rssMB, heapMB: s?.heapMB, cpuMs: s?.cpuMs, tickP99: s?.tickMs.p99, difP99: s?.difusionMs.p99 })
    console.log('  ', JSON.stringify(muestras.at(-1)))
  }
  const dur = (performance.now() - t0) / 1000
  const kb = cs.reduce((a, c) => a + c.bytes, 0) / n / dur / 1024
  if (directo) {
    const s1 = await salud(base); const cpu = ((s1.cpuMs - s0.cpuMs) / (dur * 1000)) * 100
    const rss = muestras.map((m) => m.rssMB); const mitad = rss.slice(Math.floor(rss.length / 2))
    console.log(`  CPU del servidor: ${cpu.toFixed(2)} % de un núcleo · RSS ${rss[0]} → ${rss.at(-1)} MB (máx ${Math.max(...rss)}; segunda mitad ${Math.min(...mitad)}–${Math.max(...mitad)}) · tick p99 ${s1.tickMs.p99} ms (máx ${s1.tickMs.max}) · difusión p99 ${s1.difusionMs.p99} ms`)
    ok(cpu < 10, `CPU < 10 % de un núcleo (${cpu.toFixed(2)} %)`)
    ok(s1.tickMs.p99 < 1, `tick p99 < 1 ms (${s1.tickMs.p99})`)
  }
  ok(muestras.every((m) => m.hz > 9 && m.hz < 11), `cada cliente recibe ~10 Hz (${muestras.at(-1).hz}); ${kb.toFixed(1)} KB/s por cliente sin comprimir`)
  for (const c of cs) c.cerrar()
}

const [modo = 'basico', ...args] = process.argv.slice(2)
const url = args[0] && /^wss?:/.test(args[0]) ? args.shift() : 'ws://127.0.0.1:8379'
try {
  if (modo === 'hola') await pruebaHola(url)
  else if (modo === 'basico') { await pruebaHola(url); await pruebaBasica(url) }
  else if (modo === 'completo') await pruebaCompleta()
  else if (modo === 'carga') await pruebaCarga(url, Number(args[0] || 50), Number(args[1] || 600))
  else throw new Error(`modo desconocido: ${modo}`)
} catch (e) { fallos++; console.log(`  ✘ ${e.stack || e}`) }
console.log(`${pasos - (fallos > pasos ? 0 : Math.min(fallos, pasos))}/${pasos} comprobaciones bien${fallos ? `, ${fallos} FALLOS` : ''}`)
process.exit(fallos ? 1 : 0)
