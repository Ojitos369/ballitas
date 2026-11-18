// Pequeños habitantes temáticos junto a la pista. Geometría/materiales compartidos;
// solo se animan sus grupos, sin estado React por cuadro.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { getBallitas, getWayDetail, markShared, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, halfWidth, lanesOf, surfFrame } from './pista.jsx'

const G = {
  body: markShared(new THREE.SphereGeometry(0.34, 10, 8)),
  head: markShared(new THREE.SphereGeometry(0.25, 10, 8)),
  ear: markShared(new THREE.ConeGeometry(0.1, 0.24, 6)),
  eye: markShared(new THREE.SphereGeometry(0.045, 6, 5)),
  foot: markShared(new THREE.SphereGeometry(0.12, 7, 5)),
}
function merged(parts) {
  const geos = parts.map(([geo, pos, scale, rot]) => {
    const g = geo.clone()
    g.scale(...scale)
    if (rot) g.rotateZ(rot)
    g.translate(...pos)
    return g
  })
  const out = markShared(mergeGeometries(geos, false))
  geos.forEach((g) => g.dispose())
  return out
}
const COAT = merged([
  [G.body, [0, 0.36, 0], [0.78, 0.8, 1.05]],
  [G.head, [0, 0.78, 0.19], [1, 1, 1]],
  [G.ear, [-0.16, 1, 0.12], [1, 1, 1], 0.17],
  [G.ear, [0.16, 1, 0.12], [1, 1, 1], -0.17],
])
const BELLY = merged([[G.body, [0, 0.31, 0.27], [0.5, 0.58, 0.42]]])
const INK = merged([
  [G.eye, [-0.1, 0.82, 0.405], [1, 1, 1]], [G.eye, [0.1, 0.82, 0.405], [1, 1, 1]],
  [G.foot, [-0.16, 0.1, 0.15], [1, 0.55, 1.2]], [G.foot, [0.16, 0.1, 0.15], [1, 0.55, 1.2]],
])
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
  ;(way.segments ?? []).forEach((seg, si) => { for (const lane of lanesOf(seg)) {
    const ev = (seg.switches ?? []).filter((s) => s.from === lane.id || s.to === lane.id).map((s) => s.u)
    for (const u of [0.18, 0.36, 0.57, 0.78, 0.91]) {
      if (ev.some((x) => Math.abs(x - u) * seg.length < 5)) continue
      const f = surfFrame(seg, lane.id, u)
      const sign = rng() < 0.5 ? -1 : 1
      const offset = sign * (halfWidth(lane) + CURB + TERR * (0.35 + rng() * 0.35))
      const pos = f.pos.clone().addScaledVector(f.side, offset).addScaledVector(f.up, -0.02)
      const quat = basisQuat(f.up, f.tangent)
      const [o, side] = [f.pos.clone(), f.side.clone()]
      const scale = 0.82 + rng() * 0.35
      const E = halfWidth(lane) + CURB
      // repulsión solo a lo ancho: se queda en su berma, fuera del asfalto de su carril
      const ajusta = (p) => { const xx = (p.x - o.x) * side.x + (p.y - o.y) * side.y + (p.z - o.z) * side.z; const a = Math.max(Math.abs(xx), E + 0.45 * scale); return a > E + TERR + 0.5 ? null : o.clone().addScaledVector(side, Math.sign(xx || offset) * a).addScaledVector(f.up, -0.02) }
      candidates.push({ pos, quat, phase: rng() * Math.PI * 2, scale, ajusta, seed: way.idx * 7919 + si * 101 + lane.id * 13 + Math.round(u * 100), ig: { way: way.idx, si, lane: lane.id } })
    }
  } })
  // Mantén el mundo poblado pero ligero, sin repetir criaturas en todos los segmentos.
  const world = mundoDe(way); const local = nuevoLocal()
  return candidates.filter((_, i) => i % Math.max(1, Math.ceil(candidates.length / 5)) === 0).slice(0, 5).flatMap((c) => {
    const pos = colocar(world, c, 0.45 * c.scale, c.ig, 5, local)
    return pos ? [{ ...c, pos }] : []
  })
}

function Critter({ item, colors, detail }) {
  const root = useRef()
  useFrame(({ clock }, dt) => {
    if (detail && detail.value < 0.3) return
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
    <mesh geometry={COAT} material={material(coat)} />
    <mesh geometry={BELLY} material={material(belly)} />
    <mesh geometry={INK} material={material(ink)} />
  </group>
}

export default function Criaturas({ way }) {
  const items = useMemo(() => placements(way), [way])
  const colors = THEMES[way.theme.id] ?? THEMES.bosque
  const detail = getWayDetail(way)
  const groupRef = useRef()
  useFrame(() => {
    if (groupRef.current && detail) groupRef.current.visible = detail.value >= 0.3
  })
  return <group ref={groupRef}>{items.map((item, i) => <Critter key={i} item={item} colors={colors} detail={detail} />)}</group>
}
