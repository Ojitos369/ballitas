// Miniaturas 2D ligeras (Canvas 2D en DataURL o SVG) para tarjetas de planeta, ruta y carril.
// Evita montar múltiples <Canvas> de WebGL/Three en el selector.
import { CARRILES, mulberry32 } from '../../Core/world.js'

const planetaCache = new Map()
const rutaCache = new Map()

function hexToRgb(hex) {
  const clean = String(hex || '#8aa7ff').replace('#', '')
  const n = parseInt(clean.length === 3 ? clean.replace(/(.)/g, '$1$1') : clean, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

/**
 * Genera y cachea una miniatura 2D del planeta (esfera sombreada con color + iconos de sus edificios).
 */
export function previewPlaneta(node, theme) {
  if (!node) return ''
  const key = `${node.idx}:${theme?.id || ''}`
  if (planetaCache.has(key)) return planetaCache.get(key)
  if (typeof document === 'undefined') return ''

  const w = 132
  const h = 76
  const canvas = document.createElement('canvas')
  canvas.width = w * 2
  canvas.height = h * 2
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  ctx.scale(2, 2)

  const cx = w * 0.5
  const cy = h * 0.52
  const R = 24
  const { r, g, b } = hexToRgb(node.color)

  // Halo atmosférico suave
  const halo = ctx.createRadialGradient(cx, cy, R * 0.7, cx, cy, R * 1.65)
  halo.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.35)`)
  halo.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`)
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, w, h)

  // Anillo orbital sutil del camino
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(-0.24)
  ctx.beginPath()
  ctx.ellipse(0, 0, R * 1.48, R * 0.44, 0, 0, Math.PI * 2)
  ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, 0.32)`
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.restore()

  // Esfera con sombreado 3D simulado
  const grad = ctx.createRadialGradient(cx - R * 0.34, cy - R * 0.36, R * 0.12, cx, cy, R)
  grad.addColorStop(0, `rgb(${Math.min(255, r + 65)}, ${Math.min(255, g + 65)}, ${Math.min(255, b + 65)})`)
  grad.addColorStop(0.65, `rgb(${r}, ${g}, ${b})`)
  grad.addColorStop(1, `rgb(${Math.round(r * 0.28)}, ${Math.round(g * 0.28)}, ${Math.round(b * 0.36)})`)

  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.fillStyle = grad
  ctx.fill()

  // Cráteres/manchas suaves deterministas
  const rng = mulberry32(1000 + (node.idx ?? 0) * 97)
  ctx.save()
  ctx.beginPath()
  ctx.arc(cx, cy, R, 0, Math.PI * 2)
  ctx.clip()
  for (let i = 0; i < 6; i++) {
    const px = cx + (rng() - 0.5) * R * 1.4
    const py = cy + (rng() - 0.5) * R * 1.4
    const pr = 3 + rng() * 6
    ctx.beginPath()
    ctx.arc(px, py, pr, 0, Math.PI * 2)
    ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.14)'
    ctx.fill()
  }
  ctx.restore()

  // Emojis de los edificios (puntos ⭐ y energía ⚡) alrededor del planeta
  const destinos = (node.destinos || []).slice(0, 6)
  ctx.font = '11px system-ui, "Segoe UI Emoji", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  destinos.forEach((d, i) => {
    const a = -Math.PI * 0.8 + (i / Math.max(1, destinos.length - 1)) * Math.PI * 1.6
    const rx = cx + Math.cos(a) * (R + 14)
    const ry = cy + Math.sin(a) * (R + 8)
    ctx.fillText(d.kind === 'puntos' ? '⭐' : '⚡', rx, ry)
  })

  const url = canvas.toDataURL('image/png')
  planetaCache.set(key, url)
  return url
}

const THEME_HEX = {
  sombrio: '#9b7bff',
  bosque: '#5be38c',
  mar: '#38bdf8',
  desierto: '#f5b041',
  hielo: '#99f6ff',
  volcan: '#ff6b57',
  cristal: '#e879f9',
  nubes: '#cbd5e1',
  neon: '#22d3ee',
  jardin: '#f472b6',
}

export function themeColor(themeId) {
  return THEME_HEX[themeId] || '#8aa7ff'
}

/**
 * Proyecta `route.segments[].curve` a una polilínea SVG 2D (cacheada por `route.idx`).
 */
export function previewRuta(route, way, world) {
  if (!route) return null
  if (rutaCache.has(route.idx)) return rutaCache.get(route.idx)

  const fromPos = world?.nodes?.[way?.from]?.pos
  const toPos = world?.nodes?.[way?.to]?.pos

  // Ejes locales de proyección: X = de origen a destino, Y = altura/desvío perpendicular
  let ax = { x: 1, y: 0, z: 0 }
  if (fromPos && toPos) {
    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const dz = toPos.z - fromPos.z
    const len = Math.hypot(dx, dy, dz) || 1
    ax = { x: dx / len, y: dy / len, z: dz / len }
  }
  // Eje lateral perpendicular en XZ + componente Y para ver elevación y panza a la vez
  const sideLen = Math.hypot(-ax.z, ax.x) || 1
  const sx = -ax.z / sideLen
  const sz = ax.x / sideLen

  const pts = []
  const segMarks = []
  for (const seg of route.segments || []) {
    if (!seg.curve?.getPoint) continue
    const steps = 8
    for (let i = 0; i < steps; i++) {
      const p = seg.curve.getPoint(i / steps)
      const ox = fromPos ? p.x - fromPos.x : p.x
      const oy = fromPos ? p.y - fromPos.y : p.y
      const oz = fromPos ? p.z - fromPos.z : p.z
      const px = ox * ax.x + oy * ax.y + oz * ax.z
      const py = oy * 0.72 + (ox * sx + oz * sz) * 0.55
      pts.push([px, -py])
      if (i === 4 && (seg.event || seg.air)) {
        segMarks.push({ pt: [px, -py], emoji: seg.emoji, air: !!seg.air })
      }
    }
  }
  const lastSeg = route.segments?.at(-1)
  if (lastSeg?.curve?.getPoint) {
    const p = lastSeg.curve.getPoint(1)
    const ox = fromPos ? p.x - fromPos.x : p.x
    const oy = fromPos ? p.y - fromPos.y : p.y
    const oz = fromPos ? p.z - fromPos.z : p.z
    pts.push([ox * ax.x + oy * ax.y + oz * ax.z, -(oy * 0.72 + (ox * sx + oz * sz) * 0.55)])
  }

  if (!pts.length) return null

  let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  const W = 132
  const H = 64
  const pad = 10
  const spanX = Math.max(1e-3, maxX - minX)
  const spanY = Math.max(1e-3, maxY - minY)
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY)
  const offX = (W - spanX * scale) * 0.5 - minX * scale
  const offY = (H - spanY * scale) * 0.5 - minY * scale
  const mapPt = ([x, y]) => [+(x * scale + offX).toFixed(1), +(y * scale + offY).toFixed(1)]

  const mapped = pts.map(mapPt)
  const d = mapped.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x},${y}`).join(' ')
  const marks = segMarks.map((m) => ({ ...m, pt: mapPt(m.pt) }))

  const res = {
    d,
    start: mapped[0],
    end: mapped[mapped.length - 1],
    marks,
    color: themeColor(way?.theme?.id),
    width: W,
    height: H,
  }
  rutaCache.set(route.idx, res)
  return res
}

/**
 * Datos geométricos para el corte SVG de 5 carriles con el elegido resaltado.
 */
export function datosVistaCarril(c) {
  return {
    total: CARRILES,
    elegido: c,
  }
}
