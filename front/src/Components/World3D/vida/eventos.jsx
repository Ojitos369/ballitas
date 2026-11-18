// Mecanismos de cambio: piezas low-poly compartidas y animación local sin estado React por cuadro.
import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import * as WORLD from '../../../Core/world.js'
import { getBallitas, Instanced, markShared } from './base.jsx'
import { basisQuat } from './dyn.js'
import { halfWidth, lanesOf, pal, surfFrame, TERR, CURB } from './pista.jsx'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'

const KINDS = ['geiser', 'arbol', 'erupcion', 'rampa', 'cascada', 'viento']

function buildChevronGeo() {
  const armL = new THREE.BoxGeometry(0.14, 0.028, 0.56).rotateY(0.58).translate(-0.15, 0.014, 0)
  const armR = new THREE.BoxGeometry(0.14, 0.028, 0.56).rotateY(-0.58).translate(0.15, 0.014, 0)
  const g = mergeGeometries([armL, armR], false)
  armL.dispose(); armR.dispose()
  g.name = 'eventos:chevron'
  return markShared(g)
}

function buildBeaconPostGeo() {
  const base = new THREE.CylinderGeometry(0.16, 0.2, 0.08, 8).translate(0, 0.04, 0)
  const pole = new THREE.CylinderGeometry(0.045, 0.055, 0.72, 7).translate(0, 0.4, 0)
  const panel = new THREE.CylinderGeometry(0.32, 0.32, 0.08, 8).rotateX(Math.PI / 2).translate(0, 0.82, 0)
  const g = mergeGeometries([base, pole, panel], false)
  base.dispose(); pole.dispose(); panel.dispose()
  g.name = 'eventos:beaconPost'
  return markShared(g)
}

function buildBeaconArrowGeo() {
  const shaft = new THREE.BoxGeometry(0.24, 0.085, 0.11).translate(-0.08, 0, 0)
  const head = new THREE.ConeGeometry(0.14, 0.24, 4).rotateY(Math.PI / 4).rotateZ(-Math.PI / 2).scale(1, 1, 0.45).translate(0.14, 0, 0)
  const g = mergeGeometries([shaft, head], false)
  shaft.dispose(); head.dispose()
  g.name = 'eventos:beaconArrow'
  return markShared(g)
}

