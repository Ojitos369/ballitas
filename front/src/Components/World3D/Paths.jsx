import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'
import { VISUALS } from './themes.js'
import WorldHtml from './WorldHtml.jsx'
import { applyLoadedImage } from './texUtils.js'

const TAU = Math.PI * 2
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT = new THREE.Quaternion()
const SHARED_TIME = { value: 0 }

// ═══════════════════════════ TEXTURAS + FALLBACK PROCEDURAL ═══════════════════════════
const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const texCache = new Map()
const texLoader = new THREE.TextureLoader()

function makeCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  return c
}

function loadTex(filename, { srgb = false, repeat = [1, 1], clamp = false, makeFallback }) {
  const key = `${filename}:${srgb ? 1 : 0}:${repeat[0]},${repeat[1]}:${clamp ? 1 : 0}`
  if (texCache.has(key)) return texCache.get(key)

  const canvas = makeFallback()
  const tex = canvas
    ? new THREE.CanvasTexture(canvas)
    : new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.anisotropy = 8
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.needsUpdate = true

  if (filename) {
    texLoader.load(
      BASE_TEX + filename,
      (loaded) => {
        applyLoadedImage(tex, loaded?.image)
      },
      undefined,
      () => { /* conserva el fallback procedural */ }
    )
  }

  texCache.set(key, tex)
  return tex
}

function getFlowTex() {
  return loadTex('flow.png', {
    srgb: false,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(256, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < 4; i++) {
        const ox = i * 64 + 14
        const grad = ctx.createLinearGradient(ox - 12, 0, ox + 32, 0)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.65, 'rgba(255,255,255,0.85)')
        grad.addColorStop(1, 'rgba(255,255,255,0.15)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 7
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(ox, 12)
        ctx.lineTo(ox + 22, h * 0.5)
        ctx.lineTo(ox, h - 12)
        ctx.stroke()
      }
    }),
  })
}

function getSparkleTex() {
  return loadTex('sparkle.png', {
    srgb: false,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.65)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.ellipse(32, 32, 24, 2.2, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(32, 32, 2.2, 24, 0, 0, TAU)
      ctx.fill()
    }),
  })
}

