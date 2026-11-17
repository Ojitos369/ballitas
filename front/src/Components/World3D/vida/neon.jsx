// Vida del Camino Neón: diorama/terrario cibernético dentro del tubo de cristal (contrato en README.md).
// Todo vive dentro de seg.radius; estadio cyber, robots y drones chibi, trenes de luz, taxis voladores, DJ y mecanismos.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  BALL_R, Billboard, CartelesDeRuta, EventStage, Instanced,
  Soundless, TAU, buildSkyGeo, buildTerrainGeo, getBallitas, laneFrame, laneGap,
  makePlacement, markShared, mulberry32, placeAlong, placeAlongInto, routeInfo,
  scatter, segFrames, segPath, sampleFrameInto, makeFrame, switchesOf, useInstanced,
} from './base.jsx'

const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const FLIP_Y = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)
const IDENT_Q = new THREE.Quaternion()
const ESTILO = { color: '#ffffff', bg: 'rgba(10,6,26,0.94)', border: '#ff3df2', subColor: '#2bffe8' }
const ESTILO_CYAN = { color: '#e8ffff', bg: 'rgba(8,18,36,0.94)', border: '#2bffe8', subColor: '#ffe600' }
const ESTILO_AD = { color: '#ffe600', bg: 'rgba(18,8,38,0.92)', border: '#2bffe8', subColor: '#ff3df2' }

// ═══════════════════════════ HELPERS DE GEOMETRÍA SUAVE ═══════════════════════════
function prepGeo(geo, hex, shadeTop = null) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  if (g.attributes.uv) g.deleteAttribute('uv')
  if (!g.attributes.normal) g.computeVertexNormals()
  const pos = g.attributes.position
  const col = new Float32Array(pos.count * 3)
  const c0 = new THREE.Color(hex)
  const c1 = shadeTop ? new THREE.Color(shadeTop) : c0
  const cc = new THREE.Color()
  let minY = Infinity; let maxY = -Infinity
  if (shadeTop) {
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const span = Math.max(maxY - minY, 1e-4)
  for (let i = 0; i < pos.count; i++) {
    if (shadeTop) cc.copy(c0).lerp(c1, (pos.getY(i) - minY) / span)
    else cc.copy(c0)
    col[i * 3] = cc.r; col[i * 3 + 1] = cc.g; col[i * 3 + 2] = cc.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  return g
}

function mergeParts(parts) {
  const m = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  m.computeBoundingSphere()
  return m
}

// ───────────────────────── Elenco Chibi y Vehículos Neón ─────────────────────────
function buildChibiRobotGeos() {
  // Cuerpo tintable por instanceColor (cápsula suave + cabeza redonda + antenita + bracitos + patitas)
  const torso = new THREE.CapsuleGeometry(0.28, 0.22, 4, 8).translate(0, 0.34, 0)
  const head = new THREE.SphereGeometry(0.32, 10, 8).scale(1.08, 0.94, 0.96).translate(0, 0.72, 0)
  const ant = new THREE.CylinderGeometry(0.025, 0.03, 0.18, 6).translate(0, 1.06, 0)
  const bulb = new THREE.SphereGeometry(0.065, 8, 6).translate(0, 1.17, 0)
  const armL = new THREE.CapsuleGeometry(0.08, 0.14, 4, 6).rotateZ(0.45).translate(-0.34, 0.36, 0.04)
  const armR = new THREE.CapsuleGeometry(0.08, 0.14, 4, 6).rotateZ(-0.45).translate(0.34, 0.36, 0.04)
  const footL = new THREE.SphereGeometry(0.11, 8, 6).scale(1, 0.65, 1.25).translate(-0.15, 0.06, 0.05)
  const footR = new THREE.SphereGeometry(0.11, 8, 6).scale(1, 0.65, 1.25).translate(0.15, 0.06, 0.05)
  const body = mergeParts([
    prepGeo(torso, '#d8e4ff', '#ffffff'),
    prepGeo(head, '#eef4ff', '#ffffff'),
    prepGeo(ant, '#a8b8e0'),
    prepGeo(bulb, '#ffffff'),
    prepGeo(armL, '#ffffff'), prepGeo(armR, '#ffffff'),
    prepGeo(footL, '#a8b8e0'), prepGeo(footR, '#a8b8e0'),
  ])

  // Visor LED oscuro + ojos felices cian/brillantes + mejillas neón
  const visor = new THREE.SphereGeometry(0.26, 16, 12).scale(1.12, 0.68, 0.52).translate(0, 0.73, 0.19)
  const eyeL = new THREE.SphereGeometry(0.055, 10, 8).translate(-0.11, 0.75, 0.32)
  const eyeR = new THREE.SphereGeometry(0.055, 10, 8).translate(0.11, 0.75, 0.32)
  const core = new THREE.SphereGeometry(0.09, 10, 8).scale(1, 1, 0.45).translate(0, 0.38, 0.25)
  const face = mergeParts([
    prepGeo(visor, '#0e1326'),
    prepGeo(eyeL, '#2bffe8'), prepGeo(eyeR, '#2bffe8'),
    prepGeo(core, '#ff3df2'),
  ])
  return { body, face }
}

function buildChibiDroneGeos() {
  const hull = new THREE.SphereGeometry(0.28, 16, 12).scale(1.12, 0.88, 1.12)
  const rim = new THREE.TorusGeometry(0.36, 0.045, 10, 22).rotateX(Math.PI * 0.5)
  const lens = new THREE.SphereGeometry(0.11, 12, 10).scale(1, 1, 0.55).translate(0, 0.02, 0.25)
  const body = mergeParts([
    prepGeo(hull, '#212b4d', '#3a4a7a'),
    prepGeo(rim, '#2bffe8'),
    prepGeo(lens, '#ffe600'),
  ])
  const blade1 = new THREE.CapsuleGeometry(0.03, 0.48, 6, 8).rotateZ(Math.PI * 0.5).translate(0, 0.28, 0)
  const blade2 = new THREE.CapsuleGeometry(0.03, 0.48, 6, 8).rotateX(Math.PI * 0.5).translate(0, 0.28, 0)
  const rotor = mergeParts([prepGeo(blade1, '#ff3df2'), prepGeo(blade2, '#2bffe8')])
  return { body, rotor }
}

function buildLightTrainGeo() {
  const car = new THREE.CapsuleGeometry(0.18, 0.95, 8, 14).rotateX(Math.PI * 0.5)
  const stripe = new THREE.CapsuleGeometry(0.195, 0.78, 6, 12).rotateX(Math.PI * 0.5).scale(1.02, 0.4, 1.0)
  const nose = new THREE.SphereGeometry(0.17, 12, 10).translate(0, 0, 0.52)
  return mergeParts([
    prepGeo(car, '#182240', '#2b3a6b'),
    prepGeo(stripe, '#2bffe8'),
    prepGeo(nose, '#ff3df2'),
  ])
}

function buildHoloTaxiGeo() {
  const hull = new THREE.CapsuleGeometry(0.16, 0.34, 8, 14).rotateX(Math.PI * 0.5).scale(1.2, 0.78, 1.0)
  const cabin = new THREE.SphereGeometry(0.15, 12, 10).scale(1.0, 0.65, 1.3).translate(0, 0.11, -0.02)
  const thrusterL = new THREE.CylinderGeometry(0.05, 0.06, 0.24, 10).rotateX(Math.PI * 0.5).translate(-0.22, -0.02, -0.1)
  const thrusterR = new THREE.CylinderGeometry(0.05, 0.06, 0.24, 10).rotateX(Math.PI * 0.5).translate(0.22, -0.02, -0.1)
  return mergeParts([
    prepGeo(hull, '#ffe600', '#ff9900'),
    prepGeo(cabin, '#2bffe8'),
    prepGeo(thrusterL, '#ff3df2'),
    prepGeo(thrusterR, '#ff3df2'),
  ])
}

// ───────────────────────── Props del diorama Cyber-Estadio ─────────────────────────
function buildCyberTowerGeo() {
  const base = new THREE.CylinderGeometry(0.24, 0.28, 0.52, 12).translate(0, 0.26, 0)
  const band1 = new THREE.TorusGeometry(0.245, 0.024, 8, 16).rotateX(Math.PI * 0.5).translate(0, 0.22, 0)
  const band2 = new THREE.TorusGeometry(0.235, 0.024, 8, 16).rotateX(Math.PI * 0.5).translate(0, 0.42, 0)
  const spire = new THREE.ConeGeometry(0.16, 0.24, 12).translate(0, 0.62, 0)
  return mergeParts([
    prepGeo(base, '#151c36', '#24315c'),
    prepGeo(band1, '#ffffff'),
    prepGeo(band2, '#ffffff'),
    prepGeo(spire, '#2bffe8'),
  ])
}

function buildNeonLampGeo() {
  const pole = new THREE.CylinderGeometry(0.024, 0.036, 0.58, 10).translate(0, 0.29, 0)
  const arch = new THREE.TorusGeometry(0.12, 0.02, 8, 14, Math.PI).translate(0.12, 0.56, 0)
  const bulb = new THREE.SphereGeometry(0.065, 10, 8).translate(0.23, 0.54, 0)
  return mergeParts([
    prepGeo(pole, '#1d243b', '#2b3860'),
    prepGeo(arch, '#2bffe8'),
    prepGeo(bulb, '#ffffff'),
  ])
}

function buildHoloTreeGeo() {
  const stem = new THREE.CylinderGeometry(0.04, 0.08, 0.44, 12).translate(0, 0.22, 0)
  const c1 = new THREE.SphereGeometry(0.22, 14, 12).scale(1.15, 0.72, 1.15).translate(0, 0.54, 0)
  const c2 = new THREE.SphereGeometry(0.15, 12, 10).scale(1.1, 0.75, 1.1).translate(-0.15, 0.45, 0.04)
  return mergeParts([
    prepGeo(stem, '#2b3860'),
    prepGeo(c1, '#2bffe8', '#a8fff6'),
    prepGeo(c2, '#ff66e8', '#ffb8f4'),
  ])
}

function buildBleacherGeo() {
  const s1 = new THREE.CylinderGeometry(0.20, 0.22, 1.35, 12).rotateX(Math.PI * 0.5).scale(0.45, 0.35, 1).translate(0, 0.07, 0)
  const s2 = new THREE.CylinderGeometry(0.20, 0.22, 1.35, 12).rotateX(Math.PI * 0.5).scale(0.45, 0.55, 1).translate(0.16, 0.14, 0)
  const s3 = new THREE.CylinderGeometry(0.20, 0.22, 1.35, 12).rotateX(Math.PI * 0.5).scale(0.45, 0.78, 1).translate(0.32, 0.22, 0)
  const rail = new THREE.CapsuleGeometry(0.025, 1.32, 6, 10).rotateX(Math.PI * 0.5).translate(-0.10, 0.14, 0)
  return mergeParts([
    prepGeo(s1, '#18203d', '#24315c'),
    prepGeo(s2, '#1d274a', '#2c3d70'),
    prepGeo(s3, '#222e57', '#354985'),
    prepGeo(rail, '#2bffe8'),
  ])
}

function buildBarrierGeo() {
  const pL = new THREE.CapsuleGeometry(0.024, 0.18, 6, 8).translate(0, 0.09, -0.45)
  const pR = new THREE.CapsuleGeometry(0.024, 0.18, 6, 8).translate(0, 0.09, 0.45)
  const bar = new THREE.CapsuleGeometry(0.02, 0.92, 6, 8).rotateX(Math.PI * 0.5).translate(0, 0.14, 0)
  return mergeParts([prepGeo(pL, '#222b4a'), prepGeo(pR, '#222b4a'), prepGeo(bar, '#ffffff')])
}

function buildFlagGeo() {
  const pole = new THREE.CylinderGeometry(0.018, 0.024, 0.50, 8).translate(0, 0.25, 0)
  const flag = new THREE.ConeGeometry(0.12, 0.26, 10).rotateZ(-Math.PI * 0.5).scale(1, 0.72, 0.22).translate(0.13, 0.42, 0)
  return mergeParts([prepGeo(pole, '#2a355c'), prepGeo(flag, '#ffffff')])
}

function buildDjBoothGeo() {
  const desk = new THREE.CylinderGeometry(0.34, 0.38, 0.28, 16, 1, false, -Math.PI * 0.5, Math.PI).translate(0, 0.14, 0)
  const deckL = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14).translate(-0.14, 0.30, 0.05)
  const deckR = new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14).translate(0.14, 0.30, 0.05)
  return mergeParts([
    prepGeo(desk, '#1a1536', '#ff3df2'),
    prepGeo(deckL, '#2bffe8'),
    prepGeo(deckR, '#ffe600'),
  ])
}

