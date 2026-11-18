import * as THREE from 'three'
import { NODE_R, BALL_R, mulberry32 } from '../../../Core/world.js'

const U = BALL_R * 2
const R_SCALE = NODE_R / 7.5
const CITY_U = U * Math.pow(R_SCALE, 0.3)
const ROAD_W = Math.max(U * 2.0, NODE_R * 0.145)
const ROAD_H = Math.max(0.085, NODE_R * 0.011)

// Geometrías suaves compartidas en caché de módulo para vida urbana del planeta
export const trafficGeo = new THREE.SphereGeometry(0.11, 8, 6).scale(0.85, 0.55, 1.85)
export const vehicleGeo = new THREE.CapsuleGeometry(0.085, 0.22, 4, 8).rotateX(Math.PI / 2).scale(1.1, 0.72, 1.2)
export const creatureGeo = new THREE.SphereGeometry(0.13, 8, 6).scale(1.85, 0.34, 0.92)
export const vaporGeo = new THREE.SphereGeometry(0.18, 12, 8)
export const windowZoneGeo = new THREE.BoxGeometry(1, 0.048, 1)

// Scratch objects a nivel de módulo (cero asignaciones por cuadro)
const _m = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _side = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _x = new THREE.Vector3()
const _s = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _cOn = new THREE.Color()
const _cAlt = new THREE.Color()
const _cOff = new THREE.Color('#0c1020')

/**
 * Precalcula tráfico por avenidas, vehículos urbanos, criaturas en órbita baja,
 * vapor y zonas de ventanas que se encienden por sector, todo escalado a partir de NODE_R.
 */
