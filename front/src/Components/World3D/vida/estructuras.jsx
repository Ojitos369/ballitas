// Estructuras temáticas continuas a los lados de todo el camino:
// - Riberas continuas por tramo (ríos de lava, dunas, muros de hielo, setos, arrecifes, bancos de nubes).
// - Arcos / túneles temáticos sobre la calzada con amplio gálibo (>= 7 u) para las ballitas.
// - Hileras continuas de hitos/edificios/árboles/cristales/mausoleos usando GLB existentes (models/ y models/ciudad/),
//   construidos bajo demanda (máx. 1 tramo/cuadro) y agrupados en InstancedMesh de capacidad fija con culling por distancia.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { TRACK_K } from '../../../Core/world.js'
import { colisionDe, colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { triplanarMaterial } from '../triplanar.js'
import { getWayBoundingSphere, getWayDetail, markShared, mergeColoredParts, minSegDistSq, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { precargarModelos, useModelo } from './modelos.js'
import { CURB, TERR, halfWidth, laneSideClear, lanesOf, surfFrame } from './pista.jsx'

const Y_AXIS = new THREE.Vector3(0, 1, 0)
const X_AXIS = new THREE.Vector3(1, 0, 0)
const TAU = Math.PI * 2
const Q_YAW = new THREE.Quaternion()
const Q_ROTX = new THREE.Quaternion()

const SEG_ACTIVE_DIST = 165 // distancia real a la curva del tramo para activarlo (solo 1-3 tramos activos)
const TALL_CULL_DIST = 148
const MED_CULL_DIST = 98
const ARCH_CULL_DIST = 148
const POOL_CAP = 96
const ARCH_CAP = 36
const MOVE_RECOMPACT_SQ = 16 // recompila instancias visibles solo al moverse >= 4 u

// ═══════════════════════════ CATÁLOGO POR TEMA (4 piezas clave + arco + ribera) ═══════════════════════════
const THEME_STRUCTS = {
  bosque: {
    ribbon: null,
    arch: { kind: 'bosque', step: 54, sx: 1.06, sy: 7.5 },
    props: [
      { model: 'tree', step: 15, ax: [0.55, 1.45], scale: [6.8, 11.5], foot: 0.52, rad: 1.75, tints: ['#2f7d32', '#3f9642', '#25662a', '#4ea344'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'pine', step: 18, ax: [0.55, 1.5], scale: [7.5, 12.8], foot: 0.36, rad: 1.5, tints: ['#1f5e2c', '#2c7838', '#358742'], cat: 'terreno', tall: true },
      { model: 'tronco_hueco', step: 38, ax: [0.45, 0.95], scale: [2.4, 3.5], foot: 0.45, rad: 1.0, rotX: Math.PI / 2, yOff: 0.4, cat: 'terreno' },
      { model: 'bosque_casita', step: 48, ax: [0.65, 1.3], scale: [3.8, 5.2], foot: 0.5, rad: 1.4, cat: 'fachada', faceRoad: true },
    ],
  },
  mar: {
    ribbon: null,
    arch: { kind: 'mar', step: 58, sx: 1.06, sy: 7.4 },
    props: [
      { model: 'ciudad/mar_torre', step: 46, ax: [0.7, 1.45], scale: [7.5, 11.8], foot: 0.44, rad: 1.7, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'coral', step: 14, ax: [0.4, 1.25], scale: [3.4, 6.2], foot: 0.44, rad: 1.2, tints: ['#ff6f91', '#ff9671', '#ffc75f', '#4dd0e1', '#ff7eb9'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'concha_gigante', step: 28, ax: [0.4, 0.95], scale: [2.2, 3.4], foot: 0.5, rad: 0.95, cat: 'terreno', faceRoad: true },
      { model: 'mar_boya', step: 30, ax: [0.45, 0.95], scale: [2.6, 3.8], foot: 0.38, rad: 0.85, cat: 'techo' },
    ],
  },
  desierto: {
    ribbon: { mode: 'dune', c1: '#c48d48', c2: '#e8bc74', h: 2.2, w: 8.6, glow: 0 },
    arch: { kind: 'desierto', step: 62, sx: 1.08, sy: 7.6 },
    props: [
      { model: 'saguaro_grande', step: 15, ax: [0.45, 1.25], scale: [3.4, 5.8], foot: 0.42, rad: 1.05, cat: 'terreno', tall: true, bothSides: true },
      { model: 'palm', step: 24, ax: [0.55, 1.35], scale: [5.5, 8.8], foot: 0.4, rad: 1.3, tints: ['#4e9445', '#68a347', '#3f7d3a'], cat: 'terreno', tall: true },
      { model: 'pyramid', step: 52, ax: [0.9, 1.85], scale: [7.5, 12.2], foot: 0.52, rad: 2.0, tints: ['#d4a55c', '#c78c48', '#e0b872'], cat: 'terreno', tall: true },
      { model: 'ciudad/desierto_torre', step: 44, ax: [0.7, 1.4], scale: [5.8, 9.0], foot: 0.44, rad: 1.5, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  hielo: {
    ribbon: { mode: 'ice', c1: '#75b2d9', c2: '#dcf3ff', h: 1.9, w: 7.0, glow: 0.16 },
    arch: { kind: 'hielo', step: 56, sx: 1.06, sy: 7.5 },
    props: [
      { model: 'ice_spire', step: 15, ax: [0.5, 1.4], scale: [5.8, 11.2], foot: 0.38, rad: 1.4, tints: ['#b8ebff', '#8cd4fa', '#e4f8ff'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'estalagmita_hielo', step: 17, ax: [0.45, 1.1], scale: [3.4, 6.2], foot: 0.34, rad: 1.05, cat: 'terreno', tall: true },
      { model: 'hielo_iglu', step: 38, ax: [0.55, 1.15], scale: [3.2, 4.6], foot: 0.5, rad: 1.3, cat: 'fachada', faceRoad: true },
      { model: 'ciudad/hielo_torre', step: 48, ax: [0.75, 1.45], scale: [6.8, 10.6], foot: 0.44, rad: 1.6, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  volcan: {
    ribbon: { mode: 'lava', c1: '#ff3b08', c2: '#ffaa22', h: 0.55, w: 5.8, glow: 1.15 },
    arch: { kind: 'volcan', step: 60, sx: 1.06, sy: 7.5 },
    props: [
      { model: 'volcan_erupcion', step: 38, ax: [1.15, 2.1], scale: [6.8, 10.8], foot: 0.58, rad: 2.0, cat: 'terreno', tall: true },
      { model: 'rock', step: 15, ax: [1.05, 1.95], scale: [3.2, 5.8], foot: 0.48, rad: 1.3, tints: ['#332422', '#47302a', '#281d1c'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'volcan_farol', step: 20, ax: [0.35, 0.75], scale: [2.4, 3.3], foot: 0.22, rad: 0.65, cat: 'techo' },
      { model: 'volcan_altar', step: 38, ax: [0.55, 1.1], scale: [2.8, 4.0], foot: 0.48, rad: 1.1, cat: 'terreno', faceRoad: true },
    ],
  },
  cristal: {
    ribbon: null,
    arch: { kind: 'cristal', step: 54, sx: 1.06, sy: 7.5 },
    props: [
      { model: 'crystal', step: 14, ax: [0.45, 1.4], scale: [5.4, 10.6], foot: 0.38, rad: 1.35, tints: ['#7df9ff', '#ff7de9', '#b894ff', '#7dffb2'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'cristal_prisma', step: 18, ax: [0.45, 1.2], scale: [4.2, 7.8], foot: 0.4, rad: 1.15, cat: 'terreno', tall: true },
      { model: 'geoda', step: 24, ax: [0.4, 0.95], scale: [2.4, 3.8], foot: 0.5, rad: 0.95, cat: 'terreno', faceRoad: true },
      { model: 'ciudad/cristal_torre', step: 46, ax: [0.7, 1.4], scale: [6.8, 11.2], foot: 0.44, rad: 1.6, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  nubes: {
    ribbon: { mode: 'cloud', c1: '#dce6ff', c2: '#ffffff', h: 1.35, w: 7.4, glow: 0.12 },
    arch: { kind: 'nubes', step: 60, sx: 1.08, sy: 7.6 },
    props: [
      { model: 'cloud', step: 16, ax: [0.85, 1.9], scale: [4.0, 6.8], foot: 0.5, rad: 1.5, yOff: [-2.2, 0.2], tints: ['#ffffff', '#eef4ff', '#fff7e0'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'isla_nube', step: 30, ax: [1.05, 2.05], scale: [5.2, 8.2], foot: 0.5, rad: 1.75, yOff: [-2.5, 0.8], cat: 'terreno', tall: true },
      { model: 'nubes_globo', step: 26, ax: [0.65, 1.4], scale: [3.4, 5.4], foot: 0.34, rad: 1.0, yOff: [2.8, 5.8], cat: 'techo', tall: true },
      { model: 'nubes_casita', step: 44, ax: [0.7, 1.3], scale: [3.6, 5.0], foot: 0.5, rad: 1.35, cat: 'fachada', faceRoad: true },
    ],
  },
  neon: {
    ribbon: null,
    arch: { kind: 'neon', step: 48, sx: 1.06, sy: 7.5 },
    props: [
      { model: 'ciudad/neon_rascacielos', step: 20, ax: [0.85, 1.75], scale: [8.8, 14.5], foot: 0.49, rad: 2.2, yOff: -0.25, tints: ['#ffffff', '#d8f4ff', '#ffd8fa'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/neon_torre', step: 24, ax: [0.75, 1.55], scale: [7.2, 12.2], foot: 0.44, rad: 1.85, yOff: -0.2, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'ciudad/neon_comercio', step: 28, ax: [0.65, 1.25], scale: [4.6, 6.8], foot: 0.52, rad: 1.45, cat: 'fachada', faceRoad: true },
      { model: 'neon_kiosco', step: 24, ax: [0.45, 0.9], scale: [2.4, 3.4], foot: 0.5, rad: 0.95, cat: 'fachada', faceRoad: true },
    ],
  },
  jardin: {
    ribbon: { mode: 'hedge', c1: '#357a34', c2: '#7cd964', h: 0.85, w: 5.2, glow: 0 },
    arch: { kind: 'jardin', step: 56, sx: 1.06, sy: 7.3 },
    props: [
      { model: 'jardin_gazebo', step: 30, ax: [0.6, 1.2], scale: [3.6, 5.2], foot: 0.36, rad: 1.2, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'fuente_jardin', step: 38, ax: [0.55, 1.05], scale: [2.8, 4.0], foot: 0.5, rad: 1.15, cat: 'terreno' },
      { model: 'jardin_flor', step: 14, ax: [0.35, 0.85], scale: [2.0, 3.2], foot: 0.34, rad: 0.7, cat: 'terreno', bothSides: true },
      { model: 'tree', step: 18, ax: [0.65, 1.5], scale: [5.5, 9.2], foot: 0.52, rad: 1.55, tints: ['#4fa84b', '#ff8fb8', '#ffb3d9', '#67bd5b'], cat: 'terreno', tall: true, bothSides: true },
    ],
  },
  sombrio: {
    ribbon: null,
    arch: { kind: 'sombrio', step: 56, sx: 1.06, sy: 7.4 },
    props: [
      { model: 'tomb', step: 28, ax: [0.65, 1.35], scale: [4.8, 7.6], foot: 0.48, rad: 1.5, tints: ['#5a4d75', '#423659', '#70608f'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/sombrio_torre', step: 38, ax: [0.75, 1.55], scale: [7.2, 11.4], foot: 0.44, rad: 1.75, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'lapida', step: 14, ax: [0.4, 0.9], scale: [2.0, 3.2], foot: 0.34, rad: 0.75, cat: 'terreno', faceRoad: true, bothSides: true },
      { model: 'sombrio_farol', step: 18, ax: [0.35, 0.75], scale: [2.6, 3.5], foot: 0.2, rad: 0.65, cat: 'techo' },
    ],
  },
}

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

function getArchGeo(kind) {
  if (archGeoCache.has(kind)) return archGeoCache.get(kind)
  const parts = []
  switch (kind) {
    case 'bosque':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.055, 0.085, 0.72, 7, s * 0.48, 0.36, 0, 0, s * 0.14), '#5c3c24'])
        parts.push([cyl(0.04, 0.06, 0.42, 6, s * 0.3, 0.76, 0, 0, s * 0.85), '#5c3c24'])
        parts.push([sph(0.24, 1.3, 0.72, 1.2, s * 0.34, 0.88, 0), '#2e7d32'])
      }
      parts.push([sph(0.32, 1.75, 0.56, 1.15, 0, 0.95, 0), '#3b943f'])
      parts.push([sph(0.22, 1.2, 0.55, 1.0, 0.12, 0.89, 0.08), '#58b34e'])
      break
    case 'mar':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.06, 0.095, 0.76, 7, s * 0.48, 0.38, 0, 0, s * 0.16), '#ff7aa8'])
        parts.push([cyl(0.04, 0.06, 0.35, 6, s * 0.43, 0.56, 0.06, 0.25, -s * 0.4), '#4dd0e1'])
        parts.push([sph(0.07, 1.2, 1.1, 1.2, s * 0.4, 0.78, 0), '#ffd166'])
      }
      parts.push([new THREE.TorusGeometry(0.42, 0.055, 6, 14, Math.PI).scale(1, 0.62, 1).translate(0, 0.74, 0), '#ff9671'])
      parts.push([cone(0.05, 0.22, 5, -0.15, 0.98, 0, 0, 0.2), '#ffc75f'])
      parts.push([cone(0.05, 0.22, 5, 0.15, 0.98, 0, 0, -0.2), '#4dd0e1'])
      break
    case 'desierto':
      for (const s of [-1, 1]) {
        parts.push([box(0.14, 0.72, 0.22, s * 0.48, 0.36, 0, 0, 0, s * 0.12), '#b86f3a'])
        parts.push([box(0.17, 0.22, 0.25, s * 0.5, 0.11, 0), '#9a582b'])
      }
      parts.push([box(0.96, 0.18, 0.24, 0, 0.84, 0), '#c98249'])
      parts.push([box(0.76, 0.11, 0.2, 0, 0.95, 0), '#dfa266'])
      break
    case 'hielo':
      for (const s of [-1, 1]) {
        parts.push([cone(0.11, 0.85, 6, s * 0.48, 0.42, 0, 0, s * 0.15), '#9edcff'])
        parts.push([cone(0.07, 0.55, 5, s * 0.53, 0.27, 0.08, 0.1, -s * 0.2), '#cfefff'])
      }
      parts.push([box(0.95, 0.14, 0.2, 0, 0.88, 0), '#bfe9ff'])
      for (let i = -2; i <= 2; i++) {
        parts.push([cone(0.036, 0.16 + (Math.abs(i) % 2) * 0.05, 5, i * 0.15, 0.76, 0, Math.PI, 0), '#e8f9ff'])
      }
      break
    case 'volcan':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.07, 0.12, 0.78, 6, s * 0.48, 0.39, 0, 0, s * 0.12), '#2b1e1c'])
        parts.push([box(0.03, 0.5, 0.14, s * 0.44, 0.38, 0, 0, 0, s * 0.12), '#ff5a1f'])
      }
      parts.push([box(0.95, 0.16, 0.22, 0, 0.86, 0), '#332422'])
      parts.push([box(0.84, 0.06, 0.24, 0, 0.86, 0), '#ff6d29'])
      break
    case 'cristal':
      for (const s of [-1, 1]) {
        parts.push([cone(0.08, 0.86, 6, s * 0.48, 0.43, 0, 0, s * 0.18), '#7df9ff'])
        parts.push([cone(0.06, 0.58, 6, s * 0.53, 0.29, 0.05, 0, -s * 0.18), '#ff7de9'])
      }
      parts.push([cyl(0.06, 0.06, 0.92, 6, 0, 0.86, 0, 0, Math.PI / 2), '#b894ff'])
      parts.push([new THREE.OctahedronGeometry(0.11, 0).translate(0, 0.94, 0), '#e6dcff'])
      break
    case 'nubes':
      for (const s of [-1, 1]) {
        parts.push([sph(0.13, 1.1, 1.3, 1.1, s * 0.5, 0.22, 0), '#ffffff'])
        parts.push([sph(0.11, 1.0, 1.4, 1.0, s * 0.45, 0.54, 0), '#eef4ff'])
      }
      parts.push([new THREE.TorusGeometry(0.45, 0.04, 5, 16, Math.PI).scale(1, 0.62, 1).translate(0, 0.72, 0), '#ffd54a'])
      parts.push([sph(0.14, 1.6, 0.7, 1.0, 0, 0.96, 0), '#ffffff'])
      break
    case 'neon':
      for (const s of [-1, 1]) {
        parts.push([box(0.07, 0.84, 0.12, s * 0.48, 0.42, 0), '#1a2038'])
        parts.push([box(0.03, 0.76, 0.14, s * 0.43, 0.42, 0), s < 0 ? '#ff2bd6' : '#2bffe8'])
      }
      parts.push([box(1.02, 0.13, 0.18, 0, 0.88, 0), '#161b30'])
      parts.push([box(0.88, 0.05, 0.2, 0, 0.88, 0), '#2bffe8'])
      parts.push([box(0.46, 0.09, 0.22, 0, 0.96, 0), '#ff2bd6'])
      break
    case 'jardin':
      for (const s of [-1, 1]) {
        parts.push([cyl(0.045, 0.055, 0.82, 7, s * 0.48, 0.41, 0), '#f5eadc'])
        parts.push([sph(0.1, 1.1, 1.0, 1.1, s * 0.48, 0.18, 0), '#3d9944'])
      }
      parts.push([box(1.02, 0.08, 0.18, 0, 0.86, 0), '#f5eadc'])
      parts.push([box(0.94, 0.06, 0.12, 0, 0.93, 0), '#4eb355'])
      for (const fx of [-0.26, 0, 0.26]) parts.push([sph(0.065, 1.2, 0.8, 1.2, fx, 0.97, 0), '#ff7ab8'])
      break
    default:
      for (const s of [-1, 1]) {
        parts.push([cyl(0.045, 0.075, 0.84, 6, s * 0.48, 0.42, 0, 0, s * 0.1), '#282038'])
        parts.push([sph(0.055, 1, 1.2, 1, s * 0.41, 0.65, 0), '#b784ff'])
      }
      parts.push([new THREE.TorusGeometry(0.44, 0.04, 5, 14, Math.PI).scale(1, 0.58, 1).translate(0, 0.72, 0), '#3b2e54'])
      parts.push([cone(0.045, 0.18, 5, 0, 0.98, 0), '#a24bff'])
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

let _archMat = null
function archMat() {
  if (!_archMat) _archMat = markShared(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))
  return _archMat
}

export function estructurasWarmup() {
  return [
    archMat(),
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
const _ribCheck = new THREE.Vector3()
function buildSegRibbonGeo(way, seg, si, world, spec) {
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
  const stepDist = 5.2 * TRACK_K // ~24 u
  const n = Math.max(4, Math.ceil(L / stepDist))
  const isLava = spec.mode === 'lava'
  const isIce = spec.mode === 'ice'
  const isDune = spec.mode === 'dune'
  const W = spec.w
  const H = spec.h

  for (let li = 0; li < lanes.length; li++) {
    const lane = lanes[li]
    const hw = halfWidth(lane)
    const E = hw + CURB
    const edge0 = E + TERR * 0.9
    for (const sideSign of [-1, 1]) {
      let stripCount = 0
      for (let i = 0; i <= n; i++) {
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
        if (isIce) hCrest = H * (0.65 + 0.65 * Math.abs(wave))
        else if (isDune) hCrest = H * (0.8 + 0.45 * wave)

        const pts = isLava
          ? [[edge0, -0.06, 0, 0], [edge0 + W * 0.18, -0.32, 0.35, 0.2], [edge0 + W * 0.72, -0.32, 0.65, 0.8], [edge0 + W * 0.95, 0.32 * H, 1, 1]]
          : [[edge0, -0.1, 0, 0], [edge0 + W * 0.42, hCrest * 0.72, 0.65, 0.35], [edge0 + W * 0.75, hCrest, 1, 0.7], [edge0 + W, -0.55, 0.25, 1]]

        const vBase = pos.length / 3
        for (let j = 0; j < 4; j++) {
          const [lat, py, tCol, ux] = pts[j]
          const lx = sideSign * lat
          pos.push(
            f.pos.x + f.side.x * lx + f.up.x * py,
            f.pos.y + f.side.y * lx + f.up.y * py,
            f.pos.z + f.side.z * lx + f.up.z * py,
          )
          nrm.push(f.up.x, f.up.y, f.up.z)
          cc.copy(c1).lerp(c2, tCol)
          colArr.push(cc.r, cc.g, cc.b)
          uv.push(ux, s * 0.18)
        }
        if (stripCount > 0) {
          const p0 = vBase - 4
          for (let j = 0; j < 3; j++) {
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
const F0 = {}
const F1 = {}
const _cand = new THREE.Vector3()
const _pL = new THREE.Vector3()
const _pR = new THREE.Vector3()

function getSegStructData(way, seg, si) {
  if (segDataCache.has(seg)) return segDataCache.get(seg)
  const themeId = way.theme?.id
  const spec = THEME_STRUCTS[themeId] ?? THEME_STRUCTS.bosque
  const rng = mulberry32(4219 + way.idx * 313 + si * 977)
  const world = mundoDe(way)
  const col = world ? colisionDe(world) : null
  const local = nuevoLocal()

  const ribbonGeo = buildSegRibbonGeo(way, seg, si, world, spec.ribbon)
  const arches = []
  const byModel = new Map()
  for (const p of spec.props) byModel.set(p.model, [])

  const L = Math.max(seg.length ?? 1, 1)
  const lanes = lanesOf(seg)
  const busyList = seg.switches ?? []
  const archSpec = spec.arch

  if (archSpec) {
    for (let s = 16; s < L - 12; s += archSpec.step * (0.85 + rng() * 0.3)) {
      const u = s / L
      for (let li = 0; li < lanes.length; li++) {
        const lane = lanes[li]
        if (busyList.some((w) => (w.from === lane.id || w.to === lane.id) && Math.abs(w.u * L - s) < 7.5)) continue
        const f = surfFrame(seg, lane.id, u, F0)
        const hw = halfWidth(lane)
        const E = hw + CURB
        // Si hay varios carriles agrupados, abarcar todo el paquete desde lane 0
        if (li === 0 && lanes.length > 1) {
          let minLat = -(E + TERR * 0.65)
          let maxLat = E + TERR * 0.65
          let anyBundled = false
          for (let j = 1; j < lanes.length; j++) {
            const fj = surfFrame(seg, lanes[j].id, u, F1)
            const diff = _pL.copy(fj.pos).sub(f.pos)
            if (diff.lengthSq() < (E * 5.2) ** 2) {
              anyBundled = true
              const lat = diff.dot(f.side)
              const Ej = halfWidth(lanes[j]) + CURB + TERR * 0.65
              minLat = Math.min(minLat, lat - Ej)
              maxLat = Math.max(maxLat, lat + Ej)
            }
          }
          if (anyBundled) {
            const midLat = (minLat + maxLat) * 0.5
            const span = maxLat - minLat
            _pL.copy(f.pos).addScaledVector(f.side, minLat)
            _pR.copy(f.pos).addScaledVector(f.side, maxLat)
            const aSeed = way.idx * 1009 + si * 131 + Math.round(s)
            const okL = colocar(world, { pos: _pL, seed: aSeed + 1 }, 0.75, { way: way.idx }, 0, local)
            const okR = okL && colocar(world, { pos: _pR, seed: aSeed + 2 }, 0.75, { way: way.idx }, 0, local)
            if (okL && okR) {
              arches.push({
                pos: f.pos.clone().addScaledVector(f.side, midLat).addScaledVector(f.up, -0.14),
                quat: basisQuat(f.up, f.tangent),
                scale: [span * (archSpec.sx ?? 1), (archSpec.sy ?? 8.2) * (0.95 + rng() * 0.14), 2.8 + rng() * 0.8],
              })
            }
            continue
          }
        } else if (li > 0) {
          const f0 = surfFrame(seg, lanes[0].id, u, F1)
          if (f.pos.distanceToSquared(f0.pos) < (E * 5.2) ** 2) continue
        }

        const spanHalf = E + TERR * 0.72
        _pL.copy(f.pos).addScaledVector(f.side, -spanHalf)
        _pR.copy(f.pos).addScaledVector(f.side, spanHalf)
        if (!outerClear(col, way.idx, seg, lane, u, _pL, 0.75, local) ||
            !outerClear(col, way.idx, seg, lane, u, _pR, 0.75, local)) continue
        const aSeed = way.idx * 1009 + si * 131 + lane.id * 29 + Math.round(s)
        if (!colocar(world, { pos: _pL, seed: aSeed + 1 }, 0.75, { way: way.idx }, 0, local)) continue
        if (!colocar(world, { pos: _pR, seed: aSeed + 2 }, 0.75, { way: way.idx }, 0, local)) continue

        arches.push({
          pos: f.pos.clone().addScaledVector(f.up, -0.12),
          quat: basisQuat(f.up, f.tangent),
          scale: [spanHalf * 2 * (archSpec.sx ?? 1), (archSpec.sy ?? 7.4) * (0.94 + rng() * 0.14), 2.6 + rng() * 0.8],
        })
      }
    }
  }

  for (const lane of lanes) {
    const hw = halfWidth(lane)
    const E = hw + CURB
    const widthRatio = Math.max(1, hw / 2.45)

    for (const pSpec of spec.props) {
      const step = pSpec.step * (0.85 + rng() * 0.35)
      const list = byModel.get(pSpec.model)
      const tintColors = pSpec.tints ? pSpec.tints.map((h) => new THREE.Color(h)) : null
      for (let s = 6 + rng() * step * 0.6; s < L - 5; s += step) {
        if (busyList.some((w) => (w.from === lane.id || w.to === lane.id) && Math.abs(w.u * L - s) < 5.5)) continue
        const u = s / L
        const f = surfFrame(seg, lane.id, u, F0)

        const firstSign = rng() < 0.5 ? -1 : 1
        const tryBoth = !!pSpec.bothSides && rng() < 0.68
        for (const sgn of [firstSign, -firstSign]) {
          const sc = (pSpec.scale[0] + rng() * (pSpec.scale[1] - pSpec.scale[0])) * widthRatio
          const footR = sc * (pSpec.foot ?? 0.48)
          const minAx = E + TERR * pSpec.ax[0] + footR
          const maxAx = E + TERR * pSpec.ax[1] + footR
          const ax = minAx + rng() * (maxAx - minAx)
          const clearR = Math.max(pSpec.rad, footR * 0.92)
          const yBase = Array.isArray(pSpec.yOff)
            ? pSpec.yOff[0] + rng() * (pSpec.yOff[1] - pSpec.yOff[0])
            : (pSpec.yOff ?? -0.12)
          _cand.copy(f.pos).addScaledVector(f.side, sgn * ax).addScaledVector(f.up, yBase)
          if (!outerClear(col, way.idx, seg, lane, u, _cand, clearR, local)) continue
          const p = colocar(world, { pos: _cand, seed: way.idx * 104729 + si * 997 + lane.id * 53 + Math.round(s * 17) + (sgn > 0 ? 7 : 0) }, Math.max(pSpec.rad, footR * 0.72), { way: way.idx }, 0, local)
          if (!p) continue

          const quat = basisQuat(f.up, f.tangent)
          if (pSpec.faceRoad) {
            Q_YAW.setFromAxisAngle(Y_AXIS, (sgn > 0 ? -Math.PI / 2 : Math.PI / 2) + (rng() - 0.5) * 0.28)
          } else {
            Q_YAW.setFromAxisAngle(Y_AXIS, rng() * TAU)
          }
          quat.multiply(Q_YAW)
          if (pSpec.rotX) quat.multiply(Q_ROTX.setFromAxisAngle(X_AXIS, pSpec.rotX))

          list.push({
            pos: p,
            quat,
            scale: sc,
            color: tintColors ? tintColors[Math.floor(rng() * tintColors.length)] : null,
          })
          if (!tryBoth) break
        }
      }
    }
  }

  const out = { ribbonGeo, arches, byModel }
  segDataCache.set(seg, out)
  return out
}

// ═══════════════════════════ POOL DE INSTANCIAS FIJAS POR MODELO ═══════════════════════════
function FixedPoolInst({ model, themeId, cat, tall, waySphere, regPool }) {
  const geo = useModelo(model, null)
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
    regPool(model, mesh, tall ? TALL_CULL_DIST : MED_CULL_DIST)
    return () => {
      regPool(model, null)
      mesh.dispose()
    }
  }, [mesh, model, tall, regPool])

  if (!mesh) return null
  return <primitive object={mesh} />
}

export default function Estructuras({ way, detail, time }) {
  const themeId = way.theme?.id
  const spec = THEME_STRUCTS[themeId] ?? THEME_STRUCTS.bosque
  const models = useMemo(() => spec.props.map((p) => p.model), [spec])
  useEffect(() => { precargarModelos(models) }, [models])

  const nonAirSegs = useMemo(
    () => (way.segments ?? []).map((seg, si) => ({ seg, si })).filter((x) => !x.seg.air),
    [way],
  )
  const waySphere = useMemo(() => getWayBoundingSphere(way, 18 * TRACK_K), [way])
  const archGeo = useMemo(() => (spec.arch ? getArchGeo(spec.arch.kind) : null), [spec.arch])
  const ribMat = useMemo(() => ribbonMat(themeId, spec.ribbon), [themeId, spec.ribbon])
  const aMat = useMemo(() => archMat(), [])

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
  const lastSegCheckRef = useRef(new THREE.Vector3(Infinity, 0, 0))
  const dirtyPoolRef = useRef(true)
  const groupRef = useRef()
  const tmpM = useMemo(() => new THREE.Matrix4(), [])
  const tmpS = useMemo(() => new THREE.Vector3(), [])
  const white = useMemo(() => new THREE.Color('#ffffff'), [])

  const regPool = useMemo(() => (model, mesh, range = MED_CULL_DIST) => {
    if (!mesh) { poolsRef.current.delete(model); return }
    poolsRef.current.set(model, { mesh, rangeSq: range * range })
    dirtyPoolRef.current = true
  }, [])

  const camera = useThree((s) => s.camera)
  useFrame(() => {
    if (time) LAVA_TIME.value = time.value
    const det = detail ? detail.value : 1
    if (groupRef.current) groupRef.current.visible = det >= 0.2
    if (det < 0.2) return

    const cam = camera.position
    // 1) Detectar tramos cercanos (curva <= SEG_ACTIVE_DIST + seg.length * 0.25)
    let segChanged = false
    if (cam.distanceToSquared(lastSegCheckRef.current) >= 100) {
      lastSegCheckRef.current.copy(cam)
      const near = []
      for (let i = 0; i < nonAirSegs.length; i++) {
        const x = nonAirSegs[i]
        const lim = SEG_ACTIVE_DIST + Math.min(260, x.seg.length * 0.28)
        if (minSegDistSq(x.seg, cam) <= lim * lim) near.push(x)
      }
      nearSegsRef.current = near
      dirtyPoolRef.current = true
      segChanged = true
    }

    // 2) Construir como máximo 1 tramo cercano aún no cacheado en este frame (sin picos de CPU)
    let builtOne = false
    for (let i = 0; i < nearSegsRef.current.length; i++) {
      const { seg, si } = nearSegsRef.current[i]
      if (!segDataCache.has(seg)) {
        if (builtOne) continue
        builtOne = true
        getSegStructData(way, seg, si)
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

    // 3) Compactar instancias cercanas solo cuando la cámara se mueve >= 4 u o llegó un pool/tramo nuevo
    if (!dirtyPoolRef.current && cam.distanceToSquared(lastCamRef.current) < MOVE_RECOMPACT_SQ) return
    lastCamRef.current.copy(cam)
    dirtyPoolRef.current = false

    const nearData = []
    for (let i = 0; i < nearSegsRef.current.length; i++) {
      const sd = segDataCache.get(nearSegsRef.current[i].seg)
      if (sd) nearData.push(sd)
    }

    if (archMesh) {
      let ac = 0
      const rSq = ARCH_CULL_DIST * ARCH_CULL_DIST
      for (let s = 0; s < nearData.length && ac < ARCH_CAP; s++) {
        const list = nearData[s].arches
        for (let i = 0; i < list.length && ac < ARCH_CAP; i++) {
          const it = list[i]
          if (cam.distanceToSquared(it.pos) > rSq) continue
          tmpS.set(it.scale[0], it.scale[1], it.scale[2])
          archMesh.setMatrixAt(ac++, tmpM.compose(it.pos, it.quat, tmpS))
        }
      }
      archMesh.count = ac
      if (ac > 0) archMesh.instanceMatrix.needsUpdate = true
    }

    for (const [model, entry] of poolsRef.current) {
      const { mesh, rangeSq } = entry
      let count = 0
      let tinted = false
      for (let s = 0; s < nearData.length && count < POOL_CAP; s++) {
        const list = nearData[s].byModel.get(model)
        if (!list) continue
        for (let i = 0; i < list.length && count < POOL_CAP; i++) {
          const it = list[i]
          if (cam.distanceToSquared(it.pos) > rangeSq) continue
          tmpS.setScalar(it.scale)
          mesh.setMatrixAt(count, tmpM.compose(it.pos, it.quat, tmpS))
          if (it.color) { mesh.setColorAt(count, it.color); tinted = true }
          else if (tinted) mesh.setColorAt(count, white)
          count++
        }
      }
      mesh.count = count
      if (count > 0) {
        mesh.instanceMatrix.needsUpdate = true
        if (tinted && mesh.instanceColor) mesh.instanceColor.needsUpdate = true
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
