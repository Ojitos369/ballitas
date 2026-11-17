import { useEffect, useRef, useState } from 'react'
import { Sim } from '../../Core/sim.js'
import Scene from '../../Components/World3D/Scene.jsx'
import Hud from '../../Components/Panels/Hud.jsx'
import Detail from '../../Components/Panels/Detail.jsx'

export default function Main() {
  const simRef = useRef(null)
  if (!simRef.current) simRef.current = new Sim()
  const sim = simRef.current
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [follow, setFollow] = useState(false)
  const [pov, setPov] = useState(false)
  const [cine, setCine] = useState(false)
  const [, setTick] = useState(0)

  // La sim vive fuera de React: se refresca la UI 5 veces por segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  // Atajo de teclado: tecla C alterna el modo cine; Esc sale de POV.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Escape') {
        if (!document.pointerLockElement) setPov(false)
        return
      }
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'c' || e.key === 'C') setCine((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const select = (b) => {
    if (b !== selected) setPov(false)
    setSelected(b)
    if (!b) setFollow(false)
  }
  const toggleFollow = () => setFollow((v) => { const next = !v; if (next) setPov(false); return next })
  const followBollita = (b) => {
    if (!b) return
    if (selected === b) {
      toggleFollow()
    } else {
      setPov(false)
      setSelected(b)
      setFollow(true)
    }
  }
  const togglePov = () => setPov((v) => { const next = !v; if (next) setFollow(false); return next })
  // Si la bollita seguida o en POV muere, se vuelve sola a la vista general.
  if (follow && selected && selected.phase === 'gone') setFollow(false)
  if (pov && selected && selected.phase === 'gone') setPov(false)

  return (
    <div className="app">
      <Scene sim={sim} bollitas={sim.bollitas} speed={speed} selected={selected} follow={follow} pov={pov} cine={cine} onSelect={select} onExitPov={() => setPov(false)} />
      <Hud sim={sim} speed={speed} setSpeed={setSpeed} selected={selected} onSelect={select} follow={follow} onFollowBollita={followBollita} cine={cine} onToggleCine={() => setCine((v) => !v)} />
      {selected && <Detail b={selected} sim={sim} follow={follow} pov={pov} onFollow={toggleFollow} onPov={togglePov} onClose={() => select(null)} />}
    </div>
  )
}
