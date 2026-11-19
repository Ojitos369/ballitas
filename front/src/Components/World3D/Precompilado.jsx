import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Destino de la compilación: como el composer pinta en un RT lineal sin tone mapping, compilar con un RT
// activo da la misma clave de programa que el render real (con null saldría otra variante).
let PRE_RT = null
const TEX_KEYS = ['map', 'emissiveMap', 'alphaMap', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap']

/**
 * Compila (en paralelo si hay KHR_parallel_shader_compile) los programas de `obj`, incluidos los ocultos,
 * y resuelve cuando TODOS los programas están listos: compileAsync solo espera el último programa de cada
 * material y los transparentes de doble cara crean dos (cara trasera y delantera).
 */
export function precompilar(gl, obj, camera, scene) {
  PRE_RT ??= new THREE.WebGLRenderTarget(1, 1)
  const prev = gl.getRenderTarget()
  try {
    gl.setRenderTarget(PRE_RT)
    gl.compile(obj, camera, scene)
    // Sube también sus texturas: al revelarse no se dibuja nada con el mapa a medio subir.
    obj.traverse((o) => {
      for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
        for (const k of TEX_KEYS) if (m[k]?.isTexture && m[k].image) gl.initTexture(m[k])
      }
    })
  } catch {
    return Promise.resolve()
  } finally {
    gl.setRenderTarget(prev)
  }
  return new Promise((resolve) => {
    const listo = () => ((gl.info.programs ?? []).every((p) => p.isReady()) ? resolve() : setTimeout(listo, 10))
    listo()
  })
}

/**
 * Programa de la pasada de sombra de las ballitas (las únicas que proyectan): en el mapa la sombra no se
 * renderiza, así que la primera Ballita lo enlazaba dentro del cuadro. Variante exacta: material de
 * profundidad RGBA, cara trasera (shadowSide de FrontSide), con mapa y sin niebla (la pasada no usa escena).
 */
let SOMBRA = null
export function precompilarSombra(gl, camera, scene) {
  SOMBRA ??= new THREE.Mesh(new THREE.PlaneGeometry(0.01, 0.01), new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking, side: THREE.BackSide, map: new THREE.DataTexture(new Uint8Array(4), 1, 1),
  }))
  const fog = scene.fog
  scene.fog = null
  try { return precompilar(gl, SOMBRA, camera, scene) } finally { scene.fog = fog }
}

// Enlace forzado: ANGLE resuelve el enlace real en la primera consulta de uniforms (decenas a cientos de ms por
// programa) aunque isReady() ya diga que sí. Se paga aquí, un programa por hueco libre (con plazo: en el móvil o con
// los cuadros llenos no siempre hay hueco), en vez de dentro del cuadro que lo dibuja por primera vez.
const enlazados = new WeakSet()
const esperas = []
let enlazando = false
const hueco = (f) => (typeof window !== 'undefined' && window.requestIdleCallback ? window.requestIdleCallback(f, { timeout: 250 }) : setTimeout(f, 16))
export const ENLACE = { programas: 0, ms: 0, max: 0 } // ?stats=1: window.__enlace
if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('stats') === '1') window.__enlace = ENLACE

/** Enlaza los programas aún sin enlazar, uno por hueco; resuelve cuando no queda ninguno pendiente. */
export function enlazarPendientes(gl) {
  return new Promise((resolve) => {
    esperas.push(resolve)
    if (enlazando) return
    enlazando = true
    const sig = () => {
      const lista = gl.info.programs ?? []
      let p = null; let compilando = false
      for (const x of lista) {
        if (enlazados.has(x)) continue
        if (x.isReady()) { p = x; break }
        compilando = true
      }
      if (p) {
        enlazados.add(p)
        const t0 = performance.now()
        p.getUniforms()
        const dt = performance.now() - t0
        ENLACE.programas++; ENLACE.ms += dt; ENLACE.max = Math.max(ENLACE.max, Math.round(dt))
        hueco(sig)
      } else if (compilando) setTimeout(sig, 20) // compilación en paralelo aún en curso
      else { enlazando = false; esperas.splice(0).forEach((r) => r()) }
    }
    hueco(sig)
  })
}

