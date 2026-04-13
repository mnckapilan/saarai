/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/saarai/',
  optimizeDeps: {
    // Pyodide uses its own module loading system and must not be pre-bundled
    exclude: ['pyodide'],
  },
  worker: {
    // Bundle workers as ES modules so dynamic imports work inside them.
    format: 'es',
  },
  server: {
    headers: {
      // Cross-origin isolation is required for SharedArrayBuffer (used by the
      // Pyodide interrupt mechanism). Without these headers, Atomics.store()
      // is unavailable and the stop fallback (worker termination) is used.
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          monaco: ['monaco-editor'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
