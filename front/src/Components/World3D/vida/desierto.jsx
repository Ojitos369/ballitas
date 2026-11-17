// Vida del Camino del Desierto: mini mundo terrario dentro del tubo de cristal (contrato en README.md).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALL_R, Billboard, CartelesDeRuta, Critter, EventStage, Instanced,
  Soundless, TAU, buildSkyGeo, buildTerrainGeo, getBollitas, laneFrame,
  laneGap, makePlacement, maxHeight, mulberry32, placeAlong, placeAlongInto,
  routeInfo, scatter, segFrames, segPath, switchesOf,
} from './base.jsx'

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT_Q = new THREE.Quaternion()
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

const ESTILO = { color: '#fff4dc', bg: 'rgba(86,52,24,0.92)', border: '#ffc46b' }
const ESTILO_PANTALLA = { color: '#ffe8a3', bg: 'rgba(42,24,12,0.94)', border: '#ff9d3b', size: 46 }
const ESTILO_META = { color: '#fff8e1', bg: 'rgba(64,34,12,0.95)', border: '#ffd54f', size: 52 }

const _tmpV = new THREE.Vector3()
const _tmpV2 = new THREE.Vector3()
const _tmpQ = new THREE.Quaternion()
const _tmpQ2 = new THREE.Quaternion()
const _tmpS = new THREE.Vector3()
const _tmpM = new THREE.Matrix4()
const _tmpC = new THREE.Color()
const _tmpPl = makePlacement()

// ═══════════════════════════ UTILIDADES DE GEOMETRÍA SUAVE ═══════════════════════════
function bakePart(geo, hex, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz)
  if (rx) g.rotateX(rx)
  if (ry) g.rotateY(ry)
  if (rz) g.rotateZ(rz)
  if (tx || ty || tz) g.translate(tx, ty, tz)
  if (!g.attributes.normal) g.computeVertexNormals()
  const pos = g.getAttribute('position')
  const count = pos.count
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  const c = new THREE.Color(hex)
  const col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    col[i * 3] = c.r
    col[i * 3 + 1] = c.g
    col[i * 3 + 2] = c.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function mergePainted(parts) {
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  merged.computeBoundingSphere()
  return merged
}

