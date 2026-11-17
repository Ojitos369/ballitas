// Vida del Camino de Cristal: mini mundo diorama dentro del tubo de cristal (contrato en README.md).
// Cristales cantores en cadena, arañas de prisma, espejos, hadas de luz, caleidoscopio, cuevas de geodas
// y mecanismos de cambio de carril (prisma refractor, espejo-rebote, puente de luz que se arma).
import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALL_R, Billboard, CartelesDeRuta, Critter, EventStage,
  Soundless, TAU, buildSkyGeo, buildTerrainGeo, getBallitas, laneFrame,
  laneGap, lodPiece, makePlacement, markShared, maxHeight, mulberry32,
  placeAlong, placeAlongInto, routeInfo, scatter, segFrames, segPath,
  switchesOf, useAutoDispose, useInstanced, useWayBounds,
} from './base.jsx'

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT_Q = new THREE.Quaternion()
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

const ESTILO = { color: '#fff8ff', bg: 'rgba(37,20,59,0.94)', border: '#e899ff' }
const ESTILO_PANTALLA = { color: '#f3e5ff', bg: 'rgba(26,12,46,0.94)', border: '#71f1ff', size: 46 }
const ESTILO_META = { color: '#fff9db', bg: 'rgba(42,16,66,0.95)', border: '#ffe066', size: 52 }

