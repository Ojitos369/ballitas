// Registro de módulos de vida por tema. Cada archivo <id>.jsx se edita de forma independiente;
// aquí solo se enlaza el id del tema con su componente (contrato en README.md).
import { createElement } from 'react'
import { VidaGuard } from './base.jsx'
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

export const VIDA = { sombrio, bosque, mar, desierto, hielo, volcan, cristal, nubes, neon, jardin }

function VidaVacia() {
  return null
}

/** getVida(themeId) -> componente `Vida({ way, world, detail, focused, time })` (o uno vacío). */
export function getVida(themeId) {
  return VIDA[themeId] ?? VidaVacia
}

/** Monta el módulo del tema del `way` dentro de un VidaGuard (un fallo no tumba la escena). */
export function VidaDeCamino(props) {
  const id = props.way?.theme?.id
  return createElement(VidaGuard, { themeId: id }, createElement(getVida(id), props))
}

export { VIDA_BUS } from './base.jsx'
