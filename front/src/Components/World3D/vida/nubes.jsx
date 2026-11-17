// Vida del Camino de las Nubes: mini mundo diorama dentro del tubo de cristal (contrato en README.md).
// Ballenas y aves voladoras, islas flotantes, arcoíris, molinos de viento, globos aerostáticos,
// rayos coreografiados, ángeles chibi y mecanismos de cambio de carril (corriente de viento,
// globo elevador, arcoíris-tobogán, nube-trampolín).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALL_R, Billboard, CartelesDeRuta, Critter, EventStage,
  Soundless, TAU, buildSkyGeo, buildTerrainGeo, getBallitas, laneFrame,
  laneGap, lodPiece, makePlacement, markShared, maxHeight, mulberry32,
  placeAlong, placeAlongInto, routeInfo, scatter, segFrames,
  switchesOf, useAutoDispose, useInstanced, useWayBounds,
} from './base.jsx'

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT_Q = new THREE.Quaternion()
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

const ESTILO = { color: '#ffffff', bg: 'rgba(42,76,122,0.94)', border: '#fff59d' }
const ESTILO_PANTALLA = { color: '#eefaff', bg: 'rgba(28,58,98,0.94)', border: '#7ce8ff', size: 46 }
const ESTILO_META = { color: '#fffbe6', bg: 'rgba(52,82,130,0.95)', border: '#ffd166', size: 52 }

const _tmpV = new THREE.Vector3()
const _tmpV2 = new THREE.Vector3()
const _tmpQ = new THREE.Quaternion()
const _tmpQ2 = new THREE.Quaternion()
const _tmpS = new THREE.Vector3()
const _tmpM = new THREE.Matrix4()
const _tmpPl = makePlacement()

function NamedInstanced({ name, geo, mat, items, castShadow = false, receiveShadow = false }) {
  const mesh = useInstanced(geo, mat, items)
  useLayoutEffect(() => {
    if (mesh && name) mesh.name = name
  }, [mesh, name])
  if (!items?.length) return null
  return <primitive object={mesh} castShadow={castShadow} receiveShadow={receiveShadow} />
}

// ═══════════════════════════ UTILIDADES DE GEOMETRÍA ═══════════════════════════
let LOD_MUL = 1

