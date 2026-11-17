import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { useFrame } from '@react-three/fiber'
import { NODE_R, BALL_R, mulberry32 } from '../../Core/world.js'
import WorldHtml from './WorldHtml.jsx'
import { applyLoadedImage } from './texUtils.js'
import { withCameraFade } from './Paths.jsx'

function applyCityFade(mat) {
  if (!mat || mat.userData._camFade) return
  mat.userData._camFade = true
  withCameraFade(mat, 1.7, 2.5)
  mat.needsUpdate = true
}

function useCityFade(ref) {
  useLayoutEffect(() => {
    ref.current?.traverse((o) => {
      if (o.isMesh && o.material) applyCityFade(o.material)
    })
  }, [ref])
}

const U = BALL_R * 2 // unidad de la ciudad: una bollita de ancho
const ROAD_W = U * 1.18
const ROAD_H = 0.085
const UP = new THREE.Vector3(0, 1, 0)
const GOLD = '#ffd54a'
const GREEN = '#5dffb0'

const txt = (n) => (n > 0 ? '+' : '−') + Math.abs(n)

// Actividad reciente por terminal (`${nodeIdx}:${vertIdx}:${kind}` -> { power, at })
// La actualiza Bollita.jsx en useFrame sin provocar renders de React.
export const terminalPulse = new Map()

export function getTerminals(node) {
  if (Array.isArray(node.terminals) && node.terminals.length > 0) return node.terminals
  const list = []
  for (const p of node.ports || []) {
    if (p.out != null && node.verts[p.out]) {
      const v = node.verts[p.out]
      list.push({ vert: p.out, kind: 'out', way: p.wayOut || null, to: p.to, dir: v.dir, pos: v.pos })
    }
    if (p.in != null && node.verts[p.in]) {
      const v = node.verts[p.in]
      list.push({ vert: p.in, kind: 'in', way: p.wayIn || null, to: p.to, dir: v.dir, pos: v.pos })
    }
  }
  return list
}

// ───────────────────────── Carga cacheada de modelos GLB (public/models) ─────────────────────────
const gltfLoader = new GLTFLoader()
const glbPromiseCache = new Map()
const glbResolvedCache = new Map()

function loadGlbModel(name) {
  if (glbPromiseCache.has(name)) return glbPromiseCache.get(name)
  const base = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/')
  const url = `${base}models/${name}.glb`
  const promise = new Promise((resolve) => {
    gltfLoader.load(
      url,
      (gltf) => {
        let found = null
        gltf.scene?.traverse((obj) => {
          if (!found && obj.isMesh && obj.geometry) found = obj
        })
        if (!found) {
          glbResolvedCache.set(name, null)
          resolve(null)
          return
        }
        const geometry = found.geometry.clone()
        if (!geometry.attributes.normal) geometry.computeVertexNormals()
        const srcMat = Array.isArray(found.material) ? found.material[0] : found.material
        const material = srcMat
          ? srcMat.clone()
          : new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, metalness: 0.35 })
        if ('flatShading' in material) material.flatShading = false
        material.needsUpdate = true
        const asset = { geometry, material }
        glbResolvedCache.set(name, asset)
        resolve(asset)
      },
      undefined,
      () => {
        glbResolvedCache.set(name, null)
        resolve(null)
      },
    )
  })
  glbPromiseCache.set(name, promise)
  return promise
}

function useGlbAsset(name) {
  const [asset, setAsset] = useState(() => glbResolvedCache.get(name) ?? null)
  useEffect(() => {
    if (glbResolvedCache.has(name)) {
      setAsset(glbResolvedCache.get(name))
      return
    }
    let alive = true
    loadGlbModel(name).then((res) => {
      if (alive && res) setAsset(res)
    })
    return () => { alive = false }
  }, [name])
  return asset
}

// ───────────────────────── Texturas (public/tex con fallback procedural) ─────────────────────────
const texCache = new Map()
const texLoader = new THREE.TextureLoader()

function makeCanvas(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  return c
}

function makeProceduralTex(key, size, draw, { srgb = false, repeatX = 1, repeatY = 1 } = {}) {
  if (texCache.has(key)) return texCache.get(key)
  const canvas = makeCanvas(size, draw)
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texCache.set(key, tex)
  return tex
}

function loadTexWithFallback(filename, fallbackFn, { srgb = false, repeatX = 1, repeatY = 1 } = {}) {
  if (texCache.has(filename)) return texCache.get(filename)
  const canvas = fallbackFn()
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texCache.set(filename, tex)

  const base = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/')
  texLoader.load(
    `${base}tex/${filename}`,
    (loaded) => {
      applyLoadedImage(tex, loaded?.image)
    },
    undefined,
    () => { /* mantiene el fallback procedural sin errores */ },
  )
  return tex
}

// Ruido 2D tileable suave (cosenos armónicos) para texturas orgánicas
function tileNoise2D(u, v) {
  const a = u * Math.PI * 2
  const b = v * Math.PI * 2
  return (
    0.45 * Math.sin(a * 2 + Math.cos(b * 2)) +
    0.28 * Math.cos(b * 3 - Math.sin(a * 3 + 1.1)) +
    0.18 * Math.sin(a * 5 + b * 4 + 0.7) +
    0.09 * Math.cos(a * 7 - b * 6 + 2.3)
  )
}

