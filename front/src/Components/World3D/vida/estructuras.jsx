// Estructuras temáticas continuas a los lados de todo el camino:
// - Riberas continuas por tramo (ríos de lava, dunas, muros de hielo, setos, arrecifes, bancos de nubes).
// - Arcos / túneles temáticos sobre la calzada con amplio gálibo (>= 7 u) para las ballitas.
// - Hileras continuas de hitos/edificios/árboles/cristales/mausoleos usando GLB existentes (models/ y models/ciudad/),
//   construidos bajo demanda (máx. 1 tramo/cuadro) y agrupados en InstancedMesh de capacidad fija con culling por distancia.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_K } from '../../../Core/world.js'
import { colisionDe, mundoDe } from '../colisionObjetos.js'
import { MIDE, creceDe, publicaCrece, d2Delante, kBorde, kDelante } from '../InstanceCuller.jsx'
import { triplanarMaterial } from '../triplanar.js'
import { getWayBoundingSphere, getWayDetail, markShared, mergeColoredParts, minSegDistSq } from './base.jsx'
import { THEME_STRUCTS, placeSegArchesAndProps, placeSegPaso } from './colocacion.js'
import { precargarModelos, useModelo } from './modelos.js'
import { CURB, TERR, halfWidth, laneSideClear, lanesOf, surfFrame } from './pista.jsx'

const SEG_ACTIVE_DIST = 98 // distancia real a la curva del tramo para activarlo (solo 1-2 tramos activos)
const TALL_CULL_DIST = 96
const MED_CULL_DIST = 58
const ARCH_CULL_DIST = 104
const OVERVIEW_DIST_SQ = 36 * 36 // > 36 u del tramo más cercano = vista general Camino -> LOD reducido
// Capacidad suficiente para el radio cercano de varios tramos; los objetos más lejanos
// siguen filtrándose por distancia antes de escribirse en estos buffers.
const POOL_CAP = 384
const ARCH_CAP = 96
const MOVE_RECOMPACT_SQ = 20 // recompila instancias visibles solo al moverse >= 4.5 u