// ═══════════════════════════ CACHÉ DE GEOMETRÍAS CHIBI Y PROPS ═══════════════════════════
let GEOS = null
function getGeos() {
  if (GEOS) return GEOS

  // Primitivas suaves reutilizables para construir piezas
  const sph16 = new THREE.SphereGeometry(1, 16, 12)
  const sph12 = new THREE.SphereGeometry(1, 12, 10)
  const cap12 = new THREE.CapsuleGeometry(1, 1, 8, 12)
  const cyl16 = new THREE.CylinderGeometry(1, 1, 1, 16)
  const cone16 = new THREE.ConeGeometry(1, 1, 16)
  const cone4 = new THREE.ConeGeometry(1, 1, 4)
  const tor16 = new THREE.TorusGeometry(1, 0.075, 12, 28)

  // 1. Camello chibi (orientado hacia +Z, base en y = 0, altura ~1)
  const camel = mergePainted([
    bakePart(sph16, '#e8b873', 0, 0.34, 0, 0, 0, 0, 0.24, 0.21, 0.34), // cuerpo
    bakePart(sph12, '#dfab60', 0, 0.54, -0.09, 0, 0, 0, 0.13, 0.15, 0.12), // joroba trasera
    bakePart(sph12, '#dfab60', 0, 0.56, 0.11, 0, 0, 0, 0.13, 0.16, 0.12), // joroba delantera
    bakePart(sph12, '#c84b31', 0, 0.51, 0.01, 0, 0, 0, 0.22, 0.06, 0.22), // montura festiva
    bakePart(cap12, '#eab974', 0, 0.52, 0.31, -0.35, 0, 0, 0.08, 0.13, 0.08), // cuello
    bakePart(sph16, '#f0c788', 0, 0.72, 0.38, 0, 0, 0, 0.16, 0.14, 0.17), // cabeza chibi
    bakePart(sph12, '#f8dfb4', 0, 0.68, 0.50, 0, 0, 0, 0.11, 0.08, 0.09), // hocico
    bakePart(sph12, '#ff8aa8', -0.10, 0.69, 0.45, 0, 0, 0, 0.04, 0.025, 0.03), // mejilla L
    bakePart(sph12, '#ff8aa8', 0.10, 0.69, 0.45, 0, 0, 0, 0.04, 0.025, 0.03), // mejilla R
    bakePart(sph12, '#1c1218', -0.075, 0.75, 0.49, 0, 0, 0, 0.032, 0.038, 0.025), // ojo L
    bakePart(sph12, '#1c1218', 0.075, 0.75, 0.49, 0, 0, 0, 0.032, 0.038, 0.025), // ojo R
    bakePart(sph12, '#ffffff', -0.068, 0.765, 0.51, 0, 0, 0, 0.012, 0.014, 0.01), // brillo L
    bakePart(sph12, '#ffffff', 0.082, 0.765, 0.51, 0, 0, 0, 0.012, 0.014, 0.01), // brillo R
    bakePart(sph12, '#d89f54', -0.13, 0.82, 0.34, 0, 0, 0.5, 0.04, 0.07, 0.03), // oreja L
    bakePart(sph12, '#d89f54', 0.13, 0.82, 0.34, 0, 0, -0.5, 0.04, 0.07, 0.03), // oreja R
    bakePart(cap12, '#cfa05a', -0.11, 0.12, 0.16, 0, 0, 0, 0.045, 0.08, 0.045), // pata FL
    bakePart(cap12, '#cfa05a', 0.11, 0.12, 0.16, 0, 0, 0, 0.045, 0.08, 0.045), // pata FR
    bakePart(cap12, '#cfa05a', -0.11, 0.12, -0.16, 0, 0, 0, 0.045, 0.08, 0.045), // pata BL
    bakePart(cap12, '#cfa05a', 0.11, 0.12, -0.16, 0, 0, 0, 0.045, 0.08, 0.045), // pata BR
  ])

  // 2. Serpiente chibi (cobra amigable enrollada y ondulante)
  const snake = mergePainted([
    bakePart(tor16, '#58b368', 0, 0.11, -0.04, Math.PI / 2, 0, 0, 0.24, 0.24, 0.32), // base espiral
    bakePart(tor16, '#6fd17e', 0, 0.22, -0.02, Math.PI / 2, 0, 0, 0.17, 0.17, 0.28), // espiral 2
    bakePart(cap12, '#78db86', 0, 0.42, 0.08, 0.25, 0, 0, 0.09, 0.16, 0.09), // cuello erguido
    bakePart(sph16, '#ffd166', 0, 0.48, 0.04, 0, 0, 0, 0.18, 0.17, 0.07), // capucha cobra
    bakePart(sph16, '#84e392', 0, 0.62, 0.15, 0, 0, 0, 0.16, 0.13, 0.16), // cabeza chibi
    bakePart(sph12, '#ff85a1', -0.10, 0.59, 0.23, 0, 0, 0, 0.036, 0.025, 0.025), // mejilla L
    bakePart(sph12, '#ff85a1', 0.10, 0.59, 0.23, 0, 0, 0, 0.036, 0.025, 0.025), // mejilla R
    bakePart(sph12, '#1a1220', -0.07, 0.65, 0.26, 0, 0, 0, 0.034, 0.04, 0.025), // ojo L
    bakePart(sph12, '#1a1220', 0.07, 0.65, 0.26, 0, 0, 0, 0.034, 0.04, 0.025), // ojo R
    bakePart(sph12, '#ffffff', -0.062, 0.665, 0.28, 0, 0, 0, 0.012, 0.014, 0.01),
    bakePart(sph12, '#ffffff', 0.078, 0.665, 0.28, 0, 0, 0, 0.012, 0.014, 0.01),
    bakePart(sph12, '#ff5d8f', 0, 0.56, 0.30, 0, 0, 0, 0.025, 0.018, 0.05), // lengüita cute
  ])

  // 3. Escorpión chibi (cuerpo rechoncho, pinzas redondas, aguijón brillante)
  const scorpion = mergePainted([
    bakePart(sph16, '#d96b27', 0, 0.22, 0, 0, 0, 0, 0.22, 0.16, 0.28), // cuerpo
    bakePart(sph12, '#f08a3c', 0, 0.26, 0.20, 0, 0, 0, 0.15, 0.12, 0.13), // cabeza
    bakePart(sph12, '#1a1218', -0.06, 0.31, 0.30, 0, 0, 0, 0.03, 0.035, 0.025), // ojo L
    bakePart(sph12, '#1a1218', 0.06, 0.31, 0.30, 0, 0, 0, 0.03, 0.035, 0.025), // ojo R
    bakePart(sph12, '#ffffff', -0.054, 0.322, 0.32, 0, 0, 0, 0.011, 0.013, 0.01),
    bakePart(sph12, '#ffffff', 0.066, 0.322, 0.32, 0, 0, 0, 0.011, 0.013, 0.01),
    bakePart(sph12, '#f4a261', -0.22, 0.24, 0.28, 0, 0.4, 0, 0.09, 0.07, 0.11), // pinza L
    bakePart(sph12, '#f4a261', 0.22, 0.24, 0.28, 0, -0.4, 0, 0.09, 0.07, 0.11), // pinza R
    bakePart(cap12, '#e07a32', 0, 0.36, -0.22, -0.5, 0, 0, 0.065, 0.11, 0.065), // cola 1
    bakePart(cap12, '#e76f51', 0, 0.56, -0.14, 0.65, 0, 0, 0.055, 0.10, 0.055), // cola 2
    bakePart(sph12, '#ffd166', 0, 0.66, 0.02, 0, 0, 0, 0.075, 0.075, 0.075), // aguijón ámbar
  ])

  // 4. Buitre chibi (regordete, collarín blanco suave, alas desplegadas)
  const vulture = mergePainted([
    bakePart(sph16, '#4a353b', 0, 0.32, 0, 0, 0, 0, 0.20, 0.22, 0.22), // cuerpo
    bakePart(tor16, '#f4ebe1', 0, 0.48, 0.02, Math.PI / 2, 0, 0, 0.16, 0.16, 0.28), // collarín plumas
    bakePart(sph16, '#e89ca8', 0, 0.60, 0.05, 0, 0, 0, 0.13, 0.12, 0.14), // cabecita rosada
    bakePart(cone16, '#ffd166', 0, 0.58, 0.20, Math.PI / 2 + 0.2, 0, 0, 0.05, 0.12, 0.05), // pico
    bakePart(sph12, '#1c1218', -0.06, 0.64, 0.15, 0, 0, 0, 0.028, 0.032, 0.022), // ojo L
    bakePart(sph12, '#1c1218', 0.06, 0.64, 0.15, 0, 0, 0, 0.028, 0.032, 0.022), // ojo R
    bakePart(sph12, '#ffffff', -0.055, 0.65, 0.17, 0, 0, 0, 0.01, 0.012, 0.01),
    bakePart(sph12, '#ffffff', 0.065, 0.65, 0.17, 0, 0, 0, 0.01, 0.012, 0.01),
    bakePart(sph12, '#5e434b', -0.34, 0.38, -0.02, 0, 0, -0.25, 0.26, 0.05, 0.14), // ala L
    bakePart(sph12, '#5e434b', 0.34, 0.38, -0.02, 0, 0, 0.25, 0.26, 0.05, 0.14), // ala R
  ])

  // 5. Fenec / Espíritu chibi espectador (para gradas y cazadores de escarabajos)
  const spectator = mergePainted([
    bakePart(sph16, '#f4c078', 0, 0.24, 0, 0, 0, 0, 0.19, 0.20, 0.19), // cuerpo túnica
    bakePart(sph16, '#fde2b8', 0, 0.48, 0, 0, 0, 0, 0.18, 0.16, 0.18), // cabeza
    bakePart(tor16, '#e76f51', 0, 0.59, 0, Math.PI / 2, 0, 0, 0.15, 0.15, 0.28), // turbante
    bakePart(sph12, '#ffd166', 0, 0.63, 0.15, 0, 0, 0, 0.045, 0.045, 0.03), // gema turbante
    bakePart(sph12, '#1d1322', -0.06, 0.49, 0.15, 0, 0, 0, 0.028, 0.034, 0.02),
    bakePart(sph12, '#1d1322', 0.06, 0.49, 0.15, 0, 0, 0, 0.028, 0.034, 0.02),
    bakePart(sph12, '#ff85a1', -0.10, 0.44, 0.14, 0, 0, 0, 0.035, 0.02, 0.02),
    bakePart(sph12, '#ff85a1', 0.10, 0.44, 0.14, 0, 0, 0, 0.035, 0.02, 0.02),
    bakePart(sph12, '#fde2b8', -0.20, 0.34, 0.06, 0, 0, 0.4, 0.055, 0.09, 0.055), // brazo L arriba
    bakePart(sph12, '#fde2b8', 0.20, 0.34, 0.06, 0, 0, -0.4, 0.055, 0.09, 0.055), // brazo R arriba
  ])

  // 6. Cactus saguaro suave con botón floral
  const cactus = mergePainted([
    bakePart(cap12, '#3d9956', 0, 0.46, 0, 0, 0, 0, 0.14, 0.36, 0.14), // tronco
    bakePart(cap12, '#49ad63', -0.19, 0.50, 0, 0, 0, 0.45, 0.09, 0.16, 0.09), // brazo L
    bakePart(cap12, '#49ad63', 0.19, 0.58, 0, 0, 0, -0.45, 0.09, 0.14, 0.09), // brazo R
    bakePart(sph12, '#ff6b9d', 0, 0.92, 0, 0, 0, 0, 0.08, 0.06, 0.08), // flor superior
    bakePart(sph12, '#ffd166', 0, 0.95, 0, 0, 0, 0, 0.04, 0.03, 0.04),
  ])

  // 7. Palmera de oasis suave
  const palm = mergePainted([
    bakePart(cap12, '#8d5b34', 0, 0.24, 0, 0.08, 0, 0, 0.075, 0.22, 0.075),
    bakePart(cap12, '#9c663b', 0, 0.56, 0.04, -0.08, 0, 0, 0.065, 0.22, 0.065),
    bakePart(sph12, '#2d8a4e', 0.24, 0.78, 0, 0, 0, -0.35, 0.26, 0.04, 0.11),
    bakePart(sph12, '#369e5a', -0.24, 0.78, 0, 0, 0, 0.35, 0.26, 0.04, 0.11),
    bakePart(sph12, '#2d8a4e', 0, 0.78, 0.24, 0.35, 0, 0, 0.11, 0.04, 0.26),
    bakePart(sph12, '#369e5a', 0, 0.78, -0.24, -0.35, 0, 0, 0.11, 0.04, 0.26),
    bakePart(sph12, '#47b36b', 0, 0.85, 0, 0, 0, 0, 0.12, 0.07, 0.12),
  ])

  // 8. Pirámide escalonada de arenisca con ápice dorado
  const pyramid = mergePainted([
    bakePart(cone4, '#c78c46', 0, 0.32, 0, 0, Math.PI / 4, 0, 0.62, 0.64, 0.62),
    bakePart(cone4, '#ffd166', 0, 0.68, 0, 0, Math.PI / 4, 0, 0.18, 0.20, 0.18),
  ])

  // 9. Casita adobe / tienda de oasis
  const adobe = mergePainted([
    bakePart(sph16, '#e6be8a', 0, 0.24, 0, 0, 0, 0, 0.36, 0.28, 0.36), // cúpula base
    bakePart(sph16, '#d9a15b', 0, 0.46, 0, 0, 0, 0, 0.24, 0.18, 0.24), // domo superior
    bakePart(cyl16, '#3a2216', 0, 0.15, 0.32, Math.PI / 2, 0, 0, 0.10, 0.08, 0.10), // puerta
    bakePart(sph12, '#ff8552', 0, 0.36, 0.34, 0, 0, 0, 0.14, 0.04, 0.09), // toldo
  ])

  // 10. Roca arenisca suave / mesa en miniatura
  const rock = mergePainted([
    bakePart(sph16, '#b07242', 0, 0.22, 0, 0, 0, 0, 0.38, 0.24, 0.32),
    bakePart(sph12, '#c88752', 0.14, 0.30, -0.05, 0, 0, 0, 0.22, 0.18, 0.20),
    bakePart(sph12, '#995f34', -0.16, 0.16, 0.10, 0, 0, 0, 0.20, 0.14, 0.18),
  ])

  // 11. Grada curva de estadio (3 niveles de arenisca y bronce)
  const stand = mergePainted([
    bakePart(cyl16, '#7a4b2a', 0, 0.08, 0, 0, 0, 0, 0.46, 0.16, 0.95),
    bakePart(cyl16, '#9c6236', -0.10, 0.22, 0, 0, 0, 0, 0.34, 0.16, 0.90),
    bakePart(cyl16, '#be7c46', -0.20, 0.36, 0, 0, 0, 0, 0.22, 0.16, 0.85),
    bakePart(cap12, '#ffd166', -0.26, 0.48, 0, Math.PI / 2, 0, 0, 0.03, 0.72, 0.03),
  ])

  // 12. Farola desértica curva con globo cálido
  const lamp = mergePainted([
    bakePart(cap12, '#5c3c24', 0, 0.36, 0, 0, 0, 0, 0.035, 0.34, 0.035),
    bakePart(cap12, '#8a5a36', -0.06, 0.72, 0, 0, 0, 0.6, 0.028, 0.12, 0.028),
    bakePart(sph12, '#ffd97d', -0.14, 0.72, 0, 0, 0, 0, 0.08, 0.095, 0.08),
  ])

  // 13. Valla de pista suave (poste + barra)
  const fence = mergePainted([
    bakePart(cap12, '#8d5a32', 0, 0.14, -0.32, 0, 0, 0, 0.03, 0.12, 0.03),
    bakePart(cap12, '#8d5a32', 0, 0.14, 0.32, 0, 0, 0, 0.03, 0.12, 0.03),
    bakePart(cap12, '#f4b961', 0, 0.22, 0, Math.PI / 2, 0, 0, 0.026, 0.36, 0.026),
  ])

  // 14. Banderín triangular suave
  const pennant = mergePainted([
    bakePart(cone16, '#ffffff', 0, -0.14, 0, Math.PI, 0, 0, 0.14, 0.28, 0.03),
  ])

  // 15. Escarabajo dorado / luciérnaga / meteorito
  const orb = new THREE.SphereGeometry(1, 14, 10)
  const star = mergePainted([
    bakePart(sph12, '#fff7cc', 0, 0, 0, 0, 0, 0, 0.12, 0.12, 0.34),
    bakePart(cone16, '#ffb703', 0, 0, -0.45, -Math.PI / 2, 0, 0, 0.09, 0.55, 0.09),
  ])

  // 16. Flor de cactus animable (pétalos para bloom)
  const petal = new THREE.SphereGeometry(1, 12, 10)
  petal.scale(0.14, 0.05, 0.26)
  petal.translate(0, 0, 0.16)

  GEOS = {
    camel, snake, scorpion, vulture, spectator, cactus, palm, pyramid, adobe, rock,
    stand, lamp, fence, pennant, orb, star, petal,
    sph16, sph12, cap12, cyl16, cone16, cone4, tor16,
  }
  return GEOS
}

