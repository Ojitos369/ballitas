// Túnel-banda: cada camino se ve como la cinta de un hábitat en anillo. Piel de celosía blanca con
// cristal en rejilla (todo en shader, sin geometría extra), pasarelas laterales con barandilla de cristal,
// arcos 3D instanciados solo de cerca y, de lejos, las luces de la ciudad interior pintadas en la piel
// (se apagan al acercarse, cuando aparecen los edificios reales de vida/ciudad.jsx).
// Coste por camino: 3 mallas fusionadas siempre + 1 instanciada de cerca.
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { VISUALS } from './themes.js'
import { TAU, cityStyle, laneGapAt, makeWallBase, wallBaseInto, wallDirInto } from './vida/base.jsx'

const SHELL_K = 1.03 // radio de la piel (× R), justo por fuera del cristal
const NA = 16 // lados de la piel (el patrón lo dibuja el shader)
const RIB_STEP = 7.5 // separación de los arcos 3D

function smooth01(e0, e1, x) {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)))
  return t * t * (3 - 2 * t)
}

function strut(a, b, r) {
  const dir = new THREE.Vector3().subVectors(b, a)
  const len = dir.length()
  const g = new THREE.CylinderGeometry(r, r, len, 3, 1, true)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}

// Arco de la banda (eje local Z = tangente, Y = lejos del suelo): aro principal, arco superior con
// tirantes en celosía y dos flancos orgánicos que bajan a las pasarelas. ~510 triángulos (era 980: cientos por vía).
function buildRibGeo() {
  const parts = [new THREE.TorusGeometry(1, 0.045, 4, 32)]
  const arch = new THREE.TorusGeometry(1.2, 0.03, 4, 14, Math.PI * 0.7)
  arch.rotateZ(Math.PI * 0.15)
  parts.push(arch)
  for (const k of [-0.3, -0.15, 0, 0.15, 0.3]) {
    const t0 = Math.PI * 0.5 + k * Math.PI
    const t1 = t0 + (k <= 0 ? 0.09 : -0.09)
    parts.push(strut(
      new THREE.Vector3(Math.cos(t0) * 1.04, Math.sin(t0) * 1.04, 0),
      new THREE.Vector3(Math.cos(t1) * 1.19, Math.sin(t1) * 1.19, 0), 0.018,
    ))
  }
  for (const rz of [-Math.PI * 0.14, Math.PI * 0.86]) {
    const f = new THREE.TorusGeometry(1.12, 0.026, 4, 7, Math.PI * 0.28)
    f.rotateZ(rz)
    parts.push(f)
  }
  const flat = parts.map((p) => p.toNonIndexed())
  const g = mergeGeometries(flat, false)
  parts.forEach((p) => p.dispose())
  flat.forEach((p) => p.dispose())
  g.userData.shared = true
  g.name = 'tunel:rib'
  return g
}
let RIB_GEO = null

function toGeo({ pos, nor, uv, idx }, extra = null) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  if (extra) for (const k in extra) g.setAttribute(k, new THREE.Float32BufferAttribute(extra[k], 1))
  g.setIndex(idx)
  g.computeBoundingSphere()
  return g
}

function buildBandShell(way) {
  const sh = { pos: [], nor: [], uv: [], idx: [] }
  const city = []
  const B = makeWallBase()
  const d = new THREE.Vector3(); const p = new THREE.Vector3()

  for (const seg of way.segments) {
    if (seg.air) continue
    const R = seg.radius; const L = seg.length
    const nU = Math.max(3, Math.ceil(L / 3))
    const v0 = sh.pos.length / 3
    for (let i = 0; i <= nU; i++) {
      const u = i / nU
      wallBaseInto(seg, u, B)
      for (let j = 0; j <= NA; j++) {
        const a = (j / NA) * TAU
        wallDirInto(B, a, d)
        p.copy(B.axis).addScaledVector(d, R * SHELL_K)
        sh.pos.push(p.x, p.y, p.z); sh.nor.push(d.x, d.y, d.z); sh.uv.push(u * L, j / NA)
        city.push(seg.lanes?.length ? smooth01(0.05, 0.35, laneGapAt(seg, u, a)) : 0)
      }
    }
    for (let i = 0; i < nU; i++) {
      for (let j = 0; j < NA; j++) {
        const a = v0 + i * (NA + 1) + j; const b = a + NA + 1
        sh.idx.push(a, a + 1, b, b, a + 1, b + 1)
      }
    }
  }
  return sh.pos.length ? toGeo(sh, { aCity: city }) : null
}

