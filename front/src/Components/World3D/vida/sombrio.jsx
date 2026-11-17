// Vida del Camino Sombrío: diorama/terrario dentro del tubo de cristal (contrato en README.md).
// Todo vive dentro de seg.radius; terreno suave, cielo translúcido, elenco chibi, eventos por ruta y mecanismos de carril.
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
const ESTILO = { color: '#f3e8ff', bg: 'rgba(20,12,38,0.92)', border: '#b784ff', subColor: '#ffd480' }
const ESTILO_WARN = { color: '#ffe599', bg: 'rgba(34,14,48,0.92)', border: '#ff70c8', subColor: '#b784ff' }

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
    if (shadeTop) {
      const t = (pos.getY(i) - minY) / span
      cc.copy(c0).lerp(c1, t)
    } else {
      cc.copy(c0)
    }
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

// ───────────────────────── Elenco Chibi (estilo ballitas_chibi_hoja) ─────────────────────────
function buildChibiGhostGeos() {
  // Cuerpo tintable blanco (se tiñe con instanceColor)
  const dome = new THREE.SphereGeometry(0.42, 10, 8).scale(1.0, 1.08, 0.96).translate(0, 0.56, 0)
  const skirt = new THREE.CylinderGeometry(0.41, 0.50, 0.44, 10, 1, false).translate(0, 0.28, 0)
  const armL = new THREE.SphereGeometry(0.13, 8, 6).scale(0.85, 1.15, 0.85).translate(-0.42, 0.48, 0.14)
  const armR = new THREE.SphereGeometry(0.13, 8, 6).scale(0.85, 1.15, 0.85).translate(0.42, 0.48, 0.14)
  const body = mergeParts([
    prepGeo(dome, '#ffffff', '#e9dcff'),
    prepGeo(skirt, '#d8c4ff', '#ffffff'),
    prepGeo(armL, '#ffffff'),
    prepGeo(armR, '#ffffff'),
  ])

  // Cara fija: ojos grandes oscuros, brillos blancos, mejillas rosadas
  const eyeL = new THREE.SphereGeometry(0.095, 12, 10).scale(0.95, 1.2, 0.65).translate(-0.15, 0.60, 0.36)
  const eyeR = new THREE.SphereGeometry(0.095, 12, 10).scale(0.95, 1.2, 0.65).translate(0.15, 0.60, 0.36)
  const shineL = new THREE.SphereGeometry(0.032, 8, 8).translate(-0.125, 0.64, 0.415)
  const shineR = new THREE.SphereGeometry(0.032, 8, 8).translate(0.175, 0.64, 0.415)
  const cheekL = new THREE.SphereGeometry(0.068, 10, 8).scale(1.2, 0.78, 0.5).translate(-0.24, 0.47, 0.35)
  const cheekR = new THREE.SphereGeometry(0.068, 10, 8).scale(1.2, 0.78, 0.5).translate(0.24, 0.47, 0.35)
  const face = mergeParts([
    prepGeo(eyeL, '#180e29'), prepGeo(eyeR, '#180e29'),
    prepGeo(shineL, '#ffffff'), prepGeo(shineR, '#ffffff'),
    prepGeo(cheekL, '#ff8ac6'), prepGeo(cheekR, '#ff8ac6'),
  ])
  return { body, face }
}

function buildChibiCrowGeos() {
  // Cuervo gordito chibi
  const torso = new THREE.SphereGeometry(0.38, 16, 14).scale(1.0, 1.05, 1.08).translate(0, 0.40, 0)
  const crest = new THREE.SphereGeometry(0.14, 10, 10).scale(0.7, 1.25, 1.1).translate(0, 0.78, -0.04)
  const tail = new THREE.ConeGeometry(0.18, 0.42, 12).rotateX(-Math.PI * 0.65).translate(0, 0.25, -0.42)
  const wingL = new THREE.SphereGeometry(0.18, 12, 10).scale(0.45, 1.0, 1.35).translate(-0.36, 0.38, -0.02)
  const wingR = new THREE.SphereGeometry(0.18, 12, 10).scale(0.45, 1.0, 1.35).translate(0.36, 0.38, -0.02)
  const body = mergeParts([
    prepGeo(torso, '#cbd5ff', '#ffffff'),
    prepGeo(crest, '#b4c2ff'),
    prepGeo(tail, '#9aa8f0'),
    prepGeo(wingL, '#b4c2ff'),
    prepGeo(wingR, '#b4c2ff'),
  ])

  const beak = new THREE.ConeGeometry(0.095, 0.22, 12).rotateX(Math.PI * 0.5).translate(0, 0.45, 0.42)
  const eyeL = new THREE.SphereGeometry(0.075, 10, 8).translate(-0.15, 0.52, 0.31)
  const eyeR = new THREE.SphereGeometry(0.075, 10, 8).translate(0.15, 0.52, 0.31)
  const shineL = new THREE.SphereGeometry(0.025, 8, 8).translate(-0.135, 0.55, 0.37)
  const shineR = new THREE.SphereGeometry(0.025, 8, 8).translate(0.165, 0.55, 0.37)
  const footL = new THREE.SphereGeometry(0.07, 8, 8).scale(1.0, 0.55, 1.3).translate(-0.14, 0.05, 0.1)
  const footR = new THREE.SphereGeometry(0.07, 8, 8).scale(1.0, 0.55, 1.3).translate(0.14, 0.05, 0.1)
  const face = mergeParts([
    prepGeo(beak, '#ffb84d'),
    prepGeo(eyeL, '#0e0918'), prepGeo(eyeR, '#0e0918'),
    prepGeo(shineL, '#ffffff'), prepGeo(shineR, '#ffffff'),
    prepGeo(footL, '#ffb84d'), prepGeo(footR, '#ffb84d'),
  ])
  return { body, face }
}

function buildChibiBatGeos() {
  const head = new THREE.SphereGeometry(0.28, 16, 12).scale(1.05, 0.95, 0.95)
  const earL = new THREE.ConeGeometry(0.11, 0.24, 12).translate(-0.16, 0.29, 0)
  const earR = new THREE.ConeGeometry(0.11, 0.24, 12).translate(0.16, 0.29, 0)
  const eyeL = new THREE.SphereGeometry(0.055, 8, 8).translate(-0.10, 0.03, 0.24)
  const eyeR = new THREE.SphereGeometry(0.055, 8, 8).translate(0.10, 0.03, 0.24)
  const body = mergeParts([
    prepGeo(head, '#47306e', '#6f4ca8'),
    prepGeo(earL, '#5d3e91'),
    prepGeo(earR, '#5d3e91'),
    prepGeo(eyeL, '#ffd86b'),
    prepGeo(eyeR, '#ffd86b'),
  ])
  // Ala izquierda y derecha en una sola geometría suave arqueada (la animamos con squash X/Y en useFrame)
  const wingL = new THREE.SphereGeometry(0.32, 12, 10).scale(1.45, 0.14, 0.72).translate(-0.46, 0.04, -0.02)
  const wingR = new THREE.SphereGeometry(0.32, 12, 10).scale(1.45, 0.14, 0.72).translate(0.46, 0.04, -0.02)
  const wings = mergeParts([prepGeo(wingL, '#7851b8'), prepGeo(wingR, '#7851b8')])
  return { body, wings }
}

// ───────────────────────── Props del mini mundo (suaves) ─────────────────────────
function buildTombstoneGeo() {
  const base = new THREE.CylinderGeometry(0.26, 0.30, 0.12, 16).translate(0, 0.06, 0)
  const slab = new THREE.CapsuleGeometry(0.18, 0.24, 8, 14).scale(1.15, 1.0, 0.45).translate(0, 0.28, 0)
  const emblem = new THREE.TorusGeometry(0.075, 0.02, 8, 16).translate(0, 0.33, 0.085)
  return mergeParts([
    prepGeo(base, '#2f2942'),
    prepGeo(slab, '#4e456b', '#6f6494'),
    prepGeo(emblem, '#b784ff'),
  ])
}

