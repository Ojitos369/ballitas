// Mecanismos de cambio de carril, señalización previa, anclajes en ambos carriles y arcos punteados.
// Todo instanciado por tipo por camino, con materiales/geometrías en caché de módulo y LOD sin asignaciones por cuadro.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as WORLD from '../../../Core/world.js'
import { bermaAjusta, getBallitas, getWayDetail, Instanced, markShared, mergeColoredParts, vidaSharedMats } from './base.jsx'
import { basisQuat } from './dyn.js'
import { halfWidth, lanesOf, pal, surfFrame, TERR, CURB } from './pista.jsx'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const ARC_DOTS = 11

// ═══════════════════════════ GEOMETRÍAS BASE Y DE SEÑALIZACIÓN ═══════════════════════════
function buildChevronGeo() {
  const armL = new THREE.BoxGeometry(0.14, 0.028, 0.56).rotateY(0.58).translate(-0.15, 0.014, 0)
  const armR = new THREE.BoxGeometry(0.14, 0.028, 0.56).rotateY(-0.58).translate(0.15, 0.014, 0)
  const g = mergeGeometries([armL, armR], false)
  armL.dispose(); armR.dispose()
  g.name = 'eventos:chevron'
  return markShared(g)
}

function buildBeaconPostGeo() {
  return mergeColoredParts([
    [new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8).translate(0, 0.04, 0), '#242a35'],
    [new THREE.CylinderGeometry(0.045, 0.055, 0.72, 7).translate(0, 0.4, 0), '#3a4252'],
    [new THREE.CylinderGeometry(0.34, 0.34, 0.08, 8).rotateX(Math.PI / 2).translate(0, 0.82, 0), '#1b2029'],
  ], 'eventos:beaconPost')
}

function buildBeaconArrowGeo() {
  const shaft = new THREE.BoxGeometry(0.24, 0.085, 0.11).translate(-0.08, 0, 0)
  const head = new THREE.ConeGeometry(0.14, 0.24, 4).rotateY(Math.PI / 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.45).translate(0.14, 0, 0)
  const g = mergeGeometries([shaft, head], false)
  shaft.dispose(); head.dispose()
  g.name = 'eventos:beaconArrow'
  return markShared(g)
}

function buildAnchorPadGeo() {
  return mergeColoredParts([
    [new THREE.CylinderGeometry(0.54, 0.58, 0.024, 10).translate(0, 0.012, 0), '#1f242e'],
    [new THREE.CylinderGeometry(0.36, 0.36, 0.028, 8).translate(0, 0.014, 0), '#303846'],
  ], 'eventos:anchorPad')
}

function buildAnchorRingGeo(doubleRing = false) {
  const outer = new THREE.TorusGeometry(0.49, 0.042, 5, 16).rotateX(Math.PI / 2).scale(1, 0.42, 1)
  if (!doubleRing) {
    outer.name = 'eventos:anchorRing'
    return markShared(outer)
  }
  const inner = new THREE.TorusGeometry(0.27, 0.036, 5, 12).rotateX(Math.PI / 2).scale(1, 0.42, 1)
  const g = mergeGeometries([outer, inner], false)
  outer.dispose(); inner.dispose()
  g.name = 'eventos:landingRing'
  return markShared(g)
}

function buildArcDotGeo() {
  const g = new THREE.ConeGeometry(0.085, 0.24, 6).rotateX(Math.PI / 2)
  g.name = 'eventos:arcDot'
  return markShared(g)
}

const G = {
  sphere: markShared(new THREE.SphereGeometry(1, 8, 6)),
  box: markShared(new THREE.BoxGeometry(1, 1, 1)),
  chevron: buildChevronGeo(),
  beaconPost: buildBeaconPostGeo(),
  beaconArrow: buildBeaconArrowGeo(),
  anchorPad: buildAnchorPadGeo(),
  originRing: buildAnchorRingGeo(false),
  landRing: buildAnchorRingGeo(true),
  arcDot: buildArcDotGeo(),
  strut: markShared(new THREE.BoxGeometry(0.09, 0.06, 1)),
}

// ═══════════════════════════ MATERIALES COMPARTIDOS ═══════════════════════════
const { decal: EMISSIVE_INST_MAT, glow: GLOW_MAT, body: BODY_VTX_MAT } = vidaSharedMats()
const STRUT_MAT = markShared(new THREE.MeshLambertMaterial({ color: '#2b3240' }))
const TRAIL_MAT = markShared(new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }))
export const eventosWarmup = () => [EMISSIVE_INST_MAT, GLOW_MAT, BODY_VTX_MAT, STRUT_MAT, TRAIL_MAT]

