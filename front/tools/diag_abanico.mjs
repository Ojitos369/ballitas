import { buildWorld } from '../src/Core/world.js'
for (const seed of process.argv[2].split(',').map(Number)) {
  const w = buildWorld(seed); let n = 0, fan = 0, full = 0, half = 0; const ej = []
  for (const s of w.segments) { if (s.route < 0 || s.air) continue; n++; if (!s.fan) continue; fan++
    const f = s.fan; if (f.a >= s.length && f.b >= s.length) { full++; ej.push(`w${s.way.idx} ${s.kind}/r${s.route} L=${s.length.toFixed(0)}`) } else if (f.a >= s.length || f.b >= s.length) { half++; ej.push(`w${s.way.idx} ${s.kind}/r${s.route} L=${s.length.toFixed(0)} a=${f.a.toFixed(0)} b=${f.b.toFixed(0)}`) } }
  const as = w.segments.filter((s) => s.fan && s.fan.a < s.length).map((s) => s.fan.a).sort((a, b) => a - b)
  console.log(`seed ${seed}: tramos de ruta ${n}, con abanico ${fan}, cerrados enteros ${full}, una punta sin abrir ${half}; retardo mediano ${as[as.length >> 1]?.toFixed(0)} max ${as.at(-1)?.toFixed(0)} relax ${JSON.stringify(w.relax)}`)
  console.log('   ' + ej.slice(0, 12).join(' | '))
}