const G = {
  sphere: markShared(new THREE.SphereGeometry(1, 8, 6)),
  cone: markShared(new THREE.ConeGeometry(1, 1, 8, 1)),
  cyl: markShared(new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
  torus: markShared(new THREE.TorusGeometry(0.55, 0.055, 5, 14)),
  box: markShared(new THREE.BoxGeometry(1, 1, 1)),
  chevron: buildChevronGeo(),
  beaconPost: buildBeaconPostGeo(),
  beaconArrow: buildBeaconArrowGeo(),
}
const MC = new Map()
function mat(hex, emissive = '#000000') {
  const key = hex + ':' + emissive
  if (!MC.has(key)) MC.set(key, markShared(new THREE.MeshLambertMaterial({ color: hex, emissive, emissiveIntensity: 0.25 })))
  return MC.get(key)
}
const EMISSIVE_INST_MAT = markShared(new THREE.MeshBasicMaterial({
  color: '#ffffff', toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
}))
const POST_MAT = markShared(new THREE.MeshLambertMaterial({ color: '#242a35' }))
const MATS = ['#252a32', '#69727d', '#ff9d35', '#47d9f5', '#dcf7ff', '#ff4c3d'].map((c) => mat(c, c === '#47d9f5' ? c : '#000000'))
export const eventosWarmup = () => [...MATS, EMISSIVE_INST_MAT, POST_MAT]

// Lado (±1 sobre f.side) hacia el que queda el carril destino al despegar: ahí van flechas, baliza y mecanismo.
const _dst = {}
export function destSide(seg, sw, f) {
  const b = surfFrame(seg, sw.to, sw.u, _dst)
  const d = b.pos.clone().sub(f.pos).dot(f.side)
  return d < 0 ? -1 : 1
}

// Mantiene un objeto de berma en su franja lateral (mismo contrato que decor.jsx).
function bermaAjusta(o, side, up, E, rad) {
  return (p) => {
    const xx = (p.x - o.x) * side.x + (p.y - o.y) * side.y + (p.z - o.z) * side.z
    const a = Math.max(Math.abs(xx), E + rad * 0.5)
    return a > E + TERR + rad + 0.6 ? null : o.clone().addScaledVector(side, Math.sign(xx || 1) * a).addScaledVector(up, -0.02)
  }
}

const switchCache = new WeakMap()
function switchData(way) {
  if (switchCache.has(way)) return switchCache.get(way)
  const out = []
  const world = mundoDe(way); const local = nuevoLocal()
  const P = pal(way.theme.id)
  way.segments?.forEach((seg, si) => {
    for (const sw of seg.switches ?? []) {
      const kind = KINDS.includes(sw.kind) ? sw.kind : 'rampa'
      const lane = lanesOf(seg).find((l) => l.id === sw.from)
      if (!lane) continue
      const f = surfFrame(seg, lane.id, sw.u, {})
      const side = destSide(seg, sw, f)
      // Del lado hacia el que salta la ballita, fuera del bordillo; colocado sin pisar otras pistas.
      const E = halfWidth(lane) + CURB
      const o = f.pos.clone()
      const want = o.clone().addScaledVector(f.side, side * (E + TERR * 0.43))
      const seed = Math.floor(sw.u * 1e6) + lane.id * 139 + way.idx * 733
      const pos = colocar(world, { pos: want, seed, ajusta: bermaAjusta(o, f.side, f.up, E, 0.6) }, 0.6, { way: way.idx, si, lane: lane.id }, 4, local)
      if (!pos) continue
      const quat = basisQuat(f.up, f.tangent)
      const start = Math.max(0, sw.u - 0.018)
      out.push({ seg, si, sw, kind, pos, quat, up: f.up.clone(), tangent: f.tangent.clone(), side, accent: P.mec, seed, start })
    }
  })
  switchCache.set(way, out)
  return out
}

const preSignCache = new WeakMap()
const _bM = new THREE.Matrix4(); const _bX = new THREE.Vector3(); const _bY = new THREE.Vector3(); const _bZ = new THREE.Vector3()
function preSignData(way) {
  if (preSignCache.has(way)) return preSignCache.get(way)
  const chevrons = []; const posts = []; const arrows = []
  const world = mundoDe(way); const local = nuevoLocal()
  const P = pal(way.theme.id)
  const glowCol = new THREE.Color(P.mec).multiplyScalar(1.35)
  const arrowCol = new THREE.Color(P.mec).multiplyScalar(1.45)
  const seen = new Set()
  const f = {}
  way.segments?.forEach((seg, si) => {
    const lanes = lanesOf(seg)
    if (!lanes.length || !seg.switches?.length) return
    const L = Math.max(seg.length, 1)
    for (const sw of seg.switches) {
      const lane = lanes.find((l) => l.id === sw.from)
      if (!lane) continue
      surfFrame(seg, lane.id, sw.u, f)
      const side = destSide(seg, sw, f)
      const dedupKey = `${si}:${lane.id}:${Math.round(sw.u * 1000)}:${side}`
      if (seen.has(dedupKey)) continue
      seen.add(dedupKey)

      const H = halfWidth(lane)
      const E = H + CURB
      // 3 chevrons pintados sobre el asfalto 17u, 12.5u y 8u antes del salto
      const dists = [17, 12.5, 8]
      for (let k = 0; k < dists.length; k++) {
        const uMark = sw.u - dists[k] / L
        if (uMark < 0.02) continue
        surfFrame(seg, lane.id, uMark, f)
        const dir = f.tangent.clone().multiplyScalar(0.72).addScaledVector(f.side, side * 0.69).normalize()
        const pos = f.pos.clone().addScaledVector(f.up, 0.032).addScaledVector(f.side, side * H * 0.16)
        const sc = 0.72 + k * 0.13
        chevrons.push({ pos, quat: basisQuat(f.up, dir), scale: [sc, 1, sc], color: glowCol })
      }

      // Baliza al borde con flecha hacia el carril destino unos ~12u antes del mecanismo
      const dSign = Math.min(12.5, sw.u * L * 0.65)
      if (dSign < 4) continue
      const uSign = Math.max(0.02, sw.u - dSign / L)
      surfFrame(seg, lane.id, uSign, f)
      const o = f.pos.clone(); const fSide = f.side.clone(); const fUp = f.up.clone(); const fTan = f.tangent.clone()
      const want = o.clone().addScaledVector(fSide, side * (E + TERR * 0.44))
      const seed = Math.floor(sw.u * 1e6) + lane.id * 271 + way.idx * 911 + (side > 0 ? 17 : 31)
      const pos = colocar(world, { pos: want, seed, ajusta: bermaAjusta(o, fSide, fUp, E, 0.38) }, 0.38, { way: way.idx, si, lane: lane.id }, 4, local)
      if (!pos) continue
      const postQuat = basisQuat(fUp, fTan)
      posts.push({ pos, quat: postQuat, scale: 1 })
      _bX.copy(fSide).multiplyScalar(side).addScaledVector(fUp, 0.28).normalize()
      _bZ.copy(fTan).negate().normalize()
      _bY.crossVectors(_bZ, _bX).normalize()
      _bZ.crossVectors(_bX, _bY).normalize()
      const arrowQuat = new THREE.Quaternion().setFromRotationMatrix(_bM.makeBasis(_bX, _bY, _bZ))
      const arrowPos = pos.clone().addScaledVector(fUp, 0.82)
      arrows.push({ pos: arrowPos, quat: arrowQuat, scale: 1.15, color: arrowCol })
    }
  })
  const res = { chevrons, posts, arrows }
  preSignCache.set(way, res)
  return res
}

const AXIS = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
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
  const up = a.up?.clone?.() ?? Y
  P1.copy(P0).add(P2).multiplyScalar(0.5).addScaledVector(up, sw.apex ?? Math.max(1.2, P0.distanceTo(P2) * 0.25))
  const q = 1 - t
  return out.copy(P0).multiplyScalar(q * q).addScaledVector(P1, 2 * q * t).addScaledVector(P2, t * t)
}

