// Recorrido siguiendo ballitas: cuadros largos, FPS y apariciones cercanas (pop-in), y memoria.
// uso: node recorrido.mjs <url> <escritorio|movil> [segundos_por_ballita=60] [ballitas=3] [salida.json] [throttle=1]
//   memoria: node recorrido.mjs <url> memoria [segundos=300] -> geometrÃ­as/texturas/heap al minuto 1 y al final
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { writeFileSync } from 'node:fs'
const [url, modo = 'escritorio', secsA, nA, salida, thrA] = process.argv.slice(2)
const memoria = modo === 'memoria'
const secs = +(secsA ?? (memoria ? 300 : 60))
const nBall = memoria ? 1 : +(nA ?? 3)
const movil = modo === 'movil'
const throttle = +(thrA ?? 1)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: [movil ? '--window-size=500,1000' : '--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit', '--enable-precise-memory-info'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const ctx = await b.newContext(movil ? { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true } : { viewport: { width: 1600, height: 900 } })
const p = await ctx.newPage()
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(url)
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(8000)
if (throttle > 1) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle }) }
await p.evaluate(() => {
  const div = document.querySelector('canvas').parentElement
  const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
  let f = div[k]; let sim = null
  while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
  const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
  let root = div[k]; while (root.return) root = root.return
  const follow = find(root)
  const d = window.__ballitasDebug; const T = window.__ballitasDebug.cam?.THREE
  const R = { frames: [], largos: [], pops: [], cambios: [], mem: [] }
  const st = { b: null, entrada: 0, usados: new Set(), t0: performance.now(), run: true }
  window.__rec = { R, st, sim, follow }
  const vivo = (x) => x && x.phase !== 'dying' && x.phase !== 'gone'
  st.elegir = () => {
    const c = sim.ballitas.find((x) => vivo(x) && !st.usados.has(x.id)) ?? sim.ballitas.find(vivo)
    if (!c) return
    st.usados.add(c.id); st.b = c; st.entrada = performance.now()
    R.cambios.push({ t: Math.round(performance.now() - st.t0), id: c.id, phase: c.phase })
    follow(c)
  }
  let last = performance.now()
  const loop = () => {
    const t = performance.now(); const ms = t - last; last = t
    const enEntrada = t - st.entrada < 5000
    R.frames.push(ms, enEntrada ? 1 : 0)
    if (ms > 50) { const bb = st.b; R.largos.push({ t: Math.round(t - st.t0), ms: Math.round(ms), entrada: enEntrada, phase: bb?.phase, way: bb?.seg?.way?.idx ?? bb?.way?.idx ?? null }) }
    if (st.b && !vivo(st.b)) st.elegir()
    if (st.run) requestAnimationFrame(loop)
  }
  requestAnimationFrame(loop)
  // pop-in: cada 200 ms, mallas que pasan de no dibujadas a dibujadas cerca y en el frustum
  const prev = new WeakMap(); const fr = new (d.camera.constructor === Object ? Object : T?.Frustum ?? Object)()
  const M = new (T?.Matrix4 ?? Object)(); const S = new (T?.Sphere ?? Object)()
  const dib = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return false; return !(o.isInstancedMesh && o.count === 0) && !!o.geometry }
  st.pop = setInterval(() => {
    const cam = d.camera
    if (!fr.setFromProjectionMatrix) return
    M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(M)
    d.scene.traverse((o) => {
      if (!o.isMesh && !o.isPoints) return
      const ahora = dib(o); const antes = prev.get(o)
      prev.set(o, ahora)
      if (!ahora || antes === true) return
      if (o.userData?.__ballita) return
      const bs = o.isInstancedMesh ? (o.boundingSphere ?? (o.computeBoundingSphere(), o.boundingSphere)) : (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere))
      if (!bs) return
      S.copy(bs).applyMatrix4(o.matrixWorld)
      const dist = Math.max(0, S.center.distanceTo(cam.position) - S.radius)
      if (antes === undefined && st.entrada && performance.now() - st.entrada < 300) return // ya estaba al llegar
      if (dist < 60 && fr.intersectsSphere(S) && st.b && performance.now() - st.entrada > 5000) {
        R.pops.push({ t: Math.round(performance.now() - st.t0), geo: o.geometry?.name || '-', mat: (Array.isArray(o.material) ? o.material[0] : o.material)?.name || (Array.isArray(o.material) ? o.material[0] : o.material)?.type, inst: o.isInstancedMesh ? o.count : 0, dist: +dist.toFixed(1), nuevo: antes === undefined })
      }
    })
  }, 200)
  st.memo = () => R.mem.push({ t: Math.round(performance.now() - st.t0), geo: d.gl.info.memory.geometries, tex: d.gl.info.memory.textures, prog: d.gl.info.programs.length, heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null })
})
// la sonda necesita THREE: lo toma de cam (solo existe tras seguir); reintenta tras elegir
const resultados = []
for (let k = 0; k < nBall; k++) {
  await p.evaluate(() => window.__rec.st.elegir())
  if (k === 0) {
    // re-crea la sonda de pop-in con THREE ya disponible
    await p.waitForTimeout(300)
    await p.evaluate(() => {
      const { st } = window.__rec; const T = window.__ballitasDebug.cam.THREE
      clearInterval(st.pop)
      const R = window.__rec.R; const d = window.__ballitasDebug
      const prev = new WeakMap(); const fr = new T.Frustum(); const M = new T.Matrix4(); const S = new T.Sphere()
      // estado de dibujo: 'si' | 'oculto' (algún ancestro invisible: LOD, camino oculto) | 'vacio' (InstancedMesh sin instancias: tramo/rango)
      const dib = (o) => { for (let q = o; q; q = q.parent) if (!q.visible) return 'oculto'; return o.isInstancedMesh && o.count === 0 ? 'vacio' : o.geometry ? 'si' : 'oculto' }
      const wayDe = (o) => { for (let q = o; q; q = q.parent) if (q.name?.startsWith('way:')) return +q.name.slice(4); return null }
      st.pop = setInterval(() => {
        const cam = d.camera
        M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(M)
        const t = performance.now()
        d.scene.traverse((o) => {
          if (!o.isMesh && !o.isPoints) return
          const est = dib(o); const antes = prev.get(o)
          prev.set(o, est)
          const ahora = est === 'si'
          if (!ahora || antes === 'si') return
          if (t - st.entrada < 5000) return
          const bs = o.isInstancedMesh ? (o.boundingSphere ?? (o.computeBoundingSphere(), o.boundingSphere)) : (o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere))
          if (!bs) return
          S.copy(bs).applyMatrix4(o.matrixWorld)
          const dist = Math.max(0, S.center.distanceTo(cam.position) - S.radius)
          if (dist < 60 && fr.intersectsSphere(S)) {
            const m = Array.isArray(o.material) ? o.material[0] : o.material
            R.pops.push({ t: Math.round(t - st.t0), geo: o.geometry?.name || '-', mat: m?.name || m?.type, inst: o.isInstancedMesh ? o.count : 0, dist: +dist.toFixed(1), nuevo: antes === undefined, causa: antes ?? 'nuevo', way: wayDe(o), seguida: st.b?.seg?.way?.idx ?? st.b?.way?.idx ?? null, phase: st.b?.phase })
          }
        })
      }, 200)
      // Apariciones BRUSCAS (definición del orquestador): malla o instancia que pasa de no dibujarse a medir > 14 px de
      // alto en un solo cuadro a < 60 u de la cámara. Se mira cada cuadro; con InstanceCuller nuevo (window.__aparece) el
      // tamaño incluye su factor de borde y de revelado; en main el factor es 1.
      R.bruscas = R.bruscas ?? []
      const prevB = new WeakMap(); let lista = []; let nf = 0
      const AP = window.__aparece; const V = new T.Vector3(); const Mi = new T.Matrix4(); const Sc = new T.Vector3()
      const altoPx = (rad, dist) => { const f = cam0().fov * Math.PI / 180; return (2 * rad) / (2 * Math.max(dist, 0.5) * Math.tan(f / 2)) * d.gl.domElement.clientHeight }
      const cam0 = () => d.camera
      const medir = (o) => {
        const cam = d.camera
        const bs = o.geometry.boundingSphere ?? (o.geometry.computeBoundingSphere(), o.geometry.boundingSphere)
        if (!bs) return 0
        const ws = o.matrixWorld.getMaxScaleOnAxis()
        if (!o.isInstancedMesh) {
          S.copy(bs).applyMatrix4(o.matrixWorld)
          const dist = S.center.distanceTo(cam.position)
          if (dist - S.radius > 60 || !fr.intersectsSphere(S)) return 0
          return altoPx(S.radius, dist)
        }
        const noCull = !!o.userData.noCull; const n = o.count
        const D = AP ? (noCull ? o.userData.recorte : (n >= AP.min ? AP.radio : null)) : null
        const rev = AP ? (o.userData.__rev ?? 1) : 1
        let best = 0
        for (let i = 0; i < n; i++) {
          o.getMatrixAt(i, Mi); Mi.premultiply(o.matrixWorld)
          V.setFromMatrixPosition(Mi); Sc.setFromMatrixScale(Mi)
          const dist = V.distanceTo(cam.position)
          if (!noCull && n >= 48 && dist >= 60) continue // lo recorta InstanceCuller
          if (dist > 60) continue
          let k = rev
          if (D) { const t = Math.min(1, Math.max(0, (dist - D * AP.borde) / (D - D * AP.borde))); k *= 1 - t * t * (3 - 2 * t) }
          const r = bs.radius * Math.max(Sc.x, Sc.y, Sc.z) * k
          if (r <= 0) continue
          S.center.copy(bs.center).applyMatrix4(Mi); S.radius = r
          if (!fr.intersectsSphere(S)) continue
          const px = altoPx(r, dist)
          if (px > best) best = px
        }
        return best
      }
      const bucle = () => {
        if (!st.run) return
        if (nf++ % 30 === 0) { lista = []; d.scene.traverse((o) => { if ((o.isMesh || o.isPoints) && o.geometry) lista.push(o) }) }
        const cam = d.camera
        M.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(M)
        const t = performance.now()
        for (const o of lista) {
          const ahora = dib(o) === 'si'; const antes = prevB.get(o)
          prevB.set(o, ahora)
          if (!ahora || antes !== false) continue
          if (o.userData?.__ballita || t - st.entrada < 5000) continue
          const px = medir(o)
          if (px > 14) { const m = Array.isArray(o.material) ? o.material[0] : o.material; R.bruscas.push({ t: Math.round(t - st.t0), geo: o.geometry?.name || '-', mat: m?.name || m?.type, px: Math.round(px), way: wayDe(o) }) }
        }
        requestAnimationFrame(bucle)
      }
      requestAnimationFrame(bucle)
    })
  }
  if (memoria) {
    for (let s = 0; s < secs; s += 10) { await p.waitForTimeout(10000); if (s + 10 === 60 || s + 10 >= secs || (s + 10) % 60 === 0) await p.evaluate(() => window.__rec.st.memo()) }
  } else await p.waitForTimeout(secs * 1000)
}
const R = await p.evaluate(() => { const { st, R } = window.__rec; st.run = false; clearInterval(st.pop); return R })
const total = secs * nBall / 60
const ms = []; const msPost = []
for (let i = 0; i < R.frames.length; i += 2) { ms.push(R.frames[i]); if (!R.frames[i + 1]) msPost.push(R.frames[i]) }
const sorted = [...ms].sort((x, y) => x - y)
const fpsMed = +(1000 / (ms.reduce((a, x) => a + x, 0) / ms.length)).toFixed(1)
const p99 = sorted[Math.floor(sorted.length * 0.99)]
const resumen = {
  modo, throttle, minutos: +total.toFixed(2), fps: fpsMed, fpsP1: +(1000 / p99).toFixed(1),
  largos50_min: +(R.largos.length / total).toFixed(1), largos100_min: +(R.largos.filter((x) => x.ms > 100).length / total).toFixed(1),
  largos50_post_min: +(R.largos.filter((x) => !x.entrada).length / total).toFixed(1), max_post: Math.max(0, ...msPost.map(Math.round)), post_gt120: msPost.filter((x) => x > 120).length,
  popCausa: R.pops.reduce((a, x) => { const k = (x.causa ?? '?') + (x.way == null ? '' : x.way === x.seguida ? ':suyo' : ':otro'); a[k] = (a[k] ?? 0) + 1; return a }, {}),
  popFase: R.pops.reduce((a, x) => ((a[x.phase ?? '?'] = (a[x.phase ?? '?'] ?? 0) + 1), a), {}),
  bruscas_min: +((R.bruscas ?? []).length / total).toFixed(1), bruscasTop: Object.entries((R.bruscas ?? []).reduce((a, x) => ((a[x.geo + '|' + x.mat] = (a[x.geo + '|' + x.mat] ?? 0) + 1), a), {})).sort((x, y) => y[1] - x[1]).slice(0, 6),
  pops_min: +(R.pops.length / total).toFixed(1), popEventos_min: +(new Set(R.pops.map((x) => x.t)).size / total).toFixed(1), popTop: Object.entries(R.pops.reduce((a, x) => ((a[x.geo + '|' + x.mat] = (a[x.geo + '|' + x.mat] ?? 0) + 1), a), {})).sort((x, y) => y[1] - x[1]).slice(0, 8), cambios: R.cambios, mem: R.mem, errores: errs.length,
}
console.log(JSON.stringify(resumen))
if (salida) writeFileSync(salida, JSON.stringify({ resumen, largos: R.largos, pops: R.pops }, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
