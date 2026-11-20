import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { writeFileSync } from 'node:fs'
import { createServer } from 'vite'
const front = resolve(process.argv[2] || '.')
const output = resolve(process.argv[3] || '_capturas/det/medicion.json')
const server = await createServer({ root: front, configFile: resolve(front, 'vite.config.js'), server: { middlewareMode: true, watch: { ignored: ['**/_capturas/**'] } }, appType: 'custom', logLevel: 'error' })
try {
  const { buildWorld } = await import(pathToFileURL(resolve(front, 'src/Core/world.js')).href)
  const place = await server.ssrLoadModule('/src/Components/World3D/vida/colocacion.js')
  const decor = await server.ssrLoadModule('/src/Components/World3D/vida/decor.jsx')
  const paisaje = await server.ssrLoadModule('/src/Components/World3D/vida/paisaje.jsx')
  const world = buildWorld(369)
  const structuralVolumes = place.colocarTodoMundo(world)
  const stride = (a, n) => a.length <= n ? a : Array.from({ length: n }, (_, i) => a[Math.floor(i * a.length / n)])
  const gaps = (points, length) => {
    const sorted = points.slice().sort((a, b) => a - b); const out = []; let prev = 0
    for (const x of sorted) { if (x - prev > 150) out.push([+prev.toFixed(1), +x.toFixed(1), +(x-prev).toFixed(1)]); prev = x }
    if (length-prev > 150) out.push([+prev.toFixed(1), +length.toFixed(1), +(length-prev).toFixed(1)])
    return out
  }
  const ways = []
  for (const way of world.ways) {
    const coverage = decor.datosDecoracionMedidos(way)
    const decorAll = coverage.flatMap(seg => seg.decor.map(x => ({ ...x, si: seg.si })))
    const floraAll = coverage.flatMap(seg => seg.flora.map(x => ({ ...x, si: seg.si })))
    const baseDecor = stride(decorAll, 150)
    const baseFlora = stride(floraAll, 200)
    const segments = coverage.map(seg => ({
      si: seg.si, length: +seg.length.toFixed(1), descartes: seg.descartes,
      lanes: seg.lanes.map(l => {
        const d = seg.decor.filter(x => x.lane === l.lane).map(x => x.s)
        const f = seg.flora.filter(x => x.lane === l.lane).map(x => x.s)
        const bd = baseDecor.filter(x => x.si === seg.si && x.lane === l.lane).map(x => x.s)
        const bf = baseFlora.filter(x => x.si === seg.si && x.lane === l.lane).map(x => x.s)
        return { lane: l.lane, decor: d.length, flora: f.length, baseDecor: bd.length, baseFlora: bf.length,
          decorGaps150: gaps(d, seg.length), floraGaps150: gaps(f, seg.length), baseDecorGaps150: gaps(bd, seg.length), baseFloraGaps150: gaps(bf, seg.length) }
      }),
    }))
    const landscape = paisaje.datosPaisajeMedidos(way)
    const particles = landscape.flatMap(seg => seg.layers.map(layer => {
      const lanes = (way.segments[seg.si].lanes ?? []).map(lane => {
        const points = layer.items.filter(x => x.lane === lane.id).map(x => x.s)
        return { lane: lane.id, count: points.length, gaps150: gaps(points, seg.length) }
      })
      return { si: seg.si, geo: layer.geo, legacyCap: layer.cap, capacity: layer.capacity, count: layer.items.length, lanes }
    }))
    ways.push({ way: way.idx, theme: way.theme.id, length: Math.round(way.segments.filter(s => !s.air).reduce((n, s) => n + s.length, 0)),
      candidatesDecor: decorAll.length, candidatesFlora: floraAll.length, baseDecorPlaced: baseDecor.length, baseFloraPlaced: baseFlora.length,
      segments, particles })
  }
  const result = { seed: 369, routes: ways.length, structuralVolumes: structuralVolumes.length, placementStats: place.STATS, ways }
  writeFileSync(output, JSON.stringify(result, null, 1))
  const summary = ways.map(w => ({ way:w.way, theme:w.theme, length:w.length, decor:w.candidatesDecor, flora:w.candidatesFlora,
    baseGaps:w.segments.reduce((n,s)=>n+s.lanes.filter(l=>l.baseDecorGaps150.length||l.baseFloraGaps150.length).length,0),
    afterGaps:w.segments.reduce((n,s)=>n+s.lanes.filter(l=>l.decorGaps150.length||l.floraGaps150.length).length,0),
    particles:w.particles.reduce((n,p)=>n+p.count,0), particleGaps:w.particles.reduce((n,p)=>n+p.lanes.filter(l=>l.gaps150.length).length,0) }))
  console.log(JSON.stringify({ output, seed:result.seed, routes:summary, structuralVolumes:result.structuralVolumes, placementStats:result.placementStats }))
} finally { await server.close() }
