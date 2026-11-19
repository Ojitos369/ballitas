// Sonda de la vista de planeta: sigue ballitas (tecla 3) y captura SOLO en fases de planeta (toDest, at, toPort)
// a 0.6, 2.5 y 6 s de cada fase, hasta cubrir N planetas distintos, en escritorio y en móvil vertical.
// Por captura anota fase real, planeta, bioma, FPS (rAF 0.8 s), draw calls y triángulos, % de bloques lisos,
// posición en pantalla de la ballita y si la tarjeta la tapa.
// uso: node planeta_vista.mjs <url> <carpeta> [viewport=desk|movil|ambos] [planetas=4] [segundos=240]
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { mkdirSync, writeFileSync } from 'node:fs'

const [url, dir, vpArg = 'ambos', nPlanArg = '4', secsArg = '240'] = process.argv.slice(2)
mkdirSync(dir, { recursive: true })
const PLANET = new Set(['toDest', 'at', 'toPort'])
const VPS = {
  desk: { viewport: { width: 1400, height: 900 } },
  movil: { viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.6, isMobile: true, hasTouch: true },
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function estado(p) {
  return p.evaluate(() => {
    const d = window.__ballitasDebug; const c = d?.cam; const b = c?.selected
    if (!b) return null
    const n = c.nodes?.[b.node]
    const bp = (c.bp ?? b.pos).clone().project(c.camera)
    const W = innerWidth; const H = innerHeight
    const sx = (bp.x * 0.5 + 0.5) * W; const sy = (-bp.y * 0.5 + 0.5) * H
    const card = document.querySelector('.tarjeta')?.getBoundingClientRect()
    const tapa = card ? (sx > card.left - 20 && sx < card.right + 20 && sy > card.top - 30 && sy < card.bottom + 30) : false
    // bioma: se lee del rótulo del planeta (subtítulo de la etiqueta)
    let bioma = ''
    for (const t of document.querySelectorAll('.tag.node')) {
      const s = t.querySelectorAll('span'); if (s[0]?.textContent.includes(n?.name)) bioma = s[1]?.textContent ?? ''
    }
    return { id: b.id, name: b.name, phase: b.phase, node: b.node, planeta: n?.name, bioma, dest: b.dest?.name, sx: Math.round(sx), sy: Math.round(sy), card: card ? [Math.round(card.left), Math.round(card.top), Math.round(card.width), Math.round(card.height)] : null, tapa }
  })
}

async function medir(p) {
  return p.evaluate(() => new Promise((res) => {
    const gl = window.__ballitasDebug.gl; let n = 0; const t0 = performance.now()
    const f = () => { n++; if (performance.now() - t0 < 800) requestAnimationFrame(f); else res({ fps: +(n * 1000 / (performance.now() - t0)).toFixed(1), calls: gl.info.render.calls, tris: gl.info.render.triangles }) }
    requestAnimationFrame(f)
  }))
}

// % de bloques de 16 px (CSS) casi uniformes y no oscuros: aproxima «plano liso» (el cielo negro no cuenta).
async function lisos(p, buf) {
  return p.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/jpeg;base64,' + b64; await img.decode()
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0)
    const { data } = cx.getImageData(0, 0, cv.width, cv.height)
    const B = Math.round(16 * img.width / innerWidth); let flat = 0; let tot = 0
    for (let y = 0; y + B <= cv.height; y += B) for (let x = 0; x + B <= cv.width; x += B) {
      let s = 0; let s2 = 0; let k = 0
      for (let yy = 0; yy < B; yy += 2) for (let xx = 0; xx < B; xx += 2) {
        const i = ((y + yy) * cv.width + x + xx) * 4; const l = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        s += l; s2 += l * l; k++
      }
      const m = s / k; const sd = Math.sqrt(Math.max(0, s2 / k - m * m)); tot++
      if (m > 28 && sd < 2.2) flat++
    }
    return +(100 * flat / tot).toFixed(1)
  }, buf.toString('base64'))
}

