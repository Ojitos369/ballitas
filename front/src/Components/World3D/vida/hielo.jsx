import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CartelesDeRuta, EventStage, Instanced, buildSkyGeo, buildTerrainGeo, getBollitas,
  mulberry32, placeAlong, routeInfo, Soundless,
} from './base.jsx'

const STYLE = { color: '#f5fcff', bg: 'rgba(20,48,77,0.94)', border: '#a3eaff' }
const snowGeo = new THREE.SphereGeometry(1, 18, 14)
const bergGeo = new THREE.SphereGeometry(1, 18, 12)
const auroraGeo = new THREE.TorusGeometry(0.44, 0.035, 8, 28)
const snowMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })
const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.52, depthWrite: false })
const cabinMat = new THREE.MeshStandardMaterial({ color: '#d7f5f4', roughness: 0.78 })
const iceMat = new THREE.MeshStandardMaterial({ color: '#72c8e8', roughness: 0.2, metalness: 0.2, emissive: '#113e67', emissiveIntensity: 0.18 })
const warmMat = new THREE.MeshStandardMaterial({ color: '#ffd88a', emissive: '#d58a35', emissiveIntensity: 0.65, roughness: 0.45 })
const ringMat = new THREE.MeshBasicMaterial({ color: '#9af8ef', toneMapped: false })
const ROUTE_PALETTES = [
  { low: '#527e9c', high: '#e8faff', sky: ['#193a68', '#69c8e6'], accent: '#a7eeff' },
  { low: '#617f9c', high: '#d6caff', sky: ['#172e5f', '#b98ef3'], accent: '#f6b8ff' },
  { low: '#346c91', high: '#d6f9f5', sky: ['#102c5a', '#40d6cf'], accent: '#baffeb' },
]

function IceEvent({ segment, routeIndex, stage }) {
  const hoop = useRef()
  const light = useRef()
  const u = [0.22, 0.5, 0.78][routeIndex]
  const p = useMemo(() => placeAlong(segment, u, 0.39, routeIndex === 1 ? -0.15 : 0.1), [segment, u, routeIndex])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    if (hoop.current) {
      hoop.current.rotation.z = routeIndex === 0 ? Math.sin(t * 0.5) * 0.35 : t * (routeIndex === 1 ? 0.55 : -0.7)
      const pass = stage.phase === 'climax' ? stage.intensity : stage.phase === 'teaser' ? 0.45 : 0.15
      hoop.current.scale.setScalar(0.8 + Math.sin(t * (routeIndex + 2)) * 0.08 + pass * 0.24)
      hoop.current.rotation.x = stage.phase === 'salida' ? Math.sin(t * 5) * 0.28 : 0
    }
    if (light.current) light.current.material.emissiveIntensity = 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(t * (routeIndex + 1.8)))
  })
  return <group position={p.pos} quaternion={p.quat}>
    <mesh ref={hoop} geometry={auroraGeo} material={ringMat} position={[0, 0.22, 0]} />
    <mesh position={[0, 0.12, 0]}><torusGeometry args={[0.58, 0.035, 8, 26]} /><meshStandardMaterial color={routeIndex === 0 ? '#b6f2ff' : routeIndex === 1 ? '#e8a5ff' : '#ffe995'} emissive="#30738b" emissiveIntensity={0.45} /></mesh>
    <mesh ref={light} material={warmMat} position={[0, 0.58, 0]}><sphereGeometry args={[0.09, 14, 12]} /></mesh>
  </group>
}

function RouteDiorama({ way, route, routeIndex }) {
  const segments = useMemo(() => route.segments.filter((s) => !s.air), [route])
  const palette = ROUTE_PALETTES[routeIndex]
  const scenes = useMemo(() => {
    const rng = mulberry32((way.idx + 91) * 5281 + routeIndex * 1847)
    return segments.map((item, si) => {
      const seg = item.seg
      const terrain = buildTerrainGeo(seg, {
        arc: Math.PI * 0.68, maxH: seg.radius * 0.31, radial: 18,
        along: Math.min(90, Math.ceil(seg.length * 1.2)),
        colors: [palette.low, palette.high],
        height: (u, a) => 0.34 + 0.22 * Math.sin(u * 12 + si) + 0.14 * Math.cos(a * 7 - u * 5),
      })
      const sky = buildSkyGeo(seg, { radial: 16, along: Math.min(44, Math.ceil(seg.length * 0.65)), colors: palette.sky })
      const drifts = []; const iceFlowers = []; const cabins = []
      const count = Math.max(4, Math.ceil(seg.length * (routeIndex === 0 ? 0.95 : 0.72)))
      for (let i = 0; i < count; i++) {
        const u = 0.06 + 0.88 * ((i + rng() * 0.5) / count)
        const angle = (i % 2 ? -1 : 1) * (0.96 + rng() * 0.34)
        const p = placeAlong(seg, u, 0.04, angle)
        drifts.push({ ...p, scale: [0.12 + rng() * 0.14, 0.1 + rng() * 0.15, 0.1 + rng() * 0.12], color: i % 3 ? '#d6f8ff' : '#8ed6f1' })
        if (i % 3 === 0) {
          const q = placeAlong(seg, Math.min(0.97, u + 0.035), 0.05, angle * 0.75)
          iceFlowers.push({ ...q, scale: [0.035, 0.2 + rng() * 0.12, 0.035], color: palette.accent })
        }
        if (i % 4 === 0) {
          const q = placeAlong(seg, u, 0.12, angle * 0.7)
          cabins.push({ ...q, scale: [0.16, 0.12, 0.16], color: '#d7f5f4' })
        }
      }
      return { seg, terrain, sky, drifts, iceFlowers, cabins }
    })
  }, [way, routeIndex, segments, palette])
  const event = useMemo(() => segments.find((s) => s.event)?.seg ?? segments[Math.floor(segments.length * 0.48)]?.seg, [segments])
  const renderEvent = useMemo(() => (stage) => <IceEvent segment={event} routeIndex={routeIndex} stage={stage} />, [event, routeIndex])
  return <group name={`hielo-ruta-${routeIndex}`}>
    {scenes.map((s, i) => <group key={s.seg.i}>
      <mesh geometry={s.terrain} material={snowMat} frustumCulled={false} />
      <mesh geometry={s.sky} material={domeMat} frustumCulled={false} />
      <Instanced geo={bergGeo} mat={iceMat} items={s.drifts} />
      <Instanced geo={snowGeo} mat={ringMat} items={s.iceFlowers} />
      <Instanced geo={snowGeo} mat={cabinMat} items={s.cabins} />
      {i % 3 === 0 && <Igloo seg={s.seg} tint={palette.accent} />}
      {i % 2 === 0 && <Penguin seg={s.seg} way={way} routeIndex={routeIndex} />}
    </group>)}
    {event && <EventStage segment={event} render={renderEvent} />}
    {event && <Aurora segment={event} routeIndex={routeIndex} />}
  </group>
}

