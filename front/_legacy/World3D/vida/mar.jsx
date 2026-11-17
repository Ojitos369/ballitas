// Vida del Camino del Mar: mini mundo submarino dentro del tubo de cristal (contrato en README.md).
// Terreno de arena y arrecife, cielo-superficie, cardúmenes, medusas, tortugas, ballenas, hitos (faro,
// naufragio, torres de coral) y mecanismos de carril: remolino con pulpo, chorro de ballena, corriente.
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
const IDENT_Q = new THREE.Quaternion()
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

const ESTILO = { color: '#e8fcff', bg: 'rgba(5,39,64,0.94)', border: '#52e5ef' }
const ESTILO_PANTALLA = { color: '#e8fcff', bg: 'rgba(4,34,60,0.94)', border: '#52e5ef', size: 46 }

const _v = new THREE.Vector3()
const _w = new THREE.Vector3()
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

  // Pez chibi (blanco: se tiñe por instancia)
  const fish = mergePainted([
    bakePart(sph10, '#ffffff', 0, 0.2, 0, 0, 0, 0, 0.13, 0.17, 0.3),
    bakePart(sph, '#fff1c8', 0, 0.14, 0.05, 0, 0, 0, 0.11, 0.1, 0.24),
    bakePart(cone, '#ffffff', 0, 0.2, -0.38, -P / 2, 0, 0, 0.02, 0.22, 0.16),
    bakePart(cone, '#ffffff', 0, 0.38, -0.02, 0, 0, 0, 0.02, 0.1, 0.12),
    bakePart(sph, '#ffffff', -0.13, 0.15, 0.05, 0, 0, 0.5, 0.02, 0.05, 0.09),
    bakePart(sph, '#ffffff', 0.13, 0.15, 0.05, 0, 0, -0.5, 0.02, 0.05, 0.09),
    bakePart(sph, '#ffffff', -0.1, 0.25, 0.2, 0, 0, 0, 0.045, 0.05, 0.04),
    bakePart(sph, '#ffffff', 0.1, 0.25, 0.2, 0, 0, 0, 0.045, 0.05, 0.04),
    bakePart(sph, '#101820', -0.11, 0.25, 0.235, 0, 0, 0, 0.026, 0.03, 0.02),
    bakePart(sph, '#101820', 0.11, 0.25, 0.235, 0, 0, 0, 0.026, 0.03, 0.02),
  ])
  // Medusa chibi con carita
  const jelly = mergePainted([
    bakePart(dome, '#ffffff', 0, 0.24, 0, 0, 0, 0, 0.3, 0.26, 0.3),
    bakePart(sph, '#ffe8ff', 0, 0.3, 0, 0, 0, 0, 0.16, 0.12, 0.16),
    bakePart(sph, '#1a1030', -0.09, 0.2, 0.24, 0, 0, 0, 0.03, 0.04, 0.02),
    bakePart(sph, '#1a1030', 0.09, 0.2, 0.24, 0, 0, 0, 0.03, 0.04, 0.02),
    bakePart(sph, '#ff9ed2', -0.17, 0.15, 0.22, 0, 0, 0, 0.04, 0.025, 0.02),
    bakePart(sph, '#ff9ed2', 0.17, 0.15, 0.22, 0, 0, 0, 0.04, 0.025, 0.02),
    ...[0, 1, 2, 3, 4].map((k) => bakePart(cap, '#ffd6f2', Math.cos(k * 1.257) * 0.15, 0.05, Math.sin(k * 1.257) * 0.15, 0, 0, 0, 0.018, 0.1, 0.018)),
  ])
  // Tortuga marina chibi
  const turtle = mergePainted([
    bakePart(dome, '#3f9b66', 0, 0.12, 0, 0, 0, 0, 0.3, 0.2, 0.34),
    bakePart(sph, '#2c7a52', 0, 0.3, 0.02, 0, 0, 0, 0.13, 0.05, 0.15),
    bakePart(sph, '#e8d8a0', 0, 0.1, 0, 0, 0, 0, 0.27, 0.07, 0.3),
    bakePart(sph10, '#7fcf8a', 0, 0.16, 0.38, 0, 0, 0, 0.13, 0.12, 0.13),
    bakePart(sph, '#101820', -0.06, 0.2, 0.48, 0, 0, 0, 0.02, 0.025, 0.015),
    bakePart(sph, '#101820', 0.06, 0.2, 0.48, 0, 0, 0, 0.02, 0.025, 0.015),
    bakePart(sph, '#ff9eb8', -0.1, 0.14, 0.46, 0, 0, 0, 0.03, 0.02, 0.015),
    bakePart(sph, '#ff9eb8', 0.1, 0.14, 0.46, 0, 0, 0, 0.03, 0.02, 0.015),
    bakePart(sph, '#7fcf8a', -0.36, 0.11, 0.18, 0, 0.4, 0.3, 0.16, 0.035, 0.08),
    bakePart(sph, '#7fcf8a', 0.36, 0.11, 0.18, 0, -0.4, -0.3, 0.16, 0.035, 0.08),
    bakePart(sph, '#7fcf8a', -0.24, 0.1, -0.28, 0, -0.3, 0.2, 0.1, 0.03, 0.06),
    bakePart(sph, '#7fcf8a', 0.24, 0.1, -0.28, 0, 0.3, -0.2, 0.1, 0.03, 0.06),
  ])
  // Ballena azul chibi (cuerpo grande, vientre claro, aleta caudal)
  const whale = mergePainted([
    bakePart(sph10, '#3b78c4', 0, 0.5, 0, 0, 0, 0, 0.72, 0.64, 1.3),
    bakePart(sph10, '#e8f4ff', 0, 0.36, 0.12, 0, 0, 0, 0.6, 0.42, 1.15),
    bakePart(sph10, '#3b78c4', 0, 0.56, -1.15, 0, 0, 0, 0.36, 0.34, 0.6),
    bakePart(cone, '#3b78c4', 0, 0.74, -1.78, -P / 2 - 0.4, 0, 0, 0.1, 0.5, 0.1),
    bakePart(sph, '#2f66ad', -0.3, 0.82, -1.98, 0, 0, 0.3, 0.34, 0.05, 0.16),
    bakePart(sph, '#2f66ad', 0.3, 0.82, -1.98, 0, 0, -0.3, 0.34, 0.05, 0.16),
    bakePart(sph, '#2f66ad', -0.62, 0.3, 0.4, 0, 0, 0.5, 0.3, 0.05, 0.12),
    bakePart(sph, '#2f66ad', 0.62, 0.3, 0.4, 0, 0, -0.5, 0.3, 0.05, 0.12),
    bakePart(sph, '#ffffff', -0.4, 0.62, 1.0, 0, 0, 0, 0.1, 0.11, 0.06),
    bakePart(sph, '#ffffff', 0.4, 0.62, 1.0, 0, 0, 0, 0.1, 0.11, 0.06),
    bakePart(sph, '#101820', -0.42, 0.62, 1.05, 0, 0, 0, 0.055, 0.07, 0.035),
    bakePart(sph, '#101820', 0.42, 0.62, 1.05, 0, 0, 0, 0.055, 0.07, 0.035),
    bakePart(sph, '#ff9eb8', -0.52, 0.45, 1.0, 0, 0, 0, 0.1, 0.06, 0.04),
    bakePart(sph, '#ff9eb8', 0.52, 0.45, 1.0, 0, 0, 0, 0.1, 0.06, 0.04),
    bakePart(sph, '#1d3f73', 0, 1.1, 0.55, 0, 0, 0, 0.07, 0.03, 0.07),
  ])
  // Pulpo chibi
  const octo = mergePainted([
    bakePart(sph10, '#e0587f', 0, 0.42, 0, 0, 0, 0, 0.3, 0.32, 0.3),
    bakePart(sph, '#ffffff', -0.11, 0.4, 0.24, 0, 0, 0, 0.07, 0.08, 0.04),
    bakePart(sph, '#ffffff', 0.11, 0.4, 0.24, 0, 0, 0, 0.07, 0.08, 0.04),
    bakePart(sph, '#1a1030', -0.11, 0.4, 0.27, 0, 0, 0, 0.04, 0.05, 0.03),
    bakePart(sph, '#1a1030', 0.11, 0.4, 0.27, 0, 0, 0, 0.04, 0.05, 0.03),
    bakePart(sph, '#ffb0c8', -0.2, 0.3, 0.24, 0, 0, 0, 0.05, 0.03, 0.02),
    bakePart(sph, '#ffb0c8', 0.2, 0.3, 0.24, 0, 0, 0, 0.05, 0.03, 0.02),
    ...[0, 1, 2, 3, 4, 5].map((k) => {
      const a = k * (TAU / 6)
      return bakePart(cap, '#c94670', Math.cos(a) * 0.22, 0.12, Math.sin(a) * 0.22, -Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5, 0.06, 0.1, 0.06)
    }),
  ])
  // Cangrejo chibi
  const crab = mergePainted([
    bakePart(sph10, '#ff6a4a', 0, 0.14, 0, 0, 0, 0, 0.22, 0.12, 0.17),
    bakePart(cyl, '#ff6a4a', -0.07, 0.3, 0.1, 0, 0, 0, 0.02, 0.1, 0.02),
    bakePart(cyl, '#ff6a4a', 0.07, 0.3, 0.1, 0, 0, 0, 0.02, 0.1, 0.02),
    bakePart(sph, '#ffffff', -0.07, 0.38, 0.1, 0, 0, 0, 0.045, 0.045, 0.045),
    bakePart(sph, '#ffffff', 0.07, 0.38, 0.1, 0, 0, 0, 0.045, 0.045, 0.045),
    bakePart(sph, '#101820', -0.07, 0.38, 0.14, 0, 0, 0, 0.022, 0.022, 0.02),
    bakePart(sph, '#101820', 0.07, 0.38, 0.14, 0, 0, 0, 0.022, 0.022, 0.02),
    bakePart(sph, '#ff8a6a', -0.28, 0.17, 0.12, 0, 0, 0, 0.09, 0.07, 0.07),
    bakePart(sph, '#ff8a6a', 0.28, 0.17, 0.12, 0, 0, 0, 0.09, 0.07, 0.07),
    bakePart(sph, '#ff6a4a', -0.2, 0.06, 0, 0, 0, 0, 0.1, 0.03, 0.04),
    bakePart(sph, '#ff6a4a', 0.2, 0.06, 0, 0, 0, 0, 0.1, 0.03, 0.04),
  ])
  // Coral ramificado, cerebro, abanico, kelp, anémona (blancos: tinte por instancia)
  const coral = mergePainted([
    bakePart(cap, '#ffffff', 0, 0.3, 0, 0, 0, 0, 0.07, 0.16, 0.07),
    bakePart(cap, '#ffffff', 0.12, 0.26, 0.02, 0, 0, -0.6, 0.055, 0.12, 0.055),
    bakePart(cap, '#ffffff', -0.11, 0.24, -0.03, 0.2, 0, 0.55, 0.055, 0.11, 0.055),
    bakePart(sph, '#fff0d8', 0, 0.56, 0, 0, 0, 0, 0.08, 0.08, 0.08),
    bakePart(sph, '#fff0d8', 0.22, 0.42, 0.02, 0, 0, 0, 0.06, 0.06, 0.06),
    bakePart(sph, '#fff0d8', -0.2, 0.38, -0.04, 0, 0, 0, 0.06, 0.06, 0.06),
  ])
  const brain = mergePainted([
    bakePart(sph10, '#ffffff', 0, 0.14, 0, 0, 0, 0, 0.3, 0.2, 0.28),
    bakePart(sph, '#fff0d8', 0.05, 0.28, 0.02, 0, 0, 0, 0.18, 0.08, 0.16),
    bakePart(sph, '#fff0d8', -0.14, 0.2, -0.08, 0, 0, 0, 0.1, 0.06, 0.1),
  ])
  const fan = mergePainted([
    bakePart(cyl, '#8a6a5a', 0, 0.1, 0, 0, 0, 0, 0.03, 0.2, 0.03),
    bakePart(sph10, '#ffffff', 0, 0.42, 0, 0, 0, 0, 0.3, 0.34, 0.03),
    bakePart(sph, '#fff0d8', 0, 0.5, 0.02, 0, 0, 0, 0.18, 0.2, 0.03),
  ])
  const kelp = mergePainted([
    bakePart(cap, '#2f9e63', 0, 0.3, 0, 0, 0, 0.15, 0.05, 0.22, 0.03),
    bakePart(cap, '#3fb877', 0.05, 0.78, 0, 0, 0, -0.2, 0.045, 0.2, 0.03),
    bakePart(cap, '#47c279', 0.0, 1.2, 0, 0, 0, 0.18, 0.04, 0.18, 0.03),
  ])
  const anemone = mergePainted([
    bakePart(cyl, '#a35a7a', 0, 0.1, 0, 0, 0, 0, 0.12, 0.2, 0.12),
    ...[0, 1, 2, 3, 4, 5].map((k) => bakePart(cap, '#ffffff', Math.cos(k * 1.047) * 0.09, 0.28, Math.sin(k * 1.047) * 0.09, Math.sin(k * 1.047) * 0.25, 0, -Math.cos(k * 1.047) * 0.25, 0.025, 0.1, 0.025)),
  ])
  const rock = mergePainted([
    bakePart(sph10, '#4d6f8c', 0, 0.16, 0, 0, 0, 0, 0.36, 0.2, 0.3),
    bakePart(sph, '#5f84a3', 0.14, 0.24, -0.04, 0, 0, 0, 0.2, 0.15, 0.18),
  ])
  const star = mergePainted([
    ...[0, 1, 2, 3, 4].map((k) => bakePart(cone, '#ffffff', Math.cos(k * 1.257) * 0.14, 0.03, Math.sin(k * 1.257) * 0.14, P / 2, 0, 0, 0.06, 0.18, 0.025)),
    bakePart(sph, '#fff0d8', 0, 0.05, 0, 0, 0, 0, 0.09, 0.05, 0.09),
  ])
  const clam = mergePainted([
    bakePart(dome, '#f6d7e8', 0, 0.04, 0, 0, 0, 0, 0.2, 0.12, 0.18),
    bakePart(dome, '#e8b8d4', 0, 0.12, -0.02, -0.5, 0, 0, 0.2, 0.1, 0.18),
    bakePart(sph, '#ffffff', 0, 0.1, 0.02, 0, 0, 0, 0.06, 0.06, 0.06),
  ])
  // Naufragio, faro y cofre
  const wreck = mergePainted([
    bakePart(sph10, '#6b4a33', 0, 0.3, 0, 0, 0, 0.35, 0.5, 0.26, 1.1),
    bakePart(sph, '#563a28', 0.05, 0.42, 0.15, 0, 0, 0.35, 0.44, 0.1, 0.8),
    bakePart(cyl, '#8a6a48', 0.0, 0.86, 0.1, 0, 0, 0.35, 0.04, 0.5, 0.04),
    bakePart(sph, '#e9e2cf', 0.18, 0.92, 0.1, 0, 0, 0.35, 0.02, 0.28, 0.2),
    bakePart(sph, '#101820', 0.22, 0.28, 0.5, 0, 0, 0, 0.1, 0.1, 0.04),
    bakePart(cyl, '#2f2f38', -0.12, 0.5, -0.4, P / 2, 0, 0, 0.05, 0.14, 0.05),
  ])
  const lighthouse = mergePainted([
    bakePart(new THREE.CylinderGeometry(0.34, 0.5, 1, 10), '#f4f4f8', 0, 0.5, 0),
    bakePart(new THREE.CylinderGeometry(0.4, 0.43, 0.2, 10), '#e0463e', 0, 0.55, 0),
    bakePart(new THREE.CylinderGeometry(0.37, 0.4, 0.2, 10), '#e0463e', 0, 0.95, 0),
    bakePart(cyl, '#454a56', 0, 1.1, 0, 0, 0, 0, 0.42, 0.06, 0.42),
    bakePart(cyl, '#d8f4ff', 0, 1.22, 0, 0, 0, 0, 0.24, 0.18, 0.24),
    bakePart(cone, '#e0463e', 0, 1.5, 0, 0, 0, 0, 0.32, 0.3, 0.32),
    bakePart(sph, '#fff3b0', 0, 1.22, 0, 0, 0, 0, 0.14, 0.14, 0.14),
  ])
  const chestBase = mergePainted([
    bakePart(box, '#7a4a22', 0, 0.12, 0, 0, 0, 0, 0.5, 0.24, 0.32),
    bakePart(box, '#d9a84a', 0, 0.12, 0.165, 0, 0, 0, 0.1, 0.26, 0.02),
    bakePart(sph, '#ffd86b', 0, 0.26, 0, 0, 0, 0, 0.18, 0.06, 0.12),
  ])
  const chestLid = mergePainted([
    bakePart(dome, '#8a5a2a', 0, 0, 0.16, 0, 0, 0, 0.26, 0.14, 0.17),
    bakePart(box, '#d9a84a', 0, 0.02, 0.32, 0, 0, 0, 0.1, 0.1, 0.02),
  ])
  // Cola de ballena (cabeza del chorro), flecha de corriente, arco de coral y boya
  const fluke = mergePainted([
    bakePart(cap, '#3b78c4', 0, 0.3, 0, 0, 0, 0, 0.1, 0.2, 0.1),
    bakePart(sph, '#3b78c4', -0.22, 0.66, 0, 0, 0, 0.5, 0.26, 0.05, 0.12),
    bakePart(sph, '#3b78c4', 0.22, 0.66, 0, 0, 0, -0.5, 0.26, 0.05, 0.12),
    bakePart(sph, '#e8f4ff', 0, 0.66, 0.04, 0, 0, 0, 0.07, 0.04, 0.05),
  ])
  const arrow = mergePainted([
    bakePart(cone, '#ffffff', 0, 0.04, 0.12, P / 2, 0, 0, 0.14, 0.2, 0.025),
    bakePart(cone, '#ffffff', 0, 0.04, -0.14, P / 2, 0, 0, 0.14, 0.2, 0.025),
  ])
  const gate = new THREE.TorusGeometry(1, 0.07, 6, 18)
  const arch = mergePainted([bakePart(new THREE.TorusGeometry(1, 0.06, 6, 22), '#ff8a7a')])
  const buoy = mergePainted([
    bakePart(sph10, '#ff5a4a', 0, 0.2, 0, 0, 0, 0, 0.2, 0.2, 0.2),
    bakePart(cyl, '#ffffff', 0, 0.2, 0, 0, 0, 0, 0.205, 0.05, 0.205),
    bakePart(cone, '#ffd24a', 0, 0.5, 0, 0, 0, 0, 0.06, 0.2, 0.06),
  ])
  const orb = new THREE.SphereGeometry(1, 8, 6)
  const unit = { cyl, tor, orb, cone, cap }
  GEOS = markShared({ fish, jelly, turtle, whale, octo, crab, coral, brain, fan, kelp, anemone, rock, star, clam, wreck, lighthouse, chestBase, chestLid, fluke, arrow, gate, arch, buoy, ...unit })
  sph10.dispose(); sph.dispose(); dome.dispose(); box.dispose()
  return GEOS
}

