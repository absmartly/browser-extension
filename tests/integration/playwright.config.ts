import { defineConfig } from '@playwright/test'
import extensionConfig from '../../playwright.config'

// Manual compatibility check only: no default E2E discovery or automatic retries.
export default defineConfig({
  ...extensionConfig,
  testDir: __dirname,
  testIgnore: [],
  projects: [{ name: 'live-provider', testMatch: 'live-provider.spec.ts' }],
  workers: 1,
  retries: 0
})
