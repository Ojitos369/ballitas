// Utilidades compartidas de los módulos de "vida" por tema (ver README.md de esta carpeta).
// Todo lo que se coloca aquí vive DENTRO del tubo de cristal: cada camino es un diorama/terrario.
// Convenciones de marco (iguales a Paths.jsx):
//   frame = { pos (eje del tubo), T (tangente), up (del suelo hacia el eje), right = up × T }
//   ángulo sobre la pared: 0 = suelo (dirección -up), positivo girando hacia `right`, ±π = techo.
//   offset: distancia desde la pared hacia el eje (0 = apoyado en la pared).
import { Component, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Billboard as DreiBillboard } from '@react-three/drei'
import * as THREE from 'three'
import * as WORLD from '../../../Core/world.js'
import { VISUALS } from '../themes.js'

export const TAU = Math.PI * 2
export const BALL_R = WORLD.BALL_R ?? 0.5
export const FILL = 0.6 // fracción máxima de la sección que puede ocupar el mini mundo
export const mulberry32 = WORLD.mulberry32

/**
 * lodPiece(geo, s) -> geo o una esfera/cápsula sin transformar con menos segmentos si la pieza mide poco
 * (radio × escala `s`). Ojos, mejillas y patitas se instancian cientos de veces por vía.
 */
export function lodPiece(geo, s = 1) {
  const p = geo.parameters
  if (!p || !(p.radius > 0)) return geo
  const k = p.radius * s
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  // solo piezas recién creadas (sin translate/rotate previos), si no se perdería la transformación
  if (geo.type === 'SphereGeometry' && p.widthSegments > 6 && k < 0.13 && Math.abs(bb.max.y + bb.min.y) < 1e-4 && Math.abs(bb.max.x + bb.min.x) < 1e-4) {
    const tiny = k < 0.06
    return new THREE.SphereGeometry(p.radius, tiny ? 5 : 6, tiny ? 4 : 5, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength)
  }
  const h = p.height ?? p.length
  if (geo.type === 'CapsuleGeometry' && p.capSegments > 2 && k < 0.1 && Math.abs(bb.max.y - (p.radius + h / 2)) < 1e-4) {
    return new THREE.CapsuleGeometry(p.radius, h, 2, Math.min(p.radialSegments, 5))
  }
  return geo
}

/** Marca un recurso (geometría, material o textura) como compartido para que no se libere al desmontar un way. */
export function markShared(obj) {
  if (!obj) return obj
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) markShared(obj[i])
    return obj
  }
  if (obj.isBufferGeometry || obj.isMaterial || obj.isTexture) {
    obj.userData = obj.userData || {}
    obj.userData.shared = true
    return obj
  }
  if (typeof obj === 'object') {
    for (const k in obj) {
      const v = obj[k]
      if (v && (v.isBufferGeometry || v.isMaterial || v.isTexture)) {
        v.userData = v.userData || {}
        v.userData.shared = true
        if (v.isBufferGeometry && !v.name) v.name = k // rastreo en ?stats=1 (__ballitasDebug)
      }
    }
  }
  return obj
}

function disposeMaterialAndOwnedMaps(mat) {
  if (!mat || mat.userData?.shared) return
  for (const k in mat) {
    const v = mat[k]
    if (v && v.isTexture && !v.userData?.shared) v.dispose()
  }
  mat.dispose?.()
}

/** Libera geometrías (todas) y materiales NO compartidos dentro de un subárbol Object3D al desmontar. */
export function disposeObject3D(root) {
  if (!root) return
  root.traverse((obj) => {
    // También las compartidas: dispose solo libera los buffers GPU y three los vuelve a subir si se reutilizan.
    obj.geometry?.dispose?.()
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        for (let i = 0; i < obj.material.length; i++) disposeMaterialAndOwnedMaps(obj.material[i])
      } else {
        disposeMaterialAndOwnedMaps(obj.material)
      }
    }
    obj.dispose?.()
  })
}

/** Hook: libera geometrías/materiales/texturas propias (no marcadas shared) al cambiar o desmontar. */
export function useAutoDispose(resource) {
  useEffect(() => () => {
    if (!resource) return
    if (Array.isArray(resource)) {
      for (let i = 0; i < resource.length; i++) {
        const r = resource[i]
        if (!r || r.userData?.shared) continue
        if (r.isMaterial) disposeMaterialAndOwnedMaps(r)
        else r.dispose?.()
      }
      return
    }
    if (resource.isBufferGeometry || resource.isTexture) {
      if (!resource.userData?.shared) resource.dispose?.()
      return
    }
    if (resource.isMaterial) {
      disposeMaterialAndOwnedMaps(resource)
      return
    }
    if (typeof resource === 'object') {
      for (const k in resource) {
        const v = resource[k]
        if (!v || v.userData?.shared) continue
        if (v.isBufferGeometry || v.isTexture) v.dispose?.()
        else if (v.isMaterial) disposeMaterialAndOwnedMaps(v)
      }
    }
  }, [resource])
}

const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)

// ═══════════════════════════ BUS DE DATOS EN VIVO ═══════════════════════════
// Paths.jsx escribe aquí la simulación en cada frame; los módulos solo leen.
export const VIDA_BUS = { sim: null }
const NO_BALLITAS = []
export function getBallitas() {
  return VIDA_BUS.sim?.ballitas ?? NO_BALLITAS
}

// ═══════════════════════════ MARCOS DEL TUBO ═══════════════════════════
// Copia fiel de buildCurveFrames de Paths.jsx (transporte paralelo + sesgo suave hacia -Y),
// para que el contenido quede alineado con el piso y los rieles que dibuja Paths.
function fallbackN(T) {
  return new THREE.Vector3().crossVectors(T, Math.abs(T.y) > 0.9 ? X : Y).normalize()
}

