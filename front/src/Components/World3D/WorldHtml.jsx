import { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

const _objPos = new THREE.Vector3()
const _camPos = new THREE.Vector3()
const _camDir = new THREE.Vector3()
const _delta = new THREE.Vector3()

/**
 * Etiqueta HTML proyectada en 3D sin desmontaje síncrono de raíces React.
 */
export default function WorldHtml({
  position,
  center = false,
  distanceFactor,
  farScale,
  farLift = 0,
  farFrom = 300,
  farTo = 500,
  zIndexRange = [16777271, 0],
  opacity, // opcional: { value } leído cada cuadro (fundidos sin renders de React); < 0.02 la oculta
  clamp, // opcional: [margenX, margenArriba, margenAbajo] en px; mantiene el rótulo dentro de la pantalla
  sobre, // opcional: radio (unidades locales) del objeto en el ancla; el contenido se coloca por encima de su disco proyectado
  style,
  className,
  children,
}) {
  const { camera, size, gl } = useThree()
  const group = useRef(null)
  const rootRef = useRef(null)
  const lastOp = useRef('')
  const medida = useRef({ t: 0, w: 0, h: 0 })
  const [el] = useState(() => document.createElement('div'))

  const innerStyle = useMemo(() => ({
    position: 'absolute',
    transform: center ? 'translate3d(-50%,-50%,0)' : 'none',
    ...style,
  }), [center, style])

  useEffect(() => {
    const target = gl.domElement?.parentNode
    if (!target) return
    el.style.cssText = 'position:absolute;top:0;left:0;transform-origin:0 0;pointer-events:none;display:none;'
    target.appendChild(el)
    const root = createRoot(el)
    rootRef.current = root
    return () => {
      rootRef.current = null
      el.remove()
      // Diferir unmount evita el error de React 19 al desmontar durante un commit activo
      queueMicrotask(() => root.unmount())
    }
  }, [el, gl])

  useEffect(() => {
    rootRef.current?.render(
      <div style={innerStyle} className={className}>
        {children}
      </div>
    )
  }, [children, className, innerStyle])

  useFrame(() => {
    const obj = group.current
    if (!obj) return
    camera.updateMatrixWorld()
    obj.updateWorldMatrix(true, false)

    _objPos.setFromMatrixPosition(obj.matrixWorld)
    _camPos.setFromMatrixPosition(camera.matrixWorld)
    _delta.subVectors(_objPos, _camPos)
    const dist = _delta.length()
    camera.getWorldDirection(_camDir)

    const op = opacity ? opacity.value : 1
    const detras = dist < 1e-4 || _delta.angleTo(_camDir) > Math.PI / 2
    // con clamp, un ancla detrás de la cámara no se oculta: se pega al borde con flecha (ver abajo)
    const behind = (detras && !clamp) || op < 0.02
    if (opacity) {
      const s = op >= 0.995 ? '' : op.toFixed(2)
      if (lastOp.current !== s) { lastOp.current = s; el.style.opacity = s }
    }
    if (behind) {
      if (el.style.display !== 'none') el.style.display = 'none'
      return
    }
    if (el.style.display !== 'block') el.style.display = 'block'

    _objPos.project(camera)
    let x = _objPos.x * (size.width * 0.5) + (size.width * 0.5)
    let y = -(_objPos.y * (size.height * 0.5)) + (size.height * 0.5)
    if (clamp) {
      // el rótulo entero dentro de la pantalla: se sujeta con su propio ancho/alto (medidos cada ~0.5 s)
      const hijo = el.firstElementChild
      const t = performance.now()
      if (hijo && (!medida.current.t || t - medida.current.t > 500)) medida.current = { t, w: hijo.offsetWidth, h: hijo.offsetHeight }
      const hw = center ? medida.current.w / 2 : 0
      const hh = center ? medida.current.h / 2 : 0
      if (detras) {
        // detrás de la cámara la proyección se invierte: se refleja y se lleva al borde inferior
        x = size.width - x
        y = size.height * 2
      }
      const x0 = Math.min(size.width / 2, clamp[0] * 0.25 + hw + 8)
      const xs = Math.min(size.width - x0, Math.max(x0, x))
      const ys = Math.min(size.height - clamp[2] - hh, Math.max(clamp[1] + hh, y))
      const borde = ys > y + 1 ? 'arr' : ys < y - 1 ? 'aba' : xs > x + 1 ? 'izq' : xs < x - 1 ? 'der' : ''
      if (el.dataset.borde !== borde) el.dataset.borde = borde
      x = xs; y = ys
    }

    if (sobre) {
      // bocadillo anclado por encima de la cabeza EN PÍXELES: borde inferior ≥ 6 px sobre el disco proyectado
      // de la ballita (radio `sobre` en unidades locales); si no cabe arriba, a un lado. Nunca encima de la cara.
      const hijo = el.firstElementChild
      const t = performance.now()
      if (hijo && (!medida.current.t || t - medida.current.t > 500)) medida.current = { t, w: hijo.offsetWidth, h: hijo.offsetHeight }
      const { w, h } = medida.current
      const vFov = (camera.fov * Math.PI) / 180
      const rPx = (sobre * obj.matrixWorld.getMaxScaleOnAxis()) / Math.max(dist * Math.tan(vFov / 2), 1e-4) * size.height * 0.5
      const techo = 64 // HUD superior
      let lado = 'arr'
      let yy = y - rPx - 6 - h / 2 - 5 // 5 px del pico
      if (yy - h / 2 < techo) {
        lado = x < size.width / 2 ? 'izq' : 'der'
        yy = Math.max(techo + h / 2, y - rPx * 0.6)
        x += (lado === 'izq' ? 1 : -1) * (rPx + 10 + w / 2)
      }
      x = Math.min(size.width - 6 - w / 2, Math.max(6 + w / 2, x))
      y = yy
      if (el.dataset.lado !== lado) el.dataset.lado = lado
    }

    let scale = 1
    let lift = 0
    if (distanceFactor !== undefined) {
      if (camera.isOrthographicCamera) {
        scale = camera.zoom * distanceFactor
      } else {
        const vFov = (camera.fov * Math.PI) / 180
        scale = distanceFactor / Math.max(2 * Math.tan(vFov * 0.5) * dist, 1e-4)
      }
    }

    // Rótulo de mapa: de lejos (farFrom→farTo) crece hasta farScale fija en pantalla.
    if (farScale !== undefined && scale < farScale) {
      const k = THREE.MathUtils.smoothstep(dist, farFrom, farTo)
      scale += (farScale - scale) * k
      lift = farLift * k
    }

    const span = Math.max(camera.far - camera.near, 1e-4)
    const a = (zIndexRange[1] - zIndexRange[0]) / span
    const b = zIndexRange[1] - a * camera.far
    el.style.zIndex = `${Math.round(a * dist + b)}`
    el.style.transform = `translate3d(${x.toFixed(1)}px,${(y - lift).toFixed(1)}px,0) scale(${scale.toFixed(4)})`
  })

  return <group ref={group} position={position} />
}
