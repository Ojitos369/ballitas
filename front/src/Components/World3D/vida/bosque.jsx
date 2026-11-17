// Vida del Camino del Bosque: diorama/terrario dentro del tubo de cristal (contrato en README.md).
// Todo vive en el interior del tubo (<= R * FILL), respetando los carriles y sus mecanismos de cambio.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALL_R, Billboard, CartelesDeRuta, EventStage,
  Instanced, Soundless, TAU, buildSkyGeo, buildTerrainGeo, getBallitas,
  laneFrame, laneGap, lanesOf, makePlacement, markShared, mulberry32, placeAlong,
  placeAlongInto, routeInfo, scatter, segPath, switchesOf,
} from './base.jsx'

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT_Q = new THREE.Quaternion()
const TERRAIN_ARC = Math.PI * 0.46
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}
const terrainHeightFn = (seg, u, a) => {
  const wave = 0.5 + 0.5 * Math.sin(u * seg.length * 0.75 + a * 3.4) * Math.cos(u * seg.length * 0.31 - a * 2.1)
  const bank = Math.abs(a) > 0.35 ? 0.3 : 0.04
  return THREE.MathUtils.clamp(wave * 0.7 + bank, 0, 1)
}
const terrainMaxH = (seg) => seg.radius * (seg.kind === 'pantano' ? 0.2 : 0.28)
function terrainOffset(seg, u, a) {
  if (!seg || seg.air) return 0
  const edge = 1 - smooth(TERRAIN_ARC * 0.7, TERRAIN_ARC, Math.abs(a))
  const chan = smooth(0.02, 0.32, laneGap(seg, a))
  const hk = terrainHeightFn(seg, u, a) * edge * chan
  return seg.radius * 0.015 + hk * terrainMaxH(seg)
}
function scatterOnTerrain(way, n, rng, opts) {
  const items = scatter(way, n, rng, opts)
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const off = terrainOffset(it.seg, it.u, it.angle)
    const p = placeAlong(it.seg, it.u, off, it.angle)
    it.offset = off
    it.pos = p.pos
    it.quat = p.quat
    it.up = p.up
    it.tangent = p.tangent
    it.side = p.side
  }
  return items
}

// ═══════════════════════════ HELPERS DE GEOMETRÍA SUAVE MULTICOLOR ═══════════════════════════
function paintPart(rawGeo, hex, { t = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], shade = 0 } = {}) {
  if (!rawGeo.attributes.normal) rawGeo.computeVertexNormals()
  const g = rawGeo.index ? rawGeo.toNonIndexed() : rawGeo.clone()
  if (g.attributes.uv) g.deleteAttribute('uv')
  g.scale(s[0], s[1], s[2])
  if (r[0]) g.rotateX(r[0])
  if (r[1]) g.rotateY(r[1])
  if (r[2]) g.rotateZ(r[2])
  g.translate(t[0], t[1], t[2])
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const base = new THREE.Color(hex)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    if (shade) {
      const k = THREE.MathUtils.clamp(0.85 + pos.getY(i) * shade, 0.72, 1.18)
      tmp.copy(base).multiplyScalar(k)
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b
    } else {
      col[i * 3] = base.r; col[i * 3 + 1] = base.g; col[i * 3 + 2] = base.b
    }
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

function makeMushroomCapGeo() {
  const pts = []
  for (let i = 0; i <= 14; i++) {
    const t = i / 14
    const ang = t * Math.PI * 0.55
    pts.push(new THREE.Vector2(Math.sin(ang) * 0.52, Math.cos(ang) * 0.34 + 0.04))
  }
  pts.push(new THREE.Vector2(0.32, 0.02))
  pts.push(new THREE.Vector2(0.14, 0.0))
  return new THREE.LatheGeometry(pts, 12)
}

function makePineGeo() {
  const trunk = paintPart(new THREE.CylinderGeometry(0.08, 0.13, 0.36, 8), '#5c3a21', { t: [0, 0.18, 0] })
  const c1 = paintPart(new THREE.SphereGeometry(0.42, 10, 8), '#2e7d32', { t: [0, 0.46, 0], s: [1, 0.85, 1], shade: 0.25 })
  const c2 = paintPart(new THREE.SphereGeometry(0.33, 10, 8), '#3fa34d', { t: [0, 0.74, 0], s: [1, 0.9, 1], shade: 0.25 })
  const c3 = paintPart(new THREE.SphereGeometry(0.22, 8, 6), '#62c45e', { t: [0, 0.98, 0], s: [1, 1.05, 1], shade: 0.25 })
  return mergePainted([trunk, c1, c2, c3])
}

function makeOakGeo() {
  const trunk = paintPart(new THREE.CapsuleGeometry(0.09, 0.42, 4, 8), '#6b442a', { t: [0, 0.26, 0] })
  const b1 = paintPart(new THREE.CapsuleGeometry(0.05, 0.22, 4, 6), '#6b442a', { t: [0.12, 0.48, 0], r: [0, 0, -0.55] })
  const b2 = paintPart(new THREE.CapsuleGeometry(0.05, 0.22, 4, 6), '#6b442a', { t: [-0.12, 0.48, 0.06], r: [0.25, 0, 0.5] })
  const k1 = paintPart(new THREE.SphereGeometry(0.34, 10, 8), '#3c9646', { t: [0, 0.72, 0], shade: 0.2 })
  const k2 = paintPart(new THREE.SphereGeometry(0.25, 8, 6), '#58b956', { t: [0.2, 0.62, 0.08], shade: 0.2 })
  const k3 = paintPart(new THREE.SphereGeometry(0.25, 8, 6), '#4aa84d', { t: [-0.2, 0.64, -0.06], shade: 0.2 })
  const k4 = paintPart(new THREE.SphereGeometry(0.22, 8, 6), '#7ad968', { t: [0, 0.92, 0.04], shade: 0.2 })
  return mergePainted([trunk, b1, b2, k1, k2, k3, k4])
}

function makeTreeHouseSolidGeo() {
  const body = paintPart(new THREE.CylinderGeometry(0.34, 0.4, 0.44, 10), '#7a4d2c', { t: [0, 0.22, 0], shade: 0.2 })
  const roof = paintPart(new THREE.ConeGeometry(0.48, 0.36, 10), '#2f8239', { t: [0, 0.6, 0], shade: 0.25 })
  const rim = paintPart(new THREE.TorusGeometry(0.42, 0.05, 6, 14), '#4caf50', { t: [0, 0.44, 0], r: [Math.PI / 2, 0, 0] })
  const door = paintPart(new THREE.CapsuleGeometry(0.09, 0.12, 4, 6), '#4e2f1a', { t: [0, 0.14, 0.34], s: [1, 1, 0.4] })
  const chim = paintPart(new THREE.CylinderGeometry(0.05, 0.06, 0.22, 6), '#5d4037', { t: [0.18, 0.68, -0.1] })
  const porch = paintPart(new THREE.CylinderGeometry(0.46, 0.46, 0.04, 10), '#9b6b43', { t: [0, 0.02, 0] })
  return mergePainted([porch, body, roof, rim, door, chim])
}

function makeTreeHouseWinGeo() {
  const w1 = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#ffe27a', { t: [0.23, 0.25, 0.24], s: [0.8, 1, 0.4] })
  const w2 = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#ffe27a', { t: [-0.23, 0.25, 0.24], s: [0.8, 1, 0.4] })
  const w3 = paintPart(new THREE.SphereGeometry(0.055, 10, 8), '#ffe27a', { t: [0, 0.56, 0.26], s: [0.9, 0.9, 0.4] })
  const smoke = paintPart(new THREE.SphereGeometry(0.055, 10, 8), '#e0f8d8', { t: [0.18, 0.88, -0.1] })
  return mergePainted([w1, w2, w3, smoke])
}

function makeFoxGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.32, 18, 14), '#ff7b3b', { t: [0, 0.29, 0], s: [1.02, 0.94, 1.08] })
  const belly = paintPart(new THREE.SphereGeometry(0.24, 14, 12), '#fff1dc', { t: [0, 0.22, 0.13], s: [0.9, 0.85, 0.8] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#ff94ad', { t: [-0.18, 0.27, 0.27], s: [1, 0.7, 0.5] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#ff94ad', { t: [0.18, 0.27, 0.27], s: [1, 0.7, 0.5] })
  const earL = paintPart(new THREE.ConeGeometry(0.11, 0.22, 12), '#ff7b3b', { t: [-0.18, 0.56, 0.04], r: [0.15, 0, 0.28] })
  const earR = paintPart(new THREE.ConeGeometry(0.11, 0.22, 12), '#ff7b3b', { t: [0.18, 0.56, 0.04], r: [0.15, 0, -0.28] })
  const earInL = paintPart(new THREE.ConeGeometry(0.06, 0.14, 10), '#fff1dc', { t: [-0.18, 0.55, 0.07], r: [0.15, 0, 0.28] })
  const earInR = paintPart(new THREE.ConeGeometry(0.06, 0.14, 10), '#fff1dc', { t: [0.18, 0.55, 0.07], r: [0.15, 0, -0.28] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.055, 10, 8), '#261420', { t: [-0.11, 0.34, 0.29] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.055, 10, 8), '#261420', { t: [0.11, 0.34, 0.29] })
  const shineL = paintPart(new THREE.SphereGeometry(0.02, 8, 6), '#ffffff', { t: [-0.09, 0.36, 0.335] })
  const shineR = paintPart(new THREE.SphereGeometry(0.02, 8, 6), '#ffffff', { t: [0.13, 0.36, 0.335] })
  const nose = paintPart(new THREE.SphereGeometry(0.036, 8, 6), '#2a1822', { t: [0, 0.29, 0.35] })
  const tail = paintPart(new THREE.CapsuleGeometry(0.11, 0.22, 8, 12), '#ff7b3b', { t: [0, 0.28, -0.34], r: [0.95, 0, 0] })
  const tailTip = paintPart(new THREE.SphereGeometry(0.11, 12, 10), '#fff8e1', { t: [0, 0.38, -0.45] })
  const footL = paintPart(new THREE.SphereGeometry(0.075, 10, 8), '#5c3322', { t: [-0.13, 0.06, 0.12], s: [1, 0.7, 1.2] })
  const footR = paintPart(new THREE.SphereGeometry(0.075, 10, 8), '#5c3322', { t: [0.13, 0.06, 0.12], s: [1, 0.7, 1.2] })
  return mergePainted([body, belly, cheekL, cheekR, earL, earR, earInL, earInR, eyeL, eyeR, shineL, shineR, nose, tail, tailTip, footL, footR])
}

function makeDeerGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.32, 18, 14), '#c88c55', { t: [0, 0.3, 0], s: [0.96, 0.96, 1.1] })
  const belly = paintPart(new THREE.SphereGeometry(0.22, 14, 10), '#faebd7', { t: [0, 0.22, 0.12] })
  const spot1 = paintPart(new THREE.SphereGeometry(0.05, 8, 6), '#fff9eb', { t: [0.22, 0.36, -0.06] })
  const spot2 = paintPart(new THREE.SphereGeometry(0.05, 8, 6), '#fff9eb', { t: [-0.22, 0.36, -0.06] })
  const earL = paintPart(new THREE.CapsuleGeometry(0.045, 0.11, 6, 8), '#c88c55', { t: [-0.24, 0.48, 0], r: [0, 0, 0.9] })
  const earR = paintPart(new THREE.CapsuleGeometry(0.045, 0.11, 6, 8), '#c88c55', { t: [0.24, 0.48, 0], r: [0, 0, -0.9] })
  const antL = paintPart(new THREE.CapsuleGeometry(0.025, 0.2, 6, 8), '#ffe9a8', { t: [-0.12, 0.66, 0.02], r: [0, 0, 0.35] })
  const antR = paintPart(new THREE.CapsuleGeometry(0.025, 0.2, 6, 8), '#ffe9a8', { t: [0.12, 0.66, 0.02], r: [0, 0, -0.35] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.055, 10, 8), '#23171e', { t: [-0.11, 0.35, 0.29] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.055, 10, 8), '#23171e', { t: [0.11, 0.35, 0.29] })
  const shineL = paintPart(new THREE.SphereGeometry(0.02, 8, 6), '#ffffff', { t: [-0.09, 0.37, 0.335] })
  const shineR = paintPart(new THREE.SphereGeometry(0.02, 8, 6), '#ffffff', { t: [0.13, 0.37, 0.335] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.06, 8, 6), '#ff9ab0', { t: [-0.18, 0.28, 0.27], s: [1, 0.7, 0.5] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.06, 8, 6), '#ff9ab0', { t: [0.18, 0.28, 0.27], s: [1, 0.7, 0.5] })
  const tail = paintPart(new THREE.SphereGeometry(0.09, 10, 8), '#fff7cf', { t: [0, 0.32, -0.34] })
  return mergePainted([body, belly, spot1, spot2, earL, earR, antL, antR, eyeL, eyeR, shineL, shineR, cheekL, cheekR, tail])
}

function makeSquirrelGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.28, 16, 12), '#b85c38', { t: [0, 0.26, 0], s: [0.95, 1.0, 1.02] })
  const belly = paintPart(new THREE.SphereGeometry(0.2, 12, 10), '#fce9d4', { t: [0, 0.22, 0.12] })
  const tail1 = paintPart(new THREE.SphereGeometry(0.2, 14, 10), '#c86a42', { t: [0, 0.38, -0.28], s: [0.85, 1.25, 0.9] })
  const tail2 = paintPart(new THREE.SphereGeometry(0.16, 12, 10), '#d98055', { t: [0, 0.58, -0.22] })
  const earL = paintPart(new THREE.ConeGeometry(0.07, 0.15, 10), '#b85c38', { t: [-0.13, 0.53, 0.04], r: [0, 0, 0.2] })
  const earR = paintPart(new THREE.ConeGeometry(0.07, 0.15, 10), '#b85c38', { t: [0.13, 0.53, 0.04], r: [0, 0, -0.2] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.05, 8, 6), '#20131a', { t: [-0.1, 0.32, 0.24] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.05, 8, 6), '#20131a', { t: [0.1, 0.32, 0.24] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff91a8', { t: [-0.16, 0.26, 0.22], s: [1, 0.7, 0.5] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff91a8', { t: [0.16, 0.26, 0.22], s: [1, 0.7, 0.5] })
  return mergePainted([body, belly, tail1, tail2, earL, earR, eyeL, eyeR, cheekL, cheekR])
}

function makeOwlBodyGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.3, 18, 14), '#7b685e', { t: [0, 0.3, 0], s: [1.0, 1.08, 0.95] })
  const belly = paintPart(new THREE.SphereGeometry(0.22, 14, 10), '#f5e6d3', { t: [0, 0.24, 0.12] })
  const discL = paintPart(new THREE.SphereGeometry(0.11, 12, 10), '#faeedb', { t: [-0.1, 0.39, 0.22], s: [1, 1, 0.45] })
  const discR = paintPart(new THREE.SphereGeometry(0.11, 12, 10), '#faeedb', { t: [0.1, 0.39, 0.22], s: [1, 1, 0.45] })
  const beak = paintPart(new THREE.ConeGeometry(0.045, 0.09, 10), '#ffb74d', { t: [0, 0.34, 0.3], r: [Math.PI / 2, 0, 0] })
  const tuftL = paintPart(new THREE.ConeGeometry(0.06, 0.14, 8), '#5d4c43', { t: [-0.17, 0.57, 0.04], r: [0, 0, 0.45] })
  const tuftR = paintPart(new THREE.ConeGeometry(0.06, 0.14, 8), '#5d4c43', { t: [0.17, 0.57, 0.04], r: [0, 0, -0.45] })
  const wingL = paintPart(new THREE.SphereGeometry(0.14, 12, 10), '#635249', { t: [-0.27, 0.28, 0], s: [0.45, 1.15, 0.85] })
  const wingR = paintPart(new THREE.SphereGeometry(0.14, 12, 10), '#635249', { t: [0.27, 0.28, 0], s: [0.45, 1.15, 0.85] })
  return mergePainted([body, belly, discL, discR, beak, tuftL, tuftR, wingL, wingR])
}

function makeOwlEyesGeo() {
  const eL = paintPart(new THREE.SphereGeometry(0.058, 10, 8), '#ffd54a', { t: [-0.1, 0.39, 0.265], s: [1, 1, 0.5] })
  const eR = paintPart(new THREE.SphereGeometry(0.058, 10, 8), '#ffd54a', { t: [0.1, 0.39, 0.265], s: [1, 1, 0.5] })
  const pL = paintPart(new THREE.SphereGeometry(0.032, 8, 6), '#1f151b', { t: [-0.1, 0.39, 0.29], s: [1, 1, 0.4] })
  const pR = paintPart(new THREE.SphereGeometry(0.032, 8, 6), '#1f151b', { t: [0.1, 0.39, 0.29], s: [1, 1, 0.4] })
  return mergePainted([eL, eR, pL, pR])
}

function makeSpectatorGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.18, 14, 10), '#fce0c8', { t: [0, 0.18, 0] })
  const tunic = paintPart(new THREE.CylinderGeometry(0.16, 0.19, 0.14, 12), '#3fa34d', { t: [0, 0.08, 0] })
  const hat = paintPart(new THREE.ConeGeometry(0.18, 0.26, 14), '#4caf50', { t: [0, 0.38, 0], r: [0, 0, -0.1] })
  const pom = paintPart(new THREE.SphereGeometry(0.05, 8, 6), '#fff3d6', { t: [0.03, 0.51, 0] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.032, 8, 6), '#24141d', { t: [-0.06, 0.21, 0.165] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.032, 8, 6), '#24141d', { t: [0.06, 0.21, 0.165] })
  const blushL = paintPart(new THREE.SphereGeometry(0.035, 8, 6), '#ff8fa8', { t: [-0.1, 0.17, 0.155], s: [1, 0.6, 0.4] })
  const blushR = paintPart(new THREE.SphereGeometry(0.035, 8, 6), '#ff8fa8', { t: [0.1, 0.17, 0.155], s: [1, 0.6, 0.4] })
  return mergePainted([body, tunic, hat, pom, eyeL, eyeR, blushL, blushR])
}