function Piece({ kind, accent, refs }) {
  // Origin is at the surface, local Y follows lane gravity. Forms stay outside the road edge.
  const shared = { castShadow: false, receiveShadow: false }
  if (kind === 'arbol') return <group>
    <mesh ref={refs[0]} geometry={G.cyl} material={MATS[0]} position={[0, 1.0, 0]} scale={[0.17, 2, 0.17]} {...shared} />
    <mesh geometry={G.sphere} material={mat('#3d874b')} position={[0, 2.25, 0]} scale={[0.85, 0.8, 0.78]} {...shared} />
  </group>
  if (kind === 'rampa') return <group>
    <mesh geometry={G.box} material={mat('#414956')} position={[0, 0.18, 0.15]} rotation={[-0.3, 0, 0]} scale={[1.5, 0.28, 1.0]} {...shared} />
    <mesh geometry={G.torus} material={mat(accent, accent)} position={[0, 1.5, 0.35]} rotation={[Math.PI / 2, 0, 0]} scale={0.55} {...shared} />
    <mesh geometry={G.torus} material={mat(accent, accent)} position={[0, 2.5, 0.6]} rotation={[Math.PI / 2, 0, 0]} scale={0.42} {...shared} />
    <mesh geometry={G.box} material={mat('#ffffff')} position={[0, 0.38, 0.18]} scale={[0.1, 0.035, 0.8]} {...shared} />
  </group>
  if (kind === 'geiser' || kind === 'cascada') return <group>
    <mesh geometry={G.cyl} material={MATS[0]} position={[0, 0.2, 0]} scale={[0.48, 0.36, 0.48]} {...shared} />
    <mesh ref={refs[0]} geometry={G.cyl} material={MATS[3]} position={[0, 0.65, 0]} scale={[0.16, 0.9, 0.16]} {...shared} />
    <mesh geometry={G.torus} material={mat(accent, accent)} position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.56} {...shared} />
  </group>
  if (kind === 'erupcion') return <group>
    <mesh geometry={G.cone} material={MATS[0]} position={[0, 0.35, 0]} scale={[0.8, 0.7, 0.8]} {...shared} />
    <mesh ref={refs[0]} geometry={G.sphere} material={MATS[2]} position={[0, 0.9, 0]} scale={[0.23, 0.3, 0.23]} {...shared} />
    <mesh geometry={G.torus} material={MATS[5]} position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.4} {...shared} />
  </group>
  return <group>
    <mesh geometry={G.cyl} material={MATS[1]} position={[0, 0.65, 0]} scale={[0.12, 1.3, 0.12]} {...shared} />
    <mesh ref={refs[0]} geometry={G.torus} material={mat(accent, accent)} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} {...shared} />
    <mesh geometry={G.torus} material={MATS[4]} position={[0, 1.0, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.72} {...shared} />
  </group>
}