function getFxSprayTex() {
  return loadTex('fx_spray.png', {
    clamp: true,
    makeFallback: () => makeCanvas(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5; const cy = h * 0.5
      const g = ctx.createRadialGradient(cx, cy, w * 0.03, cx, cy, w * 0.44)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.45, 'rgba(220,245,255,0.55)')
      g.addColorStop(1, 'rgba(200,240,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

function getFxSmokeTex() {
  return loadTex('fx_smoke.png', {
    clamp: true,
    makeFallback: () => makeCanvas(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const k = w / 64
      for (const [cx, cy, rad, a] of [[32, 34, 24, 0.45], [24, 28, 16, 0.35], [40, 28, 16, 0.35]]) {
        const g = ctx.createRadialGradient(cx * k, cy * k, 2 * k, cx * k, cy * k, rad * k)
        g.addColorStop(0, `rgba(255,255,255,${a})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
    }),
  })
}

function getFxEmberTex() {
  return loadTex('fx_ember.png', {
    clamp: true,
    makeFallback: () => makeCanvas(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5; const cy = h * 0.5
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.44)
      g.addColorStop(0, 'rgba(255,255,240,1)')
      g.addColorStop(0.28, 'rgba(255,190,90,0.9)')
      g.addColorStop(0.65, 'rgba(255,90,20,0.4)')
      g.addColorStop(1, 'rgba(255,40,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

function getFxFoamTex() {
  return loadTex('fx_foam.png', {
    clamp: true,
    makeFallback: () => makeCanvas(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const k = w / 64
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3 * k
      ctx.beginPath()
      ctx.arc(32 * k, 32 * k, 20 * k, 0, TAU)
      ctx.stroke()
      const g = ctx.createRadialGradient(26 * k, 26 * k, k, 32 * k, 32 * k, 22 * k)
      g.addColorStop(0, 'rgba(255,255,255,0.7)')
      g.addColorStop(0.7, 'rgba(255,255,255,0.18)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

function getFxRingTex() {
  return loadTex('fx_ring.png', {
    clamp: true,
    makeFallback: () => makeCanvas(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5; const cy = h * 0.5
      const g = ctx.createRadialGradient(cx, cy, w * 0.19, cx, cy, w * 0.44)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.45, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.75, 'rgba(255,255,255,0.45)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

const FX_TEX_GETTERS = {
  spray: getFxSprayTex,
  smoke: getFxSmokeTex,
  ember: getFxEmberTex,
  foam: getFxFoamTex,
  ring: getFxRingTex,
}

function getPanelAlbedoTex() {
  return loadTex('panel_albedo.png', {
    srgb: true,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#252d3d'
      ctx.fillRect(0, 0, w, h)
      // Grano metálico sutil
      const rng = mulberry32(4109)
      for (let i = 0; i < 420; i++) {
        ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.08)'
        ctx.fillRect(rng() * w, rng() * h, 12 + rng() * 48, 2)
      }
      // Placas modulares biseladas y ranuras oscuras
      const pads = [[16, 16, 228, 228], [268, 16, 228, 228], [16, 268, 228, 228], [268, 268, 228, 228]]
      for (const [x, y, pw, ph] of pads) {
        const g = ctx.createLinearGradient(x, y, x + pw, y + ph)
        g.addColorStop(0, '#364156')
        g.addColorStop(0.5, '#273042')
        g.addColorStop(1, '#1a202e')
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.roundRect(x, y, pw, ph, 14)
        ctx.fill()
        ctx.strokeStyle = '#0e131c'
        ctx.lineWidth = 5
        ctx.stroke()
        ctx.strokeStyle = 'rgba(170,210,255,0.16)'
        ctx.lineWidth = 2
        ctx.strokeRect(x + 12, y + 12, pw - 24, ph - 24)
        // Remaches en esquinas
        ctx.fillStyle = '#4e5d78'
        for (const [rx, ry] of [[x + 20, y + 20], [x + pw - 20, y + 20], [x + 20, y + ph - 20], [x + pw - 20, y + ph - 20]]) {
          ctx.beginPath()
          ctx.arc(rx, ry, 4, 0, TAU)
          ctx.fill()
        }
      }
    }),
  })
}

function getPanelNormalTex() {
  return loadTex('panel_normal.png', {
    srgb: false,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(512, 512, (ctx, w, h) => {
      const hf = new Float32Array(w * h)
      const pads = [[16, 16, 228, 228], [268, 16, 228, 228], [16, 268, 228, 228], [268, 268, 228, 228]]
      for (const [px, py, pw, ph] of pads) {
        for (let y = py; y < py + ph; y++) {
          for (let x = px; x < px + pw; x++) {
            const dx = Math.min(x - px, px + pw - 1 - x)
            const dy = Math.min(y - py, py + ph - 1 - y)
            const edge = Math.min(dx, dy)
            const bevel = Math.min(1, edge / 14)
            hf[y * w + x] = bevel * 0.75
            if (edge > 22 && edge < 28) hf[y * w + x] -= 0.22
          }
        }
      }
      const img = ctx.createImageData(w, h)
      const d = img.data
      for (let y = 0; y < h; y++) {
        const ym = (y - 1 + h) % h; const yp = (y + 1) % h
        for (let x = 0; x < w; x++) {
          const xm = (x - 1 + w) % w; const xp = (x + 1) % w
          const dx = (hf[y * w + xp] - hf[y * w + xm]) * 2.2
          const dy = (hf[yp * w + x] - hf[ym * w + x]) * 2.2
          const len = Math.hypot(dx, dy, 1)
          const idx = (y * w + x) * 4
          d[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
          d[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
          d[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
          d[idx + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }),
  })
}

function getPanelEmissiveTex() {
  return loadTex('panel_emissive.png', {
    srgb: true,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#ffffff'
      // Ranuras luminosas y micro-LEDs indicadores en blanco para teñir con aGlowColor
      for (const [x, y] of [[36, 46], [288, 46], [36, 298], [288, 298]]) {
        ctx.beginPath()
        ctx.roundRect(x, y, 188, 12, 6)
        ctx.fill()
        ctx.beginPath()
        ctx.roundRect(x + 28, y + 160, 74, 8, 4)
        ctx.fill()
        ctx.beginPath()
        ctx.arc(x + 150, y + 164, 7, 0, TAU)
        ctx.fill()
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.45)'
      ctx.lineWidth = 3
      ctx.strokeRect(250, 24, 12, 464)
    }),
  })
}

function getChevronsRainbowTex() {
  return loadTex('chevrons_rainbow.png', {
    srgb: true,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(256, 64, (ctx, w, h) => {
      // Base metálica oscura con rieles laterales y guías naranjas
      ctx.fillStyle = '#121824'
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = '#252e42'
      ctx.fillRect(0, 0, w, 6)
      ctx.fillRect(0, h - 6, w, 6)
      // Tiras luminosas de borde en naranja/ámbar cálido
      ctx.fillStyle = '#ff9d3b'
      ctx.fillRect(0, 6, w, 5)
      ctx.fillRect(0, h - 11, w, 5)
      // Pista central oscura con 2 paneles enmarcados y chevrones arcoíris hacia +X
      ctx.fillStyle = '#0c111c'
      ctx.fillRect(0, 12, w, h - 24)
      const cols = ['#ff4d79', '#ff9b3d', '#ffe64d', '#4dffb8', '#38d6ff', '#b366ff']
      for (let t = 0; t < 2; t++) {
        const px = t * 128 + 10
        ctx.fillStyle = '#171f30'
        ctx.strokeStyle = 'rgba(130, 185, 255, 0.28)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(px, 14, 108, h - 28, 6)
        ctx.fill()
        ctx.stroke()

        for (let k = 0; k < 3; k++) {
          const ox = px + 18 + k * 24
          const grad = ctx.createLinearGradient(0, 18, 0, h - 18)
          cols.forEach((c, idx) => grad.addColorStop(idx / (cols.length - 1), c))
          ctx.strokeStyle = grad
          ctx.lineWidth = 7
          ctx.lineCap = 'round'
          ctx.lineJoin = 'round'
          ctx.beginPath()
          ctx.moveTo(ox, 19)
          ctx.lineTo(ox + 18, h * 0.5)
          ctx.lineTo(ox, h - 19)
          ctx.stroke()
        }
      }
    }),
  })
}

function getLightbarTex() {
  return loadTex('lightbar.png', {
    srgb: false,
    clamp: true,
    makeFallback: () => makeCanvas(128, 16, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgba(255,255,255,0.05)')
      g.addColorStop(0.25, 'rgba(255,255,255,0.75)')
      g.addColorStop(0.5, 'rgba(255,255,255,1.0)')
      g.addColorStop(0.75, 'rgba(255,255,255,0.75)')
      g.addColorStop(1, 'rgba(255,255,255,0.05)')
      ctx.fillStyle = g
      ctx.fillRect(6, 1, w - 12, h - 2)
      // Clips oscuros en los extremos
      ctx.fillStyle = 'rgba(20,24,34,0.9)'
      ctx.fillRect(0, 0, 8, h)
      ctx.fillRect(w - 8, 0, 8, h)
    }),
  })
}

function getStreakTex() {
  return loadTex('streak.png', {
    srgb: false,
    clamp: true,
    makeFallback: () => makeCanvas(128, 16, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const gx = ctx.createLinearGradient(0, 0, w, 0)
      gx.addColorStop(0, 'rgba(255,255,255,0)')
      gx.addColorStop(0.45, 'rgba(210,245,255,0.45)')
      gx.addColorStop(0.85, 'rgba(255,255,255,0.98)')
      gx.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gx
      ctx.beginPath()
      ctx.moveTo(4, h * 0.5)
      ctx.quadraticCurveTo(w * 0.72, 1, w - 3, h * 0.5)
      ctx.quadraticCurveTo(w * 0.72, h - 1, 4, h * 0.5)
      ctx.fill()
    }),
  })
}

function getSparkTex() {
  return loadTex('spark.png', {
    srgb: false,
    clamp: true,
    makeFallback: () => makeCanvas(32, 32, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.3, 'rgba(255,220,160,0.85)')
      g.addColorStop(0.7, 'rgba(255,140,40,0.3)')
      g.addColorStop(1, 'rgba(255,90,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.beginPath()
      ctx.ellipse(16, 16, 13, 1.8, 0, 0, TAU)
      ctx.fill()
    }),
  })
}

function seedFromId(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

function texNormal(id) {
  return loadTex(`${id}_normal.png`, {
    srgb: false,
    repeat: [1, 2],
    makeFallback: () => makeCanvas(512, 512, (ctx, w, h) => {
      const rng = mulberry32(seedFromId(id) + 17)
      const hf = new Float32Array(w * h)
      for (let i = 0; i < 42; i++) {
        const y0 = rng() * h
        const dy = (rng() - 0.5) * 18
        const amp = (rng() - 0.5) * 0.45
        for (let x = 0; x < w; x++) {
          const y = ((Math.floor(y0 + (x / w) * dy) % h) + h) % h
          hf[y * w + x] += amp
        }
      }
      for (let i = 0; i < 55; i++) {
        const cx = rng() * w
        const cy = rng() * h
        const rad = 3 + rng() * 6
        const r2 = rad * rad
        for (let oy = -Math.ceil(rad); oy <= Math.ceil(rad); oy++) {
          for (let ox = -Math.ceil(rad); ox <= Math.ceil(rad); ox++) {
            const d2 = ox * ox + oy * oy
            if (d2 < r2) {
              const px = ((Math.floor(cx + ox) % w) + w) % w
              const py = ((Math.floor(cy + oy) % h) + h) % h
              hf[py * w + px] += (1 - d2 / r2) * 0.65
            }
          }
        }
      }
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          hf[y * w + x] += Math.sin((x / w) * TAU * 3 + Math.sin((y / h) * TAU * 2)) * 0.12
        }
      }
      const img = ctx.createImageData(w, h)
      const d = img.data
      for (let y = 0; y < h; y++) {
        const ym = (y - 1 + h) % h
        const yp = (y + 1) % h
        for (let x = 0; x < w; x++) {
          const xm = (x - 1 + w) % w
          const xp = (x + 1) % w
          const dx = (hf[y * w + xp] - hf[y * w + xm]) * 1.4
          const dy = (hf[yp * w + x] - hf[ym * w + x]) * 1.4
          const len = Math.hypot(dx, dy, 1)
          const idx = (y * w + x) * 4
          d[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
          d[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
          d[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
          d[idx + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }),
  })
}

function texAlbedo(id) {
  return loadTex(`${id}_albedo.png`, {
    srgb: true,
    repeat: [1, 2],
    makeFallback: () => makeCanvas(512, 512, (ctx, w, h) => {
      const V = VISUALS[id]
      const rng = mulberry32(seedFromId(id) + 31)
      ctx.fillStyle = '#eef4ff'
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 0.22
      for (let i = 0; i < 24; i++) {
        ctx.strokeStyle = i % 2 === 0 ? V.glass : V.rib
        ctx.lineWidth = 2 + rng() * 8
        const y = rng() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(w * 0.33, y + (rng() - 0.5) * 30, w * 0.66, y + (rng() - 0.5) * 30, w, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }),
  })
}

function texEmissive(id) {
  return loadTex(`${id}_emissive.png`, {
    srgb: true,
    repeat: [1, 2],
    makeFallback: () => makeCanvas(512, 512, (ctx, w, h) => {
      const V = VISUALS[id]
      const rng = mulberry32(seedFromId(id) + 73)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = V.rail
      ctx.globalAlpha = 0.35
      for (let i = 0; i < 12; i++) {
        ctx.lineWidth = 1.5 + rng() * 2.5
        const y = rng() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y + (rng() - 0.5) * 18)
        ctx.stroke()
      }
      ctx.fillStyle = V.rib
      for (let i = 0; i < 20; i++) {
        ctx.beginPath()
        ctx.arc(rng() * w, rng() * h, 1.5 + rng() * 2.5, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }),
  })
}

const SIGN_ROWS = 5
const SIGN_CELLS = {
  salida: [0, 0, '🚀', 'SALIDA', '#4fc3f7'],
  llegada: [1, 0, '🏁', 'META', '#81c784'],
  rampa: [2, 0, '🛝', 'RAMPA', '#90caf9'],
  zigzag: [3, 0, '〰', 'ZIGZAG', '#ce93d8'],
  rizo: [0, 1, '➰', 'RIZO', '#ffab91'],
  sacacorchos: [1, 1, '🧬', 'HELICE', '#80cbc4'],
  trampolin: [2, 1, '🤸', 'SALTO', '#fff59d'],
  canon: [3, 1, '💥', 'CAÑÓN', '#ff8a65'],
  espiral: [0, 2, '🌀', 'ESPIRAL', '#b39ddb'],
  caida: [1, 2, '🪂', 'CAÍDA', '#ef9a9a'],
  cascada: [2, 2, '💧', 'CASCADA', '#80deea'],
  embudo: [3, 2, '🌪', 'EMBUDO', '#ffcc80'],
  geiser: [0, 3, '⛲', 'GÉISER', '#4fe3ff'],
  erupcion: [1, 3, '🌋', 'ERUPCIÓN', '#ff7043'],
  turbina: [2, 3, '💨', 'TURBINA', '#fff176'],
  hielo_resbaloso: [3, 3, '🧊', 'HIELO', '#81d4fa'],
  pantano: [0, 4, '🫧', 'PANTANO', '#aed581'],
  portal: [1, 4, '✨', 'PORTAL', '#ea80fc'],
}

function getSignAtlasTex() {
  return loadTex(null, {
    srgb: true,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(512, 640, (ctx) => {
      ctx.clearRect(0, 0, 512, 640)
      for (const [col, row, icon, label, accent] of Object.values(SIGN_CELLS)) {
        const x = col * 128
        const y = row * 128
        ctx.fillStyle = 'rgba(14, 18, 34, 0.92)'
        ctx.strokeStyle = accent
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.roundRect(x + 8, y + 18, 112, 92, 14)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 34px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(icon, x + 64, y + 50)
        ctx.fillStyle = accent
        ctx.font = 'bold 17px sans-serif'
        ctx.fillText(label, x + 64, y + 88)
      }
    }),
  })
}

// ═══════════════════════════ GEOMETRÍAS COMPARTIDAS ═══════════════════════════
const base = (g) => (g.translate(0, 0.5, 0), g)

function buildRibFrameGeo() {
  const pts = [
    new THREE.Vector2(0.985, -0.10),
    new THREE.Vector2(1.03, -0.12),
    new THREE.Vector2(1.078, -0.10),
    new THREE.Vector2(1.078, -0.045),
    new THREE.Vector2(1.045, -0.03),
    new THREE.Vector2(1.045, 0.03),
    new THREE.Vector2(1.078, 0.045),
    new THREE.Vector2(1.078, 0.10),
    new THREE.Vector2(1.03, 0.12),
    new THREE.Vector2(0.985, 0.10),
    new THREE.Vector2(0.985, -0.10),
  ]
  const g = new THREE.LatheGeometry(pts, 22)
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

function buildCurvedPanelGeo(arcHalf = 0.37, rIn = 0.992, rOut = 1.055, segs = 6) {
  const pos = []
  const uv = []
  const idx = []
  const pushRing = (r, z) => {
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const a = -arcHalf + t * arcHalf * 2
      pos.push(Math.sin(a) * r, Math.cos(a) * r, z)
      uv.push(z + 0.5, t)
    }
  }
  // 4 arcos: 0=in-back, 1=in-front, 2=out-back, 3=out-front
  pushRing(rIn, -0.5)
  pushRing(rIn, 0.5)
  pushRing(rOut, -0.5)
  pushRing(rOut, 0.5)
  const stride = segs + 1
  for (let i = 0; i < segs; i++) {
    const ib0 = i; const ib1 = i + 1
    const if0 = stride + i; const if1 = stride + i + 1
    const ob0 = stride * 2 + i; const ob1 = stride * 2 + i + 1
    const of0 = stride * 3 + i; const of1 = stride * 3 + i + 1
    // Cara interior (mira hacia el centro del tubo)
    idx.push(ib0, if0, if1, ib0, if1, ib1)
    // Cara exterior
    idx.push(ob0, ob1, of1, ob0, of1, of0)
    // Tapas frontal y trasera
    idx.push(if0, of0, of1, if0, of1, if1)
    idx.push(ib0, ib1, ob1, ib0, ob1, ob0)
  }
  // Tapas laterales
  idx.push(0, stride * 2, stride * 3, 0, stride * 3, stride)
  idx.push(segs, stride + segs, stride * 3 + segs, segs, stride * 3 + segs, stride * 2 + segs)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function buildLightBarGeo() {
  const g = new THREE.CylinderGeometry(0.028, 0.028, 1.0, 6, 1, false)
  g.rotateX(Math.PI / 2)
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i); const v = uv.getY(i)
    uv.setXY(i, v, u)
  }
  uv.needsUpdate = true
  return g
}

function buildStreakCardGeo() {
  const p1 = new THREE.PlaneGeometry(1.0, 0.14)
  const p2 = new THREE.PlaneGeometry(1.0, 0.14)
  p2.rotateX(Math.PI / 2)
  return mergeGeometries([p1, p2])
}

function buildBoltGeo() {
  const pts = [
    [0, 0, -0.5],
    [0.14, 0.08, -0.18],
    [-0.14, -0.06, 0.18],
    [0, 0, 0.5],
  ]
  const parts = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = new THREE.Vector3(...pts[i])
    const b = new THREE.Vector3(...pts[i + 1])
    const dir = b.clone().sub(a)
    const len = dir.length()
    const seg = new THREE.CylinderGeometry(0.022, 0.022, len, 5)
    seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.normalize()))
    seg.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5)
    parts.push(seg)
  }
  return mergeGeometries(parts)
}

const GEO = {
  cone: base(new THREE.ConeGeometry(0.5, 1, 10)),
  funnel: base(new THREE.ConeGeometry(0.5, 1, 28, 1, true)),
  cyl: base(new THREE.CylinderGeometry(0.5, 0.5, 1, 10)),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  box: base(new THREE.BoxGeometry(1, 1, 1)),
  octa: base(new THREE.OctahedronGeometry(0.5)),
  torus: new THREE.TorusGeometry(1, 0.04, 6, 32), // radio 1: se escala al radio del tubo
  ribNeon: new THREE.TorusGeometry(1, 0.025, 8, 32),
  mouthNeon: new THREE.TorusGeometry(1, 0.056, 8, 32),
  ribFrame: buildRibFrameGeo(),
  panelPod: buildCurvedPanelGeo(),
  lightBar: buildLightBarGeo(),
  streakCard: buildStreakCardGeo(),
  bolt: buildBoltGeo(),
  blade: (() => {
    const g = new THREE.BoxGeometry(0.18, 1.0, 0.04)
    g.translate(0, 0.5, 0)
    return g
  })(),
  banner: (() => {
    const g = new THREE.ConeGeometry(0.32, 0.72, 3)
    g.rotateX(Math.PI)
    g.translate(0, -0.36, 0)
    return g
  })(),
  arrow: (() => {
    const g = new THREE.ConeGeometry(0.28, 0.65, 4)
    g.rotateX(Math.PI / 2)
    return g
  })(),
  sign: new THREE.PlaneGeometry(1.45, 0.72),
}
const GEO_BY = { cone: GEO.cone, cyl: GEO.cyl, sphere: GEO.sphere, box: GEO.box, octa: GEO.octa, torus: GEO.torus }

// ═══════════════════════════ MATERIALES Y SHADERS POR WAY ═══════════════════════════
// Multiplicadores moderados (1.1-1.35 base, ~1.9 solo en pulsos y bocas) para que el bloom no blanquee el color del tema.
const hot = (c, k = 1.25) => new THREE.Color(c).multiplyScalar(k)

function createTubeMat(id, focusU) {
  const V = VISUALS[id]
  const atmo = V.cine?.atmo ?? { mode: 0, c1: V.glass, c2: V.rail }
  const m = new THREE.MeshPhysicalMaterial({
    color: V.glass,
    vertexColors: true,
    map: texAlbedo(id),
    normalMap: texNormal(id),
    normalScale: new THREE.Vector2(0.45, 0.45),
    emissive: new THREE.Color(V.rail),
    emissiveMap: texEmissive(id),
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.19,
    roughness: 0.07,
    metalness: 0.08,
    envMapIntensity: 1.5,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFocus = focusU
    shader.uniforms.uFlowMap = { value: getFlowTex() }
    shader.uniforms.uThemeColor = { value: new THREE.Color(V.rail) }
    shader.uniforms.uGlassColor = { value: new THREE.Color(V.glass) }
    shader.uniforms.uAtmoMode = { value: atmo.mode ?? 0 }
    shader.uniforms.uAtmoA = { value: new THREE.Color(atmo.c1 ?? V.glass) }
    shader.uniforms.uAtmoB = { value: new THREE.Color(atmo.c2 ?? V.rail) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTubeUv;\nvarying vec3 vTubeWorldNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTubeUv = uv;\nvec3 wTubeNorm = mat3(modelMatrix) * objectNormal;\nvTubeWorldNormal = length(wTubeNorm) > 1e-5 ? normalize(wTubeNorm) : vec3(0.0, 1.0, 0.0);')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uTime;
        uniform float uFocus;
        uniform sampler2D uFlowMap;
        uniform vec3 uThemeColor;
        uniform vec3 uGlassColor;
        uniform float uAtmoMode;
        uniform vec3 uAtmoA;
        uniform vec3 uAtmoB;
        varying vec2 vTubeUv;
        varying vec3 vTubeWorldNormal;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float focusGlow = mix(0.08, 1.0, uFocus);
        vec3 tubeViewDir = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
        vec3 tubeNorm = length(normal) > 1e-5 ? normalize(normal) : vec3(0.0, 1.0, 0.0);
        float tubeFresnel = pow(max(1e-4, 1.0 - abs(dot(tubeNorm, tubeViewDir))), 2.3);
        vec2 flowUv = vec2(fract(vTubeUv.x * 0.45 - uTime * 0.75), fract(vTubeUv.y * 2.0));
        vec4 flowTex = texture2D(uFlowMap, flowUv);
        float wavePulse = smoothstep(0.55, 1.0, sin(vTubeUv.x * 1.4 - uTime * 3.2) * 0.5 + 0.5);
        float flowMask = flowTex.a * (0.35 + 0.55 * wavePulse);
        float baseGrime = smoothstep(-0.25, -0.85, vTubeWorldNormal.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + vec3(0.05, 0.04, 0.03), baseGrime * 0.45);

        // Costuras sutiles de módulos de cristal y ambiente específico por tema (0..9)
        float seamX = smoothstep(0.95, 1.0, abs(cos(vTubeUv.x * 3.14159 * 0.9)));
        float seamY = smoothstep(0.96, 1.0, abs(cos(vTubeUv.y * 6.28318 * 4.0)));
        float seamMask = max(seamX, seamY) * 0.14;
        vec3 atmoGlow = vec3(0.0);
        float atmoAlpha = 0.0;

        if (uAtmoMode < 0.5) {
          // 0 sombrio: niebla violeta ondulante
          float fogWave = sin(vTubeUv.x * 1.1 - uTime * 0.8 + sin(vTubeUv.y * 12.56)) * 0.5 + 0.5;
          atmoGlow = mix(uAtmoA, uAtmoB, fogWave) * (0.28 * fogWave);
          atmoAlpha = fogWave * 0.08;
        } else if (uAtmoMode < 1.5) {
          // 1 bosque: reflejos orgánicos de dosel
          float dapple = sin(vTubeUv.x * 2.2 + vTubeUv.y * 18.84 + uTime * 0.7) * cos(vTubeUv.x * 1.3 - uTime * 0.5);
          float m = smoothstep(0.2, 0.85, dapple * 0.5 + 0.5);
          atmoGlow = mix(uAtmoA, uAtmoB, m) * 0.22 * m;
        } else if (uAtmoMode < 2.5) {
          // 2 mar: cáusticas acuáticas animadas
          float c1 = sin(vTubeUv.x * 3.6 - uTime * 1.4 + sin(vTubeUv.y * 18.84 + uTime));
          float c2 = cos(vTubeUv.x * 2.8 + vTubeUv.y * 25.12 - uTime * 1.8);
          float caust = pow(clamp(1.0 - abs(c1 + c2) * 0.45, 0.0, 1.0), 3.0);
          atmoGlow = mix(uAtmoA, uAtmoB, caust) * caust * 0.45;
          atmoAlpha = caust * 0.08;
        } else if (uAtmoMode < 3.5) {
          // 3 desierto: ondas de calor y arena flotante
          float shimmer = sin(vTubeUv.x * 4.0 - uTime * 3.8 + sin(vTubeUv.y * 12.56) * 2.0) * 0.5 + 0.5;
          float sandBand = smoothstep(0.55, 0.98, shimmer) * (0.4 + 0.6 * smoothstep(0.2, -0.6, vTubeWorldNormal.y));
          atmoGlow = mix(uAtmoA, uAtmoB, sandBand) * sandBand * 0.3;
        } else if (uAtmoMode < 4.5) {
          // 4 hielo: escarcha cristalina en bordes de costuras
          float frostNoise = sin(vTubeUv.x * 11.0) * cos(vTubeUv.y * 37.7) * 0.5 + 0.5;
          float frost = clamp(seamMask * 2.4 + frostNoise * tubeFresnel * 0.7, 0.0, 1.0);
          atmoGlow = mix(uAtmoA, uAtmoB, frost) * frost * 0.38;
          atmoAlpha = frost * 0.1;
        } else if (uAtmoMode < 5.5) {
          // 5 volcan: grietas incandescentes de lava en la parte baja
          float crack = pow(clamp(1.0 - abs(sin(vTubeUv.x * 2.9 + sin(vTubeUv.y * 18.84) * 1.6)), 0.0, 1.0), 5.0);
          float pulse = 0.65 + 0.35 * sin(uTime * 2.4 + vTubeUv.x * 1.7);
          float lowMask = smoothstep(0.35, -0.75, vTubeWorldNormal.y);
          atmoGlow = mix(uAtmoA, uAtmoB, crack) * crack * lowMask * pulse * 0.72;
        } else if (uAtmoMode < 6.5) {
          // 6 cristal: dispersión prismática iridiscente
          float irid = fract(tubeFresnel * 1.8 + vTubeUv.x * 0.25 + uTime * 0.12);
          vec3 prismCol = 0.5 + 0.5 * cos(6.28318 * (irid + vec3(0.0, 0.33, 0.67)));
          atmoGlow = mix(uAtmoA, prismCol, 0.65) * tubeFresnel * 0.48;
        } else if (uAtmoMode < 7.5) {
          // 7 nubes: bruma luminosa y destellos de rayos
          float cloudWisp = sin(vTubeUv.x * 1.5 - uTime * 0.9) * cos(vTubeUv.y * 6.28318 + uTime * 0.4) * 0.5 + 0.5;
          float bolt = pow(max(0.0, sin(uTime * 5.2 + vTubeUv.x * 2.7)), 14.0) * smoothstep(0.7, 1.0, sin(vTubeUv.y * 25.12));
          atmoGlow = uAtmoA * cloudWisp * 0.2 + uAtmoB * bolt * 0.95;
          atmoAlpha = cloudWisp * 0.08;
        } else if (uAtmoMode < 8.5) {
          // 8 neon: cuadrícula de circuitos cibernéticos
          float gx = smoothstep(0.92, 1.0, abs(cos(vTubeUv.x * 6.28318 * 1.2)));
          float gy = smoothstep(0.92, 1.0, abs(cos(vTubeUv.y * 6.28318 * 8.0)));
          float grid = max(gx, gy);
          float scan = pow(max(0.0, sin(vTubeUv.x * 1.8 - uTime * 4.0)), 4.0);
          atmoGlow = mix(uAtmoA, uAtmoB, scan) * grid * (0.32 + 0.45 * scan);
        } else {
          // 9 jardin: destello nacarado floral suave
          float petalGlow = sin(vTubeUv.x * 1.8 - uTime * 1.1 + vTubeUv.y * 12.56) * 0.5 + 0.5;
          atmoGlow = mix(uAtmoA, uAtmoB, petalGlow) * tubeFresnel * 0.32;
        }

        vec3 activeAccent = uThemeColor;
        #ifdef USE_COLOR
          float hasEvCol = clamp((1.0 - min(vColor.r, min(vColor.g, vColor.b))) * 2.5, 0.0, 1.0);
          activeAccent = mix(uThemeColor, vColor, hasEvCol * 0.72);
        #endif

        totalEmissiveRadiance = totalEmissiveRadiance * focusGlow
          + (uGlassColor * tubeFresnel * 0.32 + activeAccent * (flowMask * 0.65 + seamMask * 0.5) + atmoGlow) * focusGlow;`
      )
      .replace(
        '#include <dithering_fragment>',
        `float tubeLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(vec3(tubeLum), gl_FragColor.rgb, mix(0.25, 1.0, uFocus)) * mix(0.28, 1.0, uFocus);
        gl_FragColor.a = clamp(gl_FragColor.a + tubeFresnel * 0.28 + flowMask * 0.35 + baseGrime * 0.12 + seamMask * 0.3 + atmoAlpha, 0.0, 0.88) * mix(0.15, 1.0, uFocus);
        #include <dithering_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'tube-flow-atmo-v4'
  return m
}

function createRailMat(focusU) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFocus = focusU
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRailUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRailUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uFocus;\nvarying vec2 vRailUv;')
      .replace(
        '#include <opaque_fragment>',
        `float railPulse = pow(max(1e-4, sin(vRailUv.x * 1.6 - uTime * 3.6) * 0.5 + 0.5), 4.0) * uFocus;
        vec3 railLit = outgoingLight * (1.0 + railPulse * 0.72);
        float railLum = dot(railLit, vec3(0.299, 0.587, 0.114));
        outgoingLight = mix(vec3(railLum), railLit, mix(0.25, 1.0, uFocus)) * mix(0.18, 1.0, uFocus);
        diffuseColor.a *= mix(0.14, 1.0, uFocus);
        #include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'rail-pulse-focus-v3'
  return m
}

function withFocusFade(mat, focusU, minAlpha = 0.16, minBright = 0.25, minSat = 0.25) {
  mat.transparent = true
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''
  const focusParams = { value: new THREE.Vector3(minAlpha, minBright, minSat) }
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer)
    shader.uniforms.uFocus = focusU
    shader.uniforms.uFocusParams = focusParams
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFocus;\nuniform vec3 uFocusParams;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        float _fLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(vec3(_fLum), gl_FragColor.rgb, mix(uFocusParams.z, 1.0, uFocus)) * mix(uFocusParams.y, 1.0, uFocus);
        gl_FragColor.a *= mix(uFocusParams.x, 1.0, uFocus);`
      )
  }
  mat.customProgramCacheKey = () => `${prevKey ? `${prevKey}|` : ''}focus-fade-v1`
  return mat
}

/** Desvanece por dither los props cercanos a la cámara para evitar que tapen la vista. */
export function withCameraFade(mat, minDist = 1.6, maxDist = 3.0) {
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''
  const fadeParams = { value: new THREE.Vector2(minDist, maxDist) }
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer)
    shader.uniforms.uCamFade = fadeParams
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vCamFragDist;\nvarying float vCamInstDist;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vCamFragDist = length(mvPosition.xyz);
        vec4 _cfCenter = vec4(0.0, 0.0, 0.0, 1.0);
        #ifdef USE_INSTANCING
          _cfCenter = instanceMatrix * _cfCenter;
        #endif
        _cfCenter = modelViewMatrix * _cfCenter;
        vCamInstDist = length(_cfCenter.xyz);`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform vec2 uCamFade;
        varying float vCamFragDist;
        varying float vCamInstDist;
        float _cfIgn(vec2 p) {
          return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
        }`
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        if (uCamFade.y > 0.0) {
          float _cfDist = min(vCamFragDist, vCamInstDist);
          if (_cfDist < uCamFade.y) {
            float _cf = smoothstep(uCamFade.x, uCamFade.y, _cfDist);
            if (_cf <= 0.001 || _cf < _cfIgn(gl_FragCoord.xy)) discard;
          }
        }`
      )
  }
  mat.customProgramCacheKey = () => `${prevKey ? `${prevKey}|` : ''}cam-fade-v1`
  return mat
}

function createSignMat(focusU) {
  const m = new THREE.MeshBasicMaterial({ map: getSignAtlasTex(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUvOffset;\nvarying vec2 vSignUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSignUv = uv * vec2(0.25, 0.2) + aUvOffset;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSignUv;')
      .replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D( map, vSignUv );\ndiffuseColor *= sampledDiffuseColor;')
  }
  m.customProgramCacheKey = () => 'sign-atlas-v2'
  return withFocusFade(m, focusU, 0.16, 0.28, 0.25)
}

function createPartsMat(id, focusU) {
  const { c, s, vy = 0, vx = 0.15, amp = 0.5, freq = 1.4, a = 0.6, glow = 1.25 } = VISUALS[id].parts
  const m = new THREE.PointsMaterial({
    color: hot(c, glow),
    map: getSparkleTex(),
    size: s * 3.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: a,
    alphaTest: 0.02,
    depthWrite: false,
    toneMapped: false,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uMotion = { value: new THREE.Vector3(vx, vy, amp) }
    shader.uniforms.uFreq = { value: freq }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uMotion;\nuniform float uFreq;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float pSeed = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float pPhase = pSeed * 6.2831853;
        if (abs(uMotion.y) > 0.2) {
          float span = 4.0;
          float drift = fract(uTime * abs(uMotion.y) * 0.18 + pSeed) * span - span * 0.5;
          transformed.y += (uMotion.y > 0.0 ? drift : -drift);
        } else {
          transformed.y += sin(uTime * uFreq + pPhase) * uMotion.z * 0.55;
        }
        transformed.x += sin(uTime * uFreq * 0.8 + pPhase) * uMotion.z + uMotion.x * sin(uTime * 0.7 + pSeed * 3.14);
        transformed.z += cos(uTime * uFreq * 0.9 + pPhase * 1.3) * uMotion.z;`
      )
  }
  m.customProgramCacheKey = () => 'parts-motion-v1'
  return withFocusFade(m, focusU, 0.15, 0.2, 0.25)
}

// Shader único y barato para todas las partículas de eventos (géiser, erupción, cascada, turbina, hielo, pantano, portal).
// aParam: x=mode (0..6), y=seed (0..1), z=speed, w=baseSize
const FX_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute vec4 aParam;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float mode = aParam.x;
    float seed = aParam.y;
    float spd = aParam.z;
    float sz = aParam.w;
    vec3 p = position;
    float alpha = 1.0;

    if (mode < 0.5) {
      // 0: géiser — chorro en pulsos que sube y cae
      float cycle = fract(uTime * 0.48 + seed * 0.15);
      float burst = smoothstep(0.0, 0.22, cycle) * (1.0 - smoothstep(0.55, 0.95, cycle));
      float h = sin(cycle * 3.14159) * (1.8 + seed * 3.2);
      p += aDir * h + vec3(cos(seed * 41.0) * 0.25, 0.0, sin(seed * 37.0) * 0.25) * cycle;
      alpha = burst * 0.92;
    } else if (mode < 1.5) {
      // 1: erupción — brasas y humo en pulsos rítmicos
      float life = fract(uTime * spd + seed);
      p += aDir * (life * 3.6) + vec3(sin(uTime * 2.0 + seed * 19.0) * 0.28, life * life * -0.9, cos(uTime * 1.8 + seed * 23.0) * 0.28);
      alpha = sin(life * 3.14159) * 0.95;
    } else if (mode < 2.5) {
      // 2: cascada — cortina de agua y gotas cayendo
      float life = fract(uTime * spd + seed);
      p.y -= life * 3.8;
      p.x += sin(life * 6.28 + seed * 13.0) * 0.14;
      alpha = sin(life * 3.14159) * 0.85;
    } else if (mode < 3.5) {
      // 3: turbina — rayas de viento a lo largo de aDir
      float life = fract(uTime * spd + seed);
      p += aDir * ((life - 0.35) * 4.5);
      alpha = sin(life * 3.14159) * 0.8;
    } else if (mode < 4.5) {
      // 4: hielo — brillos centelleantes
      float tw = pow(max(1e-4, sin(uTime * spd + seed * 12.56) * 0.5 + 0.5), 3.0);
      alpha = 0.15 + tw * 0.85;
      sz *= (0.7 + tw * 0.7);
    } else if (mode < 5.5) {
      // 5: pantano — burbujas lentas que suben y estallan
      float life = fract(uTime * spd + seed);
      p += aDir * (life * 1.4);
      alpha = (1.0 - smoothstep(0.78, 1.0, life)) * smoothstep(0.0, 0.15, life) * 0.85;
      sz *= (0.55 + life * 0.85);
    } else {
      // 6: portal — espiral convergente
      float life = fract(uTime * spd + seed);
      float ang = seed * 6.28318 + uTime * 3.2 + life * 4.0;
      float rad = (1.0 - life) * 1.65;
      vec3 upRef = abs(aDir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 cSide = cross(aDir, upRef);
      vec3 side = dot(cSide, cSide) > 1e-6 ? normalize(cSide) : vec3(1.0, 0.0, 0.0);
      vec3 bin = cross(aDir, side);
      p += (side * cos(ang) + bin * sin(ang)) * rad;
      alpha = sin(life * 3.14159) * 0.9;
    }

    vColor = aColor;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = sz * (320.0 / max(-mvPosition.z, 0.5));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FX_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uFocus;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uTex, gl_PointCoord);
    float a = tex.a * vAlpha * mix(0.14, 1.0, uFocus);
    if (a < 0.02) discard;
    vec3 col = vColor * tex.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, mix(0.25, 1.0, uFocus)) * mix(0.22, 1.0, uFocus);
    gl_FragColor = vec4(col, a);
  }
`

function createEventFxMat(texKey, focusU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uTex: { value: FX_TEX_GETTERS[texKey]() },
    },
    vertexShader: FX_VERT,
    fragmentShader: FX_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: texKey === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
  })
}

function createFloorMat(focusU) {
  const m = new THREE.MeshStandardMaterial({
    map: getChevronsRainbowTex(),
    roughness: 0.42,
    metalness: 0.52,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 1.0,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aFloorMeta;\nattribute vec3 aFloorAccent;\nvarying vec2 vFloorUv;\nvarying vec3 vFloorMeta;\nvarying vec3 vFloorAccent;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFloorUv = uv;\nvFloorMeta = aFloorMeta;\nvFloorAccent = aFloorAccent;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vFloorUv;\nvarying vec3 vFloorMeta;\nvarying vec3 vFloorAccent;')
      .replace(
        '#include <map_fragment>',
        `vec2 fUv = vec2(fract(vFloorUv.x - uTime * vFloorMeta.x), vFloorUv.y);
        vec4 sampledFloor = texture2D(map, fUv);
        diffuseColor *= sampledFloor;`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `vec2 feUv = vec2(fract(vFloorUv.x - uTime * vFloorMeta.x), vFloorUv.y);
        vec4 feTex = texture2D(map, feUv);
        float chevLum = max(feTex.r, max(feTex.g, feTex.b));
        float railMask = smoothstep(0.24, 0.14, feUv.y) + smoothstep(0.76, 0.86, feUv.y);
        float centerMask = smoothstep(0.22, 0.3, feUv.y) * smoothstep(0.78, 0.7, feUv.y);
        float glowMask = smoothstep(0.26, 0.56, chevLum);
        vec3 warmCol = mix(feTex.rgb, feTex.rgb * vec3(1.18, 0.92, 0.65), vFloorMeta.z * 0.55);
        vec3 railEmissive = mix(feTex.rgb, vFloorAccent, 0.55) * railMask * glowMask * 1.15;
        vec3 chevEmissive = warmCol * centerMask * glowMask * vFloorMeta.y;
        totalEmissiveRadiance = (railEmissive + chevEmissive);`
      )
  }
  m.customProgramCacheKey = () => 'floor-chevron-v1'
  return withFocusFade(m, focusU, 0.16, 0.25, 0.25)
}

function createPanelMat(focusU) {
  const m = new THREE.MeshStandardMaterial({
    map: getPanelAlbedoTex(),
    normalMap: getPanelNormalTex(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: getPanelEmissiveTex(),
    emissiveIntensity: 1.15,
    roughness: 0.36,
    metalness: 0.72,
  })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aGlowColor;\nvarying vec3 vPanelGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanelGlow = aGlowColor;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vPanelGlow;')
  }
  m.customProgramCacheKey = () => 'panel-hull-v1'
  return withCameraFade(withFocusFade(m, focusU, 0.16, 0.28, 0.25), 0.85, 1.55)
}

function createHullMat(focusU) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.78 })
  return withCameraFade(withFocusFade(m, focusU, 0.16, 0.28, 0.25), 0.85, 1.55)
}

function createLightBarMat(focusU) {
  const m = new THREE.MeshBasicMaterial({
    map: getLightbarTex(),
    transparent: true,
    alphaTest: 0.05,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return withCameraFade(withFocusFade(m, focusU, 0.14, 0.2, 0.25), 0.65, 1.35)
}

const STREAK_VERT = /* glsl */ `
  attribute vec4 aStreak;
  attribute vec3 aStreakCol;
  uniform float uTime;
  varying vec2 vStreakUv;
  varying float vStreakAlpha;
  varying vec3 vStreakCol;

  void main() {
    float seed = aStreak.x;
    float spd = aStreak.y;
    float span = aStreak.z;
    float alpha = aStreak.w;

    float life = fract(uTime * spd + seed);
    float fade = sin(life * 3.14159265);
    vec3 localPos = position;
    localPos.x += (life - 0.5) * span;

    vec4 mvPos = vec4(localPos, 1.0);
    #ifdef USE_INSTANCING
      mvPos = instanceMatrix * mvPos;
    #endif
    mvPos = modelViewMatrix * mvPos;

    vStreakUv = uv;
    vStreakAlpha = alpha * fade;
    vStreakCol = aStreakCol;
    gl_Position = projectionMatrix * mvPos;
  }
`

const STREAK_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uFocus;
  varying vec2 vStreakUv;
  varying float vStreakAlpha;
  varying vec3 vStreakCol;

  void main() {
    vec4 tex = texture2D(uTex, vStreakUv);
    float a = tex.a * vStreakAlpha * mix(0.12, 1.0, uFocus);
    if (a < 0.015) discard;
    vec3 col = vStreakCol * tex.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, mix(0.25, 1.0, uFocus)) * mix(0.22, 1.0, uFocus);
    gl_FragColor = vec4(col, a);
  }
`

function createWindStreakMat(focusU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uTex: { value: getStreakTex() },
    },
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })
}

const SPARK_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute vec4 aParam;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float seed = aParam.x;
    float spd = aParam.y;
    float span = aParam.z;
    float sz = aParam.w;

    float life = fract(uTime * spd + seed);
    float fade = sin(life * 3.14159265);
    vec3 p = position + aDir * ((life - 0.5) * span);
    p.x += sin(uTime * 4.2 + seed * 31.0) * 0.08;
    p.y += cos(uTime * 3.7 + seed * 23.0) * 0.08;

    vColor = aColor;
    vAlpha = fade * 0.92;
    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = sz * (260.0 / max(-mvPos.z, 0.5));
    gl_Position = projectionMatrix * mvPos;
  }
`

function createSparkMat(focusU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uTex: { value: getSparkTex() },
    },
    vertexShader: SPARK_VERT,
    fragmentShader: FX_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  })
}

function createWayMaterials(id, focusU) {
  const V = VISUALS[id]
  return {
    tube: createTubeMat(id, focusU),
    rail: createRailMat(focusU),
    floor: createFloorMat(focusU),
    hull: createHullMat(focusU),
    panel: createPanelMat(focusU),
    lightBar: createLightBarMat(focusU),
    neonRim: withCameraFade(withFocusFade(new THREE.MeshBasicMaterial({ toneMapped: false }), focusU, 0.15, 0.2, 0.25), 0.7, 1.35),
    windStreak: createWindStreakMat(focusU),
    sparks: createSparkMat(focusU),
    glass: withCameraFade(withFocusFade(new THREE.MeshPhysicalMaterial({
      color: V.glass,
      normalMap: texNormal(id),
      normalScale: new THREE.Vector2(0.25, 0.25),
      transparent: true,
      opacity: 0.24,
      roughness: 0.06,
      metalness: 0.1,
      envMapIntensity: 1.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    }), focusU, 0.18, 0.25, 0.25), 1.4, 2.2),
    deco: withCameraFade(withFocusFade(new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.12, flatShading: true }), focusU, 0.16, 0.28, 0.25), 1.9, 2.7),
    decoA: withCameraFade(withFocusFade(new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true, transparent: true, opacity: 0.85, depthWrite: false }), focusU, 0.16, 0.28, 0.25), 1.9, 2.7),
    glow: withCameraFade(withFocusFade(new THREE.MeshBasicMaterial({ toneMapped: false }), focusU, 0.15, 0.18, 0.25), 1.2, 1.9),
    decorGlow: withCameraFade(withFocusFade(new THREE.MeshBasicMaterial({ toneMapped: false }), focusU, 0.15, 0.18, 0.25), 1.9, 2.7),
    sign: withCameraFade(createSignMat(focusU), 1.7, 2.5),
    dots: withFocusFade(new THREE.PointsMaterial({
      color: hot(V.rail, 1.25),
      map: getSparkleTex(),
      size: 0.13,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.28,
      alphaTest: 0.02,
      depthWrite: false,
      toneMapped: false,
    }), focusU, 0.16, 0.2, 0.25),
    parts: createPartsMat(id, focusU),
    fx: {
      spray: createEventFxMat('spray', focusU),
      smoke: createEventFxMat('smoke', focusU),
      ember: createEventFxMat('ember', focusU),
      foam: createEventFxMat('foam', focusU),
      ring: createEventFxMat('ring', focusU),
    },
  }
}

