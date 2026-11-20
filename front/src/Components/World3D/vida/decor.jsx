// Rebotantes y decoración temática del bioma (kit GLB con texturas embebidas):
// rebote_<tema> en los puntos de salto de switches y bordes de calzada, más deco_<tema>_hito,
// deco_<tema>_flora, farola_pista y banderin colocados en la berma sin invadir otras pistas.
import { registrarOlvido, liberarGeos } from './etapas.js' // MEM: cachés por camino acotadas
import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Instanced, getWayDetail, minSegDistSq, mulberry32 } from './base.jsx'
import { basisQuat } from './dyn.js'
import { precargarKit, useKit } from '../Modelos.jsx'
import { colisionDe, colocar, mundoDe, nuevoLocal } from '../colisionObjetos.js'
import { CURB, TERR, bermY, halfWidth, laneSideClear, lanesOf, surfFrame } from './pista.jsx'
import { TRACK_K } from '../../../Core/world.js'

const KIT_THEMES = new Set(['sombrio', 'bosque', 'mar', 'desierto', 'hielo', 'volcan', 'cristal', 'nubes', 'neon', 'jardin'])
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const Q_Y180 = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI)
const SPACING = 4 * TRACK_K // ~19 u entre hitos/farolas/banderines, proporcional a la longitud
const FLORA_SPACING = 4 * TRACK_K // ~19 u entre puntos de flora: continuidad sin multiplicar instancias por 5
const MAX_REBOTES_JUMP = 16
const MAX_REBOTES_SIDE = 10

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

/** Piezas del kit que monta la decoración de `way` (para cargarlas y compilarlas antes de entrar). */
export function decorKit(way) {
  const t = KIT_THEMES.has(way.theme?.id) ? way.theme.id : 'bosque'
  return [`rebote_${t}`, `deco_${t}_hito`, `deco_${t}_flora`, 'farola_pista', 'banderin']
}

const decorGens = new WeakMap() // way -> generador a medias (precarga por porciones, vida/precarga.js)
// MEM: olvida la decoración de un camino lejano
registrarOlvido((way) => { liberarGeos(decorCache.get(way)); decorCache.delete(way); decorGens.delete(way) })
const NUNCA = () => false

/** Avanza la decoración de `way` hasta que `agotado()` diga basta; true cuando quedó en caché. Mismo orden y
 *  mismo rng que de un tirón: solo se reparte entre cuadros/huecos libres. */
export function decorPaso(way, agotado) {
  if (decorCache.has(way)) return true
  let g = decorGens.get(way)
  if (!g) { g = decorGen(way); decorGens.set(way, g) }
  for (;;) {
    const r = g.next()
    if (r.done) { decorGens.delete(way); decorCache.set(way, r.value); return true }
    if (agotado()) return false
  }
}

function buildDecorData(way) {
  decorPaso(way, NUNCA)
  return decorCache.get(way)
}

export function datosDecoracionMedidos(way) {
  return buildDecorData(way).coverage
}

