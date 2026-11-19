// Pista de carreras de cada camino: una cinta de carretera ABIERTA por carril (calzada lisa y libre,
// bordillos del tema, berma de terreno a los lados y una quilla de roca debajo, como isla flotante),
// construida solo desde laneFrame(segment, laneId, u): así cada camino sigue su propia orientación y
// gravedad (de cabeza, de lado, tirabuzón) sin depender de cómo el núcleo lo calcule. Una malla fusionada
// por camino; la decoración (decor.jsx) y los eventos de cambio (eventos.jsx) se apoyan en el mismo perfil.
import { useEffect, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as WORLD from '../../../Core/world.js'
import { applyLoadedImage } from '../texUtils.js'
import { TRI_TIME, themeFx } from '../triplanar.js'
import { BALL_R, markShared } from './base.jsx'
import Anillos, { anillosWarmup } from './anillos.jsx'
import Decor from './decor.jsx'
import Estructuras, { estructurasWarmup } from './estructuras.jsx'
import Eventos, { eventosWarmup } from './eventos.jsx'
import KartPista from './kartPista.jsx'
import Paisaje, { paisajeWarmup } from './paisaje.jsx'
import Precompilado from '../Precompilado.jsx'
import { useEtapa } from './etapas.js'

// Bandas de la sección en U (las mismas que TRACK_U de tools/assets/generate_textures.py).
const TRACK_U = [0.16, 0.26, 0.74, 0.84]
const TRACK_TILE = 4 // unidades de mundo por repetición de la textura en V
const TRACK_K = WORLD.TRACK_K
export const CURB = 0.17 * TRACK_K
export const TERR = 0.55 * TRACK_K // conserva la proporción con el ancho del carril
const STEP = 1.5 * TRACK_K // conserva la densidad de geometría por camino
const CHEV_K = 0.12 / TRACK_K // umbral de curvatura expresado en las unidades escaladas

// Colores por tema: asfalto, bordillo A/B, pintura, terreno de la berma y roca de la quilla.
export const PISTA = {
  sombrio: { asfalto: '#2b2538', a: '#a24bff', b: '#e8dcff', linea: '#d9c8ff', terreno: '#3a2759', roca: '#1d1530', mec: '#c08cff', chev: '#ffd36b' },
  bosque: { asfalto: '#3a3a35', a: '#e53935', b: '#f5f5ef', linea: '#f6f2c8', terreno: '#3f8f3a', roca: '#5a4636', mec: '#ffd54f', chev: '#ffd54f' },
  mar: { asfalto: '#8a6a4c', a: '#ff8a65', b: '#eefcff', linea: '#fff4d6', terreno: '#cdb98a', roca: '#6a5a4c', mec: '#4dd0e1', chev: '#ffd166' },
  desierto: { asfalto: '#5b4733', a: '#d84315', b: '#fff3d6', linea: '#ffe9b0', terreno: '#d9a95b', roca: '#9a5b32', mec: '#ffb74d', chev: '#fff3d6' },
  hielo: { asfalto: '#566d80', a: '#2f80ed', b: '#ffffff', linea: '#e8f6ff', terreno: '#dcefff', roca: '#7fa3c4', mec: '#7fd6ff', chev: '#ff6b8a' },
  volcan: { asfalto: '#2b2220', a: '#ff5a1f', b: '#ffd166', linea: '#ffcc80', terreno: '#4a2c22', roca: '#24140f', mec: '#ff3d00', chev: '#ffd166' },
  cristal: { asfalto: '#383d5a', a: '#7df9ff', b: '#ff7de9', linea: '#ece6ff', terreno: '#8a7ad6', roca: '#3b2f78', mec: '#a78bff', chev: '#7df9ff' },
  nubes: { asfalto: '#8790b5', a: '#ff9ecf', b: '#ffffff', linea: '#ffffff', terreno: '#eef1ff', roca: '#c9d0f2', mec: '#ffd54f', chev: '#ff9ecf' },
  neon: { asfalto: '#16141f', a: '#ff2bd6', b: '#2bffe8', linea: '#2bffe8', terreno: '#1c2233', roca: '#0d0f1a', mec: '#ff2bd6', chev: '#2bffe8' },
  jardin: { asfalto: '#4a3f3a', a: '#ff88c2', b: '#fff7e0', linea: '#fff2c2', terreno: '#6fbf5a', roca: '#6b5240', mec: '#ffd27a', chev: '#ff88c2' },
}
export const pal = (id) => PISTA[id] ?? PISTA.neon

/** Marco de la SUPERFICIE del carril: pos sobre el firme (la ballita va BALL_R más arriba). */
export function surfFrame(seg, laneId, u, out = {}) {
  WORLD.laneFrame(seg, laneId, u, out)
  out.pos.addScaledVector(out.up, -BALL_R)
  return out
}
export const lanesOf = (seg) => (seg.air ? [] : seg.lanes ?? [])
export const halfWidth = (lane) => (lane?.width ?? BALL_R * 2.6) / 2

const F_SIDE_CHK = {}
/** True si `pos` guarda al menos `minClear` desde el bordillo de cualquier otro carril del tramo en `u`. */
export function laneSideClear(seg, lane, u, pos, minClear) {
  const lanes = lanesOf(seg)
  for (let i = 0; i < lanes.length; i++) {
    const other = lanes[i]
    if (other.id === lane.id) continue
    const fo = surfFrame(seg, other.id, u, F_SIDE_CHK)
    const need = halfWidth(other) + CURB + minClear
    if (pos.distanceToSquared(fo.pos) < need * need) return false
  }
  return true
}

/** Altura relativa de la berma respecto a `pos` del carril según distancia lateral `ax` y borde `E`. */
export function bermY(ax, E) {
  const t = Math.max(0, Math.min(1, (ax - E) / TERR))
  return t < 0.5 ? 0.025 + (0.06 - 0.025) * (t / 0.5) : 0.06 - 0.22 * ((t - 0.5) / 0.5)
}

// ─────────────────────────── texturas (generate_textures.py --pista) ───────────────────────────
const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const THEME_TEX = {
  sombrio: 'terreno_tierra_oscura.webp',
  bosque: 'terreno_musgo.webp',
  mar: 'terreno_arena.webp',
  desierto: 'terreno_arena.webp',
  hielo: 'terreno_hielo_agrietado.webp',
  volcan: 'terreno_lava.webp',
  cristal: 'terreno_cristal.webp',
  nubes: 'terreno_nube.webp',
  neon: 'carrera_circuito_neon.webp',
  jardin: 'terreno_pasto.webp',
}
const texCache = new Map()
function trackTex(file, fallback, opts = true) {
  const { repeatS = false, repeatT = true, srgb = false } = typeof opts === 'boolean' ? { repeatT: opts } : opts
  const key = `${file}|${repeatS}|${repeatT}|${srgb}`
  if (texCache.has(key)) return texCache.get(key)
  // Lienzo 1×1 de reserva (no DataTexture: esa ruta de subida no acepta luego una imagen)
  const c = document.createElement('canvas'); c.width = c.height = 1
  const cx = c.getContext('2d'); cx.fillStyle = `rgb(${fallback[0]},${fallback[1]},${fallback[2]})`; cx.fillRect(0, 0, 1, 1)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.wrapS = repeatS ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  new THREE.TextureLoader().load(BASE_TEX + file, (t) => applyLoadedImage(tex, t.image))
  markShared(tex)
  texCache.set(key, tex)
  return tex
}

// ─────────────────────────── material de pista (uno por tema, compartido) ───────────────────────────
const TRACK_TIME = { value: 0 }
const matCache = new Map()
function trackMat(themeId) {
  if (matCache.has(themeId)) return matCache.get(themeId)
  const P = pal(themeId)
  const fx = themeFx(themeId)
  const isNeon = themeId === 'neon'
  // Lambert: enlace del shader y relleno mucho más baratos que Standard; para asfalto mate basta.
  const m = new THREE.MeshLambertMaterial({
    color: '#ffffff', side: THREE.DoubleSide,
    normalMap: trackTex('track_normal.png', [128, 128, 255, 255]), normalScale: new THREE.Vector2(0.45, 0.45),
  })
  const U = {
    uLayout: { value: trackTex('track_layout.png', [225, 0, 0, 255]) },
    uAsfaltoTex: { value: trackTex('carrera_asfalto.webp', [55, 55, 62], { repeatS: true, repeatT: true, srgb: true }) },
    uTemaTex: { value: trackTex(THEME_TEX[themeId] ?? 'terreno_pasto.webp', [128, 128, 128], { repeatS: true, repeatT: true, srgb: true }) },
    uTemaMix: { value: isNeon ? 0.55 : 0.3 },
    uAsfalto: { value: new THREE.Color(P.asfalto) },
    uA: { value: new THREE.Color(P.a) },
    uB: { value: new THREE.Color(P.b) },
    uLinea: { value: new THREE.Color(P.linea) },
    uTerreno: { value: new THREE.Color(P.terreno) },
    uRoca: { value: new THREE.Color(P.roca) },
    uChev: { value: new THREE.Color(P.chev) },
    uTrackTime: TRACK_TIME,
    uThemeMode: { value: fx.mode },
    uFxC1: { value: new THREE.Color(fx.c1) },
    uFxC2: { value: new THREE.Color(fx.c2) },
    uFxFog: { value: new THREE.Color(fx.fog) },
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aChev;\nattribute float aUnder;\nvarying vec2 vTrackUv;\nvarying float vChev;\nvarying float vUnder;\nvarying vec3 vTrackWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrackUv = uv;\nvChev = aChev;\nvUnder = aUnder;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvTrackWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uLayout; uniform sampler2D uAsfaltoTex; uniform sampler2D uTemaTex;
        uniform float uTemaMix; uniform float uTrackTime; uniform float uThemeMode;
        uniform vec3 uAsfalto; uniform vec3 uA; uniform vec3 uB; uniform vec3 uLinea; uniform vec3 uTerreno; uniform vec3 uRoca; uniform vec3 uChev;
        uniform vec3 uFxC1; uniform vec3 uFxC2; uniform vec3 uFxFog;
        varying vec2 vTrackUv; varying float vChev; varying float vUnder; varying vec3 vTrackWPos;
        vec3 sampleCropped(sampler2D tex, vec2 p) {
          vec2 uv = 0.15 + fract(p) * 0.70;
          #if __VERSION__ >= 300
          return textureGrad(tex, uv, dFdx(p) * 0.70, dFdy(p) * 0.70).rgb;
          #else
          return texture2D(tex, uv).rgb;
          #endif
        }`)
      .replace('#include <map_fragment>', `
        vec3 L = texture2D(uLayout, vTrackUv).rgb;
        vec2 asfUv = vec2(vTrackUv.x * 1.4 + 0.17, vTrackUv.y * 0.75);
        vec2 terUv = vec2(vTrackUv.x * 1.6 + 0.31, vTrackUv.y * 0.85);
        vec3 asfTex = sampleCropped(uAsfaltoTex, asfUv);
        vec3 temaTex = sampleCropped(uTemaTex, terUv);
        float x = vTrackUv.x;
        float fw = max(fwidth(x), 1e-4);
        float top = 1.0 - step(0.001, vUnder);
        float inner = top * smoothstep(${TRACK_U[0]} - fw, ${TRACK_U[0]} + fw, x) * (1.0 - smoothstep(${TRACK_U[3]} - fw, ${TRACK_U[3]} + fw, x));
        float asf = top * smoothstep(${TRACK_U[1]} - fw, ${TRACK_U[1]} + fw, x) * (1.0 - smoothstep(${TRACK_U[2]} - fw, ${TRACK_U[2]} + fw, x));
        float curb = inner - asf;
        vec3 asfPure = uAsfalto * (0.45 + asfTex * 1.45);
        vec3 asfBase = mix(asfPure, asfPure * 0.55 + temaTex * 0.55, uTemaMix * 0.45);
        vec3 col = asfBase * mix(0.86, 1.06, L.r);
        if (abs(uThemeMode - 1.0) < 0.1) {
          // Mar: pasarela de tablones mojados (juntas oscuras, tono por tablón y brillo húmedo).
          float pk = vTrackUv.y * 1.9;
          float pl = fract(pk);
          float gap = smoothstep(0.0, 0.06, pl) * smoothstep(1.0, 0.94, pl);
          float tone = 0.82 + 0.3 * fract(sin(floor(pk) * 12.9898) * 43758.5453);
          float grain = 0.88 + 0.12 * sin(x * 140.0 + floor(pk) * 7.0 + sin(vTrackUv.y * 30.0));
          col = mix(col, uAsfalto * tone * grain * (0.7 + 0.6 * asfTex.r) * mix(0.3, 1.0, gap), asf);
        }
        col = mix(col, mix(uB, uA, L.g), curb);
        vec3 terr = mix(uTerreno * 0.6, temaTex * (0.55 + uTerreno * 0.6), 0.78) * mix(0.84, 1.08, L.r);
        terr = mix(terr, uRoca * mix(0.7, 1.15, L.r), smoothstep(0.0, 0.6, vUnder));
        col = mix(terr, col, inner);
        col = mix(col, uLinea, L.b * asf * 0.65);
        // flechas (chevrones) antes de curvas cerradas, apuntando hacia dentro de la curva
        float ca = abs(vChev);
        if (ca > 0.01) {
          float ax = clamp((x - ${TRACK_U[1]}) / ${TRACK_U[2] - TRACK_U[1]}, 0.0, 1.0);
          ax = vChev > 0.0 ? ax : 1.0 - ax;
          float d = abs(fract(vTrackUv.y * 1.5) - 0.5);
          float c = fract(ax * 2.2 - d * 1.6);
          float chev = smoothstep(0.52, 0.56, c) * (1.0 - smoothstep(0.86, 0.9, c)) * smoothstep(0.02, 0.12, ax) * smoothstep(0.98, 0.88, ax);
          col = mix(col, uChev, chev * asf * smoothstep(0.0, 0.5, ca) * 0.85);
        }
        diffuseColor.rgb *= col;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float _t = uTrackTime;
        vec3 _wp = vTrackWPos;
        vec3 _tfx = vec3(0.0);
        float _bermMask = (1.0 - smoothstep(${TRACK_U[0]} - 0.02, ${TRACK_U[0]} + 0.02, vTrackUv.x) * (1.0 - smoothstep(${TRACK_U[3]} - 0.02, ${TRACK_U[3]} + 0.02, vTrackUv.x))) * (1.0 - smoothstep(0.0, 0.25, vUnder));
        if (uThemeMode < 0.5) {
          float dap = 0.5 + 0.5 * sin(_wp.x * 0.22 + _t * 0.65) * cos(_wp.z * 0.22 - _t * 0.5);
          _tfx = uFxC1 * (dap * 0.08 * (1.0 - vUnder));
        } else if (uThemeMode < 1.5) {
          float ca = pow(0.5 + 0.5 * sin(_wp.x * 0.42 + _t * 1.7 + sin(_wp.z * 0.32 - _t)), 3.0) * (0.5 + 0.5 * cos(_wp.z * 0.38 - _t * 1.3));
          _tfx = mix(uFxC2, uFxC1, ca) * (ca * 0.36 * (1.0 - vUnder * 0.6));
        } else if (uThemeMode < 2.5) {
          float rip = pow(0.5 + 0.5 * sin(vTrackUv.y * 1.2 + _t * 0.9), 2.0);
          _tfx = uFxC1 * (rip * 0.08 * _bermMask);
        } else if (uThemeMode < 3.5) {
          float au = smoothstep(0.32, 0.95, 0.5 + 0.5 * sin(_wp.x * 0.09 + _wp.z * 0.11 + _t * 1.1));
          _tfx = mix(uFxC2, uFxC1, au) * (au * 0.22 * (1.0 - vUnder * 0.5));
        } else if (uThemeMode < 4.5) {
          float lv = pow(0.5 + 0.5 * sin(vTrackUv.y * 1.8 - _t * 2.2 + sin(_wp.x * 0.35)), 4.0);
          _tfx = mix(uFxC1, uFxC2, lv) * (lv * (0.12 + 0.48 * _bermMask));
        } else if (uThemeMode < 5.5) {
          vec3 irid = 0.5 + 0.5 * cos(6.28318 * (vTrackUv.x * 1.3 + _t * 0.16 + (_wp.x + _wp.z) * 0.03 + vec3(0.0, 0.33, 0.67)));
          _tfx = mix(uFxC1, irid, 0.7) * (0.12 + 0.14 * _bermMask);
        } else if (uThemeMode < 6.5) {
          float gld = 0.5 + 0.5 * sin(vTrackUv.y * 0.8 + _t * 0.8);
          _tfx = mix(uFxC2, uFxC1, gld) * (0.12 * (1.0 - vUnder * 0.5));
        } else if (uThemeMode < 7.5) {
          float swp = pow(max(0.0, sin(vTrackUv.y * 0.6 - _t * 3.4)), 7.0);
          float edge = smoothstep(0.02, 0.0, abs(vTrackUv.x - ${TRACK_U[1]})) + smoothstep(0.02, 0.0, abs(vTrackUv.x - ${TRACK_U[2]}));
          _tfx = mix(uFxC1, uFxC2, 0.5 + 0.5 * sin(vTrackUv.y * 0.25 + _t)) * (swp * 0.42 + edge * 0.28 * (1.0 - vUnder));
        } else if (uThemeMode < 8.5) {
          _tfx = mix(uFxC1, uFxC2, 0.5 + 0.5 * sin(_wp.x * 0.25 + _t)) * (0.09 * _bermMask);
        } else {
          float mist = smoothstep(0.25, 0.9, 0.5 + 0.5 * sin(_wp.x * 0.14 - _t * 0.8 + cos(_wp.z * 0.16 + _t * 0.5)));
          _tfx = mix(uFxC2, uFxC1, mist) * (mist * 0.22 * (0.4 + 0.6 * _bermMask));
        }
        float _distFog = smoothstep(55.0, 175.0, length(vViewPosition)) * 0.42;
        totalEmissiveRadiance += diffuseColor.rgb * mix(0.24, 0.1, vUnder) + _tfx + uFxFog * _distFog;`)
  }
  m.customProgramCacheKey = () => 'pista-v6'
  markShared(m)
  matCache.set(themeId, m)
  return m
}

// ─────────────────────────── geometría de pista ───────────────────────────
// Perfil (x lateral, y hacia "arriba" del carril): berma, bordillo, calzada, bordillo, berma y quilla.
function profile(H) {
  const E = H + CURB
  const top = [
    [-(E + TERR), -0.08, 0], [-(E + TERR * 0.5), 0.025, 0.08], [-E, 0.025, TRACK_U[0]], [-H, 0.02, TRACK_U[1]],
    [0, 0, 0.5],
    [H, 0.02, TRACK_U[2]], [E, 0.025, TRACK_U[3]], [E + TERR * 0.5, 0.025, 0.92], [E + TERR, -0.08, 1],
  ]
  return { top, keelX: E + 0.12 }
}
const RING = 12

const F0 = {}
// Generador: cede cada pocas muestras para que la precarga reparta una tira larga entre cuadros (una tira entera
// llegaba a 15-30 ms). Mismo resultado: solo se interrumpe al final de una muestra, sin marcos a medias.
function* pushLaneStrip(seg, lane, out) {
  const L = seg.length
  const H = halfWidth(lane)
  const { top, keelX } = profile(H)
  const n = Math.max(4, Math.ceil(L / STEP))
  const base = out.pos.length / 3
  const Ts = []; const Ss = []
  const salt = lane.id * 3.7 + seg.length * 0.013
  for (let i = 0; i <= n; i++) {
    if (i % 12 === 11) yield
    const u = i / n
    const f = surfFrame(seg, lane.id, u, F0)
    Ts.push(f.tangent.clone()); Ss.push(f.side.clone())
    const s = u * L
    const k = 1 + 0.35 * Math.sin(s * 0.37 + salt) + 0.2 * Math.sin(s * 1.13 + salt * 2)
    const ring = [...top, [keelX, -0.28 * k, 1], [0, -0.48 * k, 0.5], [-keelX, -0.28 * k, 0]]
    for (let j = 0; j < RING; j++) {
      const [x, y, ux] = ring[j]
      out.pos.push(
        f.pos.x + f.side.x * x + f.up.x * y,
        f.pos.y + f.side.y * x + f.up.y * y,
        f.pos.z + f.side.z * x + f.up.z * y,
      )
      out.uv.push(ux, s / TRACK_TILE)
      out.under.push(j >= top.length ? 1 : 0)
    }
  }
  // flechas: curvatura por diferencias de la tangente ya muestreada, vista unos metros por delante
  const ds = L / n
  const kAt = (i) => {
    const a = Math.max(0, i - 1); const b = Math.min(n, i + 1)
    const d = Ts[b].clone().sub(Ts[a]); return { k: d.length() / ((b - a) * ds), d }
  }
  for (let i = 0; i <= n; i++) {
    let c = 0
    if (kAt(i).k < CHEV_K * 0.8) {
      let best = 0; let bd = null
      for (const m of [2.5, 5, 8]) {
        const j = i + Math.round(m / ds)
        if (j > n) break
        const q = kAt(j)
        if (q.k > best) { best = q.k; bd = q.d }
      }
      const w = THREE.MathUtils.smoothstep(best, CHEV_K, CHEV_K * 1.4)
      if (w > 0) { const sgn = bd.dot(Ss[i]); c = Math.abs(sgn) < 1e-4 ? 0 : w * Math.sign(sgn) }
    }
    for (let j = 0; j < RING; j++) out.chev.push(c)
  }
  const i0 = out.idx.length
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < RING; j++) {
      const a = base + i * RING + j; const b = base + i * RING + ((j + 1) % RING)
      out.idx.push(a, a + RING, b, b, a + RING, b + RING)
    }
  }
  // Normales por tira (las tiras no comparten vértices): igual que computeVertexNormals, sin pagarlo de golpe al final.
  const P = out.pos; const N = out.nrm; const I = out.idx
  for (let v = N.length; v < P.length; v++) N.push(0)
  for (let t = i0; t < I.length; t += 3) {
    const a = I[t] * 3; const b = I[t + 1] * 3; const c = I[t + 2] * 3
    const e1x = P[c] - P[b]; const e1y = P[c + 1] - P[b + 1]; const e1z = P[c + 2] - P[b + 2]
    const e2x = P[a] - P[b]; const e2y = P[a + 1] - P[b + 1]; const e2z = P[a + 2] - P[b + 2]
    const nx = e1y * e2z - e1z * e2y; const ny = e1z * e2x - e1x * e2z; const nz = e1x * e2y - e1y * e2x
    for (const o of [a, b, c]) { N[o] += nx; N[o + 1] += ny; N[o + 2] += nz }
  }
  for (let o = base * 3; o < N.length; o += 3) {
    const l = Math.hypot(N[o], N[o + 1], N[o + 2]) || 1
    N[o] /= l; N[o + 1] /= l; N[o + 2] /= l
  }
}

const geoCache = new WeakMap()
const pendiente = new WeakMap() // way -> { out, strips, k }: construcción a medias, repartida en huecos libres

/** Avanza la pista de `way` tira a tira hasta que `agotado()` diga basta; true cuando quedó en caché.
 *  Así el mapa la precalcula en huecos libres y montar la vista Ballita/Camino no la construye en un cuadro. */
export function trackGeoPaso(way, agotado) {
  if (geoCache.has(way)) return true
  let st = pendiente.get(way)
  if (!st) {
    st = { out: { pos: [], nrm: [], uv: [], chev: [], under: [], idx: [] }, strips: [], k: 0, gen: null }
    for (const seg of way.segments) for (const lane of lanesOf(seg)) st.strips.push([seg, lane])
    pendiente.set(way, st)
  }
  while (st.gen || st.k < st.strips.length) {
    if (!st.gen) { const [seg, lane] = st.strips[st.k++]; st.gen = pushLaneStrip(seg, lane, st.out) }
    if (st.gen.next().done) st.gen = null
    if (agotado()) return false
  }
  // cajas del raycast por trozos (ver raycastPista), también repartidas
  st.cajas ??= []
  const P = st.out.pos; const I = st.out.idx
  for (let s = st.cajas.length * TROZO; s < I.length; s += TROZO) {
    let x0 = Infinity; let y0 = Infinity; let z0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let z1 = -Infinity
    for (let i = s, e = Math.min(I.length, s + TROZO); i < e; i++) {
      const v = I[i] * 3; const x = P[v]; const y = P[v + 1]; const z = P[v + 2]
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z
    }
    st.cajas.push(new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1)))
    if (agotado()) return false
  }
  pendiente.delete(way)
  cerrarGeo(way, st.out, st.cajas)
  return true
}

const NUNCA = () => false
export function trackGeo(way) {
  if (!geoCache.has(way)) trackGeoPaso(way, NUNCA)
  return geoCache.get(way)
}

function cerrarGeo(way, out, cajas) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2))
  g.setAttribute('aChev', new THREE.Float32BufferAttribute(out.chev, 1))
  g.setAttribute('aUnder', new THREE.Float32BufferAttribute(out.under, 1))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nrm, 3))
  g.setIndex(out.idx)
  g.computeBoundingSphere()
  g.name = 'pista:' + way.idx
  markShared(g) // en caché por camino: se reutiliza al volver a entrar
  geoCache.set(way, g)
  if (cajas) cajasCache.set(g, cajas)
}

// ─────────────────────────── raycast por trozos ───────────────────────────
// La colisión de cámara (Scene.jsx, CameraRig) lanza un rayo contra las mallas `pista:` cada 3 cuadros, y Mesh.raycast
// recorre TODOS los triángulos del camino (10-30 ms por rayo, un cuadro > 50 ms cada ~100 ms en la vista Ballita).
// Caché de cajas por trozo de índices: el rayo solo prueba los trozos cuya caja cruza, con el raycast original de three
// limitado a ese trozo (drawRange), así que las intersecciones son exactamente las mismas.
const TROZO = 512 * 3 // índices por trozo (512 triángulos)
const cajasCache = new WeakMap()
const _vc = new THREE.Vector3()
function cajasDe(g) {
  let cajas = cajasCache.get(g)
  if (cajas) return cajas
  const idx = g.index; const p = g.attributes.position
  if (!idx || !p) return null
  cajas = []
  for (let s = 0; s < idx.count; s += TROZO) {
    const b = new THREE.Box3()
    const e = Math.min(idx.count, s + TROZO)
    for (let i = s; i < e; i++) b.expandByPoint(_vc.fromBufferAttribute(p, idx.getX(i)))
    cajas.push(b)
  }
  cajasCache.set(g, cajas)
  return cajas
}
const _inv = new THREE.Matrix4()
const _rayL = new THREE.Ray()
const _sph = new THREE.Sphere()
const _hit = new THREE.Vector3()
function raycastPista(raycaster, intersects) {
  const g = this.geometry
  const cajas = cajasDe(g)
  const dr = g.drawRange
  if (!cajas || dr.start !== 0 || dr.count !== Infinity) { THREE.Mesh.prototype.raycast.call(this, raycaster, intersects); return }
  if (g.boundingSphere === null) g.computeBoundingSphere()
  _sph.copy(g.boundingSphere).applyMatrix4(this.matrixWorld)
  if (!raycaster.ray.intersectsSphere(_sph)) return
  _inv.copy(this.matrixWorld).invert()
  _rayL.copy(raycaster.ray).applyMatrix4(_inv)
  try {
    for (let k = 0; k < cajas.length; k++) {
      const b = cajas[k]
      if (!b.containsPoint(_rayL.origin)) { // desde fuera: la entrada a la caja es el punto más cercano posible
        if (!_rayL.intersectBox(b, _hit)) continue
        if (_hit.applyMatrix4(this.matrixWorld).distanceTo(raycaster.ray.origin) > raycaster.far) continue
      }
      dr.start = k * TROZO
      dr.count = TROZO
      THREE.Mesh.prototype.raycast.call(this, raycaster, intersects)
    }
  } finally {
    dr.start = 0
    dr.count = Infinity
  }
}

/** Mallas mínimas con los materiales de la pista, para compilar y enlazar sus programas antes de la
 *  primera entrada (todos los temas comparten programa: solo cambian uniforms). */
export function pistaWarmup(extra = []) {
  const g = new THREE.Group()
  const tiny = new THREE.PlaneGeometry(0.01, 0.01)
  tiny.setAttribute('aChev', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  tiny.setAttribute('aUnder', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  tiny.setAttribute('aPhase', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  tiny.setAttribute('aTint', new THREE.Float32BufferAttribute(new Array(12).fill(1), 3))
  tiny.setAttribute('color', new THREE.Float32BufferAttribute(new Array(12).fill(1), 3))
  g.add(new THREE.Mesh(tiny, trackMat('neon')))
  for (const mat of [...eventosWarmup(), ...anillosWarmup(), ...estructurasWarmup(), ...paisajeWarmup(), ...extra]) {
    const im = new THREE.InstancedMesh(tiny, mat, 1)
    im.setColorAt(0, new THREE.Color('#ffffff'))
    g.add(im)
  }
  return g
}

const BASE_FOG_COLOR = new THREE.Color('#050711')

function TemaAtmosfera({ focused, themeId }) {
  const fx = useMemo(() => themeFx(themeId), [themeId])
  const fogTarget = useMemo(() => new THREE.Color(fx.fog), [fx])
  const scene = useThree((s) => s.scene)

  useEffect(() => () => {
    if (scene.fog) scene.fog.color.copy(BASE_FOG_COLOR)
  }, [scene, focused])

  useFrame((_, dt) => {
    if (focused && scene.fog) scene.fog.color.lerp(fogTarget, Math.min(1, dt * 3.5))
  })

  return null
}

export default function Pista({ way, detail, focused, time }) {
  const geo = geoCache.get(way)
  const [, listo] = useState(0)
  // Sin precalcular aún: se termina en porciones de ~6 ms por cuadro y aparece al estar lista (entra volando).
  useEffect(() => {
    if (geoCache.has(way)) return undefined
    let raf = 0
    const paso = () => {
      const t0 = performance.now()
      if (trackGeoPaso(way, () => performance.now() - t0 > 6)) listo((n) => n + 1)
      else raf = requestAnimationFrame(paso)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [way])
  useFrame(({ clock }) => {
    const t = time ? time.value : clock.elapsedTime
    TRI_TIME.value = t
    TRACK_TIME.value = t
  })
  const mat = useMemo(() => trackMat(way.theme.id), [way])
  // Cada capa se monta cuando la precarga (vida/precarga.js) ya calculó sus datos, y entra oculta hasta tener sus
  // programas enlazados: montarla antes los construía de golpe dentro del render (cientos de ms por capa).
  const kart = useEtapa(way, 'kart')
  const anillos = useEtapa(way, 'anillos')
  const decor = useEtapa(way, 'decor')
  const eventos = useEtapa(way, 'eventos')
  return (
    <>
      <TemaAtmosfera focused={focused} themeId={way.theme?.id} />
      {geo && <mesh geometry={geo} material={mat} receiveShadow raycast={raycastPista} />}
      {kart && <Precompilado><KartPista way={way} /></Precompilado>}
      {anillos && <Precompilado><Anillos way={way} /></Precompilado>}
      {decor && <Precompilado><Decor way={way} focused={focused} /></Precompilado>}
      <Estructuras way={way} detail={detail} focused={focused} time={time} />
      <Paisaje way={way} detail={detail} focused={focused} time={time} />
      {eventos && <Precompilado><Eventos way={way} /></Precompilado>}
    </>
  )
}