// ═══════════════════════════ HELPERS DE CONSTRUCCIÓN ═══════════════════════════
const put = (list, p, q, sx, sy = sx, sz = sx, c) => list.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz)), c })
const aim = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to)
const rr = (rng, [a, b]) => a + rng() * (b - a)
const pointsGeo = (arr) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
const METAL = new THREE.Color('#3a3f4a')

const EVENT_ACCENTS = {
  geiser: '#4fe3ff',
  erupcion: '#ff7043',
  cascada: '#5fe0ff',
  turbina: '#ffe866',
  hielo_resbaloso: '#9ee8ff',
  pantano: '#9be066',
  portal: '#e878ff',
}

function routeColor(baseHex, routeIdx, mult = 1) {
  const c = new THREE.Color(baseHex).multiplyScalar(mult)
  if (routeIdx === 1) c.offsetHSL(0.045, 0.04, 0.03)
  else if (routeIdx === 2) c.offsetHSL(-0.045, 0.04, -0.02)
  return c
}

function scaleTubeUvX(geo, len) {
  const uv = geo.getAttribute('uv')
  const sx = Math.max(len * 0.25, 0.5)
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * sx)
  uv.needsUpdate = true
}

function colorizeGeo(geo, col) {
  const count = geo.getAttribute('position').count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = col.r
    arr[i * 3 + 1] = col.g
    arr[i * 3 + 2] = col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
}

