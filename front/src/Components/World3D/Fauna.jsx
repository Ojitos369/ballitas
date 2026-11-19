// Fauna por camino: animales low-poly procedurales, un InstancedMesh por especie y camino.
// Cada animal patrulla una elipse alrededor de su ancla (sobre el tubo, o volando/nadando cerca de él) y se anima
// (aleteo, ondulación, contoneo, pulso) en el vertex shader con un uniform de tiempo compartido: sin useFrame propio.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'
import { FAUNA } from './themes.js'
import { colocar, mundoDe, nuevoLocal } from './colisionObjetos.js'

const MAX_PER_SPECIES = 60
const _m = new THREE.Matrix4()
const _e = new THREE.Euler()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _p = new THREE.Vector3()

// Pieza con color de vértice (sin uv/normal: el material es sin luz).
function part(geo, col, pos = [0, 0, 0], scl = [1, 1, 1], rot = [0, 0, 0]) {
  const g = geo.index ? geo.toNonIndexed() : geo
  g.deleteAttribute('uv'); g.deleteAttribute('normal')
  g.applyMatrix4(_m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scl)))
  const n = g.attributes.position.count
  const c = new THREE.Color(col)
  const a = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3))
  return g
}

function wings(span, chord, sweep, col, pairs = 1) {
  const out = []
  for (let p = 0; p < pairs; p++) {
    const z0 = p * -chord * 0.7
    const k = p ? 0.7 : 1
    for (const sd of [1, -1]) {
      const v = [[0.05, 0, 0.2 * chord], [span * k, 0, 0.2 * chord - sweep], [span * 0.9 * k, 0, -0.35 * chord - sweep], [0.05, 0, -0.3 * chord]]
      const t = [0, 1, 2, 0, 2, 3]
      const pos = new Float32Array(18)
      t.forEach((vi, i) => { pos[i * 3] = v[vi][0] * sd; pos[i * 3 + 1] = v[vi][1]; pos[i * 3 + 2] = v[vi][2] + z0 })
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      out.push(part(g, col))
    }
  }
  return out
}

const sph = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h)
const cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s)
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z)
const PI2 = Math.PI / 2

