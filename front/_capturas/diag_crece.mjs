import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
const b = await chromium.launch({ channel: 'msedge', headless: false, args: ['--window-size=1320,800', '--ignore-gpu-blocklist'] })
try {
  const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  await p.goto('http://localhost:4302/?stats=1')
  await p.waitForFunction(() => window.__ballitasDebug?.gl, null, { timeout: 60000 })
  await p.waitForTimeout(8000)
  await p.evaluate(() => {
    const div = document.querySelector('canvas').parentElement; const k = Object.keys(div).find((x) => x.startsWith('__reactFiber'))
    let f = div[k]; let sim = null; while (f) { if (f.memoizedProps?.sim && !sim) sim = f.memoizedProps.sim; f = f.return }
    const find = (fib, d = 0) => { for (let c = fib; c && d < 400; c = c.sibling) { if (c.memoizedProps?.onFollowBallita) return c.memoizedProps.onFollowBallita; const x = c.child && find(c.child, d + 1); if (x) return x } return null }
    let root = div[k]; while (root.return) root = root.return
    find(root)(sim.ballitas.find((x) => x.phase === 'travel'))
  })
  await p.waitForTimeout(1500); await p.evaluate(() => document.querySelector('.pov-btn')?.click()); await p.waitForTimeout(6000)
  for (let i = 0; i < 25; i++) {
    const r = await p.evaluate(() => { const out = []; window.__ballitasDebug.scene.traverse((o) => { if (!o.isInstancedMesh || o.count <= 0) return; let q = o; while (q && q.visible) q = q.parent; if (q) return; const c = Math.min(o.userData.__creceC ?? Infinity, o.userData.__crece ?? Infinity); if (c != null && Number.isFinite(c)) out.push([+c.toFixed(1), o.geometry.name || o.material.name || o.material.type, o.count, o.userData.noCull ? 'dueño' : 'culler']) }); return out.sort((a, b) => a[0] - b[0]).slice(0, 4) })
    console.log(JSON.stringify(r)); await p.waitForTimeout(800)
  }
} finally { await b.close().catch(() => {}) }