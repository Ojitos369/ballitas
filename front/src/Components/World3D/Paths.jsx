import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'
import { VISUALS } from './themes.js'
import WorldHtml from './WorldHtml.jsx'
import { applyLoadedImage } from './texUtils.js'
import { VidaDeCamino, VIDA_BUS } from './vida/index.js'
import { TunelBanda, createTunelMats } from './tunel.jsx'

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

function loadTex(filename, { srgb = false, repeat = [1, 1], clamp = false, cacheKey = null, makeFallback }) {
  const procKey = cacheKey || `${filename || 'proc'}:${srgb ? 1 : 0}:${repeat[0]},${repeat[1]}:${clamp ? 1 : 0}`
  if (texCache.has(procKey)) return texCache.get(procKey)

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

  texCache.set(procKey, tex)
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
        const grad = ctx.createLinearGradient(ox - 14, 0, ox + 36, 0)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.55, 'rgba(255,255,255,0.88)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
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

function getSoftOrbTex() {
  return loadTex(null, {
    srgb: false,
    clamp: true,
    makeFallback: function softOrbFallback() {
      return makeCanvas(128, 128, (ctx, w, h) => {
        ctx.clearRect(0, 0, w, h)
        const cx = w * 0.5; const cy = h * 0.5
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45)
        g.addColorStop(0, 'rgba(255,255,255,1)')
        g.addColorStop(0.18, 'rgba(255,255,255,0.82)')
        g.addColorStop(0.45, 'rgba(240,248,255,0.34)')
        g.addColorStop(0.75, 'rgba(220,240,255,0.08)')
        g.addColorStop(1, 'rgba(220,240,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      })
    },
  })
}

function getSparkleTex() {
  return loadTex('sparkle.png', {
    srgb: false,
    clamp: true,
    makeFallback: () => makeCanvas(128, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5; const cy = h * 0.5
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.25, 'rgba(255,255,255,0.68)')
      g.addColorStop(0.65, 'rgba(255,255,255,0.16)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.beginPath()
      ctx.ellipse(cx, cy, w * 0.36, w * 0.03, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(cx, cy, w * 0.03, w * 0.36, 0, 0, TAU)
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
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.44)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.32, 'rgba(235,250,255,0.62)')
      g.addColorStop(0.68, 'rgba(200,240,255,0.18)')
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
      for (const [cx, cy, rad, a] of [[32, 34, 22, 0.42], [24, 28, 15, 0.3], [40, 28, 15, 0.3]]) {
        const g = ctx.createRadialGradient(cx * k, cy * k, 0, cx * k, cy * k, rad * k)
        g.addColorStop(0, `rgba(255,255,255,${a})`)
        g.addColorStop(0.55, `rgba(255,255,255,${a * 0.35})`)
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
      g.addColorStop(0, 'rgba(255,255,245,1)')
      g.addColorStop(0.24, 'rgba(255,195,95,0.88)')
      g.addColorStop(0.6, 'rgba(255,95,25,0.32)')
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
      const cx = w * 0.5; const cy = h * 0.5
      const g = ctx.createRadialGradient(cx, cy, w * 0.08, cx, cy, w * 0.42)
      g.addColorStop(0, 'rgba(255,255,255,0.55)')
      g.addColorStop(0.55, 'rgba(255,255,255,0.85)')
      g.addColorStop(0.8, 'rgba(255,255,255,0.22)')
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
      const g = ctx.createRadialGradient(cx, cy, w * 0.16, cx, cy, w * 0.44)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.45, 'rgba(255,255,255,0.92)')
      g.addColorStop(0.75, 'rgba(255,255,255,0.38)')
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
    makeFallback: () => makeCanvas(128, 32, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const gx = ctx.createLinearGradient(0, 0, w, 0)
      gx.addColorStop(0, 'rgba(255,255,255,0)')
      gx.addColorStop(0.45, 'rgba(210,245,255,0.45)')
      gx.addColorStop(0.84, 'rgba(255,255,255,0.96)')
      gx.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = gx
      ctx.beginPath()
      ctx.moveTo(4, h * 0.5)
      ctx.quadraticCurveTo(w * 0.72, 3, w - 4, h * 0.5)
      ctx.quadraticCurveTo(w * 0.72, h - 3, 4, h * 0.5)
      ctx.fill()
    }),
  })
}

function getSparkTex() {
  return loadTex('spark.png', {
    srgb: false,
    clamp: true,
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const cx = w * 0.5; const cy = h * 0.5
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.45)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.28, 'rgba(255,225,170,0.85)')
      g.addColorStop(0.65, 'rgba(255,140,40,0.28)')
      g.addColorStop(1, 'rgba(255,90,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      ctx.beginPath()
      ctx.ellipse(cx, cy, w * 0.36, w * 0.05, 0, 0, TAU)
      ctx.fill()
    }),
  })
}

function heightFieldToNormalCanvas(w, h, hf, strength = 1.4) {
  return makeCanvas(w, h, (ctx) => {
    const img = ctx.createImageData(w, h)
    const d = img.data
    for (let y = 0; y < h; y++) {
      const ym = (y - 1 + h) % h
      const yp = (y + 1) % h
      for (let x = 0; x < w; x++) {
        const xm = (x - 1 + w) % w
        const xp = (x + 1) % w
        const dx = (hf[y * w + xp] - hf[y * w + xm]) * strength
        const dy = (hf[yp * w + x] - hf[ym * w + x]) * strength
        const len = Math.hypot(dx, dy, 1)
        const idx = (y * w + x) * 4
        d[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
        d[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
        d[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
        d[idx + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
  })
}

function getHullNormalTex() {
  return loadTex('hull_normal.png', {
    srgb: false,
    repeat: [2, 2],
    makeFallback: () => {
      const w = 256; const h = 256
      const hf = new Float32Array(w * h)
      const rng = mulberry32(9011)
      for (let i = 0; i < 160; i++) {
        const y0 = Math.floor(rng() * h)
        const amp = (rng() - 0.5) * 0.14
        for (let x = 0; x < w; x++) hf[y0 * w + x] += amp
      }
      for (let y = 0; y < h; y++) {
        const py = (y % 128) / 128
        const seamY = py < 0.04 || py > 0.96 ? -0.35 : 0
        for (let x = 0; x < w; x++) {
          const px = (x % 128) / 128
          const seamX = px < 0.04 || px > 0.96 ? -0.35 : 0
          hf[y * w + x] += seamX + seamY
        }
      }
      return heightFieldToNormalCanvas(w, h, hf, 1.8)
    },
  })
}

function getHullRoughnessTex() {
  return loadTex(null, {
    srgb: false,
    repeat: [2, 2],
    cacheKey: 'proc:hull_roughness',
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgb(92,92,92)'
      ctx.fillRect(0, 0, w, h)
      const rng = mulberry32(3041)
      for (let i = 0; i < 360; i++) {
        const v = Math.round(68 + rng() * 64)
        ctx.fillStyle = `rgb(${v},${v},${v})`
        ctx.fillRect(rng() * w, rng() * h, 18 + rng() * 52, 1.5)
      }
      ctx.strokeStyle = 'rgb(155,155,155)'
      ctx.lineWidth = 3
      ctx.strokeRect(4, 4, w - 8, h - 8)
      ctx.strokeRect(w * 0.5, 0, 1, h)
      ctx.strokeRect(0, h * 0.5, w, 1)
    }),
  })
}

function getFloorNormalTex() {
  return loadTex('asphalt_normal.png', {
    srgb: false,
    repeat: [2, 2],
    makeFallback: () => {
      const w = 256; const h = 256
      const hf = new Float32Array(w * h)
      for (let y = 0; y < h; y++) {
        const v = y / h
        const groove = Math.sin(v * TAU * 14) * 0.16
        for (let x = 0; x < w; x++) {
          const u = x / w
          hf[y * w + x] = groove + Math.sin(u * TAU * 6 + v * TAU * 2) * 0.05
        }
      }
      return heightFieldToNormalCanvas(w, h, hf, 1.4)
    },
  })
}

function getFloorRoughnessTex() {
  return loadTex(null, {
    srgb: false,
    repeat: [1, 1],
    cacheKey: 'proc:floor_roughness',
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h)
      g.addColorStop(0, 'rgb(142,142,142)')
      g.addColorStop(0.22, 'rgb(88,88,88)')
      g.addColorStop(0.5, 'rgb(64,64,64)')
      g.addColorStop(0.78, 'rgb(88,88,88)')
      g.addColorStop(1, 'rgb(142,142,142)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      const rng = mulberry32(5521)
      for (let i = 0; i < 240; i++) {
        const v = Math.round(55 + rng() * 65)
        ctx.fillStyle = `rgba(${v},${v},${v},0.35)`
        ctx.fillRect(rng() * w, rng() * h, 24 + rng() * 64, 1.5)
      }
    }),
  })
}

function getOrganicNormalTex() {
  return loadTex(null, {
    srgb: false,
    repeat: [2, 2],
    cacheKey: 'proc:organic_normal',
    makeFallback: () => {
      const w = 256; const h = 256
      const hf = new Float32Array(w * h)
      for (let y = 0; y < h; y++) {
        const ty = (y / h) * TAU
        for (let x = 0; x < w; x++) {
          const tx = (x / w) * TAU
          hf[y * w + x] =
            Math.sin(tx * 4 + Math.cos(ty * 3)) * 0.22 +
            Math.cos(ty * 7 - Math.sin(tx * 5)) * 0.14 +
            Math.sin(tx * 11 + ty * 9) * 0.06
        }
      }
      return heightFieldToNormalCanvas(w, h, hf, 1.2)
    },
  })
}

function getOrganicRoughnessTex() {
  return loadTex(null, {
    srgb: false,
    repeat: [2, 2],
    cacheKey: 'proc:organic_roughness',
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgb(156,156,156)'
      ctx.fillRect(0, 0, w, h)
      const rng = mulberry32(7103)
      for (let i = 0; i < 180; i++) {
        const r = 8 + rng() * 24
        const x = rng() * w; const y = rng() * h
        const v = Math.round(115 + rng() * 85)
        const g = ctx.createRadialGradient(x, y, 0, x, y, r)
        g.addColorStop(0, `rgba(${v},${v},${v},0.35)`)
        g.addColorStop(1, `rgba(${v},${v},${v},0)`)
        ctx.fillStyle = g
        ctx.fillRect(x - r, y - r, r * 2, r * 2)
      }
    }),
  })
}

function texRoughness(id) {
  return loadTex(null, {
    srgb: false,
    repeat: [1, 2],
    cacheKey: `proc:glass_roughness:${id}`,
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      ctx.fillStyle = 'rgb(28,28,28)'
      ctx.fillRect(0, 0, w, h)
      const rng = mulberry32(seedFromId(id) + 109)
      for (let i = 0; i < 65; i++) {
        const v = Math.round(14 + rng() * 38)
        ctx.strokeStyle = `rgba(${v},${v},${v},0.32)`
        ctx.lineWidth = 2 + rng() * 6
        const y = rng() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(w * 0.33, y + (rng() - 0.5) * 20, w * 0.66, y + (rng() - 0.5) * 20, w, y)
        ctx.stroke()
      }
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
    cacheKey: 'proc:sign_atlas',
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

// ═══════════════════════════ GEOMETRÍAS COMPARTIDAS Y ORGÁNICAS ═══════════════════════════
const base = (g) => (g.translate(0, 0.5, 0), g)

function mergeSafe(parts) {
  const clean = parts.map((g) => {
    const c = g.index ? g.toNonIndexed() : g
    if (!c.attributes.normal) c.computeVertexNormals()
    if (!c.attributes.uv) {
      const cnt = c.getAttribute('position').count
      c.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(cnt * 2), 2))
    }
    return c
  })
  const merged = mergeGeometries(clean, false)
  for (let i = 0; i < parts.length; i++) parts[i]?.dispose?.()
  for (let i = 0; i < clean.length; i++) {
    if (clean[i] !== parts[i]) clean[i]?.dispose?.()
  }
  return merged
}

function mergeAndDispose(geos) {
  if (!geos.length) return null
  const merged = mergeGeometries(geos, false)
  for (let i = 0; i < geos.length; i++) geos[i]?.dispose?.()
  merged?.computeBoundingSphere?.()
  return merged
}

function normalizeUnitHeight(g) {
  g.computeBoundingBox()
  const bb = g.boundingBox
  const cx = (bb.min.x + bb.max.x) * 0.5
  const cz = (bb.min.z + bb.max.z) * 0.5
  const h = Math.max(bb.max.y - bb.min.y, 1e-4)
  g.translate(-cx, -bb.min.y, -cz)
  g.scale(1 / h, 1 / h, 1 / h)
  g.computeVertexNormals()
  return g
}

function makeDeformedSphere(rad, ws, hs, seed, amp = 0.14, freq = 3.2, flattenBottom = false) {
  const g = new THREE.SphereGeometry(rad, ws, hs)
  const pos = g.attributes.position
  const s1 = (seed % 97) * 0.37
  const s2 = (seed % 53) * 0.61
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i); let y = pos.getY(i); let z = pos.getZ(i)
    const len = Math.hypot(x, y, z) || 1
    const nx = x / len; const ny = y / len; const nz = z / len
    const n =
      Math.sin(nx * freq + s1) * Math.cos(ny * (freq * 1.15) - s2) +
      0.5 * Math.sin(nz * (freq * 1.9) + ny * freq + s2)
    const sc = 1 + n * amp
    x *= sc; y *= sc; z *= sc
    if (flattenBottom && y < -rad * 0.48) y = -rad * 0.48 + (y + rad * 0.48) * 0.2
    pos.setXYZ(i, x, y, z)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

function buildRoundedBoxGeo(w = 1, h = 1, d = 1, radius = 0.085) {
  const r = Math.min(radius, w * 0.35, h * 0.35, d * 0.35)
  const g = new THREE.BoxGeometry(w, h, d, 2, 2, 2)
  const pos = g.attributes.position
  const norm = g.attributes.normal
  const hx = w * 0.5 - r; const hy = h * 0.5 - r; const hz = d * 0.5 - r
  const remap = (t, half) => {
    const a = Math.abs(t) / half
    const curved = a < 0.34 ? a * 1.65 : 0.56 + ((a - 0.34) / 0.66) * 0.44
    return Math.sign(t) * curved * half
  }
  for (let i = 0; i < pos.count; i++) {
    const px = remap(pos.getX(i), w * 0.5)
    const py = remap(pos.getY(i), h * 0.5)
    const pz = remap(pos.getZ(i), d * 0.5)
    const cx = THREE.MathUtils.clamp(px, -hx, hx)
    const cy = THREE.MathUtils.clamp(py, -hy, hy)
    const cz = THREE.MathUtils.clamp(pz, -hz, hz)
    const dx = px - cx; const dy = py - cy; const dz = pz - cz
    const len = Math.hypot(dx, dy, dz)
    if (len > 1e-5) {
      const inv = 1 / len
      pos.setXYZ(i, cx + dx * inv * r, cy + dy * inv * r + h * 0.5, cz + dz * inv * r)
      norm.setXYZ(i, dx * inv, dy * inv, dz * inv)
    } else {
      pos.setXYZ(i, px, py + h * 0.5, pz)
    }
  }
  pos.needsUpdate = true
  norm.needsUpdate = true
  return g
}

function buildSmoothConeGeo(rBot = 0.5, h = 1.0, radialSegs = 28) {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(rBot * 0.92, 0.0),
    new THREE.Vector2(rBot, 0.025 * h),
    new THREE.Vector2(rBot * 0.97, 0.06 * h),
    new THREE.Vector2(rBot * 0.52, 0.52 * h),
    new THREE.Vector2(rBot * 0.14, 0.92 * h),
    new THREE.Vector2(rBot * 0.05, 0.975 * h),
    new THREE.Vector2(0.0, h),
  ]
  const g = new THREE.LatheGeometry(pts, radialSegs)
  g.computeVertexNormals()
  return g
}

function buildSmoothCylGeo(r = 0.5, h = 1.0, radialSegs = 28) {
  const b = Math.min(0.028 * h, r * 0.15)
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(r - b, 0.0),
    new THREE.Vector2(r, b),
    new THREE.Vector2(r, h - b),
    new THREE.Vector2(r - b, h),
    new THREE.Vector2(0.0, h),
  ]
  const g = new THREE.LatheGeometry(pts, radialSegs)
  g.computeVertexNormals()
  return g
}

function buildSmoothOctaGeo() {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.18, 0.14),
    new THREE.Vector2(0.45, 0.44),
    new THREE.Vector2(0.48, 0.50),
    new THREE.Vector2(0.45, 0.56),
    new THREE.Vector2(0.18, 0.86),
    new THREE.Vector2(0.04, 0.975),
    new THREE.Vector2(0.0, 1.0),
  ]
  const g = new THREE.LatheGeometry(pts, 12)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r > 1e-4) {
      const ang = Math.atan2(z, x)
      const mod = 1 + 0.055 * Math.cos(ang * 6)
      pos.setX(i, x * mod)
      pos.setZ(i, z * mod)
    }
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

