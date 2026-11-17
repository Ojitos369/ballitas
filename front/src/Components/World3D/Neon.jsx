// Neón exterior de cada camino: franjas laterales, arcos, mástiles con remate temático y letreros.
// Todo es emisivo (MeshBasicMaterial sin tone mapping, para que el Bloom de Scene lo recoja) e instanciado;
// el pulso viaja por el camino en el vertex shader con un único uniform de tiempo compartido (sin useFrame propio).
import { useLayoutEffect, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'
import { NEON_DECOR } from './themes.js'

const GLOW = 2.3 // por encima del umbral del Bloom (1.15)
const Y = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4()

export function makeNeonMaterial(time, vertexColors) {
  const m = new THREE.MeshBasicMaterial({ vertexColors, toneMapped: false })
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time
    sh.vertexShader = 'uniform float uTime;\nvarying float vPulse;\n' + sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
      wp = instanceMatrix * wp;
      #endif
      vPulse = 0.8 + 0.2 * sin(uTime * 2.4 + wp.x * 0.55 + wp.z * 0.8 + wp.y * 0.3);`,
    )
    sh.fragmentShader = 'varying float vPulse;\n' + sh.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n      diffuseColor.rgb *= vPulse;',
    )
  }
  m.customProgramCacheKey = () => 'neonPulse'
  return m
}

const HEADS = {
  octa: () => new THREE.OctahedronGeometry(1, 0),
  cone: () => new THREE.ConeGeometry(0.8, 1.6, 5),
  sphere: () => new THREE.SphereGeometry(0.8, 8, 6),
  tetra: () => new THREE.TetrahedronGeometry(1, 0),
  box: () => new THREE.BoxGeometry(1.3, 1.3, 1.3),
  ico: () => new THREE.IcosahedronGeometry(1, 0),
}

// Prisma triangular a lo largo de los marcos, a un lado del tubo (franja neón continua).
function stripGeo(frames, R, side, color) {
  const n = frames.length
  const pos = new Float32Array(n * 9)
  const col = new Float32Array(n * 9)
  const idx = []
  for (let i = 0; i < n; i++) {
    const f = frames[i]
    const cx = f.pos.x + f.right.x * side * (R + 0.05)
    const cy = f.pos.y + f.right.y * side * (R + 0.05)
    const cz = f.pos.z + f.right.z * side * (R + 0.05)
    for (let j = 0; j < 3; j++) {
      const a = (j / 3) * Math.PI * 2
      const c = Math.cos(a) * 0.06
      const s = Math.sin(a) * 0.06
      const o = (i * 3 + j) * 3
      pos[o] = cx + f.right.x * c + f.up.x * s
      pos[o + 1] = cy + f.right.y * c + f.up.y * s
      pos[o + 2] = cz + f.right.z * c + f.up.z * s
      col[o] = color.r; col[o + 1] = color.g; col[o + 2] = color.b
    }
    if (i < n - 1) {
      for (let j = 0; j < 3; j++) {
        const a = i * 3 + j; const b = i * 3 + (j + 1) % 3
        idx.push(a, b, a + 3, b, b + 3, a + 3)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  g.setAttribute('color', new THREE.BufferAttribute(col, 3))
  g.setIndex(idx)
  return g
}

function buildNeon(way, getFrames, sample) {
  const id = way.theme.id
  const D = NEON_DECOR[id]
  const cols = D.c.map((c) => new THREE.Color(c).multiplyScalar(GLOW))
  const rng = mulberry32(way.idx * 6151 + 97)
  const strips = []; const arcs = []; const masts = []; const heads = []; const signs = []
  const q = new THREE.Quaternion(); const e = new THREE.Vector3(); const sc = new THREE.Vector3(); const z = new THREE.Vector3()
  const put = (list, p, quat, sx, sy, sz, c) => list.push({ m: new THREE.Matrix4().compose(p, quat, sc.set(sx, sy, sz)), c })
  let k = 0
  for (const s of way.segments) {
    if (s.air) continue
    const R = s.radius
    const frames = getFrames(s)
    const c0 = cols[s.route % 2 === 0 ? 0 : 1]
    strips.push(stripGeo(frames, R, 1, c0), stripGeo(frames, R, -1, c0))

    const nArc = Math.floor(s.length / D.arc)
    for (let i = 0; i < nArc; i++) {
      const f = sample(frames, (i + 0.5) / nArc)
      z.copy(f.T)
      q.setFromRotationMatrix(_m.makeBasis(f.right, f.up, z))
      const r = R + 0.32
      put(arcs, f.pos, q.clone(), r, r, 1, cols[(k + i) % cols.length])
    }

    const nMast = Math.floor(s.length / 6.5)
    for (let i = 0; i < nMast; i++) {
      const f = sample(frames, (i + 0.25 + rng() * 0.5) / nMast)
      if (Math.abs(f.T.y) > 0.72) continue
      const side = (k++ % 2) * 2 - 1
      const h = 1.5 + rng() * 1.8
      const c = cols[Math.floor(rng() * cols.length)]
      const base = f.pos.clone().addScaledVector(f.right, side * (R + 0.9))
      const mid = base.clone().addScaledVector(Y, h * 0.1)
      put(masts, mid, q.identity(), 1, h, 1, c)
      const head = base.clone().addScaledVector(Y, h * 0.6 + 0.12)
      put(heads, head, q.setFromAxisAngle(Y, rng() * 6.28), 0.2, 0.2, 0.2, c)
      if (k % 3 === 0) {
        const yaw = Math.atan2(f.right.x, f.right.z)
        const sp = base.clone().addScaledVector(Y, h * 0.2)
        put(signs, sp, q.setFromAxisAngle(Y, yaw), 0.8 + rng() * 0.4, 0.32, 1, cols[(cols.indexOf(c) + 1) % cols.length])
      }
    }
  }
  return {
    strips: strips.length ? mergeGeometries(strips) : null,
    arcs, masts, heads, signs, id,
  }
}

function NInst({ geo, mat, items }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const o = ref.current
    if (!o) return
    items.forEach((it, i) => { o.setMatrixAt(i, it.m); o.setColorAt(i, it.c) })
    o.instanceMatrix.needsUpdate = true
    o.instanceColor.needsUpdate = true
    o.computeBoundingSphere()
  }, [items])
  if (!items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} raycast={() => null} />
}

export default function Neon({ way, time, getFrames, sample }) {
  const d = useMemo(() => buildNeon(way, getFrames, sample), [way, getFrames, sample])
  const geos = useMemo(() => ({
    mast: new THREE.CylinderGeometry(0.035, 0.035, 1, 5),
    arc: new THREE.TorusGeometry(1, 0.028, 5, 28),
    head: HEADS[NEON_DECOR[d.id].head](),
    sign: new THREE.BoxGeometry(1, 1, 0.06),
  }), [d.id])
  const mats = useMemo(() => ({ inst: makeNeonMaterial(time, false), strip: makeNeonMaterial(time, true) }), [time])
  useEffect(() => () => { d.strips?.dispose(); Object.values(geos).forEach((g) => g.dispose()) }, [d, geos])
  useEffect(() => () => { mats.inst.dispose(); mats.strip.dispose() }, [mats])
  return (
    <group>
      {d.strips && <mesh geometry={d.strips} material={mats.strip} raycast={() => null} />}
      <NInst geo={geos.arc} mat={mats.inst} items={d.arcs} />
      <NInst geo={geos.mast} mat={mats.inst} items={d.masts} />
      <NInst geo={geos.head} mat={mats.inst} items={d.heads} />
      <NInst geo={geos.sign} mat={mats.inst} items={d.signs} />
    </group>
  )
}
