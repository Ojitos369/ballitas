import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { NODE_R, BALL_R, mulberry32 } from '../../Core/world.js'

const U = BALL_R * 2 // unidad de la ciudad: una bollita de ancho
const ROAD_W = U * 1.15
const ROAD_H = 0.08
const UP = new THREE.Vector3(0, 1, 0)
const GOLD = '#ffd54a'
const GREEN = '#5dffb0'

const txt = (n) => (n > 0 ? '+' : '−') + Math.abs(n)

// Actividad reciente por terminal (`${nodeIdx}:${vertIdx}:${kind}` -> { power, at })
// La actualiza Bollita.jsx en useFrame sin provocar renders de React.
export const terminalPulse = new Map()

export function getTerminals(node) {
  if (Array.isArray(node.terminals) && node.terminals.length > 0) return node.terminals
  const list = []
  for (const p of node.ports || []) {
    if (p.out != null && node.verts[p.out]) {
      const v = node.verts[p.out]
      list.push({ vert: p.out, kind: 'out', way: p.wayOut || null, to: p.to, dir: v.dir, pos: v.pos })
    }
    if (p.in != null && node.verts[p.in]) {
      const v = node.verts[p.in]
      list.push({ vert: p.in, kind: 'in', way: p.wayIn || null, to: p.to, dir: v.dir, pos: v.pos })
    }
  }
  return list
}

// ───────────────────────── Texturas (public/tex con fallback procedural) ─────────────────────────
const texCache = new Map()
const texLoader = new THREE.TextureLoader()

function makeCanvas(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  return c
}

function loadTexWithFallback(filename, fallbackFn, { srgb = false, repeatX = 1, repeatY = 1 } = {}) {
  if (texCache.has(filename)) return texCache.get(filename)
  const canvas = fallbackFn()
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  texCache.set(filename, tex)

  const base = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/')
  texLoader.load(
    `${base}tex/${filename}`,
    (loaded) => {
      tex.image = loaded.image
      tex.needsUpdate = true
    },
    undefined,
    () => { /* mantiene el fallback procedural sin errores */ },
  )
  return tex
}

function getTextures() {
  const buildingAlbedo = loadTexWithFallback(
    'building_albedo.png',
    () => makeCanvas(128, (g, s) => {
      g.fillStyle = '#8b92a8'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(11)
      for (let y = 0; y < s; y += 16) {
        g.fillStyle = rng() < 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)'
        g.fillRect(0, y, s, 14)
        g.fillStyle = 'rgba(20,24,38,0.22)'
        g.fillRect(0, y + 14, s, 2)
      }
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgba(20,24,38,0.14)'
        g.fillRect(x, 0, 2, s)
      }
    }),
    { srgb: true },
  )

  const buildingNormal = loadTexWithFallback(
    'building_normal.png',
    () => makeCanvas(128, (g, s) => {
      g.fillStyle = 'rgb(128,128,255)'
      g.fillRect(0, 0, s, s)
      for (let y = 0; y < s; y += 16) {
        g.fillStyle = 'rgb(128,165,245)'
        g.fillRect(0, y, s, 2)
        g.fillStyle = 'rgb(128,92,245)'
        g.fillRect(0, y + 13, s, 2)
      }
      for (let x = 0; x < s; x += 32) {
        g.fillStyle = 'rgb(160,128,245)'
        g.fillRect(x, 0, 2, s)
      }
    }),
  )

  const buildingEmissive = loadTexWithFallback(
    'building_emissive.png',
    () => makeCanvas(128, (g, s) => {
      g.fillStyle = '#000000'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(5)
      for (let y = 6; y < s - 6; y += 16) {
        for (let x = 6; x < s - 6; x += 16) {
          if (rng() < 0.48) {
            g.fillStyle = rng() < 0.78 ? '#ffd68a' : '#8ed2ff'
            g.fillRect(x, y, 8, 9)
          }
        }
      }
    }),
    { srgb: true },
  )

  const hullNormal = loadTexWithFallback(
    'hull_normal.png',
    () => makeCanvas(128, (g, s) => {
      g.fillStyle = 'rgb(128,128,255)'
      g.fillRect(0, 0, s, s)
      g.strokeStyle = 'rgb(96,96,230)'
      g.lineWidth = 2
      for (let i = 0; i < s; i += 32) {
        g.strokeRect(i + 1, 1, 30, s - 2)
        g.beginPath()
        g.moveTo(0, i)
        g.lineTo(s, i)
        g.stroke()
      }
      g.fillStyle = 'rgb(170,170,255)'
      for (let y = 8; y < s; y += 32) {
        for (let x = 8; x < s; x += 32) {
          g.fillRect(x, y, 2, 2)
          g.fillRect(x + 16, y + 16, 2, 2)
        }
      }
    }),
  )

  const asphalt = loadTexWithFallback(
    'asphalt.png',
    () => makeCanvas(128, (g, s) => {
      g.fillStyle = '#222638'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(42)
      for (let i = 0; i < 650; i++) {
        const v = Math.floor(28 + rng() * 24)
        g.fillStyle = `rgb(${v},${v + 3},${v + 14})`
        g.fillRect(rng() * s, rng() * s, 2, 2)
      }
      // Bordillos laterales sutiles y línea discontinua central
      g.fillStyle = '#383e5a'
      g.fillRect(0, 0, 8, s)
      g.fillRect(s - 8, 0, 8, s)
      g.fillStyle = 'rgba(210,220,255,0.28)'
      for (let y = 6; y < s; y += 24) g.fillRect(s / 2 - 2, y, 4, 12)
    }),
    { srgb: true },
  )

  const asphaltNormal = loadTexWithFallback(
    'asphalt_normal.png',
    () => makeCanvas(128, (g, s) => {
      g.fillStyle = 'rgb(128,128,255)'
      g.fillRect(0, 0, s, s)
      const rng = mulberry32(99)
      for (let i = 0; i < 500; i++) {
        const nx = Math.floor(110 + rng() * 36)
        const ny = Math.floor(110 + rng() * 36)
        g.fillStyle = `rgb(${nx},${ny},248)`
        g.fillRect(rng() * s, rng() * s, 2, 2)
      }
    }),
  )

  return { buildingAlbedo, buildingNormal, buildingEmissive, hullNormal, asphalt, asphaltNormal }
}

