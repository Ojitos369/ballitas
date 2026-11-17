// Vida del Camino del Hielo: mini mundo polar dentro del tubo de cristal (contrato en README.md).
// Nieve y témpanos, cielo con aurora, pingüinos que patinan, osos, focas, iglús, estalactitas y
// mecanismos de carril: rampa de hielo, trineo/corriente glaciar y foca que rebota la bola.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  lodPiece, Billboard, CartelesDeRuta, EventStage, Instanced, TAU, buildSkyGeo, buildTerrainGeo,
  getBallitas, laneFrame, laneGap, makePlacement, markShared, maxHeight, mulberry32, placeAlong,
  placeAlongInto, routeInfo, scatter, segPath, switchesOf, useAutoDispose, useInstanced, useWayBounds, BALL_R,
} from './base.jsx'

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const X = new THREE.Vector3(1, 0, 0)
const IDENT_Q = new THREE.Quaternion()
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

const ESTILO = { color: '#f5fcff', bg: 'rgba(20,48,77,0.94)', border: '#a3eaff' }
const ESTILO_PANTALLA = { color: '#f5fcff', bg: 'rgba(16,40,70,0.94)', border: '#a3eaff', size: 46 }

const _v = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _q2 = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _m = new THREE.Matrix4()
const _c = new THREE.Color()
const _pl = makePlacement()
const _loc = {}
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

// ═══════════════════════════ GEOMETRÍA CHIBI HORNEADA ═══════════════════════════
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
  const count = g.getAttribute('position').count
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2))
  const c = new THREE.Color(hex)
  const col = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}
function mergePainted(parts) {
  const merged = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  merged.computeBoundingSphere()
  return merged
}