const _qStep = new THREE.Quaternion()
function buildFrames(curve, length) {
  const preN = Math.min(128, Math.max(48, Math.ceil(length * 1.5)))
  const prePos = new Array(preN + 1)
  const preTan = new Array(preN + 1)
  const cdf = new Float32Array(preN + 1)
  let totalAng = 0
  for (let k = 0; k <= preN; k++) {
    const u = k / preN
    prePos[k] = curve.getPointAt(u)
    preTan[k] = curve.getTangentAt(u)
    if (k > 0) {
      const ds = prePos[k].distanceTo(prePos[k - 1])
      const dAng = preTan[k - 1].angleTo(preTan[k])
      totalAng += dAng
      cdf[k] = cdf[k - 1] + ds * 0.45 + dAng * 4.5 + 0.05
    }
  }
  const totalW = cdf[preN] || 1
  const steps = THREE.MathUtils.clamp(Math.ceil(length * 2.4 + totalAng * 18), 18, 260)
  const frames = new Array(steps + 1)
  const T0 = preTan[0]
  let down = Y.clone().negate().addScaledVector(T0, T0.y)
  if (down.lengthSq() < 0.02) down = fallbackN(T0).negate()
  down.normalize()
  let arc = 0
  let prevP = prePos[0]
  const prevT = T0.clone()
  let preIdx = 1
  for (let i = 0; i <= steps; i++) {
    let u = 0
    if (i === steps) u = 1
    else if (i > 0) {
      const targetW = (i / steps) * totalW
      while (preIdx < preN && cdf[preIdx] < targetW) preIdx++
      const w0 = cdf[preIdx - 1]; const w1 = cdf[preIdx]
      const frac = w1 > w0 ? (targetW - w0) / (w1 - w0) : 0
      u = (preIdx - 1 + frac) / preN
    }
    const pos = i === 0 ? prevP.clone() : curve.getPointAt(u)
    if (i > 0) arc += pos.distanceTo(prevP)
    prevP = pos
    const T = i === 0 ? T0.clone() : curve.getTangentAt(u)
    if (i > 0) {
      _qStep.setFromUnitVectors(prevT, T)
      down.applyQuaternion(_qStep)
      down.addScaledVector(T, -down.dot(T))
      if (down.lengthSq() < 1e-5) down = fallbackN(T).negate()
      down.normalize()
    }
    prevT.copy(T)
    const wd = Y.clone().negate().addScaledVector(T, T.y)
    if (wd.lengthSq() > 0.14) {
      wd.normalize()
      if (down.dot(wd) > 0.2) down.lerp(wd, 0.18).normalize()
    }
    const up = down.clone().negate()
    const right = new THREE.Vector3().crossVectors(up, T)
    if (right.lengthSq() < 1e-5) right.copy(fallbackN(T))
    else right.normalize()
    frames[i] = { pos, T, up, right, arc, u }
  }
  return frames
}

const frameCache = new WeakMap()
/** Marcos (cacheados) de un tramo. */
export function segFrames(seg) {
  let f = frameCache.get(seg)
  if (!f) {
    f = buildFrames(seg.curve, seg.length)
    frameCache.set(seg, f)
  }
  return f
}

/** Marco interpolado sin crear objetos: escribe en `out` = { pos, T, up, right } (Vector3). */
export function sampleFrameInto(frames, u, out) {
  const tu = THREE.MathUtils.clamp(u, 0, 1)
  let lo = 0; let hi = frames.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (frames[mid].u <= tu) lo = mid
    else hi = mid
  }
  const a = frames[lo]; const b = frames[hi]
  const span = b.u - a.u
  const al = span > 1e-6 ? THREE.MathUtils.clamp((tu - a.u) / span, 0, 1) : 0
  out.pos.copy(a.pos).lerp(b.pos, al)
  out.T.copy(a.T).lerp(b.T, al).normalize()
  out.up.copy(a.up).lerp(b.up, al)
  out.up.addScaledVector(out.T, -out.up.dot(out.T))
  if (out.up.lengthSq() < 1e-5) out.up.copy(a.up)
  out.up.normalize()
  out.right.crossVectors(out.up, out.T).normalize()
  return out
}

export function makeFrame() {
  return { pos: new THREE.Vector3(), T: new THREE.Vector3(), up: new THREE.Vector3(), right: new THREE.Vector3() }
}

export function makePlacement() {
  return {
    pos: new THREE.Vector3(), quat: new THREE.Quaternion(), up: new THREE.Vector3(),
    tangent: new THREE.Vector3(), side: new THREE.Vector3(), center: new THREE.Vector3(), R: 1,
  }
}

const _f = makeFrame()
const _m = new THREE.Matrix4()
const _d = new THREE.Vector3()

/**
 * Versión sin asignaciones de placeAlong: escribe en `out` (de makePlacement()).
 * up = normal de la pared hacia el eje; quat orienta Y local = up, Z local = tangente.
 */
export function placeAlongInto(seg, u, offset, angle, out) {
  const f = sampleFrameInto(segFrames(seg), u, _f)
  const R = seg.radius
  const c = Math.cos(angle); const s = Math.sin(angle)
  _d.copy(f.up).multiplyScalar(-c).addScaledVector(f.right, s) // del eje hacia la pared
  out.center.copy(f.pos)
  out.pos.copy(f.pos).addScaledVector(_d, R - offset)
  out.up.copy(_d).negate()
  out.tangent.copy(f.T)
  out.side.crossVectors(out.up, out.tangent).normalize()
  _m.makeBasis(out.side, out.up, out.tangent)
  out.quat.setFromRotationMatrix(_m)
  out.R = R
  return out
}

/** placeAlong(segment, u, offset, angle) -> { pos, quat, up, tangent, side, center, R } (objetos nuevos). */
export function placeAlong(seg, u, offset = 0, angle = 0) {
  return placeAlongInto(seg, u, offset, angle, makePlacement())
}

// ═══════════════════════════ CARRILES ═══════════════════════════
// Contrato (lo implementa world.js/sim.js): segment.lanes[] { id, angle, offset, width },
// segment.switches[] { u, from, to, kind, duration }. Mientras no exista, hay un carril 0 en el suelo.
export function lanesOf(seg) {
  if (seg?.lanes?.length) return seg.lanes
  return [{ id: 0, angle: 0, offset: 0, width: BALL_R * 2.4 }]
}

export function switchesOf(seg) {
  return seg?.switches ?? []
}

const W = WORLD
const worldLaneFrame = W['lane' + 'Frame'] // acceso dinámico: existe solo cuando world.js lo implemente

/** laneFrame(segment, laneId, u) -> { pos (sobre la pared), tangent, up (hacia el eje), side }. */
export function laneFrame(seg, laneId, u) {
  if (typeof worldLaneFrame === 'function') return worldLaneFrame(seg, laneId, u)
  const lanes = lanesOf(seg)
  const lane = lanes.find((l) => l.id === laneId) ?? lanes[0]
  const p = placeAlong(seg, u, 0, lane.angle + (lane.offset || 0) / Math.max(seg.radius, 1e-3))
  return { pos: p.pos, tangent: p.tangent, up: p.up, side: p.side }
}

