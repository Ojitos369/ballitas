// Piezas de pista estilo kart por camino: arcos de salida/meta con líneas a cuadros,
// túnel de arcos en tramo recto, pianos (bordillos) en curvas cerradas y barreras en el borde exterior.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, getWayBoundingSphere, getWayDetail, markShared } from './base.jsx'
import { buildKartPistaData } from './colocacion.js'
import { useKit, precargarKit } from '../Modelos.jsx'
import { TRACK_K } from '../../../Core/world.js'

const BASE_TEX = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/') + 'tex/'
const WAY_KART_RANGE = 620 * TRACK_K

export const KART_KIT_PIECES = ['arco_salida', 'tunel_arco_lod', 'bordillo_lod', 'barrera_lod']

// Geometría plana 1×1 en XZ (base y=0) con UV recortado al cuadrado interior [0.15..0.85] de las texturas .webp.
function buildLineDecalGeo() {
  const g = new THREE.PlaneGeometry(1, 1)
  g.rotateX(-Math.PI / 2)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, 0.15 + uv.getX(i) * 0.7, 0.85 - uv.getY(i) * 0.7)
  }
  g.name = 'kart:lineDecal'
  return markShared(g)
}
const LINE_DECAL_GEO = buildLineDecalGeo()

const lineMatCache = new Map()
function lineDecalMat(file) {
  if (lineMatCache.has(file)) return lineMatCache.get(file)
  const tex = new THREE.TextureLoader().load(BASE_TEX + file)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  markShared(tex)
  const m = new THREE.MeshLambertMaterial({
    map: tex,
    color: '#ffffff',
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  })
  markShared(m)
  lineMatCache.set(file, m)
  return m
}

function KitInstanced({ nombre, items, receiveShadow = false }) {
  const lodName = ['tunel_arco', 'bordillo', 'barrera'].includes(nombre) ? `${nombre}_lod` : nombre
  const kit = useKit(lodName)
  if (!kit || !items.length) return null
  return <Instanced geo={kit.geometry} mat={kit.material} items={items} receiveShadow={receiveShadow} />
}

export default function KartPista({ way }) {
  useEffect(() => { precargarKit(KART_KIT_PIECES) }, [])
  const data = useMemo(() => buildKartPistaData(way), [way])
  const startMat = useMemo(() => lineDecalMat('carrera_salida.webp'), [])
  const finishMat = useMemo(() => lineDecalMat('carrera_meta.webp'), [])
  const detail = getWayDetail(way)
  const camera = useThree((s) => s.camera)
  const solidRef = useRef()
  const wayBounds = useMemo(() => {
    const radius = Math.max(5, ...(way.segments ?? []).map((s) => s.radius ?? 0))
    return getWayBoundingSphere(way, radius)
  }, [way])

  useFrame(() => {
    if (!solidRef.current) return
    const distant = wayBounds && camera.position.distanceTo(wayBounds.center) - wayBounds.radius > WAY_KART_RANGE
    solidRef.current.visible = !distant && (!detail || detail.value >= 0.3)
  })

  return (
    <group ref={solidRef}>
      <Instanced geo={LINE_DECAL_GEO} mat={startMat} items={data.startLines} />
      <Instanced geo={LINE_DECAL_GEO} mat={finishMat} items={data.finishLines} />
      <KitInstanced nombre="arco_salida" items={data.arcos} />
      <KitInstanced nombre="tunel_arco" items={data.tuneles} />
      <KitInstanced nombre="bordillo" items={data.bordillos} receiveShadow />
      <KitInstanced nombre="barrera" items={data.barreras} receiveShadow />
    </group>
  )
}