function buildSpookyTreeGeo() {
  const trunk = new THREE.CylinderGeometry(0.07, 0.14, 0.56, 14).translate(0, 0.28, 0)
  const b1 = new THREE.CapsuleGeometry(0.045, 0.28, 6, 10).rotateZ(0.55).translate(-0.13, 0.54, 0.04)
  const b2 = new THREE.CapsuleGeometry(0.045, 0.26, 6, 10).rotateZ(-0.52).translate(0.13, 0.52, -0.04)
  const crown1 = new THREE.SphereGeometry(0.24, 14, 12).scale(1.15, 0.85, 1.1).translate(0, 0.74, 0)
  const crown2 = new THREE.SphereGeometry(0.16, 12, 10).translate(-0.19, 0.64, 0.05)
  const crown3 = new THREE.SphereGeometry(0.15, 12, 10).translate(0.19, 0.62, -0.05)
  return mergeParts([
    prepGeo(trunk, '#2a1d38', '#3c2a50'),
    prepGeo(b1, '#342347'), prepGeo(b2, '#342347'),
    prepGeo(crown1, '#362154', '#5c3c8a'),
    prepGeo(crown2, '#2d1c45', '#4f3278'),
    prepGeo(crown3, '#2d1c45', '#4f3278'),
  ])
}

function buildSpookyHouseGeo() {
  const wall = new THREE.CylinderGeometry(0.28, 0.32, 0.36, 16).translate(0, 0.18, 0)
  const roof = new THREE.ConeGeometry(0.38, 0.38, 16).translate(0, 0.53, 0)
  const chimney = new THREE.CylinderGeometry(0.05, 0.06, 0.22, 10).translate(0.14, 0.55, -0.06)
  const door = new THREE.CapsuleGeometry(0.065, 0.09, 6, 10).translate(0, 0.10, 0.28)
  const win = new THREE.SphereGeometry(0.06, 10, 8).scale(1.0, 1.2, 0.4).translate(0, 0.26, 0.27)
  return mergeParts([
    prepGeo(wall, '#2e2445', '#3e325c'),
    prepGeo(roof, '#4b2a72', '#26143d'),
    prepGeo(chimney, '#3a2d54'),
    prepGeo(door, '#1b132b'),
    prepGeo(win, '#ffcf6e'),
  ])
}

function buildLanternGeo() {
  const pole = new THREE.CylinderGeometry(0.025, 0.04, 0.58, 10).translate(0, 0.29, 0)
  const arm = new THREE.CapsuleGeometry(0.018, 0.14, 6, 8).rotateZ(Math.PI * 0.42).translate(0.07, 0.56, 0)
  const cap = new THREE.ConeGeometry(0.075, 0.07, 12).translate(0.13, 0.58, 0)
  return mergeParts([
    prepGeo(pole, '#2a2238', '#413557'),
    prepGeo(arm, '#382c4d'),
    prepGeo(cap, '#4e3b6b'),
  ])
}

function buildCandleGeo() {
  const wax = new THREE.CylinderGeometry(0.065, 0.075, 0.28, 12).translate(0, 0.14, 0)
  const drip = new THREE.SphereGeometry(0.072, 10, 8).scale(1, 0.45, 1).translate(0, 0.26, 0)
  return mergeParts([prepGeo(wax, '#efe6ff', '#ffffff'), prepGeo(drip, '#ffffff')])
}

function buildFlameGeo() {
  return prepGeo(new THREE.SphereGeometry(0.06, 10, 10).scale(0.75, 1.55, 0.75), '#ffcf5c', '#fff3c4')
}

function buildMushroomGeo() {
  const stem = new THREE.CylinderGeometry(0.055, 0.08, 0.18, 12).translate(0, 0.09, 0)
  const cap = new THREE.SphereGeometry(0.17, 14, 10, 0, TAU, 0, Math.PI * 0.58).scale(1.0, 0.78, 1.0).translate(0, 0.16, 0)
  return mergeParts([prepGeo(stem, '#dcd0f5'), prepGeo(cap, '#ffffff', '#e6cfff')])
}

function buildPumpkinGeo() {
  const body = new THREE.SphereGeometry(0.18, 16, 12).scale(1.18, 0.85, 1.12).translate(0, 0.15, 0)
  const stem = new THREE.CylinderGeometry(0.025, 0.04, 0.09, 8).translate(0, 0.32, 0)
  const e1 = new THREE.SphereGeometry(0.032, 8, 8).translate(-0.06, 0.17, 0.18)
  const e2 = new THREE.SphereGeometry(0.032, 8, 8).translate(0.06, 0.17, 0.18)
  return mergeParts([
    prepGeo(body, '#ff8e3c', '#ff6420'),
    prepGeo(stem, '#3e6e3e'),
    prepGeo(e1, '#fff3a8'),
    prepGeo(e2, '#fff3a8'),
  ])
}

function buildBleacherGeo() {
  // Grada suave escalonada de estadio sombrío (longitud en Z, subida en +Y, frente hacia -X)
  const s1 = new THREE.CylinderGeometry(0.20, 0.22, 1.35, 12).rotateX(Math.PI * 0.5).scale(0.45, 0.35, 1).translate(0, 0.07, 0)
  const s2 = new THREE.CylinderGeometry(0.20, 0.22, 1.35, 12).rotateX(Math.PI * 0.5).scale(0.45, 0.55, 1).translate(0.16, 0.14, 0)
  const s3 = new THREE.CylinderGeometry(0.20, 0.22, 1.35, 12).rotateX(Math.PI * 0.5).scale(0.45, 0.78, 1).translate(0.32, 0.22, 0)
  const rail = new THREE.CapsuleGeometry(0.025, 1.32, 6, 10).rotateX(Math.PI * 0.5).translate(-0.10, 0.14, 0)
  return mergeParts([
    prepGeo(s1, '#2a2042', '#3a2d59'),
    prepGeo(s2, '#2e2347', '#423366'),
    prepGeo(s3, '#332752', '#4c3a75'),
    prepGeo(rail, '#b784ff'),
  ])
}

function buildFlagGeo() {
  const pole = new THREE.CylinderGeometry(0.018, 0.024, 0.48, 8).translate(0, 0.24, 0)
  const flag = new THREE.ConeGeometry(0.11, 0.26, 10).rotateZ(-Math.PI * 0.5).scale(1, 0.75, 0.25).translate(0.13, 0.40, 0)
  return mergeParts([prepGeo(pole, '#3d3257'), prepGeo(flag, '#ffffff')])
}

function buildFenceGeo() {
  const pL = new THREE.CapsuleGeometry(0.024, 0.18, 6, 8).translate(0, 0.09, -0.45)
  const pR = new THREE.CapsuleGeometry(0.024, 0.18, 6, 8).translate(0, 0.09, 0.45)
  const bar = new THREE.CapsuleGeometry(0.018, 0.90, 6, 8).rotateX(Math.PI * 0.5).translate(0, 0.14, 0)
  return mergeParts([prepGeo(pL, '#3a2f52'), prepGeo(pR, '#3a2f52'), prepGeo(bar, '#9b6bff')])
}

function buildCrescentMoonGeo() {
  // Luna creciente estilizada en el cielo del tubo
  const outer = new THREE.TorusGeometry(0.28, 0.065, 12, 24, Math.PI * 1.35)
  return prepGeo(outer, '#e9dcff', '#fff4b8')
}

function buildEyePairGeo() {
  const l = new THREE.SphereGeometry(0.09, 12, 10).scale(1.2, 0.72, 0.5).translate(-0.13, 0, 0)
  const r = new THREE.SphereGeometry(0.09, 12, 10).scale(1.2, 0.72, 0.5).translate(0.13, 0, 0)
  return mergeParts([prepGeo(l, '#ffffff'), prepGeo(r, '#ffffff')])
}

