// Sonda de las rutas dinámicas en modo local (?local=1&stats=1), con build de producción.
//   1. captura de la vista general con las rutas activas del arranque
//   2. A/B en la MISMA sesión: FPS, triángulos y llamadas de dibujo con las rutas activas frente a todas
//      (window.__RUTAS.forzarTodas), alternando tramos
//   3. peor cuadro al aparecer y al recogerse una ruta (aparecerRuta / quitarRuta de la sim real, una a una)
//   4. avance acelerado de la sim (ticks extra por cuadro) y segunda captura con otras rutas activas
//   5. toma una ballita y abre el selector de rutas: solo debe ofrecer rutas activas
// Siempre cierra el navegador. Candado de navegador compartido: se crea antes y se borra al terminar.
// uso: node rutas_sonda.mjs <url base, p. ej. http://localhost:4306/> <carpeta de capturas> [tramos=8] [tramo_s=5]
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'

const [base = 'http://localhost:4306/', dir = '.', tramosA = '8', tramoA = '5'] = process.argv.slice(2)
const CANDADO = process.env.NAVEGADOR_LOCK || ''
const espera = (ms) => new Promise((r) => setTimeout(r, ms))
if (CANDADO) {
  for (let i = 0; i < 40; i++) {
    let viejo = true
    try { viejo = Date.now() - fs.statSync(CANDADO).mtimeMs > 10 * 60 * 1000 } catch { break }
    if (viejo) break
    console.log('navegador ocupado: espero 30 s'); await espera(30000)
  }
  fs.writeFileSync(CANDADO, `rutas_sonda ${new Date().toISOString()}`)
}
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => { try { if (CANDADO) fs.unlinkSync(CANDADO) } catch { /* ya no está */ } process.exit(2) }) }, 9 * 60 * 1000)
const out = {}
try {
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(`${base}?local=1&stats=1`)
  await p.waitForFunction(() => window.__ballitasDebug?.gl && window.__RUTAS, null, { timeout: 90000 })
  await p.waitForTimeout(9000)
  // la sim real es el prototipo de la fachada local (sus métodos internos escriben en ella)
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement
    const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let f = div[k]; let mundo = null
    while (f) { const pr = f.memoizedProps; if (pr?.sim && !mundo) mundo = pr.sim; f = f.return }
    window.__m = mundo; window.__s = Object.getPrototypeOf(mundo)
  })
  const estado = () => p.evaluate(() => {
    const s = window.__s; const R = window.__RUTAS
    return { t: +s.t.toFixed(1), activas: [...s.activas].sort((a, b) => a - b), montadas: [...R.montadas].sort((a, b) => a - b), grupos: R.grupos.size, anim: R.anim.size, cambios: R.cambios, modo: window.__m.modo }
  })
  out.inicio = await estado()
  console.log('INICIO', JSON.stringify(out.inicio))
  await p.screenshot({ path: path.join(dir, 'rutas_general_1.png') })

  // ── A/B: activas frente a todas ──
  const medir = (ms) => p.evaluate((ms) => new Promise((ok) => {
    const d = window.__ballitasDebug; const t0 = performance.now(); let n = 0; let tris = 0; let calls = 0; let tIni = 0; let ant = 0; let peor = 0
    const f = (now) => {
      const t = performance.now() - t0
      if (t > 1000) { if (!tIni) tIni = performance.now(); else peor = Math.max(peor, now - ant); n++; tris += d.gl.info.render.triangles; calls += d.gl.info.render.calls }
      ant = now
      if (t < ms) requestAnimationFrame(f)
      else ok({ fps: +(n / ((performance.now() - tIni) / 1000)).toFixed(1), tris: Math.round(tris / n), calls: Math.round(calls / n), peor: +peor.toFixed(1), montadas: window.__RUTAS.montadas.size })
    }
    requestAnimationFrame(f)
  }), ms)
  const filas = []
  for (let i = 0; i < +tramosA; i++) {
    const todas = i % 2 === 0
    await p.evaluate((x) => { window.__RUTAS.forzarTodas = x }, todas)
    await p.waitForTimeout(3500) // montaje y animación fuera de la medida
    const r = await medir(+tramoA * 1000)
    filas.push({ i, modo: todas ? 'todas' : 'activas', ...r }); console.log(JSON.stringify(filas.at(-1)))
  }
  await p.evaluate(() => { window.__RUTAS.forzarTodas = false }); await p.waitForTimeout(3000)
  const media = (m, k) => { const xs = filas.filter((x) => x.modo === m).map((x) => x[k]); return xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length) }
  out.ab = {}
  for (const k of ['fps', 'tris', 'calls', 'montadas']) { const a = media('activas', k); const t = media('todas', k); out.ab[k] = { activas: +a.toFixed(1), todas: +t.toFixed(1), difPct: +(((a - t) / (t || 1)) * 100).toFixed(1) } }
  console.log('AB', JSON.stringify(out.ab))

  // ── peor cuadro al aparecer y al recogerse una ruta (a velocidad real, una a una) ──
  const cuadros = (accion) => p.evaluate((accion) => new Promise((ok) => {
    const s = window.__s; const R = window.__RUTAS; let ant = 0; let peor = 0; let n = 0; let suma = 0; const t0 = performance.now(); let hecho = null
    const f = (now) => {
      if (ant) { const d = now - ant; if (hecho != null) { peor = Math.max(peor, d); suma += d; n++ } }
      ant = now
      if (hecho == null && performance.now() - t0 > 400) {
        if (accion === 'aparece') { const w = s.aparecerRuta('sonda'); hecho = w ? w.idx : -1 }
        else { const w = s.world.ways.find((x) => s.puedeQuitarRuta(x)); hecho = w && s.quitarRuta(w, 'sonda') ? w.idx : -1 }
      }
      if (performance.now() - t0 < 3200) requestAnimationFrame(f)
      else ok({ accion, ruta: hecho, peorMs: +peor.toFixed(1), mediaMs: +(suma / Math.max(1, n)).toFixed(2), montadas: R.montadas.size, anim: R.anim.size })
    }
    requestAnimationFrame(f)
  }), accion)
  out.cuadros = []
  for (let i = 0; i < 6; i++) {
    for (const accion of ['aparece', 'quita']) { const r = await cuadros(accion); out.cuadros.push(r); console.log(JSON.stringify(r)) }
  }
  // a mitad de una aparición: la ruta crece desde su planeta
  await p.evaluate(() => { window.__s.aparecerRuta('sonda') }); await p.waitForTimeout(550)
  await p.screenshot({ path: path.join(dir, 'rutas_apareciendo.png') })
  await p.waitForTimeout(1500)

  // ── avance acelerado: 6 min de sim en ticks extra por cuadro ──
  const antes = await estado()
  const acel = await p.evaluate(() => new Promise((ok) => {
    const m = window.__m; const s = window.__s; const t0 = s.t; let ev = 0; const baja = m.on('rutas', () => { ev++ })
    let minSal = 99
    const f = () => {
      for (let i = 0; i < 12; i++) m.tick(0.05)
      for (const n of s.world.nodes) minSal = Math.min(minSal, s.salidasDistintas(n.idx))
      if (s.t - t0 < 360) requestAnimationFrame(f); else { baja(); ok({ simS: +(s.t - t0).toFixed(0), eventos: ev, minSalidas: minSal }) }
    }
    requestAnimationFrame(f)
  }))
  await p.waitForTimeout(3000)
  out.acelerado = { ...acel, antes: antes.activas, despues: (await estado()).activas }
  out.fin = await estado()
  console.log('ACELERADO', JSON.stringify(out.acelerado)); console.log('FIN', JSON.stringify(out.fin))
  await p.screenshot({ path: path.join(dir, 'rutas_general_2.png') })

  // ── selector de rutas: solo activas ──
  const sel = await p.evaluate(async () => {
    const m = window.__m; const s = window.__s
    const c = s.ballitas.find((x) => x.phase === 'at' || x.phase === 'toDest') ?? s.ballitas.find((x) => x.phase !== 'dying' && x.phase !== 'gone')
    const r = await m.tomar(c)
    const o = m.opciones(c)
    const todas = s.world.waysFrom[o.origen].map((w) => w.idx)
    return { tomar: r, ballita: c.name, origen: s.world.nodes[o.origen].name, salenDelPlaneta: todas, activasDelPlaneta: todas.filter((i) => s.activas.has(i)), planetas: o.planetas.map((x) => x.name), rutas: o.rutas.map((x) => `${x.wayIdx}:${x.name}`), todasActivas: o.rutas.every((x) => s.activas.has(x.wayIdx)) && o.planetas.every((x) => s.activas.has(x.wayIdx)) }
  })
  out.selector = sel; console.log('SELECTOR', JSON.stringify(sel))
  await p.waitForTimeout(1200)
  const botones = p.locator('.ctrl-dec-btn')
  out.selector.botones = await botones.count()
  if (out.selector.botones >= 2) {
    await botones.nth(1).click(); await p.waitForTimeout(1500)
    await p.screenshot({ path: path.join(dir, 'rutas_selector.png') })
    await p.keyboard.press('Escape'); await p.waitForTimeout(400)
    await botones.nth(0).click(); await p.waitForTimeout(1500)
    await p.screenshot({ path: path.join(dir, 'rutas_selector_planeta.png') })
  }
  out.errores = errs.slice(0, 10)
  console.log('ERRORES', errs.length, JSON.stringify(errs.slice(0, 5)))
  fs.writeFileSync(path.join(dir, 'rutas_sonda.json'), JSON.stringify(out, null, 1))
} finally {
  clearTimeout(guardia)
  await b.close().catch(() => {})
  try { if (CANDADO) fs.unlinkSync(CANDADO) } catch { /* ya no está */ }
}
