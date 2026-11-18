// Piezas de pista estilo kart por camino: arcos de salida/meta con líneas a cuadros,
// túnel de arcos en tramo recto, pianos (bordillos) en curvas cerradas y barreras en el borde exterior.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, bermaAjusta, getWayDetail, markShared } from './base.jsx'
import { basisQuat } from './dyn.js'
import { useKit, precargarKit } from '../Modelos.jsx'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, halfWidth, lanesOf, pal, surfFrame } from './pista.jsx'

const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Q_Y90 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI / 2)
const Q_YN90 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, -Math.PI / 2)
const Q_Y180 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI)

const PIANO_K = 0.072 // curvatura (1/u) mínima para pianos en curvas cerradas
const BARRIER_K = 0.062 // curvatura (1/u) mínima para barreras exteriores
const STRAIGHT_K = 0.025 // curvatura máxima para considerar un tramo recto (túnel)
const MAX_PIANOS = 40
const MAX_BARRIERS = 32
const TUNNEL_RIBS = 7
const TUNNEL_STEP = 1.9

export const KART_KIT_PIECES = ['arco_salida', 'tunel_arco', 'bordillo', 'barrera']

// Geometría plana 1×1 en XZ (base y=0) con UV recortado al cuadrado interior [0.15..0.85] de las texturas .webp.
function buildLineDecalGeo() {
  const g = new THREE.PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, 0.15 + uv.getX(i) * 0.7, 0.85 - uv.getY(i) * 0.7)
  }
  g.name = 'kart:lineDecal'
  return markShared(g)
}
const LINE_DECAL_GEO = buildLineDecalGeo()

const lineMatCache = new Map()
function lineDecalMat(file) {
  if (lineMatCache.has(file)) return lineMatCache.get(file)
  const tex = new THREE.TextureLoader().load(BASE_TEX + file)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  markShared(tex)
  const m = new THREE.MeshLambertMaterial({
    map: tex,
    color: '#ffffff',
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  })
  markShared(m)
  lineMatCache.set(file, m)
  return m
}

