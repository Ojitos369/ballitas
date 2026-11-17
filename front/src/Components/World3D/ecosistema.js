// Ecosistema y transiciones naturales de cada camino (puro: sin React ni WebGL; lo prueba ecosistema.test.js).
// Dos familias de piezas, todas con color de vértice y atributos de animación horneados en la geometría
// (aFx = tipo, fase, velocidad, amplitud; aCen = centro de la partícula + brillo), de modo que un único
// uniform de tiempo las anima en el vertex shader (ver Ecosistema.jsx): ningún useFrame por instancia.
//   · DETALLES (`s:<forma>`): fauna y flora del ecosistema del tema (hongos, corales, saguaros, auroras...),
//     repartidos a lo largo del camino con densidad por unidad de longitud.
//   · PIEZAS (`mouth|geiser|volcan|cascada|bruma|portal|rampa:<tema>`): transiciones naturales donde el camino
//     llega a un nodo, se bifurca/une o cambia de ritmo (raíces, rampas de roca/hielo/arena, volcanes en
//     erupción, géiseres, cascadas, remolinos, nubes, flores...). Se construyen con radio de tubo 1 y se
//     escalan por segment.radius: nada depende del tamaño del mapa.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../Core/world.js'

const PI = Math.PI
const TAU = PI * 2
const Yw = new THREE.Vector3(0, 1, 0)
const _m = new THREE.Matrix4(); const _q = new THREE.Quaternion(); const _e = new THREE.Euler()
const _s = new THREE.Vector3(); const _p = new THREE.Vector3(); const _v = new THREE.Vector3()
const vec3 = (s) => (typeof s === 'number' ? [s, s, s] : s ?? [1, 1, 1])

// Tipos de animación (aFx.x): 0 estático, 1 vaivén, 2 sube/cae en bucle, 3 pulso de brillo, 4 órbita,
// 5 flotar, 6 géiser (ciclo de erupción), 7 giro sobre el eje del tubo (Z), 8 flujo de lava/energía,
// 9 balístico (erupción), 10 giro sobre Y, 11 cascada (franjas que bajan).
const F = (k, sp = 0.2, am = 0.3, ph = 0) => [k, ph, sp, am]

// Pieza con transformación horneada, color y animación por vértice.
function P(geo, col, o = {}) {
  const pos = o.pos ?? [0, 0, 0]
  const g = geo.index ? geo.toNonIndexed() : geo
  if (g !== geo) geo.dispose()
  g.deleteAttribute('uv')
  g.applyMatrix4(_m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...(o.rot ?? [0, 0, 0]))), _s.set(...vec3(o.scl))))
  const n = g.attributes.position.count
  const c = new THREE.Color(col)
  const cA = new Float32Array(n * 3); const fA = new Float32Array(n * 4); const nA = new Float32Array(n * 4)
  const fx = o.fx ?? [0, 0, 0, 0]; const cen = o.cen ?? pos
  for (let i = 0; i < n; i++) {
    cA[i * 3] = c.r; cA[i * 3 + 1] = c.g; cA[i * 3 + 2] = c.b
    fA.set(fx, i * 4)
    nA[i * 4] = cen[0]; nA[i * 4 + 1] = cen[1]; nA[i * 4 + 2] = cen[2]; nA[i * 4 + 3] = o.glow ?? 0
  }
  g.setAttribute('color', new THREE.BufferAttribute(cA, 3))
  g.setAttribute('aFx', new THREE.BufferAttribute(fA, 4))
  g.setAttribute('aCen', new THREE.BufferAttribute(nA, 4))
  return g
}

// Recoloca un grupo de piezas ya hechas (mueve también el centro de cada partícula).
function place(parts, o = {}) {
  const M = new THREE.Matrix4().compose(new THREE.Vector3(...(o.pos ?? [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0]))), new THREE.Vector3(...vec3(o.scl)))
  for (const g of parts) {
    g.applyMatrix4(M)
    const a = g.attributes.aCen
    for (let i = 0; i < a.count; i++) { _v.set(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(M); a.setXYZ(i, _v.x, _v.y, _v.z) }
  }
  return parts
}

const sph = (r, w = 6, h = 4) => new THREE.SphereGeometry(r, w, h)
const hemi = (r, w = 8, h = 3) => new THREE.SphereGeometry(r, w, h, 0, TAU, 0, PI / 2)
const cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s).translate(0, h / 2, 0)
const cyl = (rb, rt, h, s = 6) => new THREE.CylinderGeometry(rt, rb, h, s).translate(0, h / 2, 0)
const box = (x, y, z) => new THREE.BoxGeometry(x, y, z).translate(0, y / 2, 0)
const oct = (r) => new THREE.OctahedronGeometry(r, 0)
const ico = (r) => new THREE.IcosahedronGeometry(r, 0)
const tor = (R, r, rs = 3, ts = 12, arc = TAU) => new THREE.TorusGeometry(R, r, rs, ts, arc)

// Nube de partículas (n piezas sueltas) dentro de una caja; cada una con fase propia.
function swarm(n, seed, [sx, sy, sz], geo, col, { y0 = 0, k = 2, sp = 0.2, am = 2, glow = 0 } = {}) {
  const r = mulberry32(seed)
  return Array.from({ length: n }, () => P(geo(), col, { pos: [(r() - 0.5) * sx, y0 + r() * sy, (r() - 0.5) * sz], fx: F(k, sp * (0.7 + r() * 0.6), am, r() * TAU), glow }))
}

// Cuña que sube hacia +Z (rampa): y0 base, y1 cara superior atrás, y2 cara superior al frente.
function wedge(w, len, y0, y1, y2, col, o) {
  const g = new THREE.BoxGeometry(w, 1, len)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) > 0 ? y1 + (y2 - y1) * (p.getZ(i) / len + 0.5) : y0)
  g.computeVertexNormals()
  return P(g, col, o)
}
const rampa = (col, glow = 0, k = 0) => [
  wedge(2.8, 2.6, -1.75, -1.6, -0.9, col, { glow, fx: F(k, 0.3, 0, 0) }),
  P(box(2.8, 0.1, 0.12), new THREE.Color(col).offsetHSL(0, 0, 0.08), { pos: [0, -0.95, 1.3], glow }),
]

// Raíces / zarcillos que abrazan la boca (arco sobre la mitad superior, el suelo queda libre).
function raices(col, n = 8, thick = 0.11) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-0.15 + 1.3 * (i / (n - 1))) * PI
    const ca = Math.cos(a); const sa = Math.sin(a); const j = ((i * 37) % 7) / 7
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(ca * 1.6, sa * 1.6, -0.95),
      new THREE.Vector3(ca * 1.3, sa * 1.3 + 0.12, -0.3 - j * 0.15),
      new THREE.Vector3(ca * 1.28, sa * 1.28, 0.35),
      new THREE.Vector3(ca * (1.5 + j * 0.3), sa * (1.5 + j * 0.3), 1.0),
    ])
    return P(new THREE.TubeGeometry(curve, 5, thick * (0.8 + j * 0.5), 4, false), col)
  })
}