/** Distancia angular mínima (rad) de `angle` a cualquier carril del tramo. */
export function laneGap(seg, angle) {
  let best = Infinity
  for (const l of lanesOf(seg)) {
    const a = l.angle + (l.offset || 0) / Math.max(seg.radius, 1e-3)
    let d = Math.abs(((angle - a + Math.PI) % TAU + TAU) % TAU - Math.PI)
    d -= (l.width || BALL_R * 2.4) * 0.5 / Math.max(seg.radius, 1e-3)
    if (d < best) best = d
  }
  return best
}

/** Altura máxima (desde la pared) que puede tener un objeto sin invadir el cauce central. */
export function maxHeight(seg) {
  return seg.radius * FILL
}

// ═══════════════════════════ INFORMACIÓN DE RUTA ═══════════════════════════
const routeCache = new WeakMap()

/**
 * routeInfo(way) -> {
 *   way, theme, V (VISUALS del tema), radius,
 *   segments[]: { seg, i, kind, name, emoji, event, speedK, length, route, air, radius,
 *                 start (arco acumulado en su ruta), mid (punto medio), lanes, switches },
 *   routes[]:   { route, r, name, profile, length, segments[] (infos) },
 *   shared[], events[], byI: Map(i -> info)
 * }
 */
export function routeInfo(way) {
  let info = routeCache.get(way)
  if (info) return info
  const byI = new Map()
  const segments = way.segments.map((seg) => {
    const si = {
      seg, i: seg.i, kind: seg.kind, name: seg.name, emoji: seg.emoji, event: seg.event,
      speedK: seg.speedK, length: seg.length, route: seg.route, air: seg.air, radius: seg.radius,
      start: undefined, mid: seg.curve.getPointAt(0.5), lanes: lanesOf(seg), switches: switchesOf(seg),
    }
    byI.set(seg.i, si)
    return si
  })
  const bySeg = new Map(segments.map((s) => [s.seg, s]))
  const routes = (way.routes ?? []).map((rt) => {
    let acc = 0
    const segs = rt.segments.map((s) => {
      const si = bySeg.get(s)
      if (si && si.start === undefined) si.start = acc
      acc += s.length
      return si
    }).filter(Boolean)
    return { route: rt, r: rt.r, name: rt.name, profile: rt.profile, length: rt.length, segments: segs }
  })
  for (const s of segments) if (s.start === undefined) s.start = 0
  info = {
    way, theme: way.theme, V: VISUALS[way.theme.id], radius: way.params.radius,
    segments, routes,
    shared: segments.filter((s) => s.route < 0),
    events: segments.filter((s) => s.event),
    byI,
  }
  routeCache.set(way, info)
  return info
}

/** Camino continuo sobre varios tramos (los `air` se saltan): { segs, cum, total, locate(s, out) }. */
export function segPath(segs) {
  const list = segs.filter((s) => s && !s.air)
  const cum = new Float32Array(list.length + 1)
  for (let i = 0; i < list.length; i++) cum[i + 1] = cum[i] + list[i].length
  const total = cum[list.length]
  const index = new Map(list.map((s, i) => [s, i]))
  const locate = (s, out = {}) => {
    const t = THREE.MathUtils.clamp(s, 0, total)
    let lo = 0; let hi = list.length - 1
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1
      if (cum[mid] <= t) lo = mid
      else hi = mid - 1
    }
    out.seg = list[lo]
    out.u = list[lo] ? (t - cum[lo]) / Math.max(list[lo].length, 1e-6) : 0
    return out
  }
  const arcOf = (seg, u) => {
    const k = index.get(seg)
    return k === undefined ? null : cum[k] + u * seg.length
  }
  return { segs: list, cum, total, locate, arcOf }
}

// ═══════════════════════════ DISPERSIÓN ═══════════════════════════
/**
 * scatter(way, n, rng, opts) -> items[] { seg, u, angle, offset, pos, quat, up, tangent, side, scale, rnd }
 * opts:
 *   segments: array de segmentos o función (seg) => bool (por defecto todos los que tienen tubo)
 *   angle: [min, max] rango angular sobre la pared (por defecto [-0.62π, 0.62π]: piso y laderas)
 *   clear: margen angular extra (rad) libre alrededor de cada carril (por defecto el ancho de la ballita)
 *   offset: [min, max] en unidades de mundo desde la pared (por defecto [0, 0])
 *   u: [min, max] rango a lo largo de cada tramo (por defecto [0.04, 0.96])
 *   scale: [min, max] escala uniforme (por defecto [1, 1])
 */
export function scatter(way, n, rng, opts = {}) {
  const {
    segments = null, angle = [-Math.PI * 0.62, Math.PI * 0.62], clear = BALL_R * 0.6,
    offset = [0, 0], u: uRange = [0.04, 0.96], scale = [1, 1],
  } = opts
  let segs = way.segments.filter((s) => !s.air)
  if (Array.isArray(segments)) segs = segments.filter((s) => !s.air)
  else if (typeof segments === 'function') segs = segs.filter(segments)
  if (!segs.length || n <= 0) return []
  const cum = []
  let tot = 0
  for (const s of segs) { tot += s.length; cum.push(tot) }
  const out = []
  for (let tries = 0; out.length < n && tries < n * 8; tries++) {
    const pick = rng() * tot
    let k = 0
    while (k < cum.length - 1 && cum[k] < pick) k++
    const seg = segs[k]
    const u = uRange[0] + rng() * (uRange[1] - uRange[0])
    const a = angle[0] + rng() * (angle[1] - angle[0])
    if (laneGap(seg, a) < clear / Math.max(seg.radius, 1e-3)) continue
    const off = offset[0] + rng() * (offset[1] - offset[0])
    const p = placeAlong(seg, u, off, a)
    out.push({ seg, u, angle: a, offset: off, ...p, scale: scale[0] + rng() * (scale[1] - scale[0]), rnd: rng() })
  }
  return out
}

// ═══════════════════════════ INSTANCIADO ═══════════════════════════
const _s = new THREE.Vector3()
const _c = new THREE.Color()

