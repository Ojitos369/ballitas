// Vida del Camino del Volcán: mini mundo terrario dentro del tubo de cristal (contrato en README.md).
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

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT_Q = new THREE.Quaternion()
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

const ESTILO = { color: '#fff1e6', bg: 'rgba(48,16,10,0.93)', border: '#ff7043' }
const ESTILO_PANTALLA = { color: '#ffe5cc', bg: 'rgba(36,10,8,0.94)', border: '#ff5722', size: 46 }
const ESTILO_META = { color: '#fff4d6', bg: 'rgba(54,14,10,0.95)', border: '#ffb300', size: 52 }

const _tmpV = new THREE.Vector3()
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

  const sph16 = new THREE.SphereGeometry(1, 16, 12)
  const sph12 = new THREE.SphereGeometry(1, 12, 10)
  const cap12 = new THREE.CapsuleGeometry(1, 1, 8, 12)
  const cyl16 = new THREE.CylinderGeometry(1, 1, 1, 16)
  const cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6)
  const cone16 = new THREE.ConeGeometry(1, 1, 16)
  const tor16 = new THREE.TorusGeometry(1, 0.075, 12, 28)

  // 1. Dragón pequeño chibi (panza dorada, cuernitos, alas suaves, ojos brillantes)
  const dragon = mergePainted([
    bakePart(sph16, '#e63946', 0, 0.28, 0, 0, 0, 0, 0.22, 0.22, 0.26), // cuerpo
    bakePart(sph12, '#ffd166', 0, 0.25, 0.12, 0, 0, 0, 0.16, 0.16, 0.16), // panza cálida
    bakePart(sph16, '#f04a56', 0, 0.56, 0.12, 0, 0, 0, 0.19, 0.17, 0.19), // cabeza chibi
    bakePart(sph12, '#ff758f', 0, 0.52, 0.28, 0, 0, 0, 0.12, 0.08, 0.09), // hocico
    bakePart(cone16, '#ffd166', -0.09, 0.75, 0.08, -0.2, 0, 0.25, 0.04, 0.13, 0.04), // cuerno L
    bakePart(cone16, '#ffd166', 0.09, 0.75, 0.08, -0.2, 0, -0.25, 0.04, 0.13, 0.04), // cuerno R
    bakePart(sph12, '#1d1118', -0.075, 0.60, 0.27, 0, 0, 0, 0.032, 0.038, 0.025), // ojo L
    bakePart(sph12, '#1d1118', 0.075, 0.60, 0.27, 0, 0, 0, 0.032, 0.038, 0.025), // ojo R
    bakePart(sph12, '#ffffff', -0.068, 0.614, 0.29, 0, 0, 0, 0.012, 0.014, 0.01),
    bakePart(sph12, '#ffffff', 0.082, 0.614, 0.29, 0, 0, 0, 0.012, 0.014, 0.01),
    bakePart(sph12, '#ff9ebb', -0.12, 0.53, 0.24, 0, 0, 0, 0.035, 0.022, 0.022), // rubor
    bakePart(sph12, '#ff9ebb', 0.12, 0.53, 0.24, 0, 0, 0, 0.035, 0.022, 0.022),
    bakePart(sph12, '#ff9f1c', -0.28, 0.42, -0.08, 0.2, 0, -0.35, 0.22, 0.04, 0.14), // ala L
    bakePart(sph12, '#ff9f1c', 0.28, 0.42, -0.08, 0.2, 0, 0.35, 0.22, 0.04, 0.14), // ala R
    bakePart(cap12, '#d62828', 0, 0.20, -0.26, 0.8, 0, 0, 0.06, 0.14, 0.06), // colita
    bakePart(sph12, '#ffd166', 0, 0.24, -0.40, 0, 0, 0, 0.07, 0.07, 0.07), // flama cola
  ])

  // 2. Gólem de lava chibi (basalto redondeado con grietas de magma)
  const golem = mergePainted([
    bakePart(sph16, '#3a2b2e', 0, 0.32, 0, 0, 0, 0, 0.28, 0.26, 0.24), // torso roca
    bakePart(sph12, '#ff5a1f', 0, 0.30, 0.18, 0, 0, 0, 0.13, 0.11, 0.10), // núcleo magma
    bakePart(sph16, '#4a363a', 0, 0.62, 0.02, 0, 0, 0, 0.22, 0.18, 0.20), // cabeza chibi
    bakePart(sph12, '#ffb703', -0.08, 0.64, 0.20, 0, 0, 0, 0.036, 0.042, 0.025), // ojo L brillante
    bakePart(sph12, '#ffb703', 0.08, 0.64, 0.20, 0, 0, 0, 0.036, 0.042, 0.025), // ojo R brillante
    bakePart(sph12, '#ff7b29', 0, 0.78, 0, 0, 0, 0, 0.12, 0.06, 0.10), // cresta lava
    bakePart(cap12, '#3a2b2e', -0.32, 0.32, 0.06, 0, 0, 0.4, 0.08, 0.13, 0.08), // brazo L
    bakePart(cap12, '#3a2b2e', 0.32, 0.32, 0.06, 0, 0, -0.4, 0.08, 0.13, 0.08), // brazo R
    bakePart(sph12, '#2b1e20', -0.14, 0.08, 0.04, 0, 0, 0, 0.09, 0.08, 0.11), // pie L
    bakePart(sph12, '#2b1e20', 0.14, 0.08, 0.04, 0, 0, 0, 0.09, 0.08, 0.11), // pie R
  ])

  // 3. Salamandra de fuego chibi (alargada, brillante, manchas ígneas)
  const salamander = mergePainted([
    bakePart(cap12, '#261c24', 0, 0.18, 0, Math.PI / 2, 0, 0, 0.13, 0.18, 0.12), // cuerpo
    bakePart(sph12, '#ff6a2b', 0, 0.27, 0.05, 0, 0, 0, 0.06, 0.04, 0.07), // mancha 1
    bakePart(sph12, '#ffb703', 0, 0.27, -0.10, 0, 0, 0, 0.05, 0.04, 0.06), // mancha 2
    bakePart(sph16, '#362632', 0, 0.28, 0.26, 0, 0, 0, 0.16, 0.13, 0.16), // cabeza chibi
    bakePart(sph12, '#ff85a1', -0.10, 0.25, 0.34, 0, 0, 0, 0.035, 0.022, 0.022), // mejilla L
    bakePart(sph12, '#ff85a1', 0.10, 0.25, 0.34, 0, 0, 0, 0.035, 0.022, 0.022), // mejilla R
    bakePart(sph12, '#ffd166', -0.07, 0.32, 0.38, 0, 0, 0, 0.034, 0.04, 0.025), // ojo L
    bakePart(sph12, '#ffd166', 0.07, 0.32, 0.38, 0, 0, 0, 0.034, 0.04, 0.025), // ojo R
    bakePart(sph12, '#ffffff', -0.062, 0.335, 0.40, 0, 0, 0, 0.012, 0.014, 0.01),
    bakePart(sph12, '#ffffff', 0.078, 0.335, 0.40, 0, 0, 0, 0.012, 0.014, 0.01),
    bakePart(cap12, '#ff5a1f', 0, 0.20, -0.32, 0.35, 0, 0, 0.05, 0.16, 0.05), // cola flama
  ])

  // 4. Espíritu herrero chibi (casco minero luminoso y martillo)
  const forger = mergePainted([
    bakePart(sph16, '#5a3228', 0, 0.22, 0, 0, 0, 0, 0.19, 0.19, 0.19), // cuerpo
    bakePart(sph16, '#ffd6b0', 0, 0.46, 0, 0, 0, 0, 0.18, 0.15, 0.17), // cabeza
    bakePart(sph16, '#d97706', 0, 0.56, 0, 0, 0, 0, 0.20, 0.11, 0.20), // casco minero
    bakePart(sph12, '#fff3b0', 0, 0.60, 0.18, 0, 0, 0, 0.055, 0.055, 0.04), // lámpara casco
    bakePart(sph12, '#1d1322', -0.06, 0.47, 0.15, 0, 0, 0, 0.028, 0.034, 0.02),
    bakePart(sph12, '#1d1322', 0.06, 0.47, 0.15, 0, 0, 0, 0.028, 0.034, 0.02),
    bakePart(cap12, '#78716c', 0.24, 0.34, 0.14, 0.4, 0, 0, 0.03, 0.14, 0.03), // mango martillo
    bakePart(cyl16, '#ffb703', 0.24, 0.46, 0.22, 0, 0, Math.PI / 2, 0.07, 0.16, 0.07), // cabeza martillo
  ])

  // 5. Cono volcánico en miniatura con cráter brillante
  const volcano = mergePainted([
    bakePart(cone16, '#2b1e21', 0, 0.38, 0, 0, 0, 0, 0.58, 0.76, 0.58),
    bakePart(tor16, '#442b2e', 0, 0.68, 0, Math.PI / 2, 0, 0, 0.18, 0.18, 0.32),
    bakePart(sph12, '#ff4d1a', 0, 0.70, 0, 0, 0, 0, 0.15, 0.08, 0.15),
  ])

  // 6. Yunque y crisol de forja
  const forge = mergePainted([
    bakePart(cyl16, '#2f272c', 0, 0.14, 0, 0, 0, 0, 0.32, 0.28, 0.26), // pedestal
    bakePart(sph16, '#4a434a', 0, 0.38, 0, 0, 0, 0, 0.38, 0.14, 0.22), // yunque
    bakePart(sph12, '#ff6a2b', 0, 0.49, 0, 0, 0, 0, 0.14, 0.06, 0.10), // lingote al rojo vivo
  ])

  // 7. Cristal de obsidiana / magma suave (puntas redondeadas con cápsulas)
  const crystal = mergePainted([
    bakePart(cap12, '#ff4d1a', 0, 0.36, 0, 0, 0, 0, 0.11, 0.26, 0.11),
    bakePart(cap12, '#ff8a2f', 0.14, 0.26, 0.05, 0.15, 0, -0.35, 0.08, 0.18, 0.08),
    bakePart(cap12, '#ffb703', -0.12, 0.24, -0.06, -0.15, 0, 0.32, 0.075, 0.16, 0.075),
  ])

  // 8. Roca basáltica suave
  const basalt = mergePainted([
    bakePart(sph16, '#2d2023', 0, 0.20, 0, 0, 0, 0, 0.38, 0.22, 0.32),
    bakePart(sph12, '#3d2a2d', 0.15, 0.28, -0.06, 0, 0, 0, 0.22, 0.18, 0.20),
    bakePart(sph12, '#ff4d1a', -0.10, 0.22, 0.12, 0, 0, 0, 0.10, 0.06, 0.10), // veta de magma
  ])

  // 9. Grada volcánica de obsidiana (3 niveles con ribete de lava)
  const stand = mergePainted([
    bakePart(cyl16, '#27191c', 0, 0.08, 0, 0, 0, 0, 0.46, 0.16, 0.95),
    bakePart(cyl16, '#3b2428', -0.10, 0.22, 0, 0, 0, 0, 0.34, 0.16, 0.90),
    bakePart(cyl16, '#4f2f34', -0.20, 0.36, 0, 0, 0, 0, 0.22, 0.16, 0.85),
    bakePart(cap12, '#ff5a1f', -0.26, 0.48, 0, Math.PI / 2, 0, 0, 0.03, 0.72, 0.03),
  ])

  // 10. Farola volcánica de hierro y brasa
  const lamp = mergePainted([
    bakePart(cap12, '#2b1e20', 0, 0.36, 0, 0, 0, 0, 0.035, 0.34, 0.035),
    bakePart(cap12, '#4a2b25', -0.06, 0.72, 0, 0, 0, 0.6, 0.028, 0.12, 0.028),
    bakePart(sph12, '#ff8a2f', -0.14, 0.72, 0, 0, 0, 0, 0.085, 0.095, 0.085),
  ])

  // 11. Valla de pista volcánica
  const fence = mergePainted([
    bakePart(cap12, '#2e2024', 0, 0.14, -0.32, 0, 0, 0, 0.03, 0.12, 0.03),
    bakePart(cap12, '#2e2024', 0, 0.14, 0.32, 0, 0, 0, 0.03, 0.12, 0.03),
    bakePart(cap12, '#ff5a1f', 0, 0.22, 0, Math.PI / 2, 0, 0, 0.026, 0.36, 0.026),
  ])

  // 12. Banderín triangular, meteorito/ceniza, orbe, pilar hexagonal para puente de roca
  const pennant = mergePainted([
    bakePart(cone16, '#ffffff', 0, -0.14, 0, Math.PI, 0, 0, 0.14, 0.28, 0.03),
  ])
  const orb = new THREE.SphereGeometry(1, 14, 10)
  const meteor = mergePainted([
    bakePart(sph12, '#ffe8b3', 0, 0, 0, 0, 0, 0, 0.14, 0.14, 0.32),
    bakePart(cone16, '#ff4d1a', 0, 0, -0.46, -Math.PI / 2, 0, 0, 0.10, 0.56, 0.10),
  ])
  const hexPillar = mergePainted([
    bakePart(cyl6, '#3b2b30', 0, 0, 0, 0, 0, 0, 0.32, 0.55, 0.32),
    bakePart(cyl6, '#ff6a2b', 0, 0.28, 0, 0, 0, 0, 0.26, 0.04, 0.26),
  ])

  GEOS = {
    dragon, golem, salamander, forger, volcano, forge, crystal, basalt,
    stand, lamp, fence, pennant, orb, meteor, hexPillar,
    sph16, sph12, cap12, cyl16, cone16, tor16,
  }
  return GEOS
}

