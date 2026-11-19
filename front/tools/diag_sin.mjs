import * as W from '../src/Core/world.js'
const w = W.buildWorld(369); let best = 0; let at = null
for (const way of w.ways) for (const s of way.segments) { if (!s._braid?.sin) continue; const br = s._braid
  for (const l of s.lanes) { const P = br.P[l.id]; for (let i = 1; i < br.N; i++) { const a=[P[i*3]-P[i*3-3],P[i*3+1]-P[i*3-2],P[i*3+2]-P[i*3-1]]; const b=[P[i*3+3]-P[i*3],P[i*3+4]-P[i*3+1],P[i*3+5]-P[i*3+2]]; const la=Math.hypot(...a), lb=Math.hypot(...b); const an=Math.acos(Math.max(-1,Math.min(1,(a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(la*lb))))*57.3; if (an>best){best=an;at={way:way.idx,kind:s.kind,L:s.length,N:br.N,lane:l.id,i,la,lb,env:br.env[i],delay:W.braidDelay(s),ramps:W.braidRamps(s),fan:s.fan}} } } }
console.log(best, JSON.stringify(at))
