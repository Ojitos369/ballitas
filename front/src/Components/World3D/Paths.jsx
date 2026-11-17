import { startTransition, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'
import { VISUALS } from './themes.js'
import WorldHtml from './WorldHtml.jsx'
import { applyLoadedImage } from './texUtils.js'
import { VidaDeCamino, VIDA_BUS } from './vida/index.js'
import { pistaWarmup } from './vida/pista.jsx'
import Precompilado from './Precompilado.jsx'
import Puertas from './puertas.jsx'
import Neon from './Neon.jsx'
import Fauna from './Fauna.jsx'

const TAU = Math.PI * 2
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
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

function strutBetween(a, b, rad = 0.036, radialSegs = 6) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(rad, rad, Math.max(len, 1e-3), radialSegs)
  if (len > 1e-4) g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, dir.divideScalar(len)))
  g.translate((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5)
  return g
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
  pylon: buildPylonGeo(),
  tree: buildTreeFallbackGeo(),
  mushroom: buildMushroomFallbackGeo(),
  ruinPillar: buildRuinArchGeo(),
}
for (const k in GEO) GEO[k].name = 'paths:' + k // rastreo en ?stats=1 (__ballitasDebug)

// ═══════════════════════════ MATERIALES Y SHADERS POR WAY ═══════════════════════════
// Multiplicadores moderados (1.1-1.35 base, ~1.9 solo en pulsos y bocas) para que el bloom no blanquee el color del tema.
const hot = (c, k = 1.25) => new THREE.Color(c).multiplyScalar(k)

function createTubeMat(id, focusU, detailU) {
  const V = VISUALS[id]
  const atmo = V.cine?.atmo ?? { mode: 0, c1: V.glass, c2: V.rail }
  // Sin iridiscencia: era el término más caro de un cristal que ahora es discreto (casi invisible por dentro).
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
      // Por dentro se descartan las caras que miran al eje (el frente del tubo): el propio tubo no tapa el
      // techo y se sigue viendo el resto del circuito. Uniform y no material.side: cambiar side recompila.
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (uDetail > 0.5 && gl_FrontFacing) discard;')
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
        float outAlpha = clamp(0.15 + tubeFresnel * 0.42 + flowMask * 0.26 + seamMask * 0.25, 0.0, 0.88);
        // Por dentro (detD -> 1) el cristal es casi invisible: solo un filo de Fresnel, para ver el circuito.
        float inAlpha = clamp(0.018 + tubeFresnel * 0.09, 0.0, 0.1);
        gl_FragColor.a = mix(outAlpha, inAlpha, detD) * mix(0.15, 1.0, uFocus);
        #include <dithering_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'tube-flow-atmo-v6'
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

function createWayMaterials(id, focusU, detailU) {
  const orgNorm = getOrganicNormalTex()
  const orgRough = getOrganicRoughnessTex()
  return {
    tube: createTubeMat(id, focusU, detailU),
    // Exterior (uDetail -> 0)
    extCore: createExtCoreMat(focusU, detailU),
    extMetal: withWayFade(new THREE.MeshPhysicalMaterial({
      normalMap: getHullNormalTex(),
      normalScale: new THREE.Vector2(0.28, 0.28),
      roughnessMap: getHullRoughnessTex(),
      roughness: 0.34,
      metalness: 0.84,
      clearcoat: 0.72,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.35,
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
  }
}

// ═══════════════════════════ HELPERS DE CONSTRUCCIÓN ═══════════════════════════
const put = (list, p, q, sx, sy = sx, sz = sx, c) => {
  if (list) list.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz)), c })
}

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

function frameAt(T) {
  const N = new THREE.Vector3().crossVectors(T, Math.abs(T.y) > 0.9 ? X : Y).normalize()
  const B = new THREE.Vector3().crossVectors(T, N).normalize()
  return { N, B }
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

const WHITE_COL = new THREE.Color('#ffffff')

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
  const extNeonHex = EXT_NEON_HEX[themeId] ?? V.rail
  const tubes = []; const extCores = []
  for (const s of way.segments) {
    if (s.air) continue
    const R = s.radius
    const frames = getSegFrames(s)
    const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
    const tubeTint = ev ? WHITE_COL.clone().lerp(new THREE.Color(EVENT_ACCENTS[ev]), 0.62) : null
    tubes.push(buildFramesTubeGeo(frames, R, 8, { uvScaleX: 0.25, color: WHITE_COL, eventColor: tubeTint }))
    const coreRad = Math.max(0.145, R * 0.148)
    const coreBase = routeColor(extNeonHex, s.route, 1.45)
    const coreCol = ev ? coreBase.clone().lerp(hot(EVENT_ACCENTS[ev], 1.4), 0.45) : coreBase
    extCores.push(buildFramesTubeGeo(frames, coreRad, 4, { offsetUp: -R * 0.12, uvScaleX: 0.25, color: coreCol }))
  }
  return { tube: mergeAndDispose(tubes), extCore: mergeAndDispose(extCores) }
}

