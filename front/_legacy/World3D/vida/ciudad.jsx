// Mini ciudad-hábitat de cada camino: complementa al módulo del tema (lo monta index.js junto a él).
// Ocupa la cara interior ENTRE carriles (nunca su cauce): manzanas con rascacielos de ventanas emisivas,
// parques, grúas, rótulos de neón, vapor bajo y, en cada `switch`, el mecanismo de cambio de carril como
// pieza urbana: autopista que se enrosca por la pared ('pared'), rampa + pista de aterrizaje con estela
// de luces ('salto') o par de puertas ('portal'), con torre-elevador y rótulos de "por dónde sigue".
// Presupuesto: ~11 draw calls por camino, todo instanciado o fusionado; materiales y kit compartidos.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { laneAngle, MECHANISMS, THEME_MECHS, LANE_NAMES } from '../../../Core/world.js'
import {
  TAU, cityStyle, makeWallBase, markShared, mulberry32, useInstanced, wallBaseInto, wallDirInto, wallPlaceInto,
} from './base.jsx'

const ROW = 0.95 // fondo de manzana a lo largo del tubo
const LOT = 0.5 // ancho de lote sobre la pared
const MAX_B = 2400
const MAX_T = 900
const MAX_S = 260
const LANE_COL = ['#ffd24a', '#4fe3ff', '#ff5fd2', '#7affb2'] // suelo, pared der., techo, pared izq.
const Y = new THREE.Vector3(0, 1, 0)
const FLIP = new THREE.Quaternion().setFromAxisAngle(Y, Math.PI)
const LAY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2)
const wrapPi = (x) => ((x + Math.PI) % TAU + TAU) % TAU - Math.PI
const mod = (x) => ((x % TAU) + TAU) % TAU

// ═══════════════════════════ KIT DE PIEZAS (compartido) ═══════════════════════════
function tint(g, hex) {
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}
function merge(parts) {
  const flat = parts.map((p) => (p.index ? p.toNonIndexed() : p))
  const g = mergeGeometries(flat, false)
  parts.forEach((p) => p.dispose())
  flat.forEach((p) => p.dispose())
  return g
}
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)

let KIT = null
function kit() {
  if (KIT) return KIT
  KIT = markShared({
    // edificios: base en y = 0, altura 1 (la escala de instancia da w, h, d)
    box: box(1, 1, 1, 0, 0.5, 0),
    cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 12, 1).translate(0, 0.5, 0),
    step: merge([
      box(1, 0.55, 1, 0, 0.275, 0), box(0.74, 0.3, 0.74, 0, 0.7, 0), box(0.48, 0.15, 0.48, 0, 0.925, 0),
      new THREE.CylinderGeometry(0.025, 0.04, 0.22, 6).translate(0, 1.11, 0),
    ]),
    // props con color de vértice (× color de instancia)
    tree: merge([
      tint(new THREE.CylinderGeometry(0.05, 0.07, 0.42, 6).translate(0, 0.21, 0), '#6b5040'),
      tint(new THREE.IcosahedronGeometry(0.3, 1).translate(0, 0.66, 0), '#ffffff'),
    ]),
    crane: merge([
      tint(box(0.07, 1, 0.07, 0, 0.5, 0), '#ffffff'),
      tint(box(0.9, 0.05, 0.06, 0.25, 0.97, 0), '#ffffff'),
      tint(box(0.16, 0.1, 0.1, -0.17, 0.93, 0), '#9aa0aa'),
      tint(box(0.012, 0.32, 0.012, 0.6, 0.78, 0), '#666a70'),
    ]),
    tower: merge([
      tint(new THREE.CylinderGeometry(0.16, 0.2, 1, 12).translate(0, 0.5, 0), '#f4f7fb'),
      tint(new THREE.TorusGeometry(0.19, 0.025, 6, 16).rotateX(Math.PI / 2).translate(0, 0.32, 0), '#9fdcff'),
      tint(new THREE.TorusGeometry(0.19, 0.025, 6, 16).rotateX(Math.PI / 2).translate(0, 0.64, 0), '#9fdcff'),
      tint(new THREE.CylinderGeometry(0.27, 0.27, 0.05, 14).translate(0, 1.0, 0), '#ffffff'),
    ]),
    pad: new THREE.TorusGeometry(1, 0.07, 8, 32),
    dot: new THREE.IcosahedronGeometry(1, 1),
    sign: new THREE.PlaneGeometry(2, 1).translate(0, 0.5, 0),
  })
  return KIT
}