let GEOS = null
function getGeos() {
  if (GEOS) return GEOS
  const sph10 = new THREE.SphereGeometry(1, 10, 8)
  const sph = new THREE.SphereGeometry(1, 8, 6)
  const cap = new THREE.CapsuleGeometry(1, 1, 3, 6)
  const cyl = new THREE.CylinderGeometry(1, 1, 1, 8)
  const cone = new THREE.ConeGeometry(1, 1, 8)
  const tor = new THREE.TorusGeometry(1, 0.08, 5, 16)
  const dome = new THREE.SphereGeometry(1, 10, 6, 0, TAU, 0, Math.PI / 2)
  const box = new THREE.BoxGeometry(1, 1, 1)
  const P = Math.PI

  const penguin = mergePainted([
    bakePart(sph10, '#19364a', 0, 0.3, 0, 0, 0, 0, 0.2, 0.28, 0.17),
    bakePart(sph, '#f7ffff', 0, 0.27, 0.07, 0, 0, 0, 0.14, 0.22, 0.09),
    bakePart(sph10, '#19364a', 0, 0.6, 0.02, 0, 0, 0, 0.16, 0.15, 0.15),
    bakePart(sph, '#f7ffff', 0, 0.58, 0.1, 0, 0, 0, 0.1, 0.09, 0.05),
    bakePart(sph, '#ffffff', -0.055, 0.63, 0.13, 0, 0, 0, 0.035, 0.04, 0.02),
    bakePart(sph, '#ffffff', 0.055, 0.63, 0.13, 0, 0, 0, 0.035, 0.04, 0.02),
    bakePart(sph, '#101820', -0.055, 0.63, 0.15, 0, 0, 0, 0.02, 0.025, 0.015),
    bakePart(sph, '#101820', 0.055, 0.63, 0.15, 0, 0, 0, 0.02, 0.025, 0.015),
    bakePart(cone, '#ffb04a', 0, 0.57, 0.19, P / 2, 0, 0, 0.04, 0.08, 0.03),
    bakePart(sph, '#ff9eb8', -0.1, 0.57, 0.12, 0, 0, 0, 0.03, 0.02, 0.015),
    bakePart(sph, '#ff9eb8', 0.1, 0.57, 0.12, 0, 0, 0, 0.03, 0.02, 0.015),
    bakePart(sph, '#19364a', -0.21, 0.3, 0, 0, 0, 0.5, 0.05, 0.16, 0.07),
    bakePart(sph, '#19364a', 0.21, 0.3, 0, 0, 0, -0.5, 0.05, 0.16, 0.07),
    bakePart(sph, '#ffb04a', -0.08, 0.03, 0.08, 0, 0, 0, 0.07, 0.03, 0.1),
    bakePart(sph, '#ffb04a', 0.08, 0.03, 0.08, 0, 0, 0, 0.07, 0.03, 0.1),
  ])
  const bear = mergePainted([
    bakePart(sph10, '#f4fbff', 0, 0.32, 0, 0, 0, 0, 0.32, 0.28, 0.38),
    bakePart(sph10, '#f4fbff', 0, 0.62, 0.3, 0, 0, 0, 0.2, 0.18, 0.19),
    bakePart(sph, '#ffffff', 0, 0.57, 0.46, 0, 0, 0, 0.09, 0.07, 0.08),
    bakePart(sph, '#19283a', 0, 0.6, 0.53, 0, 0, 0, 0.035, 0.03, 0.03),
    bakePart(sph, '#f4fbff', -0.13, 0.78, 0.27, 0, 0, 0, 0.06, 0.06, 0.04),
    bakePart(sph, '#f4fbff', 0.13, 0.78, 0.27, 0, 0, 0, 0.06, 0.06, 0.04),
    bakePart(sph, '#19283a', -0.08, 0.66, 0.45, 0, 0, 0, 0.025, 0.03, 0.02),
    bakePart(sph, '#19283a', 0.08, 0.66, 0.45, 0, 0, 0, 0.025, 0.03, 0.02),
    bakePart(sph, '#ff9eb8', -0.15, 0.58, 0.44, 0, 0, 0, 0.04, 0.025, 0.02),
    bakePart(sph, '#ff9eb8', 0.15, 0.58, 0.44, 0, 0, 0, 0.04, 0.025, 0.02),
    bakePart(sph, '#e4f2fa', -0.18, 0.08, 0.22, 0, 0, 0, 0.1, 0.09, 0.12),
    bakePart(sph, '#e4f2fa', 0.18, 0.08, 0.22, 0, 0, 0, 0.1, 0.09, 0.12),
    bakePart(sph, '#e4f2fa', -0.18, 0.08, -0.22, 0, 0, 0, 0.1, 0.09, 0.12),
    bakePart(sph, '#e4f2fa', 0.18, 0.08, -0.22, 0, 0, 0, 0.1, 0.09, 0.12),
  ])
  const seal = mergePainted([
    bakePart(sph10, '#8fa6bd', 0, 0.18, 0, 0, 0, 0, 0.24, 0.2, 0.42),
    bakePart(sph, '#e8f0f8', 0, 0.12, 0.05, 0, 0, 0, 0.19, 0.14, 0.34),
    bakePart(sph10, '#8fa6bd', 0, 0.33, 0.4, 0, 0, 0, 0.17, 0.15, 0.16),
    bakePart(sph, '#19283a', 0, 0.33, 0.55, 0, 0, 0, 0.04, 0.03, 0.03),
    bakePart(sph, '#ffffff', -0.07, 0.38, 0.5, 0, 0, 0, 0.035, 0.04, 0.02),
    bakePart(sph, '#ffffff', 0.07, 0.38, 0.5, 0, 0, 0, 0.035, 0.04, 0.02),
    bakePart(sph, '#101820', -0.07, 0.38, 0.52, 0, 0, 0, 0.02, 0.025, 0.015),
    bakePart(sph, '#101820', 0.07, 0.38, 0.52, 0, 0, 0, 0.02, 0.025, 0.015),
    bakePart(sph, '#ff9eb8', -0.13, 0.3, 0.47, 0, 0, 0, 0.035, 0.02, 0.02),
    bakePart(sph, '#ff9eb8', 0.13, 0.3, 0.47, 0, 0, 0, 0.035, 0.02, 0.02),
    bakePart(sph, '#7d94ab', -0.26, 0.1, 0.22, 0, 0.3, 0.5, 0.15, 0.035, 0.08),
    bakePart(sph, '#7d94ab', 0.26, 0.1, 0.22, 0, -0.3, -0.5, 0.15, 0.035, 0.08),
    bakePart(sph, '#7d94ab', -0.1, 0.12, -0.5, 0, 0, 0, 0.1, 0.03, 0.07),
    bakePart(sph, '#7d94ab', 0.1, 0.12, -0.5, 0, 0, 0, 0.1, 0.03, 0.07),
  ])
  const igloo = mergePainted([
    bakePart(dome, '#e8f6fb', 0, 0, 0, 0, 0, 0, 0.55, 0.42, 0.55),
    bakePart(new THREE.TorusGeometry(1, 0.03, 4, 18), '#b8d8e6', 0, 0.16, 0, P / 2, 0, 0, 0.5, 0.5, 0.5),
    bakePart(new THREE.TorusGeometry(1, 0.03, 4, 18), '#b8d8e6', 0, 0.3, 0, P / 2, 0, 0, 0.34, 0.34, 0.34),
    bakePart(dome, '#d6ecf5', 0, 0, 0.5, 0, 0, 0, 0.24, 0.2, 0.26),
    bakePart(sph, '#1c3550', 0, 0.07, 0.72, 0, 0, 0, 0.11, 0.12, 0.04),
    bakePart(sph, '#ffd88a', 0.3, 0.2, 0.36, 0, 0, 0, 0.05, 0.05, 0.03),
  ])
  const snowman = mergePainted([
    bakePart(sph10, '#ffffff', 0, 0.2, 0, 0, 0, 0, 0.24, 0.22, 0.24),
    bakePart(sph10, '#ffffff', 0, 0.5, 0, 0, 0, 0, 0.18, 0.17, 0.18),
    bakePart(sph10, '#ffffff', 0, 0.74, 0, 0, 0, 0, 0.13, 0.13, 0.13),
    bakePart(cone, '#ff8a2f', 0, 0.74, 0.15, P / 2, 0, 0, 0.025, 0.13, 0.025),
    bakePart(sph, '#19283a', -0.04, 0.78, 0.11, 0, 0, 0, 0.02, 0.02, 0.015),
    bakePart(sph, '#19283a', 0.04, 0.78, 0.11, 0, 0, 0, 0.02, 0.02, 0.015),
    bakePart(cyl, '#2d3550', 0, 0.9, 0, 0, 0, 0, 0.1, 0.1, 0.1),
    bakePart(cyl, '#2d3550', 0, 0.84, 0, 0, 0, 0, 0.15, 0.015, 0.15),
    bakePart(new THREE.TorusGeometry(1, 0.2, 5, 12), '#e0463e', 0, 0.62, 0, P / 2, 0, 0, 0.13, 0.13, 0.13),
  ])
  const pine = mergePainted([
    bakePart(cyl, '#6b4a33', 0, 0.12, 0, 0, 0, 0, 0.06, 0.24, 0.06),
    bakePart(cone, '#3f8a63', 0, 0.42, 0, 0, 0, 0, 0.3, 0.4, 0.3),
    bakePart(cone, '#4a9c72', 0, 0.68, 0, 0, 0, 0, 0.23, 0.36, 0.23),
    bakePart(cone, '#f2fbff', 0, 0.9, 0, 0, 0, 0, 0.14, 0.3, 0.14),
  ])
  const spire = mergePainted([
    bakePart(cone, '#9be4ff', 0, 0.45, 0, 0, 0, 0, 0.14, 0.9, 0.14),
    bakePart(cone, '#b6efff', 0.17, 0.28, 0.04, 0, 0, -0.35, 0.1, 0.56, 0.1),
    bakePart(cone, '#7fd4f4', -0.15, 0.22, -0.05, 0, 0, 0.4, 0.09, 0.44, 0.09),
  ])
  const icicle = mergePainted([bakePart(cone, '#d4f4ff', 0, 0.5, 0, 0, 0, 0, 0.12, 1, 0.12), bakePart(cone, '#ffffff', 0, 0.78, 0, 0, 0, 0, 0.05, 0.4, 0.05)])
  const block = mergePainted([
    bakePart(sph10, '#8fdcf3', 0, 0.2, 0, 0, 0, 0, 0.4, 0.24, 0.34),
    bakePart(sph, '#d8f6ff', 0.1, 0.34, -0.04, 0, 0, 0, 0.2, 0.12, 0.18),
  ])
  const mound = mergePainted([bakePart(sph10, '#f4fbff', 0, 0.06, 0, 0, 0, 0, 0.4, 0.16, 0.34), bakePart(sph, '#cfeaf7', 0.2, 0.05, 0.1, 0, 0, 0, 0.2, 0.09, 0.18)])
  const rink = mergePainted([
    bakePart(cyl, '#bfeaff', 0, 0.015, 0, 0, 0, 0, 1, 0.03, 1),
    bakePart(new THREE.TorusGeometry(1, 0.045, 4, 22), '#ffffff', 0, 0.04, 0, P / 2, 0, 0, 1, 1, 1),
    bakePart(box, '#ffffff', 0, 0.035, 0, 0, 0, 0, 1.8, 0.012, 0.03),
    bakePart(new THREE.TorusGeometry(1, 0.02, 4, 18), '#8ad0f0', 0, 0.036, 0, P / 2, 0, 0, 0.3, 0.3, 0.3),
  ])
  const sled = mergePainted([
    bakePart(box, '#c0583a', 0, 0.12, 0, 0, 0, 0, 0.3, 0.06, 0.58),
    bakePart(sph, '#c0583a', 0, 0.15, 0.3, 0, 0, 0, 0.15, 0.07, 0.08),
    bakePart(box, '#c9d6e0', -0.14, 0.05, 0, 0, 0, 0, 0.03, 0.05, 0.66),
    bakePart(box, '#c9d6e0', 0.14, 0.05, 0, 0, 0, 0, 0.03, 0.05, 0.66),
  ])
  const sledPeng = mergePainted([
    sled.clone(),
    penguin.clone().scale(0.8, 0.8, 0.8).translate(0, 0.14, -0.04),
  ])
  const ramp = mergePainted([
    bakePart(box, '#9fe3ff', 0, 0.16, 0, -0.38, 0, 0, 0.6, 0.06, 1.0),
    bakePart(box, '#d8f6ff', -0.3, 0.14, 0, -0.38, 0, 0, 0.04, 0.16, 1.0),
    bakePart(box, '#d8f6ff', 0.3, 0.14, 0, -0.38, 0, 0, 0.04, 0.16, 1.0),
    bakePart(sph, '#ffffff', 0, 0.02, -0.5, 0, 0, 0, 0.3, 0.06, 0.18),
  ])
  const arrow = mergePainted([
    bakePart(cone, '#ffffff', 0, 0.04, 0.12, P / 2, 0, 0, 0.14, 0.2, 0.025),
    bakePart(cone, '#ffffff', 0, 0.04, -0.14, P / 2, 0, 0, 0.14, 0.2, 0.025),
  ])
  const arch = mergePainted([bakePart(new THREE.TorusGeometry(1, 0.06, 6, 22), '#bff3ff')])
  const gate = new THREE.TorusGeometry(1, 0.07, 6, 18)
  const orb = new THREE.SphereGeometry(1, 8, 6)
  GEOS = markShared({ penguin, bear, seal, igloo, snowman, pine, spire, icicle, block, mound, rink, sledPeng, ramp, arrow, arch, gate, orb, cyl, tor, cone, cap })
  sph10.dispose(); sph.dispose(); dome.dispose(); box.dispose(); sled.dispose()
  return GEOS
}