function frameAt(T) {
  const N = new THREE.Vector3().crossVectors(T, Math.abs(T.y) > 0.9 ? X : Y).normalize()
  const B = new THREE.Vector3().crossVectors(T, N).normalize()
  return { N, B }
}

const _bMat = new THREE.Matrix4()
function basisQuat(rx, ry, rz) {
  _bMat.makeBasis(rx, ry, rz)
  return new THREE.Quaternion().setFromRotationMatrix(_bMat)
}

function buildCurveFrames(curve, steps) {
  const frames = []
  const T0 = curve.getTangentAt(0)
  let down = Y.clone().negate().addScaledVector(T0, T0.y)
  if (down.lengthSq() < 0.02) down = frameAt(T0).N.clone().negate()
  down.normalize()

  let arc = 0
  let prevP = curve.getPointAt(0)
  for (let i = 0; i <= steps; i++) {
    const u = i / steps
    const pos = i === 0 ? prevP.clone() : curve.getPointAt(u)
    if (i > 0) arc += pos.distanceTo(prevP)
    prevP = pos
    const T = curve.getTangentAt(u)
    // Transporte paralelo de `down` + alineación suave hacia abajo en tramos no invertidos
    down = down.clone().addScaledVector(T, -down.dot(T))
    if (down.lengthSq() < 1e-5) down = frameAt(T).N.clone().negate()
    down.normalize()

    const wd = Y.clone().negate().addScaledVector(T, T.y)
    if (wd.lengthSq() > 0.14) {
      wd.normalize()
      if (down.dot(wd) > 0.2) down.lerp(wd, 0.22).normalize()
    }
    const up = down.clone().negate()
    const right = new THREE.Vector3().crossVectors(up, T)
    if (right.lengthSq() < 1e-5) right.copy(frameAt(T).N)
    else right.normalize()
    frames.push({ pos, T, up, right, arc })
  }
  return frames
}

function sampleCurveFrame(frames, u) {
  const fIdx = THREE.MathUtils.clamp(u, 0, 1) * (frames.length - 1)
  const i0 = Math.floor(fIdx)
  const i1 = Math.min(frames.length - 1, i0 + 1)
  const alpha = fIdx - i0
  const a = frames[i0]; const b = frames[i1]
  const pos = a.pos.clone().lerp(b.pos, alpha)
  const T = a.T.clone().lerp(b.T, alpha).normalize()
  const up = a.up.clone().lerp(b.up, alpha)
  up.addScaledVector(T, -up.dot(T))
  if (up.lengthSq() < 1e-5) up.copy(a.up)
  up.normalize()
  const right = new THREE.Vector3().crossVectors(up, T).normalize()
  return { pos, T, up, right }
}

const FLOOR_ANGS = [-0.50, -0.42, -0.30, 0.0, 0.30, 0.42, 0.50]
const FLOOR_RADS = [0.962, 0.944, 0.974, 0.976, 0.974, 0.944, 0.962]

function buildFloorSegmentGeo(s, frames, V, isFast, isSlow) {
  const R = s.radius
  const sk = s.speedK ?? 1
  const density = isFast ? 0.42 : isSlow ? 0.18 : (sk >= 1.25 ? 0.4 : sk <= 0.85 ? 0.2 : 0.28)
  const scroll = (isFast ? 0.95 : isSlow ? 0.34 : 0.58) * sk
  const glowMult = isFast ? 1.32 : isSlow ? 0.9 : 1.12
  const warmShift = isSlow ? 1.0 : 0.0
  const evHex = s.event ? (EVENT_ACCENTS[s.event] ?? V.rail) : (V.cine?.floor ?? V.rail)
  const acc = new THREE.Color(evHex)

  const nCols = FLOOR_ANGS.length
  const pos = []; const norm = []; const uv = []; const meta = []; const accent = []; const idx = []
  const dir = new THREE.Vector3()
  const down = new THREE.Vector3()

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i]
    down.copy(f.up).negate()
    const uCoord = f.arc * density
    for (let k = 0; k < nCols; k++) {
      const a = FLOOR_ANGS[k]
      const rr = R * FLOOR_RADS[k]
      dir.copy(down).multiplyScalar(Math.cos(a)).addScaledVector(f.right, Math.sin(a)).normalize()
      pos.push(f.pos.x + dir.x * rr, f.pos.y + dir.y * rr, f.pos.z + dir.z * rr)
      norm.push(-dir.x, -dir.y, -dir.z)
      uv.push(uCoord, k / (nCols - 1))
      meta.push(scroll, glowMult, warmShift)
      accent.push(acc.r, acc.g, acc.b)
    }
  }
  for (let i = 0; i < frames.length - 1; i++) {
    for (let k = 0; k < nCols - 1; k++) {
      const a = i * nCols + k
      const b = (i + 1) * nCols + k
      const c = i * nCols + k + 1
      const d = (i + 1) * nCols + k + 1
      idx.push(a, b, c, b, d, c)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setAttribute('aFloorMeta', new THREE.Float32BufferAttribute(meta, 3))
  g.setAttribute('aFloorAccent', new THREE.Float32BufferAttribute(accent, 3))
  g.setIndex(idx)
  return g
}

function pushFxPoint(buckets, texKey, pos, dir, mode, seed, speed, size, col) {
  const b = buckets[texKey]
  b.pos.push(pos.x, pos.y, pos.z)
  b.dir.push(dir.x, dir.y, dir.z)
  b.param.push(mode, seed, speed, size)
  b.col.push(col.r, col.g, col.b)
}

function buildFxGeo(b) {
  if (!b.pos.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(b.dir, 3))
  g.setAttribute('aParam', new THREE.Float32BufferAttribute(b.param, 4))
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(b.col, 3))
  return g
}

