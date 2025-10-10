import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { debugWait } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'url-filtering-test.html')

/**
 * E2E Tests for URL Filtering with DOM Changes
 *
 * Tests URL filtering functionality:
 * - Load SDK and DOM changes plugin on test pages
 * - URL filtering on specific variants
 * - Different URL filters on different variants
 * - Exposure tracking for all variants regardless of URL filter
 */

test.describe('URL Filtering with DOM Changes', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Set up console listener
    testPage.on('console', (msg) => {
      const text = msg.text()
      allConsoleMessages.push({ type: msg.type(), text })
      if (text.includes('[ABsmartly]') || text.includes('[DOMPlugin]') || text.includes('[URLFilter]')) {
        console.log(`[${msg.type()}] ${text}`)
      }
    })

    await testPage.setViewportSize({ width: 1920, height: 1080 })
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('URL filtering on single variant - user assigned to filtered variant', async () => {
    test.setTimeout(30000)

    await test.step('Load page with SDK and plugin', async () => {
      console.log('\n📄 Loading test page with SDK')

      // Create test page with SDK loaded
      await testPage.goto(`file://${TEST_PAGE_PATH}`)
      await testPage.waitForLoadState('networkidle')

      // Inject ABsmartly SDK mock
      await testPage.evaluate(() => {
        // Mock ABsmartly SDK
        (window as any).absmartly = {
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
                        changes: [
                          {
                            selector: '#test-element',
                            type: 'text',
                            value: 'Control Text'
                          }
                        ]
                      })
                    },
                    {
                      config: JSON.stringify({
                        changes: [
                          {
                            selector: '#test-element',
                            type: 'text',
                            value: 'Variant 1 Text - Products Only'
                          }
                        ],
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
              return 1 // Assign user to variant 1
            }
            peek(experimentName: string) {
              return 1
            }
            override(experimentName: string, variant: number) {}
            customFieldValue(experimentName: string, fieldName: string) {
              if (experimentName === 'url_filter_test' && fieldName === '__dom_changes') {
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

      console.log('  ✓ SDK mock injected')
      await debugWait()
    })

    await test.step('Load and initialize DOM changes plugin', async () => {
      console.log('\n🔌 Loading DOM changes plugin')

      // Read the SDK plugin file from the dist directory
      const pluginPath = path.join(__dirname, '../../../absmartly-sdk-plugins/dist/absmartly-sdk-plugins.dev.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        // Load plugin library
        eval(code)

        // Create context
        const context = new (window as any).absmartly.Context()

        // Get DOMChangesPlugin from the SDK plugins bundle
        const DOMChangesPlugin = (window as any).ABsmartlySDKPlugins.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'customField',
          dataFieldName: '__dom_changes',
          debug: true
        })

        // Initialize the plugin
        return plugin.initialize()
      }, pluginCode)

      await testPage.waitForTimeout(1000)
      console.log('  ✓ Plugin loaded and initialized')
      await debugWait()
    })

    await test.step('Navigate to /products/123 - should apply changes', async () => {
      console.log('\n🔗 Navigating to /products/123')

      // Change URL using history API
      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/123')

        // Trigger plugin to recheck URL and apply changes
        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('url_filter_test')
        }
      })

      await testPage.waitForTimeout(500)

      // Check if changes were applied
      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Variant 1 Text - Products Only')
      console.log('  ✓ Changes applied on /products/123')
      await debugWait()
    })

    await test.step('Navigate to /about - should NOT apply changes', async () => {
      console.log('\n🔗 Navigating to /about')

      // Reset element text and change URL
      await testPage.evaluate(() => {
        const el = document.getElementById('test-element')
        if (el) el.textContent = 'Original Text'

        history.pushState({}, '', '/about')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('url_filter_test')
        }
      })

      await testPage.waitForTimeout(500)

      // Check if changes were NOT applied
      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).not.toBe('Variant 1 Text - Products Only')
      console.log('  ✓ Changes NOT applied on /about')
      await debugWait()
    })

    await test.step('Verify exposure tracking works regardless of URL filter', async () => {
      console.log('\n📊 Verifying exposure tracking')

      const exposureTracked = await testPage.evaluate(() => {
        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        return plugin?.exposureTracker?.hasExperiment?.('url_filter_test') || false
      })

      expect(exposureTracked).toBe(true)
      console.log('  ✓ Exposure tracked for filtered variant')
      await debugWait()
    })

    console.log('\n✅ URL filtering single variant test PASSED!')
  })

  test('Different URL filters on different variants - all variants tracked', async () => {
    test.setTimeout(30000)

    await test.step('Load page with SDK and plugin', async () => {
      console.log('\n📄 Loading test page with SDK')

      await testPage.goto(`file://${TEST_PAGE_PATH}`)
      await testPage.waitForLoadState('networkidle')

      // Inject ABsmartly SDK mock with multiple variants having different URL filters
      await testPage.evaluate(() => {
        (window as any).absmartly = {
          Context: class {
            constructor() {}
            async ready() { return Promise.resolve() }
            data() {
              return {
                experiments: [{
                  name: 'multi_filter_test',
                  variants: [
                    {
                      // Variant 0: Control - no URL filter
                      config: JSON.stringify({
                        changes: [
                          {
                            selector: '#variant-display',
                            type: 'text',
                            value: 'Control - All Pages'
                          }
                        ]
                      })
                    },
                    {
                      // Variant 1: Products pages only
                      config: JSON.stringify({
                        changes: [
                          {
                            selector: '#variant-display',
                            type: 'text',
                            value: 'Variant 1 - Products'
                          }
                        ],
                        urlFilter: {
                          include: ['/products/*'],
                          mode: 'simple',
                          matchType: 'path'
                        }
                      })
                    },
                    {
                      // Variant 2: Checkout pages only
                      config: JSON.stringify({
                        changes: [
                          {
                            selector: '#variant-display',
                            type: 'text',
                            value: 'Variant 2 - Checkout'
                          }
                        ],
                        urlFilter: {
                          include: ['/checkout*'],
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
              return 1 // Assign user to variant 1
            }
            peek(experimentName: string) {
              return 1
            }
            override(experimentName: string, variant: number) {}
            customFieldValue(experimentName: string, fieldName: string) {
              if (experimentName === 'multi_filter_test' && fieldName === '__dom_changes') {
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

      console.log('  ✓ SDK mock injected with multi-variant URL filters')
      await debugWait()
    })

    await test.step('Load and initialize DOM changes plugin', async () => {
      console.log('\n🔌 Loading DOM changes plugin')

      const pluginPath = path.join(__dirname, '../../public/absmartly-dom-changes-core.min.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'customField',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.waitForTimeout(1000)
      console.log('  ✓ Plugin loaded and initialized')
      await debugWait()
    })

    await test.step('Test user on variant 1 - /products page', async () => {
      console.log('\n🔗 Testing variant 1 on /products/123')

      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/123')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('multi_filter_test')
        }
      })

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).toBe('Variant 1 - Products')
      console.log('  ✓ Variant 1 changes applied on /products/123')
      await debugWait()
    })

    await test.step('Test user on variant 1 - /checkout page (should NOT apply)', async () => {
      console.log('\n🔗 Testing variant 1 on /checkout')

      await testPage.evaluate(() => {
        const el = document.getElementById('variant-display')
        if (el) el.textContent = 'Original Text'

        history.pushState({}, '', '/checkout')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('multi_filter_test')
        }
      })

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).not.toBe('Variant 1 - Products')
      console.log('  ✓ Variant 1 changes NOT applied on /checkout')
      await debugWait()
    })

    await test.step('Verify exposure tracking for assigned variant', async () => {
      console.log('\n📊 Verifying exposure tracking')

      const exposureTracked = await testPage.evaluate(() => {
        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        return plugin?.exposureTracker?.hasExperiment?.('multi_filter_test') || false
      })

      expect(exposureTracked).toBe(true)
      console.log('  ✓ Exposure tracked for variant 1')
      await debugWait()
    })

    await test.step('Test with variant 2 assignment - /checkout page', async () => {
      console.log('\n🔄 Re-initializing with variant 2')

      // Reinitialize with variant 2
      await testPage.evaluate(() => {
        ;(window as any).absmartly.Context.prototype.treatment = () => 2
        ;(window as any).absmartly.Context.prototype.peek = () => 2

        // Reset element
        const el = document.getElementById('variant-display')
        if (el) el.textContent = 'Original Text'

        // Reinitialize plugin
        const context = new (window as any).absmartly.Context()
        const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'customField',
          dataFieldName: '__dom_changes',
          debug: true
        })

        return plugin.initialize()
      })

      await testPage.waitForTimeout(500)

      await testPage.evaluate(() => {
        history.pushState({}, '', '/checkout')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('multi_filter_test')
        }
      })

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).toBe('Variant 2 - Checkout')
      console.log('  ✓ Variant 2 changes applied on /checkout')
      await debugWait()
    })

    await test.step('Test variant 2 on /products (should NOT apply)', async () => {
      console.log('\n🔗 Testing variant 2 on /products')

      await testPage.evaluate(() => {
        const el = document.getElementById('variant-display')
        if (el) el.textContent = 'Original Text'

        history.pushState({}, '', '/products/456')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('multi_filter_test')
        }
      })

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).not.toBe('Variant 2 - Checkout')
      console.log('  ✓ Variant 2 changes NOT applied on /products')
      await debugWait()
    })

    console.log('\n✅ Multi-variant URL filtering test PASSED!')
  })

  test('URL filtering with matchType options', async () => {
    test.setTimeout(30000)

    await test.step('Test path matching', async () => {
      console.log('\n🔗 Testing path matching')

      await testPage.goto(`file://${TEST_PAGE_PATH}`)
      await testPage.waitForLoadState('networkidle')

      await testPage.evaluate(() => {
        (window as any).absmartly = {
          Context: class {
            constructor() {}
            async ready() { return Promise.resolve() }
            data() {
              return {
                experiments: [{
                  name: 'path_match_test',
                  variants: [
                    {},
                    {
                      config: JSON.stringify({
                        changes: [{ selector: '#test-element', type: 'text', value: 'Path Matched' }],
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
            treatment() { return 1 }
            peek() { return 1 }
            override() {}
            customFieldValue(experimentName: string, fieldName: string) {
              if (fieldName === '__dom_changes') {
                return this.data().experiments[0].variants[1].config && JSON.parse(this.data().experiments[0].variants[1].config)
              }
            }
          }
        }
      })

      const pluginPath = path.join(__dirname, '../../public/absmartly-dom-changes-core.min.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'customField',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/test')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('path_match_test')
        }
      })

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Path Matched')
      console.log('  ✓ Path matching works')
      await debugWait()
    })

    await test.step('Test domain matching', async () => {
      console.log('\n🌐 Testing domain matching')

      // Note: Domain matching is harder to test in file:// protocol
      // This is a simplified test
      console.log('  ℹ️  Domain matching test skipped (requires HTTP server)')
    })

    await test.step('Test query parameter matching', async () => {
      console.log('\n❓ Testing query parameter matching')

      await testPage.goto(`file://${TEST_PAGE_PATH}`)
      await testPage.waitForLoadState('networkidle')

      await testPage.evaluate(() => {
        (window as any).absmartly = {
          Context: class {
            constructor() {}
            async ready() { return Promise.resolve() }
            data() {
              return {
                experiments: [{
                  name: 'query_match_test',
                  variants: [
                    {},
                    {
                      config: JSON.stringify({
                        changes: [{ selector: '#test-element', type: 'text', value: 'Query Matched' }],
                        urlFilter: {
                          include: ['ref=*'],
                          mode: 'simple',
                          matchType: 'query'
                        }
                      })
                    }
                  ]
                }]
              }
            }
            treatment() { return 1 }
            peek() { return 1 }
            override() {}
            customFieldValue(experimentName: string, fieldName: string) {
              if (fieldName === '__dom_changes') {
                return this.data().experiments[0].variants[1].config && JSON.parse(this.data().experiments[0].variants[1].config)
              }
            }
          }
        }
      })

      const pluginPath = path.join(__dirname, '../../public/absmartly-dom-changes-core.min.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'customField',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.evaluate(() => {
        history.pushState({}, '', '?ref=newsletter')

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('query_match_test')
        }
      })

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Query Matched')
      console.log('  ✓ Query parameter matching works')
      await debugWait()
    })

    await test.step('Test hash matching', async () => {
      console.log('\n# Testing hash matching')

      await testPage.goto(`file://${TEST_PAGE_PATH}`)
      await testPage.waitForLoadState('networkidle')

      await testPage.evaluate(() => {
        (window as any).absmartly = {
          Context: class {
            constructor() {}
            async ready() { return Promise.resolve() }
            data() {
              return {
                experiments: [{
                  name: 'hash_match_test',
                  variants: [
                    {},
                    {
                      config: JSON.stringify({
                        changes: [{ selector: '#test-element', type: 'text', value: 'Hash Matched' }],
                        urlFilter: {
                          include: ['#products-*'],
                          mode: 'simple',
                          matchType: 'hash'
                        }
                      })
                    }
                  ]
                }]
              }
            }
            treatment() { return 1 }
            peek() { return 1 }
            override() {}
            customFieldValue(experimentName: string, fieldName: string) {
              if (fieldName === '__dom_changes') {
                return this.data().experiments[0].variants[1].config && JSON.parse(this.data().experiments[0].variants[1].config)
              }
            }
          }
        }
      })

      const pluginPath = path.join(__dirname, '../../public/absmartly-dom-changes-core.min.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        const DOMChangesPlugin = (window as any).ABsmartlyDOM.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'customField',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.evaluate(() => {
        window.location.hash = '#products-section'

        const context = new (window as any).absmartly.Context()
        const plugin = context.__domPlugin
        if (plugin) {
          plugin.applyChanges('hash_match_test')
        }
      })

      await testPage.waitForTimeout(100)

      await testPage.waitForTimeout(500)

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Hash Matched')
      console.log('  ✓ Hash matching works')
      await debugWait()
    })

    console.log('\n✅ matchType options test PASSED!')
  })
})