// Corona de púas/cristales/corales alrededor de la boca (hacia fuera o colgando hacia dentro).
function puas(n, col, { r0 = 1.3, h = 0.8, r = 0.12, a0 = -0.1, a1 = 1.1, glow = 0, k = 0, inward = false } = {}) {
  return Array.from({ length: n }, (_, i) => {
    const a = (a0 + (a1 - a0) * (i / (n - 1))) * PI
    const j = ((i * 53) % 9) / 9
    const hh = h * (0.6 + j * 0.8)
    const ca = Math.cos(a); const sa = Math.sin(a)
    return P(cone(r * (0.8 + j * 0.5), hh, 5), col, {
      pos: [ca * r0, sa * r0, -0.5 + j * 1.0], rot: [0.25 * (j - 0.5), 0, a + (inward ? PI / 2 : -PI / 2)], glow, fx: F(k, 0.3, 0, i),
    })
  })
}

// Anillo de rocas toscas alrededor de la boca (mitad superior).
function rocas(n, col, glow = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = (-0.1 + 1.2 * (i / (n - 1))) * PI
    const j = ((i * 29) % 5) / 5
    return P(ico(0.42 + j * 0.3), col, { pos: [Math.cos(a) * (1.55 + j * 0.3), Math.sin(a) * (1.55 + j * 0.3), -0.3 + j * 0.8], scl: [1, 0.8, 1.2], rot: [j, j * 2, 0], glow })
  })
}

// Remolino de aspas que gira sobre el eje del tubo (anillos concéntricos a contragiro).
function remolino(col, radios = [1.5, 1.85, 2.2], z = -0.3) {
  const out = []
  radios.forEach((rad, ri) => {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + ri * 0.5
      out.push(P(box(0.55, 0.07, 0.07), col, { pos: [Math.cos(a) * rad, Math.sin(a) * rad, z + ri * 0.15], rot: [0, 0, a + PI / 2], glow: 1.3, fx: F(7, (ri % 2 ? -1 : 1) * 0.22, 0, 0) }))
    }
  })
  return out
}

// ═══════════════════════════ MODELOS GLB (registro) ═══════════════════════════
// Los GLB (public/models, ver Modelos.jsx) se cargan de forma diferida y se registran aquí. Mientras no estén,
// las claves `m:<modelo>[:<tema>]` caen a su forma procedural equivalente (FB); al registrarse el modelo
// se avisa a los suscriptores (Ecosistema.jsx) para que cambien la geometría.
const modelos = new Map()
const subs = new Set()
let ver = 0
export const modelosVersion = () => ver
export const suscribirModelos = (fn) => { subs.add(fn); return () => subs.delete(fn) }
export const modeloListo = (n) => modelos.has(n)
export function registrarModelo(nombre, geo) {
  modelos.set(nombre, geo)
  ver++
  subs.forEach((fn) => fn())
}

/** Geometría limpia (no indexada: position, normal, color lineal) de una escena glTF. El color real de los GLB
 *  está en COLOR_1 (COLOR_0 sale en blanco del exportador); si no hay COLOR_1 se usa COLOR_0. */
export function geoDeGltf(scene) {
  scene.updateMatrixWorld(true)
  const gs = []
  scene.traverse((o) => {
    if (!o.isMesh) return
    const s = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()
    s.applyMatrix4(o.matrixWorld)
    const src = s.attributes.color_1 ?? s.attributes.color
    const n = s.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) { col[i * 3] = src ? src.getX(i) : 1; col[i * 3 + 1] = src ? src.getY(i) : 1; col[i * 3 + 2] = src ? src.getZ(i) : 1 }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', s.attributes.position)
    g.setAttribute('normal', s.attributes.normal)
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    gs.push(g)
  })
  return gs.length ? (gs.length === 1 ? gs[0] : mergeGeometries(gs)) : null
}

// Pieza a partir de un modelo registrado: transformación horneada; `rule(r,g,b,x,y,z)` (color lineal y posición
// original del vértice) devuelve { fx, glow } para animar solo algunos vértices (lava, agua, chorro...) o null.
function PM(b, o = {}) {
  const pos = o.pos ?? [0, 0, 0]
  const g = b.clone()
  g.applyMatrix4(_m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...(o.rot ?? [0, 0, 0]))), _s.set(...vec3(o.scl))))
  const n = g.attributes.position.count
  const c = b.attributes.color; const p = b.attributes.position
  const fA = new Float32Array(n * 4); const nA = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const r = o.rule?.(c.getX(i), c.getY(i), c.getZ(i), p.getX(i), p.getY(i), p.getZ(i))
    fA.set(r?.fx ?? o.fx ?? [0, 0, 0, 0], i * 4)
    nA[i * 4] = pos[0]; nA[i * 4 + 1] = pos[1]; nA[i * 4 + 2] = pos[2]; nA[i * 4 + 3] = r?.glow ?? o.glow ?? 0
  }
  g.setAttribute('aFx', new THREE.BufferAttribute(fA, 4))
  g.setAttribute('aCen', new THREE.BufferAttribute(nA, 4))
  return g
}

