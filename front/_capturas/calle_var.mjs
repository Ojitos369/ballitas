// Sigue ballitas hasta una en planeta y captura la calle con variaciones del material (sin mapa, sin normal, sin foco).
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync } from 'node:fs'
const [url, dir] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--ignore-gpu-blocklist'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
const errs = []
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 300)) })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
await sleep(7000)
await p.keyboard.press('3')
const dots = await p.locator('.puntos .punto').count()
for (let i = 0; i < 60; i++) {
  const ph = await p.evaluate(() => window.__ballitasDebug.cam?.selected?.phase)
  if (ph === 'toDest') break
  await p.locator('.puntos .punto').nth(i % dots).click(); await sleep(900)
}
await p.keyboard.press('Space').catch(() => {})
await sleep(2500)
await p.click('button[aria-label="Pausa"]').catch(() => {})
await sleep(500)
const variar = (v) => p.evaluate((v) => {
  window.__ballitasDebug.scene.traverse((o) => {
    const m = o.material
    if (o.isMesh && o.visible && m?.vertexColors && m.userData?._foco && o.geometry?.attributes?.color) {
      m.userData._orig ??= { map: m.map, normalMap: m.normalMap, obc: m.onBeforeCompile, key: m.customProgramCacheKey }
      const g = m.userData._orig
      m.map = v.includes('map') ? null : g.map
      m.normalMap = v.includes('normal') ? null : g.normalMap
      if (v.includes('foco')) { m.onBeforeCompile = () => {}; m.customProgramCacheKey = () => 'sinfoco' } else { m.onBeforeCompile = g.obc; m.customProgramCacheKey = g.key }
      m.needsUpdate = true
      o.visible = !v.includes('oculta')
    }
  })
}, v)
const src = await p.evaluate(() => { const gl = window.__ballitasDebug.gl; const g = gl.getContext(); let out = null; window.__ballitasDebug.scene.traverse((o) => { const m = o.material; if (!out && o.isMesh && o.visible && m?.vertexColors && m.userData?._foco && o.geometry?.attributes?.color) { const pr = gl.properties.get(m).currentProgram; if (!pr) { out = 'sin programa'; return } const sh = g.getAttachedShaders(pr.program); const fs = g.getShaderSource(sh[1]); out = { relleno: fs.includes('uFocoPar.w'), opaque: fs.includes('max(outgoingLight'), k: m.userData, par: null } } }); return out })
console.log(JSON.stringify(src))
for (const v of ['', 'oculta']) {
  await variar(v); await sleep(1200)
  await p.screenshot({ path: `${dir}/var_${v.replace(/ /g, '_') || 'base'}.jpg`, type: 'jpeg', quality: 70 })
}
console.log(JSON.stringify(errs.slice(0, 6)))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
