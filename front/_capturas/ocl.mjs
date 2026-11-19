// Sonda de oclusión en fases de planeta: sigue ballitas (tecla 3) y cada ~0.6 s, si la seguida está en un planeta
// (toDest, at, toPort), mide: ocluida (rayo cámara→ballita choca con malla opaca antes de llegar), tapada (fracción de
// una rejilla 8x14 de rayos que choca a menos del 60 % de la distancia a la ballita), y si la ballita cae en el área
// útil (entre el HUD de arriba y lo primero de abajo: tarjeta o fila de círculos). Guarda unas capturas.
// uso: node ocl.mjs <url> <carpeta> [desk|movil] [muestras=60] [segundos=200]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const [url, dir, vp = 'movil', nArg = '60', secsArg = '200'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const VPS = {
  desk: { viewport: { width: 1400, height: 900 } },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const muestra = () => {
  const d = window.__ballitasDebug; const c = d?.cam; const b = c?.selected
  if (!b || !['toDest', 'at', 'toPort'].includes(b.phase)) return null
  const T = d.THREE || c.camera.constructor.__T
  const cam = c.camera; const bp = (c.bp ?? b.pos)
  const V = bp.constructor
  const rc = window.__oclRC || (window.__oclRC = new (c.THREE.Raycaster)())
  const scene = d.scene
  const opaco = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false
    if (!o.isMesh) return false
    const m = Array.isArray(o.material) ? o.material[0] : o.material
    if (!m || m.visible === false) return false
    if (m.transparent && (m.opacity ?? 1) < 0.6) return false
    if (m.depthWrite === false) return false
    if (m.colorWrite === false) return false
    return true
  }
  rc.camera = cam
  const lista = []; scene.traverseVisible((o) => { if (opaco(o)) lista.push(o) })
  const camP = cam.position.clone()
  const dir = bp.clone().sub(camP); const dist = dir.length(); dir.normalize()
  rc.set(camP, dir); rc.near = 0.05; rc.far = Math.max(0.1, dist - 0.8)
  const hits = rc.intersectObjects(lista, false)
  const ocluida = hits.length > 0
  const quien = ocluida ? (hits[0].object.name || hits[0].object.geometry?.type || '?') + '@' + hits[0].distance.toFixed(2) : ''
  // rejilla
  let tap = 0; let tot = 0
  const v = new V()
  for (let i = 0; i < 6; i++) for (let j = 0; j < 10; j++) {
    v.set((i + 0.5) / 6 * 2 - 1, (j + 0.5) / 10 * 2 - 1, 0.5).unproject(cam).sub(camP).normalize()
    rc.set(camP, v); rc.far = dist * 0.6
    const h = rc.intersectObjects(lista, false)[0]
    tot++; if (h) tap++
  }
  const pr = bp.clone().project(cam)
  const W = innerWidth; const H = innerHeight
  const sx = (pr.x * 0.5 + 0.5) * W; const sy = (-pr.y * 0.5 + 0.5) * H
  let abajo = H; let arriba = 0
  for (const sel of ['.tarjeta', '.puntos']) {
    const r = document.querySelector(sel)?.getBoundingClientRect()
    if (r && r.height > 0 && r.top > H * 0.4) abajo = Math.min(abajo, r.top)
  }
  for (const sel of ['.hud', '.top', '.barra']) {
    const r = document.querySelector(sel)?.getBoundingClientRect()
    if (r && r.height > 0 && r.bottom < H * 0.4) arriba = Math.max(arriba, r.bottom)
  }
  const util = pr.z < 1 && sx > W * 0.08 && sx < W * 0.92 && sy > arriba + 10 && sy < abajo - 20
  return { phase: b.phase, node: b.node, ocluida, quien, tapada: +(tap / tot).toFixed(2), util, sx: Math.round(sx), sy: Math.round(sy), arriba: Math.round(arriba), abajo: Math.round(abajo), dist: +dist.toFixed(2) }
}

const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 10 * 60 * 1000)
try {
  const ctx = await b.newContext(VPS[vp])
  const p = await ctx.newPage()
  let nErr = 0; p.on('pageerror', () => nErr++)
  await p.goto(url)
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
  await sleep(8000)
  await p.keyboard.press('3')
  await sleep(1500)
  const filas = []; const t0 = Date.now(); let shots = 0; let fuera = 0
  const dots = await p.locator('.puntos .punto').count(); let dot = 0
  while (filas.length < +nArg && Date.now() - t0 < +secsArg * 1000) {
    const s = await p.evaluate(muestra).catch((e) => ({ err: String(e).slice(0, 120) }))
    if (s?.err) { console.log(s.err); await sleep(600); continue }
    if (s) {
      fuera = 0
      filas.push(s)
      if (shots < 6 && filas.length % 8 === 1) writeFileSync(`${dir}/${vp}_${shots++}_${s.phase}.jpg`, await p.screenshot({ type: 'jpeg', quality: 70 }))
      await sleep(600)
    } else {
      if (++fuera > 1) { dot = (dot + 1) % Math.max(1, dots); try { await p.locator('.puntos .punto').nth(dot).click({ timeout: 2000 }) } catch {} ; fuera = 0; await sleep(1200) } else await sleep(300)
    }
  }
  const n = filas.length || 1
  const r = {
    vp, n: filas.length, nodos: new Set(filas.map((f) => f.node)).size,
    ocluida: +(100 * filas.filter((f) => f.ocluida).length / n).toFixed(1),
    tapada: +(100 * filas.filter((f) => f.tapada > 0.25).length / n).toFixed(1),
    util: +(100 * filas.filter((f) => f.util).length / n).toFixed(1), nErr,
  }
  writeFileSync(`${dir}/ocl_${vp}.json`, JSON.stringify({ r, filas }, null, 1))
  console.log(JSON.stringify(r))
  for (const f of filas.filter((x) => x.ocluida || x.tapada > 0.25 || !x.util).slice(0, 15)) console.log(JSON.stringify(f))
} finally {
  clearTimeout(guardia)
  await b.close().catch(() => {})
}
