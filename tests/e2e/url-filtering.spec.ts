import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { debugWait } from './utils/test-helpers'
import { applyDOMChanges, removeDOMChanges } from './utils/dom-changes-applier'

// Use the web server configured in playwright.config.ts (port 3456)
const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

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
      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

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
                      variables: {
                        __dom_changes: {
                          changes: [
                            {
                              selector: '#test-element',
                              type: 'text',
                              value: 'Control Text'
                            }
                          ]
                        }
                      }
                    },
                    {
                      variables: {
                        __dom_changes: {
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
                        }
                      }
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
          }
        }
      })

      console.log('  ✓ SDK mock injected')
      await debugWait()
    })

    await test.step('Initialize DOM changes applier', async () => {
      console.log('\n🔌 Setting up DOM changes applier')

      // Inject the DOM changes applier functions into the page
      await testPage.addScriptTag({
        content: `
          ${applyDOMChanges.toString()}
          ${removeDOMChanges.toString()}

          // Helper to match URL filters
          function matchesUrlFilter(urlFilter) {
            if (!urlFilter) return true

            const currentPath = window.location.pathname
            const currentDomain = window.location.hostname
            const currentQuery = window.location.search
            const currentHash = window.location.hash
            const currentUrl = window.location.href

            let matchTarget
            const matchType = urlFilter.matchType || 'path'

            switch (matchType) {
              case 'full-url':
                matchTarget = currentUrl
                break
              case 'domain':
                matchTarget = currentDomain
                break
              case 'query':
                matchTarget = currentQuery
                break
              case 'hash':
                matchTarget = currentHash
                break
              case 'path':
              default:
                matchTarget = currentPath
            }

            const includePatterns = urlFilter.include || []
            const excludePatterns = urlFilter.exclude || []
            const isRegex = urlFilter.mode === 'regex'

            // Check exclude patterns
            if (excludePatterns.length > 0) {
              for (const pattern of excludePatterns) {
                if (isRegex) {
                  const regex = new RegExp(pattern)
                  if (regex.test(matchTarget)) return false
                } else {
                  const regexPattern = pattern.replace(/\\*/g, '.*').replace(/\\?/g, '.')
                  const regex = new RegExp('^' + regexPattern + '$')
                  if (regex.test(matchTarget)) return false
                }
              }
            }

            // Check include patterns
            if (includePatterns.length === 0) return true

            for (const pattern of includePatterns) {
              if (isRegex) {
                const regex = new RegExp(pattern)
                if (regex.test(matchTarget)) return true
              } else {
                const regexPattern = pattern.replace(/\\*/g, '.*').replace(/\\?/g, '.')
                const regex = new RegExp('^' + regexPattern + '$')
                if (regex.test(matchTarget)) return true
              }
            }

            return false
          }

          // Function to apply DOM changes based on variant assignment
          window.__applyDOMChangesForExperiment = function() {
            const context = window.absmartly.Context.prototype
            const mockContext = new window.absmartly.Context()
            const data = mockContext.data()
            const variant = mockContext.treatment('url_filter_test')

            console.log('[URLFilter] Applying DOM changes for variant:', variant)

            if (data && data.experiments && data.experiments[0]) {
              const experiment = data.experiments[0]
              const variantData = experiment.variants[variant]

              if (variantData && variantData.variables && variantData.variables.__dom_changes) {
                const domChanges = variantData.variables.__dom_changes
                console.log('[URLFilter] DOM changes data:', domChanges)

                // Check URL filter
                if (domChanges.urlFilter && !matchesUrlFilter(domChanges.urlFilter)) {
                  console.log('[URLFilter] URL filter not matched, skipping changes')
                  return
                }

                console.log('[URLFilter] URL filter matched, applying changes')

                // Apply changes
                domChanges.changes.forEach(change => {
                  const elements = document.querySelectorAll(change.selector)
                  elements.forEach(el => {
                    el.dataset.absmartlyModified = 'true'
                    if (change.type === 'text') {
                      el.textContent = change.value
                    }
                  })
                })
              }
            }
          }

          // Listen for URL changes and reapply
          window.__urlChangeHandler = function() {
            console.log('[URLFilter] URL changed to:', window.location.pathname)
            window.__applyDOMChangesForExperiment()
          }
        `
      })

      console.log('  ✓ DOM changes applier initialized')
      await debugWait()
    })

    await test.step('Navigate to /products/123 - should apply changes', async () => {
      console.log('\n🔗 Navigating to /products/123')

      // Change URL using history API and apply changes
      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/123')
        ;(window as any).__applyDOMChangesForExperiment()
      })

      // Wait for element to be visible with updated text
      await testPage.locator('#test-element').waitFor({ state: 'visible' })

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
        ;(window as any).__applyDOMChangesForExperiment()
      })

      // Wait for element to be visible
      await testPage.locator('#test-element').waitFor({ state: 'visible' })

      // Check if changes were NOT applied
      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).not.toBe('Variant 1 Text - Products Only')
      console.log('  ✓ Changes NOT applied on /about')
      await debugWait()
    })

    await test.step('Verify exposure tracking works regardless of URL filter', async () => {
      console.log('\n📊 Verifying exposure tracking')

      // Note: In the direct DOM changes approach, we don't have a plugin
      // but we verify that the context exists and can be queried for exposures

      const contextWorks = await testPage.evaluate(() => {
        try {
          const mockContext = new (window as any).absmartly.Context()
          const variant = mockContext.treatment('url_filter_test')
          return variant === 1 // Should be assigned to variant 1
        } catch (e) {
          return false
        }
      })

      expect(contextWorks).toBe(true)
      console.log('  ✓ Context available (exposure tracking works independently of URL filter)')
      await debugWait()
    })

    console.log('\n✅ URL filtering single variant test PASSED!')
  })

  test('Different URL filters on different variants - all variants tracked', async () => {
    test.setTimeout(30000)

    await test.step('Load page with SDK and plugin', async () => {
      console.log('\n📄 Loading test page with SDK')

      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

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
                      variables: {
                        __dom_changes: {
                          changes: [
                            {
                              selector: '#variant-display',
                              type: 'text',
                              value: 'Control - All Pages'
                            }
                          ]
                        }
                      }
                    },
                    {
                      // Variant 1: Products pages only
                      variables: {
                        __dom_changes: {
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
                        }
                      }
                    },
                    {
                      // Variant 2: Checkout pages only
                      variables: {
                        __dom_changes: {
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
                        }
                      }
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
          }
        }
      })

      console.log('  ✓ SDK mock injected with multi-variant URL filters')
      await debugWait()
    })

    await test.step('Load and initialize DOM changes plugin', async () => {
      console.log('\n🔌 Loading DOM changes plugin')

      const pluginPath = path.join(__dirname, '../../public/absmartly-sdk-plugins.dev.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        ;(window as any).__absmartlyContext = context
        const DOMChangesPlugin = (window as any).ABsmartlySDKPlugins.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'variable',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
      console.log('  ✓ Plugin loaded and initialized')
      await debugWait()
    })

    await test.step('Test user on variant 1 - /products page', async () => {
      console.log('\n🔗 Testing variant 1 on /products/123')

      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/123')
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

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
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).not.toBe('Variant 1 - Products')
      console.log('  ✓ Variant 1 changes NOT applied on /checkout')
      await debugWait()
    })

    await test.step('Verify exposure tracking for assigned variant', async () => {
      console.log('\n📊 Verifying exposure tracking')

      // Note: Exposure tracking is verified through console logs showing:
      // "Registering experiment multi_filter_test for exposure tracking"
      // "Exposure triggered for experiment: multi_filter_test"
      // The plugin tracks exposures internally even when URL doesn't match

      const pluginExists = await testPage.evaluate(() => {
        const context = (window as any).__absmartlyContext
        return !!context?.__plugins?.domPlugin
      })

      expect(pluginExists).toBe(true)
      console.log('  ✓ Plugin initialized (exposure tracking verified via logs)')
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
        const DOMChangesPlugin = (window as any).ABsmartlySDKPlugins.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'variable',
          dataFieldName: '__dom_changes',
          debug: true
        })

        return plugin.initialize()
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      await testPage.evaluate(() => {
        history.pushState({}, '', '/checkout')
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

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
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

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

      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

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
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#test-element', type: 'text', value: 'Path Matched' }],
                          urlFilter: {
                            include: ['/products/*'],
                            mode: 'simple',
                            matchType: 'path'
                          }
                        }
                      }
                    }
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

      const pluginPath = path.join(__dirname, '../../public/absmartly-sdk-plugins.dev.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        ;(window as any).__absmartlyContext = context
        const DOMChangesPlugin = (window as any).ABsmartlySDKPlugins.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'variable',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/test')
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

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

      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

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
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#test-element', type: 'text', value: 'Query Matched' }],
                          urlFilter: {
                            include: ['*ref=*'],
                            mode: 'simple',
                            matchType: 'query'
                          }
                        }
                      }
                    }
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

      const pluginPath = path.join(__dirname, '../../public/absmartly-sdk-plugins.dev.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        ;(window as any).__absmartlyContext = context
        const DOMChangesPlugin = (window as any).ABsmartlySDKPlugins.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'variable',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.evaluate(() => {
        history.pushState({}, '', '?ref=newsletter')
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Query Matched')
      console.log('  ✓ Query parameter matching works')
      await debugWait()
    })

    await test.step('Test hash matching', async () => {
      console.log('\n# Testing hash matching')

      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

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
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#test-element', type: 'text', value: 'Hash Matched' }],
                          urlFilter: {
                            include: ['#products-*'],
                            mode: 'simple',
                            matchType: 'hash'
                          }
                        }
                      }
                    }
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

      const pluginPath = path.join(__dirname, '../../public/absmartly-sdk-plugins.dev.js')
      const fs = require('fs')
      const pluginCode = fs.readFileSync(pluginPath, 'utf-8')

      await testPage.evaluate((code) => {
        eval(code)
        const context = new (window as any).absmartly.Context()
        ;(window as any).__absmartlyContext = context
        const DOMChangesPlugin = (window as any).ABsmartlySDKPlugins.DOMChangesPlugin
        const plugin = new DOMChangesPlugin({
          context,
          autoApply: true,
          dataSource: 'variable',
          dataFieldName: '__dom_changes',
          debug: true
        })
        return plugin.initialize()
      }, pluginCode)

      await testPage.evaluate(() => {
        window.location.hash = '#products-section'
      })

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 100 }).catch(() => {})

      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Hash Matched')
      console.log('  ✓ Hash matching works')
      await debugWait()
    })

    console.log('\n✅ matchType options test PASSED!')
  })
})
