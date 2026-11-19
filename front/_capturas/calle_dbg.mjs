// Inspecciona el material de las calles cercanas (malla con color de vértice + mapa de asfalto).
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const [url] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--ignore-gpu-blocklist'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const p = await b.newPage({ viewport: { width: 1000, height: 700 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
await p.waitForTimeout(6000)
const r = await p.evaluate(() => {
  const out = []
  window.__ballitasDebug.scene.traverse((o) => {
    const m = o.material
    if (o.isMesh && m?.vertexColors && m.map && o.geometry?.attributes?.color && m.userData?._foco) {
      const props = window.__ballitasDebug.gl.properties.get(m)
      out.push({ color: m.color.getHexString(), map: m.map.image ? `${m.map.image.width}x${m.map.image.height}` : 'sin imagen', wrap: m.map.wrapS, cs: m.map.colorSpace, normal: !!m.normalMap, prog: !!props.currentProgram, nverts: o.geometry.attributes.position.count, col0: [...o.geometry.attributes.color.array.slice(0, 9)], n0: [...o.geometry.attributes.normal.array.slice(0, 3)].map((v) => +v.toFixed(2)), key: m.customProgramCacheKey() })
    }
  })
  return out.slice(0, 3)
})
console.log(JSON.stringify(r, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
