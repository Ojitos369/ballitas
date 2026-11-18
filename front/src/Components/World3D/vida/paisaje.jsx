// Paisaje vivo por tema, a lo largo de todo el camino: capas procedurales (árboles con tronco y copa de
// lóbulos, sotobosque, arrecifes, bancos de peces, burbujas, rayos de luz, luciérnagas, agua animada...).
// Todo se instancia en pools de capacidad fija, se construye por tramo bajo demanda (máx. 1 tramo/cuadro)
// y la animación vive en el vertex shader (un solo uniform de tiempo): la CPU solo recompacta instancias
// cercanas cuando la cámara se mueve.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { TRACK_K } from '../../../Core/world.js'
import { colisionDe, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { getWayBoundingSphere, markShared, minSegDistSq, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { CURB, TERR, bermY, halfWidth, laneSideClear, lanesOf, surfFrame } from './pista.jsx'

const P_TIME = { value: 0 }
const TAU = Math.PI * 2
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const SEG_ACTIVE_DIST = 96
const MOVE_RECOMPACT_SQ = 20

// ═══════════════════════════ GEOMETRÍAS PROCEDURALES ═══════════════════════════
const _m4 = new THREE.Matrix4()
const _q = new THREE.Quaternion()
const _e = new THREE.Euler()
const _v = new THREE.Vector3()
const _s = new THREE.Vector3()
const _c = new THREE.Color()
const _c2 = new THREE.Color()

const hash3 = (x, y, z) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return h - Math.floor(h)
}

/** Pieza no indexada con color por vértice (función o hex) y fase opcional. */
function piece(geo, { pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0], color = '#ffffff', shade = 0, jitter = 0, phase = 0, noise = 0 } = {}) {
  let g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  if (noise > 0) {
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      _v.fromBufferAttribute(p, i)
      const k = 1 + (hash3(Math.round(_v.x * 40), Math.round(_v.y * 40), Math.round(_v.z * 40)) - 0.5) * noise
      p.setXYZ(i, _v.x * k, _v.y * k, _v.z * k)
    }
  }
  g.applyMatrix4(_m4.compose(_v.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl)))
  // Normales suaves: se sueldan los vértices coincidentes, se promedian y se vuelve a no indexada.
  g.deleteAttribute('normal')
  const welded = mergeVertices(g, 1e-4)
  welded.computeVertexNormals()
  g.dispose()
  g = welded.toNonIndexed()
  welded.dispose()
  const p = g.attributes.position
  const n = p.count
  const col = new Float32Array(n * 3)
  const ph = new Float32Array(n)
  g.computeBoundingBox()
  const y0 = g.boundingBox.min.y; const y1 = g.boundingBox.max.y
  for (let i = 0; i < n; i++) {
    const y = p.getY(i)
    if (typeof color === 'function') color(_c, p.getX(i), y, p.getZ(i))
    else _c.set(color)
    const t = y1 > y0 ? (y - y0) / (y1 - y0) : 0.5
    const k = 1 + shade * (t - 0.5) + (jitter ? (hash3(p.getX(i) * 9, y * 9, p.getZ(i) * 9) - 0.5) * jitter : 0)
    col[i * 3] = _c.r * k; col[i * 3 + 1] = _c.g * k; col[i * 3 + 2] = _c.b * k
    ph[i] = phase
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
  return g
}

function merge(parts, name) {
  const g = mergeGeometries(parts.filter(Boolean), false)
  parts.forEach((p) => p?.dispose())
  g.computeBoundingSphere()
  g.name = 'paisaje:' + name
  return markShared(g)
}

const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d)
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s, 1)
const cone = (r, h, s = 9) => new THREE.ConeGeometry(r, h, s, 1)
const sphere = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h)

