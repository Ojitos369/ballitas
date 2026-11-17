import { useEffect, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Destino de la compilación: como el composer pinta en un RT lineal sin tone mapping, compilar con un RT
// activo da la misma clave de programa que el render real (con null saldría otra variante).
let PRE_RT = null

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
      if (vivo && g) precompilar(gl, g, camera, scene).then(() => revelar(() => { if (vivo) g.visible = true }))
    })
    return () => { vivo = false; cancelAnimationFrame(raf) }
  }, [gl, camera, scene])
  return <group ref={ref} visible={false}>{children}</group>
}
