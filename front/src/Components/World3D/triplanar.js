import * as THREE from 'three'
import { markShared } from './vida/base.jsx'

const BASE = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const cache = new Map()
const loader = new THREE.TextureLoader()
const textures = new Map()

const CATEGORY_PREFIX = { terreno: 'terreno', fachada: 'fachada', techo: 'techo', carrera: 'carrera' }

function textureFor(theme, category) {
  const key = `${category}:${theme}`
  if (textures.has(key)) return textures.get(key)
  const prefix = CATEGORY_PREFIX[category] || 'terreno'
  const fallback = `${prefix}_${theme}_mix.webp`
  const texture = loader.load(`${BASE}${fallback}`, undefined, undefined, () => {
    if (prefix === 'carrera') return
    loader.load(`${BASE}${prefix}_${prefix === 'terreno' ? 'pasto' : 'estuco'}.webp`, (next) => {
      next.colorSpace = THREE.SRGBColorSpace
      next.wrapS = next.wrapT = THREE.RepeatWrapping
      texture.image = next.image
      texture.needsUpdate = true
    })
  })
  texture.colorSpace = THREE.SRGBColorSpace
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping
  texture.generateMipmaps = true
  texture.minFilter = THREE.LinearMipmapLinearFilter
  textures.set(key, texture)
  return texture
}

/** Material cacheado: texturas por proyección triplanar en coordenadas mundo (GLB sin UV). */
export function triplanarMaterial(theme, category = 'terreno', { glow = 0, standard = false } = {}) {
  const key = `${theme}:${category}:${glow}:${standard}`
  if (cache.has(key)) return cache.get(key)
  const texture = textureFor(theme, category)
  const material = standard
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.84, metalness: 0.02 })
    : new THREE.MeshLambertMaterial({ vertexColors: true })
  const glowUniform = { value: glow }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTriTex = { value: texture }
    shader.uniforms.uTriScale = { value: category === 'carrera' ? 1.8 : 2.4 }
    shader.uniforms.uTriGlow = glowUniform
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
      .replace('#include <common>', '#include <common>\nuniform sampler2D uTriTex;\nuniform float uTriScale;\nuniform float uTriGlow;\nvarying vec3 vTriWorldPos;')
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        vec3 triN = normalize(transpose(mat3(viewMatrix)) * normal);
        vec3 triW = pow(abs(triN), vec3(4.0)); triW /= max(triW.x + triW.y + triW.z, 0.0001);
        vec3 triP = vTriWorldPos * uTriScale;
        vec3 triColor = texture2D(uTriTex, triP.yz).rgb * triW.x
                      + texture2D(uTriTex, triP.zx).rgb * triW.y
                      + texture2D(uTriTex, triP.xy).rgb * triW.z;
        diffuseColor.rgb *= triColor;`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uTriGlow;')
  }
  material.customProgramCacheKey = () => `triplanar-v1:${category}:${standard}`
  cache.set(key, markShared(material))
  return material
}

export function categoriaModelo(name) {
  if (/rampa|puente|fuente|cascada|crater|geiser|g%C3%A9iser|volcan_|geoda|estalagmita|lapida|monolith|altar|rock|crystal|concha|iglu|saguaro|tronco|piedra/i.test(name)) return 'terreno'
  if (/casita|kiosco|iglu|gazebo|nido|casa|edificio|fachada/i.test(name)) return 'fachada'
  if (/roof|techo|molino|farol|lamp|globo|arco/i.test(name)) return 'techo'
  return 'terreno'
}