function makeStandGeo() {
  const s1 = paintPart(new THREE.BoxGeometry(2.2, 0.16, 0.32), '#6b462b', { t: [0, 0.08, 0.24] })
  const s2 = paintPart(new THREE.BoxGeometry(2.2, 0.32, 0.32), '#5c3a21', { t: [0, 0.16, 0.0] })
  const s3 = paintPart(new THREE.BoxGeometry(2.2, 0.48, 0.32), '#4e301a', { t: [0, 0.24, -0.24] })
  const rail = paintPart(new THREE.BoxGeometry(2.24, 0.05, 0.06), '#8bc34a', { t: [0, 0.28, 0.4] })
  const postL = paintPart(new THREE.CylinderGeometry(0.03, 0.035, 0.82, 8), '#4a301e', { t: [-0.98, 0.41, -0.34] })
  const postR = paintPart(new THREE.CylinderGeometry(0.03, 0.035, 0.82, 8), '#4a301e', { t: [0.98, 0.41, -0.34] })
  const roof = paintPart(new THREE.BoxGeometry(2.26, 0.06, 0.56), '#2e7d32', { t: [0, 0.82, -0.18], r: [0.18, 0, 0] })
  return mergePainted([s1, s2, s3, rail, postL, postR, roof])
}

function makeGateGeo() {
  const pL = paintPart(new THREE.CylinderGeometry(0.1, 0.14, 1.26, 12), '#5c3a21', { t: [-1.26, 0.63, 0] })
  const pR = paintPart(new THREE.CylinderGeometry(0.1, 0.14, 1.26, 12), '#5c3a21', { t: [1.26, 0.63, 0] })
  const ringL = paintPart(new THREE.TorusGeometry(0.14, 0.035, 8, 16), '#ffd54f', { t: [-1.26, 0.9, 0], r: [Math.PI / 2, 0, 0] })
  const ringR = paintPart(new THREE.TorusGeometry(0.14, 0.035, 8, 16), '#ffd54f', { t: [1.26, 0.9, 0], r: [Math.PI / 2, 0, 0] })
  const beam = paintPart(new THREE.CapsuleGeometry(0.09, 2.52, 8, 14), '#4e342e', { t: [0, 1.25, 0], r: [0, 0, Math.PI / 2] })
  const leafL = paintPart(new THREE.SphereGeometry(0.24, 12, 10), '#4caf50', { t: [-0.95, 1.27, 0], s: [1.3, 0.7, 0.7] })
  const leafR = paintPart(new THREE.SphereGeometry(0.24, 12, 10), '#4caf50', { t: [0.95, 1.27, 0], s: [1.3, 0.7, 0.7] })
  const crest = paintPart(new THREE.SphereGeometry(0.19, 14, 12), '#ffd54f', { t: [0, 1.38, 0.05], s: [1.1, 1.2, 0.7] })
  return mergePainted([pL, pR, ringL, ringR, beam, leafL, leafR, crest])
}

function makeRockMossGeo() {
  const rock = paintPart(new THREE.SphereGeometry(0.38, 10, 8), '#68706e', { t: [0, 0.14, 0], s: [1.2, 0.75, 1.0] })
  const moss = paintPart(new THREE.SphereGeometry(0.32, 8, 6), '#4ca64c', { t: [0.02, 0.25, 0], s: [1.15, 0.5, 0.92] })
  return mergePainted([rock, moss])
}

function makeFenceGeo() {
  const p1 = paintPart(new THREE.CapsuleGeometry(0.035, 0.22, 6, 10), '#6b442a', { t: [0, 0.13, -0.28] })
  const p2 = paintPart(new THREE.CapsuleGeometry(0.035, 0.22, 6, 10), '#6b442a', { t: [0, 0.13, 0.28] })
  const bar = paintPart(new THREE.CapsuleGeometry(0.024, 0.56, 6, 10), '#8bc34a', { t: [0, 0.19, 0], r: [Math.PI / 2, 0, 0] })
  return mergePainted([p1, p2, bar])
}

function makeLanternPostGeo() {
  const pole = paintPart(new THREE.CylinderGeometry(0.028, 0.04, 0.58, 10), '#4e342e', { t: [0, 0.29, 0] })
  const arm = paintPart(new THREE.CapsuleGeometry(0.02, 0.16, 5, 8), '#4e342e', { t: [0.07, 0.56, 0], r: [0, 0, Math.PI / 2] })
  const cap = paintPart(new THREE.ConeGeometry(0.075, 0.07, 12), '#2e7d32', { t: [0.14, 0.51, 0] })
  return mergePainted([pole, arm, cap])
}

function makeVineGeo() {
  const stem = paintPart(new THREE.CapsuleGeometry(0.028, 0.65, 6, 10), '#2e7d32', { t: [0, 0.34, 0] })
  const l1 = paintPart(new THREE.SphereGeometry(0.085, 10, 8), '#58c456', { t: [0.08, 0.24, 0], s: [1.2, 0.6, 0.5] })
  const l2 = paintPart(new THREE.SphereGeometry(0.085, 10, 8), '#78e068', { t: [-0.08, 0.44, 0.02], s: [1.2, 0.6, 0.5] })
  const l3 = paintPart(new THREE.SphereGeometry(0.075, 10, 8), '#4aa84d', { t: [0.06, 0.58, -0.02], s: [1.1, 0.6, 0.5] })
  return mergePainted([stem, l1, l2, l3])
}

function makeFlagGeo() {
  const pole = paintPart(new THREE.CylinderGeometry(0.018, 0.022, 0.48, 8), '#5c3a21', { t: [0, 0.24, 0] })
  const cloth = paintPart(new THREE.ConeGeometry(0.12, 0.26, 4), '#ffffff', { t: [0.13, 0.38, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.22] })
  return mergePainted([pole, cloth])
}

function makeCheckeredTex() {
  if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  const c = document.createElement('canvas')
  c.width = 256; c.height = 64
  const ctx = c.getContext('2d')
  const cols = 16; const rows = 4; const cw = c.width / cols; const ch = c.height / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#f6fff0' : '#1b5e20'
      ctx.fillRect(x * cw, y * ch, cw, ch)
    }
  }
  ctx.fillStyle = '#ffd54f'
  ctx.fillRect(0, 0, c.width, 6)
  ctx.fillRect(0, c.height - 6, c.width, 6)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function makeCurbTex(label) {
  if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  const c = document.createElement('canvas')
  c.width = 512; c.height = 64
  const ctx = c.getContext('2d')
  const stripes = 8; const sw = c.width / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2e7d32' : '#ffd54f'
    ctx.fillRect(i * sw, 0, sw, c.height)
  }
  ctx.fillStyle = 'rgba(20, 38, 18, 0.85)'
  ctx.fillRect(0, 12, c.width, 40)
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillStyle = '#f4ffe0'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, c.width * 0.5, c.height * 0.5)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

let CACHE = null
function getAssets() {
  if (CACHE) return CACHE
  const geo = {
    pine: makePineGeo(),
    oak: makeOakGeo(),
    houseSolid: makeTreeHouseSolidGeo(),
    houseWin: makeTreeHouseWinGeo(),
    rock: makeRockMossGeo(),
    mushCap: makeMushroomCapGeo(),
    mushStem: new THREE.CylinderGeometry(0.11, 0.14, 0.34, 14).translate(0, 0.17, 0),
    lanternPost: makeLanternPostGeo(),
    lanternBulb: new THREE.SphereGeometry(0.085, 12, 10),
    fence: makeFenceGeo(),
    stand: makeStandGeo(),
    screenPanel: new THREE.BoxGeometry(1.6, 0.24, 0.05),
    spectator: makeSpectatorGeo(),
    gate: makeGateGeo(),
    vine: makeVineGeo(),
    flag: makeFlagGeo(),
    fox: makeFoxGeo(),
    deer: makeDeerGeo(),
    squirrel: makeSquirrelGeo(),
    owlBody: makeOwlBodyGeo(),
    owlEyes: makeOwlEyesGeo(),
    firefly: new THREE.SphereGeometry(0.055, 10, 8),
    spark: new THREE.SphereGeometry(0.08, 10, 8),
    ring: new THREE.TorusGeometry(0.45, 0.045, 10, 28),
    orb: new THREE.SphereGeometry(0.24, 16, 12),
    plank: new THREE.BoxGeometry(0.95, 0.06, 0.24),
    paddle: new THREE.BoxGeometry(0.12, 0.9, 0.28),
    curb: new THREE.BoxGeometry(0.16, 0.11, 1.8).translate(0, 0.055, 0),
    metaStrip: new THREE.PlaneGeometry(1.18, 0.36).rotateX(-Math.PI / 2).translate(0, 0.018, 0),
    doorLeaf: new THREE.BoxGeometry(0.54, 0.92, 0.07).translate(0.27, 0.46, 0),
    waterCurtain: new THREE.CylinderGeometry(0.18, 0.26, 1.45, 16, 1, true),
    bridge: new THREE.CylinderGeometry(0.12, 0.14, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5),
  }
  const mat = {
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0.02, side: THREE.BackSide }),
    solid: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.65, metalness: 0.05,
      emissive: new THREE.Color('#274824'), emissiveIntensity: 0.24,
    }),
    critter: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.52, metalness: 0.04,
      emissive: new THREE.Color('#3b2c1a'), emissiveIntensity: 0.22,
    }),
    mushCap: new THREE.MeshStandardMaterial({
      roughness: 0.45, metalness: 0.05,
      emissive: new THREE.Color('#4a2010'), emissiveIntensity: 0.28,
    }),
    mushStem: new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.72 }),
    glowWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color('#d4ff5a').multiplyScalar(1.35), toneMapped: false }),
    winGlow: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color('#ffffff').multiplyScalar(1.32), toneMapped: false }),
    firefly: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.45), toneMapped: false }),
    meta: new THREE.MeshBasicMaterial({ map: makeCheckeredTex(), side: THREE.DoubleSide }),
    curbFast: new THREE.MeshStandardMaterial({ map: makeCurbTex('BOSQUE GP · RUTA VELOZ'), roughness: 0.6 }),
    curbSlow: new THREE.MeshStandardMaterial({ map: makeCurbTex('ALDEA DEL BOSQUE · CALMA'), roughness: 0.6 }),
    curbMain: new THREE.MeshStandardMaterial({ map: makeCurbTex('CAMINO DEL BOSQUE'), roughness: 0.6 }),
    screenLed: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.32), toneMapped: false }),
    runeGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#7aff9b').multiplyScalar(1.45), toneMapped: false }),
    waterFlow: new THREE.MeshBasicMaterial({
      color: new THREE.Color('#6ef2ff').multiplyScalar(1.2), transparent: true, opacity: 0.62,
      side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
    }),
    flag: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }),
    swBridge: new THREE.MeshStandardMaterial({ color: '#7a5230', roughness: 0.7, emissive: '#2b4018', emissiveIntensity: 0.22 }),
    swGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#b6ff5a').multiplyScalar(1.45), toneMapped: false }),
  }
  markShared(Object.values(geo))
  markShared(Object.values(mat))
  CACHE = { geo, mat }
  return CACHE
}