// Exterior cercano: solo pilones bajo el tubo y flora/ruinas (modelos) a su lado, lejos de la vista interior.
function buildExteriorNear(way) {
  const extPylons = []; const extFlora = []; const extFloraGlow = []; const extRuins = []
  const bayRng = mulberry32(way.idx * 8191 + 19)
  const pFrom = way.segments[0]?.curve.getPoint(0)
  const pTo = way.segments[way.segments.length - 1]?.curve.getPoint(1)
  let pylonCount = 0
  for (const s of way.segments) {
    if (s.air) continue
    const R = s.radius
    const frames = getSegFrames(s)
    const nPyl = Math.max(1, Math.floor(s.length / 18))
    for (let i = 0; i < nPyl; i++) {
      const f = sampleCurveFrame(frames, (i + 0.5) / nPyl)
      const nearPort = (pFrom && f.pos.distanceTo(pFrom) < 5.5) || (pTo && f.pos.distanceTo(pTo) < 5.5)
      if (nearPort || Math.abs(f.T.y) >= 0.72) continue
      const pylH = 6.2 + bayRng() * 4.8
      const footPos = f.pos.clone().addScaledVector(Y, -R * 1.02 - pylH)
      put(extPylons, footPos, IDENT, R * 1.45, pylH, R * 1.45, EXT_PYLON_COL)
      if (pylonCount % 2 === 0 && pylonCount < 8) {
        const side = pylonCount % 4 === 0 ? 1 : -1
        const bankPos = footPos.clone().addScaledVector(f.right, side * (R * 1.4 + 0.9))
        const treeSc = 2.0 + bayRng() * 1.3
        const treeQ = new THREE.Quaternion().setFromAxisAngle(Y, bayRng() * TAU)
        put(extFlora, bankPos, treeQ, treeSc, treeSc, treeSc, EXT_TREE_COLS[pylonCount % EXT_TREE_COLS.length])
        const glowCol = EXT_FLORA_GLOW_COLS[(way.idx + pylonCount) % EXT_FLORA_GLOW_COLS.length]
        put(extFloraGlow, bankPos.clone().addScaledVector(Y, treeSc * 0.88), treeQ, treeSc * 0.48, treeSc * 0.36, treeSc * 0.48, glowCol)
        if (bayRng() > 0.38) {
          const ruinPos = footPos.clone().addScaledVector(f.right, -side * (R * 1.3 + 0.8))
          const ruinQ = new THREE.Quaternion().setFromAxisAngle(Y, bayRng() * TAU)
          put(extRuins, ruinPos, ruinQ, 1.5 + bayRng() * 0.9, 1.6 + bayRng() * 1.2, 1.5, EXT_RUIN_COLS[pylonCount % EXT_RUIN_COLS.length])
        }
      }
      pylonCount++
    }
  }
  return { extPylons, extFlora, extFloraGlow, extRuins }
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

function WayExteriorNear({ way, mats, extFineRef }) {
  const d = useMemo(() => buildExteriorNear(way), [way])
  return (
    <group ref={extFineRef} visible>
      <Inst geo={GEO.pylon} mat={mats.extMetal} items={d.extPylons} />
      <Inst geo={GEO.tree} mat={mats.extFlora} items={d.extFlora} />
      <Inst geo={GEO.mushroom} mat={mats.extFloraGlow} items={d.extFloraGlow} />
      <Inst geo={GEO.ruinPillar} mat={mats.extRuins} items={d.extRuins} />
      {/* neón y fauna del tema a lo largo del camino: mismo LOD que el resto del exterior cercano */}
      <Neon way={way} time={SHARED_TIME} getFrames={getSegFrames} sample={sampleCurveFrame} />
      <Fauna way={way} time={SHARED_TIME} getFrames={getSegFrames} sample={sampleCurveFrame} />
    </group>
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

  const { mats } = ctrl
  const extDepth = f >= 0.98 && det <= 0.02
  mats.extCore.depthWrite = extDepth
  mats.extMetal.depthWrite = extDepth
  mats.extFlora.depthWrite = extDepth
  mats.extFloraGlow.depthWrite = extDepth
  mats.extRuins.depthWrite = extDepth

  ctrl.dirty = f !== targetF || Math.abs(det - targetDet) > 0.001 || det > 0
}

function Way({ way, world = null, focused, detailActive = false, nearActive = false, forceFocusDetail = false, controllersRef, onPickWay }) {
  const id = way.theme.id
  const focusU = useMemo(() => ({ value: 1 }), [])
  const detailU = useMemo(() => ({ value: 0 }), [])
  const mats = useMemo(() => createWayMaterials(id, focusU, detailU), [id, focusU, detailU])
  const d = useMemo(() => buildExteriorBase(way), [way])
  const extGroupRef = useRef()
  const extFineRef = useRef()
  const intGroupRef = useRef()

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
    intGroupRef,
    extGroupRef,
    extFineRef,
    focused,
    detailActive,
    nearActive,
    forceFocusDetail,
    dirty: true,
  }), [way.idx, way.params.radius, focusU, detailU, mats])

  useLayoutEffect(() => {
    const map = controllersRef.current
    map.set(way.idx, ctrl)
    return () => { map.delete(way.idx) }
  }, [controllersRef, ctrl, way.idx])

  useEffect(() => {
    ctrl.focused = focused
    ctrl.detailActive = detailActive
    ctrl.nearActive = nearActive
    ctrl.forceFocusDetail = forceFocusDetail
    ctrl.dirty = true
  }, [ctrl, focused, detailActive, nearActive, forceFocusDetail])

  return (
    <group>
      {/* El tubo solo informa el recorrido en el mapa lejano; los circuitos son abiertos en Camino. */}
      {d.tube && focused === false && !nearActive && <mesh geometry={d.tube} material={mats.tube} onClick={onPickWay ? (e) => { e.stopPropagation(); onPickWay(way) } : undefined} />}

      {/* Capa EXTERIOR: tira de neón de lejos; pilones y flora (modelos) bajo demanda, siempre fuera del tubo */}
      <group ref={extGroupRef}>
        {d.extCore && <mesh geometry={d.extCore} material={mats.extCore} />}
      </group>
      {nearActive && (
        <Precompilado>
          <WayExteriorNear way={way} mats={mats} extFineRef={extFineRef} />
        </Precompilado>
      )}

      {/* Pista de carreras del tema + mecanismos (solo en los caminos cercanos/enfocados) */}
      {detailActive && (
        <Precompilado>
          {/* la vida va dentro del interior: montada de antemano (precarga) no se ve hasta que hay detalle */}
          <group ref={intGroupRef}>
            <VidaDeCamino way={way} world={world} detail={detailU} focused={focused} time={SHARED_TIME} />
          </group>
        </Precompilado>
      )}
    </group>
  )
}

