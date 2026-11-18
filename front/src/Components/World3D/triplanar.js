import * as THREE from 'three'
import { markShared } from './vida/base.jsx'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const cache = new Map()
const loader = new THREE.TextureLoader()
const textures = new Map()

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

/** Material cacheado: texturas por proyección triplanar en coordenadas mundo (GLB sin UV). */
export function triplanarMaterial(theme, category = 'terreno', { glow = 0, standard = false, texStrength = 0.28, rim = 0.16 } = {}) {
  const key = `${theme}:${category}:${glow}:${standard}:${texStrength}:${rim}`
  if (cache.has(key)) return cache.get(key)
  const texture = textureFor(theme, category)
  const material = standard
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.02 })
    : new THREE.MeshLambertMaterial({ vertexColors: true })
  const glowUniform = { value: glow }
  const mixUniform = { value: texStrength }
  const rimUniform = { value: rim }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriTex = { value: texture }
    shader.uniforms.uTriScale = { value: category === 'carrera' ? 1.8 : 0.45 }
    shader.uniforms.uTriGlow = glowUniform
    shader.uniforms.uTriMix = mixUniform
    shader.uniforms.uTriRim = rimUniform
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
      .replace('#include <common>', '#include <common>\nuniform sampler2D uTriTex;\nuniform float uTriScale;\nuniform float uTriGlow;\nuniform float uTriMix;\nuniform float uTriRim;\nvarying vec3 vTriWorldPos;')
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
        float _triFres = pow(clamp(1.0 - _triNdv, 0.0, 1.0), 2.2) * uTriRim;
        totalEmissiveRadiance += diffuseColor.rgb * (uTriGlow + _triFres + 0.14);`)
  }
  material.customProgramCacheKey = () => `triplanar-v3:${category}:${standard}`
  cache.set(key, markShared(material))
  return material
}

export function categoriaModelo(name) {
  if (/rampa|puente|fuente|cascada|crater|geiser|g%C3%A9iser|volcan_|geoda|estalagmita|lapida|monolith|altar|rock|crystal|concha|iglu|saguaro|tronco|piedra/i.test(name)) return 'terreno'
  if (/casita|kiosco|iglu|gazebo|nido|casa|edificio|fachada/i.test(name)) return 'fachada'
  if (/roof|techo|molino|farol|lamp|globo|arco/i.test(name)) return 'techo'
  return 'terreno'
}
