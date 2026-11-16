import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { FACES } from '../../Core/personality.js'
import { actualizarDialogoVivo, obtenerGlobo } from '../../Core/dialogos.js'
import { BALL_R } from '../../Core/world.js'
import { terminalPulse } from './Nodes.jsx'
import {
  buildSkin,
  getBodyTexture,
  getChibiTextures,
  getEmotionTexture,
  SkinAccessory,
  SkinMouth,
} from './skins.js'

const m4 = new THREE.Matrix4()
const tq = new THREE.Quaternion()
const vx = new THREE.Vector3()
const vy = new THREE.Vector3()
const vz = new THREE.Vector3()
const vTmp = new THREE.Vector3()
const prevDirMap = new WeakMap()

// Expresiones chibi extendidas (heredan FACES y añaden emociones por evento/situación)
const CHIBI_FACES = {
  ...FACES,
  miedo: { eye: 1.42, brow: -0.75, mouth: -0.9, blush: 0.1, sweat: 1, bounce: 1.1, sparkle: 0.1, happyArc: 0 },
  risa: { eye: 0.25, brow: 0.2, mouth: 1.15, blush: 0.95, sweat: 0, bounce: 1.7, sparkle: 0.9, happyArc: 1 },
  mareo: { eye: 0.55, brow: -0.35, mouth: -0.35, blush: 0.2, sweat: 1, bounce: 0.5, sparkle: 0, happyArc: 0, dizzy: 1 },
  asombro: { eye: 1.45, brow: 0.35, mouth: 0.45, blush: 0.45, sweat: 0, bounce: 1.35, sparkle: 1.0, happyArc: 0 },
  concentracion: { eye: 0.62, brow: -0.42, mouth: 0.18, blush: 0.15, sweat: 0, bounce: 0.6, sparkle: 0.25, happyArc: 0 },
  alegria: { eye: 1.18, brow: 0.12, mouth: 1.0, blush: 0.85, sweat: 0, bounce: 1.55, sparkle: 0.85, happyArc: 0.3 },
}

// Geometrías compartidas entre todas las bollitas para rendimiento con decenas de instancias
const SHARED_GEO = {
  click: new THREE.SphereGeometry(1, 8, 6),
  body: new THREE.SphereGeometry(1, 24, 18),
  eye: new THREE.SphereGeometry(1, 14, 12),
  brow: new THREE.BoxGeometry(0.32, 1, 0.06),
  pupil: new THREE.SphereGeometry(1, 10, 8),
  catchlight: new THREE.SphereGeometry(1, 6, 6),
  sparkle: new THREE.PlaneGeometry(0.24, 0.24),
  blush: new THREE.PlaneGeometry(0.32, 0.22),
  sweat: new THREE.SphereGeometry(0.085, 8, 8),
  tongue: new THREE.SphereGeometry(0.065, 8, 6),
  limb: new THREE.SphereGeometry(1, 8, 8),
  ring: new THREE.TorusGeometry(1.3, 0.014, 6, 32),
  flash: new THREE.SphereGeometry(1, 12, 10),
}

let sharedMats = null
function getSharedMats() {
  if (sharedMats) return sharedMats
  const chibi = getChibiTextures()
  sharedMats = {
    click: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    eye: new THREE.MeshBasicMaterial({ color: '#ffffff', map: chibi.eye }),
    catchlight: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    sparkle: new THREE.MeshBasicMaterial({
      color: '#ffffff',
      map: chibi.sparkle,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
    sweat: new THREE.MeshBasicMaterial({ color: '#7fd8ff' }),
    tongue: new THREE.MeshBasicMaterial({ color: '#ff7aa2' }),
    ring: new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, toneMapped: false }),
  }
  return sharedMats
}

export function bodyColor(g) {
  return new THREE.Color().setHSL(g.hue, 0.75, 0.6)
}

function findTerminalVert(node, way, kind) {
  if (!node || !way) return null
  if (Array.isArray(node.terminals) && node.terminals.length > 0) {
    const t = node.terminals.find((x) => x.kind === kind && x.way === way)
      || node.terminals.find((x) => x.kind === kind && x.to === (kind === 'out' ? way.to : way.from))
    if (t) return t.vert
  }
  const p = node.portTo?.[kind === 'out' ? way.to : way.from]
  return p ? p[kind] : null
}