function writeInstance(mesh, i, it) {
  const sc = it.scale ?? 1
  if (typeof sc === 'number') _s.setScalar(sc)
  else if (Array.isArray(sc)) _s.set(sc[0], sc[1], sc[2])
  else _s.copy(sc)
  _m.compose(it.pos, it.quat ?? IDENT_Q, _s)
  mesh.setMatrixAt(i, _m)
  if (it.color != null && mesh.instanceColor !== undefined) mesh.setColorAt(i, _c.set(it.color))
}
const IDENT_Q = new THREE.Quaternion()

/**
 * useInstanced(geo, mat, items) -> THREE.InstancedMesh (estable mientras geo/mat/longitud no cambien).
 * items: { pos, quat?, scale? (número | [x,y,z] | Vector3), color? }. Renderízalo con <primitive object={mesh} />.
 */
export function useInstanced(geo, mat, items, { dynamic = false } = {}) {
  const cap = Math.max(1, items?.length ?? 0)
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, cap)
    m.frustumCulled = !dynamic
    return m
  }, [geo, mat, cap, dynamic])
  useLayoutEffect(() => {
    const list = items ?? []
    mesh.count = list.length
    for (let i = 0; i < list.length; i++) writeInstance(mesh, i, list[i])
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (!dynamic && list.length > 0) {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere()
      mesh.computeBoundingSphere?.()
    }
  }, [mesh, items, dynamic])
  useEffect(() => () => mesh.dispose(), [mesh])
  return mesh
}

/** Atajo declarativo de useInstanced. */
export function Instanced({ geo, mat, items, castShadow = false, receiveShadow = false }) {
  const mesh = useInstanced(geo, mat, items)
  if (!items?.length) return null
  return <primitive object={mesh} castShadow={castShadow} receiveShadow={receiveShadow} />
}

// ═══════════════════════════ TEXTO EN CANVAS (CACHEADO) ═══════════════════════════
const textCache = new Map()
const matCache = new Map()
// Topes bajos: los carteles en uso están retenidos (refs); esto solo acota los de vidas ya desmontadas (~1 MB GPU c/u).
const MAX_TEXT_CACHE = 24
const MAX_MAT_CACHE = 32
let cacheEpoch = 0
let cacheEpochPending = false

function currentCacheEpoch() {
  if (!cacheEpochPending) {
    cacheEpochPending = true
    queueMicrotask(() => {
      cacheEpoch += 1
      cacheEpochPending = false
    })
  }
  return cacheEpoch
}

function isTextInUse(textKey, textEntry) {
  if (textEntry.refs > 0) return true
  for (const m of matCache.values()) {
    if (m.textKey === textKey && m.refs > 0) return true
  }
  return false
}

function pruneTextCache(protectEpoch = -1) {
  if (textCache.size <= MAX_TEXT_CACHE) return
  for (const [k, entry] of textCache) {
    if (textCache.size <= MAX_TEXT_CACHE) break
    if (protectEpoch >= 0 && entry.epoch === protectEpoch) continue
    if (isTextInUse(k, entry)) continue
    for (const [mk, me] of matCache) {
      if (me.textKey === k) {
        matCache.delete(mk)
        me.mat?.dispose?.()
      }
    }
    textCache.delete(k)
    entry.texture?.dispose?.()
  }
}

function pruneMatCache(protectEpoch = -1) {
  if (matCache.size <= MAX_MAT_CACHE) return
  for (const [k, entry] of matCache) {
    if (matCache.size <= MAX_MAT_CACHE) break
    if (protectEpoch >= 0 && entry.epoch === protectEpoch) continue
    if (entry.refs > 0) continue
    matCache.delete(k)
    entry.mat?.dispose?.()
  }
}

function retainText(key) {
  const entry = textCache.get(key)
  if (entry) entry.refs += 1
}

function releaseText(key) {
  const entry = textCache.get(key)
  if (entry && entry.refs > 0) entry.refs -= 1
  pruneTextCache()
}

function retainMat(key) {
  const entry = matCache.get(key)
  if (entry) entry.refs += 1
}

function releaseMat(key) {
  const entry = matCache.get(key)
  if (entry && entry.refs > 0) entry.refs -= 1
  pruneMatCache()
}

/**
 * CanvasText(texto, estilo) -> { texture, aspect, key }  (cacheado por texto + estilo).
 * estilo: { size (px, 56), font ('bold'), family, color, bg, border, borderW, pad, radius, sub (segunda línea), subColor }
 * Admite '\n' para varias líneas.
 */
export function CanvasText(texto, estilo = {}) {
  const key = `${texto}|${JSON.stringify(estilo)}`
  const epoch = currentCacheEpoch()
  const hit = textCache.get(key)
  if (hit) {
    hit.epoch = epoch
    textCache.delete(key)
    textCache.set(key, hit)
    return hit
  }
  const {
    size = 56, font = 'bold', family = 'system-ui, sans-serif', color = '#ffffff',
    bg = 'rgba(14,18,34,0.9)', border = '#ffffff', borderW = 6, pad = 26, radius = 22,
    sub = null, subColor = null, subScale = 0.6,
  } = estilo
  let tex
  let aspect = 3
  if (typeof document === 'undefined') {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  } else {
    const lines = String(texto).split('\n')
    const subLines = sub ? String(sub).split('\n') : []
    const meas = document.createElement('canvas').getContext('2d')
    meas.font = `${font} ${size}px ${family}`
    let w = 0
    for (const l of lines) w = Math.max(w, meas.measureText(l).width)
    const subSize = Math.round(size * subScale)
    meas.font = `${font} ${subSize}px ${family}`
    for (const l of subLines) w = Math.max(w, meas.measureText(l).width)
    const lh = size * 1.15
    const slh = subSize * 1.2
    const cw = Math.ceil(w + pad * 2)
    const ch = Math.ceil(lines.length * lh + subLines.length * slh + pad * 1.6)
    const c = document.createElement('canvas')
    c.width = THREE.MathUtils.ceilPowerOfTwo(cw)
    c.height = THREE.MathUtils.ceilPowerOfTwo(ch)
    const ctx = c.getContext('2d')
    ctx.scale(c.width / cw, c.height / ch)
    ctx.clearRect(0, 0, cw, ch)
    ctx.fillStyle = bg
    ctx.strokeStyle = border
    ctx.lineWidth = borderW
    ctx.beginPath()
    ctx.roundRect(borderW * 0.5, borderW * 0.5, cw - borderW, ch - borderW, radius)
    ctx.fill()
    if (borderW > 0) ctx.stroke()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    let y = pad * 0.8 + lh * 0.5
    ctx.font = `${font} ${size}px ${family}`
    ctx.fillStyle = color
    for (const l of lines) { ctx.fillText(l, cw * 0.5, y); y += lh }
    ctx.font = `${font} ${subSize}px ${family}`
    ctx.fillStyle = subColor ?? border
    y += (slh - lh) * 0.5
    for (const l of subLines) { ctx.fillText(l, cw * 0.5, y); y += slh }
    tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
    aspect = cw / ch
  }
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  markShared(tex)
  const out = { texture: tex, aspect, key, refs: 0, epoch }
  textCache.set(key, out)
  pruneTextCache(epoch)
  return out
}