// ═══════════════════════════ PIEZAS COHERENTES POR KIND ═══════════════════════════
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d)
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const cyl = (rt, rb, h, segs, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, segs)
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const cone = (r, h, segs, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const g = new THREE.ConeGeometry(r, h, segs)
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const torus = (r, tube, x = 0, y = 0, z = 0, rx = Math.PI / 2, ry = 0, rz = 0) => {
  const g = new THREE.TorusGeometry(r, tube, 5, 14)
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const sphere = (r, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) =>
  new THREE.SphereGeometry(r, 8, 6).scale(sx, sy, sz).translate(x, y, z)

const KIND_CACHE = new Map()
function buildKindSpec(kind) {
  const DARK = '#242a36'
  const STEEL = '#566070'
  const STONE = '#4a474f'
  const WOOD = '#6b4730'
  const LEAF = '#358446'
  const LEAF2 = '#47a359'
  let bodyParts = []; let glowParts = []; let animParts = []
  let animMode = 'pulseY'; let animColor = null

  switch (kind) {
    case 'geiser':
    case 'cascada':
      bodyParts = [
        [cyl(0.46, 0.62, 0.24, 9, 0, 0.12, 0), STONE],
        [cyl(0.32, 0.42, 0.22, 9, 0, 0.3, 0), DARK],
        [box(0.24, 0.18, 0.22, 0.34, 0.12, 0.18, 0, 0.4), '#656c78'],
        [box(0.22, 0.16, 0.2, -0.34, 0.1, -0.16, 0, -0.5), '#5a606c'],
      ]
      glowParts = [[torus(0.36, 0.05, 0, 0.41, 0), '#ffffff']]
      animParts = [
        [cyl(0.14, 0.22, 0.85, 8, 0, 0.42, 0), '#ffffff'],
        [torus(0.28, 0.045, 0, 0.85, 0), '#ffffff'],
      ]
      animMode = kind === 'cascada' ? 'cascade' : 'geyser'
      animColor = '#4fe3ff'
      break

    case 'erupcion':
      bodyParts = [
        [cyl(0.28, 0.68, 0.56, 9, 0, 0.28, 0), '#352625'],
        [cyl(0.45, 0.72, 0.14, 9, 0, 0.07, 0), '#241a1a'],
        [box(0.22, 0.24, 0.18, 0.38, 0.16, 0.12, 0, 0.3, -0.3), '#4a322e'],
      ]
      glowParts = [
        [torus(0.28, 0.055, 0, 0.57, 0), '#ffffff'],
        [box(0.08, 0.34, 0.06, 0, 0.34, 0.42, -0.45), '#ffffff'],
      ]
      animParts = [[sphere(0.24, 1, 1.25, 1, 0, 0.72, 0), '#ffffff']]
      animMode = 'erupt'
      animColor = '#ff7430'
      break

    case 'arbol':
      bodyParts = [
        [cyl(0.14, 0.26, 0.26, 7, 0, 0.13, 0), WOOD],
        [cyl(0.1, 0.15, 0.86, 7, 0, 0.65, 0), WOOD],
        [cyl(0.05, 0.08, 0.48, 6, 0.18, 0.9, 0.06, 0, -0.65), WOOD],
        [cyl(0.05, 0.07, 0.42, 6, -0.18, 0.98, -0.04, 0, 0.6), WOOD],
        [sphere(0.42, 1.15, 0.85, 1.1, 0, 1.42, 0), LEAF],
        [sphere(0.29, 1.1, 0.9, 1.0, 0.28, 1.22, 0.12), LEAF2],
        [sphere(0.27, 1.0, 0.9, 1.1, -0.26, 1.28, -0.1), LEAF2],
      ]
      glowParts = [[torus(0.22, 0.04, 0, 1.06, 0), '#ffffff']]
      animParts = [[sphere(0.11, 1, 1.25, 1, 0.28, 0.92, 0.1), '#ffffff']]
      animMode = 'sway'
      animColor = '#a8ff60'
      break

    case 'tirolina':
      bodyParts = [
        [cyl(0.06, 0.09, 1.35, 6, -0.32, 0.67, 0, 0, -0.14), STEEL],
        [cyl(0.06, 0.09, 1.35, 6, 0.32, 0.67, 0, 0, 0.14), STEEL],
        [box(0.7, 0.1, 0.14, 0, 1.32, 0), DARK],
        [box(0.84, 0.08, 0.32, 0, 0.04, 0), DARK],
      ]
      glowParts = [[box(0.14, 0.08, 0.85, 0, 1.38, 0), '#ffffff']]
      animParts = [[torus(0.16, 0.045, 0, 1.16, 0, 0, Math.PI / 2), '#ffffff']]
      animMode = 'glideZ'
      break

    case 'viento':
    case 'turbina':
      bodyParts = [
        [box(0.56, 0.12, 0.46, 0, 0.06, 0), DARK],
        [cyl(0.1, 0.14, 0.72, 7, 0, 0.42, 0), STEEL],
        [torus(0.46, 0.08, 0, 0.95, 0, 0, 0, 0), DARK],
        [cyl(0.12, 0.12, 0.3, 8, 0, 0.95, 0, Math.PI / 2), STEEL],
      ]
      glowParts = [[torus(0.48, 0.038, 0, 0.95, 0.06, 0, 0, 0), '#ffffff']]
      animParts = [
        [box(0.09, 0.76, 0.04, 0, 0, 0), '#ffffff'],
        [box(0.09, 0.76, 0.04, 0, 0, 0, 0, 0, Math.PI / 3), '#ffffff'],
        [box(0.09, 0.76, 0.04, 0, 0, 0, 0, 0, -Math.PI / 3), '#ffffff'],
      ]
      animMode = 'spinRotor'
      break

    case 'portal':
      bodyParts = [
        [box(0.95, 0.12, 0.36, 0, 0.06, 0), DARK],
        [box(0.16, 1.25, 0.22, -0.42, 0.68, 0, 0, 0, -0.1), STEEL],
        [box(0.16, 1.25, 0.22, 0.42, 0.68, 0, 0, 0, 0.1), STEEL],
        [box(0.84, 0.14, 0.24, 0, 1.32, 0), DARK],
      ]
      glowParts = [[torus(0.42, 0.05, 0, 0.74, 0, 0, 0, 0), '#ffffff']]
      animParts = [[torus(0.28, 0.04, 0, 0, 0, 0, 0, 0), '#ffffff']]
      animMode = 'spinPortal'
      break

    case 'iman':
      bodyParts = [
        [box(0.68, 0.12, 0.44, 0, 0.06, 0), DARK],
        [box(0.64, 0.18, 0.2, 0, 0.26, 0), '#b73239'],
        [box(0.16, 0.66, 0.2, -0.24, 0.64, 0), '#b73239'],
        [box(0.16, 0.66, 0.2, 0.24, 0.64, 0), '#2d6cdf'],
      ]
      glowParts = [
        [box(0.18, 0.12, 0.22, -0.24, 1.0, 0), '#ffffff'],
        [box(0.18, 0.12, 0.22, 0.24, 1.0, 0), '#ffffff'],
      ]
      animParts = [[torus(0.2, 0.036, 0, 0, 0, Math.PI / 2), '#ffffff']]
      animMode = 'magnetPulse'
      break

    case 'bumper':
      bodyParts = [
        [cyl(0.32, 0.42, 0.14, 8, 0, 0.07, 0), DARK],
        [cyl(0.12, 0.14, 0.42, 8, 0, 0.34, 0), STEEL],
        [cyl(0.52, 0.44, 0.18, 10, 0, 0.56, 0), DARK],
        [sphere(0.34, 1, 0.55, 1, 0, 0.66, 0), '#d94c4c'],
      ]
      glowParts = [[torus(0.52, 0.048, 0, 0.56, 0), '#ffffff']]
      animParts = [[torus(0.58, 0.036, 0, 0, 0), '#ffffff']]
      animMode = 'bumperPulse'
      break

    case 'resorte':
      bodyParts = [
        [cyl(0.42, 0.48, 0.1, 8, 0, 0.05, 0), DARK],
        [torus(0.28, 0.055, 0, 0.2, 0), STEEL],
        [torus(0.28, 0.055, 0, 0.38, 0), STEEL],
        [torus(0.28, 0.055, 0, 0.56, 0), STEEL],
      ]
      glowParts = [[torus(0.3, 0.04, 0, 0.47, 0), '#ffffff']]
      animParts = [
        [cyl(0.42, 0.38, 0.12, 10, 0, 0, 0), '#ffffff'],
        [torus(0.42, 0.04, 0, 0.06, 0), '#ffffff'],
      ]
      animMode = 'springBounce'
      break

    case 'remolino':
      bodyParts = [
        [cyl(0.44, 0.56, 0.14, 10, 0, 0.07, 0), DARK],
        [cone(0.46, 0.72, 10, 0, 0.5, 0, Math.PI), '#303b52'],
      ]
      glowParts = [[torus(0.48, 0.042, 0, 0.16, 0), '#ffffff']]
      animParts = [
        [torus(0.42, 0.04, 0, 0, 0, Math.PI / 2, 0.25), '#ffffff'],
        [torus(0.28, 0.036, 0, 0.25, 0, Math.PI / 2, -0.25), '#ffffff'],
      ]
      animMode = 'spinWhirl'
      break

    case 'cinta':
    case 'hielo_resbaloso':
      bodyParts = [
        [box(0.84, 0.14, 1.08, 0, 0.16, 0, -0.22), kind === 'hielo_resbaloso' ? '#689cc2' : DARK],
        [cyl(0.1, 0.1, 0.88, 8, 0, 0.14, -0.35, 0, Math.PI / 2), STEEL],
        [cyl(0.1, 0.1, 0.88, 8, 0, 0.22, 0, 0, Math.PI / 2), STEEL],
        [cyl(0.1, 0.1, 0.88, 8, 0, 0.3, 0.35, 0, Math.PI / 2), STEEL],
      ]
      glowParts = [
        [box(0.08, 0.05, 1.05, -0.38, 0.26, 0, -0.22), '#ffffff'],
        [box(0.08, 0.05, 1.05, 0.38, 0.26, 0, -0.22), '#ffffff'],
      ]
      animParts = [[box(0.56, 0.05, 0.16, 0, 0.27, 0, -0.22), '#ffffff']]
      animMode = 'glideBelt'
      animColor = kind === 'hielo_resbaloso' ? '#9ee8ff' : null
      break

    case 'pantano':
      bodyParts = [
        [torus(0.5, 0.11, 0, 0.11, 0), '#3d382c'],
        [cyl(0.46, 0.46, 0.08, 10, 0, 0.06, 0), '#2b4729'],
        [box(0.22, 0.16, 0.2, -0.44, 0.12, 0.2, 0, 0.4), STONE],
      ]
      glowParts = [[torus(0.42, 0.032, 0, 0.14, 0), '#ffffff']]
      animParts = [
        [sphere(0.1, 1, 1, 1, -0.14, 0, 0.1), '#ffffff'],
        [sphere(0.13, 1, 1, 1, 0.12, 0.06, -0.08), '#ffffff'],
        [sphere(0.08, 1, 1, 1, 0.02, -0.02, 0.18), '#ffffff'],
      ]
      animMode = 'bubbleBog'
      animColor = '#9be066'
      break

    case 'canon':
      bodyParts = [
        [box(0.7, 0.18, 0.64, 0, 0.09, 0), DARK],
        [box(0.12, 0.34, 0.36, -0.28, 0.28, -0.05), STEEL],
        [box(0.12, 0.34, 0.36, 0.28, 0.28, -0.05), STEEL],
        [cyl(0.22, 0.27, 0.96, 10, 0, 0.56, 0.14, 1.02), DARK],
      ]
      glowParts = [[torus(0.24, 0.045, 0, 0.8, 0.54, 0.55), '#ffffff']]
      animParts = [[torus(0.26, 0.04, 0, 0, 0, 0.55), '#ffffff']]
      animMode = 'cannonPulse'
      break

    case 'caida':
      bodyParts = [
        [box(0.84, 0.12, 0.42, 0, 0.06, 0), DARK],
        [box(0.12, 0.95, 0.14, -0.34, 0.54, 0), STEEL],
        [box(0.12, 0.95, 0.14, 0.34, 0.54, 0), STEEL],
        [box(0.82, 0.12, 0.2, 0, 1.02, 0), DARK],
      ]
      glowParts = [[torus(0.26, 0.042, 0, 0.68, 0, Math.PI / 2), '#ffffff']]
      animParts = [[torus(0.24, 0.038, 0, 0, 0, Math.PI / 2), '#ffffff']]
      animMode = 'dropPulse'
      break

    default: // 'rampa'
      bodyParts = [
        [box(0.95, 0.1, 0.96, 0, 0.05, 0), DARK],
        [box(0.84, 0.14, 0.96, 0, 0.26, 0.06, -0.34), STEEL],
        [box(0.08, 0.24, 0.96, -0.44, 0.3, 0.06, -0.34), DARK],
        [box(0.08, 0.24, 0.96, 0.44, 0.3, 0.06, -0.34), DARK],
      ]
      glowParts = [
        [box(0.07, 0.045, 0.94, -0.38, 0.35, 0.06, -0.34), '#ffffff'],
        [box(0.07, 0.045, 0.94, 0.38, 0.35, 0.06, -0.34), '#ffffff'],
        [box(0.68, 0.06, 0.1, 0, 0.44, 0.48, -0.34), '#ffffff'],
      ]
      animParts = [[torus(0.32, 0.04, 0, 0, 0, 0, 0, 0), '#ffffff']]
      animMode = 'rampBoost'
      break
  }

  return {
    body: mergeColoredParts(bodyParts, `eventos:${kind}:body`),
    glow: mergeColoredParts(glowParts, `eventos:${kind}:glow`),
    anim: mergeColoredParts(animParts, `eventos:${kind}:anim`),
    animMode,
    animColor,
  }
}

function getKindSpec(kind) {
  if (!KIND_CACHE.has(kind)) KIND_CACHE.set(kind, buildKindSpec(kind))
  return KIND_CACHE.get(kind)
}

// ═══════════════════════════ DATOS CACHEADOS POR CAMINO ═══════════════════════════
const _dst = {}
export function destSide(seg, sw, f) {
  const b = surfFrame(seg, sw.to, sw.u, _dst)
  const d = b.pos.clone().sub(f.pos).dot(f.side)
  return d < 0 ? -1 : 1
}

const P0 = new THREE.Vector3(); const P1 = new THREE.Vector3(); const P2 = new THREE.Vector3()
function arcPoint(seg, sw, t, out) {
  if (typeof WORLD.switchArc === 'function') {
    const f = WORLD.switchArc(seg, sw, t)
    if (f?.pos) return out.copy(f.pos)
  }
  const a = WORLD.laneFrame(seg, sw.from, sw.u)
  const uLand = sw.uLand ?? Math.min(1, sw.u + 0.05)
  const b = WORLD.laneFrame(seg, sw.to, uLand)
  P0.copy(a.pos); P2.copy(b.pos)
  const up = a.up?.clone?.() ?? Y_AXIS
  P1.copy(P0).add(P2).multiplyScalar(0.5).addScaledVector(up, sw.apex ?? Math.max(1.2, P0.distanceTo(P2) * 0.25))
  const q = 1 - t
  return out.copy(P0).multiplyScalar(q * q).addScaledVector(P1, 2 * q * t).addScaledVector(P2, t * t)
}

const _bM = new THREE.Matrix4(); const _bX = new THREE.Vector3(); const _bY = new THREE.Vector3(); const _bZ = new THREE.Vector3()
const _dir = new THREE.Vector3(); const _pPrev = new THREE.Vector3(); const _pNext = new THREE.Vector3()
const switchCache = new WeakMap()
function buildWayData(way) {
  if (switchCache.has(way)) return switchCache.get(way)
  const items = []
  const chevrons = []; const posts = []; const arrows = []
  const pads = []; const originRings = []; const landRings = []; const struts = []
  const world = mundoDe(way); const local = nuevoLocal()
  const P = pal(way.theme.id)
  const mecCol = new THREE.Color(P.mec).multiplyScalar(1.35)
  const landCol = new THREE.Color(P.chev).multiplyScalar(1.4)
  const arrowCol = new THREE.Color(P.mec).multiplyScalar(1.45)
  const seenPre = new Set()
  const fFrom = {}; const fTo = {}; const fPre = {}

  way.segments?.forEach((seg, si) => {
    const isAir = !!seg.air
    const lanes = seg.lanes ?? []
    const L = Math.max(seg.length ?? 1, 1)

    for (const sw of seg.switches ?? []) {
      const lane = lanes.find((l) => l.id === sw.from)
      if (!lane) continue
      surfFrame(seg, lane.id, sw.u, fFrom)
      const uLand = sw.uLand ?? Math.min(1, sw.u + 0.05)
      surfFrame(seg, sw.to, uLand, fTo)
      const side = destSide(seg, sw, fFrom)

      const qFrom = basisQuat(fFrom.up, fFrom.tangent)
      const qTo = basisQuat(fTo.up, fTo.tangent)
      const pFrom = fFrom.pos.clone().addScaledVector(fFrom.up, 0.02)
      const pTo = fTo.pos.clone().addScaledVector(fTo.up, 0.02)

      // Anclaje visual en ambas puntas: placa sobre el asfalto + aro emisivo origen/destino
      if (!isAir) {
        pads.push({ pos: pFrom, quat: qFrom, scale: 1 })
        pads.push({ pos: pTo, quat: qTo, scale: 1 })
      }
      originRings.push({ pos: fFrom.pos.clone().addScaledVector(fFrom.up, isAir ? WORLD.BALL_R : 0.036), quat: qFrom, scale: isAir ? 1.25 : 1, color: mecCol })
      landRings.push({ pos: fTo.pos.clone().addScaledVector(fTo.up, isAir ? WORLD.BALL_R : 0.036), quat: qTo, scale: isAir ? 1.25 : 1, color: landCol })

      // Puntos precalculados del arco punteado
      const arcDots = []
      for (let k = 0; k < ARC_DOTS; k++) {
        const t = (k + 1) / (ARC_DOTS + 1)
        const pos = arcPoint(seg, sw, t, new THREE.Vector3())
        arcPoint(seg, sw, Math.max(0, t - 0.02), _pPrev)
        arcPoint(seg, sw, Math.min(1, t + 0.02), _pNext)
        _dir.subVectors(_pNext, _pPrev)
        const quat = _dir.lengthSq() > 1e-8
          ? new THREE.Quaternion().setFromUnitVectors(Z_AXIS, _dir.normalize())
          : qFrom.clone()
        arcDots.push({ pos, quat, t })
      }

      const kind = sw.kind || 'rampa'
      const seed = Math.floor(sw.u * 1e6) + lane.id * 139 + way.idx * 733
      let mechPos = null
      if (!isAir) {
        // Mecanismo en la berma del lado destino, colocado sin pisar otras pistas
        const E = halfWidth(lane) + CURB
        const o = fFrom.pos.clone()
        const want = o.clone().addScaledVector(fFrom.side, side * (E + TERR * 0.43))
        mechPos = colocar(world, { pos: want, seed, ajusta: bermaAjusta(o, fFrom.side, fFrom.up, E, TERR, 0.6) }, 0.6, { way: way.idx, si, lane: lane.id }, 4, local)
        if (mechPos) {
          // Puente/anclaje físico entre el borde del carril origen y el mecanismo en la berma
          const edge = o.clone().addScaledVector(fFrom.side, side * (halfWidth(lane) + 0.05)).addScaledVector(fFrom.up, 0.03)
          const mechEdge = mechPos.clone().addScaledVector(fFrom.up, 0.06)
          const span = edge.distanceTo(mechEdge)
          if (span > 0.15 && span < 3.6) {
            _dir.subVectors(mechEdge, edge).divideScalar(span)
            const strutQuat = basisQuat(fFrom.up, _dir)
            struts.push({ pos: edge.clone().lerp(mechEdge, 0.5), quat: strutQuat, scale: [1, 1, span] })
          }
        }
      }

      items.push({
        seg, si, sw, kind,
        pos: mechPos, quat: qFrom, up: fFrom.up.clone(), tangent: fFrom.tangent.clone(),
        side, accent: P.mec, mecCol, seed, start: Math.max(0, sw.u - 0.018), arcDots,
      })

      // Señalización previa sobre el asfalto y baliza al borde (solo tramos con pista)
      if (!isAir) {
        const dedupKey = `${si}:${lane.id}:${Math.round(sw.u * 1000)}:${side}`
        if (!seenPre.has(dedupKey)) {
          seenPre.add(dedupKey)
          const H = halfWidth(lane)
          const E = H + CURB
          const dists = [17, 12.5, 8]
          for (let k = 0; k < dists.length; k++) {
            const uMark = sw.u - dists[k] / L
            if (uMark < 0.02) continue
            surfFrame(seg, lane.id, uMark, fPre)
            const dir = fPre.tangent.clone().multiplyScalar(0.72).addScaledVector(fPre.side, side * 0.69).normalize()
            const pos = fPre.pos.clone().addScaledVector(fPre.up, 0.032).addScaledVector(fPre.side, side * H * 0.16)
            const sc = 0.72 + k * 0.13
            chevrons.push({ pos, quat: basisQuat(fPre.up, dir), scale: [sc, 1, sc], color: mecCol })
          }

          const dSign = Math.min(12.5, sw.u * L * 0.65)
          if (dSign >= 4) {
            const uSign = Math.max(0.02, sw.u - dSign / L)
            surfFrame(seg, lane.id, uSign, fPre)
            const o = fPre.pos.clone(); const fSide = fPre.side.clone(); const fUp = fPre.up.clone(); const fTan = fPre.tangent.clone()
            const want = o.clone().addScaledVector(fSide, side * (E + TERR * 0.44))
            const pSeed = Math.floor(sw.u * 1e6) + lane.id * 271 + way.idx * 911 + (side > 0 ? 17 : 31)
            const pPos = colocar(world, { pos: want, seed: pSeed, ajusta: bermaAjusta(o, fSide, fUp, E, TERR, 0.38) }, 0.38, { way: way.idx, si, lane: lane.id }, 4, local)
            if (pPos) {
              posts.push({ pos: pPos, quat: basisQuat(fUp, fTan), scale: 1 })
              _bX.copy(fSide).multiplyScalar(side).addScaledVector(fUp, 0.28).normalize()
              _bZ.copy(fTan).negate().normalize()
              _bY.crossVectors(_bZ, _bX).normalize()
              _bZ.crossVectors(_bX, _bY).normalize()
              arrows.push({
                pos: pPos.clone().addScaledVector(fUp, 0.82),
                quat: new THREE.Quaternion().setFromRotationMatrix(_bM.makeBasis(_bX, _bY, _bZ)),
                scale: 1.15, color: arrowCol,
              })
            }
          }
        }
      }
    }
  })

  // Agrupación por kind para instanciar mecanismos por tipo por camino
  const byKind = new Map()
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    if (!it.pos) continue
    let bucket = byKind.get(it.kind)
    if (!bucket) byKind.set(it.kind, bucket = [])
    bucket.push({ item: it, idx: i })
  }

  const out = { items, chevrons, posts, arrows, pads, originRings, landRings, struts, byKind }
  switchCache.set(way, out)
  return out
}

// ═══════════════════════════ ARCOS PUNTEADOS Y ANIMACIONES ═══════════════════════════
const T_S = new THREE.Vector3(); const T_Q = new THREE.Quaternion(); const T_M = new THREE.Matrix4()
const T_P = new THREE.Vector3(); const T_C = new THREE.Color()
const IDLE_C = new THREE.Color(); const HOT_C = new THREE.Color('#ffffff').multiplyScalar(1.95)
const ACTIVE_C = new THREE.Color()

function ArcTrails({ items, events, way }) {
  const cap = Math.max(1, items.length * ARC_DOTS)
  const inst = useMemo(() => {
    const m = new THREE.InstancedMesh(G.arcDot, GLOW_MAT, cap)
    m.count = items.length * ARC_DOTS
    m.frustumCulled = false
    m.userData.noCull = true
    return m
  }, [items.length, cap])
  useEffect(() => () => inst.dispose(), [inst])

  const bySwIdx = useMemo(() => {
    const m = new Map()
    for (let i = 0; i < items.length; i++) m.set(items[i].sw, i)
    return m
  }, [items])

  const idleColor = useMemo(() => {
    const P = pal(way.theme.id)
    return new THREE.Color(P.mec).multiplyScalar(0.55)
  }, [way])
  const activeColor = useMemo(() => {
    const P = pal(way.theme.id)
    return new THREE.Color(P.mec).multiplyScalar(1.55)
  }, [way])

  useLayoutEffect(() => {
    let idx = 0
    for (let i = 0; i < items.length; i++) {
      const dots = items[i].arcDots
      for (let k = 0; k < dots.length; k++) {
        T_S.setScalar(0.55)
        inst.setMatrixAt(idx, T_M.compose(dots[k].pos, dots[k].quat, T_S))
        inst.setColorAt(idx, idleColor)
        idx++
      }
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [inst, items, idleColor])

  useFrame((_, dt) => {
    if (!items.length) return
    const h = Math.min(dt, 0.1)
    for (let i = 0; i < items.length; i++) events[i].flightT = -1

    for (const b of getBallitas()) {
      if (!b) continue
      if (b.airborne && b.flight?.sw) {
        const idx = bySwIdx.get(b.flight.sw)
        if (idx !== undefined) {
          events[idx].flightT = b.flight.t
          events[idx].active = Math.max(events[idx].active, 1.1)
        }
      } else if (b.seg) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i]
          if (b.seg === it.seg && b.lane === it.sw.from && b.segT >= it.start && b.segT <= it.sw.u) {
            events[i].active = Math.max(events[i].active, 0.85)
          }
        }
      }
    }

    let dirty = false
    IDLE_C.copy(idleColor); ACTIVE_C.copy(activeColor)
    for (let i = 0; i < items.length; i++) {
      const ev = events[i]
      ev.active = Math.max(0, ev.active - h)
      const target = ev.flightT >= 0 ? 1 : ev.active > 0 ? 0.65 : 0
      ev.glow = THREE.MathUtils.damp(ev.glow, target, target > ev.glow ? 12 : 4, h)
      if (ev.glow < 0.008 && !ev.wasLit) continue
      const dots = items[i].arcDots
      const base = i * ARC_DOTS
      const isLive = ev.glow >= 0.008
      for (let k = 0; k < dots.length; k++) {
        const d = dots[k]
        const wave = ev.flightT >= 0 ? Math.max(0, 1 - Math.abs(d.t - ev.flightT) * 4.5) : 0
        const sc = isLive ? 0.55 + 0.5 * ev.glow + 0.55 * wave : 0.55
        T_S.setScalar(sc)
        inst.setMatrixAt(base + k, T_M.compose(d.pos, d.quat, T_S))
        if (isLive) {
          T_C.copy(IDLE_C).lerp(ACTIVE_C, ev.glow).lerp(HOT_C, wave * 0.85)
        } else {
          T_C.copy(IDLE_C)
        }
        inst.setColorAt(base + k, T_C)
      }
      ev.wasLit = isLive
      dirty = true
    }
    if (dirty) {
      inst.instanceMatrix.needsUpdate = true
      if (inst.instanceColor) inst.instanceColor.needsUpdate = true
    }
  })

  return <primitive object={inst} />
}

