import * as THREE from 'three'
import { NODE_R, mulberry32 } from '../../../Core/world.js'

// Definición de los 10 biomas correspondientes a world.THEMES.
// Cada bioma aporta paleta propia (suelo, atmósfera, nubes, ciudad, luces),
// parámetros de relieve planetario y estilo arquitectónico.
export const BIOMES = {
  sombrio: {
    id: 'sombrio',
    name: 'Sombrío',
    emoji: '🌑',
    title: 'Bastión Sombrío',
    groundLow: '#0e0c18',
    groundMid: '#231e36',
    groundHigh: '#3d3359',
    atmoBase: '#5c3c92',
    atmoRim: '#b388ff',
    atmoPower: 3.4,
    atmoIntensity: 0.62,
    cloudColor: '#6d5b97',
    cloudOpacity: 0.34,
    cloudSpeed: 0.018,
    cityLight: '#b388ff',
    roadColor: '#1a1626',
    buildingColors: ['#2a233d', '#3a3054', '#4e3f6e', '#1f1a2e'],
    buildingRoughness: 0.72,
    buildingMetalness: 0.25,
    emissiveColor: '#a67cff',
    emissiveIntensity: 0.65,
    planetRoughness: 0.9,
    planetMetalness: 0.08,
    relief: 'craters',
    reliefAmp: 0.036,
    roofStyle: 'spire',
    creatureColor: '#c79dff',
  },
  bosque: {
    id: 'bosque',
    name: 'Bosque',
    emoji: '🌲',
    title: 'Arboleda Ancestral',
    groundLow: '#142b1c',
    groundMid: '#224d2e',
    groundHigh: '#3b7342',
    atmoBase: '#3ca367',
    atmoRim: '#a8f0c6',
    atmoPower: 2.8,
    atmoIntensity: 0.52,
    cloudColor: '#dff5e6',
    cloudOpacity: 0.26,
    cloudSpeed: 0.028,
    cityLight: '#88ff9e',
    roadColor: '#2d241c',
    buildingColors: ['#4a3525', '#5e442f', '#355c39', '#6e5138'],
    buildingRoughness: 0.78,
    buildingMetalness: 0.08,
    emissiveColor: '#ffe082',
    emissiveIntensity: 0.45,
    planetRoughness: 0.88,
    planetMetalness: 0.04,
    relief: 'mountains',
    reliefAmp: 0.032,
    roofStyle: 'gable',
    creatureColor: '#a8ff78',
  },
  mar: {
    id: 'mar',
    name: 'Mar',
    emoji: '🌊',
    title: 'Archipiélago Azul',
    groundLow: '#0b2d4d',
    groundMid: '#15567d',
    groundHigh: '#c7b88b',
    atmoBase: '#2787d9',
    atmoRim: '#9be7ff',
    atmoPower: 2.5,
    atmoIntensity: 0.6,
    cloudColor: '#eef8ff',
    cloudOpacity: 0.3,
    cloudSpeed: 0.038,
    cityLight: '#5ce1e6',
    roadColor: '#293e52',
    buildingColors: ['#d9e4ec', '#b7ccd9', '#4a7c9b', '#e6dfd3'],
    buildingRoughness: 0.52,
    buildingMetalness: 0.16,
    emissiveColor: '#7ef9ff',
    emissiveIntensity: 0.5,
    planetRoughness: 0.42,
    planetMetalness: 0.22,
    relief: 'ocean',
    reliefAmp: 0.028,
    roofStyle: 'dome',
    creatureColor: '#8cf4ff',
  },
  desierto: {
    id: 'desierto',
    name: 'Desierto',
    emoji: '🌵',
    title: 'Dunas Doradas',
    groundLow: '#6e441f',
    groundMid: '#a86f34',
    groundHigh: '#d9a45b',
    atmoBase: '#e08e3c',
    atmoRim: '#ffe0a3',
    atmoPower: 3.0,
    atmoIntensity: 0.54,
    cloudColor: '#f5dfc0',
    cloudOpacity: 0.15,
    cloudSpeed: 0.042,
    cityLight: '#ffca64',
    roadColor: '#4f3a24',
    buildingColors: ['#c99e6b', '#b08250', '#dec194', '#8f6138'],
    buildingRoughness: 0.84,
    buildingMetalness: 0.06,
    emissiveColor: '#ffb74d',
    emissiveIntensity: 0.44,
    planetRoughness: 0.9,
    planetMetalness: 0.05,
    relief: 'dunes',
    reliefAmp: 0.03,
    roofStyle: 'stepped',
    creatureColor: '#ffd180',
  },
  hielo: {
    id: 'hielo',
    name: 'Hielo',
    emoji: '❄️',
    title: 'Cumbre Glacial',
    groundLow: '#365878',
    groundMid: '#6ea1c9',
    groundHigh: '#d6efff',
    atmoBase: '#6ec6ff',
    atmoRim: '#ffffff',
    atmoPower: 2.6,
    atmoIntensity: 0.64,
    cloudColor: '#e8f7ff',
    cloudOpacity: 0.28,
    cloudSpeed: 0.035,
    cityLight: '#9be7ff',
    roadColor: '#365066',
    buildingColors: ['#8fc3e8', '#b8e0fa', '#6394bd', '#dff2ff'],
    buildingRoughness: 0.25,
    buildingMetalness: 0.35,
    emissiveColor: '#80e5ff',
    emissiveIntensity: 0.55,
    planetRoughness: 0.28,
    planetMetalness: 0.32,
    relief: 'glacier',
    reliefAmp: 0.034,
    roofStyle: 'spire',
    creatureColor: '#d0f4ff',
  },
  volcan: {
    id: 'volcan',
    name: 'Volcán',
    emoji: '🌋',
    title: 'Forja Volcánica',
    groundLow: '#ff521b',
    groundMid: '#361c1a',
    groundHigh: '#1f1517',
    atmoBase: '#e84a27',
    atmoRim: '#ff9d5c',
    atmoPower: 3.1,
    atmoIntensity: 0.68,
    cloudColor: '#4f3834',
    cloudOpacity: 0.38,
    cloudSpeed: 0.022,
    cityLight: '#ff6f3c',
    roadColor: '#261a1a',
    buildingColors: ['#2e2022', '#472a28', '#5e352b', '#1c1415'],
    buildingRoughness: 0.74,
    buildingMetalness: 0.28,
    emissiveColor: '#ff5722',
    emissiveIntensity: 0.78,
    planetRoughness: 0.85,
    planetMetalness: 0.14,
    relief: 'volcano',
    reliefAmp: 0.04,
    roofStyle: 'stepped',
    creatureColor: '#ff8a50',
  },
  cristal: {
    id: 'cristal',
    name: 'Cristal',
    emoji: '💎',
    title: 'Catedral Prismática',
    groundLow: '#2b1e4a',
    groundMid: '#4f3c87',
    groundHigh: '#8ee3f5',
    atmoBase: '#8a6eff',
    atmoRim: '#c4f5ff',
    atmoPower: 2.4,
    atmoIntensity: 0.62,
    cloudColor: '#d9caff',
    cloudOpacity: 0.2,
    cloudSpeed: 0.025,
    cityLight: '#80f5ff',
    roadColor: '#272042',
    buildingColors: ['#6c5ce7', '#a29bfe', '#74b9ff', '#55efc4'],
    buildingRoughness: 0.18,
    buildingMetalness: 0.55,
    emissiveColor: '#a8f9ff',
    emissiveIntensity: 0.65,
    planetRoughness: 0.22,
    planetMetalness: 0.5,
    relief: 'crystal',
    reliefAmp: 0.036,
    roofStyle: 'prism',
    creatureColor: '#a6f6ff',
  },
  nubes: {
    id: 'nubes',
    name: 'Nubes',
    emoji: '☁️',
    title: 'Reino Celeste',
    groundLow: '#5678a6',
    groundMid: '#8fb4db',
    groundHigh: '#eef6ff',
    atmoBase: '#82c0ff',
    atmoRim: '#ffffff',
    atmoPower: 2.2,
    atmoIntensity: 0.66,
    cloudColor: '#ffffff',
    cloudOpacity: 0.44,
    cloudSpeed: 0.045,
    cityLight: '#fff3b0',
    roadColor: '#6b85a8',
    buildingColors: ['#e3eefc', '#c7dcf5', '#f7faff', '#a5c4eb'],
    buildingRoughness: 0.46,
    buildingMetalness: 0.18,
    emissiveColor: '#ffe8a3',
    emissiveIntensity: 0.48,
    planetRoughness: 0.65,
    planetMetalness: 0.1,
    relief: 'sky',
    reliefAmp: 0.022,
    roofStyle: 'dome',
    creatureColor: '#ffffff',
  },
  neon: {
    id: 'neon',
    name: 'Neón',
    emoji: '🌃',
    title: 'Metrópolis Neón',
    groundLow: '#0b0e1f',
    groundMid: '#151c3b',
    groundHigh: '#253263',
    atmoBase: '#00d2ff',
    atmoRim: '#ff3cac',
    atmoPower: 2.9,
    atmoIntensity: 0.64,
    cloudColor: '#5c4b8a',
    cloudOpacity: 0.22,
    cloudSpeed: 0.032,
    cityLight: '#00f5d4',
    roadColor: '#11162b',
    buildingColors: ['#182040', '#232d59', '#121830', '#2d3b70'],
    buildingRoughness: 0.28,
    buildingMetalness: 0.62,
    emissiveColor: '#00f5d4',
    emissiveIntensity: 0.92,
    planetRoughness: 0.38,
    planetMetalness: 0.45,
    relief: 'grid',
    reliefAmp: 0.026,
    roofStyle: 'flat',
    creatureColor: '#ff4ecd',
  },
  jardin: {
    id: 'jardin',
    name: 'Jardín',
    emoji: '🌸',
    title: 'Edén en Flor',
    groundLow: '#1d3d28',
    groundMid: '#376b43',
    groundHigh: '#6ba368',
    atmoBase: '#57c98f',
    atmoRim: '#ffd1e6',
    atmoPower: 2.6,
    atmoIntensity: 0.56,
    cloudColor: '#ffeaf3',
    cloudOpacity: 0.25,
    cloudSpeed: 0.026,
    cityLight: '#ff9ecd',
    roadColor: '#3d332c',
    buildingColors: ['#d9c7b8', '#e8a5c4', '#7ab882', '#f2e4d8'],
    buildingRoughness: 0.62,
    buildingMetalness: 0.1,
    emissiveColor: '#ffb3d9',
    emissiveIntensity: 0.48,
    planetRoughness: 0.78,
    planetMetalness: 0.06,
    relief: 'terraces',
    reliefAmp: 0.028,
    roofStyle: 'gable',
    creatureColor: '#ffb8e0',
  },
}

