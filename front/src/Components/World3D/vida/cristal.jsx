import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CartelesDeRuta, Billboard, Soundless, routeInfo, buildTerrainGeo, buildSkyGeo, placeAlong, laneFrame, switchesOf, Critter, EventStage, Instanced, mulberry32 } from './base.jsx'

const SIGN = { color: '#fff8ff', bg: 'rgba(37,20,59,.94)', border: '#f3a7ff' }
const crystalGeo = new THREE.OctahedronGeometry(1, 3)
const crystalMat = new THREE.MeshStandardMaterial({ color: '#c67bff', emissive: '#6d27b3', emissiveIntensity: 1.15, roughness: .18, metalness: .25 })
const archGeo = new THREE.TorusGeometry(.43, .055, 10, 32)
const archMat = new THREE.MeshStandardMaterial({ color: '#f5c8ff', emissive: '#b94aff', emissiveIntensity: 1.5, roughness: .22, metalness: .45 })
const fairyGeo = new THREE.SphereGeometry(1, 12, 10)
const fairyMat = new THREE.MeshBasicMaterial({ color: '#fff2a8' })
const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .26, depthWrite: false })
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .68, metalness: .15, side: THREE.DoubleSide })
const pulseMat = new THREE.MeshBasicMaterial({ color: '#ffe5ff', transparent: true, opacity: .15, side: THREE.DoubleSide, depthWrite: false })
const palettes = [['#d6a5ff','#71f1ff','#fff0a6'], ['#ff9de2','#9beaff','#d3ffb0'], ['#ffe28a','#bca2ff','#8efff2']]
const labels = ['GEODA VIVA','PUENTE PRISMA','CATEDRAL DE LUZ']

function CrystalSegment({ seg, routeIndex, routeName }) {
  const scene = useMemo(() => {
    const rng = mulberry32((seg.i + 31) * 7919 + routeIndex * 131)
    const items = []
    const n = Math.max(5, Math.floor(seg.length * (seg.speedK > 1.15 ? 1.15 : .72)))
    for (let i = 0; i < n; i++) {
      const u = .06 + rng() * .88
      const angle = (rng() - .5) * 1.72
      if (Math.abs(angle) < .48) continue
      const p = placeAlong(seg, u, .06 + rng() * .15, angle)
      const size = .08 + rng() * .18
      items.push({ ...p, scale: [size * .72, size * (1.1 + rng()), size * .72], color: palettes[routeIndex % palettes.length][Math.floor(rng() * 3)] })
    }
    const gate = placeAlong(seg, .5, .02, 0)
    return { items, gate }
  }, [seg, routeIndex])
  const terrain = useMemo(() => buildTerrainGeo(seg, { arc: 1.9, maxH: seg.radius * .2, colors: ['#31244a','#b47ce0'], along: Math.max(18, Math.ceil(seg.length * 1.5)) }), [seg])
  const sky = useMemo(() => buildSkyGeo(seg, { colors: ['#261b42','#665b99'] }), [seg])
  const gates = useMemo(() => switchesOf(seg).map((sw) => {
    const from = laneFrame(seg, sw.from, sw.u), to = laneFrame(seg, sw.to, sw.u)
    return { key: `${sw.from}-${sw.to}-${sw.u}`, mid: from.pos.clone().lerp(to.pos, .5), from: from.pos, to: to.pos }
  }), [seg])
  return <group>
    <mesh geometry={sky} material={skyMat} />
    <mesh geometry={terrain} material={terrainMat} />
    <Instanced geo={crystalGeo} mat={crystalMat} items={scene.items} />
    <mesh geometry={archGeo} position={scene.gate.pos} quaternion={scene.gate.quat} scale={[1.18,1.18,1.18]}><primitive object={archMat} attach="material" /></mesh>
    {gates.map((g) => <group key={g.key} position={g.mid}>
      <mesh geometry={new THREE.SphereGeometry(.14,16,12)}><meshBasicMaterial color="#fff1a1" /></mesh>
      <mesh position={[0,.2,0]}><cylinderGeometry args={[.025,.025,.4,8]} /><meshStandardMaterial color="#e5aaff" emissive="#a336e8" emissiveIntensity={1.5} /></mesh>
    </group>)}
    <EventStage segment={seg} render={(stage) => <CrystalPulse seg={seg} stage={stage} routeIndex={routeIndex} />} />
    <BillboardMini text={routeName} seg={seg} />
  </group>
}

function BillboardMini({ text, seg }) {
  const p = useMemo(() => placeAlong(seg, .13, .04, 1.02), [seg])
  return <Billboard text={text} style={SIGN} position={p.pos} quat={p.quat} height={.22} glow={1.3} />
}

function CrystalPulse({ seg, stage, routeIndex }) {
  const ref = useRef()
  const color = palettes[routeIndex % palettes.length][routeIndex % 3]
  const mat = useMemo(() => pulseMat.clone(), [])
  useFrame((_, dt) => {
    if (!ref.current) return
    const target = stage.phase === 'climax' ? .72 : stage.phase === 'teaser' ? .34 : stage.phase === 'salida' ? .23 : .12
    mat.opacity = THREE.MathUtils.damp(mat.opacity, target, 4, Math.min(dt, .1))
    const pulse = 1 + stage.intensity * (routeIndex === 0 ? .58 : routeIndex === 1 ? .26 : .42)
    if (routeIndex === 0) ref.current.scale.set(pulse, 1 / pulse, pulse)
    else if (routeIndex === 1) ref.current.scale.setScalar(pulse * (stage.phase === 'climax' ? 1.18 : 1))
    else ref.current.scale.set(pulse, pulse * .72, pulse)
    mat.color.set(color)
  })
  const u = routeIndex === 0 ? .5 : routeIndex === 1 ? .32 : .68
  return <mesh ref={ref} material={mat} position={seg.curve.getPointAt(u)}><sphereGeometry args={[.34,18,14]} /></mesh>
}

export default function Vida({ way }) {
  const info = useMemo(() => routeInfo(way), [way])
  const routeScenes = info.routes.map((rt, index) => {
    const segs = rt.segments.filter((s) => !s.air)
    if (!segs.length) return null
    return <group key={rt.r}>
      {segs.map((s, i) => <CrystalSegment key={s.i} seg={s.seg} routeIndex={index} routeName={labels[(i + index) % labels.length]} />)}
      <Critter way={way} segments={segs.map((s) => s.seg)} count={Math.max(3, Math.ceil(rt.length / 15))} geo={fairyGeo} mat={fairyMat} scale={.12} speed={.42 + index * .18} angle={1.24} spread={.26} hop={.24} colors={palettes[index % palettes.length]} seed={101 + index} />
      <CartelesDeRuta way={{ ...way, routes: [rt.route] }} style={SIGN} poleColor="#80549a" angle={1.18} />
    </group>
  })
  return <group name="vida-cristal">{routeScenes}<Soundless /></group>
}