let MATS = null
function getMats() {
  if (MATS) return MATS
  MATS = markShared({
    clay: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.05, emissive: '#0a3a4a', emissiveIntensity: 0.3 }),
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide, emissive: '#06323f', emissiveIntensity: 0.3 }),
    sky: new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.6, depthWrite: false }),
    pad: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    gold: new THREE.MeshBasicMaterial({ color: '#ffd86b', toneMapped: false }),
    bubble: new THREE.MeshBasicMaterial({ color: '#c8ffff', transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }),
    foam: new THREE.MeshBasicMaterial({ color: '#f2ffff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
    beam: new THREE.MeshBasicMaterial({ color: '#fff3b0', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    spout: new THREE.MeshBasicMaterial({ color: '#d8fbff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    link: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    ring: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
  })
  return MATS
}

// ═══════════════════════════ PALETAS POR PERFIL DE RUTA ═══════════════════════════
const PERFILES = ['rapida', 'media', 'lenta']
const PAL = {
  rapida: { terr: ['#0a5a73', '#4fe0cd'], sky: ['#052f55', '#27d0d8'], accent: '#57f2ec', fish: ['#ffd45e', '#ff8a5e', '#7ce8ff'], coral: ['#ff7a8a', '#ffb36b', '#57f2ec', '#c98aff'], label: '🌀 CORRIENTE TURBO' },
  media: { terr: ['#165277', '#ff9d79'], sky: ['#103f66', '#ff9c88'], accent: '#ffb583', fish: ['#ff9aa8', '#ffe27a', '#9dffd8'], coral: ['#ff8d78', '#ee7da8', '#ffd86b', '#9dffd8'], label: '⚓ FARO Y NAUFRAGIO' },
  lenta: { terr: ['#083e66', '#8fd8ee'], sky: ['#061f4d', '#7fd6ff'], accent: '#9cdded', fish: ['#b6c8ff', '#ffe68a', '#ff9ac8'], coral: ['#c98aff', '#7ce8ff', '#ff9ac8', '#9dffd8'], label: '🐋 CANTO DE BALLENA' },
}
const profKey = (route, idx) => (PAL[route?.profile?.speed] ? route.profile.speed : PERFILES[idx % 3])

// ═══════════════════════════ TERRENO ═══════════════════════════
const ARC = Math.PI * 0.5
function dunes(seg, u, a) {
  const bank = smooth(0.42, 0.68, Math.abs(a))
  const L = seg.length
  const h = 0.5 + 0.3 * Math.sin(u * L * 0.7 + a * 5 + seg.i) + 0.2 * Math.cos(u * L * 0.31 - a * 2.4)
  return THREE.MathUtils.clamp(h, 0, 1) * (0.35 + 0.65 * bank)
}
function surfOff(seg, u, a) {
  const edge = 1 - smooth(ARC * 0.7, ARC, Math.abs(a))
  const chan = smooth(0.02, 0.32, laneGap(seg, a))
  const maxH = Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22)
  return seg.radius * 0.015 + dunes(seg, u, a) * edge * chan * maxH
}
function seat(items, lift = 0) {
  for (const it of items) {
    const p = placeAlong(it.seg, it.u, surfOff(it.seg, it.u, it.angle) + lift, it.angle)
    it.pos.copy(p.pos); it.quat.copy(p.quat)
  }
  return items
}
function tint(items, rng, colors) {
  for (const it of items) it.color = colors[Math.floor(rng() * colors.length)]
  return items
}

// ═══════════════════════════ UTILIDADES DE ANIMACIÓN ═══════════════════════════
/** Solo muestra sus hijos con detalle interior suficiente (LOD fino sin re-render). */
function DetailGroup({ detail, min = 0.5, children }) {
  const ref = useRef()
  useFrame(() => {
    const g = ref.current
    if (g) { const v = (detail?.value ?? 1) >= min; if (g.visible !== v) g.visible = v }
  })
  return <group ref={ref}>{children}</group>
}

/** Cardúmenes/rebaños: grupos con líder que patrullan un camino; los seguidores se abren y huyen de las ballitas. */
function Swimmers({
  way, segs, geo, mat, groups = 3, per = 6, speed = 1.2, scale = 0.2, off = [0.3, 1.0], angle = [-1.2, 1.2],
  colors = null, seed = 1, bob = 0.06, wag = 0.25, pulse = 0, spread = 0.5, detail,
}) {
  const path = useMemo(() => segPath(segs), [segs])
  const st = useMemo(() => {
    const rng = mulberry32(seed * 6151 + way.idx * 131 + 7)
    const gs = Array.from({ length: groups }, (_, g) => ({
      s: rng() * path.total, dir: rng() > 0.5 ? 1 : -1, v: speed * (0.75 + rng() * 0.5),
      a: angle[0] + rng() * (angle[1] - angle[0]), o: off[0] + rng() * (off[1] - off[0]), scare: 0,
      color: colors ? colors[g % colors.length] : null,
    }))
    const fs = []
    for (let g = 0; g < groups; g++) {
      for (let k = 0; k < per; k++) {
        fs.push({ g, dx: k ? 0.25 + rng() * 0.9 * (1 + k * 0.15) : 0, da: (rng() - 0.5) * spread, dO: (rng() - 0.5) * spread * 0.9, ph: rng() * TAU })
      }
    }
    return { gs, fs }
  }, [path, groups, per, speed, angle, off, colors, seed, spread, way.idx])
  const items = useMemo(() => st.fs.map((f) => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale, color: st.gs[f.g].color })), [st, scale])
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
      G.s += G.dir * G.v * h * (1 + G.scare * 1.6)
      if (G.s > path.total) { G.s = path.total; G.dir = -1 } else if (G.s < 0) { G.s = 0; G.dir = 1 }
    }
    for (let i = 0; i < st.fs.length; i++) {
      const f = st.fs[i]; const G = st.gs[f.g]
      path.locate(THREE.MathUtils.clamp(G.s - G.dir * f.dx * (1 + G.scare * 0.6), 0, path.total), _loc)
      placeAlongInto(_loc.seg, _loc.u, Math.max(0.05, G.o + f.dO * (1 + G.scare) + Math.sin(t * 1.7 + f.ph) * bob), G.a + f.da * (1 + G.scare * 0.8) + Math.sin(t * 0.9 + f.ph) * 0.1, _pl)
      const it = items[i]
      it.pos.copy(_pl.pos)
      it.quat.copy(_pl.quat)
      if (G.dir < 0) it.quat.multiply(FLIP_Y)
      if (wag) it.quat.multiply(_q2.setFromAxisAngle(Y, Math.sin(t * (8 + G.scare * 6) + f.ph) * wag))
      const pu = pulse ? Math.sin(t * 3 + f.ph) * pulse : 0
      _s.set(scale * (1 - pu * 0.4), scale * (1 + pu), scale * (1 - pu * 0.4))
      _m.compose(it.pos, it.quat, _s)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={mesh} />
}

