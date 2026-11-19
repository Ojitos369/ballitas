import * as W from '../src/Core/world.js'
W.DIAG.on = true
const t = performance.now(); const w = W.buildWorld(+(process.argv[2] ?? 369)); const ms = performance.now() - t
const r = W.DIAG.rechazos; const ks = Object.keys(r).sort((a, b) => r[b] - r[a]).slice(0, 14)
console.log((ms / 1000).toFixed(1), 's', ks.map((k) => `${k}=${r[k]}`).join('  '))