// Primer dibujo oculto: en ANGLE/D3D el primer draw de un programa (y de cada formato de vértices) aún traduce y
// compila el sombreador nativo: 50-300 ms por programa aunque ya esté enlazado. Se dibuja una vez, fuera del cuadro,
// un ejemplar por programa en un RT de 1×1 con la escena real (mismas luces, niebla, entorno: misma clave) y una capa
// propia para que no se pinte nada más. Las sombras no se recalculan en ese render (el mapa de sombras no se toca).
const CAPA = 31
let CAM = null
const dibujados = new WeakSet() // programas ya dibujados una vez
function dibujarOculto(gl, mesh, scene, camera) {
  PRE_RT ??= new THREE.WebGLRenderTarget(1, 1)
  CAM ??= new THREE.PerspectiveCamera()
  CAM.copy(camera)
  CAM.layers.set(CAPA)
  const luces = []
  scene.traverse((o) => { if (o.isLight && !o.layers.isEnabled(CAPA)) { o.layers.enable(CAPA); luces.push(o) } })
  const mask = mesh.layers.mask
  const culled = mesh.frustumCulled
  mesh.layers.set(CAPA)
  mesh.frustumCulled = false
  const ocultos = []
  for (let p = mesh; p; p = p.parent) if (!p.visible) { ocultos.push(p); p.visible = true }
  const prevRT = gl.getRenderTarget()
  const sm = gl.shadowMap; const smAuto = sm.autoUpdate; const smNeeds = sm.needsUpdate
  const autoMat = scene.matrixWorldAutoUpdate
  const infoReset = gl.info.autoReset
  try {
    sm.autoUpdate = false; sm.needsUpdate = false
    scene.matrixWorldAutoUpdate = false
    gl.info.autoReset = false
    gl.setRenderTarget(PRE_RT)
    gl.render(scene, CAM)
  } catch { /* nada: es solo calentado */ } finally {
    gl.setRenderTarget(prevRT)
    sm.autoUpdate = smAuto; sm.needsUpdate = smNeeds
    scene.matrixWorldAutoUpdate = autoMat
    gl.info.autoReset = infoReset
    for (const p of ocultos) p.visible = false
    mesh.layers.mask = mask
    mesh.frustumCulled = culled
    for (const l of luces) l.layers.disable(CAPA)
  }
}

/** Dibuja oculto, uno por hueco, un ejemplar de cada programa de `root` aún no dibujado; resuelve al terminar. */
export function primerDibujo(gl, root, scene, camera) {
  const porPrograma = new Map()
  root.traverse((o) => {
    if (!(o.isMesh || o.isPoints || o.isLine) || !o.geometry) return
    if (o.isInstancedMesh && o.count === 0) return
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      const prog = gl.properties.get(m).currentProgram
      if (prog && !dibujados.has(prog) && !porPrograma.has(prog)) porPrograma.set(prog, o)
    }
  })
  const lista = [...porPrograma]
  if (!lista.length) return Promise.resolve()
  return new Promise((resolve) => {
    const sig = () => {
      const t0 = performance.now()
      // varios por hueco mientras quede tiempo (con ~1 ms por dibujo ya en caché); al menos uno
      while (lista.length) {
        const [prog, mesh] = lista.shift()
        if (!dibujados.has(prog)) { dibujados.add(prog); if (mesh.parent) dibujarOculto(gl, mesh, scene, camera) }
        if (performance.now() - t0 > 4) break
      }
      if (lista.length) hueco(sig)
      else resolve()
    }
    hueco(sig)
  })
}

// Una capa revelada por cuadro: el primer dibujo de un programa aún paga su resolución en el driver
// (ANGLE/D3D), y revelar túnel, interior, vida y ciudad a la vez lo sumaba todo en un solo cuadro.
const cola = []
function paso() {
  cola.shift()?.()
  if (cola.length) requestAnimationFrame(paso)
}
function revelar(fn) {
  cola.push(fn)
  if (cola.length === 1) requestAnimationFrame(paso)
}

/**
 * Monta sus hijos ocultos, compila sus programas un cuadro después y los muestra al quedar listos: la
 * primera entrada a Camino/Ballita no congela el hilo esperando el enlace de decenas de shaders (capas
 * cercanas del túnel y del camino, vida). Con los programas ya en caché se muestra al cuadro siguiente.
 */
export default function Precompilado({ children }) {
  const ref = useRef()
  const gl = useThree((s) => s.gl)
  const camera = useThree((s) => s.camera)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    let vivo = true
    const g = ref.current
    const raf = requestAnimationFrame(() => {
      // compila, enlaza lo nuevo fuera del cuadro y revela: con todo ya en caché se muestra al cuadro siguiente
      if (vivo && g) {
        precompilar(gl, g, camera, scene)
          .then(() => (vivo ? enlazarPendientes(gl) : null))
          .then(() => (vivo ? primerDibujo(gl, g, scene, camera) : null))
          .then(() => revelar(() => { if (vivo) g.visible = true }))
      }
    })
    return () => { vivo = false; cancelAnimationFrame(raf) }
  }, [gl, camera, scene])
  return <group ref={ref} visible={false}>{children}</group>
}