/** Burbujas ascendentes desde la pared hacia el eje; las olas/espuma viven en el techo (superficie). */
function Bubbles({ way, segs, G, M, detail, n = 44 }) {
  const path = useMemo(() => segPath(segs), [segs])
  const st = useMemo(() => {
    const rng = mulberry32(way.idx * 577 + 13)
    return Array.from({ length: n }, () => ({ s: rng() * path.total, a: (rng() - 0.5) * 2.8, ph: rng(), sp: 0.12 + rng() * 0.18, sc: 0.035 + rng() * 0.05 }))
  }, [path, n, way.idx])
  const ref = useRef()
  useWayBounds(ref, way)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !path.total || (detail?.value ?? 1) < 0.04) return
    const t = clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const b = st[i]
      const k = (t * b.sp + b.ph) % 1
      path.locate(b.s, _loc)
      placeAlongInto(_loc.seg, _loc.u, 0.06 + k * _loc.seg.radius * 0.9, b.a + Math.sin(t * 1.4 + b.ph * 9) * 0.06, _pl)
      _s.setScalar(b.sc * (0.5 + k * 0.7))
      _m.compose(_pl.pos, IDENT_Q, _s)
      m.setMatrixAt(i, _m)
    }
    m.instanceMatrix.needsUpdate = true
  })
  if (!path.total) return null
  return <instancedMesh ref={ref} name="mar-burbujas" args={[G.orb, M.bubble, n]} />
}

