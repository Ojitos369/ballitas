import * as THREE from 'three'
import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim, POP, TIME_SCALE, TRAVEL_SLOW, MAX_SIN_DECIDIR, MAX_FILA, MAX_NOMBRE, MIN_SALIDAS, RUTAS_FRAC_MIN, RUTAS_FRAC_MAX, T_SIN_USO, T_APARECE } from './sim.js'
import { voice } from './personality.js'
import { actualizarDialogoVivo, elegirDialogo, obtenerGlobo } from './dialogos.js'
import {
  mulberry32, cityPath, NODE_R, BALL_R, TRACK_K, OBSTACLES, WORLD_SCALE, TUBE_SCALE,
  MECHANISMS, THEME_MECHS, wallFrame, laneFrame, laneAngle, nearestLane, angDiff, segmentTangent,
  laneRelief, reliefSlope, OUT_GATES, IN_GATES, SPHERE_R, buildWorld, setWorldPicks,
  laneLength, laneCurve, switchArc, braidEnv, switchPath, CARRILES, CAMBIOS,
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

test('caminos 3D separados dentro de cada tramo abierto', () => {
  let tested=0
  for(const w of world.ways) for(const s of w.segments) for(let k=0;k<=20;k++){
    const u=k/20;if(braidEnv(s,u)<0.5)continue
    const points=s.lanes.map(l=>laneFrame(s,l.id,u).road)
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
      assert.ok(points[i].distanceTo(points[j])>=2.2,`${w.id}/${s.kind}: caminos ${i} y ${j} demasiado cerca`);tested++
    }
  }
  assert.ok(tested>0)
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
  // rutas: false = todas las rutas, como siempre midió esta prueba (la media de UNA semilla varía ±20 s según qué rutas
  // toquen: 6 semillas dan 109-171 s sin rutas dinámicas y 120-177 s con ellas, medias 139,7 y 145,3 s)
  const sim = new Sim({ rng: mulberry32(19), rutas: false })
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
  // tope 117 -> 130: el mapa más grande (rutas más separadas) alarga ~5% los viajes. 130 -> 140: con ~13 viajes la media de
  // una sola semilla varía ±12 s (main ya daba 136-144 s con las semillas 22 y 5); la trenza abierta desde las uniones
  // no alarga los viajes (12 semillas, ~175 viajes: 127.3 s antes, 125.1 s después, ±4.8 s; carriles +0.3% de largo)
  assert.ok(avgDur >= 45 && avgDur <= 140, `duración media de viaje fuera de rango 2-3x: ${avgDur.toFixed(1)}s`)
})

