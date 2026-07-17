import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
  test: {
    // jsdom para renderizar componentes React (Testing Library). Os testes de
    // lib/ são puros e rodam igual aqui.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'lib/**/*.test.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'app/**/*.test.{ts,tsx}',
    ],
    // E2E (Playwright) fica fora do Vitest
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
