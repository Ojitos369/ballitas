import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/ballitas-playwright/node_modules/playwright-core/index.mjs'
const b = await chromium.launch({ channel: 'msedge', args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] })
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
  await p.goto('http://localhost:4307/?local=1')
  await p.waitForTimeout(12000)
  await p.evaluate(() => document.querySelector('[aria-label="Velocidad por ocho"]')?.click())
  const out = []
  for (let i = 0; i <= 12; i++) {
    const r = await p.evaluate(() => { window.gc?.(); return { heap: Math.round(performance.memory.usedJSHeapSize / 1048576), geos: window.__r3f?.gl?.info?.memory?.geometries } })
    const geos = await p.evaluate(() => { try { const c = document.querySelector('canvas'); return c?.__r3f ? null : null } catch { return null } })
    out.push(r.heap); console.log(`t=${i * 30}s heap=${r.heap} MB`)
    if (i < 12) await p.waitForTimeout(30000)
  }
  console.log('serie', out.join(','))
} finally { await b.close() }