// Los `yield` van al final de cada muestra: el marco compartido F no se usa a medias entre dos reanudaciones.
function* decorGen(way) {
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
  const floraCands = []
  const coverage = []

  const segsW = way.segments ?? []
  for (let si = 0; si < segsW.length; si++) {
    const seg = segsW[si]
    if (seg.air) continue
    const L = Math.max(seg.length ?? 1, 1)
    const lanes = lanesOf(seg)
    const coverageSeg = { si, length: L, decor: [], flora: [], lanes: lanes.map((l) => ({ lane: l.id, decor: [], flora: [] })), descartes: { ocupada: 0, otraPista: 0, local: 0, lado: 0 } }
    coverage.push(coverageSeg)

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
    for (let li = 0; li < lanes.length; li++) {
      const lane = lanes[li]
      const laneCoverage = coverageSeg.lanes[li]
      const H = halfWidth(lane)
      const E = H + CURB
      const widthK = Math.max(1, H / 2.45)
      const busy = (seg.switches ?? [])
        .filter((w) => w.from === lane.id || w.to === lane.id)
        .map((w) => w.u * L)

      let altSide = rng() < 0.5 ? -1 : 1
      for (let s = 5; s < L - 5; s += SPACING * (0.78 + rng() * 0.44)) {
        if (busy.some((b) => Math.abs(b - s) < 4.5)) { coverageSeg.descartes.ocupada++; continue }

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
        let vioLado = false; let vioPista = false; let vioLocal = false
        for (const sgn of [sideSign, -sideSign]) {
          const cand = o.clone().addScaledVector(side, sgn * ax).addScaledVector(up, bermY(ax, E) - 0.025)
          if (!laneSideClear(seg, lane, u, cand, 0.35)) { vioLado = true; continue }
          if (col && !col.libre(cand, rChk, { way: way.idx })) { vioPista = true; continue }
          if (!local.libre(cand, rChk)) { vioLocal = true; continue }
          pos = colocar(world, { pos: cand, seed: way.idx * 9719 + si * 131 + lane.id * 17 + Math.floor(s * 10) }, rChk, { way: way.idx }, 0, local)
          if (pos) { chosenSign = sgn; break }
        }
        if (!pos) {
          if (vioPista) coverageSeg.descartes.otraPista++
          else if (vioLocal) coverageSeg.descartes.local++
          else if (vioLado) coverageSeg.descartes.lado++
          continue
        }

        let quat = basisQuat(up, f.tangent)
        if (kind === 'farola' || kind === 'banderin') {
          if (chosenSign > 0) quat = quat.multiply(Q_Y180)
        } else {
          quat = quat.multiply(YAW.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2))
        }

        if (kind === 'rebote') rebotesSide.push({ pos, quat, scale: sc })
        else decoCands.push({ kind, pos, quat, scale: sc })
        coverageSeg.decor.push({ s, kind, lane: lane.id })
        laneCoverage.decor.push(s)
        yield
      }

      // 3) Flora densa en ambas bermas a lo largo de todo el tramo
      for (let s = 3.2; s < L - 3.2; s += FLORA_SPACING * (0.8 + rng() * 0.4)) {
        if (busy.some((b) => Math.abs(b - s) < 3.6)) { coverageSeg.descartes.ocupada++; continue }
        const u = s / L
        const f = surfFrame(seg, lane.id, u, F)
        const o = f.pos.clone()
        const side = f.side.clone()
        const up = f.up.clone()
        const baseQuat = basisQuat(up, f.tangent)
        for (const sgn of [-1, 1]) {
          if (rng() > 0.86) continue
          const sc = (1.25 + rng() * 0.95) * widthK
          const rChk = 0.24 * sc
          const ax = E + 0.24 + rng() * Math.max(0.15, TERR * 0.82 - 0.24)
          const cand = o.clone().addScaledVector(side, sgn * ax).addScaledVector(up, bermY(ax, E) - 0.03)
          if (!laneSideClear(seg, lane, u, cand, 0.3)) { coverageSeg.descartes.lado++; continue }
          if (col && !col.libre(cand, rChk, { way: way.idx })) { coverageSeg.descartes.otraPista++; continue }
          if (!local.libre(cand, rChk)) { coverageSeg.descartes.local++; continue }
          const pos = colocar(world, { pos: cand, seed: way.idx * 14983 + si * 211 + lane.id * 31 + Math.floor(s * 13) + (sgn > 0 ? 5 : 0) }, rChk, { way: way.idx }, 0, local)
          if (!pos) continue
          const quat = baseQuat.clone().multiply(YAW.setFromAxisAngle(Y_AXIS, rng() * Math.PI * 2))
          floraCands.push({ pos, quat, scale: sc })
          coverageSeg.flora.push({ s, lane: lane.id })
          laneCoverage.flora.push(s)
        }
        yield
      }
    }
  }

  rebotesJump = capStride(rebotesJump, MAX_REBOTES_JUMP)
  const rebotes = [...rebotesJump, ...capStride(rebotesSide, MAX_REBOTES_SIDE)]
  // No limitar por camino: los primeros tramos no deben consumir el cupo de los siguientes.
  // InstanceCuller conserva el coste de dibujo acotado a las piezas cercanas.
  const decos = decoCands

  const hito = []
  const flora = floraCands
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
    coverage,
  }
  return out
}

// Ruta enfocada: la generación es completa por longitud, pero lo DIBUJADO se acota por distancia a la cámara.
// Hasta DRAW_NEAR (×K en el cono delantero) se dibuja todo; de ahí a DRAW_FAR solo 1 de cada `stride`
// (la flora tiene ~2 matas por punto y paso ~19 u: 1/4 deja ~45 u; las piezas de berma se reparten entre tres
// kits: 1/2 deja ~40 u entre piezas combinadas). Así no hay huecos de más de 150 u en ~300 u por delante.
const DRAW_NEAR = 45
const DRAW_FAR = 110

function KitPieza({ nombre, items, focused, stride = 2 }) {
  const kit = useKit(nombre)
  if (!kit || !items.length) return null
  return (
    <Instanced geo={kit.geometry} mat={kit.material} items={items} receiveShadow
      cullRadius={focused ? DRAW_FAR : null} cullBorder={focused ? 0.98 : null}
      cullNear={focused ? DRAW_NEAR : null} cullStride={focused ? stride : null} />
  )
}

export default function Decor({ way, focused }) {
  const data = useMemo(() => buildDecorData(way), [way])
  const { names, rebotes, hito, flora, farola, banderin } = data
  useEffect(() => {
    precargarKit([names.rebote, names.hito, names.flora, 'farola_pista', 'banderin'])
  }, [names])

  const detail = getWayDetail(way)
  const solidRef = useRef()
  const camera = useThree((s) => s.camera)
  const nonAirSegs = useMemo(() => (way.segments ?? []).filter((s) => !s.air), [way])
  const lastCam = useRef(new THREE.Vector3(Infinity, 0, 0))
  const nearRef = useRef(true)
  useFrame(() => {
    if (!solidRef.current) return
    const det = detail ? detail.value : 1
    if (det < (focused ? 0.25 : 0.45)) { solidRef.current.visible = false; return }
    const cam = camera.position
    if (cam.distanceToSquared(lastCam.current) >= 100) {
      lastCam.current.copy(cam)
      let best = Infinity
      for (let i = 0; i < nonAirSegs.length; i++) {
        const d2 = minSegDistSq(nonAirSegs[i], cam)
        if (d2 < best) best = d2
      }
      nearRef.current = best <= (focused ? 310 * 310 : 62 * 62)
    }
    solidRef.current.visible = nearRef.current
  })

  return (
    <group ref={solidRef}>
      <KitPieza nombre={names.rebote} items={rebotes} focused={focused} />
      <KitPieza nombre={names.hito} items={hito} focused={focused} />
      <KitPieza nombre={names.flora} items={flora} focused={focused} stride={4} />
      <KitPieza nombre="farola_pista" items={farola} focused={focused} />
      <KitPieza nombre="banderin" items={banderin} focused={focused} />
    </group>
  )
}
