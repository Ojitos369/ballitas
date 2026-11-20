import { crearLocal } from './local.js'
import { conectarRemoto, leerId } from './remoto.js'
import { V } from '../protocolo.js'

export async function crearMundo({ modo, url, semilla=369 }={}) {
  // El relevo de FastAPI cuelga de /api (back/apis/mundo_ws.py): la URL es /api/ws.
  // Modo explícito de desarrollo: ?local=1. Si no se especifica, remoto si responde y local al agotar 5 s.
  if (modo === 'local' || new URLSearchParams(location.search).get('local') === '1' || new URLSearchParams(location.search).get('mundo') === 'local') return crearLocal({ semilla, registrarBack: false })
  const wsUrl=url || `${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/ws`
  try { return await conectarRemoto({ url:wsUrl, semilla, timeout:5000 }) }
  catch {
    // Respaldo local mientras el servidor arranca (11-17 s tras un despliegue): sonda ligera cada 15 s
    // (solo espera el 'hola', sin construir el mundo) y recarga al responder, para no quedarse en un mundo aparte.
    const sonda = setInterval(() => {
      let ws
      try { ws = new WebSocket(wsUrl) } catch { return }
      ws.onopen = () => ws.send(JSON.stringify({ k: 'hola', v: V, id: leerId() }))
      ws.onmessage = (ev) => { try { if (JSON.parse(ev.data).k === 'hola') { clearInterval(sonda); location.reload() } } catch {} ; ws.close() }
      ws.onerror = () => ws.close()
      setTimeout(() => { try { ws.close() } catch {} }, 5000)
    }, 15000)
    return crearLocal({ semilla })
  }
}
