const mod = process.argv[2]; const W = await import(mod)
let tot = 0; const out = []
for (let seed = 369; seed < 379; seed++) { const t = performance.now(); const w = W.buildWorld(seed); const ms = performance.now() - t; tot += ms; out.push(`${seed}:${(ms / 1000).toFixed(1)}s${w.failed ? '[FALLO]' : ''}(i${w.attempt})`) }
console.log(mod, out.join(' '), 'media', (tot / 10000).toFixed(2), 's')