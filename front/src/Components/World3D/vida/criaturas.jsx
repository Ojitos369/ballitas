// Fauna viva que recorre TODO el camino (bandadas, peces, mariposas, luciérnagas, murciélagos,
// medusas) + habitantes de berma. Todo instanciado con un único useFrame por camino que solo
// actualiza el uniform de tiempo y las matrices de los ejemplares cercanos a la cámara.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  getBallitas,
  getWayBoundingSphere,
  getWayDetail,
  markShared,
  mergeColoredParts,
  minSegDistSq,
  mulberry32,
  segPath,
} from './base.jsx'
import { basisQuat } from './dyn.js'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, halfWidth, lanesOf, surfFrame } from './pista.jsx'
import { TRACK_K } from '../../../Core/world.js'

const PI2 = Math.PI / 2
const TAU = Math.PI * 2
const CAM_RANGE_SQ = 155 * 155
const FAUNA_TIME = { value: 0 }

const THEME_FAUNA = {
  bosque: {
    primary: { kind: 'butterfly', count: 44, speed: [5.5, 9.5], scale: [0.55, 0.95], y: [1.8, 4.8], lat: [-4.5, 4.5], flock: 3, colors: ['#ffd54f', '#ff8a65', '#9cff6b', '#7fe0ff'] },
    wisp: { kind: 'firefly', count: 64, speed: [1.8, 4.0], scale: [0.24, 0.42], y: [0.6, 3.2], lat: 'berm', colors: ['#d4ff5a', '#ffe875', '#a8ff78'] },
    critter: ['#f28b45', '#fff0d7', '#3d2524'],
  },
  mar: {
    primary: { kind: 'fish', count: 48, speed: [6.5, 11.5], scale: [0.65, 1.1], y: [2.0, 5.2], lat: [-5.2, 5.2], flock: 4, colors: ['#ff9671', '#ffc75f', '#38d6ff', '#ff6f91'] },
    wisp: { kind: 'jelly', count: 32, speed: [2.0, 3.8], scale: [0.5, 0.85], y: [2.2, 5.6], lat: 'berm', colors: ['#ff6fa5', '#bff3ff', '#6cf0ff'] },
    critter: ['#43c4d1', '#fff2db', '#173c59'],
  },
  desierto: {
    primary: { kind: 'bird', count: 36, speed: [8.0, 13.0], scale: [0.7, 1.15], y: [3.2, 6.8], lat: [-5.5, 5.5], flock: 3, colors: ['#ffd27a', '#ff9b54', '#ffe8b8', '#e68a45'] },
    wisp: { kind: 'firefly', count: 48, speed: [2.5, 5.0], scale: [0.22, 0.38], y: [0.5, 2.8], lat: 'berm', colors: ['#ffe28a', '#ffb347', '#fff0b8'] },
    critter: ['#e7a64b', '#ffe3ae', '#50351f'],
  },
  hielo: {
    primary: { kind: 'bird', count: 38, speed: [7.5, 12.0], scale: [0.65, 1.1], y: [3.0, 6.4], lat: [-5.0, 5.0], flock: 3, colors: ['#ffffff', '#bff3ff', '#8cd4fa'] },
    wisp: { kind: 'firefly', count: 56, speed: [1.8, 3.6], scale: [0.22, 0.4], y: [0.7, 3.4], lat: 'berm', colors: ['#bff3ff', '#e8fbff', '#7ce8ff'] },
    critter: ['#91d9ff', '#f4fbff', '#24405a'],
  },
  volcan: {
    primary: { kind: 'bat', count: 40, speed: [7.5, 12.5], scale: [0.65, 1.05], y: [2.4, 5.8], lat: [-5.0, 5.0], flock: 3, colors: ['#ff5a1f', '#ff8a3d', '#ffd166', '#d63b18'] },
    wisp: { kind: 'firefly', count: 64, speed: [2.5, 5.5], scale: [0.24, 0.44], y: [0.5, 3.6], lat: 'berm', colors: ['#ff7b29', '#ff3b08', '#ffcc44'] },
    critter: ['#ff7645', '#ffd166', '#3c2020'],
  },
  cristal: {
    primary: { kind: 'butterfly', count: 44, speed: [6.0, 10.0], scale: [0.55, 0.95], y: [1.8, 5.0], lat: [-4.6, 4.6], flock: 3, colors: ['#7df9ff', '#ff7de9', '#b894ff', '#7dffb2'] },
    wisp: { kind: 'firefly', count: 60, speed: [2.0, 4.2], scale: [0.24, 0.42], y: [0.6, 3.6], lat: 'berm', colors: ['#7df9ff', '#ff7de9', '#d4c2ff'] },
    critter: ['#b8a3ff', '#effaff', '#3a285f'],
  },
  nubes: {
    primary: { kind: 'bird', count: 44, speed: [7.5, 12.5], scale: [0.65, 1.1], y: [2.8, 6.4], lat: [-5.5, 5.5], flock: 4, colors: ['#ffffff', '#fff2a8', '#a8dcff', '#ffd6eb'] },
    wisp: { kind: 'firefly', count: 52, speed: [2.0, 4.0], scale: [0.24, 0.42], y: [0.8, 3.8], lat: 'berm', colors: ['#fff2a8', '#ffffff', '#ffd54f'] },
    critter: ['#ff9ecf', '#ffffff', '#553c78'],
  },
  neon: {
    primary: { kind: 'jelly', count: 38, speed: [5.0, 8.8], scale: [0.6, 1.0], y: [2.4, 5.6], lat: [-5.0, 5.0], flock: 2, colors: ['#ff2bd6', '#2bffe8', '#fff22b'] },
    wisp: { kind: 'firefly', count: 64, speed: [4.5, 8.5], scale: [0.22, 0.4], y: [0.6, 3.6], lat: 'berm', colors: ['#2bffe8', '#ff2bd6', '#ffe600'] },
    critter: ['#45f4d0', '#ff64dc', '#15233b'],
  },
  jardin: {
    primary: { kind: 'butterfly', count: 50, speed: [5.5, 9.2], scale: [0.55, 0.95], y: [1.6, 4.6], lat: [-4.5, 4.5], flock: 3, colors: ['#ff6fa5', '#ffd24a', '#b06bff', '#ff8a5c', '#7fe09a'] },
    wisp: { kind: 'firefly', count: 58, speed: [1.8, 3.8], scale: [0.22, 0.4], y: [0.5, 3.0], lat: 'berm', colors: ['#ffd24a', '#ffb8dc', '#a8ff9e'] },
    critter: ['#f06fa5', '#ffe5aa', '#4b2b48'],
  },
  sombrio: {
    primary: { kind: 'bat', count: 42, speed: [7.0, 11.5], scale: [0.65, 1.05], y: [2.2, 5.6], lat: [-5.0, 5.0], flock: 3, colors: ['#8a5cf0', '#b784ff', '#5b3f8a', '#d39bff'] },
    wisp: { kind: 'firefly', count: 60, speed: [1.8, 3.6], scale: [0.24, 0.44], y: [0.6, 3.4], lat: 'berm', colors: ['#b784ff', '#7af0ff', '#a24bff'] },
    critter: ['#9c7bd0', '#f2d9ff', '#261c35'],
  },
}

