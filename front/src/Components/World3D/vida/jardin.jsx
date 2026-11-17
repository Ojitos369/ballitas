// Vida del Camino del Jardín: diorama/terrario dentro del tubo de cristal (contrato en README.md).
// Todo vive en el interior del tubo (<= R * FILL), respetando los carriles y sus mecanismos de cambio.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALL_R, Billboard, CartelesDeRuta, EventStage, Instanced, Soundless, TAU,
  buildSkyGeo, buildTerrainGeo, getBallitas, laneFrame, laneGap, lanesOf,
  makePlacement, markShared, mulberry32, placeAlong, placeAlongInto, routeInfo, scatter,
  segPath, switchesOf,
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
  const wave = 0.5 + 0.5 * Math.sin(u * seg.length * 0.68 + a * 3.0) * Math.cos(u * seg.length * 0.28 - a * 1.9)
  const bank = Math.abs(a) > 0.35 ? 0.26 : 0.04
  return THREE.MathUtils.clamp(wave * 0.68 + bank, 0, 1)
}
const terrainMaxH = (seg) => seg.radius * (seg.kind === 'cascada' || seg.kind === 'pantano' ? 0.18 : 0.25)
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
      const k = THREE.MathUtils.clamp(0.86 + pos.getY(i) * shade, 0.75, 1.18)
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

function makeTopiaryGeo() {
  const pot = paintPart(new THREE.CylinderGeometry(0.16, 0.12, 0.18, 10), '#d9825b', { t: [0, 0.09, 0] })
  const rim = paintPart(new THREE.TorusGeometry(0.16, 0.03, 6, 12), '#f09e75', { t: [0, 0.18, 0], r: [Math.PI / 2, 0, 0] })
  const stem = paintPart(new THREE.CylinderGeometry(0.035, 0.045, 0.35, 8), '#5b4636', { t: [0, 0.34, 0] })
  const b1 = paintPart(new THREE.SphereGeometry(0.24, 10, 8), '#339c44', { t: [0, 0.54, 0], shade: 0.25 })
  const b2 = paintPart(new THREE.SphereGeometry(0.17, 8, 6), '#4bc25a', { t: [0, 0.8, 0], shade: 0.25 })
  const bud = paintPart(new THREE.SphereGeometry(0.065, 8, 6), '#ff78b0', { t: [0, 0.99, 0] })
  return mergePainted([pot, rim, stem, b1, b2, bud])
}

function makeGardenHouseSolidGeo() {
  const base = paintPart(new THREE.CylinderGeometry(0.36, 0.4, 0.36, 10), '#fff5ec', { t: [0, 0.18, 0], shade: 0.12 })
  const roof = paintPart(new THREE.SphereGeometry(0.45, 10, 8, 0, TAU, 0, Math.PI * 0.56), '#ff6fa5', { t: [0, 0.34, 0], s: [1, 0.95, 1], shade: 0.2 })
  const trim = paintPart(new THREE.TorusGeometry(0.42, 0.04, 6, 14), '#ffd24a', { t: [0, 0.35, 0], r: [Math.PI / 2, 0, 0] })
  const door = paintPart(new THREE.CapsuleGeometry(0.09, 0.11, 4, 6), '#7a5238', { t: [0, 0.13, 0.35], s: [1, 1, 0.35] })
  const topBud = paintPart(new THREE.SphereGeometry(0.09, 8, 6), '#ffd24a', { t: [0, 0.78, 0] })
  return mergePainted([base, roof, trim, door, topBud])
}

function makeGardenHouseWinGeo() {
  const w1 = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#fff08a', { t: [0.24, 0.22, 0.26], s: [0.85, 1, 0.4] })
  const w2 = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#fff08a', { t: [-0.24, 0.22, 0.26], s: [0.85, 1, 0.4] })
  const w3 = paintPart(new THREE.SphereGeometry(0.06, 10, 8), '#ffd1eb', { t: [0, 0.54, 0.31], s: [1, 1, 0.4] })
  return mergePainted([w1, w2, w3])
}

function makeFlowerStemGeo() {
  const stem = paintPart(new THREE.CapsuleGeometry(0.025, 0.38, 6, 10), '#3ea84b', { t: [0, 0.2, 0] })
  const l1 = paintPart(new THREE.SphereGeometry(0.09, 10, 8), '#58c456', { t: [0.09, 0.14, 0], r: [0, 0, -0.5], s: [1.3, 0.45, 0.7] })
  const l2 = paintPart(new THREE.SphereGeometry(0.09, 10, 8), '#4ab84e', { t: [-0.09, 0.2, 0], r: [0, 0, 0.5], s: [1.3, 0.45, 0.7] })
  return mergePainted([stem, l1, l2])
}

function makeFlowerHeadGeo() {
  const parts = []
  parts.push(paintPart(new THREE.SphereGeometry(0.12, 8, 6), '#ffe066', { t: [0, 0.04, 0], s: [1, 0.7, 1] }))
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    parts.push(paintPart(new THREE.SphereGeometry(0.12, 8, 6), '#ffffff', {
      t: [Math.cos(a) * 0.16, 0.02, Math.sin(a) * 0.16],
      r: [Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25],
      s: [1.1, 0.42, 0.85],
    }))
  }
  return mergePainted(parts)
}

function makeGnomeGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.28, 16, 12), '#5298e8', { t: [0, 0.24, 0], s: [1, 0.92, 1] })
  const head = paintPart(new THREE.SphereGeometry(0.24, 16, 12), '#ffe0c8', { t: [0, 0.36, 0.04] })
  const beard = paintPart(new THREE.SphereGeometry(0.18, 12, 10), '#ffffff', { t: [0, 0.22, 0.17], s: [1.1, 0.85, 0.65] })
  const hat = paintPart(new THREE.ConeGeometry(0.26, 0.42, 16), '#ff527a', { t: [0, 0.65, 0.02], r: [-0.1, 0, 0.08] })
  const pom = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#fff7df', { t: [-0.03, 0.86, -0.02] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.048, 10, 8), '#23141f', { t: [-0.085, 0.39, 0.255] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.048, 10, 8), '#23141f', { t: [0.085, 0.39, 0.255] })
  const shineL = paintPart(new THREE.SphereGeometry(0.018, 8, 6), '#ffffff', { t: [-0.07, 0.41, 0.295] })
  const shineR = paintPart(new THREE.SphereGeometry(0.018, 8, 6), '#ffffff', { t: [0.1, 0.41, 0.295] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8fab', { t: [-0.14, 0.33, 0.235], s: [1, 0.68, 0.45] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8fab', { t: [0.14, 0.33, 0.235], s: [1, 0.68, 0.45] })
  return mergePainted([body, head, beard, hat, pom, eyeL, eyeR, shineL, shineR, cheekL, cheekR])
}

function makeGardenerGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.27, 16, 12), '#7bd69e', { t: [0, 0.24, 0] })
  const head = paintPart(new THREE.SphereGeometry(0.24, 16, 12), '#ffdfc4', { t: [0, 0.38, 0.02] })
  const brim = paintPart(new THREE.CylinderGeometry(0.36, 0.38, 0.04, 18), '#f6d57a', { t: [0, 0.54, 0] })
  const crown = paintPart(new THREE.SphereGeometry(0.21, 14, 10), '#ecc258', { t: [0, 0.58, 0], s: [1, 0.72, 1] })
  const hatFlow = paintPart(new THREE.SphereGeometry(0.075, 10, 8), '#ff6fa5', { t: [0.18, 0.59, 0.14] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.048, 10, 8), '#24141d', { t: [-0.085, 0.4, 0.235] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.048, 10, 8), '#24141d', { t: [0.085, 0.4, 0.235] })
  const shineL = paintPart(new THREE.SphereGeometry(0.018, 8, 6), '#ffffff', { t: [-0.07, 0.42, 0.275] })
  const shineR = paintPart(new THREE.SphereGeometry(0.018, 8, 6), '#ffffff', { t: [0.1, 0.42, 0.275] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8cab', { t: [-0.14, 0.34, 0.22], s: [1, 0.68, 0.45] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8cab', { t: [0.14, 0.34, 0.22], s: [1, 0.68, 0.45] })
  return mergePainted([body, head, brim, crown, hatFlow, eyeL, eyeR, shineL, shineR, cheekL, cheekR])
}

function makeBeeGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.26, 16, 12), '#ffd54a', { t: [0, 0.25, 0], s: [0.95, 0.92, 1.15] })
  const stripe1 = paintPart(new THREE.TorusGeometry(0.23, 0.042, 8, 18), '#3b2416', { t: [0, 0.25, -0.04] })
  const stripe2 = paintPart(new THREE.TorusGeometry(0.19, 0.038, 8, 18), '#3b2416', { t: [0, 0.25, -0.15] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.052, 10, 8), '#24131c', { t: [-0.095, 0.3, 0.25] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.052, 10, 8), '#24131c', { t: [0.095, 0.3, 0.25] })
  const shineL = paintPart(new THREE.SphereGeometry(0.02, 8, 6), '#ffffff', { t: [-0.08, 0.32, 0.292] })
  const shineR = paintPart(new THREE.SphereGeometry(0.02, 8, 6), '#ffffff', { t: [0.11, 0.32, 0.292] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8aa8', { t: [-0.15, 0.23, 0.23], s: [1, 0.65, 0.45] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8aa8', { t: [0.15, 0.23, 0.23], s: [1, 0.65, 0.45] })
  const antL = paintPart(new THREE.CapsuleGeometry(0.018, 0.12, 4, 8), '#3b2416', { t: [-0.07, 0.49, 0.1], r: [0.25, 0, 0.25] })
  const antR = paintPart(new THREE.CapsuleGeometry(0.018, 0.12, 4, 8), '#3b2416', { t: [0.07, 0.49, 0.1], r: [0.25, 0, -0.25] })
  const wL = paintPart(new THREE.SphereGeometry(0.14, 12, 10), '#e8faff', { t: [-0.18, 0.42, -0.05], r: [0.3, 0, 0.55], s: [1.2, 0.2, 0.8] })
  const wR = paintPart(new THREE.SphereGeometry(0.14, 12, 10), '#e8faff', { t: [0.18, 0.42, -0.05], r: [0.3, 0, -0.55], s: [1.2, 0.2, 0.8] })
  return mergePainted([body, stripe1, stripe2, eyeL, eyeR, shineL, shineR, cheekL, cheekR, antL, antR, wL, wR])
}

function makeFrogGeo() {
  const body = paintPart(new THREE.SphereGeometry(0.28, 16, 12), '#5ed658', { t: [0, 0.2, 0], s: [1.1, 0.78, 1.05] })
  const belly = paintPart(new THREE.SphereGeometry(0.21, 12, 10), '#d6f8b8', { t: [0, 0.14, 0.08] })
  const bulgeL = paintPart(new THREE.SphereGeometry(0.09, 10, 8), '#68e262', { t: [-0.12, 0.37, 0.12] })
  const bulgeR = paintPart(new THREE.SphereGeometry(0.09, 10, 8), '#68e262', { t: [0.12, 0.37, 0.12] })
  const eyeL = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#ffffff', { t: [-0.12, 0.38, 0.18] })
  const eyeR = paintPart(new THREE.SphereGeometry(0.065, 10, 8), '#ffffff', { t: [0.12, 0.38, 0.18] })
  const pupL = paintPart(new THREE.SphereGeometry(0.036, 8, 6), '#1f151b', { t: [-0.12, 0.38, 0.23] })
  const pupR = paintPart(new THREE.SphereGeometry(0.036, 8, 6), '#1f151b', { t: [0.12, 0.38, 0.23] })
  const cheekL = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8fa8', { t: [-0.18, 0.23, 0.21], s: [1, 0.65, 0.45] })
  const cheekR = paintPart(new THREE.SphereGeometry(0.055, 8, 6), '#ff8fa8', { t: [0.18, 0.23, 0.21], s: [1, 0.65, 0.45] })
  return mergePainted([body, belly, bulgeL, bulgeR, eyeL, eyeR, pupL, pupR, cheekL, cheekR])
}

function makeButterflyBodyGeo() {
  const body = paintPart(new THREE.CapsuleGeometry(0.06, 0.22, 6, 10), '#3b2436', { t: [0, 0, 0], r: [Math.PI / 2, 0, 0] })
  const head = paintPart(new THREE.SphereGeometry(0.085, 10, 8), '#3b2436', { t: [0, 0.02, 0.14] })
  const antL = paintPart(new THREE.CapsuleGeometry(0.012, 0.1, 4, 6), '#ffd24a', { t: [-0.04, 0.11, 0.18], r: [0.4, 0, 0.3] })
  const antR = paintPart(new THREE.CapsuleGeometry(0.012, 0.1, 4, 6), '#ffd24a', { t: [0.04, 0.11, 0.18], r: [0.4, 0, -0.3] })
  return mergePainted([body, head, antL, antR])
}

function makeButterflyWingGeo(side) {
  const upper = paintPart(new THREE.SphereGeometry(0.2, 12, 10), '#ffffff', { t: [side * 0.22, 0.02, 0.06], s: [1.15, 0.16, 0.95] })
  const lower = paintPart(new THREE.SphereGeometry(0.14, 10, 8), '#ffe6f2', { t: [side * 0.16, 0.01, -0.14], s: [1.0, 0.16, 0.9] })
  return mergePainted([upper, lower])
}

function makeGardenGateGeo() {
  const pL = paintPart(new THREE.CylinderGeometry(0.085, 0.115, 1.26, 12), '#fff8f2', { t: [-1.26, 0.63, 0] })
  const pR = paintPart(new THREE.CylinderGeometry(0.085, 0.115, 1.26, 12), '#fff8f2', { t: [1.26, 0.63, 0] })
  const arch = paintPart(new THREE.TorusGeometry(1.26, 0.08, 10, 24, Math.PI), '#fff8f2', { t: [0, 1.24, 0] })
  const vineL = paintPart(new THREE.TorusGeometry(0.13, 0.032, 8, 14), '#4caf50', { t: [-1.26, 0.9, 0], r: [Math.PI / 2, 0, 0] })
  const vineR = paintPart(new THREE.TorusGeometry(0.13, 0.032, 8, 14), '#4caf50', { t: [1.26, 0.9, 0], r: [Math.PI / 2, 0, 0] })
  const f1 = paintPart(new THREE.SphereGeometry(0.15, 10, 8), '#ff6fa5', { t: [-0.72, 2.26, 0.05] })
  const f2 = paintPart(new THREE.SphereGeometry(0.15, 10, 8), '#ff6fa5', { t: [0.72, 2.26, 0.05] })
  const crest = paintPart(new THREE.SphereGeometry(0.2, 14, 12), '#ffd24a', { t: [0, 2.48, 0.06], s: [1.1, 1.1, 0.7] })
  return mergePainted([pL, pR, arch, vineL, vineR, f1, f2, crest])
}

