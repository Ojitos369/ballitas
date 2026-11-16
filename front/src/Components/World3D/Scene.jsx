import { useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Lightformer, GradientTexture } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import * as THREE from 'three'
import Nodes from './Nodes.jsx'
import Paths from './Paths.jsx'
import Bollita from './Bollita.jsx'

const STEP = 0.05
const FOV = 50
const SEGUIR_DIST = 5 // distancia inicial al seguir a una bollita
const MIN_DIST = 1.2
const VISTA_DIR = new THREE.Vector3(0.55, 0.45, 0.7).normalize()
const SOL_DIR = new THREE.Vector3(0.4, 0.8, 0.3).normalize()
const mov = new THREE.Vector3()
const off = new THREE.Vector3()

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

// Órbita libre siempre. Al seguir, el objetivo se ancla a la bollita y la cámara se desplaza con ella.
function CameraRig({ mundo, selected, follow }) {
  const controls = useRef()
  const camera = useThree((s) => s.camera)
  const modo = useRef('libre') // libre | entrando | siguiendo | volviendo
  const ultima = useRef(null)

  // Posición de la vista general: encaja el mundo también en pantallas verticales.
  const casa = () => {
    const v = THREE.MathUtils.degToRad(camera.fov / 2)
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
    if (follow && selected && selected.phase !== 'gone') {
      if (modo.current !== 'siguiendo' || ultima.current !== selected) modo.current = 'entrando'
      ultima.current = selected
      const entrando = modo.current === 'entrando'
      // mismo desplazamiento a objetivo y cámara: el giro y el zoom del usuario se conservan
      mov.copy(selected.pos).sub(c.target).multiplyScalar(1 - Math.exp(-(entrando ? 4 : 14) * h))
      c.target.add(mov)
      camera.position.add(mov)
      if (entrando) {
        off.copy(camera.position).sub(c.target)
        const d = off.length()
        const nd = THREE.MathUtils.damp(d, SEGUIR_DIST, 4, h)
        camera.position.copy(c.target).addScaledVector(off, nd / d)
        if (nd - SEGUIR_DIST < 0.2) modo.current = 'siguiendo'
      }
    } else if (modo.current !== 'libre') {
      modo.current = 'volviendo'
      const k = 1 - Math.exp(-3 * h)
      const destino = casa()
      c.target.lerp(mundo.center, k)
      camera.position.lerp(destino, k)
      if (camera.position.distanceTo(destino) < mundo.r * 0.01) modo.current = 'libre'
    }
  })

  // Si el usuario toma el control en plena transición, la transición se corta (no se le pelea la cámara).
  const alTocar = () => {
    if (modo.current === 'entrando') modo.current = 'siguiendo'
    if (modo.current === 'volviendo') modo.current = 'libre'
  }
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.08} minDistance={MIN_DIST} maxDistance={mundo.r * 6} onStart={alTocar} />
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
    <directionalLight ref={luz} castShadow intensity={2} color="#fff1dc" shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04}>
      <orthographicCamera attach="shadow-camera" args={[-40, 40, 40, -40, 1, r * 2]} />
    </directionalLight>
  )
}

export default function Scene({ sim, bollitas, speed, selected, follow, onSelect }) {
  const mundo = useMemo(() => medirMundo(sim.world.nodes), [sim])
  const { center, r } = mundo
  return (
    <Canvas shadows="soft" dpr={[1, 1.75]} gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: 0.1, far: r * 20 }} onPointerMissed={() => onSelect(null)}>
      {/* fondo: cúpula degradada + estrellas, centradas en el mundo */}
      <group position={center}>
        {/* radio 12r + zoom máximo 6r < far 20r: la cúpula nunca se recorta */}
        <mesh scale={r * 12}>
          <sphereGeometry args={[1, 32, 16]} />
          <meshBasicMaterial side={THREE.BackSide} depthWrite={false} fog={false}>
            <GradientTexture stops={[0, 0.55, 1]} colors={['#1d1650', '#0a0d26', '#04050d']} />
          </meshBasicMaterial>
        </mesh>
        <Stars radius={r * 8} depth={r * 2} count={4000} factor={r / 3} saturation={0.6} fade speed={0.5} />
      </group>

      <Sol r={r} />
      <hemisphereLight args={['#bcd0ff', '#2a1a40', 0.35]} />
      <directionalLight position={[-1, 0.3, -1]} intensity={0.5} color="#8fb0ff" />
      {/* entorno generado en local (sin HDR de red): da reflejos al cristal y a las esferas */}
      <Environment resolution={256} frames={1} environmentIntensity={0.9}>
        <color attach="background" args={['#0b1030']} />
        <Lightformer form="rect" intensity={4} position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={2} color="#9fc0ff" position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffb48a" position={[8, 1, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="ring" intensity={3} color="#c9a0ff" position={[0, -2, -9]} scale={4} />
      </Environment>

      <SimDriver sim={sim} speed={speed} />
      <Nodes world={sim.world} />
      <Paths world={sim.world} />
      {bollitas.map((b) => (
        <Bollita key={b.id} b={b} sim={sim} selected={selected === b} onSelect={onSelect} />
      ))}
      <CameraRig mundo={mundo} selected={selected} follow={follow} />

      {/* el compositor desactiva el tone mapping del renderer: se aplica aquí, al final */}
      <EffectComposer multisampling={4}>
        <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.3} intensity={0.6} />
        <ToneMapping />
      </EffectComposer>
    </Canvas>
  )
}
