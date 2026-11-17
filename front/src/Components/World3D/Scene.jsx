import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Lightformer, GradientTexture } from '@react-three/drei'
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
import Bollita from './Bollita.jsx'

const STEP = 0.05
const FOV = 50
const POV_FOV = 75
const POV_FOV_MIN = 45
const POV_FOV_MAX = 100
const POV_PITCH_MAX = THREE.MathUtils.degToRad(80)
const POV_SENS = 0.0045
const POV_RETURN_DELAY = 2000
const NEAR_DEFAULT = 0.15
const NEAR_POV = 0.05
const SEGUIR_DIST = 3.6 // distancia cómoda detrás/encima de la bollita (0.55x en tubos)
const MIN_DIST = 1.4
const VISTA_DIR = new THREE.Vector3(0.55, 0.45, 0.7).normalize()
const SOL_DIR = new THREE.Vector3(0.4, 0.8, 0.3).normalize()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const TONE_MAPPING_AGX = 8 // ToneMappingMode.AGX en postprocessing 6.39
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
const upRefVec = new THREE.Vector3()

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

// Paso variable (troceado a STEP como máximo): con paso fijo la bollita avanzaba a saltos, muy visible de cerca.
function SimDriver({ sim, speed }) {
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

// Órbita libre siempre. Al seguir, el objetivo se ancla a la bollita y la cámara se desplaza con ella.
function CameraRig({ mundo, nodes, selected, follow, pov, cine }) {
  const controls = useRef()
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const modo = useRef('libre') // libre | entrando | siguiendo | pov | volviendo
  const ultima = useRef(null)
  const userActive = useRef(false)
  const manualOrbit = useRef(false)
  const lastTouch = useRef(0)
  const cineClock = useRef(0)
  const prevPos = useRef(new THREE.Vector3())
  const hasPrevPos = useRef(false)
  const povQuat = useRef(new THREE.Quaternion())
  const povUp = useRef(new THREE.Vector3(0, 1, 0))
  const povInit = useRef(false)
  const povYaw = useRef(0)
  const povPitch = useRef(0)
  const povFov = useRef(POV_FOV)
  const povDragging = useRef(false)
  const povLastInteract = useRef(0)
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')

  useEffect(() => {
    if (!povActive) {
      povYaw.current = 0
      povPitch.current = 0
      povFov.current = POV_FOV
      povDragging.current = false
      return
    }
    const dom = gl.domElement
    const prevCursor = dom.style.cursor
    const prevTouchAction = dom.style.touchAction
    dom.style.cursor = 'grab'
    dom.style.touchAction = 'none'

    let pointerId = null
    let lastX = 0
    let lastY = 0
    let moved = false

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      if (pointerId !== null) return
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      moved = false
    }

    const onPointerMove = (e) => {
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      if (!moved && dx * dx + dy * dy < 16) return
      if (!moved) {
        moved = true
        povDragging.current = true
        dom.style.cursor = 'grabbing'
        try { dom.setPointerCapture(e.pointerId) } catch {}
      }
      lastX = e.clientX
      lastY = e.clientY
      povYaw.current = THREE.MathUtils.clamp(povYaw.current + dx * POV_SENS, -Math.PI, Math.PI)
      povPitch.current = THREE.MathUtils.clamp(povPitch.current + dy * POV_SENS, -POV_PITCH_MAX, POV_PITCH_MAX)
      povLastInteract.current = performance.now()
    }

    const endDrag = (e) => {
      if (e.pointerId !== pointerId) return
      pointerId = null
      if (moved) {
        try { dom.releasePointerCapture(e.pointerId) } catch {}
        povLastInteract.current = performance.now()
      }
      povDragging.current = false
      dom.style.cursor = 'grab'
    }

    const onDblClick = () => {
      povYaw.current = 0
      povPitch.current = 0
    }

    const onWheel = (e) => {
      e.preventDefault()
      povFov.current = THREE.MathUtils.clamp(povFov.current + e.deltaY * 0.03, POV_FOV_MIN, POV_FOV_MAX)
    }

    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'r' || e.key === 'R') {
        povYaw.current = 0
        povPitch.current = 0
      }
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', endDrag)
    dom.addEventListener('pointercancel', endDrag)
    dom.addEventListener('dblclick', onDblClick)
    dom.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', endDrag)
      dom.removeEventListener('pointercancel', endDrag)
      dom.removeEventListener('dblclick', onDblClick)
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      dom.style.cursor = prevCursor
      dom.style.touchAction = prevTouchAction
      povDragging.current = false
      povYaw.current = 0
      povPitch.current = 0
      povFov.current = POV_FOV
    }
  }, [povActive, gl])

  // Posición de la vista general: encaja el mundo también en pantallas verticales.
  const casa = () => {
    const v = THREE.MathUtils.degToRad(FOV / 2)
    const h = Math.min(v, Math.atan(Math.tan(v) * camera.aspect))
    return off.copy(mundo.center).addScaledVector(VISTA_DIR, mundo.r / Math.sin(h))
  }

  useLayoutEffect(() => {
    camera.position.copy(casa())
    controls.current.target.copy(mundo.center)
    controls.current.update()
  }, [])

  useFrame((_, dt) => {
    const c = controls.current
    const h = Math.min(dt, 0.1)
    cineClock.current += h

    let targetFov = FOV
    let targetNear = NEAR_DEFAULT
    if (povActive) {
      targetFov = povFov.current
      targetNear = NEAR_POV
      if (modo.current !== 'pov' || ultima.current !== selected) {
        modo.current = 'pov'
        ultima.current = selected
        povInit.current = false
        povYaw.current = 0
        povPitch.current = 0
        povFov.current = POV_FOV
        povDragging.current = false
      }

      if (!povDragging.current && performance.now() - povLastInteract.current > POV_RETURN_DELAY) {
        povYaw.current = Math.abs(povYaw.current) < 1e-4 ? 0 : THREE.MathUtils.damp(povYaw.current, 0, 3.5, h)
        povPitch.current = Math.abs(povPitch.current) < 1e-4 ? 0 : THREE.MathUtils.damp(povPitch.current, 0, 3.5, h)
      }

      if (selected.dir && selected.dir.lengthSq() > 1e-6) {
        povFwd.copy(selected.dir).normalize()
      } else {
        povFwd.set(0, 0, 1)
      }

      // Up interpolado para evitar roll brusco en rizos/embudos
      if (selected.up && selected.up.lengthSq() > 1e-6) {
        const upWeight = selected.phase === 'travel' ? 0.3 : 0.65
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
        povUp.current.lerp(povTargetUp, 1 - Math.exp(-3.5 * h)).normalize()
      }

      povRight.crossVectors(povFwd, povUp.current)
      if (povRight.lengthSq() < 1e-4) {
        povRight.crossVectors(povFwd, Math.abs(povFwd.y) > 0.9 ? sideVec.set(1, 0, 0) : Y_AXIS)
      }
      povRight.normalize()
      povOrthoUp.crossVectors(povRight, povFwd).normalize()
      povMat.makeBasis(povRight, povOrthoUp, sideVec.copy(povFwd).negate())
      povTargetQuat.setFromRotationMatrix(povMat)
      if (povYaw.current !== 0 || povPitch.current !== 0) {
        povLookEuler.set(povPitch.current, povYaw.current, 0, 'YXZ')
        povLookQuat.setFromEuler(povLookEuler)
        povTargetQuat.multiply(povLookQuat)
      }
      povQuat.current.slerp(povTargetQuat, 1 - Math.exp(-(povDragging.current ? 18 : 10) * h))
      camera.quaternion.copy(povQuat.current)

      const upShift = selected.phase === 'travel' ? -0.06 : 0.08
      povEye.copy(selected.pos).addScaledVector(povFwd, 0.14)
      if (selected.up) povEye.addScaledVector(selected.up, upShift)
      camera.position.lerp(povEye, 1 - Math.exp(-18 * h))
      c.target.copy(povEye).addScaledVector(povFwd, 2)
      hasPrevPos.current = false
    } else if (follow && selected && selected.phase !== 'gone') {
      if ((modo.current !== 'entrando' && modo.current !== 'siguiendo') || ultima.current !== selected) {
        modo.current = 'entrando'
        manualOrbit.current = false
        hasPrevPos.current = false
      }
      ultima.current = selected
      const entrando = modo.current === 'entrando'
      const vel = selected.speed ?? 0
      const targetDist = selected.phase === 'travel' ? SEGUIR_DIST : SEGUIR_DIST * 1.15

      // Feed-forward del desplazamiento de la bollita para que no quede rezagada ni a 8x.
      if (hasPrevPos.current) {
        mov.copy(selected.pos).sub(prevPos.current)
        c.target.add(mov)
        camera.position.add(mov)
      }
      prevPos.current.copy(selected.pos)
      hasPrevPos.current = true

      if (cine) {
        targetFov = FOV + THREE.MathUtils.clamp(vel * 0.75, 0, 18)
        if (selected.dir) {
          lookAhead.copy(selected.pos).addScaledVector(selected.dir, THREE.MathUtils.clamp(vel * 0.045, 0, 1.0))
        } else {
          lookAhead.copy(selected.pos)
        }
      } else {
        lookAhead.copy(selected.pos)
      }

      mov.copy(lookAhead).sub(c.target).multiplyScalar(1 - Math.exp(-(entrando ? 8 : 16) * h))
      c.target.add(mov)
      camera.position.add(mov)

      const hasDir = Boolean(selected.dir && selected.dir.lengthSq() > 1e-4)
      if (selected.phase !== 'travel' && selected.up && selected.up.lengthSq() > 1e-4) {
        upRefVec.copy(selected.up).normalize()
      } else {
        upRefVec.copy(Y_AXIS)
      }
      if (hasDir) {
        sideVec.crossVectors(selected.dir, upRefVec)
        if (sideVec.lengthSq() < 1e-4) {
          sideVec.crossVectors(selected.dir, Math.abs(selected.dir.y) > 0.9 ? povFwd.set(1, 0, 0) : Y_AXIS)
        }
        sideVec.normalize()
        const sway = cine ? Math.sin(cineClock.current * 0.85) * 0.35 : 0
        const baseUp = selected.phase !== 'travel' ? 0.56 : 0.44
        const upBias = cine ? baseUp + Math.sin(cineClock.current * 0.5) * 0.08 : baseUp
        desiredOff
          .copy(selected.dir)
          .normalize()
          .multiplyScalar(-1)
          .addScaledVector(upRefVec, upBias)
          .addScaledVector(sideVec, sway)
          .normalize()
      }

      if (entrando) {
        off.copy(camera.position).sub(c.target)
        const d = off.length()
        const nd = d > 1e-4 ? THREE.MathUtils.damp(d, targetDist, 5, h) : targetDist
        if (d > 1e-4) {
          off.divideScalar(d)
          if (!userActive.current && !manualOrbit.current && hasDir) {
            off.lerp(desiredOff, 1 - Math.exp(-4.5 * h)).normalize()
          }
          camera.position.copy(c.target).addScaledVector(off, nd)
        } else {
          camera.position.copy(c.target).addScaledVector(hasDir ? desiredOff : VISTA_DIR, targetDist)
        }
        if (Math.abs(nd - targetDist) < 0.2 && c.target.distanceTo(lookAhead) < 0.35) {
          modo.current = 'siguiendo'
        }
      } else if (!userActive.current && hasDir) {
        const cineFollow = cine && performance.now() - lastTouch.current > 1200
        const autoBehind = !cine && !manualOrbit.current
        if (cineFollow || autoBehind) {
          off.copy(camera.position).sub(c.target)
          const dist = cineFollow ? Math.max(off.length(), targetDist) : Math.max(off.length(), MIN_DIST)
          const rate = cineFollow ? 1.4 : 2.5
          off.lerp(desiredOff.multiplyScalar(dist), 1 - Math.exp(-rate * h))
          if (off.lengthSq() > 1e-6) off.setLength(dist)
          else off.copy(desiredOff)
          camera.position.copy(c.target).add(off)
        }
      }

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
    } else if (modo.current !== 'libre') {
      hasPrevPos.current = false
      manualOrbit.current = false
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
    if (modo.current === 'entrando' || modo.current === 'siguiendo') manualOrbit.current = true
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
      enabled={!povActive}
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

// Luz principal con sombras. El área de sombra acompaña al objetivo de la cámara para tener detalle donde se mira.
// Solo proyectan/reciben las mallas que lo declaren (castShadow / receiveShadow) en Nodes, Paths y Bollita.
function Sol({ r }) {
  const luz = useRef()
  const controls = useThree((s) => s.controls)
  useFrame(() => {
    if (!controls) return
    luz.current.target.position.copy(controls.target)
    luz.current.target.updateMatrixWorld()
    luz.current.position.copy(controls.target).addScaledVector(SOL_DIR, r)
  })
  return (
    <directionalLight
      ref={luz}
      castShadow
      intensity={1.35}
      color="#ffe6c4"
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0003}
      shadow-normalBias={0.03}
      shadow-radius={2.5}
    >
      <orthographicCamera attach="shadow-camera" args={[-45, 45, 45, -45, 1, r * 2.5]} />
    </directionalLight>
  )
}

function PostFX({ dofOn, selected }) {
  const dofRef = useRef()
  const controls = useThree((s) => s.controls)
  const dofTarget = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    if (!dofOn || !dofRef.current?.target) return
    if (selected && selected.phase !== 'gone') dofRef.current.target.copy(selected.pos)
    else if (controls) dofRef.current.target.copy(controls.target)
  })

  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {dofOn && (
        <DepthOfField
          ref={dofRef}
          target={dofTarget}
          worldFocusRange={36}
          bokehScale={0.75}
          resolutionScale={0.5}
        />
      )}
      <Bloom mipmapBlur luminanceThreshold={1.1} luminanceSmoothing={0.25} intensity={0.32} />
      <ChromaticAberration offset={[0.00045, 0.00045]} radialModulation modulationOffset={0.35} />
      <Vignette eskil={false} offset={0.22} darkness={0.48} />
      <Noise opacity={0.025} />
      <ToneMapping mode={TONE_MAPPING_AGX} middleGrey={0.52} />
    </EffectComposer>
  )
}

