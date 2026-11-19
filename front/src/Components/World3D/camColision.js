// Colisión barata de la cámara de seguimiento contra la geometría de la escena (sin three: lógica pura y probable).
// Cada geometría se indexa una vez, en su espacio local, en una rejilla uniforme de triángulos (formato CSR).
// La construcción va por partes (presupuesto de ms por cuadro): las pistas de un camino son una sola malla de
// 100-200 mil triángulos y Raycaster tardaba ~27 ms por rayo contra ellas. Consultas: rayo (DDA por celdas) y
// punto más cercano dentro de un radio.

const OFF = 65536
const K = 131072
const key = (ix, iy, iz) => ((ix + OFF) * K + (iy + OFF)) * K + (iz + OFF)
const MAX_CELLS_TRI = 96 // un triángulo que pisa más celdas va a la lista `big` (se prueba siempre)
const TRIS_POR_CELDA = 14

// Rejilla vacía para una geometría: pos = Float32Array xyz (o atributo con .array), idx = índices o null.
export function crearRejilla(pos, idx) {
  const n = Math.floor((idx ? idx.length : pos.length / 3) / 3)
  return { pos, idx, n, cell: 1, inv: 1, fase: 0, next: 0, map: new Map(), counts: [], ofs: null, items: null, fill: null, big: [], stamp: new Uint32Array(n), sid: 0, done: n === 0 }
}

function vtx(g, t, k, out, o) {
  const i = g.idx ? g.idx[t * 3 + k] : t * 3 + k
  out[o] = g.pos[i * 3]; out[o + 1] = g.pos[i * 3 + 1]; out[o + 2] = g.pos[i * 3 + 2]
}
const T9 = new Float64Array(9)
function tri(g, t) { vtx(g, t, 0, T9, 0); vtx(g, t, 1, T9, 3); vtx(g, t, 2, T9, 6); return T9 }

// tamaño de celda: ~TRIS_POR_CELDA triángulos por celda de superficie (muestra de hasta 4000 triángulos)
function elegirCelda(g) {
  const paso = Math.max(1, Math.floor(g.n / 4000))
  let area = 0; let m = 0; let lado = 0
  for (let t = 0; t < g.n; t += paso) {
    const v = tri(g, t)
    const ax = v[3] - v[0]; const ay = v[4] - v[1]; const az = v[5] - v[2]
    const bx = v[6] - v[0]; const by = v[7] - v[1]; const bz = v[8] - v[2]
    const cx = ay * bz - az * by; const cy = az * bx - ax * bz; const cz = ax * by - ay * bx
    area += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz)
    lado = Math.max(lado, Math.hypot(ax, ay, az) * 0.25)
    m++
  }
  const media = m ? area / m : 1
  const c = Math.sqrt(Math.max(1e-6, media * TRIS_POR_CELDA))
  return Math.min(8, Math.max(0.25, c))
}

// rango de celdas del triángulo (AABB); devuelve el número de celdas
const R6 = new Int32Array(6)
function rango(g, t) {
  const v = tri(g, t); const s = g.inv
  R6[0] = Math.floor(Math.min(v[0], v[3], v[6]) * s); R6[3] = Math.floor(Math.max(v[0], v[3], v[6]) * s)
  R6[1] = Math.floor(Math.min(v[1], v[4], v[7]) * s); R6[4] = Math.floor(Math.max(v[1], v[4], v[7]) * s)
  R6[2] = Math.floor(Math.min(v[2], v[5], v[8]) * s); R6[5] = Math.floor(Math.max(v[2], v[5], v[8]) * s)
  return (R6[3] - R6[0] + 1) * (R6[4] - R6[1] + 1) * (R6[5] - R6[2] + 1)
}

