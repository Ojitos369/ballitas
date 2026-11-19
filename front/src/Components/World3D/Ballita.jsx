import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { povView } from './povLook.js'
import { FACES } from '../../Core/personality.js'
import { actualizarDialogoVivo, obtenerGlobo } from '../../Core/dialogos.js'
import { BALL_R, laneFrame, laneRelief, wallFrame } from '../../Core/world.js'
import { terminalPulse } from './Nodes.jsx'
import WorldHtml from './WorldHtml.jsx'
import { nodoEnFoco } from './mundos/foco.js'
import {
  buildSkin,
  createClayBodyMaterial,
  GEO as SKIN_GEO,
  getBodyTexture,
  getChibiTextures,
  getEmotionTexture,
  getIrisTexture,
  retainIrisTex,
  releaseIrisTex,
  getMat as getSkinMat,
  SkinAccessory,
  SkinMouth,
} from './skins.js'

const m4 = new THREE.Matrix4()
const tq = new THREE.Quaternion()
const vx = new THREE.Vector3()
const vy = new THREE.Vector3()
const vz = new THREE.Vector3()
const vTmp = new THREE.Vector3()
const frameFwd = new THREE.Vector3()
const prevDirMap = new WeakMap()
const smooth01 = (x) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c) }
const LANE_F = {}; const SHADOW_F = {}
const Y_UP = new THREE.Vector3(0, 1, 0)

// Sombra de contacto: disco suave pegado a la pista bajo la ballita (compartido por todas).
const SHADOW_GEO = new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2)
const SHADOW_MAT = (() => {
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null
  let map = null
  if (c) {
    c.width = c.height = 64
    const x = c.getContext('2d')
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    x.fillStyle = g; x.fillRect(0, 0, 64, 64)
    map = new THREE.CanvasTexture(c)
  }
  return new THREE.MeshBasicMaterial({ color: '#000000', alphaMap: map, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })
})()

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

// Geometrías compartidas entre todas las ballitas para rendimiento con decenas de instancias
const SHARED_GEO = {
  click: new THREE.SphereGeometry(1, 8, 6),
  body: SKIN_GEO.body,
  eye: new THREE.SphereGeometry(1, 18, 14),
  iris: SKIN_GEO.irisDisc,
  zenArc: new THREE.TorusGeometry(0.145, 0.028, 10, 22, Math.PI),
  stitchArm: new THREE.CapsuleGeometry(0.026, 0.22, 6, 12),
  brow: (() => {
    const g = new THREE.CapsuleGeometry(0.5, 1.8, 6, 12)
    g.rotateZ(Math.PI / 2)
    return g
  })(),
  catchlight: new THREE.SphereGeometry(1, 10, 8),
  sparkle: new THREE.PlaneGeometry(0.22, 0.22),
  blush: new THREE.PlaneGeometry(0.34, 0.24),
  sweat: new THREE.SphereGeometry(0.085, 10, 8),
  tongue: new THREE.SphereGeometry(0.065, 10, 8),
  limb: new THREE.SphereGeometry(1, 14, 12),
  ring: new THREE.TorusGeometry(1.3, 0.014, 6, 32),
  flash: new THREE.SphereGeometry(1, 12, 10),
  extOrb: new THREE.SphereGeometry(1, 14, 10),
}

let orbGlowTex = null
function getOrbGlowTex() {
  if (orbGlowTex) return orbGlowTex
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = 64
  c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 31)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.28, 'rgba(255,255,255,0.82)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  orbGlowTex = new THREE.CanvasTexture(c)
  orbGlowTex.needsUpdate = true
  return orbGlowTex
}

let sharedMats = null
function getSharedMats() {
  if (sharedMats) return sharedMats
  const chibi = getChibiTextures()
  sharedMats = {
    // Solo para el raycast (Mesh.raycast ignora visible): con opacidad 0 se dibujaba igual, una esfera 8×6 que
    // envuelve a la ballita a r·2,2 y que de cerca entraba en postFX/DoF como un octágono.
    click: new THREE.MeshBasicMaterial({ visible: false }),
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
    darkLine: new THREE.MeshBasicMaterial({ color: '#2c1328' }),
  }
  return sharedMats
}