export function buildPlanetLifeData(node, biome, monumentSpot, city = null) {
  const rng = mulberry32(8800 + node.idx * 211)
  const localRoads = (node.roads || [])
    .filter((r) => r.points && r.points.length >= 2)
    .map((r) => r.points.map((p) => p.clone().sub(node.pos)))

  // Añade el bulevar circular del centro como ruta extra de tráfico
  const centroDir = city?.districts?.centroDir || monumentSpot?.dir
  if (centroDir) {
    const cDir = centroDir.clone().normalize()
    const ref = Math.abs(cDir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : _up
    const bu = new THREE.Vector3().crossVectors(ref, cDir).normalize()
    const bv = new THREE.Vector3().crossVectors(cDir, bu).normalize()
    const ringAng = 0.33
    const sinA = Math.sin(ringAng)
    const cosA = Math.cos(ringAng)
    const ringPts = []
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2
      ringPts.push(
        cDir.clone().multiplyScalar(cosA)
          .addScaledVector(bu, Math.cos(a) * sinA)
          .addScaledVector(bv, Math.sin(a) * sinA)
          .multiplyScalar(NODE_R),
      )
    }
    localRoads.push(ringPts)
  }

  // Tráfico de luces por avenidas (dos sentidos, escala con NODE_R)
  const traffic = []
  const lifeScale = Math.pow(R_SCALE, 0.28)
  const headCol = new THREE.Color('#fff4d2')
  const tailCol = new THREE.Color(biome.cityLight || '#ff7a7a')
  const accentCol = new THREE.Color(biome.emissiveColor || biome.cityLight || '#88e8ff')
  if (localRoads.length > 0) {
    const count = Math.min(180, Math.round(Math.max(24, localRoads.length * 2.6 * Math.pow(R_SCALE, 0.85))))
    for (let i = 0; i < count; i++) {
      const road = localRoads[i % localRoads.length]
      const dirSign = rng() < 0.5 ? 1 : -1
      const c = rng() < 0.45 ? headCol : (rng() < 0.6 ? tailCol : accentCol)
      traffic.push({
        road,
        speed: (0.11 + rng() * 0.19) * dirSign / Math.pow(R_SCALE, 0.35),
        phase: rng(),
        lane: dirSign * ROAD_W * (0.20 + rng() * 0.08),
        scale: lifeScale * (0.85 + rng() * 0.45),
        height: NODE_R + ROAD_H + 0.08 * lifeScale,
        color: c,
      })
    }
  }

  // Pequeños vehículos / lanzaderas volando entre distritos
  const vehicles = []
  const vehicleCount = Math.min(48, Math.round(16 * Math.pow(R_SCALE, 0.75)))
  for (let i = 0; i < vehicleCount; i++) {
    const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
    const start = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).cross(axis).normalize()
    if (start.lengthSq() < 0.01) start.set(1, 0, 0)
    vehicles.push({
      axis,
      start,
      radius: NODE_R + CITY_U * (1.25 + rng() * 1.45),
      speed: (0.18 + rng() * 0.22) * (rng() < 0.5 ? 1 : -1) / Math.pow(R_SCALE, 0.3),
      phase: rng() * Math.PI * 2,
      bobAmp: 0.08 * lifeScale,
      scale: lifeScale * (0.85 + rng() * 0.45),
    })
  }

  // Criaturas en órbita baja
  const creatures = []
  const creatureCount = Math.min(36, Math.round(12 * Math.pow(R_SCALE, 0.65)))
  for (let i = 0; i < creatureCount; i++) {
    const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
    const start = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5)
      .cross(axis)
      .normalize()
    if (start.lengthSq() < 0.01) start.set(1, 0, 0)
    creatures.push({
      axis,
      start,
      radius: NODE_R + CITY_U * (1.6 + rng() * 2.1),
      speed: (0.20 + rng() * 0.24) * (rng() < 0.5 ? 1 : -1) / Math.pow(R_SCALE, 0.25),
      phase: rng() * Math.PI * 2,
      bobAmp: (0.12 + rng() * 0.16) * lifeScale,
      scale: (0.7 + rng() * 0.55) * lifeScale,
    })
  }

  // Vapor / humo suave en el monumento
  const vapor = []
  const vaporCount = biome.id === 'volcan' || biome.id === 'nubes' || biome.id === 'mar' || biome.id === 'bosque' ? 14 : 9
  const baseDir = monumentSpot?.dir || new THREE.Vector3(0, 1, 0)
  const basePos = monumentSpot?.pos || baseDir.clone().multiplyScalar(NODE_R)
  const u = new THREE.Vector3().crossVectors(Math.abs(baseDir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : _up, baseDir).normalize()
  const v = new THREE.Vector3().crossVectors(baseDir, u).normalize()
  const vapScale = Math.pow(R_SCALE, 0.42)
  for (let i = 0; i < vaporCount; i++) {
    vapor.push({
      basePos,
      baseDir,
      u,
      v,
      phase: i / vaporCount,
      speed: 0.22 + rng() * 0.14,
      spread: (0.35 + rng() * 0.45) * vapScale,
      ang: rng() * Math.PI * 2,
      height: (1.8 + rng() * 1.6) * vapScale,
      scale: vapScale,
    })
  }

  // Ventanas por zonas que se encienden/apagan suavemente en el buffer de color
  const windowZones = []
  if (city?.byType) {
    const candidates = [
      ...(city.byType.rascacielos || []),
      ...(city.byType.comercio || []),
      ...(city.byType.estacion || []),
      ...(city.byType.casa || []),
    ]
    const maxWins = Math.min(280, Math.round(110 * Math.pow(R_SCALE, 1.15)))
    const step = Math.max(1, Math.floor(candidates.length / Math.max(1, maxWins)))
    const bx = new THREE.Vector3()
    const by = new THREE.Vector3()
    const bz = new THREE.Vector3()
    const bpos = new THREE.Vector3()
    for (let i = 0; i < candidates.length && windowZones.length < maxWins; i += step) {
      const it = candidates[i]
      it.m.extractBasis(bx, by, bz)
      bpos.setFromMatrixPosition(it.m)
      // Banda luminosa ajustada al contorno real de cada tipo de edificio GLB
      const upper = it.type === 'rascacielos' && rng() < 0.45
      const bandFrac = it.type === 'rascacielos' ? (upper ? 0.64 : 0.34) : it.type === 'comercio' ? 0.36 : 0.34
      const xzFit = it.type === 'rascacielos' ? (upper ? 0.59 : 0.77) : it.type === 'comercio' ? 0.90 : it.type === 'estacion' ? 0.84 : 0.81
      const bandPos = bpos.clone().addScaledVector(by, bandFrac)
      const bandM = new THREE.Matrix4().makeBasis(
        bx.clone().multiplyScalar(xzFit),
        by.clone().multiplyScalar(it.type === 'rascacielos' ? 0.65 : 0.85),
        bz.clone().multiplyScalar(xzFit),
      ).setPosition(bandPos)
      const lon = Math.atan2(bpos.z, bpos.x)
      const lat = Math.asin(THREE.MathUtils.clamp(bpos.y / Math.max(1, bpos.length()), -1, 1))
      const zoneBias = it.kind === 'centro' ? 0.45 : it.kind === 'puerto' ? 0.25 : 0.0
      windowZones.push({
        m: bandM,
        zonePhase: lon + lat * 0.65 + (it.kind === 'puerto' ? 1.2 : 0),
        zoneBias,
        warm: rng() < 0.65,
        flickerPhase: rng() * Math.PI * 2,
      })
    }
  }

  return { traffic, vehicles, creatures, vapor, windowZones }
}

/**
 * Inicializa colores estáticos iniciales de tráfico (faros delanteros/traseros) una sola vez.
 */
export function initTrafficColors(life, trafficMesh) {
  if (!trafficMesh || !life.traffic.length) return
  for (let i = 0; i < life.traffic.length; i++) {
    trafficMesh.setColorAt(i, life.traffic[i].color)
  }
  if (trafficMesh.instanceColor) trafficMesh.instanceColor.needsUpdate = true
}

/**
 * Actualiza toda la vida urbana en un solo paso por cuadro (solo escribe buffers: matrices y colores).
 */
