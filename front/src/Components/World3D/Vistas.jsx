import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Cámara de recorrido desacoplada del rig histórico de seguimiento/POV.
export function VistaCamino({ mundo, way, routeIndex = 0, speed = 0.12, paused = false, active = false, seekIndex = null, selectable = true, onSelectWay }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const clock = useRef(0)
  const dragging = useRef(false)
  const yaw = useRef(0)
  const pitch = useRef(0)
  const distance = useRef(0)
  const entering = useRef(0)
  const startPosition = useRef(new THREE.Vector3())
  const startQuaternion = useRef(new THREE.Quaternion())
  const points = useMemo(() => {
    const route = way?.routes?.[routeIndex % (way?.routes?.length || 1)]
    return (route?.segments ?? []).map((seg) => ({ seg, length: seg.curve.getLength() }))
  }, [way, routeIndex])
  const total = useMemo(() => points.reduce((a, p) => a + p.length, 0), [points])

  useEffect(() => {
    if (active && way) {
      startPosition.current.copy(camera.position)
      startQuaternion.current.copy(camera.quaternion)
      entering.current = 0.001
    }
    clock.current = 0
    distance.current = 0
    yaw.current = 0
    pitch.current = 0
  }, [way, routeIndex, active])

  useEffect(() => {
    if (seekIndex == null) return
    distance.current = points.slice(0, seekIndex).reduce((sum, p) => sum + p.length, 0) + (points[seekIndex]?.length ?? 0) * 0.5
  }, [seekIndex, points])

  useEffect(() => {
    if (!way) return
    const el = gl.domElement
    const down = (e) => { if (e.button === 0) dragging.current = true }
    const move = (e) => {
      if (!dragging.current) return
      yaw.current -= e.movementX * 0.003
      pitch.current = THREE.MathUtils.clamp(pitch.current - e.movementY * 0.003, -1.15, 1.15)
    }
    const up = () => { dragging.current = false }
    const wheel = (e) => { e.preventDefault(); distance.current = THREE.MathUtils.clamp(distance.current + e.deltaY * 0.012, 0, total) }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      el.removeEventListener('wheel', wheel)
    }
  }, [gl, total, way])

  useFrame((_, dt) => {
    if (!active || !way || !points.length || !total) return
    const h = Math.min(dt, 0.05)
    if (!paused && !dragging.current) distance.current = (distance.current + h * Math.max(0, speed) * total) % total
    else if (!paused && dragging.current) distance.current = Math.min(total, distance.current + h * Math.max(0, speed) * total)
    let d = distance.current
    let current = points[points.length - 1]
    for (const p of points) { if (d <= p.length) { current = p; break } d -= p.length }
    const u = current.length ? THREE.MathUtils.clamp(d / current.length, 0, 1) : 0
    const pos = current.seg.curve.getPointAt(u)
    const tangent = current.seg.curve.getTangentAt(u).normalize()
    const frame = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), tangent)
    const look = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'))
    const targetPosition = pos.clone().addScaledVector(tangent, -way.params.radius * 0.12)
    const targetQuaternion = frame.multiply(look)
    if (entering.current > 0) {
      entering.current = Math.min(1, entering.current + h / 1.8)
      const t = THREE.MathUtils.smoothstep(entering.current, 0, 1)
      camera.position.lerpVectors(startPosition.current, targetPosition, t)
      camera.quaternion.copy(startQuaternion.current).slerp(targetQuaternion, t)
    } else {
      camera.position.lerp(targetPosition, 1 - Math.exp(-8 * h))
      camera.quaternion.slerp(targetQuaternion, 1 - Math.exp(-8 * h))
    }
    camera.fov = 68
    camera.near = Math.max(0.02, way.params.radius * 0.015)
    camera.updateProjectionMatrix()
  })

  // La capa de selección es una guía invisible a lo largo de las curvas reales.
  return <group>
    {mundo.ways.map((w) => w.segments.map((s) => <mesh key={`${w.idx}-${s.i}`} onClick={selectable ? (e) => { e.stopPropagation(); onSelectWay?.(w) } : undefined}>
      <tubeGeometry args={[s.curve, 36, Math.max(s.radius * 0.45, 0.08), 5, false]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>))}
  </group>
}

