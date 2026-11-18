// Señalización de uniones de rutas (fork/cross/merge) y puertos de nodo: pórticos con flechas
// por ruta, chevrons de color por ruta sobre el asfalto y balizas de suelo separadoras.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, bermaAjusta, markShared, mergeColoredParts, vidaSharedMats } from './base.jsx'
import { basisQuat } from './dyn.js'
import { CURB, TERR, halfWidth, lanesOf, pal, surfFrame } from './pista.jsx'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'

const ROUTE_BASE = ['#38e8ff', '#ff5c8a', '#ffd24a']
function routeGlowColor(themeMec, rIdx) {
  const c = new THREE.Color(ROUTE_BASE[rIdx % ROUTE_BASE.length])
  c.lerp(new THREE.Color(themeMec), 0.25)
  return c.multiplyScalar(1.4)
}

// ═══════════════════════════ GEOMETRÍAS COMPARTIDAS ═══════════════════════════
function buildPillarGeo() {
  return mergeColoredParts([
    [new THREE.CylinderGeometry(0.24, 0.32, 0.16, 8).translate(0, 0.08, 0), '#1f242e'],
    [new THREE.CylinderGeometry(0.11, 0.14, 2.5, 8).translate(0, 1.35, 0), '#3b4354'],
    [new THREE.BoxGeometry(0.32, 0.18, 0.34).translate(0, 2.6, 0), '#242a36'],
  ], 'uniones:pillar')
}

function buildBeamGeo() {
  return mergeColoredParts([
    [new THREE.BoxGeometry(1, 0.22, 0.28), '#232936'],
    [new THREE.BoxGeometry(1, 0.08, 0.32).translate(0, -0.1, 0), '#3d4659'],
  ], 'uniones:beam')
}

function buildRouteArrowGeo() {
  return mergeColoredParts([
    [new THREE.BoxGeometry(0.14, 0.09, 0.42).translate(0, 0, -0.06), '#ffffff'],
    [new THREE.ConeGeometry(0.22, 0.32, 4).rotateY(Math.PI / 4).rotateX(Math.PI / 2).scale(1, 0.48, 1).translate(0, 0, 0.26), '#ffffff'],
  ], 'uniones:routeArrow')
}

function buildGroundChevronGeo() {
  return mergeColoredParts([
    [new THREE.BoxGeometry(0.13, 0.026, 0.54).rotateY(0.56).translate(-0.14, 0.013, 0), '#ffffff'],
    [new THREE.BoxGeometry(0.13, 0.026, 0.54).rotateY(-0.56).translate(0.14, 0.013, 0), '#ffffff'],
  ], 'uniones:groundChevron')
}

function buildDividerBodyGeo() {
  return mergeColoredParts([
    [new THREE.CylinderGeometry(0.26, 0.34, 0.16, 6).translate(0, 0.08, 0), '#202630'],
    [new THREE.CylinderGeometry(0.14, 0.22, 0.72, 6).translate(0, 0.5, 0), '#f2b738'],
    [new THREE.BoxGeometry(0.14, 0.18, 0.54).translate(0, 0.24, 0), '#202630'],
  ], 'uniones:dividerBody')
}

function buildDividerGlowGeo() {
  return mergeColoredParts([
    [new THREE.OctahedronGeometry(0.22, 0).scale(0.75, 1.35, 1.15).translate(0, 1.05, 0), '#ffffff'],
    [new THREE.BoxGeometry(0.18, 0.08, 0.56).translate(0, 0.34, 0), '#ffffff'],
  ], 'uniones:dividerGlow')
}

function buildPortBeaconBodyGeo() {
  return mergeColoredParts([
    [new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8).translate(0, 0.06, 0), '#1f242e'],
    [new THREE.CylinderGeometry(0.06, 0.09, 0.85, 8).translate(0, 0.52, 0), '#3a4354'],
  ], 'uniones:portBody')
}