// ═══════════════════════════ ATLAS DE RÓTULOS (por tema, cacheado) ═══════════════════════════
// 4×4 celdas de 256×128: 0 nombre del camino, 1-3 marcas, 4-6 mecanismos del tema, 7 genérico,
// 8-11 "▶ <carril>", 12 salida, 13 pantalla, 14 meta, 15 hábitat.
function cellUv(c) {
  return [(c % 4) * 0.25, 1 - (Math.floor(c / 4) + 1) * 0.25]
}
function buildAtlas(id, name) {
  const S = cityStyle(id)
  const mechs = Object.entries(THEME_MECHS[id] ?? {})
  const texts = [
    name, ...S.brands.slice(0, 3),
    ...[0, 1, 2].map((i) => (mechs[i] ? `${MECHANISMS[mechs[i][0]]?.emoji ?? ''} ${mechs[i][1]}` : '⇄ CAMBIO')),
    '⇄ CAMBIO',
    ...LANE_NAMES.map((l) => `▶ ${l.toUpperCase()}`),
    'SALIDA ▶', null, '◀ META', `HÁBITAT ${S.brands[0]}`,
  ]
  const mechCell = {}
  mechs.forEach(([k], i) => { if (i < 3) mechCell[k] = 4 + i })
  let tex
  if (typeof document === 'undefined') {
    tex = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  } else {
    const c = document.createElement('canvas')
    c.width = 1024; c.height = 512
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, 1024, 512)
    texts.forEach((t, i) => {
      const x = (i % 4) * 256; const y = Math.floor(i / 4) * 128
      ctx.save()
      ctx.beginPath()
      ctx.roundRect(x + 8, y + 10, 240, 108, 18)
      if (t == null) { // pantalla publicitaria: bandas de color del tema
        const g = ctx.createLinearGradient(x, y, x + 256, y + 128)
        g.addColorStop(0, S.neon); g.addColorStop(0.5, '#10142a'); g.addColorStop(1, S.win)
        ctx.fillStyle = g
        ctx.fill()
        ctx.globalAlpha = 0.35
        ctx.fillStyle = '#000'
        for (let k = 0; k < 12; k++) ctx.fillRect(x + 8, y + 12 + k * 9, 240, 3)
        ctx.restore()
        return
      }
      ctx.fillStyle = 'rgba(8,10,22,0.92)'
      ctx.fill()
      ctx.shadowColor = S.neon
      ctx.shadowBlur = 14
      ctx.lineWidth = 5
      ctx.strokeStyle = S.neon
      ctx.stroke()
      let size = 46
      ctx.font = `bold ${size}px system-ui, sans-serif`
      // El ancho escala casi lineal con el tamaño: se salta al tamaño estimado (par) y el bucle solo afina.
      const w46 = ctx.measureText(t).width
      if (w46 > 216) {
        size = Math.max(16, Math.min(44, 2 * Math.floor((46 * 216) / w46 / 2) + 2))
        ctx.font = `bold ${size}px system-ui, sans-serif`
      }
      while (size > 16 && ctx.measureText(t).width > 216) {
        size -= 2
        ctx.font = `bold ${size}px system-ui, sans-serif`
      }
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = '#ffffff'
      ctx.fillText(t, x + 128, y + 66)
      ctx.restore()
    })
    tex = new THREE.CanvasTexture(c)
    tex.anisotropy = 4
  }
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  markShared(tex)
  return { tex, mechCell }
}

