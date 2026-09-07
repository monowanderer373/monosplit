import { defineConfig, devices } from '@playwright/test'
import { loadProductionSmokeEnvironment } from './e2e/fixtures/productionSmoke'

const smoke = loadProductionSmokeEnvironment()

export default defineConfig({
  testDir: './e2e',
  testMatch: 'production-phase3-smoke.spec.ts',
  outputDir: 'test-results/production-phase3',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 15 * 60_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ['list'],
    ['html', {
      outputFolder: 'playwright-report/production-phase3',
      open: 'never',
    }],
  ],
  use: {
    ...devices['Pixel 7'],
    baseURL: smoke.productionUrl,
    channel: process.platform === 'win32' ? 'msedge' : undefined,
    locale: 'en-MY',
    timezoneId: 'Asia/Kuala_Lumpur',
    permissions: ['clipboard-read', 'clipboard-write'],
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'off',
    screenshot: 'only-on-failure',
    video: 'off',
  },
})