function buildRibFrameGeo() {
  const pts = [
    new THREE.Vector2(0.986, -0.095),
    new THREE.Vector2(1.015, -0.115),
    new THREE.Vector2(1.075, -0.105),
    new THREE.Vector2(1.084, -0.045),
    new THREE.Vector2(1.046, -0.018),
    new THREE.Vector2(1.046, 0.018),
    new THREE.Vector2(1.084, 0.045),
    new THREE.Vector2(1.075, 0.105),
    new THREE.Vector2(1.015, 0.115),
    new THREE.Vector2(0.986, 0.095),
    new THREE.Vector2(0.986, -0.095),
  ]
  const g = new THREE.LatheGeometry(pts, 10)
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

function buildCurvedPanelGeo(arcHalf = 0.37, rIn = 0.992, rOut = 1.056, segs = 4) {
  const pos = []
  const uv = []
  const idx = []
  const rMid = rOut - 0.018
  const zRings = [
    [-0.50, rIn, rMid],
    [-0.44, rIn, rOut],
    [0.44, rIn, rOut],
    [0.50, rIn, rMid],
  ]
  const stride = segs + 1
  const pushArc = (r, z, uVal, arcTrim = 0) => {
    const ah = arcHalf - arcTrim
    for (let i = 0; i <= segs; i++) {
      const t = i / segs
      const a = -ah + t * ah * 2
      pos.push(Math.sin(a) * r, Math.cos(a) * r, z)
      uv.push(uVal, t)
    }
  }
  // 4 anillos interiores + 4 exteriores con bisel suave en extremos y bordes
  zRings.forEach(([z, ri]) => pushArc(ri, z, z + 0.5, 0))
  zRings.forEach(([z, , ro], k) => pushArc(ro, z, z + 0.5, k === 0 || k === 3 ? 0.018 : 0))

  const quad = (a0, a1, b0, b1, flip = false) => {
    if (flip) idx.push(a0, b0, b1, a0, b1, a1)
    else idx.push(a0, a1, b1, a0, b1, b0)
  }
  for (let s = 0; s < 3; s++) {
    const iOff = s * stride
    const oOff = (4 + s) * stride
    for (let i = 0; i < segs; i++) {
      quad(iOff + i, iOff + i + 1, iOff + stride + i, iOff + stride + i + 1, true)
      quad(oOff + i, oOff + i + 1, oOff + stride + i, oOff + stride + i + 1, false)
    }
  }
  // Tapas front/back y bordes laterales
  for (let i = 0; i < segs; i++) {
    quad(i, i + 1, 4 * stride + i, 4 * stride + i + 1, false)
    quad(3 * stride + i, 3 * stride + i + 1, 7 * stride + i, 7 * stride + i + 1, true)
  }
  for (let s = 0; s < 3; s++) {
    const i0 = s * stride; const o0 = (4 + s) * stride
    quad(i0, o0, i0 + stride, o0 + stride, false)
    const i1 = s * stride + segs; const o1 = (4 + s) * stride + segs
    quad(i1, o1, i1 + stride, o1 + stride, true)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function buildLightBarGeo() {
  const g = new THREE.CapsuleGeometry(0.025, 0.94, 2, 5)
  g.rotateX(Math.PI / 2)
  const pos = g.getAttribute('position')
  const uv = g.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, THREE.MathUtils.clamp(pos.getZ(i) + 0.5, 0, 1), uv.getX(i))
  }
  uv.needsUpdate = true
  return g
}

function buildStreakCardGeo() {
  const p1 = new THREE.PlaneGeometry(1.0, 0.14)
  const p2 = new THREE.PlaneGeometry(1.0, 0.14)
  p2.rotateX(Math.PI / 2)
  return mergeAndDispose([p1, p2])
}

function buildBoltGeo() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -0.5),
    new THREE.Vector3(0.09, 0.05, -0.32),
    new THREE.Vector3(0.15, 0.09, -0.14),
    new THREE.Vector3(-0.02, 0.01, 0.02),
    new THREE.Vector3(-0.15, -0.07, 0.18),
    new THREE.Vector3(-0.07, -0.03, 0.35),
    new THREE.Vector3(0, 0, 0.5),
  ])
  return new THREE.TubeGeometry(curve, 12, 0.022, 6, false)
}

function buildVineGeo() {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, 0),
    new THREE.Vector3(0.06, -0.25, 0.04),
    new THREE.Vector3(-0.05, 0.0, 0.06),
    new THREE.Vector3(0.05, 0.25, -0.03),
    new THREE.Vector3(0, 0.5, 0),
  ])
  return new THREE.TubeGeometry(curve, 10, 0.046, 6, false)
}

function buildLeafGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.24, 0.22, 0.28, 0.65, 0, 1.0)
  s.bezierCurveTo(-0.28, 0.65, -0.24, 0.22, 0, 0)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.014,
    bevelSize: 0.014,
    bevelSegments: 1,
    curveSegments: 6,
  })
  g.translate(0, 0, -0.012)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setZ(i, pos.getZ(i) + Math.sin(y * Math.PI) * 0.08)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

function buildBladeGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0.02)
  s.bezierCurveTo(0.11, 0.2, 0.13, 0.68, 0.03, 0.98)
  s.quadraticCurveTo(0, 1.01, -0.03, 0.98)
  s.bezierCurveTo(-0.09, 0.65, -0.08, 0.22, 0, 0.02)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.01,
    bevelSegments: 1,
    curveSegments: 6,
  })
  g.translate(0, 0, -0.012)
  g.computeVertexNormals()
  return g
}

function buildBannerGeo() {
  const s = new THREE.Shape()
  s.moveTo(-0.28, 0)
  s.lineTo(0.28, 0)
  s.bezierCurveTo(0.26, -0.28, 0.16, -0.52, 0, -0.72)
  s.bezierCurveTo(-0.16, -0.52, -0.26, -0.28, -0.28, 0)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 6,
  })
  g.translate(0, 0, -0.012)
  const pos = g.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    pos.setZ(i, pos.getZ(i) + Math.sin(y * 6.5) * 0.035)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

function buildArrowGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0.34)
  s.bezierCurveTo(0.16, 0.14, 0.28, -0.04, 0.27, -0.22)
  s.quadraticCurveTo(0.12, -0.14, 0, -0.12)
  s.quadraticCurveTo(-0.12, -0.14, -0.27, -0.22)
  s.bezierCurveTo(-0.28, -0.04, -0.16, 0.14, 0, 0.34)
  const g = new THREE.ExtrudeGeometry(s, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 1,
    curveSegments: 6,
  })
  g.translate(0, 0, -0.03)
  g.rotateX(Math.PI / 2)
  g.computeVertexNormals()
  return g
}

function strutBetween(a, b, rad = 0.036, radialSegs = 6) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(rad, rad, Math.max(len, 1e-3), radialSegs)
  if (len > 1e-4) g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.divideScalar(len)))
  g.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5)
  return g
}

// Contrato clamp.glb: diámetro 1 (radio 0.5), ancho 0.15 en eje Z
function buildExtClampGeo() {
  const pts = [
    new THREE.Vector2(0.492, -0.068),
    new THREE.Vector2(0.515, -0.075),
    new THREE.Vector2(0.562, -0.042),
    new THREE.Vector2(0.546, -0.020),
    new THREE.Vector2(0.546, 0.020),
    new THREE.Vector2(0.562, 0.042),
    new THREE.Vector2(0.515, 0.075),
    new THREE.Vector2(0.492, 0.068),
    new THREE.Vector2(0.492, -0.068),
  ]
  const ring = new THREE.LatheGeometry(pts, 8)
  ring.rotateX(Math.PI / 2)
  ring.computeVertexNormals()
  return ring
}

function buildPylonGeo() {
  const parts = []
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]]
  const botR = 0.44
  const topR = 0.27
  const botP = corners.map(([sx, sz]) => new THREE.Vector3(sx * botR, 0.04, sz * botR))
  const midP = corners.map(([sx, sz]) => new THREE.Vector3(sx * 0.35, 0.5, sz * 0.35))
  const topP = corners.map(([sx, sz]) => new THREE.Vector3(sx * topR, 0.96, sz * topR))

  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    parts.push(strutBetween(botP[i], topP[i], 0.042, 4))
    parts.push(strutBetween(topP[i], topP[j], 0.034, 4))
  }
  const collar = new THREE.TorusGeometry(0.46, 0.024, 5, 10)
  collar.rotateX(Math.PI / 2)
  collar.translate(0, 0.5, 0)
  parts.push(collar)

  const saddle = new THREE.TorusGeometry(0.42, 0.038, 5, 8, Math.PI)
  saddle.rotateZ(Math.PI)
  saddle.translate(0, 1.0, 0)
  parts.push(saddle)

  const padPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.72, 0),
    new THREE.Vector2(0.74, 0.025),
    new THREE.Vector2(0.68, 0.065),
    new THREE.Vector2(0, 0.065),
  ]
  const pad = new THREE.LatheGeometry(padPts, 8)
  pad.computeVertexNormals()
  parts.push(pad)
  return mergeSafe(parts)
}

function buildTreeFallbackGeo() {
  const parts = []
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.04, 0.28, -0.02),
    new THREE.Vector3(-0.02, 0.56, 0.03),
  ])
  parts.push(new THREE.TubeGeometry(trunkCurve, 8, 0.065, 6, false))
  const brA = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.01, 0.38, 0),
    new THREE.Vector3(0.14, 0.52, 0.07),
  ])
  const brB = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.01, 0.42, 0.01),
    new THREE.Vector3(-0.15, 0.56, -0.06),
  ])
  parts.push(new THREE.TubeGeometry(brA, 4, 0.036, 5, false))
  parts.push(new THREE.TubeGeometry(brB, 4, 0.034, 5, false))

  const c1 = makeDeformedSphere(0.28, 10, 8, 11, 0.14, 3.4)
  c1.scale(1.15, 0.85, 1.15)
  c1.translate(0, 0.72, 0)
  const c2 = makeDeformedSphere(0.21, 8, 6, 23, 0.14, 3.8)
  c2.translate(0.18, 0.62, 0.09)
  const c3 = makeDeformedSphere(0.2, 8, 6, 37, 0.14, 3.6)
  c3.translate(-0.17, 0.64, -0.08)
  parts.push(c1, c2, c3)
  return normalizeUnitHeight(mergeSafe(parts))
}

function buildPineFallbackGeo() {
  const parts = []
  parts.push(buildSmoothCylGeo(0.065, 0.34, 8))
  const tier = (rBot, y0, h, seed) => {
    const pts = [
      new THREE.Vector2(0, y0),
      new THREE.Vector2(rBot, y0 + h * 0.10),
      new THREE.Vector2(rBot * 0.65, y0 + h * 0.42),
      new THREE.Vector2(rBot * 0.25, y0 + h * 0.80),
      new THREE.Vector2(0, y0 + h),
    ]
    const g = new THREE.LatheGeometry(pts, 12)
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i); const z = pos.getZ(i)
      const r = Math.hypot(x, z)
      if (r > 1e-4) {
        const ang = Math.atan2(z, x)
        const wave = 1 + 0.075 * Math.sin(ang * 7 + seed)
        pos.setX(i, x * wave)
        pos.setZ(i, z * wave)
      }
    }
    pos.needsUpdate = true
    g.computeVertexNormals()
    return g
  }
  parts.push(tier(0.44, 0.20, 0.40, 0.3))
  parts.push(tier(0.35, 0.44, 0.34, 1.4))
  parts.push(tier(0.24, 0.66, 0.34, 2.5))
  return normalizeUnitHeight(mergeSafe(parts))
}

function buildMushroomFallbackGeo() {
  const pts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.15, 0.0),
    new THREE.Vector2(0.11, 0.36),
    new THREE.Vector2(0.10, 0.56),
    new THREE.Vector2(0.45, 0.52),
    new THREE.Vector2(0.48, 0.68),
    new THREE.Vector2(0.30, 0.90),
    new THREE.Vector2(0.0, 1.0),
  ]
  const g = new THREE.LatheGeometry(pts, 12)
  g.computeVertexNormals()
  return g
}

function buildCrystalFallbackGeo() {
  const shard = (r, h, tiltX, tiltZ, ox, oz) => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(r, 0.06 * h),
      new THREE.Vector2(r * 0.84, 0.72 * h),
      new THREE.Vector2(r * 0.28, 0.94 * h),
      new THREE.Vector2(0, h),
    ]
    const g = new THREE.LatheGeometry(pts, 8)
    g.rotateX(tiltX)
    g.rotateZ(tiltZ)
    g.translate(ox, 0, oz)
    g.computeVertexNormals()
    return g
  }
  return normalizeUnitHeight(mergeSafe([
    shard(0.19, 1.0, 0.04, -0.05, 0, 0),
    shard(0.14, 0.68, -0.22, 0.24, 0.14, 0.08),
    shard(0.13, 0.56, 0.2, -0.26, -0.14, -0.07),
  ]))
}

function buildRockFallbackGeo() {
  const m = makeDeformedSphere(0.38, 10, 8, 41, 0.20, 2.8, true)
  m.scale(1.18, 0.82, 1.04)
  m.translate(0, 0.24, 0)
  const s1 = makeDeformedSphere(0.24, 8, 6, 73, 0.22, 3.2, true)
  s1.scale(1.1, 0.76, 0.95)
  s1.translate(0.25, 0.15, 0.12)
  const s2 = makeDeformedSphere(0.20, 8, 6, 97, 0.22, 3.5, true)
  s2.translate(-0.22, 0.14, -0.10)
  return normalizeUnitHeight(mergeSafe([m, s1, s2]))
}

function buildFlowerFallbackGeo() {
  const parts = []
  const stem = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.03, 0.3, 0.02),
    new THREE.Vector3(-0.02, 0.62, -0.02),
    new THREE.Vector3(0, 0.84, 0),
  ])
  parts.push(new THREE.TubeGeometry(stem, 6, 0.036, 5, false))

  const core = new THREE.SphereGeometry(0.12, 8, 6)
  core.scale(1.1, 0.72, 1.1)
  core.translate(0, 0.87, 0)
  parts.push(core)

  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU
    const p = new THREE.SphereGeometry(0.14, 8, 6)
    p.scale(0.85, 0.35, 1.35)
    p.rotateX(0.32)
    p.translate(0, 0, 0.20)
    p.rotateY(a)
    p.translate(0, 0.87, 0)
    parts.push(p)
  }
  return normalizeUnitHeight(mergeSafe(parts))
}

function buildCoralFallbackGeo() {
  const parts = []
  const branches = [
    [[0, 0, 0], [0.02, 0.35, 0.01], [0.05, 0.72, 0.03], [0.02, 0.96, 0.01]],
    [[0.02, 0.32, 0], [0.18, 0.50, 0.08], [0.24, 0.76, 0.12]],
    [[0.01, 0.40, 0], [-0.18, 0.58, 0.06], [-0.22, 0.82, 0.08]],
  ]
  for (let bi = 0; bi < branches.length; bi++) {
    const pts = branches[bi].map(([x, y, z]) => new THREE.Vector3(x, y, z))
    const rad = bi === 0 ? 0.068 : 0.048
    parts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 6, rad, 6, false))
    const tip = pts[pts.length - 1]
    const cap = new THREE.SphereGeometry(rad * 1.15, 8, 6)
    cap.translate(tip.x, tip.y, tip.z)
    parts.push(cap)
  }
  return normalizeUnitHeight(mergeSafe(parts))
}

function buildIceSpireFallbackGeo() {
  const spire = (r, h, ox, oz, tiltX, tiltZ) => {
    const pts = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(r, 0.06 * h),
      new THREE.Vector2(r * 0.72, 0.42 * h),
      new THREE.Vector2(r * 0.32, 0.78 * h),
      new THREE.Vector2(0, h),
    ]
    const g = new THREE.LatheGeometry(pts, 10)
    g.rotateX(tiltX)
    g.rotateZ(tiltZ)
    g.translate(ox, 0, oz)
    g.computeVertexNormals()
    return g
  }
  return normalizeUnitHeight(mergeSafe([
    spire(0.22, 1.0, 0, 0, 0.04, -0.03),
    spire(0.15, 0.64, 0.16, 0.09, -0.18, 0.2),
    spire(0.13, 0.54, -0.15, -0.08, 0.16, -0.22),
  ]))
}

function buildCactusFallbackGeo() {
  const parts = []
  const bodyPts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.13, 0.15),
    new THREE.Vector2(0.135, 0.65),
    new THREE.Vector2(0.11, 0.92),
    new THREE.Vector2(0, 1.0),
  ]
  const body = new THREE.LatheGeometry(bodyPts, 10)
  body.computeVertexNormals()
  parts.push(body)

  const arm = (side, y0, yTop) => {
    const c = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.09, y0, 0),
      new THREE.Vector3(side * 0.27, y0 + 0.03, 0),
      new THREE.Vector3(side * 0.30, y0 + 0.16, 0),
      new THREE.Vector3(side * 0.30, yTop, 0),
    ])
    parts.push(new THREE.TubeGeometry(c, 6, 0.072, 6, false))
    const cap = new THREE.SphereGeometry(0.072, 8, 6)
    cap.translate(side * 0.30, yTop, 0)
    parts.push(cap)
  }
  arm(1, 0.42, 0.78)
  arm(-1, 0.32, 0.68)
  return normalizeUnitHeight(mergeSafe(parts))
}

function buildLampFallbackGeo() {
  const parts = []
  const basePts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.18, 0),
    new THREE.Vector2(0.08, 0.14),
    new THREE.Vector2(0.055, 0.18),
  ]
  const baseG = new THREE.LatheGeometry(basePts, 10)
  baseG.computeVertexNormals()
  parts.push(baseG)

  const neck = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.15, 0),
    new THREE.Vector3(0, 0.68, 0),
    new THREE.Vector3(0.04, 0.89, 0),
    new THREE.Vector3(0.18, 0.96, 0),
    new THREE.Vector3(0.30, 0.90, 0),
  ])
  parts.push(new THREE.TubeGeometry(neck, 10, 0.042, 6, false))

  const hoodPts = [
    new THREE.Vector2(0, 0.94),
    new THREE.Vector2(0.16, 0.86),
    new THREE.Vector2(0, 0.87),
  ]
  const hood = new THREE.LatheGeometry(hoodPts, 10)
  hood.translate(0.30, 0, 0)
  hood.computeVertexNormals()
  parts.push(hood)
  return normalizeUnitHeight(mergeSafe(parts))
}

function buildPodFallbackGeo() {
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.32, 0.12),
    new THREE.Vector2(0.42, 0.42),
    new THREE.Vector2(0.38, 0.72),
    new THREE.Vector2(0.24, 0.96),
    new THREE.Vector2(0, 1.0),
  ]
  const g = new THREE.LatheGeometry(pts, 12)
  g.computeVertexNormals()
  return g
}

function buildRuinArchGeo() {
  const p1 = buildRoundedBoxGeo(0.32, 1.0, 0.28, 0.045)
  p1.translate(-0.22, 0, 0)
  const p2 = buildRoundedBoxGeo(0.28, 0.72, 0.26, 0.04)
  p2.rotateZ(0.08)
  p2.translate(0.24, 0, 0.04)
  const lintel = buildRoundedBoxGeo(0.92, 0.2, 0.32, 0.045)
  lintel.translate(0, -0.1, 0)
  lintel.rotateZ(-0.14)
  lintel.translate(0, 0.92, 0)
  return mergeSafe([p1, p2, lintel])
}