// ───────────────────────── Geometrías cacheadas ─────────────────────────
let G_CACHE = null
function getGeos() {
  if (G_CACHE) return G_CACHE
  const ghost = buildChibiGhostGeos()
  const crow = buildChibiCrowGeos()
  const bat = buildChibiBatGeos()
  G_CACHE = markShared({
    ghostBody: ghost.body, ghostFace: ghost.face,
    crowBody: crow.body, crowFace: crow.face,
    batBody: bat.body, batWings: bat.wings,
    tomb: buildTombstoneGeo(),
    tree: buildSpookyTreeGeo(),
    house: buildSpookyHouseGeo(),
    lantern: buildLanternGeo(),
    candle: buildCandleGeo(),
    flame: buildFlameGeo(),
    mushroom: buildMushroomGeo(),
    pumpkin: buildPumpkinGeo(),
    bleacher: buildBleacherGeo(),
    flag: buildFlagGeo(),
    fence: buildFenceGeo(),
    moon: buildCrescentMoonGeo(),
    eyes: buildEyePairGeo(),
    sphere: new THREE.SphereGeometry(1, 10, 8),
    torus: new THREE.TorusGeometry(1, 0.026, 6, 18),
    arch: new THREE.TorusGeometry(1, 0.042, 6, 18, Math.PI),
    capsule: new THREE.CapsuleGeometry(0.5, 1.0, 4, 8),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1.0, 10),
    cone: new THREE.ConeGeometry(0.5, 1.0, 10),
  })
  return G_CACHE
}

let M_CACHE = null
function getMats() {
  if (M_CACHE) return M_CACHE
  M_CACHE = markShared({
    terrain: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.85, metalness: 0.08,
      emissive: '#1e1238', emissiveIntensity: 0.28, side: THREE.DoubleSide,
    }),
    vcSolid: new THREE.MeshStandardMaterial({
      vertexColors: true, roughness: 0.52, metalness: 0.14,
      emissive: '#221540', emissiveIntensity: 0.32,
    }),
    vcGlow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    glowPlain: new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }),
    portalArch: new THREE.MeshBasicMaterial({ color: '#c48aff', toneMapped: false }),
    halo: new THREE.MeshBasicMaterial({ color: '#c496ff', transparent: true, opacity: 0.20, depthWrite: false, toneMapped: false }),
    glowSoft: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false }),
    ectoplasm: new THREE.MeshBasicMaterial({ color: '#7dffcc', transparent: true, opacity: 0.64, depthWrite: false, toneMapped: false }),
    bridgeHolo: new THREE.MeshStandardMaterial({ color: '#b784ff', emissive: '#7e3ff2', emissiveIntensity: 1.0, transparent: true, opacity: 0.78, depthWrite: false }),
    gateMetal: new THREE.MeshStandardMaterial({ color: '#332454', roughness: 0.38, metalness: 0.68, emissive: '#6e34c9', emissiveIntensity: 0.55 }),
    aurora: new THREE.MeshBasicMaterial({ color: '#b784ff', transparent: true, opacity: 0.26, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  })
  return M_CACHE
}

// ───────────────────────── Texturas Canvas Cacheadas ─────────────────────────
const texMap = new Map()
function getCheckerTex(c1 = '#f4ebff', c2 = '#281642') {
  const key = `chk:${c1}:${c2}`
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
  const mat = markShared(new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.94, side: THREE.DoubleSide, depthWrite: false }))
  texMap.set(key, mat)
  return mat
}

function getCurbTexMat(label, bg = '#2b1947', stripe = '#b784ff', fg = '#f8f0ff') {
  const key = `curb:${label}:${bg}:${stripe}:${fg}`
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
    ctx.fillRect(0, 0, c.width, 20)
    ctx.fillRect(0, c.height - 20, c.width, 20)
    ctx.font = 'bold 46px system-ui, sans-serif'
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
  const mat = markShared(new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }))
  texMap.set(key, mat)
  return mat
}

// ───────────────────────── Bandas curvas sobre pista y bordillos ─────────────────────────
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

// ───────────────────────── Relieve del terreno por tramo ─────────────────────────
function sombrioHeight(seg, u, a) {
  const s = u * seg.length
  if (seg.kind === 'pantano') {
    const pool = Math.sin(s * 0.45 + a * 2.4) * Math.cos(s * 0.23 - a * 1.9)
    return THREE.MathUtils.clamp(0.45 + 0.45 * pool, 0.08, 0.95)
  }
  if (seg.route === 0) {
    // Ruta rápida: crestas longitudinales suaves
    return THREE.MathUtils.clamp(0.42 + 0.35 * Math.sin(s * 0.7 + a * 3.8), 0.1, 0.9)
  }
  if (seg.route === 1) {
    // Ruta lenta: lomas amplias y suaves de aldea
    return THREE.MathUtils.clamp(0.48 + 0.38 * Math.sin(s * 0.25 + a * 2.2) * Math.cos(s * 0.14), 0.12, 0.92)
  }
  return THREE.MathUtils.clamp(0.46 + 0.36 * Math.sin(s * 0.42 + a * 2.9) * Math.cos(s * 0.18 + a), 0.1, 0.92)
}

// ═══════════════════════════ TERRENO, CIELO Y AURORAS ═══════════════════════════
function SombrioTerrainAndSky({ way, detail }) {
  const geos = useMemo(() => {
    const terrains = []; const skies = []; const auroras = []
    for (const s of way.segments) {
      if (s.air) continue
      const isSwamp = s.kind === 'pantano'
      const colors = isSwamp
        ? ['#1d3b40', '#589c8d']
        : s.route === 0 ? ['#261745', '#8750d9']
          : s.route === 1 ? ['#2e224d', '#735ca8']
            : ['#2b1952', '#a059e3']
      terrains.push(buildTerrainGeo(s, {
        arc: Math.PI * 0.62,
        maxH: s.radius * 0.30,
        radial: 18,
        along: Math.min(120, Math.ceil(s.length * 1.0)),
        height: (u, a) => sombrioHeight(s, u, a),
        colors,
      }))
      skies.push(buildSkyGeo(s, {
        radial: 12,
        along: Math.min(60, Math.ceil(s.length * 0.5)),
        colors: s.route === 0 ? ['#120924', '#381563'] : ['#18102e', '#2f1c54'],
      }))
      if (s.kind === 'salida' || s.kind === 'llegada' || s.route === 2 || s.event) {
        // Banda de aurora espectral en el cielo interior superior
        auroras.push(buildTrackBandGeo(s, 0.5, 0.72, s.length * 0.38, 0.915))
      }
    }
    const tGeo = terrains.length ? mergeGeometries(terrains, false) : null
    terrains.forEach((g) => g.dispose())
    const sGeo = skies.length ? mergeGeometries(skies, false) : null
    skies.forEach((g) => g.dispose())
    const aGeo = auroras.length ? mergeGeometries(auroras, false) : null
    auroras.forEach((g) => g.dispose())
    return { tGeo, sGeo, aGeo }
  }, [way])

  const skyMat = useMemo(() => new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide,
  }), [])

  const auroraMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#c28aff', transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  }), [])

  useEffect(() => () => {
    geos.tGeo?.dispose(); geos.sGeo?.dispose(); geos.aGeo?.dispose()
    skyMat.dispose(); auroraMat.dispose()
  }, [geos, skyMat, auroraMat])

  useFrame(({ clock }) => {
    const det = detail?.value ?? 0
    skyMat.opacity = 0.14 + det * 0.36
    auroraMat.opacity = (0.10 + det * 0.14) * (0.75 + 0.25 * Math.sin(clock.elapsedTime * 1.4 + way.idx))
  })

  const mats = getMats()
  return (
    <group>
      {geos.tGeo && <mesh geometry={geos.tGeo} material={mats.terrain} receiveShadow />}
      {geos.sGeo && <mesh geometry={geos.sGeo} material={skyMat} />}
      {geos.aGeo && <mesh geometry={geos.aGeo} material={auroraMat} />}
    </group>
  )
}

