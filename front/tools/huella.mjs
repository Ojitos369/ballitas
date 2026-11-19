// Huella del mundo por semilla: elección de cada camino (theta, panza, sal) y largo total. Sirve para comprobar que un
// cambio de rendimiento no altera el mundo.   uso: node tools/huella.mjs [nSemillas=10] [semilla0=369]
import { buildWorld } from '../src/Core/world.js'
const n = +(process.argv[2] ?? 10); const s0 = +(process.argv[3] ?? 369); let tot = 0
for (let seed = s0; seed < s0 + n; seed++) {
  const t = performance.now(); const w = buildWorld(seed); const ms = performance.now() - t; tot += ms
  let h = 0; for (const y of w.ways) for (const v of [y.pick.theta, y.pick.bowExtra, y.pick.salt, y.length]) h = (h * 31 + Math.round(v * 1000)) % 2147483647
  console.log(`${seed} huella ${h} largo ${w.ways.reduce((a, y) => a + y.length, 0).toFixed(1)} intento ${w.attempt}${w.failed ? ' FALLO' : ''} ${(ms / 1000).toFixed(1)} s`)
}
console.log('media', (tot / n / 1000).toFixed(2), 's')
