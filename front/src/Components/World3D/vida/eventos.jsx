// Eventos de cambio de camino por CARRIL (world.js: CARRILES, carrilLat, switchPath): cada evento se marca sobre su
// carril (no en todo el ancho) con marcas de carril, la pieza del kit de su tipo, su trayectoria (puntos de la parábola,
// caída o laberinto, haz del elevador, par de portales enlazados) y el anillo de aterrizaje en el camino destino.
// Todo instanciado por camino, geometrías y materiales en caché de módulo, un solo useFrame por camino y LOD a detalle bajo.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import * as WORLD from '../../../Core/world.js'
import { getBallitas, getWayDetail, Instanced, markShared, mergePlainParts, vidaSharedMats, writeInstance } from './base.jsx'
import { FOCO } from '../mundos/foco.js'
import { basisQuat } from './dyn.js'
import { precargarKit, useKit } from '../Modelos.jsx'
import { halfWidth, pal, surfFrame } from './pista.jsx'
import { TRACK_K } from '../../../Core/world.js'

const Z_AXIS = new THREE.Vector3(0, 0, 1)
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const ARC_DOTS = 6
const TRAIL = 8

// Color de cada tipo de evento (chevrones, trayectoria, anillos): así se leen los tipos de lejos.
const KIND_COL = {
  salto: '#ffd84a', rampa: '#ffa53a', botado: '#ff5fd2', caida: '#9b6bff', portal: '#3ff0ff',
  elevador: '#6dff8a', laberinto: '#ff6b6b', geiser: '#4fe3ff', erupcion: '#ff7430', tirolina: '#a8ff60',
}
const kindColor = (kind, k = 1.5) => new THREE.Color(KIND_COL[kind] ?? '#ffffff').multiplyScalar(k)
// Pieza del kit que ocupa el carril en el punto del evento.
const kitDe = (kind, theme) => (kind === 'botado' ? `rebote_${theme}` : kind === 'portal' ? 'anillo_neon_lod'
  : kind === 'elevador' ? 'pilar' : kind === 'laberinto' ? 'barrera_lod' : kind === 'caida' ? null : 'turbo_placa')

// ═══════════════════════════ GEOMETRÍAS (caché de módulo) ═══════════════════════════
const G = {
  sphere: markShared(new THREE.SphereGeometry(1, 7, 5)),
  chevron: mergePlainParts([
    new THREE.BoxGeometry(0.12, 0.03, 0.46).rotateY(0.58).translate(-0.13, 0.015, 0),
    new THREE.BoxGeometry(0.12, 0.03, 0.46).rotateY(-0.58).translate(0.13, 0.015, 0),
  ], 'eventos:chevron'),
  dash: markShared(new THREE.BoxGeometry(0.06, 0.02, 1).translate(0, 0.01, 0)),
  ring: markShared(new THREE.TorusGeometry(0.42, 0.04, 5, 14).rotateX(Math.PI / 2).scale(1, 0.42, 1)),
  hole: markShared(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 14).translate(0, 0.015, 0)),
  dot: markShared(new THREE.ConeGeometry(0.1, 0.26, 4).rotateX(Math.PI / 2)),
  beam: markShared(new THREE.CylinderGeometry(0.09, 0.09, 1, 6, 1, true).translate(0, 0.5, 0)),
  swirl: mergePlainParts([
    new THREE.TorusGeometry(0.42, 0.035, 4, 16, Math.PI * 1.2),
    new THREE.TorusGeometry(0.26, 0.03, 4, 12, Math.PI * 1.2).rotateZ(Math.PI),
  ], 'eventos:swirl'),
  icon: {
    salto: markShared(new THREE.ConeGeometry(0.28, 0.62, 5)), rampa: markShared(new THREE.ConeGeometry(0.34, 0.52, 4).rotateZ(-Math.PI / 3)),
    botado: markShared(new THREE.SphereGeometry(0.28, 8, 6)), caida: markShared(new THREE.TorusGeometry(0.27, 0.07, 5, 12)),
    portal: markShared(new THREE.TorusGeometry(0.28, 0.07, 5, 12)), elevador: markShared(new THREE.CylinderGeometry(0.2, 0.2, 0.58, 6)),
    laberinto: markShared(new THREE.BoxGeometry(0.5, 0.5, 0.16)), geiser: markShared(new THREE.ConeGeometry(0.24, 0.58, 5)),
    erupcion: markShared(new THREE.ConeGeometry(0.3, 0.62, 5)), tirolina: markShared(new THREE.TorusGeometry(0.25, 0.06, 5, 10)),
  },
}
for (const k in G) if (G[k] && !G[k].name) G[k].name = 'eventos:' + k // rastreo en ?stats=1
const { decal: EMISSIVE_INST_MAT, glow: GLOW_MAT, body: BODY_INST_MAT } = vidaSharedMats()
export const eventosWarmup = () => [EMISSIVE_INST_MAT, GLOW_MAT, BODY_INST_MAT]
const HOLE_COL = new THREE.Color('#0b0912')

