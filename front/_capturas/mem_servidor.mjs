// Servidor del mundo a 30x con 10 clientes de consola: heapUsed cada minuto durante 10 min (vía /salud).
import { spawn } from 'node:child_process'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const env = { ...process.env, MUNDO_PUERTO: '8391', MUNDO_VELOCIDAD: '30', MUNDO_API: '', MUNDO_DATOS: process.argv[2] }
const srv = spawn(process.execPath, ['--expose-gc', '../back/mundo/servidor.bundle.mjs'], { env, stdio: 'ignore' })
let cli
try {
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:8391/salud')).ok) break } catch {} await sleep(500) }
  cli = spawn(process.execPath, ['../back/mundo/cliente_prueba.mjs', 'carga', 'ws://127.0.0.1:8391', '10', '640'], { stdio: 'ignore' })
  for (let m = 0; m <= 10; m++) {
    const s = await (await fetch('http://127.0.0.1:8391/salud')).json()
    console.log(`min ${m}`, JSON.stringify(Object.fromEntries(Object.entries(s).filter(([k]) => /mem|heap|rss|conex|espect/i.test(k)))))
    if (m < 10) await sleep(60000)
  }
} finally { cli?.kill(); srv.kill() }
