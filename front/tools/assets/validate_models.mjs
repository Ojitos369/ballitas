/**
 * Valida los 13 archivos GLB del contrato de Ballitas cargándolos con Three.js GLTFLoader.
 *
 * Uso desde front/:
 *   node tools/assets/validate_models.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MODELS_DIR = path.resolve(__dirname, '../../public/models')

const EXPECTED = [
  'tree',
  'pine',
  'mushroom',
  'crystal',
  'rock',
  'flower',
  'coral',
  'ice_spire',
  'cactus',
  'lamp',
  'pylon',
  'clamp',
  'pod',
]

const MAX_TRIS = 4000
const loader = new GLTFLoader()

function parseGlb(buffer) {
  const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  return new Promise((resolve, reject) => {
    loader.parse(ab, '', resolve, reject)
  })
}

let failures = 0

for (const name of EXPECTED) {
  const filePath = path.join(MODELS_DIR, `${name}.glb`)
  if (!fs.existsSync(filePath)) {
    console.error(`[FAIL] ${name}.glb no existe`)
    failures++
    continue
  }

  const buf = fs.readFileSync(filePath)
  const gltf = await parseGlb(buf)

  const meshes = []
  gltf.scene.traverse((obj) => {
    if (obj.isMesh) meshes.push(obj)
  })

  if (meshes.length !== 1) {
    console.error(`[FAIL] ${name}.glb tiene ${meshes.length} meshes (esperado: 1)`)
    failures++
    continue
  }

  const mesh = meshes[0]
  const geo = mesh.geometry
  const idxCount = geo.index ? geo.index.count : geo.attributes.position.count
  const tris = Math.round(idxCount / 3)

  geo.computeBoundingBox()
  const box = geo.boundingBox.clone()
  mesh.updateMatrixWorld(true)
  box.applyMatrix4(mesh.matrixWorld)

  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const hasNormal = Boolean(geo.attributes.normal)
  const hasColor = Boolean(geo.attributes.color)

  let ok = true
  const notes = []

  if (tris >= MAX_TRIS || tris === 0) {
    ok = false
    notes.push(`tris=${tris}`)
  }
  if (!hasNormal) {
    ok = false
    notes.push('sin normales')
  }

  if (name === 'clamp') {
    if (Math.abs(size.x - 1.0) > 0.02 || Math.abs(size.y - 1.0) > 0.02) {
      ok = false
      notes.push(`diam=(${size.x.toFixed(3)}, ${size.y.toFixed(3)})`)
    }
    if (Math.abs(size.z - 0.15) > 0.01) {
      ok = false
      notes.push(`anchoZ=${size.z.toFixed(3)}`)
    }
    if (center.length() > 0.02) {
      ok = false
      notes.push(`center=(${center.x.toFixed(3)},${center.y.toFixed(3)},${center.z.toFixed(3)})`)
    }
  } else {
    if (Math.abs(box.min.y) > 0.01) {
      ok = false
      notes.push(`minY=${box.min.y.toFixed(4)}`)
    }
    if (Math.abs(box.max.y - 1.0) > 0.01) {
      ok = false
      notes.push(`maxY=${box.max.y.toFixed(4)}`)
    }
    if (Math.abs(center.x) > 0.02 || Math.abs(center.z) > 0.02) {
      ok = false
      notes.push(`centerXZ=(${center.x.toFixed(3)},${center.z.toFixed(3)})`)
    }
  }

  const tag = ok ? 'OK  ' : 'FAIL'
  if (!ok) failures++
  console.log(
    `[${tag}] ${name.padEnd(10)} | tris=${String(tris).padStart(4)} | size=(${size.x.toFixed(2)}, ${size.y.toFixed(2)}, ${size.z.toFixed(2)}) | minY=${box.min.y.toFixed(3)} | vcol=${hasColor} | ${(buf.length / 1024).toFixed(1)} KB ${notes.join(', ')}`
  )
}

if (failures > 0) {
  console.error(`\nFallaron ${failures} modelos.`)
  process.exit(1)
}
console.log(`\nTodos los ${EXPECTED.length} modelos GLB pasaron la validación Three.js.`)
