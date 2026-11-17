// Vida del Camino del Volcán: mini mundo dentro del tubo (contrato en README.md).
import { CartelesDeRuta, Soundless } from './base.jsx'

const ESTILO = { color: '#fff1e6', bg: 'rgba(48,16,10,0.93)', border: '#ff7043' }

export default function Vida({ way }) {
  return (
    <group name="vida-volcan">
      <CartelesDeRuta way={way} style={ESTILO} poleColor="#3b2620" />
      <Soundless />
    </group>
  )
}
