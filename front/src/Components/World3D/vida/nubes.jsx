// Vida del Camino de las Nubes: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#ffffff', bg: 'rgba(84,120,170,0.88)', border: '#fff59d' }

export default function Vida({ way }) {
  return (
    <group name="vida-nubes">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#c9d6ea" />
      <Soundless />
    </group>
  )
}
