import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'sdk-events-test.html')

// Helper to open Events Debug Page panel
async function openEventsDebugPage(page: Page) {
  const sidebarFrame = page.frameLocator('iframe[id="absmartly-sidebar-iframe"]')
  const eventsButton = sidebarFrame.locator('button[aria-label="Events Debug"]')
  await eventsButton.waitFor({ state: 'visible', timeout: 10000 })
  await eventsButton.click()
  await page.waitForTimeout(500)
}

// Helper to get events from the panel
async function getEventsFromPanel(page: Page): Promise<Array<{eventName: string, timestamp: string}>> {
  const frame = page.frameLocator('iframe[id="absmartly-sidebar-iframe"]')

  // Wait for events to be rendered
  await frame.locator('.p-3.space-y-2').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
    // No events yet, return empty array
  })

  // Get all event cards
  const eventCards = await frame.locator('.p-3.border.rounded-lg').all()

  const events = []
  for (const card of eventCards) {
    const eventNameEl = card.locator('span.px-2.py-0\\.5').first()
    const timestampEl = card.locator('span.text-xs.text-gray-500')

    const eventName = await eventNameEl.textContent()
    const timestamp = await timestampEl.textContent()

    if (eventName && timestamp) {
      events.push({
        eventName: eventName.trim(),
        timestamp: timestamp.trim()
      })
    }
  }

  return events
}

// Helper to get event count from status bar
async function getEventCount(page: Page): Promise<number> {
  const frame = page.frameLocator('iframe[id="absmartly-sidebar-iframe"]')
  const statusText = await frame.locator('.p-2.bg-gray-50.text-gray-600.text-sm.text-center').last().textContent()
  const match = statusText?.match(/(\d+) event/)
  return match ? parseInt(match[1], 10) : 0
}

// Helper to click event card
async function clickEventCard(page: Page, eventName: string) {
  const frame = page.frameLocator('iframe[id="absmartly-sidebar-iframe"]')
  const eventCard = frame.locator(`.p-3.border.rounded-lg:has(span:has-text("${eventName}"))`).first()
  await eventCard.click()
  await page.waitForTimeout(500)
}

// Helper to check if event viewer modal is open
async function isEventViewerOpen(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.querySelector('#absmartly-event-viewer-host') !== null
  })
}

// Helper to close event viewer
async function closeEventViewer(page: Page) {
  await page.click('.event-viewer-button-close')
  await page.waitForTimeout(300)
}

// Helper to get event viewer content
async function getEventViewerContent(page: Page): Promise<{title: string, timestamp: string, json: string}> {
  return await page.evaluate(() => {
    const container = document.querySelector('#absmartly-event-viewer-host')
    if (!container) return { title: '', timestamp: '', json: '' }

    const title = container.querySelector('.event-viewer-title')?.textContent || ''
    const timestamp = container.querySelector('.event-viewer-timestamp')?.textContent || ''
    const jsonContent = container.querySelector('.cm-content')?.textContent || ''

    return { title, timestamp, json: jsonContent }
  })
}

