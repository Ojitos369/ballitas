import * as THREE from 'three'
import { buildWorld, setWorldPicks, WORLD_GEN } from '../world.js'
import { crearInterpolador, decodificarRapida } from './interpola.js'

const fases=['born','toDest','at','toPort','travel','dying','gone']
const vector=(a)=>new THREE.Vector3(...(a||[0,0,0]))

export function conectarRemoto({ url, semilla=369, timeout=5000 }={}) {
  return new Promise((resolve,reject)=>{
    let ws
    let terminado=false, conectado=false, timer=setTimeout(()=>fallar(new Error('timeout')),timeout), epoca=null, seq=0, retry=0, pingTimer=null
    const listeners=new Map(), pendientes=new Map(), registry=new Map(), ballitas=[], reloj={ t:0 }
    const emitir=(e,x)=>listeners.get(e)?.forEach(fn=>fn(x))
    const fallar=(e)=>{ if(terminado)return; terminado=true; clearTimeout(timer); try{ws?.close()}catch{}; reject(e) }
    const id=()=>{ let x=localStorage.getItem('ballitas:espectador'); if(!x){x=crypto.randomUUID();localStorage.setItem('ballitas:espectador',x)} return x }
    const enviar=(k,p={})=>new Promise((res)=>{if(ws.readyState!==1)return res({ok:false,error:'sin_conexion'});const q=++seq;pendientes.set(q,res);ws.send(JSON.stringify({k,q,...p}));setTimeout(()=>{const f=pendientes.get(q);if(f){pendientes.delete(q);f({ok:false,error:'timeout'})}},5000)})
    let interp, estado='conectando', fast=[]
    const api={ world:null,ballitas,t:0,stats:{},feed:[],seed:semilla,pop:0,rng:Math.random,tick(dt){api.t+=dt; interp?.cuadro(performance.now()/1000+offset);},where(b){return where(api.world,b)},favorites(){return {}},modo:'remoto',get estado(){return estado},yo:{corto:''},fila:[],espectadores:0,reglas:{maxSinDecidir:3,maxFila:30,maxNombre:16},puede:{velocidad:false},nombreSugerido(){return `Ballita-${Math.random().toString(36).slice(2,6)}`},formar(nombre){return enviar('formar',{nombre})},salirFila(){return enviar('salirFila')},tomar(b){return enviar('tomar',{b:typeof b==='object'?b.id:b})},dejar(b){return enviar('dejar',{b:typeof b==='object'?b.id:b})},decidir(b,dec){return enviar('decidir',{b:typeof b==='object'?b.id:b,...dec})},opciones(b){const node=typeof b==='object'?b.node:b;return {origen:node,planetas:api.world.destinos,rutas:api.world.waysFrom[node]||[],carriles:[0,1,2,3,4]}},on(e,fn){if(!listeners.has(e))listeners.set(e,new Set());listeners.get(e).add(fn);return()=>listeners.get(e)?.delete(fn)},cerrar(){clearInterval(pingTimer);try{ws.close()}catch{}}}
    let offset=0
    const updateSlow=(l)=>{
      let b=registry.get(l.id)
      if(!b){b={id:l.id,pos:new THREE.Vector3(),dir:new THREE.Vector3(0,0,1),up:new THREE.Vector3(0,1,0),phase:'born',genome:{prefs:[],ways:[],routes:[],kinds:[]},log:[],visited:[],mechs:{},dec:{},snap:0,flight:null,sw:null,walk:null};registry.set(b.id,b);ballitas.push(b)}
      Object.assign(b,l)
      b.arch=l.arch||b.arch; b.pos ||=new THREE.Vector3();b.dir ||=new THREE.Vector3(0,0,1);b.up ||=new THREE.Vector3(0,1,0)
      b.dest=l.dest==null?null:api.world.destinos[l.dest];b.way=l.way==null?null:api.world.ways[l.way];b.route=l.route==null?null:api.world.routes[l.route];b.plannedRoute=l.plannedRoute==null?null:api.world.routes[l.plannedRoute]
      b.flight=b.flight||null;b.sw=b.sw||null;b.ctrl=l.ctrl;b.mia=!!l.ctrl&&l.ctrl===api.yo.corto;b.dec=l.dec||{};b.sinDecidir=l.sinDecidir||0;b.auto=l.auto||null
      if(l.r)fast.push(l.r)
    }
    const abrir=(reconecta=false)=>{
    ws=new WebSocket(url)
    ws.onerror=()=>{if(!conectado)fallar(new Error('websocket'))}
    ws.onopen=()=>ws.send(JSON.stringify({k:'hola',v:1,id:id(),...(epoca?{epoca,n:Math.round(api.t*30)}:{})}))
    ws.onclose=()=>{if(terminado)return;if(!conectado){fallar(new Error('websocket'));return} estado='reconectando';emitir('cambio',api);const wait=[1000,2000,4000,8000,15000][Math.min(retry++,4)];setTimeout(()=>abrir(true),wait)}
    ws.onmessage=(ev)=>{let m;try{m=JSON.parse(ev.data)}catch{return}
      if(m.k==='hola'&&m.b){ if(m.worldGen!==WORLD_GEN){if(!conectado)fallar(new Error('worldGen'));return} const primera=!conectado;const epocaNueva=!!epoca&&epoca!==m.epoca;if(epocaNueva){for(const b of ballitas)b.phase='gone';ballitas.length=0;registry.clear();fast=[];api.world=null} if(!api.world||epocaNueva){setWorldPicks(m.semilla,m.picks);api.world=buildWorld(m.semilla)} api.seed=m.semilla; epoca=m.epoca; api.yo=m.yo||api.yo;api.stats=m.stats||{};api.feed=m.feed||[];api.fila=(m.fila||[]).map(x=>({...x,mia:x.de===api.yo.corto}));api.espectadores=m.espectadores||0;api.reglas=m.reglas||api.reglas;api.t=m.t||0;for(const l of m.b)updateSlow(l); interp=crearInterpolador(api.world,ballitas,registry);interp.ingestar({t:m.t,n:m.n,b:fast}); fast=[];offset=m.t-performance.now()/1000;estado='listo';retry=0;conectado=true;clearTimeout(timer);if(!pingTimer)pingTimer=setInterval(()=>{if(ws?.readyState===1)ws.send(JSON.stringify({k:'ping',c:performance.now()}))},25000);if(primera)resolve(api);emitir('cambio',api);return }
      if(m.k==='i'){offset+=(m.t-(performance.now()/1000+offset))*.08;api.t=m.t;const vivos=new Set();for(const r of m.b){vivos.add(r[0]);if(!registry.has(r[0])){const d=decodificarRapida(r);updateSlow({id:d.id,phase:fases[r[1]],node:0,genome:{prefs:[],ways:[],routes:[],kinds:[]}})}} interp?.ingestar({t:m.t,n:m.n,b:m.b});for(const b of ballitas){if(!vivos.has(b.id)&&b.phase!=='gone'){b.phase='gone';registry.delete(b.id);emitir('libre',b)}}return }
      if(m.k==='d'){for(const b of m.b||[])updateSlow(b);for(const b of m.nace||[])updateSlow(b);if(m.fila)api.fila=m.fila.map(x=>({...x,mia:x.de===api.yo.corto}));if(m.stats)api.stats=m.stats;if(m.feed)api.feed=m.feed;if(m.espectadores!=null)api.espectadores=m.espectadores;emitir('cambio',m);return}
      if(m.k==='ok'||m.k==='error'){const f=pendientes.get(m.q);if(f){pendientes.delete(m.q);f(m.k==='ok'?{ok:true,...m}:{ok:false,error:m.error})}}
    }
    }
    abrir()
  })
}

function where(world,b){const n=world.nodes[b.node]?.name||'';return b.phase==='travel'?`Camino: ${b.way?.theme?.name||''} · carril ${(b.carril||0)+1}/5`:`En ${n}${b.dest?`: ${b.phase==='toDest'?'va a ':''}${b.dest.name}`:''}`}
