// Vida del Camino del Mar: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#e6fbff', bg: 'rgba(10,40,66,0.92)', border: '#4fe3ff' }

export default function Vida({ way }) {
  return (
    <group name="vida-mar">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#2b4a5e" />
      <Soundless />
    </group>
  )
}
