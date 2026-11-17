import { useMemo } from 'react'
import { colorDe } from './Hud.jsx'
import { buildSkin, PATTERN_LABEL } from '../World3D/skins.js'
import { obtenerGlobo } from '../../Core/dialogos.js'

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

export function SkinThumb({ skin, bodyCss, size = 32 }) {
  const { id, hatColor, ribbonColor, pupilColor } = skin
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}>
      {id === 'gatita' && <>
        <polygon points="6,13 9,3 14,10" fill={bodyCss} />
        <polygon points="26,13 23,3 18,10" fill={bodyCss} />
      </>}
      {id === 'elfa' && <>
        <polygon points="2,16 9,12 9,19" fill={bodyCss} />
        <polygon points="30,16 23,12 23,19" fill={bodyCss} />
      </>}
      {id === 'miedosa' && <>
        <ellipse cx="9" cy="11" rx="3" ry="7" transform="rotate(-25 9 11)" fill={hatColor} />
        <ellipse cx="23" cy="11" rx="3" ry="7" transform="rotate(25 23 11)" fill={hatColor} />
      </>}
      <circle cx="16" cy="18" r="10" fill={bodyCss} />
      {id === 'maga' && <>
        <ellipse cx="16" cy="10" rx="11" ry="2.2" fill={hatColor} />
        <polygon points="10,10 17,1 22,10" fill={hatColor} />
        <rect x="11.5" y="8" width="9" height="2" fill={ribbonColor} />
      </>}
      {id === 'elfa' && <polygon points="10,11 17,2 22,11" fill={hatColor} />}
      {id === 'pirata' && <path d="M7,15 A9,9 0 0,1 25,15 Z" fill={hatColor} />}
      {id === 'ascetica' && <ellipse cx="16" cy="4" rx="7" ry="2" fill="none" stroke="#fde047" strokeWidth="1.8" />}
      {id === 'rutinaria' && <ellipse cx="16" cy="9" rx="9" ry="3.2" fill={hatColor} />}
      {id === 'alegre' && <>
        <line x1="12" y1="9" x2="10" y2="3" stroke={ribbonColor} strokeWidth="1.5" />
        <line x1="20" y1="9" x2="22" y2="3" stroke={ribbonColor} strokeWidth="1.5" />
        <circle cx="10" cy="3" r="2" fill={hatColor} />
        <circle cx="22" cy="3" r="2" fill={hatColor} />
      </>}
      {id === 'solitaria' && <rect x="9" y="10" width="14" height="3.2" rx="1.5" fill="#38bdf8" />}
      <circle cx="12.5" cy="17" r="2.2" fill="#fff" />
      <circle cx="19.5" cy="17" r="2.2" fill="#fff" />
      <circle cx="12.5" cy="17" r="1.1" fill={pupilColor} />
      <circle cx="19.5" cy="17" r="1.1" fill={pupilColor} />
      {id === 'pirata' && <circle cx={skin.patchSide < 0 ? 12.5 : 19.5} cy="17" r="2.6" fill="#1f1a2c" />}
    </svg>
  )
}

export default function Detail({ b, sim, follow, pov, onFollow, onPov, onClose }) {
  const ida = b.phase === 'gone' || b.phase === 'dying'
  const lugar = ida ? '' : donde(b, sim)
  const idea = obtenerGlobo(b, sim) ?? b.thought ?? b.log?.[0]
  const fav = gustos(b, sim)
  const skin = useMemo(() => buildSkin(b.genome, b.arch), [b.genome, b.arch])
  const bodyCss = colorDe(b)
  return (
    <aside className="tarjeta" aria-label={`Detalles de ${b.name}`}>
      <div className="cabecera">
        <span className="punto" style={{ background: bodyCss }} />
        <h2>{b.name}</h2>
        {!ida && <>
          <button className="seguir" aria-pressed={follow} onClick={onFollow}>{follow ? '↩ Salir' : '👁 Seguir'}</button>
          <button className="seguir pov-btn" aria-pressed={pov} onClick={onPov} title="Punto de vista frontal (Esc para salir)">{pov ? '↩ POV' : '🎥 POV'}</button>
        </>}
        <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <p className="sub">{b.arch?.title} · {b.mood} · gen {b.gen} · {Math.round(b.age)}s</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 6px' }}>
        <SkinThumb skin={skin} bodyCss={bodyCss} />
        <span className="sub" style={{ margin: 0 }}>{skin.family.emoji} {skin.family.name} · {PATTERN_LABEL[skin.patternType]}</span>
      </div>
      {ida && <p className="aviso">{b.cause ? `Murió por falta de ${b.cause}.` : 'Ya no está.'}</p>}
      <Barra label={`⭐ ${Math.round(b.p)}`} v={b.p / 100} color="#ffd54a" />
      <Barra label={`⚡ ${Math.round(b.e)}`} v={b.e / 100} color="#5dffb0" />
      {lugar && <p className="linea">📍 {lugar}</p>}
      {idea && <p className="linea">{idea.emoji ?? '💭'} {idea.text}</p>}
      <details>
        <summary>más</summary>
        <h3>Personalidad</h3>
        {TRAITS.map(([k, l]) => <Barra key={k} label={l} v={b.genome.traits[k] ?? 0} color="#8aa7ff" />)}
        {fav.length > 0 && <><h3>Le gusta</h3>{fav.map((t, i) => <p key={`${i}-${t}`} className="linea">{t}</p>)}</>}
        <h3>Pensamientos</h3>
        <ul className="diario">{(b.log ?? []).slice(0, 8).map((l, i) => <li key={i}><em>{l.t}s</em> {l.emoji} {l.text}</li>)}</ul>
      </details>
    </aside>
  )
}
