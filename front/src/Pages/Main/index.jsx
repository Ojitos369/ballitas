import { useCallback, useEffect, useRef, useState } from 'react'
import { cargarMundo } from '../../Core/cargarMundo.js'
import { crearMundo } from '../../Core/mundo/index.js'
import Scene from '../../Components/World3D/Scene.jsx'
import Hud from '../../Components/Panels/Hud.jsx'
import Detail from '../../Components/Panels/Detail.jsx'
import BarraBallita from '../../Components/Panels/BarraBallita.jsx'
import ViewTabs from '../../Components/Panels/ViewTabs.jsx'
import Llegada from '../../Components/Panels/Llegada.jsx'
import Control from '../../Components/Control/index.jsx'
import { setFocoBallita } from '../../Components/World3D/mundos/foco.js'
import { StatsHud } from '../../Components/World3D/StatsOverlay.jsx'

function initialStatsOn() {
  if (typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('stats') === '1'
}

// El mundo se prepara en un worker (o caché) antes de montar la escena: la UI no se congela mientras tanto.
export default function Main() {
  const [listo, setListo] = useState(false)
  const [avance, setAvance] = useState(0)
  useEffect(() => { let vivo = true; cargarMundo(369, setAvance).then(() => { if (vivo) setListo(true) }); return () => { vivo = false } }, [])
  if (listo) return <MainScene />
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0b1020', color: '#cfe3ff', font: '600 18px system-ui' }}>
      <div style={{ width: 260, textAlign: 'center' }}>
        Tejiendo los caminos… {Math.round(avance * 100)}%
        <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: '#1e2a4a' }}>
          <div style={{ width: `${avance * 100}%`, height: '100%', borderRadius: 3, background: '#6cf', transition: 'width .2s' }} />
        </div>
      </div>
    </div>
  )
}

// `vista` ('mapa' | 'camino' | 'ballita') es la fuente de verdad; follow/pov se derivan de ella y de `punto`.
function MainScene() {
  const [sim, setSim] = useState(null)
  useEffect(() => { let vivo=true; crearMundo({semilla:369}).then(m=>{if(vivo){setSim(m); window.__mundo=m}else m.cerrar?.()}); return ()=>{vivo=false} }, [])
  useEffect(() => () => sim?.cerrar?.(), [sim])
  if (!sim) return <div role="status" style={{position:'fixed',inset:0,display:'grid',placeItems:'center',background:'#0b1020',color:'#cfe3ff',font:'600 18px system-ui'}}>Conectando con el mundo…</div>
  return <LoadedScene sim={sim} />
}

function LoadedScene({ sim }) {
  const progressRef = useRef(null)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [vista, setVista] = useState('mapa')
  const [det, setDet] = useState(false) // ficha de detalle abierta con «Det.»
  const [focusWay, setFocusWay] = useState(null)
  const [routeIndex, setRouteIndex] = useState(0)
  const [seek, setSeek] = useState(null)
  const [caminoPaused, setCaminoPaused] = useState(false)
  const [caminoSpeed, setCaminoSpeed] = useState(0.05)
  const [cine, setCine] = useState(false)
  const [showStats, setShowStats] = useState(initialStatsOn)
  const [stats, setStats] = useState(null)
  const [, setTick] = useState(0)

  // Un único punto de vista «POV»: en carretera la cámara de la ballita; en un planeta, Scene pasa sola a la de seguimiento.
  const enBallita = vista === 'ballita'
  const pov = enBallita
  const activeWay = focusWay == null ? null : sim.world.ways[focusWay]
  // Foco de la vista de planeta: solo con la ballita en POV.
  const enFoco = pov && selected ? selected : null
  useEffect(() => { setFocoBallita(enFoco) }, [enFoco])

  // La sim vive fuera de React: se refresca la UI 5 veces por segundo.
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  const enterWay = (way, ri = 0) => { setFocusWay(way.idx); setRouteIndex(ri); setSeek(null) }
  const pickWay = (way) => { if (way) enterWay(way) }

  const goVista = (id) => {
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
    }
    setVista(id)
  }

  // Atajos: 1/2/3 vistas, V entra/sale del POV, C cine, F3 stats, Esc al mapa (POV lo gestiona Scene).
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
        if (enBallita) setVista('mapa')
        else goVista('ballita')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const select = (b) => {
    setSelected(b)
    if (!b) {
      setDet(false)
      if (enBallita) setVista('mapa')
      else if (vista === 'mapa') setFocusWay(null)
    }
  }
  const followBallita = (b) => {
    if (!b || b.phase === 'dying' || b.phase === 'gone') return
    setSelected(b)
    setVista('ballita')
  }
  // Si la ballita seguida muere, se vuelve sola al mapa.
  useEffect(() => {
    if (selected?.phase !== 'gone') return
    if (enBallita) setVista('mapa')
    setSelected(null)
    setDet(false)
  })
  const exitPov = useCallback(() => setVista('mapa'), [])
  // Control se suscribe a eventos del mundo con este callback: debe ser estable entre renders.
  const selectRef = useRef(select)
  selectRef.current = select
  const selectCtrl = useCallback((b) => selectRef.current(b), [])

  return (
    <div className="app">
      <Scene sim={sim} ballitas={sim.ballitas} speed={speed} selected={selected} pov={pov} cine={cine} showStats={showStats} onStatsSample={setStats}
        vista={vista} activeWay={activeWay} routeIndex={routeIndex} seek={seek} caminoSpeed={caminoSpeed} caminoPaused={caminoPaused} progressRef={progressRef}
        onSelect={select} onSelectWay={pickWay} onExitPov={exitPov} />
      {showStats && <StatsHud stats={stats} />}
      <Hud sim={sim} speed={speed} setSpeed={setSpeed} selected={selected} onSelect={select} follow={pov} onFollowBallita={followBallita} cine={cine} onToggleCine={() => setCine((v) => !v)} />
      <ViewTabs vista={vista} goVista={goVista} sim={sim} way={activeWay} routeIndex={routeIndex} setRouteIndex={(i) => { setRouteIndex(i); setSeek(null) }}
        paused={caminoPaused} setPaused={setCaminoPaused} caminoSpeed={caminoSpeed} setCaminoSpeed={setCaminoSpeed}
        seekTo={(i) => setSeek({ i, k: performance.now() })} onFollow={followBallita} progressRef={progressRef} />
      <Control mundo={sim} selected={selected} onSelect={selectCtrl} />
      {enFoco && <Llegada b={enFoco} world={sim.world} />}
      {selected && vista !== 'camino' && (
        <BarraBallita b={selected} mundo={sim} pov={pov} detAbierto={det} onPov={followBallita} onDet={() => setDet((v) => !v)} onExitPov={exitPov} />
      )}
      {selected && det && vista !== 'camino' && <Detail b={selected} sim={sim} pov={pov} onClose={() => setDet(false)} />}
    </div>
  )
}
