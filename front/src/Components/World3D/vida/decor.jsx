// Rebotantes y decoración temática del bioma (kit GLB con texturas embebidas):
// rebote_<tema> en los puntos de salto de switches y bordes de calzada, más deco_<tema>_hito,
// deco_<tema>_flora, farola_pista y banderin colocados en la berma con colocar() sin invadir otras pistas.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, bermaAjusta, getWayDetail, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { precargarKit, useKit } from '../Modelos.jsx'
import { colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, halfWidth, lanesOf, surfFrame } from './pista.jsx'
import { TRACK_K } from '../../../Core/world.js'

const KIT_THEMES = new Set(['sombrio', 'bosque', 'mar', 'desierto', 'hielo', 'volcan', 'cristal', 'nubes', 'neon', 'jardin'])
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Q_Y180 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI)
const SPACING = 3.2 * TRACK_K
const MAX_REBOTES_JUMP = 12
const MAX_REBOTES_SIDE = 4
const MAX_DECO_TOTAL = 42 // hito + flora + farola + banderin (+ <=16 rebotes => <= 58 kit instancias en decor)

// Altura de la berma en |x| (mismo perfil que pista.jsx)
function bermY(ax, E) {
  const t = Math.max(0, Math.min(1, (ax - E) / TERR))
  return t < 0.5 ? 0.025 + (0.06 - 0.025) * (t / 0.5) : 0.06 - 0.22 * ((t - 0.5) / 0.5)
}

function capStride(arr, max) {
  if (arr.length <= max) return arr
  const out = []
  const step = arr.length / max
  for (let i = 0; i < max; i++) out.push(arr[Math.floor(i * step)])
  return out
}

const decorCache = new WeakMap()
const F = {}
const YAW = new THREE.Quaternion()

