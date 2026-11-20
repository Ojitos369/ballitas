import { useMemo } from 'react'
import { datosVistaCarril, previewPlaneta, previewRuta } from './previas.js'

const fmt = (n) => {
  const v = Math.round(n)
  return v > 0 ? `+${v}` : v < 0 ? `−${Math.abs(v)}` : '0'
}

function PreviaPlaneta({ item, world }) {
  const node = world?.nodes?.[item.idx]
  const src = useMemo(() => previewPlaneta(node || { idx: item.idx, color: item.color, destinos: item.destinos }, item.theme), [node, item])
  if (src) return <img className="ctrl-previa-img" src={src} alt="" width={132} height={76} />
  return (
    <div className="ctrl-previa-fallback" aria-hidden="true">
      <span className="ctrl-esfera-css" style={{ background: item.color }} />
    </div>
  )
}

function PreviaRuta({ item, world }) {
  const way = world?.ways?.[item.wayIdx]
  const route = way?.routes?.[item.r]
  const svg = useMemo(() => previewRuta(route, way, world), [route, way, world])
  if (!svg) {
    return (
      <div className="ctrl-previa-fallback" aria-hidden="true">
        <span>{item.theme?.emoji} Ruta {item.name}</span>
      </div>
    )
  }
  return (
    <svg className="ctrl-previa-svg" viewBox={`0 0 ${svg.width} ${svg.height}`} aria-hidden="true">
      <path d={svg.d} fill="none" stroke={svg.color} strokeOpacity="0.24" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={svg.d} fill="none" stroke={svg.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={svg.start[0]} cy={svg.start[1]} r="3.2" fill="#eef0ff" />
      <circle cx={svg.end[0]} cy={svg.end[1]} r="3.6" fill={svg.color} stroke="#05060f" strokeWidth="1.2" />
    </svg>
  )
}

function PreviaCarril({ item }) {
  const { total, elegido } = datosVistaCarril(item.carril)
  const W = 132
  const H = 54
  const pad = 12
  const laneW = (W - pad * 2) / total
  const cx = pad + (elegido + 0.5) * laneW
  return (
    <svg className="ctrl-previa-svg" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <rect x={pad - 3} y="10" width={W - pad * 2 + 6} height="34" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      {Array.from({ length: total }, (_, i) => {
        const x = pad + i * laneW
        const on = i === elegido
        return (
          <g key={i}>
            <rect
              x={x + 1}
              y="12"
              width={laneW - 2}
              height="30"
              rx="3"
              fill={on ? 'rgba(138, 167, 255, 0.35)' : 'rgba(255, 255, 255, 0.03)'}
              stroke={on ? '#8aa7ff' : 'transparent'}
              strokeWidth="1.2"
            />
            {i > 0 && <line x1={x} y1="13" x2={x} y2="41" stroke="rgba(255,255,255,0.16)" strokeDasharray="3 3" />}
          </g>
        )
      })}
      <circle cx={cx} cy="27" r="5.5" fill="#8aa7ff" stroke="#eef0ff" strokeWidth="1.4" />
      {item.evento && (
        <text x={cx} y="13" textAnchor="middle" fontSize="11">{item.evento.emoji}</text>
      )}
    </svg>
  )
}

export default function Tarjeta({
  tipo,
  item,
  world,
  activa,
  elegida,
  esAuto,
  cardRef,
  onFocusCard,
  onSelectCard,
  onKeyDown,
}) {
  return (
    <button
      ref={cardRef}
      type="button"
      role="option"
      aria-selected={elegida}
      data-activa={activa ? 'true' : 'false'}
      className={`ctrl-tarjeta${activa ? ' activa' : ''}${elegida ? ' elegida' : ''}${item.muere ? ' peligro' : ''}`}
      onMouseEnter={() => onFocusCard(item)}
      onFocus={() => onFocusCard(item)}
      onClick={(e) => onSelectCard(item, e)}
      onKeyDown={onKeyDown}
    >
      <div className="ctrl-tarjeta-badges">
        {elegida && <span className="ctrl-chip on">Elegida</span>}
        {!elegida && esAuto && <span className="ctrl-chip auto">Auto</span>}
        {item.muere && <span className="ctrl-chip warn">⚠ Riesgo</span>}
      </div>

      <div className="ctrl-tarjeta-previa">
        {tipo === 'planeta' && <PreviaPlaneta item={item} world={world} />}
        {tipo === 'ruta' && <PreviaRuta item={item} world={world} />}
        {tipo === 'carril' && <PreviaCarril item={item} />}
      </div>

      {tipo === 'planeta' && (
        <div className="ctrl-tarjeta-body">
          <div className="ctrl-tarjeta-tit">
            <span className="punto" style={{ background: item.color }} />
            <strong>{item.name}</strong>
          </div>
          <div className="ctrl-tarjeta-sub">{item.theme.emoji} {item.theme.name}</div>
          <div className="ctrl-tarjeta-ef">
            <span className="pos">+{item.maxDp}⭐ / +{item.maxDe}⚡</span>
            <span className="cost">Viaje {fmt(item.mejorRuta?.dP ?? 0)}⭐ {fmt(item.mejorRuta?.dE ?? 0)}⚡</span>
          </div>
        </div>
      )}

      {tipo === 'ruta' && (
        <div className="ctrl-tarjeta-body">
          <div className="ctrl-tarjeta-tit">
            <strong>Ruta {item.name}</strong>
            <span className="ctrl-tarjeta-tag">{item.profile?.label}</span>
          </div>
          <div className="ctrl-tarjeta-sub">{item.theme.emoji} → {item.toName}</div>
          <div className="ctrl-tarjeta-ef">
            <span className={item.dP >= 0 ? 'pos' : 'neg'}>{fmt(item.dP)}⭐</span>
            <span className="neg">{fmt(item.dE)}⚡</span>
            <span>~{Math.round(item.duracion)}s</span>
          </div>
          <div className="ctrl-tarjeta-emojis" aria-hidden="true">
            {item.kinds.map((k, i) => <span key={`${k.key}-${i}`} title={k.name}>{k.emoji}</span>)}
          </div>
        </div>
      )}

      {tipo === 'carril' && (
        <div className="ctrl-tarjeta-body">
          <div className="ctrl-tarjeta-tit">
            <strong>{item.nombre}</strong>
          </div>
          <div className="ctrl-tarjeta-sub">{item.lado}</div>
          {item.evento ? (
            <div className="ctrl-tarjeta-ef">
              <span>{item.evento.emoji} {item.evento.name}</span>
              <span className="pos">{fmt(item.evento.reward.p)}⭐ {fmt(item.evento.reward.e)}⚡</span>
            </div>
          ) : (
            <div className="ctrl-tarjeta-ef">
              <span>Sin evento inicial</span>
            </div>
          )}
        </div>
      )}
    </button>
  )
}