// ───────────────────────── Geometrías compartidas ─────────────────────────
const boxUnit = new THREE.BoxGeometry(1, 1, 1)
const boxBase = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)
const cylBase = new THREE.CylinderGeometry(0.5, 0.5, 1, 12).translate(0, 0.5, 0)
const octBase = new THREE.CylinderGeometry(0.5, 0.55, 1, 8).translate(0, 0.5, 0)
const coneBase = new THREE.ConeGeometry(0.5, 1, 8).translate(0, 0.5, 0)
const domeGeo = new THREE.SphereGeometry(0.62, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2)
const padGeo = new THREE.CylinderGeometry(0.92, 1.04, 0.14, 16).translate(0, 0.04, 0)
const basinGeo = new THREE.CylinderGeometry(0.88, 0.96, 0.35, 8).translate(0, 0.15, 0)
const poolGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.08, 8).translate(0, 0.31, 0)
const goldIcon = new THREE.OctahedronGeometry(0.28)
const greenIcon = new THREE.IcosahedronGeometry(0.26, 1)
const atmoGeo = new THREE.SphereGeometry(NODE_R * 1.07, 48, 32)

// Geometrías de estaciones terminales
const stBaseOut = new THREE.CylinderGeometry(1.75, 2.0, 0.45, 8).translate(0, 0.02, 0)
const stHullOut = new THREE.CylinderGeometry(1.22, 1.48, 1.65, 8, 1, true).translate(0, 1.05, 0)
const stCollarOut = new THREE.TorusGeometry(1.26, 0.12, 8, 24)
const stPortalOut = new THREE.TorusGeometry(1.32, 0.09, 10, 32)
const stDoorLeaf = new THREE.BoxGeometry(0.95, 0.1, 1.75)

const stBaseIn = new THREE.CylinderGeometry(2.05, 2.25, 0.4, 12).translate(0, 0.0, 0)
const stBunkerIn = new THREE.CylinderGeometry(1.35, 1.85, 1.15, 12, 1, true).translate(0, 0.75, 0)
const stThroatIn = new THREE.CylinderGeometry(1.18, 1.18, 0.9, 20, 1, true).translate(0, 0.7, 0)
const stPortalIn = new THREE.TorusGeometry(1.35, 0.065, 8, 32)
const stBeaconGeo = new THREE.SphereGeometry(0.11, 8, 8)
const stDishGeo = new THREE.ConeGeometry(0.36, 0.25, 12, 1, true)