// Avanza la construcción hasta `maxTris` triángulos (dos pasadas: conteo y llenado). true al terminar.
export function construir(g, maxTris = Infinity) {
  if (g.done) return true
  if (g.fase === 0) { g.cell = elegirCelda(g); g.inv = 1 / g.cell; g.fase = 1; g.next = 0 }
  let presupuesto = maxTris
  if (g.fase === 1) {
    while (g.next < g.n && presupuesto-- > 0) {
      const t = g.next++
      const nc = rango(g, t)
      if (!(nc > 0) || nc > MAX_CELLS_TRI) { g.big.push(t); continue }
      for (let x = R6[0]; x <= R6[3]; x++) for (let y = R6[1]; y <= R6[4]; y++) for (let z = R6[2]; z <= R6[5]; z++) {
        const k = key(x, y, z)
        let c = g.map.get(k)
        if (c === undefined) { c = g.counts.length; g.map.set(k, c); g.counts.push(0) }
        g.counts[c]++
      }
    }
    if (g.next < g.n) return false
    const nc = g.counts.length
    g.ofs = new Int32Array(nc + 1)
    for (let i = 0; i < nc; i++) g.ofs[i + 1] = g.ofs[i] + g.counts[i]
    g.items = new Int32Array(g.ofs[nc])
    g.fill = Int32Array.from(g.ofs.subarray(0, nc))
    g.counts = null
    g.bigSet = new Set(g.big)
    g.fase = 2; g.next = 0
  }
  while (g.next < g.n && presupuesto-- > 0) {
    const t = g.next++
    if (g.bigSet.has(t)) continue
    rango(g, t)
    for (let x = R6[0]; x <= R6[3]; x++) for (let y = R6[1]; y <= R6[4]; y++) for (let z = R6[2]; z <= R6[5]; z++) {
      const c = g.map.get(key(x, y, z))
      g.items[g.fill[c]++] = t
    }
  }
  if (g.next < g.n) return false
  g.fill = null; g.bigSet = null; g.done = true
  return true
}

// Möller–Trumbore a dos caras: t del rayo o Infinity
function rayTri(v, ox, oy, oz, dx, dy, dz) {
  const e1x = v[3] - v[0]; const e1y = v[4] - v[1]; const e1z = v[5] - v[2]
  const e2x = v[6] - v[0]; const e2y = v[7] - v[1]; const e2z = v[8] - v[2]
  const px = dy * e2z - dz * e2y; const py = dz * e2x - dx * e2z; const pz = dx * e2y - dy * e2x
  const det = e1x * px + e1y * py + e1z * pz
  if (Math.abs(det) < 1e-12) return Infinity
  const id = 1 / det
  const sx = ox - v[0]; const sy = oy - v[1]; const sz = oz - v[2]
  const u = (sx * px + sy * py + sz * pz) * id
  if (u < 0 || u > 1) return Infinity
  const qx = sy * e1z - sz * e1y; const qy = sz * e1x - sx * e1z; const qz = sx * e1y - sy * e1x
  const w = (dx * qx + dy * qy + dz * qz) * id
  if (w < 0 || u + w > 1) return Infinity
  const t = (e2x * qx + e2y * qy + e2z * qz) * id
  return t >= 0 ? t : Infinity
}

function probarCelda(g, c, ox, oy, oz, dx, dy, dz, best) {
  for (let i = g.ofs[c], e = g.ofs[c + 1]; i < e; i++) {
    const t = g.items[i]
    if (g.stamp[t] === g.sid) continue
    g.stamp[t] = g.sid
    const h = rayTri(tri(g, t), ox, oy, oz, dx, dy, dz)
    if (h < best) best = h
  }
  return best
}
function nuevoSello(g) { if (++g.sid > 0xfffffff0) { g.stamp.fill(0); g.sid = 1 } }

// Primer impacto del segmento o + d·t, t∈[0, tMax] (d sin normalizar). Devuelve t o Infinity.
export function rayoRejilla(g, ox, oy, oz, dx, dy, dz, tMax = 1) {
  if (!g.done) return Infinity
  nuevoSello(g)
  let best = Infinity
  for (const t of g.big) { const h = rayTri(tri(g, t), ox, oy, oz, dx, dy, dz); if (h < best) best = h }
  const s = g.inv
  let x = Math.floor(ox * s); let y = Math.floor(oy * s); let z = Math.floor(oz * s)
  const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0; const sy = dy > 0 ? 1 : dy < 0 ? -1 : 0; const sz = dz > 0 ? 1 : dz < 0 ? -1 : 0
  const tdx = sx ? g.cell / Math.abs(dx) : Infinity; const tdy = sy ? g.cell / Math.abs(dy) : Infinity; const tdz = sz ? g.cell / Math.abs(dz) : Infinity
  let tmx = sx ? ((x + (sx > 0 ? 1 : 0)) * g.cell - ox) / dx : Infinity
  let tmy = sy ? ((y + (sy > 0 ? 1 : 0)) * g.cell - oy) / dy : Infinity
  let tmz = sz ? ((z + (sz > 0 ? 1 : 0)) * g.cell - oz) / dz : Infinity
  for (let paso = 0; paso < 512; paso++) {
    const c = g.map.get(key(x, y, z))
    if (c !== undefined) best = probarCelda(g, c, ox, oy, oz, dx, dy, dz, best)
    const salida = Math.min(tmx, tmy, tmz)
    if (best <= salida || salida > tMax) break
    if (tmx === salida) { x += sx; tmx += tdx } else if (tmy === salida) { y += sy; tmy += tdy } else { z += sz; tmz += tdz }
  }
  return best <= tMax ? best : Infinity
}