/** Material cacheado para un CanvasText (no se crea por frame ni por render). */
export function textMaterial(ct, { glow = 1 } = {}) {
  const key = `${ct.key}|${glow}`
  const epoch = currentCacheEpoch()
  const hit = matCache.get(key)
  if (hit && hit.mat?.map === ct.texture) {
    hit.epoch = epoch
    matCache.delete(key)
    matCache.set(key, hit)
    return hit.mat
  }
  if (hit) {
    matCache.delete(key)
    hit.mat?.dispose?.()
  }
  const m = markShared(new THREE.MeshBasicMaterial({
    map: ct.texture, transparent: true, alphaTest: 0.04, side: THREE.DoubleSide, toneMapped: false,
  }))
  m.color.setScalar(glow)
  matCache.set(key, { mat: m, key, textKey: ct.key, refs: 0, epoch })
  pruneMatCache(epoch)
  return m
}

const PLANE_GEO = markShared(new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0)) // base en y = 0

/**
 * <Billboard text style height position quat faceCamera glow />
 * faceCamera: true usa el Billboard de drei (siempre de frente); false usa `quat` (cartel fijo).
 */
export function Billboard({ text, style, height = 0.5, position, quat, faceCamera = false, glow = 1 }) {
  const styleKey = JSON.stringify(style ?? {})
  const { ct, mat, matKey } = useMemo(() => {
    const c = CanvasText(text, style)
    const m = textMaterial(c, { glow })
    return { ct: c, mat: m, matKey: `${c.key}|${glow}` }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, styleKey, glow])

  useEffect(() => {
    retainText(ct.key)
    retainMat(matKey)
    return () => {
      releaseMat(matKey)
      releaseText(ct.key)
    }
  }, [ct.key, matKey])

  const sc = [height * ct.aspect, height, 1]
  if (faceCamera) {
    return (
      <DreiBillboard position={position}>
        <mesh geometry={PLANE_GEO} material={mat} scale={sc} />
      </DreiBillboard>
    )
  }
  return <mesh geometry={PLANE_GEO} material={mat} position={position} quaternion={quat} scale={sc} />
}

// ═══════════════════════════ CRIATURAS ═══════════════════════════
/**
 * <Critter way segments count geo mat scale speed offset angle spread hop reactRadius colors seed />
 * Criaturas instanciadas que patrullan a lo largo del tubo (ida y vuelta suave), se balancean en la
 * pared y reaccionan a las ballitas cercanas: saltan (`hop`) y se apartan del carril.
 *   segments: tramos por los que patrulla (por defecto los de la primera ruta)
 *   angle: ángulo central sobre la pared; spread: amplitud de su vaivén angular
 *   speed: unidades/s; range: tramo de arco [0..1] del camino que recorre cada una (por defecto todo)
 */