/**
 * Elige de forma determinista el bioma de un nodo a partir de los temas
 * de los circuitos que lo tocan y la semilla propia del nodo (node.idx).
 */
export function resolveNodeBiome(node, world) {
  const rng = mulberry32(1337 + node.idx * 7919)
  const counts = new Map()
  for (const c of world?.circuits || []) {
    if (c.a === node.idx || c.b === node.idx) {
      const id = c.theme?.id
      if (id && BIOMES[id]) counts.set(id, (counts.get(id) || 0) + 1)
    }
  }
  if (counts.size === 0) {
    const keys = Object.keys(BIOMES)
    return BIOMES[keys[Math.floor(rng() * keys.length)]]
  }
  let max = 0
  for (const v of counts.values()) if (v > max) max = v
  const top = []
  for (const [k, v] of counts.entries()) if (v === max) top.push(k)
  const chosen = top[Math.floor(rng() * top.length)]
  return BIOMES[chosen]
}

function fbmBase(x, y, z, phase = 0) {
  const o1 = Math.sin(x * 0.85 + 0.4 + phase) * Math.sin(y * 0.78 + 1.1) * Math.sin(z * 0.82 + 2.0)
  const o2 = Math.sin(x * 1.85 + z * 1.2 + phase) * Math.cos(y * 1.65 - x * 0.7) * 0.45
  const o3 = Math.cos(x * 3.1 - y * 2.4 + z * 2.7) * 0.2
  return o1 + o2 + o3
}

