import { useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../../static/css/main.css'
import { cargarMundo } from '../../Core/cargarMundo.js'
import { setFocoBallita } from '../World3D/mundos/foco.js'
import Scene from '../World3D/Scene.jsx'
import Hud from '../Panels/Hud.jsx'
import Detail from '../Panels/Detail.jsx'
import ViewTabs from '../Panels/ViewTabs.jsx'
import Llegada from '../Panels/Llegada.jsx'
import Control from './index.jsx'
import { crearMundoFalso } from './mundoFalso.js'

function DemoRoot() {
  const [listo, setListo] = useState(false)
  const [avance, setAvance] = useState(0)

  useEffect(() => {
    let vivo = true
    cargarMundo(369, setAvance).then(() => {
      if (vivo) setListo(true)
    })
    return () => { vivo = false }
  }, [])

  if (listo) return <DemoScene />
  return (
    <div role="status" aria-live="polite" style={{ position: 'fixed', inset: 0, display: 'grid', placeItems: 'center', background: '#0b1020', color: '#cfe3ff', font: '600 18px system-ui' }}>
      <div style={{ width: 260, textAlign: 'center' }}>
        Cargando demo de control… {Math.round(avance * 100)}%
        <div style={{ marginTop: 12, height: 6, borderRadius: 3, background: '#1e2a4a' }}>
          <div style={{ width: `${avance * 100}%`, height: '100%', borderRadius: 3, background: '#6cf', transition: 'width .2s' }} />
        </div>
      </div>
    </div>
  )
}

function DemoScene() {
  const mundoRef = useRef(null)
  if (!mundoRef.current) {
    mundoRef.current = crearMundoFalso({ semilla: 369, conRelleno: true })
    if (typeof window !== 'undefined') window.__ballitasMundo = mundoRef.current
  }
  const mundo = mundoRef.current
  const progressRef = useRef(null)
  const [speed, setSpeed] = useState(1)
  const [selected, setSelected] = useState(null)
  const [vista, setVista] = useState('mapa')
  const [focusWay, setFocusWay] = useState(null)
  const [routeIndex, setRouteIndex] = useState(0)
  const [seek, setSeek] = useState(null)
  const [caminoPaused, setCaminoPaused] = useState(false)
  const [caminoSpeed, setCaminoSpeed] = useState(0.05)
  const [cine, setCine] = useState(false)
  const [, setTick] = useState(0)

  const enBallita = vista === 'ballita'
  const pov = enBallita
  const activeWay = focusWay == null ? null : mundo.world.ways[focusWay]
  const enFoco = pov && selected ? selected : null
  useEffect(() => { setFocoBallita(enFoco) }, [enFoco])

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 200)
    return () => clearInterval(id)
  }, [])

  const enterWay = (way, ri = 0) => { setFocusWay(way.idx); setRouteIndex(ri); setSeek(null) }
  const pickWay = (way) => { if (way) enterWay(way) }

  const goVista = (id) => {
    if (id === 'camino') {
      let w = activeWay
      if (!w && selected?.way) {
        w = selected.way
        enterWay(w, Math.max(0, w.routes.indexOf(selected.route)))
      }
      if (!w) { w = mundo.world.ways[0]; if (!w) return; enterWay(w) }
    }
    if (id === 'ballita') {
      let b = selected
      if (!b || b.phase === 'gone' || b.phase === 'dying') b = mundo.ballitas.find((o) => o.phase !== 'dying' && o.phase !== 'gone')
      if (!b) return
      setSelected(b)
    }
    setVista(id)
  }

  useEffect(() => {
    const onKey = (e) => {
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
      if (enBallita) setVista('mapa')
      else if (vista === 'mapa') setFocusWay(null)
    }
  }

  const followBallita = (b) => {
    if (!b || b.phase === 'dying' || b.phase === 'gone') return
    setSelected(b)
    setVista('ballita')
  }

  useEffect(() => {
    if (selected?.phase !== 'gone') return
    if (enBallita) setVista('mapa')
    setSelected(null)
  })

  const exitPov = useCallback(() => setVista('mapa'), [])

  return (
    <div className="app">
      <Scene
        sim={mundo}
        ballitas={mundo.ballitas}
        speed={speed}
        selected={selected}
        pov={pov}
        cine={cine}
        vista={vista}
        activeWay={activeWay}
        routeIndex={routeIndex}
        seek={seek}
        caminoSpeed={caminoSpeed}
        caminoPaused={caminoPaused}
        progressRef={progressRef}
        onSelect={select}
        onSelectWay={pickWay}
        onExitPov={exitPov}
      />
      <Hud
        sim={mundo}
        speed={speed}
        setSpeed={setSpeed}
        selected={selected}
        onSelect={select}
        follow={pov}
        onFollowBallita={followBallita}
        cine={cine}
        onToggleCine={() => setCine((v) => !v)}
      />
      <ViewTabs
        vista={vista}
        goVista={goVista}
        sim={mundo}
        way={activeWay}
        routeIndex={routeIndex}
        setRouteIndex={(i) => { setRouteIndex(i); setSeek(null) }}
        paused={caminoPaused}
        setPaused={setCaminoPaused}
        caminoSpeed={caminoSpeed}
        setCaminoSpeed={setCaminoSpeed}
        seekTo={(i) => setSeek({ i, k: performance.now() })}
        onFollow={followBallita}
        progressRef={progressRef}
      />
      {enFoco && <Llegada b={enFoco} world={mundo.world} />}
      {selected && vista !== 'camino' && (
        <Detail
          b={selected}
          sim={mundo}
          pov={pov}
          onPov={() => (pov ? setVista('mapa') : followBallita(selected))}
          onClose={() => select(null)}
        />
      )}
      <Control mundo={mundo} selected={selected} onSelect={select} />
    </div>
  )
}

createRoot(document.getElementById('root')).render(<DemoRoot />)
