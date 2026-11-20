// Sonda de verificación P3 (control.html): mide tiempos de apertura (< 100 ms), FPS antes/con selector abierto,
// solapes de rectángulos con .tarjeta / .pov-joy-wrap / nav.puntos, teclado (flechas, Esc), táctil, 360 px de ancho,
// y toma capturas de formar, fila, los tres selectores abiertos y hover/detalle de planeta en escritorio y móvil.
// Uso: node _capturas/p3_sonda.mjs [url=http://127.0.0.1:4304/control.html] [dir=_capturas/p3]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const url = process.argv[2] || 'http://127.0.0.1:4304/control.html'
const dir = process.argv[3] || '_capturas/p3'
const LOCK_PATH = 'C:\\Users\\ojito\\AppData\\Local\\Temp\\claude\\ba990d845fa529aa\\37147198-7b8f-4f1d-872e-a09fdd6475b5\\scratchpad\\navegador.lock'

const VPS = {
  desk: { viewport: { width: 1280, height: 720 } },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function adquirirCandado() {
  mkdirSync(dirname(LOCK_PATH), { recursive: true })
  while (existsSync(LOCK_PATH)) {
    const edadMs = Date.now() - statSync(LOCK_PATH).mtimeMs
    if (edadMs > 10 * 60 * 1000) break
    console.log('Candado navegador.lock activo, esperando 30s...')
    await sleep(30000)
  }
  writeFileSync(LOCK_PATH, `${process.pid} ${new Date().toISOString()}\n`)
}

function liberarCandado() {
  try { if (existsSync(LOCK_PATH)) unlinkSync(LOCK_PATH) } catch {}
}

async function medirFps(page, ms = 1200) {
  return page.evaluate((dur) => new Promise((res) => {
    let n = 0
    const t0 = performance.now()
    const step = () => {
      n++
      const dt = performance.now() - t0
      if (dt < dur) requestAnimationFrame(step)
      else res({ fps: +((n * 1000) / dt).toFixed(1), frameMs: +(dt / n).toFixed(2), cuadros: n })
    }
    requestAnimationFrame(step)
  }), ms)
}

async function medirSolapes(page) {
  return page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height } : null
    }
    const choca = (a, b) => a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    const dec = rect('.ctrl-barra-dec') || rect('.ctrl-barra-tomar')
    const tarjeta = rect('.tarjeta')
    const joy = rect('.pov-joy-wrap')
    const puntos = rect('nav.puntos')
    const barra = rect('.barra')
    const hub = rect('.ctrl-panel') || rect('.ctrl-hub-bar')
    const barraBtns = [...document.querySelectorAll('.barra h1, .barra .dato, .barra button')].map((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0 ? { left: r.left, top: r.top, right: r.right, bottom: r.bottom } : null
    }).filter(Boolean)
    return {
      vw: innerWidth,
      vh: innerHeight,
      overflowX: document.documentElement.scrollWidth > innerWidth,
      scrollW: document.documentElement.scrollWidth,
      solapeDecTarjeta: choca(dec, tarjeta),
      solapeDecJoy: choca(dec, joy),
      solapeDecPuntos: choca(dec, puntos),
      solapeHubJoy: choca(hub, joy),
      solapeHubBarra: barraBtns.some((b) => choca(hub, b)),
    }
  })
}