// ═══════════════════════════ DATOS CACHEADOS POR CAMINO ═══════════════════════════
const _q = new THREE.Quaternion(); const _v = new THREE.Vector3(); const _w = new THREE.Vector3()
const Q_RING = new THREE.Quaternion() // el anillo del kit está de pie en XY: el carril lo atraviesa por Z
const wayCache = new WeakMap()

const wayGens = new WeakMap() // way -> generador a medias (precarga por porciones, vida/precarga.js)
const NUNCA = () => false
/** Avanza los eventos de `way` hasta que `agotado()` diga basta; true cuando quedaron en caché. Mismo orden que de un tirón. */
export function eventosPaso(way, agotado) {
  if (wayCache.has(way)) return true
  let g = wayGens.get(way)
  if (!g) { g = wayGen(way); wayGens.set(way, g) }
  for (;;) {
    const r = g.next()
    if (r.done) { wayGens.delete(way); wayCache.set(way, r.value); return true }
    if (agotado()) return false
  }
}

export function buildWayData(way) {
  eventosPaso(way, NUNCA)
  return wayCache.get(way)
}

// Cede al final de cada tanda de marcas y de cada cambio: ningún marco ni temporal compartido queda a medias.
function* wayGen(way) {
  const theme = way.theme.id
  const items = []; const kits = new Map(); const icons = new Map(); const holes = []; const chevrons = []; const dashes = []; const laneDashes = []; const laneStarts = []
  const originRings = []; const landRings = []; const beams = []; const swirls = []; const eventBoxes = []; const turboPads = []
  const addKit = (name, it) => { if (!name) return; let l = kits.get(name); if (!l) kits.set(name, l = []); l.push(it) }
  const F = {}; const Fp = {}; const Fl = {}
  const markCol = new THREE.Color(pal(theme).linea).multiplyScalar(1.6)

  const segsW = way.segments ?? []
  for (let si = 0; si < segsW.length; si++) {
    const seg = segsW[si]
    const L = Math.max(seg.length ?? 1, 1)
    // Las cuatro divisorias recorren toda la superficie y continúan a través de sus tramos.
    // Cada dash queda elevado sobre el firme para evitar z-fighting y se agrupa en una malla instanciada.
    if (!seg.air) {
      const edge = WORLD.CARRIL_EDGE
      const marks = Math.max(2, Math.ceil(L / (5.2 * TRACK_K)))
      for (const lane of seg.lanes ?? []) {
        for (let j = 0; j < marks; j++) {
          const u = (j + 0.5) / marks
          surfFrame(seg, lane.id, u, Fp)
          for (let boundary = 1; boundary < WORLD.CARRILES; boundary++) {
            const lat = -edge + (2 * edge * boundary) / WORLD.CARRILES
            const p = Fp.pos.clone().addScaledVector(Fp.side, lat).addScaledVector(Fp.up, -0.055)
            laneDashes.push({ pos: p, quat: basisQuat(Fp.up, Fp.tangent), scale: [0.75, 1, Math.min(1.25 * TRACK_K, L / marks * 0.62)], color: markCol })
          }
          if (j % 8 === 7) yield
        }
      }
    }
    if (si === 0 && !seg.air) {
      const lane = seg.lanes?.[0]
      if (lane) for (let c = 0; c < WORLD.CARRILES; c++) {
        surfFrame(seg, lane.id, 0.035, Fp)
        const lat = WORLD.carrilLat(c)
        laneStarts.push({ pos: Fp.pos.clone().addScaledVector(Fp.side, lat).addScaledVector(Fp.up, -0.12), quat: basisQuat(Fp.up, Fp.tangent), scale: [0.22, 0.1, 0.22], color: new THREE.Color(['#7df9ff','#ffd84a','#ff5fd2','#6dff8a','#a78bff'][c]) })
      }
    }
    for (const sw of seg.switches ?? []) {
      const lane = seg.lanes?.find((l) => l.id === sw.from)
      if (!lane) continue
      const kind = sw.kind; const via = sw.via ?? 'arco'; const col = kindColor(kind)
      const lat = WORLD.carrilLat(sw.carril ?? 2); const step = (2 * WORLD.CARRIL_EDGE) / (WORLD.CARRILES - 1)
      const scale = Math.min(1.35, step * 1.15)
      surfFrame(seg, lane.id, sw.u, F)
      const quat = basisQuat(F.up, F.tangent)
      const pos = F.pos.clone().addScaledVector(F.side, lat).addScaledVector(F.up, -0.06)
      const seed = Math.floor(sw.u * 1e6) + lane.id * 139 + way.idx * 733
      const iconGeo = G.icon[kind] ?? G.icon.salto
      let iconItems = icons.get(iconGeo); if (!iconItems) icons.set(iconGeo, iconItems = [])
      iconItems.push({ pos: pos.clone().addScaledVector(F.up, -1.05), quat, scale: 2.1, color: col, sw })

      // pieza del tipo, sobre su carril
      if (kind === 'caida') { holes.push({ pos, quat, scale: [scale, 1, scale * 1.4], color: HOLE_COL, sw }); originRings.push({ pos: pos.clone().addScaledVector(F.up, -0.05), quat, scale: [scale * 1.15, 1, scale * 1.6], color: col, sw }) }
      else if (kind === 'laberinto') {
        // entrada del laberinto: dos barreras que forman la puerta del carril
        const qb = quat.clone().multiply(_q.setFromAxisAngle(Y_AXIS, Math.PI / 2))
        for (const sgn of [-1, 1]) addKit('barrera_lod', { pos: pos.clone().addScaledVector(F.side, sgn * step * 0.45), quat: qb, scale: [scale * 0.7, 1.4, scale * 0.5], sw })
        originRings.push({ pos, quat, scale, color: col, sw })
      } else {
        const k = kitDe(kind, theme)
        addKit(k, { pos, quat: kind === 'portal' ? quat.clone().multiply(Q_RING) : quat, scale: kind === 'elevador' ? [scale * 1.5, 0.35, scale * 1.5] : kind === 'portal' ? scale * 0.75 : scale, sw })
        if (kind !== 'portal') originRings.push({ pos, quat, scale, color: col, sw })
      }

      // marcas del carril: chevrones hacia el evento y líneas de carril a sus dos lados
      for (const d of [20, 12]) {
        const um = sw.u - (d * TRACK_K) / L
        if (um < 0.01) continue
        surfFrame(seg, lane.id, um, Fp)
        const p = Fp.pos.clone().addScaledVector(Fp.side, lat).addScaledVector(Fp.up, -0.05)
        chevrons.push({ pos: p, quat: basisQuat(Fp.up, Fp.tangent), scale: scale * 1.2, color: col, sw })
        for (const sgn of [-1, 1]) dashes.push({ pos: Fp.pos.clone().addScaledVector(Fp.side, lat + (sgn * step) / 2).addScaledVector(Fp.up, -0.05), quat: basisQuat(Fp.up, Fp.tangent), scale: [1, 1, 1.3 * TRACK_K * 0.4], color: markCol, sw })
      }

      // trayectoria: puntos (arco, caída, laberinto), haz (elevador), par de portales enlazados
      const dots = []
      if (via !== 'portal' && via !== 'elevador') {
        for (let k = 0; k < ARC_DOTS; k++) {
          const t = (k + 1) / (ARC_DOTS + 1)
          const f = WORLD.switchPath(seg, sw, t, {})
          dots.push({ pos: f.pos.clone(), quat: new THREE.Quaternion().setFromUnitVectors(Z_AXIS, f.tangent), t })
        }
      }
      const A = WORLD.switchPath(seg, sw, 0, {}).pos.clone(); const B = WORLD.switchPath(seg, sw, 1, {}).pos.clone()
      if (via === 'elevador') {
        _v.set(0, B.y - A.y, 0)
        beams.push({ pos: A.clone().addScaledVector(F.up, -WORLD.BALL_R), quat: new THREE.Quaternion().setFromUnitVectors(Y_AXIS, _w.copy(_v).normalize()), scale: [2.2, Math.abs(_v.y) + WORLD.BALL_R, 2.2], color: col, sw })
      }
      surfFrame(seg, sw.to, sw.uLand, Fl)
      const qLand = basisQuat(Fl.up, Fl.tangent)
      if (via === 'portal') {
        addKit('anillo_neon_lod', { pos: Fl.pos.clone().addScaledVector(Fl.up, -0.06), quat: qLand, scale: scale * 0.75, sw })
        swirls.push({ pos: pos.clone().addScaledVector(F.up, -0.5), quat, col, sw })
        swirls.push({ pos: Fl.pos.clone().addScaledVector(Fl.up, -0.52), quat: qLand, col, sw })
      } else landRings.push({ pos: Fl.pos.clone().addScaledVector(Fl.up, -0.06), quat: qLand, scale: 1.4, color: col, sw })

      items.push({ seg, si, sw, kind, col, seed, dots, A, B })
      yield
    }
  }

  // cajas de evento del tramo y placas turbo (como antes, sobre el centro de cada camino)
  way.segments?.forEach((seg, si) => {
    if (seg.air || !(seg.event || (seg.boost ?? 0) > 0)) return
    const L = Math.max(seg.length ?? 1, 1)
    for (const lane of seg.lanes ?? []) {
      const H = halfWidth(lane)
      if (seg.event && eventBoxes.length < 18) {
        surfFrame(seg, lane.id, 0.5, Fp)
        eventBoxes.push({ pos: Fp.pos.clone().addScaledVector(Fp.up, -0.46), quat: basisQuat(Fp.up, Fp.tangent), scale: THREE.MathUtils.clamp(H * 0.92, 0.5, 0.78), seed: si * 311 + lane.id * 73 })
      }
      if ((seg.boost ?? 0) > 0 && turboPads.length < 12) {
        surfFrame(seg, lane.id, seg.kind === 'salida' ? Math.min(0.45, 9 / L) : 0.45, Fp)
        turboPads.push({ pos: Fp.pos.clone().addScaledVector(Fp.up, -0.05), quat: basisQuat(Fp.up, Fp.tangent).multiply(_q.setFromAxisAngle(Y_AXIS, Math.PI)), scale: [Math.min(1.6, H * 1.4), 0.75, 1.5] })
      }
    }
  })

  const bySw = new Map(items.map((it, i) => [it.sw, i]))
  return { items, bySw, kits: [...kits.entries()], icons: [...icons.entries()], holes, chevrons, dashes, laneDashes, laneStarts, originRings, landRings, beams, swirls, eventBoxes, turboPads }
}

