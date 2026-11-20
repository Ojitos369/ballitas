import * as W from '../src/Core/world.js'
const t0 = performance.now(); const w = W.buildWorld(369); const t1 = performance.now()
W.setWorldPicks(369, JSON.parse(JSON.stringify(w.picks)))
const r = []; for (let i = 0; i < 4; i++) { const a = performance.now(); W.buildWorld(369); r.push(Math.round(performance.now() - a)) }
W.SINUOSO.off = true
const r2 = []; for (let i = 0; i < 4; i++) { const a = performance.now(); W.buildWorld(369); r2.push(Math.round(performance.now() - a)) }
console.log('gen', Math.round(t1 - t0), 'con picks sinuoso', r.join(' '), '| sin sinuoso', r2.join(' '), '| sinMs', JSON.stringify(w.sinuosoT || {}))
