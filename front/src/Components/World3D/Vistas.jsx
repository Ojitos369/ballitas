import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as WORLD from '../../Core/world.js'
import WorldHtml from './WorldHtml.jsx'
import { resolveNodeBiome } from './mundos/biomas.js'

let _worldRef = null
const _worldListeners = new Set()

export function registerWorldForVistas(world) {
  _worldRef = world
  _worldListeners.forEach((fn) => fn(world))
}

export function focusWorldNode(nodeIdx) {
  window.dispatchEvent(new CustomEvent('ballitas:focus-node', { detail: { nodeIdx } }))
}

// ── Vista de superficie: nodo abierto (índice) o null. Tienda mínima con fundido de entrada/salida. ──
let _sup = null
const _supListeners = new Set()
let _fadeEl = null
function fundido(fn) {
  if (!_fadeEl) {
    _fadeEl = document.createElement('div')
    _fadeEl.style.cssText = 'position:fixed;inset:0;z-index:25;pointer-events:none;opacity:0;transition:opacity .38s ease;background:radial-gradient(circle,#0a0d22,#02030a);'
    document.body.appendChild(_fadeEl)
  }
  _fadeEl.style.opacity = '1'
  setTimeout(() => { fn(); setTimeout(() => { if (_fadeEl) _fadeEl.style.opacity = '0' }, 500) }, 400)
}
function fijarSuperficie(idx) { _sup = idx; _supListeners.forEach((f) => f()) }
export function abrirSuperficie(nodeIdx) { if (_sup == null) fundido(() => fijarSuperficie(nodeIdx)) }
export function cerrarSuperficie() { if (_sup != null) fundido(() => fijarSuperficie(null)) }
export function useSuperficie() {
  return useSyncExternalStore((f) => { _supListeners.add(f); return () => _supListeners.delete(f) }, () => _sup)
}

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
  return <VistaMundos enabled={!active} />
}

const _vmOff = new THREE.Vector3()
const _vmGoal = new THREE.Vector3()
const _vmDir = new THREE.Vector3()

