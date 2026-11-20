import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Tarjeta from './Tarjeta.jsx'

const fmt = (n) => {
  const v = Math.round(n * 10) / 10
  const r = Number.isInteger(v) ? v : v.toFixed(1)
  return v > 0 ? `+${r}` : v < 0 ? `−${Math.abs(r)}` : '0'
}

const fmtInt = (n) => {
  const v = Math.round(n)
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0'
}

function keyOf(tipo, item) {
  if (!item) return ''
  if (tipo === 'planeta') return `p:${item.idx}`
  if (tipo === 'ruta') return `r:${item.wayIdx}:${item.r}`
  return `c:${item.carril}`
}

function isElegida(tipo, item, dec) {
  if (!dec || !item) return false
  if (tipo === 'planeta') return dec.destino === item.idx
  if (tipo === 'ruta') return dec.ruta?.way === item.wayIdx && dec.ruta?.r === item.r
  return dec.carril === item.carril
}

function DetallePlaneta({ item, ballita, onElegir, elegida }) {
  const ganaDest = item.destinos.map((d) => {
    const signo = d.kind === 'puntos' ? `⭐ ${fmtInt(d.dp)}` : `⚡ ${fmtInt(d.de)}`
    const costo = d.kind === 'puntos'
      ? (d.de < 0 ? `${fmtInt(d.de)}⚡` : null)
      : (d.dp < 0 ? `${fmtInt(d.dp)}⭐` : null)
    return { ...d, signo, costo }
  })
  const riesgoPct = Math.round((item.theme.risk ?? 0) * 100)

  return (
    <div className="ctrl-detalle">
      <div className="ctrl-detalle-head">
        <span className="punto" style={{ background: item.color }} />
        <div>
          <h4>{item.name}</h4>
          <p className="ctrl-detalle-sub">
            {item.theme.emoji} {item.theme.name} · riesgo {riesgoPct}% · {item.visitado ? 'Ya visitado' : 'Sin explorar'}
          </p>
        </div>
      </div>

      <div className="ctrl-detalle-bloque">
        <h5>Qué se gana</h5>
        <p className="ctrl-detalle-resumen pos">
          Edificios: hasta +{item.maxDp} ⭐ y hasta +{item.maxDe} ⚡
        </p>
        <ul className="ctrl-detalle-lista">
          {ganaDest.map((d) => (
            <li key={d.idx}>
              <span>{d.kind === 'puntos' ? '⭐' : '⚡'} {d.name}</span>
              <span className="pos">{d.signo}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="ctrl-detalle-bloque">
        <h5>Qué se pierde (edificios y viaje)</h5>
        <ul className="ctrl-detalle-lista">
          {ganaDest.filter((d) => d.costo).map((d) => (
            <li key={`c-${d.idx}`}>
              <span>Al usar {d.name}</span>
              <span className="neg">{d.costo}</span>
            </li>
          ))}
          {item.mejorRuta && (
            <li>
              <span>Viaje (mejor ruta {item.mejorRuta.name}, ~{Math.round(item.mejorRuta.duracion)} s)</span>
              <span>
                <em className="neg">{fmtInt(item.mejorRuta.dE)}⚡</em>{' '}
                <em className={item.mejorRuta.dP >= 0 ? 'pos' : 'neg'}>{fmtInt(item.mejorRuta.dP)}⭐</em>
              </span>
            </li>
          )}
        </ul>
      </div>

      <div className={`ctrl-detalle-balance${item.muere ? ' peligro' : ''}`}>
        <strong>
          Llegarías con ~{Math.round(item.llegarE)} ⚡ y ~{Math.round(item.llegarP)} ⭐
        </strong>
        <span>
          {item.muere
            ? '⚠ Alguna barra bajaría de 0 en el camino (podría morir).'
            : `Compañeras ahí o en camino: ${item.peers} · Ahora tienes ${Math.round(ballita.e)}⚡ / ${Math.round(ballita.p)}⭐.`}
        </span>
      </div>

      <button type="button" className="ctrl-btn-primario ctrl-btn-elegir" onClick={() => onElegir(item)}>
        {elegida ? `✓ Planeta elegido (${item.name})` : `Elegir ${item.name}`}
      </button>
    </div>
  )
}

function DetalleRuta({ item, tieneDestinoFijo, onElegir, elegida }) {
  const speedLabel = item.profile?.speed === 'rapida' ? 'Rápida' : item.profile?.speed === 'lenta' ? 'Lenta' : 'Media'
  const thrillPct = Math.round((item.profile?.thrill ?? 0.5) * 100)

  return (
    <div className="ctrl-detalle">
      <div className="ctrl-detalle-head">
        <span className="punto" style={{ background: item.toColor }} />
        <div>
          <h4>Ruta {item.name} · {item.profile?.label}</h4>
          <p className="ctrl-detalle-sub">
            {item.theme.emoji} {item.theme.name} → {item.toName} · {speedLabel} · emoción {thrillPct}%
          </p>
        </div>
      </div>

      <div className="ctrl-detalle-bloque">
        <h5>Qué se gana / qué se pierde en el recorrido</h5>
        <ul className="ctrl-detalle-lista">
          <li>
            <span>Puntos estimados del camino</span>
            <span className={item.dP >= 0 ? 'pos' : 'neg'}>{fmt(item.dP)} ⭐</span>
          </li>
          <li>
            <span>Energía consumida</span>
            <span className="neg">{fmt(item.dE)} ⚡</span>
          </li>
          <li>
            <span>Duración y longitud</span>
            <span>~{Math.round(item.duracion)} s · {Math.round(item.length)} u</span>
          </li>
          <li>
            <span>Eventos de cambio</span>
            <span>{item.eventos} estaciones ({item.tramosConEvento} tramos)</span>
          </li>
        </ul>
      </div>

      <div className="ctrl-detalle-bloque">
        <h5>Obstáculos ({item.kinds.length})</h5>
        <div className="ctrl-obstaculos">
          {item.kinds.map((k, i) => (
            <span key={`${k.key}-${i}`} className="ctrl-obs-chip" title={`Riesgo ${Math.round(k.risk * 100)}%`}>
              {k.emoji} {k.name}
            </span>
          ))}
        </div>
      </div>

      <div className={`ctrl-detalle-balance${item.muere ? ' peligro' : ''}`}>
        <strong>
          Llegarías con ~{Math.round(item.llegarE)} ⚡ y ~{Math.round(item.llegarP)} ⭐
        </strong>
        <span>
          Recorrida {item.vecesRecorrida} {item.vecesRecorrida === 1 ? 'vez' : 'veces'} · Compañeras en ella: {item.peers}.
          {!tieneDestinoFijo && ` Elegir esta ruta fija también el planeta ${item.toName}.`}
        </span>
      </div>

      <button type="button" className="ctrl-btn-primario ctrl-btn-elegir" onClick={() => onElegir(item)}>
        {elegida ? `✓ Ruta ${item.name} elegida` : `Elegir Ruta ${item.name} (${item.toName})`}
      </button>
    </div>
  )
}

function DetalleCarril({ item, onElegir, elegida }) {
  const falloPct = Math.round((item.probFallo ?? 0) * 100)
  return (
    <div className="ctrl-detalle">
      <div className="ctrl-detalle-head">
        <div>
          <h4>{item.nombre} ({item.lado})</h4>
          <p className="ctrl-detalle-sub">
            {item.rutaBase
              ? `Calculado sobre ${item.rutaBase.themeName} · Ruta ${item.rutaBase.name} (${item.rutaBase.esElegida ? 'tu ruta' : 'automática'})`
              : 'Carril inicial al entrar al circuito'}
          </p>
        </div>
      </div>

      {item.evento ? (
        <>
          <div className="ctrl-detalle-bloque">
            <h5>Primer evento que encontrará</h5>
            <p className="ctrl-detalle-resumen">
              {item.evento.emoji} <strong>{item.evento.name}</strong> ({item.evento.kind}) en {item.evento.segEmoji} {item.evento.segName}
            </p>
          </div>
          <div className="ctrl-detalle-bloque">
            <h5>Qué se gana / qué se pierde si lo usa</h5>
            <ul className="ctrl-detalle-lista">
              <li>
                <span>Recompensa al completar</span>
                <span>
                  <em className={item.evento.reward.p >= 0 ? 'pos' : 'neg'}>{fmt(item.evento.reward.p)} ⭐</em>{' '}
                  <em className={item.evento.reward.e >= 0 ? 'pos' : 'neg'}>{fmt(item.evento.reward.e)} ⚡</em>
                </span>
              </li>
              <li>
                <span>Probabilidad de fallar</span>
                <span className="neg">{falloPct}%</span>
              </li>
              {item.penalizacion && (
                <li>
                  <span>Si falla el evento</span>
                  <span className="neg">−{item.penalizacion.velPct}% velocidad · −{item.penalizacion.puntos} ⭐</span>
                </li>
              )}
            </ul>
          </div>
        </>
      ) : (
        <div className="ctrl-detalle-bloque">
          <h5>Primer evento</h5>
          <p className="ctrl-detalle-sub">No hay un evento en el camino inicial de este carril en la ruta base.</p>
        </div>
      )}

      <div className="ctrl-detalle-balance">
        <span>Tras el primer evento el carril vuelve a ser al azar; usar el evento lo decide la ballita.</span>
      </div>

      <button type="button" className="ctrl-btn-primario ctrl-btn-elegir" onClick={() => onElegir(item)}>
        {elegida ? `✓ ${item.nombre} elegido` : `Elegir ${item.nombre}`}
      </button>
    </div>
  )
}

export default function Selector({ tipo, mundo, ballita, opciones, onClose }) {
  const origenNombre = mundo.world.nodes[opciones.origen]?.name || 'Planeta'
  const dec = ballita.dec || {}
  const lastPointerType = useRef('mouse')
  const cardRefs = useRef([])
  const gridRef = useRef(null)
  const [mostrarTodasRutas, setMostrarTodasRutas] = useState(false)

  const { items, grupos } = useMemo(() => {
    if (tipo === 'planeta') {
      return { items: opciones.planetas || [], grupos: null }
    }
    if (tipo === 'carril') {
      return { items: opciones.carriles || [], grupos: null }
    }
    const allRutas = opciones.rutas || []
    const filtradas = dec.destino != null && !mostrarTodasRutas
      ? allRutas.filter((r) => r.to === dec.destino)
      : allRutas
    const map = new Map()
    for (const r of filtradas) {
      if (!map.has(r.to)) map.set(r.to, { to: r.to, toName: r.toName, toColor: r.toColor, theme: r.theme, items: [] })
      map.get(r.to).items.push(r)
    }
    const grps = [...map.values()]
    return { items: grps.flatMap((g) => g.items), grupos: grps }
  }, [tipo, opciones, dec.destino, mostrarTodasRutas])

  const initialKey = useMemo(() => {
    const elegida = items.find((it) => isElegida(tipo, it, dec))
    if (elegida) return keyOf(tipo, elegida)
    const auto = items.find((it) => it.esAuto)
    if (auto) return keyOf(tipo, auto)
    return keyOf(tipo, items[0])
  }, [tipo, items, dec])

  const [activaKey, setActivaKey] = useState(initialKey)

  useEffect(() => {
    setActivaKey((prev) => (items.some((it) => keyOf(tipo, it) === prev) ? prev : initialKey))
  }, [items, tipo, initialKey])

  const activa = items.find((it) => keyOf(tipo, it) === activaKey) || items[0] || null

  // Enfocar la primera tarjeta activa al abrir para navegación por teclado inmediata.
  useEffect(() => {
    const idx = items.findIndex((it) => keyOf(tipo, it) === activaKey)
    const el = cardRefs.current[Math.max(0, idx)]
    el?.focus({ preventScroll: true })
  }, [tipo]) // solo al abrir o cambiar tipo

  // Esc cierra el selector con prioridad sobre otros listeners globales (POV).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const confirmar = useCallback(async (item) => {
    if (!item) return
    if (tipo === 'planeta') await mundo.decidir(ballita, { destino: item.idx })
    else if (tipo === 'ruta') await mundo.decidir(ballita, { ruta: { way: item.wayIdx, r: item.r } })
    else await mundo.decidir(ballita, { carril: item.carril })
    onClose()
  }, [tipo, mundo, ballita, onClose])

  const limpiar = async () => {
    if (tipo === 'planeta') await mundo.decidir(ballita, { destino: null })
    else if (tipo === 'ruta') await mundo.decidir(ballita, { ruta: null })
    else await mundo.decidir(ballita, { carril: null })
    onClose()
  }

  const onSelectCard = (item) => {
    const k = keyOf(tipo, item)
    if (lastPointerType.current === 'touch' && activaKey !== k) {
      setActivaKey(k)
      return
    }
    confirmar(item)
  }

  const moveFocus = (idx, dirKey) => {
    if (!items.length) return
    let cols = 1
    const gridEl = gridRef.current
    if (gridEl) {
      const tmpl = getComputedStyle(gridEl).gridTemplateColumns
      if (tmpl) cols = Math.max(1, tmpl.split(' ').filter(Boolean).length)
    }
    let next = idx
    if (dirKey === 'ArrowRight') next = (idx + 1) % items.length
    else if (dirKey === 'ArrowLeft') next = (idx - 1 + items.length) % items.length
    else if (dirKey === 'ArrowDown') next = Math.min(items.length - 1, idx + cols)
    else if (dirKey === 'ArrowUp') next = Math.max(0, idx - cols)
    else if (dirKey === 'Home') next = 0
    else if (dirKey === 'End') next = items.length - 1
    else return

    const item = items[next]
    if (item) {
      setActivaKey(keyOf(tipo, item))
      cardRefs.current[next]?.focus()
    }
  }

  const hayDecision =
    (tipo === 'planeta' && dec.destino != null) ||
    (tipo === 'ruta' && dec.ruta != null) ||
    (tipo === 'carril' && dec.carril != null)

  const titulos = {
    planeta: 'Elegir planeta destino',
    ruta: 'Elegir ruta',
    carril: 'Elegir carril inicial',
  }

  let flatIndex = 0
  const renderCard = (item) => {
    const idx = flatIndex++
    const k = keyOf(tipo, item)
    return (
      <Tarjeta
        key={k}
        tipo={tipo}
        item={item}
        world={mundo.world}
        activa={k === activaKey}
        elegida={isElegida(tipo, item, dec)}
        esAuto={Boolean(item.esAuto)}
        cardRef={(el) => { cardRefs.current[idx] = el }}
        onFocusCard={(it) => setActivaKey(keyOf(tipo, it))}
        onSelectCard={onSelectCard}
        onKeyDown={(e) => {
          if (['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault()
            moveFocus(idx, e.key)
          }
        }}
      />
    )
  }

  return (
    <div
      className="ctrl-modal-fondo"
      onPointerDown={(e) => {
        lastPointerType.current = e.pointerType || 'mouse'
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <section
        className="ctrl-modal"
        role="dialog"
        aria-modal="true"
        aria-label={titulos[tipo]}
      >
        <header className="ctrl-modal-head">
          <div>
            <h3>{titulos[tipo]}</h3>
            <p className="ctrl-modal-sub">
              Para el siguiente viaje desde <strong>{origenNombre}</strong> · usa flechas y Enter, o toca para inspeccionar
            </p>
          </div>
          <div className="ctrl-modal-acciones">
            {tipo === 'ruta' && dec.destino != null && (
              <button
                type="button"
                className="ctrl-btn-sec"
                onClick={() => setMostrarTodasRutas((v) => !v)}
              >
                {mostrarTodasRutas ? `Solo ${mundo.world.nodes[dec.destino]?.name}` : 'Ver otros planetas'}
              </button>
            )}
            {hayDecision && (
              <button type="button" className="ctrl-btn-sec" onClick={limpiar}>
                Volver a Automático
              </button>
            )}
            <button type="button" className="cerrar ctrl-modal-cerrar" onClick={onClose} aria-label="Cerrar selector (Esc)">
              ×
            </button>
          </div>
        </header>

        <div className="ctrl-modal-cuerpo">
          <div className="ctrl-rejilla-wrap" role="listbox" aria-label={titulos[tipo]}>
            {grupos ? (
              grupos.map((g) => (
                <div key={g.to} className="ctrl-grupo-rutas">
                  <div className="ctrl-grupo-tit">
                    <span className="punto" style={{ background: g.toColor }} />
                    <strong>{g.toName}</strong>
                    <span>{g.theme.emoji} {g.theme.name}</span>
                  </div>
                  <div className="ctrl-rejilla" ref={grupos.length === 1 ? gridRef : undefined}>
                    {g.items.map(renderCard)}
                  </div>
                </div>
              ))
            ) : (
              <div className="ctrl-rejilla" ref={gridRef}>
                {items.map(renderCard)}
              </div>
            )}
          </div>

          <aside className="ctrl-detalle-panel" aria-live="polite">
            {activa && tipo === 'planeta' && (
              <DetallePlaneta
                item={activa}
                ballita={ballita}
                elegida={isElegida(tipo, activa, dec)}
                onElegir={confirmar}
              />
            )}
            {activa && tipo === 'ruta' && (
              <DetalleRuta
                item={activa}
                tieneDestinoFijo={dec.destino === activa.to}
                elegida={isElegida(tipo, activa, dec)}
                onElegir={confirmar}
              />
            )}
            {activa && tipo === 'carril' && (
              <DetalleCarril
                item={activa}
                elegida={isElegida(tipo, activa, dec)}
                onElegir={confirmar}
              />
            )}
          </aside>
        </div>
      </section>
    </div>
  )
}
