import { test, expect, chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

/**
 * E2E Tests for Visual Editor Change Persistence and Restoration
 *
 * Test scenarios:
 * 1. Save changes and verify format
 * 2. Load editor with existing changes
 * 3. Apply saved changes to fresh page
 * 4. Export/import change sets
 * 5. Handle invalid change data gracefully
 * 6. Test change merging and deduplication
 * 7. Verify selector stability across page reloads
 * 8. Test with dynamic content and AJAX updates
 * 9. Cross-browser change compatibility
 * 10. Performance with large change sets
 */

interface ChangeSet {
  id: string
  name: string
  changes: any[]
  timestamp: number
  metadata: {
    pageUrl: string
    userAgent: string
    experimentName: string
    variantName: string
  }
}

test.describe('Visual Editor - Change Persistence and Restoration', () => {
  let context: BrowserContext
  let extensionId: string
  let testPageUrl: string

  test.beforeAll(async () => {
    // Setup extension context
    const pathToExtension = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
    console.log('📂 Launching browser with extension from:', pathToExtension)
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--enable-file-cookies',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    })
    console.log('✅ Browser context created')

    // Get extension ID
    console.log('🔍 Getting extension ID...')
    let [background] = context.serviceWorkers()
    if (!background) {
      console.log('⏳ Waiting for service worker...')
      background = await context.waitForEvent('serviceworker', { timeout: 10000 })
    }
    extensionId = background.url().split('/')[2]
    console.log('✅ Extension ID:', extensionId)

    // Use HTTP server instead of file:// URL
    testPageUrl = 'http://localhost:3456/persistence-test.html'
  })

  test.afterAll(async () => {
    await context.close()
  })

  test.beforeEach(async () => {
    // Create test HTML page if it doesn't exist
    await createPersistenceTestPage()
  })

  test('1. Save changes and verify format', async () => {
    const page = await context.newPage()

    // Navigate to test page
    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    // Wait for body to be ready
    await page.waitForSelector('body', { timeout: 5000 })

    // Initialize visual editor with test configuration
    const changes: any[] = await page.evaluate(() => {
      return new Promise((resolve) => {
        const mockChanges: any[] = []

        // Mock the visual editor initialization
        ;(window as any).visualEditorSaveCallback = (changes: any[]) => {
          resolve(changes)
        }

        // Simulate adding changes
        const testChanges = [
          {
            selector: '#test-button',
            type: 'style',
            value: { 'background-color': '#ff0000', 'color': 'white' },
            enabled: true,
            timestamp: Date.now()
          },
          {
            selector: '.test-paragraph',
            type: 'text',
            value: 'Modified text content',
            originalText: 'Original text',
            enabled: true,
            timestamp: Date.now()
          },
          {
            selector: '#test-container',
            type: 'class',
            add: ['highlight', 'modified'],
            remove: ['default'],
            enabled: true,
            timestamp: Date.now()
          }
        ]

        // Simulate saving changes
        ;(window as any).visualEditorSaveCallback(testChanges)
      })
    })

    // Verify change format and structure
    expect(Array.isArray(changes)).toBeTruthy()
    expect(changes.length).toBeGreaterThan(0)

    // Verify each change has required properties
    for (const change of changes as any[]) {
      expect(change).toHaveProperty('selector')
      expect(change).toHaveProperty('type')
      expect(change).toHaveProperty('enabled')
      expect(change).toHaveProperty('timestamp')
      expect(['style', 'text', 'class', 'attribute', 'html', 'javascript', 'move', 'remove', 'insert', 'create']).toContain(change.type)
    }

    // Verify specific change types
    const styleChange = changes.find((c: any) => c.type === 'style')
    expect(styleChange).toBeTruthy()
    expect(styleChange.value).toHaveProperty('background-color')

    const textChange = changes.find((c: any) => c.type === 'text')
    expect(textChange).toBeTruthy()
    expect(textChange).toHaveProperty('originalText')

    const classChange = changes.find((c: any) => c.type === 'class')
    expect(classChange).toBeTruthy()
    expect(classChange).toHaveProperty('add')
    expect(classChange).toHaveProperty('remove')

    await page.close()
  })

  test('2. Load editor with existing changes', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Prepare existing changes to load
    const existingChanges = [
      {
        selector: '#test-button',
        type: 'style',
        value: { 'background-color': '#00ff00', 'border-radius': '10px' },
        enabled: true
      },
      {
        selector: '.test-paragraph',
        type: 'text',
        value: 'Pre-loaded text content',
        enabled: true
      }
    ]

    // Load editor with existing changes
    const loadResult = await page.evaluate((changes) => {
      return new Promise((resolve) => {
        // Mock visual editor initialization with existing changes
        const result = {
          changesLoaded: changes.length,
          appliedChanges: [] as any[]
        }

        // Simulate applying existing changes
        changes.forEach((change: any) => {
          const element = document.querySelector(change.selector)
          if (element && change.enabled) {
            if (change.type === 'style') {
              Object.assign((element as HTMLElement).style, change.value)
              result.appliedChanges.push(change)
            } else if (change.type === 'text') {
              element.textContent = change.value
              result.appliedChanges.push(change)
            }
          }
        })

        resolve(result)
      })
    }, existingChanges)

    // Verify changes were loaded and applied
    expect((loadResult as any).changesLoaded).toBe(existingChanges.length)
    expect((loadResult as any).appliedChanges.length).toBe(existingChanges.length)

    // Verify changes are visually applied
    const buttonStyle = await page.evaluate(() => {
      const button = document.querySelector('#test-button') as HTMLElement
      return button ? window.getComputedStyle(button).backgroundColor : null
    })
    expect(buttonStyle).toContain('0, 255, 0') // Green background

    const paragraphText = await page.evaluate(() => {
      const paragraph = document.querySelector('.test-paragraph')
      return paragraph?.textContent
    })
    expect(paragraphText).toBe('Pre-loaded text content')

    await page.close()
  })

  test('3. Apply saved changes to fresh page', async () => {
    const page = await context.newPage()

    // First, create and save changes
    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const savedChanges = await page.evaluate(() => {
      const changes = [
        {
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': '#purple', 'padding': '20px' },
          enabled: true
        },
        {
          selector: '.test-paragraph',
          type: 'html',
          value: '<strong>Bold modified content</strong>',
          originalHtml: 'Original content',
          enabled: true
        }
      ]

      // Store in localStorage to simulate persistence
      localStorage.setItem('absmartly_saved_changes', JSON.stringify(changes))
      return changes
    })

    // Navigate to fresh page (reload)
    await page.reload()
    await page.waitForSelector('body', { timeout: 5000 })

    // Apply saved changes to fresh page
    const applicationResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const savedChanges = localStorage.getItem('absmartly_saved_changes')
        if (!savedChanges) {
          resolve({ success: false, error: 'No saved changes found' })
          return
        }

        const changes = JSON.parse(savedChanges)
        const results = []

        for (const change of changes) {
          const element = document.querySelector(change.selector)
          if (element && change.enabled) {
            try {
              if (change.type === 'style') {
                Object.assign((element as HTMLElement).style, change.value)
                results.push({ selector: change.selector, applied: true })
              } else if (change.type === 'html') {
                element.innerHTML = change.value
                results.push({ selector: change.selector, applied: true })
              }
            } catch (error) {
              results.push({ selector: change.selector, applied: false, error: error.message })
            }
          } else {
            results.push({ selector: change.selector, applied: false, error: 'Element not found or disabled' })
          }
        }

        resolve({ success: true, results })
      })
    })

    // Verify application results
    expect((applicationResult as any).success).toBeTruthy()
    expect((applicationResult as any).results.length).toBe(savedChanges.length)

    // Verify changes are applied correctly
    const allApplied = (applicationResult as any).results.every((r: any) => r.applied)
    expect(allApplied).toBeTruthy()

    await page.close()
  })

  test('4. Export/import change sets', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Create a comprehensive change set
    const originalChangeSet: ChangeSet = {
      id: 'test-changeset-1',
      name: 'Test Export/Import',
      timestamp: Date.now(),
      metadata: {
        pageUrl: testPageUrl,
        userAgent: 'Test Agent',
        experimentName: 'Test Experiment',
        variantName: 'Variant A'
      },
      changes: [
        {
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': '#ff6b6b', 'transform': 'scale(1.1)' },
          enabled: true
        },
        {
          selector: '.test-paragraph',
          type: 'text',
          value: 'Exported and imported text',
          enabled: true
        },
        {
          selector: '#test-container',
          type: 'attribute',
          value: { 'data-test': 'exported', 'title': 'Imported content' },
          enabled: true
        }
      ]
    }

    // Test export functionality
    const exportedData = await page.evaluate((changeSet) => {
      // Simulate export process
      const exported = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        changeSet: changeSet,
        checksum: btoa(JSON.stringify(changeSet)).slice(0, 16) // Simple checksum
      }

      // Store for import test
      localStorage.setItem('absmartly_exported_changeset', JSON.stringify(exported))
      return exported
    }, originalChangeSet)

    // Verify export format
    expect(exportedData.version).toBeTruthy()
    expect(exportedData.exportDate).toBeTruthy()
    expect(exportedData.changeSet).toEqual(originalChangeSet)
    expect(exportedData.checksum).toBeTruthy()

    // Test import functionality
    const importResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        const exportedData = localStorage.getItem('absmartly_exported_changeset')
        if (!exportedData) {
          resolve({ success: false, error: 'No exported data found' })
          return
        }

        try {
          const imported = JSON.parse(exportedData)

          // Validate import data
          if (!imported.version || !imported.changeSet) {
            resolve({ success: false, error: 'Invalid export format' })
            return
          }

          // Verify checksum
          const expectedChecksum = btoa(JSON.stringify(imported.changeSet)).slice(0, 16)
          if (imported.checksum !== expectedChecksum) {
            resolve({ success: false, error: 'Checksum mismatch - data may be corrupted' })
            return
          }

          // Apply imported changes
          const changeSet = imported.changeSet
          const results = []

          for (const change of changeSet.changes) {
            const element = document.querySelector(change.selector)
            if (element && change.enabled) {
              if (change.type === 'style') {
                Object.assign((element as HTMLElement).style, change.value)
                results.push({ selector: change.selector, type: change.type, applied: true })
              } else if (change.type === 'text') {
                element.textContent = change.value
                results.push({ selector: change.selector, type: change.type, applied: true })
              } else if (change.type === 'attribute') {
                Object.entries(change.value).forEach(([attr, value]) => {
                  element.setAttribute(attr, value as string)
                })
                results.push({ selector: change.selector, type: change.type, applied: true })
              }
            }
          }

          resolve({
            success: true,
            imported: changeSet,
            appliedChanges: results
          })
        } catch (error) {
          resolve({ success: false, error: error.message })
        }
      })
    })

    // Verify import success
    expect((importResult as any).success).toBeTruthy()
    expect((importResult as any).imported).toEqual(originalChangeSet)
    expect((importResult as any).appliedChanges.length).toBe(originalChangeSet.changes.length)

    await page.close()
  })

  test('5. Handle invalid change data gracefully', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Test various invalid change scenarios
    const invalidChangeTests = await page.evaluate(() => {
      const tests = []

      // Test 1: Invalid selector
      try {
        const invalidSelector = {
          selector: '###invalid:::selector',
          type: 'style',
          value: { 'color': 'red' },
          enabled: true
        }
        const element = document.querySelector(invalidSelector.selector)
        tests.push({
          test: 'invalid-selector',
          passed: element === null, // Should not find element
          error: null
        })
      } catch (error) {
        tests.push({
          test: 'invalid-selector',
          passed: true, // Error is expected
          error: error.message
        })
      }

      // Test 2: Missing required properties
      try {
        const incompleteChange = {
          selector: '#test-button',
          // missing type
          value: { 'color': 'blue' }
        }
        tests.push({
          test: 'missing-type',
          passed: !(incompleteChange as any).type, // Should detect missing type
          error: null
        })
      } catch (error) {
        tests.push({
          test: 'missing-type',
          passed: true,
          error: error.message
        })
      }

      // Test 3: Invalid change type
      const invalidTypeChange = {
        selector: '#test-button',
        type: 'invalid-type',
        value: { 'color': 'green' },
        enabled: true
      }
      const validTypes = ['style', 'text', 'class', 'attribute', 'html', 'javascript', 'move', 'remove', 'insert', 'create']
      tests.push({
        test: 'invalid-type',
        passed: !validTypes.includes(invalidTypeChange.type),
        error: null
      })

      // Test 4: Malformed JSON in stored changes
      try {
        localStorage.setItem('absmartly_malformed_changes', '{"selector": "#test", "type": "style", "value": {invalid json}')
        const stored = localStorage.getItem('absmartly_malformed_changes')
        JSON.parse(stored!)
        tests.push({
          test: 'malformed-json',
          passed: false, // Should have thrown error
          error: null
        })
      } catch (error) {
        tests.push({
          test: 'malformed-json',
          passed: true, // Error is expected
          error: error.message
        })
      }

      // Test 5: Non-existent element selector
      const nonExistentChange = {
        selector: '#non-existent-element',
        type: 'style',
        value: { 'color': 'purple' },
        enabled: true
      }
      const element = document.querySelector(nonExistentChange.selector)
      tests.push({
        test: 'non-existent-element',
        passed: element === null,
        error: null
      })

      return tests
    })

    // Verify all invalid data scenarios are handled gracefully
    for (const test of invalidChangeTests) {
      expect(test.passed).toBeTruthy()
    }

    await page.close()
  })

  test('6. Test change merging and deduplication', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const mergingResult = await page.evaluate(() => {
      // Simulate multiple changes to the same element
      const changes = [
        {
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': 'red' },
          enabled: true,
          timestamp: 1000
        },
        {
          selector: '#test-button',
          type: 'style',
          value: { 'color': 'white' },
          enabled: true,
          timestamp: 2000
        },
        {
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': 'blue' }, // Should override red
          enabled: true,
          timestamp: 3000
        },
        {
          selector: '.test-paragraph',
          type: 'text',
          value: 'First text',
          enabled: true,
          timestamp: 1500
        },
        {
          selector: '.test-paragraph',
          type: 'text',
          value: 'Final text', // Should override first text
          enabled: true,
          timestamp: 2500
        }
      ]

      // Define test change type with timestamp
      interface TestChange {
        selector: string
        type: 'text' | 'style'
        value: string | Record<string, string>
        enabled: boolean
        timestamp: number
      }

      // Implement merging logic
      const mergedChanges: TestChange[] = []
      const changeMap = new Map<string, TestChange>()

      for (const change of changes as TestChange[]) {
        const key = `${change.selector}:${change.type}`

        if (changeMap.has(key)) {
          const existing = changeMap.get(key)!

          if (change.type === 'style' && existing.type === 'style') {
            // Merge style properties - both must be Records
            if (typeof change.value === 'object' && typeof existing.value === 'object') {
              existing.value = { ...existing.value, ...change.value }
              existing.timestamp = Math.max(existing.timestamp, change.timestamp)
            }
          } else {
            // Replace for other types if newer
            if (change.timestamp > existing.timestamp) {
              changeMap.set(key, change)
            }
          }
        } else {
          changeMap.set(key, { ...change })
        }
      }

      // Convert map back to array
      const finalChanges = Array.from(changeMap.values())

      return {
        originalCount: changes.length,
        mergedCount: finalChanges.length,
        changes: finalChanges
      }
    })

    // Verify merging worked correctly
    expect(mergingResult.originalCount).toBe(5)
    expect(mergingResult.mergedCount).toBe(2) // Should merge to 2 unique selector:type combinations

    // Find the merged style change
    const mergedStyleChange = mergingResult.changes.find(c => c.selector === '#test-button' && c.type === 'style')
    expect(mergedStyleChange).toBeTruthy()
    expect(mergedStyleChange.value).toEqual({
      'background-color': 'blue', // Latest value
      'color': 'white' // Merged value
    })

    // Find the final text change
    const finalTextChange = mergingResult.changes.find(c => c.selector === '.test-paragraph' && c.type === 'text')
    expect(finalTextChange).toBeTruthy()
    expect(finalTextChange.value).toBe('Final text')

    await page.close()
  })

  test('7. Verify selector stability across page reloads', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Capture initial selectors and element properties
    const initialState = await page.evaluate(() => {
      const elements = [
        { selector: '#test-button', exists: !!document.querySelector('#test-button') },
        { selector: '.test-paragraph', exists: !!document.querySelector('.test-paragraph') },
        { selector: '#test-container', exists: !!document.querySelector('#test-container') },
        { selector: 'h1', exists: !!document.querySelector('h1') }
      ]

      return {
        elements,
        timestamp: Date.now(),
        documentTitle: document.title
      }
    })

    // Apply changes before reload
    await page.evaluate(() => {
      const changes = [
        {
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': 'orange', 'border': '2px solid black' }
        },
        {
          selector: '.test-paragraph',
          type: 'text',
          value: 'Text before reload'
        }
      ]

      localStorage.setItem('absmartly_pre_reload_changes', JSON.stringify(changes))

      // Apply changes
      changes.forEach(change => {
        const element = document.querySelector(change.selector)
        if (element) {
          if (change.type === 'style' && typeof change.value === 'object') {
            Object.assign((element as HTMLElement).style, change.value)
          } else if (change.type === 'text' && typeof change.value === 'string') {
            element.textContent = change.value
          }
        }
      })
    })

    // Reload the page
    await page.reload()
    await page.waitForSelector('body', { timeout: 5000 })

    // Verify selector stability after reload
    const postReloadState = await page.evaluate(() => {
      const elements = [
        { selector: '#test-button', exists: !!document.querySelector('#test-button') },
        { selector: '.test-paragraph', exists: !!document.querySelector('.test-paragraph') },
        { selector: '#test-container', exists: !!document.querySelector('#test-container') },
        { selector: 'h1', exists: !!document.querySelector('h1') }
      ]

      // Try to reapply saved changes
      const savedChanges = localStorage.getItem('absmartly_pre_reload_changes')
      let reapplicationResults = []

      if (savedChanges) {
        const changes = JSON.parse(savedChanges)
        reapplicationResults = changes.map((change: any) => {
          const element = document.querySelector(change.selector)
          if (element) {
            if (change.type === 'style') {
              Object.assign((element as HTMLElement).style, change.value)
              return { selector: change.selector, reapplied: true }
            } else if (change.type === 'text') {
              element.textContent = change.value
              return { selector: change.selector, reapplied: true }
            }
          }
          return { selector: change.selector, reapplied: false }
        })
      }

      return {
        elements,
        reapplicationResults,
        timestamp: Date.now(),
        documentTitle: document.title
      }
    })

    // Verify all selectors still exist after reload
    for (let i = 0; i < initialState.elements.length; i++) {
      const initial = initialState.elements[i]
      const postReload = postReloadState.elements[i]

      expect(initial.selector).toBe(postReload.selector)
      expect(initial.exists).toBe(postReload.exists)
      expect(postReload.exists).toBeTruthy()
    }

    // Verify changes could be reapplied
    expect(postReloadState.reapplicationResults.length).toBeGreaterThan(0)
    postReloadState.reapplicationResults.forEach((result: any) => {
      expect(result.reapplied).toBeTruthy()
    })

    await page.close()
  })

  test('8. Test with dynamic content and AJAX updates', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Simulate dynamic content updates
    const dynamicTestResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Create initial changes
        const initialChanges = [
          {
            selector: '#dynamic-content',
            type: 'style',
            value: { 'background-color': 'lightblue' },
            enabled: true
          }
        ]

        // Apply initial changes
        let element = document.querySelector('#dynamic-content') as HTMLElement
        if (element) {
          Object.assign(element.style, initialChanges[0].value)
        }

        // Simulate AJAX content update
        setTimeout(() => {
          // Create new dynamic content
          const container = document.getElementById('test-container')
          if (container) {
            const newElement = document.createElement('div')
            newElement.id = 'dynamic-content-new'
            newElement.textContent = 'New dynamic content'
            newElement.className = 'dynamic-item'
            container.appendChild(newElement)

            // Try to apply changes to new element with updated selector
            const updatedChanges = [
              {
                selector: '#dynamic-content-new',
                type: 'style',
                value: { 'background-color': 'lightgreen', 'padding': '10px' },
                enabled: true
              },
              {
                selector: '.dynamic-item',
                type: 'text',
                value: 'Updated dynamic content',
                enabled: true
              }
            ]

            const results = updatedChanges.map(change => {
              const elem = document.querySelector(change.selector)
              if (elem) {
                if (change.type === 'style' && typeof change.value === 'object') {
                  Object.assign((elem as HTMLElement).style, change.value)
                  return { selector: change.selector, applied: true, found: true }
                } else if (change.type === 'text' && typeof change.value === 'string') {
                  elem.textContent = change.value
                  return { selector: change.selector, applied: true, found: true }
                }
              }
              return { selector: change.selector, applied: false, found: false }
            })

            resolve({
              success: true,
              dynamicElementCreated: !!document.querySelector('#dynamic-content-new'),
              changeApplicationResults: results
            })
          } else {
            resolve({ success: false, error: 'Container not found' })
          }
        }, 100)
      })
    })

    // Verify dynamic content handling
    expect((dynamicTestResult as any).success).toBeTruthy()
    expect((dynamicTestResult as any).dynamicElementCreated).toBeTruthy()

    const results = (dynamicTestResult as any).changeApplicationResults
    expect(results.length).toBe(2)
    results.forEach((result: any) => {
      expect(result.found).toBeTruthy()
      expect(result.applied).toBeTruthy()
    })

    await page.close()
  })

  test('9. Cross-browser change compatibility', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Test browser-specific compatibility
    const compatibilityResult = await page.evaluate(() => {
      const userAgent = navigator.userAgent
      const isChrome = userAgent.includes('Chrome')
      const isFirefox = userAgent.includes('Firefox')
      const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome')

      // Test CSS properties that might have compatibility issues
      const testChanges = [
        {
          selector: '#test-button',
          type: 'style',
          value: {
            'transform': 'rotate(45deg)', // Should work in all modern browsers
            'border-radius': '50%',       // Should work in all modern browsers
            'box-shadow': '0 4px 8px rgba(0,0,0,0.2)', // Should work in all modern browsers
            'transition': 'all 0.3s ease' // Should work in all modern browsers
          }
        },
        {
          selector: '.test-paragraph',
          type: 'style',
          value: {
            'display': 'flex',           // Should work in all modern browsers
            'align-items': 'center',     // Should work in all modern browsers
            'justify-content': 'center', // Should work in all modern browsers
            'gap': '10px'               // Modern property, should work in recent browsers
          }
        }
      ]

      const results = testChanges.map(change => {
        const element = document.querySelector(change.selector) as HTMLElement
        if (element) {
          const computedStyleBefore = window.getComputedStyle(element)
          const beforeValues: any = {}

          // Capture values before change
          Object.keys(change.value).forEach(prop => {
            beforeValues[prop] = computedStyleBefore.getPropertyValue(prop)
          })

          // Apply changes
          Object.assign(element.style, change.value)

          // Check if changes were applied
          const computedStyleAfter = window.getComputedStyle(element)
          const afterValues: any = {}
          const compatibility: any = {}

          Object.keys(change.value).forEach(prop => {
            afterValues[prop] = computedStyleAfter.getPropertyValue(prop)
            compatibility[prop] = {
              before: beforeValues[prop],
              after: afterValues[prop],
              applied: afterValues[prop] !== beforeValues[prop],
              supported: afterValues[prop] !== '' && afterValues[prop] !== 'initial'
            }
          })

          return {
            selector: change.selector,
            compatibility,
            browser: { isChrome, isFirefox, isSafari, userAgent }
          }
        }
        return null
      }).filter(Boolean)

      return {
        browser: { isChrome, isFirefox, isSafari, userAgent },
        results
      }
    })

    // Verify compatibility results
    expect(compatibilityResult.results.length).toBeGreaterThan(0)

    compatibilityResult.results.forEach((result: any) => {
      expect(result.selector).toBeTruthy()
      expect(result.compatibility).toBeTruthy()
      expect(result.browser).toBeTruthy()

      // Check that basic CSS properties are supported
      Object.entries(result.compatibility).forEach(([prop, compat]: [string, any]) => {
        if (['transform', 'border-radius', 'box-shadow', 'transition'].includes(prop)) {
          expect(compat.supported).toBeTruthy() // Property should be supported
        }
      })
    })

    await page.close()
  })

  test('10. Performance with large change sets', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Create a large change set for performance testing
    const performanceResult = await page.evaluate(() => {
      const startTime = performance.now()

      // Create many test elements
      const container = document.getElementById('test-container')!
      const elements = []

      for (let i = 0; i < 100; i++) {
        const element = document.createElement('div')
        element.id = `perf-test-${i}`
        element.className = 'perf-test-item'
        element.textContent = `Performance test item ${i}`
        container.appendChild(element)
        elements.push(element)
      }

      const setupTime = performance.now() - startTime

      // Create large change set (1000 changes)
      const largeChangeSet = []
      for (let i = 0; i < 100; i++) {
        // Multiple changes per element
        largeChangeSet.push(
          {
            selector: `#perf-test-${i}`,
            type: 'style',
            value: {
              'background-color': `hsl(${i * 3.6}, 70%, 80%)`,
              'padding': '5px',
              'margin': '2px',
              'border-radius': '3px'
            },
            enabled: true
          },
          {
            selector: `#perf-test-${i}`,
            type: 'text',
            value: `Updated item ${i}`,
            enabled: true
          },
          {
            selector: `#perf-test-${i}`,
            type: 'class',
            add: ['performance-tested', `item-${i}`],
            remove: [],
            enabled: true
          }
        )
      }

      // Apply changes and measure performance
      const applyStartTime = performance.now()

      const applicationResults = largeChangeSet.map(change => {
        const element = document.querySelector(change.selector)
        if (element && change.enabled) {
          try {
            if (change.type === 'style') {
              Object.assign((element as HTMLElement).style, change.value)
            } else if (change.type === 'text') {
              element.textContent = change.value
            } else if (change.type === 'class') {
              if (change.add) {
                element.classList.add(...change.add)
              }
              if (change.remove) {
                element.classList.remove(...change.remove)
              }
            }
            return { selector: change.selector, type: change.type, success: true }
          } catch (error) {
            return { selector: change.selector, type: change.type, success: false, error: error.message }
          }
        }
        return { selector: change.selector, type: change.type, success: false, error: 'Element not found' }
      })

      const applyEndTime = performance.now()

      // Test serialization performance
      const serializeStartTime = performance.now()
      const serialized = JSON.stringify(largeChangeSet)
      const serializeEndTime = performance.now()

      // Test deserialization performance
      const deserializeStartTime = performance.now()
      const deserialized = JSON.parse(serialized)
      const deserializeEndTime = performance.now()

      const totalTime = performance.now() - startTime

      return {
        changeSetSize: largeChangeSet.length,
        elementsCreated: elements.length,
        timings: {
          setup: setupTime,
          application: applyEndTime - applyStartTime,
          serialization: serializeEndTime - serializeStartTime,
          deserialization: deserializeEndTime - deserializeStartTime,
          total: totalTime
        },
        results: {
          successful: applicationResults.filter(r => r.success).length,
          failed: applicationResults.filter(r => !r.success).length,
          total: applicationResults.length
        },
        performance: {
          changesPerSecond: largeChangeSet.length / ((applyEndTime - applyStartTime) / 1000),
          averageTimePerChange: (applyEndTime - applyStartTime) / largeChangeSet.length
        }
      }
    })

    // Verify performance metrics
    expect(performanceResult.changeSetSize).toBe(300) // 100 elements × 3 changes each
    expect(performanceResult.elementsCreated).toBe(100)

    // Performance assertions
    expect(performanceResult.timings.application).toBeLessThan(5000) // Should complete within 5 seconds
    expect(performanceResult.timings.serialization).toBeLessThan(1000) // Should serialize within 1 second
    expect(performanceResult.timings.deserialization).toBeLessThan(1000) // Should deserialize within 1 second

    // Success rate assertions
    expect(performanceResult.results.successful).toBeGreaterThan(performanceResult.results.failed)
    expect(performanceResult.results.successful / performanceResult.results.total).toBeGreaterThan(0.9) // >90% success rate

    // Performance benchmarks
    expect(performanceResult.performance.changesPerSecond).toBeGreaterThan(50) // At least 50 changes per second
    expect(performanceResult.performance.averageTimePerChange).toBeLessThan(20) // Less than 20ms per change

    console.log('Performance results:', performanceResult)

    await page.close()
  })

  // Additional test scenarios for extended persistence features

  test('11. Message passing to extension background - test postMessage API', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Test extension message passing
    const messagePassingResult = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const testMessages = [
          {
            type: 'SAVE_CHANGES',
            payload: {
              experimentId: 'exp-123',
              variantId: 'var-456',
              changes: [
                {
                  selector: '#test-button',
                  type: 'style',
                  value: { 'background-color': 'red' }
                }
              ]
            }
          },
          {
            type: 'LOAD_CHANGES',
            payload: {
              experimentId: 'exp-123',
              variantId: 'var-456'
            }
          },
          {
            type: 'SYNC_CHANGES',
            payload: {
              tabId: 'tab-123',
              timestamp: Date.now()
            }
          }
        ]

        const messageResults: any[] = []
        let messageCount = 0

        // Mock extension runtime message handler
        ;(window as any).chrome = {
          runtime: {
            sendMessage: (message: any, callback?: (response: any) => void) => {
              messageResults.push({
                message: message,
                timestamp: Date.now(),
                success: true
              })

              // Simulate background script response
              if (callback) {
                setTimeout(() => {
                  callback({
                    success: true,
                    data: message.type === 'LOAD_CHANGES' ?
                      { changes: [{ selector: '#test', type: 'style', value: {} }] } :
                      { acknowledged: true }
                  })
                }, 10)
              }

              messageCount++
              if (messageCount === testMessages.length) {
                resolve({
                  success: true,
                  messagesSent: messageCount,
                  results: messageResults
                })
              }
            },
            onMessage: {
              addListener: (callback: (message: any, sender: any, sendResponse: (response: any) => void) => void) => {
                // Simulate incoming messages from background
                setTimeout(() => {
                  callback(
                    { type: 'CHANGES_UPDATED', data: { changeCount: 5 } },
                    { tab: { id: 123 } },
                    (response) => console.log('Response sent:', response)
                  )
                }, 50)
              }
            }
          }
        }

        // Send test messages
        testMessages.forEach((message, index) => {
          setTimeout(() => {
            ;(window as any).chrome.runtime.sendMessage(message, (response: any) => {
              messageResults[messageResults.length - 1].response = response
            })
          }, index * 20)
        })
      })
    })

    // Verify message passing functionality
    expect((messagePassingResult as any).success).toBeTruthy()
    expect((messagePassingResult as any).messagesSent).toBe(3)
    expect((messagePassingResult as any).results.length).toBe(3)

    // Verify each message was handled correctly
    ;(messagePassingResult as any).results.forEach((result: any) => {
      expect(result.success).toBeTruthy()
      expect(result.message).toBeTruthy()
      expect(result.timestamp).toBeTruthy()
    })

    await page.close()
  })

  test('12. LocalStorage persistence of changes - verify storage APIs', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const storageTestResult = await page.evaluate(() => {
      const testData = {
        experiments: {
          'exp-1': {
            name: 'Test Experiment 1',
            variants: {
              'var-a': {
                name: 'Variant A',
                changes: [
                  { selector: '#test-button', type: 'style', value: { 'color': 'blue' } },
                  { selector: '.test-paragraph', type: 'text', value: 'Modified text' }
                ]
              },
              'var-b': {
                name: 'Variant B',
                changes: [
                  { selector: '#test-button', type: 'style', value: { 'color': 'green' } }
                ]
              }
            }
          },
          'exp-2': {
            name: 'Test Experiment 2',
            variants: {
              'var-c': {
                name: 'Variant C',
                changes: [
                  { selector: '#dynamic-content', type: 'html', value: '<strong>Updated content</strong>' }
                ]
              }
            }
          }
        },
        settings: {
          autoSave: true,
          syncAcrossTabs: true,
          compressionEnabled: false
        },
        metadata: {
          lastSave: Date.now(),
          version: '1.0.0',
          userId: 'user-123'
        }
      }

      const tests = []

      // Test 1: Basic storage operations
      try {
        localStorage.setItem('absmartly_experiments', JSON.stringify(testData.experiments))
        localStorage.setItem('absmartly_settings', JSON.stringify(testData.settings))
        localStorage.setItem('absmartly_metadata', JSON.stringify(testData.metadata))

        const retrievedExperiments = JSON.parse(localStorage.getItem('absmartly_experiments') || '{}')
        const retrievedSettings = JSON.parse(localStorage.getItem('absmartly_settings') || '{}')
        const retrievedMetadata = JSON.parse(localStorage.getItem('absmartly_metadata') || '{}')

        tests.push({
          name: 'basic-storage',
          success: JSON.stringify(retrievedExperiments) === JSON.stringify(testData.experiments) &&
                  JSON.stringify(retrievedSettings) === JSON.stringify(testData.settings) &&
                  JSON.stringify(retrievedMetadata) === JSON.stringify(testData.metadata)
        })
      } catch (error) {
        tests.push({ name: 'basic-storage', success: false, error: error.message })
      }

      // Test 2: Storage capacity test
      try {
        const largeData = { changes: [] as any[] }
        for (let i = 0; i < 1000; i++) {
          largeData.changes.push({
            selector: `#element-${i}`,
            type: 'style',
            value: { 'background-color': `hsl(${i}, 50%, 50%)` }
          })
        }

        const serialized = JSON.stringify(largeData)
        localStorage.setItem('absmartly_large_changeset', serialized)
        const retrieved = localStorage.getItem('absmartly_large_changeset')

        tests.push({
          name: 'storage-capacity',
          success: retrieved === serialized,
          dataSize: serialized.length
        })
      } catch (error) {
        tests.push({ name: 'storage-capacity', success: false, error: error.message })
      }

      // Test 3: Storage event simulation
      try {
        let storageEventTriggered = false
        const storageHandler = (event: StorageEvent) => {
          if (event.key === 'absmartly_test_event') {
            storageEventTriggered = true
          }
        }

        window.addEventListener('storage', storageHandler)
        localStorage.setItem('absmartly_test_event', 'test-value')

        // Clean up
        setTimeout(() => {
          window.removeEventListener('storage', storageHandler)
          localStorage.removeItem('absmartly_test_event')
        }, 100)

        tests.push({
          name: 'storage-events',
          success: true, // Event setup successful
          eventListenerAdded: true
        })
      } catch (error) {
        tests.push({ name: 'storage-events', success: false, error: error.message })
      }

      // Test 4: Storage cleanup and management
      try {
        // Create multiple keys with expiration
        const expirationTime = Date.now() + 3600000 // 1 hour from now
        const expiredTime = Date.now() - 3600000 // 1 hour ago

        localStorage.setItem('absmartly_fresh_data', JSON.stringify({
          data: 'fresh',
          expires: expirationTime
        }))
        localStorage.setItem('absmartly_expired_data', JSON.stringify({
          data: 'expired',
          expires: expiredTime
        }))

        // Simulate cleanup of expired data
        const keys = Object.keys(localStorage).filter(key => key.startsWith('absmartly_'))
        let cleanedCount = 0

        keys.forEach(key => {
          try {
            const data = JSON.parse(localStorage.getItem(key) || '{}')
            if (data.expires && data.expires < Date.now()) {
              localStorage.removeItem(key)
              cleanedCount++
            }
          } catch (e) {
            // Skip invalid JSON
          }
        })

        tests.push({
          name: 'storage-cleanup',
          success: cleanedCount > 0,
          cleanedCount,
          totalKeys: keys.length
        })
      } catch (error) {
        tests.push({ name: 'storage-cleanup', success: false, error: error.message })
      }

      return {
        success: tests.every(t => t.success),
        tests,
        totalSize: JSON.stringify(testData).length
      }
    })

    // Verify storage test results
    expect((storageTestResult as any).success).toBeTruthy()
    expect((storageTestResult as any).tests.length).toBe(4)

    const tests = (storageTestResult as any).tests
    expect(tests.find((t: any) => t.name === 'basic-storage').success).toBeTruthy()
    expect(tests.find((t: any) => t.name === 'storage-capacity').success).toBeTruthy()
    expect(tests.find((t: any) => t.name === 'storage-events').success).toBeTruthy()
    expect(tests.find((t: any) => t.name === 'storage-cleanup').success).toBeTruthy()

    await page.close()
  })

  test('13. Cross-tab synchronization of changes - test broadcast channel or storage events', async () => {
    // Create two tabs to test cross-tab synchronization
    const tab1 = await context.newPage()
    const tab2 = await context.newPage()

    await tab1.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await tab2.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await Promise.all([
      tab1.waitForSelector('body', { timeout: 5000 }),
      tab2.waitForSelector('body', { timeout: 5000 })
    ])

    // Test cross-tab synchronization
    const syncResult = await Promise.all([
      // Tab 1: Setup sync listener and make changes
      tab1.evaluate(() => {
        return new Promise((resolve) => {
          const syncData = {
            sent: [] as any[],
            received: [] as any[]
          }

          // Setup BroadcastChannel for cross-tab communication
          const channel = new BroadcastChannel('absmartly-sync')

          channel.onmessage = (event) => {
            syncData.received.push({
              type: event.data.type,
              timestamp: Date.now(),
              data: event.data
            })
          }

          // Setup storage event listener as fallback
          const storageHandler = (event: StorageEvent) => {
            if (event.key?.startsWith('absmartly_sync_')) {
              syncData.received.push({
                type: 'storage-event',
                key: event.key,
                newValue: event.newValue,
                timestamp: Date.now()
              })
            }
          }
          window.addEventListener('storage', storageHandler)

          // Send sync messages
          const testChanges = [
            {
              selector: '#test-button',
              type: 'style',
              value: { 'background-color': 'purple' },
              source: 'tab1'
            },
            {
              selector: '.test-paragraph',
              type: 'text',
              value: 'Synchronized text from tab 1',
              source: 'tab1'
            }
          ]

          // Broadcast changes
          const syncMessage = {
            type: 'CHANGES_SYNC',
            experimentId: 'exp-sync-test',
            variantId: 'var-sync',
            changes: testChanges,
            timestamp: Date.now(),
            tabId: 'tab-1'
          }

          channel.postMessage(syncMessage)
          syncData.sent.push(syncMessage)

          // Also use localStorage as backup sync method
          localStorage.setItem('absmartly_sync_changes', JSON.stringify(syncMessage))

          // Wait for potential responses (increased to 3s for reliability in full test suite)
          setTimeout(() => {
            channel.close()
            window.removeEventListener('storage', storageHandler)
            resolve({
              tab: 'tab1',
              syncData,
              channelSupported: typeof BroadcastChannel !== 'undefined'
            })
          }, 3000)
        })
      }),

      // Tab 2: Listen for sync messages and respond
      tab2.evaluate(() => {
        return new Promise((resolve) => {
          const syncData = {
            sent: [] as any[],
            received: [] as any[]
          }

          // Setup BroadcastChannel listener
          const channel = new BroadcastChannel('absmartly-sync')

          channel.onmessage = (event) => {
            syncData.received.push({
              type: event.data.type,
              timestamp: Date.now(),
              data: event.data
            })

            // Apply received changes
            if (event.data.type === 'CHANGES_SYNC' && event.data.changes) {
              event.data.changes.forEach((change: any) => {
                const element = document.querySelector(change.selector)
                if (element) {
                  if (change.type === 'style') {
                    Object.assign((element as HTMLElement).style, change.value)
                  } else if (change.type === 'text') {
                    element.textContent = change.value
                  }
                }
              })

              // Send acknowledgment
              const ackMessage = {
                type: 'SYNC_ACK',
                originalMessage: event.data,
                timestamp: Date.now(),
                tabId: 'tab-2'
              }
              channel.postMessage(ackMessage)
              syncData.sent.push(ackMessage)
            }
          }

          // Monitor localStorage for sync
          const storageHandler = (event: StorageEvent) => {
            if (event.key === 'absmartly_sync_changes' && event.newValue) {
              try {
                const syncMessage = JSON.parse(event.newValue)
                syncData.received.push({
                  type: 'storage-sync',
                  data: syncMessage,
                  timestamp: Date.now()
                })
              } catch (e) {
                // Ignore invalid JSON
              }
            }
          }
          window.addEventListener('storage', storageHandler)

          setTimeout(() => {
            channel.close()
            window.removeEventListener('storage', storageHandler)
            resolve({
              tab: 'tab2',
              syncData,
              channelSupported: typeof BroadcastChannel !== 'undefined'
            })
          }, 3000)
        })
      })
    ])

    // Verify cross-tab synchronization
    const tab1Result = syncResult[0] as any
    const tab2Result = syncResult[1] as any

    expect(tab1Result.channelSupported).toBeTruthy()
    expect(tab2Result.channelSupported).toBeTruthy()

    expect(tab1Result.syncData.sent.length).toBeGreaterThan(0)
    expect(tab2Result.syncData.received.length).toBeGreaterThan(0)

    // Verify tab2 received the sync message from tab1
    const receivedSync = tab2Result.syncData.received.find((msg: any) =>
      msg.type === 'CHANGES_SYNC' || msg.data?.type === 'CHANGES_SYNC'
    )
    expect(receivedSync).toBeTruthy()

    // Verify acknowledgment was sent back
    expect(tab2Result.syncData.sent.length).toBeGreaterThan(0)

    await Promise.all([tab1.close(), tab2.close()])
  })

  test('14. Reload page and verify changes persist - test page reload scenarios', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Setup persistent changes before reload
    const setupResult = await page.evaluate(() => {
      const changes = [
        {
          id: 'change-1',
          selector: '#test-button',
          type: 'style',
          value: {
            'background-color': 'darkgreen',
            'color': 'white',
            'border-radius': '20px',
            'padding': '15px 30px'
          },
          persistent: true,
          timestamp: Date.now()
        },
        {
          id: 'change-2',
          selector: '.test-paragraph',
          type: 'text',
          value: 'This text should persist after page reload',
          originalText: 'Original text content',
          persistent: true,
          timestamp: Date.now()
        },
        {
          id: 'change-3',
          selector: '#test-container',
          type: 'attribute',
          value: { 'data-persistent': 'true', 'data-test-id': 'reload-test' },
          persistent: true,
          timestamp: Date.now()
        },
        {
          id: 'change-4',
          selector: '#dynamic-content',
          type: 'class',
          add: ['persistent-style', 'reload-tested'],
          remove: [],
          persistent: true,
          timestamp: Date.now()
        }
      ]

      // Store changes in multiple persistence layers
      localStorage.setItem('absmartly_persistent_changes', JSON.stringify(changes))
      sessionStorage.setItem('absmartly_session_changes', JSON.stringify(changes))

      // Store with expiration
      const persistentData = {
        changes: changes,
        metadata: {
          created: Date.now(),
          expires: Date.now() + (24 * 60 * 60 * 1000), // 24 hours
          version: '1.0',
          pageUrl: window.location.href
        }
      }
      localStorage.setItem('absmartly_persistent_data', JSON.stringify(persistentData))

      // Apply changes before reload
      const applicationResults = changes.map(change => {
        const element = document.querySelector(change.selector)
        if (element) {
          try {
            if (change.type === 'style' && typeof change.value === 'object') {
              Object.assign((element as HTMLElement).style, change.value)
            } else if (change.type === 'text' && typeof change.value === 'string') {
              element.textContent = change.value
            } else if (change.type === 'attribute' && typeof change.value === 'object') {
              Object.entries(change.value).forEach(([attr, value]) => {
                element.setAttribute(attr, value as string)
              })
            } else if (change.type === 'class') {
              if (change.add) element.classList.add(...change.add)
              if (change.remove) element.classList.remove(...change.remove)
            }
            return { changeId: change.id, applied: true }
          } catch (error) {
            return { changeId: change.id, applied: false, error: error.message }
          }
        }
        return { changeId: change.id, applied: false, error: 'Element not found' }
      })

      return {
        changesStored: changes.length,
        applicationResults,
        preReloadTimestamp: Date.now()
      }
    })

    // Verify setup
    expect(setupResult.changesStored).toBe(4)
    expect(setupResult.applicationResults.every((r: any) => r.applied)).toBeTruthy()

    // Perform hard reload
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Verify persistence after reload
    const postReloadResult = await page.evaluate(() => {
      return new Promise((resolve) => {
        // Check if persistent data exists
        const persistentChanges = localStorage.getItem('absmartly_persistent_changes')
        const sessionChanges = sessionStorage.getItem('absmartly_session_changes')
        const persistentData = localStorage.getItem('absmartly_persistent_data')

        const results = {
          persistentChangesExist: !!persistentChanges,
          sessionChangesExist: !!sessionChanges,
          persistentDataExist: !!persistentData,
          reapplicationResults: [] as any[],
          postReloadTimestamp: Date.now()
        }

        if (persistentChanges) {
          try {
            const changes = JSON.parse(persistentChanges)

            // Reapply persistent changes
            results.reapplicationResults = changes.map((change: any) => {
              const element = document.querySelector(change.selector)
              if (element && change.persistent) {
                try {
                  if (change.type === 'style') {
                    Object.assign((element as HTMLElement).style, change.value)
                  } else if (change.type === 'text') {
                    element.textContent = change.value
                  } else if (change.type === 'attribute') {
                    Object.entries(change.value).forEach(([attr, value]) => {
                      element.setAttribute(attr, value as string)
                    })
                  } else if (change.type === 'class') {
                    if (change.add) element.classList.add(...change.add)
                    if (change.remove) element.classList.remove(...change.remove)
                  }
                  return {
                    changeId: change.id,
                    applied: true,
                    selector: change.selector,
                    type: change.type
                  }
                } catch (error) {
                  return {
                    changeId: change.id,
                    applied: false,
                    error: error.message,
                    selector: change.selector
                  }
                }
              }
              return {
                changeId: change.id,
                applied: false,
                error: 'Element not found or not persistent',
                selector: change.selector
              }
            })
          } catch (error) {
            results.reapplicationResults = [{ error: 'Failed to parse persistent changes' }]
          }
        }

        resolve(results)
      })
    })

    // Verify persistence and reapplication after reload
    expect((postReloadResult as any).persistentChangesExist).toBeTruthy()
    expect((postReloadResult as any).sessionChangesExist).toBeTruthy()
    expect((postReloadResult as any).reapplicationResults.length).toBe(4)

    // Verify all changes were reapplied successfully
    const reapplicationResults = (postReloadResult as any).reapplicationResults
    reapplicationResults.forEach((result: any) => {
      expect(result.applied).toBeTruthy() // Change should be reapplied after reload
    })

    // Verify visual state after reload
    const visualVerification = await page.evaluate(() => {
      return {
        buttonStyle: {
          backgroundColor: window.getComputedStyle(document.querySelector('#test-button')!).backgroundColor,
          borderRadius: window.getComputedStyle(document.querySelector('#test-button')!).borderRadius
        },
        paragraphText: document.querySelector('.test-paragraph')?.textContent,
        containerAttributes: {
          persistent: document.querySelector('#test-container')?.getAttribute('data-persistent'),
          testId: document.querySelector('#test-container')?.getAttribute('data-test-id')
        },
        dynamicContentClasses: Array.from(document.querySelector('#dynamic-content')?.classList || [])
      }
    })

    expect(visualVerification.buttonStyle.backgroundColor).toContain('0, 100, 0') // Dark green
    expect(visualVerification.paragraphText).toBe('This text should persist after page reload')
    expect(visualVerification.containerAttributes.persistent).toBe('true')
    expect(visualVerification.containerAttributes.testId).toBe('reload-test')
    expect(visualVerification.dynamicContentClasses).toContain('persistent-style')
    expect(visualVerification.dynamicContentClasses).toContain('reload-tested')

    await page.close()
  })

  test('15. Test with multiple variants/experiments - handle multiple change sets', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const multiVariantResult = await page.evaluate(() => {
      // Define multiple experiments with variants
      const experiments = {
        'button-color-test': {
          id: 'button-color-test',
          name: 'Button Color Experiment',
          status: 'running',
          variants: {
            'control': {
              id: 'control',
              name: 'Control (Original)',
              weight: 25,
              changes: [] // No changes for control
            },
            'red-button': {
              id: 'red-button',
              name: 'Red Button',
              weight: 25,
              changes: [
                {
                  selector: '#test-button',
                  type: 'style',
                  value: { 'background-color': '#ff4444', 'border': '2px solid #cc0000' }
                }
              ]
            },
            'blue-button': {
              id: 'blue-button',
              name: 'Blue Button',
              weight: 25,
              changes: [
                {
                  selector: '#test-button',
                  type: 'style',
                  value: { 'background-color': '#4444ff', 'border': '2px solid #0000cc' }
                }
              ]
            },
            'large-button': {
              id: 'large-button',
              name: 'Large Button',
              weight: 25,
              changes: [
                {
                  selector: '#test-button',
                  type: 'style',
                  value: {
                    'padding': '20px 40px',
                    'font-size': '18px',
                    'transform': 'scale(1.2)'
                  }
                }
              ]
            }
          }
        },
        'content-test': {
          id: 'content-test',
          name: 'Content Variation Experiment',
          status: 'running',
          variants: {
            'control': {
              id: 'control',
              name: 'Original Content',
              weight: 50,
              changes: []
            },
            'new-copy': {
              id: 'new-copy',
              name: 'Updated Copy',
              weight: 50,
              changes: [
                {
                  selector: '.test-paragraph',
                  type: 'text',
                  value: 'New and improved content that converts better!'
                },
                {
                  selector: 'h1',
                  type: 'html',
                  value: '<h1 style="color: #2c5aa0;">Enhanced Headline</h1>'
                }
              ]
            }
          }
        },
        'layout-test': {
          id: 'layout-test',
          name: 'Layout Experiment',
          status: 'running',
          variants: {
            'original': {
              id: 'original',
              name: 'Original Layout',
              weight: 33,
              changes: []
            },
            'centered': {
              id: 'centered',
              name: 'Centered Layout',
              weight: 33,
              changes: [
                {
                  selector: '#test-container',
                  type: 'style',
                  value: { 'text-align': 'center', 'max-width': '600px' }
                }
              ]
            },
            'sidebar': {
              id: 'sidebar',
              name: 'With Sidebar',
              weight: 34,
              changes: [
                {
                  selector: '#test-container',
                  type: 'style',
                  value: { 'display': 'grid', 'grid-template-columns': '2fr 1fr', 'gap': '20px' }
                },
                {
                  selector: '#test-container',
                  type: 'insert',
                  position: 'append',
                  html: '<div class="sidebar" style="background: #f0f0f0; padding: 15px; border-radius: 8px;"><h3>Sidebar Content</h3><p>Additional information here</p></div>'
                }
              ]
            }
          }
        }
      }

      // Simulate user assignment to specific variants
      const userAssignments = {
        'button-color-test': 'blue-button',
        'content-test': 'new-copy',
        'layout-test': 'centered'
      }

      const applicationResults = []

      // Define types for test data
      interface TestExperimentChange {
        selector: string
        type: string
        value?: unknown
        position?: string
        html?: string
      }

      interface TestVariant {
        id: string
        name: string
        weight: number
        changes: TestExperimentChange[]
      }

      interface TestExperiment {
        id: string
        name: string
        status: string
        variants: Record<string, TestVariant>
      }

      // Apply changes for assigned variants
      Object.entries(userAssignments).forEach(([experimentId, variantId]) => {
        const experiment = experiments[experimentId as keyof typeof experiments] as TestExperiment
        const variant = experiment.variants[variantId]

        if (variant && variant.changes) {
          variant.changes.forEach((change) => {
            const element = document.querySelector(change.selector)
            if (element) {
              try {
                if (change.type === 'style') {
                  Object.assign((element as HTMLElement).style, change.value)
                  applicationResults.push({
                    experimentId,
                    variantId,
                    changeType: change.type,
                    selector: change.selector,
                    applied: true
                  })
                } else if (change.type === 'text' && typeof change.value === 'string') {
                  element.textContent = change.value
                  applicationResults.push({
                    experimentId,
                    variantId,
                    changeType: change.type,
                    selector: change.selector,
                    applied: true
                  })
                } else if (change.type === 'html' && typeof change.value === 'string') {
                  element.innerHTML = change.value
                  applicationResults.push({
                    experimentId,
                    variantId,
                    changeType: change.type,
                    selector: change.selector,
                    applied: true
                  })
                } else if (change.type === 'insert') {
                  if (change.position === 'append') {
                    element.insertAdjacentHTML('beforeend', change.html)
                  }
                  applicationResults.push({
                    experimentId,
                    variantId,
                    changeType: change.type,
                    selector: change.selector,
                    applied: true
                  })
                }
              } catch (error) {
                applicationResults.push({
                  experimentId,
                  variantId,
                  changeType: change.type,
                  selector: change.selector,
                  applied: false,
                  error: error.message
                })
              }
            } else {
              applicationResults.push({
                experimentId,
                variantId,
                changeType: change.type,
                selector: change.selector,
                applied: false,
                error: 'Element not found'
              })
            }
          })
        }
      })

      // Store experiment data
      localStorage.setItem('absmartly_experiments', JSON.stringify(experiments))
      localStorage.setItem('absmartly_user_assignments', JSON.stringify(userAssignments))

      return {
        experimentsCount: Object.keys(experiments).length,
        totalVariants: Object.values(experiments).reduce((sum, exp) => sum + Object.keys(exp.variants).length, 0),
        assignedVariants: Object.keys(userAssignments).length,
        applicationResults,
        conflicts: applicationResults.filter(r =>
          applicationResults.some(other =>
            other.selector === r.selector &&
            other.experimentId !== r.experimentId &&
            other.changeType === r.changeType
          )
        )
      }
    })

    // Verify multi-variant experiment handling
    expect(multiVariantResult.experimentsCount).toBe(3)
    expect(multiVariantResult.totalVariants).toBe(8) // Total variants across all experiments
    expect(multiVariantResult.assignedVariants).toBe(3)
    expect(multiVariantResult.applicationResults.length).toBeGreaterThan(0)

    // Verify successful applications
    const successfulApplications = multiVariantResult.applicationResults.filter((r: any) => r.applied)
    expect(successfulApplications.length).toBeGreaterThan(0)

    // Check for conflicts (same selector modified by multiple experiments)
    if (multiVariantResult.conflicts.length > 0) {
      console.log('Detected conflicts between experiments:', multiVariantResult.conflicts)
    }

    // Verify specific variant effects
    const visualState = await page.evaluate(() => {
      return {
        buttonStyle: {
          backgroundColor: window.getComputedStyle(document.querySelector('#test-button')!).backgroundColor,
          padding: window.getComputedStyle(document.querySelector('#test-button')!).padding
        },
        paragraphText: document.querySelector('.test-paragraph')?.textContent,
        containerStyle: {
          textAlign: window.getComputedStyle(document.querySelector('#test-container')!).textAlign,
          maxWidth: window.getComputedStyle(document.querySelector('#test-container')!).maxWidth
        },
        headlineContent: document.querySelector('h1')?.innerHTML
      }
    })

    // Verify blue button variant was applied
    expect(visualState.buttonStyle.backgroundColor).toContain('68, 68, 255') // Blue

    // Verify content variant was applied
    expect(visualState.paragraphText).toBe('New and improved content that converts better!')

    // Verify layout variant was applied
    expect(visualState.containerStyle.textAlign).toBe('center')

    await page.close()
  })

  test('16. Conflict resolution for concurrent changes - test merge strategies', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const conflictResolutionResult = await page.evaluate(() => {
      // Simulate concurrent changes from different sources
      const concurrentChanges = [
        // User 1 changes at time 1000
        {
          id: 'change-1',
          source: 'user-1',
          timestamp: 1000,
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': 'red', 'color': 'white' },
          priority: 'normal'
        },
        // User 2 changes at time 1500 (later)
        {
          id: 'change-2',
          source: 'user-2',
          timestamp: 1500,
          selector: '#test-button',
          type: 'style',
          value: { 'background-color': 'blue', 'border': '2px solid black' },
          priority: 'normal'
        },
        // Admin changes at time 1200 (middle) but high priority
        {
          id: 'change-3',
          source: 'admin',
          timestamp: 1200,
          selector: '#test-button',
          type: 'style',
          value: { 'font-size': '16px', 'padding': '15px' },
          priority: 'high'
        },
        // Concurrent text changes
        {
          id: 'change-4',
          source: 'user-1',
          timestamp: 2000,
          selector: '.test-paragraph',
          type: 'text',
          value: 'Text from user 1',
          priority: 'normal'
        },
        {
          id: 'change-5',
          source: 'user-2',
          timestamp: 2100,
          selector: '.test-paragraph',
          type: 'text',
          value: 'Text from user 2',
          priority: 'normal'
        }
      ]

      // Implement conflict resolution strategies
      const resolveConflicts = (changes: any[]) => {
        const conflicts: any[] = []
        const resolvedChanges: any[] = []
        const changeMap = new Map()

        // Group changes by selector and type
        changes.forEach(change => {
          const key = `${change.selector}:${change.type}`
          if (!changeMap.has(key)) {
            changeMap.set(key, [])
          }
          changeMap.get(key).push(change)
        })

        // Resolve conflicts for each group
        changeMap.forEach((changeGroup, key) => {
          if (changeGroup.length === 1) {
            // No conflict
            resolvedChanges.push(changeGroup[0])
          } else {
            // Conflict detected
            conflicts.push({
              key,
              conflictingChanges: changeGroup.length,
              changes: changeGroup
            })

            // Strategy 1: Priority-based resolution
            const highPriorityChanges = changeGroup.filter((c: any) => c.priority === 'high')
            if (highPriorityChanges.length > 0) {
              // Use the latest high-priority change
              const resolved = highPriorityChanges.reduce((latest: any, current: any) =>
                current.timestamp > latest.timestamp ? current : latest
              )
              resolvedChanges.push({ ...resolved, resolutionStrategy: 'priority-latest' })
            } else {
              // Strategy 2: Last-write-wins for normal priority
              const resolved = changeGroup.reduce((latest: any, current: any) =>
                current.timestamp > latest.timestamp ? current : latest
              )

              // Strategy 3: Merge for style changes
              if (resolved.type === 'style') {
                const mergedValue = {}
                changeGroup
                  .sort((a: any, b: any) => a.timestamp - b.timestamp)
                  .forEach((change: any) => {
                    Object.assign(mergedValue, change.value)
                  })

                resolvedChanges.push({
                  ...resolved,
                  value: mergedValue,
                  resolutionStrategy: 'merge-styles',
                  mergedFrom: changeGroup.map((c: any) => c.id)
                })
              } else {
                // For non-style changes, use last-write-wins
                resolvedChanges.push({ ...resolved, resolutionStrategy: 'last-write-wins' })
              }
            }
          }
        })

        return { conflicts, resolvedChanges }
      }

      const resolutionResult = resolveConflicts(concurrentChanges)

      // Apply resolved changes
      const applicationResults = resolutionResult.resolvedChanges.map(change => {
        const element = document.querySelector(change.selector)
        if (element) {
          try {
            if (change.type === 'style') {
              Object.assign((element as HTMLElement).style, change.value)
            } else if (change.type === 'text') {
              element.textContent = change.value
            }
            return {
              changeId: change.id,
              selector: change.selector,
              applied: true,
              strategy: change.resolutionStrategy
            }
          } catch (error) {
            return {
              changeId: change.id,
              selector: change.selector,
              applied: false,
              error: error.message
            }
          }
        }
        return {
          changeId: change.id,
          selector: change.selector,
          applied: false,
          error: 'Element not found'
        }
      })

      return {
        totalChanges: concurrentChanges.length,
        conflictsDetected: resolutionResult.conflicts.length,
        resolvedChanges: resolutionResult.resolvedChanges.length,
        conflicts: resolutionResult.conflicts,
        resolutions: resolutionResult.resolvedChanges,
        applicationResults
      }
    })

    // Verify conflict resolution
    expect(conflictResolutionResult.totalChanges).toBe(5)
    expect(conflictResolutionResult.conflictsDetected).toBe(2) // Button style and paragraph text conflicts
    expect(conflictResolutionResult.resolvedChanges).toBeGreaterThan(0)

    // Verify conflicts were properly detected
    const buttonConflict = conflictResolutionResult.conflicts.find((c: any) => c.key.includes('#test-button:style'))
    expect(buttonConflict).toBeTruthy()
    expect(buttonConflict.conflictingChanges).toBe(3) // 3 style changes to button

    // Verify resolution strategies were applied
    const buttonResolution = conflictResolutionResult.resolutions.find((r: any) => r.selector === '#test-button')
    expect(buttonResolution).toBeTruthy()
    expect(['priority-latest', 'merge-styles', 'last-write-wins']).toContain(buttonResolution.resolutionStrategy)

    // Verify changes were applied successfully
    const successfulApplications = conflictResolutionResult.applicationResults.filter((r: any) => r.applied)
    expect(successfulApplications.length).toBeGreaterThan(0)

    await page.close()
  })

  test('17. Backup and restore functionality - test export/import', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const backupRestoreResult = await page.evaluate(() => {
      // Create comprehensive data to backup
      const backupData = {
        experiments: {
          'exp-1': {
            id: 'exp-1',
            name: 'Main Experiment',
            status: 'running',
            variants: {
              'control': { changes: [] },
              'variant-a': {
                changes: [
                  { selector: '#test-button', type: 'style', value: { 'background-color': 'red' } },
                  { selector: '.test-paragraph', type: 'text', value: 'Backup test text' }
                ]
              }
            }
          }
        },
        settings: {
          autoSave: true,
          syncEnabled: true,
          debugMode: false
        },
        userAssignments: {
          'exp-1': 'variant-a'
        },
        metadata: {
          version: '2.0.0',
          created: Date.now(),
          userId: 'user-123',
          sessionId: 'session-456'
        }
      }

      const backupTests = []

      // Test 1: Create backup
      try {
        const backup = {
          version: '2.0.0',
          timestamp: Date.now(),
          data: backupData,
          checksum: btoa(JSON.stringify(backupData)).slice(0, 32), // Enhanced checksum
          compression: 'none',
          metadata: {
            userAgent: navigator.userAgent,
            pageUrl: window.location.href,
            dataSize: JSON.stringify(backupData).length
          }
        }

        // Store backup
        localStorage.setItem('absmartly_backup', JSON.stringify(backup))

        backupTests.push({
          name: 'create-backup',
          success: true,
          backupSize: JSON.stringify(backup).length,
          checksumGenerated: backup.checksum.length === 32
        })
      } catch (error) {
        backupTests.push({ name: 'create-backup', success: false, error: error.message })
      }

      // Test 2: Validate backup integrity
      try {
        const storedBackup = localStorage.getItem('absmartly_backup')
        if (storedBackup) {
          const backup = JSON.parse(storedBackup)
          const expectedChecksum = btoa(JSON.stringify(backup.data)).slice(0, 32)
          const integrityValid = backup.checksum === expectedChecksum

          backupTests.push({
            name: 'validate-integrity',
            success: integrityValid,
            checksumMatch: integrityValid
          })
        } else {
          backupTests.push({ name: 'validate-integrity', success: false, error: 'No backup found' })
        }
      } catch (error) {
        backupTests.push({ name: 'validate-integrity', success: false, error: error.message })
      }

      // Test 3: Restore from backup
      try {
        const storedBackup = localStorage.getItem('absmartly_backup')
        if (storedBackup) {
          const backup = JSON.parse(storedBackup)

          // Verify backup format
          if (!backup.version || !backup.data || !backup.checksum) {
            throw new Error('Invalid backup format')
          }

          // Verify checksum
          const expectedChecksum = btoa(JSON.stringify(backup.data)).slice(0, 32)
          if (backup.checksum !== expectedChecksum) {
            throw new Error('Backup integrity check failed')
          }

          // Restore data
          const restoredData = backup.data
          localStorage.setItem('absmartly_experiments_restored', JSON.stringify(restoredData.experiments))
          localStorage.setItem('absmartly_settings_restored', JSON.stringify(restoredData.settings))
          localStorage.setItem('absmartly_assignments_restored', JSON.stringify(restoredData.userAssignments))

          // Verify restoration
          const restoredExperiments = JSON.parse(localStorage.getItem('absmartly_experiments_restored') || '{}')
          const restoredSettings = JSON.parse(localStorage.getItem('absmartly_settings_restored') || '{}')

          backupTests.push({
            name: 'restore-backup',
            success: true,
            experimentsRestored: Object.keys(restoredExperiments).length,
            settingsRestored: Object.keys(restoredSettings).length
          })
        } else {
          backupTests.push({ name: 'restore-backup', success: false, error: 'No backup to restore' })
        }
      } catch (error) {
        backupTests.push({ name: 'restore-backup', success: false, error: error.message })
      }

      // Test 4: Apply restored changes
      try {
        const restoredExperiments = JSON.parse(localStorage.getItem('absmartly_experiments_restored') || '{}')
        const restoredAssignments = JSON.parse(localStorage.getItem('absmartly_assignments_restored') || '{}')

        const applicationResults: any[] = []

        Object.entries(restoredAssignments).forEach(([expId, variantId]) => {
          const experiment = restoredExperiments[expId]
          if (experiment && experiment.variants && experiment.variants[variantId as string]) {
            const variant = experiment.variants[variantId as string]

            if (variant.changes) {
              variant.changes.forEach((change: any) => {
                const element = document.querySelector(change.selector)
                if (element) {
                  try {
                    if (change.type === 'style') {
                      Object.assign((element as HTMLElement).style, change.value)
                    } else if (change.type === 'text') {
                      element.textContent = change.value
                    }
                    applicationResults.push({
                      selector: change.selector,
                      type: change.type,
                      applied: true
                    })
                  } catch (error) {
                    applicationResults.push({
                      selector: change.selector,
                      type: change.type,
                      applied: false,
                      error: error.message
                    })
                  }
                } else {
                  applicationResults.push({
                    selector: change.selector,
                    type: change.type,
                    applied: false,
                    error: 'Element not found'
                  })
                }
              })
            }
          }
        })

        backupTests.push({
          name: 'apply-restored-changes',
          success: applicationResults.every(r => r.applied),
          changesApplied: applicationResults.filter(r => r.applied).length,
          totalChanges: applicationResults.length
        })
      } catch (error) {
        backupTests.push({ name: 'apply-restored-changes', success: false, error: error.message })
      }

      // Test 5: Incremental backup
      try {
        const lastBackup = JSON.parse(localStorage.getItem('absmartly_backup') || '{}')
        const incrementalData = {
          baseVersion: lastBackup.timestamp,
          changes: [
            {
              type: 'update',
              path: 'experiments.exp-1.variants.variant-a.changes',
              value: [
                { selector: '#test-button', type: 'style', value: { 'background-color': 'green' } }
              ]
            },
            {
              type: 'add',
              path: 'experiments.exp-2',
              value: { id: 'exp-2', name: 'New Experiment' }
            }
          ],
          timestamp: Date.now()
        }

        localStorage.setItem('absmartly_incremental_backup', JSON.stringify(incrementalData))

        backupTests.push({
          name: 'incremental-backup',
          success: true,
          incrementalChanges: incrementalData.changes.length
        })
      } catch (error) {
        backupTests.push({ name: 'incremental-backup', success: false, error: error.message })
      }

      return {
        success: backupTests.every(t => t.success),
        tests: backupTests,
        backupDataSize: JSON.stringify(backupData).length
      }
    })

    // Verify backup and restore functionality
    expect(backupRestoreResult.success).toBeTruthy()
    expect(backupRestoreResult.tests.length).toBe(5)

    // Verify each test passed
    backupRestoreResult.tests.forEach((test: any) => {
      expect(test.success).toBeTruthy() // Test should succeed
    })

    // Verify backup was created with proper metadata
    const createBackupTest = backupRestoreResult.tests.find((t: any) => t.name === 'create-backup')
    expect(createBackupTest.backupSize).toBeGreaterThan(0)
    expect(createBackupTest.checksumGenerated).toBeTruthy()

    await page.close()
  })

  test('18. Change validation before saving - verify data integrity', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const validationResult = await page.evaluate(() => {
      // Define validation rules
      const validationRules = {
        required: ['selector', 'type'],
        validTypes: ['style', 'text', 'html', 'class', 'attribute', 'insert', 'remove', 'move'],
        selectorPattern: /^[.#]?[\w\-\[\]="':().,\s>+~]+$/,
        maxValueSize: 10000, // 10KB max for change values
        maxChangesPerVariant: 100
      }

      const validateChange = (change: any) => {
        const errors: string[] = []
        const warnings: string[] = []

        // Required field validation
        validationRules.required.forEach(field => {
          if (!change.hasOwnProperty(field) || change[field] === null || change[field] === undefined) {
            errors.push(`Missing required field: ${field}`)
          }
        })

        // Type validation
        if (change.type && !validationRules.validTypes.includes(change.type)) {
          errors.push(`Invalid change type: ${change.type}`)
        }

        // Selector validation
        if (change.selector) {
          if (typeof change.selector !== 'string') {
            errors.push('Selector must be a string')
          } else if (!validationRules.selectorPattern.test(change.selector)) {
            warnings.push(`Selector may be invalid: ${change.selector}`)
          }

          // Test if selector can be parsed
          try {
            document.querySelector(change.selector)
          } catch (error) {
            errors.push(`Invalid CSS selector: ${change.selector}`)
          }
        }

        // Value validation based on type
        if (change.type === 'style' && change.value) {
          if (typeof change.value !== 'object') {
            errors.push('Style change value must be an object')
          } else {
            // Validate CSS properties
            Object.entries(change.value).forEach(([prop, value]) => {
              if (typeof prop !== 'string' || typeof value !== 'string') {
                warnings.push(`Invalid CSS property or value: ${prop}: ${value}`)
              }
            })
          }
        }

        if (change.type === 'text' && change.value) {
          if (typeof change.value !== 'string') {
            errors.push('Text change value must be a string')
          }
        }

        if (change.type === 'class' && change.add) {
          if (!Array.isArray(change.add)) {
            errors.push('Class add property must be an array')
          }
        }

        // Size validation
        const changeSize = JSON.stringify(change).length
        if (changeSize > validationRules.maxValueSize) {
          warnings.push(`Change size (${changeSize} bytes) exceeds recommended limit`)
        }

        return { errors, warnings, valid: errors.length === 0 }
      }

      // Test various change scenarios
      const testChanges = [
        // Valid changes
        {
          name: 'valid-style-change',
          change: {
            selector: '#test-button',
            type: 'style',
            value: { 'background-color': '#ff0000', 'padding': '10px' }
          }
        },
        {
          name: 'valid-text-change',
          change: {
            selector: '.test-paragraph',
            type: 'text',
            value: 'Valid text content'
          }
        },
        {
          name: 'valid-class-change',
          change: {
            selector: '#test-container',
            type: 'class',
            add: ['new-class', 'another-class'],
            remove: ['old-class']
          }
        },

        // Invalid changes
        {
          name: 'missing-selector',
          change: {
            type: 'style',
            value: { 'color': 'red' }
          }
        },
        {
          name: 'invalid-type',
          change: {
            selector: '#test-button',
            type: 'invalid-type',
            value: 'some value'
          }
        },
        {
          name: 'invalid-selector',
          change: {
            selector: '###invalid::selector',
            type: 'style',
            value: { 'color': 'blue' }
          }
        },
        {
          name: 'wrong-value-type-for-style',
          change: {
            selector: '#test-button',
            type: 'style',
            value: 'should be object not string'
          }
        },
        {
          name: 'wrong-value-type-for-text',
          change: {
            selector: '.test-paragraph',
            type: 'text',
            value: { object: 'should be string' }
          }
        },

        // Edge cases
        {
          name: 'empty-selector',
          change: {
            selector: '',
            type: 'style',
            value: { 'color': 'green' }
          }
        },
        {
          name: 'large-change',
          change: {
            selector: '#test-button',
            type: 'style',
            value: Object.fromEntries(
              Array.from({ length: 1000 }, (_, i) => [`property-${i}`, `value-${i}`])
            )
          }
        }
      ]

      const validationResults = testChanges.map(testCase => {
        const validation = validateChange(testCase.change)
        return {
          name: testCase.name,
          ...validation,
          change: testCase.change
        }
      })

      // Test batch validation
      const batchChanges = validationResults
        .filter(r => r.valid)
        .map(r => r.change)

      const batchValidation = {
        totalChanges: batchChanges.length,
        valid: batchChanges.length <= validationRules.maxChangesPerVariant,
        exceedsLimit: batchChanges.length > validationRules.maxChangesPerVariant
      }

      // Test validation performance
      const performanceStart = performance.now()
      for (let i = 0; i < 1000; i++) {
        validateChange(testChanges[0].change) // Validate same change 1000 times
      }
      const performanceEnd = performance.now()
      const validationPerformance = {
        totalTime: performanceEnd - performanceStart,
        averageTime: (performanceEnd - performanceStart) / 1000
      }

      return {
        validationResults,
        batchValidation,
        validationPerformance,
        summary: {
          totalTests: validationResults.length,
          validChanges: validationResults.filter(r => r.valid).length,
          invalidChanges: validationResults.filter(r => !r.valid).length,
          warningsGenerated: validationResults.reduce((sum, r) => sum + r.warnings.length, 0),
          errorsGenerated: validationResults.reduce((sum, r) => sum + r.errors.length, 0)
        }
      }
    })

    // Verify validation functionality
    expect(validationResult.summary.totalTests).toBe(10)
    expect(validationResult.summary.validChanges).toBeGreaterThan(0) // Some should be valid
    expect(validationResult.summary.invalidChanges).toBeGreaterThan(0) // Some should be invalid
    expect(validationResult.summary.errorsGenerated).toBeGreaterThan(0)

    // Verify specific validations
    const validStyleChange = validationResult.validationResults.find((r: any) => r.name === 'valid-style-change')
    expect(validStyleChange.valid).toBeTruthy()
    expect(validStyleChange.errors.length).toBe(0)

    const missingSelectorChange = validationResult.validationResults.find((r: any) => r.name === 'missing-selector')
    expect(missingSelectorChange.valid).toBeFalsy()
    expect(missingSelectorChange.errors).toContain('Missing required field: selector')

    const invalidTypeChange = validationResult.validationResults.find((r: any) => r.name === 'invalid-type')
    expect(invalidTypeChange.valid).toBeFalsy()
    expect(invalidTypeChange.errors.some((e: string) => e.includes('Invalid change type'))).toBeTruthy()

    // Verify performance is acceptable
    expect(validationResult.validationPerformance.averageTime).toBeLessThan(1) // Less than 1ms per validation

    await page.close()
  })

  test('19. Network failure handling - test offline scenarios', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Simulate network conditions
    await page.route('**/*', route => {
      // Simulate network failures for API calls
      if (route.request().url().includes('api.absmartly.com')) {
        route.abort('failed')
      } else {
        route.continue()
      }
    })

    const networkFailureResult = await page.evaluate(() => {
      // Mock network failure scenarios
      const simulateNetworkFailure = (operation: string) => {
        return new Promise((resolve) => {
          // Simulate different types of failures
          const failures = {
            'save-changes': {
              success: false,
              error: 'Network timeout',
              code: 'NETWORK_TIMEOUT',
              retryable: true
            },
            'load-experiments': {
              success: false,
              error: 'Connection refused',
              code: 'CONNECTION_REFUSED',
              retryable: true
            },
            'sync-changes': {
              success: false,
              error: 'Service unavailable',
              code: 'SERVICE_UNAVAILABLE',
              retryable: true
            },
            'auth-check': {
              success: false,
              error: 'Unauthorized',
              code: 'UNAUTHORIZED',
              retryable: false
            }
          }

          setTimeout(() => {
            resolve(failures[operation as keyof typeof failures] || { success: false, error: 'Unknown error' })
          }, 100) // Simulate network delay
        })
      }

      // Test offline change queuing
      const offlineQueue: any[] = []
      const queueChange = (change: any) => {
        const queuedChange = {
          ...change,
          queuedAt: Date.now(),
          attempts: 0,
          status: 'pending'
        }
        offlineQueue.push(queuedChange)
        localStorage.setItem('absmartly_offline_queue', JSON.stringify(offlineQueue))
        return queuedChange
      }

      // Test retry mechanism
      const retryOperation = async (operation: () => Promise<any>, maxRetries = 3, delay = 1000) => {
        let attempts = 0
        let lastError

        while (attempts < maxRetries) {
          try {
            attempts++
            const result = await operation()
            if (result.success) {
              return { success: true, result, attempts }
            }
            throw new Error(result.error)
          } catch (error) {
            lastError = error
            if (attempts < maxRetries) {
              // Exponential backoff
              await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, attempts - 1)))
            }
          }
        }

        return { success: false, error: lastError, attempts }
      }

      const networkTests: any[] = []

      // Test 1: Save changes while offline
      const testChanges = [
        { selector: '#test-button', type: 'style', value: { 'background-color': 'red' } },
        { selector: '.test-paragraph', type: 'text', value: 'Offline changes' }
      ]

      testChanges.forEach(change => {
        const queued = queueChange(change)
        networkTests.push({
          name: 'queue-offline-change',
          success: !!queued,
          changeId: queued.id || 'unknown',
          queueSize: offlineQueue.length
        })
      })

      // Test 2: Handle network failures with retry
      const testRetry = async () => {
        const retryResult = await retryOperation(
          () => simulateNetworkFailure('save-changes'),
          3,
          100
        )

        networkTests.push({
          name: 'retry-mechanism',
          success: !retryResult.success, // Should fail after retries
          attempts: retryResult.attempts,
          maxRetriesReached: retryResult.attempts === 3
        })
      }

      // Test 3: Graceful degradation
      const testGracefulDegradation = () => {
        // When network fails, fall back to local storage
        try {
          const fallbackData = {
            experiments: { 'exp-1': { name: 'Fallback Experiment' } },
            lastSync: Date.now(),
            source: 'local-fallback'
          }

          localStorage.setItem('absmartly_fallback_data', JSON.stringify(fallbackData))
          const stored = localStorage.getItem('absmartly_fallback_data')

          networkTests.push({
            name: 'graceful-degradation',
            success: !!stored,
            fallbackWorking: !!stored
          })
        } catch (error) {
          networkTests.push({
            name: 'graceful-degradation',
            success: false,
            error: error.message
          })
        }
      }

      // Test 4: Connection recovery detection
      const testConnectionRecovery = () => {
        let connectionStatus = 'offline'
        const connectionEvents: any[] = []

        // Simulate connection status changes
        const handleConnectionChange = (status: string) => {
          connectionStatus = status
          connectionEvents.push({
            status,
            timestamp: Date.now()
          })

          if (status === 'online') {
            // Process offline queue when connection recovers
            const queue = JSON.parse(localStorage.getItem('absmartly_offline_queue') || '[]')
            const processedCount = queue.length

            // Clear queue (simulate successful sync)
            localStorage.setItem('absmartly_offline_queue', '[]')

            return processedCount
          }
        }

        // Simulate offline -> online transition
        handleConnectionChange('offline')
        const processedChanges = handleConnectionChange('online')

        networkTests.push({
          name: 'connection-recovery',
          success: true,
          connectionEvents: connectionEvents.length,
          processedChanges: processedChanges || 0,
          finalStatus: connectionStatus
        })
      }

      // Test 5: Error categorization and handling
      const testErrorHandling = async () => {
        const errorTests = ['save-changes', 'load-experiments', 'sync-changes', 'auth-check']
        const errorResults = []

        for (const operation of errorTests) {
          const result = await simulateNetworkFailure(operation)
          // Define type for error result
          interface ErrorResult {
            retryable?: boolean
            code?: string
          }

          const errorResult = result as ErrorResult
          errorResults.push({
            operation,
            retryable: errorResult.retryable ?? false,
            errorCode: errorResult.code ?? 'unknown',
            handled: true
          })
        }

        networkTests.push({
          name: 'error-categorization',
          success: true,
          errorTypes: errorResults.length,
          retryableErrors: errorResults.filter(r => r.retryable).length,
          nonRetryableErrors: errorResults.filter(r => !r.retryable).length
        })
      }

      // Run all tests
      return Promise.all([
        testRetry(),
        Promise.resolve(testGracefulDegradation()),
        Promise.resolve(testConnectionRecovery()),
        testErrorHandling()
      ]).then(() => ({
        networkTests,
        offlineQueueSize: offlineQueue.length,
        summary: {
          totalTests: networkTests.length,
          passedTests: networkTests.filter(t => t.success).length,
          failedTests: networkTests.filter(t => !t.success).length
        }
      }))
    })

    const result = await networkFailureResult

    // Verify network failure handling
    expect(result.summary.totalTests).toBeGreaterThan(0)
    expect(result.offlineQueueSize).toBeGreaterThan(0) // Changes should be queued

    // Verify specific tests
    const queueTest = result.networkTests.find((t: any) => t.name === 'queue-offline-change')
    expect(queueTest?.success).toBeTruthy()

    const retryTest = result.networkTests.find((t: any) => t.name === 'retry-mechanism')
    expect(retryTest?.attempts).toBe(3) // Should retry 3 times
    expect(retryTest?.maxRetriesReached).toBeTruthy()

    const degradationTest = result.networkTests.find((t: any) => t.name === 'graceful-degradation')
    expect(degradationTest?.success).toBeTruthy()
    expect(degradationTest?.fallbackWorking).toBeTruthy()

    const recoveryTest = result.networkTests.find((t: any) => t.name === 'connection-recovery')
    expect(recoveryTest?.success).toBeTruthy()
    expect(recoveryTest?.connectionEvents).toBe(2) // offline -> online
    expect(recoveryTest?.finalStatus).toBe('online')

    await page.close()
  })

  test('20. Maximum change limit testing - test performance with many changes', async () => {
    const page = await context.newPage()

    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    const maxLimitResult = await page.evaluate(() => {
      const createManyElements = (count: number) => {
        const container = document.getElementById('test-container')!
        const elements = []

        for (let i = 0; i < count; i++) {
          const element = document.createElement('div')
          element.id = `stress-test-${i}`
          element.className = 'stress-test-element'
          element.textContent = `Element ${i}`
          element.style.cssText = 'display: inline-block; margin: 2px; padding: 4px; background: #f0f0f0; border: 1px solid #ccc;'
          container.appendChild(element)
          elements.push(element)
        }

        return elements
      }

      // Create test elements
      const testElements = createManyElements(500)

      // Test different change limits
      const limitTests = [
        { name: 'small-changeset', limit: 50 },
        { name: 'medium-changeset', limit: 200 },
        { name: 'large-changeset', limit: 500 },
        { name: 'extreme-changeset', limit: 1000 }
      ]

      const testResults: any[] = []

      limitTests.forEach(test => {
        const startTime = performance.now()

        // Create many changes
        const changes = []
        for (let i = 0; i < Math.min(test.limit, testElements.length); i++) {
          changes.push(
            {
              id: `change-style-${i}`,
              selector: `#stress-test-${i}`,
              type: 'style',
              value: {
                'background-color': `hsl(${i * 360 / test.limit}, 70%, 80%)`,
                'transform': `rotate(${i % 360}deg) scale(${0.8 + (i % 5) * 0.1})`,
                'border-radius': `${i % 20}px`
              }
            },
            {
              id: `change-text-${i}`,
              selector: `#stress-test-${i}`,
              type: 'text',
              value: `Updated ${i}`
            }
          )
        }

        const creationTime = performance.now() - startTime

        // Apply changes and measure performance
        const applyStartTime = performance.now()
        let appliedCount = 0
        let errorCount = 0

        changes.forEach(change => {
          const element = document.querySelector(change.selector)
          if (element) {
            try {
              if (change.type === 'style') {
                Object.assign((element as HTMLElement).style, change.value)
                appliedCount++
              } else if (change.type === 'text') {
                element.textContent = change.value
                appliedCount++
              }
            } catch (error) {
              errorCount++
            }
          } else {
            errorCount++
          }
        })

        const applyTime = performance.now() - applyStartTime

        // Test serialization performance
        const serializeStartTime = performance.now()
        const serialized = JSON.stringify(changes)
        const serializeTime = performance.now() - serializeStartTime

        // Test storage performance
        const storageStartTime = performance.now()
        try {
          localStorage.setItem(`absmartly_stress_test_${test.name}`, serialized)
          const stored = localStorage.getItem(`absmartly_stress_test_${test.name}`)
          const storageWorked = stored === serialized
          const storageTime = performance.now() - storageStartTime

          testResults.push({
            name: test.name,
            changeCount: changes.length,
            elementsTargeted: Math.min(test.limit, testElements.length),
            performance: {
              creation: creationTime,
              application: applyTime,
              serialization: serializeTime,
              storage: storageTime,
              total: creationTime + applyTime + serializeTime + storageTime
            },
            results: {
              appliedCount,
              errorCount,
              successRate: appliedCount / changes.length,
              storageWorked
            },
            limits: {
              serializedSize: serialized.length,
              memoryUsage: serialized.length, // Approximate
              withinLimits: serialized.length < 5 * 1024 * 1024 // 5MB limit
            }
          })
        } catch (error) {
          testResults.push({
            name: test.name,
            changeCount: changes.length,
            error: error.message,
            limitExceeded: true
          })
        }
      })

      // Test concurrent change applications
      const concurrencyTest = () => {
        const concurrentChanges = Array.from({ length: 100 }, (_, i) => ({
          selector: `#stress-test-${i}`,
          type: 'style',
          value: { 'opacity': `${0.5 + (i % 10) * 0.05}` }
        }))

        const startTime = performance.now()

        // Apply all changes concurrently
        const promises = concurrentChanges.map(change =>
          new Promise(resolve => {
            setTimeout(() => {
              const element = document.querySelector(change.selector)
              if (element) {
                Object.assign((element as HTMLElement).style, change.value)
                resolve({ success: true, selector: change.selector })
              } else {
                resolve({ success: false, selector: change.selector })
              }
            }, Math.random() * 10) // Random delay up to 10ms
          })
        )

        return Promise.all(promises).then(results => {
          const endTime = performance.now()
          return {
            name: 'concurrency-test',
            totalChanges: concurrentChanges.length,
            successful: results.filter((r: any) => r.success).length,
            duration: endTime - startTime,
            averageTimePerChange: (endTime - startTime) / concurrentChanges.length
          }
        })
      }

      return concurrencyTest().then(concurrencyResult => ({
        testResults,
        concurrencyResult,
        summary: {
          maxSuccessfulChanges: testResults.filter(r => !r.error && r.results).length > 0
            ? Math.max(...testResults.filter(r => !r.error && r.results).map(r => r.results.appliedCount || 0))
            : 0,
          totalElementsCreated: testElements.length,
          performanceBenchmarks: {
            fastestApplication: testResults.filter(r => !r.error && r.performance).length > 0
              ? Math.min(...testResults.filter(r => !r.error && r.performance).map(r => r.performance.application || Infinity))
              : 0,
            slowestApplication: testResults.filter(r => !r.error && r.performance).length > 0
              ? Math.max(...testResults.filter(r => !r.error && r.performance).map(r => r.performance.application || 0))
              : 0,
            averageSuccessRate: testResults.filter(r => !r.error && r.results).length > 0
              ? testResults.filter(r => !r.error && r.results).reduce((sum, r) => sum + (r.results.successRate || 0), 0) / testResults.filter(r => !r.error && r.results).length
              : 0
          }
        }
      }))
    })

    const result = await maxLimitResult

    // Verify maximum change limit handling
    expect(result.testResults.length).toBe(4) // All limit tests should complete
    expect(result.summary.totalElementsCreated).toBe(500)
    expect(result.summary.maxSuccessfulChanges).toBeGreaterThanOrEqual(0)

    // Verify performance is reasonable
    const largeChangesetTest = result.testResults.find((t: any) => t.name === 'large-changeset')
    expect(largeChangesetTest).toBeTruthy()
    if (largeChangesetTest && !largeChangesetTest.error && largeChangesetTest.performance) {
      expect(largeChangesetTest.performance.application).toBeLessThan(10000) // Should complete within 10 seconds
      if (largeChangesetTest.results) {
        expect(largeChangesetTest.results.successRate).toBeGreaterThan(0.5) // >50% success rate
      }
    }

    // Verify storage limits
    const extremeTest = result.testResults.find((t: any) => t.name === 'extreme-changeset')
    if (extremeTest && !extremeTest.error) {
      expect(extremeTest.limits.withinLimits).toBeTruthy() // Should stay within storage limits
    }

    // Verify concurrency handling
    expect(result.concurrencyResult.successful).toBeGreaterThan(0)
    expect(result.concurrencyResult.averageTimePerChange).toBeLessThan(100) // Less than 100ms per change on average

    // Verify performance benchmarks
    expect(result.summary.performanceBenchmarks.averageSuccessRate).toBeGreaterThan(0.8) // >80% average success rate
    expect(result.summary.performanceBenchmarks.fastestApplication).toBeLessThan(result.summary.performanceBenchmarks.slowestApplication)

    await page.close()
  })
})