// ═══════════════════════════ TEXTURAS Y MATERIALES CACHEADOS ═══════════════════════════
let MATS = null
function getMats() {
  if (MATS) return MATS

  const curbTex = (() => {
    if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([255, 200, 100, 255]), 1, 1)
    const c = document.createElement('canvas')
    c.width = 512; c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#3b2414'
    ctx.fillRect(0, 0, 512, 128)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ff9f1c' : '#fff3d6'
      ctx.fillRect(i * 64, 0, 64, 28)
      ctx.fillRect(i * 64, 100, 64, 28)
    }
    ctx.fillStyle = '#ffd166'
    ctx.font = 'bold 42px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('DESIERTO · ARENA', 256, 66)
    const tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  })()

  const checkerTex = (() => {
    if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
    const c = document.createElement('canvas')
    c.width = 256; c.height = 64
    const ctx = c.getContext('2d')
    const cols = 16; const rows = 4
    const cw = c.width / cols; const ch = c.height / rows
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cols; k++) {
        ctx.fillStyle = (r + k) % 2 === 0 ? '#2b180c' : '#ffe6a7'
        ctx.fillRect(k * cw, r * ch, cw, ch)
      }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  })()

  MATS = {
    clay: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.48, metalness: 0.06, emissive: '#331c0a', emissiveIntensity: 0.24,
    }),
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0.04, side: THREE.DoubleSide, emissive: '#3a200c', emissiveIntensity: 0.22,
    }),
    glowAmber: new THREE.MeshBasicMaterial({ color: '#ffd166', toneMapped: false }),
    glowCyan: new THREE.MeshBasicMaterial({ color: '#48cae4', toneMapped: false }),
    glowPink: new THREE.MeshBasicMaterial({ color: '#ff70a6', toneMapped: false }),
    glowWhite: new THREE.MeshBasicMaterial({ color: '#fff8d6', toneMapped: false }),
    brass: new THREE.MeshStandardMaterial({ color: '#e9b44c', roughness: 0.28, metalness: 0.78 }),
    stone: new THREE.MeshStandardMaterial({ color: '#c88d55', roughness: 0.85, metalness: 0.05 }),
    curb: new THREE.MeshStandardMaterial({
      map: curbTex, roughness: 0.55, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    checker: new THREE.MeshBasicMaterial({
      map: checkerTex, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    sandDust: new THREE.MeshBasicMaterial({
      color: '#ffe2a3', transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false,
    }),
    pennant: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, side: THREE.DoubleSide }),
    beam: new THREE.MeshBasicMaterial({
      color: '#ffd166', transparent: true, opacity: 0.24, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
    water: new THREE.MeshBasicMaterial({
      color: '#38d9c0', transparent: true, opacity: 0.68, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
  }
  return MATS
}

// ═══════════════════════════ ALTURA DE TERRENO COMPARTIDA ═══════════════════════════
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function desertDuneHeight(seg, u, a) {
  const bank = smooth(0.50, 0.68, Math.abs(a)) // deja 100% libre el piso de Paths.jsx (-0.51..0.51)
  const fSeed = (seg.i + 1) * 1.37
  const dune = 0.5 + 0.5 * Math.sin(u * seg.length * 0.45 * fSeed + a * 2.7) * Math.cos(u * seg.length * 0.22 - a * 1.9)
  return THREE.MathUtils.clamp(dune, 0, 1) * bank
}

function desertSurfaceOffset(seg, u, a) {
  const arc = Math.PI * 0.50
  const edge = 1 - smooth(arc * 0.7, arc, Math.abs(a))
  const gap = laneGap(seg, a)
  const chan = smooth(0.02, 0.32, gap)
  const maxH = Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22)
  const hk = desertDuneHeight(seg, u, a) * edge * chan
  return seg.radius * 0.015 + hk * maxH
}

function seatOnTerrain(items) {
  for (const it of items) {
    const off = desertSurfaceOffset(it.seg, it.u, it.angle)
    const p = placeAlong(it.seg, it.u, off, it.angle)
    it.pos.copy(p.pos)
    it.quat.copy(p.quat)
    it.up.copy(p.up)
    it.side.copy(p.side)
  }
  return items
}

// ═══════════════════════════ CINTAS DE PISTA (BORDILLOS Y METAS) ═══════════════════════════
function buildRibbonGeo(seg, angleCenter, halfArc, offsetFrac, repeatAlong = 0.35) {
  const frames = segFrames(seg)
  const R = seg.radius * (1 - offsetFrac)
  const nF = frames.length
  const pos = new Float32Array(nF * 2 * 3)
  const uv = new Float32Array(nF * 2 * 2)
  const idx = []
  const dv = new THREE.Vector3()
  for (let i = 0; i < nF; i++) {
    const f = frames[i]
    for (let j = 0; j < 2; j++) {
      const a = angleCenter + (j === 0 ? -halfArc : halfArc)
      dv.copy(f.up).multiplyScalar(-Math.cos(a)).addScaledVector(f.right, Math.sin(a))
      const p = (i * 2 + j) * 3
      pos[p] = f.pos.x + dv.x * R
      pos[p + 1] = f.pos.y + dv.y * R
      pos[p + 2] = f.pos.z + dv.z * R
      const uIdx = (i * 2 + j) * 2
      uv[uIdx] = f.arc * repeatAlong
      uv[uIdx + 1] = j
    }
    if (i < nF - 1) {
      const k = i * 2
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function buildCheckerStripGeo(seg, uCenter, halfSpanArc = 0.33, widthWorld = 1.15) {
  const frames = segFrames(seg)
  const du = THREE.MathUtils.clamp((widthWorld * 0.5) / Math.max(seg.length, 1), 0.005, 0.06)
  const u0 = THREE.MathUtils.clamp(uCenter - du, 0.005, 0.99)
  const u1 = THREE.MathUtils.clamp(uCenter + du, 0.01, 0.995)
  const nU = 3; const nA = 10
  const pos = new Float32Array((nU + 1) * (nA + 1) * 3)
  const uv = new Float32Array((nU + 1) * (nA + 1) * 2)
  const idx = []
  const dv = new THREE.Vector3()
  const fr = { pos: new THREE.Vector3(), T: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3() }
  let p = 0; let q = 0
  for (let i = 0; i <= nU; i++) {
    const u = THREE.MathUtils.lerp(u0, u1, i / nU)
    let lo = 0; let hi = frames.length - 1
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (frames[m].u <= u) lo = m; else hi = m }
    const a = frames[lo]; const b = frames[hi]
    const al = b.u > a.u ? (u - a.u) / (b.u - a.u) : 0
    fr.pos.copy(a.pos).lerp(b.pos, al)
    fr.up.copy(a.up).lerp(b.up, al).normalize()
    fr.right.copy(a.right).lerp(b.right, al).normalize()
    for (let j = 0; j <= nA; j++) {
      const ang = -halfSpanArc + (j / nA) * halfSpanArc * 2
      const r = seg.radius * (0.971 - 0.01 * Math.pow(Math.abs(ang) / 0.34, 2))
      dv.copy(fr.up).multiplyScalar(-Math.cos(ang)).addScaledVector(fr.right, Math.sin(ang))
      pos[p] = fr.pos.x + dv.x * r; pos[p + 1] = fr.pos.y + dv.y * r; pos[p + 2] = fr.pos.z + dv.z * r
      uv[q] = j / nA; uv[q + 1] = i / nU
      p += 3; q += 2
    }
  }
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nA; j++) {
      const k = i * (nA + 1) + j
      idx.push(k, k + nA + 1, k + 1, k + 1, k + nA + 1, k + nA + 2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function wallY(R, x) {
  return R - Math.sqrt(Math.max(0.04, R * R - x * x)) + 0.02
}

// ═══════════════════════════ PÓRTICO DE BIENVENIDA CON EMBLEMA ═══════════════════════════
function WelcomePortico({ seg, wayName }) {
  const G = getGeos()
  const M = getMats()
  const pl = useMemo(() => placeAlong(seg, 0.065, 0, 0), [seg])
  const quat = useMemo(() => pl.quat.clone().multiply(FLIP_Y), [pl])
  const rSpan = Math.min(seg.radius * 0.42, 0.98)
  const yBase = wallY(seg.radius, rSpan)
  const archH = Math.min(seg.radius * 0.68, 1.48)
  const colH = Math.max(0.4, archH * 0.88 - yBase)
  const emblemRef = useRef()
  useFrame(({ clock }) => {
    if (emblemRef.current) {
      emblemRef.current.rotation.y = clock.elapsedTime * 1.4
      emblemRef.current.rotation.z = Math.sin(clock.elapsedTime * 2) * 0.12
    }
  })
  return (
    <group position={pl.pos} quaternion={quat}>
      {/* Pilares de arenisca apoyados sobre la pared interior */}
      <mesh geometry={G.cyl16} material={M.stone} position={[-rSpan, yBase + colH * 0.5, 0]} scale={[0.12, colH, 0.12]} />
      <mesh geometry={G.cyl16} material={M.stone} position={[rSpan, yBase + colH * 0.5, 0]} scale={[0.12, colH, 0.12]} />
      <mesh geometry={G.tor16} material={M.brass} position={[0, archH * 0.84, 0]} scale={[rSpan * 0.96, 0.52, 0.52]} />
      {/* Emblema solar rotatorio en la boca */}
      <group ref={emblemRef} position={[0, archH * 1.15, 0]}>
        <mesh geometry={G.cone4} material={M.glowAmber} scale={[0.24, 0.32, 0.24]} />
        <mesh geometry={G.tor16} material={M.brass} scale={[0.22, 0.22, 0.22]} />
      </group>
      {/* Focos laterales */}
      <mesh geometry={G.sph12} material={M.glowAmber} position={[-rSpan * 0.94, archH * 0.9, 0.1]} scale={0.09} />
      <mesh geometry={G.sph12} material={M.glowAmber} position={[rSpan * 0.94, archH * 0.9, 0.1]} scale={0.09} />
      <Billboard
        text="☀ BIENVENIDOS"
        style={{ ...ESTILO, sub: wayName, size: 48 }}
        height={0.32}
        position={[0, archH * 0.85, 0.14]}
      />
    </group>
  )
}

// ═══════════════════════════ FUEGOS ARTIFICIALES DE META ═══════════════════════════
function FinishFireworks({ seg }) {
  const G = getGeos()
  const M = getMats()
  const pl = useMemo(() => placeAlong(seg, 0.86, 0, 0), [seg])
  const quat = useMemo(() => pl.quat.clone().multiply(FLIP_Y), [pl])
  const archW = Math.min(seg.radius * 0.42, 0.96)
  const yBase = wallY(seg.radius, archW)
  const archH = Math.min(seg.radius * 0.66, 1.44)
  const colH = Math.max(0.4, archH * 0.86 - yBase)

  const sparksRef = useRef()
  const N = 28
  const dirs = useMemo(() => {
    const rng = mulberry32(seg.i * 991 + 7)
    return Array.from({ length: N }, (_, i) => {
      const a = (i / N) * TAU + rng() * 0.3
      const r = 0.4 + rng() * 0.7
      return {
        vx: Math.cos(a) * r, vy: 0.4 + Math.sin(a) * r * 0.75, vz: (rng() - 0.5) * 0.6,
        phase: rng() * TAU, col: ['#ffd166', '#ff6b6b', '#48cae4', '#ff9f1c'][i % 4],
      }
    })
  }, [seg.i])
  const items = useMemo(() => dirs.map((d) => ({ pos: new THREE.Vector3(), scale: 0.06, color: d.col })), [dirs])
  const burst = useRef(0)

  useLayoutEffect(() => {
    const mesh = sparksRef.current
    if (!mesh) return
    for (let i = 0; i < N; i++) mesh.setColorAt(i, _tmpC.set(dirs[i].col))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [dirs])

  useFrame(({ clock }, dt) => {
    const mesh = sparksRef.current
    if (!mesh) return
    const bolls = getBollitas()
    let hit = false
    for (let i = 0; i < bolls.length; i++) {
      const b = bolls[i]
      if (b.phase === 'travel' && b.seg === seg && (b.segT ?? 0) > 0.74) { hit = true; break }
    }
    burst.current = THREE.MathUtils.damp(burst.current, hit ? 1 : 0.15, hit ? 10 : 1.8, Math.min(dt, 0.1))
    const t = clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const d = dirs[i]
      const cyc = ((t * 1.4 + d.phase) % 1.4) / 1.4
      const amp = burst.current * seg.radius * 0.42 * cyc
      _tmpV.set(d.vx * amp, archH * 0.85 + d.vy * amp - cyc * cyc * 0.25, d.vz * amp)
      const sc = Math.max(0.005, (1 - cyc) * 0.085 * (0.35 + burst.current * 0.95))
      _tmpS.setScalar(sc)
      _tmpM.compose(_tmpV, IDENT_Q, _tmpS)
      mesh.setMatrixAt(i, _tmpM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={pl.pos} quaternion={quat}>
      <mesh geometry={G.cyl16} material={M.brass} position={[-archW, yBase + colH * 0.5, 0]} scale={[0.1, colH, 0.1]} />
      <mesh geometry={G.cyl16} material={M.brass} position={[archW, yBase + colH * 0.5, 0]} scale={[0.1, colH, 0.1]} />
      <mesh geometry={G.tor16} material={M.glowAmber} position={[0, archH * 0.84, 0]} scale={[archW * 0.94, 0.46, 0.46]} />
      <Billboard text="🏁 META DEL DESIERTO" style={ESTILO_META} height={0.28} position={[0, archH * 0.94, 0.12]} />
      <instancedMesh ref={sparksRef} args={[G.orb, M.glowWhite, N]} frustumCulled={false} />
    </group>
  )
}

// ═══════════════════════════ MECANISMOS DE CAMBIO DE CARRIL (ANCLAS 3D) ═══════════════════════════
function LaneSwitchMechanisms({ way }) {
  const G = getGeos()
  const M = getMats()

  const mechanisms = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (seg.air) continue
      const realSwitches = switchesOf(seg)
      const list = realSwitches.length
        ? realSwitches
        : (seg.route >= 0 || seg.kind === 'salida'
            ? [
                {
                  u: 0.28,
                  from: 0,
                  to: 0,
                  kind: seg.kind,
                  duration: 0.8,
                  _synthAngle: (seg.i % 2 === 0 ? 1 : -1) * 1.18,
                },
                {
                  u: 0.66,
                  from: 0,
                  to: 0,
                  kind: seg.event || seg.kind,
                  duration: 0.8,
                  _synthAngle: (seg.i % 2 === 0 ? -1 : 1) * 1.35,
                },
              ]
            : [])
      for (const sw of list) {
        const uIn = THREE.MathUtils.clamp(sw.u ?? 0.5, 0.05, 0.92)
        const uOut = THREE.MathUtils.clamp(uIn + 0.06, 0.08, 0.96)
        const fIn = laneFrame(seg, sw.from ?? 0, uIn)
        const fOut = sw._synthAngle != null
          ? (() => {
              const p = placeAlong(seg, uOut, 0, sw._synthAngle)
              return { pos: p.pos, tangent: p.tangent, up: p.up, side: p.side }
            })()
          : laneFrame(seg, sw.to ?? 0, uOut)

        const qIn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fIn.side, fIn.up, fIn.tangent))
        const qOut = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fOut.side, fOut.up, fOut.tangent))
        // Anillo direccional lateral/superior (deja libre el eje POV central) y puente pegado a la pared
        const mid = fOut.pos.clone().addScaledVector(fOut.up, 0.24)
        const bridgeDir = fOut.pos.clone().sub(fIn.pos)
        const bridgeLen = Math.max(0.25, bridgeDir.length())
        const qBridge = new THREE.Quaternion().setFromUnitVectors(Y, bridgeDir.clone().normalize())
        out.push({ seg, uIn, kind: sw.kind, fIn, fOut, qIn, qOut, mid, bridgeLen, qBridge })
      }
    }
    return out
  }, [way])

  const ringsRef = useRef()
  const rotorsRef = useRef()
  const padsRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBollitas()
    for (let i = 0; i < mechanisms.length; i++) {
      const m = mechanisms[i]
      let act = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === m.seg) {
          const d = Math.abs((b.segT ?? 0) - m.uIn)
          if (d < 0.12) act = Math.max(act, 1 - d / 0.12)
        }
      }
      const spinSpd = 1.6 + act * 6.5
      // Ancla de entrada sobre el carril
      if (padsRef.current) {
        _tmpV.copy(m.fIn.pos).addScaledVector(m.fIn.up, 0.04)
        _tmpS.set(0.32, 0.06 + act * 0.05, 0.32)
        _tmpM.compose(_tmpV, m.qIn, _tmpS)
        padsRef.current.setMatrixAt(i, _tmpM)
      }
      // Aro portal / turbina direccional anclado en el carril destino
      if (ringsRef.current) {
        _tmpQ.copy(m.qOut)
        _tmpQ2.setFromAxisAngle(Z, t * spinSpd * (i % 2 === 0 ? 1 : -1))
        _tmpQ.multiply(_tmpQ2)
        _tmpS.setScalar(0.26 + act * 0.12)
        _tmpM.compose(m.mid, _tmpQ, _tmpS)
        ringsRef.current.setMatrixAt(i, _tmpM)
      }
      // Marcador de ancla en el carril destino (en lugar de barra atravesando el centro)
      if (rotorsRef.current) {
        _tmpV.copy(m.fOut.pos).addScaledVector(m.fOut.up, 0.05)
        _tmpS.set(0.24 + act * 0.06, 0.05, 0.24 + act * 0.06)
        _tmpM.compose(_tmpV, m.qOut, _tmpS)
        rotorsRef.current.setMatrixAt(i, _tmpM)
      }
    }
    if (padsRef.current) padsRef.current.instanceMatrix.needsUpdate = true
    if (ringsRef.current) ringsRef.current.instanceMatrix.needsUpdate = true
    if (rotorsRef.current) rotorsRef.current.instanceMatrix.needsUpdate = true
  })

  if (!mechanisms.length) return null
  return (
    <group>
      <instancedMesh ref={padsRef} args={[G.cyl16, M.brass, mechanisms.length]} frustumCulled={false} />
      <instancedMesh ref={ringsRef} args={[G.tor16, M.glowAmber, mechanisms.length]} frustumCulled={false} />
      <instancedMesh ref={rotorsRef} args={[G.cap12, M.glowCyan, mechanisms.length]} frustumCulled={false} />
    </group>
  )
}

