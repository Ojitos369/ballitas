// Vida del Camino del Bosque: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#f4ffe0', bg: 'rgba(38,58,30,0.92)', border: '#9cff6b' }

export default function Vida({ way }) {
  return (
    <group name="vida-bosque">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#4e342e" />
      <Soundless />
    </group>
  )
}
