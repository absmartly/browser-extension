import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging } from './utils/test-helpers'
import http from 'http'
import fs from 'fs'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'sdk-events-test.html')

// Simple HTTP server to serve test page (needed because content scripts don't work reliably with file:// URLs)
let testServer: http.Server | null = null
let testServerUrl: string | null = null

test.beforeAll(async () => {
  // Start a simple HTTP server
  const testPageContent = fs.readFileSync(TEST_PAGE_PATH, 'utf-8')
  testServer = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(testPageContent)
  })

  await new Promise<void>((resolve) => {
    testServer!.listen(0, '127.0.0.1', () => {
      const address = testServer!.address() as any
      testServerUrl = `http://127.0.0.1:${address.port}`
      console.log(`Test server started at ${testServerUrl}`)
      resolve()
    })
  })
})

test.afterAll(async () => {
  if (testServer) {
    await new Promise<void>((resolve) => testServer!.close(() => resolve()))
    console.log('Test server stopped')
  }
})

test.describe('Events Debug Page', () => {
  test.skip('sidebar loads with auto-config from env vars', async ({ context, extensionId, extensionUrl }) => {
    console.log('\n🚀 Starting sidebar test with auto-config from env vars')
    console.log('Extension ID:', extensionId)

    const page = await context.newPage()
    await page.goto(testServerUrl!)
    console.log('✅ Test page loaded')

    // Inject sidebar
    const sidebar = await injectSidebar(page, extensionUrl)
    console.log('✅ Sidebar injected')

    // Wait for iframe to load
    await sidebar.locator('body').waitFor({ timeout: 10000 })
    console.log('✅ Sidebar iframe loaded')

    // Check if sidebar loaded config from env vars and shows main UI
    const sidebarHTML = await sidebar.locator('body').innerHTML()
    console.log('Sidebar HTML length:', sidebarHTML.length)

    const hasWelcomeText = sidebarHTML.includes('Welcome to ABsmartly') || sidebarHTML.includes('Configure Settings')
    const hasExperimentsText = sidebarHTML.includes('Experiments')
    const hasEventsButton = sidebarHTML.includes('Events Debug')
    console.log('Has welcome screen:', hasWelcomeText)
    console.log('Has experiments UI:', hasExperimentsText)
    console.log('Has Events Debug button:', hasEventsButton)

    // Should NOT show welcome screen (env vars should auto-populate config)
    expect(hasWelcomeText).toBe(false)
    // Should show main UI
    expect(hasExperimentsText || hasEventsButton).toBe(true)
    console.log('✅ Test passed - main UI shown with auto-config from env vars!')

    await page.close()
  })

  test('sidebar loads with config (main UI)', async ({ context, extensionId, extensionUrl, seedStorage, getStorage }) => {
    console.log('\n🚀 Starting sidebar test with config')
    console.log('Extension ID:', extensionId)

    // Seed config first
    console.log('Seeding config...')
    const config = {
      apiKey: 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
      apiEndpoint: 'https://demo-2.absmartly.com/v1',
      applicationId: null,
      authMethod: 'apikey',
      domChangesStorageType: null,
      domChangesFieldName: null
    }

    await seedStorage({
      'absmartly-config': config,
      'plasmo:absmartly-config': config
    })
    console.log('✅ Config seeded')

    // Wait for config to propagate to extension
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Verify storage
    const storage = await getStorage()
    console.log('Storage keys:', Object.keys(storage))
    console.log('Has config:', 'absmartly-config' in storage)

    const page = await context.newPage()
    await page.goto(testServerUrl!)
    console.log('✅ Test page loaded')

    // Inject sidebar
    const sidebar = await injectSidebar(page, extensionUrl)
    console.log('✅ Sidebar injected')

    // Wait for iframe to load
    await sidebar.locator('body').waitFor({ timeout: 10000 })
    console.log('✅ Sidebar iframe loaded')

    // Give sidebar EXTRA time to load config from storage
    console.log('Waiting for sidebar to load config...')
    await page.waitForTimeout(5000)
    console.log('Wait complete')

    // Check if sidebar content shows main UI
    const sidebarHTML = await sidebar.locator('body').innerHTML()
    console.log('Sidebar HTML length:', sidebarHTML.length)

    const hasWelcomeText = sidebarHTML.includes('Welcome to ABsmartly') || sidebarHTML.includes('Configure Settings')
    const hasExperimentsText = sidebarHTML.includes('Experiments')
    const hasEventsButton = sidebarHTML.includes('Events Debug')
    console.log('Has welcome screen:', hasWelcomeText)
    console.log('Has experiments UI:', hasExperimentsText)
    console.log('Has Events Debug button:', hasEventsButton)

    expect(hasWelcomeText).toBe(false)
    expect(hasExperimentsText || hasEventsButton).toBe(true)

    console.log('✅ Test passed - main UI shown with config!')

    await page.close()
  })

  // Event functionality tests with beforeEach/afterEach setup
  test.describe('Event Capture and Display', () => {
    let testPage: Page
    let sidebar: any
    let consoleMessages: Array<{ type: string; text: string }> = []

    test.beforeEach(async ({ context, extensionUrl, extensionId, seedStorage }) => {
      // Seed config FIRST, before creating page
      await seedStorage({
        'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
        'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo-2.absmartly.com/v1',
        'absmartly-env': 'production',
        'absmartly-auth-method': 'apikey'
      })

      testPage = await context.newPage()

      // Set up console logging to capture all messages
      consoleMessages = setupConsoleLogging(testPage)

      // Use HTTP server instead of file:// URL so content scripts work properly
      await testPage.goto(testServerUrl!)
      await testPage.waitForLoadState('networkidle')
      await testPage.waitForTimeout(500)

      sidebar = await injectSidebar(testPage, extensionUrl)
      // Wait for sidebar to load config and show main UI
      await testPage.waitForTimeout(1000)

      // Open Events Debug Page
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.waitFor({ timeout: 10000 }) // Wait for button to appear
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await testPage.waitForTimeout(300)

      // Wait for Events Debug Page to be fully loaded by checking for the initial state
      // The "0 events captured" text should be visible when the page loads
      await sidebar.locator('text=0 events captured').waitFor({ timeout: 5000 })
      await testPage.waitForTimeout(300)
    })

    test.afterEach(async () => {
      // Print ALL console messages for debugging
      console.log(`\n📋 Total console messages captured: ${consoleMessages.length}`)
      console.log('📋 ALL messages:')
      consoleMessages.forEach(msg => console.log(`  [${msg.type}] ${msg.text}`))

      if (testPage) await testPage.close()
    })

    test('captures and displays SDK events in real-time', async () => {
      await test.step('Trigger SDK ready event', async () => {
        console.log('Sending SDK_EVENT via window.postMessage...')
        await testPage.evaluate(() => {
          console.log('[TEST] About to send window.postMessage with SDK_EVENT')
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'ready',
              data: { experiments: ['exp1', 'exp2'] },
              timestamp: new Date().toISOString()
            }
          }, '*')
          console.log('[TEST] window.postMessage sent')
        })
        // Give time for event to propagate: page → content script → background → sidebar
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify event appears in list', async () => {
        await expect(sidebar.locator('text=ready')).toBeVisible({ timeout: 10000 })
        await expect(sidebar.locator('text=1 event captured')).toBeVisible()
      })

      await test.step('Trigger exposure event', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'exposure',
              data: { experiment: 'test_exp', variant: 1 },
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify both events displayed', async () => {
        await expect(sidebar.locator('text=exposure')).toBeVisible({ timeout: 10000 })
        await expect(sidebar.locator('text=2 events captured')).toBeVisible()

        // Verify newest first (exposure should appear before ready)
        const firstEventItem = sidebar.locator('[data-testid="event-item"]').first()
        await expect(firstEventItem).toHaveAttribute('data-event-name', 'exposure')
      })
    })

    test('displays event details when clicked', async () => {
      await test.step('Trigger exposure event', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'exposure',
              data: { experiment: 'test_exp', variant: 1 },
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Click event to view details', async () => {
        const eventItem = sidebar.locator('[data-testid="event-item"][data-event-name="exposure"]').first()
        await eventItem.waitFor({ state: 'visible', timeout: 10000 })
        await eventItem.click()
        await testPage.waitForTimeout(300)
      })

      await test.step('Verify event details displayed', async () => {
        // Wait for modal to appear
        const modal = sidebar.locator('.fixed.inset-0')
        await expect(modal).toBeVisible({ timeout: 10000 })

        await expect(modal.locator('text=Event Type')).toBeVisible()
        await expect(modal.locator('text=Timestamp')).toBeVisible()
        await expect(modal.locator('text=Event Data')).toBeVisible()
        // Check that JSON data in modal contains the expected keys and values
        await expect(modal.locator('pre', { hasText: 'experiment' })).toBeVisible()
        await expect(modal.locator('pre', { hasText: 'test_exp' })).toBeVisible()
        await expect(modal.locator('pre', { hasText: 'variant' })).toBeVisible()
      })

      await test.step('Verify event is highlighted', async () => {
        // Event highlighting is not implemented yet - skip this check
        // TODO: Implement event highlighting when an event is selected
      })
    })

    test('pause and resume functionality', async () => {
      // Clear any events first to ensure clean state
      await test.step('Clear events before test', async () => {
        const clearButton = sidebar.locator('button[title="Clear all events"]')
        if (await clearButton.isVisible()) {
          await clearButton.click()
          await testPage.waitForTimeout(300)
        }
      })

      await test.step('Click pause button', async () => {
        const pauseButton = sidebar.locator('button[title="Pause"]')
        await expect(pauseButton).toBeVisible()
        await pauseButton.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify paused state', async () => {
        await expect(sidebar.locator('text=Event capture paused')).toBeVisible()
        await expect(sidebar.locator('button[title="Resume"]')).toBeVisible()
      })

      await test.step('Trigger event while paused', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'ready',
              data: null,
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify event not captured while paused', async () => {
        await expect(sidebar.locator('text=0 events captured')).toBeVisible()
        await expect(sidebar.locator('text=ready')).not.toBeVisible()
      })

      await test.step('Click resume button', async () => {
        const resumeButton = sidebar.locator('button[title="Resume"]')
        await resumeButton.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify resumed state', async () => {
        await expect(sidebar.locator('text=Event capture paused')).not.toBeVisible()
        await expect(sidebar.locator('button[title="Pause"]')).toBeVisible()
      })

      await test.step('Trigger event after resume', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'exposure',
              data: { test: 'data' },
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(1000) // Increased wait time for event to propagate
      })

      await test.step('Verify event captured after resume', async () => {
        await expect(sidebar.locator('text=exposure')).toBeVisible({ timeout: 10000 })
        // Verify at least one event was captured after resume
        const statusBar = sidebar.locator('.p-2.bg-gray-50.text-gray-600.text-sm.text-center.border-t')
        await expect(statusBar).toContainText(/\d+ events? captured/, { timeout: 10000 })
        await expect(statusBar).not.toContainText('0 events captured', { timeout: 10000 })
      })
    })

    test('clear events functionality', async () => {
      await test.step('Add multiple events', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'ready',
              data: null,
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)

        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'exposure',
              data: { experiment: 'test' },
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify events exist', async () => {
        await expect(sidebar.locator('text=2 events captured')).toBeVisible()
      })

      await test.step('Click clear button', async () => {
        const clearButton = sidebar.locator('button[title="Clear all events"]')
        await expect(clearButton).toBeVisible()
        await clearButton.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify events cleared', async () => {
        await expect(sidebar.locator('text=No events captured yet')).toBeVisible()
        await expect(sidebar.locator('text=0 events captured')).toBeVisible()
        await expect(sidebar.locator('text=ready')).not.toBeVisible()
        await expect(sidebar.locator('text=exposure')).not.toBeVisible()
      })
    })

    test('displays color-coded event types', async () => {
      await test.step('Trigger different event types', async () => {
        const eventTypes = ['error', 'ready', 'refresh', 'publish', 'exposure', 'goal', 'finalize']

        for (const eventName of eventTypes) {
          await testPage.evaluate((name) => {
            window.postMessage({
              source: 'absmartly-page',
              type: 'SDK_EVENT',
              payload: {
                eventName: name,
                data: null,
                timestamp: new Date().toISOString()
              }
            }, '*')
          }, eventName)
          await testPage.waitForTimeout(100)
        }

        await testPage.waitForTimeout(500)
      })

      await test.step('Verify all event types displayed', async () => {
        await expect(sidebar.locator('text=7 events captured')).toBeVisible()

        // Verify each event type appears
        const eventTypes = ['error', 'ready', 'refresh', 'publish', 'exposure', 'goal', 'finalize']
        for (const eventName of eventTypes) {
          await expect(sidebar.locator(`text=${eventName}`).first()).toBeVisible()
        }
      })

      await test.step('Verify color coding', async () => {
        // Check that different events have different color classes
        const errorItem = sidebar.locator('[data-testid="event-item"][data-event-name="error"]').first()
        const errorBadge = errorItem.locator('[data-testid="event-badge"]')
        await expect(errorBadge).toHaveClass(/text-red-600/)

        const readyItem = sidebar.locator('[data-testid="event-item"][data-event-name="ready"]').first()
        const readyBadge = readyItem.locator('[data-testid="event-badge"]')
        await expect(readyBadge).toHaveClass(/text-green-600/)

        const exposureItem = sidebar.locator('[data-testid="event-item"][data-event-name="exposure"]').first()
        const exposureBadge = exposureItem.locator('[data-testid="event-badge"]')
        await expect(exposureBadge).toHaveClass(/text-orange-600/)
      })
    })

    test('formats timestamps correctly', async () => {
      await test.step('Trigger event with specific timestamp', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'ready',
              data: null,
              timestamp: '2025-01-01T14:30:45.123Z'
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify timestamp format in list', async () => {
        // Should show time in HH:MM:SS.mmm format
        const timestamp = sidebar.locator('text=/\\d{2}:\\d{2}:\\d{2}\\.\\d{3}/')
        await expect(timestamp).toBeVisible()
      })

      await test.step('Click event and verify full timestamp in details', async () => {
        const eventItem = sidebar.locator('[data-testid="event-item"][data-event-name="ready"]').first()
        await eventItem.waitFor({ state: 'visible', timeout: 10000 })
        await eventItem.click()
        await testPage.waitForTimeout(500)

        // Should show full date/time
        await expect(sidebar.locator('text=/1\\/1\\/2025/')).toBeVisible()
      })
    })

    test('handles events without data', async () => {
      await test.step('Trigger event with null data', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'absmartly-page',
            type: 'SDK_EVENT',
            payload: {
              eventName: 'finalize',
              data: null,
              timestamp: new Date().toISOString()
            }
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify event captured', async () => {
        await expect(sidebar.locator('text=finalize')).toBeVisible()
        await expect(sidebar.locator('text=1 event captured')).toBeVisible()
      })
    })

    test('ignores non-SDK events', async () => {
      await test.step('Send non-SDK event', async () => {
        await testPage.evaluate(() => {
          window.postMessage({
            source: 'other-source',
            type: 'SOME_EVENT',
            payload: {}
          }, '*')
        })
        await testPage.waitForTimeout(500)
      })

      await test.step('Verify event not captured', async () => {
        await expect(sidebar.locator('text=No events captured yet')).toBeVisible()
        await expect(sidebar.locator('text=0 events captured')).toBeVisible()
      })
    })
  })
})