// ═══════════════════════════ DETALLES DE ECOSISTEMA (formas) ═══════════════════════════
const S = {
  // sombrío
  lapida: () => [P(box(0.5, 0.8, 0.14), '#7b778f'), P(box(0.08, 0.32, 0.07), '#8f8ba3', { pos: [0, 0.8, 0] }), P(box(0.26, 0.07, 0.07), '#8f8ba3', { pos: [0, 0.95, 0] })],
  niebla: () => [0, 1, 2].map((i) => P(sph(0.55, 5, 3), '#9a96b8', { pos: [(i - 1) * 0.6, 0.2 + (i % 2) * 0.1, (i % 2) * 0.4 - 0.2], scl: [1.6, 0.4, 1.2], glow: 0.18, fx: F(5, 0.08 + i * 0.03, 0.25, i * 2) })),
  ojos: () => [-1, 1].map((s) => P(sph(0.06, 5, 3), '#ffb347', { pos: [s * 0.13, 0, 0], glow: 2.2, fx: F(3, 0.25, 0, 0) })),
  arbolMuerto: () => [P(cyl(0.12, 0.04, 1.7, 5), '#2b2236'), P(cone(0.05, 0.7, 4), '#2b2236', { pos: [0, 1.0, 0], rot: [0, 0, -1.0] }), P(cone(0.045, 0.6, 4), '#2b2236', { pos: [0, 1.3, 0], rot: [0, 0, 1.1] }), P(cone(0.04, 0.45, 4), '#2b2236', { pos: [0, 0.6, 0], rot: [0, 0, 0.9] })],
  // bosque
  hongo: () => [P(cyl(0.1, 0.08, 0.45, 6), '#efe3c8'), P(hemi(0.38, 8, 3), '#d9473a', { pos: [0, 0.4, 0], scl: [1, 0.75, 1] }),
    ...[[0.15, 0.62, 0.1], [-0.12, 0.6, 0.16], [0.02, 0.66, -0.18]].map((p) => P(sph(0.045, 4, 3), '#fff2d8', { pos: p, glow: 0.9 }))],
  tronco: () => [P(cyl(0.26, 0.24, 1.7, 7), '#5a3b22', { rot: [0, 0, PI / 2], pos: [0.85, 0.26, 0] }), P(cyl(0.24, 0.24, 0.04, 7), '#c7a06a', { rot: [0, 0, PI / 2], pos: [-0.85, 0.26, 0] }), P(sph(0.28, 5, 3), '#3f8f3a', { pos: [-0.2, 0.45, 0], scl: [1.5, 0.35, 0.9] })],
  luciernaga: () => [P(sph(0.05, 4, 3), '#e6ff6a', { glow: 2.4, fx: F(4, 0.12, 0.7, 0) })],
  helecho: () => [0, 1, 2, 3].map((i) => P(cone(0.08, 0.9, 4), '#3f9b46', { rot: [0.8 * Math.cos(i * 1.57), 0, 0.8 * Math.sin(i * 1.57)], fx: F(1, 0.3, 0.35, i) })),
  // mar
  coral: () => [P(cone(0.12, 0.7, 5), '#ff7aa8'), ...[0, 1, 2, 3].map((i) => P(cone(0.07, 0.5, 4), '#ff9bbf', { pos: [Math.cos(i * 1.57) * 0.1, 0.25, Math.sin(i * 1.57) * 0.1], rot: [Math.sin(i * 1.57) * 0.8, 0, -Math.cos(i * 1.57) * 0.8] }))],
  alga: () => [-1, 0, 1].map((i) => P(cone(0.05, 1.7, 4), '#2ea36b', { pos: [i * 0.14, 0, i * 0.05], fx: F(1, 0.3, 0.5, i) })),
  burbuja: () => [P(sph(0.09, 5, 4), '#c8f6ff', { glow: 0.7, fx: F(2, 0.12, 2.6, 0) })],
  concha: () => [P(hemi(0.32, 7, 3), '#ffe1d3', { scl: [1, 0.5, 0.85] }), P(sph(0.07, 5, 3), '#ffffff', { pos: [0, 0.12, 0], glow: 0.9 })],
  estrella: () => [0, 1, 2, 3, 4].map((i) => P(cone(0.1, 0.5, 3), '#ff9a3c', { rot: [0, (i / 5) * TAU, -PI / 2] })),
  // desierto
  saguaro: () => { const c = '#4f8a3a'; return [P(cyl(0.16, 0.15, 1.6, 6), c), P(sph(0.16, 6, 3), c, { pos: [0, 1.6, 0], scl: [1, 0.8, 1] }), P(cyl(0.1, 0.1, 0.42, 5), c, { pos: [0.14, 0.7, 0], rot: [0, 0, -PI / 2] }), P(cyl(0.1, 0.09, 0.5, 5), c, { pos: [0.56, 0.7, 0] }), P(cyl(0.09, 0.09, 0.32, 5), c, { pos: [-0.14, 0.95, 0], rot: [0, 0, PI / 2] }), P(cyl(0.09, 0.08, 0.4, 5), c, { pos: [-0.46, 0.95, 0] })] },
  duna: () => [P(sph(1, 8, 4), '#e0b872', { scl: [2.2, 0.5, 1.5], pos: [0, -0.1, 0] })],
  esqueleto: () => [P(cyl(0.04, 0.04, 1.5, 4), '#e8e0c8', { rot: [PI / 2, 0, 0], pos: [0, 0.34, -0.75] }), ...[0, 1, 2, 3].map((i) => P(tor(0.34, 0.03, 3, 8, PI), '#e8e0c8', { pos: [0, 0.02, -0.45 + i * 0.3] })), P(sph(0.16, 5, 4), '#efe8d2', { pos: [0, 0.22, 0.85], scl: [0.9, 0.8, 1.2] })],
  remolinoArena: () => swarm(12, 11, [0.9, 0, 0.9], () => oct(0.06), '#d9b36a', { k: 2, sp: 0.25, am: 3, glow: 0.15 }),
  mesa: () => [P(cyl(0.9, 0.75, 1.1, 7), '#b86f3a'), P(cyl(0.78, 0.78, 0.14, 7), '#d79a58', { pos: [0, 1.1, 0] })],
  // hielo
  estalagmita: () => [P(cone(0.24, 1.1, 5), '#cfeaff', { glow: 0.12 }), P(cone(0.14, 0.65, 5), '#e4f5ff', { pos: [0.3, 0, 0.1], glow: 0.12 }), P(cone(0.1, 0.45, 4), '#bfe0f5', { pos: [-0.25, 0, 0.14] })],
  aurora: () => [['#5dffb0', 0], ['#8f6bff', 0.9], ['#5dd8ff', 1.8]].map(([c, x], i) => P(new THREE.PlaneGeometry(1.4, 4, 1, 3).translate(0, 2, 0), c, { pos: [x - 0.9, 0, i * 0.2], glow: 1.0, fx: F(1, 0.12, 0.35, i * 2) })),
  copo: () => [P(oct(0.06), '#ffffff', { glow: 0.9, fx: F(2, 0.1, -2.4, 0) })],
  bloque: () => [P(box(0.7, 0.6, 0.7), '#b5e3ff', { rot: [0, 0.5, 0.12], glow: 0.1 })],
  // volcán
  grieta: () => [[0, 0, 0.3], [0.7, 0.15, -0.4], [1.3, -0.1, 0.2]].map(([x, z, a], i) => P(box(0.8, 0.03, 0.12), '#ff6a1a', { pos: [x - 0.7, 0, z], rot: [0, a, 0], glow: 1.9, fx: F(8, 0.3, 0, i) })),
  rocaFlotante: () => [P(ico(0.5), '#3a2a28', { scl: [1, 0.7, 0.9] }), P(cone(0.3, 0.5, 5), '#ff5a1a', { pos: [0, -0.15, 0], rot: [PI, 0, 0], glow: 1.6 })].map((g) => g),
  ceniza: () => swarm(10, 21, [1.2, 0, 1.2], () => oct(0.055), '#5a5450', { k: 2, sp: 0.1, am: 3 }),
  basalto: () => [[0, 0, 1.3], [0.3, 0.1, 0.9], [-0.28, 0.12, 0.7], [0.1, -0.3, 1.0], [-0.2, -0.25, 0.5]].map(([x, z, h]) => P(cyl(0.18, 0.18, h, 6), '#2d2a30', { pos: [x, 0, z] })),
  ascua: () => [P(sph(0.05, 4, 3), '#ff8a2a', { glow: 2.4, fx: F(2, 0.14, 2.2, 0) })],
  // cristal
  geoda: () => [P(hemi(0.45, 6, 3), '#463c63', { scl: [1, 0.8, 1] }),
    ...[0, 1, 2, 3, 4, 5, 6].map((i) => { const a = i * 0.9; return P(cyl(0.09, 0.01, 0.55 + ((i * 37) % 5) * 0.06, 6), '#c9a7ff', { pos: [Math.cos(a) * 0.18, 0.28, Math.sin(a) * 0.18], rot: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7], glow: 0.7, fx: F(3, 0.3, 0, i) }) }),
    P(cyl(0.1, 0.01, 0.8, 6), '#e0c8ff', { pos: [0, 0.3, 0], glow: 0.8, fx: F(3, 0.3, 0, 3) })],
  cristalAlto: () => [P(cyl(0.22, 0.03, 2.2, 6), '#b99aff', { glow: 0.6, fx: F(3, 0.2, 0, 1) }), P(cyl(0.12, 0.02, 1.2, 6), '#d8c4ff', { pos: [0.3, 0, 0.1], rot: [0, 0, -0.3], glow: 0.6, fx: F(3, 0.25, 0, 2) })],
  destello: () => [P(oct(0.07), '#ffffff', { glow: 2.6, fx: F(3, 0.6, 0, 0) })],
  // nubes
  isla: () => { const b = F(5, 0.07, 0.35, 0); return [P(cone(0.95, 1.1, 6), '#8a7a66', { rot: [PI, 0, 0], fx: b }), P(cyl(1, 1, 0.12, 8), '#6fcf6a', { fx: b }), P(cyl(0.04, 0.04, 0.2, 4), '#6b4a2b', { pos: [0.3, 0.12, 0], fx: b }), P(cone(0.2, 0.6, 5), '#3f9b46', { pos: [0.3, 0.3, 0], fx: b })] },
  arcoiris: () => ['#ff4b4b', '#ff9a3c', '#ffe24a', '#5fe36a', '#4ab8ff', '#4a5bff', '#a64aff'].map((c, i) => P(tor(1 + i * 0.07, 0.035, 3, 10, PI), c, { glow: 0.9 })),
  puff: () => [[0, 0, 0, 0.5], [0.45, -0.05, 0.1, 0.38], [-0.42, -0.08, 0, 0.4], [0.1, 0.15, -0.2, 0.35]].map(([x, y, z, r]) => P(sph(r, 5, 3), '#ffffff', { pos: [x, y, z], glow: 0.2, fx: F(5, 0.1, 0.15, 0) })),
  // jardín
  flor: () => [P(cyl(0.03, 0.025, 0.75, 4), '#3f9b46', { fx: F(1, 0.3, 0.3, 0) }),
    ...[0, 1, 2, 3, 4, 5].map((i) => { const a = (i / 6) * TAU; return P(cone(0.11, 0.3, 3), '#ff6fa5', { pos: [Math.cos(a) * 0.1, 0.78, Math.sin(a) * 0.1], rot: [Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2], glow: 0.35, fx: F(1, 0.3, 0.3, 0) }) }),
    P(sph(0.09, 5, 3), '#ffd24a', { pos: [0, 0.78, 0], glow: 0.6, fx: F(1, 0.3, 0.3, 0) })],
  fuente: () => [P(cyl(0.6, 0.5, 0.22, 8), '#cfc8c0'), P(cyl(0.5, 0.5, 0.02, 8), '#8fe8ff', { pos: [0, 0.22, 0], glow: 0.5 }), P(cyl(0.05, 0.03, 1.0, 5), '#cffaff', { pos: [0, 0.22, 0], glow: 1.0, fx: F(6, 0.22, 0, 0) }),
    ...swarm(6, 5, [0.5, 0, 0.5], () => sph(0.05, 4, 3), '#cffaff', { y0: 0.3, k: 2, sp: 0.22, am: 1.0, glow: 0.9 })],
  seto: () => [P(sph(0.45, 6, 4), '#2f7d3a', { pos: [0, 0.45, 0], scl: [1, 0.9, 1] }), P(sph(0.3, 6, 4), '#3f9b46', { pos: [0, 1, 0] })],
  petalo: () => [P(oct(0.05), '#ffb3d1', { glow: 0.5, fx: F(2, 0.06, -1.6, 0) })],
  // neón
  cable: () => [P(box(1.4, 0.05, 0.05), '#ff2bd6', { glow: 1.6, fx: F(8, 0.4, 0, 0) }), P(box(0.05, 0.05, 0.8), '#ff2bd6', { pos: [0.7, 0, 0.4], glow: 1.6, fx: F(8, 0.4, 0, 1) }), P(box(1.0, 0.05, 0.05), '#2bffe8', { pos: [0.7, 0, 0.8], glow: 1.6, fx: F(8, 0.4, 0, 2) })],
  holograma: () => [P(ico(0.4), '#2bffe8', { pos: [0, 0.7, 0], glow: 1.3, fx: F(10, 0.12, 0, 0) }), P(tor(0.55, 0.015, 3, 16), '#ff2bd6', { pos: [0, 0.7, 0], rot: [PI / 2, 0, 0], glow: 1.6, fx: F(10, -0.18, 0, 0) }), P(cyl(0.04, 0.04, 0.4, 4), '#2bffe8', { glow: 0.8 })],
  baliza: () => [P(box(0.07, 2, 0.07), '#2bffe8', { glow: 1.2, fx: F(3, 0.3, 0, 0) }), P(box(0.3, 0.12, 0.07), '#ff2bd6', { pos: [0, 2, 0], glow: 1.8, fx: F(3, 0.5, 0, 1) })],
  pixeles: () => swarm(7, 41, [1.2, 0.8, 1.2], () => box(0.1, 0.1, 0.1), '#2bffe8', { k: 5, sp: 0.2, am: 0.3, glow: 1.4 }),
}