const ESTILO_BOSQUE = { color: '#f4ffe0', bg: 'rgba(28,50,24,0.92)', border: '#9cff6b', subColor: '#ffd54f' }

// ═══════════════════════════ TERRENO Y CIELO INTERIOR ═══════════════════════════
function BosqueTerrainAndSky({ way, detail }) {
  const { mat } = getAssets()
  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.FrontSide, transparent: true, opacity: 0.05, depthWrite: false,
  }), [])
  const meshes = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (seg.air) continue
      const isSwamp = seg.kind === 'pantano'
      const isCasc = seg.kind === 'cascada'
      const isGoal = seg.kind === 'llegada'
      const colors = isSwamp ? ['#21381e', '#65a344']
        : isCasc ? ['#1f4b4f', '#72e3cf']
        : isGoal ? ['#2a5c2d', '#9be362']
        : ['#214b27', '#4ea046']
      const terrain = buildTerrainGeo(seg, {
        arc: TERRAIN_ARC,
        maxH: terrainMaxH(seg),
        colors,
        height: (u, a) => terrainHeightFn(seg, u, a),
      })
      const sky = buildSkyGeo(seg, {
        colors: isSwamp ? ['#15281c', '#29574a'] : ['#122b1e', '#2f6b58'],
      })
      out.push({ key: seg.i, terrain, sky })
    }
    return out
  }, [way])

  useEffect(() => () => {
    skyMat.dispose()
    for (const m of meshes) { m.terrain.dispose(); m.sky.dispose() }
  }, [skyMat, meshes])

  useFrame(() => {
    const det = detail?.value ?? 1
    skyMat.opacity = 0.03 + det * 0.34
  })

  return (
    <group>
      {meshes.map((m) => (
        <group key={m.key}>
          <mesh geometry={m.terrain} material={mat.terrain} receiveShadow />
          <mesh geometry={m.sky} material={skyMat} />
        </group>
      ))}
    </group>
  )
}

// ═══════════════════════════ HONGOS ELÁSTICOS QUE REBOTAN ═══════════════════════════
function BouncyMushrooms({ way, items }) {
  const { geo, mat } = getAssets()
  const capMesh = useMemo(() => new THREE.InstancedMesh(geo.mushCap, mat.mushCap, Math.max(1, items.length)), [geo, mat, items.length])
  const stemMesh = useMemo(() => new THREE.InstancedMesh(geo.mushStem, mat.mushStem, Math.max(1, items.length)), [geo, mat, items.length])
  const state = useMemo(() => items.map((it) => ({ ...it, bounce: 0, col: new THREE.Color(it.color) })), [items])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), p: new THREE.Vector3() }), [])

  useEffect(() => {
    capMesh.count = state.length
    stemMesh.count = state.length
    for (let i = 0; i < state.length; i++) {
      capMesh.setColorAt(i, state[i].col)
      tmp.s.setScalar(state[i].scale)
      tmp.m.compose(state[i].pos, state[i].quat, tmp.s)
      stemMesh.setMatrixAt(i, tmp.m)
    }
    if (capMesh.instanceColor) capMesh.instanceColor.needsUpdate = true
    stemMesh.instanceMatrix.needsUpdate = true
    return () => { capMesh.dispose(); stemMesh.dispose() }
  }, [capMesh, stemMesh, state, tmp])

  useFrame(({ clock }, dt) => {
    if (!state.length || !capMesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < state.length; i++) {
      const m = state[i]
      let near = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || b.seg?.way !== way) continue
        const d2 = m.pos.distanceToSquared(b.pos)
        if (d2 < 9.0) {
          const k01 = 1 - Math.sqrt(d2) / 3.0
          if (k01 > near) near = k01
        }
      }
      m.bounce = THREE.MathUtils.damp(m.bounce, near, near > m.bounce ? 12 : 3.5, h)
      const sq = 1 + m.bounce * 0.36 * Math.sin(t * 14 + m.rnd * 10)
      const capY = (0.28 + m.bounce * 0.14 * Math.abs(Math.sin(t * 7 + m.rnd * 6))) * m.scale
      tmp.p.copy(m.pos).addScaledVector(m.up, capY)
      tmp.s.set(m.scale * (1 + (sq - 1) * 0.6), m.scale / sq, m.scale * (1 + (sq - 1) * 0.6))
      tmp.m.compose(tmp.p, m.quat, tmp.s)
      capMesh.setMatrixAt(i, tmp.m)
    }
    capMesh.instanceMatrix.needsUpdate = true
  })

  if (!items.length) return null
  return (
    <group>
      <primitive object={stemMesh} />
      <primitive object={capMesh} />
    </group>
  )
}

// ═══════════════════════════ BÚHOS DORMILONES QUE DESPIERTAN ═══════════════════════════
function SleepyOwls({ way, items }) {
  const { geo, mat } = getAssets()
  const bodyMesh = useMemo(() => new THREE.InstancedMesh(geo.owlBody, mat.critter, Math.max(1, items.length)), [geo, mat, items.length])
  const eyesMesh = useMemo(() => new THREE.InstancedMesh(geo.owlEyes, mat.winGlow, Math.max(1, items.length)), [geo, mat, items.length])
  const state = useMemo(() => items.map((it) => ({ ...it, awake: 0 })), [items])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler() }), [])

  useEffect(() => {
    bodyMesh.count = state.length; eyesMesh.count = state.length
    return () => { bodyMesh.dispose(); eyesMesh.dispose() }
  }, [bodyMesh, eyesMesh, state.length])

  useFrame(({ clock }, dt) => {
    if (!state.length || !bodyMesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < state.length; i++) {
      const o = state[i]
      let near = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || b.seg?.way !== way) continue
        const d2 = o.pos.distanceToSquared(b.pos)
        if (d2 < 25) near = Math.max(near, 1 - Math.sqrt(d2) / 5)
      }
      o.awake = THREE.MathUtils.damp(o.awake, near, near > o.awake ? 10 : 1.8, h)
      const nod = (1 - o.awake) * Math.sin(t * 1.4 + o.rnd * 8) * 0.18
      const alertTurn = o.awake * Math.sin(t * 8 + o.rnd * 6) * 0.25
      tmp.e.set(nod, alertTurn, 0)
      tmp.q2.setFromEuler(tmp.e)
      tmp.q.copy(o.quat).multiply(tmp.q2)
      tmp.s.setScalar(o.scale * (1 + o.awake * 0.12))
      tmp.m.compose(o.pos, tmp.q, tmp.s)
      bodyMesh.setMatrixAt(i, tmp.m)
      const eyeOpen = 0.25 + o.awake * 1.05
      tmp.s.set(o.scale, o.scale * eyeOpen, o.scale)
      tmp.m.compose(o.pos, tmp.q, tmp.s)
      eyesMesh.setMatrixAt(i, tmp.m)
    }
    bodyMesh.instanceMatrix.needsUpdate = true
    eyesMesh.instanceMatrix.needsUpdate = true
  })

  if (!items.length) return null
  return (
    <group>
      <primitive object={bodyMesh} />
      <primitive object={eyesMesh} />
    </group>
  )
}

