// Vista de superficie de un nodo: diorama procedural estilo juguete (parcelas redondeadas,
// torres-castillo con ventanas cálidas, flora, calles continuas hacia cada puerto, cielo nocturno).
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BIOMES, resolveNodeBiome } from './biomas.js'
import { BUILDING_TYPES } from './arquitectura.js'
import { Monument } from './monumentos.jsx'
import { generarSuperficie, CELDA, R_SUELO } from './superficieGen.js'
import { bodyColor } from '../Ballita.jsx'
import { StatsProbe } from '../StatsOverlay.jsx'

const MODELS_URL = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/') + 'models/'
const gltfLoader = new GLTFLoader()
const modeloCache = new Map()
const TONE_MAPPING_AGX = 8

// GLB de public/models -> geometría con color por vértice (el color real viene en color_1).
function cargarModelo(nombre) {
  if (modeloCache.has(nombre)) return modeloCache.get(nombre)
  const p = gltfLoader.loadAsync(`${MODELS_URL}${nombre}.glb`).then((gltf) => {
    let found = null
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      if (found || !o.isMesh) return
      const g = o.geometry.clone()
      g.applyMatrix4(o.matrixWorld)
      if (g.attributes.color_1) {
        const s = g.attributes.color_1; const a = new Float32Array(s.count * 3)
        for (let i = 0; i < s.count; i++) {
          a[i * 3] = 0.14 + s.getX(i) * 0.86
          a[i * 3 + 1] = 0.14 + s.getY(i) * 0.86
          a[i * 3 + 2] = 0.14 + s.getZ(i) * 0.86
        }
        g.setAttribute('color', new THREE.BufferAttribute(a, 3))
      }
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k)
      if (!g.attributes.normal) g.computeVertexNormals()
      if (!g.attributes.color) g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(g.attributes.position.count * 3).fill(1), 3))
      found = g
    })
    return found
  }).catch(() => null)
  modeloCache.set(nombre, p)
  return p
}

const _o = new THREE.Object3D()
const _c = new THREE.Color()
const _hsl = {}
const colorSat = (hex, s, l0, l1, dh = 0) => {
  _c.set(hex).getHSL(_hsl)
  return new THREE.Color().setHSL((_hsl.h + dh + 1) % 1, Math.max(_hsl.s, s), Math.min(Math.max(_hsl.l, l0), l1))
}

// ── Geometrías suaves reutilizables (borde biselado, cero aristas duras) ──
function makeRoundedBoxGeo(w = 1, h = 1, d = 1, r = 0.14, segs = 2, centerY = true) {
  const rr = Math.min(r, w * 0.35, h * 0.35, d * 0.35)
  const hw = Math.max(0.02, w * 0.5 - rr)
  const hd = Math.max(0.02, d * 0.5 - rr)
  const shape = new THREE.Shape()
  shape.moveTo(-hw, -hd)
  shape.lineTo(hw, -hd)
  shape.quadraticCurveTo(hw + rr, -hd, hw + rr, -hd + rr)
  shape.lineTo(hw + rr, hd - rr)
  shape.quadraticCurveTo(hw + rr, hd, hw, hd)
  shape.lineTo(-hw, hd)
  shape.quadraticCurveTo(-hw - rr, hd, -hw - rr, hd - rr)
  shape.lineTo(-hw - rr, -hd + rr)
  shape.quadraticCurveTo(-hw - rr, -hd, -hw, -hd)

  const extrudeH = Math.max(0.02, h - rr * 2)
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: extrudeH,
    bevelEnabled: true,
    bevelThickness: rr,
    bevelSize: rr,
    bevelSegments: segs,
    curveSegments: segs,
  })
  geo.rotateX(-Math.PI / 2)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const cx = (bb.min.x + bb.max.x) * 0.5
  const cy = centerY ? (bb.min.y + bb.max.y) * 0.5 : bb.min.y
  const cz = (bb.min.z + bb.max.z) * 0.5
  const sx = w / Math.max(1e-4, bb.max.x - bb.min.x)
  const sy = h / Math.max(1e-4, bb.max.y - bb.min.y)
  const sz = d / Math.max(1e-4, bb.max.z - bb.min.z)
  geo.translate(-cx, -cy, -cz)
  geo.scale(sx, sy, sz)
  geo.computeVertexNormals()
  return geo
}

// Prepara una parte de edificio: `wallUV = true` mapea UVs limpios en la banda de ventanas (0.16..0.84);
// `wallUV = false` fija UV en (0.02, 0.02) (negro en el mapa emisivo) para que techos y bases no tengan manchas.
function prepPart(geo, tintHex, wallUV = false) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone()
  geo.dispose()
  if (!g.attributes.normal) g.computeVertexNormals()
  const pos = g.attributes.position
  const norm = g.attributes.normal
  const uv = new Float32Array(pos.count * 2)
  let minY = Infinity; let maxY = -Infinity
  if (wallUV) {
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i)
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  const spanY = Math.max(0.05, maxY - minY)
  for (let i = 0; i < pos.count; i++) {
    if (wallUV && Math.abs(norm.getY(i)) < 0.72) {
      const x = pos.getX(i); const y = pos.getY(i); const z = pos.getZ(i)
      const ang = (Math.atan2(z, x) / (Math.PI * 2) + 0.5) * 2
      uv[i * 2] = ang
      uv[i * 2 + 1] = 0.18 + ((y - minY) / spanY) * 0.64
    } else {
      uv[i * 2] = 0.02
      uv[i * 2 + 1] = 0.02
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  const col = new THREE.Color(tintHex)
  const cArr = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    cArr[i * 3] = col.r; cArr[i * 3 + 1] = col.g; cArr[i * 3 + 2] = col.b
  }
  g.setAttribute('color', new THREE.BufferAttribute(cArr, 3))
  for (const k of Object.keys(g.attributes)) {
    if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k)
  }
  return g
}

