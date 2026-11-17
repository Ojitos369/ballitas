import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Recorte por distancia para TODAS las InstancedMesh grandes, sin tocar a quien las anima:
// justo antes del render (prioridad 0.9, tras los useFrame normales y antes del EffectComposer en 1)
// se compactan al inicio del buffer las instancias a menos de `radius` de la cámara y se baja `count`;
// tras el render (prioridad 2) se restauran array y count, así setMatrixAt(i) sigue usando índices lógicos.
// Si nada cambió (ni cámara ni versiones de los atributos) se reutiliza lo ya subido a la GPU.
const MIN_COUNT = 48
const MOVE2 = 1.5 * 1.5

function instAttrs(mesh) {
  const out = [mesh.instanceMatrix]
  if (mesh.instanceColor) out.push(mesh.instanceColor)
  const a = mesh.geometry.attributes
  for (const k in a) if (a[k].isInstancedBufferAttribute) out.push(a[k])
  return out
}

export default function InstanceCuller({ active, radius = 60 }) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const hooks = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const state = new WeakMap()
    let list = []
    let frame = 0
    const restore = []
    const R2 = radius * radius

    const collect = () => {
      list = []
      scene.traverse((o) => { if (o.isInstancedMesh && !o.userData.noCull) list.push(o) })
    }

    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }

    const before = () => {
      if (frame++ % 30 === 0) collect()
      const cx = camera.position.x; const cy = camera.position.y; const cz = camera.position.z
      for (const mesh of list) {
        const n = mesh.count
        if (n < MIN_COUNT) {
          const s = state.get(mesh)
          if (s?.gpuCompact) { for (const a of instAttrs(mesh)) { a.clearUpdateRanges(); a.needsUpdate = true } s.gpuCompact = false; s.n = -1 }
          continue
        }
        if (!mesh.parent || !visible(mesh)) continue
        const attrs = instAttrs(mesh)
        let s = state.get(mesh)
        if (!s) { s = { vers: [], n: -1, cam: [Infinity, 0, 0], near: 0, idx: null, backup: [], gpuCompact: false }; state.set(mesh, s) }
        const dirty = s.n !== n || attrs.length !== s.vers.length || attrs.some((a, i) => a.version !== s.vers[i]) ||
          (cx - s.cam[0]) ** 2 + (cy - s.cam[1]) ** 2 + (cz - s.cam[2]) ** 2 > MOVE2
        if (!dirty) {
          if (s.gpuCompact) { restore.push(mesh, n, null); mesh.count = s.near }
          continue
        }
        // posición mundial de cada instancia: matrixWorld × traslación de su matriz
        const m = mesh.instanceMatrix.array; const w = mesh.matrixWorld.elements
        if (!s.idx || s.idx.length < n) s.idx = new Int32Array(n)
        let near = 0
        for (let i = 0; i < n; i++) {
          const o = i * 16; const x = m[o + 12]; const y = m[o + 13]; const z = m[o + 14]
          const dx = w[0] * x + w[4] * y + w[8] * z + w[12] - cx
          const dy = w[1] * x + w[5] * y + w[9] * z + w[13] - cy
          const dz = w[2] * x + w[6] * y + w[10] * z + w[14] - cz
          if (dx * dx + dy * dy + dz * dz < R2) s.idx[near++] = i
        }
        s.n = n; s.cam[0] = cx; s.cam[1] = cy; s.cam[2] = cz; s.near = near
        if (near === n) {
          if (s.gpuCompact) for (const a of attrs) { a.clearUpdateRanges(); a.needsUpdate = true }
          s.gpuCompact = false
        } else {
          attrs.forEach((a, k) => {
            const arr = a.array; const sz = a.itemSize; const len = n * sz
            if (!s.backup[k] || s.backup[k].length < len) s.backup[k] = new arr.constructor(len)
            s.backup[k].set(arr.subarray(0, len))
            for (let j = 0; j < near; j++) {
              const src = s.idx[j]
              if (src !== j) for (let c = 0; c < sz; c++) arr[j * sz + c] = s.backup[k][src * sz + c]
            }
            a.clearUpdateRanges()
            if (near > 0) a.addUpdateRange(0, near * sz)
            a.needsUpdate = true
          })
          s.gpuCompact = true
          restore.push(mesh, n, attrs)
          mesh.count = near
        }
        s.vers = attrs.map((a) => a.version)
      }
    }

    const after = () => {
      for (let i = 0; i < restore.length; i += 3) {
        const mesh = restore[i]; const n = restore[i + 1]; const attrs = restore[i + 2]
        mesh.count = n
        if (attrs) {
          const s = state.get(mesh)
          attrs.forEach((a, k) => a.array.set(s.backup[k].subarray(0, n * a.itemSize)))
        }
      }
      restore.length = 0
    }

    hooks.current = { before, after }
    return () => {
      after()
      // al apagarse, la GPU puede quedar con datos compactados: forzar subida completa
      for (const mesh of list) if (state.get(mesh)?.gpuCompact) for (const a of instAttrs(mesh)) { a.clearUpdateRanges(); a.needsUpdate = true }
      hooks.current = null
    }
  }, [active, radius, scene, camera])

  useFrame(() => hooks.current?.before(), 0.9)
  useFrame(() => hooks.current?.after(), 2)
  return null
}
