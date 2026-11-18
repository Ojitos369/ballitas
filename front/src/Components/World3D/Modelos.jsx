// Catálogo de modelos GLB nuevos (public/models). Todos: un mesh, color por vértice (COLOR_0),
// base en y=0, centrados en XZ. Dimensiones = ancho(X) × alto(Y) × fondo(Z), la mayor mide ~1.
// Se escalan desde la escena con las constantes del mundo (WORLD_SCALE, NODE_R...), nunca con tamaños fijos.
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { geoDeGltf, modeloListo, registrarModelo } from './ecosistema.js'
import { categoriaModelo, triplanarMaterial } from './triplanar.js'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'models/'
const BASE_KIT = BASE + 'kit/'
const u = (n) => BASE + n + '.glb'

export const MODELOS = {
  volcan_erupcion: u('volcan_erupcion'), // 414 tris · 1.12×1.00×1.16 · cráter y grietas de lava
  geiser: u('geiser'), // 302 tris · 1.00×0.81×1.00 · montículo mineral con chorro
  rampa_roca: u('rampa_roca'), // 80 tris · 1.00×0.50×0.80 · sube hacia +X
  rampa_hielo: u('rampa_hielo'), // 80 tris · 1.00×0.50×0.80
  rampa_madera: u('rampa_madera'), // 176 tris · 1.00×0.67×0.80 · con barandas
  cascada_roca: u('cascada_roca'), // 170 tris · 1.06×1.00×1.10 · agua cae hacia +Z
  isla_nube: u('isla_nube'), // 462 tris · 1.00×0.90×0.98
  puente_cristal: u('puente_cristal'), // 332 tris · 1.00×0.58×0.49 · eje largo X
  alga_larga: u('alga_larga'), // 360 tris · 0.45×1.00×0.22
  concha_gigante: u('concha_gigante'), // 372 tris · 1.00×0.87×0.98
  saguaro_grande: u('saguaro_grande'), // 342 tris · 0.84×1.00×0.37
  estalagmita_hielo: u('estalagmita_hielo'), // 150 tris · 0.64×1.00×0.56
  geoda: u('geoda'), // 270 tris · 0.97×0.62×1.00
  lapida: u('lapida'), // 104 tris · 0.64×1.00×0.44
  tronco_hueco: u('tronco_hueco'), // 220 tris · 0.94×1.00×0.86 · en vertical, rotar para tumbarlo
  fuente_jardin: u('fuente_jardin'), // 378 tris · 1.00×0.91×0.98
  hongo_gigante: u('hongo_gigante'), // 301 tris · 1.04×1.00×1.04
  luciernaga_farol: u('luciernaga_farol'), // 218 tris · 0.48×1.00×0.36
}

export const precargarModelosNuevos = (nombres = Object.keys(MODELOS)) => nombres.forEach((n) => MODELOS[n] && useGLTF.preload(MODELOS[n]))

// Carga diferida (sin Suspense) de los GLB que usa el ecosistema: una sola petición por modelo, compartida entre
// caminos; al terminar se registra en ecosistema.js, que avisa a los InstancedMesh para cambiar la geometría.
const pendientes = new Map()
const loader = new GLTFLoader()
export function cargarModelosEco(nombres) {
  for (const n of nombres) {
    if (!MODELOS[n] || modeloListo(n) || pendientes.has(n)) continue
    pendientes.set(n, loader.loadAsync(MODELOS[n]).then((g) => { const geo = geoDeGltf(g.scene); if (geo) registrarModelo(n, geo) }).catch((e) => console.warn('modelo', n, e)))
  }
}

/** { geometry, material } del modelo (mallas fusionadas, material con vertexColors); null si el nombre no existe.
 *  Suspende mientras carga (usar dentro de <Suspense>). */
export function useModeloGeo(nombre) {
  const url = MODELOS[nombre]
  const gltf = useGLTF(url || MODELOS.lapida) // hook incondicional; si falta el nombre se descarta el resultado
  return useMemo(() => {
    if (!url) return null
    const geos = []
    let mat = null
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      if (!o.isMesh) return
      const g = o.geometry.clone()
      g.applyMatrix4(o.matrixWorld)
      // el color real está en COLOR_1 (COLOR_0 sale en blanco del exportador de Blender)
      if (g.attributes.color_1) {
        const s = g.attributes.color_1; const a = new Float32Array(s.count * 3)
        for (let i = 0; i < s.count; i++) { a[i * 3] = s.getX(i); a[i * 3 + 1] = s.getY(i); a[i * 3 + 2] = s.getZ(i) }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3))
      }
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
      if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3))
      geos.push(g)
      mat = mat || o.material
    })
    if (!geos.length) return null
    const geometry = geos.length === 1 ? geos[0] : mergeGeometries(geos)
    geometry.computeBoundingSphere()
    const theme = temaModelo(nombre)
    const material = triplanarMaterial(theme, categoriaModelo(nombre), { standard: true })
    return { geometry, material }
  }, [gltf, url])
}