function bakePart(geo, hex, tx = 0, ty = 0, tz = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  geo = lodPiece(geo, LOD_MUL * Math.max(Math.abs(sx), Math.abs(sy), Math.abs(sz)))
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

  const sph10 = new THREE.SphereGeometry(1, 10, 8)
  const sph8 = new THREE.SphereGeometry(1, 8, 6)
  const cap8 = new THREE.CapsuleGeometry(1, 1, 3, 6)
  const cyl8 = new THREE.CylinderGeometry(1, 1, 1, 8)
  const cone8 = new THREE.ConeGeometry(1, 1, 8)
  const tor14 = new THREE.TorusGeometry(1, 0.07, 6, 14)
  const arcTor = new THREE.TorusGeometry(1, 0.08, 6, 16, Math.PI)
  const box1 = new THREE.BoxGeometry(1, 1, 1)

  // 1. Ángel chibi (túnica nube, alitas blancas, aureola dorada, ojos kawaii)
  const buildAngel = () => mergePainted([
    bakePart(cone8, '#f0f9ff', 0, 0.24, 0, 0, 0, 0, 0.19, 0.34, 0.19), // túnica
    bakePart(sph10, '#ffe4d6', 0, 0.50, 0.02, 0, 0, 0, 0.17, 0.16, 0.17), // cabeza chibi
    bakePart(sph8, '#ffd166', 0, 0.56, -0.02, 0, 0, 0, 0.18, 0.14, 0.17), // pelito dorado
    bakePart(sph8, '#1e293b', -0.06, 0.50, 0.16, 0, 0, 0, 0.026, 0.034, 0.022), // ojo L
    bakePart(sph8, '#1e293b', 0.06, 0.50, 0.16, 0, 0, 0, 0.026, 0.034, 0.022), // ojo R
    bakePart(sph8, '#ffffff', -0.054, 0.514, 0.178, 0, 0, 0, 0.01, 0.012, 0.01),
    bakePart(sph8, '#ffffff', 0.066, 0.514, 0.178, 0, 0, 0, 0.01, 0.012, 0.01),
    bakePart(sph8, '#ff9ebb', -0.10, 0.45, 0.14, 0, 0, 0, 0.032, 0.02, 0.02), // mejilla L
    bakePart(sph8, '#ff9ebb', 0.10, 0.45, 0.14, 0, 0, 0, 0.032, 0.02, 0.02), // mejilla R
    bakePart(sph8, '#ffffff', -0.20, 0.36, -0.08, 0.2, 0, -0.4, 0.16, 0.05, 0.10), // ala L
    bakePart(sph8, '#ffffff', 0.20, 0.36, -0.08, 0.2, 0, 0.4, 0.16, 0.05, 0.10), // ala R
    bakePart(tor14, '#ffe066', 0, 0.74, 0, Math.PI / 2, 0, 0, 0.13, 0.13, 0.13), // aureola
  ])
  const angel = buildAngel()
  LOD_MUL = 0.3
  const angelCrowd = buildAngel()
  LOD_MUL = 1

  // 2. Ballena voladora chibi (cuerpo celeste, panza crema, aletas y chorro de nube)
  const whale = mergePainted([
    bakePart(sph10, '#6ec6ff', 0, 0.28, 0, 0, 0, 0, 0.28, 0.24, 0.38), // cuerpo
    bakePart(sph8, '#eef9ff', 0, 0.18, 0.06, 0, 0, 0, 0.22, 0.12, 0.28), // panza
    bakePart(sph8, '#1b263b', -0.15, 0.30, 0.28, 0, 0, 0, 0.032, 0.036, 0.024), // ojo L
    bakePart(sph8, '#1b263b', 0.15, 0.30, 0.28, 0, 0, 0, 0.032, 0.036, 0.024), // ojo R
    bakePart(sph8, '#ff9ebb', -0.19, 0.24, 0.23, 0, 0, 0, 0.04, 0.025, 0.025), // rubor
    bakePart(sph8, '#ff9ebb', 0.19, 0.24, 0.23, 0, 0, 0, 0.04, 0.025, 0.025),
    bakePart(sph8, '#4ea8de', -0.30, 0.22, 0.02, 0, 0, -0.35, 0.16, 0.04, 0.11), // aleta L
    bakePart(sph8, '#4ea8de', 0.30, 0.22, 0.02, 0, 0, 0.35, 0.16, 0.04, 0.11), // aleta R
    bakePart(sph8, '#4ea8de', -0.10, 0.28, -0.42, 0, 0.3, 0, 0.14, 0.04, 0.10), // cola L
    bakePart(sph8, '#4ea8de', 0.10, 0.28, -0.42, 0, -0.3, 0, 0.14, 0.04, 0.10), // cola R
    bakePart(sph8, '#ffffff', 0, 0.56, 0.10, 0, 0, 0, 0.08, 0.07, 0.08), // chorrito nube
  ])

  // 3. Ave voladora chibi (redondita, pico dorado, alitas desplegadas)
  const bird = mergePainted([
    bakePart(sph10, '#fff3b0', 0, 0.26, 0, 0, 0, 0, 0.19, 0.18, 0.22), // cuerpo
    bakePart(cone8, '#ff9f1c', 0, 0.26, 0.24, Math.PI / 2, 0, 0, 0.05, 0.10, 0.05), // pico
    bakePart(sph8, '#1e293b', -0.08, 0.31, 0.17, 0, 0, 0, 0.026, 0.03, 0.02), // ojo L
    bakePart(sph8, '#1e293b', 0.08, 0.31, 0.17, 0, 0, 0, 0.026, 0.03, 0.02), // ojo R
    bakePart(sph8, '#72efdd', -0.22, 0.28, -0.02, 0, 0, 0.25, 0.18, 0.04, 0.11), // ala L
    bakePart(sph8, '#72efdd', 0.22, 0.28, -0.02, 0, 0, -0.25, 0.18, 0.04, 0.11), // ala R
    bakePart(cone8, '#ff85a1', 0, 0.44, 0.02, -0.2, 0, 0, 0.05, 0.10, 0.05), // cresta
  ])

  // 4. Isla flotante (roca cónica invertida, pradera verde, arbolito y colchón de nube)
  const island = mergePainted([
    bakePart(cone8, '#8d6e63', 0, 0.16, 0, Math.PI, 0, 0, 0.44, 0.32, 0.44), // base rocosa
    bakePart(cyl8, '#70e000', 0, 0.34, 0, 0, 0, 0, 0.48, 0.08, 0.48), // césped
    bakePart(cap8, '#6d4c41', 0.12, 0.48, -0.06, 0, 0, 0, 0.04, 0.14, 0.04), // tronco
    bakePart(sph8, '#38b000', 0.12, 0.62, -0.06, 0, 0, 0, 0.15, 0.14, 0.15), // copa árbol
    bakePart(sph8, '#ffffff', -0.22, 0.22, 0.14, 0, 0, 0, 0.18, 0.10, 0.18), // nube L
    bakePart(sph8, '#ffffff', 0.22, 0.22, -0.14, 0, 0, 0, 0.16, 0.10, 0.16), // nube R
  ])

  // 5. Arcoíris (4 bandas de color)
  const rainbow = mergePainted([
    bakePart(arcTor, '#ff595e', 0, 0, 0, 0, 0, 0, 0.96, 0.96, 0.96),
    bakePart(arcTor, '#ffca3a', 0, 0, 0, 0, 0, 0, 0.84, 0.84, 0.84),
    bakePart(arcTor, '#8ac926', 0, 0, 0, 0, 0, 0, 0.72, 0.72, 0.72),
    bakePart(arcTor, '#1982c4', 0, 0, 0, 0, 0, 0, 0.60, 0.60, 0.60),
  ])

  // 6. Molino de viento (torre + aspas separadas para rotar en useFrame)
  const windmillTower = mergePainted([
    bakePart(cyl8, '#f8fafc', 0, 0.34, 0, 0, 0, 0, 0.18, 0.68, 0.18),
    bakePart(cone8, '#ff6b6b', 0, 0.78, 0, 0, 0, 0, 0.22, 0.24, 0.22),
    bakePart(box1, '#8d6e63', 0, 0.14, 0.17, 0, 0, 0, 0.12, 0.22, 0.04),
  ])
  const windmillBlades = mergePainted([
    bakePart(sph8, '#ffd166', 0, 0, 0, 0, 0, 0, 0.08, 0.08, 0.08),
    bakePart(box1, '#ffffff', 0, 0.26, 0.02, 0, 0, 0, 0.09, 0.44, 0.02),
    bakePart(box1, '#ffffff', 0, -0.26, 0.02, 0, 0, 0, 0.09, 0.44, 0.02),
    bakePart(box1, '#72efdd', 0.26, 0, 0.02, 0, 0, 0, 0.44, 0.09, 0.02),
    bakePart(box1, '#72efdd', -0.26, 0, 0.02, 0, 0, 0, 0.44, 0.09, 0.02),
  ])

  // 7. Globo aerostático (canasta + globo rayado)
  const balloon = mergePainted([
    bakePart(sph10, '#ff6b6b', 0, 0.68, 0, 0, 0, 0, 0.34, 0.40, 0.34),
    bakePart(tor14, '#ffd166', 0, 0.68, 0, Math.PI / 2, 0, 0, 0.34, 0.34, 0.34),
    bakePart(tor14, '#4cc9f0', 0, 0.52, 0, Math.PI / 2, 0, 0, 0.26, 0.26, 0.26),
    bakePart(box1, '#a47148', 0, 0.12, 0, 0, 0, 0, 0.18, 0.16, 0.18),
    bakePart(cyl8, '#d4a373', -0.08, 0.28, 0.08, 0, 0, 0, 0.015, 0.20, 0.015),
    bakePart(cyl8, '#d4a373', 0.08, 0.28, -0.08, 0, 0, 0, 0.015, 0.20, 0.015),
  ])

  // 8. Nube esponjosa (cúmulo multi-esfera)
  const cloud = mergePainted([
    bakePart(sph8, '#ffffff', 0, 0.14, 0, 0, 0, 0, 0.42, 0.24, 0.34),
    bakePart(sph8, '#f0f9ff', -0.28, 0.10, 0.04, 0, 0, 0, 0.28, 0.20, 0.26),
    bakePart(sph8, '#f0f9ff', 0.28, 0.10, -0.04, 0, 0, 0, 0.28, 0.20, 0.26),
    bakePart(sph8, '#ffffff', 0.06, 0.26, 0, 0, 0, 0, 0.24, 0.18, 0.22),
  ])

  // 9. Rayo coreografiado (zig-zag luminoso)
  const lightning = mergePainted([
    bakePart(box1, '#fff3b0', -0.08, 0.32, 0, 0, 0, -0.45, 0.08, 0.45, 0.08),
    bakePart(box1, '#ffe066', 0.06, 0.04, 0, 0, 0, 0.55, 0.08, 0.34, 0.08),
    bakePart(cone8, '#72efdd', -0.08, -0.28, 0, Math.PI, 0, -0.35, 0.09, 0.44, 0.09),
  ])

  // 10. Grada celeste, farola, valla, banderín, baldosa arcoíris y orbe
  const stand = mergePainted([
    bakePart(cyl8, '#4a6fa5', 0, 0.08, 0, 0, 0, 0, 0.44, 0.16, 0.92),
    bakePart(cyl8, '#628bc4', -0.10, 0.22, 0, 0, 0, 0, 0.32, 0.16, 0.86),
    bakePart(cyl8, '#82aee3', -0.20, 0.36, 0, 0, 0, 0, 0.22, 0.16, 0.80),
    bakePart(cap8, '#ffd166', -0.25, 0.47, 0, Math.PI / 2, 0, 0, 0.03, 0.68, 0.03),
  ])
  const lamp = mergePainted([
    bakePart(cap8, '#e2e8f0', 0, 0.34, 0, 0, 0, 0, 0.032, 0.32, 0.032),
    bakePart(cap8, '#94a3b8', -0.06, 0.68, 0, 0, 0, 0.55, 0.025, 0.11, 0.025),
    bakePart(sph8, '#fff3b0', -0.14, 0.68, 0, 0, 0, 0, 0.08, 0.09, 0.08),
  ])
  const fence = mergePainted([
    bakePart(sph8, '#ffffff', 0, 0.14, -0.32, 0, 0, 0, 0.06, 0.12, 0.06),
    bakePart(sph8, '#ffffff', 0, 0.14, 0.32, 0, 0, 0, 0.06, 0.12, 0.06),
    bakePart(cap8, '#ffd166', 0, 0.22, 0, Math.PI / 2, 0, 0, 0.024, 0.36, 0.024),
  ])
  const pennant = mergePainted([
    bakePart(cone8, '#ffffff', 0, -0.14, 0, Math.PI, 0, 0, 0.14, 0.28, 0.03),
  ])
  const slideTile = mergePainted([
    bakePart(box1, '#ff6b6b', -0.12, 0, 0, 0, 0, 0, 0.12, 0.04, 0.26),
    bakePart(box1, '#ffd166', 0, 0, 0, 0, 0, 0, 0.12, 0.04, 0.26),
    bakePart(box1, '#4cc9f0', 0.12, 0, 0, 0, 0, 0, 0.12, 0.04, 0.26),
  ])
  const orb = new THREE.SphereGeometry(1, 8, 6)

  box1.dispose()

  GEOS = markShared({
    angel, angelCrowd, whale, bird, island, rainbow, windmillTower, windmillBlades,
    balloon, cloud, lightning, stand, lamp, fence, pennant, slideTile, orb,
    sph10, sph8, cap8, cyl8, cone8, tor14,
  })
  return GEOS
}

