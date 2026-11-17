import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim, POP, TIME_SCALE, TRAVEL_SLOW } from './sim.js'
import { voice } from './personality.js'
import { actualizarDialogoVivo, elegirDialogo, obtenerGlobo } from './dialogos.js'
import {
  mulberry32, cityPath, NODE_R, BALL_R, OBSTACLES, WORLD_SCALE, TUBE_SCALE,
  MECHANISMS, THEME_MECHS, wallFrame, laneFrame, laneAngle, nearestLane, angDiff, segmentTangent,
  laneRelief, reliefSlope, OUT_GATES, IN_GATES, SPHERE_R, buildWorld, setWorldPicks,
} from './world.js'

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

test('separación 3D: tubos de ways distintos >= 3.0 (fuera de 18u de nodos) y sin atravesar nodos ajenos', () => {
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
  assert.ok(minClearance >= 3.0, `distancia mínima entre tubos ${minClearance.toFixed(3)} < 3.0(${minPair})`)
})

test('10 min simulados: población estable, mueren y nacen, evolucionan, sin NaN', () => {
  const sim = new Sim({ rng: mulberry32(7) })
  const kinds = new Set()
  // el viaje va en cámara lenta (TRAVEL_SLOW): 10 min de simulación equivalen a ~18 min reales
  for (let i = 0; i < Math.round(6000 / TRAVEL_SLOW); i++) {
    sim.tick(0.1)
    assert.ok(sim.ballitas.length <= POP)
    for (const b of sim.ballitas) {
      assert.ok(Number.isFinite(b.pos.x + b.pos.y + b.pos.z + b.p + b.e + b.speed + b.roll), `NaN en ${b.phase}`)
      assert.ok(Math.abs(b.dir.length() - 1) < 1e-3 && Math.abs(b.up.length() - 1) < 1e-3)
      if (b.phase === 'travel') kinds.add(b.seg.kind)
    }
  }
  assert.ok(sim.stats.muertas > 0)
  assert.ok(sim.stats.nacidas > POP)
  assert.ok(sim.stats.genMax > 1)
  assert.ok(sim.stats.mejorEdad > 120, 'una ballita adaptada vive minutos')
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
  const withPlan = sim.ballitas.filter((b) => b.plan && b.plan.destino && b.plan.ruta && b.plan.razon)
  assert.ok(withPlan.length >= 5, 'las ballitas generan b.plan con destino, ruta y razon')
  const anyVisited = sim.ballitas.some((b) => Object.keys(b.visitedRoutes).length > 0)
  assert.ok(anyVisited, 'las ballitas registran memoria de rutas visitadas')

  // Una ballita con hambre prefiere destinos de energía en la utilidad
  const b = sim.ballitas[0]
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
  assert.ok(TIME_SCALE >= 4.0 && TIME_SCALE <= 5.0)
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
    assert.ok(r.segments[1].radius / BALL_R >= 3.8, 'tubo amplio respecto a la ballita')
  }

  // Medir duración real de viaje por circuito y supervivencia energética
  const sim = new Sim({ rng: mulberry32(19) })
  const entered = new Map()
  const durations = []
  for (let i = 0; i < 3000; i++) {
    for (const b of sim.ballitas) {
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
  assert.ok(avgDur >= 45 && avgDur <= 117, `duración media de viaje fuera de rango 2-3x: ${avgDur.toFixed(1)}s`)
})

test('carriles: contrato de lanes/switches, marcos sobre la pared sin saltos y todos conectan', () => {
  for (const w of world.ways) {
    const themeKeys = new Set(Object.keys(THEME_MECHS[w.theme.id]))
    for (const s of w.segments) {
      const ids = s.lanes.map((l) => l.id)
      assert.ok(ids.length >= 2 && ids.length <= 4 && ids.includes(0) && new Set(ids).size === ids.length, `${w.id} ${s.kind} carriles`)
      if (s.air || s.kind === 'salida' || s.kind === 'llegada') assert.equal(ids.length, 4)
      for (const l of s.lanes) assert.ok(l.angle >= 0 && l.angle < Math.PI * 2 && l.width > 0 && Number.isFinite(l.offset))
      for (const sw of s.switches) {
        assert.ok(ids.includes(sw.from) && ids.includes(sw.to) && sw.from !== sw.to, `${w.id} ${s.kind} switch ${sw.from}->${sw.to}`)
        assert.ok(MECHANISMS[sw.kind], `mecanismo desconocido ${sw.kind}`)
        assert.ok(sw.kind === s.event || sw.kind === s.kind || themeKeys.has(sw.kind), `${sw.kind} no pertenece al tramo ${s.kind} de ${w.theme.id}`)
        assert.ok(sw.u > 0 && sw.u <= sw.uEnd && sw.uEnd <= 1 && sw.duration > 0)
        assert.ok(['salto', 'pared', 'portal'].includes(sw.style) && sw.reward && sw.fail >= 0 && sw.fail < 0.5)
      }
      if (s.event) assert.ok(s.switches.some((sw) => sw.kind === s.event), `el evento ${s.event} es un mecanismo de cambio`)

      // marco sobre la pared: up unitario hacia el eje, perpendicular a la tangente, sin saltos al avanzar
      for (const l of s.lanes) {
        let prev = null
        for (let k = 0; k <= 120; k++) {
          const u = k / 120
          const F = laneFrame(s, l.id, u)
          F.axisT = segmentTangent(s, u)
          assert.ok(Math.abs(F.up.length() - 1) < 1e-6 && Math.abs(F.up.dot(F.tangent)) < 1e-6)
          assert.ok(Math.abs(F.wall.distanceTo(F.axis) - s.radius) < 1e-6)
          assert.ok(Math.abs(F.pos.distanceTo(F.axis) - (s.air ? 0 : s.radius - BALL_R - F.relief)) < 1e-6)
          if (!s.air) assert.ok(F.up.dot(F.axis.clone().sub(F.pos)) > 0, 'up apunta al eje')
          if (prev) {
            const turn = prev.axisT.angleTo(F.axisT) // giro del eje (la tangente de la superficie incluye el relieve)
            const frameTurn = prev.dir.angleTo(F.dir)
            assert.ok(frameTurn <= turn * 1.3 + 0.1,`${w.id} ${s.kind} carril ${l.id}: salto del marco en u=${u.toFixed(3)} (marco=${frameTurn.toFixed(3)}, tangente=${turn.toFixed(3)})`)
          }
          prev = F
        }
      }
      // continuidad de la pared entre tramos con tangente continua (uniones fork/cross/merge incluidas)
      for (const i of s.next) {
        const n = w.segments[i]
        if (s.curve.getTangentAt(1).angleTo(n.curve.getTangentAt(0)) > 0.05) continue
        for (const l of s.lanes) {
          const a = laneAngle(s, l.id, 1)
          const d = wallFrame(s, a, 1, s.radius - BALL_R).pos.distanceTo(wallFrame(n, a, 0, n.radius - BALL_R).pos)
          assert.ok(d < 0.3, `${w.id} ${s.kind}->${n.kind}: la pared salta ${d.toFixed(3)}`)
        }
      }
    }
    // todos los carriles conectan: desde el suelo de la salida se alcanza cada carril de cada tramo
    const key = (s, id) => `${s.i}:${id}`
    const seen = new Set([key(w.segments[0], 0)]); const q = [[w.segments[0], 0]]
    while (q.length) {
      const [s, id] = q.pop()
      const push = (t, tid) => { if (!seen.has(key(t, tid))) { seen.add(key(t, tid)); q.push([t, tid]) } }
      for (const sw of s.switches) if (sw.from === id) push(s, sw.to)
      for (const i of s.next) {
        const n = w.segments[i]
        const to = nearestLane(n, laneAngle(s, id, 1))
        assert.ok(n.lanes.some((l) => l.id === to))
        push(n, to)
      }
    }
    for (const s of w.segments) for (const l of s.lanes) assert.ok(seen.has(key(s, l.id)), `${w.id} ${s.kind}: carril ${l.id} inalcanzable`)
  }
})

test('la simulación mantiene energía y puntos en el rango visible al morir', () => {
  const sim = new Sim({ rng: mulberry32(301), pop: 1 })
  const b = sim.ballitas[0]
  b.e = -2
  b.p = -3
  sim.step(b, 0)
  assert.equal(b.e, 0)
  assert.equal(b.p, 0)
  assert.equal(b.phase, 'dying')
})

test('goDest descarta destinos letales si existe una alternativa viable', () => {
  const sim = new Sim({ rng: mulberry32(302), pop: 1 })
  const b = sim.ballitas[0]
  const destinos = sim.world.nodes[b.node].destinos
  const letal = destinos[0]
  for (const d of destinos) { d.dp = 20; d.de = 20; b.genome.prefs[d.idx] = 0 }
  letal.dp = -100
  letal.de = -100
  b.genome.prefs[letal.idx] = 1
  sim.goDest(b)
  assert.notEqual(b.dest, letal)
})

test('al cruzar de segmento se cancela un switch activo y se elige un carril válido', () => {
  const sim = new Sim({ rng: mulberry32(303), pop: 1 })
  const b = sim.ballitas[0]
  const way = sim.world.ways.find((w) => w.segments.some((s) => s.next.length))
  const prev = way.segments.find((s) => s.next.length)
  const next = way.segments[prev.next[0]]
  b.way = way
  b.route = null
  b.phase = 'travel'
  b.seg = prev
  b.rail = 1
  b.sw = { to: 999, t: 0.8, dur: 2 }
  b.ang = 1
  sim.enterSeg(b, next)
  assert.equal(b.sw, null)
  assert.ok(next.lanes.some((lane) => lane.id === b.lane))
})

test('wallFrame sanea un avance NaN sin contaminar el marco', () => {
  const seg = world.ways[0].segments[0]
  const frame = wallFrame(seg, 0, Number.NaN)
  assert.ok(Number.isFinite(frame.pos.x + frame.pos.y + frame.pos.z))
  assert.ok(Math.abs(frame.tangent.length() - 1) < 1e-6)
})

test('voice cubre todos los eventos emitidos por la simulación y contextualiza carril/falla', () => {
  const sim = new Sim({ rng: mulberry32(304), pop: 1 })
  const b = sim.ballitas[0]
  for (const event of ['geiser', 'erupcion', 'turbina', 'hielo_resbaloso', 'pantano', 'portal', 'cascada', 'carril', 'falla']) {
    const result = voice(b, event, { m: 'el mecanismo' }, () => 0)
    assert.ok(result.text.length > 0)
    assert.ok(result.emoji)
    if (event === 'carril' || event === 'falla') assert.match(result.text, /el mecanismo/)
  }
})

test('un pensamiento de tramo WOW no se reemplaza al siguiente ciclo de diálogo', () => {
  const sim = new Sim({ rng: mulberry32(305), pop: 1 })
  const b = sim.ballitas[0]
  b.phase = 'travel'
  b.seg = sim.world.ways[0].segments.find((s) => s.kind === 'rizo')
  b.way = sim.world.ways[0]
  const state = {}
  actualizarDialogoVivo(b, sim, state)
  b.thought = { text: '¡Rizo!', emoji: '➰', until: sim.t + 3 }
  const first = actualizarDialogoVivo(b, sim, state)
  const second = actualizarDialogoVivo(b, sim, state)
  assert.equal(second, first)
})

test('los globos se aíslan por instancia de Sim aunque se repitan los id de ballita', () => {
  const a = new Sim({ rng: mulberry32(306), pop: 1 })
  const b = new Sim({ rng: mulberry32(307), pop: 1 })
  a.ballitas[0].thought = { text: 'globo A', until: 10 }
  b.ballitas[0].thought = { text: 'globo B', until: 10 }
  actualizarDialogoVivo(a.ballitas[0], a, {})
  actualizarDialogoVivo(b.ballitas[0], b, {})
  assert.equal(a.ballitas[0].id, b.ballitas[0].id)
  assert.equal(obtenerGlobo(a.ballitas[0], a).text, 'globo A')
  assert.equal(obtenerGlobo(b.ballitas[0], b).text, 'globo B')
})

test('los eventos críticos no usan líneas ociosas de la personalidad', () => {
  const sim = new Sim({ rng: mulberry32(308), pop: 1 })
  const b = sim.ballitas[0]
  b.arch = { key: 'valentia', hi: true }
  const result = elegirDialogo(b, 'muere', {}, () => 0)
  assert.match(result.text, /Adi[oó]s|apago|Buenas noches|pr[oó]xima generaci[oó]n/)
})

test('ballita en carril: pegada al firme, sin atravesar el cristal ni salir del carril, continua, usa y falla mecanismos', () => {
  const sim = new Sim({ rng: mulberry32(5) })
  const DT = 0.02
  const prev = new Map()
  const used = new Set()
  let starts = 0; let fails = 0; let tube = 0; let glued = 0; let ceiling = 0
  let flights = 0; let impacts = 0; let edges = 0; let climbSlow = 0
  for (let i = 0; i < 6000; i++) {
    sim.tick(DT)
    for (const b of sim.ballitas) {
      const p = prev.get(b.id)
      if (b.phase !== 'travel') { prev.delete(b.id); continue }
      const s = b.seg
      assert.ok(Number.isFinite(b.ang + b.off + b.rail), 'carril sin NaN')
      if (b.sw && (!p || p.sw !== b.sw)) { starts++; used.add(b.sw.s.kind) }
      if (b.sw?.failed && !(p && p.failed)) fails++
      if (b.snap <= 0) {
        const axis = s.curve.getPointAt(b.segT)
        const d = b.pos.distanceTo(axis)
        assert.ok(Math.abs(d - b.off) < 1e-3, `posición fuera de su marco de pared en ${s.kind} u=${b.segT.toFixed(4)} (${d.toFixed(3)} vs ${b.off.toFixed(3)})`)
        if (!s.air) {
          assert.ok(d + BALL_R <= s.radius + 1e-3, `atraviesa el cristal en ${s.kind}: ${(d + BALL_R).toFixed(3)} > ${s.radius}`)
          if (!b.sw) {
            tube++
            const h = laneRelief(s, b.lane, b.segT)
            const R = s.radius - BALL_R
            // nunca por debajo del firme (relieve) cuando ya va pegada a su pared
            if (b.rail >= R - 1e-3) assert.ok(d <= R - h + 1e-6, `bajo el firme en ${s.kind}: ${d.toFixed(3)} > ${(R - h).toFixed(3)}`)
            // nunca sale del carril: el desvío lateral queda dentro de sus bordes
            const lane = s.lanes.find((l) => l.id === b.lane)
            assert.ok(Math.abs(b.lat) <= lane.width / 2 + 1e-9, `se sale del carril: ${b.lat.toFixed(3)}`)
            if (b.onLane) assert.ok(Math.abs(angDiff(b.ang, laneAngle(s, b.lane, b.segT) + b.lat / R)) < 1e-6, 'fuera de la canaleta')
            if (!b.airborne && Math.abs(d - (R - h)) < 0.1) glued++
            if (b.airborne && !(p && p.airborne)) flights++
            if (b.edge) edges++
            if (b.slope > 0.15 && p && p.seg === s && b.speed < p.speed) climbSlow++
            if (Math.abs(angDiff(b.ang, Math.PI)) < 0.6) ceiling++
          }
        }
      }
      if (p && p.way === b.way) {
        assert.ok(Math.abs(angDiff(p.ang, b.ang)) < 1.5, `salto de ángulo ${angDiff(p.ang, b.ang).toFixed(3)} en ${s.kind}`)
        assert.ok(Math.abs(p.off - b.off) < 1, `salto radial ${p.off} -> ${b.off} (${p.seg.kind} -> ${s.kind})`)
        // (en esquinas cerradas el punto de la pared barre más rápido que el eje: se excluyen)
        if (p.seg === s && p.snap <= 0 && b.snap <= 0 && !['embudo', 'cascada', 'horquilla'].includes(s.kind)) {
          assert.ok(p.pos.distanceTo(b.pos) < 4.5,`salto de posición ${p.pos.distanceTo(b.pos).toFixed(3)} en ${s.kind}`)
        }
      }
      if (b.impact > 0.2 && !(p && p.impact > 0.2)) impacts++
      assert.ok(Number.isFinite(b.hy + b.vy + b.lat + b.latV + b.slope + b.impact) && b.impact >= 0 && b.impact <= 1)
      prev.set(b.id, { way: b.way, seg: s, ang: b.ang, off: b.off, snap: b.snap, pos: b.pos.clone(), sw: b.sw, failed: !!b.sw?.failed, airborne: b.airborne, impact: b.impact, speed: b.speed })
    }
  }
  assert.ok(tube > 0 && glued / tube > 0.75, `pegada al firme sólo ${(100 * glued / tube).toFixed(1)}% del tiempo`)
  assert.ok(flights >= 5, `pocos despegues en crestas/saltos: ${flights}`)
  assert.ok(impacts >= 5, `pocos aterrizajes/choques: ${impacts}`)
  assert.ok(edges > 0, 'alguna vez roza el borde del carril en una curva')
  assert.ok(climbSlow > 0, 'cuesta arriba pierde velocidad')
  assert.ok(starts >= 20, `pocos cambios de carril: ${starts}`)
  assert.ok(used.size >= 6, `pocos tipos de mecanismo: ${[...used].join(',')}`)
  assert.ok(fails >= 1, 'algún mecanismo falla')
  assert.ok(ceiling > 0, 'alguna vez rueda por el techo')
})

test('trazado tipo circuito: sin cambios de signo de curvatura de alta frecuencia', () => {
  // cuenta, por cada 100 u, cuántas veces la curvatura (|k| > 1/120) invierte su dirección
  const flipsOf = (s) => {
    const n = Math.max(8, Math.ceil(s.length / 1.5)); const pts = s.curve.getSpacedPoints(n)
    let last = null; let f = 0
    for (let i = 1; i < n; i++) {
      const t1 = pts[i].clone().sub(pts[i - 1]); const t2 = pts[i + 1].clone().sub(pts[i])
      const ds = (t1.length() + t2.length()) / 2
      const k = t2.normalize().sub(t1.normalize()).divideScalar(ds)
      if (k.length() < 1 / 120) continue
      k.normalize()
      if (last && last.dot(k) < -0.2) f++
      last = k
    }
    return f
  }
  for (const w of world.ways) {
    let F = 0; let L = 0
    for (const s of w.segments) { F += flipsOf(s); L += s.length }
    assert.ok((100 * F) / L <= 1.5, `${w.id}: ${((100 * F) / L).toFixed(2)} cambios de signo de curvatura cada 100 u`)
  }
  assert.ok(!OBSTACLES.includes('zigzag'), 'ya no hay obstáculo zigzag')
})

test('cambio de carril sólo por eventos: 5 min simulados, todo cambio ocurre dentro de un switch', () => {
  const sim = new Sim({ rng: mulberry32(11) })
  const prev = new Map(); let changes = 0; let free = 0
  for (let i = 0; i < 15000; i++) { // 300 s a 0.02
    sim.tick(0.02)
    for (const b of sim.ballitas) {
      const p = prev.get(b.id)
      if (b.phase !== 'travel') { prev.delete(b.id); continue }
      if (p && p.seg === b.seg && p.lane !== b.lane) {
        changes++
        if (!b.sw && !p.sw) free++ // en curso: inicio, caída por fallo o final del mecanismo
        if (b.sw && !p.sw) assert.ok(b.segT >= b.sw.s.u - 0.02 && b.segT <= b.sw.s.uEnd + 1e-6, `inicio de switch fuera de [u,uEnd]: ${b.segT} vs ${b.sw.s.u}-${b.sw.s.uEnd}`)
      }
      prev.set(b.id, { seg: b.seg, lane: b.lane, sw: b.sw })
    }
  }
  assert.ok(changes > 5, `pocos cambios: ${changes}`)
  assert.equal(free, 0, `${free} cambios de carril fuera de un evento`)
})

test('sin choques: tubos de caminos distintos y nodos, muestreo cada ~2 u', () => {
  const MARGIN = 1.5; const TRIM = 18
  const samples = world.ways.map((w) => {
    const pts = []
    for (const s of w.segments) {
      const n = Math.max(2, Math.ceil(s.length / 2))
      for (let k = 0; k <= n; k++) {
        const d = (k / n) * s.length
        if ((s.kind === 'salida' && d < TRIM) || (s.kind === 'llegada' && s.length - d < TRIM)) continue
        pts.push({ p: s.curve.getPointAt(k / n), r: s.radius })
      }
    }
    return pts
  })
  let worst = Infinity; let who = ''
  for (let i = 0; i < world.ways.length; i++) {
    const w = world.ways[i]
    for (const n of world.nodes) for (const s of w.segments) {
      if ((s.kind === 'salida' && n.idx === w.from) || (s.kind === 'llegada' && n.idx === w.to)) continue
      const m = Math.max(2, Math.ceil(s.length / 2))
      for (let k = 0; k <= m; k++) {
        const c = s.curve.getPointAt(k / m).distanceTo(n.pos) - NODE_R - s.radius
        if (c < worst) { worst = c; who = `${w.id}/${s.kind} vs nodo ${n.name}` }
      }
    }
    for (let j = i + 1; j < world.ways.length; j++) {
      for (const a of samples[i]) for (const b of samples[j]) {
        const c = a.p.distanceTo(b.p) - a.r - b.r
        if (c < worst) { worst = c; who = `${w.id} vs ${world.ways[j].id}` }
      }
    }
  }
  assert.ok(worst > MARGIN, `holgura mínima ${worst.toFixed(2)} <= ${MARGIN} (${who})`)
})

test('esfera: nodos sobre la esfera grande y caminos en su cáscara, sin cruzar el interior', () => {
  for (const n of world.nodes) assert.ok(Math.abs(n.pos.length() - SPHERE_R) < 1e-6)
  let lo = Infinity; let hi = 0
  for (const s of world.segments) for (const p of s.curve.getSpacedPoints(40)) { lo = Math.min(lo, p.length()); hi = Math.max(hi, p.length()) }
  assert.ok(lo > 0.55 * SPHERE_R, `un camino se hunde hacia el centro: ${lo.toFixed(0)} <= ${(0.55 * SPHERE_R).toFixed(0)}`)
  assert.ok(hi < 1.8 * SPHERE_R, `un camino se aleja de la cáscara: ${hi.toFixed(0)}`)
})

test('relieve: continuo, finito, dentro del tubo y nulo en las uniones', () => {
  for (const s of world.segments) {
    for (const l of s.lanes) {
      if (s.air) { assert.equal(laneRelief(s, l.id, 0.5), 0); continue }
      const hMax = 0.45 * (s.radius - BALL_R)
      assert.ok(laneRelief(s, l.id, 0) < 1e-9 && laneRelief(s, l.id, 1) < 1e-9, `${s.way.id} ${s.kind}: relieve en la unión`)
      const N = Math.max(200, Math.ceil(s.length / 0.25)); let prev = 0
      for (let k = 0; k <= N; k++) {
        const u = k / N; const h = laneRelief(s, l.id, u)
        assert.ok(Number.isFinite(h) && h >= 0 && h <= hMax + 1e-5, `${s.way.id} ${s.kind}: relieve fuera de rango ${h}`)
        assert.ok(Number.isFinite(reliefSlope(s, l.id, u)))
        // continuo: entre muestras a 0.25 u no salta más que la caída más brusca de una rampa
        if (k) assert.ok(Math.abs(h - prev) <= (s.length / N) * 0.9 + 1e-6, `${s.way.id} ${s.kind}: relieve discontinuo en u=${u.toFixed(3)}`)
        prev = h
      }
    }
  }
})

test('bocas: puerta de salida y de llegada distintas, legibles y variadas entre caminos', () => {
  const outs = new Set(); const ins = new Set()
  for (const w of world.ways) {
    assert.ok(OUT_GATES.includes(w.gates.out) && IN_GATES.includes(w.gates.in) && w.gates.out !== w.gates.in)
    assert.equal(w.segments[0].gate, w.gates.out)
    assert.equal(w.segments.find((s) => !s.next.length).gate, w.gates.in)
    outs.add(w.gates.out); ins.add(w.gates.in)
  }
  for (const n of world.nodes) {
    for (const t of n.terminals) {
      assert.ok((t.kind === 'out' ? OUT_GATES : IN_GATES).includes(t.gate), `${n.name}: puerta ${t.gate} en boca ${t.kind}`)
      assert.equal(t.gate, t.kind === 'out' ? t.way.gates.out : t.way.gates.in)
      assert.ok(t.approach.len > 0 && Math.abs(t.approach.dir.length() - 1) < 1e-6 && t.approach.dir.dot(t.dir) > 0.3, 'la recta sale del planeta')
    }
  }
  assert.ok(outs.size >= 4 && ins.size >= 4, 'tipos de boca variados')
})

test('elecciones precalculadas (worker/caché): mismo mundo sin repetir la búsqueda', () => {
  assert.equal(world.picks.length, world.ways.length)
  setWorldPicks(369, JSON.parse(JSON.stringify(world.picks)))
  const t = performance.now(); const w2 = buildWorld(369); const ms = performance.now() - t
  const sum = (w) => w.segments.reduce((a, s) => a + s.length, 0)
  assert.equal(w2.segments.length, world.segments.length)
  assert.ok(Math.abs(sum(w2) - sum(world)) < 1e-6)
  assert.ok(ms < 1500, `reconstrucción lenta: ${ms.toFixed(0)} ms`)
})
