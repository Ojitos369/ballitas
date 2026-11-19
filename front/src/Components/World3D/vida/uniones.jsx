// Señalización de uniones de rutas (fork/cross/merge) y puertos de nodo: pórticos con flechas
// por ruta, chevrons de color por ruta sobre el asfalto y balizas de suelo separadoras.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, markShared, mergePlainParts, vidaSharedMats } from './base.jsx'
import { buildUnionesData } from './colocacion.js'

// ═══════════════════════════ GEOMETRÍAS COMPARTIDAS ═══════════════════════════
function buildPillarGeo() {
  return mergePlainParts([
    new THREE.CylinderGeometry(0.24, 0.32, 0.16, 8).translate(0, 0.08, 0),
    new THREE.CylinderGeometry(0.1, 0.13, 3.4, 8).translate(0, 1.8, 0),
    new THREE.BoxGeometry(0.3, 0.16, 0.32).translate(0, 3.5, 0),
  ], 'uniones:pillar')
}

function buildBeamGeo() {
  return mergePlainParts([
    new THREE.BoxGeometry(1, 0.16, 0.24),
    new THREE.BoxGeometry(1, 0.06, 0.28).translate(0, -0.07, 0),
  ], 'uniones:beam')
}

function buildRouteArrowGeo() {
  return mergePlainParts([
    new THREE.BoxGeometry(0.14, 0.09, 0.42).translate(0, 0, -0.06),
    new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 0.48, 1).translate(0, 0, 0.26),
  ], 'uniones:routeArrow')
}

function buildGroundChevronGeo() {
  return mergePlainParts([
    new THREE.BoxGeometry(0.13, 0.026, 0.54).rotateY(0.56).translate(-0.14, 0.013, 0),
    new THREE.BoxGeometry(0.13, 0.026, 0.54).rotateY(-0.56).translate(0.14, 0.013, 0),
  ], 'uniones:groundChevron')
}

function buildDividerBodyGeo() {
  return mergePlainParts([
    new THREE.CylinderGeometry(0.26, 0.34, 0.16, 6).translate(0, 0.08, 0),
    new THREE.CylinderGeometry(0.14, 0.22, 0.72, 6).translate(0, 0.5, 0),
    new THREE.BoxGeometry(0.14, 0.18, 0.54).translate(0, 0.24, 0),
  ], 'uniones:dividerBody')
}

function buildDividerGlowGeo() {
  return mergePlainParts([
    new THREE.OctahedronGeometry(0.22, 0).scale(0.75, 1.35, 1.15).translate(0, 1.05, 0),
    new THREE.BoxGeometry(0.18, 0.08, 0.56).translate(0, 0.34, 0),
  ], 'uniones:dividerGlow')
}

function buildPortBeaconBodyGeo() {
  return mergePlainParts([
    new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8).translate(0, 0.06, 0),
    new THREE.CylinderGeometry(0.06, 0.09, 0.85, 8).translate(0, 0.52, 0),
  ], 'uniones:portBody')
}

function buildPortBeaconGlowGeo() {
  return mergePlainParts([
    new THREE.TorusGeometry(0.22, 0.045, 5, 12).translate(0, 1.05, 0),
    new THREE.OctahedronGeometry(0.12, 0).translate(0, 1.05, 0),
  ], 'uniones:portGlow')
}

const G = {
  pillar: buildPillarGeo(),
  beam: buildBeamGeo(),
  beamTrim: markShared(new THREE.BoxGeometry(1, 0.075, 0.34)),
  routeArrow: buildRouteArrowGeo(),
  groundChevron: buildGroundChevronGeo(),
  dividerBody: buildDividerBodyGeo(),
  dividerGlow: buildDividerGlowGeo(),
  portBody: buildPortBeaconBodyGeo(),
  portGlow: buildPortBeaconGlowGeo(),
}

// ═══════════════════════════ MATERIALES COMPARTIDOS ═══════════════════════════
const { body: BODY_MAT, glow: GLOW_MAT, decal: DECAL_MAT } = vidaSharedMats()

export default function Uniones({ way, detail }) {
  const data = useMemo(() => buildUnionesData(way), [way])
  const solidRef = useRef()

  useFrame(() => {
    if (solidRef.current && detail) solidRef.current.visible = detail.value >= 0.3
  })

  return (
    <group>
      {/* Capa emisiva: siempre visible incluso a detalle bajo (detail.value < 0.3) */}
      <Instanced geo={G.beamTrim} mat={GLOW_MAT} items={data.beamTrims} />
      <Instanced geo={G.routeArrow} mat={GLOW_MAT} items={data.routeArrows} />
      <Instanced geo={G.groundChevron} mat={DECAL_MAT} items={data.groundChevrons} />
      <Instanced geo={G.dividerGlow} mat={GLOW_MAT} items={data.dividerGlows} />
      <Instanced geo={G.portGlow} mat={GLOW_MAT} items={data.portGlows} />

      {/* Capa sólida: oculta cuando detail.value < 0.3 */}
      <group ref={solidRef}>
        <Instanced geo={G.pillar} mat={BODY_MAT} items={data.pillars} />
        <Instanced geo={G.beam} mat={BODY_MAT} items={data.beams} />
        <Instanced geo={G.dividerBody} mat={BODY_MAT} items={data.dividerBodies} />
        <Instanced geo={G.portBody} mat={BODY_MAT} items={data.portBodies} />
      </group>
    </group>
  )
}