// ═══════════════════════════ TEXTURAS Y MATERIALES CACHEADOS ═══════════════════════════
let MATS = null
function getMats() {
  if (MATS) return MATS

  const curbTex = (() => {
    if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([140, 205, 255, 255]), 1, 1)
    const c = document.createElement('canvas')
    c.width = 512; c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#3b6291'
    ctx.fillRect(0, 0, 512, 128)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#ffd166'
      ctx.fillRect(i * 64, 0, 64, 26)
      ctx.fillRect(i * 64, 102, 64, 26)
    }
    ctx.fillStyle = '#fff9db'
    ctx.font = 'bold 40px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('NUBES · CIELO', 256, 66)
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
        ctx.fillStyle = (r + k) % 2 === 0 ? '#386192' : '#fff3b0'
        ctx.fillRect(k * cw, r * ch, cw, ch)
      }
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    return tex
  })()

  MATS = markShared({
    clay: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.56, metalness: 0.06, emissive: '#1e3a5f', emissiveIntensity: 0.24,
    }),
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0.04, side: THREE.DoubleSide, emissive: '#294d78', emissiveIntensity: 0.22,
    }),
    glowGold: new THREE.MeshBasicMaterial({ color: '#ffe066', toneMapped: false }),
    glowCyan: new THREE.MeshBasicMaterial({ color: '#72efdd', toneMapped: false }),
    glowWhite: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    glowBolt: new THREE.MeshBasicMaterial({ color: '#fff3a1', toneMapped: false }),
    curb: new THREE.MeshStandardMaterial({
      map: curbTex, roughness: 0.55, metalness: 0.1,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    checker: new THREE.MeshBasicMaterial({
      map: checkerTex, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    pennant: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, side: THREE.DoubleSide }),
    windBeam: new THREE.MeshBasicMaterial({
      color: '#b8f5ff', transparent: true, opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
  })
  return MATS
}

// ═══════════════════════════ ALTURA DE TERRENO COMPARTIDA ═══════════════════════════
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function cloudBankHeight(seg, u, a) {
  const bank = smooth(0.48, 0.68, Math.abs(a))
  const fSeed = (seg.i + 1) * 1.19
  const billow = 0.5 + 0.5 * Math.sin(u * seg.length * 0.42 * fSeed + a * 2.9) * Math.cos(u * seg.length * 0.24 - a * 2.0)
  return THREE.MathUtils.clamp(billow, 0, 1) * bank
}

function cloudSurfaceOffset(seg, u, a) {
  const arc = Math.PI * 0.50
  const edge = 1 - smooth(arc * 0.7, arc, Math.abs(a))
  const gap = laneGap(seg, a)
  const chan = smooth(0.02, 0.32, gap)
  const maxH = Math.min(maxHeight(seg) * 0.38, seg.radius * 0.20)
  const hk = cloudBankHeight(seg, u, a) * edge * chan
  return seg.radius * 0.015 + hk * maxH
}

function seatOnTerrain(items) {
  for (const it of items) {
    const off = cloudSurfaceOffset(it.seg, it.u, it.angle)
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
      const vi = (i * 2 + j) * 3
      pos[vi] = f.pos.x + dv.x * R
      pos[vi + 1] = f.pos.y + dv.y * R
      pos[vi + 2] = f.pos.z + dv.z * R
      const ui = (i * 2 + j) * 2
      uv[ui] = f.arc * repeatAlong
      uv[ui + 1] = j
    }
    if (i > 0) {
      const a = (i - 1) * 2
      const b = i * 2
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

function buildCheckerStripGeo(seg, uCenter, halfSpanArc = 0.33, widthWorld = 1.0) {
  const du = Math.min(0.04, widthWorld / Math.max(seg.length, 4))
  const u0 = Math.max(0.01, uCenter - du * 0.5)
  const u1 = Math.min(0.99, uCenter + du * 0.5)
  const rows = 2; const cols = 10
  const pos = []; const uv = []; const idx = []
  const R = seg.radius * 0.945
  for (let r = 0; r <= rows; r++) {
    const u = THREE.MathUtils.lerp(u0, u1, r / rows)
    const p = placeAlong(seg, u, 0, 0)
    for (let c = 0; c <= cols; c++) {
      const a = THREE.MathUtils.lerp(-halfSpanArc, halfSpanArc, c / cols)
      const dir = p.up.clone().multiplyScalar(Math.cos(a)).addScaledVector(p.side, Math.sin(a))
      const pt = p.pos.clone().addScaledVector(dir, seg.radius - R)
      pos.push(pt.x, pt.y, pt.z)
      uv.push(c / cols, r / rows)
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c
      const b = a + cols + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// ═══════════════════════════ PÓRTICO DE SALIDA Y META ARCOÍRIS ═══════════════════════════
function WelcomePortico({ seg, wayName }) {
  const G = getGeos()
  const M = getMats()
  const p0 = useMemo(() => placeAlong(seg, 0.08, 0.02, 0), [seg])
  const signPos = useMemo(() => p0.pos.clone().addScaledVector(p0.up, 1.05), [p0])
  const signQuat = useMemo(() => p0.quat.clone().multiply(FLIP_Y), [p0])
  return (
    <group name="nubes:portico">
      <group position={p0.pos} quaternion={p0.quat}>
        <mesh position={[-0.64, 0.14, 0]} scale={[0.55, 0.55, 0.55]} geometry={G.cloud} material={M.clay} />
        <mesh position={[0.64, 0.14, 0]} scale={[0.55, 0.55, 0.55]} geometry={G.cloud} material={M.clay} />
        <mesh position={[0, 0.24, 0]} scale={[0.78, 0.78, 0.78]} geometry={G.rainbow} material={M.clay} />
      </group>
      <Billboard text={`☁️ ${wayName.toUpperCase()}`} style={ESTILO_META} position={signPos} quat={signQuat} height={0.34} glow={1.35} />
    </group>
  )
}

function FinishRainbowBurst({ seg }) {
  const G = getGeos()
  const M = getMats()
  const p = useMemo(() => placeAlong(seg, 0.88, 0.02, 0), [seg])
  const signPos = useMemo(() => p.pos.clone().addScaledVector(p.up, 1.08), [p])
  const signQuat = useMemo(() => p.quat.clone().multiply(FLIP_Y), [p])
  const burstRef = useRef()

  useFrame(({ clock }) => {
    if (!burstRef.current) return
    const t = clock.elapsedTime * 1.2
    const kids = burstRef.current.children
    for (let i = 0; i < kids.length; i++) {
      const ph = (t + i * 0.2) % 1
      const ang = (i / kids.length) * TAU
      const rad = 0.30 + ph * 0.62
      kids[i].position.set(Math.cos(ang) * rad, 0.56 + Math.sin(ang) * rad * 0.65, 0)
      kids[i].scale.setScalar(0.06 * (1 - ph * 0.5))
    }
  })

  return (
    <group name="nubes:meta">
      <group position={p.pos} quaternion={p.quat}>
        <mesh position={[0, 0.22, 0]} scale={[0.88, 0.88, 0.88]} geometry={G.rainbow} material={M.clay} />
        <mesh position={[-0.70, 0.20, 0]} scale={0.5} geometry={G.balloon} material={M.clay} />
        <mesh position={[0.70, 0.20, 0]} scale={0.5} geometry={G.balloon} material={M.clay} />
        <group ref={burstRef}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh key={i} geometry={G.orb} material={i % 2 === 0 ? M.glowGold : M.glowCyan} />
          ))}
        </group>
      </group>
      <Billboard text="🌈 META CELESTE" style={ESTILO_META} position={signPos} quat={signQuat} height={0.34} glow={1.4} />
    </group>
  )
}

// ═══════════════════════════ MECANISMOS DE CAMBIO DE CARRIL ═══════════════════════════
// Nube-trampolín (rebote), Corriente de viento ascendente (aros), Globo elevador, Arcoíris-tobogán.
function LaneSwitchMechanisms({ way }) {
  const G = getGeos()
  const M = getMats()

  const { mechanisms, slideCount } = useMemo(() => {
    const out = []
    let slides = 0
    for (const seg of way.segments) {
      if (seg.air) continue
      const realSwitches = switchesOf(seg)
      const list = realSwitches.length
        ? realSwitches
        : (seg.route >= 0 || seg.kind === 'salida'
            ? [
                { u: 0.26, from: 0, to: 0, kind: 'trampolin', duration: 0.8, _synthAngle: (seg.i % 2 === 0 ? 1 : -1) * 1.22 },
                { u: 0.66, from: 0, to: 0, kind: 'tirolina', duration: 0.8, _synthAngle: (seg.i % 2 === 0 ? -1 : 1) * 1.44 },
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
        const nSlides = 4
        const slideStart = slides
        slides += nSlides
        out.push({ seg, uIn, kind: sw.kind, fIn, fOut, qIn, qOut, slideStart, nSlides })
      }
    }
    return { mechanisms: out, slideCount: slides }
  }, [way])

  const trampRef = useRef()
  const updraftRef = useRef()
  const liftBalloonRef = useRef()
  const slideRef = useRef()
  useWayBounds(trampRef, way)
  useWayBounds(updraftRef, way)
  useWayBounds(liftBalloonRef, way)
  useWayBounds(slideRef, way)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < mechanisms.length; i++) {
      const m = mechanisms[i]
      let act = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === m.seg) {
          const d = Math.abs((b.segT ?? 0) - m.uIn)
          if (d < 0.14) act = Math.max(act, 1 - d / 0.14)
        }
      }
      if (trampRef.current) {
        const bounce = act * Math.sin(t * 14) * 0.14
        _tmpV.copy(m.fIn.pos).addScaledVector(m.fIn.up, 0.04)
        _tmpS.set(0.68 + act * 0.18, 0.55 - bounce, 0.68 + act * 0.18)
        _tmpM.compose(_tmpV, m.qIn, _tmpS)
        trampRef.current.setMatrixAt(i, _tmpM)
      }
      if (updraftRef.current) {
        _tmpV.copy(m.fIn.pos).addScaledVector(m.fIn.up, 0.24 + ((t * 0.4 + i * 0.2) % 0.28))
        _tmpQ.copy(m.qIn)
        _tmpQ2.setFromAxisAngle(Y, t * (2.2 + act * 5.0))
        _tmpQ.multiply(_tmpQ2)
        _tmpS.setScalar(0.26 + act * 0.14)
        _tmpM.compose(_tmpV, _tmpQ, _tmpS)
        updraftRef.current.setMatrixAt(i, _tmpM)
      }
      if (liftBalloonRef.current) {
        const lift = 0.48 + act * 0.24 + Math.sin(t * 2 + i) * 0.05
        _tmpV.copy(m.fOut.pos).addScaledVector(m.fOut.up, lift)
        _tmpS.setScalar(0.36 + act * 0.08)
        _tmpM.compose(_tmpV, m.qOut, _tmpS)
        liftBalloonRef.current.setMatrixAt(i, _tmpM)
      }
      if (slideRef.current) {
        for (let j = 0; j < m.nSlides; j++) {
          const frac = (j + 0.5) / m.nSlides
          _tmpV.copy(m.fIn.pos).lerp(m.fOut.pos, frac)
          _tmpV2.copy(m.fIn.up).lerp(m.fOut.up, frac).normalize()
          const arch = Math.sin(frac * Math.PI) * (0.14 + act * 0.10)
          _tmpV.addScaledVector(_tmpV2, 0.06 + arch)
          _tmpQ.copy(m.qIn).slerp(m.qOut, frac)
          _tmpS.setScalar(0.62 + act * 0.22)
          _tmpM.compose(_tmpV, _tmpQ, _tmpS)
          slideRef.current.setMatrixAt(m.slideStart + j, _tmpM)
        }
      }
    }
    if (trampRef.current) trampRef.current.instanceMatrix.needsUpdate = true
    if (updraftRef.current) updraftRef.current.instanceMatrix.needsUpdate = true
    if (liftBalloonRef.current) liftBalloonRef.current.instanceMatrix.needsUpdate = true
    if (slideRef.current) slideRef.current.instanceMatrix.needsUpdate = true
  })

  if (!mechanisms.length) return null
  return (
    <group name="nubes:mechanisms">
      <instancedMesh name="nubes:mech-trampolines" ref={trampRef} args={[G.cloud, M.clay, mechanisms.length]} />
      <instancedMesh name="nubes:mech-updrafts" ref={updraftRef} args={[G.tor14, M.glowCyan, mechanisms.length]} />
      <instancedMesh name="nubes:mech-balloons" ref={liftBalloonRef} args={[G.balloon, M.clay, mechanisms.length]} />
      {slideCount > 0 && <instancedMesh name="nubes:mech-slides" ref={slideRef} args={[G.slideTile, M.clay, slideCount]} />}
    </group>
  )
}

