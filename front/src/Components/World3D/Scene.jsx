import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Environment, Lightformer, GradientTexture, PerformanceMonitor } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ToneMapping,
  Vignette,
  Noise,
  SMAA,
  ChromaticAberration,
  DepthOfField,
} from '@react-three/postprocessing'
import * as THREE from 'three'
import { NODE_R, mulberry32, RIBBON_HALF } from '../../Core/world.js'
import Nodes from './Nodes.jsx'
import Paths from './Paths.jsx'
import Ballita from './Ballita.jsx'
import PovPanel from '../Panels/PovPanel.jsx'
import { StatsProbe } from './StatsOverlay.jsx'
import { VistaCamino, useSuperficie, cerrarSuperficie } from './Vistas.jsx'
import Superficie from './mundos/Superficie.jsx'
import InstanceCuller from './InstanceCuller.jsx'
import Precompilado, { enlazarPendientes, precompilar, precompilarSombra, primerDibujo } from './Precompilado.jsx'
import { clampYaw, decayOffset, povZoomView, povView, POV_ZOOM_EYE, rayEnterSphere } from './povLook.js'
import { crearRejilla, construir, rayoRejilla, cercanoRejilla } from './camColision.js'
import { getNodeCameraEnvelopes } from './Nodes.jsx'
import { resolveNodeBiome } from './mundos/biomas.js'
import { resolvePlanetConfig } from './mundos/planetaCartoon.js'

const STEP = 0.05
const FOV = 50
const POV_WHEEL_ZOOM = 0.0009 // z por unidad de deltaY de la rueda
const POV_PINCH_ZOOM = 0.004 // z por píxel de pellizco
const POV_KEY_ZOOM = 0.06
const FOLLOW_UYAW_MAX = 2.2 // rad que se puede orbitar a cada lado al arrastrar
const FOLLOW_UPITCH_MIN = -0.35 // el cabeceo total (0.42 + este) nunca baja del asfalto
const FOLLOW_UPITCH_MAX = 0.9
const FOLLOW_ARM_IN = 14 // rapidez con que la cámara se acerca si algo la tapa
const FOLLOW_ARM_OUT = 1.8 // y con que vuelve a alejarse
const POV_PITCH_MAX = THREE.MathUtils.degToRad(20) // POV: giro libre a los lados, solo un poco arriba/abajo
const POV_SENS = 0.0026
const POV_LOCK_SENS = 0.0014
const POV_KEY_YAW_SPEED = 1.2
const POV_KEY_PITCH_SPEED = 0.9
const POV_JOY_YAW_SPEED = 1.3
const POV_JOY_PITCH_SPEED = 0.9
const NOOP = () => {}
const NEAR_DEFAULT = 0.15
const NEAR_POV = 0.05
const SEGUIR_DIST_MIN = 2.4
const SEGUIR_DIST_MAX = 16
const FOLLOW_LAT_W = 9 // rapidez con que el anclaje de la cámara absorbe el desvío lateral de la ballita
const SEGUIR_DIST = 4.6 // distancia detrás y encima de la ballita en caminos abiertos
const MIN_DIST = 1.4
const VISTA_DIR = new THREE.Vector3(0.55, 0.45, 0.7).normalize()
const SOL_DIR = new THREE.Vector3(0.4, 0.8, 0.3).normalize()
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const TONE_MAPPING_AGX = 8 // ToneMappingMode.AGX en postprocessing 6.39
const BlendFunction = { DST: 9, NORMAL: 23 } // postprocessing 6.39 (no es dependencia directa)
const NOOP_UPDATE = () => {}
// Tope de DPR en TODAS las vistas: si el mapa usaba más, entrar a Camino/Ballita redimensionaba el lienzo y
// Chromium espera a vaciar la cola de la GPU (75-250 ms medidos con la GPU ocupada) dentro de ese cuadro.
const DPR_CERCA = 1.0
const mov = new THREE.Vector3()
const off = new THREE.Vector3()
const lookAhead = new THREE.Vector3()
const desiredOff = new THREE.Vector3()
const sideVec = new THREE.Vector3()
const povEye = new THREE.Vector3()
const povFwd = new THREE.Vector3()
const povPrevDir = new THREE.Vector3()
const povDirVel = new THREE.Vector3()
const povLeadTarget = new THREE.Vector3()
const povLeadTmp = new THREE.Vector3()
const POV_LEAD_S = 0.4 // anticipación de la curva
const povRight = new THREE.Vector3()
const povOrthoUp = new THREE.Vector3()
const collisionOrigin = new THREE.Vector3()
const nodeRadial = new THREE.Vector3()
const bpVec = new THREE.Vector3()
const nodeRotQ = new THREE.Quaternion()
// Elevación visual de cada ballita en su planeta: la sim camina a NODE_R, pero el planeta se dibuja a 1.0-1.6 x NODE_R.
const liftOf = new WeakMap()
const visualRCache = new WeakMap()
function nodeVisualR(node, world) {
  let r = visualRCache.get(node)
  if (r == null) { r = resolvePlanetConfig(node, resolveNodeBiome(node, world), world).visualR; visualRCache.set(node, r) }
  return r
}
const liftRad = new THREE.Vector3()
function NodeLift({ b, world, children }) {
  const g = useRef()
  useFrame((_, dt) => {
    const n = b.phase !== 'travel' && Number.isInteger(b.node) ? world.nodes[b.node] : null
    let st = liftOf.get(b)
    if (!st) { st = { v: 0, dir: new THREE.Vector3(0, 1, 0) }; liftOf.set(b, st) }
    let goal = 0
    if (n) {
      liftRad.copy(b.pos).sub(n.pos)
      const len = liftRad.length()
      if (len > 1e-3) { st.dir.copy(liftRad).divideScalar(len); goal = Math.max(0, nodeVisualR(n, world) - len) + NODE_LIFT_EXTRA }
    }
    st.v = goal // sin suavizado: la elevación sigue la superficie y se anula al salir al camino
    if (g.current) g.current.position.copy(st.dir).multiplyScalar(st.v)
  })
  return <group ref={g}>{children}</group>
}
const nodeEnvC = new THREE.Vector3()
const NODE_LIFT_EXTRA = 1.1 // la ballita se apoya sobre el relieve, no a ras de la esfera base
const NODE_PITCH_PLUS = 0.14 // cabeceo extra en planeta
const NODE_ARM_MIN = 2.2 // brazo mínimo real en un planeta (más cerca, la ballita o una pieza llenaba la pantalla)
const NODE_PITCH_VERT = 0.4 // cabeceo extra en planeta con pantalla vertical (~55° sobre el plano tangente en total)
const NODE_SUBIR = 0.75// cabeceo extra (rad) para pasar por encima de una estructura que tapa en un planeta
const povTargetUp = new THREE.Vector3()
const povMat = new THREE.Matrix4()
const povTargetQuat = new THREE.Quaternion()
const povLookEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const povLookQuat = new THREE.Quaternion()
const povLookDirTmp = new THREE.Vector3()
const upRefVec = new THREE.Vector3()
const upGoalV = new THREE.Vector3()
const fwdP = new THREE.Vector3()
const rollT = new THREE.Vector3()
const colSide = new THREE.Vector3()
const colN = new THREE.Vector3()
const colO2 = new THREE.Vector3()
const colC2 = new THREE.Vector3()
const CAM_RADIO = 0.6 // la cámara se mantiene a esta distancia de cualquier superficie sólida
const CAM_RADIO_MIN = 0.36 // nunca más cerca que esto (el plano near es 0.15)
const rollMat = new THREE.Matrix4()
const viewDir = new THREE.Vector3()
const POV_FWD_RATE = 5 // filtro del rumbo en POV
const WALL_UP_RATE = 2.6 // suavizado del giro de cámara con la pared (más bajo = menos mareo)
const FOLLOW_FWD_RATE = 3 // filtro del rumbo de la ballita para la cámara de seguir
const FOLLOW_OFF_W = 3 // resorte crítico de la posición relativa de la cámara
const FOLLOW_TUBE_W = 8 // en el tubo sigue al riel (ya suave) más de cerca: un retraso la sacaría del cristal en curvas
const FOLLOW_ROLL_W = 2.5 // rapidez con que la cámara endereza el horizonte al seguir
const FOLLOW_ROT_W = 3 // suavizado (slerp por tiempo) de la mirada al seguir
const FOLLOW_ZONA = 0.26 // la ballita puede desviarse hasta este tanto de la media pantalla (tercio central = 0.33)
const occQuat = new THREE.Quaternion()
const ENTRADA_S = 1.1 // duración de la transición al empezar a seguir
const rotGoal = new THREE.Quaternion()
const REL_DEFAULT = { yaw: 0, pitch: 0.42, dist: SEGUIR_DIST }
const springA = new THREE.Vector3()
const springB = new THREE.Vector3()
// Resorte con amortiguamiento crítico (solución exacta por paso, estable con dt variable).
function springCD(x, v, goal, w, h) {
  const ex = Math.exp(-w * h)
  springA.copy(x).sub(goal)
  springB.copy(v).addScaledVector(springA, w).multiplyScalar(h)
  v.addScaledVector(springB, -w).multiplyScalar(ex)
  x.copy(goal).add(springA.add(springB).multiplyScalar(ex))
}

const posSide = new THREE.Vector3()
const posUpO = new THREE.Vector3()
const midVec = new THREE.Vector3()
const ejeP = new THREE.Vector3()
const ejeT = new THREE.Vector3()
const ejeR = new THREE.Vector3()
// Vector radial (en ejeR) de P al eje del tubo de la ballita, buscando el punto del eje junto a P
// (tramo actual o el anterior si P quedó detrás del inicio). Devuelve su longitud.
function radioTubo(P, b, prevSeg) {
  // búsqueda por muestras en el tramo de eje que cubre la cámara (detrás de la ballita): en rizos y espirales
  // una proyección local convergía al otro lado del lazo
  const L = b.seg.length
  const span = (P.distanceTo(b.pos) + 1.5) / L
  const tienePrev = prevSeg && !prevSeg.air
  let s = b.seg; let u = b.segT; let best = Infinity
  for (let k = 0; k <= 12; k++) {
    let uk = b.segT - span + (span * 1.15 * k) / 12
    let sk = b.seg
    if (uk < 0 && tienePrev) { uk = Math.max(0, 1 + (uk * L) / prevSeg.length); sk = prevSeg }
    uk = THREE.MathUtils.clamp(uk, 0, 1)
    const d2 = sk.curve.getPointAt(uk, ejeP).distanceToSquared(P)
    if (d2 < best) { best = d2; s = sk; u = uk }
  }
  for (let it = 0; it < 2; it++) { // afinado local
    u = THREE.MathUtils.clamp(u, 0, 1)
    s.curve.getPointAt(u, ejeP)
    s.curve.getTangentAt(u, ejeT)
    u += ejeR.copy(P).sub(ejeP).dot(ejeT) / s.length
  }
  const axial = ejeR.dot(ejeT)
  ejeAntes = s === b.seg && axial < 0 && u < 0 ? -axial : 0 // P quedó detrás de la boca y no hay tubo detrás
  ejeR.addScaledVector(ejeT, -axial)
  return ejeR.length()
}
let ejeAntes = 0
// Posición de cámara sobre el tubo: punto del eje `back` unidades detrás de la ballita (cruza al tramo previo)
// y, desde ahí, `height` por encima de la ballita en la dirección "arriba" filtrada `upF`; dentro del radio.
function posRiel(out, b, prevSeg, back, height, upF) {
  let s = b.seg
  let u = b.segT - back / s.length
  if (u < 0 && prevSeg && !prevSeg.air) { u = 1 + (u * s.length) / prevSeg.length; s = prevSeg }
  u = THREE.MathUtils.clamp(u, 0, 1)
  const axisB = b._frame?.axis
  const rho = axisB ? -ejeR.copy(b.pos).sub(axisB).dot(upF) : s.radius * 0.8 // altura de la ballita bajo el eje
  s.curve.getPointAt(u, out)
  s.curve.getTangentAt(u, ejeT)
  ejeR.copy(upF).addScaledVector(ejeT, -upF.dot(ejeT))
  if (ejeR.lengthSq() < 1e-6) return out
  const lim = s.radius * 0.75
  return out.addScaledVector(ejeR.normalize(), THREE.MathUtils.clamp(height - rho, -lim, lim))
}
// Mete P dentro del tubo: radio <= lim y, si no hay tubo detrás, no más atrás de la boca.
function limitarATubo(P, b, prevSeg, lim) {
  const r = radioTubo(P, b, prevSeg)
  if (r > lim) P.addScaledVector(ejeR, lim / r - 1)
  if (ejeAntes > 0) P.addScaledVector(ejeT, ejeAntes + 0.05)
}

// Oclusión: lo que quede delante de la ballita en pantalla (disco alrededor de ella) se disuelve por dither.
// Se inyecta en todos los materiales de three; el valor es un objeto plano para que se comparta por
// referencia entre las copias de uniforms (UniformsUtils.clone sólo clona Vector/Color/Matrix/Texture).
const OCC = { x: 0, y: 0, z: 0, w: 0 } // x,y: píxel de la ballita · z: profundidad de corte · w: radio px (0 = apagado)
for (const k of ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'matcap', 'normal', 'sprite', 'points', 'dashed']) {
  if (THREE.ShaderLib[k]) THREE.ShaderLib[k].uniforms.uOccBall = { value: OCC }
}
if (!THREE.ShaderChunk.clipping_planes_fragment.includes('uOccBall')) {
  THREE.ShaderChunk.clipping_planes_pars_fragment += '\nuniform vec4 uOccBall;\n'
  THREE.ShaderChunk.clipping_planes_fragment += `
  if (uOccBall.w > 0.0 && gl_FragCoord.z < uOccBall.z) {
    float _od = length(gl_FragCoord.xy - uOccBall.xy) / uOccBall.w;
    if (_od < 1.7) {
      float _ok = mix(0.1, 1.0, smoothstep(1.0, 1.7, _od));
      if (_ok < fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))))) discard;
    }
  }
`
}
const occNdc = new THREE.Vector3()
const occSize = new THREE.Vector2()