function PovHint({ active }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!active) { setVisible(false); return }
    setVisible(true)
    const id = setTimeout(() => setVisible(false), 4500)
    return () => clearTimeout(id)
  }, [active])

  if (!visible) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '7px 14px',
        borderRadius: 999,
        background: 'rgba(10, 14, 28, 0.72)',
        border: '1px solid rgba(155, 182, 240, 0.25)',
        color: '#dce8ff',
        fontSize: 13,
        letterSpacing: '0.02em',
        backdropFilter: 'blur(8px)',
        pointerEvents: 'none',
        zIndex: 30,
        whiteSpace: 'nowrap',
      }}
    >
      Arrastra para mirar · R centra · Esc sale
    </div>
  )
}

export default function Scene({ sim, bollitas, speed, selected, follow, pov = false, cine = false, onSelect }) {
  const mundo = useMemo(() => medirMundo(sim.world.nodes), [sim])
  const { center, r } = mundo
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')
  const dofOn = Boolean(follow && selected && selected.phase !== 'gone')
  const forceFocusDetail = Boolean((follow || pov) && selected && selected.phase !== 'gone')
  const focusWay = selected && selected.phase !== 'gone' ? (selected.seg?.way?.idx ?? selected.way?.idx ?? null) : null

  return (
    <>
      <Canvas
      shadows="soft"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: NEAR_DEFAULT, far: r * 20 }}
      onPointerMissed={() => onSelect(null)}
    >
      <fogExp2 attach="fog" args={['#050711', 0.32 / r]} />

      {/* fondo: cúpula oscura + nebulosa FBM + estrellas, centradas en el mundo */}
      <group position={center}>
        {/* radio 12r + zoom máximo 6r < far 20r: la cúpula nunca se recorta */}
        <mesh scale={r * 12}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial side={THREE.BackSide} depthWrite={false} fog={false}>
            <GradientTexture stops={[0, 0.55, 1]} colors={['#0d1124', '#060812', '#020307']} />
          </meshBasicMaterial>
        </mesh>
        <NebulaDome r={r} />
        <ConstellationDome r={r} />
        <Stars
          radius={r * 8}
          depth={r * 2}
          count={2500}
          factor={Math.max(1.5, r * 0.035)}
          saturation={0.25}
          fade
          speed={0.3}
        />
      </group>

      {/* Iluminación con contraste: clave cálida + relleno frío tenue */}
      <Sol r={r} />
      <hemisphereLight args={['#9bb6f0', '#161124', 0.22]} />
      <directionalLight position={[-1, 0.25, -1]} intensity={0.25} color="#6d92e8" />

      {/* entorno generado en local (sin HDR de red): reflejos sutiles en cristal y esferas */}
      <Environment resolution={256} frames={1} environmentIntensity={0.45}>
        <color attach="background" args={['#06091a']} />
        <Lightformer form="rect" intensity={1.6} color="#dce8ff" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#7ea6f5" position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#f0a378" position={[8, 1, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="ring" intensity={1.1} color="#9a7ad8" position={[0, -2, -9]} scale={4} />
      </Environment>

      <SimDriver sim={sim} speed={speed} />
      <Nodes world={sim.world} />
      <Paths world={sim.world} focusWay={focusWay} worldRadius={r} forceFocusDetail={forceFocusDetail} />
      {bollitas.map((b) => (
        <Bollita key={b.id} b={b} sim={sim} selected={selected === b} pov={pov && selected === b} worldRadius={r} onSelect={onSelect} />
      ))}
      <CameraRig mundo={mundo} nodes={sim.world.nodes} selected={selected} follow={follow} pov={pov} cine={cine} />
      <PostFX dofOn={dofOn} selected={selected} />
    </Canvas>
    <PovHint active={povActive} />
    </>
  )
}