// ═══════════════════════════ EVENTOS POR RUTA (RÁPIDA / LENTA / ESPECTACULAR) ═══════════════════════════
// Ruta A (rápida): Corriente Supersónica & Rayos Coreografiados
function CloudStormWindEvent({ seg }) {
  return <EventStage segment={seg} render={(stage) => <CloudStormWindStage seg={seg} stage={stage} />} />
}

function CloudStormWindStage({ seg, stage }) {
  const G = getGeos()
  const M = getMats()
  const boltsRef = useRef()
  const ringRef = useRef()
  const anchor = useMemo(() => placeAlong(seg, 0.50, 0.02, 0), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.5 : stage.phase === 'salida' ? 0.25 : 0.1
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (1.2 + active * 4.5)
      ringRef.current.scale.setScalar(0.65 + active * 0.25)
    }
    if (boltsRef.current) {
      const kids = boltsRef.current.children
      for (let i = 0; i < kids.length; i++) {
        const flash = Math.max(0, Math.sin(t * 7.5 - i * 1.4))
        const sc = active > 0.35 ? 0.28 + flash * 0.32 * active : 0.12
        kids[i].scale.setScalar(sc)
      }
    }
  })

  return (
    <group name="nubes:event-storm" position={anchor.pos} quaternion={anchor.quat}>
      <mesh ref={ringRef} position={[0, 0.66, 0]} geometry={G.tor14} material={M.glowCyan} />
      <group ref={boltsRef}>
        {[-0.55, 0, 0.55].map((x, i) => (
          <mesh key={i} position={[x, 0.72, (i - 1) * 0.22]} geometry={G.lightning} material={M.glowBolt} />
        ))}
      </group>
    </group>
  )
}