function mergeBuilding(parts) {
  const merged = mergeGeometries(parts, false)
  parts.forEach((p) => p.dispose())
  merged.computeBoundingSphere()
  return merged
}

// ── Kit procedural de torres-castillo y casitas redondeadas estilo juguete (base y=0, altura 1, ancho ~0.95) ──
const TOY_KIT_CACHE = new Map()
function getToyCityKit(roofStyle) {
  if (TOY_KIT_CACHE.has(roofStyle)) return TOY_KIT_CACHE.get(roofStyle)

  const baseCol = '#dce2f0'
  const wallCol = '#ffffff'
  const roofWarm = '#ffd8bf'
  const roofCool = '#cbe4ff'
  const trimCol = '#f2e8ff'
  const roofTint = roofStyle === 'dome' || roofStyle === 'spire' || roofStyle === 'prism' ? roofCool : roofWarm

  // Casa acogedora redondeada (cabaña / chalet según estilo)
  const casa = (() => {
    if (roofStyle === 'dome') {
      return mergeBuilding([
        prepPart(new THREE.CylinderGeometry(0.46, 0.49, 0.1, 10).translate(0, 0.05, 0), baseCol),
        prepPart(new THREE.CylinderGeometry(0.42, 0.44, 0.48, 10).translate(0, 0.34, 0), wallCol, true),
        prepPart(new THREE.TorusGeometry(0.43, 0.045, 6, 12).rotateX(Math.PI / 2).translate(0, 0.58, 0), trimCol),
        prepPart(new THREE.SphereGeometry(0.43, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.95, 1).translate(0, 0.58, 0), roofTint),
      ])
    }
    if (roofStyle === 'stepped' || roofStyle === 'flat') {
      return mergeBuilding([
        prepPart(makeRoundedBoxGeo(0.92, 0.56, 0.88, 0.12, 1).translate(0, 0.28, 0), wallCol, true),
        prepPart(makeRoundedBoxGeo(0.66, 0.28, 0.64, 0.1, 1).translate(0, 0.7, 0), roofTint, true),
        prepPart(new THREE.CylinderGeometry(0.06, 0.08, 0.16, 6).translate(0, 0.92, 0), trimCol),
      ])
    }
    return mergeBuilding([
      prepPart(makeRoundedBoxGeo(0.88, 0.54, 0.84, 0.13, 1).translate(0, 0.27, 0), wallCol, true),
      prepPart(new THREE.CylinderGeometry(0.03, 0.64, 0.45, 4).rotateY(Math.PI / 4).translate(0, 0.75, 0), roofTint),
      prepPart(new THREE.SphereGeometry(0.08, 6, 5).translate(0, 0.96, 0), trimCol),
    ])
  })()

  // Torre-castillo redondeada con galería y techo cónico/cúpula/prisma
  const torre = (() => {
    const cap = roofStyle === 'dome'
      ? prepPart(new THREE.SphereGeometry(0.36, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.55).scale(1, 1.15, 1).translate(0, 0.64, 0), roofTint)
      : roofStyle === 'flat'
        ? prepPart(new THREE.CylinderGeometry(0.38, 0.34, 0.2, 10).translate(0, 0.76, 0), roofTint)
        : roofStyle === 'prism'
          ? prepPart(new THREE.ConeGeometry(0.4, 0.4, 6).translate(0, 0.8, 0), roofTint)
          : prepPart(new THREE.ConeGeometry(0.42, 0.42, 10).translate(0, 0.8, 0), roofTint)
    return mergeBuilding([
      prepPart(new THREE.CylinderGeometry(0.42, 0.46, 0.14, 10).translate(0, 0.07, 0), baseCol),
      prepPart(new THREE.CylinderGeometry(0.33, 0.39, 0.54, 10).translate(0, 0.4, 0), wallCol, true),
      prepPart(new THREE.TorusGeometry(0.35, 0.05, 6, 12).rotateX(Math.PI / 2).translate(0, 0.64, 0), trimCol),
      cap,
    ])
  })()

  // Torreón / ciudadela alta de dos cuerpos redondeados
  const rascacielos = (() => {
    const spire = roofStyle === 'dome'
      ? prepPart(new THREE.SphereGeometry(0.28, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 1.2, 1).translate(0, 0.76, 0), roofTint)
      : prepPart(new THREE.ConeGeometry(0.32, 0.3, 10).translate(0, 0.86, 0), roofTint)
    return mergeBuilding([
      prepPart(new THREE.CylinderGeometry(0.43, 0.48, 0.12, 10).translate(0, 0.06, 0), baseCol),
      prepPart(new THREE.CylinderGeometry(0.36, 0.41, 0.42, 10).translate(0, 0.32, 0), wallCol, true),
      prepPart(new THREE.TorusGeometry(0.36, 0.045, 6, 12).rotateX(Math.PI / 2).translate(0, 0.53, 0), trimCol),
      prepPart(new THREE.CylinderGeometry(0.26, 0.31, 0.28, 10).translate(0, 0.66, 0), wallCol, true),
      spire,
      prepPart(new THREE.CylinderGeometry(0.02, 0.035, 0.14, 6).translate(0, 0.94, 0), trimCol),
    ])
  })()

  // Comercio / taller con marquesina redondeada
  const comercio = mergeBuilding([
    prepPart(makeRoundedBoxGeo(0.95, 0.54, 0.86, 0.12, 1).translate(0, 0.27, 0), wallCol, true),
    prepPart(makeRoundedBoxGeo(1.02, 0.12, 0.94, 0.05, 1).translate(0, 0.56, 0), trimCol),
    prepPart(new THREE.SphereGeometry(0.34, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1.1, 0.78, 1).translate(0, 0.62, 0), roofTint),
  ])

  // Estación / rotonda arqueada
  const estacion = mergeBuilding([
    prepPart(new THREE.CylinderGeometry(0.48, 0.5, 0.12, 12).translate(0, 0.06, 0), baseCol),
    prepPart(new THREE.CylinderGeometry(0.4, 0.43, 0.46, 12).translate(0, 0.35, 0), wallCol, true),
    prepPart(new THREE.SphereGeometry(0.41, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.5).scale(1, 0.85, 1).translate(0, 0.58, 0), roofTint),
    prepPart(new THREE.TorusGeometry(0.42, 0.04, 6, 12).rotateX(Math.PI / 2).translate(0, 0.58, 0), trimCol),
  ])

  // Mini parque urbano redondeado con fuente/árboles
  const parque = mergeBuilding([
    prepPart(new THREE.CylinderGeometry(0.48, 0.5, 0.14, 12).translate(0, 0.07, 0), '#90d494'),
    prepPart(new THREE.SphereGeometry(0.22, 8, 6).translate(-0.2, 0.44, -0.1), '#7de087'),
    prepPart(new THREE.CylinderGeometry(0.05, 0.07, 0.24, 6).translate(-0.2, 0.24, -0.1), '#8c6244'),
    prepPart(new THREE.SphereGeometry(0.18, 8, 6).translate(0.2, 0.38, 0.14), '#a3eb94'),
    prepPart(new THREE.CylinderGeometry(0.04, 0.06, 0.2, 6).translate(0.2, 0.2, 0.14), '#8c6244'),
    prepPart(new THREE.CylinderGeometry(0.14, 0.17, 0.16, 8).translate(0.04, 0.2, -0.18), '#bfe8ff'),
  ])

  const kit = { casa, torre, rascacielos, comercio, estacion, parque }
  TOY_KIT_CACHE.set(roofStyle, kit)
  return kit
}