function getTextures() {
  const buildingAlbedo = loadTexWithFallback(
    'building_albedo.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = '#8b92a8'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(11)
      for (let y = 0; y < s; y += 16) {
        g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
        g.fillRect(0, y, s, 14)
        g.fillStyle = 'rgba(20,24,38,0.18)'
        g.fillRect(0, y + 14, s, 2)
      }
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgba(20,24,38,0.12)'
        g.fillRect(x, 0, 2, s)
      }
    }),
    { srgb: true },
  )

  const buildingNormal = loadTexWithFallback(
    'building_normal.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = 'rgb(128,128,255)'
      g.fillRect(0, 0, s, s)
      for (let y = 0; y < s; y += 16) {
        g.fillStyle = 'rgb(128,162,245)'
        g.fillRect(0, y, s, 2)
        g.fillStyle = 'rgb(128,96,245)'
        g.fillRect(0, y + 13, s, 2)
      }
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgb(156,128,245)'
        g.fillRect(x, 0, 2, s)
      }
    }),
  )

  // Ventanas emisivas con falloff suave (halo y degradado vertical)
  const buildingEmissive = loadTexWithFallback(
    'building_emissive.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = '#000000'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(5)
      for (let y = 6; y < s - 6; y += 16) {
        const vFade = Math.sin((y / s) * Math.PI) * 0.75 + 0.25
        for (let x = 6; x < s - 6; x += 16) {
          if (rng() < 0.48) {
            const cx = x + 4
            const cy = y + 4.5
            const grad = g.createRadialGradient(cx, cy, 0.5, cx, cy, 7.2)
            const warm = rng() < 0.78
            const core = warm ? `rgba(255,218,145,${0.95 * vFade})` : `rgba(148,216,255,${0.95 * vFade})`
            const mid = warm ? `rgba(255,190,100,${0.32 * vFade})` : `rgba(110,190,255,${0.32 * vFade})`
            grad.addColorStop(0, core)
            grad.addColorStop(0.55, mid)
            grad.addColorStop(1, 'rgba(0,0,0,0)')
            g.fillStyle = grad
            g.fillRect(x - 3, y - 3, 14, 15)
          }
        }
      }
    }),
    { srgb: true },
  )

  const hullNormal = loadTexWithFallback(
    'hull_normal.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = 'rgb(128,128,255)'
      g.fillRect(0, 0, s, s)
      g.strokeStyle = 'rgb(102,102,235)'
      g.lineWidth = 2
      for (let i = 0; i < s; i += 32) {
        g.strokeRect(i + 1, 1, 30, s - 2)
        g.beginPath()
        g.moveTo(0, i)
        g.lineTo(s, i)
        g.stroke()
      }
      g.fillStyle = 'rgb(166,166,255)'
      for (let y = 8; y < s; y += 32) {
        for (let x = 8; x < s; x += 32) {
          g.fillRect(x, y, 2, 2)
          g.fillRect(x + 16, y + 16, 2, 2)
        }
      }
    }),
  )

  const asphalt = loadTexWithFallback(
    'asphalt.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = '#202436'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(42)
      for (let i = 0; i < 900; i++) {
        const v = Math.floor(28 + rng() * 22)
        g.fillStyle = `rgb(${v},${v + 3},${v + 13})`
        g.fillRect(rng() * s, rng() * s, 2, 2)
      }
      // Bordillos suaves con gradiente lateral
      const gL = g.createLinearGradient(0, 0, 22, 0)
      gL.addColorStop(0, '#464f70')
      gL.addColorStop(1, 'rgba(32,36,54,0)')
      g.fillStyle = gL
      g.fillRect(0, 0, 22, s)
      const gR = g.createLinearGradient(s - 22, 0, s, 0)
      gR.addColorStop(0, 'rgba(32,36,54,0)')
      gR.addColorStop(1, '#464f70')
      g.fillStyle = gR
      g.fillRect(s - 22, 0, 22, s)
      // Líneas laterales sutiles
      g.fillStyle = 'rgba(200,215,255,0.22)'
      g.fillRect(24, 0, 3, s)
      g.fillRect(s - 27, 0, 3, s)
      // Línea discontinua central suave
      g.fillStyle = 'rgba(220,230,255,0.34)'
      for (let y = 6; y < s; y += 32) g.fillRect(s / 2 - 2, y, 4, 16)
    }),
    { srgb: true },
  )

  const asphaltNormal = loadTexWithFallback(
    'asphalt_normal.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = 'rgb(128,128,255)'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(99)
      for (let i = 0; i < 650; i++) {
        const nx = Math.floor(114 + rng() * 28)
        const ny = Math.floor(114 + rng() * 28)
        g.fillStyle = `rgb(${nx},${ny},248)`
        g.fillRect(rng() * s, rng() * s, 2, 2)
      }
    }),
  )

  // Normal map procedural continuo para relieve suave del planeta
  const planetNormal = makeProceduralTex(
    '__planet_normal_proc',
    256,
    (g, s) => {
      const img = g.createImageData(s, s)
      const d = img.data
      const eps = 1 / s
      for (let y = 0; y < s; y++) {
        const v = y / s
        for (let x = 0; x < s; x++) {
          const u = x / s
          const hx = (tileNoise2D(u + eps, v) - tileNoise2D(u - eps, v)) * 1.4
          const hy = (tileNoise2D(u, v + eps) - tileNoise2D(u, v - eps)) * 1.4
          const nx = -hx
          const ny = -hy
          const nz = 1.0
          const inv = 1 / Math.hypot(nx, ny, nz)
          const idx = (y * s + x) * 4
          d[idx] = Math.round((nx * inv * 0.5 + 0.5) * 255)
          d[idx + 1] = Math.round((ny * inv * 0.5 + 0.5) * 255)
          d[idx + 2] = Math.round((nz * inv * 0.5 + 0.5) * 255)
          d[idx + 3] = 255
        }
      }
      g.putImageData(img, 0, 0)
    },
    { repeatX: 3, repeatY: 2 },
  )

  // Nubes finas procedurales con transparencia suave
  const planetClouds = makeProceduralTex(
    '__planet_clouds_proc',
    256,
    (g, s) => {
      const img = g.createImageData(s, s)
      const d = img.data
      for (let y = 0; y < s; y++) {
        const v = y / s
        const latFade = Math.sin(v * Math.PI)
        for (let x = 0; x < s; x++) {
          const u = x / s
          const n = tileNoise2D(u * 1.5, v * 1.5) * 0.5 + 0.5
          const a = THREE.MathUtils.smoothstep(n, 0.52, 0.88) * latFade
          const idx = (y * s + x) * 4
          d[idx] = 235
          d[idx + 1] = 244
          d[idx + 2] = 255
          d[idx + 3] = Math.round(a * 170)
        }
      }
      g.putImageData(img, 0, 0)
    },
    { srgb: true, repeatX: 2, repeatY: 1 },
  )

  return {
    buildingAlbedo,
    buildingNormal,
    buildingEmissive,
    hullNormal,
    asphalt,
    asphaltNormal,
    planetNormal,
    planetClouds,
  }
}

// ───────────────────────── Helpers de geometría suave (sin facetas) ─────────────────────────
function makeRoundedBoxGeo(w = 1, h = 1, d = 1, r = 0.14, segs = 4) {
  const rr = Math.min(r, w * 0.35, h * 0.35, d * 0.35)
  const hw = Math.max(0.02, w * 0.5 - rr)
  const hd = Math.max(0.02, d * 0.5 - rr)
  const shape = new THREE.Shape()
  shape.moveTo(-hw, -hd)
  shape.lineTo(hw, -hd)
  shape.quadraticCurveTo(hw + rr, -hd, hw + rr, -hd + rr)
  shape.lineTo(hw + rr, hd - rr)
  shape.quadraticCurveTo(hw + rr, hd, hw, hd)
  shape.lineTo(-hw, hd)
  shape.quadraticCurveTo(-hw - rr, hd, -hw - rr, hd - rr)
  shape.lineTo(-hw - rr, -hd + rr)
  shape.quadraticCurveTo(-hw - rr, -hd, -hw, -hd)

  const extrudeH = Math.max(0.02, h - rr * 2)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: segs,
    curveSegments: segs * 2,
  })
  geo.rotateX(-Math.PI / 2)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const cx = (bb.min.x + bb.max.x) * 0.5
  const cz = (bb.min.z + bb.max.z) * 0.5
  const sx = w / Math.max(1e-4, bb.max.x - bb.min.x)
  const sy = h / Math.max(1e-4, bb.max.y - bb.min.y)
  const sz = d / Math.max(1e-4, bb.max.z - bb.min.z)
  geo.translate(-cx, -bb.min.y, -cz)
  geo.scale(sx, sy, sz)
  geo.computeVertexNormals()
  return geo
}

