import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  globalSetup: require.resolve('./tests/global-setup.ts'),
  timeout: 180 * 1000, // 180 seconds (3 minutes)
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
    video: 'retain-on-failure',
    baseURL: 'http://localhost:3456'
  },

  // Web servers: test pages + AI CLI bridge
  webServer: [
    {
      command: 'npx http-server tests/test-pages -p 3456 --silent',
      port: 3456,
      reuseExistingServer: !process.env.CI,
      timeout: 120 * 1000
    },
    {
      command: 'node ../claude-code-bridge/index.js',
      port: 3000,
      reuseExistingServer: true,
      timeout: 30 * 1000
    }
  ],

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome']
        // headless defaults to true, can be overridden with --headed flag
      },
      testMatch: [
        // Include all E2E tests
        'e2e/**/*.spec.ts',
        // Include tests in root tests directory
        '*.spec.ts',
        // Include unit tests
        'unit/**/*.spec.ts',
        // Specifically include Monaco tests
        'e2e/monaco-automated.spec.ts'
      ]
    }
  ],
})