// ═══════════════════════════ LANDMARKS POR TEMA ═══════════════════════════
function addLandmark(way, V, out) {
  const lm = V.landmark
  if (!lm) return
  const solid = way.segments.filter((s) => !s.air)
  if (!solid.length) return

  const rng = mulberry32(way.idx * 4099 + 17)
  // 1 foco principal cerca de la mitad del way, desplazado lateralmente para silueta clara
  const mainSeg = solid.reduce((best, s) => (s.length > best.length ? s : best), solid[0])
  const u = 0.45 + (rng() - 0.5) * 0.2
  const P = mainSeg.curve.getPointAt(u)
  const T = mainSeg.curve.getTangentAt(u)
  const { N } = frameAt(T)
  const side = way.idx % 2 === 0 ? 1 : -1
  const basePos = P.clone().addScaledVector(N, side * (mainSeg.radius + 3.4)).addScaledVector(Y, -1.2)

  const c1 = new THREE.Color(lm.c1)
  const c2 = new THREE.Color(lm.c2)
  const glowC = hot(lm.glow, 1.35)
  const bannerCols = (V.banner?.c ?? [V.rib, V.rail]).map((c) => new THREE.Color(c))

  const { cones, cyls, boxes, octas, spheresA, lights, banners, rings, spinMeta, bladeMeta } = out

  // Puente/soporte de enlace sutil hacia el tubo
  put(boxes, P.clone().addScaledVector(N, side * (mainSeg.radius + 1.6)).addScaledVector(Y, -0.4), aim(X, N), 3.2, 0.22, 0.55, c1)

  if (lm.kind === 'obelisk') {
    put(boxes, basePos, IDENT, 1.9, 0.9, 1.9, c1)
    put(cones, basePos.clone().addScaledVector(Y, 0.9), IDENT, 1.25, 5.2, 1.25, c2)
    put(lights, basePos.clone().addScaledVector(Y, 6.7), IDENT, 0.65, 0.65, 0.65, glowC)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 6.7), ex: 0.3, ey: 0, ez: 0.2, sx: 0.5, sy: 1.2, sz: 0.3, scale: 1.15, c: glowC })
  } else if (lm.kind === 'tree_arch') {
    put(cyls, basePos, IDENT, 0.85, 3.6, 0.85, c1)
    put(cones, basePos.clone().addScaledVector(Y, 2.8), IDENT, 3.2, 2.8, 3.2, c2)
    put(cones, basePos.clone().addScaledVector(Y, 4.6), IDENT, 2.4, 2.4, 2.4, c2)
    put(lights, basePos.clone().addScaledVector(N, -side * 1.1).addScaledVector(Y, 2.7), IDENT, 0.32, 0.32, 0.32, glowC)
    put(lights, basePos.clone().addScaledVector(N, side * 1.1).addScaledVector(Y, 3.4), IDENT, 0.32, 0.32, 0.32, glowC)
  } else if (lm.kind === 'lighthouse') {
    put(cyls, basePos, IDENT, 1.5, 2.2, 1.5, c1)
    put(cyls, basePos.clone().addScaledVector(Y, 2.2), IDENT, 1.25, 2.0, 1.25, c2)
    put(cyls, basePos.clone().addScaledVector(Y, 4.2), IDENT, 1.05, 1.5, 1.05, c1)
    put(lights, basePos.clone().addScaledVector(Y, 6.1), IDENT, 0.95, 0.95, 0.95, glowC)
    put(cones, basePos.clone().addScaledVector(Y, 6.7), IDENT, 1.4, 1.0, 1.4, c2)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 6.1), ex: Math.PI / 2, ey: 0, ez: 0, sx: 0, sy: 1.5, sz: 0, scale: 1.6, c: glowC })
  } else if (lm.kind === 'pyramid') {
    put(boxes, basePos, IDENT, 3.6, 1.2, 3.6, c2)
    put(boxes, basePos.clone().addScaledVector(Y, 1.2), IDENT, 2.4, 1.2, 2.4, c1)
    put(boxes, basePos.clone().addScaledVector(Y, 2.4), IDENT, 1.3, 1.1, 1.3, c2)
    put(octas, basePos.clone().addScaledVector(Y, 3.8), IDENT, 0.9, 1.1, 0.9, glowC)
  } else if (lm.kind === 'ice_spire') {
    put(cones, basePos, IDENT, 1.6, 5.4, 1.6, c1)
    put(octas, basePos.clone().addScaledVector(Y, 2.2).addScaledVector(N, 0.8), IDENT, 0.9, 2.4, 0.9, c2)
    put(octas, basePos.clone().addScaledVector(Y, 1.8).addScaledVector(N, -0.8), IDENT, 0.8, 2.0, 0.8, c2)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 4.8), ex: 0.4, ey: 0.2, ez: 0, sx: 0.4, sy: 1.1, sz: 0.3, scale: 1.35, c: glowC })
  } else if (lm.kind === 'volcano_torii') {
    const pL = basePos.clone().addScaledVector(T, -1.2)
    const pR = basePos.clone().addScaledVector(T, 1.2)
    put(cyls, pL, IDENT, 0.55, 4.6, 0.55, c1)
    put(cyls, pR, IDENT, 0.55, 4.6, 0.55, c1)
    put(boxes, basePos.clone().addScaledVector(Y, 4.5), aim(X, T), 3.6, 0.45, 0.65, c2)
    put(lights, basePos.clone().addScaledVector(Y, 5.15), IDENT, 0.55, 0.7, 0.55, glowC)
  } else if (lm.kind === 'prism_tower') {
    put(boxes, basePos, IDENT, 1.8, 1.0, 1.8, c2)
    put(octas, basePos.clone().addScaledVector(Y, 3.2), IDENT, 1.5, 3.6, 1.5, c1)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 3.2), ex: 0.5, ey: 0, ez: 0.5, sx: 0.8, sy: 1.4, sz: 0.6, scale: 1.75, c: glowC })
    put(lights, basePos.clone().addScaledVector(Y, 3.2), IDENT, 0.65, 0.65, 0.65, glowC)
  } else if (lm.kind === 'windmill') {
    put(cones, basePos, IDENT, 1.8, 4.8, 1.8, c1)
    const hub = basePos.clone().addScaledVector(Y, 4.2).addScaledVector(N, -side * 0.75)
    put(lights, hub, IDENT, 0.5, 0.5, 0.5, glowC)
    for (let k = 0; k < 4; k++) {
      bladeMeta.push({ pos: hub, axis: N.clone().multiplyScalar(-side), angle0: (k * Math.PI) / 2, speed: 1.4, len: 2.3, width: 0.35, c: k % 2 === 0 ? c2 : glowC })
    }
  } else if (lm.kind === 'neon_gate') {
    const pL = basePos.clone().addScaledVector(T, -1.3)
    const pR = basePos.clone().addScaledVector(T, 1.3)
    put(boxes, pL, IDENT, 0.45, 4.8, 0.45, c1)
    put(boxes, pR, IDENT, 0.45, 4.8, 0.45, c1)
    put(rings, basePos.clone().addScaledVector(Y, 4.6), aim(Z, T), 1.6, 1.6, 1.6, glowC)
    put(rings, basePos.clone().addScaledVector(Y, 4.6), aim(Z, T), 1.15, 1.15, 1.15, hot(c2, 1.3))
  } else {
    // flower_gazebo
    put(cyls, basePos, IDENT, 1.6, 0.5, 1.6, c1)
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4
      put(cyls, basePos.clone().add(new THREE.Vector3(Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1)), IDENT, 0.16, 2.8, 0.16, c1)
    }
    put(spheresA, basePos.clone().addScaledVector(Y, 3.6), IDENT, 3.1, 1.2, 3.1, c2)
    put(lights, basePos.clone().addScaledVector(Y, 4.2), IDENT, 0.65, 0.65, 0.65, glowC)
  }

  // Estandarte con emblema del tema junto al landmark
  const flagPos = basePos.clone().addScaledVector(T, 1.6).addScaledVector(Y, 1.2)
  put(cyls, basePos.clone().addScaledVector(T, 1.6), IDENT, 0.08, 2.6, 0.08, METAL)
  put(banners, flagPos.clone().addScaledVector(Y, 1.3), IDENT, 1.15, 1.15, 1.15, bannerCols[0])
}

// ═══════════════════════════ EVENTOS ANIMADOS + TEASERS ═══════════════════════════
function addSegmentEvent(s, V, out) {
  const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
  if (!ev) return
  const c = s.curve
  const R = s.radius
  const accHex = EVENT_ACCENTS[ev] ?? V.rail
  const accCol = hot(accHex, 1.48)
  const { cones, cyls, lights, rings, mouthRings, ribFrames, spinMeta, bladeMeta, pulseMeta, discs, fxBuckets } = out

  // Transición visible de entrada y salida de ambiente del evento (anillo de neón + marco + destello)
  for (const uEdge of (s.air ? [0.02] : [0.015, 0.985])) {
    const Pe = c.getPointAt(uEdge)
    const Te = c.getTangentAt(uEdge)
    const qe = aim(Z, Te)
    if (!s.air && ribFrames) {
      put(ribFrames, Pe, qe, R * 1.03, R * 1.03, 1.15, new THREE.Color(V.cine?.panel?.base ?? '#1c2233'))
    }
    if (mouthRings) {
      put(mouthRings, Pe, qe, R * 1.06, R * 1.06, R * 1.06, accCol)
    }
    for (let k = 0; k < 6; k++) {
      pushFxPoint(fxBuckets, 'ring', Pe, Te, 6, k / 6, 0.9, 0.28, new THREE.Color(accHex))
    }
  }

  // Teaser de curiosidad en la entrada del tramo: baliza pulsante + 2 luces guía
  const P0 = c.getPointAt(0.04)
  const T0 = c.getTangentAt(0.04)
  const { N: N0 } = frameAt(T0)
  const pulseRate = (s.speedK ?? 1) > 1.05 ? 6.0 : (s.speedK ?? 1) < 0.9 ? 2.4 : 4.0
  pulseMeta.push({ pos: P0, q: aim(Z, T0), baseScale: [R * 1.24, R * 1.24, R * 1.24], amp: [0.16, 0.16, 0.16], freq: pulseRate, phase: s.idx * 0.7, c: accCol, kind: 'ring' })
  put(lights, P0.clone().addScaledVector(N0, R + 0.35), IDENT, 0.22, 0.22, 0.22, accCol)
  put(lights, P0.clone().addScaledVector(N0, -(R + 0.35)), IDENT, 0.22, 0.22, 0.22, accCol)

  const Pmid = c.getPointAt(0.5)
  const Tmid = c.getTangentAt(0.5)
  const { N: Nmid } = frameAt(Tmid)
  const rng = mulberry32(s.idx * 613 + 29)

  if (ev === 'geiser') {
    const baseP = Pmid.clone().addScaledVector(Y, -R * 0.9)
    put(cones, baseP, IDENT, R * 2.2, 0.75, R * 2.2, new THREE.Color('#475c6c'))
    pulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.5), q: IDENT, baseScale: [R * 0.6, 2.8, R * 0.6], amp: [0.18, 2.4, 0.18], freq: 2.2, phase: s.idx, c: hot('#7be8ff', 1.25), kind: 'cyl' })
    pulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.25), q: aim(Z, Y), baseScale: [R * 1.1, R * 1.1, R * 1.1], amp: [0.9, 0.9, 0.9], freq: 2.2, phase: s.idx, c: new THREE.Color('#e0faff'), kind: 'ring' })
    for (let i = 0; i < 16; i++) {
      pushFxPoint(fxBuckets, 'spray', baseP.clone().addScaledVector(Y, 0.6), Y, 0, rng(), 1.0, 0.36 + rng() * 0.2, new THREE.Color('#b8f4ff'))
    }
    for (let i = 0; i < 8; i++) {
      pushFxPoint(fxBuckets, 'foam', baseP.clone().addScaledVector(Nmid, (rng() - 0.5) * R).addScaledVector(Y, 0.25), Y, 5, rng(), 0.55, 0.32, new THREE.Color('#ffffff'))
    }
  } else if (ev === 'erupcion') {
    const Pcr = c.getPointAt(0.14)
    const baseP = Pcr.clone().addScaledVector(Y, -R * 0.85)
    put(cones, baseP, IDENT, R * 2.8, 1.35, R * 2.8, new THREE.Color('#2b1b17'))
    pulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 1.1), q: IDENT, baseScale: [R * 0.85, R * 0.45, R * 0.85], amp: [0.22, 0.35, 0.22], freq: 3.1, phase: s.idx, c: hot('#ff5a1f', 1.65), kind: 'light' })
    for (let i = 0; i < 18; i++) {
      const dir = new THREE.Vector3((rng() - 0.5) * 0.7, 0.9 + rng() * 0.7, (rng() - 0.5) * 0.7).normalize()
      pushFxPoint(fxBuckets, 'ember', baseP.clone().addScaledVector(Y, 1.1), dir, 1, rng(), 0.75 + rng() * 0.4, 0.34 + rng() * 0.18, new THREE.Color('#ff8a2f'))
    }
    for (let i = 0; i < 10; i++) {
      pushFxPoint(fxBuckets, 'smoke', baseP.clone().addScaledVector(Y, 1.3), Y, 1, rng(), 0.32 + rng() * 0.15, 0.65 + rng() * 0.3, new THREE.Color('#5a4a44'))
    }
  } else if (ev === 'cascada') {
    for (const u of [0.28, 0.55, 0.78]) {
      const Pw = c.getPointAt(u)
      put(discs, Pw.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 3.1, 0.12, R * 3.1)
      for (let i = 0; i < 8; i++) {
        const offP = Pw.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.4).addScaledVector(Y, R * 1.6)
        pushFxPoint(fxBuckets, 'spray', offP, Y, 2, rng(), 0.65 + rng() * 0.35, 0.3 + rng() * 0.18, new THREE.Color('#a8ecff'))
      }
      for (let i = 0; i < 5; i++) {
        pushFxPoint(fxBuckets, 'foam', Pw.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.5).addScaledVector(Y, -R * 0.7), Y, 5, rng(), 0.45, 0.35, new THREE.Color('#eefaff'))
      }
    }
  } else if (ev === 'turbina') {
    for (const u of [0.3, 0.7]) {
      const Pt = c.getPointAt(u)
      const Tt = c.getTangentAt(u)
      put(rings, Pt, aim(Z, Tt), R * 1.38, R * 1.38, R * 1.38, METAL)
      for (let k = 0; k < 4; k++) {
        bladeMeta.push({ pos: Pt, axis: Tt, angle0: (k * Math.PI) / 2, speed: 5.5, len: R * 1.25, width: 0.22, c: hot('#ffe866', 1.25) })
      }
      for (let i = 0; i < 10; i++) {
        const { N: Nt, B: Bt } = frameAt(Tt)
        const ang = rng() * TAU
        const p = Pt.clone().addScaledVector(Nt, Math.cos(ang) * R * 0.6).addScaledVector(Bt, Math.sin(ang) * R * 0.6)
        pushFxPoint(fxBuckets, 'spray', p, Tt, 3, rng(), 1.4 + rng() * 0.6, 0.24, new THREE.Color('#fff7b0'))
      }
    }
  } else if (ev === 'hielo_resbaloso') {
    const nCry = 6
    for (let i = 0; i < nCry; i++) {
      const u = (i + 0.5) / nCry
      const Pi = c.getPointAt(u)
      const Ti = c.getTangentAt(u)
      const { N: Ni } = frameAt(Ti)
      const side = i % 2 === 0 ? 1 : -1
      const cp = Pi.clone().addScaledVector(Ni, side * (R + 0.15))
      put(cones, cp, aim(Y, Ni.clone().multiplyScalar(side).addScaledVector(Y, 0.6).normalize()), 0.35, 1.15, 0.35, new THREE.Color('#bdeeff'))
      pushFxPoint(fxBuckets, 'ring', Pi.clone().addScaledVector(Y, R * 0.6), Y, 4, rng(), 2.8 + rng() * 1.5, 0.35, new THREE.Color('#d8f8ff'))
    }
  } else if (ev === 'pantano') {
    for (const u of [0.25, 0.5, 0.75]) {
      const Pp = c.getPointAt(u)
      put(cyls, Pp.clone().addScaledVector(Y, -R * 1.12), IDENT, R * 1.85, 0.08, R * 1.85, new THREE.Color('#3b5928'))
      for (let i = 0; i < 6; i++) {
        const bp = Pp.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.4).addScaledVector(Y, -R * 0.65)
        pushFxPoint(fxBuckets, 'foam', bp, Y, 5, rng(), 0.28 + rng() * 0.2, 0.34 + rng() * 0.18, new THREE.Color('#9be066'))
      }
      pushFxPoint(fxBuckets, 'smoke', Pp.clone().addScaledVector(Y, -R * 0.3), Y, 5, rng(), 0.2, 0.8, new THREE.Color('#5a7a42'))
    }
  } else if (ev === 'portal') {
    for (const u of [0.15, 0.85]) {
      const Ppt = c.getPointAt(u)
      const Tpt = c.getTangentAt(u)
      const q = aim(Z, Tpt)
      const e0 = new THREE.Euler().setFromQuaternion(q)
      spinMeta.push({ pos: Ppt, ex: e0.x, ey: e0.y, ez: e0.z, sx: 0.6, sy: 1.5, sz: 1.2, scale: R * 1.55, c: hot('#ea80fc', 1.45) })
      spinMeta.push({ pos: Ppt, ex: e0.x, ey: e0.y, ez: e0.z, sx: -0.9, sy: 1.1, sz: -1.6, scale: R * 1.18, c: hot('#4fe3ff', 1.4) })
      for (let i = 0; i < 12; i++) {
        pushFxPoint(fxBuckets, 'ring', Ppt, Tpt, 6, rng(), 0.7 + rng() * 0.4, 0.3, new THREE.Color('#ea80fc'))
      }
    }
  }
}

