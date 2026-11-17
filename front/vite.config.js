import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // En desarrollo el back (uvicorn) corre aparte; en producción lo sirve el mismo origen.
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