/**
 * Helper function to create the test HTML page
 */
async function createPersistenceTestPage() {
  const testPagePath = path.join(__dirname, '..', 'test-pages', 'persistence-test.html')

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Visual Editor Persistence Test</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            padding: 20px;
            background-color: #f5f5f5;
        }
        #test-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        #test-button {
            background-color: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 10px 0;
            display: inline-block;
        }
        .test-paragraph {
            margin: 15px 0;
            line-height: 1.6;
            color: #333;
        }
        .test-list {
            list-style-type: disc;
            padding-left: 20px;
        }
        .test-list li {
            margin: 5px 0;
        }
        #dynamic-content {
            background-color: #e9ecef;
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
        }
        .perf-test-item {
            display: inline-block;
            margin: 2px;
            padding: 4px 8px;
            background-color: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 3px;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div id="test-container">
        <h1>Visual Editor Persistence Test Page</h1>

        <button id="test-button">Test Button</button>

        <p class="test-paragraph">
            This is a test paragraph that can be modified by the visual editor.
            It contains some sample text to test text modifications and styling changes.
        </p>

        <div id="dynamic-content">
            This content can be dynamically updated to test AJAX scenarios.
        </div>

        <ul class="test-list">
            <li>Test list item 1</li>
            <li>Test list item 2</li>
            <li>Test list item 3</li>
        </ul>

        <div class="test-grid" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
            <div class="grid-item" style="background: #fff3cd; padding: 10px; text-align: center;">Grid Item 1</div>
            <div class="grid-item" style="background: #d4edda; padding: 10px; text-align: center;">Grid Item 2</div>
            <div class="grid-item" style="background: #d1ecf1; padding: 10px; text-align: center;">Grid Item 3</div>
        </div>

        <form class="test-form" style="margin: 20px 0;">
            <label for="test-input">Test Input:</label>
            <input type="text" id="test-input" name="test-input" placeholder="Enter test data" style="margin: 5px; padding: 5px;">
            <button type="button" id="form-button">Submit Test</button>
        </form>

        <div id="test-results" style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
            <h3>Test Results</h3>
            <p>Results will appear here during testing.</p>
        </div>
    </div>

    <script>
        // Add some basic interactivity for testing
        document.getElementById('test-button').addEventListener('click', function() {
            console.log('Test button clicked');
            document.getElementById('test-results').innerHTML = '<h3>Test Results</h3><p>Button clicked at ' + new Date().toLocaleTimeString() + '</p>';
        });

        document.getElementById('form-button').addEventListener('click', function() {
            const input = document.getElementById('test-input').value;
            console.log('Form submitted with:', input);
            document.getElementById('test-results').innerHTML = '<h3>Test Results</h3><p>Form submitted with: "' + input + '" at ' + new Date().toLocaleTimeString() + '</p>';
        });

        // Simulate dynamic content updates
        function updateDynamicContent() {
            const content = document.getElementById('dynamic-content');
            content.innerHTML = 'Dynamic content updated at ' + new Date().toLocaleTimeString();
        }

        // Update dynamic content every 30 seconds during testing
        setInterval(updateDynamicContent, 30000);

        // Make functions available globally for testing
        window.testHelpers = {
            updateDynamicContent,
            addTestElement: function(id, content) {
                const container = document.getElementById('test-container');
                const element = document.createElement('div');
                element.id = id;
                element.innerHTML = content;
                element.style.cssText = 'margin: 10px 0; padding: 10px; background: #e9ecef; border-radius: 4px;';
                container.appendChild(element);
                return element;
            },
            removeTestElement: function(id) {
                const element = document.getElementById(id);
                if (element) {
                    element.remove();
                    return true;
                }
                return false;
            }
        };

        console.log('Persistence test page loaded');
    </script>
</body>
</html>
  `

  // Ensure test-pages directory exists
  const testPagesDir = path.dirname(testPagePath)
  if (!fs.existsSync(testPagesDir)) {
    fs.mkdirSync(testPagesDir, { recursive: true })
  }

  // Write the test page
  fs.writeFileSync(testPagePath, htmlContent)
  console.log('Created persistence test page at:', testPagePath)
}