// ═══════════════════════════ PIEZAS DE TRANSICIÓN (radio de tubo = 1) ═══════════════════════════
const PAL = {
  sombrio: { a: '#2b2236', g: '#b784ff', w: '#c9b8ff' },
  bosque: { a: '#5a3b22', g: '#d4ff5a', w: '#a8f0c0' },
  mar: { a: '#6e8aa3', g: '#38d6ff', w: '#8fe8ff' },
  desierto: { a: '#e0b872', g: '#ffb347', w: '#f2dca8' },
  hielo: { a: '#bfe9ff', g: '#7ce8ff', w: '#e4f8ff' },
  volcan: { a: '#3b2a2a', g: '#ff6028', w: '#ff9a3a' },
  cristal: { a: '#7d6aa8', g: '#c07eff', w: '#d8c4ff' },
  nubes: { a: '#f4f8ff', g: '#ffe169', w: '#ffffff' },
  neon: { a: '#1c1a30', g: '#ff2bd6', w: '#2bffe8' },
  jardin: { a: '#6fcf6a', g: '#ff6fa5', w: '#cffaff' },
}
const RAMPA = {
  sombrio: ['#3a3248', 0, 0], bosque: ['#6b4a2b', 0, 0], mar: ['#6e8aa3', 0, 0], desierto: ['#e0b872', 0, 0], hielo: ['#bfe9ff', 0.12, 0],
  volcan: ['#c8400f', 1.4, 8], cristal: ['#7df9ff', 0.4, 0], nubes: ['#ffffff', 0.15, 0], neon: ['#2a2850', 0.25, 0], jardin: ['#6fcf6a', 0.05, 0],
}