// Ruta B (lenta): Sinfonía de Molinos y Ballenas
function CloudWindmillWhaleEvent({ seg }) {
  return <EventStage segment={seg} render={(stage) => <CloudWindmillWhaleStage seg={seg} stage={stage} />} />
}

function CloudWindmillWhaleStage({ seg, stage }) {
  const G = getGeos()
  const M = getMats()
  const bladesL = useRef()
  const bladesR = useRef()
  const haloRef = useRef()
  const anchor = useMemo(() => placeAlong(seg, 0.52, 0.02, 0), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.5 : stage.phase === 'salida' ? 0.3 : 0.14
    const spd = 1.0 + active * 3.0
    if (bladesL.current) bladesL.current.rotation.z = t * spd
    if (bladesR.current) bladesR.current.rotation.z = -t * spd
    if (haloRef.current) {
      haloRef.current.position.y = 0.74 + Math.sin(t * 2.2) * 0.08 * (0.4 + active)
      haloRef.current.scale.setScalar(0.32 + active * 0.20)
    }
  })

  return (
    <group name="nubes:event-windmill" position={anchor.pos} quaternion={anchor.quat}>
      <mesh position={[-0.62, 0, 0]} scale={0.72} geometry={G.windmillTower} material={M.clay} />
      <mesh ref={bladesL} position={[-0.62, 0.52, 0.14]} scale={0.72} geometry={G.windmillBlades} material={M.clay} />
      <mesh position={[0.62, 0, 0]} scale={0.72} geometry={G.windmillTower} material={M.clay} />
      <mesh ref={bladesR} position={[0.62, 0.52, 0.14]} scale={0.72} geometry={G.windmillBlades} material={M.clay} />
      <mesh ref={haloRef} position={[0, 0.74, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={G.tor14} material={M.glowGold} />
    </group>
  )
}

// Ruta C (espectacular): Gran Festival Arcoíris y Globos
function CloudRainbowBalloonEvent({ seg }) {
  return <EventStage segment={seg} render={(stage) => <CloudRainbowBalloonStage seg={seg} stage={stage} />} />
}

function CloudRainbowBalloonStage({ seg, stage }) {
  const G = getGeos()
  const M = getMats()
  const bowRef = useRef()
  const balL = useRef()
  const balR = useRef()
  const anchor = useMemo(() => placeAlong(seg, 0.50, 0.02, 0), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.55 : stage.phase === 'salida' ? 0.3 : 0.15
    if (bowRef.current) bowRef.current.scale.setScalar(0.76 + active * 0.20)
    const bob = 0.38 + active * 0.34 + Math.sin(t * 2.0) * 0.08
    if (balL.current) balL.current.position.y = bob
    if (balR.current) balR.current.position.y = bob + 0.08
  })

  return (
    <group name="nubes:event-festival" position={anchor.pos} quaternion={anchor.quat}>
      <mesh ref={bowRef} position={[0, 0.22, 0]} geometry={G.rainbow} material={M.clay} />
      <mesh ref={balL} position={[-0.64, 0.45, 0]} scale={0.52} geometry={G.balloon} material={M.clay} />
      <mesh ref={balR} position={[0.64, 0.45, 0]} scale={0.52} geometry={G.balloon} material={M.clay} />
    </group>
  )
}

