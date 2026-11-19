// Sonda SEP: vista libre inicial y POV (tecla 3) en tramos de viaje distintos (busca una espiral), escritorio y móvil.
// uso: node sep_vista.mjs <url> <carpeta> <ruta a playwright-core/index.mjs>
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [url, dir, pw] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
const estado = (p) => p.evaluate(() => {
  const d = window.__ballitasDebug; const c = d?.cam; const b = c?.selected; if (!b) return null
  const w = d.world ?? c.world; const s = b.seg && typeof b.seg === 'object' ? b.seg : w?.ways?.[b.way?.idx ?? b.way]?.segments?.[b.segI ?? b.si ?? b.seg]
  return { id: b.id, phase: b.phase, kind: s?.kind ?? null, far: c.camera.far, fog: d.scene?.fog ? [d.scene.fog.near ?? null, d.scene.fog.far ?? null, d.scene.fog.density ?? null] : null, camDist: +c.camera.position.length().toFixed(0) }
})
const out = {}
for (const vp of ['desk', 'movil']) {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
  const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 6 * 60 * 1000)
  try {
    const p = await (await b.newContext(VPS[vp])).newPage(); const errs = []
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) }); p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
    await p.goto(url); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(12000)
    writeFileSync(`${dir}/${vp}_libre.jpg`, await p.screenshot({ type: 'jpeg', quality: 80 }))
    const libre = await p.evaluate(() => { const d = window.__ballitasDebug; const c = d.cam?.camera ?? d.camera; return c ? { far: c.far, dist: +c.position.length().toFixed(0), fov: c.fov } : null })
    await p.keyboard.press('3'); await sleep(2500)
    const filas = []; const kinds = new Set(); const t0 = Date.now(); const dots = await p.locator('.puntos .punto').count(); let dot = 0
    while (Date.now() - t0 < 150000 && (filas.length < 3 || !kinds.has('espiral')) && filas.length < 5) {
      const s = await estado(p)
      if (s && s.phase === 'travel' && (!kinds.has(s.kind) || s.kind === null) && (filas.length < 3 || s.kind === 'espiral')) {
        await sleep(1200); const s2 = await estado(p)
        if (s2 && s2.phase === 'travel') { const name = `${vp}_pov${filas.length}_${s2.kind}.jpg`; writeFileSync(`${dir}/${name}`, await p.screenshot({ type: 'jpeg', quality: 80 })); filas.push({ img: name, ...s2 }); kinds.add(s2.kind); await sleep(s2.kind === null ? 9000 : 500) }
      } else { dot = (dot + 1) % Math.max(1, dots); try { await p.locator('.puntos .punto').nth(dot).click({ timeout: 1500 }) } catch {} await sleep(1500) }
    }
    out[vp] = { libre, filas, nErr: errs.length, errores: errs.slice(0, 6) }
  } finally { clearTimeout(guardia); await b.close().catch(() => {}) }
}
writeFileSync(`${dir}/resumen.json`, JSON.stringify(out, null, 1)); console.log(JSON.stringify(out, null, 1))