let G_CACHE = null
function getGeos() {
  if (G_CACHE) return G_CACHE
  const robot = buildChibiRobotGeos()
  const drone = buildChibiDroneGeos()
  G_CACHE = markShared({
    robotBody: robot.body, robotFace: robot.face,
    droneBody: drone.body, droneRotor: drone.rotor,
    train: buildLightTrainGeo(),
    taxi: buildHoloTaxiGeo(),
    tower: buildCyberTowerGeo(),
    lamp: buildNeonLampGeo(),
    tree: buildHoloTreeGeo(),
    bleacher: buildBleacherGeo(),
    barrier: buildBarrierGeo(),
    flag: buildFlagGeo(),
    djBooth: buildDjBoothGeo(),
    sphere: new THREE.SphereGeometry(1, 10, 8),
    torus: new THREE.TorusGeometry(1, 0.026, 6, 18),
    arch: new THREE.TorusGeometry(1, 0.042, 6, 18, Math.PI),
    capsule: new THREE.CapsuleGeometry(0.5, 1.0, 4, 8),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1.0, 10),
  })
  return G_CACHE
}

let M_CACHE = null
function getMats() {
  if (M_CACHE) return M_CACHE
  M_CACHE = markShared({
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.65, metalness: 0.32,
      emissive: '#0e1d47', emissiveIntensity: 0.34, side: THREE.DoubleSide,
    }),
    vcSolid: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.36, metalness: 0.32,
      emissive: '#162552', emissiveIntensity: 0.36,
    }),
    vcGlow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    glowPlain: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    portalCyan: new THREE.MeshBasicMaterial({ color: '#2bffe8', toneMapped: false }),
    portalPink: new THREE.MeshBasicMaterial({ color: '#ff3df2', toneMapped: false }),
    holoBridge: new THREE.MeshBasicMaterial({ color: '#2bffe8', transparent: true, opacity: 0.68, depthWrite: false, toneMapped: false }),
    laserGate: new THREE.MeshBasicMaterial({ color: '#ff3df2', transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false }),
    halo: new THREE.MeshBasicMaterial({ color: '#2bffe8', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }),
    towerMetal: new THREE.MeshStandardMaterial({ color: '#243059', roughness: 0.35, metalness: 0.72, emissive: '#2bffe8', emissiveIntensity: 0.35 }),
  })
  return M_CACHE
}

// ───────────────────────── Texturas Canvas Cacheadas ─────────────────────────
const texMap = new Map()
function getCheckerTex(c1 = '#2bffe8', c2 = '#160c2e') {
  const key = `nchk:${c1}:${c2}`
  if (texMap.has(key)) return texMap.get(key)
  let tex
  if (typeof document === 'undefined') {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  } else {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 64
    const ctx = c.getContext('2d')
    const cols = 16; const rows = 4; const cw = c.width / cols; const ch = c.height / rows
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? c1 : c2
        ctx.fillRect(x * cw, y * ch, cw, ch)
      }
    }
    tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
  }
  tex.needsUpdate = true
  markShared(tex)
  const mat = markShared(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }))
  texMap.set(key, mat)
  return mat
}

function getCurbTexMat(label, bg = '#120d2e', stripe = '#ff3df2', fg = '#2bffe8') {
  const key = `ncurb:${label}:${bg}:${stripe}:${fg}`
  if (texMap.has(key)) return texMap.get(key)
  let tex
  if (typeof document === 'undefined') {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  } else {
    const c = document.createElement('canvas')
    c.width = 512; c.height = 128
    const ctx = c.getContext('2d')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.fillStyle = stripe
    ctx.fillRect(0, 0, c.width, 18)
    ctx.fillRect(0, c.height - 18, c.width, 18)
    ctx.font = 'bold 44px system-ui, sans-serif'
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, c.width * 0.5, c.height * 0.5)
    tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.ClampToEdgeWrapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
  }
  tex.needsUpdate = true
  markShared(tex)
  const mat = markShared(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }))
  texMap.set(key, mat)
  return mat
}

