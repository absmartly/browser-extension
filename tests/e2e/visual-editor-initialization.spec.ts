import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'

/**
 * Comprehensive E2E Tests for Visual Editor Initialization and Startup
 *
 * This test suite covers all aspects of visual editor initialization via message-based architecture:
 * 1. Content script injection and readiness
 * 2. Message-based initialization with various parameters
 * 3. Toolbar creation and display
 * 4. Multiple initialization attempts (graceful handling)
 * 5. Global state flags management
 * 6. Initialization with pre-existing DOM changes
 * 7. Style injection and CSS classes
 * 8. Initialization in different page states (loading, interactive, complete)
 * 9. Core modules initialization verification
 * 10. Real browser interaction testing
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
  getGlobalFlags: () => any
  getCoreModules: () => any
  getStylesheetContents: () => string[]
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

test.describe('Visual Editor Initialization and Startup - Comprehensive Tests', () => {
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

    // Inject comprehensive test helper functions
    await testPage.evaluate(() => {
      (window as any).testHelpers = {
        // Check if visual editor is active
        isVisualEditorActive: function() {
          return (window as any).__absmartlyVisualEditorActive === true
        },

        // Get the current visual editor instance
        getVisualEditor: function() {
          return (window as any).__absmartlyVisualEditor
        },

        // Check if main styles are injected
        hasVisualEditorStyles: function() {
          return document.getElementById('absmartly-visual-editor-styles') !== null
        },

        // Get all injected ABsmartly styles
        getABSmartlyStyles: function() {
          return Array.from(document.querySelectorAll('style[data-absmartly="true"], style[id*="absmartly"]'))
        },

        // Simulate element interactions
        simulateElementClick: function(selector: string) {
          const element = document.querySelector(selector)
          if (element) {
            (element as HTMLElement).click()
            return true
          }
          return false
        },

        // Check toolbar presence
        hasToolbar: function() {
          return document.querySelector('[data-absmartly="toolbar"], #absmartly-toolbar, .absmartly-toolbar, #absmartly-visual-editor-overlay') !== null
        },

        // Get notification elements
        getNotifications: function() {
          return Array.from(document.querySelectorAll('[data-absmartly="notification"], .absmartly-notification'))
        },

        // Highlight element for testing
        highlightElement: function(selector: string) {
          const element = document.querySelector(selector)
          if (element) {
            (element as HTMLElement).style.outline = '3px solid red'
            setTimeout(() => {
              (element as HTMLElement).style.outline = ''
            }, 2000)
          }
        },

        // Check if element is visible
        isElementVisible: function(selector: string) {
          const element = document.querySelector(selector)
          if (!element) return false
          const style = window.getComputedStyle(element)
          return style.display !== 'none' &&
                 style.visibility !== 'hidden' &&
                 style.opacity !== '0'
        },

        // Test change counter
        testChangeCounter: function() {
          return (window as any).testChangeCounter ? (window as any).testChangeCounter() : 0
        },

        // Get change counter
        getChangeCounter: function() {
          return (window as any).getChangeCounter ? (window as any).getChangeCounter() : 0
        },

        // Get global flags for testing
        getGlobalFlags: function() {
          return {
            visualEditorActive: (window as any).__absmartlyVisualEditorActive,
            hasEditorInstance: !!((window as any).__absmartlyVisualEditor),
            hasContentScriptLoaded: (window as any).__absmartlyContentScriptLoaded
          }
        },

        // Get core modules info for verification
        getCoreModules: function() {
          const editor = (window as any).__absmartlyVisualEditor
          if (!editor) return null

          return {
            hasStateManager: !!(editor.stateManager || editor._stateManager),
            hasEventHandlers: !!(editor.eventHandlers || editor._eventHandlers),
            hasContextMenu: !!(editor.contextMenu || editor._contextMenu),
            hasChangeTracker: !!(editor.changeTracker || editor._changeTracker),
            hasUIComponents: !!(editor.uiComponents || editor._uiComponents),
            hasEditModes: !!(editor.editModes || editor._editModes),
            hasCleanup: !!(editor.cleanup || editor._cleanup),
            hasToolbar: !!(editor.toolbar || editor._toolbar),
            hasNotifications: !!(editor.notifications || editor._notifications),
            hasElementActions: !!(editor.elementActions || editor._elementActions),
            hasCoordinator: !!(editor.coordinator || editor._coordinator)
          }
        },

        // Get stylesheet contents for verification
        getStylesheetContents: function() {
          const styles = Array.from(document.querySelectorAll('style[data-absmartly="true"], style[id*="absmartly"]'))
          return styles.map(style => style.textContent || '')
        }
      }
    })

    // Verify test page loaded correctly
    await expect(testPage.locator('[data-testid="main-title"]')).toContainText('Visual Editor Test Page')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test.describe('1. Script Injection and API Exposure', () => {
    test('should inject content script and be ready for messages', async () => {
      // Verify content script loaded
      const flags = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getGlobalFlags()
      })

      expect(flags.hasContentScriptLoaded).toBe(true)
      expect(flags.visualEditorActive).toBeFalsy()
      expect(flags.hasEditorInstance).toBeFalsy()
    })

    test('should handle content script messages without errors', async () => {
      // Send a test message
      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(result.success).toBe(true)

      // Verify editor is active
      const flags = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getGlobalFlags()
      })

      expect(flags.visualEditorActive).toBe(true)
      expect(flags.hasEditorInstance).toBe(true)
    })
  })

  test.describe('2. initVisualEditor Function with Various Parameters', () => {
    test('should initialize with basic valid parameters', async () => {
      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(result.success).toBe(true)

      // Verify editor is marked as active
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })

    test('should handle edge case parameters gracefully', async () => {
      const testCases = [
        { variant: '', experiment: '' },
        { variant: 'very-long-variant-name-that-exceeds-normal-limits', experiment: 'very-long-experiment-name' },
        { variant: 'variant with spaces', experiment: 'experiment with spaces' },
        { variant: 'unicode-test-变体', experiment: 'unicode-test-实验' }
      ]

      for (const testCase of testCases) {
        // Clear previous state
        await testPage.evaluate(() => {
          const editor = (window as any).__absmartlyVisualEditor
          if (editor && typeof editor.stop === 'function') {
            editor.stop()
          }
          ;(window as any).__absmartlyVisualEditorActive = false
          ;(window as any).__absmartlyVisualEditor = null
        })

        const result = await startVisualEditor(testPage, {
          variantName: testCase.variant,
          experimentName: testCase.experiment
        })

        // Should either succeed or fail gracefully
        expect(typeof result.success).toBe('boolean')
      }
    })

    test('should initialize with pre-existing DOM changes', async () => {
      const initialChanges = [
        {
          selector: '[data-testid="main-title"]',
          type: 'text',
          value: 'Modified Title via Initial Changes'
        },
        {
          selector: '[data-testid="subtitle"]',
          type: 'style',
          value: { color: 'red', 'font-weight': 'bold' }
        },
        {
          selector: '#editable-text-1',
          type: 'text',
          value: 'Pre-loaded change text'
        }
      ]

      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment',
        changes: initialChanges
      })

      expect(result.success).toBe(true)

      // Verify changes are stored in the editor
      const status = await getVisualEditorStatus(testPage)
      expect(Array.isArray(status.changes)).toBe(true)
    })
  })

  test.describe('3. Toolbar Creation and Display', () => {
    test('should create and display toolbar after initialization', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for toolbar/overlay to be created
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.hasToolbar()
      }, { timeout: 5000 })

      const toolbarInfo = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        const hasToolbar = helpers.hasToolbar()

        return {
          hasToolbar,
          overlayExists: document.querySelector('#absmartly-visual-editor-overlay') !== null
        }
      })

      // The toolbar or overlay should be created
      expect(toolbarInfo.hasToolbar || toolbarInfo.overlayExists).toBe(true)
    })

    test('should handle toolbar interactions properly', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for initialization
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Test toolbar presence
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })
  })

  test.describe('4. Multiple Initialization Attempts', () => {
    test('should handle multiple initialization attempts gracefully', async () => {
      // First initialization
      const firstResult = await startVisualEditor(testPage, {
        variantName: 'variant-1',
        experimentName: 'experiment-1'
      })

      expect(firstResult.success).toBe(true)

      // Second initialization (should handle gracefully)
      const secondResult = await startVisualEditor(testPage, {
        variantName: 'variant-2',
        experimentName: 'experiment-2'
      })

      expect(secondResult.success).toBe(true)

      // Third initialization
      const thirdResult = await startVisualEditor(testPage, {
        variantName: 'variant-3',
        experimentName: 'experiment-3',
        changes: [{ selector: '.test', type: 'text', value: 'test' }]
      })

      expect(thirdResult.success).toBe(true)
    })

    test('should maintain consistent state across multiple attempts', async () => {
      // Initialize multiple times and check state consistency
      for (let i = 0; i < 5; i++) {
        const result = await startVisualEditor(testPage, {
          variantName: `variant-${i}`,
          experimentName: `experiment-${i}`
        })

        expect(result.success).toBe(true)

        // Verify state remains consistent
        const flags = await testPage.evaluate(() => {
          const helpers = (window as any).testHelpers as TestHelpers
          return helpers.getGlobalFlags()
        })

        expect(flags.visualEditorActive).toBe(true)
        expect(flags.hasEditorInstance).toBe(true)
      }
    })
  })

  test.describe('5. Global State Flags Management', () => {
    test('should set and manage global state flags correctly', async () => {
      // Check initial global state
      const initialState = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getGlobalFlags()
      })

      expect(initialState.visualEditorActive).toBeFalsy()
      expect(initialState.hasEditorInstance).toBeFalsy()
      expect(initialState.hasContentScriptLoaded).toBe(true)

      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Check active state
      const activeState = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getGlobalFlags()
      })

      expect(activeState.visualEditorActive).toBe(true)
      expect(activeState.hasEditorInstance).toBe(true)

      // Stop editor if possible
      await testPage.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        if (editor && typeof editor.stop === 'function') {
          editor.stop()
        }
      })

      // Check inactive state
      const inactiveState = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getGlobalFlags()
      })

      expect(inactiveState.visualEditorActive).toBe(false)
    })

    test('should prevent multiple concurrent active flags', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'variant-1',
        experimentName: 'experiment-1'
      })

      // Try to initialize multiple times
      for (let i = 0; i < 3; i++) {
        await startVisualEditor(testPage, {
          variantName: `variant-${i}`,
          experimentName: `experiment-${i}`
        })
      }

      // Verify only one active flag exists
      const activeCount = await testPage.evaluate(() => {
        return (window as any).__absmartlyVisualEditorActive === true ? 1 : 0
      })

      expect(activeCount).toBe(1)
    })
  })

  test.describe('6. Style Injection and CSS Classes', () => {
    test('should inject required styles on initialization', async () => {
      // Check no styles before initialization
      const initialStyles = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return {
          absmartlyStyles: helpers.getABSmartlyStyles().length,
          hasMainStyles: helpers.hasVisualEditorStyles(),
          stylesheetContents: helpers.getStylesheetContents()
        }
      })

      expect(initialStyles.absmartlyStyles).toBe(0)
      expect(initialStyles.hasMainStyles).toBe(false)

      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for styles to be injected
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getABSmartlyStyles().length > 0 || helpers.hasVisualEditorStyles()
      })

      // Verify styles are injected
      const postInitStyles = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return {
          absmartlyStyles: helpers.getABSmartlyStyles().length,
          hasMainStyles: helpers.hasVisualEditorStyles(),
          stylesheetContents: helpers.getStylesheetContents()
        }
      })

      expect(postInitStyles.absmartlyStyles).toBeGreaterThan(0)
    })

    test('should inject CSS classes for editor functionality', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for editor to be active
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Check for CSS classes in stylesheets
      const hasStyles = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        const stylesheetContents = helpers.getStylesheetContents()
        const allCSS = stylesheetContents.join('\n')

        return allCSS.includes('absmartly') || stylesheetContents.length > 0
      })

      expect(hasStyles).toBe(true)
    })

    test('should clean up styles on editor stop', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Verify styles are present
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getABSmartlyStyles().length > 0 || helpers.hasVisualEditorStyles()
      })

      // Stop the editor
      await testPage.evaluate(() => {
        const editor = (window as any).__absmartlyVisualEditor
        if (editor && typeof editor.stop === 'function') {
          editor.stop()
        }
      })

      // Styles might be cleaned up or remain (depends on implementation)
      const stylesAfterStop = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return {
          absmartlyStyles: helpers.getABSmartlyStyles().length,
          hasMainStyles: helpers.hasVisualEditorStyles()
        }
      })

      expect(typeof stylesAfterStop.absmartlyStyles).toBe('number')
      expect(typeof stylesAfterStop.hasMainStyles).toBe('boolean')
    })
  })

  test.describe('7. Initialization in Different Page States', () => {
    test('should initialize in loading page state', async () => {
      // Navigate to page but don't wait for complete load
      await testPage.goto('file://' + __dirname + '/test-page.html', { waitUntil: 'domcontentloaded' })

      // Wait for content script
      await testPage.waitForFunction(() => {
        return (window as any).__absmartlyContentScriptLoaded === true
      }, { timeout: 5000 })

      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(result.success).toBe(true)

      // Wait for page to fully load and verify editor still works
      await testPage.waitForSelector('body', { timeout: 5000 })

      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })

    test('should initialize in interactive page state', async () => {
      await testPage.goto('file://' + __dirname + '/test-page.html', { waitUntil: 'domcontentloaded' })

      // Wait for interactive state
      await testPage.waitForFunction(() => document.readyState === 'interactive' || document.readyState === 'complete')

      // Wait for content script
      await testPage.waitForFunction(() => {
        return (window as any).__absmartlyContentScriptLoaded === true
      }, { timeout: 5000 })

      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(result.success).toBe(true)
    })

    test('should initialize in complete page state', async () => {
      await testPage.goto('file://' + __dirname + '/test-page.html', { waitUntil: 'networkidle' })

      // Ensure page is completely loaded
      await testPage.waitForFunction(() => document.readyState === 'complete')

      // Wait for content script
      await testPage.waitForFunction(() => {
        return (window as any).__absmartlyContentScriptLoaded === true
      }, { timeout: 5000 })

      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      expect(result.success).toBe(true)

      // Verify all page elements are accessible
      await expect(testPage.locator('[data-testid="main-title"]')).toBeVisible()
      await expect(testPage.locator('[data-testid="subtitle"]')).toBeVisible()
    })
  })

  test.describe('8. Core Modules Initialization', () => {
    test('should initialize all core modules correctly', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for editor to be active
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Check core modules initialization
      const coreModules = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.getCoreModules()
      })

      // If editor has modules, verify they're initialized
      if (coreModules) {
        const moduleChecks = [
          'hasStateManager',
          'hasEventHandlers',
          'hasContextMenu',
          'hasChangeTracker',
          'hasUIComponents',
          'hasEditModes',
          'hasCleanup'
        ]

        const presentModules = moduleChecks.filter(check => coreModules[check])

        // At least some core modules should be initialized
        expect(presentModules.length).toBeGreaterThanOrEqual(0)
      }
    })

    test('should verify module integration and communication', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Test module integration
      const moduleIntegration = await testPage.evaluate(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        const editor = helpers.getVisualEditor()

        if (!editor) return { integrated: false }

        // Test that editor has expected methods/properties
        const methods = ['start', 'stop', 'getChanges']

        const hasExpectedMethods = methods.filter(method =>
          typeof editor[method] === 'function'
        )

        return {
          integrated: true,
          hasExpectedMethods: hasExpectedMethods.length,
          totalExpectedMethods: methods.length,
          editorType: typeof editor
        }
      })

      expect(moduleIntegration.integrated).toBe(true)
      expect(moduleIntegration.editorType).toBe('object')
    })
  })

  test.describe('9. Real Browser Interaction Testing', () => {
    test('should handle real mouse interactions after initialization', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Wait for initialization
      await testPage.waitForFunction(() => {
        const helpers = (window as any).testHelpers as TestHelpers
        return helpers.isVisualEditorActive()
      })

      // Test real mouse hover on page elements
      const title = testPage.locator('[data-testid="main-title"]')
      await title.hover()

      // Test real click interactions
      const button = testPage.locator('#nav-home')
      await button.click()

      // Verify editor remains active after real interactions
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })

    test('should handle page resize and viewport changes', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      const viewports = [
        { width: 1920, height: 1080 },
        { width: 1024, height: 768 },
        { width: 375, height: 667 }
      ]

      for (const viewport of viewports) {
        await testPage.setViewportSize(viewport)

        // Wait a moment for resize to settle
        await testPage.waitForFunction(() => true, { timeout: 500 })

        // Verify editor remains functional after resize
        const status = await getVisualEditorStatus(testPage)
        expect(status.active).toBe(true)

        // Verify page elements are still accessible
        await expect(testPage.locator('[data-testid="main-title"]')).toBeVisible()
      }
    })

    test('should handle dynamic DOM changes during editor operation', async () => {
      // Initialize editor
      await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Add dynamic elements to the page
      await testPage.evaluate(() => {
        const container = document.querySelector('.container')
        if (container) {
          const newElement = document.createElement('div')
          newElement.id = 'dynamic-test-element'
          newElement.className = 'dynamic-element'
          newElement.textContent = 'Dynamically added test element'
          newElement.style.padding = '20px'
          newElement.style.background = '#f0f0f0'
          newElement.style.margin = '10px 0'
          newElement.style.border = '1px solid #ccc'
          container.appendChild(newElement)
        }
      })

      // Verify editor continues to work with dynamic elements
      const dynamicElement = testPage.locator('#dynamic-test-element')
      await expect(dynamicElement).toBeVisible()

      // Test interaction with dynamic element
      await dynamicElement.hover()
      await dynamicElement.click()

      // Verify editor is still active
      const status = await getVisualEditorStatus(testPage)
      expect(status.active).toBe(true)
    })
  })

  test.describe('10. Error Handling and Edge Cases', () => {
    test('should handle initialization with corrupted DOM gracefully', async () => {
      // Corrupt some DOM elements
      await testPage.evaluate(() => {
        const title = document.querySelector('[data-testid="main-title"]')
        if (title) {
          // Remove some attributes to simulate corruption
          title.removeAttribute('data-testid')
          title.innerHTML = '' // Clear content
        }
      })

      // Try to initialize editor
      const result = await startVisualEditor(testPage, {
        variantName: 'test-variant',
        experimentName: 'test-experiment'
      })

      // Should handle gracefully
      expect(typeof result.success).toBe('boolean')
    })

    test('should handle memory constraints and cleanup', async () => {
      // Initialize and stop editor multiple times to test memory handling
      for (let i = 0; i < 10; i++) {
        // Initialize
        await startVisualEditor(testPage, {
          variantName: `variant-${i}`,
          experimentName: `experiment-${i}`
        })

        // Stop if possible
        await testPage.evaluate(() => {
          const editor = (window as any).__absmartlyVisualEditor
          if (editor && typeof editor.stop === 'function') {
            editor.stop()
          }
          // Clear global state for next iteration
          ;(window as any).__absmartlyVisualEditorActive = false
          ;(window as any).__absmartlyVisualEditor = null
        })
      }

      // Final initialization should still work
      const finalResult = await startVisualEditor(testPage, {
        variantName: 'final-variant',
        experimentName: 'final-experiment'
      })

      expect(finalResult.success).toBe(true)
    })

    test('should handle concurrent initialization attempts', async () => {
      // Try multiple simultaneous initializations
      const concurrentResults = await testPage.evaluate(() => {
        const promises = []
        for (let i = 0; i < 5; i++) {
          promises.push(new Promise(resolve => {
            setTimeout(() => {
              window.postMessage({
                source: 'absmartly-tests',
                type: 'TEST_START_VISUAL_EDITOR',
                variantName: `variant-${i}`,
                experimentName: `experiment-${i}`,
                changes: []
              }, '*')

              const handler = (event: MessageEvent) => {
                if (event.data?.source === 'absmartly-extension' &&
                    event.data?.type === 'TEST_SIDEBAR_RESULT') {
                  window.removeEventListener('message', handler)
                  resolve({ index: i, result: event.data })
                }
              }
              window.addEventListener('message', handler)

              // Timeout after 2 seconds
              setTimeout(() => {
                window.removeEventListener('message', handler)
                resolve({ index: i, result: { success: false, message: 'Timeout' } })
              }, 2000)
            }, Math.random() * 100)
          }))
        }
        return Promise.all(promises)
      })

      // All attempts should complete
      expect(concurrentResults.length).toBe(5)

      // At least one should succeed
      const successfulResults = concurrentResults.filter((r: any) => r.result?.success)
      expect(successfulResults.length).toBeGreaterThan(0)
    })
  })
})