// ═══════════════════════════ ARCOS / TÚNELES TEMÁTICOS ═══════════════════════════
const archGeoCache = new Map()
const box = (w, h, d, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const g = new THREE.BoxGeometry(w, h, d)
  if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const cyl = (rt, rb, h, segs, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const g = new THREE.CylinderGeometry(rt, rb, h, segs)
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const cone = (r, h, segs, x = 0, y = 0, z = 0, rx = 0, rz = 0) => {
  const g = new THREE.ConeGeometry(r, h, segs)
  if (rx) g.rotateX(rx); if (rz) g.rotateZ(rz)
  return g.translate(x, y, z)
}
const sph = (r, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0) =>
  new THREE.SphereGeometry(r, 7, 5).scale(sx, sy, sz).translate(x, y, z)

let _deadTreeGeo = null
function getDeadTreeGeo() {
  if (_deadTreeGeo) return _deadTreeGeo
  const parts = [
    [cyl(0.06, 0.14, 0.56, 7, 0, 0.28, 0, 0.05, 0.04), '#3d2f4d'],
    [cyl(0.038, 0.068, 0.44, 6, 0.05, 0.62, 0.02, 0.12, -0.34), '#352845'],
    [cyl(0.026, 0.045, 0.36, 6, -0.14, 0.64, -0.02, -0.1, 0.52), '#352845'],
    [cyl(0.018, 0.034, 0.32, 5, 0.18, 0.78, 0.08, 0.32, -0.68), '#473659'],
    [cyl(0.016, 0.03, 0.3, 5, -0.22, 0.82, -0.06, -0.28, 0.62), '#473659'],
    [cyl(0.014, 0.026, 0.26, 5, 0.04, 0.88, -0.1, -0.45, -0.15), '#473659'],
    [sph(0.04, 1, 1.3, 1, -0.28, 0.78, -0.08), '#b784ff'],
    [sph(0.04, 1, 1.3, 1, 0.26, 0.72, 0.1), '#9b6bff'],
  ]
  _deadTreeGeo = mergeColoredParts(parts, 'struct:dead_tree')
  return _deadTreeGeo
}

function getArchGeo(kind) {
  if (archGeoCache.has(kind)) return archGeoCache.get(kind)
  const parts = []
  switch (kind) {
    case 'bosque':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.065, 0.1, 0.76, 7, s * 0.48, 0.38, 0, 0, s * 0.14), '#5c3c24'])
        parts.push([cyl(0.042, 0.065, 0.44, 6, s * 0.3, 0.76, 0, 0, s * 0.85), '#5c3c24'])
        parts.push([sph(0.26, 1.4, 0.78, 1.5, s * 0.35, 0.88, 0), '#2e7d32'])
        parts.push([cyl(0.016, 0.02, 0.24, 5, s * 0.42, 0.78, 0.12), '#52b84a'])
      }
      parts.push([sph(0.34, 1.85, 0.58, 1.65, 0, 0.96, 0), '#3b943f'])
      parts.push([sph(0.24, 1.3, 0.55, 1.3, 0.12, 0.9, 0.1), '#58b34e'])
      parts.push([sph(0.22, 1.2, 0.52, 1.3, -0.14, 0.91, -0.1), '#4ea644'])
      break
    case 'mar':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.065, 0.1, 0.76, 7, s * 0.48, 0.38, 0, 0, s * 0.16), '#ff7aa8'])
        parts.push([cyl(0.04, 0.06, 0.36, 6, s * 0.43, 0.56, 0.06, 0.25, -s * 0.4), '#4dd0e1'])
        parts.push([sph(0.075, 1.2, 1.1, 1.2, s * 0.4, 0.78, 0), '#ffd166'])
      }
      parts.push([new THREE.TorusGeometry(0.43, 0.058, 6, 14, Math.PI).scale(1, 0.64, 1).translate(0, 0.74, 0), '#ff9671'])
      parts.push([cone(0.055, 0.24, 5, -0.16, 0.98, 0, 0, 0.22), '#ffc75f'])
      parts.push([cone(0.055, 0.24, 5, 0.16, 0.98, 0, 0, -0.22), '#4dd0e1'])
      parts.push([cone(0.045, 0.2, 5, 0, 1.0, 0.06), '#ff6f91'])
      break
    case 'desierto':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.09, 0.14, 0.74, 6, s * 0.48, 0.37, 0, 0, s * 0.14), '#b86f3a'])
        parts.push([box(0.22, 0.24, 0.28, s * 0.51, 0.12, 0, 0, s * 0.2, 0), '#9a582b'])
        parts.push([box(0.16, 0.2, 0.24, s * 0.41, 0.68, 0, 0, 0, -s * 0.35), '#c98249'])
      }
      parts.push([new THREE.TorusGeometry(0.44, 0.085, 5, 12, Math.PI).scale(1, 0.62, 1.15).translate(0, 0.7, 0), '#c98249'])
      parts.push([box(0.74, 0.12, 0.26, 0, 0.95, 0), '#dfa266'])
      break
    case 'hielo':
      for (const s of [-1, 1]) {
        parts.push([cone(0.12, 0.86, 6, s * 0.48, 0.43, 0, 0, s * 0.15), '#9edcff'])
        parts.push([cone(0.075, 0.56, 5, s * 0.54, 0.28, 0.08, 0.1, -s * 0.2), '#cfefff'])
      }
      parts.push([box(0.96, 0.14, 0.22, 0, 0.88, 0), '#bfe9ff'])
      for (let i = -3; i <= 3; i++) {
        parts.push([cone(0.036, 0.16 + (Math.abs(i) % 2) * 0.07, 5, i * 0.12, 0.74, 0, Math.PI, 0), '#e8f9ff'])
      }
      break
    case 'volcan':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.08, 0.13, 0.78, 6, s * 0.48, 0.39, 0, 0, s * 0.12), '#3c2b28'])
        parts.push([box(0.032, 0.52, 0.15, s * 0.44, 0.38, 0, 0, 0, s * 0.12), '#ff5a1f'])
      }
      parts.push([box(0.96, 0.17, 0.24, 0, 0.86, 0), '#45312d'])
      parts.push([box(0.86, 0.06, 0.26, 0, 0.86, 0), '#ff6d29'])
      break
    case 'cristal':
      for (const s of [-1, 1]) {
        parts.push([cone(0.085, 0.86, 6, s * 0.48, 0.43, 0, 0, s * 0.18), '#7df9ff'])
        parts.push([cone(0.065, 0.6, 6, s * 0.53, 0.3, 0.05, 0, -s * 0.18), '#ff7de9'])
      }
      parts.push([cyl(0.065, 0.065, 0.94, 6, 0, 0.86, 0, 0, Math.PI / 2), '#b894ff'])
      parts.push([new THREE.OctahedronGeometry(0.12, 0).translate(0, 0.95, 0), '#e6dcff'])
      break
    case 'nubes':
      for (const s of [-1, 1]) {
        parts.push([sph(0.14, 1.1, 1.3, 1.1, s * 0.5, 0.24, 0), '#ffffff'])
        parts.push([sph(0.12, 1.0, 1.4, 1.0, s * 0.45, 0.54, 0), '#eef4ff'])
        parts.push([cyl(0.03, 0.04, 0.5, 6, s * 0.46, 0.52, 0), '#ffd54a'])
      }
      parts.push([box(0.96, 0.08, 0.28, 0, 0.86, 0), '#fff6d6'])
      parts.push([new THREE.TorusGeometry(0.45, 0.045, 5, 16, Math.PI).scale(1, 0.62, 1).translate(0, 0.72, 0), '#ffd54a'])
      parts.push([sph(0.15, 1.7, 0.75, 1.1, 0, 0.96, 0), '#ffffff'])
      break
    case 'neon':
      for (const s of [-1, 1]) {
        parts.push([box(0.08, 0.84, 0.14, s * 0.48, 0.42, 0), '#1a2038'])
        parts.push([box(0.03, 0.76, 0.16, s * 0.43, 0.42, 0), s < 0 ? '#ff2bd6' : '#2bffe8'])
      }
      parts.push([box(1.04, 0.14, 0.2, 0, 0.88, 0), '#161b30'])
      parts.push([box(0.9, 0.05, 0.22, 0, 0.88, 0), '#2bffe8'])
      parts.push([box(0.54, 0.14, 0.24, 0, 0.99, 0), '#1b223d'])
      parts.push([box(0.48, 0.08, 0.26, 0, 0.99, 0), '#ff2bd6'])
      break
    case 'jardin':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.045, 0.055, 0.84, 7, s * 0.48, 0.42, 0), '#f5eadc'])
        parts.push([sph(0.11, 1.1, 1.0, 1.1, s * 0.48, 0.18, 0), '#3d9944'])
      }
      parts.push([box(1.04, 0.08, 0.28, 0, 0.86, 0), '#f5eadc'])
      parts.push([box(0.98, 0.07, 0.2, 0, 0.93, 0), '#4eb355'])
      for (const fx of [-0.3, -0.1, 0.1, 0.3]) parts.push([sph(0.065, 1.2, 0.8, 1.2, fx, 0.98, 0), fx < 0 ? '#ff7ab8' : '#ffd24a'])
      break
    default:
      for (const s of [-1, 1]) {
        parts.push([cyl(0.05, 0.08, 0.84, 6, s * 0.48, 0.42, 0, 0, s * 0.1), '#352a4a'])
        parts.push([sph(0.058, 1, 1.2, 1, s * 0.41, 0.65, 0), '#b784ff'])
      }
      parts.push([new THREE.TorusGeometry(0.44, 0.045, 5, 14, Math.PI).scale(1, 0.58, 1).translate(0, 0.72, 0), '#473863'])
      parts.push([cone(0.05, 0.2, 5, 0, 0.98, 0), '#a24bff'])
      break
  }
  const g = mergeColoredParts(parts, `struct:arch:${kind}`)
  archGeoCache.set(kind, g)
  return g
}

