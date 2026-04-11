import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Pyodide uses its own module loading system and must not be pre-bundled
    exclude: ['pyodide'],
  },
})
