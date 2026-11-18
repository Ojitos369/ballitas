// Vista de superficie de un nodo: diorama procedural (parcelas de colores, barrios del kit GLB del bioma,
// flora, calles hacia cada puerto, cielo nocturno). Todo instanciado; un solo useFrame; 2 luces reales.
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars } from '@react-three/drei'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { BIOMES, resolveNodeBiome } from './biomas.js'
import { loadBiomeCityKit, BUILDING_TYPES } from './arquitectura.js'
import { Monument } from './monumentos.jsx'
import { generarSuperficie, CELDA, R_SUELO } from './superficieGen.js'
import { bodyColor } from '../Ballita.jsx'

const MODELS_URL = (import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/') + 'models/'
const gltfLoader = new GLTFLoader()
const modeloCache = new Map()

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
        for (let i = 0; i < s.count; i++) { a[i * 3] = s.getX(i); a[i * 3 + 1] = s.getY(i); a[i * 3 + 2] = s.getZ(i) }
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

// Malla instanciada a partir de una lista y una función que rellena el Object3D auxiliar.
function Inst({ geo, mat, items, place, color, cast = false, ...rest }) {
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
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} frustumCulled={false} castShadow={cast} {...rest} />
}

function ventanasTex() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64
  const g = c.getContext('2d')
  g.fillStyle = '#000'; g.fillRect(0, 0, 64, 64)
  let s = 12345
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
    if (r() < 0.62) { g.fillStyle = r() < 0.2 ? '#ffffff' : '#ffc46b'; g.fillRect(x * 8 + 2, y * 8 + 2, 4, 4) }
  }
  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 3); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function etiquetaTex(texto, color) {
  const c = document.createElement('canvas'); c.width = 384; c.height = 96
  const g = c.getContext('2d')
  g.fillStyle = 'rgba(8,10,24,0.78)'
  g.beginPath(); g.roundRect(4, 8, 376, 80, 22); g.fill()
  g.strokeStyle = color; g.lineWidth = 4; g.stroke()
  g.fillStyle = '#fff'; g.font = 'bold 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'
  g.fillText(texto, 192, 50)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  return t
}

function Puerto({ p, color, y, onHover, arrows }) {
  const col = useMemo(() => new THREE.Color(color), [color])
  const glow = useMemo(() => new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2.2), toneMapped: false }), [col])
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: col.clone().lerp(new THREE.Color('#b8bccf'), 0.55), roughness: 0.55, metalness: 0.2 }), [col])
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
      {salida ? (
        <>
          <mesh position={[-1.7, 1.7, 0]} material={stone}><boxGeometry args={[0.55, 3.4, 0.55]} /></mesh>
          <mesh position={[1.7, 1.7, 0]} material={stone}><boxGeometry args={[0.55, 3.4, 0.55]} /></mesh>
          <mesh position={[0, 3.55, 0]} material={stone}><boxGeometry args={[4.4, 0.6, 0.75]} /></mesh>
          <mesh position={[0, 3.55, 0.4]} material={glow}><boxGeometry args={[3.7, 0.16, 0.06]} /></mesh>
        </>
      ) : (
        <>
          <mesh position={[0, 0.05, 0]} rotation={[0, 0, 0]} material={stone}><torusGeometry args={[1.8, 0.32, 8, 22, Math.PI]} /></mesh>
          <mesh position={[0, 0.05, 0]} material={glow}><torusGeometry args={[1.45, 0.09, 6, 22, Math.PI]} /></mesh>
          <mesh position={[-1.8, 0.7, 0]} material={stone}><boxGeometry args={[0.64, 1.5, 0.64]} /></mesh>
          <mesh position={[1.8, 0.7, 0]} material={stone}><boxGeometry args={[0.64, 1.5, 0.64]} /></mesh>
        </>
      )}
      <group ref={flecha} position={[0, salida ? 5.0 : 3.5, 0]}>
        <mesh rotation={[salida ? Math.PI / 2 : -Math.PI / 2, 0, 0]} material={glow}><coneGeometry args={[0.6, 1.5, 4]} /></mesh>
      </group>
      <sprite position={[0, salida ? 6.8 : 5.4, 0]} scale={[8.4, 2.1, 1]}>
        <spriteMaterial map={etiqueta} transparent depthWrite={false} fog={false} />
      </sprite>
    </group>
  )
}

const copaGeo = {
  esfera: () => new THREE.IcosahedronGeometry(0.9, 1).translate(0, 1.55, 0),
  cono: () => new THREE.ConeGeometry(0.8, 2.1, 7).translate(0, 1.7, 0),
  diamante: () => new THREE.OctahedronGeometry(0.95).scale(0.9, 1.25, 0.9).translate(0, 1.7, 0),
}