const _tmpV = new THREE.Vector3()
const _tmpV2 = new THREE.Vector3()
const _tmpQ = new THREE.Quaternion()
const _tmpQ2 = new THREE.Quaternion()
const _tmpS = new THREE.Vector3()
const _tmpM = new THREE.Matrix4()
const _tmpC = new THREE.Color()
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

  const sph10 = new THREE.SphereGeometry(1, 8, 6)
  const sph8 = new THREE.SphereGeometry(1, 6, 4)
  const cap8 = new THREE.CapsuleGeometry(1, 1, 2, 5)
  const cyl8 = new THREE.CylinderGeometry(1, 1, 1, 6)
  const cyl6 = new THREE.CylinderGeometry(1, 1, 1, 6)
  const cone8 = new THREE.ConeGeometry(1, 1, 6)
  const oct0 = new THREE.OctahedronGeometry(1, 0)
  const tor14 = new THREE.TorusGeometry(1, 0.075, 5, 10)
  const box1 = new THREE.BoxGeometry(1, 1, 1)

  // 1. Hada de luz chibi (cuerpo luminoso, alitas de prisma, halo, ojos grandes)
  const fairy = mergePainted([
    bakePart(sph10, '#fff0b3', 0, 0.28, 0, 0, 0, 0, 0.16, 0.20, 0.16), // vestido luz
    bakePart(sph10, '#ffe6f7', 0, 0.54, 0.02, 0, 0, 0, 0.17, 0.16, 0.17), // cabeza chibi
    bakePart(sph8, '#26143b', -0.065, 0.56, 0.16, 0, 0, 0, 0.028, 0.036, 0.022), // ojo L
    bakePart(sph8, '#26143b', 0.065, 0.56, 0.16, 0, 0, 0, 0.028, 0.036, 0.022), // ojo R
    bakePart(sph8, '#ffffff', -0.058, 0.575, 0.178, 0, 0, 0, 0.011, 0.013, 0.01),
    bakePart(sph8, '#ffffff', 0.072, 0.575, 0.178, 0, 0, 0, 0.011, 0.013, 0.01),
    bakePart(sph8, '#ff94d2', -0.11, 0.50, 0.14, 0, 0, 0, 0.032, 0.02, 0.02), // mejilla L
    bakePart(sph8, '#ff94d2', 0.11, 0.50, 0.14, 0, 0, 0, 0.032, 0.02, 0.02), // mejilla R
    bakePart(oct0, '#71f1ff', -0.22, 0.40, -0.08, 0.25, 0, -0.45, 0.18, 0.03, 0.12), // ala L
    bakePart(oct0, '#71f1ff', 0.22, 0.40, -0.08, 0.25, 0, 0.45, 0.18, 0.03, 0.12), // ala R
    bakePart(tor14, '#ffe066', 0, 0.76, 0, Math.PI / 2, 0, 0, 0.12, 0.12, 0.12), // halo
  ])

  // 2. Gólem de cuarzo chibi (cuerpo facetado, núcleo brillante, ojitos kawaii)
  const buildGolem = () => mergePainted([
    bakePart(oct0, '#9d4edd', 0, 0.32, 0, 0, 0, 0, 0.28, 0.26, 0.25), // torso amatista
    bakePart(oct0, '#71f1ff', 0, 0.32, 0.18, 0, 0, 0, 0.12, 0.12, 0.08), // núcleo prisma
    bakePart(sph10, '#c77dff', 0, 0.62, 0.02, 0, 0, 0, 0.21, 0.17, 0.19), // cabeza chibi
    bakePart(cone8, '#71f1ff', 0, 0.84, 0, 0, 0, 0, 0.08, 0.18, 0.08), // cuerno cristal
    bakePart(sph8, '#fff1a1', -0.075, 0.64, 0.18, 0, 0, 0, 0.034, 0.04, 0.024), // ojo L
    bakePart(sph8, '#fff1a1', 0.075, 0.64, 0.18, 0, 0, 0, 0.034, 0.04, 0.024), // ojo R
    bakePart(cap8, '#7b2cbf', -0.30, 0.30, 0.04, 0, 0, 0.38, 0.075, 0.12, 0.075), // brazo L
    bakePart(cap8, '#7b2cbf', 0.30, 0.30, 0.04, 0, 0, -0.38, 0.075, 0.12, 0.075), // brazo R
    bakePart(sph8, '#5a189a', -0.13, 0.08, 0.03, 0, 0, 0, 0.085, 0.075, 0.10), // pie L
    bakePart(sph8, '#5a189a', 0.13, 0.08, 0.03, 0, 0, 0, 0.085, 0.075, 0.10), // pie R
  ])
  const golem = buildGolem()
  LOD_MUL = 0.3
  const spriteCrowd = buildGolem()
  LOD_MUL = 1

  // 3. Zorro de prisma chibi (orejas de cristal, colita luminosa)
  const fox = mergePainted([
    bakePart(sph10, '#b565ff', 0, 0.24, 0, 0, 0, 0, 0.22, 0.19, 0.24), // cuerpo
    bakePart(sph8, '#f4e6ff', 0, 0.20, 0.12, 0, 0, 0, 0.15, 0.13, 0.12), // pecho
    bakePart(sph10, '#c77dff', 0, 0.46, 0.10, 0, 0, 0, 0.20, 0.17, 0.19), // cabeza
    bakePart(cone8, '#71f1ff', -0.12, 0.66, 0.06, 0.1, 0, 0.28, 0.07, 0.16, 0.07), // oreja L
    bakePart(cone8, '#71f1ff', 0.12, 0.66, 0.06, 0.1, 0, -0.28, 0.07, 0.16, 0.07), // oreja R
    bakePart(sph8, '#1d1030', -0.07, 0.48, 0.27, 0, 0, 0, 0.03, 0.036, 0.022), // ojo L
    bakePart(sph8, '#1d1030', 0.07, 0.48, 0.27, 0, 0, 0, 0.03, 0.036, 0.022), // ojo R
    bakePart(sph8, '#ff9ebb', -0.11, 0.42, 0.23, 0, 0, 0, 0.032, 0.02, 0.02),
    bakePart(sph8, '#ff9ebb', 0.11, 0.42, 0.23, 0, 0, 0, 0.032, 0.02, 0.02),
    bakePart(oct0, '#ffe066', 0, 0.30, -0.32, 0.6, 0, 0, 0.11, 0.22, 0.11), // cola prisma
  ])

  // 4. Cueva de geoda (bóveda rocosa oscura con racimos brillantes en el interior)
  const geode = mergePainted([
    bakePart(sph10, '#2c1d3d', 0, 0.24, 0, 0, 0, 0, 0.52, 0.34, 0.44), // base roca
    bakePart(sph8, '#3f2857', -0.24, 0.34, -0.10, 0, 0, 0.3, 0.26, 0.30, 0.30), // arco izq
    bakePart(sph8, '#3f2857', 0.24, 0.34, -0.10, 0, 0, -0.3, 0.26, 0.30, 0.30), // arco der
    bakePart(oct0, '#d67bff', 0, 0.34, 0.08, 0.1, 0, 0, 0.16, 0.28, 0.16), // cristal central
    bakePart(oct0, '#71f1ff', -0.15, 0.30, 0.14, 0.2, 0, 0.35, 0.11, 0.22, 0.11), // cristal L
    bakePart(oct0, '#ff9de2', 0.15, 0.30, 0.14, 0.2, 0, -0.35, 0.11, 0.22, 0.11), // cristal R
  ])

  // 5. Racimo de cristales cantores (3 agujas facetadas, tintable con instanceColor)
  const cluster = mergePainted([
    bakePart(oct0, '#ffffff', 0, 0.42, 0, 0, 0, 0, 0.13, 0.42, 0.13),
    bakePart(oct0, '#e6d4ff', 0.14, 0.28, 0.06, 0.15, 0, -0.34, 0.09, 0.28, 0.09),
    bakePart(oct0, '#d6f7ff', -0.13, 0.26, -0.05, -0.15, 0, 0.32, 0.085, 0.26, 0.085),
  ])

  // 6. Espejo de prisma (marco dorado/amatista + panel reflector)
  const mirrorFrame = mergePainted([
    bakePart(cyl8, '#4a2b6b', 0, 0.06, 0, 0, 0, 0, 0.26, 0.12, 0.14), // base
    bakePart(box1, '#d6a5ff', -0.22, 0.42, 0, 0, 0, 0, 0.06, 0.66, 0.08), // poste L
    bakePart(box1, '#d6a5ff', 0.22, 0.42, 0, 0, 0, 0, 0.06, 0.66, 0.08), // poste R
    bakePart(box1, '#ffe066', 0, 0.75, 0, 0, 0, 0, 0.52, 0.07, 0.09), // dintel
    bakePart(oct0, '#71f1ff', 0, 0.86, 0, 0, 0, 0, 0.09, 0.12, 0.09), // gema superior
  ])
  const mirrorPane = mergePainted([
    bakePart(box1, '#e0faff', 0, 0.42, 0, 0, 0, 0, 0.38, 0.58, 0.03),
  ])

  // 7. Araña de prisma colgante (cuelga del techo del tubo hacia el centro)
  const chandelier = mergePainted([
    bakePart(cyl6, '#ffe066', 0, 0.08, 0, 0, 0, 0, 0.04, 0.16, 0.04), // cadena
    bakePart(tor14, '#e5aaff', 0, 0.22, 0, Math.PI / 2, 0, 0, 0.30, 0.30, 0.30), // aro superior
    bakePart(oct0, '#71f1ff', 0, 0.36, 0, 0, 0, 0, 0.11, 0.22, 0.11), // prisma central
    bakePart(oct0, '#ff9de2', 0.24, 0.30, 0, 0, 0, 0, 0.06, 0.14, 0.06), // colgante 1
    bakePart(oct0, '#fff0a6', -0.24, 0.30, 0, 0, 0, 0, 0.06, 0.14, 0.06), // colgante 2
    bakePart(oct0, '#71f1ff', 0, 0.30, 0.24, 0, 0, 0, 0.06, 0.14, 0.06), // colgante 3
    bakePart(oct0, '#d6a5ff', 0, 0.30, -0.24, 0, 0, 0, 0.06, 0.14, 0.06), // colgante 4
  ])

  // 8. Anillo de caleidoscopio (estrella geométrica de prismas)
  const kaleido = mergePainted([
    bakePart(tor14, '#e5aaff', 0, 0, 0, 0, 0, 0, 0.82, 0.82, 0.6),
    bakePart(oct0, '#71f1ff', 0, 0.82, 0, 0, 0, 0, 0.09, 0.18, 0.09),
    bakePart(oct0, '#ff9de2', 0, -0.82, 0, 0, 0, 0, 0.09, 0.18, 0.09),
    bakePart(oct0, '#ffe066', 0.82, 0, 0, 0, 0, Math.PI / 2, 0.09, 0.18, 0.09),
    bakePart(oct0, '#71f1ff', -0.82, 0, 0, 0, 0, Math.PI / 2, 0.09, 0.18, 0.09),
  ])

  // 9. Grada de cristal (3 niveles con ribete luminoso)
  const stand = mergePainted([
    bakePart(cyl8, '#2b1b42', 0, 0.08, 0, 0, 0, 0, 0.44, 0.16, 0.92),
    bakePart(cyl8, '#3d265c', -0.10, 0.22, 0, 0, 0, 0, 0.32, 0.16, 0.86),
    bakePart(cyl8, '#51337a', -0.20, 0.36, 0, 0, 0, 0, 0.22, 0.16, 0.80),
    bakePart(cap8, '#71f1ff', -0.25, 0.47, 0, Math.PI / 2, 0, 0, 0.03, 0.68, 0.03),
  ])

  // 10. Farola de prisma, valla de cuarzo, banderín y baldosa puente de luz
  const lamp = mergePainted([
    bakePart(cap8, '#3f2857', 0, 0.34, 0, 0, 0, 0, 0.032, 0.32, 0.032),
    bakePart(cap8, '#7b4ca8', -0.06, 0.68, 0, 0, 0, 0.55, 0.025, 0.11, 0.025),
    bakePart(oct0, '#71f1ff', -0.14, 0.68, 0, 0, 0, 0, 0.08, 0.11, 0.08),
  ])
  const fence = mergePainted([
    bakePart(oct0, '#9d4edd', 0, 0.14, -0.32, 0, 0, 0, 0.04, 0.14, 0.04),
    bakePart(oct0, '#9d4edd', 0, 0.14, 0.32, 0, 0, 0, 0.04, 0.14, 0.04),
    bakePart(cap8, '#71f1ff', 0, 0.22, 0, Math.PI / 2, 0, 0, 0.024, 0.36, 0.024),
  ])
  const pennant = mergePainted([
    bakePart(cone8, '#ffffff', 0, -0.14, 0, Math.PI, 0, 0, 0.14, 0.28, 0.03),
  ])
  const bridgeTile = mergePainted([
    bakePart(box1, '#71f1ff', 0, 0, 0, 0, 0, 0, 0.34, 0.05, 0.26),
  ])
  const orb = new THREE.SphereGeometry(1, 8, 6)

  cyl6.dispose()
  box1.dispose()

  GEOS = markShared({
    fairy, golem, spriteCrowd, fox, geode, cluster, mirrorFrame, mirrorPane,
    chandelier, kaleido, stand, lamp, fence, pennant, bridgeTile, orb,
    sph10, sph8, cap8, cyl8, cone8, oct0, tor14,
  })
  return GEOS
}

