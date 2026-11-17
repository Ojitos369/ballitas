// Pista de carreras de cada camino: una cinta de carretera ABIERTA por carril (calzada lisa y libre,
// bordillos del tema, berma de terreno a los lados y una quilla de roca debajo, como isla flotante),
// construida solo desde laneFrame(segment, laneId, u): así cada camino sigue su propia orientación y
// gravedad (de cabeza, de lado, tirabuzón) sin depender de cómo el núcleo lo calcule. Una malla fusionada
// por camino; la decoración (decor.jsx) y los eventos de cambio (eventos.jsx) se apoyan en el mismo perfil.
import { useMemo } from 'react'
import * as THREE from 'three'
import * as WORLD from '../../../Core/world.js'
import { applyLoadedImage } from '../texUtils.js'
import { BALL_R, markShared } from './base.jsx'
import Decor from './decor.jsx'
import Eventos, { eventosWarmup } from './eventos.jsx'

// Bandas de la sección en U (las mismas que TRACK_U de tools/assets/generate_textures.py).
const TRACK_U = [0.16, 0.26, 0.74, 0.84]
const TRACK_TILE = 4 // unidades de mundo por repetición de la textura en V
export const CURB = 0.17
export const TERR = 0.55 // berma estrecha: menos de media calzada por lado
const STEP = 1.5 // muestreo a lo largo del carril
const CHEV_K = 0.12 // curvatura (1/u) a partir de la cual una curva lleva flechas antes

