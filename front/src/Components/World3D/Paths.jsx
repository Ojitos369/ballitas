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

// Geometrías unitarias compartidas; las de bulto apoyan su base en y=0.
const base = (g) => (g.translate(0, 0.5, 0), g)
const GEO = {
  cone: base(new THREE.ConeGeometry(0.5, 1, 10)),
  funnel: base(new THREE.ConeGeometry(0.5, 1, 28, 1, true)),
  cyl: base(new THREE.CylinderGeometry(0.5, 0.5, 1, 10)),
  sphere: new THREE.SphereGeometry(0.5, 14, 10),
  box: base(new THREE.BoxGeometry(1, 1, 1)),
  octa: base(new THREE.OctahedronGeometry(0.5)),
  torus: new THREE.TorusGeometry(1, 0.04, 6, 32), // radio 1: se escala al radio del tubo
}
const GEO_BY = { cone: GEO.cone, cyl: GEO.cyl, sphere: GEO.sphere, box: GEO.box, octa: GEO.octa, torus: GEO.torus }

// Valores >1 y toneMapped=false: así el bloom los recoge.
const hot = (c, k = 2) => new THREE.Color(c).multiplyScalar(k)
const MAT = {
  deco: new THREE.MeshStandardMaterial({ roughness: 0.75, flatShading: true }),
  decoA: new THREE.MeshStandardMaterial({ roughness: 0.6, flatShading: true, transparent: true, opacity: 0.85, depthWrite: false }),
  glow: new THREE.MeshBasicMaterial({ toneMapped: false }),
}
const cache = {}
const memo = (key, make) => (cache[key] ??= make())
const glassOf = (id) => memo(`g${id}`, () => new THREE.MeshPhysicalMaterial({
  color: VISUALS[id].glass, transparent: true, opacity: 0.2, roughness: 0.04, metalness: 0.1,
  envMapIntensity: 1.8, depthWrite: false, side: THREE.DoubleSide,
}))
const railOf = (id) => memo(`r${id}`, () => new THREE.MeshBasicMaterial({ color: hot(VISUALS[id].rail, 2.5), toneMapped: false }))
const dotsOf = (id) => memo(`d${id}`, () => new THREE.PointsMaterial({
  color: hot(VISUALS[id].rail, 2), size: 0.14, sizeAttenuation: true, transparent: true, opacity: 0.4, depthWrite: false, toneMapped: false,
}))
const partsOf = (id) => memo(`p${id}`, () => {
  const { c, s } = VISUALS[id].parts
  return new THREE.PointsMaterial({ color: hot(c, 2), size: s * 3, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false })
})

const put = (list, p, q, sx, sy = sx, sz = sx, c) => list.push({ m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(sx, sy, sz)), c })
const aim = (from, to) => new THREE.Quaternion().setFromUnitVectors(from, to)
const rr = (rng, [a, b]) => a + rng() * (b - a)
const pointsGeo = (arr) => new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(arr, 3))
const METAL = new THREE.Color('#3a3f4a')