// Programas de las capas cercanas montados ocultos desde el inicio: el precalentado de Scene los compila
// y enlaza en el mapa, y la primera entrada a Camino/Ballita no espera su enlace (cientos de ms en ANGLE).
function Precalentar() {
  const { group, mats } = useMemo(() => {
    const mats = createWayMaterials('neon', { value: 1 }, { value: 1 })
    return { mats, group: pistaWarmup([mats.extMetal, mats.extFlora, mats.extFloraGlow, mats.extRuins]) }
  }, [])
  useEffect(() => () => disposeMats(mats), [mats])
  return <primitive object={group} visible={false} />
}

const MAX_ACTIVE_VIDA = 2
const MAX_ACTIVE_NEAR = 3

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

export default function Paths({ world, sim = null, focusWay = null, prefetchWays = null, worldRadius = 110, forceFocusDetail = false, cameraOnBall = false, onPickWay }) {
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
  const [mountedIds, setMountedIds] = useState(() => new Set())
  const [nearIds, setNearIds] = useState(() => new Set())
  const lastEvalRef = useRef(-10)
  const prevFocusRef = useRef(focusWay)
  const prevForceRef = useRef(forceFocusDetail)
  const prevPrefetchRef = useRef(prefetchWays)

  useFrame(({ camera, clock }, dt) => {
    const t = clock.elapsedTime
    const h = Math.min(dt, 0.1)
    SHARED_TIME.value = t
    VIDA_BUS.sim = sim

    const focusChanged = prevFocusRef.current !== focusWay || prevForceRef.current !== forceFocusDetail || prevPrefetchRef.current !== prefetchWays
    if (focusChanged || t - lastEvalRef.current >= 0.12) {
      lastEvalRef.current = t
      prevFocusRef.current = focusWay
      prevForceRef.current = forceFocusDetail
      prevPrefetchRef.current = prefetchWays

      const cx = camera.position.x
      const cy = camera.position.y
      const cz = camera.position.z
      const curMounted = mountedRef.current
      const curNear = nearRef.current
      const dists = wayDistRef.current

      const vidaCands = []
      const nearCands = []
      for (let i = 0; i < wayMetas.length; i++) {
        const m = wayMetas[i]
        const isFocus = focusWay === m.idx
        // Precarga: los caminos que siguen a la ballita seguida se montan (ocultos y compilados) antes de entrar.
        const pre = !isFocus && prefetchWays != null && prefetchWays.includes(m.idx)
        const enterDist = (focusWay != null && !isFocus) ? (m.radius * 2.5 + 2.5) : (m.radius * 7.5 + worldRadius * 0.09)
        const exitDist = enterDist * 1.35
        const nearEnter = (focusWay != null && !isFocus) ? (m.radius * 5.0 + 6.0) : (m.radius * 13.0 + worldRadius * 0.3)
        const nearExit = nearEnter * 1.25

        const vidaLim = curMounted.has(m.idx) ? exitDist : enterDist
        const nearLim = curNear.has(m.idx) ? nearExit : nearEnter
        const maxLim = Math.max(vidaLim, nearLim)

        const sp = m.sphere
        const dxC = cx - sp.center.x
        const dyC = cy - sp.center.y
        const dzC = cz - sp.center.z
        const centerDist = Math.sqrt(dxC * dxC + dyC * dyC + dzC * dzC)

        let dist = Infinity
        if (centerDist - sp.radius <= maxLim || (isFocus && forceFocusDetail) || pre) {
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
        if ((isFocus && forceFocusDetail) || pre || dist < vidaLim) vidaCands.push({ idx: m.idx, dist, isFocus })
        if ((isFocus && forceFocusDetail) || pre || dist < nearLim) nearCands.push({ idx: m.idx, dist, isFocus })
      }

      const nextMounted = reconcileLodSet(curMounted, selectTopIds(vidaCands, MAX_ACTIVE_VIDA), 1)
      const nearDesired = selectTopIds(nearCands, MAX_ACTIVE_NEAR)
      for (const id of (nextMounted ?? mountedRef.current)) nearDesired.add(id)
      const nextNear = reconcileLodSet(curNear, nearDesired, 1)
      if (nextMounted) mountedRef.current = nextMounted
      if (nextNear) nearRef.current = nextNear
      // Transición: React reparte el render del montaje (pista, capas cercanas) en porciones
      // de ~5 ms entre cuadros en vez de un único cuadro largo en la primera entrada.
      if (nextMounted || nextNear) {
        startTransition(() => {
          if (nextMounted) setMountedIds(nextMounted)
          if (nextNear) setNearIds(nextNear)
        })
      }
    }

    // Actualizar solo ways activos/en transición; suspender por completo caminos lejanos estables
    const dists = wayDistRef.current
    for (const ctrl of controllersRef.current.values()) {
      const dist = dists[ctrl.idx] ?? Infinity
      const targetF = ctrl.focused ? 1 : 0
      const activeOrTransition = ctrl.detailActive || ctrl.nearActive || ctrl.dirty
        || Math.abs(ctrl.focusU.value - targetF) > 0.001 || ctrl.detailU.value > 0.001
      if (activeOrTransition) {
        updateWayController(ctrl, h, t, dist, worldRadius)
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
          forceFocusDetail={forceFocusDetail}
          controllersRef={controllersRef}
          onPickWay={onPickWay}
        />
      ))}
      <Puertas world={world} />
      <Precalentar />
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
