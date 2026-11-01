import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

export default defineConfig({
  root: fileURLToPath(new URL('./ui', import.meta.url)),
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': fileURLToPath(new URL('../src/renderer/src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../src/shared', import.meta.url))
    }
  },
  build: {
    outDir: fileURLToPath(new URL('../dist-tauri', import.meta.url)),
    emptyOutDir: true,
    target: 'es2020'
  },
  server: {
    port: 5199,
    strictPort: true,
    fs: {
      // The entry imports the shared renderer sources outside `tauri/ui`.
      allow: [repoRoot]
    }
  }
})
