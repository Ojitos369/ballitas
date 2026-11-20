// Sonda RECTAS (derivada de sinuoso_cap.mjs): capturas POV sobre el eje ondulado: zona de puerto de una salida/llegada
// (90-450 u del nodo), una horquilla y un rizo (fuera del círculo).
// Original: vista libre y POV sobre tramos sinuosos (seg._braid.sin, tramo abierto, con
// giro propio del camino), en escritorio (1400×900) y móvil (412×915). Levanta y detiene `vite preview`, usa el candado
// de navegador y siempre cierra navegador y servidor.
// uso: node sinuoso_cap.mjs <front rama> <carpeta salida> <playwright-core/index.mjs> <candado> [puerto=4301]
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { spawn, execSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
const [rama, dir, pw, lock, puerto = '4301'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const ZONAS = ['puerto', 'horquilla', 'rizo']
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
async function servidor(front) {
  const s = spawn(process.execPath, [path.join(front, 'node_modules/vite/bin/vite.js'), 'preview', '--port', puerto, '--strictPort'], { cwd: front, stdio: 'ignore' })
  for (let i = 0; i < 60; i++) { try { const r = await fetch(`http://localhost:${puerto}/`); if (r.ok) return s } catch {} await sleep(500) }
  s.kill(); throw new Error('preview no arrancó: ' + front)
}
const parar = (s) => { try { execSync(`taskkill /PID ${s.pid} /T /F`, { stdio: 'ignore' }) } catch {} }
const enganchar = (p) => p.evaluate(() => {
  const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
  let f = div[k]; let sim = null
  while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
  const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
  let root = div[k]; while (root.return) root = root.return
  const seg = (b) => (b.seg && typeof b.seg === 'object' ? b.seg : null)
  // en tramo sinuoso, en la parte media, y con el camino girado (giro propio distinto de 0)
  const zona = (b, q) => { const s = seg(b); if (!s || b.flight) return false; const x = b.segT * s.length; if (q === 'puerto') return (s.kind === 'salida' && x > 90 && x < 420) || (s.kind === 'llegada' && s.length - x > 110 && s.length - x < 450); if (q === 'horquilla') return s.kind === 'horquilla' && b.segT > 0.12 && b.segT < 0.8; return s.kind === 'rizo' && ((b.segT > 0.06 && b.segT < 0.24) || (b.segT > 0.72 && b.segT < 0.9)) }
  const sinuoso = (b) => { const s = seg(b); const r = s?._braid?.sroll?.[b.lane]; if (!s?._braid?.sin || !r || b.flight) return null; const g = r[Math.round(b.segT * (r.length - 1))]; return b.segT > 0.25 && b.segT < 0.7 && Math.abs(g) > 0.5 ? g : null }
  window.__sn = { sim, follow: find(root), sinuoso, zona, info: (b) => b && ({ id: b.id, phase: b.phase, kind: seg(b)?.kind, way: b.way?.idx, lane: b.lane, t: +(b.segT ?? 0).toFixed(2), giro: sinuoso(b) }) }
  const w = sim.world; return { n: sim.ballitas.length, sinuoso: w?.sinuoso ?? null, tramosSin: w?.ways?.reduce((a, x) => a + x.segments.filter((s) => s._braid?.sin).length, 0) }
})
async function corrida(vp, tomas) {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
  const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 8 * 60 * 1000)
  try {
    const p = await (await b.newContext(VPS[vp])).newPage(); const errs = []
    p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160))); p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 160)) })
    await p.goto(`http://localhost:${puerto}/?stats=1`); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(14000)
    const r = { vp, ini: await enganchar(p), tomas: [], errs }
    writeFileSync(`${dir}/${vp}_libre.jpg`, await p.screenshot({ type: 'jpeg', quality: 82 }))
    r.trisLibre = await p.evaluate(() => window.__ballitasDebug.gl.info.render.triangles)
    const usados = []
    for (let k = 0; k < tomas; k++) {
      const t0 = Date.now(); let h = null
      while (Date.now() - t0 < 100000 && !h) {
        h = await p.evaluate((q) => { const s = window.__sn; const c = s.sim.ballitas.find((x) => x.phase === 'travel' && s.zona(x, q)); if (!c) return null; s.b = c; s.follow(c); return s.info(c) }, ZONAS[k])
        if (!h) await sleep(300)
      }
      if (!h) { r.tomas.push({ falta: true }); continue }
      usados.push(h.way)
      if (k === 0) { await sleep(300); await p.keyboard.press('3'); await sleep(900) } else await sleep(900)
      const base = `${vp}_${ZONAS[k]}_w${h.way}_${h.kind}`
      const q1 = await p.evaluate(() => window.__sn.info(window.__sn.b)); writeFileSync(`${dir}/${base}_a.jpg`, await p.screenshot({ type: 'jpeg', quality: 82 }))
      await sleep(1100); const q2 = await p.evaluate(() => window.__sn.info(window.__sn.b)); writeFileSync(`${dir}/${base}_b.jpg`, await p.screenshot({ type: 'jpeg', quality: 82 }))
      r.tomas.push({ img: base, a: q1, b: q2, tris: await p.evaluate(() => window.__ballitasDebug.gl.info.render.triangles) })
    }
    console.log(JSON.stringify(r)); return r
  } finally { clearTimeout(guardia); await b.close().catch(() => {}) }
}
for (let i = 0; i < 40 && existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60 * 1000; i++) { console.log('candado ocupado, espero 30 s'); await sleep(30000) }
writeFileSync(lock, `rectas_cap ${new Date().toISOString()}`)
const out = []; let srv = null
try {
  srv = await servidor(rama)
  for (const [vp, n] of process.argv[7] === 'libre' ? [['desk', 0]] : [['desk', 3], ['movil', 3]]) out.push(await corrida(vp, n).catch((e) => ({ vp, error: String(e).slice(0, 300) })))
  writeFileSync(`${dir}/resumen.json`, JSON.stringify(out, null, 1))
} finally { if (srv) parar(srv); try { rmSync(lock) } catch {} }
