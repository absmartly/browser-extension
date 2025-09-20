import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'

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
    const extPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    // Verify extension is built
    if (!fs.existsSync(extPath)) {
      throw new Error(`Extension not built! Run 'npm run build' first. Path: ${extPath}`)
    }

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      // Note: Extensions may not work properly in headless mode
      // If tests fail, try headless: false
      headless: process.env.HEADLESS !== 'false',
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`
      ],
      // Add slow motion for debugging if needed
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : undefined,
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