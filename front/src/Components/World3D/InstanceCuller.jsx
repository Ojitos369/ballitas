import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Recorte por distancia para TODAS las InstancedMesh grandes, sin tocar a quien las anima:
// justo antes del render (prioridad 0.9, tras los useFrame normales y antes del EffectComposer en 1)
// se compactan al inicio del buffer las instancias a menos de `radius` de la cámara y se baja `count`;
// tras el render (prioridad 2) se restauran array y count, así setMatrixAt(i) sigue usando índices lógicos.
// Si nada cambió (ni cámara ni versiones de los atributos) se reutiliza lo ya subido a la GPU.
//
// Aparición gradual (sin programas nuevos: solo se escala la matriz de cada instancia en la copia compactada):
// - borde: la instancia mide 0 en su distancia de recorte D y crece hasta su tamaño en 0.8·D (D = `radius` para las
//   que recorta este componente, o `userData.recorte` para las que recorta su dueño: estructuras);
// - revelado: una malla que pasa de oculta (ella o un ancestro: LOD, capa que se revela) o vacía a dibujarse crece
//   de 0 a 1 en REVELA_MS.
// Así lo que entra en el borde o se revela no «salta» a la vista.
const MIN_COUNT = 48
const MOVE2 = 1.5 * 1.5
const REVELA_MS = 400
const BORDE = 0.8
if (typeof window !== 'undefined') window.__aparece = { borde: BORDE, radio: 60, min: MIN_COUNT } // lo leen las sondas

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

    const collect = () => {
      list = []
      scene.traverse((o) => { if (o.isInstancedMesh) list.push(o) })
    }

    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }

    const before = () => {
      if (frame++ % 15 === 0) collect()
      const now = performance.now()
      const cx = camera.position.x; const cy = camera.position.y; const cz = camera.position.z
      for (const mesh of list) {
        const n = mesh.count
        let s = state.get(mesh)
        const vis = !!mesh.parent && n > 0 && visible(mesh)
        if (!s) {
          s = { vers: [], n: -1, cam: [Infinity, 0, 0], near: 0, idx: null, backup: [], gpuCompact: false, vis, t0: -Infinity, rev: 1 }
          state.set(mesh, s)
        }
        if (!vis) { s.vis = false; mesh.userData.__rev = 0; continue }
        if (!s.vis) { s.vis = true; s.t0 = now }
        const rev = Math.min(1, (now - s.t0) / REVELA_MS)
        mesh.userData.__rev = rev // para las sondas (tamaño real dibujado en este cuadro)
        const noCull = !!mesh.userData.noCull
        const D = noCull ? mesh.userData.recorte : (n >= MIN_COUNT ? radius : null)
        const cullR2 = !noCull && n >= MIN_COUNT ? radius * radius : Infinity
        if (!D && rev >= 1 && s.rev >= 1) {
          if (s.gpuCompact) { for (const a of instAttrs(mesh)) { a.clearUpdateRanges(); a.needsUpdate = true } s.gpuCompact = false; s.n = -1 }
          continue
        }
        const attrs = instAttrs(mesh)
        const dirty = s.n !== n || rev !== s.rev || s.D !== D || attrs.length !== s.vers.length || attrs.some((a, i) => a.version !== s.vers[i]) ||
          (cx - s.cam[0]) ** 2 + (cy - s.cam[1]) ** 2 + (cz - s.cam[2]) ** 2 > MOVE2
        if (!dirty) {
          if (s.gpuCompact) { restore.push(mesh, n, null); mesh.count = s.near }
          continue
        }
        s.rev = rev; s.D = D
        // posición mundial de cada instancia: matrixWorld × traslación de su matriz
        const m = mesh.instanceMatrix.array; const w = mesh.matrixWorld.elements
        if (!s.idx || s.idx.length < n) { s.idx = new Int32Array(n); s.k = new Float32Array(n) }
        const d0 = D ? D * BORDE : 0; const dd = D ? D - d0 : 1
        let near = 0; let escala = false
        for (let i = 0; i < n; i++) {
          const o = i * 16; const x = m[o + 12]; const y = m[o + 13]; const z = m[o + 14]
          const dx = w[0] * x + w[4] * y + w[8] * z + w[12] - cx
          const dy = w[1] * x + w[5] * y + w[9] * z + w[13] - cy
          const dz = w[2] * x + w[6] * y + w[10] * z + w[14] - cz
          const d2 = dx * dx + dy * dy + dz * dz
          if (d2 >= cullR2) continue
          let k = rev
          if (D) {
            const t = (Math.sqrt(d2) - d0) / dd
            if (t > 0) { const c = t >= 1 ? 1 : t; k *= 1 - c * c * (3 - 2 * c) }
          }
          if (k < 1) escala = true
          s.k[near] = k
          s.idx[near++] = i
        }
        s.n = n; s.cam[0] = cx; s.cam[1] = cy; s.cam[2] = cz; s.near = near
        if (near === n && !escala) {
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
            if (a === mesh.instanceMatrix && escala) {
              // escala respecto al origen de la pieza: columnas 0-2 de la matriz × k (la traslación no cambia)
              for (let j = 0; j < near; j++) {
                const kk = s.k[j]
                if (kk >= 1) continue
                const o = j * 16
                arr[o] *= kk; arr[o + 1] *= kk; arr[o + 2] *= kk
                arr[o + 4] *= kk; arr[o + 5] *= kk; arr[o + 6] *= kk
                arr[o + 8] *= kk; arr[o + 9] *= kk; arr[o + 10] *= kk
              }
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
