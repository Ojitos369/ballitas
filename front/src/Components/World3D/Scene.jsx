import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Lightformer, GradientTexture, PerformanceMonitor } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  Vignette,
  Noise,
  SMAA,
  ChromaticAberration,
  DepthOfField,
} from '@react-three/postprocessing'
import * as THREE from 'three'
import { NODE_R, mulberry32 } from '../../Core/world.js'
import Nodes from './Nodes.jsx'
import Paths from './Paths.jsx'
import Ballita from './Ballita.jsx'
import PovPanel from '../Panels/PovPanel.jsx'
import { StatsProbe } from './StatsOverlay.jsx'
import { VistaCamino } from './Vistas.jsx'
import InstanceCuller from './InstanceCuller.jsx'
import Precompilado, { precompilar } from './Precompilado.jsx'

const STEP = 0.05
const FOV = 50
const POV_FOV = 75
const POV_FOV_MIN = 45
const POV_FOV_MAX = 100
const POV_PITCH_MAX = THREE.MathUtils.degToRad(65)
const POV_SENS = 0.0026
const POV_LOCK_SENS = 0.0014
const POV_KEY_YAW_SPEED = 1.2
const POV_KEY_PITCH_SPEED = 0.9
const POV_JOY_YAW_SPEED = 1.3
const POV_JOY_PITCH_SPEED = 0.9
const NOOP = () => {}
const NEAR_DEFAULT = 0.15
const NEAR_POV = 0.05
const SEGUIR_DIST = 3.6 // distancia cómoda detrás/encima de la ballita (0.55x en tubos)
const MIN_DIST = 1.4
const VISTA_DIR = new THREE.Vector3(0.55, 0.45, 0.7).normalize()
const SOL_DIR = new THREE.Vector3(0.4, 0.8, 0.3).normalize()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const TONE_MAPPING_AGX = 8 // ToneMappingMode.AGX en postprocessing 6.39
const BlendFunction = { DST: 9, NORMAL: 23 } // postprocessing 6.39 (no es dependencia directa)
const NOOP_UPDATE = () => {}
const DPR_CERCA = 1.0 // tope de DPR en Camino/Ballita
const mov = new THREE.Vector3()
const off = new THREE.Vector3()
const lookAhead = new THREE.Vector3()
const desiredOff = new THREE.Vector3()
const sideVec = new THREE.Vector3()
const povEye = new THREE.Vector3()
const povFwd = new THREE.Vector3()
const povRight = new THREE.Vector3()
const povOrthoUp = new THREE.Vector3()
const povTargetUp = new THREE.Vector3()
const povMat = new THREE.Matrix4()
const povTargetQuat = new THREE.Quaternion()
const povLookEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const povLookQuat = new THREE.Quaternion()
const povLookDirTmp = new THREE.Vector3()
const upRefVec = new THREE.Vector3()
const rollMat = new THREE.Matrix4()
const viewDir = new THREE.Vector3()
const POV_FWD_RATE = 5 // filtro del rumbo en POV
const WALL_UP_RATE = 2.6 // suavizado del giro de cámara con la pared (más bajo = menos mareo)
const FOLLOW_FWD_RATE = 3 // filtro del rumbo de la ballita para la cámara de seguir
const FOLLOW_TARGET_W = 6 // resorte crítico del objetivo (lateral: carriles, saltos)
const FOLLOW_OFF_W = 3 // resorte crítico de la posición relativa de la cámara
const REL_DEFAULT = { yaw: 0, pitch: 0.42, dist: SEGUIR_DIST }
const springA = new THREE.Vector3()
const springB = new THREE.Vector3()
// Resorte con amortiguamiento crítico (solución exacta por paso, estable con dt variable).
function springCD(x, v, goal, w, h) {
  const ex = Math.exp(-w * h)
  springA.copy(x).sub(goal)
  springB.copy(v).addScaledVector(springA, w).multiplyScalar(h)
  v.addScaledVector(springB, -w).multiplyScalar(ex)
  x.copy(goal).add(springA.add(springB).multiplyScalar(ex))
}

const KEY_TO_ACTION = {
  arrowleft: 'left',
  a: 'left',
  j: 'left',
  arrowright: 'right',
  d: 'right',
  l: 'right',
  arrowup: 'up',
  w: 'up',
  i: 'up',
  arrowdown: 'down',
  s: 'down',
  k: 'down',
}

function wrapAngle(a) {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
}

function createPovState() {
  return {
    yaw: 0,
    pitch: 0,
    roll: 0,
    fov: POV_FOV,
    joyX: 0,
    joyY: 0,
    gyroYaw: 0,
    gyroPitch: 0,
    gyroReset: true,
    centerRequested: false,
  }
}

const NEBULA_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const NEBULA_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p = p * 2.04 + vec3(1.7, 9.2, 4.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 drift = vec3(uTime * 0.006, -uTime * 0.004, uTime * 0.003);
    float n1 = fbm(d * 2.5 + drift);
    float n2 = fbm(d * 4.8 - drift * 1.4 + n1 * 0.65);

    // Banda galáctica inclinada muy sutil
    float band = exp(-abs(dot(d, normalize(vec3(0.28, 0.86, -0.42)))) * 2.4);
    float wisp = smoothstep(0.36, 0.85, n1 * 0.6 + n2 * 0.4) * (0.35 + 0.65 * band);

    vec3 colA = vec3(0.07, 0.11, 0.24);
    vec3 colB = vec3(0.06, 0.16, 0.21);
    vec3 colC = vec3(0.18, 0.09, 0.16);
    vec3 col = mix(colA, colB, smoothstep(0.3, 0.75, n2));
    col = mix(col, colC, band * smoothstep(0.5, 0.9, n1) * 0.55);

    gl_FragColor = vec4(col * wisp * 0.26, wisp * 0.26);
  }
