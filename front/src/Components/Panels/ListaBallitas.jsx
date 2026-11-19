import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { colorDe } from './Hud.jsx'
import { SkinThumb } from './Detail.jsx'
import { buildSkin } from '../World3D/skins.js'

const SORTS = [
  ['name', 'Nombre', 'asc'],
  ['p', '⭐ Puntos', 'desc'],
  ['e', '⚡ Energía', 'desc'],
]

function ubicacionCorta(b, sim) {
  try {
    const nodes = sim.world.nodes
    const nodo = nodes[b.node]?.name ?? ''
    if (b.phase === 'travel') {
      const tema = b.way?.theme
      const pref = tema?.emoji ? `${tema.emoji} ` : ''
      const camino = tema?.name ?? 'Camino'
      const ruta = b.route ? ` · ruta ${b.route.name}` : ''
      return `${pref}${camino}${ruta}`
    }
    if (b.phase === 'toPort') {
      const dest = nodes[b.way?.to]?.name ?? ''
      return `En ${nodo}${dest ? ` → ${dest}` : ''}`
    }
    return `En ${nodo}${b.dest ? ` · ${b.dest.name}` : ''}`
  } catch {
    return ''
  }
}

const clampPct = (v) => Math.max(0, Math.min(100, Math.round(v)))

const FilaBallita = memo(function FilaBallita({ b, sim, isSelected, isFollowing, onSelect, onFollow }) {
  const skin = useMemo(() => buildSkin(b.genome, b.arch), [b.genome, b.arch])
  const bodyCss = colorDe(b)
  const lugar = ubicacionCorta(b, sim)
  const p = clampPct(b.p)
  const e = clampPct(b.e)
  const sub = [b.arch?.title, skin.family?.name].filter(Boolean).join(' · ')

  return (
    <li className={`lista-fila${isSelected ? ' activa' : ''}`}>
      <button
        type="button"
        className="lista-fila-btn"
        aria-pressed={isSelected}
        onClick={() => onSelect(b)}
      >
        <SkinThumb skin={skin} bodyCss={bodyCss} size={28} />
        <span className="lista-info">
          <span className="lista-top">
            <strong className="lista-nombre">{b.name}</strong>
            {sub && <span className="lista-sub">{sub}</span>}
          </span>
          {lugar && <span className="lista-lugar">{lugar}</span>}
          <span className="lista-barras" aria-label={`Puntos ${p}, Energía ${e}`}>
            <span className="lista-bar">
              <span>⭐ {p}</span>
              <i><b style={{ width: `${p}%`, background: '#ffd54a' }} /></i>
            </span>
            <span className="lista-bar">
              <span>⚡ {e}</span>
              <i><b style={{ width: `${e}%`, background: '#5dffb0' }} /></i>
            </span>
          </span>
        </span>
      </button>
      {onFollow && (
        <button
          type="button"
          className="lista-ojo"
          aria-pressed={isFollowing}
          aria-label={isFollowing ? `${b.name} ya está en POV` : `POV de ${b.name}`}
          title={isFollowing ? 'En POV' : 'POV'}
          onClick={() => onFollow(b)}
        >
          👁
        </button>
      )}
    </li>
  )
})

export default function ListaBallitas({ sim, vivas, selected, onSelect, follow, onFollow }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortDir, setSortDir] = useState('asc')
  const [, setPulse] = useState(0)
  const rootRef = useRef(null)
  const btnRef = useRef(null)
  const searchRef = useRef(null)

  // Refresco ~3 Hz mientras el panel está abierto para seguir la simulación sin sobrecargar.
  useEffect(() => {
    if (!open) return undefined
    const id = setInterval(() => setPulse((n) => n + 1), 330)
    return () => clearInterval(id)
  }, [open])

  // Cierra al hacer clic fuera o al pulsar Escape.
  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        e.stopImmediatePropagation()
        setOpen(false)
        btnRef.current?.focus()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  const toggleSort = (key, defaultDir) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir(defaultDir)
    }
  }

  const q = query.trim().toLowerCase()
  const items = vivas
    .filter((b) => {
      if (!q) return true
      const texto = `${b.name} ${b.arch?.title ?? ''} ${ubicacionCorta(b, sim)}`.toLowerCase()
      return texto.includes(q)
    })
    .slice()
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'es') * dir
      return ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * dir
    })

  return (
    <div className="lista-wrap" ref={rootRef}>
      <button
        ref={btnRef}
        type="button"
        className="lista-btn"
        aria-expanded={open}
        aria-haspopup="true"
        aria-controls="lista-ballitas-panel"
        onClick={() => setOpen((v) => !v)}
      >
        <span>☰ Lista</span>
        <span className="lista-badge">{vivas.length}</span>
      </button>

      {open && (
        <section
          id="lista-ballitas-panel"
          className="lista-panel"
          aria-label="Lista de ballitas activas"
        >
          <div className="lista-controles">
            <input
              ref={searchRef}
              type="search"
              className="lista-buscar"
              placeholder="Buscar nombre, arquetipo o lugar..."
              aria-label="Buscar ballita"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="lista-orden" role="group" aria-label="Ordenar lista">
              {SORTS.map(([key, label, defDir]) => {
                const active = sortBy === key
                const arrow = active ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleSort(key, defDir)}
                  >
                    {label}{arrow}
                  </button>
                )
              })}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="lista-vacia">Sin coincidencias.</p>
          ) : (
            <ul className="lista-filas">
              {items.map((b) => (
                <FilaBallita
                  key={b.id}
                  b={b}
                  sim={sim}
                  isSelected={selected === b}
                  isFollowing={Boolean(follow && selected === b)}
                  onSelect={onSelect}
                  onFollow={onFollow}
                />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  )
}
