import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { ensureExtensionBuilt } from './setup'

// Ensure seed.html is copied to build directory before tests run
function ensureSeedFileExists() {
  const seedSource = path.join(__dirname, '..', 'seed.html')
  const buildDir = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
  const seedDest = path.join(buildDir, 'tests', 'seed.html')
  const seedDestDir = path.dirname(seedDest)

  // Create tests directory if it doesn't exist
  if (!fs.existsSync(seedDestDir)) {
    fs.mkdirSync(seedDestDir, { recursive: true })
  }

  // Copy seed.html if it doesn't exist or is outdated
  if (!fs.existsSync(seedDest) ||
      fs.statSync(seedSource).mtime > fs.statSync(seedDest).mtime) {
    fs.copyFileSync(seedSource, seedDest)
    console.log('Copied seed.html to build directory')
  }
}

type ExtFixtures = {
  context: BrowserContext
  extensionId: string
  extensionUrl: (p: string) => string
  seedStorage: (kv: Record<string, unknown>) => Promise<void>
  clearStorage: () => Promise<void>
  getStorage: () => Promise<Record<string, unknown>>
}

export const test = base.extend<ExtFixtures>({
  context: async ({}, use) => {
    // Extension build is already ensured in global setup
    // Don't rebuild here to avoid multiple rebuilds per test

    const extPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    // Verify extension was built successfully
    if (!fs.existsSync(extPath)) {
      throw new Error(`Extension build directory not found: ${extPath}`)
    }

    // Ensure seed.html is in the build directory
    ensureSeedFileExists()

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      // headless is controlled by Playwright config and --headed flag
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        // Allow extensions to run on file:// URLs
        '--enable-file-cookies'
      ],
      // Add slow motion for debugging if needed
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : undefined,
      // Use larger viewport for better testing
      viewport: { width: 1920, height: 1080 },
    })

    await use(context)
    await context.close()
  },

  extensionId: async ({ context }, use) => {
    // Wait for service worker to be available
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }

    // Extract extension ID from service worker URL
    const extensionId = new URL(sw.url()).host
    console.log('Extension ID:', extensionId)

    await use(extensionId)
  },

  extensionUrl: async ({ extensionId }, use) => {
    await use((p: string) => `chrome-extension://${extensionId}/${p.replace(/^\//, '')}`)
  },

  seedStorage: async ({ context, extensionUrl }, use) => {
    const fn = async (kv: Record<string, unknown>) => {
      const page = await context.newPage()
      await page.goto(extensionUrl('tests/seed.html'))

      // Wait for the seed function to be available
      await page.waitForFunction(() => typeof (window as any).seed === 'function', { timeout: 5000 })

      // Seed the storage
      const result = await page.evaluate((data) => (window as any).seed(data), kv)

      if (result !== 'ok') {
        throw new Error('Failed to seed storage')
      }

      await page.close()
    }
    await use(fn)
  },

  clearStorage: async ({ context, extensionUrl }, use) => {
    const fn = async () => {
      const page = await context.newPage()
      await page.goto(extensionUrl('tests/seed.html'))

      // Wait for the clear function to be available
      await page.waitForFunction(() => typeof (window as any).clear === 'function', { timeout: 5000 })

      // Clear the storage
      const result = await page.evaluate(() => (window as any).clear())

      if (result !== 'ok') {
        throw new Error('Failed to clear storage')
      }

      await page.close()
    }
    await use(fn)
  },

  getStorage: async ({ context, extensionUrl }, use) => {
    const fn = async (): Promise<Record<string, unknown>> => {
      const page = await context.newPage()
      await page.goto(extensionUrl('tests/seed.html'))

      // Wait for the getAll function to be available
      await page.waitForFunction(() => typeof (window as any).getAll === 'function', { timeout: 5000 })

      // Get all storage
      const items = await page.evaluate(() => (window as any).getAll())

      await page.close()
      return items as Record<string, unknown>
    }
    await use(fn)
  },
})

export const expect = base.expect