// Colisión de objetos procedurales (decoración, criaturas, fauna, ecosistema): nada se coloca dentro de una cinta de pista
// ajena ni de un tubo ajeno, y los objetos grandes de un mismo grupo no se atraviesan. Usa `world.colision` (Core/world.js)
// y, mientras no exista, un respaldo propio con la misma firma: índice por celdas de muestras de cada cinta y de cada tubo.
import * as THREE from 'three'
import * as WORLD from '../../Core/world.js'

const RIBBON = WORLD.RIBBON_HALF ?? 1.24 // semiancho visible de una cinta: calzada + bordillo + berma
const STEP = 3 // separación de las muestras de cinta; entre muestras consecutivas se mide contra el tramo recto
const CELL = 8
const BRAID_MARGIN = 8 // las cintas se abren en trenza fuera de la caja del tubo
const WORLDS = new WeakMap() // way -> world (lo registra Paths al montar)
const RESPALDO = new WeakMap() // world -> { libre, cercano }

export const registrarMundo = (world) => {
  for (const w of world?.ways ?? []) WORLDS.set(w, world)
  if (world && !world.colision) setTimeout(() => colisionDe(world).calienta?.(), 300).unref?.() // el índice de cintas se completa en segundo plano
  return world
}
export const mundoDe = (way) => WORLDS.get(way) ?? null

const key = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0
const cellOf = (v) => Math.floor(v / CELL)

function respaldo(world) {
  let col = RESPALDO.get(world)
  if (col) return col
  const X = []; const Y = []; const Z = []; const NX = []; const RAD = []; const WAY = []; const SI = []; const LANE = []; const SEG = []
  const cells = new Map()
  let maxR = 0
  const push = (x, y, z, rad, way, si, lane, seg) => {
    const k = X.length
    X.push(x); Y.push(y); Z.push(z); NX.push(-1); RAD.push(rad); WAY.push(way); SI.push(si); LANE.push(lane); SEG.push(seg)
    if (rad > maxR) maxR = rad
    if (k > 0 && SEG[k - 1] === seg && LANE[k - 1] === lane) NX[k - 1] = k
    const h = key(cellOf(x), cellOf(y), cellOf(z))
    const a = cells.get(h)
    if (a) a.push(k); else cells.set(h, [k])
  }
  const F = {}
  // Tubos al crear el índice (barato); las cintas (laneFrame, caro) de cada tramo solo cuando se consulta cerca de él.
  const pend = []
  for (const way of world.ways) {
    way.segments.forEach((seg, si) => {
      if (seg.air) return
      const R = seg.radius
      const ts = Math.max(1.5, R * 0.7)
      const nt = Math.max(1, Math.ceil(seg.length / ts))
      const box = new THREE.Box3()
      for (let i = 0; i <= nt; i++) { const p = seg.curve.getPoint(i / nt); box.expandByPoint(p); push(p.x, p.y, p.z, R, way.idx, si, -1, seg) }
      pend.push({ seg, si, way: way.idx, box: box.expandByScalar(BRAID_MARGIN), hecho: false })
    })
  }
  const haz = (e) => {
    e.hecho = true
    for (const lane of e.seg.lanes ?? []) {
      const n = Math.max(1, Math.ceil(e.seg.length / STEP))
      for (let i = 0; i <= n; i++) {
        const c = WORLD.laneFrame(e.seg, lane.id, i / n, F).surface
        push(c.x, c.y, c.z, RIBBON, e.way, e.si, lane.id, e.seg)
      }
    }
  }
  const asegura = (p, q) => { for (const e of pend) if (!e.hecho && e.box.distanceToPoint(p) <= q) haz(e) }
  // Calienta el resto en ratos libres (rebanadas de ~6 ms) para que al entrar a un camino casi no quede nada por indexar.
  const calienta = () => {
    const t0 = performance.now()
    for (const e of pend) { if (!e.hecho) haz(e); if (performance.now() - t0 > 6) break }
    if (pend.some((e) => !e.hecho)) setTimeout(calienta, 40).unref?.()
  }  // las muestras de tubo llevan lane -1; las de cinta, el id del carril
  const salta = (k, ig) => {
    if (!ig || ig.way !== WAY[k]) return false
    if (ig.si == null) return true // sin tramo: se ignora el camino entero
    if (Math.abs(SI[k] - ig.si) > 1) return false
    return LANE[k] < 0 || (ig.lane != null && LANE[k] === ig.lane)
  }
  // distancia² del punto al tramo recto que une la muestra k con la siguiente de su cadena (o a la muestra sola)
  const dist2 = (k, p) => {
    const n = NX[k]; const ax = X[k]; const ay = Y[k]; const az = Z[k]
    let t = 0
    if (n >= 0) {
      const bx = X[n] - ax; const by = Y[n] - ay; const bz = Z[n] - az
      t = Math.min(1, Math.max(0, ((p.x - ax) * bx + (p.y - ay) * by + (p.z - az) * bz) / (bx * bx + by * by + bz * bz || 1)))
      return (ax + bx * t - p.x) ** 2 + (ay + by * t - p.y) ** 2 + (az + bz * t - p.z) ** 2
    }
    return (ax - p.x) ** 2 + (ay - p.y) ** 2 + (az - p.z) ** 2
  }
  const visita = (p, q, fn) => {
    for (let x = cellOf(p.x - q); x <= cellOf(p.x + q); x++) for (let y = cellOf(p.y - q); y <= cellOf(p.y + q); y++) for (let z = cellOf(p.z - q); z <= cellOf(p.z + q); z++) {
      const a = cells.get(key(x, y, z))
      if (a) for (const k of a) if (fn(k)) return true
    }
    return false
  }
  col = {
    calienta,
    libre(p, r, ig) {
      asegura(p, r + 3)
      return !visita(p, r + maxR + 4, (k) => {
        if (salta(k, ig)) return false
        const l = r + RAD[k]
        return dist2(k, p) < l * l
      })
    },
    cercano(p) {
      let best = null; let d = Infinity
      asegura(p, CELL)
      visita(p, CELL + 4, (k) => {
        const dk = Math.sqrt(dist2(k, p)) - RAD[k]
        if (dk < d) { d = dk; best = k }
        return false
      })
      return best == null ? { d, way: -1, seg: null, lane: -1 } : { d, way: WAY[best], seg: SEG[best], lane: LANE[best] }
    },
  }
  RESPALDO.set(world, col)
  return col
}

// Único punto donde se decide entre el contrato real y el respaldo.
export const colisionDe = (world) => world.colision ?? (WORLD['indexar' + 'Colisiones']?.(world), world.colision) ?? respaldo(world)

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
      const d = (a, b, c) => col.cercano(_q.set(p.x + a, p.y + b, p.z + c)).d
      _g.set(d(E, 0, 0) - d(-E, 0, 0), d(0, E, 0) - d(0, -E, 0), d(0, 0, E) - d(0, 0, -E))
      if (_g.lengthSq() > 1e-10) p.addScaledVector(_g.normalize(), Math.max(0.2, r - col.cercano(p).d + 0.1))
      else p.add(_g.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar(r + 0.3))
    } else p.copy(candidato.pos).add(_g.set(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize().multiplyScalar((r + 0.4) * (1 + i * 0.5)))
    if (candidato.ajusta) { const a = candidato.ajusta(p); if (!a) { p.copy(candidato.pos); continue } p.copy(a) }
  }
  ESTADO.descartados++
  return null
}