function getGridSkyTexMat() {
  const key = 'neon-sky-grid'
  if (texMap.has(key)) return texMap.get(key)
  let tex
  if (typeof document === 'undefined') {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  } else {
    const c = document.createElement('canvas')
    c.width = 256; c.height = 256
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 256, 256)
    ctx.strokeStyle = 'rgba(43, 255, 232, 0.35)'
    ctx.lineWidth = 4
    for (let i = 0; i <= 4; i++) {
      const p = (i / 4) * 256
      ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 256); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(256, p); ctx.stroke()
    }
    ctx.strokeStyle = 'rgba(255, 61, 242, 0.25)'
    ctx.lineWidth = 2
    ctx.strokeRect(32, 32, 192, 192)
    tex = new THREE.CanvasTexture(c)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(8, 3)
  }
  tex.needsUpdate = true
  markShared(tex)
  const mat = markShared(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }))
  texMap.set(key, mat)
  return mat
}

// ───────────────────────── Bandas curvas sobre pista y cielo ─────────────────────────
function buildTrackBandGeo(seg, uCenter, halfArc = 0.36, halfLen = 0.45, rMult = 0.968) {
  const frames = segFrames(seg)
  const fr = makeFrame()
  const dv = new THREE.Vector3()
  const du = halfLen / Math.max(seg.length, 1)
  const u0 = THREE.MathUtils.clamp(uCenter - du, 0.01, 0.99)
  const u1 = THREE.MathUtils.clamp(uCenter + du, 0.01, 0.99)
  const nU = 4; const nA = 12
  const pos = new Float32Array((nU + 1) * (nA + 1) * 3)
  const uv = new Float32Array((nU + 1) * (nA + 1) * 2)
  let p = 0; let q = 0
  for (let i = 0; i <= nU; i++) {
    const u = THREE.MathUtils.lerp(u0, u1, i / nU)
    sampleFrameInto(frames, u, fr)
    for (let j = 0; j <= nA; j++) {
      const a = -halfArc + (j / nA) * halfArc * 2
      const r = seg.radius * rMult
      dv.copy(fr.up).multiplyScalar(-Math.cos(a)).addScaledVector(fr.right, Math.sin(a))
      pos[p++] = fr.pos.x + dv.x * r; pos[p++] = fr.pos.y + dv.y * r; pos[p++] = fr.pos.z + dv.z * r
      uv[q++] = j / nA; uv[q++] = i / nU
    }
  }
  const idx = []
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nA; j++) {
      const a = i * (nA + 1) + j; const b = a + nA + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function buildSkyGridDomeGeo(seg) {
  const frames = segFrames(seg)
  const fr = makeFrame()
  const dv = new THREE.Vector3()
  const nU = THREE.MathUtils.clamp(Math.ceil(seg.length * 0.7), 6, 100)
  const nA = 16
  const pos = new Float32Array((nU + 1) * (nA + 1) * 3)
  const uv = new Float32Array((nU + 1) * (nA + 1) * 2)
  let p = 0; let q = 0
  for (let i = 0; i <= nU; i++) {
    const u = i / nU
    sampleFrameInto(frames, u, fr)
    for (let j = 0; j <= nA; j++) {
      // Cubre la bóveda superior del tubo (de 0.55π a 1.45π)
      const a = Math.PI * 0.55 + (j / nA) * Math.PI * 0.90
      const r = seg.radius * 0.975
      dv.copy(fr.up).multiplyScalar(-Math.cos(a)).addScaledVector(fr.right, Math.sin(a))
      pos[p++] = fr.pos.x + dv.x * r; pos[p++] = fr.pos.y + dv.y * r; pos[p++] = fr.pos.z + dv.z * r
      uv[q++] = u * (seg.length / 8); uv[q++] = j / nA
    }
  }
  const idx = []
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nA; j++) {
      const a = i * (nA + 1) + j; const b = a + nA + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

function buildCurbStripGeo(seg, u0, u1, sideSign = 1, aIn = 0.44, aOut = 0.56) {
  const frames = segFrames(seg)
  const fr = makeFrame()
  const dv = new THREE.Vector3()
  const len = seg.length * Math.abs(u1 - u0)
  const nU = THREE.MathUtils.clamp(Math.ceil(len * 0.9), 6, 80)
  const pos = new Float32Array((nU + 1) * 2 * 3)
  const uv = new Float32Array((nU + 1) * 2 * 2)
  const rep = Math.max(1, Math.round(len / 5.5))
  let p = 0; let q = 0
  for (let i = 0; i <= nU; i++) {
    const t = i / nU
    const u = THREE.MathUtils.lerp(u0, u1, t)
    sampleFrameInto(frames, u, fr)
    for (let j = 0; j < 2; j++) {
      const a = sideSign * (j === 0 ? aIn : aOut)
      const r = seg.radius * (j === 0 ? 0.942 : 0.958)
      dv.copy(fr.up).multiplyScalar(-Math.cos(a)).addScaledVector(fr.right, Math.sin(a))
      pos[p++] = fr.pos.x + dv.x * r; pos[p++] = fr.pos.y + dv.y * r; pos[p++] = fr.pos.z + dv.z * r
      uv[q++] = t * rep; uv[q++] = j
    }
  }
  const idx = []
  for (let i = 0; i < nU; i++) {
    const a = i * 2; const b = a + 2
    idx.push(a, a + 1, b, b, a + 1, b + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ───────────────────────── Relieve del terreno tech por tramo ─────────────────────────
function neonHeight(seg, u, a) {
  const s = u * seg.length
  if (seg.route === 0) {
    // Terraplenes paralelos de circuito rápido
    return THREE.MathUtils.clamp(0.40 + 0.35 * Math.sin(s * 0.8) * Math.cos(a * 3.0), 0.1, 0.88)
  }
  if (seg.route === 1) {
    // Terrazas cyber-lounge escalonadas suaves
    const step = 0.5 + 0.5 * Math.sin(s * 0.25 + a * 2.0)
    return THREE.MathUtils.clamp(0.25 + 0.55 * (step * step * (3 - 2 * step)), 0.1, 0.9)
  }
  return THREE.MathUtils.clamp(0.45 + 0.38 * Math.sin(s * 0.5 + a * 2.6) * Math.cos(s * 0.2), 0.1, 0.92)
}

// ═══════════════════════════ TERRENO, CIELO Y CUADRÍCULA PULSANTE ═══════════════════════════
function NeonTerrainAndSky({ way, detail }) {
  const geos = useMemo(() => {
    const terrains = []; const skies = []; const grids = []
    for (const s of way.segments) {
      if (s.air) continue
      const colors = s.route === 0 ? ['#14204d', '#2b7be0']
        : s.route === 1 ? ['#162452', '#396eb8']
          : ['#261454', '#8e38e0']
      terrains.push(buildTerrainGeo(s, {
        arc: Math.PI * 0.62,
        maxH: s.radius * 0.29,
        radial: 18,
        along: Math.min(120, Math.ceil(s.length * 1.0)),
        height: (u, a) => neonHeight(s, u, a),
        colors,
      }))
      skies.push(buildSkyGeo(s, {
        radial: 12,
        along: Math.min(60, Math.ceil(s.length * 0.5)),
        colors: s.route === 2 ? ['#12082e', '#3c1366'] : ['#090f26', '#1e164a'],
      }))
      grids.push(buildSkyGridDomeGeo(s))
    }
    const tGeo = terrains.length ? mergeGeometries(terrains, false) : null
    terrains.forEach((g) => g.dispose())
    const sGeo = skies.length ? mergeGeometries(skies, false) : null
    skies.forEach((g) => g.dispose())
    const gGeo = grids.length ? mergeGeometries(grids, false) : null
    grids.forEach((g) => g.dispose())
    return { tGeo, sGeo, gGeo }
  }, [way])

  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  }), [])
  const gridMat = useMemo(() => getGridSkyTexMat().clone(), [])

  useEffect(() => () => {
    geos.tGeo?.dispose(); geos.sGeo?.dispose(); geos.gGeo?.dispose()
    skyMat.dispose(); gridMat.dispose()
  }, [geos, skyMat, gridMat])

  useFrame(({ clock }) => {
    const det = detail?.value ?? 0
    skyMat.opacity = 0.14 + det * 0.36
    const bolls = getBallitas()
    let fastBoost = 1
    for (let i = 0; i < bolls.length; i++) {
      const b = bolls[i]
      if (b.phase === 'travel' && b.way === way) {
        fastBoost = THREE.MathUtils.clamp((b.speed ?? 12) / 14, 0.7, 2.2)
        break
      }
    }
    const pulse = 0.65 + 0.35 * Math.sin(clock.elapsedTime * 3.0 * fastBoost + way.idx)
    gridMat.opacity = (0.12 + det * 0.20) * pulse
    if (gridMat.map) gridMat.map.offset.x = (clock.elapsedTime * 0.18 * fastBoost) % 1
  })

  const mats = getMats()
  return (
    <group>
      {geos.tGeo && <mesh geometry={geos.tGeo} material={mats.terrain} receiveShadow />}
      {geos.sGeo && <mesh geometry={geos.sGeo} material={skyMat} />}
      {geos.gGeo && <mesh geometry={geos.gGeo} material={gridMat} />}
    </group>
  )
}

// ═══════════════════════════ PÓRTICOS DE ESTADIO, ANUNCIOS Y PISTA ═══════════════════════════
function NeonPortalGate({ seg, u, title, sub, style = ESTILO, emblem = '⚡' }) {
  const data = useMemo(() => {
    const R = seg.radius
    const pCenter = placeAlong(seg, u, 0, 0)
    const faceQ = pCenter.quat.clone().multiply(FLIP_Y)
    const pL = placeAlong(seg, u, 0.02, -0.56)
    const pR = placeAlong(seg, u, 0.02, 0.56)
    const archPos = pCenter.pos.clone().addScaledVector(pCenter.up, R * 0.92)
    const signPos = pCenter.pos.clone().addScaledVector(pCenter.up, R * 1.08)
    return { R, faceQ, pL, pR, archPos, signPos, quat: pCenter.quat }
  }, [seg, u])

  const geos = getGeos()
  const mats = getMats()
  const hPil = data.R * 0.78

  return (
    <group>
      <mesh geometry={geos.cyl} material={mats.towerMetal} position={data.pL.pos.clone().addScaledVector(data.pL.up, hPil * 0.5)} quaternion={data.pL.quat} scale={[0.12, hPil, 0.12]} />
      <mesh geometry={geos.cyl} material={mats.towerMetal} position={data.pR.pos.clone().addScaledVector(data.pR.up, hPil * 0.5)} quaternion={data.pR.quat} scale={[0.12, hPil, 0.12]} />
      <mesh geometry={geos.arch} material={mats.portalCyan} position={data.archPos} quaternion={data.quat} scale={[data.R * 0.54, data.R * 0.52, 0.45]} />
      <Billboard text={`${emblem} ${title}`} style={{ ...style, sub }} height={0.30} position={data.signPos} quat={data.faceQ} glow={1.25} />
    </group>
  )
}

function NeonTrackDetails({ way, world }) {
  const info = useMemo(() => routeInfo(way), [way])
  const destName = world?.nodes?.[way.to]?.name ?? 'Destino'

  const { checkGeo, curbMeshes, portals, adSigns } = useMemo(() => {
    const chks = []; const curbs = []; const ports = []; const ads = []
    const adTexts = [
      ['TURBO NEÓN', 'VELOCIDAD PURA'],
      ['BALLITA GP', 'SIN LÍMITES'],
      ['CYBER ARENA', 'EN VIVO'],
      ['HYPER GRID', 'BOOST ×2'],
    ]

    for (const s of way.segments) {
      if (s.air) continue
      if (s.kind === 'salida') {
        chks.push(buildTrackBandGeo(s, 0.08, 0.36, 0.55, 0.968))
        curbs.push({ geo: buildCurbStripGeo(s, 0.03, 0.96, -1), label: 'CAMINO NEON · GRAND PRIX' })
        curbs.push({ geo: buildCurbStripGeo(s, 0.03, 0.96, 1), label: 'CAMINO NEON · GRAND PRIX' })
        ports.push({ seg: s, u: 0.06, title: 'CAMINO NEÓN', sub: `Rumbo a ${destName}`, style: ESTILO, emblem: '🌃' })
      } else if (s.kind === 'llegada') {
        chks.push(buildTrackBandGeo(s, 0.88, 0.36, 0.65, 0.968))
        curbs.push({ geo: buildCurbStripGeo(s, 0.05, 0.95, -1), label: `META · ${destName.toUpperCase()}` })
        curbs.push({ geo: buildCurbStripGeo(s, 0.05, 0.95, 1), label: `META · ${destName.toUpperCase()}` })
        ports.push({ seg: s, u: 0.90, title: `META · ${destName}`, sub: 'Fin del Circuito Neón', style: ESTILO_CYAN, emblem: '🏁' })
      } else if (s.event) {
        chks.push(buildTrackBandGeo(s, 0.06, 0.36, 0.42, 0.968))
        chks.push(buildTrackBandGeo(s, 0.94, 0.36, 0.42, 0.968))
        const rtLabel = s.route === 0 ? 'HYPER-GRID' : s.route === 1 ? 'CYBER-LOUNGE' : 'ARENA DJ'
        curbs.push({ geo: buildCurbStripGeo(s, 0.06, 0.94, -1), label: `${rtLabel} · ${s.name.toUpperCase()}` })
        curbs.push({ geo: buildCurbStripGeo(s, 0.06, 0.94, 1), label: `${rtLabel} · ${s.name.toUpperCase()}` })
        ports.push({ seg: s, u: 0.05, title: s.name, sub: `Ruta ${'ABC'[s.route] ?? 'A'} · ${rtLabel}`, style: ESTILO_CYAN, emblem: s.emoji })
      }

      // Anuncios holográficos laterales dentro del tubo (estilo vista_estadio_pista)
      if (s.length > 16) {
        for (const u of [0.35, 0.72]) {
          const side = u < 0.5 ? -1 : 1
          const p = placeAlong(s, u, 0.16, side * 1.15)
          const q = p.quat.clone().multiply(FLIP_Y)
          const [tMain, tSub] = adTexts[(s.i + (u > 0.5 ? 1 : 0)) % adTexts.length]
          ads.push({ pos: p.pos, quat: q, text: tMain, sub: tSub, key: `${s.i}:${u}` })
        }
      }
    }

    for (const rt of info.routes) {
      const first = rt.segments.find((s) => s.route >= 0 && !s.air)
      if (first) {
        const sub = rt.r === 0 ? 'Ruta A · Hyper-Grid Veloz' : rt.r === 1 ? 'Ruta B · Cyber-Lounge' : 'Ruta C · Arena DJ'
        ports.push({ seg: first.seg, u: 0.07, title: `RUTA ${rt.name}`, sub, style: ESTILO, emblem: '⚡' })
      }
    }

    const chkGeo = chks.length ? mergeGeometries(chks, false) : null
    chks.forEach((g) => g.dispose())
    return { checkGeo: chkGeo, curbMeshes: curbs, portals: ports, adSigns: ads }
  }, [way, info, destName])

  useEffect(() => () => {
    checkGeo?.dispose()
    curbMeshes.forEach((c) => c.geo.dispose())
  }, [checkGeo, curbMeshes])

  const chkMat = getCheckerTex('#2bffe8', '#160c2e')
  return (
    <group>
      {checkGeo && <mesh geometry={checkGeo} material={chkMat} />}
      {curbMeshes.map((c, idx) => (
        <mesh key={idx} geometry={c.geo} material={getCurbTexMat(c.label)} />
      ))}
      {portals.map((p, idx) => (
        <NeonPortalGate key={idx} seg={p.seg} u={p.u} title={p.title} sub={p.sub} style={p.style} emblem={p.emblem} />
      ))}
      {adSigns.map((ad) => (
        <Billboard key={ad.key} text={ad.text} style={{ ...ESTILO_AD, sub: ad.sub }} height={0.28} position={ad.pos} quat={ad.quat} glow={1.25} />
      ))}
      <CartelesDeRuta way={way} style={ESTILO} angle={0.92} u={0.14} height={0.34} pole={0.28} poleColor="#1d243b" />
    </group>
  )
}

// ═══════════════════════════ DECORACIÓN DEL DIORAMA NEÓN ═══════════════════════════
function NeonDioramaProps({ way }) {
  const geos = getGeos()
  const mats = getMats()

  const built = useMemo(() => {
    const rng = mulberry32(way.idx * 8117 + 53)
    const towers = []; const lamps = []; const halos = []; const trees = []
    const bleachers = []; const specBodies = []; const specFaces = []
    const barriers = []; const flags = []; const speedRings = []; const meteors = []; const airRings = []

    const addSpectators = (seg, u, sideSign, angleBase, count = 4) => {
      for (let k = 0; k < count; k++) {
        const uk = THREE.MathUtils.clamp(u + (k - (count - 1) * 0.5) * (0.34 / Math.max(seg.length, 1)), 0.02, 0.98)
        const row = k % 2
        const ang = angleBase + sideSign * (0.04 + row * 0.14)
        const off = 0.12 + row * 0.11
        const p = placeAlong(seg, uk, off, ang)
        const faceIn = new THREE.Quaternion().setFromAxisAngle(Y, sideSign > 0 ? -Math.PI * 0.5 : Math.PI * 0.5)
        const q = p.quat.clone().multiply(faceIn)
        const cols = ['#2bffe8', '#ff3df2', '#ffe600', '#70a8ff']
        specBodies.push({ pos: p.pos, quat: q, scale: 0.16, color: cols[(k + seg.i) % cols.length], basePos: p.pos.clone(), up: p.up.clone(), ph: rng() * TAU, seg })
        specFaces.push({ pos: p.pos, quat: q, scale: 0.16 })
      }
    }

    for (const s of way.segments) {
      if (s.air) {
        const nAir = Math.max(3, Math.floor(s.length / 7))
        for (let i = 1; i < nAir; i++) {
          const u = i / nAir
          const p = placeAlong(s, u, 0, 0)
          const rRing = s.radius * (0.92 + 0.16 * Math.cos(i))
          airRings.push({ pos: p.center, quat: p.quat, scale: [rRing, rRing, 0.5], color: i % 2 === 0 ? '#2bffe8' : '#ff3df2' })
        }
        continue
      }

      const R = s.radius
      const maxH = R * 0.29
      const stepU = s.route === 0 ? 2.5 : s.route === 1 ? 2.8 : 2.6
      const nSlots = Math.max(3, Math.floor(s.length / stepU))

      for (let i = 0; i < nSlots; i++) {
        const u = (i + 0.5) / nSlots
        const side = i % 2 === 0 ? 1 : -1

        // Barreras láser bajas en ambos lados y banderines de estadio en primer plano
        for (const sgn of [-1, 1]) {
          const barA = sgn * 0.54
          const pb = placeAlong(s, u, neonHeight(s, u, barA) * maxH * 0.4, barA)
          barriers.push({ pos: pb.pos, quat: pb.quat, scale: 0.78, color: (i + sgn) % 2 === 0 ? '#2bffe8' : '#ff3df2' })
        }
        if (i % 2 === 0) {
          const pfl = placeAlong(s, u, 0.02, -side * 0.56)
          const fCols = ['#2bffe8', '#ff3df2', '#ffe600']
          flags.push({ pos: pfl.pos, quat: pfl.quat, scale: 0.78, color: fCols[i % fCols.length] })
        }

        // Farolas cyber
        if (i % 2 === 1 || s.kind === 'salida') {
          const la = side * (0.64 + rng() * 0.10)
          const pl = placeAlong(s, u, neonHeight(s, u, la) * maxH * 0.5, la)
          const inward = new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5)
          lamps.push({ pos: pl.pos, quat: pl.quat.clone().multiply(inward), scale: 0.82, color: i % 2 === 0 ? '#2bffe8' : '#ff3df2' })
          const bulb = pl.pos.clone().addScaledVector(pl.up, 0.45).addScaledVector(pl.side, -side * 0.16)
          halos.push({ pos: bulb, quat: IDENT_Q, scale: 0.14 })
        }

        // Plano medio en ambos flancos según ruta
        for (const flSide of [-1, 1]) {
          if (flSide === side && i % 2 === 1) continue
          const midA = flSide * (0.72 + rng() * 0.28)
          if (laneGap(s, midA) <= 0.33) continue
          const pm = placeAlong(s, u, neonHeight(s, u, midA) * maxH * 0.65, midA)
          const rotQ = pm.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, rng() * TAU))
          if ((s.kind === 'salida' || s.kind === 'llegada' || s.route === 2) && i % 2 === 0 && flSide === -side) {
            const faceTrack = pm.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, flSide > 0 ? 0 : Math.PI))
            bleachers.push({ pos: pm.pos, quat: faceTrack, scale: 1.0 })
            addSpectators(s, u, flSide, midA, 4)
          } else if (s.route === 1) {
            if ((i + (flSide > 0 ? 1 : 0)) % 2 === 0) trees.push({ pos: pm.pos, quat: rotQ, scale: 0.94 + rng() * 0.24 })
            else towers.push({ pos: pm.pos, quat: rotQ, scale: 0.88 + rng() * 0.26, color: '#2bffe8' })
          } else {
            towers.push({ pos: pm.pos, quat: rotQ, scale: 0.92 + rng() * 0.34, color: (i + flSide) % 2 === 0 ? '#ff3df2' : '#2bffe8' })
          }
        }

        // Anillos aceleradores internos en Ruta A y tramos rápidos (estilo vista_referencia)
        if ((s.route === 0 || (s.speedK ?? 1) > 1.2) && i % 3 === 0) {
          const pr = placeAlong(s, u, 0, 0)
          speedRings.push({ pos: pr.center, quat: pr.quat, scale: [R * 0.86, R * 0.86, 0.45], color: i % 2 === 0 ? '#2bffe8' : '#ff3df2', ph: rng() * TAU, seg: s })
        }

        // Meteoritos / paquetes de datos cruzando el techo
        if (i % 3 === 1) {
          const ma = (rng() > 0.5 ? 1 : -1) * (1.9 + rng() * 0.85)
          meteors.push({ seg: s, uBase: u, ang: ma, off: 0.14 + rng() * 0.2, ph: rng() * TAU, color: i % 2 === 0 ? '#2bffe8' : '#ffe600' })
        }
      }
    }

    for (const p of scatter(way, 36, rng, { angle: [-1.4, 1.4], clear: BALL_R * 0.85, scale: [0.68, 1.05] })) {
      const h = neonHeight(p.seg, p.u, p.angle) * (p.seg.radius * 0.26)
      const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, p.rnd * TAU))
      const pos = p.pos.clone().addScaledVector(p.up, h * 0.65)
      if (p.seg.route === 1) trees.push({ pos, quat: q, scale: p.scale })
      else towers.push({ pos, quat: q, scale: p.scale * 0.85, color: p.rnd > 0.5 ? '#2bffe8' : '#ff3df2' })
    }

    return { towers, lamps, halos, trees, bleachers, specBodies, specFaces, barriers, flags, speedRings, meteors, airRings }
  }, [way])

  const specBodyMesh = useInstanced(geos.robotBody, mats.vcSolid, built.specBodies)
  const specFaceMesh = useInstanced(geos.robotFace, mats.vcSolid, built.specFaces)
  const meteorItems = useMemo(() => built.meteors.map((m) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: 0.08, color: m.color })), [built.meteors])
  const meteorMesh = useInstanced(geos.capsule, mats.glowPlain, meteorItems)
  const ringMesh = useInstanced(geos.torus, mats.glowPlain, built.speedRings)

  const tmp = useMemo(() => ({
    pl: makePlacement(), m: new THREE.Matrix4(), p: new THREE.Vector3(), s: new THREE.Vector3(),
  }), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBallitas()

    // Público holo-chibi salta cuando pasa una ballita por su tramo
    for (let i = 0; i < built.specBodies.length; i++) {
      const sp = built.specBodies[i]
      let active = false
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === sp.seg) { active = true; break }
      }
      const freq = active ? 12.0 : 3.2
      const jump = Math.abs(Math.sin(t * freq + sp.ph)) * (active ? 0.13 : 0.03)
      tmp.p.copy(sp.basePos).addScaledVector(sp.up, jump)
      tmp.s.setScalar(sp.scale)
      tmp.m.compose(tmp.p, sp.quat, tmp.s)
      specBodyMesh.setMatrixAt(i, tmp.m)
      specFaceMesh.setMatrixAt(i, tmp.m)
    }
    if (built.specBodies.length) {
      specBodyMesh.instanceMatrix.needsUpdate = true
      specFaceMesh.instanceMatrix.needsUpdate = true
    }

    // Lluvia de paquetes de datos / meteoritos en el cielo interior
    for (let i = 0; i < built.meteors.length; i++) {
      const mt = built.meteors[i]
      const u = (mt.uBase + t * 0.22) % 1
      placeAlongInto(mt.seg, u, mt.off, mt.ang, tmp.pl)
      tmp.s.set(0.035, 0.24, 0.035)
      tmp.m.compose(tmp.pl.pos, tmp.pl.quat, tmp.s)
      meteorMesh.setMatrixAt(i, tmp.m)
    }
    if (built.meteors.length) meteorMesh.instanceMatrix.needsUpdate = true

    // Anillos aceleradores pulsan con la velocidad de la ballita en el tramo
    for (let i = 0; i < built.speedRings.length; i++) {
      const r = built.speedRings[i]
      const pulse = 0.96 + 0.05 * Math.sin(t * 5.5 + r.ph)
      tmp.s.set(r.scale[0] * pulse, r.scale[1] * pulse, r.scale[2])
      tmp.m.compose(r.pos, r.quat, tmp.s)
      ringMesh.setMatrixAt(i, tmp.m)
    }
    if (built.speedRings.length) ringMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      <Instanced geo={geos.tower} mat={mats.vcSolid} items={built.towers} />
      <Instanced geo={geos.lamp} mat={mats.vcSolid} items={built.lamps} />
      <Instanced geo={geos.sphere} mat={mats.halo} items={built.halos} />
      <Instanced geo={geos.tree} mat={mats.vcSolid} items={built.trees} />
      <Instanced geo={geos.bleacher} mat={mats.vcSolid} items={built.bleachers} />
      <Instanced geo={geos.barrier} mat={mats.vcSolid} items={built.barriers} />
      <Instanced geo={geos.flag} mat={mats.vcSolid} items={built.flags} />
      <Instanced geo={geos.torus} mat={mats.glowPlain} items={built.airRings} />
      {built.specBodies.length > 0 && <>
        <primitive object={specBodyMesh} />
        <primitive object={specFaceMesh} />
      </>}
      {built.meteors.length > 0 && <primitive object={meteorMesh} />}
      {built.speedRings.length > 0 && <primitive object={ringMesh} />}
    </group>
  )
}

