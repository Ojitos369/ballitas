// Sonda DET s2: Camino de Cristal (semilla 369) en POV. Sigue una ballita en viaje por una ruta de tema cristal,
// toma capturas y mide píxeles casi negros en la franja central (donde pasan pórticos y anillos).
// uso: node det2_cristal.mjs <front> <carpeta> <playwright-core/index.mjs> <candado> [puerto=4305] [etiqueta=rama]
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const [front, dir, pw, lock, puerto = '4305', etq = 'rama'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (let i = 0; i < 40 && existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60 * 1000; i++) { console.log('candado ocupado'); await sleep(30000) }
writeFileSync(lock, `det2_cristal ${new Date().toISOString()}`)
const srv = spawn(process.execPath, [path.join(front, 'node_modules/vite/bin/vite.js'), 'preview', '--port', puerto, '--strictPort'], { cwd: front, stdio: 'ignore' })
const parar = () => { try { execSync(`taskkill /PID ${srv.pid} /T /F`, { stdio: 'ignore' }) } catch {} }
let b = null
const guardia = setTimeout(() => { (b ? b.close() : Promise.resolve()).catch(() => {}).finally(() => { parar(); try { rmSync(lock) } catch {} ; process.exit(2) }) }, 8 * 60 * 1000)
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch(`http://localhost:${puerto}/`)).ok) break } catch {} await sleep(500) }
  b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage(); const errs = []
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 160)))
  await p.goto(`http://localhost:${puerto}/?stats=1`); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(12000)
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let f = div[k]; let sim = null
    while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
    const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
    let root = div[k]; while (root.return) root = root.return
    const wayOf = (x) => (typeof x.way === 'object' ? x.way : sim.world.ways[x.way])
    window.__dc = { sim, follow: find(root), wayOf }
  })
  const out = { etq, seed: null, tomas: [], errs }
  await p.keyboard.press('3'); await sleep(1500)
  for (let toma = 0; toma < 4; toma++) {
    const t0 = Date.now(); let h = null
    while (Date.now() - t0 < 90000 && !h) {
      h = await p.evaluate((toma) => {
        const { sim, follow, wayOf } = window.__dc
        const c = sim.ballitas.filter((x) => x.phase === 'travel' && wayOf(x)?.theme?.id === 'cristal')
        if (!c.length) return null
        const x = c[toma % c.length]; follow(x); window.__dc.b = x
        const w = wayOf(x)
        return { id: x.id, way: w.idx, nombre: w.name ?? null, de: w.from?.name ?? w.a?.name ?? null, a: w.to?.name ?? w.b?.name ?? null, seed: sim.world?.seed ?? null }
      }, toma)
      if (!h) await sleep(500)
    }
    if (!h) { out.tomas.push({ toma, falta: true }); continue }
    out.seed = h.seed
    for (const dt of [2500, 2500]) {
      await sleep(dt)
      const met = await p.evaluate(() => {
        const d = window.__ballitasDebug; const c = document.querySelector('canvas')
        // píxeles casi negros (luminancia < 0.035) en el tercio central, sobre una copia 2D del lienzo
        const cv = document.createElement('canvas'); cv.width = 350; cv.height = 225
        const g = cv.getContext('2d'); g.drawImage(c, 0, 0, 350, 225)
        const px = g.getImageData(117, 40, 117, 110).data; let neg = 0
        for (let i = 0; i < px.length; i += 4) if (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2] < 9) neg++
        const mats = []
        d.gl && window.__dc.sim && 0
        return { tris: d.gl.info.render.triangles, negros: +(neg / (px.length / 4)).toFixed(4), fase: window.__dc.b.phase }
      })
      const img = `${etq}_cristal_w${h.way}_t${toma}_${out.tomas.length}.jpg`
      writeFileSync(`${dir}/${img}`, await p.screenshot({ type: 'jpeg', quality: 82 }))
      out.tomas.push({ toma, ...h, ...met, img })
    }
  }
  // metalness efectivo de los materiales de los anillos en escena
  out.anillos = await p.evaluate(() => {
    const r = []; const sc = (() => { const d = window.__ballitasDebug; return d.scene ?? null })()
    if (!sc) return 'sin escena en __ballitasDebug'
    sc.traverse((o) => { if (o.isInstancedMesh && /anillo/.test(o.geometry?.name ?? '') && Array.isArray(o.material)) r.push(o.material.map((m) => [m.name, m.metalness, m.roughness])) })
    return r.slice(0, 3)
  })
  writeFileSync(`${dir}/${etq}_cristal.json`, JSON.stringify(out, null, 1))
  console.log(JSON.stringify(out))
} finally { clearTimeout(guardia); if (b) await b.close().catch(() => {}); parar(); try { rmSync(lock) } catch {} }
