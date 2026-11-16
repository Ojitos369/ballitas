import { useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'
import { VISUALS } from './themes.js'

const TAU = Math.PI * 2
const X = new THREE.Vector3(1, 0, 0)
const Y = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const IDENT = new THREE.Quaternion()
const SHARED_TIME = { value: 0 }

// ═══════════════════════════ TEXTURAS + FALLBACK PROCEDURAL ═══════════════════════════
const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const texCache = new Map()
const texLoader = new THREE.TextureLoader()

function makeCanvas(w, h, draw) {
  if (typeof document === 'undefined') return null
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d'), w, h)
  return c
}

function loadTex(filename, { srgb = false, repeat = [1, 1], makeFallback }) {
  const key = `${filename}:${srgb ? 1 : 0}:${repeat[0]},${repeat[1]}`
  if (texCache.has(key)) return texCache.get(key)

  const canvas = makeFallback()
  const tex = canvas
    ? new THREE.CanvasTexture(canvas)
    : new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeat[0], repeat[1])
  tex.anisotropy = 8
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  tex.needsUpdate = true

  if (filename) {
    texLoader.load(
      BASE_TEX + filename,
      (loaded) => {
        if (!loaded?.image) return
        tex.image = loaded.image
        tex.needsUpdate = true
      },
      undefined,
      () => { /* conserva el fallback procedural */ }
    )
  }

  texCache.set(key, tex)
  return tex
}

function getFlowTex() {
  return loadTex('flow.png', {
    srgb: false,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(256, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      for (let i = 0; i < 4; i++) {
        const ox = i * 64 + 14
        const grad = ctx.createLinearGradient(ox - 12, 0, ox + 32, 0)
        grad.addColorStop(0, 'rgba(255,255,255,0)')
        grad.addColorStop(0.65, 'rgba(255,255,255,0.85)')
        grad.addColorStop(1, 'rgba(255,255,255,0.15)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 7
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        ctx.beginPath()
        ctx.moveTo(ox, 12)
        ctx.lineTo(ox + 22, h * 0.5)
        ctx.lineTo(ox, h - 12)
        ctx.stroke()
      }
    }),
  })
}

function getSparkleTex() {
  return loadTex('sparkle.png', {
    srgb: false,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.35, 'rgba(255,255,255,0.65)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.ellipse(32, 32, 24, 2.2, 0, 0, TAU)
      ctx.fill()
      ctx.beginPath()
      ctx.ellipse(32, 32, 2.2, 24, 0, 0, TAU)
      ctx.fill()
    }),
  })
}

function seedFromId(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

function texNormal(id) {
  return loadTex(`${id}_normal.png`, {
    srgb: false,
    repeat: [1, 2],
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      const rng = mulberry32(seedFromId(id) + 17)
      const hf = new Float32Array(w * h)
      // rayones longitudinales y diagonales
      for (let i = 0; i < 42; i++) {
        const y0 = rng() * h
        const dy = (rng() - 0.5) * 18
        const amp = (rng() - 0.5) * 0.45
        for (let x = 0; x < w; x++) {
          const y = ((Math.floor(y0 + (x / w) * dy) % h) + h) % h
          hf[y * w + x] += amp
        }
      }
      // gotas de condensación
      for (let i = 0; i < 55; i++) {
        const cx = rng() * w
        const cy = rng() * h
        const rad = 3 + rng() * 6
        const r2 = rad * rad
        for (let oy = -Math.ceil(rad); oy <= Math.ceil(rad); oy++) {
          for (let ox = -Math.ceil(rad); ox <= Math.ceil(rad); ox++) {
            const d2 = ox * ox + oy * oy
            if (d2 < r2) {
              const px = ((Math.floor(cx + ox) % w) + w) % w
              const py = ((Math.floor(cy + oy) % h) + h) % h
              hf[py * w + px] += (1 - d2 / r2) * 0.65
            }
          }
        }
      }
      // vetas orgánicas suaves
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          hf[y * w + x] += Math.sin((x / w) * TAU * 3 + Math.sin((y / h) * TAU * 2)) * 0.12
        }
      }
      const img = ctx.createImageData(w, h)
      const d = img.data
      for (let y = 0; y < h; y++) {
        const ym = (y - 1 + h) % h
        const yp = (y + 1) % h
        for (let x = 0; x < w; x++) {
          const xm = (x - 1 + w) % w
          const xp = (x + 1) % w
          const dx = (hf[y * w + xp] - hf[y * w + xm]) * 1.4
          const dy = (hf[yp * w + x] - hf[ym * w + x]) * 1.4
          const len = Math.hypot(dx, dy, 1)
          const idx = (y * w + x) * 4
          d[idx] = Math.round(((-dx / len) * 0.5 + 0.5) * 255)
          d[idx + 1] = Math.round(((-dy / len) * 0.5 + 0.5) * 255)
          d[idx + 2] = Math.round(((1 / len) * 0.5 + 0.5) * 255)
          d[idx + 3] = 255
        }
      }
      ctx.putImageData(img, 0, 0)
    }),
  })
}