function buildBandNear(way) {
  const wk = { pos: [], nor: [], uv: [], idx: [] }
  const gl = { pos: [], nor: [], uv: [], idx: [] }
  const ribs = []
  const B = makeWallBase()
  const d = new THREE.Vector3(); const n = new THREE.Vector3(); const p = new THREE.Vector3()
  const up = new THREE.Vector3(); const m = new THREE.Matrix4(); const sc = new THREE.Vector3()

  for (const seg of way.segments) {
    if (seg.air) continue
    const R = seg.radius; const L = seg.length
    const nU = Math.max(3, Math.ceil(L / 2))
    const w0 = wk.pos.length / 3
    const g0 = gl.pos.length / 3
    for (let i = 0; i <= nU; i++) {
      const u = i / nU
      wallBaseInto(seg, u, B)
      for (const side of [1, -1]) {
        wallDirInto(B, side * Math.PI * 0.5, d)
        n.crossVectors(B.T, d).multiplyScalar(side) // normal de la cubierta (lejos del suelo)
        for (const [k, r] of [[0, 1.06], [1, 1.46]]) {
          p.copy(B.axis).addScaledVector(d, R * r)
          wk.pos.push(p.x, p.y, p.z); wk.nor.push(n.x, n.y, n.z); wk.uv.push(u * L, k)
        }
        p.copy(B.axis).addScaledVector(d, R * 1.44)
        gl.pos.push(p.x, p.y, p.z); gl.nor.push(d.x, d.y, d.z); gl.uv.push(u * L, 0)
        p.addScaledVector(n, R * 0.26)
        gl.pos.push(p.x, p.y, p.z); gl.nor.push(d.x, d.y, d.z); gl.uv.push(u * L, 1)
      }
    }
    for (let i = 0; i < nU; i++) {
      for (const [so, side] of [[0, 1], [2, -1]]) {
        const a = w0 + i * 4 + so; const b = a + 1; const c = a + 4; const e = c + 1
        if (side > 0) wk.idx.push(a, c, b, c, e, b)
        else wk.idx.push(a, b, c, c, b, e)
        const gb = g0 + i * 4 + so; const gt = gb + 1; const gb1 = gb + 4; const gt1 = gb1 + 1
        if (side > 0) gl.idx.push(gb, gt, gb1, gt, gt1, gb1)
        else gl.idx.push(gb, gb1, gt, gt, gb1, gt1)
      }
    }
    const nR = Math.max(1, Math.round(L / RIB_STEP))
    for (let k = 0; k < nR; k++) {
      wallBaseInto(seg, (k + 0.5) / nR, B)
      up.copy(B.d0).negate()
      m.makeBasis(B.b, up, B.T).scale(sc.setScalar(R * SHELL_K)).setPosition(B.axis)
      ribs.push(m.clone())
    }
  }
  return {
    walk: wk.pos.length ? toGeo(wk) : null,
    rail: gl.pos.length ? toGeo(gl) : null,
    ribs,
  }
}

const FADE = { minAlpha: 0.16, minBright: 0.28, minSat: 0.25 }

