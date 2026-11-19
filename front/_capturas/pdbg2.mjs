// Diagnóstico: posición de cámara, ballita seguida y transformación del grupo del paisaje.
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const [url = 'http://127.0.0.1:4413/?stats=1'] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,900', '--ignore-gpu-blocklist'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(4000)
await p.keyboard.press('3'); await p.waitForTimeout(6000)
const r = await p.evaluate(() => {
  const d = window.__ballitasDebug; const s = d.cam.selected
  const out = { modo: d.cam.modo, camKeys: Object.keys(d.cam).slice(0, 40), selKeys: s ? Object.keys(s).slice(0, 40) : null, cam: d.camera.position.toArray().map((x) => +x.toFixed(1)) }
  out.selPos = s?.pos?.toArray?.() ?? s?.position?.toArray?.() ?? null
  const mats = []
  d.scene.traverse((o) => { if (o.isInstancedMesh && o.geometry.name?.startsWith('paisaje:') && mats.length < 2) { o.updateMatrixWorld(); mats.push({ n: o.geometry.name, mw: o.matrixWorld.elements.map((x) => +x.toFixed(2)), parentChain: (() => { const a = []; for (let q = o.parent; q; q = q.parent) a.push((q.type) + ':' + q.position.toArray().map((x) => +x.toFixed(1)).join(',') + ' s' + q.scale.x.toFixed(2)); return a })() }) } })
  out.mats = mats
  return out
})
console.log(JSON.stringify(r, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