// ═══════════════════════════ TEXTURAS Y MATERIALES CACHEADOS ═══════════════════════════
let MATS = null
function getMats() {
  if (MATS) return MATS

  const curbTex = (() => {
    if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([190, 130, 255, 255]), 1, 1)
    const c = document.createElement('canvas')
    c.width = 512; c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#1b1130'
    ctx.fillRect(0, 0, 512, 128)
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#71f1ff' : '#e085ff'
      ctx.fillRect(i * 64, 0, 64, 26)
      ctx.fillRect(i * 64, 102, 64, 26)
    }
    ctx.fillStyle = '#fff3b0'
    ctx.font = 'bold 40px system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('CRISTAL · PRISMA', 256, 66)
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
        ctx.fillStyle = (r + k) % 2 === 0 ? '#24143e' : '#71f1ff'
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
      vertexColors: true, roughness: 0.30, metalness: 0.22, emissive: '#2f1452', emissiveIntensity: 0.30,
    }),
    crystal: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.14, metalness: 0.36, emissive: '#4d1f7a', emissiveIntensity: 0.42,
    }),
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.65, metalness: 0.16, side: THREE.DoubleSide, emissive: '#240f3d', emissiveIntensity: 0.26,
    }),
    mirror: new THREE.MeshStandardMaterial({
      color: '#dff8ff', roughness: 0.06, metalness: 0.90, emissive: '#71f1ff', emissiveIntensity: 0.26,
    }),
    glowCyan: new THREE.MeshBasicMaterial({ color: '#71f1ff', toneMapped: false }),
    glowMagenta: new THREE.MeshBasicMaterial({ color: '#ff85e8', toneMapped: false }),
    glowGold: new THREE.MeshBasicMaterial({ color: '#ffe066', toneMapped: false }),
    glowWhite: new THREE.MeshBasicMaterial({ color: '#fff8ff', toneMapped: false }),
    curb: new THREE.MeshStandardMaterial({
      map: curbTex, roughness: 0.4, metalness: 0.25,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    }),
    checker: new THREE.MeshBasicMaterial({
      map: checkerTex, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    }),
    pennant: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.45, side: THREE.DoubleSide }),
    beam: new THREE.MeshBasicMaterial({
      color: '#a8f5ff', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
    prismBeam: new THREE.MeshBasicMaterial({
      color: '#ff9de2', transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }),
    skyDome: new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false,
    }),
  })
  return MATS
}

// ═══════════════════════════ ALTURA DE TERRENO COMPARTIDA ═══════════════════════════
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

function crystalHillHeight(seg, u, a) {
  const bank = smooth(0.48, 0.68, Math.abs(a))
  const fSeed = (seg.i + 1) * 1.29
  const facet = 0.5 + 0.5 * Math.sin(u * seg.length * 0.48 * fSeed + a * 3.5) * Math.cos(u * seg.length * 0.26 - a * 2.3)
  return THREE.MathUtils.clamp(facet, 0, 1) * bank
}

function crystalSurfaceOffset(seg, u, a) {
  const arc = Math.PI * 0.50
  const edge = 1 - smooth(arc * 0.7, arc, Math.abs(a))
  const gap = laneGap(seg, a)
  const chan = smooth(0.02, 0.32, gap)
  const maxH = Math.min(maxHeight(seg) * 0.40, seg.radius * 0.21)
  const hk = crystalHillHeight(seg, u, a) * edge * chan
  return seg.radius * 0.015 + hk * maxH
}

