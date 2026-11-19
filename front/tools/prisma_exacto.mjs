// Exactitud de la rejilla perezosa del prisma libre (world.prismaLibre) frente a la global (prismaLibreGlobal):
// mismo veredicto para cada pieza colocada y para sondas desplazadas e infladas alrededor de cada una (positivos y
// negativos). Uso: node tools/prisma_exacto.mjs [semilla=1]
import * as W from '../src/Core/world.js'
import * as C from '../src/Components/World3D/vida/colocacion.js'

const seed = +(process.argv[2] ?? 1)
const w = W.buildWorld(seed)
const items = C.colocarTodoMundo(w)
const S = W.clearanceSamples(w)
let n = 0; let diff = 0; let pos = 0
const t0 = performance.now()
for (const it of items) {
  for (const [dx, dy, k] of [[0, 0, 1], [0, 0, 2.5], [6, 0, 1.5], [-6, 3, 1.5], [0, -8, 2], [15, 10, 3]]) {
    const c = { x: it.center.x + dx * W.TRACK_K, y: it.center.y + dy * W.TRACK_K, z: it.center.z - dx * W.TRACK_K }
    const a = W.prismaLibre(w, c, it.r * k, it); const b = W.prismaLibreGlobal(w, c, it.r * k, it, S)
    n++; if (a !== b) diff++; if (!b) pos++
  }
}
console.log(`prisma exacto semilla ${seed}: consultas ${n}, invaden ${pos}, diferencias ${diff}, fuera de caja ${W.PRISMA_STATS.fueraCaja}, muestras perezosas ${W.PRISMA_STATS.muestras}/${S.X.length}, ${(performance.now() - t0).toFixed(0)} ms`)
process.exit(diff || W.PRISMA_STATS.fueraCaja ? 1 : 0)
