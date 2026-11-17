import { useEffect, useRef, useState } from 'react'
import { Sim } from '../../Core/sim.js'
import Scene from '../../Components/World3D/Scene.jsx'
import Hud from '../../Components/Panels/Hud.jsx'
import Detail from '../../Components/Panels/Detail.jsx'
import ViewTabs from '../../Components/Panels/ViewTabs.jsx'
import { StatsHud } from '../../Components/World3D/StatsOverlay.jsx'

function initialStatsOn() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('stats') === '1'
}

// `vista` ('mapa' | 'camino' | 'bollita') es la fuente de verdad; follow/pov se derivan de ella y de `punto`.
export default function Main() {
  const simRef = useRef(null)
  if (!simRef.current) simRef.current = new Sim()
  const sim = simRef.current
  const progressRef = useRef(null)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [vista, setVista] = useState('mapa')
  const [punto, setPunto] = useState('externa') // punto de vista en la vista bollita: externa | interna
  const [focusWay, setFocusWay] = useState(null)
  const [routeIndex, setRouteIndex] = useState(0)
  const [seek, setSeek] = useState(null)
  const [caminoPaused, setCaminoPaused] = useState(false)
  const [caminoSpeed, setCaminoSpeed] = useState(0.05)
  const [cine, setCine] = useState(false)
  const [showStats, setShowStats] = useState(initialStatsOn)
  const [stats, setStats] = useState(null)
  const [, setTick] = useState(0)

  const enBollita = vista === 'bollita'
  const follow = enBollita && punto === 'externa'
  const pov = enBollita && punto === 'interna'
  const activeWay = focusWay == null ? null : sim.world.ways[focusWay]

  // La sim vive fuera de React: se refresca la UI 5 veces por segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  const enterWay = (way, ri = 0) => { setFocusWay(way.idx); setRouteIndex(ri); setSeek(null) }
  const pickWay = (way) => { if (way) enterWay(way) }

  const goVista = (id, p) => {
    if (id === 'camino') {
      let w = activeWay
      if (!w && selected?.way) { // camino de la bollita seleccionada, en su ruta
        w = selected.way
        enterWay(w, Math.max(0, w.routes.indexOf(selected.route)))
      }
      if (!w) { setVista('camino'); return }
    }
    if (id === 'bollita') {
      let b = selected
      if (!b || b.phase === 'gone') b = sim.bollitas.find((o) => o.phase !== 'dying' && o.phase !== 'gone')
      if (!b) return
      setSelected(b)
      if (p) setPunto(p)
    }
    setVista(id)
  }

  // Atajos: 1/2/3 vistas, V alterna externa/interna, C cine, F3 stats, Esc al mapa (POV lo gestiona Scene).
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'F3') { e.preventDefault(); setShowStats((v) => !v); return }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') { if (!document.pointerLockElement) setVista('mapa'); return }
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const k = e.key.toLowerCase()
      if (k === 'c') setCine((v) => !v)
      else if (k === '1') goVista('mapa')
      else if (k === '2') goVista('camino')
      else if (k === '3') goVista('bollita')
      else if (k === 'v') {
        if (enBollita) setPunto((p) => (p === 'interna' ? 'externa' : 'interna'))
        else goVista('bollita', 'interna')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const select = (b) => {
    setSelected(b)
    if (!b) {
      if (enBollita) setVista('mapa')
      else if (vista === 'mapa') setFocusWay(null)
    }
  }
  const followBollita = (b) => {
    if (!b) return
    setSelected(b)
    setPunto('externa')
    setVista('bollita')
  }
  // Si la bollita seguida muere, se vuelve sola al mapa.
  useEffect(() => {
    if (selected?.phase === 'gone' && enBollita) setVista('mapa')
  })

  return (
    <div className="app">
      <Scene sim={sim} bollitas={sim.bollitas} speed={speed} selected={selected} follow={follow} pov={pov} cine={cine} showStats={showStats} onStatsSample={setStats}
        vista={vista} activeWay={activeWay} routeIndex={routeIndex} seek={seek} caminoSpeed={caminoSpeed} caminoPaused={caminoPaused} progressRef={progressRef}
        onSelect={select} onSelectWay={pickWay} onExitPov={() => setVista('mapa')} />
      {showStats && <StatsHud stats={stats} />}
      <Hud sim={sim} speed={speed} setSpeed={setSpeed} selected={selected} onSelect={select} follow={follow} onFollowBollita={followBollita} cine={cine} onToggleCine={() => setCine((v) => !v)} />
      <ViewTabs vista={vista} goVista={goVista} sim={sim} way={activeWay} routeIndex={routeIndex} setRouteIndex={(i) => { setRouteIndex(i); setSeek(null) }}
        selected={selected} punto={punto} paused={caminoPaused} setPaused={setCaminoPaused} caminoSpeed={caminoSpeed} setCaminoSpeed={setCaminoSpeed}
        seekTo={(i) => setSeek({ i, k: performance.now() })} onFollow={followBollita} progressRef={progressRef} />
      {selected && vista !== 'camino' && (
        <Detail b={selected} sim={sim} follow={follow} pov={pov}
          onFollow={() => (follow ? setVista('mapa') : followBollita(selected))}
          onPov={() => (pov ? setPunto('externa') : goVista('bollita', 'interna'))}
          onClose={() => select(null)} />
      )}
    </div>
  )
}