function texAlbedo(id) {
  return loadTex(`${id}_albedo.png`, {
    srgb: true,
    repeat: [1, 2],
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      const V = VISUALS[id]
      const rng = mulberry32(seedFromId(id) + 31)
      ctx.fillStyle = '#eef4ff'
      ctx.fillRect(0, 0, w, h)
      ctx.globalAlpha = 0.22
      for (let i = 0; i < 24; i++) {
        ctx.strokeStyle = i % 2 === 0 ? V.glass : V.rib
        ctx.lineWidth = 2 + rng() * 8
        const y = rng() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.bezierCurveTo(w * 0.33, y + (rng() - 0.5) * 30, w * 0.66, y + (rng() - 0.5) * 30, w, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }),
  })
}

function texEmissive(id) {
  return loadTex(`${id}_emissive.png`, {
    srgb: true,
    repeat: [1, 2],
    makeFallback: () => makeCanvas(256, 256, (ctx, w, h) => {
      const V = VISUALS[id]
      const rng = mulberry32(seedFromId(id) + 73)
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, w, h)
      ctx.strokeStyle = V.rail
      ctx.globalAlpha = 0.35
      for (let i = 0; i < 12; i++) {
        ctx.lineWidth = 1.5 + rng() * 2.5
        const y = rng() * h
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y + (rng() - 0.5) * 18)
        ctx.stroke()
      }
      ctx.fillStyle = V.rib
      for (let i = 0; i < 20; i++) {
        ctx.beginPath()
        ctx.arc(rng() * w, rng() * h, 1.5 + rng() * 2.5, 0, TAU)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }),
  })
}

const SIGN_CELLS = {
  salida: [0, 0, '🚀', 'SALIDA', '#4fc3f7'],
  llegada: [1, 0, '🏁', 'META', '#81c784'],
  rampa: [2, 0, '🛝', 'RAMPA', '#90caf9'],
  zigzag: [3, 0, '〰', 'ZIGZAG', '#ce93d8'],
  rizo: [0, 1, '➰', 'RIZO', '#ffab91'],
  sacacorchos: [1, 1, '🧬', 'HELICE', '#80cbc4'],
  trampolin: [2, 1, '🤸', 'SALTO', '#fff59d'],
  canon: [3, 1, '💥', 'CAÑÓN', '#ff8a65'],
  espiral: [0, 2, '🌀', 'ESPIRAL', '#b39ddb'],
  caida: [1, 2, '🪂', 'CAÍDA', '#ef9a9a'],
  cascada: [2, 2, '🪜', 'CASCADA', '#80deea'],
  embudo: [3, 2, '🌪', 'EMBUDO', '#ffcc80'],
}

function getSignAtlasTex() {
  return loadTex(null, {
    srgb: true,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(512, 384, (ctx) => {
      ctx.clearRect(0, 0, 512, 384)
      for (const [col, row, icon, label, accent] of Object.values(SIGN_CELLS)) {
        const x = col * 128
        const y = row * 128
        ctx.fillStyle = 'rgba(14, 18, 34, 0.92)'
        ctx.strokeStyle = accent
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.roundRect(x + 8, y + 18, 112, 92, 14)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 34px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(icon, x + 64, y + 50)
        ctx.fillStyle = accent
        ctx.font = 'bold 17px sans-serif'
        ctx.fillText(label, x + 64, y + 88)
      }
    }),
  })
}

// ═══════════════════════════ GEOMETRÍAS COMPARTIDAS ═══════════════════════════
const base = (g) => (g.translate(0, 0.5, 0), g)
const GEO = {
  cone: base(new THREE.ConeGeometry(0.5, 1, 10)),
  funnel: base(new THREE.ConeGeometry(0.5, 1, 28, 1, true)),
  cyl: base(new THREE.CylinderGeometry(0.5, 0.5, 1, 10)),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  box: base(new THREE.BoxGeometry(1, 1, 1)),
  octa: base(new THREE.OctahedronGeometry(0.5)),
  torus: new THREE.TorusGeometry(1, 0.04, 6, 32), // radio 1: se escala al radio del tubo
  banner: (() => {
    const g = new THREE.ConeGeometry(0.32, 0.72, 3)
    g.rotateX(Math.PI)
    g.translate(0, -0.36, 0)
    return g
  })(),
  arrow: (() => {
    const g = new THREE.ConeGeometry(0.28, 0.65, 4)
    g.rotateX(Math.PI / 2)
    return g
  })(),
  sign: new THREE.PlaneGeometry(1.45, 0.72),
}
const GEO_BY = { cone: GEO.cone, cyl: GEO.cyl, sphere: GEO.sphere, box: GEO.box, octa: GEO.octa, torus: GEO.torus }