// ═══════════════════════════ BALLENAS Y AVES EN VUELO ═══════════════════════════
function SkyWhalesAndBirds({ way }) {
  const G = getGeos()
  const M = getMats()
  const whaleRef = useRef()
  const birdRef = useRef()
  useWayBounds(whaleRef, way)
  useWayBounds(birdRef, way)

  const { whales, birds } = useMemo(() => {
    const rng = mulberry32(way.idx * 617 + 29)
    const solid = way.segments.filter((s) => !s.air)
    const wOut = []
    const bOut = []
    for (let i = 0; i < solid.length; i++) {
      const seg = solid[i]
      wOut.push({
        seg,
        u0: 0.15 + rng() * 0.70,
        speed: 0.018 + rng() * 0.02,
        dir: i % 2 === 0 ? 1 : -1,
        angBase: (i % 2 === 0 ? 1 : -1) * (1.85 + rng() * 0.45),
        phase: rng() * TAU,
        scale: 0.34 + rng() * 0.10,
      })
      const nB = seg.length > 20 ? 2 : 1
      for (let k = 0; k < nB; k++) {
        bOut.push({
          seg,
          u0: rng(),
          speed: 0.04 + rng() * 0.04,
          dir: (i + k) % 2 === 0 ? 1 : -1,
          angBase: (rng() > 0.5 ? 1 : -1) * (1.45 + rng() * 0.55),
          phase: rng() * TAU,
          scale: 0.18 + rng() * 0.06,
        })
      }
    }
    return { whales: wOut, birds: bOut }
  }, [way])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (whaleRef.current && whales.length) {
      for (let i = 0; i < whales.length; i++) {
        const w = whales[i]
        const u = ((w.u0 + t * w.speed * w.dir) % 1 + 1) % 1
        const ang = w.angBase + Math.sin(t * 0.9 + w.phase) * 0.16
        const off = 0.32 + Math.sin(t * 1.6 + w.phase) * 0.08
        placeAlongInto(w.seg, u, off, ang, _tmpPl)
        _tmpQ.copy(_tmpPl.quat)
        if (w.dir < 0) _tmpQ.multiply(FLIP_Y)
        _tmpS.setScalar(w.scale)
        _tmpM.compose(_tmpPl.pos, _tmpQ, _tmpS)
        whaleRef.current.setMatrixAt(i, _tmpM)
      }
      whaleRef.current.instanceMatrix.needsUpdate = true
    }
    if (birdRef.current && birds.length) {
      for (let i = 0; i < birds.length; i++) {
        const b = birds[i]
        const u = ((b.u0 + t * b.speed * b.dir) % 1 + 1) % 1
        const ang = b.angBase + Math.sin(t * 1.8 + b.phase) * 0.24
        const off = 0.36 + Math.sin(t * 2.8 + b.phase) * 0.09
        placeAlongInto(b.seg, u, off, ang, _tmpPl)
        _tmpQ.copy(_tmpPl.quat)
        if (b.dir < 0) _tmpQ.multiply(FLIP_Y)
        _tmpS.setScalar(b.scale)
        _tmpM.compose(_tmpPl.pos, _tmpQ, _tmpS)
        birdRef.current.setMatrixAt(i, _tmpM)
      }
      birdRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group name="nubes:sky-creatures">
      {whales.length > 0 && <instancedMesh name="nubes:sky-whales" ref={whaleRef} args={[G.whale, M.clay, whales.length]} />}
      {birds.length > 0 && <instancedMesh name="nubes:sky-birds" ref={birdRef} args={[G.bird, M.clay, birds.length]} />}
    </group>
  )
}

