import { test, expect } from '@playwright/test'

const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

test.describe('URL Filtering Debug Tests', () => {
  test('Debug: Basic plugin functionality without URL filter', async ({ page }) => {
    await page.goto(TEST_PAGE_URL)
    await page.waitForLoadState('networkidle')

    // Inject SDK mock WITHOUT URL filter
    await page.evaluate(() => {
      (window as any).absmartly = {
        Context: class {
          constructor() {}
          async ready() { return Promise.resolve() }
          data() {
            return {
              experiments: [{
                name: 'basic_test',
                variants: [
                  { config: JSON.stringify({ changes: [] }) },
                  {
                    config: JSON.stringify({
                      changes: [{
                        selector: '#test-element',
                        type: 'text',
                        value: 'Basic Test - No URL Filter'
                      }]
                    })
                  }
                ]
              }]
            }
          }
          treatment(experimentName: string) { return 1 }
          peek(experimentName: string) { return 1 }
          override(experimentName: string, variant: number) {}
          customFieldValue(experimentName: string, fieldName: string) {
            if (experimentName === 'basic_test' && fieldName === '__dom_changes') {
              const variant = this.treatment(experimentName)
              const data = this.data()
              const exp = data?.experiments?.find((e: any) => e.name === experimentName)
              if (exp && exp.variants[variant]) {
                return JSON.parse(exp.variants[variant].config)
              }
            }
            return undefined
          }
        }
      }
    })

    // Load plugin
    await page.addScriptTag({
      path: 'public/absmartly-dom-changes-core.min.js'
    })

    // Initialize plugin
    await page.evaluate(() => {
      const context = new (window as any).absmartly.Context();
      (window as any).__testContext = context;

      const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin;
      const plugin = new DOMChangesPlugin({
        context,
        autoApply: true,
        spa: true,
        dataSource: 'customField',
        dataFieldName: '__dom_changes',
        debug: true
      });

      return plugin.initialize();
    })

    await page.waitForTimeout(1000)

    const elementText = await page.locator('#test-element').textContent()
    console.log('Basic test element text:', elementText)
    expect(elementText).toBe('Basic Test - No URL Filter')
  })

  test('Debug: Plugin with URL filter - comprehensive logging', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type()}]`, msg.text())
    })

    await page.goto(TEST_PAGE_URL)
    await page.waitForLoadState('networkidle')

    // Set URL BEFORE plugin
    await page.evaluate(() => {
      console.log('[TEST] Setting URL to /products/123')
      history.pushState({}, '', '/products/123')
      console.log('[TEST] Current URL:', window.location.href)
      console.log('[TEST] Pathname:', window.location.pathname)
      console.log('[TEST] Hash:', window.location.hash)
    })

    // Inject SDK mock WITH URL filter
    await page.evaluate(() => {
      console.log('[TEST] Injecting SDK mock')
      ;(window as any).absmartly = {
        Context: class {
          constructor() {
            console.log('[SDK MOCK] Context constructor called')
          }
          async ready() {
            console.log('[SDK MOCK] ready() called')
            return Promise.resolve()
          }
          data() {
            console.log('[SDK MOCK] data() called')
            return {
              experiments: [{
                name: 'url_filter_test',
                variants: [
                  { config: JSON.stringify({ changes: [] }) },
                  {
                    config: JSON.stringify({
                      changes: [{
                        selector: '#test-element',
                        type: 'text',
                        value: 'Variant 1 Text - Products Only'
                      }],
                      urlFilter: {
                        include: ['/products/*'],
                        mode: 'simple',
                        matchType: 'path'
                      }
                    })
                  }
                ]
              }]
            }
          }
          treatment(experimentName: string) {
            console.log('[SDK MOCK] treatment() called for:', experimentName)
            return 1
          }
          peek(experimentName: string) {
            console.log('[SDK MOCK] peek() called for:', experimentName)
            return 1
          }
          override(experimentName: string, variant: number) {
            console.log('[SDK MOCK] override() called for:', experimentName, 'variant:', variant)
          }
          customFieldValue(experimentName: string, fieldName: string) {
            console.log('[SDK MOCK] customFieldValue() called for:', experimentName, fieldName)
            if (experimentName === 'url_filter_test' && fieldName === '__dom_changes') {
              const variant = this.treatment(experimentName)
              const data = this.data()
              const exp = data?.experiments?.find((e: any) => e.name === experimentName)
              if (exp && exp.variants[variant]) {
                const config = JSON.parse(exp.variants[variant].config)
                console.log('[SDK MOCK] Returning config:', JSON.stringify(config, null, 2))
                return config
              }
            }
            return undefined
          }
        }
      }
    })

    // Load plugin
    console.log('[TEST] Loading plugin from public/absmartly-dom-changes-core.min.js')
    await page.addScriptTag({
      path: 'public/absmartly-dom-changes-core.min.js'
    })

    // Initialize plugin with debug output
    await page.evaluate(() => {
      console.log('[TEST] Creating context')
      const context = new (window as any).absmartly.Context();
      (window as any).__testContext = context;

      console.log('[TEST] Getting DOMChangesPlugin constructor')
      const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin;
      console.log('[TEST] DOMChangesPlugin constructor:', typeof DOMChangesPlugin)

      console.log('[TEST] Creating plugin instance')
      const plugin = new DOMChangesPlugin({
        context,
        autoApply: true,
        spa: true,
        dataSource: 'customField',
        dataFieldName: '__dom_changes',
        debug: true
      });

      console.log('[TEST] Plugin instance created:', !!plugin)
      console.log('[TEST] Initializing plugin...')

      return plugin.initialize().then(() => {
        console.log('[TEST] Plugin initialized successfully')
        console.log('[TEST] Plugin registered at context.__domPlugin:', !!context.__domPlugin)
      })
    })

    // Wait for any async operations
    await page.waitForTimeout(2000)

    // Check URLMatcher directly
    await page.evaluate(() => {
      console.log('[TEST] ===== Testing URLMatcher Directly =====')
      const URLMatcher = (window as any).ABsmartlyDOM?.URLMatcher
      console.log('[TEST] URLMatcher exists:', !!URLMatcher)

      if (URLMatcher && URLMatcher.matches) {
        const filter = {
          include: ['/products/*'],
          mode: 'simple',
          matchType: 'path'
        }
        const url = window.location.href
        console.log('[TEST] Testing URLMatcher.matches()')
        console.log('[TEST] Filter:', JSON.stringify(filter))
        console.log('[TEST] URL:', url)

        try {
          const matches = URLMatcher.matches(filter, url)
          console.log('[TEST] URLMatcher.matches result:', matches)
        } catch (error) {
          console.log('[TEST] URLMatcher.matches ERROR:', error)
        }
      }
    })

    // Check if plugin applied changes
    const elementText = await page.locator('#test-element').textContent()
    console.log('[TEST] Final element text:', elementText)

    // Check plugin state
    const pluginState = await page.evaluate(() => {
      const context = (window as any).__testContext
      const plugin = context?.__domPlugin
      return {
        contextExists: !!context,
        pluginExists: !!plugin,
        pluginInitialized: plugin?.initialized,
        currentURL: window.location.href,
        pathname: window.location.pathname,
        hash: window.location.hash
      }
    })

    console.log('[TEST] Plugin state:', JSON.stringify(pluginState, null, 2))

    expect(elementText).toBe('Variant 1 Text - Products Only')
  })
})
