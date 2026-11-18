// Rebotantes y decoración temática del bioma (kit GLB con texturas embebidas):
// rebote_<tema> en los puntos de salto de switches y bordes de calzada, más deco_<tema>_hito,
// deco_<tema>_flora, farola_pista y banderin colocados en la berma sin invadir otras pistas.
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, getWayDetail, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { precargarKit, useKit } from '../Modelos.jsx'
import { colisionDe, colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, bermY, halfWidth, laneSideClear, lanesOf, surfFrame } from './pista.jsx'
import { TRACK_K } from '../../../Core/world.js'

const KIT_THEMES = new Set(['sombrio', 'bosque', 'mar', 'desierto', 'hielo', 'volcan', 'cristal', 'nubes', 'neon', 'jardin'])
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Q_Y180 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI)
const SPACING = 3.0 * TRACK_K // ~14 u entre piezas de berma
const MAX_REBOTES_JUMP = 16
const MAX_REBOTES_SIDE = 10
const MAX_DECO_TOTAL = 180 // InstanceCuller recorta >= 48 a 60 u

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
  const col = world ? colisionDe(world) : null
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
      const wSc = THREE.MathUtils.clamp(H * 1.35, 0.85, 1.45)
      const hSc = THREE.MathUtils.clamp(H * 0.9, 0.68, 1.15)
      rebotesJump.push({
        pos: f.pos.clone().addScaledVector(f.up, -0.01),
        quat: basisQuat(f.up, f.tangent),
        scale: [wSc, hSc, wSc],
      })
    }

    // 2) Decoración continua en las bermas (proporcional al ancho de la calzada)
    for (const lane of lanes) {
      const H = halfWidth(lane)
      const E = H + CURB
      const widthK = Math.max(1, H / 2.45)
      const busy = (seg.switches ?? [])
        .filter((w) => w.from === lane.id || w.to === lane.id)
        .map((w) => w.u * L)

      let altSide = rng() < 0.5 ? -1 : 1
      for (let s = 5; s < L - 5; s += SPACING * (0.78 + rng() * 0.44)) {
        if (busy.some((b) => Math.abs(b - s) < 4.5)) continue

        const u = s / L
        const f = surfFrame(seg, lane.id, u, F)

        altSide = -altSide
        const sideSign = rng() < 0.8 ? altSide : -altSide
        const pick = rng()
        let kind = 'flora'
        let sc = (1.35 + rng() * 0.65) * widthK
        let rad = 0.34 * sc
        if (pick < 0.06 && rebotesSide.length < MAX_REBOTES_SIDE * 2) {
          kind = 'rebote'
          sc = (1.25 + rng() * 0.35) * widthK
          rad = 0.42 * sc
        } else if (pick < 0.24) {
          kind = 'farola'
          sc = (1.85 + rng() * 0.45) * widthK
          rad = 0.28 * sc
        } else if (pick < 0.36) {
          kind = 'banderin'
          sc = (1.75 + rng() * 0.45) * widthK
          rad = 0.26 * sc
        } else if (pick < 0.68) {
          kind = 'hito'
          sc = (1.45 + rng() * 0.75) * widthK
          rad = 0.34 * sc
        }

        const room = TERR + 0.16
        const ax = E + Math.min(room * 0.76, Math.max(0.32, rad * 0.55 + rng() * Math.max(0, room - rad * 1.2)))
        const o = f.pos.clone()
        const side = f.side.clone()
        const up = f.up.clone()
        const rChk = rad * 0.65
        let pos = null
        let chosenSign = sideSign
        for (const sgn of [sideSign, -sideSign]) {
          const cand = o.clone().addScaledVector(side, sgn * ax).addScaledVector(up, bermY(ax, E) - 0.025)
          if (!laneSideClear(seg, lane, u, cand, 0.35)) continue
          if (col && !col.libre(cand, rChk, { way: way.idx })) continue
          if (!local.libre(cand, rChk)) continue
          pos = colocar(world, { pos: cand, seed: way.idx * 9719 + si * 131 + lane.id * 17 + Math.floor(s * 10) }, rChk, { way: way.idx }, 0, local)
          if (pos) { chosenSign = sgn; break }
        }
        if (!pos) continue

        let quat = basisQuat(up, f.tangent)
        if (kind === 'farola' || kind === 'banderin') {
          if (chosenSign > 0) quat = quat.multiply(Q_Y180)
        } else {
          quat = quat.multiply(YAW.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2))
        }

        if (kind === 'rebote') rebotesSide.push({ pos, quat, scale: sc })
        else decoCands.push({ kind, pos, quat, scale: sc })
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
    if (solidRef.current && detail) solidRef.current.visible = detail.value >= 0.25
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