// ═══════════════════════════ ELENCO CHIBI: ROBOTS, DRONES, TRENES Y TAXIS ═══════════════════════════
function NeonCast({ way }) {
  const geos = getGeos()
  const mats = getMats()
  const info = useMemo(() => routeInfo(way), [way])

  const { robots, drones, trains, taxis } = useMemo(() => {
    const rng = mulberry32(way.idx * 7331 + 29)
    const paths = info.routes.map((rt) => segPath(rt.segments.map((s) => s.seg)))
    const robots = []; const drones = []; const trains = []; const taxis = []

    paths.forEach((p, r) => {
      if (!p.total) return
      const rCols = r === 0 ? ['#2bffe8', '#ff3df2'] : r === 1 ? ['#99e6ff', '#d4b2ff'] : ['#ffe600', '#2bffe8']
      // Robots chibi patrullando aceras tech (algunos en modo espera en Ruta B)
      const nRob = r === 1 ? 16 : 12
      for (let i = 0; i < nRob; i++) {
        robots.push({
          path: p, s: ((i + rng() * 0.7) / nRob) * p.total, dir: rng() > 0.5 ? 1 : -1,
          v: (r === 0 ? 1.05 : r === 1 ? 0.35 : 0.78) * (0.7 + rng() * 0.5),
          a: (i % 2 === 0 ? 1 : -1) * (0.70 + rng() * 0.26),
          ph: rng() * TAU, excite: 0, flee: 0, sleepy: r === 1 && i % 2 === 0,
          scale: 0.26, color: rCols[i % rCols.length],
        })
      }
      // Drones chibi con rotor giratorio en formación a media altura
      for (let i = 0; i < 10; i++) {
        drones.push({
          path: p, s: ((i + rng() * 0.7) / 10) * p.total, dir: rng() > 0.5 ? 1 : -1,
          v: (r === 0 ? 2.6 : 1.5) * (0.8 + rng() * 0.4),
          a: (i % 2 === 0 ? 1 : -1) * (1.25 + rng() * 0.50),
          off: 0.35 + rng() * 0.35, ph: rng() * TAU, excite: 0, scale: 0.20,
        })
      }
      // Tren de luz (2 vagones juntos) circulando por riel aéreo lateral alto
      const trS = rng() * p.total
      const trA = r % 2 === 0 ? 2.15 : -2.15
      for (let vIdx = 0; vIdx < 3; vIdx++) {
        trains.push({
          path: p, s: (trS - vIdx * 1.15 + p.total) % p.total,
          v: r === 0 ? 8.5 : 5.2, a: trA, off: 0.14, scale: 0.36,
        })
      }
      // Taxis voladores cruzando por el cielo superior
      for (let i = 0; i < 3; i++) {
        taxis.push({
          path: p, s: rng() * p.total, dir: rng() > 0.5 ? 1 : -1,
          v: 4.5 + rng() * 3.0, a: (rng() > 0.5 ? 1 : -1) * (2.4 + rng() * 0.5),
          off: 0.22 + rng() * 0.25, ph: rng() * TAU, scale: 0.42,
        })
      }
    })
    return { robots, drones, trains, taxis }
  }, [info, way.idx])

  const robItems = useMemo(() => robots.map((r) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: r.scale, color: r.color })), [robots])
  const robBodyMesh = useInstanced(geos.robotBody, mats.vcSolid, robItems)
  const robFaceMesh = useInstanced(geos.robotFace, mats.vcSolid, robItems)

  const drnItems = useMemo(() => drones.map((d) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: d.scale })), [drones])
  const drnBodyMesh = useInstanced(geos.droneBody, mats.vcSolid, drnItems)
  const drnRotorMesh = useInstanced(geos.droneRotor, mats.vcGlow, drnItems)

  const trnItems = useMemo(() => trains.map((t) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: t.scale })), [trains])
  const trnMesh = useInstanced(geos.train, mats.vcGlow, trnItems)

  const taxItems = useMemo(() => taxis.map((t) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: t.scale })), [taxis])
  const taxMesh = useInstanced(geos.taxi, mats.vcSolid, taxItems)

  const tmp = useMemo(() => ({
    loc: {}, pl: makePlacement(), sc: new THREE.Vector3(), m: new THREE.Matrix4(),
    q: new THREE.Quaternion(), rq: new THREE.Quaternion(),
    flip: new THREE.Quaternion().setFromAxisAngle(Y, Math.PI),
  }), [])

  useFrame(({ clock }, dt) => {
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()

    // Robots chibi
    for (let i = 0; i < robots.length; i++) {
      const r = robots[i]
      const moveK = r.sleepy && r.excite < 0.15 ? 0.15 : 1
      r.s += r.dir * r.v * moveK * h * (1 + r.excite * 1.6)
      if (r.s > r.path.total) { r.s = r.path.total; r.dir = -1 }
      if (r.s < 0) { r.s = 0; r.dir = 1 }
      let near = 0; let fleeDir = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = r.path.arcOf(b.seg, b.segT ?? 0)
        if (arc == null) continue
        const d = Math.abs(arc - r.s)
        if (d < 3.5) {
          const k01 = 1 - d / 3.5
          if (k01 > near) { near = k01; fleeDir = Math.sign(r.a - (b.roll ?? 0)) || 1 }
        }
      }
      r.excite = THREE.MathUtils.damp(r.excite, near, near > r.excite ? 10 : 2.5, h)
      r.flee = THREE.MathUtils.damp(r.flee, fleeDir * near * 0.3, 4, h)
      r.path.locate(r.s, tmp.loc)
      const hop = r.excite * 0.25 * Math.abs(Math.sin(t * 11 + r.ph))
      const bob = r.sleepy ? 0.04 * Math.sin(t * 2 + r.ph) : Math.abs(Math.sin(t * 6 * r.v + r.ph)) * 0.05
      placeAlongInto(tmp.loc.seg, tmp.loc.u, 0.08 + bob + hop, r.a + r.flee, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (r.dir < 0) tmp.q.multiply(tmp.flip)
      tmp.sc.setScalar(r.scale)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      robBodyMesh.setMatrixAt(i, tmp.m)
      robFaceMesh.setMatrixAt(i, tmp.m)
    }
    if (robots.length) {
      robBodyMesh.instanceMatrix.needsUpdate = true
      robFaceMesh.instanceMatrix.needsUpdate = true
    }

    // Drones chibi
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i]
      d.s += d.dir * d.v * h
      if (d.s > d.path.total) { d.s = d.path.total; d.dir = -1 }
      if (d.s < 0) { d.s = 0; d.dir = 1 }
      d.path.locate(d.s, tmp.loc)
      const hover = Math.sin(t * 4.5 + d.ph) * 0.08
      placeAlongInto(tmp.loc.seg, tmp.loc.u, d.off + hover, d.a + Math.sin(t * 1.4 + d.ph) * 0.15, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (d.dir < 0) tmp.q.multiply(tmp.flip)
      tmp.sc.setScalar(d.scale)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      drnBodyMesh.setMatrixAt(i, tmp.m)
      tmp.rq.setFromAxisAngle(Y, t * 18 + d.ph)
      tmp.q.multiply(tmp.rq)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      drnRotorMesh.setMatrixAt(i, tmp.m)
    }
    if (drones.length) {
      drnBodyMesh.instanceMatrix.needsUpdate = true
      drnRotorMesh.instanceMatrix.needsUpdate = true
    }

    // Trenes de luz continuos
    for (let i = 0; i < trains.length; i++) {
      const tr = trains[i]
      tr.s = (tr.s + tr.v * h) % tr.path.total
      tr.path.locate(tr.s, tmp.loc)
      placeAlongInto(tmp.loc.seg, tmp.loc.u, tr.off, tr.a, tmp.pl)
      tmp.sc.setScalar(tr.scale)
      tmp.m.compose(tmp.pl.pos, tmp.pl.quat, tmp.sc)
      trnMesh.setMatrixAt(i, tmp.m)
    }
    if (trains.length) trnMesh.instanceMatrix.needsUpdate = true

    // Taxis voladores
    for (let i = 0; i < taxis.length; i++) {
      const tx = taxis[i]
      tx.s = (tx.s + tx.dir * tx.v * h + tx.path.total) % tx.path.total
      tx.path.locate(tx.s, tmp.loc)
      placeAlongInto(tmp.loc.seg, tmp.loc.u, tx.off + Math.sin(t * 2.5 + tx.ph) * 0.06, tx.a, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (tx.dir < 0) tmp.q.multiply(tmp.flip)
      tmp.sc.setScalar(tx.scale)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      taxMesh.setMatrixAt(i, tmp.m)
    }
    if (taxis.length) taxMesh.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {robots.length > 0 && <>
        <primitive object={robBodyMesh} />
        <primitive object={robFaceMesh} />
      </>}
      {drones.length > 0 && <>
        <primitive object={drnBodyMesh} />
        <primitive object={drnRotorMesh} />
      </>}
      {trains.length > 0 && <primitive object={trnMesh} />}
      {taxis.length > 0 && <primitive object={taxMesh} />}
    </group>
  )
}

