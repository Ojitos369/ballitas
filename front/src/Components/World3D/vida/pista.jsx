// Pista de carreras de cada camino: una malla fusionada por camino (asfalto, bordillos alternados, línea
// central y arcén que baja a la pared) construida desde el mismo marco que recorre la ballita (laneAngle +
// laneRelief de Core/world.js), y los mecanismos de cambio de carril como piezas pequeñas instanciadas.
// Nada más: el resto de la sección del tubo queda libre para ver el circuito.
import { useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BALL_R, laneAngle, laneFrame, laneRelief, segmentCurvature, wallFrame } from '../../../Core/world.js'
import { applyLoadedImage } from '../texUtils.js'
import { Instanced, markShared } from './base.jsx'

// Bandas de la sección en U (las mismas que TRACK_U de tools/assets/generate_textures.py).
const TRACK_U = [0.16, 0.26, 0.74, 0.84]
const TRACK_TILE = 4 // unidades de mundo por repetición de la textura en V
const CURB = 0.24
const SHOULDER = 0.42
const STEP = 0.7 // muestreo a lo largo del carril
const CHEV_K = 0.15 // curvatura (1/u) a partir de la cual una curva lleva flechas antes

// Colores por tema: asfalto, bordillo A/B, pintura, terreno del arcén y mecanismos.
export const PISTA = {
  sombrio: { asfalto: '#2b2538', a: '#a24bff', b: '#e8dcff', linea: '#d9c8ff', terreno: '#3a2759', mec: '#c08cff', chev: '#ffd36b' },
  bosque: { asfalto: '#3a3a35', a: '#e53935', b: '#f5f5ef', linea: '#f6f2c8', terreno: '#3f8f3a', mec: '#ffd54f', chev: '#ffd54f' },
  mar: { asfalto: '#2d4b5e', a: '#ff8a65', b: '#eefcff', linea: '#cff6ff', terreno: '#e3d2a2', mec: '#4dd0e1', chev: '#ffd166' },
  desierto: { asfalto: '#5b4733', a: '#d84315', b: '#fff3d6', linea: '#ffe9b0', terreno: '#d9a95b', mec: '#ffb74d', chev: '#fff3d6' },
  hielo: { asfalto: '#566d80', a: '#2f80ed', b: '#ffffff', linea: '#e8f6ff', terreno: '#dcefff', mec: '#7fd6ff', chev: '#ff6b8a' },
  volcan: { asfalto: '#2b2220', a: '#ff5a1f', b: '#ffd166', linea: '#ffcc80', terreno: '#4a2c22', mec: '#ff3d00', chev: '#ffd166' },
  cristal: { asfalto: '#383d5a', a: '#7df9ff', b: '#ff7de9', linea: '#ece6ff', terreno: '#8a7ad6', mec: '#a78bff', chev: '#7df9ff' },
  nubes: { asfalto: '#8790b5', a: '#ff9ecf', b: '#ffffff', linea: '#ffffff', terreno: '#eef1ff', mec: '#ffd54f', chev: '#ff9ecf' },
  neon: { asfalto: '#16141f', a: '#ff2bd6', b: '#2bffe8', linea: '#2bffe8', terreno: '#1c2233', mec: '#ff2bd6', chev: '#2bffe8' },
  jardin: { asfalto: '#4a3f3a', a: '#ff88c2', b: '#fff7e0', linea: '#fff2c2', terreno: '#6fbf5a', mec: '#ffd27a', chev: '#ff88c2' },
}
const pal = (id) => PISTA[id] ?? PISTA.neon

// ─────────────────────────── texturas (generate_textures.py --pista) ───────────────────────────
const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const texCache = new Map()
function trackTex(file, fallback, repeatT = true) {
  if (texCache.has(file)) return texCache.get(file)
  const tex = new THREE.DataTexture(new Uint8Array(fallback), 1, 1)
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
  const m = new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.82, metalness: 0.04, side: THREE.DoubleSide,
    normalMap: trackTex('track_normal.png', [128, 128, 255, 255]), normalScale: new THREE.Vector2(0.45, 0.45),
  })
  const U = {
    uLayout: { value: trackTex('track_layout.png', [225, 0, 0, 255]) },
    uAsfalto: { value: new THREE.Color(P.asfalto) },
    uA: { value: new THREE.Color(P.a) },
    uB: { value: new THREE.Color(P.b) },
    uLinea: { value: new THREE.Color(P.linea) },
    uTerreno: { value: new THREE.Color(P.terreno) },
    uChev: { value: new THREE.Color(P.chev) },
  }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U)
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aChev;\nvarying vec2 vTrackUv;\nvarying float vChev;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTrackUv = uv;\nvChev = aChev;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uLayout;
        uniform vec3 uAsfalto; uniform vec3 uA; uniform vec3 uB; uniform vec3 uLinea; uniform vec3 uTerreno; uniform vec3 uChev;
        varying vec2 vTrackUv; varying float vChev;`)
      .replace('#include <map_fragment>', `
        vec3 L = texture2D(uLayout, vTrackUv).rgb;
        float x = vTrackUv.x;
        float fw = max(fwidth(x), 1e-4);
        float inner = smoothstep(${TRACK_U[0]} - fw, ${TRACK_U[0]} + fw, x) * (1.0 - smoothstep(${TRACK_U[3]} - fw, ${TRACK_U[3]} + fw, x));
        float asf = smoothstep(${TRACK_U[1]} - fw, ${TRACK_U[1]} + fw, x) * (1.0 - smoothstep(${TRACK_U[2]} - fw, ${TRACK_U[2]} + fw, x));
        float curb = inner - asf;
        vec3 col = uAsfalto * mix(0.8, 1.08, L.r);
        col = mix(col, mix(uB, uA, L.g), curb);
        col = mix(uTerreno * mix(0.78, 1.06, L.r), col, inner);
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
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.22;')
  }
  m.customProgramCacheKey = () => 'pista-v1'
  markShared(m)
  matCache.set(themeId, m)
  return m
}

