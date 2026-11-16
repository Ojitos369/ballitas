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

function loadTex(filename, { srgb = false, repeat = [1, 1], clamp = false, makeFallback }) {
  const key = `${filename}:${srgb ? 1 : 0}:${repeat[0]},${repeat[1]}:${clamp ? 1 : 0}`
  if (texCache.has(key)) return texCache.get(key)

  const canvas = makeFallback()
  const tex = canvas
    ? new THREE.CanvasTexture(canvas)
    : new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  tex.wrapS = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
  tex.wrapT = clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping
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

function getFxSprayTex() {
  return loadTex('fx_spray.png', {
    clamp: true,
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 28)
      g.addColorStop(0, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.45, 'rgba(220,245,255,0.55)')
      g.addColorStop(1, 'rgba(200,240,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

function getFxSmokeTex() {
  return loadTex('fx_smoke.png', {
    clamp: true,
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      for (const [cx, cy, rad, a] of [[32, 34, 24, 0.45], [24, 28, 16, 0.35], [40, 28, 16, 0.35]]) {
        const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad)
        g.addColorStop(0, `rgba(255,255,255,${a})`)
        g.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = g
        ctx.fillRect(0, 0, w, h)
      }
    }),
  })
}

function getFxEmberTex() {
  return loadTex('fx_ember.png', {
    clamp: true,
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 28)
      g.addColorStop(0, 'rgba(255,255,240,1)')
      g.addColorStop(0.28, 'rgba(255,190,90,0.9)')
      g.addColorStop(0.65, 'rgba(255,90,20,0.4)')
      g.addColorStop(1, 'rgba(255,40,0,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

function getFxFoamTex() {
  return loadTex('fx_foam.png', {
    clamp: true,
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      ctx.strokeStyle = 'rgba(255,255,255,0.85)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(32, 32, 20, 0, TAU)
      ctx.stroke()
      const g = ctx.createRadialGradient(26, 26, 1, 32, 32, 22)
      g.addColorStop(0, 'rgba(255,255,255,0.7)')
      g.addColorStop(0.7, 'rgba(255,255,255,0.18)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

function getFxRingTex() {
  return loadTex('fx_ring.png', {
    clamp: true,
    makeFallback: () => makeCanvas(64, 64, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h)
      const g = ctx.createRadialGradient(32, 32, 12, 32, 32, 28)
      g.addColorStop(0, 'rgba(255,255,255,0)')
      g.addColorStop(0.45, 'rgba(255,255,255,0.95)')
      g.addColorStop(0.75, 'rgba(255,255,255,0.45)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
    }),
  })
}

const FX_TEX_GETTERS = {
  spray: getFxSprayTex,
  smoke: getFxSmokeTex,
  ember: getFxEmberTex,
  foam: getFxFoamTex,
  ring: getFxRingTex,
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
      for (let i = 0; i < 42; i++) {
        const y0 = rng() * h
        const dy = (rng() - 0.5) * 18
        const amp = (rng() - 0.5) * 0.45
        for (let x = 0; x < w; x++) {
          const y = ((Math.floor(y0 + (x / w) * dy) % h) + h) % h
          hf[y * w + x] += amp
        }
      }
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

const SIGN_ROWS = 5
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
  cascada: [2, 2, '💧', 'CASCADA', '#80deea'],
  embudo: [3, 2, '🌪', 'EMBUDO', '#ffcc80'],
  geiser: [0, 3, '⛲', 'GÉISER', '#4fe3ff'],
  erupcion: [1, 3, '🌋', 'ERUPCIÓN', '#ff7043'],
  turbina: [2, 3, '💨', 'TURBINA', '#fff176'],
  hielo_resbaloso: [3, 3, '🧊', 'HIELO', '#81d4fa'],
  pantano: [0, 4, '🫧', 'PANTANO', '#aed581'],
  portal: [1, 4, '✨', 'PORTAL', '#ea80fc'],
}

function getSignAtlasTex() {
  return loadTex(null, {
    srgb: true,
    repeat: [1, 1],
    makeFallback: () => makeCanvas(512, 640, (ctx) => {
      ctx.clearRect(0, 0, 512, 640)
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
  blade: (() => {
    const g = new THREE.BoxGeometry(0.18, 1.0, 0.04)
    g.translate(0, 0.5, 0)
    return g
  })(),
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

// ═══════════════════════════ MATERIALES Y SHADERS POR WAY ═══════════════════════════
// Multiplicadores moderados (1.1-1.35 base, ~1.9 solo en pulsos y bocas) para que el bloom no blanquee el color del tema.
const hot = (c, k = 1.25) => new THREE.Color(c).multiplyScalar(k)

function createTubeMat(id, focusU) {
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
    shader.uniforms.uFocus = focusU
    shader.uniforms.uFlowMap = { value: getFlowTex() }
    shader.uniforms.uThemeColor = { value: new THREE.Color(V.rail) }
    shader.uniforms.uGlassColor = { value: new THREE.Color(V.glass) }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTubeUv;\nvarying vec3 vTubeWorldNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTubeUv = uv;\nvTubeWorldNormal = normalize(mat3(modelMatrix) * objectNormal);')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform float uTime;\nuniform float uFocus;\nuniform sampler2D uFlowMap;\nuniform vec3 uThemeColor;\nuniform vec3 uGlassColor;\nvarying vec2 vTubeUv;\nvarying vec3 vTubeWorldNormal;'
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        float focusGlow = mix(0.18, 1.0, uFocus);
        vec3 tubeViewDir = normalize(vViewPosition);
        float tubeFresnel = pow(1.0 - abs(dot(normalize(normal), tubeViewDir)), 2.4);
        vec2 flowUv = vec2(fract(vTubeUv.x * 0.45 - uTime * 0.75), fract(vTubeUv.y * 2.0));
        vec4 flowTex = texture2D(uFlowMap, flowUv);
        float wavePulse = smoothstep(0.55, 1.0, sin(vTubeUv.x * 1.4 - uTime * 3.2) * 0.5 + 0.5);
        float flowMask = flowTex.a * (0.45 + 0.55 * wavePulse);
        float baseGrime = smoothstep(-0.25, -0.85, vTubeWorldNormal.y);
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + vec3(0.05, 0.04, 0.03), baseGrime * 0.45);
        totalEmissiveRadiance = totalEmissiveRadiance * focusGlow + (uGlassColor * tubeFresnel * 0.35 + uThemeColor * flowMask * 0.95) * focusGlow;`
      )
      .replace(
        '#include <dithering_fragment>',
        `gl_FragColor.a = clamp(gl_FragColor.a + tubeFresnel * 0.32 + flowMask * 0.5 + baseGrime * 0.12, 0.0, 0.92) * mix(0.18, 1.0, uFocus);
        #include <dithering_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'tube-flow-focus-v2'
  return m
}

function createRailMat(focusU) {
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, transparent: true })
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = SHARED_TIME
    shader.uniforms.uFocus = focusU
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRailUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRailUv = uv;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uFocus;\nvarying vec2 vRailUv;')
      .replace(
        '#include <opaque_fragment>',
        `float railPulse = pow(sin(vRailUv.x * 1.6 - uTime * 3.6) * 0.5 + 0.5, 4.0);
        outgoingLight *= (1.0 + railPulse * 0.72) * mix(0.25, 1.0, uFocus);
        diffuseColor.a *= mix(0.18, 1.0, uFocus);
        #include <opaque_fragment>`
      )
  }
  m.customProgramCacheKey = () => 'rail-pulse-focus-v2'
  return m
}

function createSignMat() {
  const m = new THREE.MeshBasicMaterial({ map: getSignAtlasTex(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 })
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aUvOffset;\nvarying vec2 vSignUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSignUv = uv * vec2(0.25, 0.2) + aUvOffset;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vSignUv;')
      .replace('#include <map_fragment>', 'vec4 sampledDiffuseColor = texture2D( map, vSignUv );\ndiffuseColor *= sampledDiffuseColor;')
  }
  m.customProgramCacheKey = () => 'sign-atlas-v2'
  return m
}

function createPartsMat(id) {
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
}

// Shader único y barato para todas las partículas de eventos (géiser, erupción, cascada, turbina, hielo, pantano, portal).
// aParam: x=mode (0..6), y=seed (0..1), z=speed, w=baseSize
const FX_VERT = /* glsl */ `
  attribute vec3 aDir;
  attribute vec4 aParam;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float mode = aParam.x;
    float seed = aParam.y;
    float spd = aParam.z;
    float sz = aParam.w;
    vec3 p = position;
    float alpha = 1.0;

    if (mode < 0.5) {
      // 0: géiser — chorro en pulsos que sube y cae
      float cycle = fract(uTime * 0.48 + seed * 0.15);
      float burst = smoothstep(0.0, 0.22, cycle) * (1.0 - smoothstep(0.55, 0.95, cycle));
      float h = sin(cycle * 3.14159) * (1.8 + seed * 3.2);
      p += aDir * h + vec3(cos(seed * 41.0) * 0.25, 0.0, sin(seed * 37.0) * 0.25) * cycle;
      alpha = burst * 0.92;
    } else if (mode < 1.5) {
      // 1: erupción — brasas y humo en pulsos rítmicos
      float life = fract(uTime * spd + seed);
      p += aDir * (life * 3.6) + vec3(sin(uTime * 2.0 + seed * 19.0) * 0.28, life * life * -0.9, cos(uTime * 1.8 + seed * 23.0) * 0.28);
      alpha = sin(life * 3.14159) * 0.95;
    } else if (mode < 2.5) {
      // 2: cascada — cortina de agua y gotas cayendo
      float life = fract(uTime * spd + seed);
      p.y -= life * 3.8;
      p.x += sin(life * 6.28 + seed * 13.0) * 0.14;
      alpha = sin(life * 3.14159) * 0.85;
    } else if (mode < 3.5) {
      // 3: turbina — rayas de viento a lo largo de aDir
      float life = fract(uTime * spd + seed);
      p += aDir * ((life - 0.35) * 4.5);
      alpha = sin(life * 3.14159) * 0.8;
    } else if (mode < 4.5) {
      // 4: hielo — brillos centelleantes
      float tw = pow(sin(uTime * spd + seed * 12.56) * 0.5 + 0.5, 3.0);
      alpha = 0.15 + tw * 0.85;
      sz *= (0.7 + tw * 0.7);
    } else if (mode < 5.5) {
      // 5: pantano — burbujas lentas que suben y estallan
      float life = fract(uTime * spd + seed);
      p += aDir * (life * 1.4);
      alpha = (1.0 - smoothstep(0.78, 1.0, life)) * smoothstep(0.0, 0.15, life) * 0.85;
      sz *= (0.55 + life * 0.85);
    } else {
      // 6: portal — espiral convergente
      float life = fract(uTime * spd + seed);
      float ang = seed * 6.28318 + uTime * 3.2 + life * 4.0;
      float rad = (1.0 - life) * 1.65;
      vec3 side = normalize(cross(aDir, abs(aDir.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
      vec3 bin = cross(aDir, side);
      p += (side * cos(ang) + bin * sin(ang)) * rad;
      alpha = sin(life * 3.14159) * 0.9;
    }

    vColor = aColor;
    vAlpha = alpha;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = sz * (320.0 / max(-mvPosition.z, 0.5));
    gl_Position = projectionMatrix * mvPosition;
  }
`

const FX_FRAG = /* glsl */ `
  uniform sampler2D uTex;
  uniform float uFocus;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 tex = texture2D(uTex, gl_PointCoord);
    float a = tex.a * vAlpha * mix(0.15, 1.0, uFocus);
    if (a < 0.02) discard;
    gl_FragColor = vec4(vColor * tex.rgb * mix(0.35, 1.0, uFocus), a);
  }
`

function createEventFxMat(texKey, focusU) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: SHARED_TIME,
      uFocus: focusU,
      uTex: { value: FX_TEX_GETTERS[texKey]() },
    },
    vertexShader: FX_VERT,
    fragmentShader: FX_FRAG,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    blending: texKey === 'smoke' ? THREE.NormalBlending : THREE.AdditiveBlending,
  })
}

function createWayMaterials(id, focusU) {
  const V = VISUALS[id]
  return {
    tube: createTubeMat(id, focusU),
    rail: createRailMat(focusU),
    glass: new THREE.MeshPhysicalMaterial({
      color: V.glass,
      normalMap: texNormal(id),
      normalScale: new THREE.Vector2(0.25, 0.25),
      transparent: true,
      opacity: 0.24,
      roughness: 0.06,
      metalness: 0.1,
      envMapIntensity: 1.5,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    deco: new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.12, flatShading: true }),
    decoA: new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true, transparent: true, opacity: 0.85, depthWrite: false }),
    glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
    sign: createSignMat(),
    dots: new THREE.PointsMaterial({
      color: hot(V.rail, 1.25),
      map: getSparkleTex(),
      size: 0.13,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.28,
      alphaTest: 0.02,
      depthWrite: false,
      toneMapped: false,
    }),
    parts: createPartsMat(id),
    basePartsA: V.parts.a ?? 0.6,
    fx: {
      spray: createEventFxMat('spray', focusU),
      smoke: createEventFxMat('smoke', focusU),
      ember: createEventFxMat('ember', focusU),
      foam: createEventFxMat('foam', focusU),
      ring: createEventFxMat('ring', focusU),
    },
  }
}

// ═══════════════════════════ HELPERS DE CONSTRUCCIÓN ═══════════════════════════
const put = (list, p, q, sx, sy = sx, sz = sx, c) => list.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz)), c })
const aim = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to)
const rr = (rng, [a, b]) => a + rng() * (b - a)
const pointsGeo = (arr) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
const METAL = new THREE.Color('#3a3f4a')

