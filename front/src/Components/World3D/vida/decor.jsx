// Decoración temática de la berma de cada carril: modelos de public/models apoyados en el terreno y
// orientados con la gravedad de ESE carril, con ritmo (zonas calmas y zonas con algo) y la calzada libre.
import { useMemo } from 'react'
import * as THREE from 'three'
import { Instanced, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { useModelo } from './modelos.js'
import { categoriaModelo, triplanarMaterial } from '../triplanar.js'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, halfWidth, lanesOf, surfFrame } from './pista.jsx'

// [modelo, escala mín, escala máx, medio ancho a escala 1, tinte]
const KITS = {
  bosque: [['pine', 1.6, 2.8, 0.24, '#ffffff'], ['bosque_nido', 0.65, 1.05, 0.5, '#ffffff'], ['bosque_casita', 0.62, 0.92, 0.5, '#ffffff'], ['rock', 0.25, 0.55, 0.67, '#ffffff']],
  volcan: [['volcan_altar', 0.62, 0.92, 0.5, '#ffffff'], ['monolith', 0.9, 1.7, 0.34, '#5a3a30'], ['volcan_farol', 0.72, 1.05, 0.22, '#ffffff']],
  mar: [['mar_boya', 0.72, 1.05, 0.4, '#ffffff'], ['palm', 1.6, 2.4, 0.45, '#ffffff'], ['mar_concha', 0.72, 1.05, 0.5, '#ffffff']],
  hielo: [['hielo_iglu', 0.72, 1.05, 0.5, '#ffffff'], ['hielo_farol', 0.72, 1.05, 0.22, '#ffffff'], ['rock', 0.3, 0.6, 0.67, '#cfe6ff']],
  desierto: [['desierto_oasis', 0.68, 1.0, 0.5, '#ffffff'], ['desierto_molino', 0.72, 1.05, 0.24, '#ffffff'], ['rock', 0.3, 0.7, 0.67, '#e0a070']],
  cristal: [['cristal_prisma', 0.65, 1.0, 0.4, '#ffffff'], ['cristal_arco', 0.72, 1.0, 0.36, '#ffffff'], ['crystal', 0.3, 0.6, 0.35, '#9ffcff']],
  nubes: [['nubes_globo', 0.72, 1.05, 0.34, '#ffffff'], ['flower', 0.4, 0.7, 0.32, '#ffffff'], ['nubes_casita', 0.62, 0.92, 0.5, '#ffffff']],
  neon: [['lamp', 1.2, 1.8, 0.26, '#ffffff'], ['neon_kiosco', 0.62, 0.92, 0.5, '#ffffff'], ['neon_molino', 0.72, 1.05, 0.24, '#ffffff']],
  jardin: [['jardin_gazebo', 0.72, 1.0, 0.36, '#ffffff'], ['tree', 1.3, 2, 0.35, '#e8ffe0'], ['jardin_flor', 0.68, 1.0, 0.34, '#ffffff']],
  sombrio: [['sombrio_farol', 0.72, 1.05, 0.22, '#ffffff'], ['sombrio_altar', 0.62, 0.92, 0.5, '#ffffff'], ['tree', 1.3, 2, 0.35, '#6b5a8a']],
}
const GLOW = { neon: 0.5, cristal: 0.2, sombrio: 0.12 }
const SPACING = 2.6
const MAX_ITEMS = 32

// altura de la berma en |x| (mismo perfil que pista.jsx)
function bermY(ax, E) {
  const t = (ax - E) / TERR
  return t < 0.5 ? 0.025 + (0.06 - 0.025) * (t / 0.5) : 0.06 - 0.22 * ((t - 0.5) / 0.5)
}

const F = {}; const YAW = new THREE.Quaternion(); const Yv = new THREE.Vector3(0, 1, 0)
function buildItems(way) {
  const kit = KITS[way.theme.id] ?? KITS.bosque
  const rng = mulberry32(7717 + way.idx * 97)
  const out = kit.map(() => [])
  let order = 0
  const world = mundoDe(way); const local = nuevoLocal()
  way.segments.forEach((seg, si) => {
    for (const lane of lanesOf(seg)) {
      const L = seg.length; const E = halfWidth(lane) + CURB
      const busy = (seg.switches ?? []).filter((w) => w.from === lane.id || w.to === lane.id).map((w) => w.u * L)
      for (let s = 3; s < L - 3; s += SPACING * (0.7 + rng() * 0.6)) {
        const zone = 0.5 + 0.5 * Math.sin(s * 0.05 + si * 1.9 + lane.id * 1.3)
        if (rng() > 0.1 + 0.55 * zone * zone) continue
        if (busy.some((b) => Math.abs(b - s) < 4)) continue
        const k = Math.floor(rng() * kit.length)
        const [, a, b, r, tint] = kit[k]
        let sc = a + rng() * (b - a)
        const room = TERR + 0.15
        if (r * sc * 2 > room) sc = room / (r * 2)
        const ax = E + r * sc + rng() * Math.max(0, room - r * sc * 2)
        const x = (rng() < 0.5 ? -1 : 1) * ax
        const f = surfFrame(seg, lane.id, s / L, F)
        const [o, side, up] = [f.pos.clone(), f.side.clone(), f.up.clone()]
        const at = (xx) => o.clone().addScaledVector(side, xx).addScaledVector(up, bermY(Math.abs(xx), E) - 0.03)
        const quat = basisQuat(f.up, f.tangent).multiply(YAW.setFromAxisAngle(Yv, rng() * Math.PI * 2))
        const c = new THREE.Color(tint).multiplyScalar(0.85 + rng() * 0.25)
        const rad = r * sc
        // repulsión solo a lo ancho: se mantiene en su berma y nunca pisa el asfalto de su carril
        const ajusta = (p) => { const xx = (p.x - o.x) * side.x + (p.y - o.y) * side.y + (p.z - o.z) * side.z; const a = Math.max(Math.abs(xx), E + rad * 0.5); return a > E + TERR + rad + 0.6 ? null : at(Math.sign(xx || x) * a) }
        const pos = colocar(world, { pos: at(x), seed: way.idx * 9719 + si * 131 + lane.id * 17 + Math.floor(s * 10), ajusta }, rad, { way: way.idx, si, lane: lane.id }, 4, local)
        if (pos) out[k].push({ pos, quat, scale: sc, color: c, order: order++ })
      }
    }
  })
  const placed = out.flatMap((items, k) => items.map((item) => ({ ...item, k }))).sort((a, b) => a.order - b.order)
  if (placed.length > MAX_ITEMS) {
    for (const items of out) items.length = 0
    const step = placed.length / MAX_ITEMS
    for (let i = 0; i < MAX_ITEMS; i++) {
      const { k, order: _order, ...item } = placed[Math.floor(i * step)]
      out[k].push(item)
    }
  } else {
    for (const items of out) for (const item of items) delete item.order
  }
  return { kit, out }
}

function Pieza({ name, theme, items }) {
  const geo = useModelo(name)
  const mat = triplanarMaterial(theme, categoriaModelo(name), { glow: GLOW[theme] ?? 0.04 })
  return <Instanced geo={geo} mat={mat} items={items} />
}

export default function Decor({ way }) {
  const { kit, out } = useMemo(() => buildItems(way), [way])
  return kit.flatMap(([name], k) => out[k].length ? [<Pieza key={k} name={name} theme={way.theme.id} items={out[k]} />] : [])
}