// ═══════════════════════════ AMBIENTE INTERIOR Y BUILD WAY ═══════════════════════════
const PANEL_SLOTS_EVEN = [0.88, -1.88]
const PANEL_SLOTS_ODD = [-0.88, 1.88]
const LIGHTBAR_ANGLES = [0.58, -0.58, 1.48, -1.48]
const WHITE_COL = new THREE.Color('#ffffff')
const PRISM_COLS = ['#7df9ff', '#ff7de9', '#a78bff', '#7dffb2'].map((h) => hot(h, 1.28))
const PETAL_COLS = ['#ff88c2', '#ffd27a', '#ffc2df'].map((h) => hot(h, 1.2))

function addWindAndSparksForSegment(s, V, frames, isFast, isSlow, out) {
  const { windStreaks, sparkBucket } = out
  const rng = mulberry32(s.idx * 3571 + 41)
  const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
  const sk = s.speedK ?? 1
  const intenseEv = ev === 'turbina' || ev === 'erupcion' || ev === 'geiser' || ev === 'canon' || ev === 'portal' || ev === 'hielo_resbaloso'
  const mult = (intenseEv ? 2.1 : ev ? 1.45 : 1.0) * (isFast || sk >= 1.25 ? 1.45 : isSlow || sk <= 0.85 ? 0.55 : 1.0)

  const themeAtmo = V.cine?.atmo ?? {}
  const baseStreakHex = ev ? (EVENT_ACCENTS[ev] ?? themeAtmo.streak ?? '#5ce1ff') : (themeAtmo.streak ?? '#5ce1ff')
  const baseSparkHex = ev === 'erupcion' || ev === 'canon' ? '#ff9438'
    : ev === 'geiser' || ev === 'cascada' ? '#8ceeff'
    : ev === 'turbina' ? '#ffe875'
    : ev === 'portal' ? '#ea80fc'
    : (themeAtmo.spark ?? '#ff9e42')

  const nStreaks = Math.min(48, Math.max(2, Math.round(s.length * 0.52 * mult)))
  const R = s.radius
  for (let i = 0; i < nStreaks; i++) {
    const u = 0.05 + rng() * 0.9
    const f = frames ? sampleCurveFrame(frames, u) : (() => {
      const T = s.curve.getTangentAt(u); const { N, B } = frameAt(T)
      return { pos: s.curve.getPointAt(u), T, up: N, right: B }
    })()
    const ang = (rng() - 0.5) * Math.PI * 1.38 // laterales y cielo, evitando la pista inferior
    const rad = R * (0.7 + rng() * 0.22)
    const radialOut = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    const bin = new THREE.Vector3().crossVectors(f.T, radialOut).normalize()
    const pos = f.pos.clone().addScaledVector(radialOut, rad)
    const q = basisQuat(f.T, radialOut, bin)
    const lenScale = (1.1 + rng() * 1.3) * (intenseEv || isFast ? 1.35 : 1.0)
    const thickScale = (0.75 + rng() * 0.6)
    const col = new THREE.Color(baseStreakHex).offsetHSL((rng() - 0.5) * 0.04, 0, (rng() - 0.5) * 0.1).multiplyScalar(intenseEv ? 1.32 : 1.15)
    windStreaks.push({
      m: new THREE.Matrix4().compose(pos, q, new THREE.Vector3(lenScale, thickScale, thickScale)),
      c: col,
      seed: rng(),
      speed: (0.75 + rng() * 0.85) * sk * (intenseEv ? 1.45 : 1.0),
      span: 2.2 + rng() * 2.2,
      alpha: (intenseEv ? 0.72 : isSlow ? 0.34 : 0.52),
    })
  }

  const nSparks = Math.min(54, Math.max(2, Math.round(s.length * 0.58 * mult)))
  for (let i = 0; i < nSparks; i++) {
    const u = 0.04 + rng() * 0.92
    const f = frames ? sampleCurveFrame(frames, u) : (() => {
      const T = s.curve.getTangentAt(u); const { N, B } = frameAt(T)
      return { pos: s.curve.getPointAt(u), T, up: N, right: B }
    })()
    const ang = (rng() - 0.5) * TAU
    const rad = R * (0.25 + rng() * 0.58)
    const p = f.pos.clone().addScaledVector(f.up, Math.cos(ang) * rad).addScaledVector(f.right, Math.sin(ang) * rad)
    const col = new THREE.Color(baseSparkHex).offsetHSL((rng() - 0.5) * 0.05, 0, (rng() - 0.5) * 0.08).multiplyScalar(intenseEv ? 1.35 : 1.2)
    pushFxPoint(
      { spark: sparkBucket },
      'spark',
      p,
      f.T,
      rng(),
      (0.55 + rng() * 0.85) * sk * (intenseEv ? 1.35 : 1.0),
      2.0 + rng() * 2.4,
      0.18 + rng() * 0.16,
      col
    )
  }
}

function addThemeBayProps(themeId, f, R, bayIdx, bayLen, rng, out) {
  const { solids, cones, boxes, spheresA, lights, glowOctas, bolts, fxBuckets, sparkBucket } = out
  const side = bayIdx % 2 === 0 ? 1 : -1

  if (themeId === 'sombrio') {
    if (bayIdx % 2 === 0) {
      const lp = f.pos.clone().addScaledVector(f.right, side * R * 1.06).addScaledVector(f.up, R * 0.2)
      put(boxes, lp, IDENT, 0.18, 0.28, 0.18, new THREE.Color('#211730'))
      put(lights, lp.clone().addScaledVector(Y, -0.05), IDENT, 0.22, 0.22, 0.22, hot('#c57aff', 1.35))
    }
    if (bayIdx % 3 === 0) {
      pushFxPoint(fxBuckets, 'smoke', f.pos.clone().addScaledVector(f.up, -R * 0.25), Y, 5, rng(), 0.22, 0.85, new THREE.Color('#4a2475'))
    }
  } else if (themeId === 'bosque') {
    // Lianas abrazando el cristal y hojas + luciérnagas dentro del tubo
    const ang = side * (0.45 + rng() * 0.5)
    const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    const vp = f.pos.clone().addScaledVector(dir, R * 1.015)
    const qVine = aim(Y, f.T.clone().addScaledVector(f.right, side * 0.35).normalize())
    put(solids, vp, qVine, 0.055, bayLen * 0.85, 0.055, new THREE.Color('#2c7a38'))
    if (bayIdx % 2 === 1) {
      put(cones, vp.clone().addScaledVector(dir, 0.08), aim(Y, dir), 0.24, 0.34, 0.12, new THREE.Color('#53b848'))
    }
    pushFxPoint({ s: sparkBucket }, 's', f.pos.clone().addScaledVector(f.up, (rng() - 0.3) * R * 0.65).addScaledVector(f.right, (rng() - 0.5) * R * 0.7), f.T, rng(), 0.25, 1.1, 0.22, hot('#d4ff5a', 1.3))
  } else if (themeId === 'mar') {
    const bp = f.pos.clone().addScaledVector(f.right, (rng() - 0.5) * R * 1.1).addScaledVector(f.up, -R * 0.35)
    pushFxPoint(fxBuckets, 'foam', bp, Y, 5, rng(), 0.38 + rng() * 0.25, 0.26 + rng() * 0.16, new THREE.Color('#bff3ff'))
    if (bayIdx % 3 === 1) {
      put(spheresA, f.pos.clone().addScaledVector(f.right, side * R * 0.82).addScaledVector(f.up, R * 0.32), IDENT, 0.18, 0.18, 0.18, new THREE.Color('#9cefff'))
    }
  } else if (themeId === 'desierto') {
    if (bayIdx % 3 === 0) {
      pushFxPoint(fxBuckets, 'smoke', f.pos.clone().addScaledVector(f.up, -R * 0.35), f.T, 3, rng(), 0.75, 0.7, new THREE.Color('#d9a45b'))
    }
  } else if (themeId === 'hielo') {
    if (bayIdx % 2 === 0) {
      const ang = side * (0.6 + rng() * 0.6)
      const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
      const ip = f.pos.clone().addScaledVector(dir, R * 1.03)
      put(cones, ip, aim(Y, dir), 0.22, 0.62, 0.22, new THREE.Color('#bceeff'))
    }
  } else if (themeId === 'volcan') {
    const ep = f.pos.clone().addScaledVector(f.right, (rng() - 0.5) * R * 1.0).addScaledVector(f.up, -R * 0.45)
    pushFxPoint(fxBuckets, 'ember', ep, Y, 1, rng(), 0.65 + rng() * 0.35, 0.24, new THREE.Color('#ff8429'))
    if (bayIdx % 2 === 1) {
      const lp = f.pos.clone().addScaledVector(f.right, side * R * 0.98).addScaledVector(f.up, -R * 0.35)
      put(glowOctas, lp, IDENT, 0.2, 0.28, 0.2, hot('#ff4e1c', 1.35))
    }
  } else if (themeId === 'cristal') {
    const ang = side * (0.55 + (bayIdx % 3) * 0.35)
    const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    const cp = f.pos.clone().addScaledVector(dir, R * 1.02)
    put(glowOctas, cp, aim(Y, dir), 0.2, 0.56, 0.2, PRISM_COLS[bayIdx % PRISM_COLS.length])
  } else if (themeId === 'nubes') {
    if (bayIdx % 2 === 0) {
      pushFxPoint(fxBuckets, 'smoke', f.pos.clone().addScaledVector(f.up, (rng() - 0.2) * R * 0.7), Y, 5, rng(), 0.24, 0.9, new THREE.Color('#e6f2ff'))
    }
    if (bayIdx % 3 === 1) {
      const dir = f.up.clone().multiplyScalar(0.85).addScaledVector(f.right, side * 0.52).normalize()
      const bp = f.pos.clone().addScaledVector(dir, R * 0.98)
      put(bolts, bp, basisQuat(f.right, f.up, f.T), 0.9, 0.9, bayLen * 0.7, hot('#ffe97d', 1.38))
    }
  } else if (themeId === 'neon') {
    if (bayIdx % 2 === 0) {
      const np = f.pos.clone().addScaledVector(f.up, R * 0.96)
      put(boxes, np, basisQuat(f.right, f.up, f.T), 0.14, 0.05, bayLen * 0.52, hot(bayIdx % 4 === 0 ? '#2bffe8' : '#ff2bd6', 1.35))
    }
  } else if (themeId === 'jardin') {
    const ang = side * (0.55 + rng() * 0.6)
    const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    if (bayIdx % 2 === 0) {
      put(spheresA, f.pos.clone().addScaledVector(dir, R * 1.04), IDENT, 0.24, 0.24, 0.24, PETAL_COLS[bayIdx % PETAL_COLS.length])
    }
    pushFxPoint({ s: sparkBucket }, 's', f.pos.clone().addScaledVector(f.up, (rng() - 0.3) * R * 0.7).addScaledVector(f.right, (rng() - 0.5) * R * 0.8), f.T, rng(), 0.32, 1.3, 0.22, PETAL_COLS[bayIdx % PETAL_COLS.length])
  }
}

