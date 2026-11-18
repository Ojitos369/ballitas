// Geometrías de public/models (base en y=0, altura 1, colores por vértice) cargadas una vez y compartidas.
// Mientras llega el GLB se usa una pieza de reserva (o null si se pasa fallback = null).
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { markShared } from './base.jsx'

const loader = new GLTFLoader()
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'models/'
const cache = new Map() // name -> { geo, promise }

function normalizeModelGeo(g) {
  // Blender escribe el color real del material en COLOR_1; COLOR_0 suele ser blanco uniforme.
  const src = g.attributes.color_1 ?? g.attributes.color_0 ?? g.attributes.color
  const count = g.attributes.position.count
  const values = new Float32Array(count * 3)
  if (src) {
    for (let i = 0; i < count; i++) {
      values[i * 3] = src.getX(i)
      values[i * 3 + 1] = src.getY(i)
      values[i * 3 + 2] = src.getZ(i)
    }
  } else {
    values.fill(1)
  }
  g.setAttribute('color', new THREE.BufferAttribute(values, 3))
  for (const k of Object.keys(g.attributes)) {
    if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k)
  }
  if (!g.attributes.normal) g.computeVertexNormals()
  return g
}

const FALLBACK = markShared(normalizeModelGeo(new THREE.ConeGeometry(0.35, 1, 7).translate(0, 0.5, 0)))

function entry(name) {
  let e = cache.get(name)
  if (e) return e
  e = { geo: null }
  e.promise = new Promise((resolve) => {
    loader.load(BASE + name + '.glb', (gltf) => {
      gltf.scene.updateMatrixWorld(true)
      const parts = []
      gltf.scene.traverse((o) => {
        if (!o.isMesh || !o.geometry) return
        const raw = o.geometry.clone()
        raw.applyMatrix4(o.matrixWorld)
        parts.push(normalizeModelGeo(raw))
      })
      if (parts.length) {
        const anyIndexed = parts.some((p) => !!p.index)
        const allIndexed = parts.every((p) => !!p.index)
        const prepared = parts.length > 1 && anyIndexed && !allIndexed
          ? parts.map((p) => (p.index ? p.toNonIndexed() : p))
          : parts
        const g = prepared.length === 1 ? prepared[0] : mergeGeometries(prepared, false)
        if (prepared !== parts) parts.forEach((p) => p.dispose())
        if (g) {
          g.computeBoundingSphere()
          g.name = 'modelo:' + name
          e.geo = markShared(g)
        }
      }
      resolve(e.geo)
    }, undefined, () => resolve(null))
  })
  cache.set(name, e)
  return e
}

/** Geometría del modelo (o la de reserva hasta que cargue; pasa `fallback = null` para esperar sin cono). */
export function useModelo(name, fallback = FALLBACK) {
  const e = name ? entry(name) : null
  const [geo, setGeo] = useState(() => (e?.geo ?? fallback))
  useEffect(() => {
    if (!e) { setGeo(fallback); return undefined }
    if (e.geo) { setGeo(e.geo); return undefined }
    setGeo(fallback)
    let alive = true
    e.promise.then((g) => { if (alive && g) setGeo(g) })
    return () => { alive = false }
  }, [e, fallback])
  return geo
}

export const precargarModelos = (names) => names.forEach((n) => n && entry(n))