// ═══════════════════════════ MATERIALES Y SHADERS ═══════════════════════════
// Multiplicadores moderados (1.1-1.35 base, ~2 solo en pulsos y bocas) para que el bloom no blanquee el color del tema.
const hot = (c, k = 1.25) => new THREE.Color(c).multiplyScalar(k)
const MAT = {
  deco: new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.12, flatShading: true }),
  decoA: new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true, transparent: true, opacity: 0.85, depthWrite: false }),
  glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
  sign: (() => {
    const m = new THREE.MeshBasicMaterial({ map: getSignAtlasTex(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec2 aUvOffset;\nvarying vec2 vSignUv;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSignUv = uv * vec2(0.25, 0.3333333) + aUvOffset;')
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vSignUv;')
        .replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D( map, vSignUv );\ndiffuseColor *= sampledDiffuseColor;')
    }
    m.customProgramCacheKey = () => 'sign-atlas-v1'
    return m
  })(),
}

const cache = {}
const memo = (key, make) => (cache[key] ??= make())

// Material del tubo: cristal físico con normalMap (rayones/condensación/vetas), fresnel, suciedad en la base y flujo animado.
const tubeMatOf = (id) => memo(`tf${id}`, () => {
  const V = VISUALS[id]
  const m = new THREE.MeshPhysicalMaterial({
    color: V.glass,
    map: texAlbedo(id),
    normalMap: texNormal(id),
    normalScale: new THREE.Vector2(0.45, 0.45),
    emissive: new THREE.Color(V.rail),
    emissiveMap: texEmissive(id),
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    metalness: 0.08,
    envMapIntensity: 1.4,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFlowMap = { value: getFlowTex() }
    shader.uniforms.uThemeColor = { value: new THREE.Color(V.rail) }
    shader.uniforms.uGlassColor = { value: new THREE.Color(V.glass) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTubeUv;\nvarying vec3 vTubeWorldNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTubeUv = uv;\nvTubeWorldNormal = normalize(mat3(modelMatrix) * objectNormal);')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform sampler2D uFlowMap;\nuniform vec3 uThemeColor;\nuniform vec3 uGlassColor;\nvarying vec2 vTubeUv;\nvarying vec3 vTubeWorldNormal;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 tubeViewDir = normalize(vViewPosition);
        float tubeFresnel = pow(1.0 - abs(dot(normalize(normal), tubeViewDir)), 2.4);
        vec2 flowUv = vec2(fract(vTubeUv.x * 0.45 - uTime * 0.75), fract(vTubeUv.y * 2.0));
        vec4 flowTex = texture2D(uFlowMap, flowUv);
        float wavePulse = smoothstep(0.55, 1.0, sin(vTubeUv.x * 1.4 - uTime * 3.2) * 0.5 + 0.5);
        float flowMask = flowTex.a * (0.45 + 0.55 * wavePulse);
        float baseGrime = smoothstep(-0.25, -0.85, vTubeWorldNormal.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + vec3(0.05, 0.04, 0.03), baseGrime * 0.45);
        totalEmissiveRadiance += uGlassColor * tubeFresnel * 0.35 + uThemeColor * flowMask * 0.95;`
      )
      .replace(
        '#include <dithering_fragment>',
        `gl_FragColor.a = clamp(gl_FragColor.a + tubeFresnel * 0.32 + flowMask * 0.5 + baseGrime * 0.12, 0.0, 0.92);
        #include <dithering_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'tube-flow-v1'
  return m
})

// Cristal limpio con normalMap para esferas de nudo, discos y embudos.
const glassOf = (id) => memo(`g${id}`, () => new THREE.MeshPhysicalMaterial({
  color: VISUALS[id].glass,
  normalMap: texNormal(id),
  normalScale: new THREE.Vector2(0.25, 0.25),
  transparent: true,
  opacity: 0.24,
  roughness: 0.06,
  metalness: 0.1,
  envMapIntensity: 1.5,
  depthWrite: false,
  side: THREE.DoubleSide,
}))

// Riel con pulsos que corren en el sentido de la marcha y color por ruta A/B/C.
const railOf = (id) => memo(`r${id}`, () => {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRailUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRailUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec2 vRailUv;')
      .replace('#include <opaque_fragment>', 'float railPulse = pow(sin(vRailUv.x * 1.6 - uTime * 3.6) * 0.5 + 0.5, 4.0);\noutgoingLight *= (1.0 + railPulse * 0.72);\n#include <opaque_fragment>')
  }
  m.customProgramCacheKey = () => 'rail-pulse-v1'
  return m
})

const dotsOf = (id) => memo(`d${id}`, () => new THREE.PointsMaterial({
  color: hot(VISUALS[id].rail, 1.25),
  map: getSparkleTex(),
  size: 0.13,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0.28,
  alphaTest: 0.02,
  depthWrite: false,
  toneMapped: false,
}))

const partsOf = (id) => memo(`p${id}`, () => {
  const { c, s, vy = 0, vx = 0.15, amp = 0.5, freq = 1.4, a = 0.6, glow = 1.25 } = VISUALS[id].parts
  const m = new THREE.PointsMaterial({
    color: hot(c, glow),
    map: getSparkleTex(),
    size: s * 3.2,
    sizeAttenuation: true,
    transparent: true,
    opacity: a,
    alphaTest: 0.02,
    depthWrite: false,
    toneMapped: false,
  })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uMotion = { value: new THREE.Vector3(vx, vy, amp) }
    shader.uniforms.uFreq = { value: freq }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uMotion;\nuniform float uFreq;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float pSeed = fract(sin(dot(position.xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float pPhase = pSeed * 6.2831853;
        if (abs(uMotion.y) > 0.2) {
          float span = 4.0;
          float drift = fract(uTime * abs(uMotion.y) * 0.18 + pSeed) * span - span * 0.5;
          transformed.y += (uMotion.y > 0.0 ? drift : -drift);
        } else {
          transformed.y += sin(uTime * uFreq + pPhase) * uMotion.z * 0.55;
        }
        transformed.x += sin(uTime * uFreq * 0.8 + pPhase) * uMotion.z + uMotion.x * sin(uTime * 0.7 + pSeed * 3.14);
        transformed.z += cos(uTime * uFreq * 0.9 + pPhase * 1.3) * uMotion.z;`
      )
  }
  m.customProgramCacheKey = () => 'parts-motion-v1'
  return m
})

// ═══════════════════════════ HELPERS DE CONSTRUCCIÓN ═══════════════════════════
const put = (list, p, q, sx, sy = sx, sz = sx, c) => list.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz)), c })
const aim = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to)
const rr = (rng, [a, b]) => a + rng() * (b - a)
const pointsGeo = (arr) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
const METAL = new THREE.Color('#3a3f4a')

// Matiz sutil por ruta A (0), B (1), C (2)
function routeColor(baseHex, routeIdx, mult = 1) {
  const c = new THREE.Color(baseHex).multiplyScalar(mult)
  if (routeIdx === 1) c.offsetHSL(0.045, 0.04, 0.03)
  else if (routeIdx === 2) c.offsetHSL(-0.045, 0.04, -0.02)
  return c
}

function scaleTubeUvX(geo, len) {
  const uv = geo.getAttribute('uv')
  const sx = Math.max(len * 0.25, 0.5)
  for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * sx)
  uv.needsUpdate = true
}

function colorizeGeo(geo, col) {
  const count = geo.getAttribute('position').count
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = col.r
    arr[i * 3 + 1] = col.g
    arr[i * 3 + 2] = col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
}

function frameAt(T) {
  const N = new THREE.Vector3().crossVectors(T, Math.abs(T.y) > 0.9 ? X : Y).normalize()
  const B = new THREE.Vector3().crossVectors(T, N).normalize()
  return { N, B }
}

// ═══════════════════════════ BUILD WAY ═══════════════════════════
function build(way) {
  const V = VISUALS[way.theme.id]
  const r = way.params.radius
  const ribBase = hot(V.rib, 1.25)
  const mouthC = hot(V.rail, 1.95)
  const dim = hot(V.rib, 0.8)
  const archC = new THREE.Color(V.arch?.c ?? '#3a3f4a')
  const poleC = new THREE.Color(V.lamp?.pole ?? '#3a3f4a')
  const lampC = hot(V.lamp?.c ?? V.rail, 1.32)
  const arrowC = hot(V.rail, 1.25)
  const bannerCols = (V.banner?.c ?? [V.rib, V.rail]).map((c) => new THREE.Color(c))

  const tubes = []; const rails = []
  const rings = []; const solids = []; const spheres = []; const discs = []; const funnels = []; const dots = []
  const lights = []; const banners = []; const arrows = []; const signs = []; const spinMeta = []
  const solid = way.segments.filter((s) => !s.air)

  for (const s of way.segments) {
    const c = s.curve; const R = s.radius
    const ribC = routeColor(V.rib, s.route, 1.25)
    const railCol = routeColor(V.rail, s.route, 1.18)

    if (s.air) {
      const P0 = c.getPoint(0); const T0 = c.getTangent(0); const P1 = c.getPoint(1); const T1 = c.getTangent(1)
      const n = Math.ceil(s.length / 0.9)
      for (let i = 1; i < n; i++) dots.push(...c.getPoint(i / n).toArray())
      // flechas guía en trayectoria aérea
      for (const u of [0.25, 0.5, 0.75]) {
        arrows.push({ m: new THREE.Matrix4().compose(c.getPointAt(u), aim(Z, c.getTangentAt(u)), new THREE.Vector3(0.75, 0.75, 0.9)), c: arrowC })
      }
      if (s.kind === 'trampolin') {
        const p = P0.clone().addScaledVector(Y, -0.35)
        put(solids, p, IDENT, R * 3.4, 0.3, R * 3.4, new THREE.Color(V.rib).multiplyScalar(0.5))
        put(rings, p.clone().addScaledVector(Y, 0.3), aim(Z, Y), R * 1.7, R * 1.7, R * 1.7, mouthC)
        put(rings, P0.clone().addScaledVector(T0, 0.9), aim(Z, T0), R * 1.35, R * 1.35, R * 1.35, mouthC)
      } else if (s.kind === 'canon') {
        ;[[0.5, 1.15], [1.1, 1.3], [1.7, 1.5]].forEach(([b, k]) => put(rings, P0.clone().addScaledVector(T0, -b), aim(Z, T0), R * k, R * k, R * k, METAL))
        put(rings, P0, aim(Z, T0), R * 1.2, R * 1.2, R * 1.2, hot('#ff7a2f', 2.0))
        // anillos de velocidad frente a la boca del cañón
        ;[0.8, 1.7].forEach((d, idx) => put(rings, P0.clone().addScaledVector(T0, d), aim(Z, T0), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), hot('#ff9a3c', 1.85)))
      } else {
        put(rings, P0, aim(Z, T0), R * 1.12, R * 1.12, R * 1.12, mouthC)
        put(solids, P0.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 2.6, 0.18, R * 2.6, METAL)
      }
      // recepción: red de aros concéntricos con disco de cristal
      put(rings, P1, aim(Z, T1), R * 1.9, R * 1.9, R * 1.9, mouthC)
      put(rings, P1, aim(Z, T1), R * 1.25, R * 1.25, R * 1.25, dim)
      put(rings, P1, aim(Z, T1), R * 0.6, R * 0.6, R * 0.6, dim)
      put(discs, P1, aim(Y, T1), R * 3.8, 0.04, R * 3.8)
      continue
    }

    const steps = Math.min(240, Math.max(8, Math.ceil(s.length * 2.5)))
    const tubeGeo = new THREE.TubeGeometry(c, steps, R, 10, false)
    scaleTubeUvX(tubeGeo, s.length)
    tubes.push(tubeGeo)

    // riel: línea fina pegada a la pared que sigue el mismo marco que el tubo
    const fr = c.computeFrenetFrames(steps, false); const pts = []
    for (let i = 0; i <= steps; i++) {
      const a = 0.9
      pts.push(c.getPointAt(i / steps).addScaledVector(fr.normals[i], Math.cos(a) * R * 0.97).addScaledVector(fr.binormals[i], Math.sin(a) * R * 0.97))
    }
    const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, 0.06, 4, false)
    scaleTubeUvX(railGeo, s.length)
    colorizeGeo(railGeo, railCol)
    rails.push(railGeo)

    // costillas + banderines/luces colgantes entre costillas
    const nRib = Math.max(1, Math.floor(s.length / 2.2))
    for (let i = 0; i < nRib; i++) {
      const u = (i + 0.5) / nRib
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      put(rings, P, aim(Z, T), R * 1.05, R * 1.05, R * 1.05, ribC)
      if (i % 3 === 1 && s.length > 5) {
        const { N } = frameAt(T)
        const sideSign = i % 2 === 0 ? 1 : -1
        const bp = P.clone().addScaledVector(N, sideSign * R * 1.12).addScaledVector(Y, -R * 0.25)
        put(banners, bp, IDENT, 0.75, 0.75, 0.75, bannerCols[i % bannerCols.length])
        put(lights, bp.clone().addScaledVector(Y, -0.55), IDENT, 0.2, 0.2, 0.2, lampC)
      }
    }

    // anillos de velocidad en bocas de salida y llegada
    if (s.kind === 'salida' || s.kind === 'llegada') {
      const baseU = s.kind === 'salida' ? 0.05 : 0.95
      const stepU = s.kind === 'salida' ? 0.1 : -0.1
      for (let k = 0; k < 3; k++) {
        const u = THREE.MathUtils.clamp(baseU + k * stepU, 0.02, 0.98)
        put(rings, c.getPointAt(u), aim(Z, c.getTangentAt(u)), R * (1.22 + k * 0.08), R * (1.22 + k * 0.08), R * (1.22 + k * 0.08), mouthC)
      }
    }

    // pilares con arcos y vigas
    const nPost = Math.floor(s.length / 10)
    for (let i = 0; i < nPost; i++) {
      const u = (i + 0.5) / nPost
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const h = 3.2
      const span = R * 1.05
      const baseY = P.y - R - h
      // dos pilares laterales + viga horizontal + riostras en arco + zapata
      put(solids, new THREE.Vector3(P.x + N.x * span, baseY, P.z + N.z * span), IDENT, 0.13, h, 0.13, archC)
      put(solids, new THREE.Vector3(P.x - N.x * span, baseY, P.z - N.z * span), IDENT, 0.13, h, 0.13, archC)
      put(solids, new THREE.Vector3(P.x, P.y - R - 0.15, P.z), aim(Y, N), 0.14, span * 2.1, 0.14, archC)
      put(solids, new THREE.Vector3(P.x, baseY, P.z), aim(Y, N), 0.22, span * 2.3, 0.26, METAL)
      const braceL = P.clone().addScaledVector(Y, -R - 0.9).addScaledVector(N, span * 0.55)
      const braceR = P.clone().addScaledVector(Y, -R - 0.9).addScaledVector(N, -span * 0.55)
      put(solids, braceL, aim(Y, N.clone().multiplyScalar(-1).add(Y).normalize()), 0.09, span * 0.95, 0.09, archC)
      put(solids, braceR, aim(Y, N.clone().add(Y).normalize()), 0.09, span * 0.95, 0.09, archC)
    }

    // farolas a lo largo del tramo
    const nLamp = Math.floor(s.length / 14)
    for (let i = 0; i < nLamp; i++) {
      const u = (i + 0.35) / nLamp
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const side = i % 2 === 0 ? 1 : -1
      const baseP = P.clone().addScaledVector(N, side * (R + 0.18)).addScaledVector(Y, R * 0.25)
      put(solids, baseP, IDENT, 0.07, 1.35, 0.07, poleC)
      put(solids, baseP.clone().addScaledVector(Y, 1.3), aim(Y, N.clone().multiplyScalar(-side).addScaledVector(Y, 0.3).normalize()), 0.055, 0.6, 0.055, poleC)
      put(lights, baseP.clone().addScaledVector(Y, 1.45).addScaledVector(N, -side * 0.48), IDENT, 0.28, 0.28, 0.28, lampC)
    }

    // flechas direccionales en el lomo del tubo
    const nArr = Math.max(1, Math.floor(s.length / 7.5))
    for (let i = 0; i < nArr; i++) {
      const u = (i + 0.5) / nArr
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const topDir = Y.clone().addScaledVector(T, -T.dot(Y))
      if (topDir.lengthSq() < 0.01) topDir.copy(X)
      topDir.normalize()
      put(arrows, P.clone().addScaledVector(topDir, R + 0.22), aim(Z, T), 0.72, 0.72, 0.85, arrowC)
    }

    // cartelito del obstáculo al inicio del tramo
    if (s.kind !== 'salida' && s.kind !== 'llegada' && SIGN_CELLS[s.kind]) {
      const u = Math.min(0.12, 1.8 / Math.max(s.length, 1))
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const signBase = P.clone().addScaledVector(N, R + 0.35).addScaledVector(Y, R * 0.4)
      put(solids, signBase, IDENT, 0.06, 1.25, 0.06, METAL)
      const [col, row] = SIGN_CELLS[s.kind]
      const signQ = aim(Z, N.clone().addScaledVector(T, -0.4).normalize())
      signs.push({
        m: new THREE.Matrix4().compose(signBase.clone().addScaledVector(Y, 1.35), signQ, new THREE.Vector3(1, 1, 1)),
        uv: [col * 0.25, 1 - (row + 1) / 3],
      })
    }

    if (s.kind === 'embudo') {
      const A = c.getPoint(0); const B = c.getPoint(1); const ctr = new THREE.Vector3()
      for (let i = 0; i < 24; i++) ctr.add(c.getPoint(0.02 + (i / 23) * 0.28))
      ctr.divideScalar(24)
      const d = B.clone().sub(ctr).normalize(); const h = -A.clone().sub(B).dot(d)
      const rad = A.clone().sub(B).addScaledVector(d, h).length()
      if (h > 0.5) put(funnels, B.clone().addScaledVector(d, -h), aim(Y, d), rad * 2, h, rad * 2)
    } else if (s.kind === 'cascada') {
      let last = -9
      for (let i = 0; i <= 40; i++) {
        if (Math.abs(c.getTangentAt(i / 40).y) < 0.3 && i - last > 3) { last = i; put(discs, c.getPointAt(i / 40).addScaledVector(Y, -R - 0.15), IDENT, R * 3.2, 0.14, R * 3.2) }
      }
    }
  }

  // nudos (junctions): esfera de cristal, núcleo emisivo y anillos giratorios según fork / cross / merge
  way.junctions.forEach((j, i) => {
    put(spheres, j.pos, IDENT, r * 4)
    if (j.kind === 'fork') {
      put(lights, j.pos, IDENT, r * 0.85, r * 0.85, r * 0.85, hot('#4fe3ff', 1.35))
      spinMeta.push({ pos: j.pos, ex: 0.45, ey: i * 0.7, ez: 0.2, sx: 0.9, sy: 1.3, sz: 0.3, scale: r * 2.45, c: hot('#4fe3ff', 1.3) })
      spinMeta.push({ pos: j.pos, ex: -0.45, ey: i * 0.7, ez: -0.2, sx: -0.9, sy: 1.1, sz: -0.3, scale: r * 1.95, c: ribBase })
    } else if (j.kind === 'cross') {
      put(lights, j.pos, IDENT, r * 0.95, r * 0.95, r * 0.95, hot('#ffd859', 1.4))
      spinMeta.push({ pos: j.pos, ex: 0, ey: 0, ez: 0, sx: 1.1, sy: 0.8, sz: 0.2, scale: r * 2.65, c: hot('#ffd859', 1.3) })
      spinMeta.push({ pos: j.pos, ex: Math.PI / 2, ey: 0, ez: 0, sx: 0.2, sy: -1.2, sz: 0.9, scale: r * 2.15, c: ribBase })
      spinMeta.push({ pos: j.pos, ex: 0, ey: Math.PI / 2, ez: 0.4, sx: -0.8, sy: 0.4, sz: 1.3, scale: r * 1.65, c: hot(V.rail, 1.3) })
    } else {
      // merge
      put(lights, j.pos, IDENT, r * 0.85, r * 0.85, r * 0.85, hot('#7affb2', 1.35))
      spinMeta.push({ pos: j.pos, ex: 0.3, ey: i * 0.5, ez: 0, sx: 0.4, sy: 1.4, sz: 0.4, scale: r * 2.5, c: hot('#7affb2', 1.28) })
      spinMeta.push({ pos: j.pos, ex: -0.3, ey: i * 0.5, ez: 0, sx: 0.4, sy: -1.4, sz: -0.4, scale: r * 1.85, c: ribBase })
    }
  })

  // decoración alrededor de los tubos
  const total = solid.reduce((a, s) => a + s.length, 0)
  const pick = (t) => { for (const s of solid) { if ((t -= s.length) <= 0) return s } return solid[solid.length - 1] }
  const decor = solid.length
    ? V.props.map((p, pi) => {
        const place = mulberry32(p.seed * 7919 + way.idx * 131)
        const look = mulberry32(p.seed * 104729 + pi * 31 + way.idx)
        const items = []; const n = Math.max(1, Math.floor(total * p.d))
        for (let i = 0; i < n; i++) {
          const s = pick(place() * total); const u = 0.04 + place() * 0.92; const ang = place() * TAU; const off = rr(place, p.off)
          const P = s.curve.getPointAt(u); const T = s.curve.getTangentAt(u)
          const col = new THREE.Color(p.c[Math.floor(look() * p.c.length)]).offsetHSL(0, 0, (look() - 0.5) * 0.08)
          if (p.e) col.multiplyScalar(typeof p.e === 'number' ? p.e : 1.3)
          if (p.ring) { const k = s.radius * rr(look, p.w); put(items, P, aim(Z, T), k, k, k, col); continue }
          const N = new THREE.Vector3().crossVectors(T, Math.abs(T.y) > 0.9 ? X : Y).normalize()
          const B = new THREE.Vector3().crossVectors(T, N)
          const dir = N.multiplyScalar(Math.cos(ang)).addScaledVector(B, Math.sin(ang))
          if (p.top && dir.y < 0.35) { dir.y = Math.abs(dir.y) + 0.35; dir.normalize() }
          const q = aim(Y, dir)
          if (p.tilt) q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((look() - 0.5) * p.tilt * 2, look() * TAU, (look() - 0.5) * p.tilt * 2)))
          else q.multiply(new THREE.Quaternion().setFromAxisAngle(Y, look() * TAU))
          const w = rr(look, p.w); const h = rr(look, p.h)
          put(items, P.addScaledVector(dir, s.radius + off + rr(look, p.y)), q, w, h, w, col)
        }
        return { p, items }
      })
    : []

  // partículas ambientales alrededor del recorrido
  const prng = mulberry32(way.idx * 977 + 5); const pp = []
  if (solid.length) {
    for (let i = 0; i < V.parts.n; i++) {
      const s = pick(prng() * total); const P = s.curve.getPointAt(prng())
      pp.push(P.x + (prng() - 0.5) * 7, P.y + (prng() - 0.5) * 7, P.z + (prng() - 0.5) * 7)
    }
  }

  return {
    tube: tubes.length ? mergeGeometries(tubes) : null,
    rail: rails.length ? mergeGeometries(rails) : null,
    rings, solids, spheres, discs, funnels, decor,
    lights, banners, arrows, signs, spinMeta,
    dots: dots.length ? pointsGeo(dots) : null,
    parts: pointsGeo(pp),
  }
}

// ═══════════════════════════ COMPONENTES R3F ═══════════════════════════
function Inst({ geo, mat, items, cast }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); if (it.c) o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow={cast} receiveShadow={cast} frustumCulled={false} />
}

function SignInst({ items }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = GEO.sign.clone()
    const uvOff = new Float32Array(items.length * 2)
    items.forEach((it, i) => { uvOff[i * 2] = it.uv[0]; uvOff[i * 2 + 1] = it.uv[1] })
    g.setAttribute('aUvOffset', new THREE.InstancedBufferAttribute(uvOff, 2))
    return g
  }, [items])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setMatrixAt(i, it.m))
    o.instanceMatrix.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, MAT.sign, items.length]} frustumCulled={false} />
}

const _spinMat = new THREE.Matrix4()
const _spinQ = new THREE.Quaternion()
const _spinE = new THREE.Euler()
const _spinS = new THREE.Vector3()

function SpinRings({ meta }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    meta.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [meta])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o) return
    const t = clock.elapsedTime
    for (let i = 0; i < meta.length; i++) {
      const it = meta[i]
      _spinE.set(it.ex + t * it.sx, it.ey + t * it.sy, it.ez + t * it.sz)
      _spinQ.setFromEuler(_spinE)
      _spinS.setScalar(it.scale)
      _spinMat.compose(it.pos, _spinQ, _spinS)
      o.setMatrixAt(i, _spinMat)
    }
    o.instanceMatrix.needsUpdate = true
  })
  if (!meta.length) return null
  return <instancedMesh ref={ref} args={[GEO.torus, MAT.glow, meta.length]} frustumCulled={false} />
}

function Way({ way }) {
  const id = way.theme.id
  const d = useMemo(() => build(way), [way])
  const glass = glassOf(id)
  const tubeMat = tubeMatOf(id)
  return (
    <group>
      {d.tube && <mesh geometry={d.tube} material={tubeMat} />}
      {d.rail && <mesh geometry={d.rail} material={railOf(id)} />}
      <Inst geo={GEO.torus} mat={MAT.glow} items={d.rings} />
      <Inst geo={GEO.cyl} mat={MAT.deco} items={d.solids} cast />
      <Inst geo={GEO.sphere} mat={glass} items={d.spheres} />
      <Inst geo={GEO.cyl} mat={glass} items={d.discs} />
      <Inst geo={GEO.funnel} mat={glass} items={d.funnels} />
      <Inst geo={GEO.sphere} mat={MAT.glow} items={d.lights} />
      <Inst geo={GEO.banner} mat={MAT.deco} items={d.banners} />
      <Inst geo={GEO.arrow} mat={MAT.glow} items={d.arrows} />
      <SpinRings meta={d.spinMeta} />
      <SignInst items={d.signs} />
      {d.decor.map(({ p, items }, i) => {
        const solidMat = !p.e && (p.a ?? 1) >= 1
        return <Inst key={i} geo={GEO_BY[p.k]} mat={p.e ? MAT.glow : solidMat ? MAT.deco : MAT.decoA} items={items} cast={solidMat} />
      })}
      {d.dots && <points geometry={d.dots} material={dotsOf(id)} frustumCulled={false} />}
      <points geometry={d.parts} material={partsOf(id)} frustumCulled={false} />
    </group>
  )
}

export default function Paths({ world }) {
  useFrame(({ clock }) => {
    SHARED_TIME.value = clock.elapsedTime
  })
  return (
    <>
      {world.ways.map((w) => <Way key={w.idx} way={w} />)}
      {world.circuits.map((c) => (
        <Html key={c.idx} position={c.mid.clone().add(new THREE.Vector3(0, 2.4, 0))} center distanceFactor={22} zIndexRange={[5, 0]}>
          <div className="tag" style={{ borderColor: VISUALS[c.theme.id].rail }}>{c.theme.emoji} {c.theme.name.replace('Camino ', '')}</div>
        </Html>
      ))}
    </>
  )
}
