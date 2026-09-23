import { test as base, expect, chromium, type Page, type FrameLocator } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const repo = path.resolve(__dirname, '../..')
const build = path.join(repo, 'build/chrome-mv3-prod')

type Fixture = { page: Page; sidebar: FrameLocator; origin: string; mount: () => Promise<void> }

export const test = base.extend<Fixture>({
  origin: async ({}, use) => {
    const html = readFileSync(path.join(__dirname, 'offline.html'))
    const sdk = readFileSync(path.join(repo, 'node_modules/@absmartly/javascript-sdk/dist/absmartly.min.js'))
    const script = readFileSync(path.join(__dirname, 'offline.js'))
    const server = createServer((req, res) => {
      const resource = req.url?.split('?')[0]
      const data = resource === '/' ? html : resource === '/visual-editor-test.html' ? readFileSync(path.join(repo, 'tests/test-pages/visual-editor-test.html')) : resource === '/sdk.js' ? sdk : resource === '/offline.js' ? script : null
      res.writeHead(data ? 200 : 404, { 'Content-Type': resource?.endsWith('.js') ? 'application/javascript' : 'text/html', 'Cache-Control': 'no-store' })
      res.end(data || 'No management API in this fixture')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const address = server.address() as { port: number }
    try { await use(`http://localhost:${address.port}`) } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  },
  page: async ({ origin }, use, testInfo) => {
    const manifest = JSON.parse(readFileSync(path.join(build, 'manifest.json'), 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    const profile = mkdtempSync(path.join(tmpdir(), 'launchpad-repro-'))
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium', headless: process.env.HEADED !== '1',
      viewport: { width: 1440, height: 1000 },
      args: [`--disable-extensions-except=${build}`, `--load-extension=${build}`],
    })
    const events: unknown[] = []
    await context.route('**/*', route => {
      const url = new URL(route.request().url())
      if (/^https?:$/.test(url.protocol) && url.origin !== origin) return route.abort('blockedbyclient')
      return route.continue()
    })
    await context.tracing.start({ screenshots: true, snapshots: true })
    const page = context.pages()[0]
    page.on('pageerror', error => events.push({ type: 'pageerror', message: error.message }))
    page.on('console', msg => { if (msg.type() === 'error') events.push({ type: 'console', text: msg.text() }) })
    page.on('framenavigated', frame => events.push({ type: 'navigation', url: frame.url() }))
    page.on('framedetached', frame => events.push({ type: 'detach', url: frame.url() }))
    page.on('requestfailed', request => events.push({ type: 'requestfailed', url: request.url().split('?')[0], error: request.failure()?.errorText }))
    try {
      await page.goto(origin)
      await expect(page.locator('#sdk-status')).toHaveText('Offline SDK ready')
      await use(page)
    } finally {
      await page.screenshot({ path: testInfo.outputPath('final.png') }).catch(() => {})
      await testInfo.attach('runtime-events', { body: JSON.stringify({ manifestVersion: manifest.version, events }, null, 2), contentType: 'application/json' })
      await context.tracing.stop({ path: testInfo.outputPath('trace.zip') })
      await context.close()
      rmSync(profile, { recursive: true, force: true })
    }
  },
  mount: async ({ page }, use) => {
    await use(async () => {
      const context = page.context()
      const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker')
      const id = new URL(worker.url()).host
      // Explicit iframe seam, NOT native toolbar activation. Real packaged UI.
      await page.evaluate(url => {
        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.src = url
        iframe.style.cssText = 'position:fixed;right:0;top:0;width:384px;height:100vh;border:0;background:white;z-index:2147483647'
        document.body.appendChild(iframe)
      }, `chrome-extension://${id}/tabs/sidebar.html`)
      await expect(page.locator('#absmartly-sidebar-iframe')).toHaveCount(1)
      await expect(page.frameLocator('#absmartly-sidebar-iframe').getByRole('button', { name: 'Configure Settings' })).toBeVisible()
    })
  },
  sidebar: async ({ page, mount }, use) => {
    await mount()
    await use(page.frameLocator('#absmartly-sidebar-iframe'))
  },
})

export { expect }
