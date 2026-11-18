import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const BUILDING_TYPES = ['casa', 'torre', 'rascacielos', 'comercio', 'estacion', 'parque']

// Normaliza una geometría para fusión segura: no-indexada y con position, normal, uv y color lineal.
function prepGeo(geo, tintHex = '#ffffff') {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  if (!g.attributes.normal) g.computeVertexNormals()
  const pos = g.attributes.position
  if (!g.attributes.uv) {
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) + 0.5
      uv[i * 2 + 1] = pos.getY(i)
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  if (!g.attributes.color) {
    const col = new THREE.Color(tintHex)
    const cArr = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      cArr[i * 3] = col.r
      cArr[i * 3 + 1] = col.g
      cArr[i * 3 + 2] = col.b
    }
    g.setAttribute('color', new THREE.BufferAttribute(cArr, 3))
  }
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv' && k !== 'color') g.deleteAttribute(k)
  }
  return g
}

function mergeParts(parts) {
  const prepped = parts.map((p) => (Array.isArray(p) ? prepGeo(p[0], p[1]) : prepGeo(p)))
  const merged = mergeGeometries(prepped, false)
  prepped.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}

function makeLathe(points, segs = 10, tintHex = '#ffffff') {
  const vecs = points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y))
  const g = new THREE.LatheGeometry(vecs, segs)
  g.computeVertexNormals()
  return prepGeo(g, tintHex)
}

// ─── Estilos arquitectónicos en caché de módulo (base y=0, altura 1, ancho ~1) ───

function buildSpireSet() {
  const house = mergeParts([
    [new THREE.BoxGeometry(0.86, 0.58, 0.86).translate(0, 0.29, 0), '#e8e8f2'],
    [new THREE.ConeGeometry(0.68, 0.42, 4).rotateY(Math.PI / 4).translate(0, 0.79, 0), '#c5c9e0'],
  ])
  const tower = makeLathe([
    [0.44, 0], [0.4, 0.2], [0.34, 0.52], [0.22, 0.76], [0.09, 0.94], [0.001, 1.0],
  ], 8, '#e6e8f5')
  const accent = mergeParts([
    [new THREE.CylinderGeometry(0.32, 0.42, 0.55, 6).translate(0, 0.275, 0), '#e6e8f5'],
    [new THREE.ConeGeometry(0.36, 0.45, 6).translate(0, 0.775, 0), '#d0d5ed'],
  ])
  return [house, tower, accent]
}

function buildGableSet() {
  const house = mergeParts([
    [new THREE.BoxGeometry(0.88, 0.56, 0.84).translate(0, 0.28, 0), '#f2eadc'],
    [new THREE.CylinderGeometry(0.02, 0.66, 0.44, 4).rotateY(Math.PI / 4).translate(0, 0.78, 0), '#d6a478'],
  ])
  const tower = mergeParts([
    [new THREE.CylinderGeometry(0.34, 0.44, 0.66, 10).translate(0, 0.33, 0), '#f0e8da'],
    [new THREE.ConeGeometry(0.48, 0.36, 10).translate(0, 0.82, 0), '#c99368'],
  ])
  const accent = makeLathe([
    [0.44, 0], [0.46, 0.14], [0.4, 0.52], [0.48, 0.64], [0.32, 0.86], [0.001, 1.0],
  ], 10, '#ebe5d8')
  return [house, tower, accent]
}

function buildDomeSet() {
  const house = mergeParts([
    [new THREE.CylinderGeometry(0.46, 0.48, 0.5, 14).translate(0, 0.25, 0), '#f5f8fc'],
    [new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.08, 1).translate(0, 0.5, 0), '#d8e8f8'],
  ])
  const tower = makeLathe([
    [0.46, 0], [0.42, 0.35], [0.35, 0.68], [0.4, 0.78], [0.28, 0.94], [0.001, 1.0],
  ], 14, '#f0f5fc')
  const accent = mergeParts([
    [new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12).translate(0, 0.175, 0), '#f0f5fc'],
    [new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.35, 0), '#cfe4f7'],
    [new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8).translate(0, 0.85, 0), '#ffffff'],
  ])
  return [house, tower, accent]
}