// Malla instanciada a partir de una lista y una función que rellena el Object3D auxiliar.
function Inst({ geo, mat, items, place, color, cast = false, receive = false, ...rest }) {
  const ref = useRef()
  useEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      _o.position.set(0, 0, 0); _o.rotation.set(0, 0, 0); _o.scale.set(1, 1, 1)
      place(it, _o, i)
      _o.updateMatrix()
      m.setMatrixAt(i, _o.matrix)
      if (color) m.setColorAt(i, color(it, i))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
    m.computeBoundingSphere()
  }, [items, place, color])
  if (!geo || !items.length) return null
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} castShadow={cast} receiveShadow={receive} {...rest} />
}

// Mapa de ventanas cálidas con borde superior/inferior negro (v < 0.12 o v > 0.88 queda sin brillo).
function ventanasTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128
  const g = c.getContext('2d')
  g.fillStyle = '#000000'; g.fillRect(0, 0, 128, 128)
  let s = 12345
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  for (let row = 0; row < 4; row++) {
    const cy = 26 + row * 24
    for (let col = 0; col < 8; col++) {
      if (r() > 0.72) continue
      const cx = 8 + col * 16
      const warm = r() < 0.25 ? '#fff5d6' : r() < 0.65 ? '#ffd480' : '#ffb85c'
      const grad = g.createRadialGradient(cx, cy, 1, cx, cy, 7)
      grad.addColorStop(0, warm)
      grad.addColorStop(0.55, 'rgba(255,196,105,0.45)')
      grad.addColorStop(1, 'rgba(0,0,0,0)')
      g.fillStyle = grad
      g.fillRect(cx - 7, cy - 8, 14, 16)
      g.fillStyle = warm
      g.beginPath()
      g.roundRect(cx - 3.2, cy - 4.5, 6.4, 9, [3, 3, 1.5, 1.5])
      g.fill()
    }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = THREE.RepeatWrapping
  t.wrapT = THREE.ClampToEdgeWrapping
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function etiquetaTex(texto, color) {
  const c = document.createElement('canvas'); c.width = 420; c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(10,12,28,0.84)'
  g.beginPath(); g.roundRect(6, 10, 408, 76, 26); g.fill()
  g.strokeStyle = color; g.lineWidth = 4; g.stroke()
  g.fillStyle = '#fff'; g.font = 'bold 31px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(texto, 210, 49)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Geometría continua para las calles curvas (1 solo draw call, sin grietas ni z-fighting).
function buildCallesGeo(calles, topAt) {
  const pos = []; const idx = []
  const hw = 1.15
  for (const c of calles) {
    const pts = c.pts
    if (pts.length < 2) continue
    const base = pos.length / 3
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]
      const p0 = pts[Math.max(0, i - 1)]
      const p1 = pts[Math.min(pts.length - 1, i + 1)]
      let nx = -(p1.z - p0.z); let nz = p1.x - p0.x
      const l = Math.hypot(nx, nz) || 1
      nx /= l; nz /= l
      const y = topAt(p.x, p.z) + 0.14
      pos.push(p.x - nx * hw, y - 0.12, p.z - nz * hw)
      pos.push(p.x - nx * hw * 0.82, y + 0.06, p.z - nz * hw * 0.82)
      pos.push(p.x + nx * hw * 0.82, y + 0.06, p.z + nz * hw * 0.82)
      pos.push(p.x + nx * hw, y - 0.12, p.z + nz * hw)
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const a = base + i * 4; const b = a + 4
      for (let k = 0; k < 3; k++) {
        idx.push(a + k, a + k + 1, b + k)
        idx.push(a + k + 1, b + k + 1, b + k)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

const PORT_STONE_GEO = (() => {
  const mk = (parts) => {
    const g = mergeGeometries(parts.map((p) => { const n = p.toNonIndexed(); p.dispose(); return n }), false)
    g.computeVertexNormals()
    return g
  }
  return {
    out: mk([
      new THREE.CapsuleGeometry(0.3, 2.5, 4, 8).translate(-1.65, 1.55, 0),
      new THREE.CapsuleGeometry(0.3, 2.5, 4, 8).translate(1.65, 1.55, 0),
      new THREE.CapsuleGeometry(0.32, 3.4, 4, 8).rotateZ(Math.PI / 2).translate(0, 3.15, 0),
    ]),
    in: mk([
      new THREE.TorusGeometry(1.65, 0.3, 8, 18, Math.PI).translate(0, 0.25, 0),
      new THREE.CylinderGeometry(0.36, 0.42, 0.9, 10).translate(-1.65, 0.45, 0),
      new THREE.CylinderGeometry(0.36, 0.42, 0.9, 10).translate(1.65, 0.45, 0),
    ]),
  }
})()

function Puerto({ p, color, y, onHover, arrows }) {
  const col = useMemo(() => new THREE.Color(color), [color])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(1.8), toneMapped: false }), [col])
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: col.clone().lerp(new THREE.Color('#c8cde0'), 0.55), roughness: 0.5, metalness: 0.15 }), [col])
  const etiqueta = useMemo(() => etiquetaTex(`${p.n} · ${p.kind === 'out' ? 'SALIDA ▸' : '◂ LLEGADA'} ${p.toName}`, color), [p, color])
  const flecha = useRef()
  useEffect(() => { arrows.current[p.id] = flecha.current; return () => { arrows.current[p.id] = null } }, [arrows, p.id])
  useEffect(() => () => { glow.dispose(); stone.dispose(); etiqueta.dispose() }, [glow, stone, etiqueta])
  const salida = p.kind === 'out'
  return (
    <group
      position={[p.x, y, p.z]}
      rotation={[0, Math.PI / 2 - p.ang, 0]}
      onPointerOver={(e) => { e.stopPropagation(); onHover(p) }}
      onPointerOut={() => onHover(null)}
    >
      <mesh geometry={salida ? PORT_STONE_GEO.out : PORT_STONE_GEO.in} material={stone} />
      {salida ? (
        <mesh position={[0, 3.15, 0.34]} material={glow}><boxGeometry args={[2.9, 0.16, 0.08]} /></mesh>
      ) : (
        <mesh position={[0, 0.25, 0]} material={glow}><torusGeometry args={[1.32, 0.09, 6, 18, Math.PI]} /></mesh>
      )}
      <group ref={flecha} position={[0, salida ? 4.45 : 3.15, 0]}>
        <mesh rotation={[salida ? Math.PI / 2 : -Math.PI / 2, 0, 0]} material={glow}><coneGeometry args={[0.52, 1.3, 8]} /></mesh>
      </group>
      <sprite position={[0, salida ? 6.2 : 4.9, 0]} scale={[8.4, 1.92, 1]}>
        <spriteMaterial map={etiqueta} transparent depthWrite={false} fog={false} />
      </sprite>
    </group>
  )
}

