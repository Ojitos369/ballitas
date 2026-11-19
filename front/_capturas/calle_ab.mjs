// A/B: sigue a una ballita hasta que esté en un planeta y captura con y sin la malla de calle.
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const [url, dir = 'ab'] = process.argv.slice(2)
import { mkdirSync } from 'node:fs'
mkdirSync(dir, { recursive: true })
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
await p.waitForTimeout(5000)
await p.keyboard.press('3')
const dots = await p.locator('.puntos .punto').count()
for (let i = 0; i < 60; i++) {
  const ok = await p.evaluate(() => { const s = window.__ballitasDebug.cam?.selected; return s && ['toDest', 'at', 'toPort'].includes(s.phase) })
  if (ok) break
  try { await p.locator('.puntos .punto').nth(i % dots).click({ timeout: 1500 }) } catch {}
  await p.waitForTimeout(800)
}
await p.waitForTimeout(2500)
await p.evaluate(() => { const g = window.__ballitasDebug; g.cam.selected && (g.__pause = true) })
await p.screenshot({ path: `${dir}/con_calle.jpg`, type: 'jpeg', quality: 70 })
const info = await p.evaluate(() => {
  const mats = []
  window.__ballitasDebug.scene.traverse((o) => { const m = o.material; if (o.isMesh && m?.vertexColors && m.userData?._foco && o.geometry?.attributes?.color && o.geometry.attributes.position.count > 1000) { m.colorWrite = false; mats.push(o.visible) } })
  return mats
})
await p.waitForTimeout(150)
await p.screenshot({ path: `${dir}/sin_calle.jpg`, type: 'jpeg', quality: 70 })
console.log('calles visibles:', JSON.stringify(info))
await b.close()