const EVENT_ACCENTS = {
  geiser: '#4fe3ff',
  erupcion: '#ff7043',
  cascada: '#5fe0ff',
  turbina: '#ffe866',
  hielo_resbaloso: '#9ee8ff',
  pantano: '#9be066',
  portal: '#e878ff',
}

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

function pushFxPoint(buckets, texKey, pos, dir, mode, seed, speed, size, col) {
  const b = buckets[texKey]
  b.pos.push(pos.x, pos.y, pos.z)
  b.dir.push(dir.x, dir.y, dir.z)
  b.param.push(mode, seed, speed, size)
  b.col.push(col.r, col.g, col.b)
}

function buildFxGeo(b) {
  if (!b.pos.length) return null
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3))
  g.setAttribute('aDir', new THREE.Float32BufferAttribute(b.dir, 3))
  g.setAttribute('aParam', new THREE.Float32BufferAttribute(b.param, 4))
  g.setAttribute('aColor', new THREE.Float32BufferAttribute(b.col, 3))
  return g
}

// ═══════════════════════════ LANDMARKS POR TEMA ═══════════════════════════
function addLandmark(way, V, out) {
  const lm = V.landmark
  if (!lm) return
  const solid = way.segments.filter((s) => !s.air)
  if (!solid.length) return

  const rng = mulberry32(way.idx * 4099 + 17)
  // 1 foco principal cerca de la mitad del way, desplazado lateralmente para silueta clara
  const mainSeg = solid.reduce((best, s) => (s.length > best.length ? s : best), solid[0])
  const u = 0.45 + (rng() - 0.5) * 0.2
  const P = mainSeg.curve.getPointAt(u)
  const T = mainSeg.curve.getTangentAt(u)
  const { N } = frameAt(T)
  const side = way.idx % 2 === 0 ? 1 : -1
  const basePos = P.clone().addScaledVector(N, side * (mainSeg.radius + 3.4)).addScaledVector(Y, -1.2)

  const c1 = new THREE.Color(lm.c1)
  const c2 = new THREE.Color(lm.c2)
  const glowC = hot(lm.glow, 1.35)
  const bannerCols = (V.banner?.c ?? [V.rib, V.rail]).map((c) => new THREE.Color(c))

  const { cones, cyls, boxes, octas, spheresA, lights, banners, rings, spinMeta, bladeMeta } = out

  // Puente/soporte de enlace sutil hacia el tubo
  put(boxes, P.clone().addScaledVector(N, side * (mainSeg.radius + 1.6)).addScaledVector(Y, -0.4), aim(X, N), 3.2, 0.22, 0.55, c1)

  if (lm.kind === 'obelisk') {
    put(boxes, basePos, IDENT, 1.9, 0.9, 1.9, c1)
    put(cones, basePos.clone().addScaledVector(Y, 0.9), IDENT, 1.25, 5.2, 1.25, c2)
    put(lights, basePos.clone().addScaledVector(Y, 6.7), IDENT, 0.65, 0.65, 0.65, glowC)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 6.7), ex: 0.3, ey: 0, ez: 0.2, sx: 0.5, sy: 1.2, sz: 0.3, scale: 1.15, c: glowC })
  } else if (lm.kind === 'tree_arch') {
    put(cyls, basePos, IDENT, 0.85, 3.6, 0.85, c1)
    put(cones, basePos.clone().addScaledVector(Y, 2.8), IDENT, 3.2, 2.8, 3.2, c2)
    put(cones, basePos.clone().addScaledVector(Y, 4.6), IDENT, 2.4, 2.4, 2.4, c2)
    put(lights, basePos.clone().addScaledVector(N, -side * 1.1).addScaledVector(Y, 2.7), IDENT, 0.32, 0.32, 0.32, glowC)
    put(lights, basePos.clone().addScaledVector(N, side * 1.1).addScaledVector(Y, 3.4), IDENT, 0.32, 0.32, 0.32, glowC)
  } else if (lm.kind === 'lighthouse') {
    put(cyls, basePos, IDENT, 1.5, 2.2, 1.5, c1)
    put(cyls, basePos.clone().addScaledVector(Y, 2.2), IDENT, 1.25, 2.0, 1.25, c2)
    put(cyls, basePos.clone().addScaledVector(Y, 4.2), IDENT, 1.05, 1.5, 1.05, c1)
    put(lights, basePos.clone().addScaledVector(Y, 6.1), IDENT, 0.95, 0.95, 0.95, glowC)
    put(cones, basePos.clone().addScaledVector(Y, 6.7), IDENT, 1.4, 1.0, 1.4, c2)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 6.1), ex: Math.PI / 2, ey: 0, ez: 0, sx: 0, sy: 1.5, sz: 0, scale: 1.6, c: glowC })
  } else if (lm.kind === 'pyramid') {
    put(boxes, basePos, IDENT, 3.6, 1.2, 3.6, c2)
    put(boxes, basePos.clone().addScaledVector(Y, 1.2), IDENT, 2.4, 1.2, 2.4, c1)
    put(boxes, basePos.clone().addScaledVector(Y, 2.4), IDENT, 1.3, 1.1, 1.3, c2)
    put(octas, basePos.clone().addScaledVector(Y, 3.8), IDENT, 0.9, 1.1, 0.9, glowC)
  } else if (lm.kind === 'ice_spire') {
    put(cones, basePos, IDENT, 1.6, 5.4, 1.6, c1)
    put(octas, basePos.clone().addScaledVector(Y, 2.2).addScaledVector(N, 0.8), IDENT, 0.9, 2.4, 0.9, c2)
    put(octas, basePos.clone().addScaledVector(Y, 1.8).addScaledVector(N, -0.8), IDENT, 0.8, 2.0, 0.8, c2)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 4.8), ex: 0.4, ey: 0.2, ez: 0, sx: 0.4, sy: 1.1, sz: 0.3, scale: 1.35, c: glowC })
  } else if (lm.kind === 'volcano_torii') {
    const pL = basePos.clone().addScaledVector(T, -1.2)
    const pR = basePos.clone().addScaledVector(T, 1.2)
    put(cyls, pL, IDENT, 0.55, 4.6, 0.55, c1)
    put(cyls, pR, IDENT, 0.55, 4.6, 0.55, c1)
    put(boxes, basePos.clone().addScaledVector(Y, 4.5), aim(X, T), 3.6, 0.45, 0.65, c2)
    put(lights, basePos.clone().addScaledVector(Y, 5.15), IDENT, 0.55, 0.7, 0.55, glowC)
  } else if (lm.kind === 'prism_tower') {
    put(boxes, basePos, IDENT, 1.8, 1.0, 1.8, c2)
    put(octas, basePos.clone().addScaledVector(Y, 3.2), IDENT, 1.5, 3.6, 1.5, c1)
    spinMeta.push({ pos: basePos.clone().addScaledVector(Y, 3.2), ex: 0.5, ey: 0, ez: 0.5, sx: 0.8, sy: 1.4, sz: 0.6, scale: 1.75, c: glowC })
    put(lights, basePos.clone().addScaledVector(Y, 3.2), IDENT, 0.65, 0.65, 0.65, glowC)
  } else if (lm.kind === 'windmill') {
    put(cones, basePos, IDENT, 1.8, 4.8, 1.8, c1)
    const hub = basePos.clone().addScaledVector(Y, 4.2).addScaledVector(N, -side * 0.75)
    put(lights, hub, IDENT, 0.5, 0.5, 0.5, glowC)
    for (let k = 0; k < 4; k++) {
      bladeMeta.push({ pos: hub, axis: N.clone().multiplyScalar(-side), angle0: (k * Math.PI) / 2, speed: 1.4, len: 2.3, width: 0.35, c: k % 2 === 0 ? c2 : glowC })
    }
  } else if (lm.kind === 'neon_gate') {
    const pL = basePos.clone().addScaledVector(T, -1.3)
    const pR = basePos.clone().addScaledVector(T, 1.3)
    put(boxes, pL, IDENT, 0.45, 4.8, 0.45, c1)
    put(boxes, pR, IDENT, 0.45, 4.8, 0.45, c1)
    put(rings, basePos.clone().addScaledVector(Y, 4.6), aim(Z, T), 1.6, 1.6, 1.6, glowC)
    put(rings, basePos.clone().addScaledVector(Y, 4.6), aim(Z, T), 1.15, 1.15, 1.15, hot(c2, 1.3))
  } else {
    // flower_gazebo
    put(cyls, basePos, IDENT, 1.6, 0.5, 1.6, c1)
    for (let k = 0; k < 4; k++) {
      const a = (k * TAU) / 4
      put(cyls, basePos.clone().add(new THREE.Vector3(Math.cos(a) * 1.1, 0.5, Math.sin(a) * 1.1)), IDENT, 0.16, 2.8, 0.16, c1)
    }
    put(spheresA, basePos.clone().addScaledVector(Y, 3.6), IDENT, 3.1, 1.2, 3.1, c2)
    put(lights, basePos.clone().addScaledVector(Y, 4.2), IDENT, 0.65, 0.65, 0.65, glowC)
  }

  // Estandarte con emblema del tema junto al landmark
  const flagPos = basePos.clone().addScaledVector(T, 1.6).addScaledVector(Y, 1.2)
  put(cyls, basePos.clone().addScaledVector(T, 1.6), IDENT, 0.08, 2.6, 0.08, METAL)
  put(banners, flagPos.clone().addScaledVector(Y, 1.3), IDENT, 1.15, 1.15, 1.15, bannerCols[0])
}

