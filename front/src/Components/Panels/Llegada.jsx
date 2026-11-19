import { useRef } from 'react'
import { resolveNodeBiome } from '../World3D/mundos/biomas.js'
import { nodoEnFoco } from '../World3D/mundos/foco.js'

// Rótulo de llegada: al entrar la ballita seguida a un planeta, un tercio superior discreto con el nombre del
// planeta y su bioma. Aparece 0.3 s, se queda ~2.5 s y se va en 0.5 s (animación CSS; sin movimiento con
// prefers-reduced-motion). Se vuelve a montar (key) en cada entrada.
export default function Llegada({ b, world }) {
  const st = useRef({ nodo: -1, id: null, n: 0 })
  const nodo = nodoEnFoco(b)
  const s = st.current
  if (nodo !== s.nodo || b.id !== s.id) {
    if (nodo >= 0) s.n++
    s.nodo = nodo
    s.id = b.id
  }
  if (nodo < 0) return null
  const node = world.nodes[nodo]
  const biome = resolveNodeBiome(node, world)
  return (
    <div className="llegada" key={s.n} role="status" aria-live="polite" style={{ '--acento': biome.atmoRim }}>
      <span className="llegada-emoji" aria-hidden="true">{biome.emoji}</span>
      <span className="llegada-txt">
        <b>{node.name}</b>
        <small>{biome.title}</small>
      </span>
    </div>
  )
}
