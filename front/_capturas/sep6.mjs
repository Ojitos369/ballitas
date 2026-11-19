// Sonda SEP sesión 6: vista libre, POV (tecla 3) justo tras una bifurcación y en un sacacorchos/espiral, y FPS medio
// de 30 s en POV; escritorio (1400×900) y móvil (412×915). Un navegador a la vez; siempre se cierra.
// uso: node sep6.mjs <url> <carpeta> <ruta a playwright-core/index.mjs> [soloFps]
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [url, dir, pw, soloFps] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
const estado = (p) => p.evaluate(() => {
  const d = window.__ballitasDebug; const c = d?.cam; const b = c?.selected; if (!b) return null
  const w = d.world ?? c.world; const s = b.seg && typeof b.seg === 'object' ? b.seg : w?.ways?.[b.way?.idx ?? b.way]?.segments?.[b.segI ?? b.si ?? b.seg]
  return { id: b.id, phase: b.phase, kind: s?.kind ?? null, u: typeof b.u === 'number' ? +b.u.toFixed(3) : null }
})
const fps = (p, ms) => p.evaluate((ms) => new Promise((ok) => {
  const d = window.__ballitasDebug; const t0 = performance.now(); let n = 0; let tris = 0
  const f = () => { n++; tris += d.gl.info.render.triangles; const t = performance.now() - t0; if (t < ms) requestAnimationFrame(f); else ok({ fps: +(n / (t / 1000)).toFixed(1), tris: Math.round(tris / n), fase: d.cam?.selected?.phase ?? null }) }
  requestAnimationFrame(f)
}), ms)
const HELI = new Set(['sacacorchos', 'espiral'])
const out = {}
for (const vp of ['desk', 'movil']) {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
  const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 7 * 60 * 1000)
  try {
    const p = await (await b.newContext(VPS[vp])).newPage(); const errs = []
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) }); p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
    await p.goto(url); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(15000)
    writeFileSync(`${dir}/${vp}_libre.jpg`, await p.screenshot({ type: 'jpeg', quality: 80 }))
    await p.keyboard.press('3'); await sleep(2500)
    const dots = await p.locator('.puntos .punto').count(); let dot = 0
    const otra = async () => { dot = (dot + 1) % Math.max(1, dots); try { await p.locator('.puntos .punto').nth(dot).click({ timeout: 1500 }) } catch {} await sleep(1200) }
    const tomas = []
    const toma = async (nombre) => { const s = await estado(p); const img = `${vp}_${nombre}_${s?.kind}.jpg`; writeFileSync(`${dir}/${img}`, await p.screenshot({ type: 'jpeg', quality: 80 })); tomas.push({ img, ...s }) }
    if (!soloFps) {
      // bifurcación: una ballita que va por la salida; captura al entrar en el primer tramo de su ruta y 1.5 s después
      let t0 = Date.now(); let hecho = false
      while (Date.now() - t0 < 100000 && !hecho) {
        const s = await estado(p)
        if (s && s.phase === 'travel' && s.kind === 'salida') {
          const t1 = Date.now()
          while (Date.now() - t1 < 60000) { const q = await estado(p); if (!q || q.id !== s.id || q.phase !== 'travel') break; if (q.kind !== 'salida') { await toma('bifurcacion'); await sleep(1500); await toma('bifurcacion2'); hecho = true; break } await sleep(200) }
        } else await otra()
      }
      // hélice: sacacorchos o espiral, dos tomas separadas 2 s
      t0 = Date.now(); hecho = false
      while (Date.now() - t0 < 100000 && !hecho) {
        const s = await estado(p)
        if (s && s.phase === 'travel' && HELI.has(s.kind)) { await sleep(1500); const q = await estado(p); if (q && HELI.has(q.kind)) { await toma('helice'); await sleep(2000); if (HELI.has((await estado(p))?.kind)) await toma('helice2'); hecho = true } } else await otra()
      }
    }
    // FPS: 30 s en POV siguiendo una ballita en viaje
    for (let k = 0; k < 20; k++) { const s = await estado(p); if (s && s.phase === 'travel') break; await otra() }
    await sleep(1500)
    const m = await fps(p, 30000)
    out[vp] = { fps: m, tomas, nErr: errs.length, errores: errs.slice(0, 4) }
    console.log(vp, JSON.stringify(out[vp]))
  } finally { clearTimeout(guardia); await b.close().catch(() => {}) }
}
writeFileSync(`${dir}/resumen.json`, JSON.stringify(out, null, 1))
