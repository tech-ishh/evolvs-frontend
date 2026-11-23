import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    sourcemap: false, // users can't see your original React code
  },
  esbuild: {
    drop: ['console', 'debugger'], // removes console.log/error from the build
  },
})