function pulseTerminal(nodeIdx, vertIdx, kind, power, t) {
  if (nodeIdx == null || vertIdx == null) return
  const key = `${nodeIdx}:${vertIdx}:${kind}`
  const prev = terminalPulse.get(key)
  if (prev) {
    if (t - prev.at > 0.1 || power > prev.power) { prev.power = power; prev.at = t }
  } else {
    terminalPulse.set(key, { power, at: t })
  }
}

function resolveExpression(b, g) {
  if (b.phase === 'travel' && b.seg) {
    const k = b.seg.event || b.seg.kind
    if (k === 'caida') return g.valentia > 0.72 ? CHIBI_FACES.asombro : CHIBI_FACES.miedo
    if (k === 'trampolin') return CHIBI_FACES.risa
    if (k === 'rizo' || k === 'embudo' || k === 'sacacorchos' || k === 'espiral') return CHIBI_FACES.mareo
    if (k === 'geiser' || k === 'erupcion' || k === 'cascada' || k === 'canon' || k === 'portal') return CHIBI_FACES.asombro
    if (k === 'hielo_resbaloso' || k === 'turbina') return CHIBI_FACES.euforica
    if (k === 'pantano' || (b.seg.speedK != null && b.seg.speedK < 0.85) || b.route?.profile?.speed === 'lenta') {
      return CHIBI_FACES.concentracion
    }
    if (k === 'llegada') return CHIBI_FACES.alegria
    if (b.seg.air || b.seg.risk >= 0.7) {
      return g.valentia > 0.5 ? CHIBI_FACES.euforica : CHIBI_FACES.miedo
    }
  }
  if (b.phase === 'at' || b.react?.mood === 'euforica') return CHIBI_FACES.alegria
  if (b.phase === 'toPort') return CHIBI_FACES.concentracion
  return CHIBI_FACES[b.mood] ?? CHIBI_FACES.feliz
}

