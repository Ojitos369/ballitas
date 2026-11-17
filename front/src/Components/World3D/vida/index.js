// Registro de módulos de vida por tema. Cada archivo <id>.jsx se edita de forma independiente;
// aquí solo se enlaza el id del tema con su componente (contrato en README.md).
import { createElement, useLayoutEffect, useRef } from 'react'
import { VidaGuard, disposeObject3D } from './base.jsx'
import sombrio from './sombrio.jsx'
import bosque from './bosque.jsx'
import mar from './mar.jsx'
import desierto from './desierto.jsx'
import hielo from './hielo.jsx'
import volcan from './volcan.jsx'
import cristal from './cristal.jsx'
import nubes from './nubes.jsx'
import neon from './neon.jsx'
import jardin from './jardin.jsx'
import Ciudad from './ciudad.jsx'

export const VIDA = { sombrio, bosque, mar, desierto, hielo, volcan, cristal, nubes, neon, jardin }

function VidaVacia() {
  return null
}

/** getVida(themeId) -> componente `Vida({ way, world, detail, focused, time })` (o uno vacío). */
export function getVida(themeId) {
  return VIDA[themeId] ?? VidaVacia
}

export const VIDA_PERF = {
  active: 0,
  totalMounts: 0,
  mountTimes: [],
}

/** Monta el módulo del tema del `way` dentro de un VidaGuard (un fallo no tumba la escena). */
export function VidaDeCamino(props) {
  const id = props.way?.theme?.id
  const wrapRef = useRef(null)
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
    createElement(VidaGuard, { themeId: id }, createElement(getVida(id), props)),
    createElement(VidaGuard, { themeId: `${id}:ciudad` }, createElement(Ciudad, props)),
  )
}

export { VIDA_BUS } from './base.jsx'
