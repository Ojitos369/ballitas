// Vida del Camino Sombrío: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#e9dcff', bg: 'rgba(26,18,44,0.92)', border: '#b784ff' }

export default function Vida({ way }) {
  return (
    <group name="vida-sombrio">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#2a2238" />
      <Soundless />
    </group>
  )
}