// anim: 1 aleteo, 2 ondulación, 3 contoneo, 4 pulso de medusa. bob: vaivén vertical (unidades del modelo).
const SPECIES = {
  bat: { anim: 1, bob: 0.4, build: () => [part(sph(0.1), '#999', [0, 0, 0], [1, 0.9, 2]), part(sph(0.07), '#999', [0, 0.02, 0.2]), ...wings(0.55, 0.35, 0.25, '#fff')] },
  bird: { anim: 1, bob: 0.4, build: () => [part(sph(0.1), '#ddd', [0, 0, 0], [1, 1, 2.2]), part(sph(0.07), '#fff', [0, 0.03, 0.26]), part(cone(0.03, 0.1), '#ffb347', [0, 0.03, 0.36], [1, 1, 1], [PI2, 0, 0]), ...wings(0.5, 0.22, 0.08, '#fff')] },
  butterfly: { anim: 1, bob: 0.5, glow: 2.6, build: () => [part(sph(0.04), '#555', [0, 0, 0], [1, 1, 4]), ...wings(0.34, 0.3, 0, '#fff', 2)] },
  fish: { anim: 2, bob: 0.2, glow: 2, build: () => [part(sph(0.3, 7, 5), '#fff', [0, 0, 0.1], [0.5, 0.75, 1.5]), part(cone(0.2, 0.4), '#ddd', [0, 0, -0.62], [0.2, 1, 1], [PI2, 0, 0]), part(cone(0.1, 0.25, 4), '#ddd', [0, 0.25, 0], [0.2, 1, 1])] },
  jelly: { anim: 4, bob: 0.5, glow: 3.4, build: () => [part(new THREE.SphereGeometry(0.35, 8, 5, 0, Math.PI * 2, 0, PI2), '#fff', [0, 0.1, 0]), ...[[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([a, b]) => part(cone(0.03, 0.6, 4), '#ccc', [a * 0.14, -0.2, b * 0.14], [1, 1, 1], [Math.PI, 0, 0]))] },
  lizard: { anim: 2, bob: 0, build: () => [part(sph(0.3, 6, 4), '#fff', [0, 0.1, 0.05], [0.4, 0.28, 1.1]), part(sph(0.1), '#eee', [0, 0.12, 0.5]), part(cone(0.1, 0.8), '#ddd', [0, 0.07, -0.7], [1, 0.5, 1], [-PI2, 0, 0]), ...[[1, 0.2], [-1, 0.2], [1, -0.2], [-1, -0.2]].map(([a, b]) => part(box(0.05, 0.1, 0.05), '#bbb', [a * 0.14, 0.04, b]))] },
  penguin: { anim: 3, bob: 0, build: () => [part(sph(0.3, 6, 5), '#26324a', [0, 0.42, 0], [1, 1.4, 0.9]), part(sph(0.25, 6, 5), '#ffffff', [0, 0.4, 0.09], [1, 1.35, 0.85]), part(sph(0.17, 6, 4), '#26324a', [0, 0.88, 0]), part(cone(0.04, 0.12, 4), '#ff9a2b', [0, 0.86, 0.19], [1, 1, 1], [PI2, 0, 0]), part(box(0.1, 0.03, 0.16), '#ff9a2b', [0.1, 0.01, 0.05]), part(box(0.1, 0.03, 0.16), '#ff9a2b', [-0.1, 0.01, 0.05])] },
}

const geoCache = new Map()
function speciesGeo(k) {
  let g = geoCache.get(k)
  if (!g) {
    g = mergeGeometries(SPECIES[k].build(), false)
    const p = g.attributes.position; const c = g.attributes.color
    for (let i = 0; i < p.count; i++) { // sombreado barato por altura
      const f = 0.72 + 0.28 * THREE.MathUtils.clamp(p.getY(i) * 1.2 + 0.5, 0, 1)
      c.setXYZ(i, c.getX(i) * f, c.getY(i) * f, c.getZ(i) * f)
    }
    geoCache.set(k, g)
  }
  return g
}

function makeMaterial(k, time) {
  const sp = SPECIES[k]
  const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
  m.defines = { ANIM: sp.anim }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.uniforms.uBob = { value: sp.bob }
    sh.uniforms.uGlow = { value: sp.glow ?? 1 }
    // Glow propio: base algo más viva + extremidades (alas, cola, cabeza) en HDR leve (~1.6x) y tirando a blanco-cálido:
    // solo los bordes superan el umbral 1.0 del Bloom y se distinguen del neón de los caminos.
    sh.fragmentShader = 'uniform float uGlow;\nvarying float vExt;\n' + sh.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.4 + vec3(0.6, 0.55, 0.45), vExt * 0.35) * uGlow * (1.1 + 0.5 * vExt);`, // >1 = HDR
    )
    sh.vertexShader = 'uniform float uTime;\nuniform float uBob;\nattribute vec4 aMove;\nvarying float vExt;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vExt = smoothstep(0.22, 0.75, length(transformed));
      float ph = aMove.y;
      float ang = uTime * aMove.x + ph;
      vec2 fw = normalize(vec2(-sin(ang) * aMove.z, cos(ang) * aMove.w) * sign(aMove.x) + vec2(0.0, 1e-4));
      #if ANIM == 1
      transformed.y += sin(uTime * 9.0 + ph * 3.0) * abs(transformed.x) * 1.1;
      #elif ANIM == 2
      transformed.x += sin(uTime * 7.0 + ph * 3.0 + transformed.z * 7.0) * 0.12 * (0.6 - transformed.z);
      #elif ANIM == 3
      transformed.x += sin(uTime * 6.0 + ph * 3.0) * 0.08 * transformed.y;
      #elif ANIM == 4
      float pu = 1.0 + 0.18 * sin(uTime * 3.0 + ph);
      transformed.xz *= pu; transformed.y *= 2.0 - pu;
      #endif
      transformed = vec3(transformed.x * fw.y + transformed.z * fw.x, transformed.y + sin(uTime * 1.7 + ph * 2.0) * uBob, -transformed.x * fw.x + transformed.z * fw.y);
      transformed += vec3(cos(ang) * aMove.z, 0.0, sin(ang) * aMove.w);`,
    )
  }
  m.toneMapped = false
  m.customProgramCacheKey = () => 'fauna-glow' + sp.anim
  return m
}