// ═══════════════════════════ EVENTOS ANIMADOS + TEASERS ═══════════════════════════
function addSegmentEvent(s, V, out) {
  const ev = s.event || (EVENT_ACCENTS[s.kind] ? s.kind : null)
  if (!ev) return
  const c = s.curve
  const R = s.radius
  const accHex = EVENT_ACCENTS[ev] ?? V.rail
  const accCol = hot(accHex, 1.35)
  const { cones, cyls, lights, rings, spinMeta, bladeMeta, pulseMeta, discs, fxBuckets } = out

  // Teaser de curiosidad en la entrada del tramo: baliza pulsante + 2 luces guía
  const P0 = c.getPointAt(0.04)
  const T0 = c.getTangentAt(0.04)
  const { N: N0 } = frameAt(T0)
  const pulseRate = (s.speedK ?? 1) > 1.05 ? 6.0 : (s.speedK ?? 1) < 0.9 ? 2.4 : 4.0
  pulseMeta.push({ pos: P0, q: aim(Z, T0), baseScale: [R * 1.32, R * 1.32, R * 1.32], amp: [0.14, 0.14, 0.14], freq: pulseRate, phase: s.idx * 0.7, c: accCol, kind: 'ring' })
  put(lights, P0.clone().addScaledVector(N0, R + 0.35), IDENT, 0.22, 0.22, 0.22, accCol)
  put(lights, P0.clone().addScaledVector(N0, -(R + 0.35)), IDENT, 0.22, 0.22, 0.22, accCol)

  const Pmid = c.getPointAt(0.5)
  const Tmid = c.getTangentAt(0.5)
  const { N: Nmid } = frameAt(Tmid)
  const rng = mulberry32(s.idx * 613 + 29)

  if (ev === 'geiser') {
    const baseP = Pmid.clone().addScaledVector(Y, -R * 0.9)
    put(cones, baseP, IDENT, R * 2.2, 0.75, R * 2.2, new THREE.Color('#475c6c'))
    pulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.5), q: IDENT, baseScale: [R * 0.6, 2.8, R * 0.6], amp: [0.18, 2.4, 0.18], freq: 2.2, phase: s.idx, c: hot('#7be8ff', 1.25), kind: 'cyl' })
    pulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 0.25), q: aim(Z, Y), baseScale: [R * 1.1, R * 1.1, R * 1.1], amp: [0.9, 0.9, 0.9], freq: 2.2, phase: s.idx, c: new THREE.Color('#e0faff'), kind: 'ring' })
    for (let i = 0; i < 16; i++) {
      pushFxPoint(fxBuckets, 'spray', baseP.clone().addScaledVector(Y, 0.6), Y, 0, rng(), 1.0, 0.36 + rng() * 0.2, new THREE.Color('#b8f4ff'))
    }
    for (let i = 0; i < 8; i++) {
      pushFxPoint(fxBuckets, 'foam', baseP.clone().addScaledVector(Nmid, (rng() - 0.5) * R).addScaledVector(Y, 0.25), Y, 5, rng(), 0.55, 0.32, new THREE.Color('#ffffff'))
    }
  } else if (ev === 'erupcion') {
    const Pcr = c.getPointAt(0.14)
    const baseP = Pcr.clone().addScaledVector(Y, -R * 0.85)
    put(cones, baseP, IDENT, R * 2.8, 1.35, R * 2.8, new THREE.Color('#2b1b17'))
    pulseMeta.push({ pos: baseP.clone().addScaledVector(Y, 1.1), q: IDENT, baseScale: [R * 0.85, R * 0.45, R * 0.85], amp: [0.22, 0.35, 0.22], freq: 3.1, phase: s.idx, c: hot('#ff5a1f', 1.65), kind: 'light' })
    for (let i = 0; i < 18; i++) {
      const dir = new THREE.Vector3((rng() - 0.5) * 0.7, 0.9 + rng() * 0.7, (rng() - 0.5) * 0.7).normalize()
      pushFxPoint(fxBuckets, 'ember', baseP.clone().addScaledVector(Y, 1.1), dir, 1, rng(), 0.75 + rng() * 0.4, 0.34 + rng() * 0.18, new THREE.Color('#ff8a2f'))
    }
    for (let i = 0; i < 10; i++) {
      pushFxPoint(fxBuckets, 'smoke', baseP.clone().addScaledVector(Y, 1.3), Y, 1, rng(), 0.32 + rng() * 0.15, 0.65 + rng() * 0.3, new THREE.Color('#5a4a44'))
    }
  } else if (ev === 'cascada') {
    for (const u of [0.28, 0.55, 0.78]) {
      const Pw = c.getPointAt(u)
      put(discs, Pw.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 3.1, 0.12, R * 3.1)
      for (let i = 0; i < 8; i++) {
        const offP = Pw.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.4).addScaledVector(Y, R * 1.6)
        pushFxPoint(fxBuckets, 'spray', offP, Y, 2, rng(), 0.65 + rng() * 0.35, 0.3 + rng() * 0.18, new THREE.Color('#a8ecff'))
      }
      for (let i = 0; i < 5; i++) {
        pushFxPoint(fxBuckets, 'foam', Pw.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.5).addScaledVector(Y, -R * 0.7), Y, 5, rng(), 0.45, 0.35, new THREE.Color('#eefaff'))
      }
    }
  } else if (ev === 'turbina') {
    for (const u of [0.3, 0.7]) {
      const Pt = c.getPointAt(u)
      const Tt = c.getTangentAt(u)
      put(rings, Pt, aim(Z, Tt), R * 1.38, R * 1.38, R * 1.38, METAL)
      for (let k = 0; k < 4; k++) {
        bladeMeta.push({ pos: Pt, axis: Tt, angle0: (k * Math.PI) / 2, speed: 5.5, len: R * 1.25, width: 0.22, c: hot('#ffe866', 1.25) })
      }
      for (let i = 0; i < 10; i++) {
        const { N: Nt, B: Bt } = frameAt(Tt)
        const ang = rng() * TAU
        const p = Pt.clone().addScaledVector(Nt, Math.cos(ang) * R * 0.6).addScaledVector(Bt, Math.sin(ang) * R * 0.6)
        pushFxPoint(fxBuckets, 'spray', p, Tt, 3, rng(), 1.4 + rng() * 0.6, 0.24, new THREE.Color('#fff7b0'))
      }
    }
  } else if (ev === 'hielo_resbaloso') {
    const nCry = 6
    for (let i = 0; i < nCry; i++) {
      const u = (i + 0.5) / nCry
      const Pi = c.getPointAt(u)
      const Ti = c.getTangentAt(u)
      const { N: Ni } = frameAt(Ti)
      const side = i % 2 === 0 ? 1 : -1
      const cp = Pi.clone().addScaledVector(Ni, side * (R + 0.15))
      put(cones, cp, aim(Y, Ni.clone().multiplyScalar(side).addScaledVector(Y, 0.6).normalize()), 0.35, 1.15, 0.35, new THREE.Color('#bdeeff'))
      pushFxPoint(fxBuckets, 'ring', Pi.clone().addScaledVector(Y, R * 0.6), Y, 4, rng(), 2.8 + rng() * 1.5, 0.35, new THREE.Color('#d8f8ff'))
    }
  } else if (ev === 'pantano') {
    for (const u of [0.25, 0.5, 0.75]) {
      const Pp = c.getPointAt(u)
      put(cyls, Pp.clone().addScaledVector(Y, -R * 0.85), IDENT, R * 2.4, 0.16, R * 2.4, new THREE.Color('#3b5928'))
      for (let i = 0; i < 6; i++) {
        const bp = Pp.clone().addScaledVector(Nmid, (rng() - 0.5) * R * 1.4).addScaledVector(Y, -R * 0.65)
        pushFxPoint(fxBuckets, 'foam', bp, Y, 5, rng(), 0.28 + rng() * 0.2, 0.34 + rng() * 0.18, new THREE.Color('#9be066'))
      }
      pushFxPoint(fxBuckets, 'smoke', Pp.clone().addScaledVector(Y, -R * 0.3), Y, 5, rng(), 0.2, 0.8, new THREE.Color('#5a7a42'))
    }
  } else if (ev === 'portal') {
    for (const u of [0.15, 0.85]) {
      const Ppt = c.getPointAt(u)
      const Tpt = c.getTangentAt(u)
      const q = aim(Z, Tpt)
      const e0 = new THREE.Euler().setFromQuaternion(q)
      spinMeta.push({ pos: Ppt, ex: e0.x, ey: e0.y, ez: e0.z, sx: 0.6, sy: 1.5, sz: 1.2, scale: R * 1.55, c: hot('#ea80fc', 1.45) })
      spinMeta.push({ pos: Ppt, ex: e0.x, ey: e0.y, ez: e0.z, sx: -0.9, sy: 1.1, sz: -1.6, scale: R * 1.18, c: hot('#4fe3ff', 1.4) })
      for (let i = 0; i < 12; i++) {
        pushFxPoint(fxBuckets, 'ring', Ppt, Tpt, 6, rng(), 0.7 + rng() * 0.4, 0.3, new THREE.Color('#ea80fc'))
      }
    }
  }
}

