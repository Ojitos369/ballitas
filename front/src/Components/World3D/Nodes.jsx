import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { NODE_R, BALL_R, mulberry32 } from '../../Core/world.js'

const U = BALL_R * 2 // unidad de la ciudad: una bollita de ancho
const ROAD_W = U * 1.1
const ROAD_H = 0.08
const UP = new THREE.Vector3(0, 1, 0)
const Z = new THREE.Vector3(0, 0, 1)
const GOLD = '#ffd54a'
const GREEN = '#5dffb0'

const txt = (n) => (n > 0 ? '+' : '−') + Math.abs(n)

// Geometrías y materiales compartidos por los 5 nodos.
const boxUnit = new THREE.BoxGeometry(1, 1, 1)
const boxBase = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0) // apoyada en y=0
const roadMat = new THREE.MeshStandardMaterial({ color: '#23263a', roughness: 0.7, metalness: 0.1 })
const towerGeo = new THREE.CylinderGeometry(0.28, 0.4, 1.3, 14).translate(0, 0.65, 0)
const roofGeo = new THREE.ConeGeometry(0.42, 0.5, 14).translate(0, 1.55, 0)
const domeGeo = new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)
const padGeo = new THREE.CylinderGeometry(0.85, 0.95, 0.1, 24).translate(0, 0.05, 0)
const goldIcon = new THREE.OctahedronGeometry(0.3)
const greenIcon = new THREE.IcosahedronGeometry(0.28, 1)
const ringGeo = new THREE.TorusGeometry(1.35, 0.1, 10, 40)
const ringThin = new THREE.TorusGeometry(1.35, 0.05, 8, 40)
const discGeo = new THREE.CircleGeometry(1.3, 32)
const arrowGeo = new THREE.ConeGeometry(0.22, 0.5, 4)
const atmoGeo = new THREE.SphereGeometry(NODE_R * 1.07, 48, 32)

// Ventanas: una sola textura emisiva compartida; las instancias la estiran según su altura.
let winTex
function windows() {
  if (winTex) return winTex
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64)
  const rng = mulberry32(5)
  for (let y = 4; y < 60; y += 8) for (let x = 4; x < 60; x += 8) {
    if (rng() < 0.45) { g.fillStyle = rng() < 0.8 ? '#ffd890' : '#9fd8ff'; g.fillRect(x, y, 4, 5) }
  }
  winTex = new THREE.CanvasTexture(c); winTex.colorSpace = THREE.SRGBColorSpace
  return winTex
}

// Esfera con relieve mínimo (±0.02, menos que la altura de la calle) y dos tonos.
function planetGeo(color) {
  const g = new THREE.SphereGeometry(NODE_R - 0.02, 128, 96)
  const p = g.attributes.position; const cols = new Float32Array(p.count * 3)
  const a = new THREE.Color(color).multiplyScalar(0.1); const b = new THREE.Color(color).multiplyScalar(0.3)
  const c = new THREE.Color(); const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = Math.sin(v.x * 0.9) * Math.sin(v.y * 0.8 + 1) * Math.sin(v.z * 0.7 + 2)
    const t = THREE.MathUtils.smoothstep(Math.sin(v.x * 1.7 + v.z) * Math.cos(v.y * 1.3) + n * 0.5, -0.2, 0.4)
    v.multiplyScalar(1 + (n * 0.02) / NODE_R); p.setXYZ(i, v.x, v.y, v.z)
    c.lerpColors(a, b, t); cols.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals()
  return g
}

