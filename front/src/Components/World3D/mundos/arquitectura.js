import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Normaliza una geometría para fusión segura: no-indexada y con position, normal y uv.
function prepGeo(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) {
    const pos = g.attributes.position
    const uv = new Float32Array(pos.count * 2)
    for (let i = 0; i < pos.count; i++) {
      uv[i * 2] = pos.getX(i) + 0.5
      uv[i * 2 + 1] = pos.getY(i)
    }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  }
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
  }
  return g
}

function mergeParts(parts) {
  const prepped = parts.map(prepGeo)
  const merged = mergeGeometries(prepped, false)
  prepped.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}

function makeLathe(points, segs = 10) {
  const vecs = points.map(([x, y]) => new THREE.Vector2(Math.max(0.0001, x), y))
  const g = new THREE.LatheGeometry(vecs, segs)
  g.computeVertexNormals()
  return g
}

// ─── Estilos arquitectónicos en caché de módulo (base y=0, altura 1, ancho ~1) ───

function buildSpireSet() {
  // Gótico / Glacial: agujas afiladas y tejados empinados
  const house = mergeParts([
    new THREE.BoxGeometry(0.86, 0.58, 0.86).translate(0, 0.29, 0),
    new THREE.ConeGeometry(0.68, 0.42, 4).rotateY(Math.PI / 4).translate(0, 0.79, 0),
  ])
  const tower = makeLathe([
    [0.44, 0], [0.4, 0.2], [0.34, 0.52], [0.22, 0.76], [0.09, 0.94], [0.001, 1.0],
  ], 8)
  const accent = mergeParts([
    new THREE.CylinderGeometry(0.32, 0.42, 0.55, 6).translate(0, 0.275, 0),
    new THREE.ConeGeometry(0.36, 0.45, 6).translate(0, 0.775, 0),
  ])
  return [house, tower, accent]
}

function buildGableSet() {
  // Bosque / Jardín: cabañas con techo a dos aguas o cónico orgánico
  const house = mergeParts([
    new THREE.BoxGeometry(0.88, 0.56, 0.84).translate(0, 0.28, 0),
    new THREE.CylinderGeometry(0.02, 0.66, 0.44, 4).rotateY(Math.PI / 4).translate(0, 0.78, 0),
  ])
  const tower = mergeParts([
    new THREE.CylinderGeometry(0.34, 0.44, 0.66, 10).translate(0, 0.33, 0),
    new THREE.ConeGeometry(0.48, 0.36, 10).translate(0, 0.82, 0),
  ])
  const accent = makeLathe([
    [0.44, 0], [0.46, 0.14], [0.4, 0.52], [0.48, 0.64], [0.32, 0.86], [0.001, 1.0],
  ], 10)
  return [house, tower, accent]
}

function buildDomeSet() {
  // Mar / Nubes: cúpulas suaves, arcos costeros y pabellones redondeados
  const house = mergeParts([
    new THREE.CylinderGeometry(0.46, 0.48, 0.5, 14).translate(0, 0.25, 0),
    new THREE.SphereGeometry(0.46, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 1.08, 1).translate(0, 0.5, 0),
  ])
  const tower = makeLathe([
    [0.46, 0], [0.42, 0.35], [0.35, 0.68], [0.4, 0.78], [0.28, 0.94], [0.001, 1.0],
  ], 14)
  const accent = mergeParts([
    new THREE.CylinderGeometry(0.48, 0.48, 0.35, 12).translate(0, 0.175, 0),
    new THREE.SphereGeometry(0.38, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, 0.35, 0),
    new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8).translate(0, 0.85, 0),
  ])
  return [house, tower, accent]
}

function buildSteppedSet() {
  // Desierto / Volcán: terrazas escalonadas tipo zigurat/adobe
  const house = mergeParts([
    new THREE.BoxGeometry(0.94, 0.42, 0.94).translate(0, 0.21, 0),
    new THREE.BoxGeometry(0.72, 0.32, 0.72).translate(0, 0.58, 0),
    new THREE.BoxGeometry(0.46, 0.26, 0.46).translate(0, 0.87, 0),
  ])
  const tower = mergeParts([
    new THREE.CylinderGeometry(0.44, 0.5, 0.45, 6).translate(0, 0.225, 0),
    new THREE.CylinderGeometry(0.32, 0.38, 0.35, 6).translate(0, 0.625, 0),
    new THREE.CylinderGeometry(0.18, 0.24, 0.2, 6).translate(0, 0.9, 0),
  ])
  const accent = mergeParts([
    new THREE.BoxGeometry(0.88, 0.68, 0.88).translate(0, 0.34, 0),
    new THREE.BoxGeometry(0.54, 0.32, 0.54).translate(0, 0.84, 0),
  ])
  return [house, tower, accent]
}

function buildPrismSet() {
  // Cristal: torres prismáticas facetadas y obeliscos angulosos
  const house = mergeParts([
    new THREE.CylinderGeometry(0.42, 0.48, 0.62, 6).translate(0, 0.31, 0),
    new THREE.ConeGeometry(0.44, 0.38, 6).translate(0, 0.81, 0),
  ])
  const tower = mergeParts([
    new THREE.CylinderGeometry(0.28, 0.38, 0.72, 5).translate(0, 0.36, 0),
    new THREE.ConeGeometry(0.3, 0.28, 5).translate(0, 0.86, 0),
  ])
  const accent = new THREE.OctahedronGeometry(0.48, 0).scale(0.85, 1.04, 0.85).translate(0, 0.5, 0)
  return [house, tower, prepGeo(accent)]
}

function buildFlatSet() {
  // Neón: rascacielos escalonados con antenas
  const house = mergeParts([
    new THREE.BoxGeometry(0.9, 0.68, 0.9).translate(0, 0.34, 0),
    new THREE.BoxGeometry(0.62, 0.24, 0.62).translate(0, 0.8, 0),
    new THREE.CylinderGeometry(0.03, 0.04, 0.14, 6).translate(0, 0.96, 0),
  ])
  const tower = mergeParts([
    new THREE.BoxGeometry(0.74, 0.78, 0.74).translate(0, 0.39, 0),
    new THREE.BoxGeometry(0.46, 0.14, 0.46).translate(0, 0.85, 0),
    new THREE.CylinderGeometry(0.025, 0.03, 0.12, 6).translate(0, 0.96, 0),
  ])
  const accent = mergeParts([
    new THREE.CylinderGeometry(0.4, 0.46, 0.74, 8).translate(0, 0.37, 0),
    new THREE.CylinderGeometry(0.26, 0.3, 0.26, 8).translate(0, 0.87, 0),
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