function sphereOf(points, pad = 4) {
  const box = new THREE.Box3()
  for (const p of points) box.expandByPoint(p)
  const sp = new THREE.Sphere()
  if (!box.isEmpty()) { box.getBoundingSphere(sp); sp.radius += pad } else sp.radius = 60
  return sp
}

// ═══════════════════════════ SOLO EL CARRIL DE LA BALLITA SEGUIDA ═══════════════════════════
// Con una ballita seguida (Seguir/POV, FOCO.b) solo se dibujan los eventos de su camino (lane) y carril en el camino
// (way) en el que va; en vuelo, solo el del vuelo. Sin ballita seguida (o fuera de viaje), todos, como antes.
// sel: null = todos; { key, way, lane, carril, sw }. Nada se monta ni desmonta al cambiar: cada malla tiene sitio
// para todas sus piezas y solo se reescriben las que tocan (count baja); al pasar de 0 a >0 el InstanceCuller la revela.
function selDe(way) {
  const b = FOCO.b
  if (!b || b.phase !== 'travel') return null
  if ((b.seg?.way ?? b.way) !== way) return NADA
  if (b.flight?.sw) return { key: 'f' + b.flight.sw.u + ':' + b.flight.sw.from + ':' + b.flight.sw.carril, sw: b.flight.sw }
  return { key: b.lane + ':' + b.carril, lane: b.lane, carril: b.carril }
}
const NADA = { key: 'nada', nada: true }
export const muestraSw = (sel, sw) => !sel || !sw || (!sel.nada && (sel.sw ? sel.sw === sw : sw.from === sel.lane && sw.carril === sel.carril))
// Lo leen las sondas (?stats=1): instancias de eventos dibujadas por camino.
const EV_DBG = typeof window !== 'undefined' && /[?&]stats=1/.test(window.location?.search ?? '') ? (window.__eventosCarril = window.__eventosCarril ?? { off: false }) : null