const GEO = {
  cone: buildSmoothConeGeo(0.5, 1.0, 8),
  funnel: base(new THREE.ConeGeometry(0.5, 1, 10, 1, true)),
  cyl: buildSmoothCylGeo(0.5, 1.0, 8),
  plume: base(new THREE.CylinderGeometry(0.34, 0.85, 1, 8, 1, true)),
  sphere: new THREE.SphereGeometry(0.5, 8, 6),
  box: buildRoundedBoxGeo(1, 1, 1, 0.085),
  octa: buildSmoothOctaGeo(),
  torus: new THREE.TorusGeometry(1, 0.042, 6, 14),
  ribNeon: new THREE.TorusGeometry(1, 0.024, 5, 12),
  mouthNeon: new THREE.TorusGeometry(1, 0.056, 6, 14),
  ribFrame: buildRibFrameGeo(),
  extClamp: buildExtClampGeo(),
  pylon: buildPylonGeo(),
  tree: buildTreeFallbackGeo(),
  pine: buildPineFallbackGeo(),
  mushroom: buildMushroomFallbackGeo(),
  crystal: buildCrystalFallbackGeo(),
  rock: buildRockFallbackGeo(),
  flower: buildFlowerFallbackGeo(),
  coral: buildCoralFallbackGeo(),
  ice_spire: buildIceSpireFallbackGeo(),
  cactus: buildCactusFallbackGeo(),
  lamp: buildLampFallbackGeo(),
  pod: buildPodFallbackGeo(),
  ruinPillar: buildRuinArchGeo(),
  panelPod: buildCurvedPanelGeo(),
  lightBar: buildLightBarGeo(),
  streakCard: buildStreakCardGeo(),
  bolt: buildBoltGeo(),
  vine: buildVineGeo(),
  leaf: buildLeafGeo(),
  blade: buildBladeGeo(),
  banner: buildBannerGeo(),
  arrow: buildArrowGeo(),
  sign: new THREE.PlaneGeometry(1.45, 0.72),
}
for (const k in GEO) GEO[k].name = 'paths:' + k // rastreo en ?stats=1 (__ballitasDebug)

const GEO_BY = {
  cone: GEO.cone,
  cyl: GEO.cyl,
  sphere: GEO.sphere,
  box: GEO.box,
  octa: GEO.octa,
  torus: GEO.torus,
  tree: GEO.tree,
  pine: GEO.pine,
  mushroom: GEO.mushroom,
  crystal: GEO.crystal,
  rock: GEO.rock,
  flower: GEO.flower,
  coral: GEO.coral,
  ice_spire: GEO.ice_spire,
  cactus: GEO.cactus,
  lamp: GEO.lamp,
  pylon: GEO.pylon,
  clamp: GEO.extClamp,
  pod: GEO.pod,
}

// ═══════════════════════════ MATERIALES Y SHADERS POR WAY ═══════════════════════════
// Multiplicadores moderados (1.1-1.35 base, ~1.9 solo en pulsos y bocas) para que el bloom no blanquee el color del tema.
const hot = (c, k = 1.25) => new THREE.Color(c).multiplyScalar(k)

function createTubeMat(id, focusU, detailU) {
  const V = VISUALS[id]
  const atmo = V.cine?.atmo ?? { mode: 0, c1: V.glass, c2: V.rail }
  const isIrid = id === 'cristal' || id === 'mar' || id === 'nubes' || id === 'jardin'
  const m = new THREE.MeshPhysicalMaterial({
    color: V.glass,
    vertexColors: true,
    map: texAlbedo(id),
    normalMap: texNormal(id),
    normalScale: new THREE.Vector2(0.42, 0.42),
    roughnessMap: texRoughness(id),
    emissive: new THREE.Color(V.rail),
    emissiveMap: texEmissive(id),
    emissiveIntensity: 0.24,
    transparent: true,
    opacity: 0.20,
    roughness: 0.065,
    metalness: 0.06,
    ior: 1.48,
    reflectivity: 0.92,
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#eef7ff'),
    clearcoat: 1.0,
    clearcoatRoughness: 0.045,
    iridescence: isIrid ? 0.52 : 0.22,
    iridescenceIOR: 1.33,
    envMapIntensity: 1.85,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFocus = focusU
    shader.uniforms.uDetail = detailU
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
        uniform float uDetail;
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
        float det = clamp(uDetail, 0.0, 1.0);
        vec3 tubeViewDir = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
        vec3 tubeNorm = length(normal) > 1e-5 ? normalize(normal) : vec3(0.0, 1.0, 0.0);
        float tubeNdv = abs(dot(tubeNorm, tubeViewDir));
        float tubeFresnel = pow(max(1e-4, 1.0 - tubeNdv), 2.5);
        // Refracción simulada y dispersión cromática sutil en los bordes del cristal
        float refractEdge = pow(max(1e-4, 1.0 - tubeNdv), 3.6);
        vec3 refractShift = mix(uGlassColor, mix(uAtmoA, uAtmoB, 0.5 + 0.5 * sin(vTubeUv.y * 6.28318)), refractEdge * 0.55);

        // Flujo continuo de energía a lo largo del tubo (doble onda + líneas de corriente)
        vec2 flowUv = vec2(fract(vTubeUv.x * 0.45 - uTime * 0.75), fract(vTubeUv.y * 2.0));
        vec4 flowTex = texture2D(uFlowMap, flowUv);
        float wavePulse = smoothstep(0.45, 1.0, sin(vTubeUv.x * 1.25 - uTime * 3.0) * 0.5 + 0.5);
        float streamWave = pow(max(1e-4, sin(vTubeUv.x * 0.85 - uTime * 2.1 + vTubeUv.y * 6.28318) * 0.5 + 0.5), 3.0);
        float flowMask = flowTex.a * (0.35 + 0.55 * wavePulse) + streamWave * 0.16;

        float baseGrime = smoothstep(-0.25, -0.85, vTubeWorldNormal.y) * det;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + vec3(0.05, 0.04, 0.03), baseGrime * 0.45);
        vec3 extCrystalCol = mix(vec3(0.45, 0.78, 1.0), refractShift, 0.54);
        diffuseColor.rgb = mix(extCrystalCol, mix(diffuseColor.rgb, refractShift, 0.28), det);

        // Costuras suaves de módulos de cristal y ambiente específico por tema (0..9)
        float seamX = smoothstep(0.96, 1.0, abs(cos(vTubeUv.x * 3.14159 * 0.9)));
        float seamY = smoothstep(0.97, 1.0, abs(cos(vTubeUv.y * 6.28318 * 4.0)));
        float seamMask = max(seamX, seamY) * mix(0.03, 0.12, det);
        vec3 atmoGlow = vec3(0.0);
        float atmoAlpha = 0.0;

        if (uAtmoMode < 0.5) {
          float fogWave = sin(vTubeUv.x * 1.1 - uTime * 0.8 + sin(vTubeUv.y * 12.56)) * 0.5 + 0.5;
          atmoGlow = mix(uAtmoA, uAtmoB, fogWave) * (0.28 * fogWave);
          atmoAlpha = fogWave * 0.08;
        } else if (uAtmoMode < 1.5) {
          float dapple = sin(vTubeUv.x * 2.2 + vTubeUv.y * 18.84 + uTime * 0.7) * cos(vTubeUv.x * 1.3 - uTime * 0.5);
          float m = smoothstep(0.2, 0.85, dapple * 0.5 + 0.5);
          atmoGlow = mix(uAtmoA, uAtmoB, m) * 0.22 * m;
        } else if (uAtmoMode < 2.5) {
          float c1 = sin(vTubeUv.x * 3.6 - uTime * 1.4 + sin(vTubeUv.y * 18.84 + uTime));
          float c2 = cos(vTubeUv.x * 2.8 + vTubeUv.y * 25.12 - uTime * 1.8);
          float caust = pow(clamp(1.0 - abs(c1 + c2) * 0.45, 0.0, 1.0), 3.0);
          atmoGlow = mix(uAtmoA, uAtmoB, caust) * caust * 0.45;
          atmoAlpha = caust * 0.08;
        } else if (uAtmoMode < 3.5) {
          float shimmer = sin(vTubeUv.x * 4.0 - uTime * 3.8 + sin(vTubeUv.y * 12.56) * 2.0) * 0.5 + 0.5;
          float sandBand = smoothstep(0.55, 0.98, shimmer) * (0.4 + 0.6 * smoothstep(0.2, -0.6, vTubeWorldNormal.y));
          atmoGlow = mix(uAtmoA, uAtmoB, sandBand) * sandBand * 0.3;
        } else if (uAtmoMode < 4.5) {
          float frostNoise = sin(vTubeUv.x * 11.0) * cos(vTubeUv.y * 37.7) * 0.5 + 0.5;
          float frost = clamp(seamMask * 2.4 + frostNoise * tubeFresnel * 0.7, 0.0, 1.0);
          atmoGlow = mix(uAtmoA, uAtmoB, frost) * frost * 0.38;
          atmoAlpha = frost * 0.1;
        } else if (uAtmoMode < 5.5) {
          float crack = pow(clamp(1.0 - abs(sin(vTubeUv.x * 2.9 + sin(vTubeUv.y * 18.84) * 1.6)), 0.0, 1.0), 5.0);
          float pulse = 0.65 + 0.35 * sin(uTime * 2.4 + vTubeUv.x * 1.7);
          float lowMask = smoothstep(0.35, -0.75, vTubeWorldNormal.y);
          atmoGlow = mix(uAtmoA, uAtmoB, crack) * crack * lowMask * pulse * 0.72;
        } else if (uAtmoMode < 6.5) {
          float irid = fract(tubeFresnel * 1.8 + vTubeUv.x * 0.25 + uTime * 0.12);
          vec3 prismCol = 0.5 + 0.5 * cos(6.28318 * (irid + vec3(0.0, 0.33, 0.67)));
          atmoGlow = mix(uAtmoA, prismCol, 0.65) * tubeFresnel * 0.48;
        } else if (uAtmoMode < 7.5) {
          float cloudWisp = sin(vTubeUv.x * 1.5 - uTime * 0.9) * cos(vTubeUv.y * 6.28318 + uTime * 0.4) * 0.5 + 0.5;
          float bolt = pow(max(0.0, sin(uTime * 5.2 + vTubeUv.x * 2.7)), 14.0) * smoothstep(0.7, 1.0, sin(vTubeUv.y * 25.12));
          atmoGlow = uAtmoA * cloudWisp * 0.2 + uAtmoB * bolt * 0.95;
          atmoAlpha = cloudWisp * 0.08;
        } else if (uAtmoMode < 8.5) {
          float gx = smoothstep(0.92, 1.0, abs(cos(vTubeUv.x * 6.28318 * 1.2)));
          float gy = smoothstep(0.92, 1.0, abs(cos(vTubeUv.y * 6.28318 * 8.0)));
          float grid = max(gx, gy);
          float scan = pow(max(0.0, sin(vTubeUv.x * 1.8 - uTime * 4.0)), 4.0);
          atmoGlow = mix(uAtmoA, uAtmoB, scan) * grid * (0.32 + 0.45 * scan);
        } else {
          float petalGlow = sin(vTubeUv.x * 1.8 - uTime * 1.1 + vTubeUv.y * 12.56) * 0.5 + 0.5;
          atmoGlow = mix(uAtmoA, uAtmoB, petalGlow) * tubeFresnel * 0.32;
        }

        vec3 activeAccent = uThemeColor;
        #ifdef USE_COLOR
          float hasEvCol = clamp((1.0 - min(vColor.r, min(vColor.g, vColor.b))) * 2.5, 0.0, 1.0);
          activeAccent = mix(uThemeColor, vColor, hasEvCol * 0.72);
        #endif

        vec3 fresnelTint = mix(extCrystalCol, refractShift, det);
        totalEmissiveRadiance = totalEmissiveRadiance * focusGlow * mix(0.25, 1.0, det)
          + (fresnelTint * tubeFresnel * mix(0.65, 0.38, det) + activeAccent * (flowMask * mix(0.55, 0.68, det) + seamMask * 0.45) + atmoGlow * mix(0.18, 1.0, det)) * focusGlow;`
      )
      .replace(
        '#include <dithering_fragment>',
        `float detD = clamp(uDetail, 0.0, 1.0);
        float tubeLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(vec3(tubeLum), gl_FragColor.rgb, mix(0.25, 1.0, uFocus)) * mix(0.28, 1.0, uFocus);
        float baseAlpha = mix(0.15, gl_FragColor.a, detD);
        gl_FragColor.a = clamp(baseAlpha + tubeFresnel * mix(0.42, 0.3, detD) + flowMask * mix(0.26, 0.32, detD) + baseGrime * 0.12 + seamMask * 0.25 + atmoAlpha * detD, 0.0, 0.88) * mix(0.15, 1.0, uFocus);
        #include <dithering_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'tube-flow-atmo-v6'
  return m
}

function createRailMat(focusU, detailU) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFocus = focusU
    shader.uniforms.uDetail = detailU
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRailUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRailUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uFocus;\nuniform float uDetail;\nvarying vec2 vRailUv;')
      .replace(
        '#include <opaque_fragment>',
        `float railWaveA = pow(max(1e-4, sin(vRailUv.x * 1.4 - uTime * 3.4) * 0.5 + 0.5), 3.0);
        float railWaveB = pow(max(1e-4, sin(vRailUv.x * 3.2 - uTime * 5.8) * 0.5 + 0.5), 5.0);
        float railPulse = (railWaveA * 0.55 + railWaveB * 0.45) * uFocus;
        vec3 railLit = outgoingLight * (0.95 + railPulse * 0.85);
        float railLum = dot(railLit, vec3(0.299, 0.587, 0.114));
        outgoingLight = mix(vec3(railLum), railLit, mix(0.25, 1.0, uFocus)) * mix(0.18, 1.0, uFocus);
        diffuseColor.a *= mix(0.14, 1.0, uFocus) * clamp(uDetail, 0.0, 1.0);
        #include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'rail-pulse-focus-v5'
  return m
}

function createExtCoreMat(focusU, detailU) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFocus = focusU
    shader.uniforms.uDetail = detailU
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vCoreUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCoreUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uFocus;\nuniform float uDetail;\nvarying vec2 vCoreUv;')
      .replace(
        '#include <opaque_fragment>',
        `float coreWaveA = pow(max(1e-4, sin(vCoreUv.x * 1.2 - uTime * 2.6) * 0.5 + 0.5), 3.0);
        float coreWaveB = 0.5 + 0.5 * sin(vCoreUv.x * 0.4 - uTime * 1.3);
        vec3 coreLit = outgoingLight * (0.82 + coreWaveA * 0.52 + coreWaveB * 0.18);
        float coreLum = dot(coreLit, vec3(0.299, 0.587, 0.114));
        outgoingLight = mix(vec3(coreLum), coreLit, mix(0.25, 1.0, uFocus)) * mix(0.2, 1.0, uFocus);
        float extA = 1.0 - clamp(uDetail, 0.0, 1.0);
        diffuseColor.a *= mix(0.18, 1.0, uFocus) * extA;
        if (diffuseColor.a < 0.01) discard;
        #include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'ext-core-flow-v2'
  return m
}

// lod: 'none' (siempre visible), 'interior' (uDetail), 'exterior' (1 - uDetail)
function withWayFade(mat, focusU, detailU, { minAlpha = 0.16, minBright = 0.25, minSat = 0.25, lod = 'none', scaleLod = false } = {}) {
  mat.transparent = true
  const prevCompile = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''
  const focusParams = { value: new THREE.Vector3(minAlpha, minBright, minSat) }
  const lodMode = lod === 'interior' ? 1 : lod === 'exterior' ? -1 : 0
  const lodParams = { value: new THREE.Vector2(lodMode, scaleLod ? 1 : 0) }
  mat.onBeforeCompile = (shader, renderer) => {
    if (prevCompile) prevCompile(shader, renderer)
    shader.uniforms.uFocus = focusU
    shader.uniforms.uFocusParams = focusParams
    shader.uniforms.uDetail = detailU
    shader.uniforms.uLodParams = lodParams
    if (scaleLod && lodMode !== 0) {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uDetail;\nuniform vec2 uLodParams;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          if (uLodParams.y > 0.5 && abs(uLodParams.x) > 0.5) {
            float _lodF = clamp(uLodParams.x > 0.0 ? uDetail : (1.0 - uDetail), 0.0, 1.0);
            transformed *= mix(0.32, 1.0, smoothstep(0.0, 0.65, _lodF));
          }`
        )
    }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFocus;\nuniform vec3 uFocusParams;\nuniform float uDetail;\nuniform vec2 uLodParams;')
      .replace(
        '#include <opaque_fragment>',
        `#include <opaque_fragment>
        float _fLum = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
        gl_FragColor.rgb = mix(vec3(_fLum), gl_FragColor.rgb, mix(uFocusParams.z, 1.0, uFocus)) * mix(uFocusParams.y, 1.0, uFocus);
        gl_FragColor.a *= mix(uFocusParams.x, 1.0, uFocus);
        if (abs(uLodParams.x) > 0.5) {
          float _lodA = clamp(uLodParams.x > 0.0 ? uDetail : (1.0 - uDetail), 0.0, 1.0);
          gl_FragColor.a *= _lodA;
          if (gl_FragColor.a < 0.008) discard;
        }`
      )
  }
  mat.customProgramCacheKey = () => `${prevKey ? `${prevKey}|` : ''}way-fade-v1${scaleLod && lodMode !== 0 ? '-sc' : ''}`
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

/** Material emisivo con falloff suave por Fresnel (núcleo luminoso y halo suave). */
function createFresnelGlowMat(focusU, detailU, fadeOpts, camFade = null, { core = 1.18, rim = 0.62, power = 1.85 } = {}) {
  const m = new THREE.MeshStandardMaterial({
    roughness: 0.78,
    metalness: 0.0,
    toneMapped: false,
  })
  const fresParams = { value: new THREE.Vector3(core, rim, power) }
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uGlowFresnel = fresParams
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uGlowFresnel;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 _gN = length(normal) > 1e-5 ? normalize(normal) : vec3(0.0, 1.0, 0.0);
        vec3 _gV = length(vViewPosition) > 1e-5 ? normalize(vViewPosition) : vec3(0.0, 0.0, 1.0);
        float _ndv = abs(dot(_gN, _gV));
        float _fres = mix(uGlowFresnel.y, uGlowFresnel.x, pow(_ndv, 0.72));
        float _rim = pow(clamp(1.0 - _ndv, 0.0, 1.0), uGlowFresnel.z) * 0.34;
        totalEmissiveRadiance += diffuseColor.rgb * (_fres + _rim);
        diffuseColor.rgb *= 0.08;`
      )
  }
  m.customProgramCacheKey = () => 'fresnel-glow-v1'
  const faded = withWayFade(m, focusU, detailU, fadeOpts)
  return camFade ? withCameraFade(faded, camFade[0], camFade[1]) : faded
}

function createSignMat(focusU, detailU) {
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
  return withWayFade(m, focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'interior', scaleLod: true })
}