function makeLatheGeo(points, segments = 32) {
  const vecs = points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y))
  const geo = new THREE.LatheGeometry(vecs, segments)
  geo.computeVertexNormals()
  return geo
}

// ───────────────────────── Geometrías compartidas suaves ─────────────────────────
// Edificios de ciudad (3 variantes biseladas/curvas, base en y=0, altura 1)
const houseRoundedGeo = makeRoundedBoxGeo(1, 1, 1, 0.13, 3)
const houseTowerGeo = makeLatheGeo([
  [0.5, 0],
  [0.52, 0.06],
  [0.46, 0.16],
  [0.42, 0.55],
  [0.34, 0.82],
  [0.24, 0.94],
  [0.12, 0.99],
  [0.001, 1.0],
], 28)
const houseCapsuleGeo = makeLatheGeo([
  [0.48, 0],
  [0.5, 0.08],
  [0.49, 0.58],
  [0.44, 0.78],
  [0.32, 0.92],
  [0.16, 0.985],
  [0.001, 1.0],
], 28)

// Primitivas suaves compartidas
const cylSmooth = new THREE.CylinderGeometry(0.5, 0.5, 1, 24).translate(0, 0.5, 0)
const roundedUnit = makeRoundedBoxGeo(1, 1, 1, 0.12, 3)
const domeGeo = new THREE.SphereGeometry(0.64, 36, 20, 0, Math.PI * 2, 0, Math.PI / 2)
const padGeo = makeLatheGeo([
  [0.001, 0],
  [1.04, 0],
  [1.02, 0.05],
  [0.94, 0.11],
  [0.86, 0.12],
  [0.001, 0.12],
], 32)
const basinGeo = makeLatheGeo([
  [0.001, 0],
  [0.96, 0],
  [0.98, 0.14],
  [0.92, 0.34],
  [0.84, 0.36],
  [0.74, 0.24],
  [0.001, 0.24],
], 32)
const poolGeo = new THREE.CylinderGeometry(0.76, 0.72, 0.08, 32).translate(0, 0.28, 0)

// Destinos suaves por estilo
const tentCanopyGeo = makeLatheGeo([
  [0.001, 0.85],
  [0.18, 0.72],
  [0.48, 0.42],
  [0.82, 0.12],
  [0.92, 0.0],
  [0.85, -0.02],
  [0.001, 0.45],
], 32)
const towerBodyGeo = makeLatheGeo([
  [0.48, 0],
  [0.46, 0.15],
  [0.38, 0.55],
  [0.34, 1.15],
  [0.42, 1.32],
  [0.36, 1.44],
  [0.22, 1.72],
  [0.08, 1.92],
  [0.001, 1.98],
], 32)
const domeRingGeo = new THREE.TorusGeometry(0.66, 0.07, 16, 40)
const goldIconGeo = makeLatheGeo([
  [0.001, -0.32],
  [0.18, -0.14],
  [0.28, 0.0],
  [0.18, 0.16],
  [0.001, 0.34],
], 20)
const greenIconGeo = new THREE.SphereGeometry(0.25, 24, 18)
const iconHaloRingGeo = new THREE.TorusGeometry(0.36, 0.022, 12, 32)

// Farola de pista (fallback suave de lamp.glb, base y=0, altura 1)
const lampFallbackGeo = makeLatheGeo([
  [0.09, 0],
  [0.08, 0.08],
  [0.038, 0.18],
  [0.032, 0.78],
  [0.085, 0.86],
  [0.11, 0.94],
  [0.06, 0.99],
  [0.001, 1.0],
], 20)
const haloSphereGeo = new THREE.SphereGeometry(1, 16, 12)

// Atmósfera
const atmoOuterGeo = new THREE.SphereGeometry(NODE_R * 1.11, 64, 48)
const atmoInnerGeo = new THREE.SphereGeometry(NODE_R * 1.018, 64, 48)
const cloudsGeo = new THREE.SphereGeometry(NODE_R * 1.028, 64, 48)

// Geometrías suaves de estaciones terminales (32-36 segmentos, perfiles curvos biselados)
const stBaseOut = makeLatheGeo([
  [0.001, 0],
  [2.05, 0],
  [2.02, 0.12],
  [1.82, 0.36],
  [1.72, 0.42],
  [0.001, 0.42],
], 36)
const stHullOut = makeLatheGeo([
  [1.52, 0.36],
  [1.48, 0.65],
  [1.36, 1.25],
  [1.26, 1.75],
  [1.28, 1.88],
], 36)
const stCollarOut = new THREE.TorusGeometry(1.28, 0.12, 16, 40)
const stPortalOut = new THREE.TorusGeometry(1.33, 0.085, 16, 44)
const stDoorLeaf = makeRoundedBoxGeo(0.95, 0.11, 1.75, 0.04, 3).translate(0, -0.055, 0)

const stBaseIn = makeLatheGeo([
  [0.001, 0],
  [2.28, 0],
  [2.22, 0.14],
  [2.05, 0.36],
  [1.96, 0.4],
  [0.001, 0.4],
], 36)
const stBunkerIn = makeLatheGeo([
  [1.88, 0.34],
  [1.76, 0.65],
  [1.54, 1.02],
  [1.36, 1.28],
  [1.26, 1.35],
], 36)
const stThroatIn = new THREE.CylinderGeometry(1.18, 1.18, 0.95, 32, 1, true).translate(0, 0.72, 0)
const stPortalIn = new THREE.TorusGeometry(1.34, 0.068, 14, 44)
const stBeaconGeo = new THREE.SphereGeometry(0.11, 16, 12)
const stDishGeo = new THREE.SphereGeometry(0.42, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.38)
const pylonFallbackGeo = makeLatheGeo([
  [0.24, 0],
  [0.22, 0.12],
  [0.16, 0.55],
  [0.11, 0.9],
  [0.05, 0.98],
  [0.001, 1.0],
], 20)
const podFallbackGeo = makeLatheGeo([
  [0.001, 0],
  [0.44, 0.06],
  [0.48, 0.35],
  [0.42, 0.72],
  [0.26, 0.93],
  [0.001, 1.0],
], 28)

