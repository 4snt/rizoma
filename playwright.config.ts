import { defineConfig, devices } from '@playwright/test'

/**
 * Config Playwright (testes de sistema/E2E).
 * Por padrão aponta para localhost:3000; ajuste BASE_URL para testar produção
 * (ex.: BASE_URL=https://rizoma.flipafile.com npx playwright test).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})