// ═══════════════════════════ ENJAMBRE DE LUCIÉRNAGAS REACTIVAS ═══════════════════════════
function FireflySwarm({ way, count = 260 }) {
  const { geo, mat } = getAssets()
  const path = useMemo(() => segPath(way.segments.filter((s) => !s.air)), [way])
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.firefly, mat.firefly, count), [geo, mat, count])
  const state = useMemo(() => {
    const rng = mulberry32(way.idx * 509 + 77)
    const cols = ['#d4ff5a', '#9cff6b', '#ffe86e', '#7dffb2']
    return Array.from({ length: count }, () => ({
      s: rng() * (path.total || 1),
      speed: 0.5 + rng() * 1.5,
      angle: (rng() - 0.5) * Math.PI * 1.65,
      offK: 0.25 + rng() * 0.52,
      ph: rng() * TAU,
      sc: 0.55 + rng() * 0.85,
      baseCol: new THREE.Color(cols[Math.floor(rng() * cols.length)]),
    }))
  }, [way.idx, count, path])
  const tmp = useMemo(() => ({
    loc: {}, pl: makePlacement(), m: new THREE.Matrix4(), s: new THREE.Vector3(),
    c: new THREE.Color(), bCol: new THREE.Color(),
  }), [])

  useEffect(() => () => mesh.dispose(), [mesh])

  useFrame(({ clock }, dt) => {
    if (!path.total) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    let focusBoll = null
    for (let k = 0; k < bolls.length; k++) {
      const b = bolls[k]
      if (b.phase === 'travel' && b.seg?.way === way) { focusBoll = b; break }
    }
    if (focusBoll) tmp.bCol.setHSL(focusBoll.genome.hue, 0.9, 0.68)

    for (let i = 0; i < count; i++) {
      const f = state[i]
      path.locate(f.s, tmp.loc)
      const seg = tmp.loc.seg
      const sk = seg ? (seg.speedK ?? 1) : 1
      f.s = (f.s + f.speed * sk * h) % path.total
      const ang = f.angle + Math.sin(t * 1.3 + f.ph) * 0.45
      const off = (seg ? seg.radius : 2.6) * f.offK + Math.sin(t * 2.1 + f.ph) * 0.16
      placeAlongInto(seg, tmp.loc.u, off, ang, tmp.pl)
      const pulse = 0.65 + 0.55 * Math.sin(t * 4.5 + f.ph)
      tmp.s.setScalar(f.sc * pulse)
      tmp.m.compose(tmp.pl.pos, IDENT_Q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
      tmp.c.copy(f.baseCol)
      if (focusBoll && tmp.pl.pos.distanceToSquared(focusBoll.pos) < 36) {
        tmp.c.lerp(tmp.bCol, 0.72)
      }
      mesh.setColorAt(i, tmp.c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <primitive object={mesh} />
}

// ═══════════════════════════ ESPECTADORES Y PANTALLAS DE TRIBUNA ═══════════════════════════
function ForestSpectators({ way, items, screens }) {
  const { geo, mat } = getAssets()
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.spectator, mat.critter, Math.max(1, items.length)), [geo, mat, items.length])
  const screenMesh = useMemo(() => new THREE.InstancedMesh(geo.screenPanel, mat.screenLed, Math.max(1, screens.length)), [geo, mat, screens.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), bCol: new THREE.Color('#9cff6b') }), [])

  useEffect(() => {
    mesh.count = items.length
    screenMesh.count = screens.length
    for (let i = 0; i < screens.length; i++) {
      tmp.s.setScalar(screens[i].scale)
      tmp.m.compose(screens[i].pos, screens[i].quat, tmp.s)
      screenMesh.setMatrixAt(i, tmp.m)
    }
    screenMesh.instanceMatrix.needsUpdate = true
    return () => { mesh.dispose(); screenMesh.dispose() }
  }, [mesh, screenMesh, items.length, screens, tmp])

  useFrame(({ clock }) => {
    if (!mesh.visible) return
    const t = clock.elapsedTime
    const bolls = getBallitas()
    let activeBoll = null
    for (let k = 0; k < bolls.length; k++) {
      const b = bolls[k]
      if (b.phase === 'travel' && b.seg?.way === way) { activeBoll = b; break }
    }
    if (activeBoll) tmp.bCol.setHSL(activeBoll.genome.hue, 0.88, 0.6)

    for (let i = 0; i < items.length; i++) {
      const sp = items[i]
      let cheer = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || b.seg?.way !== way) continue
        if (sp.pos.distanceToSquared(b.pos) < 42) { cheer = 1; break }
      }
      const hop = (0.02 + cheer * 0.1) * Math.abs(Math.sin(t * (3.5 + cheer * 7) + sp.rnd * 9))
      tmp.p.copy(sp.pos).addScaledVector(sp.up, hop)
      tmp.s.setScalar(sp.scale)
      tmp.m.compose(tmp.p, sp.quat, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
    }
    mesh.instanceMatrix.needsUpdate = true

    for (let i = 0; i < screens.length; i++) {
      const pulse = 0.72 + 0.28 * Math.sin(t * 4 + i * 0.9)
      if (activeBoll) tmp.c.copy(tmp.bCol).multiplyScalar(pulse)
      else tmp.c.set('#9cff6b').multiplyScalar(pulse * 0.75)
      screenMesh.setColorAt(i, tmp.c)
    }
    if (screenMesh.instanceColor) screenMesh.instanceColor.needsUpdate = true
  })

  if (!items.length && !screens.length) return null
  return (
    <group>
      {items.length > 0 && <primitive object={mesh} />}
      {screens.length > 0 && <primitive object={screenMesh} />}
    </group>
  )
}

// ═══════════════════════════ EVENTOS PERSONALIZADOS POR RUTA ═══════════════════════════
// Ruta A (Rápida) Mitad 1: Puertas Rúnicas que se abren de par en par + Puente Colgante Desplegable
function EventRunicGateAndBridge({ segment, stage }) {
  const { geo, mat } = getAssets()
  const leftDoorRef = useRef(); const rightDoorRef = useRef()
  const data = useMemo(() => {
    const pGate = placeAlong(segment, 0.24, 0, 0)
    const planks = Array.from({ length: 10 }, (_, i) => {
      const u = 0.28 + i * 0.055
      return { pL: placeAlong(segment, u, 0.04, -0.26), pR: placeAlong(segment, u, 0.04, 0.26), i }
    })
    const pillars = [0.24, 0.82].map((u) => placeAlong(segment, u, 0, 0))
    return { pGate, planks, pillars }
  }, [segment])

  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), p: new THREE.Vector3() }), [])
  const plankMesh = useMemo(() => new THREE.InstancedMesh(geo.plank, mat.solid, data.planks.length * 2), [geo, mat, data.planks.length])
  useEffect(() => () => plankMesh.dispose(), [plankMesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // Siempre deja paso amplio: semi-abiertas en reposo, totalmente abiertas en teaser/climax/salida
    const open = stage.phase === 'climax' || stage.phase === 'salida' ? 1.42
      : stage.phase === 'teaser' ? 1.05 + 0.25 * Math.sin(t * 7)
      : 0.78
    if (leftDoorRef.current) leftDoorRef.current.rotation.y = -open
    if (rightDoorRef.current) rightDoorRef.current.rotation.y = open

    let idx = 0
    for (const row of data.planks) {
      const wave = stage.phase === 'climax'
        ? Math.sin(Math.max(0, 1 - Math.abs(stage.k - (0.28 + row.i * 0.055)) * 4) * Math.PI * 0.5) * 0.14
        : Math.sin(t * 2.2 + row.i * 0.5) * 0.03 * stage.intensity
      for (const pl of [row.pL, row.pR]) {
        tmp.p.copy(pl.pos).addScaledVector(pl.up, wave)
        tmp.s.set(0.42, 1, 1)
        tmp.m.compose(tmp.p, pl.quat, tmp.s)
        plankMesh.setMatrixAt(idx++, tmp.m)
      }
    }
    plankMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {data.pillars.map((p, idx) => (
        <mesh key={idx} geometry={geo.gate} material={mat.solid} position={p.pos} quaternion={p.quat} scale={0.95} />
      ))}
      <group position={data.pGate.pos} quaternion={data.pGate.quat}>
        <mesh ref={leftDoorRef} geometry={geo.doorLeaf} material={mat.solid} position={[-0.78, 0, 0]} />
        <mesh ref={rightDoorRef} geometry={geo.doorLeaf} material={mat.solid} position={[0.78, 0, 0]} scale={[-1, 1, 1]} />
      </group>
      <primitive object={plankMesh} />
    </group>
  )
}