let MATS = null
function getMats() {
  if (MATS) return MATS
  MATS = markShared({
    clay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, emissive: '#113e67', emissiveIntensity: 0.28 }),
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, emissive: '#143a60', emissiveIntensity: 0.28 }),
    sky: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.55, depthWrite: false }),
    pad: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    snow: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }),
    aurora: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }),
    spout: new THREE.MeshBasicMaterial({ color: '#cff4ff', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    link: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    ring: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  })
  return MATS
}

// ═══════════════════════════ PALETAS POR PERFIL DE RUTA ═══════════════════════════
const PERFILES = ['rapida', 'media', 'lenta']
const PAL = {
  rapida: { terr: ['#527e9c', '#e8faff'], sky: ['#193a68', '#69c8e6'], accent: '#a7eeff', aur: ['#6bffe3', '#8fd0ff'], label: '🛷 CARRERA DE TRINEOS' },
  media: { terr: ['#617f9c', '#d6caff'], sky: ['#172e5f', '#b98ef3'], accent: '#f6b8ff', aur: ['#e19cff', '#6bffe3'], label: '⛸ PISTA BOREAL' },
  lenta: { terr: ['#346c91', '#d6f9f5'], sky: ['#102c5a', '#40d6cf'], accent: '#baffeb', aur: ['#6bffb8', '#e19cff'], label: '🦭 CUEVA DE FOCAS' },
}
const profKey = (route, idx) => (PAL[route?.profile?.speed] ? route.profile.speed : PERFILES[idx % 3])

// ═══════════════════════════ TERRENO ═══════════════════════════
const ARC = Math.PI * 0.5
function drifts(seg, u, a) {
  const bank = smooth(0.42, 0.68, Math.abs(a))
  const L = seg.length
  const h = 0.5 + 0.3 * Math.sin(u * L * 0.45 + a * 4 + seg.i) + 0.2 * Math.cos(u * L * 0.2 - a * 3)
  return THREE.MathUtils.clamp(h, 0, 1) * (0.3 + 0.7 * bank)
}
function surfOff(seg, u, a) {
  const edge = 1 - smooth(ARC * 0.7, ARC, Math.abs(a))
  const chan = smooth(0.02, 0.32, laneGap(seg, a))
  const maxH = Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22)
  return seg.radius * 0.015 + drifts(seg, u, a) * edge * chan * maxH
}
function seat(items, lift = 0) {
  for (const it of items) {
    const p = placeAlong(it.seg, it.u, surfOff(it.seg, it.u, it.angle) + lift, it.angle)
    it.pos.copy(p.pos); it.quat.copy(p.quat)
  }
  return items
}

// ═══════════════════════════ UTILIDADES DE ANIMACIÓN ═══════════════════════════
function DetailGroup({ detail, min = 0.5, children }) {
  const ref = useRef()
  useFrame(() => {
    const g = ref.current
    if (g) { const v = (detail?.value ?? 1) >= min; if (g.visible !== v) g.visible = v }
  })
  return <group ref={ref}>{children}</group>
}

