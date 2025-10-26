import { test, expect } from '@playwright/test'

const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

test('Debug: Check exposure tracker state', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]`, msg.text())
  })

  await page.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.waitForSelector('body', { timeout: 5000 })

  // Set URL
  await page.evaluate(() => {
    history.pushState({}, '', '/products/123')
  })

  // Inject SDK mock
  await page.evaluate(() => {
    (window as any).absmartly = {
      Context: class {
        constructor() {}
        async ready() { return Promise.resolve() }
        data() {
          return {
            experiments: [{
              name: 'debug_test',
              variants: [
                { config: JSON.stringify({ __dom_changes: [] }) },
                {
                  config: JSON.stringify({
                    __dom_changes: {
                      changes: [{
                        selector: '#test-element',
                        type: 'text',
                        value: 'Test Content'
                      }],
                      urlFilter: {
                        include: ['/products/*'],
                        mode: 'simple',
                        matchType: 'path'
                      }
                    }
                  })
                }
              ]
            }]
          }
        }
        treatment(experimentName: string) { return 1 }
        peek(experimentName: string) { return 1 }
        override(experimentName: string, variant: number) {}
      }
    }
  })

  // Load plugin
  await page.addScriptTag({
    path: 'public/absmartly-sdk-bridge.bundle.js'
  })

  // Initialize plugin
  await page.evaluate(() => {
    const context = new (window as any).absmartly.Context();
    (window as any).__testContext = context

    const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
    const plugin = new DOMChangesPlugin({
      context,
      autoApply: true,
      spa: true,
      dataSource: 'variable',
      dataFieldName: '__dom_changes',
      debug: true
    })

    return plugin.initialize()
  })

  // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

  // Debug exposure tracker state
  const debugInfo = await page.evaluate(() => {
    const context = (window as any).__testContext
    const plugin = context.__domPlugin
    const tracker = plugin?.exposureTracker

    return {
      pluginExists: !!plugin,
      trackerExists: !!tracker,
      experimentsMapExists: !!tracker?.experiments,
      experimentsMapType: tracker?.experiments ? Object.prototype.toString.call(tracker.experiments) : 'N/A',
      experimentsCount: tracker?.experiments?.size,
      experimentNames: tracker?.experiments ? Array.from(tracker.experiments.keys()) : [],
      hasDebugTest: tracker?.experiments?.has('debug_test'),
      experimentDetails: tracker?.experiments?.get('debug_test') ? {
        experimentName: tracker.experiments.get('debug_test').experimentName,
        variant: tracker.experiments.get('debug_test').variant,
        triggered: tracker.experiments.get('debug_test').triggered,
        hasImmediateTrigger: tracker.experiments.get('debug_test').hasImmediateTrigger,
        hasViewportTrigger: tracker.experiments.get('debug_test').hasViewportTrigger,
      } : null
    }
  })

  console.log('[DEBUG] Exposure Tracker State:', JSON.stringify(debugInfo, null, 2))

  // Check if changes were applied
  const elementText = await page.locator('#test-element').textContent()
  console.log('[DEBUG] Element text:', elementText)

  // Report findings
  console.log('\n=== Debug Report ===')
  console.log('Plugin exists:', debugInfo.pluginExists)
  console.log('Tracker exists:', debugInfo.trackerExists)
  console.log('Experiments Map exists:', debugInfo.experimentsMapExists)
  console.log('Experiments Map type:', debugInfo.experimentsMapType)
  console.log('Experiments count:', debugInfo.experimentsCount)
  console.log('Experiment names:', debugInfo.experimentNames)
  console.log('Has debug_test:', debugInfo.hasDebugTest)
  console.log('Experiment details:', JSON.stringify(debugInfo.experimentDetails, null, 2))
  console.log('Changes applied:', elementText === 'Test Content')
})