function build(way) {
  const themeId = way.theme.id
  const V = VISUALS[themeId]
  const cine = V.cine ?? {}
  const r = way.params.radius
  const ribBase = hot(V.rib, 1.25)
  const mouthC = hot(V.rail, 1.65)
  const dim = hot(V.rib, 0.8)
  const archC = new THREE.Color(V.arch?.c ?? '#3a3f4a')
  const poleC = new THREE.Color(V.lamp?.pole ?? '#3a3f4a')
  const lampC = hot(V.lamp?.c ?? V.rail, 1.28)
  const arrowC = hot(V.rail, 1.25)
  const bannerCols = (V.banner?.c ?? [V.rib, V.rail]).map((c) => new THREE.Color(c))
  const panelBaseCol = new THREE.Color(cine.panel?.base ?? '#1e2536')
  const panelGlowBase = cine.panel?.glow ?? V.rail
  const barBaseHex = cine.bar ?? '#ff6028'
  const neonBaseHex = cine.neon ?? V.rib

  const tubes = []; const rails = []; const floors = []
  const rings = []; const mouthRings = []; const ribFrames = []; const panelPods = []; const lightBars = []
  const neonRims = []; const windStreaks = []
  const solids = []; const cones = []; const boxes = []; const octas = []; const glowOctas = []; const bolts = []
  const spheres = []; const spheresA = []; const discs = []; const funnels = []; const dots = []
  const lights = []; const banners = []; const arrows = []; const signs = []
  const spinMeta = []; const bladeMeta = []; const pulseMeta = []
  const sparkBucket = { pos: [], dir: [], param: [], col: [] }
  const fxBuckets = {
    spray: { pos: [], dir: [], param: [], col: [] },
    smoke: { pos: [], dir: [], param: [], col: [] },
    ember: { pos: [], dir: [], param: [], col: [] },
    foam: { pos: [], dir: [], param: [], col: [] },
    ring: { pos: [], dir: [], param: [], col: [] },
  }

  const solid = way.segments.filter((s) => !s.air)
  const bayRng = mulberry32(way.idx * 8191 + 19)

  for (const s of way.segments) {
    const c = s.curve; const R = s.radius
    const ribC = routeColor(neonBaseHex, s.route, 1.22)
    const railCol = routeColor(V.rail, s.route, 0.85)

    // Perfil de ruta (rápida / lenta / espectacular)
    const prof = s.route >= 0 ? way.routes?.[s.route]?.profile : null
    const isFast = s.route >= 0 && (prof ? prof.speed === 'rapida' : s.route === 0)
    const isSlow = s.route >= 0 && (prof ? prof.speed === 'lenta' : s.route === 1)
    const isSpec = s.route >= 0 && !isFast && !isSlow

    // Eventos + teasers de curiosidad + anillos de transición
    addSegmentEvent(s, V, { cones, cyls: solids, lights, rings, mouthRings, ribFrames, spinMeta, bladeMeta, pulseMeta, discs, fxBuckets })

    if (s.air) {
      addWindAndSparksForSegment(s, V, null, isFast, isSlow, { windStreaks, sparkBucket })
      const P0 = c.getPoint(0); const T0 = c.getTangent(0); const P1 = c.getPoint(1); const T1 = c.getTangent(1)
      const n = Math.ceil(s.length / 0.9)
      for (let i = 1; i < n; i++) dots.push(...c.getPoint(i / n).toArray())
      for (const u of [0.25, 0.5, 0.75]) {
        arrows.push({ m: new THREE.Matrix4().compose(c.getPointAt(u), aim(Z, c.getTangentAt(u)), new THREE.Vector3(0.75, 0.75, 0.9)), c: arrowC })
      }
      if (s.kind === 'trampolin') {
        const p = P0.clone().addScaledVector(Y, -0.35)
        put(solids, p, IDENT, R * 3.4, 0.3, R * 3.4, new THREE.Color(V.rib).multiplyScalar(0.5))
        put(mouthRings, p.clone().addScaledVector(Y, 0.3), aim(Z, Y), R * 1.7, R * 1.7, R * 1.7, mouthC)
        put(mouthRings, P0.clone().addScaledVector(T0, 0.9), aim(Z, T0), R * 1.35, R * 1.35, R * 1.35, mouthC)
      } else if (s.kind === 'canon' || s.kind === 'erupcion') {
        ;[[0.5, 1.15], [1.1, 1.3], [1.7, 1.5]].forEach(([b, k]) => put(ribFrames, P0.clone().addScaledVector(T0, -b), aim(Z, T0), R * k, R * k, 1.2, METAL))
        put(mouthRings, P0, aim(Z, T0), R * 1.2, R * 1.2, R * 1.2, hot('#ff7a2f', 1.65))
        ;[0.8, 1.7].forEach((d, idx) => put(mouthRings, P0.clone().addScaledVector(T0, d), aim(Z, T0), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), hot('#ff9a3c', 1.55)))
      } else {
        put(mouthRings, P0, aim(Z, T0), R * 1.12, R * 1.12, R * 1.12, mouthC)
        put(solids, P0.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 2.6, 0.18, R * 2.6, METAL)
      }
      put(mouthRings, P1, aim(Z, T1), R * 1.9, R * 1.9, R * 1.9, mouthC)
      put(rings, P1, aim(Z, T1), R * 1.25, R * 1.25, R * 1.25, dim)
      put(rings, P1, aim(Z, T1), R * 0.6, R * 0.6, R * 0.6, dim)
      put(discs, P1, aim(Y, T1), R * 3.8, 0.04, R * 3.8)
      continue
    }

    const steps = Math.min(240, Math.max(8, Math.ceil(s.length * 2.5)))
    const frames = buildCurveFrames(c, steps)

    const tubeGeo = new THREE.TubeGeometry(c, steps, R, 16, false)
    scaleTubeUvX(tubeGeo, s.length)
    const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
    const tubeTint = ev ? WHITE_COL.clone().lerp(new THREE.Color(EVENT_ACCENTS[ev]), 0.62) : WHITE_COL
    colorizeGeo(tubeGeo, tubeTint)
    tubes.push(tubeGeo)

    floors.push(buildFloorSegmentGeo(s, frames, V, isFast, isSlow))

    const pts = frames.map((f) => f.pos.clone().addScaledVector(f.up, R * 0.99))
    const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, 0.018, 4, false)
    scaleTubeUvX(railGeo, s.length)
    colorizeGeo(railGeo, railCol)
    rails.push(railGeo)

    // Cápsulas segmentadas: anillos nervados + borde neón + paneles opacos alternados + barras de luz + ambiente del tema
    const baySpacing = isFast ? 2.15 : isSlow ? 2.65 : 2.38
    const nBays = Math.max(1, Math.round(s.length / baySpacing))
    const bayLen = s.length / nBays
    const evGlowHex = ev ? (EVENT_ACCENTS[ev] ?? panelGlowBase) : panelGlowBase
    const evBarHex = ev ? (EVENT_ACCENTS[ev] ?? barBaseHex) : barBaseHex
    const panelGlowCol = hot(evGlowHex, 1.25)
    const barCol = hot(evBarHex, isFast ? 1.38 : isSlow ? 1.08 : 1.26)
    const bayNeonCol = ev ? hot(EVENT_ACCENTS[ev], 1.35) : ribC
    const bayFrameCol = routeColor(panelBaseCol, s.route, 1.0)

    for (let i = 1; i < nBays; i++) {
      const u = i / nBays
      const f = sampleCurveFrame(frames, u)
      const q = basisQuat(f.right, f.up, f.T)
      put(ribFrames, f.pos, q, R, R, 1.0, bayFrameCol)
      put(neonRims, f.pos, q, R * 1.02, R * 1.02, R * 1.02, bayNeonCol)
    }

    for (let i = 0; i < nBays; i++) {
      const u = (i + 0.5) / nBays
      const f = sampleCurveFrame(frames, u)
      const qBase = basisQuat(f.right, f.up, f.T)

      // Módulos opacos alternados dejando amplias ventanas de cristal
      const slots = i % 2 === 0 ? PANEL_SLOTS_EVEN : PANEL_SLOTS_ODD
      for (const ang of slots) {
        const qPod = qBase.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, -ang))
        panelPods.push({
          m: new THREE.Matrix4().compose(f.pos, qPod, new THREE.Vector3(R, R, bayLen * 0.78)),
          c: bayFrameCol,
          glow: panelGlowCol,
        })
      }

      // Barras de luz incrustadas en el interior del tubo
      const barMask = i % 2 === 0 ? LIGHTBAR_ANGLES : [LIGHTBAR_ANGLES[0], LIGHTBAR_ANGLES[1]]
      for (const ang of barMask) {
        const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
        const bp = f.pos.clone().addScaledVector(dir, R * 0.955)
        const qBar = qBase.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, -ang))
        put(lightBars, bp, qBar, R, R, bayLen * 0.58, barCol)
      }

      addThemeBayProps(themeId, f, R, i, bayLen, bayRng, { solids, cones, boxes, spheresA, lights, glowOctas, bolts, fxBuckets, sparkBucket })

      if (i % 3 === 1 && s.length > 5) {
        const sideSign = i % 2 === 0 ? 1 : -1
        const bp = f.pos.clone().addScaledVector(f.right, sideSign * R * 1.15).addScaledVector(Y, -R * 0.22)
        put(banners, bp, IDENT, 0.75, 0.75, 0.75, bannerCols[i % bannerCols.length])
        const lCol = isSlow ? hot('#ffd99e', 1.24) : isSpec ? hot(bannerCols[i % bannerCols.length], 1.32) : lampC
        put(lights, bp.clone().addScaledVector(Y, -0.55), IDENT, 0.2, 0.2, 0.2, lCol)
      }
    }

    addWindAndSparksForSegment(s, V, frames, isFast, isSlow, { windStreaks, sparkBucket })

    // acento visual por perfil de ruta
    if (isSlow && s.length > 5) {
      const nFlora = Math.max(1, Math.floor(s.length / 9))
      for (let i = 0; i < nFlora; i++) {
        const u = (i + 0.5) / nFlora
        const P = c.getPointAt(u); const T = c.getTangentAt(u)
        const { N } = frameAt(T)
        const side = i % 2 === 0 ? 1 : -1
        const fp = P.clone().addScaledVector(N, side * (R + 0.35)).addScaledVector(Y, -0.25)
        put(spheresA, fp, IDENT, 0.42, 0.32, 0.42, new THREE.Color('#68b86b'))
        put(lights, fp.clone().addScaledVector(Y, 0.28), IDENT, 0.16, 0.16, 0.16, hot('#ffe2a8', 1.25))
      }
    } else if (isSpec && s.length > 5) {
      const nFl = Math.max(1, Math.floor(s.length / 10))
      for (let i = 0; i < nFl; i++) {
        const u = (i + 0.5) / nFl
        const P = c.getPointAt(u); const T = c.getTangentAt(u)
        const { N } = frameAt(T)
        const fp = P.clone().addScaledVector(N, (i % 2 === 0 ? 1 : -1) * (R + 0.28)).addScaledVector(Y, 0.4)
        put(lights, fp, IDENT, 0.24, 0.34, 0.24, hot(bannerCols[i % bannerCols.length], 1.38))
      }
    }

    if (s.kind === 'salida' || s.kind === 'llegada') {
      const baseU = s.kind === 'salida' ? 0.04 : 0.96
      const stepU = s.kind === 'salida' ? 0.08 : -0.08
      for (let k = 0; k < 3; k++) {
        const u = THREE.MathUtils.clamp(baseU + k * stepU, 0.02, 0.98)
        const targetList = k === 0 ? mouthRings : rings
        put(targetList, c.getPointAt(u), aim(Z, c.getTangentAt(u)), R * (1.2 + k * 0.08), R * (1.2 + k * 0.08), R * (1.2 + k * 0.08), mouthC)
      }
    }

    // pilares con arcos y vigas
    const nPost = Math.floor(s.length / 10)
    for (let i = 0; i < nPost; i++) {
      const u = (i + 0.5) / nPost
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const h = 3.2
      const span = R * 1.05
      const baseY = P.y - R - h
      put(solids, new THREE.Vector3(P.x + N.x * span, baseY, P.z + N.z * span), IDENT, 0.13, h, 0.13, archC)
      put(solids, new THREE.Vector3(P.x - N.x * span, baseY, P.z - N.z * span), IDENT, 0.13, h, 0.13, archC)
      put(solids, new THREE.Vector3(P.x, P.y - R - 0.15, P.z), aim(Y, N), 0.14, span * 2.1, 0.14, archC)
      put(solids, new THREE.Vector3(P.x, baseY, P.z), aim(Y, N), 0.22, span * 2.3, 0.26, METAL)
      const braceL = P.clone().addScaledVector(Y, -R - 0.9).addScaledVector(N, span * 0.55)
      const braceR = P.clone().addScaledVector(Y, -R - 0.9).addScaledVector(N, -span * 0.55)
      put(solids, braceL, aim(Y, N.clone().multiplyScalar(-1).add(Y).normalize()), 0.09, span * 0.95, 0.09, archC)
      put(solids, braceR, aim(Y, N.clone().add(Y).normalize()), 0.09, span * 0.95, 0.09, archC)
    }

    // farolas a lo largo del tramo
    const nLamp = Math.floor(s.length / 14)
    for (let i = 0; i < nLamp; i++) {
      const u = (i + 0.35) / nLamp
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const side = i % 2 === 0 ? 1 : -1
      const baseP = P.clone().addScaledVector(N, side * (R + 0.18)).addScaledVector(Y, R * 0.25)
      put(solids, baseP, IDENT, 0.07, 1.35, 0.07, poleC)
      put(solids, baseP.clone().addScaledVector(Y, 1.3), aim(Y, N.clone().multiplyScalar(-side).addScaledVector(Y, 0.3).normalize()), 0.055, 0.6, 0.055, poleC)
      put(lights, baseP.clone().addScaledVector(Y, 1.45).addScaledVector(N, -side * 0.48), IDENT, 0.28, 0.28, 0.28, isSlow ? hot('#ffe0a3', 1.3) : lampC)
    }

    // flechas direccionales en el lomo del tubo (más densas en rutas rápidas)
    const arrStep = isFast ? 4.4 : 7.5
    const arrCol = isFast ? hot(V.rail, 1.38) : arrowC
    const nArr = Math.max(1, Math.floor(s.length / arrStep))
    for (let i = 0; i < nArr; i++) {
      const u = (i + 0.5) / nArr
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const topDir = Y.clone().addScaledVector(T, -T.dot(Y))
      if (topDir.lengthSq() < 0.01) topDir.copy(X)
      topDir.normalize()
      put(arrows, P.clone().addScaledVector(topDir, R + 0.22), aim(Z, T), 0.72, 0.72, isFast ? 1.05 : 0.85, arrCol)
    }

    // cartelito del obstáculo / evento al inicio del tramo
    const signKind = SIGN_CELLS[evSignKey(s)] ? evSignKey(s) : null
    if (s.kind !== 'salida' && s.kind !== 'llegada' && signKind) {
      const u = Math.min(0.12, 1.8 / Math.max(s.length, 1))
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const signBase = P.clone().addScaledVector(N, R + 0.35).addScaledVector(Y, R * 0.4)
      put(solids, signBase, IDENT, 0.06, 1.25, 0.06, METAL)
      const [col, row] = SIGN_CELLS[signKind]
      const signQ = aim(Z, N.clone().addScaledVector(T, -0.4).normalize())
      signs.push({
        m: new THREE.Matrix4().compose(signBase.clone().addScaledVector(Y, 1.35), signQ, new THREE.Vector3(1, 1, 1)),
        uv: [col * 0.25, 1 - (row + 1) / SIGN_ROWS],
      })
    }

    if (s.kind === 'embudo') {
      const A = c.getPoint(0); const B = c.getPoint(1); const ctr = new THREE.Vector3()
      for (let i = 0; i < 24; i++) ctr.add(c.getPoint(0.02 + (i / 23) * 0.28))
      ctr.divideScalar(24)
      const d = B.clone().sub(ctr).normalize(); const h = -A.clone().sub(B).dot(d)
      const rad = A.clone().sub(B).addScaledVector(d, h).length()
      if (h > 0.5) put(funnels, B.clone().addScaledVector(d, -h), aim(Y, d), rad * 2, h, rad * 2)
    } else if (s.kind === 'cascada' && !s.event) {
      let last = -9
      for (let i = 0; i <= 40; i++) {
        if (Math.abs(c.getTangentAt(i / 40).y) < 0.3 && i - last > 3) { last = i; put(discs, c.getPointAt(i / 40).addScaledVector(Y, -R - 0.15), IDENT, R * 3.2, 0.14, R * 3.2) }
      }
    }
  }

  // Landmarks distintivos del tema
  addLandmark(way, V, { cones, cyls: solids, boxes, octas, spheresA, lights, banners, rings, spinMeta, bladeMeta })

  // nudos (junctions): esfera de cristal, núcleo emisivo y anillos giratorios según fork / cross / merge
  way.junctions.forEach((j, i) => {
    put(spheres, j.pos, IDENT, r * 4)
    if (j.kind === 'fork') {
      put(lights, j.pos, IDENT, r * 0.85, r * 0.85, r * 0.85, hot('#4fe3ff', 1.35))
      spinMeta.push({ pos: j.pos, ex: 0.45, ey: i * 0.7, ez: 0.2, sx: 0.9, sy: 1.3, sz: 0.3, scale: r * 2.45, c: hot('#4fe3ff', 1.3) })
      spinMeta.push({ pos: j.pos, ex: -0.45, ey: i * 0.7, ez: -0.2, sx: -0.9, sy: 1.1, sz: -0.3, scale: r * 1.95, c: ribBase })
    } else if (j.kind === 'cross') {
      put(lights, j.pos, IDENT, r * 0.95, r * 0.95, r * 0.95, hot('#ffd859', 1.4))
      spinMeta.push({ pos: j.pos, ex: 0, ey: 0, ez: 0, sx: 1.1, sy: 0.8, sz: 0.2, scale: r * 2.65, c: hot('#ffd859', 1.3) })
      spinMeta.push({ pos: j.pos, ex: Math.PI / 2, ey: 0, ez: 0, sx: 0.2, sy: -1.2, sz: 0.9, scale: r * 2.15, c: ribBase })
      spinMeta.push({ pos: j.pos, ex: 0, ey: Math.PI / 2, ez: 0.4, sx: -0.8, sy: 0.4, sz: 1.3, scale: r * 1.65, c: hot(V.rail, 1.3) })
    } else {
      put(lights, j.pos, IDENT, r * 0.85, r * 0.85, r * 0.85, hot('#7affb2', 1.35))
      spinMeta.push({ pos: j.pos, ex: 0.3, ey: i * 0.5, ez: 0, sx: 0.4, sy: 1.4, sz: 0.4, scale: r * 2.5, c: hot('#7affb2', 1.28) })
      spinMeta.push({ pos: j.pos, ex: -0.3, ey: i * 0.5, ez: 0, sx: 0.4, sy: -1.4, sz: -0.4, scale: r * 1.85, c: ribBase })
    }
  })

  // decoración alrededor de los tubos
  const total = solid.reduce((a, s) => a + s.length, 0)
  const pick = (t) => { for (const s of solid) { if ((t -= s.length) <= 0) return s } return solid[solid.length - 1] }
  const decor = solid.length
    ? V.props.map((p, pi) => {
        const place = mulberry32(p.seed * 7919 + way.idx * 131)
        const look = mulberry32(p.seed * 104729 + pi * 31 + way.idx)
        const items = []; const n = Math.max(1, Math.floor(total * p.d))
        for (let i = 0; i < n; i++) {
          const s = pick(place() * total); const u = 0.04 + place() * 0.92; const ang = place() * TAU; const off = rr(place, p.off)
          const P = s.curve.getPointAt(u); const T = s.curve.getTangentAt(u)
          const col = new THREE.Color(p.c[Math.floor(look() * p.c.length)]).offsetHSL(0, 0, (look() - 0.5) * 0.08)
          if (p.e) col.multiplyScalar(typeof p.e === 'number' ? p.e : 1.3)
          if (p.ring) { const k = s.radius * rr(look, p.w); put(items, P, aim(Z, T), k, k, k, col); continue }
          const N = new THREE.Vector3().crossVectors(T, Math.abs(T.y) > 0.9 ? X : Y).normalize()
          const B = new THREE.Vector3().crossVectors(T, N)
          const dir = N.multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang))
          if (p.top && dir.y < 0.35) { dir.y = Math.abs(dir.y) + 0.35; dir.normalize() }
          const q = aim(Y, dir)
          if (p.tilt) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((look() - 0.5) * p.tilt * 2, look() * TAU, (look() - 0.5) * p.tilt * 2)))
          else q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, look() * TAU))
          const w = rr(look, p.w); const h = rr(look, p.h)
          put(items, P.addScaledVector(dir, s.radius + off + rr(look, p.y)), q, w, h, w, col)
        }
        return { p, items }
      })
    : []

  // partículas ambientales alrededor del recorrido
  const prng = mulberry32(way.idx * 977 + 5); const pp = []
  if (solid.length) {
    for (let i = 0; i < V.parts.n; i++) {
      const s = pick(prng() * total); const P = s.curve.getPointAt(prng())
      pp.push(P.x + (prng() - 0.5) * 7, P.y + (prng() - 0.5) * 7, P.z + (prng() - 0.5) * 7)
    }
  }

  return {
    tube: tubes.length ? mergeGeometries(tubes) : null,
    rail: rails.length ? mergeGeometries(rails) : null,
    floor: floors.length ? mergeGeometries(floors) : null,
    ribFrames, neonRims, mouthRings, panelPods, lightBars, windStreaks,
    rings, solids, cones, boxes, octas, glowOctas, bolts, spheres, spheresA, discs, funnels, decor,
    lights, banners, arrows, signs, spinMeta, bladeMeta, pulseMeta,
    dots: dots.length ? pointsGeo(dots) : null,
    parts: pointsGeo(pp),
    sparks: buildFxGeo(sparkBucket),
    fxGeos: {
      spray: buildFxGeo(fxBuckets.spray),
      smoke: buildFxGeo(fxBuckets.smoke),
      ember: buildFxGeo(fxBuckets.ember),
      foam: buildFxGeo(fxBuckets.foam),
      ring: buildFxGeo(fxBuckets.ring),
    },
  }
}