function seatOnTerrain(items) {
  for (const it of items) {
    const off = crystalSurfaceOffset(it.seg, it.u, it.angle)
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

// ═══════════════════════════ PÓRTICO DE SALIDA Y META PRISMÁTICA ═══════════════════════════
function WelcomePortico({ seg, wayName }) {
  const G = getGeos()
  const M = getMats()
  const p0 = useMemo(() => placeAlong(seg, 0.08, 0.02, 0), [seg])
  const signPos = useMemo(() => p0.pos.clone().addScaledVector(p0.up, 1.05), [p0])
  const signQuat = useMemo(() => p0.quat.clone().multiply(FLIP_Y), [p0])
  return (
    <group name="cristal:portico">
      <group position={p0.pos} quaternion={p0.quat}>
        <mesh position={[-0.64, 0.48, 0]} scale={[0.10, 0.92, 0.10]} geometry={G.oct0} material={M.crystal} />
        <mesh position={[0.64, 0.48, 0]} scale={[0.10, 0.92, 0.10]} geometry={G.oct0} material={M.crystal} />
        <mesh position={[0, 0.98, 0]} scale={[0.56, 0.56, 0.56]} geometry={G.tor14} material={M.glowCyan} />
        <mesh position={[-0.64, 0.96, 0]} scale={0.11} geometry={G.oct0} material={M.glowGold} />
        <mesh position={[0.64, 0.96, 0]} scale={0.11} geometry={G.oct0} material={M.glowGold} />
      </group>
      <Billboard text={`💎 ${wayName.toUpperCase()}`} style={ESTILO_META} position={signPos} quat={signQuat} height={0.34} glow={1.4} />
    </group>
  )
}

function FinishPrismBurst({ seg }) {
  const G = getGeos()
  const M = getMats()
  const p = useMemo(() => placeAlong(seg, 0.88, 0.02, 0), [seg])
  const signPos = useMemo(() => p.pos.clone().addScaledVector(p.up, 1.08), [p])
  const signQuat = useMemo(() => p.quat.clone().multiply(FLIP_Y), [p])
  const burstRef = useRef()

  useFrame(({ clock }) => {
    if (!burstRef.current) return
    const t = clock.elapsedTime * 1.4
    burstRef.current.rotation.z = t * 0.7
    const kids = burstRef.current.children
    for (let i = 0; i < kids.length; i++) {
      const ph = (t + i * 0.25) % 1
      const ang = (i / kids.length) * TAU
      const rad = 0.25 + ph * 0.68
      kids[i].position.set(Math.cos(ang) * rad, 0.62 + Math.sin(ang) * rad * 0.75, 0)
      kids[i].scale.setScalar(0.055 * (1 - ph * 0.5))
    }
  })

  return (
    <group name="cristal:meta">
      <group position={p.pos} quaternion={p.quat}>
        <mesh position={[-0.66, 0.50, 0]} scale={[0.10, 0.96, 0.10]} geometry={G.oct0} material={M.crystal} />
        <mesh position={[0.66, 0.50, 0]} scale={[0.10, 0.96, 0.10]} geometry={G.oct0} material={M.crystal} />
        <mesh position={[0, 1.02, 0]} scale={[0.72, 0.72, 0.72]} geometry={G.kaleido} material={M.clay} />
        <group ref={burstRef}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <mesh key={i} geometry={G.oct0} material={i % 2 === 0 ? M.glowCyan : M.glowGold} />
          ))}
        </group>
      </group>
      <Billboard text="💎 META PRISMA" style={ESTILO_META} position={signPos} quat={signQuat} height={0.34} glow={1.45} />
    </group>
  )
}

// ═══════════════════════════ MECANISMOS DE CAMBIO DE CARRIL ═══════════════════════════
// Prisma refractor (entrada), Espejo-rebote (salida), Puente de luz que se arma (baldosas) y haz óptico.
function LaneSwitchMechanisms({ way }) {
  const G = getGeos()
  const M = getMats()

  const { mechanisms, tileCount } = useMemo(() => {
    const out = []
    let tiles = 0
    for (const seg of way.segments) {
      if (seg.air) continue
      const realSwitches = switchesOf(seg)
      const list = realSwitches.length
        ? realSwitches
        : (seg.route >= 0 || seg.kind === 'salida'
            ? [
                { u: 0.28, from: 0, to: 0, kind: 'portal', duration: 0.8, _synthAngle: (seg.i % 2 === 0 ? 1 : -1) * 1.24 },
                { u: 0.66, from: 0, to: 0, kind: 'bumper', duration: 0.8, _synthAngle: (seg.i % 2 === 0 ? -1 : 1) * 1.46 },
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
        const span = fIn.pos.distanceTo(fOut.pos)
        const mid = fIn.pos.clone().lerp(fOut.pos, 0.5)
        const beamQ = new THREE.Quaternion().setFromUnitVectors(Y, _tmpV.copy(fOut.pos).sub(fIn.pos).normalize())
        const nTiles = 4
        const tileStart = tiles
        tiles += nTiles
        out.push({ seg, uIn, kind: sw.kind, fIn, fOut, qIn, qOut, mid, span, beamQ, tileStart, nTiles })
      }
    }
    return { mechanisms: out, tileCount: tiles }
  }, [way])

  const prismsRef = useRef()
  const mirrorsRef = useRef()
  const bridgesRef = useRef()
  const beamsRef = useRef()
  useWayBounds(prismsRef, way)
  useWayBounds(mirrorsRef, way)
  useWayBounds(bridgesRef, way)
  useWayBounds(beamsRef, way)

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
      const spin = 1.6 + act * 6.5
      if (prismsRef.current) {
        _tmpV.copy(m.fIn.pos).addScaledVector(m.fIn.up, 0.16 + act * 0.08)
        _tmpQ.copy(m.qIn)
        _tmpQ2.setFromAxisAngle(Y, t * spin * (i % 2 === 0 ? 1 : -1))
        _tmpQ.multiply(_tmpQ2)
        _tmpS.set(0.22 + act * 0.07, 0.30 + act * 0.12, 0.22 + act * 0.07)
        _tmpM.compose(_tmpV, _tmpQ, _tmpS)
        prismsRef.current.setMatrixAt(i, _tmpM)
      }
      if (mirrorsRef.current) {
        _tmpV.copy(m.fOut.pos).addScaledVector(m.fOut.up, 0.08)
        _tmpS.setScalar(0.52 + act * 0.14)
        _tmpM.compose(_tmpV, m.qOut, _tmpS)
        mirrorsRef.current.setMatrixAt(i, _tmpM)
      }
      if (bridgesRef.current) {
        for (let j = 0; j < m.nTiles; j++) {
          const frac = (j + 0.5) / m.nTiles
          _tmpV.copy(m.fIn.pos).lerp(m.fOut.pos, frac)
          _tmpV2.copy(m.fIn.up).lerp(m.fOut.up, frac).normalize()
          const assemble = THREE.MathUtils.clamp(act * 1.4 - j * 0.15, 0.18, 1)
          _tmpV.addScaledVector(_tmpV2, 0.06 + (1 - assemble) * 0.18 + Math.sin(t * 3 + j + i) * 0.025)
          _tmpQ.copy(m.qIn).slerp(m.qOut, frac)
          _tmpS.set(0.55 + act * 0.25, 0.6 + act * 0.4, 0.55 + act * 0.25)
          _tmpM.compose(_tmpV, _tmpQ, _tmpS)
          bridgesRef.current.setMatrixAt(m.tileStart + j, _tmpM)
        }
      }
      if (beamsRef.current) {
        _tmpS.set(0.03 + act * 0.05, Math.max(0.2, m.span), 0.03 + act * 0.05)
        _tmpM.compose(m.mid, m.beamQ, _tmpS)
        beamsRef.current.setMatrixAt(i, _tmpM)
      }
    }
    if (prismsRef.current) prismsRef.current.instanceMatrix.needsUpdate = true
    if (mirrorsRef.current) mirrorsRef.current.instanceMatrix.needsUpdate = true
    if (bridgesRef.current) bridgesRef.current.instanceMatrix.needsUpdate = true
    if (beamsRef.current) beamsRef.current.instanceMatrix.needsUpdate = true
  })

  if (!mechanisms.length) return null
  return (
    <group name="cristal:mechanisms">
      <instancedMesh name="cristal:mech-prisms" ref={prismsRef} args={[G.oct0, M.glowCyan, mechanisms.length]} />
      <instancedMesh name="cristal:mech-mirrors" ref={mirrorsRef} args={[G.mirrorPane, M.mirror, mechanisms.length]} />
      {tileCount > 0 && <instancedMesh name="cristal:mech-bridges" ref={bridgesRef} args={[G.bridgeTile, M.glowGold, tileCount]} />}
      <instancedMesh name="cristal:mech-beams" ref={beamsRef} args={[G.cyl8, M.prismBeam, mechanisms.length]} />
    </group>
  )
}