// ═══════════════════════════ MOLINOS DE VIENTO ANIMADOS ═══════════════════════════
function AnimatedWindmills({ way, windmillItems }) {
  const G = getGeos()
  const M = getMats()
  const bladesRef = useRef()
  useWayBounds(bladesRef, way)

  const blades = useMemo(() => {
    return windmillItems.map((it, idx) => {
      const local = new THREE.Vector3(0, 0.56 * it.scale, 0.16 * it.scale)
      local.applyQuaternion(it.quat).add(it.pos)
      return { pos: local, quat: it.quat.clone(), scale: it.scale, speed: 1.8 + (idx % 3) * 0.6 }
    })
  }, [windmillItems])

  useFrame(({ clock }) => {
    const m = bladesRef.current
    if (!m || !blades.length) return
    const t = clock.elapsedTime
    for (let i = 0; i < blades.length; i++) {
      const b = blades[i]
      _tmpQ.copy(b.quat)
      _tmpQ2.setFromAxisAngle(Z, t * b.speed * (i % 2 === 0 ? 1 : -1))
      _tmpQ.multiply(_tmpQ2)
      _tmpS.setScalar(b.scale)
      _tmpM.compose(b.pos, _tmpQ, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return (
    <group name="nubes:windmills">
      <NamedInstanced name="nubes:windmill-towers" geo={G.windmillTower} mat={M.clay} items={windmillItems} />
      {blades.length > 0 && <instancedMesh name="nubes:windmill-blades" ref={bladesRef} args={[G.windmillBlades, M.clay, blades.length]} />}
    </group>
  )
}

// ═══════════════════════════ PÚBLICO ÁNGELES CHIBI EN GRADAS ═══════════════════════════
function CloudCrowdAndBehavior({ way, standItems }) {
  const G = getGeos()
  const M = getMats()
  const crowdRef = useRef()
  useWayBounds(crowdRef, way)

  const crowd = useMemo(() => {
    const rng = mulberry32(way.idx * 751 + 37)
    const out = []
    for (let s = 0; s < standItems.length; s++) {
      const st = standItems[s]
      const rows = [
        { d: 0.14, y: 0.19 },
        { d: -0.02, y: 0.33 },
        { d: -0.18, y: 0.47 },
      ]
      for (let r = 0; r < rows.length; r++) {
        for (let k = -1; k <= 1; k++) {
          const local = new THREE.Vector3(rows[r].d, rows[r].y, k * 0.23)
          local.applyQuaternion(st.quat).add(st.pos)
          out.push({
            seg: st.seg,
            u: st.u,
            basePos: local,
            quat: st.quat.clone(),
            up: new THREE.Vector3(0, 1, 0).applyQuaternion(st.quat),
            phase: rng() * TAU,
            scale: 0.15 + rng() * 0.03,
          })
        }
      }
    }
    return out
  }, [way, standItems])

  useFrame(({ clock }) => {
    const m = crowdRef.current
    if (!m || !crowd.length) return
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < crowd.length; i++) {
      const c = crowd[i]
      let cheer = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === c.seg) {
          const d = Math.abs((b.segT ?? 0) - c.u)
          if (d < 0.16) cheer = Math.max(cheer, 1 - d / 0.16)
        }
      }
      const hop = Math.abs(Math.sin(t * (2.5 + cheer * 7.5) + c.phase)) * (0.025 + cheer * 0.10)
      _tmpV.copy(c.basePos).addScaledVector(c.up, hop)
      _tmpS.setScalar(c.scale)
      _tmpM.compose(_tmpV, c.quat, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (!crowd.length) return null
  return <instancedMesh name="nubes:crowd" ref={crowdRef} args={[G.angelCrowd, M.clay, crowd.length]} />
}

// ═══════════════════════════ CIELO INTERIOR, RAYOS COREOGRAFIADOS Y MOTAS ═══════════════════════════
function CloudSkyPhenomena({ way, detail }) {
  const G = getGeos()
  const M = getMats()
  const highDetail = detail === true || detail > 0.35

  const skyGeo = useMemo(() => {
    const geos = []
    for (const seg of way.segments) {
      if (seg.air) continue
      const rt = way.routes[seg.route]
      const sp = rt?.profile?.speed
      const colors = sp === 'rapida'
        ? ['#3b6ea5', '#9be2ff']
        : sp === 'lenta'
          ? ['#4b7bb0', '#ffe8b8']
          : ['#5874b8', '#f9c5ff']
      geos.push(buildSkyGeo(seg, { radial: 12, along: Math.max(10, Math.ceil(seg.length * 0.55)), colors }))
    }
    if (!geos.length) return null
    const merged = mergeGeometries(geos, false)
    for (const g of geos) g.dispose()
    return merged
  }, [way])
  useAutoDispose(skyGeo)

  const bolts = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (seg.air || seg.length < 12) continue
      const n = highDetail ? Math.max(1, Math.floor(seg.length / 22)) : 1
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const ang = (i % 2 === 0 ? 1 : -1) * 2.15
        const p = placeAlong(seg, u, 0.18, ang)
        out.push({ pos: p.pos, quat: p.quat, phase: seg.i * 0.9 + i * 1.3 })
      }
    }
    return out
  }, [way, highDetail])

  const boltRef = useRef()
  useWayBounds(boltRef, way)

  const moteCount = highDetail ? 140 : 70
  const motes = useMemo(() => {
    const rng = mulberry32(way.idx * 887 + 13)
    const solid = way.segments.filter((s) => !s.air)
    const out = []
    if (!solid.length) return out
    for (let i = 0; i < moteCount; i++) {
      const seg = solid[i % solid.length]
      out.push({
        seg,
        u0: rng(),
        ang: (rng() - 0.5) * 2.4,
        off: 0.24 + rng() * 0.44,
        speed: 0.025 + rng() * 0.03,
        scale: 0.025 + rng() * 0.025,
      })
    }
    return out
  }, [way, moteCount])

  const moteRef = useRef()
  useWayBounds(moteRef, way)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (boltRef.current && bolts.length) {
      for (let i = 0; i < bolts.length; i++) {
        const b = bolts[i]
        const pulse = Math.max(0, Math.sin(t * 4.5 - b.phase))
        const sc = pulse > 0.72 ? 0.34 * pulse : 0.001
        _tmpS.setScalar(sc)
        _tmpM.compose(b.pos, b.quat, _tmpS)
        boltRef.current.setMatrixAt(i, _tmpM)
      }
      boltRef.current.instanceMatrix.needsUpdate = true
    }
    if (moteRef.current && motes.length) {
      for (let i = 0; i < motes.length; i++) {
        const pt = motes[i]
        const u = (pt.u0 + t * pt.speed) % 1
        placeAlongInto(pt.seg, u, pt.off + Math.sin(t * 2 + i) * 0.06, pt.ang, _tmpPl)
        _tmpS.setScalar(pt.scale)
        _tmpM.compose(_tmpPl.pos, _tmpPl.quat, _tmpS)
        moteRef.current.setMatrixAt(i, _tmpM)
      }
      moteRef.current.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group name="nubes:sky">
      {skyGeo && (
        <mesh name="nubes:sky-dome" geometry={skyGeo}>
          <meshBasicMaterial vertexColors transparent opacity={0.30} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}
      {bolts.length > 0 && (
        <instancedMesh name="nubes:sky-lightning" ref={boltRef} args={[G.lightning, M.glowBolt, bolts.length]} />
      )}
      {motes.length > 0 && (
        <instancedMesh name="nubes:sky-motes" ref={moteRef} args={[G.orb, M.glowGold, motes.length]} />
      )}
    </group>
  )
}

// ═══════════════════════════ ANILLOS EN TRAMOS AÉREOS ═══════════════════════════
function CloudAirRings({ way }) {
  const G = getGeos()
  const M = getMats()
  const airSegs = useMemo(() => way.segments.filter((s) => s.air), [way])
  const rings = useMemo(() => {
    const out = []
    for (const seg of airSegs) {
      const n = Math.max(2, Math.floor(seg.length / 10))
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const p = placeAlong(seg, u, 0, 0)
        out.push({ pos: p.pos, quat: p.quat, scale: 0.65, phase: seg.i + i })
      }
    }
    return out
  }, [airSegs])

  const ref = useRef()
  useWayBounds(ref, way)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !rings.length) return
    const t = clock.elapsedTime
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]
      _tmpQ.copy(r.quat)
      _tmpQ2.setFromAxisAngle(Z, t * 0.9 + r.phase)
      _tmpQ.multiply(_tmpQ2)
      _tmpS.setScalar(r.scale)
      _tmpM.compose(r.pos, _tmpQ, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (!rings.length) return null
  return <instancedMesh name="nubes:air-rings" ref={ref} args={[G.rainbow, M.clay, rings.length]} />
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
        ? ['#5d8cc2', '#e0f4ff']
        : sp === 'lenta'
          ? ['#6996c7', '#fff4d6']
          : ['#6a84c9', '#f7e1ff']

      const maxH = Math.min(maxHeight(seg) * 0.38, seg.radius * 0.20)
      terrains.push(
        buildTerrainGeo(seg, {
          arc: Math.PI * 0.50,
          maxH,
          radial: 20,
          along: Math.ceil(seg.length * 1.25),
          colors,
          height: (u, a) => cloudBankHeight(seg, u, a),
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
    const terrain = terrains.length ? mergeGeometries(terrains, false) : null
    const curb = curbs.length ? mergeGeometries(curbs, false) : null
    const checker = checkers.length ? mergeGeometries(checkers, false) : null
    for (const g of terrains) g.dispose()
    for (const g of curbs) g.dispose()
    for (const g of checkers) g.dispose()
    return { terrain, curb, checker }
  }, [info])
  useAutoDispose(trackParts)

  const props = useMemo(() => {
    const rng = mulberry32(way.idx * 2203 + 73)
    const solid = info.segments.filter((s) => !s.air).map((s) => s.seg)

    const islands = seatOnTerrain(scatter(way, 30, rng, {
      angle: [-1.32, 1.32], clear: BALL_R * 0.88, offset: [0.06, 0.16], scale: [0.46, 0.78],
    }))
    const clouds = seatOnTerrain(scatter(way, 56, rng, {
      angle: [-1.30, 1.30], clear: BALL_R * 0.68, offset: [0.01, 0.05], scale: [0.42, 0.78],
    }))
    const windmills = seatOnTerrain(scatter(way, 20, rng, {
      angle: [-1.18, 1.18], clear: BALL_R * 0.82, offset: [0.02, 0.05], scale: [0.44, 0.66],
    }))
    const balloons = scatter(way, 22, rng, {
      segments: solid,
      angle: [-1.65, 1.65], clear: BALL_R * 0.9, offset: [0.22, 0.42], scale: [0.36, 0.56],
    })
    const rainbows = []
    for (const seg of solid) {
      const nR = Math.max(1, Math.floor(seg.length / 24))
      for (let i = 0; i < nR; i++) {
        const u = (i + 0.5) / nR
        const p = placeAlong(seg, u, 0.02, 0)
        rainbows.push({ pos: p.pos, quat: p.quat, scale: 0.76 })
      }
    }

    const stands = []
    for (const seg of solid) {
      const nSt = Math.max(1, Math.floor(seg.length / 20))
      for (let i = 0; i < nSt; i++) {
        const u = (i + 0.5) / nSt
        const side = (i + seg.i) % 2 === 0 ? 1 : -1
        const angle = side * 0.78
        if (laneGap(seg, angle) > BALL_R * 0.45 / Math.max(seg.radius, 1)) {
          const off = cloudSurfaceOffset(seg, u, angle)
          const p = placeAlong(seg, u, off, angle)
          const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? Math.PI : 0))
          stands.push({ seg, u, angle, off, pos: p.pos, quat: q, scale: [0.76, 0.76, 0.88] })
        }
      }
    }

    const lamps = []; const fences = []; const pennants = []; const screens = []
    const penCols = ['#fff3b0', '#72efdd', '#ff85a1', '#a0c4ff']
    for (const seg of solid) {
      const rt = info.routes[seg.route]
      const sp = rt?.profile?.speed
      const lampStep = sp === 'rapida' ? 8 : 6.5
      const nL = Math.max(2, Math.floor(seg.length / lampStep))
      for (let i = 0; i < nL; i++) {
        const u = (i + 0.35) / nL
        const side = i % 2 === 0 ? 1 : -1
        const p = placeAlong(seg, u, cloudSurfaceOffset(seg, u, side * 0.54), side * 0.54)
        const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? 0 : Math.PI))
        lamps.push({ pos: p.pos, quat: q, scale: 0.48 })
        const fp = placeAlong(seg, u, cloudSurfaceOffset(seg, u, -side * 0.52), -side * 0.52)
        fences.push({ pos: fp.pos, quat: fp.quat, scale: 0.72 })
      }
      const nP = Math.max(3, Math.floor(seg.length / 5.2))
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
        const label = sp === 'rapida' ? '⚡ RÁFAGA TURBO' : sp === 'lenta' ? '🐳 BAHÍA MOLINOS' : '🌈 FESTIVAL GLOBOS'
        screens.push({ key: seg.i, pos: p.pos, quat: q, text: label, sub: seg.name })
      }
    }

    const horizon = scatter(way, 28, rng, {
      angle: [1.38, 1.72], clear: 0, offset: [0.02, 0.05], scale: [0.34, 0.58],
    }).concat(scatter(way, 28, rng, {
      angle: [-1.72, -1.38], clear: 0, offset: [0.02, 0.05], scale: [0.34, 0.58],
    }))

    return { islands, clouds, windmills, balloons, rainbows, stands, lamps, fences, pennants, screens, horizon }
  }, [way, info])

  const eventEls = useMemo(() => {
    const out = []
    for (const si of info.events) {
      if (si.route === 0) out.push(<CloudStormWindEvent key={si.i} seg={si.seg} />)
      else if (si.route === 1) out.push(<CloudWindmillWhaleEvent key={si.i} seg={si.seg} />)
      else out.push(<CloudRainbowBalloonEvent key={si.i} seg={si.seg} />)
    }
    for (const rt of info.routes) {
      const extra = rt.segments.find((s) => !s.air && !s.event && s.route >= 0 && s.seg !== rt.segments[1]?.seg)
      if (extra) {
        if (rt.r === 0) out.push(<CloudStormWindEvent key={`x-${extra.i}`} seg={extra.seg} />)
        else if (rt.r === 1) out.push(<CloudWindmillWhaleEvent key={`x-${extra.i}`} seg={extra.seg} />)
        else out.push(<CloudRainbowBalloonEvent key={`x-${extra.i}`} seg={extra.seg} />)
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
    <group name="vida-nubes">
      {trackParts.terrain && <mesh name="nubes:terrain" geometry={trackParts.terrain} material={M.terrain} receiveShadow />}
      {trackParts.curb && <mesh name="nubes:curb" geometry={trackParts.curb} material={M.curb} />}
      {trackParts.checker && <mesh name="nubes:checker" geometry={trackParts.checker} material={M.checker} />}
      <CloudSkyPhenomena way={way} detail={detail} />

      {salidaSeg && <WelcomePortico seg={salidaSeg} wayName={way.theme.name} />}
      {llegadaSeg && <FinishRainbowBurst seg={llegadaSeg} />}
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#688fb8" angle={0.92} height={0.32} />

      {props.screens.map((sc) => (
        <Billboard key={sc.key} text={sc.text} style={{ ...ESTILO_PANTALLA, sub: sc.sub }} height={0.28} position={sc.pos} quat={sc.quat} glow={1.26} />
      ))}

      <NamedInstanced name="nubes:islands" geo={G.island} mat={M.clay} items={props.islands} />
      <NamedInstanced name="nubes:clouds" geo={G.cloud} mat={M.clay} items={props.clouds} />
      <AnimatedWindmills way={way} windmillItems={props.windmills} />
      <NamedInstanced name="nubes:balloons" geo={G.balloon} mat={M.clay} items={props.balloons} />
      <NamedInstanced name="nubes:rainbows" geo={G.rainbow} mat={M.clay} items={props.rainbows} />
      <NamedInstanced name="nubes:stands" geo={G.stand} mat={M.clay} items={props.stands} />
      <NamedInstanced name="nubes:lamps" geo={G.lamp} mat={M.clay} items={props.lamps} />
      <NamedInstanced name="nubes:fences" geo={G.fence} mat={M.clay} items={props.fences} />
      <NamedInstanced name="nubes:pennants" geo={G.pennant} mat={M.pennant} items={props.pennants} />
      <NamedInstanced name="nubes:horizon" geo={G.cloud} mat={M.clay} items={props.horizon} />

      <LaneSwitchMechanisms way={way} />

      {eventEls}
      <CloudAirRings way={way} />

      <Critter way={way} segments={route0Segs} count={9} geo={G.bird} mat={M.clay} scale={0.22} speed={0.85} offset={0.22} angle={0.62} spread={0.14} hop={0.30} seed={101} />
      <Critter way={way} segments={route1Segs ?? route0Segs} count={9} geo={G.angel} mat={M.clay} scale={0.23} speed={0.92} offset={0.20} angle={-0.60} spread={0.14} hop={0.28} seed={202} />
      <Critter way={way} segments={route2Segs ?? route0Segs} count={7} geo={G.whale} mat={M.clay} scale={0.28} speed={0.72} offset={0.24} angle={0.58} spread={0.14} hop={0.24} seed={303} />
      <SkyWhalesAndBirds way={way} />
      <CloudCrowdAndBehavior way={way} standItems={props.stands} />

      <Soundless />
    </group>
  )
}
