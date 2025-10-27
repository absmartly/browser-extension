import { test, expect } from '@playwright/test'

const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

test.describe.skip('URL Filtering Tests - Fixed', () => {
  test('Basic plugin functionality - using dataSource: variable', async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type()}]`, msg.text())
    })

    await page.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Inject SDK mock with data in variant.config
    await page.evaluate(() => {
      ;(window as any).absmartly = {
        Context: class {
          constructor() {}
          async ready() { return Promise.resolve() }
          data() {
            return {
              experiments: [{
                name: 'test_exp',
                variants: [
                  {
                    config: JSON.stringify({
                      __dom_changes: []
                    })
                  },
                  {
                    config: JSON.stringify({
                      __dom_changes: [{
                        selector: '#test-element',
                        type: 'text',
                        value: 'Changed Text!'
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
        }
      }
    })

    // Load plugin
    await page.addScriptTag({
      path: 'public/absmartly-dom-changes-core.min.js'
    })

    // Initialize plugin with dataSource: 'variable'
    await page.evaluate(() => {
      const context = new (window as any).absmartly.Context();
      (window as any).__testContext = context

      const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
      const plugin = new DOMChangesPlugin({
        context,
        autoApply: true,
        spa: true,
        dataSource: 'variable', // Use 'variable' instead of 'customField'
        dataFieldName: '__dom_changes',
        debug: true
      })

      return plugin.initialize()
    })

    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

    const elementText = await page.locator('#test-element').textContent()
    console.log('[TEST] Element text:', elementText)

    expect(elementText).toBe('Changed Text!')
  })

  test('URL filtering with path match', async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type()}]`, msg.text())
    })

    await page.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Set URL BEFORE plugin
    await page.evaluate(() => {
      history.pushState({}, '', '/products/123')
      console.log('[TEST] URL set to:', window.location.href)
    })

    // Inject SDK mock with URL filter
    await page.evaluate(() => {
      ;(window as any).absmartly = {
        Context: class {
          constructor() {}
          async ready() { return Promise.resolve() }
          data() {
            return {
              experiments: [{
                name: 'url_filter_test',
                variants: [
                  {
                    config: JSON.stringify({
                      __dom_changes: []
                    })
                  },
                  {
                    config: JSON.stringify({
                      __dom_changes: {
                        changes: [{
                          selector: '#test-element',
                          type: 'text',
                          value: 'Products Page Content'
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
      path: 'public/absmartly-dom-changes-core.min.js'
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

    const elementText = await page.locator('#test-element').textContent()
    console.log('[TEST] Element text on /products/123:', elementText)

    expect(elementText).toBe('Products Page Content')
  })

  test('URL filtering - no match when URL doesnt match', async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type()}]`, msg.text())
    })

    await page.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Set URL to non-matching path
    await page.evaluate(() => {
      history.pushState({}, '', '/about')
      console.log('[TEST] URL set to:', window.location.href)
    })

    // Inject SDK mock with URL filter
    await page.evaluate(() => {
      ;(window as any).absmartly = {
        Context: class {
          constructor() {}
          async ready() { return Promise.resolve() }
          data() {
            return {
              experiments: [{
                name: 'url_filter_test',
                variants: [
                  {
                    config: JSON.stringify({
                      __dom_changes: []
                    })
                  },
                  {
                    config: JSON.stringify({
                      __dom_changes: {
                        changes: [{
                          selector: '#test-element',
                          type: 'text',
                          value: 'Products Page Content'
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
          override(experimentName: string) {}
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

    const elementText = await page.locator('#test-element').textContent()
    console.log('[TEST] Element text on /about (should be unchanged):', elementText)

    // Should NOT change because URL doesn't match
    expect(elementText).toContain('Original test content')
  })
})
