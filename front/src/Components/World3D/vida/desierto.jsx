// Vida del Camino del Desierto: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#fff4dc', bg: 'rgba(86,52,24,0.92)', border: '#ffc46b' }

export default function Vida({ way }) {
  return (
    <group name="vida-desierto">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#6d4c2f" />
      <Soundless />
    </group>
  )
}
