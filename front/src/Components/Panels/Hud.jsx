const SPEEDS = [[0, '⏸', 'Pausa'], [1, '1×', 'Velocidad normal'], [3, '3×', 'Velocidad triple'], [8, '8×', 'Velocidad por ocho']]

// Mismo tono que el cuerpo 3D de la bollita.
export const colorDe = (b) => `hsl(${Math.round(b.genome.hue * 360)} 75% 60%)`

export default function Hud({ sim, speed, setSpeed, selected, onSelect }) {
  const vivas = sim.bollitas.filter((b) => b.phase !== 'dying' && b.phase !== 'gone')
  const gen = Math.max(0, ...vivas.map((b) => b.gen))
  return (
    <>
      <header className="barra">
        <h1>bollitas</h1>
        <span className="dato">{vivas.length} vivas · gen {gen}</span>
        <div className="velocidad" role="group" aria-label="Velocidad de la simulación">
          {SPEEDS.map(([v, l, a]) => (
            <button key={v} aria-label={a} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{l}</button>
          ))}
        </div>
      </header>
      <nav className="puntos" aria-label="Bollitas">
        {vivas.map((b) => (
          <button key={b.id} className="punto" data-nombre={b.name} aria-label={b.name} aria-pressed={selected === b}
            style={{ background: colorDe(b) }} onClick={() => onSelect(b)} />
        ))}
      </nav>
    </>
  )
}