// ═══════════════════════════ PÓRTICOS, LÍNEAS Y BORDILLOS ═══════════════════════════
function PortalGate({ seg, u, title, sub, style = ESTILO, emblem = '🌙' }) {
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
      <mesh geometry={geos.cyl} material={mats.gateMetal} position={data.pL.pos.clone().addScaledVector(data.pL.up, hPil * 0.5)} quaternion={data.pL.quat} scale={[0.12, hPil, 0.12]} />
      <mesh geometry={geos.cyl} material={mats.gateMetal} position={data.pR.pos.clone().addScaledVector(data.pR.up, hPil * 0.5)} quaternion={data.pR.quat} scale={[0.12, hPil, 0.12]} />
      <mesh geometry={geos.arch} material={mats.portalArch} position={data.archPos} quaternion={data.quat} scale={[data.R * 0.54, data.R * 0.52, 0.45]} />
      <Billboard text={`${emblem} ${title}`} style={{ ...style, sub }} height={0.30} position={data.signPos} quat={data.faceQ} glow={1.15} />
    </group>
  )
}

function SombrioTrackDetails({ way, world }) {
  const info = useMemo(() => routeInfo(way), [way])
  const destName = world?.nodes?.[way.to]?.name ?? 'Destino'

  const { checkMeshes, curbMeshes, portals } = useMemo(() => {
    const chks = []
    const curbs = []
    const ports = []

    for (const s of way.segments) {
      if (s.air) continue
      if (s.kind === 'salida') {
        chks.push(buildTrackBandGeo(s, 0.08, 0.36, 0.55, 0.968))
        curbs.push({ geo: buildCurbStripGeo(s, 0.03, 0.96, -1), label: 'CAMINO SOMBRIO · SALIDA' })
        curbs.push({ geo: buildCurbStripGeo(s, 0.03, 0.96, 1), label: 'CAMINO SOMBRIO · SALIDA' })
        ports.push({ seg: s, u: 0.06, title: 'CAMINO SOMBRÍO', sub: `Rumbo a ${destName}`, style: ESTILO, emblem: '🌑' })
      } else if (s.kind === 'llegada') {
        chks.push(buildTrackBandGeo(s, 0.88, 0.36, 0.65, 0.968))
        curbs.push({ geo: buildCurbStripGeo(s, 0.05, 0.95, -1), label: `META · ${destName.toUpperCase()}` })
        curbs.push({ geo: buildCurbStripGeo(s, 0.05, 0.95, 1), label: `META · ${destName.toUpperCase()}` })
        ports.push({ seg: s, u: 0.90, title: `META · ${destName}`, sub: 'Final del Camino Sombrío', style: ESTILO, emblem: '🏁' })
      } else if (s.event) {
        chks.push(buildTrackBandGeo(s, 0.06, 0.36, 0.42, 0.968))
        chks.push(buildTrackBandGeo(s, 0.94, 0.36, 0.42, 0.968))
        const rtLabel = s.route === 0 ? 'ZONA VELOZ' : s.route === 1 ? 'ALDEA OSCURA' : 'TEATRO ESPECTRAL'
        curbs.push({ geo: buildCurbStripGeo(s, 0.06, 0.94, -1), label: `${rtLabel} · ${s.name.toUpperCase()}` })
        curbs.push({ geo: buildCurbStripGeo(s, 0.06, 0.94, 1), label: `${rtLabel} · ${s.name.toUpperCase()}` })
        ports.push({ seg: s, u: 0.05, title: s.name, sub: `Ruta ${'ABC'[s.route] ?? 'A'} · Evento`, style: ESTILO_WARN, emblem: s.emoji })
      }
    }

    // Pórtico de bienvenida en la primera entrada propia de cada ruta
    for (const rt of info.routes) {
      const first = rt.segments.find((s) => s.route >= 0 && !s.air)
      if (first) {
        const sub = rt.r === 0 ? 'Ruta A · Catacumbas Veloz' : rt.r === 1 ? 'Ruta B · Aldea de las Velas' : 'Ruta C · Teatro Espectral'
        ports.push({ seg: first.seg, u: 0.07, title: `RUTA ${rt.name}`, sub, style: ESTILO, emblem: '🕯️' })
      }
    }

    const chkGeo = chks.length ? mergeGeometries(chks, false) : null
    chks.forEach((g) => g.dispose())
    return { checkMeshes: chkGeo, curbMeshes: curbs, portals: ports }
  }, [way, info, destName])

  useEffect(() => () => {
    checkMeshes?.dispose()
    curbMeshes.forEach((c) => c.geo.dispose())
  }, [checkMeshes, curbMeshes])

  const chkMat = getCheckerTex('#f3e8ff', '#231438')
  return (
    <group>
      {checkMeshes && <mesh geometry={checkMeshes} material={chkMat} />}
      {curbMeshes.map((c, idx) => (
        <mesh key={idx} geometry={c.geo} material={getCurbTexMat(c.label)} />
      ))}
      {portals.map((p, idx) => (
        <PortalGate key={idx} seg={p.seg} u={p.u} title={p.title} sub={p.sub} style={p.style} emblem={p.emblem} />
      ))}
      <CartelesDeRuta way={way} style={ESTILO} angle={0.92} u={0.14} height={0.34} pole={0.28} poleColor="#2e2445" />
    </group>
  )
}

