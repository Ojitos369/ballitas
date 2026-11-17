import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim, POP, TIME_SCALE } from './sim.js'
import { mulberry32, cityPath, NODE_R, BALL_R, OBSTACLES, WORLD_SCALE, TUBE_SCALE } from './world.js'

const { world } = new Sim({ rng: mulberry32(1) })

test('nodos: 5 esferas, 4 puertos, 3-8 destinos sobre la red de carreteras', () => {
  assert.equal(world.nodes.length, 5)
  for (const n of world.nodes) {
    assert.equal(n.ports.length, 4)
    assert.ok(n.destinos.length >= 3 && n.destinos.length <= 8)
    for (const v of n.verts) assert.ok(Math.abs(v.pos.distanceTo(n.pos) - NODE_R) < 1e-6)
    for (const p of n.ports) {
      assert.ok(p.in !== p.out && p.wayIn.to === n.idx && p.wayOut.from === n.idx && p.wayOut.to === p.to)
      // desde cualquier entrada se llega por carretera a todo destino y a toda salida
      for (const d of n.destinos) assert.equal(cityPath(n, p.in, d.vert).at(-1), d.vert)
      for (const q of n.ports) assert.equal(cityPath(n, n.destinos[0].vert, q.out).at(-1), q.out)
    }
    assert.equal(new Set(n.destinos.map((d) => d.vert)).size, n.destinos.length)
    assert.ok(n.terminals.length >= 8)
    const termVerts = new Set(n.terminals.map((t) => t.vert))
    assert.equal(termVerts.size, n.terminals.length)
    for (const d of n.destinos) assert.ok(!termVerts.has(d.vert), 'terminal no puede ser destino')
    for (let i = 0; i < n.terminals.length; i++) {
      const t1 = n.terminals[i]
      assert.ok((t1.kind === 'out' && t1.way.from === n.idx && t1.way.to === t1.to) || (t1.kind === 'in' && t1.way.to === n.idx && t1.way.from === t1.to))
      for (let j = i + 1; j < n.terminals.length; j++) {
        const ang = t1.dir.angleTo(n.terminals[j].dir)
        assert.ok(ang >= 0.44, `terminales muy juntos en ${n.name}: ${ang.toFixed(3)} rad`)
      }
    }
  }
  world.destinos.forEach((s) => assert.ok(s.kind === 'puntos' ? s.dp > 0 && s.de < 0 : s.de > 0 && s.dp < 0))
})

test('circuitos: 10 con ida y vuelta, >=2 rutas, >=3 obstáculos distintos por ruta', () => {
  assert.equal(world.circuits.length, 10)
  assert.equal(world.ways.length, 20)
  const seen = new Set()
  for (const c of world.circuits) {
    assert.deepEqual(c.ways.map((w) => w.id), [`${c.a}>${c.b}`, `${c.b}>${c.a}`])
    for (const w of c.ways) {
      assert.ok(w.routes.length >= 2)
      for (const r of w.routes) {
        assert.ok(new Set(r.kinds).size >= 3)
        r.kinds.forEach((k) => seen.add(k))
      }
      // rutas distintas, obstáculos distintos
      assert.notDeepEqual([...w.routes[0].kinds].sort(), [...w.routes[1].kinds].sort())
    }
  }
  assert.deepEqual([...seen].sort(), [...OBSTACLES].sort())
})

test('tramos: continuos, del puerto de salida al de entrada, sin atravesar nodos', () => {
  for (const w of world.ways) {
    const a = world.nodes[w.from]; const b = world.nodes[w.to]
    assert.ok(w.segments[0].curve.getPoint(0).distanceTo(a.verts[a.portTo[w.to].out].pos) < 1e-6)
    for (const s of w.segments) {
      assert.ok(s.length > 0 && s.radius > 0)
      const end = s.curve.getPoint(1)
      if (!s.next.length) assert.ok(end.distanceTo(b.verts[b.portTo[w.from].in].pos) < 1e-6)
      for (const i of s.next) assert.ok(end.distanceTo(w.segments[i].curve.getPoint(0)) < 1e-6)
      for (const p of s.curve.getSpacedPoints(60)) {
        for (const n of world.nodes) {
          // en la salida y la llegada el tubo toca la esfera de su propio nodo
          const own = (s.kind === 'salida' && n === a) || (s.kind === 'llegada' && n === b)
          assert.ok(p.distanceTo(n.pos) > NODE_R + (own ? -0.01 : s.radius), `${w.id} ${s.kind} roza ${n.name}`)
        }
      }
    }
    for (const r of w.routes) assert.ok(r.segments.every((s, i) => i === 0 || r.segments[i - 1].next.includes(s.i)))
  }
})