test('caminos trenzados: puntas comunes, separacion media, roll y arcos finitos', () => {
  for (const w of world.ways) for (const s of w.segments) {
    assert.ok(s.lanes.length >= 3 && s.lanes.length <= 5)
    assert.equal(s.lanes.length, w.segments[0].lanes.length)
    for (let k=0;k<=20;k++) {
      const u=k/20; const base=laneFrame(s,0,u)
      for (const lane of s.lanes.slice(1)) {
        const f=laneFrame(s,lane.id,u)
        assert.ok(Number.isFinite(f.pos.x+f.pos.y+f.pos.z+f.roll))
        if (u===0 || u===1) assert.ok(f.road.distanceTo(base.road)<0.05)
        if (braidEnv(s,u)>0.5) assert.ok(f.road.distanceTo(base.road)>=2.2)
      }
    }
    assert.equal(new Set(s.lanes.map(l=>l.roll)).size,s.lanes.length)
    assert.ok(laneLength(s,0)>0)
    assert.ok(laneCurve(s,0).getPoint(0).distanceTo(laneFrame(s,0,0).surface)<1e-5)
    for (const sw of s.switches) for(let k=0;k<=20;k++) { const f=switchArc(s,sw,k/20); assert.ok(Number.isFinite(f.pos.x+f.pos.y+f.pos.z)) }
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

test('ballita recorre el camino asignado y aterriza tras los vuelos de intercambio', () => {
  const sim=new Sim({rng:mulberry32(5)}); let flights=0; let impacts=0; let changes=0; const prev=new Map()
  for(let i=0;i<6000;i++){
    sim.tick(0.02)
    for(const b of sim.ballitas){
      const p=prev.get(b.id)
      if(b.phase!=='travel'){prev.delete(b.id);continue}
      assert.ok(Number.isFinite(b.pos.x+b.pos.y+b.pos.z+b.speed+b.roll))
      if(b.flight&&!p?.flight) flights++
      if(p?.flight&&!b.flight) impacts++
      if(p&&p.seg===b.seg&&p.lane!==b.lane){changes++;assert.ok(b.impact>0.9||b.flight||p.flight,'todo cambio debe aterrizar desde un vuelo')}
      if(!b.flight&&b.snap<=0){const f=laneFrame(b.seg,b.lane,b.segT);assert.ok(b.pos.distanceTo(f.pos)<4.5*TRACK_K,`fuera del camino ${b.seg.kind}`)}
      prev.set(b.id,{seg:b.seg,lane:b.lane,flight:b.flight,snap:b.snap})
    }
  }
  assert.ok(flights>=5,`pocos vuelos: ${flights}`)
  assert.ok(impacts>=5,`pocos aterrizajes: ${impacts}`)
  assert.ok(changes>=5,`pocos cambios: ${changes}`)
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

test('cambio de carril sólo por vuelo: 5 min simulados, todo cambio ocurre durante un arco', () => {
  const sim = new Sim({ rng: mulberry32(11) })
  const prev = new Map(); let changes = 0; let free = 0
  let parallelPaths = false
  for (let i = 0; i < 15000; i++) { // 300 s a 0.02
    sim.tick(0.02)
    const groups = new Map()
    for (const b of sim.ballitas) {
      if (b.phase === 'travel') {
        const key = `${b.way.idx}:${b.seg.i}`; const lanes = groups.get(key) || new Set()
        lanes.add(b.lane); groups.set(key, lanes)
      }
      const p = prev.get(b.id)
      if (b.phase !== 'travel') { prev.delete(b.id); continue }
      if (p && p.seg === b.seg && p.lane !== b.lane) {
        changes++
        if (!b.flight && !p.flight) free++
        if (b.flight && !p.flight) assert.ok(b.segT >= b.flight.sw.u - 0.02 && b.segT <= b.flight.sw.uLand + 1e-6, `inicio de vuelo fuera de [u,uLand]: ${b.segT}`)
      }
      prev.set(b.id, { seg: b.seg, lane: b.lane, flight: b.flight })
    }
    if ([...groups.values()].some((lanes) => lanes.size > 1)) parallelPaths = true
  }
  assert.ok(changes > 5, `pocos cambios: ${changes}`)
  assert.equal(free, 0, `${free} cambios de carril fuera de un evento`)
  assert.ok(parallelPaths, 'varias ballitas recorren caminos distintos del mismo tramo')
})

test('sin choques: pistas hermanas separadas y lejos de nodos ajenos', () => {
  let checked=0
  for(const w of world.ways) for(const s of w.segments) for(let k=0;k<=24;k++){
    const u=k/24;if(braidEnv(s,u)<0.5)continue
    const roads=s.lanes.map(l=>laneFrame(s,l.id,u).road)
    for(let i=0;i<roads.length;i++)for(let j=i+1;j<roads.length;j++){
      assert.ok(roads[i].distanceTo(roads[j])>=2.2,`${w.id}/${s.kind}: pistas ${i}-${j}`);checked++
    }
    for(const node of world.nodes) if(node.idx!==w.from&&node.idx!==w.to) for(const p of roads) assert.ok(p.distanceTo(node.pos)>NODE_R+BALL_R)
  }
  assert.ok(checked>0)
})

test('esfera: nodos sobre la esfera grande y caminos en su cáscara, sin cruzar el interior', () => {
  for (const n of world.nodes) assert.ok(Math.abs(n.pos.length() - SPHERE_R) < 1e-6)
  let lo = Infinity; let hi = 0
  for (const s of world.segments) for (const p of s.curve.getSpacedPoints(40)) { lo = Math.min(lo, p.length()); hi = Math.max(hi, p.length()) }
  assert.ok(lo > 0.5 * SPHERE_R, `un camino se hunde hacia el centro: ${lo.toFixed(0)} <= ${(0.5 * SPHERE_R).toFixed(0)}`) // cáscara de altitud ±LAYER_K; las paradas se recortan a 0.5 R (world.js)
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
        if (k) assert.ok(Math.abs(h - prev) <= (s.length / N) * 0.9 + 1e-6, `${s.way.id} ${s.kind} carril ${l.id}: relieve discontinuo en u=${u.toFixed(3)} (${Math.abs(h-prev).toFixed(3)})`)
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
  // tope holgado: con la suite en paralelo y la máquina ocupada pasaba de 1500 ms sin regresión real
  // (sin caché la búsqueda tarda ~5 s, así que 3000 ms sigue detectando que no se reutilizó)
  assert.ok(ms < 3000, `reconstrucción lenta: ${ms.toFixed(0)} ms`)
})

test('carriles: cada camino tiene eventos en sus 5 carriles, hacia otro camino y con kind según la geometría', () => {
  const kinds = new Set()
  for (const s of world.segments) {
    for (const l of s.lanes) {
      const evs = s.switchesByLane.get(l.id)
      assert.deepEqual([...new Set(evs.map((sw) => sw.carril))].sort(), [0, 1, 2, 3, 4], `${s.way.id} ${s.kind} camino ${l.id}`)
      for (const sw of evs) {
        assert.ok(sw.to !== sw.from && s.lanes.some((x) => x.id === sw.to))
        assert.ok(sw.u > 0 && sw.u < sw.uLand && sw.uLand < 1)
        assert.equal(sw.via, CAMBIOS[sw.kind])
        kinds.add(sw.kind)
        const a = laneFrame(s, sw.from, sw.u).pos; const b = laneFrame(s, sw.to, sw.u).pos
        if (sw.kind === 'caida') assert.ok(b.y < a.y, 'caída sólo hacia un camino más bajo')
        if (sw.kind === 'elevador') assert.ok(b.y > a.y, 'elevador sólo hacia uno más alto')
        for (let k = 0; k <= 10; k++) { const f = switchPath(s, sw, k / 10); assert.ok(Number.isFinite(f.pos.x + f.pos.y + f.pos.z + f.vis)) }
      }
    }
  }
  for (const k of ['salto', 'botado', 'caida', 'rampa', 'portal', 'elevador', 'laberinto']) assert.ok(kinds.has(k), `falta ${k}`)
  assert.equal(CARRILES, 5)
})

test('carriles: aleatorio al entrar a la ruta y al aterrizar; sólo toma eventos de su carril', () => {
  const sim = new Sim({ rng: mulberry32(21) })
  const entered = new Set(); const landed = new Set(); const prev = new Map(); let starts = 0
  for (let i = 0; i < 9000; i++) {
    const before = new Map(sim.ballitas.map((b) => [b.id, { flight: b.flight, carril: b.carril, phase: b.phase }]))
    sim.tick(0.02)
    for (const b of sim.ballitas) {
      const p = before.get(b.id)
      if (b.phase !== 'travel' || !p) continue
      if (p.phase !== 'travel') entered.add(b.carril)
      if (b.flight && !p.flight) { starts++; assert.equal(b.flight.sw.carril, p.carril, 'evento de otro carril') }
      if (p.flight && !b.flight && b.seg === prev.get(b.id)) landed.add(b.carril)
      prev.set(b.id, b.seg)
    }
  }
  assert.ok(starts > 10, `pocos eventos: ${starts}`)
  assert.ok(entered.size >= 4, `carril de entrada poco variado: ${[...entered]}`)
  assert.ok(landed.size >= 4, `carril de aterrizaje poco variado: ${[...landed]}`)
})

test('sólo le afecta un evento de su carril y camino, también justo después de aterrizar en otro camino', () => {
  const sim = new Sim({ rng: mulberry32(23), pop: 1 })
  const b = sim.ballitas[0]
  let probados = 0; let tomados = 0
  for (const way of world.ways) for (const s of way.segments) for (const sw of s.switches ?? []) {
    // en el mismo punto, desde otro carril del mismo camino o desde otro camino: nunca lo toma
    for (const [lane, carril] of [[sw.from, (sw.carril + 1) % CARRILES], [sw.to, sw.carril]]) {
      Object.assign(b, { phase: 'travel', way, seg: s, segT: sw.u, lane, carril, flight: null, sw: null, e: 100, p: 100 })
      sim.checkSwitches(b, s, Math.max(0, sw.u - 1e-4), sw.u + 1e-4)
      if (b.flight) assert.ok(b.flight.sw.from === lane && b.flight.sw.carril === carril, `${way.id}: tomó un evento ajeno (${sw.kind})`)
      probados++
    }
  }
  // tras aterrizar en el camino destino: los eventos que toma en el resto del tramo son de su camino y carril nuevos
  for (const way of world.ways.slice(0, 4)) for (const s of way.segments) for (const sw of (s.switches ?? []).slice(0, 2)) {
    Object.assign(b, { phase: 'travel', way, seg: s, segT: sw.u, lane: sw.from, carril: sw.carril, flight: null, sw: null, e: 100, p: 100 })
    sim.startSwitch(b, s, sw)
    for (let k = 0; k < 400 && b.flight; k++) sim.travelStep(b, 0.02)
    const lane = b.lane; const carril = b.carril
    for (let u = b.segT; u < 1 && !b.flight; u += 0.01) {
      sim.checkSwitches(b, s, u, Math.min(1, u + 0.01))
      if (b.flight) { tomados++; assert.ok(b.flight.sw.from === lane && b.flight.sw.carril === carril, 'tras aterrizar tomó un evento de otro carril') }
    }
  }
  assert.ok(probados > 50, `pocos eventos probados: ${probados}`)
})

test('cada kind deja a la ballita en el camino destino, con su trayectoria', () => {
  const sim = new Sim({ rng: mulberry32(22), pop: 1 })
  const b = sim.ballitas[0]
  const seen = new Set()
  for (const way of world.ways) for (const s of way.segments) for (const sw of s.switches) {
    if (seen.has(sw.kind) || !s.next.length) continue
    seen.add(sw.kind)
    Object.assign(b, { phase: 'travel', way, seg: s, segT: sw.u, lane: sw.from, carril: sw.carril, flight: null, sw: null, e: 100, p: 100 })
    sim.startSwitch(b, s, sw)
    const start = switchPath(s, sw, 0).pos.clone(); const end = switchPath(s, sw, 1).pos.clone(); const chord = new THREE.Line3(start, end); const q = new THREE.Vector3(); let hidden = false; let top = 0
    for (let k = 0; k < 400 && b.flight; k++) {
      sim.travelStep(b, 0.02)
      if (b.vis < 0.5) hidden = true
      top = Math.max(top, chord.closestPointToPoint(b.pos, true, q).distanceTo(b.pos))
    }
    assert.equal(b.flight, null, `${sw.kind}: no terminó`)
    assert.equal(b.seg, s); assert.equal(b.lane, sw.to, `${sw.kind}: no quedó en el camino destino`)
    assert.ok(b.pos.distanceTo(laneFrame(s, sw.to, sw.uLand).pos) < 0.5, `${sw.kind}: aterriza lejos del destino`)
    if (sw.via === 'portal') assert.ok(hidden, 'el portal la oculta')
    if (sw.via === 'arco') assert.ok(top > TRACK_K, `${sw.kind}: sin arco`)
  }
  assert.ok(seen.size >= 7)
})
test('probWays: ordena los caminos del nodo sin consumir la RNG ni cambiar la elección', () => {
  const mk = () => new Sim({ rng: mulberry32(7), rutas: false }) // todas las rutas: con rutas dinámicas solo ordena las activas
  const a = mk(); const b = mk()
  for (let i = 0; i < 600; i++) {
    a.tick(0.05); b.tick(0.05)
    for (const x of a.ballitas) if (x.phase !== 'dying' && x.phase !== 'gone') {
      const o = x.phase === 'travel' ? a.probWays(x, x.way.to) : a.probWays(x)
      const n = x.phase === 'travel' ? x.way.to : x.node
      assert.deepEqual([...o].sort((p, q) => p - q), a.world.waysFrom[n].map((w) => w.idx).sort((p, q) => p - q))
    }
  }
  assert.deepEqual(a.ballitas.map((x) => [x.id, x.phase, x.way?.idx ?? null, +x.e.toFixed(6)]), b.ballitas.map((x) => [x.id, x.phase, x.way?.idx ?? null, +x.e.toFixed(6)]))
})
// ───────────── mundo compartido: fila, control y decisiones (docs/mundo_compartido.md, secciones 3 y 4) ─────────────
const contada = (semilla) => { const r = mulberry32(semilla); const o = { n: 0 }; o.rng = () => { o.n++; return r() }; return o }
const mantener = (sim) => { for (const x of sim.ballitas) if (x.phase !== 'dying') { x.e = Math.max(x.e, 50); x.p = Math.max(x.p, 50) } }

test('mundo compartido: formar valida, la fila es FIFO y la primera entra al morir otra', () => {
  const sim = new Sim({ rng: mulberry32(11) })
  const ev = []
  sim.hooks.entra = (b, e) => ev.push(['entra', b.id, e, b.name]); sim.hooks.libre = (b, m) => ev.push(['libre', b.id, m])
  for (const b of sim.ballitas) assert.deepEqual([b.ctrl, b.formadaPor, b.dec, b.sinDecidir], [null, null, {}, 0])
  assert.deepEqual(sim.formar('ana', '  Mi <b>Bola</b>!!  '), { ok: true, puesto: 1 })
  assert.equal(sim.fila[0].nombre, 'Mi bBolab')
  assert.equal(sim.formar('ana', 'Otra').error, 'ya_en_fila')
  assert.equal(sim.formar('beto', '¡¡!!').error, 'nombre')
  assert.equal(sim.formar('beto', '').error, 'nombre')
  assert.equal(sim.formar('beto', 'x'.repeat(40)).ok, true)
  assert.equal(sim.fila[1].nombre.length, MAX_NOMBRE)
  assert.deepEqual(sim.formar('caro', sim.ballitas[0].name), { ok: true, puesto: 3 }) // nombre ya vivo: recibirá sufijo
  const repetido = sim.ballitas[0].name
  assert.equal(sim.salirFila('beto').ok, true)
  assert.deepEqual(sim.fila.map((f) => f.espectador), ['ana', 'caro'])
  for (let i = 0; i < 40; i++) sim.formar(`e${i}`, `N${i}`)
  assert.equal(sim.fila.length, MAX_FILA)
  assert.equal(sim.formar('zeta', 'Zeta').error, 'fila_llena')
  // sin muertes no entra nadie
  for (let i = 0; i < 90; i++) { mantener(sim); sim.tick(1 / 30) }
  assert.equal(sim.fila.length, MAX_FILA); assert.equal(ev.length, 0)
  // muere una: 1.5 s después nace la primera de la fila, con su nombre y controlada por quien la formó
  const victima = sim.ballitas[3]; victima.e = 0; sim.tick(1 / 30)
  for (let i = 0; i < 120; i++) { mantener(sim); sim.tick(1 / 30) }
  const nueva = sim.ballitas.find((b) => b.formadaPor === 'ana')
  assert.ok(nueva, 'entró la primera de la fila'); assert.equal(nueva.name, 'Mi bBolab'); assert.equal(nueva.ctrl, 'ana')
  assert.equal(sim.fila.length, MAX_FILA - 1); assert.equal(sim.fila[0].espectador, 'caro')
  assert.deepEqual(ev[0], ['entra', nueva.id, 'ana', 'Mi bBolab'])
  assert.equal(nueva.log.at(-1).text.length > 0, true)
  // la segunda: nombre repetido recibe sufijo; muere la controlada: se libera con motivo 'muerte'
  nueva.p = 0; sim.tick(1 / 30)
  for (let i = 0; i < 120; i++) { mantener(sim); sim.tick(1 / 30) }
  assert.deepEqual(ev.find((e) => e[0] === 'libre'), ['libre', nueva.id, 'muerte'])
  const segunda = sim.ballitas.find((b) => b.formadaPor === 'caro')
  assert.equal(segunda.name, `${repetido} 2`); assert.equal(segunda.ctrl, 'caro')
  assert.equal(sim.ballitas.length, POP)
  // quien ya controla una no recibe el control de otra formada suya
  sim.fila.unshift({ espectador: 'caro', nombre: 'Tercera', t: sim.t })
  sim.ballitas.find((b) => !b.ctrl && b.phase !== 'dying').e = 0; sim.tick(1 / 30)
  for (let i = 0; i < 120; i++) { mantener(sim); sim.tick(1 / 30) }
  const tercera = sim.ballitas.find((b) => b.name === 'Tercera')
  assert.equal(tercera.formadaPor, 'caro'); assert.equal(tercera.ctrl, null)
})

test('mundo compartido: tomar, dejar y decidir validan; las decisiones se cumplen y son de un solo uso', () => {
  const c = contada(12)
  const sim = new Sim({ rng: c.rng, rutas: false }) // elige entre TODAS las rutas del nodo (las dinámicas tienen sus pruebas abajo)
  const libres = []; sim.hooks.libre = (b, m) => libres.push([b.id, m])
  const [a, b2] = sim.ballitas
  assert.equal(sim.tomar(9999, 'yo').error, 'no_existe')
  assert.equal(sim.decidir(a.id, 'yo', { carril: 1 }).error, 'no_controlas')
  assert.equal(sim.dejar(a.id, 'yo').error, 'no_controlas')
  assert.equal(sim.tomar(a.id, 'yo').ok, true)
  assert.equal(sim.tomar(a.id, 'otro').error, 'ocupada')
  assert.equal(sim.tomar(b2.id, 'yo').error, 'ya_controlas')
  assert.equal(sim.decidir(a.id, 'otro', { carril: 1 }).error, 'no_controlas')
  const origen = sim.origenSiguiente(a); const ways = sim.world.waysFrom[origen]
  const ajeno = sim.world.ways.find((w) => w.from !== origen)
  assert.equal(sim.decidir(a.id, 'yo', { destino: origen }).error, 'destino')
  assert.equal(sim.decidir(a.id, 'yo', { destino: 99 }).error, 'destino')
  assert.equal(sim.decidir(a.id, 'yo', { ruta: { way: ajeno.idx, r: 0 } }).error, 'ruta')
  assert.equal(sim.decidir(a.id, 'yo', { ruta: { way: ways[0].idx, r: 9 } }).error, 'ruta')
  assert.equal(sim.decidir(a.id, 'yo', { carril: 5 }).error, 'carril')
  assert.equal(sim.decidir(a.id, 'yo', { carril: 1.5 }).error, 'carril')
  assert.deepEqual(a.dec, {})
  // ruta fija también el planeta; cambiar el planeta borra la ruta; null borra
  assert.deepEqual(sim.decidir(a.id, 'yo', { ruta: { way: ways[1].idx, r: 1 } }).dec, { ruta: { way: ways[1].idx, r: 1 }, destino: ways[1].to })
  assert.deepEqual(sim.decidir(a.id, 'yo', { destino: ways[0].to }).dec, { destino: ways[0].to })
  assert.deepEqual(sim.decidir(a.id, 'yo', { carril: 3 }).dec, { destino: ways[0].to, carril: 3 })
  assert.deepEqual(sim.decidir(a.id, 'yo', { destino: null, carril: null }).dec, {})
  // predecir y prevision no consumen la rng
  const n0 = c.n
  const auto = sim.predecir(a); assert.ok(auto.way.from === origen && auto.way.routes.includes(auto.route))
  const pv = sim.prevision(a, auto.way, auto.route); assert.ok(pv.seg > 5 && pv.dE < 0 && Number.isFinite(pv.dP))
  sim.decidir(a.id, 'yo', { destino: ways[2].to }); assert.equal(sim.predecir(a).way.to, ways[2].to)
  sim.decidir(a.id, 'yo', { destino: null })
  assert.equal(c.n, n0)
  // 4 viajes con ruta y carril decididos: llega al planeta, recorre solo esa ruta y sale por ese carril
  let viajes = 0; let v = null; let fase = a.phase
  for (let i = 0; i < 40000 && viajes < 4; i++) {
    if (a.phase === 'at' && !v) {
      const ws = sim.world.waysFrom[a.node]; const w = ws[viajes % ws.length]; const r = viajes % w.routes.length
      assert.equal(sim.decidir(a.id, 'yo', { ruta: { way: w.idx, r }, carril: viajes % 5 }).ok, true)
      v = { to: w.to, r, carril: viajes % 5, vistas: new Set(), carril0: null }
    }
    mantener(sim); fase = a.phase; sim.tick(1 / 30)
    if (!v) continue
    if (fase === 'at' && a.phase === 'toPort') {
      assert.deepEqual(a.dec, {}, 'un solo uso'); assert.deepEqual(a.plan.manual, ['destino', 'ruta', 'carril'])
      assert.equal(a.plan.razon, 'lo decidió quien me controla'); assert.equal(a.way.to, v.to)
    }
    if (a.phase === 'travel') {
      if (a.seg.route >= 0) v.vistas.add(a.seg.route)
      if (v.carril0 == null && !a.flight) v.carril0 = a.carril
    }
    if (fase === 'travel' && a.phase !== 'travel') {
      assert.equal(a.node, v.to); assert.deepEqual([...v.vistas], [v.r]); assert.equal(v.carril0, v.carril)
      assert.equal(a.ctrl, 'yo'); assert.equal(a.sinDecidir, 0); assert.equal(a.rutaFija, null); assert.equal(a.carrilFijo, null)
      viajes++; v = null
    }
  }
  assert.equal(viajes, 4)
  // sin decidir: pierde el control exactamente en la tercera llegada
  let llegadas = 0
  for (let i = 0; i < 60000 && a.ctrl; i++) {
    mantener(sim); fase = a.phase; sim.tick(1 / 30)
    if (fase === 'travel' && a.phase !== 'travel') { llegadas++; if (a.ctrl) assert.equal(a.sinDecidir, llegadas) }
  }
  assert.equal(llegadas, MAX_SIN_DECIDIR); assert.equal(a.ctrl, null)
  assert.deepEqual(libres, [[a.id, 'inactivo']])
  // libre: otro la toma; una decisión pendiente (aunque no se haya usado) reinicia la cuenta; dejar borra decisiones
  assert.equal(sim.tomar(a.id, 'otro').ok, true)
  sim.decidir(a.id, 'otro', { carril: 2 })
  assert.equal(sim.dejar(a.id, 'otro').ok, true)
  assert.deepEqual([a.ctrl, a.dec], [null, {}]); assert.deepEqual(libres.at(-1), [a.id, 'dejar'])
})

// ───────────── rutas dinámicas (docs/mundo_compartido.md, sección 9) ─────────────
const salidas = (sim, n) => new Set(sim.world.waysFrom[n].filter((w) => sim.activas.has(w.idx)).map((w) => w.to)).size
const registrar = (sim) => { const ev = []; sim.hooks.rutas = (e) => ev.push({ ...e, t: sim.t, n: sim.activas.size }); return ev }

test('rutas dinámicas: apagadas no cambian nada; encendidas, arranque válido y determinista', () => {
  const off = new Sim({ rng: mulberry32(5), rutas: false })
  assert.equal(off.activas, null); assert.equal(off.salidasActivas(0).length, off.world.waysFrom[0].length)
  const N = world.ways.length; const min = Math.ceil(RUTAS_FRAC_MIN * N); const max = Math.floor(RUTAS_FRAC_MAX * N)
  const corre = (s) => {
    const sim = new Sim({ rng: mulberry32(s) }); const ev = registrar(sim)
    assert.ok(sim.activas.size >= min && sim.activas.size <= max, `arranque con ${sim.activas.size} activas`)
    for (const n of sim.world.nodes) assert.ok(salidas(sim, n.idx) >= MIN_SALIDAS)
    for (let i = 0; i < 6000; i++) sim.tick(1 / 30)
    return JSON.stringify([[...sim.activas], ev.map((e) => [e.on, e.off, e.motivo, e.t]), sim.ballitas.map((b) => [b.id, b.phase, b.p, b.e, b.pos.x])])
  }
  assert.equal(corre(21), corre(21)); assert.notEqual(corre(21), corre(22))
})

test('rutas dinámicas: 30 min con 10 ballitas en 5 semillas, ningún planeta baja de 2 salidas y nadie queda sin camino', () => {
  const N = world.ways.length; const max = Math.floor(RUTAS_FRAC_MAX * N)
  const motivos = new Set(); let cambios = 0
  for (const semilla of [1, 2, 3, 4, 5]) {
    const sim = new Sim({ rng: mulberry32(semilla) }); const ev = registrar(sim)
    assert.equal(sim.ballitas.length, 10)
    let viajes = 0
    for (let i = 0; i < 36000; i++) { // 36 000 × 0,05 s = 30 min
      const antes = sim.ballitas.map((b) => b.phase)
      sim.tick(0.05)
      for (const n of sim.world.nodes) if (salidas(sim, n.idx) < MIN_SALIDAS) assert.fail(`semilla ${semilla}, t=${sim.t.toFixed(1)}: ${n.name} con ${salidas(sim, n.idx)} salidas`)
      if (sim.activas.size > max) assert.fail(`semilla ${semilla}: ${sim.activas.size} activas, más que el máximo ${max}`)
      for (let k = 0; k < sim.ballitas.length; k++) {
        const b = sim.ballitas[k]
        // quien va por una ruta (rumbo al puerto o dentro) la conserva activa hasta terminarla
        if (b.way && b.phase !== 'dying' && b.phase !== 'gone' && !sim.activas.has(b.way.idx)) assert.fail(`semilla ${semilla}: ${b.name} va por una ruta inactiva (${b.phase})`)
        if (antes[k] === 'at' && b.phase === 'toPort') viajes++
      }
    }
    assert.ok(viajes > 50, `semilla ${semilla}: solo ${viajes} viajes`)
    assert.ok(ev.length > 20, `semilla ${semilla}: el mapa casi no cambió (${ev.length} cambios)`)
    for (const e of ev) motivos.add(e.motivo)
    cambios += ev.length
  }
  assert.deepEqual([...motivos].sort(), ['terminada', 'tiempo'].concat(motivos.has('sin_uso') ? ['sin_uso'] : []).sort())
  assert.ok(cambios > 150)
})

test('rutas dinámicas: se quita la que lleva T_SIN_USO sin tomarse; aparece otra si baja del rango y cada T_APARECE', () => {
  // sin ballitas y con margen sobre el mínimo: las que sobran se quitan al cumplir T_SIN_USO, nunca antes
  let sim = new Sim({ rng: mulberry32(3), pop: 0, rutas: { fracMax: 0.9, tAparece: Infinity } }); let ev = registrar(sim)
  const n0 = sim.activas.size; assert.ok(n0 > 10)
  while (sim.t < T_SIN_USO - 1) sim.tick(0.05)
  assert.equal(ev.length, 0); assert.equal(sim.activas.size, n0)
  while (sim.t < T_SIN_USO + 5) sim.tick(0.05)
  assert.ok(ev.length > 0 && ev.every((e) => e.motivo === 'sin_uso' && e.off.length === 1 && e.t > T_SIN_USO))
  assert.equal(sim.activas.size, 10) // el tope lo pone la regla de salidas: 5 planetas × 2
  for (const n of sim.world.nodes) assert.equal(salidas(sim, n.idx), MIN_SALIDAS)
  // aparición por rango: con MIN_SALIDAS = 1 las activas pueden bajar del mínimo (8) y entonces aparece otra al azar
  sim = new Sim({ rng: mulberry32(3), pop: 0, rutas: { minSalidas: 1, tSinUso: 5, tAparece: Infinity } }); ev = registrar(sim)
  const min = sim.rutasCfg.min; assert.equal(min, Math.ceil(RUTAS_FRAC_MIN * world.ways.length))
  for (let i = 0; i < 1200; i++) { sim.tick(0.05); assert.ok(sim.activas.size >= min, `bajó a ${sim.activas.size}`) }
  const rango = ev.filter((e) => e.motivo === 'rango')
  assert.ok(rango.length >= 3, `apariciones por rango: ${rango.length}`)
  for (const e of rango) { const quitada = ev[ev.indexOf(e) - 1]; assert.equal(quitada.motivo, 'sin_uso'); assert.notEqual(e.on[0], quitada.off[0]); assert.equal(e.n, min) }
  for (const n of sim.world.nodes) assert.ok(salidas(sim, n.idx) >= 1)
  // aparición por tiempo: una cada T_APARECE hasta el máximo del rango
  sim = new Sim({ rng: mulberry32(3), pop: 0, rutas: { tSinUso: Infinity } }); ev = registrar(sim)
  const max = sim.rutasCfg.max; const ini = sim.activas.size
  while (sim.t < T_APARECE * (max - ini + 3)) sim.tick(0.05)
  assert.equal(sim.activas.size, max); assert.equal(ev.length, max - ini)
  assert.ok(ev.every((e, i) => e.motivo === 'tiempo' && e.on.length === 1 && Math.abs(e.t - T_APARECE * (i + 1)) < 0.2))
})

test('rutas dinámicas: la terminada se quita solo si no está en los planes de otra ballita', () => {
  const sim = new Sim({ rng: mulberry32(8), rutas: { tSinUso: Infinity, tAparece: 5 } }); const ev = registrar(sim)
  let vistas = 0; let protegidas = 0
  sim.hooks.rutas = (e) => {
    ev.push(e)
    if (e.motivo !== 'terminada') return
    const w = sim.world.ways[e.off[0]]; vistas++
    assert.ok(!sim.ballitas.some((b) => b.way === w && b.phase !== 'dying'), 'se quitó una ruta con ballitas dentro')
  }
  const arrive = sim.arrive.bind(sim)
  sim.arrive = (b) => { // llegadas por una ruta que comparte con otra ballita: no se puede quitar
    const L = b.way; const otra = sim.ballitas.some((o) => o !== b && o.way === L && o.phase !== 'dying')
    arrive(b)
    if (otra) { protegidas++; assert.ok(sim.activas.has(L.idx), 'se quitó una ruta que otra ballita tenía tomada') }
  }
  for (let i = 0; i < 24000 && (vistas < 5 || protegidas < 2); i++) { mantener(sim); sim.tick(0.05) }
  assert.ok(vistas >= 5, `terminadas quitadas: ${vistas}`); assert.ok(protegidas >= 2, `llegadas con la ruta compartida: ${protegidas}`)
  // reglas una a una sobre una ruta que sobra (su planeta tiene más de MIN_SALIDAS salidas)
  for (const b of sim.ballitas) { b.way = null; b.dec = {}; b.ctrl = null; b.phase = 'at'; b.timer = 99 }
  for (const w of sim.world.ways) sim.activas.add(w.idx)
  const [a, o] = sim.ballitas; const w = sim.world.waysFrom[a.node][0]
  assert.equal(sim.puedeQuitarRuta(w), true)
  o.way = w; o.phase = 'toPort'; assert.equal(sim.puedeQuitarRuta(w), false, 'otra ballita va hacia ella') // la trampa: planeada y aún sin empezar
  o.phase = 'dying'; assert.equal(sim.puedeQuitarRuta(w), true); o.way = null; o.phase = 'at'
  assert.equal(sim.tomar(a.id, 'yo').ok, true)
  assert.equal(sim.decidir(a.id, 'yo', { ruta: { way: w.idx, r: 0 } }).ok, true); assert.equal(sim.puedeQuitarRuta(w), false, 'ruta decidida por un controlador')
  assert.equal(sim.decidir(a.id, 'yo', { ruta: null }).ok, true); assert.deepEqual(a.dec, { destino: w.to }); assert.equal(sim.puedeQuitarRuta(w), false, 'planeta decidido que se alcanza por ella')
  assert.equal(sim.decidir(a.id, 'yo', { destino: null }).ok, true); assert.equal(sim.puedeQuitarRuta(w), true)
  // la regla cuenta SALIDAS: aunque lleguen 4 rutas al planeta, con 2 salidas no se quita ninguna de ellas
  for (const x of sim.world.waysFrom[a.node].slice(MIN_SALIDAS)) assert.equal(sim.quitarRuta(x, 'prueba'), true)
  assert.equal(sim.world.ways.filter((x) => x.to === a.node && sim.activas.has(x.idx)).length, 4)
  for (const x of sim.world.waysFrom[a.node]) assert.equal(sim.quitarRuta(x, 'prueba'), false)
  assert.equal(salidas(sim, a.node), MIN_SALIDAS)
})

test('rutas dinámicas: solo se deciden rutas activas y una decisión que queda inválida cae a la automática con aviso', () => {
  const sim = new Sim({ rng: mulberry32(12), rutas: { tSinUso: Infinity, tAparece: Infinity } })
  const avisos = []; sim.hooks.invalida = (b, que) => avisos.push([b.id, que])
  const a = sim.ballitas[0]
  assert.equal(sim.tomar(a.id, 'yo').ok, true)
  while (a.phase !== 'at') { mantener(sim); sim.tick(1 / 30) }
  const todas = sim.world.waysFrom[a.node]; const act = todas.filter((w) => sim.activas.has(w.idx)); const ina = todas.filter((w) => !sim.activas.has(w.idx))
  assert.ok(act.length >= MIN_SALIDAS && ina.length > 0)
  assert.equal(sim.decidir(a.id, 'yo', { ruta: { way: ina[0].idx, r: 0 } }).error, 'ruta')
  assert.equal(sim.decidir(a.id, 'yo', { destino: ina[0].to }).error, 'destino')
  assert.deepEqual(sim.probWays(a).sort((x, y) => x - y), act.map((w) => w.idx).sort((x, y) => x - y))
  assert.ok(sim.activas.has(sim.predecir(a).way.idx))
  // decide una activa y la ruta desaparece antes de salir (forzado: las reglas la protegerían mientras esté decidida)
  assert.equal(sim.decidir(a.id, 'yo', { ruta: { way: act[0].idx, r: 0 }, carril: 2 }).ok, true)
  assert.equal(sim.quitarRuta(act[0], 'prueba'), false, 'una ruta decidida no se quita')
  sim.activas.add(ina[0].idx); sim.activas.delete(act[0].idx)
  while (a.phase === 'at') { mantener(sim); sim.tick(1 / 30) }
  assert.equal(a.phase, 'toPort'); assert.ok(sim.activas.has(a.way.idx) && a.way !== act[0], 'salió por una ruta activa')
  assert.deepEqual(avisos, [[a.id, ['ruta', 'destino']]])
  assert.ok(a.plan.aviso.length > 0); assert.deepEqual(a.plan.manual, ['carril']); assert.deepEqual(a.dec, {})
  // sin decisiones no hay aviso
  while (a.phase !== 'at') { mantener(sim); sim.tick(1 / 30) }
  while (a.phase === 'at') { mantener(sim); sim.tick(1 / 30) }
  assert.equal(avisos.length, 1); assert.equal(a.plan.aviso, undefined)
})
