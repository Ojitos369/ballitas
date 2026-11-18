// Contenido de cerca de cada camino: solo la pista de carreras del tema y sus mecanismos (pista.jsx).
// Los antiguos dioramas por tema (gradas, carteles, criaturas, ciudad) se retiraron para dejar el tubo
// limpio; viven en el historial de git si hace falta recuperar alguna pieza.
import { createElement, useLayoutEffect, useRef } from 'react'
import { VidaGuard, disposeObject3D, setWayDetail } from './base.jsx'
import Pista from './pista.jsx'
import Criaturas from './criaturas.jsx'
import Uniones from './uniones.jsx'

export const VIDA_PERF = {
  active: 0,
  totalMounts: 0,
  mountTimes: [],
}

/** Monta la pista del `way` dentro de un VidaGuard (un fallo no tumba la escena). */
export function VidaDeCamino(props) {
  const id = props.way?.theme?.id
  const wrapRef = useRef(null)
  setWayDetail(props.way, props.detail)
  // Layout y no pasivo: al desmontar, r3f desengancha los hijos antes de los efectos pasivos y el traverse quedaba vacío (fuga).
  useLayoutEffect(() => {
    VIDA_PERF.active += 1
    VIDA_PERF.totalMounts += 1
    VIDA_PERF.mountTimes.push(performance.now())
    if (VIDA_PERF.mountTimes.length > 200) {
      VIDA_PERF.mountTimes.splice(0, VIDA_PERF.mountTimes.length - 200)
    }
    const root = wrapRef.current
    return () => {
      VIDA_PERF.active -= 1
      disposeObject3D(root)
    }
  }, [])
  return createElement(
    'group',
    { ref: wrapRef },
    createElement(VidaGuard, { themeId: id }, createElement(Pista, props), createElement(Criaturas, props)),
    createElement(VidaGuard, { themeId: id }, createElement(Uniones, props)),
  )
}

export { VIDA_BUS } from './base.jsx'
