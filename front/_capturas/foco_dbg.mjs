// Depuracion del foco: sigue a una ballita hasta que este en un planeta y vuelca FOCO, DOM de rotulos y
// que objeto hay bajo varios pixeles. uso: node foco_dbg.mjs <url> <carpeta> [movil]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const [url, dir, vp] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--ignore-gpu-blocklist'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const ctx = await b.newContext(vp === 'movil' ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true } : { viewport: { width: 1400, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 160)) })
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
await sleep(8000)
await p.keyboard.press('3')
const dots = await p.locator('.puntos .punto').count()
let i = 0; const t0 = Date.now(); let n = 0
while (Date.now() - t0 < 120000 && n < 3) {
  const ph = await p.evaluate(() => window.__ballitasDebug.cam?.selected?.phase)
  if (ph === 'toDest' || ph === 'toPort' || ph === 'at') {
    await sleep(2500)
    const info = await p.evaluate(() => {
      const F = window.__ballitasFoco; const c = window.__ballitasDebug.cam; const bb = c.selected
      const ray = new c.THREE.Raycaster(); const hits = {}
      for (const [x, y] of [[0, 0], [0, -0.3], [0, 0.3], [-0.4, 0], [0.4, 0], [0, -0.6]]) {
        ray.setFromCamera({ x, y }, c.camera)
        const h = ray.intersectObjects(window.__ballitasDebug.scene.children, true).find((o) => o.object.visible)
        hits[`${x},${y}`] = h ? `${h.object.type}:${h.object.geometry?.type}:${h.object.material?.type}:${h.object.material?.color?.getHexString?.()}:${h.distance.toFixed(1)}` : null
      }
      return { k: F.k.value, nodo: F.nodo, destKind: F.destKind, etiqueta: F.etiqueta, pos: F.pos.value.toArray().map((v) => +v.toFixed(1)), dest: F.dest.value.toArray().map((v) => +v.toFixed(1)), phase: bb.phase, destino: bb.dest?.name, node: bb.node,
        destinoFoco: [...document.querySelectorAll('.destino-foco')].map((e) => e.textContent + ' @' + e.parentElement.parentElement.style.transform + ' op=' + e.parentElement.parentElement.style.opacity + ' disp=' + e.parentElement.parentElement.style.display),
        llegada: [...document.querySelectorAll('.llegada')].map((e) => e.textContent), hits, anillo: (() => { let r = null; window.__ballitasDebug.scene.traverse((o) => { if (o.geometry?.type === 'RingGeometry' && o.parent?.children.length >= 2 && o.parent.type === 'Group' && o.material?.blending === 2) r = o }); if (!r) return null; const g = r.parent; const w = new c.THREE.Vector3(); g.getWorldPosition(w); const lab = g.children[1]; const lw = new c.THREE.Vector3(); lab?.getWorldPosition(lw); const pr = lw.clone().project(c.camera); return { vis: g.visible, g: w.toArray().map((v) => +v.toFixed(1)), lab: lw.toArray().map((v) => +v.toFixed(1)), cam: c.camera.position.toArray().map((v) => +v.toFixed(1)), proj: pr.toArray().map((v) => +v.toFixed(2)), nchild: g.children.length } })() }
    })
    console.log(JSON.stringify(info))
    await p.screenshot({ path: `${dir}/dbg_${n++}.jpg`, type: 'jpeg', quality: 70 })
  }
  i = (i + 1) % dots
  await p.locator('.puntos .punto').nth(i).click()
  await sleep(1200)
}
console.log(JSON.stringify(errs.slice(0, 10)))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
