import * as THREE from 'three'
import { BALL_R, NODE_R, laneFrame, laneLength, switchPath } from '../world.js'

const mix = (a, b, u) => a + (b - a) * u
const phases = ['born', 'toDest', 'at', 'toPort', 'travel', 'dying', 'gone']
const vec = (a, out) => out.set(a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0)
const MAX_CUADROS = 8 // instantáneas en el búfer (0,8 s a 10 Hz)

export function decodificarRapida(r) {
  return { id:r[0], phase:phases[r[1]] ?? 'born', p:r[2], e:r[3], speed:r[4], timer:r[5], pos:r[6], dir:r[7], up:r[8], seg:r[9], segT:r[10], lane:r[11], carril:r[12], lat:r[13], hy:r[14], off:r[15], ang:r[16], roll:r[17], slope:r[18], impact:r[19], vis:r[20], flags:r[21], event:r[22], flightT:r[23], walkI:r[24], walkT:r[25] }
}

// Búfer de instantáneas + colocación por cuadro (docs/mundo_compartido.md, 2.4). `cuadro(ahora)` recibe el reloj
// estimado del servidor y dibuja en `ahora − 0,15 s`, entre las DOS instantáneas que rodean ese instante (por eso
// el búfer guarda varias: con solo dos, el instante de dibujo queda siempre antes de la primera y el mundo va a saltos).
export function crearInterpolador(world, ballitas, registry) {
  const F = {}, P = {}, tmp = new THREE.Vector3()
  let cuadros = []
  const api = { ingestar, cuadro, vaciar: () => { cuadros = [] }, tDibujo: 0 }
  function ingestar(frame) {
    const byId = new Map(frame.b.map((r) => { const d=decodificarRapida(r), b=registry.get(r[0]); d.way=b?.way?.idx??null; d.node=b?.node??null; return [r[0],d] }))
    if (cuadros.length && frame.t <= cuadros[cuadros.length-1].t) cuadros = [] // el reloj retrocedió (mundo nuevo): empezar de cero
    cuadros.push({ ...frame, byId })
    if (cuadros.length > MAX_CUADROS) cuadros.shift()
  }
  function cuadro(now) {
    const n = cuadros.length
    if (!n) return
    const T = now - 0.15
    let i = n - 2
    while (i > 0 && cuadros[i].t > T) i--
    const A = cuadros[Math.max(0, i)], B = cuadros[Math.min(n - 1, Math.max(0, i) + 1)]
    const t = Math.max(A.t, Math.min(B.t, T)), u = B.t > A.t ? (t - A.t) / (B.t - A.t) : 1
    api.tDibujo = t
    const begin = performance.now()
    for (let k = 0; k < B.b.length; k++) {
      const r = B.b[k], b = registry.get(r[0]), a = A.byId.get(r[0]), z = B.byId.get(r[0])
      if (!b || !z) continue
      // estado discreto: el de la instantánea de llegada
      b.phase = z.phase
      b.seg = b.way?.segments[z.seg] || null; b.segT=z.segT; b.lane=z.lane; b.carril=z.carril
      b.airborne=!!(z.flags&1); b.onLane=!!(z.flags&2)
      const sw = b.seg && z.event >= 0 ? b.seg.switches[z.event] || null : null
      b.flight = (z.flags & 4) && sw ? { sw, t:z.flightT, failed:!!(z.flags&8) } : null
      b.sw = sw ? { s:sw, failed:!!(z.flags&8) } : null
      b.walk = z.walkI>=0 ? { path:b.walkPath||[], i:z.walkI, t:z.walkT } : null
      const salto = a ? (a.pos[0]-z.pos[0])**2+(a.pos[1]-z.pos[1])**2+(a.pos[2]-z.pos[2])**2 > 900 : true
      if (!a || a.phase !== z.phase || a.vis < .5 || z.vis < .5 || salto) {
        // sin interpolar (nace, cambia de fase, portal): se salta al estado de llegada
        b.pos.fromArray(z.pos); vec(z.dir,b.dir); vec(z.up,b.up)
        b.p=z.p; b.e=z.e; b.speed=z.speed; b.timer=z.timer; b.vis=z.vis; b.lat=z.lat; b.hy=z.hy; b.off=z.off; b.ang=z.ang; b.roll=z.roll; b.slope=z.slope; b.impact=z.impact
        continue
      }
      if (z.phase === 'travel' && a.way === z.way && a.seg === z.seg && a.lane === z.lane && !(a.flags & 4) && !(z.flags & 4)) {
        const seg = b.way?.segments[z.seg]
        if (seg) { const f = laneFrame(seg, z.lane, mix(a.segT,z.segT,u), F); b.pos.copy(f.pos).addScaledVector(f.side,mix(a.lat,z.lat,u)).addScaledVector(f.up,mix(a.hy,z.hy,u)); b.dir.copy(f.tangent); b.up.copy(f.up) }
        else b.pos.fromArray(z.pos)
      } else if (z.phase === 'travel' && a.way === z.way && a.seg !== z.seg && !(a.flags & 4) && !(z.flags & 4)) {
        const w = b.way, sa = w?.segments[a.seg], sb = w?.segments[z.seg]
        if (sa && sb && sa.route === sb.route) {
          const la=laneLength(sa,a.lane), lb=laneLength(sb,z.lane), left=(1-a.segT)*la, total=left+z.segT*lb, d=u*total
          const s=d<=left?sa:sb, lane=d<=left?a.lane:z.lane, st=d<=left?a.segT+d/la:(d-left)/lb
          const f=laneFrame(s,lane,st,F); b.pos.copy(f.pos).addScaledVector(f.side,mix(a.lat,z.lat,u)).addScaledVector(f.up,mix(a.hy,z.hy,u)); b.dir.copy(f.tangent); b.up.copy(f.up)
          if (d<=left) { b.seg=sa; b.segT=st; b.lane=a.lane } // aún en el tramo anterior
        } else b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
      } else if (z.phase === 'travel' && a.way === z.way && (a.flags & 4) && (z.flags & 4) && a.seg === z.seg && a.event === z.event) {
        const s=b.way?.segments[z.seg], sw2=s?.switches[z.event]
        if (sw2) { const f=switchPath(s,sw2,mix(a.flightT,z.flightT,u),P); b.pos.copy(f.pos); b.dir.copy(f.tangent); b.up.copy(f.up); if (b.flight) b.flight.t=mix(a.flightT,z.flightT,u) }
        else b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
      } else if (z.phase === 'travel') {
        b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
        b.dir.fromArray(a.dir).lerp(vec(z.dir,tmp),u).normalize(); b.up.fromArray(a.up).lerp(vec(z.up,tmp),u).normalize()
      } else {
        const node=world.nodes[z.node ?? b.node]
        b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
        if (node) b.pos.sub(node.pos).normalize().multiplyScalar(NODE_R+BALL_R).add(node.pos)
        b.dir.fromArray(a.dir).lerp(vec(z.dir,tmp),u).normalize(); b.up.fromArray(a.up).lerp(vec(z.up,tmp),u).normalize()
      }
      if (b.seg === (b.way?.segments[z.seg] || null)) b.segT=mix(a.seg===z.seg?a.segT:0,z.segT,u)
      b.p=mix(a.p,z.p,u); b.e=mix(a.e,z.e,u); b.speed=mix(a.speed,z.speed,u); b.timer=mix(a.timer,z.timer,u); b.vis=mix(a.vis,z.vis,u); b.lat=mix(a.lat,z.lat,u); b.hy=mix(a.hy,z.hy,u); b.off=mix(a.off,z.off,u); b.ang=mix(a.ang,z.ang,u); b.roll=mix(a.roll,z.roll,u); b.slope=mix(a.slope,z.slope,u); b.impact=mix(a.impact,z.impact,u)
    }
    return performance.now()-begin
  }
  return api
}
