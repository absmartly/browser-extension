import { test, expect } from '../fixtures/extension'
import { createServer } from 'node:http'

// The deterministic boundary must abort and record unexpected egress from both
// the extension service worker and an ordinary page. This test expects exactly
// these violations, so it opts out of the fixture's teardown failure for them.
test('unexpected service-worker and page requests are aborted and recorded', async ({ context, networkBoundary }) => {
  // Only these exact hosts are tolerated at teardown; anything else still fails.
  test.info().annotations.push({ type: 'expected-boundary-violation', description: 'https://egress-probe.example.org https://dev-1.absmartly.com' })

  const [worker] = context.serviceWorkers()
  const fromWorker = await worker.evaluate(async () => {
    try {
      await fetch('https://egress-probe.example.org/worker')
      return 'reached'
    } catch (error) {
      return `blocked: ${(error as Error).message}`
    }
  })
  expect(fromWorker).toMatch(/^blocked: /)

  const page = await context.newPage()
  await page.goto('http://localhost:3456/visual-editor-test.html')
  const fromPage = await page.evaluate(async () => {
    try {
      await fetch('https://egress-probe.example.org/page', { mode: 'no-cors' })
      return 'reached'
    } catch (error) {
      return `blocked: ${(error as Error).message}`
    }
  })
  expect(fromPage).toMatch(/^blocked: /)

  // A real shared-environment host is blocked the same way: the controlled
  // origin is forwarded locally; any other ABsmartly host is not.
  const sharedEnv = await worker.evaluate(async () => fetch('https://dev-1.absmartly.com/v1/experiments').then(() => 'reached', () => 'blocked'))
  expect(sharedEnv).toBe('blocked')

  expect(networkBoundary.violations).toEqual([
    { method: 'GET', url: 'https://egress-probe.example.org/worker', source: 'service-worker' },
    { method: 'GET', url: 'https://egress-probe.example.org/page', source: 'http://localhost:3456/visual-editor-test.html' },
    { method: 'GET', url: 'https://dev-1.absmartly.com/v1/experiments', source: 'service-worker' }
  ])
  expect(() => networkBoundary.assertNoViolations()).toThrow(/Unexpected network egress/)
  await page.close()
})

for (const scenario of ['unrouteAll', 'unroute', 'page continue', 'context continue'] as const) {
  test(`non-provider egress stays blocked after ${scenario}`, async ({ context, networkBoundary, managementApi }) => {
    // A real, reachable loopback receiver makes a bypass observable without
    // letting the regression probe contact any external service.
    const received: string[] = []
    const server = createServer((req, res) => {
      received.push(req.url || '/')
      res.writeHead(200, { 'Access-Control-Allow-Origin': '*' })
      res.end('unexpected egress reached the receiver')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`
    test.info().annotations.push({ type: 'expected-boundary-violation', description: origin })
    const page = await context.newPage()
    try {
      await page.goto('http://localhost:3456/visual-editor-test.html')
      if (scenario === 'unrouteAll') await context.unrouteAll()
      else if (scenario === 'unroute') await context.unroute('**/*')
      else if (scenario === 'page continue') await page.route('**/*', route => route.continue())
      else await context.route('**/*', route => route.continue())

      const fetchResult = async (url: string) => fetch(url, { mode: 'no-cors' }).then(() => 'reached', () => 'blocked')
      const fromPage = await page.evaluate(fetchResult, `${origin}/page`)
      const fromWorker = await context.serviceWorkers()[0].evaluate(fetchResult, `${origin}/worker`)
      expect({ fromPage, fromWorker, received }).toEqual({ fromPage: 'blocked', fromWorker: 'blocked', received: [] })
      expect(networkBoundary.violations).toEqual([
        { method: 'GET', url: `${origin}/page`, source: 'http://localhost:3456/visual-editor-test.html' },
        { method: 'GET', url: `${origin}/worker`, source: 'service-worker' }
      ])
      // Route cleanup must preserve local API forwarding as well as blocking.
      const status = await context.serviceWorkers()[0].evaluate(async ({ origin, apiKey }) => {
        const response = await fetch(`${origin}/v1/experiments`, { headers: { Authorization: `Api-Key ${apiKey}` } })
        return response.status
      }, { origin: managementApi.origin, apiKey: managementApi.apiKey })
      expect(status).toBe(200)
    } finally {
      await page.close()
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  })
}
