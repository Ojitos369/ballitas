// Traza de Chrome (GPU + main) de la entrada a la vista ballita (camino); lista los eventos largos del cuadro peor.
// uso: node traza_entrada.mjs <url> [salida.json]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { writeFileSync } from 'node:fs'
const [url, salida = 'traza.json'] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(8000)
await p.evaluate(() => new Promise((ok) => { let last = performance.now(); let desde = last; const f = () => { const t = performance.now(); if (t - last > 100) desde = t; last = t; if (t - desde > 2000) ok(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }))
await p.evaluate(async () => {
  const div = document.querySelector('canvas').parentElement
  const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
  let f = div[k]; let sim = null
  while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
  const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
  let root = div[k]; while (root.return) root = root.return
  window.__probe = { sim, follow: find(root) }
  const t0 = performance.now()
  while (performance.now() - t0 < 40000) { const bb = sim.ballitas.find((x) => x.phase === 'travel' && x.timer > 6); if (bb) { window.__probe.b = bb; return } await new Promise((ok) => setTimeout(ok, 100)) }
})
const cdp = await p.context().newCDPSession(p)
const eventos = []
cdp.on('Tracing.dataCollected', (d) => eventos.push(...d.value))
const fin = new Promise((ok) => cdp.once('Tracing.tracingComplete', ok))
await cdp.send('Tracing.start', { categories: 'gpu,gpu.angle,gpu.service,disabled-by-default-gpu.service,devtools.timeline,toplevel,v8.execute,blink,cc,viz', transferMode: 'ReportEvents' })
const largos = await p.evaluate(async () => {
  const out = []; let last = performance.now(); let run = true
  const f = () => { const t = performance.now(); if (t - last > 150) out.push({ t0: last, ms: t - last }); last = t; if (run) requestAnimationFrame(f) }
  requestAnimationFrame(f)
  window.__probe.follow(window.__probe.b)
  await new Promise((ok) => setTimeout(ok, 5000))
  run = false
  return out.map((x) => ({ ...x, origen: performance.timeOrigin }))
})
await cdp.send('Tracing.end')
await fin
console.log('cuadros > 150 ms:', JSON.stringify(largos.map((x) => Math.round(x.ms))))
// eventos completos (X) o B/E emparejados, largos (> 20 ms), en cualquier proceso
const dur = []
const abiertos = new Map()
for (const e of eventos) {
  if (e.ph === 'X' && e.dur > 20000) dur.push({ name: e.name, cat: e.cat, ms: Math.round(e.dur / 1000), ts: e.ts, pid: e.pid, tid: e.tid, args: JSON.stringify(e.args ?? {}).slice(0, 160) })
  else if (e.ph === 'B') abiertos.set(`${e.pid}:${e.tid}:${e.name}`, e)
  else if (e.ph === 'E') { const s = abiertos.get(`${e.pid}:${e.tid}:${e.name}`); if (s && e.ts - s.ts > 20000) dur.push({ name: e.name, cat: e.cat, ms: Math.round((e.ts - s.ts) / 1000), ts: s.ts, pid: e.pid, tid: e.tid }) }
}
const nombres = new Map()
for (const e of eventos) if (e.ph === 'M' && e.name === 'thread_name') nombres.set(`${e.pid}:${e.tid}`, e.args.name)
for (const e of eventos) if (e.ph === 'M' && e.name === 'process_name') nombres.set(`${e.pid}`, e.args.name)
dur.sort((a, b) => b.ms - a.ms)
for (const d of dur.slice(0, 60)) console.log(`${d.ms}ms ${d.name} [${d.cat}] ${nombres.get(`${d.pid}`) ?? d.pid}/${nombres.get(`${d.pid}:${d.tid}`) ?? d.tid} ts=${d.ts} ${d.args ?? ''}`)
writeFileSync(salida, JSON.stringify({ largos, dur: dur.slice(0, 300) }, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
