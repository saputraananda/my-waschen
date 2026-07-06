import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Standardize asset imports
      '@asset': path.resolve(__dirname, 'public/asset'),
      '@': path.resolve(__dirname, 'src'),
      // Asset folder alias
      '~assets': path.resolve(__dirname, 'src/assets'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    // ─── HMR: disable untuk menghindari duplicate React di browser ──────
    hmr: false,
    // ─── Proxy: semua request /api/* diteruskan ke backend Express ──────
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
        timeout: 0,
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (err.code === 'ECONNREFUSED') {
              console.warn('[Vite Proxy] Backend belum siap di port 5000. Pastikan server.js sudah running.');
              if (res && res.writeHead) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Backend server belum running.' }));
              }
            } else {
              console.error('[Vite Proxy Error]', err.message);
            }
          });
          proxy.on('econnreset', (err, req, res) => {
            console.warn('[Vite Proxy] Connection reset oleh backend.');
          });
        },
      },
    },
  },
  build: {
    target: 'es2020',
    reportCompressedSize: true,
    chunkSizeWarningLimit: 1000,
    // ─── Optimize chunking for better performance ──────────────────────
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'chart-vendor': ['recharts'],
          'pdf-xlsx-vendor': ['jspdf', 'jspdf-autotable', 'xlsx'],
          'ui-vendor': ['framer-motion', 'sonner', 'lucide-react'],
        }
      }
    },
    // ─── Minify and optimize build ─────────────────────────────────────
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'axios', 'recharts', 'xlsx', 'jspdf'],
    esbuildOptions: {
      target: 'es2020'
    }
  },
  // ─── Optimize assets ─────────────────────────────────────────────────
  assetsInclude: ['**/*.lottie'],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    include: ['src/**/*.test.{js,jsx}', 'api/tests/**/*.test.{js,jsx}'],
  },
});
