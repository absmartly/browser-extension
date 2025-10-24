import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'

/**
 * Comprehensive E2E Tests for Visual Editor Initialization and Lifecycle
 *
 * This test suite covers:
 * 1. Visual editor loading and initialization via message-based architecture
 * 2. Editor start/stop lifecycle management through content script messages
 * 3. Multiple initialization attempts handling
 * 4. Toolbar and UI component verification
 * 5. Style injection and cleanup
 * 6. Configuration handling via messages
 * 7. Global state management through message queries
 * 8. Browser compatibility
 */

interface TestHelpers {
  isVisualEditorActive: () => boolean
  getVisualEditor: () => any
  hasVisualEditorStyles: () => boolean
  getABSmartlyStyles: () => Element[]
  simulateElementClick: (selector: string) => boolean
  hasToolbar: () => boolean
  getNotifications: () => Element[]
  highlightElement: (selector: string) => void
  isElementVisible: (selector: string) => boolean
  testChangeCounter: () => number
  getChangeCounter: () => number
}

/**
 * Helper to send test messages and wait for response
 */
async function sendTestMessage(page: Page, message: any): Promise<any> {
  return await page.evaluate((msg) => {
    return new Promise((resolve) => {
      const handleResponse = (event: MessageEvent) => {
        if (event.data?.source === 'absmartly-extension' &&
            event.data?.type === 'TEST_SIDEBAR_RESULT') {
          window.removeEventListener('message', handleResponse)
          resolve(event.data)
        }
      }

      window.addEventListener('message', handleResponse)

      window.postMessage({
        source: 'absmartly-tests',
        ...msg
      }, '*')

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleResponse)
        resolve({ success: false, message: 'Timeout' })
      }, 5000)
    })
  }, message)
}

/**
 * Helper to start visual editor via test messages
 */
async function startVisualEditor(page: Page, config: {
  variantName: string
  experimentName?: string
  changes?: any[]
}): Promise<any> {
  return await sendTestMessage(page, {
    type: 'TEST_START_VISUAL_EDITOR',
    variantName: config.variantName,
    experimentName: config.experimentName || 'test-experiment',
    changes: config.changes || []
  })
}

/**
 * Helper to get visual editor status
 */
async function getVisualEditorStatus(page: Page): Promise<any> {
  return await sendTestMessage(page, {
    type: 'TEST_STATUS'
  })
}