export function updatePlanetLife(life, t, biome, refs) {
  const { trafficMesh, vehiclesMesh, creaturesMesh, vaporMesh, windowsMesh } = refs

  if (trafficMesh && life.traffic.length) {
    for (let i = 0; i < life.traffic.length; i++) {
      const tr = life.traffic[i]
      const pts = tr.road
      const n = pts.length - 1
      let u = (tr.phase + t * tr.speed) % 1
      if (u < 0) u += 1
      const f = u * n
      const idx = Math.min(n - 1, Math.floor(f))
      const frac = f - idx
      _pos.lerpVectors(pts[idx], pts[idx + 1], frac)
      _dir.copy(_pos).normalize()
      _tan.subVectors(pts[idx + 1], pts[idx])
      if (_tan.lengthSq() < 1e-8) _tan.set(1, 0, 0)
      else _tan.normalize()
      if (tr.speed < 0) _tan.negate()
      _side.crossVectors(_dir, _tan).normalize()
      _pos.copy(_dir).multiplyScalar(tr.height).addScaledVector(_side, tr.lane)
      _s.set(tr.scale, tr.scale, tr.scale)
      _m.makeBasis(_side, _dir, _tan).scale(_s).setPosition(_pos)
      trafficMesh.setMatrixAt(i, _m)
    }
    trafficMesh.instanceMatrix.needsUpdate = true
  }

  if (vehiclesMesh && life.vehicles.length) {
    for (let i = 0; i < life.vehicles.length; i++) {
      const vh = life.vehicles[i]
      const ang = vh.phase + t * vh.speed
      _q.setFromAxisAngle(vh.axis, ang)
      _dir.copy(vh.start).applyQuaternion(_q).normalize()
      const r = vh.radius + Math.sin(t * 1.9 + vh.phase) * vh.bobAmp
      _pos.copy(_dir).multiplyScalar(r)
      _tan.crossVectors(vh.axis, _dir).normalize()
      if (vh.speed < 0) _tan.negate()
      _x.crossVectors(_dir, _tan).normalize()
      _s.set(vh.scale, vh.scale, vh.scale)
      _m.makeBasis(_x, _dir, _tan).scale(_s).setPosition(_pos)
      vehiclesMesh.setMatrixAt(i, _m)
    }
    vehiclesMesh.instanceMatrix.needsUpdate = true
  }

  if (creaturesMesh && life.creatures.length) {
    for (let i = 0; i < life.creatures.length; i++) {
      const cr = life.creatures[i]
      const ang = cr.phase + t * cr.speed
      _q.setFromAxisAngle(cr.axis, ang)
      _dir.copy(cr.start).applyQuaternion(_q).normalize()
      const r = cr.radius + Math.sin(t * 2.4 + cr.phase) * cr.bobAmp
      _pos.copy(_dir).multiplyScalar(r)
      _tan.crossVectors(cr.axis, _dir).normalize()
      if (cr.speed < 0) _tan.negate()
      _x.crossVectors(_dir, _tan).normalize()
      const flap = cr.scale * (0.85 + Math.sin(t * 9 + cr.phase) * 0.25)
      _s.set(flap, cr.scale, cr.scale)
      _m.makeBasis(_x, _dir, _tan).scale(_s).setPosition(_pos)
      creaturesMesh.setMatrixAt(i, _m)
    }
    creaturesMesh.instanceMatrix.needsUpdate = true
  }

  if (vaporMesh && life.vapor.length) {
    for (let i = 0; i < life.vapor.length; i++) {
      const vp = life.vapor[i]
      const p = (vp.phase + t * vp.speed) % 1
      const drift = p * vp.spread
      _pos.copy(vp.basePos)
        .addScaledVector(vp.baseDir, 0.9 * vp.scale + p * vp.height)
        .addScaledVector(vp.u, Math.cos(vp.ang + t * 0.7) * drift)
        .addScaledVector(vp.v, Math.sin(vp.ang + t * 0.7) * drift)
      const sc = Math.sin(p * Math.PI) * 1.15 * vp.scale
      _q.setFromAxisAngle(vp.baseDir, t * 0.8 + vp.ang)
      _s.set(sc, sc, sc)
      _m.compose(_pos, _q, _s)
      vaporMesh.setMatrixAt(i, _m)
    }
    vaporMesh.instanceMatrix.needsUpdate = true
  }

  if (windowsMesh && windowsMesh.instanceColor && life.windowZones.length) {
    _cOn.set(biome.emissiveColor || biome.cityLight || '#ffd98a')
    _cAlt.set(biome.cityLight || '#8ce8ff')
    const arr = windowsMesh.instanceColor.array
    for (let i = 0; i < life.windowZones.length; i++) {
      const wz = life.windowZones[i]
      const wave = 0.5 + 0.5 * Math.sin(t * 0.42 - wz.zonePhase)
      const sub = 0.88 + 0.12 * Math.sin(t * 1.7 + wz.flickerPhase)
      const lit = THREE.MathUtils.clamp((wave * 0.85 + wz.zoneBias) * sub, 0, 1)
      const target = wz.warm ? _cOn : _cAlt
      const k = lit * lit
      arr[i * 3] = _cOff.r + (target.r - _cOff.r) * k
      arr[i * 3 + 1] = _cOff.g + (target.g - _cOff.g) * k
      arr[i * 3 + 2] = _cOff.b + (target.b - _cOff.b) * k
    }
    windowsMesh.instanceColor.needsUpdate = true
  }
}
