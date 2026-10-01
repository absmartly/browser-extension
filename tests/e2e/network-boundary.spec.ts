import { test, expect } from '../fixtures/extension'

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
