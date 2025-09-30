import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup.ts'),
  timeout: 60 * 1000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['html', { open: process.env.SLOW === '1' ? 'always' : 'never' }], ['list']],
  use: {
    actionTimeout: 0,
    trace: 'on-first-retry',
    video: 'retain-on-failure'
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        launchOptions: {
          slowMo: 1000 // Slow down by 1 second between actions
        }
      },
      testMatch: [
        // Include all E2E tests
        'e2e/**/*.spec.ts',
        // Include tests in root tests directory
        '*.spec.ts',
        // Specifically include Monaco tests
        'e2e/monaco-automated.spec.ts'
      ]
    }
  ],
})