// ═══════════════════════════ TEXTURAS Y MATERIALES CACHEADOS ═══════════════════════════
let MATS = null
function getMats() {
  if (MATS) return MATS

  const curbTex = (() => {
    if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([255, 110, 40, 255]), 1, 1)
    const c = document.createElement('canvas')
    c.width = 512; c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1d1114'
    ctx.fillRect(0, 0, 512, 128)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ff4d1a' : '#ffd166'
      ctx.fillRect(i * 64, 0, 64, 28)
      ctx.fillRect(i * 64, 100, 64, 28)
    }
    ctx.fillStyle = '#ff9f43'
    ctx.font = 'bold 42px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('VOLCÁN · MAGMA', 256, 66)
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
        ctx.fillStyle = (r + k) % 2 === 0 ? '#1b0e12' : '#ff9f1c'
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
      vertexColors: true, roughness: 0.48, metalness: 0.1, emissive: '#421208', emissiveIntensity: 0.28,
    }),
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.82, metalness: 0.08, side: THREE.DoubleSide, emissive: '#4d150a', emissiveIntensity: 0.26,
    }),
    glowLava: new THREE.MeshBasicMaterial({ color: '#ff5a1f', toneMapped: false }),
    glowGold: new THREE.MeshBasicMaterial({ color: '#ffd166', toneMapped: false }),
    glowViolet: new THREE.MeshBasicMaterial({ color: '#c77dff', toneMapped: false }),
    glowWhite: new THREE.MeshBasicMaterial({ color: '#fff3d1', toneMapped: false }),
    obsidian: new THREE.MeshStandardMaterial({ color: '#2b1d21', roughness: 0.35, metalness: 0.45 }),
    bronze: new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.3, metalness: 0.78 }),
    curb: new THREE.MeshStandardMaterial({
      map: curbTex, roughness: 0.5, metalness: 0.15,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    checker: new THREE.MeshBasicMaterial({
      map: checkerTex, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    ash: new THREE.MeshBasicMaterial({
      color: '#ff9e5e', transparent: true, opacity: 0.62, depthWrite: false, toneMapped: false,
    }),
    pennant: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, side: THREE.DoubleSide }),
    beam: new THREE.MeshBasicMaterial({
      color: '#ff6a2b', transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
    magmaFall: new THREE.MeshBasicMaterial({
      color: '#ff4d1a', transparent: true, opacity: 0.76, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    }),
    geyserCol: new THREE.MeshBasicMaterial({
      color: '#ff7b29', transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false,
    }),
  }
  return MATS
}

// ═══════════════════════════ ALTURA DE TERRENO COMPARTIDA ═══════════════════════════
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function volcanoHillHeight(seg, u, a) {
  const bank = smooth(0.50, 0.68, Math.abs(a))
  const fSeed = (seg.i + 1) * 1.43
  const hill = 0.5 + 0.5 * Math.sin(u * seg.length * 0.52 * fSeed + a * 3.1) * Math.cos(u * seg.length * 0.28 - a * 2.1)
  return THREE.MathUtils.clamp(hill, 0, 1) * bank
}

function volcanoSurfaceOffset(seg, u, a) {
  const arc = Math.PI * 0.50
  const edge = 1 - smooth(arc * 0.7, arc, Math.abs(a))
  const gap = laneGap(seg, a)
  const chan = smooth(0.02, 0.32, gap)
  const maxH = Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22)
  const hk = volcanoHillHeight(seg, u, a) * edge * chan
  return seg.radius * 0.015 + hk * maxH
}

function seatOnTerrain(items) {
  for (const it of items) {
    const off = volcanoSurfaceOffset(it.seg, it.u, it.angle)
    const p = placeAlong(it.seg, it.u, off, it.angle)
    it.pos.copy(p.pos)
    it.quat.copy(p.quat)
    it.up.copy(p.up)
    it.side.copy(p.side)
  }
  return items
}

// ═══════════════════════════ CINTAS DE PISTA (BORDILLOS Y METAS) ═══════════════════════════
function buildRibbonGeo(seg, angleCenter, halfArc, offsetFrac, repeatAlong = 0.34) {
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

function buildCheckerStripGeo(seg, uCenter, halfSpanArc = 0.33, widthWorld = 1.1) {
  const frames = segFrames(seg)
  const du = THREE.MathUtils.clamp((widthWorld * 0.5) / Math.max(seg.length, 1), 0.005, 0.06)
  const u0 = THREE.MathUtils.clamp(uCenter - du, 0.005, 0.99)
  const u1 = THREE.MathUtils.clamp(uCenter + du, 0.01, 0.995)
  const nU = 3; const nA = 10
  const pos = new Float32Array((nU + 1) * (nA + 1) * 3)
  const uv = new Float32Array((nU + 1) * (nA + 1) * 2)
  const idx = []
  const dv = new THREE.Vector3()
  const fr = { pos: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3() }
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
  const rSpan = Math.min(seg.radius * 0.42, 0.94)
  const yBase = wallY(seg.radius, rSpan)
  const archH = Math.min(seg.radius * 0.68, 1.44)
  const colH = Math.max(0.4, archH * 0.88 - yBase)
  const emblemRef = useRef()
  useFrame(({ clock }) => {
    if (emblemRef.current) {
      emblemRef.current.rotation.y = clock.elapsedTime * 1.6
      emblemRef.current.rotation.x = Math.sin(clock.elapsedTime * 2.2) * 0.14
    }
  })
  return (
    <group position={pl.pos} quaternion={quat}>
      <mesh geometry={G.cyl16} material={M.obsidian} position={[-rSpan, yBase + colH * 0.5, 0]} scale={[0.12, colH, 0.12]} />
      <mesh geometry={G.cyl16} material={M.obsidian} position={[rSpan, yBase + colH * 0.5, 0]} scale={[0.12, colH, 0.12]} />
      <mesh geometry={G.tor16} material={M.glowLava} position={[0, archH * 0.84, 0]} scale={[rSpan * 0.96, 0.5, 0.5]} />
      <group ref={emblemRef} position={[0, archH * 1.15, 0]}>
        <mesh geometry={G.orb} material={M.glowGold} scale={0.17} />
        <mesh geometry={G.tor16} material={M.glowLava} scale={0.23} />
      </group>
      <Billboard
        text="🌋 BIENVENIDOS"
        style={{ ...ESTILO, sub: wayName, size: 48 }}
        height={0.32}
        position={[0, archH * 0.85, 0.14]}
      />
    </group>
  )
}

// ═══════════════════════════ META CON FUEGOS ARTIFICIALES VOLCÁNICOS ═══════════════════════════
function FinishFireworks({ seg }) {
  const G = getGeos()
  const M = getMats()
  const pl = useMemo(() => placeAlong(seg, 0.86, 0, 0), [seg])
  const quat = useMemo(() => pl.quat.clone().multiply(FLIP_Y), [pl])
  const archW = Math.min(seg.radius * 0.42, 0.92)
  const yBase = wallY(seg.radius, archW)
  const archH = Math.min(seg.radius * 0.66, 1.38)
  const colH = Math.max(0.4, archH * 0.86 - yBase)

  const sparksRef = useRef()
  const N = 30
  const dirs = useMemo(() => {
    const rng = mulberry32(seg.i * 977 + 13)
    return Array.from({ length: N }, (_, i) => {
      const a = (i / N) * TAU + rng() * 0.3
      const r = 0.4 + rng() * 0.72
      return {
        vx: Math.cos(a) * r, vy: 0.35 + Math.sin(a) * r * 0.75, vz: (rng() - 0.5) * 0.6,
        phase: rng() * TAU, col: ['#ff4d1a', '#ffd166', '#ff9f1c', '#c77dff'][i % 4],
      }
    })
  }, [seg.i])
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
    burst.current = THREE.MathUtils.damp(burst.current, hit ? 1 : 0.18, hit ? 10 : 1.8, Math.min(dt, 0.1))
    const t = clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const d = dirs[i]
      const cyc = ((t * 1.5 + d.phase) % 1.4) / 1.4
      const amp = burst.current * seg.radius * 0.44 * cyc
      _tmpV.set(d.vx * amp, archH * 0.85 + d.vy * amp - cyc * cyc * 0.25, d.vz * amp)
      const sc = Math.max(0.005, (1 - cyc) * 0.088 * (0.35 + burst.current * 0.95))
      _tmpS.setScalar(sc)
      _tmpM.compose(_tmpV, IDENT_Q, _tmpS)
      mesh.setMatrixAt(i, _tmpM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group position={pl.pos} quaternion={quat}>
      <mesh geometry={G.cyl16} material={M.obsidian} position={[-archW, yBase + colH * 0.5, 0]} scale={[0.1, colH, 0.1]} />
      <mesh geometry={G.cyl16} material={M.obsidian} position={[archW, yBase + colH * 0.5, 0]} scale={[0.1, colH, 0.1]} />
      <mesh geometry={G.tor16} material={M.glowGold} position={[0, archH * 0.84, 0]} scale={[archW * 0.94, 0.46, 0.46]} />
      <Billboard text="🏁 META DEL VOLCÁN" style={ESTILO_META} height={0.28} position={[0, archH * 0.94, 0.12]} />
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
                { u: 0.26, from: 0, to: 0, kind: seg.kind, duration: 0.8, _synthAngle: (seg.i % 2 === 0 ? 1 : -1) * 1.24 },
                { u: 0.64, from: 0, to: 0, kind: seg.event || seg.kind, duration: 0.8, _synthAngle: (seg.i % 2 === 0 ? -1 : 1) * 1.48 },
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
        const mid = fOut.pos.clone().addScaledVector(fOut.up, 0.24)
        out.push({ seg, uIn, kind: sw.kind, fIn, fOut, qIn, qOut, mid })
      }
    }
    return out
  }, [way])

  const padsRef = useRef()
  const ringsRef = useRef()
  const jetsRef = useRef()

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
      const spin = 2.0 + act * 7.5
      if (padsRef.current) {
        _tmpV.copy(m.fIn.pos).addScaledVector(m.fIn.up, 0.04)
        _tmpS.set(0.32, 0.06 + act * 0.08, 0.32)
        _tmpM.compose(_tmpV, m.qIn, _tmpS)
        padsRef.current.setMatrixAt(i, _tmpM)
      }
      if (ringsRef.current) {
        _tmpQ.copy(m.qOut)
        _tmpQ2.setFromAxisAngle(Z, t * spin * (i % 2 === 0 ? 1 : -1))
        _tmpQ.multiply(_tmpQ2)
        _tmpS.setScalar(0.26 + act * 0.14)
        _tmpM.compose(m.mid, _tmpQ, _tmpS)
        ringsRef.current.setMatrixAt(i, _tmpM)
      }
      if (jetsRef.current) {
        _tmpV.copy(m.fOut.pos).addScaledVector(m.fOut.up, 0.05)
        _tmpS.set(0.24 + act * 0.08, 0.05, 0.24 + act * 0.08)
        _tmpM.compose(_tmpV, m.qOut, _tmpS)
        jetsRef.current.setMatrixAt(i, _tmpM)
      }
    }
    if (padsRef.current) padsRef.current.instanceMatrix.needsUpdate = true
    if (ringsRef.current) ringsRef.current.instanceMatrix.needsUpdate = true
    if (jetsRef.current) jetsRef.current.instanceMatrix.needsUpdate = true
  })

  if (!mechanisms.length) return null
  return (
    <group>
      <instancedMesh ref={padsRef} args={[G.cyl16, M.bronze, mechanisms.length]} frustumCulled={false} />
      <instancedMesh ref={ringsRef} args={[G.tor16, M.glowLava, mechanisms.length]} frustumCulled={false} />
      <instancedMesh ref={jetsRef} args={[G.cap12, M.glowGold, mechanisms.length]} frustumCulled={false} />
    </group>
  )
}

