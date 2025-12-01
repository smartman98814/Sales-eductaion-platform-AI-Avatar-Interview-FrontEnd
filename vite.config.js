import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://sales-education-platform-with-ai-avatar.onrender.com',
        changeOrigin: true,
      },
    },
  },
})

