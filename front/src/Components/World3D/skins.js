import { createElement as h } from 'react'
import * as THREE from 'three'
import { SKIN_PRESETS, skinFamily, traitProfile } from '../../Core/personality.js'
import { applyLoadedImage } from './texUtils.js'

// Los hijos se pasan como argumentos estáticos: evitar prop `key` en el objeto para prevenir colisiones.
const noKey = (props) => { const { key, ...p } = props || {}; return p }
const grp = (props, ...children) => h('group', noKey(props), ...children)
const msh = (props) => h('mesh', noKey(props))

// ══════════════════════════════════════════════════════════════════════════════
// CONTRATO DEL SISTEMA GENÉRICO DE SKINS (`SKIN_PARTS` + `generateSkin`)
// ══════════════════════════════════════════════════════════════════════════════
// 1. `SKIN_PARTS`: catálogo declarativo de piezas reutilizables agrupadas por ranura:
//    - body:       proporción/silueta corporal ('chibi_round' | 'chibi_plump' | 'chibi_tall' | 'chibi_tiny')
//    - hat:        tocados ('none' | 'conical_elf' | 'wizard' | 'beret' | 'hood' | 'bandana' | 'nightcap' | 'crown' | 'halo' | 'flower_crown' | 'bow' | 'brain')
//    - ears:       orejas/cuernos/antenas ('none' | 'cat' | 'elf' | 'bunny' | 'bear' | 'droopy' | 'horns' | 'antennae')
//    - hair:       flequillos/mechones ('none' | 'bangs_elf' | 'curls_mage' | 'tufts_zombie')
//    - eyes:       estilo ocular ('round' | 'rogue' | 'starry' | 'zen' | 'cyclops' | 'asym')
//    - brows:      cejas ('soft' | 'grumpy' | 'arched' | 'thick')
//    - mouth:      bocas ('curva' | 'w' | 'zigzag' | 'dientes' | 'open' | 'o')
//    - faceExtras: detalles faciales combinables ('patch' | 'scar' | 'stitch' | 'whiskers' | 'glasses' | 'visor' | 'freckles' | 'blush' | 'bandage' | 'crumbs')
//    - neckWear:   atuendo/cuello ('none' | 'bell_collar' | 'tunic_clasp' | 'mage_cloak' | 'pirate_coat' | 'tattered_bib' | 'monk_robe' | 'scarf' | 'bib')
//    - backExtras: colas/alas/mano/oreja ('cat_tail' | 'pom_tail' | 'devil_tail' | 'wings' | 'earring' | 'drumstick' | 'prayer_hands' | 'flower')
//    Cada pieza define `{ id, label, emoji, category, defaults: { scale, tilt, colorRole, ... } }`.
//
// 2. `generateSkin(genome, arch, options)`:
//    Recibe `genome` ({ hue, traits: { valentia, curiosidad, apetito, sociabilidad, animo, velocidad }, ... }),
//    opcionalmente `arch` ({ key, hi, title }) y `options` ({ preset?: string|null, pureProcedural?: boolean }).
//    Retorna un descriptor `skin` determinista por hash del genoma que contiene:
//    - `id`, `name`, `emoji`, `family` ({ id, name, emoji })
//    - `palette` (paleta armónica HSL derivada del genoma + ajuste por preset)
//    - `parts` (árbol estructurado con parámetros de cada pieza elegida: id, label, color, scale, tilt, side...)
//    - `partsSummary` (lista legible de piezas activas para UI)
//    - Campos planos retrocompatibles consumidos por `Bollita.jsx` y `Detail.jsx`
//      (`patternType`, `eyeStyle`, `irisTop`, `irisBot`, `pupilColor`, `mouthType`, `hatColor`, etc.).
//    Los 6 personajes de referencia (`elfa`, `gatita`, `maga`, `pirata`, `zombi`, `ascetica`) son presets
//    específicos dentro de este mismo catálogo genérico.
// ══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════ PRNG Y HASH DEL GENOMA ═══════════════════════════

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function mixHash(h, val) {
  const v = Math.round((val ?? 0) * 65535) >>> 0
  h ^= v
  h = Math.imul(h, 0x01000193) >>> 0
  return h
}

export function hashGenome(genome) {
  let h = 2166136261 >>> 0
  if (!genome) return h
  h = mixHash(h, genome.hue)
  const tr = genome.traits || {}
  for (const k of ['valentia', 'curiosidad', 'apetito', 'sociabilidad', 'animo', 'velocidad']) {
    h = mixHash(h, tr[k])
  }
  for (const arrKey of ['prefs', 'ways', 'routes', 'kinds']) {
    const arr = genome[arrKey]
    if (Array.isArray(arr)) {
      const step = Math.max(1, Math.floor(arr.length / 6))
      for (let i = 0; i < arr.length; i += step) h = mixHash(h, arr[i])
    }
  }
  return h >>> 0
}

// ═══════════════════════════ COLORES Y UTILIDADES HSL ═══════════════════════════

function wrapHue(h) {
  return ((h % 1) + 1) % 1
}

function clamp01(v) {
  return Math.max(0, Math.min(1, v))
}

function hslHex(h, s, l) {
  const c = new THREE.Color().setHSL(wrapHue(h), clamp01(s), clamp01(l))
  return `#${c.getHexString()}`
}

const BLUSH_COLORS = ['#ff7d9e', '#ff8fa3', '#ff758f', '#f472b6', '#fb7185']
const PATTERNS = ['degradado', 'atigrado', 'manchas', 'rayas', 'pecas', 'lunares', 'bicolor']
export const PATTERN_LABEL = {
  degradado: 'Degradado',
  atigrado: 'Atigrado',
  manchas: 'Manchas',
  rayas: 'Rayas',
  pecas: 'Pecas',
  lunares: 'Lunares',
  bicolor: 'Bicolor',
}

// ═══════════════════════════ CATÁLOGO `SKIN_PARTS` ═══════════════════════════

const part = (id, label, emoji, category, defaults = {}) => ({ id, label, emoji, category, defaults })

export const SKIN_PARTS = {
  body: {
    chibi_round: part('chibi_round', 'Cuerpo redondito', '⚪', 'body', { scale: [1, 0.98, 1], cheekPuff: 1.0 }),
    chibi_plump: part('chibi_plump', 'Cuerpo esponjoso', '🍡', 'body', { scale: [1.05, 0.96, 1.04], cheekPuff: 1.18 }),
    chibi_tall: part('chibi_tall', 'Cuerpo estilizado', '🫧', 'body', { scale: [0.96, 1.04, 0.97], cheekPuff: 0.95 }),
    chibi_tiny: part('chibi_tiny', 'Cuerpo compacto', '🍬', 'body', { scale: [0.98, 0.94, 0.98], cheekPuff: 1.05 }),
  },
  hat: {
    none: part('none', 'Sin sombrero', '✨', 'hat', { scale: 1, tilt: 0 }),
    conical_elf: part('conical_elf', 'Gorro élfico con pompón', '🧝', 'hat', { scale: 1, tilt: 0.12 }),
    wizard: part('wizard', 'Sombrero de maga estelar', '🧙', 'hat', { scale: 1, tilt: -0.08 }),
    beret: part('beret', 'Boina suave', '🥐', 'hat', { scale: 1, tilt: -0.22 }),
    hood: part('hood', 'Capucha acogedora', '🧥', 'hat', { scale: 1, tilt: 0 }),
    bandana: part('bandana', 'Pañuelo pirata', '🏴‍☠️', 'hat', { scale: 1, tilt: 0.08 }),
    nightcap: part('nightcap', 'Gorro de dormir', '🌙', 'hat', { scale: 1, tilt: 0.18 }),
    crown: part('crown', 'Corona real', '👑', 'hat', { scale: 1, tilt: 0 }),
    halo: part('halo', 'Halo luminoso', '😇', 'hat', { scale: 1, tilt: 0 }),
    flower_crown: part('flower_crown', 'Brote floral', '🌸', 'hat', { scale: 1, tilt: 0.1 }),
    bow: part('bow', 'Moño grande', '🎀', 'hat', { scale: 1, tilt: 0.12 }),
    brain: part('brain', 'Cerebro expuesto', '🧠', 'hat', { scale: 1, tilt: 0.15 }),
  },
  ears: {
    none: part('none', 'Sin orejas', '·', 'ears', { scale: 1, tilt: 0, droop: 0 }),
    cat: part('cat', 'Orejas de gato', '🐱', 'ears', { scale: 1, tilt: 0.08, droop: 0.1 }),
    elf: part('elf', 'Orejas puntiagudas', '🧝', 'ears', { scale: 1.05, tilt: 0.05, droop: 0.12 }),
    bunny: part('bunny', 'Orejas de conejo', '🐰', 'ears', { scale: 1.05, tilt: 0.1, droop: 0.25 }),
    bear: part('bear', 'Orejas de oso', '🐻', 'ears', { scale: 1, tilt: 0.04, droop: 0 }),
    droopy: part('droopy', 'Orejas caídas', '🐶', 'ears', { scale: 1, tilt: 0.12, droop: 0.65 }),
    horns: part('horns', 'Cuernitos curvos', '😈', 'ears', { scale: 0.95, tilt: 0.1, droop: 0 }),
    antennae: part('antennae', 'Antenitas estelares', '✨', 'ears', { scale: 1, tilt: 0.08, droop: 0 }),
  },
  hair: {
    none: part('none', 'Sin flequillo', '·', 'hair', { scale: 1 }),
    bangs_elf: part('bangs_elf', 'Flequillo élfico', '🌿', 'hair', { scale: 1 }),
    curls_mage: part('curls_mage', 'Rizos ondulados', '💜', 'hair', { scale: 1 }),
    tufts_zombie: part('tufts_zombie', 'Mechones despeinados', '🧟', 'hair', { scale: 1 }),
  },
  eyes: {
    round: part('round', 'Ojos redondos', '👀', 'eyes', { scaleX: 1, scaleY: 1 }),
    rogue: part('rogue', 'Ojos pícaros', '😏', 'eyes', { scaleX: 1.02, scaleY: 0.94 }),
    starry: part('starry', 'Ojos estrellados', '🤩', 'eyes', { scaleX: 1.06, scaleY: 1.06 }),
    zen: part('zen', 'Ojos zen serenos', '😌', 'eyes', { scaleX: 1, scaleY: 1 }),
    cyclops: part('cyclops', 'Ojo único gigante', '👁️', 'eyes', { scaleX: 1.42, scaleY: 1.42 }),
    asym: part('asym', 'Ojo cosido asimétrico', '🪡', 'eyes', { scaleX: 1.12, scaleY: 1.12 }),
  },
  brows: {
    soft: part('soft', 'Cejas suaves', '〰️', 'brows', { tilt: 0, thick: 0.055 }),
    grumpy: part('grumpy', 'Ceño fruncido', '😠', 'brows', { tilt: -0.34, thick: 0.07 }),
    arched: part('arched', 'Cejas arqueadas', '🤨', 'brows', { tilt: 0.16, thick: 0.058 }),
    thick: part('thick', 'Cejas expresivas', '✨', 'brows', { tilt: 0.04, thick: 0.075 }),
  },
  mouth: {
    curva: part('curva', 'Sonrisa dulce', '😊', 'mouth', { width: 0.95 }),
    w: part('w', 'Boquita :3', '😺', 'mouth', { width: 0.95 }),
    zigzag: part('zigzag', 'Boca gruñona', '😤', 'mouth', { width: 0.95 }),
    dientes: part('dientes', 'Colmillitos', '🧛', 'mouth', { width: 1.0 }),
    open: part('open', 'Sonrisa abierta', '😄', 'mouth', { width: 1.0 }),
    o: part('o', 'Boquita curiosa', '😮', 'mouth', { width: 0.85 }),
  },
  faceExtras: {
    patch: part('patch', 'Parche pirata', '🏴‍☠️', 'faceExtras', { scale: 1, side: -1, skull: true }),
    scar: part('scar', 'Cicatriz', '⚔️', 'faceExtras', { scale: 1, side: 1 }),
    stitch: part('stitch', 'Costuras', '🪡', 'faceExtras', { scale: 1, side: -1 }),
    whiskers: part('whiskers', 'Bigotes', '🐱', 'faceExtras', { scale: 1 }),
    glasses: part('glasses', 'Gafas redondas', '👓', 'faceExtras', { scale: 1, style: 'round' }),
    visor: part('visor', 'Visor futurista', '🕶️', 'faceExtras', { scale: 1, style: 'visor' }),
    freckles: part('freckles', 'Pecas', '✨', 'faceExtras', { scale: 1 }),
    blush: part('blush', 'Rubor', '🩷', 'faceExtras', { boost: 1.0 }),
    bandage: part('bandage', 'Curita', '🩹', 'faceExtras', { scale: 1, side: 1 }),
    crumbs: part('crumbs', 'Migajitas', '🍪', 'faceExtras', { scale: 1 }),
  },
  neckWear: {
    none: part('none', 'Sin atuendo', '·', 'neckWear', { scale: 1 }),
    bell_collar: part('bell_collar', 'Collar con cascabel', '🔔', 'neckWear', { scale: 1 }),
    tunic_clasp: part('tunic_clasp', 'Túnica con broche', '🟢', 'neckWear', { scale: 1 }),
    mage_cloak: part('mage_cloak', 'Capa estelar', '🔮', 'neckWear', { scale: 1 }),
    pirate_coat: part('pirate_coat', 'Casaca y cinturón', '🧥', 'neckWear', { scale: 1 }),
    tattered_bib: part('tattered_bib', 'Túnica deshilachada', '🧟', 'neckWear', { scale: 1 }),
    monk_robe: part('monk_robe', 'Túnica y cuentas zen', '📿', 'neckWear', { scale: 1 }),
    scarf: part('scarf', 'Bufanda cálida', '🧣', 'neckWear', { scale: 1 }),
    bib: part('bib', 'Servilleta glotona', '🍽️', 'neckWear', { scale: 1 }),
  },
  backExtras: {
    cat_tail: part('cat_tail', 'Colita curva', '🐈', 'backExtras', { scale: 1 }),
    pom_tail: part('pom_tail', 'Colita pompón', '🐇', 'backExtras', { scale: 1 }),
    devil_tail: part('devil_tail', 'Colita picuda', '😈', 'backExtras', { scale: 1 }),
    wings: part('wings', 'Alitas pequeñas', '🪽', 'backExtras', { scale: 1 }),
    earring: part('earring', 'Aro dorado', '💛', 'backExtras', { scale: 1 }),
    drumstick: part('drumstick', 'Muslito mordido', '🍗', 'backExtras', { scale: 1 }),
    prayer_hands: part('prayer_hands', 'Manitas en oración', '🙏', 'backExtras', { scale: 1 }),
    flower: part('flower', 'Florecita', '🌼', 'backExtras', { scale: 1 }),
  },
}

