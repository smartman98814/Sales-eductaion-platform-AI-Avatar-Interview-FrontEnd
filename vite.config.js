import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: ProcessingInstruction.env.VITE_BACNEND_URL || 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

