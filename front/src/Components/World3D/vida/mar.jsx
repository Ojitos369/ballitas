import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CartelesDeRuta, Critter, EventStage, Instanced, buildSkyGeo, buildTerrainGeo, laneFrame,
  markShared, mulberry32, placeAlong, routeInfo, Soundless, useAutoDispose,
} from './base.jsx'

const STYLE = { color: '#e8fcff', bg: 'rgba(5,39,64,0.94)', border: '#52e5ef' }
const bodyGeo = markShared(new THREE.SphereGeometry(1, 10, 8))
const fishGeo = markShared(new THREE.SphereGeometry(1, 10, 8).scale(0.78, 0.62, 1.22))
const reefGeo = markShared(new THREE.DodecahedronGeometry(1, 0))
const ringGeo = markShared(new THREE.TorusGeometry(0.34, 0.055, 6, 16))
const outerRingGeo = markShared(new THREE.TorusGeometry(0.52, 0.035, 6, 16))
const beaconSphereGeo = markShared(new THREE.SphereGeometry(0.12, 8, 6))
const shellMat = markShared(new THREE.MeshStandardMaterial({ color: '#54d9d1', roughness: 0.38, metalness: 0.12 }))
const reefMat = markShared(new THREE.MeshStandardMaterial({ color: '#ff8d78', roughness: 0.72 }))
const glowMat = markShared(new THREE.MeshBasicMaterial({ color: '#70ffff', toneMapped: false }))
const sandMat = markShared(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86, side: THREE.DoubleSide }))
const skyMat = markShared(new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.62, depthWrite: false }))
const beaconRingMats = [
  markShared(new THREE.MeshStandardMaterial({ color: '#9cfaff', emissive: '#17464c' })),
  markShared(new THREE.MeshStandardMaterial({ color: '#ff8d78', emissive: '#17464c' })),
]
const diverMatCache = new Map()
const seaLifeMatCache = new Map()
function getDiverMat(color) {
  let m = diverMatCache.get(color)
  if (!m) {
    m = markShared(new THREE.MeshStandardMaterial({ color, roughness: 0.38, emissive: color, emissiveIntensity: 0.12 }))
    diverMatCache.set(color, m)
  }
  return m
}
function getSeaLifeMat(color) {
  let m = seaLifeMatCache.get(color)
  if (!m) {
    m = markShared(new THREE.MeshStandardMaterial({ color, roughness: 0.3, emissive: color, emissiveIntensity: 0.22 }))
    seaLifeMatCache.set(color, m)
  }
  return m
}
const ROUTE_PALETTES = [
  { low: '#09536a', high: '#4fd5c0', accent: '#57f2ec', sky: ['#063d61', '#26c9d2'], critter: '#ffd480' },
  { low: '#174b69', high: '#ff9d79', accent: '#ffb583', sky: ['#12496c', '#ff9c88'], critter: '#fff0a6' },
  { low: '#073e67', high: '#9cdded', accent: '#ffe68a', sky: ['#072e59', '#8cecff'], critter: '#ff8e9a' },
]

function EventBeacon({ segment, variant, stage }) {
  const ring = useRef()
  const glow = useRef()
  const glowOrbMat = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: variant === 0 ? '#68edff' : variant === 1 ? '#ff9d79' : '#ffe989',
      transparent: true,
      opacity: 0.5,
      toneMapped: false,
    }),
    [variant],
  )
  useAutoDispose(glowOrbMat)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (ring.current) {
      ring.current.rotation.z = t * (variant === 0 ? 1.1 : -0.8)
      const beat = 0.5 + 0.5 * Math.sin(t * (variant + 2) + variant)
      const pass = stage.phase === 'climax' ? 0.5 + stage.intensity * 0.5 : 0.35
      ring.current.scale.setScalar(0.76 + beat * 0.12 + pass * 0.2)
      ring.current.rotation.x = stage.phase === 'teaser' ? 0.35 * Math.sin(t * 2) : 0
    }
    if (glow.current) glow.current.material.opacity = 0.36 + Math.sin(t * (variant + 2.5)) * 0.22
  })
  const p = useMemo(() => {
    const u = variant === 0 ? 0.18 : variant === 1 ? 0.52 : 0.82
    return placeAlong(segment, u, 0.42, 0.12)
  }, [segment, variant])
  return <group position={p.pos} quaternion={p.quat}>
    <mesh ref={ring} geometry={ringGeo} material={glowMat} position={[0, 0.25, 0]} />
    <mesh ref={glow} geometry={beaconSphereGeo} material={glowOrbMat} position={[0, 0.72, 0]} />
    <mesh geometry={outerRingGeo} material={beaconRingMats[variant === 1 ? 1 : 0]} position={[0, 0.12, 0]} />
  </group>
}