// Textura chibi simple para las ballitas que pasean por la plaza.
function ballitaFaceTex() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, 128, 64)
  g.fillStyle = 'rgba(255,140,165,0.45)'
  g.beginPath(); g.ellipse(49, 38, 6, 3.5, 0, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(79, 38, 6, 3.5, 0, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#181a2c'
  g.beginPath(); g.arc(54, 30, 4.2, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(74, 30, 4.2, 0, Math.PI * 2); g.fill()
  g.fillStyle = '#ffffff'
  g.beginPath(); g.arc(55.5, 28.5, 1.5, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(75.5, 28.5, 1.5, 0, Math.PI * 2); g.fill()
  g.strokeStyle = '#181a2c'; g.lineWidth = 2.2; g.lineCap = 'round'
  g.beginPath(); g.arc(64, 36, 3.5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke()
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Flor luminosa estilizada (botón central + pétalos suaves)
function makeFlorGeo() {
  const parts = [new THREE.SphereGeometry(0.24, 8, 6).translate(0, 1.12, 0)]
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2
    parts.push(new THREE.SphereGeometry(0.16, 7, 5).scale(1.1, 0.55, 1.1).translate(Math.cos(a) * 0.22, 1.06, Math.sin(a) * 0.22))
  }
  const merged = mergeGeometries(parts.map((p) => { const n = p.toNonIndexed(); p.dispose(); return n }), false)
  merged.computeVertexNormals()
  return merged
}

// Copas redondeadas de juguete por estilo del bioma
function makeCopaGeo(tipo) {
  if (tipo === 'cono') {
    const a = new THREE.ConeGeometry(0.88, 1.45, 12).translate(0, 1.35, 0)
    const b = new THREE.ConeGeometry(0.68, 1.25, 12).translate(0, 2.05, 0)
    const g = mergeGeometries([a.toNonIndexed(), b.toNonIndexed()], false)
    a.dispose(); b.dispose()
    return g
  }
  if (tipo === 'diamante') {
    return new THREE.OctahedronGeometry(0.95, 1).scale(0.86, 1.25, 0.86).translate(0, 1.72, 0)
  }
  const a = new THREE.SphereGeometry(0.82, 12, 9).translate(0, 1.48, 0)
  const b = new THREE.SphereGeometry(0.62, 10, 8).translate(0.32, 1.72, 0.18)
  const c = new THREE.SphereGeometry(0.56, 10, 8).translate(-0.28, 1.66, -0.15)
  const g = mergeGeometries([a.toNonIndexed(), b.toNonIndexed(), c.toNonIndexed()], false)
  a.dispose(); b.dispose(); c.dispose()
  return g
}

function Cielo({ biome }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      hor: { value: new THREE.Color(biome.atmoBase).multiplyScalar(0.18) },
      mid: { value: new THREE.Color(biome.atmoRim).lerp(new THREE.Color('#0c1130'), 0.72) },
      zen: { value: new THREE.Color('#040614') },
    },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: `
      uniform vec3 hor; uniform vec3 mid; uniform vec3 zen;
      varying vec3 vDir;
      void main() {
        float y = vDir.y;
        vec3 c = mix(hor, mid, smoothstep(-0.1, 0.26, y));
        c = mix(c, zen, smoothstep(0.18, 0.78, y));
        float glow = exp(-pow(y * 3.5, 2.0)) * (0.45 + 0.55 * max(0.0, sin(vDir.x * 3.0 + vDir.z * 2.0)));
        c += hor * glow * 0.45;
        gl_FragColor = vec4(c, 1.0);
      }
    `,
  }), [biome])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <>
      <mesh material={mat} renderOrder={-10}><sphereGeometry args={[420, 24, 14]} /></mesh>
      <Stars radius={280} depth={80} count={1100} factor={11} saturation={0.55} fade speed={0.35} />
    </>
  )
}