// Punto más cercano de un triángulo a p (Ericson, Real-Time Collision Detection 5.1.5) en out[0..2]
function cercanoTri(v, px, py, pz, out) {
  const ax = v[0], ay = v[1], az = v[2]
  const abx = v[3] - ax, aby = v[4] - ay, abz = v[5] - az
  const acx = v[6] - ax, acy = v[7] - ay, acz = v[8] - az
  const apx = px - ax, apy = py - ay, apz = pz - az
  const d1 = abx * apx + aby * apy + abz * apz; const d2 = acx * apx + acy * apy + acz * apz
  if (d1 <= 0 && d2 <= 0) { out[0] = ax; out[1] = ay; out[2] = az; return }
  const bpx = px - v[3], bpy = py - v[4], bpz = pz - v[5]
  const d3 = abx * bpx + aby * bpy + abz * bpz; const d4 = acx * bpx + acy * bpy + acz * bpz
  if (d3 >= 0 && d4 <= d3) { out[0] = v[3]; out[1] = v[4]; out[2] = v[5]; return }
  const vc = d1 * d4 - d3 * d2
  if (vc <= 0 && d1 >= 0 && d3 <= 0) { const t = d1 / (d1 - d3); out[0] = ax + abx * t; out[1] = ay + aby * t; out[2] = az + abz * t; return }
  const cpx = px - v[6], cpy = py - v[7], cpz = pz - v[8]
  const d5 = abx * cpx + aby * cpy + abz * cpz; const d6 = acx * cpx + acy * cpy + acz * cpz
  if (d6 >= 0 && d5 <= d6) { out[0] = v[6]; out[1] = v[7]; out[2] = v[8]; return }
  const vb = d5 * d2 - d1 * d6
  if (vb <= 0 && d2 >= 0 && d6 <= 0) { const t = d2 / (d2 - d6); out[0] = ax + acx * t; out[1] = ay + acy * t; out[2] = az + acz * t; return }
  const va = d3 * d6 - d5 * d4
  if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
    const t = (d4 - d3) / (d4 - d3 + (d5 - d6))
    out[0] = v[3] + (v[6] - v[3]) * t; out[1] = v[4] + (v[7] - v[4]) * t; out[2] = v[5] + (v[8] - v[5]) * t; return
  }
  const den = 1 / (va + vb + vc); const s = vb * den; const w = vc * den
  out[0] = ax + abx * s + acx * w; out[1] = ay + aby * s + acy * w; out[2] = az + abz * s + acz * w
}

const C3 = new Float64Array(3)
// Distancia de p a la superficie más cercana dentro de r (Infinity si no hay); el punto queda en out[0..2].
export function cercanoRejilla(g, px, py, pz, r, out) {
  if (!g.done) return Infinity
  nuevoSello(g)
  let best = r * r; let hay = false
  const prueba = (t) => {
    if (g.stamp[t] === g.sid) return
    g.stamp[t] = g.sid
    cercanoTri(tri(g, t), px, py, pz, C3)
    const d2 = (C3[0] - px) ** 2 + (C3[1] - py) ** 2 + (C3[2] - pz) ** 2
    if (d2 < best) { best = d2; hay = true; out[0] = C3[0]; out[1] = C3[1]; out[2] = C3[2] }
  }
  for (const t of g.big) prueba(t)
  const s = g.inv
  const x0 = Math.floor((px - r) * s), x1 = Math.floor((px + r) * s)
  const y0 = Math.floor((py - r) * s), y1 = Math.floor((py + r) * s)
  const z0 = Math.floor((pz - r) * s), z1 = Math.floor((pz + r) * s)
  if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > 343) return Infinity // radio desproporcionado a la celda
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    const c = g.map.get(key(x, y, z))
    if (c === undefined) continue
    for (let i = g.ofs[c], e = g.ofs[c + 1]; i < e; i++) prueba(g.items[i])
  }
  return hay ? Math.sqrt(best) : Infinity
}

// Fuerza bruta (para pruebas): primer impacto del segmento contra todos los triángulos.
export function rayoBruto(g, ox, oy, oz, dx, dy, dz, tMax = 1) {
  let best = Infinity
  for (let t = 0; t < g.n; t++) { const h = rayTri(tri(g, t), ox, oy, oz, dx, dy, dz); if (h < best) best = h }
  return best <= tMax ? best : Infinity
}
