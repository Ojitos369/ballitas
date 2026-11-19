import { useMemo, useState } from 'react'

// Panel minimizable: recuerda la elección por panel; en pantallas chicas arranca minimizado.
export function usePanelMin(key) {
  const [min, setMin] = useState(() => {
    try {
      const v = localStorage.getItem(`ballitas:min:${key}`)
      if (v != null) return v === '1'
    } catch {}
    return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 700px)').matches
  })
  const toggle = () => setMin((m) => {
    try { localStorage.setItem(`ballitas:min:${key}`, m ? '0' : '1') } catch {}
    return !m
  })
  return [min, toggle]
}
import { colorDe } from './Hud.jsx'
import { generateSkin, PATTERN_LABEL } from '../World3D/skins.js'
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
  const { parts, palette, hatColor, ribbonColor, pupilColor, baseColor } = skin
  const hatId = parts?.hat?.id ?? skin.id
  const earId = parts?.ears?.id ?? 'none'
  const eyeId = parts?.eyes?.id ?? skin.eyeStyle ?? 'round'
  const bodyFill = baseColor ?? bodyCss
  const earFill = parts?.ears?.color ?? bodyFill
  const earIn = parts?.ears?.innerColor ?? '#f9a8d4'
  const irisFill = palette?.irisBot ?? pupilColor

  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" style={{ flexShrink: 0 }}>
      {earId === 'cat' && <>
        <polygon points="6,14 9,4 14,11" fill={earFill} />
        <polygon points="26,14 23,4 18,11" fill={earFill} />
        <polygon points="8,12 9.5,6.5 12.5,10.5" fill={earIn} />
        <polygon points="24,12 22.5,6.5 19.5,10.5" fill={earIn} />
      </>}
      {earId === 'elf' && <>
        <polygon points="1,16 9,12 9,19" fill={earFill} />
        <polygon points="31,16 23,12 23,19" fill={earFill} />
      </>}
      {earId === 'bunny' && <>
        <ellipse cx="10" cy="8" rx="2.6" ry="6.5" transform="rotate(-14 10 8)" fill={earFill} />
        <ellipse cx="22" cy="8" rx="2.6" ry="6.5" transform="rotate(14 22 8)" fill={earFill} />
      </>}
      {earId === 'bear' && <>
        <circle cx="8" cy="10" r="3.4" fill={earFill} />
        <circle cx="24" cy="10" r="3.4" fill={earFill} />
      </>}
      {earId === 'droopy' && <>
        <ellipse cx="6.5" cy="18" rx="2.4" ry="5.5" transform="rotate(18 6.5 18)" fill={earFill} />
        <ellipse cx="25.5" cy="18" rx="2.4" ry="5.5" transform="rotate(-18 25.5 18)" fill={earFill} />
      </>}
      {earId === 'horns' && <>
        <path d="M9,11 Q7,5 10,4 Q11,7 12,10 Z" fill="#e2c799" />
        <path d="M23,11 Q25,5 22,4 Q21,7 20,10 Z" fill="#e2c799" />
      </>}
      {earId === 'antennae' && <>
        <line x1="12" y1="9" x2="10" y2="3" stroke="#f4c542" strokeWidth="1.4" />
        <line x1="20" y1="9" x2="22" y2="3" stroke="#f4c542" strokeWidth="1.4" />
        <circle cx="10" cy="3" r="1.8" fill="#f4c542" />
        <circle cx="22" cy="3" r="1.8" fill="#f4c542" />
      </>}

      <circle cx="16" cy="18" r="10" fill={bodyFill} />

      {hatId === 'wizard' && <>
        <ellipse cx="16" cy="10.5" rx="11.5" ry="2.4" fill={hatColor} />
        <path d="M9,10.5 Q15,1 22,4 Q19,7 22,10.5 Z" fill={hatColor} />
        <circle cx="16" cy="7.5" r="1.6" fill="#f4c542" />
      </>}
      {hatId === 'conical_elf' && <>
        <path d="M8,12 Q14,2 24,5 Q20,8 23,12 Z" fill={hatColor} />
        <rect x="8.5" y="10" width="15" height="2.4" rx="1" fill="#f4e8cc" />
        <circle cx="24" cy="5.5" r="2" fill="#f4e8cc" />
      </>}
      {hatId === 'bandana' && <path d="M7,15 A9,9 0 0,1 25,15 Z" fill="#b8333a" />}
      {hatId === 'halo' && <ellipse cx="16" cy="4.5" rx="6.8" ry="1.8" fill="none" stroke="#fde047" strokeWidth="1.8" />}
      {hatId === 'beret' && <ellipse cx="16" cy="9" rx="9" ry="3.2" fill={hatColor} />}
      {hatId === 'hood' && <path d="M6,20 A10.5,10.5 0 0,1 26,20" fill="none" stroke={hatColor} strokeWidth="2.8" />}
      {hatId === 'nightcap' && <>
        <path d="M8,11 Q16,2 25,8 L23,12 Z" fill={hatColor} />
        <circle cx="25" cy="8.5" r="1.8" fill="#f4e8cc" />
      </>}
      {hatId === 'crown' && <polygon points="10,10 11,4 14,7 16,3 18,7 21,4 22,10" fill="#f4c542" />}
      {hatId === 'flower_crown' && <>
        <circle cx="19" cy="8" r="2.6" fill={ribbonColor} />
        <circle cx="19" cy="8" r="1" fill="#f4c542" />
      </>}
      {hatId === 'bow' && <>
        <ellipse cx="18" cy="8.5" rx="3" ry="1.8" fill={ribbonColor} />
        <ellipse cx="22.5" cy="8.5" rx="3" ry="1.8" fill={ribbonColor} />
      </>}
      {hatId === 'brain' && <>
        <circle cx="21" cy="10" r="3" fill="#f48fb1" />
        <circle cx="23.5" cy="12" r="2.2" fill="#f48fb1" />
      </>}

      {eyeId === 'zen' ? <>
        <path d="M10.5,17 Q12.5,19 14.5,17" fill="none" stroke="#2c1328" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M17.5,17 Q19.5,19 21.5,17" fill="none" stroke="#2c1328" strokeWidth="1.4" strokeLinecap="round" />
      </> : eyeId === 'cyclops' ? <>
        <circle cx="16" cy="17" r="3.4" fill="#fff" />
        <circle cx="16" cy="17" r="2" fill={irisFill} />
        <circle cx="16" cy="17" r="1" fill="#1a1026" />
      </> : <>
        <circle cx="12.2" cy="17.5" r="2.5" fill="#fff" />
        <circle cx="12.2" cy="17.5" r="1.6" fill={irisFill} />
        <circle cx="12.2" cy="17.5" r="0.8" fill="#1a1026" />
        {eyeId === 'asym' ? (
          <path d="M18,16 L21.5,19 M21.5,16 L18,19" stroke="#2c1328" strokeWidth="1.4" strokeLinecap="round" />
        ) : <>
          <circle cx="19.8" cy="17.5" r="2.5" fill="#fff" />
          <circle cx="19.8" cy="17.5" r="1.6" fill={irisFill} />
          <circle cx="19.8" cy="17.5" r="0.8" fill="#1a1026" />
        </>}
      </>}

      {skin.hasPatch && <circle cx={skin.patchSide < 0 ? 12.2 : 19.8} cy="17.5" r="2.8" fill="#1f1a2c" />}
      {skin.hasGlasses && <>
        <circle cx="12.2" cy="17.5" r="3" fill="none" stroke="#f4c542" strokeWidth="0.9" />
        <circle cx="19.8" cy="17.5" r="3" fill="none" stroke="#f4c542" strokeWidth="0.9" />
      </>}
      {skin.hasVisor && <rect x="9" y="15.5" width="14" height="3.6" rx="1.6" fill="#38bdf8" opacity="0.85" />}
    </svg>
  )
}