/** Manadas que patinan/caminan por la pared; huyen o se emocionan con las ballitas cercanas. */
function Herd({
  way, segs, geo, mat, groups = 3, per = 5, speed = 1.2, scale = 0.3, off = [0.02, 0.05], angle = [0.8, 1.25],
  seed = 1, bob = 0.0, wag = 0.2, hop = 0, spread = 0.4, detail,
}) {
  const path = useMemo(() => segPath(segs), [segs])
  const st = useMemo(() => {
    const rng = mulberry32(seed * 6151 + way.idx * 131 + 11)
    const gs = Array.from({ length: groups }, (_, g) => ({
      s: rng() * path.total, dir: rng() > 0.5 ? 1 : -1, v: speed * (0.75 + rng() * 0.5),
      a: (g % 2 ? -1 : 1) * (angle[0] + rng() * (angle[1] - angle[0])), o: off[0] + rng() * (off[1] - off[0]), scare: 0,
    }))
    const fs = []
    for (let g = 0; g < groups; g++) {
      for (let k = 0; k < per; k++) fs.push({ g, dx: k ? 0.3 + rng() * 0.8 * (1 + k * 0.2) : 0, da: (rng() - 0.5) * spread, ph: rng() * TAU })
    }
    return { gs, fs }
  }, [path, groups, per, speed, angle, off, seed, spread, way.idx])
  const items = useMemo(() => st.fs.map(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale })), [st, scale])
  const mesh = useInstanced(geo, mat, items, { dynamic: true })
  useFrame(({ clock }, dt) => {
    if (!path.total || (detail?.value ?? 1) < 0.04) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let g = 0; g < st.gs.length; g++) {
      const G = st.gs[g]
      let near = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = path.arcOf(b.seg, b.segT ?? 0)
        if (arc != null) near = Math.max(near, 1 - Math.min(1, Math.abs(arc - G.s) / 3))
      }
      G.scare = THREE.MathUtils.damp(G.scare, near, near > G.scare ? 8 : 2, h)
      G.s += G.dir * G.v * h * (1 + G.scare * 1.5)
      if (G.s > path.total) { G.s = path.total; G.dir = -1 } else if (G.s < 0) { G.s = 0; G.dir = 1 }
    }
    for (let i = 0; i < st.fs.length; i++) {
      const f = st.fs[i]; const G = st.gs[f.g]
      path.locate(THREE.MathUtils.clamp(G.s - G.dir * f.dx, 0, path.total), _loc)
      const a = G.a + f.da * 0.5
      const jump = G.scare * hop * Math.abs(Math.sin(t * 9 + f.ph))
      placeAlongInto(_loc.seg, _loc.u, surfOff(_loc.seg, _loc.u, a) + G.o + Math.abs(Math.sin(t * 5 + f.ph)) * bob + jump, a, _pl)
      const it = items[i]
      it.pos.copy(_pl.pos)
      it.quat.copy(_pl.quat)
      if (G.dir < 0) it.quat.multiply(FLIP_Y)
      it.quat.multiply(_q2.setFromAxisAngle(Z, Math.sin(t * (4 + G.scare * 8) + f.ph) * wag))
      _s.setScalar(scale)
      _m.compose(it.pos, it.quat, _s)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

/** Ventisca: copos que cruzan el tubo empujados por el viento y caen hacia la pared. */
function Blizzard({ way, segs, G, M, detail, n = 70 }) {
  const path = useMemo(() => segPath(segs), [segs])
  const st = useMemo(() => {
    const rng = mulberry32(way.idx * 641 + 3)
    return Array.from({ length: n }, () => ({ s: rng() * path.total, a: (rng() - 0.5) * 5.6, ph: rng(), sp: 0.1 + rng() * 0.16, sc: 0.025 + rng() * 0.035, w: 0.5 + rng() * 1.5 }))
  }, [path, n, way.idx])
  const ref = useRef()
  useWayBounds(ref, way)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !path.total || (detail?.value ?? 1) < 0.04) return
    const t = clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const f = st[i]
      const k = (t * f.sp + f.ph) % 1
      path.locate((f.s + t * f.w * 0.8) % path.total, _loc)
      placeAlongInto(_loc.seg, _loc.u, 0.05 + (1 - k) * _loc.seg.radius * 0.95, f.a + Math.sin(t * 0.8 + f.ph * 9) * 0.12, _pl)
      _s.setScalar(f.sc)
      _m.compose(_pl.pos, IDENT_Q, _s)
      m.setMatrixAt(i, _m)
    }
    m.instanceMatrix.needsUpdate = true
  })
  if (!path.total) return null
  return <instancedMesh ref={ref} name="hielo-ventisca" args={[G.orb, M.snow, n]} />
}

/** Aurora boreal: cintas aditivas onduladas en el techo del tubo. */
function AuroraSky({ way, segs, G, M, detail, pal, n = 22 }) {
  const path = useMemo(() => segPath(segs), [segs])
  const st = useMemo(() => {
    const rng = mulberry32(way.idx * 811 + 9)
    return Array.from({ length: n }, (_, i) => ({ s: (i / n) * path.total, a: Math.PI + (rng() - 0.5) * 1.1, ph: rng() * TAU, w: 0.9 + rng() * 0.9, c: pal.aur[i % pal.aur.length] }))
  }, [path, n, way.idx, pal])
  const ref = useRef()
  useWayBounds(ref, way)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !path.total || (detail?.value ?? 1) < 0.04) return
    const t = clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const f = st[i]
      path.locate(f.s, _loc)
      placeAlongInto(_loc.seg, _loc.u, 0.04 + 0.1 * Math.sin(t * 0.6 + f.ph), f.a + Math.sin(t * 0.25 + f.ph) * 0.3, _pl)
      _s.set(f.w * 0.9, 0.04, 0.34 + 0.1 * Math.sin(t * 0.9 + f.ph))
      _m.compose(_pl.pos, _pl.quat, _s)
      m.setMatrixAt(i, _m)
      m.setColorAt(i, _c.set(f.c).multiplyScalar(0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.7 + f.ph))))
    }
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  if (!path.total) return null
  return <instancedMesh ref={ref} name="hielo-aurora" args={[G.orb, M.aurora, n]} />
}

