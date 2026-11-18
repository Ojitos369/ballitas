// Generación pura (sin three, sin DOM) del diorama de superficie de un nodo.
// Determinista: todo sale de mulberry32 sembrado con node.idx. Distinto entre nodos aunque compartan bioma.
import { mulberry32 } from '../../../Core/world.js'

export const CELDA = 3.4 // lado de una parcela
export const NC = 22 // parcelas por lado
export const R_SUELO = 37 // radio de la peana
export const R_PUERTO = 34.2 // radio del anillo de puertos
const R_CELDAS = 35.4

// Perfil de decoración por bioma: densidades por parcela libre (suman < 1) y modelos GLB de public/models.
// copa: forma de la copa de los árboles procedurales.
export const PERFIL = {
  sombrio: { copa: 'cono', arbol: 0.11, roca: 0.11, luz: 0.14, modelo: 0.14, modelos: ['lapida', 'sombrio_farol', 'sombrio_altar', 'tomb'] },
  bosque: { copa: 'esfera', arbol: 0.34, roca: 0.06, luz: 0.1, modelo: 0.12, modelos: ['pine', 'hongo_gigante', 'bosque_casita', 'tronco_hueco'] },
  mar: { copa: 'esfera', arbol: 0.06, roca: 0.1, luz: 0.11, modelo: 0.28, modelos: ['coral', 'alga_larga', 'mar_concha', 'mar_boya', 'concha_gigante'] },
  desierto: { copa: 'esfera', arbol: 0.05, roca: 0.14, luz: 0.08, modelo: 0.25, modelos: ['cactus', 'saguaro_grande', 'desierto_molino', 'palm'] },
  hielo: { copa: 'cono', arbol: 0.16, roca: 0.1, luz: 0.11, modelo: 0.2, modelos: ['estalagmita_hielo', 'hielo_iglu', 'hielo_farol', 'ice_spire'] },
  volcan: { copa: 'cono', arbol: 0.06, roca: 0.21, luz: 0.11, modelo: 0.18, modelos: ['volcan_erupcion', 'volcan_farol', 'geiser', 'volcan_altar'] },
  cristal: { copa: 'diamante', arbol: 0.14, roca: 0.06, luz: 0.14, modelo: 0.24, modelos: ['crystal', 'geoda', 'cristal_prisma', 'cristal_arco'] },
  nubes: { copa: 'esfera', arbol: 0.13, roca: 0.03, luz: 0.15, modelo: 0.22, modelos: ['cloud', 'nubes_globo', 'nubes_casita', 'isla_nube'] },
  neon: { copa: 'diamante', arbol: 0.08, roca: 0.04, luz: 0.22, modelo: 0.2, modelos: ['neon_kiosco', 'neon_molino', 'luciernaga_farol', 'pylon'] },
  jardin: { copa: 'esfera', arbol: 0.29, roca: 0.04, luz: 0.18, modelo: 0.14, modelos: ['jardin_flor', 'fuente_jardin', 'jardin_gazebo', 'flower'] },
}

const h2 = (x, z, s) => {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(z | 0, 668265263) ^ Math.imul(s | 0, 2246822519)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}
const lerp = (a, b, t) => a + (b - a) * t
export function vnoise(x, z, s) {
  const x0 = Math.floor(x); const z0 = Math.floor(z)
  const fx = x - x0; const fz = z - z0
  const u = fx * fx * (3 - 2 * fx); const v = fz * fz * (3 - 2 * fz)
  return lerp(lerp(h2(x0, z0, s), h2(x0 + 1, z0, s), u), lerp(h2(x0, z0 + 1, s), h2(x0 + 1, z0 + 1, s), u), v)
}

// Mismo cálculo de terminales que getTerminals de Nodes.jsx (que arrastra three y GLB y no se puede importar en tests).
export function terminalesDe(node) {
  if (Array.isArray(node.terminals) && node.terminals.length > 0) return node.terminals
  const list = []
  for (const p of node.ports || []) {
    if (p.out != null && node.verts?.[p.out]) list.push({ vert: p.out, kind: 'out', way: p.wayOut || null, to: p.to, dir: node.verts[p.out].dir })
    if (p.in != null && node.verts?.[p.in]) list.push({ vert: p.in, kind: 'in', way: p.wayIn || null, to: p.to, dir: node.verts[p.in].dir })
  }
  return list
}

