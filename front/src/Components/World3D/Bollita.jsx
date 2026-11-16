import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { FACES } from '../../Core/personality.js'
import { BALL_R } from '../../Core/world.js'

const m4 = new THREE.Matrix4()
const tq = new THREE.Quaternion()
const vx = new THREE.Vector3()
const vy = new THREE.Vector3()
const vz = new THREE.Vector3()

export function bodyColor(g) {
  return new THREE.Color().setHSL(g.hue, 0.75, 0.6)
}

// Una bollita 3D con cara. Lee su estado de `sim` en cada frame; no guarda nada de la sim en React.
export default function Bollita({ b, sim, selected, onSelect }) {
  const root = useRef(); const eyeL = useRef(); const eyeR = useRef()
  const browL = useRef(); const browR = useRef(); const mouth = useRef()
  const blush = useRef(); const sweat = useRef(); const ring = useRef(); const pupils = useRef()
  const cur = useRef({ eye: 1, brow: 0, mouth: 0.5, blush: 0, sweat: 0, bounce: 1 })
  const oriented = useRef(false)
  const g = b.genome.traits
  const color = useMemo(() => bodyColor(b.genome), [b])
  const r = BALL_R * (0.86 + g.apetito * 0.14) // las glotonas son más gorditas, sin pasar de lo que cabe en el tubo (BALL_R)
  const eyeSize = 0.18 + g.sociabilidad * 0.08
  const phase0 = b.id * 1.7

  useFrame(({ clock }, dt) => {
    const k = 1 - Math.exp(-8 * Math.min(dt, 0.1))
    const t = clock.elapsedTime
    // en obstáculos rápidos o aéreos: las valientes se emocionan y el resto se asusta
    const rush = b.phase === 'travel' && b.seg && (b.seg.air || b.seg.risk >= 0.7)
    const F = (rush ? (g.valentia > 0.5 ? FACES.euforica : FACES.asustada) : FACES[b.mood]) ?? FACES.feliz
    const c = cur.current
    for (const key of ['eye', 'brow', 'mouth', 'blush', 'sweat', 'bounce']) c[key] += (F[key] - c[key]) * k

    // escala: nacer (con rebote), vivir (squash & stretch) y morir (encoge girando)
    let s = 1
    if (b.phase === 'born') { const x = 1 - b.timer / b.dur; s = x * (1 + Math.sin(x * Math.PI) * 0.35) }
    if (b.phase === 'dying') s = Math.max(0, b.timer / 1.4)
    const bob = Math.sin(t * 4 * c.bounce + phase0)
    // se estira a lo largo del avance con la velocidad; parada, respira
    const along = b.speed > 0.5 ? 1 + Math.min(b.speed / 40, 0.3) : 1 + bob * 0.06 * c.bounce
    const side = 1 / Math.sqrt(along)
    root.current.scale.set(s * side, s * side, s * along)

    // rebote al estar en un destino: sube por la normal
    const hop = b.phase === 'at' ? Math.abs(bob) * 0.12 * c.bounce : 0
    root.current.position.copy(b.pos).addScaledVector(b.up, hop)

    // orientación: frente = dir, arriba = up (ortonormalizados), con slerp
    vy.copy(b.up)
    vz.copy(b.dir).addScaledVector(vy, -b.dir.dot(vy))
    if (vz.lengthSq() > 1e-6 && vy.lengthSq() > 1e-6) {
      vz.normalize(); vx.crossVectors(vy, vz).normalize(); vy.crossVectors(vz, vx)
      m4.makeBasis(vx, vy, vz)
      tq.setFromRotationMatrix(m4)
      if (oriented.current) root.current.quaternion.slerp(tq, k)
      else { root.current.quaternion.copy(tq); oriented.current = true }
    }
    if (b.phase === 'dying') root.current.rotateY(dt * 8)

    // cara: parpadeo, cejas, boca, rubor, sudor y pupilas
    const blink = (t * 0.9 + phase0) % 4 < 0.12 ? 0.1 : 1
    for (const e of [eyeL, eyeR]) e.current.scale.set(1, Math.max(0.08, c.eye * blink), 0.5)
    browL.current.rotation.z = -c.brow; browR.current.rotation.z = c.brow
    browL.current.position.y = browR.current.position.y = 0.5 + (c.eye - 1) * 0.15
    mouth.current.scale.set(1, c.mouth, 1)
    for (const m of blush.current.children) m.material.opacity = c.blush * 0.7
    sweat.current.visible = c.sweat > 0.5
    pupils.current.position.set(0, c.eye < 0.5 ? -0.03 : 0, 0.07)

    if (ring.current) { ring.current.visible = selected; ring.current.rotation.z = t * 2 }
  })

  const talking = b.thought && b.thought.until > sim.t
  return (
    <group ref={root} onClick={(e) => (e.stopPropagation(), onSelect(b))} onPointerOver={() => (document.body.style.cursor = 'pointer')} onPointerOut={() => (document.body.style.cursor = '')}>
      {/* zona de clic generosa; sin sombra */}
      <mesh><sphereGeometry args={[r * 2.2, 8, 6]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
      <mesh scale={r} castShadow><sphereGeometry args={[1, 28, 20]} /><meshStandardMaterial color={color} roughness={0.35} /></mesh>
      <group scale={r}>
        {[-1, 1].map((sg) => (
          <group key={sg}>
            <mesh ref={sg < 0 ? eyeL : eyeR} position={[sg * 0.36, 0.2, 0.88]} scale={[1, 1, 0.5]}>
              <sphereGeometry args={[eyeSize + 0.07, 14, 12]} /><meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh ref={sg < 0 ? browL : browR} position={[sg * 0.36, 0.5, 0.86]}>
              <boxGeometry args={[0.34, 0.06, 0.06]} /><meshBasicMaterial color="#2a2140" />
            </mesh>
          </group>
        ))}
        <group ref={pupils}>
          {[-1, 1].map((sg) => <mesh key={sg} position={[sg * 0.36, 0.2, 0.99]}><sphereGeometry args={[0.07, 8, 8]} /><meshBasicMaterial color="#1a1030" /></mesh>)}
        </group>
        <group position={[0, -0.2, 0.93]} ref={mouth}>
          <mesh rotation={[0, 0, Math.PI]}><torusGeometry args={[0.2, 0.035, 6, 16, Math.PI]} /><meshBasicMaterial color="#2a1030" /></mesh>
        </group>
        <group ref={blush}>
          {[-1, 1].map((sg) => (
            <mesh key={sg} position={[sg * 0.6, -0.02, 0.78]} rotation={[0, sg * 0.75, 0]}>
              <circleGeometry args={[0.13, 12]} /><meshBasicMaterial color="#ff6f91" transparent opacity={0} depthWrite={false} />
            </mesh>
          ))}
        </group>
        <mesh ref={sweat} position={[0.72, 0.62, 0.5]}><sphereGeometry args={[0.09, 8, 8]} /><meshBasicMaterial color="#7fd8ff" /></mesh>
      </group>
      <mesh ref={ring} position={[0, -r * 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} visible={false}>
        <torusGeometry args={[r * 1.3, 0.012, 6, 32]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.55} toneMapped={false} />
      </mesh>
      {(selected || talking) && (
        <Html position={[0, r + 0.35, 0]} center distanceFactor={6} zIndexRange={[20, 10]} style={{ pointerEvents: 'none', maxWidth: 140 }}>
          <div className="bubble" style={{ borderColor: color.getStyle(), maxWidth: 140, fontSize: 11 }}>
            {selected && <b>{b.name}</b>}
            {talking && <span>{b.thought.emoji} {b.thought.text}</span>}
            {selected && !talking && <span>{FACES[b.mood]?.emoji} {b.mood}</span>}
          </div>
        </Html>
      )}
    </group>
  )
}