function createPartsMat(id, focusU, detailU) {
  const { c, s, vy = 0, vx = 0.15, amp = 0.5, freq = 1.4, a = 0.6, glow = 1.25 } = VISUALS[id].parts
  const m = new THREE.PointsMaterial({
    color: hot(c, glow),
    map: getSoftOrbTex(),
    size: s * 3.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: a,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uMotion = { value: new THREE.Vector3(vx, vy, amp) }
    shader.uniforms.uFreq = { value: freq }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uMotion;\nuniform float uFreq;\nvarying float vPtPulse;')
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
        transformed.z += cos(uTime * uFreq * 0.9 + pPhase * 1.3) * uMotion.z;
        vPtPulse = 0.62 + 0.38 * sin(uTime * (uFreq * 1.3) + pPhase);`
      )
      .replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * (0.78 + 0.34 * vPtPulse);'
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPtPulse;')
      .replace(
        '#include <opaque_fragment>',
        `float _pr = length(gl_PointCoord - 0.5) * 2.0;
        float _pSoft = 1.0 - smoothstep(0.45, 0.98, _pr);
        diffuseColor.a *= vPtPulse * _pSoft;
        #include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'parts-motion-soft-v2'
  return withWayFade(m, focusU, detailU, { minAlpha: 0.15, minBright: 0.2, minSat: 0.25, lod: 'interior' })
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
      float cycle = fract(uTime * 0.48 + seed * 0.15);
      float burst = smoothstep(0.0, 0.22, cycle) * (1.0 - smoothstep(0.55, 0.96, cycle));
      float h = sin(cycle * 3.14159) * (1.8 + seed * 3.2);
      p += aDir * h + vec3(cos(seed * 41.0) * 0.25, 0.0, sin(seed * 37.0) * 0.25) * cycle;
      alpha = burst * 0.92;
    } else if (mode < 1.5) {
      float life = fract(uTime * spd + seed);
      p += aDir * (life * 3.6) + vec3(sin(uTime * 2.0 + seed * 19.0) * 0.28, life * life * -0.9, cos(uTime * 1.8 + seed * 23.0) * 0.28);
      alpha = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.65, 1.0, life)) * 0.95;
    } else if (mode < 2.5) {
      float life = fract(uTime * spd + seed);
      p.y -= life * 3.8;
      p.x += sin(life * 6.28 + seed * 13.0) * 0.14;
      alpha = smoothstep(0.0, 0.16, life) * (1.0 - smoothstep(0.68, 1.0, life)) * 0.85;
    } else if (mode < 3.5) {
      float life = fract(uTime * spd + seed);
      p += aDir * ((life - 0.35) * 4.5);
      alpha = smoothstep(0.0, 0.2, life) * (1.0 - smoothstep(0.65, 1.0, life)) * 0.8;
    } else if (mode < 4.5) {
      float tw = pow(max(1e-4, sin(uTime * spd + seed * 12.56) * 0.5 + 0.5), 3.0);
      alpha = 0.18 + tw * 0.82;
      sz *= (0.72 + tw * 0.68);
    } else if (mode < 5.5) {
      float life = fract(uTime * spd + seed);
      p += aDir * (life * 1.4);
      alpha = (1.0 - smoothstep(0.75, 1.0, life)) * smoothstep(0.0, 0.18, life) * 0.85;
      sz *= (0.55 + life * 0.85);
    } else {
      float life = fract(uTime * spd + seed);
      float ang = seed * 6.28318 + uTime * 3.2 + life * 4.0;
      float rad = (1.0 - life) * 1.65;
      vec3 upRef = abs(aDir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
      vec3 cSide = cross(aDir, upRef);
      vec3 side = dot(cSide, cSide) > 1e-6 ? normalize(cSide) : vec3(1.0, 0.0, 0.0);
      vec3 bin = cross(aDir, side);
      p += (side * cos(ang) + bin * sin(ang)) * rad;
      alpha = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.68, 1.0, life)) * 0.9;
    }

    vColor = aColor;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = sz * (340.0 / max(-mvPosition.z, 0.5));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FX_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uFocus;
  uniform float uDetail;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float rDist = length(gl_PointCoord - 0.5) * 2.0;
    float radialSoft = 1.0 - smoothstep(0.55, 0.98, rDist);
    if (radialSoft <= 0.002) discard;
    vec4 tex = texture2D(uTex, gl_PointCoord);
    float det = smoothstep(0.04, 0.95, clamp(uDetail, 0.0, 1.0));
    float a = tex.a * radialSoft * vAlpha * mix(0.14, 1.0, uFocus) * det;
    if (a < 0.005) discard;
    vec3 col = vColor * tex.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, mix(0.25, 1.0, uFocus)) * mix(0.22, 1.0, uFocus);
    gl_FragColor = vec4(col, a);
  }
`

function createEventFxMat(texKey, focusU, detailU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uDetail: detailU,
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

function createFloorMat(focusU, detailU) {
  const m = new THREE.MeshPhysicalMaterial({
    map: getChevronsRainbowTex(),
    normalMap: getFloorNormalTex(),
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: getFloorRoughnessTex(),
    roughness: 0.38,
    metalness: 0.54,
    clearcoat: 0.45,
    clearcoatRoughness: 0.18,
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
        float flowSweep = 0.88 + 0.22 * sin(vFloorUv.x * 1.4 - uTime * (1.8 + vFloorMeta.x * 2.2));
        vec3 warmCol = mix(feTex.rgb, feTex.rgb * vec3(1.18, 0.92, 0.65), vFloorMeta.z * 0.55);
        vec3 railEmissive = mix(feTex.rgb, vFloorAccent, 0.55) * railMask * glowMask * 1.15 * flowSweep;
        vec3 chevEmissive = warmCol * centerMask * glowMask * vFloorMeta.y * flowSweep;
        totalEmissiveRadiance = (railEmissive + chevEmissive);`
      )
  }
  m.customProgramCacheKey = () => 'floor-chevron-v2'
  return withWayFade(m, focusU, detailU, { minAlpha: 0.16, minBright: 0.25, minSat: 0.25, lod: 'interior' })
}

function createPanelMat(focusU, detailU) {
  const m = new THREE.MeshPhysicalMaterial({
    map: getPanelAlbedoTex(),
    normalMap: getPanelNormalTex(),
    normalScale: new THREE.Vector2(0.55, 0.55),
    roughnessMap: getHullRoughnessTex(),
    emissive: new THREE.Color('#ffffff'),
    emissiveMap: getPanelEmissiveTex(),
    emissiveIntensity: 1.15,
    roughness: 0.34,
    metalness: 0.76,
    clearcoat: 0.82,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.4,
  })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aGlowColor;\nvarying vec3 vPanelGlow;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanelGlow = aGlowColor;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vPanelGlow;')
  }
  m.customProgramCacheKey = () => 'panel-hull-v2'
  return withCameraFade(withWayFade(m, focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'interior' }), 0.85, 1.55)
}

function createHullMat(focusU, detailU) {
  const m = new THREE.MeshPhysicalMaterial({
    normalMap: getHullNormalTex(),
    normalScale: new THREE.Vector2(0.32, 0.32),
    roughnessMap: getHullRoughnessTex(),
    roughness: 0.32,
    metalness: 0.82,
    clearcoat: 0.88,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.45,
  })
  return withCameraFade(withWayFade(m, focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'interior' }), 0.85, 1.55)
}