let VAPOR_TEX = null
function vaporTex() {
  if (VAPOR_TEX) return VAPOR_TEX
  if (typeof document === 'undefined') {
    VAPOR_TEX = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  } else {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
    g.addColorStop(0, 'rgba(255,255,255,0.8)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.3)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
    VAPOR_TEX = new THREE.CanvasTexture(c)
  }
  VAPOR_TEX.needsUpdate = true
  return markShared(VAPOR_TEX)
}

// ═══════════════════════════ MATERIALES (por tema, cacheados) ═══════════════════════════
const matCache = new Map()
function cityMats(id, name, time) {
  let m = matCache.get(id)
  if (m) return m
  const S = cityStyle(id)
  const atlas = buildAtlas(id, name)

  // Fachadas: ventanas emisivas procedurales en espacio local escalado (sin texturas ni UV por pieza).
  const bld = new THREE.MeshStandardMaterial({ roughness: 0.48, metalness: 0.18 })
  const uWin = { value: new THREE.Color(S.win) }
  bld.onBeforeCompile = (sh) => {
    sh.uniforms.uWin = uWin
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBL;\nvarying vec3 vBN;\nvarying float vBSeed;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 bSc = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
vBL = position * bSc;
vBN = normal;
vBSeed = dot(instanceMatrix[3].xyz, vec3(0.131, 0.717, 0.373));`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uWin;\nvarying vec3 vBL;\nvarying vec3 vBN;\nvarying float vBSeed;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float cWall = 1.0 - step(0.6, abs(vBN.y));
vec2 cG = vec2((vBL.x + vBL.z) / 0.07, vBL.y / 0.08);
vec2 cId = floor(cG);
vec2 cF = fract(cG);
float cWin = step(0.2, cF.x) * step(cF.x, 0.8) * step(0.25, cF.y) * step(cF.y, 0.75) * cWall * step(0.05, vBL.y);
float cH = fract(sin(dot(cId + vec2(floor(vBSeed * 37.0), floor(vBSeed * 11.0)), vec2(12.9898, 78.233))) * 43758.5453);
vec3 cWc = mix(uWin, vec3(1.0, 0.84, 0.6), fract(cH * 7.31));
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.06, 0.08, 0.12), cWin * 0.75);
diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 0.3, vBL.y));
totalEmissiveRadiance += cWc * step(0.45, cH) * cWin * 1.4;`)
  }
  bld.customProgramCacheKey = () => 'ciudad-bld-v1'

  const props = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05 })

  // Suelo: colores de vértice > 1 brillan (lava, calles láser).
  const ground = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0, side: THREE.DoubleSide })
  ground.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_COLOR
float gHot = max(vColor.r, max(vColor.g, vColor.b));
totalEmissiveRadiance += vColor.rgb * smoothstep(1.02, 1.5, gHot) * 0.6;
#endif`)
  }
  ground.customProgramCacheKey = () => 'ciudad-ground-v1'

  const glow = new THREE.MeshBasicMaterial({ toneMapped: false })

  // Mecanismos: bordes blancos y calzada con chevrones del color del carril destino, fluyendo.
  const mech = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide })
  mech.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vMk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMk = uv;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vMk;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float mDeck = step(0.1, vMk.y) * step(vMk.y, 0.9);
