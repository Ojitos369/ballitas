import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { NODE_R, BALL_R, SPHERE_R, mulberry32 } from '../../Core/world.js'
import WorldHtml from './WorldHtml.jsx'
import { applyLoadedImage } from './texUtils.js'
import { withCameraFade } from './Paths.jsx'
import { resolveNodeBiome, buildCityDistricts } from './mundos/biomas.js'
import { buildFarSkylineGeo } from './mundos/arquitectura.js'
import { pickMonumentSpot, Monument } from './mundos/monumentos.jsx'
import {
  resolvePlanetConfig,
  createPlanetCartoonMaterial,
  createPlanetCloudMaterial,
  createPlanetRingMaterial,
  createPlanetMoonMaterial,
  getPlanetUnitSphereGeo,
  getPlanetUnitSphereLowGeo,
  getPlanetRingGeo,
  getPlanetOutlineMaterial,
} from './mundos/planetaCartoon.js'
import { registerWorldForVistas, focusWorldNode, escalaMapa } from './Vistas.jsx'

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

const U = BALL_R * 2 // unidad de la ciudad: una ballita de ancho
const LOD_NEAR = Math.max(95, NODE_R * 7.5)
const LOD_CLOUDS = Math.max(260, SPHERE_R * 2.9)
const LOD_ORBITALS = Math.max(240, SPHERE_R * 2.65)
const UP = new THREE.Vector3(0, 1, 0)
const GOLD = '#ffd54a'
const GREEN = '#5dffb0'

const txt = (n) => (n > 0 ? '+' : '−') + Math.abs(n)

