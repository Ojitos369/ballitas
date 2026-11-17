import { useCallback, useEffect, useRef, useState } from 'react'
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

// `vista` ('mapa' | 'camino' | 'ballita') es la fuente de verdad; follow/pov se derivan de ella y de `punto`.
export default function Main() {
  const simRef = useRef(null)
  if (!simRef.current) simRef.current = new Sim()
  const sim = simRef.current
  const progressRef = useRef(null)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [vista, setVista] = useState('mapa')
  const [punto, setPunto] = useState('externa') // punto de vista en la vista ballita: externa | interna
  const [focusWay, setFocusWay] = useState(null)
  const [routeIndex, setRouteIndex] = useState(0)
  const [seek, setSeek] = useState(null)
  const [caminoPaused, setCaminoPaused] = useState(false)
  const [caminoSpeed, setCaminoSpeed] = useState(0.05)
  const [cine, setCine] = useState(false)
  const [showStats, setShowStats] = useState(initialStatsOn)
  const [stats, setStats] = useState(null)
  const [, setTick] = useState(0)

  const enBallita = vista === 'ballita'
  const follow = enBallita && punto === 'externa'
  const pov = enBallita && punto === 'interna'
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
      if (!w && selected?.way) { // camino de la ballita seleccionada, en su ruta
        w = selected.way
        enterWay(w, Math.max(0, w.routes.indexOf(selected.route)))
      }
      if (!w) { w = sim.world.ways[0]; if (!w) return; enterWay(w) } // sin camino elegido: el primero, sin carteles de ayuda
    }
    if (id === 'ballita') {
      let b = selected
      if (!b || b.phase === 'gone' || b.phase === 'dying') b =sim.ballitas.find((o) => o.phase !== 'dying' && o.phase !== 'gone')
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
      const tag = e.target?.tagName
      if (e.target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'Escape') { if (!document.pointerLockElement) setVista('mapa'); return }
      const k = e.key.toLowerCase()
      if (k === 'c') setCine((v) => !v)
      else if (k === '1') goVista('mapa')
      else if (k === '2') goVista('camino')
      else if (k === '3') goVista('ballita')
      else if (k === 'v') {
        if (enBallita) setPunto((p) => (p === 'interna' ? 'externa' : 'interna'))
        else goVista('ballita', 'interna')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const select = (b) => {
    setSelected(b)
    if (!b) {
      if (enBallita) setVista('mapa')
      else if (vista === 'mapa') setFocusWay(null)
    }
  }
  const followBallita = (b) => {
    if (!b || b.phase === 'dying' || b.phase === 'gone') return
    setSelected(b)
    setPunto('externa')
    setVista('ballita')
  }
  // Si la ballita seguida muere, se vuelve sola al mapa.
  useEffect(() => {
    if (selected?.phase !== 'gone') return
    if (enBallita) setVista('mapa')
    setSelected(null)
  })
  const exitPov = useCallback(() => setVista('mapa'), [])

  return (
    <div className="app">
      <Scene sim={sim} ballitas={sim.ballitas} speed={speed} selected={selected} follow={follow} pov={pov} cine={cine} showStats={showStats} onStatsSample={setStats}
        vista={vista} activeWay={activeWay} routeIndex={routeIndex} seek={seek} caminoSpeed={caminoSpeed} caminoPaused={caminoPaused} progressRef={progressRef}
        onSelect={select} onSelectWay={pickWay} onExitPov={exitPov} />
      {showStats && <StatsHud stats={stats} />}
      <Hud sim={sim} speed={speed} setSpeed={setSpeed} selected={selected} onSelect={select} follow={follow} onFollowBallita={followBallita} cine={cine} onToggleCine={() => setCine((v) => !v)} />
      <ViewTabs vista={vista} goVista={goVista} sim={sim} way={activeWay} routeIndex={routeIndex} setRouteIndex={(i) => { setRouteIndex(i); setSeek(null) }}
        paused={caminoPaused} setPaused={setCaminoPaused} caminoSpeed={caminoSpeed} setCaminoSpeed={setCaminoSpeed}
        seekTo={(i) => setSeek({ i, k: performance.now() })} onFollow={followBallita} progressRef={progressRef} />
      {selected && vista !== 'camino' && (
        <Detail b={selected} sim={sim} follow={follow} pov={pov}
          onFollow={() => (follow ? setVista('mapa') : followBallita(selected))}
          onPov={() => (pov ? setPunto('externa') : goVista('ballita', 'interna'))}
          onClose={() => select(null)} />
      )}
    </div>
  )
}