function Waves({ way, segs, G, M, detail, n = 40 }) {
  const path = useMemo(() => segPath(segs), [segs])
  const st = useMemo(() => {
    const rng = mulberry32(way.idx * 733 + 5)
    return Array.from({ length: n }, (_, i) => ({ s: (i / n) * path.total + rng(), a: (i % 2 ? 1 : -1) * (Math.PI * (0.78 + rng() * 0.2)), ph: rng() * TAU, sc: 0.12 + rng() * 0.12 }))
  }, [path, n, way.idx])
  const ref = useRef()
  useWayBounds(ref, way)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !path.total || (detail?.value ?? 1) < 0.04) return
    const t = clock.elapsedTime
    for (let i = 0; i < n; i++) {
      const w = st[i]
      path.locate((w.s + Math.sin(t * 0.3 + w.ph) * 0.4) % path.total, _loc)
      placeAlongInto(_loc.seg, _loc.u, 0.02 + (0.5 + 0.5 * Math.sin(t * 1.6 + w.ph)) * 0.06, w.a, _pl)
      _s.set(w.sc * 2.2, w.sc * 0.25, w.sc * 1.1)
      _m.compose(_pl.pos, _pl.quat, _s)
      m.setMatrixAt(i, _m)
    }
    m.instanceMatrix.needsUpdate = true
  })
  if (!path.total) return null
  return <instancedMesh ref={ref} name="mar-olas" args={[G.orb, M.foam, n]} />
}

