// A/B en caliente de la aparición gradual (InstanceCuller): sigue una ballita en viaje y alterna
// window.__aparece.off cada tramo en la MISMA sesión y ruta. Por tramo: FPS (rAF), ms del componente
// (window.__aparece.ms, solo con ?stats=1), triángulos y mallas instanciadas visibles. Se descarta el primer
// segundo de cada tramo. Al final: medias on/off y diferencia en %. Siempre cierra el navegador.
// (Reescrita el 2026-11-19: la original quedó sin comitear porque front/_capturas está en .gitignore; usar git add -f.)
// uso: node ab_aparece.mjs <url con ?stats=1> [escritorio|movil] [segundos=60] [tramo_s=5]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'

const [url, modo = 'escritorio', secsA = '60', tramoA = '5'] = process.argv.slice(2)
const movil = modo === 'movil'
const tramos = Math.max(2, Math.floor(+secsA / +tramoA))
const b = await chromium.launch({ channel: 'msedge', headless: false, args: [movil ? '--window-size=500,1000' : '--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 9 * 60 * 1000)
try {
  const ctx = await b.newContext(movil ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(url)
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
  await p.waitForTimeout(8000)
  // seguir una ballita en viaje (misma técnica que recorrido.mjs: onFollowBallita desde el árbol de React)
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement
    const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let f = div[k]; let sim = null
    while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
    const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
    let root = div[k]; while (root.return) root = root.return
    const follow = find(root)
    const st = { b: null, cambios: 0 }
    st.elegir = () => {
      const c = sim.ballitas.find((x) => x.phase === 'travel') ?? sim.ballitas.find((x) => x.phase !== 'dying' && x.phase !== 'gone')
      if (c && c !== st.b) { st.b = c; st.cambios++; follow(c) }
    }
    st.elegir()
    window.__ab = st
  })
  await p.waitForTimeout(6000)
  const filas = []
  for (let i = 0; i < tramos; i++) {
    const off = i % 2 === 0
    const r = await p.evaluate(({ off, ms }) => new Promise((ok) => {
      const st = window.__ab; const d = window.__ballitasDebug
      if (!st.b || st.b.phase !== 'travel') st.elegir() // solo se re-elige al empezar un tramo, no cada cuadro
      window.__aparece.off = off
      const t0 = performance.now(); let n = 0; let tris = 0; let vis = 0; let m = 0; let tIni = 0
      const f = () => {
        const t = performance.now() - t0
        if (t > 1000) {
          if (!tIni) tIni = performance.now()
          n++; tris += d.gl.info.render.triangles; m += window.__aparece.ms || 0
          if (n % 30 === 1) { let v = 0; d.scene.traverse((o) => { if (o.isInstancedMesh && o.count > 0) { let q = o; while (q && q.visible) q = q.parent; if (!q) v++ } }); vis += v * 30 }
        }
        if (t < ms) requestAnimationFrame(f)
        else ok({ fps: +(n / ((performance.now() - tIni) / 1000)).toFixed(1), ms: +(m / n).toFixed(3), tris: Math.round(tris / n), vis: +(vis / n).toFixed(1), fase: st.b?.phase })
      }
      requestAnimationFrame(f)
    }), { off, ms: +tramoA * 1000 })
    filas.push({ i, modo: off ? 'off' : 'on', ...r })
    console.log(JSON.stringify(filas.at(-1)))
  }
  const media = (modoX, k) => { const xs = filas.filter((x) => x.modo === modoX && x.fase === 'travel').map((x) => x[k]); return xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length) }
  const res = {}
  for (const k of ['fps', 'ms', 'tris', 'vis']) { const on = media('on', k); const off = media('off', k); res[k] = { on: +on.toFixed(3), off: +off.toFixed(3), difPct: +(((on - off) / (off || 1)) * 100).toFixed(1) } }
  console.log('RESUMEN', modo, JSON.stringify(res), 'cambios de ballita', await p.evaluate(() => window.__ab.cambios), 'errores', errs.length, errs.slice(0, 3))
} finally {
  clearTimeout(guardia)
  await b.close().catch(() => {})
}