const signo = (n) => (n > 0 ? '+' : '−') + Math.abs(n)
const efecto = (d) => (d ? (d.kind === 'puntos' ? `⭐${signo(d.dp)}` : `⚡${signo(d.de)}`) : '')

// Estado en una línea para la tarjeta compacta: «En Eco → Spa ⭐+3».
function estadoCorto(b, sim, lugar) {
  try {
    const n = sim.world.nodes
    const aqui = n[b.node]?.name
    if (b.phase === 'toDest' && b.dest) return `En ${aqui} → ${b.dest.name} ${efecto(b.dest)}`
    if (b.phase === 'at' && b.dest) return `En ${aqui} · ${b.dest.name} ${efecto(b.dest)}`
    if (b.phase === 'toPort' && b.way) return `En ${aqui} → puerto de ${n[b.way.to].name}`
    if (b.phase === 'travel' && b.way) return `${n[b.way.from].name} → ${n[b.way.to].name} · ${b.way.theme?.emoji ?? ''} ${b.way.theme?.name ?? ''}`.trim()
  } catch {}
  return lugar
}

export default function Detail({ b, sim, follow, pov, onFollow, onPov, onClose }) {
  const ida = b.phase === 'gone' || b.phase === 'dying'
  const lugar = ida ? '' : donde(b, sim)
  const idea = obtenerGlobo(b, sim) ?? b.thought ?? b.log?.[0]
  const fav = gustos(b, sim)
  const skin = useMemo(() => generateSkin(b.genome, b.arch), [b.genome, b.arch])
  const bodyCss = colorDe(b)
  const [min, toggleMin] = usePanelMin('ficha')
  // Siguiendo (Seguir o POV) la ficha es compacta: fila de cabecera + barras + estado; el resto, en «más».
  const compacto = (follow || pov) && !ida

  const perfil = (
    <>
      <p className="sub">{b.arch?.title} · {b.mood} · gen {b.gen} · {Math.round(b.age)}s</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 4px' }}>
        <SkinThumb skin={skin} bodyCss={bodyCss} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.25 }}>
            {skin.emoji} {skin.name}
          </div>
          <div className="sub" style={{ margin: 0 }}>{PATTERN_LABEL[skin.patternType]}</div>
        </div>
      </div>
      {skin.partsSummary?.length > 0 && (
        <div className="chips" aria-label="Piezas del skin">
          {skin.partsSummary.map((label) => <span key={label}>{label}</span>)}
        </div>
      )}
    </>
  )
  const extra = (
    <>
      <h3>Personalidad</h3>
      {TRAITS.map(([k, l]) => <Barra key={k} label={l} v={b.genome.traits[k] ?? 0} color="#8aa7ff" />)}
      {fav.length > 0 && <><h3>Le gusta</h3>{fav.map((t, i) => <p key={`${i}-${t}`} className="linea">{t}</p>)}</>}
      <h3>Pensamientos</h3>
      <ul className="diario">{(b.log ?? []).slice(0, 8).map((l, i) => <li key={i}><em>{l.t}s</em> {l.emoji} {l.text}</li>)}</ul>
    </>
  )

  if (compacto) {
    return (
      <aside className={`tarjeta compacta${min ? ' min' : ''}`} aria-label={`Detalles de ${b.name}`}>
        <div className="cabecera">
          <span className="punto" style={{ background: bodyCss }} />
          <h2>{b.name}</h2>
          <button className="seguir" aria-pressed={follow} onClick={onFollow}>{follow ? '↩ Salir' : '👁 Seguir'}</button>
          <button className="seguir pov-btn" aria-pressed={pov} onClick={onPov} title="Punto de vista frontal (Esc para salir)">{pov ? '↩ POV' : '🎥 POV'}</button>
          <button className="cerrar" onClick={toggleMin} aria-expanded={!min} aria-label={min ? 'Mostrar ficha' : 'Minimizar ficha'} title={min ? 'Mostrar ficha' : 'Minimizar ficha'}>{min ? '▴' : '▾'}</button>
          <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
        </div>
        <div className="barras-fila">
          <Barra label={`⭐ ${Math.round(b.p)}`} v={b.p / 100} color="#ffd54a" />
          <Barra label={`⚡ ${Math.round(b.e)}`} v={b.e / 100} color="#5dffb0" />
        </div>
        {lugar && <p className="linea estado" title={lugar}>📍 {estadoCorto(b, sim, lugar)}</p>}
        <details>
          <summary>más</summary>
          {perfil}
          {lugar && <p className="linea">📍 {lugar}</p>}
          {idea && <p className="linea">{idea.emoji ?? '💭'} {idea.text}</p>}
          {extra}
        </details>
      </aside>
    )
  }

  return (
    <aside className={`tarjeta${min ? ' min' : ''}`} aria-label={`Detalles de ${b.name}`}>
      <div className="cabecera">
        <span className="punto" style={{ background: bodyCss }} />
        <h2>{b.name}</h2>
        {!ida && <>
          <button className="seguir" aria-pressed={follow} onClick={onFollow}>{follow ? '↩ Salir' : '👁 Seguir'}</button>
          <button className="seguir pov-btn" aria-pressed={pov} onClick={onPov} title="Punto de vista frontal (Esc para salir)">{pov ? '↩ POV' : '🎥 POV'}</button>
        </>}
        <button className="cerrar" onClick={toggleMin} aria-expanded={!min} aria-label={min ? 'Mostrar ficha' : 'Minimizar ficha'} title={min ? 'Mostrar ficha' : 'Minimizar ficha'}>{min ? '▴' : '▾'}</button>
        <button className="cerrar" onClick={onClose} aria-label="Cerrar">×</button>
      </div>
      <p className="sub">{b.arch?.title} · {b.mood} · gen {b.gen} · {Math.round(b.age)}s</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '4px 0 4px' }}>
        <SkinThumb skin={skin} bodyCss={bodyCss} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg)', lineHeight: 1.25 }}>
            {skin.emoji} {skin.name}
          </div>
          <div className="sub" style={{ margin: 0 }}>{PATTERN_LABEL[skin.patternType]}</div>
        </div>
      </div>
      {skin.partsSummary?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '2px 0 7px' }} aria-label="Piezas del skin">
          {skin.partsSummary.map((label) => (
            <span
              key={label}
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid var(--line)',
                color: 'var(--dim)',
              }}
            >
              {label}
            </span>
          ))}
        </div>
      )}
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
