// ¿Qué objetos se pintan casi negros en la vista de planeta? Cruza la luminancia de la captura con el
// primer objeto visible bajo una rejilla de puntos. uso: node negro_dbg.mjs <url> <carpeta> [vueltas=3]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const [url, dir, vueltas = '3'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
await sleep(7000)
await p.keyboard.press('3')
const dots = await p.locator('.puntos .punto').count()
let n = 0; let i = 0
const t0 = Date.now()
while (n < +vueltas && Date.now() - t0 < 150000) {
  const ph = await p.evaluate(() => window.__ballitasDebug.cam?.selected?.phase)
  if (ph === 'toDest' || ph === 'toPort' || ph === 'at') {
    await sleep(2600)
    const buf = await p.screenshot({ type: 'jpeg', quality: 80 })
    writeFileSync(`${dir}/negro_${n}.jpg`, buf)
    const r = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode()
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
      const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0)
      const c = window.__ballitasDebug.cam; const ray = new c.THREE.Raycaster(); const cuenta = {}
      for (let gy = 0.25; gy < 1; gy += 0.1) for (let gx = 0.05; gx < 1; gx += 0.075) {
        const px = cx.getImageData(Math.floor(gx * img.width), Math.floor(gy * img.height), 1, 1).data
        const l = px[0] * 0.299 + px[1] * 0.587 + px[2] * 0.114
        ray.setFromCamera({ x: gx * 2 - 1, y: -(gy * 2 - 1) }, c.camera)
        const h = ray.intersectObjects(window.__ballitasDebug.scene.children, true).find((o) => o.object.visible && o.object.material && !o.object.material.transparent)
        const k = h ? `${h.object.material.type}:${h.object.geometry?.type}:${h.object.material.color?.getHexString?.() ?? '-'}:${h.object.material.userData?._foco ? 'foco' : ''}` : 'cielo'
        cuenta[k] ??= { n: 0, negros: 0, lum: 0 }
        cuenta[k].n++; cuenta[k].lum += l; if (l < 22) cuenta[k].negros++
      }
      for (const v of Object.values(cuenta)) v.lum = Math.round(v.lum / v.n)
      return { fase: c.selected.phase, cuenta }
    }, buf.toString('base64'))
    console.log(n, JSON.stringify(r))
    n++
  }
  i = (i + 1) % dots
  await p.locator('.puntos .punto').nth(i).click(); await sleep(1000)
}
await b.close()
