import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // ─── HMR: disable untuk menghindari duplicate React di browser ──────
    // Kalau mau enable HMR lagi, ubah ke: hmr: { overlay: false }
    hmr: false,
    // ─── Proxy: semua request /api/* diteruskan ke backend Express ──────
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}'],
  },
});