// ── Colisión de la cámara contra todo lo sólido cercano ─────────────────────────────────────────────────────────
// Antes solo se lanzaba un rayo contra las mallas `pista:*` cada 3 cuadros (~27 ms por rayo: una sola malla de
// 100-200 mil triángulos por camino) y riberas, estructuras, uniones, kit, edificios y pilares no contaban.
// Ahora: lista de colisionadores cercanos refrescada cada COL_REFRESH s (mallas y, en InstancedMesh, cada instancia
// cercana), cada geometría indexada una vez en una rejilla (camColision.js) construida por partes con presupuesto.
const COL_REFRESH = 0.5
const COL_REF_MS = 0.25 // presupuesto por cuadro del refresco de la lista (se reparte entre cuadros)
const COL_TRIS_MAX = 20000 // geometrías mayores (pistas) no se indexan: van por world.colision
const COL_IDX_R = 60 // solo se indexa lo que queda a menos de esto de la ballita
// fuera: marcas del suelo, brillos, fauna animada (cardúmenes) y aros finos que la pista atraviesa (los cubre el disco OCC)
const COL_EXCLUIR = /^(eventos|anillos|criaturas|kart|paisaje:(bubbles|motes|ray|school)|kit:anillo|uniones:(routeArrow|groundChevron|dividerGlow|portGlow))/
const colM4 = new THREE.Matrix4()
const colSph = new THREE.Sphere()
const colA = new THREE.Vector3()
const colB = new THREE.Vector3()
const colP = new THREE.Vector3()
const colOut = [0, 0, 0]
function colSolido(o) {
  if (!o.isMesh || o.isSkinnedMesh || o.userData?.noCameraCollision) return false
  const m = Array.isArray(o.material) ? o.material[0] : o.material
  if (!m || m.visible === false || m.side === THREE.BackSide) return false // cielos y atmósferas se ven por dentro
  if (m.blending === THREE.AdditiveBlending || (m.transparent && m.opacity < 0.5) || m.depthWrite === false) return false
  return !COL_EXCLUIR.test(o.geometry?.name || '')
}
function crearColisionador() {
  return { grids: new WeakMap(), cola: [], cols: [], t: -1e9, centro: new THREE.Vector3(1e9, 0, 0), inst: new WeakMap(), instPend: new Set(), objs: null, objsT: -1e9, pila: null, rf: null, ballita: new THREE.Vector3(1e9, 0, 0) }
}
function colGrid(cs, geo) {
  let g = cs.grids.get(geo)
  if (g === undefined) {
    const pos = geo.attributes?.position
    const tris = pos ? (geo.index ? geo.index.count : pos.count) / 3 : 0
    // las pistas (100-250 mil triángulos) no se indexan: su forma es analítica (world.colision, ver colPistas)
    g = pos && tris <= COL_TRIS_MAX && pos.itemSize === 3 && !pos.isInterleavedBufferAttribute ? crearRejilla(pos.array, geo.index ? geo.index.array : null) : null
    cs.grids.set(geo, g)
    if (g) g.geo = geo
    if (g) g.etq = `${geo.name || '-'}#${g.n}`
    if (g && !g.done) { cs.cola.push(g); cs.cola.sort((a, b) => a.n - b.n) } // las pequeñas (edificios, pilares) primero
  }
  return g && g.done ? g : null
}
// centros/radios en mundo de cada instancia (se calculan en tiempo ocioso: colInstanciasCalc). No se usa
// instanceMatrix.version: InstanceCuller compacta y restaura el búfer en cada render y la versión cambia sin que
// cambien las matrices lógicas; se recalcula si cambia el número de instancias o la matriz de la malla, y como
// mucho cada 20 s (instancias animadas, que son pequeñas).
function colInstancias(cs, o, t) {
  const c = cs.inst.get(o)
  if (!c || c.n !== o.count || t - c.t > 20 || !c.mw.equals(o.matrixWorld)) cs.instPend.add(o)
  return c && c.n === o.count ? c : null
}
function colInstanciasCalc(cs, o, t) {
  const geo = o.geometry
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  const n = o.count
  const c = { t, n, mw: o.matrixWorld.clone(), cen: new Float32Array(n * 3), rad: new Float32Array(n), rmax: 0, cubos: new Map() }
  for (let i = 0; i < n; i++) {
    o.getMatrixAt(i, colM4); colM4.premultiply(o.matrixWorld)
    colSph.copy(geo.boundingSphere).applyMatrix4(colM4)
    c.cen[i * 3] = colSph.center.x; c.cen[i * 3 + 1] = colSph.center.y; c.cen[i * 3 + 2] = colSph.center.z; c.rad[i] = colSph.radius
    if (colSph.radius < 0.45) continue // piezas diminutas: nunca colisionan
    if (colSph.radius > c.rmax) c.rmax = colSph.radius
    // cubetas espaciales de COL_CUBO u: el refresco solo mira las cercanas
    const k = cuboKey(Math.floor(colSph.center.x / COL_CUBO), Math.floor(colSph.center.y / COL_CUBO), Math.floor(colSph.center.z / COL_CUBO))
    let a = c.cubos.get(k)
    if (!a) c.cubos.set(k, (a = []))
    a.push(i)
  }
  cs.inst.set(o, c)
}
const COL_CUBO = 24
const cuboKey = (x, y, z) => ((x + 4096) * 8192 + (y + 4096)) * 8192 + (z + 4096)
// Tiempo ocioso: recorrido incremental de la escena (lista de sólidos cada 3 s), instancias pendientes e indexado.
// Nada de esto corre dentro del cuadro.
function colOcio(cs, scene, fin) {
  const ahora = performance.now()
  if (!cs.pila && ahora - cs.objsT > 3000) { cs.pila = [scene]; cs.objsNuevo = [] }
  while (cs.pila && cs.pila.length && performance.now() < fin) {
    for (let k = 0; k < 300 && cs.pila.length; k++) {
      const o = cs.pila.pop()
      if (!o.visible) continue
      if (colSolido(o)) cs.objsNuevo.push(o)
      const ch = o.children
      for (let j = 0; j < ch.length; j++) cs.pila.push(ch[j])
    }
  }
  if (cs.pila && !cs.pila.length) { cs.objs = cs.objsNuevo; cs.objsNuevo = null; cs.pila = null; cs.objsT = performance.now() }
  for (const o of cs.instPend) {
    if (performance.now() > fin) break
    cs.instPend.delete(o)
    if (o.parent) colInstanciasCalc(cs, o, performance.now() / 1000)
  }
  // indexado: solo lo encolado por el refresco (cercano); lo que la ballita dejó atrás (> COL_IDX_R) sale de la cola
  colIndexar(cs, fin - 0.3, 1500)
}
const COL_IDX_MS = 0.12 // indexado dentro del cuadro (solo si queda cola)
function colIndexar(cs, fin, trozo = 300) {
  while (cs.cola.length && performance.now() < fin) {
    const g = cs.cola[0]
    if (construir(g, trozo)) { cs.cola.shift(); (cs.hechas ??= []).push(g.etq); if (cs.hechas.length > 64) cs.hechas.shift() }
  }
}
// Refresca la lista de colisionadores alrededor de `bp` cada COL_REFRESH s, repartido en varios cuadros con
// presupuesto COL_REF_MS (antes recorría la escena en un cuadro: picos de 10-13 ms). R ya incluye lo que la ballita
// recorre hasta el siguiente refresco. Las piezas pequeñas pegadas a la ballita (ella misma) no cuentan.
function colRefrescar(cs, bp, R, t) {
  let rf = cs.rf
  if (!rf) {
    if ((t - cs.t < COL_REFRESH && cs.centro.distanceTo(bp) < R * 0.6) || !cs.objs) return
    cs.t = t
    rf = cs.rf = { i: 0, objs: cs.objs, bp: bp.clone(), R, list: [] }
    // la cola de indexado conserva solo lo que sigue cerca
    if (cs.ballita.distanceTo(bp) > COL_IDX_R) { cs.ballita.copy(bp); cs.cola = cs.cola.filter((g) => g.fase > 0 || (cs.grids.delete(g.geo), false)) }
  }
  const t0 = performance.now()
  const objs = rf.objs
  while (rf.i < objs.length) {
    colFiltrar(cs, objs[rf.i++], rf.bp, rf.R, rf.list)
    if ((rf.i & 15) === 0 && performance.now() - t0 > COL_REF_MS) return
  }
  cs.cols = rf.list; cs.centro.copy(rf.bp); cs.rf = null
}
function colFiltrar(cs, o, bp, R, list) {
  if (!o.visible || !o.parent) return
  const geo = o.geometry
  if (!geo.boundingSphere) geo.computeBoundingSphere()
  if (!geo.boundingSphere) return
  if (o.isInstancedMesh) {
    const ins = colInstancias(cs, o, cs.t)
    if (!ins || !ins.cubos.size) return
    let g = null
    const alc = R + ins.rmax
    const x0 = Math.floor((bp.x - alc) / COL_CUBO), x1 = Math.floor((bp.x + alc) / COL_CUBO)
    const y0 = Math.floor((bp.y - alc) / COL_CUBO), y1 = Math.floor((bp.y + alc) / COL_CUBO)
    const z0 = Math.floor((bp.z - alc) / COL_CUBO), z1 = Math.floor((bp.z + alc) / COL_CUBO)
    const recorrer = (i) => {
      const r = ins.rad[i]
      const dx = ins.cen[i * 3] - bp.x; const dy = ins.cen[i * 3 + 1] - bp.y; const dz = ins.cen[i * 3 + 2] - bp.z
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (d > r + R || (r < 1.5 && d < 1.1)) return true
      if (!g) { g = colGrid(cs, geo); if (!g) return false }
      o.getMatrixAt(i, colM4); colM4.premultiply(o.matrixWorld)
      list.push({ g, o: null, mw: colM4.clone(), inv: colM4.clone().invert(), s: colM4.getMaxScaleOnAxis(), c: new THREE.Vector3(ins.cen[i * 3], ins.cen[i * 3 + 1], ins.cen[i * 3 + 2]), r })
      return true
    }
    if ((x1 - x0 + 1) * (y1 - y0 + 1) * (z1 - z0 + 1) > ins.cubos.size) {
      for (const a of ins.cubos.values()) for (const i of a) if (!recorrer(i)) return
    } else {
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
        const a = ins.cubos.get(cuboKey(x, y, z))
        if (a) for (const i of a) if (!recorrer(i)) return
      }
    }
    return
  }
  colSph.copy(geo.boundingSphere).applyMatrix4(o.matrixWorld)
  const r = colSph.radius
  if (r > 15000 || r < 0.5) return
  const d = colSph.center.distanceTo(bp)
  if (d > r + R || (r < 1.5 && d < 1.1)) return // lejos, o una pieza de la propia ballita
  if (d > r + COL_IDX_R && !cs.grids.has(geo)) return
  const g = colGrid(cs, geo)
  if (!g) return
  list.push({ g, o, inv: o.matrixWorld.clone().invert(), s: o.matrixWorld.getMaxScaleOnAxis(), c: colSph.center.clone(), r, mw: o.matrixWorld.clone() })
}
// Pistas (analíticas, world.colision): primera fracción del segmento a→b que entra en la losa de otra cinta
// (a menos de COL_PISTA_D de su línea de superficie). La cinta que pisa la ballita se ignora (la cubre el suelo propio).
const colIgnoraObj = { way: null, si: -1, lane: null }
function colIgnora(b) {
  const seg = b.phase === 'travel' ? b.seg : null
  if (!seg?.way) return null
  colIgnoraObj.way = seg.way; colIgnoraObj.si = seg.way.segments.indexOf(seg); colIgnoraObj.lane = b.lane ?? null
  return colIgnoraObj
}
// coste por cuadro de la colisión: media y pico de la ventana de los últimos 5 s (se publican en cam.info)
// partes: refresco, rayos, cercanía, indexado (pico de cada una en la ventana)
function colCoste(ce, ms, ahora, ...partes) {
  const v = (ce.colV ??= { t: ahora, s: 0, n: 0, max: 0, media: 0, pico: 0, pm: [0, 0, 0, 0], picos: [0, 0, 0, 0] })
  v.s += ms; v.n++; if (ms > v.max) v.max = ms
  for (let i = 0; i < partes.length; i++) if (partes[i] > v.pm[i]) v.pm[i] = partes[i]
  ce.msEma += (ms - ce.msEma) * 0.05
  if (ahora - v.t > 5000) { v.media = v.s / v.n; v.pico = v.max; v.picos = v.pm.map((x) => +x.toFixed(2)); v.pm = [0, 0, 0, 0]; v.t = ahora; v.s = 0; v.n = 0; v.max = 0 }
}
const COL_PISTA_D = 0.55
const COL_PISTA_R = COL_PISTA_D - RIBBON_HALF
const colQ = new THREE.Vector3()
function colPistas(world, a, b, ignora) {
  const cl = world?.colision
  if (!cl) return 1
  for (let k = 1; k <= 4; k++) {
    colQ.copy(a).lerp(b, k / 4)
    if (!cl.libre(colQ, COL_PISTA_R, ignora)) return (k - 1) / 4
  }
  return 1
}
function colLocal(col) {
  if (col.o && !col.mw.equals(col.o.matrixWorld)) { col.mw.copy(col.o.matrixWorld); col.inv.copy(col.mw).invert(); col.c.copy(col.o.geometry.boundingSphere.center).applyMatrix4(col.mw) }
}
// Primera fracción t∈[0,1] del segmento a→b que toca algo sólido (1 si nada).
function colSegmento(cs, a, b) {
  let best = 1
  colP.copy(b).sub(a)
  const l2 = colP.lengthSq()
  for (const col of cs.cols) {
    colLocal(col)
    // descarte por esfera: distancia del centro al segmento
    let u = l2 > 0 ? colA.copy(col.c).sub(a).dot(colP) / l2 : 0
    u = u < 0 ? 0 : u > best ? best : u
    if (colA.copy(a).addScaledVector(colP, u).distanceToSquared(col.c) > col.r * col.r) continue
    colA.copy(a).applyMatrix4(col.inv); colB.copy(b).applyMatrix4(col.inv)
    const t = rayoRejilla(col.g, colA.x, colA.y, colA.z, colB.x - colA.x, colB.y - colA.y, colB.z - colA.z, best)
    if (t < best) { best = t; cs.golpe = col }
  }
  return best
}
// Superficie más cercana a p dentro de r: deja en `out` la dirección de salida y devuelve la distancia (Infinity si nada).
function colCercano(cs, p, r, out) {
  let best = Infinity
  for (const col of cs.cols) {
    if (col.c.distanceToSquared(p) > (col.r + r) * (col.r + r)) continue
    colLocal(col)
    colA.copy(p).applyMatrix4(col.inv)
    const d = cercanoRejilla(col.g, colA.x, colA.y, colA.z, r / col.s, colOut) * col.s
    if (d < best) {
      best = d
      colB.set(colOut[0], colOut[1], colOut[2]).applyMatrix4(col.mw)
      out.copy(p).sub(colB)
    }
  }
  if (best < Infinity) { if (out.lengthSq() > 1e-10) out.normalize(); else out.set(0, 1, 0) }
  return best
}

// ── Encuadre consciente de la interfaz ──────────────────────────────────────────────────────────────────────────
// Punto de pantalla (NDC) donde se coloca la ballita: algo por debajo del centro (se ve el camino delante) y por
// encima de los paneles que la taparían (tarjeta de detalle, fila de círculos, joystick del POV...).
const PANELES_UI = 'aside.tarjeta, nav.puntos, .pov-panel, .pov-joy-wrap, .vista-esquina, .camino-panel, .lista-panel'
const ENCUADRE_Y = -0.2
function encuadreUI(dom, out, mbx, mby) {
  out.x = 0; out.y = ENCUADRE_Y
  if (typeof document === 'undefined' || !dom) return out
  const cr = dom.getBoundingClientRect()
  if (cr.width < 2 || cr.height < 2) return out
  const rects = []
  for (const el of document.querySelectorAll(PANELES_UI)) {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    // a NDC del lienzo
    rects.push({ x0: (r.left - cr.left) / cr.width * 2 - 1, x1: (r.right - cr.left) / cr.width * 2 - 1, y0: 1 - (r.bottom - cr.top) / cr.height * 2, y1: 1 - (r.top - cr.top) / cr.height * 2 })
  }
  // hasta 3 pasadas: cada panel que pise la caja de la ballita la empuja hacia arriba (si está abajo) o abajo
  for (let it = 0; it < 3; it++) {
    let movio = false
    for (const r of rects) {
      if (r.x1 < out.x - mbx || r.x0 > out.x + mbx || r.y1 < out.y - mby || r.y0 > out.y + mby) continue
      const cy = (r.y0 + r.y1) / 2
      if (cy < 0) out.y = r.y1 + mby + 0.03
      else out.y = r.y0 - mby - 0.03
      movio = true
    }
    if (!movio) break
  }
  out.y = THREE.MathUtils.clamp(out.y, -0.45, 0.5)
  return out
}
const encuadreDir = new THREE.Vector3()
const encuadreQ = new THREE.Quaternion()
const Z_NEG = new THREE.Vector3(0, 0, -1)
// Rotación local que lleva el centro de la vista a que la dirección de la ballita caiga en (nx, ny) NDC.
function giroEncuadre(nx, ny, fov, aspect) {
  const t = Math.tan(THREE.MathUtils.degToRad(fov / 2))
  encuadreDir.set(nx * t * aspect, ny * t, -1).normalize()
  return encuadreQ.setFromUnitVectors(encuadreDir, Z_NEG)
}

