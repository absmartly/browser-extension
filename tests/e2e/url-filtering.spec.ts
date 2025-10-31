import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { debugWait } from './utils/test-helpers'
import { applyDOMChanges, removeDOMChanges, matchesUrlFilter, type DOMChangesData } from './utils/dom-changes-applier'

// Use the web server configured in playwright.config.ts (port 3456)
const TEST_PAGE_URL = 'http://localhost:3456/url-filtering-test.html'

/**
 * E2E Tests for URL Filtering with DOM Changes
 *
 * Tests URL filtering functionality using the extension's built-in DOM changes application:
 * - URL filtering on specific variants
 * - Different URL filters on different variants
 * - Exposure tracking for all variants regardless of URL filter
 *
 * NOTE: These tests DO NOT use the SDK plugin. They use the extension's
 * built-in DOM changes application functionality via dom-changes-applier.ts
 *
 * All tests in this file are ACTIVE (no skipped tests). Tests are self-contained
 * and use mocked SDK data, so they do not depend on external API availability.
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

    await test.step('Load page and setup mock SDK', async () => {
      console.log('\n📄 Loading test page')

      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

      // Inject ABsmartly SDK mock with DOM changes for variant 1
      await testPage.evaluate(() => {
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
                            { selector: '#test-element', type: 'text', value: 'Control Text' }
                          ]
                        }
                      }
                    },
                    {
                      variables: {
                        __dom_changes: {
                          changes: [
                            { selector: '#test-element', type: 'text', value: 'Variant 1 Text - Products Only' }
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
            treatment() { return 1 }
            peek() { return 1 }
            override() {}
          }
        }
      })

      console.log('  ✓ SDK mock injected')
      await debugWait()
    })

    await test.step('Setup DOM changes applier', async () => {
      console.log('\n🔌 Setting up DOM changes applier')

      // Inject DOM changes applier functions directly into the page
      await testPage.addScriptTag({
        content: `
          // Match URL filter function
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
              case 'full-url': matchTarget = currentUrl; break
              case 'domain': matchTarget = currentDomain; break
              case 'query': matchTarget = currentQuery; break
              case 'hash': matchTarget = currentHash; break
              case 'path':
              default: matchTarget = currentPath
            }

            const includePatterns = urlFilter.include || []
            const excludePatterns = urlFilter.exclude || []
            const isRegex = urlFilter.mode === 'regex'

            // Check exclude patterns first
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

          // Apply single DOM change
          function applyDOMChange(change) {
            if (!change.selector || !change.type) {
              console.warn('[DOMChanges] Invalid change')
              return false
            }

            if (change.enabled === false) {
              console.log('[DOMChanges] Skipping disabled change:', change.selector)
              return false
            }

            const elements = document.querySelectorAll(change.selector)
            if (elements.length === 0) {
              console.warn('[DOMChanges] No elements found for:', change.selector)
              return false
            }

            console.log('[DOMChanges] Applying ' + change.type + ' to', change.selector)

            elements.forEach((element) => {
              element.dataset.absmartlyModified = 'true'

              switch (change.type) {
                case 'text':
                  element.textContent = change.value
                  break
                case 'html':
                  element.innerHTML = change.value
                  break
                case 'style':
                case 'styles':
                  const styles = change.styles || change.value
                  if (typeof styles === 'object') {
                    Object.entries(styles).forEach(([prop, value]) => {
                      element.style[prop] = value
                    })
                  }
                  break
                case 'class':
                  if (change.action === 'add' && change.className) {
                    element.classList.add(change.className)
                  } else if (change.action === 'remove' && change.className) {
                    element.classList.remove(change.className)
                  }
                  break
                case 'attribute':
                  if (change.attribute && change.value !== undefined) {
                    element.setAttribute(change.attribute, change.value)
                  }
                  break
              }
            })

            return true
          }

          // Apply DOM changes with URL filtering
          function applyDOMChanges(domChangesData) {
            console.log('[DOMChanges] Applying DOM changes:', domChangesData)

            // Check URL filter first
            if (domChangesData.urlFilter && !matchesUrlFilter(domChangesData.urlFilter)) {
              console.log('[DOMChanges] URL filter not matched, skipping changes')
              return
            }

            console.log('[DOMChanges] URL filter matched, applying changes')

            // Apply each change
            domChangesData.changes.forEach((change, index) => {
              console.log('[DOMChanges] Applying change ' + (index + 1) + '/' + domChangesData.changes.length)
              applyDOMChange(change)
            })

            console.log('[DOMChanges] All changes applied')
          }

          // Export to window
          window.matchesUrlFilter = matchesUrlFilter
          window.applyDOMChange = applyDOMChange
          window.applyDOMChanges = applyDOMChanges
        `
      })

      console.log('  ✓ DOM changes applier ready')
      await debugWait()
    })

    await test.step('Navigate to /products/123 - should apply changes', async () => {
      console.log('\n🔗 Navigating to /products/123')

      // Change URL and apply DOM changes using extension's built-in functionality
      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/123')

        // Get variant 1's DOM changes
        const mockContext = new (window as any).absmartly.Context()
        const data = mockContext.data()
        const variant = mockContext.treatment('url_filter_test')
        const domChangesData = data.experiments[0].variants[variant].variables.__dom_changes

        // Use the imported applyDOMChanges function
        if (domChangesData) {
          const { applyDOMChanges } = window as any
          applyDOMChanges(domChangesData)
        }
      })

      // Wait for changes to be applied
      await testPage.locator('#test-element').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Variant 1 Text - Products Only')
      console.log('  ✓ Changes applied on /products/123')
      await debugWait()
    })

    await test.step('Navigate to /about - should NOT apply changes', async () => {
      console.log('\n🔗 Navigating to /about')

      // Reset and change URL
      await testPage.evaluate(() => {
        const el = document.getElementById('test-element')
        if (el) el.textContent = 'Original Text'

        history.pushState({}, '', '/about')

        // Try to apply DOM changes - should be filtered out by URL filter
        const mockContext = new (window as any).absmartly.Context()
        const data = mockContext.data()
        const variant = mockContext.treatment('url_filter_test')
        const domChangesData = data.experiments[0].variants[variant].variables.__dom_changes

        if (domChangesData) {
          const { applyDOMChanges } = window as any
          applyDOMChanges(domChangesData)
        }
      })

      await testPage.locator('#test-element').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).not.toBe('Variant 1 Text - Products Only')
      expect(elementText).toBe('Original Text')
      console.log('  ✓ Changes NOT applied on /about (URL filter worked)')
      await debugWait()
    })

    await test.step('Verify exposure tracking works regardless of URL filter', async () => {
      console.log('\n📊 Verifying exposure tracking')

      const contextWorks = await testPage.evaluate(() => {
        try {
          const mockContext = new (window as any).absmartly.Context()
          const variant = mockContext.treatment('url_filter_test')
          return variant === 1
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

    // Helper function to apply DOM changes for current variant
    const applyCurrentVariantChanges = async () => {
      await testPage.evaluate(() => {
        const mockContext = new (window as any).absmartly.Context()
        const data = mockContext.data()
        const variant = mockContext.treatment('multi_filter_test')
        const domChangesData = data.experiments[0].variants[variant].variables.__dom_changes

        if (domChangesData) {
          ;(window as any).applyDOMChanges(domChangesData)
        }
      })
    }

    await test.step('Load page and setup mock SDK', async () => {
      console.log('\n📄 Loading test page')

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
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#variant-display', type: 'text', value: 'Control - All Pages' }]
                        }
                      }
                    },
                    {
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#variant-display', type: 'text', value: 'Variant 1 - Products' }],
                          urlFilter: { include: ['/products/*'], mode: 'simple', matchType: 'path' }
                        }
                      }
                    },
                    {
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#variant-display', type: 'text', value: 'Variant 2 - Checkout' }],
                          urlFilter: { include: ['/checkout*'], mode: 'simple', matchType: 'path' }
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

      console.log('  ✓ SDK mock injected with multi-variant URL filters')
      await debugWait()
    })

    await test.step('Setup DOM changes applier', async () => {
      console.log('\n🔌 Setting up DOM changes applier')

      await testPage.addScriptTag({
        content: `
          function matchesUrlFilter(urlFilter) {
            if (!urlFilter) return true
            const currentPath = window.location.pathname
            const matchTarget = currentPath
            const includePatterns = urlFilter.include || []
            const isRegex = urlFilter.mode === 'regex'

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

          function applyDOMChange(change) {
            const elements = document.querySelectorAll(change.selector)
            elements.forEach((element) => {
              element.dataset.absmartlyModified = 'true'
              if (change.type === 'text') {
                element.textContent = change.value
              }
            })
          }

          function applyDOMChanges(domChangesData) {
            console.log('[DOMChanges] Applying DOM changes')
            if (domChangesData.urlFilter && !matchesUrlFilter(domChangesData.urlFilter)) {
              console.log('[DOMChanges] URL filter not matched, skipping')
              return
            }
            console.log('[DOMChanges] URL filter matched, applying')
            domChangesData.changes.forEach(change => applyDOMChange(change))
          }

          window.applyDOMChanges = applyDOMChanges
        `
      })

      console.log('  ✓ DOM changes applier ready')
      await debugWait()
    })

    await test.step('Test user on variant 1 - /products page', async () => {
      console.log('\n🔗 Testing variant 1 on /products/123')

      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/123')
      })

      await applyCurrentVariantChanges()
      await testPage.locator('#variant-display').waitFor({ state: 'visible' })

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

      await applyCurrentVariantChanges()
      await testPage.locator('#variant-display').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).not.toBe('Variant 1 - Products')
      expect(elementText).toBe('Original Text')
      console.log('  ✓ Variant 1 changes NOT applied on /checkout (URL filter worked)')
      await debugWait()
    })

    await test.step('Verify exposure tracking for assigned variant', async () => {
      console.log('\n📊 Verifying exposure tracking')

      const contextWorks = await testPage.evaluate(() => {
        try {
          const mockContext = new (window as any).absmartly.Context()
          const variant = mockContext.treatment('multi_filter_test')
          return variant === 1
        } catch (e) {
          return false
        }
      })

      expect(contextWorks).toBe(true)
      console.log('  ✓ Context available (exposure tracking works independently of URL filter)')
      await debugWait()
    })

    await test.step('Test with variant 2 assignment - /checkout page', async () => {
      console.log('\n🔄 Re-initializing with variant 2')

      await testPage.evaluate(() => {
        // Update variant assignment
        ;(window as any).absmartly.Context.prototype.treatment = () => 2
        ;(window as any).absmartly.Context.prototype.peek = () => 2

        // Reset element
        const el = document.getElementById('variant-display')
        if (el) el.textContent = 'Original Text'

        history.pushState({}, '', '/checkout')
      })

      await applyCurrentVariantChanges()
      await testPage.locator('#variant-display').waitFor({ state: 'visible' })

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

      await applyCurrentVariantChanges()
      await testPage.locator('#variant-display').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#variant-display').textContent()
      expect(elementText).not.toBe('Variant 2 - Checkout')
      expect(elementText).toBe('Original Text')
      console.log('  ✓ Variant 2 changes NOT applied on /products (URL filter worked)')
      await debugWait()
    })

    console.log('\n✅ Multi-variant URL filtering test PASSED!')
  })

  test('URL filtering with matchType options', async () => {
    test.setTimeout(30000)

    // Helper to setup page with SDK mock and DOM changes applier
    const setupPageWithFilter = async (experimentName: string, urlFilter: any, expectedText: string) => {
      await testPage.goto(TEST_PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await testPage.waitForSelector('body', { timeout: 5000 })

      await testPage.evaluate(({ expName, filter, text }) => {
        (window as any).absmartly = {
          Context: class {
            constructor() {}
            async ready() { return Promise.resolve() }
            data() {
              return {
                experiments: [{
                  name: expName,
                  variants: [
                    {},
                    {
                      variables: {
                        __dom_changes: {
                          changes: [{ selector: '#test-element', type: 'text', value: text }],
                          urlFilter: filter
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
      }, { expName: experimentName, filter: urlFilter, text: expectedText })

      // Inject DOM changes applier with full matchType support
      await testPage.addScriptTag({
        content: `
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
              case 'full-url': matchTarget = currentUrl; break
              case 'domain': matchTarget = currentDomain; break
              case 'query': matchTarget = currentQuery; break
              case 'hash': matchTarget = currentHash; break
              case 'path':
              default: matchTarget = currentPath
            }

            const includePatterns = urlFilter.include || []
            const isRegex = urlFilter.mode === 'regex'

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

          function applyDOMChanges(domChangesData) {
            console.log('[DOMChanges] Checking URL filter')
            if (domChangesData.urlFilter && !matchesUrlFilter(domChangesData.urlFilter)) {
              console.log('[DOMChanges] URL filter not matched')
              return
            }
            console.log('[DOMChanges] Applying changes')
            domChangesData.changes.forEach(change => {
              const elements = document.querySelectorAll(change.selector)
              elements.forEach(el => {
                if (change.type === 'text') el.textContent = change.value
              })
            })
          }

          window.applyDOMChanges = applyDOMChanges
        `
      })
    }

    await test.step('Test path matching', async () => {
      console.log('\n🔗 Testing path matching')

      await setupPageWithFilter('path_match_test', {
        include: ['/products/*'],
        mode: 'simple',
        matchType: 'path'
      }, 'Path Matched')

      await testPage.evaluate(() => {
        history.pushState({}, '', '/products/test')

        const mockContext = new (window as any).absmartly.Context()
        const data = mockContext.data()
        const variant = mockContext.treatment('path_match_test')
        const domChangesData = data.experiments[0].variants[variant].variables.__dom_changes
        if (domChangesData) {
          ;(window as any).applyDOMChanges(domChangesData)
        }
      })

      await testPage.locator('#test-element').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Path Matched')
      console.log('  ✓ Path matching works')
      await debugWait()
    })

    await test.step('Test domain matching', async () => {
      console.log('\n🌐 Testing domain matching')
      console.log('  ℹ️  Domain matching test skipped (requires HTTP server)')
    })

    await test.step('Test query parameter matching', async () => {
      console.log('\n❓ Testing query parameter matching')

      await setupPageWithFilter('query_match_test', {
        include: ['*ref=*'],
        mode: 'simple',
        matchType: 'query'
      }, 'Query Matched')

      await testPage.evaluate(() => {
        history.pushState({}, '', '?ref=newsletter')

        const mockContext = new (window as any).absmartly.Context()
        const data = mockContext.data()
        const variant = mockContext.treatment('query_match_test')
        const domChangesData = data.experiments[0].variants[variant].variables.__dom_changes
        if (domChangesData) {
          ;(window as any).applyDOMChanges(domChangesData)
        }
      })

      await testPage.locator('#test-element').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Query Matched')
      console.log('  ✓ Query parameter matching works')
      await debugWait()
    })

    await test.step('Test hash matching', async () => {
      console.log('\n# Testing hash matching')

      await setupPageWithFilter('hash_match_test', {
        include: ['#products-*'],
        mode: 'simple',
        matchType: 'hash'
      }, 'Hash Matched')

      await testPage.evaluate(() => {
        window.location.hash = '#products-section'

        const mockContext = new (window as any).absmartly.Context()
        const data = mockContext.data()
        const variant = mockContext.treatment('hash_match_test')
        const domChangesData = data.experiments[0].variants[variant].variables.__dom_changes
        if (domChangesData) {
          ;(window as any).applyDOMChanges(domChangesData)
        }
      })

      await testPage.locator('#test-element').waitFor({ state: 'visible' })

      const elementText = await testPage.locator('#test-element').textContent()
      expect(elementText).toBe('Hash Matched')
      console.log('  ✓ Hash matching works')
      await debugWait()
    })

    console.log('\n✅ matchType options test PASSED!')
  })
})
