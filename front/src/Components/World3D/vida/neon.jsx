// Vida del Camino Neón: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#ffffff', bg: 'rgba(12,6,28,0.94)', border: '#ff3df2', subColor: '#3df8ff' }

export default function Vida({ way }) {
  return (
    <group name="vida-neon">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#22203a" />
      <Soundless />
    </group>
  )
}
