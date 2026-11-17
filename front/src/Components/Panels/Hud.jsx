import ListaBallitas from './ListaBallitas.jsx'

const SPEEDS = [[0, '⏸', 'Pausa'], [1, '1×', 'Velocidad normal'], [3, '3×', 'Velocidad triple'], [8, '8×', 'Velocidad por ocho']]

// Mismo tono que el cuerpo 3D de la ballita.
export const colorDe = (b) => `hsl(${Math.round(b.genome.hue * 360)} 75% 60%)`

export default function Hud({ sim, speed, setSpeed, selected, onSelect, follow, onFollowBallita, cine, onToggleCine }) {
  const vivas = sim.ballitas.filter((b) => b.phase !== 'dying' && b.phase !== 'gone')
  const gen = Math.max(0, ...vivas.map((b) => b.gen))
  return (
    <>
      <header className="barra">
        <h1>ballitas</h1>
        <span className="dato">{vivas.length} vivas · gen {gen}</span>
        <ListaBallitas sim={sim} vivas={vivas} selected={selected} onSelect={onSelect} follow={follow} onFollow={onFollowBallita} />
        <div className="velocidad" role="group" aria-label="Velocidad de la simulación">
          {SPEEDS.map(([v, l, a]) => (
            <button key={v} aria-label={a} aria-pressed={speed === v} onClick={() => setSpeed(v)}>{l}</button>
          ))}
        </div>
        <button
          className="cine-btn"
          aria-pressed={cine}
          onClick={onToggleCine}
          title="Modo cine (tecla C)"
          aria-label="Modo cine (tecla C)"
        >
          🎬 Cine <kbd>C</kbd>
        </button>
      </header>
      <nav className="puntos" aria-label="Ballitas">
        {vivas.map((b) => (
          <button key={b.id} className="punto" data-nombre={b.name} aria-label={b.name} aria-pressed={selected === b}
            style={{ background: colorDe(b) }} onClick={() => onSelect(b)} />
        ))}
      </nav>
    </>
  )
}
