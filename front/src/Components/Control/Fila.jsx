import { useState } from 'react'

export default function Fila({ mundo }) {
  const [saliendo, setSaliendo] = useState(false)
  const fila = mundo?.fila || []
  const maxFila = mundo?.reglas?.maxFila ?? 30
  const miIdx = fila.findIndex((f) => f.mia)

  const salir = async () => {
    if (saliendo) return
    setSaliendo(true)
    try {
      await mundo.salirFila()
    } finally {
      setSaliendo(false)
    }
  }

  return (
    <section className="ctrl-fila" aria-label="Fila de espera para entrar al mundo">
      <div className="ctrl-fila-head">
        <h3>Fila ({fila.length}/{maxFila})</h3>
        <span className="ctrl-fila-nota">Entra la #1 al morir otra</span>
      </div>
      {miIdx >= 0 && (
        <div className="ctrl-fila-mia-resumen">
          <span>Tu puesto: <strong>#{miIdx + 1}</strong> de {fila.length}</span>
          <button type="button" className="ctrl-btn-sec" disabled={saliendo} onClick={salir}>
            {saliendo ? 'Saliendo…' : 'Salir de la fila'}
          </button>
        </div>
      )}
      {fila.length === 0 ? (
        <p className="ctrl-vacio">Nadie en espera. Forma la primera para entrar en la próxima vacante.</p>
      ) : (
        <ol className="ctrl-fila-lista">
          {fila.map((f, i) => (
            <li key={`${f.de}-${i}`} className={`ctrl-fila-item${f.mia ? ' mia' : ''}`}>
              <span className="ctrl-fila-num">#{i + 1}</span>
              <span className="ctrl-fila-nom">{f.nombre}</span>
              {i === 0 && <span className="ctrl-tag-sig">Siguiente</span>}
              <span className="ctrl-fila-de">{f.mia ? 'tú' : `#${f.de}`}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