// ═══════════════════════════ GEOMETRÍAS DE FAUNA ═══════════════════════════
const _m = new THREE.Matrix4()
const _e = new THREE.Euler()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()

function part(geo, col, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  g.deleteAttribute('normal')
  g.applyMatrix4(_m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl)))
  const n = g.attributes.position.count
  const c = new THREE.Color(col)
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

function wings(span, chord, sweep, col, pairs = 1) {
  const out = []
  for (let p = 0; p < pairs; p++) {
    const z0 = p * -chord * 0.7
    const k = p ? 0.7 : 1
    for (const sd of [1, -1]) {
      const v = [[0.05, 0, 0.2 * chord], [span * k, 0, 0.2 * chord - sweep], [span * 0.9 * k, 0, -0.35 * chord - sweep], [0.05, 0, -0.3 * chord]]
      const t = [0, 1, 2, 0, 2, 3]
      const pos = new Float32Array(18)
      t.forEach((vi, i) => { pos[i * 3] = v[vi][0] * sd; pos[i * 3 + 1] = v[vi][1]; pos[i * 3 + 2] = v[vi][2] + z0 })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      out.push(part(g, col))
    }
  }
  return out
}

const sph = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h)
const cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s)

const SPECIES = {
  bat: {
    anim: 1, glow: 1.25,
    build: () => [
      part(sph(0.11), '#888', [0, 0, 0], [1, 0.9, 2]),
      part(sph(0.08), '#aaa', [0, 0.02, 0.22]),
      ...wings(0.62, 0.38, 0.26, '#ffffff'),
    ],
  },
  bird: {
    anim: 1, glow: 1.15,
    build: () => [
      part(sph(0.11), '#eee', [0, 0, 0], [1, 1, 2.2]),
      part(sph(0.075), '#fff', [0, 0.04, 0.26]),
      part(cone(0.035, 0.12), '#ffb347', [0, 0.03, 0.36], [1, 1, 1], [PI2, 0, 0]),
      ...wings(0.58, 0.24, 0.09, '#ffffff'),
    ],
  },
  butterfly: {
    anim: 1, glow: 1.55,
    build: () => [
      part(sph(0.045), '#555', [0, 0, 0], [1, 1, 4]),
      ...wings(0.42, 0.36, 0, '#ffffff', 2),
    ],
  },
  fish: {
    anim: 2, glow: 1.4,
    build: () => [
      part(sph(0.3, 7, 5), '#ffffff', [0, 0, 0.1], [0.5, 0.78, 1.5]),
      part(cone(0.22, 0.42), '#e8e8e8', [0, 0, -0.52], [0.22, 1, 1], [PI2, 0, 0]),
      part(cone(0.11, 0.26, 4), '#f4f4f4', [0, 0.26, 0], [0.2, 1, 1]),
    ],
  },
  jelly: {
    anim: 3, glow: 1.65,
    build: () => [
      part(new THREE.SphereGeometry(0.36, 8, 5, 0, TAU, 0, PI2), '#ffffff', [0, 0.1, 0]),
      ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) =>
        part(cone(0.035, 0.62, 4), '#dcdcdc', [a * 0.15, -0.2, b * 0.15], [1, 1, 1], [Math.PI, 0, 0]),
      ),
    ],
  },
  firefly: {
    anim: 4, glow: 1.75,
    build: () => [
      part(sph(0.28, 6, 5), '#ffffff', [0, 0, 0]),
      ...wings(0.36, 0.18, 0, '#ffffff'),
    ],
  },
}