// ═══════════════════════════ EVENTOS PERSONALIZADOS POR RUTA ═══════════════════════════
// Ruta A (rápida): Tormenta de Turbinas de Viento + Remolinos + Aros Turbo
function DesertTurbineEvent({ seg }) {
  const G = getGeos()
  const M = getMats()
  return (
    <EventStage
      segment={seg}
      render={(stage) => <DesertTurbineStage seg={seg} stage={stage} G={G} M={M} />}
    />
  )
}

function DesertTurbineStage({ seg, stage, G, M }) {
  const bladeRefs = useRef([])
  const ringRefs = useRef([])
  const spotRefs = useRef([])
  const anchors = useMemo(() => [0.22, 0.48, 0.74].map((u) => placeAlong(seg, u, 0, 0)), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = stage.k
    const inten = stage.intensity
    const spin = 2.0 + inten * 9.0
    for (let i = 0; i < anchors.length; i++) {
      const b = bladeRefs.current[i]
      if (b) b.rotation.z = t * spin * (i % 2 === 0 ? 1 : -1)
      const r = ringRefs.current[i]
      if (r) {
        const hit = stage.phase === 'climax' ? Math.max(0, 1 - Math.abs(k - (0.22 + i * 0.26)) * 5) : 0
        const sc = (0.58 + inten * 0.22 + hit * 0.25) * (seg.radius * 0.42)
        r.scale.setScalar(sc)
        r.rotation.z = -t * spin * 0.7
      }
      const sp = spotRefs.current[i]
      if (sp) sp.rotation.z = Math.sin(t * (2.5 + inten * 4) + i) * (0.25 + inten * 0.45)
    }
  })

  const rArm = Math.min(seg.radius * 0.40, 0.96)
  const yBase = wallY(seg.radius, rArm)
  return (
    <group>
      {anchors.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.quat}>
          {/* Andamio lateral con focos */}
          <mesh geometry={G.cyl16} material={M.stone} position={[-rArm, yBase + 0.5, 0]} scale={[0.07, 1.0, 0.07]} />
          <mesh geometry={G.cyl16} material={M.stone} position={[rArm, yBase + 0.5, 0]} scale={[0.07, 1.0, 0.07]} />
          <group ref={(el) => { spotRefs.current[i] = el }} position={[0, 0.98, 0]}>
            <mesh geometry={G.cone16} material={M.beam} position={[-rArm * 0.65, -0.35, 0]} rotation={[0, 0, -0.3]} scale={[0.25, 0.7, 0.25]} />
            <mesh geometry={G.cone16} material={M.beam} position={[rArm * 0.65, -0.35, 0]} rotation={[0, 0, 0.3]} scale={[0.25, 0.7, 0.25]} />
          </group>
          {/* Aspas de turbina del desierto en zona alta (libres del cauce) */}
          <group ref={(el) => { bladeRefs.current[i] = el }} position={[0, seg.radius * 0.72, 0]}>
            <mesh geometry={G.cap12} material={M.brass} scale={[0.042, rArm * 0.48, 0.042]} />
            <mesh geometry={G.cap12} material={M.brass} rotation={[0, 0, Math.PI / 2]} scale={[0.042, rArm * 0.48, 0.042]} />
          </group>
          {/* Aro remolino */}
          <mesh ref={(el) => { ringRefs.current[i] = el }} geometry={G.tor16} material={M.glowAmber} position={[0, seg.radius * 0.52, 0]} />
        </group>
      ))}
    </group>
  )
}

