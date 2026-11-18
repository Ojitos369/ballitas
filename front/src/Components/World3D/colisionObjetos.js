// Colisión de objetos procedurales (decoración, criaturas, fauna, ecosistema): nada se coloca dentro de una cinta de pista
// ajena ni de un tubo ajeno, y los objetos grandes de un mismo grupo no se atraviesan. Usa `world.colision` (Core/world.js,
// índice por celdas de cintas visibles y tubos que buildWorld construye tras relajar las cintas).
import * as THREE from 'three'
import * as WORLD from '../../Core/world.js'

const RIBBON = WORLD.RIBBON_HALF // cercano() mide al eje de la cinta: su borde está a RIBBON
const FAR = 24 // cercano() devuelve null más lejos: cuenta como «lejos» (sin gradiente)
const CELL = 8
const WORLDS = new WeakMap() // way -> world (lo registra Paths al montar)

export const registrarMundo = (world) => {
  for (const w of world?.ways ?? []) WORLDS.set(w, world)
  return world
}
export const mundoDe = (way) => WORLDS.get(way) ?? null

const key = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0
const cellOf = (v) => Math.floor(v / CELL)

// Mundos de picks cacheados (o de otro hilo) llegan sin índice: se reconstruye.
export const colisionDe = (world) => world.colision ?? WORLD.indexarColisiones(world)
/** Objetos grandes de un grupo (p. ej. decoración de un camino): no se atraviesan entre sí. Determinista: solo cuenta lo del grupo. */
export function nuevoLocal() {
  const cells = new Map()
  return {
    libre(p, r) {
      for (let x = cellOf(p.x - r - 4); x <= cellOf(p.x + r + 4); x++) for (let y = cellOf(p.y - r - 4); y <= cellOf(p.y + r + 4); y++) for (let z = cellOf(p.z - r - 4); z <= cellOf(p.z + r + 4); z++) {
        for (const o of cells.get(key(x, y, z)) ?? []) if (p.distanceTo(o.p) < r + o.r) return false
      }
      return true
    },
    add(p, r) { const h = key(cellOf(p.x), cellOf(p.y), cellOf(p.z)); const o = { p: p.clone(), r }; const a = cells.get(h); if (a) a.push(o); else cells.set(h, [o]) },
  }
}

export const ESTADO = { colocados: 0, descartados: 0 } // ?stats=1: window.__colisionObjetos
if (typeof window !== 'undefined') window.__colisionObjetos = ESTADO
const E = 0.25
const _g = new THREE.Vector3(); const _q = new THREE.Vector3()

/**
 * Coloca un objeto de radio `r`: si choca, lo repele (contra el gradiente de distancia al obstáculo), luego reintenta con
 * otra semilla determinista; tras `intentos` fallidos lo descarta (devuelve null).
 * candidato: { pos, seed?, ajusta? } (ajusta(p) -> Vector3|null mantiene el objeto sobre su superficie).
 * ignora: { way, si (índice del tramo en el camino), lane } = su propia cinta/tubo. local: de nuevoLocal() para objetos grandes.
 */
export function colocar(world, candidato, r, ignora = null, intentos = 6, local = null) {
  if (!world) return candidato.pos.clone()
  const col = colisionDe(world)
  const rng = WORLD.mulberry32((candidato.seed ?? 1) >>> 0)
  const p = candidato.pos.clone()
  const ok = () => col.libre(p, r, ignora) && (!local || local.libre(p, r))
  for (let i = 0; i <= intentos; i++) {
    if (ok()) { local?.add(p, r); ESTADO.colocados++; return p }
    if (i % 2 === 0) { // repele: sube por el gradiente de d (distancia al obstáculo más cercano)
      const d = (a, b, c) => col.cercano(_q.set(p.x + a, p.y + b, p.z + c))?.d ?? FAR
      _g.set(d(E, 0, 0) - d(-E, 0, 0), d(0, E, 0) - d(0, -E, 0), d(0, 0, E) - d(0, 0, -E))
      if (_g.lengthSq() > 1e-10) p.addScaledVector(_g.normalize(), Math.max(0.2, r + RIBBON - (col.cercano(p)?.d ?? FAR) + 0.1))
      else p.add(_g.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(r + 0.3))
    } else p.copy(candidato.pos).add(_g.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar((r + 0.4) * (1 + i * 0.5)))
    if (candidato.ajusta) { const a = candidato.ajusta(p); if (!a) { p.copy(candidato.pos); continue } p.copy(a) }
  }
  ESTADO.descartados++
  return null
}