function InstancedSel({ geo, mat, items, sel }) {
  const mesh = useMemo(() => {
    const m = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length))
    m.count = 0
    m.userData.eventos = true
    return m
  }, [geo, mat, items])
  useLayoutEffect(() => {
    let n = 0
    for (const it of items) if (muestraSw(sel, it.sw)) writeInstance(mesh, n++, it)
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    if (n > 0) { if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere(); mesh.computeBoundingSphere?.() }
  }, [mesh, items, sel])
  useEffect(() => () => mesh.dispose(), [mesh])
  if (!items.length) return null
  return <primitive object={mesh} />
}

// Pieza del kit instanciada (textura y material del kit, sin animación).
function KitPieza({ nombre, items, sel }) {
  const kit = useKit(nombre)
  if (!kit || !items.length) return null
  return <InstancedSel geo={kit.geometry} mat={kit.material} items={items} sel={sel} />
}

// ═══════════════════════════ CAPA VIVA (un solo useFrame por camino) ═══════════════════════════
const T_M = new THREE.Matrix4(); const T_S = new THREE.Vector3(); const T_Q = new THREE.Quaternion(); const T_P = new THREE.Vector3()
const T_C = new THREE.Color(); const HOT = new THREE.Color('#ffffff').multiplyScalar(1.9); const T_F = {}