// ═══════════════════════════ EVENTOS PERSONALIZADOS POR RUTA ═══════════════════════════
// Ruta A (r=0): Compuertas láser secuenciales que se abren al paso + anillos warp pulsantes
// Ruta B (r=1): Puente holográfico que se materializa + ballet giratorio de anillos holo
// Ruta C (r=2): Cabina de DJ Chibi con ecualizador vivo y focos reactivos al color de la ballita
// Llegada: Fuegos artificiales digitales
function EventLaserGates({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const gatesRef = useRef([])
  const gates = useMemo(() => [0.22, 0.42, 0.62, 0.82].map((u, idx) => ({
    l: placeAlong(seg, u, 0.04, -0.54),
    r: placeAlong(seg, u, 0.04, 0.54),
    idx,
  })), [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const open = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.35 : 0.05
    for (let i = 0; i < gates.length; i++) {
      const g = gatesRef.current[i]
      if (!g) continue
      const wave = open * (0.8 + 0.2 * Math.sin(t * 7 - i))
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, wave * 1.25, 8, 0.03)
    }
  })

  return (
    <group>
      {gates.map((gt, idx) => (
        <group key={idx}>
          <group position={gt.l.pos} quaternion={gt.l.quat}>
            <group ref={(el) => { gatesRef.current[idx] = el }}>
              <mesh geometry={geos.capsule} material={mats.laserGate} position={[0.25, 0.48, 0]} scale={[0.06, 0.72, 0.28]} />
            </group>
          </group>
          <mesh geometry={geos.capsule} material={mats.portalCyan} position={gt.r.pos.clone().addScaledVector(gt.r.up, 0.48)} quaternion={gt.r.quat} scale={[0.08, 0.75, 0.08]} />
        </group>
      ))}
    </group>
  )
}

