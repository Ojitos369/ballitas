import { useState } from 'react'
import { caminoDeBoton } from './caminoBoton.js'

// Barra inferior de la ballita seleccionada. El estado se deriva en cada render (la sim vive fuera de React):
// seleccionada → [POV][Det.]; en POV → [🛞][Det.][Salir]; en POV y controlada (b.mia) → 🛞 activo y «Salir» deja el control.
export default function BarraBallita({ b, mundo, pov, detAbierto, onPov, onDet, onExitPov }) {
  const [ocupado, setOcupado] = useState(false)
  const [err, setErr] = useState('')
  const c = caminoDeBoton(b, mundo.world)
  const otro = !!b.ctrl && !b.mia // controlada por otro espectador (mismo campo que Decisiones.jsx)

  const tomar = async () => {
    if (ocupado || b.mia || otro) return
    setOcupado(true); setErr('')
    try {
      const res = await mundo.tomar(b)
      if (!res?.ok) setErr(res?.error === 'ocupada' ? 'Alguien la tomó antes.' : res?.error === 'ya_controlas' ? 'Ya controlas otra ballita.' : 'No se pudo tomar el control.')
    } finally { setOcupado(false) }
  }
  const salir = async () => {
    if (!b.mia) return onExitPov()
    if (ocupado) return
    setOcupado(true); setErr('')
    try { await mundo.dejar(b) } finally { setOcupado(false) } // se queda en POV, sin controlar
  }
  const titulo = c.nombre ? ` · ${c.modo === 'actual' ? 'en' : 'tomará'} ${c.nombre}` : ''

  return (
    <div className="bb" style={{ '--bb-c': c.color }} data-modo={c.modo} role="toolbar" aria-label={`Acciones de ${b.name}`}>
      {err && <span className="bb-err" role="status">{err}</span>}
      {pov ? (
        <button type="button" className={`bb-btn bb-volante${b.mia ? ' on' : ''}`} aria-pressed={!!b.mia} aria-label="Tomar control"
          disabled={otro || ocupado} title={otro ? 'Controlada por otro espectador' : b.mia ? 'Controlas esta ballita' : `Tomar control${titulo}`} onClick={tomar}>🛞</button>
      ) : (
        <button type="button" className="bb-btn" title={`Punto de vista${titulo}`} onClick={() => onPov(b)}>POV</button>
      )}
      <button type="button" className="bb-btn" aria-pressed={detAbierto} title={`Detalle${titulo}`} onClick={onDet}>Det.</button>
      {pov && (
        <button type="button" className="bb-btn bb-salir" title={b.mia ? 'Dejar de controlar (sigues en POV)' : 'Salir a la pantalla principal (Esc)'} onClick={salir}>✕ Salir</button>
      )}
    </div>
  )
}