test('separación 3D: tubos de ways distintos >= 4.0 (fuera de 18u de nodos) y sin atravesar nodos ajenos', () => {
  const STEPS = 28
  const TRIM = 18
  const waySamples = world.ways.map((w) => {
    const pts = []
    for (const s of w.segments) {
      for (let k = 0; k <= STEPS; k++) {
        const u = k / STEPS
        if (s.kind === 'salida' && u * s.length < TRIM) continue
        if (s.kind === 'llegada' && (1 - u) * s.length < TRIM) continue
        pts.push({ p: s.curve.getPointAt(u), r: s.radius, s })
      }
    }
    return pts
  })

  let minClearance = Infinity
  let minPair = ''
  for (let i = 0; i < world.ways.length; i++) {
    const w1 = world.ways[i]
    for (const n of world.nodes) {
      if (n.idx === w1.from || n.idx === w1.to) continue
      for (const s of w1.segments) {
        for (const p of s.curve.getSpacedPoints(30)) {
          const d = p.distanceTo(n.pos)
          assert.ok(d > NODE_R + 6, `${w1.id} ${s.kind} cerca de nodo ajeno ${n.name}: ${d.toFixed(2)}`)
        }
      }
    }
    for (let j = i + 1; j < world.ways.length; j++) {
      const w2 = world.ways[j]
      for (const h1 of w1.junctions) {
        for (const h2 of w2.junctions) {
          assert.ok(h1.pos.distanceTo(h2.pos) >= 24, `hubs cercanos ${w1.id} y ${w2.id}`)
        }
      }
      for (const a of waySamples[i]) {
        for (const b of waySamples[j]) {
          const c = a.p.distanceTo(b.p) - (a.r + b.r)
          if (c < minClearance) { minClearance = c; minPair = `${w1.id}/${a.s.kind} vs ${w2.id}/${b.s.kind}` }
        }
      }
    }
  }
  assert.ok(minClearance >= 4.0, `distancia mínima entre tubos ${minClearance.toFixed(3)} < 4.0 (${minPair})`)
})

test('10 min simulados: población estable, mueren y nacen, evolucionan, sin NaN', () => {
  const sim = new Sim({ rng: mulberry32(7) })
  const kinds = new Set()
  for (let i = 0; i < 6000; i++) {
    sim.tick(0.1)
    assert.ok(sim.bollitas.length <= POP)
    for (const b of sim.bollitas) {
      assert.ok(Number.isFinite(b.pos.x + b.pos.y + b.pos.z + b.p + b.e + b.speed + b.roll), `NaN en ${b.phase}`)
      assert.ok(Math.abs(b.dir.length() - 1) < 1e-3 && Math.abs(b.up.length() - 1) < 1e-3)
      if (b.phase === 'travel') kinds.add(b.seg.kind)
    }
  }
  assert.ok(sim.stats.muertas > 0)
  assert.ok(sim.stats.nacidas > POP)
  assert.ok(sim.stats.genMax > 1)
  assert.ok(sim.stats.mejorEdad > 120, 'una bollita adaptada vive minutos')
  assert.ok(kinds.size >= OBSTACLES.length, 'recorren todo tipo de obstáculo')
})

test('perfiles, eventos por ruta y segment.speedK/event', () => {
  const speeds = new Set()
  const validEvents = new Set(['geiser', 'erupcion', 'cascada', 'turbina', 'hielo_resbaloso', 'pantano', 'portal'])
  for (const w of world.ways) {
    const eventMixes = new Set()
    for (const r of w.routes) {
      assert.ok(r.profile && ['rapida', 'media', 'lenta'].includes(r.profile.speed))
      assert.ok(r.profile.thrill >= 0 && r.profile.thrill <= 1)
      assert.ok(typeof r.profile.label === 'string' && r.profile.label.length > 0)
      speeds.add(r.profile.speed)
      const mix = r.segments.map((s) => s.event).filter(Boolean).sort().join(',')
      assert.ok(mix.length > 0, `ruta ${w.id}/${r.name} sin eventos`)
      assert.ok(!eventMixes.has(mix), `mezcla de eventos repetida en ${w.id}: ${mix}`)
      eventMixes.add(mix)
      for (const s of r.segments) {
        assert.ok(typeof s.speedK === 'number' && s.speedK > 0)
        assert.ok(s.event === null || validEvents.has(s.event))
      }
    }
  }
  assert.ok(speeds.has('rapida') && speeds.has('lenta'), 'hay rutas rápidas y lentas')
})