function createLightBarMat(focusU, detailU) {
  const m = new THREE.MeshBasicMaterial({
    map: getLightbarTex(),
    transparent: true,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  return withCameraFade(withWayFade(m, focusU, detailU, { minAlpha: 0.14, minBright: 0.2, minSat: 0.25, lod: 'interior' }), 0.65, 1.35)
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
    float fade = smoothstep(0.0, 0.22, life) * (1.0 - smoothstep(0.68, 1.0, life));
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
  uniform float uDetail;
  varying vec2 vStreakUv;
  varying float vStreakAlpha;
  varying vec3 vStreakCol;

  void main() {
    vec4 tex = texture2D(uTex, vStreakUv);
    float edgeV = smoothstep(0.0, 0.2, vStreakUv.y) * smoothstep(1.0, 0.8, vStreakUv.y);
    float edgeU = smoothstep(0.0, 0.14, vStreakUv.x) * smoothstep(1.0, 0.86, vStreakUv.x);
    float det = smoothstep(0.04, 0.95, clamp(uDetail, 0.0, 1.0));
    float a = tex.a * edgeV * edgeU * vStreakAlpha * mix(0.12, 1.0, uFocus) * det;
    if (a < 0.005) discard;
    vec3 col = vStreakCol * tex.rgb;
    float lum = dot(col, vec3(0.299, 0.587, 0.114));
    col = mix(vec3(lum), col, mix(0.25, 1.0, uFocus)) * mix(0.22, 1.0, uFocus);
    gl_FragColor = vec4(col, a);
  }
`

function createWindStreakMat(focusU, detailU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uDetail: detailU,
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
    float fade = smoothstep(0.0, 0.18, life) * (1.0 - smoothstep(0.68, 1.0, life));
    vec3 p = position + aDir * ((life - 0.5) * span);
    p.x += sin(uTime * 4.2 + seed * 31.0) * 0.08;
    p.y += cos(uTime * 3.7 + seed * 23.0) * 0.08;

    vColor = aColor;
    vAlpha = fade * 0.92;
    vec4 mvPos = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = sz * (280.0 / max(-mvPos.z, 0.5));
    gl_Position = projectionMatrix * mvPos;
  }
`

function createSparkMat(focusU, detailU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uDetail: detailU,
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

function createExtPlumeMat(focusU, detailU) {
  const m = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vPlumeUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPlumeUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vPlumeUv;')
      .replace(
        '#include <opaque_fragment>',
        `float vFade = sin(clamp(vPlumeUv.y, 0.0, 1.0) * 3.14159265);
        float wisp = 0.72 + 0.28 * sin(vPlumeUv.y * 9.0 - uTime * 3.5 + vPlumeUv.x * 6.28318);
        diffuseColor.a *= vFade * vFade * wisp;
        #include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'ext-plume-v1'
  return withWayFade(m, focusU, detailU, { minAlpha: 0.14, minBright: 0.2, minSat: 0.25, lod: 'exterior' })
}

function createWayMaterials(id, focusU, detailU) {
  const V = VISUALS[id]
  const makeGlass = (lod) => withCameraFade(withWayFade(new THREE.MeshPhysicalMaterial({
    color: V.glass,
    normalMap: texNormal(id),
    normalScale: new THREE.Vector2(0.25, 0.25),
    roughnessMap: texRoughness(id),
    transparent: true,
    opacity: 0.24,
    roughness: 0.055,
    metalness: 0.08,
    ior: 1.46,
    reflectivity: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    iridescence: 0.35,
    iridescenceIOR: 1.33,
    envMapIntensity: 1.75,
    depthWrite: false,
    side: THREE.DoubleSide,
  }), focusU, detailU, { minAlpha: 0.18, minBright: 0.25, minSat: 0.25, lod }), 1.4, 2.2)

  const orgNorm = getOrganicNormalTex()
  const orgRough = getOrganicRoughnessTex()
  const hullNorm = getHullNormalTex()
  const hullRough = getHullRoughnessTex()

  const dotsMat = new THREE.PointsMaterial({
    color: hot(V.rail, 1.3),
    map: getSoftOrbTex(),
    size: 0.18,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
  dotsMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying float vDotPulse;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvDotPulse = 0.65 + 0.35 * sin(uTime * 3.4 + (position.x + position.y + position.z) * 0.45);'
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vDotPulse;')
      .replace(
        '#include <opaque_fragment>',
        `float _dr = length(gl_PointCoord - 0.5) * 2.0;
        float _dSoft = 1.0 - smoothstep(0.42, 0.98, _dr);
        diffuseColor.a *= vDotPulse * _dSoft;
        #include <opaque_fragment>`
      )
  }
  dotsMat.customProgramCacheKey = () => 'dots-soft-pulse-v1'

  return {
    tube: createTubeMat(id, focusU, detailU),
    // Exterior (uDetail -> 0)
    extCore: createExtCoreMat(focusU, detailU),
    extMetal: withWayFade(new THREE.MeshPhysicalMaterial({
      normalMap: hullNorm,
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: hullRough,
      roughness: 0.34,
      metalness: 0.84,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.35,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'exterior' }),
    extCable: withWayFade(new THREE.MeshPhysicalMaterial({
      color: '#2b3447',
      roughnessMap: hullRough,
      roughness: 0.44,
      metalness: 0.76,
      clearcoat: 0.55,
      clearcoatRoughness: 0.22,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'exterior' }),
    extFlora: withWayFade(new THREE.MeshStandardMaterial({
      normalMap: orgNorm,
      normalScale: new THREE.Vector2(0.24, 0.24),
      roughnessMap: orgRough,
      roughness: 0.72,
      metalness: 0.06,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'exterior', scaleLod: true }),
    extFloraGlow: createFresnelGlowMat(focusU, detailU, { minAlpha: 0.16, minBright: 0.2, minSat: 0.25, lod: 'exterior', scaleLod: true }),
    extRuins: withWayFade(new THREE.MeshStandardMaterial({
      normalMap: orgNorm,
      normalScale: new THREE.Vector2(0.32, 0.32),
      roughnessMap: orgRough,
      roughness: 0.82,
      metalness: 0.18,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'exterior', scaleLod: true }),
    extPlume: createExtPlumeMat(focusU, detailU),
    // Landmarks, nudos y siluetas de eventos (siempre visibles)
    lmDeco: withCameraFade(withWayFade(new THREE.MeshStandardMaterial({
      normalMap: orgNorm,
      normalScale: new THREE.Vector2(0.26, 0.26),
      roughnessMap: orgRough,
      roughness: 0.62,
      metalness: 0.2,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25 }), 1.9, 2.7),
    lmDecoA: withCameraFade(withWayFade(new THREE.MeshStandardMaterial({
      normalMap: orgNorm,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughnessMap: orgRough,
      roughness: 0.52,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25 }), 1.9, 2.7),
    lmGlow: createFresnelGlowMat(focusU, detailU, { minAlpha: 0.15, minBright: 0.2, minSat: 0.25 }, [1.2, 1.9], { core: 1.25, rim: 0.68, power: 1.7 }),
    lmGlass: makeGlass('none'),
    // Interior (uDetail -> 1)
    rail: createRailMat(focusU, detailU),
    floor: createFloorMat(focusU, detailU),
    hull: createHullMat(focusU, detailU),
    panel: createPanelMat(focusU, detailU),
    lightBar: createLightBarMat(focusU, detailU),
    neonRim: createFresnelGlowMat(focusU, detailU, { minAlpha: 0.15, minBright: 0.2, minSat: 0.25, lod: 'interior' }, [0.7, 1.35], { core: 1.22, rim: 0.72, power: 1.5 }),
    windStreak: createWindStreakMat(focusU, detailU),
    sparks: createSparkMat(focusU, detailU),
    deco: withCameraFade(withWayFade(new THREE.MeshStandardMaterial({
      normalMap: orgNorm,
      normalScale: new THREE.Vector2(0.26, 0.26),
      roughnessMap: orgRough,
      roughness: 0.66,
      metalness: 0.12,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'interior', scaleLod: true }), 1.9, 2.7),
    decoA: withCameraFade(withWayFade(new THREE.MeshStandardMaterial({
      normalMap: orgNorm,
      normalScale: new THREE.Vector2(0.2, 0.2),
      roughnessMap: orgRough,
      roughness: 0.5,
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    }), focusU, detailU, { minAlpha: 0.16, minBright: 0.28, minSat: 0.25, lod: 'interior', scaleLod: true }), 1.9, 2.7),
    glow: createFresnelGlowMat(focusU, detailU, { minAlpha: 0.15, minBright: 0.18, minSat: 0.25, lod: 'interior', scaleLod: true }, [1.2, 1.9], { core: 1.25, rim: 0.64, power: 1.8 }),
    decorGlow: createFresnelGlowMat(focusU, detailU, { minAlpha: 0.15, minBright: 0.18, minSat: 0.25, lod: 'interior', scaleLod: true }, [1.9, 2.7], { core: 1.22, rim: 0.66, power: 1.75 }),
    sign: withCameraFade(createSignMat(focusU, detailU), 1.7, 2.5),
    dots: withWayFade(dotsMat, focusU, detailU, { minAlpha: 0.16, minBright: 0.2, minSat: 0.25, lod: 'interior' }),
    parts: createPartsMat(id, focusU, detailU),
    fx: {
      spray: createEventFxMat('spray', focusU, detailU),
      smoke: createEventFxMat('smoke', focusU, detailU),
      ember: createEventFxMat('ember', focusU, detailU),
      foam: createEventFxMat('foam', focusU, detailU),
      ring: createEventFxMat('ring', focusU, detailU),
    },
  }
}

// ═══════════════════════════ HELPERS DE CONSTRUCCIÓN ═══════════════════════════
const put = (list, p, q, sx, sy = sx, sz = sx, c) => {
  if (list) list.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz)), c })
}
const aim = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to)
const rr = (rng, [a, b]) => a + rng() * (b - a)
const pointsGeo = (arr) => {
  const g = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
  g.computeBoundingSphere()
  if (g.boundingSphere) g.boundingSphere.radius += 5
  return g
}
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

const _qStep = new THREE.Quaternion()

function buildCurveFrames(curve, length, { maxSteps = 52, density = 0.62 } = {}) {
  // Muestreo adaptativo por curvatura + longitud para evitar quiebres en rizos, espirales y sacacorchos
  const preN = Math.min(80, Math.max(28, Math.ceil(length * 0.9)))
  const prePos = new Array(preN + 1)
  const preTan = new Array(preN + 1)
  const cdf = new Float32Array(preN + 1)
  let totalAng = 0
  for (let k = 0; k <= preN; k++) {
    const u = k / preN
    prePos[k] = curve.getPointAt(u)
    preTan[k] = curve.getTangentAt(u)
    if (k > 0) {
      const ds = prePos[k].distanceTo(prePos[k - 1])
      const dAng = preTan[k - 1].angleTo(preTan[k])
      totalAng += dAng
      cdf[k] = cdf[k - 1] + ds * 0.45 + dAng * 4.5 + 0.05
    }
  }
  const totalW = cdf[preN] || 1
  const steps = THREE.MathUtils.clamp(Math.ceil((length * 0.95 + totalAng * 9) * density), 12, maxSteps)

  const frames = new Array(steps + 1)
  const T0 = preTan[0]
  let down = Y.clone().negate().addScaledVector(T0, T0.y)
  if (down.lengthSq() < 0.02) down = frameAt(T0).N.clone().negate()
  down.normalize()

  let arc = 0
  let prevP = prePos[0]
  let prevT = T0.clone()
  let preIdx = 1
  for (let i = 0; i <= steps; i++) {
    let u = 0
    if (i === steps) u = 1
    else if (i > 0) {
      const targetW = (i / steps) * totalW
      while (preIdx < preN && cdf[preIdx] < targetW) preIdx++
      const w0 = cdf[preIdx - 1]; const w1 = cdf[preIdx]
      const frac = w1 > w0 ? (targetW - w0) / (w1 - w0) : 0
      u = (preIdx - 1 + frac) / preN
    }
    const pos = i === 0 ? prevP.clone() : curve.getPointAt(u)
    if (i > 0) arc += pos.distanceTo(prevP)
    prevP = pos
    const T = i === 0 ? T0.clone() : curve.getTangentAt(u)

    // Transporte paralelo discreto (Bishop) por cuaternión mínimo entre tangentes
    if (i > 0) {
      _qStep.setFromUnitVectors(prevT, T)
      down.applyQuaternion(_qStep)
      down.addScaledVector(T, -down.dot(T))
      if (down.lengthSq() < 1e-5) down = frameAt(T).N.clone().negate()
      down.normalize()
    }
    prevT.copy(T)

    const wd = Y.clone().negate().addScaledVector(T, T.y)
    if (wd.lengthSq() > 0.14) {
      wd.normalize()
      if (down.dot(wd) > 0.2) down.lerp(wd, 0.18).normalize()
    }
    const up = down.clone().negate()
    const right = new THREE.Vector3().crossVectors(up, T)
    if (right.lengthSq() < 1e-5) right.copy(frameAt(T).N)
    else right.normalize()
    frames[i] = { pos, T, up, right, arc, u }
  }
  return frames
}

function sampleCurveFrame(frames, u) {
  const tu = THREE.MathUtils.clamp(u, 0, 1)
  let lo = 0; let hi = frames.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid].u <= tu) lo = mid
    else hi = mid
  }
  const a = frames[lo]; const b = frames[hi]
  const span = b.u - a.u
  const alpha = span > 1e-6 ? THREE.MathUtils.clamp((tu - a.u) / span, 0, 1) : 0
  const pos = a.pos.clone().lerp(b.pos, alpha)
  const T = a.T.clone().lerp(b.T, alpha).normalize()
  const up = a.up.clone().lerp(b.up, alpha)
  up.addScaledVector(T, -up.dot(T))
  if (up.lengthSq() < 1e-5) up.copy(a.up)
  up.normalize()
  const right = new THREE.Vector3().crossVectors(up, T).normalize()
  return { pos, T, up, right }
}

function buildFramesTubeGeo(frames, radius, radialSegs, { offsetUp = 0, offsetRight = 0, uvScaleX = 0.25, color = WHITE_COL, eventColor = null } = {}) {
  const nF = frames.length
  const stride = radialSegs + 1
  const vCount = nF * stride
  const pos = new Float32Array(vCount * 3)
  const norm = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const col = new Float32Array(vCount * 3)
  const iCount = (nF - 1) * radialSegs * 6
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount)

  const cosA = new Float32Array(stride)
  const sinA = new Float32Array(stride)
  for (let j = 0; j <= radialSegs; j++) {
    const th = (j / radialSegs) * TAU
    cosA[j] = Math.cos(th)
    sinA[j] = Math.sin(th)
  }

  let vi = 0; let ui = 0
  const ringCol = new THREE.Color()
  for (let i = 0; i < nF; i++) {
    const f = frames[i]
    const cx = f.pos.x + f.up.x * offsetUp + f.right.x * offsetRight
    const cy = f.pos.y + f.up.y * offsetUp + f.right.y * offsetRight
    const cz = f.pos.z + f.up.z * offsetUp + f.right.z * offsetRight
    const uX = f.arc * uvScaleX

    if (eventColor) {
      const ramp = Math.min(THREE.MathUtils.smoothstep(f.u, 0.0, 0.13), 1.0 - THREE.MathUtils.smoothstep(f.u, 0.87, 1.0))
      ringCol.copy(color).lerp(eventColor, ramp)
    } else {
      ringCol.copy(color)
    }

    for (let j = 0; j <= radialSegs; j++) {
      const c = cosA[j]; const s = sinA[j]
      const nx = f.right.x * c + f.up.x * s
      const ny = f.right.y * c + f.up.y * s
      const nz = f.right.z * c + f.up.z * s
      pos[vi] = cx + nx * radius
      pos[vi + 1] = cy + ny * radius
      pos[vi + 2] = cz + nz * radius
      norm[vi] = nx
      norm[vi + 1] = ny
      norm[vi + 2] = nz
      col[vi] = ringCol.r
      col[vi + 1] = ringCol.g
      col[vi + 2] = ringCol.b
      vi += 3
      uv[ui] = uX
      uv[ui + 1] = j / radialSegs
      ui += 2
    }
  }

  let ii = 0
  for (let i = 0; i < nF - 1; i++) {
    const r0 = i * stride
    const r1 = (i + 1) * stride
    for (let j = 0; j < radialSegs; j++) {
      const a = r0 + j
      const b = r1 + j
      const c = r0 + j + 1
      const d = r1 + j + 1
      idx[ii++] = a; idx[ii++] = b; idx[ii++] = c
      idx[ii++] = b; idx[ii++] = d; idx[ii++] = c
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.BufferAttribute(norm, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

function buildTrackRailsGeo(frames, R, railCol) {
  // Riel dorsal superior + 2 rieles guía redondeados sobre los bordes de la pista
  const topRail = buildFramesTubeGeo(frames, 0.023, 5, { offsetUp: R * 0.985, uvScaleX: 0.25, color: railCol })
  const leftRail = buildFramesTubeGeo(frames, 0.020, 4, { offsetUp: -R * 0.858, offsetRight: -R * 0.399, uvScaleX: 0.25, color: railCol })
  const rightRail = buildFramesTubeGeo(frames, 0.020, 4, { offsetUp: -R * 0.858, offsetRight: R * 0.399, uvScaleX: 0.25, color: railCol })
  return mergeAndDispose([topRail, leftRail, rightRail])
}

const FLOOR_PROFILE = [
  [-0.51, 0.968],
  [-0.46, 0.946],
  [-0.41, 0.943],
  [-0.34, 0.964],
  [-0.22, 0.975],
  [0.0, 0.977],
  [0.22, 0.975],
  [0.34, 0.964],
  [0.41, 0.943],
  [0.46, 0.946],
  [0.51, 0.968],
]

function buildFloorSegmentGeo(s, frames, V, isFast, isSlow) {
  const R = s.radius
  const sk = s.speedK ?? 1
  const density = isFast ? 0.42 : isSlow ? 0.18 : (sk >= 1.25 ? 0.4 : sk <= 0.85 ? 0.2 : 0.28)
  const scroll = (isFast ? 0.95 : isSlow ? 0.34 : 0.58) * sk
  const glowMult = isFast ? 1.32 : isSlow ? 0.9 : 1.12
  const warmShift = isSlow ? 1.0 : 0.0
  const evHex = s.event ? (EVENT_ACCENTS[s.event] ?? V.rail) : (V.cine?.floor ?? V.rail)
  const acc = new THREE.Color(evHex)

  const nCols = FLOOR_PROFILE.length
  const nF = frames.length
  const vCount = nF * nCols
  const pos = new Float32Array(vCount * 3)
  const uv = new Float32Array(vCount * 2)
  const meta = new Float32Array(vCount * 3)
  const accent = new Float32Array(vCount * 3)
  const iCount = (nF - 1) * (nCols - 1) * 6
  const idx = vCount > 65535 ? new Uint32Array(iCount) : new Uint16Array(iCount)
  const dir = new THREE.Vector3()
  const down = new THREE.Vector3()

  let vi = 0; let ui = 0
  for (let i = 0; i < nF; i++) {
    const f = frames[i]
    down.copy(f.up).negate()
    const uCoord = f.arc * density
    for (let k = 0; k < nCols; k++) {
      const [a, radMult] = FLOOR_PROFILE[k]
      const rr = R * radMult
      dir.copy(down).multiplyScalar(Math.cos(a)).addScaledVector(f.right, Math.sin(a)).normalize()
      pos[vi] = f.pos.x + dir.x * rr
      pos[vi + 1] = f.pos.y + dir.y * rr
      pos[vi + 2] = f.pos.z + dir.z * rr
      meta[vi] = scroll; meta[vi + 1] = glowMult; meta[vi + 2] = warmShift
      accent[vi] = acc.r; accent[vi + 1] = acc.g; accent[vi + 2] = acc.b
      vi += 3
      uv[ui] = uCoord
      uv[ui + 1] = k / (nCols - 1)
      ui += 2
    }
  }
  let ii = 0
  for (let i = 0; i < nF - 1; i++) {
    for (let k = 0; k < nCols - 1; k++) {
      const a = i * nCols + k
      const b = (i + 1) * nCols + k
      const c = i * nCols + k + 1
      const d = (i + 1) * nCols + k + 1
      idx[ii++] = a; idx[ii++] = b; idx[ii++] = c
      idx[ii++] = b; idx[ii++] = d; idx[ii++] = c
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setAttribute('aFloorMeta', new THREE.BufferAttribute(meta, 3))
  g.setAttribute('aFloorAccent', new THREE.BufferAttribute(accent, 3))
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  g.computeVertexNormals()
  return g
}

function pushFxPoint(buckets, texKey, pos, dir, mode, seed, speed, size, col) {
  if (!buckets) return
  const b = buckets[texKey]
  if (!b) return
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
  g.computeBoundingSphere()
  if (g.boundingSphere) g.boundingSphere.radius += 6
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
    spinMeta?.push({ pos: basePos.clone().addScaledVector(Y, 6.7), ex: 0.3, ey: 0, ez: 0.2, sx: 0.5, sy: 1.2, sz: 0.3, scale: 1.15, c: glowC })
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
    spinMeta?.push({ pos: basePos.clone().addScaledVector(Y, 6.1), ex: Math.PI / 2, ey: 0, ez: 0, sx: 0, sy: 1.5, sz: 0, scale: 1.6, c: glowC })
  } else if (lm.kind === 'pyramid') {
    put(boxes, basePos, IDENT, 3.6, 1.2, 3.6, c2)
    put(boxes, basePos.clone().addScaledVector(Y, 1.2), IDENT, 2.4, 1.2, 2.4, c1)
    put(boxes, basePos.clone().addScaledVector(Y, 2.4), IDENT, 1.3, 1.1, 1.3, c2)
    put(octas, basePos.clone().addScaledVector(Y, 3.8), IDENT, 0.9, 1.1, 0.9, glowC)
  } else if (lm.kind === 'ice_spire') {
    put(cones, basePos, IDENT, 1.6, 5.4, 1.6, c1)
    put(octas, basePos.clone().addScaledVector(Y, 2.2).addScaledVector(N, 0.8), IDENT, 0.9, 2.4, 0.9, c2)
    put(octas, basePos.clone().addScaledVector(Y, 1.8).addScaledVector(N, -0.8), IDENT, 0.8, 2.0, 0.8, c2)
    spinMeta?.push({ pos: basePos.clone().addScaledVector(Y, 4.8), ex: 0.4, ey: 0.2, ez: 0, sx: 0.4, sy: 1.1, sz: 0.3, scale: 1.35, c: glowC })
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
    spinMeta?.push({ pos: basePos.clone().addScaledVector(Y, 3.2), ex: 0.5, ey: 0, ez: 0.5, sx: 0.8, sy: 1.4, sz: 0.6, scale: 1.75, c: glowC })
    put(lights, basePos.clone().addScaledVector(Y, 3.2), IDENT, 0.65, 0.65, 0.65, glowC)
  } else if (lm.kind === 'windmill') {
    put(cones, basePos, IDENT, 1.8, 4.8, 1.8, c1)
    const hub = basePos.clone().addScaledVector(Y, 4.2).addScaledVector(N, -side * 0.75)
    put(lights, hub, IDENT, 0.5, 0.5, 0.5, glowC)
    if (bladeMeta) {
      for (let k = 0; k < 4; k++) {
        bladeMeta.push({ pos: hub, axis: N.clone().multiplyScalar(-side), angle0: (k * Math.PI) / 2, speed: 1.4, len: 2.3, width: 0.35, c: k % 2 === 0 ? c2 : glowC })
      }
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
  const {
    cones, lmCones, lmCyls, lmLights, lmRings, mouthRings, ribFrames,
    lmSpinMeta, lmBladeMeta, lmPulseMeta, lmDiscs, fxBuckets,
    extPlumes, extPulseMeta,
  } = out

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
  if (lmPulseMeta) lmPulseMeta.push({ pos: P0, q: aim(Z, T0), baseScale: [R * 1.24, R * 1.24, R * 1.24], amp: [0.16, 0.16, 0.16], freq: pulseRate, phase: s.idx * 0.7, c: accCol, kind: 'ring' })
  put(lmLights, P0.clone().addScaledVector(N0, R + 0.35), IDENT, 0.22, 0.22, 0.22, accCol)
  put(lmLights, P0.clone().addScaledVector(N0, -(R + 0.35)), IDENT, 0.22, 0.22, 0.22, accCol)

  const Pmid = c.getPointAt(0.5)
  const Tmid = c.getTangentAt(0.5)
  const { N: Nmid } = frameAt(Tmid)
  const rng = mulberry32(s.idx * 613 + 29)

  if (ev === 'geiser') {
    const baseP = Pmid.clone().addScaledVector(Y, -R * 0.9)
    put(lmCones, baseP, IDENT, R * 2.2, 0.75, R * 2.2, new THREE.Color('#475c6c'))
    if (lmPulseMeta) {
      lmPulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.5), q: IDENT, baseScale: [R * 0.6, 2.8, R * 0.6], amp: [0.18, 2.4, 0.18], freq: 2.2, phase: s.idx, c: hot('#7be8ff', 1.25), kind: 'cyl' })
      lmPulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.25), q: aim(Z, Y), baseScale: [R * 1.1, R * 1.1, R * 1.1], amp: [0.9, 0.9, 0.9], freq: 2.2, phase: s.idx, c: new THREE.Color('#e0faff'), kind: 'ring' })
    }
    if (extPulseMeta) extPulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.5), q: IDENT, baseScale: [R * 0.72, 3.2, R * 0.72], amp: [0.22, 3.2, 0.22], freq: 2.2, phase: s.idx, c: hot('#7be8ff', 1.12) })
    if (fxBuckets) {
      for (let i = 0; i < 16; i++) {
        pushFxPoint(fxBuckets, 'spray', baseP.clone().addScaledVector(Y, 0.6), Y, 0, rng(), 1.0, 0.36 + rng() * 0.2, new THREE.Color('#b8f4ff'))
      }
      for (let i = 0; i < 8; i++) {
        pushFxPoint(fxBuckets, 'foam', baseP.clone().addScaledVector(Nmid, (rng() - 0.5) * R).addScaledVector(Y, 0.25), Y, 5, rng(), 0.55, 0.32, new THREE.Color('#ffffff'))
      }
    }
  } else if (ev === 'erupcion') {
    const Pcr = c.getPointAt(0.14)
    const baseP = Pcr.clone().addScaledVector(Y, -R * 0.85)
    put(lmCones, baseP, IDENT, R * 2.8, 1.35, R * 2.8, new THREE.Color('#2b1b17'))
    if (lmPulseMeta) lmPulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 1.1), q: IDENT, baseScale: [R * 0.85, R * 0.45, R * 0.85], amp: [0.22, 0.35, 0.22], freq: 3.1, phase: s.idx, c: hot('#ff5a1f', 1.65), kind: 'light' })
    if (extPulseMeta) extPulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 1.0), q: IDENT, baseScale: [R * 0.85, 3.0, R * 0.85], amp: [0.24, 2.8, 0.24], freq: 3.1, phase: s.idx, c: hot('#ff6b2b', 1.25) })
    if (fxBuckets) {
      for (let i = 0; i < 18; i++) {
        const dir = new THREE.Vector3((rng() - 0.5) * 0.7, 0.9 + rng() * 0.7, (rng() - 0.5) * 0.7).normalize()
        pushFxPoint(fxBuckets, 'ember', baseP.clone().addScaledVector(Y, 1.1), dir, 1, rng(), 0.75 + rng() * 0.4, 0.34 + rng() * 0.18, new THREE.Color('#ff8a2f'))
      }
      for (let i = 0; i < 10; i++) {
        pushFxPoint(fxBuckets, 'smoke', baseP.clone().addScaledVector(Y, 1.3), Y, 1, rng(), 0.32 + rng() * 0.15, 0.65 + rng() * 0.3, new THREE.Color('#5a4a44'))
      }
    }
  } else if (ev === 'cascada') {
    for (const u of [0.28, 0.55, 0.78]) {
      const Pw = c.getPointAt(u)
      put(lmDiscs, Pw.clone().addScaledVector(Y, -R - 2.6), IDENT, R * 2.8, 0.12, R * 2.8)
      put(extPlumes, Pw.clone().addScaledVector(Y, -R - 2.6), IDENT, R * 0.82, R * 1.4 + 2.5, R * 0.82, hot('#7be8ff', 1.05))
      if (fxBuckets) {
        for (let i = 0; i < 8; i++) {
          const offP = Pw.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.4).addScaledVector(Y, R * 1.6)
          pushFxPoint(fxBuckets, 'spray', offP, Y, 2, rng(), 0.65 + rng() * 0.35, 0.3 + rng() * 0.18, new THREE.Color('#a8ecff'))
        }
        for (let i = 0; i < 5; i++) {
          pushFxPoint(fxBuckets, 'foam', Pw.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.5).addScaledVector(Y, -R * 0.7), Y, 5, rng(), 0.45, 0.35, new THREE.Color('#eefaff'))
        }
      }
    }
  } else if (ev === 'turbina') {
    for (const u of [0.3, 0.7]) {
      const Pt = c.getPointAt(u)
      const Tt = c.getTangentAt(u)
      put(lmRings, Pt, aim(Z, Tt), R * 1.38, R * 1.38, R * 1.38, METAL)
      if (lmBladeMeta) {
        for (let k = 0; k < 4; k++) {
          lmBladeMeta.push({ pos: Pt, axis: Tt, angle0: (k * Math.PI) / 2, speed: 5.5, len: R * 1.25, width: 0.22, c: hot('#ffe866', 1.25) })
        }
      }
      if (fxBuckets) {
        for (let i = 0; i < 10; i++) {
          const { N: Nt, B: Bt } = frameAt(Tt)
          const ang = rng() * TAU
          const p = Pt.clone().addScaledVector(Nt, Math.cos(ang) * R * 0.6).addScaledVector(Bt, Math.sin(ang) * R * 0.6)
          pushFxPoint(fxBuckets, 'spray', p, Tt, 3, rng(), 1.4 + rng() * 0.6, 0.24, new THREE.Color('#fff7b0'))
        }
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
      const spireTarget = out.iceSpires || cones
      if (spireTarget) put(spireTarget, cp, aim(Y, Ni.clone().multiplyScalar(side).addScaledVector(Y, 0.6).normalize()), 0.45, 1.25, 0.45, new THREE.Color('#bdeeff'))
      pushFxPoint(fxBuckets, 'ring', Pi.clone().addScaledVector(Y, R * 0.6), Y, 4, rng(), 2.8 + rng() * 1.5, 0.35, new THREE.Color('#d8f8ff'))
    }
  } else if (ev === 'pantano') {
    for (const u of [0.25, 0.5, 0.75]) {
      const Pp = c.getPointAt(u)
      put(lmCyls, Pp.clone().addScaledVector(Y, -R * 1.12), IDENT, R * 1.85, 0.08, R * 1.85, new THREE.Color('#3b5928'))
      if (fxBuckets) {
        for (let i = 0; i < 6; i++) {
          const bp = Pp.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.4).addScaledVector(Y, -R * 0.65)
          pushFxPoint(fxBuckets, 'foam', bp, Y, 5, rng(), 0.28 + rng() * 0.2, 0.34 + rng() * 0.18, new THREE.Color('#9be066'))
        }
        pushFxPoint(fxBuckets, 'smoke', Pp.clone().addScaledVector(Y, -R * 0.3), Y, 5, rng(), 0.2, 0.8, new THREE.Color('#5a7a42'))
      }
    }
  } else if (ev === 'portal') {
    for (const u of [0.15, 0.85]) {
      const Ppt = c.getPointAt(u)
      const Tpt = c.getTangentAt(u)
      const q = aim(Z, Tpt)
      const e0 = new THREE.Euler().setFromQuaternion(q)
      if (lmSpinMeta) {
        lmSpinMeta.push({ pos: Ppt, ex: e0.x, ey: e0.y, ez: e0.z, sx: 0.6, sy: 1.5, sz: 1.2, scale: R * 1.55, c: hot('#ea80fc', 1.45) })
        lmSpinMeta.push({ pos: Ppt, ex: e0.x, ey: e0.y, ez: e0.z, sx: -0.9, sy: 1.1, sz: -1.6, scale: R * 1.18, c: hot('#4fe3ff', 1.4) })
      }
      if (fxBuckets) {
        for (let i = 0; i < 12; i++) {
          pushFxPoint(fxBuckets, 'ring', Ppt, Tpt, 6, rng(), 0.7 + rng() * 0.4, 0.3, new THREE.Color('#ea80fc'))
        }
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
  const { vines, leaves, iceSpires, crystals, flowers, pods, spheresA, lights, bolts, fxBuckets, sparkBucket } = out
  const side = bayIdx % 2 === 0 ? 1 : -1

  if (themeId === 'sombrio') {
    if (bayIdx % 2 === 0) {
      const lp = f.pos.clone().addScaledVector(f.right, side * R * 1.06).addScaledVector(f.up, R * 0.2)
      put(pods, lp.clone().addScaledVector(Y, -0.14), IDENT, 0.22, 0.32, 0.22, new THREE.Color('#211730'))
      put(lights, lp.clone().addScaledVector(Y, -0.05), IDENT, 0.22, 0.22, 0.22, hot('#c57aff', 1.35))
    }
    if (bayIdx % 3 === 0) {
      pushFxPoint(fxBuckets, 'smoke', f.pos.clone().addScaledVector(f.up, -R * 0.25), Y, 5, rng(), 0.22, 0.85, new THREE.Color('#4a2475'))
    }
  } else if (themeId === 'bosque') {
    // Lianas orgánicas curvas abrazando el cristal y hojas esculpidas + luciérnagas dentro del tubo
    const ang = side * (0.45 + rng() * 0.5)
    const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    const vp = f.pos.clone().addScaledVector(dir, R * 1.015)
    const qVine = aim(Y, f.T.clone().addScaledVector(f.right, side * 0.35).normalize())
    put(vines, vp, qVine, 0.9, bayLen * 0.85, 0.9, new THREE.Color('#2c7a38'))
    if (bayIdx % 2 === 1) {
      put(leaves, vp.clone().addScaledVector(dir, 0.06), aim(Y, dir), 0.34, 0.42, 0.34, new THREE.Color('#53b848'))
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
      const ip = f.pos.clone().addScaledVector(dir, R * 1.01)
      put(iceSpires, ip, aim(Y, dir), 0.34, 0.68, 0.34, new THREE.Color('#bceeff'))
    }
  } else if (themeId === 'volcan') {
    const ep = f.pos.clone().addScaledVector(f.right, (rng() - 0.5) * R * 1.0).addScaledVector(f.up, -R * 0.45)
    pushFxPoint(fxBuckets, 'ember', ep, Y, 1, rng(), 0.65 + rng() * 0.35, 0.24, new THREE.Color('#ff8429'))
    if (bayIdx % 2 === 1) {
      const lp = f.pos.clone().addScaledVector(f.right, side * R * 0.96).addScaledVector(f.up, -R * 0.35)
      put(crystals, lp, aim(Y, f.right.clone().multiplyScalar(side).addScaledVector(f.up, 0.5).normalize()), 0.32, 0.42, 0.32, hot('#ff4e1c', 1.35))
    }
  } else if (themeId === 'cristal') {
    const ang = side * (0.55 + (bayIdx % 3) * 0.35)
    const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    const cp = f.pos.clone().addScaledVector(dir, R * 1.0)
    put(crystals, cp, aim(Y, dir), 0.34, 0.64, 0.34, PRISM_COLS[bayIdx % PRISM_COLS.length])
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
      const np = f.pos.clone().addScaledVector(f.up, R * 0.94)
      put(pods, np, basisQuat(f.right, f.up, f.T), 0.18, bayLen * 0.42, 0.12, hot(bayIdx % 4 === 0 ? '#2bffe8' : '#ff2bd6', 1.35))
    }
  } else if (themeId === 'jardin') {
    const ang = side * (0.55 + rng() * 0.6)
    const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
    if (bayIdx % 2 === 0) {
      put(flowers, f.pos.clone().addScaledVector(dir, R * 1.01), aim(Y, dir), 0.34, 0.42, 0.34, PETAL_COLS[bayIdx % PETAL_COLS.length])
    }
    pushFxPoint({ s: sparkBucket }, 's', f.pos.clone().addScaledVector(f.up, (rng() - 0.3) * R * 0.7).addScaledVector(f.right, (rng() - 0.5) * R * 0.8), f.T, rng(), 0.32, 1.3, 0.22, PETAL_COLS[bayIdx % PETAL_COLS.length])
  }
}

const EXT_NEON_HEX = {
  sombrio: '#a24bff',
  bosque: '#4dff7a',
  mar: '#38d6ff',
  desierto: '#ffb347',
  hielo: '#7ce8ff',
  volcan: '#ff6028',
  cristal: '#c07eff',
  nubes: '#ffe169',
  neon: '#ff2bd6',
  jardin: '#ff6fa5',
}
const EXT_CLAMP_COL = new THREE.Color('#232c3d')
const EXT_PYLON_COL = new THREE.Color('#2c364b')
const EXT_RUIN_COLS = [new THREE.Color('#4f352d'), new THREE.Color('#3c2e2c')]
const EXT_TREE_COLS = [new THREE.Color('#192d38'), new THREE.Color('#20383a')]
const EXT_FLORA_GLOW_COLS = ['#2ee8c4', '#4eff8c', '#45b8ff'].map((c) => hot(c, 1.15))

const segFramesCache = new WeakMap()
function getSegFrames(seg) {
  let f = segFramesCache.get(seg)
  if (!f) {
    f = buildCurveFrames(seg.curve, seg.length)
    segFramesCache.set(seg, f)
  }
  return f
}

function buildExteriorBase(way) {
  const themeId = way.theme.id
  const V = VISUALS[themeId]
  const r = way.params.radius
  const ribBase = hot(V.rib, 1.25)
  const mouthC = hot(V.rail, 1.65)
  const dim = hot(V.rib, 0.8)
  const extNeonHex = EXT_NEON_HEX[themeId] ?? V.rail

  const tubes = []; const extCores = []; const extPlumes = []
  const mouthRings = []; const lmSolids = []; const lmRings = []; const lmLights = []; const lmSpinMeta = []

  for (const s of way.segments) {
    const c = s.curve; const R = s.radius

    addSegmentEvent(s, V, {
      cones: null, iceSpires: null, ribFrames: null, fxBuckets: null,
      lmCones: null, lmCyls: lmSolids, lmLights, lmRings, mouthRings,
      lmSpinMeta, lmBladeMeta: null, lmPulseMeta: null, lmDiscs: null, extPlumes, extPulseMeta: null,
    })

    if (s.air) {
      const P0 = c.getPoint(0); const T0 = c.getTangent(0); const P1 = c.getPoint(1); const T1 = c.getTangent(1)
      if (s.kind === 'trampolin') {
        const p = P0.clone().addScaledVector(Y, -0.35)
        put(lmSolids, p, IDENT, R * 3.4, 0.3, R * 3.4, new THREE.Color(V.rib).multiplyScalar(0.5))
        put(mouthRings, p.clone().addScaledVector(Y, 0.3), aim(Z, Y), R * 1.7, R * 1.7, R * 1.7, mouthC)
        put(mouthRings, P0.clone().addScaledVector(T0, 0.9), aim(Z, T0), R * 1.35, R * 1.35, R * 1.35, mouthC)
      } else if (s.kind === 'canon' || s.kind === 'erupcion') {
        put(mouthRings, P0, aim(Z, T0), R * 1.2, R * 1.2, R * 1.2, hot('#ff7a2f', 1.65))
        ;[0.8, 1.7].forEach((d, idx) => put(mouthRings, P0.clone().addScaledVector(T0, d), aim(Z, T0), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), hot('#ff9a3c', 1.55)))
      } else {
        put(mouthRings, P0, aim(Z, T0), R * 1.12, R * 1.12, R * 1.12, mouthC)
        put(lmSolids, P0.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 2.6, 0.18, R * 2.6, METAL)
      }
      put(mouthRings, P1, aim(Z, T1), R * 1.9, R * 1.9, R * 1.9, mouthC)
      put(lmRings, P1, aim(Z, T1), R * 1.25, R * 1.25, R * 1.25, dim)
      put(lmRings, P1, aim(Z, T1), R * 0.6, R * 0.6, R * 0.6, dim)
      continue
    }

    const frames = getSegFrames(s)
    const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
    const tubeTint = ev ? WHITE_COL.clone().lerp(new THREE.Color(EVENT_ACCENTS[ev]), 0.62) : null
    tubes.push(buildFramesTubeGeo(frames, R, 8, { uvScaleX: 0.25, color: WHITE_COL, eventColor: tubeTint }))

    const coreRad = Math.max(0.145, R * 0.148)
    const coreBase = routeColor(extNeonHex, s.route, 1.45)
    const coreCol = ev ? coreBase.clone().lerp(hot(EVENT_ACCENTS[ev], 1.4), 0.45) : coreBase
    extCores.push(buildFramesTubeGeo(frames, coreRad, 4, { offsetUp: -R * 0.12, uvScaleX: 0.25, color: coreCol }))

    if (s.kind === 'salida' || s.kind === 'llegada') {
      const baseU = s.kind === 'salida' ? 0.04 : 0.96
      const stepU = s.kind === 'salida' ? 0.08 : -0.08
      for (let k = 0; k < 3; k++) {
        const u = THREE.MathUtils.clamp(baseU + k * stepU, 0.02, 0.98)
        const targetList = k === 0 ? mouthRings : lmRings
        put(targetList, c.getPointAt(u), aim(Z, c.getTangentAt(u)), R * (1.2 + k * 0.08), R * (1.2 + k * 0.08), R * (1.2 + k * 0.08), mouthC)
      }
    }
  }

  addLandmark(way, V, {
    cones: null, cyls: lmSolids, boxes: null, octas: null, spheresA: null,
    lights: lmLights, banners: null, rings: lmRings, spinMeta: lmSpinMeta, bladeMeta: null,
  })

  way.junctions.forEach((j, i) => {
    if (j.kind === 'fork') {
      put(lmLights, j.pos, IDENT, r * 0.85, r * 0.85, r * 0.85, hot('#4fe3ff', 1.35))
      lmSpinMeta.push({ pos: j.pos, ex: 0.45, ey: i * 0.7, ez: 0.2, sx: 0.9, sy: 1.3, sz: 0.3, scale: r * 2.45, c: hot('#4fe3ff', 1.3) })
      lmSpinMeta.push({ pos: j.pos, ex: -0.45, ey: i * 0.7, ez: -0.2, sx: -0.9, sy: 1.1, sz: -0.3, scale: r * 1.95, c: ribBase })
    } else if (j.kind === 'cross') {
      put(lmLights, j.pos, IDENT, r * 0.95, r * 0.95, r * 0.95, hot('#ffd859', 1.4))
      lmSpinMeta.push({ pos: j.pos, ex: 0, ey: 0, ez: 0, sx: 1.1, sy: 0.8, sz: 0.2, scale: r * 2.65, c: hot('#ffd859', 1.3) })
      lmSpinMeta.push({ pos: j.pos, ex: Math.PI / 2, ey: 0, ez: 0, sx: 0.2, sy: -1.2, sz: 0.9, scale: r * 2.15, c: ribBase })
      lmSpinMeta.push({ pos: j.pos, ex: 0, ey: Math.PI / 2, ez: 0.4, sx: -0.8, sy: 0.4, sz: 1.3, scale: r * 1.65, c: hot(V.rail, 1.3) })
    } else {
      put(lmLights, j.pos, IDENT, r * 0.85, r * 0.85, r * 0.85, hot('#7affb2', 1.35))
      lmSpinMeta.push({ pos: j.pos, ex: 0.3, ey: i * 0.5, ez: 0, sx: 0.4, sy: 1.4, sz: 0.4, scale: r * 2.5, c: hot('#7affb2', 1.28) })
      lmSpinMeta.push({ pos: j.pos, ex: -0.3, ey: i * 0.5, ez: 0, sx: 0.4, sy: -1.4, sz: -0.4, scale: r * 1.85, c: ribBase })
    }
  })

  return {
    tube: mergeAndDispose(tubes),
    extCore: mergeAndDispose(extCores),
    extPlumes, lmSolids, lmRings, lmLights, lmSpinMeta, mouthRings,
  }
}