// Ruta A (Rápida) Mitad 2 / Tramos rápidos o aéreos: Túnel de Arcos de Viento del Dosel
function EventCanopyWindTunnel({ segment, stage }) {
  const { geo, mat } = getAssets()
  const rings = useMemo(() => {
    const us = segment.air ? [0.05, 0.12, 0.5, 0.88, 0.95] : [0.12, 0.25, 0.38, 0.5, 0.62, 0.75, 0.88]
    return us.map((u, i) => ({ u, pl: placeAlong(segment, u, segment.radius * 0.96, 0), i }))
  }, [segment])
  const ringMesh = useMemo(() => new THREE.InstancedMesh(geo.ring, mat.runeGlow, rings.length), [geo, mat, rings.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), q: new THREE.Quaternion(), rot: new THREE.Quaternion() }), [])
  useEffect(() => () => ringMesh.dispose(), [ringMesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i]
      const dist = stage.phase === 'climax' ? Math.max(0, 1 - Math.abs(stage.k - r.u) * 3.5) : stage.intensity * 0.4
      const pulse = 1 + dist * 0.22 + Math.sin(t * 5 - i) * 0.05
      tmp.rot.setFromAxisAngle(Z, t * (1.2 + stage.intensity * 3.5) + i * 0.7)
      tmp.q.copy(r.pl.quat).multiply(tmp.rot)
      tmp.s.set(segment.radius * 1.45 * pulse, segment.radius * 1.45 * pulse, 1)
      tmp.m.compose(r.pl.pos, tmp.q, tmp.s)
      ringMesh.setMatrixAt(i, tmp.m)
    }
    ringMesh.instanceMatrix.needsUpdate = true
  })
  return <primitive object={ringMesh} />
}

// Ruta B (Lenta) Mitad 1: Claro Musical de Nenúfares y Linternas Flotantes
function EventMusicalPondAndLanterns({ segment, stage }) {
  const { geo, mat } = getAssets()
  const pads = useMemo(() => {
    const rng = mulberry32(segment.i * 911 + 13)
    return Array.from({ length: 14 }, (_, i) => {
      const u = 0.1 + (i / 13) * 0.8
      const side = (i % 2 === 0 ? 1 : -1) * (0.42 + rng() * 0.35)
      return { u, pl: placeAlong(segment, u, 0.04, side), ph: rng() * TAU }
    })
  }, [segment])
  const padMesh = useMemo(() => new THREE.InstancedMesh(geo.orb, mat.runeGlow, pads.length), [geo, mat, pads.length])
  const lanternMesh = useMemo(() => new THREE.InstancedMesh(geo.lanternBulb, mat.glowWarm, pads.length), [geo, mat, pads.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), p: new THREE.Vector3(), c: new THREE.Color() }), [])
  useEffect(() => () => { padMesh.dispose(); lanternMesh.dispose() }, [padMesh, lanternMesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < pads.length; i++) {
      const pd = pads[i]
      const beat = 0.5 + 0.5 * Math.sin(t * (2.2 + stage.intensity * 3.5) - pd.u * 10 + pd.ph)
      const active = stage.phase === 'climax' ? Math.max(0.3, 1 - Math.abs(stage.k - pd.u) * 2.5) : stage.intensity
      tmp.s.set(1.25 * (0.8 + beat * 0.4), 0.25, 1.25 * (0.8 + beat * 0.4))
      tmp.m.compose(pd.pl.pos, pd.pl.quat, tmp.s)
      padMesh.setMatrixAt(i, tmp.m)
      tmp.c.setHSL(0.28 + 0.2 * Math.sin(beat * Math.PI + pd.u * 4), 0.9, 0.58 + active * 0.18)
      padMesh.setColorAt(i, tmp.c)

      const rise = (stage.phase === 'salida' ? 0.9 : 0.35 + active * 0.55) + 0.2 * Math.sin(t * 1.5 + pd.ph)
      tmp.p.copy(pd.pl.pos).addScaledVector(pd.pl.up, rise)
      tmp.s.setScalar(0.85 + active * 0.65)
      tmp.m.compose(tmp.p, pd.pl.quat, tmp.s)
      lanternMesh.setMatrixAt(i, tmp.m)
    }
    padMesh.instanceMatrix.needsUpdate = true
    if (padMesh.instanceColor) padMesh.instanceColor.needsUpdate = true
    lanternMesh.instanceMatrix.needsUpdate = true
  })
  return (
    <group>
      <primitive object={padMesh} />
      <primitive object={lanternMesh} />
    </group>
  )
}

// Ruta B (Lenta) Mitad 2: Cascada Cromática + Molino de Agua de Madera
function EventChromaticCascadeMill({ segment, stage }) {
  const { geo, mat } = getAssets()
  const wheelRef = useRef()
  const waterMat = useMemo(() => mat.waterFlow.clone(), [mat])
  const data = useMemo(() => {
    const wheel = placeAlong(segment, 0.5, 0.55, 0.58)
    const curtains = [0.28, 0.5, 0.72].map((u, idx) => ({
      u, pl: placeAlong(segment, u, segment.radius * 0.45, idx % 2 === 0 ? -0.48 : 0.48),
    }))
    return { wheel, curtains }
  }, [segment])

  useEffect(() => () => waterMat.dispose(), [waterMat])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (wheelRef.current) wheelRef.current.rotation.z = t * (0.9 + stage.intensity * 2.4)
    const hue = stage.phase === 'climax' ? (0.45 + stage.k * 0.38) % 1 : 0.5 + 0.08 * Math.sin(t * 0.8)
    waterMat.color.setHSL(hue, 0.9, 0.66).multiplyScalar(1.25)
    waterMat.opacity = 0.42 + stage.intensity * 0.38
  })

  return (
    <group>
      <group position={data.wheel.pos} quaternion={data.wheel.quat} ref={wheelRef}>
        <mesh geometry={geo.ring} material={mat.solid} scale={[1.1, 1.1, 1.1]} />
        {[0, 1, 2, 3, 4, 5].map((k) => (
          <mesh key={k} geometry={geo.paddle} material={mat.solid} rotation={[0, 0, (k * Math.PI) / 3]} />
        ))}
      </group>
      {data.curtains.map((c, i) => (
        <mesh key={i} geometry={geo.waterCurtain} material={waterMat} position={c.pl.pos} quaternion={c.pl.quat} />
      ))}
    </group>
  )
}

// Llegada: Fuegos Artificiales de Esporas y Hojas Doradas al cruzar la meta
function EventGoalFireworks({ segment, stage }) {
  const { geo, mat } = getAssets()
  const count = 36
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.spark, mat.firefly, count), [geo, mat])
  const burst = useMemo(() => {
    const rng = mulberry32(segment.i * 331 + 99)
    const cols = ['#ffd54f', '#9cff6b', '#ff8a65', '#7df9ff']
    return Array.from({ length: count }, (_, i) => ({
      pl: placeAlong(segment, 0.86, 0, 0),
      ang: (i / count) * TAU,
      spread: 0.45 + rng() * 0.9,
      ph: rng(),
      col: new THREE.Color(cols[i % cols.length]).multiplyScalar(1.4),
    }))
  }, [segment])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])
  useEffect(() => () => mesh.dispose(), [mesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' || stage.phase === 'salida' ? 1 : 0.25
    for (let i = 0; i < count; i++) {
      const b = burst[i]
      const cycle = (t * (0.7 + active * 0.9) + b.ph) % 1
      const r = cycle * b.spread * (0.6 + active * 0.9)
      const h = (0.6 + Math.sin(cycle * Math.PI) * 0.85) * (0.5 + active * 0.6)
      tmp.p.copy(b.pl.pos)
        .addScaledVector(b.pl.side, Math.cos(b.ang) * r)
        .addScaledVector(b.pl.up, h)
        .addScaledVector(b.pl.tangent, Math.sin(b.ang) * r * 0.5)
      const sc = (1 - cycle) * (0.45 + active * 0.95)
      tmp.s.setScalar(Math.max(0.01, sc))
      tmp.m.compose(tmp.p, IDENT_Q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
      mesh.setColorAt(i, b.col)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return <primitive object={mesh} />
}

// ═══════════════════════════ MECANISMOS DE CAMBIO DE CARRIL ═══════════════════════════
function LaneSwitchMechanisms({ way }) {
  const { geo, mat } = getAssets()
  const switches = useMemo(() => {
    const list = []
    for (const seg of way.segments) {
      if (seg.air) continue
      const sws = switchesOf(seg)
      if (sws.length > 0) {
        for (const sw of sws) {
          const uEnd = THREE.MathUtils.clamp(sw.u + Math.min(0.22, Math.max(0.08, (sw.duration ?? 0.5) * 0.14)), 0.04, 0.96)
          const f0 = laneFrame(seg, sw.from, sw.u)
          const f1 = laneFrame(seg, sw.to, uEnd)
          const dir = f1.pos.clone().sub(f0.pos)
          const len = Math.max(0.2, dir.length())
          const qBridge = new THREE.Quaternion().setFromUnitVectors(Z, dir.clone().normalize())
          const qFrom = new THREE.Quaternion().setFromUnitVectors(Z, f0.up)
          const qTo = new THREE.Quaternion().setFromUnitVectors(Z, f1.up)
          const qHead = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f0.side, f0.up, f0.tangent))
          const headPos = f0.pos.clone().addScaledVector(f0.up, 0.92)
          list.push({ seg, u: sw.u, kind: sw.kind || 'rampa', f0, f1, len, qBridge, qFrom, qTo, qHead, headPos, hasBridge: sw.from !== sw.to })
        }
      } else if (seg.kind === 'rampa' || seg.kind === 'zigzag' || seg.kind === 'turbina' || seg.kind === 'espiral') {
        const lanes = lanesOf(seg)
        const id0 = lanes[0]?.id ?? 0
        const f0 = laneFrame(seg, id0, 0.44)
        const f1 = laneFrame(seg, id0, 0.56)
        const dir = f1.pos.clone().sub(f0.pos)
        const len = Math.max(0.2, dir.length())
        const qBridge = new THREE.Quaternion().setFromUnitVectors(Z, dir.clone().normalize())
        const qFrom = new THREE.Quaternion().setFromUnitVectors(Z, f0.up)
        const qTo = new THREE.Quaternion().setFromUnitVectors(Z, f1.up)
        const qHead = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(f0.side, f0.up, f0.tangent))
        const headPos = f0.pos.clone().addScaledVector(f0.up, 0.92)
        list.push({ seg, u: 0.5, kind: seg.kind, f0, f1, len, qBridge, qFrom, qTo, qHead, headPos, hasBridge: false })
      }
    }
    return list
  }, [way])

  const bladesRef = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < switches.length; i++) {
      const m = bladesRef.current[i]
      if (!m) continue
      const sw = switches[i]
      let boost = 1
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === sw.seg && Math.abs((b.segT ?? 0) - sw.u) < 0.22) {
          boost = 3.2; break
        }
      }
      m.rotation.z = t * 2.2 * boost
    }
  })

  if (!switches.length) return null
  return (
    <group>
      {switches.map((sw, i) => (
        <group key={i}>
          <mesh geometry={geo.ring} material={mat.swGlow} position={sw.f0.pos} quaternion={sw.qFrom} scale={[1.05, 1.05, 0.4]} />
          {sw.hasBridge && <mesh geometry={geo.bridge} material={mat.swBridge} position={sw.f0.pos} quaternion={sw.qBridge} scale={[1, 0.3, sw.len]} />}
          <mesh geometry={geo.ring} material={mat.swGlow} position={sw.f1.pos} quaternion={sw.qTo} scale={[1.05, 1.05, 0.4]} />
          <group position={sw.headPos} quaternion={sw.qHead}>
            <mesh ref={(el) => { bladesRef.current[i] = el }} geometry={geo.ring} material={mat.runeGlow} scale={[1.65, 1.65, 1.2]} />
          </group>
        </group>
      ))}
    </group>
  )
}