test('planeación anticipada: b.plan, memoria de rutas y sensibilidad a energía/curiosidad', () => {
  const sim = new Sim({ rng: mulberry32(42) })
  for (let i = 0; i < 400; i++) sim.tick(0.1)
  const withPlan = sim.bollitas.filter((b) => b.plan && b.plan.destino && b.plan.ruta && b.plan.razon)
  assert.ok(withPlan.length >= 5, 'las bollitas generan b.plan con destino, ruta y razon')
  const anyVisited = sim.bollitas.some((b) => Object.keys(b.visitedRoutes).length > 0)
  assert.ok(anyVisited, 'las bollitas registran memoria de rutas visitadas')

  // Una bollita con hambre prefiere destinos de energía en la utilidad
  const b = sim.bollitas[0]
  b.e = 12
  b.genome.traits.apetito = 0.95
  const way = sim.world.waysFrom[b.node][0]
  const dests = sim.world.nodes[way.to].destinos
  const dEnergia = dests.find((d) => d.kind === 'energia')
  const dPuntos = dests.find((d) => d.kind === 'puntos')
  const peers = sim.peerCounts(b)
  const uE = sim.planUtility(b, way, way.routes[0], dEnergia, peers, 1)
  const uP = sim.planUtility(b, way, way.routes[0], dPuntos, peers, 1)
  assert.ok(uE.total > uP.total, 'con poca energía prefiere destino de energía')
})

test('escala del mundo: constantes, radios relativos, 3 obstáculos/mitad y tiempos de viaje 2-3x', () => {
  assert.ok(WORLD_SCALE >= 2.5 && WORLD_SCALE <= 3.0)
  assert.ok(TUBE_SCALE >= 1.6 && TUBE_SCALE <= 2.0)
  assert.ok(TIME_SCALE >= 2.0 && TIME_SCALE <= 3.0)
  for (let i = 0; i < world.nodes.length; i++) {
    for (let j = i + 1; j < world.nodes.length; j++) {
      const d = world.nodes[i].pos.distanceTo(world.nodes[j].pos)
      assert.ok(d >= 200, `nodos muy cerca: ${d.toFixed(1)}`)
    }
  }
  for (const r of world.routes) {
    assert.equal(r.kinds.length, 6, '3 obstáculos por mitad')
    assert.equal(r.segments.length, 8)
    assert.ok(r.segments[2].event && r.segments[5].event, 'evento al centro de cada mitad')
    assert.ok(r.segments[1].radius / BALL_R >= 3.8, 'tubo amplio respecto a la bollita')
  }

  // Medir duración real de viaje por circuito y supervivencia energética
  const sim = new Sim({ rng: mulberry32(19) })
  const entered = new Map()
  const durations = []
  for (let i = 0; i < 3000; i++) {
    for (const b of sim.bollitas) {
      if (b.phase === 'travel' && !entered.has(b.id)) entered.set(b.id, sim.t)
      else if (b.phase !== 'travel' && b.phase !== 'dying' && b.phase !== 'gone' && entered.has(b.id)) {
        durations.push(sim.t - entered.get(b.id))
        entered.delete(b.id)
      }
      if (b.phase === 'dying' || b.phase === 'gone') entered.delete(b.id)
    }
    sim.tick(0.1)
  }
  assert.ok(durations.length >= 10, `pocos viajes completados: ${durations.length}`)
  const avgDur = durations.reduce((s, d) => s + d, 0) / durations.length
  assert.ok(avgDur >= 25 && avgDur <= 65, `duración media de viaje fuera de rango 2-3x: ${avgDur.toFixed(1)}s`)
})