const speciesGeoCache = new Map()
function getSpeciesGeo(kind) {
  let g = speciesGeoCache.get(kind)
  if (!g) {
    g = mergeGeometries(SPECIES[kind].build(), false)
    g.computeBoundingSphere()
    g.name = `criaturas:${kind}`
    markShared(g)
    speciesGeoCache.set(kind, g)
  }
  return g
}

const travelMatCache = new Map()
function getTravelMat(kind) {
  const sp = SPECIES[kind]
  const key = `${sp.anim}:${sp.glow}`
  if (travelMatCache.has(key)) return travelMatCache.get(key)
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, toneMapped: false })
  m.defines = { FAUNA_ANIM: sp.anim }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFaunaTime = FAUNA_TIME
    sh.uniforms.uFaunaGlow = { value: sp.glow }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uFaunaTime;\nvarying float vFaunaPh;\nvarying float vFaunaExt;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vFaunaExt = smoothstep(0.18, 0.72, length(transformed));
        #ifdef USE_INSTANCING
        float ph = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;
        #else
        float ph = 0.0;
        #endif
        vFaunaPh = ph;
        #if FAUNA_ANIM == 1
        transformed.y += sin(uFaunaTime * 11.0 + ph * 3.0) * abs(transformed.x) * 1.15;
        #elif FAUNA_ANIM == 2
        transformed.x += sin(uFaunaTime * 8.0 + ph * 3.0 + transformed.z * 6.5) * 0.14 * (0.6 - transformed.z);
        #elif FAUNA_ANIM == 3
        float pu = 1.0 + 0.18 * sin(uFaunaTime * 3.4 + ph);
        transformed.xz *= pu; transformed.y *= 2.0 - pu;
        #elif FAUNA_ANIM == 4
        transformed.y += sin(uFaunaTime * 16.0 + ph * 5.0) * abs(transformed.x) * 0.85;
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFaunaTime;\nuniform float uFaunaGlow;\nvarying float vFaunaPh;\nvarying float vFaunaExt;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float pulse = FAUNA_ANIM == 4 ? (0.72 + 0.45 * sin(uFaunaTime * 4.2 + vFaunaPh * 2.0)) : 1.0;
        diffuseColor.rgb *= uFaunaGlow * pulse * (0.95 + 0.32 * vFaunaExt);`)
  }
  m.customProgramCacheKey = () => `vida-fauna-v1:${sp.anim}`
  markShared(m)
  travelMatCache.set(key, m)
  return m
}

// ═══════════════════════════ HABITANTES DE BERMA (instanciados por tema) ═══════════════════════════
const critterGeoCache = new Map()
function getCritterGeo(colors) {
  const key = colors.join('|')
  if (critterGeoCache.has(key)) return critterGeoCache.get(key)
  const [coat, belly, ink] = colors
  const g0 = new THREE.SphereGeometry(0.34, 9, 7)
  const g1 = new THREE.SphereGeometry(0.25, 9, 7)
  const g2 = new THREE.ConeGeometry(0.1, 0.24, 6)
  const g3 = new THREE.SphereGeometry(0.045, 5, 4)
  const g4 = new THREE.SphereGeometry(0.12, 6, 4)
  const mk = (geo, pos, scl, rotZ = 0) => {
    const g = geo.clone().scale(...scl)
    if (rotZ) g.rotateZ(rotZ)
    return g.translate(...pos)
  }
  const parts = [
    [mk(g0, [0, 0.36, 0], [0.78, 0.8, 1.05]), coat],
    [mk(g1, [0, 0.78, 0.19], [1, 1, 1]), coat],
    [mk(g2, [-0.16, 1.0, 0.12], [1, 1, 1], 0.17), coat],
    [mk(g2, [0.16, 1.0, 0.12], [1, 1, 1], -0.17), coat],
    [mk(g0, [0, 0.31, 0.27], [0.5, 0.58, 0.42]), belly],
    [mk(g3, [-0.1, 0.82, 0.405], [1, 1, 1]), ink],
    [mk(g3, [0.1, 0.82, 0.405], [1, 1, 1]), ink],
    [mk(g4, [-0.16, 0.1, 0.15], [1, 0.55, 1.2]), ink],
    [mk(g4, [0.16, 0.1, 0.15], [1, 0.55, 1.2]), ink],
  ]
  g0.dispose(); g1.dispose(); g2.dispose(); g3.dispose(); g4.dispose()
  const out = mergeColoredParts(parts, `criaturas:critter:${key}`)
  critterGeoCache.set(key, out)
  return out
}

let _critterMat = null
function getCritterMat() {
  if (!_critterMat) _critterMat = markShared(new THREE.MeshLambertMaterial({ vertexColors: true }))
  return _critterMat
}

// ═══════════════════════════ CONSTRUCCIÓN DE FLOTAS Y BERMA ═══════════════════════════
const dataCache = new WeakMap()
const rr = (rng, [a, b]) => a + (b - a) * rng()

function buildRoutes(way) {
  const routes = (way.routes ?? [])
    .map((rt) => (rt.segments ?? []).filter((s) => s && !s.air))
    .filter((segs) => segs.length > 0)
  if (!routes.length) {
    const segs = (way.segments ?? []).filter((s) => s && !s.air)
    if (segs.length) routes.push(segs)
  }
  return routes.map((segs) => segPath(segs)).filter((p) => p.total > 1)
}

function buildFleet(paths, spec, rng) {
  if (!paths.length || !spec) return []
  const items = []
  const colors = spec.colors.map((c) => new THREE.Color(c))
  const flockSize = spec.flock ?? 1
  const groups = Math.max(1, Math.ceil(spec.count / flockSize))
  for (let g = 0; g < groups && items.length < spec.count; g++) {
    const pathIdx = g % paths.length
    const path = paths[pathIdx]
    const baseS = ((g / groups) + rng() * 0.04) * path.total
    const dir = rng() < 0.55 ? 1 : -1
    const baseSpd = rr(rng, spec.speed) * dir
    const baseY = rr(rng, spec.y)
    const sideSign = rng() < 0.5 ? -1 : 1
    const baseLat = spec.lat === 'berm'
      ? sideSign * (2.6 + rng() * 2.8)
      : rr(rng, spec.lat)
    const members = Math.min(flockSize, spec.count - items.length)
    for (let m = 0; m < members; m++) {
      items.push({
        pathIdx,
        s: (baseS + m * (2.2 + rng() * 1.8)) % path.total,
        speed: baseSpd * (0.94 + rng() * 0.12),
        y: baseY + (rng() - 0.5) * 0.9,
        lat: baseLat + (rng() - 0.5) * 1.4,
        swayFreq: 0.9 + rng() * 1.1,
        swayAmp: 0.4 + rng() * 0.7,
        bobAmp: 0.25 + rng() * 0.45,
        phase: rng() * TAU,
        scale: rr(rng, spec.scale),
        color: colors[Math.floor(rng() * colors.length)],
        dir,
      })
    }
  }
  return items
}

function buildBermCritters(way, rng) {
  const candidates = []
  for (let si = 0; si < (way.segments?.length ?? 0); si++) {
    const seg = way.segments[si]
    if (seg.air) continue
    for (const lane of lanesOf(seg)) {
      const ev = (seg.switches ?? []).filter((s) => s.from === lane.id || s.to === lane.id).map((s) => s.u)
      for (const u of [0.16, 0.38, 0.61, 0.84]) {
        if (ev.some((x) => Math.abs(x - u) * seg.length < 5)) continue
        const f = surfFrame(seg, lane.id, u)
        const sign = rng() < 0.5 ? -1 : 1
        const offset = sign * (halfWidth(lane) + CURB + TERR * (0.35 + rng() * 0.35))
        const pos = f.pos.clone().addScaledVector(f.side, offset).addScaledVector(f.up, -0.02)
        const quat = basisQuat(f.up, f.tangent)
        const [o, side, up] = [f.pos.clone(), f.side.clone(), f.up.clone()]
        const scale = (0.85 + rng() * 0.35) * Math.min(1.3, Math.max(0.9, TRACK_K * 0.22))
        const E = halfWidth(lane) + CURB
        const ajusta = (p) => {
          const xx = (p.x - o.x) * side.x + (p.y - o.y) * side.y + (p.z - o.z) * side.z
          const a = Math.max(Math.abs(xx), E + 0.45 * scale)
          return a > E + TERR + 0.5 ? null : o.clone().addScaledVector(side, Math.sign(xx || offset) * a).addScaledVector(up, -0.02)
        }
        candidates.push({
          pos, up, quat, phase: rng() * TAU, scale, ajusta,
          seed: way.idx * 7919 + si * 101 + lane.id * 13 + Math.round(u * 100),
          ig: { way: way.idx, si, lane: lane.id },
        })
      }
    }
  }
  const world = mundoDe(way)
  const local = nuevoLocal()
  return candidates
    .filter((_, i) => i % Math.max(1, Math.ceil(candidates.length / 10)) === 0)
    .slice(0, 10)
    .flatMap((c) => {
      const pos = colocar(world, c, 0.45 * c.scale, c.ig, 4, local)
      return pos ? [{ ...c, pos }] : []
    })
}

function getWayFaunaData(way) {
  if (dataCache.has(way)) return dataCache.get(way)
  const themeId = way.theme?.id
  const spec = THEME_FAUNA[themeId] ?? THEME_FAUNA.bosque
  const rng = mulberry32(9137 + way.idx * 701)
  const paths = buildRoutes(way)
  const primary = buildFleet(paths, spec.primary, rng)
  const wisp = buildFleet(paths, spec.wisp, rng)
  const critters = buildBermCritters(way, rng)
  const out = { spec, paths, primary, wisp, critters }
  dataCache.set(way, out)
  return out
}

const F_FLT = {}
const LOC_TMP = {}
const POS_TMP = new THREE.Vector3()
const DIR_TMP = new THREE.Vector3()
const SCALE_TMP = new THREE.Vector3()
const MAT_TMP = new THREE.Matrix4()
const Q_TMP = new THREE.Quaternion()
const Q_ROLL = new THREE.Quaternion()
const Z_AXIS = new THREE.Vector3(0, 0, 1)

function updateFleetMesh(mesh, list, paths, dt, t, cam, isBerm) {
  if (!mesh || !list.length) return
  let count = 0
  for (let i = 0; i < list.length; i++) {
    const it = list[i]
    const path = paths[it.pathIdx]
    const total = path.total
    it.s = ((it.s + it.speed * dt) % total + total) % total
    path.locate(it.s, LOC_TMP)
    const seg = LOC_TMP.seg
    if (!seg || minSegDistSq(seg, cam) > CAM_RANGE_SQ) continue

    const lane = seg.lanes?.[0]
    if (!lane) continue
    const f = surfFrame(seg, lane.id, LOC_TMP.u, F_FLT)
    const latBase = isBerm ? Math.sign(it.lat || 1) * (halfWidth(lane) + CURB + Math.abs(it.lat) * 0.5) : it.lat
    const lat = latBase + Math.sin(t * it.swayFreq + it.phase) * it.swayAmp
    const py = it.y + Math.sin(t * 1.7 + it.phase * 1.3) * it.bobAmp
    POS_TMP.copy(f.pos).addScaledVector(f.side, lat).addScaledVector(f.up, py)
    if (POS_TMP.distanceToSquared(cam) > CAM_RANGE_SQ) continue

    const edgeFade = Math.min(1, Math.min(it.s, total - it.s) / 4.5)
    const sc = it.scale * (0.2 + 0.8 * edgeFade)
    DIR_TMP.copy(f.tangent).multiplyScalar(it.dir)
    Q_TMP.copy(basisQuat(f.up, DIR_TMP))
    const bank = Math.cos(t * it.swayFreq + it.phase) * 0.18
    Q_ROLL.setFromAxisAngle(Z_AXIS, bank)
    Q_TMP.multiply(Q_ROLL)

    SCALE_TMP.setScalar(sc)
    mesh.setMatrixAt(count, MAT_TMP.compose(POS_TMP, Q_TMP, SCALE_TMP))
    mesh.setColorAt(count, it.color)
    count++
  }
  mesh.count = count
  if (count > 0) {
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
}

export default function Criaturas({ way, time }) {
  const { spec, paths, primary, wisp, critters } = useMemo(() => getWayFaunaData(way), [way])
  const waySphere = useMemo(() => getWayBoundingSphere(way, 24 * TRACK_K), [way])
  const detail = getWayDetail(way)
  const groupRef = useRef()
  const camera = useThree((s) => s.camera)

  const primaryMesh = useMemo(() => {
    if (!primary.length) return null
    const m = new THREE.InstancedMesh(getSpeciesGeo(spec.primary.kind), getTravelMat(spec.primary.kind), primary.length)
    m.count = 0
    m.userData.noCull = true
    m.boundingSphere = waySphere
    m.frustumCulled = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const w = new THREE.Color('#ffffff')
    for (let i = 0; i < primary.length; i++) m.setColorAt(i, w)
    return m
  }, [primary, spec.primary.kind, waySphere])

  const wispMesh = useMemo(() => {
    if (!wisp.length) return null
    const m = new THREE.InstancedMesh(getSpeciesGeo(spec.wisp.kind), getTravelMat(spec.wisp.kind), wisp.length)
    m.count = 0
    m.userData.noCull = true
    m.boundingSphere = waySphere
    m.frustumCulled = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const w = new THREE.Color('#ffffff')
    for (let i = 0; i < wisp.length; i++) m.setColorAt(i, w)
    return m
  }, [wisp, spec.wisp.kind, waySphere])

  const critterMesh = useMemo(() => {
    if (!critters.length) return null
    const m = new THREE.InstancedMesh(getCritterGeo(spec.critter), getCritterMat(), critters.length)
    m.count = critters.length
    m.boundingSphere = waySphere
    m.frustumCulled = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < critters.length; i++) {
      const c = critters[i]
      SCALE_TMP.setScalar(c.scale)
      m.setMatrixAt(i, MAT_TMP.compose(c.pos, c.quat, SCALE_TMP))
    }
    m.instanceMatrix.needsUpdate = true
    return m
  }, [critters, spec.critter, waySphere])

  useEffect(() => () => {
    primaryMesh?.dispose()
    wispMesh?.dispose()
    critterMesh?.dispose()
  }, [primaryMesh, wispMesh, critterMesh])

  // Un único useFrame por camino: solo escribe el uniform de tiempo y matrices de instancias visibles.
  useFrame(({ clock }, dt) => {
    const t = time ? time.value : clock.elapsedTime
    FAUNA_TIME.value = t
    const det = detail ? detail.value : 1
    if (groupRef.current) groupRef.current.visible = det >= 0.25
    if (det < 0.25) return

    const cam = camera.position
    const stepDt = Math.min(dt, 0.05)
    updateFleetMesh(primaryMesh, primary, paths, stepDt, t, cam, false)
    updateFleetMesh(wispMesh, wisp, paths, stepDt, t, cam, true)

    if (critterMesh && critters.length) {
      const balls = getBallitas()
      let dirty = false
      for (let i = 0; i < critters.length; i++) {
        const c = critters[i]
        if (cam.distanceToSquared(c.pos) > 85 * 85) continue
        let startled = false
        for (let b = 0; b < balls.length; b++) {
          const bp = balls[b]?.pos
          if (bp && bp.distanceToSquared(c.pos) < 25) { startled = true; break }
        }
        const bob = Math.sin((t + c.phase) * (startled ? 13 : 2.2)) * (startled ? 0.16 : 0.045)
        POS_TMP.copy(c.pos).addScaledVector(c.up, bob)
        Q_TMP.copy(c.quat)
        if (startled) {
          Q_ROLL.setFromAxisAngle(Z_AXIS, 0.18 * Math.sin((t + c.phase) * 9))
          Q_TMP.multiply(Q_ROLL)
        }
        SCALE_TMP.setScalar(c.scale)
        critterMesh.setMatrixAt(i, MAT_TMP.compose(POS_TMP, Q_TMP, SCALE_TMP))
        dirty = true
      }
      if (dirty) critterMesh.instanceMatrix.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      {primaryMesh && <primitive object={primaryMesh} />}
      {wispMesh && <primitive object={wispMesh} />}
      {critterMesh && <primitive object={critterMesh} />}
    </group>
  )
}