// ═══════════════════════════ MATERIALES DE RIBERAS Y ESTRUCTURAS ═══════════════════════════
const LAVA_TIME = { value: 0 }
const ribbonMatCache = new Map()
function ribbonMat(themeId, spec) {
  if (!spec) return null
  const key = `${themeId}:${spec.mode}`
  if (ribbonMatCache.has(key)) return ribbonMatCache.get(key)
  if (spec.mode === 'lava') {
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uLavaTime = LAVA_TIME
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vLavaUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLavaUv = uv;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uLavaTime;\nvarying vec2 vLavaUv;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          float flow = sin(vLavaUv.y * 2.4 - uLavaTime * 2.6 + sin(vLavaUv.x * 6.283) * 1.4) * 0.5 + 0.5;
          float crust = smoothstep(0.28, 0.85, flow);
          float vein = pow(sin(vLavaUv.x * 9.42 + uLavaTime * 1.2 + vLavaUv.y * 1.6) * 0.5 + 0.5, 3.0);
          vec3 darkCrust = vec3(0.14, 0.06, 0.05);
          vec3 magma = mix(vec3(0.85, 0.16, 0.02), vec3(1.25, 0.48, 0.07), clamp(crust * 0.65 + vein * 0.45, 0.0, 1.0));
          float bank = smoothstep(0.06, 0.30, vLavaUv.x) * smoothstep(0.94, 0.70, vLavaUv.x);
          diffuseColor.rgb = mix(darkCrust, magma, bank * (0.35 + 0.65 * crust));`)
    }
    m.customProgramCacheKey = () => 'struct-lava-v1'
    markShared(m)
    ribbonMatCache.set(key, m)
    return m
  }
  const m = triplanarMaterial(themeId, 'terreno', { glow: spec.glow ?? 0, standard: false, texStrength: 0.45, rim: 0.14 })
  ribbonMatCache.set(key, m)
  return m
}

function archMat(themeId) {
  return triplanarMaterial(themeId, 'fachada', { glow: 0.08, texStrength: 0.22 })
}

export function estructurasWarmup() {
  return [
    archMat('bosque'),
    ribbonMat('volcan', THEME_STRUCTS.volcan.ribbon),
    triplanarMaterial('bosque', 'terreno', { standard: false }),
    triplanarMaterial('neon', 'fachada', { standard: false }),
    triplanarMaterial('nubes', 'techo', { standard: false }),
  ]
}

// ═══════════════════════════ HELPERS POR TRAMO ═══════════════════════════
function outerClear(col, wayIdx, seg, lane, u, pos, rad, local) {
  if (!laneSideClear(seg, lane, u, pos, Math.max(0.85, rad * 0.65))) return false
  if (col && !col.libre(pos, rad, { way: wayIdx })) return false
  if (local && !local.libre(pos, rad)) return false
  return true
}

const F_RIB = {}
const RIB_N = 9
const _c3 = new THREE.Color()
const _ribCheck = new THREE.Vector3()
// Generador (planificación, no aspecto): cede cada pocas muestras para repartir un tramo entre cuadros; solo se
// interrumpe al empezar una muestra, sin marcos ni temporales compartidos a medias.
function* buildSegRibbonGeo(way, seg, si, world, spec) {
  if (!spec) return null
  const col = world ? colisionDe(world) : null
  const c1 = new THREE.Color(spec.c1)
  const c2 = new THREE.Color(spec.c2)
  const cc = new THREE.Color()
  const pos = []
  const nrm = []
  const colArr = []
  const uv = []
  const idx = []

  const L = Math.max(seg.length ?? 1, 1)
  const lanes = lanesOf(seg)
  const stepDist = 1.3 * TRACK_K // ~6 u: sigue curvas y deja ver el relieve
  const n = Math.max(6, Math.ceil(L / stepDist))
  const isLava = spec.mode === 'lava'
  const isIce = spec.mode === 'ice'
  const isDune = spec.mode === 'dune'
  const isCanyon = spec.mode === 'canyon'
  const isCyber = spec.mode === 'cyber'
  const W = spec.w
  const H = spec.h

  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li]
    const hw = halfWidth(lane)
    const E = hw + CURB
    const edge0 = E + TERR * 0.85
    for (const sideSign of [-1, 1]) {
      let stripCount = 0
      for (let i = 0; i <= n; i++) {
        if (i % 8 === 7) yield
        const u = i / n
        const f = surfFrame(seg, lane.id, u, F_RIB)
        const midLat = edge0 + W * 0.45
        _ribCheck.copy(f.pos).addScaledVector(f.side, sideSign * midLat)
        if (!laneSideClear(seg, lane, u, _ribCheck, TERR * 0.55) || (col && !col.libre(_ribCheck, 0.85, { way: way.idx }))) {
          stripCount = 0
          continue
        }

        const s = u * L
        const wave = Math.sin(s * 0.14 + si * 2.1 + lane.id * 1.7 + sideSign)
        const wave2 = Math.cos(s * 0.31 + si * 0.9)
        let hCrest = H * (0.78 + 0.38 * wave + 0.2 * wave2)
        if (isIce || isCanyon) hCrest = H * (0.62 + 0.72 * Math.abs(wave))
        else if (isDune) hCrest = H * (0.8 + 0.45 * wave)

        let pts
        if (isLava) pts = [[edge0, -0.08, 0, 0], [edge0 + W * 0.16, -0.34, 0.35, 0.18], [edge0 + W * 0.72, -0.34, 0.65, 0.82], [edge0 + W, 0.28 * H, 1, 1]]
        else if (isCyber) pts = [[edge0, -0.08, 0, 0], [edge0 + W * 0.14, 0.22, 0.75, 0.2], [edge0 + W * 0.86, 0.26, 1, 0.85], [edge0 + W, -0.45, 0.2, 1]]
        else {
          // Relieve real: 9 puntos con ondulación de varias frecuencias (lomas, hondonadas y crestas
          // irregulares) y color por altura con manchas, para que la ribera no sea un manto liso.
          pts = []
          for (let j = 0; j < RIB_N; j++) {
            const t = j / (RIB_N - 1)
            const bump = Math.sin(Math.PI * Math.min(1, t * 1.12)) ** 0.8
            const nz = 0.5 * Math.sin(s * 0.41 + t * 7.3 + si) + 0.3 * Math.sin(s * 0.93 - t * 11.1 + lane.id) + 0.2 * Math.sin(s * 1.9 + t * 17.0)
            const py = j === 0 ? -0.08 : j === RIB_N - 1 ? -0.7 : hCrest * bump * (0.78 + 0.32 * nz)
            pts.push([edge0 + W * t, py, Math.max(0, Math.min(1, 0.15 + (py / Math.max(0.4, H)) * 0.75 + nz * 0.18)), t])
          }
        }
        const NP = pts.length

        const vBase = pos.length / 3
        for (let j = 0; j < NP; j++) {
          const [lat, py, tCol, ux] = pts[j]
          const lx = sideSign * lat
          pos.push(
            f.pos.x + f.side.x * lx + f.up.x * py,
            f.pos.y + f.side.y * lx + f.up.y * py,
            f.pos.z + f.side.z * lx + f.up.z * py,
          )
          nrm.push(f.up.x, f.up.y, f.up.z)
          cc.copy(c1).lerp(c2, tCol)
          if (spec.c3 && NP > 4) {
            const patch = 0.5 + 0.5 * Math.sin(s * 0.27 + ux * 9.0 + si * 1.3) * Math.cos(s * 0.19 - ux * 5.0)
            cc.lerp(_c3.set(spec.c3), Math.max(0, patch - 0.45) * 1.2)
          }
          if (NP > 4) cc.multiplyScalar(0.8 + 0.35 * tCol)
          colArr.push(cc.r, cc.g, cc.b)
          uv.push(ux, s * 0.18)
        }
        if (stripCount > 0) {
          const p0 = vBase - NP
          for (let j = 0; j < NP - 1; j++) {
            const a = p0 + j
            const b = vBase + j
            if (sideSign > 0) idx.push(a, a + 1, b, b, a + 1, b + 1)
            else idx.push(a, b, a + 1, b, b + 1, a + 1)
          }
        }
        stripCount++
      }
    }
  }

  if (!idx.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colArr, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  g.name = `estructuras:rib:${way.idx}:${si}`
  return markShared(g)
}

const segDataCache = new WeakMap()

const SEG_PASO_MS = 3 // presupuesto por cuadro del propio componente para un tramo cercano aún sin datos
const segGens = new WeakMap() // seg -> generador a medias (la precarga y el propio componente lo comparten)
const NUNCA = () => false
const SIEMPRE = () => true
/** Avanza los datos del tramo hasta que `agotado()` diga basta; true cuando quedaron en caché. */
function segStructPaso(way, seg, si, agotado) {
  if (segDataCache.has(seg)) return true
  let g = segGens.get(seg)
  if (!g) { g = segStructGen(way, seg, si); segGens.set(seg, g) }
  for (;;) {
    const r = g.next()
    if (r.done) { segGens.delete(seg); segDataCache.set(seg, r.value); return true }
    if (agotado()) return false
  }
}
function getSegStructData(way, seg, si) {
  segStructPaso(way, seg, si, NUNCA)
  return segDataCache.get(seg)
}

// Mismo cálculo que de un tirón (mismo rng y orden); los `yield` van al final de cada muestra.
function* segStructGen(way, seg, si) {
  const themeId = way.theme?.id
  const spec = THEME_STRUCTS[themeId] ?? THEME_STRUCTS.bosque
  const world = mundoDe(way)
  const ribbonGeo = yield* buildSegRibbonGeo(way, seg, si, world, spec.ribbon)
  // colocación por porciones (una muestra por paso): cede igual que la cinta
  while (!placeSegPaso(way, seg, si, SIEMPRE)) yield
  const { arches, byModel } = placeSegArchesAndProps(way, seg, si)
  return { ribbonGeo, arches, byModel }
}

/** Precarga (vida/precarga.js): construye por delante los tramos de `way` (un tramo por paso) hasta que
 *  `agotado()` diga basta; true cuando están todos. Mismos datos que al acercarse: solo cambia cuándo. */
export function estructurasPaso(way, agotado) {
  const segs = way.segments ?? []
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si]
    if (seg.air || segDataCache.has(seg)) continue
    if (!segStructPaso(way, seg, si, agotado)) return false
    if (agotado()) return false
  }
  return true
}
/** Modelos GLB que usarán las estructuras de `way` (para pedirlos antes de entrar). */
export function estructurasModelos(way) {
  const spec = THEME_STRUCTS[way.theme?.id] ?? THEME_STRUCTS.bosque
  return spec.props.filter((p) => !p.model.startsWith('proc:')).map((p) => p.model)
}

// ═══════════════════════════ POOL DE INSTANCIAS FIJAS POR MODELO ═══════════════════════════
function FixedPoolInst({ model, themeId, cat, tall, waySphere, regPool }) {
  const isProcDead = model === 'proc:dead_tree'
  const glbGeo = useModelo(isProcDead ? null : model, null)
  const geo = isProcDead ? getDeadTreeGeo() : glbGeo
  const mat = useMemo(() => triplanarMaterial(themeId, cat, { standard: false }), [themeId, cat])

  const mesh = useMemo(() => {
    if (!geo) return null
    const m = new THREE.InstancedMesh(geo, mat, POOL_CAP)
    m.count = 0
    m.userData.noCull = true
    m.boundingSphere = waySphere
    m.frustumCulled = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const white = new THREE.Color('#ffffff')
    for (let i = 0; i < POOL_CAP; i++) m.setColorAt(i, white)
    return m
  }, [geo, mat, waySphere])

  useEffect(() => {
    if (!mesh) return undefined
    regPool(model, mesh, tall ? TALL_CULL_DIST : MED_CULL_DIST, tall)
    return () => {
      regPool(model, null)
      mesh.dispose()
    }
  }, [mesh, model, tall, regPool])

  if (!mesh) return null
  return <primitive object={mesh} />
}

export default function Estructuras({ way, detail, focused, time }) {
  const themeId = way.theme?.id
  const spec = THEME_STRUCTS[themeId] ?? THEME_STRUCTS.bosque
  const models = useMemo(() => spec.props.filter((p) => !p.model.startsWith('proc:')).map((p) => p.model), [spec])
  useEffect(() => { precargarModelos(models) }, [models])

  const nonAirSegs = useMemo(
    () => (way.segments ?? []).map((seg, si) => ({ seg, si })).filter((x) => !x.seg.air),
    [way],
  )
  const waySphere = useMemo(() => getWayBoundingSphere(way, 18 * TRACK_K), [way])
  const archGeo = useMemo(() => (spec.arch ? getArchGeo(spec.arch.kind) : null), [spec.arch])
  const ribMat = useMemo(() => ribbonMat(themeId, spec.ribbon), [themeId, spec.ribbon])
  const aMat = useMemo(() => archMat(themeId), [themeId])

  const archMesh = useMemo(() => {
    if (!archGeo) return null
    const m = new THREE.InstancedMesh(archGeo, aMat, ARCH_CAP)
    m.count = 0
    m.userData.noCull = true
    m.boundingSphere = waySphere
    m.frustumCulled = true
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    return m
  }, [archGeo, aMat, waySphere])

  useEffect(() => () => { archMesh?.dispose() }, [archMesh])

  const [ribList, setRibList] = useState([]) // [{ si, geo }] solo de los 1-3 tramos cercanos
  const ribKeyRef = useRef('')
  const nearSegsRef = useRef([]) // [{ seg, si }]
  const poolsRef = useRef(new Map()) // model -> { mesh, rangeSq }
  const lastCamRef = useRef(new THREE.Vector3(Infinity, 0, 0))
  const lastFwdRef = useRef(new THREE.Vector3(0, 0, 1))
  const camFwdTmp = useMemo(() => new THREE.Vector3(), [])
  const deltaTmp = useMemo(() => new THREE.Vector3(), [])
  const aheadTmp = useMemo(() => new THREE.Vector3(), [])
  const lastSegFwdRef = useRef(new THREE.Vector3(0, 0, 1))
  const lastKRef = useRef(1)
  const lejos = useMemo(() => [], [])
  const lastSegCheckRef = useRef(new THREE.Vector3(Infinity, 0, 0))
  const dirtyPoolRef = useRef(true)
  const groupRef = useRef()
  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const tmpS = useMemo(() => new THREE.Vector3(), [])
  const white = useMemo(() => new THREE.Color('#ffffff'), [])

  const minDistSqRef = useRef(Infinity)
  const regPool = useMemo(() => (model, mesh, range = MED_CULL_DIST, tall = false) => {
    if (!mesh) { poolsRef.current.delete(model); return }
    poolsRef.current.set(model, { mesh, rangeSq: range * range, tall })
    dirtyPoolRef.current = true
  }, [])

  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (time) LAVA_TIME.value = time.value
    const det = detail ? detail.value : 1
    const show = det >= (focused ? 0.2 : 0.45)
    if (groupRef.current) groupRef.current.visible = show
    if (!show) return

    const cam = camera.position
    // Alcance delantero (Seguir/POV): el recorte es una elipse K veces más larga en el rumbo de la cámara
    const K = kDelante()
    camera.getWorldDirection(camFwdTmp)
    // 1) Detectar tramos cercanos (curva <= SEG_ACTIVE_DIST + seg.length * 0.2); con K > 1, también los que están
    //    delante (alrededor de un punto adelantado en el rumbo), para que sus piezas existan antes de llegar.
    let segChanged = false
    if (cam.distanceToSquared(lastSegCheckRef.current) >= 100 || K !== lastKRef.current || (K > 1 && camFwdTmp.dot(lastSegFwdRef.current) < 0.9)) {
      lastSegCheckRef.current.copy(cam)
      lastSegFwdRef.current.copy(camFwdTmp)
      lastKRef.current = K
      const near = []
      let bestD2 = Infinity
      if (K > 1) aheadTmp.copy(cam).addScaledVector(camFwdTmp, (K - 1) * SEG_ACTIVE_DIST * 0.75)
      for (let i = 0; i < nonAirSegs.length; i++) {
        const x = nonAirSegs[i]
        const d2 = minSegDistSq(x.seg, cam)
        if (d2 < bestD2) bestD2 = d2
        const lim = SEG_ACTIVE_DIST + Math.min(130, x.seg.length * 0.2)
        if (d2 <= lim * lim || (K > 1 && minSegDistSq(x.seg, aheadTmp) <= lim * lim)) near.push(x)
      }
      minDistSqRef.current = bestD2
      nearSegsRef.current = near
      dirtyPoolRef.current = true
      segChanged = true
    }

    // 2) Avanzar como máximo 1 tramo cercano aún no cacheado en este frame, con presupuesto (un tramo entero
    //    costaba 150-450 ms de golpe); la precarga (vida/precarga.js) suele tenerlos ya hechos.
    let builtOne = false
    let tocado = false
    for (let i = 0; i < nearSegsRef.current.length; i++) {
      const { seg, si } = nearSegsRef.current[i]
      if (!segDataCache.has(seg)) {
        if (tocado) continue
        tocado = true
        const t0 = performance.now()
        builtOne = segStructPaso(way, seg, si, () => performance.now() - t0 > SEG_PASO_MS)
      }
    }
    if (builtOne) dirtyPoolRef.current = true
    if (segChanged || builtOne) {
      const nextRibs = []
      for (let i = 0; i < nearSegsRef.current.length; i++) {
        const { seg, si } = nearSegsRef.current[i]
        const sd = segDataCache.get(seg)
        if (sd?.ribbonGeo) nextRibs.push({ si, geo: sd.ribbonGeo })
      }
      const ribKey = nextRibs.map((r) => r.si).join(',')
      if (ribKey !== ribKeyRef.current) {
        ribKeyRef.current = ribKey
        setRibList(nextRibs)
      }
    }

    // 3) Compactar instancias cercanas solo cuando la cámara se mueve >= 4.5 u, gira > 14°, o llegó un tramo nuevo
    if (!dirtyPoolRef.current && cam.distanceToSquared(lastCamRef.current) < MOVE_RECOMPACT_SQ && camFwdTmp.dot(lastFwdRef.current) > 0.97) return
    lastCamRef.current.copy(cam)
    lastFwdRef.current.copy(camFwdTmp)
    dirtyPoolRef.current = false

    const overview = minDistSqRef.current > OVERVIEW_DIST_SQ
    const nearData = []
    for (let i = 0; i < nearSegsRef.current.length; i++) {
      const sd = segDataCache.get(nearSegsRef.current[i].seg)
      if (sd) nearData.push(sd)
    }

    if (archMesh) {
      let ac = 0
      const rSq = (overview ? 105 : ARCH_CULL_DIST) ** 2
      const rA = overview ? 105 : ARCH_CULL_DIST // los arcos crecen desde ese borde (kBorde)
      const Ka = K // también en vista general: el camino siguiente se ve al fondo de la recta
      const cmA = [Infinity, Infinity]
      lejos.length = 0
      for (let s = 0; s < nearData.length && ac < ARCH_CAP; s++) {
        const list = nearData[s].arches
        for (let i = 0; i < list.length && ac < ARCH_CAP; i += (overview ? 2 : 1)) {
          const it = list[i]
          deltaTmp.copy(it.pos).sub(cam)
          const d2r = deltaTmp.lengthSq()
          if (!overview && d2r > 400 && deltaTmp.dot(camFwdTmp) < -16) continue
          const d2 = Ka > 1 ? d2Delante(deltaTmp.x, deltaTmp.y, deltaTmp.z, camFwdTmp, Ka) : d2r
          if (d2 > rSq) continue
          // lo que solo entra por el alcance delantero va al final: si se llena el tope, queda fuera lo lejano
          if (d2r > rSq) { lejos.push(it, d2, deltaTmp.x, deltaTmp.y, deltaTmp.z); continue }
          const kb = kBorde(d2, rA)
          tmpS.set(it.scale[0] * kb, it.scale[1] * kb, it.scale[2] * kb)
          archMesh.setMatrixAt(ac++, tmpM.compose(it.pos, it.quat, tmpS))
          if (MIDE) creceDe(deltaTmp.x, deltaTmp.y, deltaTmp.z, camFwdTmp, kb, cmA)
        }
      }
      for (let j = 0; j < lejos.length && ac < ARCH_CAP; j += 5) {
        const it = lejos[j]; const kb = kBorde(lejos[j + 1], rA)
        tmpS.set(it.scale[0] * kb, it.scale[1] * kb, it.scale[2] * kb)
        archMesh.setMatrixAt(ac++, tmpM.compose(it.pos, it.quat, tmpS))
        if (MIDE) creceDe(lejos[j + 2], lejos[j + 3], lejos[j + 4], camFwdTmp, kb, cmA)
      }
      if (MIDE) publicaCrece(archMesh, cmA)
      archMesh.count = ac
      if (ac > 0) archMesh.instanceMatrix.needsUpdate = true
    }

    let tallSlot = 0
    for (const [model, entry] of poolsRef.current) {
      const { mesh, rangeSq, tall } = entry
      if (overview && (!tall || tallSlot++ >= 2)) {
        mesh.count = 0
        continue
      }
      const stride = overview ? 2 : 1
      const effRangeSq = overview ? 96 * 96 : rangeSq
      const rP = Math.sqrt(effRangeSq) // la pieza mide 0 en el borde y crece al acercarse (kBorde)
      const Kp = K
      let count = 0
      lejos.length = 0
      const cm = [Infinity, Infinity]
      const pon = (it, d2, dx, dy, dz) => {
        const kb = kBorde(d2, rP)
        tmpS.setScalar(it.scale * kb)
        mesh.setMatrixAt(count, tmpM.compose(it.pos, it.quat, tmpS))
        // Cada slot se reutiliza al recomponer la lista. Restablecer también los items
        // sin tinte evita heredar un color antiguo (incluido negro) de otra instancia.
        mesh.setColorAt(count, it.color ?? white)
        count++
        if (MIDE) creceDe(dx, dy, dz, camFwdTmp, kb, cm)
      }
      for (let s = 0; s < nearData.length && count < POOL_CAP; s++) {
        const list = nearData[s].byModel.get(model)
        if (!list) continue
        for (let i = 0; i < list.length && count < POOL_CAP; i += stride) {
          const it = list[i]
          deltaTmp.copy(it.pos).sub(cam)
          const d2r = deltaTmp.lengthSq()
          if (!overview && d2r > 400 && deltaTmp.dot(camFwdTmp) < -16) continue
          const d2 = Kp > 1 ? d2Delante(deltaTmp.x, deltaTmp.y, deltaTmp.z, camFwdTmp, Kp) : d2r
          if (d2 > effRangeSq) continue
          // solo por el alcance delantero: al final (si se llena el tope, queda fuera lo lejano)
          if (d2r > effRangeSq) { lejos.push(it, d2, deltaTmp.x, deltaTmp.y, deltaTmp.z); continue }
          pon(it, d2, deltaTmp.x, deltaTmp.y, deltaTmp.z)
        }
      }
      for (let j = 0; j < lejos.length && count < POOL_CAP; j += 5) pon(lejos[j], lejos[j + 1], lejos[j + 2], lejos[j + 3], lejos[j + 4])
      if (MIDE) publicaCrece(mesh, cm)
      mesh.count = count
      if (count > 0) {
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    }
  })

  return (
    <group ref={groupRef}>
      {ribMat && ribList.map((r) => <mesh key={r.si} geometry={r.geo} material={ribMat} receiveShadow />)}
      {archMesh && <primitive object={archMesh} />}
      {spec.props.map((pSpec) => (
        <FixedPoolInst
          key={pSpec.model}
          model={pSpec.model}
          themeId={themeId}
          cat={pSpec.cat}
          tall={!!pSpec.tall}
          waySphere={waySphere}
          regPool={regPool}
        />
      ))}
    </group>
  )
}
