// Sonda SEP sesión 7: A/B de main contra la rama siguiendo la MISMA ballita (por id) con el mismo arranque (contexto
// limpio, misma espera) en POV: FPS medio de 30 s, triángulos y heap JS; escritorio (1400×900) y móvil (412×915), varias
// tandas alternando builds. Con capturas: hélices (espiral/sacacorchos) en POV y en vista de seguimiento (3/4).
// La sonda levanta y detiene `vite preview` de cada build en el mismo puerto, usa el candado de navegador y siempre
// cierra navegador y servidor.
// uso: node sep7.mjs <front rama> <front main> <carpeta salida> <playwright-core/index.mjs> <candado> [tandas=2] [puerto=4301]
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const [rama, main, dir, pw, lock, tandasA = '2', puerto = '4301'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
const HELI = ['sacacorchos', 'espiral']

async function servidor(front) {
  const s = spawn(process.execPath, [path.join(front, 'node_modules/vite/bin/vite.js'), 'preview', '--port', puerto, '--strictPort'], { cwd: front, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${puerto}/`); if (r.ok) return s } catch {} await sleep(500) }
  s.kill(); throw new Error('preview no arrancó: ' + front)
}
const parar = (s) => { try { execSync(`taskkill /PID ${s.pid} /T /F`, { stdio: 'ignore' }) } catch {} }

// engancha sim y onFollowBallita desde el árbol de React (misma técnica que ab_aparece.mjs)
const enganchar = (p) => p.evaluate(() => {
  const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
  let f = div[k]; let sim = null
  while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
  const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
  let root = div[k]; while (root.return) root = root.return
  const kind = (b) => { const w = sim.world; const way = typeof b.way === 'object' ? b.way : w?.ways?.[b.way]; const s = b.seg && typeof b.seg === 'object' ? b.seg : way?.segments?.[b.segI ?? b.si ?? b.seg]; return s?.kind ?? null }
  window.__s7 = { sim, follow: find(root), kind, info: (b) => b && ({ id: b.id, phase: b.phase, kind: kind(b), way: typeof b.way === 'object' ? b.way?.idx : b.way }) }
  return { n: sim.ballitas.length, seed: sim.world?.seed ?? sim.seed ?? null, viajan: sim.ballitas.filter((b) => b.phase === 'travel').map((b) => b.id) }
})
const medir = (p, ms) => p.evaluate((ms) => new Promise((ok) => {
  const d = window.__ballitasDebug; const s7 = window.__s7; const b = s7.b; const t0 = performance.now(); let n = 0; let tris = 0; let heap = 0; const kinds = []; let viaje = 0
  const f = () => {
    n++; tris += d.gl.info.render.triangles; if (n % 30 === 0) heap = Math.max(heap, performance.memory?.usedJSHeapSize || 0)
    if (b.phase === 'travel') viaje++
    const k = s7.kind(b); if (k && kinds[kinds.length - 1] !== k) kinds.push(k)
    const t = performance.now() - t0
    if (t < ms) requestAnimationFrame(f); else ok({ fps: +(n / (t / 1000)).toFixed(1), tris: Math.round(tris / n), heapMB: Math.round(heap / 1048576), enViaje: +(viaje / n).toFixed(2), tramos: kinds.join('>'), fin: s7.info(b) })
  }
  requestAnimationFrame(f)
}), ms)

const ids = {} // vp -> id de la ballita elegida en la primera corrida (la rama); las demás siguen la misma
async function corrida(nombre, vp, capturas) {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist', '--enable-precise-memory-info'] })
  const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 6 * 60 * 1000)
  try {
    const p = await (await b.newContext(VPS[vp])).newPage(); const errs = []
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)))
    await p.goto(`http://localhost:${puerto}/?stats=1`); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(14000)
    const ini = await enganchar(p)
    const sel = await p.evaluate((id) => { const s7 = window.__s7; const c = (id != null && s7.sim.ballitas.find((x) => x.id === id)) || s7.sim.ballitas.find((x) => x.phase === 'travel') || s7.sim.ballitas[0]; s7.b = c; s7.follow(c); return s7.info(c) }, ids[vp] ?? null)
    if (ids[vp] == null) ids[vp] = sel.id
    await sleep(800); await p.keyboard.press('3'); await sleep(2500)
    const m = await medir(p, 30000)
    const r = { nombre, vp, ini, sel, ...m, errs: errs.slice(0, 3), tomas: [] }
    if (capturas) {
      const vistos = new Set(); const t0 = Date.now()
      while (Date.now() - t0 < 100000 && r.tomas.length < 2) {
        const h = await p.evaluate((HELI) => { const s7 = window.__s7; const c = s7.sim.ballitas.find((x) => x.phase === 'travel' && HELI.includes(s7.kind(x)) && !(window.__s7v || []).includes(x.way?.idx ?? x.way)); if (!c) return null; s7.b = c; s7.follow(c); (window.__s7v ||= []).push(c.way?.idx ?? c.way); return s7.info(c) }, HELI)
        if (!h) { await sleep(700); continue }
        await sleep(1800); const q = await p.evaluate(() => window.__s7.info(window.__s7.b))
        if (!q || !HELI.includes(q.kind) || vistos.has(q.way)) continue
        vistos.add(q.way); const base = `${vp}_helice${r.tomas.length + 1}_${q.kind}_w${q.way}`
        writeFileSync(`${dir}/${base}_pov.jpg`, await p.screenshot({ type: 'jpeg', quality: 80 }))
        await p.keyboard.press('3'); await sleep(1600)
        const q2 = await p.evaluate(() => window.__s7.info(window.__s7.b))
        writeFileSync(`${dir}/${base}_34.jpg`, await p.screenshot({ type: 'jpeg', quality: 80 }))
        await p.keyboard.press('3'); await sleep(1200)
        r.tomas.push({ img: base, pov: q, tresCuartos: q2 })
      }
    }
    console.log(JSON.stringify(r)); return r
  } finally { clearTimeout(guardia); await b.close().catch(() => {}) }
}

// candado: un solo navegador en todo el equipo
for (let i = 0; i < 40 && existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60 * 1000; i++) { console.log('candado ocupado, espero 30 s'); await sleep(30000) }
writeFileSync(lock, `sep7 ${new Date().toISOString()}`)
const out = []; let srv = null
const refrescar = setInterval(() => { try { writeFileSync(lock, `sep7 ${new Date().toISOString()}`) } catch {} }, 4 * 60 * 1000)
try {
  for (let t = 1; t <= +tandasA; t++) for (const [nombre, front] of [['rama', rama], ['main', main]]) {
    srv = await servidor(front)
    try { for (const vp of ['desk', 'movil']) out.push({ tanda: t, ...(await corrida(nombre, vp, nombre === 'rama' && t === 1).catch((e) => ({ nombre, vp, error: String(e).slice(0, 200) }))) }) } finally { parar(srv); srv = null; await sleep(1500) }
    writeFileSync(`${dir}/resumen.json`, JSON.stringify(out, null, 1))
  }
} finally { clearInterval(refrescar); if (srv) parar(srv); try { rmSync(lock) } catch {} }
