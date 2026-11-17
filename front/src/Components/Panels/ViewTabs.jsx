import { useEffect, useMemo, useState } from 'react'
import { perfilRuta } from '../World3D/Vistas.jsx'

const VIEWS = ['mapa', 'camino', 'ballita']
const NOMBRE = { mapa: 'Mapa', camino: 'Camino', ballita: 'Ballita' }
const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0)
// Un tramo repite cada mecanismo por carril de origen: uno por tipo, en el orden en que se cruza.
const mecanismos = (seg) => {
  const vistos = new Set()
  return [...seg.switches].sort((a, b) => a.u - b.u).filter((s) => !vistos.has(s.kind) && vistos.add(s.kind))
}

// Botón discreto de vista (esquina; teclas 1/2/3, V, Esc) + ficha contextual (mapa: camino resaltado; camino: recorrido).
export default function ViewTabs({ vista, goVista, sim, way, routeIndex, setRouteIndex, paused, setPaused, caminoSpeed, setCaminoSpeed, seekTo, onFollow, progressRef }) {
  const nodes = sim.world.nodes
  const [plegado, setPlegado] = useState(false)
  const perfil = useMemo(() => perfilRuta(way, routeIndex), [way, routeIndex])
  const { route, segs, total } = perfil
  const events = segs.map((q, i) => ({ q, i })).filter(({ q }) => q.seg.event)
  const prog = progressRef?.current
  const actual = prog ? segs.findIndex((q) => prog.d <= q.start + q.length) : -1
  const ri = way ? routeIndex % way.routes.length : 0
  const jump = (dir) => {
    if (!events.length) return
    const p = progressRef?.current
    const actual = p ? segs.findIndex((q) => p.d <= q.start + q.length) : -1
    const next = dir > 0 ? events.find((e) => e.i > actual) ?? events[0] : [...events].reverse().find((e) => e.i < actual) ?? events.at(-1)
    seekTo(next.i)
  }
  useEffect(() => {
    if (vista !== 'camino') return undefined
    const onKey = (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      const t = e.target
      if (t?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName)) return
      e.preventDefault()
      jump(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })
  const enVivo = way ? sim.ballitas.filter((b) => b.phase === 'travel' && b.way === way) : []
  const posBallita = (b) => {
    const k = segs.findIndex((q) => q.seg === b.seg)
    return k < 0 ? null : pct(segs[k].start + b.segT * segs[k].length, total)
  }

  return <>
    <div className="vista-esquina">
      {vista === 'ballita' && <button type="button" aria-label="Recentrar cámara (R)" title="Recentrar cámara (R)" onClick={() => window.dispatchEvent(new Event('ballitas:recentrar'))}>⟲</button>}
      <button type="button" aria-label={`Cambiar vista (ahora: ${NOMBRE[vista]})`} title={`Vista: ${NOMBRE[vista]} · 1/2/3, V, Esc`}
        onClick={() => goVista(VIEWS[(VIEWS.indexOf(vista) + 1) % VIEWS.length])}>👁</button>
    </div>
    {vista === 'mapa' && way && <div className="vista-toast">
      <strong>{way.theme.emoji} {way.theme.name}</strong><span>{nodes[way.from].name} → {nodes[way.to].name}</span>
      <button onClick={() => goVista('camino')}>Entrar al camino</button>
    </div>}
    {vista === 'camino' && way && <aside className={`camino-panel${plegado ? ' plegado' : ''}`} aria-label="Recorrido del camino">
      <header>
        <button className="plegar" aria-expanded={!plegado} title={plegado ? 'Desplegar' : 'Plegar'} onClick={() => setPlegado(!plegado)}>{plegado ? '▸' : '▾'}</button>
        <strong>{way.theme.emoji} {way.theme.name}{prog ? ` · ${pct(prog.d, total)}%` : ''}</strong>
        <button onClick={() => goVista('mapa')} aria-label="Salir del camino">×</button>
      </header>
      {!plegado && <>
      <small>{nodes[way.from].name} → {nodes[way.to].name}</small>
      <div className="ruta-tabs">{way.routes.map((r, i) => <button key={r.idx} aria-pressed={i === ri} onClick={() => setRouteIndex(i)}>Ruta {r.name}</button>)}</div>
      {route && <>
        <p>{route.profile.label} · {route.profile.speed} · {route.length.toFixed(0)} u</p>
        <div className="camino-controls">
          <button onClick={() => setPaused(!paused)}>{paused ? '▶ Reanudar' : 'Ⅱ Pausar'}</button>
          <label>Velocidad <input type="range" min="0.01" max="0.3" step="0.005" value={caminoSpeed} onChange={(e) => setCaminoSpeed(Number(e.target.value))} /></label>
        </div>
        <div className="evento-nav">
          <button disabled={!events.length} onClick={() => jump(-1)}>← Evento</button>
          <span>{events.length ? `${events.length} evento${events.length > 1 ? 's' : ''}` : 'Sin eventos'}</span>
          <button disabled={!events.length} onClick={() => jump(1)}>Evento →</button>
        </div>
        <h3>Tramos y eventos</h3>
        <ol className="tramos">{segs.map((q, i) => <li key={q.seg.idx} className={i === actual ? 'actual' : ''} onClick={() => seekTo(i)}>
          <span>{i + 1}. {q.seg.emoji} {q.seg.name}{q.seg.event ? ' ⚡' : ''}
            {q.seg.switches?.length > 0 && <small> · {mecanismos(q.seg).map((s) => `${s.emoji} ${s.name} ${pct(q.start + s.u * q.length, total)}%`).join(' · ')}</small>}
          </span>
          <small>{pct(q.start, total)}%</small>
        </li>)}</ol>
        <h3>Ballitas en este camino</h3>
        <div className="ballitas-camino">{enVivo.length ? enVivo.map((b) => <button key={b.id} onClick={() => onFollow(b)}>{b.name}{b.route ? ` · ${b.route.name}` : ''}{posBallita(b) != null ? ` · ${posBallita(b)}%` : ''}</button>) : <small>Nadie por aquí ahora.</small>}</div>
      </>}
      </>}
    </aside>}
  </>
}
