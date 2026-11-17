import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CartelesDeRuta, Soundless, routeInfo, buildTerrainGeo, buildSkyGeo, placeAlong, laneFrame, switchesOf, Critter, EventStage, Instanced, mulberry32 } from './base.jsx'

const SIGN = { color: '#ffffff', bg: 'rgba(57,92,139,.94)', border: '#fff59d' }
const islandGeo = new THREE.SphereGeometry(1, 16, 12)
const islandMat = new THREE.MeshStandardMaterial({ color: '#b6dff2', roughness: .78 })
const birdGeo = new THREE.SphereGeometry(1, 12, 10)
const birdMat = new THREE.MeshBasicMaterial({ color: '#fff2bb' })
const cloudGeo = new THREE.SphereGeometry(1, 14, 10)
const cloudMat = new THREE.MeshStandardMaterial({ color: '#e8f7ff', roughness: .95 })
const hues = ['#fff1a1','#b8f5ff','#f8c8ff']
const names = ['ISLA DEL VIENTO','PUENTE ARCOÍRIS','OBSERVATORIO CELESTE']

function CloudSegment({ seg, routeIndex, label }) {
  const items = useMemo(() => {
    const rng = mulberry32((seg.i + 89) * 3253 + routeIndex * 877)
    const out = []
    const n = Math.max(5, Math.floor(seg.length * (seg.speedK > 1.12 ? .9 : .55)))
    for (let i = 0; i < n; i++) {
      const u = .05 + rng() * .9, angle = (rng() - .5) * 1.8
      if (Math.abs(angle) < .48) continue
      const p = placeAlong(seg, u, .04 + rng() * .15, angle)
      const s = .18 + rng() * .28
      out.push({ ...p, scale: [s * 1.65, s * .42, s], color: hues[Math.floor(rng() * hues.length)] })
    }
    return out
  }, [seg, routeIndex])
  const terrain = useMemo(() => buildTerrainGeo(seg, { arc: 1.95, maxH: seg.radius * .17, colors: ['#749bb6','#e3edfa'], along: Math.max(16, Math.ceil(seg.length * 1.3)) }), [seg])
  const sky = useMemo(() => buildSkyGeo(seg, { colors: ['#567fa4','#b7d8ee'] }), [seg])
  const anchors = useMemo(() => switchesOf(seg).map((sw) => {
    const a = laneFrame(seg, sw.from, sw.u), b = laneFrame(seg, sw.to, sw.u)
    return { key: `${sw.from}-${sw.to}-${sw.u}`, pos: a.pos.clone().lerp(b.pos, .5), gap: a.pos.distanceTo(b.pos) }
  }), [seg])
  const portal = useMemo(() => placeAlong(seg, .52, .06, 0), [seg])
  return <group>
    <mesh geometry={sky} material={skyMat} />
    <mesh geometry={terrain} material={terrainMat} />
    <Instanced geo={cloudGeo} mat={cloudMat} items={items} />
    <WindGate placement={portal} speed={seg.speedK} routeIndex={routeIndex} />
    {anchors.map((a) => <group key={a.key} position={a.pos}>
      <mesh><torusGeometry args={[Math.max(.2, a.gap * .5), .045, 8, 24]} /><meshStandardMaterial color="#ffe991" emissive="#ffbd43" emissiveIntensity={1.1} /></mesh>
      <mesh position={[0,.22,0]}><sphereGeometry args={[.11,12,10]} /><meshBasicMaterial color="#fff3b5" /></mesh>
    </group>)}
    <EventStage segment={seg} render={(stage) => <WindEvent seg={seg} stage={stage} routeIndex={routeIndex} />} />
    <RouteMarker seg={seg} text={label} />
  </group>
}