// ═══════════════════════════ BUILD WAY ═══════════════════════════
function build(way) {
  const V = VISUALS[way.theme.id]
  const r = way.params.radius
  const ribBase = hot(V.rib, 1.25)
  const mouthC = hot(V.rail, 1.85)
  const dim = hot(V.rib, 0.8)
  const archC = new THREE.Color(V.arch?.c ?? '#3a3f4a')
  const poleC = new THREE.Color(V.lamp?.pole ?? '#3a3f4a')
  const lampC = hot(V.lamp?.c ?? V.rail, 1.32)
  const arrowC = hot(V.rail, 1.25)
  const bannerCols = (V.banner?.c ?? [V.rib, V.rail]).map((c) => new THREE.Color(c))

  const tubes = []; const rails = []
  const rings = []; const solids = []; const cones = []; const boxes = []; const octas = []
  const spheres = []; const spheresA = []; const discs = []; const funnels = []; const dots = []
  const lights = []; const banners = []; const arrows = []; const signs = []
  const spinMeta = []; const bladeMeta = []; const pulseMeta = []
  const fxBuckets = {
    spray: { pos: [], dir: [], param: [], col: [] },
    smoke: { pos: [], dir: [], param: [], col: [] },
    ember: { pos: [], dir: [], param: [], col: [] },
    foam: { pos: [], dir: [], param: [], col: [] },
    ring: { pos: [], dir: [], param: [], col: [] },
  }

  const solid = way.segments.filter((s) => !s.air)

  for (const s of way.segments) {
    const c = s.curve; const R = s.radius
    const ribC = routeColor(V.rib, s.route, 1.25)
    const railCol = routeColor(V.rail, s.route, 1.18)

    // Perfil de ruta (rápida / lenta / espectacular)
    const prof = s.route >= 0 ? way.routes?.[s.route]?.profile : null
    const isFast = s.route >= 0 && (prof ? prof.speed === 'rapida' : s.route === 0)
    const isSlow = s.route >= 0 && (prof ? prof.speed === 'lenta' : s.route === 1)
    const isSpec = s.route >= 0 && !isFast && !isSlow

    // Eventos + teasers de curiosidad
    addSegmentEvent(s, V, { cones, cyls: solids, lights, rings, spinMeta, bladeMeta, pulseMeta, discs, fxBuckets })

    if (s.air) {
      const P0 = c.getPoint(0); const T0 = c.getTangent(0); const P1 = c.getPoint(1); const T1 = c.getTangent(1)
      const n = Math.ceil(s.length / 0.9)
      for (let i = 1; i < n; i++) dots.push(...c.getPoint(i / n).toArray())
      for (const u of [0.25, 0.5, 0.75]) {
        arrows.push({ m: new THREE.Matrix4().compose(c.getPointAt(u), aim(Z, c.getTangentAt(u)), new THREE.Vector3(0.75, 0.75, 0.9)), c: arrowC })
      }
      if (s.kind === 'trampolin') {
        const p = P0.clone().addScaledVector(Y, -0.35)
        put(solids, p, IDENT, R * 3.4, 0.3, R * 3.4, new THREE.Color(V.rib).multiplyScalar(0.5))
        put(rings, p.clone().addScaledVector(Y, 0.3), aim(Z, Y), R * 1.7, R * 1.7, R * 1.7, mouthC)
        put(rings, P0.clone().addScaledVector(T0, 0.9), aim(Z, T0), R * 1.35, R * 1.35, R * 1.35, mouthC)
      } else if (s.kind === 'canon' || s.kind === 'erupcion') {
        ;[[0.5, 1.15], [1.1, 1.3], [1.7, 1.5]].forEach(([b, k]) => put(rings, P0.clone().addScaledVector(T0, -b), aim(Z, T0), R * k, R * k, R * k, METAL))
        put(rings, P0, aim(Z, T0), R * 1.2, R * 1.2, R * 1.2, hot('#ff7a2f', 1.9))
        ;[0.8, 1.7].forEach((d, idx) => put(rings, P0.clone().addScaledVector(T0, d), aim(Z, T0), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), R * (1.28 + idx * 0.14), hot('#ff9a3c', 1.75)))
      } else {
        put(rings, P0, aim(Z, T0), R * 1.12, R * 1.12, R * 1.12, mouthC)
        put(solids, P0.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 2.6, 0.18, R * 2.6, METAL)
      }
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

    const fr = c.computeFrenetFrames(steps, false); const pts = []
    for (let i = 0; i <= steps; i++) {
      const a = 0.9
      pts.push(c.getPointAt(i / steps).addScaledVector(fr.normals[i], Math.cos(a) * R * 0.97).addScaledVector(fr.binormals[i], Math.sin(a) * R * 0.97))
    }
    const railGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, 0.06, 4, false)
    scaleTubeUvX(railGeo, s.length)
    colorizeGeo(railGeo, railCol)
    rails.push(railGeo)

    // costillas + banderines/luces colgantes
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
        const lCol = isSlow ? hot('#ffd99e', 1.28) : isSpec ? hot(bannerCols[i % bannerCols.length], 1.35) : lampC
        put(lights, bp.clone().addScaledVector(Y, -0.55), IDENT, 0.2, 0.2, 0.2, lCol)
      }
    }

    // acento visual por perfil de ruta
    if (isSlow && s.length > 5) {
      const nFlora = Math.max(1, Math.floor(s.length / 9))
      for (let i = 0; i < nFlora; i++) {
        const u = (i + 0.5) / nFlora
        const P = c.getPointAt(u); const T = c.getTangentAt(u)
        const { N } = frameAt(T)
        const side = i % 2 === 0 ? 1 : -1
        const fp = P.clone().addScaledVector(N, side * (R + 0.35)).addScaledVector(Y, -0.25)
        put(spheresA, fp, IDENT, 0.42, 0.32, 0.42, new THREE.Color('#68b86b'))
        put(lights, fp.clone().addScaledVector(Y, 0.28), IDENT, 0.16, 0.16, 0.16, hot('#ffe2a8', 1.25))
      }
    } else if (isSpec && s.length > 5) {
      const nFl = Math.max(1, Math.floor(s.length / 10))
      for (let i = 0; i < nFl; i++) {
        const u = (i + 0.5) / nFl
        const P = c.getPointAt(u); const T = c.getTangentAt(u)
        const { N } = frameAt(T)
        const fp = P.clone().addScaledVector(N, (i % 2 === 0 ? 1 : -1) * (R + 0.28)).addScaledVector(Y, 0.4)
        put(lights, fp, IDENT, 0.24, 0.34, 0.24, hot(bannerCols[i % bannerCols.length], 1.38))
      }
    }

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
      put(lights, baseP.clone().addScaledVector(Y, 1.45).addScaledVector(N, -side * 0.48), IDENT, 0.28, 0.28, 0.28, isSlow ? hot('#ffe0a3', 1.3) : lampC)
    }

    // flechas direccionales en el lomo del tubo (más densas en rutas rápidas)
    const arrStep = isFast ? 4.4 : 7.5
    const arrCol = isFast ? hot(V.rail, 1.38) : arrowC
    const nArr = Math.max(1, Math.floor(s.length / arrStep))
    for (let i = 0; i < nArr; i++) {
      const u = (i + 0.5) / nArr
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const topDir = Y.clone().addScaledVector(T, -T.dot(Y))
      if (topDir.lengthSq() < 0.01) topDir.copy(X)
      topDir.normalize()
      put(arrows, P.clone().addScaledVector(topDir, R + 0.22), aim(Z, T), 0.72, 0.72, isFast ? 1.05 : 0.85, arrCol)
    }

    // cartelito del obstáculo / evento al inicio del tramo
    const signKind = SIGN_CELLS[evSignKey(s)] ? evSignKey(s) : null
    if (s.kind !== 'salida' && s.kind !== 'llegada' && signKind) {
      const u = Math.min(0.12, 1.8 / Math.max(s.length, 1))
      const P = c.getPointAt(u); const T = c.getTangentAt(u)
      const { N } = frameAt(T)
      const signBase = P.clone().addScaledVector(N, R + 0.35).addScaledVector(Y, R * 0.4)
      put(solids, signBase, IDENT, 0.06, 1.25, 0.06, METAL)
      const [col, row] = SIGN_CELLS[signKind]
      const signQ = aim(Z, N.clone().addScaledVector(T, -0.4).normalize())
      signs.push({
        m: new THREE.Matrix4().compose(signBase.clone().addScaledVector(Y, 1.35), signQ, new THREE.Vector3(1, 1, 1)),
        uv: [col * 0.25, 1 - (row + 1) / SIGN_ROWS],
      })
    }

    if (s.kind === 'embudo') {
      const A = c.getPoint(0); const B = c.getPoint(1); const ctr = new THREE.Vector3()
      for (let i = 0; i < 24; i++) ctr.add(c.getPoint(0.02 + (i / 23) * 0.28))
      ctr.divideScalar(24)
      const d = B.clone().sub(ctr).normalize(); const h = -A.clone().sub(B).dot(d)
      const rad = A.clone().sub(B).addScaledVector(d, h).length()
      if (h > 0.5) put(funnels, B.clone().addScaledVector(d, -h), aim(Y, d), rad * 2, h, rad * 2)
    } else if (s.kind === 'cascada' && !s.event) {
      let last = -9
      for (let i = 0; i <= 40; i++) {
        if (Math.abs(c.getTangentAt(i / 40).y) < 0.3 && i - last > 3) { last = i; put(discs, c.getPointAt(i / 40).addScaledVector(Y, -R - 0.15), IDENT, R * 3.2, 0.14, R * 3.2) }
      }
    }
  }

  // Landmarks distintivos del tema
  addLandmark(way, V, { cones, cyls: solids, boxes, octas, spheresA, lights, banners, rings, spinMeta, bladeMeta })

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
    rings, solids, cones, boxes, octas, spheres, spheresA, discs, funnels, decor,
    lights, banners, arrows, signs, spinMeta, bladeMeta, pulseMeta,
    dots: dots.length ? pointsGeo(dots) : null,
    parts: pointsGeo(pp),
    fxGeos: {
      spray: buildFxGeo(fxBuckets.spray),
      smoke: buildFxGeo(fxBuckets.smoke),
      ember: buildFxGeo(fxBuckets.ember),
      foam: buildFxGeo(fxBuckets.foam),
      ring: buildFxGeo(fxBuckets.ring),
    },
  }
}

