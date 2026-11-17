// Vida del Camino del Jardín: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#fff7fb', bg: 'rgba(70,40,58,0.9)', border: '#ff9ccf', subColor: '#b9f6a0' }

export default function Vida({ way }) {
  return (
    <group name="vida-jardin">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#5b4636" />
      <Soundless />
    </group>
  )
}