function SuperficieEscena({ node, biome, gen, nodeIdx, ballitas, onHoverPort }) {
  const [modelos, setModelos] = useState({})
  const arrows = useRef([])
  const hoverId = useRef(-1)
  const bRef = useRef(ballitas)
  bRef.current = ballitas
  const monAnimRef = useRef({ destinos: [], terminals: [], monument: null })

  useEffect(() => {
    let vivo = true
    Promise.all(gen.perfil.modelos.map(cargarModelo)).then((gs) => {
      if (vivo) setModelos(Object.fromEntries(gen.perfil.modelos.map((n, i) => [n, gs[i]]).filter(([, g]) => g)))
    })
    return () => { vivo = false }
  }, [biome, gen])

  const kit = useMemo(() => getToyCityKit(biome.roofStyle), [biome.roofStyle])

  // ── paleta saturada y acogedora tipo diorama de juguete, rotada sutilmente por nodo ──
  const pal = useMemo(() => {
    const d = ((gen.seed % 997) / 997) * 0.09
    return [
      colorSat(biome.groundMid, 0.52, 0.34, 0.54),
      colorSat(biome.groundHigh, 0.55, 0.42, 0.62),
      colorSat(biome.parkColor, 0.58, 0.34, 0.52),
      colorSat(biome.downtownColor, 0.36, 0.48, 0.66),
      colorSat(biome.cityLight, 0.62, 0.46, 0.62, d),
      colorSat(biome.buildingColors[1] || biome.cityLight, 0.58, 0.46, 0.64, -d),
    ]
  }, [biome, gen])

  // ── materiales y geometrías compartidas ──
  const M = useMemo(() => {
    const win = ventanasTex()
    const bFace = ballitaFaceTex()
    const calido = new THREE.Color('#ffd699').lerp(new THREE.Color(biome.cityLight), 0.25)
    return {
      win,
      bFace,
      suelo: new THREE.MeshStandardMaterial({ roughness: 0.78, metalness: 0.02 }),
      peana: new THREE.MeshStandardMaterial({ color: colorSat(biome.groundLow, 0.35, 0.22, 0.38), roughness: 0.88 }),
      plaza: new THREE.MeshStandardMaterial({ color: colorSat(biome.downtownColor, 0.32, 0.48, 0.66), roughness: 0.72 }),
      borde: new THREE.MeshBasicMaterial({ color: new THREE.Color(biome.atmoRim).multiplyScalar(1.2), toneMapped: false }),
      calle: new THREE.MeshStandardMaterial({ color: colorSat(biome.roadColor, 0.2, 0.6, 0.76), roughness: 0.68 }),
      edif: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62, metalness: 0.08, emissive: calido, emissiveMap: win, emissiveIntensity: 1.35 }),
      tronco: new THREE.MeshStandardMaterial({ color: '#78523a', roughness: 0.88 }),
      copa: new THREE.MeshStandardMaterial({ roughness: 0.65 }),
      roca: new THREE.MeshStandardMaterial({ roughness: 0.88 }),
      modelo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.05, emissive: biome.atmoRim, emissiveIntensity: 0.14 }),
      poste: new THREE.MeshStandardMaterial({ color: '#33384d', roughness: 0.5, metalness: 0.45 }),
      lampA: new THREE.MeshBasicMaterial({ color: calido.clone().multiplyScalar(1.65), toneMapped: false }),
      lampB: new THREE.MeshBasicMaterial({ color: calido.clone().multiplyScalar(1.65), toneMapped: false }),
      flor: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff').multiplyScalar(1.65), toneMapped: false }),
      tallo: new THREE.MeshStandardMaterial({ color: '#34784e', roughness: 0.78 }),
      vida: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff').multiplyScalar(1.4), toneMapped: false }),
      bola: new THREE.MeshStandardMaterial({ map: bFace, roughness: 0.35, emissive: '#ffffff', emissiveIntensity: 0.22 }),
      calido,
    }
  }, [biome])

  const G = useMemo(() => ({
    celda: makeRoundedBoxGeo(1, 1, 1, 0.14, 1, true),
    peana: new THREE.CylinderGeometry(R_SUELO + 0.9, R_SUELO + 2.5, 4.4, 56),
    plaza: new THREE.CylinderGeometry(gen.plazaR + 0.25, gen.plazaR + 0.5, 0.28, 44),
    borde: new THREE.TorusGeometry(R_SUELO + 0.92, 0.13, 6, 80).rotateX(Math.PI / 2),
    anillo: new THREE.TorusGeometry(gen.plazaR + 0.25, 0.08, 6, 56).rotateX(Math.PI / 2),
    calles: buildCallesGeo(gen.calles, gen.topAt),
    tronco: new THREE.CylinderGeometry(0.14, 0.22, 1.1, 7).translate(0, 0.55, 0),
    copa: makeCopaGeo(gen.perfil.copa),
    roca: new THREE.DodecahedronGeometry(0.55, 1).scale(1.05, 0.62, 0.92).translate(0, 0.22, 0),
    poste: new THREE.CylinderGeometry(0.06, 0.095, 1.95, 6).translate(0, 0.975, 0),
    bulbo: new THREE.SphereGeometry(0.24, 9, 7).translate(0, 2.05, 0),
    tallo: new THREE.CylinderGeometry(0.035, 0.055, 1.0, 5).translate(0, 0.5, 0),
    flor: makeFlorGeo(),
    vida: new THREE.SphereGeometry(0.19, 8, 6),
    bola: new THREE.SphereGeometry(0.48, 12, 9),
  }), [gen])

  useEffect(() => () => { Object.values(M).forEach((m) => m?.dispose?.()); Object.values(G).forEach((g) => g?.dispose?.()) }, [M, G])

  // ── listas derivadas ──
  const celdaPlace = useMemo(() => (c, o) => { o.position.set(c.x, (c.top - 2.4) / 2, c.z); o.scale.set(CELDA * 0.96, c.top + 2.4, CELDA * 0.96) }, [])
  const celdaColor = useMemo(() => (c) => _c.copy(pal[c.col]).multiplyScalar(0.92 + c.v * 0.16), [pal])
  const porTipo = useMemo(() => {
    const r = {}; BUILDING_TYPES.forEach((t) => { r[t] = [] }); gen.edificios.forEach((e) => r[e.tipo]?.push(e)); return r
  }, [gen])
  const edifPlace = useMemo(() => (e, o) => { o.position.set(e.x, e.y, e.z); o.rotation.y = e.rot; o.scale.set(e.w, e.h, e.w) }, [])
  const edifColor = useMemo(() => (e) => {
    const pick = Math.abs(Math.floor(e.x * 3.7 + e.z * 5.3)) % 2
    const base = pick === 0 ? pal[4] : pal[5]
    return _c.set('#ffffff').lerp(base, 0.34 + (((e.x * 7.3 + e.z * 3.1) % 1 + 1) % 1) * 0.24)
  }, [pal])
  const arboles = useMemo(() => gen.flora.filter((f) => f.tipo === 'arbol'), [gen])
  const rocas = useMemo(() => gen.flora.filter((f) => f.tipo === 'roca'), [gen])
  const luces = useMemo(() => gen.flora.filter((f) => f.tipo === 'luz'), [gen])
  const porModelo = useMemo(() => gen.perfil.modelos.map((n, i) => gen.flora.filter((f) => f.tipo === 'modelo' && f.m === i)), [gen])
  const troncoPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z); o.scale.setScalar(f.s * 1.25) }, [])
  const copaColor = useMemo(() => (f) => _c.copy(pal[[2, 4, 5, 0, 2][Math.floor(f.c * 5)]]).multiplyScalar(0.88 + f.s * 0.18), [pal])
  const rocaPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z); o.rotation.y = f.rot; o.scale.setScalar(f.s * 1.4) }, [])
  const rocaColor = useMemo(() => (f) => _c.copy(pal[1]).lerp(new THREE.Color('#a4a6b8'), 0.45).multiplyScalar(0.84 + f.c * 0.25), [pal])
  const luzPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z); o.scale.setScalar(f.s * 1.15) }, [])
  const luzColor = useMemo(() => (f) => _c.set([biome.cityLight, biome.atmoRim, biome.emissiveColor][Math.floor(f.c * 3)]), [biome])
  const modeloPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y - 0.05, f.z); o.rotation.y = f.rot; o.scale.setScalar(f.s * 3.2) }, [])
  const faroA = useMemo(() => gen.farolas.filter((f) => f.fase < 3.14), [gen])
  const faroB = useMemo(() => gen.farolas.filter((f) => f.fase >= 3.14), [gen])
  const faroPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z) }, [])

  // viandantes que recorren las calles + ballitas del nodo paseando por la plaza
  const walkers = useMemo(() => {
    const w = []
    gen.calles.forEach((c, ci) => { for (let k = 0; k < 2 && w.length < 24; k++) w.push({ c: ci, u: (k * 0.5 + ci * 0.137) % 1, v: (k ? -1 : 1) * (0.018 + ((ci * 7 + k) % 5) * 0.004) }) })
    return w
  }, [gen])
  const walkRef = useRef()
  const ballRef = useRef()
  const walkColor = useMemo(() => (w, i) => _c.set([biome.creatureColor, biome.cityLight, '#ffffff'][i % 3]), [biome])
  const MAXB = 48
  const fogColor = useMemo(() => '#' + new THREE.Color(biome.atmoBase).multiplyScalar(0.08).getHexString(), [biome])

  const onHover = (p) => {
    hoverId.current = p ? p.id : -1
    onHoverPort(p)
  }

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    M.lampA.color.setScalar(1.35 + Math.sin(t * 5.6) * 0.2 + Math.sin(t * 15) * 0.08).multiply(M.calido)
    M.lampB.color.setScalar(1.35 + Math.sin(t * 4.8 + 2) * 0.22 + Math.sin(t * 13 + 1) * 0.08).multiply(M.calido)
    M.flor.color.setScalar(1.4 + Math.sin(t * 2.4) * 0.25)

    const mon = monAnimRef.current.monument
    if (mon) {
      const mt = t + mon.nodeIdx * 1.7
      if (mon.animRef.current) {
        if (mon.biomeId === 'mar') mon.animRef.current.rotation.y = mt * 1.35
        else if (mon.biomeId === 'nubes') {
          mon.animRef.current.position.y = 1.65 + Math.sin(mt * 1.4) * 0.22
          mon.animRef.current.rotation.y = mt * 0.3
        } else mon.animRef.current.rotation.y = mt * 0.85
      }
      if (mon.animRef2.current) {
        mon.animRef2.current.rotation.y = -mt * 0.6
        mon.animRef2.current.rotation.z = Math.sin(mt * 1.2) * 0.08
      }
    }

    for (let i = 0; i < arrows.current.length; i++) {
      const a = arrows.current[i]
      if (a) { const p = gen.puertos[i]; a.position.z = (p.kind === 'out' ? 1 : -1) * Math.sin(t * 3 + i) * 0.35; a.scale.setScalar(hoverId.current === i ? 1.35 : 1) }
    }
    const wm = walkRef.current
    if (wm) {
      const h = Math.min(dt, 0.05)
      walkers.forEach((w, i) => {
        w.u += w.v * h; if (w.u > 1) w.u -= 1; if (w.u < 0) w.u += 1
        const pts = gen.calles[w.c].pts; const f = w.u * (pts.length - 1); const k = Math.min(pts.length - 2, Math.floor(f)); const q = f - k
        const x = pts[k].x + (pts[k + 1].x - pts[k].x) * q; const z = pts[k].z + (pts[k + 1].z - pts[k].z) * q
        _o.position.set(x, gen.topAt(x, z) + 0.34, z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix()
        wm.setMatrixAt(i, _o.matrix)
      })
      wm.instanceMatrix.needsUpdate = true
    }
    const bm = ballRef.current
    if (bm) {
      let n = 0
      for (const b of bRef.current) {
        if (n >= MAXB) break
        if (b.node !== nodeIdx || b.phase === 'travel' || b.phase === 'gone' || b.phase === 'dying') continue
        const hsh = (b.id * 2654435761 % 1000) / 1000
        const dir = hsh > 0.5 ? 1 : -1
        const a = hsh * 6.283 + t * (0.14 + hsh * 0.12) * dir
        const rr = gen.plazaR * (0.58 + ((b.id * 97) % 34) / 100)
        const x = Math.cos(a) * rr; const z = Math.sin(a) * rr
        _o.position.set(x, gen.topAt(x, z) + 0.48 + Math.abs(Math.sin(t * 4.2 + b.id)) * 0.16, z); _o.rotation.set(0, -a + (dir > 0 ? 0 : Math.PI) - Math.PI / 2, 0); _o.scale.setScalar(1); _o.updateMatrix()
        bm.setMatrixAt(n, _o.matrix); bm.setColorAt(n, _c.set(bodyColor(b.genome)))
        n++
      }
      bm.count = n
      bm.instanceMatrix.needsUpdate = true
      if (bm.instanceColor) bm.instanceColor.needsUpdate = true
    }
  })

  const spot = useMemo(() => ({ pos: new THREE.Vector3(), quat: new THREE.Quaternion() }), [])
  const nodoFalso = useMemo(() => ({ idx: node.idx, pos: new THREE.Vector3() }), [node])
  const rimLightCol = useMemo(() => new THREE.Color('#ffe8cc').lerp(new THREE.Color(biome.atmoRim), 0.25), [biome])

  return (
    <group>
      <color attach="background" args={['#040614']} />
      <fogExp2 attach="fog" args={[fogColor, 0.0024]} />
      <Cielo biome={biome} />
      <ambientLight intensity={0.42} color="#c2ceff" />
      <hemisphereLight args={[biome.atmoRim, biome.groundMid, 0.95]} />
      <directionalLight position={[-28, 48, 28]} intensity={1.6} color={rimLightCol} />
      <directionalLight position={[32, 24, -28]} intensity={0.55} color={biome.atmoRim} />

      <mesh geometry={G.peana} material={M.peana} position={[0, -4.5, 0]} />
      <mesh geometry={G.plaza} material={M.plaza} position={[0, gen.topAt(0, 0) - 0.02, 0]} />
      <mesh geometry={G.borde} material={M.borde} position={[0, -2.28, 0]} />
      <mesh geometry={G.anillo} material={M.borde} position={[0, gen.topAt(0, 0) + 0.14, 0]} />
      <Inst geo={G.celda} mat={M.suelo} items={gen.celdas} place={celdaPlace} color={celdaColor} />
      <mesh geometry={G.calles} material={M.calle} />

      {BUILDING_TYPES.map((t) => (
        <Inst key={t} geo={kit[t]} mat={M.edif} items={porTipo[t]} place={edifPlace} color={edifColor} />
      ))}

      <Inst geo={G.tronco} mat={M.tronco} items={arboles} place={troncoPlace} />
      <Inst geo={G.copa} mat={M.copa} items={arboles} place={troncoPlace} color={copaColor} />
      <Inst geo={G.roca} mat={M.roca} items={rocas} place={rocaPlace} color={rocaColor} />
      <Inst geo={G.tallo} mat={M.tallo} items={luces} place={luzPlace} />
      <Inst geo={G.flor} mat={M.flor} items={luces} place={luzPlace} color={luzColor} />
      {gen.perfil.modelos.map((n, i) => (modelos[n] ? <Inst key={n} geo={modelos[n]} mat={M.modelo} items={porModelo[i]} place={modeloPlace} /> : null))}
      <Inst geo={G.poste} mat={M.poste} items={gen.farolas} place={faroPlace} />
      <Inst geo={G.bulbo} mat={M.lampA} items={faroA} place={faroPlace} />
      <Inst geo={G.bulbo} mat={M.lampB} items={faroB} place={faroPlace} />

      {walkers.length > 0 && <instancedMesh ref={(m) => { walkRef.current = m; if (m) { m.frustumCulled = false; walkers.forEach((w, i) => m.setColorAt(i, walkColor(w, i))) } }} args={[G.vida, M.vida, walkers.length]} frustumCulled={false} />}
      <instancedMesh ref={ballRef} args={[G.bola, M.bola, MAXB]} frustumCulled={false} count={0} />

      <Suspense fallback={null}>
        <group position={[0, gen.topAt(0, 0) + 0.08, 0]}>
          <Monument
            node={nodoFalso}
            biome={biome}
            spot={spot}
            scale={2.05}
            minLight={0.34}
            emissiveMap={M.win}
            animRegRef={monAnimRef}
          />
        </group>
      </Suspense>

      {gen.puertos.map((p) => (
        <Puerto key={p.id} p={p} y={gen.topAt(p.x, p.z) - 0.05} color={BIOMES[p.themeId]?.cityLight || biome.cityLight} onHover={onHover} arrows={arrows} />
      ))}

      <OrbitControls
        makeDefault
        target={[0, 2.5, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        minDistance={24}
        maxDistance={105}
        minPolarAngle={0.35}
        maxPolarAngle={1.28}
        autoRotate
        autoRotateSpeed={0.22}
      />

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.28} radius={0.6} intensity={0.48} levels={4} />
        <ToneMapping mode={TONE_MAPPING_AGX} middleGrey={0.58} />
      </EffectComposer>
    </group>
  )
}