function makePergolaGeo() {
  const pL = paintPart(new THREE.CylinderGeometry(0.055, 0.07, 1.22, 10), '#fff6ee', { t: [-1.22, 0.61, 0] })
  const pR = paintPart(new THREE.CylinderGeometry(0.055, 0.07, 1.22, 10), '#fff6ee', { t: [1.22, 0.61, 0] })
  const top = paintPart(new THREE.CapsuleGeometry(0.055, 2.46, 6, 12), '#fff6ee', { t: [0, 1.22, 0], r: [0, 0, Math.PI / 2] })
  const leaf = paintPart(new THREE.SphereGeometry(0.18, 12, 10), '#4bc25a', { t: [-0.75, 1.26, 0], s: [1.5, 0.55, 0.7] })
  const leaf2 = paintPart(new THREE.SphereGeometry(0.18, 12, 10), '#4bc25a', { t: [0.75, 1.26, 0], s: [1.5, 0.55, 0.7] })
  const rose = paintPart(new THREE.SphereGeometry(0.13, 10, 8), '#ff78b0', { t: [0, 1.3, 0.04] })
  return mergePainted([pL, pR, top, leaf, leaf2, rose])
}

function makeGardenStandGeo() {
  const s1 = paintPart(new THREE.BoxGeometry(2.2, 0.16, 0.32), '#f8ece4', { t: [0, 0.08, 0.24] })
  const s2 = paintPart(new THREE.BoxGeometry(2.2, 0.32, 0.32), '#e8d5ca', { t: [0, 0.16, 0.0] })
  const s3 = paintPart(new THREE.BoxGeometry(2.2, 0.48, 0.32), '#d6bfb2', { t: [0, 0.24, -0.24] })
  const rail = paintPart(new THREE.BoxGeometry(2.24, 0.05, 0.06), '#ff85b3', { t: [0, 0.28, 0.4] })
  const postL = paintPart(new THREE.CylinderGeometry(0.03, 0.035, 0.82, 8), '#fff6ee', { t: [-0.98, 0.41, -0.34] })
  const postR = paintPart(new THREE.CylinderGeometry(0.03, 0.035, 0.82, 8), '#fff6ee', { t: [0.98, 0.41, -0.34] })
  const roof = paintPart(new THREE.BoxGeometry(2.26, 0.06, 0.56), '#ff6fa5', { t: [0, 0.82, -0.18], r: [0.18, 0, 0] })
  return mergePainted([s1, s2, s3, rail, postL, postR, roof])
}

function makeWhiteFenceGeo() {
  const p1 = paintPart(new THREE.CapsuleGeometry(0.032, 0.2, 6, 8), '#fff8f2', { t: [0, 0.12, -0.26] })
  const p2 = paintPart(new THREE.CapsuleGeometry(0.032, 0.2, 6, 8), '#fff8f2', { t: [0, 0.12, 0] })
  const p3 = paintPart(new THREE.CapsuleGeometry(0.032, 0.2, 6, 8), '#fff8f2', { t: [0, 0.12, 0.26] })
  const bar = paintPart(new THREE.CapsuleGeometry(0.022, 0.58, 6, 8), '#ffd1e8', { t: [0, 0.18, 0], r: [Math.PI / 2, 0, 0] })
  return mergePainted([p1, p2, p3, bar])
}

function makeVictorianLampGeo() {
  const pole = paintPart(new THREE.CylinderGeometry(0.025, 0.038, 0.58, 10), '#3f6340', { t: [0, 0.29, 0] })
  const arm = paintPart(new THREE.CapsuleGeometry(0.018, 0.14, 5, 8), '#3f6340', { t: [0.06, 0.56, 0], r: [0, 0, Math.PI / 2] })
  const cap = paintPart(new THREE.ConeGeometry(0.07, 0.06, 12), '#ff8fb8', { t: [0.12, 0.52, 0] })
  return mergePainted([pole, arm, cap])
}

function makeFlagGeo() {
  const pole = paintPart(new THREE.CylinderGeometry(0.018, 0.022, 0.48, 8), '#fff6ee', { t: [0, 0.24, 0] })
  const cloth = paintPart(new THREE.ConeGeometry(0.12, 0.26, 4), '#ffffff', { t: [0.13, 0.38, 0], r: [0, 0, -Math.PI / 2], s: [1, 1, 0.22] })
  return mergePainted([pole, cloth])
}

function makePinwheelBladeGeo() {
  const parts = []
  const cols = ['#ff6fa5', '#ffd24a', '#7be8ff', '#b06bff', '#ff8a5c', '#a5d6a7']
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU
    parts.push(paintPart(new THREE.SphereGeometry(0.16, 10, 8), cols[i], {
      t: [Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0],
      r: [0, 0, a],
      s: [1.5, 0.55, 0.25],
    }))
  }
  parts.push(paintPart(new THREE.SphereGeometry(0.1, 10, 8), '#fff7cc', { t: [0, 0, 0.04] }))
  return mergePainted(parts)
}