// Ruta B (lenta): Puerta de la Esfinge que se abre, Cactus en Flor y Cascada de Oasis que cambia de color
function DesertOasisSphinxEvent({ seg }) {
  const G = getGeos()
  const M = getMats()
  return (
    <EventStage
      segment={seg}
      render={(stage) => <DesertOasisSphinxStage seg={seg} stage={stage} G={G} M={M} />}
    />
  )
}

function DesertOasisSphinxStage({ seg, stage, G, M }) {
  const doorLRef = useRef()
  const doorRRef = useRef()
  const waterRef = useRef()
  const bloomRefs = useRef([])
  const doorPl = useMemo(() => placeAlong(seg, 0.22, 0, 0), [seg])
  const oasisPl = useMemo(() => placeAlong(seg, 0.56, 0, 0), [seg])
  const cactusPls = useMemo(() => [
    placeAlong(seg, 0.42, 0.04, 0.72),
    placeAlong(seg, 0.56, 0.04, -0.75),
    placeAlong(seg, 0.74, 0.04, 0.74),
  ], [seg])
  const waterMat = useMemo(() => M.water.clone(), [M])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const open = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.4 + stage.k * 0.5 : stage.intensity
    const slide = 0.22 + open * 0.46
    if (doorLRef.current) doorLRef.current.position.x = -slide
    if (doorRRef.current) doorRRef.current.position.x = slide

    // Cascada/laguna del oasis cambia suavemente de turquesa a dorado atardecer
    const hue = 0.48 - open * 0.34 + Math.sin(t * 0.9) * 0.05
    waterMat.color.setHSL((hue + 1) % 1, 0.78, 0.56)
    waterMat.opacity = 0.5 + open * 0.28

    // Cactus florecen al paso de la bollita
    for (let i = 0; i < bloomRefs.current.length; i++) {
      const grp = bloomRefs.current[i]
      if (!grp) continue
      const bloom = 0.35 + open * 0.85 + Math.sin(t * 2.5 + i) * 0.08
      grp.scale.setScalar(bloom)
      grp.rotation.y = t * 0.8 + i
    }
  })

  const rHalf = Math.min(seg.radius * 0.38, 0.88)
  const yBase = wallY(seg.radius, rHalf)
  return (
    <group>
      {/* Puerta de la Esfinge que se abre al llegar */}
      <group position={doorPl.pos} quaternion={doorPl.quat}>
        <mesh geometry={G.pyramid} material={M.clay} position={[-rHalf, yBase, 0]} scale={0.56} />
        <mesh geometry={G.pyramid} material={M.clay} position={[rHalf, yBase, 0]} scale={0.56} />
        <mesh ref={doorLRef} geometry={G.cyl16} material={M.stone} position={[-0.25, yBase + 0.45, 0]} scale={[0.36, 0.86, 0.12]} />
        <mesh ref={doorRRef} geometry={G.cyl16} material={M.stone} position={[0.25, yBase + 0.45, 0]} scale={[0.36, 0.86, 0.12]} />
        <mesh geometry={G.tor16} material={M.glowAmber} position={[0, yBase + 0.98, 0]} scale={0.32} />
      </group>

      {/* Cascada / Espejo de oasis cambiante */}
      <group position={oasisPl.pos} quaternion={oasisPl.quat}>
        <mesh ref={waterRef} geometry={G.cyl16} material={waterMat} position={[-0.72, yBase + 0.38, 0]} rotation={[0, 0, -0.35]} scale={[0.22, 0.78, 0.85]} />
        <mesh geometry={G.cyl16} material={waterMat} position={[0.72, yBase + 0.38, 0]} rotation={[0, 0, 0.35]} scale={[0.22, 0.78, 0.85]} />
      </group>

      {/* Cactus con flores que se abren */}
      {cactusPls.map((cp, idx) => (
        <group key={idx} position={cp.pos} quaternion={cp.quat}>
          <mesh geometry={G.cactus} material={M.clay} scale={0.72} />
          <group ref={(el) => { bloomRefs.current[idx] = el }} position={[0, 0.68, 0]}>
            {[0, 1, 2, 3, 4].map((p) => (
              <mesh
                key={p}
                geometry={G.petal}
                material={M.glowPink}
                rotation={[0.25, (p / 5) * TAU, 0]}
                scale={0.75}
              />
            ))}
          </group>
        </group>
      ))}
    </group>
  )
}

// Puente de arenisca que se arma + Pirámide Astronómica (segunda mitad / ruta C / otros eventos)
function DesertBridgePyramidEvent({ seg }) {
  const G = getGeos()
  const M = getMats()
  return (
    <EventStage
      segment={seg}
      render={(stage) => <DesertBridgePyramidStage seg={seg} stage={stage} G={G} M={M} />}
    />
  )
}

function DesertBridgePyramidStage({ seg, stage, G, M }) {
  const blockRefs = useRef([])
  const beamRef = useRef()
  const blocks = useMemo(() => [0.22, 0.34, 0.46, 0.58, 0.70, 0.82].map((u) => placeAlong(seg, u, 0, 0)), [seg])
  const pyrPl = useMemo(() => placeAlong(seg, 0.52, 0, 0.86), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.3 + stage.k * 0.7 : stage.intensity
    for (let i = 0; i < blockRefs.current.length; i++) {
      const m = blockRefs.current[i]
      if (!m) continue
      const rise = THREE.MathUtils.clamp(active * 1.4 - i * 0.12, 0, 1)
      m.position.y = THREE.MathUtils.lerp(0.65, 0.04, rise) + Math.sin(t * 2 + i) * (1 - rise) * 0.06
      m.rotation.z = (1 - rise) * (i % 2 === 0 ? 0.5 : -0.5)
    }
    if (beamRef.current) {
      beamRef.current.scale.set(0.14 + active * 0.16, 0.7 + active * 0.9, 0.14 + active * 0.16)
      beamRef.current.rotation.y = t * 1.5
    }
  })

  return (
    <group>
      {blocks.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.quat}>
          <mesh
            ref={(el) => { blockRefs.current[i] = el }}
            geometry={G.cyl16}
            material={M.brass}
            position={[0, 0.05, 0]}
            scale={[0.45, 0.06, 0.45]}
          />
        </group>
      ))}
      <group position={pyrPl.pos} quaternion={pyrPl.quat}>
        <mesh geometry={G.pyramid} material={M.clay} scale={0.95} />
        <mesh ref={beamRef} geometry={G.cone16} material={M.beam} position={[0, 0.88, 0]} />
      </group>
    </group>
  )
}