// ═══════════════════════════ MECANISMOS DE CAMBIO DE CARRIL ═══════════════════════════
// rampa = rampa de hielo con trineo; cinta = corriente glaciar; bumper = foca que rebota la bola.
const MECH = {
  rampa: { pad: '#9fe3ff', link: '#cfeeff', ring: '#e8fbff' },
  cinta: { pad: '#46f2e0', link: '#6bffe3', ring: '#9dffe6' },
  bumper: { pad: '#ffb3c8', link: '#ffd6e2', ring: '#ffe8f0' },
}
function LaneMechanisms({ way, G, M, detail }) {
  const mechs = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (seg.air) continue
      for (const sw of switchesOf(seg)) {
        const kind = MECH[sw.kind] ? sw.kind : 'cinta'
        const uIn = THREE.MathUtils.clamp(sw.u ?? 0.5, 0.04, 0.94)
        const uOut = THREE.MathUtils.clamp(sw.uEnd ?? uIn + 0.06, uIn + 0.03, 0.97)
        const fIn = laneFrame(seg, sw.from ?? 0, uIn)
        const fOut = laneFrame(seg, sw.to ?? 0, uOut)
        const qIn = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fIn.side, fIn.up, fIn.tangent))
        const qOut = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(fOut.side, fOut.up, fOut.tangent))
        const a = fIn.pos.clone().addScaledVector(fIn.up, 0.12)
        const b = fOut.pos.clone().addScaledVector(fOut.up, 0.12)
        const dir = b.clone().sub(a)
        const len = dir.length()
        const n = len > 1e-4 ? dir.clone().multiplyScalar(1 / len) : Y
        const useOut = kind === 'bumper'
        const f = useOut ? fOut : fIn
        out.push({
          seg, uIn, kind, qIn, qLink: new THREE.Quaternion().setFromUnitVectors(Y, n), qRing: new THREE.Quaternion().setFromUnitVectors(Z, n),
          mid: a.clone().addScaledVector(dir, 0.5), len, pi: fIn.pos.clone().addScaledVector(fIn.up, 0.04),
          headPos: f.pos.clone().addScaledVector(f.side, kind === 'rampa' ? 0 : 0.5).addScaledVector(f.up, 0.03), headUp: f.up.clone(), headQ: useOut ? qOut : qIn,
        })
      }
    }
    return out
  }, [way])
  const kinds = useMemo(() => {
    const k = { rampa: [], cinta: [], bumper: [] }
    mechs.forEach((m, i) => { m.hi = k[m.kind].length; k[m.kind].push(i) })
    return k
  }, [mechs])
  const padRef = useRef(); const linkRef = useRef(); const ringRef = useRef()
  const headRefs = { rampa: useRef(), cinta: useRef(), bumper: useRef() }
  for (const r of [padRef, linkRef, ringRef, headRefs.rampa, headRefs.cinta, headRefs.bumper]) useWayBounds(r, way) // eslint-disable-line react-hooks/rules-of-hooks
  useFrame(({ clock }) => {
    if (!mechs.length || (detail?.value ?? 1) < 0.04) return
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < mechs.length; i++) {
      const m = mechs[i]; const S = MECH[m.kind]
      let act = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === m.seg) { const d = Math.abs((b.segT ?? 0) - m.uIn); if (d < 0.14) act = Math.max(act, 1 - d / 0.14) }
      }
      _s.set(0.34, 0.05 + act * 0.05, 0.34)
      _m.compose(m.pi, m.qIn, _s)
      padRef.current?.setMatrixAt(i, _m); padRef.current?.setColorAt(i, _c.set(S.pad))
      const th = (m.kind === 'bumper' ? 0.05 : m.kind === 'rampa' ? 0.035 : 0.02) * (1 + act * 1.2)
      _s.set(th, m.len * (m.kind === 'bumper' ? 0.5 + act * 0.5 : 1), th)
      _m.compose(m.mid, m.qLink, _s)
      linkRef.current?.setMatrixAt(i, _m); linkRef.current?.setColorAt(i, _c.set(S.link).multiplyScalar(0.35 + act * 0.65))
      _q.copy(m.qRing).multiply(_q2.setFromAxisAngle(Z, t * (1.5 + act * 6) * (i % 2 ? 1 : -1)))
      _s.setScalar(0.28 + act * 0.16)
      _m.compose(m.mid, _q, _s)
      ringRef.current?.setMatrixAt(i, _m); ringRef.current?.setColorAt(i, _c.set(S.ring).multiplyScalar(0.3 + act * 0.7))
      const hr = headRefs[m.kind].current
      if (hr) {
        _q.copy(m.headQ).multiply(_q2.setFromAxisAngle(Y, m.kind === 'bumper' ? Math.sin(t * 2 + i) * 0.4 : 0))
        const hop = m.kind === 'bumper' ? act * 0.3 * Math.abs(Math.sin(t * 11)) : 0
        const sc = m.kind === 'cinta' ? 0.9 + act * 0.5 : m.kind === 'rampa' ? 0.7 : 0.55
        _s.set(sc, sc * (m.kind === 'bumper' ? 1 - 0.18 * act * Math.sin(t * 22) : 1), sc)
        _v.copy(m.headPos).addScaledVector(m.headUp, hop)
        _m.compose(_v, _q, _s)
        hr.setMatrixAt(m.hi, _m)
        if (m.kind === 'cinta') hr.setColorAt(m.hi, _c.set(S.link).multiplyScalar(0.5 + act * 0.5))
      }
    }
    for (const r of [padRef, linkRef, ringRef]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true }
    for (const k in headRefs) { const r = headRefs[k].current; if (r) { r.instanceMatrix.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true } }
  })
  if (!mechs.length) return null
  return <group name="hielo-mecanismos">
    <instancedMesh ref={padRef} name="hielo-pad-mecanismo" args={[G.cyl, M.pad, mechs.length]} />
    <instancedMesh ref={linkRef} name="hielo-enlace-mecanismo" args={[G.cyl, M.link, mechs.length]} />
    <instancedMesh ref={ringRef} name="hielo-anillo-mecanismo" args={[G.tor, M.ring, mechs.length]} />
    {kinds.rampa.length > 0 && <instancedMesh ref={headRefs.rampa} name="hielo-rampa-mecanismo" args={[G.ramp, M.clay, kinds.rampa.length]} />}
    {kinds.cinta.length > 0 && <instancedMesh ref={headRefs.cinta} name="hielo-glaciar-mecanismo" args={[G.arrow, M.link, kinds.cinta.length]} />}
    {kinds.bumper.length > 0 && <instancedMesh ref={headRefs.bumper} name="hielo-foca-mecanismo" args={[G.seal, M.clay, kinds.bumper.length]} />}
  </group>
}