// ═══════════════════════════ EVENTOS POR RUTA (RÁPIDA / LENTA / ESPECTACULAR) ═══════════════════════════
// Ruta A (rápida): Puente de Luz & Prisma Turbo
function CrystalPrismBridgeEvent({ seg }) {
  return <EventStage segment={seg} render={(stage) => <CrystalPrismBridgeStage seg={seg} stage={stage} />} />
}

function CrystalPrismBridgeStage({ seg, stage }) {
  const G = getGeos()
  const M = getMats()
  const ringRef = useRef()
  const tilesRef = useRef()
  const beamRef = useRef()

  const anchor = useMemo(() => placeAlong(seg, 0.50, 0.02, 0), [seg])
  const steps = useMemo(() => [-0.14, -0.07, 0, 0.07, 0.14].map((du) => placeAlong(seg, 0.50 + du, 0.06, 0)), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.55 : stage.phase === 'salida' ? 0.3 : 0.12
    if (ringRef.current) {
      ringRef.current.rotation.z = t * (0.9 + active * 4.2)
      ringRef.current.scale.setScalar(0.68 + active * 0.28)
    }
    if (beamRef.current) {
      beamRef.current.scale.set(0.08 + active * 0.22, 1.35, 0.08 + active * 0.22)
    }
    if (tilesRef.current) {
      const kids = tilesRef.current.children
      for (let i = 0; i < kids.length; i++) {
        const wave = 0.5 + 0.5 * Math.sin(t * 5 - i * 0.9)
        kids[i].scale.set(1.1 + active * 0.4, 0.8 + active * wave * 1.1, 1.1 + active * 0.4)
      }
    }
  })

  return (
    <group name="cristal:event-bridge">
      <group ref={tilesRef}>
        {steps.map((p, i) => (
          <mesh key={i} position={p.pos} quaternion={p.quat} geometry={G.bridgeTile} material={i % 2 === 0 ? M.glowCyan : M.glowMagenta} />
        ))}
      </group>
      <group position={anchor.pos} quaternion={anchor.quat}>
        <mesh ref={ringRef} position={[0, 0.66, 0]} geometry={G.tor14} material={M.glowCyan} />
        <mesh ref={beamRef} position={[0, 0.66, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={G.cyl8} material={M.beam} />
      </group>
    </group>
  )
}

// Ruta B (lenta): Coro de Geodas & Órgano Cantor
function CrystalGeodeChoirEvent({ seg }) {
  return <EventStage segment={seg} render={(stage) => <CrystalGeodeChoirStage seg={seg} stage={stage} />} />
}

function CrystalGeodeChoirStage({ seg, stage }) {
  const G = getGeos()
  const M = getMats()
  const pipesRef = useRef()
  const crownRef = useRef()

  const anchor = useMemo(() => placeAlong(seg, 0.52, 0.02, 0), [seg])
  const pipes = useMemo(() => {
    const out = []
    for (let i = 0; i < 6; i++) {
      const ang = (i - 2.5) * 0.28
      const side = Math.sin(ang) * 0.64
      const up = 0.22 + (1 - Math.abs(ang)) * 0.14
      out.push({ x: side, y: up, z: (i % 2) * 0.18 - 0.09, mat: i % 3 === 0 ? M.glowCyan : i % 3 === 1 ? M.glowMagenta : M.glowGold })
    }
    return out
  }, [M])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.5 : stage.phase === 'salida' ? 0.3 : 0.12
    if (pipesRef.current) {
      const kids = pipesRef.current.children
      for (let i = 0; i < kids.length; i++) {
        const sing = 0.5 + 0.5 * Math.sin(t * (2.4 + active * 4.0) + i * 1.1)
        const h = 0.18 + active * 0.26 * sing
        kids[i].scale.set(0.08 + active * 0.03, h, 0.08 + active * 0.03)
      }
    }
    if (crownRef.current) {
      crownRef.current.rotation.y = t * (0.6 + active * 2.0)
      crownRef.current.scale.setScalar(0.32 + active * 0.18)
    }
  })

  return (
    <group name="cristal:event-choir" position={anchor.pos} quaternion={anchor.quat}>
      <group ref={pipesRef}>
        {pipes.map((p, i) => (
          <mesh key={i} position={[p.x, p.y, p.z]} geometry={G.oct0} material={p.mat} />
        ))}
      </group>
      <mesh ref={crownRef} position={[0, 0.88, 0]} geometry={G.chandelier} material={M.clay} />
    </group>
  )
}

// Ruta C (espectacular): Catedral del Caleidoscopio
function CrystalKaleidoscopeEvent({ seg }) {
  return <EventStage segment={seg} render={(stage) => <CrystalKaleidoscopeStage seg={seg} stage={stage} />} />
}