// ───────────────────────── Shader de Atmósfera con Fresnel y Gradiente ─────────────────────────
function makeAtmoMaterial(color, { back = true } = {}) {
  const base = new THREE.Color(color)
  const rim = base.clone().lerp(new THREE.Color('#d8f0ff'), 0.45)
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: base },
      uRimColor: { value: rim },
      uPower: { value: back ? 3.2 : 2.6 },
      uIntensity: { value: back ? 0.55 : 0.28 },
      uBack: { value: back ? 1.0 : 0.0 },
    },
    vertexShader: `
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vNormalV = normalize(normalMatrix * normal);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform vec3 uRimColor;
      uniform float uPower;
      uniform float uIntensity;
      uniform float uBack;
      varying vec3 vNormalV;
      varying vec3 vViewDir;
      void main() {
        float ndv = dot(normalize(vNormalV), normalize(vViewDir));
        float fresnel;
        if (uBack > 0.5) {
          float rim = clamp(1.0 + ndv, 0.0, 1.0);
          float outer = clamp(-ndv, 0.0, 1.0);
          fresnel = pow(rim, uPower) * pow(outer, 1.15) * 2.4;
        } else {
          fresnel = pow(clamp(1.0 - max(ndv, 0.0), 0.0, 1.0), uPower);
        }
        vec3 col = mix(uColor, uRimColor, clamp(fresnel * 1.1, 0.0, 1.0));
        gl_FragColor = vec4(col, clamp(fresnel * uIntensity, 0.0, 0.85));
      }
    `,
    side: back ? THREE.BackSide : THREE.FrontSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  })
}

// ───────────────────────── Esfera del planeta con ruido orgánico suave ─────────────────────────
function fbm3(x, y, z) {
  const o1 = Math.sin(x * 0.85 + 0.4) * Math.sin(y * 0.78 + 1.1) * Math.sin(z * 0.82 + 2.0)
  const o2 = Math.sin(x * 1.85 + z * 1.2) * Math.cos(y * 1.65 - x * 0.7) * 0.45
  const o3 = Math.cos(x * 3.1 - y * 2.4 + z * 2.7) * 0.2
  return o1 + o2 + o3
}

function planetGeo(color) {
  const g = new THREE.SphereGeometry(NODE_R - 0.02, 144, 108)
  const p = g.attributes.position
  const cols = new Float32Array(p.count * 3)
  const a = new THREE.Color(color).multiplyScalar(0.11)
  const b = new THREE.Color(color).multiplyScalar(0.24)
  const d = new THREE.Color(color).multiplyScalar(0.36)
  const c = new THREE.Color()
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = fbm3(v.x, v.y, v.z)
    const t = THREE.MathUtils.smoothstep(n, -0.55, 0.75)
    v.multiplyScalar(1 + (n * 0.022) / NODE_R)
    p.setXYZ(i, v.x, v.y, v.z)
    if (t < 0.5) c.lerpColors(a, b, t * 2)
    else c.lerpColors(b, d, (t - 0.5) * 2)
    cols.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  g.computeVertexNormals()
  return g
}

// ───────────────────────── Calles continuas curvas sobre la esfera ─────────────────────────
function buildRoadGeometries(node) {
  const local = (p) => p.clone().sub(node.pos)
  const rPos = []
  const rUv = []
  const rIdx = []
  const lPos = []
  const lUv = []
  const lIdx = []
  const lamps = []
  const lampHalos = []

  const hw = ROAD_W * 0.5
  // Perfil transversal biselado (6 puntos) para bordes suaves sin aristas duras
  const profile = [
    [-hw * 1.14, -0.025, 0.0],
    [-hw * 0.96, ROAD_H * 0.72, 0.09],
    [-hw * 0.80, ROAD_H, 0.18],
    [hw * 0.80, ROAD_H, 0.82],
    [hw * 0.96, ROAD_H * 0.72, 0.91],
    [hw * 1.14, -0.025, 1.0],
  ]

  const nearExclude = []
  node.verts.forEach((v) => nearExclude.push([v.pos, 2.1]))
  node.destinos.forEach((d) => nearExclude.push([d.pos, 2.5]))
  getTerminals(node).forEach((t) => nearExclude.push([t.pos || node.verts[t.vert].pos, 3.15]))

  const tmpDir = new THREE.Vector3()
  const tmpTan = new THREE.Vector3()
  const tmpSide = new THREE.Vector3()
  const tmpPrev = new THREE.Vector3()
  const tmpNext = new THREE.Vector3()
  const tmpPt = new THREE.Vector3()
  const m4 = (x, y, z, pos) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos)

  for (const r of node.roads) {
    if (!r.points || r.points.length < 2) continue
    const pts = r.points.map(local)
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    const steps = Math.max(pts.length * 4, 18)
    const samples = []
    for (let i = 0; i <= steps; i++) {
      const p = curve.getPoint(i / steps)
      p.normalize().multiplyScalar(NODE_R)
      samples.push(p)
    }

    const rBase = rPos.length / 3
    const lBase = lPos.length / 3
    let arcLen = 0

    for (let i = 0; i < samples.length; i++) {
      const p = samples[i]
      if (i > 0) arcLen += p.distanceTo(samples[i - 1])
      tmpDir.copy(p).normalize()
      tmpPrev.copy(samples[Math.max(0, i - 1)])
      tmpNext.copy(samples[Math.min(samples.length - 1, i + 1)])
      tmpTan.subVectors(tmpNext, tmpPrev)
      tmpTan.addScaledVector(tmpDir, -tmpTan.dot(tmpDir))
      if (tmpTan.lengthSq() < 1e-6) tmpTan.set(1, 0, 0).cross(tmpDir)
      tmpTan.normalize()
      tmpSide.crossVectors(tmpDir, tmpTan).normalize()

      const vCoord = arcLen * 0.42
      for (let k = 0; k < profile.length; k++) {
        const [offX, offY, uCoord] = profile[k]
        tmpPt.copy(tmpDir).multiplyScalar(NODE_R + offY).addScaledVector(tmpSide, offX)
        rPos.push(tmpPt.x, tmpPt.y, tmpPt.z)
        rUv.push(uCoord, vCoord)
      }

      // Cinta central emisiva
      const lh = ROAD_H + 0.008
      const lw = 0.042
      tmpPt.copy(tmpDir).multiplyScalar(NODE_R + lh).addScaledVector(tmpSide, -lw)
      lPos.push(tmpPt.x, tmpPt.y, tmpPt.z)
      lUv.push(0, vCoord)
      tmpPt.copy(tmpDir).multiplyScalar(NODE_R + lh).addScaledVector(tmpSide, lw)
      lPos.push(tmpPt.x, tmpPt.y, tmpPt.z)
      lUv.push(1, vCoord)

      // Farolas espaciadas a los lados de la pista
      if (i > 2 && i < samples.length - 2 && i % 6 === 0) {
        const sideSign = (i / 6) % 2 === 0 ? 1 : -1
        const lampPos = tmpDir.clone().multiplyScalar(NODE_R + ROAD_H * 0.35).addScaledVector(tmpSide, sideSign * (hw + 0.16))
        const worldLamp = lampPos.clone().add(node.pos)
        if (!nearExclude.some(([ep, rad]) => ep.distanceToSquared(worldLamp) < rad * rad)) {
          const lx = tmpSide.clone().multiplyScalar(0.32)
          const ly = tmpDir.clone().multiplyScalar(0.58)
          const lz = tmpTan.clone().multiplyScalar(0.32)
          lamps.push(m4(lx, ly, lz, lampPos))
          const haloPos = lampPos.clone().addScaledVector(tmpDir, 0.54)
          lampHalos.push(m4(
            tmpSide.clone().multiplyScalar(0.24),
            tmpDir.clone().multiplyScalar(0.24),
            tmpTan.clone().multiplyScalar(0.24),
            haloPos,
          ))
        }
      }
    }

    const stride = profile.length
    for (let i = 0; i < samples.length - 1; i++) {
      const a = rBase + i * stride
      const b = a + stride
      for (let k = 0; k < stride - 1; k++) {
        rIdx.push(a + k, b + k, a + k + 1)
        rIdx.push(a + k + 1, b + k, b + k + 1)
      }
      const la = lBase + i * 2
      const lb = la + 2
      lIdx.push(la, lb, la + 1)
      lIdx.push(la + 1, lb, lb + 1)
    }
  }

  const roadGeo = new THREE.BufferGeometry()
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3))
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUv, 2))
  roadGeo.setIndex(rIdx)
  roadGeo.computeVertexNormals()

  const lineGeo = new THREE.BufferGeometry()
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lPos, 3))
  lineGeo.setAttribute('uv', new THREE.Float32BufferAttribute(lUv, 2))
  lineGeo.setIndex(lIdx)
  lineGeo.computeVertexNormals()

  return { roadGeo, lineGeo, lamps, lampHalos }
}