// ═══════════════════════════ EVENTOS PERSONALIZADOS POR RUTA ═══════════════════════════
// Ruta A (rápida): Forja de Acero con Martillos Gigantes & Erupción Catapulta
function VolcanoForgeEvent({ seg }) {
  const G = getGeos()
  const M = getMats()
  return (
    <EventStage
      segment={seg}
      render={(stage) => <VolcanoForgeStage seg={seg} stage={stage} G={G} M={M} />}
    />
  )
}

function VolcanoForgeStage({ seg, stage, G, M }) {
  const hammerRefs = useRef([])
  const shockRefs = useRef([])
  const stations = useMemo(() => [0.24, 0.50, 0.76].map((u) => placeAlong(seg, u, 0, 0)), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const inten = stage.intensity
    const beat = Math.pow(Math.abs(Math.sin(t * (2.6 + inten * 5.0))), 3)
    for (let i = 0; i < stations.length; i++) {
      const hm = hammerRefs.current[i]
      if (hm) {
        const phaseBeat = Math.sin(t * (3.2 + inten * 5.5) + i * 1.2)
        hm.rotation.z = -0.35 + Math.max(0, phaseBeat) * 0.75
      }
      const sh = shockRefs.current[i]
      if (sh) {
        const sc = (0.42 + beat * 0.28 + inten * 0.22) * (seg.radius * 0.36)
        sh.scale.setScalar(sc)
        sh.rotation.z = t * (2 + inten * 5)
      }
    }
  })

  const rArm = Math.min(seg.radius * 0.4, 0.9)
  const yBase = wallY(seg.radius, rArm)
  return (
    <group>
      {stations.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.quat}>
          <mesh geometry={G.forge} material={M.clay} position={[-rArm * 0.85, yBase, 0]} scale={0.66} />
          <mesh geometry={G.forge} material={M.clay} position={[rArm * 0.85, yBase, 0]} scale={0.66} />
          <group ref={(el) => { hammerRefs.current[i] = el }} position={[-rArm * 0.85, yBase + 0.68, 0]}>
            <mesh geometry={G.cap12} material={M.obsidian} position={[0.16, 0.14, 0]} rotation={[0, 0, -0.5]} scale={[0.04, 0.24, 0.04]} />
            <mesh geometry={G.cyl16} material={M.glowGold} position={[0.3, 0.24, 0]} rotation={[0, 0, Math.PI / 2]} scale={[0.085, 0.22, 0.085]} />
          </group>
          <mesh ref={(el) => { shockRefs.current[i] = el }} geometry={G.tor16} material={M.glowLava} position={[0, seg.radius * 0.56, 0]} />
        </group>
      ))}
    </group>
  )
}