function RouteDiorama({ way, route, routeIndex }) {
  const segments = useMemo(() => route.segments.filter((s) => !s.air), [route])
  const palette = ROUTE_PALETTES[routeIndex]
  const content = useMemo(() => {
    const rng = mulberry32((way.idx + 11) * 1879 + routeIndex * 9277)
    return segments.map((item, si) => {
      const seg = item.seg
      const terrain = buildTerrainGeo(seg, {
        arc: Math.PI * 0.67, maxH: seg.radius * 0.3, radial: 18,
        along: Math.min(90, Math.ceil(seg.length * 1.25)),
        colors: [palette.low, palette.high],
        height: (u, a) => 0.34 + 0.2 * Math.sin(u * 17 + routeIndex * 2) + 0.18 * Math.cos(a * 5 + u * 8),
      })
      const sky = buildSkyGeo(seg, { radial: 16, along: Math.min(42, Math.ceil(seg.length * 0.65)), colors: palette.sky })
      // Cada tramo lleva un pequeño arrecife / jardín submarino a ambos lados de la pista.
      const coral = []; const bubbles = []
      const n = Math.max(4, Math.ceil(seg.length * (routeIndex === 0 ? 1.25 : 0.8)))
      for (let i = 0; i < n; i++) {
        const u = 0.07 + 0.86 * ((i + rng() * 0.45) / n)
        const angle = (i % 2 ? -1 : 1) * (0.92 + rng() * 0.42)
        const p = placeAlong(seg, u, 0.035, angle)
        coral.push({ ...p, scale: [0.09 + rng() * 0.1, 0.14 + rng() * 0.24, 0.08 + rng() * 0.08], color: i % 3 ? palette.accent : '#ee7da8' })
        if (i % 2 === 0) {
          const q = placeAlong(seg, Math.min(0.96, u + 0.08), 0.25, angle * 0.66)
          bubbles.push({ ...q, scale: 0.045 + rng() * 0.045, color: '#a9ffff' })
        }
      }
      // Portalas de marea, rampas de cola de ballena y placas de ruta: anclaje visual a los carriles.
      const anchors = []
      if (si % 2 === routeIndex % 2) {
        const lane = item.lanes?.[0]
        const anchor = laneFrame(seg, lane?.id ?? 0, 0.5)
        anchors.push({ pos: anchor.pos.clone().addScaledVector(anchor.up, 0.18), quat: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), anchor.tangent), scale: [0.25, 0.08, 0.42], color: palette.accent })
      }
      return { seg, terrain, sky, coral, bubbles, anchors }
    })
  }, [way, routeIndex, segments, palette])
  const contentGeos = useMemo(() => content.flatMap((c) => [c.terrain, c.sky]), [content])
  useAutoDispose(contentGeos)
  const eventSeg = useMemo(() => segments.find((s) => s.event)?.seg ?? segments[Math.floor(segments.length * 0.55)]?.seg, [segments])
  const creatureGeo = bodyGeo
  const seaSegments = useMemo(() => segments.map((s) => s.seg), [segments])
  const renderEvent = useMemo(() => (stage) => <EventBeacon segment={eventSeg} variant={routeIndex} stage={stage} />, [eventSeg, routeIndex])
  return <group name={`mar-ruta-${routeIndex}`}>
    {content.map((c, i) => <group key={c.seg.i}>
      <mesh geometry={c.terrain} material={sandMat} />
      <mesh geometry={c.sky} material={skyMat} />
      <Instanced geo={reefGeo} mat={reefMat} items={c.coral} />
      <Instanced geo={bodyGeo} mat={glowMat} items={c.bubbles} />
      <Instanced geo={bodyGeo} mat={shellMat} items={c.anchors} />
      {i % 2 === 0 && <DiverPod seg={c.seg} color={palette.critter} />}
    </group>)}
    {eventSeg && <EventStage segment={eventSeg} render={renderEvent} />}
    {eventSeg && <SeaLife segments={seaSegments} routeIndex={routeIndex} geo={creatureGeo} color={palette.critter} />}
    <Critter way={way} segments={seaSegments} count={6} geo={fishGeo} mat={shellMat} scale={0.12} speed={0.85 + routeIndex * 0.24} angle={0.9} spread={0.36} hop={0.3} reactRadius={2.8} seed={31 + routeIndex} />
  </group>
}

function DiverPod({ seg, color }) {
  const group = useRef()
  const mat = useMemo(() => getDiverMat(color), [color])
  const p = useMemo(() => placeAlong(seg, 0.72, 0.18, -1.22), [seg])
  useFrame(({ clock }) => { if (group.current) group.current.position.y = p.pos.y + Math.sin(clock.elapsedTime * 1.6 + seg.i) * 0.04 })
  return <group ref={group} position={p.pos} quaternion={p.quat}>
    <mesh geometry={bodyGeo} material={mat} scale={[0.1, 0.075, 0.15]} />
    <mesh geometry={bodyGeo} position={[0, 0.075, 0.06]} material={glowMat} scale={0.025} />
  </group>
}

function SeaLife({ segments, routeIndex, geo, color }) {
  const mats = useMemo(() => getSeaLifeMat(color), [color])
  const routeSegments = useMemo(() => segments, [segments])
  const items = useMemo(() => {
    // Instanced silhouettes are the LOD-zero schools; local bobbing makes them read as living fauna.
    const rng = mulberry32(routeIndex * 7559 + segments.length * 83)
    const out = []
    for (const seg of routeSegments) {
      const count = Math.max(2, Math.ceil(seg.length * 0.4))
      for (let j = 0; j < count; j++) {
        const u = 0.12 + 0.76 * ((j + rng() * 0.6) / count)
        const side = (j % 2 ? 1 : -1)
        const p = placeAlong(seg, u, 0.2 + rng() * 0.18, side * (1.1 + rng() * 0.3))
        out.push({ ...p, scale: [0.1 + rng() * 0.07, 0.065 + rng() * 0.03, 0.14 + rng() * 0.12], color: j % 4 ? color : '#f5d878' })
      }
    }
    return out
  }, [routeSegments, routeIndex, color])
  return <Instanced geo={geo} mat={mats} items={items} />
}

export default function Vida({ way }) {
  const info = useMemo(() => routeInfo(way), [way])
  return <group name="vida-mar">
    <CartelesDeRuta way={way} style={STYLE} poleColor="#236477" />
    {info.routes.map((route, i) => <RouteDiorama key={route.r} way={way} route={route} routeIndex={i} />)}
    <Soundless />
  </group>
}