export default function Eventos({ way }) {
  useEffect(() => { precargarKit(['caja_evento_lod', 'turbo_placa', 'anillo_neon_lod', 'barrera_lod', 'pilar', `rebote_${way.theme.id}`]) }, [way])
  const data = useMemo(() => buildWayData(way), [way])
  const { items, bySw, kits, icons, holes, chevrons, dashes, laneDashes, laneStarts, originRings, landRings, beams, swirls, eventBoxes, turboPads } = data
  const detail = getWayDetail(way)
  const camera = useThree((s) => s.camera)
  const solidRef = useRef()
  const laneMarksRef = useRef()
  const cajaKit = useKit('caja_evento_lod')
  const [sel, setSel] = useState(() => selDe(way))
  const selRef = useRef(sel)

  // puntos de trayectoria, estela de vuelo y remolinos de portal: tres InstancedMesh vivos
  const live = useMemo(() => {
    const nDots = items.reduce((n, it) => n + it.dots.length, 0)
    const dots = new THREE.InstancedMesh(G.dot, GLOW_MAT, Math.max(1, nDots))
    const pts = []; let i = 0; const base = []
    for (const it of items) {
      base.push(i)
      for (const d of it.dots) { T_S.setScalar(0.5); dots.setMatrixAt(i, T_M.compose(d.pos, d.quat, T_S)); dots.setColorAt(i, T_C.copy(it.col).multiplyScalar(0.45)); pts.push(d.pos); i++ }
    }
    dots.count = nDots; dots.boundingSphere = sphereOf(pts, 3)
    const trail = new THREE.InstancedMesh(G.sphere, GLOW_MAT, 10 * TRAIL)
    trail.count = 0; trail.frustumCulled = false; trail.userData.noCull = true
    const sw = new THREE.InstancedMesh(G.swirl, GLOW_MAT, Math.max(1, swirls.length))
    swirls.forEach((s, k) => { sw.setMatrixAt(k, T_M.compose(s.pos, s.quat, T_S.setScalar(1))); sw.setColorAt(k, s.col) })
    sw.count = swirls.length; sw.boundingSphere = sphereOf(swirls.map((s) => s.pos), 3)
    for (const m of [dots, trail, sw]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true }
    return { dots, trail, sw, base, glow: new Float32Array(items.length), flightT: new Float32Array(items.length).fill(-1), lit: new Uint8Array(items.length), ve: new Uint8Array(items.length).fill(1), veSw: new Uint8Array(swirls.length).fill(1) }
  }, [items, swirls])
  // al cambiar de carril/camino: puntos de trayectoria y remolinos de los eventos ajenos a escala 0 (sin montar nada)
  useLayoutEffect(() => {
    const { dots, base, ve, veSw, lit } = live
    for (let i = 0; i < items.length; i++) {
      const it = items[i]; const v = muestraSw(sel, it.sw) ? 1 : 0
      ve[i] = v; lit[i] = 0
      for (let k = 0; k < it.dots.length; k++) {
        const d = it.dots[k]
        T_S.setScalar(v * 0.5); dots.setMatrixAt(base[i] + k, T_M.compose(d.pos, d.quat, T_S)); dots.setColorAt(base[i] + k, T_C.copy(it.col).multiplyScalar(0.45))
      }
    }
    swirls.forEach((s, k) => { veSw[k] = muestraSw(sel, s.sw) ? 1 : 0; live.sw.setMatrixAt(k, T_M.compose(s.pos, s.quat, T_S.setScalar(veSw[k]))) })
    for (const m of [dots, live.sw]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true }
  }, [live, items, swirls, sel])
  useEffect(() => () => { live.dots.dispose(); live.trail.dispose(); live.sw.dispose() }, [live])

  const cajas = useMemo(() => eventBoxes.map((b) => ({ pos: b.pos, quat: b.quat, scale: b.scale })), [eventBoxes])

  useFrame(({ clock }, dt) => {
    const s0 = EV_DBG?.off ? null : selDe(way)
    if ((s0?.key ?? null) !== (selRef.current?.key ?? null)) { selRef.current = s0; setSel(s0) }
    const low = detail ? detail.value < 0.3 : false
    if (solidRef.current) solidRef.current.visible = !low
    if (laneMarksRef.current) laneMarksRef.current.visible = !low
    if (low || !items.length) { live.trail.count = 0; return }
    const h = Math.min(dt, 0.1)
    const { dots, trail, glow, flightT, lit, base, ve, veSw } = live
    flightT.fill(-1)
    trail.count = 0
    // eventos activos: en vuelo (con su estela) o a punto de tomarse en el carril de la ballita
    for (const b of getBallitas()) {
      if (!b || b.way !== way || b.phase !== 'travel') continue
      if (b.flight?.sw) {
        const i = bySw.get(b.flight.sw)
        if (i === undefined || !ve[i]) continue
        flightT[i] = b.flight.t; glow[i] = 1
        for (let k = 0; k < TRAIL && trail.count < 10 * TRAIL; k++) {
          WORLD.switchPath(items[i].seg, items[i].sw, Math.max(0, b.flight.t - k * 0.02), T_F)
          T_S.setScalar((1 - k / (TRAIL + 1)) * 0.12 * (T_F.vis ?? 1))
          trail.setMatrixAt(trail.count, T_M.compose(T_F.pos, T_Q, T_S)); trail.setColorAt(trail.count++, items[i].col)
        }
      } else if (b.seg) {
        for (const sw of b.seg.switchesByLane?.get(b.lane) ?? []) {
          if (sw.carril !== b.carril || b.segT > sw.u || (sw.u - b.segT) * b.seg.length > 12 * TRACK_K) continue
          const i = bySw.get(sw); if (i !== undefined && ve[i]) glow[i] = Math.max(glow[i], 0.6)
          break
        }
      }
    }
    trail.instanceMatrix.needsUpdate = true; if (trail.instanceColor) trail.instanceColor.needsUpdate = true
    // puntos de la trayectoria: sólo los que brillan o acaban de apagarse
    let dirty = false
    for (let i = 0; i < items.length; i++) {
      if ((glow[i] < 0.01 && !lit[i]) || !ve[i]) continue
      const it = items[i]; const g = glow[i]
      for (let k = 0; k < it.dots.length; k++) {
        const d = it.dots[k]
        const wave = flightT[i] >= 0 ? Math.max(0, 1 - Math.abs(d.t - flightT[i]) * 4.5) : 0
        T_S.setScalar(0.5 + 0.6 * g + 0.6 * wave)
        dots.setMatrixAt(base[i] + k, T_M.compose(d.pos, d.quat, T_S))
        dots.setColorAt(base[i] + k, T_C.copy(it.col).multiplyScalar(0.45 + 0.75 * g).lerp(HOT, wave * 0.8))
      }
      lit[i] = g >= 0.01 ? 1 : 0
      if (flightT[i] < 0) glow[i] = Math.max(0, g - h * 1.5)
      dirty = true
    }
    if (dirty) { dots.instanceMatrix.needsUpdate = true; if (dots.instanceColor) dots.instanceColor.needsUpdate = true }
    // remolinos de portal: giran cerca de la cámara
    const t = clock.elapsedTime; const cam = camera.position; let spun = false
    for (let k = 0; k < swirls.length; k++) {
      const s = swirls[k]
      if (!veSw[k] || cam.distanceToSquared(s.pos) > (70 * TRACK_K) ** 2) continue
      T_Q.copy(s.quat).multiply(_q.setFromAxisAngle(Z_AXIS, t * 3 + k))
      live.sw.setMatrixAt(k, T_M.compose(s.pos, T_Q, T_S.setScalar(1))); spun = true
    }
    if (spun) live.sw.instanceMatrix.needsUpdate = true
  })

  if (!items.length && !eventBoxes.length) return null
  return (
    <group>
      {/* Capa emisiva: siempre visible (también a detalle bajo) para leer de lejos dónde hay eventos */}
      <InstancedSel geo={G.ring} mat={EMISSIVE_INST_MAT} items={originRings} sel={sel} />
      <InstancedSel geo={G.ring} mat={EMISSIVE_INST_MAT} items={landRings} sel={sel} />
      <group ref={laneMarksRef}>
        <Instanced geo={G.dash} mat={EMISSIVE_INST_MAT} items={laneDashes} />
        <Instanced geo={G.sphere} mat={EMISSIVE_INST_MAT} items={laneStarts} />
      </group>
      {/* Capa de detalle: piezas del kit, marcas del carril y trayectorias */}
      <group ref={solidRef}>
        {kits.map(([nombre, its]) => <KitPieza key={nombre} nombre={nombre} items={its} sel={sel} />)}
        {icons.map(([geo, its]) => <InstancedSel key={geo.uuid} geo={geo} mat={EMISSIVE_INST_MAT} items={its} sel={sel} />)}
        <InstancedSel geo={G.hole} mat={BODY_INST_MAT} items={holes} sel={sel} />
        <InstancedSel geo={G.chevron} mat={EMISSIVE_INST_MAT} items={chevrons} sel={sel} />
        <InstancedSel geo={G.dash} mat={EMISSIVE_INST_MAT} items={dashes} sel={sel} />
        <InstancedSel geo={G.beam} mat={GLOW_MAT} items={beams} sel={sel} />
        {cajaKit && cajas.length > 0 && <Instanced geo={cajaKit.geometry} mat={cajaKit.material} items={cajas} />}
        <KitPieza nombre="turbo_placa" items={turboPads} />
        <primitive object={live.dots} />
        <primitive object={live.sw} />
      </group>
      <primitive object={live.trail} />
    </group>
  )
}