float mCh = fract(vMk.x * 1.4 - abs(vMk.y - 0.5) * 0.9 - uTime * 1.8);
float mCv = smoothstep(0.0, 0.08, mCh) * (1.0 - smoothstep(0.32, 0.42, mCh));
#ifdef USE_COLOR
totalEmissiveRadiance += vColor.rgb * mDeck * (0.25 + mCv * 1.6);
#endif
diffuseColor.rgb = mix(vec3(0.95, 0.96, 0.98), diffuseColor.rgb * 0.35, mDeck);`)
  }
  mech.customProgramCacheKey = () => 'ciudad-mech-v1'

  const sign = new THREE.MeshBasicMaterial({
    map: atlas.tex, transparent: true, alphaTest: 0.05, side: THREE.DoubleSide, toneMapped: false,
  })
  sign.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aCell;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv = uv * 0.25 + aCell;\n#endif')
  }
  sign.customProgramCacheKey = () => 'ciudad-sign-v1'

  const vapor = new THREE.PointsMaterial({
    map: vaporTex(), size: 1.3, sizeAttenuation: true, transparent: true, opacity: 0.3, depthWrite: false,
    color: id === 'volcan' ? '#8a7a74' : '#ffffff',
  })

  m = markShared({ bld, props, ground, glow, mech, sign, vapor })
  m.mechCell = atlas.mechCell
  matCache.set(id, m)
  return m
}

// ═══════════════════════════ CONSTRUCCIÓN DE LA CIUDAD ═══════════════════════════
// Huecos libres entre carriles en `u`: [{ a0, a1 }] con margen de un carril + acera.
function laneGaps(seg, u, R) {
  const ls = seg.lanes.map((l) => ({ a: mod(laneAngle(seg, l.id, u)), h: ((l.width || 1.3) * 0.5 + 0.22) / R }))
    .sort((x, y) => x.a - y.a)
  const out = []
  for (let i = 0; i < ls.length; i++) {
    const cur = ls[i]
    const nxt = ls[(i + 1) % ls.length]
    const a0 = cur.a + cur.h
    const a1 = nxt.a + (i + 1 >= ls.length ? TAU : 0) - nxt.h
    if (a1 > a0) out.push({ a0, a1 })
  }
  return out
}

// ¿El ángulo `a` en `u` cae en el corredor de algún mecanismo? (se deja libre de edificios)
function blocked(seg, u, a) {
  const L = seg.length
  for (const sw of seg.switches ?? []) {
    const pad = 0.8 / L
    if (u < sw.u - pad || u > (sw.uEnd ?? sw.u) + pad) continue
    const af = laneAngle(seg, sw.from, u)
    const delta = wrapPi(laneAngle(seg, sw.to, u) - af)
    const x = wrapPi(a - af) * (Math.sign(delta) || 1)
    if (x > -0.15 && x < Math.abs(delta) + 0.15) return true
  }
  return false
}

const KIT_BIAS = { cyber: 0.45, prisma: 0.45, aguja: 0.5, cristal: 0.4 }

function buildCity(way, mechCell) {
  const id = way.theme.id
  const S = cityStyle(id)
  const rng = mulberry32(way.idx * 7717 + 23)
  const out = { box: [], cyl: [], step: [], trees: [], cranes: [], towers: [], pads: [], dots: [], signs: [] }
  const gr = { pos: [], nor: [], col: [], idx: [] }
  const mk = { pos: [], nor: [], col: [], uv: [], idx: [] }
  const vapor = []
  const B = makeWallBase(); const B0 = makeWallBase(); const B1 = makeWallBase()
  const P = new THREE.Vector3(); const Q = new THREE.Quaternion(); const D = new THREE.Vector3(); const U = new THREE.Vector3()
  const tmp = new THREE.Vector3()
  const facades = S.facade.map((c) => new THREE.Color(c))
  const cStreet = new THREE.Color(S.ground[0])
  const cPark = new THREE.Color(S.ground[1])
  const cSpecial = new THREE.Color(S.ground[2])
  const hotStreets = S.kit === 'forja' || S.kit === 'cyber'
  if (hotStreets) cSpecial.multiplyScalar(1.6)
  const cLot = cStreet.clone().lerp(new THREE.Color('#ffffff'), 0.18)
  const treeCol = new THREE.Color(S.tree)
  const stepBias = KIT_BIAS[S.kit] ?? 0.2
  const vaporK = S.kit === 'nube' ? 2.5 : S.kit === 'forja' ? 1.8 : 1
  const craneK = S.kit === 'canal' ? 3 : 1
  const roofTrees = S.kit === 'arbol' || S.kit === 'jardin'
  let nB = 0

  const tile = (seg, a0, a1, rho, col) => {
    const v = gr.pos.length / 3
    for (const [BB, a] of [[B0, a0], [B1, a0], [B0, a1], [B1, a1]]) {
      wallDirInto(BB, a, D)
      P.copy(BB.axis).addScaledVector(D, rho)
      gr.pos.push(P.x, P.y, P.z); gr.nor.push(-D.x, -D.y, -D.z); gr.col.push(col.r, col.g, col.b)
    }
    // v: (u0,a0) v+1: (u1,a0) v+2: (u0,a1) v+3: (u1,a1); cara hacia el eje
    gr.idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2)
  }
  const place = (list, a, rho, sx, sy, sz, color, extraQ = null) => {
    wallPlaceInto(B, a, rho, P, Q)
    const q = Q.clone()
    if (extraQ) q.multiply(extraQ)
    list.push({ pos: P.clone(), quat: q, scale: [sx, sy, sz], color })
  }

  for (const seg of way.segments) {
    if (seg.air || !seg.lanes?.length) continue
    const R = seg.radius; const L = seg.length
    const rows = Math.max(2, Math.floor(L / ROW))
    const hMax = Math.min(R * 0.42, 1.3) * S.tall
    const Rg = R * 0.992
    for (let r = 0; r < rows && nB < MAX_B; r++) {
      const u0 = r / rows; const u1 = (r + 1) / rows; const uc = (r + 0.5) / rows
      if (uc < 0.02 || uc > 0.98) continue
      wallBaseInto(seg, u0, B0); wallBaseInto(seg, u1, B1); wallBaseInto(seg, uc, B)
      const street = r % 6 === 5
      for (const gp of laneGaps(seg, uc, R)) {
        const span = gp.a1 - gp.a0
        const arc = span * R
        if (arc < LOT * 0.8) continue
        const n = Math.max(1, Math.floor(arc / LOT))
        for (let k = 0; k < n; k++) {
          const la0 = gp.a0 + (k / n) * span; const la1 = gp.a0 + ((k + 1) / n) * span
          const ac = (la0 + la1) * 0.5
          if (street || blocked(seg, uc, ac)) {
            tile(seg, la0, la1, Rg, street && S.kit !== 'nube' ? cSpecial : cStreet)
            if (rng() < 0.05 * vaporK && vapor.length < 1200) {
              wallDirInto(B, ac, D)
              P.copy(B.axis).addScaledVector(D, R - 0.25 - rng() * 0.25)
              vapor.push(P.x, P.y, P.z)
            }
            continue
          }
          const centerness = 1 - Math.abs((2 * (k + 0.5)) / n - 1)
          if (rng() < S.park) {
            tile(seg, la0, la1, Rg * 0.999, cPark)
            for (let t = 0; t < 2 && out.trees.length < MAX_T; t++) {
              const s = (0.35 + rng() * 0.3) * (S.kit === 'arbol' ? 1.5 : 1)
              place(out.trees, la0 + (0.2 + rng() * 0.6) * (la1 - la0), Rg, s, s, s, treeCol)
            }
            continue
          }
          tile(seg, la0, la1, Rg, cLot)
          const w = Math.min((arc / n) * 0.8, 0.62)
          const dd = ROW * (0.6 + rng() * 0.2)
          const h = hMax * (0.16 + 0.84 * Math.pow(centerness, 1.2) * (0.3 + 0.7 * rng()))
          const pick = rng()
          const kind = pick < stepBias ? 'step' : pick < stepBias + 0.2 ? 'cyl' : 'box'
          const col = facades[Math.floor(rng() * facades.length)]
          place(out[kind], ac, Rg, w, kind === 'step' ? h / 1.22 : h, kind === 'cyl' ? w : dd, col)
          nB++
          wallDirInto(B, ac, D)
          U.copy(D).negate()
          const topPos = tmp.copy(out[kind][out[kind].length - 1].pos).addScaledVector(U, h)
          if (h > hMax * 0.55 && out.signs.length < MAX_S && rng() < (S.kit === 'cyber' ? 0.3 : 0.14)) {
            const q = out[kind][out[kind].length - 1].quat.clone().multiply(FLIP)
            const roll = rng()
            const cell = roll < 0.2 ? 0 : roll < 0.75 ? 1 + Math.floor(rng() * 3) : roll < 0.9 ? 13 : 15
            out.signs.push({ pos: topPos.clone(), quat: q, scale: [0.13, 0.13, 1], cell })
          } else if (h > hMax * 0.5 && rng() < 0.04 * craneK) {
            const s = hMax * 0.7
            out.cranes.push({ pos: topPos.clone(), quat: out[kind][out[kind].length - 1].quat.clone(), scale: [s, s, s], color: rng() < 0.5 ? '#ffd24a' : '#ffffff' })
          } else if (roofTrees && h < hMax * 0.45 && rng() < 0.5 && out.trees.length < MAX_T) {
            const s = 0.3 + rng() * 0.15
            out.trees.push({ pos: topPos.clone(), quat: out[kind][out[kind].length - 1].quat.clone(), scale: [s, s, s], color: treeCol })
          } else if (S.kit === 'forja' && rng() < 0.18) {
            out.dots.push({ pos: topPos.clone(), quat: Q.clone(), scale: [0.07, 0.07, 0.07], color: '#ff7a2f' })
            if (vapor.length < 1200) { tmp.addScaledVector(U, 0.3); vapor.push(tmp.x, tmp.y, tmp.z) }
          }
        }
      }
    }
    buildMechanisms(seg, mechCell, out, mk)
  }

  const ground = new THREE.BufferGeometry()
  ground.setAttribute('position', new THREE.Float32BufferAttribute(gr.pos, 3))
  ground.setAttribute('normal', new THREE.Float32BufferAttribute(gr.nor, 3))
  ground.setAttribute('color', new THREE.Float32BufferAttribute(gr.col, 3))
  ground.setIndex(gr.idx)
  ground.computeBoundingSphere()

  let mech = null
  if (mk.pos.length) {
    mech = new THREE.BufferGeometry()
    mech.setAttribute('position', new THREE.Float32BufferAttribute(mk.pos, 3))
    mech.setAttribute('normal', new THREE.Float32BufferAttribute(mk.nor, 3))
    mech.setAttribute('color', new THREE.Float32BufferAttribute(mk.col, 3))
    mech.setAttribute('uv', new THREE.Float32BufferAttribute(mk.uv, 2))
    mech.setIndex(mk.idx)
    mech.computeBoundingSphere()
  }
  let vap = null
  if (vapor.length) {
    vap = new THREE.BufferGeometry()
    vap.setAttribute('position', new THREE.Float32BufferAttribute(vapor, 3))
    vap.computeBoundingSphere()
  }
  return { ...out, ground: gr.pos.length ? ground : null, mech, vapor: vap }
}

// ─── Mecanismos de cambio de carril como piezas de la ciudad ───
const _mb = makeWallBase()
const _md = new THREE.Vector3(); const _mp = new THREE.Vector3(); const _ms = new THREE.Vector3(); const _mu = new THREE.Vector3()

// Cinta con bordes elevados: angleAt(t), rhoAt(t) sobre [uA, uB] del tramo.
function pushRibbon(mk, seg, uA, uB, angleAt, rhoAt, width, col, N = 20) {
  const v0 = mk.pos.length / 3
  for (let i = 0; i <= N; i++) {
    const t = i / N
    const uu = uA + (uB - uA) * t
    wallBaseInto(seg, uu, _mb)
    wallDirInto(_mb, angleAt(t, uu), _md)
    _mp.copy(_mb.axis).addScaledVector(_md, rhoAt(t))
    _mu.copy(_md).negate()
    _ms.crossVectors(_mb.T, _md).normalize()
    const s = uu * seg.length
    for (const [k, lift, v] of [[-0.5, 0.08, 0], [-0.42, 0, 0.12], [0.42, 0, 0.88], [0.5, 0.08, 1]]) {
      const x = _mp.x + _ms.x * width * k + _mu.x * lift
      const y = _mp.y + _ms.y * width * k + _mu.y * lift
      const z = _mp.z + _ms.z * width * k + _mu.z * lift
      mk.pos.push(x, y, z); mk.nor.push(_mu.x, _mu.y, _mu.z); mk.col.push(col.r, col.g, col.b); mk.uv.push(s, v)
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < 3; j++) {
      const a = v0 + i * 4 + j; const b = a + 4
      mk.idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
}

const ease = (t) => t * t * (3 - 2 * t)

function buildMechanisms(seg, mechCell, out, mk) {
  const R = seg.radius; const L = seg.length
  const stations = new Map()
  const P = new THREE.Vector3(); const Q = new THREE.Quaternion(); const B = makeWallBase(); const D = new THREE.Vector3()
  const P0 = new THREE.Vector3(); const P1 = new THREE.Vector3(); const C = new THREE.Vector3()
  for (const sw of seg.switches ?? []) {
    const col = new THREE.Color(LANE_COL[sw.to] ?? '#ffffff')
    const uA = sw.u
    const uB = Math.min(1, Math.max(sw.uEnd ?? sw.u, sw.u + 2.5 / L))
    const af = (uu) => laneAngle(seg, sw.from, uu)
    const at = (uu) => laneAngle(seg, sw.to, uu)
    const style = sw.style ?? MECHANISMS[sw.kind]?.style
    if (style === 'pared') {
      // autopista que se enrosca por la pared del carril origen al destino
      pushRibbon(mk, seg, uA, uB, (t, uu) => af(uu) + wrapPi(at(uu) - af(uu)) * ease(t), () => R * 0.985, 0.55, col)
    } else if (style === 'portal') {
      for (const [uu, a, c] of [[uA, af(uA), new THREE.Color(LANE_COL[sw.from] ?? '#ffffff')], [uB, at(uB), col]]) {
        wallBaseInto(seg, uu, B)
        wallPlaceInto(B, a, R - 0.55, P, Q)
        out.pads.push({ pos: P.clone(), quat: Q.clone(), scale: [0.72, 0.72, 0.72], color: c })
      }
    } else {
      // salto: rampa de despegue, estela de luces por el aire y pista de aterrizaje con aro
      const uK = Math.min(1, uA + 1.8 / L)
      pushRibbon(mk, seg, uA, uK, (t, uu) => af(uu), (t) => R * 0.985 - 0.32 * t * t, 0.55, col, 8)
      const uL = Math.max(uK, uB - 1.4 / L)
      pushRibbon(mk, seg, uL, uB, (t, uu) => at(uu), () => R * 0.985, 0.55, col, 6)
      wallBaseInto(seg, uK, B); wallDirInto(B, af(uK), D)
      P0.copy(B.axis).addScaledVector(D, R - 0.85)
      wallBaseInto(seg, uB, B); wallDirInto(B, at(uB), D)
      P1.copy(B.axis).addScaledVector(D, R - 0.5)
      wallBaseInto(seg, (uK + uB) * 0.5, B)
      C.copy(P0).lerp(P1, 0.5).lerp(B.axis, 0.45)
      for (let i = 1; i < 10; i++) {
        const t = i / 10; const it = 1 - t
        const pos = new THREE.Vector3()
          .copy(P0).multiplyScalar(it * it).addScaledVector(C, 2 * it * t).addScaledVector(P1, t * t)
        out.dots.push({ pos, scale: [0.055, 0.055, 0.055], color: col })
      }
      wallBaseInto(seg, uB, B)
      wallPlaceInto(B, at(uB), R * 0.97, P, Q)
      out.pads.push({ pos: P.clone(), quat: Q.clone().multiply(LAY), scale: [0.5, 0.5, 0.5], color: col })
    }
    // torre-elevador con baliza y rótulos: mecanismo + carril al que lleva
    const key = `${sw.from}:${sw.u}`
    const nth = stations.get(key) ?? 0
    stations.set(key, nth + 1)
    const uT = Math.max(0.01, uA - (1.0 + nth * 0.8) / L)
    wallBaseInto(seg, uT, B)
    const lane = seg.lanes.find((l) => l.id === sw.from)
    const dir = Math.sign(wrapPi(at(uT) - af(uT))) || 1
    const a = af(uT) + dir * (((lane?.width ?? 1.3) * 0.5 + 0.3) / R)
    const hT = R * 0.38
    wallPlaceInto(B, a, R * 0.992, P, Q)
    out.towers.push({ pos: P.clone(), quat: Q.clone(), scale: [1, hT, 1], color: '#ffffff' })
    wallDirInto(B, a, D)
    const top = P.clone().addScaledVector(D, -hT)
    out.dots.push({ pos: top.clone().addScaledVector(D, -0.06), scale: [0.08, 0.08, 0.08], color: col })
    if (out.signs.length < MAX_S + 120) {
      const q = Q.clone().multiply(FLIP)
      out.signs.push({ pos: top.clone().addScaledVector(D, -0.1), quat: q, scale: [0.16, 0.16, 1], cell: mechCell[sw.kind] ?? 7 })
      out.signs.push({ pos: top.clone().addScaledVector(D, -0.28), quat: q, scale: [0.14, 0.14, 1], cell: 8 + (sw.to % 4) })
    }
  }
}

function buildSignMesh(items, mat) {
  if (!items.length) return null
  const g = kit().sign.clone()
  const cells = new Float32Array(items.length * 2)
  const mesh = new THREE.InstancedMesh(g, mat, items.length)
  const m = new THREE.Matrix4(); const s = new THREE.Vector3()
  items.forEach((it, i) => {
    const [cu, cv] = cellUv(it.cell)
    cells[i * 2] = cu; cells[i * 2 + 1] = cv
    m.compose(it.pos, it.quat, s.set(it.scale[0], it.scale[1], it.scale[2]))
    mesh.setMatrixAt(i, m)
  })
  g.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

/** Capa de ciudad de un camino (mismo contrato que los módulos de tema). */
export default function Ciudad({ way, detail, time }) {
  const id = way.theme.id
  const K = kit()
  const mats = useMemo(() => cityMats(id, way.theme.name, time), [id, way.theme.name, time])
  const d = useMemo(() => buildCity(way, mats.mechCell), [way, mats])
  const groupRef = useRef()
  const boxes = useInstanced(K.box, mats.bld, d.box)
  const cyls = useInstanced(K.cyl, mats.bld, d.cyl)
  const steps = useInstanced(K.step, mats.bld, d.step)
  const trees = useInstanced(K.tree, mats.props, d.trees)
  const cranes = useInstanced(K.crane, mats.props, d.cranes)
  const towers = useInstanced(K.tower, mats.props, d.towers)
  const pads = useInstanced(K.pad, mats.glow, d.pads)
  const dots = useInstanced(K.dot, mats.glow, d.dots)
  const signs = useMemo(() => buildSignMesh(d.signs, mats.sign), [d, mats.sign])
  useEffect(() => () => {
    d.ground?.dispose()
    d.mech?.dispose()
    d.vapor?.dispose()
  }, [d])
  useEffect(() => () => {
    signs?.geometry.dispose()
    signs?.dispose()
  }, [signs])
  useFrame(() => {
    if (groupRef.current) groupRef.current.visible = (detail?.value ?? 1) > 0.03
  })
  return (
    <group ref={groupRef} visible={false}>
      {d.ground && <mesh geometry={d.ground} material={mats.ground} receiveShadow />}
      {d.mech && <mesh geometry={d.mech} material={mats.mech} />}
      {d.box.length > 0 && <primitive object={boxes} />}
      {d.cyl.length > 0 && <primitive object={cyls} />}
      {d.step.length > 0 && <primitive object={steps} />}
      {d.trees.length > 0 && <primitive object={trees} />}
      {d.cranes.length > 0 && <primitive object={cranes} />}
      {d.towers.length > 0 && <primitive object={towers} />}
      {d.pads.length > 0 && <primitive object={pads} />}
      {d.dots.length > 0 && <primitive object={dots} />}
      {signs && <primitive object={signs} />}
      {d.vapor && <points geometry={d.vapor} material={mats.vapor} />}
    </group>
  )
}
