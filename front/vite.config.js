import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

const BACK = process.env.VITE_BACK || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        control: resolve(__dirname, 'control.html'),
      },
    },
  },
  // En desarrollo el back (uvicorn) corre aparte; en producción lo sirve el mismo origen.
  // `ws: true`: el mundo compartido va por WebSocket en /api/ws. VITE_BACK cambia el destino (pruebas en otro puerto).
  server: { proxy: { '/api': { target: BACK, ws: true } } },
  preview: { proxy: { '/api': { target: BACK, ws: true } } },
})