// Matrices locales (respecto al centro del nodo) de edificios variados y suaves.
function cityData(node) {
  const rng = mulberry32(1000 + node.idx)
  const m4 = (x, y, z, pos) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos)

  const { roadGeo, lineGeo, lamps, lampHalos } = buildRoadGeometries(node)

  // Zona prohibida: calles, vértices, destinos y terminales (radio mayor para estaciones).
  const terminals = getTerminals(node)
  const near = node.roads.flatMap((r) => r.points).map((p) => [p, BALL_R + U * 0.78 + 0.12])
  node.verts.forEach((v) => near.push([v.pos, 1.95]))
  node.destinos.forEach((d) => near.push([d.pos, 2.45]))
  terminals.forEach((t) => near.push([t.pos || node.verts[t.vert].pos, 3.05]))

  const hsl = {}
  new THREE.Color(node.color).getHSL(hsl)
  const N = 420
  const rot = rng() * Math.PI * 2
  const col = new THREE.Color()
  const housesRounded = []
  const housesTower = []
  const housesCapsule = []

  for (let i = 0; i < N; i++) {
    const yy = 1 - (2 * (i + 0.5)) / N
    const rr = Math.sqrt(1 - yy * yy)
    const ang = i * Math.PI * (3 - Math.sqrt(5)) + rot
    const dir = new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr)
    const pos = dir.clone().multiplyScalar(NODE_R)
    const world = pos.clone().add(node.pos)
    if (rng() < 0.12 || near.some(([p, m]) => p.distanceToSquared(world) < m * m)) continue
    const h = U * (0.65 + 2.45 * rng() ** 2)
    const u = new THREE.Vector3().crossVectors(Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP, dir).normalize()
    const a = rng() * Math.PI * 2
    const x = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(new THREE.Vector3().crossVectors(dir, u), Math.sin(a))
    const z = new THREE.Vector3().crossVectors(x, dir)
    const wScale = U * (0.52 + 0.48 * rng())
    const dScale = U * (0.52 + 0.48 * rng())
    const item = {
      m: m4(x.multiplyScalar(wScale), dir.clone().multiplyScalar(h), z.multiplyScalar(dScale), pos.addScaledVector(dir, -0.03)),
      c: col.setHSL(hsl.h + (rng() - 0.5) * 0.08, 0.22 + rng() * 0.2, 0.2 + rng() * 0.26).clone(),
    }
    const kindPick = rng()
    if (kindPick < 0.52) housesRounded.push(item)
    else if (kindPick < 0.78) housesTower.push(item)
    else housesCapsule.push(item)
  }

  return { roadGeo, lineGeo, lamps, lampHalos, housesRounded, housesTower, housesCapsule, terminals }
}