// Anillos de tormenta solar para tramos en el aire (caida, canon, trampolin)
function DesertAirRings({ way }) {
  const G = getGeos()
  const M = getMats()
  const rings = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (!seg.air) continue
      const n = Math.max(3, Math.floor(seg.length / 8))
      for (let i = 1; i <= n; i++) {
        const u = i / (n + 1)
        const p = seg.curve.getPointAt(u)
        const T = seg.curve.getTangentAt(u)
        const q = new THREE.Quaternion().setFromUnitVectors(Z, T)
        out.push({ pos: p, quat: q, scale: seg.radius * 0.78, color: i % 2 === 0 ? '#ffd166' : '#ff9f1c' })
      }
    }
    return out
  }, [way])
  const meshRef = useRef()
  useFrame(({ clock }) => {
    const m = meshRef.current
    if (!m || !rings.length) return
    const t = clock.elapsedTime
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]
      _tmpQ.copy(r.quat)
      _tmpQ2.setFromAxisAngle(Z, t * 2.2 + i * 0.8)
      _tmpQ.multiply(_tmpQ2)
      _tmpS.setScalar(r.scale * (1 + Math.sin(t * 3 + i) * 0.08))
      _tmpM.compose(r.pos, _tmpQ, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })
  if (!rings.length) return null
  return <instancedMesh ref={meshRef} args={[G.tor16, M.glowAmber, rings.length]} frustumCulled={false} />
}

// ═══════════════════════════ CRIATURAS ESPECIALES ANIMADAS ═══════════════════════════
// Buitres que circulan por la bóveda superior y aletean al paso de las bollitas
function SkyVultures({ way }) {
  const G = getGeos()
  const M = getMats()
  const path = useMemo(() => segPath(way.segments), [way])
  const count = 10
  const state = useMemo(() => {
    const rng = mulberry32(way.idx * 313 + 91)
    return Array.from({ length: count }, (_, i) => ({
      s: (i / count + rng() * 0.05) * path.total,
      dir: i % 2 === 0 ? 1 : -1,
      speed: 1.4 + rng() * 1.1,
      ph: rng() * TAU,
      angleBase: (i % 2 === 0 ? 1 : -1) * (2.25 + rng() * 0.55),
    }))
  }, [path, way.idx])
  const items = useMemo(() => state.map(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale: 0.24 })), [state])
  const meshRef = useRef()
  const loc = useMemo(() => ({}), [])

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current
    if (!mesh || !path.total) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBollitas()
    for (let i = 0; i < count; i++) {
      const v = state[i]
      let boost = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = path.arcOf(b.seg, b.segT ?? 0)
        if (arc != null && Math.abs(arc - v.s) < 5) boost = Math.max(boost, 1 - Math.abs(arc - v.s) / 5)
      }
      v.s += v.dir * v.speed * (1 + boost * 1.4) * h
      if (v.s > path.total) { v.s = path.total; v.dir = -1 }
      if (v.s < 0) { v.s = 0; v.dir = 1 }
      path.locate(v.s, loc)
      const a = v.angleBase + Math.sin(t * 1.2 + v.ph) * 0.28
      const off = 0.36 + Math.sin(t * (3.2 + boost * 5) + v.ph) * 0.12
      placeAlongInto(loc.seg, loc.u, off, a, _tmpPl)
      _tmpQ.copy(_tmpPl.quat)
      if (v.dir < 0) _tmpQ.multiply(FLIP_Y)
      // Inclinación suave en vuelo circular
      _tmpQ2.setFromAxisAngle(Z, Math.sin(t * 2 + v.ph) * 0.22)
      _tmpQ.multiply(_tmpQ2)
      _tmpS.set(0.24, 0.24 * (1 + Math.sin(t * 9 + v.ph) * 0.12), 0.24)
      _tmpM.compose(_tmpPl.pos, _tmpQ, _tmpS)
      mesh.setMatrixAt(i, _tmpM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!path.total) return null
  return <instancedMesh ref={meshRef} args={[G.vulture, M.clay, items.length]} frustumCulled={false} />
}

// Espectadores en las gradas que hacen la "ola" cuando pasa la bollita + cazadores de escarabajos + grupo dormido
function LivingCrowdAndBehavior({ way, standItems }) {
  const G = getGeos()
  const M = getMats()

  const crowd = useMemo(() => {
    const rng = mulberry32(way.idx * 701 + 19)
    const out = []
    for (const st of standItems) {
      for (let r = 0; r < 3; r++) {
        for (let c = -1; c <= 1; c++) {
          const p = placeAlong(st.seg, THREE.MathUtils.clamp(st.u + c * 0.012, 0.03, 0.97), (st.off ?? 0.08) + 0.1 + r * 0.14, st.angle + (st.angle > 0 ? 0.06 : -0.06) * r)
          const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, st.angle > 0 ? -Math.PI * 0.5 : Math.PI * 0.5))
          out.push({ seg: st.seg, u: st.u, pos: p.pos, up: p.up, quat: q, ph: rng() * TAU, sc: 0.14 + rng() * 0.03 })
        }
      }
    }
    return out
  }, [way.idx, standItems])

  // Grupo dormido en tramos lentos / oasis (respira suavemente y despierta al paso)
  const sleepers = useMemo(() => {
    const slowSegs = way.segments.filter((s) => !s.air && (s.speedK < 1.0 || way.routes[s.route]?.profile?.speed === 'lenta'))
    return seatOnTerrain(scatter(way, 12, mulberry32(way.idx * 509 + 3), {
      segments: slowSegs.length ? slowSegs : undefined,
      angle: [-0.95, 0.95], clear: BALL_R * 0.85, offset: [0.04, 0.08], scale: [0.20, 0.24],
    }))
  }, [way])

  // Escarabajos dorados en enjambre + perseguidores
  const scarabs = useMemo(() => scatter(way, 26, mulberry32(way.idx * 823 + 7), {
    angle: [-1.45, 1.45], clear: BALL_R * 0.55, offset: [0.22, 0.58], scale: [0.055, 0.085],
  }), [way])

  const crowdRef = useRef()
  const sleepRef = useRef()
  const scarabRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBollitas()

    // Ola en las gradas
    if (crowdRef.current && crowd.length) {
      for (let i = 0; i < crowd.length; i++) {
        const fan = crowd[i]
        let wave = 0
        for (let k = 0; k < bolls.length; k++) {
          const b = bolls[k]
          if (b.phase === 'travel' && b.seg === fan.seg) {
            const d = Math.abs((b.segT ?? 0) - fan.u)
            if (d < 0.22) wave = Math.max(wave, (1 - d / 0.22) * (0.6 + (b.speed ?? 12) * 0.03))
          }
        }
        const hop = Math.abs(Math.sin(t * (4 + wave * 8) + fan.ph)) * (0.02 + wave * 0.12)
        _tmpV.copy(fan.pos).addScaledVector(fan.up, hop)
        _tmpS.setScalar(fan.sc * (1 + wave * 0.2))
        _tmpM.compose(_tmpV, fan.quat, _tmpS)
        crowdRef.current.setMatrixAt(i, _tmpM)
      }
      crowdRef.current.instanceMatrix.needsUpdate = true
    }

    // Durmientes que respiran suave o se desperezan si pasa bollita cerca
    if (sleepRef.current && sleepers.length) {
      for (let i = 0; i < sleepers.length; i++) {
        const sl = sleepers[i]
        let awake = 0
        for (let k = 0; k < bolls.length; k++) {
          const b = bolls[k]
          if (b.phase === 'travel' && b.seg === sl.seg && Math.abs((b.segT ?? 0) - sl.u) < 0.14) awake = 1
        }
        const breath = 1 + Math.sin(t * (awake ? 9 : 1.8) + sl.rnd * TAU) * (awake ? 0.16 : 0.06)
        _tmpV.copy(sl.pos).addScaledVector(sl.up, awake * Math.abs(Math.sin(t * 8)) * 0.14)
        _tmpS.set(sl.scale, sl.scale * breath, sl.scale)
        _tmpM.compose(_tmpV, sl.quat, _tmpS)
        sleepRef.current.setMatrixAt(i, _tmpM)
      }
      sleepRef.current.instanceMatrix.needsUpdate = true
    }

    // Escarabajos dorados en órbita
    if (scarabRef.current && scarabs.length) {
      for (let i = 0; i < scarabs.length; i++) {
        const sc = scarabs[i]
        const orb = t * 1.9 + sc.rnd * TAU
        _tmpV.copy(sc.pos)
          .addScaledVector(sc.side, Math.cos(orb) * 0.18)
          .addScaledVector(sc.up, Math.sin(orb * 1.5) * 0.12)
        _tmpS.setScalar(sc.scale * (0.85 + Math.sin(t * 6 + i) * 0.2))
        _tmpM.compose(_tmpV, IDENT_Q, _tmpS)
        scarabRef.current.setMatrixAt(i, _tmpM)
      }
      scarabRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {crowd.length > 0 && <instancedMesh ref={crowdRef} args={[G.spectator, M.clay, crowd.length]} frustumCulled={false} />}
      {sleepers.length > 0 && <instancedMesh ref={sleepRef} args={[G.camel, M.clay, sleepers.length]} frustumCulled={false} />}
      {scarabs.length > 0 && <instancedMesh ref={scarabRef} args={[G.orb, M.glowAmber, scarabs.length]} frustumCulled={false} />}
    </group>
  )
}