// Actividad reciente por terminal (`${nodeIdx}:${vertIdx}:${kind}` -> { power, at })
// La actualiza Ballita.jsx en useFrame sin provocar renders de React.
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
  // Fachada luminosa procedural para los edificios GLB (no oscurece los vertex colors)
  const buildingFacade = makeProceduralTex(
    '__building_facade_proc',
    512,
    (g, s) => {
      g.fillStyle = '#f2f5fc'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(11)
      for (let y = 0; y < s; y += 16) {
        g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(40,54,88,0.06)'
        g.fillRect(0, y, s, 14)
        g.fillStyle = 'rgba(40,52,82,0.12)'
        g.fillRect(0, y + 14, s, 2)
      }
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgba(40,52,82,0.08)'
        g.fillRect(x, 0, 2, s)
      }
    },
    { srgb: true },
  )

  const buildingAlbedo = loadTexWithFallback(
    'building_albedo.png',
    () => makeCanvas(512, (g, s) => {
      g.fillStyle = '#dfe5f2'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(11)
      for (let y = 0; y < s; y += 16) {
        g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(20,28,48,0.07)'
        g.fillRect(0, y, s, 14)
        g.fillStyle = 'rgba(24,30,48,0.14)'
        g.fillRect(0, y + 14, s, 2)
      }
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgba(24,30,48,0.09)'
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

  // Nubes finas procedurales con transparencia suave (alta resolución y volutas suaves)
  const planetClouds = makeProceduralTex(
    '__planet_clouds_proc',
    512,
    (g, s) => {
      const img = g.createImageData(s, s)
      const d = img.data
      for (let y = 0; y < s; y++) {
        const v = y / s
        const latFade = Math.pow(Math.sin(v * Math.PI), 0.75)
        for (let x = 0; x < s; x++) {
          const u = x / s
          const n1 = tileNoise2D(u * 1.5, v * 1.5) * 0.5 + 0.5
          const n2 = tileNoise2D(u * 3.0 + 0.37, v * 3.0 - 0.21) * 0.5 + 0.5
          const n = n1 * 0.68 + n2 * 0.32
          const a = THREE.MathUtils.smoothstep(n, 0.48, 0.86) * latFade
          const idx = (y * s + x) * 4
          d[idx] = 240
          d[idx + 1] = 247
          d[idx + 2] = 255
          d[idx + 3] = Math.round(a * 165)
        }
      }
      g.putImageData(img, 0, 0)
    },
    { srgb: true, repeatX: 2, repeatY: 1 },
  )

  // Luces de ciudad en cuadrícula para lectura lejana (LOD lejano)
  const cityGridEmissive = makeProceduralTex(
    '__city_grid_emissive',
    512,
    (g, s) => {
      g.fillStyle = '#000000'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(77)
      // Red de manzanas y avenidas iluminadas
      g.strokeStyle = 'rgba(255,255,255,0.28)'
      g.lineWidth = 2
      for (let i = 0; i < s; i += 32) {
        g.beginPath(); g.moveTo(i, 0); g.lineTo(i, s); g.stroke()
        g.beginPath(); g.moveTo(0, i); g.lineTo(s, i); g.stroke()
      }
      for (let y = 4; y < s; y += 16) {
        for (let x = 4; x < s; x += 16) {
          if (rng() < 0.58) {
            const b = 0.35 + rng() * 0.65
            g.fillStyle = `rgba(255,255,255,${b.toFixed(2)})`
            g.fillRect(x, y, 4 + (rng() * 5 | 0), 3 + (rng() * 4 | 0))
          }
        }
      }
    },
    { srgb: true, repeatX: 4, repeatY: 2 },
  )

  return {
    buildingAlbedo,
    buildingFacade,
    buildingNormal,
    buildingEmissive,
    hullNormal,
    asphalt,
    asphaltNormal,
    planetNormal,
    planetClouds,
    cityGridEmissive,
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
const houseRoundedGeo = makeRoundedBoxGeo(1, 1, 1, 0.13, 1)
const houseTowerGeo = makeLatheGeo([
  [0.5, 0],
  [0.52, 0.06],
  [0.46, 0.16],
  [0.42, 0.55],
  [0.34, 0.82],
  [0.24, 0.94],
  [0.12, 0.99],
  [0.001, 1.0],
], 12)
const houseCapsuleGeo = makeLatheGeo([
  [0.48, 0],
  [0.5, 0.08],
  [0.49, 0.58],
  [0.44, 0.78],
  [0.32, 0.92],
  [0.16, 0.985],
  [0.001, 1.0],
], 12)

// Primitivas suaves compartidas
const cylSmooth = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0)
const roundedUnit = makeRoundedBoxGeo(1, 1, 1, 0.12, 2)
const domeGeo = new THREE.SphereGeometry(0.64, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2)
const padGeo = makeLatheGeo([
  [0.001, 0],
  [1.04, 0],
  [1.02, 0.05],
  [0.94, 0.11],
  [0.86, 0.12],
  [0.001, 0.12],
], 16)
const basinGeo = makeLatheGeo([
  [0.001, 0],
  [0.96, 0],
  [0.98, 0.14],
  [0.92, 0.34],
  [0.84, 0.36],
  [0.74, 0.24],
  [0.001, 0.24],
], 16)
const poolGeo = new THREE.CylinderGeometry(0.76, 0.72, 0.08, 16).translate(0, 0.28, 0)

// Destinos suaves por estilo
const tentCanopyGeo = makeLatheGeo([
  [0.001, 0.85],
  [0.18, 0.72],
  [0.48, 0.42],
  [0.82, 0.12],
  [0.92, 0.0],
  [0.85, -0.02],
  [0.001, 0.45],
], 16)
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
], 16)
const domeRingGeo = new THREE.TorusGeometry(0.66, 0.07, 8, 20)
const goldIconGeo = makeLatheGeo([
  [0.001, -0.32],
  [0.18, -0.14],
  [0.28, 0.0],
  [0.18, 0.16],
  [0.001, 0.34],
], 12)
const greenIconGeo = new THREE.SphereGeometry(0.25, 12, 10)
const iconHaloRingGeo = new THREE.TorusGeometry(0.36, 0.022, 6, 18)

const haloSphereGeo = new THREE.SphereGeometry(1, 10, 8)

// Geometrías suaves de estaciones terminales
const stBaseOut = makeLatheGeo([
  [0.001, 0],
  [2.05, 0],
  [2.02, 0.12],
  [1.82, 0.36],
  [1.72, 0.42],
  [0.001, 0.42],
], 20)
const stHullOut = makeLatheGeo([
  [1.52, 0.36],
  [1.48, 0.65],
  [1.36, 1.25],
  [1.26, 1.75],
  [1.28, 1.88],
], 20)
const stCollarOut = new THREE.TorusGeometry(1.28, 0.12, 8, 20)
const stPortalOut = new THREE.TorusGeometry(1.33, 0.085, 8, 22)
const stDoorLeaf = makeRoundedBoxGeo(0.95, 0.11, 1.75, 0.04, 2).translate(0, -0.055, 0)

const stBaseIn = makeLatheGeo([
  [0.001, 0],
  [2.28, 0],
  [2.22, 0.14],
  [2.05, 0.36],
  [1.96, 0.4],
  [0.001, 0.4],
], 20)
const stBunkerIn = makeLatheGeo([
  [1.88, 0.34],
  [1.76, 0.65],
  [1.54, 1.02],
  [1.36, 1.28],
  [1.26, 1.35],
], 20)
const stThroatIn = new THREE.CylinderGeometry(1.18, 1.18, 0.95, 18, 1, true).translate(0, 0.72, 0)
const stPortalIn = new THREE.TorusGeometry(1.34, 0.068, 8, 22)
const stBeaconGeo = new THREE.SphereGeometry(0.11, 10, 8)
const stDishGeo = new THREE.SphereGeometry(0.42, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.38)
const pylonFallbackGeo = makeLatheGeo([
  [0.24, 0],
  [0.22, 0.12],
  [0.16, 0.55],
  [0.11, 0.9],
  [0.05, 0.98],
  [0.001, 1.0],
], 10)
const podFallbackGeo = makeLatheGeo([
  [0.001, 0],
  [0.44, 0.06],
  [0.48, 0.35],
  [0.42, 0.72],
  [0.26, 0.93],
  [0.001, 1.0],
], 12)

// ───────────────────────── Shader de Atmósfera con Fresnel y Gradiente ─────────────────────────
function makeAtmoMaterial(color, { back = true, rimColor = '#d8f0ff', power, intensity } = {}) {
  const base = new THREE.Color(color)
  const rim = base.clone().lerp(new THREE.Color(rimColor), 0.55)
  const defaultPower = back ? 3.2 : 2.6
  const defaultIntensity = back ? 0.55 : 0.28
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: base },
      uRimColor: { value: rim },
      uPower: { value: power ?? defaultPower },
      uIntensity: { value: back ? (intensity ?? defaultIntensity) : Math.min(0.42, (intensity ?? defaultIntensity) * 0.55) },
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

// ───────────────────────── Calles continuas curvas sobre la esfera ─────────────────────────
function buildRoadGeometries(node, centroDir = null, surfaceR = NODE_R) {
  const local = (p) => p.clone().sub(node.pos)
  const surfScale = surfaceR / 7.5
  const roadW = Math.max(U * 0.55, surfaceR * 0.036)
  const roadH = Math.max(0.035, surfaceR * 0.0045)
  const rPos = []
  const rUv = []
  const rIdx = []
  const lPos = []
  const lUv = []
  const lIdx = []

  const tmpDir = new THREE.Vector3()
  const tmpTan = new THREE.Vector3()
  const tmpSide = new THREE.Vector3()
  const tmpPrev = new THREE.Vector3()
  const tmpNext = new THREE.Vector3()
  const tmpPt = new THREE.Vector3()

  const addRibbon = (samples, width, height) => {
    const hw = width * 0.5
    const profile = [
      [-hw * 1.15, -0.02, 0.0],
      [-hw * 0.96, height * 0.72, 0.09],
      [-hw * 0.80, height, 0.18],
      [hw * 0.80, height, 0.82],
      [hw * 0.96, height * 0.72, 0.91],
      [hw * 1.15, -0.02, 1.0],
    ]
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

      const vCoord = arcLen * (0.42 / Math.pow(surfScale, 0.25))
      for (let k = 0; k < profile.length; k++) {
        const [offX, offY, uCoord] = profile[k]
        tmpPt.copy(tmpDir).multiplyScalar(surfaceR + offY).addScaledVector(tmpSide, offX)
        rPos.push(tmpPt.x, tmpPt.y, tmpPt.z)
        rUv.push(uCoord, vCoord)
      }

      // Cinta central emisiva
      const lh = height + 0.009
      const lw = Math.max(0.036, width * 0.048)
      tmpPt.copy(tmpDir).multiplyScalar(surfaceR + lh).addScaledVector(tmpSide, -lw)
      lPos.push(tmpPt.x, tmpPt.y, tmpPt.z)
      lUv.push(0, vCoord)
      tmpPt.copy(tmpDir).multiplyScalar(surfaceR + lh).addScaledVector(tmpSide, lw)
      lPos.push(tmpPt.x, tmpPt.y, tmpPt.z)
      lUv.push(1, vCoord)
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

  for (const r of node.roads) {
    if (!r.points || r.points.length < 2) continue
    const pts = r.points.map(local)
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5)
    const steps = Math.max(pts.length * 4, Math.round(18 * Math.pow(surfScale, 0.35)))
    const samples = []
    for (let i = 0; i <= steps; i++) {
      const p = curve.getPoint(i / steps)
      p.normalize().multiplyScalar(surfaceR)
      samples.push(p)
    }
    addRibbon(samples, roadW, roadH)
  }

  // Bulevar circular alrededor del distrito centro
  if (centroDir) {
    const cDir = centroDir.clone().normalize()
    const ref = Math.abs(cDir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : UP
    const bu = new THREE.Vector3().crossVectors(ref, cDir).normalize()
    const bv = new THREE.Vector3().crossVectors(cDir, bu).normalize()
    const ringAng = 0.28
    const sinA = Math.sin(ringAng)
    const cosA = Math.cos(ringAng)
    const segs = Math.max(32, Math.round(32 * Math.pow(surfScale, 0.35)))
    const ringSamples = []
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      const pt = cDir.clone().multiplyScalar(cosA)
        .addScaledVector(bu, Math.cos(a) * sinA)
        .addScaledVector(bv, Math.sin(a) * sinA)
        .multiplyScalar(surfaceR)
      ringSamples.push(pt)
    }
    addRibbon(ringSamples, roadW * 0.72, roadH * 0.78)
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

  return { roadGeo, lineGeo }
}

// Ciudad exterior reducida a luces y siluetas pequeñas alrededor de centro y puertos (la ciudad completa vive en vista de superficie).
function cityData(node, biome, surfaceR = NODE_R) {
  const rng = mulberry32(1000 + node.idx)
  const surfScale = surfaceR / 7.5
  const cityU = U * surfScale
  const m4 = (x, y, z, pos) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos)

  const terminals = getTerminals(node)
  const roadClear = Math.max(1.2, surfaceR * 0.08)
  const near = node.roads.flatMap((r) => r.points).map((p) => {
    const dir = p.clone().sub(node.pos).normalize()
    return [dir.multiplyScalar(surfaceR).add(node.pos), roadClear]
  })
  const vClear = Math.max(1.6, surfaceR * 0.14)
  const dClear = 1.9 * surfScale
  const tClear = 2.6 * surfScale
  node.verts.forEach((v) => near.push([v.dir.clone().multiplyScalar(surfaceR).add(node.pos), vClear]))
  node.destinos.forEach((d) => near.push([d.dir.clone().multiplyScalar(surfaceR).add(node.pos), dClear]))
  terminals.forEach((t) => {
    const dir = t.dir || node.verts[t.vert].dir
    near.push([dir.clone().multiplyScalar(surfaceR).add(node.pos), tClear])
  })

  const monumentSpot = pickMonumentSpot(node, near, surfaceR)
  near.push([monumentSpot.pos.clone().add(node.pos), 2.3 * surfScale])

  const districts = buildCityDistricts(node, monumentSpot, terminals)
  const { roadGeo, lineGeo } = buildRoadGeometries(node, districts.centroDir, surfaceR)

  const palette = (biome?.buildingColors || [node.color]).map((hex) => new THREE.Color(hex))
  const col = new THREE.Color()
  const hsl = {}
  const skylineCandidates = []
  const cityLights = []

  const vU = new THREE.Vector3()
  const vX = new THREE.Vector3()
  const vZ = new THREE.Vector3()
  const rot = rng() * Math.PI * 2
  const N = 260

  for (let i = 0; i < N; i++) {
    const yy = 1 - (2 * (i + 0.5)) / N
    const rr = Math.sqrt(1 - yy * yy)
    const ang = i * Math.PI * (3 - Math.sqrt(5)) + rot
    const dir = new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr)
    const pos = dir.clone().multiplyScalar(surfaceR)
    const world = pos.clone().add(node.pos)
    if (near.some(([p, m]) => p.distanceToSquared(world) < m * m)) continue

    const dist = districts.classify(dir)
    if (dist.kind !== 'centro' && dist.kind !== 'puerto' && rng() > 0.22) continue

    vU.crossVectors(Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP, dir).normalize()
    const yaw = rng() * Math.PI * 2
    vX.copy(vU).multiplyScalar(Math.cos(yaw)).addScaledVector(vZ.crossVectors(dir, vU), Math.sin(yaw)).normalize()
    vZ.crossVectors(vX, dir).normalize()

    if (skylineCandidates.length < 72 && (dist.kind === 'centro' || dist.kind === 'puerto')) {
      const h = cityU * (dist.kind === 'centro' ? (0.65 + rng() * 1.15) : (0.42 + rng() * 0.72))
      const w = cityU * (0.48 + rng() * 0.34)
      const baseCol = palette[Math.floor(rng() * palette.length)]
      baseCol.getHSL(hsl)
      const c = col.setHSL(
        hsl.h + (rng() - 0.5) * 0.04,
        THREE.MathUtils.clamp(hsl.s, 0.15, 0.9),
        THREE.MathUtils.clamp(hsl.l + (rng() - 0.5) * 0.1, 0.45, 0.88),
      ).clone()
      const m = m4(
        vX.clone().multiplyScalar(w),
        dir.clone().multiplyScalar(h),
        vZ.clone().multiplyScalar(w),
        pos.clone().addScaledVector(dir, -0.02 * surfScale),
      )
      skylineCandidates.push({ m, c, h })
    } else if (cityLights.length < 110) {
      const ls = (0.11 + rng() * 0.11) * surfScale
      const m = m4(
        vX.clone().multiplyScalar(ls),
        dir.clone().multiplyScalar(ls * 0.65),
        vZ.clone().multiplyScalar(ls),
        pos.clone().addScaledVector(dir, ls * 0.35),
      )
      cityLights.push(m)
    }
  }

  skylineCandidates.sort((a, b) => b.h - a.h)
  const farSkylineGeo = buildFarSkylineGeo(skylineCandidates.slice(0, 64))

  return { roadGeo, lineGeo, farSkylineGeo, cityLights, districts, terminals, monumentSpot }
}