const volcanPieza = () => [
  P(cyl(1.3, 0.45, 1.7, 9), '#3b2a2a'),
  P(cyl(0.5, 0.5, 0.06, 9), '#ff6a1a', { pos: [0, 1.68, 0], glow: 2.2, fx: F(3, 0.5, 0, 0) }),
  ...[0, 1, 2].map((i) => P(box(0.14, 1.4, 0.05), '#ff5a1a', { pos: [Math.cos(i * 2.1) * 0.95, 0.15, Math.sin(i * 2.1) * 0.95], rot: [0, -i * 2.1 + PI / 2, 0.45], glow: 1.8, fx: F(8, 0.3, 0, i) })),
  ...swarm(14, 7, [0.4, 0.1, 0.4], () => oct(0.09), '#ff8a2a', { y0: 1.7, k: 9, sp: 0.33, am: 3.2, glow: 2.4 }),
  ...swarm(8, 8, [0.5, 0.1, 0.5], () => oct(0.08), '#4a4440', { y0: 1.75, k: 2, sp: 0.15, am: 3.5 }),
]
const geiserPieza = (pal) => [
  P(cyl(0.7, 0.4, 0.3, 8), '#6d6a62', { pos: [0, -0.3, 0] }),
  P(cyl(0.22, 0.16, 2.6, 7), pal.w, { glow: 1.0, fx: F(6, 0.22, 0, 0) }),
  ...swarm(10, 3, [0.7, 0, 0.7], () => oct(0.07), pal.w, { y0: 0.1, k: 2, sp: 0.22, am: 2.4, glow: 1.4 }),
]
const cascadaPieza = (pal) => [P(box(0.9, 1, 0.1), pal.w, { glow: 1.0, fx: F(11, 0.7, 1.6, 0) })]
const brumaPieza = (pal) => swarm(12, 17, [1.4, 0, 1.4], () => sph(0.18, 4, 3), pal.w, { k: 2, sp: 0.18, am: 1.6, glow: 0.5 })
const portalPieza = (pal) => [P(tor(1.5, 0.09, 4, 22), pal.g, { glow: 1.8, fx: F(3, 0.4, 0, 0) }), ...remolino(pal.w, [0.95, 1.2], 0)]

const ring = (n, a0, a1, r, fn) => Array.from({ length: n }, (_, i) => { const a = (a0 + (a1 - a0) * (i / (n - 1))) * PI; return fn(a, i, [Math.cos(a) * r, Math.sin(a) * r]) })

const MOUTH = {
  sombrio: () => [...raices('#2b2236', 8), ...rampa('#3a3248'), ...place(S.lapida(), { pos: [1.7, -1.1, 0.2], scl: 0.8, rot: [0, 0.4, 0] }), ...place(S.lapida(), { pos: [-1.8, -1.1, -0.3], scl: 0.9, rot: [0, -0.3, 0] }),
    ...place(S.ojos(), { pos: [1.0, 1.75, 0.2], scl: 1.3 }), ...place(S.ojos(), { pos: [-1.1, 1.55, 0.1] }), ...place(S.niebla(), { pos: [0, -1.35, 0.4], scl: 1.5 })],
  bosque: () => [...raices('#5a3b22', 9, 0.13), ...rampa('#6b4a2b'), ...place(S.hongo(), { pos: [1.8, -1.1, 0.5], scl: 1.2 }), ...place(S.hongo(), { pos: [-1.6, -1.15, -0.2], scl: 0.9 }), ...place(S.hongo(), { pos: [1.2, -1.2, -0.7], scl: 0.7 }),
    ...place(S.helecho(), { pos: [-2.0, -1.1, 0.6], scl: 1.3 }), ...place(S.helecho(), { pos: [2.1, -1.1, -0.4] })],
  mar: () => [...puas(16, '#ff7aa8', { h: 0.7, r: 0.1, a0: -0.15, a1: 1.15, glow: 0.12 }), ...remolino('#38d6ff', [1.45, 1.85, 2.25]), ...rampa('#6e8aa3'),
    ...place(S.coral(), { pos: [1.9, -1.2, 0.3], scl: 1.3 }), ...place(S.coral(), { pos: [-1.9, -1.2, -0.2], scl: 1.1 }), ...place(S.alga(), { pos: [1.3, -1.2, -0.6], scl: 1.2 }), ...place(S.alga(), { pos: [-1.2, -1.2, 0.7] }),
    ...swarm(8, 5, [3, 0, 2], () => sph(0.08, 5, 4), '#c8f6ff', { y0: -1, k: 2, sp: 0.12, am: 3.2, glow: 0.7 })],
  desierto: () => [...rampa('#e0b872'), ...rocas(9, '#b86f3a'), ...swarm(14, 3, [2.4, 0.2, 2], () => oct(0.06), '#d9b36a', { y0: -1, k: 2, sp: 0.2, am: 3.4 }),
    ...place(S.saguaro(), { pos: [2.2, -1.15, 0.3], scl: 1.1 }), ...place(S.esqueleto(), { pos: [-1.8, -1.15, 0.2], scl: 0.9 })],
  hielo: () => [...rampa('#bfe9ff', 0.12), ...puas(14, '#cfeaff', { r0: 2.0, h: 0.9, r: 0.13, a0: 0.1, a1: 0.9, inward: true, glow: 0.12 }),
    ...place(S.estalagmita(), { pos: [1.9, -1.1, 0.3], scl: 1.1 }), ...place(S.estalagmita(), { pos: [-1.9, -1.1, -0.2], scl: 1.3 }),
    ...swarm(12, 9, [3, 2, 2.4], () => oct(0.06), '#ffffff', { y0: 0.3, k: 2, sp: 0.1, am: -2.6, glow: 0.9 })],
  volcan: () => [...place(volcanPieza(), { pos: [2.6, -1.6, -0.2], scl: 0.8 }), ...place(volcanPieza(), { pos: [-2.6, -1.6, 0.3], scl: 0.6 }), ...rampa('#c8400f', 1.4, 8), ...rocas(7, '#3b2a2a')],
  cristal: () => [...puas(18, '#c9a7ff', { h: 1.1, r: 0.12, a0: -0.1, a1: 1.1, glow: 0.7, k: 3 }), ...puas(10, '#7df9ff', { r0: 1.5, h: 0.7, r: 0.09, a0: 0.05, a1: 0.95, glow: 0.6, k: 3 }), ...rampa('#7df9ff', 0.4),
    ...place(S.geoda(), { pos: [2.0, -1.1, 0.2], scl: 1.2 }), ...place(S.destello(), { pos: [1.4, 1.5, 0], scl: 1.5 }), ...place(S.destello(), { pos: [-1.5, 1.2, 0.2], scl: 1.2 }), ...place(S.destello(), { pos: [0.2, 2.2, 0.3], scl: 1.7 })],
  nubes: () => [...ring(8, -0.1, 1.1, 1.8, (a, i, [x, y]) => place(S.puff(), { pos: [x, y, (i % 2) * 0.4 - 0.2], scl: 1 + 0.3 * (i % 3) })).flat(), ...place(S.arcoiris(), { pos: [0, -1, 0.3], scl: 1.3 }), ...rampa('#ffffff', 0.15)],
  neon: () => [...[1.45, 1.75, 2.05].map((r, i) => P(tor(r, 0.025, 3, 24, PI * 1.6), i % 2 ? '#2bffe8' : '#ff2bd6', { pos: [0, 0, -0.3 + i * 0.3], rot: [0, 0, i * 1.1], glow: 1.7, fx: F(7, (i % 2 ? -1 : 1) * 0.08, 0, 0) })),
    ...rampa('#2a2850', 0.25), ...place(S.baliza(), { pos: [1.9, -1.1, 0.3] }), ...place(S.baliza(), { pos: [-1.9, -1.1, -0.2], scl: 0.8 }), ...place(S.cable(), { pos: [-1.0, -0.95, -1.0] }), ...place(S.holograma(), { pos: [2.1, -1.0, -0.6], scl: 1.1 })],
  jardin: () => [...rampa('#6fcf6a', 0.05), ...ring(9, -0.1, 1.1, 1.55, (a, i, [x, y]) => place(S.flor(), { pos: [x, y, (i % 3 - 1) * 0.25], rot: [0, 0, a - PI / 2], scl: 1.3 })).flat(),
    ...place(S.seto(), { pos: [2.0, -1.1, 0.2], scl: 0.9 }), ...place(S.seto(), { pos: [-2.0, -1.1, -0.3] })],
}