`

// Paso variable (troceado a STEP como máximo): con paso fijo la ballita avanzaba a saltos, muy visible de cerca.
function SimDriver({ sim, speed }) {
  const clock = useThree((s) => s.clock)
  // Pestaña oculta: rAF se detiene (la sim se pausa sola); al volver se descarta el hueco para que nada salte.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') clock.getDelta() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [clock])
  useFrame((_, dt) => {
    for (let t = Math.min(dt, 0.1) * speed; t > 0; t -= STEP) sim.tick(Math.min(t, STEP))
  })
  return null
}

// Centro y radio del mundo a partir de los nodos: de aquí salen el encuadre, los límites de zoom y el fondo.
function medirMundo(nodes) {
  const s = new THREE.Box3().setFromPoints(nodes.map((n) => n.pos)).getBoundingSphere(new THREE.Sphere())
  return { center: s.center, r: Math.max(s.radius, 1) * 1.3 }
}

function NebulaDome({ r }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  }), [])

  useEffect(() => () => mat.dispose(), [mat])

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
  })

  return (
    <mesh scale={r * 10.5} material={mat}>
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  )
}

function makeConstellationDotTex() {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(170,230,255,0.75)')
  g.addColorStop(1, 'rgba(80,180,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 32, 32)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function ConstellationDome({ r }) {
  const groupRef = useRef()
  const { lineGeo, pointGeo, dotTex } = useMemo(() => {
    const rng = mulberry32(9369)
    const rad = r * 7.2
    const count = 190
    const pts = []
    for (let i = 0; i < count; i++) {
      const y = 1 - 2 * rng()
      const rr = Math.sqrt(Math.max(0, 1 - y * y))
      const a = rng() * Math.PI * 2
      pts.push(new THREE.Vector3(Math.cos(a) * rr * rad, y * rad, Math.sin(a) * rr * rad))
    }
    const maxDist = rad * 0.24
    const maxDist2 = maxDist * maxDist
    const deg = new Uint8Array(count)
    const linePos = []
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (deg[i] >= 3 || deg[j] >= 3) continue
        if (pts[i].distanceToSquared(pts[j]) <= maxDist2) {
          linePos.push(pts[i].x, pts[i].y, pts[i].z, pts[j].x, pts[j].y, pts[j].z)
          deg[i]++
          deg[j]++
        }
      }
    }
    const lg = new THREE.BufferGeometry()
    lg.setAttribute('position', new THREE.Float32BufferAttribute(linePos, 3))
    const pg = new THREE.BufferGeometry()
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap((p) => [p.x, p.y, p.z]), 3))
    return { lineGeo: lg, pointGeo: pg, dotTex: makeConstellationDotTex() }
  }, [r])

  useEffect(() => () => {
    lineGeo.dispose()
    pointGeo.dispose()
    dotTex?.dispose()
  }, [lineGeo, pointGeo, dotTex])

  useFrame((_, dt) => {
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.004
  })

  return (
    <group ref={groupRef}>
      <lineSegments geometry={lineGeo}>
        <lineBasicMaterial color="#4da8ff" transparent opacity={0.13} depthWrite={false} fog={false} blending={THREE.AdditiveBlending} />
      </lineSegments>
      <points geometry={pointGeo}>
        <pointsMaterial
          color="#9ce4ff"
          map={dotTex}
          size={Math.max(1.2, r * 0.045)}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
          fog={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}

// Órbita libre siempre. Al seguir, el objetivo se ancla a la ballita y la cámara se desplaza con ella.
function CameraRig({ mundo, nodes, selected, follow, pov, cine, suspend = false, povControlRef, pointerLockedRef, gyroActiveRef, horizonRef, onCanvasReady }) {
  const followUp = useRef(new THREE.Vector3(0, 1, 0))
  const followRef = useRef({ rel: { ...REL_DEFAULT }, off: new THREE.Vector3(), offV: new THREE.Vector3(), tgtV: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), lastOff: new THREE.Vector3(), hasLast: false, recenter: false })
  const controls = useRef()
  const vuelta = useRef(false)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const modo = useRef('libre') // libre | entrando | siguiendo | pov | volviendo
  const ultima = useRef(null)
  const userActive = useRef(false)
  const lastTouch = useRef(0)
  const cineClock = useRef(0)
  const prevPos = useRef(new THREE.Vector3())
  const hasPrevPos = useRef(false)
  const povQuat = useRef(new THREE.Quaternion())
  const povUp = useRef(new THREE.Vector3(0, 1, 0))
  const povLastFwd = useRef(new THREE.Vector3(0, 0, 1))
  const povLastRight = useRef(new THREE.Vector3(1, 0, 0))
  const povInit = useRef(false)
  const povDragging = useRef(false)
  const keysRef = useRef(new Set())
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')

  useEffect(() => {
    onCanvasReady?.(gl.domElement)
  }, [gl, onCanvasReady])

  // Recentrar (tecla R o evento 'ballitas:recentrar' del botón): vuelve detrás de la ballita / mirada al frente.
  useEffect(() => {
    const recentrar = () => { followRef.current.recenter = true; povControlRef.current.centerRequested = true }
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.toLowerCase() === 'r') recentrar()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('ballitas:recentrar', recentrar)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('ballitas:recentrar', recentrar) }
  }, [povControlRef])

  useEffect(() => {
    const resetState = () => {
      Object.assign(povControlRef.current, createPovState())
      povDragging.current = false
      keysRef.current.clear()
    }
    if (!povActive) {
      resetState()
      return undefined
    }
    const dom = gl.domElement
    const prevCursor = dom.style.cursor
    const prevTouchAction = dom.style.touchAction
    dom.style.cursor = 'grab'
    dom.style.touchAction = 'none'

    let pointerId = null
    let lastX = 0
    let lastY = 0
    let totalDist2 = 0

    const centerLook = () => {
      const st = povControlRef.current
      st.yaw = 0
      st.pitch = 0
      st.roll = 0
      st.gyroYaw = 0
      st.gyroPitch = 0
      st.gyroReset = true
    }

    const onPointerDown = (e) => {
      if (document.pointerLockElement === dom) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (pointerId !== null) return
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      totalDist2 = 0
      try { dom.setPointerCapture(e.pointerId) } catch {}
    }

    const onPointerMove = (e) => {
      if (document.pointerLockElement === dom) { pointerId = null; povDragging.current = false; return }
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      totalDist2 += dx * dx + dy * dy
      if (!povDragging.current && totalDist2 >= 2) {
        povDragging.current = true
        dom.style.cursor = 'grabbing'
      }
      if (dx !== 0 || dy !== 0) {
        const st = povControlRef.current
        st.yaw = wrapAngle(st.yaw + dx * POV_SENS)
        st.pitch = THREE.MathUtils.clamp(st.pitch + dy * POV_SENS, -POV_PITCH_MAX, POV_PITCH_MAX)
      }
    }

    const endDrag = (e) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      try {
        if (dom.hasPointerCapture?.(e.pointerId)) dom.releasePointerCapture(e.pointerId)
      } catch {}
      povDragging.current = false
      dom.style.cursor = 'grab'
    }

    const onLockedMouseMove = (e) => {
      if (document.pointerLockElement !== dom) return
      const mx = e.movementX || 0
      const my = e.movementY || 0
      if (mx === 0 && my === 0) return
      const st = povControlRef.current
      st.yaw = wrapAngle(st.yaw - mx * POV_LOCK_SENS)
      st.pitch = THREE.MathUtils.clamp(st.pitch - my * POV_LOCK_SENS, -POV_PITCH_MAX, POV_PITCH_MAX)
    }

    const onDblClick = () => centerLook()

    const onWheel = (e) => {
      e.preventDefault()
      const st = povControlRef.current
      st.fov = THREE.MathUtils.clamp(st.fov + e.deltaY * 0.03, POV_FOV_MIN, POV_FOV_MAX)
    }

    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (k === 'r') {
        centerLook()
        return
      }
      const action = KEY_TO_ACTION[k]
      if (action) {
        if (e.key.startsWith('Arrow')) e.preventDefault()
        keysRef.current.add(action)
      }
    }

    const onKeyUp = (e) => {
      const action = KEY_TO_ACTION[e.key.toLowerCase()]
      if (action) keysRef.current.delete(action)
    }

    const onBlur = () => {
      pointerId = null
      povDragging.current = false
      keysRef.current.clear()
      dom.style.cursor = 'grab'
    }

    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    window.addEventListener('blur', onBlur)
    document.addEventListener('mousemove', onLockedMouseMove)
    dom.addEventListener('dblclick', onDblClick)
    dom.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onLockedMouseMove)
      dom.removeEventListener('dblclick', onDblClick)
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      dom.style.cursor = prevCursor
      dom.style.touchAction = prevTouchAction
      resetState()
    }
  }, [povActive, gl, povControlRef])

  // Posición de la vista general: encaja el mundo también en pantallas verticales.
  const casa = () => {
    const v = THREE.MathUtils.degToRad(FOV / 2)
    const h = Math.min(v, Math.atan(Math.tan(v) * Math.max(0.3, camera.aspect || 1)))
    // maxDistance de OrbitControls es r*6: si la casa lo supera, 'volviendo' nunca termina.
    return off.copy(mundo.center).addScaledVector(VISTA_DIR, Math.min(mundo.r / Math.sin(h), mundo.r * 5.8))
  }

  useLayoutEffect(() => {
    camera.position.copy(casa())
    controls.current.target.copy(mundo.center)
    controls.current.update()
  }, [])

  useFrame((_, dt) => {
    const c = controls.current
    const h = Math.min(dt, 0.1)
    if (suspend) { vuelta.current = true; return }
    if (vuelta.current) { // al salir del camino: se vuelve a la vista general con transición
      vuelta.current = false; hasPrevPos.current = false; modo.current = 'volviendo'
      c.target.copy(camera.position).addScaledVector(camera.getWorldDirection(sideVec), mundo.r * 0.1)
    }
    cineClock.current += h

    let targetFov = FOV
    let targetNear = NEAR_DEFAULT
    if (!povActive && typeof window !== 'undefined' && window.__ballitasPov?.active) {
      window.__ballitasPov.active = false
    }
    if (povActive && selected?.phase !== 'gone') {
      const st = povControlRef.current
      if (modo.current !== 'pov' || ultima.current !== selected) {
        modo.current = 'pov'
        ultima.current = selected
        povInit.current = false
        Object.assign(st, createPovState())
        povDragging.current = false
        keysRef.current.clear()
      }

      if (st.centerRequested) {
        st.yaw = 0
        st.pitch = 0
        st.roll = 0
        st.gyroYaw = 0
        st.gyroPitch = 0
        st.gyroReset = true
        st.centerRequested = false
      }

      const keys = keysRef.current
      const yawInput = (keys.has('right') ? -1 : 0) + (keys.has('left') ? 1 : 0)
      const pitchInput = (keys.has('up') ? 1 : 0) + (keys.has('down') ? -1 : 0)
      if (yawInput !== 0) st.yaw = wrapAngle(st.yaw + yawInput * POV_KEY_YAW_SPEED * h)
      if (pitchInput !== 0) {
        st.pitch = THREE.MathUtils.clamp(st.pitch + pitchInput * POV_KEY_PITCH_SPEED * h, -POV_PITCH_MAX, POV_PITCH_MAX)
      }

      if (st.joyX !== 0 || st.joyY !== 0) {
        st.yaw = wrapAngle(st.yaw - st.joyX * POV_JOY_YAW_SPEED * h)
        st.pitch = THREE.MathUtils.clamp(st.pitch - st.joyY * POV_JOY_PITCH_SPEED * h, -POV_PITCH_MAX, POV_PITCH_MAX)
      }

      targetFov = st.fov
      targetNear = NEAR_POV

      // rumbo filtrado: la mirada no tiembla con el vaivén del carril ni con los mecanismos
      if (selected.dir && selected.dir.lengthSq() > 1e-6) {
        if (povInit.current) povLastFwd.current.lerp(selected.dir, 1 - Math.exp(-POV_FWD_RATE * h))
        else povLastFwd.current.copy(selected.dir)
        if (povLastFwd.current.lengthSq() < 1e-6) povLastFwd.current.copy(selected.dir)
        povLastFwd.current.normalize()
      }
      povFwd.copy(povLastFwd.current)

      // En el tubo el up es el de la pared (la cámara gira con la pista); con horizonte estable (H)
      // o fuera del tubo, peso dominante de Y mundial para evitar roll y giros bruscos.
      const onWall = selected.phase === 'travel' && !horizonRef.current
      if (selected.up && selected.up.lengthSq() > 1e-6) {
        const upWeight = onWall ? 1 : selected.phase === 'travel' ? 0 : 0.45
        povTargetUp.copy(Y_AXIS).multiplyScalar(1 - upWeight).addScaledVector(selected.up, upWeight)
        if (povTargetUp.lengthSq() < 1e-4) povTargetUp.copy(Y_AXIS)
        else povTargetUp.normalize()
      } else {
        povTargetUp.copy(Y_AXIS)
      }

      if (!povInit.current) {
        povUp.current.copy(povTargetUp)
        povQuat.current.copy(camera.quaternion)
        povInit.current = true
      } else {
        povUp.current.lerp(povTargetUp, 1 - Math.exp(-(onWall ? WALL_UP_RATE : 3.5) * h))
        if (povUp.current.lengthSq() < 1e-6) povUp.current.copy(povTargetUp)
        povUp.current.normalize()
      }

      povRight.crossVectors(povFwd, povUp.current)
      if (povRight.lengthSq() < 1e-3) povRight.copy(povLastRight.current) // tramo vertical: conserva el lateral
      povRight.normalize()
      povLastRight.current.copy(povRight)
      povOrthoUp.crossVectors(povRight, povFwd).normalize()
      povMat.makeBasis(povRight, povOrthoUp, sideVec.copy(povFwd).negate())
      povTargetQuat.setFromRotationMatrix(povMat)

      const totalYaw = wrapAngle(st.yaw + (gyroActiveRef.current ? st.gyroYaw : 0))
      const totalPitch = THREE.MathUtils.clamp(
        st.pitch + (gyroActiveRef.current ? st.gyroPitch : 0),
        -POV_PITCH_MAX,
        POV_PITCH_MAX,
      )
      const totalRoll = st.roll
      if (totalYaw !== 0 || totalPitch !== 0 || totalRoll !== 0) {
        povLookEuler.set(totalPitch, totalYaw, totalRoll, 'YXZ')
        povLookQuat.setFromEuler(povLookEuler)
        povTargetQuat.multiply(povLookQuat)
      }
      const interacting = povDragging.current
        || yawInput !== 0
        || pitchInput !== 0
        || st.joyX !== 0
        || st.joyY !== 0
        || pointerLockedRef.current
        || gyroActiveRef.current
      povQuat.current.slerp(povTargetQuat, 1 - Math.exp(-(interacting ? 14 : 8) * h))
      camera.quaternion.copy(povQuat.current)

      const upShift = onWall ? 0.1 : selected.phase === 'travel' ? -0.06 : 0.08
      povEye.copy(selected.pos).addScaledVector(povFwd, 0.14)
      if (selected.up) povEye.addScaledVector(selected.up, upShift)
      camera.position.lerp(povEye, 1 - Math.exp(-18 * h))
      c.target.copy(povEye).addScaledVector(povFwd, 2)
      hasPrevPos.current = false

      if (typeof window !== 'undefined') {
        const t = window.__ballitasPov || (window.__ballitasPov = {})
        camera.getWorldDirection(povLookDirTmp)
        t.active = true
        t.yaw = totalYaw
        t.pitch = totalPitch
        t.roll = totalRoll
        t.fov = camera.fov
        t.pointerLocked = Boolean(document.pointerLockElement === gl.domElement)
        t.gyroActive = Boolean(gyroActiveRef.current)
        t.camDir = [povLookDirTmp.x, povLookDirTmp.y, povLookDirTmp.z]
        t.camQuat = [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w]
        t.ballitaDir = [povFwd.x, povFwd.y, povFwd.z]
        t.ballitaPos = [selected.pos.x, selected.pos.y, selected.pos.z]
        t.horizon = Boolean(horizonRef.current)
        t.camUp = [povUp.current.x, povUp.current.y, povUp.current.z]
      }
    } else if (follow && selected && selected.phase !== 'gone') {
      // Seguir: la cámara vive en coordenadas relativas a la ballita (rel: yaw/pitch/dist en su marco suavizado).
      // Si el usuario orbita o hace zoom, se adopta ese ángulo y se conserva; sólo R (o el botón) lo recentra.
      const fs = followRef.current
      if ((modo.current !== 'entrando' && modo.current !== 'siguiendo') || ultima.current !== selected) {
        modo.current = 'entrando'
        hasPrevPos.current = false
        fs.hasLast = false
        fs.offV.set(0, 0, 0)
        fs.tgtV.set(0, 0, 0)
        fs.off.copy(camera.position).sub(c.target)
        if (selected.dir && selected.dir.lengthSq() > 1e-6) fs.fwd.copy(selected.dir).normalize()
      }
      ultima.current = selected
      if (fs.recenter) { fs.recenter = false; Object.assign(fs.rel, REL_DEFAULT) }
      const entrando = modo.current === 'entrando'
      const vel = selected.speed ?? 0
      const distK = selected.phase === 'travel' ? 1 : 1.15

      // marco suavizado: adelante filtrado; "arriba" = Y del mundo en el tubo (horizonte estable), normal del planeta en la ciudad, pared con H
      if (selected.dir && selected.dir.lengthSq() > 1e-6) fs.fwd.lerp(selected.dir, 1 - Math.exp(-FOLLOW_FWD_RATE * h))
      if (fs.fwd.lengthSq() < 1e-6) fs.fwd.copy(selected.dir ?? Y_AXIS)
      fs.fwd.normalize()
      const wallFollow = selected.phase === 'travel' && !horizonRef.current && Boolean(selected.up)
      if (wallFollow) {
        followUp.current.lerp(selected.up, 1 - Math.exp(-WALL_UP_RATE * h))
        if (followUp.current.lengthSq() < 1e-6) followUp.current.copy(selected.up)
        followUp.current.normalize()
      } else {
        const upGoal = selected.phase !== 'travel' && selected.up && selected.up.lengthSq() > 1e-4 ? selected.up : Y_AXIS
        followUp.current.lerp(upGoal, 1 - Math.exp(-WALL_UP_RATE * h))
        if (followUp.current.lengthSq() < 1e-6) followUp.current.copy(upGoal)
        followUp.current.normalize()
      }
      sideVec.crossVectors(fs.fwd, followUp.current)
      if (sideVec.lengthSq() > 1e-3) fs.side.copy(sideVec.normalize()) // en tramos verticales se conserva el lateral previo
      upRefVec.crossVectors(fs.side, fs.fwd).normalize()

      // ¿El usuario movió la cámara (arrastre, inercia o zoom de OrbitControls)? Se adopta su ángulo.
      off.copy(camera.position).sub(c.target)
      if (fs.hasLast && off.distanceToSquared(fs.lastOff) > 1e-6 * Math.max(1, off.lengthSq())) {
        const len = Math.max(off.length(), 1e-4)
        const x = off.dot(fs.side); const y = off.dot(upRefVec); const z = -off.dot(fs.fwd)
        fs.rel.yaw = Math.atan2(x, z)
        fs.rel.pitch = Math.asin(THREE.MathUtils.clamp(y / len, -1, 1))
        fs.rel.dist = len / distK
        fs.off.copy(off)
        fs.offV.set(0, 0, 0)
        if (entrando) modo.current = 'siguiendo'
      }

      // objetivo: el avance axial pasa directo (sin retraso); lo lateral (carriles, saltos) se amortigua
      if (cine && selected.dir) lookAhead.copy(selected.pos).addScaledVector(fs.fwd, THREE.MathUtils.clamp(vel * 0.045, 0, 1.0))
      else lookAhead.copy(selected.pos)
      if (cine) targetFov = FOV + THREE.MathUtils.clamp(vel * 0.6, 0, 14)
      if (hasPrevPos.current) {
        mov.copy(selected.pos).sub(prevPos.current)
        if (mov.lengthSq() > 9) c.target.add(mov) // salto grande (llegada a un nodo): se pasa entero
        else c.target.addScaledVector(fs.fwd, mov.dot(fs.fwd))
      }
      prevPos.current.copy(selected.pos)
      hasPrevPos.current = true
      springCD(c.target, fs.tgtV, lookAhead, entrando ? 2.6 : FOLLOW_TARGET_W, h)

      // posición deseada en el marco de la ballita y resorte crítico hacia ella
      const sway = cine ? Math.sin(cineClock.current * 0.5) * 0.22 : 0
      const yaw = fs.rel.yaw + sway
      const pitch = fs.rel.pitch + (cine ? Math.sin(cineClock.current * 0.31) * 0.06 : 0)
      const dist = fs.rel.dist * distK
      desiredOff.copy(fs.fwd).multiplyScalar(-Math.cos(pitch) * Math.cos(yaw))
        .addScaledVector(fs.side, Math.cos(pitch) * Math.sin(yaw))
        .addScaledVector(upRefVec, Math.sin(pitch))
        .multiplyScalar(dist)
      springCD(fs.off, fs.offV, desiredOff, entrando ? 2.2 : FOLLOW_OFF_W, h)
      camera.position.copy(c.target).add(fs.off)
      if (entrando && c.target.distanceTo(lookAhead) < 1 && Math.abs(fs.off.length() - dist) < 0.8) modo.current = 'siguiendo'

      // Evita que la cámara se meta dentro de la esfera de un planeta al seguir.
      const minPlanetR = NODE_R + 1.25
      for (let i = 0; i < nodes.length; i++) {
        const np = nodes[i].pos
        sideVec.copy(camera.position).sub(np)
        const d2 = sideVec.lengthSq()
        if (d2 < minPlanetR * minPlanetR) {
          if (d2 > 1e-6) sideVec.normalize()
          else sideVec.copy(upRefVec)
          camera.position.copy(np).addScaledVector(sideVec, minPlanetR)
        }
      }

      // Orientación: horizonte estable (up del mundo); en modo pared (H) rueda suave con la pared.
      viewDir.copy(c.target).sub(camera.position)
      if (wallFollow && !userActive.current && viewDir.lengthSq() > 1e-6 && viewDir.normalize().cross(followUp.current).lengthSq() > 0.01) {
        rollMat.lookAt(camera.position, c.target, followUp.current)
        camera.quaternion.setFromRotationMatrix(rollMat)
      } else {
        camera.lookAt(c.target)
      }
      fs.lastOff.copy(camera.position).sub(c.target)
      fs.hasLast = true
    } else if (modo.current !== 'libre') {
      hasPrevPos.current = false
      modo.current = 'volviendo'
      const k = 1 - Math.exp(-3 * h)
      const destino = casa()
      c.target.lerp(mundo.center, k)
      camera.position.lerp(destino, k)
      if (camera.position.distanceTo(destino) < mundo.r * 0.01) modo.current = 'libre'
    } else if (cine && !userActive.current && performance.now() - lastTouch.current > 1200) {
      // Vista general cinematográfica: órbita lenta con deriva vertical suave
      off.copy(camera.position).sub(c.target)
      off.applyAxisAngle(Y_AXIS, 0.09 * h)
      const dist = off.length()
      if (dist > 1e-4) {
        const driftY = Math.sin(cineClock.current * 0.24) * 0.045 * h * dist
        off.y = THREE.MathUtils.clamp(off.y + driftY, -dist * 0.55, dist * 0.72)
        off.setLength(dist)
        camera.position.copy(c.target).add(off)
      }
    }

    let projDirty = false
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4.5, h)
      projDirty = true
    }
    if (Math.abs(camera.near - targetNear) > 0.001) {
      camera.near = targetNear
      projDirty = true
    }
    if (projDirty) camera.updateProjectionMatrix()
  })

  // Si el usuario toma el control en plena transición, la transición se corta (no se le pelea la cámara).
  const alTocar = () => {
    userActive.current = true
    if (modo.current === 'entrando') modo.current = 'siguiendo'
    if (modo.current === 'volviendo') modo.current = 'libre'
  }
  const alSoltar = () => {
    userActive.current = false
    lastTouch.current = performance.now()
  }

  return (
    <OrbitControls
      ref={controls}
      enabled={!povActive && !suspend}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={MIN_DIST}
      maxDistance={mundo.r * 6}
      onStart={alTocar}
      onEnd={alSoltar}
    />
  )
}

// Luz principal con sombras. Solo proyecta sombras al seguir una ballita / POV para ahorrar GPU en vista general.
function Sol({ r, shadowsOn, selected }) {
  const luz = useRef()
  const controls = useThree((s) => s.controls)
  // castShadow fijo: alternarlo cambia el hash de luces y recompila todos los shaders (cuadros de segundos).
  // Fuera de la vista de ballita la sombra ni se renderiza ni se ve.
  useEffect(() => {
    if (!luz.current) return
    luz.current.shadow.autoUpdate = shadowsOn
    luz.current.shadow.intensity = shadowsOn ? 1 : 0
  }, [shadowsOn])
  useFrame(() => {
    if (!luz.current) return
    const tgt = shadowsOn && selected && selected.phase !== 'gone' ? selected.pos : controls?.target
    if (!tgt) return
    luz.current.target.position.copy(tgt)
    luz.current.target.updateMatrixWorld()
    luz.current.position.copy(tgt).addScaledVector(SOL_DIR, r)
  })
  return (
    <directionalLight
      ref={luz}
      castShadow
      intensity={1.35}
      color="#ffe6c4"
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.0005}
      shadow-normalBias={0.03}
      shadow-radius={1.5}
    >
      <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 1, r * 2.5]} />
    </directionalLight>
  )
}

const CA_ON = [0.00045, 0.00045]
const CA_OFF = [0, 0]
// DoF siempre montado (PerformanceMonitor cambia dpr/lowPerf a menudo); dofOn = activo en esta vista.
function PostFX({ dofOn, selected, highQuality }) {
  const dofRef = useRef()
  const controls = useThree((s) => s.controls)
  const dofTarget = useMemo(() => new THREE.Vector3(), [])

  // DoF siempre montado: apagarlo con DST lo saca del shader sin recrear el EffectMaterial
  // (three guarda ambas variantes del programa en el mismo material) y se omiten sus pasadas.
  // Se aplica en useFrame: el ref del efecto llega después de los efectos de PostFX y puede recrearse.
  // Calentamiento: con el mapa ya pintado y el hilo libre, un cuadro con DoF activo compila sus
  // programas (CoC, Bokeh, Kawase, variante del EffectMaterial) para que la primera Ballita no los compile.
  const warm = useRef(0) // 0 pendiente, 1 este cuadro, 2 hecho
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f) => setTimeout(f, 1))
    // Además, compila en paralelo todo lo montado aunque esté oculto (LOD de nodos, pieles, variantes
    // cercanas): sin esto, acercarse por primera vez (Camino/Ballita) esperaba su enlace dentro del cuadro.
    const t = setTimeout(() => idle(() => {
      if (warm.current === 0) warm.current = 1
      precompilar(gl, scene, camera, scene)
    }), 2500)
    return () => clearTimeout(t)
  }, [gl, camera, scene])

  useFrame(() => {
    const e = dofRef.current
    if (!e) return
    if (!e.__update) e.__update = e.update
    const on = dofOn || warm.current === 1
    if (warm.current === 1 && e.update === e.__update && e.blendMode.blendFunction === BlendFunction.NORMAL) warm.current = 2
    const upd = on ? e.__update : NOOP_UPDATE
    if (e.update !== upd) e.update = upd
    const bf = on ? BlendFunction.NORMAL : BlendFunction.DST
    if (e.blendMode.blendFunction !== bf) e.blendMode.blendFunction = bf
    if (!dofOn || !e.target) return
    if (selected && selected.phase !== 'gone') dofRef.current.target.copy(selected.pos)
    else if (controls) dofRef.current.target.copy(controls.target)
  })

  return (
    <EffectComposer multisampling={0}>
      {/* Composición fija: montar/desmontar efectos recrea el EffectPass y recompila; la calidad alta solo cambia props */}
      <SMAA />
      <DepthOfField
        ref={dofRef}
        target={dofTarget}
        worldFocusRange={36}
        bokehScale={0.75}
        resolutionScale={0.5}
      />
      <Bloom mipmapBlur luminanceThreshold={1.15} luminanceSmoothing={0.25} intensity={highQuality ? 0.32 : 0.28} />
      <ChromaticAberration offset={highQuality ? CA_ON : CA_OFF} radialModulation modulationOffset={0.35} />
      <Vignette eskil={false} offset={0.22} darkness={highQuality ? 0.48 : 0.45} />
      <Noise opacity={highQuality ? 0.025 : 0} />
      <ToneMapping mode={TONE_MAPPING_AGX} middleGrey={0.52} />
    </EffectComposer>
  )
}

export default function Scene({ sim, ballitas, speed, selected, follow, pov = false, cine = false, showStats = false, onStatsSample, onSelect, onExitPov, vista = 'mapa', activeWay = null, routeIndex = 0, seek = null, caminoSpeed = 0.05, caminoPaused = false, progressRef, onSelectWay }) {
  const mundo = useMemo(() => medirMundo(sim.world.nodes), [sim])
  const { center, r } = mundo
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')
  const dofOn = Boolean(follow && selected && selected.phase !== 'gone')
  const cameraWay = activeWay ?? (vista !== 'camino' && selected && selected.phase !== 'gone' ? (selected.seg?.way ?? selected.way ?? null) : null)
  const focusWay = activeWay?.idx ?? null
  const camino = vista === 'camino'
  const caminoOn = Boolean(camino && cameraWay)
  const forceFocusDetail = Boolean(camino || ((follow || pov) && selected && selected.phase !== 'gone'))
  const focusedWay = camino ? cameraWay?.idx ?? focusWay : (vista === 'mapa' ? focusWay : (selected && selected.phase !== 'gone' ? (selected.seg?.way?.idx ?? selected.way?.idx ?? null) : null))

  const povControlRef = useRef(createPovState())
  const canvasDomRef = useRef(null)
  const [pointerLocked, setPointerLocked] = useState(false)
  const pointerLockedRef = useRef(false)
  const wasLockedRef = useRef(false)
  const suppressNextEscRef = useRef(false)
  const [gyroActive, setGyroActive] = useState(false)
  const gyroActiveRef = useRef(false)
  const [gyroNote, setGyroNote] = useState(null)
  // Horizonte estable (tecla H): la cámara mantiene el up del mundo en vez de girar con la pared.
  const horizonRef = useRef(true) // por defecto estable: sin roll
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.toLowerCase() !== 'h') return
      horizonRef.current = !horizonRef.current
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const cameraOnBall = Boolean((povActive || follow) && selected && selected.phase !== 'gone')
  const [dpr, setDpr] = useState(1)
  const [lowPerf, setLowPerf] = useState(false)
  const highQualityFx = cameraOnBall && !lowPerf
  const ultraQualityFx = highQualityFx && dpr >= 1.25

  const handlePerfDecline = useCallback(() => {
    setDpr((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))))
    setLowPerf(true)
  }, [])
  const handlePerfIncline = useCallback(() => {
    setDpr((prev) => Math.min(1.5, Number((prev + 0.15).toFixed(2))))
    setLowPerf(false)
  }, [])
  const handlePerfChange = useCallback(({ factor }) => {
    const next = Number((0.6 + factor * 0.9).toFixed(2))
    setDpr((prev) => (Math.abs(prev - next) >= 0.08 ? next : prev))
    setLowPerf(factor < 0.65)
  }, [])

  const handleCanvasReady = useCallback((dom) => {
    canvasDomRef.current = dom
  }, [])

  // Limpia estados de bloqueo y giroscopio al salir de POV.
  useEffect(() => {
    if (povActive) return
    setGyroActive(false)
    gyroActiveRef.current = false
    setGyroNote(null)
    suppressNextEscRef.current = false
    const dom = canvasDomRef.current
    if (dom && document.pointerLockElement === dom) {
      try { document.exitPointerLock?.() } catch {}
    }
  }, [povActive])

  // Sincroniza el estado de Pointer Lock y gestiona Esc en dos pasos (1º suelta cursor, 2º sale de POV).
  useEffect(() => {
    if (!povActive) return undefined
    let suppressTimer = null

    const onLockChange = () => {
      const dom = canvasDomRef.current
      const locked = Boolean(dom && document.pointerLockElement === dom)
      if (wasLockedRef.current && !locked) {
        suppressNextEscRef.current = true
        if (suppressTimer) clearTimeout(suppressTimer)
        suppressTimer = setTimeout(() => { suppressNextEscRef.current = false }, 220)
      }
      wasLockedRef.current = locked
      pointerLockedRef.current = locked
      setPointerLocked(locked)
      if (dom) dom.style.cursor = locked ? 'none' : 'grab'
    }

    const onLockError = () => {
      wasLockedRef.current = false
      pointerLockedRef.current = false
      setPointerLocked(false)
    }

    const onEscapeCapture = (e) => {
      if (e.key !== 'Escape') return
      if (document.pointerLockElement) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        suppressNextEscRef.current = false
        try { document.exitPointerLock?.() } catch {}
        return
      }
      if (suppressNextEscRef.current) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        suppressNextEscRef.current = false
        return
      }
      if (onExitPov) {
        e.preventDefault()
        e.stopPropagation()
        onExitPov()
      }
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('pointerlockerror', onLockError)
    window.addEventListener('keydown', onEscapeCapture, true)
    return () => {
      if (suppressTimer) clearTimeout(suppressTimer)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('pointerlockerror', onLockError)
      window.removeEventListener('keydown', onEscapeCapture, true)
      wasLockedRef.current = false
      pointerLockedRef.current = false
      setPointerLocked(false)
    }
  }, [povActive, onExitPov])

  // Giroscopio (DeviceOrientation) opcional activado por el usuario.
  useEffect(() => {
    if (!povActive || !gyroActive) {
      gyroActiveRef.current = false
      povControlRef.current.gyroYaw = 0
      povControlRef.current.gyroPitch = 0
      return undefined
    }
    gyroActiveRef.current = true
    povControlRef.current.gyroReset = true
    let gotReading = false
    const deg2rad = Math.PI / 180
    const qBase = new THREE.Quaternion()
    const zee = new THREE.Vector3(0, 0, 1)
    const euler = new THREE.Euler()
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
    const q0 = new THREE.Quaternion()
    const qDev = new THREE.Quaternion()
    const qRel = new THREE.Quaternion()
    const relEuler = new THREE.Euler()

    const onOrient = (e) => {
      if (e.alpha == null && e.beta == null && e.gamma == null) return
      if (!gotReading) {
        gotReading = true
        setGyroNote(null)
      }
      const alpha = (e.alpha ?? 0) * deg2rad
      const beta = (e.beta ?? 0) * deg2rad
      const gamma = (e.gamma ?? 0) * deg2rad
      const orient = (window.screen?.orientation?.angle ?? window.orientation ?? 0) * deg2rad
      euler.set(beta, alpha, -gamma, 'YXZ')
      qDev.setFromEuler(euler)
      qDev.multiply(q1)
      qDev.multiply(q0.setFromAxisAngle(zee, -orient))

      if (povControlRef.current.gyroReset) {
        qBase.copy(qDev).invert()
        povControlRef.current.gyroReset = false
        povControlRef.current.gyroYaw = 0
        povControlRef.current.gyroPitch = 0
        return
      }
      qRel.copy(qBase).multiply(qDev)
      relEuler.setFromQuaternion(qRel, 'YXZ')
      povControlRef.current.gyroYaw = wrapAngle(relEuler.y)
      povControlRef.current.gyroPitch = THREE.MathUtils.clamp(relEuler.x, -POV_PITCH_MAX, POV_PITCH_MAX)
    }

    const onScreenOrient = () => {
      povControlRef.current.gyroReset = true
    }

    const noDataTimer = setTimeout(() => {
      if (!gotReading) setGyroNote('Sin lecturas de giroscopio en este dispositivo')
    }, 1500)

    window.addEventListener('deviceorientation', onOrient)
    window.addEventListener('orientationchange', onScreenOrient)
    return () => {
      clearTimeout(noDataTimer)
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('orientationchange', onScreenOrient)
      gyroActiveRef.current = false
      povControlRef.current.gyroYaw = 0
      povControlRef.current.gyroPitch = 0
    }
  }, [povActive, gyroActive])

  const handleCenter = useCallback(() => {
    povControlRef.current.centerRequested = true
  }, [])

  const handleTogglePointerLock = useCallback(() => {
    const dom = canvasDomRef.current
    if (!dom) return
    if (document.pointerLockElement === dom) {
      try { document.exitPointerLock?.() } catch {}
      return
    }
    if (!dom.requestPointerLock) return
    try {
      const res = dom.requestPointerLock()
      if (res && typeof res.catch === 'function') res.catch(() => {})
    } catch {}
  }, [])

  const handleToggleGyro = useCallback(async () => {
    if (gyroActive) {
      setGyroActive(false)
      setGyroNote(null)
      return
    }
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setGyroNote('Giroscopio no disponible')
      return
    }
    const DOE = window.DeviceOrientationEvent
    if (typeof DOE.requestPermission === 'function') {
      try {
        const perm = await DOE.requestPermission()
        if (perm !== 'granted') {
          setGyroNote('Permiso de giroscopio denegado')
          return
        }
      } catch {
        setGyroNote('No se pudo activar el giroscopio')
        return
      }
    }
    setGyroNote(null)
    setGyroActive(true)
  }, [gyroActive])

  return (
    <>
      <Canvas
      shadows="soft"
      // De cerca el coste es de relleno (postFX y tubo a pantalla completa): DPR 1,5 -> 1,0 pasa de ~20-30 a ~48-57 FPS.
      dpr={vista === 'mapa' ? dpr : Math.min(dpr, DPR_CERCA)}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: NEAR_DEFAULT, far: r * 20 }}
      // En producción no se lee el log de cada programa: getProgramInfoLog espera la compilación en el primer
      // uso (~130 ms al entrar a Camino) aunque el enlace paralelo (KHR_parallel_shader_compile) siga en curso.
      onCreated={({ gl }) => { gl.debug.checkShaderErrors = import.meta.env.DEV }}
      onPointerMissed={() => { if (!povActive && !camino) onSelect(null) }}
    >
      <PerformanceMonitor
        ms={120}
        iterations={3}
        flipflops={3}
        bounds={() => [30, 55]}
        step={0.2}
        onDecline={handlePerfDecline}
        onIncline={handlePerfIncline}
        onChange={handlePerfChange}
      />
      <fogExp2 attach="fog" args={['#050711', 0.32 / r]} />

      {/* fondo: cúpula oscura + nebulosa FBM + estrellas, centradas en el mundo */}
      <group position={center}>
        {/* radio 12r + zoom máximo 6r < far 20r: la cúpula nunca se recorta */}
        <mesh scale={r * 12}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial side={THREE.BackSide} depthWrite={false} fog={false}>
            <GradientTexture stops={[0, 0.55, 1]} colors={['#0d1124', '#060812', '#020307']} />
          </meshBasicMaterial>
        </mesh>
        <NebulaDome r={r} />
        <ConstellationDome r={r} />
        <Stars
          radius={r * 8}
          depth={r * 2}
          count={1200}
          factor={Math.max(1.5, r * 0.035)}
          saturation={0.25}
          fade
          speed={0.3}
        />
      </group>

      {/* Iluminación con contraste: clave cálida + relleno frío tenue */}
      <Sol r={r} shadowsOn={cameraOnBall} selected={selected} />
      <hemisphereLight args={['#9bb6f0', '#161124', 0.22]} />
      <directionalLight position={[-1, 0.25, -1]} intensity={0.25} color="#6d92e8" />

      {/* entorno generado en local (sin HDR de red): reflejos sutiles en cristal y esferas */}
      <Environment resolution={128} frames={1} environmentIntensity={0.45}>
        <color attach="background" args={['#06091a']} />
        <Lightformer form="rect" intensity={1.6} color="#dce8ff" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#7ea6f5" position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#f0a378" position={[8, 1, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="ring" intensity={1.1} color="#9a7ad8" position={[0, -2, -9]} scale={4} />
      </Environment>

      <SimDriver sim={sim} speed={speed} />
      <Nodes world={sim.world} />
      <Paths world={sim.world} sim={sim} focusWay={focusedWay} worldRadius={r} forceFocusDetail={forceFocusDetail} cameraOnBall={cameraOnBall} onPickWay={vista === 'mapa' ? onSelectWay : undefined} />
      {/* Precompilado: las ballitas nacen con pieles nuevas tras el precompilado inicial; sin esto la primera
          vez que entran en cuadro (al acercarse en Camino/Ballita) se esperaba su enlace dentro del cuadro. */}
      {ballitas.map((b) => (
        <Precompilado key={b.id}>
          <Ballita
            b={b}
            sim={sim}
            selected={selected === b}
            pov={pov && selected === b}
            follow={follow && selected === b}
            povMode={povActive}
            worldRadius={r}
            onSelect={povActive ? NOOP : onSelect}
          />
        </Precompilado>
      ))}
      <CameraRig
        mundo={mundo}
        nodes={sim.world.nodes}
        selected={selected}
        follow={follow}
        pov={pov}
        cine={cine}
        suspend={caminoOn}
        povControlRef={povControlRef}
        pointerLockedRef={pointerLockedRef}
        gyroActiveRef={gyroActiveRef}
        horizonRef={horizonRef}
        onCanvasReady={handleCanvasReady}
      />
      <PostFX dofOn={dofOn && ultraQualityFx} selected={selected} highQuality={highQualityFx} />
      <InstanceCuller active={vista !== 'mapa'} />
      <StatsProbe active={showStats} onSample={onStatsSample} />
      <VistaCamino way={cameraWay} routeIndex={routeIndex} seek={seek} speed={caminoSpeed} paused={caminoPaused} active={caminoOn} progressRef={progressRef} />
    </Canvas>
    <PovPanel
      active={povActive}
      povControlRef={povControlRef}
      pointerLocked={pointerLocked}
      gyroActive={gyroActive}
      gyroNote={gyroNote}
      onCenter={handleCenter}
      onTogglePointerLock={handleTogglePointerLock}
      onToggleGyro={handleToggleGyro}
      onExitPov={() => onExitPov?.()}
    />
    </>
  )
}
