import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/flask': { target: 'http://flask-app:5000', rewrite: (p) => p.replace(/^\/api\/flask/, '') },
      '/api/django': { target: 'http://django-app:8000', rewrite: (p) => p.replace(/^\/api\/django/, '') },
      '/api/report': { target: 'http://go-report-svc:8080', rewrite: (p) => p.replace(/^\/api\/report/, '') },
    }
  }
})
