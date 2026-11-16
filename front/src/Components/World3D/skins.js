import { createElement as h } from 'react'
import * as THREE from 'three'
import { skinFamily } from '../../Core/personality.js'

const grp = (props, ...children) => h('group', props, ...children)
const msh = (props) => h('mesh', props)

// ═══════════════════════════ PRNG Y HASH DEL GENOMA ═══════════════════════════

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mixHash(h, val) {
  const v = Math.round((val ?? 0) * 65535) >>> 0
  h ^= v
  h = Math.imul(h, 0x01000193) >>> 0
  return h
}

export function hashGenome(genome) {
  let h = 2166136261 >>> 0
  if (!genome) return h
  h = mixHash(h, genome.hue)
  const tr = genome.traits || {}
  for (const k of ['valentia', 'curiosidad', 'apetito', 'sociabilidad', 'animo', 'velocidad']) {
    h = mixHash(h, tr[k])
  }
  for (const arrKey of ['prefs', 'ways', 'routes', 'kinds']) {
    const arr = genome[arrKey]
    if (Array.isArray(arr)) {
      const step = Math.max(1, Math.floor(arr.length / 6))
      for (let i = 0; i < arr.length; i += step) h = mixHash(h, arr[i])
    }
  }
  return h >>> 0
}

// ═══════════════════════════ COLORES Y UTILIDADES ═══════════════════════════

function hslHex(h, s, l) {
  const c = new THREE.Color().setHSL(((h % 1) + 1) % 1, Math.max(0, Math.min(1, s)), Math.max(0, Math.min(1, l)))
  return `#${c.getHexString()}`
}

const PUPIL_COLORS = ['#1a1030', '#1b3b6f', '#1f5e3b', '#6b2d5c', '#7a3e12', '#262936', '#5a1828']
const BLUSH_COLORS = ['#ff6f91', '#ff8fa3', '#ff758f', '#f472b6', '#fb7185']
const PATTERNS = ['degradado', 'manchas', 'rayas', 'pecas', 'lunares', 'bicolor']
export const PATTERN_LABEL = {
  degradado: 'Degradado',
  manchas: 'Manchas',
  rayas: 'Rayas',
  pecas: 'Pecas',
  lunares: 'Lunares',
  bicolor: 'Bicolor',
}

// ═══════════════════════════ GEOMETRÍAS COMPARTIDAS ═══════════════════════════

const GEO = {
  cone: new THREE.ConeGeometry(1, 1, 14),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
  sphere: new THREE.SphereGeometry(1, 12, 10),
  torus: new THREE.TorusGeometry(1, 0.18, 8, 20),
  torusThin: new THREE.TorusGeometry(1, 0.08, 8, 22),
  torusArc: new THREE.TorusGeometry(1, 0.18, 6, 14, Math.PI),
  box: new THREE.BoxGeometry(1, 1, 1),
  circle: new THREE.CircleGeometry(1, 12),
  octa: new THREE.OctahedronGeometry(1, 0),
}

// ═══════════════════════════ CACHÉ DE MATERIALES ═══════════════════════════

const matCache = new Map()
const MAX_MATS = 256

function getMat(color, roughness = 0.45, metalness = 0.05, emissive = null, opacity = 1) {
  const key = `${color}|${roughness}|${metalness}|${emissive ?? ''}|${opacity}`
  let m = matCache.get(key)
  if (m) {
    matCache.delete(key)
    matCache.set(key, m)
    return m
  }
  const opts = { color, roughness, metalness }
  if (emissive) {
    opts.emissive = emissive
    opts.emissiveIntensity = 0.45
  }
  if (opacity < 1) {
    opts.transparent = true
    opts.opacity = opacity
    opts.depthWrite = false
  }
  m = new THREE.MeshStandardMaterial(opts)
  if (matCache.size >= MAX_MATS) {
    const oldest = matCache.keys().next().value
    matCache.get(oldest)?.dispose()
    matCache.delete(oldest)
  }
  matCache.set(key, m)
  return m
}

// ═══════════════════════════ TEXTURA PROCEDURAL DE CUERPO ═══════════════════════════

const texCache = new Map()
const MAX_TEX = 64