const PIECE = {
  mouth: (id) => MOUTH[id](),
  geiser: (id) => geiserPieza(PAL[id]),
  volcan: () => volcanPieza(),
  cascada: (id) => cascadaPieza(PAL[id]),
  bruma: (id) => brumaPieza(PAL[id]),
  portal: (id) => portalPieza(PAL[id]),
  rampa: (id) => rampa(...RAMPA[id]),
}

// ═══════════════════════════ FORMAS CON MODELO GLB ═══════════════════════════
// Escalas elegidas para igualar el tamaño de la forma procedural a la que acompañan (los GLB miden ~1).
const lava = (r, g, b) => (r > 0.6 && g < 0.5 && b < 0.2 ? { fx: F(8, 0.3, 0, 0), glow: 2 } : null)
const agua = (r, g, b) => (b > 0.75 && g > 0.3 && r < 0.7 ? { fx: F(11, 0.7, 6, 0), glow: 1 } : null)
const brillo = (min, k = 3, glow = 0.7) => (r, g, b) => (Math.max(r, g, b) > min ? { fx: F(k, 0.3, 0, (r * 7 + b * 5) % TAU), glow } : null)
const rampaM = (b, id) => [PM(b, { scl: 2, rot: [0, -PI / 2, 0], pos: [0, -1.75, 0] }),
  ...(id === 'volcan' ? [P(box(2.0, 0.05, 0.12), '#ff6a1a', { pos: [0, -0.78, 0.95], glow: 1.4, fx: F(8, 0.3, 0, 0) })] : [])]
const MODEL = {
  volcan_erupcion: (b) => [PM(b, { scl: 1.8, rule: lava }),
    ...swarm(14, 7, [0.4, 0.1, 0.4], () => oct(0.09), '#ff8a2a', { y0: 1.8, k: 9, sp: 0.33, am: 3.2, glow: 2.4 }),
    ...swarm(8, 8, [0.5, 0.1, 0.5], () => oct(0.08), '#4a4440', { y0: 1.85, k: 2, sp: 0.15, am: 3.5 })],
  geiser: (b, id) => [PM(b, { scl: 1.4, pos: [0, -0.25, 0], rule: (r, g, bl, x, y, z) => (y > 0.3 && Math.hypot(x, z) < 0.12 ? { fx: F(6, 0.22, 0, 0), glow: 1.2 } : null) }),
    P(cyl(0.22, 0.16, 2.6, 7), PAL[id].w, { glow: 1.0, fx: F(6, 0.22, 0, 0) }),
    ...swarm(10, 3, [0.7, 0, 0.7], () => oct(0.07), PAL[id].w, { y0: 0.1, k: 2, sp: 0.22, am: 2.4, glow: 1.4 })],
  rampa_roca: rampaM,
  rampa_hielo: rampaM,
  rampa_madera: rampaM,
  cascada_roca: (b) => [PM(b, { scl: 1.3, rule: agua })],
  lapida: (b) => [PM(b, { scl: 1.0 })],
  estalagmita_hielo: (b) => [PM(b, { scl: 1.2, glow: 0.12 })],
  geoda: (b) => [PM(b, { scl: 0.95, rule: brillo(0.7) })],
  saguaro_grande: (b) => [PM(b, { scl: 1.7 })],
  concha_gigante: (b) => [PM(b, { scl: 0.75, glow: 0.1 })],
  alga_larga: (b) => [PM(b, { scl: 1.7, fx: F(1, 0.3, 0.5, 0) })],
  hongo_gigante: (b) => [PM(b, { scl: 0.9, rule: (r, g, bl) => (Math.min(r, g, bl) > 0.7 ? { fx: [0, 0, 0, 0], glow: 0.5 } : null) })],
  tronco_hueco: (b) => [PM(b, { scl: 1.7, rot: [0, 0, PI / 2], pos: [0.85, 0.4, 0] })],
  fuente_jardin: (b) => [PM(b, { scl: 1.2, rule: (r, g, bl) => (bl > 0.8 && r < 0.8 ? { fx: [0, 0, 0, 0], glow: 0.6 } : null) }),
    ...swarm(6, 5, [0.5, 0, 0.5], () => sph(0.05, 4, 3), '#cffaff', { y0: 1.0, k: 2, sp: 0.22, am: 1.0, glow: 0.9 })],
  luciernaga_farol: (b) => [PM(b, { scl: 0.9, rule: brillo(0.7, 3, 1.8) })],
  isla_nube: (b) => [PM(b, { scl: 2, pos: [0, -1.5, 0], fx: F(5, 0.07, 0.35, 0) })],
  puente_cristal: (b) => [PM(b, { scl: 3, rule: (r, g, bl) => (r + g + bl > 1.4 ? { fx: [0, 0, 0, 0], glow: 0.45 } : null) })],
}
// Forma procedural equivalente mientras el GLB no está cargado.
const FB = {
  volcan_erupcion: () => volcanPieza(),
  geiser: (id) => geiserPieza(PAL[id]),
  rampa_roca: (id) => rampa(...RAMPA[id]),
  rampa_hielo: (id) => rampa(...RAMPA[id]),
  rampa_madera: (id) => rampa(...RAMPA[id]),
  cascada_roca: () => [P(ico(0.7), '#4a4a52', { scl: [1, 0.7, 1] })],
  lapida: () => S.lapida(),
  estalagmita_hielo: () => S.estalagmita(),
  geoda: () => S.geoda(),
  saguaro_grande: () => S.saguaro(),
  concha_gigante: () => S.concha(),
  alga_larga: () => S.alga(),
  hongo_gigante: () => S.hongo(),
  tronco_hueco: () => S.tronco(),
  fuente_jardin: () => S.fuente(),
  luciernaga_farol: () => S.luciernaga(),
  isla_nube: () => S.isla(),
  puente_cristal: () => [P(box(3, 0.18, 1), '#7df9ff', { glow: 0.4 })],
}
export const MODELOS_ECO = Object.keys(MODEL)
// forma procedural -> modelo que la sustituye en una parte de las instancias
const ALT = { lapida: 'lapida', estalagmita: 'estalagmita_hielo', geoda: 'geoda', saguaro: 'saguaro_grande', concha: 'concha_gigante', alga: 'alga_larga', hongo: 'hongo_gigante', tronco: 'tronco_hueco', fuente: 'fuente_jardin', luciernaga: 'luciernaga_farol', isla: 'isla_nube' }
const ALT_P = { luciernaga: 0.2, fuente: 0.6, isla: 0.5 } // el resto: 0.4
const RAMPA_M = { sombrio: 'rampa_roca', desierto: 'rampa_roca', volcan: 'rampa_roca', mar: 'rampa_roca', hielo: 'rampa_hielo', bosque: 'rampa_madera', jardin: 'rampa_madera' }
// triángulos de cada GLB (manifiesto) para topar el gasto por camino
const TRIS = { volcan_erupcion: 414, geiser: 302, rampa_roca: 80, rampa_hielo: 80, rampa_madera: 176, cascada_roca: 170, isla_nube: 462, puente_cristal: 332, alga_larga: 360, concha_gigante: 372, saguaro_grande: 342, estalagmita_hielo: 150, geoda: 270, lapida: 104, tronco_hueco: 220, fuente_jardin: 378, hongo_gigante: 301, luciernaga_farol: 218 }
const MODEL_TRIS_CAP = 9000 // por camino, en detalles con modelo

