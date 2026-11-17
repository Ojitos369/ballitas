const VIEWS = [
  ['mapa', 'Mapa', '1'],
  ['camino', 'Camino', '2'],
  ['externa', 'Bollita · externa', '3'],
  ['interna', 'Bollita · interna', 'V'],
]

export default function ViewTabs({ vista, setVista, sim, focusWay, setFocusWay, routeIndex, setRouteIndex, selected, paused, setPaused, caminoSpeed, setCaminoSpeed, seekTo, onFollow }) {
  const way = focusWay == null ? null : sim.world.ways[focusWay]
  const route = way?.routes?.[routeIndex % (way.routes.length || 1)]
  const events = route?.segments?.map((s, i) => ({ s, i })).filter(({ s }) => s.event) ?? []
  const [eventCursor, setEventCursor] = useState(0)
  useEffect(() => setEventCursor(0), [route])
  const jumpEvent = (delta) => {
    if (!events.length) return
    const next = (eventCursor + delta + events.length) % events.length
    setEventCursor(next)
    seekTo(events[next].i)
  }
  const cameraView = vista === 'externa' || vista === 'interna'
  return <>
    <nav className="vistas-tabs" aria-label="Vistas del mundo" role="tablist">
      {VIEWS.map(([id, label, key]) => <button key={id} role="tab" aria-selected={vista === id} className={vista === id ? 'activa' : ''}
        onClick={() => { if (id === 'camino' && !way && selected?.way) { setFocusWay(selected.way.idx); const ri = selected.way.routes.findIndex((r) => r === selected.route); setRouteIndex(Math.max(0, ri)) } setVista(id) }}>
        {label}<kbd>{key}</kbd>
      </button>)}
    </nav>
    {vista === 'mapa' && focusWay != null && way && <div className="vista-toast">
      <strong>{way.theme.emoji} {way.theme.name}</strong><span>{sim.world.nodes[way.from].name} → {sim.world.nodes[way.to].name}</span>
      <button onClick={() => setVista('camino')}>Entrar al camino</button>
    </div>}
    {vista === 'camino' && way && <aside className="camino-panel">
      <header><small>RECORRIDO · {sim.world.nodes[way.from].name} → {sim.world.nodes[way.to].name}</small><button onClick={() => setVista('mapa')}>Salir ×</button></header>
      <h2>{way.theme.emoji} {way.theme.name}</h2>
      <div className="ruta-tabs">{way.routes.map((r, i) => <button key={r.idx} aria-pressed={i === routeIndex} onClick={() => setRouteIndex(i)}>Ruta {r.name}</button>)}</div>
      {route && <><p>{route.profile.label} · {route.profile.speed} · {route.length.toFixed(0)} u</p>
        <div className="camino-controls"><button onClick={() => setPaused(!paused)}>{paused ? '▶ Reanudar' : 'Ⅱ Pausar'}</button><label>Velocidad <input type="range" min="0.03" max="0.6" step="0.01" value={caminoSpeed} onChange={(e) => setCaminoSpeed(Number(e.target.value))} /></label></div>
        <div className="evento-nav"><button disabled={!events.length} onClick={() => jumpEvent(-1)}>← Evento</button><span>{events.length ? `${eventCursor + 1}/${events.length} · ${events[eventCursor]?.s.name}` : 'Sin eventos'}</span><button disabled={!events.length} onClick={() => jumpEvent(1)}>Evento →</button></div>
        <h3>Tramos y eventos</h3><ol className="tramos">{route.segments.map((s, i) => <li key={s.i} onClick={() => seekTo(i)}><span>{i + 1}. {s.emoji} {s.name}</span><small>{route.length ? Math.round(route.segments.slice(0, i + 1).reduce((n, q) => n + q.length, 0) / route.length * 100) : 0}%</small></li>)}</ol>
        <h3>Bollitas en este camino</h3><div className="bollitas-camino">{sim.bollitas.filter((b) => b.phase === 'travel' && b.way?.idx === way.idx).map((b) => <button key={b.id} onClick={() => onFollow(b)}>{b.name} · {b.route?.name ?? '—'}</button>)}</div>
      </>}
    </aside>}
    {cameraView && selected && <div className="vista-toast vista-bollita"><strong>{selected.name}</strong><span>{vista === 'interna' ? 'Punto de vista interno' : 'Seguimiento externo'} · V cambia vista · Esc mapa</span></div>}
    {vista === 'camino' && !way && <div className="vista-toast"><span>Elige un camino en el mapa o selecciona una bollita en ruta.</span><button onClick={() => setVista('mapa')}>Volver al mapa</button></div>}
  </>
}
import { useEffect, useState } from 'react'

