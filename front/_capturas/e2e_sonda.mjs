// Sonda E2E del mundo compartido: DOS espectadores (dos contextos de navegador) contra uvicorn + Node + preview.
// Uso (desde front/):  node _capturas/e2e_sonda.mjs e2e|fps
//   E2E_URL (http://127.0.0.1:4390/)  E2E_MAIN (http://127.0.0.1:4391/, build de main para el A/B de FPS)
//   E2E_MUNDO (http://127.0.0.1:8391, servidor Node con MUNDO_PRUEBA=1)  E2E_PID (pid del Node, para reiniciarlo)
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const PW = process.env.E2E_PW || 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const { chromium } = await import(PW)
const modo = process.argv[2] || 'e2e'
const URL_APP = process.env.E2E_URL || 'http://127.0.0.1:4390/'
const URL_MAIN = process.env.E2E_MAIN || 'http://127.0.0.1:4391/'
const MUNDO = process.env.E2E_MUNDO || 'http://127.0.0.1:8391'
const DIR = '_capturas/e2e'
const LOCK = process.env.E2E_LOCK || 'C:\\Users\\ojito\\AppData\\Local\\Temp\\claude\\ba990d845fa529aa\\37147198-7b8f-4f1d-872e-a09fdd6475b5\\scratchpad\\navegador.lock'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(DIR, { recursive: true })

async function candado() {
  mkdirSync(dirname(LOCK), { recursive: true })
  while (existsSync(LOCK) && Date.now() - statSync(LOCK).mtimeMs < 10 * 60 * 1000) { console.log('candado ocupado, espero 30 s'); await sleep(30000) }
  writeFileSync(LOCK, `e2e ${new Date().toISOString()}\n`)
}
const soltar = () => { try { unlinkSync(LOCK) } catch { /* ya no está */ } }
const prueba = async (ruta) => (await fetch(MUNDO + ruta)).json()
const res = { fecha: new Date().toISOString(), pasos: {}, capturas: [], errores: { A: [], B: [] } }
const guardar = () => writeFileSync(`${DIR}/resultado_${modo}${process.env.E2E_PASOS ? "_" + process.env.E2E_PASOS.replace(/,/g, "") : ""}.json`, JSON.stringify(res, null, 2))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

async function foto(page, nombre, movil = true) {
  await page.screenshot({ path: `${DIR}/${nombre}_desk.jpg`, type: 'jpeg', quality: 70 }); res.capturas.push(`${nombre}_desk.jpg`)
  if (!movil) return
  await page.setViewportSize({ width: 412, height: 915 }); await sleep(700)
  await page.screenshot({ path: `${DIR}/${nombre}_movil.jpg`, type: 'jpeg', quality: 70 }); res.capturas.push(`${nombre}_movil.jpg`)
  await page.setViewportSize({ width: 1280, height: 720 }); await sleep(400)
}
async function abrir(browser, id, url = URL_APP) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await ctx.addInitScript((x) => { if (x && !localStorage.getItem('ballitas:espectador')) localStorage.setItem('ballitas:espectador', x); localStorage.removeItem('ballitas:nombre') }, id)
  const page = await ctx.newPage()
  return { ctx, page }
}
const listo = (page) => page.waitForFunction(() => window.__mundo?.modo === 'remoto' && window.__mundo.estado === 'listo' && window.__mundo.ballitas.length > 0 && document.querySelector('canvas'), null, { timeout: 90000 })
const fps = (page, ms = 3000) => page.evaluate((dur) => new Promise((ok) => {
  let n = 0; const t0 = performance.now()
  const paso = () => { n++; const dt = performance.now() - t0; if (dt < dur) requestAnimationFrame(paso); else ok(+((n * 1000) / dt).toFixed(1)) }
  requestAnimationFrame(paso)
}), ms)
// muestras [tDibujo, {id: [x,y,z]}] por cuadro durante `ms`
const muestrear = (page, ms) => page.evaluate((dur) => new Promise((ok) => {
  const out = []; const t0 = performance.now()
  const paso = () => {
    const m = window.__mundo; const p = {}
    for (const b of m.ballitas) if (b.vis >= 0.5) p[b.id] = [b.pos.x, b.pos.y, b.pos.z]
    out.push([m.tDibujo, p])
    if (performance.now() - t0 < dur) requestAnimationFrame(paso); else ok(out)
  }
  requestAnimationFrame(paso)
}), ms)

