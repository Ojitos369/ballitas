// Sonda de diagnóstico: vuelca globalThis.__PDBG (instrumentación temporal de paisaje.jsx) en vista ballita.
// uso: node pdbg.mjs url tema [espera_ms]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const [url = 'http://127.0.0.1:4413/?stats=1', tema = 'volcan', espera = '6000'] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,900', '--ignore-gpu-blocklist'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(4000)
await p.keyboard.press('3'); await p.waitForTimeout(1000)
const th = () => p.evaluate(() => { const s = window.__ballitasDebug.cam.selected; return { t: s?.way?.theme?.id, w: s?.way?.idx } })
let w = null
for (let i = 0; i < 14; i++) { await p.evaluate((n) => document.querySelectorAll('.punto')[n]?.click(), i); await p.waitForTimeout(500); const r = await th(); if (r.t === tema) { w = r.w; break } }
console.log('way', w)
await p.waitForTimeout(+espera)
const r = await p.evaluate((w) => {
  const D = globalThis.__PDBG; const d = window.__ballitasDebug
  const lay = Object.fromEntries(Object.entries(D?.lay ?? {}).filter(([k]) => k.startsWith(d.cam.selected?.way?.theme?.id + ':')))
  const temas = Object.fromEntries(Object.entries(D?.tema ?? {}).map(([k, v]) => [k, { ...v, inst: undefined, instSum: (v.inst ?? []).reduce((a, l) => a.map((x, i) => x + (l[i] ?? 0)), new Array((v.inst?.[0] ?? []).length).fill(0)) }]))
  return { sel: w, cam: d.camera.position.toArray().map((x) => +x.toFixed(1)), modo: d.cam.modo, tema: temas[w], lay, otros: Object.fromEntries(Object.entries(temas).map(([k, v]) => [k, [v.theme, v.show, v.det?.toFixed?.(2), v.overview, v.near, v.done, (v.counts ?? []).join('/')].join(' ')])) }
}, w)
console.log(JSON.stringify(r, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
