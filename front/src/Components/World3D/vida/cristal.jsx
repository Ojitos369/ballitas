// Vida del Camino de Cristal: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#fdf0ff', bg: 'rgba(40,22,64,0.88)', border: '#ea80fc' }

export default function Vida({ way }) {
  return (
    <group name="vida-cristal">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#6a5a86" />
      <Soundless />
    </group>
  )
}