// ═══════════════════════════ MECANISMOS DE CAMBIO DE CARRIL ═══════════════════════════
// remolino = pulpo que pasa la bola de carril con un tentáculo; geiser = chorro de ballena; cinta = corriente.
const MECH = {
  remolino: { pad: '#a06bff', link: '#ff7ab0', ring: '#ffb3e6' },
  geiser: { pad: '#7ad8ff', link: '#e6fbff', ring: '#bff6ff' },
  cinta: { pad: '#3ef0c0', link: '#46f2c8', ring: '#9dffe6' },
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
        const qLink = new THREE.Quaternion().setFromUnitVectors(Y, len > 1e-4 ? dir.clone().multiplyScalar(1 / len) : Y)
        const qRing = new THREE.Quaternion().setFromUnitVectors(Z, len > 1e-4 ? dir.clone().multiplyScalar(1 / len) : Z)
        const head = kind === 'remolino' ? fOut.pos.clone().addScaledVector(fOut.side, 0.5).addScaledVector(fOut.up, 0.03)
          : kind === 'geiser' ? fIn.pos.clone().addScaledVector(fIn.side, -0.5).addScaledVector(fIn.up, 0.03)
            : fIn.pos.clone().addScaledVector(fIn.up, 0.05)
        out.push({ seg, uIn, kind, qIn, qOut, qLink, qRing, a, mid: a.clone().addScaledVector(dir, 0.5), len, headPos: head, headQ: kind === 'remolino' ? qOut : qIn, pi: fIn.pos.clone().addScaledVector(fIn.up, 0.04) })
      }
    }
    return out
  }, [way])
  const kinds = useMemo(() => {
    const k = { remolino: [], geiser: [], cinta: [] }
    mechs.forEach((m, i) => { m.hi = k[m.kind].length; k[m.kind].push(i) })
    return k
  }, [mechs])
  const padRef = useRef(); const linkRef = useRef(); const ringRef = useRef()
  const headRefs = { remolino: useRef(), geiser: useRef(), cinta: useRef() }
  for (const r of [padRef, linkRef, ringRef, headRefs.remolino, headRefs.geiser, headRefs.cinta]) useWayBounds(r, way) // eslint-disable-line react-hooks/rules-of-hooks
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
      const th = (m.kind === 'geiser' ? 0.06 : m.kind === 'remolino' ? 0.035 : 0.02) * (1 + act * 1.2)
      _s.set(th, m.len * (m.kind === 'geiser' ? 0.55 + act * 0.45 : 1), th)
      _m.compose(m.mid, m.qLink, _s)
      linkRef.current?.setMatrixAt(i, _m); linkRef.current?.setColorAt(i, _c.set(S.link).multiplyScalar(0.35 + act * 0.65))
      _q.copy(m.qRing).multiply(_q2.setFromAxisAngle(Z, t * (2 + act * 7) * (i % 2 ? 1 : -1)))
      _s.setScalar(0.3 + act * 0.16 + Math.sin(t * 3 + i) * 0.03)
      _m.compose(m.mid, _q, _s)
      ringRef.current?.setMatrixAt(i, _m); ringRef.current?.setColorAt(i, _c.set(S.ring).multiplyScalar(0.3 + act * 0.7))
      const hr = headRefs[m.kind].current
      if (hr) {
        _q.copy(m.headQ).multiply(_q2.setFromAxisAngle(Y, Math.sin(t * 2 + i) * (0.3 + act * 0.5)))
        const sc = m.kind === 'cinta' ? 0.9 + act * 0.5 : 0.5 + act * 0.18 + Math.sin(t * 3 + i) * 0.02
        _s.setScalar(sc)
        _m.compose(m.headPos, _q, _s)
        hr.setMatrixAt(m.hi, _m)
        if (m.kind === 'cinta') hr.setColorAt(m.hi, _c.set(S.link).multiplyScalar(0.5 + act * 0.5))
      }
    }
    for (const r of [padRef, linkRef, ringRef]) if (r.current) { r.current.instanceMatrix.needsUpdate = true; if (r.current.instanceColor) r.current.instanceColor.needsUpdate = true }
    for (const k in headRefs) { const r = headRefs[k].current; if (r) { r.instanceMatrix.needsUpdate = true; if (r.instanceColor) r.instanceColor.needsUpdate = true } }
  })
  if (!mechs.length) return null
  return <group name="mar-mecanismos">
    <instancedMesh ref={padRef} name="mar-pad-mecanismo" args={[G.cyl, M.pad, mechs.length]} />
    <instancedMesh ref={linkRef} name="mar-enlace-mecanismo" args={[G.cyl, M.link, mechs.length]} />
    <instancedMesh ref={ringRef} name="mar-anillo-mecanismo" args={[G.tor, M.ring, mechs.length]} />
    {kinds.remolino.length > 0 && <instancedMesh ref={headRefs.remolino} name="mar-pulpo-mecanismo" args={[G.octo, M.clay, kinds.remolino.length]} />}
    {kinds.geiser.length > 0 && <instancedMesh ref={headRefs.geiser} name="mar-ballena-mecanismo" args={[G.fluke, M.clay, kinds.geiser.length]} />}
    {kinds.cinta.length > 0 && <instancedMesh ref={headRefs.cinta} name="mar-corriente-mecanismo" args={[G.arrow, M.link, kinds.cinta.length]} />}
  </group>
}

