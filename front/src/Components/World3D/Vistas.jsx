import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as WORLD from '../../Core/world.js'

const Y = new THREE.Vector3(0, 1, 0)
const sm = THREE.MathUtils.smoothstep
const FLY_A = 1.5 // s: vuelo hasta la boca del tubo
const FLY_B = 1.1 // s: inmersión dentro del tubo
const FOV_DENTRO = 68
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _t = new THREE.Vector3()
const _u = new THREE.Vector3()
const _qA = new THREE.Quaternion()
const _qB = new THREE.Quaternion()
const _look = new THREE.Quaternion()
const _eu = new THREE.Euler()
const _orbit = new THREE.Vector3()

function envolventeRuta(way, routeIndex) {
  const route = way?.routes?.[routeIndex % (way?.routes?.length || 1)]
  const box = new THREE.Box3()
  const p = new THREE.Vector3()
  for (const seg of route?.segments ?? []) {
    if (seg.lanes?.length) {
      for (const lane of seg.lanes) for (let i = 0; i <= 12; i++) {
        const frame = WORLD.laneFrame(seg, lane.id, i / 12, {})
        box.expandByPoint(frame.pos)
      }
    } else {
      for (let i = 0; i <= 12; i++) box.expandByPoint(seg.curve.getPointAt(i / 12, p))
    }
  }
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  sphere.radius = Math.max(sphere.radius * 1.18, way?.params?.radius ?? 2)
  return sphere
}

// Ruta como lista de tramos con distancia acumulada (longitudes reales del mundo).
export function perfilRuta(way, routeIndex) {
  const route = way?.routes?.[routeIndex % (way?.routes?.length || 1)]
  let acc = 0
  const segs = (route?.segments ?? []).map((seg) => { const s = { seg, start: acc, length: seg.length || seg.curve.getLength() }; acc += s.length; return s })
  return { route, segs, total: acc }
}

function muestrea(perfil, d, outP, outT) {
  const { segs, total } = perfil
  d = THREE.MathUtils.clamp(d, 0, total)
  let s = segs[segs.length - 1]
  for (const q of segs) if (d <= q.start + q.length) { s = q; break }
  const u = s.length ? THREE.MathUtils.clamp((d - s.start) / s.length, 0, 1) : 0
  s.seg.curve.getPointAt(u, outP)
  s.seg.curve.getTangentAt(u, outT).normalize()
}

// Cámara de recorrido (dolly sobre la curva real de la ruta). Sustituye al CameraRig mientras `active`.
// progressRef.current = { d, total, entrando } para que el panel muestre la posición.
export function VistaCamino({ way, routeIndex = 0, speed = 0.05, paused = false, active = false, seek = null, progressRef }) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const perfil = useMemo(() => perfilRuta(way, routeIndex), [way, routeIndex])
  const envelope = useMemo(() => envolventeRuta(way, routeIndex), [way, routeIndex])
  const st = useRef({ d: 0, goal: null, fly: 1, yaw: 0, pitch: 0, drag: false, up: new THREE.Vector3(0, 1, 0), q: new THREE.Quaternion(), p0: new THREE.Vector3(), q0: new THREE.Quaternion(), A: new THREE.Vector3(), initQ: false })
  const radius = way?.params?.radius ?? 2

  // Entrar (de nuevo) a la ruta: vuelo cinematográfico desde la pose actual hasta la boca y dentro.
  useEffect(() => {
    if (!active || !perfil.total) return
    const s = st.current
    s.d = 0; s.goal = null; s.fly = 0; s.yaw = 0; s.pitch = 0; s.initQ = false
    s.p0.copy(camera.position); s.q0.copy(camera.quaternion)
    s.A.copy(envelope.center)
    s.A.z += envelope.radius / Math.sin(THREE.MathUtils.degToRad((FOV_DENTRO + 10) / 2)) * 1.12
    s.up.copy(Y)
  }, [active, perfil, camera, radius, envelope])

  useEffect(() => {
    if (!seek || !perfil.segs[seek.i]) return
    const q = perfil.segs[seek.i]
    st.current.goal = q.start + q.length * 0.15
    st.current.fly = 1 // un salto a evento cancela el vuelo inicial
  }, [seek, perfil])

  useEffect(() => {
    if (!active) return
    const el = gl.domElement
    const s = st.current
    let lx = 0; let ly = 0; let pid = null
    const down = (e) => { if (e.button === 0 && pid === null) { s.drag = true; pid = e.pointerId; lx = e.clientX; ly = e.clientY } }
    const move = (e) => {
      if (!s.drag || e.pointerId !== pid) return
      s.yaw -= (e.clientX - lx) * 0.004
      s.pitch = THREE.MathUtils.clamp(s.pitch - (e.clientY - ly) * 0.004, -1.2, 1.2)
      lx = e.clientX; ly = e.clientY
    }
    const up = () => { s.drag = false; pid = null }
    const wheel = (e) => { e.preventDefault(); s.goal = null; s.d = THREE.MathUtils.clamp(s.d - e.deltaY * perfil.total * 0.0002, 0, perfil.total) }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', up)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', up); el.removeEventListener('wheel', wheel); s.drag = false
    }
  }, [gl, active, perfil.total])

  useFrame((_, dt) => {
    if (!active || !perfil.total) return
    const s = st.current
    const h = Math.min(dt, 0.05)
    if (s.goal != null) {
      s.d += (s.goal - s.d) * (1 - Math.exp(-5 * h))
      if (Math.abs(s.goal - s.d) < perfil.total * 0.002) s.goal = null
    } else if (!paused && s.fly >= 1) {
      s.d += h * Math.max(0, speed) * perfil.total
      if (s.d >= perfil.total) { // fin de ruta: se vuelve a entrar
        s.d = 0; s.fly = 0; s.p0.copy(camera.position); s.q0.copy(camera.quaternion)
      }
    }
    muestrea(perfil, s.d, _p, _t)
    _orbit.copy(s.A).sub(envelope.center).applyEuler(_eu.set(s.pitch, s.yaw, 0, 'YXZ'))
    const framedPos = _p.copy(envelope.center).add(_orbit)
    _m.lookAt(framedPos, envelope.center, Y)
    _qB.setFromRotationMatrix(_m)
    if (!s.initQ) { s.q.copy(camera.quaternion); s.initQ = true }
    s.q.slerp(_qB, 1 - Math.exp(-10 * h))
    const fov = FOV_DENTRO + 10
    if (s.fly < 1) {
      s.fly = Math.min(1, s.fly + h / (FLY_A + FLY_B))
      const e = sm(s.fly, 0, 1)
      camera.position.copy(s.p0).lerp(framedPos, e)
      camera.quaternion.copy(s.q0).slerp(s.q, e)
    } else {
      camera.position.copy(framedPos)
      camera.quaternion.copy(s.q)
    }
    camera.fov = THREE.MathUtils.lerp(camera.fov, fov, 1 - Math.exp(-6 * h))
    camera.near = Math.max(0.02, radius * 0.015)
    camera.updateProjectionMatrix()
    if (progressRef) progressRef.current = { d: s.d, total: perfil.total, entrando: s.fly < 1 }
  })
  return null
}
