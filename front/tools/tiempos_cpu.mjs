// Tiempo de CPU (no de reloj: aguanta un equipo cargado) de buildWorld por semilla.  uso: node tools/tiempos_cpu.mjs <world.js|url>
const mod = process.argv[2]; const W = await import(mod)
let tot = 0; const out = []
for (let seed = 369; seed < 379; seed++) { const c = process.cpuUsage(); const w = W.buildWorld(seed); const u = process.cpuUsage(c); const s = (u.user + u.system) / 1e6; tot += s; out.push(`${seed}:${s.toFixed(1)}${w.failed ? '[FALLO]' : ''}`) }
console.log(mod.slice(-40), out.join(' '), 'media CPU', (tot / 10).toFixed(2), 's')