function buildSteppedSet() {
  const house = mergeParts([
    [new THREE.BoxGeometry(0.94, 0.42, 0.94).translate(0, 0.21, 0), '#f5ead8'],
    [new THREE.BoxGeometry(0.72, 0.32, 0.72).translate(0, 0.58, 0), '#ebd8be'],
    [new THREE.BoxGeometry(0.46, 0.26, 0.46).translate(0, 0.87, 0), '#dec4a2'],
  ])
  const tower = mergeParts([
    [new THREE.CylinderGeometry(0.44, 0.5, 0.45, 6).translate(0, 0.225, 0), '#f2e4cf'],
    [new THREE.CylinderGeometry(0.32, 0.38, 0.35, 6).translate(0, 0.625, 0), '#e6d2b5'],
    [new THREE.CylinderGeometry(0.18, 0.24, 0.2, 6).translate(0, 0.9, 0), '#d9be98'],
  ])
  const accent = mergeParts([
    [new THREE.BoxGeometry(0.88, 0.68, 0.88).translate(0, 0.34, 0), '#f0e0c9'],
    [new THREE.BoxGeometry(0.54, 0.32, 0.54).translate(0, 0.84, 0), '#e0c7a6'],
  ])
  return [house, tower, accent]
}

function buildPrismSet() {
  const house = mergeParts([
    [new THREE.CylinderGeometry(0.42, 0.48, 0.62, 6).translate(0, 0.31, 0), '#e8ecff'],
    [new THREE.ConeGeometry(0.44, 0.38, 6).translate(0, 0.81, 0), '#c8f0ff'],
  ])
  const tower = mergeParts([
    [new THREE.CylinderGeometry(0.28, 0.38, 0.72, 5).translate(0, 0.36, 0), '#e4e8ff'],
    [new THREE.ConeGeometry(0.3, 0.28, 5).translate(0, 0.86, 0), '#d8f4ff'],
  ])
  const accent = prepGeo(new THREE.OctahedronGeometry(0.48, 0).scale(0.85, 1.04, 0.85).translate(0, 0.5, 0), '#e6f7ff')
  return [house, tower, accent]
}

function buildFlatSet() {
  const house = mergeParts([
    [new THREE.BoxGeometry(0.9, 0.68, 0.9).translate(0, 0.34, 0), '#dce6ff'],
    [new THREE.BoxGeometry(0.62, 0.24, 0.62).translate(0, 0.8, 0), '#bfd0ff'],
    [new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6).translate(0, 0.96, 0), '#ffffff'],
  ])
  const tower = mergeParts([
    [new THREE.BoxGeometry(0.74, 0.78, 0.74).translate(0, 0.39, 0), '#d6e2ff'],
    [new THREE.BoxGeometry(0.46, 0.14, 0.46).translate(0, 0.85, 0), '#b4c8ff'],
    [new THREE.CylinderGeometry(0.025, 0.03, 0.12, 6).translate(0, 0.96, 0), '#ffffff'],
  ])
  const accent = mergeParts([
    [new THREE.CylinderGeometry(0.4, 0.46, 0.74, 8).translate(0, 0.37, 0), '#dce8ff'],
    [new THREE.CylinderGeometry(0.26, 0.3, 0.26, 8).translate(0, 0.87, 0), '#c2d6ff'],
  ])
  return [house, tower, accent]
}

const STYLE_CACHE = new Map()

/**
 * Devuelve [houseGeo, towerGeo, accentGeo] en caché de módulo para el estilo de techo del bioma.
 */
export function getBiomeBuildingGeos(roofStyle) {
  if (STYLE_CACHE.has(roofStyle)) return STYLE_CACHE.get(roofStyle)
  let set
  switch (roofStyle) {
    case 'spire': set = buildSpireSet(); break
    case 'gable': set = buildGableSet(); break
    case 'dome': set = buildDomeSet(); break
    case 'stepped': set = buildSteppedSet(); break
    case 'prism': set = buildPrismSet(); break
    case 'flat':
    default: set = buildFlatSet(); break
  }
  STYLE_CACHE.set(roofStyle, set)
  return set
}

// ─── Kit procedural de respaldo de 6 tipos por estilo (base y=0, alto ~1) ───
const KIT_CACHE = new Map()

