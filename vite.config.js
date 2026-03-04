import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [ tailwindcss(), react() ],
  server: {
    proxy: {
      // Log download and stations endpoints -> Node.js server (port 3000)
      '/api/logs': {
        target: 'http://192.168.2.11:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/api/stations': {
        target: 'http://192.168.2.11:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      '/api/health': {
        target: 'http://192.168.2.11:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api')
      },
      // File processing endpoints -> Python backend (port 8080)
      '/api/process-file': {
        target: 'http://192.168.2.11:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/api/update-cp-report': {
        target: 'http://192.168.2.11:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/api/cp-details': {
        target: 'http://192.168.2.11:8080',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
})