// ═══════════════════════════ EVENTOS POR RUTA (teaser → clímax → salida) ═══════════════════════════
// Rápida: remolino de cardumen con aros de corriente. Media: faro con haz y cofre del naufragio. Lenta: ballena cantora.
function CurrentEvent({ seg, stage, G, M, pal }) {
  const N = 28
  const fishRef = useRef(); const gateRef = useRef(); const burstRef = useRef()
  useWayBounds(fishRef, seg.way); useWayBounds(gateRef, seg.way); useWayBounds(burstRef, seg.way)
  const fishCols = useMemo(() => Array.from({ length: N }, (_, i) => pal.fish[i % pal.fish.length]), [pal])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const I = stage.intensity; const R = seg.radius
    const f = fishRef.current
    if (f) {
      const sp = 0.04 + I * 0.4
      for (let i = 0; i < N; i++) {
        const u = 0.08 + 0.84 * (((i / N) + t * sp * (1 + (i % 3) * 0.15)) % 1)
        placeAlongInto(seg, u, R * (0.32 + 0.22 * Math.sin(i * 1.7)), i * 2.399 + t * (0.6 + I * 1.6), _pl)
        _s.setScalar(0.17 * (0.3 + 0.9 * Math.min(1, I)))
        _m.compose(_pl.pos, _pl.quat, _s)
        f.setMatrixAt(i, _m)
        f.setColorAt(i, _c.set(fishCols[i]))
      }
      f.instanceMatrix.needsUpdate = true
      if (f.instanceColor) f.instanceColor.needsUpdate = true
    }
    const g = gateRef.current
    if (g) {
      for (let i = 0; i < 3; i++) {
        placeAlongInto(seg, 0.2 + i * 0.3, R, 0, _pl)
        _q.copy(_pl.quat).multiply(_q2.setFromAxisAngle(Z, t * (0.9 + I) * (i % 2 ? -1 : 1)))
        _s.setScalar(R * (0.78 + 0.08 * Math.sin(t * 3 + i) + I * 0.12))
        _m.compose(_pl.pos, _q, _s)
        g.setMatrixAt(i, _m)
        g.setColorAt(i, _c.set(pal.accent).multiplyScalar(0.25 + I * 0.75))
      }
      g.instanceMatrix.needsUpdate = true
      if (g.instanceColor) g.instanceColor.needsUpdate = true
    }
    const b = burstRef.current
    if (b) {
      const k = stage.phase === 'salida' ? 2.4 * stage.intensity : 0
      for (let i = 0; i < 16; i++) {
        placeAlongInto(seg, 0.88 + (i % 4) * 0.025, ((t * 0.8 + i / 16) % 1) * R * 0.85 + 0.05, i * 2.1, _pl)
        _s.setScalar(0.07 * k)
        _m.compose(_pl.pos, IDENT_Q, _s)
        b.setMatrixAt(i, _m)
      }
      b.instanceMatrix.needsUpdate = true
    }
  })
  return <group>
    <instancedMesh ref={fishRef} name="mar-evento-cardumen" args={[G.fish, M.clay, N]} />
    <instancedMesh ref={gateRef} name="mar-evento-aros" args={[G.gate, M.ring, 3]} />
    <instancedMesh ref={burstRef} name="mar-evento-burbujas" args={[G.orb, M.bubble, 16]} />
  </group>
}

function WreckEvent({ seg, stage, G, M }) {
  const lampRef = useRef(); const lidRef = useRef(); const coinRef = useRef()
  const lh = useMemo(() => placeAlong(seg, 0.3, 0.03, 1.2), [seg])
  const wk = useMemo(() => placeAlong(seg, 0.68, 0.03, -1.15), [seg])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const I = stage.intensity
    if (lampRef.current) lampRef.current.rotation.y = t * (0.9 + I * 4.5)
    const open = stage.phase === 'climax' ? smooth(0.1, 0.5, stage.k) : stage.phase === 'salida' ? stage.intensity : 0
    if (lidRef.current) lidRef.current.rotation.x = -1.15 * open
    const c = coinRef.current
    if (c) {
      for (let i = 0; i < 10; i++) {
        const k = (t * 0.8 + i / 10) % 1
        _v.set(Math.sin(i * 2.4) * 0.22 * k, 0.28 + k * 0.7 * open, Math.cos(i * 2.4) * 0.12 * k)
        _s.setScalar(0.05 * open * (1 - k * 0.5))
        _m.compose(_v, IDENT_Q, _s)
        c.setMatrixAt(i, _m)
      }
      c.instanceMatrix.needsUpdate = true
    }
  })
  return <group>
    <group position={lh.pos} quaternion={lh.quat} scale={0.7}>
      <mesh geometry={G.lighthouse} material={M.clay} />
      <group ref={lampRef} position={[0, 1.22, 0]}>
        <mesh geometry={G.cone} material={M.beam} position={[0, 0, -1.5]} rotation={[Math.PI / 2, 0, 0]} scale={[0.7, 3, 0.7]} />
      </group>
    </group>
    <group position={wk.pos} quaternion={wk.quat} scale={0.8}>
      <mesh geometry={G.wreck} material={M.clay} />
      <group position={[0.1, 0, 0.5]}>
        <mesh geometry={G.chestBase} material={M.clay} scale={0.8} />
        <group ref={lidRef} position={[0, 0.24 * 0.8, -0.1]} scale={0.8}>
          <mesh geometry={G.chestLid} material={M.clay} />
        </group>
        <instancedMesh ref={coinRef} name="mar-evento-monedas" args={[G.orb, M.gold, 10]} frustumCulled={false} />
      </group>
    </group>
  </group>
}