function Mechanism({ item, events }) {
  const root = useRef(); const moving = useRef(); const seen = useRef(new WeakSet())
  const camera = useThree((s) => s.camera)
  const phase = useMemo(() => (item.seed % 1000) / 1000 * Math.PI * 2, [item.seed])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase
    const rootObj = root.current
    if (!rootObj) return
    rootObj.visible = camera.position.distanceToSquared(item.pos) < 190 * 190
    rootObj.rotation.y = Math.sin(t * 0.25) * 0.035
    const part = moving.current
    if (item.kind === 'arbol') {
      const active = events.active > 0
      if (part) part.rotation.z = THREE.MathUtils.damp(part.rotation.z, active ? -0.95 : 0, 6, dt)
    } else if (item.kind === 'geiser' || item.kind === 'cascada') {
      if (part) {
        const pulse = item.kind === 'cascada' ? 0.9 + 0.1 * Math.sin(t * 2) : 0.12 + Math.max(0, Math.sin(t * 1.4)) * 1.25
        part.scale.y = pulse
        part.position.y = 0.4 + pulse * 0.45
      }
    } else if (item.kind === 'erupcion') {
      if (part) { const pulse = events.active > 0 ? 1 : 0.35 + Math.max(0, Math.sin(t * 1.15)) * 0.6; part.scale.setScalar(pulse) }
    } else if (item.kind === 'viento' && part) part.rotation.z = t * 1.7
    const balls = getBallitas()
    for (const b of balls) {
      if (!b || seen.current.has(b)) continue
      const flight = b.flight
      if (b.airborne && flight?.sw === item.sw) {
        seen.current.add(b)
        events.active = Math.max(events.active, 1.1)
      } else if (b.seg === item.seg && b.lane === item.sw.from && b.segT >= item.start && b.segT <= item.sw.u) {
        // Si el núcleo todavía no expuso el estado de vuelo, la detección de llegada usa el evento.
        if (item.sw.chance == null || Math.random() < item.sw.chance) {
          seen.current.add(b)
          events.active = Math.max(events.active, 1.1)
        }
      }
    }
    events.active = Math.max(0, events.active - dt)
    if (events.active <= 0 && clock.elapsedTime > events.nextAt) {
      events.active = 0.85 + (item.seed % 80) / 100
      events.nextAt = clock.elapsedTime + 8 + (item.seed % 110) / 10
    }
  })
  return <group ref={root} position={item.pos} quaternion={item.quat}>
    <Piece kind={item.kind} accent={item.accent} refs={[moving]} />
  </group>
}

const T_S = new THREE.Vector3(); const T_Q = new THREE.Quaternion(); const T_M = new THREE.Matrix4(); const T_P = new THREE.Vector3()
function FlightTrails({ items }) {
  const mesh = useRef();
  const geo = useMemo(() => G.sphere, [])
  const trailMat = useMemo(() => mat('#ffffff', '#bcefff'), [])
  const cap = Math.max(1, items.length * 10)
  const inst = useMemo(() => { const m = new THREE.InstancedMesh(geo, trailMat, cap); m.count = 0; m.frustumCulled = false; m.userData.noCull = true; return m }, [geo, trailMat, cap])
  const bySw = useMemo(() => new Map(items.map((x) => [x.sw, x])), [items])
  useFrame(() => {
    const m = mesh.current; if (!m) return
    m.count = 0
    const scale = T_S; const q = T_Q; const mat4 = T_M; const p = T_P
    for (const b of getBallitas()) {
      if (!b?.airborne || !b.flight) continue
      const item = bySw.get(b.flight.sw)
      if (!item) continue
      for (let i = 0; i < 10 && m.count < cap; i++) {
        const t = Math.max(0, b.flight.t - i * 0.018)
        arcPoint(item.seg, item.sw, t, p)
        scale.setScalar((1 - i / 11) * 0.105)
        m.setMatrixAt(m.count++, mat4.compose(p, q, scale))
      }
    }
    m.instanceMatrix.needsUpdate = true
  })
  return <primitive ref={mesh} object={inst} />
}

export default function Eventos({ way }) {
  const items = useMemo(() => switchData(way), [way])
  const pre = useMemo(() => preSignData(way), [way])
  const ev = useMemo(() => items.map((x) => ({ active: 0, nextAt: 2 + (x.seed % 70) / 10 })), [items])
  if (!items.length && !pre.chevrons.length) return null
  return <group>
    <Instanced geo={G.chevron} mat={EMISSIVE_INST_MAT} items={pre.chevrons} />
    <Instanced geo={G.beaconPost} mat={POST_MAT} items={pre.posts} />
    <Instanced geo={G.beaconArrow} mat={EMISSIVE_INST_MAT} items={pre.arrows} />
    {items.map((item, i) => <Mechanism key={i} item={item} events={ev[i]} />)}
    <FlightTrails items={items} />
  </group>
}
