import { useLayoutEffect, useMemo, useRef } from 'react'
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
import Nodes from './Nodes.jsx'
import Paths from './Paths.jsx'
import Bollita from './Bollita.jsx'

const STEP = 0.05
const FOV = 50
const POV_FOV = 75
const NEAR_DEFAULT = 0.1
const NEAR_POV = 0.05
const SEGUIR_DIST = 5 // distancia inicial al seguir a una bollita
const MIN_DIST = 1.2
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

// Órbita libre siempre. Al seguir, el objetivo se ancla a la bollita y la cámara se desplaza con ella.
function CameraRig({ mundo, selected, follow, pov, cine }) {
  const controls = useRef()
  const camera = useThree((s) => s.camera)
  const modo = useRef('libre') // libre | entrando | siguiendo | pov | volviendo
  const ultima = useRef(null)
  const userActive = useRef(false)
  const lastTouch = useRef(0)
  const cineClock = useRef(0)
  const povQuat = useRef(new THREE.Quaternion())
  const povUp = useRef(new THREE.Vector3(0, 1, 0))
  const povInit = useRef(false)
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')

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
      targetFov = POV_FOV
      targetNear = NEAR_POV
      if (modo.current !== 'pov' || ultima.current !== selected) {
        modo.current = 'pov'
        ultima.current = selected
        povInit.current = false
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
      povQuat.current.slerp(povTargetQuat, 1 - Math.exp(-10 * h))
      camera.quaternion.copy(povQuat.current)

      const upShift = selected.phase === 'travel' ? -0.06 : 0.08
      povEye.copy(selected.pos).addScaledVector(povFwd, 0.14)
      if (selected.up) povEye.addScaledVector(selected.up, upShift)
      camera.position.lerp(povEye, 1 - Math.exp(-18 * h))
      c.target.copy(povEye).addScaledVector(povFwd, 2)
    } else if (follow && selected && selected.phase !== 'gone') {
      if (modo.current !== 'siguiendo' || ultima.current !== selected) modo.current = 'entrando'
      ultima.current = selected
      const entrando = modo.current === 'entrando'
      const vel = selected.speed ?? 0

      if (cine) {
        targetFov = FOV + THREE.MathUtils.clamp(vel * 0.75, 0, 18)
        // Leve anticipación en la dirección de avance y seguimiento más suave (lag cinematográfico)
        if (selected.dir) {
          lookAhead.copy(selected.pos).addScaledVector(selected.dir, THREE.MathUtils.clamp(vel * 0.06, 0, 1.4))
        } else {
          lookAhead.copy(selected.pos)
        }
        mov.copy(lookAhead).sub(c.target).multiplyScalar(1 - Math.exp(-(entrando ? 4 : 8.5) * h))
      } else {
        // Mismo desplazamiento a objetivo y cámara: el giro y el zoom del usuario se conservan
        mov.copy(selected.pos).sub(c.target).multiplyScalar(1 - Math.exp(-(entrando ? 4 : 14) * h))
      }

      c.target.add(mov)
      camera.position.add(mov)

      if (entrando) {
        off.copy(camera.position).sub(c.target)
        const d = off.length()
        if (d > 1e-4) {
          const nd = THREE.MathUtils.damp(d, SEGUIR_DIST, 4, h)
          camera.position.copy(c.target).addScaledVector(off, nd / d)
          if (nd - SEGUIR_DIST < 0.2) modo.current = 'siguiendo'
        } else {
          camera.position.copy(c.target).addScaledVector(VISTA_DIR, SEGUIR_DIST)
          modo.current = 'siguiendo'
        }
      } else if (cine && !userActive.current && selected.dir && performance.now() - lastTouch.current > 1200) {
        // Deriva suave detrás de la bollita con leve balanceo lateral sin pelear con OrbitControls
        off.copy(camera.position).sub(c.target)
        const dist = Math.max(off.length(), SEGUIR_DIST)
        sideVec.crossVectors(selected.dir, Y_AXIS)
        if (sideVec.lengthSq() < 1e-4) sideVec.set(1, 0, 0)
        else sideVec.normalize()
        const sway = Math.sin(cineClock.current * 0.85) * 0.35
        desiredOff
          .copy(selected.dir)
          .multiplyScalar(-1)
          .addScaledVector(Y_AXIS, 0.36 + Math.sin(cineClock.current * 0.5) * 0.08)
          .addScaledVector(sideVec, sway)
          .normalize()
          .multiplyScalar(dist)
        off.lerp(desiredOff, 1 - Math.exp(-1.2 * h))
        if (off.lengthSq() > 1e-6) off.setLength(dist)
        else off.copy(desiredOff)
        camera.position.copy(c.target).add(off)
      }
    } else if (modo.current !== 'libre') {
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

function PostFX({ dofOn }) {
  const dofRef = useRef()
  const controls = useThree((s) => s.controls)

  useFrame(() => {
    if (dofOn && dofRef.current?.target && controls) {
      dofRef.current.target.copy(controls.target)
    }
  })

  return (
    <EffectComposer multisampling={0}>
      <SMAA />
      {dofOn && (
        <DepthOfField
          ref={dofRef}
          target={[0, 0, 0]}
          focalLength={0.025}
          worldFocusRange={18}
          bokehScale={1.8}
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

export default function Scene({ sim, bollitas, speed, selected, follow, pov = false, cine = false, onSelect }) {
  const mundo = useMemo(() => medirMundo(sim.world.nodes), [sim])
  const { center, r } = mundo
  const dofOn = Boolean(follow && selected && selected.phase !== 'gone')
  const focusWay = selected && selected.phase !== 'gone' ? (selected.seg?.way?.idx ?? selected.way?.idx ?? null) : null

  return (
    <Canvas
      shadows="soft"
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 0.1, far: r * 20 }}
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
      <Paths world={sim.world} focusWay={focusWay} />
      {bollitas.map((b) => (
        <Bollita key={b.id} b={b} sim={sim} selected={selected === b} pov={pov && selected === b} onSelect={onSelect} />
      ))}
      <CameraRig mundo={mundo} selected={selected} follow={follow} pov={pov} cine={cine} />
      <PostFX dofOn={dofOn} />
    </Canvas>
  )
}
