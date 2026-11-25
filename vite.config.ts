import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { defineConfig } from 'vite'

const dirname = import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the site at /seen-history/
  base: '/seen-history/',
  // Inline all JS/CSS into dist/index.html so the built site is a single self-contained file.
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    assetsInlineLimit: 100000000,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
})
