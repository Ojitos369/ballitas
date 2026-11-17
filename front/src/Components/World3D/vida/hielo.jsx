// Vida del Camino de Hielo: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#f2fbff', bg: 'rgba(30,58,86,0.9)', border: '#9fe6ff' }

export default function Vida({ way }) {
  return (
    <group name="vida-hielo">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#5d7a92" />
      <Soundless />
    </group>
  )
}
