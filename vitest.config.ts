import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  // Mirrors the app build so tests can import modules that read it (src/version.ts).
  define: {
    __APP_VERSION__: JSON.stringify('test'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Only exists when vite-plugin-pwa is in the pipeline (i.e. not here).
      'virtual:pwa-register/react': path.resolve(__dirname, './src/test/stubs/pwa-register.ts'),
    },
  },
})