function buildExteriorNear(way) {
  const themeId = way.theme.id
  const V = VISUALS[themeId]
  const r = way.params.radius

  const extCables = []; const extClamps = []; const extPylons = []
  const extFlora = []; const extFloraGlow = []; const extRuins = []; const extPulseMeta = []
  const lmCones = []; const lmBoxes = []; const lmOctas = []
  const lmSpheres = []; const lmSpheresA = []; const lmDiscs = []; const lmFunnels = []
  const lmBanners = []; const lmBladeMeta = []; const lmPulseMeta = []

  const bayRng = mulberry32(way.idx * 8191 + 19)
  const pFrom = way.segments[0]?.curve.getPoint(0)
  const pTo = way.segments[way.segments.length - 1]?.curve.getPoint(1)
  let pylonCount = 0

  for (const s of way.segments) {
    const c = s.curve; const R = s.radius

    addSegmentEvent(s, V, {
      cones: null, iceSpires: null, ribFrames: null, fxBuckets: null,
      lmCones, lmCyls: null, lmLights: null, lmRings: null, mouthRings: null,
      lmSpinMeta: null, lmBladeMeta, lmPulseMeta, lmDiscs, extPlumes: null, extPulseMeta,
    })

    if (s.air) {
      const P0 = c.getPoint(0); const T0 = c.getTangent(0); const P1 = c.getPoint(1); const T1 = c.getTangent(1)
      if (s.kind === 'canon' || s.kind === 'erupcion') {
        ;[[0.5, 1.15], [1.1, 1.3], [1.7, 1.5]].forEach(([b, k]) => put(extClamps, P0.clone().addScaledVector(T0, -b), aim(Z, T0), R * k * 2.02, R * k * 2.02, 2.0, METAL))
      }
      put(lmDiscs, P1, aim(Y, T1), R * 3.8, 0.04, R * 3.8)
      continue
    }

    const frames = getSegFrames(s)
    const nClamps = Math.max(1, Math.round(s.length / 11))
    for (let i = 1; i < nClamps; i++) {
      const f = sampleCurveFrame(frames, i / nClamps)
      put(extClamps, f.pos, basisQuat(f.right, f.up, f.T), R * 2.02, R * 2.02, 1.85, EXT_CLAMP_COL)
    }

    const nPyl = Math.max(1, Math.floor(s.length / 18))
    const cableAnchorsL = []
    const cableAnchorsR = []
    for (let i = 0; i < nPyl; i++) {
      const u = (i + 0.5) / nPyl
      const f = sampleCurveFrame(frames, u)
      const nearPort = (pFrom && f.pos.distanceTo(pFrom) < 5.5) || (pTo && f.pos.distanceTo(pTo) < 5.5)
      if (!nearPort && Math.abs(f.T.y) < 0.72) {
        const pylH = 6.2 + bayRng() * 4.8
        const footPos = f.pos.clone().addScaledVector(Y, -R * 1.02 - pylH)
        put(extPylons, footPos, IDENT, R * 1.45, pylH, R * 1.45, EXT_PYLON_COL)
        cableAnchorsL.push(f.pos.clone().addScaledVector(Y, -R * 1.04).addScaledVector(f.right, R * 0.52))
        cableAnchorsR.push(f.pos.clone().addScaledVector(Y, -R * 1.04).addScaledVector(f.right, -R * 0.52))

        if (pylonCount % 2 === 0 && pylonCount < 8) {
          const side = pylonCount % 4 === 0 ? 1 : -1
          const bankPos = footPos.clone().addScaledVector(f.right, side * (R * 1.4 + 0.9))
          const treeSc = 2.0 + bayRng() * 1.3
          const treeQ = new THREE.Quaternion().setFromAxisAngle(Y, bayRng() * TAU)
          put(extFlora, bankPos, treeQ, treeSc, treeSc, treeSc, EXT_TREE_COLS[pylonCount % EXT_TREE_COLS.length])
          const glowCol = EXT_FLORA_GLOW_COLS[(way.idx + pylonCount) % EXT_FLORA_GLOW_COLS.length]
          put(extFloraGlow, bankPos.clone().addScaledVector(Y, treeSc * 0.88), treeQ, treeSc * 0.48, treeSc * 0.36, treeSc * 0.48, glowCol)
          put(extFloraGlow, bankPos.clone().addScaledVector(f.right, -side * 0.6).addScaledVector(Y, 0.08), IDENT, 0.52, 0.45, 0.52, glowCol)
          if (bayRng() > 0.38) {
            const ruinPos = footPos.clone().addScaledVector(f.right, -side * (R * 1.3 + 0.8))
            const ruinQ = new THREE.Quaternion().setFromAxisAngle(Y, bayRng() * TAU)
            put(extRuins, ruinPos, ruinQ, 1.5 + bayRng() * 0.9, 1.6 + bayRng() * 1.2, 1.5, EXT_RUIN_COLS[pylonCount % EXT_RUIN_COLS.length])
          }
        }
        pylonCount++
      }
    }
    for (const anchors of [cableAnchorsL, cableAnchorsR]) {
      for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i]; const b = anchors[i + 1]
        const dist = a.distanceTo(b)
        if (dist >= 6 && dist <= 24) {
          const mid = a.clone().lerp(b, 0.5).addScaledVector(Y, -dist * 0.16)
          const q1 = a.clone().lerp(mid, 0.5).addScaledVector(Y, -dist * 0.04)
          const q2 = b.clone().lerp(mid, 0.5).addScaledVector(Y, -dist * 0.04)
          extCables.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, q1, mid, q2, b]), 7, 0.042, 5, false))
        }
      }
    }

    if (s.kind === 'embudo') {
      const A = c.getPoint(0); const B = c.getPoint(1); const ctr = new THREE.Vector3()
      for (let i = 0; i < 24; i++) ctr.add(c.getPoint(0.02 + (i / 23) * 0.28))
      ctr.divideScalar(24)
      const d = B.clone().sub(ctr).normalize(); const h = -A.clone().sub(B).dot(d)
      const rad = A.clone().sub(B).addScaledVector(d, h).length()
      if (h > 0.5) put(lmFunnels, B.clone().addScaledVector(d, -h), aim(Y, d), rad * 2, h, rad * 2)
    } else if (s.kind === 'cascada' && !s.event) {
      let last = -9
      for (let i = 0; i <= 40; i++) {
        if (Math.abs(c.getTangentAt(i / 40).y) < 0.3 && i - last > 3) { last = i; put(lmDiscs, c.getPointAt(i / 40).addScaledVector(Y, -R - 0.15), IDENT, R * 3.2, 0.14, R * 3.2) }
      }
    }
  }

  addLandmark(way, V, {
    cones: lmCones, cyls: null, boxes: lmBoxes, octas: lmOctas, spheresA: lmSpheresA,
    lights: null, banners: lmBanners, rings: null, spinMeta: null, bladeMeta: lmBladeMeta,
  })

  for (const j of way.junctions) put(lmSpheres, j.pos, IDENT, r * 4)

  return {
    extCable: mergeAndDispose(extCables),
    extClamps, extPylons, extFlora, extFloraGlow, extRuins, extPulseMeta,
    lmCones, lmBoxes, lmOctas, lmSpheres, lmSpheresA, lmDiscs, lmFunnels,
    lmBanners, lmBladeMeta, lmPulseMeta,
  }
}

