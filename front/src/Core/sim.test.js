import test from 'node:test'
import assert from 'node:assert/strict'
import { Sim, POP } from './sim.js'
import { mulberry32, cityPath, NODE_R, OBSTACLES } from './world.js'

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