/**
 * Calcula el desplazamiento radial normalizado (-1..1 aprox) y el factor de color (0..1)
 * para un punto (x, y, z) sobre la esfera del planeta según su bioma.
 */
export function sampleBiomeRelief(x, y, z, biome, seedPhase) {
  const n = fbmBase(x, y, z, seedPhase)
  switch (biome.relief) {
    case 'craters': {
      const ridge = Math.abs(Math.sin(x * 1.4 + seedPhase) * Math.cos(z * 1.4) + Math.sin(y * 1.7) * 0.6)
      const crater = Math.max(0, 0.75 - ridge) * -1.4
      const h = n * 0.4 + crater
      const t = THREE.MathUtils.smoothstep(h, -0.9, 0.6)
      return { h, t }
    }
    case 'ocean': {
      const land = n * 0.9
      const h = land < 0.08 ? -0.35 : (land - 0.08) * 1.3
      const t = land < 0.08
        ? THREE.MathUtils.smoothstep(land, -0.8, 0.08) * 0.48
        : 0.52 + THREE.MathUtils.smoothstep(land, 0.08, 0.85) * 0.48
      return { h, t }
    }
    case 'dunes': {
      const dune = Math.sin(x * 1.9 + Math.sin(z * 1.1 + seedPhase) * 1.5) * 0.55
      const h = dune + n * 0.35
      const t = THREE.MathUtils.smoothstep(h, -0.75, 0.75)
      return { h, t }
    }
    case 'glacier': {
      const sharp = Math.abs(n) * 1.25 - 0.35
      const h = sharp
      const t = THREE.MathUtils.smoothstep(h, -0.3, 0.8)
      return { h, t }
    }
    case 'volcano': {
      const fissure = Math.abs(Math.sin(x * 2.1 + z * 1.7 + seedPhase) + Math.cos(y * 2.3) * 0.5)
      const isLava = fissure < 0.24
      const h = isLava ? -0.45 : Math.abs(n) * 0.95 + 0.1
      const t = isLava ? 0.05 : 0.35 + THREE.MathUtils.smoothstep(h, 0.1, 1.0) * 0.65
      return { h, t }
    }
    case 'crystal': {
      const steps = Math.round((n + 1) * 3.5) / 3.5 - 1
      const h = steps * 0.85
      const t = THREE.MathUtils.smoothstep(h, -0.7, 0.75)
      return { h, t }
    }
    case 'grid': {
      const gx = Math.abs(Math.sin(x * 2.2 + seedPhase))
      const gz = Math.abs(Math.sin(z * 2.2 - seedPhase))
      const plateau = (gx > 0.45 && gz > 0.45) ? 0.5 : -0.25
      const h = plateau + n * 0.2
      const t = THREE.MathUtils.smoothstep(h, -0.4, 0.65)
      return { h, t }
    }
    case 'terraces': {
      const terr = Math.round((n + 0.8) * 3) / 3 - 0.8
      const h = terr * 0.75 + n * 0.25
      const t = THREE.MathUtils.smoothstep(h, -0.65, 0.7)
      return { h, t }
    }
    case 'sky': {
      const h = n * 0.55
      const t = THREE.MathUtils.smoothstep(h, -0.5, 0.55)
      return { h, t }
    }
    case 'mountains':
    default: {
      const h = n * 0.85
      const t = THREE.MathUtils.smoothstep(h, -0.55, 0.75)
      return { h, t }
    }
  }
}

/**
 * Construye la geometría del planeta con relieve y paleta de colores por vértice según el bioma.
 */
export function buildBiomePlanetGeo(node, biome) {
  const g = new THREE.SphereGeometry(NODE_R - 0.02, 80, 60)
  const p = g.attributes.position
  const cols = new Float32Array(p.count * 3)
  const low = new THREE.Color(biome.groundLow)
  const mid = new THREE.Color(biome.groundMid)
  const high = new THREE.Color(biome.groundHigh)
  const c = new THREE.Color()
  const v = new THREE.Vector3()
  const rng = mulberry32(4242 + node.idx * 97)
  const seedPhase = rng() * Math.PI * 2
  const amp = biome.reliefAmp ?? 0.024

  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const { h, t } = sampleBiomeRelief(v.x, v.y, v.z, biome, seedPhase)
    v.multiplyScalar(1 + (h * amp) / NODE_R * 6.5)
    p.setXYZ(i, v.x, v.y, v.z)
    if (t < 0.5) c.lerpColors(low, mid, t * 2)
    else c.lerpColors(mid, high, (t - 0.5) * 2)
    cols.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  g.computeVertexNormals()
  return g
}
