// Pequeños habitantes temáticos junto a la pista. Geometría/materiales compartidos;
// solo se animan sus grupos, sin estado React por cuadro.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getBallitas, markShared, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { CURB, TERR, halfWidth, lanesOf, surfFrame } from './pista.jsx'

const G = {
  body: markShared(new THREE.SphereGeometry(0.34, 10, 8)),
  head: markShared(new THREE.SphereGeometry(0.25, 10, 8)),
  ear: markShared(new THREE.ConeGeometry(0.1, 0.24, 6)),
  eye: markShared(new THREE.SphereGeometry(0.045, 6, 5)),
  foot: markShared(new THREE.SphereGeometry(0.12, 7, 5)),
}
const M = new Map()
function material(color) {
  if (!M.has(color)) M.set(color, markShared(new THREE.MeshLambertMaterial({ color })))
  return M.get(color)
}
const THEMES = {
  bosque: ['#f28b45', '#fff0d7', '#3d2524'], jardin: ['#f06fa5', '#ffe5aa', '#4b2b48'],
  mar: ['#43c4d1', '#fff2db', '#173c59'], hielo: ['#91d9ff', '#f4fbff', '#24405a'],
  volcan: ['#ff7645', '#ffd166', '#3c2020'], desierto: ['#e7a64b', '#ffe3ae', '#50351f'],
  cristal: ['#b8a3ff', '#effaff', '#3a285f'], nubes: ['#ff9ecf', '#ffffff', '#553c78'],
  neon: ['#45f4d0', '#ff64dc', '#15233b'], sombrio: ['#9c7bd0', '#f2d9ff', '#261c35'],
}

function placements(way) {
  const rng = mulberry32(9137 + way.idx * 701)
  const candidates = []
  for (const seg of way.segments ?? []) for (const lane of lanesOf(seg)) {
    const ev = (seg.switches ?? []).filter((s) => s.from === lane.id || s.to === lane.id).map((s) => s.u)
    for (const u of [0.18, 0.36, 0.57, 0.78, 0.91]) {
      if (ev.some((x) => Math.abs(x - u) * seg.length < 5)) continue
      const f = surfFrame(seg, lane.id, u)
      const sign = rng() < 0.5 ? -1 : 1
      const offset = sign * (halfWidth(lane) + CURB + TERR * (0.35 + rng() * 0.35))
      const pos = f.pos.clone().addScaledVector(f.side, offset).addScaledVector(f.up, -0.02)
      const quat = basisQuat(f.up, f.tangent)
      candidates.push({ pos, quat, phase: rng() * Math.PI * 2, scale: 0.82 + rng() * 0.35 })
    }
  }
  // Mantén el mundo poblado pero ligero, sin repetir criaturas en todos los segmentos.
  return candidates.filter((_, i) => i % Math.max(1, Math.ceil(candidates.length / 5)) === 0).slice(0, 5)
}

function Critter({ item, colors }) {
  const root = useRef()
  useFrame(({ clock }, dt) => {
    const o = root.current
    if (!o) return
    let startled = false
    const p = item.pos
    for (const b of getBallitas()) if (b?.pos && b.pos.distanceToSquared(p) < 25) { startled = true; break }
    const t = clock.elapsedTime + item.phase
    o.position.y = Math.sin(t * (startled ? 13 : 2.2)) * (startled ? 0.16 : 0.045)
    o.rotation.z = THREE.MathUtils.damp(o.rotation.z, startled ? 0.18 * Math.sin(t * 9) : 0, 5, dt)
  })
  const [coat, belly, ink] = colors
  return <group ref={root} position={item.pos} quaternion={item.quat} scale={item.scale}>
    <mesh geometry={G.body} material={material(coat)} position={[0, 0.36, 0]} scale={[0.78, 0.8, 1.05]} />
    <mesh geometry={G.head} material={material(coat)} position={[0, 0.78, 0.19]} />
    <mesh geometry={G.body} material={material(belly)} position={[0, 0.31, 0.27]} scale={[0.5, 0.58, 0.42]} />
    <mesh geometry={G.ear} material={material(coat)} position={[-0.16, 1.0, 0.12]} rotation={[0, 0, 0.17]} />
    <mesh geometry={G.ear} material={material(coat)} position={[0.16, 1.0, 0.12]} rotation={[0, 0, -0.17]} />
    <mesh geometry={G.eye} material={material(ink)} position={[-0.1, 0.82, 0.405]} />
    <mesh geometry={G.eye} material={material(ink)} position={[0.1, 0.82, 0.405]} />
    <mesh geometry={G.foot} material={material(ink)} position={[-0.16, 0.1, 0.15]} scale={[1, 0.55, 1.2]} />
    <mesh geometry={G.foot} material={material(ink)} position={[0.16, 0.1, 0.15]} scale={[1, 0.55, 1.2]} />
  </group>
}

export default function Criaturas({ way }) {
  const items = useMemo(() => placements(way), [way])
  const colors = THEMES[way.theme.id] ?? THEMES.bosque
  return <group>{items.map((item, i) => <Critter key={i} item={item} colors={colors} />)}</group>
}