// ═══════════════════════════ GEOMETRÍAS SUAVES (ALTA SEGMENTACIÓN) ═══════════════════════════

// Construye un tubo suavemente afilado a lo largo de una curva CatmullRom con tapas cerradas.
function makeTaperedTubeGeo(points, radiusFn, tubularSegs = 22, radialSegs = 18) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(p[0], p[1], p[2])))
  const frames = curve.computeFrenetFrames(tubularSegs, false)
  const positions = []
  const uvs = []
  const indices = []

  const ringCols = radialSegs + 1
  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs
    const c = curve.getPointAt(t)
    const N = frames.normals[i]
    const B = frames.binormals[i]
    const rad = Math.max(0.002, radiusFn(t))
    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs
      const th = u * Math.PI * 2
      const cos = Math.cos(th)
      const sin = Math.sin(th)
      positions.push(
        c.x + rad * (cos * N.x + sin * B.x),
        c.y + rad * (cos * N.y + sin * B.y),
        c.z + rad * (cos * N.z + sin * B.z),
      )
      uvs.push(u, t)
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringCols + j
      const b = (i + 1) * ringCols + j
      const c = i * ringCols + (j + 1)
      const d = (i + 1) * ringCols + (j + 1)
      indices.push(a, c, b, b, c, d)
    }
  }

  // Tapa inicial (normal hacia -T)
  const c0 = curve.getPointAt(0)
  const startCenterIdx = positions.length / 3
  positions.push(c0.x, c0.y, c0.z)
  uvs.push(0.5, 0)
  for (let j = 0; j < radialSegs; j++) {
    indices.push(startCenterIdx, j + 1, j)
  }

  // Tapa final (normal hacia +T)
  const c1 = curve.getPointAt(1)
  const endCenterIdx = positions.length / 3
  positions.push(c1.x, c1.y, c1.z)
  uvs.push(0.5, 1)
  const base = tubularSegs * ringCols
  for (let j = 0; j < radialSegs; j++) {
    indices.push(endCenterIdx, base + j, base + j + 1)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Cuerpo chibi ligeramente regordete en la parte baja y perfectamente suave.
function makeClayBodyGeo() {
  const pts = []
  const steps = 28
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const th = t * Math.PI
    const s = Math.sin(th)
    const c = Math.cos(th)
    const r = s * (1 + 0.032 * s - 0.025 * c)
    const y = -c * 0.96
    pts.push(new THREE.Vector2(Math.max(0, r), y))
  }
  const geo = new THREE.LatheGeometry(pts, 36)
  geo.computeVertexNormals()
  return geo
}

// Disco abombado con UVs frontales circulares sin distorsión para el iris animado.
function makeDomedDiscGeo(segs = 32, dome = 0.24) {
  const positions = [0, 0, dome]
  const uvs = [0.5, 0.5]
  const indices = []
  const rings = 4
  for (let r = 1; r <= rings; r++) {
    const rr = r / rings
    const zz = dome * (1 - rr * rr)
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2
      const x = Math.cos(a) * rr
      const y = Math.sin(a) * rr
      positions.push(x, y, zz)
      uvs.push(0.5 + x * 0.5, 0.5 + y * 0.5)
    }
  }
  const stride = segs + 1
  for (let i = 0; i < segs; i++) {
    indices.push(0, 1 + i, 1 + i + 1)
  }
  for (let r = 1; r < rings; r++) {
    const row0 = 1 + (r - 1) * stride
    const row1 = 1 + r * stride
    for (let i = 0; i < segs; i++) {
      indices.push(row0 + i, row1 + i, row0 + i + 1, row0 + i + 1, row1 + i, row1 + i + 1)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// Oreja redondeada esculpida suavemente a partir de una esfera de alta segmentación.
function makeRoundedEarGeo(kind) {
  const geo = new THREE.SphereGeometry(1, 24, 18)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    const y = pos.getY(i)
    let z = pos.getZ(i)
    const t = (y + 1) * 0.5 // 0 base .. 1 punta
    if (kind === 'cat') {
      x *= 1.08 - 0.58 * t
      z *= 0.42 - 0.14 * t
      if (z > 0) z *= 0.72
      z += 0.08 * Math.sin(t * Math.PI)
    } else if (kind === 'elf') {
      x *= 0.85 - 0.62 * t
      z *= 0.4 - 0.22 * t
      z -= 0.16 * t * t
    } else if (kind === 'bunny') {
      x *= 0.68 + 0.26 * Math.sin(t * Math.PI)
      z *= 0.34
      z += 0.05 * Math.sin(t * Math.PI)
    } else if (kind === 'bear') {
      x *= 1.04
      z *= 0.52
    }
    pos.setXYZ(i, x, t, z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// Estrella regordeta biselada (para sombrero y adornos).
function makeStarGeo(points = 5, outerR = 1, innerR = 0.5, depth = 0.22) {
  const shape = new THREE.Shape()
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / points
    const r = i % 2 === 0 ? outerR : innerR
    const x = Math.cos(a) * r
    const y = Math.sin(a) * r
    if (i === 0) shape.moveTo(x, y)
    else shape.lineTo(x, y)
  }
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.12,
    bevelThickness: 0.12,
    curveSegments: 10,
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

// Gema romboidal biselada.
function makeDiamondGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 1)
  s.lineTo(0.72, 0)
  s.lineTo(0, -1)
  s.lineTo(-0.72, 0)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.2,
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.1,
    bevelThickness: 0.12,
  })
  geo.center()
  geo.computeVertexNormals()
  return geo
}

// Ala ancha suave y ligeramente ondulada para el sombrero de maga.
function makeWizardBrimGeo() {
  const pts = [
    new THREE.Vector2(0.42, 0.05),
    new THREE.Vector2(0.65, 0.04),
    new THREE.Vector2(0.92, -0.01),
    new THREE.Vector2(1.12, 0.02),
    new THREE.Vector2(1.16, 0.055),
    new THREE.Vector2(1.06, 0.085),
    new THREE.Vector2(0.76, 0.07),
    new THREE.Vector2(0.45, 0.09),
  ]
  const geo = new THREE.LatheGeometry(pts, 40)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const ang = Math.atan2(z, x)
    const wave = Math.max(0, r - 0.5) * 0.14 * Math.sin(ang * 2 + 0.5)
    pos.setY(i, pos.getY(i) + wave)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// Disco con bordes redondeados tipo botón/parche/hebilla.
function makePillDiscGeo() {
  const pts = [
    new THREE.Vector2(0, 0.18),
    new THREE.Vector2(0.75, 0.18),
    new THREE.Vector2(0.95, 0.12),
    new THREE.Vector2(1.0, 0),
    new THREE.Vector2(0.95, -0.12),
    new THREE.Vector2(0.75, -0.18),
    new THREE.Vector2(0, -0.18),
  ]
  const geo = new THREE.LatheGeometry(pts, 32)
  geo.rotateX(Math.PI / 2)
  geo.computeVertexNormals()
  return geo
}

// Túnica inferior suave (con opción deshilachada en zigzag ondulado para zombi).
function makeTunicShellGeo(tattered = false) {
  const geo = new THREE.SphereGeometry(1.028, 36, 16, 0, Math.PI * 2, Math.PI * 0.58, Math.PI * 0.36)
  if (tattered) {
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      const z = pos.getZ(i)
      const ang = Math.atan2(z, x)
      const jag = Math.sin(ang * 9) * 0.055 + Math.cos(ang * 5) * 0.03
      if (y < -0.22) pos.setY(i, y + jag * (-y))
    }
    pos.needsUpdate = true
  }
  geo.computeVertexNormals()
  return geo
}

// Alita suave redondeada.
function makeWingGeo() {
  const s = new THREE.Shape()
  s.moveTo(0, 0)
  s.bezierCurveTo(0.35, 0.45, 0.95, 0.55, 1.0, 0.1)
  s.bezierCurveTo(0.95, -0.25, 0.45, -0.35, 0, -0.15)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.06,
    bevelThickness: 0.06,
    curveSegments: 12,
  })
  geo.computeVertexNormals()
  return geo
}

// Muslito de pollo regordete con mordida suave.
function makeDrumstickMeatGeo() {
  const pts = [
    new THREE.Vector2(0, -0.45),
    new THREE.Vector2(0.18, -0.38),
    new THREE.Vector2(0.36, -0.15),
    new THREE.Vector2(0.42, 0.14),
    new THREE.Vector2(0.3, 0.38),
    new THREE.Vector2(0, 0.45),
  ]
  const geo = new THREE.LatheGeometry(pts, 28)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    if (x > 0.12 && y > 0.1 && z > 0.05) {
      pos.setXYZ(i, x * 0.72, y * 0.88, z * 0.78)
    }
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

export const GEO = {
  body: makeClayBodyGeo(),
  sphere: new THREE.SphereGeometry(1, 24, 18),
  capsule: new THREE.CapsuleGeometry(0.5, 0.8, 10, 18),
  capsuleThin: new THREE.CapsuleGeometry(0.5, 2.2, 8, 16),
  torus: new THREE.TorusGeometry(1, 0.16, 14, 36),
  torusThin: new THREE.TorusGeometry(1, 0.085, 14, 36),
  torusThick: new THREE.TorusGeometry(1, 0.24, 16, 36),
  torusArc: new THREE.TorusGeometry(1, 0.15, 12, 26, Math.PI),
  pillDisc: makePillDiscGeo(),
  irisDisc: makeDomedDiscGeo(32, 0.24),
  star5: makeStarGeo(5, 1, 0.48, 0.22),
  diamond: makeDiamondGeo(),
  earCat: makeRoundedEarGeo('cat'),
  earElf: makeRoundedEarGeo('elf'),
  earBunny: makeRoundedEarGeo('bunny'),
  earBear: makeRoundedEarGeo('bear'),
  hatElf: makeTaperedTubeGeo(
    [[0, 0, 0], [0.05, 0.32, -0.02], [0.22, 0.62, -0.1], [0.54, 0.7, -0.22], [0.7, 0.56, -0.24]],
    (t) => 0.62 * Math.pow(1 - t * 0.88, 0.85),
    24,
    24,
  ),
  hatWizardBrim: makeWizardBrimGeo(),
  hatWizardCrown: makeTaperedTubeGeo(
    [[0, 0, 0], [0.04, 0.34, -0.02], [0.18, 0.68, -0.08], [0.46, 0.88, -0.16], [0.64, 0.76, -0.2]],
    (t) => 0.54 * Math.pow(1 - t * 0.9, 0.9),
    24,
    24,
  ),
  hatNightcap: makeTaperedTubeGeo(
    [[0, 0, 0], [0.06, 0.28, -0.08], [0.28, 0.44, -0.24], [0.56, 0.3, -0.34], [0.68, 0.06, -0.36]],
    (t) => 0.58 * Math.pow(1 - t * 0.86, 0.8),
    24,
    22,
  ),
  hornCurved: makeTaperedTubeGeo(
    [[0, 0, 0], [0.06, 0.18, 0.02], [0.16, 0.36, -0.04], [0.1, 0.52, -0.14]],
    (t) => 0.16 * (1 - t * 0.82),
    16,
    14,
  ),
  tailCat: makeTaperedTubeGeo(
    [[0, 0, 0], [0, 0.1, -0.28], [0.06, 0.34, -0.44], [0.16, 0.56, -0.36], [0.14, 0.68, -0.24]],
    (t) => 0.11 * (1 - t * 0.35),
    20,
    14,
  ),
  tailDevil: makeTaperedTubeGeo(
    [[0, 0, 0], [0, -0.05, -0.28], [0.1, 0.14, -0.5], [0.22, 0.38, -0.45]],
    (t) => 0.065 * (1 - t * 0.3),
    18,
    12,
  ),
  hairLock: makeTaperedTubeGeo(
    [[0, 0, 0], [0.04, -0.16, 0.08], [0.12, -0.34, 0.05], [0.14, -0.48, -0.02]],
    (t) => 0.14 * Math.sin(Math.max(0.08, 1 - t * 0.85) * Math.PI * 0.55),
    14,
    12,
  ),
  bandanaCap: new THREE.SphereGeometry(1.028, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.45),
  bandanaTail: makeTaperedTubeGeo(
    [[0, 0, 0], [0.14, -0.08, -0.12], [0.22, -0.26, -0.22]],
    (t) => 0.06 + 0.05 * Math.sin(t * Math.PI),
    12,
    10,
  ),
  hoodCap: new THREE.SphereGeometry(1.055, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.65),
  tunicShell: makeTunicShellGeo(false),
  tatteredShell: makeTunicShellGeo(true),
  wing: makeWingGeo(),
  drumstickMeat: makeDrumstickMeatGeo(),
  plane: new THREE.PlaneGeometry(1, 1),
}

// ═══════════════════════════ MATERIALES ARCILLA (SSS FALSO + RIM) ═══════════════════════════

function injectClaySSS(material) {
  material.customProgramCacheKey = () => 'clay-sss-v1'
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      `
      float clayRim = pow(1.0 - saturate(dot(geometryNormal, geometryViewDir)), 2.5);
      vec3 claySss = diffuseColor.rgb * (0.15 + clayRim * 0.28) + vec3(0.05, 0.04, 0.06) * clayRim;
      outgoingLight += claySss;
      #include <opaque_fragment>
      `,
    )
  }
}