function buildInterior(way) {
  const themeId = way.theme.id
  const V = VISUALS[themeId]
  const cine = V.cine ?? {}
  const archC = new THREE.Color(V.arch?.c ?? '#3a3f4a')
  const poleC = new THREE.Color(V.lamp?.pole ?? '#3a3f4a')
  const lampC = hot(V.lamp?.c ?? V.rail, 1.28)
  const arrowC = hot(V.rail, 1.25)
  const bannerCols = (V.banner?.c ?? [V.rib, V.rail]).map((c) => new THREE.Color(c))
  const panelBaseCol = new THREE.Color(cine.panel?.base ?? '#1e2536')
  const panelGlowBase = cine.panel?.glow ?? V.rail
  const barBaseHex = cine.bar ?? '#ff6028'
  const neonBaseHex = cine.neon ?? V.rib

  const rails = []; const floors = []
  const ribFrames = []; const panelPods = []; const lightBars = []
  const neonRims = []; const windStreaks = []
  const solids = []; const cones = []; const boxes = []; const octas = []; const glowOctas = []; const bolts = []
  const vines = []; const leaves = []; const iceSpires = []; const crystals = []; const flowers = []; const pods = []; const lamps = []
  const spheresA = []; const dots = []
  const lights = []; const banners = []; const arrows = []; const signs = []
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

    const prof = s.route >= 0 ? way.routes?.[s.route]?.profile : null
    const isFast = s.route >= 0 && (prof ? prof.speed === 'rapida' : s.route === 0)
    const isSlow = s.route >= 0 && (prof ? prof.speed === 'lenta' : s.route === 1)
    const isSpec = s.route >= 0 && !isFast && !isSlow

    addSegmentEvent(s, V, {
      cones, iceSpires, ribFrames, fxBuckets,
      lmCones: null, lmCyls: null, lmLights: null, lmRings: null, mouthRings: null,
      lmSpinMeta: null, lmBladeMeta: null, lmPulseMeta: null, lmDiscs: null, extPlumes: null, extPulseMeta: null,
    })

    if (s.air) {
      addWindAndSparksForSegment(s, V, null, isFast, isSlow, { windStreaks, sparkBucket })
      const n = Math.ceil(s.length / 1.2)
      for (let i = 1; i < n; i++) dots.push(...c.getPoint(i / n).toArray())
      for (const u of [0.25, 0.5, 0.75]) {
        arrows.push({ m: new THREE.Matrix4().compose(c.getPointAt(u), aim(Z, c.getTangentAt(u)), new THREE.Vector3(0.75, 0.75, 0.9)), c: arrowC })
      }
      continue
    }

    const frames = getSegFrames(s)
    const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
    floors.push(buildFloorSegmentGeo(s, frames, V, isFast, isSlow))
    rails.push(buildTrackRailsGeo(frames, R, railCol))

    const baySpacing = isFast ? 4.0 : isSlow ? 4.8 : 4.4
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

      const slots = i % 2 === 0 ? PANEL_SLOTS_EVEN : PANEL_SLOTS_ODD
      for (const ang of slots) {
        const qPod = qBase.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, -ang))
        panelPods.push({
          m: new THREE.Matrix4().compose(f.pos, qPod, new THREE.Vector3(R, R, bayLen * 0.78)),
          c: bayFrameCol,
          glow: panelGlowCol,
        })
      }

      const barMask = i % 2 === 0 ? LIGHTBAR_ANGLES : [LIGHTBAR_ANGLES[0], LIGHTBAR_ANGLES[1]]
      for (const ang of barMask) {
        const dir = f.up.clone().multiplyScalar(Math.cos(ang)).addScaledVector(f.right, Math.sin(ang)).normalize()
        const bp = f.pos.clone().addScaledVector(dir, R * 0.955)
        const qBar = qBase.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Z, -ang))
        put(lightBars, bp, qBar, R, R, bayLen * 0.58, barCol)
      }

      addThemeBayProps(themeId, f, R, i, bayLen, bayRng, { vines, leaves, iceSpires, crystals, flowers, pods, spheresA, lights, bolts, fxBuckets, sparkBucket })

      if (i % 3 === 1 && s.length > 5) {
        const sideSign = i % 2 === 0 ? 1 : -1
        const bp = f.pos.clone().addScaledVector(f.right, sideSign * R * 1.15).addScaledVector(Y, -R * 0.22)
        put(banners, bp, IDENT, 0.75, 0.75, 0.75, bannerCols[i % bannerCols.length])
        const lCol = isSlow ? hot('#ffd99e', 1.24) : isSpec ? hot(bannerCols[i % bannerCols.length], 1.32) : lampC
        put(lights, bp.clone().addScaledVector(Y, -0.55), IDENT, 0.2, 0.2, 0.2, lCol)
      }
    }

    addWindAndSparksForSegment(s, V, frames, isFast, isSlow, { windStreaks, sparkBucket })

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

    const nPost = Math.floor(s.length / 12)
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

    const nLamp = Math.floor(s.length / 15)
    for (let i = 0; i < nLamp; i++) {
      const u = (i + 0.35) / nLamp
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const side = i % 2 === 0 ? 1 : -1
      const baseP = P.clone().addScaledVector(N, side * (R + 0.18)).addScaledVector(Y, R * 0.25)
      const inward = N.clone().multiplyScalar(-side)
      const lampFwd = new THREE.Vector3().crossVectors(inward, Y).normalize()
      const lampQ = lampFwd.lengthSq() > 1e-4 ? basisQuat(inward, Y, lampFwd) : IDENT
      put(lamps, baseP, lampQ, 0.72, 1.65, 0.72, poleC)
      put(lights, baseP.clone().addScaledVector(Y, 1.44).addScaledVector(inward, 0.36), IDENT, 0.26, 0.26, 0.26, isSlow ? hot('#ffe0a3', 1.3) : lampC)
    }

    const arrStep = isFast ? 5.2 : 8.5
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
  }

  const total = solid.reduce((a, s) => a + s.length, 0)
  const pick = (t) => { for (const s of solid) { if ((t -= s.length) <= 0) return s } return solid[solid.length - 1] }
  const decor = solid.length
    ? V.props.map((p, pi) => {
        const place = mulberry32(p.seed * 7919 + way.idx * 131)
        const look = mulberry32(p.seed * 104729 + pi * 31 + way.idx)
        const items = []; const n = Math.min(80, Math.max(1, Math.floor(total * p.d * 0.7)))
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

  const prng = mulberry32(way.idx * 977 + 5); const pp = []
  if (solid.length) {
    const nParts = Math.min(180, Math.round(V.parts.n * 0.7))
    for (let i = 0; i < nParts; i++) {
      const s = pick(prng() * total); const P = s.curve.getPointAt(prng())
      pp.push(P.x + (prng() - 0.5) * 7, P.y + (prng() - 0.5) * 7, P.z + (prng() - 0.5) * 7)
    }
  }

  return {
    rail: mergeAndDispose(rails),
    floor: mergeAndDispose(floors),
    ribFrames, neonRims, panelPods, lightBars, windStreaks,
    solids, cones, boxes, octas, glowOctas, bolts, spheresA,
    vines, leaves, iceSpires, crystals, flowers, pods, lamps, decor,
    lights, banners, arrows, signs,
    dots: dots.length ? pointsGeo(dots) : null,
    parts: pp.length ? pointsGeo(pp) : null,
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
function setConservativeSphere(o, points, pad = 2) {
  if (!o || !points.length) return
  let minX = Infinity; let minY = Infinity; let minZ = Infinity
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.z < minZ) minZ = p.z
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
    if (p.z > maxZ) maxZ = p.z
  }
  const cx = (minX + maxX) * 0.5
  const cy = (minY + maxY) * 0.5
  const cz = (minZ + maxZ) * 0.5
  const r = Math.hypot(maxX - cx, maxY - cy, maxZ - cz) + pad
  if (!o.boundingSphere) o.boundingSphere = new THREE.Sphere()
  o.boundingSphere.center.set(cx, cy, cz)
  o.boundingSphere.radius = r
}

function Inst({ geo, mat, items, cast = false }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); if (it.c) o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
    o.computeBoundingSphere?.()
  }, [items, geo, mat])

  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={cast} receiveShadow={cast} />
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
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); if (it.c) o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
    o.computeBoundingSphere?.()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />
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
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setMatrixAt(i, it.m))
    o.instanceMatrix.needsUpdate = true
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
    o.computeBoundingSphere?.()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />
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
  useEffect(() => () => geo.dispose(), [geo])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setMatrixAt(i, it.m))
    o.instanceMatrix.needsUpdate = true
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
    o.computeBoundingSphere?.()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />
}

const _spinMat = new THREE.Matrix4()
const _spinQ = new THREE.Quaternion()
const _spinE = new THREE.Euler()
const _spinS = new THREE.Vector3()
const _rotQ = new THREE.Quaternion()

function updateSpinRingsMesh(o, meta, t, detailVal, lastUpdRef) {
  if (!o || !meta.length || (o.parent && !o.parent.visible)) return
  if (detailVal < 0.05 && t - lastUpdRef.current < 0.14) return
  lastUpdRef.current = t
  for (let i = 0; i < meta.length; i++) {
    const it = meta[i]
    _spinE.set(it.ex + t * it.sx, it.ey + t * it.sy, it.ez + t * it.sz)
    _spinQ.setFromEuler(_spinE)
    _spinS.setScalar(it.scale)
    _spinMat.compose(it.pos, _spinQ, _spinS)
    o.setMatrixAt(i, _spinMat)
  }
  o.instanceMatrix.needsUpdate = true
}

function SpinRings({ meta, mat, meshRef }) {
  useLayoutEffect(() => {
    const o = meshRef.current
    if (!o) return
    for (let i = 0; i < meta.length; i++) {
      const it = meta[i]
      _spinE.set(it.ex, it.ey, it.ez)
      _spinQ.setFromEuler(_spinE)
      _spinS.setScalar(it.scale)
      _spinMat.compose(it.pos, _spinQ, _spinS)
      o.setMatrixAt(i, _spinMat)
      o.setColorAt(i, it.c)
    }
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
    setConservativeSphere(o, meta.map((m) => m.pos), 6)
  }, [meta, meshRef])
  if (!meta.length) return null
  return <instancedMesh ref={meshRef} args={[GEO.torus, mat, meta.length]} />
}

function SpinBlades({ meta, mat, detailU }) {
  const ref = useRef()
  const lastUpd = useRef(-10)
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    meta.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
    setConservativeSphere(o, meta.map((m) => m.pos), 5)
  }, [meta])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o || (o.parent && !o.parent.visible)) return
    const t = clock.elapsedTime
    if (detailU && detailU.value < 0.05 && t - lastUpd.current < 0.14) return
    lastUpd.current = t
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
  return <instancedMesh ref={ref} args={[GEO.blade, mat, meta.length]} />
}

function PulseInst({ geo, mat, items, detailU }) {
  const ref = useRef()
  const lastUpd = useRef(-10)
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
    setConservativeSphere(o, items.map((m) => m.pos), 6)
  }, [items])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o || (o.parent && !o.parent.visible)) return
    const t = clock.elapsedTime
    if (detailU && detailU.value < 0.05 && t - lastUpd.current < 0.14) return
    lastUpd.current = t
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
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} />
}

function WayInterior({ way, mats }) {
  const d = useMemo(() => buildInterior(way), [way])
  useEffect(() => () => {
    d.rail?.dispose?.()
    d.floor?.dispose?.()
    d.dots?.dispose?.()
    d.parts?.dispose?.()
    d.sparks?.dispose?.()
    if (d.fxGeos) {
      for (const k in d.fxGeos) d.fxGeos[k]?.dispose?.()
    }
  }, [d])

  return (
    <>
      {d.floor && <mesh geometry={d.floor} material={mats.floor} receiveShadow />}
      {d.rail && <mesh geometry={d.rail} material={mats.rail} />}
      <Inst geo={GEO.ribFrame} mat={mats.hull} items={d.ribFrames} />
      <Inst geo={GEO.ribNeon} mat={mats.neonRim} items={d.neonRims} />
      <PanelInst items={d.panelPods} mat={mats.panel} />
      <Inst geo={GEO.lightBar} mat={mats.lightBar} items={d.lightBars} />
      <WindStreaksInst items={d.windStreaks} mat={mats.windStreak} />
      <Inst geo={GEO.cyl} mat={mats.deco} items={d.solids} />
      <Inst geo={GEO.cone} mat={mats.deco} items={d.cones} />
      <Inst geo={GEO.box} mat={mats.deco} items={d.boxes} />
      <Inst geo={GEO.octa} mat={mats.deco} items={d.octas} />
      <Inst geo={GEO.octa} mat={mats.decorGlow} items={d.glowOctas} />
      <Inst geo={GEO.vine} mat={mats.deco} items={d.vines} />
      <Inst geo={GEO.leaf} mat={mats.deco} items={d.leaves} />
      <Inst geo={GEO.ice_spire} mat={mats.decoA} items={d.iceSpires} />
      <Inst geo={GEO.crystal} mat={mats.decorGlow} items={d.crystals} />
      <Inst geo={GEO.flower} mat={mats.deco} items={d.flowers} />
      <Inst geo={GEO.pod} mat={mats.decorGlow} items={d.pods} />
      <Inst geo={GEO.lamp} mat={mats.deco} items={d.lamps} />
      <Inst geo={GEO.bolt} mat={mats.decorGlow} items={d.bolts} />
      <Inst geo={GEO.sphere} mat={mats.decoA} items={d.spheresA} />
      <Inst geo={GEO.sphere} mat={mats.glow} items={d.lights} />
      <Inst geo={GEO.banner} mat={mats.deco} items={d.banners} />
      <Inst geo={GEO.arrow} mat={mats.glow} items={d.arrows} />
      <SignInst items={d.signs} mat={mats.sign} />
      {d.decor.map(({ p, items }, i) => {
        const solidMat = !p.e && (p.a ?? 1) >= 1
        const mat = p.e ? mats.decorGlow : solidMat ? mats.deco : mats.decoA
        return (
          <Inst
            key={i}
            geo={GEO_BY[p.k] || GEO.sphere}
            mat={mat}
            items={items}
          />
        )
      })}
      {d.dots && <points geometry={d.dots} material={mats.dots} />}
      {d.parts && <points geometry={d.parts} material={mats.parts} />}
      {d.sparks && <points geometry={d.sparks} material={mats.sparks} />}
      {Object.entries(d.fxGeos).map(([k, geo]) =>
        geo ? <points key={k} geometry={geo} material={mats.fx[k]} /> : null
      )}
    </>
  )
}

function disposeMats(mats) {
  for (const k in mats) {
    const v = mats[k]
    if (!v) continue
    if (v.isMaterial) v.dispose()
    else if (typeof v === 'object') {
      for (const sk in v) v[sk]?.dispose?.()
    }
  }
}