// ═══════════════════════════ EVENTOS POR RUTA (teaser → clímax → salida) ═══════════════════════════
// Rápida: carrera de trineos con aros de hielo. Media: pista de patinaje con aurora. Lenta: cueva de focas, estalactitas y géiser helado.
function SledRaceEvent({ seg, stage, G, M, pal }) {
  const N = 8
  const sledRef = useRef(); const gateRef = useRef(); const sprayRef = useRef()
  useWayBounds(sledRef, seg.way); useWayBounds(gateRef, seg.way); useWayBounds(sprayRef, seg.way)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const I = stage.intensity; const R = seg.radius
    const s = sledRef.current
    if (s) {
      const sp = 0.05 + I * 0.45
      const lanes = seg.lanes?.length ? seg.lanes : [{ angle: 0 }]
      for (let i = 0; i < N; i++) {
        const u = 0.08 + 0.84 * (((i / N) + t * sp * (1 + (i % 3) * 0.12)) % 1)
        placeAlongInto(seg, u, 0.03, lanes[i % lanes.length].angle + (i % 2 ? 0.3 : -0.3), _pl)
        _s.setScalar(0.5 * (0.35 + 0.65 * Math.min(1, I)))
        _m.compose(_pl.pos, _pl.quat, _s)
        s.setMatrixAt(i, _m)
      }
      s.instanceMatrix.needsUpdate = true
    }
    const g = gateRef.current
    if (g) {
      for (let i = 0; i < 3; i++) {
        placeAlongInto(seg, 0.2 + i * 0.3, R, 0, _pl)
        _q.copy(_pl.quat).multiply(_q2.setFromAxisAngle(Z, t * (0.7 + I) * (i % 2 ? -1 : 1)))
        _s.setScalar(R * (0.78 + 0.08 * Math.sin(t * 3 + i) + I * 0.12))
        _m.compose(_pl.pos, _q, _s)
        g.setMatrixAt(i, _m)
        g.setColorAt(i, _c.set(pal.accent).multiplyScalar(0.25 + I * 0.75))
      }
      g.instanceMatrix.needsUpdate = true
      if (g.instanceColor) g.instanceColor.needsUpdate = true
    }
    const b = sprayRef.current
    if (b) {
      const k = stage.phase === 'salida' ? 2.4 * stage.intensity : 0
      for (let i = 0; i < 16; i++) {
        placeAlongInto(seg, 0.88 + (i % 4) * 0.025, ((t * 0.9 + i / 16) % 1) * R * 0.8 + 0.04, i * 2.1, _pl)
        _s.setScalar(0.06 * k)
        _m.compose(_pl.pos, IDENT_Q, _s)
        b.setMatrixAt(i, _m)
      }
      b.instanceMatrix.needsUpdate = true
    }
  })
  return <group>
    <instancedMesh ref={sledRef} name="hielo-evento-trineos" args={[G.sledPeng, M.clay, N]} />
    <instancedMesh ref={gateRef} name="hielo-evento-aros" args={[G.gate, M.ring, 3]} />
    <instancedMesh ref={sprayRef} name="hielo-evento-nieve" args={[G.orb, M.snow, 16]} />
  </group>
}

function SkateEvent({ seg, stage, G, M, pal }) {
  const rink = useMemo(() => placeAlong(seg, 0.5, 0.02, seg.i % 2 ? 1.0 : -1.0), [seg])
  const skRef = useRef(); const lightRef = useRef(); const flurryRef = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const I = stage.intensity
    const s = skRef.current
    if (s) {
      for (let i = 0; i < 6; i++) {
        const th = i * (TAU / 6) + t * (0.5 + I * 2.6) * (i % 2 ? 1 : 0.8)
        const r = i === 5 ? 0.0 : 0.5 + (i % 2) * 0.12
        _v.set(Math.cos(th) * r, 0.05, Math.sin(th) * r)
        _q.setFromAxisAngle(Y, i === 5 ? t * (3 + I * 14) : Math.atan2(-Math.sin(th), Math.cos(th)))
        _s.setScalar(0.42)
        _m.compose(_v, _q, _s)
        s.setMatrixAt(i, _m)
      }
      s.instanceMatrix.needsUpdate = true
    }
    if (lightRef.current) {
      _s.setScalar(1.02 + 0.05 * Math.sin(t * 4))
      _m.compose(_v.set(0, 0.06, 0), _q.setFromAxisAngle(X, Math.PI / 2), _s)
      lightRef.current.setMatrixAt(0, _m)
      lightRef.current.setColorAt(0, _c.set(pal.accent).multiplyScalar(0.2 + I * 0.8))
      lightRef.current.instanceMatrix.needsUpdate = true
      if (lightRef.current.instanceColor) lightRef.current.instanceColor.needsUpdate = true
    }
    const f = flurryRef.current
    if (f) {
      const k = stage.phase === 'salida' ? 2.2 * stage.intensity : stage.phase === 'climax' ? 0.8 : 0
      for (let i = 0; i < 18; i++) {
        const ph = (t * 0.6 + i / 18) % 1
        _v.set(Math.cos(i * 2.4) * 0.9 * ph, 0.2 + ph * seg.radius * 0.5, Math.sin(i * 2.4) * 0.9 * ph)
        _s.setScalar(0.05 * k)
        _m.compose(_v, IDENT_Q, _s)
        f.setMatrixAt(i, _m)
      }
      f.instanceMatrix.needsUpdate = true
    }
  })
  return <group position={rink.pos} quaternion={rink.quat} scale={0.9}>
    <mesh geometry={G.rink} material={M.clay} />
    <instancedMesh ref={lightRef} name="hielo-evento-pista-luz" args={[G.gate, M.ring, 1]} frustumCulled={false} />
    <instancedMesh ref={skRef} name="hielo-evento-patinadores" args={[G.penguin, M.clay, 6]} frustumCulled={false} />
    <instancedMesh ref={flurryRef} name="hielo-evento-ventisca" args={[G.orb, M.snow, 18]} frustumCulled={false} />
  </group>
}