const matCache = new Map()
const MAX_MATS = 256

export function getMat(color, roughness = 0.74, metalness = 0.02, emissive = null, opacity = 1, clay = true) {
  const key = `${color}|${roughness}|${metalness}|${emissive ?? ''}|${opacity}|${clay ? 1 : 0}`
  let m = matCache.get(key)
  if (m) {
    matCache.delete(key)
    matCache.set(key, m)
    return m
  }
  const opts = { color, roughness, metalness }
  if (emissive) {
    opts.emissive = emissive
    opts.emissiveIntensity = 0.42
  }
  if (opacity < 1) {
    opts.transparent = true
    opts.opacity = opacity
    opts.depthWrite = false
  }
  m = new THREE.MeshStandardMaterial(opts)
  if (clay && metalness < 0.25 && opacity >= 1) injectClaySSS(m)
  if (matCache.size >= MAX_MATS) {
    const oldest = matCache.keys().next().value
    matCache.get(oldest)?.dispose()
    matCache.delete(oldest)
  }
  matCache.set(key, m)
  return m
}

export function createClayBodyMaterial(map, roughness = 0.72) {
  const m = new THREE.MeshStandardMaterial({ map, roughness, metalness: 0.02 })
  injectClaySSS(m)
  return m
}

// ═══════════════════════════ TEXTURAS PROCEDURALES (CUERPO, IRIS, CALAVERA) ═══════════════════════════

const texCache = new Map()
const MAX_TEX = 64