const BUBBLE_WRAP = { pointerEvents: 'none' }
// dentro de un planeta (seguida en fase de planeta) solo habla la seguida: los bocadillos ajenos tapaban a otras ballitas
const OP_OTRA = { get value() { return nodoEnFoco() >= 0 ? 0 : 1 } }

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

// Una ballita 3D chibi con cara viva. Lee su estado de `sim` en cada frame.
export default function Ballita({ b, sim, selected, pov = false, follow = false, povMode = false, worldRadius = 110, onSelect }) {
  // El cursor 'pointer' no debe quedarse pegado si la ballita muere o entra POV bajo el puntero.
  useEffect(() => {
    if (pov || povMode) document.body.style.cursor = ''
    return () => { document.body.style.cursor = '' }
  }, [pov, povMode])
  const root = useRef(); const bodyGroup = useRef()
  const orbGroupRef = useRef(); const extOrbRef = useRef(); const extHaloRef = useRef()
  const eyeL = useRef(); const eyeR = useRef(); const zenEyesRef = useRef()
  const browL = useRef(); const browR = useRef(); const mouth = useRef()
  const blush = useRef(); const sweat = useRef(); const ring = useRef(); const pupils = useRef()
  const pupilL = useRef(); const pupilR = useRef()
  const sparkleL = useRef(); const sparkleR = useRef(); const tongue = useRef()
  const footL = useRef(); const footR = useRef(); const handL = useRef(); const handR = useRef()
  const flash = useRef(); const emoSprite = useRef()

  const cur = useRef({ eye: 1, brow: 0, mouth: 0.5, blush: 0.4, sweat: 0, bounce: 1, sparkle: 0.3 })
  const oriented = useRef(false)
  const tubeScaleRef = useRef(1)
  const dialogState = useRef({ init: false, nextCheck: 0 })
  const emoState = useRef({ kind: null, until: 0, start: 0, lastSeg: null, lastPhase: null })
  const microState = useRef({ nextWink: 5 + (b.id % 6), winkUntil: 0, nextBlep: 7 + (b.id % 5), blepUntil: 0 })
  // carril: aterrizaje (squash), inclinación en curvas y voltereta al cambiar de pared
  const laneFx = useRef({ squash: 0, lean: 0, air: 0, pitch: 0, up: new THREE.Vector3(0, 1, 0), prevT: new THREE.Vector3(), hasPrev: false, hadSw: false, wasAir: false })
  const shadow = useRef()

  const g = b.genome.traits
  const color = useMemo(() => bodyColor(b.genome), [b])
  const skin = useMemo(() => buildSkin(b.genome, b.arch), [b.genome, b.arch])
  const bodyTex = useMemo(() => getBodyTexture(skin), [skin])
  const bodyMat = useMemo(() => createClayBodyMaterial(bodyTex, 0.72), [bodyTex])
  const mats = useMemo(() => getSharedMats(), [])
  const chibiTex = useMemo(() => getChibiTextures(), [])

  const limbMat = useMemo(() => getSkinMat(skin.baseColor, 0.72, 0.02), [skin.baseColor])
  const blushMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: skin.blushColor,
    map: chibiTex.blush,
    transparent: true,
    opacity: 0.45,
    depthWrite: false,
  }), [skin.blushColor, chibiTex.blush])
  const irisMat = useMemo(() => new THREE.MeshBasicMaterial({
    map: getIrisTexture(skin.eyeStyle, skin.irisTop, skin.irisBot, skin.pupilColor),
    transparent: true,
    alphaTest: 0.08,
  }), [skin.eyeStyle, skin.irisTop, skin.irisBot, skin.pupilColor])
  // Retiene el iris mientras viva la ballita: la caché solo poda (y libera) los de ballitas muertas.
  useEffect(() => {
    const tex = irisMat.map
    retainIrisTex(tex)
    return () => releaseIrisTex(tex)
  }, [irisMat])
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
  const extOrbMat = useMemo(() => new THREE.MeshBasicMaterial({
    color: color.clone().multiplyScalar(1.85),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  }), [color])
  const extHaloMat = useMemo(() => new THREE.SpriteMaterial({
    map: getOrbGlowTex(),
    color: color.clone().multiplyScalar(1.9),
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  }), [color])

  const shadowMat = useMemo(() => SHADOW_MAT.clone(), []) // clon: opacidad propia, mismo alphaMap
  useEffect(() => () => shadowMat.dispose(), [shadowMat])

  const [nearCam, setNearCam] = useState(false)
  const nearCamRef = useRef(false)
  // POV de espalda (zoom con el cuerpo entero a la vista): se muestra su bocadillo; en ojos sigue oculto
  const [espalda, setEspalda] = useState(false)
  const espaldaRef = useRef(false)

  // Al seleccionarla (no al llegar la cámara) sube ya sus texturas: el primer cuadro de cerca no las espera.
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    if (!selected) return
    for (const m of [bodyMat, irisMat, blushMat, mats.eye, mats.sparkle, emoMat]) if (m.map) gl.initTexture(m.map)
  }, [selected, gl, bodyMat, irisMat, blushMat, mats, emoMat])

  useEffect(() => () => {
    bodyMat.dispose()
    blushMat.dispose()
    irisMat.dispose()
    browMat.dispose()
    flashMat.dispose()
    emoMat.dispose()
    extOrbMat.dispose()
    extHaloMat.dispose()
  }, [bodyMat, blushMat, irisMat, browMat, flashMat, emoMat, extOrbMat, extHaloMat])

  const r = BALL_R * (0.86 + g.apetito * 0.14)
  const eyeSize = 0.255 + g.sociabilidad * 0.065
  const irisR = Math.max(0.18, eyeSize * 0.78)
  const phase0 = b.id * 1.7
  const isCyclops = skin.eyeStyle === 'cyclops'
  const isZen = skin.eyeStyle === 'zen'
  const isAsym = skin.eyeStyle === 'asym'

  useFrame(({ camera, clock }, dt) => {
    const cdt = Math.min(dt, 0.1)
    const k = 1 - Math.exp(-9 * cdt)
    const t = clock.elapsedTime

    const rIntro = r * 14 + worldRadius * 0.12
    const rExter = r * 24 + worldRadius * 0.36
    const camDist = camera.position.distanceTo(b.pos)
    // Seguida o en POV: siempre el LOD detallado; el orbe lejano no debe acercarse a la cámara.
    const extFactor = (pov || follow || b.phase === 'gone') ? 0 : THREE.MathUtils.smoothstep(camDist, rIntro, rExter)
    const nextNear = nearCamRef.current ? camDist < 42 : camDist < 36
    if (nextNear !== nearCamRef.current) {
      nearCamRef.current = nextNear
      setNearCam(nextNear)
    }
    const nextEsp = Boolean(pov && povView.espalda)
    if (nextEsp !== espaldaRef.current) {
      espaldaRef.current = nextEsp
      setEspalda(nextEsp)
    }

    // 1. Expresión viva según evento y situación (solo si el cuerpo es visible o está seleccionada)
    const F = resolveExpression(b, g)
    const c = cur.current
    if (extFactor < 0.96 || selected) {
      for (const key of ['eye', 'brow', 'mouth', 'blush', 'sweat', 'bounce', 'sparkle']) {
        const target = F[key] ?? 0
        c[key] += (target - c[key]) * k
      }
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
    if (b.phase === 'travel' && b.flight) s *= b.vis ?? 1 // portal: desaparece y reaparece en el camino destino
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

    // 3a. Marco del carril (world.wallFrame): up hacia el eje del tubo, avance por la tangente
    const fx = laneFx.current
    let upV = b.up
    let fwdV = b.dir
    let flip = 0
    const sw = b.phase === 'travel' ? b.sw : null
    if (b.phase === 'travel' && b.seg?.lanes) {
      // Apoyada en su carril: normal y tangente reales de la superficie (relieve, vaivén y peralte);
      // en vuelo o en un mecanismo, el marco crudo del tubo en su ángulo actual.
      const onSurf = !sw && !b.airborne && b.onLane !== false && !b.seg.air
      const F = onSurf ? laneFrame(b.seg, b.lane, b.segT, LANE_F) : wallFrame(b.seg, b.ang ?? 0, b.segT, b.off ?? 0)
      // suavizado del up: girar con la pared sin marear
      if (fx.hasPrev) fx.up.lerp(F.up, k)
      else fx.up.copy(F.up)
      if (fx.up.lengthSq() < 1e-6) fx.up.copy(F.up)
      fx.up.normalize()
      frameFwd.copy(F.tangent)
      if (fx.hasPrev) {
        // inclinación hacia dentro de la curva (aceleración lateral ≈ giro de la tangente · velocidad)
        const turn = vTmp.copy(F.tangent).sub(fx.prevT).dot(F.side) / Math.max(cdt, 1e-3)
        const leanT = THREE.MathUtils.clamp(turn * (b.speed ?? 0) * 0.006, -0.55, 0.55)
        fx.lean += (leanT - fx.lean) * k
      }
      fx.prevT.copy(F.tangent)
      fx.hasPrev = true
      // squash al despegar de un mecanismo y al aterrizar en la pared
      if (sw && !fx.hadSw) fx.squash = 0.7
      if ((fx.hadSw && !sw) || (fx.wasAir && !b.seg.air)) fx.squash = 1
      fx.hadSw = Boolean(sw)
      fx.wasAir = Boolean(b.seg.air)
      upV = fx.up
      fwdV = frameFwd
      if (sw) {
        const x = smooth01(sw.t)
        if (sw.style === 'salto') flip = x * Math.PI * 2 // voltereta al cruzar el interior del tubo
        else if (sw.style === 'caida') flip = -x * Math.PI
        else if (sw.style === 'portal') s *= 1 - 0.85 * Math.sin(Math.PI * smooth01((sw.t - 0.3) / 0.4))
      }
    } else {
      fx.hasPrev = false
      fx.hadSw = false
      fx.wasAir = false
      fx.lean *= 1 - k
    }
    const travelling = b.phase === 'travel' && b.seg
    fx.squash = Math.max(0, fx.squash - cdt * 3.2, travelling ? (b.impact ?? 0) : 0) // aplasta al aterrizar / chocar
    fx.air += ((travelling && b.airborne && !sw ? 1 : 0) - fx.air) * k // se estira en el aire
    // se inclina con la pendiente: hacia delante al subir (esfuerzo), hacia atrás al bajar
    const pitchT = travelling && !sw ? THREE.MathUtils.clamp((b.slope ?? 0) * 0.6, -0.32, 0.32) : 0
    fx.pitch += (pitchT - fx.pitch) * k
    if (bodyGroup.current) bodyGroup.current.rotation.set(flip + fx.pitch, 0, fx.lean)

    // 3b. Squash & stretch elástico chibi
    const bob = Math.sin(t * 4.5 * c.bounce + phase0)
    const vs = s * tubeScale
    const speedStretch = b.speed > 0.5 ? 1 + Math.min(b.speed / 36, 0.32) : 1 + bob * 0.075 * c.bounce
    const side = 1 / Math.sqrt(speedStretch)
    const sqY = (1 - 0.32 * fx.squash) * (1 + 0.2 * fx.air)
    const sqXZ = (1 + 0.16 * fx.squash) * (1 - 0.08 * fx.air)
    root.current.scale.set(vs * side * sqXZ, vs * side * sqY, vs * speedStretch * sqXZ)

    // 3c. Sombra de contacto sobre la pista (se encoge y aclara con la altura del salto)
    if (shadow.current) {
      const seg = b.seg
      const showSh = travelling && !seg.air && !pov && extFactor < 0.96 && !(sw && sw.style !== 'pared')
      shadow.current.visible = showSh
      if (showSh) {
        const rel = laneRelief(seg, b.lane, b.segT)
        const h = Math.max(0, (b.hy ?? rel) - rel)
        const f = wallFrame(seg, b.ang ?? 0, b.segT, seg.radius - rel - 0.03, SHADOW_F)
        shadow.current.position.copy(f.pos)
        shadow.current.quaternion.setFromUnitVectors(Y_UP, f.up)
        shadow.current.scale.setScalar(r * tubeScale * (1.05 + h * 0.35) * s)
        shadow.current.material.opacity = 0.5 * (1 - smooth01(h / 2.2))
      }
    }

    const hop = b.phase === 'at' ? Math.abs(bob) * 0.14 * c.bounce : 0
    const wallOffset = (b.phase === 'travel' && !b.seg?.air) ? -(r * (1 - tubeScale)) : 0
    root.current.position.copy(b.pos).addScaledVector(upV, hop + wallOffset)

    // Si la ballita está en modo orbe lejano (cuerpo oculto y no seleccionada), omitir detalle facial/miembros.
    const bodyVisible = (!pov || povView.body) && (extFactor < 0.96 || selected)
    if (bodyGroup.current) bodyGroup.current.visible = bodyVisible
    if (orbGroupRef.current) {
      const showOrb = extFactor > 0.015 && s > 0.02
      orbGroupRef.current.visible = showOrb
      if (showOrb) {
        orbGroupRef.current.position.copy(b.pos)
        if (b.phase !== 'travel') orbGroupRef.current.position.addScaledVector(b.up, r * 0.85)
        const distBoost = 1 + THREE.MathUtils.clamp((camDist - 70) / 140, 0, 1.35)
        const maxTubeOrb = b.phase === 'travel' ? (b.seg?.radius ?? 1.25) * 0.88 : r * 2.5
        const orbR = Math.min(maxTubeOrb, r * (1.25 + 0.65 * extFactor) * distBoost) * s
        if (extOrbRef.current) extOrbRef.current.scale.setScalar(orbR)
        if (extHaloRef.current) {
          const haloS = orbR * (3.6 + THREE.MathUtils.clamp(camDist / 70, 0, 3.4))
          extHaloRef.current.scale.set(haloS, haloS, 1)
        }
        extOrbMat.opacity = extFactor * 0.96
        extHaloMat.opacity = extFactor * 0.86
      }
    }
    if (ring.current) { const on = selected && !pov && !follow; ring.current.visible = on; if (on) ring.current.rotation.z = t * 2 } // sin anillo al seguir: vista limpia
    if (!bodyVisible && !selected) {
      if (emoSprite.current) emoSprite.current.visible = false
      return
    }

    // 4. Orientación suave
    vy.copy(upV)
    vz.copy(fwdV).addScaledVector(vy, -fwdV.dot(vy))
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
    let lookX = THREE.MathUtils.clamp(-vTmp.dot(vx) * 0.45, -0.05, 0.05)
    let lookY = THREE.MathUtils.clamp(vTmp.dot(vy) * 0.35, -0.035, 0.035)
    if (b.speed < 0.4) {
      lookX += Math.sin(t * 1.1 + phase0) * 0.03
      lookY += Math.cos(t * 0.8 + phase0) * 0.018
    }

    const zenClosed = isZen && c.eye < 1.28 && b.mood !== 'asustada'
    if (zenEyesRef.current) zenEyesRef.current.visible = zenClosed

    const eyeScaleYL = Math.max(0.08, c.eye * blink * (isWinking ? 0.12 : 1))
    const eyeScaleYR = Math.max(0.08, c.eye * blink)
    const eyeRBase = eyeSize + 0.045

    if (eyeL.current) {
      eyeL.current.visible = !zenClosed
      eyeL.current.scale.set(
        eyeRBase * skin.eyeScaleX * skin.eyeAsym[0],
        eyeRBase * eyeScaleYL * skin.eyeScaleY * skin.eyeAsym[0],
        eyeRBase * 0.52,
      )
    }
    if (eyeR.current) {
      eyeR.current.visible = !zenClosed && !isCyclops && !isAsym
      eyeR.current.scale.set(
        eyeRBase * skin.eyeScaleX * skin.eyeAsym[1],
        eyeRBase * eyeScaleYR * skin.eyeScaleY * skin.eyeAsym[1],
        eyeRBase * 0.52,
      )
    }

    if (pupils.current) {
      pupils.current.visible = !zenClosed
      if (F.dizzy) {
        const spin = t * 8
        pupils.current.position.set(Math.cos(spin) * 0.04, Math.sin(spin) * 0.04, 0.065)
      } else {
        pupils.current.position.set(lookX, (c.eye < 0.5 ? -0.022 : 0) + lookY, 0.065)
      }
    }
    if (pupilL.current) pupilL.current.scale.set(1, Math.max(0.15, blink * (isWinking ? 0.18 : 1)), 1)
    if (pupilR.current) {
      pupilR.current.visible = !isCyclops && !isAsym
      pupilR.current.scale.set(1, Math.max(0.15, blink), 1)
    }

    const spVis = c.sparkle > 0.35 && blink > 0.5 && !zenClosed
    const spPulse = 0.85 + Math.sin(t * 7 + phase0) * 0.25
    if (sparkleL.current) {
      sparkleL.current.visible = spVis && !isWinking
      sparkleL.current.scale.setScalar(c.sparkle * spPulse)
    }
    if (sparkleR.current) {
      sparkleR.current.visible = spVis && !isCyclops && !isAsym
      sparkleR.current.scale.setScalar(c.sparkle * spPulse)
    }

    if (browL.current) {
      browL.current.rotation.z = -c.brow - skin.browBaseTilt
      browL.current.position.y = (isCyclops ? 0.54 : 0.47) + (c.eye - 1) * 0.12
    }
    if (browR.current) {
      browR.current.visible = !isCyclops
      browR.current.rotation.z = c.brow + skin.browBaseTilt
      browR.current.position.y = 0.47 + (c.eye - 1) * 0.12
    }

    mouth.current.scale.set(skin.mouthWidth, Math.max(0.25, Math.abs(c.mouth) + 0.15), 1)
    if (tongue.current) tongue.current.visible = isBlep
    blushMat.opacity = Math.min(0.92, Math.max(0.18, c.blush * 0.78 * skin.blushBoost))
    sweat.current.visible = c.sweat > 0.5

    // 7. Animación de patitas y manitas chibi
    const walking = b.phase === 'toDest' || b.phase === 'toPort'
    const rolling = b.phase === 'travel'
    const stride = walking ? Math.sin(t * 14 + phase0) * 0.22 : (b.phase === 'at' ? Math.abs(bob) * 0.12 : 0)
    if (footL.current && footR.current) {
      const tuck = rolling ? 0.55 : 1
      footL.current.position.set(-0.34, -0.9 * tuck + (walking ? Math.max(0, stride) * 0.4 : stride * 0.3), 0.22 + (walking ? stride : rolling ? -0.3 : 0))
      footR.current.position.set(0.34, -0.9 * tuck + (walking ? Math.max(0, -stride) * 0.4 : stride * 0.3), 0.22 + (walking ? -stride : rolling ? -0.3 : 0))
    }
    if (handL.current && handR.current) {
      const wave = F === CHIBI_FACES.alegria || F === CHIBI_FACES.risa ? Math.sin(t * 10 + phase0) * 0.22 : 0
      if (skin.hasPrayerHands && !rolling) {
        handL.current.position.set(-0.085, -0.22 + Math.abs(wave) * 0.25, 0.94)
        handR.current.position.set(0.085, -0.22 + Math.abs(wave) * 0.25, 0.94)
      } else if (skin.hasDrumstick && !rolling) {
        handL.current.position.set(-0.24, -0.28, 0.91)
        handR.current.position.set(0.22, -0.24, 0.92)
      } else {
        handL.current.position.set(-0.82, -0.18 + Math.abs(wave), 0.38 - (rolling ? 0.28 : 0))
        handR.current.position.set(0.82, -0.18 + Math.abs(wave), 0.38 - (rolling ? 0.28 : 0))
      }
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
      if (t < es.until && !pov) {
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
  })

  const liveThought = obtenerGlobo(b, sim)
  const talking = liveThought && liveThought.until > sim.t
  const eyeX = isCyclops ? 0 : 0.34
  const eyeY = isCyclops ? 0.16 : 0.13

  return (
    <>
    <group
      ref={root}
      onClick={(e) => { if (!pov && !povMode) { e.stopPropagation(); onSelect(b) } }}
      onPointerOver={() => { if (!pov && !povMode) document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { if (!pov && !povMode) document.body.style.cursor = '' }}
    >
      {/* zona de clic generosa; sin sombra */}
      <mesh geometry={SHARED_GEO.click} material={mats.click} scale={r * 2.2} visible={!pov && !povMode} />
      <group ref={bodyGroup} scale={r} visible={!pov}>
        <mesh geometry={SHARED_GEO.body} material={bodyMat} scale={skin.bodyScale} castShadow />

        {/* Ojos chibi grandes con iris degradado y doble reflejo */}
        <mesh
          ref={eyeL}
          geometry={SHARED_GEO.eye}
          material={mats.eye}
          position={[-eyeX, eyeY, 0.85]}
          scale={[1, 1, 0.55]}
        />
        <mesh
          ref={browL}
          geometry={SHARED_GEO.brow}
          material={browMat}
          position={[-eyeX, 0.47, 0.86]}
          scale={[0.17, skin.browThick * 0.72, 0.045]}
        />
        <mesh
          ref={eyeR}
          geometry={SHARED_GEO.eye}
          material={mats.eye}
          position={[0.34, 0.13, 0.85]}
          scale={[1, 1, 0.55]}
        />
        <mesh
          ref={browR}
          geometry={SHARED_GEO.brow}
          material={browMat}
          position={[0.34, 0.47, 0.86]}
          scale={[0.17, skin.browThick * 0.72, 0.045]}
        />

        {/* Ojos cerrados serenos (Monje zen) */}
        <group ref={zenEyesRef} visible={isZen}>
          {[-1, 1].map((sg) => (
            <mesh
              key={sg}
              geometry={SHARED_GEO.zenArc}
              material={mats.darkLine}
              position={[sg * 0.34, 0.14, 0.94]}
              rotation={[0, sg * 0.24, Math.PI]}
            />
          ))}
        </group>

        {/* Ojo derecho cosido en X (Zombi asimétrico) */}
        {isAsym && (
          <group position={[0.35, 0.13, 0.94]} rotation={[0, 0.25, 0]}>
            <mesh geometry={SHARED_GEO.stitchArm} material={mats.darkLine} rotation={[0, 0, Math.PI / 4]} />
            <mesh geometry={SHARED_GEO.stitchArm} material={mats.darkLine} rotation={[0, 0, -Math.PI / 4]} />
          </group>
        )}

        {/* Iris degradado, pupila, doble reflejo y sparkle */}
        <group ref={pupils}>
          <group ref={pupilL} position={[-eyeX, eyeY, 0.985]} rotation={[0, isCyclops ? 0 : -0.24, 0]}>
            <mesh geometry={SHARED_GEO.iris} material={irisMat} scale={irisR * (isCyclops ? 1.32 : 1)} />
            {skin.hasCatchlight && (
              <>
                <mesh
                  geometry={SHARED_GEO.catchlight}
                  material={mats.catchlight}
                  position={[-0.045, 0.055, irisR * 0.3]}
                  scale={[irisR * 0.34, irisR * 0.28, irisR * 0.15]}
                />
                <mesh
                  geometry={SHARED_GEO.catchlight}
                  material={mats.catchlight}
                  position={[0.04, -0.048, irisR * 0.3]}
                  scale={irisR * 0.15}
                />
              </>
            )}
            <mesh
              ref={sparkleL}
              geometry={SHARED_GEO.sparkle}
              material={mats.sparkle}
              position={[0.05, 0.05, irisR * 0.36]}
            />
          </group>
          <group ref={pupilR} position={[0.34, 0.13, 0.985]} rotation={[0, 0.24, 0]}>
            <mesh geometry={SHARED_GEO.iris} material={irisMat} scale={irisR} />
            {skin.hasCatchlight && (
              <>
                <mesh
                  geometry={SHARED_GEO.catchlight}
                  material={mats.catchlight}
                  position={[-0.045, 0.055, irisR * 0.3]}
                  scale={[irisR * 0.34, irisR * 0.28, irisR * 0.15]}
                />
                <mesh
                  geometry={SHARED_GEO.catchlight}
                  material={mats.catchlight}
                  position={[0.04, -0.048, irisR * 0.3]}
                  scale={irisR * 0.15}
                />
              </>
            )}
            <mesh
              ref={sparkleR}
              geometry={SHARED_GEO.sparkle}
              material={mats.sparkle}
              position={[0.05, 0.05, irisR * 0.36]}
            />
          </group>
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
              position={[sg * 0.56, -0.09, 0.8]}
              rotation={[0, sg * 0.68, 0]}
              scale={skin.cheekPuff}
            />
          ))}
        </group>

        {/* Gota de sudor */}
        <mesh ref={sweat} geometry={SHARED_GEO.sweat} material={mats.sweat} position={[0.72, 0.58, 0.5]} />

        {/* Pequeñas patitas y manitas chibi redondeadas */}
        <mesh ref={footL} geometry={SHARED_GEO.limb} material={limbMat} position={[-0.34, -0.9, 0.22]} scale={[0.18, 0.12, 0.22]} />
        <mesh ref={footR} geometry={SHARED_GEO.limb} material={limbMat} position={[0.34, -0.9, 0.22]} scale={[0.18, 0.12, 0.22]} />
        <mesh ref={handL} geometry={SHARED_GEO.limb} material={limbMat} position={[-0.82, -0.18, 0.38]} scale={[0.13, 0.13, 0.15]} />
        <mesh ref={handR} geometry={SHARED_GEO.limb} material={limbMat} position={[0.82, -0.18, 0.38]} scale={[0.13, 0.13, 0.15]} />

        {/* Accesorios del skin */}
        <SkinAccessory skin={skin} />
      </group>

      {/* Sprite de emoción sobre la cabeza */}
      <sprite ref={emoSprite} material={emoMat} visible={false} />

      <mesh ref={ring} geometry={SHARED_GEO.ring} material={mats.ring} position={[0, -r * 0.98, 0]} rotation={[Math.PI / 2, 0, 0]} scale={r} visible={false} />
      <mesh ref={flash} geometry={SHARED_GEO.flash} material={flashMat} visible={false} />

      {/* solo el diálogo, encima de la cabeza: nombre y ánimo ya están en la ficha y tapaban a la ballita */}
      {talking && ((selected && (follow || espalda)) || (nearCam && !pov)) && (
        // Tamaño fijo en pantalla (≥ 11 px reales, máx. 2 líneas): con distanceFactor quedaba una píldora de 8 px ilegible.
        <WorldHtml position={[0, 0, 0]} sobre={r * 1.05} center zIndexRange={[20, 10]} style={BUBBLE_WRAP} className="globo-wrap" opacity={selected ? undefined : OP_OTRA}>
          <div className={`bubble globo${selected ? '' : ' otra'}`} style={{ borderColor: color.getStyle() }}>
            <span>{liveThought.emoji} {liveThought.text}</span>
          </div>
        </WorldHtml>
      )}
    </group>
    <mesh ref={shadow} geometry={SHADOW_GEO} material={shadowMat} visible={false} raycast={() => null} renderOrder={1} />
    <group ref={orbGroupRef} visible={false}>
      <mesh
        ref={extOrbRef}
        geometry={SHARED_GEO.extOrb}
        material={extOrbMat}
        onClick={(e) => { if (!pov && !povMode) { e.stopPropagation(); onSelect(b) } }}
        onPointerOver={() => { if (!pov && !povMode) document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { if (!pov && !povMode) document.body.style.cursor = '' }}
      />
      <sprite ref={extHaloRef} material={extHaloMat} raycast={() => null} />
    </group>
    </>
  )
}