function SealCaveEvent({ seg, stage, G, M, pal }) {
  const N = 14
  const iceRef = useRef(); const dropRef = useRef(); const sealRef = useRef([]); const jetRef = useRef()
  const base = useMemo(() => {
    const rng = mulberry32(seg.i * 977 + 5)
    return Array.from({ length: N }, (_, i) => ({ u: 0.16 + 0.68 * (i / N) + rng() * 0.03, a: Math.PI + (rng() - 0.5) * 1.5, d: rng() * 0.8, sc: 0.35 + rng() * 0.25 }))
  }, [seg])
  const seals = useMemo(() => [placeAlong(seg, 0.36, 0.02, 1.0), placeAlong(seg, 0.64, 0.02, -1.0)], [seg])
  const jet = useMemo(() => placeAlong(seg, 0.5, 0.02, 0), [seg])
  useWayBounds(iceRef, seg.way); useWayBounds(dropRef, seg.way)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const I = stage.intensity; const R = seg.radius
    const fall = stage.phase === 'climax' ? smooth(0.05, 0.65, stage.k) : 0
    const ic = iceRef.current
    if (ic) {
      for (let i = 0; i < N; i++) {
        const b = base[i]
        const d = THREE.MathUtils.clamp(fall * 1.6 - b.d, 0, 1)
        const shake = d === 0 ? Math.sin(t * 34 + i) * 0.05 * I : 0
        placeAlongInto(seg, b.u, 0.02 + d * d * R * 1.3, b.a, _pl)
        _q.copy(_pl.quat).multiply(_q2.setFromAxisAngle(Z, shake))
        _s.setScalar(b.sc * (1 - smooth(0.8, 1, d)) * (0.6 + 0.4 * Math.min(1, I + 0.4)))
        _m.compose(_pl.pos, _q, _s)
        ic.setMatrixAt(i, _m)
      }
      ic.instanceMatrix.needsUpdate = true
    }
    for (let k = 0; k < 2; k++) {
      const sl = sealRef.current[k]
      if (sl) {
        const clap = Math.abs(Math.sin(t * (3 + I * 6) + k * 1.7))
        sl.position.y = clap * 0.12 * (0.3 + I)
        sl.scale.set(0.55, 0.55 * (1 - 0.12 * clap * I), 0.55)
      }
    }
    const blow = stage.phase === 'climax' ? smooth(0.1, 0.5, stage.k) * (0.7 + 0.3 * Math.sin(t * 6) ** 2) : stage.phase === 'salida' ? I * 0.5 : 0
    if (jetRef.current) { jetRef.current.scale.set(0.12 * blow, R * 0.9 * blow, 0.12 * blow); jetRef.current.position.set(0, R * 0.45 * blow, 0) }
    const d = dropRef.current
    if (d) {
      for (let i = 0; i < 14; i++) {
        const k = (t * 1.1 + i / 14) % 1
        _v.set(Math.sin(i * 2.4) * k * 0.8, 0.1 + blow * R * 1.1 * (4 * k * (1 - k)), Math.cos(i * 2.4) * k * 0.8)
        _s.setScalar(0.07 * blow)
        _m.compose(_v, IDENT_Q, _s)
        d.setMatrixAt(i, _m)
      }
      d.instanceMatrix.needsUpdate = true
    }
  })
  return <group>
    <instancedMesh ref={iceRef} name="hielo-evento-estalactitas" args={[G.icicle, M.clay, N]} />
    {seals.map((p, k) => <group key={k} position={p.pos} quaternion={p.quat}>
      <mesh ref={(el) => { sealRef.current[k] = el }} geometry={G.seal} material={M.clay} scale={0.55} />
    </group>)}
    <group position={jet.pos} quaternion={jet.quat}>
      <mesh ref={jetRef} geometry={G.cyl} material={M.spout} />
      <instancedMesh ref={dropRef} name="hielo-evento-geiser" args={[G.orb, M.spout, 14]} frustumCulled={false} />
    </group>
  </group>
}

function EventSet({ seg, kind, pal, G, M }) {
  const label = useMemo(() => {
    const p = placeAlong(seg, 0.08, 0.75, 0.95)
    return { pos: p.pos, quat: p.quat.clone().multiply(FLIP_Y) }
  }, [seg])
  const render = useMemo(() => (stage) => kind === 0 ? <SledRaceEvent seg={seg} stage={stage} G={G} M={M} pal={pal} />
    : kind === 1 ? <SkateEvent seg={seg} stage={stage} G={G} M={M} pal={pal} /> : <SealCaveEvent seg={seg} stage={stage} G={G} M={M} pal={pal} />, [seg, kind, pal, G, M])
  return <>
    <EventStage segment={seg} render={render} />
    <Billboard text={pal.label} style={{ ...ESTILO_PANTALLA, sub: seg.name }} height={0.28} position={label.pos} quat={label.quat} glow={1.2} />
  </>
}

