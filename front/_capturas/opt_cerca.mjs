// Sonda OPT: capturas A/B (window.__opt.off) de la vista general y de un planeta a media distancia (fuera de
// LOD_NEAR: fusión activa) y de cerca (dentro de LOD_NEAR: fusión inactiva), en la misma sesión.
// uso: node opt_cerca.mjs <url> <desk|movil> <carpeta salida> <playwright index.mjs> <candado>
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [url, vp, dir, pw, lock] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
for (let i = 0; i < 40 && existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60 * 1000; i++) { console.log('candado ocupado, espero 30 s'); await sleep(30000) }
writeFileSync(lock, `opt-cerca ${new Date().toISOString()}`)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1450,1000', '--ignore-gpu-blocklist'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => { try { rmSync(lock) } catch {} process.exit(2) }) }, 6 * 60 * 1000)
try {
  const p = await (await b.newContext(VPS[vp])).newPage(); const errs = []
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)))
  p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
  await p.goto(url); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(14000)
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let root = div[k]; while (root.return) root = root.return
    let ctl = null
    const walk = (f, d = 0) => { for (let c = f; c && !ctl; c = c.sibling) { const o = c.memoizedProps?.object; if (o && o.target && 'enableDamping' in o) { ctl = o; return } if (c.child && d < 600) walk(c.child, d + 1) } }
    walk(root)
    const d = window.__ballitasDebug
    const planetas = []
    d.scene.traverse((o) => { if (o.isMesh && o.material?.uniforms?.uDistBoost) { const v = new d.camera.position.constructor(); o.getWorldPosition(v); planetas.push(v) } })
    // sin OrbitControls a mano: objetivo = punto a la distancia del planeta más cercano en la dirección de la vista
    const fw = new d.camera.position.constructor(); d.camera.getWorldDirection(fw)
    const dmin = Math.min(...planetas.map((v) => v.distanceTo(d.camera.position)))
    const T0 = ctl ? ctl.target.clone() : d.camera.position.clone().addScaledVector(fw, dmin)
    window.__cer = { ctl, planetas, T0, P0: d.camera.position.clone() }
    window.__cerPon = (modo) => {
      const c = window.__cer; const cam = d.camera
      let mira = c.T0
      if (modo === 'general') { cam.position.copy(c.P0) } else {
        const pl = c.planetas[0]; const dist = modo === 'media' ? 130 : 70
        const dir = c.P0.clone().sub(pl).normalize()
        cam.position.copy(pl).addScaledVector(dir, dist); mira = pl
      }
      if (c.ctl) { c.ctl.target.copy(mira) }
      cam.lookAt(mira); if (c.ctl) c.ctl.update()
      c.modo = modo
    }
    // se reaplica cada cuadro (sin OrbitControls hallado, otro control podría mover la cámara)
    const fija = () => { if (window.__cer.modo) { const m = window.__cer.modo; window.__cer.modo = null; window.__cerPon(m) } requestAnimationFrame(fija) }
    requestAnimationFrame(fija)
  })
  const info = await p.evaluate(() => ({ ctl: !!window.__cer.ctl, planetas: window.__cer.planetas.length }))
  console.log(JSON.stringify(info))
  for (const modo of ['general', 'media', 'cerca']) {
    for (const off of (process.env.OPT_INV ? [false, true] : [true, false])) {
      await p.evaluate(([modo, off]) => { (window.__opt ||= {}).off = off; window.__cerPon(modo) }, [modo, off])
      await sleep(2500)
      await p.evaluate((modo) => window.__cerPon(modo), modo)
      await sleep(500)
      const calls = await p.evaluate(() => window.__ballitasDebug.gl.info.render.calls)
      if (process.env.OPT_DBG) { await p.evaluate(() => { window.__opt.dbg = {} }); await sleep(300); console.log(JSON.stringify(await p.evaluate(() => window.__opt.dbg))) }
      writeFileSync(`${dir}/${vp}_${modo}_${off ? 'antes' : 'despues'}.png`, await p.screenshot({ type: 'png' }))
      console.log(modo, off ? 'antes' : 'despues', 'calls', calls)
    }
  }
  console.log(JSON.stringify({ errs: errs.slice(0, 8) }))
} finally { clearTimeout(guardia); await b.close().catch(() => {}); try { rmSync(lock) } catch {} }
