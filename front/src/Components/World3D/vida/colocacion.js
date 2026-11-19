// Colocación pura (sin JSX ni @react-three/fiber) de anillos, arcos, riberas, pórticos de unión y piezas de kart.
// La usan tanto los componentes .jsx de vida/ como tools/overlap.mjs y Core/layout.test.js, garantizando que
// el medidor evalúe exactamente los mismos volúmenes que se dibujan en 3D.
import * as THREE from 'three'
import * as WORLD from '../../../Core/world.js'
import { colisionDe, colocar, mundoDe, nuevoLocal, registrarMundo } from '../colisionObjetos.js'
import { basisQuat } from './dyn.js'

export const TRACK_K = WORLD.TRACK_K
export const BALL_R = WORLD.BALL_R ?? 0.4
export const CURB = WORLD.RIBBON_CURB ?? 0.17 * TRACK_K
export const TERR = WORLD.RIBBON_TERR ?? 0.55 * TRACK_K
export const mulberry32 = WORLD.mulberry32

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const TAU = Math.PI * 2
const Q_YAW = new THREE.Quaternion()
const Q_ROTX = new THREE.Quaternion()
const Q_Y90 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI / 2)
const Q_YN90 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -Math.PI / 2)
const Q_Y180 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI)

export const PISTA = {
  sombrio: { asfalto: '#2b2538', a: '#a24bff', b: '#e8dcff', linea: '#d9c8ff', terreno: '#3a2759', roca: '#1d1530', mec: '#c08cff', chev: '#ffd36b' },
  bosque: { asfalto: '#3a3a35', a: '#e53935', b: '#f5f5ef', linea: '#f6f2c8', terreno: '#3f8f3a', roca: '#5a4636', mec: '#ffd54f', chev: '#ffd54f' },
  mar: { asfalto: '#8a6a4c', a: '#ff8a65', b: '#eefcff', linea: '#fff4d6', terreno: '#cdb98a', roca: '#6a5a4c', mec: '#4dd0e1', chev: '#ffd166' },
  desierto: { asfalto: '#5b4733', a: '#d84315', b: '#fff3d6', linea: '#ffe9b0', terreno: '#d9a95b', roca: '#9a5b32', mec: '#ffb74d', chev: '#fff3d6' },
  hielo: { asfalto: '#566d80', a: '#2f80ed', b: '#ffffff', linea: '#e8f6ff', terreno: '#dcefff', roca: '#7fa3c4', mec: '#7fd6ff', chev: '#ff6b8a' },
  volcan: { asfalto: '#2b2220', a: '#ff5a1f', b: '#ffd166', linea: '#ffcc80', terreno: '#4a2c22', roca: '#24140f', mec: '#ff3d00', chev: '#ffd166' },
  cristal: { asfalto: '#383d5a', a: '#7df9ff', b: '#ff7de9', linea: '#ece6ff', terreno: '#8a7ad6', roca: '#3b2f78', mec: '#a78bff', chev: '#7df9ff' },
  nubes: { asfalto: '#8790b5', a: '#ff9ecf', b: '#ffffff', linea: '#ffffff', terreno: '#eef1ff', roca: '#c9d0f2', mec: '#ffd54f', chev: '#ff9ecf' },
  neon: { asfalto: '#16141f', a: '#ff2bd6', b: '#2bffe8', linea: '#2bffe8', terreno: '#1c2233', roca: '#0d0f1a', mec: '#ff2bd6', chev: '#2bffe8' },
  jardin: { asfalto: '#4a3f3a', a: '#ff88c2', b: '#fff7e0', linea: '#fff2c2', terreno: '#6fbf5a', roca: '#6b5240', mec: '#ffd27a', chev: '#ff88c2' },
}
export const pal = (id) => PISTA[id] ?? PISTA.neon

export function surfFrame(seg, laneId, u, out = {}) {
  WORLD.laneFrame(seg, laneId, u, out)
  out.pos.addScaledVector(out.up, -BALL_R)
  return out
}
export const lanesOf = (seg) => (seg.air ? [] : seg.lanes ?? [])
export const halfWidth = (lane) => (lane?.width ?? BALL_R * 2.6) / 2

const F_SIDE_CHK = {}
export function laneSideClear(seg, lane, u, pos, minClear) {
  const lanes = lanesOf(seg)
  for (let i = 0; i < lanes.length; i++) {
    const other = lanes[i]
    if (other.id === lane.id) continue
    const fo = surfFrame(seg, other.id, u, F_SIDE_CHK)
    const need = halfWidth(other) + CURB + minClear
    if (pos.distanceToSquared(fo.pos) < need * need) return false
  }
  return true
}

export function bermY(ax, E) {
  const t = Math.max(0, Math.min(1, (ax - E) / TERR))
  return t < 0.5 ? 0.025 + (0.06 - 0.025) * (t / 0.5) : 0.06 - 0.22 * ((t - 0.5) / 0.5)
}

export function bermaAjusta(o, side, up, E, terr, rad) {
  return (p) => {
    const xx = (p.x - o.x) * side.x + (p.y - o.y) * side.y + (p.z - o.z) * side.z
    const a = Math.max(Math.abs(xx), E + rad * 0.5)
    return a > E + terr + rad + 0.6 ? null : o.clone().addScaledVector(side, Math.sign(xx || 1) * a).addScaledVector(up, -0.02)
  }
}

// Gálibo ajeno (M4): la esfera (c, r) de una pieza no invade el prisma libre (calzada x GALIBO_H) de otra cinta.
// own = { way, seg, lane } (lane '*' = todo el haz del tramo; seg '*' = todo el camino). Sin mundo registrado, pasa.
export function prismaLibre(world, c, r, own) {
  return !world || !WORLD.prismaLibre || WORLD.prismaLibre(world, c, r, own)
}

function segStartsByWay(way) {
  const byI = new Map()
  for (const rt of way.routes ?? []) {
    let acc = 0
    for (const s of rt.segments ?? []) {
      if (!byI.has(s.i)) byI.set(s.i, acc)
      acc += s.length
    }
  }
  return byI
}

// ═══════════════════════════ 1. ANILLOS (anillos.jsx) ═══════════════════════════
export const RING_STEP = 55 * TRACK_K
export const RING_RANGE = 135
const ROUTE_COLS = ['#38e8ff', '#ff5c8a', '#ffd24a']
const F_RING = {}
const ringsCache = new WeakMap()