function CrystalKaleidoscopeStage({ seg, stage }) {
  const G = getGeos()
  const M = getMats()
  const outerRef = useRef()
  const innerRef = useRef()
  const coreRef = useRef()
  const anchor = useMemo(() => placeAlong(seg, 0.50, 0.02, 0), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.55 : stage.phase === 'salida' ? 0.3 : 0.15
    if (outerRef.current) {
      outerRef.current.rotation.z = t * (0.55 + active * 2.2)
      outerRef.current.scale.setScalar(0.76 + active * 0.22)
    }
    if (innerRef.current) {
      innerRef.current.rotation.z = -t * (0.9 + active * 3.1)
      innerRef.current.scale.setScalar(0.50 + active * 0.18)
    }
    if (coreRef.current) {
      coreRef.current.rotation.y = t * 2.4
      coreRef.current.scale.setScalar(0.16 + active * 0.14 * (1 + 0.25 * Math.sin(t * 6)))
    }
  })

  return (
    <group name="cristal:event-kaleidoscope" position={anchor.pos} quaternion={anchor.quat}>
      <mesh ref={outerRef} position={[0, 0.72, 0]} geometry={G.kaleido} material={M.clay} />
      <mesh ref={innerRef} position={[0, 0.72, 0.08]} geometry={G.kaleido} material={M.glowMagenta} />
      <mesh ref={coreRef} position={[0, 0.72, 0]} geometry={G.oct0} material={M.glowGold} />
    </group>
  )
}

// ═══════════════════════════ HADAS DE LUZ EN VUELO ═══════════════════════════
function SkyFairies({ way }) {
  const G = getGeos()
  const M = getMats()
  const meshRef = useRef()
  useWayBounds(meshRef, way)

  const fairies = useMemo(() => {
    const rng = mulberry32(way.idx * 509 + 77)
    const solid = way.segments.filter((s) => !s.air)
    const out = []
    for (let i = 0; i < solid.length; i++) {
      const seg = solid[i]
      const count = seg.length > 22 ? 2 : 1
      for (let k = 0; k < count; k++) {
        out.push({
          seg,
          u0: 0.14 + rng() * 0.72,
          speed: 0.03 + rng() * 0.04,
          dir: (i + k) % 2 === 0 ? 1 : -1,
          angBase: (rng() > 0.5 ? 1 : -1) * (1.55 + rng() * 0.55),
          phase: rng() * TAU,
          scale: 0.18 + rng() * 0.08,
        })
      }
    }
    return out
  }, [way])

  useFrame(({ clock }) => {
    const m = meshRef.current
    if (!m || !fairies.length) return
    const t = clock.elapsedTime
    for (let i = 0; i < fairies.length; i++) {
      const f = fairies[i]
      const u = ((f.u0 + t * f.speed * f.dir) % 1 + 1) % 1
      const ang = f.angBase + Math.sin(t * 1.4 + f.phase) * 0.22
      const off = 0.34 + Math.sin(t * 2.3 + f.phase) * 0.10
      placeAlongInto(f.seg, u, off, ang, _tmpPl)
      _tmpQ.copy(_tmpPl.quat)
      if (f.dir < 0) _tmpQ.multiply(FLIP_Y)
      _tmpS.setScalar(f.scale)
      _tmpM.compose(_tmpPl.pos, _tmpQ, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (!fairies.length) return null
  return <instancedMesh name="cristal:sky-fairies" ref={meshRef} args={[G.fairy, M.clay, fairies.length]} />
}

// ═══════════════════════════ PÚBLICO CHIBI EN GRADAS ═══════════════════════════
function CrystalCrowdAndBehavior({ way, standItems }) {
  const G = getGeos()
  const M = getMats()
  const crowdRef = useRef()
  useWayBounds(crowdRef, way)

  const crowd = useMemo(() => {
    const rng = mulberry32(way.idx * 719 + 41)
    const out = []
    for (let s = 0; s < standItems.length; s++) {
      const st = standItems[s]
      const rows = [
        { d: 0.14, y: 0.19 },
        { d: -0.02, y: 0.33 },
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
      const hop = Math.abs(Math.sin(t * (2.6 + cheer * 8.0) + c.phase)) * (0.025 + cheer * 0.10)
      _tmpV.copy(c.basePos).addScaledVector(c.up, hop)
      _tmpS.setScalar(c.scale)
      _tmpM.compose(_tmpV, c.quat, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (!crowd.length) return null
  return <instancedMesh name="cristal:crowd" ref={crowdRef} args={[G.spriteCrowd, M.clay, crowd.length]} />
}

// ═══════════════════════════ CIELO INTERIOR, CALEIDOSCOPIO Y ESTELAS ═══════════════════════════
function CrystalSkyPhenomena({ way, detail }) {
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
        ? ['#1d1138', '#3c8ce7']
        : sp === 'lenta'
          ? ['#24133d', '#9b5de5']
          : ['#29103b', '#f15bb5']
      geos.push(buildSkyGeo(seg, { radial: 12, along: Math.max(10, Math.ceil(seg.length * 0.55)), colors }))
    }
    if (!geos.length) return null
    const merged = mergeGeometries(geos, false)
    for (const g of geos) g.dispose()
    return merged
  }, [way])
  useAutoDispose(skyGeo)

  const kaleidoRings = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (seg.air || seg.length < 12) continue
      const n = highDetail ? Math.max(1, Math.floor(seg.length / 26)) : 1
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const p = placeAlong(seg, u, 0.08, Math.PI * 0.94)
        out.push({ pos: p.pos, quat: p.quat, phase: seg.i * 0.7 + i })
      }
    }
    return out
  }, [way, highDetail])

  const kaleidoRef = useRef()
  useWayBounds(kaleidoRef, way)

  const moteCount = highDetail ? 150 : 75
  const motes = useMemo(() => {
    const rng = mulberry32(way.idx * 829 + 19)
    const solid = way.segments.filter((s) => !s.air)
    const out = []
    if (!solid.length) return out
    for (let i = 0; i < moteCount; i++) {
      const seg = solid[i % solid.length]
      out.push({
        seg,
        u0: rng(),
        ang: (rng() - 0.5) * 2.5,
        off: 0.22 + rng() * 0.45,
        speed: 0.02 + rng() * 0.03,
        scale: 0.022 + rng() * 0.026,
      })
    }
    return out
  }, [way, moteCount])

  const moteRef = useRef()
  useWayBounds(moteRef, way)

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (kaleidoRef.current && kaleidoRings.length) {
      for (let i = 0; i < kaleidoRings.length; i++) {
        const kr = kaleidoRings[i]
        _tmpQ.copy(kr.quat)
        _tmpQ2.setFromAxisAngle(Z, t * 0.55 + kr.phase)
        _tmpQ.multiply(_tmpQ2)
        _tmpS.setScalar(0.38)
        _tmpM.compose(kr.pos, _tmpQ, _tmpS)
        kaleidoRef.current.setMatrixAt(i, _tmpM)
      }
      kaleidoRef.current.instanceMatrix.needsUpdate = true
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
    <group name="cristal:sky">
      {skyGeo && (
        <mesh name="cristal:sky-dome" geometry={skyGeo} material={M.skyDome} />
      )}
      {kaleidoRings.length > 0 && (
        <instancedMesh name="cristal:sky-kaleidoscopes" ref={kaleidoRef} args={[G.kaleido, M.clay, kaleidoRings.length]} />
      )}
      {motes.length > 0 && (
        <instancedMesh name="cristal:sky-motes" ref={moteRef} args={[G.orb, M.glowCyan, motes.length]} />
      )}
    </group>
  )
}

// ═══════════════════════════ CRISTALES QUE CANTAN Y SE ILUMINAN EN CADENA ═══════════════════════════
const SING_PALETTE = ['#71f1ff', '#d6a5ff', '#ff85e8', '#ffe066']

function ReactiveSingingCrystals({ way }) {
  const G = getGeos()
  const M = getMats()
  const meshRef = useRef()
  useWayBounds(meshRef, way)

  const crystals = useMemo(() => {
    const items = []
    for (const seg of way.segments) {
      if (seg.air) continue
      const n = Math.max(3, Math.floor(seg.length / 6.2))
      for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n
        const side = i % 2 === 0 ? 1 : -1
        const ang = side * (0.62 + (i % 3) * 0.14)
        if (laneGap(seg, ang) > 0.16) {
          const p = placeAlong(seg, u, crystalSurfaceOffset(seg, u, ang), ang)
          items.push({
            seg,
            u,
            pos: p.pos,
            quat: p.quat,
            baseScale: 0.34 + (i % 3) * 0.08,
            baseColor: new THREE.Color(SING_PALETTE[(i + seg.i) % SING_PALETTE.length]),
          })
        }
      }
    }
    return items
  }, [way])

  useFrame(({ clock }) => {
    const m = meshRef.current
    if (!m || !crystals.length) return
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < crystals.length; i++) {
      const cr = crystals[i]
      let act = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === cr.seg) {
          const d = Math.abs((b.segT ?? 0) - cr.u)
          if (d < 0.18) act = Math.max(act, 1 - d / 0.18)
        }
      }
      const singPulse = act > 0.02 ? Math.sin(t * 14 - i * 0.7) * 0.16 * act : 0
      const sc = cr.baseScale * (1 + act * 0.55 + singPulse)
      _tmpS.set(sc, sc * (1 + act * 0.35), sc)
      _tmpM.compose(cr.pos, cr.quat, _tmpS)
      m.setMatrixAt(i, _tmpM)
      _tmpC.copy(cr.baseColor).lerp(M.glowWhite.color, act * 0.65)
      m.setColorAt(i, _tmpC)
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })

  if (!crystals.length) return null
  return <instancedMesh name="cristal:singing-crystals" ref={meshRef} args={[G.cluster, M.crystal, crystals.length]} />
}