async function correrViewport(browser, vpName) {
  const ctx = await browser.newContext(VPS[vpName])
  const page = await ctx.newPage()
  const errores = []
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text().slice(0, 220)) })
  page.on('pageerror', (e) => errores.push(`pageerror: ${e.message}`))

  const res = { viewport: vpName, errores, capturas: [] }
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => Boolean(window.__ballitasMundo?.ballitas?.length && document.querySelector('canvas')), null, { timeout: 60000 })
    await sleep(1800)

    // 1. Medir FPS base (sin selector abierto)
    res.fpsBase = await medirFps(page, 1200)

    // 2. Captura de Formar (abrir hub si está colapsado en móvil)
    const toggle = page.locator('.ctrl-hub-toggle')
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click()
      await sleep(150)
    }
    await page.locator('#ctrl-nombre-input').waitFor({ state: 'visible' })
    await page.locator('#ctrl-nombre-input').fill('AstroP3')
    await sleep(150)
    const shot1 = `${vpName}_01_formar.jpg`
    await page.screenshot({ path: `${dir}/${shot1}`, type: 'jpeg', quality: 82 })
    res.capturas.push(shot1)

    // 3. Formar -> Captura de Fila con puesto propio
    await page.locator('button[type="submit"].ctrl-btn-primario').click()
    await page.locator('.ctrl-fila-item.mia').waitFor({ state: 'visible' })
    await sleep(150)
    res.puestoEnFila = await page.locator('.ctrl-fila-mia-resumen').innerText()
    const shot2 = `${vpName}_02_fila.jpg`
    await page.screenshot({ path: `${dir}/${shot2}`, type: 'jpeg', quality: 82 })
    res.capturas.push(shot2)

    // Colapsar hub en móvil para liberar pantalla antes de tomar ballita y entrar en POV
    if (vpName === 'movil') {
      await toggle.click()
      await sleep(150)
    }

    // 4. Seleccionar una ballita libre (sin ctrl), entrar en POV para verificar joystick + tarjeta + barra
    const libreId = await page.evaluate(() => {
      const m = window.__ballitasMundo
      const b = m.ballitas.find((x) => !x.ctrl && x.phase !== 'dying' && x.phase !== 'gone')
      return b?.id
    })
    const dots = page.locator('.puntos .punto')
    const nDots = await dots.count()
    for (let i = 0; i < nDots; i++) {
      const pressed = await dots.nth(i).getAttribute('aria-pressed')
      if (pressed !== 'true') {
        await dots.nth(i).click()
        const hasTomar = await page.locator('.ctrl-barra-tomar button.ctrl-btn-primario').count()
        if (hasTomar > 0) break
      }
    }
    await page.locator('.ctrl-barra-tomar button.ctrl-btn-primario').click()
    await page.locator('.ctrl-barra-dec').waitFor({ state: 'visible' })
    await sleep(200)

    // Entrar a POV ('v') para verificar no solape con .pov-joy-wrap ni .tarjeta
    await page.keyboard.press('v')
    await sleep(700)
    res.solapesEnPov = await medirSolapes(page)

    // Simular 1 llegada sin decidir en memoria para comprobar aviso «Te quedan 2 rutas sin decidir»
    await page.evaluate(() => {
      const m = window.__ballitasMundo
      const b = m.ballitas.find((x) => x.mia)
      if (b) { b.sinDecidir = 1; m._sim._onEvent('cambio') }
    })
    await sleep(150)
    res.avisoInactividad = await page.locator('.ctrl-aviso-inact').innerText()
    const shotBar = `${vpName}_00_barra_pov.jpg`
    await page.screenshot({ path: `${dir}/${shotBar}`, type: 'jpeg', quality: 82 })
    res.capturas.push(shotBar)

    // Medir FPS justo antes de abrir el selector (misma vista POV para A/B justo)
    res.fpsAntesSelector = await medirFps(page, 1200)

    // 5. Abrir selector de Planeta y medir tiempo de apertura (< 100 ms) + hover/toque + FPS con modal abierto
    const btnPlaneta = page.locator('.ctrl-dec-btn').nth(0)
    const t0P = await page.evaluate(() => performance.now())
    await btnPlaneta.click()
    await page.locator('.ctrl-modal').waitFor({ state: 'visible' })
    const t1P = await page.evaluate(() => performance.now())
    // Medición exacta en el mismo tick/rAF desde clic en navegador:
    res.aperturaPlanetaMs = +(t1P - t0P).toFixed(1)

    // Medir apertura pura en DOM vía click + rAF dentro de la página
    await page.keyboard.press('Escape')
    await page.locator('.ctrl-modal').waitFor({ state: 'hidden' })
    res.aperturaDomMs = await page.evaluate(() => new Promise((resolve) => {
      const btn = document.querySelectorAll('.ctrl-dec-btn')[0]
      const a = performance.now()
      btn.click()
      requestAnimationFrame(() => {
        const b = performance.now()
        resolve(+(b - a).toFixed(2))
      })
    }))
    await page.locator('.ctrl-modal').waitFor({ state: 'visible' })

    // Verificar foco visible y flechas en teclado
    const antesFoco = await page.locator('.ctrl-detalle-head h4').innerText()
    await page.keyboard.press('ArrowRight')
    await sleep(100)
    const despuesFlecha = await page.locator('.ctrl-detalle-head h4').innerText()
    res.tecladoFlechaCambiaDetalle = antesFoco !== despuesFlecha

    // Hover en escritorio o toque en móvil sobre una tarjeta distinta de la activa actual
    const inactiva = page.locator('.ctrl-tarjeta[data-activa="false"]').first()
    if ((await inactiva.count()) > 0) {
      if (vpName === 'desk') await inactiva.hover()
      else await inactiva.tap()
      await sleep(150)
    }
    res.detallePlaneta = await page.locator('.ctrl-detalle-panel').innerText()
    res.fpsSelectorAbierto = await medirFps(page, 1200)
    const shot3 = `${vpName}_03_selector_planeta_hover.jpg`
    await page.screenshot({ path: `${dir}/${shot3}`, type: 'jpeg', quality: 82 })
    res.capturas.push(shot3)

    // Verificar Esc cierra el selector sin sacar del POV
    await page.keyboard.press('Escape')
    await page.locator('.ctrl-modal').waitFor({ state: 'hidden' })
    res.sigueEnPovTrasEsc = (await page.locator('.pov-panel').count()) > 0

    // 6. Abrir selector de Ruta
    await page.locator('.ctrl-dec-btn').nth(1).click()
    await page.locator('.ctrl-modal').waitFor({ state: 'visible' })
    await sleep(150)
    if ((await page.locator('.ctrl-tarjeta').count()) >= 2 && vpName === 'desk') {
      await page.locator('.ctrl-tarjeta').nth(1).hover()
      await sleep(100)
    }
    const shot4 = `${vpName}_04_selector_ruta.jpg`
    await page.screenshot({ path: `${dir}/${shot4}`, type: 'jpeg', quality: 82 })
    res.capturas.push(shot4)

    // Elegir la ruta en el modal (en móvil pulsar el botón «Elegir» del detalle, en desk click)
    await page.locator('.ctrl-btn-elegir').click()
    await page.locator('.ctrl-modal').waitFor({ state: 'hidden' })
    await sleep(120)
    res.decisionTrasRuta = await page.evaluate(() => window.__ballitasMundo.ballitas.find((x) => x.mia)?.dec)

    // 7. Abrir selector de Carril
    await page.locator('.ctrl-dec-btn').nth(2).click()
    await page.locator('.ctrl-modal').waitFor({ state: 'visible' })
    await sleep(150)
    if ((await page.locator('.ctrl-tarjeta').count()) >= 3 && vpName === 'desk') {
      await page.locator('.ctrl-tarjeta').nth(2).hover()
      await sleep(100)
    }
    const shot5 = `${vpName}_05_selector_carril.jpg`
    await page.screenshot({ path: `${dir}/${shot5}`, type: 'jpeg', quality: 82 })
    res.capturas.push(shot5)

    // 8. Prueba a 360 px de ancho (en móvil)
    if (vpName === 'movil') {
      await page.setViewportSize({ width: 360, height: 640 })
      await sleep(150)
      res.solape360Modal = await page.evaluate(() => ({
        vw: innerWidth,
        overflowX: document.documentElement.scrollWidth > innerWidth,
        scrollW: document.documentElement.scrollWidth,
      }))
      await page.keyboard.press('Escape')
      await page.locator('.ctrl-modal').waitFor({ state: 'hidden' })
      await sleep(150)
      res.solape360Barra = await medirSolapes(page)
    } else {
      await page.keyboard.press('Escape')
      await page.locator('.ctrl-modal').waitFor({ state: 'hidden' })
    }

    // 9. Probar dejar de controlar
    await page.locator('.ctrl-btn-dejar').click()
    await page.locator('.ctrl-barra-tomar').waitFor({ state: 'visible' })
    res.dejoControlOk = true
  } finally {
    await ctx.close()
  }
  return res
}

mkdirSync(dir, { recursive: true })
await adquirirCandado()

const srv = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', '4304', '--strictPort', '--host', '127.0.0.1'], {
  stdio: 'ignore',
  windowsHide: true,
})

async function esperarServidor() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(url)
      if (r.ok) return
    } catch {}
    await sleep(250)
  }
  throw new Error(`No respondió ${url}`)
}

let browser = null
const guardia = setTimeout(() => {
  try { srv.kill('SIGKILL') } catch {}
  Promise.resolve(browser?.close()).catch(() => {}).finally(() => { liberarCandado(); process.exit(2) })
}, 8 * 60 * 1000)

try {
  await esperarServidor()
  browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--window-size=1360,960', '--ignore-gpu-blocklist'],
  })
  const desk = await correrViewport(browser, 'desk')
  const movil = await correrViewport(browser, 'movil')
  const resumen = { fecha: new Date().toISOString(), url, desk, movil }
  writeFileSync(`${dir}/resumen.json`, JSON.stringify(resumen, null, 2))
  console.log(JSON.stringify(resumen, null, 2))
} finally {
  clearTimeout(guardia)
  await browser?.close().catch(() => {})
  try { srv.kill('SIGKILL') } catch {}
  liberarCandado()
}