const geoCache = new Map()
const fbCache = new Map()
/** Geometría fusionada de una clave `s:<forma>`, `<pieza>:<tema>` o `m:<modelo>[:<tema>]` (con caché; se comparte
 *  entre caminos). Una clave `m:` usa el GLB registrado o, si aún no cargó, su forma procedural equivalente. */
export function ecoGeometry(key) {
  let g = geoCache.get(key)
  if (g) return g
  const [t, n, id] = key.split(':')
  let cache = geoCache
  let parts
  if (t === 'm' && modelos.has(n)) parts = MODEL[n](modelos.get(n), id)
  else if (t === 'm') {
    g = fbCache.get(key)
    if (g) return g
    cache = fbCache
    parts = FB[n](id)
  } else parts = t === 's' ? S[n]() : PIECE[t](n)
  g = mergeGeometries(parts, false)
  for (const p of parts) p.dispose()
  g.name = 'eco:' + key // rastreo en ?stats=1 (__ballitasDebug)
  g.computeBoundingSphere()
  cache.set(key, g)
  return g
}
export const ecoTris = (key) => ecoGeometry(key).attributes.position.count / 3

// ═══════════════════════════ REPARTO A LO LARGO DEL CAMINO ═══════════════════════════
// k forma, d densidad por unidad de longitud de tubo, s escala, c tintes (multiplican los colores de la forma),
// p colocación: 'side' (lados y bajo el tubo), 'top' (lomo), 'air' (alrededor, libre), 'below' (debajo, lejos);
// off distancia extra a la pared (u. de mundo), cap tope por camino.
const ECO = {
  sombrio: [{ k: 'lapida', d: 0.05, s: [0.8, 1.3], p: 'top' }, { k: 'niebla', d: 0.04, s: [1.2, 2.2], p: 'air', off: [0.5, 2.5] }, { k: 'ojos', d: 0.04, s: [0.8, 1.4], p: 'air', off: [1, 3] }, { k: 'arbolMuerto', d: 0.04, s: [1, 1.6], p: 'top' }],
  bosque: [{ k: 'hongo', d: 0.12, s: [0.7, 1.4], p: 'top' }, { k: 'tronco', d: 0.03, s: [1, 1.6], p: 'side' }, { k: 'luciernaga', d: 0.3, s: [0.8, 1.4], p: 'air', off: [0.5, 3], cap: 60 }, { k: 'helecho', d: 0.1, s: [0.8, 1.5], p: 'top' }],
  mar: [{ k: 'coral', d: 0.1, s: [0.8, 1.6], p: 'side' }, { k: 'alga', d: 0.1, s: [0.8, 1.6], p: 'side' }, { k: 'burbuja', d: 0.3, s: [0.8, 1.6], p: 'air', off: [0.3, 2.5], cap: 60 }, { k: 'concha', d: 0.05, s: [0.8, 1.4], p: 'top' }, { k: 'estrella', d: 0.04, s: [0.8, 1.4], p: 'side' }],
  desierto: [{ k: 'saguaro', d: 0.06, s: [1, 1.7], p: 'top' }, { k: 'duna', d: 0.03, s: [2, 4], p: 'below', off: [3, 6] }, { k: 'esqueleto', d: 0.02, s: [0.9, 1.4], p: 'top' }, { k: 'remolinoArena', d: 0.03, s: [1, 2], p: 'side' }, { k: 'mesa', d: 0.02, s: [1.5, 3], p: 'below', off: [3, 6] }],
  hielo: [{ k: 'estalagmita', d: 0.1, s: [0.8, 1.6], p: 'side' }, { k: 'aurora', d: 0.015, s: [2.5, 4], p: 'air', off: [6, 11], cap: 6 }, { k: 'copo', d: 0.4, s: [0.8, 1.6], p: 'air', off: [0.5, 3], cap: 60 }, { k: 'bloque', d: 0.06, s: [0.8, 1.6], p: 'side' }],
  volcan: [{ k: 'grieta', d: 0.12, s: [1, 1.8], p: 'top' }, { k: 'rocaFlotante', d: 0.05, s: [0.8, 1.6], p: 'air', off: [2, 6] }, { k: 'ceniza', d: 0.05, s: [1, 2], p: 'side' }, { k: 'basalto', d: 0.05, s: [1, 1.8], p: 'side' }, { k: 'ascua', d: 0.3, s: [0.8, 1.6], p: 'air', off: [0.5, 3], cap: 60 }],
  cristal: [{ k: 'geoda', d: 0.08, s: [0.8, 1.6], p: 'side' }, { k: 'cristalAlto', d: 0.04, s: [1, 1.8], p: 'side' }, { k: 'destello', d: 0.35, s: [0.8, 1.6], p: 'air', off: [0.5, 3], cap: 60 }, { k: 'puente', mod: 'puente_cristal', d: 0.012, s: [1.5, 2.5], p: 'air', off: [2, 5], cap: 4 }],
  nubes: [{ k: 'isla', d: 0.015, s: [1.5, 2.8], p: 'air', off: [5, 10], cap: 8 }, { k: 'arcoiris', d: 0.006, s: [5, 8], p: 'air', off: [6, 12], cap: 2 }, { k: 'puff', d: 0.06, s: [1, 2], p: 'air', off: [2, 6] }],
  jardin: [{ k: 'flor', d: 0.3, s: [0.8, 1.5], p: 'top' }, { k: 'fuente', d: 0.02, s: [0.9, 1.4], p: 'top' }, { k: 'seto', d: 0.08, s: [0.8, 1.5], p: 'side' }, { k: 'petalo', d: 0.35, s: [0.8, 1.6], p: 'air', off: [0.5, 3], cap: 60 }],
  neon: [{ k: 'cable', d: 0.1, s: [1, 1.6], p: 'top' }, { k: 'holograma', d: 0.05, s: [1, 1.6], p: 'side' }, { k: 'baliza', d: 0.08, s: [1, 1.6], p: 'side' }, { k: 'pixeles', d: 0.05, s: [1, 1.6], p: 'air', off: [1, 3] }, { k: 'puente', mod: 'puente_cristal', d: 0.012, s: [1.5, 2.5], p: 'air', off: [2, 5], cap: 4 }],
}
const TINTS = { sombrio: ['#ffffff', '#e0d4ff'], bosque: ['#ffffff', '#e6ffd8'], mar: ['#ffffff', '#d8f4ff', '#ffe8f0'], desierto: ['#ffffff', '#fff0d0'], hielo: ['#ffffff', '#e8f6ff'], volcan: ['#ffffff', '#ffd8c0'], cristal: ['#ffffff', '#ffe0ff', '#d8f8ff'], nubes: ['#ffffff'], jardin: ['#ffffff', '#ffe0ec', '#fff4c8'], neon: ['#ffffff'] }
const DETAIL_CAP = 40 // por especie y camino
const TOTAL_CAP = 260 // detalles por camino
const PIECE_CAP = 12 // piezas de evento por camino
const EVENT_PIECES = { geiser: 'geiser', canon: 'geiser', erupcion: 'volcan', cascada: 'cascada', portal: 'portal', trampolin: 'rampa' }

