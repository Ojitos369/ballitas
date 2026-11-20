// Huella del estado de la sim sin entradas (condición de aceptación de docs/mundo_compartido.md, sección 4):
//   node back/mundo/huella.mjs [semilla=369] [ticks=18000]
// La huella no incluye fila ni control: así se compara con la sim anterior a los cambios del mundo compartido.
import { createHash } from 'node:crypto'
import { Sim } from '../../front/src/Core/sim.js'
import { mulberry32 } from '../../front/src/Core/world.js'

export function huella(sim) {
  return createHash('sha1').update(JSON.stringify({
    t: sim.t, stats: sim.stats, pool: sim.pool.map((x) => [x.id, x.fitness]), feed: sim.feed,
    b: sim.ballitas.map((b) => [b.id, b.name, b.phase, b.p, b.e, b.age, b.pos.x, b.pos.y, b.pos.z, b.seg?.idx ?? -1, b.segT, b.lane, b.carril, b.plan?.razon ?? null]),
  })).digest('hex').slice(0, 16)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const semilla = Number(process.argv[2] || 369); const ticks = Number(process.argv[3] || 18000)
  const sim = new Sim({ rng: mulberry32(semilla), seed: semilla })
  for (let n = 0; n < ticks; n++) sim.tick(1 / 30)
  console.log(JSON.stringify({ semilla, ticks, huella: huella(sim), nacidas: sim.stats.nacidas, muertas: sim.stats.muertas }))
}