function WayExteriorNear({ way, mats, detailU, extFineRef, lmFineRef }) {
  const d = useMemo(() => buildExteriorNear(way), [way])
  useEffect(() => () => { d.extCable?.dispose?.() }, [d])
  const pulseRings = useMemo(() => d.lmPulseMeta.filter((p) => p.kind === 'ring'), [d.lmPulseMeta])
  const pulseCyls = useMemo(() => d.lmPulseMeta.filter((p) => p.kind === 'cyl'), [d.lmPulseMeta])
  const pulseLights = useMemo(() => d.lmPulseMeta.filter((p) => p.kind === 'light'), [d.lmPulseMeta])
  return (
    <>
      <group ref={lmFineRef} visible>
        <Inst geo={GEO.cone} mat={mats.lmDeco} items={d.lmCones} />
        <Inst geo={GEO.box} mat={mats.lmDeco} items={d.lmBoxes} />
        <Inst geo={GEO.octa} mat={mats.lmDeco} items={d.lmOctas} />
        <Inst geo={GEO.sphere} mat={mats.lmGlass} items={d.lmSpheres} />
        <Inst geo={GEO.sphere} mat={mats.lmDecoA} items={d.lmSpheresA} />
        <Inst geo={GEO.cyl} mat={mats.lmGlass} items={d.lmDiscs} />
        <Inst geo={GEO.funnel} mat={mats.lmGlass} items={d.lmFunnels} />
        <Inst geo={GEO.banner} mat={mats.lmDeco} items={d.lmBanners} />
        <SpinBlades meta={d.lmBladeMeta} mat={mats.lmDeco} detailU={detailU} />
        <PulseInst geo={GEO.torus} mat={mats.lmGlow} items={pulseRings} detailU={detailU} />
        <PulseInst geo={GEO.cyl} mat={mats.lmDecoA} items={pulseCyls} detailU={detailU} />
        <PulseInst geo={GEO.sphere} mat={mats.lmGlow} items={pulseLights} detailU={detailU} />
      </group>
      <group ref={extFineRef} visible>
        {d.extCable && <mesh geometry={d.extCable} material={mats.extCable} />}
        <Inst geo={GEO.pylon} mat={mats.extMetal} items={d.extPylons} />
        <Inst geo={GEO.extClamp} mat={mats.extMetal} items={d.extClamps} />
        <Inst geo={GEO.tree} mat={mats.extFlora} items={d.extFlora} />
        <Inst geo={GEO.mushroom} mat={mats.extFloraGlow} items={d.extFloraGlow} />
        <Inst geo={GEO.ruinPillar} mat={mats.extRuins} items={d.extRuins} />
        <PulseInst geo={GEO.plume} mat={mats.extPlume} items={d.extPulseMeta} detailU={detailU} />
      </group>
    </>
  )
}

function updateWayController(ctrl, h, t, dist, worldRadius) {
  const targetF = ctrl.focused ? 1 : 0
  let f = THREE.MathUtils.damp(ctrl.focusU.value, targetF, 11, h)
  if (Math.abs(f - targetF) < 0.001) f = targetF
  ctrl.focusU.value = f

  let targetDet = 0
  if (ctrl.forceFocusDetail && ctrl.focused) {
    targetDet = 1
  } else if (ctrl.detailActive) {
    const rInt = ctrl.radius * 6.0 + worldRadius * 0.08
    const rExt = ctrl.radius * 13.0 + worldRadius * 0.3
    targetDet = 1 - THREE.MathUtils.smoothstep(dist, rInt, rExt)
  }

  let det = THREE.MathUtils.damp(ctrl.detailU.value, targetDet, 10, h)
  if (det < 0.005 && targetDet <= 0.001) det = 0
  else if (det > 0.995 && targetDet >= 0.999) det = 1
  ctrl.detailU.value = det

  const showNearExt = ctrl.detailActive || ctrl.nearActive || det > 0.03
  if (ctrl.intGroupRef.current) ctrl.intGroupRef.current.visible = ctrl.detailActive && det > 0.01
  if (ctrl.extGroupRef.current) ctrl.extGroupRef.current.visible = det < 0.99
  if (ctrl.extFineRef.current) ctrl.extFineRef.current.visible = showNearExt && det < 0.99
  if (ctrl.lmFineRef.current) ctrl.lmFineRef.current.visible = showNearExt
  if (ctrl.tunelNearRef.current) ctrl.tunelNearRef.current.visible = showNearExt

  const { mats, tunelMats } = ctrl
  const intDepth = f >= 0.98 && det >= 0.98
  mats.deco.depthWrite = intDepth
  mats.glow.depthWrite = intDepth
  mats.decorGlow.depthWrite = intDepth
  mats.rail.depthWrite = intDepth
  mats.sign.depthWrite = intDepth
  mats.floor.depthWrite = intDepth
  mats.hull.depthWrite = intDepth
  mats.panel.depthWrite = intDepth
  mats.neonRim.depthWrite = intDepth

  const extDepth = f >= 0.98 && det <= 0.02
  mats.extCore.depthWrite = extDepth
  mats.extMetal.depthWrite = extDepth
  mats.extCable.depthWrite = extDepth
  mats.extFlora.depthWrite = extDepth
  mats.extFloraGlow.depthWrite = extDepth
  mats.extRuins.depthWrite = extDepth

  const lmDepth = f >= 0.98
  tunelMats.walk.depthWrite = lmDepth
  tunelMats.rib.depthWrite = lmDepth
  mats.lmDeco.depthWrite = lmDepth
  mats.lmGlow.depthWrite = lmDepth

  ctrl.dirty = f !== targetF || Math.abs(det - targetDet) > 0.001 || det > 0
}

function Way({ way, world = null, focused, detailActive = false, nearActive = false, tunelActive = false, forceFocusDetail = false, controllersRef, onPickWay }) {
  const id = way.theme.id
  const focusU = useMemo(() => ({ value: 1 }), [])
  const detailU = useMemo(() => ({ value: 0 }), [])
  const mats = useMemo(() => createWayMaterials(id, focusU, detailU), [id, focusU, detailU])
  const d = useMemo(() => buildExteriorBase(way), [way])
  const tunelMats = useMemo(() => createTunelMats(way, focusU, detailU, withWayFade), [way, focusU, detailU])
  const tunelNearRef = useRef()
  useEffect(() => () => disposeMats(tunelMats), [tunelMats])
  const extGroupRef = useRef()
  const extFineRef = useRef()
  const lmFineRef = useRef()
  const intGroupRef = useRef()
  const spinMeshRef = useRef()
  const lastSpinUpdRef = useRef(-10)

  useEffect(() => () => {
    d.tube?.dispose?.()
    d.extCore?.dispose?.()
    disposeMats(mats)
  }, [d, mats])

  const ctrl = useMemo(() => ({
    idx: way.idx,
    radius: way.params.radius,
    focusU,
    detailU,
    mats,
    tunelMats,
    intGroupRef,
    extGroupRef,
    extFineRef,
    lmFineRef,
    tunelNearRef,
    spinMeshRef,
    lastSpinUpdRef,
    spinMeta: d.lmSpinMeta,
    focused,
    detailActive,
    nearActive,
    tunelActive,
    forceFocusDetail,
    dirty: true,
  }), [way.idx, way.params.radius, focusU, detailU, mats, tunelMats, d.lmSpinMeta])

  useLayoutEffect(() => {
    const map = controllersRef.current
    map.set(way.idx, ctrl)
    return () => { map.delete(way.idx) }
  }, [controllersRef, ctrl, way.idx])

  useEffect(() => {
    ctrl.focused = focused
    ctrl.detailActive = detailActive
    ctrl.nearActive = nearActive
    ctrl.tunelActive = tunelActive
    ctrl.forceFocusDetail = forceFocusDetail
    ctrl.dirty = true
  }, [ctrl, focused, detailActive, nearActive, tunelActive, forceFocusDetail])

  return (
    <group>
      {/* Tubo de cristal principal (siempre visible, adapta brillo y ruido por uDetail) */}
      {d.tube && <mesh geometry={d.tube} material={mats.tube} onClick={onPickWay ? (e) => { e.stopPropagation(); onPickWay(way) } : undefined} />}

      {/* Túnel-banda del hábitat con LOD: piel de celosía en rango medio y pasarelas/arcos solo de cerca */}
      <TunelBanda way={way} mats={tunelMats} nearRef={tunelNearRef} active={tunelActive} nearActive={nearActive} />

      {/* Landmarks, nudos y siluetas de eventos (esenciales siempre; detalle fino solo de cerca) */}
      <group>
        <Inst geo={GEO.mouthNeon} mat={mats.lmGlow} items={d.mouthRings} />
        <Inst geo={GEO.torus} mat={mats.lmGlow} items={d.lmRings} />
        <Inst geo={GEO.cyl} mat={mats.lmDeco} items={d.lmSolids} />
        <Inst geo={GEO.sphere} mat={mats.lmGlow} items={d.lmLights} />
        <SpinRings meta={d.lmSpinMeta} mat={mats.lmGlow} meshRef={spinMeshRef} />
      </group>

      {/* Capa EXTERIOR: tira de neón y penachos siempre; pilones/abrazaderas/cables/flora/landmarks finos bajo demanda */}
      <group ref={extGroupRef}>
        {d.extCore && <mesh geometry={d.extCore} material={mats.extCore} />}
        <Inst geo={GEO.plume} mat={mats.extPlume} items={d.extPlumes} />
      </group>
      {nearActive && (
        <WayExteriorNear way={way} mats={mats} detailU={detailU} extFineRef={extFineRef} lmFineRef={lmFineRef} />
      )}

      {/* Capa INTERIOR + Mini mundo del tema (montados bajo demanda solo en máx 2 ways cercanos/enfocados) */}
      {detailActive && (
        <>
          <group ref={intGroupRef}>
            <WayInterior way={way} mats={mats} />
          </group>
          <VidaDeCamino way={way} world={world} detail={detailU} focused={focused} time={SHARED_TIME} />
        </>
      )}
    </group>
  )
}

const MAX_ACTIVE_VIDA = 2
const MAX_ACTIVE_NEAR = 3
const MAX_ACTIVE_TUNEL = 6

function reconcileLodSet(curSet, desiredSet, maxAdds = Infinity) {
  let changed = false
  let adds = 0
  const next = new Set()
  for (const id of curSet) {
    if (desiredSet.has(id)) next.add(id)
    else changed = true
  }
  for (const id of desiredSet) {
    if (!next.has(id)) {
      if (adds >= maxAdds) break
      next.add(id)
      adds += 1
      changed = true
    }
  }
  return changed ? next : null
}

function selectTopIds(list, maxCount) {
  list.sort((a, b) => {
    if (a.isFocus !== b.isFocus) return a.isFocus ? -1 : 1
    return a.dist - b.dist
  })
  const out = new Set()
  for (let i = 0; i < list.length && out.size < maxCount; i++) out.add(list[i].idx)
  return out
}

export default function Paths({ world, sim = null, focusWay = null, worldRadius = 110, forceFocusDetail = false, cameraOnBall = false, onPickWay }) {
  const wayMetas = useMemo(() => world.ways.map((w) => {
    const pts = []
    for (const s of w.segments) {
      const nSamp = Math.max(3, Math.ceil(s.length / 8))
      for (let i = 0; i <= nSamp; i++) pts.push(s.curve.getPointAt(i / nSamp))
    }
    const sphere = new THREE.Box3().setFromPoints(pts).getBoundingSphere(new THREE.Sphere())
    const flat = new Float32Array(pts.length * 3)
    for (let i = 0; i < pts.length; i++) {
      flat[i * 3] = pts[i].x
      flat[i * 3 + 1] = pts[i].y
      flat[i * 3 + 2] = pts[i].z
    }
    return { idx: w.idx, radius: w.params.radius, flat, sphere }
  }), [world])

  const wayDistRef = useRef([])
  const controllersRef = useRef(new Map())
  const mountedRef = useRef(new Set())
  const nearRef = useRef(new Set())
  const tunelRef = useRef(new Set())
  const [mountedIds, setMountedIds] = useState(() => new Set())
  const [nearIds, setNearIds] = useState(() => new Set())
  const [tunelIds, setTunelIds] = useState(() => new Set())
  const lastEvalRef = useRef(-10)
  const prevFocusRef = useRef(focusWay)
  const prevForceRef = useRef(forceFocusDetail)

  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    const h = Math.min(dt, 0.1)
    SHARED_TIME.value = t
    VIDA_BUS.sim = sim

    const focusChanged = prevFocusRef.current !== focusWay || prevForceRef.current !== forceFocusDetail
    if (focusChanged || t - lastEvalRef.current >= 0.12) {
      lastEvalRef.current = t
      prevFocusRef.current = focusWay
      prevForceRef.current = forceFocusDetail

      const cx = camera.position.x
      const cy = camera.position.y
      const cz = camera.position.z
      const curMounted = mountedRef.current
      const curNear = nearRef.current
      const curTunel = tunelRef.current
      const dists = wayDistRef.current

      const vidaCands = []
      const nearCands = []
      const tunelCands = []
      for (let i = 0; i < wayMetas.length; i++) {
        const m = wayMetas[i]
        const isFocus = focusWay === m.idx
        const enterDist = (focusWay != null && !isFocus) ? (m.radius * 2.5 + 2.5) : (m.radius * 7.5 + worldRadius * 0.09)
        const exitDist = enterDist * 1.35
        const nearEnter = (focusWay != null && !isFocus) ? (m.radius * 5.0 + 6.0) : (m.radius * 13.0 + worldRadius * 0.3)
        const nearExit = nearEnter * 1.25
        const tunelEnter = (focusWay != null && !isFocus) ? nearEnter : (m.radius * 16.0 + worldRadius * 1.25)
        const tunelExit = tunelEnter * 1.2

        const vidaLim = curMounted.has(m.idx) ? exitDist : enterDist
        const nearLim = curNear.has(m.idx) ? nearExit : nearEnter
        const tunelLim = curTunel.has(m.idx) ? tunelExit : tunelEnter
        const maxLim = Math.max(vidaLim, nearLim, tunelLim)

        const sp = m.sphere
        const dxC = cx - sp.center.x
        const dyC = cy - sp.center.y
        const dzC = cz - sp.center.z
        const centerDist = Math.sqrt(dxC * dxC + dyC * dyC + dzC * dzC)

        let dist = Infinity
        if (centerDist - sp.radius <= maxLim || (isFocus && forceFocusDetail)) {
          const arr = m.flat
          let minD2 = Infinity
          for (let k = 0; k < arr.length; k += 3) {
            const dx = cx - arr[k]
            const dy = cy - arr[k + 1]
            const dz = cz - arr[k + 2]
            const d2 = dx * dx + dy * dy + dz * dz
            if (d2 < minD2) minD2 = d2
          }
          dist = Math.max(0, Math.sqrt(minD2) - m.radius)
        }
        dists[m.idx] = dist
        if ((isFocus && forceFocusDetail) || dist < vidaLim) vidaCands.push({ idx: m.idx, dist, isFocus })
        if ((isFocus && forceFocusDetail) || dist < nearLim) nearCands.push({ idx: m.idx, dist, isFocus })
        if ((isFocus && (forceFocusDetail || focusWay != null)) || dist < tunelLim) tunelCands.push({ idx: m.idx, dist, isFocus })
      }

      const nextMounted = reconcileLodSet(curMounted, selectTopIds(vidaCands, MAX_ACTIVE_VIDA), 1)
      if (nextMounted) {
        mountedRef.current = nextMounted
        setMountedIds(nextMounted)
      }
      const nearDesired = selectTopIds(nearCands, MAX_ACTIVE_NEAR)
      for (const id of (nextMounted ?? mountedRef.current)) nearDesired.add(id)
      const nextNear = reconcileLodSet(curNear, nearDesired, 1)
      if (nextNear) {
        nearRef.current = nextNear
        setNearIds(nextNear)
      }
      const tunelDesired = selectTopIds(tunelCands, MAX_ACTIVE_TUNEL)
      for (const id of (nextNear ?? nearRef.current)) tunelDesired.add(id)
      const nextTunel = reconcileLodSet(curTunel, tunelDesired)
      if (nextTunel) {
        tunelRef.current = nextTunel
        setTunelIds(nextTunel)
      }
    }

    // Actualizar solo ways activos/en transición; suspender por completo caminos lejanos estables
    const dists = wayDistRef.current
    const spinRange = worldRadius * 1.15
    for (const ctrl of controllersRef.current.values()) {
      const dist = dists[ctrl.idx] ?? Infinity
      const targetF = ctrl.focused ? 1 : 0
      const activeOrTransition = ctrl.detailActive || ctrl.nearActive || ctrl.dirty
        || Math.abs(ctrl.focusU.value - targetF) > 0.001 || ctrl.detailU.value > 0.001
      if (activeOrTransition) {
        updateWayController(ctrl, h, t, dist, worldRadius)
      }
      if (ctrl.focused || dist < spinRange) {
        updateSpinRingsMesh(ctrl.spinMeshRef.current, ctrl.spinMeta, t, ctrl.detailU.value, ctrl.lastSpinUpdRef)
      }
    }
  })

  return (
    <>
      {world.ways.map((w) => (
        <Way
          key={w.idx}
          way={w}
          world={world}
          focused={focusWay == null || focusWay === w.idx}
          detailActive={mountedIds.has(w.idx)}
          nearActive={nearIds.has(w.idx)}
          tunelActive={tunelIds.has(w.idx)}
          forceFocusDetail={forceFocusDetail}
          controllersRef={controllersRef}
          onPickWay={onPickWay}
        />
      ))}
      {world.circuits.map((c) => {
        const isFocusedCircuit = focusWay == null || c.ways.some((w) => w.idx === focusWay)
        if (cameraOnBall && !isFocusedCircuit) return null
        return (
          <WorldHtml key={c.idx} position={[c.mid.x, c.mid.y + 2.4, c.mid.z]} center distanceFactor={22} zIndexRange={[5, 0]}>
            <div
              className="tag"
              style={{
                borderColor: VISUALS[c.theme.id].rail,
                opacity: isFocusedCircuit ? 1 : 0.16,
                filter: isFocusedCircuit ? 'none' : 'saturate(0.3) brightness(0.65)',
                transition: 'opacity 0.25s ease, filter 0.25s ease',
                ...(onPickWay ? { pointerEvents: 'auto', cursor: 'pointer' } : null),
              }}
              onClick={onPickWay ? (e) => { e.stopPropagation(); onPickWay(c.ways[0]) } : undefined}
            >
              {c.theme.emoji} {c.theme.name.replace('Camino ', '')}
            </div>
          </WorldHtml>
        )
      })}
    </>
  )
}