const _locP = new THREE.Vector3(); const _locQ = new THREE.Quaternion(); const _locS = new THREE.Vector3(); const _locM = new THREE.Matrix4()
const _rotQ = new THREE.Quaternion(); const _axX = new THREE.Vector3(1, 0, 0); const _axZ = new THREE.Vector3(0, 0, 1)

function evalAnimPose(animMode, t, active) {
  _locP.set(0, 0, 0); _rotQ.identity(); _locS.set(1, 1, 1)
  switch (animMode) {
    case 'geyser': {
      const p = active ? 1.3 : 0.25 + Math.max(0, Math.sin(t * 1.6)) * 1.1
      _locP.set(0, 0.32 + p * 0.12, 0); _locS.set(1, p, 1)
      break
    }
    case 'cascade': {
      const p = 0.85 + 0.18 * Math.sin(t * 2.4)
      _locP.set(0, 0.34, 0); _locS.set(1, p, 1)
      break
    }
    case 'erupt': {
      const p = active ? 1.35 : 0.5 + Math.max(0, Math.sin(t * 1.5)) * 0.65
      _locP.set(0, 0.06 * Math.sin(t * 3), 0); _locS.setScalar(p)
      break
    }
    case 'sway':
      _rotQ.setFromAxisAngle(_axZ, Math.sin(t * 2.2) * (active ? 0.25 : 0.08))
      break
    case 'glideZ':
      _locP.set(0, 0, Math.sin(t * 2.2) * 0.28)
      break
    case 'spinRotor':
      _locP.set(0, 0.95, 0)
      _rotQ.setFromAxisAngle(_axZ, t * (active ? 6.5 : 2.2))
      break
    case 'spinPortal':
      _locP.set(0, 0.74, 0)
      _rotQ.setFromAxisAngle(_axZ, t * (active ? 5.0 : 1.5))
      _locS.setScalar(active ? 1.25 : 1)
      break
    case 'magnetPulse':
      _locP.set(0, 0.56 + Math.sin(t * 3.2) * 0.18, 0)
      _locS.setScalar(active ? 1.3 : 0.95)
      break
    case 'bumperPulse': {
      const p = active ? 1.25 + 0.15 * Math.sin(t * 14) : 0.9 + 0.1 * Math.sin(t * 2.5)
      _locP.set(0, 0.56, 0); _locS.setScalar(p)
      break
    }
    case 'springBounce': {
      const b = active ? Math.abs(Math.sin(t * 9)) * 0.28 : Math.sin(t * 2.5) * 0.05
      _locP.set(0, 0.66 + b, 0)
      break
    }
    case 'spinWhirl':
      _locP.set(0, 0.42, 0)
      _rotQ.setFromAxisAngle(Y_AXIS, t * (active ? 5.2 : 1.8))
      break
    case 'glideBelt':
      _locP.set(0, 0.05, ((t * (active ? 1.6 : 0.6)) % 1 - 0.5) * 0.75)
      break
    case 'bubbleBog':
      _locP.set(0, 0.18 + Math.abs(Math.sin(t * 2.1)) * 0.14, 0)
      break
    case 'cannonPulse': {
      const k = active ? 0.18 * Math.sin(t * 10) : 0.04 * Math.sin(t * 2)
      _locP.set(0, 0.8 + k * 0.4, 0.54 + k)
      _locS.setScalar(active ? 1.35 : 1)
      break
    }
    case 'dropPulse':
      _locP.set(0, 0.58 - ((t * 0.6) % 1) * 0.34, 0)
      break
    default: { // rampBoost
      const k = ((t * (active ? 1.8 : 0.7)) % 1) * 0.28
      _locP.set(0, 0.48 + k * 0.5, 0.46 + k)
      _rotQ.setFromAxisAngle(_axX, -0.34)
      _locS.setScalar(active ? 1.25 : 0.95)
      break
    }
  }
}

