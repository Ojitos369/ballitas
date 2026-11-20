import { chromium } from 'file:///C:/Users/ojito/AppData/Local/Temp/claude/16c39c74d688ef56/66ad59e0-d323-4be2-8707-8e648cba3105/scratchpad/pw/node_modules/playwright-core/index.mjs'
import { writeFileSync } from 'node:fs'

const browser=await chromium.launch({channel:'msedge',headless:false,args:['--window-size=1400,950','--ignore-gpu-blocklist']})
const errors=[]
try {
  const page=await (await browser.newContext({viewport:{width:1400,height:900}})).newPage()
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text())})
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto('http://localhost:4302/?local=1')
  await page.waitForSelector('canvas',{timeout:90000})
  await page.waitForTimeout(12000)
  await page.screenshot({path:'_capturas/p2_local_general.jpg',type:'jpeg',quality:82})
  const dots=page.locator('.puntos .punto')
  if(await dots.count()) await dots.first().click()
  await page.keyboard.press('3')
  await page.waitForTimeout(12000)
  await page.screenshot({path:'_capturas/p2_local_pov.jpg',type:'jpeg',quality:82})
  writeFileSync('_capturas/p2_local_resultado.json',JSON.stringify({errores:errors,ballitas:await dots.count(),modo:await page.locator('.dato').first().innerText()},null,2))
} finally { await browser.close() }