export function getBodyTexture(skin) {
  const key = skin.seed
  const hit = texCache.get(key)
  if (hit) {
    texCache.delete(key)
    texCache.set(key, hit)
    return hit
  }

  const W = 128
  const H = 64
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const rng = mulberry32(skin.seed ^ 0x9e3779b9)

  const baseColor = hslHex(skin.baseHue, 0.75, 0.6)
  const accentColor = hslHex(skin.accentHue, 0.72, skin.accentLight)
  const softColor = hslHex(skin.baseHue, 0.65, 0.78)
  const deepColor = hslHex(skin.baseHue, 0.78, 0.42)

  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, W, H)

  const pat = skin.patternType
  const scale = skin.patternScale

  if (pat === 'degradado') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, softColor)
    grad.addColorStop(0.55, baseColor)
    grad.addColorStop(1, accentColor)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  } else if (pat === 'bicolor') {
    ctx.fillStyle = accentColor
    ctx.beginPath()
    ctx.moveTo(0, H)
    const midY = H * (0.52 + (rng() - 0.5) * 0.14)
    const freq = 2 + Math.floor(rng() * 3)
    const amp = 4 + rng() * 5
    for (let x = 0; x <= W; x += 2) {
      const y = midY + Math.sin((x / W) * Math.PI * 2 * freq) * amp
      ctx.lineTo(x, y)
    }
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.globalAlpha = 0.72
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (pat === 'rayas') {
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.45 + skin.patternIntensity * 0.35
    const count = 4 + Math.floor(rng() * 4)
    const tilt = (rng() - 0.5) * 14
    const stripeH = (H / count) * (0.32 + rng() * 0.22)
    for (let i = 0; i < count; i++) {
      const y0 = (i + 0.5) * (H / count)
      ctx.beginPath()
      ctx.moveTo(0, y0 - stripeH * 0.5)
      ctx.lineTo(W, y0 + tilt - stripeH * 0.5)
      ctx.lineTo(W, y0 + tilt + stripeH * 0.5)
      ctx.lineTo(0, y0 + stripeH * 0.5)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (pat === 'manchas') {
    const count = 8 + Math.floor(rng() * 9)
    ctx.fillStyle = accentColor
    for (let i = 0; i < count; i++) {
      const cx = rng() * W
      const cy = 6 + rng() * (H - 12)
      const rx = (4 + rng() * 8) * scale
      const ry = (3 + rng() * 6) * scale
      ctx.globalAlpha = 0.45 + rng() * 0.35
      for (const ox of [-W, 0, W]) {
        ctx.beginPath()
        ctx.ellipse(cx + ox, cy, rx, ry, rng() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  } else if (pat === 'lunares') {
    const cols = 6 + Math.floor(rng() * 4)
    const rows = 3 + Math.floor(rng() * 2)
    const rad = (2.2 + rng() * 2.2) * scale
    ctx.fillStyle = rng() < 0.5 ? softColor : accentColor
    ctx.globalAlpha = 0.65
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = ((c + (r % 2) * 0.5) / cols) * W
        const cy = ((r + 0.5) / rows) * H
        for (const ox of [-W, 0, W]) {
          ctx.beginPath()
          ctx.arc(cx + ox, cy, rad, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.globalAlpha = 1
  } else if (pat === 'pecas') {
    const count = 36 + Math.floor(rng() * 28)
    for (let i = 0; i < count; i++) {
      const cx = rng() * W
      const cy = 4 + rng() * (H - 8)
      const rad = 0.8 + rng() * 1.6
      ctx.fillStyle = rng() < 0.5 ? deepColor : accentColor
      ctx.globalAlpha = 0.35 + rng() * 0.35
      for (const ox of [-W, 0, W]) {
        ctx.beginPath()
        ctx.arc(cx + ox, cy, rad, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true

  if (texCache.size >= MAX_TEX) {
    const oldest = texCache.keys().next().value
    texCache.get(oldest)?.dispose()
    texCache.delete(oldest)
  }
  texCache.set(key, tex)
  return tex
}

// ═══════════════════════════ GENERACIÓN PROCEDURAL DE SKIN ═══════════════════════════

export function buildSkin(genome, arch) {
  const seed = hashGenome(genome)
  const rng = mulberry32(seed)
  const family = skinFamily(arch ?? genome)
  const id = family.id
  const baseHue = genome?.hue ?? 0.5

  // Patrón corporal
  const patternType = PATTERNS[Math.floor(rng() * PATTERNS.length)]
  const hueShift = rng() < 0.5 ? 0.08 + rng() * 0.14 : 0.38 + rng() * 0.24
  const accentHue = (baseHue + hueShift) % 1
  const accentLight = rng() < 0.5 ? 0.76 : 0.42

  // Paleta de accesorios
  const accHue = (baseHue + 0.15 + rng() * 0.7) % 1
  const hatPalette = {
    elfa: hslHex(0.32 + (rng() - 0.5) * 0.14, 0.55, 0.42),
    gatita: hslHex(baseHue, 0.68, 0.48),
    maga: hslHex(0.74 + (rng() - 0.5) * 0.12, 0.55, 0.28),
    pirata: hslHex(0.02 + (rng() - 0.5) * 0.08, 0.72, 0.36),
    zombi: hslHex(0.28 + (rng() - 0.5) * 0.1, 0.45, 0.45),
    miedosa: hslHex(baseHue, 0.55, 0.78),
    rutinaria: hslHex(accHue, 0.45, 0.44),
    ascetica: hslHex(0.12 + (rng() - 0.5) * 0.05, 0.8, 0.62),
    solitaria: hslHex(0.65 + (rng() - 0.5) * 0.15, 0.28, 0.28),
    alegre: hslHex(0.13 + (rng() - 0.5) * 0.08, 0.9, 0.64),
  }
  const hatColor = hatPalette[id] ?? hslHex(accHue, 0.6, 0.5)
  const ribbonColor = hslHex((accHue + 0.45) % 1, 0.78, 0.62)
  const earColor = hslHex(baseHue, 0.72, 0.54)
  const earInnerColor = hslHex(0.95 + (rng() - 0.5) * 0.06, 0.75, 0.78)

  // Orejas: tamaño, inclinación, peso/caída
  const earScale = 0.8 + rng() * 0.45
  const earTilt = (rng() - 0.5) * 0.42
  const earDroop = (id === 'miedosa' ? 0.55 : 0.08) + rng() * 0.35

  // Ojos y pupilas
  const eyeScaleX = (id === 'elfa' ? 1.06 : 0.88) + rng() * 0.24
  const eyeScaleY = (id === 'maga' ? 0.78 : id === 'elfa' ? 1.08 : 0.9) + rng() * 0.22
  const eyeAsym = id === 'zombi' ? [1.26, 0.82] : [0.96 + rng() * 0.08, 0.96 + rng() * 0.08]
  const pupilSize = 0.055 + rng() * 0.032
  const pupilColor = PUPIL_COLORS[Math.floor(rng() * PUPIL_COLORS.length)]
  const hasCatchlight = rng() < 0.78

  // Cejas
  const browThick = 0.045 + rng() * 0.035
  const browBaseTilt = id === 'elfa' ? -(0.22 + rng() * 0.18)
    : id === 'alegre' ? (0.08 + rng() * 0.12)
      : (rng() - 0.5) * 0.16
  const browColor = hslHex(baseHue, 0.45, 0.2)

  // Boca
  let mouthType = 'curva'
  if (id === 'gatita') mouthType = 'w'
  else if (id === 'elfa') mouthType = 'zigzag'
  else if (id === 'zombi') mouthType = 'dientes'
  else if (rng() < 0.14) mouthType = ['w', 'zigzag', 'dientes'][Math.floor(rng() * 3)]
  const mouthWidth = 0.86 + rng() * 0.32

  // Rubor y detalles faciales
  const blushColor = BLUSH_COLORS[Math.floor(rng() * BLUSH_COLORS.length)]
  const blushBoost = (id === 'gatita' || id === 'alegre' ? 1.15 : 0.75) + rng() * 0.35
  const patchSide = rng() < 0.5 ? -1 : 1

  return {
    seed,
    family,
    id,
    baseHue,
    accentHue,
    accentLight,
    patternType,
    patternIntensity: 0.25 + rng() * 0.45,
    patternScale: 0.75 + rng() * 0.7,
    hatColor,
    ribbonColor,
    earColor,
    earInnerColor,
    earScale,
    earTilt,
    earDroop,
    eyeScaleX,
    eyeScaleY,
    eyeAsym,
    pupilSize,
    pupilColor,
    hasCatchlight,
    browThick,
    browBaseTilt,
    browColor,
    mouthType,
    mouthWidth,
    blushColor,
    blushBoost,
    patchSide,
    hasPatch: id === 'pirata',
    hasScar: id === 'pirata' || (id === 'elfa' && rng() < 0.3) || rng() < 0.08,
    scarSide: id === 'pirata' ? -patchSide : (rng() < 0.5 ? -1 : 1),
    hasWhiskers: id === 'gatita' || (id === 'miedosa' && rng() < 0.35),
    hasStitch: id === 'zombi' || (id === 'solitaria' && rng() < 0.18),
    hasBandage: id === 'miedosa' && rng() < 0.65,
    hasFreckles: rng() < 0.35,
    hasEarring: id === 'pirata' || (id === 'elfa' && rng() < 0.45),
    cheekPuff: id === 'zombi' ? 1.15 + rng() * 0.15 : 1,
  }
}

// ═══════════════════════════ TEXTURAS CHIBI CON FALLBACK ═══════════════════════════

function makeCanvasTex(size, drawFn) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  drawFn(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function createChibiFallbacks() {
  const eye = makeCanvasTex(64, (ctx, s) => {
    const cx = s / 2; const cy = s / 2; const r = s * 0.44
    const g = ctx.createRadialGradient(cx, cy * 0.85, r * 0.15, cx, cy, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.55, '#e2e8f0')
    g.addColorStop(1, '#94a3b8')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  })

  const sparkle = makeCanvasTex(64, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    ctx.clearRect(0, 0, s, s)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.45)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4
      const rad = i % 2 === 0 ? s * 0.44 : s * 0.12
      const x = cx + Math.cos(ang) * rad
      const y = cy + Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  })

  const blush = makeCanvasTex(64, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.45)
    g.addColorStop(0, 'rgba(255,130,165,0.95)')
    g.addColorStop(0.65, 'rgba(255,145,175,0.45)')
    g.addColorStop(1, 'rgba(255,145,175,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, s * 0.46, s * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    for (const dx of [-8, 0, 8]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx - 3, cy + 5)
      ctx.lineTo(cx + dx + 3, cy - 5)
      ctx.stroke()
    }
  })

  const star = makeCanvasTex(64, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    ctx.fillStyle = '#fde047'
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 === 0 ? s * 0.4 : s * 0.18
      const x = cx + Math.cos(ang) * rad
      const y = cy + Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  })

  return { eye, sparkle, blush, star }
}

let chibiTexCache = null
const chibiFiles = {
  eye: 'tex/chibi_eye.png',
  sparkle: 'tex/chibi_sparkle.png',
  blush: 'tex/chibi_blush.png',
  star: 'tex/chibi_star.png',
}

export function getChibiTextures() {
  if (chibiTexCache) return chibiTexCache
  chibiTexCache = createChibiFallbacks()
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : '/'
  const loader = new THREE.TextureLoader()
  for (const [k, rel] of Object.entries(chibiFiles)) {
    loader.load(
      base + rel,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace
        const target = chibiTexCache[k]
        if (target && loaded.image) {
          target.image = loaded.image
          target.needsUpdate = true
        }
      },
      undefined,
      () => { /* fallback procedural ya activo */ },
    )
  }
  return chibiTexCache
}

const emoTexCache = new Map()
export function getEmotionTexture(kind) {
  if (kind === 'star') return getChibiTextures().star
  if (emoTexCache.has(kind)) return emoTexCache.get(kind)

  const tex = makeCanvasTex(64, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    if (kind === 'heart') {
      ctx.fillStyle = '#ff5d8f'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy + 16)
      ctx.bezierCurveTo(cx - 24, cy + 2, cx - 22, cy - 18, cx, cy - 6)
      ctx.bezierCurveTo(cx + 22, cy - 18, cx + 24, cy + 2, cx, cy + 16)
      ctx.fill()
      ctx.stroke()
    } else if (kind === 'drop') {
      ctx.fillStyle = '#60a5fa'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy - 20)
      ctx.bezierCurveTo(cx + 18, cy + 2, cx + 16, cy + 20, cx, cy + 20)
      ctx.bezierCurveTo(cx - 16, cy + 20, cx - 18, cy + 2, cx, cy - 20)
      ctx.fill()
      ctx.stroke()
    } else if (kind === 'exclaim') {
      ctx.fillStyle = '#facc15'
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 4
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText('!', cx, cy + 2)
      ctx.fillText('!', cx, cy + 2)
    } else if (kind === 'question') {
      ctx.fillStyle = '#c084fc'
      ctx.strokeStyle = '#3b0764'
      ctx.lineWidth = 4
      ctx.font = 'bold 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText('¿?', cx, cy + 2)
      ctx.fillText('¿?', cx, cy + 2)
    }
  })
  emoTexCache.set(kind, tex)
  return tex
}

// ═══════════════════════════ BOCAS PROCEDURALES ═══════════════════════════

export function SkinMouth({ mouthType }) {
  const mDark = getMat('#2a1030', 0.6, 0)
  const mWhite = getMat('#f8fafc', 0.35, 0)

  if (mouthType === 'w') {
    return grp({ scale: 0.78 },
      msh({ geometry: GEO.torusArc, material: mDark, position: [-0.095, 0.02, 0], rotation: [0, 0, Math.PI], scale: [0.1, 0.1, 0.16] }),
      msh({ geometry: GEO.torusArc, material: mDark, position: [0.095, 0.02, 0], rotation: [0, 0, Math.PI], scale: [0.1, 0.1, 0.16] }),
    )
  }

  if (mouthType === 'zigzag') {
    return grp({ scale: 0.76 },
      ...[-0.14, -0.045, 0.045, 0.14].map((x, i) =>
        msh({
          key: i,
          geometry: GEO.box,
          material: mDark,
          position: [x, i % 2 === 0 ? 0.02 : -0.02, 0],
          rotation: [0, 0, i % 2 === 0 ? -0.55 : 0.55],
          scale: [0.11, 0.036, 0.036],
        })
      ),
    )
  }

  if (mouthType === 'dientes') {
    return grp({ scale: 0.78 },
      msh({ geometry: GEO.torusArc, material: mDark, rotation: [0, 0, Math.PI], scale: [0.21, 0.18, 0.2] }),
      msh({ geometry: GEO.cone, material: mWhite, position: [-0.09, -0.02, 0.01], rotation: [0, 0, Math.PI], scale: [0.042, 0.08, 0.03] }),
      msh({ geometry: GEO.cone, material: mWhite, position: [0.09, -0.02, 0.01], rotation: [0, 0, Math.PI], scale: [0.042, 0.08, 0.03] }),
    )
  }

  return msh({ geometry: GEO.torusArc, material: mDark, rotation: [0, 0, Math.PI], scale: [0.15, 0.15, 0.16] })
}

// ═══════════════════════════ ACCESORIOS POR FAMILIA ═══════════════════════════

export function SkinAccessory({ skin }) {
  const { id, hatColor, ribbonColor, earColor, earInnerColor, earScale, earTilt, earDroop, patchSide } = skin

  const mHat = getMat(hatColor, 0.55, 0.05)
  const mRib = getMat(ribbonColor, 0.42, 0.12)
  const mEar = getMat(earColor, 0.45, 0.02)
  const mEarIn = getMat(earInnerColor, 0.5, 0)
  const mDark = getMat('#1f1a2c', 0.6, 0.05)
  const mGold = getMat('#f5c542', 0.28, 0.72)
  const mWhite = getMat('#f1f5f9', 0.4, 0)
  const mScar = getMat('#9b2242', 0.5, 0)
  const mFreckle = getMat('#7c3f2c', 0.6, 0, null, 0.75)

  return grp(null,
    // 1. ELFA GRUÑONA: gorro puntiagudo con cinta + orejas puntiagudas laterales
    id === 'elfa' && grp(null,
      grp({ position: [0, 0.82, -0.14], rotation: [-0.42, 0, 0.12] },
        msh({ geometry: GEO.cone, material: mHat, position: [0, 0.36, 0], scale: [0.56, 0.82, 0.56] }),
        msh({ geometry: GEO.torus, material: mRib, position: [0, -0.02, 0], rotation: [Math.PI / 2, 0, 0], scale: [0.55, 0.55, 0.38] }),
        msh({ geometry: GEO.sphere, material: mWhite, position: [0, 0.78, 0], scale: 0.12 }),
      ),
      ...[-1, 1].map((sg) =>
        grp({
          key: sg,
          position: [sg * 0.96, 0.24, 0.02],
          rotation: [earTilt * 0.5, sg * 0.2, -sg * (1.05 + earDroop * 0.4)],
          scale: [0.2 * earScale, 0.62 * earScale, 0.12 * earScale],
        },
          msh({ geometry: GEO.cone, material: mEar, position: [0, 0.4, 0] }),
          msh({ geometry: GEO.cone, material: mEarIn, position: [0, 0.38, 0.35], scale: [0.55, 0.7, 0.4] }),
        )
      ),
    ),

    // 2. GATITA SOCIABLE: dos orejas triangulares arriba + colita
    id === 'gatita' && grp(null,
      ...[-1, 1].map((sg) =>
        grp({
          key: sg,
          position: [sg * 0.52, 0.82, 0.06],
          rotation: [earTilt * 0.4, sg * 0.15, -sg * (0.36 + earDroop * 0.2)],
          scale: [0.26 * earScale, 0.42 * earScale, 0.14 * earScale],
        },
          msh({ geometry: GEO.cone, material: mEar, position: [0, 0.45, 0] }),
          msh({ geometry: GEO.cone, material: mEarIn, position: [0, 0.42, 0.45], scale: [0.58, 0.7, 0.35] }),
        )
      ),
      msh({ geometry: GEO.torusArc, material: mEar, position: [0, -0.36, -0.96], rotation: [0.4, Math.PI / 2, 0], scale: [0.24, 0.24, 0.24] }),
    ),

    // 3. MAGA CURIOSA: sombrero cónico con ala, cinta, punta doblada y humo + orejitas
    id === 'maga' && grp(null,
      grp({ position: [0, 0.82, -0.1], rotation: [-0.22, 0, earTilt * 0.25] },
        msh({ geometry: GEO.cyl, material: mHat, scale: [0.92, 0.06, 0.92] }),
        msh({ geometry: GEO.cone, material: mHat, position: [0, 0.45, 0], scale: [0.5, 0.88, 0.5] }),
        msh({ geometry: GEO.torus, material: mRib, position: [0, 0.08, 0], rotation: [Math.PI / 2, 0, 0], scale: [0.48, 0.48, 0.3] }),
        msh({ geometry: GEO.box, material: mGold, position: [0, 0.09, 0.51], scale: [0.14, 0.11, 0.06] }),
        msh({ geometry: GEO.cone, material: mHat, position: [0.08, 0.92, -0.1], rotation: [-0.55, 0, -0.45], scale: [0.16, 0.35, 0.16] }),
        msh({ geometry: GEO.sphere, material: getMat('#d8b4fe', 0.6, 0, '#a855f7', 0.65), position: [0.2, 1.12, -0.22], scale: 0.09 }),
        msh({ geometry: GEO.sphere, material: getMat('#e9d5ff', 0.6, 0, '#c084fc', 0.45), position: [0.28, 1.28, -0.28], scale: 0.06 }),
      ),
      ...[-1, 1].map((sg) =>
        msh({ key: sg, geometry: GEO.sphere, material: mEar, position: [sg * 0.95, 0.1, 0], scale: [0.12 * earScale, 0.18 * earScale, 0.1] })
      ),
    ),

    // 4. PIRATA VALIENTE: pañuelo/bandana con nudo atrás
    id === 'pirata' && grp(null,
      msh({ geometry: GEO.sphere, material: mHat, position: [0, 0.42, -0.05], scale: [0.96, 0.66, 0.96] }),
      msh({ geometry: GEO.torus, material: mRib, position: [0, 0.56, -0.02], rotation: [Math.PI / 2 + 0.15, 0, 0], scale: [0.83, 0.83, 0.32] }),
      msh({ geometry: GEO.cone, material: mHat, position: [-0.14, 0.48, -0.96], rotation: [-2.2, 0, 0.35], scale: [0.12, 0.34, 0.06] }),
      msh({ geometry: GEO.cone, material: mHat, position: [0.14, 0.45, -0.96], rotation: [-2.1, 0, -0.4], scale: [0.11, 0.3, 0.06] }),
    ),

    // 5. ZOMBI GLOTONA: aletas/orejas laterales, remiendo en frente, mejillas hinchadas
    id === 'zombi' && grp(null,
      ...[-1, 1].map((sg) =>
        msh({
          key: sg,
          geometry: GEO.box,
          material: mHat,
          position: [sg * 0.96, 0.12, -0.05],
          rotation: [0, 0, sg * (0.2 + earDroop * 0.3)],
          scale: [0.22 * earScale, 0.34 * earScale, 0.12],
        })
      ),
      grp({ position: [0.32, 0.68, 0.58], rotation: [-0.65, 0.4, 0.2] },
        msh({ geometry: GEO.box, material: mRib, scale: [0.26, 0.2, 0.04] }),
        ...[-0.08, 0.08].map((px, i) =>
          msh({ key: i, geometry: GEO.box, material: mDark, position: [px, 0.09, 0.025], scale: [0.03, 0.08, 0.02] })
        ),
      ),
      ...[-1, 1].map((sg) =>
        msh({ key: sg, geometry: GEO.sphere, material: mEar, position: [sg * 0.58, -0.14, 0.72], scale: 0.18 * skin.cheekPuff })
      ),
    ),

    // 6. MIEDOSA (Conejito temblón): orejas largas caídas + colita pompón
    id === 'miedosa' && grp(null,
      ...[-1, 1].map((sg) =>
        grp({
          key: sg,
          position: [sg * 0.52, 0.72, -0.12],
          rotation: [-0.35 - earDroop * 0.45, 0, -sg * (0.55 + earDroop * 0.6)],
          scale: [0.2 * earScale, 0.68 * earScale, 0.12 * earScale],
        },
          msh({ geometry: GEO.sphere, material: mHat, position: [0, 0.45, 0] }),
          msh({ geometry: GEO.sphere, material: mEarIn, position: [0, 0.45, 0.4], scale: [0.55, 0.75, 0.3] }),
        )
      ),
      msh({ geometry: GEO.sphere, material: mWhite, position: [0, -0.35, -0.98], scale: 0.22 }),
    ),

    // 7. RUTINARIA (Boina clásica): boina inclinada con rabito
    id === 'rutinaria' && grp({ position: [0.08, 0.84, -0.08], rotation: [-0.18, 0, -0.24] },
      msh({ geometry: GEO.sphere, material: mHat, scale: [0.84, 0.24, 0.84] }),
      msh({ geometry: GEO.cyl, material: mRib, position: [0, -0.08, 0], scale: [0.62, 0.12, 0.62] }),
      msh({ geometry: GEO.cyl, material: mDark, position: [0, 0.24, 0], scale: [0.04, 0.14, 0.04] }),
    ),

    // 8. ASCÉTICA (Monje zen): halo flotante dorado + cinta con gema
    id === 'ascetica' && grp(null,
      msh({ geometry: GEO.torusThin, material: getMat('#fde047', 0.2, 0.6, '#facc15'), position: [0, 1.24, -0.06], rotation: [Math.PI / 2, 0, 0], scale: 0.54 }),
      msh({ geometry: GEO.torus, material: mRib, position: [0, 0.62, 0], rotation: [Math.PI / 2 + 0.12, 0, 0], scale: [0.78, 0.78, 0.28] }),
      msh({ geometry: GEO.octa, material: mGold, position: [0, 0.62, 0.78], scale: 0.09 }),
    ),

    // 9. SOLITARIA (Encapuchada con gafas): capucha trasera + visor en frente
    id === 'solitaria' && grp(null,
      msh({ geometry: GEO.torus, material: mHat, position: [0, 0.08, -0.18], rotation: [0.25, 0, 0], scale: [0.96, 0.96, 1.35] }),
      msh({ geometry: GEO.sphere, material: mHat, position: [0, 0.2, -0.35], scale: [0.98, 0.98, 0.82] }),
      grp({ position: [0, 0.62, 0.76], rotation: [-0.55, 0, 0] },
        msh({ geometry: GEO.box, material: mDark, scale: [0.78, 0.18, 0.08] }),
        msh({ geometry: GEO.box, material: getMat('#38bdf8', 0.2, 0.3, '#0284c7', 0.75), position: [0, 0, 0.04], scale: [0.7, 0.13, 0.03] }),
      ),
    ),

    // 10. ALEGRE (Estrellita festiva): antenitas con estrellas + mini alitas
    id === 'alegre' && grp(null,
      ...[-1, 1].map((sg) =>
        grp({ key: sg, position: [sg * 0.34, 0.86, 0.04], rotation: [0.1, 0, -sg * 0.32] },
          msh({ geometry: GEO.cyl, material: mRib, position: [0, 0.18, 0], scale: [0.03, 0.36, 0.03] }),
          msh({ geometry: GEO.octa, material: mHat, position: [0, 0.38, 0], scale: 0.14 * earScale }),
        )
      ),
      ...[-1, 1].map((sg) =>
        msh({ key: sg, geometry: GEO.sphere, material: mWhite, position: [sg * 0.46, 0.12, -0.94], rotation: [0.2, sg * 0.5, sg * 0.3], scale: [0.32, 0.18, 0.06] })
      ),
    ),

    // ═══════════════ DETALLES FACIALES PROCEDURALES ═══════════════

    skin.hasPatch && grp(null,
      msh({ geometry: GEO.cyl, material: mDark, position: [patchSide * 0.36, 0.14, 0.97], rotation: [Math.PI / 2, 0, 0], scale: [0.24, 0.04, 0.24] }),
      msh({ geometry: GEO.box, material: mDark, position: [patchSide * 0.15, 0.4, 0.86], rotation: [0.2, 0, patchSide * 0.55], scale: [0.85, 0.045, 0.04] }),
    ),

    skin.hasScar && grp({ position: [skin.scarSide * 0.56, -0.05, 0.8], rotation: [0, skin.scarSide * 0.55, -skin.scarSide * 0.4] },
      msh({ geometry: GEO.box, material: mScar, scale: [0.025, 0.22, 0.02] }),
      msh({ geometry: GEO.box, material: mScar, position: [0, 0.04, 0], scale: [0.09, 0.02, 0.02] }),
      msh({ geometry: GEO.box, material: mScar, position: [0, -0.04, 0], scale: [0.09, 0.02, 0.02] }),
    ),

    skin.hasWhiskers && grp(null,
      ...[-1, 1].map((sg) =>
        grp({ key: sg, position: [sg * 0.72, -0.04, 0.64], rotation: [0, sg * 0.65, 0] },
          msh({ geometry: GEO.box, material: mDark, position: [0, 0.04, 0], rotation: [0, 0, sg * 0.12], scale: [0.24, 0.018, 0.018] }),
          msh({ geometry: GEO.box, material: mDark, position: [0, -0.04, 0], rotation: [0, 0, -sg * 0.12], scale: [0.22, 0.018, 0.018] }),
        )
      ),
    ),

    skin.hasStitch && grp({ position: [-0.56, -0.1, 0.78], rotation: [0, -0.6, 0.25] },
      msh({ geometry: GEO.box, material: mDark, scale: [0.2, 0.02, 0.02] }),
      ...[-0.06, 0, 0.06].map((x, i) =>
        msh({ key: i, geometry: GEO.box, material: mDark, position: [x, 0, 0], scale: [0.02, 0.08, 0.02] })
      ),
    ),

    skin.hasBandage && msh({
      geometry: GEO.box,
      material: getMat('#f5d0a9', 0.6, 0),
      position: [0.56, -0.04, 0.8],
      rotation: [0, 0.55, 0.3],
      scale: [0.22, 0.09, 0.025],
    }),

    skin.hasFreckles && grp(null,
      ...[-1, 1].map((sg) =>
        grp({ key: sg, position: [sg * 0.54, -0.02, 0.82], rotation: [0, sg * 0.6, 0] },
          msh({ geometry: GEO.circle, material: mFreckle, position: [-0.04, 0.02, 0], scale: 0.02 }),
          msh({ geometry: GEO.circle, material: mFreckle, position: [0.03, 0.03, 0], scale: 0.018 }),
          msh({ geometry: GEO.circle, material: mFreckle, position: [0, -0.02, 0], scale: 0.02 }),
        )
      ),
    ),

    skin.hasEarring && msh({
      geometry: GEO.torusThin,
      material: mGold,
      position: [-patchSide * 0.98, -0.06, 0.08],
      rotation: [0, Math.PI / 2, 0],
      scale: 0.11,
    }),
  )
}
