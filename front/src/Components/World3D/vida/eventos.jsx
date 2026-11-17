// Mecanismos de cambio: piezas low-poly compartidas y animación local sin estado React por cuadro.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import * as WORLD from '../../../Core/world.js'
import { getBallitas, markShared, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { halfWidth, lanesOf, pal, surfFrame, TERR, CURB } from './pista.jsx'

const KINDS = ['geiser', 'arbol', 'erupcion', 'rampa', 'cascada', 'viento']
const G = {
  sphere: markShared(new THREE.SphereGeometry(1, 8, 6)),
  cone: markShared(new THREE.ConeGeometry(1, 1, 8, 1)),
  cyl: markShared(new THREE.CylinderGeometry(0.5, 0.5, 1, 8)),
  torus: markShared(new THREE.TorusGeometry(0.55, 0.055, 5, 14)),
  box: markShared(new THREE.BoxGeometry(1, 1, 1)),
}
const MC = new Map()
function mat(hex, emissive = '#000000') {
  const key = hex + ':' + emissive
  if (!MC.has(key)) MC.set(key, markShared(new THREE.MeshLambertMaterial({ color: hex, emissive, emissiveIntensity: 0.25 })))
  return MC.get(key)
}
const MATS = ['#252a32', '#69727d', '#ff9d35', '#47d9f5', '#dcf7ff', '#ff4c3d'].map((c) => mat(c, c === '#47d9f5' ? c : '#000000'))
export const eventosWarmup = () => MATS

function switchData(way) {
  const out = []
  for (const seg of way.segments ?? []) for (const sw of seg.switches ?? []) {
    const kind = KINDS.includes(sw.kind) ? sw.kind : 'rampa'
    const lane = lanesOf(seg).find((l) => l.id === sw.from)
    if (!lane) continue
    const f = surfFrame(seg, lane.id, sw.u)
    const P = pal(way.theme.id)
    // Al lado exterior de la curva, fuera del borde y del corredor de seguridad.
    const side = sw.side === -1 ? -1 : 1
    const pos = f.pos.clone().addScaledVector(f.side, side * (halfWidth(lane) + CURB + TERR * 0.43))
    const quat = basisQuat(f.up, f.tangent)
    const start = Math.max(0, sw.u - 0.018)
    const seed = Math.floor(sw.u * 1e6) + lane.id * 139 + way.idx * 733
    out.push({ seg, sw, kind, pos, quat, up: f.up.clone(), tangent: f.tangent.clone(), accent: new THREE.Color(P.mec), seed, start })
  }
  return out
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
    <mesh geometry={G.torus} material={mat('#ffffff')} position={[0, 1.5, 0.35]} rotation={[Math.PI / 2, 0, 0]} scale={0.55} {...shared} />
    <mesh geometry={G.torus} material={mat('#ffffff')} position={[0, 2.5, 0.6]} rotation={[Math.PI / 2, 0, 0]} scale={0.42} {...shared} />
    <mesh geometry={G.box} material={mat('#ffffff')} position={[0, 0.38, 0.18]} scale={[0.1, 0.035, 0.8]} {...shared} />
  </group>
  if (kind === 'geiser' || kind === 'cascada') return <group>
    <mesh geometry={G.cyl} material={MATS[0]} position={[0, 0.2, 0]} scale={[0.48, 0.36, 0.48]} {...shared} />
    <mesh ref={refs[0]} geometry={G.cyl} material={MATS[3]} position={[0, 0.65, 0]} scale={[0.16, 0.9, 0.16]} {...shared} />
    <mesh geometry={G.torus} material={MATS[4]} position={[0, 0.38, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.56} {...shared} />
  </group>
  if (kind === 'erupcion') return <group>
    <mesh geometry={G.cone} material={MATS[0]} position={[0, 0.35, 0]} scale={[0.8, 0.7, 0.8]} {...shared} />
    <mesh ref={refs[0]} geometry={G.sphere} material={MATS[2]} position={[0, 0.9, 0]} scale={[0.23, 0.3, 0.23]} {...shared} />
    <mesh geometry={G.torus} material={MATS[5]} position={[0, 0.68, 0]} rotation={[Math.PI / 2, 0, 0]} scale={0.4} {...shared} />
  </group>
  return <group>
    <mesh geometry={G.cyl} material={MATS[1]} position={[0, 0.65, 0]} scale={[0.12, 1.3, 0.12]} {...shared} />
    <mesh ref={refs[0]} geometry={G.torus} material={accent ? mat('#ffffff') : MATS[3]} position={[0, 1.0, 0]} rotation={[Math.PI / 2, 0, 0]} {...shared} />
    <mesh geometry={G.torus} material={MATS[4]} position={[0, 1.0, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.72} {...shared} />
  </group>
}

function Mechanism({ item, events }) {
  const root = useRef(); const moving = useRef(); const seen = useRef(new WeakSet())
  const phase = useMemo(() => (item.seed % 1000) / 1000 * Math.PI * 2, [item.seed])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime + phase
    const rootObj = root.current
    if (!rootObj) return
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

function FlightTrails({ items }) {
  const mesh = useRef();
  const geo = useMemo(() => G.sphere, [])
  const trailMat = useMemo(() => mat('#ffffff', '#bcefff'), [])
  const cap = Math.max(1, items.length * 10)
  const inst = useMemo(() => { const m = new THREE.InstancedMesh(geo, trailMat, cap); m.count = 0; m.frustumCulled = false; m.userData.noCull = true; return m }, [geo, trailMat, cap])
  useFrame(() => {
    const m = mesh.current; if (!m) return
    m.count = 0
    const scale = new THREE.Vector3(); const q = new THREE.Quaternion(); const mat4 = new THREE.Matrix4(); const p = new THREE.Vector3()
    for (const b of getBallitas()) {
      if (!b?.airborne || !b.flight) continue
      const item = items.find((x) => x.sw === b.flight.sw)
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
  const ev = useMemo(() => items.map((x) => ({ active: 0, nextAt: 2 + (x.seed % 70) / 10 })), [items])
  if (!items.length) return null
  return <group>
    {items.map((item, i) => <Mechanism key={i} item={item} events={ev[i]} />)}
    <FlightTrails items={items} />
  </group>
}
