// Decoración temática de la berma de cada carril: modelos de public/models apoyados en el terreno y
// orientados con la gravedad de ESE carril, con ritmo (zonas calmas y zonas con algo) y la calzada libre.
import { useMemo } from 'react'
import * as THREE from 'three'
import { Instanced, markShared, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { useModelo } from './modelos.js'
import { CURB, TERR, halfWidth, lanesOf, surfFrame } from './pista.jsx'

// [modelo, escala mín, escala máx, medio ancho a escala 1, tinte]
const KITS = {
  bosque: [['pine', 1.6, 2.8, 0.24, '#ffffff'], ['tree', 1.3, 2.2, 0.35, '#ffffff'], ['mushroom', 0.35, 0.7, 0.45, '#ffffff'], ['rock', 0.25, 0.55, 0.67, '#ffffff']],
  volcan: [['rock', 0.6, 1.3, 0.67, '#6b4a40'], ['monolith', 0.9, 1.7, 0.34, '#5a3a30'], ['crystal', 0.4, 0.8, 0.35, '#ff8a50']],
  mar: [['coral', 0.6, 1.2, 0.26, '#ffffff'], ['palm', 1.6, 2.4, 0.45, '#ffffff'], ['rock', 0.3, 0.6, 0.67, '#e8dcc0']],
  hielo: [['ice_spire', 1, 2.2, 0.23, '#ffffff'], ['pine', 1.2, 2, 0.24, '#dff2ff'], ['rock', 0.3, 0.6, 0.67, '#cfe6ff']],
  desierto: [['cactus', 0.9, 1.8, 0.35, '#ffffff'], ['pyramid', 0.7, 1.4, 0.39, '#ffffff'], ['rock', 0.3, 0.7, 0.67, '#e0a070']],
  cristal: [['crystal', 0.7, 1.8, 0.35, '#ffffff'], ['monolith', 0.9, 1.6, 0.34, '#b8a8ff'], ['crystal', 0.3, 0.6, 0.35, '#9ffcff']],
  nubes: [['cloud', 0.5, 1, 1.05, '#ffffff'], ['flower', 0.4, 0.7, 0.32, '#ffffff'], ['torii', 1.1, 1.6, 0.53, '#ffd1e8']],
  neon: [['lamp', 1.2, 1.8, 0.26, '#ffffff'], ['pylon', 1.1, 1.8, 0.37, '#c8fff8'], ['pod', 0.5, 0.9, 0.38, '#ffffff']],
  jardin: [['flower', 0.5, 1, 0.32, '#ffffff'], ['tree', 1.3, 2, 0.35, '#e8ffe0'], ['mushroom', 0.4, 0.7, 0.45, '#ffffff']],
  sombrio: [['tomb', 0.6, 1, 0.24, '#ffffff'], ['mushroom', 0.5, 0.9, 0.45, '#d9b8ff'], ['tree', 1.3, 2, 0.35, '#6b5a8a']],
}
const GLOW = { neon: 0.5, cristal: 0.2, sombrio: 0.12 }
const SPACING = 2.6

const matCache = new Map()
function decorMat(themeId) {
  if (matCache.has(themeId)) return matCache.get(themeId)
  const m = new THREE.MeshLambertMaterial({ color: '#ffffff', vertexColors: true })
  const glow = { value: GLOW[themeId] ?? 0.04 }
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uGlow = glow
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uGlow;')
  }
  m.customProgramCacheKey = () => 'decor-v1'
  matCache.set(themeId, markShared(m))
  return m
}

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
        const pos = f.pos.clone().addScaledVector(f.side, x).addScaledVector(f.up, bermY(ax, E) - 0.03)
        const quat = basisQuat(f.up, f.tangent).multiply(YAW.setFromAxisAngle(Yv, rng() * Math.PI * 2))
        const c = new THREE.Color(tint).multiplyScalar(0.85 + rng() * 0.25)
        out[k].push({ pos, quat, scale: sc, color: c })
      }
    }
  })
  return { kit, out }
}

function Pieza({ name, mat, items }) {
  const geo = useModelo(name)
  return <Instanced geo={geo} mat={mat} items={items} />
}

export default function Decor({ way }) {
  const { kit, out } = useMemo(() => buildItems(way), [way])
  const mat = decorMat(way.theme.id)
  return kit.map(([name], k) => <Pieza key={k} name={name} mat={mat} items={out[k]} />)
}
