// Tareas largas del hilo principal en los primeros 20 s (PerformanceObserver 'longtask'), entrando a la vista ballita
// (tecla 3) a los 8 s; más los peores tiempos por etapa de la precarga (window.__precarga.max) y el prisma síncrono.
// uso: node tareas_largas.mjs <url ?stats=1> [repeticiones=2]
import { chromium } from 'playwright-core'
const url = process.argv[2] ?? 'http://127.0.0.1:4414/?stats=1'
const reps = +(process.argv[3] ?? 2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 10 * 60 * 1000)
try {
  for (let r = 0; r < reps; r++) {
    const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
    const errs = []
    p.on('pageerror', (e) => errs.push(e.message))
    await p.addInitScript(() => {
      window.__lt = []
      try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]) }).observe({ type: 'longtask', buffered: true }) } catch {}
    })
    await p.goto(url)
    await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
    await p.waitForTimeout(Math.max(0, 8000))
    await p.keyboard.press('3')
    await p.waitForTimeout(12000)
    const res = await p.evaluate(() => {
      const lt = window.__lt.filter(([t]) => t < 20000 + 8000)
      const s = [...lt].sort((a, b) => b[1] - a[1])
      const d = window.__ballitasDebug
      return {
        largas: lt.length, peor: s.slice(0, 5), trasEntrar: [...lt].filter(([t]) => t > 6000).sort((a, b) => b[1] - a[1]).slice(0, 5),
        etapasMax: window.__precarga?.max, etapasMs: window.__precarga?.ms, prisma: window.__prismaStats ? { ...window.__prismaStats, msSincrono: Math.round(window.__prismaStats.msSincrono) } : null,
        tris: d?.gl?.info?.render?.triangles, calls: d?.gl?.info?.render?.calls,
      }
    })
    console.log(JSON.stringify({ rep: r, ...res, errores: errs.length }))
    await p.close()
  }
} finally {
  clearTimeout(guardia)
  await b.close().catch(() => {})
}
