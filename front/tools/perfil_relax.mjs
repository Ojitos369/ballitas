// Coste de la reconstrucción con elecciones precalculadas (lo que mide sim.test.js «elecciones precalculadas») y de la
// relajación de cintas dentro de ella.  uso: node tools/perfil_relax.mjs [semillas=369] [repeticiones=3]
import { buildWorld, setWorldPicks } from '../src/Core/world.js'

const seeds = (process.argv[2] ?? '369').split(',').map(Number); const rep = +(process.argv[3] ?? 3)
for (const seed of seeds) {
  const w = buildWorld(seed)
  setWorldPicks(seed, JSON.parse(JSON.stringify(w.picks)))
  const ts = []; let w2
  for (let i = 0; i < rep; i++) { const t = performance.now(); w2 = buildWorld(seed); ts.push(Math.round(performance.now() - t)) }
  console.log(`seed ${seed}: reconstruccion ${ts.join(' / ')} ms; relax ${JSON.stringify(w2.relax)}${w2.relaxT ? ' ' + JSON.stringify(w2.relaxT) : ''}`)
}