function evSignKey(s) {
  if (s.event && SIGN_CELLS[s.event]) return s.event
  return s.kind
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

function SignInst({ items, mat }) {
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
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

const _spinMat = new THREE.Matrix4()
const _spinQ = new THREE.Quaternion()
const _spinE = new THREE.Euler()
const _spinS = new THREE.Vector3()
const _rotQ = new THREE.Quaternion()

function SpinRings({ meta, mat }) {
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
  return <instancedMesh ref={ref} args={[GEO.torus, mat, meta.length]} frustumCulled={false} />
}

function SpinBlades({ meta, mat }) {
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
      _spinQ.setFromUnitVectors(Z, it.axis)
      _rotQ.setFromAxisAngle(it.axis, it.angle0 + t * it.speed)
      _spinQ.premultiply(_rotQ)
      _spinS.set(it.width, it.len, 1)
      _spinMat.compose(it.pos, _spinQ, _spinS)
      o.setMatrixAt(i, _spinMat)
    }
    o.instanceMatrix.needsUpdate = true
  })
  if (!meta.length) return null
  return <instancedMesh ref={ref} args={[GEO.blade, mat, meta.length]} frustumCulled={false} />
}

function PulseInst({ geo, mat, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => o.setColorAt(i, it.c))
    if (o.instanceColor) o.instanceColor.needsUpdate = true
  }, [items])
  useFrame(({ clock }) => {
    const o = ref.current
    if (!o) return
    const t = clock.elapsedTime
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const p = Math.pow(Math.max(0, Math.sin(t * it.freq + it.phase)), 2)
      _spinS.set(it.baseScale[0] + it.amp[0] * p, it.baseScale[1] + it.amp[1] * p, it.baseScale[2] + it.amp[2] * p)
      _spinMat.compose(it.pos, it.q, _spinS)
      o.setMatrixAt(i, _spinMat)
    }
    o.instanceMatrix.needsUpdate = true
  })
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} />
}

