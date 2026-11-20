import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const BACK = process.env.VITE_BACK || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  // control.html (demo de la interfaz de control con mundo falso) solo se sirve en `pnpm dev`; no va a producción.
  // En desarrollo el back (uvicorn) corre aparte; en producción lo sirve el mismo origen.
  // `ws: true`: el mundo compartido va por WebSocket en /api/ws. VITE_BACK cambia el destino (pruebas en otro puerto).
  server: { proxy: { '/api': { target: BACK, ws: true } } },
  preview: { proxy: { '/api': { target: BACK, ws: true } } },
})