function WhaleSongEvent({ seg, stage, G, M, pal }) {
  const whaleRef = useRef(); const ringsRef = useRef(); const dropsRef = useRef(); const spoutRef = useRef()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime; const I = stage.intensity; const R = seg.radius
    const w = whaleRef.current
    if (!w) return
    const ph = t * 0.12
    placeAlongInto(seg, 0.5 + 0.34 * Math.sin(ph), R * 0.55 + Math.sin(t * 0.6) * 0.1, Math.PI * 0.82 + Math.sin(t * 0.4) * 0.15, _pl)
    w.position.copy(_pl.pos)
    w.quaternion.copy(_pl.quat)
    if (Math.cos(ph) < 0) w.quaternion.multiply(FLIP_Y)
    w.scale.setScalar(0.5)
    const r = ringsRef.current
    if (r) {
      for (let i = 0; i < 4; i++) {
        const k = (t * (0.35 + I * 0.4) + i / 4) % 1
        _v.set(0, 0.5, 0.9)
        _s.setScalar((0.3 + k * R * 1.7 * (0.5 + I * 0.5)) / 0.5)
        _m.compose(_v, IDENT_Q, _s)
        r.setMatrixAt(i, _m)
        r.setColorAt(i, _c.set(pal.accent).multiplyScalar((1 - k) * (0.3 + I * 0.7)))
      }
      r.instanceMatrix.needsUpdate = true
      if (r.instanceColor) r.instanceColor.needsUpdate = true
    }
    const blow = stage.phase === 'climax' ? smooth(0.15, 0.55, stage.k) * (0.6 + 0.4 * Math.sin(t * 5) ** 2) : stage.phase === 'salida' ? I * 0.5 : 0
    if (spoutRef.current) { spoutRef.current.scale.set(0.11 * blow, 1.6 * blow, 0.11 * blow); spoutRef.current.position.set(0, 1.1 + 0.8 * blow, 0.55) }
    const d = dropsRef.current
    if (d) {
      for (let i = 0; i < 14; i++) {
        const k = (t * 1.1 + i / 14) % 1
        _v.set(Math.sin(i * 2.4) * k * 0.9, 1.1 + blow * 2.2 * (4 * k * (1 - k)) + 0.1, 0.55 + Math.cos(i * 2.4) * k * 0.5)
        _s.setScalar(0.07 * blow)
        _m.compose(_v, IDENT_Q, _s)
        d.setMatrixAt(i, _m)
      }
      d.instanceMatrix.needsUpdate = true
    }
  })
  return <group ref={whaleRef}>
    <mesh geometry={G.whale} material={M.clay} />
    <mesh ref={spoutRef} geometry={G.cyl} material={M.spout} />
    <instancedMesh ref={ringsRef} name="mar-evento-canto" args={[G.gate, M.ring, 4]} frustumCulled={false} />
    <instancedMesh ref={dropsRef} name="mar-evento-gotas" args={[G.orb, M.foam, 14]} frustumCulled={false} />
  </group>
}

