// Anillos neón en todos los caminos: instanciados cada ~33 u rodeando la calzada completa,
// teñidos con el color base del camino/ruta y con un pulso suave de brillo que viaja por la pista
// actualizando un único uniform global en un solo useFrame. A detalle bajo (< 0.3) usa aro ligero sin textura.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { getWayDetail, markShared } from './base.jsx'
import { RING_RANGE, buildAnillosData } from './colocacion.js'
import { precargarKit, useKit } from '../Modelos.jsx'

const RING_TIME = { value: 0 }

let _coreMat = null
function ringCoreMat(baseMat) {
  if (_coreMat) return _coreMat
  const m = baseMat.clone()
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRingTime = RING_TIME
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPhase;\nattribute vec3 aTint;\nvarying float vRingPhase;\nvarying vec3 vRingTint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRingPhase = aPhase;\nvRingTint = aTint;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRingTime;\nvarying float vRingPhase;\nvarying vec3 vRingTint;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nfloat _rw = 0.5 + 0.5 * sin(vRingPhase - uRingTime * 3.2);\ndiffuseColor.rgb *= vRingTint * (0.7 + 0.3 * _rw);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat _rp = 0.72 + 0.68 * pow(0.5 + 0.5 * sin(vRingPhase - uRingTime * 3.2), 3.0);\ntotalEmissiveRadiance *= vRingTint * _rp * 1.45;')
  }
  m.customProgramCacheKey = () => 'kit-anillo-core-v1'
  markShared(m)
  _coreMat = m
  return m
}

let _lowGeoBase = null
function lowRingBaseGeo() {
  if (!_lowGeoBase) {
    _lowGeoBase = new THREE.TorusGeometry(0.56, 0.06, 5, 16).translate(0, 0.66, 0)
    _lowGeoBase.name = 'anillos:lowBase'
    markShared(_lowGeoBase)
  }
  return _lowGeoBase
}

let _lowMat = null
function lowRingMat() {
  if (_lowMat) return _lowMat
  const m = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRingTime = RING_TIME
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPhase;\nattribute vec3 aTint;\nvarying float vRingPhase;\nvarying vec3 vRingTint;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRingPhase = aPhase;\nvRingTint = aTint;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uRingTime;\nvarying float vRingPhase;\nvarying vec3 vRingTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat _rp = 0.72 + 0.68 * pow(0.5 + 0.5 * sin(vRingPhase - uRingTime * 3.2), 3.0);\ndiffuseColor.rgb *= vRingTint * _rp * 1.35;')
  }
  m.customProgramCacheKey = () => 'anillos-low-v1'
  markShared(m)
  _lowMat = m
  return m
}

export function anillosWarmup() {
  return [lowRingMat()]
}

function populateRingMesh(mesh, rings) {
  const m = new THREE.Matrix4()
  const s = new THREE.Vector3()
  mesh.count = rings.length
  for (let i = 0; i < rings.length; i++) {
    const r = rings[i]
    s.setScalar(r.scale)
    mesh.setMatrixAt(i, m.compose(r.pos, r.quat, s))
  }
  mesh.instanceMatrix.needsUpdate = true
}

function attachRingAttrs(baseGeo, phases, tints) {
  const g = baseGeo.clone()
  g.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1))
  g.setAttribute('aTint', new THREE.InstancedBufferAttribute(tints, 3))
  return g
}

export default function Anillos({ way }) {
  useEffect(() => { precargarKit(['anillo_neon_lod']) }, [])
  const kit = useKit('anillo_neon_lod')
  const data = useMemo(() => buildAnillosData(way), [way])
  const detail = getWayDetail(way)
  const camera = useThree((s) => s.camera)
  const hiRef = useRef()
  const loRef = useRef()

  const hiBundle = useMemo(() => {
    if (!kit || !data.rings.length) return null
    const geo = attachRingAttrs(kit.geometry, data.phases, data.tints)
    const baseMat = kit.material
    const mat = Array.isArray(baseMat)
      ? [ringCoreMat(baseMat[0]), ...baseMat.slice(1)]
      : ringCoreMat(baseMat)
    const mesh = new THREE.InstancedMesh(geo, mat, data.rings.length)
    populateRingMesh(mesh, data.rings)
    mesh.boundingSphere = data.sphere
    mesh.frustumCulled = true
    return { geo, mesh }
  }, [kit, data])

  const loBundle = useMemo(() => {
    if (!data.rings.length) return null
    const geo = attachRingAttrs(lowRingBaseGeo(), data.phases, data.tints)
    const mesh = new THREE.InstancedMesh(geo, lowRingMat(), data.rings.length)
    populateRingMesh(mesh, data.rings)
    mesh.boundingSphere = data.sphere
    mesh.frustumCulled = true
    return { geo, mesh }
  }, [data])

  useEffect(() => () => {
    if (hiBundle) { hiBundle.mesh.dispose(); hiBundle.geo.dispose() }
  }, [hiBundle])

  useEffect(() => () => {
    if (loBundle) { loBundle.mesh.dispose(); loBundle.geo.dispose() }
  }, [loBundle])

  const frameMatrix = useMemo(() => new THREE.Matrix4(), [])
  const frameScale = useMemo(() => new THREE.Vector3(), [])
  const lastCam = useRef(new THREE.Vector3(Infinity, 0, 0))
  const lastLow = useRef(null)
  useFrame(({ clock }) => {
    RING_TIME.value = clock.elapsedTime
    const isLow = detail ? detail.value < 0.3 : false
    if (hiRef.current) hiRef.current.visible = !isLow
    if (loRef.current) loRef.current.visible = isLow
    const mesh = isLow ? loRef.current : hiRef.current
    if (!mesh) return
    if (lastLow.current === isLow && camera.position.distanceToSquared(lastCam.current) < 9) return
    lastLow.current = isLow
    lastCam.current.copy(camera.position)
    const phaseAttr = mesh.geometry.getAttribute('aPhase')
    const tintAttr = mesh.geometry.getAttribute('aTint')
    let count = 0
    for (let i = 0; i < data.rings.length; i++) {
      const ring = data.rings[i]
      if (camera.position.distanceToSquared(ring.pos) > RING_RANGE * RING_RANGE) continue
      frameScale.setScalar(ring.scale)
      mesh.setMatrixAt(count, frameMatrix.compose(ring.pos, ring.quat, frameScale))
      phaseAttr.setX(count, ring.phase)
      tintAttr.setXYZ(count, ring.color.r, ring.color.g, ring.color.b)
      count++
    }
    mesh.count = count
    if (count) {
      mesh.instanceMatrix.needsUpdate = true
      phaseAttr.needsUpdate = true
      tintAttr.needsUpdate = true
    }
  })

  if (!data.rings.length) return null
  return (
    <group>
      {hiBundle && <primitive ref={hiRef} object={hiBundle.mesh} />}
      {loBundle && <primitive ref={loRef} object={loBundle.mesh} visible={false} />}
    </group>
  )
}