// Matrices locales (respecto al centro del nodo) de calles y edificios.
function cityData(node) {
  const rng = mulberry32(1000 + node.idx)
  const local = (p) => p.clone().sub(node.pos)
  const m4 = (x, y, z, pos) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos)

  const asphalt = []; const lines = []
  for (const r of node.roads) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const p0 = local(r.points[i]); const p1 = local(r.points[i + 1])
      const len = p0.distanceTo(p1); const z = p1.clone().sub(p0).normalize()
      const mid = p0.clone().add(p1).multiplyScalar(0.5); const y = mid.clone().normalize()
      const x = new THREE.Vector3().crossVectors(y, z).normalize()
      z.crossVectors(x, y)
      const at = (h) => y.clone().multiplyScalar(NODE_R + h)
      asphalt.push(m4(x.clone().multiplyScalar(ROAD_W), y.clone().multiplyScalar(ROAD_H), z.clone().multiplyScalar(len * 1.08), at(ROAD_H / 2)))
      lines.push(m4(x.clone().multiplyScalar(0.09), y.clone().multiplyScalar(0.02), z.clone().multiplyScalar(len * 1.05), at(ROAD_H + 0.005)))
    }
  }

  // Zona prohibida: calles (con su ancho + media casa) y vértices (puertos y destinos, más holgados).
  const near = node.roads.flatMap((r) => r.points).map((p) => [p, BALL_R + U * 0.75 + 0.1])
  node.verts.forEach((v) => near.push([v.pos, 1.9]))
  const hsl = {}; new THREE.Color(node.color).getHSL(hsl)
  const N = 420; const rot = rng() * Math.PI * 2; const col = new THREE.Color(); const houses = []
  for (let i = 0; i < N; i++) {
    const yy = 1 - (2 * (i + 0.5)) / N; const rr = Math.sqrt(1 - yy * yy); const ang = i * Math.PI * (3 - Math.sqrt(5)) + rot
    const dir = new THREE.Vector3(Math.cos(ang) * rr, yy, Math.sin(ang) * rr)
    const pos = dir.clone().multiplyScalar(NODE_R)
    const world = pos.clone().add(node.pos)
    if (rng() < 0.12 || near.some(([p, m]) => p.distanceToSquared(world) < m * m)) continue
    const h = U * (0.6 + 2.4 * rng() ** 2)
    const u = new THREE.Vector3().crossVectors(Math.abs(dir.y) > 0.95 ? new THREE.Vector3(1, 0, 0) : UP, dir).normalize()
    const a = rng() * Math.PI * 2
    const x = u.clone().multiplyScalar(Math.cos(a)).addScaledVector(new THREE.Vector3().crossVectors(dir, u), Math.sin(a))
    const z = new THREE.Vector3().crossVectors(x, dir)
    houses.push({
      m: m4(x.multiplyScalar(U * (0.5 + 0.5 * rng())), dir.clone().multiplyScalar(h), z.multiplyScalar(U * (0.5 + 0.5 * rng())), pos.addScaledVector(dir, -0.03)),
      c: col.setHSL(hsl.h + (rng() - 0.5) * 0.08, 0.2 + rng() * 0.2, 0.18 + rng() * 0.3).clone(),
    })
  }
  return { asphalt, lines, houses }
}

function Instanced({ geo, items, children, ...rest }) {
  const ref = useRef()
  useLayoutEffect(() => {
    items.forEach((it, i) => {
      ref.current.setMatrixAt(i, it.m ?? it)
      if (it.c) ref.current.setColorAt(i, it.c)
    })
    ref.current.instanceMatrix.needsUpdate = true
    if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return <instancedMesh key={items.length} ref={ref} args={[geo, null, items.length]} {...rest}>{children}</instancedMesh>
}

function Destino({ d, base }) {
  const icon = useRef()
  const [hover, setHover] = useState(false)
  const gain = d.kind === 'puntos'
  const color = gain ? GOLD : GREEN
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, d.dir), [d])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    icon.current.rotation.y = t * 1.5
    icon.current.position.y = 2.1 + Math.sin(t * 2 + d.idx) * 0.1
  })
  return (
    <group position={d.pos.clone().sub(base)} quaternion={q}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))} onPointerOut={() => setHover(false)}>
      <mesh geometry={padGeo} receiveShadow><meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} /></mesh>
      <mesh geometry={gain ? towerGeo : domeGeo} position={[0, 0.1, 0]} castShadow>
        <meshStandardMaterial color={gain ? '#8a6a12' : '#1f6b4a'} emissive={color} emissiveIntensity={0.35} roughness={0.35} metalness={0.5} />
      </mesh>
      {gain && <mesh geometry={roofGeo} position={[0, 0.1, 0]} castShadow><meshStandardMaterial color={GOLD} emissive={GOLD} emissiveIntensity={0.8} metalness={0.6} roughness={0.3} /></mesh>}
      <mesh ref={icon} geometry={gain ? goldIcon : greenIcon} scale={hover ? 1.4 : 1}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={3} toneMapped={false} />
      </mesh>
      {hover && (
        <Html center position={[0, 3, 0]} distanceFactor={14} zIndexRange={[5, 0]}>
          <div className="tag tip">{d.name} · {txt(d.dp)} ⭐ · {txt(d.de)} ⚡</div>
        </Html>
      )}
    </group>
  )
}

