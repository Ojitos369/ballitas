import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'

// Recorte por distancia para TODAS las InstancedMesh grandes, sin tocar a quien las anima:
// justo antes del render (prioridad 0.9, tras los useFrame normales y antes del EffectComposer en 1)
// se compactan al inicio del buffer las instancias a menos de `radius` de la cámara y se baja `count`;
// tras el render (prioridad 2) se restauran array y count, así setMatrixAt(i) sigue usando índices lógicos.
// Si nada cambió (ni cámara ni versiones de los atributos) se reutiliza lo ya subido a la GPU.
//
// Aparición gradual (sin programas nuevos; con coste solo donde ya se trabajaba):
// - borde: en las mallas que recorta este componente (>= MIN_COUNT, sin noCull) la instancia mide 0 en `radius` y
//   crece hasta su tamaño en 0.8·radius; la escala se aplica en el compactado que ya se hacía y solo en cuadros «sucios»
//   (cámara movida > 1.5 u o atributos cambiados), como en main. Las que recorta su dueño (estructuras, paisaje) se
//   escalan donde el dueño escribe su matriz, con kBorde (abajo).
// - revelado: una malla que pasa de oculta (ella o un ancestro) o vacía a dibujarse crece de 0 a 1 en REVELA_MS;
//   solo cuesta mientras dura (lista corta de mallas revelándose).
// Interruptor en caliente: window.__aparece.off = true deja exactamente el camino de main.
// Cronómetro (solo con ?stats=1): window.__aparece.ms = media móvil de ms por cuadro de before + after.
const MIN_COUNT = 48
const MOVE2 = 1.5 * 1.5
const REVELA_MS = 400
const BORDE = 0.8
const AP = typeof window !== 'undefined'
  ? (window.__aparece = window.__aparece ?? { off: false, ms: 0 })
  : { off: false, ms: 0 }
Object.assign(AP, { borde: BORDE, radio: 60, min: MIN_COUNT }) // lo leen las sondas
const CRONO = typeof window !== 'undefined' && /[?&]stats=1/.test(window.location?.search ?? '')

// Factor de borde para los dueños que recortan sus piezas (1 dentro de b·D, 0 en D; sin raíz si está claramente dentro).
// Con el interruptor apagado devuelve 1 (camino de main).
export function kBorde(d2, D, b = 0.7) {
  if (AP.off) return 1
  const d0 = b * D
  if (d2 <= d0 * d0) return 1
  const t = (Math.sqrt(d2) - d0) / (D - d0); const c = t >= 1 ? 1 : t
  return 1 - c * c * (3 - 2 * c)
}

function instAttrs(mesh) {
  const out = [mesh.instanceMatrix]
  if (mesh.instanceColor) out.push(mesh.instanceColor)
  const a = mesh.geometry.attributes
  for (const k in a) if (a[k].isInstancedBufferAttribute) out.push(a[k])
  return out
}

function subeTodo(mesh) { for (const a of instAttrs(mesh)) { a.clearUpdateRanges(); a.needsUpdate = true } }