const WHITE = new THREE.Color('#ffffff')
const rr = (rng, [a, b]) => a + (b - a) * rng()

/**
 * Reparte detalles y transiciones del camino. `getFrames(seg)` y `sample(frames, u)` son los de Paths.jsx
 * ({pos, T, up, right}). Devuelve [{ key, items: [{ m, c }], maxS }], determinista por camino.
 */
export function buildEcosistema(way, getFrames, sample) {
  const id = way.theme.id
  const rng = mulberry32(way.idx * 7307 + 53)
  const groups = new Map()
  const add = (key, m, c, sc) => {
    let g = groups.get(key)
    if (!g) groups.set(key, g = { key, items: [], maxS: 1 })
    g.items.push({ m, c })
    if (sc > g.maxS) g.maxS = sc
  }
  const basis = (f, sc, pos = f.pos) => {
    const b = new THREE.Matrix4().makeBasis(f.right, f.up, f.T)
    return new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromRotationMatrix(b), new THREE.Vector3(sc, sc, sc))
  }
  const mouth = (s, u) => add(`mouth:${id}`, basis(sample(getFrames(s), u), s.radius), WHITE, s.radius)

  // — Transiciones —
  const first = way.segments.find((s) => s.kind === 'salida') ?? way.segments[0]
  const last = way.segments.find((s) => s.kind === 'llegada') ?? way.segments[way.segments.length - 1]
  if (first) mouth(first, 0)
  if (last && last !== first) mouth(last, 1)
  for (const j of way.junctions ?? []) {
    let best = null; let bd = Infinity
    for (const s of way.segments) {
      if (s.air) continue
      for (const u of [0, 1]) { const d = s.curve.getPoint(u).distanceTo(j.pos); if (d < bd) { bd = d; best = { s, u } } }
    }
    if (best && bd < best.s.radius * 2.5) mouth(best.s, best.u)
  }
  let pieces = 0
  const perKind = {}
  const yaw = () => new THREE.Quaternion().setFromAxisAngle(Yw, rng() * TAU)
  for (const s of way.segments) {
    const pk = EVENT_PIECES[s.kind]
    if (!pk || pieces >= PIECE_CAP || (perKind[s.kind] = (perKind[s.kind] ?? 0) + 1) > 3) continue
    const R = s.radius
    const frames = getFrames(s)
    const f0 = sample(frames, 0)
    pieces++
    if (pk === 'geiser' || pk === 'volcan') {
      const sc = R * (pk === 'volcan' ? 1.6 : 1.3)
      const mm = new THREE.Matrix4().compose(f0.pos.clone().addScaledVector(Yw, -R * 0.6), yaw(), new THREE.Vector3(sc, sc, sc))
      const gl = rng() < 0.7 // 70% con el GLB como base, el resto procedural
      add(pk === 'volcan' ? (gl ? 'm:volcan_erupcion' : 'volcan:-') : gl ? `m:geiser:${id}` : `geiser:${id}`, mm, WHITE, sc)
    } else if (pk === 'cascada') {
      const f1 = sample(frames, 1)
      const top = f0.pos.clone().addScaledVector(f0.right, R * 1.25)
      const bot = f1.pos.clone().addScaledVector(f1.right, R * 1.25)
      const v = top.clone().sub(bot); const L = v.length() || 1
      add(`cascada:${id}`, new THREE.Matrix4().compose(bot, new THREE.Quaternion().setFromUnitVectors(Yw, v.divideScalar(L)), new THREE.Vector3(R, L, R)), WHITE, L)
      add(`m:cascada_roca:${id}`, new THREE.Matrix4().compose(bot, yaw(), new THREE.Vector3(R * 1.2, R * 1.2, R * 1.2)), WHITE, R * 1.2)
      add(`bruma:${id}`, new THREE.Matrix4().compose(bot, yaw(), new THREE.Vector3(R * 0.8, R * 0.8, R * 0.8)), WHITE, R)
    } else if (pk === 'portal') {
      add(`portal:${id}`, basis(sample(frames, 1), R * 1.1), WHITE, R * 1.1)
    } else {
      const rm = RAMPA_M[id]
      add(rm && rng() < 0.75 ? `m:${rm}:${id}` : `rampa:${id}`, basis(f0, R), WHITE, R)
    }
  }

  // — Detalles de ecosistema —
  const tints = (TINTS[id] ?? ['#ffffff']).map((c) => new THREE.Color(c))
  const dir = new THREE.Vector3(); const pos = new THREE.Vector3(); const q = new THREE.Quaternion(); const qy = new THREE.Quaternion()
  let total = 0; let mTris = 0
  for (const spec of ECO[id] ?? []) {
    let cnt = 0
    const cap = spec.cap ?? DETAIL_CAP
    for (const s of way.segments) {
      if (s.air || cnt >= cap || total >= TOTAL_CAP) continue
      const R = s.radius
      const frames = getFrames(s)
      const n = Math.round(s.length * spec.d)
      for (let i = 0; i < n && cnt < cap && total < TOTAL_CAP; i++) {
        const f = sample(frames, 0.03 + 0.94 * ((i + rng() * 0.8) / n))
        const off = spec.off ? rr(rng, spec.off) : rng() * 0.3
        let a
        if (spec.p === 'top') a = (0.5 + (rng() - 0.5) * 0.7) * PI
        else if (spec.p === 'side') a = (rng() * 1.15 - 0.95) * PI
        else a = rng() * TAU
        dir.copy(f.right).multiplyScalar(Math.cos(a)).addScaledVector(f.up, Math.sin(a))
        qy.setFromAxisAngle(Yw, rng() * TAU)
        if (spec.p === 'top' || spec.p === 'side') {
          pos.copy(f.pos).addScaledVector(dir, R * 0.98 + off)
          q.setFromUnitVectors(Yw, dir).multiply(qy) // crece hacia fuera de la pared del tubo
        } else if (spec.p === 'below') {
          pos.copy(f.pos).addScaledVector(Yw, -(R + off)).addScaledVector(f.right, (rng() - 0.5) * R * 3)
          q.copy(qy)
        } else {
          pos.copy(f.pos).addScaledVector(dir, R + off)
          q.copy(qy)
        }
        const sc = rr(rng, spec.s)
        const mn = spec.mod ?? (ALT[spec.k] && rng() < (ALT_P[spec.k] ?? 0.4) ? ALT[spec.k] : null)
        if (mn && mTris + TRIS[mn] <= MODEL_TRIS_CAP) {
          mTris += TRIS[mn]
          add(`m:${mn}`, new THREE.Matrix4().compose(pos, q, _s.set(sc, sc, sc)), tints[Math.floor(rng() * tints.length)], sc)
          cnt++; total++
          continue
        }
        add(`s:${spec.k}`, new THREE.Matrix4().compose(pos, q, _s.set(sc, sc, sc)), tints[Math.floor(rng() * tints.length)], sc)
        cnt++; total++
      }
    }
  }
  return [...groups.values()]
}