const PASOS = (process.env.E2E_PASOS || 'a,b,c,d,e,f,g').split(',')
async function paso(nombre, fn) {
  if (!PASOS.includes(nombre[0])) return
  log('paso', nombre)
  try { res.pasos[nombre] = await fn(); log('  →', JSON.stringify(res.pasos[nombre]).slice(0, 400)) } catch (e) { res.pasos[nombre] = { error: String(e.message || e).slice(0, 400) }; log('  ✖', res.pasos[nombre].error) }
  guardar()
}

async function e2e(browser) {
  const A = await abrir(browser, 'e2e-espectador-A-0001'); const B = await abrir(browser, 'e2e-espectador-B-0002')
  for (const [k, x] of [['A', A], ['B', B]]) {
    x.page.on('console', (m) => { if (m.type() === 'error') res.errores[k].push(`${new Date().toISOString().slice(11, 19)} ${m.text().slice(0, 200)}`) })
    x.page.on('pageerror', (e) => res.errores[k].push(`pageerror: ${e.message.slice(0, 200)}`))
  }
  const a = A.page; const b = B.page
  await Promise.all([a.goto(URL_APP), b.goto(URL_APP)])
  await Promise.all([listo(a), listo(b)]); await sleep(4000)
  await foto(a, '00_inicio_A'); await foto(b, '00_inicio_B', false)

  await paso('a_mismas_posiciones', async () => {
    const [ma, mb] = await Promise.all([muestrear(a, 5000), muestrear(b, 5000)])
    // se compara contra el reloj del servidor: para cada muestra de A, B interpolada entre sus dos muestras vecinas
    const ds = []; let j = 0; const ids = new Set()
    for (const [t, pa] of ma) {
      while (j < mb.length - 2 && mb[j + 1][0] < t) j++
      const [t0, p0] = mb[j]; const [t1, p1] = mb[j + 1] || mb[j]
      if (t < t0 || t > t1 || t1 - t0 > 0.05) continue
      const u = t1 > t0 ? (t - t0) / (t1 - t0) : 0
      for (const id in pa) {
        if (!p0[id] || !p1[id]) continue
        if (Math.hypot(p1[id][0] - p0[id][0], p1[id][1] - p0[id][1], p1[id][2] - p0[id][2]) > 30) continue // salto legítimo entre muestras
        ids.add(id)
        ds.push(Math.hypot(...[0, 1, 2].map((k) => pa[id][k] - (p0[id][k] + (p1[id][k] - p0[id][k]) * u))))
      }
    }
    ds.sort((x, y) => x - y)
    const idsA = await a.evaluate(() => window.__mundo.ballitas.map((x) => `${x.id}:${x.name}`).sort()); const idsB = await b.evaluate(() => window.__mundo.ballitas.map((x) => `${x.id}:${x.name}`).sort())
    return { muestrasA: ma.length, muestrasB: mb.length, comparaciones: ds.length, ballitas: ids.size, mismasBallitas: JSON.stringify(idsA) === JSON.stringify(idsB), media: +(ds.reduce((s, x) => s + x, 0) / Math.max(1, ds.length)).toFixed(4), p99: +(ds[Math.floor(ds.length * 0.99)] ?? 0).toFixed(3), max: +(ds[ds.length - 1] ?? 0).toFixed(3) }
  })

  let idMia = null
  await paso('b_formar_y_fila', async () => {
    const sugerido = await a.locator('#ctrl-nombre-input').inputValue()
    await a.locator('#ctrl-nombre-input').fill('Luna E2E')
    await foto(a, '01_formar_editado_A')
    await a.locator('button[type="submit"].ctrl-btn-primario').click()
    await a.locator('.ctrl-fila-item.mia').waitFor({ state: 'visible', timeout: 5000 })
    await b.waitForFunction(() => window.__mundo.fila.some((f) => f.nombre === 'Luna E2E' && !f.mia), null, { timeout: 5000 })
    await foto(a, '02_en_fila_A'); await foto(b, '02_en_fila_B')
    const filaB = await b.evaluate(() => window.__mundo.fila.map((f) => ({ nombre: f.nombre, mia: f.mia })))
    const victima = await a.evaluate(() => window.__mundo.ballitas.find((x) => !x.ctrl && x.phase !== 'dying')?.id)
    const t0 = Date.now(); const m = await prueba(`/prueba/matar?b=${victima}`)
    const esMia = () => window.__mundo.ballitas.some((x) => x.name.startsWith('Luna E2E') && x.mia)
    await a.waitForFunction(esMia, null, { timeout: 20000 })
    const ms = Date.now() - t0
    await b.waitForFunction(() => window.__mundo.ballitas.some((x) => x.name.startsWith('Luna E2E') && x.ctrl && !x.mia), null, { timeout: 5000 })
    idMia = await a.evaluate(() => window.__mundo.ballitas.find((x) => x.mia).id)
    await sleep(600)
    await foto(a, '03_entro_de_la_fila_A'); await foto(b, '03_entro_de_la_fila_B', false)
    return { sugerido, filaVistaPorB: filaB, muerta: m, msHastaEntrar: ms, idMia, filaTrasEntrar: await b.evaluate(() => window.__mundo.fila.length), avisoA: await a.locator('.ctrl-toast').innerText().catch(() => null) }
  })

  await paso('c_decisiones', async () => {
    const conFotos = process.env.E2E_FOTOS !== '0'
    const elegir = async (i, nombre, nCard, fotos) => {
      await a.locator('.ctrl-dec-btn').nth(i).click()
      await a.locator('.ctrl-modal').waitFor({ state: 'visible' })
      const n = await a.locator('.ctrl-tarjeta').count()
      if (nCard < 0) nCard = await a.evaluate(() => { const c = [...document.querySelectorAll('.ctrl-tarjeta')]; const i = c.findIndex((x) => !x.querySelector('.ctrl-chip.auto') && !x.classList.contains('peligro')); return Math.max(0, i) }) // primera que no es la automática ni de riesgo
      await a.locator('.ctrl-tarjeta').nth(Math.min(nCard, n - 1)).hover(); await sleep(250)
      const detalle = (await a.locator('.ctrl-detalle-panel').innerText()).replace(/\s+/g, ' ').slice(0, 260)
      if (fotos) { await foto(a, `04_selector_${nombre}_hover_A`); await a.locator('.ctrl-tarjeta').nth(Math.min(nCard, n - 1)).hover(); await sleep(200) }
      await a.locator('.ctrl-btn-elegir').click()
      await a.locator('.ctrl-modal').waitFor({ state: 'hidden' })
      return { tarjetas: n, detalle }
    }
    const intentos = []; let esperas = 0
    for (let k = 0; k < 4; k++) {
      // sin ballita propia (murió en un intento anterior): A toma la más sana que esté en un planeta
      let id = await a.evaluate(() => window.__mundo.ballitas.find((x) => x.mia)?.id ?? null)
      if (id == null) id = await a.evaluate(async () => { const x = [...window.__mundo.ballitas].filter((o) => !o.ctrl && o.phase === 'toDest' && Math.min(o.e, o.p) > 35).sort((p, q) => q.timer - p.timer)[0]; if (!x) return null; const r = await window.__mundo.tomar(x); return r.ok ? x.id : null })
      if (id == null) { await sleep(700); k--; if (++esperas > 120) break; continue }
      await a.locator('.ctrl-barra-dec').waitFor({ state: 'visible', timeout: 8000 })
      const fotos = conFotos && k === 0
      const planeta = await elegir(0, 'planeta', fotos ? 1 : -1, fotos)
      const ruta = await elegir(1, 'ruta', fotos ? 1 : -1, fotos)
      await sleep(250)
      const decRuta = await a.evaluate((i) => window.__mundo.ballitas.find((x) => x.id === i)?.dec, id) // por si sale antes de elegir carril
      const carril = await elegir(2, 'carril', 3, fotos)
      await sleep(400)
      const dec = { ...decRuta, ...(await a.evaluate((i) => window.__mundo.ballitas.find((x) => x.id === i)?.dec, id)) }
      const decB = await b.evaluate((i) => window.__mundo.ballitas.find((x) => x.id === i)?.dec, id)
      if (!dec?.ruta) { intentos.push({ id, fin: 'sin_decision', dec }); continue }
      if (fotos) await foto(a, '05_decisiones_fijadas_A')
      await prueba('/prueba/velocidad?x=4')
      // seguimiento en la página: el viaje que consume las decisiones (plan.manual con 'ruta' y dec ya vacía)
      const viaje = await a.evaluate(({ id, dec }) => new Promise((ok) => {
        const r = { consumida: false, rutasVistas: [], muestrasViaje: 0 }; const t0 = performance.now()
        const iv = setInterval(() => {
          const x = window.__mundo.ballitas.find((o) => o.id === id)
          const fin = (motivo) => { clearInterval(iv); r.fin = motivo; r.s = +((performance.now() - t0) / 1000).toFixed(1); ok(r) }
          if (!x) return fin('murio')
          if (!x.mia) return fin('sin_control')
          if (!r.consumida && x.plan?.manual?.includes('ruta') && !x.dec?.ruta && x.way?.idx === dec.ruta.way && (x.phase === 'toPort' || x.phase === 'travel')) { r.consumida = true; r.manual = x.plan.manual; r.razon = x.plan.razon; r.planTexto = `${x.plan.destino} / ${x.plan.ruta}`; r.way = x.way?.idx; r.wayTo = x.way?.to; r.plannedRoute = x.plannedRoute?.idx ?? null; r.rutaEsperada = window.__mundo.world.ways[dec.ruta.way].routes[dec.ruta.r].idx }
          if (r.consumida && x.phase === 'travel') {
            r.muestrasViaje++
            if (r.carrilInicial == null) { r.carrilInicial = x.carril; r.primerTramo = x.seg?.i }
            if (x.route && !r.rutasVistas.includes(x.route.idx)) r.rutasVistas.push(x.route.idx)
          }
          if (r.consumida && r.muestrasViaje && x.phase !== 'travel') { r.llegoA = x.node; return fin('llego') }
          if (performance.now() - t0 > 150000) fin('tiempo')
        }, 25)
      }), { id, dec })
      await prueba('/prueba/velocidad?x=1')
      const cumple = { planeta: viaje.llegoA === dec.destino, ruta: viaje.plannedRoute === viaje.rutaEsperada && viaje.rutasVistas.length > 0 && viaje.rutasVistas.every((r) => r === viaje.rutaEsperada), carril: viaje.manual?.includes('carril') ? viaje.carrilInicial === dec.carril : 'no aplicó (salió antes de elegirlo)' }
      intentos.push({ id, planeta, ruta, carril, dec, bVeLasMismas: JSON.stringify(dec) === JSON.stringify(decB), viaje, cumple })
      if (viaje.fin === 'llego') { await foto(a, '06_tras_cumplir_A', false); break }
    }
    return { intentos }
  })

  await paso('d_dejar_y_tomar', async () => {
    const vive = await a.evaluate(() => !!window.__mundo.ballitas.find((x) => x.mia))
    if (!vive) { // murió durante el viaje: A toma otra para poder dejarla
      idMia = await a.evaluate(async () => { const x = window.__mundo.ballitas.find((o) => !o.ctrl && o.phase !== 'dying'); await window.__mundo.tomar(x); return x.id })
      await a.locator('.ctrl-barra-dec').waitFor({ state: 'visible', timeout: 8000 })
    }
    await a.locator('.ctrl-btn-dejar').click()
    await a.waitForFunction(() => !window.__mundo.ballitas.some((x) => x.mia), null, { timeout: 5000 })
    await foto(a, '07_A_dejo_el_control', false)
    // B la selecciona en la barra de puntos y pulsa «Tomar control»
    const idx = await b.evaluate((id) => window.__mundo.ballitas.findIndex((x) => x.id === id), idMia)
    let porInterfaz = false
    const dots = b.locator('.puntos .punto'); const nd = await dots.count()
    for (const i of [idx, ...Array.from({ length: nd }, (_, k) => k)]) {
      if (i < 0 || i >= nd) continue
      await dots.nth(i).click(); await sleep(250)
      const sel = await b.evaluate((id) => { const el = document.querySelector('.ctrl-tomar-nom'); const x = window.__mundo.ballitas.find((o) => o.id === id); return !!el && !!x && el.textContent.trim() === x.name }, idMia)
      if (sel) { await foto(b, '08_B_puede_tomar'); await b.locator('.ctrl-barra-tomar button.ctrl-btn-primario').click(); porInterfaz = true; break }
    }
    if (!porInterfaz) await b.evaluate((id) => window.__mundo.tomar(id), idMia)
    await b.waitForFunction((id) => window.__mundo.ballitas.find((x) => x.id === id)?.mia, idMia, { timeout: 5000 })
    await sleep(500); await foto(b, '09_B_controla')
    const intentoA = await a.evaluate((id) => window.__mundo.tomar(id), idMia)
    // A la selecciona: su barra dice que la controla otro
    const idxA = await a.evaluate((id) => window.__mundo.ballitas.findIndex((x) => x.id === id), idMia)
    let textoA = null
    try { await a.locator('.puntos .punto').nth(idxA).click(); await sleep(400); textoA = await a.locator('.ctrl-barra-tomar').innerText({ timeout: 2000 }) } catch { /* sin barra */ }
    await foto(a, '10_A_no_puede_tomar')
    return { porInterfaz, intentoDeA: intentoA, barraDeA: textoA?.replace(/\s+/g, ' ') }
  })

  await paso('e_inactividad', async () => {
    await b.evaluate(() => { window.__libres = []; window.__mundo.on('libre', (ev) => window.__libres.push({ motivo: ev.motivo, mia: ev.mia, id: ev.b?.id, t: window.__mundo.tDibujo })) })
    const intentos = []
    for (let k = 0; k < 4; k++) {
      let id = await b.evaluate(() => window.__mundo.ballitas.find((x) => x.mia)?.id ?? null)
      if (id == null) id = await b.evaluate(async () => { const x = [...window.__mundo.ballitas].filter((o) => !o.ctrl && o.phase !== 'dying').sort((p, q) => (q.e + q.p) - (p.e + p.p))[0]; const r = await window.__mundo.tomar(x); return r.ok ? x.id : null })
      if (id == null) { await sleep(1000); continue }
      const t0 = await b.evaluate(() => { window.__libres.length = 0; return window.__mundo.tDibujo })
      await prueba('/prueba/velocidad?x=30')
      const ev = await b.evaluate(() => new Promise((ok) => { const t = performance.now(); const iv = setInterval(() => { const e = window.__libres.find((x) => x.mia); if (e || performance.now() - t > 60000) { clearInterval(iv); ok(e || { motivo: 'tiempo' }) } }, 50) }))
      await prueba('/prueba/velocidad?x=1')
      intentos.push({ id, motivo: ev.motivo, segundosDeSim: ev.t ? +(ev.t - t0).toFixed(0) : null })
      if (ev.motivo === 'inactivo') break
    }
    await sleep(300)
    const aviso = await b.locator('.ctrl-toast').innerText().catch(() => null)
    await foto(b, '11_B_pierde_por_inactividad')
    return { intentos, aviso, sinControl: await b.evaluate(() => !window.__mundo.ballitas.some((x) => x.mia)) }
  })

  await paso('f_reconexion', async () => {
    const pid = Number(process.env.E2E_PID)
    const epoca0 = (await prueba('/salud')).epoca
    res.erroresAntesDeReiniciar = { A: res.errores.A.length, B: res.errores.B.length }
    process.kill(pid)
    await a.waitForFunction(() => window.__mundo.estado === 'reconectando', null, { timeout: 15000 })
    await sleep(300); await foto(a, '12_reconectando_A')
    const hijo = spawn(process.execPath, ['../back/mundo/servidor.bundle.mjs'], { env: { ...process.env, MUNDO_PUERTO: new URL(MUNDO).port, MUNDO_API: process.env.MUNDO_API || '', MUNDO_PRUEBA: '1' }, detached: true, stdio: 'ignore' })
    hijo.unref(); res.pidNuevo = hijo.pid; writeFileSync(`${DIR}/mundo.pid`, String(hijo.pid))
    const tSpawn = Date.now(); let tVuelve = 0; let epoca1 = null
    while (Date.now() - tSpawn < 60000) { try { epoca1 = (await prueba('/salud')).epoca; tVuelve = Date.now(); break } catch { await sleep(50) } }
    const cond = (e0) => window.__mundo.estado === 'listo' && window.__mundo.ballitas.length > 0 && window.__mundo.ballitas.every((x) => x.phase !== 'gone')
    const esperar = async (p) => { await p.waitForFunction(cond, epoca0, { timeout: 30000, polling: 50 }); return Date.now() - tVuelve }
    const [msA, msB] = await Promise.all([esperar(a), esperar(b)])
    await sleep(2500); await foto(a, '13_recuperado_A'); await foto(b, '13_recuperado_B', false)
    const idsA = await a.evaluate(() => window.__mundo.ballitas.map((x) => x.id).sort()); const idsB = await b.evaluate(() => window.__mundo.ballitas.map((x) => x.id).sort())
    return { epocaAntes: epoca0, epocaDespues: epoca1, mundoNuevo: epoca0 !== epoca1, arranqueServidorMs: tVuelve - tSpawn, msRecuperaA: msA, msRecuperaB: msB, mismasBallitas: JSON.stringify(idsA) === JSON.stringify(idsB), ballitas: idsA.length }
  })

  await paso('g_consola', async () => {
    const n = res.erroresAntesDeReiniciar || { A: res.errores.A.length, B: res.errores.B.length }
    return { erroresAntesDeReiniciar: n, erroresTotales: { A: res.errores.A.length, B: res.errores.B.length }, muestra: [...res.errores.A.slice(0, 4), ...res.errores.B.slice(0, 2)] }
  })
  await A.ctx.close(); await B.ctx.close()
}