const GEOS = {
  // Roble: tronco con raíces y ramas, copa de 7 lóbulos con tonos distintos (más claros arriba).
  oak: () => {
    const greens = ['#3d6e2c', '#4f7f33', '#2f5e2a', '#5c8a38', '#47763a', '#6b9440', '#38663a']
    const parts = [
      piece(cyl(0.05, 0.085, 0.62, 8), { pos: [0, 0.31, 0], color: '#5b4030', shade: 0.4, jitter: 0.25 }),
      piece(cyl(0.02, 0.04, 0.32, 6), { pos: [0.1, 0.62, 0], rot: [0, 0, -0.75], color: '#5b4030' }),
      piece(cyl(0.018, 0.035, 0.3, 6), { pos: [-0.09, 0.66, 0.04], rot: [0.3, 0, 0.7], color: '#5b4030' }),
    ]
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.4
      parts.push(piece(cone(0.04, 0.2, 6), { pos: [Math.cos(a) * 0.08, 0.05, Math.sin(a) * 0.08], rot: [Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1], color: '#4a3326' }))
    }
    const lobes = [[0, 0.98, 0, 0.3], [0.2, 0.86, 0.06, 0.22], [-0.2, 0.88, -0.05, 0.23], [0.04, 0.84, 0.21, 0.21], [-0.05, 0.86, -0.2, 0.22], [0.12, 1.12, -0.08, 0.19], [-0.1, 1.1, 0.1, 0.18]]
    lobes.forEach(([x, y, z, r], i) => {
      parts.push(piece(ico(r, 1), { pos: [x, y, z], scl: [1, 0.86, 1], color: greens[i % greens.length], shade: 0.9, jitter: 0.35, noise: 0.28 }))
    })
    return merge(parts, 'oak')
  },
  // Abeto: tronco y 4 pisos de conos con borde irregular y tono que aclara hacia la punta.
  fir: () => {
    const parts = [piece(cyl(0.035, 0.06, 0.4, 7), { pos: [0, 0.2, 0], color: '#4e3527', shade: 0.4 })]
    const tiers = [[0.28, 0.42, 0.36, '#1f4a2c'], [0.23, 0.38, 0.6, '#255634'], [0.17, 0.32, 0.82, '#2d623a'], [0.11, 0.26, 1.02, '#3a7045']]
    for (const [r, h, y, c] of tiers) parts.push(piece(cone(r, h, 10), { pos: [0, y, 0], color: c, shade: 0.8, jitter: 0.3, noise: 0.22 }))
    return merge(parts, 'fir')
  },
  // Helecho: 7 frondas curvadas que se abren en abanico.
  fern: () => {
    const parts = []
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + (i % 2) * 0.3
      const tilt = 0.75 + (i % 3) * 0.18
      const c = i % 2 ? '#4f8f3a' : '#6aa847'
      parts.push(piece(sphere(0.5, 6, 4), { pos: [Math.sin(a) * 0.16, 0.13, Math.cos(a) * 0.16], scl: [0.07, 0.018, 0.34], rot: [tilt, a, 0], color: c, shade: 0.6, jitter: 0.2 }))
    }
    return merge(parts, 'fern')
  },
  // Roca con musgo: icosaedro deformado, gris con verde en la cara superior.
  mossRock: () => merge([piece(ico(0.5, 1), {
    pos: [0, 0.25, 0], scl: [1.2, 0.6, 1], noise: 0.45, jitter: 0.25,
    color: (c, x, y) => c.set('#77736b').lerp(_c2.set('#4f7d33'), THREE.MathUtils.smoothstep(y, 0.05, 0.22)),
  })], 'mossRock'),
  // Hongos: grupo de tres con sombrero rojo/ocre y tallo crema.
  shrooms: () => {
    const parts = []
    const set = [[0, 0, 0.2, '#c2452d'], [0.16, 0.05, 0.13, '#d77a35'], [-0.12, -0.09, 0.1, '#b0402f']]
    for (const [x, z, h, cap] of set) {
      parts.push(piece(cyl(h * 0.18, h * 0.24, h, 7), { pos: [x, h / 2, z], color: '#efe3c8' }))
      parts.push(piece(new THREE.SphereGeometry(h * 0.62, 9, 5, 0, TAU, 0, Math.PI / 2), { pos: [x, h * 0.95, z], scl: [1, 0.7, 1], color: cap, shade: 0.5, jitter: 0.15 }))
    }
    return merge(parts, 'shrooms')
  },
  // Rayos de luz: dos planos cruzados (el shader los desvanece hacia abajo y a los lados).
  ray: () => {
    const parts = []
    for (const a of [0, Math.PI / 2]) {
      const g = new THREE.PlaneGeometry(0.22, 1, 1, 4).translate(0, 0.5, 0).rotateY(a)
      parts.push(piece(g, { color: '#ffffff' }))
    }
    return merge(parts, 'ray')
  },
  // Nube de motas (luciérnagas, plancton, chispas): 14 puntos con fase propia.
  motes: () => {
    const parts = []
    const rng = mulberry32(77)
    for (let i = 0; i < 14; i++) {
      parts.push(piece(sphere(0.022, 6, 5), { pos: [(rng() - 0.5) * 2, rng() * 1.2, (rng() - 0.5) * 2], color: '#ffffff', phase: rng() * TAU }))
    }
    return merge(parts, 'motes')
  },
  // Columna de burbujas: 9 esferas que el shader hace subir en bucle.
  bubbles: () => {
    const parts = []
    const rng = mulberry32(91)
    for (let i = 0; i < 9; i++) {
      const r = 0.025 + rng() * 0.045
      parts.push(piece(sphere(r, 7, 5), { pos: [(rng() - 0.5) * 0.5, 0, (rng() - 0.5) * 0.5], color: '#ffffff', phase: rng() }))
    }
    return merge(parts, 'bubbles')
  },
  // Banco de peces: 11 peces en un arco de radio 1 mirando en la tangente; el shader hace girar el banco.
  school: () => {
    const parts = []
    const rng = mulberry32(5)
    const cols = ['#ffb347', '#ff7f50', '#ffd166', '#4dd0e1', '#f2f7ff']
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 2.2 + (rng() - 0.5) * 0.15
      const r = 1 + (rng() - 0.5) * 0.22
      const y = (rng() - 0.5) * 0.28
      const col = cols[Math.floor(rng() * cols.length)]
      const fish = [
        piece(sphere(0.06, 7, 5), { scl: [0.45, 0.8, 1.6], color: col, shade: 0.6 }),
        piece(cone(0.045, 0.08, 4), { pos: [0, 0, -0.12], rot: [-Math.PI / 2, 0, 0], scl: [0.25, 1, 1], color: col }),
      ]
      const f = mergeGeometries(fish, false); fish.forEach((p) => p.dispose())
      // tangente del arco (sentido de giro positivo alrededor de +Y)
      f.applyMatrix4(_m4.compose(_v.set(Math.cos(a) * r, y, -Math.sin(a) * r), _q.setFromAxisAngle(Y_AXIS, a + Math.PI), _s.set(1, 1, 1)))
      parts.push(f)
    }
    return merge(parts, 'school')
  },
  // Arrecife: roca base con corales ramificados, cerebro y abanico de colores vivos.
  reef: () => {
    const parts = [piece(ico(0.42, 1), {
      pos: [0, 0.12, 0], scl: [1.3, 0.55, 1.05], noise: 0.4, jitter: 0.3,
      color: (c, x, y) => c.set('#8a6f9a').lerp(_c2.set('#e0b89a'), THREE.MathUtils.smoothstep(y, 0.0, 0.2)),
    })]
    const rng = mulberry32(13)
    const vivid = ['#ff6f91', '#ff9671', '#ffc75f', '#c56bff', '#4dd0e1']
    for (let i = 0; i < 6; i++) {
      const a = rng() * TAU; const r = 0.12 + rng() * 0.3
      const col = vivid[i % vivid.length]
      const h = 0.25 + rng() * 0.3
      parts.push(piece(cyl(0.018, 0.035, h, 6), { pos: [Math.cos(a) * r, 0.2 + h / 2, Math.sin(a) * r], rot: [(rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6], color: col, shade: 0.7 }))
      parts.push(piece(sphere(0.04, 6, 4), { pos: [Math.cos(a) * r, 0.2 + h, Math.sin(a) * r], color: col }))
    }
    parts.push(piece(ico(0.13, 1), { pos: [0.22, 0.3, -0.12], scl: [1, 0.75, 1], noise: 0.3, color: '#e8a0c8', jitter: 0.4 }))
    parts.push(piece(sphere(0.5, 9, 6), { pos: [-0.18, 0.42, 0.1], scl: [0.42, 0.42, 0.04], rot: [0, 0.6, 0], color: '#ff5f7e', shade: 0.6, jitter: 0.25 }))
    return merge(parts, 'reef')
  },
  // Algas altas de tres hojas (el shader las mece por altura).
  kelp: () => {
    const parts = []
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU
      parts.push(piece(sphere(0.5, 5, 8), { pos: [Math.cos(a) * 0.06, 0.5, Math.sin(a) * 0.06], scl: [0.05, 1, 0.015], rot: [0, a, 0], color: i % 2 ? '#2f9a72' : '#4cbf86', shade: 0.9 }))
    }
    return merge(parts, 'kelp')
  },
  // Torre de datos neón: prisma oscuro con franjas (los bordes los ilumina el shader 'neon').
  datatower: () => {
    const parts = [piece(new THREE.BoxGeometry(0.34, 1, 0.34, 1, 6, 1), { pos: [0, 0.5, 0], color: '#151a2e', jitter: 0.2 })]
    parts.push(piece(new THREE.BoxGeometry(0.22, 0.3, 0.22), { pos: [0.02, 1.13, -0.02], color: '#1d2440' }))
    parts.push(piece(cyl(0.006, 0.006, 0.3, 4), { pos: [0.05, 1.42, 0], color: '#2bffe8' }))
    return merge(parts, 'datatower')
  },
  // Cúmulo de nubes: 6 esferas suaves blancas con base lavanda.
  cumulus: () => {
    const parts = []
    const lobes = [[0, 0.3, 0, 0.36], [0.33, 0.24, 0.05, 0.28], [-0.32, 0.22, -0.04, 0.27], [0.12, 0.5, -0.06, 0.26], [-0.14, 0.44, 0.1, 0.24], [0.02, 0.2, 0.25, 0.22]]
    for (const [x, y, z, r] of lobes) {
      parts.push(piece(sphere(r, 12, 9), { pos: [x, y, z], color: (c, px, py) => c.set('#c9c6f2').lerp(_c2.set('#ffffff'), THREE.MathUtils.smoothstep(py, 0.08, 0.42)) }))
    }
    return merge(parts, 'cumulus')
  },
}
const geoCache = new Map()
const getGeo = (k) => {
  if (!geoCache.has(k)) geoCache.set(k, GEOS[k]())
  return geoCache.get(k)
}