// Una bollita 3D chibi con cara viva. Lee su estado de `sim` en cada frame.
export default function Bollita({ b, sim, selected, onSelect }) {
  const root = useRef(); const bodyGroup = useRef()
  const eyeL = useRef(); const eyeR = useRef()
  const browL = useRef(); const browR = useRef(); const mouth = useRef()
  const blush = useRef(); const sweat = useRef(); const ring = useRef(); const pupils = useRef()
  const sparkleL = useRef(); const sparkleR = useRef(); const tongue = useRef()
  const footL = useRef(); const footR = useRef(); const handL = useRef(); const handR = useRef()
  const flash = useRef(); const emoSprite = useRef()

  const cur = useRef({ eye: 1, brow: 0, mouth: 0.5, blush: 0.4, sweat: 0, bounce: 1, sparkle: 0.3 })
  const oriented = useRef(false)
  const tubeScaleRef = useRef(1)
  const dialogState = useRef({ init: false, nextCheck: 0 })
  const emoState = useRef({ kind: null, until: 0, start: 0, lastSeg: null, lastPhase: null })
  const microState = useRef({ nextWink: 5 + (b.id % 6), winkUntil: 0, nextBlep: 7 + (b.id % 5), blepUntil: 0 })

  const g = b.genome.traits
  const color = useMemo(() => bodyColor(b.genome), [b])
  const skin = useMemo(() => buildSkin(b.genome, b.arch), [b.genome, b.arch])
  const bodyTex = useMemo(() => getBodyTexture(skin), [skin])
  const mats = useMemo(() => getSharedMats(), [])
  const chibiTex = useMemo(() => getChibiTextures(), [])

  const limbMat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.45 }), [color])
  const blushMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: skin.blushColor,
    map: chibiTex.blush,
    transparent: true,
    opacity: 0.4,
    depthWrite: false,
  }), [skin.blushColor, chibiTex.blush])
  const pupilMat = useMemo(() => new THREE.MeshBasicMaterial({ color: skin.pupilColor }), [skin.pupilColor])
  const browMat = useMemo(() => new THREE.MeshBasicMaterial({ color: skin.browColor }), [skin.browColor])
  const flashMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#ffffff',
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), [])
  const emoMat = useMemo(() => new THREE.SpriteMaterial({
    map: getEmotionTexture('star'),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  }), [])

  const r = BALL_R * (0.86 + g.apetito * 0.14)
  // Ojos chibi más grandes y expresivos
  const eyeSize = 0.23 + g.sociabilidad * 0.08
  const pupilR = Math.max(0.085, skin.pupilSize * 1.45)
  const phase0 = b.id * 1.7

  useFrame(({ clock }, dt) => {
    const cdt = Math.min(dt, 0.1)
    const k = 1 - Math.exp(-9 * cdt)
    const t = clock.elapsedTime

    // 1. Expresión viva según evento y situación
    const F = resolveExpression(b, g)
    const c = cur.current
    for (const key of ['eye', 'brow', 'mouth', 'blush', 'sweat', 'bounce', 'sparkle']) {
      const target = F[key] ?? 0
      c[key] += (target - c[key]) * k
    }

    // 2. Tamaño dentro de tubos (~0.55x) con transición suave
    const targetTubeScale = b.phase === 'travel' ? 0.55 : 1
    tubeScaleRef.current += (targetTubeScale - tubeScaleRef.current) * k
    const tubeScale = tubeScaleRef.current

    let s = 1
    let flashP = 0
    if (b.phase === 'born') { const x = 1 - b.timer / b.dur; s = x * (1 + Math.sin(x * Math.PI) * 0.35) }
    if (b.phase === 'dying') s = Math.max(0, b.timer / 1.4)
    if (b.phase === 'toPort' && b.way) {
      const node = sim.world.nodes[b.node]
      const vert = findTerminalVert(node, b.way, 'out')
      if (vert != null && b.pos.distanceToSquared(node.verts[vert].pos) < 18) {
        pulseTerminal(b.node, vert, 'out', 1, t)
      }
    }
    if (b.phase === 'travel' && b.seg) {
      if (b.seg.kind === 'salida' && b.segT < 0.35) {
        const vert = findTerminalVert(sim.world.nodes[b.way.from], b.way, 'out')
        pulseTerminal(b.way.from, vert, 'out', 1, t)
        if (b.segT < 0.22) {
          const p = b.segT / 0.22
          s = 0.45 + 0.55 * p + Math.sin(p * Math.PI) * 0.28
        }
        if (b.segT < 0.18) flashP = 1 - b.segT / 0.18
      } else if (b.seg.kind === 'llegada' && b.segT > 0.5) {
        const vert = findTerminalVert(sim.world.nodes[b.way.to], b.way, 'in')
        pulseTerminal(b.way.to, vert, 'in', 1, t)
        if (b.segT > 0.72) {
          const p = (b.segT - 0.72) / 0.28
          s = Math.max(0.25, 1 - p * 0.75)
        }
      }
    }
    if (b.phase === 'toDest' && b.snap > 0) {
      const p = 1 - Math.min(1, b.snap / 0.3)
      s = 0.4 + 0.6 * p
      if (b.walk?.i === 0) pulseTerminal(b.node, b.vert, 'in', 0.8, t)
    }

    if (flash.current) {
      flash.current.visible = flashP > 0.01
      if (flashP > 0.01) {
        const fs = r * tubeScale * (1.2 + (1 - flashP) * 2.2)
        flash.current.scale.setScalar(fs)
        flash.current.material.opacity = flashP * 0.75
      }
    }

    // 3. Squash & stretch elástico chibi
    const bob = Math.sin(t * 4.5 * c.bounce + phase0)
    const vs = s * tubeScale
    const speedStretch = b.speed > 0.5 ? 1 + Math.min(b.speed / 36, 0.32) : 1 + bob * 0.075 * c.bounce
    const side = 1 / Math.sqrt(speedStretch)
    root.current.scale.set(vs * side, vs * side, vs * speedStretch)

    // Rebote en destino y ajuste a pared en tubos al ser más pequeña
    const hop = b.phase === 'at' ? Math.abs(bob) * 0.14 * c.bounce : 0
    const wallOffset = (b.phase === 'travel' && !b.seg?.air) ? -(r * (1 - tubeScale)) : 0
    root.current.position.copy(b.pos).addScaledVector(b.up, hop + wallOffset)

    // 4. Orientación suave
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

    // 5. Microexpresiones aleatorias (parpadeo, guiño, mirar alrededor, lengua afuera)
    const ms = microState.current
    const blinkCycle = (t * 0.85 + phase0) % 4.2
    const blink = (blinkCycle < 0.11 || (blinkCycle > 0.22 && blinkCycle < 0.3 && (b.id % 3 === 0))) ? 0.08 : 1

    if (t > ms.nextWink) {
      ms.winkUntil = t + 0.38
      ms.nextWink = t + 6.5 + ((b.id * 1.37) % 5)
    }
    const isWinking = t < ms.winkUntil && b.mood !== 'asustada' && c.eye > 0.6

    if (t > ms.nextBlep) {
      ms.blepUntil = t + 0.9
      ms.nextBlep = t + 9.0 + ((b.id * 2.1) % 6)
    }
    const isBlep = (t < ms.blepUntil && (b.mood === 'feliz' || b.mood === 'euforica')) || F === CHIBI_FACES.risa

    // 6. Ojos siguen dirección de movimiento o miran alrededor cuando está quieta
    let prevDir = prevDirMap.get(b)
    if (!prevDir) {
      prevDir = b.dir.clone()
      prevDirMap.set(b, prevDir)
    }
    vTmp.copy(b.dir).sub(prevDir)
    prevDir.lerp(b.dir, Math.min(1, cdt * 6))
    let lookX = THREE.MathUtils.clamp(-vTmp.dot(vx) * 0.45, -0.055, 0.055)
    let lookY = THREE.MathUtils.clamp(vTmp.dot(vy) * 0.35, -0.04, 0.04)
    if (b.speed < 0.4) {
      lookX += Math.sin(t * 1.1 + phase0) * 0.035
      lookY += Math.cos(t * 0.8 + phase0) * 0.02
    }

    const eyeScaleYL = Math.max(0.08, c.eye * blink * (isWinking ? 0.12 : 1))
    const eyeScaleYR = Math.max(0.08, c.eye * blink)
    const eyeRBase = eyeSize + 0.05
    eyeL.current.scale.set(eyeRBase * skin.eyeScaleX * skin.eyeAsym[0], eyeRBase * eyeScaleYL * skin.eyeScaleY * skin.eyeAsym[0], eyeRBase * 0.52)
    eyeR.current.scale.set(eyeRBase * skin.eyeScaleX * skin.eyeAsym[1], eyeRBase * eyeScaleYR * skin.eyeScaleY * skin.eyeAsym[1], eyeRBase * 0.52)

    if (F.dizzy) {
      const spin = t * 8
      pupils.current.position.set(Math.cos(spin) * 0.045, Math.sin(spin) * 0.045, 0.07)
    } else {
      pupils.current.position.set(lookX, (c.eye < 0.5 ? -0.025 : 0) + lookY, 0.07)
    }

    const spVis = c.sparkle > 0.35 && blink > 0.5
    const spPulse = 0.85 + Math.sin(t * 7 + phase0) * 0.25
    if (sparkleL.current && sparkleR.current) {
      sparkleL.current.visible = spVis && !isWinking
      sparkleR.current.visible = spVis
      sparkleL.current.scale.setScalar(c.sparkle * spPulse)
      sparkleR.current.scale.setScalar(c.sparkle * spPulse)
    }

    browL.current.rotation.z = -c.brow - skin.browBaseTilt
    browR.current.rotation.z = c.brow + skin.browBaseTilt
    browL.current.position.y = browR.current.position.y = 0.46 + (c.eye - 1) * 0.13
    mouth.current.scale.set(skin.mouthWidth, Math.max(0.25, Math.abs(c.mouth) + 0.15), 1)
    if (tongue.current) tongue.current.visible = isBlep
    blushMat.opacity = Math.min(0.92, Math.max(0.15, c.blush * 0.78 * skin.blushBoost))
    sweat.current.visible = c.sweat > 0.5

    // 7. Animación de patitas y manitas chibi
    const walking = b.phase === 'toDest' || b.phase === 'toPort'
    const rolling = b.phase === 'travel'
    const stride = walking ? Math.sin(t * 14 + phase0) * 0.22 : (b.phase === 'at' ? Math.abs(bob) * 0.12 : 0)
    if (footL.current && footR.current) {
      const tuck = rolling ? 0.55 : 1
      footL.current.position.set(-0.34, -0.92 * tuck + (walking ? Math.max(0, stride) * 0.4 : stride * 0.3), 0.18 + (walking ? stride : rolling ? -0.3 : 0))
      footR.current.position.set(0.34, -0.92 * tuck + (walking ? Math.max(0, -stride) * 0.4 : stride * 0.3), 0.18 + (walking ? -stride : rolling ? -0.3 : 0))
    }
    if (handL.current && handR.current) {
      const wave = F === CHIBI_FACES.alegria || F === CHIBI_FACES.risa ? Math.sin(t * 10 + phase0) * 0.22 : 0
      handL.current.position.set(-0.92, -0.14 + Math.abs(wave), 0.22 - (rolling ? 0.25 : 0))
      handR.current.position.set(0.92, -0.14 + Math.abs(wave), 0.22 - (rolling ? 0.25 : 0))
    }

    // 8. Efectos sprite sobre la cabeza (corazón, estrella, gota, ¿?, !)
    const es = emoState.current
    if (b.phase === 'travel' && b.seg !== es.lastSeg) {
      es.lastSeg = b.seg
      const ev = b.seg?.event || b.seg?.kind
      let emoKind = null
      if (ev === 'geiser' || ev === 'erupcion' || ev === 'canon' || ev === 'portal' || ev === 'caida') emoKind = 'exclaim'
      else if (ev === 'trampolin' || ev === 'llegada') emoKind = 'star'
      else if (ev === 'pantano' || ev === 'cascada' || ev === 'hielo_resbaloso') emoKind = 'drop'
      else if (ev === 'embudo' || ev === 'rizo') emoKind = 'question'
      if (emoKind) {
        es.kind = emoKind
        es.start = t
        es.until = t + 1.15
        emoMat.map = getEmotionTexture(emoKind)
        emoMat.needsUpdate = true
      }
    } else if (b.phase !== es.lastPhase) {
      es.lastPhase = b.phase
      if (b.phase === 'at') {
        es.kind = 'heart'
        es.start = t
        es.until = t + 1.1
        emoMat.map = getEmotionTexture('heart')
        emoMat.needsUpdate = true
      }
      if (b.phase !== 'travel') es.lastSeg = null
    }

    if (emoSprite.current) {
      if (t < es.until) {
        const p = (t - es.start) / (es.until - es.start)
        emoSprite.current.visible = true
        emoSprite.current.position.set(0, r * (1.45 + p * 0.55), 0)
        const pop = Math.sin(Math.min(1, p * 3) * (Math.PI / 2)) * (1 - p * 0.25)
        emoSprite.current.scale.setScalar(r * 0.9 * pop)
        emoMat.opacity = p > 0.7 ? (1 - p) / 0.3 : 1
      } else {
        emoSprite.current.visible = false
      }
    }

    // 9. Diálogo vivo con memoria (throttled a ~8 Hz)
    if (t >= dialogState.current.nextCheck) {
      dialogState.current.nextCheck = t + 0.12
      actualizarDialogoVivo(b, sim, dialogState.current)
    }

    if (ring.current) { ring.current.visible = selected; ring.current.rotation.z = t * 2 }
  })

  const liveThought = obtenerGlobo(b, sim)
  const talking = liveThought && liveThought.until > sim.t

  return (
    <group
      ref={root}
      onClick={(e) => (e.stopPropagation(), onSelect(b))}
      onPointerOver={() => (document.body.style.cursor = 'pointer')}
      onPointerOut={() => (document.body.style.cursor = '')}
    >
      {/* zona de clic generosa; sin sombra */}
      <mesh geometry={SHARED_GEO.click} material={mats.click} scale={r * 2.2} />
      <group ref={bodyGroup} scale={r}>
        <mesh geometry={SHARED_GEO.body} castShadow>
          <meshStandardMaterial map={bodyTex} roughness={0.32} />
        </mesh>

        {/* Ojos chibi grandes y brillantes */}
        {[-1, 1].map((sg) => (
          <group key={sg}>
            <mesh
              ref={sg < 0 ? eyeL : eyeR}
              geometry={SHARED_GEO.eye}
              material={mats.eye}
              position={[sg * 0.35, 0.14, 0.86]}
              scale={[1, 1, 0.55]}
            />
            <mesh
              ref={sg < 0 ? browL : browR}
              geometry={SHARED_GEO.brow}
              material={browMat}
              position={[sg * 0.35, 0.46, 0.86]}
              scale={[1, skin.browThick, 1]}
            />
          </group>
        ))}

        {/* Pupilas con doble reflejo y sparkle */}
        <group ref={pupils}>
          {[-1, 1].map((sg) => (
            <group key={sg} position={[sg * 0.35, 0.14, 0.99]}>
              <mesh geometry={SHARED_GEO.pupil} material={pupilMat} scale={pupilR} />
              {skin.hasCatchlight && (
                <>
                  <mesh
                    geometry={SHARED_GEO.catchlight}
                    material={mats.catchlight}
                    position={[0.03, 0.036, pupilR * 0.72]}
                    scale={pupilR * 0.36}
                  />
                  <mesh
                    geometry={SHARED_GEO.catchlight}
                    material={mats.catchlight}
                    position={[-0.025, -0.028, pupilR * 0.74]}
                    scale={pupilR * 0.18}
                  />
                </>
              )}
              <mesh
                ref={sg < 0 ? sparkleL : sparkleR}
                geometry={SHARED_GEO.sparkle}
                material={mats.sparkle}
                position={[0.04, 0.04, pupilR * 0.86]}
              />
            </group>
          ))}
        </group>

        {/* Boquita chibi y lengüita */}
        <group position={[0, -0.18, 0.94]} ref={mouth}>
          <SkinMouth mouthType={skin.mouthType} />
          <mesh
            ref={tongue}
            geometry={SHARED_GEO.tongue}
            material={mats.tongue}
            position={[0, -0.055, 0.02]}
            scale={[0.85, 0.65, 0.5]}
            visible={false}
          />
        </group>

        {/* Mejillas rubor con textura */}
        <group ref={blush}>
          {[-1, 1].map((sg) => (
            <mesh
              key={sg}
              geometry={SHARED_GEO.blush}
              material={blushMat}
              position={[sg * 0.58, -0.06, 0.79]}
              rotation={[0, sg * 0.72, 0]}
            />
          ))}
        </group>

        {/* Gota de sudor */}
        <mesh ref={sweat} geometry={SHARED_GEO.sweat} material={mats.sweat} position={[0.72, 0.58, 0.5]} />

        {/* Pequeñas patitas y manitas chibi */}
        <mesh ref={footL} geometry={SHARED_GEO.limb} material={limbMat} position={[-0.34, -0.92, 0.18]} scale={[0.19, 0.12, 0.24]} />
        <mesh ref={footR} geometry={SHARED_GEO.limb} material={limbMat} position={[0.34, -0.92, 0.18]} scale={[0.19, 0.12, 0.24]} />
        <mesh ref={handL} geometry={SHARED_GEO.limb} material={limbMat} position={[-0.92, -0.14, 0.22]} scale={[0.13, 0.13, 0.15]} />
        <mesh ref={handR} geometry={SHARED_GEO.limb} material={limbMat} position={[0.92, -0.14, 0.22]} scale={[0.13, 0.13, 0.15]} />

        {/* Accesorios del skin */}
        <SkinAccessory skin={skin} />
      </group>

      {/* Sprite de emoción sobre la cabeza */}
      <sprite ref={emoSprite} material={emoMat} visible={false} />

      <mesh ref={ring} geometry={SHARED_GEO.ring} material={mats.ring} position={[0, -r * 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} scale={r} visible={false} />
      <mesh ref={flash} geometry={SHARED_GEO.flash} material={flashMat} visible={false} />

      {(selected || talking) && (
        <Html position={[0, r + 0.35, 0]} center distanceFactor={6} zIndexRange={[20, 10]} style={{ pointerEvents: 'none', maxWidth: 155 }}>
          <div className="bubble" style={{ borderColor: color.getStyle(), maxWidth: 155, fontSize: 11 }}>
            {selected && <b>{b.name}</b>}
            {talking && <span>{liveThought.emoji} {liveThought.text}</span>}
            {selected && !talking && <span>{FACES[b.mood]?.emoji} {b.mood}</span>}
          </div>
        </Html>
      )}
    </group>
  )
}