// ── Horizonte acotado ───────────────────────────────────────────────────────────────────────────────────────────
// "Arriba" de la vista: se gira desde la referencia (Y del mundo) hacia el arriba de la ballita como mucho maxA.
// Así el horizonte apenas se inclina en peraltes y carriles de pared, y en vuelo queda recto.
const limEje = new THREE.Vector3()
function arribaAcotado(out, ref, up, fwd, maxA) {
  out.copy(ref)
  if (!up || maxA <= 0) return out
  const c = THREE.MathUtils.clamp(ref.dot(up), -1, 1)
  const a = Math.acos(c)
  if (a < 1e-4) return out
  limEje.crossVectors(ref, up)
  if (limEje.lengthSq() < 1e-6) { limEje.copy(fwd); if (limEje.lengthSq() < 1e-6) return out }
  limEje.normalize()
  return out.applyAxisAngle(limEje, Math.min(a, maxA))
}
const ROLL_MAX_CAMINO = THREE.MathUtils.degToRad(12)
const ROLL_MAX_PARED = THREE.MathUtils.degToRad(28) // pared, techo, espiral
const ROLL_HOLGURA = THREE.MathUtils.degToRad(8) // margen del tope duro sobre el objetivo (deja respirar al suavizado)
const ROLL_LIM_PLANETA = THREE.MathUtils.degToRad(15)
const rollF = new THREE.Vector3()
const rollU = new THREE.Vector3()
const rollR = new THREE.Vector3()
const rollQ = new THREE.Quaternion()
const rollC = new THREE.Vector3()
// Tope duro del alabeo de `q`: si su "arriba" se separa de `ref` (proyectada en el plano de la vista) más de `lim`,
// se gira alrededor de la mirada lo justo para volver al límite. Mirada casi paralela a ref: sin tope (no definido).
function topeAlabeo(q, ref, lim) {
  if (lim == null) return
  rollF.set(0, 0, -1).applyQuaternion(q)
  rollR.copy(ref).addScaledVector(rollF, -ref.dot(rollF))
  const L = rollR.length()
  if (L < 0.3) return
  rollR.divideScalar(L)
  rollU.set(0, 1, 0).applyQuaternion(q)
  const ang = Math.atan2(rollC.crossVectors(rollU, rollR).dot(rollF), rollU.dot(rollR)) // de U a R, alrededor de F
  if (Math.abs(ang) <= lim) return
  const giro = ang - Math.sign(ang) * lim
  q.premultiply(rollQ.setFromAxisAngle(rollF, giro))
}

const KEY_TO_ACTION = {
  arrowleft: 'left',
  a: 'left',
  j: 'left',
  arrowright: 'right',
  d: 'right',
  l: 'right',
  arrowup: 'up',
  w: 'up',
  i: 'up',
  arrowdown: 'down',
  s: 'down',
  k: 'down',
}

