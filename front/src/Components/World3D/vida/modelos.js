// Geometrías de public/models (base en y=0, altura 1, colores por vértice) cargadas una vez y compartidas.
// Mientras llega el GLB se usa una pieza de reserva con la misma convención.
import { useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { markShared } from './base.jsx'

const loader = new GLTFLoader()
const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'models/'
const cache = new Map() // name -> { geo, promise }

function withWhite(g) {
  // Blender escribe el color del material en COLOR_1; COLOR_0 puede ser blanco uniforme.
  const src = g.attributes.color_1 ?? g.attributes.color_0
  if (src && !g.attributes.color) {
    const values = new Float32Array(src.count * 3)
    for (let i = 0; i < src.count; i++) {
      values[i * 3] = src.getX(i); values[i * 3 + 1] = src.getY(i); values[i * 3 + 2] = src.getZ(i)
    }
    g.setAttribute('color', new THREE.BufferAttribute(values, 3))
  }
  if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3))
  return g
}
const FALLBACK = markShared(withWhite(new THREE.ConeGeometry(0.35, 1, 7).translate(0, 0.5, 0)))

function entry(name) {
  let e = cache.get(name)
  if (e) return e
  e = { geo: null }
  e.promise = new Promise((resolve) => {
    loader.load(BASE + name + '.glb', (gltf) => {
      let mesh = null
      gltf.scene.traverse((o) => { if (!mesh && o.isMesh) mesh = o })
      if (mesh) {
        const g = mesh.geometry.clone()
        if (!g.attributes.normal) g.computeVertexNormals()
        g.computeBoundingSphere()
        g.name = 'modelo:' + name
        e.geo = markShared(withWhite(g))
      }
      resolve(e.geo)
    }, undefined, () => resolve(null))
  })
  cache.set(name, e)
  return e
}

/** Geometría del modelo (o la de reserva hasta que cargue). */
export function useModelo(name) {
  const e = entry(name)
  const [geo, setGeo] = useState(() => e.geo ?? FALLBACK)
  useEffect(() => {
    let alive = true
    if (!e.geo) e.promise.then((g) => { if (alive && g) setGeo(g) })
    return () => { alive = false }
  }, [e])
  return geo
}
export const precargarModelos = (names) => names.forEach(entry)