// Esfera con relieve mínimo (±0.02, menos que la altura de la calle) y dos tonos.
function planetGeo(color) {
  const g = new THREE.SphereGeometry(NODE_R - 0.02, 128, 96)
  const p = g.attributes.position
  const cols = new Float32Array(p.count * 3)
  const a = new THREE.Color(color).multiplyScalar(0.1)
  const b = new THREE.Color(color).multiplyScalar(0.3)
  const c = new THREE.Color()
  const v = new THREE.Vector3()
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    const n = Math.sin(v.x * 0.9) * Math.sin(v.y * 0.8 + 1) * Math.sin(v.z * 0.7 + 2)
    const t = THREE.MathUtils.smoothstep(Math.sin(v.x * 1.7 + v.z) * Math.cos(v.y * 1.3) + n * 0.5, -0.2, 0.4)
    v.multiplyScalar(1 + (n * 0.02) / NODE_R)
    p.setXYZ(i, v.x, v.y, v.z)
    c.lerpColors(a, b, t)
    cols.set([c.r, c.g, c.b], i * 3)
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3))
  g.computeVertexNormals()
  return g
}

// Matrices locales (respecto al centro del nodo) de calles y edificios.
function cityData(node) {
  const rng = mulberry32(1000 + node.idx)
  const local = (p) => p.clone().sub(node.pos)
  const m4 = (x, y, z, pos) => new THREE.Matrix4().makeBasis(x, y, z).setPosition(pos)

  const asphalt = []
  const lines = []
  for (const r of node.roads) {
    for (let i = 0; i < r.points.length - 1; i++) {
      const p0 = local(r.points[i])
      const p1 = local(r.points[i + 1])
      const len = p0.distanceTo(p1)
      const z = p1.clone().sub(p0).normalize()
      const mid = p0.clone().add(p1).multiplyScalar(0.5)
      const y = mid.clone().normalize()
      const x = new THREE.Vector3().crossVectors(y, z).normalize()
      z.crossVectors(x, y)
      const at = (h) => y.clone().multiplyScalar(NODE_R + h)
      asphalt.push(m4(x.clone().multiplyScalar(ROAD_W), y.clone().multiplyScalar(ROAD_H), z.clone().multiplyScalar(len * 1.08), at(ROAD_H / 2)))
      lines.push(m4(x.clone().multiplyScalar(0.07), y.clone().multiplyScalar(0.015), z.clone().multiplyScalar(len * 1.04), at(ROAD_H + 0.004)))
    }
  }

  // Zona prohibida: calles, vértices, destinos y terminales (radio mayor para estaciones).
  const terminals = getTerminals(node)
  const near = node.roads.flatMap((r) => r.points).map((p) => [p, BALL_R + U * 0.75 + 0.1])
  node.verts.forEach((v) => near.push([v.pos, 1.9]))
  node.destinos.forEach((d) => near.push([d.pos, 2.35]))
  terminals.forEach((t) => near.push([t.pos || node.verts[t.vert].pos, 3.0]))

  const hsl = {}
  new THREE.Color(node.color).getHSL(hsl)
  const N = 420
  const rot = rng() * Math.PI * 2
  const col = new THREE.Color()
  const houses = []
  for (let i = 0; i < N; i++) {
    const yy = 1 - (2 * (i + 0.5)) / N
    const rr = Math.sqrt(1 - yy * yy)
    const ang = i * Math.PI * (3 - Math.sqrt(5)) + rot
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
      c: col.setHSL(hsl.h + (rng() - 0.5) * 0.08, 0.2 + rng() * 0.2, 0.18 + rng() * 0.28).clone(),
    })
  }
  return { asphalt, lines, houses, terminals }
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

// ───────────────────────── Destinos con identidad arquitectónica ─────────────────────────
function destinoStyle(name, kind) {
  switch (name) {
    case 'Feria':
    case 'Mercado':
    case 'Picnic':
    case 'Banquete':
      return 'carpa'
    case 'Torneo':
    case 'Carrera':
    case 'Concurso':
      return 'torre'
    case 'Galería':
    case 'Spa':
    case 'Siesta':
      return 'domo'
    case 'Fuente':
    case 'Manantial':
    case 'Hoguera':
      return 'fuente'
    case 'Hamaca':
      return 'hamaca'
    case 'Arcade':
    case 'Subasta':
      return 'pabellon'
    default:
      return kind === 'puntos' ? 'torre' : 'domo'
  }
}