// ═══════════════════════════ MINI MAPA COMPLETO ═══════════════════════════
export default function Vida({ way, detail }) {
  const G = getGeos()
  const M = getMats()
  const info = useMemo(() => routeInfo(way), [way])
  const solid = useMemo(() => info.segments.filter((s) => !s.air).map((s) => s.seg), [info])
  const keyOf = (si) => profKey(info.routes[si.route], si.route >= 0 ? si.route : si.i)

  const parts = useMemo(() => {
    const terr = []; const sky = []
    for (const si of info.segments) {
      if (si.air) continue
      const seg = si.seg; const P = PAL[keyOf(si)]
      terr.push(buildTerrainGeo(seg, { arc: ARC, maxH: Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22), radial: 22, along: Math.min(90, Math.ceil(seg.length * 1.2)), colors: P.terr, height: (u, a) => drifts(seg, u, a) }))
      sky.push(buildSkyGeo(seg, { radial: 14, along: Math.min(30, Math.ceil(seg.length * 0.5)), colors: P.sky }))
    }
    const merge = (l) => { if (!l.length) return null; const g = mergeGeometries(l, false); l.forEach((x) => x.dispose()); return g }
    return { terrain: merge(terr), sky: merge(sky) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info])
  useAutoDispose(parts)
  useFrame(() => { M.sky.opacity = THREE.MathUtils.lerp(0.22, 0.58, detail?.value ?? 1) })

  const props = useMemo(() => {
    const rng = mulberry32(way.idx * 2381 + 17)
    const sc = (n, o) => seat(scatter(way, n, rng, { angle: [-1.3, 1.3], clear: BALL_R * 0.75, offset: [0.02, 0.05], ...o }))
    const pines = sc(32, { scale: [0.5, 0.95] })
    const spires = sc(28, { scale: [0.45, 0.9] })
    const blocks = sc(24, { scale: [0.45, 0.85] })
    const mounds = sc(40, { scale: [0.5, 1.0] })
    const fringe = scatter(way, 30, rng, { angle: [1.38, 1.7], clear: 0, offset: [0.02, 0.05], scale: [0.4, 0.7] }).concat(scatter(way, 30, rng, { angle: [-1.7, -1.38], clear: 0, offset: [0.02, 0.05], scale: [0.4, 0.7] }))
    // estalactitas colgando del techo (lejos de los carriles del techo)
    const icicles = scatter(way, 46, rng, { angle: [Math.PI * 0.78, Math.PI * 1.22], clear: BALL_R * 1.1, offset: [0, 0.02], scale: [0.35, 0.7] })
    const igloos = []; const snowmen = []; const rinks = []; const sleds = []; const screens = []
    for (const si of info.segments) {
      if (si.air || si.event) continue
      const seg = si.seg; const kind = (si.i + (si.route < 0 ? 0 : si.route)) % 4
      const side = si.i % 2 ? 1 : -1; const a = side * 1.12
      if (laneGap(seg, a) < BALL_R * 0.5 / seg.radius) continue
      const u = 0.45 + 0.1 * Math.sin(si.i)
      const p = placeAlong(seg, u, surfOff(seg, u, a), a)
      if (kind === 0) igloos.push({ pos: p.pos, quat: p.quat, scale: 0.6 })
      else if (kind === 1) snowmen.push({ pos: p.pos, quat: p.quat, scale: 0.65 })
      else if (kind === 2) { const r = placeAlong(seg, u, surfOff(seg, u, a), a); rinks.push({ pos: r.pos, quat: r.quat, scale: 0.55 }) }
      else sleds.push({ pos: p.pos, quat: p.quat, scale: 0.55 })
      if (seg.length > 16) {
        const sp = placeAlong(seg, 0.5, 0.55, -side * 0.9)
        screens.push({ key: seg.i, pos: sp.pos, quat: sp.quat.clone().multiply(FLIP_Y), text: PAL[keyOf(si)].label, sub: seg.name })
      }
    }
    return { pines, spires, blocks, mounds, fringe, icicles, igloos, snowmen, rinks, sleds, screens }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [way, info])

  const gates = useMemo(() => {
    const out = []
    for (const kind of ['salida', 'llegada']) {
      const si = info.shared.find((s) => s.kind === kind)
      if (!si) continue
      const u = kind === 'salida' ? 0.5 : 0.82
      const p = placeAlong(si.seg, u, si.seg.radius, 0)
      const b = placeAlong(si.seg, u, si.seg.radius * 0.5, 0)
      out.push({ kind, pos: p.pos, quat: p.quat, scale: si.seg.radius * 0.94, bpos: b.pos, bquat: b.quat.clone().multiply(FLIP_Y) })
    }
    return out
  }, [info])

  const routeFauna = info.routes.map((rt, i) => {
    const key = profKey(rt.route, i); const k = PERFILES.indexOf(key)
    const segs = rt.segments.filter((s) => !s.air).map((s) => s.seg)
    if (!segs.length) return null
    return <group key={rt.r} name={`hielo-fauna-${rt.r}`}>
      <Herd way={way} segs={segs} geo={G.penguin} mat={M.clay} groups={k === 0 ? 4 : 3} per={k === 0 ? 6 : 5} speed={k === 0 ? 3.2 : 1.6} scale={0.34} seed={10 + i} wag={0.25} bob={0.0} hop={0.25} detail={detail} />
      {k !== 0 && <Herd way={way} segs={segs} geo={G.bear} mat={M.clay} groups={2} per={k === 2 ? 2 : 1} speed={0.5} scale={0.5} seed={20 + i} angle={[0.85, 1.2]} wag={0.05} bob={0.01} detail={detail} />}
      {k === 2 && <Herd way={way} segs={segs} geo={G.seal} mat={M.clay} groups={2} per={3} speed={0.35} scale={0.42} seed={30 + i} angle={[0.82, 1.15]} wag={0.1} bob={0.015} hop={0.3} detail={detail} />}
    </group>
  })

  const eventEls = useMemo(() => {
    const seen = new Set(); const out = []
    const add = (si, kind) => { if (!si || seen.has(si.i)) return; seen.add(si.i); out.push(<EventSet key={si.i} seg={si.seg} kind={kind} pal={PAL[PERFILES[kind]]} G={G} M={M} />) }
    for (const si of info.events) add(si, si.route >= 0 ? PERFILES.indexOf(profKey(info.routes[si.route], si.route)) : si.i % 3)
    info.routes.forEach((rt, i) => {
      const mids = rt.segments.filter((s) => !s.air && s.route >= 0)
      add(mids[Math.floor(mids.length * 0.5)] ?? mids[0], PERFILES.indexOf(profKey(rt.route, i)))
    })
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info])

  return <group name="vida-hielo">
    {parts.terrain && <mesh name="hielo-terreno" geometry={parts.terrain} material={M.terrain} />}
    {parts.sky && <mesh name="hielo-cielo" geometry={parts.sky} material={M.sky} />}
    <CartelesDeRuta way={way} style={ESTILO} poleColor="#7297ad" />
    <Instanced geo={G.pine} mat={M.clay} items={props.pines} />
    <Instanced geo={G.spire} mat={M.clay} items={props.spires} />
    <Instanced geo={G.block} mat={M.clay} items={props.blocks} />
    <Instanced geo={G.igloo} mat={M.clay} items={props.igloos} />
    <Instanced geo={G.snowman} mat={M.clay} items={props.snowmen} />
    <Instanced geo={G.rink} mat={M.clay} items={props.rinks} />
    <Instanced geo={G.sledPeng} mat={M.clay} items={props.sleds} />
    <DetailGroup detail={detail} min={0.45}>
      <Instanced geo={G.mound} mat={M.clay} items={props.mounds} />
      <Instanced geo={G.pine} mat={M.clay} items={props.fringe} />
      <Instanced geo={G.icicle} mat={M.clay} items={props.icicles} />
    </DetailGroup>
    {props.screens.map((s) => <Billboard key={s.key} text={s.text} style={{ ...ESTILO_PANTALLA, sub: s.sub }} height={0.26} position={s.pos} quat={s.quat} glow={1.2} />)}
    {gates.map((g) => <group key={g.kind}>
      <mesh geometry={G.arch} material={M.clay} position={g.pos} quaternion={g.quat} scale={g.scale} />
      <Billboard text={g.kind === 'salida' ? '❄ BIENVENIDO AL POLO' : '🏁 META GLACIAR'} style={ESTILO_PANTALLA} height={0.28} position={g.bpos} quat={g.bquat} glow={1.2} />
    </group>)}
    {routeFauna}
    <Blizzard way={way} segs={solid} G={G} M={M} detail={detail} />
    <AuroraSky way={way} segs={solid} G={G} M={M} detail={detail} pal={PAL[PERFILES[way.idx % 3]]} />
    <LaneMechanisms way={way} G={G} M={M} detail={detail} />
    {eventEls}
  </group>
}