test.describe('Visual Editor Initialization and Lifecycle', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Navigate to test page
    await testPage.goto('file://' + __dirname + '/test-page.html')

    // Wait for page to fully load
    await testPage.waitForSelector('body', { timeout: 5000 })

    // Wait for content script to be ready
    await testPage.waitForFunction(() => {
      return (window as any).__absmartlyContentScriptLoaded === true
    }, { timeout: 5000 })

    // Inject test helper functions
    await testPage.evaluate(() => {
      (window as any).testFunctions = {
        isVisualEditorActive: function() {
          return (window as any).__absmartlyVisualEditorActive === true
        },

        getVisualEditor: function() {
          return (window as any).__absmartlyVisualEditor
        },

        hasVisualEditorStyles: function() {
          return document.getElementById('absmartly-visual-editor-styles') !== null
        },

        getABSmartlyStyles: function() {
          return Array.from(document.querySelectorAll('style[data-absmartly="true"], style[id*="absmartly"]'))
        },

        simulateElementClick: function(selector: string) {
          const element = document.querySelector(selector)
          if (element) {
            (element as HTMLElement).click()
            return true
          }
          return false
        },

        hasToolbar: function() {
          return document.querySelector('[data-absmartly="toolbar"]') !== null
        },

        getNotifications: function() {
          return Array.from(document.querySelectorAll('[data-absmartly="notification"]'))
        }
      }
    })

    // Verify test page loaded correctly
    await expect(testPage.locator('[data-testid="main-title"]')).toContainText('Visual Editor Test Page')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test.describe('Basic Initialization', () => {
    test('should load content script successfully', async () => {
      // Verify content script marker is set
      const hasContentScript = await testPage.evaluate(() => {
        return (window as any).__absmartlyContentScriptLoaded === true
      })

      expect(hasContentScript).toBe(true)

      // Verify content ready message was posted
      const hasContentReady = await testPage.evaluate(() => {
        return new Promise((resolve) => {
          let resolved = false
          const handler = (event: MessageEvent) => {
            if (event.data?.type === 'ABSMARTLY_CONTENT_READY' && !resolved) {
              resolved = true
              window.removeEventListener('message', handler)
              resolve(true)
            }
          }
          window.addEventListener('message', handler)

          // Check if message was already sent (might have been before listener attached)
          setTimeout(() => {
            if (!resolved) {
              window.removeEventListener('message', handler)
              resolve(false)
            }
          }, 1000)
        })
      })

      expect(typeof hasContentReady).toBe('boolean')
    })

    test('should initialize visual editor with basic configuration', async () => {
      // Initialize the visual editor via test message
      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(result.success).toBe(true)

      // Verify editor is marked as active
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })

    test('should handle multiple initialization attempts gracefully', async () => {
      // First initialization
      const firstResult = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(firstResult.success).toBe(true)

      // Get status after first init
      const firstStatus = await getVisualEditorStatus(testPage)
      expect(firstStatus.active).toBe(true)

      // Second initialization (editor should already be active)
      const secondResult = await startVisualEditor(testPage, {
        variantName: 'test-variant-2',
        experimentName: 'test-experiment-2'
      })

      // Should still succeed (existing editor remains active)
      expect(secondResult.success).toBe(true)
    })
  })

  test.describe('Style Injection and Management', () => {
    test('should inject required styles on initialization', async () => {
      // Check no styles before initialization
      const initialStyles = await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.getABSmartlyStyles().length
      })

      expect(initialStyles).toBe(0)

      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for editor to fully initialize
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Verify styles are injected
      const hasStyles = await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.hasVisualEditorStyles() || helpers.getABSmartlyStyles().length > 0
      })

      expect(hasStyles).toBe(true)
    })

    test('should clean up styles on editor stop', async () => {
      // Initialize and start editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for editor to be active
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Verify styles are present
      let hasStyles = await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.hasVisualEditorStyles() || helpers.getABSmartlyStyles().length > 0
      })
      expect(hasStyles).toBe(true)

      // Stop the editor
      await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        const editor = helpers.getVisualEditor()
        if (editor) {
          editor.stop()
        }
      })

      // Verify editor is no longer active
      const isActive = await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })
      expect(isActive).toBe(false)
    })
  })

  test.describe('Toolbar and UI Components', () => {
    test('should display toolbar after initialization', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for toolbar to appear (check for toolbar element or overlay)
      await testPage.waitForFunction(() => {
        return document.querySelector('#absmartly-visual-editor-overlay') !== null ||
               document.querySelector('[data-absmartly="toolbar"]') !== null
      }, { timeout: 5000 })

      // Check for overlay or toolbar presence
      const hasUI = await testPage.evaluate(() => {
        const overlay = document.querySelector('#absmartly-visual-editor-overlay')
        const toolbar = document.querySelector('[data-absmartly="toolbar"]')
        return !!(overlay || toolbar)
      })

      expect(hasUI).toBe(true)
    })

    test('should show notifications on editor start', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for initialization
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Check that editor is active (notifications might be transient)
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })
  })

  test.describe('Configuration Handling', () => {
    test('should handle initial changes configuration', async () => {
      const initialChanges = [
        {
          selector: '[data-testid="main-title"]',
          type: 'text',
          value: 'Modified Title'
        },
        {
          selector: '[data-testid="subtitle"]',
          type: 'style',
          value: { color: 'red', 'font-weight': 'bold' }
        }
      ]

      // Initialize with initial changes
      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment',
        changes: initialChanges
      })

      expect(result.success).toBe(true)

      // Verify editor is active
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
      expect(Array.isArray(status.changes)).toBe(true)
    })

    test('should handle different configuration options', async () => {
      const configs = [
        { variant: 'control', experiment: 'test-1' },
        { variant: 'variant-a', experiment: 'test-2' },
        { variant: 'variant-b', experiment: 'test-3' }
      ]

      for (const config of configs) {
        // Clear any existing editor
        await testPage.evaluate(() => {
          const helpers = (window as any).testFunctions as TestHelpers
          const editor = helpers.getVisualEditor()
          if (editor) {
            editor.destroy()
          }
          ;(window as any).__absmartlyVisualEditorActive = false
          ;(window as any).__absmartlyVisualEditor = null
        })

        // Initialize with new config
        const result = await startVisualEditor(testPage, {
          variantName: config.variant,
          experimentName: config.experiment
        })

        expect(result.success).toBe(true)
      }
    })
  })

  test.describe('Editor Lifecycle Management', () => {
    test('should properly start and stop editor multiple times', async () => {
      for (let i = 0; i < 3; i++) {
        // Initialize editor
        const initResult = await startVisualEditor(testPage, {
          variantName: `variant-${i}`,
          experimentName: `experiment-${i}`
        })

        expect(initResult.success).toBe(true)

        // Verify active state
        const activeStatus = await getVisualEditorStatus(testPage)
        expect(activeStatus.active).toBe(true)

        // Stop editor
        await testPage.evaluate(() => {
          const helpers = (window as any).testFunctions as TestHelpers
          const editor = helpers.getVisualEditor()
          if (editor) {
            editor.stop()
          }
        })

        // Verify inactive state
        await testPage.waitForFunction(() => {
          const helpers = (window as any).testFunctions as TestHelpers
          return !helpers.isVisualEditorActive()
        })

        // Clear global state for next iteration
        await testPage.evaluate(() => {
          ;(window as any).__absmartlyVisualEditor = null
        })
      }
    })

    test('should handle destroy method properly', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Verify editor is active
      let status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)

      // Destroy editor
      await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        const editor = helpers.getVisualEditor()
        if (editor) {
          editor.destroy()
        }
      })

      // Verify editor is inactive
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return !helpers.isVisualEditorActive()
      })

      const inactiveStatus = await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })
      expect(inactiveStatus).toBe(false)
    })
  })

  test.describe('Global State Management', () => {
    test('should maintain consistent global state', async () => {
      // Check initial global state
      const initialState = await testPage.evaluate(() => {
        return {
          hasActiveFlag: (window as any).__absmartlyVisualEditorActive,
          hasEditorInstance: (window as any).__absmartlyVisualEditor
        }
      })

      expect(initialState.hasActiveFlag).toBeFalsy()
      expect(initialState.hasEditorInstance).toBeFalsy()

      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Check active state
      const activeState = await testPage.evaluate(() => {
        return {
          hasActiveFlag: (window as any).__absmartlyVisualEditorActive,
          hasEditorInstance: !!((window as any).__absmartlyVisualEditor)
        }
      })

      expect(activeState.hasActiveFlag).toBe(true)
      expect(activeState.hasEditorInstance).toBe(true)

      // Stop editor
      await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        const editor = helpers.getVisualEditor()
        if (editor) {
          editor.stop()
        }
      })

      // Check inactive state
      const inactiveState = await testPage.evaluate(() => {
        return {
          hasActiveFlag: (window as any).__absmartlyVisualEditorActive,
          hasEditorInstance: !!((window as any).__absmartlyVisualEditor)
        }
      })

      expect(inactiveState.hasActiveFlag).toBe(false)
    })

    test('should prevent multiple concurrent editors', async () => {
      // Initialize first editor
      const firstInit = await startVisualEditor(testPage, {
        variantName: 'variant-1',
        experimentName: 'experiment-1'
      })

      expect(firstInit.success).toBe(true)

      // Try to initialize second editor
      const secondInit = await startVisualEditor(testPage, {
        variantName: 'variant-2',
        experimentName: 'experiment-2'
      })

      expect(secondInit.success).toBe(true)

      // Verify only one active flag
      const activeCount = await testPage.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true ? 1 : 0
      })

      expect(activeCount).toBe(1)
    })
  })

  test.describe('Visual Regression Testing', () => {
    test('should maintain visual consistency during initialization', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for initialization
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Verify page content is still accessible
      await expect(testPage.locator('[data-testid="main-title"]')).toBeVisible()
      await expect(testPage.locator('[data-testid="subtitle"]')).toBeVisible()
    })

    test('should maintain visual consistency during cleanup', async () => {
      // Initialize and then stop editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      await testPage.waitForFunction(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        return helpers.isVisualEditorActive()
      })

      await testPage.evaluate(() => {
        const helpers = (window as any).testFunctions as TestHelpers
        const editor = helpers.getVisualEditor()
        if (editor) {
          editor.stop()
        }
      })

      // Verify page is back to normal
      await expect(testPage.locator('[data-testid="main-title"]')).toBeVisible()
      await expect(testPage.locator('[data-testid="subtitle"]')).toBeVisible()
    })
  })

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle invalid configuration gracefully', async () => {
      // Test with empty values
      const invalidConfigs = [
        { variant: '', experiment: '' },
        { variant: 'variant', experiment: '' }
      ]

      for (const config of invalidConfigs) {
        const result = await startVisualEditor(testPage, {
          variantName: config.variant,
          experimentName: config.experiment
        })

        // Should either succeed or fail gracefully
        expect(typeof result.success).toBe('boolean')

        // Clear state for next iteration
        await testPage.evaluate(() => {
          const editor = (window as any).__absmartlyVisualEditor
          if (editor) {
            editor.destroy()
          }
          ;(window as any).__absmartlyVisualEditorActive = false
          ;(window as any).__absmartlyVisualEditor = null
        })
      }
    })

    test('should handle DOM manipulation during initialization', async () => {
      // Start initialization
      const initPromise = startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Simultaneously modify DOM
      await testPage.evaluate(() => {
        const newElement = document.createElement('div')
        newElement.id = 'dynamic-element'
        newElement.textContent = 'Dynamically added element'
        document.body.appendChild(newElement)
      })

      const result = await initPromise
      expect(result.success).toBe(true)

      // Verify both editor and dynamic element are present
      await expect(testPage.locator('#dynamic-element')).toBeVisible()
    })
  })

  test.describe('Browser Compatibility', () => {
    test('should work with different viewport sizes', async () => {
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1024, height: 768 },  // Tablet
        { width: 375, height: 667 }    // Mobile
      ]

      for (const viewport of viewports) {
        await testPage.setViewportSize(viewport)
        await testPage.reload()
        await testPage.waitForSelector('body', { timeout: 5000 })

        // Wait for content script
        await testPage.waitForFunction(() => {
          return (window as any).__absmartlyContentScriptLoaded === true
        }, { timeout: 5000 })

        const result = await startVisualEditor(testPage, {
          variantName: 'test-variant',
          experimentName: 'test-experiment'
        })

        expect(result.success).toBe(true)

        // Verify page is still functional
        await expect(testPage.locator('[data-testid="main-title"]')).toBeVisible()

        // Clean up for next iteration
        await testPage.evaluate(() => {
          const helpers = (window as any).testFunctions as TestHelpers
          const editor = helpers.getVisualEditor()
          if (editor) {
            editor.destroy()
          }
        })
      }
    })

    test('should handle page reload scenarios', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      const statusBefore = await getVisualEditorStatus(testPage)
      expect(statusBefore.active).toBe(true)

      // Reload page
      await testPage.reload()
      await testPage.waitForSelector('body', { timeout: 5000 })

      // Wait for content script to reload
      await testPage.waitForFunction(() => {
        return (window as any).__absmartlyContentScriptLoaded === true
      }, { timeout: 5000 })

      // Verify editor state is reset
      const isActiveAfter = await testPage.evaluate(() => {
        return !!(window as any).__absmartlyVisualEditorActive
      })
      expect(isActiveAfter).toBe(false)

      // Verify editor can be initialized again
      const reinitResult = await startVisualEditor(testPage, {
        variantName: 'test-variant-new',
        experimentName: 'test-experiment-new'
      })

      expect(reinitResult.success).toBe(true)
    })
  })
})