function Way({ way, focused }) {
  const id = way.theme.id
  const focusU = useMemo(() => ({ value: 1 }), [])
  const mats = useMemo(() => createWayMaterials(id, focusU), [id, focusU])
  const d = useMemo(() => build(way), [way])

  const pulseRings = useMemo(() => d.pulseMeta.filter((p) => p.kind === 'ring'), [d.pulseMeta])
  const pulseCyls = useMemo(() => d.pulseMeta.filter((p) => p.kind === 'cyl'), [d.pulseMeta])
  const pulseLights = useMemo(() => d.pulseMeta.filter((p) => p.kind === 'light'), [d.pulseMeta])

  useFrame((_, dt) => {
    const target = focused ? 1 : 0
    const f = THREE.MathUtils.damp(focusU.value, target, 6.5, Math.min(dt, 0.1))
    focusU.value = f

    mats.glass.opacity = THREE.MathUtils.lerp(0.05, 0.24, f)
    mats.dots.opacity = THREE.MathUtils.lerp(0.05, 0.28, f)
    mats.parts.opacity = THREE.MathUtils.lerp(0.1, mats.basePartsA, f)
    mats.decoA.opacity = THREE.MathUtils.lerp(0.14, 0.85, f)
    mats.sign.opacity = THREE.MathUtils.lerp(0.18, 1.0, f)

    const isDim = f < 0.98
    mats.deco.transparent = isDim
    mats.deco.depthWrite = !isDim
    mats.deco.opacity = THREE.MathUtils.lerp(0.2, 1.0, f)
    mats.deco.color.setScalar(THREE.MathUtils.lerp(0.45, 1.0, f))

    mats.glow.transparent = isDim
    mats.glow.opacity = THREE.MathUtils.lerp(0.18, 1.0, f)
    mats.glow.color.setScalar(THREE.MathUtils.lerp(0.28, 1.0, f))
  })

  return (
    <group>
      {d.tube && <mesh geometry={d.tube} material={mats.tube} />}
      {d.rail && <mesh geometry={d.rail} material={mats.rail} />}
      <Inst geo={GEO.torus} mat={mats.glow} items={d.rings} />
      <Inst geo={GEO.cyl} mat={mats.deco} items={d.solids} cast />
      <Inst geo={GEO.cone} mat={mats.deco} items={d.cones} cast />
      <Inst geo={GEO.box} mat={mats.deco} items={d.boxes} cast />
      <Inst geo={GEO.octa} mat={mats.deco} items={d.octas} cast />
      <Inst geo={GEO.sphere} mat={mats.glass} items={d.spheres} />
      <Inst geo={GEO.sphere} mat={mats.decoA} items={d.spheresA} />
      <Inst geo={GEO.cyl} mat={mats.glass} items={d.discs} />
      <Inst geo={GEO.funnel} mat={mats.glass} items={d.funnels} />
      <Inst geo={GEO.sphere} mat={mats.glow} items={d.lights} />
      <Inst geo={GEO.banner} mat={mats.deco} items={d.banners} />
      <Inst geo={GEO.arrow} mat={mats.glow} items={d.arrows} />
      <SpinRings meta={d.spinMeta} mat={mats.glow} />
      <SpinBlades meta={d.bladeMeta} mat={mats.deco} />
      <PulseInst geo={GEO.torus} mat={mats.glow} items={pulseRings} />
      <PulseInst geo={GEO.cyl} mat={mats.decoA} items={pulseCyls} />
      <PulseInst geo={GEO.sphere} mat={mats.glow} items={pulseLights} />
      <SignInst items={d.signs} mat={mats.sign} />
      {d.decor.map(({ p, items }, i) => {
        const solidMat = !p.e && (p.a ?? 1) >= 1
        return <Inst key={i} geo={GEO_BY[p.k]} mat={p.e ? mats.glow : solidMat ? mats.deco : mats.decoA} items={items} cast={solidMat} />
      })}
      {d.dots && <points geometry={d.dots} material={mats.dots} frustumCulled={false} />}
      <points geometry={d.parts} material={mats.parts} frustumCulled={false} />
      {Object.entries(d.fxGeos).map(([k, geo]) =>
        geo ? <points key={k} geometry={geo} material={mats.fx[k]} frustumCulled={false} /> : null
      )}
    </group>
  )
}

export default function Paths({ world, focusWay = null }) {
  useFrame(({ clock }) => {
    SHARED_TIME.value = clock.elapsedTime
  })
  return (
    <>
      {world.ways.map((w) => <Way key={w.idx} way={w} focused={focusWay == null || focusWay === w.idx} />)}
      {world.circuits.map((c) => {
        const active = focusWay == null || c.ways.some((w) => w.idx === focusWay)
        return (
          <Html key={c.idx} position={c.mid.clone().add(new THREE.Vector3(0, 2.4, 0))} center distanceFactor={22} zIndexRange={[5, 0]}>
            <div className="tag" style={{ borderColor: VISUALS[c.theme.id].rail, opacity: active ? 1 : 0.22, transition: 'opacity 0.35s ease' }}>
              {c.theme.emoji} {c.theme.name.replace('Camino ', '')}
            </div>
          </Html>
        )
      })}
    </>
  )
}
