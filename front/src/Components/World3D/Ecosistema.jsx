// Ecosistema y transiciones naturales de cada camino (ver ecosistema.js). Un InstancedMesh por forma/pieza y camino,
// un único material compartido y animado en el vertex shader con el uniform de tiempo de Paths (sin useFrame propio).
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { buildEcosistema, ecoGeometry, modelosVersion, suscribirModelos } from './ecosistema.js'
import { cargarModelosEco } from './Modelos.jsx'

const matCache = new WeakMap()

// Iluminación de objetos de camino sin luces reales: emisivo base suave del color propio + rim (fresnel) del color del tema.
// Máximo ≈ base+rim < 1 sobre el color: queda bajo el umbral del Bloom (solo los emisivos reales florecen).
export const OBJ_LIGHT = { base: 0.2, rim: 0.3, power: 2.4 }
export function withObjLight(mat, tint = '#aabbff') {
  const prev = mat.onBeforeCompile
  const prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : ''
  const u = { value: new THREE.Vector3(OBJ_LIGHT.base, OBJ_LIGHT.rim, OBJ_LIGHT.power) }
  const t = { value: new THREE.Color(tint) }
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r)
    sh.uniforms.uObjL = u; sh.uniforms.uObjTint = t
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uObjL;\nuniform vec3 uObjTint;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float _ond = abs(dot(normalize(normal), normalize(vViewPosition)));
        totalEmissiveRadiance += diffuseColor.rgb * uObjL.x + uObjTint * (pow(clamp(1.0 - _ond, 0.0, 1.0), uObjL.z) * uObjL.y);
      }`)
  }
  mat.customProgramCacheKey = () => `${prevKey}|objlight-v1`
  return mat
}

/** Material único (se comparte entre caminos y se precalienta en Paths: no se desecha por camino). */
export function ecoMaterial(time) {
  let m = matCache.get(time)
  if (m) return m
  m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05, flatShading: true, side: THREE.DoubleSide })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = `uniform float uTime;
attribute vec4 aFx;
attribute vec4 aCen;
varying float vGlow;
` + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float eK = aFx.x; float eSp = aFx.z; float eAm = aFx.w;
      #ifdef USE_INSTANCING
      float eH = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
      #else
      float eH = 0.0;
      #endif
      float eP = aFx.y + eH * 6.2831853;
      float eT = uTime * eSp * 6.2831853 + eP;
      float eF = fract(uTime * eSp + eP / 6.2831853);
      float eGl = aCen.w;
      vec3 eC = aCen.xyz;
      vec3 eL = transformed - eC;
      if (eK > 0.5 && eK < 1.5) { // vaivén: se curva más cuanto más alto
        float b = max(transformed.y, 0.0) * eAm;
        transformed.x += sin(eT) * b; transformed.z += cos(eT * 0.8) * b * 0.6;
      } else if (eK < 2.5) { // partícula que sube (o cae si amp < 0) y se apaga
        float life = (1.0 - eF) * smoothstep(0.0, 0.12, eF);
        transformed = eC + eL * life + vec3(sin(eP * 3.0 + eF * 5.0) * abs(eAm) * 0.12, eF * eAm, cos(eP * 5.0 + eF * 4.0) * abs(eAm) * 0.12);
      } else if (eK < 3.5) { // pulso de brillo
        eGl *= 0.3 + 0.7 * max(0.0, sin(eT));
      } else if (eK < 4.5) { // órbita
        transformed += vec3(sin(eT) * eAm, sin(eT * 1.7) * eAm * 0.4, cos(eT * 0.8) * eAm);
      } else if (eK < 5.5) { // flotar
        transformed.y += sin(eT) * eAm;
      } else if (eK < 6.5) { // géiser: ciclo de erupción de la columna
        float e = 0.04 + 0.96 * smoothstep(0.0, 0.18, eF) * (1.0 - smoothstep(0.55, 0.9, eF));
        transformed.y *= e; transformed.xz *= 0.6 + 0.4 * e;
        eGl *= 0.5 + 0.5 * e;
      } else if (eK < 7.5) { // giro sobre el eje del tubo
        float an = uTime * eSp * 6.2831853; float cs = cos(an); float sn = sin(an);
        transformed.xy = mat2(cs, sn, -sn, cs) * transformed.xy;
      } else if (eK < 8.5) { // flujo de lava / energía
        eGl *= 0.65 + 0.35 * sin(eT + transformed.z * 3.0 + transformed.x * 2.0);
      } else if (eK < 9.5) { // erupción balística: sale del cráter en arco y se apaga
        float life = (1.0 - eF * 0.7) * smoothstep(0.0, 0.05, eF);
        vec2 dr = vec2(cos(eP * 7.3), sin(eP * 7.3));
        transformed = eC + eL * life + vec3(dr.x * eF * eAm * 0.7, eAm * 4.0 * eF * (1.0 - eF), dr.y * eF * eAm * 0.7);
        eGl *= 1.0 - eF * 0.6;
      } else if (eK < 10.5) { // giro sobre Y
        float an = uTime * eSp * 6.2831853; float cs = cos(an); float sn = sin(an);
        transformed.xz = mat2(cs, sn, -sn, cs) * transformed.xz;
      } else { // cascada: franjas que bajan (frecuencia en espacio de mundo)
        #ifdef USE_INSTANCING
        float wy = (instanceMatrix * vec4(transformed, 1.0)).y;
        #else
        float wy = transformed.y;
        #endif
        eGl *= 0.6 + 0.4 * sin(wy * eAm - eT);
      }
      vGlow = eGl;`,
    )
    sh.fragmentShader = 'varying float vGlow;\n' + sh.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor.rgb * vGlow;',
    )
  }
  m.customProgramCacheKey = () => 'eco-v1'
  withObjLight(m)
  matCache.set(time, m)
  return m
}

function EInst({ k, items, maxS, mat, ver }) {
  const ref = useRef()
  const geo = useMemo(() => ecoGeometry(k), [k, k[0] === 'm' ? ver : 0]) // las claves m: cambian al cargar el GLB
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    o.instanceColor.needsUpdate = true
    o.computeBoundingSphere()
    o.boundingSphere.radius += 6 + 6 * maxS // holgura: el vertex shader desplaza (sube, órbita, erupciona)
  }, [items, maxS, geo])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} raycast={() => null} />
}

export default function Ecosistema({ way, time, getFrames, sample }) {
  const groups = useMemo(() => buildEcosistema(way, getFrames, sample), [way, getFrames, sample])
  const mat = useMemo(() => ecoMaterial(time), [time])
  const ver = useSyncExternalStore(suscribirModelos, modelosVersion)
  useEffect(() => { cargarModelosEco(groups.filter((g) => g.key[0] === 'm').map((g) => g.key.split(':')[1])) }, [groups])
  return (
    <group>
      {groups.map((g) => <EInst key={g.key} k={g.key} items={g.items} maxS={g.maxS} mat={mat} ver={ver} />)}
    </group>
  )
}