const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: .3, depthWrite: false })
const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .84, side: THREE.DoubleSide })
const gateGeo = new THREE.TorusGeometry(.48, .045, 8, 32)
const gateMat = new THREE.MeshStandardMaterial({ color: '#fff1a1', emissive: '#ffcf62', emissiveIntensity: 1.25, metalness: .28, roughness: .3 })
const eventMat = new THREE.MeshBasicMaterial({ color: '#b8f5ff', transparent: true, opacity: .18, depthWrite: false })

function WindGate({ placement, speed, routeIndex }) {
  const ref = useMemo(() => ({ current: null }), [])
  useFrame(({ clock }) => { if (ref.current) { const t = clock.elapsedTime * (1 + speed); ref.current.rotation.z = Math.sin(t) * (routeIndex === 1 ? .22 : .1); ref.current.rotation.y = t * (routeIndex === 2 ? -.7 : .42); ref.current.scale.setScalar(1 + Math.sin(t * (routeIndex + 1)) * .045) } })
  return <mesh ref={(o) => { ref.current = o }} geometry={gateGeo} material={gateMat} position={placement.pos} quaternion={placement.quat} scale={[1.2,1.2,1.2]} />
}

function WindEvent({ seg, stage, routeIndex }) {
  const ref = useMemo(() => ({ current: null }), [])
  const mat = useMemo(() => eventMat.clone(), [])
  useFrame(({ clock }) => {
    if (!ref.current) return
    const active = stage.phase === 'climax' ? 1 : stage.phase === 'teaser' ? .45 : stage.phase === 'salida' ? .25 : .1
    mat.opacity = THREE.MathUtils.damp(mat.opacity, active, 4, .016)
    ref.current.rotation.y = clock.elapsedTime * (routeIndex === 1 ? 1.5 : routeIndex === 2 ? -.45 : .7)
    ref.current.scale.setScalar(1 + stage.intensity * (routeIndex === 0 ? 1.4 : routeIndex === 1 ? .5 : .9))
    mat.color.set(hues[routeIndex % hues.length])
  })
  const u = routeIndex === 0 ? .5 : routeIndex === 1 ? .3 : .7
  return <mesh ref={(o) => { ref.current = o }} material={mat} position={seg.curve.getPointAt(u)}><sphereGeometry args={[.3,16,12]} /></mesh>
}

function RouteMarker({ seg, text }) {
  const p = useMemo(() => placeAlong(seg, .12, .08, 1.05), [seg])
  return <group position={p.pos} quaternion={p.quat}><mesh><boxGeometry args={[.8,.26,.035]} /><meshStandardMaterial color="#4c7390" emissive="#a6e7ff" emissiveIntensity={.28} /></mesh><mesh position={[0,0,.025]}><sphereGeometry args={[.045,10,8]} /><meshBasicMaterial color="#fff6c4" /></mesh></group>
}

export default function Vida({ way }) {
  const info = useMemo(() => routeInfo(way), [way])
  return <group name="vida-nubes">
    {info.routes.map((rt, index) => {
      const segs = rt.segments.filter((s) => !s.air)
      if (!segs.length) return null
      return <group key={rt.r}>
        {segs.map((s, i) => <CloudSegment key={s.i} seg={s.seg} routeIndex={index} label={names[(index + i) % names.length]} />)}
        <Critter way={way} segments={segs.map((s) => s.seg)} count={Math.max(3, Math.ceil(rt.length / 17))} geo={birdGeo} mat={birdMat} scale={.14} speed={.5 + index * .2} angle={1.2} spread={.32} hop={.3} colors={hues} seed={701 + index} />
        <Critter way={way} segments={segs.map((s) => s.seg)} count={Math.max(2, Math.ceil(rt.length / 24))} geo={islandGeo} mat={islandMat} scale={.23} speed={.18} angle={-1.16} spread={.22} hop={.08} seed={901 + index} />
        <CartelesDeRuta way={{ ...way, routes: [rt.route] }} style={SIGN} poleColor="#7193aa" angle={1.16} />
      </group>
    })}
    <Soundless />
  </group>
}
