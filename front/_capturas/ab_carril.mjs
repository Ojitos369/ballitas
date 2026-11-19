// A/B en caliente de la pieza CAR (alcance delantero + eventos solo del carril) en POV, en la MISMA sesión.
// A = antes (window.__aparece.delante = 1, window.__eventosCarril.off = true); B = nuevo (delante 2.5, filtro activo).
// Por tramo: FPS medio y p5 (por tiempos de cuadro), peor cuadro, triángulos, mallas instanciadas visibles,
// instancias de eventos dibujadas, y la distancia real de la pieza más cercana que aún crece en el cono delantero
// (userData.__crece que publican estructuras, paisaje e InstanceCuller con ?stats=1). Capturas por modo.
// uso: node ab_carril.mjs <url con ?stats=1> [escritorio|movil] [segundos=60] [tramo_s=5] [carpeta]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const [url, modo = 'escritorio', secsA = '60', tramoA = '5', dir = '_capturas/car'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const movil = modo === 'movil'
const tramos = Math.max(2, Math.floor(+secsA / +tramoA))
const b = await chromium.launch({ channel: 'msedge', headless: false, args: [movil ? '--window-size=500,1000' : '--window-size=1320,800', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 9 * 60 * 1000)
try {
  const ctx = await b.newContext(movil ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(url)
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
  await p.waitForTimeout(8000)
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement
    const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let f = div[k]; let sim = null
    while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
    const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
    let root = div[k]; while (root.return) root = root.return
    const follow = find(root)
    const st = { b: null, cambios: 0, rutas: new Set() }
    st.elegir = () => {
      const c = sim.ballitas.find((x) => x.phase === 'travel' && x !== st.b) ?? sim.ballitas.find((x) => x.phase === 'travel')
      if (c && c !== st.b) { st.b = c; st.cambios++; follow(c); return true }
      return false
    }
    st.elegir()
    window.__ab = st
    window.__eventosCarril = window.__eventosCarril ?? { off: false }
  })
  await p.waitForTimeout(1500)
  const pov = async () => { await p.evaluate(() => { const x = document.querySelector('.pov-btn'); if (x && x.getAttribute('aria-pressed') !== 'true') x.click() }) }
  await pov()
  await p.waitForTimeout(6000)
  const filas = []
  const capt = { A: 0, B: 0 }
  for (let i = 0; i < tramos; i++) {
    const m = i % 2 === 0 ? 'A' : 'B'
    if (await p.evaluate(() => { const st = window.__ab; return !st.b || st.b.phase !== 'travel' ? st.elegir() : false })) { await p.waitForTimeout(800); await pov(); await p.waitForTimeout(1500) }
    const r = await p.evaluate(({ m, ms }) => new Promise((ok) => {
      const st = window.__ab; const d = window.__ballitasDebug
      window.__aparece.delante = m === 'A' ? 1 : 2.8
      window.__eventosCarril.off = m === 'A'
      const t0 = performance.now(); let last = 0; const dts = []; let tris = 0; let n = 0; let vis = 0; let nv = 0
      const crece = []; const creceC = []; const quien = {}; let ev = 0; let evMax = 0; let ne = 0
      const f = () => {
        const now = performance.now(); const t = now - t0
        if (t > 1000) {
          if (last) dts.push(now - last)
          n++; tris += d.gl.info.render.triangles
          if (n % 10 === 1) {
            let v = 0; let cmin = Infinity; let cc = Infinity; let ccN = ''; let e = 0
            d.scene.traverse((o) => {
              if (!o.isInstancedMesh || o.count <= 0) return
              let q = o; while (q && q.visible) q = q.parent; if (q) return
              v++
              const c = o.userData.__crece; if (c != null && c < cmin) cmin = c; const c2 = o.userData.__creceC; if (c2 != null && c2 < cc) { cc = c2; ccN = (o.geometry.name || o.material.type) + '/' + (o.userData.noCull ? 'd' : 'c') + o.count }
              if (o.userData.eventos) e += o.count
            })
            vis += v; nv++; crece.push(cmin); creceC.push(cc); if (Number.isFinite(cc)) quien[ccN + '@' + Math.round(cc)] = 1; ev += e; ne++; if (e > evMax) evMax = e
            if (st.b?.way) st.rutas.add(st.b.way.idx)
          }
        }
        last = t > 1000 ? now : 0
        if (t < ms) requestAnimationFrame(f)
        else {
          const s = [...dts].sort((a, b2) => a - b2)
          const p95 = s[Math.floor(s.length * 0.95)] ?? 0
          const cs = crece.filter(Number.isFinite).sort((a, b2) => a - b2)
          ok({ fps: +(1000 / (dts.reduce((a, x) => a + x, 0) / Math.max(1, dts.length))).toFixed(1), p5: +(1000 / p95).toFixed(1), peor: +(s.at(-1) ?? 0).toFixed(1),
            tris: Math.round(tris / Math.max(1, n)), vis: +(vis / Math.max(1, nv)).toFixed(1),
            creceMed: cs.length ? +cs[cs.length >> 1].toFixed(1) : null, creceCerca40: +(crece.filter((x) => x < 40).length / Math.max(1, crece.length)).toFixed(2),
            creceCMed: (() => { const x = creceC.filter(Number.isFinite).sort((a, b2) => a - b2); return x.length ? +x[x.length >> 1].toFixed(1) : null })(), creceCSin: +(creceC.filter((x) => !Number.isFinite(x)).length / Math.max(1, creceC.length)).toFixed(2), creceSin: +(crece.filter((x) => !Number.isFinite(x)).length / Math.max(1, crece.length)).toFixed(2),
            quien: Object.keys(quien).slice(0, 6).join(' '), ev: +(ev / Math.max(1, ne)).toFixed(1), evMax, fase: st.b?.phase, vuelo: !!(st.b?.flight || st.b?.seg?.air), way: st.b?.way?.idx ?? null, carril: st.b?.carril, lane: st.b?.lane })
        }
      }
      requestAnimationFrame(f)
    }), { m, ms: +tramoA * 1000 })
    filas.push({ i, m, ...r })
    console.log(JSON.stringify(filas.at(-1)))
    if (capt[m] < 2 && r.fase === 'travel' && !(await p.evaluate(() => !!(window.__ab.b?.flight || window.__ab.b?.seg?.air)))) { await p.screenshot({ path: `${dir}/${modo}_${m}${capt[m]}.jpg`, quality: 70 }); capt[m]++ }
  }
  const media = (mm, k) => { const xs = filas.filter((x) => x.m === mm && x.fase === 'travel' && x[k] != null).map((x) => x[k]); return xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length) }
  const res = {}
  for (const k of ['fps', 'p5', 'peor', 'tris', 'vis', 'creceMed', 'creceCerca40', 'creceSin', 'creceCMed', 'creceCSin', 'ev', 'evMax']) { const A = media('A', k); const B = media('B', k); res[k] = { A: +A.toFixed(2), B: +B.toFixed(2), difPct: +(((B - A) / (A || 1)) * 100).toFixed(1) } }
  const extra = await p.evaluate(() => ({ cambios: window.__ab.cambios, rutas: [...window.__ab.rutas] }))
  console.log('RESUMEN', modo, JSON.stringify(res), JSON.stringify(extra), 'errores', errs.length, errs.slice(0, 3))
  writeFileSync(`${dir}/${modo}.json`, JSON.stringify({ filas, res, extra, errs }, null, 1))
} finally {
  clearTimeout(guardia)
  await b.close().catch(() => {})
}