// ═══════════════════════════ DECORACIÓN DEL DIORAMA POR TRAMO ═══════════════════════════
function SombrioDioramaProps({ way }) {
  const geos = getGeos()
  const mats = getMats()

  const built = useMemo(() => {
    const rng = mulberry32(way.idx * 9137 + 41)
    const info = routeInfo(way)
    const tombs = []; const trees = []; const houses = []; const lanterns = []; const halos = []
    const candles = []; const flames = []; const mushrooms = []; const pumpkins = []
    const bleachers = []; const spectatorBodies = []; const spectatorFaces = []
    const flags = []; const fences = []; const moons = []; const eyePairs = []; const airRings = []

    const addSpectatorsOnBleacher = (seg, u, sideSign, angleBase, count = 4) => {
      for (let k = 0; k < count; k++) {
        const uk = THREE.MathUtils.clamp(u + (k - (count - 1) * 0.5) * (0.34 / Math.max(seg.length, 1)), 0.02, 0.98)
        const row = k % 2
        const ang = angleBase + sideSign * (0.04 + row * 0.14)
        const off = 0.12 + row * 0.11
        const p = placeAlong(seg, uk, off, ang)
        const faceIn = new THREE.Quaternion().setFromAxisAngle(Y, sideSign > 0 ? -Math.PI * 0.5 : Math.PI * 0.5)
        const q = p.quat.clone().multiply(faceIn)
        const cols = ['#e9dcff', '#c9a6ff', '#a8ffd8', '#ffd89e']
        spectatorBodies.push({ pos: p.pos, quat: q, scale: 0.16, color: cols[(k + seg.i) % cols.length], basePos: p.pos.clone(), up: p.up.clone(), ph: rng() * TAU, seg })
        spectatorFaces.push({ pos: p.pos, quat: q, scale: 0.16 })
      }
    }

    for (const s of way.segments) {
      if (s.air) {
        // Contenido aéreo alrededor de tramos sin tubo (erupción, caída, portal)
        const nAir = Math.max(3, Math.floor(s.length / 8))
        for (let i = 1; i < nAir; i++) {
          const u = i / nAir
          const p = placeAlong(s, u, 0, 0)
          const rRing = s.radius * (0.95 + 0.15 * Math.sin(i))
          airRings.push({ pos: p.center, quat: p.quat, scale: [rRing, rRing, 0.5], color: i % 2 === 0 ? '#b784ff' : '#7dffcc' })
          for (const side of [-1, 1]) {
            const cp = p.center.clone().addScaledVector(p.side, side * s.radius * 0.85).addScaledVector(p.up, Math.sin(i * 1.7) * 0.4)
            candles.push({ pos: cp, quat: p.quat, scale: 0.7 })
            flames.push({ pos: cp.clone().addScaledVector(p.up, 0.24), quat: p.quat, scale: 0.9, basePos: cp.clone().addScaledVector(p.up, 0.24), up: p.up.clone(), ph: rng() * TAU })
          }
        }
        continue
      }

      const R = s.radius
      const maxH = R * 0.30
      const stepU = s.route === 0 ? 2.6 : s.route === 1 ? 2.8 : 2.7
      const nSlots = Math.max(3, Math.floor(s.length / stepU))

      // Lunas crecientes en el techo de salida, llegada y tramos largos
      if (s.kind === 'salida' || s.kind === 'llegada' || s.length > 18) {
        const pm = placeAlong(s, 0.5, 0.14, Math.PI * (rng() > 0.5 ? 0.85 : -0.85))
        moons.push({ pos: pm.pos, quat: pm.quat.clone().multiply(FLIP_Y), scale: 0.9 })
      }

      for (let i = 0; i < nSlots; i++) {
        const u = (i + 0.5) / nSlots
        const side = i % 2 === 0 ? 1 : -1

        // Vallas y banderines de pista en primer plano (ambos lados)
        for (const sgn of [-1, 1]) {
          const fenceA = sgn * 0.54
          const pf = placeAlong(s, u, sombrioHeight(s, u, fenceA) * maxH * 0.4, fenceA)
          fences.push({ pos: pf.pos, quat: pf.quat, scale: 0.78 })
        }
        if (i % 2 === 0) {
          const flA = -side * 0.56
          const pfl = placeAlong(s, u, 0.02, flA)
          const fCols = ['#8a5cf0', '#ff70c8', '#ffd480']
          flags.push({ pos: pfl.pos, quat: pfl.quat, scale: 0.78, color: fCols[i % fCols.length] })
        }

        // Farolas con halo de niebla alternadas
        if (i % 2 === 1 || s.kind === 'salida') {
          const la = side * (0.64 + rng() * 0.10)
          const off = sombrioHeight(s, u, la) * maxH * 0.55
          const pl = placeAlong(s, u, off, la)
          const inward = new THREE.Quaternion().setFromAxisAngle(Y, side > 0 ? Math.PI * 0.5 : -Math.PI * 0.5)
          const lq = pl.quat.clone().multiply(inward)
          lanterns.push({ pos: pl.pos, quat: lq, scale: 0.84 })
          const bulb = pl.pos.clone().addScaledVector(pl.up, 0.43).addScaledVector(pl.side, -side * 0.11)
          flames.push({ pos: bulb, quat: IDENT_Q, scale: 0.92, basePos: bulb.clone(), up: pl.up.clone(), ph: rng() * TAU })
          halos.push({ pos: bulb, quat: IDENT_Q, scale: 0.15 })
        }

        // Plano medio en ambos flancos según ruta y tipo de tramo
        for (const flSide of [-1, 1]) {
          if (flSide === side && i % 2 === 1) continue
          const midA = flSide * (0.72 + rng() * 0.28)
          if (laneGap(s, midA) <= 0.33) continue
          const midOff = sombrioHeight(s, u, midA) * maxH * 0.70
          const pm = placeAlong(s, u, midOff, midA)
          const rotQ = pm.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, rng() * TAU))

          if ((s.kind === 'salida' || s.kind === 'llegada' || s.route === 2) && i % 2 === 0 && flSide === -side) {
            const faceTrack = pm.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, flSide > 0 ? 0 : Math.PI))
            bleachers.push({ pos: pm.pos, quat: faceTrack, scale: 1.0 })
            addSpectatorsOnBleacher(s, u, flSide, midA, 4)
          } else if (s.route === 1) {
            if ((i + (flSide > 0 ? 1 : 0)) % 3 === 0) houses.push({ pos: pm.pos, quat: rotQ, scale: 0.92 + rng() * 0.22 })
            else if ((i + (flSide > 0 ? 1 : 0)) % 3 === 1) tombs.push({ pos: pm.pos, quat: rotQ, scale: 0.88 + rng() * 0.24 })
            else trees.push({ pos: pm.pos, quat: rotQ, scale: 0.95 + rng() * 0.24 })
          } else if (s.kind === 'pantano') {
            mushrooms.push({ pos: pm.pos, quat: rotQ, scale: 0.95 + rng() * 0.42, color: (i + flSide) % 2 === 0 ? '#5effb0' : '#b784ff' })
          } else {
            if ((i + (flSide > 0 ? 1 : 0)) % 2 === 0) tombs.push({ pos: pm.pos, quat: rotQ, scale: 0.90 + rng() * 0.24 })
            else trees.push({ pos: pm.pos, quat: rotQ, scale: 0.92 + rng() * 0.24 })
          }
        }

        // Velas flotantes y ojos parpadeantes en el cielo interior superior
        if (i % 2 === 0) {
          const ca = (rng() > 0.5 ? 1 : -1) * (1.25 + rng() * 0.75)
          const coff = 0.25 + rng() * (R * 0.35)
          const pc = placeAlong(s, u, coff, ca)
          candles.push({ pos: pc.pos, quat: pc.quat, scale: 0.72 })
          const flPos = pc.pos.clone().addScaledVector(pc.up, 0.23)
          flames.push({ pos: flPos, quat: pc.quat, scale: 0.85, basePos: flPos.clone(), up: pc.up.clone(), ph: rng() * TAU })
        }
        if (s.route === 0 || i % 3 === 0) {
          const ea = (rng() > 0.5 ? 1 : -1) * (1.85 + rng() * 0.9)
          const pe = placeAlong(s, u, 0.08, ea)
          const eyeCols = ['#ffd86b', '#ff6bcb', '#9b6bff', '#6bffdc']
          eyePairs.push({
            pos: pe.pos, quat: pe.quat.clone().multiply(FLIP_Y), scale: 0.85,
            color: eyeCols[Math.floor(rng() * eyeCols.length)],
            ph: rng() * TAU, speed: 0.8 + rng() * 1.4,
          })
        }
      }
    }

    // Hongos y calabazas extra con scatter respetando carriles
    for (const p of scatter(way, 45, rng, { angle: [-1.45, 1.45], clear: BALL_R * 0.85, scale: [0.65, 1.1] })) {
      const h = sombrioHeight(p.seg, p.u, p.angle) * (p.seg.radius * 0.27)
      const q = p.quat.clone().multiply(new THREE.Quaternion().setFromAxisAngle(Y, p.rnd * TAU))
      const pos = p.pos.clone().addScaledVector(p.up, h * 0.65)
      if (p.rnd > 0.45) mushrooms.push({ pos, quat: q, scale: p.scale, color: p.rnd > 0.72 ? '#b784ff' : '#5effb0' })
      else pumpkins.push({ pos, quat: q, scale: p.scale })
    }

    return {
      tombs, trees, houses, lanterns, halos, candles, flames, mushrooms, pumpkins,
      bleachers, spectatorBodies, spectatorFaces, flags, fences, moons, eyePairs, airRings, info,
    }
  }, [way])

  const eyeMesh = useInstanced(geos.eyes, mats.vcGlow, built.eyePairs)
  const flameMesh = useInstanced(geos.flame, mats.vcGlow, built.flames)
  const specBodyMesh = useInstanced(geos.ghostBody, mats.vcSolid, built.spectatorBodies)
  const specFaceMesh = useInstanced(geos.ghostFace, mats.vcSolid, built.spectatorFaces)

  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const tmpP = useMemo(() => new THREE.Vector3(), [])
  const tmpS = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const bolls = getBallitas()
    // Parpadeo de ojos en la oscuridad (suave y expresivo)
    for (let i = 0; i < built.eyePairs.length; i++) {
      const e = built.eyePairs[i]
      const blink = Math.pow(Math.abs(Math.sin(t * e.speed + e.ph)), 14)
      const sy = e.scale * (1 - blink * 0.9)
      tmpS.set(e.scale, Math.max(0.05, sy), e.scale)
      tmpM.compose(e.pos, e.quat, tmpS)
      eyeMesh.setMatrixAt(i, tmpM)
    }
    if (built.eyePairs.length) eyeMesh.instanceMatrix.needsUpdate = true

    // Llamas de velas y farolas que titilan suavemente
    for (let i = 0; i < built.flames.length; i++) {
      const f = built.flames[i]
      const pulse = 0.85 + 0.25 * Math.sin(t * 7.5 + f.ph)
      tmpP.copy(f.basePos).addScaledVector(f.up, Math.sin(t * 2.2 + f.ph) * 0.025)
      tmpS.set(f.scale * (0.9 + 0.1 * Math.cos(t * 5 + f.ph)), f.scale * pulse, f.scale)
      tmpM.compose(tmpP, f.quat, tmpS)
      flameMesh.setMatrixAt(i, tmpM)
    }
    if (built.flames.length) flameMesh.instanceMatrix.needsUpdate = true

    // Público chibi en gradas salta cuando pasa una ballita por su tramo
    for (let i = 0; i < built.spectatorBodies.length; i++) {
      const sp = built.spectatorBodies[i]
      let active = false
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase === 'travel' && b.seg === sp.seg) { active = true; break }
      }
      const freq = active ? 11.0 : 2.6
      const amp = active ? 0.12 : 0.025
      const jump = Math.abs(Math.sin(t * freq + sp.ph)) * amp
      tmpP.copy(sp.basePos).addScaledVector(sp.up, jump)
      tmpS.setScalar(sp.scale)
      tmpM.compose(tmpP, sp.quat, tmpS)
      specBodyMesh.setMatrixAt(i, tmpM)
      specFaceMesh.setMatrixAt(i, tmpM)
    }
    if (built.spectatorBodies.length) {
      specBodyMesh.instanceMatrix.needsUpdate = true
      specFaceMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      <Instanced geo={geos.tomb} mat={mats.vcSolid} items={built.tombs} />
      <Instanced geo={geos.tree} mat={mats.vcSolid} items={built.trees} />
      <Instanced geo={geos.house} mat={mats.vcSolid} items={built.houses} />
      <Instanced geo={geos.lantern} mat={mats.vcSolid} items={built.lanterns} />
      <Instanced geo={geos.sphere} mat={mats.halo} items={built.halos} />
      <Instanced geo={geos.candle} mat={mats.vcSolid} items={built.candles} />
      <Instanced geo={geos.mushroom} mat={mats.vcGlow} items={built.mushrooms} />
      <Instanced geo={geos.pumpkin} mat={mats.vcSolid} items={built.pumpkins} />
      <Instanced geo={geos.bleacher} mat={mats.vcSolid} items={built.bleachers} />
      <Instanced geo={geos.flag} mat={mats.vcSolid} items={built.flags} />
      <Instanced geo={geos.fence} mat={mats.vcSolid} items={built.fences} />
      <Instanced geo={geos.moon} mat={mats.vcGlow} items={built.moons} />
      <Instanced geo={geos.torus} mat={mats.glowPlain} items={built.airRings} />
      {built.eyePairs.length > 0 && <primitive object={eyeMesh} />}
      {built.flames.length > 0 && <primitive object={flameMesh} />}
      {built.spectatorBodies.length > 0 && <primitive object={specBodyMesh} />}
      {built.spectatorFaces.length > 0 && <primitive object={specFaceMesh} />}
    </group>
  )
}