async function correr(vpName) {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,950', '--ignore-gpu-blocklist'] })
  const __guardia = setTimeout(() => { b.close().catch(() => {}).finally(() => process.exit(2)) }, 15 * 60 * 1000) // nunca deja un navegador abierto
  try {
  const ctx = await b.newContext(VPS[vpName])
  const p = await ctx.newPage()
  const errs = []
  p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message))
  await p.goto(url)
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 90000 })
  await sleep(8000)
  await p.keyboard.press('3')
  await sleep(1500)
  const filas = []; const planetas = new Set(); let shots = 0
  const t0 = Date.now(); const dots = await p.locator('.puntos .punto').count()
  let dot = 0; let ultimaFase = null; let ultimoId = null
  const capturar = async (tag, inicio, ms) => {
    const espera = inicio + ms - Date.now(); if (espera > 0) await sleep(espera)
    const s = await estado(p); if (!s || !PLANET.has(s.phase)) return false
    const buf = await p.screenshot({ type: 'jpeg', quality: 72 })
    const name = `${vpName}_${String(shots++).padStart(2, '0')}_${s.planeta}_${s.phase}_${ms}.jpg`
    writeFileSync(`${dir}/${name}`, buf)
    const m = await medir(p); const l = await lisos(p, buf)
    filas.push({ img: name, ...s, ...m, lisoPct: l, tag })
    planetas.add(s.planeta)
    return true
  }
  while (Date.now() - t0 < +secsArg * 1000 && (planetas.size < +nPlanArg || shots < 12)) {
    const s = await estado(p)
    if (s && PLANET.has(s.phase) && (s.id !== ultimoId || s.phase !== ultimaFase)) {
      const nueva = !planetas.has(s.planeta) || (shots < 12 && s.id === ultimoId)
      ultimoId = s.id; ultimaFase = s.phase
      if (nueva) {
        const inicio = Date.now()
        for (const ms of [600, 2500, 6000]) {
          const ok = await capturar(s.phase, inicio, ms)
          const s2 = await estado(p); if (!ok || !s2 || s2.phase !== s.phase) break
        }
        continue
      }
    }
    // la seguida no está en un planeta nuevo: probar otra ballita (los puntos del HUD cambian la seguida)
    if (!s || !PLANET.has(s.phase) || planetas.has(s.planeta)) {
      dot = (dot + 1) % Math.max(1, dots)
      try { await p.locator('.puntos .punto').nth(dot).click({ timeout: 2000 }) } catch {}
      await sleep(700)
      // si la nueva está en un planeta sin cubrir, dar tiempo a que la cámara termine de llegar
      const s3 = await estado(p)
      if (s3 && PLANET.has(s3.phase) && !planetas.has(s3.planeta)) { await sleep(2200); ultimoId = null }
    } else await sleep(250)
  }
  return { filas, errores: errs.slice(0, 8), nErr: errs.length }
  } finally {
    clearTimeout(__guardia)
    await b.close().catch(() => {})
  }
}

const out = {}
for (const vp of vpArg === 'ambos' ? ['desk', 'movil'] : [vpArg]) out[vp] = await correr(vp)
writeFileSync(`${dir}/resumen.json`, JSON.stringify(out, null, 1))
for (const [vp, r] of Object.entries(out)) {
  console.log(`== ${vp}: ${r.filas.length} capturas, ${new Set(r.filas.map((f) => f.planeta)).size} planetas, errores ${r.nErr}`)
  for (const f of r.filas) console.log(`${f.img}\t${f.bioma}\tdest=${f.dest}\tfps=${f.fps}\tcalls=${f.calls}\ttris=${f.tris}\tliso=${f.lisoPct}%\tball=(${f.sx},${f.sy})\ttapa=${f.tapa}\tcard=${f.card}`)
  if (r.errores.length) console.log('errores:', r.errores)
}
