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

const SEG_ACTIVE_DIST = 98 // distancia real a la curva del tramo para activarlo (solo 1-2 tramos activos)
const TALL_CULL_DIST = 96
const MED_CULL_DIST = 58
const ARCH_CULL_DIST = 104
const OVERVIEW_DIST_SQ = 36 * 36 // > 36 u del tramo más cercano = vista general Camino -> LOD reducido
const POOL_CAP = 128
const ARCH_CAP = 48
const MOVE_RECOMPACT_SQ = 20 // recompila instancias visibles solo al moverse >= 4.5 u

// ═══════════════════════════ CATÁLOGO POR TEMA (4 piezas clave + arco + ribera) ═══════════════════════════
const THEME_STRUCTS = {
  bosque: {
    ribbon: { mode: 'hedge', c1: '#235926', c2: '#4aa142', h: 1.05, w: 6.0, glow: 0.04 },
    arch: { kind: 'bosque', step: 38, sx: 1.08, sy: 8.2 },
    props: [
      { model: 'tree', step: 13, ax: [0.55, 1.45], scale: [9.2, 15.2], foot: 0.5, rad: 1.85, tints: ['#2f7d32', '#3f9642', '#25662a', '#4ea344'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'pine', step: 15, ax: [0.55, 1.5], scale: [9.8, 16.2], foot: 0.36, rad: 1.6, tints: ['#1f5e2c', '#2c7838', '#358742'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'tronco_hueco', step: 32, ax: [0.45, 0.95], scale: [2.8, 4.0], foot: 0.45, rad: 1.05, rotX: Math.PI / 2, yOff: 0.45, cat: 'terreno' },
      { model: 'hongo_gigante', step: 24, ax: [0.4, 0.95], scale: [2.6, 4.2], foot: 0.48, rad: 1.0, cat: 'terreno' },
      { model: 'bosque_casita', step: 44, ax: [0.7, 1.35], scale: [4.2, 5.8], foot: 0.5, rad: 1.45, cat: 'fachada', faceRoad: true },
    ],
  },
  mar: {
    ribbon: { mode: 'reef', c1: '#1a6e96', c2: '#4de0cf', h: 1.55, w: 7.8, glow: 0.14 },
    arch: { kind: 'mar', step: 42, sx: 1.08, sy: 8.0 },
    props: [
      { model: 'ciudad/mar_torre', step: 40, ax: [0.75, 1.5], scale: [8.8, 13.5], foot: 0.44, rad: 1.75, tints: ['#e8f8ff', '#b8ecff'], cat: 'fachada', faceRoad: true, tall: true },
      { model: 'coral', step: 12, ax: [0.4, 1.25], scale: [3.8, 6.8], foot: 0.44, rad: 1.2, tints: ['#ff6f91', '#ff9671', '#ffc75f', '#4dd0e1', '#ff7eb9'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'alga_larga', step: 14, ax: [0.4, 1.1], scale: [4.6, 8.2], foot: 0.25, rad: 0.85, tints: ['#28b899', '#45d9aa', '#1f9488'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'concha_gigante', step: 24, ax: [0.4, 0.95], scale: [2.4, 3.8], foot: 0.5, rad: 1.0, cat: 'terreno', faceRoad: true },
      { model: 'mar_boya', step: 28, ax: [0.45, 0.95], scale: [2.8, 4.2], foot: 0.38, rad: 0.85, cat: 'techo' },
    ],
  },
  desierto: {
    ribbon: { mode: 'dune', c1: '#c48d48', c2: '#ecc37a', h: 2.75, w: 10.2, glow: 0.04 },
    arch: { kind: 'desierto', step: 46, sx: 1.1, sy: 8.2 },
    props: [
      { model: 'saguaro_grande', step: 14, ax: [0.45, 1.25], scale: [3.8, 6.4], foot: 0.42, rad: 1.05, cat: 'terreno', tall: true, bothSides: true },
      { model: 'pyramid', step: 42, ax: [0.95, 1.9], scale: [8.2, 13.4], foot: 0.52, rad: 2.05, tints: ['#d4a55c', '#c78c48', '#e0b872'], cat: 'terreno', tall: true },
      { model: 'ciudad/desierto_torre', step: 38, ax: [0.75, 1.45], scale: [6.5, 10.2], foot: 0.44, rad: 1.55, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'desierto_oasis', step: 36, ax: [0.6, 1.25], scale: [4.4, 6.4], foot: 0.48, rad: 1.4, cat: 'terreno' },
    ],
  },
  hielo: {
    ribbon: { mode: 'ice', c1: '#6eb4de', c2: '#e2f6ff', h: 3.3, w: 7.4, glow: 0.18 },
    arch: { kind: 'hielo', step: 40, sx: 1.08, sy: 8.2 },
    props: [
      { model: 'ice_spire', step: 13, ax: [0.5, 1.4], scale: [6.4, 12.2], foot: 0.38, rad: 1.4, tints: ['#b8ebff', '#8cd4fa', '#e4f8ff'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'estalagmita_hielo', step: 14, ax: [0.45, 1.15], scale: [4.2, 7.6], foot: 0.34, rad: 1.1, cat: 'terreno', tall: true, bothSides: true },
      { model: 'hielo_iglu', step: 34, ax: [0.55, 1.15], scale: [3.5, 5.0], foot: 0.5, rad: 1.3, cat: 'fachada', faceRoad: true },
      { model: 'ciudad/hielo_torre', step: 42, ax: [0.75, 1.45], scale: [7.5, 11.6], foot: 0.44, rad: 1.65, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  volcan: {
    ribbon: { mode: 'lava', c1: '#ff3b08', c2: '#ffaa22', h: 0.72, w: 6.8, glow: 1.0 },
    arch: { kind: 'volcan', step: 44, sx: 1.08, sy: 8.0 },
    props: [
      { model: 'volcan_erupcion', step: 30, ax: [1.15, 2.1], scale: [7.4, 12.0], foot: 0.58, rad: 2.0, tints: ['#785046', '#8f5a4a'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'rock', step: 13, ax: [1.05, 1.95], scale: [3.6, 6.4], foot: 0.48, rad: 1.3, tints: ['#6b4b44', '#7d564c', '#573b36'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'geiser', step: 26, ax: [0.65, 1.3], scale: [3.4, 5.2], foot: 0.48, rad: 1.15, tints: ['#855c50', '#9c6855'], cat: 'terreno', tall: true },
      { model: 'volcan_farol', step: 18, ax: [0.35, 0.75], scale: [2.6, 3.6], foot: 0.22, rad: 0.65, cat: 'techo' },
      { model: 'volcan_altar', step: 34, ax: [0.55, 1.1], scale: [3.0, 4.4], foot: 0.48, rad: 1.1, cat: 'terreno', faceRoad: true },
    ],
  },
  cristal: {
    ribbon: { mode: 'canyon', c1: '#48388a', c2: '#9a7dff', h: 3.1, w: 7.8, glow: 0.22 },
    arch: { kind: 'cristal', step: 42, sx: 1.08, sy: 8.1 },
    props: [
      { model: 'crystal', step: 12, ax: [0.45, 1.4], scale: [6.2, 12.2], foot: 0.38, rad: 1.35, tints: ['#7df9ff', '#ff7de9', '#b894ff', '#7dffb2'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'cristal_prisma', step: 15, ax: [0.45, 1.25], scale: [4.8, 8.8], foot: 0.4, rad: 1.15, cat: 'terreno', tall: true, bothSides: true },
      { model: 'geoda', step: 22, ax: [0.4, 0.95], scale: [2.6, 4.2], foot: 0.5, rad: 0.95, cat: 'terreno', faceRoad: true },
      { model: 'ciudad/cristal_torre', step: 40, ax: [0.7, 1.4], scale: [7.6, 12.4], foot: 0.44, rad: 1.6, cat: 'fachada', faceRoad: true, tall: true },
    ],
  },
  nubes: {
    ribbon: { mode: 'cloud', c1: '#dce6ff', c2: '#ffffff', h: 1.65, w: 8.2, glow: 0.14 },
    arch: { kind: 'nubes', step: 44, sx: 1.1, sy: 8.0 },
    props: [
      { model: 'isla_nube', step: 22, ax: [1.05, 2.1], scale: [6.2, 10.0], foot: 0.5, rad: 1.85, yOff: [-2.4, 0.9], cat: 'terreno', tall: true, bothSides: true },
      { model: 'cloud', step: 14, ax: [0.85, 1.9], scale: [4.4, 7.6], foot: 0.5, rad: 1.5, yOff: [-2.0, 0.4], tints: ['#ffffff', '#eef4ff', '#fff7e0'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'nubes_globo', step: 22, ax: [0.65, 1.4], scale: [3.8, 6.0], foot: 0.34, rad: 1.0, yOff: [3.0, 6.6], cat: 'techo', tall: true },
      { model: 'nubes_casita', step: 38, ax: [0.7, 1.3], scale: [3.8, 5.4], foot: 0.5, rad: 1.35, cat: 'fachada', faceRoad: true },
    ],
  },
  neon: {
    ribbon: { mode: 'cyber', c1: '#161b36', c2: '#2d3b70', h: 0.45, w: 7.6, glow: 0.16 },
    arch: { kind: 'neon', step: 36, sx: 1.08, sy: 8.2 },
    props: [
      { model: 'ciudad/neon_rascacielos', step: 17, ax: [0.85, 1.75], scale: [9.4, 15.8], foot: 0.49, rad: 2.2, yOff: -0.25, tints: ['#ffffff', '#d8f4ff', '#ffd8fa'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/neon_torre', step: 20, ax: [0.75, 1.55], scale: [7.8, 13.2], foot: 0.44, rad: 1.85, yOff: -0.2, tints: ['#eef7ff', '#ffe6fb'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/neon_comercio', step: 24, ax: [0.65, 1.25], scale: [5.0, 7.4], foot: 0.52, rad: 1.45, cat: 'fachada', faceRoad: true },
      { model: 'neon_kiosco', step: 20, ax: [0.45, 0.9], scale: [2.6, 3.8], foot: 0.5, rad: 0.95, cat: 'fachada', faceRoad: true },
    ],
  },
  jardin: {
    ribbon: { mode: 'hedge', c1: '#2f7a32', c2: '#7be063', h: 1.35, w: 5.8, glow: 0.05 },
    arch: { kind: 'jardin', step: 34, sx: 1.08, sy: 7.6 },
    props: [
      { model: 'jardin_gazebo', step: 26, ax: [0.6, 1.2], scale: [4.0, 5.8], foot: 0.36, rad: 1.25, cat: 'fachada', faceRoad: true, tall: true },
      { model: 'fuente_jardin', step: 30, ax: [0.55, 1.1], scale: [3.2, 4.6], foot: 0.5, rad: 1.2, cat: 'terreno' },
      { model: 'jardin_flor', step: 12, ax: [0.35, 0.85], scale: [2.2, 3.6], foot: 0.34, rad: 0.72, cat: 'terreno', bothSides: true },
      { model: 'tree', step: 16, ax: [0.65, 1.5], scale: [6.2, 10.4], foot: 0.52, rad: 1.6, tints: ['#4fa84b', '#ff8fb8', '#ffb3d9', '#67bd5b'], cat: 'terreno', tall: true, bothSides: true },
    ],
  },
  sombrio: {
    ribbon: { mode: 'crypt', c1: '#281f3d', c2: '#503b75', h: 1.05, w: 6.4, glow: 0.1 },
    arch: { kind: 'sombrio', step: 44, sx: 1.08, sy: 8.0 },
    props: [
      { model: 'proc:dead_tree', step: 14, ax: [0.55, 1.35], scale: [7.2, 11.8], foot: 0.32, rad: 1.35, tints: ['#3e3054', '#4e3c69', '#322645'], cat: 'terreno', tall: true, bothSides: true },
      { model: 'tomb', step: 22, ax: [0.65, 1.35], scale: [5.4, 8.6], foot: 0.48, rad: 1.55, tints: ['#786899', '#5e4f7d', '#8e7cb0'], cat: 'fachada', faceRoad: true, tall: true, bothSides: true },
      { model: 'ciudad/sombrio_torre', step: 34, ax: [0.75, 1.55], scale: [7.8, 12.2], foot: 0.44, rad: 1.75, tints: ['#8574a8', '#68588a'], cat: 'fachada', faceRoad: true, tall: true },
      { model: 'lapida', step: 13, ax: [0.4, 0.9], scale: [2.2, 3.6], foot: 0.34, rad: 0.75, cat: 'terreno', faceRoad: true, bothSides: true },
      { model: 'sombrio_farol', step: 16, ax: [0.35, 0.75], scale: [2.8, 3.8], foot: 0.2, rad: 0.65, cat: 'techo' },
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
  const stepDist = 2.6 * TRACK_K // ~12 u para seguir curvas suavemente
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

        const pts = isLava
          ? [[edge0, -0.08, 0, 0], [edge0 + W * 0.16, -0.34, 0.35, 0.18], [edge0 + W * 0.72, -0.34, 0.65, 0.82], [edge0 + W, 0.28 * H, 1, 1]]
          : isCyber
            ? [[edge0, -0.08, 0, 0], [edge0 + W * 0.14, 0.22, 0.75, 0.2], [edge0 + W * 0.86, 0.26, 1, 0.85], [edge0 + W, -0.45, 0.2, 1]]
            : [[edge0, -0.08, 0, 0], [edge0 + W * 0.42, hCrest * 0.76, 0.65, 0.35], [edge0 + W * 0.76, hCrest, 1, 0.7], [edge0 + W, -0.7, 0.25, 1]]

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
    // 1) Detectar tramos cercanos (curva <= SEG_ACTIVE_DIST + seg.length * 0.2)
    let segChanged = false
    if (cam.distanceToSquared(lastSegCheckRef.current) >= 100) {
      lastSegCheckRef.current.copy(cam)
      const near = []
      let bestD2 = Infinity
      for (let i = 0; i < nonAirSegs.length; i++) {
        const x = nonAirSegs[i]
        const d2 = minSegDistSq(x.seg, cam)
        if (d2 < bestD2) bestD2 = d2
        const lim = SEG_ACTIVE_DIST + Math.min(130, x.seg.length * 0.2)
        if (d2 <= lim * lim) near.push(x)
      }
      minDistSqRef.current = bestD2
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

    // 3) Compactar instancias cercanas solo cuando la cámara se mueve >= 4.5 u, gira > 14°, o llegó un tramo nuevo
    camera.getWorldDirection(camFwdTmp)
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
      for (let s = 0; s < nearData.length && ac < ARCH_CAP; s++) {
        const list = nearData[s].arches
        for (let i = 0; i < list.length && ac < ARCH_CAP; i += (overview ? 2 : 1)) {
          const it = list[i]
          deltaTmp.copy(it.pos).sub(cam)
          const d2 = deltaTmp.lengthSq()
          if (d2 > rSq || (!overview && d2 > 400 && deltaTmp.dot(camFwdTmp) < -16)) continue
          tmpS.set(it.scale[0], it.scale[1], it.scale[2])
          archMesh.setMatrixAt(ac++, tmpM.compose(it.pos, it.quat, tmpS))
        }
      }
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
      let count = 0
      let tinted = false
      for (let s = 0; s < nearData.length && count < POOL_CAP; s++) {
        const list = nearData[s].byModel.get(model)
        if (!list) continue
        for (let i = 0; i < list.length && count < POOL_CAP; i += stride) {
          const it = list[i]
          deltaTmp.copy(it.pos).sub(cam)
          const d2 = deltaTmp.lengthSq()
          if (d2 > effRangeSq || (!overview && d2 > 400 && deltaTmp.dot(camFwdTmp) < -16)) continue
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
