import * as THREE from 'three'
import { markShared } from './vida/base.jsx'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const cache = new Map()
const loader = new THREE.TextureLoader()
const textures = new Map()

export const TRI_TIME = { value: 0 }

export const THEME_FX = {
  bosque: {
    mode: 0, c1: '#8cff66', c2: '#38c958', fog: '#0b2214',
    hemi: ['#a8f5b2', '#1a3820', 0.55], point: ['#b8ff78', 2.4, 55],
    rim: 0.22, lift: 0.18,
  },
  mar: {
    mode: 1, c1: '#5cf2ff', c2: '#2498e8', fog: '#072236',
    hemi: ['#8ae8ff', '#10344f', 0.6], point: ['#4ceeff', 2.8, 60],
    rim: 0.28, lift: 0.2,
  },
  desierto: {
    mode: 2, c1: '#ffd27a', c2: '#ff8e3c', fog: '#24160b',
    hemi: ['#ffe2a8', '#52341b', 0.58], point: ['#ffc866', 2.5, 58],
    rim: 0.24, lift: 0.2,
  },
  hielo: {
    mode: 3, c1: '#64ffd6', c2: '#88c8ff', fog: '#0b1e32',
    hemi: ['#d4f4ff', '#1f4263', 0.62], point: ['#88eaff', 2.8, 60],
    rim: 0.3, lift: 0.22,
  },
  volcan: {
    mode: 4, c1: '#ff5214', c2: '#ffaa28', fog: '#210a05',
    hemi: ['#ff9c66', '#2b120c', 0.56], point: ['#ff6a24', 3.4, 62],
    rim: 0.28, lift: 0.28,
  },
  cristal: {
    mode: 5, c1: '#7df9ff', c2: '#ff7de9', fog: '#130b29',
    hemi: ['#d8c4ff', '#261a4f', 0.6], point: ['#b88cff', 3.0, 60],
    rim: 0.34, lift: 0.24,
  },
  nubes: {
    mode: 6, c1: '#ffe270', c2: '#fff4c2', fog: '#1b2644',
    hemi: ['#fff4d6', '#566fa8', 0.65], point: ['#ffdf78', 2.6, 60],
    rim: 0.3, lift: 0.22,
  },
  neon: {
    mode: 7, c1: '#2bffe8', c2: '#ff2bd6', fog: '#09071a',
    hemi: ['#80f5ff', '#2a0e38', 0.54], point: ['#ff3be0', 3.2, 60],
    rim: 0.34, lift: 0.22,
  },
  jardin: {
    mode: 8, c1: '#ff96c8', c2: '#ffe078', fog: '#122118',
    hemi: ['#ffe8f2', '#284a2c', 0.62], point: ['#ffb8dc', 2.4, 56],
    rim: 0.24, lift: 0.2,
  },
  sombrio: {
    mode: 9, c1: '#a864ff', c2: '#6b32c4', fog: '#170a2b',
    hemi: ['#b88cff', '#180e29', 0.54], point: ['#b06bff', 3.2, 60],
    rim: 0.32, lift: 0.28,
  },
}

export const themeFx = (id) => THEME_FX[id] ?? THEME_FX.bosque

const CATEGORY_TEX = {
  terreno: {
    sombrio: 'terreno_tierra_oscura.webp',
    bosque: 'terreno_musgo.webp',
    mar: 'terreno_coral.webp',
    desierto: 'terreno_arena.webp',
    hielo: 'terreno_hielo_agrietado.webp',
    volcan: 'terreno_lava.webp',
    cristal: 'terreno_cristal.webp',
    nubes: 'terreno_nube.webp',
    neon: 'terreno_adoquin_neon.webp',
    jardin: 'terreno_pasto.webp',
  },
  fachada: {
    sombrio: 'fachada_basalto.webp',
    bosque: 'fachada_madera_verde.webp',
    mar: 'fachada_coral.webp',
    desierto: 'fachada_arenisca.webp',
    hielo: 'fachada_hielo.webp',
    volcan: 'fachada_basalto.webp',
    cristal: 'fachada_cristal.webp',
    nubes: 'fachada_nube.webp',
    neon: 'fachada_neon.webp',
    jardin: 'fachada_castillo_musgo.webp',
  },
  techo: {
    sombrio: 'techo_pizarra.webp',
    bosque: 'techo_musgo.webp',
    mar: 'techo_metal_azul.webp',
    desierto: 'techo_arenisca.webp',
    hielo: 'techo_nieve.webp',
    volcan: 'techo_lava.webp',
    cristal: 'techo_cristal.webp',
    nubes: 'techo_nubes.webp',
    neon: 'techo_adoquin.webp',
    jardin: 'techo_cobre.webp',
  },
}