/** Materiales de la banda de un camino. `wayFade` = withWayFade de Paths.jsx (atenuado por foco). */
export function createTunelMats(way, focusU, detailU, wayFade) {
  const id = way.theme.id
  const V = VISUALS[id]
  const S = cityStyle(id)
  const uni = {
    uDet: detailU,
    uR: { value: way.params.radius * SHELL_K },
    uGlass: { value: new THREE.Color(V.glass) },
    uWin: { value: new THREE.Color(S.win) },
    uNeon: { value: new THREE.Color(V.rail) },
  }
  const HEAD = 'uniform float uDet;\nuniform float uR;\nuniform vec3 uGlass;\nuniform vec3 uWin;\nuniform vec3 uNeon;'

  const shell = new THREE.MeshStandardMaterial({
    color: '#ffffff', roughness: 0.3, metalness: 0.05, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })
  shell.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCity;\nvarying vec2 vBand;\nvarying float vCity;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBand = uv;\nvCity = aCity;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
${HEAD}
varying vec2 vBand;
varying float vCity;
float bandLine(float c, float period, float hw) {
  float d = abs(fract(c / period + 0.5) - 0.5) * period;
  float aa = fwidth(c) + 1e-4;
  float sharp = 1.0 - smoothstep(hw, hw + aa, d);
  return mix(2.0 * hw / period, sharp, clamp(2.0 * hw / aa, 0.0, 1.0));
}
float bandHash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float bDet = clamp(uDet, 0.0, 1.0);
float bS = vBand.x;
float bA = vBand.y * 6.28318 * uR;
float bWob = 0.25 * sin(bS * 0.55 + vBand.y * 12.566);
float bLat = max(bandLine(bS + bA + bWob, 3.4, 0.05), bandLine(bS - bA - bWob, 3.4, 0.05));
float bHoop = bandLine(bS, 6.8, 0.09);
float bSpine = bandLine(bA + uR * 1.5708, uR * 3.14159, 0.16);
float bNeon = bandLine(bA + uR * 1.5708, uR * 3.14159, 0.035);
float bGrid = max(bandLine(bS, 0.85, 0.01), bandLine(bA, 0.85, 0.01));
float bStr = clamp(max(max(bLat * 0.85, bHoop), bSpine), 0.0, 1.0);
float bFres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.5);
vec2 bQ = vec2(bS * 4.0, bA * 4.0);
vec2 bF = fract(bQ);
float bWinM = step(0.25, bF.x) * step(bF.x, 0.75) * step(0.3, bF.y) * step(bF.y, 0.7);
float bBlock = step(0.35, bandHash(floor(vec2(bS * 0.7, bA * 0.9))));
float bLit = step(0.5, bandHash(floor(bQ))) * bWinM * bBlock;
float bCity = vCity * (1.0 - bDet) * (1.0 - bStr);
diffuseColor.rgb = mix(uGlass * 0.6 + 0.25, vec3(0.97, 0.98, 1.0), bStr);
diffuseColor.a = clamp(max(bStr * mix(1.0, 0.55, bDet), 0.05 + bFres * 0.3 + bGrid * 0.25) + bCity * (0.25 + bLit * 0.6), 0.0, 1.0);
totalEmissiveRadiance += uWin * bCity * (0.18 + bLit * 1.6) + uNeon * bNeon * 1.8 + vec3(1.0, 0.95, 0.88) * bStr * 0.06;`)
  }
  shell.customProgramCacheKey = () => 'tunel-shell-v1'

  const walk = new THREE.MeshStandardMaterial({ color: '#f3f6fa', roughness: 0.38, metalness: 0.08, side: THREE.DoubleSide })
  walk.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWk;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWk = uv;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}\nvarying vec2 vWk;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float wLamp = (1.0 - smoothstep(0.05, 0.1, vWk.y)) * step(0.6, fract(vWk.x * 0.8));
float wEdge = smoothstep(0.94, 0.99, vWk.y);
float wSeam = 1.0 - step(0.04, fract(vWk.x * 0.5));
diffuseColor.rgb *= 1.0 - wSeam * 0.18;
totalEmissiveRadiance += uWin * wLamp * 1.5 + uNeon * wEdge * 0.9;`)
  }
  walk.customProgramCacheKey = () => 'tunel-walk-v1'

  const rail = new THREE.MeshStandardMaterial({
    color: V.glass, roughness: 0.08, metalness: 0.1, transparent: true, depthWrite: false, side: THREE.DoubleSide,
  })
  rail.onBeforeCompile = (s) => {
    Object.assign(s.uniforms, uni)
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vGl;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGl = uv;')
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>\n${HEAD}\nvarying vec2 vGl;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float gTop = smoothstep(0.86, 0.92, vGl.y);
float gMul = 1.0 - smoothstep(0.02, 0.05, abs(fract(vGl.x * 1.1) - 0.5));
float gSolid = max(gTop, gMul * 0.8);
float gFres = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0);
diffuseColor.rgb = mix(diffuseColor.rgb * 0.7 + 0.2, vec3(0.97, 0.98, 1.0), gSolid);
diffuseColor.a = clamp(0.12 + gFres * 0.35 + gSolid, 0.0, 1.0);
totalEmissiveRadiance += uNeon * gTop * 0.45;`)
  }
  rail.customProgramCacheKey = () => 'tunel-rail-v1'

  const rib = new THREE.MeshStandardMaterial({
    color: '#f4f7fb', roughness: 0.3, metalness: 0.12, emissive: '#fff4e0', emissiveIntensity: 0.06,
  })

  return {
    shell: wayFade(shell, focusU, detailU, FADE),
    walk: wayFade(walk, focusU, detailU, FADE),
    rail: wayFade(rail, focusU, detailU, FADE),
    rib: wayFade(rib, focusU, detailU, FADE),
  }
}

function TunelBandaShell({ way, mat }) {
  const shell = useMemo(() => buildBandShell(way), [way])
  useEffect(() => () => shell?.dispose(), [shell])
  if (!shell) return null
  return <mesh geometry={shell} material={mat} renderOrder={2} />
}

function TunelBandaNear({ way, mats, nearRef }) {
  const d = useMemo(() => buildBandNear(way), [way])
  const ribMesh = useMemo(() => {
    if (!RIB_GEO) RIB_GEO = buildRibGeo()
    const mesh = new THREE.InstancedMesh(RIB_GEO, mats.rib, Math.max(1, d.ribs.length))
    mesh.count = d.ribs.length
    for (let i = 0; i < d.ribs.length; i++) mesh.setMatrixAt(i, d.ribs[i])
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
    return mesh
  }, [d, mats.rib])
  useEffect(() => () => {
    d.walk?.dispose()
    d.rail?.dispose()
  }, [d])
  useEffect(() => () => ribMesh.dispose(), [ribMesh])
  return (
    <>
      {d.walk && <mesh geometry={d.walk} material={mats.walk} />}
      {d.rail && <mesh geometry={d.rail} material={mats.rail} renderOrder={3} />}
      <group ref={nearRef} visible>
        {d.ribs.length > 0 && <primitive object={ribMesh} />}
      </group>
    </>
  )
}

/** Banda exterior del camino con LOD: piel siempre que esté en rango (`active`), pasarelas/arcos solo de cerca (`nearActive`). */
export function TunelBanda({ way, mats, nearRef, active = true, nearActive = true }) {
  if (!active && !nearActive) return null
  return (
    <>
      {active && <TunelBandaShell way={way} mat={mats.shell} />}
      {nearActive && <TunelBandaNear way={way} mats={mats} nearRef={nearRef} />}
    </>
  )
}
