// Perfil de la entrada a la vista ballita: por cuadro (duración, programas, geometrías, texturas), programas
// nuevos con el material que los originó, long animation frames con scripts y (opcional) perfil de CPU por CDP.
// uso: node perfil_entrada.mjs <url> <caso: auto|camino|planeta> [reps=1] [cpu=0] [salida.json]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { writeFileSync } from 'node:fs'
const [url, caso = 'auto', reps = '1', cpu = '0', salida] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1600,900', '--ignore-gpu-blocklist', '--disable-frame-rate-limit'] })
const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
try {
const todo = []
for (let r = 0; r < +reps; r++) {
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } })
  const errs = []
  p.on('pageerror', (e) => errs.push(e.message))
  await p.goto(url)
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
  await p.waitForTimeout(8000)
  // espera a que el mapa pinte estable (2 s seguidos sin cuadros > 100 ms): la carga en frío no es la entrada
  await p.evaluate(() => new Promise((ok) => { let last = performance.now(); let desde = last; const f = () => { const t = performance.now(); if (t - last > 100) desde = t; last = t; if (t - desde > 2000) ok(); else requestAnimationFrame(f) }; requestAnimationFrame(f) }))
  // localiza la sim y followBallita por las fibras de React (vale en main y en la rama)
  const ok = await p.evaluate(async (caso) => {
    const div = document.querySelector('canvas').parentElement
    const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let f = div[k]; let sim = null; let follow = null
    while (f) { const pr = f.memoizedProps; if (pr?.sim && !sim) sim = pr.sim; f = f.return }
    // Hud está en MainScene: busca en hermanos del árbol
    const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
    let root = div[k]; while (root.return) root = root.return
    follow = find(root)
    window.__probe = { sim, follow }
    if (caso === 'auto') return { ok: true }
    const quiere = caso === 'camino' ? (x) => x.phase === 'travel' && x.timer > 6 : (x) => ['toDest', 'at', 'born'].includes(x.phase)
    const t0 = performance.now()
    while (performance.now() - t0 < 40000) {
      const bb = sim.ballitas.find(quiere)
      if (bb) { window.__probe.b = bb; return { ok: true, id: bb.id, phase: bb.phase } }
      await new Promise((ok) => setTimeout(ok, 100))
    }
    return { ok: false }
  }, caso)
  if (!ok.ok) { console.log(JSON.stringify({ rep: r, error: 'sin ballita en ' + caso })); await p.close(); continue }
  let cdp = null
  if (+cpu) { cdp = await p.context().newCDPSession(p); await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 250 }); await cdp.send('Profiler.start') }
  const res = await p.evaluate(async (caso) => {
    const d = window.__ballitasDebug; const gl = d.gl
    const progs0 = new Set(gl.info.programs)
    const fr = []; let last = performance.now(); let run = true; let t0 = 0
    const f = () => {
      const t = performance.now()
      if (t0) {
        const pr = gl.info.programs
        const nuevos = pr.filter((x) => !progs0.has(x) && !x.__visto)
        for (const x of nuevos) x.__visto = Math.round(t - t0)
        fr.push({ t: Math.round(last - t0), ms: +(t - last).toFixed(1), prog: pr.length, nuevos: nuevos.length, geo: gl.info.memory.geometries, tex: gl.info.memory.textures, dpr: gl.getPixelRatio(), w: gl.domElement.width })
      }
      last = t; if (run) requestAnimationFrame(f)
    }
    requestAnimationFrame(f)
    const loaf = []
    const ob = new PerformanceObserver((l) => { for (const e of l.getEntries()) loaf.push(e) })
    ob.observe({ type: 'long-animation-frame', buffered: false })
    const lt = []
    const ob2 = new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(e) })
    ob2.observe({ type: 'longtask', buffered: false })
    await new Promise((ok) => setTimeout(ok, 500))
    const b = window.__probe.b
    const fase0 = b ? { id: b.id, phase: b.phase, way: b.way?.idx ?? null, node: b.node } : null
    t0 = performance.now()
    if (b) window.__probe.follow(b); else window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }))
    await new Promise((ok) => setTimeout(ok, 5000))
    run = false; ob.disconnect(); ob2.disconnect()
    // atribución de programas nuevos: materiales de la escena que los usan
    const nuevos = gl.info.programs.filter((x) => !progs0.has(x))
    const uso = new Map()
    d.scene.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        const pp = gl.properties.get(m).programs
        if (!pp) continue
        for (const x of pp.values()) if (nuevos.includes(x)) {
          let l = uso.get(x); if (!l) uso.set(x, l = [])
          if (l.length < 3) { let path = []; for (let q = o; q && path.length < 4; q = q.parent) if (q.name) path.push(q.name); l.push(`${m.type}:${m.name || '-'} geo=${o.geometry?.name || '-'} ${o.isInstancedMesh ? 'inst' + o.count : ''} ${path.join('<')}`) }
        }
      }
    })
    // diferencia de clave frente al programa previo más parecido (misma longitud de partes, menos campos distintos)
    const viejos = [...progs0].map((x) => (x.cacheKey || '').split(','))
    const dif = (k) => { const a = k.split(','); let mejor = null; for (const v of viejos) { if (v.length !== a.length || v[0] !== a[0]) continue; const d = []; for (let i = 0; i < a.length; i++) if (a[i] !== v[i]) d.push(`${i}:${v[i].slice(0, 40)}->${a[i].slice(0, 40)}`); if (!mejor || d.length < mejor.length) mejor = d } return mejor ? mejor.slice(0, 6).join(' ') : 'sin par' }
    const progs = nuevos.map((x) => ({ t: x.__visto, name: x.name, key: (x.cacheKey || '').slice(0, 60), dif: dif(x.cacheKey || ''), uso: uso.get(x) ?? ['(fuera de escena: postFX/sombra)'] }))
    const a = fr.map((x) => x.ms); const s = [...a].sort((x, y) => y - x)
    const dur = fr.length ? (fr.at(-1).t + fr.at(-1).ms) / 1000 : 5
    return {
      pre: window.__precarga ? JSON.parse(JSON.stringify(window.__precarga)) : null, enlace: window.__enlace ?? null, tEntrada: Math.round(t0),
      fase0, peor: s.slice(0, 5).map(Math.round), fps: +(fr.length / dur).toFixed(1), prog: [progs0.size, gl.info.programs.length],
      geo: [fr[0]?.geo, fr.at(-1)?.geo], tex: [fr[0]?.tex, fr.at(-1)?.tex],
      largos: fr.filter((x) => x.ms > 50),
      progs,
      longtasks: lt.map((e) => ({ t: Math.round(e.startTime - t0), dur: Math.round(e.duration) })),
      loaf: loaf.filter((e) => e.duration > 50).map((e) => ({
        t: Math.round(e.startTime - t0), dur: Math.round(e.duration), block: Math.round(e.blockingDuration),
        render: Math.round(e.renderStart ? e.startTime + e.duration - e.renderStart : 0),
        scripts: e.scripts.filter((x) => x.duration > 5).map((x) => `${Math.round(x.duration)}ms ${x.invoker} ${x.sourceFunctionName}@${(x.sourceURL || '').split('/').pop()}:${x.sourceCharPosition}`),
      })),
    }
  }, caso)
  let top = null
  if (cdp) {
    const { profile } = await cdp.send('Profiler.stop')
    const byId = new Map(profile.nodes.map((n) => [n.id, n]))
    const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id)
    const self = new Map(); const incl = new Map()
    const name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`
    for (let i = 0; i < profile.samples.length; i++) {
      const dt = (profile.timeDeltas[i] ?? 0) / 1000
      let n = byId.get(profile.samples[i]); const k = name(n)
      self.set(k, (self.get(k) ?? 0) + dt)
      const vistos = new Set()
      while (n) { const kk = name(n); if (!vistos.has(kk)) { vistos.add(kk); incl.set(kk, (incl.get(kk) ?? 0) + dt) } n = byId.get(parent.get(n.id)) }
    }
    // tramos largos: muestras seguidas cuya pila pasa por la misma raíz de tarea (el bucle de r3f u otra), > 150 ms
    const raizDe = (n) => { let r = null; while (n) { const nm = n.callFrame.functionName; if (nm && nm !== '(root)') r = name(n); n = byId.get(parent.get(n.id)) } return r }
    const tramos = []; let cur = null
    for (let i = 0; i < profile.samples.length; i++) {
      const dt = (profile.timeDeltas[i] ?? 0) / 1000
      const n = byId.get(profile.samples[i]); const raiz = raizDe(n)
      if (n.callFrame.functionName === '(program)' || n.callFrame.functionName === '(garbage collector)') { if (cur) { cur.ms += dt; cur.incl.set(n.callFrame.functionName, (cur.incl.get(n.callFrame.functionName) ?? 0) + dt) } continue }
      if (!raiz || n.callFrame.functionName === '(idle)') { if (cur) { tramos.push(cur); cur = null } continue }
      if (!cur || cur.raiz !== raiz) { if (cur) tramos.push(cur); cur = { raiz, ms: 0, incl: new Map() } }
      cur.ms += dt
      const vistos = new Set(); let q = n
      while (q) { const kk = name(q); if (!vistos.has(kk)) { vistos.add(kk); cur.incl.set(kk, (cur.incl.get(kk) ?? 0) + dt) } q = byId.get(parent.get(q.id)) }
    }
    if (cur) tramos.push(cur)
    var largosCpu = tramos.filter((x) => x.ms > 150).map((x) => ({ raiz: x.raiz, ms: Math.round(x.ms), top: [...x.incl].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => `${v.toFixed(0)} ${k}`) }))
    const t = (m) => [...m].filter(([k]) => !k.startsWith('(idle)') && !k.startsWith('(program)') && !k.startsWith('(root)')).sort((x, y) => y[1] - x[1]).slice(0, 40).map(([k, v]) => `${v.toFixed(0)}ms ${k}`)
    top = { self: t(self), incl: t(incl), largos: largosCpu }
  }
  const out = { rep: r, caso, ...res, errores: errs.length, errs: errs.slice(0, 3), cpu: top }
  todo.push(out)
  console.log(JSON.stringify({ rep: r, caso, fase0: res.fase0, peor: res.peor, fps: res.fps, prog: res.prog, geo: res.geo, tex: res.tex, pre: res.pre, enlace: res.enlace, tEntrada: res.tEntrada, nLargos: res.largos.length, longtasks: res.longtasks, errores: errs.length }))
  await p.close()
}
if (salida) writeFileSync(salida, JSON.stringify(todo, null, 1))
} finally {
  clearTimeout(__guardia)
  await b.close().catch(() => {})
}