function VistaMundos({ enabled }) {
  const camera = useThree((s) => s.camera)
  const controls = useThree((s) => s.controls)
  const [world, setWorld] = useState(() => _worldRef)
  const [focusedIdx, setFocusedIdx] = useState(null)
  const nav = useRef({ fly: 1, dragging: false, p0: new THREE.Vector3(), goal: new THREE.Vector3() })
  const gl = useThree((s) => s.gl)
  const sup = useSuperficie()
  const supRef = useRef(sup)
  supRef.current = sup
  const guardada = useRef(null)
  const focRef = useRef(null)
  focRef.current = focusedIdx

  // Al abrir la superficie se guarda la pose de la cámara general; al salir se restaura (mismo planeta enfocado).
  useEffect(() => {
    if (sup != null) {
      guardada.current = { p: camera.position.clone(), t: controls?.target?.clone(), fov: camera.fov, near: camera.near, far: camera.far }
    }
  }, [sup, camera, controls])

  useEffect(() => {
    const onWorld = (w) => {
      setWorld(w)
      setFocusedIdx(null)
    }
    _worldListeners.add(onWorld)
    if (_worldRef && _worldRef !== world) setWorld(_worldRef)
    return () => { _worldListeners.delete(onWorld) }
  }, [world])

  useEffect(() => {
    if (!enabled) {
      setFocusedIdx(null)
      return undefined
    }
    const nodes = world?.nodes || []
    const focus = (idx) => {
      if (!nodes.length) return
      const safe = ((idx % nodes.length) + nodes.length) % nodes.length
      const n = nodes[safe]
      if (!n) return
      nav.current.fly = 0
      nav.current.p0.copy(camera.position)
      _vmDir.copy(camera.position).sub(n.pos)
      if (_vmDir.lengthSq() < 1e-4) _vmDir.set(0.6, 0.35, 0.72)
      _vmDir.y = Math.max(_vmDir.y * 0.4, 0.25 * WORLD.NODE_R)
      _vmDir.normalize().multiplyScalar(WORLD.NODE_R * 3.15)
      nav.current.goal.copy(n.pos).add(_vmDir)
      setFocusedIdx(safe)
    }
    const onFocusEvent = (e) => {
      if (typeof e.detail?.nodeIdx === 'number') focus(e.detail.nodeIdx)
    }
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || !nodes.length) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (supRef.current != null) { // superficie abierta: Esc sale; el resto de teclas de la vista general se ignoran
        if (e.key === 'Escape') { e.preventDefault(); cerrarSuperficie() }
        return
      }
      if (e.key === 'Enter' && focRef.current != null) {
        e.preventDefault()
        abrirSuperficie(focRef.current)
      } else if (e.key === '[' || e.key === 'PageUp') {
        e.preventDefault()
        setFocusedIdx((cur) => {
          const next = cur == null ? nodes.length - 1 : (cur - 1 + nodes.length) % nodes.length
          focus(next)
          return next
        })
      } else if (e.key === ']' || e.key === 'PageDown') {
        e.preventDefault()
        setFocusedIdx((cur) => {
          const next = cur == null ? 0 : (cur + 1) % nodes.length
          focus(next)
          return next
        })
      } else if (e.key === 'Escape') {
        setFocusedIdx(null)
      }
    }
    // doble clic sobre un planeta: entra a su superficie
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const sph = new THREE.Sphere(); const hit = new THREE.Vector3()
    const onDbl = (e) => {
      if (supRef.current != null) return
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      let best = -1; let bd = Infinity
      nodes.forEach((n, i) => {
        sph.set(n.pos, WORLD.NODE_R)
        if (ray.ray.intersectSphere(sph, hit)) { const d = hit.distanceTo(camera.position); if (d < bd) { bd = d; best = i } }
      })
      if (best >= 0) { nav.current.fly = 1; setFocusedIdx(best); abrirSuperficie(best) }
    }
    const dom = gl.domElement
    dom.addEventListener('dblclick', onDbl)
    window.addEventListener('ballitas:focus-node', onFocusEvent)
    window.addEventListener('keydown', onKey)
    return () => {
      dom.removeEventListener('dblclick', onDbl)
      window.removeEventListener('ballitas:focus-node', onFocusEvent)
      window.removeEventListener('keydown', onKey)
    }
  }, [enabled, world, camera, gl])

  useEffect(() => {
    if (!controls) return undefined
    const onStart = () => {
      nav.current.dragging = true
      nav.current.fly = 1
    }
    const onEnd = () => { nav.current.dragging = false }
    controls.addEventListener('start', onStart)
    controls.addEventListener('end', onEnd)
    return () => {
      controls.removeEventListener('start', onStart)
      controls.removeEventListener('end', onEnd)
    }
  }, [controls])

  useFrame((_, dt) => {
    const g = guardada.current
    if (g && supRef.current == null) {
      // Salida de la superficie: se restaura la pose guardada y se corta el «volviendo a casa» de CameraRig
      // (que arranca al dejar de estar suspendido) simulando un toque del usuario sobre los controles.
      guardada.current = null
      camera.position.copy(g.p); camera.fov = g.fov; camera.near = g.near; camera.far = g.far
      camera.updateProjectionMatrix()
      if (g.t && controls?.target) controls.target.copy(g.t)
      controls?.dispatchEvent?.({ type: 'start' }); controls?.dispatchEvent?.({ type: 'end' })
      controls?.update?.()
      nav.current.fly = 1
      return
    }
    if (!enabled || focusedIdx == null || supRef.current != null) return
    const node = world?.nodes?.[focusedIdx]
    if (!node) return
    const h = Math.min(dt, 0.05)
    const s = nav.current
    if (controls?.target) {
      controls.target.lerp(node.pos, 1 - Math.exp(-7 * h))
    }
    if (s.fly < 1) {
      s.fly = Math.min(1, s.fly + h / 1.1)
      const e = sm(s.fly, 0, 1)
      _vmGoal.copy(s.goal)
      camera.position.copy(s.p0).lerp(_vmGoal, e)
    } else if (!s.dragging) {
      _vmOff.copy(camera.position).sub(node.pos)
      if (_vmOff.lengthSq() > 1e-4) {
        _vmOff.applyAxisAngle(Y, 0.16 * h)
        camera.position.copy(node.pos).add(_vmOff)
      }
    }
    controls?.update?.()
  })

  const focusedNode = enabled && focusedIdx != null ? world?.nodes?.[focusedIdx] : null
  const biome = useMemo(() => (focusedNode ? resolveNodeBiome(focusedNode, world) : null), [focusedNode, world])

  if (!focusedNode || !biome || sup != null) return null
  return (
    <WorldHtml
      center
      position={[focusedNode.pos.x, focusedNode.pos.y + WORLD.NODE_R + 4.9, focusedNode.pos.z]}
      distanceFactor={20}
      zIndexRange={[10, 0]}
    >
      <div
        className="tag node"
        style={{
          borderColor: biome.atmoRim,
          background: `linear-gradient(135deg, ${biome.groundLow}f2, ${biome.groundMid}e6)`,
          boxShadow: `0 0 18px ${biome.atmoBase}99`,
          padding: '6px 12px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: '1.05em' }}>
          {biome.emoji} {focusedNode.name}
        </div>
        <div style={{ fontSize: '0.8em', color: biome.atmoRim }}>{biome.title}</div>
        <button
          type="button"
          onClick={() => abrirSuperficie(focusedIdx)}
          style={{ pointerEvents: 'auto', cursor: 'pointer', marginTop: 4, padding: '3px 12px', borderRadius: 8, border: `1px solid ${biome.atmoRim}`, background: `${biome.atmoBase}66`, color: '#fff', font: 'inherit', fontWeight: 600 }}
        >
          Entrar (Enter)
        </button>
        <div style={{ fontSize: '0.68em', opacity: 0.72, marginTop: 2 }}>
          [ / ] o PgUp / PgDn · Esc para salir
        </div>
      </div>
    </WorldHtml>
  )
}
