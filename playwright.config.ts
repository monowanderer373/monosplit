import { defineConfig, devices } from '@playwright/test'

const localSupabaseUrl = 'http://127.0.0.1:54321'
const localSupabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:5173',
    // Traces, screenshots, and video can retain authenticated URLs, request
    // headers, or invite tokens from the local abuse journeys.
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        channel: process.platform === 'win32' ? 'msedge' : undefined,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 5173',
    url: 'http://127.0.0.1:5173',
    env: {
      // Browser tests are intentionally pinned to the disposable local stack.
      VITE_SUPABASE_URL: localSupabaseUrl,
      VITE_SUPABASE_ANON_KEY: localSupabaseAnonKey,
    },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
