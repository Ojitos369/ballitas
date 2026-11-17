// Instancias animadas: una InstancedMesh por pieza cuyo `count` se rehace cada cuadro con solo lo cercano
// (el InstanceCuller global la ignora: userData.noCull). Más la lista de lo cercano a la cámara.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

export function useDyn(geo, mat, cap) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, cap))
    m.count = 0
    m.frustumCulled = false // el conjunto cambia cada cuadro: su esfera envolvente no sirve
    m.userData.noCull = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return m
  }, [geo, mat, cap])
  useEffect(() => () => mesh.dispose(), [mesh])
  return mesh
}

const _m = new THREE.Matrix4(); const _s = new THREE.Vector3()
/** Escribe la instancia `mesh.count` y avanza. s: escala uniforme o [x, y, z]. */
export function push(mesh, pos, quat, s, color) {
  const i = mesh.count
  if (i >= mesh.instanceMatrix.count) return
  if (typeof s === 'number') _s.setScalar(s); else _s.set(s[0], s[1], s[2])
  mesh.setMatrixAt(i, _m.compose(pos, quat, _s))
  if (color) mesh.setColorAt(i, color)
  mesh.count = i + 1
}
export function begin(...meshes) { for (const m of meshes) m.count = 0 }
export function end(...meshes) {
  for (const m of meshes) {
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }
}

/** Índices de `items` (con .pos) a menos de `r` de la cámara; se recalcula al moverse ~2 u. */
export function nearList(state, items, cam, r) {
  const c = cam.position
  if (state.list && state.cam.distanceToSquared(c) < 4) return state.list
  state.cam = (state.cam || new THREE.Vector3()).copy(c)
  const r2 = r * r; const out = []
  for (let i = 0; i < items.length; i++) if (items[i].pos.distanceToSquared(c) < r2) out.push(i)
  state.list = out
  return out
}

/** Cuaternión con base (X = up × tangent, Y = up, Z = tangent): diestra aunque side = tangent × up. */
const _b = new THREE.Matrix4(); const _x = new THREE.Vector3(); const _z = new THREE.Vector3()
export function basisQuat(up, tangent, out = new THREE.Quaternion()) {
  _x.crossVectors(up, tangent).normalize()
  _z.crossVectors(_x, up)
  return out.setFromRotationMatrix(_b.makeBasis(_x, up, _z))
}
