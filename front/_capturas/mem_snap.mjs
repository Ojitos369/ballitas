// Sonda MEM: instantáneas de montón (CDP) a lo largo del tiempo en modo local a 8×, para comparar por constructor.
// uso: node mem_snap.mjs <url> <dirSalida> <playwright index.mjs> <candado> <segundos,separados,por,coma>
import { writeFileSync, existsSync, statSync, rmSync, createWriteStream } from 'node:fs'
import { pathToFileURL } from 'node:url'
const [url, dir, pw, lock, tiempos = '15,75'] = process.argv.slice(2)
const { chromium } = await import(pathToFileURL(pw).href)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
while (existsSync(lock) && Date.now() - statSync(lock).mtimeMs < 600000) await sleep(30000)
writeFileSync(lock, 'mem ' + process.pid)
const b = await chromium.launch({ channel: 'msedge', args: ['--js-flags=--expose-gc', '--enable-precise-memory-info'] })
try {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } })
  await p.goto(url); await p.waitForTimeout(12000)
  await p.evaluate(() => document.querySelector('[aria-label="Velocidad por ocho"]')?.click())
  const cdp = await p.context().newCDPSession(p)
  const t0 = Date.now()
  for (const s of tiempos.split(',').map(Number)) {
    await sleep(Math.max(0, t0 + s * 1000 - Date.now()))
    await cdp.send('HeapProfiler.collectGarbage')
    const heap = await p.evaluate(() => Math.round(performance.memory.usedJSHeapSize / 1048576))
    const f = `${dir}/snap_${s}.heapsnapshot`; const ws = createWriteStream(f)
    const h = (e) => ws.write(e.chunk); cdp.on('HeapProfiler.addHeapSnapshotChunk', h)
    await cdp.send('HeapProfiler.takeHeapSnapshot', { reportProgress: false })
    cdp.off('HeapProfiler.addHeapSnapshotChunk', h); await new Promise((r) => ws.end(r))
    console.log(`t=${s}s heap=${heap} MB -> ${f}`)
  }
} finally { await b.close(); try { rmSync(lock) } catch {} }