function Destino({ d, base, tex }) {
  const icon = useRef()
  const [hover, setHover] = useState(false)
  const gain = d.kind === 'puntos'
  const color = gain ? GOLD : GREEN
  const bodyColor = gain ? '#7a5e18' : '#1e5b43'
  const roofColor = gain ? '#b98924' : '#2e8864'
  const style = destinoStyle(d.name, d.kind)
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, d.dir), [d])

  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    icon.current.rotation.y = t * 1.5
    icon.current.position.y = (style === 'torre' ? 2.45 : 2.05) + Math.sin(t * 2 + d.idx) * 0.1
  })

  return (
    <group
      position={d.pos.clone().sub(base)}
      quaternion={q}
      onPointerOver={(e) => (e.stopPropagation(), setHover(true))}
      onPointerOut={() => setHover(false)}
    >
      {/* Basamento */}
      <mesh geometry={padGeo} receiveShadow castShadow>
        <meshStandardMaterial color="#2a2f44" normalMap={tex.hullNormal} roughness={0.65} metalness={0.35} emissive={color} emissiveIntensity={0.14} />
      </mesh>

      {style === 'carpa' && (
        <group position={[0, 0.1, 0]}>
          {[-0.45, 0.45].map((px) => [-0.45, 0.45].map((pz) => (
            <mesh key={`${px}${pz}`} geometry={cylBase} position={[px, 0, pz]} scale={[0.08, 0.72, 0.08]} castShadow>
              <meshStandardMaterial color="#cfd5e6" roughness={0.5} metalness={0.4} />
            </mesh>
          )))}
          <mesh geometry={boxBase} position={[0, 0, 0]} scale={[0.7, 0.35, 0.5]} castShadow>
            <meshStandardMaterial color={bodyColor} map={tex.buildingAlbedo} normalMap={tex.buildingNormal} roughness={0.65} />
          </mesh>
          <mesh geometry={coneBase} position={[0, 0.68, 0]} scale={[1.65, 0.85, 1.65]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <meshStandardMaterial color={roofColor} roughness={0.55} emissive={color} emissiveIntensity={0.15} />
          </mesh>
        </group>
      )}

      {style === 'torre' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={octBase} scale={[0.95, 0.55, 0.95]} castShadow>
            <meshStandardMaterial color="#343a52" normalMap={tex.hullNormal} roughness={0.55} metalness={0.45} />
          </mesh>
          <mesh geometry={cylBase} position={[0, 0.52, 0]} scale={[0.66, 0.95, 0.66]} castShadow>
            <meshStandardMaterial
              color={bodyColor}
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.35}
              roughness={0.45}
              metalness={0.35}
            />
          </mesh>
          <mesh geometry={coneBase} position={[0, 1.45, 0]} scale={[0.92, 0.52, 0.92]} castShadow>
            <meshStandardMaterial color={roofColor} roughness={0.35} metalness={0.55} emissive={color} emissiveIntensity={0.22} />
          </mesh>
        </group>
      )}

      {style === 'domo' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={cylBase} scale={[1.38, 0.35, 1.38]} castShadow>
            <meshStandardMaterial color="#353b54" normalMap={tex.hullNormal} roughness={0.5} metalness={0.4} />
          </mesh>
          <mesh geometry={domeGeo} position={[0, 0.32, 0]} scale={[1.05, 1.05, 1.05]} castShadow>
            <meshStandardMaterial color={bodyColor} normalMap={tex.hullNormal} emissive={color} emissiveIntensity={0.18} roughness={0.28} metalness={0.5} />
          </mesh>
          <mesh geometry={boxBase} position={[0, 0, 0.62]} scale={[0.55, 0.48, 0.4]} castShadow>
            <meshStandardMaterial color="#464e6e" emissive="#ffffff" emissiveMap={tex.buildingEmissive} emissiveIntensity={0.35} roughness={0.55} />
          </mesh>
        </group>
      )}

      {style === 'fuente' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={basinGeo} castShadow receiveShadow>
            <meshStandardMaterial color="#40475e" normalMap={tex.hullNormal} roughness={0.7} metalness={0.2} />
          </mesh>
          <mesh geometry={poolGeo}>
            <meshStandardMaterial
              color={d.name === 'Hoguera' ? '#ff8243' : '#4be3c4'}
              emissive={d.name === 'Hoguera' ? '#ff6a2b' : color}
              emissiveIntensity={0.65}
              roughness={0.2}
            />
          </mesh>
          <mesh geometry={cylBase} position={[0, 0.3, 0]} scale={[0.24, 0.72, 0.24]} castShadow>
            <meshStandardMaterial color="#7b839e" roughness={0.45} metalness={0.45} />
          </mesh>
        </group>
      )}

      {style === 'hamaca' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={cylBase} position={[-0.52, 0, 0]} rotation={[0, 0, 0.2]} scale={[0.1, 0.95, 0.1]} castShadow>
            <meshStandardMaterial color="#73513a" roughness={0.75} />
          </mesh>
          <mesh geometry={cylBase} position={[0.52, 0, 0]} rotation={[0, 0, -0.2]} scale={[0.1, 0.95, 0.1]} castShadow>
            <meshStandardMaterial color="#73513a" roughness={0.75} />
          </mesh>
          <mesh geometry={boxBase} position={[0, 0.55, 0]} scale={[0.92, 0.1, 0.48]} castShadow>
            <meshStandardMaterial color={roofColor} roughness={0.65} emissive={color} emissiveIntensity={0.18} />
          </mesh>
          <mesh geometry={coneBase} position={[0, 0.95, 0]} scale={[1.35, 0.38, 1.0]} castShadow>
            <meshStandardMaterial color="#3c7d63" roughness={0.65} />
          </mesh>
        </group>
      )}

      {style === 'pabellon' && (
        <group position={[0, 0.1, 0]}>
          <mesh geometry={boxBase} scale={[1.15, 0.85, 0.95]} castShadow>
            <meshStandardMaterial
              color={bodyColor}
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.45}
              roughness={0.5}
              metalness={0.3}
            />
          </mesh>
          <mesh geometry={boxBase} position={[0, 0.85, 0]} scale={[1.28, 0.16, 1.08]} castShadow>
            <meshStandardMaterial color={roofColor} roughness={0.4} metalness={0.5} emissive={color} emissiveIntensity={0.22} />
          </mesh>
          <mesh geometry={cylBase} position={[0.38, 1.0, -0.25]} scale={[0.05, 0.45, 0.05]}>
            <meshStandardMaterial color="#9aa4c2" metalness={0.7} roughness={0.3} />
          </mesh>
        </group>
      )}

      {/* Icono flotante (brilla para identificación rápida) */}
      <mesh ref={icon} geometry={gain ? goldIcon : greenIcon} scale={hover ? 1.38 : 1}>
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.65} toneMapped={false} />
      </mesh>
      {hover && (
        <Html center position={[0, 3.2, 0]} distanceFactor={14} zIndexRange={[5, 0]}>
          <div className="tag tip">{d.name} · {txt(d.dp)} ⭐ · {txt(d.de)} ⚡</div>
        </Html>
      )}
    </group>
  )
}

