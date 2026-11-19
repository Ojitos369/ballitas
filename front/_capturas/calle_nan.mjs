// Cuenta normales no finitas en las calles cercanas (malla con color de vértice y foco).
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const [url] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 800, height: 600 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
await p.waitForTimeout(5000)
const r = await p.evaluate(() => {
  const out = []
  window.__ballitasDebug.scene.traverse((o) => {
    const m = o.material
    if (o.isMesh && m?.vertexColors && m.userData?._foco && o.geometry?.attributes?.color) {
      const n = o.geometry.attributes.normal.array; let bad = 0; let inward = 0
      const pos = o.geometry.attributes.position.array
      for (let i = 0; i < n.length; i += 3) {
        if (!Number.isFinite(n[i]) || !Number.isFinite(n[i + 1]) || !Number.isFinite(n[i + 2])) bad++
        else if (n[i] * pos[i] + n[i + 1] * pos[i + 1] + n[i + 2] * pos[i + 2] < 0) inward++
      }
      out.push({ verts: n.length / 3, bad, inward, type: m.type, side: m.side, color: m.color.getHexString() })
    }
  })
  return out.slice(0, 6)
})
console.log(JSON.stringify(r))
await b.close()