function makeCheckeredTex() {
  if (typeof document === 'undefined') return new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  const c = document.createElement('canvas')
  c.width = 256; c.height = 64
  const ctx = c.getContext('2d')
  const cols = 16; const rows = 4; const cw = c.width / cols; const ch = c.height / rows
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#fff7fb' : '#c23a74'
      ctx.fillRect(x * cw, y * ch, cw, ch)
    }
  }
  ctx.fillStyle = '#ffd24a'
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
    ctx.fillStyle = i % 2 === 0 ? '#ff6fa5' : '#fff7fb'
    ctx.fillRect(i * sw, 0, sw, c.height)
  }
  ctx.fillStyle = 'rgba(65, 28, 52, 0.86)'
  ctx.fillRect(0, 12, c.width, 40)
  ctx.font = 'bold 26px system-ui, sans-serif'
  ctx.fillStyle = '#fff5fa'
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
    topiary: makeTopiaryGeo(),
    houseSolid: makeGardenHouseSolidGeo(),
    houseWin: makeGardenHouseWinGeo(),
    flowerStem: makeFlowerStemGeo(),
    flowerHead: makeFlowerHeadGeo(),
    lilyPad: new THREE.CylinderGeometry(0.32, 0.3, 0.035, 18).translate(0, 0.02, 0),
    gnome: makeGnomeGeo(),
    gardener: makeGardenerGeo(),
    bee: makeBeeGeo(),
    frog: makeFrogGeo(),
    bfBody: makeButterflyBodyGeo(),
    bfWingL: makeButterflyWingGeo(-1),
    bfWingR: makeButterflyWingGeo(1),
    gate: makeGardenGateGeo(),
    pergola: makePergolaGeo(),
    stand: makeGardenStandGeo(),
    screenPanel: new THREE.BoxGeometry(1.6, 0.24, 0.05),
    fence: makeWhiteFenceGeo(),
    lampPost: makeVictorianLampGeo(),
    lampBulb: new THREE.SphereGeometry(0.08, 12, 10),
    flag: makeFlagGeo(),
    pinwheel: makePinwheelBladeGeo(),
    petal: new THREE.SphereGeometry(0.065, 8, 6).scale(1.3, 0.35, 0.9),
    spark: new THREE.SphereGeometry(0.08, 10, 8),
    ring: new THREE.TorusGeometry(0.45, 0.045, 10, 28),
    jet: new THREE.CylinderGeometry(0.12, 0.2, 1, 14).translate(0, 0.5, 0),
    curb: new THREE.BoxGeometry(0.16, 0.11, 1.8).translate(0, 0.055, 0),
    metaStrip: new THREE.PlaneGeometry(1.18, 0.36).rotateX(-Math.PI / 2).translate(0, 0.018, 0),
    doorLeaf: new THREE.BoxGeometry(0.54, 0.92, 0.07).translate(0.27, 0.46, 0),
    bridge: new THREE.CylinderGeometry(0.12, 0.14, 1, 12).rotateX(Math.PI / 2).translate(0, 0, 0.5),
  }
  const mat = {
    terrain: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0.02, side: THREE.BackSide }),
    solid: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.58, metalness: 0.05,
      emissive: new THREE.Color('#3b2234'), emissiveIntensity: 0.24,
    }),
    critter: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.48, metalness: 0.04,
      emissive: new THREE.Color('#3d2536'), emissiveIntensity: 0.22,
    }),
    flowerHead: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.42, metalness: 0.05,
      emissive: new THREE.Color('#472038'), emissiveIntensity: 0.25,
    }),
    wing: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.38, metalness: 0.05,
      emissive: new THREE.Color('#4d2440'), emissiveIntensity: 0.28, side: THREE.DoubleSide,
    }),
    lily: new THREE.MeshStandardMaterial({ color: '#38a856', roughness: 0.55, emissive: '#1b4a26', emissiveIntensity: 0.2 }),
    glowWarm: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd1e8').multiplyScalar(1.35), toneMapped: false }),
    winGlow: new THREE.MeshBasicMaterial({ vertexColors: true, color: new THREE.Color('#ffffff').multiplyScalar(1.32), toneMapped: false }),
    petalGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.38), toneMapped: false }),
    screenLed: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffffff').multiplyScalar(1.32), toneMapped: false }),
    meta: new THREE.MeshBasicMaterial({ map: makeCheckeredTex(), side: THREE.DoubleSide }),
    curbFast: new THREE.MeshStandardMaterial({ map: makeCurbTex('JARDÍN REAL GP · VELOZ'), roughness: 0.55 }),
    curbSlow: new THREE.MeshStandardMaterial({ map: makeCurbTex('ESTANQUE REAL · CALMA'), roughness: 0.55 }),
    curbMain: new THREE.MeshStandardMaterial({ map: makeCurbTex('CAMINO DEL JARDÍN'), roughness: 0.55 }),
    waterGlow: new THREE.MeshBasicMaterial({
      color: new THREE.Color('#ffffff').multiplyScalar(1.3), transparent: true, opacity: 0.72, toneMapped: false,
    }),
    flag: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }),
    swBridge: new THREE.MeshStandardMaterial({ color: '#f8e6f0', roughness: 0.55, emissive: '#6e3456', emissiveIntensity: 0.22 }),
    swGlow: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ff9ccf').multiplyScalar(1.42), toneMapped: false }),
  }
  markShared(Object.values(geo))
  markShared(Object.values(mat))
  CACHE = { geo, mat }
  return CACHE
}

const ESTILO_JARDIN = { color: '#fff7fb', bg: 'rgba(70,40,58,0.9)', border: '#ff9ccf', subColor: '#b9f6a0' }

// ═══════════════════════════ TERRENO Y CIELO INTERIOR ═══════════════════════════
function JardinTerrainAndSky({ way, detail }) {
  const { mat } = getAssets()
  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, side: THREE.FrontSide, transparent: true, opacity: 0.05, depthWrite: false,
  }), [])
  const meshes = useMemo(() => {
    const out = []
    for (const seg of way.segments) {
      if (seg.air) continue
      const isWater = seg.kind === 'cascada' || seg.kind === 'pantano'
      const isGoal = seg.kind === 'llegada'
      const colors = isWater ? ['#1e6873', '#75ece2']
        : isGoal ? ['#2f7a3e', '#ffd485']
        : ['#286b34', '#74d168']
      const terrain = buildTerrainGeo(seg, {
        arc: TERRAIN_ARC,
        maxH: terrainMaxH(seg),
        colors,
        height: (u, a) => terrainHeightFn(seg, u, a),
      })
      const sky = buildSkyGeo(seg, {
        colors: isWater ? ['#1f4d52', '#4ea8b8'] : ['#243f2d', '#6b4570'],
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

// ═══════════════════════════ FLORES QUE SE ABREN AL PASO ═══════════════════════════
function BloomingFlowers({ way, items }) {
  const { geo, mat } = getAssets()
  const stemMesh = useMemo(() => new THREE.InstancedMesh(geo.flowerStem, mat.solid, Math.max(1, items.length)), [geo, mat, items.length])
  const headMesh = useMemo(() => new THREE.InstancedMesh(geo.flowerHead, mat.flowerHead, Math.max(1, items.length)), [geo, mat, items.length])
  const state = useMemo(() => items.map((it) => ({ ...it, bloom: 0.25, col: new THREE.Color(it.color) })), [items])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), p: new THREE.Vector3() }), [])

  useEffect(() => {
    stemMesh.count = state.length; headMesh.count = state.length
    for (let i = 0; i < state.length; i++) {
      headMesh.setColorAt(i, state[i].col)
      tmp.s.setScalar(state[i].scale)
      tmp.m.compose(state[i].pos, state[i].quat, tmp.s)
      stemMesh.setMatrixAt(i, tmp.m)
    }
    if (headMesh.instanceColor) headMesh.instanceColor.needsUpdate = true
    stemMesh.instanceMatrix.needsUpdate = true
    return () => { stemMesh.dispose(); headMesh.dispose() }
  }, [stemMesh, headMesh, state, tmp])

  useFrame(({ clock }, dt) => {
    if (!state.length || !headMesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < state.length; i++) {
      const f = state[i]
      let near = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || b.seg?.way !== way) continue
        const d2 = f.pos.distanceToSquared(b.pos)
        if (d2 < 12.25) near = Math.max(near, 1 - Math.sqrt(d2) / 3.5)
      }
      f.bloom = THREE.MathUtils.damp(f.bloom, 0.28 + near * 0.92, near > f.bloom ? 10 : 2.2, h)
      const sway = Math.sin(t * 2 + f.rnd * 8) * 0.06
      tmp.p.copy(f.pos).addScaledVector(f.up, 0.4 * f.scale)
      tmp.s.set(f.scale * (0.55 + f.bloom * 0.85 + sway), f.scale * (0.75 + f.bloom * 0.35), f.scale * (0.55 + f.bloom * 0.85))
      tmp.m.compose(tmp.p, f.quat, tmp.s)
      headMesh.setMatrixAt(i, tmp.m)
    }
    headMesh.instanceMatrix.needsUpdate = true
  })

  if (!items.length) return null
  return (
    <group>
      <primitive object={stemMesh} />
      <primitive object={headMesh} />
    </group>
  )
}