// ─────────────────────────── geometría de pista ───────────────────────────
const _n = new THREE.Vector3()
const WF = {}; const WO = {}

// Carril -> tira de 7 columnas (arcén, bordillo, asfalto ×3, bordillo, arcén). Devuelve el nº de filas.
function pushLaneStrip(seg, lane, out) {
  const R = seg.radius; const L = seg.length
  const H = lane.width / 2
  const cols = [-(H + CURB + SHOULDER), -(H + CURB), -H, 0, H, H + CURB, H + CURB + SHOULDER]
  const us = [0, TRACK_U[0], TRACK_U[1], 0.5, TRACK_U[2], TRACK_U[3], 1]
  const n = Math.max(4, Math.ceil(L / STEP))
  const base = out.pos.length / 3
  for (let i = 0; i <= n; i++) {
    const u = i / n
    const rel = laneRelief(seg, lane.id, u)
    const rho = R - rel - 0.02
    const f = wallFrame(seg, laneAngle(seg, lane.id, u), u, rho, WF)
    _n.crossVectors(f.tangent, f.dir) // dir rotado +90° alrededor de T
    for (let j = 0; j < 7; j++) {
      const edge = j === 0 || j === 6
      const r = edge ? R - 0.03 : rho
      const a = cols[j] / rho
      // p = eje + r·(dir·cos a + n·sin a)
      out.pos.push(
        f.axis.x + r * (f.dir.x * Math.cos(a) + _n.x * Math.sin(a)),
        f.axis.y + r * (f.dir.y * Math.cos(a) + _n.y * Math.sin(a)),
        f.axis.z + r * (f.dir.z * Math.cos(a) + _n.z * Math.sin(a)),
      )
      out.uv.push(us[j], (u * L) / TRACK_TILE)
    }
    out.chev.push(...new Array(7).fill(chevAt(seg, u, f.dir, _n)))
  }
  // Cara frontal hacia el eje: avance × lateral = T × (T × dir) = -dir.
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < 6; j++) {
      const a = base + i * 7 + j; const b = a + 7
      out.idx.push(a, b, a + 1, a + 1, b, b + 1)
    }
  }
}

// Intensidad y sentido de las flechas: solo ANTES de una curva cerrada; + = hacia +U.
function chevAt(seg, u, dir, lat) {
  if (segmentCurvature(seg, u).k > CHEV_K * 0.8) return 0
  let best = 0; let bu = 0; let bout = 0
  for (const d of [2.5, 5, 8]) {
    const ua = u + d / seg.length
    if (ua > 1) break
    const c = segmentCurvature(seg, ua)
    if (c.k > best) { best = c.k; bu = ua; bout = c.out }
  }
  const w = THREE.MathUtils.smoothstep(best, CHEV_K, CHEV_K * 1.4)
  if (w <= 0) return 0
  const o = wallFrame(seg, bout, bu, 1, WO).dir // hacia fuera de la curva
  const s = -o.dot(lat)
  return Math.abs(s) < 0.35 ? 0 : w * Math.sign(s)
}

const geoCache = new WeakMap()
export function trackGeo(way) {
  let g = geoCache.get(way)
  if (g) return g
  const out = { pos: [], uv: [], chev: [], idx: [] }
  for (const seg of way.segments) {
    if (seg.air || !seg.lanes) continue
    for (const lane of seg.lanes) pushLaneStrip(seg, lane, out)
  }
  g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(out.uv, 2))
  g.setAttribute('aChev', new THREE.Float32BufferAttribute(out.chev, 1))
  g.setIndex(out.idx)
  g.computeVertexNormals()
  g.computeBoundingSphere()
  g.name = 'pista:' + way.idx
  markShared(g) // en caché por camino: se reutiliza al volver a entrar
  geoCache.set(way, g)
  return g
}