function Cielo({ biome }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      hor: { value: new THREE.Color(biome.atmoBase).multiplyScalar(0.5) },
      zen: { value: new THREE.Color('#03040c') },
    },
    vertexShader: 'varying float vY; void main(){ vY = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 hor; uniform vec3 zen; varying float vY; void main(){ float t = smoothstep(-0.1, 0.7, vY); gl_FragColor = vec4(mix(hor, zen, t), 1.); }',
  }), [biome])
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <>
      <mesh material={mat} renderOrder={-10}><sphereGeometry args={[420, 24, 14]} /></mesh>
      <Stars radius={300} depth={80} count={1800} factor={11} saturation={0.5} fade speed={0.4} />
    </>
  )
}

export default function Superficie({ world, nodeIdx, ballitas, onSalir }) {
  const node = world.nodes[nodeIdx]
  const biome = useMemo(() => resolveNodeBiome(node, world), [node, world])
  const gen = useMemo(() => generarSuperficie(node, biome, world), [node, biome, world])
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const [kit, setKit] = useState(null)
  const [modelos, setModelos] = useState({})
  const hoverEl = useRef(null)
  const arrows = useRef([])
  const hoverId = useRef(-1)
  const bRef = useRef(ballitas)
  bRef.current = ballitas
  const init = useRef(false)

  useEffect(() => {
    let vivo = true
    loadBiomeCityKit(biome.id, biome.roofStyle).then((k) => { if (vivo) setKit(k) })
    Promise.all(gen.perfil.modelos.map(cargarModelo)).then((gs) => {
      if (vivo) setModelos(Object.fromEntries(gen.perfil.modelos.map((n, i) => [n, gs[i]]).filter(([, g]) => g)))
    })
    return () => { vivo = false }
  }, [biome, gen])

  // ── paleta saturada tipo juguete, rotada por nodo ──
  const pal = useMemo(() => {
    const d = ((gen.seed % 997) / 997) * 0.12
    return [
      colorSat(biome.groundMid, 0.5, 0.3, 0.52), colorSat(biome.groundHigh, 0.55, 0.38, 0.58), colorSat(biome.parkColor, 0.55, 0.32, 0.5),
      colorSat(biome.downtownColor, 0.3, 0.5, 0.68), colorSat(biome.cityLight, 0.65, 0.45, 0.62, d), colorSat(biome.buildingColors[1] || biome.cityLight, 0.6, 0.45, 0.62, -d),
    ]
  }, [biome, gen])

  // ── materiales y geometrías compartidas ──
  const M = useMemo(() => {
    const win = ventanasTex()
    const calido = new THREE.Color('#ffd9a0').lerp(new THREE.Color(biome.cityLight), 0.3)
    return {
      win,
      suelo: new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.02 }),
      peana: new THREE.MeshStandardMaterial({ color: biome.groundLow, roughness: 0.9 }),
      borde: new THREE.MeshBasicMaterial({ color: new THREE.Color(biome.atmoRim).multiplyScalar(1.8), toneMapped: false }),
      calle: new THREE.MeshStandardMaterial({ color: colorSat(biome.roadColor, 0.15, 0.58, 0.72), roughness: 0.7 }),
      edif: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: biome.buildingRoughness, metalness: Math.min(0.2, biome.buildingMetalness), emissive: calido, emissiveMap: win, emissiveIntensity: 1.5 }),
      tronco: new THREE.MeshStandardMaterial({ color: '#6b4a35', roughness: 0.9 }),
      copa: new THREE.MeshStandardMaterial({ roughness: 0.7 }),
      roca: new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }),
      modelo: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.65, metalness: 0.05 }),
      poste: new THREE.MeshStandardMaterial({ color: '#2b2e3f', roughness: 0.6, metalness: 0.4 }),
      lampA: new THREE.MeshBasicMaterial({ color: calido.clone().multiplyScalar(2), toneMapped: false }),
      lampB: new THREE.MeshBasicMaterial({ color: calido.clone().multiplyScalar(2), toneMapped: false }),
      flor: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff').multiplyScalar(1.9), toneMapped: false }),
      tallo: new THREE.MeshStandardMaterial({ color: '#2f6a46', roughness: 0.8 }),
      vida: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff').multiplyScalar(1.7), toneMapped: false }),
      bola: new THREE.MeshStandardMaterial({ roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0.25 }),
      calido,
    }
  }, [biome])
  const G = useMemo(() => ({
    caja: new THREE.BoxGeometry(1, 1, 1),
    peana: new THREE.CylinderGeometry(R_SUELO + 0.8, R_SUELO + 2.4, 4.2, 56),
    borde: new THREE.TorusGeometry(R_SUELO + 0.85, 0.13, 6, 90).rotateX(Math.PI / 2),
    anillo: new THREE.TorusGeometry(gen.plazaR, 0.11, 6, 64).rotateX(Math.PI / 2),
    tronco: new THREE.CylinderGeometry(0.13, 0.2, 1.1, 6).translate(0, 0.55, 0),
    copa: (copaGeo[gen.perfil.copa] || copaGeo.esfera)(),
    roca: new THREE.IcosahedronGeometry(0.5, 0).scale(1, 0.62, 0.9).translate(0, 0.2, 0),
    poste: new THREE.CylinderGeometry(0.06, 0.09, 1.7, 5).translate(0, 0.85, 0),
    bulbo: new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.8, 0),
    tallo: new THREE.CylinderGeometry(0.03, 0.05, 0.9, 5).translate(0, 0.45, 0),
    flor: new THREE.SphereGeometry(0.2, 8, 6).translate(0, 1.0, 0),
    vida: new THREE.SphereGeometry(0.17, 8, 6),
    bola: new THREE.SphereGeometry(0.32, 10, 8),
  }), [gen])
  useEffect(() => () => { Object.values(M).forEach((m) => m?.dispose?.()); Object.values(G).forEach((g) => g?.dispose?.()) }, [M, G])

  // ── listas derivadas ──
  const celdaPlace = useMemo(() => (c, o) => { o.position.set(c.x, (c.top - 2.4) / 2, c.z); o.scale.set(CELDA * 0.94, c.top + 2.4, CELDA * 0.94) }, [])
  const celdaColor = useMemo(() => (c) => _c.copy(pal[c.col]).multiplyScalar(0.9 + c.v * 0.22), [pal])
  const tramos = useMemo(() => {
    const out = []
    gen.calles.forEach((c) => {
      for (let k = 0; k < c.pts.length - 1; k++) {
        const a = c.pts[k]; const b = c.pts[k + 1]
        out.push({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, rot: Math.atan2(b.x - a.x, b.z - a.z), len: Math.hypot(b.x - a.x, b.z - a.z) })
      }
    })
    return out
  }, [gen])
  const tramoPlace = useMemo(() => (t, o) => { o.position.set(t.x, gen.topAt(t.x, t.z) + 0.05, t.z); o.rotation.y = t.rot; o.scale.set(1.9, 0.08, t.len + 0.25) }, [gen])
  const porTipo = useMemo(() => {
    const r = {}; BUILDING_TYPES.forEach((t) => { r[t] = [] }); gen.edificios.forEach((e) => r[e.tipo]?.push(e)); return r
  }, [gen])
  const edifPlace = useMemo(() => (e, o) => { o.position.set(e.x, e.y, e.z); o.rotation.y = e.rot; o.scale.set(e.w, e.h, e.w) }, [])
  const edifColor = useMemo(() => (e) => _c.set('#ffffff').lerp(pal[5], 0.18 + ((e.x * 7.3 + e.z * 3.1) % 1 + 1) % 1 * 0.2), [pal])
  const arboles = useMemo(() => gen.flora.filter((f) => f.tipo === 'arbol'), [gen])
  const rocas = useMemo(() => gen.flora.filter((f) => f.tipo === 'roca'), [gen])
  const luces = useMemo(() => gen.flora.filter((f) => f.tipo === 'luz'), [gen])
  const porModelo = useMemo(() => gen.perfil.modelos.map((n, i) => gen.flora.filter((f) => f.tipo === 'modelo' && f.m === i)), [gen])
  const troncoPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z); o.scale.setScalar(f.s * 1.3) }, [])
  const copaColor = useMemo(() => (f) => _c.copy(pal[[2, 4, 5, 0, 2][Math.floor(f.c * 5)]]).multiplyScalar(0.85 + f.s * 0.2), [pal])
  const rocaPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z); o.rotation.y = f.rot; o.scale.setScalar(f.s * 1.5) }, [])
  const rocaColor = useMemo(() => (f) => _c.copy(pal[1]).lerp(new THREE.Color('#9a9aa8'), 0.5).multiplyScalar(0.8 + f.c * 0.3), [pal])
  const luzPlace = useMemo(() => (f, o) => { o.position.set(f.x, f.y, f.z); o.scale.setScalar(f.s * 1.2) }, [])
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

  useEffect(() => {
    scene.fog = new THREE.FogExp2(new THREE.Color(biome.atmoBase).multiplyScalar(0.18), 0.0035)
    return () => { scene.fog = null }
  }, [scene, biome])

  // ── interfaz DOM: título, Salir, rótulo de puerto ──
  useEffect(() => {
    const bar = document.createElement('div')
    bar.style.cssText = 'position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:30;display:flex;gap:12px;align-items:center;padding:8px 14px;border-radius:14px;color:#fff;font:600 14px system-ui,sans-serif;pointer-events:auto;'
      + `background:${biome.groundLow}e6;border:1px solid ${biome.atmoRim};box-shadow:0 0 18px ${biome.atmoBase}99;`
    bar.innerHTML = `<span>${biome.emoji} ${node.name} · ${biome.title}</span>`
    const btn = document.createElement('button')
    btn.textContent = 'Salir (Esc)'
    btn.style.cssText = `cursor:pointer;border:1px solid ${biome.atmoRim};background:${biome.atmoBase}55;color:#fff;border-radius:8px;padding:4px 10px;font:inherit;`
    btn.onclick = () => onSalir()
    bar.appendChild(btn)
    const tip = document.createElement('div')
    tip.style.cssText = `position:fixed;bottom:22px;left:50%;transform:translateX(-50%);z-index:30;padding:6px 14px;border-radius:10px;color:#fff;background:#0a0c1ce6;border:1px solid ${biome.atmoRim};font:600 13px system-ui,sans-serif;pointer-events:none;opacity:0;transition:opacity .15s;`
    document.body.append(bar, tip)
    hoverEl.current = tip
    return () => { bar.remove(); tip.remove(); hoverEl.current = null }
  }, [biome, node, onSalir])

  const onHover = (p) => {
    hoverId.current = p ? p.id : -1
    const el = hoverEl.current
    if (!el) return
    el.style.opacity = p ? '1' : '0'
    if (p) el.textContent = `${p.kind === 'out' ? 'Salida' : 'Llegada'} ${p.n} · ${p.themeEmoji} ${p.themeName} · ${p.kind === 'out' ? 'lleva a' : 'viene de'} ${p.toName}`
  }

  useFrame(({ clock }, dt) => {
    if (!init.current) { // primer cuadro: pose diagonal (después de que Vistas guardó la cámara general)
      init.current = true
      camera.fov = 42; camera.near = 0.5; camera.far = 1500
      camera.position.set(0, 46, 64); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix()
    }
    const t = clock.elapsedTime
    M.lampA.color.setScalar(1.5 + Math.sin(t * 6.3) * 0.25 + Math.sin(t * 17) * 0.1).multiply(M.calido)
    M.lampB.color.setScalar(1.5 + Math.sin(t * 5.1 + 2) * 0.3 + Math.sin(t * 13 + 1) * 0.1).multiply(M.calido)
    M.flor.color.setScalar(1.7 + Math.sin(t * 2.4) * 0.35)
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
        _o.position.set(x, gen.topAt(x, z) + 0.3, z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix()
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
        const a = hsh * 6.283 + t * (0.12 + hsh * 0.1) * (hsh > 0.5 ? 1 : -1)
        const rr = gen.plazaR * (0.25 + ((b.id * 97) % 60) / 100)
        const x = Math.cos(a) * rr; const z = Math.sin(a) * rr
        _o.position.set(x, gen.topAt(x, z) + 0.32 + Math.abs(Math.sin(t * 4 + b.id)) * 0.12, z); _o.rotation.set(0, 0, 0); _o.scale.setScalar(1); _o.updateMatrix()
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

  return (
    <group>
      <Cielo biome={biome} />
      <hemisphereLight args={[biome.atmoRim, biome.groundMid, 0.95]} />
      <directionalLight position={[-30, 50, 25]} intensity={1.5} color={new THREE.Color('#ffe2c0').lerp(new THREE.Color(biome.atmoRim), 0.25)} />

      <mesh geometry={G.peana} material={M.peana} position={[0, -4.5, 0]} />
      <mesh geometry={G.borde} material={M.borde} position={[0, -2.35, 0]} />
      <mesh geometry={G.anillo} material={M.borde} position={[0, gen.topAt(0, 0) + 0.12, 0]} />
      <Inst geo={G.caja} mat={M.suelo} items={gen.celdas} place={celdaPlace} color={celdaColor} />
      <Inst geo={G.caja} mat={M.calle} items={tramos} place={tramoPlace} />

      {kit && BUILDING_TYPES.map((t) => (
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
        <group position={[0, gen.topAt(0, 0) - 0.1, 0]} scale={1.7}>
          <Monument node={nodoFalso} biome={biome} spot={spot} />
        </group>
      </Suspense>

      {gen.puertos.map((p) => (
        <Puerto key={p.id} p={p} y={gen.topAt(p.x, p.z) - 0.1} color={BIOMES[p.themeId]?.cityLight || biome.cityLight} onHover={onHover} arrows={arrows} />
      ))}

      <OrbitControls target={[0, 3, 0]} enablePan={false} enableDamping dampingFactor={0.08} minDistance={26} maxDistance={125} minPolarAngle={0.3} maxPolarAngle={1.32} autoRotate autoRotateSpeed={0.25} />
    </group>
  )
}
