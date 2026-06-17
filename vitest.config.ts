import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'lib/**/*.test.tsx'],
    // E2E (Playwright) fica fora do Vitest
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
