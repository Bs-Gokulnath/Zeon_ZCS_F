import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [ tailwindcss(), react() ],
  server: {
    proxy: {
      '/api': {
        // target: 'http://100.109.133.78:8080',
        // target: 'http://localhost:8000',
        target: 'http://192.168.2.11:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