export function buildAnillosData(way) {
  if (ringsCache.has(way)) return ringsCache.get(way)
  const P = pal(way.theme.id)
  const baseCol = new THREE.Color(P.mec)
  const starts = segStartsByWay(way)
  const world = mundoDe(way)
  const rings = []
  const box = new THREE.Box3()

  for (const seg of way.segments ?? []) {
    if (seg.air) continue
    const L = Math.max(seg.length ?? 1, 1)
    const segStart = starts.get(seg.i) ?? 0
    const col = seg.route >= 0
      ? baseCol.clone().lerp(new THREE.Color(ROUTE_COLS[seg.route % ROUTE_COLS.length]), 0.35)
      : baseCol
    const lanes = lanesOf(seg)
    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li]
      const H = halfWidth(lane)
      const E = H + CURB
      const sc = (E + TERR * 0.55) * 2.15
      const minSep2 = Math.max(8 * TRACK_K, E * 3.0) ** 2
      const step = li === 0 ? RING_STEP : RING_STEP + 4
      for (let s = 14; s <= L - 10; s += step) {
        const u = s / L
        const f = surfFrame(seg, lane.id, u, F_RING)
        const pos = f.pos.clone().addScaledVector(f.up, -0.42 * sc)
        let overlap = false
        for (let i = rings.length - 1; i >= 0; i--) {
          if (rings[i].pos.distanceToSquared(pos) < minSep2) { overlap = true; break }
        }
        if (overlap) continue
        const center = f.pos.clone().addScaledVector(f.up, 0.24 * sc)
        if (!prismaLibre(world, center, 0.56 * sc, { way, seg, lane: lane.id })) continue
        box.expandByPoint(pos)
        rings.push({
          pos,
          quat: basisQuat(f.up, f.tangent),
          scale: sc,
          phase: (segStart + s) * 0.14,
          color: col,
          way: way.idx,
          seg,
          lane: lane.id,
          u,
          center,
          r: 0.56 * sc,
          clearH: (0.24 + 0.5) * sc,
        })
      }
    }
  }

  const n = rings.length
  const phases = new Float32Array(Math.max(1, n))
  const tints = new Float32Array(Math.max(1, n) * 3)
  for (let i = 0; i < n; i++) {
    phases[i] = rings[i].phase
    tints[i * 3] = rings[i].color.r
    tints[i * 3 + 1] = rings[i].color.g
    tints[i * 3 + 2] = rings[i].color.b
  }
  const sphere = new THREE.Sphere()
  if (!box.isEmpty()) { box.getBoundingSphere(sphere); sphere.radius += 6 * TRACK_K } else sphere.radius = 60 * TRACK_K

  const out = { rings, phases, tints, sphere }
  ringsCache.set(way, out)
  return out
}