// A/B de FPS en la misma sesión: build de main frente a esta rama, alternando, una página a la vez.
async function abFps(browser) {
  const medir = async (url, etiqueta) => {
    const { ctx, page } = await abrir(browser, etiqueta === 'e2e' ? 'e2e-espectador-F-0003' : null, url)
    const errores = []; page.on('pageerror', (e) => errores.push(e.message.slice(0, 160)))
    try {
      await page.goto(url)
      await page.waitForFunction(() => document.querySelector('canvas') && document.querySelectorAll('.puntos .punto').length > 0, null, { timeout: 90000 })
      await sleep(6000)
      const modoMundo = await page.evaluate(() => window.__mundo?.modo ?? 'main')
      const general = await fps(page, 4000)
      await page.keyboard.press('3'); await sleep(4000)
      const pov = await fps(page, 4000)
      await page.screenshot({ path: `${DIR}/fps_${etiqueta}_pov.jpg`, type: 'jpeg', quality: 60 })
      return { general, pov, modoMundo, errores }
    } finally { await ctx.close() }
  }
  const rondas = []
  for (let k = 0; k < 3; k++) {
    const m = await medir(URL_MAIN, 'main'); const e = await medir(URL_APP, 'e2e')
    rondas.push({ main: m, e2e: e }); log('ronda', k, JSON.stringify({ main: m, e2e: e })); res.pasos.fps = { rondas }; guardar()
  }
  const med = (xs) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)]
  const r = { general: { main: med(rondas.map((x) => x.main.general)), e2e: med(rondas.map((x) => x.e2e.general)) }, pov: { main: med(rondas.map((x) => x.main.pov)), e2e: med(rondas.map((x) => x.e2e.pov)) } }
  r.general.cambioPct = +((r.general.e2e / r.general.main - 1) * 100).toFixed(1); r.pov.cambioPct = +((r.pov.e2e / r.pov.main - 1) * 100).toFixed(1)
  res.pasos.fps = { rondas, mediana: r }; log(JSON.stringify(r)); guardar()
}

let browser
await candado()
try {
  browser = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1360,960', '--ignore-gpu-blocklist', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling'] })
  if (modo === 'fps') await abFps(browser); else await e2e(browser)
} catch (e) { res.fatal = String(e.stack || e).slice(0, 600); log('FATAL', res.fatal) } finally {
  try { await browser?.close() } catch { /* ya cerrado */ }
  soltar(); guardar()
}
