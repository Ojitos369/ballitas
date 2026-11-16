import { colorDe } from './Hud.jsx'

const TRAITS = [['valentia', 'Valentía'], ['curiosidad', 'Curiosidad'], ['apetito', 'Apetito'], ['sociabilidad', 'Sociabilidad'], ['animo', 'Ánimo'], ['velocidad', 'Rapidez']]

// Si falta cualquier campo no muestran nada.
function donde(b, sim) {
  try { return sim.where(b) } catch { return '' }
}

function gustos(b, sim) {
  try {
    const n = sim.world.nodes
    const { destino: d, way: w, route: r, kind: k } = sim.favorites(b)
    return [
      d && `${d.kind === 'puntos' ? '⭐' : '⚡'} ${d.name} (${n[d.node].name})`,
      w && `${w.theme?.emoji ?? ''} ${w.theme?.name ?? ''} (${n[w.from].name} → ${n[w.to].name})${r ? `, ruta ${r.name}` : ''}`.trim(),
      k && `${k.emoji ?? ''} ${k.name}`.trim(),
    ].filter(Boolean)
  } catch { return [] }
}

const Barra = ({ label, v, color }) => (
  <div className="medida">
    <span>{label}</span>
    <i><b style={{ width: `${Math.max(0, Math.min(100, v * 100))}%`, background: color }} /></i>
  </div>
)

export default function Detail({ b, sim, follow, onFollow, onClose }) {
  const ida = b.phase === 'gone' || b.phase === 'dying'
  const lugar = ida ? '' : donde(b, sim)
  const idea = b.thought ?? b.log?.[0]
  const fav = gustos(b, sim)
  return (
    <aside className="tarjeta" aria-label={`Detalles de ${b.name}`}>
      <div className="cabecera">
        <span className="punto" style={{ background: colorDe(b) }} />
        <h2>{b.name}</h2>
        {!ida && <button className="seguir" aria-pressed={follow} onClick={onFollow}>{follow ? '↩ Salir' : '👁 Seguir'}</button>}
        <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <p className="sub">{b.arch?.title} · {b.mood} · gen {b.gen} · {Math.round(b.age)}s</p>
      {ida && <p className="aviso">{b.cause ? `Murió por falta de ${b.cause}.` : 'Ya no está.'}</p>}
      <Barra label={`⭐ ${Math.round(b.p)}`} v={b.p / 100} color="#ffd54a" />
      <Barra label={`⚡ ${Math.round(b.e)}`} v={b.e / 100} color="#5dffb0" />
      {lugar && <p className="linea">📍 {lugar}</p>}
      {idea && <p className="linea">{idea.emoji ?? '💭'} {idea.text}</p>}
      <details>
        <summary>más</summary>
        <h3>Personalidad</h3>
        {TRAITS.map(([k, l]) => <Barra key={k} label={l} v={b.genome.traits[k] ?? 0} color="#8aa7ff" />)}
        {fav.length > 0 && <><h3>Le gusta</h3>{fav.map((t) => <p key={t} className="linea">{t}</p>)}</>}
        <h3>Pensamientos</h3>
        <ul className="diario">{(b.log ?? []).slice(0, 8).map((l, i) => <li key={i}><em>{l.t}s</em> {l.emoji} {l.text}</li>)}</ul>
      </details>
    </aside>
  )
}
