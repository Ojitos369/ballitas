import { performance } from 'node:perf_hooks'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const runs = Number(process.argv[2] || 3)
const tickCount = Number(process.argv[3] || 1200)
const sourceRoot = resolve(process.argv[4] || 'src')
const buildOnly = process.argv[5] === '--build-only'
const { buildWorld } = await import(pathToFileURL(resolve(sourceRoot, 'Core/world.js')))
const { Sim } = await import(pathToFileURL(resolve(sourceRoot, 'Core/sim.js')))
const buildMs = []
const tickMs = []
let counts

for (let run = 0; run < runs; run++) {
  let t = performance.now()
  const world = buildWorld(369)
  buildMs.push(performance.now() - t)
  counts = { ways: world.ways.length, segments: world.segments.length }
  if (buildOnly) continue

  const sim = new Sim({ seed: 369 })
  // Deja que nazcan y entren al circuito para medir el recorrido con carriles.
  for (let i = 0; i < 120; i++) sim.tick(0.1)
  t = performance.now()
  for (let i = 0; i < tickCount; i++) sim.tick(1 / 60)
  tickMs.push((performance.now() - t) / tickCount)
}

const avg = (xs) => xs.reduce((sum, x) => sum + x, 0) / xs.length
console.log(JSON.stringify({ runs, tickCount, ...counts, buildWorldMs: buildMs, meanBuildWorldMs: avg(buildMs), tickMsPerTick: tickMs, meanTickMs: avg(tickMs) }, null, 2))
