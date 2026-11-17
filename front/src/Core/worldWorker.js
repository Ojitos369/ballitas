// Corre la búsqueda de huecos (lo caro de buildWorld) fuera del hilo principal y devuelve sólo las elecciones.
import { buildWorld } from './world.js'

self.onmessage = ({ data: { seed } }) => {
  const w = buildWorld(seed, (n) => self.postMessage({ progress: n }))
  self.postMessage({ picks: w.picks })
}
