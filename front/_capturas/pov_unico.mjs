// Sonda del POV único: entra en POV (tecla V), a 3×, y muestrea CADA cuadro (rAF) si la ballita seguida está en
// cuadro, en qué fase (carretera / planeta) y con qué modo de cámara. Cuenta entradas y salidas de planeta y mide el
// % de cuadros con la ballita en cuadro en los 3 s tras cada cambio. Además mide el bocadillo en POV de espalda
// (alto en % de pantalla, solape con tarjeta/joystick/panel y si tapa el centro) y captura cada fase.
// uso: node pov_unico.mjs <url> <carpeta> <desk|movil> <espalda|ojos> [cambios=6] [segundos=300]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const [url, dir, vpName = 'desk', zoomArg = 'espalda', nArg = '6', secsArg = '300'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const VPS = {
  desk: { viewport: { width: 1400, height: 900 } },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 12 * 60 * 1000)
const out = { vp: vpName, zoom: zoomArg, eventos: [], burbuja: [], shots: [], errs: [] }
try {
  const ctx = await b.newContext(VPS[vpName])
  const p = await ctx.newPage()
  p.on('console', (m) => { if (m.type() === 'error') out.errs.push(m.text().slice(0, 200)) })
  p.on('pageerror', (e) => out.errs.push('pageerror: ' + e.message))
  await p.goto(url)
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
  await sleep(6000)
  await p.locator('button[aria-label="Velocidad triple"]').click().catch(() => {})
  await p.keyboard.press('v')
  await sleep(1500)
  // muestreador por cuadro
  await p.evaluate(() => {
    const P = window.__povProbe = { f: [], ev: [], prevPl: null }
    const tick = () => {
      const c = window.__ballitasDebug?.cam
      const s = c?.selected
      if (s && s.phase !== 'gone') {
        const enPl = s.phase !== 'travel' && Number.isInteger(s.node)
        const pos = (enPl && c.bp ? c.bp : s.pos).clone()
        const dist = c.camera.position.distanceTo(s.pos)
        const v = pos.project(c.camera)
        const enCuadro = v.z > -1 && v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1
        const t = performance.now()
        if (P.prevPl !== null && P.prevPl !== enPl) P.ev.push({ t, tipo: enPl ? 'entrada' : 'salida', fase: s.phase })
        P.prevPl = enPl
        P.f.push([t, enPl ? 1 : 0, enCuadro ? 1 : 0, dist < 0.6 ? 1 : 0, c.modo, +dist.toFixed(2), +v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(3), s.phase, +(window.__ballitasPov?.zoom ?? -1).toFixed(2)])
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const estado = () => p.evaluate(() => { const s = window.__ballitasDebug?.cam?.selected; return s ? { phase: s.phase, name: s.name, ev: window.__povProbe.ev.length } : null })
  const shot = async (tag) => {
    const s = await estado()
    const name = `${vpName}_${zoomArg}_${String(out.shots.length).padStart(2, '0')}_${tag}_${s?.phase}.jpg`
    await p.screenshot({ path: `${dir}/${name}`, type: 'jpeg', quality: 70 })
    out.shots.push(name)
  }
  const burbuja = () => p.evaluate(() => {
    const W = innerWidth; const H = innerHeight
    const sel = [...document.querySelectorAll('.bubble.globo:not(.otra)')].filter((e) => e.getBoundingClientRect().width > 0)
    const panel = [...document.querySelectorAll('aside.tarjeta, .pov-joy-wrap, .pov-panel')].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0)
    return sel.map((e) => {
      const r = e.getBoundingClientRect()
      const solape = panel.some((q) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top)
      const centro = r.left < W / 2 && r.right > W / 2 && r.top < H / 2 && r.bottom > H / 2
      return { altoPct: +(100 * r.height / H).toFixed(1), top: Math.round(r.top), bottom: Math.round(r.bottom), solape, centro }
    })
  })
  // zoom de espalda (solo en carretera: en planeta las teclas +/- son del seguimiento)
  const ponerZoom = async () => {
    if (zoomArg !== 'espalda') return
    await sleep(1500)
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 12; i++) await p.keyboard.press('-')
      await sleep(900)
      if ((await p.evaluate(() => window.__ballitasPov?.zoom ?? 1)) < 0.15) break
    }
  }
  const t0 = Date.now()
  let zoomOk = false; let nEv = 0; let shotsRoad = 0
  while (Date.now() - t0 < +secsArg * 1000) {
    const s = await estado()
    if (!s) { await sleep(300); continue }
    if (s.phase === 'travel' && !zoomOk) { await ponerZoom(); zoomOk = true }
    if (s.ev > nEv) {
      nEv = s.ev
      const ev = await p.evaluate(() => window.__povProbe.ev.at(-1).tipo)
      await sleep(250); await shot(`${ev}_0.25s`)
      await sleep(900); await shot(`${ev}_1.2s`)
      if (ev === 'salida' && zoomArg === 'espalda') { await sleep(800); await shot('salida_2s') }
      if (nEv >= +nArg) break
      continue
    }
    if (s.phase === 'travel' && zoomOk) {
      const bb = await burbuja()
      if (bb.length) { out.burbuja.push(...bb); if (shotsRoad < 3) { shotsRoad++; await shot('carretera_bocadillo') } }
    }
    await sleep(400)
  }
  await sleep(3200) // ventana completa tras el último cambio
  const { f, ev } = await p.evaluate(() => ({ f: window.__povProbe.f, ev: window.__povProbe.ev }))
  const ventana = (e) => f.filter((x) => x[0] >= e.t && x[0] <= e.t + 3000)
  const pct = (fr, k = (x) => x[2] || x[3]) => fr.length ? +(100 * fr.filter(k).length / fr.length).toFixed(1) : null
  out.eventos = ev.map((e) => { const fr = ventana(e); return { tipo: e.tipo, fase: e.fase, cuadros: fr.length, enCuadroPct: pct(fr), modos: [...new Set(fr.map((x) => x[4]))].join('>'), fuera: fr.filter((x) => !(x[2] || x[3])).map((x) => [Math.round(x[0] - e.t), x[4], x[9], x[5], x[6], x[7], x[8], x[10]]) } })
  out.fueraCarretera = f.filter((x) => !x[1] && !(x[2] || x[3])).slice(0, 60).map((x) => [Math.round(x[0]), x[4], x[9], x[5], x[6], x[7], x[8], x[10]])
  out.total = { cuadros: f.length, enCuadroPct: pct(f), carretera: pct(f.filter((x) => !x[1])), planeta: pct(f.filter((x) => x[1])) }
  const bb = out.burbuja
  out.burbujaResumen = bb.length ? { n: bb.length, altoMaxPct: Math.max(...bb.map((x) => x.altoPct)), solapes: bb.filter((x) => x.solape).length, tapaCentro: bb.filter((x) => x.centro).length } : { n: 0 }
} finally {
  clearTimeout(guardia)
  await b.close().catch(() => {})
}
writeFileSync(`${dir}/${vpName}_${zoomArg}.json`, JSON.stringify(out, null, 1))
console.log(JSON.stringify({ ...out, burbuja: undefined }, null, 1))