function evSignKey(s) {
  if (s.event && SIGN_CELLS[s.event]) return s.event
  return s.kind
}

// ═══════════════════════════ COMPONENTES R3F ═══════════════════════════
function Inst({ geo, mat, items, cast }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); if (it.c) o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={cast} receiveShadow={cast} frustumCulled={false} />
}

function PanelInst({ items, mat }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = GEO.panelPod.clone()
    const glowArr = new Float32Array(items.length * 3)
    items.forEach((it, i) => {
      glowArr[i * 3] = it.glow.r
      glowArr[i * 3 + 1] = it.glow.g
      glowArr[i * 3 + 2] = it.glow.b
    })
    g.setAttribute('aGlowColor', new THREE.InstancedBufferAttribute(glowArr, 3))
    return g
  }, [items])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); if (it.c) o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

function WindStreaksInst({ items, mat }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = GEO.streakCard.clone()
    const sArr = new Float32Array(items.length * 4)
    const cArr = new Float32Array(items.length * 3)
    items.forEach((it, i) => {
      sArr[i * 4] = it.seed
      sArr[i * 4 + 1] = it.speed
      sArr[i * 4 + 2] = it.span
      sArr[i * 4 + 3] = it.alpha
      cArr[i * 3] = it.c.r
      cArr[i * 3 + 1] = it.c.g
      cArr[i * 3 + 2] = it.c.b
    })
    g.setAttribute('aStreak', new THREE.InstancedBufferAttribute(sArr, 4))
    g.setAttribute('aStreakCol', new THREE.InstancedBufferAttribute(cArr, 3))
    return g
  }, [items])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setMatrixAt(i, it.m))
    o.instanceMatrix.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

function SignInst({ items, mat }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = GEO.sign.clone()
    const uvOff = new Float32Array(items.length * 2)
    items.forEach((it, i) => { uvOff[i * 2] = it.uv[0]; uvOff[i * 2 + 1] = it.uv[1] })
    g.setAttribute('aUvOffset', new THREE.InstancedBufferAttribute(uvOff, 2))
    return g
  }, [items])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setMatrixAt(i, it.m))
    o.instanceMatrix.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

const _spinMat = new THREE.Matrix4()
const _spinQ = new THREE.Quaternion()
const _spinE = new THREE.Euler()
const _spinS = new THREE.Vector3()
const _rotQ = new THREE.Quaternion()

function SpinRings({ meta, mat }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    meta.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [meta])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o) return
    const t = clock.elapsedTime
    for (let i = 0; i < meta.length; i++) {
      const it = meta[i]
      _spinE.set(it.ex + t * it.sx, it.ey + t * it.sy, it.ez + t * it.sz)
      _spinQ.setFromEuler(_spinE)
      _spinS.setScalar(it.scale)
      _spinMat.compose(it.pos, _spinQ, _spinS)
      o.setMatrixAt(i, _spinMat)
    }
    o.instanceMatrix.needsUpdate = true
  })
  if (!meta.length) return null
  return <instancedMesh ref={ref} args={[GEO.torus, mat, meta.length]} frustumCulled={false} />
}

function SpinBlades({ meta, mat }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    meta.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [meta])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o) return
    const t = clock.elapsedTime
    for (let i = 0; i < meta.length; i++) {
      const it = meta[i]
      _spinQ.setFromUnitVectors(Z, it.axis)
      _rotQ.setFromAxisAngle(it.axis, it.angle0 + t * it.speed)
      _spinQ.premultiply(_rotQ)
      _spinS.set(it.width, it.len, 1)
      _spinMat.compose(it.pos, _spinQ, _spinS)
      o.setMatrixAt(i, _spinMat)
    }
    o.instanceMatrix.needsUpdate = true
  })
  if (!meta.length) return null
  return <instancedMesh ref={ref} args={[GEO.blade, mat, meta.length]} frustumCulled={false} />
}

function PulseInst({ geo, mat, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [items])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o) return
    const t = clock.elapsedTime
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const p = Math.pow(Math.max(0, Math.sin(t * it.freq + it.phase)), 2)
      _spinS.set(it.baseScale[0] + it.amp[0] * p, it.baseScale[1] + it.amp[1] * p, it.baseScale[2] + it.amp[2] * p)
      _spinMat.compose(it.pos, it.q, _spinS)
      o.setMatrixAt(i, _spinMat)
    }
    o.instanceMatrix.needsUpdate = true
  })
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

function Way({ way, focused }) {
  const id = way.theme.id
  const focusU = useMemo(() => ({ value: 1 }), [])
  const mats = useMemo(() => createWayMaterials(id, focusU), [id, focusU])
  const d = useMemo(() => build(way), [way])

  const pulseRings = useMemo(() => d.pulseMeta.filter((p) => p.kind === 'ring'), [d.pulseMeta])
  const pulseCyls = useMemo(() => d.pulseMeta.filter((p) => p.kind === 'cyl'), [d.pulseMeta])
  const pulseLights = useMemo(() => d.pulseMeta.filter((p) => p.kind === 'light'), [d.pulseMeta])

  useFrame((_, dt) => {
    const target = focused ? 1 : 0
    const f = THREE.MathUtils.damp(focusU.value, target, 11, Math.min(dt, 0.1))
    focusU.value = f

    const writeDepth = f >= 0.98
    mats.deco.depthWrite = writeDepth
    mats.glow.depthWrite = writeDepth
    mats.decorGlow.depthWrite = writeDepth
    mats.rail.depthWrite = writeDepth
    mats.sign.depthWrite = writeDepth
    mats.floor.depthWrite = writeDepth
    mats.hull.depthWrite = writeDepth
    mats.panel.depthWrite = writeDepth
    mats.neonRim.depthWrite = writeDepth
  })

  return (
    <group>
      {d.tube && <mesh geometry={d.tube} material={mats.tube} />}
      {d.floor && <mesh geometry={d.floor} material={mats.floor} receiveShadow />}
      {d.rail && <mesh geometry={d.rail} material={mats.rail} />}
      <Inst geo={GEO.ribFrame} mat={mats.hull} items={d.ribFrames} cast />
      <Inst geo={GEO.ribNeon} mat={mats.neonRim} items={d.neonRims} />
      <Inst geo={GEO.mouthNeon} mat={mats.neonRim} items={d.mouthRings} />
      <PanelInst items={d.panelPods} mat={mats.panel} />
      <Inst geo={GEO.lightBar} mat={mats.lightBar} items={d.lightBars} />
      <WindStreaksInst items={d.windStreaks} mat={mats.windStreak} />
      <Inst geo={GEO.torus} mat={mats.glow} items={d.rings} />
      <Inst geo={GEO.cyl} mat={mats.deco} items={d.solids} cast />
      <Inst geo={GEO.cone} mat={mats.deco} items={d.cones} cast />
      <Inst geo={GEO.box} mat={mats.deco} items={d.boxes} cast />
      <Inst geo={GEO.octa} mat={mats.deco} items={d.octas} cast />
      <Inst geo={GEO.octa} mat={mats.decorGlow} items={d.glowOctas} />
      <Inst geo={GEO.bolt} mat={mats.decorGlow} items={d.bolts} />
      <Inst geo={GEO.sphere} mat={mats.glass} items={d.spheres} />
      <Inst geo={GEO.sphere} mat={mats.decoA} items={d.spheresA} />
      <Inst geo={GEO.cyl} mat={mats.glass} items={d.discs} />
      <Inst geo={GEO.funnel} mat={mats.glass} items={d.funnels} />
      <Inst geo={GEO.sphere} mat={mats.glow} items={d.lights} />
      <Inst geo={GEO.banner} mat={mats.deco} items={d.banners} />
      <Inst geo={GEO.arrow} mat={mats.glow} items={d.arrows} />
      <SpinRings meta={d.spinMeta} mat={mats.glow} />
      <SpinBlades meta={d.bladeMeta} mat={mats.deco} />
      <PulseInst geo={GEO.torus} mat={mats.glow} items={pulseRings} />
      <PulseInst geo={GEO.cyl} mat={mats.decoA} items={pulseCyls} />
      <PulseInst geo={GEO.sphere} mat={mats.glow} items={pulseLights} />
      <SignInst items={d.signs} mat={mats.sign} />
      {d.decor.map(({ p, items }, i) => {
        const solidMat = !p.e && (p.a ?? 1) >= 1
        return <Inst key={i} geo={GEO_BY[p.k]} mat={p.e ? mats.decorGlow : solidMat ? mats.deco : mats.decoA} items={items} cast={solidMat} />
      })}
      {d.dots && <points geometry={d.dots} material={mats.dots} frustumCulled={false} />}
      <points geometry={d.parts} material={mats.parts} frustumCulled={false} />
      {d.sparks && <points geometry={d.sparks} material={mats.sparks} frustumCulled={false} />}
      {Object.entries(d.fxGeos).map(([k, geo]) =>
        geo ? <points key={k} geometry={geo} material={mats.fx[k]} frustumCulled={false} /> : null
      )}
    </group>
  )
}

export default function Paths({ world, focusWay = null }) {
  useFrame(({ clock }) => {
    SHARED_TIME.value = clock.elapsedTime
  })
  return (
    <>
      {world.ways.map((w) => <Way key={w.idx} way={w} focused={focusWay == null || focusWay === w.idx} />)}
      {world.circuits.map((c) => {
        const active = focusWay == null || c.ways.some((w) => w.idx === focusWay)
        return (
          <WorldHtml key={c.idx} position={c.mid.clone().add(new THREE.Vector3(0, 2.4, 0))} center distanceFactor={22} zIndexRange={[5, 0]}>
            <div
              className="tag"
              style={{
                borderColor: VISUALS[c.theme.id].rail,
                opacity: active ? 1 : 0.16,
                filter: active ? 'none' : 'saturate(0.3) brightness(0.65)',
                transition: 'opacity 0.25s ease, filter 0.25s ease',
              }}
            >
              {c.theme.emoji} {c.theme.name.replace('Camino ', '')}
            </div>
          </WorldHtml>
        )
      })}
    </>
  )
}
