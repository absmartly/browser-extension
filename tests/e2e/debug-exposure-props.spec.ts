import { test, expect } from '@playwright/test'

const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

test.skip('Debug: Show all plugin properties', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]`, msg.text())
  })

  await page.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.waitForSelector('body', { timeout: 5000 })

  await page.evaluate(() => { history.pushState({}, '', '/products/123') })

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
                { config: JSON.stringify({ __dom_changes: [{ selector: '#test-element', type: 'text', value: 'Test' }] }) }
              ]
            }]
          }
        }
        treatment() { return 1 }
        peek() { return 1 }
        override() {}
      }
    }
  })

  await page.addScriptTag({ path: 'public/absmartly-dom-changes-core.min.js' })

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

  const debugInfo = await page.evaluate(() => {
    const context = (window as any).__testContext
    const plugin = context.__domPlugin
    
    return {
      pluginProperties: plugin ? Object.keys(plugin) : [],
      pluginPrototypeProperties: plugin ? Object.keys(Object.getPrototypeOf(plugin)) : [],
      hasExposureTracker: 'exposureTracker' in (plugin || {}),
      contextProperties: Object.keys(context),
    }
  })

  console.log('[DEBUG] Plugin properties:', debugInfo.pluginProperties)
  console.log('[DEBUG] Plugin prototype:', debugInfo.pluginPrototypeProperties)
  console.log('[DEBUG] Has exposureTracker:', debugInfo.hasExposureTracker)
  console.log('[DEBUG] Context properties:', debugInfo.contextProperties)
})