// ═══════════════════════════ ELENCO CHIBI ANIMADO ═══════════════════════════
// Fantasmas patrullando, cuervos dormidos/alerta en lápidas y bandadas de murciélagos en el techo.
function SombrioCast({ way }) {
  const geos = getGeos()
  const mats = getMats()
  const info = useMemo(() => routeInfo(way), [way])

  const ghostData = useMemo(() => {
    const rng = mulberry32(way.idx * 4211 + 7)
    const out = []
    info.routes.forEach((rt, r) => {
      const path = segPath(rt.segments.map((s) => s.seg))
      if (!path.total) return
      const count = r === 1 ? 16 : 12
      const cols = r === 0 ? ['#d4b2ff', '#ff9ae5'] : r === 1 ? ['#efe6ff', '#a8ffd8'] : ['#c7a3ff', '#ffe299']
      const baseSpeed = r === 0 ? 0.95 : r === 1 ? 0.42 : 0.72
      for (let i = 0; i < count; i++) {
        out.push({
          path, s: ((i + rng() * 0.7) / count) * path.total, dir: rng() > 0.5 ? 1 : -1,
          v: baseSpeed * (0.7 + rng() * 0.6), ph: rng() * TAU,
          a: (i % 2 === 0 ? 1 : -1) * (0.70 + rng() * 0.28),
          excite: 0, flee: 0, scale: 0.26, color: cols[i % cols.length],
        })
      }
    })
    return out
  }, [info, way.idx])

  const ghostItems = useMemo(() => ghostData.map((g) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: g.scale, color: g.color })), [ghostData])
  const ghostBodyMesh = useInstanced(geos.ghostBody, mats.vcSolid, ghostItems)
  const ghostFaceMesh = useInstanced(geos.ghostFace, mats.vcSolid, ghostItems)

  // Bandada de murciélagos volando en el techo por cada ruta
  const batData = useMemo(() => {
    const rng = mulberry32(way.idx * 5381 + 17)
    const paths = info.routes.map((rt) => segPath(rt.segments.map((s) => s.seg)))
    const bats = []
    paths.forEach((p, r) => {
      if (!p.total) return
      for (let i = 0; i < 6; i++) {
        bats.push({
          path: p, s: rng() * p.total, dir: rng() > 0.5 ? 1 : -1,
          v: (r === 0 ? 2.4 : 1.4) * (0.8 + rng() * 0.5),
          angle: (rng() > 0.5 ? 1 : -1) * (2.15 + rng() * 0.65),
          off: 0.18 + rng() * 0.35, ph: rng() * TAU, scale: 0.16 + rng() * 0.05,
        })
      }
    })
    return bats
  }, [info, way.idx])

  // Cuervos chibi posados en lápidas/orillas (en Ruta B duermen y despiertan sobresaltados)
  const crowData = useMemo(() => {
    const rng = mulberry32(way.idx * 6131 + 9)
    const items = scatter(way, 24, rng, { angle: [-1.15, 1.15], clear: BALL_R * 0.78, scale: [0.17, 0.22] })
    return items.map((it) => ({
      ...it,
      sleepy: it.seg.route === 1 || it.rnd < 0.45,
      awake: 0,
      ph: rng() * TAU,
      color: it.rnd > 0.5 ? '#261e3d' : '#1b2038',
    }))
  }, [way])

  const batItems = useMemo(() => batData.map((b) => ({ pos: new THREE.Vector3(), quat: IDENT_Q, scale: b.scale })), [batData])
  const batBodyMesh = useInstanced(geos.batBody, mats.vcSolid, batItems)
  const batWingMesh = useInstanced(geos.batWings, mats.vcSolid, batItems)

  const crowItems = useMemo(() => crowData.map((c) => ({ pos: c.pos, quat: c.quat, scale: c.scale, color: c.color })), [crowData])
  const crowBodyMesh = useInstanced(geos.crowBody, mats.vcSolid, crowItems)
  const crowFaceMesh = useInstanced(geos.crowFace, mats.vcSolid, crowItems)

  const tmp = useMemo(() => ({
    loc: {}, pl: makePlacement(), sc: new THREE.Vector3(), wsc: new THREE.Vector3(),
    m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(),
    flip: new THREE.Quaternion().setFromAxisAngle(Y, Math.PI),
  }), [])

  useFrame(({ clock }, dt) => {
    const h = Math.min(dt, 0.1)
    const t = clock.elapsedTime
    const bolls = getBallitas()

    // Fantasmas chibi patrullando y saludando/apartándose al paso de ballitas
    for (let i = 0; i < ghostData.length; i++) {
      const g = ghostData[i]
      g.s += g.dir * g.v * h * (1 + g.excite * 1.4)
      if (g.s > g.path.total) { g.s = g.path.total; g.dir = -1 }
      if (g.s < 0) { g.s = 0; g.dir = 1 }
      let near = 0; let fleeDir = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = g.path.arcOf(b.seg, b.segT ?? 0)
        if (arc == null) continue
        const d = Math.abs(arc - g.s)
        if (d < 3.4) {
          const k01 = 1 - d / 3.4
          if (k01 > near) { near = k01; fleeDir = Math.sign(g.a - (b.roll ?? 0)) || 1 }
        }
      }
      g.excite = THREE.MathUtils.damp(g.excite, near, near > g.excite ? 9 : 2.5, h)
      g.flee = THREE.MathUtils.damp(g.flee, fleeDir * near * 0.35, 4, h)
      g.path.locate(g.s, tmp.loc)
      const bob = Math.abs(Math.sin(t * 5 * g.v + g.ph)) * 0.08
      const jump = g.excite * 0.28 * Math.abs(Math.sin(t * 9 + g.ph))
      const ang = g.a + Math.sin(t * 0.7 + g.ph) * 0.14 + g.flee
      placeAlongInto(tmp.loc.seg, tmp.loc.u, 0.14 + bob + jump, ang, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (g.dir < 0) tmp.q.multiply(tmp.flip)
      const squash = 1 + Math.sin(t * 10 * g.v + g.ph) * 0.07
      tmp.sc.set(g.scale / squash, g.scale * squash, g.scale / squash)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      ghostBodyMesh.setMatrixAt(i, tmp.m)
      ghostFaceMesh.setMatrixAt(i, tmp.m)
    }
    if (ghostData.length) {
      ghostBodyMesh.instanceMatrix.needsUpdate = true
      ghostFaceMesh.instanceMatrix.needsUpdate = true
    }

    // Murciélagos aleteando
    for (let i = 0; i < batData.length; i++) {
      const b = batData[i]
      b.s += b.dir * b.v * h
      if (b.s > b.path.total) { b.s = b.path.total; b.dir = -1 }
      if (b.s < 0) { b.s = 0; b.dir = 1 }
      b.path.locate(b.s, tmp.loc)
      const flap = Math.sin(t * 14 + b.ph)
      const hover = flap * 0.04
      placeAlongInto(tmp.loc.seg, tmp.loc.u, b.off + hover, b.angle + Math.sin(t * 1.5 + b.ph) * 0.12, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (b.dir < 0) tmp.q.multiply(tmp.flip)
      tmp.sc.setScalar(b.scale)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      batBodyMesh.setMatrixAt(i, tmp.m)
      tmp.wsc.set(b.scale * (0.9 + 0.2 * flap), b.scale * (0.45 + 0.85 * Math.abs(flap)), b.scale)
      tmp.m.compose(tmp.pl.pos, tmp.q, tmp.wsc)
      batWingMesh.setMatrixAt(i, tmp.m)
    }
    if (batData.length) {
      batBodyMesh.instanceMatrix.needsUpdate = true
      batWingMesh.instanceMatrix.needsUpdate = true
    }

    // Cuervos: duermen con cabeceo lento y saltan cuando pasa una ballita
    for (let i = 0; i < crowData.length; i++) {
      const c = crowData[i]
      let near = 0
      for (let k = 0; k < bolls.length; k++) {
        const bl = bolls[k]
        if (bl.phase === 'travel' && bl.seg === c.seg) {
          const d = Math.abs((bl.segT ?? 0) - c.u) * c.seg.length
          if (d < 4.5) near = Math.max(near, 1 - d / 4.5)
        }
      }
      c.awake = THREE.MathUtils.damp(c.awake, near, near > c.awake ? 10 : 2.2, h)
      const hop = c.awake * 0.18 * Math.abs(Math.sin(t * 12 + c.ph))
      const breath = c.sleepy && c.awake < 0.1 ? 1 + 0.08 * Math.sin(t * 2.2 + c.ph) : 1
      tmp.p.copy(c.pos).addScaledVector(c.up, hop)
      tmp.q.copy(c.quat)
      tmp.sc.set(c.scale * breath, c.scale / breath, c.scale * breath)
      tmp.m.compose(tmp.p, tmp.q, tmp.sc)
      crowBodyMesh.setMatrixAt(i, tmp.m)
      crowFaceMesh.setMatrixAt(i, tmp.m)
    }
    if (crowData.length) {
      crowBodyMesh.instanceMatrix.needsUpdate = true
      crowFaceMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group>
      {ghostData.length > 0 && <>
        <primitive object={ghostBodyMesh} />
        <primitive object={ghostFaceMesh} />
      </>}
      {batData.length > 0 && <>
        <primitive object={batBodyMesh} />
        <primitive object={batWingMesh} />
      </>}
      {crowData.length > 0 && <>
        <primitive object={crowBodyMesh} />
        <primitive object={crowFaceMesh} />
      </>}
    </group>
  )
}

// ═══════════════════════════ EVENTOS PERSONALIZADOS POR RUTA ═══════════════════════════
// Ruta A (r=0): Puertas encantadas que se abren + olas de ectoplasma
// Ruta B (r=1): Puente espectral que se ensambla en tramos + espiral de velas doradas
// Ruta C (r=2): Órgano de ojos gigantes y reflectores de estadio que cambian al color de la ballita
// Llegada: Fuegos artificiales espectrales al cruzar la meta
function EventHauntedGate({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const gateLRef = useRef()
  const gateRRef = useRef()
  const waveRef = useRef()

  const anchors = useMemo(() => {
    const p0 = placeAlong(seg, 0.18, 0.04, 0)
    const pL = placeAlong(seg, 0.18, 0.04, -0.52)
    const pR = placeAlong(seg, 0.18, 0.04, 0.52)
    const pillars = [0.25, 0.45, 0.65, 0.85].map((u, idx) => ({
      l: placeAlong(seg, u, 0.04, -0.68),
      r: placeAlong(seg, u, 0.04, 0.68),
      idx,
    }))
    return { p0, pL, pR, pillars, R: seg.radius }
  }, [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const open = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.35 : 0.08
    if (gateLRef.current) gateLRef.current.rotation.y = THREE.MathUtils.damp(gateLRef.current.rotation.y, open * 1.15, 6, 0.03)
    if (gateRRef.current) gateRRef.current.rotation.y = THREE.MathUtils.damp(gateRRef.current.rotation.y, -open * 1.15, 6, 0.03)
    if (waveRef.current) {
      const s = 0.6 + stage.intensity * (0.7 + 0.25 * Math.sin(t * 8))
      waveRef.current.scale.setScalar(s)
    }
  })

  return (
    <group>
      <group position={anchors.pL.pos} quaternion={anchors.pL.quat}>
        <group ref={gateLRef}>
          <mesh geometry={geos.cyl} material={mats.gateMetal} position={[0.25, 0.55, 0]} scale={[0.45, 1.05, 0.08]} />
        </group>
      </group>
      <group position={anchors.pR.pos} quaternion={anchors.pR.quat}>
        <group ref={gateRRef}>
          <mesh geometry={geos.cyl} material={mats.gateMetal} position={[-0.25, 0.55, 0]} scale={[0.45, 1.05, 0.08]} />
        </group>
      </group>
      <group ref={waveRef} position={anchors.p0.pos.clone().addScaledVector(anchors.p0.up, anchors.R * 0.72)} quaternion={anchors.p0.quat}>
        <mesh geometry={geos.torus} material={mats.ectoplasm} scale={[anchors.R * 0.45, anchors.R * 0.45, 0.6]} />
      </group>
      {anchors.pillars.map((pl) => (
        <group key={pl.idx}>
          <mesh geometry={geos.capsule} material={mats.ectoplasm} position={pl.l.pos.clone().addScaledVector(pl.l.up, 0.32)} quaternion={pl.l.quat} scale={[0.10, 0.45, 0.10]} />
          <mesh geometry={geos.capsule} material={mats.ectoplasm} position={pl.r.pos.clone().addScaledVector(pl.r.up, 0.32)} quaternion={pl.r.quat} scale={[0.10, 0.45, 0.10]} />
        </group>
      ))}
    </group>
  )
}

function EventSpectralBridge({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const slatsRef = useRef([])
  const ringRef = useRef()

  const slats = useMemo(() => {
    const out = []
    for (let i = 0; i < 6; i++) {
      const u = 0.2 + i * 0.12
      out.push({ l: placeAlong(seg, u, 0.05, -0.58), r: placeAlong(seg, u, 0.05, 0.58), idx: i })
    }
    return out
  }, [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const lift = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? 0.55 : 0.15
    for (let i = 0; i < slats.length; i++) {
      const m = slatsRef.current[i]
      if (!m) continue
      const wave = 0.5 + 0.5 * Math.sin(t * 3.5 - i * 0.7)
      m.scale.y = 0.2 + lift * (0.55 + 0.3 * wave)
    }
    if (ringRef.current) ringRef.current.rotation.z = t * (0.6 + stage.intensity * 1.8)
  })

  const mid = useMemo(() => placeAlong(seg, 0.5, seg.radius * 0.85, 0), [seg])
  return (
    <group>
      {slats.map((sl, idx) => (
        <group key={idx}>
          <mesh
            ref={(el) => { slatsRef.current[idx] = el }}
            geometry={geos.capsule} material={mats.bridgeHolo}
            position={sl.l.pos.clone().addScaledVector(sl.l.up, 0.28)} quaternion={sl.l.quat}
            scale={[0.12, 0.45, 0.22]}
          />
          <mesh
            geometry={geos.capsule} material={mats.bridgeHolo}
            position={sl.r.pos.clone().addScaledVector(sl.r.up, 0.28)} quaternion={sl.r.quat}
            scale={[0.12, 0.45, 0.22]}
          />
        </group>
      ))}
      <group ref={ringRef} position={mid.pos} quaternion={mid.quat}>
        <mesh geometry={geos.torus} material={mats.glowSoft} scale={[seg.radius * 0.42, seg.radius * 0.42, 0.5]} />
      </group>
    </group>
  )
}

function EventOrganStage({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const pipesRef = useRef([])
  const reactMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#c87eff', transparent: true, opacity: 0.78, depthWrite: false, toneMapped: false }), [])
  useEffect(() => () => reactMat.dispose(), [reactMat])

  const pipes = useMemo(() => {
    const out = []
    for (let i = 0; i < 8; i++) {
      const u = 0.16 + i * 0.09
      const side = i % 2 === 0 ? -1 : 1
      out.push({ p: placeAlong(seg, u, 0.04, side * 0.72), idx: i })
    }
    return out
  }, [seg])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const speedFactor = stage.ballita ? THREE.MathUtils.clamp((stage.ballita.speed ?? 12) / 14, 0.7, 2.2) : 1
    if (stage.ballita?.genome) {
      reactMat.color.setHSL(stage.ballita.genome.hue, 0.85, 0.65)
    } else {
      reactMat.color.set('#c87eff')
    }
    for (let i = 0; i < pipes.length; i++) {
      const m = pipesRef.current[i]
      if (!m) continue
      const bar = 0.35 + (0.35 + stage.intensity * 0.85) * (0.5 + 0.5 * Math.sin(t * 6.5 * speedFactor + i * 0.9))
      m.scale.y = bar
    }
  })

  return (
    <group>
      {pipes.map((pp, idx) => (
        <mesh
          key={idx}
          ref={(el) => { pipesRef.current[idx] = el }}
          geometry={geos.cyl} material={reactMat}
          position={pp.p.pos.clone().addScaledVector(pp.p.up, 0.42)} quaternion={pp.p.quat}
          scale={[0.11, 0.65, 0.11]}
        />
      ))}
    </group>
  )
}

function FinishFireworks({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const sparks = useMemo(() => {
    const rng = mulberry32(seg.i * 997 + 31)
    const cols = ['#b784ff', '#ffd86b', '#ff6bcb', '#7dffcc']
    const out = []
    for (let i = 0; i < 18; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const p = placeAlong(seg, 0.84 + (i % 3) * 0.04, 0.08, side * (0.58 + rng() * 0.3))
      const dir = p.up.clone().addScaledVector(p.side, -side * (0.2 + rng() * 0.5)).addScaledVector(p.tangent, (rng() - 0.5) * 0.4).normalize()
      out.push({ base: p.pos.clone(), dir, ph: rng() * TAU, color: cols[i % cols.length] })
    }
    return out
  }, [seg])

  const mats = getMats()
  const items = useMemo(() => sparks.map((s) => ({ pos: s.base, quat: IDENT_Q, scale: 0.07, color: s.color })), [sparks])
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
      const k = ((t * (1.2 + boost * 0.8) + s.ph) % 1)
      tmpP.copy(s.base).addScaledVector(s.dir, k * seg.radius * 0.85 * boost)
      const sz = (1 - k) * 0.085 * (0.4 + stage.intensity * 0.9)
      tmpS.setScalar(Math.max(0.005, sz))
      tmpM.compose(tmpP, IDENT_Q, tmpS)
      mesh.setMatrixAt(i, tmpM)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}

function EventAirVortex({ stage, info }) {
  const seg = info.segment
  const geos = getGeos()
  const mats = getMats()
  const ringsRef = useRef([])
  const rings = useMemo(() => [0.22, 0.5, 0.78].map((u, idx) => ({ p: placeAlong(seg, u, 0, 0), idx })), [seg])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    for (let i = 0; i < rings.length; i++) {
      const m = ringsRef.current[i]
      if (!m) continue
      const sc = seg.radius * (0.9 + 0.25 * stage.intensity + 0.1 * Math.sin(t * 5 + i))
      m.scale.set(sc, sc, 0.6)
      m.rotation.z = t * (i % 2 === 0 ? 1.8 : -2.2) * (1 + stage.intensity)
    }
  })
  return (
    <group>
      {rings.map((r, idx) => (
        <mesh
          key={idx}
          ref={(el) => { ringsRef.current[idx] = el }}
          geometry={geos.torus} material={mats.portalArch}
          position={r.p.center} quaternion={r.p.quat}
        />
      ))}
    </group>
  )
}

function SombrioEvents({ way }) {
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
              ev.seg.air ? <EventAirVortex stage={stage} info={stInfo} />
                : rt === 0 ? <EventHauntedGate stage={stage} info={stInfo} />
                  : rt === 1 ? <EventSpectralBridge stage={stage} info={stInfo} />
                    : <EventOrganStage stage={stage} info={stInfo} />
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
// Contrato: segment.switches[] con { u, from, to, kind, duration } y laneFrame(seg, laneId, u).
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
    rotRef.current.rotation.z = clock.elapsedTime * (near ? 6.5 : 1.8)
  })

  return (
    <group>
      {/* Ancla de entrada sobre el riel `from` */}
      <mesh geometry={geos.torus} material={mats.portalArch} position={anchors.pFrom} quaternion={anchors.qRing} scale={[0.36, 0.36, 0.5]} />
      {/* Conector temático del mecanismo */}
      <group ref={rotRef} position={anchors.mid} quaternion={anchors.quat}>
        <mesh geometry={geos.capsule} material={mats.bridgeHolo} scale={[0.12, anchors.dist * 0.7, 0.12]} />
      </group>
      {/* Ancla de salida sobre el riel `to` */}
      <mesh geometry={geos.torus} material={mats.ectoplasm} position={anchors.pTo} quaternion={anchors.qRing} scale={[0.34, 0.34, 0.5]} />
    </group>
  )
}

function SombrioSwitches({ way }) {
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
    <group name="vida-sombrio">
      <SombrioTerrainAndSky way={way} detail={detail} />
      <SombrioTrackDetails way={way} world={world} />
      <SombrioDioramaProps way={way} />
      <SombrioCast way={way} />
      <SombrioEvents way={way} />
      <SombrioSwitches way={way} />
      <Soundless />
    </group>
  )
}