function Instanced({ geo, material, items, children, ...rest }) {
  const ref = useRef()
  useLayoutEffect(() => {
    if (!ref.current) return
    items.forEach((it, i) => {
      ref.current.setMatrixAt(i, it.m ?? it)
      if (it.c) ref.current.setColorAt(i, it.c)
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return (
    <instancedMesh key={items.length} ref={ref} args={[geo, material ?? null, items.length]} {...rest}>
      {children}
    </instancedMesh>
  )
}

// ───────────────────────── Destinos con identidad arquitectónica ─────────────────────────
function destinoStyle(name, kind) {
  switch (name) {
    case 'Feria':
    case 'Mercado':
    case 'Picnic':
    case 'Banquete':
      return 'carpa'
    case 'Torneo':
    case 'Carrera':
    case 'Concurso':
      return 'torre'
    case 'Galería':
    case 'Spa':
    case 'Siesta':
      return 'domo'
    case 'Fuente':
    case 'Manantial':
    case 'Hoguera':
      return 'fuente'
    case 'Hamaca':
      return 'hamaca'
    case 'Arcade':
    case 'Subasta':
      return 'pabellon'
    default:
      return kind === 'puntos' ? 'torre' : 'domo'
  }
}

function Destino({ d, base, tex }) {
  const grp = useRef()
  const icon = useRef()
  useCityFade(grp)
  const [hover, setHover] = useState(false)
  const gain = d.kind === 'puntos'
  const color = gain ? GOLD : GREEN
  const bodyColor = gain ? '#7a5e18' : '#1e5b43'
  const roofColor = gain ? '#b98924' : '#2e8864'
  const style = destinoStyle(d.name, d.kind)
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, d.dir), [d])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    icon.current.rotation.y = t * 1.5
    icon.current.position.y = (style === 'torre' ? 2.5 : 2.1) + Math.sin(t * 2 + d.idx) * 0.1
  })

  return (
    <group
      ref={grp}
      position={d.pos.clone().sub(base)}
      quaternion={q}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      {/* Basamento circular biselado */}
      <mesh geometry={padGeo} receiveShadow castShadow>
        <meshPhysicalMaterial
          color="#2a2f44"
          normalMap={tex.hullNormal}
          roughness={0.55}
          metalness={0.42}
          clearcoat={0.5}
          clearcoatRoughness={0.25}
          emissive={color}
          emissiveIntensity={0.14}
        />
      </mesh>

      {style === 'carpa' && (
        <group position={[0, 0.1, 0]}>
          {[-0.45, 0.45].map((px) => [-0.45, 0.45].map((pz) => (
            <mesh key={`${px}${pz}`} geometry={cylSmooth} position={[px, 0, pz]} scale={[0.08, 0.72, 0.08]} castShadow>
              <meshPhysicalMaterial color="#cfd5e6" roughness={0.35} metalness={0.55} clearcoat={0.6} />
            </mesh>
          )))}
          <mesh geometry={roundedUnit} position={[0, 0, 0]} scale={[0.72, 0.36, 0.52]} castShadow>
            <meshStandardMaterial color={bodyColor} map={tex.buildingAlbedo} normalMap={tex.buildingNormal} roughness={0.62} />
          </mesh>
          <mesh geometry={tentCanopyGeo} position={[0, 0.68, 0]} scale={[1.05, 0.92, 1.05]} castShadow>
            <meshPhysicalMaterial color={roofColor} roughness={0.45} clearcoat={0.35} emissive={color} emissiveIntensity={0.16} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {style === 'torre' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={towerBodyGeo} scale={[0.92, 0.98, 0.92]} castShadow>
            <meshPhysicalMaterial
              color={bodyColor}
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.42}
              roughness={0.42}
              metalness={0.4}
              clearcoat={0.6}
              clearcoatRoughness={0.22}
            />
          </mesh>
          <mesh geometry={domeRingGeo} position={[0, 1.32, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.65, 0.65, 0.65]}>
            <meshStandardMaterial color={roofColor} emissive={color} emissiveIntensity={0.35} roughness={0.3} metalness={0.6} />
          </mesh>
        </group>
      )}

      {style === 'domo' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={cylSmooth} scale={[1.38, 0.34, 1.38]} castShadow>
            <meshPhysicalMaterial color="#353b54" normalMap={tex.hullNormal} roughness={0.45} metalness={0.48} clearcoat={0.55} />
          </mesh>
          <mesh geometry={domeGeo} position={[0, 0.32, 0]} scale={[1.04, 1.04, 1.04]} castShadow>
            <meshPhysicalMaterial
              color={bodyColor}
              normalMap={tex.hullNormal}
              emissive={color}
              emissiveIntensity={0.18}
              roughness={0.24}
              metalness={0.52}
              clearcoat={0.85}
              clearcoatRoughness={0.14}
            />
          </mesh>
          <mesh geometry={domeRingGeo} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color="#8fa0cc" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh geometry={roundedUnit} position={[0, 0, 0.62]} scale={[0.56, 0.48, 0.42]} castShadow>
            <meshStandardMaterial color="#464e6e" emissive="#ffffff" emissiveMap={tex.buildingEmissive} emissiveIntensity={0.38} roughness={0.5} />
          </mesh>
        </group>
      )}

      {style === 'fuente' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={basinGeo} castShadow receiveShadow>
            <meshPhysicalMaterial color="#40475e" normalMap={tex.hullNormal} roughness={0.55} metalness={0.3} clearcoat={0.4} />
          </mesh>
          <mesh geometry={poolGeo}>
            <meshStandardMaterial
              color={d.name === 'Hoguera' ? '#ff8243' : '#4be3c4'}
              emissive={d.name === 'Hoguera' ? '#ff6a2b' : color}
              emissiveIntensity={0.68}
              roughness={0.18}
            />
          </mesh>
          <mesh geometry={cylSmooth} position={[0, 0.25, 0]} scale={[0.24, 0.76, 0.24]} castShadow>
            <meshPhysicalMaterial color="#838ca8" roughness={0.35} metalness={0.55} clearcoat={0.6} />
          </mesh>
          <mesh geometry={domeGeo} position={[0, 0.96, 0]} scale={[0.28, 0.24, 0.28]}>
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.55} roughness={0.2} />
          </mesh>
        </group>
      )}

      {style === 'hamaca' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={cylSmooth} position={[-0.52, 0, 0]} rotation={[0, 0, 0.2]} scale={[0.1, 0.95, 0.1]} castShadow>
            <meshStandardMaterial color="#73513a" roughness={0.72} />
          </mesh>
          <mesh geometry={cylSmooth} position={[0.52, 0, 0]} rotation={[0, 0, -0.2]} scale={[0.1, 0.95, 0.1]} castShadow>
            <meshStandardMaterial color="#73513a" roughness={0.72} />
          </mesh>
          <mesh geometry={roundedUnit} position={[0, 0.55, 0]} scale={[0.92, 0.1, 0.48]} castShadow>
            <meshStandardMaterial color={roofColor} roughness={0.6} emissive={color} emissiveIntensity={0.18} />
          </mesh>
          <mesh geometry={tentCanopyGeo} position={[0, 0.92, 0]} scale={[0.82, 0.48, 0.65]} castShadow>
            <meshStandardMaterial color="#3c7d63" roughness={0.6} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}

      {style === 'pabellon' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={roundedUnit} scale={[1.15, 0.85, 0.95]} castShadow>
            <meshStandardMaterial
              color={bodyColor}
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.48}
              roughness={0.48}
              metalness={0.32}
            />
          </mesh>
          <mesh geometry={roundedUnit} position={[0, 0.84, 0]} scale={[1.28, 0.18, 1.08]} castShadow>
            <meshPhysicalMaterial color={roofColor} roughness={0.32} metalness={0.55} clearcoat={0.75} emissive={color} emissiveIntensity={0.22} />
          </mesh>
          <mesh geometry={cylSmooth} position={[0.38, 1.0, -0.25]} scale={[0.05, 0.45, 0.05]}>
            <meshStandardMaterial color="#9aa4c2" metalness={0.75} roughness={0.28} />
          </mesh>
        </group>
      )}

      {/* Icono flotante suave + halo */}
      <group ref={icon}>
        <mesh geometry={gain ? goldIconGeo : greenIconGeo} scale={hover ? 1.38 : 1}>
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.65} toneMapped={false} />
        </mesh>
        <mesh geometry={iconHaloRingGeo} rotation={[Math.PI / 2, 0, 0]} scale={hover ? 1.38 : 1}>
          <meshBasicMaterial color={color} transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      {hover && (
        <WorldHtml center position={[0, 3.25, 0]} distanceFactor={14} zIndexRange={[5, 0]}>
          <div className="tag tip">{d.name} · {txt(d.dp)} ⭐ · {txt(d.de)} ⚡</div>
        </WorldHtml>
      )}
    </group>
  )
}