// Boca de un tubo: la salida brilla con el color del nodo al que va; la entrada es un aro apagado con flechas hacia dentro.
function Port({ node, vert, out, color }) {
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(Z, vert.dir), [vert])
  const arrows = useMemo(() => [0, 1, 2].map((i) => [Math.cos((i * Math.PI * 2) / 3) * 1.6, Math.sin((i * Math.PI * 2) / 3) * 1.6]), [])
  return (
    <group position={vert.pos.clone().sub(node.pos).addScaledVector(vert.dir, 0.15)} quaternion={q}>
      {out ? (
        <>
          <mesh geometry={ringGeo}><meshStandardMaterial color={color} emissive={color} emissiveIntensity={3.5} toneMapped={false} /></mesh>
          <mesh geometry={discGeo}><meshBasicMaterial color={color} transparent opacity={0.22} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} /></mesh>
        </>
      ) : (
        <>
          <mesh geometry={ringThin}><meshStandardMaterial color="#2a2d44" emissive={color} emissiveIntensity={0.7} /></mesh>
          {arrows.map(([x, y], i) => (
            <mesh key={i} geometry={arrowGeo} position={[x, y, 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
              <meshStandardMaterial color="#2a2d44" emissive={color} emissiveIntensity={0.9} />
            </mesh>
          ))}
        </>
      )}
    </group>
  )
}

function Planet({ node, world }) {
  const geo = useMemo(() => planetGeo(node.color), [node])
  const city = useMemo(() => cityData(node), [node])
  const winMap = useMemo(windows, [])
  return (
    <group position={node.pos}>
      <mesh geometry={geo} receiveShadow><meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} /></mesh>
      {/* atmósfera: no debe interceptar el cursor de los destinos */}
      <mesh geometry={atmoGeo} raycast={() => null}>
        <meshBasicMaterial color={node.color} side={THREE.BackSide} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Instanced geo={boxUnit} items={city.asphalt} receiveShadow castShadow><primitive object={roadMat} attach="material" /></Instanced>
      <Instanced geo={boxUnit} items={city.lines}>
        <meshStandardMaterial color="#111" emissive={node.color} emissiveIntensity={2.5} toneMapped={false} />
      </Instanced>
      <Instanced geo={boxBase} items={city.houses} castShadow>
        <meshStandardMaterial roughness={0.6} metalness={0.25} emissive="#ffffff" emissiveMap={winMap} emissiveIntensity={1.6} />
      </Instanced>
      {node.destinos.map((d) => <Destino key={d.idx} d={d} base={node.pos} />)}
      {node.ports.map((p) => {
        const c = world.nodes[p.to].color
        return (
          <group key={p.to}>
            <Port node={node} vert={node.verts[p.out]} out color={c} />
            <Port node={node} vert={node.verts[p.in]} color={c} />
          </group>
        )
      })}
      <Html center position={[0, NODE_R + 3.5, 0]} distanceFactor={20} zIndexRange={[5, 0]}>
        <div className="tag node" style={{ borderColor: node.color }}>{node.name}</div>
      </Html>
    </group>
  )
}

export default function Nodes({ world }) {
  return world.nodes.map((n) => <Planet key={n.idx} node={n} world={world} />)
}