function EventHoloBridge({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const padsRef = useRef([])
  const haloRef = useRef()

  const pads = useMemo(() => {
    const out = []
    for (let i = 0; i < 6; i++) {
      const u = 0.18 + i * 0.125
      out.push({ l: placeAlong(seg, u, 0.06, -0.58), r: placeAlong(seg, u, 0.06, 0.58), idx: i })
    }
    return out
  }, [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const k = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.55 : 0.18
    for (let i = 0; i < pads.length; i++) {
      const m = padsRef.current[i]
      if (!m) continue
      m.scale.y = 0.15 + k * (0.5 + 0.25 * Math.sin(t * 4 + i * 0.7))
    }
    if (haloRef.current) {
      haloRef.current.rotation.z = t * (0.9 + stage.intensity * 2.2)
    }
  })

  const mid = useMemo(() => placeAlong(seg, 0.5, seg.radius * 0.84, 0), [seg])
  return (
    <group>
      {pads.map((pd, idx) => (
        <group key={idx}>
          <mesh
            ref={(el) => { padsRef.current[idx] = el }}
            geometry={geos.capsule} material={mats.holoBridge}
            position={pd.l.pos.clone().addScaledVector(pd.l.up, 0.25)} quaternion={pd.l.quat}
            scale={[0.14, 0.45, 0.24]}
          />
          <mesh
            geometry={geos.capsule} material={mats.holoBridge}
            position={pd.r.pos.clone().addScaledVector(pd.r.up, 0.25)} quaternion={pd.r.quat}
            scale={[0.14, 0.45, 0.24]}
          />
        </group>
      ))}
      <group ref={haloRef} position={mid.pos} quaternion={mid.quat}>
        <mesh geometry={geos.torus} material={mats.portalPink} scale={[seg.radius * 0.44, seg.radius * 0.44, 0.48]} />
      </group>
    </group>
  )
}

function EventDjArena({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const eqRefs = useRef([])
  const djRef = useRef()
  const reactMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ff3df2', transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => reactMat.dispose(), [reactMat])

  const layout = useMemo(() => {
    const booth = placeAlong(seg, 0.48, 0.04, -0.78)
    const faceTrack = booth.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, Math.PI * 0.5))
    const bars = []
    for (let i = 0; i < 10; i++) {
      const u = 0.16 + i * 0.072
      const side = i % 2 === 0 ? -1 : 1
      bars.push({ p: placeAlong(seg, u, 0.04, side * 0.68), idx: i })
    }
    return { booth: { pos: booth.pos, quat: faceTrack, up: booth.up }, bars }
  }, [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const speedK = stage.ballita ? THREE.MathUtils.clamp((stage.ballita.speed ?? 12) / 14, 0.7, 2.4) : 1
    if (stage.ballita?.genome) {
      reactMat.color.setHSL(stage.ballita.genome.hue, 0.9, 0.6)
    } else {
      reactMat.color.set('#ff3df2')
    }
    if (djRef.current) {
      const jump = Math.abs(Math.sin(t * 7.5 * speedK)) * (0.04 + stage.intensity * 0.14)
      djRef.current.position.copy(layout.booth.pos).addScaledVector(layout.booth.up, 0.18 + jump)
    }
    for (let i = 0; i < layout.bars.length; i++) {
      const m = eqRefs.current[i]
      if (!m) continue
      m.scale.y = 0.28 + (0.35 + stage.intensity * 0.95) * (0.5 + 0.5 * Math.sin(t * 8.5 * speedK + i * 0.8))
    }
  })

  return (
    <group>
      <mesh geometry={geos.djBooth} material={mats.vcSolid} position={layout.booth.pos} quaternion={layout.booth.quat} scale={0.75} />
      <group ref={djRef} position={layout.booth.pos} quaternion={layout.booth.quat}>
        <mesh geometry={geos.robotBody} material={mats.vcSolid} scale={0.22} />
        <mesh geometry={geos.robotFace} material={mats.vcSolid} scale={0.22} />
      </group>
      {layout.bars.map((b, idx) => (
        <mesh
          key={idx}
          ref={(el) => { eqRefs.current[idx] = el }}
          geometry={geos.cyl} material={reactMat}
          position={b.p.pos.clone().addScaledVector(b.p.up, 0.42)} quaternion={b.p.quat}
          scale={[0.10, 0.65, 0.10]}
        />
      ))}
    </group>
  )
}