function EventSet({ seg, kind, pal, G, M }) {
  const label = useMemo(() => {
    const p = placeAlong(seg, 0.08, 0.75, 0.95)
    return { pos: p.pos, quat: p.quat.clone().multiply(FLIP_Y) }
  }, [seg])
  const render = useMemo(() => (stage) => kind === 0 ? <CurrentEvent seg={seg} stage={stage} G={G} M={M} pal={pal} />
    : kind === 1 ? <WreckEvent seg={seg} stage={stage} G={G} M={M} /> : <WhaleSongEvent seg={seg} stage={stage} G={G} M={M} pal={pal} />, [seg, kind, pal, G, M])
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
      terr.push(buildTerrainGeo(seg, { arc: ARC, maxH: Math.min(maxHeight(seg) * 0.42, seg.radius * 0.22), radial: 22, along: Math.min(90, Math.ceil(seg.length * 1.25)), colors: P.terr, height: (u, a) => dunes(seg, u, a) }))
      sky.push(buildSkyGeo(seg, { radial: 14, along: Math.min(30, Math.ceil(seg.length * 0.5)), colors: P.sky }))
    }
    const merge = (l) => { if (!l.length) return null; const g = mergeGeometries(l, false); l.forEach((x) => x.dispose()); return g }
    return { terrain: merge(terr), sky: merge(sky) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info])
  useAutoDispose(parts)
  useFrame(() => { M.sky.opacity = THREE.MathUtils.lerp(0.25, 0.62, detail?.value ?? 1) })

  const props = useMemo(() => {
    const rng = mulberry32(way.idx * 2203 + 91)
    const pals = ['#ff7a8a', '#ffb36b', '#57f2ec', '#c98aff', '#ff9ac8', '#ffd86b']
    const sc = (n, o) => seat(scatter(way, n, rng, { angle: [-1.3, 1.3], clear: BALL_R * 0.75, offset: [0.02, 0.05], ...o }))
    const corals = tint(sc(46, { scale: [0.4, 0.8] }), rng, pals)
    const brains = tint(sc(26, { scale: [0.4, 0.75] }), rng, pals)
    const fans = tint(sc(24, { scale: [0.45, 0.85] }), rng, pals)
    const kelp = sc(36, { scale: [0.5, 0.9] })
    const anems = tint(sc(22, { scale: [0.4, 0.7] }), rng, pals)
    const rocks = sc(28, { scale: [0.4, 0.8] })
    const stars = tint(sc(18, { scale: [0.5, 0.8] }), rng, ['#ff9a4a', '#ffd86b', '#ff7a8a'])
    const clams = sc(10, { scale: [0.6, 0.9] })
    const fringe = tint(scatter(way, 36, rng, { angle: [1.38, 1.7], clear: 0, offset: [0.02, 0.05], scale: [0.3, 0.55] }).concat(scatter(way, 36, rng, { angle: [-1.7, -1.38], clear: 0, offset: [0.02, 0.05], scale: [0.3, 0.55] })), rng, pals)
    // hitos reconocibles por tramo: faro, naufragio y torre de coral (en tramos sin evento)
    const lighthouses = []; const wrecks = []; const towers = []; const octos = []; const screens = []
    for (const si of info.segments) {
      if (si.air || si.event) continue
      const seg = si.seg; const kind = (si.i + (si.route < 0 ? 0 : si.route)) % 4
      const side = si.i % 2 ? 1 : -1; const a = side * 1.12
      if (laneGap(seg, a) < BALL_R * 0.5 / seg.radius) continue
      const u = 0.45 + 0.1 * Math.sin(si.i)
      const p = placeAlong(seg, u, surfOff(seg, u, a), a)
      const it = { pos: p.pos, quat: p.quat, scale: 0.55 }
      if (kind === 0) lighthouses.push(it)
      else if (kind === 1) wrecks.push({ ...it, scale: 0.6 })
      else if (kind === 2) towers.push({ ...it, scale: 1.1, color: pals[si.i % pals.length] })
      else octos.push({ ...it, scale: 0.5, color: ['#e0587f', '#ffae5e', '#9a7cff'][si.i % 3] })
      if (seg.length > 16) {
        const sp = placeAlong(seg, 0.5, 0.55, -side * 0.9)
        screens.push({ key: seg.i, pos: sp.pos, quat: sp.quat.clone().multiply(FLIP_Y), text: PAL[keyOf(si)].label, sub: seg.name })
      }
    }
    return { corals, brains, fans, kelp, anems, rocks, stars, clams, fringe, lighthouses, wrecks, towers, octos, screens }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [way, info])

  // Estaciones de salida (arco de bienvenida) y llegada (boyas y meta)
  const gates = useMemo(() => {
    const out = []
    for (const kind of ['salida', 'llegada']) {
      const si = info.shared.find((s) => s.kind === kind)
      if (!si) continue
      const u = kind === 'salida' ? 0.5 : 0.82
      const p = placeAlong(si.seg, u, si.seg.radius, 0)
      const b = placeAlong(si.seg, u, si.seg.radius * 0.5, 0)
      out.push({ kind, seg: si.seg, pos: p.pos, quat: p.quat, scale: si.seg.radius * 0.94, bpos: b.pos, bquat: b.quat.clone().multiply(FLIP_Y) })
    }
    return out
  }, [info])

  const routeFauna = info.routes.map((rt, i) => {
    const P = PAL[profKey(rt.route, i)]; const segs = rt.segments.filter((s) => !s.air).map((s) => s.seg)
    if (!segs.length) return null
    const k = PERFILES.indexOf(profKey(rt.route, i))
    return <group key={rt.r} name={`mar-fauna-${rt.r}`}>
      <Swimmers way={way} segs={segs} geo={G.fish} mat={M.clay} groups={k === 0 ? 4 : 3} per={k === 0 ? 9 : 7} speed={k === 0 ? 3.4 : k === 1 ? 2 : 1.2} scale={0.17} off={[0.35, 1.1]} colors={P.fish} seed={10 + i} detail={detail} />
      {k !== 0 && <Swimmers way={way} segs={segs} geo={G.jelly} mat={M.clay} groups={3} per={3} speed={0.35} scale={0.3} off={[0.5, 1.5]} angle={[-1.6, 1.6]} colors={['#ffb8f0', '#b8f0ff', '#d8c0ff']} seed={20 + i} bob={0.25} wag={0} pulse={0.18} spread={0.9} detail={detail} />}
      {k === 2 && <Swimmers way={way} segs={segs} geo={G.turtle} mat={M.clay} groups={2} per={2} speed={0.45} scale={0.34} off={[0.5, 1.2]} angle={[-1.4, 1.4]} seed={30 + i} bob={0.1} wag={0.08} spread={0.8} detail={detail} />}
      {k === 2 && <Swimmers way={way} segs={segs} geo={G.whale} mat={M.clay} groups={1} per={1} speed={0.5} scale={0.26} off={[0.5, 0.8]} angle={[2.7, 3.6]} seed={40 + i} bob={0.15} wag={0.04} detail={detail} />}
      {k === 1 && <Swimmers way={way} segs={segs} geo={G.crab} mat={M.clay} groups={2} per={3} speed={0.5} scale={0.34} off={[0.02, 0.06]} angle={[0.7, 1.2]} seed={50 + i} bob={0.02} wag={0.3} spread={0.6} detail={detail} />}
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

  return <group name="vida-mar">
    {parts.terrain && <mesh name="mar-terreno" geometry={parts.terrain} material={M.terrain} />}
    {parts.sky && <mesh name="mar-cielo" geometry={parts.sky} material={M.sky} />}
    <CartelesDeRuta way={way} style={ESTILO} poleColor="#236477" />
    <Instanced geo={G.coral} mat={M.clay} items={props.corals} />
    <Instanced geo={G.brain} mat={M.clay} items={props.brains} />
    <Instanced geo={G.fan} mat={M.clay} items={props.fans} />
    <Instanced geo={G.rock} mat={M.clay} items={props.rocks} />
    <Instanced geo={G.lighthouse} mat={M.clay} items={props.lighthouses} />
    <Instanced geo={G.wreck} mat={M.clay} items={props.wrecks} />
    <Instanced geo={G.coral} mat={M.clay} items={props.towers} />
    <Instanced geo={G.octo} mat={M.clay} items={props.octos} />
    <DetailGroup detail={detail} min={0.45}>
      <Instanced geo={G.kelp} mat={M.clay} items={props.kelp} />
      <Instanced geo={G.anemone} mat={M.clay} items={props.anems} />
      <Instanced geo={G.star} mat={M.clay} items={props.stars} />
      <Instanced geo={G.clam} mat={M.clay} items={props.clams} />
      <Instanced geo={G.coral} mat={M.clay} items={props.fringe} />
    </DetailGroup>
    {props.screens.map((sc) => <Billboard key={sc.key} text={sc.text} style={{ ...ESTILO_PANTALLA, sub: sc.sub }} height={0.26} position={sc.pos} quat={sc.quat} glow={1.2} />)}
    {gates.map((g) => <group key={g.kind}>
      <mesh geometry={G.arch} material={M.clay} position={g.pos} quaternion={g.quat} scale={g.scale} />
      <Billboard text={g.kind === 'salida' ? '🌊 BIENVENIDO AL ARRECIFE' : '🏁 META MARINA'} style={ESTILO_PANTALLA} height={0.28} position={g.bpos} quat={g.bquat} glow={1.2} />
    </group>)}
    {routeFauna}
    <Bubbles way={way} segs={solid} G={G} M={M} detail={detail} />
    <Waves way={way} segs={solid} G={G} M={M} detail={detail} />
    <LaneMechanisms way={way} G={G} M={M} detail={detail} />
    {eventEls}
  </group>
}
