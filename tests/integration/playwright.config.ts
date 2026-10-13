import { defineConfig } from '@playwright/test'
import extensionConfig from '../../playwright.config'

// Manual compatibility check only: no default E2E discovery or automatic retries.
// It talks to a real environment and live AI, so the Node egress guard is off.
process.env.E2E_LIVE_BACKEND = '1'
export default defineConfig({
  ...extensionConfig,
  testDir: __dirname,
  testIgnore: [],
  projects: [{ name: 'live-provider', testMatch: 'live-provider.spec.ts' }],
  workers: 1,
  retries: 0
})