// ═══════════════════════════ RANAS CHIBI EN ESTANQUES DE NENÚFARES ═══════════════════════════
function FrogsOnLilyPads({ way, items }) {
  const { geo, mat } = getAssets()
  const padMesh = useMemo(() => new THREE.InstancedMesh(geo.lilyPad, mat.lily, Math.max(1, items.length)), [geo, mat, items.length])
  const frogMesh = useMemo(() => new THREE.InstancedMesh(geo.frog, mat.critter, Math.max(1, items.length)), [geo, mat, items.length])
  const state = useMemo(() => items.map((it) => ({ ...it, jump: 0 })), [items])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3() }), [])

  useEffect(() => {
    padMesh.count = state.length; frogMesh.count = state.length
    for (let i = 0; i < state.length; i++) {
      tmp.s.setScalar(state[i].scale * 1.15)
      tmp.m.compose(state[i].pos, state[i].quat, tmp.s)
      padMesh.setMatrixAt(i, tmp.m)
    }
    padMesh.instanceMatrix.needsUpdate = true
    return () => { padMesh.dispose(); frogMesh.dispose() }
  }, [padMesh, frogMesh, state, tmp])

  useFrame(({ clock }, dt) => {
    if (!state.length || !frogMesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < state.length; i++) {
      const f = state[i]
      let near = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || b.seg?.way !== way) continue
        const d2 = f.pos.distanceToSquared(b.pos)
        if (d2 < 16) near = Math.max(near, 1 - Math.sqrt(d2) / 4)
      }
      f.jump = THREE.MathUtils.damp(f.jump, near, near > f.jump ? 10 : 3, h)
      const hop = Math.abs(Math.sin(t * (2.5 + f.jump * 6) + f.rnd * 9)) * (0.04 + f.jump * 0.24)
      tmp.p.copy(f.pos).addScaledVector(f.up, 0.04 + hop)
      tmp.s.setScalar(f.scale * 0.72)
      tmp.m.compose(tmp.p, f.quat, tmp.s)
      frogMesh.setMatrixAt(i, tmp.m)
    }
    frogMesh.instanceMatrix.needsUpdate = true
  })

  if (!items.length) return null
  return (
    <group>
      <primitive object={padMesh} />
      <primitive object={frogMesh} />
    </group>
  )
}