function textureFor(theme, category) {
  const key = `${category}:${theme}`
  if (textures.has(key)) return textures.get(key)
  const cat = CATEGORY_TEX[category] ? category : 'terreno'
  const file = cat === 'carrera'
    ? 'carrera_circuito_neon.webp'
    : (CATEGORY_TEX[cat]?.[theme] ?? (cat === 'terreno' ? 'terreno_pasto.webp' : cat === 'fachada' ? 'fachada_estuco.webp' : 'techo_piedra.webp'))
  const texture = loader.load(`${BASE}${file}`)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  textures.set(key, texture)
  return texture
}

/** Material cacheado: texturas triplanar en coordenadas mundo + shader temático único por uniforms. */
export function triplanarMaterial(theme, category = 'terreno', { glow = 0, standard = false, texStrength = 0.28, rim = null } = {}) {
  const fx = themeFx(theme)
  const rimVal = rim ?? fx.rim
  const key = `${theme}:${category}:${glow}:${standard}:${texStrength}:${rimVal}`
  if (cache.has(key)) return cache.get(key)
  const texture = textureFor(theme, category)
  const material = standard
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.02 })
    : new THREE.MeshLambertMaterial({ vertexColors: true })

  const U = {
    uTriTex: { value: texture },
    uTriScale: { value: category === 'carrera' ? 1.8 : 0.45 },
    uTriGlow: { value: glow },
    uTriMix: { value: texStrength },
    uTriRim: { value: rimVal },
    uTriLift: { value: fx.lift },
    uTriTime: TRI_TIME,
    uFxMode: { value: fx.mode },
    uFxC1: { value: new THREE.Color(fx.c1) },
    uFxC2: { value: new THREE.Color(fx.c2) },
    uFxFog: { value: new THREE.Color(fx.fog) },
  }

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, U)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vTriWorldPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vec4 triWorldPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
        triWorldPos = instanceMatrix * triWorldPos;
        #endif
        triWorldPos = modelMatrix * triWorldPos;
        vTriWorldPos = triWorldPos.xyz;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform sampler2D uTriTex;
        uniform float uTriScale;
        uniform float uTriGlow;
        uniform float uTriMix;
        uniform float uTriRim;
        uniform float uTriLift;
        uniform float uTriTime;
        uniform float uFxMode;
        uniform vec3 uFxC1;
        uniform vec3 uFxC2;
        uniform vec3 uFxFog;
        varying vec3 vTriWorldPos;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 triN = normalize(transpose(mat3(viewMatrix)) * normal);
        vec3 triW = pow(abs(triN), vec3(4.0)); triW /= max(triW.x + triW.y + triW.z, 0.0001);
        vec3 triP = vTriWorldPos * uTriScale;
        vec3 triColor = texture2D(uTriTex, triP.yz).rgb * triW.x
                      + texture2D(uTriTex, triP.zx).rgb * triW.y
                      + texture2D(uTriTex, triP.xy).rgb * triW.z;
        diffuseColor.rgb *= mix(vec3(1.0), triColor * 1.38, uTriMix);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float _triNdv = abs(dot(normalize(normal), normalize(vViewPosition)));
        float _triFres = pow(clamp(1.0 - _triNdv, 0.0, 1.0), 2.1);
        vec3 _wp = vTriWorldPos;
        float _t = uTriTime;
        vec3 _fx = vec3(0.0);
        if (uFxMode < 0.5) {
          float dapple = 0.5 + 0.5 * sin(_wp.x * 0.22 + _t * 0.65) * cos(_wp.z * 0.22 - _t * 0.5);
          _fx = uFxC1 * (dapple * 0.14) + uFxC2 * (_triFres * uTriRim);
        } else if (uFxMode < 1.5) {
          float ca = pow(0.5 + 0.5 * sin(_wp.x * 0.42 + _t * 1.7 + sin(_wp.z * 0.32 - _t)), 3.0)
                   * (0.5 + 0.5 * cos(_wp.z * 0.38 - _t * 1.3));
          _fx = mix(uFxC2, uFxC1, ca) * (ca * 0.46 + _triFres * uTriRim);
        } else if (uFxMode < 2.5) {
          float rip = pow(0.5 + 0.5 * sin(_wp.x * 0.18 + _wp.z * 0.24 + _t * 0.8), 2.0);
          _fx = uFxC1 * (rip * 0.14 + _triFres * uTriRim) + uFxC2 * (_triFres * 0.12);
        } else if (uFxMode < 3.5) {
          float au = smoothstep(0.28, 0.95, 0.5 + 0.5 * sin(_wp.y * 0.16 + _wp.x * 0.08 + _t * 1.05 + sin(_wp.z * 0.1 - _t * 0.6)));
          _fx = mix(uFxC2, uFxC1, au) * (au * 0.34 + _triFres * uTriRim * 1.15);
        } else if (uFxMode < 4.5) {
          float crk = pow(0.5 + 0.5 * sin(_wp.x * 0.34 + _wp.y * 0.42 - _t * 2.0 + sin(_wp.z * 0.28)), 4.0);
          _fx = mix(uFxC1, uFxC2, crk) * (crk * 0.42 + _triFres * uTriRim * 1.15);
        } else if (uFxMode < 5.5) {
          vec3 irid = 0.5 + 0.5 * cos(6.28318 * (_triNdv * 1.15 + _t * 0.14 + (_wp.x + _wp.y + _wp.z) * 0.032 + vec3(0.0, 0.33, 0.67)));
          _fx = mix(uFxC1, irid, 0.72) * (0.14 + _triFres * (uTriRim * 1.35));
        } else if (uFxMode < 6.5) {
          float gleam = smoothstep(0.35, 0.95, 0.5 + 0.5 * sin(_wp.y * 0.18 + _wp.z * 0.08 + _t * 0.85));
          _fx = mix(uFxC2, uFxC1, _triFres) * (gleam * 0.16 + _triFres * uTriRim * 1.25);
        } else if (uFxMode < 7.5) {
          float swp = pow(max(0.0, sin(_wp.z * 0.18 + _wp.x * 0.12 - _t * 3.0)), 6.0);
          float band = smoothstep(0.78, 0.96, fract(_wp.y * 0.26));
          _fx = mix(uFxC1, uFxC2, 0.5 + 0.5 * sin(_wp.x * 0.14 + _t)) * (swp * 0.55 + band * 0.26 + _triFres * uTriRim);
        } else if (uFxMode < 8.5) {
          float blm = 0.5 + 0.5 * sin(_wp.x * 0.25 + _wp.z * 0.25 + _t * 0.9);
          _fx = mix(uFxC1, uFxC2, blm) * (0.12 + _triFres * uTriRim);
        } else {
          float mist = smoothstep(0.22, 0.92, 0.5 + 0.5 * sin(_wp.x * 0.15 - _t * 0.85 + cos(_wp.z * 0.16 + _t * 0.55)));
          _fx = mix(uFxC2, uFxC1, mist) * (mist * 0.28 + _triFres * uTriRim * 1.2);
        }
        float _distFog = smoothstep(55.0, 175.0, length(vViewPosition)) * 0.45;
        float _hemi = 0.5 + 0.5 * normalize(vTriWorldPos).y;
        vec3 _hemiTint = mix(uFxC2, uFxC1, _hemi) * 0.12;
        totalEmissiveRadiance += diffuseColor.rgb * (uTriGlow + uTriLift) + _hemiTint + _fx + uFxFog * _distFog;`)
  }
  material.customProgramCacheKey = () => `triplanar-v4:${category}:${standard}`
  cache.set(key, markShared(material))
  return material
}

export function categoriaModelo(name) {
  if (/rampa|puente|fuente|cascada|crater|geiser|g%C3%A9iser|volcan_|geoda|estalagmita|lapida|monolith|altar|rock|crystal|concha|iglu|saguaro|tronco|piedra/i.test(name)) return 'terreno'
  if (/casita|kiosco|iglu|gazebo|nido|casa|edificio|fachada/i.test(name)) return 'fachada'
  if (/roof|techo|molino|farol|lamp|globo|arco/i.test(name)) return 'techo'
  return 'terreno'
}
