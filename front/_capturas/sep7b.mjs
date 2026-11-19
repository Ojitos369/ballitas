// Sonda SEP sesión 7 (capturas): hélices (espiral/sacacorchos) vistas desde FUERA del POV (vista de seguimiento, 3/4):
// sigue una ballita que va por una hélice sin entrar en POV y captura dos veces separadas 2.5 s. Escritorio y móvil.
// Levanta y detiene su `vite preview`, usa el candado de navegador y siempre cierra navegador y servidor.
// uso: node sep7b.mjs <front> <carpeta salida> <playwright-core/index.mjs> <candado> [puerto=4301]
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const [front, dir, pw, lock, puerto = '4301'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
const HELI = ['sacacorchos', 'espiral']
for (let i = 0; i < 40 && existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60 * 1000; i++) { console.log('candado ocupado, espero 30 s'); await sleep(30000) }
writeFileSync(lock, `sep7b ${new Date().toISOString()}`)
const srv = spawn(process.execPath, [path.join(front, 'node_modules/vite/bin/vite.js'), 'preview', '--port', puerto, '--strictPort'], { cwd: front, stdio: 'ignore' })
const out = []
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${puerto}/`)).ok) break } catch {} await sleep(500) }
  for (const vp of ['desk', 'movil']) {
    const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
    const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 5 * 60 * 1000)
    try {
      const p = await (await b.newContext(VPS[vp])).newPage()
      await p.goto(`http://localhost:${puerto}/?stats=1`); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(14000)
      await p.evaluate(() => {
        const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
        let f = div[k]; let sim = null
        while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
        const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
        let root = div[k]; while (root.return) root = root.return
        const kind = (b) => { const w = sim.world; const way = typeof b.way === 'object' ? b.way : w?.ways?.[b.way]; const s = b.seg && typeof b.seg === 'object' ? b.seg : way?.segments?.[b.segI ?? b.si ?? b.seg]; return s?.kind ?? null }
        window.__s7 = { sim, follow: find(root), kind, vistos: [], info: (b) => b && ({ id: b.id, phase: b.phase, kind: kind(b), way: typeof b.way === 'object' ? b.way?.idx : b.way }) }
      })
      const t0 = Date.now(); let n = 0
      while (Date.now() - t0 < 150000 && n < 2) {
        const h = await p.evaluate((HELI) => { const s7 = window.__s7; const c = s7.sim.ballitas.find((x) => x.phase === 'travel' && HELI.includes(s7.kind(x)) && !s7.vistos.includes(x.way?.idx ?? x.way)); if (!c) return null; s7.b = c; s7.follow(c); s7.vistos.push(c.way?.idx ?? c.way); return s7.info(c) }, HELI)
        if (!h) { await sleep(700); continue }
        await sleep(2200); const q = await p.evaluate(() => window.__s7.info(window.__s7.b)); if (!q || !HELI.includes(q.kind)) continue
        n++; const base = `${vp}_34_helice${n}_${q.kind}_w${q.way}`
        writeFileSync(`${dir}/${base}_a.jpg`, await p.screenshot({ type: 'jpeg', quality: 80 })); await sleep(2500)
        const q2 = await p.evaluate(() => window.__s7.info(window.__s7.b))
        writeFileSync(`${dir}/${base}_b.jpg`, await p.screenshot({ type: 'jpeg', quality: 80 }))
        out.push({ img: base, a: q, b: q2 }); console.log(JSON.stringify(out.at(-1)))
      }
    } finally { clearTimeout(guardia); await b.close().catch(() => {}) }
  }
  writeFileSync(`${dir}/resumen_34.json`, JSON.stringify(out, null, 1))
} finally { try { execSync(`taskkill /PID ${srv.pid} /T /F`, { stdio: 'ignore' }) } catch {} try { rmSync(lock) } catch {} }
