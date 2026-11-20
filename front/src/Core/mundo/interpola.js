import * as THREE from 'three'
import { BALL_R, NODE_R, laneFrame, laneLength, switchPath } from '../world.js'

const mix = (a, b, u) => a + (b - a) * u
const phases = ['born', 'toDest', 'at', 'toPort', 'travel', 'dying', 'gone']
const vec = (a, out) => out.set(a?.[0] ?? 0, a?.[1] ?? 0, a?.[2] ?? 0)

export function decodificarRapida(r) {
  return { id:r[0], phase:phases[r[1]] ?? 'born', p:r[2], e:r[3], speed:r[4], timer:r[5], pos:r[6], dir:r[7], up:r[8], seg:r[9], segT:r[10], lane:r[11], carril:r[12], lat:r[13], hy:r[14], off:r[15], ang:r[16], roll:r[17], slope:r[18], impact:r[19], vis:r[20], flags:r[21], event:r[22], flightT:r[23], walkI:r[24], walkT:r[25] }
}

export function crearInterpolador(world, ballitas, registry) {
  const F = {}, P = {}, tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3()
  let A = null, B = null
  const ingestar = (frame) => { A = B; B = { ...frame, byId: new Map(frame.b.map((r) => { const d=decodificarRapida(r), b=registry.get(r[0]); d.way=b?.way?.idx??null; d.node=b?.node??null; return [r[0],d] })) } }
  const cuadro = (now) => {
    if (!A || !B) return
    const t = Math.max(A.t, Math.min(B.t, now - 0.15)), u = B.t > A.t ? (t - A.t) / (B.t - A.t) : 1
    const begin = performance.now()
    for (let i = 0; i < B.b.length; i++) {
      const r = B.b[i], b = registry.get(r[0]), a = A.byId.get(r[0]), z = B.byId.get(r[0])
      if (!b || !z) continue
      const salto = a ? (a.pos[0]-z.pos[0])**2+(a.pos[1]-z.pos[1])**2+(a.pos[2]-z.pos[2])**2 > 900 : true
      if (!a || a.phase !== z.phase || a.phase === 'travel' && z.phase !== 'travel' || a.vis < .5 || z.vis < .5 || salto) { b.pos.fromArray(r[6]); b.phase = z.phase; continue }
      b.phase = z.phase
      b.seg = b.way?.segments[z.seg] || null; b.segT=z.segT; b.lane=z.lane; b.carril=z.carril; b.lat=z.lat; b.hy=z.hy
      b.flight = z.flags & 4 ? { sw:b.seg?.switches[z.event]||null, t:z.flightT, failed:!!(z.flags&8) } : null
      b.sw = b.seg && z.event >= 0 ? { s:b.seg.switches[z.event], failed:!!(z.flags&8) } : null
      if(z.walkI>=0) b.walk={path:b.walk?.path||[],i:z.walkI,t:z.walkT}; else b.walk=null
      if (z.phase === 'travel' && a.way === z.way && a.seg === z.seg && a.lane === z.lane && !(a.flags & 4) && !(z.flags & 4)) {
        const seg = b.way?.segments[z.seg]
        if (seg) { const f = laneFrame(seg, z.lane, mix(a.segT,z.segT,u), F); b.pos.copy(f.pos).addScaledVector(f.side,mix(a.lat,z.lat,u)).addScaledVector(f.up,mix(a.hy,z.hy,u)); b.dir.copy(f.tangent); b.up.copy(f.up) }
        else b.pos.fromArray(r[6])
      } else if (z.phase === 'travel' && a.way === z.way && a.seg !== z.seg) {
        const w = b.way, sa = w?.segments[a.seg], sb = w?.segments[z.seg]
        if (sa && sb && sa.route === sb.route) {
          const la=laneLength(sa,a.lane), lb=laneLength(sb,z.lane), left=(1-a.segT)*la, total=left+z.segT*lb, d=u*total
          const s=d<=left?sa:sb, lane=d<=left?a.lane:z.lane, st=d<=left?a.segT+d/la:(d-left)/lb
          const f=laneFrame(s,lane,st,F); b.pos.copy(f.pos).addScaledVector(f.side,mix(a.lat,z.lat,u)).addScaledVector(f.up,mix(a.hy,z.hy,u)); b.dir.copy(f.tangent); b.up.copy(f.up)
        } else b.pos.fromArray(r[6])
      } else if (z.phase === 'travel' && a.way === z.way && (a.flags & 4) && (z.flags & 4) && a.seg === z.seg && a.event === z.event) {
        const s=b.way?.segments[z.seg], sw=s?.switches[z.event]
        if (sw) { const f=switchPath(s,sw,mix(a.flightT,z.flightT,u),P); b.pos.copy(f.pos); b.dir.copy(f.tangent); b.up.copy(f.up) }
        else b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
      } else if (z.phase === 'travel') {
        b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
      } else {
        const node=world.nodes[z.node ?? b.node]
        b.pos.fromArray(a.pos).lerp(vec(z.pos,tmp),u)
        if (node) b.pos.sub(node.pos).normalize().multiplyScalar(NODE_R+BALL_R).add(node.pos)
      }
      b.p=mix(a.p,z.p,u); b.e=mix(a.e,z.e,u); b.speed=mix(a.speed,z.speed,u); b.timer=mix(a.timer,z.timer,u); b.vis=mix(a.vis,z.vis,u); b.lat=mix(a.lat,z.lat,u); b.hy=mix(a.hy,z.hy,u); b.off=mix(a.off,z.off,u); b.ang=mix(a.ang,z.ang,u); b.roll=mix(a.roll,z.roll,u); b.slope=mix(a.slope,z.slope,u); b.impact=mix(a.impact,z.impact,u); b.airborne=!!(z.flags&1); b.onLane=!!(z.flags&2)
      if(z.phase!=='travel'||(z.flags&4)){b.dir.lerp(vec(z.dir,tmp),u).normalize(); b.up.lerp(vec(z.up,tmp),u).normalize()}
    }
    return performance.now()-begin
  }
  return { ingestar, cuadro }
}
