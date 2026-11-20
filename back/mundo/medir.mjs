// Medidas sin red de la pieza P1 (metas de docs/mundo_compartido.md, sección 5):
//   node back/mundo/medir.mjs [semilla=369] [ticks=18000]
// ms por tick (con fila y decisiones activas), bytes de la instantánea rápida y de la bienvenida (JSON y comprimida).
import { performance } from 'node:perf_hooks'
import { deflateRawSync, gzipSync } from 'node:zlib'
import { Sim, MAX_SIN_DECIDIR, MAX_FILA, MAX_NOMBRE } from '../../front/src/Core/sim.js'
import { mulberry32, WORLD_GEN } from '../../front/src/Core/world.js'
import * as P from '../../front/src/Core/protocolo.js'

const semilla = Number(process.argv[2] || 369); const ticks = Number(process.argv[3] || 18000)
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))] }
const media = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length
const sim = new Sim({ rng: mulberry32(semilla), seed: semilla })
const cortoDe = (e) => `c${e}`.padEnd(8, '0').slice(0, 8)
const ms = []; const bytes = []; const comp = []; const hola = []; const holaComp = []; const serie = []
for (let n = 0; n < ticks; n++) {
  // entradas como las del prototipo: forman, toman y deciden
  if (n % 900 === 30) sim.formar(`e${(n / 900) % 4 | 0}`, `Forma ${n / 900 | 0}`)
  if (n % 240 === 7) for (const b of sim.ballitas) if (b.ctrl) { const ws = sim.world.waysFrom[sim.origenSiguiente(b)]; const w = ws[(n / 240 | 0) % ws.length]; sim.decidir(b.id, b.ctrl, { ruta: { way: w.idx, r: 0 }, carril: 2 }) }
  if (n % 3000 === 1500) { const l = sim.ballitas.find((b) => !b.ctrl && b.phase !== 'dying'); if (l) sim.tomar(l.id, 'e9') }
  const a = performance.now(); sim.tick(1 / P.HZ); const d = performance.now() - a
  if (n >= 600) ms.push(d) // los primeros 20 s calientan
  if (n % 3 === 0) {
    const c = performance.now(); const txt = JSON.stringify(P.instantanea(n, sim.t, sim.ballitas)); if (n >= 600) serie.push(performance.now() - c)
    bytes.push(Buffer.byteLength(txt)); if (n % 30 === 0) comp.push(deflateRawSync(txt).length)
  }
  if (n % 900 === 899) {
    const h = JSON.stringify({
      k: 'hola', q: 1, v: P.V, epoca: 'mwogrdva-e20e29', semilla, worldGen: WORLD_GEN, picks: sim.world.picks, hz: P.HZ, cada: P.CADA, n, t: sim.t, yo: { corto: 'abcdef01' },
      b: sim.ballitas.map((b) => ({ ...P.lenta(b, { cortoDe, auto: b.ctrl ? sim.predecir(b) : null }), r: P.rapida(b) })),
      fila: P.filaPublica(sim.fila, cortoDe), stats: sim.stats, feed: sim.feed, espectadores: 50,
      reglas: { maxSinDecidir: MAX_SIN_DECIDIR, maxFila: MAX_FILA, maxNombre: MAX_NOMBRE },
    })
    hola.push(Buffer.byteLength(h)); holaComp.push({ deflate: deflateRawSync(h).length, gzip: gzipSync(h).length, deflate3: deflateRawSync(h, { level: 3 }).length })
  }
}
const m = process.memoryUsage()
console.log(JSON.stringify({
  node: process.version, semilla, ticks,
  tickMs: { n: ms.length, media: +media(ms).toFixed(4), p50: +pct(ms, 0.5).toFixed(4), p99: +pct(ms, 0.99).toFixed(4), max: +Math.max(...ms).toFixed(3), cpuPct30Hz: +(media(ms) * P.HZ / 10).toFixed(2) },
  serializarMs: { media: +media(serie).toFixed(4), p99: +pct(serie, 0.99).toFixed(4) },
  instantanea: { ballitas: sim.ballitas.length, media: Math.round(media(bytes)), max: Math.max(...bytes), deflateMedia: Math.round(media(comp)) },
  bienvenida: { muestras: hola.length, jsonMedia: Math.round(media(hola)), jsonMax: Math.max(...hola), deflateMax: Math.max(...holaComp.map((x) => x.deflate)), gzipMax: Math.max(...holaComp.map((x) => x.gzip)), deflateNivel3Max: Math.max(...holaComp.map((x) => x.deflate3)) },
  poblacion: sim.stats, fila: sim.fila.length, rssMB: +(m.rss / 1048576).toFixed(1), heapMB: +(m.heapUsed / 1048576).toFixed(1),
}, null, 1))