// Ruta B (lenta): Puente de Roca Basáltico + Géiseres con Ritmo Musical Visual + Cascada de Magma
function VolcanoMusicalGeyserEvent({ seg }) {
  const G = getGeos()
  const M = getMats()
  return (
    <EventStage
      segment={seg}
      render={(stage) => <VolcanoMusicalGeyserStage seg={seg} stage={stage} G={G} M={M} />}
    />
  )
}

function VolcanoMusicalGeyserStage({ seg, stage, G, M }) {
  const bridgeRefs = useRef([])
  const geyserRefs = useRef([])
  const magmaMat = useMemo(() => M.magmaFall.clone(), [M])
  const bridgePls = useMemo(() => [0.22, 0.34, 0.46, 0.58, 0.70, 0.82].map((u) => placeAlong(seg, u, 0, 0)), [seg])
  const geyserPls = useMemo(() => [0.24, 0.38, 0.52, 0.66, 0.80].map((u, i) => placeAlong(seg, u, 0.02, (i % 2 === 0 ? 1 : -1) * 0.74)), [seg])
  const fallPl = useMemo(() => placeAlong(seg, 0.52, 0, 0), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.35 + stage.k * 0.65 : stage.intensity

    // Puente de roca hexagonal que emerge suavemente para recibir la bollita
    for (let i = 0; i < bridgeRefs.current.length; i++) {
      const br = bridgeRefs.current[i]
      if (!br) continue
      const rise = THREE.MathUtils.clamp(active * 1.4 - i * 0.1, 0, 1)
      br.position.y = THREE.MathUtils.lerp(-0.22, 0.02, rise)
    }

    // Géiseres con ritmo musical visual (ondas armónicas)
    for (let i = 0; i < geyserRefs.current.length; i++) {
      const gy = geyserRefs.current[i]
      if (!gy) continue
      const chord = 0.5 + 0.5 * Math.sin(t * (3.0 + active * 2.5) - i * 0.85)
      const h = (0.28 + chord * (0.45 + active * 0.55)) * 0.85
      gy.scale.set(0.14 + chord * 0.06, h, 0.14 + chord * 0.06)
      gy.position.y = h * 0.5
    }

    // Cascada de magma cambia de tono térmico (carmín -> ámbar -> violeta)
    const hue = 0.03 + active * 0.75 * 0.18 + Math.sin(t * 0.8) * 0.04
    magmaMat.color.setHSL((hue + 1) % 1, 0.92, 0.54)
  })

  return (
    <group>
      {bridgePls.map((p, i) => (
        <group key={`b-${i}`} position={p.pos} quaternion={p.quat}>
          <mesh ref={(el) => { bridgeRefs.current[i] = el }} geometry={G.hexPillar} material={M.clay} scale={[0.85, 0.25, 0.85]} />
        </group>
      ))}
      {geyserPls.map((p, i) => (
        <group key={`g-${i}`} position={p.pos} quaternion={p.quat}>
          <mesh ref={(el) => { geyserRefs.current[i] = el }} geometry={G.cap12} material={M.geyserCol} />
        </group>
      ))}
      <group position={fallPl.pos} quaternion={fallPl.quat}>
        <mesh geometry={G.cyl16} material={magmaMat} position={[-0.74, wallY(seg.radius, 0.74) + 0.36, 0]} rotation={[0, 0, -0.35]} scale={[0.2, 0.78, 0.84]} />
        <mesh geometry={G.cyl16} material={magmaMat} position={[0.74, wallY(seg.radius, 0.74) + 0.36, 0]} rotation={[0, 0, 0.35]} scale={[0.2, 0.78, 0.84]} />
      </group>
    </group>
  )
}

