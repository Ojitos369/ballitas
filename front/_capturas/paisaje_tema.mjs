// Sonda de paisaje por tema (hielo, volcan). uso: node paisaje_tema.mjs url carpeta etiqueta desk|mob [temas=hielo,volcan]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'
const [url, dir, tag, vp = 'desk', temasArg = 'hielo,volcan'] = process.argv.slice(2)
const temas = temasArg.split(',')
mkdirSync(dir, { recursive: true })
const ctxOpts = vp === 'mob'
  ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true }
  : { viewport: { width: 1400, height: 900 } }
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,1000', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const ctx = await b.newContext(ctxOpts)
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(6000)
await p.keyboard.press('3')
await p.waitForTimeout(1500)
const click = (sel, i) => p.evaluate(([s, n]) => [...document.querySelectorAll(s)][n]?.click(), [sel, i])
const velBtn = (txt) => p.evaluate((t) => [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === t || b.getAttribute('aria-label') === t || b.title === t)?.click(), txt)
const estado = () => p.evaluate(() => { const d = window.__ballitasDebug; const s = d.cam?.selected; const sg = s?.seg; const seg = (sg && typeof sg === 'object') ? sg : s?.way?.segments?.[sg]; return { id: s?.id, phase: s?.phase, theme: s?.way?.theme?.id ?? null, way: s?.way?.idx ?? null, air: !!(seg?.air || s?.airborne || s?.flight), modo: d.cam?.modo }})
const medir = (ms) => p.evaluate((ms) => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < ms ? requestAnimationFrame(f) : ok(+(n / (ms / 1000)).toFixed(1)) }; requestAnimationFrame(f) }), ms)
const capas = () => p.evaluate(() => {
  const d = window.__ballitasDebug; const cam = d.camera; const THREE = d.cam.THREE
  const fov = cam.fov * Math.PI / 180; const H = innerHeight
  const out = {}
  const m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(), nd = new THREE.Vector3()
  d.scene.traverse((o) => {
    if (!o.isInstancedMesh || !o.geometry.name?.startsWith('paisaje:')) return
    o.geometry.computeBoundingBox(); const alto = o.geometry.boundingBox.max.y - o.geometry.boundingBox.min.y
    const k = o.geometry.name.slice(8) + '/' + (o.material.defines?.P_KIND ?? '?')
    let en = 0; const px = []
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m); m.premultiply(o.matrixWorld).decompose(pos, q, s)
      nd.copy(pos).project(cam)
      if (Math.abs(nd.x) > 1.1 || Math.abs(nd.y) > 1.1 || nd.z > 1) continue
      en++; const dist = pos.distanceTo(cam.position); px.push(s.y * alto / (dist * Math.tan(fov / 2)) * H / 2)
    }
    px.sort((a, b2) => a - b2)
    let vis = o.visible; for (let a = o.parent; a; a = a.parent) if (!a.visible) vis = false
    const prev = out[k] ?? { montadas: 0, enCuadro: 0, px: [], vis: 0 }; prev.vis += vis ? 1 : 0
    prev.montadas += o.count; prev.enCuadro += en; prev.px.push(...px); out[k] = prev
  })
  for (const k in out) { const a = out[k].px.sort((x, y) => x - y); out[k] = { vis: out[k].vis, montadas: out[k].montadas, enCuadro: out[k].enCuadro, pxMediana: a.length ? Math.round(a[a.length >> 1]) : 0, pxMax: a.length ? Math.round(a[a.length - 1]) : 0 } }
  return out
})
const info = () => p.evaluate(() => { const r = window.__ballitasDebug.gl.info.render; return { calls: r.calls, tris: r.triangles } })

const res = []
const done = {}
async function tomas(t, vista, n) {
  let ok = 0
  for (let k = 0; k < n; k++) {
    let e = await estado()
    for (let r = 0; r < 8 && (e.air || e.phase !== 'travel' || e.theme !== t || (vista === 'ballita' && e.modo !== 'siguiendo')); r++) { await p.waitForTimeout(1500); e = await estado() }
    if (e.air || e.phase !== 'travel' || e.theme !== t) { console.log('perdida', t, vista, JSON.stringify(e)); return ok }
    // espera (hasta 25 s) un momento con el paisaje montado y a la vista; si no llega, toma la captura marcada como sinPaisaje
    let cp = await capas(); let hay = Object.entries(cp).some(([n, v]) => !/^(ray|motes|bubbles|embers|flakes|aurora)/.test(n) && v.enCuadro >= 4)
    let polls = 1, conP = hay ? 1 : 0
    for (let r = 0; r < 25 && !hay && vista === 'ballita'; r++) { await p.waitForTimeout(1000); cp = await capas(); hay = Object.entries(cp).some(([n, v]) => !/^(ray|motes|bubbles|embers|flakes|aurora)/.test(n) && v.enCuadro >= 4); polls++; if (hay) conP++ }
    const fps = await medir(2000); const inf = await info()
    const f = `${dir}/${tag}_${vp}_${t}_${vista}${k}.jpg`
    await p.screenshot({ path: f, quality: 75 })
    const r = { tema: t, vista, k, estado: e, sinPaisaje: !hay, esperaPaisaje: polls, fps, ...inf, capas: cp, img: f }; res.push(r); ok++
    console.log(JSON.stringify({ ...r, capas: undefined }))
    await p.waitForTimeout(1500)
  }
  return ok
}
await velBtn('Velocidad por ocho')
const t0 = Date.now()
while (temas.some((t) => !done[t]) && Date.now() - t0 < 900000) {
  const n = await p.evaluate(() => document.querySelectorAll('.punto').length)
  for (let i = 0; i < n; i++) {
    await click('.punto', i); await p.waitForTimeout(700)
    const e = await estado()
    if (temas.includes(e.theme) && !done[e.theme] && e.phase === 'travel' && !e.air) {
      const t = e.theme; console.log('hallado', t, i, JSON.stringify(e))
      await velBtn('Velocidad normal')
      if (!['siguiendo', 'entrando'].includes((await estado()).modo)) await p.keyboard.press('3')
      await p.waitForTimeout(5500)
      const nb = await tomas(t, 'ballita', 4)
      if (nb >= 4) {
        await p.keyboard.press('2'); await p.waitForTimeout(6000)
        await tomas(t, 'camino', 2)
        done[t] = true
      } else { res.splice(res.length - nb, nb) }
      if (!['siguiendo', 'entrando'].includes((await estado()).modo)) await p.keyboard.press('3')
      await velBtn('Velocidad por ocho')
    }
  }
}
writeFileSync(`${dir}/${tag}_${vp}.json`, JSON.stringify({ done, res, errs }, null, 1))
console.log('errores', errs.length, errs.slice(0, 3))
await b.close()