// ═══════════════════════════ MARIPOSAS CHIBI ALETEANTES ═══════════════════════════
function Butterflies({ way, count = 48 }) {
  const { geo, mat } = getAssets()
  const path = useMemo(() => segPath(way.segments.filter((s) => !s.air)), [way])
  const bodyMesh = useMemo(() => new THREE.InstancedMesh(geo.bfBody, mat.critter, count), [geo, mat, count])
  const wingLMesh = useMemo(() => new THREE.InstancedMesh(geo.bfWingL, mat.wing, count), [geo, mat, count])
  const wingRMesh = useMemo(() => new THREE.InstancedMesh(geo.bfWingR, mat.wing, count), [geo, mat, count])
  const state = useMemo(() => {
    const rng = mulberry32(way.idx * 743 + 19)
    const cols = ['#ff78b8', '#78e0ff', '#ffd24a', '#c48aff', '#ff9e6d']
    return Array.from({ length: count }, () => ({
      s: rng() * (path.total || 1),
      dir: rng() > 0.5 ? 1 : -1,
      speed: 0.7 + rng() * 0.85,
      angle: (rng() - 0.5) * Math.PI * 1.15,
      offK: 0.14 + rng() * 0.34,
      ph: rng() * TAU,
      sc: 0.58 + rng() * 0.36,
      col: new THREE.Color(cols[Math.floor(rng() * cols.length)]),
    }))
  }, [way.idx, count, path])
  const tmp = useMemo(() => ({
    loc: {}, pl: makePlacement(), m: new THREE.Matrix4(), s: new THREE.Vector3(),
    q: new THREE.Quaternion(), qWing: new THREE.Quaternion(), qFlap: new THREE.Quaternion(),
    c: new THREE.Color(), bCol: new THREE.Color(),
    flip: new THREE.Quaternion().setFromAxisAngle(Y, Math.PI),
  }), [])

  useEffect(() => {
    for (let i = 0; i < count; i++) {
      wingLMesh.setColorAt(i, state[i].col)
      wingRMesh.setColorAt(i, state[i].col)
    }
    if (wingLMesh.instanceColor) wingLMesh.instanceColor.needsUpdate = true
    if (wingRMesh.instanceColor) wingRMesh.instanceColor.needsUpdate = true
    return () => { bodyMesh.dispose(); wingLMesh.dispose(); wingRMesh.dispose() }
  }, [bodyMesh, wingLMesh, wingRMesh, state, count])

  useFrame(({ clock }, dt) => {
    if (!path.total || !bodyMesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()
    let focusBoll = null
    for (let k = 0; k < bolls.length; k++) {
      const b = bolls[k]
      if (b.phase === 'travel' && b.seg?.way === way) { focusBoll = b; break }
    }
    if (focusBoll) tmp.bCol.setHSL(focusBoll.genome.hue, 0.85, 0.68)

    for (let i = 0; i < count; i++) {
      const bf = state[i]
      bf.s += bf.dir * bf.speed * h
      if (bf.s > path.total) { bf.s = path.total; bf.dir = -1 }
      if (bf.s < 0) { bf.s = 0; bf.dir = 1 }
      path.locate(bf.s, tmp.loc)
      const seg = tmp.loc.seg
      const ang = bf.angle + Math.sin(t * 1.4 + bf.ph) * 0.32
      const off = (seg ? seg.radius : 2.6) * bf.offK + Math.sin(t * 2.8 + bf.ph) * 0.14
      placeAlongInto(seg, tmp.loc.u, off, ang, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (bf.dir < 0) tmp.q.multiply(tmp.flip)
      tmp.s.setScalar(bf.sc)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.s)
      bodyMesh.setMatrixAt(i, tmp.m)

      const flap = Math.sin(t * 14 + bf.ph) * 0.78
      tmp.qFlap.setFromAxisAngle(Z, flap)
      tmp.qWing.copy(tmp.q).multiply(tmp.qFlap)
      tmp.m.compose(tmp.pl.pos, tmp.qWing, tmp.s)
      wingLMesh.setMatrixAt(i, tmp.m)

      tmp.qFlap.setFromAxisAngle(Z, -flap)
      tmp.qWing.copy(tmp.q).multiply(tmp.qFlap)
      tmp.m.compose(tmp.pl.pos, tmp.qWing, tmp.s)
      wingRMesh.setMatrixAt(i, tmp.m)

      tmp.c.copy(bf.col)
      if (focusBoll && tmp.pl.pos.distanceToSquared(focusBoll.pos) < 30) tmp.c.lerp(tmp.bCol, 0.55)
      wingLMesh.setColorAt(i, tmp.c)
      wingRMesh.setColorAt(i, tmp.c)
    }
    bodyMesh.instanceMatrix.needsUpdate = true
    wingLMesh.instanceMatrix.needsUpdate = true
    wingRMesh.instanceMatrix.needsUpdate = true
    if (wingLMesh.instanceColor) wingLMesh.instanceColor.needsUpdate = true
    if (wingRMesh.instanceColor) wingRMesh.instanceColor.needsUpdate = true
  })

  return (
    <group>
      <primitive object={bodyMesh} />
      <primitive object={wingLMesh} />
      <primitive object={wingRMesh} />
    </group>
  )
}

// ═══════════════════════════ PÉTALOS LUMINOSOS EN ESPIRAL ═══════════════════════════
function PetalSwarm({ way, count = 260 }) {
  const { geo, mat } = getAssets()
  const path = useMemo(() => segPath(way.segments.filter((s) => !s.air)), [way])
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.petal, mat.petalGlow, count), [geo, mat, count])
  const state = useMemo(() => {
    const rng = mulberry32(way.idx * 617 + 43)
    const cols = ['#ffc2df', '#ffe680', '#e3b8ff', '#a5f5d6']
    return Array.from({ length: count }, () => ({
      s: rng() * (path.total || 1),
      speed: 0.55 + rng() * 1.45,
      angle: (rng() - 0.5) * Math.PI * 1.65,
      offK: 0.2 + rng() * 0.55,
      ph: rng() * TAU,
      sc: 0.65 + rng() * 0.85,
      baseCol: new THREE.Color(cols[Math.floor(rng() * cols.length)]),
    }))
  }, [way.idx, count, path])
  const tmp = useMemo(() => ({
    loc: {}, pl: makePlacement(), m: new THREE.Matrix4(), s: new THREE.Vector3(),
    q: new THREE.Quaternion(), e: new THREE.Euler(), c: new THREE.Color(), bCol: new THREE.Color(),
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
    if (focusBoll) tmp.bCol.setHSL(focusBoll.genome.hue, 0.88, 0.72)

    for (let i = 0; i < count; i++) {
      const p = state[i]
      path.locate(p.s, tmp.loc)
      const seg = tmp.loc.seg
      const sk = seg ? (seg.speedK ?? 1) : 1
      p.s = (p.s + p.speed * sk * h) % path.total
      const ang = p.angle + Math.sin(t * 1.1 + p.ph) * 0.55
      const off = (seg ? seg.radius : 2.6) * p.offK + Math.cos(t * 1.8 + p.ph) * 0.18
      placeAlongInto(seg, tmp.loc.u, off, ang, tmp.pl)
      tmp.e.set(t * 1.5 + p.ph, t * 2.1, p.ph)
      tmp.q.setFromEuler(tmp.e)
      tmp.s.setScalar(p.sc)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
      tmp.c.copy(p.baseCol)
      if (focusBoll && tmp.pl.pos.distanceToSquared(focusBoll.pos) < 34) tmp.c.lerp(tmp.bCol, 0.65)
      mesh.setColorAt(i, tmp.c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })

  return <primitive object={mesh} />
}

// ═══════════════════════════ ESPECTADORES Y PANTALLAS DE TRIBUNA ═══════════════════════════
function GardenSpectators({ way, items, screens }) {
  const { geo, mat } = getAssets()
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.gnome, mat.critter, Math.max(1, items.length)), [geo, mat, items.length])
  const screenMesh = useMemo(() => new THREE.InstancedMesh(geo.screenPanel, mat.screenLed, Math.max(1, screens.length)), [geo, mat, screens.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), bCol: new THREE.Color('#ff85b3') }), [])

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
    if (activeBoll) tmp.bCol.setHSL(activeBoll.genome.hue, 0.88, 0.65)

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
      else tmp.c.set('#ff85b3').multiplyScalar(pulse * 0.8)
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
// Ruta A (Rápida) Mitad 1: Pérgolas Triunfales que Florecen en Cadena
function EventBloomingPergolas({ segment, stage }) {
  const { geo, mat } = getAssets()
  const pergolas = useMemo(() => {
    const us = segment.air ? [0.06, 0.94] : [0.14, 0.28, 0.42, 0.56, 0.7, 0.84]
    return us.map((u) => {
      const pl = placeAlong(segment, u, 0, 0)
      return { u, pl, topPos: pl.pos.clone().addScaledVector(pl.up, 1.28) }
    })
  }, [segment])
  const crownMesh = useMemo(() => new THREE.InstancedMesh(geo.flowerHead, mat.flowerHead, pergolas.length), [geo, mat, pergolas.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), c: new THREE.Color() }), [])
  useEffect(() => () => crownMesh.dispose(), [crownMesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < pergolas.length; i++) {
      const pg = pergolas[i]
      const wave = stage.phase === 'climax' ? Math.max(0, 1 - Math.abs(stage.k - pg.u) * 3.8) : stage.intensity * 0.35
      const sc = 1.2 + wave * 1.45 + Math.sin(t * 4 + i) * 0.08
      tmp.s.setScalar(sc)
      tmp.m.compose(pg.topPos, pg.pl.quat, tmp.s)
      crownMesh.setMatrixAt(i, tmp.m)
      tmp.c.setHSL(0.9 + wave * 0.08, 0.9, 0.65 + wave * 0.2)
      crownMesh.setColorAt(i, tmp.c)
    }
    crownMesh.instanceMatrix.needsUpdate = true
    if (crownMesh.instanceColor) crownMesh.instanceColor.needsUpdate = true
  })

  return (
    <group>
      {pergolas.map((pg, i) => (
        <mesh key={i} geometry={geo.pergola} material={mat.solid} position={pg.pl.pos} quaternion={pg.pl.quat} />
      ))}
      <primitive object={crownMesh} />
    </group>
  )
}