// Colores por tema: asfalto, bordillo A/B, pintura, terreno de la berma y roca de la quilla.
export const PISTA = {
  sombrio: { asfalto: '#2b2538', a: '#a24bff', b: '#e8dcff', linea: '#d9c8ff', terreno: '#3a2759', roca: '#1d1530', mec: '#c08cff', chev: '#ffd36b' },
  bosque: { asfalto: '#3a3a35', a: '#e53935', b: '#f5f5ef', linea: '#f6f2c8', terreno: '#3f8f3a', roca: '#5a4636', mec: '#ffd54f', chev: '#ffd54f' },
  mar: { asfalto: '#2d4b5e', a: '#ff8a65', b: '#eefcff', linea: '#cff6ff', terreno: '#e3d2a2', roca: '#7a6a55', mec: '#4dd0e1', chev: '#ffd166' },
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

// ─────────────────────────── texturas (generate_textures.py --pista) ───────────────────────────
const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const texCache = new Map()
function trackTex(file, fallback, repeatT = true) {
  if (texCache.has(file)) return texCache.get(file)
  // Lienzo 1×1 de reserva (no DataTexture: esa ruta de subida no acepta luego una imagen)
  const c = document.createElement('canvas'); c.width = c.height = 1
  const cx = c.getContext('2d'); cx.fillStyle = `rgb(${fallback[0]},${fallback[1]},${fallback[2]})`; cx.fillRect(0, 0, 1, 1)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.NoColorSpace
  tex.wrapS = THREE.ClampToEdgeWrapping
  tex.wrapT = repeatT ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping
  tex.anisotropy = 8
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  new THREE.TextureLoader().load(BASE_TEX + file, (t) => applyLoadedImage(tex, t.image))
  markShared(tex)
  texCache.set(file, tex)
  return tex
}

// ─────────────────────────── material de pista (uno por tema, compartido) ───────────────────────────
const matCache = new Map()
function trackMat(themeId) {
  if (matCache.has(themeId)) return matCache.get(themeId)
  const P = pal(themeId)
  // Lambert: enlace del shader y relleno mucho más baratos que Standard; para asfalto mate basta.
  const m = new THREE.MeshLambertMaterial({
    color: '#ffffff', side: THREE.DoubleSide,
    normalMap: trackTex('track_normal.png', [128, 128, 255, 255]), normalScale: new THREE.Vector2(0.45, 0.45),
  })
  const U = {
    uLayout: { value: trackTex('track_layout.png', [225, 0, 0, 255]) },
    uAsfalto: { value: new THREE.Color(P.asfalto) },
    uA: { value: new THREE.Color(P.a) },
    uB: { value: new THREE.Color(P.b) },
    uLinea: { value: new THREE.Color(P.linea) },
    uTerreno: { value: new THREE.Color(P.terreno) },
    uRoca: { value: new THREE.Color(P.roca) },
    uChev: { value: new THREE.Color(P.chev) },
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aChev;\nattribute float aUnder;\nvarying vec2 vTrackUv;\nvarying float vChev;\nvarying float vUnder;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrackUv = uv;\nvChev = aChev;\nvUnder = aUnder;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uLayout;
        uniform vec3 uAsfalto; uniform vec3 uA; uniform vec3 uB; uniform vec3 uLinea; uniform vec3 uTerreno; uniform vec3 uRoca; uniform vec3 uChev;
        varying vec2 vTrackUv; varying float vChev; varying float vUnder;`)
      .replace('#include <map_fragment>', `
        vec3 L = texture2D(uLayout, vTrackUv).rgb;
        float x = vTrackUv.x;
        float fw = max(fwidth(x), 1e-4);
        float top = 1.0 - step(0.001, vUnder);
        float inner = top * smoothstep(${TRACK_U[0]} - fw, ${TRACK_U[0]} + fw, x) * (1.0 - smoothstep(${TRACK_U[3]} - fw, ${TRACK_U[3]} + fw, x));
        float asf = top * smoothstep(${TRACK_U[1]} - fw, ${TRACK_U[1]} + fw, x) * (1.0 - smoothstep(${TRACK_U[2]} - fw, ${TRACK_U[2]} + fw, x));
        float curb = inner - asf;
        vec3 col = uAsfalto * mix(0.8, 1.08, L.r);
        col = mix(col, mix(uB, uA, L.g), curb);
        vec3 terr = uTerreno * mix(0.72, 1.1, L.r);
        terr = mix(terr, uRoca * mix(0.7, 1.15, L.r), smoothstep(0.0, 0.6, vUnder));
        col = mix(terr, col, inner);
        col = mix(col, uLinea, L.b * asf * 0.5);
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
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * mix(0.22, 0.08, vUnder);')
  }
  m.customProgramCacheKey = () => 'pista-v2'
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
function pushLaneStrip(seg, lane, out) {
  const L = seg.length
  const H = halfWidth(lane)
  const { top, keelX } = profile(H)
  const n = Math.max(4, Math.ceil(L / STEP))
  const base = out.pos.length / 3
  const Ts = []; const Ss = []
  const salt = lane.id * 3.7 + seg.length * 0.013
  for (let i = 0; i <= n; i++) {
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
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < RING; j++) {
      const a = base + i * RING + j; const b = base + i * RING + ((j + 1) % RING)
      out.idx.push(a, a + RING, b, b, a + RING, b + RING)
    }
  }
}

const geoCache = new WeakMap()
export function trackGeo(way) {
  let g = geoCache.get(way)
  if (g) return g
  const out = { pos: [], uv: [], chev: [], under: [], idx: [] }
  for (const seg of way.segments) for (const lane of lanesOf(seg)) pushLaneStrip(seg, lane, out)
  g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2))
  g.setAttribute('aChev', new THREE.Float32BufferAttribute(out.chev, 1))
  g.setAttribute('aUnder', new THREE.Float32BufferAttribute(out.under, 1))
  g.setIndex(out.idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  g.name = 'pista:' + way.idx
  markShared(g) // en caché por camino: se reutiliza al volver a entrar
  geoCache.set(way, g)
  return g
}

/** Mallas mínimas con los materiales de la pista, para compilar y enlazar sus programas antes de la
 *  primera entrada (todos los temas comparten programa: solo cambian uniforms). */
export function pistaWarmup(extra = []) {
  const g = new THREE.Group()
  const tiny = new THREE.PlaneGeometry(0.01, 0.01)
  tiny.setAttribute('aChev', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  tiny.setAttribute('aUnder', new THREE.Float32BufferAttribute([0, 0, 0, 0], 1))
  g.add(new THREE.Mesh(tiny, trackMat('neon')))
  for (const mat of [...eventosWarmup(), ...extra]) {
    const im = new THREE.InstancedMesh(tiny, mat, 1)
    im.setColorAt(0, new THREE.Color('#ffffff'))
    g.add(im)
  }
  return g
}

export default function Pista({ way }) {
  const geo = useMemo(() => trackGeo(way), [way])
  const mat = useMemo(() => trackMat(way.theme.id), [way])
  return (
    <>
      <mesh geometry={geo} material={mat} receiveShadow />
      <Decor way={way} />
      <Eventos way={way} />
    </>
  )
}
