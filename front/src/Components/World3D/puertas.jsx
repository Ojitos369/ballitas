// Puertas de salida y llegada de cada camino (terminal.gate / way.gates): una forma distinta y temática
// por tipo, de bajo polígono, abrazando la boca del tubo. Todas las puertas del mundo van fusionadas en
// UNA malla con colores de vértice (1 draw call).
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { laneFrame } from '../../Core/world.js'
import { PISTA } from './vida/pista.jsx'

const BLACK = '#15151a'
const WHITE = '#f4f4f0'

// Cada constructor arma la puerta en local: eje del tubo en +Z (sentido de avance), +Y lejos del suelo,
// radio del tubo R. Devuelve [geometría, color][].
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z)
const post = (R, x, top, c = '#2b303c') => [box(0.32, top + R * 1.3, 0.32, x, (top - R * 1.3) / 2, 0), c]
function checker(cols, rows, w, h, y, z, c1 = BLACK, c2 = WHITE) {
  const out = []; const cw = w / cols; const ch = h / rows
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) out.push([box(cw, ch, 0.12, -w / 2 + cw * (i + 0.5), y - h / 2 + ch * (j + 0.5), z), (i + j) % 2 ? c1 : c2])
  }
  return out
}
function arch(r, tube, c, z = 0) {
  return [new THREE.TorusGeometry(r, tube, 6, 18, Math.PI).translate(0, 0, z), c]
}

const GATES = {
  // ── salidas ──
  arco_salida: (R, P) => [
    arch(R * 1.3, 0.2, P.a), post(R, -R * 1.3, 0), post(R, R * 1.3, 0),
    ...checker(10, 2, R * 2.0, 0.5, R * 1.3 + 0.55, 0),
  ],
  parrilla_semaforo: (R, P) => {
    const top = R * 1.55
    const lights = ['#ff3b3b', '#ff3b3b', '#ffb020', '#ffb020', '#3bff7a'].map((c, i) => [new THREE.SphereGeometry(0.17, 8, 6).translate(-0.9 + i * 0.45, top - 0.42, -0.2), c])
    return [post(R, -R * 1.4, top), post(R, R * 1.4, top), [box(R * 2.8 + 0.32, 0.3, 0.36, 0, top, 0), P.a], [box(2.4, 0.6, 0.3, 0, top - 0.42, 0), BLACK], ...lights]
  },
  tunel_rampa: (R, P) => {
    const out = []
    for (let i = 0; i < 4; i++) out.push([new THREE.CylinderGeometry(R * 1.22, R * 1.22, 0.8, 18, 1, true).rotateX(Math.PI / 2).translate(0, 0, i * 0.8), i % 2 ? P.b : P.a])
    out.push([new THREE.CylinderGeometry(R * 1.22, R * 1.8, 0.9, 18, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -0.85), P.a])
    return out
  },
  lanzadera_aros: (R, P) => [0, 1, 2].map((i) => [new THREE.TorusGeometry(R * (1.2 + i * 0.16), 0.13, 6, 24).translate(0, 0, i * 1.8), i % 2 ? P.b : P.a]),
  puente_banderas: (R, P) => {
    const top = R * 1.45
    const flags = [-1.5, -0.5, 0.5, 1.5].map((x, i) => [new THREE.ConeGeometry(0.28, 0.7, 3).rotateX(Math.PI).scale(1, 1, 0.25).translate(x * R * 0.55, top - 0.5, 0), i % 2 ? P.b : P.a])
    return [post(R, -R * 1.45, top), post(R, R * 1.45, top), [box(R * 2.9 + 0.3, 0.28, 0.7, 0, top, 0), P.b], ...flags]
  },
  // ── llegadas ──
  meta_cuadros: (R, P) => {
    const top = R * 1.5
    return [post(R, -R * 1.4, top), post(R, R * 1.4, top), [box(R * 2.8 + 0.32, 0.22, 0.3, 0, top, 0), P.a], ...checker(12, 3, R * 2.6, 0.75, top - 0.12, 0)]
  },
  embudo_llegada: (R, P) => [
    [new THREE.CylinderGeometry(R * 1.2, R * 2.3, 2.2, 22, 1, true).rotateX(Math.PI / 2).translate(0, 0, -1.1), P.a],
    [new THREE.TorusGeometry(R * 2.3, 0.12, 6, 28).translate(0, 0, -2.2), P.b],
  ],
  portal_llegada: (R, P) => [
    [new THREE.TorusGeometry(R * 1.32, 0.26, 8, 28), P.b],
    ...[0, 1, 2, 3].map((i) => {
      const a = Math.PI / 4 + (i * Math.PI) / 2
      return [new THREE.ConeGeometry(0.22, 0.9, 6).translate(0, R * 1.32 + 0.6, 0).rotateZ(a), P.a]
    }),
  ],
  arco_meta: (R, P) => [
    arch(R * 1.3, 0.16, P.a, 0), arch(R * 1.3, 0.16, P.b, 1.2),
    post(R, -R * 1.3, 0), post(R, R * 1.3, 0),
    ...checker(10, 2, R * 2.0, 0.45, R * 1.3 + 0.5, 0.6),
  ],
  tunel_frenado: (R, P) => {
    const out = []
    for (let i = 0; i < 4; i++) {
      const s = R * (1.5 - i * 0.07); const z = -i * 1.1; const c = i % 2 ? P.b : P.a
      out.push([box(s * 2, 0.2, 0.2, 0, s, z), c], [box(s * 2, 0.2, 0.2, 0, -s, z), c], [box(0.2, s * 2, 0.2, -s, 0, z), c], [box(0.2, s * 2, 0.2, s, 0, z), c])
    }
    return out
  },
}