// Vista de superficie montada en su propio <Canvas> aislado de la escena general (su propia cámara, escena, cielo, niebla y luces).
export default function Superficie({ world, nodeIdx, ballitas, onSalir, showStats = false, onStatsSample }) {
  const node = world.nodes[nodeIdx]
  const biome = useMemo(() => resolveNodeBiome(node, world), [node, world])
  const gen = useMemo(() => generarSuperficie(node, biome, world), [node, biome, world])
  const [hoverPort, setHoverPort] = useState(null)

  useLayoutEffect(() => {
    const prevDbg = typeof window !== 'undefined' ? window.__ballitasDebug : undefined
    return () => {
      if (typeof window !== 'undefined' && prevDbg) window.__ballitasDebug = prevDbg
    }
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 20, background: '#040614' }}>
      <Canvas
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        camera={{ fov: 40, near: 0.5, far: 1200, position: [0, 44, 62] }}
        onCreated={({ gl }) => { gl.debug.checkShaderErrors = import.meta.env.DEV }}
      >
        <SuperficieEscena
          node={node}
          biome={biome}
          gen={gen}
          nodeIdx={nodeIdx}
          ballitas={ballitas}
          onHoverPort={setHoverPort}
        />
        <StatsProbe active={showStats} onSample={onStatsSample} />
      </Canvas>
      <div
        style={{
          position: 'fixed', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 22,
          display: 'flex', gap: 12, alignItems: 'center', padding: '8px 14px', borderRadius: 14,
          color: '#fff', font: '600 14px system-ui,sans-serif', pointerEvents: 'auto',
          background: `${biome.groundLow}e6`, border: `1px solid ${biome.atmoRim}`,
          boxShadow: `0 0 18px ${biome.atmoBase}99`,
        }}
      >
        <span>{biome.emoji} {node.name} · {biome.title}</span>
        <button
          type="button"
          onClick={() => onSalir()}
          style={{
            cursor: 'pointer', border: `1px solid ${biome.atmoRim}`, background: `${biome.atmoBase}55`,
            color: '#fff', borderRadius: 8, padding: '4px 10px', font: 'inherit',
          }}
        >
          Salir (Esc)
        </button>
      </div>
      <div
        style={{
          position: 'fixed', bottom: 22, left: '50%', transform: 'translateX(-50%)', zIndex: 22,
          padding: '6px 14px', borderRadius: 10, color: '#fff', background: '#0a0c1ce6',
          border: `1px solid ${biome.atmoRim}`, font: '600 13px system-ui,sans-serif',
          pointerEvents: 'none', opacity: hoverPort ? 1 : 0, transition: 'opacity .15s',
        }}
      >
        {hoverPort ? `${hoverPort.kind === 'out' ? 'Salida' : 'Llegada'} ${hoverPort.n} · ${hoverPort.themeEmoji} ${hoverPort.themeName} · ${hoverPort.kind === 'out' ? 'lleva a' : 'viene de'} ${hoverPort.toName}` : ''}
      </div>
    </div>
  )
}