// ═══════════════════════════ MATERIALES ANIMADOS ═══════════════════════════
const PH = `
  #ifdef USE_INSTANCING
  float iph = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453) * 6.2831853;
  #else
  float iph = 0.0;
  #endif`
const matCache = new Map()
function pMat(kind) {
  if (matCache.has(kind)) return matCache.get(kind)
  const additive = kind === 'ray' || kind === 'motes' || kind === 'bubbles'
  const m = additive
    ? new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })
    : new THREE.MeshLambertMaterial({ vertexColors: true })
  m.defines = { P_KIND: { solid: 0, soft: 0, sway: 1, school: 2, bubbles: 3, motes: 4, ray: 5, neon: 6 }[kind] }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPTime = P_TIME
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPTime;\nattribute float aPhase;\nvarying float vPFade;\nvarying vec3 vPLocal;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${PH}
        vPFade = 1.0;
        vPLocal = position;
        #if P_KIND == 1
          float hh = max(transformed.y, 0.0);
          transformed.x += sin(uPTime * 1.3 + iph) * 0.09 * hh * hh;
          transformed.z += cos(uPTime * 1.05 + iph * 1.7) * 0.06 * hh * hh;
        #elif P_KIND == 2
          float ang = uPTime * 0.42 + iph;
          float ca = cos(ang), sa = sin(ang);
          vec3 p = transformed;
          p.x += sin(uPTime * 9.0 + atan(p.z, p.x) * 11.0) * 0.012;
          transformed = vec3(ca * p.x + sa * p.z, p.y + sin(uPTime * 1.4 + atan(p.z, p.x) * 2.0) * 0.12, -sa * p.x + ca * p.z);
        #elif P_KIND == 3
          float k = fract(aPhase + uPTime * 0.22 + iph * 0.1);
          transformed.y += k * 3.0;
          transformed.x += sin(k * 18.0 + aPhase * 30.0) * 0.08;
          transformed.xz *= 1.0;
          vPFade = smoothstep(0.0, 0.1, k) * (1.0 - smoothstep(0.75, 1.0, k));
        #elif P_KIND == 4
          transformed.x += sin(uPTime * 0.7 + aPhase * 3.0 + iph) * 0.35;
          transformed.y += sin(uPTime * 0.9 + aPhase * 5.0) * 0.25;
          transformed.z += cos(uPTime * 0.6 + aPhase * 4.0 + iph) * 0.35;
          vPFade = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(uPTime * 2.6 + aPhase * 7.0 + iph), 3.0);
        #elif P_KIND == 5
          vPFade = 0.55 + 0.45 * sin(uPTime * 0.6 + iph);
        #endif`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        #if P_KIND >= 3 && P_KIND <= 5
          vPFade *= smoothstep(1.5, 7.0, -mvPosition.z);
        #endif`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPTime;\nvarying float vPFade;\nvarying vec3 vPLocal;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        #if P_KIND == 3
          diffuseColor.a *= 0.55 * vPFade;
        #elif P_KIND == 4
          diffuseColor.rgb *= 1.6;
          diffuseColor.a *= vPFade;
        #elif P_KIND == 5
          float side = 1.0 - smoothstep(0.0, 0.11, abs(vPLocal.x) + abs(vPLocal.z));
          diffuseColor.a *= 0.16 * vPFade * pow(vPLocal.y, 1.4) * (1.0 - smoothstep(0.85, 1.0, vPLocal.y)) * (0.4 + 0.6 * side);
        #endif`)
    if (kind === 'neon') {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float band = smoothstep(0.9, 0.97, fract(vPLocal.y * 9.0 - uPTime * 0.4));
        float edge = smoothstep(0.155, 0.17, max(abs(vPLocal.x), abs(vPLocal.z)));
        vec3 nc = mix(vec3(0.17, 1.0, 0.91), vec3(1.0, 0.17, 0.84), 0.5 + 0.5 * sin(vPLocal.y * 3.0 + uPTime));
        totalEmissiveRadiance += nc * (band * 1.2 + edge * 0.9) + diffuseColor.rgb * 0.35;`)
    } else if (!additive) {
      // Relleno suave para que no queden negros a contraluz.
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * ${kind === 'school' ? '0.55' : kind === 'soft' ? '0.5' : '0.22'};`)
    }
  }
  m.customProgramCacheKey = () => `paisaje-v1:${kind}`
  matCache.set(kind, markShared(m))
  return m
}