function colorize(g, hex) {
  const c = new THREE.Color(hex)
  const n = g.getAttribute('position').count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k)
  return g.index ? g.toNonIndexed() : g
}

const _m = new THREE.Matrix4(); const _x = new THREE.Vector3(); const _y = new THREE.Vector3()
function gateAt(seg, u, kind, themeId) {
  const build = GATES[kind]
  if (!build || !seg) return []
  const lane = seg.lanes?.find((l) => l.id === 0) ?? seg.lanes?.[0]
  if (!lane) return []
  const f = laneFrame(seg, lane.id, u)
  _y.copy(f.up).normalize()
  _x.crossVectors(_y, f.tangent).normalize()
  _m.makeBasis(_x, _y, f.tangent).setPosition(f.pos)
  const radius = Math.max(1.5, ...seg.lanes.map((l) => (l.width ?? 1) * 2))
  return build(radius, PISTA[themeId] ?? PISTA.neon).map(([g, c]) => colorize(g, c).applyMatrix4(_m))
}

export function buildGatesGeo(world) {
  const parts = []
  for (const way of world.ways) {
    const out = way.segments.find((s) => s.kind === 'salida') ?? way.segments[0]
    const inn = way.segments.find((s) => s.kind === 'llegada')
    const id = way.theme.id
    // Una parrilla sobre la recta ancha de salida y una meta sobre la llegada: abarcan
    // los carriles que se abren y se reúnen, sin usar la boca del tubo como soporte.
    if (out) parts.push(...gateAt(out, Math.min(0.5, 3 / out.length), 'parrilla_semaforo', id))
    if (inn) parts.push(...gateAt(inn, Math.max(0.5, 1 - 3 / inn.length), 'meta_cuadros', id))
  }
  const g = mergeGeometries(parts)
  for (const p of parts) p.dispose()
  if (g) g.name = 'puertas'
  return g
}

export default function Puertas({ world }) {
  const geo = useMemo(() => buildGatesGeo(world), [world])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15, side: THREE.DoubleSide })
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vColor * 0.35;')
    }
    m.customProgramCacheKey = () => 'puertas-v1'
    return m
  }, [])
  useEffect(() => () => { geo?.dispose(); mat.dispose() }, [geo, mat])
  return geo ? <mesh geometry={geo} material={mat} /> : null
}