// ───────────────────────── Estaciones Terminales (Salida / Entrada) ─────────────────────────
function Terminal({ node, term, color, tex }) {
  const dir = term.dir || node.verts[term.vert].dir
  const pos = term.pos || node.verts[term.vert].pos
  const isOut = term.kind === 'out'
  const key = `${node.idx}:${term.vert}:${term.kind}`
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, dir), [dir])

  const doorL = useRef()
  const doorR = useRef()
  const portalMat = useRef()
  const beacons = useRef([])
  const openAmt = useRef(0)

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    const entry = terminalPulse.get(key)
    const active = entry && t - entry.at < 0.35 ? entry.power : 0
    openAmt.current += (active - openAmt.current) * Math.min(1, dt * 8)

    const slide = openAmt.current * 0.65
    if (doorL.current && doorR.current) {
      doorL.current.position.x = -0.48 - slide
      doorR.current.position.x = 0.48 + slide
    }

    if (portalMat.current) {
      const base = isOut ? 1.55 : 1.05
      portalMat.current.emissiveIntensity = base + openAmt.current * 0.9
    }

    beacons.current.forEach((m, i) => {
      if (!m) return
      const speed = 2.5 + openAmt.current * 5.5
      const wave = 0.5 + 0.5 * Math.sin(t * speed + (isOut ? -i : i) * 1.1)
      m.material.emissiveIntensity = 0.8 + wave * (0.9 + openAmt.current * 0.9)
    })
  })

  return (
    <group position={pos.clone().sub(node.pos)} quaternion={q}>
      {isOut ? (
        /* ── SALIDA: Lanzadera / Hangar / Torre-Cañón ── */
        <group>
          <mesh geometry={stBaseOut} receiveShadow castShadow>
            <meshStandardMaterial color="#2a3046" normalMap={tex.hullNormal} roughness={0.6} metalness={0.45} />
          </mesh>
          {/* Cuerpo del hangar */}
          <mesh geometry={stHullOut} castShadow receiveShadow>
            <meshStandardMaterial
              color="#3a4362"
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.42}
              roughness={0.5}
              metalness={0.4}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* 4 contrafuertes / aletas laterales */}
          {[0, 1, 2, 3].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI) / 2, 0]}>
              <mesh geometry={boxBase} position={[1.45, 0.1, 0]} scale={[0.45, 1.55, 0.32]} castShadow>
                <meshStandardMaterial color="#485378" normalMap={tex.hullNormal} roughness={0.48} metalness={0.5} />
              </mesh>
              <mesh
                ref={(el) => { beacons.current[i] = el }}
                geometry={stBeaconGeo}
                position={[1.5, 1.72, 0]}
              >
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.4} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* Cornisa superior y aro de salida */}
          <mesh geometry={stCollarOut} position={[0, 1.86, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
            <meshStandardMaterial color="#4e597e" normalMap={tex.hullNormal} roughness={0.4} metalness={0.6} />
          </mesh>
          <mesh geometry={stPortalOut} position={[0, 1.98, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial ref={portalMat} color={color} emissive={color} emissiveIntensity={1.55} toneMapped={false} />
          </mesh>
          {/* Compuerta doble que se abre */}
          <mesh ref={doorL} geometry={stDoorLeaf} position={[-0.48, 1.8, 0]} castShadow>
            <meshStandardMaterial color="#23283b" normalMap={tex.hullNormal} roughness={0.45} metalness={0.65} />
          </mesh>
          <mesh ref={doorR} geometry={stDoorLeaf} position={[0.48, 1.8, 0]} castShadow>
            <meshStandardMaterial color="#23283b" normalMap={tex.hullNormal} roughness={0.45} metalness={0.65} />
          </mesh>
          {/* Torre de control + antena */}
          <mesh geometry={boxBase} position={[1.55, 0.15, 0.55]} scale={[0.6, 1.95, 0.55]} castShadow>
            <meshStandardMaterial
              color="#343d58"
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.48}
              roughness={0.5}
              metalness={0.35}
            />
          </mesh>
          <mesh geometry={cylBase} position={[1.65, 2.1, 0.65]} scale={[0.05, 0.85, 0.05]}>
            <meshStandardMaterial color="#9aa4c2" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Chimeneas de escape */}
          {[-0.45, 0.45].map((z) => (
            <mesh key={z} geometry={cylBase} position={[-1.58, 0.2, z]} scale={[0.24, 1.3, 0.24]} castShadow>
              <meshStandardMaterial color="#2c3144" normalMap={tex.hullNormal} roughness={0.55} metalness={0.5} />
            </mesh>
          ))}
        </group>
      ) : (
        /* ── ENTRADA: Estación receptora / Túnel con compuerta ── */
        <group>
          <mesh geometry={stBaseIn} receiveShadow castShadow>
            <meshStandardMaterial color="#23283a" normalMap={tex.hullNormal} roughness={0.65} metalness={0.4} />
          </mesh>
          {/* Búnker troncocónico ancho */}
          <mesh geometry={stBunkerIn} castShadow receiveShadow>
            <meshStandardMaterial
              color="#303752"
              map={tex.buildingAlbedo}
              normalMap={tex.buildingNormal}
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.32}
              roughness={0.55}
              metalness={0.35}
              side={THREE.DoubleSide}
            />
          </mesh>
          {/* Garganta interior oscura del túnel */}
          <mesh geometry={stThroatIn}>
            <meshStandardMaterial color="#0d101b" roughness={0.9} metalness={0.2} side={THREE.DoubleSide} />
          </mesh>
          {/* 3 pilones radiales de guía */}
          {[0, 1, 2].map((i) => (
            <group key={i} rotation={[0, (i * Math.PI * 2) / 3, 0]}>
              <mesh geometry={boxBase} position={[1.7, 0.1, 0]} rotation={[0, 0, 0.24]} scale={[0.38, 1.25, 0.42]} castShadow>
                <meshStandardMaterial color="#3c4464" normalMap={tex.hullNormal} roughness={0.5} metalness={0.45} />
              </mesh>
              <mesh
                ref={(el) => { beacons.current[i] = el }}
                geometry={stBeaconGeo}
                position={[1.45, 1.38, 0]}
              >
                <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.15} toneMapped={false} />
              </mesh>
            </group>
          ))}
          {/* Aro receptor tenue */}
          <mesh geometry={stPortalIn} position={[0, 1.34, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <meshStandardMaterial ref={portalMat} color={color} emissive={color} emissiveIntensity={1.05} toneMapped={false} />
          </mesh>
          {/* Compuerta doble que se traga la bollita */}
          <mesh ref={doorL} geometry={stDoorLeaf} position={[-0.48, 1.22, 0]} castShadow>
            <meshStandardMaterial color="#1d2233" normalMap={tex.hullNormal} roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh ref={doorR} geometry={stDoorLeaf} position={[0.48, 1.22, 0]} castShadow>
            <meshStandardMaterial color="#1d2233" normalMap={tex.hullNormal} roughness={0.5} metalness={0.6} />
          </mesh>
          {/* Ala de servicio con antena parabólica */}
          <mesh geometry={boxBase} position={[-1.65, 0.12, 0.45]} scale={[0.72, 0.9, 0.65]} castShadow>
            <meshStandardMaterial
              color="#2e354d"
              emissive="#ffffff"
              emissiveMap={tex.buildingEmissive}
              emissiveIntensity={0.38}
              roughness={0.55}
            />
          </mesh>
          <mesh geometry={stDishGeo} position={[-1.65, 1.22, 0.45]} rotation={[0.55, 0, -0.4]}>
            <meshStandardMaterial color="#8793b8" metalness={0.65} roughness={0.35} side={THREE.DoubleSide} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function Planet({ node, world, tex }) {
  const geo = useMemo(() => planetGeo(node.color), [node])
  const city = useMemo(() => cityData(node), [node])

  return (
    <group position={node.pos}>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
      </mesh>
      {/* atmósfera: no debe interceptar el cursor de los destinos */}
      <mesh geometry={atmoGeo} raycast={() => null}>
        <meshBasicMaterial color={node.color} side={THREE.BackSide} transparent opacity={0.14} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </mesh>
      <Instanced geo={boxUnit} items={city.asphalt} receiveShadow castShadow>
        <meshStandardMaterial map={tex.asphalt} normalMap={tex.asphaltNormal} roughness={0.78} metalness={0.1} />
      </Instanced>
      <Instanced geo={boxUnit} items={city.lines}>
        <meshStandardMaterial color="#2a3048" emissive={node.color} emissiveIntensity={0.35} roughness={0.5} />
      </Instanced>
      <Instanced geo={boxBase} items={city.houses} castShadow receiveShadow>
        <meshStandardMaterial
          map={tex.buildingAlbedo}
          normalMap={tex.buildingNormal}
          roughness={0.65}
          metalness={0.22}
          emissive="#ffffff"
          emissiveMap={tex.buildingEmissive}
          emissiveIntensity={0.52}
        />
      </Instanced>
      {node.destinos.map((d) => <Destino key={d.idx} d={d} base={node.pos} tex={tex} />)}
      {city.terminals.map((t, i) => (
        <Terminal key={`${t.kind}-${t.to}-${t.vert}-${i}`} node={node} term={t} color={world.nodes[t.to].color} tex={tex} />
      ))}
      <Html center position={[0, NODE_R + 3.5, 0]} distanceFactor={20} zIndexRange={[5, 0]}>
        <div className="tag node" style={{ borderColor: node.color }}>{node.name}</div>
      </Html>
    </group>
  )
}

export default function Nodes({ world }) {
  const tex = useMemo(getTextures, [])
  return world.nodes.map((n) => <Planet key={n.idx} node={n} world={world} tex={tex} />)
}
