import { defineConfig } from '@playwright/test'

// Opt-in regression coverage for defects found during isolated exploration.
// Deliberately independent of the default suite's credentials/global setup.
export default defineConfig({
  testDir: __dirname,
  testMatch: ['launchpad.spec.ts', 'expanded.spec.ts', 'preview.spec.ts', 'filters.spec.ts', 'post-save-filters.spec.ts', 'sdk-events.spec.ts'],
  timeout: 45000,
  expect: { timeout: 5000 },
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['json', { outputFile: `${process.env.REPRO_OUTPUT_DIR || '/tmp/opencode/launchpad-reproductions'}/report.json` }],
  ],
  outputDir: process.env.REPRO_OUTPUT_DIR || '/tmp/opencode/launchpad-reproductions',
})
