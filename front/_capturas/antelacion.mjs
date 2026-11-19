// Antelación de la precarga: con qué margen el camino al que entra la ballita seguida ya estaba calculado y montado.
// uso: node antelacion.mjs <url> [segundos=120] [escritorio|movil] [salida.json]
// Requiere ?stats=1 y window.__precarga.listo/montado (rama). En main no existen: solo cuenta entradas.
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { writeFileSync } from 'node:fs'
const [url, secsA, modo = 'escritorio', salida] = process.argv.slice(2)
const secs = +(secsA ?? 120)
const movil = modo === 'movil'
const b = await chromium.launch({ channel: 'msedge', headless: false, args: [movil ? '--window-size=500,1000' : '--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const ctx = await b.newContext(movil ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } })
const p = await ctx.newPage()
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(8000)
const caminos8s = await p.evaluate(() => window.__precarga?.caminos ?? null)
await p.evaluate(() => {
  const div = document.querySelector('canvas').parentElement
  const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
  let f = div[k]; let sim = null
  while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
  const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
  let root = div[k]; while (root.return) root = root.return
  const follow = find(root)
  const vivo = (x) => x && x.phase !== 'dying' && x.phase !== 'gone'
  const E = []; const usados = new Set(); let sel = null; let prevPh = null; let prevWay = null
  const elegir = () => {
    sel = sim.ballitas.find((x) => vivo(x) && !usados.has(x.id) && x.phase !== 'travel') ?? sim.ballitas.find(vivo)
    if (!sel) return
    usados.add(sel.id); prevPh = sel.phase; prevWay = sel.way?.idx ?? null; follow(sel)
  }
  elegir()
  window.__ant = { E }
  setInterval(() => {
    if (!vivo(sel)) { elegir(); return }
    const now = performance.now()
    const w = sel.way?.idx ?? null
    const P = window.__precarga
    if (w != null && w !== prevWay && sel.phase !== 'travel') E.push({ tipo: 'elige', t: Math.round(now), way: w })
    if (sel.phase === 'travel' && prevPh !== 'travel') {
      const listo = P?.listo?.[w]; const montado = P?.montado?.[w]
      const ok = listo != null && montado != null ? Math.max(listo, montado) : null
      E.push({ tipo: 'entra', t: Math.round(now), way: w, listo, montado, antelacion_s: ok == null ? null : +((now - ok) / 1000).toFixed(2) })
      // más entradas por tanda: tras entrar se sigue a otra ballita que aún esté en un planeta (CAMBIA_TRAS_ENTRAR=0 lo desactiva)
      if (window.__cambiaTrasEntrar !== false) { prevPh = sel.phase; elegir(); return }
    }
    prevPh = sel.phase; prevWay = w
  }, 100)
})
await p.waitForTimeout(secs * 1000)
const R = await p.evaluate(() => ({ E: window.__ant.E, caminos: window.__precarga?.caminos ?? null, ms: window.__precarga?.ms ?? null, max: window.__precarga?.max ?? null, presu: window.__precarga?.presu ?? null, total: window.__ballitasDebug ? null : null }))
const entradas = R.E.filter((x) => x.tipo === 'entra')
const ant = entradas.map((x) => x.antelacion_s).filter((x) => x != null)
const res = { modo, caminos_8s: caminos8s, caminos_fin: R.caminos, precarga_ms: R.ms, precarga_max: R.max, presu: R.presu, ok_pct: entradas.length ? Math.round(100 * entradas.filter((x) => x.listo != null && x.montado != null && (x.t - x.montado) >= 2000 && (x.t - x.listo) >= 500).length / entradas.length) : null, entradas: entradas.length, antelacion_min_s: ant.length ? Math.min(...ant) : null, antelacion: ant, sin_listo: entradas.filter((x) => x.antelacion_s == null).length, eventos: R.E }
console.log(JSON.stringify({ ...res, eventos: undefined }))
if (salida) writeFileSync(salida, JSON.stringify(res, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
