import { useEffect, useRef, useState } from 'react'

const JOY_MAX_R = 32
const JOY_DEADZONE = 0.18 // zona muerta amplia: sin deriva al soltar a medias

function computeJoy(el, clientX, clientY) {
  const rect = el.getBoundingClientRect()
  const cx = rect.left + rect.width * 0.5
  const cy = rect.top + rect.height * 0.5
  let dx = clientX - cx
  let dy = clientY - cy
  const dist = Math.hypot(dx, dy)
  if (dist > JOY_MAX_R) {
    const s = JOY_MAX_R / dist
    dx *= s
    dy *= s
  }
  const norm = Math.min(1, dist / JOY_MAX_R)
  if (norm < JOY_DEADZONE) return [dx, dy, 0, 0]
  const lin = (norm - JOY_DEADZONE) / (1 - JOY_DEADZONE)
  const scaled = lin * lin // respuesta cuadrática: precisión cerca del centro
  const angle = Math.atan2(dy, dx)
  return [dx, dy, Math.cos(angle) * scaled, Math.sin(angle) * scaled]
}

/**
 * Panel compacto de ayuda y controles en vista POV + pad virtual de mirada.
 */
export default function PovPanel({
  active,
  povControlRef,
  pointerLocked,
  gyroActive,
  gyroNote,
  onCenter,
  onTogglePointerLock,
  onToggleGyro,
  onExitPov,
}) {
  const [showHelp, setShowHelp] = useState(true)
  const padRef = useRef(null)
  const knobRef = useRef(null)
  const joyPointerId = useRef(null)

  const setKnob = (dx, dy, nx, ny) => {
    if (knobRef.current) {
      knobRef.current.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`
    }
    if (povControlRef?.current) {
      povControlRef.current.joyX = nx
      povControlRef.current.joyY = ny
    }
  }

  useEffect(() => {
    if (!active) {
      joyPointerId.current = null
      setKnob(0, 0, 0, 0)
    }
  }, [active])

  useEffect(() => {
    if (!active) return undefined

    const updateFromClient = (clientX, clientY) => {
      const el = padRef.current
      if (!el) return
      const [dx, dy, nx, ny] = computeJoy(el, clientX, clientY)
      setKnob(dx, dy, nx, ny)
    }

    const onMove = (e) => {
      if (joyPointerId.current === null || e.pointerId !== joyPointerId.current) return
      e.preventDefault()
      updateFromClient(e.clientX, e.clientY)
    }

    const onEnd = (e) => {
      if (joyPointerId.current === null || e.pointerId !== joyPointerId.current) return
      joyPointerId.current = null
      setKnob(0, 0, 0, 0)
    }

    const onBlur = () => {
      joyPointerId.current = null
      setKnob(0, 0, 0, 0)
    }

    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onEnd)
    window.addEventListener('pointercancel', onEnd)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onEnd)
      window.removeEventListener('pointercancel', onEnd)
      window.removeEventListener('blur', onBlur)
    }
  }, [active, povControlRef])

  if (!active) return null

  const onPadDown = (e) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    joyPointerId.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    const [dx, dy, nx, ny] = computeJoy(e.currentTarget, e.clientX, e.clientY)
    setKnob(dx, dy, nx, ny)
  }

  return (
    <>
      <section
        className="pov-panel"
        aria-label="Controles de cámara POV"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="pov-panel-head">
          <span className="pov-badge">🎥 Vista POV</span>
          <button
            type="button"
            className="pov-mini-btn"
            aria-expanded={showHelp}
            aria-label={showHelp ? 'Ocultar ayuda POV' : 'Mostrar ayuda POV'}
            title={showHelp ? 'Ocultar ayuda' : 'Mostrar ayuda'}
            onClick={() => setShowHelp((v) => !v)}
          >
            ?
          </button>
          <button
            type="button"
            className="pov-mini-btn"
            aria-label="Salir de POV (Esc)"
            title="Salir de POV (Esc)"
            onClick={onExitPov}
          >
            ✕
          </button>
        </div>

        <div className="pov-actions">
          <button
            type="button"
            className="pov-action"
            onClick={onCenter}
            title="Centrar mirada al frente (R)"
          >
            🎯 Centrar <kbd>R</kbd>
          </button>
          <button
            type="button"
            className="pov-action"
            aria-pressed={pointerLocked}
            onClick={onTogglePointerLock}
            title="Bloquear cursor para mirar libremente (Esc suelta cursor)"
          >
            🖱 {pointerLocked ? 'Cursor libre' : 'Mirar libre'}
          </button>
          <button
            type="button"
            className="pov-action"
            aria-pressed={gyroActive}
            onClick={onToggleGyro}
            title="Girar cámara con el giroscopio del dispositivo"
          >
            🧭 {gyroActive ? 'Giro ON' : 'Giroscopio'}
          </button>
        </div>

        {pointerLocked && (
          <p className="pov-status">Cursor bloqueado · Esc suelta cursor · 2º Esc sale de POV</p>
        )}
        {gyroNote && <p className="pov-status">{gyroNote}</p>}

        {showHelp && (
          <div className="pov-help">
            <span>Arrastra o usa el pad</span>
            <span>Flechas / WASD / IJKL: girar</span>
            <span>Q/E: inclinar · Rueda: zoom</span>
            <span>R / doble clic: centrar · Esc: salir</span>
          </div>
        )}
      </section>

      <div
        className="pov-joy-wrap"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          ref={padRef}
          className="pov-joy-pad"
          role="application"
          aria-label="Joystick de mirada POV"
          onPointerDown={onPadDown}
        >
          <div className="pov-joy-cross" aria-hidden="true" />
          <div ref={knobRef} className="pov-joy-knob" aria-hidden="true" />
        </div>
        <span className="pov-joy-label">Mirar</span>
      </div>
    </>
  )
}