// ═══════════════════════════ CRIATURAS SOBRE TERRENO ═══════════════════════════
function TerrainCritter({ way, segments = null, count = 12, geo, mat, scale = 0.32, speed = 0.7, angle = 0.58, spread = 0.14, hop = 0.26, seed = 1 }) {
  const path = useMemo(() => {
    const info = routeInfo(way)
    return segPath(segments ?? info.routes[0]?.segments.map((s) => s.seg) ?? way.segments)
  }, [way, segments])
  const state = useMemo(() => {
    const rng = mulberry32(seed * 7919 + way.idx * 131)
    return Array.from({ length: count }, () => ({
      s: rng() * (path.total || 1), dir: rng() > 0.5 ? 1 : -1, ph: rng() * TAU,
      a: angle + (rng() - 0.5) * spread * 2, v: speed * (0.7 + rng() * 0.6),
      excite: 0, flee: 0,
    }))
  }, [path, count, seed, angle, spread, speed, way.idx])
  const mesh = useMemo(() => new THREE.InstancedMesh(geo, mat, Math.max(1, count)), [geo, mat, count])
  const tmp = useMemo(() => ({
    loc: {}, pl: makePlacement(), sc: new THREE.Vector3(), q: new THREE.Quaternion(),
    flip: new THREE.Quaternion().setFromAxisAngle(Y, Math.PI), m: new THREE.Matrix4(),
  }), [])

  useEffect(() => () => mesh.dispose(), [mesh])

  useFrame((st, dt) => {
    if (!path.total || !mesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = st.clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < state.length; i++) {
      const c = state[i]
      c.s += c.dir * c.v * h * (1 + c.excite * 1.4)
      if (c.s > path.total) { c.s = path.total; c.dir = -1 }
      if (c.s < 0) { c.s = 0; c.dir = 1 }
      let near = 0; let fleeDir = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = path.arcOf(b.seg, b.segT ?? 0)
        if (arc == null) continue
        const d = Math.abs(arc - c.s)
        if (d < 2.6) {
          const k01 = 1 - d / 2.6
          if (k01 > near) { near = k01; fleeDir = Math.sign(c.a - (b.roll ?? 0)) || 1 }
        }
      }
      c.excite = THREE.MathUtils.damp(c.excite, near, near > c.excite ? 9 : 2.5, h)
      c.flee = THREE.MathUtils.damp(c.flee, fleeDir * near * 0.22, 4, h)
      path.locate(c.s, tmp.loc)
      const seg = tmp.loc.seg
      const a = c.a + Math.sin(t * 0.7 + c.ph) * spread * 0.45 + c.flee
      const ground = terrainOffset(seg, tmp.loc.u, a)
      const bob = Math.abs(Math.sin(t * 6 * c.v + c.ph)) * scale * 0.36
      const jump = c.excite * hop * Math.abs(Math.sin(t * 9 + c.ph))
      placeAlongInto(seg, tmp.loc.u, ground + bob + jump, a, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (c.dir < 0) tmp.q.multiply(tmp.flip)
      const squash = 1 + Math.sin(t * 12 * c.v + c.ph) * 0.06
      tmp.sc.set(scale / squash, scale * squash, scale / squash)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      mesh.setMatrixAt(i, tmp.m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}

// ═══════════════════════════ COMPONENTE PRINCIPAL DEL TEMA BOSQUE ═══════════════════════════
export default function Vida({ way, detail }) {
  const { geo, mat } = getAssets()
  const fineRef = useRef()
  const info = useMemo(() => routeInfo(way), [way])

  const layout = useMemo(() => {
    const rng = mulberry32(way.idx * 8191 + 101)
    const solidSegs = way.segments.filter((s) => !s.air)
    const villageSegs = solidSegs.filter((s) => s.kind === 'salida')
    const calmSegs = solidSegs.filter((s) => s.speedK <= 0.9 || s.kind === 'pantano' || s.kind === 'llegada')

    // Densidad alta y pareja sobre la superficie del terreno (respetando cauce >= 0.50 rad)
    const pines = scatterOnTerrain(way, 140, rng, { angle: [-Math.PI * 0.52, Math.PI * 0.52], clear: BALL_R * 1.4, scale: [0.52, 0.88] })
    const oaks = scatterOnTerrain(way, 80, rng, { angle: [-Math.PI * 0.5, Math.PI * 0.5], clear: BALL_R * 1.45, scale: [0.52, 0.84] })
    const houses = scatterOnTerrain(way, 24, rng, {
      segments: villageSegs.length ? villageSegs : solidSegs,
      angle: [-Math.PI * 0.48, Math.PI * 0.48], clear: BALL_R * 1.5, scale: [0.65, 0.88],
    })
    const rocks = scatterOnTerrain(way, 90, rng, { angle: [-Math.PI * 0.52, Math.PI * 0.52], clear: BALL_R * 1.25, scale: [0.42, 0.78] })
    const mushCols = ['#e53935', '#ff7043', '#ffb74d', '#9cff6b']
    const mushrooms = scatterOnTerrain(way, 100, rng, { angle: [-Math.PI * 0.5, Math.PI * 0.5], clear: BALL_R * 1.2, scale: [0.36, 0.65] })
      .map((it) => ({ ...it, color: mushCols[Math.floor(it.rnd * mushCols.length)] }))
    const vines = scatter(way, 90, rng, { angle: [Math.PI * 0.78, Math.PI * 1.22], clear: 0.2, scale: [0.5, 0.88] })
    const owls = scatterOnTerrain(way, 24, rng, {
      segments: calmSegs.length ? calmSegs : solidSegs,
      angle: [-Math.PI * 0.5, Math.PI * 0.5], clear: BALL_R * 1.3, scale: [0.32, 0.42],
    })

    const lanterns = []; const lanternBulbs = []; const fences = []
    const stands = []; const screens = []; const spectators = []; const flags = []
    const gates = []; const curbsFast = []; const curbsSlow = []; const curbsMain = []
    const metaLines = []; const heroSigns = []
    const bannerCols = ['#2e7d32', '#8bc34a', '#ffd54f']
    const flipY = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

    for (const seg of solidSegs) {
      const rt = info.routes.find((r) => r.r === seg.route)
      const isFast = rt?.profile?.speed === 'rapida' || seg.speedK >= 1.15
      const isSlow = rt?.profile?.speed === 'lenta' || seg.speedK <= 0.85

      if (seg.kind === 'salida') {
        const pg = placeAlong(seg, 0.08, 0, 0)
        gates.push({ pos: pg.pos, quat: pg.quat, scale: 0.98 })
        heroSigns.push({
          key: `in-${seg.i}`, text: 'BOSQUE · BIENVENIDOS', sub: `${way.theme.emoji} Circuito del Dosel`,
          pos: pg.pos.clone().addScaledVector(pg.up, 1.48), quat: pg.quat.clone().multiply(flipY),
        })
      }
      if (seg.event) {
        metaLines.push(placeAlong(seg, 0.04, 0, 0), placeAlong(seg, 0.96, 0, 0))
      }
      if (seg.kind === 'llegada') {
        const pg = placeAlong(seg, 0.86, 0, 0)
        gates.push({ pos: pg.pos, quat: pg.quat, scale: 1.02 })
        metaLines.push(pg)
        heroSigns.push({
          key: `goal-${seg.i}`, text: '🏁 ¡META DEL BOSQUE!', sub: 'Estadio del Dosel',
          pos: pg.pos.clone().addScaledVector(pg.up, 1.52), quat: pg.quat.clone().multiply(flipY),
        })
      }

      const nSteps = Math.max(3, Math.floor(seg.length / 4.2))
      for (let i = 0; i < nSteps; i++) {
        const u = (i + 0.5) / nSteps
        const sideSign = i % 2 === 0 ? 1 : -1

        const lpAng = sideSign * 0.58
        if (laneGap(seg, lpAng) > 0.16) {
          const pl = placeAlong(seg, u, terrainOffset(seg, u, lpAng), lpAng)
          lanterns.push({ pos: pl.pos, quat: pl.quat, scale: 0.85 })
          lanternBulbs.push({ pos: pl.pos.clone().addScaledVector(pl.up, 0.39).addScaledVector(pl.side, 0.11), quat: pl.quat, scale: 0.9 })
        }

        for (const sgn of [-1, 1]) {
          const fAng = sgn * 0.51
          if (laneGap(seg, fAng) > 0.14) {
            const pf = placeAlong(seg, u, terrainOffset(seg, u, fAng), fAng)
            fences.push({ pos: pf.pos, quat: pf.quat, scale: 0.82 })
          }
        }

        if (i % 2 === 0) {
          const cAng = sideSign * 0.47
          if (laneGap(seg, cAng) > 0.1) {
            const pc = placeAlong(seg, u, terrainOffset(seg, u, cAng), cAng)
            const bucket = isFast ? curbsFast : isSlow ? curbsSlow : curbsMain
            bucket.push({ pos: pc.pos, quat: pc.quat, scale: 1 })
          }
        }

        if (isFast || i % 2 === 1) {
          const fl = placeAlong(seg, u, terrainOffset(seg, u, sideSign * 0.74), sideSign * 0.74)
          flags.push({ pos: fl.pos, quat: fl.quat, scale: 0.82, color: bannerCols[i % bannerCols.length] })
        }
      }

      const nStands = Math.max(1, Math.floor(seg.length / 22))
      for (let j = 0; j < nStands; j++) {
        const u = (j + 0.5) / nStands
        const sgn = (j + seg.i) % 2 === 0 ? 1 : -1
        const sAng = sgn * 0.66
        if (laneGap(seg, sAng) < 0.28) continue
        const ps = placeAlong(seg, u, terrainOffset(seg, u, sAng), sAng)
        const qFace = ps.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, sgn > 0 ? -Math.PI * 0.5 : Math.PI * 0.5))
        stands.push({ pos: ps.pos, quat: qFace, scale: 0.64 })
        screens.push({
          pos: ps.pos.clone().addScaledVector(ps.up, 0.66).addScaledVector(ps.side, sgn * 0.12),
          quat: qFace, scale: 0.64,
        })
        for (const sx of [-0.48, 0, 0.48]) {
          const pSpec = ps.pos.clone()
            .addScaledVector(ps.tangent, sx * 0.64)
            .addScaledVector(ps.up, 0.22)
          spectators.push({ pos: pSpec, quat: qFace, up: ps.up, scale: 0.38, rnd: rng() })
        }
      }
    }

    // Asignar eventos distintos por ruta (cubriendo también eventos `air` y tramos largos `espiral`!)
    const eventStages = []
    const seenSeg = new Set()
    for (const rt of info.routes) {
      let evIdx = 0
      for (const si of rt.segments) {
        if (seenSeg.has(si.seg)) continue
        if (si.kind === 'llegada') {
          seenSeg.add(si.seg)
          eventStages.push({ seg: si.seg, mode: 'goal' })
        } else if (si.event || (rt.r === 0 && si.kind === 'espiral')) {
          seenSeg.add(si.seg)
          const mode = si.seg.air ? 'A2'
            : rt.r === 0 ? (evIdx % 2 === 0 ? 'A1' : 'A2')
            : rt.r === 1 ? (evIdx % 2 === 0 ? 'B1' : 'B2')
            : (evIdx % 2 === 0 ? 'A2' : 'B1')
          eventStages.push({ seg: si.seg, mode })
          evIdx++
        }
      }
    }

    return {
      pines, oaks, houses, rocks, mushrooms, vines, owls,
      lanterns, lanternBulbs, fences, stands, screens, spectators, flags,
      gates, curbsFast, curbsSlow, curbsMain, metaLines, heroSigns, eventStages,
    }
  }, [way, info])

  useFrame(() => {
    const det = detail?.value ?? 1
    if (fineRef.current) fineRef.current.visible = det > 0.18
  })

  const foxSegs = useMemo(() => way.segments.filter((s) => !s.air && s.route >= 0), [way])
  const deerSegs = useMemo(() => way.segments.filter((s) => !s.air), [way])

  return (
    <group name="vida-bosque">
      <BosqueTerrainAndSky way={way} detail={detail} />

      {/* Capa diorama siempre visible (incluso desde fuera del cristal en LOD 0) */}
      <Instanced geo={geo.pine} mat={mat.solid} items={layout.pines} />
      <Instanced geo={geo.oak} mat={mat.solid} items={layout.oaks} />
      <Instanced geo={geo.houseSolid} mat={mat.solid} items={layout.houses} />
      <Instanced geo={geo.houseWin} mat={mat.winGlow} items={layout.houses} />
      <Instanced geo={geo.lanternBulb} mat={mat.glowWarm} items={layout.lanternBulbs} />
      <Instanced geo={geo.gate} mat={mat.solid} items={layout.gates} />
      <FireflySwarm way={way} count={110} />

      {/* Mecanismos de cambio de carril */}
      <LaneSwitchMechanisms way={way} />

      {/* Capa de detalle fino (visible al acercarse o seguir/POV) */}
      <group ref={fineRef}>
        <Instanced geo={geo.rock} mat={mat.solid} items={layout.rocks} />
        <Instanced geo={geo.vine} mat={mat.solid} items={layout.vines} />
        <Instanced geo={geo.lanternPost} mat={mat.solid} items={layout.lanterns} />
        <Instanced geo={geo.fence} mat={mat.solid} items={layout.fences} />
        <Instanced geo={geo.stand} mat={mat.solid} items={layout.stands} />
        <Instanced geo={geo.flag} mat={mat.flag} items={layout.flags} />
        <Instanced geo={geo.curb} mat={mat.curbFast} items={layout.curbsFast} />
        <Instanced geo={geo.curb} mat={mat.curbSlow} items={layout.curbsSlow} />
        <Instanced geo={geo.curb} mat={mat.curbMain} items={layout.curbsMain} />
        <Instanced geo={geo.metaStrip} mat={mat.meta} items={layout.metaLines} />

        <BouncyMushrooms way={way} items={layout.mushrooms} />
        <SleepyOwls way={way} items={layout.owls} />
        <ForestSpectators way={way} items={layout.spectators} screens={layout.screens} />

        <TerrainCritter way={way} segments={foxSegs.length ? foxSegs : null} count={10} geo={geo.fox} mat={mat.critter} scale={0.32} speed={0.95} angle={0.58} spread={0.14} hop={0.28} seed={11} />
        <TerrainCritter way={way} segments={deerSegs} count={10} geo={geo.deer} mat={mat.critter} scale={0.34} speed={0.55} angle={-0.58} spread={0.14} hop={0.22} seed={23} />
        <TerrainCritter way={way} segments={deerSegs} count={12} geo={geo.squirrel} mat={mat.critter} scale={0.24} speed={1.35} angle={0.78} spread={0.18} hop={0.32} seed={37} />

        {layout.heroSigns.map((hs) => (
          <Billboard key={hs.key} text={hs.text} style={{ ...ESTILO_BOSQUE, sub: hs.sub }} height={0.38} position={hs.pos} quat={hs.quat} />
        ))}
        <CartelesDeRuta way={way} style={ESTILO_BOSQUE} angle={0.78} u={0.12} poleColor="#4e342e" />
      </group>

      {/* Eventos personalizados por ruta + fuegos artificiales de meta */}
      {layout.eventStages.map((ev) => (
        <EventStage
          key={ev.seg.i}
          segment={ev.seg}
          render={(stage) => {
            if (ev.mode === 'A1') return <EventRunicGateAndBridge segment={ev.seg} stage={stage} />
            if (ev.mode === 'A2') return <EventCanopyWindTunnel segment={ev.seg} stage={stage} />
            if (ev.mode === 'B1') return <EventMusicalPondAndLanterns segment={ev.seg} stage={stage} />
            if (ev.mode === 'B2') return <EventChromaticCascadeMill segment={ev.seg} stage={stage} />
            return <EventGoalFireworks segment={ev.seg} stage={stage} />
          }}
        />
      ))}

      <Soundless />
    </group>
  )
}