// Ruta A (Rápida) Mitad 2: Carrusel de Molinetes Turbo Pastel
function EventTurboPinwheels({ segment, stage }) {
  const { geo, mat } = getAssets()
  const wheels = useMemo(() => Array.from({ length: 8 }, (_, i) => {
    const u = 0.1 + (i / 7) * 0.8
    const side = i % 2 === 0 ? 1 : -1
    const pl = placeAlong(segment, u, 0.48, side * 0.56)
    const q = pl.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, side * Math.PI * 0.5))
    return { u, pos: pl.pos, q, dir: side }
  }), [segment])
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.pinwheel, mat.solid, wheels.length), [geo, mat, wheels.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), q: new THREE.Quaternion(), spin: new THREE.Quaternion() }), [])
  useEffect(() => () => mesh.dispose(), [mesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const speed = 1.8 + stage.intensity * 6.5
    for (let i = 0; i < wheels.length; i++) {
      const w = wheels[i]
      tmp.spin.setFromAxisAngle(Z, t * speed * w.dir + i)
      tmp.q.copy(w.q).multiply(tmp.spin)
      tmp.s.setScalar(1.0 + stage.intensity * 0.28)
      tmp.m.compose(w.pos, tmp.q, tmp.s)
      mesh.setMatrixAt(i, tmp.m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}

// Ruta B (Lenta) Mitad 1 / Géiser aéreo: Fuente Musical Visual del Estanque Real
function EventMusicalFountain({ segment, stage }) {
  const { geo, mat } = getAssets()
  const jets = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const u = segment.air ? (i < 6 ? 0.04 + i * 0.015 : 0.9 - (i - 6) * 0.015) : (0.12 + (i / 11) * 0.76)
    const side = (i % 2 === 0 ? 1 : -1) * (segment.air ? 0.62 : 0.44)
    const pl = placeAlong(segment, u, 0, side)
    return { u, pl, i }
  }), [segment])
  const jetMesh = useMemo(() => new THREE.InstancedMesh(geo.jet, mat.waterGlow, jets.length), [geo, mat, jets.length])
  const ringMesh = useMemo(() => new THREE.InstancedMesh(geo.ring, mat.swGlow, jets.length), [geo, mat, jets.length])
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), q: new THREE.Quaternion(), rot: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2), c: new THREE.Color() }), [])
  useEffect(() => () => { jetMesh.dispose(); ringMesh.dispose() }, [jetMesh, ringMesh])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < jets.length; i++) {
      const j = jets[i]
      const note = 0.5 + 0.5 * Math.sin(t * (2.6 + stage.intensity * 3.8) - j.i * 0.75)
      const hScale = (0.35 + note * 0.95) * (0.45 + stage.intensity * 0.85)
      tmp.s.set(0.85, hScale * 1.15, 0.85)
      tmp.m.compose(j.pl.pos, j.pl.quat, tmp.s)
      jetMesh.setMatrixAt(i, tmp.m)
      tmp.c.setHSL((0.48 + note * 0.35) % 1, 0.9, 0.66)
      jetMesh.setColorAt(i, tmp.c)

      tmp.q.copy(j.pl.quat).multiply(tmp.rot)
      tmp.s.setScalar(0.55 + note * 0.45)
      tmp.m.compose(j.pl.pos, tmp.q, tmp.s)
      ringMesh.setMatrixAt(i, tmp.m)
    }
    jetMesh.instanceMatrix.needsUpdate = true
    if (jetMesh.instanceColor) jetMesh.instanceColor.needsUpdate = true
    ringMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <primitive object={jetMesh} />
      <primitive object={ringMesh} />
    </group>
  )
}

// Ruta B (Lenta) Mitad 2: Invernadero Encantado con Puertas Florales que se Abren
function EventConservatoryDoors({ segment, stage }) {
  const { geo, mat } = getAssets()
  const leftRef = useRef(); const rightRef = useRef()
  const data = useMemo(() => {
    const pDoor = placeAlong(segment, 0.28, 0, 0)
    const arches = [0.28, 0.52, 0.76].map((u) => placeAlong(segment, u, 0, 0))
    return { pDoor, arches }
  }, [segment])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const open = stage.phase === 'climax' || stage.phase === 'salida' ? 1.42
      : stage.phase === 'teaser' ? 1.05 + 0.2 * Math.sin(t * 6)
      : 0.78
    if (leftRef.current) leftRef.current.rotation.y = -open
    if (rightRef.current) rightRef.current.rotation.y = open
  })

  return (
    <group>
      {data.arches.map((p, i) => (
        <mesh key={i} geometry={geo.gate} material={mat.solid} position={p.pos} quaternion={p.quat} scale={0.92} />
      ))}
      <group position={data.pDoor.pos} quaternion={data.pDoor.quat}>
        <mesh ref={leftRef} geometry={geo.doorLeaf} material={mat.swBridge} position={[-0.78, 0, 0]} />
        <mesh ref={rightRef} geometry={geo.doorLeaf} material={mat.swBridge} position={[0.78, 0, 0]} scale={[-1, 1, 1]} />
      </group>
    </group>
  )
}

// Llegada: Fuegos Artificiales Florales y Pastel al cruzar la meta
function EventGoalFireworks({ segment, stage }) {
  const { geo, mat } = getAssets()
  const count = 36
  const mesh = useMemo(() => new THREE.InstancedMesh(geo.spark, mat.petalGlow, count), [geo, mat])
  const burst = useMemo(() => {
    const rng = mulberry32(segment.i * 419 + 55)
    const cols = ['#ff78b8', '#ffd24a', '#78e0ff', '#b9f6a0']
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
          const headPos = f0.pos.clone().addScaledVector(f0.up, 0.85).addScaledVector(f0.side, 0.92)
          list.push({ seg, u: sw.u, kind: sw.kind || 'rampa', f0, f1, len, qBridge, qFrom, qTo, qHead, headPos, hasBridge: sw.from !== sw.to })
        }
      } else if (seg.kind === 'rampa' || seg.kind === 'cascada' || seg.kind === 'espiral' || seg.kind === 'pantano') {
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
        const headPos = f0.pos.clone().addScaledVector(f0.up, 0.85).addScaledVector(f0.side, 0.92)
        list.push({ seg, u: 0.5, kind: seg.kind, f0, f1, len, qBridge, qFrom, qTo, qHead, headPos, hasBridge: false })
      }
    }
    return list
  }, [way])

  const pinRefs = useRef([])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < switches.length; i++) {
      const m = pinRefs.current[i]
      if (!m) continue
      const sw = switches[i]
      let boost = 1
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === sw.seg && Math.abs((b.segT ?? 0) - sw.u) < 0.22) {
          boost = 3.2; break
        }
      }
      m.rotation.z = t * 2.4 * boost
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
            <mesh ref={(el) => { pinRefs.current[i] = el }} geometry={geo.pinwheel} material={mat.solid} scale={0.65} />
          </group>
        </group>
      ))}
    </group>
  )
}

