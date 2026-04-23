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

    const headed = process.env.HEADED === '1' || process.env.SLOW === '1'
    console.log(`🖥️  Browser mode: ${headed ? 'HEADED' : 'headless'} (HEADED=${process.env.HEADED}, SLOW=${process.env.SLOW})`)

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !headed,
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        '--enable-file-cookies'
      ],
      slowMo: process.env.SLOW_MO ? parseInt(process.env.SLOW_MO) : undefined,
      viewport: { width: 1920, height: 1080 },
    })

    // Seed vibeStudioEnabled in extension config so AI tests can find the Generate with AI button
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const seedExtId = new URL(sw.url()).host
    const seedPage = await context.newPage()
    const seedUrl = `chrome-extension://${seedExtId}/tests/seed.html`
    await seedPage.goto(seedUrl)
    await seedPage.waitForFunction(() => typeof (window as any).seed === 'function', { timeout: 5000 })

    // When PLASMO_PUBLIC_ANTHROPIC_ENDPOINT points at a proxy (e.g. the
    // internal llmproxy.absmartly-dev.com), prefer PLASMO_PUBLIC_ANTHROPIC_API_KEY
    // because the proxy expects its own key format (llmp_sk_...). Only fall
    // back to ANTHROPIC_API_KEY (the direct Anthropic key, sk-ant-...) when
    // no endpoint override is configured and we're calling api.anthropic.com
    // directly.
    const anthropicEndpoint = process.env.PLASMO_PUBLIC_ANTHROPIC_ENDPOINT || ''
    const anthropicApiKey = anthropicEndpoint
      ? (process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || '')
      : (process.env.ANTHROPIC_API_KEY || process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || '')

    const defaultConfig = {
      apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '',
      apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '',
      authMethod: process.env.PLASMO_PUBLIC_ABSMARTLY_AUTH_METHOD || 'apikey',
      domChangesFieldName: '__dom_changes',
      vibeStudioEnabled: true,
      aiProvider: anthropicApiKey ? 'anthropic-api' : 'claude-subscription',
      aiApiKey: '',
      // Use the Anthropic model ALIASES (no date suffix) so tests work both
      // against api.anthropic.com direct and against the internal proxy at
      // llmproxy.absmartly-dev.com which only maps alias names.
      llmModel: 'claude-sonnet-4-5',
      providerModels: { 'anthropic-api': 'claude-sonnet-4-5' },
      providerEndpoints: anthropicEndpoint ? { 'anthropic-api': anthropicEndpoint } : {}
    }

    const seedData: Record<string, unknown> = {
      'absmartly-config': defaultConfig,
      'plasmo:absmartly-config': defaultConfig
    }

    if (anthropicApiKey) {
      seedData['ai-apikey'] = anthropicApiKey
      seedData['plasmo:ai-apikey'] = anthropicApiKey
    }

    await seedPage.evaluate((data) => (window as any).seed(data), seedData)
    await seedPage.close()

    await use(context)
    await Promise.race([
      context.close(),
      new Promise<void>(resolve => setTimeout(resolve, 30000))
    ])
  },

  extensionId: async ({ context }, use) => {
    // Wait for service worker to be available
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }

    // Extract extension ID from service worker URL
    const extensionId = new URL(sw.url()).host

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