// ═══════════════════════════ 2. ESTRUCTURAS (estructuras.jsx) ═══════════════════════════
export const THEME_STRUCTS = {
  bosque: {
    ribbon: { mode: 'hedge', c1: '#2c4a26', c2: '#6f9a45', c3: '#7a6a3e', h: 2.3, w: 9.0, glow: 0.0 },
    arch: { kind: 'bosque', step: 38, sx: 1.08, sy: 8.2 },
    props: [
      { model: 'tronco_hueco', step: 32, ax: [0.45, 0.95], scale: [2.8, 4.0], foot: 0.45, rad: 1.05, rotX: Math.PI / 2, yOff: 0.45, cat: 'terreno' },
      { model: 'hongo_gigante', step: 24, ax: [0.4, 0.95], scale: [2.6, 4.2], foot: 0.48, rad: 1.0, cat: 'terreno' },
      { model: 'bosque_casita', step: 44, ax: [0.7, 1.35], scale: [4.2, 5.8], foot: 0.5, rad: 1.45, cat: 'fachada', faceRoad: true },
    ],
  },
  mar: {
    ribbon: { mode: 'reef', c1: '#5a4a6e', c2: '#d9c08a', c3: '#c95f86', h: 1.2, w: 7.8, glow: 0.06 },
    arch: { kind: 'mar', step: 42, sx: 1.08, sy: 8.0 },
    props: [
      { model: 'ciudad/mar_torre', step: 40, ax: [0.75, 1.5], scale: [8.8, 13.5], foot: 0.44, rad: 1.75, tints: ['#e8f8ff', '#b8ecff'], cat: 'fachada', faceRoad: true, tall: true },
      { model: 'coral', step: 12, ax: [0.4, 1.25], scale: [3.8, 6.8], foot: 0.44, rad: 1.2, tints: ['#ff6f91', '#ff9671', '#ffc75f', '#4dd0e1', '#ff7eb9'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'alga_larga', step: 14, ax: [0.4, 1.1], scale: [4.6, 8.2], foot: 0.25, rad: 0.85, tints: ['#28b899', '#45d9aa', '#1f9488'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'concha_gigante', step: 24, ax: [0.4, 0.95], scale: [2.4, 3.8], foot: 0.5, rad: 1.0, cat: 'terreno', faceRoad: true },
      { model: 'mar_boya', step: 28, ax: [0.45, 0.95], scale: [2.8, 4.2], foot: 0.38, rad: 0.85, cat: 'techo' },
    ],
  },
  desierto: {
    ribbon: { mode: 'dune', c1: '#c48d48', c2: '#ecc37a', h: 2.75, w: 10.2, glow: 0.04 },
    arch: { kind: 'desierto', step: 46, sx: 1.1, sy: 8.2 },
    props: [
      { model: 'saguaro_grande', step: 14, ax: [0.45, 1.25], scale: [3.8, 6.4], foot: 0.42, rad: 1.05, cat: 'terreno', tall: true, bothSides: true },
      { model: 'pyramid', step: 42, ax: [0.95, 1.9], scale: [8.2, 13.4], foot: 0.52, rad: 2.05, tints: ['#d4a55c', '#c78c48', '#e0b872'], cat: 'terreno', tall: true },
      { model: 'ciudad/desierto_torre', step: 38, ax: [0.75, 1.45], scale: [6.5, 10.2], foot: 0.44, rad: 1.55, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'desierto_oasis', step: 36, ax: [0.6, 1.25], scale: [4.4, 6.4], foot: 0.48, rad: 1.4, cat: 'terreno' },
    ],
  },
  hielo: {
    ribbon: { mode: 'ice', c1: '#6eb4de', c2: '#e2f6ff', h: 3.3, w: 7.4, glow: 0.18 },
    arch: { kind: 'hielo', step: 40, sx: 1.08, sy: 8.2 },
    props: [
      { model: 'ice_spire', step: 13, ax: [0.5, 1.4], scale: [6.4, 12.2], foot: 0.38, rad: 1.4, tints: ['#b8ebff', '#8cd4fa', '#e4f8ff'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'estalagmita_hielo', step: 14, ax: [0.45, 1.15], scale: [4.2, 7.6], foot: 0.34, rad: 1.1, cat: 'terreno', tall: true, bothSides: true },
      { model: 'hielo_iglu', step: 34, ax: [0.55, 1.15], scale: [3.5, 5.0], foot: 0.5, rad: 1.3, cat: 'fachada', faceRoad: true },
      { model: 'ciudad/hielo_torre', step: 42, ax: [0.75, 1.45], scale: [7.5, 11.6], foot: 0.44, rad: 1.65, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  volcan: {
    ribbon: { mode: 'lava', c1: '#ff3b08', c2: '#ffaa22', h: 0.72, w: 6.8, glow: 1.0 },
    arch: { kind: 'volcan', step: 44, sx: 1.08, sy: 8.0 },
    props: [
      { model: 'volcan_erupcion', step: 30, ax: [1.15, 2.1], scale: [7.4, 12.0], foot: 0.58, rad: 2.0, tints: ['#785046', '#8f5a4a'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'rock', step: 13, ax: [1.05, 1.95], scale: [3.6, 6.4], foot: 0.48, rad: 1.3, tints: ['#6b4b44', '#7d564c', '#573b36'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'geiser', step: 26, ax: [0.65, 1.3], scale: [3.4, 5.2], foot: 0.48, rad: 1.15, tints: ['#855c50', '#9c6855'], cat: 'terreno', tall: true },
      { model: 'volcan_farol', step: 18, ax: [0.35, 0.75], scale: [2.6, 3.6], foot: 0.22, rad: 0.65, cat: 'techo' },
      { model: 'volcan_altar', step: 34, ax: [0.55, 1.1], scale: [3.0, 4.4], foot: 0.48, rad: 1.1, cat: 'terreno', faceRoad: true },
    ],
  },
  cristal: {
    ribbon: { mode: 'canyon', c1: '#48388a', c2: '#9a7dff', h: 3.1, w: 7.8, glow: 0.22 },
    arch: { kind: 'cristal', step: 42, sx: 1.08, sy: 8.1 },
    props: [
      { model: 'crystal', step: 12, ax: [0.45, 1.4], scale: [6.2, 12.2], foot: 0.38, rad: 1.35, tints: ['#7df9ff', '#ff7de9', '#b894ff', '#7dffb2'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'cristal_prisma', step: 15, ax: [0.45, 1.25], scale: [4.8, 8.8], foot: 0.4, rad: 1.15, cat: 'terreno', tall: true, bothSides: true },
      { model: 'geoda', step: 22, ax: [0.4, 0.95], scale: [2.6, 4.2], foot: 0.5, rad: 0.95, cat: 'terreno', faceRoad: true },
      { model: 'ciudad/cristal_torre', step: 40, ax: [0.7, 1.4], scale: [7.6, 12.4], foot: 0.44, rad: 1.6, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  nubes: {
    ribbon: { mode: 'cloud', c1: '#dce6ff', c2: '#ffffff', h: 1.65, w: 8.2, glow: 0.14 },
    arch: { kind: 'nubes', step: 44, sx: 1.1, sy: 8.0 },
    props: [
      { model: 'isla_nube', step: 22, ax: [1.05, 2.1], scale: [6.2, 10.0], foot: 0.5, rad: 1.85, yOff: [-2.4, 0.9], cat: 'terreno', tall: true, bothSides: true },
      { model: 'cloud', step: 14, ax: [0.85, 1.9], scale: [4.4, 7.6], foot: 0.5, rad: 1.5, yOff: [-2.0, 0.4], tints: ['#ffffff', '#eef4ff', '#fff7e0'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'nubes_globo', step: 22, ax: [0.65, 1.4], scale: [3.8, 6.0], foot: 0.34, rad: 1.0, yOff: [3.0, 6.6], cat: 'techo', tall: true },
      { model: 'nubes_casita', step: 38, ax: [0.7, 1.3], scale: [3.8, 5.4], foot: 0.5, rad: 1.35, cat: 'fachada', faceRoad: true },
    ],
  },
  neon: {
    ribbon: { mode: 'cyber', c1: '#161b36', c2: '#2d3b70', h: 0.45, w: 7.6, glow: 0.16 },
    arch: { kind: 'neon', step: 36, sx: 1.08, sy: 8.2 },
    props: [
      { model: 'ciudad/neon_rascacielos', step: 17, ax: [0.85, 1.75], scale: [9.4, 15.8], foot: 0.49, rad: 2.2, yOff: -0.25, tints: ['#ffffff', '#d8f4ff', '#ffd8fa'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/neon_torre', step: 20, ax: [0.75, 1.55], scale: [7.8, 13.2], foot: 0.44, rad: 1.85, yOff: -0.2, tints: ['#eef7ff', '#ffe6fb'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/neon_comercio', step: 24, ax: [0.65, 1.25], scale: [5.0, 7.4], foot: 0.52, rad: 1.45, cat: 'fachada', faceRoad: true },
      { model: 'neon_kiosco', step: 20, ax: [0.45, 0.9], scale: [2.6, 3.8], foot: 0.5, rad: 0.95, cat: 'fachada', faceRoad: true },
    ],
  },
  jardin: {
    ribbon: { mode: 'hedge', c1: '#2f7a32', c2: '#7be063', h: 1.35, w: 5.8, glow: 0.05 },
    arch: { kind: 'jardin', step: 34, sx: 1.08, sy: 7.6 },
    props: [
      { model: 'jardin_gazebo', step: 26, ax: [0.6, 1.2], scale: [4.0, 5.8], foot: 0.36, rad: 1.25, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'fuente_jardin', step: 30, ax: [0.55, 1.1], scale: [3.2, 4.6], foot: 0.5, rad: 1.2, cat: 'terreno' },
      { model: 'jardin_flor', step: 12, ax: [0.35, 0.85], scale: [2.2, 3.6], foot: 0.34, rad: 0.72, cat: 'terreno', bothSides: true },
      { model: 'tree', step: 16, ax: [0.65, 1.5], scale: [6.2, 10.4], foot: 0.52, rad: 1.6, tints: ['#4fa84b', '#ff8fb8', '#ffb3d9', '#67bd5b'], cat: 'terreno', tall: true, bothSides: true },
    ],
  },
  sombrio: {
    ribbon: { mode: 'crypt', c1: '#281f3d', c2: '#503b75', h: 1.05, w: 6.4, glow: 0.1 },
    arch: { kind: 'sombrio', step: 44, sx: 1.08, sy: 8.0 },
    props: [
      { model: 'proc:dead_tree', step: 14, ax: [0.55, 1.35], scale: [7.2, 11.8], foot: 0.32, rad: 1.35, tints: ['#3e3054', '#4e3c69', '#322645'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'tomb', step: 22, ax: [0.65, 1.35], scale: [5.4, 8.6], foot: 0.48, rad: 1.55, tints: ['#786899', '#5e4f7d', '#8e7cb0'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/sombrio_torre', step: 34, ax: [0.75, 1.55], scale: [7.8, 12.2], foot: 0.44, rad: 1.75, tints: ['#8574a8', '#68588a'], cat: 'fachada', faceRoad: true, tall: true },
      { model: 'lapida', step: 13, ax: [0.4, 0.9], scale: [2.2, 3.6], foot: 0.34, rad: 0.75, cat: 'terreno', faceRoad: true, bothSides: true },
      { model: 'sombrio_farol', step: 16, ax: [0.35, 0.75], scale: [2.8, 3.8], foot: 0.2, rad: 0.65, cat: 'techo' },
    ],
  },
}

function outerClear(col, wayIdx, seg, lane, u, pos, rad, local) {
  if (!laneSideClear(seg, lane, u, pos, Math.max(0.85, rad * 0.65))) return false
  if (col && !col.libre(pos, rad, { way: wayIdx })) return false
  if (local && !local.libre(pos, rad)) return false
  return true
}

const F0 = {}; const F1 = {}
const _cand = new THREE.Vector3()
const _pL = new THREE.Vector3()
const _pR = new THREE.Vector3()
const segStructPlacementCache = new WeakMap()

export function placeSegArchesAndProps(way, seg, si) {
  if (segStructPlacementCache.has(seg)) return segStructPlacementCache.get(seg)
  const themeId = way.theme?.id
  const spec = THEME_STRUCTS[themeId] ?? THEME_STRUCTS.bosque
  const rng = mulberry32(4219 + way.idx * 313 + si * 977)
  const world = mundoDe(way)
  const col = world ? colisionDe(world) : null
  const local = nuevoLocal()

  const arches = []
  const byModel = new Map()
  for (const p of spec.props) byModel.set(p.model, [])

  const L = Math.max(seg.length ?? 1, 1)
  const lanes = lanesOf(seg)
  const busyList = seg.switches ?? []
  const archSpec = spec.arch

  if (archSpec) {
    for (let s = 16; s < L - 12; s += archSpec.step * (0.85 + rng() * 0.3)) {
      const u = s / L
      for (let li = 0; li < lanes.length; li++) {
        const lane = lanes[li]
        if (busyList.some((w) => (w.from === lane.id || w.to === lane.id) && Math.abs(w.u * L - s) < 7.5)) continue
        const f = surfFrame(seg, lane.id, u, F0)
        const hw = halfWidth(lane)
        const E = hw + CURB
        if (li === 0 && lanes.length > 1) {
          let minLat = -(E + TERR * 0.65)
          let maxLat = E + TERR * 0.65
          let anyBundled = false
          for (let j = 1; j < lanes.length; j++) {
            const fj = surfFrame(seg, lanes[j].id, u, F1)
            const diff = _pL.copy(fj.pos).sub(f.pos)
            if (diff.lengthSq() < (E * 5.2) ** 2) {
              anyBundled = true
              const lat = diff.dot(f.side)
              const Ej = halfWidth(lanes[j]) + CURB + TERR * 0.65
              minLat = Math.min(minLat, lat - Ej)
              maxLat = Math.max(maxLat, lat + Ej)
            }
          }
          if (anyBundled) {
            const midLat = (minLat + maxLat) * 0.5
            const span = maxLat - minLat
            _pL.copy(f.pos).addScaledVector(f.side, minLat)
            _pR.copy(f.pos).addScaledVector(f.side, maxLat)
            const aSeed = way.idx * 1009 + si * 131 + Math.round(s)
            const okL = colocar(world, { pos: _pL, seed: aSeed + 1 }, 0.75, { way: way.idx }, 0, local)
            const okR = okL && colocar(world, { pos: _pR, seed: aSeed + 2 }, 0.75, { way: way.idx }, 0, local)
            if (okL && okR) {
              const sx = span * (archSpec.sx ?? 1)
              const sy = (archSpec.sy ?? 8.2) * (0.95 + rng() * 0.14)
              const sz = 2.8 + rng() * 0.8
              const pos = f.pos.clone().addScaledVector(f.side, midLat).addScaledVector(f.up, -0.14)
              if (!prismaLibre(world, pos.clone().addScaledVector(f.up, 0.5 * sy), 0.5 * sx, { way, seg, lane: '*' })) continue
              arches.push({
                pos,
                quat: basisQuat(f.up, f.tangent),
                scale: [sx, sy, sz],
                way: way.idx,
                seg,
                lane: lane.id,
                u,
                bundled: true,
                center: pos.clone().addScaledVector(f.up, 0.5 * sy),
                r: 0.5 * sx,
                spanHalf: 0.5 * sx,
                clearH: 0.72 * sy,
              })
            }
            continue
          }
        } else if (li > 0) {
          const f0 = surfFrame(seg, lanes[0].id, u, F1)
          if (f.pos.distanceToSquared(f0.pos) < (E * 5.2) ** 2) continue
        }

        const spanHalf = E + TERR * 0.72
        _pL.copy(f.pos).addScaledVector(f.side, -spanHalf)
        _pR.copy(f.pos).addScaledVector(f.side, spanHalf)
        if (!outerClear(col, way.idx, seg, lane, u, _pL, 0.75, local) ||
            !outerClear(col, way.idx, seg, lane, u, _pR, 0.75, local)) continue
        const aSeed = way.idx * 1009 + si * 131 + lane.id * 29 + Math.round(s)
        if (!colocar(world, { pos: _pL, seed: aSeed + 1 }, 0.75, { way: way.idx }, 0, local)) continue
        if (!colocar(world, { pos: _pR, seed: aSeed + 2 }, 0.75, { way: way.idx }, 0, local)) continue

        const sx = spanHalf * 2 * (archSpec.sx ?? 1)
        const sy = (archSpec.sy ?? 7.4) * (0.94 + rng() * 0.14)
        const sz = 2.6 + rng() * 0.8
        const pos = f.pos.clone().addScaledVector(f.up, -0.12)
        if (!prismaLibre(world, pos.clone().addScaledVector(f.up, 0.5 * sy), 0.5 * sx, { way, seg, lane: lane.id })) continue
        arches.push({
          pos,
          quat: basisQuat(f.up, f.tangent),
          scale: [sx, sy, sz],
          way: way.idx,
          seg,
          lane: lane.id,
          u,
          bundled: false,
          center: pos.clone().addScaledVector(f.up, 0.5 * sy),
          r: 0.5 * sx,
          spanHalf: 0.5 * sx,
          clearH: 0.72 * sy,
        })
      }
    }
  }

  for (const lane of lanes) {
    const hw = halfWidth(lane)
    const E = hw + CURB
    const widthRatio = Math.max(1, hw / 2.45)

    for (const pSpec of spec.props) {
      const step = pSpec.step * (0.85 + rng() * 0.35)
      const list = byModel.get(pSpec.model)
      const tintColors = pSpec.tints ? pSpec.tints.map((h) => new THREE.Color(h)) : null
      for (let s = 6 + rng() * step * 0.6; s < L - 5; s += step) {
        if (busyList.some((w) => (w.from === lane.id || w.to === lane.id) && Math.abs(w.u * L - s) < 5.5)) continue
        const u = s / L
        const f = surfFrame(seg, lane.id, u, F0)

        const firstSign = rng() < 0.5 ? -1 : 1
        const tryBoth = !!pSpec.bothSides && rng() < 0.68
        for (const sgn of [firstSign, -firstSign]) {
          const sc = (pSpec.scale[0] + rng() * (pSpec.scale[1] - pSpec.scale[0])) * widthRatio
          const footR = sc * (pSpec.foot ?? 0.48)
          const minAx = E + TERR * pSpec.ax[0] + footR
          const maxAx = E + TERR * pSpec.ax[1] + footR
          const ax = minAx + rng() * (maxAx - minAx)
          const clearR = Math.max(pSpec.rad, footR * 0.92)
          const yBase = Array.isArray(pSpec.yOff)
            ? pSpec.yOff[0] + rng() * (pSpec.yOff[1] - pSpec.yOff[0])
            : (pSpec.yOff ?? -0.12)
          _cand.copy(f.pos).addScaledVector(f.side, sgn * ax).addScaledVector(f.up, yBase)
          if (!outerClear(col, way.idx, seg, lane, u, _cand, clearR, local)) continue
          const p = colocar(world, { pos: _cand, seed: way.idx * 104729 + si * 997 + lane.id * 53 + Math.round(s * 17) + (sgn > 0 ? 7 : 0) }, Math.max(pSpec.rad, footR * 0.72), { way: way.idx }, 0, local)
          if (!p) continue

          const quat = basisQuat(f.up, f.tangent)
          if (pSpec.faceRoad) {
            Q_YAW.setFromAxisAngle(Y_AXIS, (sgn > 0 ? -Math.PI / 2 : Math.PI / 2) + (rng() - 0.5) * 0.28)
          } else {
            Q_YAW.setFromAxisAngle(Y_AXIS, rng() * TAU)
          }
          quat.multiply(Q_YAW)
          if (pSpec.rotX) quat.multiply(Q_ROTX.setFromAxisAngle(X_AXIS, pSpec.rotX))

          list.push({
            pos: p,
            quat,
            scale: sc,
            color: tintColors ? tintColors[Math.floor(rng() * tintColors.length)] : null,
            way: way.idx,
            seg,
            lane: lane.id,
            u,
            r: clearR,
          })
          if (!tryBoth) break
        }
      }
    }
  }

  const out = { arches, byModel }
  segStructPlacementCache.set(seg, out)
  return out
}

// ═══════════════════════════ 3. UNIONES (uniones.jsx) ═══════════════════════════
const ROUTE_BASE = ['#38e8ff', '#ff5c8a', '#ffd24a']
function routeGlowColor(themeMec, rIdx) {
  const c = new THREE.Color(ROUTE_BASE[rIdx % ROUTE_BASE.length])
  c.lerp(new THREE.Color(themeMec), 0.25)
  return c.multiplyScalar(1.4)
}

const _m = new THREE.Matrix4(); const _x = new THREE.Vector3(); const _y = new THREE.Vector3(); const _z = new THREE.Vector3()
function spanQuat(spanDir, upDir) {
  _x.copy(spanDir).normalize()
  _y.copy(upDir).addScaledVector(_x, -upDir.dot(_x)).normalize()
  _z.crossVectors(_x, _y).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(_x, _y, _z))
}

const PILLAR_COL = new THREE.Color('#343c4d')
const BEAM_COL = new THREE.Color('#272e3c')
const DIVIDER_COL = new THREE.Color('#e0a630')
const PORT_BODY_COL = new THREE.Color('#343c4d')
const unionesCache = new WeakMap()

export function buildUnionesData(way) {
  if (unionesCache.has(way)) return unionesCache.get(way)
  const pillars = []; const beams = []; const beamTrims = []; const routeArrows = []
  const groundChevrons = []; const dividerBodies = []; const dividerGlows = []
  const portBodies = []; const portGlows = []; const porticos = []

  const world = mundoDe(way); const local = nuevoLocal()
  const P = pal(way.theme.id)
  const mecCol = new THREE.Color(P.mec).multiplyScalar(1.35)
  const outCol = new THREE.Color('#52ff9b').lerp(new THREE.Color(P.mec), 0.25).multiplyScalar(1.4)
  const inCol = new THREE.Color(P.chev).multiplyScalar(1.4)
  const f = {}

  const launch = way.segments?.find((s) => s.kind === 'salida') ?? way.segments?.[0]
  const landing = way.segments?.find((s) => s.kind === 'llegada')
  const rCount = way.routes?.length ?? 0
  const rCols = Array.from({ length: Math.max(1, rCount) }, (_, r) => routeGlowColor(P.mec, r))

  const placeArch = (fHub, hubSeg, hubU, kind, outSegs, seedBase) => {
    const lane0 = lanesOf(launch ?? way.segments[0])[0]
    const E = halfWidth(lane0) + CURB
    const halfSpan = E + TERR * 0.58
    const hubPos = fHub.pos.clone(); const hubUp = fHub.up.clone()
    const hubTan = fHub.tangent.clone(); const hubSide = fHub.side.clone()
    const archQuat = basisQuat(hubUp, hubTan)

    const pL = colocar(world, {
      pos: hubPos.clone().addScaledVector(hubSide, -halfSpan),
      seed: seedBase + 11,
      ajusta: bermaAjusta(hubPos, hubSide, hubUp, E, TERR, 0.35),
    }, 0.35, { way: way.idx }, 4, local)
    const pR = colocar(world, {
      pos: hubPos.clone().addScaledVector(hubSide, halfSpan),
      seed: seedBase + 23,
      ajusta: bermaAjusta(hubPos, hubSide, hubUp, E, TERR, 0.35),
    }, 0.35, { way: way.idx }, 4, local)

    if (pL) pillars.push({ pos: pL, quat: archQuat, scale: 1, color: PILLAR_COL })
    if (pR) pillars.push({ pos: pR, quat: archQuat, scale: 1, color: PILLAR_COL })

    let beamMid; let beamSpan; let beamQuat; let sideDir
    if (pL && pR) {
      const topL = pL.clone().addScaledVector(hubUp, 3.45)
      const topR = pR.clone().addScaledVector(hubUp, 3.45)
      const span = topR.clone().sub(topL)
      beamSpan = span.length() + 0.36
      beamMid = topL.lerp(topR, 0.5)
      sideDir = span.normalize()
      beamQuat = spanQuat(sideDir, hubUp)
    } else if (pL || pR) {
      const anchor = pL ?? pR
      const sign = pL ? 1 : -1
      beamSpan = halfSpan * 2
      beamMid = anchor.clone().addScaledVector(hubUp, 3.45).addScaledVector(hubSide, sign * halfSpan * 0.85)
      sideDir = hubSide.clone()
      beamQuat = spanQuat(sideDir, hubUp)
    }

    const sorted = (kind === 'fork' || kind === 'cross') && outSegs.length
      ? outSegs.map((sOut) => {
          const uAhead = Math.min(0.4, 14 / Math.max(sOut.length, 1))
          const pAhead = surfFrame(sOut, 0, uAhead, {}).pos
          return { sOut, lat: pAhead.clone().sub(hubPos).dot(hubSide), r: Math.max(0, sOut.route) }
        }).sort((a, b) => a.lat - b.lat)
      : null

    // pórtico de unión: abarca los tramos de su camino que nacen ahí (exentos); no debe invadir cintas de OTROS caminos
    if (beamMid && prismaLibre(world, beamMid, beamSpan * 0.5, { way, seg: '*', lane: '*' })) {
      beams.push({ pos: beamMid, quat: beamQuat, scale: [beamSpan, 1, 1], color: BEAM_COL })
      beamTrims.push({
        pos: beamMid.clone().addScaledVector(hubUp, 0.14),
        quat: beamQuat, scale: [beamSpan * 0.96, 1, 1],
        color: kind === 'merge' ? inCol : mecCol,
      })
      porticos.push({
        kind,
        way: way.idx,
        seg: hubSeg,
        lane: 0,
        u: hubU,
        pos: hubPos,
        center: beamMid.clone(),
        r: beamSpan * 0.5,
        spanHalf: beamSpan * 0.5,
        clearH: 3.45,
      })

      if (sorted) {
        const step = Math.min(0.95, (beamSpan * 0.72) / Math.max(1, sorted.length))
        for (let k = 0; k < sorted.length; k++) {
          const { lat, r } = sorted[k]
          const offset = (k - (sorted.length - 1) / 2) * step
          const aPos = beamMid.clone().addScaledVector(sideDir, offset).addScaledVector(hubUp, 0.34).addScaledVector(hubTan, -0.06)
          const latWeight = THREE.MathUtils.clamp(lat * 0.15, -0.78, 0.78)
          const aDir = hubTan.clone().multiplyScalar(0.75).addScaledVector(hubSide, latWeight).addScaledVector(hubUp, 0.18).normalize()
          routeArrows.push({ pos: aPos, quat: basisQuat(hubUp, aDir), scale: 1.15, color: rCols[r] ?? mecCol })
        }
      } else if (kind === 'merge') {
        const aPos = beamMid.clone().addScaledVector(hubUp, 0.34)
        routeArrows.push({ pos: aPos, quat: basisQuat(hubUp, hubTan), scale: 1.3, color: inCol })
      }
    }

    if (sorted && sorted.length > 1) {
      for (const { sOut, r } of sorted) {
        if (sOut.air) continue
        const col = rCols[r] ?? mecCol
        for (const d of [5.5, 11]) {
          if (d >= sOut.length * 0.85) continue
          const fr = surfFrame(sOut, 0, d / sOut.length, f)
          groundChevrons.push({
            pos: fr.pos.clone().addScaledVector(fr.up, 0.032),
            quat: basisQuat(fr.up, fr.tangent),
            scale: [1.05, 1, 1.05],
            color: col,
          })
        }
      }

      const minGap = 2 * (E + TERR) + 0.5
      for (let k = 0; k < sorted.length - 1; k++) {
        const sA = sorted[k].sOut; const sB = sorted[k + 1].sOut
        let placedFirst = false
        for (const d of [8, 10, 12, 14, 16, 18, 20, 22, 24]) {
          const fA = surfFrame(sA, 0, Math.min(0.46, d / Math.max(sA.length, 1)), {})
          const fB = surfFrame(sB, 0, Math.min(0.46, d / Math.max(sB.length, 1)), {})
          if (fA.pos.distanceTo(fB.pos) < minGap) continue
          const mid = fA.pos.clone().lerp(fB.pos, 0.5)
          const up = fA.up.clone().add(fB.up).normalize()
          const tan = fA.tangent.clone().add(fB.tangent).normalize()
          const divPos = colocar(world, { pos: mid, seed: seedBase + k * 71 + d * 13 }, 0.34, null, 4, local)
          if (!divPos) continue
          const divQuat = basisQuat(up, tan)
          const sc = placedFirst ? 0.72 : 1.0
          dividerBodies.push({ pos: divPos, quat: divQuat, scale: sc, color: DIVIDER_COL })
          dividerGlows.push({ pos: divPos, quat: divQuat, scale: sc, color: mecCol })
          if (placedFirst) break
          placedFirst = true
        }
      }
    }
    return sorted
  }

  const pushPreArrows = (inSeg, fHub, sorted) => {
    if (!inSeg || inSeg.air || !sorted?.length) return
    const H = halfWidth(lanesOf(inSeg)[0])
    for (const d of [9, 5]) {
      if (d >= inSeg.length * 0.8) continue
      const fr = surfFrame(inSeg, 0, 1 - d / inSeg.length, f)
      for (let k = 0; k < sorted.length; k++) {
        const off = (k - (sorted.length - 1) / 2) * Math.min(0.38, (H * 1.3) / Math.max(1, sorted.length))
        const dir = fr.tangent.clone().multiplyScalar(0.85).addScaledVector(fr.side, THREE.MathUtils.clamp(sorted[k].lat * 0.08, -0.5, 0.5)).normalize()
        groundChevrons.push({
          pos: fr.pos.clone().addScaledVector(fr.up, 0.032).addScaledVector(fr.side, off),
          quat: basisQuat(fr.up, dir),
          scale: [0.62, 1, 0.62],
          color: rCols[sorted[k].r] ?? mecCol,
        })
      }
    }
  }

  if (launch && launch.next?.length) {
    const fFork = surfFrame(launch, 0, 1, {})
    const outFork = launch.next.map((i) => way.segments[i]).filter(Boolean)
    const sorted = placeArch(fFork, launch, 1, 'fork', outFork, way.idx * 1009 + 1)
    pushPreArrows(launch, fFork, sorted)
  }

  const crossTail = way.routes?.[0]?.segments?.[3]
  if (crossTail && crossTail.next?.length) {
    const fCross = surfFrame(crossTail, 0, 1, {})
    const outCross = crossTail.next.map((i) => way.segments[i]).filter(Boolean)
    const sorted = placeArch(fCross, crossTail, 1, 'cross', outCross, way.idx * 1009 + 200)
    for (const rt of way.routes ?? []) pushPreArrows(rt.segments?.[3], fCross, sorted)
  }

  if (landing) {
    const fMerge = surfFrame(landing, 0, 0, {})
    placeArch(fMerge, landing, 0, 'merge', [landing], way.idx * 1009 + 400)
  }

  if (launch && !launch.air) {
    const L = Math.max(launch.length, 1)
    const H = halfWidth(lanesOf(launch)[0]); const E = H + CURB
    for (const s of [1.2, 6.8]) {
      if (s >= L * 0.85) continue
      const fr = surfFrame(launch, 0, s / L, f)
      groundChevrons.push({
        pos: fr.pos.clone().addScaledVector(fr.up, 0.032),
        quat: basisQuat(fr.up, fr.tangent),
        scale: [1.1, 1, 1.1],
        color: outCol,
      })
    }
    if (L > 8) {
      const fr = surfFrame(launch, 0, 6.8 / L, {})
      for (const side of [-1, 1]) {
        const want = fr.pos.clone().addScaledVector(fr.side, side * (E + TERR * 0.45))
        const pos = colocar(world, { pos: want, seed: way.idx * 313 + (side > 0 ? 7 : 19), ajusta: bermaAjusta(fr.pos, fr.side, fr.up, E, TERR, 0.3) }, 0.3, { way: way.idx, si: launch.i, lane: 0 }, 4, local)
        if (pos) {
          const q = basisQuat(fr.up, fr.tangent)
          portBodies.push({ pos, quat: q, scale: 1, color: PORT_BODY_COL })
          portGlows.push({ pos, quat: q, scale: 1, color: outCol })
        }
      }
    }
  }

  if (landing && !landing.air) {
    const L = Math.max(landing.length, 1)
    const H = halfWidth(lanesOf(landing)[0]); const E = H + CURB
    for (const s of [L - 6.8, L - 1.2]) {
      if (s <= L * 0.15) continue
      const fr = surfFrame(landing, 0, s / L, f)
      groundChevrons.push({
        pos: fr.pos.clone().addScaledVector(fr.up, 0.032),
        quat: basisQuat(fr.up, fr.tangent),
        scale: [1.1, 1, 1.1],
        color: inCol,
      })
    }
    if (L > 8) {
      const fr = surfFrame(landing, 0, (L - 6.8) / L, {})
      for (const side of [-1, 1]) {
        const want = fr.pos.clone().addScaledVector(fr.side, side * (E + TERR * 0.45))
        const pos = colocar(world, { pos: want, seed: way.idx * 419 + (side > 0 ? 11 : 29), ajusta: bermaAjusta(fr.pos, fr.side, fr.up, E, TERR, 0.3) }, 0.3, { way: way.idx, si: landing.i, lane: 0 }, 4, local)
        if (pos) {
          const q = basisQuat(fr.up, fr.tangent)
          portBodies.push({ pos, quat: q, scale: 1, color: PORT_BODY_COL })
          portGlows.push({ pos, quat: q, scale: 1, color: inCol })
        }
      }
    }
  }

  const out = { pillars, beams, beamTrims, routeArrows, groundChevrons, dividerBodies, dividerGlows, portBodies, portGlows, porticos }
  unionesCache.set(way, out)
  return out
}

// ═══════════════════════════ 4. KART PISTA (kartPista.jsx) ═══════════════════════════
const PIANO_K = 0.072 / TRACK_K
const BARRIER_K = 0.062 / TRACK_K
const STRAIGHT_K = 0.025 / TRACK_K
const MAX_PIANOS = 40
const MAX_BARRIERS = 32
const TUNNEL_RIBS = 7
const TUNNEL_STEP = 1.9 * TRACK_K

const FK0 = {}; const FK1 = {}; const FK2 = {}
function sampleCurvature(seg, laneId, u, L) {
  const du = Math.min(0.03, 1.5 / Math.max(L, 1))
  const u0 = Math.max(0, u - du)
  const u1 = Math.min(1, u + du)
  const ds = Math.max((u1 - u0) * L, 0.2)
  surfFrame(seg, laneId, u0, FK0)
  surfFrame(seg, laneId, u1, FK1)
  surfFrame(seg, laneId, u, FK2)
  const dx = FK1.tangent.x - FK0.tangent.x
  const dy = FK1.tangent.y - FK0.tangent.y
  const dz = FK1.tangent.z - FK0.tangent.z
  const k = Math.hypot(dx, dy, dz) / ds
  const sgn = dx * FK2.side.x + dy * FK2.side.y + dz * FK2.side.z
  return { k, sgn, f: FK2 }
}

function nearAny(list, pos, minDist) {
  const d2 = minDist * minDist
  for (let i = 0; i < list.length; i++) {
    if (list[i].pos.distanceToSquared(pos) < d2) return true
  }
  return false
}

function tooCloseToSwitch(seg, laneId, s, margin = 4.0) {
  const L = seg.length
  for (const sw of seg.switches ?? []) {
    if (sw.from !== laneId && sw.to !== laneId) continue
    if (Math.abs(sw.u * L - s) < margin) return true
    if (sw.uLand != null && Math.abs(sw.uLand * L - s) < margin) return true
  }
  return false
}

function capStride(arr, max) {
  if (arr.length <= max) return arr
  const out = []
  const step = arr.length / max
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)])
  return out
}

const kartDataCache = new WeakMap()

const kartGens = new WeakMap() // way -> generador a medias (precarga por porciones, vida/precarga.js)
const NUNCA = () => false

/** Avanza las piezas kart de `way` hasta que `agotado()` diga basta; true cuando quedaron en caché. */
export function kartPaso(way, agotado) {
  if (kartDataCache.has(way)) return true
  let g = kartGens.get(way)
  if (!g) { g = kartGen(way); kartGens.set(way, g) }
  for (;;) {
    const r = g.next()
    if (r.done) { kartGens.delete(way); kartDataCache.set(way, r.value); return true }
    if (agotado()) return false
  }
}

export function buildKartPistaData(way) {
  kartPaso(way, NUNCA)
  return kartDataCache.get(way)
}

// Los `yield` van al final de cada muestra: los marcos compartidos no se usan a medias entre reanudaciones.
function* kartGen(way) {
  const world = mundoDe(way)
  const local = nuevoLocal()
  const P = pal(way.theme.id)
  const barrierTint = new THREE.Color('#ffffff').lerp(new THREE.Color(P.a), 0.25)

  const arcos = []
  const startLines = []
  const finishLines = []
  const tuneles = []
  const bordillos = []
  const barreras = []

  const segs = way.segments ?? []
  const salida = segs.find((s) => s.kind === 'salida') ?? segs.find((s) => !s.air)
  const llegada = segs.find((s) => s.kind === 'llegada') ?? [...segs].reverse().find((s) => !s.air)

  if (salida && !salida.air) {
    const lane0 = lanesOf(salida)[0]
    if (lane0) {
      const H = halfWidth(lane0)
      const E = H + CURB
      const sStart = Math.min(4.0, salida.length * 0.25)
      const u = sStart / Math.max(salida.length, 1)
      const f = surfFrame(salida, lane0.id, u, {})
      const q = basisQuat(f.up, f.tangent)
      const qArch = q.clone().multiply(Q_Y180)
      const sx = (E + TERR * 0.28) / 0.42
      const sy = Math.min(3.4, Math.max(2.1, sx * 0.98))
      const sz = Math.min(2.6, Math.max(1.8, sx * 0.85))
      const pos = f.pos.clone().addScaledVector(f.up, -0.02)
      // arco de parrilla: abarca el haz en la zona cerrada; no debe invadir cintas de otros tramos
      if (prismaLibre(world, pos.clone().addScaledVector(f.up, 0.5 * sy), 0.42 * sx, { way, seg: salida, lane: '*' })) arcos.push({
        pos, quat: qArch, scale: [sx, sy, sz],
        way: way.idx, seg: salida, lane: lane0.id, u,
        center: pos.clone().addScaledVector(f.up, 0.5 * sy), r: 0.42 * sx, spanHalf: 0.42 * sx, clearH: sy,
      })
      startLines.push({ pos: f.pos.clone().addScaledVector(f.up, 0.014), quat: q, scale: [H * 1.96, 1, Math.min(2.6, H * 2.2)] })
    }
  }

  if (llegada && !llegada.air) {
    const lane0 = lanesOf(llegada)[0]
    if (lane0) {
      const H = halfWidth(lane0)
      const E = H + CURB
      const L = Math.max(llegada.length, 1)
      const sEnd = Math.max(L - 4.0, L * 0.75)
      const u = sEnd / L
      const f = surfFrame(llegada, lane0.id, u, {})
      const q = basisQuat(f.up, f.tangent)
      const qArch = q.clone().multiply(Q_Y180)
      const sx = (E + TERR * 0.28) / 0.42
      const sy = Math.min(3.4, Math.max(2.1, sx * 0.98))
      const sz = Math.min(2.6, Math.max(1.8, sx * 0.85))
      const pos = f.pos.clone().addScaledVector(f.up, -0.02)
      if (prismaLibre(world, pos.clone().addScaledVector(f.up, 0.5 * sy), 0.42 * sx, { way, seg: llegada, lane: '*' })) arcos.push({
        pos, quat: qArch, scale: [sx, sy, sz],
        way: way.idx, seg: llegada, lane: lane0.id, u,
        center: pos.clone().addScaledVector(f.up, 0.5 * sy), r: 0.42 * sx, spanHalf: 0.42 * sx, clearH: sy,
      })
      finishLines.push({ pos: f.pos.clone().addScaledVector(f.up, 0.014), quat: q, scale: [H * 1.96, 1, Math.min(2.2, H * 1.9)] })
    }
  }

  const spanNeed = (TUNNEL_RIBS - 1) * TUNNEL_STEP
  let tunnelPicked = null
  const orderedForTunnel = [
    ...segs.filter((s) => !s.air && s.kind !== 'salida' && s.kind !== 'llegada'),
    ...segs.filter((s) => !s.air && (s.kind === 'salida' || s.kind === 'llegada')),
  ]
  for (const seg of orderedForTunnel) {
    if (tunnelPicked) break
    const L = seg.length
    if (L < spanNeed + 16) continue
    const lane0 = lanesOf(seg)[0]
    if (!lane0) continue
    const sMin = seg.kind === 'salida' ? 16 : 8
    const sMax = seg.kind === 'llegada' ? L - 16 - spanNeed : L - 8 - spanNeed
    for (let s0 = sMin; s0 <= sMax; s0 += 4) {
      let ok = true
      for (let i = 0; i < TUNNEL_RIBS; i++) {
        const siPos = s0 + i * TUNNEL_STEP
        if (tooCloseToSwitch(seg, lane0.id, siPos, 3.5)) { ok = false; break }
        const { k } = sampleCurvature(seg, lane0.id, siPos / L, L)
        if (k > STRAIGHT_K) { ok = false; break }
        // gálibo ajeno: ninguna costilla del túnel invade otra cinta
        const E0 = halfWidth(lane0) + CURB; const tsx = (E0 + TERR * 0.25) / 0.45; const tsy = Math.min(4.2, Math.max(2.3, tsx * 1.25))
        const tf = surfFrame(seg, lane0.id, siPos / L, {})
        if (!prismaLibre(world, tf.pos.clone().addScaledVector(tf.up, 0.5 * tsy - 0.02), 0.45 * tsx, { way, seg, lane: lane0.id })) { ok = false; break }
      }
      if (ok) {
        tunnelPicked = { seg, lane: lane0, s0 }
        break
      }
      yield
    }
  }
  if (tunnelPicked) {
    const { seg, lane, s0 } = tunnelPicked
    const L = seg.length
    const H = halfWidth(lane)
    const E = H + CURB
    const sx = (E + TERR * 0.25) / 0.45
    const sy = Math.min(4.2, Math.max(2.3, sx * 1.25))
    const sz = 2.0
    for (let i = 0; i < TUNNEL_RIBS; i++) {
      const u = (s0 + i * TUNNEL_STEP) / L
      const f = surfFrame(seg, lane.id, u, {})
      const pos = f.pos.clone().addScaledVector(f.up, -0.02)
      tuneles.push({
        pos,
        quat: basisQuat(f.up, f.tangent),
        scale: [sx, sy, sz],
        way: way.idx, seg, lane: lane.id, u,
        center: pos.clone().addScaledVector(f.up, 0.5 * sy), r: 0.45 * sx, spanHalf: 0.45 * sx, clearH: sy,
      })
    }
  }

  const pianoCands = []
  const barrierCands = []
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si]
    if (seg.air) continue
    const L = seg.length
    const lanes = lanesOf(seg)
    for (const lane of lanes) {
      const H = halfWidth(lane)
      const E = H + CURB
      for (let s = 4; s < L - 4; s += 1.6) {
        const u = s / L
        const { k, sgn, f } = sampleCurvature(seg, lane.id, u, L)
        if (Math.abs(sgn) < 1e-4) continue
        if (tooCloseToSwitch(seg, lane.id, s, 3.2)) continue
        if (lane.id !== lanes[0].id) {
          const f0 = surfFrame(seg, lanes[0].id, u, FK0)
          if (f.pos.distanceToSquared(f0.pos) < (E * 2.2) ** 2) continue
        }
        const inSide = Math.sign(sgn)
        const outSide = -inSide
        if (k >= PIANO_K) {
          pianoCands.push({
            k,
            pos: f.pos.clone().addScaledVector(f.side, inSide * (H + CURB * 0.52)).addScaledVector(f.up, -0.015),
            quat: basisQuat(f.up, f.tangent).multiply(inSide > 0 ? Q_YN90 : Q_Y90),
            scale: [1.35, 0.55, 0.35],
          })
        }
        if (k >= BARRIER_K) {
          const o = f.pos.clone()
          const fSide = f.side.clone()
          const fUp = f.up.clone()
          const want = o.clone().addScaledVector(fSide, outSide * (E + TERR * 0.52)).addScaledVector(fUp, -0.025)
          const seed = way.idx * 8191 + si * 257 + lane.id * 31 + Math.round(s * 10)
          const quat = basisQuat(fUp, f.tangent).multiply(outSide > 0 ? Q_YN90 : Q_Y90)
          barrierCands.push({ k, o, fSide, fUp, E, want, seed, quat, si, laneId: lane.id })
        }
        yield
      }
    }
  }

  const pianoPicked = capStride(pianoCands, MAX_PIANOS)
  for (const c of pianoPicked) {
    if (nearAny(bordillos, c.pos, 1.32)) continue
    bordillos.push({ pos: c.pos, quat: c.quat, scale: c.scale })
  }

  const barrierPicked = capStride(barrierCands, MAX_BARRIERS)
  for (const c of barrierPicked) {
    if (nearAny(barreras, c.want, 1.5)) continue
    const p = colocar(
      world,
      { pos: c.want, seed: c.seed, ajusta: bermaAjusta(c.o, c.fSide, c.fUp, c.E, TERR, 0.32) },
      0.32,
      { way: way.idx, si: c.si, lane: c.laneId },
      2,
      local,
    )
    if (!p || nearAny(barreras, p, 1.45)) continue
    barreras.push({ pos: p, quat: c.quat, scale: [1.5, 1.0, 0.55], color: barrierTint })
  }

  return { arcos, startLines, finishLines, tuneles, bordillos, barreras }
}

// ═══════════════════════════ 5. VOLÚMENES DEL MUNDO PARA EL MEDIDOR ═══════════════════════════
export function colocarTodoMundo(world) {
  registrarMundo(world)
  const items = []
  for (const way of world.ways ?? []) {
    const an = buildAnillosData(way)
    for (const r of an.rings) {
      items.push({ kind: 'anillo', way: way.idx, seg: r.seg, lane: r.lane, u: r.u, center: r.center, r: r.r, clearH: r.clearH })
    }
    const un = buildUnionesData(way)
    for (const p of un.porticos) {
      items.push({ kind: `portico_${p.kind}`, way: way.idx, seg: '*', lane: '*', hubSeg: p.seg, u: p.u, center: p.center, r: p.r, clearH: p.clearH, isJoint: true })
    }
    const kp = buildKartPistaData(way)
    for (const a of kp.arcos) {
      items.push({ kind: 'arco_kart', way: way.idx, seg: a.seg, lane: '*', u: a.u, center: a.center, r: a.r, clearH: a.clearH, isJoint: true })
    }
    for (const t of kp.tuneles) {
      items.push({ kind: 'tunel_kart', way: way.idx, seg: t.seg, lane: t.lane, u: t.u, center: t.center, r: t.r, clearH: t.clearH })
    }
    way.segments?.forEach((seg, si) => {
      if (seg.air) return
      const st = placeSegArchesAndProps(way, seg, si)
      for (const a of st.arches) {
        items.push({ kind: `arco_${way.theme.id}`, way: way.idx, seg, lane: a.bundled ? '*' : a.lane, u: a.u, center: a.center, r: a.r, clearH: a.clearH, bundled: a.bundled })
      }
    })
  }
  return items
}