/** Un material por animación (misma clave de programa que la fauna real), para el precalentado del mapa. */
export function faunaWarmup(time) {
  const porAnim = new Map()
  for (const k of Object.keys(SPECIES)) if (!porAnim.has(SPECIES[k].anim)) porAnim.set(SPECIES[k].anim, makeMaterial(k, time))
  return [...porAnim.values()]
}

const rr = (rng, [a, b]) => a + (b - a) * rng()
const boundR = (k) => { const g = speciesGeo(k); g.boundingSphere ?? g.computeBoundingSphere(); return g.boundingSphere.radius }

function buildFauna(way, getFrames, sample) {
  const specs = FAUNA[way.theme.id] ?? []
  const rng = mulberry32(way.idx * 4421 + 311)
  const out = []
  const world = mundoDe(way)
  const local = nuevoLocal() // la fauna no se atraviesa entre sí
  specs.forEach((spec) => {
    const items = []; const mv = []
    const cols = spec.c.map((c) => new THREE.Color(c))
    for (const s of way.segments) {
      if (s.air || items.length >= MAX_PER_SPECIES) continue
      const R = s.radius
      const frames = getFrames(s)
      const n = Math.round(s.length * spec.d)
      for (let i = 0; i < n && items.length < MAX_PER_SPECIES; i++) {
        const f = sample(frames, 0.04 + 0.92 * ((i + rng() * 0.8) / n))
        const top = spec.gap === 'top'
        if (top && f.up.y < 0.85) continue
        const z = f.T.clone().addScaledVector(f.up, -f.T.dot(f.up)).normalize()
        const quat = new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(new THREE.Vector3().crossVectors(f.up, z), f.up, z))
        const pos = f.pos.clone()
        if (top) {
          const l = (rng() - 0.5) * R * 0.9
          pos.addScaledVector(f.right, l).addScaledVector(f.up, Math.sqrt(R * R - l * l) - 0.03)
        } else {
          const phi = rng() * Math.PI * 2
          const gap = R + rr(rng, spec.gap)
          pos.addScaledVector(f.right, Math.cos(phi) * gap).addScaledVector(f.up, Math.sin(phi) * gap)
        }
        const sc = rr(rng, spec.s)
        const r = rr(rng, spec.r)
        const dir = rng() < 0.5 ? 1 : -1
        const c = cols[Math.floor(rng() * cols.length)]
        const mv4 = [dir * rr(rng, spec.spd), rng() * 6.28]
        // su propio tubo no cuenta; ni cintas ni tubos ajenos (el radio incluye la patrulla del shader)
        const placed = colocar(world, { pos, seed: way.idx * 4421 + items.length * 37 + mv.length }, boundR(spec.k) * sc + r * 0.5, { way: way.idx, si: way.segments.indexOf(s), lane: null }, 4, local)
        if (!placed) continue
        items.push({ m: new THREE.Matrix4().compose(placed, quat, new THREE.Vector3(sc, sc, sc)), c })
        mv.push(...mv4, (top ? r * 0.2 : r * 0.4) / sc, r / sc)
      }
    }
    if (items.length) out.push({ k: spec.k, items, mv: new Float32Array(mv) })
  })
  return out
}

function SpeciesMesh({ k, items, mv, time }) {
  const ref = useRef()
  const geo = useMemo(() => {
    const g = speciesGeo(k).clone()
    g.setAttribute('aMove', new THREE.InstancedBufferAttribute(mv, 4))
    return g
  }, [k, mv])
  const mat = useMemo(() => makeMaterial(k, time), [k, time])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => () => mat.dispose(), [mat])
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    o.instanceColor.needsUpdate = true
    o.computeBoundingSphere()
    o.boundingSphere.radius += 8 // holgura: las patrullas se mueven en el shader
  }, [items])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} raycast={() => null} />
}

export default function Fauna({ way, time, getFrames, sample }) {
  const groups = useMemo(() => buildFauna(way, getFrames, sample), [way, getFrames, sample])
  return (
    <group>
      {groups.map((g) => <SpeciesMesh key={g.k} k={g.k} items={g.items} mv={g.mv} time={time} />)}
    </group>
  )
}