function buildKitForStyle(roofStyle) {
  const [casa, torre, accent] = getBiomeBuildingGeos(roofStyle)

  // Rascacielos escalonado con corona y antena
  const rascacielos = mergeParts([
    [new THREE.BoxGeometry(0.82, 0.42, 0.82).translate(0, 0.21, 0), '#d8e0f2'],
    [new THREE.BoxGeometry(0.64, 0.32, 0.64).translate(0, 0.58, 0), '#e8eeff'],
    [new THREE.BoxGeometry(0.44, 0.16, 0.44).translate(0, 0.82, 0), '#f5f8ff'],
    [new THREE.CylinderGeometry(0.025, 0.05, 0.14, 6).translate(0, 0.95, 0), '#ffffff'],
  ])

  // Comercio: planta baja amplia con marquesina y letrero superior
  const comercio = mergeParts([
    [new THREE.BoxGeometry(0.98, 0.56, 0.88).translate(0, 0.28, 0), '#eef2fa'],
    [new THREE.BoxGeometry(1.06, 0.1, 0.96).translate(0, 0.6, 0), '#d4ddf2'],
    [new THREE.BoxGeometry(0.64, 0.22, 0.58).translate(0, 0.76, 0), '#ffffff'],
  ])

  // Estación / puerto urbano: nave arqueada con andenes y antena
  const estacion = mergeParts([
    [new THREE.BoxGeometry(1.0, 0.14, 0.96).translate(0, 0.07, 0), '#cfd8eb'],
    [new THREE.CylinderGeometry(0.4, 0.44, 0.88, 10).rotateZ(Math.PI / 2).translate(0, 0.46, 0), '#e8eefc'],
    [new THREE.CylinderGeometry(0.05, 0.07, 0.28, 6).translate(0.32, 0.84, 0.25), '#ffffff'],
  ])

  // Parque / plaza urbana: base de jardín + copa de árboles/fuente central
  const parque = mergeParts([
    [new THREE.CylinderGeometry(0.52, 0.54, 0.1, 12).translate(0, 0.05, 0), '#90c78b'],
    [new THREE.CylinderGeometry(0.06, 0.09, 0.36, 7).translate(-0.2, 0.24, -0.12), '#8c694a'],
    [new THREE.SphereGeometry(0.24, 10, 7).translate(-0.2, 0.54, -0.12), '#7bd17b'],
    [new THREE.CylinderGeometry(0.05, 0.08, 0.3, 7).translate(0.22, 0.2, 0.14), '#8c694a'],
    [new THREE.SphereGeometry(0.2, 10, 7).translate(0.22, 0.44, 0.14), '#96e38f'],
    [new THREE.CylinderGeometry(0.14, 0.18, 0.18, 10).translate(0.04, 0.18, -0.18), '#cce8ff'],
  ])

  return {
    casa,
    torre: accent || torre,
    rascacielos,
    comercio,
    estacion,
    parque,
  }
}

export function getCityKitProcedural(roofStyle) {
  if (KIT_CACHE.has(roofStyle)) return KIT_CACHE.get(roofStyle)
  const kit = buildKitForStyle(roofStyle)
  KIT_CACHE.set(roofStyle, kit)
  return kit
}

/**
 * Construye una única geometría ligera (1 draw call) para el LOD lejano ("silueta y luces")
 * combinando las torres y rascacielos más altos del planeta.
 */
export function buildFarSkylineGeo(items) {
  if (!items.length) return null
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
  const parts = []
  const tmpColor = new THREE.Color()
  const posAttr = box.attributes.position
  const normAttr = box.attributes.normal
  const baseBox = box.toNonIndexed()
  const bPos = baseBox.attributes.position
  const bNorm = baseBox.attributes.normal
  const v = new THREE.Vector3()
  const nMat = new THREE.Matrix3()

  for (const it of items) {
    const g = baseBox.clone()
    g.applyMatrix4(it.m)
    const count = g.attributes.position.count
    const cols = new Float32Array(count * 3)
    tmpColor.copy(it.c)
    // Ligero degradado luminoso en los pisos altos para silueta nocturna legible desde lejos
    const gPos = g.attributes.position
    for (let i = 0; i < count; i++) {
      const k = 0.85 + 0.3 * (bPos.getY(i))
      cols[i * 3] = Math.min(1, tmpColor.r * k)
      cols[i * 3 + 1] = Math.min(1, tmpColor.g * k)
      cols[i * 3 + 2] = Math.min(1, tmpColor.b * k)
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
    parts.push(g)
  }
  box.dispose()
  baseBox.dispose()
  if (!parts.length) return null
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}
