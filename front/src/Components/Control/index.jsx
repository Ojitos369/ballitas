import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Formar from './Formar.jsx'
import Fila from './Fila.jsx'
import Decisiones from './Decisiones.jsx'
import Selector from './Selector.jsx'
import '../../static/css/control.css'

const MOTIVOS_LIBRE = {
  inactivo: 'Perdiste el control tras 3 rutas sin decidir.',
  muerte: 'Tu ballita murió. Puedes formar o tomar otra.',
  desconectado: 'Control liberado por desconexión.',
}

function esMovilInicial() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(max-width: 640px)').matches ?? false
}

export default function Control({ mundo, selected, onSelect }) {
  const [, setRev] = useState(0)
  const [panelAbierto, setPanelAbierto] = useState(() => !esMovilInicial())
  const [selector, setSelector] = useState(null) // 'planeta' | 'ruta' | 'carril' | null
  const [aviso, setAviso] = useState(null)
  const selectorRef = useRef(null)
  selectorRef.current = selector
  const cerrarSelector = useCallback(() => setSelector(null), [])

  // Listener persistente en fase de captura: se registra al montar (antes que el Esc de POV en Scene)
  // para cerrar primero el selector sin sacar al usuario de la vista POV.
  useEffect(() => {
    const onEsc = (e) => {
      if (e.key === 'Escape' && selectorRef.current) {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setSelector(null)
      }
    }
    window.addEventListener('keydown', onEsc, true)
    return () => window.removeEventListener('keydown', onEsc, true)
  }, [])

  useEffect(() => {
    if (!mundo?.on) return undefined
    const bump = () => setRev((n) => n + 1)
    const offCambio = mundo.on('cambio', bump)
    const offEntra = mundo.on('entra', (ev) => {
      bump()
      if (ev?.mia && ev.b) {
        setAviso(`¡${ev.nombre} entró al mundo! Ya tienes el control.`)
        onSelect?.(ev.b)
      }
    })
    const offLibre = mundo.on('libre', (ev) => {
      bump()
      if (ev?.mia && MOTIVOS_LIBRE[ev.motivo]) {
        setAviso(MOTIVOS_LIBRE[ev.motivo])
      }
    })
    return () => {
      offCambio?.()
      offEntra?.()
      offLibre?.()
    }
  }, [mundo, onSelect])

  useEffect(() => {
    if (!aviso) return undefined
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  const miBallita = mundo?.ballitas?.find((b) => b.mia && b.phase !== 'dying' && b.phase !== 'gone') || null
  const fila = mundo?.fila || []
  const miIdx = fila.findIndex((f) => f.mia)
  const miEnFila = miIdx >= 0 ? fila[miIdx] : null

  // Cerrar selector si la ballita controlada muere o deja de ser nuestra.
  useEffect(() => {
    if (selector && !miBallita) setSelector(null)
  }, [selector, miBallita])

  const opciones = useMemo(() => {
    if (!selector || !miBallita || !mundo?.opciones) return null
    return mundo.opciones(miBallita)
  }, [selector, miBallita, mundo, miBallita?.node, miBallita?.phase, miBallita?.way?.idx, miBallita?.dec, miBallita?.auto])

  if (!mundo) return null

  const estadoTexto =
    mundo.estado === 'reconectando' ? 'Reconectando…'
    : mundo.estado === 'sin_servidor' ? 'Sin conexión (local)'
    : mundo.estado === 'conectando' ? 'Conectando…'
    : null

  const textoBotonHub = miEnFila
    ? `#${miIdx + 1} en fila · ${miEnFila.nombre}`
    : miBallita
      ? `🎮 ${miBallita.name} · Fila (${fila.length})`
      : `✨ Formar · Fila (${fila.length})`

  return (
    <>
      <div className="ctrl-hub">
        <div className="ctrl-hub-bar">
          {estadoTexto && <span className="ctrl-estado-badge">{estadoTexto}</span>}
          {mundo.espectadores > 1 && (
            <span className="ctrl-espectadores" title="Espectadores conectados">
              👀 {mundo.espectadores}
            </span>
          )}
          <button
            type="button"
            className="ctrl-hub-toggle"
            aria-expanded={panelAbierto}
            aria-controls="ctrl-hub-panel"
            onClick={() => setPanelAbierto((v) => !v)}
          >
            {textoBotonHub} {panelAbierto ? '▾' : '▸'}
          </button>
        </div>

        {panelAbierto && (
          <section id="ctrl-hub-panel" className="ctrl-panel" aria-label="Formar ballita y fila">
            <Formar
              mundo={mundo}
              miBallita={miBallita}
              miEnFila={miEnFila}
              miPuesto={miIdx + 1}
            />
            <Fila mundo={mundo} />
          </section>
        )}
      </div>

      {aviso && (
        <div className="ctrl-toast" role="status" aria-live="polite">
          <span>{aviso}</span>
          <button type="button" className="cerrar" aria-label="Cerrar aviso" onClick={() => setAviso(null)}>×</button>
        </div>
      )}

      <Decisiones
        mundo={mundo}
        miBallita={miBallita}
        selected={selected}
        onSelect={onSelect}
        selectorAbierto={selector}
        onOpenSelector={(tipo) => setSelector((prev) => (prev === tipo ? null : tipo))}
      />

      {selector && miBallita && opciones && (
        <Selector
          tipo={selector}
          mundo={mundo}
          ballita={miBallita}
          opciones={opciones}
          onClose={cerrarSelector}
        />
      )}
    </>
  )
}