function buildPortBeaconGlowGeo() {
  return mergeColoredParts([
    [new THREE.TorusGeometry(0.22, 0.045, 5, 12).translate(0, 1.05, 0), '#ffffff'],
    [new THREE.OctahedronGeometry(0.12, 0).translate(0, 1.05, 0), '#ffffff'],
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

// ═══════════════════════════ CONSTRUCCIÓN POR CAMINO ═══════════════════════════
const _m = new THREE.Matrix4(); const _x = new THREE.Vector3(); const _y = new THREE.Vector3(); const _z = new THREE.Vector3()
function spanQuat(spanDir, upDir) {
  _x.copy(spanDir).normalize()
  _y.copy(upDir).addScaledVector(_x, -upDir.dot(_x)).normalize()
  _z.crossVectors(_x, _y).normalize()
  return new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(_x, _y, _z))
}

const unionesCache = new WeakMap()
function buildUnionesData(way) {
  if (unionesCache.has(way)) return unionesCache.get(way)
  const pillars = []; const beams = []; const beamTrims = []; const routeArrows = []
  const groundChevrons = []; const dividerBodies = []; const dividerGlows = []
  const portBodies = []; const portGlows = []

  const world = mundoDe(way); const local = nuevoLocal()
  const P = pal(way.theme.id)
  const mecCol = new THREE.Color(P.mec).multiplyScalar(1.35)
  const outCol = new THREE.Color('#52ff9b').lerp(new THREE.Color(P.mec), 0.25).multiplyScalar(1.4)
  const inCol = new THREE.Color(P.chev).multiplyScalar(1.4)
  const f = {}

  const launch = way.segments?.find((s) => s.kind === 'salida') ?? way.segments?.[0]
  const landing = way.segments?.find((s) => s.kind === 'llegada')
  const rCount = way.routes?.length ?? 0
  const rCols = Array.from({ length: Math.max(1, rCount) }, (_, r) => routeGlowColor(P.mec, r))

  // Helper para colocar un pórtico en un marco dado y añadir sus flechas o señales de unión
  const placeArch = (fHub, kind, outSegs, seedBase) => {
    const lane0 = lanesOf(launch ?? way.segments[0])[0]
    const E = halfWidth(lane0) + CURB
    const halfSpan = E + TERR * 0.58
    const hubPos = fHub.pos.clone(); const hubUp = fHub.up.clone()
    const hubTan = fHub.tangent.clone(); const hubSide = fHub.side.clone()
    const archQuat = basisQuat(hubUp, hubTan)

    const pL = colocar(world, {
      pos: hubPos.clone().addScaledVector(hubSide, -halfSpan),
      seed: seedBase + 11,
      ajusta: bermaAjusta(hubPos, hubSide, hubUp, E, TERR, 0.35),
    }, 0.35, { way: way.idx }, 4, local)
    const pR = colocar(world, {
      pos: hubPos.clone().addScaledVector(hubSide, halfSpan),
      seed: seedBase + 23,
      ajusta: bermaAjusta(hubPos, hubSide, hubUp, E, TERR, 0.35),
    }, 0.35, { way: way.idx }, 4, local)

    if (pL) pillars.push({ pos: pL, quat: archQuat, scale: 1 })
    if (pR) pillars.push({ pos: pR, quat: archQuat, scale: 1 })

    let beamMid; let beamSpan; let beamQuat; let sideDir
    if (pL && pR) {
      const topL = pL.clone().addScaledVector(hubUp, 2.55)
      const topR = pR.clone().addScaledVector(hubUp, 2.55)
      const span = topR.clone().sub(topL)
      beamSpan = span.length() + 0.36
      beamMid = topL.lerp(topR, 0.5)
      sideDir = span.normalize()
      beamQuat = spanQuat(sideDir, hubUp)
    } else if (pL || pR) {
      const anchor = pL ?? pR
      const sign = pL ? 1 : -1
      beamSpan = halfSpan * 2
      beamMid = anchor.clone().addScaledVector(hubUp, 2.55).addScaledVector(hubSide, sign * halfSpan * 0.85)
      sideDir = hubSide.clone()
      beamQuat = spanQuat(sideDir, hubUp)
    }

    const sorted = (kind === 'fork' || kind === 'cross') && outSegs.length
      ? outSegs.map((sOut) => {
          const uAhead = Math.min(0.4, 14 / Math.max(sOut.length, 1))
          const pAhead = surfFrame(sOut, 0, uAhead, {}).pos
          return { sOut, lat: pAhead.clone().sub(hubPos).dot(hubSide), r: Math.max(0, sOut.route) }
        }).sort((a, b) => a.lat - b.lat)
      : null

    if (beamMid) {
      beams.push({ pos: beamMid, quat: beamQuat, scale: [beamSpan, 1, 1] })
      beamTrims.push({
        pos: beamMid.clone().addScaledVector(hubUp, 0.14),
        quat: beamQuat, scale: [beamSpan * 0.96, 1, 1],
        color: kind === 'merge' ? inCol : mecCol,
      })

      if (sorted) {
        const step = Math.min(0.95, (beamSpan * 0.72) / Math.max(1, sorted.length))
        for (let k = 0; k < sorted.length; k++) {
          const { lat, r } = sorted[k]
          const offset = (k - (sorted.length - 1) / 2) * step
          const aPos = beamMid.clone().addScaledVector(sideDir, offset).addScaledVector(hubUp, 0.34).addScaledVector(hubTan, -0.06)
          const latWeight = THREE.MathUtils.clamp(lat * 0.15, -0.78, 0.78)
          const aDir = hubTan.clone().multiplyScalar(0.75).addScaledVector(hubSide, latWeight).addScaledVector(hubUp, 0.18).normalize()
          routeArrows.push({ pos: aPos, quat: basisQuat(hubUp, aDir), scale: 1.15, color: rCols[r] ?? mecCol })
        }
      } else if (kind === 'merge') {
        // En merge: flecha central de convergencia hacia la recta de meta
        const aPos = beamMid.clone().addScaledVector(hubUp, 0.34)
        routeArrows.push({ pos: aPos, quat: basisQuat(hubUp, hubTan), scale: 1.3, color: inCol })
      }
    }

    // Marcas en el suelo y balizas separadoras para bifurcaciones (fork y cross)
    if (sorted && sorted.length > 1) {
      // Chevrons del color de cada ruta sobre los primeros metros al salir de la unión
      for (const { sOut, r } of sorted) {
        if (sOut.air) continue
        const col = rCols[r] ?? mecCol
        for (const d of [5.5, 11]) {
          if (d >= sOut.length * 0.85) continue
          const fr = surfFrame(sOut, 0, d / sOut.length, f)
          groundChevrons.push({
            pos: fr.pos.clone().addScaledVector(fr.up, 0.032),
            quat: basisQuat(fr.up, fr.tangent),
            scale: [1.05, 1, 1.05],
            color: col,
          })
        }
      }

      // Baliza de suelo en la V que separa cada par de rutas adyacentes al divergir
      const minGap = 2 * (E + TERR) + 0.5
      for (let k = 0; k < sorted.length - 1; k++) {
        const sA = sorted[k].sOut; const sB = sorted[k + 1].sOut
        let placedFirst = false
        for (const d of [8, 10, 12, 14, 16, 18, 20, 22, 24]) {
          const fA = surfFrame(sA, 0, Math.min(0.46, d / Math.max(sA.length, 1)), {})
          const fB = surfFrame(sB, 0, Math.min(0.46, d / Math.max(sB.length, 1)), {})
          if (fA.pos.distanceTo(fB.pos) < minGap) continue
          const mid = fA.pos.clone().lerp(fB.pos, 0.5)
          const up = fA.up.clone().add(fB.up).normalize()
          const tan = fA.tangent.clone().add(fB.tangent).normalize()
          const divPos = colocar(world, { pos: mid, seed: seedBase + k * 71 + d * 13 }, 0.34, null, 4, local)
          if (!divPos) continue
          const divQuat = basisQuat(up, tan)
          const sc = placedFirst ? 0.72 : 1.0
          dividerBodies.push({ pos: divPos, quat: divQuat, scale: sc })
          dividerGlows.push({ pos: divPos, quat: divQuat, scale: sc, color: mecCol })
          if (placedFirst) break
          placedFirst = true
        }
      }
    }
    return sorted
  }

  const pushPreArrows = (inSeg, fHub, sorted) => {
    if (!inSeg || inSeg.air || !sorted?.length) return
    const H = halfWidth(lanesOf(inSeg)[0])
    for (const d of [9, 5]) {
      if (d >= inSeg.length * 0.8) continue
      const fr = surfFrame(inSeg, 0, 1 - d / inSeg.length, f)
      for (let k = 0; k < sorted.length; k++) {
        const off = (k - (sorted.length - 1) / 2) * Math.min(0.38, (H * 1.3) / Math.max(1, sorted.length))
        const dir = fr.tangent.clone().multiplyScalar(0.85).addScaledVector(fr.side, THREE.MathUtils.clamp(sorted[k].lat * 0.08, -0.5, 0.5)).normalize()
        groundChevrons.push({
          pos: fr.pos.clone().addScaledVector(fr.up, 0.032).addScaledVector(fr.side, off),
          quat: basisQuat(fr.up, dir),
          scale: [0.62, 1, 0.62],
          color: rCols[sorted[k].r] ?? mecCol,
        })
      }
    }
  }

  // 1) Unión FORK (salida -> rutas primera mitad)
  if (launch && launch.next?.length) {
    const fFork = surfFrame(launch, 0, 1, {})
    const outFork = launch.next.map((i) => way.segments[i]).filter(Boolean)
    const sorted = placeArch(fFork, 'fork', outFork, way.idx * 1009 + 1)
    pushPreArrows(launch, fFork, sorted)
  }

  // 2) Unión CROSS (primera mitad -> segunda mitad de rutas)
  const crossTail = way.routes?.[0]?.segments?.[3]
  if (crossTail && crossTail.next?.length) {
    const fCross = surfFrame(crossTail, 0, 1, {})
    const outCross = crossTail.next.map((i) => way.segments[i]).filter(Boolean)
    const sorted = placeArch(fCross, 'cross', outCross, way.idx * 1009 + 200)
    for (const rt of way.routes ?? []) pushPreArrows(rt.segments?.[3], fCross, sorted)
  }

  // 3) Unión MERGE (segunda mitad de rutas -> llegada)
  if (landing) {
    const fMerge = surfFrame(landing, 0, 0, {})
    placeArch(fMerge, 'merge', [landing], way.idx * 1009 + 400)
  }

  // 4) Puertos de nodo (salida y llegada): marcas de entrada/salida y balizas de berma
  if (launch && !launch.air) {
    const L = Math.max(launch.length, 1)
    const H = halfWidth(lanesOf(launch)[0]); const E = H + CURB
    for (const s of [1.2, 6.8]) {
      if (s >= L * 0.85) continue
      const fr = surfFrame(launch, 0, s / L, f)
      groundChevrons.push({
        pos: fr.pos.clone().addScaledVector(fr.up, 0.032),
        quat: basisQuat(fr.up, fr.tangent),
        scale: [1.1, 1, 1.1],
        color: outCol,
      })
    }
    if (L > 8) {
      const fr = surfFrame(launch, 0, 6.8 / L, {})
      for (const side of [-1, 1]) {
        const want = fr.pos.clone().addScaledVector(fr.side, side * (E + TERR * 0.45))
        const pos = colocar(world, { pos: want, seed: way.idx * 313 + (side > 0 ? 7 : 19), ajusta: bermaAjusta(fr.pos, fr.side, fr.up, E, TERR, 0.3) }, 0.3, { way: way.idx, si: launch.i, lane: 0 }, 4, local)
        if (pos) {
          const q = basisQuat(fr.up, fr.tangent)
          portBodies.push({ pos, quat: q, scale: 1 })
          portGlows.push({ pos, quat: q, scale: 1, color: outCol })
        }
      }
    }
  }

  if (landing && !landing.air) {
    const L = Math.max(landing.length, 1)
    const H = halfWidth(lanesOf(landing)[0]); const E = H + CURB
    for (const s of [L - 6.8, L - 1.2]) {
      if (s <= L * 0.15) continue
      const fr = surfFrame(landing, 0, s / L, f)
      groundChevrons.push({
        pos: fr.pos.clone().addScaledVector(fr.up, 0.032),
        quat: basisQuat(fr.up, fr.tangent),
        scale: [1.1, 1, 1.1],
        color: inCol,
      })
    }
    if (L > 8) {
      const fr = surfFrame(landing, 0, (L - 6.8) / L, {})
      for (const side of [-1, 1]) {
        const want = fr.pos.clone().addScaledVector(fr.side, side * (E + TERR * 0.45))
        const pos = colocar(world, { pos: want, seed: way.idx * 419 + (side > 0 ? 11 : 29), ajusta: bermaAjusta(fr.pos, fr.side, fr.up, E, TERR, 0.3) }, 0.3, { way: way.idx, si: landing.i, lane: 0 }, 4, local)
        if (pos) {
          const q = basisQuat(fr.up, fr.tangent)
          portBodies.push({ pos, quat: q, scale: 1 })
          portGlows.push({ pos, quat: q, scale: 1, color: inCol })
        }
      }
    }
  }

  const out = { pillars, beams, beamTrims, routeArrows, groundChevrons, dividerBodies, dividerGlows, portBodies, portGlows }
  unionesCache.set(way, out)
  return out
}

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