function temaModelo(name) {
  if (/volcan|geiser|lava/i.test(name)) return 'volcan'
  if (/hielo|ice|nieve/i.test(name)) return 'hielo'
  if (/cristal|crystal|geoda/i.test(name)) return 'cristal'
  if (/desierto|arena|saguaro/i.test(name)) return 'desierto'
  if (/mar|alga|concha|coral/i.test(name)) return 'mar'
  if (/nube|cloud/i.test(name)) return 'nubes'
  if (/neon|farol|luciernaga/i.test(name)) return 'neon'
  if (/jardin|fuente|hongo/i.test(name)) return 'jardin'
  if (/lapida|sombrio/i.test(name)) return 'sombrio'
  return 'bosque'
}

// ─────────────────────────── Cargador del kit kart (public/models/kit/) ───────────────────────────
// Conserva materiales y texturas embebidas (sin triplanar ni colores por vértice) para instanciar con InstancedMesh.
const KIT_TEX_KEYS = ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'alphaMap', 'bumpMap']
const kitCache = new Map() // nombre -> { geometry, material } | null
const kitPending = new Map() // nombre -> Promise

function markKitShared(obj) {
  if (!obj) return obj
  obj.userData = obj.userData || {}
  obj.userData.shared = true
  if (obj.isMaterial) {
    for (const k of KIT_TEX_KEYS) {
      const t = obj[k]
      if (t && t.isTexture) {
        t.userData = t.userData || {}
        t.userData.shared = true
        t.generateMipmaps = true
        t.minFilter = THREE.LinearMipmapLinearFilter
        t.magFilter = THREE.LinearFilter
        t.anisotropy = 4
        t.needsUpdate = true
      }
    }
  }
  return obj
}

function normalizeKitPartGeo(raw) {
  const g = raw.clone()
  if (!g.attributes.normal) g.computeVertexNormals()
  if (!g.attributes.uv) {
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2))
  }
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k)
  }
  return g
}

function extraerKit(gltf, nombre) {
  gltf.scene.updateMatrixWorld(true)
  const parts = []
  gltf.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    const mat = Array.isArray(o.material) ? o.material[0] : o.material
    if (!mat) return
    const g = normalizeKitPartGeo(o.geometry)
    g.applyMatrix4(o.matrixWorld)
    parts.push({ geo: g, mat: markKitShared(mat) })
  })
  if (!parts.length) return null

  let geometry
  let material
  if (parts.length === 1) {
    geometry = parts[0].geo
    material = parts[0].mat
  } else {
    const anyIndexed = parts.some((p) => !!p.geo.index)
    const allIndexed = parts.every((p) => !!p.geo.index)
    const geos = parts.map((p) => {
      if (anyIndexed && !allIndexed && p.geo.index) {
        const ni = p.geo.toNonIndexed()
        p.geo.dispose()
        return ni
      }
      return p.geo
    })
    geometry = mergeGeometries(geos, true)
    for (const g of geos) g.dispose()
    material = parts.map((p) => p.mat)
  }
  if (!geometry) return null
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  geometry.name = 'kit:' + nombre
  markKitShared(geometry)
  return { geometry, material }
}

/** Carga asíncrona (sin Suspense) de una pieza de `public/models/kit/<nombre>.glb` con caché de módulo. */
export function cargarKit(nombre) {
  if (!nombre) return Promise.resolve(null)
  if (kitCache.has(nombre)) return Promise.resolve(kitCache.get(nombre))
  if (kitPending.has(nombre)) return kitPending.get(nombre)
  const p = loader.loadAsync(BASE_KIT + nombre + '.glb')
    .then((gltf) => {
      const res = extraerKit(gltf, nombre)
      kitCache.set(nombre, res)
      kitPending.delete(nombre)
      return res
    })
    .catch((e) => {
      console.warn('kit', nombre, e)
      kitPending.delete(nombre)
      return null
    })
  kitPending.set(nombre, p)
  return p
}

export const precargarKit = (nombres = []) => nombres.forEach((n) => cargarKit(n))

/** Hook sin Suspense: devuelve `{ geometry, material }` del kit en caché (o `null` mientras carga). */
export function useKit(nombre) {
  const [kit, setKit] = useState(() => (nombre ? kitCache.get(nombre) ?? null : null))
  useEffect(() => {
    if (!nombre) { setKit(null); return undefined }
    if (kitCache.has(nombre)) { setKit(kitCache.get(nombre)); return undefined }
    let alive = true
    cargarKit(nombre).then((res) => { if (alive && res) setKit(res) })
    return () => { alive = false }
  }, [nombre])
  return kit
}
