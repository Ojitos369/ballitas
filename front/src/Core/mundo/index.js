import { crearLocal } from './local.js'
import { conectarRemoto } from './remoto.js'

export async function crearMundo({ modo, url, semilla=369 }={}) {
  // Modo explícito de desarrollo: ?local=1. Si no se especifica, remoto si responde y local al agotar 5 s.
  if (modo === 'local' || new URLSearchParams(location.search).get('local') === '1') return crearLocal({ semilla, registrarBack: false })
  const wsUrl=url || `${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`
  try { return await conectarRemoto({ url:wsUrl, semilla, timeout:5000 }) }
  catch { return crearLocal({ semilla }) }
}
