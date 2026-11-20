// Sonda OPT: vista general (mapa libre, sin ballita seleccionada) con órbita lenta fija alrededor del objetivo de
// OrbitControls. Modos:
//  - base: N tandas de `seg` s (FPS medio, p5 de FPS por ventana de 0,5 s, ms CPU de useFrame+render, calls, tris,
//    geometrías, texturas, heap) + reparto de draw calls por capa en un cuadro + coste por capa apagando cada grupo.
//  - ab: alterna window.__opt.off (true = comportamiento anterior) por tramos en la MISMA sesión.
// Usa el candado de navegador, cierra siempre navegador. El servidor (vite preview) lo levanta quien llama.
// uso: node opt_vista.mjs <url> <desk|movil> <base|ab> <carpeta salida> <playwright index.mjs> <candado> [seg=30] [tandas=3]
import { mkdirSync, writeFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [url, vp, modo, dir, pw, lock, segA = '30', tandasA = '3'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
mkdirSync(dir, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const VPS = { desk: { viewport: { width: 1400, height: 900 } }, movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }

for (let i = 0; i < 40 && existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 10 * 60 * 1000; i++) { console.log('candado ocupado, espero 30 s'); await sleep(30000) }
writeFileSync(lock, `opt ${new Date().toISOString()}`)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1450,1000', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--disable-frame-rate-limit', '--disable-gpu-vsync'] })
const guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => { try { rmSync(lock) } catch {} process.exit(2) }) }, 9 * 60 * 1000)
try {
  const p = await (await b.newContext(VPS[vp])).newPage(); const errs = []
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 160)))
  await p.goto(url); await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 }); await sleep(14000)
  // engancha OrbitControls (primitive object con target+enableDamping) y prepara la órbita lenta fija
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let root = div[k]; while (root.return) root = root.return
    let ctl = null
    const walk = (f, d = 0) => { for (let c = f; c && !ctl; c = c.sibling) { const o = c.memoizedProps?.object; if (o && o.target && 'enableDamping' in o) { ctl = o; return } if (c.child && d < 600) walk(c.child, d + 1) } }
    walk(root)
    const d = window.__ballitasDebug
    const T = ctl ? ctl.target.clone() : new d.camera.position.constructor()
    const off0 = d.camera.position.clone().sub(T)
    const st = { ctl: !!ctl, ang: 0, on: false }
    const giro = () => {
      if (st.on) {
        st.ang += 0.0035 // rad por cuadro fijo: misma trayectoria por cuadro en A y B
        const c = Math.cos(st.ang), s = Math.sin(st.ang)
        d.camera.position.set(T.x + off0.x * c - off0.z * s, T.y + off0.y, T.z + off0.x * s + off0.z * c)
        d.camera.lookAt(T); if (ctl) { ctl.target.copy(T); ctl.update() }
      }
      requestAnimationFrame(giro)
    }
    requestAnimationFrame(giro)
    window.__orb = st
  })
  const medir = (ms) => p.evaluate((ms) => new Promise((ok) => {
    const d = window.__ballitasDebug; const gl = d.gl; const t0 = performance.now(); let n = 0; let calls = 0; let tris = 0; let ult = t0; const dts = []
    let heap = 0
    // ms de CPU: tiempo entre el inicio del rAF y el final del render (gl.render envuelto)
    // (marca de tiempo del rAF = inicio del cuadro; fin = último gl.render del cuadro, incluido el compositor)
    let cpu = 0; let tsPrev = 0; const ren = gl.render.bind(gl); let fin = 0
    gl.render = (s, c) => { ren(s, c); fin = performance.now() }
    const f = (ts) => {
      const ahora = performance.now(); const t = ahora - t0
      if (n > 0) { dts.push(ahora - ult); if (fin > tsPrev) cpu += Math.min(200, fin - tsPrev) }
      tsPrev = ts
      ult = ahora; n++
      calls += gl.info.render.calls; tris += gl.info.render.triangles
      if (n % 30 === 0) heap = Math.max(heap, performance.memory?.usedJSHeapSize || 0)
      if (t < ms) requestAnimationFrame(f); else {
        gl.render = ren
        // p5 de FPS por ventanas de 0,5 s
        const w = []; let acc = 0; let c = 0
        for (const x of dts) { acc += x; c++; if (acc >= 500) { w.push(c / (acc / 1000)); acc = 0; c = 0 } }
        w.sort((a, b) => a - b)
        const fr = n - 1
        ok({ fps: +(fr / ((ult - t0) / 1000)).toFixed(1), p5: +(w[Math.floor(w.length * 0.05)] ?? 0).toFixed(1), cpuMs: +(cpu / fr).toFixed(2), maxMs: +Math.max(...dts).toFixed(0), calls: Math.round(calls / n), tris: Math.round(tris / n), geos: gl.info.memory.geometries, texs: gl.info.memory.textures, heapMB: Math.round(heap / 1048576), dpr: gl.getPixelRatio(), buf: [gl.domElement.width, gl.domElement.height] })
      }
    }
    requestAnimationFrame(f)
  }), ms)
  // stats con autoReset=false (StatsOverlay los resetea por cuadro?): se fuerza reset por cuadro durante la sonda
  await p.evaluate(() => { const gl = window.__ballitasDebug.gl; const rs = () => { gl.info.reset(); requestAnimationFrame(rs) }; window.__rsInfo = true })
  await p.evaluate(() => { window.__orb.on = true })
  await sleep(2000)
  const out = { vp, modo, url, orbita: await p.evaluate(() => window.__orb.ctl), filas: [] }
  if (modo === 'exp') {
    // experimentos de coste: cada uno 4 s contra la referencia inmediata
    const EXP = {
      ref: '',
      dpr05: 'd.gl.setPixelRatio(0.5)',
      sinNodos: 'for (let i = 0; i < 5; i++) s.children[1].children[i].visible = false',
      sinCaminos: 'for (let i = 6; i < 26; i++) s.children[1].children[i].visible = false',
      sinS1: 's.children[1].visible = false',
      sinFondo: 's.children[0].visible = false',
      sinTodo: 's.children[0].visible = false; s.children[1].visible = false',
      sinHtml: 'document.querySelectorAll(".tag").forEach((e) => { e.parentElement.style.display = "none" })',
    }
    out.exp = {}
    for (const [k, code] of Object.entries(EXP)) {
      await p.evaluate((code) => { const d = window.__ballitasDebug; const s = d.scene; window.__snap = []; s.traverse((o) => window.__snap.push([o, o.visible])); window.__dprPrev = d.gl.getPixelRatio(); new Function('d', 's', code)(d, s) }, code)
      await sleep(500)
      const r = await medir(4000)
      await p.evaluate(() => { for (const [o, v] of window.__snap) o.visible = v; window.__ballitasDebug.gl.setPixelRatio(window.__dprPrev); document.querySelectorAll('.tag').forEach((e) => { e.parentElement.style.display = '' }) })
      out.exp[k] = r; console.log(k, JSON.stringify(r))
    }
  } else if (modo === 'base' || modo === 'rep') {
    for (let t = 0; t < +tandasA; t++) { const r = await medir(+segA * 1000); out.filas.push({ tanda: t + 1, ...r }); console.log(JSON.stringify(out.filas.at(-1))) }
    // reparto de draw calls por capa en un cuadro
    out.reparto = await p.evaluate(() => new Promise((ok) => {
      const d = window.__ballitasDebug; const gl = d.gl; const orig = gl.renderBufferDirect.bind(gl); const agg = {}
      const nombre = (o) => o.name || o.type
      gl.renderBufferDirect = (cam, scene, geo, mat, obj, group) => {
        const ruta = []; for (let q = obj; q && q.parent; q = q.parent) ruta.unshift(q)
        const sc = ruta.length ? d.scene.children.indexOf(ruta[0]) : -1
        const g1 = ruta[1] ? ruta[0].children.indexOf(ruta[1]) : -1
        const key = `s${sc}/${g1} ${(geo.name || '').split(':').slice(0, 2).join(':') || '-'} ${mat.type}${obj.isInstancedMesh ? ' inst' : ''}`
        const tri = ((geo.index ? geo.index.count : geo.attributes.position?.count || 0) / 3) * (obj.isInstancedMesh ? obj.count : 1)
        const a = (agg[key] ||= { calls: 0, tris: 0 }); a.calls++; a.tris += tri
        return orig(cam, scene, geo, mat, obj, group)
      }
      requestAnimationFrame(() => requestAnimationFrame(() => {
        gl.renderBufferDirect = orig
        ok(Object.entries(agg).sort((a, b) => b[1].calls - a[1].calls).slice(0, 40).map(([k, v]) => `${v.calls}c ${Math.round(v.tris)}t ${k}`))
      }))
    }))
    // estructura: hijos de la escena y del grupo mayor
    out.estructura = await p.evaluate(() => { const s = window.__ballitasDebug.scene; const cnt = (o) => { let n = 0; o.traverse(() => n++); return n }; return s.children.map((c, i) => `s${i} ${c.type} ${c.name} hijos=${c.children.length} obj=${cnt(c)} vis=${c.visible}`) })
    // coste por capa: apagar cada hijo de los grupos s* grandes 4 s y medir FPS frente al todo encendido
    const capas = await p.evaluate(() => { const s = window.__ballitasDebug.scene; const L = []; s.children.forEach((c, i) => { if (c.children.length > 4) c.children.forEach((h, j) => { let n = 0; h.traverse(() => n++); if (n > 3) L.push([i, j, n]) }); else L.push([i, -1, 1]) }); return L.slice(0, 40) })
    out.capas = []
    if (modo === 'rep') {
      // lista detallada de qué se dibuja: nombre de la malla, de su padre y del abuelo, material y geometría
      out.lista = await p.evaluate(() => new Promise((ok) => {
        const d = window.__ballitasDebug; const gl = d.gl; const orig = gl.renderBufferDirect.bind(gl); const agg = {}
        gl.renderBufferDirect = (cam, scene, geo, mat, obj, group) => {
          const k = `${obj.parent?.parent?.name || obj.parent?.parent?.type}/${obj.parent?.name || obj.parent?.type}/${obj.name || obj.type} geo=${geo.name || geo.type}:${geo.index ? geo.index.count / 3 : (geo.attributes.position?.count || 0) / 3} mat=${mat.type}:${mat.name || mat.uuid.slice(0, 4)} t=${mat.transparent ? 1 : 0}`
          agg[k] = (agg[k] || 0) + 1
          return orig(cam, scene, geo, mat, obj, group)
        }
        requestAnimationFrame(() => requestAnimationFrame(() => { gl.renderBufferDirect = orig; ok(Object.entries(agg).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`)) }))
      }))
      for (const x of out.lista) console.log(x)
    }
    const ref = modo === 'rep' ? null : await medir(4000)
    if (modo === 'rep') capas.length = 0
    for (const [i, j, n] of capas) {
      await p.evaluate(([i, j]) => { const s = window.__ballitasDebug.scene; const o = j < 0 ? s.children[i] : s.children[i].children[j]; window.__apag = o; window.__apagVis = o.visible; o.visible = false }, [i, j])
      await sleep(300)
      const r = await medir(4000)
      await p.evaluate(() => { window.__apag.visible = window.__apagVis })
      out.capas.push(`s${i}/${j} n=${n} fps ${r.fps} (ref ${ref.fps}) calls ${r.calls} (ref ${ref.calls}) tris ${r.tris} (ref ${ref.tris}) cpu ${r.cpuMs}`)
      console.log(out.capas.at(-1))
    }
    writeFileSync(`${dir}/${vp}_base.jpg`, await p.screenshot({ type: 'jpeg', quality: 85 }))
  } else {
    // A/B: tramos de seg/… alternando __opt.off
    const tramo = 5000; const nT = Math.floor((+segA * 1000) / tramo) * +tandasA
    for (let i = 0; i < nT; i++) {
      const off = i % 2 === 0
      await p.evaluate((off) => { (window.__opt ||= {}).off = off }, off)
      await sleep(600)
      const r = await medir(tramo); const hornea = await p.evaluate(() => window.__opt?.hornea || 0); out.filas.push({ i, modo: off ? 'off' : 'on', hornea, ...r }); console.log(JSON.stringify(out.filas.at(-1)))
      if (i < 2) writeFileSync(`${dir}/${vp}_ab_${off ? 'off' : 'on'}.jpg`, await p.screenshot({ type: 'jpeg', quality: 85 }))
    }
    const med = (m, k) => { const xs = out.filas.filter((x) => x.modo === m).map((x) => x[k]); return xs.reduce((a, x) => a + x, 0) / xs.length }
    out.resumen = {}
    for (const k of ['fps', 'p5', 'cpuMs', 'calls', 'tris']) { const on = med('on', k); const of = med('off', k); out.resumen[k] = { on: +on.toFixed(2), off: +of.toFixed(2), difPct: +(((on - of) / of) * 100).toFixed(1) } }
    console.log('RESUMEN', vp, JSON.stringify(out.resumen))
  }
  out.errs = errs.slice(0, 5)
  writeFileSync(`${dir}/${vp}_${modo}.json`, JSON.stringify(out, null, 1))
  console.log(JSON.stringify({ reparto: out.reparto, estructura: out.estructura, errs: out.errs }, null, 1))
} finally { clearTimeout(guardia); await b.close().catch(() => {}); try { rmSync(lock) } catch {} }
