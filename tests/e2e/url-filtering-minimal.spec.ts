import { test, expect } from '@playwright/test'

const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

test('Minimal test: Check SDK mock is working', async ({ page }) => {
  page.on('console', msg => {
    console.log(`[BROWSER ${msg.type()}]`, msg.text())
  })

  await page.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
  await page.waitForSelector('body', { timeout: 5000 })

  // Inject SDK mock
  await page.evaluate(() => {
    console.log('[TEST] Creating SDK mock')
    ;(window as any).absmartly = {
      Context: class {
        constructor() {
          console.log('[SDK MOCK] Context constructor')
        }
        async ready() {
          console.log('[SDK MOCK] ready() returning resolved promise')
          return Promise.resolve()
        }
        data() {
          const data = {
            experiments: [{
              name: 'test_exp',
              variants: [
                { config: JSON.stringify({ changes: [] }) },
                {
                  config: JSON.stringify({
                    changes: [{
                      selector: '#test-element',
                      type: 'text',
                      value: 'Changed Text'
                    }]
                  })
                }
              ]
            }]
          }
          console.log('[SDK MOCK] data() returning:', JSON.stringify(data, null, 2))
          return data
        }
        treatment(experimentName: string) {
          console.log('[SDK MOCK] treatment(' + experimentName + ') returning 1')
          return 1
        }
        peek(experimentName: string) {
          console.log('[SDK MOCK] peek(' + experimentName + ') returning 1')
          return 1
        }
        override(experimentName: string, variant: number) {
          console.log('[SDK MOCK] override(' + experimentName + ', ' + variant + ')')
        }
        customFieldValue(experimentName: string, fieldName: string) {
          console.log('[SDK MOCK] ===== customFieldValue CALLED =====')
          console.log('[SDK MOCK] experimentName:', experimentName)
          console.log('[SDK MOCK] fieldName:', fieldName)

          if (experimentName === 'test_exp' && fieldName === '__dom_changes') {
            const variant = this.treatment(experimentName)
            const data = this.data()
            const exp = data?.experiments?.find((e: any) => e.name === experimentName)
            if (exp && exp.variants[variant]) {
              const config = JSON.parse(exp.variants[variant].config)
              console.log('[SDK MOCK] Returning config:', JSON.stringify(config, null, 2))
              return config
            }
          }
          console.log('[SDK MOCK] Returning undefined')
          return undefined
        }
      }
    }

    console.log('[TEST] SDK mock created, absmartly.Context exists:', typeof (window as any).absmartly.Context)
  })

  // Load plugin
  console.log('[TEST] Loading plugin')
  await page.addScriptTag({
    path: 'public/absmartly-sdk-plugins.dev.js'
  })

  // Check plugin loaded
  const pluginLoaded = await page.evaluate(() => {
    const loaded = !!(window as any).ABsmartlyDOM?.DOMChangesPlugin
    console.log('[TEST] ABsmartlyDOM exists:', !!(window as any).ABsmartlyDOM)
    console.log('[TEST] DOMChangesPlugin exists:', loaded)
    return loaded
  })

  console.log('[TEST] Plugin loaded:', pluginLoaded)

  // Create context
  await page.evaluate(() => {
    console.log('[TEST] Creating context instance')
    const context = new (window as any).absmartly.Context();
    (window as any).__testContext = context
    console.log('[TEST] Context created')
  })

  // Initialize plugin
  await page.evaluate(() => {
    console.log('[TEST] Getting plugin constructor')
    const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
    console.log('[TEST] Creating plugin with config:', JSON.stringify({
      autoApply: true,
      spa: true,
      dataSource: 'customField',
      dataFieldName: '__dom_changes',
      debug: true
    }, null, 2))

    const context = (window as any).__testContext
    const plugin = new DOMChangesPlugin({
      context,
      autoApply: true,
      spa: true,
      dataSource: 'customField',
      dataFieldName: '__dom_changes',
      debug: true
    })

    console.log('[TEST] Plugin instance created, calling initialize()')
    return plugin.initialize()
  })

  // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

  const elementText = await page.locator('#test-element').textContent()
  console.log('[TEST] Final element text:', elementText)

  expect(elementText).toBe('Changed Text')
})