export default function InstanceCuller({ active, radius = 60 }) {
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const hooks = useRef(null)

  useEffect(() => {
    if (!active) return undefined
    const state = new WeakMap()
    let list = [] // las que recorta este componente (como main)
    let otras = [] // noCull: solo se vigila su visibilidad para el revelado
    let frame = 0
    const restore = []
    const R2 = radius * radius
    const revela = new Map() // malla -> t0 (solo mientras crece)
    const visto = new WeakMap() // malla -> visible en el cuadro anterior
    let tAcc = 0

    const collect = () => {
      list = []; otras = []
      scene.traverse((o) => { if (o.isInstancedMesh) (o.userData.noCull ? otras : list).push(o) })
    }

    const visible = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true }

    // Revelado: detecta el paso de oculta/vacía a dibujarse (una lectura de la cadena de padres por malla)
    const vigila = (mesh, now) => {
      const vis = mesh.count > 0 && !!mesh.parent && visible(mesh)
      const antes = visto.get(mesh)
      visto.set(mesh, vis)
      if (vis && antes === false) revela.set(mesh, now)
      else if (!vis && revela.has(mesh)) revela.delete(mesh)
      return vis
    }

    // Revelado en el sitio (mallas que no compacta este componente): escala la copia que se sube y se restaura tras el render
    const revelaEnSitio = (mesh, rev) => {
      const a = mesh.instanceMatrix; const n = mesh.count; const arr = a.array; const len = n * 16
      let s = state.get(mesh)
      if (!s) { s = { vers: [], n: -1, cam: [Infinity, 0, 0], near: 0, idx: null, backup: [], gpuCompact: false }; state.set(mesh, s) }
      if (!s.backup[0] || s.backup[0].length < len) s.backup[0] = new arr.constructor(len)
      s.backup[0].set(arr.subarray(0, len))
      for (let o = 0; o < len; o += 16) {
        arr[o] *= rev; arr[o + 1] *= rev; arr[o + 2] *= rev
        arr[o + 4] *= rev; arr[o + 5] *= rev; arr[o + 6] *= rev
        arr[o + 8] *= rev; arr[o + 9] *= rev; arr[o + 10] *= rev
      }
      a.clearUpdateRanges(); a.needsUpdate = true
      restore.push(mesh, n, [a])
      s.revSitio = true
    }

    const before = () => {
      const t0 = CRONO ? performance.now() : 0
      if (frame++ % 30 === 0) collect()
      const on = !AP.off
      const now = on ? performance.now() : 0
      const cx = camera.position.x; const cy = camera.position.y; const cz = camera.position.z
      if (on) for (const mesh of otras) vigila(mesh, now)
      else if (revela.size) { for (const mesh of revela.keys()) if (mesh.userData.noCull) subeTodo(mesh); revela.clear() }
      for (const mesh of list) {
        const n = mesh.count
        let rev = 1
        if (on) {
          if (!vigila(mesh, now) && n >= MIN_COUNT) continue
          const r0 = revela.get(mesh)
          if (r0 !== undefined) { rev = Math.min(1, (now - r0) / REVELA_MS); if (rev >= 1) revela.delete(mesh) }
        }
        if (n < MIN_COUNT) {
          const s = state.get(mesh)
          if (s?.gpuCompact) { subeTodo(mesh); s.gpuCompact = false; s.n = -1 }
          if (rev < 1) revelaEnSitio(mesh, rev)
          else if (s?.revSitio) { subeTodo(mesh); s.revSitio = false }
          continue
        }
        if (!mesh.parent || !visible(mesh)) continue
        const attrs = instAttrs(mesh)
        let s = state.get(mesh)
        if (!s) { s = { vers: [], n: -1, cam: [Infinity, 0, 0], near: 0, idx: null, backup: [], gpuCompact: false }; state.set(mesh, s) }
        if (s.revSitio) { s.revSitio = false; s.n = -1 }
        const dirty = s.n !== n || s.on !== on || rev < 1 || s.rev < 1 || attrs.length !== s.vers.length || attrs.some((a, i) => a.version !== s.vers[i]) ||
          (cx - s.cam[0]) ** 2 + (cy - s.cam[1]) ** 2 + (cz - s.cam[2]) ** 2 > MOVE2
        if (!dirty) {
          if (s.gpuCompact) { restore.push(mesh, n, null); mesh.count = s.near }
          continue
        }
        s.on = on; s.rev = rev
        // posición mundial de cada instancia: matrixWorld × traslación de su matriz
        const m = mesh.instanceMatrix.array; const w = mesh.matrixWorld.elements
        if (!s.idx || s.idx.length < n) { s.idx = new Int32Array(n); s.k = new Float32Array(n) }
        let near = 0; let escala = false
        if (on) {
          const b2 = (radius * BORDE) ** 2; const d0 = radius * BORDE; const dd = radius - d0
          for (let i = 0; i < n; i++) {
            const o = i * 16; const x = m[o + 12]; const y = m[o + 13]; const z = m[o + 14]
            const dx = w[0] * x + w[4] * y + w[8] * z + w[12] - cx
            const dy = w[1] * x + w[5] * y + w[9] * z + w[13] - cy
            const dz = w[2] * x + w[6] * y + w[10] * z + w[14] - cz
            const d2 = dx * dx + dy * dy + dz * dz
            if (d2 >= R2) continue
            let k = rev
            if (d2 > b2) { const c = (Math.sqrt(d2) - d0) / dd; k *= 1 - c * c * (3 - 2 * c) }
            if (k < 1) escala = true
            s.k[near] = k
            s.idx[near++] = i
          }
        } else {
          for (let i = 0; i < n; i++) {
            const o = i * 16; const x = m[o + 12]; const y = m[o + 13]; const z = m[o + 14]
            const dx = w[0] * x + w[4] * y + w[8] * z + w[12] - cx
            const dy = w[1] * x + w[5] * y + w[9] * z + w[13] - cy
            const dz = w[2] * x + w[6] * y + w[10] * z + w[14] - cz
            if (dx * dx + dy * dy + dz * dz < R2) s.idx[near++] = i
          }
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
            if (k === 0 && escala) {
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
      // noCull que se están revelando: escala en el sitio solo mientras dura
      if (on && revela.size) {
        for (const [mesh, r0] of revela) {
          if (!mesh.userData.noCull) { if (!mesh.parent) revela.delete(mesh); continue }
          const rev = Math.min(1, (now - r0) / REVELA_MS)
          if (rev >= 1) { revela.delete(mesh); subeTodo(mesh); const s = state.get(mesh); if (s) s.revSitio = false; continue }
          revelaEnSitio(mesh, rev)
        }
      }
      if (CRONO) tAcc = performance.now() - t0
    }

    const after = () => {
      const t0 = CRONO ? performance.now() : 0
      for (let i = 0; i < restore.length; i += 3) {
        const mesh = restore[i]; const n = restore[i + 1]; const attrs = restore[i + 2]
        mesh.count = n
        if (attrs) {
          const s = state.get(mesh)
          attrs.forEach((a, k) => a.array.set(s.backup[k].subarray(0, n * a.itemSize)))
        }
      }
      restore.length = 0
      if (CRONO) { tAcc += performance.now() - t0; AP.ms = AP.ms * 0.95 + tAcc * 0.05 }
    }

    hooks.current = { before, after }
    return () => {
      after()
      // al apagarse, la GPU puede quedar con datos compactados o escalados: forzar subida completa
      for (const mesh of [...list, ...otras]) { const s = state.get(mesh); if (s?.gpuCompact || s?.revSitio) subeTodo(mesh) }
      hooks.current = null
    }
  }, [active, radius, scene, camera])

  useFrame(() => hooks.current?.before(), 0.9)
  useFrame(() => hooks.current?.after(), 2)
  return null
}