// Todo lo geométrico de un sentido, en datos: se calcula una sola vez.
function build(way) {
  const V = VISUALS[way.theme.id]; const r = way.params.radius
  const ribC = hot(V.rib, 1.7); const railC = hot(V.rail, 2.2); const dim = hot(V.rib, 0.9)
  const tubes = []; const rails = []
  const rings = []; const solids = []; const spheres = []; const discs = []; const funnels = []; const dots = []
  const solid = way.segments.filter((s) => !s.air)

  for (const s of way.segments) {
    const c = s.curve; const R = s.radius
    if (s.air) {
      const P0 = c.getPoint(0); const T0 = c.getTangent(0); const P1 = c.getPoint(1); const T1 = c.getTangent(1)
      const n = Math.ceil(s.length / 0.9)
      for (let i = 1; i < n; i++) dots.push(...c.getPoint(i / n).toArray())
      if (s.kind === 'trampolin') {
        // plataforma elástica con borde brillante, justo bajo la salida
        const p = P0.clone().addScaledVector(Y, -0.35)
        put(solids, p, IDENT, R * 3.4, 0.3, R * 3.4, new THREE.Color(V.rib).multiplyScalar(0.5))
        put(rings, p.clone().addScaledVector(Y, 0.3), aim(Z, Y), R * 1.7, R * 1.7, R * 1.7, ribC)
      } else if (s.kind === 'canon') {
        // campana de aros crecientes con la boca brillante
        ;[[0.5, 1.15], [1.1, 1.3], [1.7, 1.5]].forEach(([b, k]) => put(rings, P0.clone().addScaledVector(T0, -b), aim(Z, T0), R * k, R * k, R * k, METAL))
        put(rings, P0, aim(Z, T0), R * 1.2, R * 1.2, R * 1.2, hot('#ff7a2f', 2.8))
      } else {
        // caída: el borde del tubo se ve cortado y con un reborde
        put(rings, P0, aim(Z, T0), R * 1.12, R * 1.12, R * 1.12, railC)
        put(solids, P0.clone().addScaledVector(Y, -R - 0.15), IDENT, R * 2.6, 0.18, R * 2.6, METAL)
      }
      // recepción: red de aros concéntricos con un disco de cristal
      put(rings, P1, aim(Z, T1), R * 1.9, R * 1.9, R * 1.9, ribC)
      put(rings, P1, aim(Z, T1), R * 1.25, R * 1.25, R * 1.25, dim)
      put(rings, P1, aim(Z, T1), R * 0.6, R * 0.6, R * 0.6, dim)
      put(discs, P1, aim(Y, T1), R * 3.8, 0.04, R * 3.8)
      continue
    }

    const steps = Math.min(240, Math.max(8, Math.ceil(s.length * 2.5)))
    tubes.push(new THREE.TubeGeometry(c, steps, R, 10, false))
    // riel: línea fina pegada a la pared que sigue el mismo marco que el tubo (no salta en verticales)
    const fr = c.computeFrenetFrames(steps, false); const pts = []
    for (let i = 0; i <= steps; i++) {
      const a = 0.9
      pts.push(c.getPointAt(i / steps).addScaledVector(fr.normals[i], Math.cos(a) * R * 0.97).addScaledVector(fr.binormals[i], Math.sin(a) * R * 0.97))
    }
    rails.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), steps, 0.06, 4, false))

    const nRib = Math.max(1, Math.floor(s.length / 2.2))
    for (let i = 0; i < nRib; i++) {
      const u = (i + 0.5) / nRib
      put(rings, c.getPointAt(u), aim(Z, c.getTangentAt(u)), R * 1.05, R * 1.05, R * 1.05, ribC)
    }
    const nPost = Math.floor(s.length / 9)
    for (let i = 0; i < nPost; i++) {
      const P = c.getPointAt((i + 0.5) / nPost)
      put(solids, new THREE.Vector3(P.x, P.y - R - 3, P.z), IDENT, 0.1, 3, 0.1, METAL)
    }
    if (s.kind === 'embudo') {
      // cono de cristal: eje por el vértice B y el centro de la primera vuelta; borde en A
      const A = c.getPoint(0); const B = c.getPoint(1); const ctr = new THREE.Vector3()
      for (let i = 0; i < 24; i++) ctr.add(c.getPoint(0.02 + (i / 23) * 0.28))
      ctr.divideScalar(24)
      const d = B.clone().sub(ctr).normalize(); const h = -A.clone().sub(B).dot(d)
      const rad = A.clone().sub(B).addScaledVector(d, h).length()
      if (h > 0.5) put(funnels, B.clone().addScaledVector(d, -h), aim(Y, d), rad * 2, h, rad * 2)
    } else if (s.kind === 'cascada') {
      // un escalón de cristal bajo cada tramo plano
      let last = -9
      for (let i = 0; i <= 40; i++) {
        if (Math.abs(c.getTangentAt(i / 40).y) < 0.3 && i - last > 3) { last = i; put(discs, c.getPointAt(i / 40).addScaledVector(Y, -R - 0.15), IDENT, R * 3.2, 0.14, R * 3.2) }
      }
    }
  }

  // nudos: esfera de cristal con aro, donde las rutas se bifurcan, cruzan o unen
  way.junctions.forEach((j, i) => {
    put(spheres, j.pos, IDENT, r * 4)
    put(rings, j.pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0.6 * (i - 1) + 0.3, i * 0.9, 0)), r * 2.5, r * 2.5, r * 2.5, ribC)
  })

  // decoración alrededor de los tubos
  const total = solid.reduce((a, s) => a + s.length, 0)
  const pick = (t) => { for (const s of solid) { if ((t -= s.length) <= 0) return s } return solid[solid.length - 1] }
  const decor = V.props.map((p, pi) => {
    const place = mulberry32(p.seed * 7919 + way.idx * 131) // misma posición para el mismo seed
    const look = mulberry32(p.seed * 104729 + pi * 31 + way.idx)
    const items = []; const n = Math.max(1, Math.floor(total * p.d))
    for (let i = 0; i < n; i++) {
      const s = pick(place() * total); const u = 0.04 + place() * 0.92; const ang = place() * TAU; const off = rr(place, p.off)
      const P = s.curve.getPointAt(u); const T = s.curve.getTangentAt(u)
      const col = new THREE.Color(p.c[Math.floor(look() * p.c.length)]).offsetHSL(0, 0, (look() - 0.5) * 0.08)
      if (p.e) col.multiplyScalar(2.2)
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

  // partículas ambientales alrededor del recorrido
  const prng = mulberry32(way.idx * 977 + 5); const pp = []
  for (let i = 0; i < V.parts.n; i++) {
    const s = pick(prng() * total); const P = s.curve.getPointAt(prng())
    pp.push(P.x + (prng() - 0.5) * 7, P.y + (prng() - 0.5) * 7, P.z + (prng() - 0.5) * 7)
  }

  return {
    tube: tubes.length ? mergeGeometries(tubes) : null,
    rail: rails.length ? mergeGeometries(rails) : null,
    rings, solids, spheres, discs, funnels, decor,
    dots: dots.length ? pointsGeo(dots) : null,
    parts: pointsGeo(pp),
  }
}

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

function Way({ way }) {
  const id = way.theme.id
  const d = useMemo(() => build(way), [way])
  const glass = glassOf(id)
  const bob = useRef()
  useFrame(({ clock }) => { bob.current.position.y = Math.sin(clock.elapsedTime * 0.7 + way.idx) * 0.2 })
  return (
    <group>
      {d.tube && <mesh geometry={d.tube} material={glass} />}
      {d.rail && <mesh geometry={d.rail} material={railOf(id)} />}
      <Inst geo={GEO.torus} mat={MAT.glow} items={d.rings} />
      <Inst geo={GEO.cyl} mat={MAT.deco} items={d.solids} cast />
      <Inst geo={GEO.sphere} mat={glass} items={d.spheres} />
      <Inst geo={GEO.cyl} mat={glass} items={d.discs} />
      <Inst geo={GEO.funnel} mat={glass} items={d.funnels} />
      {d.decor.map(({ p, items }, i) => {
        const solidMat = !p.e && (p.a ?? 1) >= 1
        return <Inst key={i} geo={GEO_BY[p.k]} mat={p.e ? MAT.glow : solidMat ? MAT.deco : MAT.decoA} items={items} cast={solidMat} />
      })}
      {d.dots && <points geometry={d.dots} material={dotsOf(id)} frustumCulled={false} />}
      <points ref={bob} geometry={d.parts} material={partsOf(id)} frustumCulled={false} />
    </group>
  )
}

export default function Paths({ world }) {
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