// ───────────────────────── Estaciones Terminales (Salida / Entrada) ─────────────────────────
function Terminal({ node, term, color, tex, podAsset, pylonAsset }) {
  const dir = term.dir || node.verts[term.vert].dir
  const pos = term.pos || node.verts[term.vert].pos
  const isOut = term.kind === 'out'
  const key = `${node.idx}:${term.vert}:${term.kind}`
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir])

  const grp = useRef()
  const doorL = useRef()
  const doorR = useRef()
  const portalMat = useRef()
  const beacons = useRef([])
  const beaconHalos = useRef([])
  const openAmt = useRef(0)
  useCityFade(grp)

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const entry = terminalPulse.get(key)
    const active = entry && t - entry.at < 0.35 ? entry.power : 0
    openAmt.current += (active - openAmt.current) * Math.min(1, dt * 8)

    const slide = openAmt.current * 0.65
    if (doorL.current && doorR.current) {
      doorL.current.position.x = -0.48 - slide
      doorR.current.position.x = 0.48 + slide
    }

    if (portalMat.current) {
      const base = isOut ? 1.55 : 1.05
      portalMat.current.emissiveIntensity = base + openAmt.current * 0.9
    }

    beacons.current.forEach((m, i) => {
      if (!m) return
      const speed = 2.5 + openAmt.current * 5.5
      const wave = 0.5 + 0.5 * Math.sin(t * speed + (isOut ? -i : i) * 1.1)
      m.material.emissiveIntensity = 0.8 + wave * (0.9 + openAmt.current * 0.9)
      const halo = beaconHalos.current[i]
      if (halo) {
        const s = 0.24 + wave * 0.1 + openAmt.current * 0.12
        halo.scale.setScalar(s)
        halo.material.opacity = 0.18 + wave * 0.18
      }
    })
  })

  const pylonGeo = pylonAsset?.geometry || pylonFallbackGeo
  const podGeo = podAsset?.geometry || podFallbackGeo

  return (
    <group ref={grp} position={pos.clone().sub(node.pos)} quaternion={q}>
      {isOut ? (
        /* ── SALIDA: Lanzadera / Hangar con acabados metálicos clearcoat ── */
        <group>
          <mesh geometry={stBaseOut} receiveShadow castShadow>
            <meshPhysicalMaterial
              color="#2a3046"
              normalMap={tex.hullNormal}
              roughness={0.48}
              metalness={0.55}
              clearcoat={0.75}
              clearcoatRoughness={0.2}
            />
          </mesh>
          {/* Cuerpo del hangar */}
          <mesh geometry={stHullOut} castShadow receiveShadow>
            <meshPhysicalMaterial
              color="#3a4362"
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.42}
              roughness={0.38}
              metalness={0.52}
              clearcoat={0.85}
              clearcoatRoughness={0.16}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* 4 pilones/aletas radiales suaves (pylon.glb o fallback curvo) */}
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
              <mesh geometry={pylonGeo} position={[1.48, 0.12, 0]} scale={[1.1, 1.55, 0.95]} castShadow>
                <meshPhysicalMaterial
                  color="#485378"
                  normalMap={tex.hullNormal}
                  roughness={0.36}
                  metalness={0.6}
                  clearcoat={0.82}
                  clearcoatRoughness={0.18}
                />
              </mesh>
              <mesh
                ref={(el) => { beacons.current[i] = el }}
                geometry={stBeaconGeo}
                position={[1.48, 1.72, 0]}
              >
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
              </mesh>
              <mesh
                ref={(el) => { beaconHalos.current[i] = el }}
                geometry={haloSphereGeo}
                position={[1.48, 1.72, 0]}
                scale={0.28}
              >
                <meshBasicMaterial color={color} transparent opacity={0.26} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* Cornisa superior y aro de salida */}
          <mesh geometry={stCollarOut} position={[0, 1.86, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <meshPhysicalMaterial color="#58648c" normalMap={tex.hullNormal} roughness={0.3} metalness={0.72} clearcoat={0.9} clearcoatRoughness={0.12} />
          </mesh>
          <mesh geometry={stPortalOut} position={[0, 1.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial ref={portalMat} color={color} emissive={color} emissiveIntensity={1.55} toneMapped={false} />
          </mesh>
          {/* Compuerta doble biselada que se abre */}
          <mesh ref={doorL} geometry={stDoorLeaf} position={[-0.48, 1.8, 0]} castShadow>
            <meshPhysicalMaterial color="#23283b" normalMap={tex.hullNormal} roughness={0.32} metalness={0.75} clearcoat={0.85} clearcoatRoughness={0.15} />
          </mesh>
          <mesh ref={doorR} geometry={stDoorLeaf} position={[0.48, 1.8, 0]} castShadow>
            <meshPhysicalMaterial color="#23283b" normalMap={tex.hullNormal} roughness={0.32} metalness={0.75} clearcoat={0.85} clearcoatRoughness={0.15} />
          </mesh>
          {/* Torre de control (pod.glb o cápsula suave) + antena */}
          <mesh geometry={podGeo} position={[1.55, 0.14, 0.58]} scale={[0.75, 1.95, 0.75]} castShadow>
            <meshPhysicalMaterial
              color="#343d58"
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.48}
              roughness={0.38}
              metalness={0.48}
              clearcoat={0.8}
            />
          </mesh>
          <mesh geometry={cylSmooth} position={[1.55, 2.08, 0.58]} scale={[0.05, 0.78, 0.05]}>
            <meshStandardMaterial color="#a8b3d1" metalness={0.8} roughness={0.24} />
          </mesh>
          {/* Chimeneas de escape */}
          {[-0.45, 0.45].map((z) => (
            <mesh key={z} geometry={cylSmooth} position={[-1.58, 0.2, z]} scale={[0.24, 1.3, 0.24]} castShadow>
              <meshPhysicalMaterial color="#2c3144" normalMap={tex.hullNormal} roughness={0.42} metalness={0.6} clearcoat={0.6} />
            </mesh>
          ))}
        </group>
      ) : (
        /* ── ENTRADA: Estación receptora / Túnel con compuerta ── */
        <group>
          <mesh geometry={stBaseIn} receiveShadow castShadow>
            <meshPhysicalMaterial
              color="#23283a"
              normalMap={tex.hullNormal}
              roughness={0.5}
              metalness={0.5}
              clearcoat={0.7}
              clearcoatRoughness={0.22}
            />
          </mesh>
          {/* Búnker curvo suave */}
          <mesh geometry={stBunkerIn} castShadow receiveShadow>
            <meshPhysicalMaterial
              color="#303752"
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.32}
              roughness={0.42}
              metalness={0.48}
              clearcoat={0.82}
              clearcoatRoughness={0.18}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Garganta interior oscura del túnel */}
          <mesh geometry={stThroatIn}>
            <meshStandardMaterial color="#0d101b" roughness={0.9} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>
          {/* 3 pilones radiales de guía */}
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
              <mesh geometry={pylonGeo} position={[1.7, 0.12, 0]} rotation={[0, 0, 0.22]} scale={[1.0, 1.25, 1.0]} castShadow>
                <meshPhysicalMaterial
                  color="#3c4464"
                  normalMap={tex.hullNormal}
                  roughness={0.38}
                  metalness={0.56}
                  clearcoat={0.78}
                />
              </mesh>
              <mesh
                ref={(el) => { beacons.current[i] = el }}
                geometry={stBeaconGeo}
                position={[1.45, 1.38, 0]}
              >
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.15} toneMapped={false} />
              </mesh>
              <mesh
                ref={(el) => { beaconHalos.current[i] = el }}
                geometry={haloSphereGeo}
                position={[1.45, 1.38, 0]}
                scale={0.24}
              >
                <meshBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* Aro receptor */}
          <mesh geometry={stPortalIn} position={[0, 1.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial ref={portalMat} color={color} emissive={color} emissiveIntensity={1.05} toneMapped={false} />
          </mesh>
          {/* Compuerta doble biselada */}
          <mesh ref={doorL} geometry={stDoorLeaf} position={[-0.48, 1.22, 0]} castShadow>
            <meshPhysicalMaterial color="#1d2233" normalMap={tex.hullNormal} roughness={0.34} metalness={0.7} clearcoat={0.85} />
          </mesh>
          <mesh ref={doorR} geometry={stDoorLeaf} position={[0.48, 1.22, 0]} castShadow>
            <meshPhysicalMaterial color="#1d2233" normalMap={tex.hullNormal} roughness={0.34} metalness={0.7} clearcoat={0.85} />
          </mesh>
          {/* Ala de servicio (pod.glb o cápsula suave) con antena parabólica */}
          <mesh geometry={podGeo} position={[-1.65, 0.12, 0.45]} scale={[0.85, 0.98, 0.85]} castShadow>
            <meshPhysicalMaterial
              color="#2e354d"
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.38}
              roughness={0.44}
              metalness={0.42}
              clearcoat={0.75}
            />
          </mesh>
          <mesh geometry={stDishGeo} position={[-1.65, 1.24, 0.45]} rotation={[2.6, 0, -0.4]}>
            <meshPhysicalMaterial color="#96a3c7" metalness={0.75} roughness={0.25} clearcoat={0.8} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Planet({ node, world, tex, lampAsset, podAsset, pylonAsset }) {
  const geo = useMemo(() => planetGeo(node.color), [node])
  const city = useMemo(() => cityData(node), [node])
  const atmoOuterMat = useMemo(() => makeAtmoMaterial(node.color, { back: true }), [node.color])
  const atmoInnerMat = useMemo(() => makeAtmoMaterial(node.color, { back: false }), [node.color])

  const cloudsRef = useRef()
  const lampsRef = useRef()
  const detailRef = useRef()
  const normalScale = useMemo(() => new THREE.Vector2(0.32, 0.32), [])

  useFrame(({ camera }, dt) => {
    const dist = camera.position.distanceTo(node.pos)
    if (cloudsRef.current) {
      cloudsRef.current.visible = dist < 90
      if (cloudsRef.current.visible) cloudsRef.current.rotation.y += dt * 0.032
    }
    if (lampsRef.current) lampsRef.current.visible = dist < 68
    if (detailRef.current) detailRef.current.visible = dist < 120
  })

  const lampGeo = lampAsset?.geometry || lampFallbackGeo

  return (
    <group position={node.pos}>
      {/* Esfera del planeta de alta resolución con relieve y normal map suave */}
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial
          vertexColors
          normalMap={tex.planetNormal}
          normalScale={normalScale}
          roughness={0.82}
          metalness={0.08}
        />
      </mesh>

      {/* Nubes finas opcionales */}
      <mesh ref={cloudsRef} geometry={cloudsGeo} raycast={() => null}>
        <meshStandardMaterial
          map={tex.planetClouds}
          transparent
          opacity={0.24}
          depthWrite={false}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* Atmósfera con Fresnel y gradiente (no intercepta cursor) */}
      <mesh geometry={atmoOuterGeo} material={atmoOuterMat} raycast={() => null} />
      <mesh geometry={atmoInnerGeo} material={atmoInnerMat} raycast={() => null} />

      {/* Calles curvas continuas y líneas guía */}
      <mesh geometry={city.roadGeo} receiveShadow castShadow>
        <meshStandardMaterial map={tex.asphalt} normalMap={tex.asphaltNormal} roughness={0.72} metalness={0.14} />
      </mesh>
      <mesh geometry={city.lineGeo}>
        <meshStandardMaterial color="#2a3048" emissive={node.color} emissiveIntensity={0.42} roughness={0.4} />
      </mesh>

      {/* Detalles de ciudad con LOD */}
      <group ref={detailRef}>
        <Instanced geo={houseRoundedGeo} items={city.housesRounded} castShadow receiveShadow>
          <meshStandardMaterial
            ref={applyCityFade}
            map={tex.buildingAlbedo}
            normalMap={tex.buildingNormal}
            roughness={0.58}
            metalness={0.28}
            emissive="#ffffff"
            emissiveMap={tex.buildingEmissive}
            emissiveIntensity={0.54}
          />
        </Instanced>
        <Instanced geo={houseTowerGeo} items={city.housesTower} castShadow receiveShadow>
          <meshPhysicalMaterial
            ref={applyCityFade}
            map={tex.buildingAlbedo}
            normalMap={tex.buildingNormal}
            roughness={0.48}
            metalness={0.38}
            clearcoat={0.55}
            clearcoatRoughness={0.22}
            emissive="#ffffff"
            emissiveMap={tex.buildingEmissive}
            emissiveIntensity={0.58}
          />
        </Instanced>
        <Instanced geo={houseCapsuleGeo} items={city.housesCapsule} castShadow receiveShadow>
          <meshPhysicalMaterial
            ref={applyCityFade}
            map={tex.buildingAlbedo}
            normalMap={tex.buildingNormal}
            roughness={0.42}
            metalness={0.42}
            clearcoat={0.7}
            clearcoatRoughness={0.18}
            emissive="#ffffff"
            emissiveMap={tex.buildingEmissive}
            emissiveIntensity={0.5}
          />
        </Instanced>
      </group>

      {/* Luces de pista con halos suaves (LOD cercano) */}
      <group ref={lampsRef}>
        <Instanced geo={lampGeo} items={city.lamps}>
          <meshStandardMaterial
            ref={applyCityFade}
            color="#a5b2d4"
            roughness={0.35}
            metalness={0.65}
            emissive={node.color}
            emissiveIntensity={0.25}
          />
        </Instanced>
        <Instanced geo={haloSphereGeo} items={city.lampHalos}>
          <meshBasicMaterial
            color={node.color}
            transparent
            opacity={0.24}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </Instanced>
      </group>

      {node.destinos.map((d) => <Destino key={d.idx} d={d} base={node.pos} tex={tex} />)}
      {city.terminals.map((t, i) => (
        <Terminal
          key={`${t.kind}-${t.to}-${t.vert}-${i}`}
          node={node}
          term={t}
          color={world.nodes[t.to].color}
          tex={tex}
          podAsset={podAsset}
          pylonAsset={pylonAsset}
        />
      ))}
      <WorldHtml center position={[0, NODE_R + 3.5, 0]} distanceFactor={20} zIndexRange={[5, 0]}>
        <div className="tag node" style={{ borderColor: node.color }}>{node.name}</div>
      </WorldHtml>
    </group>
  )
}

export default function Nodes({ world }) {
  const tex = useMemo(getTextures, [])
  const lampAsset = useGlbAsset('lamp')
  const podAsset = useGlbAsset('pod')
  const pylonAsset = useGlbAsset('pylon')
  return world.nodes.map((n) => (
    <Planet
      key={n.idx}
      node={n}
      world={world}
      tex={tex}
      lampAsset={lampAsset}
      podAsset={podAsset}
      pylonAsset={pylonAsset}
    />
  ))
}
