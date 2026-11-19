import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1400,900', '--ignore-gpu-blocklist'] })
const p = await b.newPage({ viewport: { width: 1400, height: 900 } })
await p.goto('http://127.0.0.1:4413/?stats=1')
await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
await p.waitForTimeout(4000)
await p.keyboard.press('3'); await p.waitForTimeout(1000)
const th = () => p.evaluate(() => { const s=window.__ballitasDebug.cam.selected; return s?.way?.theme?.id })
for (let i=0;i<10;i++){ await p.evaluate((n)=>document.querySelectorAll('.punto')[n]?.click(), i); await p.waitForTimeout(500); if (await th()==='volcan') break }
await p.waitForTimeout(9000)
const r = await p.evaluate(() => { const d=window.__ballitasDebug; const cp=d.camera.position; const out={}; d.scene.traverse(o=>{ if(!(o.isMesh)||!o.visible) return; let vis=true; for(let a=o.parent;a;a=a.parent) if(!a.visible) vis=false; if(!vis) return; const g=o.geometry; g.computeBoundingSphere(); const c=g.boundingSphere.center.clone().applyMatrix4(o.matrixWorld); const dist=c.distanceTo(cp); if(!o.isInstancedMesh && dist>60) return; const k=(g.name||'?')+'|'+o.material.type+'|'+(o.isInstancedMesh?'I'+o.count:'M')+'|'+(o.material.color?.getHexString?.()??''); out[k]=Math.min(out[k]??1e9, Math.round(dist)) }); return out })
console.log(JSON.stringify(r,null,0).replace(/,"/g,'\n"'))
await b.close()