export function Critter({
  way, segments = null, count = 6, geo, mat, scale = 0.18, speed = 0.6, offset = 0,
  angle = 0.9, spread = 0.25, hop = 0.35, reactRadius = 2.2, colors = null, seed = 1,
}) {
  const path = useMemo(() => {
    const info = routeInfo(way)
    return segPath(segments ?? info.routes[0]?.segments.map((s) => s.seg) ?? way.segments)
  }, [way, segments])
  const state = useMemo(() => {
    const rng = mulberry32(seed * 7919 + way.idx * 131)
    return Array.from({ length: count }, () => ({
      s: rng() * path.total, dir: rng() > 0.5 ? 1 : -1, ph: rng() * TAU,
      a: angle + (rng() - 0.5) * spread * 2, v: speed * (0.7 + rng() * 0.6),
      excite: 0, flee: 0, color: colors ? colors[Math.floor(rng() * colors.length)] : null,
    }))
  }, [path, count, seed, angle, spread, speed, colors, way.idx])
  const items = useMemo(() => state.map((c) => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion(), scale, color: c.color })), [state, scale])
  const mesh = useInstanced(geo, mat, items, { dynamic: true })
  const tmp = useMemo(() => ({ loc: {}, pl: makePlacement(), sc: new THREE.Vector3(), q: new THREE.Quaternion(), flip: new THREE.Quaternion().setFromAxisAngle(Y, Math.PI) }), [])

  useFrame((st, dt) => {
    if (!path.total || !mesh.visible) return
    const h = Math.min(dt, 0.1)
    const t = st.clock.elapsedTime
    const bolls = getBallitas()
    for (let i = 0; i < state.length; i++) {
      const c = state[i]
      c.s += c.dir * c.v * h * (1 + c.excite * 1.5)
      if (c.s > path.total) { c.s = path.total; c.dir = -1 }
      if (c.s < 0) { c.s = 0; c.dir = 1 }
      // Reacción a ballitas cercanas en el mismo camino
      let near = 0; let fleeDir = 0
      for (let k = 0; k < bolls.length; k++) {
        const b = bolls[k]
        if (b.phase !== 'travel' || !b.seg) continue
        const arc = path.arcOf(b.seg, b.segT ?? 0)
        if (arc == null) continue
        const d = Math.abs(arc - c.s)
        if (d < reactRadius) {
          const k01 = 1 - d / reactRadius
          if (k01 > near) { near = k01; fleeDir = Math.sign(c.a - (b.roll ?? 0)) || 1 }
        }
      }
      c.excite = THREE.MathUtils.damp(c.excite, near, near > c.excite ? 9 : 2.5, h)
      c.flee = THREE.MathUtils.damp(c.flee, fleeDir * near * 0.35, 4, h)
      path.locate(c.s, tmp.loc)
      const bob = Math.abs(Math.sin(t * 6 * c.v + c.ph)) * scale * 0.4
      const jump = c.excite * hop * Math.abs(Math.sin(t * 9 + c.ph))
      const a = c.a + Math.sin(t * 0.7 + c.ph) * spread * 0.5 + c.flee
      placeAlongInto(tmp.loc.seg, tmp.loc.u, offset + bob + jump, a, tmp.pl)
      tmp.q.copy(tmp.pl.quat)
      if (c.dir < 0) tmp.q.multiply(tmp.flip)
      const squash = 1 + Math.sin(t * 12 * c.v + c.ph) * 0.06
      tmp.sc.set(scale / squash, scale * squash, scale / squash)
      _m.compose(tmp.pl.pos, tmp.q, tmp.sc)
      mesh.setMatrixAt(i, _m)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}

// ═══════════════════════════ ESCENARIO DE EVENTO ═══════════════════════════
/**
 * <EventStage segment render />  monta contenido solo alrededor de un tramo y lleva su estado:
 *   stage = { phase: 'idle'|'teaser'|'climax'|'salida', k (avance 0..1 de la ballita líder),
 *             intensity (suavizada 0..1), ballita (o null) }
 * teaser: una ballita está en un tramo previo cuyo `next` incluye este; climax: está dentro;
 * salida: acaba de pasar al siguiente. `render(stage, info)` se llama una vez y debe leer `stage`
 * dentro de sus propios useFrame (es un objeto mutable estable, sin re-render).
 */
export function EventStage({ segment, render, idle = 0.12 }) {
  const stage = useMemo(() => ({ phase: 'idle', k: 0, intensity: idle, ballita: null }), [idle])
  const info = useMemo(() => ({ segment, frames: segFrames(segment), placement: (u, off = 0, a = 0) => placeAlong(segment, u, off, a) }), [segment])
  useFrame((_, dt) => {
    const h = Math.min(dt, 0.1)
    let phase = 'idle'; let k = 0; let who = null; let rank = 0
    const bolls = getBallitas()
    for (let i = 0; i < bolls.length; i++) {
      const b = bolls[i]
      const s = b.seg
      if (b.phase !== 'travel' || !s || s.way !== segment.way) continue
      if (s === segment) { if (rank < 3) { rank = 3; phase = 'climax'; k = b.segT ?? 0; who = b } }
      else if (s.next?.includes(segment.i)) { if (rank < 2) { rank = 2; phase = 'teaser'; k = b.segT ?? 0; who = b } }
      else if (segment.next?.includes(s.i)) { if (rank < 1) { rank = 1; phase = 'salida'; k = b.segT ?? 0; who = b } }
    }
    const target = phase === 'climax' ? 1 : phase === 'teaser' ? 0.35 + k * 0.3 : phase === 'salida' ? 0.4 * (1 - k) : idle
    stage.intensity = THREE.MathUtils.damp(stage.intensity, target, 4, h)
    stage.phase = phase
    stage.k = k
    stage.ballita = who
  })
  const content = useMemo(() => render(stage, info), [render, stage, info])
  return <group>{content}</group>
}

// ═══════════════════════════ SIN AUDIO ═══════════════════════════
/** El juego no tiene audio: Soundless es un marcador explícito (no reproduce nada). */
export function Soundless() {
  return null
}
export function useSonido() {
  return { play: () => {}, stop: () => {} }
}

// ═══════════════════════════ TERRENO Y CIELO INTERIOR ═══════════════════════════
const smooth = (e0, e1, x) => {
  const t = THREE.MathUtils.clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * buildTerrainGeo(seg, opts) -> BufferGeometry: piso ondulado suave pegado a la pared interior que
 * rodea la pista (deja libre el cauce de cada carril con rampas suaves) y bajo el cielo interior.
 * opts:
 *   arc: semiancho angular cubierto alrededor del suelo (rad, por defecto 0.62π)
 *   height(u, a, rnd) -> 0..1 relieve relativo (por defecto dunas suaves); se escala a maxH
 *   maxH: altura máxima (por defecto R * 0.32, siempre ≤ R * FILL)
 *   colors: [bajo, alto] (por defecto colores del tema)
 *   radial, along: resolución (por defecto 48 y length * 3)
 */
export function buildTerrainGeo(seg, opts = {}) {
  const R = seg.radius
  const V = VISUALS[seg.way?.theme?.id] ?? {}
  const {
    arc = Math.PI * 0.62, maxH = R * 0.32, radial = 24, along = Math.ceil(seg.length * 1.4),
    height = (u, a) => 0.5 + 0.5 * Math.sin(u * seg.length * 0.9 + a * 3.1) * Math.cos(u * seg.length * 0.37 - a * 1.7),
    colors = [V.arch?.c ?? '#3a3f4a', V.glass ?? '#9fb4d8'],
  } = opts
  const hMax = Math.min(maxH, R * FILL)
  const nA = Math.min(radial, 28); const nU = THREE.MathUtils.clamp(along, 6, 160)
  const frames = segFrames(seg)
  const fr = makeFrame()
  const pos = new Float32Array((nA + 1) * (nU + 1) * 3)
  const col = new Float32Array((nA + 1) * (nU + 1) * 3)
  const cLo = new THREE.Color(colors[0]); const cHi = new THREE.Color(colors[1]); const cc = new THREE.Color()
  const dv = new THREE.Vector3()
  let p = 0
  for (let i = 0; i <= nU; i++) {
    const u = i / nU
    sampleFrameInto(frames, u, fr)
    for (let j = 0; j <= nA; j++) {
      const a = -arc + (j / nA) * arc * 2
      const edge = 1 - smooth(arc * 0.7, arc, Math.abs(a)) // se funde con la pared al borde
      const gap = laneGap(seg, a)
      const chan = smooth(0.02, 0.32, gap) // cauce libre con rampa suave
      const hk = THREE.MathUtils.clamp(height(u, a), 0, 1) * edge * chan
      const r = R * 0.985 - hk * hMax
      dv.copy(fr.up).multiplyScalar(-Math.cos(a)).addScaledVector(fr.right, Math.sin(a))
      pos[p] = fr.pos.x + dv.x * r; pos[p + 1] = fr.pos.y + dv.y * r; pos[p + 2] = fr.pos.z + dv.z * r
      cc.copy(cLo).lerp(cHi, hk)
      col[p] = cc.r; col[p + 1] = cc.g; col[p + 2] = cc.b
      p += 3
    }
  }
  const idx = []
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nA; j++) {
      const a = i * (nA + 1) + j; const b = a + nA + 1
      idx.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * buildSkyGeo(seg, opts) -> BufferGeometry: casquete pegado a la pared (radio R * 0.995) para pintar
 * el "cielo" del mini mundo con un material propio del tema (vertexColors: degradado suelo -> techo).
 */
export function buildSkyGeo(seg, { radial = 16, along = Math.ceil(seg.length * 0.7), colors = ['#20304a', '#6fa8ff'] } = {}) {
  const R = seg.radius * 0.995
  const nR = Math.min(radial, 18)
  const nU = THREE.MathUtils.clamp(along, 5, 110)
  const frames = segFrames(seg)
  const fr = makeFrame()
  const pos = new Float32Array((nR + 1) * (nU + 1) * 3)
  const col = new Float32Array((nR + 1) * (nU + 1) * 3)
  const c0 = new THREE.Color(colors[0]); const c1 = new THREE.Color(colors[1]); const cc = new THREE.Color()
  const dv = new THREE.Vector3()
  let p = 0
  for (let i = 0; i <= nU; i++) {
    sampleFrameInto(frames, i / nU, fr)
    for (let j = 0; j <= nR; j++) {
      const a = -Math.PI + (j / nR) * TAU
      dv.copy(fr.up).multiplyScalar(-Math.cos(a)).addScaledVector(fr.right, Math.sin(a))
      pos[p] = fr.pos.x + dv.x * R; pos[p + 1] = fr.pos.y + dv.y * R; pos[p + 2] = fr.pos.z + dv.z * R
      cc.copy(c0).lerp(c1, 0.5 - 0.5 * Math.cos(a))
      col[p] = cc.r; col[p + 1] = cc.g; col[p + 2] = cc.b
      p += 3
    }
  }
  const idx = []
  for (let i = 0; i < nU; i++) {
    for (let j = 0; j < nR; j++) {
      const a = i * (nR + 1) + j; const b = a + nR + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

// ═══════════════════════════ AISLAMIENTO DE ERRORES ═══════════════════════════
/** Si un módulo de tema falla, se desmonta solo ese módulo y el resto del mundo sigue. */
export class VidaGuard extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err) {
    console.warn(`[vida:${this.props.themeId}] módulo desactivado:`, err?.message ?? err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

// ═══════════════════════════ EJEMPLO COMÚN: CARTELES DE RUTA ═══════════════════════════
const POLE_GEO = markShared(new THREE.CylinderGeometry(0.025, 0.03, 1, 8).translate(0, 0.5, 0))
const poleMatCache = new Map()
function poleMat(hex) {
  let m = poleMatCache.get(hex)
  if (!m) { m = markShared(new THREE.MeshStandardMaterial({ color: hex, roughness: 0.5, metalness: 0.6 })); poleMatCache.set(hex, m) }
  return m
}

/**
 * <CartelesDeRuta way style angle u />  Un cartel miniatura por ruta, dentro del tubo, junto al carril
 * al inicio del primer tramo propio de la ruta: nombre del camino + "Ruta X · perfil".
 */
export function CartelesDeRuta({ way, style = {}, angle = 1.0, u = 0.14, height = 0.34, pole = 0.28, poleColor = '#3a3f4a' }) {
  const signs = useMemo(() => {
    const info = routeInfo(way)
    const flip = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)
    return info.routes.map((rt) => {
      const first = rt.segments.find((s) => s.route >= 0 && !s.air) ?? rt.segments.find((s) => !s.air)
      if (!first) return null
      const p = placeAlong(first.seg, u, 0, angle)
      const quat = p.quat.clone().multiply(flip) // de frente a la ballita que llega
      const top = p.pos.clone().addScaledVector(p.up, pole)
      return {
        key: rt.r, pos: p.pos, quat, top,
        text: way.theme.name,
        sub: `Ruta ${rt.name} · ${rt.profile?.label ?? rt.profile?.speed ?? ''}`.trim(),
      }
    }).filter(Boolean)
  }, [way, angle, u, pole])
  const pm = poleMat(poleColor)
  return (
    <group>
      {signs.map((s) => (
        <group key={s.key}>
          <mesh geometry={POLE_GEO} material={pm} position={s.pos} quaternion={s.quat} scale={[1, pole + height * 0.5, 1]} />
          <Billboard text={s.text} style={{ ...style, sub: s.sub }} height={height} position={s.top} quat={s.quat} />
        </group>
      ))}
    </group>
  )
}

// ═══════════════════════════ CIUDAD-HÁBITAT (túnel-banda + mini ciudad) ═══════════════════════════
// Marco sobre la pared con la MISMA convención que world.js (wallFrame/laneFrame), para que la ciudad,
// la banda exterior y los mecanismos queden alineados con los carriles reales de la simulación.
const _wf = {}
/** wallBaseInto(seg, u, out) -> out = { axis, d0 (eje->pared en ángulo 0), T, b (= T × d0) }. */
export function wallBaseInto(seg, u, out) {
  W.wallFrame(seg, 0, u, 0, _wf)
  out.axis.copy(_wf.axis)
  out.d0.copy(_wf.dir)
  out.T.copy(_wf.tangent)
  out.b.crossVectors(out.T, out.d0).normalize()
  return out
}
export function makeWallBase() {
  return { axis: new THREE.Vector3(), d0: new THREE.Vector3(), T: new THREE.Vector3(), b: new THREE.Vector3() }
}
/** Dirección eje->pared al ángulo `a` (igual que applyAxisAngle(T, a) de world.js). */
export function wallDirInto(base, a, out) {
  return out.copy(base.d0).multiplyScalar(Math.cos(a)).addScaledVector(base.b, Math.sin(a))
}
const _wd = new THREE.Vector3()
const _wx = new THREE.Vector3()
const _wu = new THREE.Vector3()
const _wm = new THREE.Matrix4()
/** Coloca sobre la pared: Y local hacia el eje, Z local = tangente. Escribe pos y quat. */
export function wallPlaceInto(base, a, rho, pos, quat) {
  wallDirInto(base, a, _wd)
  pos.copy(base.axis).addScaledVector(_wd, rho)
  _wu.copy(_wd).negate()
  _wx.crossVectors(_wu, base.T).normalize()
  _wm.makeBasis(_wx, _wu, base.T)
  quat.setFromRotationMatrix(_wm)
  return pos
}
const wrapPi = (x) => ((x + Math.PI) % TAU + TAU) % TAU - Math.PI
/** Distancia angular (rad) de `angle` al borde del carril más cercano en `u` (con el vaivén real). */
export function laneGapAt(seg, u, angle) {
  let best = Infinity
  for (const l of seg?.lanes ?? []) {
    const d = Math.abs(wrapPi(angle - W.laneAngle(seg, l.id, u))) - (l.width || BALL_R * 2.6) * 0.5 / Math.max(seg.radius, 1e-3)
    if (d < best) best = d
  }
  return best === Infinity ? Math.PI : best
}

/**
 * Estilo de la mini ciudad por tema (lo leen ciudad.jsx y tunel.jsx; un tema puede leerlo para no
 * duplicar edificios). facade: tonos de fachada; win: ventanas cálidas; neon: acentos; park: fracción de
 * parques; tree: copas; ground: [calle, parque, canal]; tall: escala de altura; kit: pieza especial;
 * brands: rótulos de neón propios del tema.
 */
export const CIUDAD = {
  sombrio: { facade: ['#3b3352', '#4a4166', '#2c2640'], win: '#c9a2ff', neon: '#a24bff', park: 0.12, tree: '#5b3f8a', ground: ['#1d1a28', '#33284a', '#2a1f44'], tall: 1.05, kit: 'aguja', brands: ['NOCTURNA', 'UMBRA', 'VELO'] },
  bosque: { facade: ['#e9e4d6', '#c9d8b8', '#f4efe2'], win: '#ffd59a', neon: '#9cff6b', park: 0.38, tree: '#3f9a4c', ground: ['#3a3f38', '#3f7a3c', '#2f6a48'], tall: 0.85, kit: 'arbol', brands: ['RAÍZ', 'SAVIA', 'CLARO'] },
  mar: { facade: ['#f2f6fa', '#d8e8f4', '#bcd6ea'], win: '#ffe1a8', neon: '#7fe0ff', park: 0.14, tree: '#3fae8c', ground: ['#3a4250', '#4a8a6a', '#2f86c8'], tall: 0.95, kit: 'canal', brands: ['PUERTO AZUL', 'MAREA', 'COSTA'] },
  desierto: { facade: ['#e8c99a', '#f2dcb4', '#d8b080'], win: '#ffd27a', neon: '#ffb347', park: 0.1, tree: '#7a9a4a', ground: ['#6a5a44', '#8a9a5a', '#c9a066'], tall: 0.8, kit: 'cupula', brands: ['OASIS', 'DUNA', 'SOLAR'] },
  hielo: { facade: ['#eaf6ff', '#cfe8fa', '#b8dcf4'], win: '#bff3ff', neon: '#bff3ff', park: 0.1, tree: '#a8d8e8', ground: ['#5a6a7a', '#c8e4f0', '#8ac8e8'], tall: 1.0, kit: 'cristal', brands: ['GLACIAR', 'BOREAL', 'ESCARCHA'] },
  volcan: { facade: ['#3a3434', '#4a3e3a', '#2e2a2a'], win: '#ffb070', neon: '#ff7a2f', park: 0.06, tree: '#6a4a3a', ground: ['#241e1e', '#4a3a30', '#ff5a1f'], tall: 0.9, kit: 'forja', brands: ['FORJA', 'MAGMA', 'BASALTO'] },
  cristal: { facade: ['#efeaff', '#d8ccff', '#c4b4ff'], win: '#e8dcff', neon: '#b8a1ff', park: 0.12, tree: '#9a8aff', ground: ['#3a3650', '#6a5aa8', '#8a7aff'], tall: 1.15, kit: 'prisma', brands: ['PRISMA', 'GEODA', 'CUARZO'] },
  nubes: { facade: ['#ffffff', '#f4f6fb', '#e8eef8'], win: '#fff2a8', neon: '#fff2a8', park: 0.22, tree: '#9ad8a0', ground: ['#c8d0dc', '#bfe8c4', '#dff0ff'], tall: 1.0, kit: 'nube', brands: ['CIRRO', 'ALTURA', 'BRISA'] },
  neon: { facade: ['#1c2038', '#262a48', '#141830'], win: '#2bffe8', neon: '#ff2bd6', park: 0.06, tree: '#2bffe8', ground: ['#0e1020', '#1a2a3a', '#ff2bd6'], tall: 1.25, kit: 'cyber', brands: ['KYBER', 'NÓVA', 'PULSO'] },
  jardin: { facade: ['#fff4f8', '#ffe4ee', '#f4ead8'], win: '#ffd8a8', neon: '#ff8fb8', park: 0.34, tree: '#e87aa8', ground: ['#4a4448', '#6aa86a', '#7ac8e8'], tall: 0.85, kit: 'jardin', brands: ['FLORA', 'PÉTALO', 'VERGEL'] },
}
export function cityStyle(themeId) {
  return CIUDAD[themeId] ?? CIUDAD.nubes
}

const waySphereCache = new WeakMap()

/** Esfera envolvente en mundo que cubre todos los tramos del way para frustum culling sin popping. */
export function getWayBoundingSphere(way, margin = 5) {
  if (!way) return null
  let sphere = waySphereCache.get(way)
  if (!sphere) {
    const box = new THREE.Box3()
    const segs = way.segments ?? []
    for (let i = 0; i < segs.length; i++) {
      const s = segs[i]
      if (s.start) box.expandByPoint(s.start)
      if (s.end) box.expandByPoint(s.end)
    }
    sphere = new THREE.Sphere()
    if (!box.isEmpty()) {
      box.getBoundingSphere(sphere)
      sphere.radius += margin
    } else {
      sphere.radius = 60
    }
    waySphereCache.set(way, sphere)
  }
  return sphere
}

/** Asigna una boundingSphere del way completo a un InstancedMesh dinámico para habilitar frustum culling. */
export function useWayBounds(ref, way) {
  useLayoutEffect(() => {
    const mesh = ref?.current
    if (!mesh || !way) return
    const sphere = getWayBoundingSphere(way)
    if (!sphere) return
    mesh.boundingSphere = sphere.clone()
    mesh.frustumCulled = true
  }, [ref, way])
}