function buildDecorData(way) {
  if (decorCache.has(way)) return decorCache.get(way)
  const rawTheme = way.theme?.id
  const theme = KIT_THEMES.has(rawTheme) ? rawTheme : 'bosque'
  const rng = mulberry32(7717 + way.idx * 97)
  const world = mundoDe(way)
  const local = nuevoLocal()

  let rebotesJump = []
  const rebotesSide = []
  const seenJump = new Set()
  const decoCands = []

  way.segments?.forEach((seg, si) => {
    if (seg.air) return
    const L = Math.max(seg.length ?? 1, 1)
    const lanes = lanesOf(seg)

    // 1) Rebotantes en el punto de salto de los switches (style === 'salto')
    for (const sw of seg.switches ?? []) {
      if (sw.style && sw.style !== 'salto') continue
      const lane = lanes.find((l) => l.id === sw.from)
      if (!lane) continue
      const key = `${si}:${lane.id}:${Math.round(sw.u * 1000)}`
      if (seenJump.has(key)) continue
      seenJump.add(key)
      const f = surfFrame(seg, lane.id, sw.u, F)
      const H = halfWidth(lane)
      const wSc = THREE.MathUtils.clamp(H * 1.35, 0.72, 1.15)
      const hSc = THREE.MathUtils.clamp(H * 0.9, 0.58, 0.95)
      rebotesJump.push({
        pos: f.pos.clone().addScaledVector(f.up, -0.01),
        quat: basisQuat(f.up, f.tangent),
        scale: [wSc, hSc, wSc],
      })
    }

    // 2) Decoración del bioma (hito, flora, farola_pista, banderin) y algunos rebotes laterales en bermas
    for (const lane of lanes) {
      const H = halfWidth(lane)
      const E = H + CURB
      const busy = (seg.switches ?? [])
        .filter((w) => w.from === lane.id || w.to === lane.id)
        .map((w) => w.u * L)

      for (let s = 5; s < L - 5; s += SPACING * (0.75 + rng() * 0.55)) {
        const zone = 0.5 + 0.5 * Math.sin(s * 0.05 + si * 1.9 + lane.id * 1.3)
        if (rng() > 0.14 + 0.55 * zone * zone) continue
        if (busy.some((b) => Math.abs(b - s) < 4.5)) continue

        const u = s / L
        const f = surfFrame(seg, lane.id, u, F)
        // Evitar amontonar si los carriles están juntos en los extremos del tramo
        if (lane.id !== lanes[0].id) {
          const f0 = surfFrame(seg, lanes[0].id, u, {})
          if (f.pos.distanceToSquared(f0.pos) < (E * 2.3) ** 2) continue
        }

        const sideSign = rng() < 0.5 ? -1 : 1
        const pick = rng()
        let kind = 'flora'
        let sc = 0.65 + rng() * 0.35
        let rad = 0.34 * sc
        if (pick < 0.09 && rebotesSide.length < MAX_REBOTES_SIDE * 2) {
          kind = 'rebote'
          sc = 0.78 + rng() * 0.18
          rad = 0.42 * sc
        } else if (pick < 0.21) {
          kind = 'farola'
          sc = 0.95 + rng() * 0.22
          rad = 0.28 * sc
        } else if (pick < 0.31) {
          kind = 'banderin'
          sc = 0.9 + rng() * 0.25
          rad = 0.26 * sc
        } else if (pick < 0.64) {
          kind = 'hito'
          sc = 0.68 + rng() * 0.36
          rad = 0.34 * sc
        }

        const room = TERR + 0.12
        const ax = E + Math.min(room * 0.72, Math.max(0.24, rad + rng() * Math.max(0, room - rad * 2)))
        const x = sideSign * ax
        const o = f.pos.clone()
        const side = f.side.clone()
        const up = f.up.clone()
        const at = (xx) => o.clone().addScaledVector(side, xx).addScaledVector(up, bermY(Math.abs(xx), E) - 0.025)
        const ajusta = bermaAjusta(o, side, up, E, TERR, rad)
        const seed = way.idx * 9719 + si * 131 + lane.id * 17 + Math.floor(s * 10)
        const pos = colocar(world, { pos: at(x), seed, ajusta }, rad, { way: way.idx, si, lane: lane.id }, 4, local)
        if (!pos) continue

        let quat = basisQuat(up, f.tangent)
        if (kind === 'farola' || kind === 'banderin') {
          if (sideSign > 0) quat = quat.multiply(Q_Y180)
        } else {
          quat = quat.multiply(YAW.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2))
        }

        if (kind === 'rebote') {
          rebotesSide.push({ pos, quat, scale: sc })
        } else {
          decoCands.push({ kind, pos, quat, scale: sc })
        }
      }
    }
  })

  rebotesJump = capStride(rebotesJump, MAX_REBOTES_JUMP)
  const rebotes = [...rebotesJump, ...capStride(rebotesSide, MAX_REBOTES_SIDE)]
  const decos = capStride(decoCands, MAX_DECO_TOTAL)

  const hito = []
  const flora = []
  const farola = []
  const banderin = []
  for (const d of decos) {
    const item = { pos: d.pos, quat: d.quat, scale: d.scale }
    if (d.kind === 'hito') hito.push(item)
    else if (d.kind === 'flora') flora.push(item)
    else if (d.kind === 'farola') farola.push(item)
    else banderin.push(item)
  }

  const out = {
    theme,
    names: {
      rebote: `rebote_${theme}`,
      hito: `deco_${theme}_hito`,
      flora: `deco_${theme}_flora`,
    },
    rebotes,
    hito,
    flora,
    farola,
    banderin,
  }
  decorCache.set(way, out)
  return out
}

function KitPieza({ nombre, items }) {
  const kit = useKit(nombre)
  if (!kit || !items.length) return null
  return <Instanced geo={kit.geometry} mat={kit.material} items={items} receiveShadow />
}

export default function Decor({ way }) {
  const data = useMemo(() => buildDecorData(way), [way])
  const { names, rebotes, hito, flora, farola, banderin } = data
  useEffect(() => {
    precargarKit([names.rebote, names.hito, names.flora, 'farola_pista', 'banderin'])
  }, [names])

  const detail = getWayDetail(way)
  const solidRef = useRef()
  useFrame(() => {
    if (solidRef.current && detail) solidRef.current.visible = detail.value >= 0.3
  })

  return (
    <group ref={solidRef}>
      <KitPieza nombre={names.rebote} items={rebotes} />
      <KitPieza nombre={names.hito} items={hito} />
      <KitPieza nombre={names.flora} items={flora} />
      <KitPieza nombre="farola_pista" items={farola} />
      <KitPieza nombre="banderin" items={banderin} />
    </group>
  )
}
