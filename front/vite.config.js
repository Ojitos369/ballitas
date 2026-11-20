import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))

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
  server: { proxy: { '/api': 'http://127.0.0.1:8000' } },
})
