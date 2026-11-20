import { useState } from 'react'
import { themeColor } from './previas.js'

const colorDe = (b) => `hsl(${Math.round((b?.genome?.hue ?? 0.5) * 360)} 75% 60%)`

export default function Decisiones({
  mundo,
  miBallita,
  selected,
  onSelect,
  selectorAbierto,
  onOpenSelector,
}) {
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')

  const tomar = async () => {
    if (!selected || ocupado) return
    setOcupado(true)
    setErr('')
    try {
      const res = await mundo.tomar(selected)
      if (!res?.ok) setErr(res?.error === 'ocupada' ? 'Alguien la tomó antes.' : 'No se pudo tomar el control.')
    } finally {
      setOcupado(false)
    }
  }

  const dejar = async () => {
    if (!miBallita || ocupado) return
    setOcupado(true)
    setErr('')
    try {
      await mundo.dejar(miBallita)
    } finally {
      setOcupado(false)
    }
  }

  const limpiarUno = async (campo, e) => {
    e.stopPropagation()
    if (!miBallita) return
    await mundo.decidir(miBallita, { [campo]: null })
  }

  // Sin ballita propia: ofrecer tomar control si la seleccionada está libre.
  if (!miBallita) {
    if (!selected || selected.phase === 'dying' || selected.phase === 'gone') return null
    return (
      <div className="ctrl-barra-tomar" role="region" aria-label="Control de ballita seleccionada">
        <span className="punto" style={{ background: colorDe(selected) }} />
        <span className="ctrl-tomar-nom">{selected.name}</span>
        {selected.ctrl ? (
          <span className="ctrl-tomar-estado">Controlada por otro espectador</span>
        ) : (
          <button type="button" className="ctrl-btn-primario" disabled={ocupado} onClick={tomar}>
            {ocupado ? 'Tomando…' : 'Tomar control'}
          </button>
        )}
        {err && <span className="ctrl-error">{err}</span>}
      </div>
    )
  }

  const world = mundo.world
  const dec = miBallita.dec || {}
  const auto = miBallita.auto
  const autoWay = auto ? world.ways[auto.way] : null
  const autoNode = autoWay ? world.nodes[autoWay.to] : null
  const autoRoute = autoWay ? autoWay.routes[auto.r] : null

  const decNode = dec.destino != null ? world.nodes[dec.destino] : null
  const decWay = dec.ruta ? world.ways[dec.ruta.way] : null
  const decRoute = decWay ? decWay.routes[dec.ruta.r] : null

  const maxSin = mundo.reglas?.maxSinDecidir ?? 3
  const sinDec = miBallita.sinDecidir ?? 0
  const restantes = Math.max(1, maxSin - sinDec)
  const hayAlguna = dec.destino != null || dec.ruta != null || dec.carril != null

  const textoPlaneta = decNode
    ? decNode.name
    : autoNode
      ? `Automático: ${autoNode.name}`
      : 'Automático: por calcular'

  const textoRuta = decRoute && decWay
    ? `${decWay.theme.emoji} Ruta ${decRoute.name}`
    : autoRoute && autoWay
      ? `Automático: ${autoWay.theme.emoji} ${autoRoute.name}`
      : 'Automático: por calcular'

  const textoCarril = dec.carril != null
    ? `Carril ${dec.carril + 1} de 5`
    : 'Automático: al azar'

  return (
    <section className="ctrl-barra-dec" aria-label="Decisiones de control para el siguiente viaje">
      <div className="ctrl-barra-dec-top">
        <button
          type="button"
          className="ctrl-mi-ballita"
          onClick={() => onSelect?.(miBallita)}
          title="Seleccionar tu ballita en la escena"
        >
          <span className="punto" style={{ background: colorDe(miBallita) }} />
          <strong>{miBallita.name}</strong>
          {selected !== miBallita && <span className="ctrl-ir">Ver</span>}
        </button>

        {(sinDec > 0 || !hayAlguna) && (
          <span
            className={`ctrl-aviso-inact${restantes === 1 ? ' alerta' : sinDec > 0 ? ' medio' : ''}`}
            role="status"
          >
            {sinDec > 0 ? '⏳ ' : ''}
            Te {restantes === 1 ? 'queda' : 'quedan'} {restantes} {restantes === 1 ? 'ruta' : 'rutas'} sin decidir
          </span>
        )}

        <button
          type="button"
          className="ctrl-btn-dejar"
          disabled={ocupado}
          onClick={dejar}
        >
          Dejar de controlar
        </button>
      </div>

      <div className="ctrl-barra-botones">
        <div className="ctrl-dec-slot">
          <button
            type="button"
            className={`ctrl-dec-btn${decNode ? ' fija' : ''}`}
            aria-expanded={selectorAbierto === 'planeta'}
            style={decNode ? { borderColor: decNode.color } : undefined}
            onClick={() => onOpenSelector('planeta')}
          >
            <small>Planeta destino</small>
            <span>{decNode ? `🪐 ${textoPlaneta}` : textoPlaneta}</span>
          </button>
          {decNode && (
            <button
              type="button"
              className="ctrl-dec-clear"
              aria-label="Quitar planeta destino elegido"
              title="Volver a automático"
              onClick={(e) => limpiarUno('destino', e)}
            >
              ×
            </button>
          )}
        </div>

        <div className="ctrl-dec-slot">
          <button
            type="button"
            className={`ctrl-dec-btn${decRoute ? ' fija' : ''}`}
            aria-expanded={selectorAbierto === 'ruta'}
            style={decWay ? { borderColor: themeColor(decWay.theme.id) } : undefined}
            onClick={() => onOpenSelector('ruta')}
          >
            <small>Ruta</small>
            <span>{textoRuta}</span>
          </button>
          {decRoute && (
            <button
              type="button"
              className="ctrl-dec-clear"
              aria-label="Quitar ruta elegida"
              title="Volver a automático"
              onClick={(e) => limpiarUno('ruta', e)}
            >
              ×
            </button>
          )}
        </div>

        <div className="ctrl-dec-slot">
          <button
            type="button"
            className={`ctrl-dec-btn${dec.carril != null ? ' fija' : ''}`}
            aria-expanded={selectorAbierto === 'carril'}
            onClick={() => onOpenSelector('carril')}
          >
            <small>Carril inicial</small>
            <span>{dec.carril != null ? `🛤 ${textoCarril}` : textoCarril}</span>
          </button>
          {dec.carril != null && (
            <button
              type="button"
              className="ctrl-dec-clear"
              aria-label="Quitar carril elegido"
              title="Volver a automático"
              onClick={(e) => limpiarUno('carril', e)}
            >
              ×
            </button>
          )}
        </div>
      </div>
    </section>
  )
}