// Ruta C (espectacular / media): Arena del Dragón, Aros de Fuego Coreografiados & Puertas Volcánicas
function VolcanoDragonArenaEvent({ seg }) {
  const G = getGeos()
  const M = getMats()
  return (
    <EventStage
      segment={seg}
      render={(stage) => <VolcanoDragonArenaStage seg={seg} stage={stage} G={G} M={M} />}
    />
  )
}

function VolcanoDragonArenaStage({ seg, stage, G, M }) {
  const gateL = useRef()
  const gateR = useRef()
  const hoopRefs = useRef([])
  const spotRefs = useRef([])
  const gatePl = useMemo(() => placeAlong(seg, 0.18, 0, 0), [seg])
  const hoops = useMemo(() => [0.34, 0.50, 0.66, 0.82].map((u) => placeAlong(seg, u, 0, 0)), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const open = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.35 + stage.k * 0.6 : stage.intensity
    const slide = 0.24 + open * 0.44
    if (gateL.current) gateL.current.position.x = -slide
    if (gateR.current) gateR.current.position.x = slide

    for (let i = 0; i < hoops.length; i++) {
      const hp = hoopRefs.current[i]
      if (hp) {
        const hit = stage.phase === 'climax' ? Math.max(0, 1 - Math.abs(stage.k - (0.34 + i * 0.16)) * 5) : 0
        const sc = (0.58 + open * 0.18 + hit * 0.28) * (seg.radius * 0.38)
        hp.scale.setScalar(sc)
        hp.rotation.z = t * (1.8 + open * 4.5) * (i % 2 === 0 ? 1 : -1)
      }
      const sp = spotRefs.current[i]
      if (sp) sp.rotation.z = Math.sin(t * 3 + i) * (0.3 + open * 0.4)
    }
  })

  return (
    <group>
      {/* Puertas del dragón que se abren al entrar */}
      <group position={gatePl.pos} quaternion={gatePl.quat}>
        <mesh ref={gateL} geometry={G.volcano} material={M.clay} position={[-0.28, 0.12, 0]} scale={0.76} />
        <mesh ref={gateR} geometry={G.volcano} material={M.clay} position={[0.28, 0.12, 0]} scale={0.76} />
      </group>
      {/* Aros de fuego coreografiados + focos de arena */}
      {hoops.map((p, i) => (
        <group key={i} position={p.pos} quaternion={p.quat}>
          <mesh ref={(el) => { hoopRefs.current[i] = el }} geometry={G.tor16} material={i % 2 === 0 ? M.glowLava : M.glowGold} position={[0, seg.radius * 0.45, 0]} />
          <group ref={(el) => { spotRefs.current[i] = el }} position={[0, seg.radius * 0.72, 0]}>
            <mesh geometry={G.cone16} material={M.beam} position={[-0.6, -0.3, 0]} rotation={[0, 0, -0.35]} scale={[0.24, 0.68, 0.24]} />
            <mesh geometry={G.cone16} material={M.beam} position={[0.6, -0.3, 0]} rotation={[0, 0, 0.35]} scale={[0.24, 0.68, 0.24]} />
          </group>
        </group>
      ))}
    </group>
  )
}

// Anillos de erupción alrededor de tramos en el aire (erupcion, canon, geiser, caida)
function VolcanoAirRings({ way }) {
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
        out.push({ pos: p, quat: q, scale: seg.radius * 0.76 })
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
      _tmpQ2.setFromAxisAngle(Z, -t * 2.8 + i * 0.7)
      _tmpQ.multiply(_tmpQ2)
      _tmpS.setScalar(r.scale * (1 + Math.sin(t * 4 + i) * 0.1))
      _tmpM.compose(r.pos, _tmpQ, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })
  if (!rings.length) return null
  return <instancedMesh ref={meshRef} args={[G.tor16, M.glowLava, rings.length]} frustumCulled={false} />
}