// ═══════════════════════════ CIELO INTERIOR, LUNA Y METEORITOS ═══════════════════════════
function DesertSkyPhenomena({ way, detail }) {
  const G = getGeos()
  const M = getMats()
  const path = useMemo(() => segPath(way.segments), [way])
  const skyGeos = useMemo(() => {
    return way.segments.filter((s) => !s.air).map((seg) => {
      const rt = way.routes[seg.route]
      const sp = rt?.profile?.speed
      const colors = sp === 'rapida' ? ['#ff9e44', '#1f2b54'] : sp === 'lenta' ? ['#f5b47a', '#16344c'] : ['#eb9d52', '#1c2445']
      return { key: seg.i, geo: buildSkyGeo(seg, { radial: 28, colors }) }
    })
  }, [way])

  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.FrontSide, transparent: true, opacity: 0.25, depthWrite: false, fog: false,
  }), [])

  // Lunas y estrellas fijas en el techo del diorama
  const moons = useMemo(() => scatter(way, 12, mulberry32(way.idx * 419 + 5), {
    angle: [Math.PI * 0.82, Math.PI * 1.18], clear: 0, offset: [0.18, 0.26], scale: [0.16, 0.24],
  }), [way])
  const stars = useMemo(() => scatter(way, 72, mulberry32(way.idx * 443 + 9), {
    angle: [Math.PI * 0.62, Math.PI * 1.38], clear: 0, offset: [0.1, 0.2], scale: [0.028, 0.052],
  }), [way])

  // Lluvia de meteoritos animados en el techo
  const meteorsN = 22
  const meteors = useMemo(() => {
    const rng = mulberry32(way.idx * 613 + 11)
    return Array.from({ length: meteorsN }, () => ({
      s0: rng() * Math.max(1, path.total),
      speed: 8 + rng() * 12,
      angle: Math.PI + (rng() - 0.5) * 0.9,
      ph: rng() * TAU,
      sc: 0.16 + rng() * 0.14,
    }))
  }, [path, way.idx])

  // Remolinos / polvo de arena reactivo a la velocidad
  const dustN = 48
  const dust = useMemo(() => {
    const rng = mulberry32(way.idx * 907 + 23)
    return Array.from({ length: dustN }, () => ({
      s: rng() * Math.max(1, path.total),
      angle: (rng() - 0.5) * 2.2,
      off: 0.15 + rng() * 0.85,
      ph: rng() * TAU,
      sc: 0.04 + rng() * 0.05,
    }))
  }, [path, way.idx])

  const meteorRef = useRef()
  const dustRef = useRef()
  const loc = useMemo(() => ({}), [])

  useFrame(({ clock }, dt) => {
    const det = detail?.value ?? 0
    skyMat.opacity = THREE.MathUtils.lerp(0.2, 0.56, det)

    if (!path.total) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBollitas()
    let maxSpd = 10
    for (let k = 0; k < bolls.length; k++) {
      if (bolls[k].way === way && (bolls[k].speed ?? 0) > maxSpd) maxSpd = bolls[k].speed
    }
    const spdFactor = THREE.MathUtils.clamp(maxSpd / 18, 0.6, 2.4)

    if (meteorRef.current) {
      for (let i = 0; i < meteorsN; i++) {
        const m = meteors[i]
        const s = (m.s0 + t * m.speed) % path.total
        path.locate(s, loc)
        const a = m.angle + Math.sin(t * 0.7 + m.ph) * 0.15
        placeAlongInto(loc.seg, loc.u, 0.18, a, _tmpPl)
        _tmpS.setScalar(m.sc)
        _tmpM.compose(_tmpPl.pos, _tmpPl.quat, _tmpS)
        meteorRef.current.setMatrixAt(i, _tmpM)
      }
      meteorRef.current.instanceMatrix.needsUpdate = true
    }

    if (dustRef.current) {
      for (let i = 0; i < dustN; i++) {
        const d = dust[i]
        d.s = (d.s + h * (5.5 * spdFactor)) % path.total
        path.locate(d.s, loc)
        const swirl = d.angle + Math.sin(t * 2.5 * spdFactor + d.ph) * 0.5
        placeAlongInto(loc.seg, loc.u, d.off, swirl, _tmpPl)
        _tmpS.setScalar(d.sc * (0.8 + spdFactor * 0.3))
        _tmpM.compose(_tmpPl.pos, IDENT_Q, _tmpS)
        dustRef.current.setMatrixAt(i, _tmpM)
      }
      dustRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {skyGeos.map(({ key, geo }) => <mesh key={key} geometry={geo} material={skyMat} />)}
      <Instanced geo={G.orb} mat={M.glowAmber} items={moons} />
      <Instanced geo={G.orb} mat={M.glowWhite} items={stars} />
      {path.total > 0 && <instancedMesh ref={meteorRef} args={[G.star, M.glowWhite, meteorsN]} frustumCulled={false} />}
      {path.total > 0 && <instancedMesh ref={dustRef} args={[G.orb, M.sandDust, dustN]} frustumCulled={false} />}
    </group>
  )
}

// ═══════════════════════════ BALIZAS REACTIVAS A BOLLITA ═══════════════════════════
function ReactiveTotemLights({ way }) {
  const G = getGeos()
  const beacons = useMemo(() => scatter(way, 34, mulberry32(way.idx * 887 + 31), {
    angle: [-0.92, 0.92], clear: BALL_R * 0.72, offset: [0.42, 0.62], scale: [0.09, 0.14],
  }), [way])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  const meshRef = useRef()

  useFrame(({ clock }) => {
    const m = meshRef.current
    if (!m || !beacons.length) return
    const t = clock.elapsedTime
    const bolls = getBollitas()
    for (let i = 0; i < beacons.length; i++) {
      const bcn = beacons[i]
      let nearB = null; let nearK = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === bcn.seg) {
          const d = Math.abs((b.segT ?? 0) - bcn.u)
          if (d < 0.18 && 1 - d / 0.18 > nearK) { nearK = 1 - d / 0.18; nearB = b }
        }
      }
      if (nearB) {
        _tmpC.setHSL(nearB.genome.hue, 0.85, 0.62)
      } else {
        _tmpC.set('#ffd166')
      }
      m.setColorAt(i, _tmpC)
      const sc = bcn.scale * (1 + nearK * 0.7 + Math.sin(t * 3.5 + i) * 0.12)
      _tmpS.setScalar(sc)
      _tmpM.compose(bcn.pos, IDENT_Q, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  if (!beacons.length) return null
  return <instancedMesh ref={meshRef} args={[G.orb, mat, beacons.length]} frustumCulled={false} />
}

// ═══════════════════════════ TERRENO Y MINI MAPA POR TRAMO ═══════════════════════════
export default function Vida({ way, detail }) {
  const G = getGeos()
  const M = getMats()
  const info = useMemo(() => routeInfo(way), [way])

  // Terreno suave, bordillos y líneas de meta cuadriculadas por tramo sólido
  const trackParts = useMemo(() => {
    const terrains = []; const curbs = []; const checkers = []
    for (const si of info.segments) {
      const seg = si.seg
      if (seg.air) continue
      const rt = info.routes[si.route]
      const sp = rt?.profile?.speed
      const colors = sp === 'rapida'
        ? ['#a85828', '#f2b154']
        : sp === 'lenta'
          ? ['#b98349', '#67b887']
          : ['#b26b36', '#ecc070']

      // Relieve ondulado suave respetando el piso/carril y altura máxima <= R * FILL
      const maxH = Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22)
      terrains.push(
        buildTerrainGeo(seg, {
          arc: Math.PI * 0.50,
          maxH,
          radial: 52,
          along: Math.ceil(seg.length * 3.0),
          colors,
          height: (u, a) => desertDuneHeight(seg, u, a),
        }),
      )

      // Bordillos con texto pintado sobre los bordes del piso (±0.45 rad)
      curbs.push(buildRibbonGeo(seg, -0.45, 0.055, 0.059, 0.32))
      curbs.push(buildRibbonGeo(seg, 0.45, 0.055, 0.059, 0.32))

      // Líneas cuadriculadas en entradas/salidas de evento y en la meta
      if (si.event) {
        checkers.push(buildCheckerStripGeo(seg, 0.035))
        checkers.push(buildCheckerStripGeo(seg, 0.965))
      } else if (si.kind === 'llegada') {
        checkers.push(buildCheckerStripGeo(seg, 0.86))
      }
    }
    return {
      terrain: terrains.length ? mergeGeometries(terrains, false) : null,
      curb: curbs.length ? mergeGeometries(curbs, false) : null,
      checker: checkers.length ? mergeGeometries(checkers, false) : null,
    }
  }, [info])

  // Inventario del mini mapa y capas (primer plano, plano medio, fondo)
  const props = useMemo(() => {
    const rng = mulberry32(way.idx * 2027 + 41)
    const solid = info.segments.filter((s) => !s.air).map((s) => s.seg)
    const slowSegs = info.segments.filter((s) => !s.air && info.routes[s.route]?.profile?.speed === 'lenta').map((s) => s.seg)
    const fastSegs = info.segments.filter((s) => !s.air && info.routes[s.route]?.profile?.speed === 'rapida').map((s) => s.seg)

    const cacti = seatOnTerrain(scatter(way, 80, rng, {
      angle: [-1.25, 1.25], clear: BALL_R * 0.72, offset: [0.02, 0.06], scale: [0.42, 0.72],
    }))
    const palms = seatOnTerrain(scatter(way, 42, rng, {
      segments: slowSegs.length ? slowSegs : solid,
      angle: [-1.15, 1.15], clear: BALL_R * 0.78, offset: [0.02, 0.06], scale: [0.48, 0.82],
    }))
    const pyramids = seatOnTerrain(scatter(way, 26, rng, {
      angle: [-1.35, 1.35], clear: BALL_R * 0.9, offset: [0.02, 0.08], scale: [0.48, 0.86],
    }))
    const adobes = seatOnTerrain(scatter(way, 32, rng, {
      segments: slowSegs.length ? slowSegs : solid,
      angle: [-1.15, 1.15], clear: BALL_R * 0.85, offset: [0.02, 0.05], scale: [0.42, 0.72],
    }))
    const rocks = seatOnTerrain(scatter(way, 95, rng, {
      angle: [-1.35, 1.35], clear: BALL_R * 0.68, offset: [0.0, 0.05], scale: [0.32, 0.60],
    }))
    // Gradas del estadio sentadas sobre el terreno de las laderas
    const stands = []
    for (const seg of solid) {
      const nSt = Math.max(1, Math.floor(seg.length / 20))
      for (let i = 0; i < nSt; i++) {
        const u = (i + 0.5) / nSt
        const side = (i + seg.i) % 2 === 0 ? 1 : -1
        const angle = side * 0.78
        if (laneGap(seg, angle) > BALL_R * 0.45 / Math.max(seg.radius, 1)) {
          const off = desertSurfaceOffset(seg, u, angle)
          const p = placeAlong(seg, u, off, angle)
          const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? Math.PI : 0))
          stands.push({ seg, u, angle, off, pos: p.pos, quat: q, scale: [0.78, 0.78, 0.9] })
        }
      }
    }
    // Farolas y vallas en primer plano
    const lamps = []; const fences = []; const pennants = []; const screens = []
    const penCols = ['#ff6b35', '#ffd166', '#2ec4b6', '#ff9f1c']
    for (const seg of solid) {
      const rt = info.routes[seg.route]
      const sp = rt?.profile?.speed
      const lampStep = sp === 'rapida' ? 8 : 6.5
      const nL = Math.max(2, Math.floor(seg.length / lampStep))
      for (let i = 0; i < nL; i++) {
        const u = (i + 0.35) / nL
        const side = i % 2 === 0 ? 1 : -1
        const p = placeAlong(seg, u, desertSurfaceOffset(seg, u, side * 0.54), side * 0.54)
        const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? 0 : Math.PI))
        lamps.push({ pos: p.pos, quat: q, scale: 0.48 })
        const fp = placeAlong(seg, u, desertSurfaceOffset(seg, u, -side * 0.52), -side * 0.52)
        fences.push({ pos: fp.pos, quat: fp.quat, scale: 0.72 })
      }
      // Banderines colgantes en la zona media-alta
      const nP = Math.max(3, Math.floor(seg.length / 5))
      for (let i = 0; i < nP; i++) {
        const u = (i + 0.5) / nP
        const ang = (i % 2 === 0 ? 1 : -1) * (1.28 + (i % 3) * 0.14)
        const p = placeAlong(seg, u, 0.22, ang)
        pennants.push({ pos: p.pos, quat: p.quat, scale: 0.68, color: penCols[(i + seg.i) % penCols.length] })
      }
      // Pantallas del estadio en tramos con gradas
      if (seg.length > 16) {
        const u = 0.5
        const ang = seg.i % 2 === 0 ? -0.95 : 0.95
        const p = placeAlong(seg, u, 0.55, ang)
        const q = p.quat.clone().multiply(FLIP_Y)
        const label = sp === 'rapida' ? '⚡ TURBO DUNA' : sp === 'lenta' ? '🌴 OASIS ZEN' : '☀ COPA DESIERTO'
        screens.push({ key: seg.i, pos: p.pos, quat: q, text: label, sub: seg.name })
      }
    }
    // Siluetas lejanas en el horizonte interior (fondo)
    const horizon = scatter(way, 34, rng, {
      angle: [1.38, 1.72], clear: 0, offset: [0.02, 0.05], scale: [0.32, 0.55],
    }).concat(scatter(way, 34, rng, {
      angle: [-1.72, -1.38], clear: 0, offset: [0.02, 0.05], scale: [0.32, 0.55],
    }))

    return { cacti, palms, pyramids, adobes, rocks, stands, lamps, fences, pennants, screens, horizon, fastSegs, slowSegs }
  }, [way, info])

  // Selección de eventos por ruta (sin repetir coreografías entre rutas A/B/C)
  const eventEls = useMemo(() => {
    const out = []
    for (const si of info.events) {
      if (si.route === 0) out.push(<DesertTurbineEvent key={si.i} seg={si.seg} />)
      else if (si.route === 1) out.push(<DesertOasisSphinxEvent key={si.i} seg={si.seg} />)
      else out.push(<DesertBridgePyramidEvent key={si.i} seg={si.seg} />)
    }
    // También en tramos no-evento destacados de cada ruta (mitad 2) para que ningún tramo quede vacío
    for (const rt of info.routes) {
      const extra = rt.segments.find((s) => !s.air && !s.event && s.route >= 0 && s.seg !== rt.segments[1]?.seg)
      if (extra) out.push(<DesertBridgePyramidEvent key={`x-${extra.i}`} seg={extra.seg} />)
    }
    return out
  }, [info])

  const salidaSeg = info.shared.find((s) => s.kind === 'salida')?.seg
  const llegadaSeg = info.shared.find((s) => s.kind === 'llegada')?.seg
  const route0Segs = useMemo(() => info.routes[0]?.segments.map((s) => s.seg), [info])
  const route1Segs = useMemo(() => info.routes[1]?.segments.map((s) => s.seg), [info])

  return (
    <group name="vida-desierto">
      {/* Terreno temático, cielo interior, bordillos con texto y metas cuadriculadas */}
      {trackParts.terrain && <mesh geometry={trackParts.terrain} material={M.terrain} receiveShadow />}
      {trackParts.curb && <mesh geometry={trackParts.curb} material={M.curb} />}
      {trackParts.checker && <mesh geometry={trackParts.checker} material={M.checker} />}
      <DesertSkyPhenomena way={way} detail={detail} />

      {/* Pórtico de bienvenida en la boca + carteles de ruta + meta con fuegos artificiales */}
      {salidaSeg && <WelcomePortico seg={salidaSeg} wayName={way.theme.name} />}
      {llegadaSeg && <FinishFireworks seg={llegadaSeg} />}
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#6d4c2f" angle={0.92} height={0.32} />

      {/* Pantallas de estadio */}
      {props.screens.map((sc) => (
        <Billboard key={sc.key} text={sc.text} style={{ ...ESTILO_PANTALLA, sub: sc.sub }} height={0.28} position={sc.pos} quat={sc.quat} glow={1.25} />
      ))}

      {/* Decoración instanciada en primer plano, plano medio y siluetas de fondo */}
      <Instanced geo={G.cactus} mat={M.clay} items={props.cacti} />
      <Instanced geo={G.palm} mat={M.clay} items={props.palms} />
      <Instanced geo={G.pyramid} mat={M.clay} items={props.pyramids} />
      <Instanced geo={G.adobe} mat={M.clay} items={props.adobes} />
      <Instanced geo={G.rock} mat={M.clay} items={props.rocks} />
      <Instanced geo={G.stand} mat={M.clay} items={props.stands} />
      <Instanced geo={G.lamp} mat={M.clay} items={props.lamps} />
      <Instanced geo={G.fence} mat={M.clay} items={props.fences} />
      <Instanced geo={G.pennant} mat={M.pennant} items={props.pennants} />
      <Instanced geo={G.pyramid} mat={M.clay} items={props.horizon} />

      {/* Mecanismos de cambio de carril (con anclas claras en laneFrame) */}
      <LaneSwitchMechanisms way={way} />

      {/* Eventos personalizados por ruta + anillos en tramos air */}
      {eventEls}
      <DesertAirRings way={way} />

      {/* Elenco vivo chibi: camellos, serpientes, escorpiones, buitres, espectadores, durmientes, escarabajos */}
      <Critter way={way} segments={route0Segs} count={16} geo={G.camel} mat={M.clay} scale={0.25} speed={0.85} offset={0.24} angle={0.62} spread={0.14} hop={0.28} seed={11} />
      <Critter way={way} segments={route1Segs ?? route0Segs} count={14} geo={G.camel} mat={M.clay} scale={0.23} speed={0.55} offset={0.24} angle={-0.62} spread={0.14} hop={0.24} seed={22} />
      <Critter way={way} count={18} geo={G.snake} mat={M.clay} scale={0.22} speed={1.05} offset={0.18} angle={0.56} spread={0.12} hop={0.34} seed={33} />
      <Critter way={way} count={18} geo={G.scorpion} mat={M.clay} scale={0.21} speed={0.95} offset={0.18} angle={-0.56} spread={0.12} hop={0.32} seed={44} />
      <SkyVultures way={way} />
      <LivingCrowdAndBehavior way={way} standItems={props.stands} />
      <ReactiveTotemLights way={way} />

      <Soundless />
    </group>
  )
}