function AnimKindMesh({ kind, entries, events, way, detail }) {
  const spec = useMemo(() => getKindSpec(kind), [kind])
  const color = useMemo(() => {
    const P = pal(way.theme.id)
    return new THREE.Color(spec.animColor ?? P.mec).multiplyScalar(1.45)
  }, [way, spec])
  const cap = Math.max(1, entries.length)
  const inst = useMemo(() => {
    const m = new THREE.InstancedMesh(spec.anim, GLOW_MAT, cap)
    m.count = entries.length
    m.frustumCulled = false
    m.userData.noCull = true
    return m
  }, [spec.anim, cap, entries.length])
  useEffect(() => () => inst.dispose(), [inst])

  useLayoutEffect(() => {
    for (let i = 0; i < entries.length; i++) {
      const it = entries[i].item
      evalAnimPose(spec.animMode, (it.seed % 1000) * 0.00628, false)
      _locQ.copy(it.quat).multiply(_rotQ)
      _locP.applyQuaternion(it.quat).add(it.pos)
      inst.setMatrixAt(i, _locM.compose(_locP, _locQ, _locS))
      inst.setColorAt(i, color)
    }
    inst.instanceMatrix.needsUpdate = true
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true
  }, [inst, entries, color, spec.animMode])

  const camera = useThree((s) => s.camera)
  useFrame(({ clock }) => {
    if (detail && detail.value < 0.3) return
    const camPos = camera.position
    const tBase = clock.elapsedTime
    let dirty = false
    for (let i = 0; i < entries.length; i++) {
      const { item, idx } = entries[i]
      if (camPos.distanceToSquared(item.pos) > 190 * 190) continue
      const ev = events[idx]
      const t = tBase + (item.seed % 1000) * 0.00628
      evalAnimPose(spec.animMode, t, ev.glow > 0.15)
      _locQ.copy(item.quat).multiply(_rotQ)
      _locP.applyQuaternion(item.quat).add(item.pos)
      inst.setMatrixAt(i, _locM.compose(_locP, _locQ, _locS))
      dirty = true
    }
    if (dirty) inst.instanceMatrix.needsUpdate = true
  })

  return <primitive object={inst} />
}

