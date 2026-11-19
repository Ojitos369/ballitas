import * as THREE from 'three'

// Foco de la vista de planeta: un único juego de uniforms compartido por todos los materiales del planeta.
// k = 0 en mapa y camino (todo se ve exactamente igual que sin foco); k → 1 cuando la ballita seguida
// (Seguir o POV) está en un planeta. Cerca de la ballita y de su destino todo queda nítido; lejos se apaga
// y se desatura, para que la jerarquía sea: ballita → destino → calle → barrio → cielo.
export const FASES_PLANETA = new Set(['toDest', 'at', 'toPort'])

export const FOCO = {
  b: null, // ballita seguida (la fija Main): null si no se sigue a nadie
  nodo: -1, // planeta de la ballita seguida (fase de planeta) o -1
  destKind: null, // 'puntos' | 'energia' | 'puerto' | null
  k: { value: 0 },
  pos: { value: new THREE.Vector3(0, -1e6, 0) }, // ballita (posición visual, sobre la superficie)
  dest: { value: new THREE.Vector3(0, -1e6, 0) }, // destino actual o puerto de salida
  ojo: { value: new THREE.Vector3(0, -1e6, 0) }, // centro visual de la ballita: lo que hay entre ella y la cámara se aclara
  r: { value: 12 }, // radio nítido alrededor de ballita y destino
}

// Sondeo con ?stats=1 (mismo criterio que __ballitasDebug).
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stats') === '1') window.__ballitasFoco = FOCO

export function setFocoBallita(b) {
  FOCO.b = b || null
}

/** Ballita seguida y en planeta: nodo, o -1. */
export function nodoEnFoco(b = FOCO.b) {
  if (!b || !FASES_PLANETA.has(b.phase) || !Number.isInteger(b.node)) return -1
  return b.node
}

const encadenar = (prev, fn) => (shader, renderer) => {
  if (prev) prev(shader, renderer)
  fn(shader, renderer)
}

/**
 * Aplica el foco a un material estándar (una sola variante de programa con uniforms compartidos).
 * - lejos de ballita y destino: desatura y oscurece (proporcional a k);
 * - `lift`: [color, cantidad] acerca el albedo a un tono de luminosidad media (moles casi negras → edificios legibles);
 * - `metal`: factor de metalicidad dentro del planeta (sin mapa de entorno, el metal se veía negro).
 * Con k = 0 el resultado es idéntico al material original.
 */
export function conFoco(mat, { desat = 0.55, oscurece = 0.35, lift = null, metal = 1, xray = true, relleno = 0.7, plano = 0 } = {}) {
  if (!mat || mat.userData._foco) return mat
  mat.userData._foco = true
  const planoU = { value: plano }
  const liftU = { value: new THREE.Vector4() }
  if (lift) {
    const c = new THREE.Color(lift[0])
    liftU.value.set(c.r, c.g, c.b, lift[1])
  }
  // relleno: luz propia mínima (fracción del albedo) para la cara nocturna del planeta; los materiales sin luz no la usan
  const params = { value: new THREE.Vector4(desat, oscurece, metal, mat.isMeshStandardMaterial ? relleno : 0) }
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''
  mat.onBeforeCompile = encadenar(mat.onBeforeCompile, (sh) => {
    Object.assign(sh.uniforms, { uFocoK: FOCO.k, uFocoPos: FOCO.pos, uFocoDest: FOCO.dest, uFocoR: FOCO.r, uFocoOjo: FOCO.ojo, uFocoLift: liftU, uFocoPar: params, uFocoPlano: planoU })
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFocoW;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 _fw = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          _fw = instanceMatrix * _fw;
        #endif
        vFocoW = (modelMatrix * _fw).xyz;`)
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vFocoW;
        uniform float uFocoK;
        uniform vec3 uFocoPos;
        uniform vec3 uFocoDest;
        uniform float uFocoR;
        uniform vec4 uFocoLift;
        uniform vec4 uFocoPar;
        uniform vec3 uFocoOjo;
        uniform float uFocoPlano;
        float _focoIgn(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }`)
      // Visión despejada: lo que queda en el cono cámara → ballita se disuelve por trama (edificio del
      // destino en la estancia, casco del puerto, pilares). Solo con k > 0.
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        if (${xray ? 'uFocoK' : '0.0'} > 0.01) {
          vec3 _ab = uFocoOjo - cameraPosition;
          float _abl = dot(_ab, _ab);
          float _h = clamp(dot(vFocoW - cameraPosition, _ab) / max(_abl, 1e-4), 0.0, 1.0);
          float _dr = length(vFocoW - cameraPosition - _ab * _h);
          float _rr = mix(0.5, 2.3, _h);
          if (_h < 0.985 && _dr < _rr) {
            float _a = smoothstep(_rr, _rr * 0.55, _dr) * uFocoK * 0.92;
            if (_a > _focoIgn(gl_FragCoord.xy)) discard;
          }
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb = mix(diffuseColor.rgb, uFocoLift.rgb, uFocoLift.a * uFocoK);`)
      // plano: dentro del planeta se aplana el mapa de normales (en piezas torneadas sus UV radiales pintaban rayos)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        normal = normalize(mix(normal, nonPerturbedNormal, uFocoPlano * uFocoK));`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        metalnessFactor *= mix(1.0, uFocoPar.z, uFocoK);`)
      .replace('#include <opaque_fragment>', `outgoingLight = max(outgoingLight, diffuseColor.rgb * uFocoPar.w * uFocoK);
        #include <opaque_fragment>`)
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        if (uFocoK > 0.001) {
          float _fd = min(distance(vFocoW, uFocoPos), distance(vFocoW, uFocoDest) * 1.6);
          float _ff = smoothstep(uFocoR, uFocoR * 3.2, _fd) * uFocoK;
          float _fl = dot(gl_FragColor.rgb, vec3(0.299, 0.587, 0.114));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(_fl), _ff * uFocoPar.x) * (1.0 - _ff * uFocoPar.y);
        }`)
  })
  mat.customProgramCacheKey = () => `${prevKey ? `${prevKey}|` : ''}foco-v2${xray ? '' : '-nx'}`
  mat.needsUpdate = true
  return mat
}