function Instanced({ geo, material, items, children, ...rest }) {
  const ref = useRef()
  const initGeoRef = useRef(geo)
  const initMatRef = useRef(material ?? null)
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    if (geo && o.geometry !== geo) o.geometry = geo
    if (material && o.material !== material) o.material = material
    items.forEach((it, i) => {
      o.setMatrixAt(i, it.m ?? it)
      if (it.c) o.setColorAt(i, it.c)
    })
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere()
    o.computeBoundingSphere?.()
  }, [geo, material, items])
  if (!items.length) return null
  return (
    <instancedMesh key={items.length} ref={ref} args={[initGeoRef.current, initMatRef.current, items.length]} {...rest}>
      {children}
    </instancedMesh>
  )
}

// Caché compartida de materiales para Destinos y Terminales (evita cientos de shaders duplicados)
const nodeMatCache = new Map()
function getCachedMat(key, factory) {
  let m = nodeMatCache.get(key)
  if (!m) {
    m = factory()
    applyCityFade(m)
    nodeMatCache.set(key, m)
  }
  return m
}

function getSharedTerminalMats(tex) {
  return {
    baseOut: getCachedMat('stBaseOut', () => new THREE.MeshStandardMaterial({ color: '#2a3046', normalMap: tex.hullNormal, roughness: 0.45, metalness: 0.55 })),
    hullOut: getCachedMat('stHullOut', () => new THREE.MeshStandardMaterial({ color: '#3a4362', map: tex.buildingAlbedo, normalMap: tex.buildingNormal, emissive: '#ffffff', emissiveMap: tex.buildingEmissive, emissiveIntensity: 0.42, roughness: 0.38, metalness: 0.5, side: THREE.DoubleSide })),
    pylonOut: getCachedMat('stPylonOut', () => new THREE.MeshStandardMaterial({ color: '#485378', normalMap: tex.hullNormal, roughness: 0.36, metalness: 0.6 })),
    collarOut: getCachedMat('stCollarOut', () => new THREE.MeshStandardMaterial({ color: '#58648c', normalMap: tex.hullNormal, roughness: 0.3, metalness: 0.7 })),
    doorOut: getCachedMat('stDoorOut', () => new THREE.MeshStandardMaterial({ color: '#23283b', normalMap: tex.hullNormal, roughness: 0.34, metalness: 0.72 })),
    podOut: getCachedMat('stPodOut', () => new THREE.MeshStandardMaterial({ color: '#343d58', emissive: '#ffffff', emissiveMap: tex.buildingEmissive, emissiveIntensity: 0.48, roughness: 0.38, metalness: 0.48 })),
    ant: getCachedMat('stAnt', () => new THREE.MeshStandardMaterial({ color: '#a8b3d1', metalness: 0.8, roughness: 0.24 })),
    chimney: getCachedMat('stChimney', () => new THREE.MeshStandardMaterial({ color: '#2c3144', normalMap: tex.hullNormal, roughness: 0.42, metalness: 0.6 })),
    baseIn: getCachedMat('stBaseIn', () => new THREE.MeshStandardMaterial({ color: '#23283a', normalMap: tex.hullNormal, roughness: 0.48, metalness: 0.5 })),
    bunkerIn: getCachedMat('stBunkerIn', () => new THREE.MeshStandardMaterial({ color: '#303752', map: tex.buildingAlbedo, normalMap: tex.buildingNormal, emissive: '#ffffff', emissiveMap: tex.buildingEmissive, emissiveIntensity: 0.32, roughness: 0.42, metalness: 0.48, side: THREE.DoubleSide })),
    throatIn: getCachedMat('stThroatIn', () => new THREE.MeshStandardMaterial({ color: '#0d101b', roughness: 0.9, metalness: 0.2, side: THREE.DoubleSide })),
    pylonIn: getCachedMat('stPylonIn', () => new THREE.MeshStandardMaterial({ color: '#3c4464', normalMap: tex.hullNormal, roughness: 0.38, metalness: 0.56 })),
    doorIn: getCachedMat('stDoorIn', () => new THREE.MeshStandardMaterial({ color: '#1d2233', normalMap: tex.hullNormal, roughness: 0.34, metalness: 0.7 })),
    podIn: getCachedMat('stPodIn', () => new THREE.MeshStandardMaterial({ color: '#2e354d', emissive: '#ffffff', emissiveMap: tex.buildingEmissive, emissiveIntensity: 0.38, roughness: 0.44, metalness: 0.42 })),
    dish: getCachedMat('stDish', () => new THREE.MeshStandardMaterial({ color: '#96a3c7', metalness: 0.75, roughness: 0.25, side: THREE.DoubleSide })),
  }
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

function Destino({ d, tex, animRegRef, surfaceR = NODE_R }) {
  const grp = useRef()
  const detailGrp = useRef()
  const icon = useRef()
  const hoverRef = useRef(false)
  useCityFade(grp)
  const [hover, setHover] = useState(false)
  hoverRef.current = hover
  const gain = d.kind === 'puntos'
  const color = gain ? GOLD : GREEN
  const bodyColor = gain ? '#7a5e18' : '#1e5b43'
  const roofColor = gain ? '#b98924' : '#2e8864'
  const style = destinoStyle(d.name, d.kind)
  const baseY = style === 'torre' ? 2.5 : 2.1
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, d.dir), [d])
  const relPos = useMemo(() => d.dir.clone().multiplyScalar(surfaceR), [d, surfaceR])
  const destScale = useMemo(() => (surfaceR / 7.5) * 0.78, [surfaceR])
  const mats = useMemo(() => ({
    pad: getCachedMat(`dPad:${color}`, () => new THREE.MeshStandardMaterial({ color: '#2a2f44', normalMap: tex.hullNormal, roughness: 0.55, metalness: 0.42, emissive: color, emissiveIntensity: 0.14 })),
    icon: getCachedMat(`dIcon:${color}`, () => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.65, toneMapped: false })),
    halo: getCachedMat(`dHalo:${color}`, () => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })),
    body: getCachedMat(`dBody:${bodyColor}`, () => new THREE.MeshStandardMaterial({ color: bodyColor, map: tex.buildingAlbedo, normalMap: tex.buildingNormal, emissive: '#ffffff', emissiveMap: tex.buildingEmissive, emissiveIntensity: 0.42, roughness: 0.52, metalness: 0.35 })),
    roof: getCachedMat(`dRoof:${roofColor}:${color}`, () => new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.42, metalness: 0.35, emissive: color, emissiveIntensity: 0.18, side: THREE.DoubleSide })),
    pole: getCachedMat('dPole', () => new THREE.MeshStandardMaterial({ color: '#cfd5e6', roughness: 0.35, metalness: 0.55 })),
    wood: getCachedMat('dWood', () => new THREE.MeshStandardMaterial({ color: '#73513a', roughness: 0.72 })),
    rim: getCachedMat('dRim', () => new THREE.MeshStandardMaterial({ color: '#8fa0cc', roughness: 0.3, metalness: 0.7 })),
    annex: getCachedMat('dAnnex', () => new THREE.MeshStandardMaterial({ color: '#464e6e', emissive: '#ffffff', emissiveMap: tex.buildingEmissive, emissiveIntensity: 0.38, roughness: 0.5 })),
    pool: getCachedMat(`dPool:${d.name === 'Hoguera' ? 'fire' : color}`, () => new THREE.MeshStandardMaterial({ color: d.name === 'Hoguera' ? '#ff8243' : '#4be3c4', emissive: d.name === 'Hoguera' ? '#ff6a2b' : color, emissiveIntensity: 0.68, roughness: 0.18 })),
    canopy: getCachedMat('dCanopy', () => new THREE.MeshStandardMaterial({ color: '#3c7d63', roughness: 0.6, side: THREE.DoubleSide })),
  }), [color, bodyColor, roofColor, tex, d.name])

  useLayoutEffect(() => {
    if (!animRegRef?.current) return undefined
    const list = animRegRef.current.destinos
    const entry = { detailGrp, icon, baseY, idx: d.idx, hoverRef }
    list.push(entry)
    return () => {
      const i = list.indexOf(entry)
      if (i >= 0) list.splice(i, 1)
    }
  }, [animRegRef, baseY, d.idx])

  return (
    <group
      ref={grp}
      position={relPos}
      quaternion={q}
      scale={destScale}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      <group ref={detailGrp}>
        {/* Basamento circular: solo de cerca; de lejos parecía una losa plana pegada al planeta */}
        <mesh geometry={padGeo} material={mats.pad} receiveShadow />
        {style === 'carpa' && (
          <group position={[0, 0.1, 0]}>
            {[-0.45, 0.45].map((px) => [-0.45, 0.45].map((pz) => (
              <mesh key={`${px}${pz}`} geometry={cylSmooth} material={mats.pole} position={[px, 0, pz]} scale={[0.08, 0.72, 0.08]} />
            )))}
            <mesh geometry={roundedUnit} material={mats.body} position={[0, 0, 0]} scale={[0.72, 0.36, 0.52]} />
            <mesh geometry={tentCanopyGeo} material={mats.roof} position={[0, 0.68, 0]} scale={[1.05, 0.92, 1.05]} />
          </group>
        )}

        {style === 'torre' && (
          <group position={[0, 0.1, 0]}>
            <mesh geometry={towerBodyGeo} material={mats.body} scale={[0.92, 0.98, 0.92]} />
            <mesh geometry={domeRingGeo} material={mats.roof} position={[0, 1.32, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[0.65, 0.65, 0.65]} />
          </group>
        )}

        {style === 'domo' && (
          <group position={[0, 0.1, 0]}>
            <mesh geometry={cylSmooth} material={mats.pad} scale={[1.38, 0.34, 1.38]} />
            <mesh geometry={domeGeo} material={mats.body} position={[0, 0.32, 0]} scale={[1.04, 1.04, 1.04]} />
            <mesh geometry={domeRingGeo} material={mats.rim} position={[0, 0.34, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh geometry={roundedUnit} material={mats.annex} position={[0, 0, 0.62]} scale={[0.56, 0.48, 0.42]} />
          </group>
        )}

        {style === 'fuente' && (
          <group position={[0, 0.1, 0]}>
            <mesh geometry={basinGeo} material={mats.pad} receiveShadow />
            <mesh geometry={poolGeo} material={mats.pool} />
            <mesh geometry={cylSmooth} material={mats.rim} position={[0, 0.25, 0]} scale={[0.24, 0.76, 0.24]} />
            <mesh geometry={domeGeo} material={mats.icon} position={[0, 0.96, 0]} scale={[0.28, 0.24, 0.28]} />
          </group>
        )}

        {style === 'hamaca' && (
          <group position={[0, 0.1, 0]}>
            <mesh geometry={cylSmooth} material={mats.wood} position={[-0.52, 0, 0]} rotation={[0, 0, 0.2]} scale={[0.1, 0.95, 0.1]} />
            <mesh geometry={cylSmooth} material={mats.wood} position={[0.52, 0, 0]} rotation={[0, 0, -0.2]} scale={[0.1, 0.95, 0.1]} />
            <mesh geometry={roundedUnit} material={mats.roof} position={[0, 0.55, 0]} scale={[0.92, 0.1, 0.48]} />
            <mesh geometry={tentCanopyGeo} material={mats.canopy} position={[0, 0.92, 0]} scale={[0.82, 0.48, 0.65]} />
          </group>
        )}

        {style === 'pabellon' && (
          <group position={[0, 0.1, 0]}>
            <mesh geometry={roundedUnit} material={mats.body} scale={[1.15, 0.85, 0.95]} />
            <mesh geometry={roundedUnit} material={mats.roof} position={[0, 0.84, 0]} scale={[1.28, 0.18, 1.08]} />
            <mesh geometry={cylSmooth} material={mats.rim} position={[0.38, 1.0, -0.25]} scale={[0.05, 0.45, 0.05]} />
          </group>
        )}
      </group>

      {/* Icono flotante suave + halo (siempre visible como hito del destino) */}
      <group ref={icon} position={[0, style === 'torre' ? 2.5 : 2.1, 0]}>
        <mesh geometry={gain ? goldIconGeo : greenIconGeo} material={mats.icon} scale={hover ? 1.38 : 1} />
        <mesh geometry={iconHaloRingGeo} material={mats.halo} rotation={[Math.PI / 2, 0, 0]} scale={hover ? 1.38 : 1} />
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
function Terminal({ node, term, color, tex, animRegRef, surfaceR = NODE_R }) {
  const dir = term.dir || node.verts[term.vert].dir
  const isOut = term.kind === 'out'
  const key = `${node.idx}:${term.vert}:${term.kind}`
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir])
  const relPos = useMemo(() => dir.clone().multiplyScalar(surfaceR), [dir, surfaceR])
  const termScale = useMemo(() => surfaceR / 7.5, [surfaceR])
  const tmats = useMemo(() => getSharedTerminalMats(tex), [tex])
  const portalMatObj = useMemo(() => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: isOut ? 1.55 : 1.05, toneMapped: false,
  }), [color, isOut])
  const beaconMatObj = useMemo(() => getCachedMat(`stBeacon:${color}`, () => new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: 1.3, toneMapped: false,
  })), [color])
  const haloMatObj = useMemo(() => getCachedMat(`stHalo:${color}`, () => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })), [color])
  useEffect(() => () => portalMatObj.dispose(), [portalMatObj])

  const grp = useRef()
  const microRef = useRef()
  const doorL = useRef()
  const doorR = useRef()
  const beacons = useRef([])
  const beaconHalos = useRef([])
  const openAmt = useRef(0)
  useCityFade(grp)

  useLayoutEffect(() => {
    if (!animRegRef?.current) return undefined
    const list = animRegRef.current.terminals
    const entry = { key, isOut, microRef, doorL, doorR, beacons, beaconHalos, portalMatObj, openAmt }
    list.push(entry)
    return () => {
      const i = list.indexOf(entry)
      if (i >= 0) list.splice(i, 1)
    }
  }, [animRegRef, key, isOut, portalMatObj])

  const pylonGeo = pylonFallbackGeo
  const podGeo = podFallbackGeo

  return (
    <group ref={grp} position={relPos} quaternion={q} scale={termScale}>
      {isOut ? (
        <group>
          <mesh geometry={stHullOut} material={tmats.hullOut} receiveShadow />
          <mesh geometry={stPortalOut} material={portalMatObj} position={[0, 1.98, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <group ref={microRef}>
            <mesh geometry={stBaseOut} material={tmats.baseOut} receiveShadow />
            {[0, 1, 2, 3].map((i) => (
              <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
                <mesh geometry={pylonGeo} material={tmats.pylonOut} position={[1.48, 0.12, 0]} scale={[1.1, 1.55, 0.95]} />
                <mesh ref={(el) => { beacons.current[i] = el }} geometry={stBeaconGeo} material={beaconMatObj} position={[1.48, 1.72, 0]} />
                <mesh ref={(el) => { beaconHalos.current[i] = el }} geometry={haloSphereGeo} material={haloMatObj} position={[1.48, 1.72, 0]} scale={0.28} />
              </group>
            ))}
            <mesh geometry={stCollarOut} material={tmats.collarOut} position={[0, 1.86, 0]} rotation={[Math.PI / 2, 0, 0]} />
            <mesh ref={doorL} geometry={stDoorLeaf} material={tmats.doorOut} position={[-0.48, 1.8, 0]} />
            <mesh ref={doorR} geometry={stDoorLeaf} material={tmats.doorOut} position={[0.48, 1.8, 0]} />
            <mesh geometry={podGeo} material={tmats.podOut} position={[1.55, 0.14, 0.58]} scale={[0.75, 1.95, 0.75]} />
            <mesh geometry={cylSmooth} material={tmats.ant} position={[1.55, 2.08, 0.58]} scale={[0.05, 0.78, 0.05]} />
            {[-0.45, 0.45].map((z) => (
              <mesh key={z} geometry={cylSmooth} material={tmats.chimney} position={[-1.58, 0.2, z]} scale={[0.24, 1.3, 0.24]} />
            ))}
          </group>
        </group>
      ) : (
        <group>
          <mesh geometry={stBunkerIn} material={tmats.bunkerIn} receiveShadow />
          <mesh geometry={stPortalIn} material={portalMatObj} position={[0, 1.34, 0]} rotation={[Math.PI / 2, 0, 0]} />
          <group ref={microRef}>
            <mesh geometry={stBaseIn} material={tmats.baseIn} receiveShadow />
            <mesh geometry={stThroatIn} material={tmats.throatIn} />
            {[0, 1, 2].map((i) => (
              <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
                <mesh geometry={pylonGeo} material={tmats.pylonIn} position={[1.7, 0.12, 0]} rotation={[0, 0, 0.22]} scale={[1.0, 1.25, 1.0]} />
                <mesh ref={(el) => { beacons.current[i] = el }} geometry={stBeaconGeo} material={beaconMatObj} position={[1.45, 1.38, 0]} />
                <mesh ref={(el) => { beaconHalos.current[i] = el }} geometry={haloSphereGeo} material={haloMatObj} position={[1.45, 1.38, 0]} scale={0.24} />
              </group>
            ))}
            <mesh ref={doorL} geometry={stDoorLeaf} material={tmats.doorIn} position={[-0.48, 1.22, 0]} />
            <mesh ref={doorR} geometry={stDoorLeaf} material={tmats.doorIn} position={[0.48, 1.22, 0]} />
            <mesh geometry={podGeo} material={tmats.podIn} position={[-1.65, 0.12, 0.45]} scale={[0.85, 0.98, 0.85]} />
            <mesh geometry={stDishGeo} material={tmats.dish} position={[-1.65, 1.24, 0.45]} rotation={[2.6, 0, -0.4]} />
          </group>
        </group>
      )}
    </group>
  )
}

function Planet({ node, world, tex }) {
  const biome = useMemo(() => resolveNodeBiome(node, world), [node, world])
  const planetCfg = useMemo(() => resolvePlanetConfig(node, biome, world), [node, biome, world])
  const surfaceR = planetCfg.visualR
  const planetVisualR = surfaceR - 0.02
  const city = useMemo(() => cityData(node, biome, surfaceR), [node, biome, surfaceR])
  const unitSphereGeo = useMemo(() => getPlanetUnitSphereGeo(), [])
  const unitSphereLowGeo = useMemo(() => getPlanetUnitSphereLowGeo(), [])
  const ringGeo = useMemo(() => getPlanetRingGeo(), [])
  const planetMat = useMemo(() => createPlanetCartoonMaterial(planetCfg), [planetCfg])
  const cloudMat = useMemo(
    () => (planetCfg.clouds.enabled ? createPlanetCloudMaterial(planetCfg) : null),
    [planetCfg],
  )
  const ringMat = useMemo(
    () => (planetCfg.ring ? createPlanetRingMaterial(planetCfg, node.pos, planetVisualR) : null),
    [planetCfg, node.pos, planetVisualR],
  )
  const moonMats = useMemo(
    () => planetCfg.moons.map((m) => createPlanetMoonMaterial(m, planetCfg.outlineColor)),
    [planetCfg],
  )
  const moonsRender = useMemo(() => planetCfg.moons.map((m) => ({
    tilt: m.tilt,
    phase: m.phase,
    speed: m.speed,
    moonR: planetVisualR * m.radiusRatio,
    outlineR: planetVisualR * m.radiusRatio * 1.08,
    orbitPos: [planetVisualR * m.orbitRatio, 0, 0],
  })), [planetCfg.moons, planetVisualR])
  const outlineMat = useMemo(() => getPlanetOutlineMaterial(planetCfg.outlineHex), [planetCfg.outlineHex])
  const atmoOuterMat = useMemo(() => makeAtmoMaterial(biome.atmoBase, { back: true, rimColor: biome.atmoRim, power: biome.atmoPower, intensity: biome.atmoIntensity * 0.72 }), [biome])
  const farSkylineMat = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.5,
    metalness: 0.25,
    emissive: biome.emissiveColor,
    emissiveIntensity: biome.emissiveIntensity * 1.15,
  }), [biome])
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: biome.roadColor,
    map: tex.asphalt,
    normalMap: tex.asphaltNormal,
    roughness: 0.72,
    metalness: 0.14,
  }), [biome.roadColor, tex])
  const lineMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a3048',
    emissive: biome.cityLight,
    emissiveIntensity: 0.58,
    roughness: 0.4,
  }), [biome.cityLight])
  const lightsMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: biome.cityLight,
    toneMapped: false,
  }), [biome.cityLight])
  const labelPos = useMemo(() => [0, surfaceR + 3.4 * (surfaceR / 7.5), 0], [surfaceR])
  const tagStyle = useMemo(() => ({
    borderColor: biome.atmoRim,
    background: `linear-gradient(135deg, ${biome.groundLow}e8, ${biome.groundMid}d8)`,
    boxShadow: `0 0 12px ${biome.atmoBase}66`,
  }), [biome])
  const subTagStyle = useMemo(() => ({ display: 'block', fontSize: '0.72em', opacity: 0.85, color: biome.atmoRim }), [biome.atmoRim])

  useEffect(() => () => {
    planetMat.dispose()
    cloudMat?.dispose()
    ringMat?.dispose()
    moonMats.forEach((m) => m.dispose())
    city.roadGeo.dispose()
    city.lineGeo.dispose()
    city.farSkylineGeo?.dispose()
    atmoOuterMat.dispose()
    farSkylineMat.dispose()
    roadMat.dispose()
    lineMat.dispose()
    lightsMat.dispose()
  }, [planetMat, cloudMat, ringMat, moonMats, city, atmoOuterMat, farSkylineMat, roadMat, lineMat, lightsMat])

  const rootRef = useRef()
  const planetBodyRef = useRef()
  const planetMeshRef = useRef()
  const outlineMeshRef = useRef()
  const cloudsRef = useRef()
  const ringRef = useRef()
  const moonsGroupRef = useRef()
  const moonPivotsRef = useRef([])
  const animRegRef = useRef({ destinos: [], terminals: [], monument: null })

  // Único useFrame por nodo: solo escribe uniforms, rotaciones escalares y flags LOD (cero asignaciones)
  useFrame(({ camera, clock, size }, dt) => {
    const t = clock.elapsedTime
    planetMat.uniforms.uTime.value = t
    if (cloudMat) cloudMat.uniforms.uTime.value = t
    // impostor de mapa: el planeta entero (con sus terminales) se infla de lejos; los caminos acaban dentro de la esfera
    if (rootRef.current) rootRef.current.scale.setScalar(escalaMapa(surfaceR, camera.position.distanceTo(node.pos), camera, size.height))

    if (planetBodyRef.current) {
      planetBodyRef.current.rotation.y = planetCfg.rotY0 + t * planetCfg.spinSpeed
    }

    const dist = camera.position.distanceTo(node.pos)
    const near = dist < LOD_NEAR
    planetMat.uniforms.uDistBoost.value = Math.min(1, Math.max(0, (dist - 120) / 260))
    const showOrbitals = dist < LOD_ORBITALS
    const sphereGeo = showOrbitals ? unitSphereGeo : unitSphereLowGeo

    if (planetMeshRef.current && planetMeshRef.current.geometry !== sphereGeo) {
      planetMeshRef.current.geometry = sphereGeo
    }
    if (outlineMeshRef.current && outlineMeshRef.current.geometry !== sphereGeo) {
      outlineMeshRef.current.geometry = sphereGeo
    }

    if (cloudsRef.current) {
      const showClouds = dist < LOD_CLOUDS
      cloudsRef.current.visible = showClouds
      if (showClouds) cloudsRef.current.rotation.y = t * planetCfg.clouds.speed
    }

    // Con LOD: a detalle bajo sin anillos ni lunas
    if (ringRef.current) ringRef.current.visible = showOrbitals
    if (moonsGroupRef.current) {
      moonsGroupRef.current.visible = showOrbitals
      if (showOrbitals) {
        for (let i = 0; i < moonsRender.length; i++) {
          const piv = moonPivotsRef.current[i]
          if (piv) piv.rotation.y = moonsRender[i].phase + t * moonsRender[i].speed
        }
      }
    }

    const reg = animRegRef.current
    for (let i = 0; i < reg.destinos.length; i++) {
      const d = reg.destinos[i]
      if (d.detailGrp.current) d.detailGrp.current.visible = near
      if ((near || d.hoverRef.current) && d.icon.current) {
        d.icon.current.rotation.y = t * 1.5
        d.icon.current.position.y = d.baseY + Math.sin(t * 2 + d.idx) * 0.1
      }
    }

    for (let i = 0; i < reg.terminals.length; i++) {
      const tr = reg.terminals[i]
      if (tr.microRef.current) tr.microRef.current.visible = near
      if (!near) continue
      const entry = terminalPulse.get(tr.key)
      const active = entry && t - entry.at < 0.35 ? entry.power : 0
      tr.openAmt.current += (active - tr.openAmt.current) * Math.min(1, dt * 8)
      const slide = tr.openAmt.current * 0.65
      if (tr.doorL.current && tr.doorR.current) {
        tr.doorL.current.position.x = -0.48 - slide
        tr.doorR.current.position.x = 0.48 + slide
      }
      tr.portalMatObj.emissiveIntensity = (tr.isOut ? 1.55 : 1.05) + tr.openAmt.current * 0.9
      for (let j = 0; j < tr.beacons.current.length; j++) {
        const m = tr.beacons.current[j]
        if (!m) continue
        const speed = 2.5 + tr.openAmt.current * 5.5
        const wave = 0.5 + 0.5 * Math.sin(t * speed + (tr.isOut ? -j : j) * 1.1)
        m.scale.setScalar(0.85 + wave * 0.35 + tr.openAmt.current * 0.25)
        const halo = tr.beaconHalos.current[j]
        if (halo) halo.scale.setScalar(0.24 + wave * 0.1 + tr.openAmt.current * 0.12)
      }
    }

    const mon = reg.monument
    if (mon && near) {
      const mt = t + mon.nodeIdx * 1.7
      if (mon.animRef.current) {
        if (mon.biomeId === 'mar') {
          mon.animRef.current.rotation.y = mt * 1.35
        } else if (mon.biomeId === 'nubes') {
          mon.animRef.current.position.y = 1.65 + Math.sin(mt * 1.4) * 0.22
          mon.animRef.current.rotation.y = mt * 0.3
        } else {
          mon.animRef.current.rotation.y = mt * 0.85
        }
      }
      if (mon.animRef2.current) {
        mon.animRef2.current.rotation.y = -mt * 0.6
        mon.animRef2.current.rotation.z = Math.sin(mt * 1.2) * 0.08
      }
    }
  })

  return (
    <group ref={rootRef} position={node.pos}>
      {/* Esfera cartoon procedural con inclinación, giro, sombreado toon, nubes y contorno oscuro */}
      <group rotation={planetCfg.tilt}>
        <group ref={planetBodyRef} rotation-y={planetCfg.rotY0}>
          <mesh
            ref={planetMeshRef}
            geometry={unitSphereGeo}
            material={planetMat}
            scale={planetVisualR}
            onClick={(e) => {
              e.stopPropagation()
              focusWorldNode(node.idx)
            }}
          />
          <mesh
            ref={outlineMeshRef}
            geometry={unitSphereGeo}
            material={outlineMat}
            scale={planetVisualR * 1.045}
            raycast={() => null}
          />
        </group>

        {/* Capa propia de nubes con el mismo estilo toon */}
        {cloudMat && (
          <mesh
            ref={cloudsRef}
            geometry={unitSphereGeo}
            material={cloudMat}
            scale={planetVisualR * 1.028}
            raycast={() => null}
          />
        )}
      </group>

      {/* Anillo inclinado con bandas en shader y sombra planetaria */}
      {ringMat && (
        <mesh
          ref={ringRef}
          geometry={ringGeo}
          material={ringMat}
          rotation={planetCfg.ring.tilt}
          scale={planetVisualR}
          raycast={() => null}
        />
      )}

      {/* Lunas pequeñas en órbita */}
      {moonsRender.length > 0 && (
        <group ref={moonsGroupRef}>
          {moonsRender.map((m, i) => (
            <group key={i} rotation={m.tilt}>
              <group
                ref={(el) => { moonPivotsRef.current[i] = el }}
                rotation-y={m.phase}
              >
                <group position={m.orbitPos}>
                  <mesh
                    geometry={unitSphereLowGeo}
                    material={moonMats[i]}
                    scale={m.moonR}
                    raycast={() => null}
                  />
                  <mesh
                    geometry={unitSphereLowGeo}
                    material={outlineMat}
                    scale={m.outlineR}
                    raycast={() => null}
                  />
                </group>
              </group>
            </group>
          ))}
        </group>
      )}

      {/* Ciudad exterior compacta: siluetas pequeñas y puntos de luz */}
      {city.farSkylineGeo && (
        <mesh geometry={city.farSkylineGeo} material={farSkylineMat} raycast={() => null} />
      )}
      {city.cityLights.length > 0 && (
        <Instanced geo={haloSphereGeo} material={lightsMat} items={city.cityLights} raycast={() => null} />
      )}

      {/* Atmósfera exterior escalada al radio visual del planeta */}
      <mesh geometry={unitSphereLowGeo} material={atmoOuterMat} scale={planetVisualR * 1.13} raycast={() => null} />

      {/* Las calles envolventes (cinta de asfalto + línea) se quitaron del exterior: formaban una jaula sobre la esfera */}

      {/* Monumento único del bioma como silueta reconocible */}
      <Monument node={node} biome={biome} spot={city.monumentSpot} surfaceR={surfaceR} animRegRef={animRegRef} />

      {node.destinos.map((d) => <Destino key={d.idx} d={d} tex={tex} animRegRef={animRegRef} surfaceR={surfaceR} />)}
      {city.terminals.map((t, i) => (
        <Terminal
          key={`${t.kind}-${t.to}-${t.vert}-${i}`}
          node={node}
          term={t}
          color={world.nodes[t.to].color}
          tex={tex}
          animRegRef={animRegRef}
          surfaceR={surfaceR}
        />
      ))}
      <WorldHtml center position={labelPos} distanceFactor={20} farScale={0.8} farLift={16} farFrom={350} farTo={600} zIndexRange={[5, 0]}>
        <div className="tag node" style={tagStyle}>
          <span>{biome.emoji} {node.name}</span>
          <span style={subTagStyle}>{biome.title}</span>
        </div>
      </WorldHtml>
    </group>
  )
}

export default function Nodes({ world }) {
  const tex = useMemo(getTextures, [])
  useEffect(() => {
    registerWorldForVistas(world)
  }, [world])
  return world.nodes.map((n) => (
    <Planet key={n.idx} node={n} world={world} tex={tex} />
  ))
}