test('SDK Events Debug Page - Complete Flow', async ({ context, extensionId, extensionUrl }) => {
  console.log('🧪 Test: SDK Events Debug Page - Complete Flow\n')

  // Setup: Create page and inject credentials
  const testPage = await context.newPage()

  await testPage.addInitScript((credentials) => {
    (window as any).__absmartlyTestMode = true;
    (window as any).__absmartlyAPIKey = credentials.apiKey;
    (window as any).__absmartlyAPIEndpoint = credentials.apiEndpoint;
  }, {
    apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-dev-key',
    apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo.absmartly.io'
  })

  await testPage.goto(`file://${TEST_PAGE_PATH}`)
  await testPage.setViewportSize({ width: 1920, height: 1080 })
  await testPage.waitForLoadState('networkidle')
  console.log('✅ Test page loaded\n')

  // Step 1: Inject sidebar ONCE
  console.log('Step 1: Inject sidebar')
  await testPage.evaluate((extUrl) => {
    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 384px;
      height: 100vh;
      background-color: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = `width: 100%; height: 100%; border: none;`
    iframe.src = extUrl

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, extensionUrl('tabs/sidebar.html'))

  const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('body').waitFor({ timeout: 10000 })
  console.log('  ✓ Sidebar injected\n')

  // Step 2: Wait for SDK and inject plugin
  console.log('Step 2: Load SDK and inject plugin')
  await testPage.waitForFunction(() => {
    return typeof window.absmartly !== 'undefined' && window.absmartly.SDK
  }, { timeout: 10000 })
  console.log('  ✓ ABsmartly SDK loaded')

  const fs = require('fs')
  const mappingPath = `build/chrome-mv3-dev/inject-sdk-plugin-mapping.json`
  const mapping = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'))
  const sdkPluginPath = extensionUrl(mapping.filename)

  await testPage.evaluate((scriptUrl) => {
    return new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = scriptUrl
      script.onload = () => resolve({ loaded: true })
      script.onerror = () => resolve({ loaded: false })
      document.head.appendChild(script)
    })
  }, sdkPluginPath)
  await testPage.waitForTimeout(2000)
  console.log('  ✓ SDK plugin injected\n')

  // Step 3: Trigger events BEFORE opening sidebar (test buffering)
  console.log('Step 3: Trigger events before opening sidebar (testing buffering)')
  await testPage.click('#trigger-ready')
  await testPage.waitForTimeout(300)
  await testPage.click('#trigger-exposure')
  await testPage.waitForTimeout(300)
  console.log('  ✓ Events triggered before sidebar opened\n')

  // Step 4: Open Events Debug Page and verify buffered events appear
  console.log('Step 4: Open Events Debug Page and verify buffered events')
  await openEventsDebugPage(testPage)
  const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')

  // Wait a moment for buffered events to load
  await testPage.waitForTimeout(1000)

  // Verify buffered events are displayed
  const bufferedEvents = await getEventsFromPanel(testPage)
  expect(bufferedEvents.length).toBeGreaterThanOrEqual(2)
  console.log(`  ✓ Found ${bufferedEvents.length} buffered events`)

  const hasReady = bufferedEvents.some(e => e.eventName === 'ready')
  const hasExposure = bufferedEvents.some(e => e.eventName === 'exposure')
  expect(hasReady).toBeTruthy()
  expect(hasExposure).toBeTruthy()
  console.log('  ✓ Buffered events include "ready" and "exposure"\n')

  // Step 5: Trigger more SDK events and verify they appear in real-time
  console.log('Step 5: Trigger more SDK events in real-time')
  await testPage.click('#trigger-all')
  await testPage.waitForTimeout(5000)

  const events = await getEventsFromPanel(testPage)
  console.log(`  ✓ Found ${events.length} total events`)

  const eventTypes = ['ready', 'refresh', 'exposure', 'goal', 'error']
  for (const eventType of eventTypes) {
    const found = events.some(e => e.eventName === eventType)
    expect(found).toBeTruthy()
    console.log(`  ✓ Event type "${eventType}" found`)
  }

  const count = await getEventCount(testPage)
  expect(count).toBeGreaterThanOrEqual(7)
  console.log(`  ✓ Status bar shows ${count} events (including buffered)\n`)

  // Step 6: Test event viewer modal
  console.log('Step 6: Test event viewer modal')
  await testPage.click('#clear-events')
  await testPage.waitForTimeout(300)
  await testPage.click('#trigger-exposure')
  await testPage.waitForTimeout(500)

  await clickEventCard(testPage, 'exposure')
  const isOpen = await isEventViewerOpen(testPage)
  expect(isOpen).toBeTruthy()
  console.log('  ✓ Event viewer modal opened')

  const content = await getEventViewerContent(testPage)
  expect(content.title).toContain('exposure')
  expect(content.json).toContain('test_experiment')
  console.log('  ✓ Event viewer shows correct content')

  await closeEventViewer(testPage)
  const isStillOpen = await isEventViewerOpen(testPage)
  expect(isStillOpen).toBeFalsy()
  console.log('  ✓ Event viewer closed\n')

  // Step 7: Take screenshot
  console.log('Step 7: Take screenshot')
  await testPage.screenshot({ path: 'tests/screenshots/sdk-events-all.png', fullPage: true })
  console.log('  ✓ Screenshot saved\n')

  // Cleanup
  await testPage.close()
  console.log('✅ Test completed successfully')
})