// Agua animada (mar): olas en vértices, cáusticas, espuma en la orilla y transparencia leve.
let _waterMat = null
function waterMat() {
  if (_waterMat) return _waterMat
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uPTime = P_TIME
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uPTime;\nvarying vec2 vWUv;\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vWUv = uv;
        float wv = sin(position.x * 0.45 + uPTime * 1.6) * 0.5 + sin(position.z * 0.38 - uPTime * 1.2) * 0.35 + sin((position.x + position.z) * 0.9 + uPTime * 2.3) * 0.15;
        transformed += normal * wv * 0.22 * smoothstep(0.0, 0.25, uv.x);
        vWPos = position;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uPTime;\nvarying vec2 vWUv;\nvarying vec3 vWPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec3 shallow = vec3(0.05, 0.62, 0.7);
        vec3 deep = vec3(0.01, 0.12, 0.32);
        vec3 wc = mix(shallow, deep, smoothstep(0.05, 0.9, vWUv.x));
        vec2 q = vWPos.xz * 0.55;
        float c1 = sin(q.x + uPTime * 1.1 + sin(q.y * 1.3 + uPTime * 0.7) * 1.6);
        float c2 = sin(q.y * 1.2 - uPTime * 0.9 + sin(q.x * 1.1 - uPTime * 0.5) * 1.4);
        float caus = pow(1.0 - abs(c1 * c2), 6.0);
        float foam = 1.0 - smoothstep(0.0, 0.08 + 0.03 * sin(vWUv.y * 3.0 + uPTime * 2.0), vWUv.x);
        diffuseColor.rgb = wc + vec3(0.55, 0.95, 1.0) * caus * 0.6 + vec3(0.9) * foam * 0.7;
        diffuseColor.a = mix(0.62, 0.9, smoothstep(0.1, 0.8, vWUv.x)) + foam * 0.2;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * 0.25;`)
  }
  m.customProgramCacheKey = () => 'paisaje-agua-v1'
  _waterMat = markShared(m)
  return _waterMat
}

export function paisajeWarmup() {
  return [pMat('solid'), pMat('soft'), pMat('sway'), pMat('school'), pMat('bubbles'), pMat('motes'), pMat('ray'), pMat('neon'), waterMat()]
}

// ═══════════════════════════ CATÁLOGO POR TEMA ═══════════════════════════
// ax: rango lateral en múltiplos de TERR desde el borde del bordillo; y: altura sobre el firme (u);
// scale en u; foot: radio de huella relativo a la escala; cap: tope de instancias visibles.
const PAISAJE = {
  bosque: {
    layers: [
      { geo: 'oak', mat: 'sway', step: 8, ax: [1.0, 3.2], scale: [6.5, 10.5], foot: 0.32, both: 0.8, cap: 90, range: 100, tints: ['#ffffff', '#e8f0d0', '#f4e6c0', '#d6e8d0'], ground: true },
      { geo: 'fir', mat: 'sway', step: 12, ax: [1.6, 3.6], scale: [7.5, 12], foot: 0.25, both: 0.6, cap: 60, range: 100, tints: ['#ffffff', '#dfe9e0'], ground: true },
      { geo: 'fern', mat: 'sway', step: 3.2, ax: [0.15, 0.95], scale: [2.2, 3.6], foot: 0.25, both: 0.75, cap: 160, range: 55, tints: ['#ffffff', '#d8efb0', '#f0e6a8'], berm: true },
      { geo: 'mossRock', mat: 'solid', step: 9, ax: [0.3, 1.1], scale: [1.3, 2.6], foot: 0.5, both: 0.4, cap: 70, range: 60, tints: ['#ffffff', '#d8d4c8'], berm: true },
      { geo: 'shrooms', mat: 'solid', step: 11, ax: [0.2, 0.9], scale: [2.6, 4.0], foot: 0.25, both: 0.3, cap: 50, range: 50, berm: true },
      { geo: 'ray', mat: 'ray', step: 16, ax: [0.6, 2.4], scale: [12, 18], y: [-0.5, 0.2], foot: 0, both: 0.5, cap: 40, range: 90, tints: ['#fff2b8', '#e9ffc0'], tilt: 0.35, noClear: true },
      { geo: 'motes', mat: 'motes', step: 7, ax: [-0.6, 1.4], scale: [2.6, 4.2], y: [0.4, 2.2], foot: 0, both: 0.7, cap: 70, range: 70, tints: ['#d4ff5a', '#fff07a', '#a8ff78'], noClear: true },
    ],
  },
  mar: {
    water: { y: 0.12, w: 13 },
    layers: [
      { geo: 'reef', mat: 'soft', step: 6.5, ax: [0.25, 2.6], scale: [2.2, 4.4], foot: 0.4, both: 0.85, cap: 140, range: 75, tints: ['#ffffff', '#ffe0ec', '#e0f4ff', '#fff0d0'], berm: true },
      { geo: 'kelp', mat: 'sway', step: 4.5, ax: [0.6, 3.0], scale: [3.5, 7.5], foot: 0.15, both: 0.7, cap: 120, range: 70, tints: ['#ffffff', '#c8ffe8', '#e8ffd0'], berm: true },
      { geo: 'school', mat: 'school', step: 18, ax: [-0.5, 1.5], scale: [6, 9], y: [1.6, 4.2], foot: 0, both: 0.5, cap: 30, range: 90, noClear: true, tints: ['#ffffff'] },
      { geo: 'bubbles', mat: 'bubbles', step: 8, ax: [0.2, 2.4], scale: [1.6, 2.6], y: [0.0, 0.3], foot: 0, both: 0.6, cap: 60, range: 60, tints: ['#bff6ff', '#e6fdff'], noClear: true },
      { geo: 'motes', mat: 'motes', step: 10, ax: [-0.5, 1.6], scale: [3.5, 5.5], y: [0.8, 3.2], foot: 0, both: 0.6, cap: 50, range: 60, tints: ['#9ff4ff', '#d6fffb'], noClear: true },
      { geo: 'ray', mat: 'ray', step: 18, ax: [0.4, 2.2], scale: [12, 17], y: [-0.4, 0.2], foot: 0, both: 0.5, cap: 30, range: 90, tints: ['#9fe9ff', '#c4fff6'], tilt: 0.28, noClear: true },
    ],
  },
  neon: {
    layers: [
      { geo: 'datatower', mat: 'neon', step: 8, ax: [0.9, 3.0], scale: [5, 11], foot: 0.2, both: 0.8, cap: 90, range: 95, ground: true },
      { geo: 'motes', mat: 'motes', step: 8, ax: [-0.5, 1.8], scale: [3, 5], y: [0.6, 3.4], foot: 0, both: 0.7, cap: 60, range: 70, tints: ['#2bffe8', '#ff2bd6', '#fff22b'], noClear: true },
      { geo: 'ray', mat: 'ray', step: 14, ax: [0.6, 2.4], scale: [10, 15], y: [-0.4, 0.1], foot: 0, both: 0.5, cap: 34, range: 90, tints: ['#ff2bd6', '#2bffe8'], tilt: 0.0, noClear: true },
    ],
  },
  nubes: {
    layers: [
      { geo: 'cumulus', mat: 'soft', step: 9, ax: [0.6, 3.0], scale: [3.5, 7], y: [-1.6, 0.2], foot: 0.4, both: 0.8, cap: 90, range: 90, tints: ['#ffffff', '#fff3e0', '#f0eaff'] },
      { geo: 'ray', mat: 'ray', step: 15, ax: [0.6, 2.4], scale: [12, 18], y: [-0.6, 0.2], foot: 0, both: 0.5, cap: 34, range: 90, tints: ['#fff4c8', '#ffe1f0'], tilt: 0.3, noClear: true },
      { geo: 'motes', mat: 'motes', step: 9, ax: [-0.5, 1.8], scale: [3, 5], y: [0.6, 3.4], foot: 0, both: 0.6, cap: 50, range: 70, tints: ['#fff2a8', '#ffffff', '#ffd6eb'], noClear: true },
    ],
  },
}

// ═══════════════════════════ CONSTRUCCIÓN POR TRAMO ═══════════════════════════
const segCache = new WeakMap()
const F0 = {}
const _cand = new THREE.Vector3()
const _top = new THREE.Vector3()
const Q_YAW = new THREE.Quaternion()
const Q_TILT = new THREE.Quaternion()
const X_AXIS = new THREE.Vector3(1, 0, 0)

function buildWater(way, seg, spec, col) {
  const pos = []; const nrm = []; const uv = []; const idx = []
  const L = Math.max(seg.length ?? 1, 1)
  const n = Math.max(6, Math.ceil(L / 3.2))
  const cross = 6
  for (const lane of lanesOf(seg)) {
    const E = halfWidth(lane) + CURB
    for (const sg of [-1, 1]) {
      let run = 0
      for (let i = 0; i <= n; i++) {
        const u = i / n
        const f = surfFrame(seg, lane.id, u, F0)
        _cand.copy(f.pos).addScaledVector(f.side, sg * (E + TERR + spec.w * 0.5))
        if (!laneSideClear(seg, lane, u, _cand, TERR * 0.6) || (col && !col.libre(_cand, 0.6, { way: way.idx }))) { run = 0; continue }
        const base = pos.length / 3
        for (let j = 0; j < cross; j++) {
          const t = j / (cross - 1)
          const lat = sg * (E + TERR * 0.55 + t * spec.w)
          const y = spec.y - t * 0.15
          pos.push(f.pos.x + f.side.x * lat + f.up.x * y, f.pos.y + f.side.y * lat + f.up.y * y, f.pos.z + f.side.z * lat + f.up.z * y)
          nrm.push(f.up.x, f.up.y, f.up.z)
          uv.push(t, u * L * 0.1)
        }
        if (run > 0) {
          const p0 = base - cross
          for (let j = 0; j < cross - 1; j++) idx.push(p0 + j, base + j, p0 + j + 1, p0 + j + 1, base + j, base + j + 1)
        }
        run++
      }
    }
  }
  if (!idx.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  g.computeBoundingSphere()
  g.name = 'paisaje:agua'
  return markShared(g)
}

function buildSeg(way, seg, si, spec) {
  if (segCache.has(seg)) return segCache.get(seg)
  const rng = mulberry32(5303 + way.idx * 419 + si * 61)
  const world = mundoDe(way)
  const col = world ? colisionDe(world) : null
  const local = nuevoLocal()
  const L = Math.max(seg.length ?? 1, 1)
  const lanes = lanesOf(seg)
  const layers = spec.layers.map(() => [])
  spec.layers.forEach((ly, li) => {
    const tints = (ly.tints ?? ['#ffffff']).map((h) => new THREE.Color(h))
    for (const lane of lanes) {
      const E = halfWidth(lane) + CURB
      const busy = (seg.switches ?? []).filter((w) => w.from === lane.id || w.to === lane.id).map((w) => w.u * L)
      for (let s = 2 + rng() * ly.step; s < L - 2; s += ly.step * (0.7 + rng() * 0.6)) {
        if (!ly.noClear && busy.some((b) => Math.abs(b - s) < 5)) continue
        const u = s / L
        const f = surfFrame(seg, lane.id, u, F0)
        const first = rng() < 0.5 ? -1 : 1
        for (const sg of [first, -first]) {
          const sc = ly.scale[0] + rng() * (ly.scale[1] - ly.scale[0])
          const foot = sc * (ly.foot ?? 0.3)
          const ax = E + TERR * (ly.ax[0] + rng() * (ly.ax[1] - ly.ax[0])) + foot
          const latAbs = Math.abs(ax)
          let y = ly.y ? ly.y[0] + rng() * (ly.y[1] - ly.y[0]) : -0.1
          if (ly.berm) y = latAbs < E + TERR ? bermY(latAbs, E) - 0.06 : -0.25
          _cand.copy(f.pos).addScaledVector(f.side, sg * ax).addScaledVector(f.up, y)
          const r = Math.max(0.3, foot)
          if (!ly.noClear) {
            if (!laneSideClear(seg, lane, u, _cand, Math.max(0.5, r * 0.6))) continue
            if (ly.ground) {
              // La copa/alto tampoco puede invadir otro carril (carriles apilados o en otra pared).
              _top.copy(_cand).addScaledVector(f.up, sc * 0.55)
              if (!laneSideClear(seg, lane, u, _top, sc * 0.45)) continue
              _top.copy(_cand).addScaledVector(f.up, sc)
              if (!laneSideClear(seg, lane, u, _top, sc * 0.35)) continue
            }
            if (col && !col.libre(_cand, r * 0.8, { way: way.idx })) continue
            if (!local.libre(_cand, r)) continue
            local.add(_cand, r)
          } else if (!laneSideClear(seg, lane, u, _cand, 0.2)) continue
          const quat = basisQuat(f.up, f.tangent)
          quat.multiply(Q_YAW.setFromAxisAngle(Y_AXIS, ly.geo === 'school' ? 0 : rng() * TAU))
          if (ly.tilt) quat.multiply(Q_TILT.setFromAxisAngle(X_AXIS, ly.tilt * sg))
          layers[li].push({ pos: _cand.clone(), quat, scale: sc, color: tints[Math.floor(rng() * tints.length)] })
          if (rng() > (ly.both ?? 0.5)) break
        }
      }
    }
  })
  const out = { layers, water: spec.water ? buildWater(way, seg, spec.water, col) : null }
  segCache.set(seg, out)
  return out
}

// ═══════════════════════════ COMPONENTE ═══════════════════════════
export default function Paisaje({ way, detail, focused, time }) {
  const themeId = way.theme?.id
  const spec = PAISAJE[themeId]
  if (!spec) return null
  return <PaisajeTema way={way} detail={detail} focused={focused} time={time} spec={spec} />
}

function PaisajeTema({ way, detail, focused, time, spec }) {
  const nonAirSegs = useMemo(() => (way.segments ?? []).map((seg, si) => ({ seg, si })).filter((x) => !x.seg.air), [way])
  const waySphere = useMemo(() => getWayBoundingSphere(way, 18 * TRACK_K), [way])
  const meshes = useMemo(() => spec.layers.map((ly) => {
    const m = new THREE.InstancedMesh(getGeo(ly.geo), pMat(ly.mat), ly.cap)
    m.count = 0
    m.userData.noCull = true
    m.boundingSphere = waySphere
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    const w = new THREE.Color('#ffffff')
    for (let i = 0; i < ly.cap; i++) m.setColorAt(i, w)
    if (ly.mat === 'ray' || ly.mat === 'motes' || ly.mat === 'bubbles') m.renderOrder = 3
    return m
  }), [spec, waySphere])
  useEffect(() => () => meshes.forEach((m) => m.dispose()), [meshes])

  const [waterList, setWaterList] = useState([])
  const waterKey = useRef('')
  const groupRef = useRef()
  const nearRef = useRef([])
  const lastSeg = useRef(new THREE.Vector3(Infinity, 0, 0))
  const lastCam = useRef(new THREE.Vector3(Infinity, 0, 0))
  const lastFwd = useRef(new THREE.Vector3())
  const dirty = useRef(true)
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), s: new THREE.Vector3(), d: new THREE.Vector3(), f: new THREE.Vector3() }), [])
  const camera = useThree((s) => s.camera)

  useFrame(({ clock }) => {
    P_TIME.value = time ? time.value : clock.elapsedTime
    const det = detail ? detail.value : 1
    const show = det >= (focused ? 0.2 : 0.45)
    if (groupRef.current) groupRef.current.visible = show
    if (!show) return
    const cam = camera.position
    let segChanged = false
    if (cam.distanceToSquared(lastSeg.current) >= 100) {
      lastSeg.current.copy(cam)
      const near = []
      for (const x of nonAirSegs) {
        const lim = SEG_ACTIVE_DIST + Math.min(130, x.seg.length * 0.2)
        if (minSegDistSq(x.seg, cam) <= lim * lim) near.push(x)
      }
      nearRef.current = near
      segChanged = true
      dirty.current = true
    }
    let built = false
    for (const { seg, si } of nearRef.current) {
      if (!segCache.has(seg)) { buildSeg(way, seg, si, spec); built = true; break }
    }
    if (built) dirty.current = true
    if ((segChanged || built) && spec.water) {
      const list = nearRef.current.map(({ seg, si }) => ({ si, geo: segCache.get(seg)?.water })).filter((x) => x.geo)
      const key = list.map((x) => x.si).join(',')
      if (key !== waterKey.current) { waterKey.current = key; setWaterList(list) }
    }
    camera.getWorldDirection(tmp.f)
    if (!dirty.current && cam.distanceToSquared(lastCam.current) < MOVE_RECOMPACT_SQ && tmp.f.dot(lastFwd.current) > 0.97) return
    dirty.current = false
    lastCam.current.copy(cam)
    lastFwd.current.copy(tmp.f)
    spec.layers.forEach((ly, li) => {
      const mesh = meshes[li]
      const r2 = ly.range * ly.range
      let n = 0
      for (const { seg } of nearRef.current) {
        const sd = segCache.get(seg)
        if (!sd) continue
        const list = sd.layers[li]
        for (let i = 0; i < list.length && n < ly.cap; i++) {
          const it = list[i]
          tmp.d.copy(it.pos).sub(cam)
          const d2 = tmp.d.lengthSq()
          if (d2 > r2 || (d2 > 400 && tmp.d.dot(tmp.f) < -16)) continue
          tmp.s.setScalar(it.scale)
          mesh.setMatrixAt(n, tmp.m.compose(it.pos, it.quat, tmp.s))
          mesh.setColorAt(n, it.color)
          n++
        }
      }
      mesh.count = n
      if (n) {
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
    })
  })

  const wMat = spec.water ? waterMat() : null
  return (
    <group ref={groupRef}>
      {meshes.map((m, i) => <primitive key={i} object={m} />)}
      {wMat && waterList.map((w) => <mesh key={w.si} geometry={w.geo} material={wMat} renderOrder={2} />)}
    </group>
  )
}
