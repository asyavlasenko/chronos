import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// У dev усі запити на /api проксуються на backend (локально — localhost:4000,
// у docker-compose.dev.yml — http://backend:4000 через VITE_API_PROXY).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