function wrapAngle(a) {
  return ((a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI
}

function createPovState() {
  return {
    yaw: 0,
    pitch: 0,
    roll: 0,
    zoom: POV_ZOOM_EYE, // objetivo 0..1 (ver povZoomView)
    zs: POV_ZOOM_EYE, // valor suavizado
    joyX: 0,
    joyY: 0,
    gyroYaw: 0,
    gyroPitch: 0,
    gyroReset: true,
    centerRequested: false,
    centering: false, // volviendo suavemente al seguimiento del camino
    idle: 0, // s sin input de mirada
  }
}

const NEBULA_VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const NEBULA_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vDir;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i + vec3(0,0,0)), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec3(1.7, 9.2, 4.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 d = normalize(vDir);
    vec3 drift = vec3(uTime * 0.006, -uTime * 0.004, uTime * 0.003);
    // domain warping: filamentos y volutas en vez de manchas redondas
    vec3 q = vec3(fbm(d * 2.2 + drift), fbm(d * 2.2 + vec3(5.2, 1.3, 2.8) - drift), fbm(d * 2.2 + vec3(8.1, 3.7, 6.4)));
    float n1 = fbm(d * 2.6 + q * 1.6 + drift);
    float n2 = fbm(d * 5.5 + q * 2.2 - drift * 1.4);

    // banda galáctica inclinada con núcleo brillante y franjas de polvo oscuro
    vec3 bandN = normalize(vec3(0.28, 0.86, -0.42));
    float band = exp(-pow(abs(dot(d, bandN)) * 3.2, 1.6));
    float core = exp(-pow(length(d - normalize(vec3(0.75, -0.18, 0.62))) * 2.4, 2.0));
    float dust = smoothstep(0.48, 0.7, fbm(d * 9.0 + q * 3.0)) * band;

    float cloud = smoothstep(0.32, 0.82, n1 * 0.65 + n2 * 0.35);
    float wisp = cloud * (0.45 + 0.55 * band) + core * 0.8 * cloud;
    wisp *= 1.0 - dust * 0.75;

    vec3 deep = vec3(0.10, 0.12, 0.42);   // azul profundo
    vec3 teal = vec3(0.05, 0.42, 0.52);   // cian
    vec3 mag = vec3(0.55, 0.12, 0.48);    // magenta
    vec3 warm = vec3(0.95, 0.52, 0.28);   // núcleo cálido
    vec3 col = mix(deep, teal, smoothstep(0.35, 0.8, n2));
    col = mix(col, mag, smoothstep(0.45, 0.85, q.x) * 0.8);
    col = mix(col, warm, core * smoothstep(0.4, 0.8, n1));
    col += vec3(0.9, 0.85, 1.0) * pow(band, 6.0) * cloud * 0.25; // brillo lechoso del plano galáctico

    float a = clamp(wisp * 0.28, 0.0, 0.35); // velo tenue: el protagonismo es de las galaxias
    gl_FragColor = vec4(col * a, a);
  }
`

// Paso variable (troceado a STEP como máximo): con paso fijo la ballita avanzaba a saltos, muy visible de cerca.
function SimDriver({ sim, speed }) {
  const clock = useThree((s) => s.clock)
  // Pestaña oculta: rAF se detiene (la sim se pausa sola); al volver se descarta el hueco para que nada salte.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') clock.getDelta() }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [clock])
  useFrame((_, dt) => {
    for (let t = Math.min(dt, 0.1) * speed; t > 0; t -= STEP) sim.tick(Math.min(t, STEP))
  })
  return null
}

// Centro y radio del mundo a partir de los nodos: de aquí salen el encuadre, los límites de zoom y el fondo.
function medirMundo(nodes) {
  const s = new THREE.Box3().setFromPoints(nodes.map((n) => n.pos)).getBoundingSphere(new THREE.Sphere())
  return { center: s.center, r: Math.max(s.radius, 1) * 1.55 } // los nodos van sobre la esfera; los caminos abultan la cáscara hasta ~1.5x
}

// Capa de fondo con parallax: sigue a la cámara en fracción `follow` (1 = infinito, no se desplaza;
// 0 = fija al mundo). Capas con follow distinto se deslizan a ritmos distintos al mover la cámara.
const parallaxOff = new THREE.Vector3()
function Parallax({ center, follow, children }) {
  const ref = useRef()
  useFrame(({ camera }) => {
    if (!ref.current) return
    parallaxOff.copy(camera.position).sub(center).multiplyScalar(follow)
    ref.current.position.copy(center).add(parallaxOff)
  })
  return <group ref={ref} position={center}>{children}</group>
}

// ═══ Fondo de galaxias: espirales, barradas y elípticas lejanas (planos inclinados fijos) + supernovas ═══
// Texturas dibujadas una vez en canvas; color base cálido en el núcleo y frío en los brazos.
function makeGalaxyTex(kind, seed) {
  const S = 256
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const rnd = mulberry32(seed)
  const cx = S / 2
  ctx.globalCompositeOperation = 'lighter'
  const blob = (x, y, rad, col, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, rad)
    g.addColorStop(0, `rgba(${col},${a})`)
    g.addColorStop(1, `rgba(${col},0)`)
    ctx.fillStyle = g
    ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
  }
  if (kind === 'eliptica') {
    for (let i = 0; i < 6; i++) blob(cx, cx, 30 + i * 16, '255,214,170', 0.22 - i * 0.03)
  } else {
    const arms = kind === 'barrada' ? 2 : 2 + Math.floor(rnd() * 2)
    const twist = Math.PI * (1.6 + rnd() * 0.8) // vuelta y media aprox.: se lee como espiral, no como anillo
    const r0 = kind === 'barrada' ? 28 : 6
    if (kind === 'barrada') for (let i = -1; i <= 1; i += 0.04) blob(cx + i * r0, cx, 10, '255,220,180', 0.07)
    const armPt = (off, t, jit) => {
      const ang = off + t * twist + (rnd() - 0.5) * jit
      const rad = r0 + Math.pow(t, 0.85) * (112 - r0)
      return [cx + Math.cos(ang) * rad, cx + Math.sin(ang) * rad]
    }
    for (let a = 0; a < arms; a++) {
      const off = (a / arms) * Math.PI * 2
      for (let i = 0; i < 140; i++) { // brillo difuso del brazo
        const t = i / 140
        const [x, y] = armPt(off, t, 0.12)
        blob(x, y, 16 * (1 - t * 0.4), '170,190,255', 0.045 * (1 - t * 0.6))
      }
      for (let i = 0; i < 420; i++) { // estrellas y cúmulos finos a lo largo del brazo
        const t = Math.pow(rnd(), 0.8)
        const [x, y] = armPt(off, t, 0.28)
        const c = rnd() < 0.15 ? '255,150,210' : rnd() < 0.4 ? '150,190,255' : '230,236,255'
        blob(x + (rnd() - 0.5) * 8, y + (rnd() - 0.5) * 8, 1.4 + rnd() * 2.6, c, 0.22 + rnd() * 0.3)
      }
    }
    for (let i = 0; i < 5; i++) blob(cx, cx, 8 + i * 11, '255,226,190', 0.4 - i * 0.07) // bulbo
  }
  blob(cx, cx, 7, '255,250,240', 0.9) // núcleo
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

function makeFlareTex() {
  const S = 128
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')
  const h = S / 2
  const g = ctx.createRadialGradient(h, h, 0, h, h, h)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.08, 'rgba(255,240,220,0.9)')
  g.addColorStop(0.3, 'rgba(255,170,120,0.25)')
  g.addColorStop(1, 'rgba(255,120,80,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  ctx.globalCompositeOperation = 'lighter'
  for (const [w, hgt] of [[S, 3], [3, S]]) { // destello en cruz
    const lg = ctx.createLinearGradient(h - w / 2, h - hgt / 2, h + w / 2, h + hgt / 2)
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(0.5, 'rgba(255,255,255,0.9)'); lg.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = lg
    ctx.fillRect(h - w / 2, h - hgt / 2, w, hgt)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

const GALAXY_TINTS = ['#ffffff', '#d6e2ff', '#ffe2c4', '#e8d4ff', '#c8f0ff']
const galObj = new THREE.Object3D()
function Galaxias({ r }) {
  const { texs, items } = useMemo(() => {
    if (typeof document === 'undefined') return { texs: [], items: [] }
    const kinds = ['espiral', 'espiral', 'barrada', 'eliptica', 'espiral', 'barrada']
    const texs = kinds.map((k, i) => makeGalaxyTex(k, 101 + i * 37))
    const rnd = mulberry32(2026)
    const items = []
    const N = 22
    for (let i = 0; i < N; i++) {
      const y = 1 - 2 * ((i + 0.5) / N) // repartidas en todo el cielo (espiral de Fibonacci)
      const rr = Math.sqrt(1 - y * y)
      const a = i * 2.39996 + rnd() * 0.4
      const dist = r * (6.4 + rnd() * 1.2)
      galObj.position.set(Math.cos(a) * rr * dist, y * dist, Math.sin(a) * rr * dist)
      galObj.lookAt(0, 0, 0)
      galObj.rotateX((rnd() - 0.5) * 2.2) // inclinación: de frente a casi de canto
      galObj.rotateZ(rnd() * Math.PI * 2)
      const big = i % 7 === 3 // unas pocas grandes y cercanas, el resto lejanas
      items.push({
        pos: galObj.position.toArray(),
        quat: galObj.quaternion.toArray(),
        size: r * (big ? 2.4 + rnd() * 0.8 : 0.6 + rnd() * 0.9),
        tex: i % texs.length,
        tint: GALAXY_TINTS[i % GALAXY_TINTS.length],
        opacity: big ? 0.85 : 0.5 + rnd() * 0.35,
      })
    }
    return { texs, items }
  }, [r])
  useEffect(() => () => texs.forEach((t) => t.dispose()), [texs])
  return items.map((it, i) => (
    <mesh key={i} position={it.pos} quaternion={it.quat} scale={it.size}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texs[it.tex]} color={it.tint} transparent opacity={it.opacity} side={THREE.DoubleSide}
        depthWrite={false} fog={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </mesh>
  ))
}

// Supernovas: destellos lejanos que estallan (subida rápida, apagado lento) y quedan dormidos un rato.
function Supernovas({ r }) {
  const refs = useRef([])
  const { tex, items } = useMemo(() => {
    const rnd = mulberry32(31337)
    const items = []
    for (let i = 0; i < 5; i++) {
      const y = 1 - 2 * rnd()
      const rr = Math.sqrt(1 - y * y)
      const a = rnd() * Math.PI * 2
      const dist = r * (6 + rnd())
      items.push({
        pos: [Math.cos(a) * rr * dist, y * dist, Math.sin(a) * rr * dist],
        period: 18 + rnd() * 26,
        phase: rnd() * 40,
        size: r * (0.5 + rnd() * 0.4),
        color: rnd() < 0.5 ? '#ffd0a0' : '#bcd4ff',
      })
    }
    return { tex: typeof document === 'undefined' ? null : makeFlareTex(), items }
  }, [r])
  useEffect(() => () => tex?.dispose(), [tex])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    items.forEach((it, i) => {
      const s = refs.current[i]
      if (!s) return
      const k = ((t + it.phase) % it.period) / it.period // 0..1 por ciclo
      const burst = k < 0.03 ? k / 0.03 : k < 0.35 ? Math.exp(-(k - 0.03) * 9) : 0
      s.material.opacity = burst
      s.scale.setScalar(it.size * (0.4 + burst * 0.8))
      s.visible = burst > 0.01
    })
  })
  if (!tex) return null
  return items.map((it, i) => (
    <sprite key={i} ref={(el) => { refs.current[i] = el }} position={it.pos} visible={false}>
      <spriteMaterial map={tex} color={it.color} transparent opacity={0} depthWrite={false} fog={false}
        blending={THREE.AdditiveBlending} toneMapped={false} />
    </sprite>
  ))
}

function NebulaDome({ r }) {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: NEBULA_VERT,
    fragmentShader: NEBULA_FRAG,
    uniforms: { uTime: { value: 0 } },
    side: THREE.BackSide,
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    fog: false,
  }), [])

  useEffect(() => () => mat.dispose(), [mat])

  useFrame((_, dt) => {
    mat.uniforms.uTime.value += dt
  })

  return (
    <mesh scale={r * 10.5} material={mat}>
      <sphereGeometry args={[1, 32, 20]} />
    </mesh>
  )
}


// Órbita libre siempre. Al seguir, el objetivo se ancla a la ballita y la cámara se desplaza con ella.
function CameraRig({ mundo, world, nodes, selected, follow, pov, cine, suspend = false, povControlRef, pointerLockedRef, gyroActiveRef, horizonRef, onCanvasReady }) {
  const followUp = useRef(new THREE.Vector3(0, 1, 0))
  const followRef = useRef({ rel: { ...REL_DEFAULT }, off: new THREE.Vector3(), offV: new THREE.Vector3(), fwd: new THREE.Vector3(0, 0, 1), side: new THREE.Vector3(1, 0, 0), lastOff: new THREE.Vector3(), hasLast: false, anchor: new THREE.Vector3(), hasAnchor: false, recenter: false, posUp: new THREE.Vector3(0, 1, 0), hasPosUp: false, stepAvg: 0, seg: null, prevSeg: null, enterT: 0, startTarget: new THREE.Vector3(), startPos: new THREE.Vector3(), quat: new THREE.Quaternion(), userRel: false, uYaw: 0, uPitch: 0, idle: 0, drag: false, clear: 1, clearGoal: 1, glide: new THREE.Vector3(), cambioT: 0, prevEn: false, prevRad: new THREE.Vector3(), hasRad: false, nodeBlend: 0, nodeEnv: null, nodeEnvIdx: null })
  const controls = useRef()
  const vuelta = useRef(false)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const delta = useMemo(() => new THREE.Vector3(), [])
  const colis = useRef(null)
  if (!colis.current) colis.current = crearColisionador()
  const camExtra = useRef({ viewUp: new THREE.Vector3(0, 1, 0), push: new THREE.Vector3(), enc: { x: 0, y: ENCUADRE_Y }, encGoal: { x: 0, y: ENCUADRE_Y }, encT: -1e9, rollRef: new THREE.Vector3(0, 1, 0), rollLim: null, subir: 0, msEma: 0, msMax: 0, buildEma: 0, pRef: 0, pSeg: 0, pNear: 0 })
  const modo = useRef('libre') // libre | entrando | siguiendo | pov | volviendo
  const ultima = useRef(null)
  const userActive = useRef(false)
  const lastTouch = useRef(0)
  const cineClock = useRef(0)
  const prevPos = useRef(new THREE.Vector3())
  const hasPrevPos = useRef(false)
  const povQuat = useRef(new THREE.Quaternion())
  const povUp = useRef(new THREE.Vector3(0, 1, 0))
  const povLastFwd = useRef(new THREE.Vector3(0, 0, 1))
  const povLastRight = useRef(new THREE.Vector3(1, 0, 0))
  const povInit = useRef(false)
  const povDragging = useRef(false)
  const keysRef = useRef(new Set())
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')

  useEffect(() => {
    onCanvasReady?.(gl.domElement)
  }, [gl, onCanvasReady])

  // Indexado de colisión en tiempo ocioso: pistas, riberas y puertas (estáticas, 20-190 mil triángulos cada una)
  // se encolan a los pocos segundos y la cola avanza solo cuando el hilo principal está libre.
  useEffect(() => {
    const cs = colis.current
    const ric = typeof window !== 'undefined' && window.requestIdleCallback
    let id = 0
    let vivo = true
    const paso = (deadline) => {
      if (!vivo) return
      // sin hueco (timeout vencido): un paso mínimo de 1 ms para no quedarse sin lista nunca
      const libre = deadline && !deadline.didTimeout ? Math.min(6, deadline.timeRemaining() - 0.5) : 1
      if (libre > 0.3) colOcio(cs, scene, performance.now() + libre)
      id = ric ? window.requestIdleCallback(paso, { timeout: 500 }) : setTimeout(() => paso(null), 60)
    }
    id = ric ? window.requestIdleCallback(paso, { timeout: 500 }) : setTimeout(() => paso(null), 300)
    return () => { vivo = false; if (ric) window.cancelIdleCallback(id); else clearTimeout(id) }
  }, [scene])

  // Recentrar (tecla R o evento 'ballitas:recentrar' del botón): vuelve detrás de la ballita / mirada al frente.
  useEffect(() => {
    const recentrar = () => { followRef.current.recenter = true; povControlRef.current.centerRequested = true }
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.toLowerCase() === 'r') recentrar()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('ballitas:recentrar', recentrar)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('ballitas:recentrar', recentrar) }
  }, [povControlRef])

  useEffect(() => {
    const resetState = () => {
      Object.assign(povControlRef.current, createPovState())
      povDragging.current = false
      keysRef.current.clear()
    }
    if (!povActive) {
      resetState()
      return undefined
    }
    const dom = gl.domElement
    const prevCursor = dom.style.cursor
    const prevTouchAction = dom.style.touchAction
    dom.style.cursor = 'grab'
    dom.style.touchAction = 'none'

    let pointerId = null
    let lastX = 0
    let lastY = 0
    let totalDist2 = 0
    const ptrs = new Map() // punteros activos (táctil): con dos se pellizca para el zoom
    let pinchD = 0
    const pinchDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
    const zoomBy = (d) => { const st = povControlRef.current; st.zoom = THREE.MathUtils.clamp(st.zoom + d, 0, 1) }

    const centerLook = () => {
      const st = povControlRef.current
      st.centering = true // el offset vuelve a 0 con suavizado (ver useFrame) y sigue el camino
      st.gyroYaw = 0
      st.gyroPitch = 0
      st.gyroReset = true
    }

    const onPointerDown = (e) => {
      if (document.pointerLockElement === dom) return
      if (e.pointerType === 'mouse' && e.button !== 0) return
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (ptrs.size === 2) { pinchD = pinchDist(); povDragging.current = false; return }
      if (pointerId !== null) return
      pointerId = e.pointerId
      lastX = e.clientX
      lastY = e.clientY
      totalDist2 = 0
      try { dom.setPointerCapture(e.pointerId) } catch {}
    }

    const onPointerMove = (e) => {
      if (document.pointerLockElement === dom) { pointerId = null; povDragging.current = false; return }
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY })
      if (ptrs.size >= 2) {
        const d = pinchDist()
        zoomBy((d - pinchD) * POV_PINCH_ZOOM)
        pinchD = d
        return
      }
      if (e.pointerId !== pointerId) return
      const dx = e.clientX - lastX
      const dy = e.clientY - lastY
      lastX = e.clientX
      lastY = e.clientY
      totalDist2 += dx * dx + dy * dy
      if (!povDragging.current && totalDist2 >= 2) {
        povDragging.current = true
        dom.style.cursor = 'grabbing'
      }
      if (dx !== 0 || dy !== 0) {
        const st = povControlRef.current
        st.centering = false
        st.idle = 0
        st.yaw = clampYaw(st.yaw + dx * POV_SENS)
        st.pitch = THREE.MathUtils.clamp(st.pitch + dy * POV_SENS, -POV_PITCH_MAX, POV_PITCH_MAX)
      }
    }

    const endDrag = (e) => {
      ptrs.delete(e.pointerId)
      if (e.pointerId !== pointerId) return
      pointerId = null
      try {
        if (dom.hasPointerCapture?.(e.pointerId)) dom.releasePointerCapture(e.pointerId)
      } catch {}
      povDragging.current = false
      dom.style.cursor = 'grab'
    }

    const onLockedMouseMove = (e) => {
      if (document.pointerLockElement !== dom) return
      const mx = e.movementX || 0
      const my = e.movementY || 0
      if (mx === 0 && my === 0) return
      const st = povControlRef.current
      st.centering = false
      st.idle = 0
      st.yaw = clampYaw(st.yaw - mx * POV_LOCK_SENS)
      st.pitch = THREE.MathUtils.clamp(st.pitch - my * POV_LOCK_SENS, -POV_PITCH_MAX, POV_PITCH_MAX)
    }

    const onDblClick = () => centerLook()

    const onWheel = (e) => {
      e.preventDefault()
      zoomBy(-e.deltaY * POV_WHEEL_ZOOM) // rueda hacia delante = acercar
    }

    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (k === 'r') {
        centerLook()
        return
      }
      if (k === '+' || k === '=') { zoomBy(POV_KEY_ZOOM); return }
      if (k === '-' || k === '_') { zoomBy(-POV_KEY_ZOOM); return }
      const action = KEY_TO_ACTION[k]
      if (action) {
        if (e.key.startsWith('Arrow')) e.preventDefault()
        keysRef.current.add(action)
      }
    }

    const onKeyUp = (e) => {
      const action = KEY_TO_ACTION[e.key.toLowerCase()]
      if (action) keysRef.current.delete(action)
    }

    const onBlur = () => {
      pointerId = null
      ptrs.clear()
      povDragging.current = false
      keysRef.current.clear()
      dom.style.cursor = 'grab'
    }

    dom.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', endDrag)
    window.addEventListener('pointercancel', endDrag)
    window.addEventListener('blur', onBlur)
    document.addEventListener('mousemove', onLockedMouseMove)
    dom.addEventListener('dblclick', onDblClick)
    dom.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    return () => {
      dom.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', endDrag)
      window.removeEventListener('pointercancel', endDrag)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('mousemove', onLockedMouseMove)
      dom.removeEventListener('dblclick', onDblClick)
      dom.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      dom.style.cursor = prevCursor
      dom.style.touchAction = prevTouchAction
      resetState()
    }
  }, [povActive, gl, povControlRef])

  // Gestos de Seguir (OrbitControls apagado): arrastrar orbita acotado y vuelve solo, rueda/pellizco/+/- zoom con límites,
  // doble clic o R recentran.
  const followActive = Boolean(follow && !pov && selected && selected.phase !== 'gone' && !suspend)
  useEffect(() => {
    if (!followActive) return undefined
    const dom = gl.domElement
    const fs = followRef.current
    const prevCursor = dom.style.cursor
    const prevTouchAction = dom.style.touchAction
    dom.style.cursor = 'grab'
    dom.style.touchAction = 'none'
    const ptrs = new Map()
    let pinchD = 0
    const pinchDist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y) }
    const zoomBy = (f) => { fs.rel.dist = THREE.MathUtils.clamp(fs.rel.dist * f, SEGUIR_DIST_MIN, SEGUIR_DIST_MAX) }
    const down = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, id: e.pointerId })
      if (ptrs.size === 2) pinchD = pinchDist()
      try { dom.setPointerCapture(e.pointerId) } catch {}
    }
    const move = (e) => {
      const p = ptrs.get(e.pointerId)
      if (!p) return
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      p.x = e.clientX; p.y = e.clientY
      if (ptrs.size >= 2) {
        const d = pinchDist()
        if (pinchD > 0 && d > 0) zoomBy(pinchD / d)
        pinchD = d
        return
      }
      fs.drag = true; fs.idle = 0
      dom.style.cursor = 'grabbing'
      fs.uYaw = THREE.MathUtils.clamp(fs.uYaw - dx * 0.006, -FOLLOW_UYAW_MAX, FOLLOW_UYAW_MAX)
      fs.uPitch = THREE.MathUtils.clamp(fs.uPitch + dy * 0.005, FOLLOW_UPITCH_MIN, FOLLOW_UPITCH_MAX)
    }
    const up = (e) => {
      ptrs.delete(e.pointerId)
      try { if (dom.hasPointerCapture?.(e.pointerId)) dom.releasePointerCapture(e.pointerId) } catch {}
      if (ptrs.size === 0) { fs.drag = false; dom.style.cursor = 'grab' }
    }
    const wheel = (e) => { e.preventDefault(); zoomBy(Math.exp(e.deltaY * 0.0012)) }
    const recentrar = () => { fs.uYaw = 0; fs.uPitch = 0; fs.idle = 9 }
    const key = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '+' || e.key === '=') zoomBy(0.88)
      else if (e.key === '-' || e.key === '_') zoomBy(1 / 0.88)
    }
    const blur = () => { ptrs.clear(); fs.drag = false }
    dom.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    window.addEventListener('blur', blur)
    dom.addEventListener('wheel', wheel, { passive: false })
    dom.addEventListener('dblclick', recentrar)
    window.addEventListener('keydown', key)
    return () => {
      dom.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('blur', blur)
      dom.removeEventListener('wheel', wheel)
      dom.removeEventListener('dblclick', recentrar)
      window.removeEventListener('keydown', key)
      dom.style.cursor = prevCursor
      dom.style.touchAction = prevTouchAction
      fs.drag = false
    }
  }, [followActive, gl])

  // Posición de la vista general: encaja el mundo también en pantallas verticales.
  const casa = () => {
    const v = THREE.MathUtils.degToRad(FOV / 2)
    const h = Math.min(v, Math.atan(Math.tan(v) * Math.max(0.3, camera.aspect || 1)))
    // maxDistance de OrbitControls es r*6: si la casa lo supera, 'volviendo' nunca termina.
    return off.copy(mundo.center).addScaledVector(VISTA_DIR, Math.min(mundo.r * 0.8 / Math.sin(h), mundo.r * 5.8)) // 0.8: el mapa ocupa ~80% de la pantalla
  }

  useLayoutEffect(() => {
    camera.position.copy(casa())
    controls.current.target.copy(mundo.center)
    controls.current.update()
  }, [])

  useFrame((_, dt) => {
    const c = controls.current
    const h = Math.min(dt, 0.1)
    OCC.w = 0
    if (suspend) { vuelta.current = true; return }
    if (vuelta.current) { // al salir del camino: se vuelve a la vista general con transición
      vuelta.current = false; hasPrevPos.current = false; modo.current = 'volviendo'
      c.target.copy(camera.position).addScaledVector(camera.getWorldDirection(sideVec), mundo.r * 0.1)
    }
    cineClock.current += h

    let targetFov = FOV
    let targetNear = NEAR_DEFAULT
    if (!povActive && typeof window !== 'undefined' && window.__ballitasPov?.active) {
      window.__ballitasPov.active = false
    }
    if (povActive && selected?.phase !== 'gone') {
      const st = povControlRef.current
      if (modo.current !== 'pov' || ultima.current !== selected) {
        modo.current = 'pov'
        ultima.current = selected
        povInit.current = false
        Object.assign(st, createPovState())
        povDragging.current = false
        keysRef.current.clear()
      }

      if (st.centerRequested) {
        st.centering = true
        st.gyroYaw = 0
        st.gyroPitch = 0
        st.gyroReset = true
        st.centerRequested = false
      }

      const keys = keysRef.current
      const yawInput = (keys.has('right') ? -1 : 0) + (keys.has('left') ? 1 : 0)
      const pitchInput = (keys.has('up') ? 1 : 0) + (keys.has('down') ? -1 : 0)
      const joyActive = st.joyX !== 0 || st.joyY !== 0
      if (yawInput !== 0 || pitchInput !== 0 || joyActive) { st.centering = false; st.idle = 0 }
      if (yawInput !== 0) st.yaw = clampYaw(st.yaw + yawInput * POV_KEY_YAW_SPEED * h)
      if (pitchInput !== 0) {
        st.pitch = THREE.MathUtils.clamp(st.pitch + pitchInput * POV_KEY_PITCH_SPEED * h, -POV_PITCH_MAX, POV_PITCH_MAX)
      }

      if (joyActive) {
        st.yaw = clampYaw(st.yaw - st.joyX * POV_JOY_YAW_SPEED * h)
        st.pitch = THREE.MathUtils.clamp(st.pitch - st.joyY * POV_JOY_PITCH_SPEED * h, -POV_PITCH_MAX, POV_PITCH_MAX)
      }

      // sin input la mirada vuelve al camino (tras ~1.5 s) o, si se pidió centrar, enseguida
      if (povDragging.current || pointerLockedRef.current || gyroActiveRef.current) st.idle = 0
      else st.idle += h
      st.yaw = decayOffset(st.yaw, h, st.idle, st.centering)
      st.pitch = decayOffset(st.pitch, h, st.idle, st.centering)
      st.roll = decayOffset(st.roll, h, st.idle, st.centering)
      if (st.centering && st.yaw === 0 && st.pitch === 0 && st.roll === 0) st.centering = false

      st.zs += (st.zoom - st.zs) * (1 - Math.exp(-9 * h))
      const zv = povZoomView(st.zs)
      povView.body = zv.body
      targetFov = zv.fov
      targetNear = NEAR_POV

      // rumbo filtrado: la mirada no tiembla con el vaivén del carril ni con los mecanismos.
      // Anticipa la curva: extrapola la tangente con su velocidad angular suavizada (~POV_LEAD_S hacia adelante).
      if (selected.dir && selected.dir.lengthSq() > 1e-6) {
        povLeadTarget.copy(selected.dir)
        if (povInit.current && h > 0) {
          if (povPrevDir.dot(selected.dir) < 0.7) povDirVel.set(0, 0, 0) // salto de tramo: no extrapolar
          else {
            povLeadTmp.copy(selected.dir).sub(povPrevDir).divideScalar(h)
            povDirVel.lerp(povLeadTmp, 1 - Math.exp(-6 * h))
          }
          povLeadTarget.addScaledVector(povDirVel, POV_LEAD_S).normalize()
        } else povDirVel.set(0, 0, 0)
        povPrevDir.copy(selected.dir)
        if (povInit.current) povLastFwd.current.lerp(povLeadTarget, 1 - Math.exp(-POV_FWD_RATE * h))
        else povLastFwd.current.copy(selected.dir)
        if (povLastFwd.current.lengthSq() < 1e-6) povLastFwd.current.copy(selected.dir)
        povLastFwd.current.normalize()
      }
      povFwd.copy(povLastFwd.current)

      // POV: "abajo" es siempre la superficie a la que va pegada la ballita (suelo, pared o techo);
      // si pasa al techo, el techo se vuelve el piso de la vista. No depende del horizonte estable (H) de Seguir.
      const onWall = selected.phase === 'travel'
      if (selected.up && selected.up.lengthSq() > 1e-6) {
        povTargetUp.copy(selected.up).normalize()
      } else {
        povTargetUp.copy(Y_AXIS)
      }

      if (!povInit.current) {
        povUp.current.copy(povTargetUp)
        povQuat.current.copy(camera.quaternion)
        povInit.current = true
      } else {
        povUp.current.lerp(povTargetUp, 1 - Math.exp(-(onWall ? WALL_UP_RATE : 3.5) * h))
        if (povUp.current.lengthSq() < 1e-6) povUp.current.copy(povTargetUp)
        povUp.current.normalize()
      }

      povRight.crossVectors(povFwd, povUp.current)
      if (povRight.lengthSq() < 1e-3) povRight.copy(povLastRight.current) // tramo vertical: conserva el lateral
      povRight.normalize()
      povLastRight.current.copy(povRight)
      povOrthoUp.crossVectors(povRight, povFwd).normalize()
      povMat.makeBasis(povRight, povOrthoUp, sideVec.copy(povFwd).negate())
      povTargetQuat.setFromRotationMatrix(povMat)

      const totalYaw = clampYaw(st.yaw + (gyroActiveRef.current ? st.gyroYaw : 0))
      const totalPitch = THREE.MathUtils.clamp(
        st.pitch + (gyroActiveRef.current ? st.gyroPitch : 0),
        -POV_PITCH_MAX,
        POV_PITCH_MAX,
      )
      const totalRoll = st.roll
      // tercera persona: la cámara además mira un poco hacia abajo, a la ballita que queda delante
      const tilt = zv.back > 0 ? -Math.atan2(zv.up, zv.back + 3) : 0
      if (totalYaw !== 0 || totalPitch !== 0 || totalRoll !== 0 || tilt !== 0) {
        povLookEuler.set(totalPitch + tilt, totalYaw, totalRoll, 'YXZ')
        povLookQuat.setFromEuler(povLookEuler)
        povTargetQuat.multiply(povLookQuat)
      }
      const interacting = povDragging.current
        || yawInput !== 0
        || pitchInput !== 0
        || st.joyX !== 0
        || st.joyY !== 0
        || pointerLockedRef.current
        || gyroActiveRef.current
      // cámara semifija a la espalda (más lenta) → rígida en los ojos
      const fija = zv.back / 2.2
      povQuat.current.slerp(povTargetQuat, 1 - Math.exp(-(interacting ? 14 : 8 - 4.5 * fija) * h))
      camera.quaternion.copy(povQuat.current)

      const upShift = onWall ? 0.1 : selected.phase === 'travel' ? -0.06 : 0.08
      povEye.copy(selected.pos).addScaledVector(povFwd, 0.14)
      if (selected.up) povEye.addScaledVector(selected.up, upShift)
      if (zv.back > 0) { // sale hacia atrás por donde mira la cámara y sube un poco
        camera.getWorldDirection(povLookDirTmp)
        povEye.addScaledVector(povLookDirTmp, -zv.back).addScaledVector(povUp.current, zv.up)
      }
      // en tercera persona la cámara va rígida a la ballita (con retraso se quedaba a metros a alta velocidad); sólo la mirada es lenta
      camera.position.lerp(povEye, Math.max(1 - Math.exp(-18 * h), Math.min(1, fija * 6)))
      if (zv.back > 0.05) {
        // a la espalda: la cámara no atraviesa pistas, losas ni pilares (mismo colisionador que Seguir)
        const t0 = performance.now()
        const cs = colis.current
        colRefrescar(cs, selected.pos, 4 + Math.abs(selected.speed ?? 0) * COL_REFRESH, t0 / 1000)
        const upP = selected.up && selected.up.lengthSq() > 0.5 ? selected.up : Y_AXIS
        collisionOrigin.copy(selected.pos).addScaledVector(upP, 0.3)
        delta.copy(camera.position).sub(collisionOrigin)
        const len = delta.length()
        if (len > 0.3) {
          const tHit = Math.min(colSegmento(cs, collisionOrigin, camera.position), colPistas(world, collisionOrigin, camera.position, colIgnora(selected)))
          if (tHit < 1) camera.position.copy(collisionOrigin).addScaledVector(delta, Math.max(0.05, (tHit * len - 0.2) / len))
        }
        const dn = colCercano(cs, camera.position, CAM_RADIO_MIN, colN)
        if (dn < CAM_RADIO_MIN) camera.position.addScaledVector(colN, CAM_RADIO_MIN - dn)
        colCoste(camExtra.current, performance.now() - t0, t0)
      }
      c.target.copy(povEye).addScaledVector(povFwd, 2)
      hasPrevPos.current = false

      if (typeof window !== 'undefined') {
        const t = window.__ballitasPov || (window.__ballitasPov = {})
        camera.getWorldDirection(povLookDirTmp)
        t.active = true
        t.yaw = totalYaw
        t.pitch = totalPitch
        t.roll = totalRoll
        t.fov = camera.fov
        t.zoom = st.zs
        t.pointerLocked = Boolean(document.pointerLockElement === gl.domElement)
        t.gyroActive = Boolean(gyroActiveRef.current)
        t.camDir = [povLookDirTmp.x, povLookDirTmp.y, povLookDirTmp.z]
        t.camQuat = [camera.quaternion.x, camera.quaternion.y, camera.quaternion.z, camera.quaternion.w]
        t.ballitaDir = [povFwd.x, povFwd.y, povFwd.z]
        t.ballitaPos = [selected.pos.x, selected.pos.y, selected.pos.z]
        t.horizon = Boolean(horizonRef.current)
        t.camUp = [povUp.current.x, povUp.current.y, povUp.current.z]
      }
    } else if (follow && selected && selected.phase !== 'gone') {
      // Seguir: la cámara vive en coordenadas relativas a la ballita (rel: yaw/pitch/dist en su marco suavizado).
      // Si el usuario orbita o hace zoom, se adopta ese ángulo y se conserva; sólo R (o el botón) lo recentra.
      const fs = followRef.current
      // posición visual de la ballita: en un planeta se dibuja sobre la superficie visual (ver NodeLift), no bajo ella
      const bp = bpVec.copy(selected.pos)
      const liftSt = liftOf.get(selected)
      if (liftSt && liftSt.v > 1e-4) bp.addScaledVector(liftSt.dir, liftSt.v)
      if ((modo.current !== 'entrando' && modo.current !== 'siguiendo') || ultima.current !== selected) {
        modo.current = 'entrando'
        hasPrevPos.current = false
        fs.hasLast = false
        fs.hasAnchor = false
        fs.hasPosUp = false
        fs.stepAvg = 0
        fs.seg = fs.prevSeg = null
        fs.offV.set(0, 0, 0)
        fs.off.copy(camera.position).sub(c.target)
        fs.enterT = 0
        fs.startTarget.copy(c.target)
        fs.startPos.copy(camera.position)
        fs.quat.copy(camera.quaternion)
        fs.userRel = false
        fs.uYaw = fs.uPitch = 0; fs.clear = fs.clearGoal = 1; fs.nodeBlend = 0; fs.nodeEnv = null; fs.nodeEnvIdx = null; fs.hasRad = false; fs.glide.set(0, 0, 0); fs.cambioT = 0; fs.prevEn = false
        if (selected.dir && selected.dir.lengthSq() > 1e-6) fs.fwd.copy(selected.dir).normalize()
      }
      ultima.current = selected
      if (fs.recenter) { fs.recenter = false; fs.userRel = false; fs.uYaw = fs.uPitch = 0; Object.assign(fs.rel, REL_DEFAULT) }
      const entrando = modo.current === 'entrando'
      const vel = selected.speed ?? 0
      // en un planeta: "arriba" = normal radial, brazo corto y bajo (tercera persona cercana), transición suave con el camino
      const nodoSel = selected.phase !== 'travel' && Number.isInteger(selected.node) ? nodes[selected.node] : null
      const enNodo = Boolean(nodoSel)
      if (fs.prevEn !== enNodo) fs.cambioT = 1
      fs.prevEn = enNodo; fs.cambioT = Math.max(0, fs.cambioT - h)
      fs.nodeBlend = (fs.nodeBlend ?? 0) + ((enNodo ? 1 : 0) - (fs.nodeBlend ?? 0)) * (1 - Math.exp(-2 * h))
      if (enNodo) {
        nodeRadial.copy(bp).sub(nodoSel.pos)
        if (nodeRadial.lengthSq() < 1e-6) nodeRadial.copy(selected.up ?? Y_AXIS)
        nodeRadial.normalize()
        if (fs.nodeEnvIdx !== selected.node) { fs.nodeEnv = getNodeCameraEnvelopes(nodoSel, world); fs.nodeEnvIdx = selected.node; fs.hasRad = false }
        // marco rodante: al caminar por la esfera el marco de la cámara gira con la normal radial (sin retraso del filtro)
        if (fs.hasRad) {
          nodeRotQ.setFromUnitVectors(fs.prevRad, nodeRadial)
          fs.fwd.applyQuaternion(nodeRotQ); fs.side.applyQuaternion(nodeRotQ)
          fs.off.applyQuaternion(nodeRotQ); fs.offV.applyQuaternion(nodeRotQ)
          followUp.current.applyQuaternion(nodeRotQ); fs.posUp.applyQuaternion(nodeRotQ)
          fs.quat.premultiply(nodeRotQ)
        }
        fs.prevRad.copy(nodeRadial); fs.hasRad = true
      } else fs.hasRad = false
      const distK = selected.phase === 'travel' ? 1 : 1.15 - 0.2 * (fs.nodeBlend ?? 0)

      // marco suavizado: adelante filtrado; "arriba" = Y del mundo en el tubo (horizonte estable), normal del planeta en la ciudad, pared con H
      // en la ciudad el rumbo cambia en seco en cada esquina: se filtra más para que la cámara no barra de lado a lado
      const fwdRate = selected.phase === 'travel' ? FOLLOW_FWD_RATE : FOLLOW_FWD_RATE * 0.4
      if (selected.dir && selected.dir.lengthSq() > 1e-6) fs.fwd.lerp(selected.dir, 1 - Math.exp(-fwdRate * h))
      if (fs.fwd.lengthSq() < 1e-6) fs.fwd.copy(selected.dir ?? Y_AXIS)
      fs.fwd.normalize()
      if (enNodo) { fs.fwd.addScaledVector(nodeRadial, -fs.fwd.dot(nodeRadial)); if (fs.fwd.lengthSq() > 1e-6) fs.fwd.normalize(); else fs.fwd.copy(selected.dir ?? Y_AXIS) } // rumbo sobre el plano tangente del planeta
      const wallFollow = selected.phase === 'travel' && Boolean(selected.up)
      if (wallFollow) {
        followUp.current.lerp(selected.up, 1 - Math.exp(-WALL_UP_RATE * h))
        if (followUp.current.lengthSq() < 1e-6) followUp.current.copy(selected.up)
        followUp.current.normalize()
      } else {
        const upGoal = enNodo ? nodeRadial : selected.phase !== 'travel' && selected.up && selected.up.lengthSq() > 1e-4 ? selected.up : Y_AXIS
        followUp.current.lerp(upGoal, 1 - Math.exp(-WALL_UP_RATE * h))
        if (followUp.current.lengthSq() < 1e-6) followUp.current.copy(upGoal)
        followUp.current.normalize()
      }
      // "arriba" de la VISTA (alabeo), aparte del de colocación: en camino se inclina como mucho ROLL_MAX_* hacia
      // el de la ballita (nada en vuelo ni cambio de carril); con H desactivado sigue a la ballita como antes.
      const ce = camExtra.current
      // ce.rollRef / ce.rollLim: tope duro del alabeo final (respecto a Y o a la radial del planeta); null = libre
      if (enNodo) { upGoalV.copy(nodeRadial); ce.rollRef.copy(nodeRadial); ce.rollLim = ROLL_LIM_PLANETA }
      else if (selected.phase === 'travel' && selected.up && selected.up.lengthSq() > 1e-4) {
        const libre = horizonRef?.current === false
        const aire = Boolean(selected.seg?.air || selected.airborne || selected.flight)
        const maxA = libre ? Math.PI : aire ? 0 : selected.up.y < 0.6 ? ROLL_MAX_PARED : ROLL_MAX_CAMINO
        arribaAcotado(upGoalV, Y_AXIS, selected.up, fs.fwd, maxA)
        ce.rollRef.copy(Y_AXIS); ce.rollLim = libre ? null : maxA + ROLL_HOLGURA
      } else { upGoalV.copy(followUp.current); ce.rollRef.copy(followUp.current); ce.rollLim = ROLL_LIM_PLANETA }
      if (entrando || !(ce.viewUp.lengthSq() > 0.5)) ce.viewUp.copy(upGoalV)
      else ce.viewUp.lerp(upGoalV, 1 - Math.exp(-WALL_UP_RATE * h))
      if (ce.viewUp.lengthSq() < 1e-6) ce.viewUp.copy(upGoalV)
      ce.viewUp.normalize()
      sideVec.crossVectors(fs.fwd, followUp.current)
      if (sideVec.lengthSq() > 1e-3) fs.side.copy(sideVec.normalize()) // en tramos verticales se conserva el lateral previo
      upRefVec.crossVectors(fs.side, fs.fwd).normalize()

      let corte = false
      let corteRaw = false
      if (hasPrevPos.current) {
        const paso = mov.copy(bp).sub(prevPos.current).length()
        // teletransporte / llegada a nodo: corte de cámara en vez de cruzar el mundo interpolando
        corte = !entrando && paso > Math.max(2.5, fs.stepAvg * 5)
        fs.stepAvg += (Math.min(paso, 2.5) - fs.stepAvg) * 0.1
        // camino <-> planeta: en vez de cortar, la cámara se desliza desde donde estaba hasta la ballita
        if (corte && fs.cambioT > 0 && fs.hasAnchor) { corteRaw = true; corte = false; fs.glide.copy(camera.position).sub(bp).sub(fs.off) }
      }
      prevPos.current.copy(bp)
      hasPrevPos.current = true

      // marco de colocación: en el tubo "arriba" es el de la ballita (hacia el eje), así la cámara
      // queda dentro del tubo aunque ruede por la pared o el techo; fuera, el de la vista
      // (tras un portal o un salto la posición se funde unos cuadros hacia el tubo: hasta llegar no hay riel)
      const ejeB = selected._frame?.axis
      // Los caminos ya son pistas abiertas: no hay tubo que limite la posición de la cámara.
      const enTubo = false
      const segCam = enTubo ? selected.seg : null // en la ciudad b.seg conserva el último tramo: no cuenta
      if (segCam !== fs.seg) { fs.prevSeg = fs.seg; fs.seg = segCam }
      const upGoalPos = enTubo && selected.up ? selected.up : upRefVec
      if (corte || !fs.hasPosUp) fs.posUp.copy(upGoalPos)
      else fs.posUp.lerp(upGoalPos, 1 - Math.exp(-WALL_UP_RATE * h))
      if (fs.posUp.lengthSq() < 1e-4) fs.posUp.copy(upGoalPos)
      fs.posUp.normalize(); fs.hasPosUp = true
      // rumbo de COLOCACIÓN aplanado: en saltos, caídas y bajadas el rumbo apunta hacia abajo y "detrás" quedaba
      // encima de la ballita (mirada casi vertical, horizonte girado). En rizos se conserva (la pista es vertical).
      const rizo = /rizo|sacacorchos/.test(selected.seg?.kind ?? '')
      const aplanar = enNodo || selected.phase !== 'travel' || rizo || horizonRef?.current === false ? 0 : selected.seg?.air || selected.airborne || selected.flight ? 0.85 : 0.5
      fwdP.copy(fs.fwd); fwdP.y *= 1 - aplanar
      if (fwdP.lengthSq() < 1e-4) fwdP.copy(fs.fwd)
      fwdP.normalize()
      posSide.crossVectors(fwdP, fs.posUp)
      if (posSide.lengthSq() < 1e-4) posSide.copy(fs.side)
      posSide.normalize()
      posUpO.crossVectors(posSide, fwdP).normalize()

      // El arrastre (ver efecto de gestos) deja un desvío uYaw/uPitch; sin tocar ~1.5 s vuelve suave detrás.
      fs.idle = fs.drag ? 0 : fs.idle + h
      fs.uYaw = decayOffset(fs.uYaw, h, fs.idle)
      fs.uPitch = decayOffset(fs.uPitch, h, fs.idle)

      // objetivo: la ballita misma (rígido, sin retraso: no se sale del cuadro en curvas ni a 8×)
      // El anclaje sigue rígido adelante/arriba pero amortigua el vaivén lateral (cambios de carril): la cámara no tiembla.
      if (entrando || corte || corteRaw || !fs.hasAnchor) { fs.anchor.copy(bp); fs.hasAnchor = true }
      else {
        const lat = sideVec.copy(bp).sub(fs.anchor).dot(posSide)
        fs.anchor.copy(bp).addScaledVector(posSide, -lat * Math.exp(-FOLLOW_LAT_W * h))
      }
      // el deslizamiento mueve solo la cámara (sigue mirando a la ballita) y se disuelve en ~1 s
      fs.glide.multiplyScalar(Math.exp(-3.5 * h))
      if (fs.glide.lengthSq() < 1e-4) fs.glide.set(0, 0, 0)
      // la cámara mira un poco por delante de la ballita (hacia donde va el camino), no a ella
      lookAhead.copy(fs.anchor).addScaledVector(fs.fwd, fs.rel.dist * (selected.phase === 'travel' ? 0.5 : 0.25))
      if (enNodo) lookAhead.addScaledVector(nodeRadial, 0.5 * fs.nodeBlend)
      // más campo de visión a más velocidad (sensación de carrera)
      targetFov = FOV + THREE.MathUtils.clamp(vel * (cine ? 0.6 : 0.45), 0, cine ? 14 : 9)

      const sway = cine ? Math.sin(cineClock.current * 0.5) * 0.22 : 0
      const yaw = fs.rel.yaw + fs.uYaw + sway
      // en un planeta, si una estructura acorta el brazo, la cámara sube por encima (rodea) en vez de pegarse a la ballita
      // en vertical (teléfono) el campo horizontal es estrecho: en un planeta la cámara sube sobre la normal y mira hacia
      // abajo (los edificios son radiales, desde arriba no se interponen); con resorte, sin saltos
      ce.vert = (ce.vert ?? 0) + (((camera.aspect || 1) < 0.87 ? 1 : 0) - (ce.vert ?? 0)) * (1 - Math.exp(-3 * h))
      const pitch = Math.min(1.35, fs.rel.pitch + (NODE_PITCH_PLUS + NODE_PITCH_VERT * ce.vert) * (fs.nodeBlend ?? 0) + fs.uPitch + NODE_SUBIR * camExtra.current.subir + (cine ? Math.sin(cineClock.current * 0.31) * 0.06 : 0))
      const dist = fs.rel.dist * distK
      if (enTubo && !fs.userRel) {
        // en el tubo la cámara va sobre el propio tubo, detrás a lo largo del eje: nunca atraviesa el cristal
        // "arriba" del riel = horizonte de la vista (no el de la ballita): si rueda por la pared la cámara no la orbita
        posRiel(desiredOff, selected, fs.prevSeg, Math.cos(pitch) * dist, Math.sin(pitch) * dist, followUp.current)
        desiredOff.sub(lookAhead)
      } else {
        desiredOff.copy(fwdP).multiplyScalar(-Math.cos(pitch) * Math.cos(yaw))
          .addScaledVector(posSide, Math.cos(pitch) * Math.sin(yaw))
          .addScaledVector(posUpO, Math.sin(pitch))
          .multiplyScalar(dist)
      }
      if (entrando) {
        // transición de entrada con duración fija (antes perseguía a la ballita y a alta velocidad no terminaba)
        fs.enterT = Math.min(1, fs.enterT + h / ENTRADA_S)
        const s = fs.enterT * fs.enterT * fs.enterT * (fs.enterT * (fs.enterT * 6 - 15) + 10)
        c.target.copy(fs.startTarget).lerp(lookAhead, s)
        fs.off.copy(desiredOff); fs.offV.set(0, 0, 0)
        camera.position.copy(fs.startPos).lerp(midVec.copy(fs.anchor).add(desiredOff), s)
        if (fs.enterT >= 1) modo.current = 'siguiendo'
      } else {
        c.target.copy(lookAhead)
        if (corte) { fs.off.copy(desiredOff); fs.offV.set(0, 0, 0) }
        else springCD(fs.off, fs.offV, desiredOff, enTubo ? FOLLOW_TUBE_W : FOLLOW_OFF_W + 3 * fs.nodeBlend, h)
        camera.position.copy(fs.anchor).add(fs.off).add(fs.glide)
      }

      // Colisión de cámara contra todo lo sólido cercano (pistas, riberas, estructuras, uniones, kit, edificios, pilares):
      // si algo se interpone entre la ballita y la cámara, el brazo se acorta (rápido) y vuelve a crecer (lento).
      // Si el impacto está pegado a la cámara (a punto de entrar en una losa o bajo la calzada) se acorta en el acto.
      const colT0 = performance.now()
      const cs = colis.current
      colRefrescar(cs, bp, dist + 3 + Math.abs(vel) * COL_REFRESH, colT0 / 1000)
      const colT1 = performance.now()
      ce.pRef += (colT1 - colT0 - ce.pRef) * 0.05
      const upB =enNodo ? nodeRadial : selected.up && selected.up.lengthSq() > 0.5 ? selected.up : Y_AXIS
      let duro = 1
      if (!entrando) {
        collisionOrigin.copy(bp).addScaledVector(upB, 0.45)
        delta.copy(camera.position).sub(collisionOrigin)
        const rayLength = delta.length()
        fs.clearGoal = 1
        if (rayLength > 0.5) {
          // barrido aproximado de una esfera de ~0.3 u: rayo central y dos laterales
          let tMin = colSegmento(cs, collisionOrigin, camera.position)
          if (!enNodo) tMin = Math.min(tMin, colPistas(world, collisionOrigin, camera.position, colIgnora(selected)))
          // en un planeta el brazo nunca baja de NODE_ARM_MIN: lo que se interponga se rodea por arriba (subir) o se disuelve (OCC)
          const minT = enNodo ? Math.min(1, NODE_ARM_MIN / rayLength) : 0.02
          if (tMin < 1 && (1 - tMin) * rayLength < 0.9) duro = Math.max(minT, (tMin * rayLength - 0.25) / rayLength)
          colSide.crossVectors(delta, upB)
          if (colSide.lengthSq() < 1e-6) colSide.copy(fs.side)
          colSide.normalize()
          // rayos laterales: uno cada dos cuadros, alternando lado (cada resultado se recuerda hasta renovarse)
          if ((ce.cuadro = (ce.cuadro ?? 0) + 1) % 2 === 0) {
            const lado = (ce.lado = -(ce.lado || 0.3))
            colO2.copy(collisionOrigin).addScaledVector(colSide, lado * 0.5)
            colC2.copy(camera.position).addScaledVector(colSide, lado)
            const tLado = colSegmento(cs, colO2, colC2)
            if (lado > 0) ce.tLadoA = tLado; else ce.tLadoB = tLado
          }
          tMin = Math.min(tMin, ce.tLadoA ?? 1, ce.tLadoB ?? 1)
          if (tMin < 1) fs.clearGoal = THREE.MathUtils.clamp((tMin * rayLength - 0.4) / rayLength, Math.min(1, (enNodo ? NODE_ARM_MIN : 0.35) / rayLength), 1)
        }
        if (enNodo && fs.nodeEnv && rayLength > 0.8) {
          // estructuras del planeta: si una se interpone, el brazo se acorta (sin saltar por encima); la que contiene a la ballita no cuenta
          let tMin = 1
          for (const env of fs.nodeEnv.envelopes) {
            nodeEnvC.copy(nodoSel.pos).add(env.center)
            if (nodeEnvC.distanceToSquared(collisionOrigin) < env.radius * env.radius) continue
            tMin = Math.min(tMin, rayEnterSphere(collisionOrigin, camera.position, nodeEnvC, env.radius))
          }
          if (tMin < 1) fs.clearGoal = Math.min(fs.clearGoal, THREE.MathUtils.clamp(tMin - 0.05, Math.min(1, NODE_ARM_MIN / rayLength), 1))
        }
      }
      fs.clear += (fs.clearGoal - fs.clear) * (1 - Math.exp(-(fs.clearGoal < fs.clear ? FOLLOW_ARM_IN : FOLLOW_ARM_OUT) * h))
      // subida con histéresis: sube rápido mientras algo tapa, baja muy despacio cuando ya no (sin vaivén)
      const subirGoal = enNodo && !entrando && fs.clearGoal < 0.85 ? 1 : 0
      ce.subir += (subirGoal - ce.subir) * (1 - Math.exp(-(subirGoal > ce.subir ? 2.4 : 0.25) * h))
      const brazo = Math.min(fs.clear, duro)
      if (!entrando && brazo < 0.999) {
        collisionOrigin.copy(bp).addScaledVector(upB, 0.45)
        camera.position.sub(collisionOrigin).multiplyScalar(brazo).add(collisionOrigin)
      }
      const colT2 = performance.now()
      ce.pSeg += (colT2 - colT1 - ce.pSeg) * 0.05
      if (!entrando) {
        // por encima de la calzada que pisa la ballita (arrastrar hacia abajo o un peralte no la hunden)
        if (selected.phase === 'travel' && !selected.flight) {
          const alto = sideVec.copy(camera.position).sub(bp).dot(upB)
          if (alto < 0.5) camera.position.addScaledVector(upB, 0.5 - alto)
        }
        // fuera de cualquier superficie: empuje con resorte hasta CAM_RADIO y tope duro en CAM_RADIO_MIN
        const dn = colCercano(cs, camera.position, CAM_RADIO, colN)
        colA.copy(colN).multiplyScalar(dn < CAM_RADIO ? CAM_RADIO - dn : 0)
        ce.push.lerp(colA, 1 - Math.exp(-14 * h))
        camera.position.add(ce.push)
        if (dn < CAM_RADIO || ce.push.lengthSq() > 1e-4) {
          const dn2 = colCercano(cs, camera.position, CAM_RADIO_MIN, colN)
          if (dn2 < CAM_RADIO_MIN) camera.position.addScaledVector(colN, CAM_RADIO_MIN - dn2)
        }
      } else ce.push.set(0, 0, 0)
      // indexado: el grueso va en tiempo ocioso; con el hilo saturado (planetas) un poco en el cuadro para no dejar
      // estructuras cercanas sin colisión
      const colT3 = performance.now()
      if (cs.cola.length) colIndexar(cs, colT3 + COL_IDX_MS)
      const colMs = performance.now() - colT0
      ce.pNear += (colT3 - colT2 - ce.pNear) * 0.05
      colCoste(ce, colMs, colT0, colT1 - colT0, colT2 - colT1, colT3 - colT2, colMs - (colT3 - colT0))
      ce.msMax = Math.max(ce.msMax * 0.995, colMs)
      // Evita que la cámara se meta dentro de la esfera de un planeta (en el planeta seguido, su radio visual real).
      for (let i = 0; !enTubo && i < nodes.length; i++) {
        const np = nodes[i].pos
        const minPlanetR = enNodo && i === selected.node && fs.nodeEnv ? Math.max(NODE_R + 1.25, fs.nodeEnv.visualRadius + 0.9) : NODE_R + 1.25
        sideVec.copy(camera.position).sub(np)
        const d2 = sideVec.lengthSq()
        if (d2 < minPlanetR * minPlanetR) {
          if (d2 > 1e-6) sideVec.normalize()
          else sideVec.copy(upRefVec)
          camera.position.copy(np).addScaledVector(sideVec, minPlanetR)
        }
      }
      if (enNodo) {
        // nunca por debajo del plano local de la ballita (arrastrar hacia abajo no hunde la cámara)
        const alto = sideVec.copy(camera.position).sub(bp).dot(nodeRadial)
        if (window.__ballitasDebug) fs.info = { rb: +bp.distanceTo(nodoSel.pos).toFixed(2), vr: +(fs.nodeEnv?.visualRadius ?? 0).toFixed(2), camR: +camera.position.distanceTo(nodoSel.pos).toFixed(2), alto: +alto.toFixed(2), arm: +fs.clear.toFixed(2) }
        if (alto < 0.8) camera.position.addScaledVector(nodeRadial, 0.8 - alto)
        // brazo mínimo real: nunca a menos de NODE_ARM_MIN de la ballita; si no cabe, sube sobre la normal del planeta
        if (!entrando) {
          sideVec.copy(camera.position).sub(bp)
          const dc = sideVec.length()
          if (dc < NODE_ARM_MIN) {
            const altoN = sideVec.dot(nodeRadial)
            const horiz = Math.sqrt(Math.max(0, dc * dc - altoN * altoN))
            const nuevoAlto = Math.sqrt(Math.max(0, NODE_ARM_MIN * NODE_ARM_MIN - horiz * horiz))
            camera.position.addScaledVector(nodeRadial, nuevoAlto - altoN)
          }
        }
      }

      // Orientación: mira exacto a la ballita (siempre centrada). El "arriba" de la cámara se transporta del cuadro
      // anterior (sin giro propio) y se endereza poco a poco hacia followUp (Y del mundo, normal del planeta o pared
      // con H), con más fuerza cuanto mejor definido esté: lookAt con Y fija daba medio giro al pasar por la vertical.
      // se mira a la ballita (no al objetivo, que en la entrada aún viaja desde la vista anterior y la dejaba fuera de cuadro)
      // encuadre: la ballita va al punto libre de la interfaz (se relee cada 0.5 s y se mueve suave)
      const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const aspecto = camera.aspect || 1
      const nowS = colT0 / 1000
      if (nowS - ce.encT > 0.5) {
        ce.encT = nowS
        const rb = 0.75 / (Math.max(0.5, camera.position.distanceTo(bp)) * tanH) // radio aparente de la ballita (NDC)
        encuadreUI(gl.domElement, ce.encGoal, Math.min(0.5, rb / aspecto + 0.08), Math.min(0.5, rb + 0.08))
      }
      const kEnc = entrando ? 1 : 1 - Math.exp(-2.5 * h)
      ce.enc.x += (ce.encGoal.x - ce.enc.x) * kEnc; ce.enc.y += (ce.encGoal.y - ce.enc.y) * kEnc
      viewDir.copy(bp).sub(camera.position)
      if (viewDir.lengthSq() > 1e-8) {
        viewDir.normalize()
        upRefVec.set(0, 1, 0).applyQuaternion(fs.quat)
        upRefVec.addScaledVector(viewDir, -upRefVec.dot(viewDir))
        sideVec.copy(ce.viewUp).addScaledVector(viewDir, -ce.viewUp.dot(viewDir))
        // mirada casi vertical: el "arriba" proyectado se degenera; el rumbo hace de arriba en pantalla
        const casiVertical = 1 - THREE.MathUtils.smoothstep(sideVec.length(), 0.25, 0.55)
        if (casiVertical > 0) { rollT.copy(fwdP).addScaledVector(viewDir, -fwdP.dot(viewDir)); sideVec.addScaledVector(rollT, casiVertical) }
        const fuerza = sideVec.length()
        if (corte || entrando || upRefVec.lengthSq() < 1e-6) { if (fuerza > 1e-3) upRefVec.copy(sideVec) }
        else if (fuerza > 1e-3) {
          // giro alrededor de la mirada hacia el objetivo (ángulo con signo: sin degenerar a 180°, sin medio giro)
          upRefVec.normalize(); sideVec.divideScalar(fuerza)
          const ang = Math.atan2(rollT.crossVectors(upRefVec, sideVec).dot(viewDir), upRefVec.dot(sideVec))
          upRefVec.applyAxisAngle(viewDir, ang * (1 - Math.exp(-FOLLOW_ROLL_W * 1.6 * h)))
        }
        if (upRefVec.lengthSq() < 1e-6) upRefVec.set(0, 1, 0).applyQuaternion(fs.quat)
        upRefVec.normalize()
        sideVec.crossVectors(viewDir, upRefVec).normalize()
        upRefVec.crossVectors(sideVec, viewDir)
        rollMat.makeBasis(sideVec, upRefVec, midVec.copy(viewDir).negate())
        rotGoal.setFromRotationMatrix(rollMat).multiply(giroEncuadre(ce.enc.x, ce.enc.y, camera.fov, aspecto))
        if (corte) fs.quat.copy(rotGoal)
        else {
          // zona muerta: la mirada se suaviza y la ballita puede moverse dentro del tercio central, nunca fuera
          // (en la entrada gira más rápido y con zona amplia: nada de saltos, pero la ballita entra a cuadro desde el inicio)
          fs.quat.slerp(rotGoal, 1 - Math.exp(-(entrando ? 4 * FOLLOW_ROT_W : FOLLOW_ROT_W) * h))
          // la zona es una elipse dentro del tercio central de la pantalla (más ancha en horizontal)
          midVec.copy(viewDir).applyQuaternion(occQuat.copy(fs.quat).invert())
          const zona = entrando ? 0.8 : FOLLOW_ZONA
          const z = Math.max(1e-4, -midVec.z)
          const fuera = midVec.z >= 0 ? 4 : Math.hypot((midVec.x / (z * tanH * aspecto) - ce.enc.x) / zona, (midVec.y / (z * tanH) - ce.enc.y) / zona)
          if (fuera > 1) fs.quat.slerp(rotGoal, 1 - 1 / fuera)
        }
        if (!entrando) topeAlabeo(fs.quat, ce.rollRef, ce.rollLim)
        camera.quaternion.copy(fs.quat)
      }
      // disco de oclusión en pantalla: todo lo que esté delante de la ballita y la tape se disuelve
      camera.updateMatrixWorld()
      const dCam = camera.position.distanceTo(bp)
      if (dCam > 1.2) {
        gl.getDrawingBufferSize(occSize)
        occNdc.copy(bp).sub(camera.position).multiplyScalar((dCam - 0.75) / dCam).add(camera.position).project(camera)
        OCC.z = occNdc.z * 0.5 + 0.5
        occNdc.copy(bp).project(camera)
        OCC.x = (occNdc.x * 0.5 + 0.5) * occSize.x
        OCC.y = (occNdc.y * 0.5 + 0.5) * occSize.y
        OCC.w = (0.62 / (dCam * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)))) * occSize.y * 0.5
      }
      fs.lastOff.copy(camera.position).sub(c.target)
      fs.hasLast = true
    } else if (modo.current !== 'libre') {
      hasPrevPos.current = false
      modo.current = 'volviendo'
      const k = 1 - Math.exp(-3 * h)
      const destino = casa()
      c.target.lerp(mundo.center, k)
      camera.position.lerp(destino, k)
      if (camera.position.distanceTo(destino) < mundo.r * 0.01) modo.current = 'libre'
    } else if (cine && !userActive.current && performance.now() - lastTouch.current > 1200) {
      // Vista general cinematográfica: órbita lenta con deriva vertical suave
      off.copy(camera.position).sub(c.target)
      off.applyAxisAngle(Y_AXIS, 0.09 * h)
      const dist = off.length()
      if (dist > 1e-4) {
        const driftY = Math.sin(cineClock.current * 0.24) * 0.045 * h * dist
        off.y = THREE.MathUtils.clamp(off.y + driftY, -dist * 0.55, dist * 0.72)
        off.setLength(dist)
        camera.position.copy(c.target).add(off)
      }
    }

    let projDirty = false
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov = THREE.MathUtils.damp(camera.fov, targetFov, 4.5, h)
      projDirty = true
    }
    if (Math.abs(camera.near - targetNear) > 0.001) {
      camera.near = targetNear
      projDirty = true
    }
    if (projDirty) camera.updateProjectionMatrix()
    const dbg = typeof window !== 'undefined' && window.__ballitasDebug // sólo con ?stats=1: sondeo de la cámara
    if (dbg) {
      const ce = camExtra.current
      dbg.cam = { selected, camera, target: c.target, modo: modo.current, THREE, nodes, bp: bpVec, info: { ...followRef.current.info, colMedia5s: +(ce.colV?.media ?? 0).toFixed(3), colPico5s: +(ce.colV?.pico ?? 0).toFixed(2), colPicos5s: ce.colV?.picos }, colis: colis.current, colGolpe: colis.current.golpe ? `${colis.current.golpe.g.etq}${colis.current.golpe.o ? '' : '[i]'}|${colis.current.golpe.o?.material?.type ?? ''}|r${Math.round(colis.current.golpe.r)}` : null, arm: +followRef.current.clear.toFixed(2), armGoal: +followRef.current.clearGoal.toFixed(2),colMs: +ce.msEma.toFixed(3), colMsMax: +ce.msMax.toFixed(2), colN: colis.current.cols.length, colCola: colis.current.cola.length, colColaEtq: colis.current.cola.slice(0, 4).map((g) => `${g.etq}@${g.fase}:${g.next}`), colHechas: (colis.current.hechas ?? []).slice(-8), colProf: [ce.pRef, ce.pSeg, ce.pNear].map((x) => +x.toFixed(3)), enc: { ...ce.enc } }
    }
  })

  // Si el usuario toma el control en plena transición, la transición se corta (no se le pelea la cámara).
  const alTocar = () => {
    userActive.current = true
    if (modo.current === 'entrando') modo.current = 'siguiendo'
    if (modo.current === 'volviendo') modo.current = 'libre'
  }
  const alSoltar = () => {
    userActive.current = false
    lastTouch.current = performance.now()
  }

  return (
    <OrbitControls
      ref={controls}
      enabled={!povActive && !suspend && !followActive}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={MIN_DIST}
      maxDistance={mundo.r * 6}
      onStart={alTocar}
      onEnd={alSoltar}
    />
  )
}

// Luz principal con sombras. Solo proyecta sombras al seguir una ballita / POV para ahorrar GPU en vista general.
function Sol({ r, shadowsOn, selected }) {
  const luz = useRef()
  const controls = useThree((s) => s.controls)
  // castShadow fijo: alternarlo cambia el hash de luces y recompila todos los shaders (cuadros de segundos).
  // Fuera de la vista de ballita la sombra ni se renderiza ni se ve.
  useEffect(() => {
    if (!luz.current) return
    luz.current.shadow.autoUpdate = shadowsOn
    luz.current.shadow.intensity = shadowsOn ? 1 : 0
  }, [shadowsOn])
  useFrame(() => {
    if (!luz.current) return
    const tgt = shadowsOn && selected && selected.phase !== 'gone' ? selected.pos : controls?.target
    if (!tgt) return
    luz.current.target.position.copy(tgt)
    luz.current.target.updateMatrixWorld()
    luz.current.position.copy(tgt).addScaledVector(SOL_DIR, r)
  })
  return (
    <directionalLight
      ref={luz}
      castShadow
      intensity={1.35}
      color="#ffe6c4"
      shadow-mapSize={[512, 512]}
      shadow-bias={-0.0005}
      shadow-normalBias={0.03}
      shadow-radius={1.5}
    >
      <orthographicCamera attach="shadow-camera" args={[-16, 16, 16, -16, 1, r * 2.5]} />
    </directionalLight>
  )
}

const CA_ON = [0.00045, 0.00045]
const CA_OFF = [0, 0]
// DoF siempre montado (PerformanceMonitor cambia dpr/lowPerf a menudo); dofOn = activo en esta vista.
function PostFX({ dofOn, selected, highQuality }) {
  const dofRef = useRef()
  const controls = useThree((s) => s.controls)
  const dofTarget = useMemo(() => new THREE.Vector3(), [])

  // DoF siempre montado: apagarlo con DST lo saca del shader sin recrear el EffectMaterial
  // (three guarda ambas variantes del programa en el mismo material) y se omiten sus pasadas.
  // Se aplica en useFrame: el ref del efecto llega después de los efectos de PostFX y puede recrearse.
  // Calentamiento: con el mapa ya pintado y el hilo libre, un cuadro con DoF activo compila sus
  // programas (CoC, Bokeh, Kawase, variante del EffectMaterial) para que la primera Ballita no los compile.
  const warm = useRef(0) // 0 pendiente, 1 este cuadro, 2 hecho
  const gl = useThree((s) => s.gl)
  const getR3f = useThree((s) => s.get)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    // con plazo: si los cuadros no dejan hueco libre, sin timeout no llegaba a correr nunca
    const idle = window.requestIdleCallback ? (f) => window.requestIdleCallback(f, { timeout: 800 }) : (f) => setTimeout(f, 1)
    // Además, compila en paralelo todo lo montado aunque esté oculto (LOD de nodos, pieles, variantes
    // cercanas): sin esto, acercarse por primera vez (Camino/Ballita) esperaba su enlace dentro del cuadro.
    // La cámara se lee al correr (no es dependencia): si cambiaba de objeto, el plazo de 2,5 s volvía a empezar y el
    // precalentado llegaba tarde (medido: aún sin hacer a los 8 s de cargar, y caía justo al entrar a Ballita).
    // Cuenta desde el primer cuadro pintado, no desde el montaje (el primer cuadro con todo el mundo tarda segundos).
    let t = 0
    const raf = requestAnimationFrame(() => {
      t = setTimeout(() => idle(() => {
        if (warm.current === 0) warm.current = 1
        const camera = getR3f().camera
        gl.capabilities.getMaxAnisotropy() // consulta síncrona a la GPU (>100 ms con la cola llena); se cachea aquí
        // ANGLE resuelve el enlace real en la primera consulta de uniforms (cientos de ms por programa):
        // se fuerza aquí, uno por hueco libre del mapa, en vez de en el primer cuadro de Camino/Ballita.
        // y el primer dibujo oculto de cada programa (detalle cercano de planetas y ciudades, oculto en el mapa): sin
        // él, la primera llegada a un nodo pagaba la traducción nativa de ANGLE dentro del cuadro (cuadros de 1-2 s)
        Promise.all([precompilar(gl, scene, camera, scene), precompilarSombra(gl, camera, scene)]).then(() => enlazarPendientes(gl))
          .then(() => primerDibujo(gl, scene, scene, camera))
        if (window.__enlace) window.__enlace.calentado = Math.round(performance.now())
      }), 1500)
    })
    return () => { cancelAnimationFrame(raf); clearTimeout(t) }
  }, [gl, getR3f, scene])

  useFrame(() => {
    const e = dofRef.current
    if (!e) return
    if (!e.__update) e.__update = e.update
    const on = dofOn || warm.current === 1
    if (warm.current === 1 && e.update === e.__update && e.blendMode.blendFunction === BlendFunction.NORMAL) warm.current = 2
    const upd = on ? e.__update : NOOP_UPDATE
    if (e.update !== upd) e.update = upd
    const bf = on ? BlendFunction.NORMAL : BlendFunction.DST
    if (e.blendMode.blendFunction !== bf) e.blendMode.blendFunction = bf
    if (!dofOn || !e.target) return
    if (selected && selected.phase !== 'gone') dofRef.current.target.copy(selected.pos)
    else if (controls) dofRef.current.target.copy(controls.target)
  })

  return (
    <EffectComposer multisampling={0}>
      {/* Composición fija: montar/desmontar efectos recrea el EffectPass y recompila; la calidad alta solo cambia props */}
      <SMAA />
      <DepthOfField
        ref={dofRef}
        target={dofTarget}
        worldFocusRange={36}
        bokehScale={0.75}
        resolutionScale={0.5}
      />
      <Bloom mipmapBlur luminanceThreshold={1.0} luminanceSmoothing={0.2} radius={0.75} intensity={highQuality ? 0.85 : 0.7} />
      <ChromaticAberration offset={highQuality ? CA_ON : CA_OFF} radialModulation modulationOffset={0.35} />
      <Vignette eskil={false} offset={0.22} darkness={highQuality ? 0.48 : 0.45} />
      <Noise opacity={highQuality ? 0.025 : 0} />
      <ToneMapping mode={TONE_MAPPING_AGX} middleGrey={0.52} />
    </EffectComposer>
  )
}

export default function Scene({ sim, ballitas, speed, selected, follow, pov = false, cine = false, showStats = false, onStatsSample, onSelect, onExitPov, vista = 'mapa', activeWay = null, routeIndex = 0, seek = null, caminoSpeed = 0.05, caminoPaused = false, progressRef, onSelectWay }) {
  const supIdx = useSuperficie()
  const supOn = supIdx != null && Boolean(sim.world.nodes[supIdx])
  const mundo = useMemo(() => medirMundo(sim.world.nodes), [sim])
  const { center, r } = mundo
  const povActive = Boolean(pov && selected && selected.phase !== 'gone')
  const dofOn = Boolean(follow && selected && selected.phase !== 'gone')
  const cameraWay = activeWay ?? (vista !== 'camino' && selected && selected.phase !== 'gone' ? (selected.seg?.way ?? selected.way ?? null) : null)
  const focusWay = activeWay?.idx ?? null
  const camino = vista === 'camino'
  const caminoOn = Boolean(camino && cameraWay)
  const forceFocusDetail = Boolean(camino || ((follow || pov) && selected && selected.phase !== 'gone'))
  const focusedWay = camino ? cameraWay?.idx ?? focusWay : (vista === 'mapa' ? focusWay : (selected && selected.phase !== 'gone' ? (selected.seg?.way?.idx ?? selected.way?.idx ?? null) : null))
  // Carga predictiva: con la cámara en una ballita, los caminos que salen del nodo al que va (o en el que
  // está, si aún no eligió) se montan ocultos y compilados antes de que entre en ellos.
  const nodoSig = !forceFocusDetail || camino || !selected ? null
    : selected.phase === 'travel' ? selected.way?.to : (selected.way ? null : selected.node)
  const prefetchKey = nodoSig == null ? '' : (sim.world.waysFrom[nodoSig] ?? []).map((w) => w.idx).filter((i) => i !== focusedWay).join(',')
  const prefetchWays = useMemo(() => (prefetchKey ? prefetchKey.split(',').map(Number) : null), [prefetchKey])

  const povControlRef = useRef(createPovState())
  const canvasDomRef = useRef(null)
  const [pointerLocked, setPointerLocked] = useState(false)
  const pointerLockedRef = useRef(false)
  const wasLockedRef = useRef(false)
  const suppressNextEscRef = useRef(false)
  const [gyroActive, setGyroActive] = useState(false)
  const gyroActiveRef = useRef(false)
  const [gyroNote, setGyroNote] = useState(null)
  // Horizonte estable (tecla H): la cámara mantiene el up del mundo en vez de girar con la pared.
  const horizonRef = useRef(true) // por defecto estable: sin roll
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key.toLowerCase() !== 'h') return
      horizonRef.current = !horizonRef.current
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  const cameraOnBall = Boolean((povActive || follow) && selected && selected.phase !== 'gone')
  const [dpr, setDpr] = useState(1)
  const [lowPerf, setLowPerf] = useState(false)
  const highQualityFx = cameraOnBall && !lowPerf
  const ultraQualityFx = highQualityFx && dpr >= 1.25

  const handlePerfDecline = useCallback(() => {
    setDpr((prev) => Math.max(0.6, Number((prev - 0.15).toFixed(2))))
    setLowPerf(true)
  }, [])
  const handlePerfIncline = useCallback(() => {
    setDpr((prev) => Math.min(1.5, Number((prev + 0.15).toFixed(2))))
    setLowPerf(false)
  }, [])
  const handlePerfChange = useCallback(({ factor }) => {
    const next = Number((0.6 + factor * 0.9).toFixed(2))
    setDpr((prev) => (Math.abs(prev - next) >= 0.08 ? next : prev))
    setLowPerf(factor < 0.65)
  }, [])

  const handleCanvasReady = useCallback((dom) => {
    canvasDomRef.current = dom
  }, [])

  // Limpia estados de bloqueo y giroscopio al salir de POV.
  useEffect(() => {
    if (povActive) return
    setGyroActive(false)
    gyroActiveRef.current = false
    setGyroNote(null)
    suppressNextEscRef.current = false
    const dom = canvasDomRef.current
    if (dom && document.pointerLockElement === dom) {
      try { document.exitPointerLock?.() } catch {}
    }
  }, [povActive])

  // Sincroniza el estado de Pointer Lock y gestiona Esc en dos pasos (1º suelta cursor, 2º sale de POV).
  useEffect(() => {
    if (!povActive) return undefined
    let suppressTimer = null

    const onLockChange = () => {
      const dom = canvasDomRef.current
      const locked = Boolean(dom && document.pointerLockElement === dom)
      if (wasLockedRef.current && !locked) {
        suppressNextEscRef.current = true
        if (suppressTimer) clearTimeout(suppressTimer)
        suppressTimer = setTimeout(() => { suppressNextEscRef.current = false }, 220)
      }
      wasLockedRef.current = locked
      pointerLockedRef.current = locked
      setPointerLocked(locked)
      if (dom) dom.style.cursor = locked ? 'none' : 'grab'
    }

    const onLockError = () => {
      wasLockedRef.current = false
      pointerLockedRef.current = false
      setPointerLocked(false)
    }

    const onEscapeCapture = (e) => {
      if (e.key !== 'Escape') return
      if (document.pointerLockElement) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        suppressNextEscRef.current = false
        try { document.exitPointerLock?.() } catch {}
        return
      }
      if (suppressNextEscRef.current) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation?.()
        suppressNextEscRef.current = false
        return
      }
      if (onExitPov) {
        e.preventDefault()
        e.stopPropagation()
        onExitPov()
      }
    }

    document.addEventListener('pointerlockchange', onLockChange)
    document.addEventListener('pointerlockerror', onLockError)
    window.addEventListener('keydown', onEscapeCapture, true)
    return () => {
      if (suppressTimer) clearTimeout(suppressTimer)
      document.removeEventListener('pointerlockchange', onLockChange)
      document.removeEventListener('pointerlockerror', onLockError)
      window.removeEventListener('keydown', onEscapeCapture, true)
      wasLockedRef.current = false
      pointerLockedRef.current = false
      setPointerLocked(false)
    }
  }, [povActive, onExitPov])

  // Giroscopio (DeviceOrientation) opcional activado por el usuario.
  useEffect(() => {
    if (!povActive || !gyroActive) {
      gyroActiveRef.current = false
      povControlRef.current.gyroYaw = 0
      povControlRef.current.gyroPitch = 0
      return undefined
    }
    gyroActiveRef.current = true
    povControlRef.current.gyroReset = true
    let gotReading = false
    const deg2rad = Math.PI / 180
    const qBase = new THREE.Quaternion()
    const zee = new THREE.Vector3(0, 0, 1)
    const euler = new THREE.Euler()
    const q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5))
    const q0 = new THREE.Quaternion()
    const qDev = new THREE.Quaternion()
    const qRel = new THREE.Quaternion()
    const relEuler = new THREE.Euler()

    const onOrient = (e) => {
      if (e.alpha == null && e.beta == null && e.gamma == null) return
      if (!gotReading) {
        gotReading = true
        setGyroNote(null)
      }
      const alpha = (e.alpha ?? 0) * deg2rad
      const beta = (e.beta ?? 0) * deg2rad
      const gamma = (e.gamma ?? 0) * deg2rad
      const orient = (window.screen?.orientation?.angle ?? window.orientation ?? 0) * deg2rad
      euler.set(beta, alpha, -gamma, 'YXZ')
      qDev.setFromEuler(euler)
      qDev.multiply(q1)
      qDev.multiply(q0.setFromAxisAngle(zee, -orient))

      if (povControlRef.current.gyroReset) {
        qBase.copy(qDev).invert()
        povControlRef.current.gyroReset = false
        povControlRef.current.gyroYaw = 0
        povControlRef.current.gyroPitch = 0
        return
      }
      qRel.copy(qBase).multiply(qDev)
      relEuler.setFromQuaternion(qRel, 'YXZ')
      povControlRef.current.gyroYaw = wrapAngle(relEuler.y)
      povControlRef.current.gyroPitch = THREE.MathUtils.clamp(relEuler.x, -POV_PITCH_MAX, POV_PITCH_MAX)
    }

    const onScreenOrient = () => {
      povControlRef.current.gyroReset = true
    }

    const noDataTimer = setTimeout(() => {
      if (!gotReading) setGyroNote('Sin lecturas de giroscopio en este dispositivo')
    }, 1500)

    window.addEventListener('deviceorientation', onOrient)
    window.addEventListener('orientationchange', onScreenOrient)
    return () => {
      clearTimeout(noDataTimer)
      window.removeEventListener('deviceorientation', onOrient)
      window.removeEventListener('orientationchange', onScreenOrient)
      gyroActiveRef.current = false
      povControlRef.current.gyroYaw = 0
      povControlRef.current.gyroPitch = 0
    }
  }, [povActive, gyroActive])

  const handleCenter = useCallback(() => {
    povControlRef.current.centerRequested = true
  }, [])

  const handleTogglePointerLock = useCallback(() => {
    const dom = canvasDomRef.current
    if (!dom) return
    if (document.pointerLockElement === dom) {
      try { document.exitPointerLock?.() } catch {}
      return
    }
    if (!dom.requestPointerLock) return
    try {
      const res = dom.requestPointerLock()
      if (res && typeof res.catch === 'function') res.catch(() => {})
    } catch {}
  }, [])

  const handleToggleGyro = useCallback(async () => {
    if (gyroActive) {
      setGyroActive(false)
      setGyroNote(null)
      return
    }
    if (typeof window === 'undefined' || !('DeviceOrientationEvent' in window)) {
      setGyroNote('Giroscopio no disponible')
      return
    }
    const DOE = window.DeviceOrientationEvent
    if (typeof DOE.requestPermission === 'function') {
      try {
        const perm = await DOE.requestPermission()
        if (perm !== 'granted') {
          setGyroNote('Permiso de giroscopio denegado')
          return
        }
      } catch {
        setGyroNote('No se pudo activar el giroscopio')
        return
      }
    }
    setGyroNote(null)
    setGyroActive(true)
  }, [gyroActive])

  return (
    <>
      <Canvas
      frameloop={supOn ? 'never' : 'always'}
      style={supOn ? { visibility: 'hidden', pointerEvents: 'none' } : undefined}
      shadows="soft"
      // De cerca el coste es de relleno (postFX y tubo a pantalla completa): DPR 1,5 -> 1,0 pasa de ~20-30 a ~48-57 FPS.
      dpr={Math.min(dpr, DPR_CERCA)}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
      camera={{ fov: FOV, near: NEAR_DEFAULT, far: r * 20 }}
      // En producción no se lee el log de cada programa: getProgramInfoLog espera la compilación en el primer
      // uso (~130 ms al entrar a Camino) aunque el enlace paralelo (KHR_parallel_shader_compile) siga en curso.
      onCreated={({ gl }) => { gl.debug.checkShaderErrors = import.meta.env.DEV }}
      onPointerMissed={() => { if (!povActive && !camino) onSelect(null) }}
    >
      <PerformanceMonitor
        ms={120}
        iterations={3}
        flipflops={3}
        bounds={() => [30, 55]}
        step={0.2}
        onDecline={handlePerfDecline}
        onIncline={handlePerfIncline}
        onChange={handlePerfChange}
      />
      {!supOn && <fogExp2 attach="fog" args={['#050711', 0.32 / r]} />}

      {/* Con la superficie abierta la escena general no se dibuja (visible=false) y no se paga doble. */}
      <group visible={!supOn}>
      {/* fondo: cúpula oscura + nebulosa FBM + estrellas, centradas en el mundo */}
      {/* fondo en capas con parallax: cuanto más lejana la capa, más sigue a la cámara (se desplaza menos).
          Radios + desplazamiento máximo (zoom 6r) quedan bajo far 20r: nada se recorta. */}
      <Parallax center={center} follow={1}>
        <mesh scale={r * 12}>
          <sphereGeometry args={[1, 24, 12]} />
          <meshBasicMaterial side={THREE.BackSide} depthWrite={false} fog={false}>
            <GradientTexture stops={[0, 0.55, 1]} colors={['#0d1124', '#060812', '#020307']} />
          </meshBasicMaterial>
        </mesh>
      </Parallax>
      <Parallax center={center} follow={0.92}>
        <NebulaDome r={r} />
        <Galaxias r={r} />
        <Supernovas r={r} />
        <Stars radius={r * 8} depth={r * 2} count={900} factor={Math.max(3, r * 0.065)} saturation={0.3} fade speed={0.2} />
      </Parallax>
      <Parallax center={center} follow={0.6}>
        <Stars radius={r * 5.5} depth={r * 1.2} count={220} factor={Math.max(4, r * 0.1)} saturation={0.5} fade speed={0.4} />
      </Parallax>
      <Parallax center={center} follow={0.25}>
        <Stars radius={r * 3.2} depth={r * 0.8} count={70} factor={Math.max(5, r * 0.13)} saturation={0.7} fade speed={0.6} />
      </Parallax>

      {/* Iluminación con contraste: clave cálida + relleno frío tenue */}
      <Sol r={r} shadowsOn={cameraOnBall} selected={selected} />
      <hemisphereLight args={['#9bb6f0', '#161124', 0.22]} />
      <directionalLight position={[-1, 0.25, -1]} intensity={0.25} color="#6d92e8" />
      </group>

      {/* entorno generado en local (sin HDR de red): reflejos sutiles en cristal y esferas */}
      <Environment resolution={128} frames={1} environmentIntensity={0.45}>
        <color attach="background" args={['#06091a']} />
        <Lightformer form="rect" intensity={1.6} color="#dce8ff" position={[0, 8, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#7ea6f5" position={[-8, 2, 4]} rotation-y={Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#f0a378" position={[8, 1, -4]} rotation-y={-Math.PI / 2} scale={[10, 4, 1]} />
        <Lightformer form="ring" intensity={1.1} color="#9a7ad8" position={[0, -2, -9]} scale={4} />
      </Environment>

      <SimDriver sim={sim} speed={speed} />
      <group visible={!supOn}>
      <Nodes world={sim.world} />
      <Paths world={sim.world} sim={sim} focusWay={focusedWay} prefetchWays={prefetchWays} worldRadius={r} forceFocusDetail={forceFocusDetail} cameraOnBall={cameraOnBall} onPickWay={vista === 'mapa' ? onSelectWay : undefined} />
      {/* Precompilado: las ballitas nacen con pieles nuevas tras el precompilado inicial; sin esto la primera
          vez que entran en cuadro (al acercarse en Camino/Ballita) se esperaba su enlace dentro del cuadro. */}
      {ballitas.map((b) => (
        <Precompilado key={b.id}>
          <NodeLift b={b} world={sim.world}>
          <Ballita
            b={b}
            sim={sim}
            selected={selected === b}
            pov={pov && selected === b}
            follow={follow && selected === b}
            povMode={povActive}
            worldRadius={r}
            onSelect={povActive ? NOOP : onSelect}
          />
          </NodeLift>
        </Precompilado>
      ))}
      </group>
      <CameraRig
        mundo={mundo}
        world={sim.world}
        nodes={sim.world.nodes}
        selected={selected}
        follow={follow}
        pov={pov}
        cine={cine}
        suspend={caminoOn || supOn}
        povControlRef={povControlRef}
        pointerLockedRef={pointerLockedRef}
        gyroActiveRef={gyroActiveRef}
        horizonRef={horizonRef}
        onCanvasReady={handleCanvasReady}
      />
      <PostFX dofOn={dofOn && ultraQualityFx} selected={selected} highQuality={highQualityFx} />
      <InstanceCuller active={vista !== 'mapa'} />
      <StatsProbe active={showStats} onSample={onStatsSample} />
      <VistaCamino way={cameraWay} routeIndex={routeIndex} seek={seek} speed={caminoSpeed} paused={caminoPaused} active={caminoOn} progressRef={progressRef} />
    </Canvas>
    {supOn && <Superficie world={sim.world} nodeIdx={supIdx} ballitas={ballitas} onSalir={cerrarSuperficie} showStats={showStats} onStatsSample={onStatsSample} />}
    <PovPanel
      active={povActive}
      povControlRef={povControlRef}
      pointerLocked={pointerLocked}
      gyroActive={gyroActive}
      gyroNote={gyroNote}
      onCenter={handleCenter}
      onTogglePointerLock={handleTogglePointerLock}
      onToggleGyro={handleToggleGyro}
      onExitPov={() => onExitPov?.()}
    />
    </>
  )
}