function KindGlowOnly({ kind, entries }) {
  const spec = useMemo(() => getKindSpec(kind), [kind])
  const glowItems = useMemo(() => entries.map(({ item }) => ({ pos: item.pos, quat: item.quat, scale: 1, color: item.mecCol })), [entries])
  return <Instanced geo={spec.glow} mat={GLOW_MAT} items={glowItems} />
}

function KindBodyOnly({ kind, entries }) {
  const spec = useMemo(() => getKindSpec(kind), [kind])
  const bodyItems = useMemo(() => entries.map(({ item }) => ({ pos: item.pos, quat: item.quat, scale: 1 })), [entries])
  return <Instanced geo={spec.body} mat={BODY_VTX_MAT} items={bodyItems} />
}

function FlightTrails({ items }) {
  const mesh = useRef()
  const cap = Math.max(1, items.length * 10)
  const inst = useMemo(() => {
    const m = new THREE.InstancedMesh(G.sphere, TRAIL_MAT, cap)
    m.count = 0; m.frustumCulled = false; m.userData.noCull = true
    return m
  }, [cap])
  useEffect(() => () => inst.dispose(), [inst])
  const bySw = useMemo(() => new Map(items.map((x) => [x.sw, x])), [items])
  useFrame(() => {
    const m = mesh.current; if (!m) return
    m.count = 0
    for (const b of getBallitas()) {
      if (!b?.airborne || !b.flight) continue
      const item = bySw.get(b.flight.sw)
      if (!item) continue
      for (let i = 0; i < 10 && m.count < cap; i++) {
        const t = Math.max(0, b.flight.t - i * 0.018)
        arcPoint(item.seg, item.sw, t, T_P)
        T_S.setScalar((1 - i / 11) * 0.115)
        m.setMatrixAt(m.count++, T_M.compose(T_P, T_Q, T_S))
      }
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <primitive ref={mesh} object={inst} />
}

export default function Eventos({ way }) {
  const data = useMemo(() => buildWayData(way), [way])
  const { items, chevrons, posts, arrows, pads, originRings, landRings, struts, byKind } = data
  const ev = useMemo(() => items.map(() => ({ active: 0, glow: 0, flightT: -1, wasLit: false })), [items])
  const kindList = useMemo(() => [...byKind.entries()], [byKind])
  const detail = getWayDetail(way)
  const solidRef = useRef()

  useFrame(() => {
    if (solidRef.current && detail) solidRef.current.visible = detail.value >= 0.3
  })

  if (!items.length && !chevrons.length) return null
  return (
    <group>
      {/* Capa emisiva: siempre visible, incluso a detalle bajo (detail.value < 0.3) */}
      <Instanced geo={G.chevron} mat={EMISSIVE_INST_MAT} items={chevrons} />
      <Instanced geo={G.beaconArrow} mat={EMISSIVE_INST_MAT} items={arrows} />
      <Instanced geo={G.originRing} mat={EMISSIVE_INST_MAT} items={originRings} />
      <Instanced geo={G.landRing} mat={EMISSIVE_INST_MAT} items={landRings} />
      {kindList.map(([kind, entries]) => (
        <group key={`g:${kind}`}>
          <KindGlowOnly kind={kind} entries={entries} />
          <AnimKindMesh kind={kind} entries={entries} events={ev} way={way} detail={detail} />
        </group>
      ))}
      <ArcTrails items={items} events={ev} way={way} />
      <FlightTrails items={items} />

      {/* Capa sólida/estructural: oculta cuando detail.value < 0.3 */}
      <group ref={solidRef}>
        <Instanced geo={G.beaconPost} mat={BODY_VTX_MAT} items={posts} />
        <Instanced geo={G.anchorPad} mat={BODY_VTX_MAT} items={pads} />
        <Instanced geo={G.strut} mat={STRUT_MAT} items={struts} />
        {kindList.map(([kind, entries]) => <KindBodyOnly key={`b:${kind}`} kind={kind} entries={entries} />)}
      </group>
    </group>
  )
}