export function getBodyTexture(skin) {
  const key = `${skin.seed}|${skin.patternType}|${skin.baseColor}|${skin.accentColor}`
  const hit = texCache.get(key)
  if (hit) {
    texCache.delete(key)
    texCache.set(key, hit)
    return hit
  }

  const W = 128
  const H = 64
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  const rng = mulberry32(skin.seed ^ 0x9e3779b9)

  const baseColor = skin.baseColor ?? hslHex(skin.baseHue, 0.7, 0.65)
  const accentColor = skin.accentColor ?? hslHex(skin.accentHue, 0.68, skin.accentLight)
  const softColor = skin.softColor ?? hslHex(skin.baseHue, 0.6, 0.82)
  const deepColor = skin.deepColor ?? hslHex(skin.baseHue, 0.72, 0.45)

  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, W, H)

  const pat = skin.patternType
  const scale = skin.patternScale

  if (pat === 'degradado') {
    const grad = ctx.createLinearGradient(0, 0, 0, H)
    grad.addColorStop(0, softColor)
    grad.addColorStop(0.55, baseColor)
    grad.addColorStop(1, accentColor)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)
  } else if (pat === 'atigrado') {
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.45
    for (const dx of [-4, 0, 4]) {
      ctx.beginPath()
      ctx.ellipse(W * 0.25 + dx, H * 0.22, 1.3, 5.5, dx * 0.04, 0, Math.PI * 2)
      ctx.fill()
    }
    for (const sideX of [W * 0.06, W * 0.44, W * 0.75]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.ellipse(sideX, H * (0.36 + i * 0.14), 8, 2.2, 0.1, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  } else if (pat === 'bicolor') {
    ctx.fillStyle = accentColor
    ctx.beginPath()
    ctx.moveTo(0, H)
    const midY = H * (0.54 + (rng() - 0.5) * 0.12)
    const freq = 2 + Math.floor(rng() * 3)
    const amp = 4 + rng() * 5
    for (let x = 0; x <= W; x += 2) {
      ctx.lineTo(x, midY + Math.sin((x / W) * Math.PI * 2 * freq) * amp)
    }
    ctx.lineTo(W, H)
    ctx.closePath()
    ctx.globalAlpha = 0.68
    ctx.fill()
    ctx.globalAlpha = 1
  } else if (pat === 'rayas') {
    ctx.fillStyle = accentColor
    ctx.globalAlpha = 0.4 + skin.patternIntensity * 0.3
    const count = 4 + Math.floor(rng() * 3)
    const tilt = (rng() - 0.5) * 10
    const stripeH = (H / count) * 0.35
    for (let i = 0; i < count; i++) {
      const y0 = (i + 0.5) * (H / count)
      ctx.beginPath()
      ctx.moveTo(0, y0 - stripeH * 0.5)
      ctx.lineTo(W, y0 + tilt - stripeH * 0.5)
      ctx.lineTo(W, y0 + tilt + stripeH * 0.5)
      ctx.lineTo(0, y0 + stripeH * 0.5)
      ctx.closePath()
      ctx.fill()
    }
    ctx.globalAlpha = 1
  } else if (pat === 'manchas') {
    const count = 7 + Math.floor(rng() * 7)
    ctx.fillStyle = accentColor
    for (let i = 0; i < count; i++) {
      const cx = rng() * W
      const cy = 6 + rng() * (H - 12)
      const rx = (4 + rng() * 7) * scale
      const ry = (3 + rng() * 5) * scale
      ctx.globalAlpha = 0.38 + rng() * 0.32
      for (const ox of [-W, 0, W]) {
        ctx.beginPath()
        ctx.ellipse(cx + ox, cy, rx, ry, rng() * Math.PI, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  } else if (pat === 'lunares') {
    const cols = 6 + Math.floor(rng() * 3)
    const rows = 3 + Math.floor(rng() * 2)
    const rad = (2 + rng() * 2) * scale
    ctx.fillStyle = rng() < 0.5 ? softColor : accentColor
    ctx.globalAlpha = 0.55
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cx = ((c + (r % 2) * 0.5) / cols) * W
        const cy = ((r + 0.5) / rows) * H
        for (const ox of [-W, 0, W]) {
          ctx.beginPath()
          ctx.arc(cx + ox, cy, rad, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }
    ctx.globalAlpha = 1
  } else if (pat === 'pecas') {
    const count = 30 + Math.floor(rng() * 22)
    for (let i = 0; i < count; i++) {
      const cx = rng() * W
      const cy = 4 + rng() * (H - 8)
      const rad = 0.8 + rng() * 1.4
      ctx.fillStyle = rng() < 0.5 ? deepColor : accentColor
      ctx.globalAlpha = 0.35 + rng() * 0.3
      for (const ox of [-W, 0, W]) {
        ctx.beginPath()
        ctx.arc(cx + ox, cy, rad, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true

  if (texCache.size >= MAX_TEX) {
    const oldest = texCache.keys().next().value
    texCache.get(oldest)?.dispose()
    texCache.delete(oldest)
  }
  texCache.set(key, tex)
  return tex
}

function makeCanvasTex(size, drawFn) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')
  drawFn(ctx, size)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

const irisTexCache = new Map()
const MAX_IRIS_TEX = 64

// Textura del iris anime con degradado vertical rico, pupila oscura, estrella opcional y borde limpio.
export function getIrisTexture(eyeStyle, irisTop, irisBot, pupilColor) {
  const key = `${eyeStyle}|${irisTop}|${irisBot}|${pupilColor}`
  const hit = irisTexCache.get(key)
  if (hit) return hit

  const tex = makeCanvasTex(128, (ctx, s) => {
    const cx = s / 2
    const cy = s / 2
    const r = s * 0.45
    ctx.clearRect(0, 0, s, s)

    ctx.fillStyle = '#1b1124'
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()

    const ir = r * 0.88
    const g = ctx.createLinearGradient(cx, cy - ir, cx, cy + ir)
    g.addColorStop(0, irisTop)
    g.addColorStop(0.55, irisBot)
    g.addColorStop(1, '#ffffff')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, ir, 0, Math.PI * 2)
    ctx.fill()

    const topShade = ctx.createLinearGradient(cx, cy - ir, cx, cy + ir * 0.25)
    topShade.addColorStop(0, 'rgba(18,10,30,0.68)')
    topShade.addColorStop(1, 'rgba(18,10,30,0)')
    ctx.fillStyle = topShade
    ctx.beginPath()
    ctx.arc(cx, cy, ir, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = pupilColor || '#1a1026'
    ctx.beginPath()
    ctx.arc(cx, cy - ir * 0.04, ir * 0.46, 0, Math.PI * 2)
    ctx.fill()

    if (eyeStyle === 'starry') {
      ctx.fillStyle = 'rgba(255,255,255,0.88)'
      const sx = cx
      const sy = cy + ir * 0.46
      const sr = ir * 0.24
      ctx.beginPath()
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4
        const rr = i % 2 === 0 ? sr : sr * 0.3
        const px = sx + Math.cos(a) * rr
        const py = sy + Math.sin(a) * rr
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fill()
    }

    ctx.strokeStyle = '#1b1124'
    ctx.lineWidth = s * 0.075
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (eyeStyle === 'rogue') {
      ctx.arc(cx, cy, r * 0.96, Math.PI * 1.12, Math.PI * 1.92)
    } else {
      ctx.arc(cx, cy, r * 0.96, Math.PI * 1.06, Math.PI * 1.94)
    }
    ctx.stroke()
  })

  if (irisTexCache.size >= MAX_IRIS_TEX) {
    const oldest = irisTexCache.keys().next().value
    irisTexCache.get(oldest)?.dispose()
    irisTexCache.delete(oldest)
  }
  irisTexCache.set(key, tex)
  return tex
}

let skullMatCache = null
function getSkullMat() {
  if (skullMatCache) return skullMatCache
  const tex = makeCanvasTex(128, (ctx, s) => {
    const cx = s / 2
    const cy = s / 2
    ctx.clearRect(0, 0, s, s)
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 10
    ctx.lineCap = 'round'
    for (const sg of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(cx - 38, cy - sg * 24)
      ctx.lineTo(cx + 38, cy + sg * 24)
      ctx.stroke()
      for (const endX of [cx - 38, cx + 38]) {
        const endY = endX < cx ? cy - sg * 24 : cy + sg * 24
        ctx.fillStyle = '#f8fafc'
        ctx.beginPath()
        ctx.arc(endX - 4, endY - 4, 6, 0, Math.PI * 2)
        ctx.arc(endX + 4, endY + 4, 6, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(cx, cy - 6, 25, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.roundRect(cx - 14, cy + 6, 28, 17, 6)
    ctx.fill()
    ctx.fillStyle = '#1e1b2e'
    for (const dx of [-9, 9]) {
      ctx.beginPath()
      ctx.arc(cx + dx, cy - 5, 5.8, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(cx, cy + 4, 3.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1e1b2e'
    ctx.lineWidth = 2.5
    for (const dx of [-5, 0, 5]) {
      ctx.beginPath()
      ctx.moveTo(cx + dx, cy + 14)
      ctx.lineTo(cx + dx, cy + 21)
      ctx.stroke()
    }
  })
  skullMatCache = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, depthWrite: false })
  return skullMatCache
}

// ═══════════════════════════ TEXTURAS CHIBI CON FALLBACK ═══════════════════════════

function createChibiFallbacks() {
  const eye = makeCanvasTex(128, (ctx, s) => {
    const cx = s / 2; const cy = s / 2; const r = s * 0.46
    const g = ctx.createRadialGradient(cx, cy * 0.9, r * 0.2, cx, cy, r)
    g.addColorStop(0, '#ffffff')
    g.addColorStop(0.75, '#f8fafc')
    g.addColorStop(1, '#dbe4f0')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  })

  const sparkle = makeCanvasTex(128, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    ctx.clearRect(0, 0, s, s)
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.45)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.4, 'rgba(255,255,255,0.75)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const ang = (i * Math.PI) / 4
      const rad = i % 2 === 0 ? s * 0.44 : s * 0.12
      const x = cx + Math.cos(ang) * rad
      const y = cy + Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  })

  const blush = makeCanvasTex(128, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    const k = s / 64
    const g = ctx.createRadialGradient(cx, cy, 2 * k, cx, cy, s * 0.45)
    g.addColorStop(0, 'rgba(255,130,165,0.95)')
    g.addColorStop(0.65, 'rgba(255,145,175,0.45)')
    g.addColorStop(1, 'rgba(255,145,175,0)')
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.ellipse(cx, cy, s * 0.46, s * 0.32, 0, 0, Math.PI * 2)
    ctx.fill()
  })

  const star = makeCanvasTex(128, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    ctx.fillStyle = '#fde047'
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3 * (s / 64)
    ctx.beginPath()
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5
      const rad = i % 2 === 0 ? s * 0.4 : s * 0.18
      const x = cx + Math.cos(ang) * rad
      const y = cy + Math.sin(ang) * rad
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
  })

  return { eye, sparkle, blush, star }
}

let chibiTexCache = null
const chibiFiles = {
  eye: 'tex/chibi_eye.png',
  sparkle: 'tex/chibi_sparkle.png',
  blush: 'tex/chibi_blush.png',
  star: 'tex/chibi_star.png',
}

export function getChibiTextures() {
  if (chibiTexCache) return chibiTexCache
  chibiTexCache = createChibiFallbacks()
  const base = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) ? import.meta.env.BASE_URL : '/'
  const loader = new THREE.TextureLoader()
  for (const [k, rel] of Object.entries(chibiFiles)) {
    loader.load(
      base + rel,
      (loaded) => {
        const target = chibiTexCache[k]
        if (target && loaded?.image) {
          target.colorSpace = THREE.SRGBColorSpace
          applyLoadedImage(target, loaded.image)
        }
      },
      undefined,
      () => { /* fallback procedural ya activo */ },
    )
  }
  return chibiTexCache
}

const emoTexCache = new Map()
export function getEmotionTexture(kind) {
  if (kind === 'star') return getChibiTextures().star
  if (emoTexCache.has(kind)) return emoTexCache.get(kind)

  const tex = makeCanvasTex(64, (ctx, s) => {
    const cx = s / 2; const cy = s / 2
    if (kind === 'heart') {
      ctx.fillStyle = '#ff5d8f'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy + 16)
      ctx.bezierCurveTo(cx - 24, cy + 2, cx - 22, cy - 18, cx, cy - 6)
      ctx.bezierCurveTo(cx + 22, cy - 18, cx + 24, cy + 2, cx, cy + 16)
      ctx.fill()
      ctx.stroke()
    } else if (kind === 'drop') {
      ctx.fillStyle = '#60a5fa'
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy - 20)
      ctx.bezierCurveTo(cx + 18, cy + 2, cx + 16, cy + 20, cx, cy + 20)
      ctx.bezierCurveTo(cx - 16, cy + 20, cx - 18, cy + 2, cx, cy - 20)
      ctx.fill()
      ctx.stroke()
    } else if (kind === 'exclaim') {
      ctx.fillStyle = '#facc15'
      ctx.strokeStyle = '#78350f'
      ctx.lineWidth = 4
      ctx.font = 'bold 44px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText('!', cx, cy + 2)
      ctx.fillText('!', cx, cy + 2)
    } else if (kind === 'question') {
      ctx.fillStyle = '#c084fc'
      ctx.strokeStyle = '#3b0764'
      ctx.lineWidth = 4
      ctx.font = 'bold 40px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.strokeText('¿?', cx, cy + 2)
      ctx.fillText('¿?', cx, cy + 2)
    }
  })
  emoTexCache.set(kind, tex)
  return tex
}

// ═══════════════════════════ REGLAS DE COHERENCIA Y PRESETS ═══════════════════════════

// Los 6 personajes de la hoja chibi + los 4 arquetipos complementarios definidos como presets del generador.
const PRESET_BLUEPRINTS = {
  elfa: {
    id: 'elfa',
    adjective: ['del bosque', 'gruñona', 'musgosa', 'esmeralda'],
    body: 'chibi_round',
    hat: 'conical_elf',
    ears: 'elf',
    hair: 'bangs_elf',
    eyes: 'round',
    brows: 'grumpy',
    mouth: 'zigzag',
    faceExtras: ['blush'],
    neckWear: 'tunic_clasp',
    backExtras: [],
    pattern: 'degradado',
    paletteHint: { bodyHue: 0.08, bodySat: 0.55, bodyLight: 0.84, hatHue: 0.28, ribbonHue: 0.12, hairHue: 0.24, irisHue: 0.34, outfitHue: 0.28 },
  },
  gatita: {
    id: 'gatita',
    adjective: ['de cascabel', 'mimosita', 'atigrada', 'dulce'],
    body: 'chibi_round',
    hat: 'none',
    ears: 'cat',
    hair: 'none',
    eyes: 'starry',
    brows: 'soft',
    mouth: 'w',
    faceExtras: ['whiskers', 'blush'],
    neckWear: 'bell_collar',
    backExtras: ['cat_tail'],
    pattern: 'atigrado',
    paletteHint: { bodyHue: 0.07, bodySat: 0.35, bodyLight: 0.9, hatHue: 0.94, ribbonHue: 0.95, irisHue: 0.07, outfitHue: 0.95 },
  },
  maga: {
    id: 'maga',
    adjective: ['estelar', 'arcana', 'curiosa', 'lunar'],
    body: 'chibi_round',
    hat: 'wizard',
    ears: 'none',
    hair: 'curls_mage',
    eyes: 'starry',
    brows: 'arched',
    mouth: 'o',
    faceExtras: ['blush'],
    neckWear: 'mage_cloak',
    backExtras: [],
    pattern: 'degradado',
    paletteHint: { bodyHue: 0.08, bodySat: 0.45, bodyLight: 0.87, hatHue: 0.74, ribbonHue: 0.77, hairHue: 0.74, irisHue: 0.72, outfitHue: 0.74 },
  },
  pirata: {
    id: 'pirata',
    adjective: ['intrépida', 'corsaria', 'valiente', 'audaz'],
    body: 'chibi_round',
    hat: 'bandana',
    ears: 'none',
    hair: 'none',
    eyes: 'rogue',
    brows: 'arched',
    mouth: 'open',
    faceExtras: ['patch', 'scar', 'blush'],
    neckWear: 'pirate_coat',
    backExtras: ['earring'],
    pattern: 'degradado',
    paletteHint: { bodyHue: 0.07, bodySat: 0.62, bodyLight: 0.84, hatHue: 0.99, ribbonHue: 0.02, irisHue: 0.01, outfitHue: 0.07 },
  },
  zombi: {
    id: 'zombi',
    adjective: ['glotona', 'hambrienta', 'mentolada', 'remendada'],
    body: 'chibi_plump',
    hat: 'brain',
    ears: 'none',
    hair: 'tufts_zombie',
    eyes: 'asym',
    brows: 'soft',
    mouth: 'dientes',
    faceExtras: ['stitch', 'crumbs', 'blush'],
    neckWear: 'tattered_bib',
    backExtras: ['drumstick'],
    pattern: 'manchas',
    paletteHint: { bodyHue: 0.3, bodySat: 0.38, bodyLight: 0.74, hatHue: 0.94, ribbonHue: 0.77, hairHue: 0.76, irisHue: 0.24, outfitHue: 0.76 },
  },
  ascetica: {
    id: 'ascetica',
    adjective: ['zen', 'serena', 'iluminada', 'pacífica'],
    body: 'chibi_round',
    hat: 'halo',
    ears: 'none',
    hair: 'none',
    eyes: 'zen',
    brows: 'soft',
    mouth: 'curva',
    faceExtras: ['blush'],
    neckWear: 'monk_robe',
    backExtras: ['prayer_hands'],
    pattern: 'degradado',
    paletteHint: { bodyHue: 0.07, bodySat: 0.58, bodyLight: 0.86, hatHue: 0.13, ribbonHue: 0.1, irisHue: 0.08, outfitHue: 0.1 },
  },
  miedosa: {
    id: 'miedosa',
    adjective: ['temblona', 'soñadora', 'tímida', 'tierna'],
    body: 'chibi_tiny',
    hat: 'nightcap',
    ears: 'bunny',
    hair: 'none',
    eyes: 'round',
    brows: 'soft',
    mouth: 'o',
    faceExtras: ['bandage', 'blush'],
    neckWear: 'scarf',
    backExtras: ['pom_tail'],
    pattern: 'lunares',
  },
  rutinaria: {
    id: 'rutinaria',
    adjective: ['clásica', 'metódica', 'cafetera', 'serena'],
    body: 'chibi_round',
    hat: 'beret',
    ears: 'bear',
    hair: 'none',
    eyes: 'round',
    brows: 'thick',
    mouth: 'curva',
    faceExtras: ['glasses', 'freckles', 'blush'],
    neckWear: 'scarf',
    backExtras: [],
    pattern: 'bicolor',
  },
  solitaria: {
    id: 'solitaria',
    adjective: ['encapuchada', 'nocturna', 'misteriosa', 'sigilosa'],
    body: 'chibi_tall',
    hat: 'hood',
    ears: 'horns',
    hair: 'none',
    eyes: 'rogue',
    brows: 'grumpy',
    mouth: 'curva',
    faceExtras: ['visor'],
    neckWear: 'scarf',
    backExtras: ['devil_tail'],
    pattern: 'degradado',
  },
  alegre: {
    id: 'alegre',
    adjective: ['estrellada', 'festiva', 'radiante', 'floral'],
    body: 'chibi_round',
    hat: 'crown',
    ears: 'antennae',
    hair: 'none',
    eyes: 'starry',
    brows: 'arched',
    mouth: 'open',
    faceExtras: ['freckles', 'blush'],
    neckWear: 'bib',
    backExtras: ['wings', 'flower'],
    pattern: 'lunares',
  },
}

const SHEET_PRESETS = new Set(['elfa', 'gatita', 'maga', 'pirata', 'zombi', 'ascetica'])

// Puntuación ponderada por rasgos para elegir piezas coherentes cuando el generador opera en modo libre.
function pickScored(candidates, rng) {
  let best = candidates[0]
  let bestScore = -Infinity
  for (const c of candidates) {
    const jitter = (rng() - 0.5) * 0.22
    if (c.score + jitter > bestScore) {
      bestScore = c.score + jitter
      best = c
    }
  }
  return best.id
}

function chooseProceduralPieces(t, rng) {
  const val = t.valentia ?? 0.5
  const cur = t.curiosidad ?? 0.5
  const ape = t.apetito ?? 0.5
  const soc = t.sociabilidad ?? 0.5
  const ani = t.animo ?? 0.5
  const vel = t.velocidad ?? 0.5

  const body = ape > 0.65 ? 'chibi_plump' : val < 0.35 ? 'chibi_tiny' : vel > 0.72 ? 'chibi_tall' : 'chibi_round'

  const hat = pickScored([
    { id: 'conical_elf', score: (1 - ani) * 0.8 + cur * 0.3 },
    { id: 'wizard', score: cur * 0.95 + (1 - ape) * 0.2 },
    { id: 'beret', score: (1 - cur) * 0.75 + soc * 0.25 },
    { id: 'hood', score: (1 - soc) * 0.9 + (1 - ani) * 0.25 },
    { id: 'bandana', score: val * 0.9 + vel * 0.3 },
    { id: 'nightcap', score: (1 - val) * 0.85 + (1 - vel) * 0.3 },
    { id: 'crown', score: ani * 0.8 + val * 0.35 },
    { id: 'halo', score: (1 - ape) * 0.9 + ani * 0.3 },
    { id: 'flower_crown', score: soc * 0.75 + ani * 0.55 },
    { id: 'bow', score: soc * 0.9 + ani * 0.35 },
    { id: 'none', score: 0.45 },
  ], rng)

  const ears = pickScored([
    { id: 'cat', score: soc * 0.9 + vel * 0.25 },
    { id: 'elf', score: (1 - ani) * 0.85 + cur * 0.25 },
    { id: 'bunny', score: soc * 0.65 + (1 - val) * 0.6 },
    { id: 'bear', score: ape * 0.65 + soc * 0.45 },
    { id: 'droopy', score: (1 - val) * 0.8 + (1 - ani) * 0.3 },
    { id: 'horns', score: (1 - ani) * 0.6 + val * 0.5 },
    { id: 'antennae', score: cur * 0.95 + ani * 0.35 },
    { id: 'none', score: hat === 'hood' || hat === 'bandana' ? 0.9 : 0.35 },
  ], rng)

  const eyes = pickScored([
    { id: 'round', score: 0.6 + soc * 0.2 },
    { id: 'rogue', score: val * 0.85 + (1 - soc) * 0.3 },
    { id: 'starry', score: cur * 0.65 + ani * 0.65 },
    { id: 'zen', score: (1 - ape) * 0.75 + (1 - vel) * 0.4 },
    { id: 'cyclops', score: cur * 0.78 + (rng() < 0.25 ? 0.3 : 0) },
    { id: 'asym', score: ape * 0.55 + (1 - ani) * 0.35 },
  ], rng)

  const brows = ani < 0.36 ? 'grumpy' : val > 0.68 || cur > 0.68 ? 'arched' : ape > 0.7 ? 'thick' : 'soft'

  const mouth = pickScored([
    { id: 'curva', score: ani * 0.7 + soc * 0.3 },
    { id: 'w', score: soc * 0.85 + (ears === 'cat' ? 0.6 : 0) },
    { id: 'zigzag', score: (1 - ani) * 0.9 },
    { id: 'dientes', score: ape * 0.85 + val * 0.25 },
    { id: 'open', score: ani * 0.8 + val * 0.35 },
    { id: 'o', score: cur * 0.75 + (1 - val) * 0.4 },
  ], rng)

  const faceExtras = ['blush']
  if (val > 0.72 && eyes !== 'cyclops' && eyes !== 'zen' && rng() < 0.75) faceExtras.push('patch')
  if (val > 0.65 && rng() < 0.65) faceExtras.push('scar')
  if (cur > 0.66 && !faceExtras.includes('patch') && eyes !== 'zen' && eyes !== 'cyclops') {
    faceExtras.push(soc < 0.38 ? 'visor' : 'glasses')
  }
  if (ears === 'cat' || (soc > 0.72 && rng() < 0.45)) faceExtras.push('whiskers')
  if (ape > 0.76) faceExtras.push('crumbs')
  if (val < 0.32 && rng() < 0.7) faceExtras.push('bandage')
  if (ape > 0.75 && ani < 0.45 && rng() < 0.55) faceExtras.push('stitch')
  if (rng() < 0.38) faceExtras.push('freckles')

  const neckWear = pickScored([
    { id: 'scarf', score: (1 - cur) * 0.5 + (1 - soc) * 0.4 + vel * 0.35 },
    { id: 'bell_collar', score: soc * 0.8 + (ears === 'cat' ? 0.4 : 0) },
    { id: 'bib', score: ape * 0.95 },
    { id: 'tunic_clasp', score: (1 - ani) * 0.55 + val * 0.35 },
    { id: 'mage_cloak', score: cur * 0.75 },
    { id: 'pirate_coat', score: val * 0.75 },
    { id: 'monk_robe', score: (1 - ape) * 0.75 },
    { id: 'none', score: 0.3 },
  ], rng)

  const backExtras = []
  if (ears === 'cat') backExtras.push('cat_tail')
  else if (ears === 'bunny') backExtras.push('pom_tail')
  else if (ears === 'horns') backExtras.push('devil_tail')
  if (vel > 0.68 || ani > 0.75) backExtras.push('wings')
  if (val > 0.72 && rng() < 0.5) backExtras.push('earring')
  if (soc > 0.74 && hat !== 'flower_crown' && rng() < 0.55) backExtras.push('flower')
  if (ape > 0.8 && rng() < 0.5) backExtras.push('drumstick')

  return { body, hat, ears, hair: 'none', eyes, brows, mouth, faceExtras, neckWear, backExtras }
}

function buildGeneratedName(baseName, pieces, rng, isSheetPreset, presetId) {
  if (isSheetPreset) {
    const adjs = PRESET_BLUEPRINTS[presetId]?.adjective ?? []
    if (pieces.faceExtras.includes('glasses')) return `${baseName} ilustrada`
    if (pieces.backExtras.includes('wings')) return `${baseName} alada`
    if (pieces.backExtras.includes('flower')) return `${baseName} floral`
    const adj = adjs[Math.floor(rng() * adjs.length)]
    return adj && !baseName.toLowerCase().includes(adj) ? `${baseName} ${adj}` : baseName
  }
  const hatName = SKIN_PARTS.hat[pieces.hat]?.label
  const earName = SKIN_PARTS.ears[pieces.ears]?.label
  const mainNoun = pieces.ears !== 'none'
    ? earName.replace('Orejas ', 'Bollita ').replace('Cuernitos ', 'Bollita con cuernitos ')
    : 'Bollita'
  if (pieces.hat !== 'none') return `${mainNoun} con ${hatName.toLowerCase()}`
  return `${mainNoun} ${baseName.toLowerCase()}`
}

// ═══════════════════════════ GENERADOR PRINCIPAL `generateSkin` ═══════════════════════════

/**
 * Genera una configuración completa de skin chibi a partir del genoma y arquetipo.
 * Combina paleta armónica HSL, proporciones y catálogo `SKIN_PARTS` con reglas de coherencia.
 */
export function generateSkin(genome, arch, options = {}) {
  const seed = hashGenome(genome)
  const rng = mulberry32(seed)
  const family = skinFamily(arch ?? genome)
  const profile = traitProfile(genome)
  const traits = genome?.traits ?? {}
  const baseHue = genome?.hue ?? 0.5

  const requestedPreset = options.preset !== undefined
    ? options.preset
    : (SHEET_PRESETS.has(family.id) || profile.dominance >= 0.14 ? family.id : null)

  const usePreset = !options.pureProcedural && requestedPreset && PRESET_BLUEPRINTS[requestedPreset]
  const bp = usePreset ? PRESET_BLUEPRINTS[requestedPreset] : null
  const isSheetPreset = Boolean(bp && SHEET_PRESETS.has(bp.id))

  // 1. Selección de piezas (preset como caso particular + variaciones coherentes, o 100% libre)
  const pieces = bp
    ? {
        body: bp.body,
        hat: bp.hat,
        ears: bp.ears,
        hair: bp.hair,
        eyes: bp.eyes,
        brows: bp.brows,
        mouth: bp.mouth,
        faceExtras: [...bp.faceExtras],
        neckWear: bp.neckWear,
        backExtras: [...bp.backExtras],
      }
    : chooseProceduralPieces(traits, rng)

  if (bp) {
    if ((traits.curiosidad ?? 0) > 0.84 && !pieces.faceExtras.includes('patch') && pieces.eyes !== 'zen') {
      if (!pieces.faceExtras.includes('glasses') && !pieces.faceExtras.includes('visor')) {
        pieces.faceExtras.push('glasses')
      }
    }
    if ((traits.velocidad ?? 0) > 0.85 && !pieces.backExtras.includes('wings') && bp.id !== 'zombi') {
      pieces.backExtras.push('wings')
    }
    if ((traits.sociabilidad ?? 0) > 0.84 && bp.hat === 'none' && rng() < 0.55) {
      pieces.backExtras.push('flower')
    }
    if (!pieces.faceExtras.includes('freckles') && rng() < 0.22 && bp.id !== 'zombi' && bp.id !== 'ascetica') {
      pieces.faceExtras.push('freckles')
    }
  }

  // 2. Paleta armónica HSL derivada del genoma (con anclaje suave en los 6 presets de referencia)
  const hint = bp?.paletteHint
  const hueDrift = (baseHue - 0.5) * 0.11
  const bodyHue = hint ? wrapHue(hint.bodyHue + hueDrift * 0.45) : baseHue
  const bodySat = hint ? hint.bodySat : 0.62
  const bodyLight = hint ? hint.bodyLight : 0.78

  const hatHue = hint?.hatHue !== undefined ? wrapHue(hint.hatHue + hueDrift * 0.6) : wrapHue(baseHue + 0.14 + rng() * 0.45)
  const ribbonHue = hint?.ribbonHue !== undefined ? wrapHue(hint.ribbonHue + hueDrift * 0.5) : wrapHue(hatHue + 0.42)
  const hairHue = hint?.hairHue !== undefined ? wrapHue(hint.hairHue + hueDrift * 0.5) : wrapHue(baseHue + 0.25)
  const irisHue = hint?.irisHue !== undefined ? wrapHue(hint.irisHue + hueDrift * 0.55) : wrapHue(baseHue + 0.35 + rng() * 0.25)
  const outfitHue = hint?.outfitHue !== undefined ? wrapHue(hint.outfitHue + hueDrift * 0.5) : hatHue

  const accentHue = wrapHue(bodyHue + (rng() < 0.5 ? 0.08 + rng() * 0.1 : 0.38 + rng() * 0.18))
  const accentLight = bodyLight > 0.75 ? 0.66 : 0.82

  const bodyColor = hslHex(bodyHue, bodySat, bodyLight)
  const accentColor = hslHex(accentHue, Math.min(0.65, bodySat + 0.1), accentLight)
  const softColor = hslHex(bodyHue, Math.max(0.25, bodySat - 0.1), Math.min(0.94, bodyLight + 0.1))
  const deepColor = hslHex(bodyHue, Math.min(0.75, bodySat + 0.15), Math.max(0.32, bodyLight - 0.22))

  const hatColor = hslHex(hatHue, bp?.id === 'zombi' ? 0.68 : 0.58, bp?.id === 'maga' ? 0.48 : bp?.id === 'pirata' ? 0.46 : 0.56)
  const ribbonColor = hslHex(ribbonHue, 0.72, bp?.id === 'elfa' ? 0.84 : 0.68)
  const earColor = bp?.id === 'miedosa' ? hatColor : bodyColor
  const earInnerColor = hslHex(0.96, 0.72, 0.81)
  const hairColor = hslHex(hairHue, bp?.id === 'elfa' ? 0.42 : 0.5, bp?.id === 'elfa' ? 0.74 : 0.72)
  const outfitColor = hslHex(outfitHue, bp?.id === 'pirata' ? 0.42 : 0.64, bp?.id === 'pirata' ? 0.34 : bp?.id === 'ascetica' ? 0.58 : 0.46)
  const outfitTrim = hslHex(0.12, 0.82, 0.66)
  const irisTop = hslHex(irisHue, 0.72, 0.34)
  const irisBot = hslHex(wrapHue(irisHue + 0.04), 0.82, 0.64)
  const pupilColor = hslHex(irisHue, 0.6, 0.14)
  const browColor = bp?.id === 'elfa' ? '#3d4f28' : hslHex(bodyHue, 0.4, 0.2)
  const blushColor = BLUSH_COLORS[Math.floor(rng() * BLUSH_COLORS.length)]

  // 3. Patrón y proporciones
  const patternType = bp?.pattern ?? PATTERNS[Math.floor(rng() * PATTERNS.length)]
  const bodyPart = SKIN_PARTS.body[pieces.body] ?? SKIN_PARTS.body.chibi_round
  const earScale = (0.9 + rng() * 0.24) * (SKIN_PARTS.ears[pieces.ears]?.defaults.scale ?? 1)
  const earTilt = (rng() - 0.5) * 0.2
  const earDroop = (pieces.ears === 'droopy' ? 0.6 : pieces.ears === 'bunny' ? 0.2 : 0.08) + rng() * 0.12

  const eyeDef = SKIN_PARTS.eyes[pieces.eyes] ?? SKIN_PARTS.eyes.round
  const eyeScaleX = eyeDef.defaults.scaleX * (0.96 + rng() * 0.1)
  const eyeScaleY = eyeDef.defaults.scaleY * (0.96 + rng() * 0.1)
  const eyeAsym = pieces.eyes === 'asym' ? [1.14, 0.88] : [1, 1]
  const pupilSize = 0.068 + rng() * 0.014

  const browDef = SKIN_PARTS.brows[pieces.brows] ?? SKIN_PARTS.brows.soft
  const browBaseTilt = browDef.tilt + (rng() - 0.5) * 0.05
  const browThick = browDef.thick
  const cheekPuff = bodyPart.defaults.cheekPuff + ((traits.apetito ?? 0.5) > 0.75 ? 0.08 : 0)
  const patchSide = bp?.id === 'pirata' ? -1 : (rng() < 0.5 ? -1 : 1)
  const scarSide = -patchSide

  const palette = {
    body: bodyColor,
    bodyAccent: accentColor,
    bodySoft: softColor,
    bodyDeep: deepColor,
    hat: hatColor,
    ribbon: ribbonColor,
    ear: earColor,
    earInner: earInnerColor,
    hair: hairColor,
    outfit: outfitColor,
    outfitTrim,
    irisTop,
    irisBot,
    pupil: pupilColor,
    brow: browColor,
    blush: blushColor,
    gold: '#f4c542',
    cream: '#f4e8cc',
  }

  // 4. Árbol estructurado de piezas + resumen legible
  const parts = {
    body: { ...bodyPart, color: bodyColor, scale: bodyPart.defaults.scale },
    hat: { ...(SKIN_PARTS.hat[pieces.hat] ?? SKIN_PARTS.hat.none), color: hatColor, accentColor: ribbonColor, tilt: (SKIN_PARTS.hat[pieces.hat]?.defaults.tilt ?? 0) + (rng() - 0.5) * 0.08 },
    ears: { ...(SKIN_PARTS.ears[pieces.ears] ?? SKIN_PARTS.ears.none), color: earColor, innerColor: earInnerColor, scale: earScale, tilt: earTilt, droop: earDroop },
    hair: { ...(SKIN_PARTS.hair[pieces.hair] ?? SKIN_PARTS.hair.none), color: hairColor },
    eyes: { ...eyeDef, irisTop, irisBot, pupilColor, stitchedSide: 1 },
    brows: { ...browDef, color: browColor, tilt: browBaseTilt, thick: browThick },
    mouth: { ...(SKIN_PARTS.mouth[pieces.mouth] ?? SKIN_PARTS.mouth.curva), width: 0.94 + rng() * 0.14 },
    faceExtras: pieces.faceExtras.map((eid) => ({
      ...(SKIN_PARTS.faceExtras[eid] ?? { id: eid, label: eid, emoji: '✨', category: 'faceExtras', defaults: {} }),
      side: eid === 'patch' ? patchSide : eid === 'scar' ? scarSide : 1,
    })),
    neckWear: { ...(SKIN_PARTS.neckWear[pieces.neckWear] ?? SKIN_PARTS.neckWear.none), color: outfitColor, trimColor: outfitTrim, accentColor: ribbonColor },
    backExtras: pieces.backExtras.map((bid) => ({
      ...(SKIN_PARTS.backExtras[bid] ?? { id: bid, label: bid, emoji: '✨', category: 'backExtras', defaults: {} }),
      color: bid === 'cat_tail' || bid === 'devil_tail' ? bodyColor : bid === 'flower' ? ribbonColor : '#f8fafc',
      side: -patchSide,
    })),
  }

  const partsSummary = [
    parts.hat.id !== 'none' && parts.hat.label,
    parts.ears.id !== 'none' && parts.ears.label,
    parts.hair.id !== 'none' && parts.hair.label,
    parts.eyes.label,
    parts.neckWear.id !== 'none' && parts.neckWear.label,
    ...parts.faceExtras.filter((e) => e.id !== 'blush').map((e) => e.label),
    ...parts.backExtras.map((e) => e.label),
  ].filter(Boolean)

  const presetMeta = bp ? SKIN_PRESETS[bp.id] : null
  const displayName = buildGeneratedName(presetMeta?.name ?? family.name, pieces, rng, isSheetPreset, bp?.id)
  const displayEmoji = presetMeta?.emoji ?? family.emoji

  return {
    seed,
    id: bp?.id ?? family.id,
    name: displayName,
    emoji: displayEmoji,
    family: { id: bp?.id ?? family.id, name: displayName, emoji: displayEmoji },
    isPreset: isSheetPreset,
    palette,
    parts,
    partsSummary,
    baseHue: bodyHue,
    accentHue,
    accentLight,
    baseColor: bodyColor,
    accentColor,
    softColor,
    deepColor,
    patternType,
    patternIntensity: 0.25 + rng() * 0.4,
    patternScale: 0.8 + rng() * 0.55,
    bodyScale: parts.body.scale,
    hatColor,
    ribbonColor,
    earColor,
    earInnerColor,
    earScale,
    earTilt,
    earDroop,
    eyeStyle: pieces.eyes,
    eyeScaleX,
    eyeScaleY,
    eyeAsym,
    irisTop,
    irisBot,
    pupilSize,
    pupilColor,
    hasCatchlight: pieces.eyes !== 'zen',
    browThick,
    browBaseTilt,
    browColor,
    mouthType: pieces.mouth,
    mouthWidth: parts.mouth.width,
    blushColor,
    blushBoost: (pieces.ears === 'cat' || pieces.eyes === 'starry' ? 1.15 : 0.88) + rng() * 0.22,
    patchSide,
    scarSide,
    cheekPuff,
    hasPatch: pieces.faceExtras.includes('patch'),
    hasScar: pieces.faceExtras.includes('scar'),
    hasWhiskers: pieces.faceExtras.includes('whiskers'),
    hasStitch: pieces.faceExtras.includes('stitch'),
    hasBandage: pieces.faceExtras.includes('bandage'),
    hasFreckles: pieces.faceExtras.includes('freckles'),
    hasGlasses: pieces.faceExtras.includes('glasses'),
    hasVisor: pieces.faceExtras.includes('visor'),
    hasCrumbs: pieces.faceExtras.includes('crumbs'),
    hasEarring: pieces.backExtras.includes('earring'),
    hasPrayerHands: pieces.backExtras.includes('prayer_hands'),
    hasDrumstick: pieces.backExtras.includes('drumstick'),
  }
}

export const buildSkin = generateSkin

// ═══════════════════════════ BOCAS PROCEDURALES SUAVES ═══════════════════════════

export function SkinMouth({ mouthType }) {
  const mDark = getMat('#2c1328', 0.65, 0)
  const mWhite = getMat('#f8fafc', 0.5, 0)
  const mMouthIn = getMat('#e85d75', 0.6, 0)

  if (mouthType === 'w') {
    return grp({ scale: 0.82 },
      msh({ geometry: GEO.torusArc, material: mDark, position: [-0.088, 0.02, 0], rotation: [0, 0, Math.PI], scale: [0.095, 0.095, 0.14] }),
      msh({ geometry: GEO.torusArc, material: mDark, position: [0.088, 0.02, 0], rotation: [0, 0, Math.PI], scale: [0.095, 0.095, 0.14] }),
    )
  }

  if (mouthType === 'zigzag') {
    return grp({ scale: 0.78 },
      ...[-0.135, -0.045, 0.045, 0.135].map((x, i) =>
        msh({
          key: i,
          geometry: GEO.capsule,
          material: mDark,
          position: [x, i % 2 === 0 ? 0.015 : -0.015, 0],
          rotation: [0, 0, i % 2 === 0 ? -0.58 : 0.58],
          scale: [0.026, 0.075, 0.026],
        })
      ),
    )
  }

  if (mouthType === 'dientes') {
    return grp({ scale: 0.84 },
      msh({ geometry: GEO.torusArc, material: mDark, position: [-0.082, 0.01, 0], rotation: [0, 0, Math.PI], scale: [0.09, 0.09, 0.13] }),
      msh({ geometry: GEO.torusArc, material: mDark, position: [0.082, 0.01, 0], rotation: [0, 0, Math.PI], scale: [0.09, 0.09, 0.13] }),
      msh({ geometry: GEO.capsule, material: mWhite, position: [-0.075, -0.032, 0.018], scale: [0.026, 0.038, 0.02] }),
      msh({ geometry: GEO.capsule, material: mWhite, position: [0.075, -0.032, 0.018], scale: [0.026, 0.038, 0.02] }),
    )
  }

  if (mouthType === 'open') {
    return grp({ scale: 0.88 },
      msh({ geometry: GEO.pillDisc, material: mDark, position: [0, 0.02, 0], scale: [0.16, 0.13, 0.16] }),
      msh({ geometry: GEO.pillDisc, material: mMouthIn, position: [0, -0.015, 0.015], scale: [0.11, 0.075, 0.14] }),
    )
  }

  if (mouthType === 'o') {
    return msh({ geometry: GEO.sphere, material: mMouthIn, scale: [0.072, 0.088, 0.05] })
  }

  return msh({ geometry: GEO.torusArc, material: mDark, rotation: [0, 0, Math.PI], scale: [0.14, 0.14, 0.15] })
}

// ═══════════════════════════ RENDERIZADORES POR RANURA ═══════════════════════════

function renderHat(hat, pal) {
  const mHat = getMat(hat.color, 0.74, 0.02)
  const mRib = getMat(hat.accentColor ?? pal.ribbon, 0.65, 0.05)
  const mCream = getMat(pal.cream, 0.76, 0.02)
  const mGold = getMat(pal.gold, 0.28, 0.72, null, 1, false)
  const mDark = getMat('#22172b', 0.65, 0.02)
  const mGemGreen = getMat('#34d399', 0.22, 0.15, '#10b981', 1, false)
  const mSkull = getSkullMat()

  switch (hat.id) {
    case 'conical_elf':
      return grp({ position: [0, 0.64, -0.06], rotation: [-0.26, 0, hat.tilt ?? 0.12] },
        msh({ geometry: GEO.hatElf, material: mHat, scale: 1.05 }),
        msh({ geometry: GEO.torusThick, material: mCream, position: [0, 0.02, 0], rotation: [Math.PI / 2, 0, 0], scale: [0.68, 0.68, 0.55] }),
        msh({ geometry: GEO.diamond, material: mGemGreen, position: [0, 0.05, 0.84], scale: [0.09, 0.12, 0.08] }),
        ...[-1, 1].map((sg) =>
          msh({ key: sg, geometry: GEO.capsule, material: mGold, position: [sg * 0.22, 0.04, 0.8], rotation: [0, 0, sg * 1.15], scale: [0.025, 0.11, 0.025] })
        ),
        msh({ geometry: GEO.sphere, material: mCream, position: [0.74, 0.54, -0.25], scale: 0.18 }),
      )

    case 'wizard':
      return grp({ position: [0, 0.66, -0.06], rotation: [-0.2, 0, hat.tilt ?? -0.08] },
        msh({ geometry: GEO.hatWizardBrim, material: mHat, position: [0, -0.02, 0], scale: 1.02 }),
        msh({ geometry: GEO.hatWizardCrown, material: mHat, position: [0, 0.04, 0], scale: 1.05 }),
        msh({ geometry: GEO.torus, material: mRib, position: [0, 0.08, 0], rotation: [Math.PI / 2, 0, 0], scale: [0.56, 0.56, 0.36] }),
        msh({ geometry: GEO.star5, material: mGold, position: [0, 0.22, 0.56], rotation: [-0.2, 0, 0], scale: 0.18 }),
        msh({ geometry: GEO.capsuleThin, material: mGold, position: [0.66, 0.72, -0.2], scale: [0.014, 0.06, 0.014] }),
        msh({ geometry: GEO.star5, material: mGold, position: [0.66, 0.58, -0.2], scale: 0.11 }),
      )

    case 'beret':
      return grp({ position: [0.06, 0.84, -0.06], rotation: [-0.18, 0, hat.tilt ?? -0.22] },
        msh({ geometry: GEO.sphere, material: mHat, scale: [0.84, 0.28, 0.84] }),
        msh({ geometry: GEO.torus, material: mRib, position: [0, -0.08, 0], rotation: [Math.PI / 2, 0, 0], scale: [0.62, 0.62, 0.35] }),
        msh({ geometry: GEO.capsule, material: mDark, position: [0, 0.28, 0], scale: [0.04, 0.09, 0.04] }),
      )

    case 'hood':
      return grp(null,
        msh({ geometry: GEO.hoodCap, material: mHat, position: [0, 0.04, -0.06], rotation: [-Math.PI * 0.48, 0, 0] }),
        msh({ geometry: GEO.torusThick, material: mHat, position: [0, 0.04, 0.18], rotation: [0.12, 0, 0], scale: [0.95, 0.98, 0.85] }),
      )

    case 'bandana': {
      const mBand = getMat('#b8333a', 0.72, 0.02)
      return grp(null,
        msh({ geometry: GEO.bandanaCap, material: mBand, position: [0, 0.08, -0.02], rotation: [-0.28, 0, 0] }),
        msh({ geometry: GEO.torus, material: mBand, position: [0, 0.42, -0.06], rotation: [Math.PI / 2 - 0.26, 0, 0], scale: [0.88, 0.88, 0.48] }),
        msh({ geometry: GEO.plane, material: mSkull, position: [0, 0.64, 0.74], rotation: [-0.52, 0, 0], scale: [0.34, 0.34, 1] }),
        grp({ position: [-0.88, 0.44, -0.18], rotation: [0, -0.5, 0.45] },
          msh({ geometry: GEO.sphere, material: mBand, scale: 0.13 }),
          msh({ geometry: GEO.bandanaTail, material: mBand, position: [0, 0, 0], rotation: [0.2, 0.3, 0.2], scale: 0.9 }),
          msh({ geometry: GEO.bandanaTail, material: mBand, position: [0.02, -0.04, -0.02], rotation: [-0.25, -0.2, -0.35], scale: 0.78 }),
        ),
      )
    }

    case 'nightcap':
      return grp({ position: [0, 0.68, -0.08], rotation: [-0.15, 0, hat.tilt ?? 0.18] },
        msh({ geometry: GEO.hatNightcap, material: mHat, scale: 1.05 }),
        msh({ geometry: GEO.torusThick, material: mCream, position: [0, 0.02, 0], rotation: [Math.PI / 2, 0, 0], scale: [0.64, 0.64, 0.48] }),
        msh({ geometry: GEO.sphere, material: mCream, position: [0.7, 0.04, -0.36], scale: 0.16 }),
      )

    case 'crown':
      return grp({ position: [0, 0.94, 0.04], rotation: [-0.12, 0, 0] },
        msh({ geometry: GEO.torus, material: mGold, rotation: [Math.PI / 2, 0, 0], scale: [0.42, 0.42, 0.75] }),
        ...[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2
          return grp({ key: i, position: [Math.cos(a) * 0.4, 0.14, Math.sin(a) * 0.4] },
            msh({ geometry: GEO.capsule, material: mGold, scale: [0.06, 0.14, 0.06] }),
            msh({ geometry: GEO.sphere, material: i === 0 ? getMat('#fb7185', 0.22, 0.1, null, 1, false) : mGold, position: [0, 0.12, 0], scale: 0.07 }),
          )
        }),
      )

    case 'halo':
      return msh({
        geometry: GEO.torusThin,
        material: getMat('#fde047', 0.25, 0.35, '#facc15', 1, false),
        position: [0, 1.24, -0.02],
        rotation: [Math.PI / 2, 0, 0],
        scale: [0.56, 0.56, 0.95],
      })

    case 'flower_crown': {
      const mLeaf = getMat('#5ca44b', 0.72, 0.02)
      const mPetal = getMat(hat.accentColor ?? '#f9a8d4', 0.7, 0.02)
      return grp({ position: [0.22, 0.92, 0.12], rotation: [0.1, 0, -0.2] },
        msh({ geometry: GEO.capsule, material: mLeaf, position: [0, -0.05, 0], scale: [0.025, 0.14, 0.025] }),
        ...[0, 1, 2, 3, 4].map((i) => {
          const a = (i / 5) * Math.PI * 2
          return msh({
            key: i,
            geometry: GEO.sphere,
            material: mPetal,
            position: [Math.cos(a) * 0.11, 0.1, Math.sin(a) * 0.11],
            scale: [0.075, 0.04, 0.075],
          })
        }),
        msh({ geometry: GEO.sphere, material: mGold, position: [0, 0.11, 0], scale: 0.06 }),
      )
    }

    case 'bow':
      return grp({ position: [0.35, 0.88, 0.22], rotation: [-0.2, 0.25, -0.35] },
        ...[-1, 1].map((sg) =>
          msh({ key: sg, geometry: GEO.sphere, material: mRib, position: [sg * 0.18, 0, 0], rotation: [0, 0, sg * 0.22], scale: [0.2, 0.14, 0.09] })
        ),
        msh({ geometry: GEO.sphere, material: mRib, scale: 0.09 }),
      )

    case 'brain': {
      const mBrain = getMat('#f48fb1', 0.58, 0.04)
      const lobes = [
        [0, 0, 0, 0.16],
        [0.14, -0.05, 0.05, 0.14],
        [-0.12, 0.06, 0.04, 0.14],
        [0.08, 0.09, -0.06, 0.13],
        [-0.08, -0.08, 0.09, 0.12],
        [0.18, -0.14, 0.08, 0.11],
      ]
      return grp({ position: [0.44, 0.78, 0.14], rotation: [0.1, 0.25, -0.4] },
        ...lobes.map(([x, y, z, s], i) =>
          msh({ key: i, geometry: GEO.sphere, material: mBrain, position: [x, y, z], scale: [s * 1.1, s * 0.9, s] })
        ),
      )
    }

    default:
      return null
  }
}

function renderEars(ears, pal) {
  const mEar = getMat(ears.color, 0.74, 0.02)
  const mEarIn = getMat(ears.innerColor ?? pal.earInner, 0.72, 0.02)
  const mGold = getMat(pal.gold, 0.28, 0.72, null, 1, false)
  const s = ears.scale ?? 1
  const tilt = ears.tilt ?? 0
  const droop = ears.droop ?? 0

  switch (ears.id) {
    case 'cat':
      return grp(null,
        ...[-1, 1].map((sg) =>
          grp({
            key: sg,
            position: [sg * 0.54, 0.68, 0.06],
            rotation: [tilt * 0.4, sg * 0.16, -sg * (0.36 + droop * 0.15)],
            scale: [0.28 * s, 0.44 * s, 0.24 * s],
          },
            msh({ geometry: GEO.earCat, material: mEar }),
            msh({ geometry: GEO.earCat, material: mEarIn, position: [0, 0.06, 0.18], scale: [0.62, 0.72, 0.55] }),
          )
        ),
      )

    case 'elf':
      return grp(null,
        ...[-1, 1].map((sg) =>
          grp({
            key: sg,
            position: [sg * 0.88, 0.18, 0.02],
            rotation: [tilt * 0.35, sg * 0.18, -sg * (1.22 + droop * 0.25)],
            scale: [0.2 * s, 0.64 * s, 0.22 * s],
          },
            msh({ geometry: GEO.earElf, material: mEar }),
            msh({ geometry: GEO.earElf, material: mEarIn, position: [0, 0.08, 0.14], scale: [0.56, 0.76, 0.5] }),
          )
        ),
      )

    case 'bunny':
      return grp(null,
        ...[-1, 1].map((sg) =>
          grp({
            key: sg,
            position: [sg * 0.48, 0.72, -0.06],
            rotation: [-0.18 - droop * 0.35, sg * 0.1, -sg * (0.34 + droop * 0.4)],
            scale: [0.22 * s, 0.68 * s, 0.2 * s],
          },
            msh({ geometry: GEO.earBunny, material: mEar }),
            msh({ geometry: GEO.earBunny, material: mEarIn, position: [0, 0.06, 0.14], scale: [0.55, 0.76, 0.48] }),
          )
        ),
      )

    case 'bear':
      return grp(null,
        ...[-1, 1].map((sg) =>
          grp({
            key: sg,
            position: [sg * 0.6, 0.74, 0.04],
            rotation: [0.05, sg * 0.12, -sg * 0.45],
            scale: [0.26 * s, 0.26 * s, 0.2 * s],
          },
            msh({ geometry: GEO.earBear, material: mEar }),
            msh({ geometry: GEO.earBear, material: mEarIn, position: [0, 0.08, 0.16], scale: [0.58, 0.58, 0.5] }),
          )
        ),
      )

    case 'droopy':
      return grp(null,
        ...[-1, 1].map((sg) =>
          grp({
            key: sg,
            position: [sg * 0.88, 0.3, 0.06],
            rotation: [0.18, sg * 0.15, -sg * (2.25 + droop * 0.3)],
            scale: [0.22 * s, 0.58 * s, 0.2 * s],
          },
            msh({ geometry: GEO.earBunny, material: mEar }),
            msh({ geometry: GEO.earBunny, material: mEarIn, position: [0, 0.08, 0.12], scale: [0.55, 0.72, 0.45] }),
          )
        ),
      )

    case 'horns':
      return grp(null,
        ...[-1, 1].map((sg) =>
          msh({
            key: sg,
            geometry: GEO.hornCurved,
            material: getMat('#e2c799', 0.55, 0.1),
            position: [sg * 0.44, 0.78, 0.14],
            rotation: [-0.2, 0, -sg * 0.45],
            scale: [sg * 0.9 * s, 0.9 * s, 0.9 * s],
          })
        ),
      )

    case 'antennae':
      return grp(null,
        ...[-1, 1].map((sg) =>
          grp({ key: sg, position: [sg * 0.34, 0.86, 0.08], rotation: [0.1, 0, -sg * 0.34] },
            msh({ geometry: GEO.capsuleThin, material: mGold, position: [0, 0.18, 0], scale: [0.025, 0.16, 0.025] }),
            msh({ geometry: GEO.star5, material: mGold, position: [0, 0.38, 0], scale: 0.11 * s }),
          )
        ),
      )

    default:
      return null
  }
}

function renderHair(hair) {
  if (!hair || hair.id === 'none') return null
  const mHair = getMat(hair.color, 0.74, 0.02)

  if (hair.id === 'bangs_elf') {
    return grp(null,
      msh({ geometry: GEO.hairLock, material: mHair, position: [0, 0.76, 0.72], rotation: [0.25, 0, 0.18], scale: [1.1, 0.78, 0.9] }),
      msh({ geometry: GEO.hairLock, material: mHair, position: [-0.24, 0.74, 0.66], rotation: [0.28, -0.25, 0.55], scale: [0.95, 0.72, 0.85] }),
      msh({ geometry: GEO.hairLock, material: mHair, position: [0.24, 0.74, 0.66], rotation: [0.28, 0.25, -0.55], scale: [0.95, 0.72, 0.85] }),
      ...[-1, 1].map((sg) =>
        msh({ key: sg, geometry: GEO.hairLock, material: mHair, position: [sg * 0.76, 0.42, 0.34], rotation: [0.1, sg * 0.4, -sg * 0.2], scale: [0.95, 1.05, 0.85] })
      ),
    )
  }

  if (hair.id === 'curls_mage') {
    return grp(null,
      msh({ geometry: GEO.hairLock, material: mHair, position: [0.04, 0.72, 0.76], rotation: [0.3, 0, -0.3], scale: [1.15, 0.72, 0.9] }),
      msh({ geometry: GEO.hairLock, material: mHair, position: [-0.28, 0.68, 0.68], rotation: [0.25, -0.3, 0.45], scale: [1.05, 0.78, 0.9] }),
      ...[-1, 1].map((sg) =>
        grp({ key: sg },
          msh({ geometry: GEO.hairLock, material: mHair, position: [sg * 0.74, 0.38, 0.4], rotation: [0.08, sg * 0.35, -sg * 0.18], scale: [1.15, 1.1, 0.95] }),
          msh({ geometry: GEO.sphere, material: mHair, position: [sg * 0.84, -0.08, 0.28], scale: [0.16, 0.16, 0.15] }),
        )
      ),
    )
  }

  if (hair.id === 'tufts_zombie') {
    const tufts = [
      [-0.42, 0.84, 0.34, 0.2, -0.2, 0.7, 1.0],
      [-0.12, 0.94, 0.28, 0.25, 0, 0.35, 1.1],
      [0.14, 0.92, 0.25, 0.2, 0.15, -0.35, 0.95],
      [-0.68, 0.66, 0.24, 0.15, -0.4, 0.9, 1.0],
      [-0.84, 0.36, 0.2, 0.1, -0.5, 1.15, 0.95],
      [0.8, 0.42, 0.22, 0.1, 0.45, -1.05, 0.95],
    ]
    return grp(null,
      ...tufts.map(([x, y, z, rx, ry, rz, sc], i) =>
        msh({ key: i, geometry: GEO.hairLock, material: mHair, position: [x, y, z], rotation: [rx, ry, rz], scale: [sc, sc * 0.85, sc] })
      ),
    )
  }

  return null
}

function renderStitchCross(x, y, z, rx, ry, rz, mat, scale = 1) {
  return grp({ position: [x, y, z], rotation: [rx, ry, rz], scale },
    msh({ geometry: GEO.capsuleThin, material: mat, scale: [0.014, 0.095, 0.014] }),
    ...[-0.065, 0, 0.065].map((py, i) =>
      msh({ key: i, geometry: GEO.capsuleThin, material: mat, position: [0, py, 0], rotation: [0, 0, Math.PI / 2], scale: [0.012, 0.035, 0.012] })
    ),
  )
}

function renderFaceExtras(extras, skin) {
  const mDark = getMat('#28192e', 0.7, 0.02)
  const mScar = getMat('#b83b56', 0.65, 0.02)
  const mBand = getMat('#f5d0a9', 0.72, 0.02)
  const mFreckle = getMat('#8c4f3a', 0.75, 0, null, 0.7)
  const mCrumb = getMat('#d97706', 0.75, 0)
  const mGold = getMat(skin.palette.gold, 0.3, 0.7, null, 1, false)
  const mSkull = getSkullMat()

  return grp(null,
    extras.map((ex) => {
      if (ex.id === 'patch') {
        const sg = ex.side ?? -1
        return grp({ key: 'patch' },
          msh({ geometry: GEO.pillDisc, material: mDark, position: [sg * 0.35, 0.14, 0.94], rotation: [0, sg * 0.28, 0], scale: [0.24, 0.22, 0.16] }),
          msh({ geometry: GEO.plane, material: mSkull, position: [sg * 0.35, 0.14, 0.975], rotation: [0, sg * 0.28, 0], scale: [0.22, 0.22, 1] }),
          msh({ geometry: GEO.capsuleThin, material: mDark, position: [sg * 0.08, 0.42, 0.84], rotation: [0.12, 0, sg * 0.58], scale: [0.024, 0.42, 0.024] }),
        )
      }
      if (ex.id === 'scar') {
        const sg = ex.side ?? 1
        return grp({ key: 'scar', position: [sg * 0.54, -0.06, 0.81], rotation: [0, sg * 0.52, -sg * 0.42] },
          msh({ geometry: GEO.capsuleThin, material: mScar, scale: [0.015, 0.085, 0.015] }),
          msh({ geometry: GEO.capsuleThin, material: mScar, position: [0, 0.04, 0], rotation: [0, 0, Math.PI / 2], scale: [0.012, 0.035, 0.012] }),
          msh({ geometry: GEO.capsuleThin, material: mScar, position: [0, -0.04, 0], rotation: [0, 0, Math.PI / 2], scale: [0.012, 0.035, 0.012] }),
        )
      }
      if (ex.id === 'stitch') {
        return grp({ key: 'stitch' },
          renderStitchCross(0.04, 0.56, 0.81, -0.45, 0.1, -0.65, mDark),
          renderStitchCross(-0.62, 0.02, 0.74, 0, -0.68, 0.45, mDark),
        )
      }
      if (ex.id === 'whiskers') {
        return grp({ key: 'whiskers' },
          ...[-1, 1].map((sg) =>
            grp({ key: sg, position: [sg * 0.74, -0.06, 0.64], rotation: [0, sg * 0.7, 0] },
              msh({ geometry: GEO.capsuleThin, material: mDark, position: [0, 0.045, 0], rotation: [0, 0, Math.PI / 2 + sg * 0.1], scale: [0.014, 0.12, 0.014] }),
              msh({ geometry: GEO.capsuleThin, material: mDark, position: [0, -0.035, 0], rotation: [0, 0, Math.PI / 2 - sg * 0.12], scale: [0.014, 0.11, 0.014] }),
            )
          ),
        )
      }
      if (ex.id === 'glasses') {
        return grp({ key: 'glasses', position: [0, 0.14, 0.96] },
          ...[-1, 1].map((sg) =>
            msh({ key: sg, geometry: GEO.torusThin, material: mGold, position: [sg * 0.34, 0, 0], rotation: [0, sg * 0.18, 0], scale: 0.24 })
          ),
          msh({ geometry: GEO.capsuleThin, material: mGold, position: [0, 0.02, 0.02], rotation: [0, 0, Math.PI / 2], scale: [0.016, 0.09, 0.016] }),
        )
      }
      if (ex.id === 'visor') {
        return grp({ key: 'visor', position: [0, 0.18, 0.96] },
          msh({ geometry: GEO.capsule, material: mDark, rotation: [0, 0, Math.PI / 2], scale: [0.22, 0.44, 0.1] }),
          msh({ geometry: GEO.capsule, material: getMat('#38bdf8', 0.2, 0.25, '#0284c7', 0.78, false), position: [0, 0, 0.035], rotation: [0, 0, Math.PI / 2], scale: [0.17, 0.4, 0.05] }),
        )
      }
      if (ex.id === 'bandage') {
        return msh({
          key: 'bandage',
          geometry: GEO.capsule,
          material: mBand,
          position: [0.56, -0.04, 0.82],
          rotation: [0, 0.56, 0.35],
          scale: [0.08, 0.12, 0.025],
        })
      }
      if (ex.id === 'freckles') {
        return grp({ key: 'freckles' },
          ...[-1, 1].map((sg) =>
            grp({ key: sg, position: [sg * 0.54, -0.02, 0.82], rotation: [0, sg * 0.6, 0] },
              msh({ geometry: GEO.sphere, material: mFreckle, position: [-0.04, 0.02, 0], scale: [0.02, 0.02, 0.01] }),
              msh({ geometry: GEO.sphere, material: mFreckle, position: [0.03, 0.03, 0], scale: [0.018, 0.018, 0.01] }),
              msh({ geometry: GEO.sphere, material: mFreckle, position: [0, -0.02, 0], scale: [0.02, 0.02, 0.01] }),
            )
          ),
        )
      }
      if (ex.id === 'crumbs') {
        return grp({ key: 'crumbs' },
          msh({ geometry: GEO.sphere, material: mCrumb, position: [-0.36, -0.18, 0.89], scale: 0.024 }),
          msh({ geometry: GEO.sphere, material: mCrumb, position: [-0.28, -0.24, 0.9], scale: 0.018 }),
          msh({ geometry: GEO.sphere, material: mCrumb, position: [0.34, -0.2, 0.89], scale: 0.022 }),
        )
      }
      return null
    }),
  )
}

function renderNeckWear(neck, pal) {
  if (!neck || neck.id === 'none') return null
  const mOutfit = getMat(neck.color ?? pal.outfit, 0.76, 0.02)
  const mTrim = getMat(neck.trimColor ?? pal.outfitTrim, 0.4, 0.45)
  const mRib = getMat(neck.accentColor ?? pal.ribbon, 0.68, 0.04)
  const mGold = getMat(pal.gold, 0.25, 0.75, null, 1, false)
  const mCream = getMat(pal.cream, 0.76, 0.02)
  const mWood = getMat('#6d442b', 0.62, 0.04)
  const mDark = getMat('#24182a', 0.68, 0.05)

  switch (neck.id) {
    case 'bell_collar':
      return grp(null,
        msh({ geometry: GEO.torus, material: mRib, position: [0, -0.44, 0.04], rotation: [Math.PI / 2 - 0.14, 0, 0], scale: [0.91, 0.91, 0.42] }),
        grp({ position: [0, -0.48, 0.93] },
          msh({ geometry: GEO.sphere, material: mGold, scale: 0.15 }),
          msh({ geometry: GEO.capsuleThin, material: mDark, position: [0, -0.04, 0.12], scale: [0.018, 0.05, 0.018] }),
          msh({ geometry: GEO.sphere, material: mDark, position: [0, 0.02, 0.135], scale: 0.032 }),
        ),
      )

    case 'tunic_clasp':
      return grp(null,
        msh({ geometry: GEO.tunicShell, material: mOutfit }),
        ...[-1, 1].map((sg) =>
          msh({ key: sg, geometry: GEO.capsule, material: mOutfit, position: [sg * 0.24, -0.42, 0.88], rotation: [0.22, sg * 0.35, -sg * 0.85], scale: [0.1, 0.22, 0.06] })
        ),
        msh({ geometry: GEO.sphere, material: mGold, position: [0, -0.42, 0.93], scale: 0.095 }),
      )

    case 'mage_cloak': {
      const mGem = getMat('#a855f7', 0.22, 0.15, '#9333ea', 1, false)
      return grp(null,
        msh({ geometry: GEO.tunicShell, material: mOutfit }),
        msh({ geometry: GEO.torusThin, material: mTrim, position: [0, -0.34, 0.03], rotation: [Math.PI / 2 - 0.15, 0, 0], scale: [0.97, 0.97, 0.6] }),
        msh({ geometry: GEO.diamond, material: mGem, position: [0, -0.42, 0.93], scale: [0.1, 0.13, 0.08] }),
        ...[-1, 1].map((sg) =>
          msh({ key: sg, geometry: GEO.star5, material: mGold, position: [sg * 0.56, -0.58, 0.72], rotation: [0.2, sg * 0.6, 0], scale: 0.075 })
        ),
      )
    }

    case 'pirate_coat': {
      const mBelt = getMat('#3d2318', 0.65, 0.05)
      return grp(null,
        msh({ geometry: GEO.tunicShell, material: mOutfit }),
        ...[-1, 1].map((sg) =>
          msh({ key: sg, geometry: GEO.capsule, material: mCream, position: [sg * 0.26, -0.4, 0.88], rotation: [0.25, sg * 0.3, -sg * 0.65], scale: [0.09, 0.2, 0.05] })
        ),
        msh({ geometry: GEO.torus, material: mBelt, position: [0, -0.56, 0.02], rotation: [Math.PI / 2 - 0.08, 0, 0], scale: [0.92, 0.92, 0.45] }),
        msh({ geometry: GEO.torusThin, material: mGold, position: [0, -0.56, 0.9], scale: [0.13, 0.11, 0.18] }),
      )
    }

    case 'tattered_bib':
      return grp(null,
        msh({ geometry: GEO.tatteredShell, material: mOutfit }),
        msh({ geometry: GEO.tatteredShell, material: mCream, position: [0, 0.02, 0.02], scale: [0.99, 0.9, 0.99] }),
      )

    case 'monk_robe': {
      const mRobe = getMat('#e59524', 0.76, 0.02)
      return grp(null,
        msh({ geometry: GEO.tunicShell, material: mCream }),
        msh({ geometry: GEO.torusThick, material: mRobe, position: [0, -0.45, 0.02], rotation: [Math.PI / 2 - 0.28, 0.22, 0], scale: [0.89, 0.89, 0.7] }),
        ...[-3, -2, -1, 0, 1, 2, 3].map((i) => {
          const ang = i * 0.28
          return msh({
            key: i,
            geometry: GEO.sphere,
            material: mWood,
            position: [Math.sin(ang) * 0.86, -0.36 - Math.cos(ang) * 0.14, Math.cos(ang) * 0.91],
            scale: 0.072,
          })
        }),
      )
    }

    case 'scarf':
      return grp(null,
        msh({ geometry: GEO.torusThick, material: mOutfit, position: [0, -0.4, 0.03], rotation: [Math.PI / 2 - 0.14, 0, 0], scale: [0.88, 0.88, 0.55] }),
        msh({ geometry: GEO.capsule, material: mOutfit, position: [0.32, -0.58, 0.82], rotation: [0.25, 0.2, -0.2], scale: [0.12, 0.24, 0.06] }),
      )

    case 'bib':
      return grp(null,
        msh({ geometry: GEO.pillDisc, material: mCream, position: [0, -0.5, 0.85], rotation: [0.35, 0, 0], scale: [0.42, 0.34, 0.2] }),
        msh({ geometry: GEO.torusThin, material: mRib, position: [0, -0.4, 0.04], rotation: [Math.PI / 2 - 0.12, 0, 0], scale: [0.9, 0.9, 0.5] }),
      )

    default:
      return null
  }
}

function renderBackExtras(backExtras, pal) {
  const mGold = getMat(pal.gold, 0.28, 0.72, null, 1, false)
  const mWhite = getMat('#f8fafc', 0.7, 0.02)
  const mMeat = getMat('#b8602c', 0.62, 0.04)
  const mBone = getMat('#f5ead6', 0.72, 0.02)

  return grp(null,
    backExtras.map((ex) => {
      if (ex.id === 'cat_tail') {
        return msh({ key: 'cat_tail', geometry: GEO.tailCat, material: getMat(ex.color, 0.74, 0.02), position: [0, -0.46, -0.82], rotation: [0.15, 0.1, 0] })
      }
      if (ex.id === 'pom_tail') {
        return msh({ key: 'pom_tail', geometry: GEO.sphere, material: mWhite, position: [0, -0.42, -0.98], scale: 0.22 })
      }
      if (ex.id === 'devil_tail') {
        return grp({ key: 'devil_tail', position: [0, -0.46, -0.82] },
          msh({ geometry: GEO.tailDevil, material: getMat(ex.color, 0.72, 0.02) }),
          msh({ geometry: GEO.diamond, material: getMat(ex.color, 0.72, 0.02), position: [0.22, 0.42, -0.45], scale: 0.09 }),
        )
      }
      if (ex.id === 'wings') {
        return grp({ key: 'wings' },
          ...[-1, 1].map((sg) =>
            msh({
              key: sg,
              geometry: GEO.wing,
              material: mWhite,
              position: [sg * 0.36, 0.1, -0.94],
              rotation: [0.15, sg * 0.55, sg * 0.22],
              scale: [sg * 0.48, 0.48, 0.48],
            })
          ),
        )
      }
      if (ex.id === 'earring') {
        return msh({
          key: 'earring',
          geometry: GEO.torusThin,
          material: mGold,
          position: [(ex.side ?? 1) * -0.98, -0.06, 0.08],
          rotation: [0, Math.PI / 2, 0],
          scale: 0.13,
        })
      }
      if (ex.id === 'drumstick') {
        return grp({ key: 'drumstick', position: [0, -0.34, 0.96], rotation: [0.15, 0.12, -0.55], scale: 0.52 },
          msh({ geometry: GEO.drumstickMeat, material: mMeat }),
          msh({ geometry: GEO.capsuleThin, material: mBone, position: [0, -0.52, 0], scale: [0.12, 0.18, 0.12] }),
          msh({ geometry: GEO.sphere, material: mBone, position: [-0.08, -0.76, 0], scale: 0.12 }),
          msh({ geometry: GEO.sphere, material: mBone, position: [0.08, -0.76, 0], scale: 0.12 }),
        )
      }
      if (ex.id === 'flower') {
        const mPet = getMat(ex.color ?? '#f472b6', 0.7, 0.02)
        return grp({ key: 'flower', position: [-0.62, 0.68, 0.42], rotation: [0.45, -0.5, 0.35], scale: 0.85 },
          ...[0, 1, 2, 3, 4].map((i) => {
            const a = (i / 5) * Math.PI * 2
            return msh({ key: i, geometry: GEO.sphere, material: mPet, position: [Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09], scale: [0.065, 0.035, 0.065] })
          }),
          msh({ geometry: GEO.sphere, material: mGold, position: [0, 0.02, 0], scale: 0.05 }),
        )
      }
      return null
    }),
  )
}

export function SkinAccessory({ skin }) {
  const { parts, palette } = skin
  return grp(null,
    renderHat(parts.hat, palette),
    renderEars(parts.ears, palette),
    renderHair(parts.hair),
    renderFaceExtras(parts.faceExtras, skin),
    renderNeckWear(parts.neckWear, palette),
    renderBackExtras(parts.backExtras, palette),
  )
}
