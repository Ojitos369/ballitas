import { useEffect, useRef, useState } from 'react'
import { Sim } from '../../Core/sim.js'
import Scene from '../../Components/World3D/Scene.jsx'
import Hud from '../../Components/Panels/Hud.jsx'
import Detail from '../../Components/Panels/Detail.jsx'
import ViewTabs from '../../Components/Panels/ViewTabs.jsx'

export default function Main() {
  const simRef = useRef(null)
  if (!simRef.current) simRef.current = new Sim()
  const sim = simRef.current
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [vista, setVista] = useState('mapa')
  const [focusWay, setFocusWay] = useState(null)
  const [routeIndex, setRouteIndex] = useState(0)
  const [seekIndex, setSeekIndex] = useState(null)
  const [caminoPaused, setCaminoPaused] = useState(false)
  const [caminoSpeed, setCaminoSpeed] = useState(0.16)
  const follow = vista === 'externa'
  const pov = vista === 'interna'
  const activeWay = focusWay == null ? null : sim.world.ways[focusWay]
  const activeRoute = activeWay?.routes?.[routeIndex % (activeWay?.routes?.length || 1)]
  const [cine, setCine] = useState(false)
  const [, setTick] = useState(0)

  // La sim vive fuera de React: se refresca la UI 5 veces por segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  // Atajos globales para cambiar de vista sin perder la bollita seleccionada.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') { setVista('mapa'); return }
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'c' || e.key === 'C') setCine((v) => !v)
      if (e.key === '1') setVista('mapa')
      if (e.key === '2') setVista('camino')
      if (e.key === '3') setVista('externa')
      if (e.key === 'v' || e.key === 'V') setVista((v) => v === 'interna' ? 'externa' : 'interna')
      if (vista === 'camino' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && activeRoute) {
        const events = activeRoute.segments.map((s, i) => s.event ? i : -1).filter((i) => i >= 0)
        if (events.length) {
          e.preventDefault()
          const next = e.key === 'ArrowRight'
            ? events.find((i) => i > (seekIndex ?? -1)) ?? events[0]
            : [...events].reverse().find((i) => i < (seekIndex ?? activeRoute.segments.length)) ?? events.at(-1)
          setSeekIndex(next)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [vista, activeRoute, seekIndex])

  const select = (b) => {
    setSelected(b)
    if (!b && (vista === 'externa' || vista === 'interna')) setVista('mapa')
  }
  const toggleFollow = () => setVista((v) => v === 'externa' ? 'mapa' : 'externa')
  const followBollita = (b) => {
    if (!b) return
    if (selected === b) {
      toggleFollow()
    } else {
      setSelected(b)
      setVista('externa')
    }
  }
  const togglePov = () => setVista((v) => v === 'interna' ? 'externa' : 'interna')
  // Si la bollita seguida o en POV muere, se vuelve sola a la vista general.
  useEffect(() => {
    if (selected?.phase === 'gone' && (vista === 'externa' || vista === 'interna')) setVista('mapa')
  }, [selected, vista, sim.bollitas])

  const enterWay = (way) => { if (way) { setFocusWay(way.idx); setRouteIndex(0); setSeekIndex(null) } }

  return (
    <div className="app">
      <Scene sim={sim} bollitas={sim.bollitas} speed={speed} selected={selected} follow={follow} pov={pov} cine={cine} vista={vista} focusWay={focusWay} activeWay={activeWay} routeIndex={routeIndex} seekIndex={seekIndex} caminoSpeed={caminoSpeed} caminoPaused={caminoPaused} onSelect={select} onSelectWay={enterWay} />
      <Hud sim={sim} speed={speed} setSpeed={setSpeed} selected={selected} onSelect={select} follow={follow} onFollowBollita={followBollita} cine={cine} onToggleCine={() => setCine((v) => !v)} />
      <ViewTabs vista={vista} setVista={setVista} sim={sim} focusWay={focusWay} setFocusWay={setFocusWay} routeIndex={routeIndex} setRouteIndex={setRouteIndex} selected={selected} paused={caminoPaused} setPaused={setCaminoPaused} caminoSpeed={caminoSpeed} setCaminoSpeed={setCaminoSpeed} seekTo={setSeekIndex} onFollow={followBollita} />
      {selected && (vista === 'externa' || vista === 'interna' || vista === 'mapa') && <Detail b={selected} sim={sim} follow={follow} pov={pov} onFollow={toggleFollow} onPov={togglePov} onClose={() => select(null)} />}
    </div>
  )
}
