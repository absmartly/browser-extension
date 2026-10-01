import { test as base, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { ensureExtensionBuilt } from './setup'
import { waitForConfigInitialization } from '../helpers/config-readiness'
import { createProviderServer, createLiveProvider, type ProviderController } from '../helpers/provider-server'
import { installProviderGuard } from '../helpers/provider-network'
import { createManagementApi, type ManagementApi } from '../helpers/management-api/server'
import { installNetworkBoundary, type NetworkBoundary } from '../helpers/network-boundary'
import { installNodeEgressGuard, nodeEgressViolations } from '../helpers/node-egress-guard'

// Origin of the local static server for extension-owned target pages.
export const TEST_PAGE_ORIGIN = 'http://localhost:3456'

// In CI we run e2e against the production bundle (chrome-mv3-prod) so any
// Plasmo/Parcel bundling regression surfaces before reaching Chrome Web Store.
// v1.4.2 shipped a content script that threw "Cannot find module
// '@plasmohq/storage'" because Parcel externalised it; only the prod bundle
// had that issue, the dev bundle masked it. Locally we keep using
// chrome-mv3-dev because `npm run dev` is the normal authoring loop.
const EXTENSION_BUILD_NAME = process.env.CI ? 'chrome-mv3-prod' : 'chrome-mv3-dev'

// Ensure seed.html is copied to build directory before tests run
function ensureSeedFileExists() {
  const seedSource = path.join(__dirname, '..', 'seed.html')
  const buildDir = path.join(__dirname, '..', '..', 'build', EXTENSION_BUILD_NAME)
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
  liveAI: boolean
  // Manual integration only: talk to the environment's real management API.
  liveBackend: boolean
  aiProvider: ProviderController
  managementApi: ManagementApi
  networkBoundary: NetworkBoundary
  context: BrowserContext
  extensionId: string
  extensionUrl: (p: string) => string
  seedStorage: (kv: Record<string, unknown>) => Promise<void>
  clearStorage: () => Promise<void>
  getStorage: () => Promise<Record<string, unknown>>
}

export const test = base.extend<ExtFixtures>({
  liveAI: [false, { option: true }],
  liveBackend: [false, { option: true }],
  managementApi: async ({ liveBackend }, use) => {
    // Worker-process Node guard: test code may only reach loopback.
    if (!liveBackend) installNodeEgressGuard()
    const api = await createManagementApi()
    try { await use(api) } finally { await api.close() }
  },
  aiProvider: async ({ liveAI }, use) => {
    const provider = liveAI
      ? createLiveProvider(process.env.PLASMO_PUBLIC_ANTHROPIC_ENDPOINT, process.env.PLASMO_PUBLIC_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY)
      : await createProviderServer()
    try { await use(provider); provider.assertComplete() } finally { await provider.close() }
  },
  networkBoundary: async ({ context }, use) => {
    await use((context as BrowserContext & { __boundary: NetworkBoundary }).__boundary)
  },
  context: async ({ aiProvider, liveAI, liveBackend, managementApi }, use, testInfo) => {
    // Extension build is already ensured in global setup
    // Don't rebuild here to avoid multiple rebuilds per test

    const extPath = path.join(__dirname, '..', '..', 'build', EXTENSION_BUILD_NAME)

    // Verify extension was built successfully
    if (!fs.existsSync(extPath)) {
      const cmd = process.env.CI ? 'bun run build' : 'bun run build:dev'
      throw new Error(`Extension build directory not found: ${extPath}. Run '${cmd}' first.`)
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

    // Deterministic mode: the management API is a local stateful fixture
    // behind an allow-listed synthetic origin, the AI provider is scripted,
    // and every other http(s) request (pages and service worker) is aborted.
    let boundary: NetworkBoundary | undefined
    if (!liveBackend) {
      boundary = await installNetworkBoundary(context, {
        allowedOrigins: [TEST_PAGE_ORIGIN, new URL(aiProvider.endpoint).origin],
        forwards: { [managementApi.origin]: managementApi.url }
      })
      ;(context as BrowserContext & { __boundary?: NetworkBoundary }).__boundary = boundary
    }
    if (!liveAI) await installProviderGuard(context, aiProvider)

    // Keep timing/status evidence for live flakes without headers, keys,
    // request bodies or customer response data.
    const startedAt = Date.now()
    const requests = new Map<import('@playwright/test').Request, number>()
    const network: Array<Record<string, unknown>> = []
    context.on('request', request => {
      if (!/^https?:/.test(request.url())) return
      const url = new URL(request.url())
      requests.set(request, network.length)
      network.push({ method: request.method(), host: url.host, path: url.pathname,
        items: url.searchParams.get('items'), startMs: Date.now() - startedAt })
    })
    context.on('response', response => {
      const index = requests.get(response.request())
      if (index !== undefined) {
        const headers = response.headers()
        const rateLimit = Object.fromEntries(Object.entries(headers).filter(([name]) =>
          /^(retry-after(-ms)?|anthropic-ratelimit-unified-[a-z0-9-]+)$/.test(name)))
        Object.assign(network[index], {status: response.status(), headersMs: Date.now() - startedAt, rateLimit})
      }
    })
    context.on('requestfinished', request => {
      const index = requests.get(request)
      if (index !== undefined) network[index].finishedMs = Date.now() - startedAt
    })
    context.on('requestfailed', request => {
      const index = requests.get(request)
      if (index !== undefined) Object.assign(network[index], {failedMs: Date.now() - startedAt, error: request.failure()?.errorText})
    })

    // Seed vibeStudioEnabled in extension config so AI tests can find the Generate with AI button
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    await waitForConfigInitialization(sw)
    const seedExtId = new URL(sw.url()).host
    const seedPage = await context.newPage()
    const seedUrl = `chrome-extension://${seedExtId}/tests/seed.html`
    await seedPage.goto(seedUrl)
    await seedPage.waitForFunction(() => typeof (window as any).seed === 'function', { timeout: 5000 })

    const anthropicEndpoint = aiProvider.endpoint
    const anthropicApiKey = aiProvider.apiKey

    const defaultConfig = {
      apiKey: liveBackend ? process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || '' : managementApi.apiKey,
      apiEndpoint: liveBackend ? process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || '' : managementApi.origin,
      authMethod: 'apikey',
      domChangesFieldName: '__dom_changes',
      vibeStudioEnabled: true,
      aiProvider: 'anthropic-api',
      aiApiKey: '',
      // Match the alias used by the deterministic native Anthropic contract.
      llmModel: 'claude-sonnet-4-5',
      providerModels: { 'anthropic-api': 'claude-sonnet-4-5' },
      providerEndpoints: anthropicEndpoint ? { 'anthropic-api': anthropicEndpoint } : {}
    }

    const seedData: Record<string, unknown> = {
      'absmartly-config': defaultConfig,
      'plasmo:absmartly-config': defaultConfig
    }

    // The ABsmartly API key lives in the local-area secret store; getConfig
    // overrides config.apiKey with `absmartly-apikey`, so seed both.
    const absmartlyApiKey = defaultConfig.apiKey
    if (absmartlyApiKey) {
      seedData['absmartly-apikey'] = absmartlyApiKey
      seedData['plasmo:absmartly-apikey'] = absmartlyApiKey
    }

    if (anthropicApiKey) {
      seedData['ai-apikey'] = anthropicApiKey
      seedData['plasmo:ai-apikey'] = anthropicApiKey
    }

    await seedPage.evaluate((data) => (window as any).seed(data), seedData)

    await seedPage.close()

    try {
      await use(context)
    } finally {
      const timingPath = testInfo.outputPath('request-timings.json')
      fs.mkdirSync(path.dirname(timingPath), {recursive: true})
      fs.writeFileSync(timingPath, JSON.stringify(network, null, 2))
      await testInfo.attach('request-timings', {path: timingPath, contentType: 'application/json'})
      if (!liveBackend) {
        await testInfo.attach('management-api-calls', { body: JSON.stringify({ calls: managementApi.calls, issues: managementApi.issues, egress: boundary?.violations }, null, 2), contentType: 'application/json' })
      }
    }
    await Promise.race([
      context.close(),
      new Promise<void>(resolve => setTimeout(resolve, 30000))
    ])
    // Fail the test (after teardown evidence) on contract issues, missing
    // fixture routes or any blocked egress, even if every assertion passed.
    if (!liveBackend) {
      managementApi.assertClean()
      if (nodeEgressViolations().length) throw new Error(`Node egress attempted: ${JSON.stringify(nodeEgressViolations())}`)
      // A spec may declare exact origins it probes on purpose; all other
      // egress still fails the test.
      const expected = testInfo.annotations.filter(a => a.type === 'expected-boundary-violation')
        .flatMap(a => (a.description || '').split(/\s+/).filter(Boolean))
      const unexpected = (boundary?.violations || []).filter(v => !expected.includes(new URL(v.url).origin))
      if (unexpected.length) throw new Error(`Unexpected network egress:\n${unexpected.map(v => `- ${v.method} ${v.url} (${v.source})`).join('\n')}`)
    }
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

  seedStorage: async ({ context, extensionUrl, aiProvider }, use) => {
    const fn = async (kv: Record<string, unknown>) => {
      // Register configured AI transports before storage events can trigger a
      // fetch. Office endpoints and target-page URLs are not provider routes.
      for (const [key, raw] of Object.entries(kv)) {
        let value = raw
        if (typeof raw === 'string') {
          try { value = JSON.parse(raw) } catch { /* Storage can contain raw strings. */ }
        }
        if (key.replace(/^plasmo:/, '') === 'absmartly-config' && value && typeof value === 'object') {
          const endpoints = (value as { providerEndpoints?: Record<string, string> }).providerEndpoints || {}
          for (const endpoint of Object.values(endpoints)) {
            if (typeof endpoint === 'string' && endpoint) aiProvider.registerEndpoint(endpoint)
          }
        }
        if (key.replace(/^plasmo:/, '') === 'claudeBridgeEndpoint' && typeof value === 'string' && value) aiProvider.registerEndpoint(value)
        if (key.replace(/^plasmo:/, '') === 'claudeBridgePort' && value) aiProvider.registerEndpoint(`http://localhost:${value}`)
      }
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
