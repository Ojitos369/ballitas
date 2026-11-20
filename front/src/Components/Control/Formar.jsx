import { useState } from 'react'

const ERRORES = {
  ya_en_fila: 'Ya tienes una ballita en la fila.',
  fila_llena: 'La fila está llena por ahora.',
  nombre: 'Escribe de 1 a 16 caracteres (letras, números, espacio, _ o -).',
  sin_soporte: 'El modo actual no permite formar ballitas.',
}

function nombreInicial(mundo) {
  try {
    const guardado = localStorage.getItem('ballitas:nombre')
    if (guardado && guardado.trim()) return guardado.trim().slice(0, mundo?.reglas?.maxNombre ?? 16)
  } catch {}
  return mundo?.nombreSugerido?.() || 'Bolita'
}

export default function Formar({ mundo, miBallita, miEnFila, miPuesto }) {
  const maxNombre = mundo?.reglas?.maxNombre ?? 16
  const [nombre, setNombre] = useState(() => nombreInicial(mundo))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')

  const sugerirOtro = () => {
    setError('')
    setNombre(mundo.nombreSugerido())
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    if (enviando) return
    const limpio = nombre.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, maxNombre)
    if (!limpio) {
      setError(ERRORES.nombre)
      return
    }
    setEnviando(true)
    setError('')
    try {
      const res = await mundo.formar(limpio)
      if (!res?.ok) {
        setError(ERRORES[res?.error] || 'No se pudo formar la ballita.')
      } else {
        try { localStorage.setItem('ballitas:nombre', limpio) } catch {}
      }
    } finally {
      setEnviando(false)
    }
  }

  if (miEnFila) {
    return (
      <div className="ctrl-formar-estado" role="status">
        <span>Estás en la fila con <strong>{miEnFila.nombre}</strong></span>
        <span className="ctrl-badge-puesto">Puesto #{miPuesto}</span>
      </div>
    )
  }

  return (
    <form className="ctrl-formar" onSubmit={onSubmit}>
      <label className="ctrl-label" htmlFor="ctrl-nombre-input">
        Forma tu ballita
      </label>
      <div className="ctrl-formar-row">
        <input
          id="ctrl-nombre-input"
          className="ctrl-input"
          type="text"
          maxLength={maxNombre}
          value={nombre}
          placeholder="Nombre de tu ballita"
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setNombre(e.target.value)
            if (error) setError('')
          }}
        />
        <button
          type="button"
          className="ctrl-btn-icon"
          onClick={sugerirOtro}
          title="Sugerir otro nombre"
          aria-label="Sugerir otro nombre"
        >
          🎲
        </button>
        <button
          type="submit"
          className="ctrl-btn-primario"
          disabled={enviando}
        >
          {enviando ? 'Enviando…' : 'Formar'}
        </button>
      </div>
      {miBallita && (
        <p className="ctrl-ayuda">
          Ya controlas a <b>{miBallita.name}</b>; si formas otra ahora, nacerá sin controlador salvo que sueltes antes la actual.
        </p>
      )}
      {error && <p className="ctrl-error" role="alert">{error}</p>}
    </form>
  )
}