// ═══════════════════════════ ANILLOS EN TRAMOS AÉREOS ═══════════════════════════
function CrystalAirRings({ way }) {
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
        out.push({ pos: p.pos, quat: p.quat, scale: 0.62, phase: seg.i + i })
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
      _tmpQ2.setFromAxisAngle(Z, t * 1.1 + r.phase)
      _tmpQ.multiply(_tmpQ2)
      _tmpS.setScalar(r.scale)
      _tmpM.compose(r.pos, _tmpQ, _tmpS)
      m.setMatrixAt(i, _tmpM)
    }
    m.instanceMatrix.needsUpdate = true
  })

  if (!rings.length) return null
  return <instancedMesh name="cristal:air-rings" ref={ref} args={[G.kaleido, M.glowCyan, rings.length]} />
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
        ? ['#231542', '#71f1ff']
        : sp === 'lenta'
          ? ['#2d194a', '#c77dff']
          : ['#2b133d', '#ff85e8']

      const maxH = Math.min(maxHeight(seg) * 0.40, seg.radius * 0.21)
      terrains.push(
        buildTerrainGeo(seg, {
          arc: Math.PI * 0.50,
          maxH,
          radial: 14,
          along: Math.ceil(seg.length * 0.9),
          colors,
          height: (u, a) => crystalHillHeight(seg, u, a),
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
    const rng = mulberry32(way.idx * 2111 + 61)
    const solid = info.segments.filter((s) => !s.air).map((s) => s.seg)

    const geodes = seatOnTerrain(scatter(way, 20, rng, {
      angle: [-1.32, 1.32], clear: BALL_R * 0.88, offset: [0.02, 0.06], scale: [0.46, 0.78],
    }))
    const clusters = seatOnTerrain(scatter(way, 34, rng, {
      angle: [-1.28, 1.28], clear: BALL_R * 0.70, offset: [0.02, 0.06], scale: [0.36, 0.68],
    }))
    const mirrors = seatOnTerrain(scatter(way, 16, rng, {
      angle: [-1.18, 1.18], clear: BALL_R * 0.80, offset: [0.02, 0.05], scale: [0.42, 0.62],
    }))

    // Arañas de prisma colgando del techo interior del tubo
    const chandeliers = []
    for (const seg of solid) {
      const nC = Math.max(1, Math.floor(seg.length / 20))
      for (let i = 0; i < nC; i++) {
        const u = (i + 0.5) / nC
        const ang = (i % 2 === 0 ? 1 : -1) * 2.85
        const p = placeAlong(seg, u, 0.04, ang)
        chandeliers.push({ pos: p.pos, quat: p.quat, scale: 0.62 })
      }
    }

    const stands = []
    for (const seg of solid) {
      const nSt = Math.max(1, Math.floor(seg.length / 26))
      for (let i = 0; i < nSt; i++) {
        const u = (i + 0.5) / nSt
        const side = (i + seg.i) % 2 === 0 ? 1 : -1
        const angle = side * 0.78
        if (laneGap(seg, angle) > BALL_R * 0.45 / Math.max(seg.radius, 1)) {
          const off = crystalSurfaceOffset(seg, u, angle)
          const p = placeAlong(seg, u, off, angle)
          const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? Math.PI : 0))
          stands.push({ seg, u, angle, off, pos: p.pos, quat: q, scale: [0.76, 0.76, 0.88] })
        }
      }
    }

    const lamps = []; const fences = []; const pennants = []; const screens = []
    const penCols = ['#71f1ff', '#e085ff', '#ffe066', '#ff85e8']
    for (const seg of solid) {
      const rt = info.routes[seg.route]
      const sp = rt?.profile?.speed
      const lampStep = sp === 'rapida' ? 10 : 8.5
      const nL = Math.max(2, Math.floor(seg.length / lampStep))
      for (let i = 0; i < nL; i++) {
        const u = (i + 0.35) / nL
        const side = i % 2 === 0 ? 1 : -1
        const p = placeAlong(seg, u, crystalSurfaceOffset(seg, u, side * 0.54), side * 0.54)
        const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? 0 : Math.PI))
        lamps.push({ pos: p.pos, quat: q, scale: 0.48 })
        const fp = placeAlong(seg, u, crystalSurfaceOffset(seg, u, -side * 0.52), -side * 0.52)
        fences.push({ pos: fp.pos, quat: fp.quat, scale: 0.72 })
      }
      const nP = Math.max(2, Math.floor(seg.length / 7.5))
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
        const label = sp === 'rapida' ? '⚡ PUENTE PRISMA' : sp === 'lenta' ? '🎵 CORO DE GEODAS' : '🔮 CALEIDOSCOPIO'
        screens.push({ key: seg.i, pos: p.pos, quat: q, text: label, sub: seg.name })
      }
    }

    const horizon = scatter(way, 18, rng, {
      angle: [1.38, 1.72], clear: 0, offset: [0.02, 0.05], scale: [0.30, 0.52],
    }).concat(scatter(way, 18, rng, {
      angle: [-1.72, -1.38], clear: 0, offset: [0.02, 0.05], scale: [0.30, 0.52],
    }))

    return { geodes, clusters, mirrors, chandeliers, stands, lamps, fences, pennants, screens, horizon }
  }, [way, info])

  const eventEls = useMemo(() => {
    const out = []
    for (const si of info.events) {
      if (si.route === 0) out.push(<CrystalPrismBridgeEvent key={si.i} seg={si.seg} />)
      else if (si.route === 1) out.push(<CrystalGeodeChoirEvent key={si.i} seg={si.seg} />)
      else out.push(<CrystalKaleidoscopeEvent key={si.i} seg={si.seg} />)
    }
    for (const rt of info.routes) {
      const extra = rt.segments.find((s) => !s.air && !s.event && s.route >= 0 && s.seg !== rt.segments[1]?.seg)
      if (extra) {
        if (rt.r === 0) out.push(<CrystalPrismBridgeEvent key={`x-${extra.i}`} seg={extra.seg} />)
        else if (rt.r === 1) out.push(<CrystalGeodeChoirEvent key={`x-${extra.i}`} seg={extra.seg} />)
        else out.push(<CrystalKaleidoscopeEvent key={`x-${extra.i}`} seg={extra.seg} />)
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
    <group name="vida-cristal">
      {trackParts.terrain && <mesh name="cristal:terrain" geometry={trackParts.terrain} material={M.terrain} receiveShadow />}
      {trackParts.curb && <mesh name="cristal:curb" geometry={trackParts.curb} material={M.curb} />}
      {trackParts.checker && <mesh name="cristal:checker" geometry={trackParts.checker} material={M.checker} />}
      <CrystalSkyPhenomena way={way} detail={detail} />

      {salidaSeg && <WelcomePortico seg={salidaSeg} wayName={way.theme.name} />}
      {llegadaSeg && <FinishPrismBurst seg={llegadaSeg} />}
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#6d3b96" angle={0.92} height={0.32} />

      {props.screens.map((sc) => (
        <Billboard key={sc.key} text={sc.text} style={{ ...ESTILO_PANTALLA, sub: sc.sub }} height={0.28} position={sc.pos} quat={sc.quat} glow={1.30} />
      ))}

      <NamedInstanced name="cristal:geodes" geo={G.geode} mat={M.clay} items={props.geodes} />
      <NamedInstanced name="cristal:clusters" geo={G.cluster} mat={M.crystal} items={props.clusters} />
      <NamedInstanced name="cristal:mirror-frames" geo={G.mirrorFrame} mat={M.clay} items={props.mirrors} />
      <NamedInstanced name="cristal:mirror-panes" geo={G.mirrorPane} mat={M.mirror} items={props.mirrors} />
      <NamedInstanced name="cristal:chandeliers" geo={G.chandelier} mat={M.clay} items={props.chandeliers} />
      <NamedInstanced name="cristal:stands" geo={G.stand} mat={M.clay} items={props.stands} />
      <NamedInstanced name="cristal:lamps" geo={G.lamp} mat={M.clay} items={props.lamps} />
      <NamedInstanced name="cristal:fences" geo={G.fence} mat={M.clay} items={props.fences} />
      <NamedInstanced name="cristal:pennants" geo={G.pennant} mat={M.pennant} items={props.pennants} />
      <NamedInstanced name="cristal:horizon" geo={G.cluster} mat={M.crystal} items={props.horizon} />

      <LaneSwitchMechanisms way={way} />

      {eventEls}
      <CrystalAirRings way={way} />

      <Critter way={way} segments={route0Segs} count={9} geo={G.golem} mat={M.clay} scale={0.23} speed={0.8} offset={0.20} angle={0.62} spread={0.14} hop={0.26} seed={101} />
      <Critter way={way} segments={route1Segs ?? route0Segs} count={9} geo={G.fox} mat={M.clay} scale={0.22} speed={0.92} offset={0.20} angle={-0.60} spread={0.14} hop={0.30} seed={202} />
      <Critter way={way} segments={route2Segs ?? route0Segs} count={9} geo={G.fairy} mat={M.clay} scale={0.23} speed={1.08} offset={0.22} angle={0.58} spread={0.14} hop={0.34} seed={303} />
      <SkyFairies way={way} />
      <CrystalCrowdAndBehavior way={way} standItems={props.stands} />
      <ReactiveSingingCrystals way={way} />

      <Soundless />
    </group>
  )
}