function Igloo({ seg, tint }) {
  const p = useMemo(() => placeAlong(seg, 0.34, 0.1, 1.28), [seg])
  const capGeo = useMemo(() => new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.53), [])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9e9f0', roughness: 0.78 }), [])
  const doorMat = useMemo(() => new THREE.MeshBasicMaterial({ color: tint, toneMapped: false }), [tint])
  return <group position={p.pos} quaternion={p.quat}>
    <mesh geometry={capGeo} material={mat} position={[0, 0.13, 0]} />
    <mesh position={[0, 0.035, 0.17]} material={doorMat} scale={[0.055, 0.09, 0.018]}><sphereGeometry args={[1, 12, 10]} /></mesh>
    <mesh position={[0.11, 0.09, -0.03]} material={warmMat} scale={0.026}><sphereGeometry args={[1, 10, 8]} /></mesh>
  </group>
}

function Penguin({ seg, way, routeIndex }) {
  const root = useRef()
  const white = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7ffff', roughness: 0.4 }), [])
  const black = useMemo(() => new THREE.MeshStandardMaterial({ color: '#19364a', roughness: 0.38 }), [])
  const beak = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffbd66', roughness: 0.4 }), [])
  const p = useMemo(() => placeAlong(seg, 0.64, 0.12, -1.3), [seg])
  const phase = (seg.i * 1.73 + routeIndex) % 6
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    let startled = false
    const bolls = getBollitas()
    for (let i = 0; i < bolls.length; i++) {
      const b = bolls[i]
      if (b.phase === 'travel' && b.seg?.way === way && b.seg === seg && (b.segT ?? 0) > 0.48 && (b.segT ?? 0) < 0.78) { startled = true; break }
    }
    if (root.current) {
      root.current.position.y = p.pos.y + Math.abs(Math.sin(t * (startled ? 12 : 4) + phase)) * (startled ? 0.1 : 0.025)
      root.current.rotation.z = Math.sin(t * 3 + phase) * (startled ? 0.35 : 0.08)
    }
  })
  return <group ref={root} position={p.pos} quaternion={p.quat}>
    <mesh material={black} scale={[0.09, 0.15, 0.075]}><sphereGeometry args={[1, 14, 12]} /></mesh>
    <mesh material={white} position={[0, -0.015, 0.056]} scale={[0.061, 0.105, 0.029]}><sphereGeometry args={[1, 14, 12]} /></mesh>
    <mesh material={white} position={[0, 0.13, 0.018]} scale={[0.074, 0.07, 0.067]}><sphereGeometry args={[1, 14, 12]} /></mesh>
    <mesh material={beak} position={[0, 0.105, 0.085]} scale={[0.024, 0.018, 0.034]}><coneGeometry args={[1, 1, 12]} /></mesh>
    <mesh material={warmMat} position={[0, -0.135, 0.035]} scale={[0.042, 0.018, 0.04]}><sphereGeometry args={[1, 10, 8]} /></mesh>
  </group>
}

function Aurora({ segment, routeIndex }) {
  const ref = useRef()
  const p = useMemo(() => placeAlong(segment, 0.6, 0.34, Math.PI * 0.68), [segment])
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color: routeIndex === 1 ? '#e19cff' : '#6bffe3', transparent: true, opacity: 0.54, toneMapped: false }), [routeIndex])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.rotation.z = Math.sin(t * 0.35 + routeIndex) * 0.4
    ref.current.scale.set(1.1 + 0.2 * Math.sin(t * 0.8), 0.7 + 0.15 * Math.cos(t * 0.5), 1)
  })
  return <group position={p.pos} quaternion={p.quat}>
    <mesh ref={ref} material={mat} position={[0, 0.1, 0]}><torusGeometry args={[0.48, 0.045, 8, 32, Math.PI * 1.55]} /></mesh>
    <mesh position={[0, 0.12, 0]} material={warmMat} scale={0.055}><sphereGeometry args={[1, 12, 10]} /></mesh>
  </group>
}

export default function Vida({ way }) {
  const info = useMemo(() => routeInfo(way), [way])
  return <group name="vida-hielo">
    <CartelesDeRuta way={way} style={STYLE} poleColor="#7297ad" />
    {info.routes.map((route, i) => <RouteDiorama key={route.r} way={way} route={route} routeIndex={i} />)}
    <Soundless />
  </group>
}
