import * as THREE from 'three'
import { NODE_R, mulberry32 } from '../../../Core/world.js'

// Geometrías compartidas en caché de módulo para vida planetaria
export const trafficGeo = new THREE.SphereGeometry(0.11, 8, 6).scale(0.85, 0.65, 1.55)
export const creatureGeo = new THREE.OctahedronGeometry(0.14, 0).scale(1.6, 0.45, 0.85)
export const vaporGeo = new THREE.DodecahedronGeometry(0.18, 0)

// Scratch objects a nivel de módulo (cero asignaciones por cuadro)
const _m = new THREE.Matrix4()
const _pos = new THREE.Vector3()
const _dir = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _side = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)
const _x = new THREE.Vector3()
const _z = new THREE.Vector3()
const _s = new THREE.Vector3()
const _q = new THREE.Quaternion()

/**
 * Precalcula rutas de tráfico urbano, bandadas/criaturas en órbita baja y partículas de vapor/humo.
 */
export function buildPlanetLifeData(node, biome, monumentSpot) {
  const rng = mulberry32(8800 + node.idx * 211)
  const localRoads = (node.roads || [])
    .filter((r) => r.points && r.points.length >= 2)
    .map((r) => r.points.map((p) => p.clone().sub(node.pos)))

  const traffic = []
  if (localRoads.length > 0) {
    const count = Math.min(22, localRoads.length * 3)
    for (let i = 0; i < count; i++) {
      const road = localRoads[i % localRoads.length]
      traffic.push({
        road,
        speed: (0.14 + rng() * 0.22) * (rng() < 0.5 ? 1 : -1),
        phase: rng(),
        lane: (rng() < 0.5 ? 1 : -1) * 0.18,
      })
    }
  }

  const creatures = []
  const creatureCount = 10
  for (let i = 0; i < creatureCount; i++) {
    const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize()
    const start = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5)
      .cross(axis)
      .normalize()
    if (start.lengthSq() < 0.01) start.set(1, 0, 0)
    creatures.push({
      axis,
      start,
      radius: NODE_R + 0.85 + rng() * 1.45,
      speed: (0.22 + rng() * 0.26) * (rng() < 0.5 ? 1 : -1),
      phase: rng() * Math.PI * 2,
      bobAmp: 0.12 + rng() * 0.16,
      scale: 0.7 + rng() * 0.55,
    })
  }

  const vapor = []
  const vaporCount = biome.id === 'volcan' || biome.id === 'nubes' || biome.id === 'mar' || biome.id === 'bosque' ? 12 : 8
  const baseDir = monumentSpot?.dir || new THREE.Vector3(0, 1, 0)
  const basePos = monumentSpot?.pos || baseDir.clone().multiplyScalar(NODE_R)
  const u = new THREE.Vector3().crossVectors(Math.abs(baseDir.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : _up, baseDir).normalize()
  const v = new THREE.Vector3().crossVectors(baseDir, u).normalize()
  for (let i = 0; i < vaporCount; i++) {
    vapor.push({
      basePos,
      baseDir,
      u,
      v,
      phase: i / vaporCount,
      speed: 0.22 + rng() * 0.14,
      spread: 0.35 + rng() * 0.45,
      ang: rng() * Math.PI * 2,
      height: 1.8 + rng() * 1.6,
    })
  }

  return { traffic, creatures, vapor }
}

/**
 * Actualiza tráfico, criaturas y vapor en un solo paso por cuadro (solo escribe matrices).
 */
export function updatePlanetLife(life, t, trafficMesh, creaturesMesh, vaporMesh) {
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
      _tan.subVectors(pts[idx + 1], pts[idx]).normalize()
      if (tr.speed < 0) _tan.negate()
      _side.crossVectors(_dir, _tan).normalize()
      _pos.copy(_dir).multiplyScalar(NODE_R + 0.12).addScaledVector(_side, tr.lane)
      _s.set(1, 1, 1)
      _m.makeBasis(_side, _dir, _tan).setPosition(_pos)
      trafficMesh.setMatrixAt(i, _m)
    }
    trafficMesh.instanceMatrix.needsUpdate = true
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
        .addScaledVector(vp.baseDir, 0.9 + p * vp.height)
        .addScaledVector(vp.u, Math.cos(vp.ang + t * 0.7) * drift)
        .addScaledVector(vp.v, Math.sin(vp.ang + t * 0.7) * drift)
      const sc = Math.sin(p * Math.PI) * 1.15
      _q.setFromAxisAngle(vp.baseDir, t * 0.8 + vp.ang)
      _s.set(sc, sc, sc)
      _m.compose(_pos, _q, _s)
      vaporMesh.setMatrixAt(i, _m)
    }
    vaporMesh.instanceMatrix.needsUpdate = true
  }
}