const F0 = {}; const F1 = {}; const F2 = {}
function sampleCurvature(seg, laneId, u, L) {
  const du = Math.min(0.03, 1.5 / Math.max(L, 1))
  const u0 = Math.max(0, u - du)
  const u1 = Math.min(1, u + du)
  const ds = Math.max((u1 - u0) * L, 0.2)
  surfFrame(seg, laneId, u0, F0)
  surfFrame(seg, laneId, u1, F1)
  surfFrame(seg, laneId, u, F2)
  const dx = F1.tangent.x - F0.tangent.x
  const dy = F1.tangent.y - F0.tangent.y
  const dz = F1.tangent.z - F0.tangent.z
  const k = Math.hypot(dx, dy, dz) / ds
  const sgn = dx * F2.side.x + dy * F2.side.y + dz * F2.side.z
  return { k, sgn, f: F2 }
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

function buildKartPistaData(way) {
  if (kartDataCache.has(way)) return kartDataCache.get(way)
  const world = mundoDe(way)
  const local = nuevoLocal()
  const P = pal(way.theme.id)
  const barrierTint = new THREE.Color('#ffffff').lerp(new THREE.Color(P.a), 0.25)

  const arcos = []
  const startLines = []
  const finishLines = []
  const tuneles = []
  let bordillos = []
  let barreras = []

  const segs = way.segments ?? []
  const salida = segs.find((s) => s.kind === 'salida') ?? segs.find((s) => !s.air)
  const llegada = segs.find((s) => s.kind === 'llegada') ?? [...segs].reverse().find((s) => !s.air)

  // 1) Línea y arco de salida
  if (salida && !salida.air) {
    const lane0 = lanesOf(salida)[0]
    if (lane0) {
      const H = halfWidth(lane0)
      const E = H + CURB
      const sStart = Math.min(4.0, salida.length * 0.25)
      const f = surfFrame(salida, lane0.id, sStart / Math.max(salida.length, 1), {})
      const q = basisQuat(f.up, f.tangent)
      const qArch = q.clone().multiply(Q_Y180)
      const sx = (E + TERR * 0.28) / 0.42
      const sy = Math.min(3.4, Math.max(2.1, sx * 0.98))
      const sz = Math.min(2.6, Math.max(1.8, sx * 0.85))
      arcos.push({ pos: f.pos.clone().addScaledVector(f.up, -0.02), quat: qArch, scale: [sx, sy, sz] })
      startLines.push({ pos: f.pos.clone().addScaledVector(f.up, 0.014), quat: q, scale: [H * 1.96, 1, Math.min(2.6, H * 2.2)] })
    }
  }

  // 2) Línea y arco de meta
  if (llegada && !llegada.air) {
    const lane0 = lanesOf(llegada)[0]
    if (lane0) {
      const H = halfWidth(lane0)
      const E = H + CURB
      const L = Math.max(llegada.length, 1)
      const sEnd = Math.max(L - 4.0, L * 0.75)
      const f = surfFrame(llegada, lane0.id, sEnd / L, {})
      const q = basisQuat(f.up, f.tangent)
      const qArch = q.clone().multiply(Q_Y180)
      const sx = (E + TERR * 0.28) / 0.42
      const sy = Math.min(3.4, Math.max(2.1, sx * 0.98))
      const sz = Math.min(2.6, Math.max(1.8, sx * 0.85))
      arcos.push({ pos: f.pos.clone().addScaledVector(f.up, -0.02), quat: qArch, scale: [sx, sy, sz] })
      finishLines.push({ pos: f.pos.clone().addScaledVector(f.up, 0.014), quat: q, scale: [H * 1.96, 1, Math.min(2.2, H * 1.9)] })
    }
  }

  // 3) Túnel de arcos repetidos en un tramo recto por camino
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
      }
      if (ok) {
        tunnelPicked = { seg, lane: lane0, s0 }
        break
      }
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
      const f = surfFrame(seg, lane.id, (s0 + i * TUNNEL_STEP) / L, {})
      tuneles.push({
        pos: f.pos.clone().addScaledVector(f.up, -0.02),
        quat: basisQuat(f.up, f.tangent),
        scale: [sx, sy, sz],
      })
    }
  }

  // 4) Pianos (bordillo) en curvas cerradas y barreras en el borde exterior de curvas
  const pianoCands = []
  const barrierCands = []
  segs.forEach((seg, si) => {
    if (seg.air) return
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
        // En puntas donde los carriles coinciden (d < 2*E), solo carril 0 evita duplicar
        if (lane.id !== lanes[0].id) {
          const f0 = surfFrame(seg, lanes[0].id, u, F0)
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
      }
    }
  })

  // Repartir pianos y barreras por todas las curvas cerradas (en grupos contiguos de curva, sin acumular en una sola)
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

  const out = { arcos, startLines, finishLines, tuneles, bordillos, barreras }
  kartDataCache.set(way, out)
  return out
}

function KitInstanced({ nombre, items, receiveShadow = false }) {
  const kit = useKit(nombre)
  if (!kit || !items.length) return null
  return <Instanced geo={kit.geometry} mat={kit.material} items={items} receiveShadow={receiveShadow} />
}

export default function KartPista({ way }) {
  useEffect(() => { precargarKit(KART_KIT_PIECES) }, [])
  const data = useMemo(() => buildKartPistaData(way), [way])
  const startMat = useMemo(() => lineDecalMat('carrera_salida.webp'), [])
  const finishMat = useMemo(() => lineDecalMat('carrera_meta.webp'), [])
  const detail = getWayDetail(way)
  const solidRef = useRef()

  useFrame(() => {
    if (solidRef.current && detail) solidRef.current.visible = detail.value >= 0.3
  })

  return (
    <group ref={solidRef}>
      <Instanced geo={LINE_DECAL_GEO} mat={startMat} items={data.startLines} />
      <Instanced geo={LINE_DECAL_GEO} mat={finishMat} items={data.finishLines} />
      <KitInstanced nombre="arco_salida" items={data.arcos} />
      <KitInstanced nombre="tunel_arco" items={data.tuneles} />
      <KitInstanced nombre="bordillo" items={data.bordillos} receiveShadow />
      <KitInstanced nombre="barrera" items={data.barreras} receiveShadow />
    </group>
  )
}