// ─────────────────────────── mecanismos de cambio de carril ───────────────────────────
// Familias por forma: placa de salto (flechas hacia delante), plataforma-resorte, respiradero (aro
// tumbado), portal (aro de pie que se cruza), flecha lateral (mecanismos de pared) y placa de llegada.
const FAMILY = {
  rampa: 'salto', caida: 'salto', canon: 'salto', tirolina: 'salto',
  trampolin: 'pad', resorte: 'pad', bumper: 'pad',
  turbina: 'vent', geiser: 'vent', erupcion: 'vent',
  portal: 'portal',
}
let MECH_GEO = null
function mechGeos() {
  if (MECH_GEO) return MECH_GEO
  const arrow = (w, l, t) => {
    const s = new THREE.Shape()
    s.moveTo(-w, -l * 0.5); s.lineTo(0, l * 0.1); s.lineTo(w, -l * 0.5); s.lineTo(w, -l * 0.5 + t)
    s.lineTo(0, l * 0.1 + t); s.lineTo(-w, -l * 0.5 + t); s.closePath()
    return s
  }
  const plate = (shapes) => {
    const g = new THREE.ExtrudeGeometry(shapes, { depth: 0.04, bevelEnabled: false })
    g.rotateX(-Math.PI / 2) // forma en XZ, grosor hacia +Y
    g.rotateY(Math.PI) // la punta mira a +Z (avance)
    return g
  }
  const salto = plate([arrow(0.52, 0.8, 0.22)])
  const salto2 = plate([arrow(0.52, 0.8, 0.22)]).translate(0, 0, 0.42)
  const side = plate([arrow(0.42, 0.6, 0.2)])
  side.rotateY(Math.PI / 2) // apunta a +X (lateral)
  MECH_GEO = markShared({
    salto: mergeGeometries([salto, salto2]),
    pad: new THREE.CylinderGeometry(0.4, 0.46, 0.12, 24).translate(0, 0.06, 0),
    vent: new THREE.TorusGeometry(0.36, 0.08, 8, 24).rotateX(Math.PI / 2).translate(0, 0.06, 0),
    portal: new THREE.TorusGeometry(0.62, 0.07, 8, 28).translate(0, 0.66, 0),
    pared: side,
    llegada: new THREE.CylinderGeometry(0.34, 0.34, 0.03, 20).translate(0, 0.015, 0),
  })
  return MECH_GEO
}
let MECH_MAT = null
function mechMat() {
  if (MECH_MAT) return MECH_MAT
  // DoubleSide: la flecha lateral se espeja con escala X negativa
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4, metalness: 0.1, side: THREE.DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n#ifdef USE_INSTANCING_COLOR\ntotalEmissiveRadiance += vColor * 0.55;\n#endif')
  }
  m.customProgramCacheKey = () => 'pista-mec-v1'
  MECH_MAT = markShared(m)
  return m
}

const _q = new THREE.Quaternion(); const _m4 = new THREE.Matrix4(); const _x = new THREE.Vector3()
function placeOn(seg, laneId, u) {
  const f = laneFrame(seg, laneId, u, {})
  _x.crossVectors(f.up, f.tangent).normalize()
  _m4.makeBasis(_x, f.up, f.tangent)
  return { pos: f.pos.clone().addScaledVector(f.up, -BALL_R + 0.01), quat: _q.setFromRotationMatrix(_m4).clone(), x: _x.clone() }
}

function mechItems(way) {
  const P = pal(way.theme.id)
  const items = { salto: [], pad: [], vent: [], portal: [], pared: [], llegada: [] }
  for (const seg of way.segments) {
    if (seg.air || !seg.switches) continue
    for (const sw of seg.switches) {
      const fam = FAMILY[sw.kind] ?? 'pared'
      const a = placeOn(seg, sw.from, sw.u)
      const b = placeOn(seg, sw.to, sw.uEnd)
      const color = fam === 'portal' ? P.b : fam === 'pared' ? P.a : P.mec
      if (fam === 'pared') {
        // flecha hacia el carril destino (lado ±X local)
        const s = Math.sign(_x.copy(b.pos).sub(a.pos).dot(a.x)) || 1
        items.pared.push({ pos: a.pos, quat: a.quat, scale: [s, 1, 1], color })
      } else items[fam].push({ pos: a.pos, quat: a.quat, scale: 1, color })
      items.llegada.push({ pos: b.pos, quat: b.quat, scale: 1, color })
    }
  }
  return items
}

export default function Pista({ way }) {
  const geo = useMemo(() => trackGeo(way), [way])
  const mat = useMemo(() => trackMat(way.theme.id), [way])
  const items = useMemo(() => mechItems(way), [way])
  const G = mechGeos(); const M = mechMat()
  return (
    <>
      <mesh geometry={geo} material={mat} receiveShadow />
      {Object.keys(items).map((k) => <Instanced key={k} geo={G[k]} mat={M} items={items[k]} />)}
    </>
  )
}
