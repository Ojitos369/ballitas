import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { crearInterpolador, decodificarRapida } from './interpola.js'

test('decodifica la tupla rápida de la sección 2.3 sin alterar índices', () => {
  const r=[7,4,1.2,3.4,5.6,.7,[1,2,3],[0,0,1],[0,1,0],2,.34567,3,4,.125,.25,.5,.6,.7,.8,9.1,.9,7,1,.42,5,.75]
  const b=decodificarRapida(r)
  assert.equal(b.id,7); assert.equal(b.phase,'travel'); assert.equal(b.seg,2); assert.equal(b.segT,.34567)
  assert.equal(b.flags,7); assert.equal(b.event,1); assert.equal(b.walkI,5); assert.equal(b.walkT,.75)
})

test('la transición de vuelo a pista sigue en el camino y no se proyecta al planeta', () => {
  const b={id:1,node:0,way:{idx:0,segments:[]},pos:new THREE.Vector3(),dir:new THREE.Vector3(0,0,1),up:new THREE.Vector3(0,1,0)}
  const reg=new Map([[1,b]]), interp=crearInterpolador({nodes:[{pos:new THREE.Vector3(100,0,0)}]},[b],reg)
  const frame=(t,x,flags)=>({t,b:[[1,4,1,1,1,0,[x,0,0],[0,0,1],[0,1,0],0,.5,1,2,0,0,0,0,0,0,0,1,flags,0,.5,-1,0]]})
  interp.ingestar(frame(1,0,0)); interp.ingestar(frame(1.1,10,4)); interp.cuadro(1.2)
  assert.ok(Math.abs(b.pos.x-5)<1e-9)
})
