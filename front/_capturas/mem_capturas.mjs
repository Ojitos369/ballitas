// Capturas MEM: vista general y POV (tecla 3) tras N s a 8x, ya con caminos expulsados de la caché.
import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/ballitas-playwright/node_modules/playwright-core/index.mjs'
const [url, dir, seg = '150'] = process.argv.slice(2)
const b = await chromium.launch({ channel: 'msedge' })
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
  const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()) })
  await p.goto(url); await p.waitForTimeout(12000)
  await p.evaluate(() => document.querySelector('[aria-label="Velocidad por ocho"]')?.click())
  await p.waitForTimeout(Number(seg) * 1000)
  await p.screenshot({ path: `${dir}/mem_general.jpg`, quality: 70 })
  await p.keyboard.press('3'); await p.waitForTimeout(10000)
  await p.screenshot({ path: `${dir}/mem_pov.jpg`, quality: 70 })
  console.log('errores', errs.length, errs.slice(0, 5).join(' | '))
} finally { await b.close() }