function EventAirWarp({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const ringsRef = useRef([])
  const rings = useMemo(() => [0.2, 0.5, 0.8].map((u, idx) => ({ p: placeAlong(seg, u, 0, 0), idx })), [seg])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < rings.length; i++) {
      const m = ringsRef.current[i]
      if (!m) continue
      const sc = seg.radius * (0.92 + 0.25 * stage.intensity + 0.1 * Math.sin(t * 6 + i))
      m.scale.set(sc, sc, 0.6)
      m.rotation.z = t * (i % 2 === 0 ? 2.4 : -2.6) * (1 + stage.intensity)
    }
  })
  return (
    <group>
      {rings.map((r, idx) => (
        <mesh
          key={idx}
          ref={(el) => { ringsRef.current[idx] = el }}
          geometry={geos.torus} material={idx % 2 === 0 ? mats.portalCyan : mats.portalPink}
          position={r.p.center} quaternion={r.p.quat}
        />
      ))}
    </group>
  )
}

function FinishFireworks({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const sparks = useMemo(() => {
    const rng = mulberry32(seg.i * 991 + 13)
    const cols = ['#2bffe8', '#ff3df2', '#ffe600', '#70a8ff']
    const out = []
    for (let i = 0; i < 20; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const p = placeAlong(seg, 0.83 + (i % 3) * 0.04, 0.08, side * (0.58 + rng() * 0.3))
      const dir = p.up.clone().addScaledVector(p.side, -side * (0.2 + rng() * 0.5)).addScaledVector(p.tangent, (rng() - 0.5) * 0.4).normalize()
      out.push({ base: p.pos.clone(), dir, ph: rng() * TAU, color: cols[i % cols.length] })
    }
    return out
  }, [seg])

  const items = useMemo(() => sparks.map((s) => ({ pos: s.base, quat: IDENT_Q, scale: 0.075, color: s.color })), [sparks])
  const mesh = useInstanced(geos.sphere, mats.glowPlain, items)
  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const tmpP = useMemo(() => new THREE.Vector3(), [])
  const tmpS = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const active = stage.phase === 'climax' || stage.phase === 'teaser' || stage.phase === 'salida'
    const boost = active ? 1.0 : 0.25
    for (let i = 0; i < sparks.length; i++) {
      const s = sparks[i]
      const k = (t * (1.3 + boost * 0.9) + s.ph) % 1
      tmpP.copy(s.base).addScaledVector(s.dir, k * seg.radius * 0.88 * boost)
      const sz = (1 - k) * 0.09 * (0.4 + stage.intensity * 0.9)
      tmpS.setScalar(Math.max(0.005, sz))
      tmpM.compose(tmpP, IDENT_Q, tmpS)
      mesh.setMatrixAt(i, tmpM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}

function NeonEvents({ way }) {
  const info = useMemo(() => routeInfo(way), [way])
  const landing = useMemo(() => info.segments.find((s) => s.kind === 'llegada' && !s.air), [info])

  return (
    <group>
      {info.events.map((ev) => {
        const rt = ev.route
        return (
          <EventStage
            key={ev.i}
            segment={ev.seg}
            idle={0.14}
            render={(stage, stInfo) => (
              ev.seg.air ? <EventAirWarp stage={stage} info={stInfo} />
                : rt === 0 ? <EventLaserGates stage={stage} info={stInfo} />
                  : rt === 1 ? <EventHoloBridge stage={stage} info={stInfo} />
                    : <EventDjArena stage={stage} info={stInfo} />
            )}
          />
        )
      })}
      {landing && (
        <EventStage
          segment={landing.seg}
          idle={0.12}
          render={(stage, stInfo) => <FinishFireworks stage={stage} info={stInfo} />}
        />
      )}
    </group>
  )
}

// ═══════════════════════════ MECANISMOS DE CARRIL (SWITCHES) ═══════════════════════════
function SwitchMechanism({ seg, sw }) {
  const geos = getGeos()
  const mats = getMats()
  const rotRef = useRef()
  const anchors = useMemo(() => {
    const fFrom = laneFrame(seg, sw.from, sw.u)
    const uTo = THREE.MathUtils.clamp(sw.u + 0.05, 0.02, 0.98)
    const fTo = laneFrame(seg, sw.to, uTo)
    const mid = fFrom.pos.clone().lerp(fTo.pos, 0.5).addScaledVector(fFrom.up, 0.14)
    const dir = fTo.pos.clone().sub(fFrom.pos)
    const dist = Math.max(dir.length(), 0.25)
    const quat = new THREE.Quaternion().setFromUnitVectors(Y, dir.clone().normalize())
    const qRing = new THREE.Quaternion().setFromUnitVectors(Z, fFrom.tangent)
    const pFrom = fFrom.pos.clone().addScaledVector(fFrom.up, 0.06)
    const pTo = fTo.pos.clone().addScaledVector(fTo.up, 0.06)
    return { pFrom, pTo, mid, dist, quat, qRing }
  }, [seg, sw])

  useFrame(({ clock }) => {
    if (!rotRef.current) return
    const bolls = getBallitas()
    let near = false
    for (let i = 0; i < bolls.length; i++) {
      const b = bolls[i]
      if (b.phase === 'travel' && b.seg === seg && Math.abs((b.segT ?? 0) - sw.u) < 0.12) { near = true; break }
    }
    rotRef.current.rotation.z = clock.elapsedTime * (near ? 8.0 : 2.2)
  })

  return (
    <group>
      <mesh geometry={geos.torus} material={mats.portalCyan} position={anchors.pFrom} quaternion={anchors.qRing} scale={[0.36, 0.36, 0.5]} />
      <group ref={rotRef} position={anchors.mid} quaternion={anchors.quat}>
        <mesh geometry={geos.capsule} material={mats.holoBridge} scale={[0.12, anchors.dist * 0.7, 0.12]} />
      </group>
      <mesh geometry={geos.torus} material={mats.portalPink} position={anchors.pTo} quaternion={anchors.qRing} scale={[0.34, 0.34, 0.5]} />
    </group>
  )
}

function NeonSwitches({ way }) {
  const items = useMemo(() => {
    const out = []
    for (const s of way.segments) {
      if (s.air) continue
      for (const sw of switchesOf(s)) out.push({ seg: s, sw, key: `${s.i}:${sw.u}:${sw.from}:${sw.to}` })
    }
    return out
  }, [way])
  if (!items.length) return null
  return <group>{items.map((it) => <SwitchMechanism key={it.key} seg={it.seg} sw={it.sw} />)}</group>
}

// ═══════════════════════════ COMPONENTE PRINCIPAL ═══════════════════════════
export default function Vida({ way, world, detail }) {
  return (
    <group name="vida-neon">
      <NeonTerrainAndSky way={way} detail={detail} />
      <NeonTrackDetails way={way} world={world} />
      <NeonDioramaProps way={way} />
      <NeonCast way={way} />
      <NeonEvents way={way} />
      <NeonSwitches way={way} />
      <Soundless />
    </group>
  )
}