// ═══════════════════════════ CRIATURAS ESPECIALES ANIMADAS ═══════════════════════════
// Dragones pequeños chibi volando por la bóveda superior
function SkyDragons({ way }) {
  const G = getGeos()
  const M = getMats()
  const path = useMemo(() => segPath(way.segments), [way])
  const count = 12
  const state = useMemo(() => {
    const rng = mulberry32(way.idx * 347 + 53)
    return Array.from({ length: count }, (_, i) => ({
      s: (i / count + rng() * 0.05) * path.total,
      dir: i % 2 === 0 ? 1 : -1,
      speed: 1.8 + rng() * 1.4,
      ph: rng() * TAU,
      angleBase: (i % 2 === 0 ? 1 : -1) * (2.15 + rng() * 0.65),
    }))
  }, [path, way.idx])
  const meshRef = useRef()
  const loc = useMemo(() => ({}), [])

  useFrame(({ clock }, dt) => {
    const mesh = meshRef.current
    if (!mesh || !path.total) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBollitas()
    for (let i = 0; i < count; i++) {
      const d = state[i]
      let boost = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = path.arcOf(b.seg, b.segT ?? 0)
        if (arc != null && Math.abs(arc - d.s) < 5) boost = Math.max(boost, 1 - Math.abs(arc - d.s) / 5)
      }
      d.s += d.dir * d.speed * (1 + boost * 1.5) * h
      if (d.s > path.total) { d.s = path.total; d.dir = -1 }
      if (d.s < 0) { d.s = 0; d.dir = 1 }
      path.locate(d.s, loc)
      const a = d.angleBase + Math.sin(t * 1.4 + d.ph) * 0.3
      const off = 0.34 + Math.sin(t * (3.5 + boost * 5) + d.ph) * 0.12
      placeAlongInto(loc.seg, loc.u, off, a, _tmpPl)
      _tmpQ.copy(_tmpPl.quat)
      if (d.dir < 0) _tmpQ.multiply(FLIP_Y)
      _tmpQ2.setFromAxisAngle(Z, Math.sin(t * 2.5 + d.ph) * 0.24)
      _tmpQ.multiply(_tmpQ2)
      _tmpS.set(0.24, 0.24 * (1 + Math.sin(t * 10 + d.ph) * 0.14), 0.24)
      _tmpM.compose(_tmpPl.pos, _tmpQ, _tmpS)
      mesh.setMatrixAt(i, _tmpM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  if (!path.total) return null
  return <instancedMesh ref={meshRef} args={[G.dragon, M.clay, count]} frustumCulled={false} />
}

// Gradas con golems que hacen ola + durmientes termales + chispas perseguidas por salamandras
function VolcanoCrowdAndBehavior({ way, standItems }) {
  const G = getGeos()
  const M = getMats()

  const crowd = useMemo(() => {
    const rng = mulberry32(way.idx * 733 + 29)
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

  const sleepers = useMemo(() => {
    const slowSegs = way.segments.filter((s) => !s.air && (s.speedK < 1.0 || way.routes[s.route]?.profile?.speed === 'lenta'))
    return seatOnTerrain(scatter(way, 12, mulberry32(way.idx * 521 + 17), {
      segments: slowSegs.length ? slowSegs : undefined,
      angle: [-0.92, 0.92], clear: BALL_R * 0.85, offset: [0.03, 0.07], scale: [0.20, 0.24],
    }))
  }, [way])

  const emberWisps = useMemo(() => scatter(way, 30, mulberry32(way.idx * 859 + 11), {
    angle: [-1.45, 1.45], clear: BALL_R * 0.55, offset: [0.22, 0.62], scale: [0.05, 0.085],
  }), [way])

  const crowdRef = useRef()
  const sleepRef = useRef()
  const wispRef = useRef()

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBollitas()

    if (crowdRef.current && crowd.length) {
      for (let i = 0; i < crowd.length; i++) {
        const fan = crowd[i]
        let wave = 0
        for (let k = 0; k < bolls.length; k++) {
          const b = bolls[k]
          if (b.phase === 'travel' && b.seg === fan.seg) {
            const d = Math.abs((b.segT ?? 0) - fan.u)
            if (d < 0.22) wave = Math.max(wave, (1 - d / 0.22) * (0.65 + (b.speed ?? 12) * 0.03))
          }
        }
        const hop = Math.abs(Math.sin(t * (4.5 + wave * 8.5) + fan.ph)) * (0.02 + wave * 0.12)
        _tmpV.copy(fan.pos).addScaledVector(fan.up, hop)
        _tmpS.setScalar(fan.sc * (1 + wave * 0.22))
        _tmpM.compose(_tmpV, fan.quat, _tmpS)
        crowdRef.current.setMatrixAt(i, _tmpM)
      }
      crowdRef.current.instanceMatrix.needsUpdate = true
    }

    if (sleepRef.current && sleepers.length) {
      for (let i = 0; i < sleepers.length; i++) {
        const sl = sleepers[i]
        let awake = 0
        for (let k = 0; k < bolls.length; k++) {
          const b = bolls[k]
          if (b.phase === 'travel' && b.seg === sl.seg && Math.abs((b.segT ?? 0) - sl.u) < 0.14) awake = 1
        }
        const breath = 1 + Math.sin(t * (awake ? 9 : 1.7) + sl.rnd * TAU) * (awake ? 0.18 : 0.06)
        _tmpV.copy(sl.pos).addScaledVector(sl.up, awake * Math.abs(Math.sin(t * 8)) * 0.14)
        _tmpS.set(sl.scale, sl.scale * breath, sl.scale)
        _tmpM.compose(_tmpV, sl.quat, _tmpS)
        sleepRef.current.setMatrixAt(i, _tmpM)
      }
      sleepRef.current.instanceMatrix.needsUpdate = true
    }

    if (wispRef.current && emberWisps.length) {
      for (let i = 0; i < emberWisps.length; i++) {
        const w = emberWisps[i]
        const orb = t * 2.3 + w.rnd * TAU
        _tmpV.copy(w.pos)
          .addScaledVector(w.side, Math.cos(orb) * 0.16)
          .addScaledVector(w.up, Math.sin(orb * 1.7) * 0.14)
        _tmpS.setScalar(w.scale * (0.8 + Math.sin(t * 7 + i) * 0.25))
        _tmpM.compose(_tmpV, IDENT_Q, _tmpS)
        wispRef.current.setMatrixAt(i, _tmpM)
      }
      wispRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {crowd.length > 0 && <instancedMesh ref={crowdRef} args={[G.golem, M.clay, crowd.length]} frustumCulled={false} />}
      {sleepers.length > 0 && <instancedMesh ref={sleepRef} args={[G.golem, M.clay, sleepers.length]} frustumCulled={false} />}
      {emberWisps.length > 0 && <instancedMesh ref={wispRef} args={[G.orb, M.glowGold, emberWisps.length]} frustumCulled={false} />}
    </group>
  )
}

// ═══════════════════════════ CIELO INTERIOR, ECLIPSE Y CENIZAS ═══════════════════════════
function VolcanoSkyPhenomena({ way, detail }) {
  const G = getGeos()
  const M = getMats()
  const path = useMemo(() => segPath(way.segments), [way])
  const skyGeos = useMemo(() => {
    return way.segments.filter((s) => !s.air).map((seg) => {
      const rt = way.routes[seg.route]
      const sp = rt?.profile?.speed
      const colors = sp === 'rapida' ? ['#6b1f14', '#160914'] : sp === 'lenta' ? ['#5a2420', '#181026'] : ['#7a2614', '#1c0b1a']
      return { key: seg.i, geo: buildSkyGeo(seg, { radial: 28, colors }) }
    })
  }, [way])

  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.FrontSide, transparent: true, opacity: 0.25, depthWrite: false, fog: false,
  }), [])

  const redMoons = useMemo(() => scatter(way, 10, mulberry32(way.idx * 431 + 7), {
    angle: [Math.PI * 0.82, Math.PI * 1.18], clear: 0, offset: [0.18, 0.26], scale: [0.16, 0.25],
  }), [way])
  const emberStars = useMemo(() => scatter(way, 70, mulberry32(way.idx * 467 + 13), {
    angle: [Math.PI * 0.62, Math.PI * 1.38], clear: 0, offset: [0.1, 0.2], scale: [0.028, 0.052],
  }), [way])

  const meteorsN = 24
  const meteors = useMemo(() => {
    const rng = mulberry32(way.idx * 631 + 17)
    return Array.from({ length: meteorsN }, () => ({
      s0: rng() * Math.max(1, path.total),
      speed: 9 + rng() * 13,
      angle: Math.PI + (rng() - 0.5) * 0.9,
      ph: rng() * TAU,
      sc: 0.16 + rng() * 0.14,
    }))
  }, [path, way.idx])

  const ashN = 56
  const ash = useMemo(() => {
    const rng = mulberry32(way.idx * 919 + 29)
    return Array.from({ length: ashN }, () => ({
      s: rng() * Math.max(1, path.total),
      angle: (rng() - 0.5) * 2.4,
      off: 0.12 + rng() * 0.9,
      ph: rng() * TAU,
      sc: 0.04 + rng() * 0.05,
    }))
  }, [path, way.idx])

  const meteorRef = useRef()
  const ashRef = useRef()
  const loc = useMemo(() => ({}), [])

  useFrame(({ clock }, dt) => {
    const det = detail?.value ?? 0
    skyMat.opacity = THREE.MathUtils.lerp(0.22, 0.58, det)

    if (!path.total) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBollitas()
    let maxSpd = 10
    for (let k = 0; k < bolls.length; k++) {
      if (bolls[k].way === way && (bolls[k].speed ?? 0) > maxSpd) maxSpd = bolls[k].speed
    }
    const spdFactor = THREE.MathUtils.clamp(maxSpd / 18, 0.6, 2.5)

    if (meteorRef.current) {
      for (let i = 0; i < meteorsN; i++) {
        const m = meteors[i]
        const s = (m.s0 + t * m.speed) % path.total
        path.locate(s, loc)
        const a = m.angle + Math.sin(t * 0.8 + m.ph) * 0.16
        placeAlongInto(loc.seg, loc.u, 0.18, a, _tmpPl)
        _tmpS.setScalar(m.sc)
        _tmpM.compose(_tmpPl.pos, _tmpPl.quat, _tmpS)
        meteorRef.current.setMatrixAt(i, _tmpM)
      }
      meteorRef.current.instanceMatrix.needsUpdate = true
    }

    if (ashRef.current) {
      for (let i = 0; i < ashN; i++) {
        const d = ash[i]
        d.s = (d.s + h * (4.8 * spdFactor)) % path.total
        path.locate(d.s, loc)
        const rise = d.off + Math.sin(t * 2.2 * spdFactor + d.ph) * 0.25
        placeAlongInto(loc.seg, loc.u, THREE.MathUtils.clamp(rise, 0.08, 1.05), d.angle + Math.sin(t * 1.8 + d.ph) * 0.3, _tmpPl)
        _tmpS.setScalar(d.sc * (0.85 + spdFactor * 0.3))
        _tmpM.compose(_tmpPl.pos, IDENT_Q, _tmpS)
        ashRef.current.setMatrixAt(i, _tmpM)
      }
      ashRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {skyGeos.map(({ key, geo }) => <mesh key={key} geometry={geo} material={skyMat} />)}
      <Instanced geo={G.orb} mat={M.glowLava} items={redMoons} />
      <Instanced geo={G.orb} mat={M.glowGold} items={emberStars} />
      {path.total > 0 && <instancedMesh ref={meteorRef} args={[G.meteor, M.glowWhite, meteorsN]} frustumCulled={false} />}
      {path.total > 0 && <instancedMesh ref={ashRef} args={[G.orb, M.ash, ashN]} frustumCulled={false} />}
    </group>
  )
}

// ═══════════════════════════ CRISTALES REACTIVOS A LA BOLLITA ═══════════════════════════
function ReactiveMagmaCrystals({ way }) {
  const G = getGeos()
  const beacons = useMemo(() => scatter(way, 38, mulberry32(way.idx * 899 + 41), {
    angle: [-0.95, 0.95], clear: BALL_R * 0.72, offset: [0.42, 0.62], scale: [0.09, 0.14],
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
      if (nearB) _tmpC.setHSL(nearB.genome.hue, 0.88, 0.62)
      else _tmpC.set('#ff6a2b')
      m.setColorAt(i, _tmpC)
      const sc = bcn.scale * (1 + nearK * 0.75 + Math.sin(t * 3.8 + i) * 0.14)
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

  const trackParts = useMemo(() => {
    const terrains = []; const curbs = []; const checkers = []
    for (const si of info.segments) {
      const seg = si.seg
      if (seg.air) continue
      const rt = info.routes[si.route]
      const sp = rt?.profile?.speed
      const colors = sp === 'rapida'
        ? ['#2a1a1c', '#ff5a1f']
        : sp === 'lenta'
          ? ['#29202a', '#d97706']
          : ['#26181c', '#ff7a2f']

      const maxH = Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22)
      terrains.push(
        buildTerrainGeo(seg, {
          arc: Math.PI * 0.50,
          maxH,
          radial: 52,
          along: Math.ceil(seg.length * 3.0),
          colors,
          height: (u, a) => volcanoHillHeight(seg, u, a),
        }),
      )

      curbs.push(buildRibbonGeo(seg, -0.45, 0.055, 0.059, 0.32))
      curbs.push(buildRibbonGeo(seg, 0.45, 0.055, 0.059, 0.32))

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

  const props = useMemo(() => {
    const rng = mulberry32(way.idx * 2063 + 57)
    const solid = info.segments.filter((s) => !s.air).map((s) => s.seg)
    const fastSegs = info.segments.filter((s) => !s.air && info.routes[s.route]?.profile?.speed === 'rapida').map((s) => s.seg)
    const slowSegs = info.segments.filter((s) => !s.air && info.routes[s.route]?.profile?.speed === 'lenta').map((s) => s.seg)

    const volcanoes = seatOnTerrain(scatter(way, 42, rng, {
      angle: [-1.32, 1.32], clear: BALL_R * 0.88, offset: [0.02, 0.06], scale: [0.46, 0.82],
    }))
    const crystals = seatOnTerrain(scatter(way, 90, rng, {
      angle: [-1.25, 1.25], clear: BALL_R * 0.7, offset: [0.02, 0.06], scale: [0.40, 0.74],
    }))
    const forges = seatOnTerrain(scatter(way, 30, rng, {
      segments: fastSegs.length ? fastSegs : solid,
      angle: [-1.1, 1.1], clear: BALL_R * 0.85, offset: [0.02, 0.05], scale: [0.42, 0.70],
    }))
    const basalts = seatOnTerrain(scatter(way, 95, rng, {
      angle: [-1.35, 1.35], clear: BALL_R * 0.68, offset: [0.0, 0.05], scale: [0.32, 0.60],
    }))
    const forgers = seatOnTerrain(scatter(way, 20, rng, {
      segments: slowSegs.length ? slowSegs : solid,
      angle: [-1.05, 1.05], clear: BALL_R * 0.78, offset: [0.04, 0.08], scale: [0.24, 0.30],
    }))

    const stands = []
    for (const seg of solid) {
      const nSt = Math.max(1, Math.floor(seg.length / 20))
      for (let i = 0; i < nSt; i++) {
        const u = (i + 0.5) / nSt
        const side = (i + seg.i) % 2 === 0 ? 1 : -1
        const angle = side * 0.78
        if (laneGap(seg, angle) > BALL_R * 0.45 / Math.max(seg.radius, 1)) {
          const off = volcanoSurfaceOffset(seg, u, angle)
          const p = placeAlong(seg, u, off, angle)
          const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? Math.PI : 0))
          stands.push({ seg, u, angle, off, pos: p.pos, quat: q, scale: [0.76, 0.76, 0.88] })
        }
      }
    }

    const lamps = []; const fences = []; const pennants = []; const screens = []
    const penCols = ['#ff4d1a', '#ffd166', '#c77dff', '#ff8a2f']
    for (const seg of solid) {
      const rt = info.routes[seg.route]
      const sp = rt?.profile?.speed
      const lampStep = sp === 'rapida' ? 8 : 6.5
      const nL = Math.max(2, Math.floor(seg.length / lampStep))
      for (let i = 0; i < nL; i++) {
        const u = (i + 0.35) / nL
        const side = i % 2 === 0 ? 1 : -1
        const p = placeAlong(seg, u, volcanoSurfaceOffset(seg, u, side * 0.54), side * 0.54)
        const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? 0 : Math.PI))
        lamps.push({ pos: p.pos, quat: q, scale: 0.48 })
        const fp = placeAlong(seg, u, volcanoSurfaceOffset(seg, u, -side * 0.52), -side * 0.52)
        fences.push({ pos: fp.pos, quat: fp.quat, scale: 0.72 })
      }
      const nP = Math.max(3, Math.floor(seg.length / 5))
      for (let i = 0; i < nP; i++) {
        const u = (i + 0.5) / nP
        const ang = (i % 2 === 0 ? 1 : -1) * (1.28 + (i % 3) * 0.14)
        const p = placeAlong(seg, u, 0.22, ang)
        pennants.push({ pos: p.pos, quat: p.quat, scale: 0.68, color: penCols[(i + seg.i) % penCols.length] })
      }
      if (seg.length > 16) {
        const u = 0.5
        const ang = seg.i % 2 === 0 ? -0.95 : 0.95
        const p = placeAlong(seg, u, 0.54, ang)
        const q = p.quat.clone().multiply(FLIP_Y)
        const label = sp === 'rapida' ? '⚒ FORJA TURBO' : sp === 'lenta' ? '♨ TERMAS MAGMA' : '🐉 COPA CALDERA'
        screens.push({ key: seg.i, pos: p.pos, quat: q, text: label, sub: seg.name })
      }
    }

    const horizon = scatter(way, 34, rng, {
      angle: [1.38, 1.72], clear: 0, offset: [0.02, 0.05], scale: [0.32, 0.55],
    }).concat(scatter(way, 34, rng, {
      angle: [-1.72, -1.38], clear: 0, offset: [0.02, 0.05], scale: [0.32, 0.55],
    }))

    return { volcanoes, crystals, forges, basalts, forgers, stands, lamps, fences, pennants, screens, horizon }
  }, [way, info])

  // Coreografías distintas por ruta A (forja), B (géiser musical + puente roca), C (arena del dragón)
  const eventEls = useMemo(() => {
    const out = []
    for (const si of info.events) {
      if (si.route === 0) out.push(<VolcanoForgeEvent key={si.i} seg={si.seg} />)
      else if (si.route === 1) out.push(<VolcanoMusicalGeyserEvent key={si.i} seg={si.seg} />)
      else out.push(<VolcanoDragonArenaEvent key={si.i} seg={si.seg} />)
    }
    for (const rt of info.routes) {
      const extra = rt.segments.find((s) => !s.air && !s.event && s.route >= 0 && s.seg !== rt.segments[1]?.seg)
      if (extra) {
        if (rt.r === 0) out.push(<VolcanoForgeEvent key={`x-${extra.i}`} seg={extra.seg} />)
        else if (rt.r === 1) out.push(<VolcanoMusicalGeyserEvent key={`x-${extra.i}`} seg={extra.seg} />)
        else out.push(<VolcanoDragonArenaEvent key={`x-${extra.i}`} seg={extra.seg} />)
      }
    }
    return out
  }, [info])

  const salidaSeg = info.shared.find((s) => s.kind === 'salida')?.seg
  const llegadaSeg = info.shared.find((s) => s.kind === 'llegada')?.seg
  const route0Segs = useMemo(() => info.routes[0]?.segments.map((s) => s.seg), [info])
  const route1Segs = useMemo(() => info.routes[1]?.segments.map((s) => s.seg), [info])
  const route2Segs = useMemo(() => info.routes[2]?.segments.map((s) => s.seg), [info])

  return (
    <group name="vida-volcan">
      {trackParts.terrain && <mesh geometry={trackParts.terrain} material={M.terrain} receiveShadow />}
      {trackParts.curb && <mesh geometry={trackParts.curb} material={M.curb} />}
      {trackParts.checker && <mesh geometry={trackParts.checker} material={M.checker} />}
      <VolcanoSkyPhenomena way={way} detail={detail} />

      {salidaSeg && <WelcomePortico seg={salidaSeg} wayName={way.theme.name} />}
      {llegadaSeg && <FinishFireworks seg={llegadaSeg} />}
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#3b2620" angle={0.92} height={0.32} />

      {props.screens.map((sc) => (
        <Billboard key={sc.key} text={sc.text} style={{ ...ESTILO_PANTALLA, sub: sc.sub }} height={0.28} position={sc.pos} quat={sc.quat} glow={1.28} />
      ))}

      <Instanced geo={G.volcano} mat={M.clay} items={props.volcanoes} />
      <Instanced geo={G.crystal} mat={M.clay} items={props.crystals} />
      <Instanced geo={G.forge} mat={M.clay} items={props.forges} />
      <Instanced geo={G.basalt} mat={M.clay} items={props.basalts} />
      <Instanced geo={G.forger} mat={M.clay} items={props.forgers} />
      <Instanced geo={G.stand} mat={M.clay} items={props.stands} />
      <Instanced geo={G.lamp} mat={M.clay} items={props.lamps} />
      <Instanced geo={G.fence} mat={M.clay} items={props.fences} />
      <Instanced geo={G.pennant} mat={M.pennant} items={props.pennants} />
      <Instanced geo={G.volcano} mat={M.clay} items={props.horizon} />

      <LaneSwitchMechanisms way={way} />

      {eventEls}
      <VolcanoAirRings way={way} />

      <Critter way={way} segments={route0Segs} count={16} geo={G.golem} mat={M.clay} scale={0.23} speed={0.8} offset={0.22} angle={0.62} spread={0.14} hop={0.28} seed={101} />
      <Critter way={way} segments={route1Segs ?? route0Segs} count={16} geo={G.salamander} mat={M.clay} scale={0.21} speed={0.95} offset={0.20} angle={-0.60} spread={0.14} hop={0.32} seed={202} />
      <Critter way={way} segments={route2Segs ?? route0Segs} count={16} geo={G.dragon} mat={M.clay} scale={0.23} speed={1.1} offset={0.20} angle={0.56} spread={0.14} hop={0.35} seed={303} />
      <SkyDragons way={way} />
      <VolcanoCrowdAndBehavior way={way} standItems={props.stands} />
      <ReactiveMagmaCrystals way={way} />

      <Soundless />
    </group>
  )
}