// ═══════════════════════════ CRIATURAS SOBRE TERRENO ═══════════════════════════
function TerrainCritter({ way, segments = null, count = 12, geo, mat, scale = 0.32, speed = 0.6, offset = 0, angle = 0.58, spread = 0.14, hop = 0.24, seed = 1 }) {
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
      const ground = terrainOffset(seg, tmp.loc.u, a) + offset
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

// ═══════════════════════════ COMPONENTE PRINCIPAL DEL TEMA JARDÍN ═══════════════════════════
export default function Vida({ way, detail }) {
  const { geo, mat } = getAssets()
  const fineRef = useRef()
  const info = useMemo(() => routeInfo(way), [way])

  const layout = useMemo(() => {
    const rng = mulberry32(way.idx * 9001 + 211)
    const solidSegs = way.segments.filter((s) => !s.air)
    const villageSegs = solidSegs.filter((s) => s.kind === 'salida')
    const pondSegs = solidSegs.filter((s) => s.kind === 'pantano' || s.kind === 'cascada' || s.route === 1)

    const topiaries = scatterOnTerrain(way, 110, rng, { angle: [-Math.PI * 0.5, Math.PI * 0.5], clear: BALL_R * 1.4, scale: [0.52, 0.88] })
    const houses = scatterOnTerrain(way, 24, rng, {
      segments: villageSegs.length ? villageSegs : solidSegs,
      angle: [-Math.PI * 0.48, Math.PI * 0.48], clear: BALL_R * 1.5, scale: [0.65, 0.88],
    })
    const flowerCols = ['#ff6fa5', '#ffd24a', '#b06bff', '#ff8a5c', '#7de2ff']
    const flowers = scatterOnTerrain(way, 160, rng, { angle: [-Math.PI * 0.5, Math.PI * 0.5], clear: BALL_R * 1.25, scale: [0.44, 0.8] })
      .map((it) => ({ ...it, color: flowerCols[Math.floor(it.rnd * flowerCols.length)] }))
    const lilyFrogs = scatterOnTerrain(way, 32, rng, {
      segments: pondSegs.length ? pondSegs : solidSegs,
      angle: [-Math.PI * 0.48, Math.PI * 0.48], clear: BALL_R * 1.35, scale: [0.5, 0.72],
    })

    const lanterns = []; const lanternBulbs = []; const fences = []
    const stands = []; const screens = []; const spectators = []; const flags = []
    const gates = []; const pergolas = []; const curbsFast = []; const curbsSlow = []; const curbsMain = []
    const metaLines = []; const heroSigns = []
    const bannerCols = ['#ff6fa5', '#ffd24a', '#a5d6a7']
    const flipY = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)

    for (const seg of solidSegs) {
      const rt = info.routes.find((r) => r.r === seg.route)
      const isFast = rt?.profile?.speed === 'rapida' || seg.speedK >= 1.15
      const isSlow = rt?.profile?.speed === 'lenta' || seg.speedK <= 0.85

      if (seg.kind === 'salida') {
        const pg = placeAlong(seg, 0.08, 0, 0)
        gates.push({ pos: pg.pos, quat: pg.quat, scale: 0.96 })
        heroSigns.push({
          key: `in-${seg.i}`, text: 'JARDÍN · BIENVENIDOS', sub: `${way.theme.emoji} Paseo Real Floral`,
          pos: pg.pos.clone().addScaledVector(pg.up, 1.48), quat: pg.quat.clone().multiply(flipY),
        })
      }
      if (seg.event) {
        metaLines.push(placeAlong(seg, 0.04, 0, 0), placeAlong(seg, 0.96, 0, 0))
      }
      if (seg.kind === 'llegada') {
        const pg = placeAlong(seg, 0.86, 0, 0)
        gates.push({ pos: pg.pos, quat: pg.quat, scale: 1.0 })
        metaLines.push(pg)
        heroSigns.push({
          key: `goal-${seg.i}`, text: '🏁 ¡META DEL JARDÍN!', sub: 'Gran Cenador Real',
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

        if (i % 5 === 2 && !seg.event) {
          const pp = placeAlong(seg, u, 0, 0)
          pergolas.push({ pos: pp.pos, quat: pp.quat, scale: 0.92 })
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
          const mode = si.seg.air ? 'B1'
            : rt.r === 0 ? (evIdx % 2 === 0 ? 'A1' : 'A2')
            : rt.r === 1 ? (evIdx % 2 === 0 ? 'B1' : 'B2')
            : (evIdx % 2 === 0 ? 'A2' : 'B1')
          eventStages.push({ seg: si.seg, mode })
          evIdx++
        }
      }
    }

    return {
      topiaries, houses, flowers, lilyFrogs, lanterns, lanternBulbs,
      fences, stands, screens, spectators, flags, gates, pergolas,
      curbsFast, curbsSlow, curbsMain, metaLines, heroSigns, eventStages,
    }
  }, [way, info])

  useFrame(() => {
    const det = detail?.value ?? 1
    if (fineRef.current) fineRef.current.visible = det > 0.18
  })

  const gardenSegs = useMemo(() => way.segments.filter((s) => !s.air && s.route >= 0), [way])
  const allSolidSegs = useMemo(() => way.segments.filter((s) => !s.air), [way])

  return (
    <group name="vida-jardin">
      <JardinTerrainAndSky way={way} detail={detail} />

      <Instanced geo={geo.topiary} mat={mat.solid} items={layout.topiaries} />
      <Instanced geo={geo.houseSolid} mat={mat.solid} items={layout.houses} />
      <Instanced geo={geo.houseWin} mat={mat.winGlow} items={layout.houses} />
      <Instanced geo={geo.lampBulb} mat={mat.glowWarm} items={layout.lanternBulbs} />
      <Instanced geo={geo.gate} mat={mat.solid} items={layout.gates} />
      <Instanced geo={geo.pergola} mat={mat.solid} items={layout.pergolas} />
      <PetalSwarm way={way} count={110} />

      <LaneSwitchMechanisms way={way} />

      <group ref={fineRef}>
        <Instanced geo={geo.lampPost} mat={mat.solid} items={layout.lanterns} />
        <Instanced geo={geo.fence} mat={mat.solid} items={layout.fences} />
        <Instanced geo={geo.stand} mat={mat.solid} items={layout.stands} />
        <Instanced geo={geo.flag} mat={mat.flag} items={layout.flags} />
        <Instanced geo={geo.curb} mat={mat.curbFast} items={layout.curbsFast} />
        <Instanced geo={geo.curb} mat={mat.curbSlow} items={layout.curbsSlow} />
        <Instanced geo={geo.curb} mat={mat.curbMain} items={layout.curbsMain} />
        <Instanced geo={geo.metaStrip} mat={mat.meta} items={layout.metaLines} />

        <BloomingFlowers way={way} items={layout.flowers} />
        <FrogsOnLilyPads way={way} items={layout.lilyFrogs} />
        <GardenSpectators way={way} items={layout.spectators} screens={layout.screens} />
        <Butterflies way={way} count={24} />

        <TerrainCritter way={way} segments={gardenSegs.length ? gardenSegs : null} count={10} geo={geo.gnome} mat={mat.critter} scale={0.32} speed={0.55} angle={-0.58} spread={0.14} hop={0.26} seed={17} />
        <TerrainCritter way={way} segments={allSolidSegs} count={10} geo={geo.gardener} mat={mat.critter} scale={0.33} speed={0.62} angle={0.58} spread={0.14} hop={0.28} seed={31} />
        <TerrainCritter way={way} segments={allSolidSegs} count={14} geo={geo.bee} mat={mat.critter} scale={0.24} speed={1.2} offset={0.35} angle={0.65} spread={0.34} hop={0.22} seed={47} />

        {layout.heroSigns.map((hs) => (
          <Billboard key={hs.key} text={hs.text} style={{ ...ESTILO_JARDIN, sub: hs.sub }} height={0.38} position={hs.pos} quat={hs.quat} />
        ))}
        <CartelesDeRuta way={way} style={ESTILO_JARDIN} angle={0.78} u={0.12} poleColor="#5b4636" />
      </group>

      {layout.eventStages.map((ev) => (
        <EventStage
          key={ev.seg.i}
          segment={ev.seg}
          render={(stage) => {
            if (ev.mode === 'A1') return <EventBloomingPergolas segment={ev.seg} stage={stage} />
            if (ev.mode === 'A2') return <EventTurboPinwheels segment={ev.seg} stage={stage} />
            if (ev.mode === 'B1') return <EventMusicalFountain segment={ev.seg} stage={stage} />
            if (ev.mode === 'B2') return <EventConservatoryDoors segment={ev.seg} stage={stage} />
            return <EventGoalFireworks segment={ev.seg} stage={stage} />
          }}
        />
      ))}

      <Soundless />
    </group>
  )
}