// Separa ángulos para que dos puertos no se pisen conservando el orden angular real.
export function repartirAngulos(angs, gap) {
  const n = angs.length
  const out = angs.slice()
  if (n < 2) return out
  const ord = out.map((a, i) => i).sort((i, j) => out[i] - out[j])
  const TAU = Math.PI * 2
  for (let it = 0; it < 60; it++) {
    for (let k = 0; k < n; k++) {
      const i = ord[k]; const j = ord[(k + 1) % n]
      let d = out[j] - out[i]
      if (k === n - 1) d += TAU
      if (d < gap) { const m = (gap - d) / 2; out[i] -= m; out[j] += m }
    }
  }
  return out
}

const sampleAt = (seed) => (x, z) => {
  const r = Math.hypot(x, z)
  const plano = Math.min(1, Math.max(0, (r - 7) / 10)) // plaza plana
  return (vnoise(x * 0.07, z * 0.07, seed) - 0.5) * 1.4 * plano
}

export function generarSuperficie(node, biome, world = null) {
  const idx = node.idx ?? 0
  const rng = mulberry32((idx + 1) * 100003 + 777)
  const seed = ((idx + 1) * 2654435761) >>> 0
  const perfil = PERFIL[biome.id] || PERFIL.bosque
  const elev = sampleAt(seed)
  const centro = (i) => (i - (NC - 1) / 2) * CELDA
  const topAt = (x, z) => {
    const ci = Math.round(x / CELDA + (NC - 1) / 2); const cj = Math.round(z / CELDA + (NC - 1) / 2)
    return elev(centro(ci), centro(cj)) + 0.3
  }
  const plazaR = 6.2 + rng() * 1.4
  const varianteRot = rng() * Math.PI * 2

  // ── puertos: uno por terminal, en el ángulo real de su dirección ──
  const terms = terminalesDe(node)
  let angs = terms.map((t, i) => {
    const d = t.dir || { x: 0, y: 1, z: 0 }
    const hz = Math.hypot(d.x, d.z)
    return hz > 0.05 ? Math.atan2(d.z, d.x) : varianteRot + i * 2.399
  })
  angs = repartirAngulos(angs, (0.8 * Math.PI * 2) / Math.max(terms.length, 1))
  const puertos = terms.map((t, i) => {
    const a = angs[i]
    const way = t.way || null
    const dest = world?.nodes?.[t.to]
    return {
      id: i, n: i + 1, kind: t.kind === 'out' ? 'out' : 'in', ang: a,
      x: Math.cos(a) * R_PUERTO, z: Math.sin(a) * R_PUERTO,
      to: t.to ?? -1, toName: dest?.name ?? (t.to != null ? `Mundo ${t.to + 1}` : '?'),
      wayIdx: way?.idx ?? -1, themeId: way?.theme?.id ?? biome.id,
      themeName: way?.theme?.name ?? 'Camino', themeEmoji: way?.theme?.emoji ?? '🛣️',
    }
  })

  // ── calles: plaza -> cada puerto (Bézier con un quiebre suave) ──
  const calles = puertos.map((p) => {
    const a = p.ang
    const x0 = Math.cos(a) * plazaR; const z0 = Math.sin(a) * plazaR
    const x2 = Math.cos(a) * (R_PUERTO - 1.2); const z2 = Math.sin(a) * (R_PUERTO - 1.2)
    const b = (rng() - 0.5) * 7
    const xm = (x0 + x2) / 2 - Math.sin(a) * b; const zm = (z0 + z2) / 2 + Math.cos(a) * b
    const len = Math.hypot(x2 - x0, z2 - z0)
    const n = Math.max(4, Math.ceil(len / 1.5))
    const pts = []
    for (let k = 0; k <= n; k++) {
      const t = k / n; const u = 1 - t
      pts.push({ x: u * u * x0 + 2 * u * t * xm + t * t * x2, z: u * u * z0 + 2 * u * t * zm + t * t * z2 })
    }
    return { puerto: p.id, pts }
  })
  const distCalle = (x, z) => {
    let m = Infinity
    for (const c of calles) for (const q of c.pts) { const d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < m) m = d }
    return Math.sqrt(m)
  }

  // ── parcelas, edificios y flora ──
  const celdas = []; const edificios = []; const flora = []
  const nPal = 6
  const parche = 0.05 + rng() * 0.05
  const barrioK = 0.08 + rng() * 0.05
  const altura = 0.8 + rng() * 0.5
  for (let j = 0; j < NC; j++) {
    for (let i = 0; i < NC; i++) {
      const x = centro(i); const z = centro(j)
      const r = Math.hypot(x, z)
      if (r > R_CELDAS) continue
      const top = elev(x, z) + 0.3
      const pv = vnoise(x * parche * 2.2, z * parche * 2.2, seed + 1)
      const dc = distCalle(x, z)
      const enPlaza = r < plazaR + 0.6
      const col = enPlaza ? 3 : Math.min(nPal - 1, Math.floor(pv * nPal * 0.999))
      celdas.push({ x, z, top, col, v: h2(i, j, seed) })
      if (enPlaza || dc < 2.5 || r > R_PUERTO - 2.2) continue
      const barrio = vnoise(x * barrioK, z * barrioK, seed + 2)
      const rn = r / R_CELDAS
      const pEd = Math.min(0.9, Math.max(0.05, 0.1 + 0.95 * barrio - 0.45 * rn))
      if (r > plazaR + 2.2 && rng() < pEd) {
        const roll = rng()
        let tipo
        if (rn < 0.4) tipo = roll < 0.35 ? 'rascacielos' : roll < 0.65 ? 'torre' : roll < 0.85 ? 'comercio' : roll < 0.95 ? 'estacion' : 'casa'
        else if (rn < 0.72) tipo = roll < 0.3 ? 'comercio' : roll < 0.6 ? 'casa' : roll < 0.75 ? 'torre' : roll < 0.85 ? 'rascacielos' : roll < 0.95 ? 'estacion' : 'parque'
        else tipo = roll < 0.5 ? 'casa' : roll < 0.75 ? 'parque' : roll < 0.9 ? 'comercio' : 'torre'
        const hb = { casa: 2.6, torre: 5.2, rascacielos: 7.4, comercio: 2.9, estacion: 2.8, parque: 1.3 }[tipo]
        const w = (tipo === 'torre' || tipo === 'rascacielos' ? 2.15 : 2.45) * (0.9 + rng() * 0.22)
        edificios.push({
          tipo, x: x + (rng() - 0.5) * 0.5, z: z + (rng() - 0.5) * 0.5, y: top - 0.1, w,
          h: hb * altura * (0.8 + rng() * 0.6), rot: Math.round(Math.atan2(-z, -x) / (Math.PI / 2)) * (Math.PI / 2),
        })
        continue
      }
      const roll = rng()
      const ox = (rng() - 0.5) * CELDA * 0.7; const oz = (rng() - 0.5) * CELDA * 0.7
      const f = { x: x + ox, z: z + oz, y: top, s: 0.75 + rng() * 0.6, rot: rng() * Math.PI * 2, c: rng() }
      if (roll < perfil.arbol) flora.push({ ...f, tipo: 'arbol' })
      else if (roll < perfil.arbol + perfil.roca) flora.push({ ...f, tipo: 'roca' })
      else if (roll < perfil.arbol + perfil.roca + perfil.luz) flora.push({ ...f, tipo: 'luz' })
      else if (roll < perfil.arbol + perfil.roca + perfil.luz + perfil.modelo) flora.push({ ...f, tipo: 'modelo', m: Math.floor(rng() * perfil.modelos.length) })
    }
  }

  // ── farolas: a lo largo de las calles (alternando lados) y en el anillo de la plaza ──
  const farolas = []
  calles.forEach((c, ci) => {
    for (let k = 3; k < c.pts.length - 1; k += 3) {
      const q = c.pts[k]; const q2 = c.pts[k + 1]
      const nx = -(q2.z - q.z); const nz = q2.x - q.x; const l = Math.hypot(nx, nz) || 1
      const side = (k / 3 + ci) % 2 === 0 ? 1 : -1
      const x = q.x + (nx / l) * 1.35 * side; const z = q.z + (nz / l) * 1.35 * side
      farolas.push({ x, z, y: topAt(x, z), fase: rng() * 6.28 })
    }
  })
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + varianteRot
    const x = Math.cos(a) * (plazaR + 0.2); const z = Math.sin(a) * (plazaR + 0.2)
    if (distCalle(x, z) < 1.6) continue
    farolas.push({ x, z, y: topAt(x, z), fase: rng() * 6.28 })
  }

  return { idx, seed, perfil, plazaR, puertos, calles, celdas, edificios, flora, farolas, topAt }
}
