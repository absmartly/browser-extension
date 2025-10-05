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
  await frame.locator('.p-4.space-y-2').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {
    // No events yet, return empty array
  })

  // Get all event cards
  const eventCards = await frame.locator('.p-4.border.rounded-lg').all()

  const events = []
  for (const card of eventCards) {
    const eventNameEl = card.locator('span.px-3.py-1').first()
    const timestampEl = card.locator('span.text-sm.text-gray-500')

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
  const eventCard = frame.locator(`.p-4.border.rounded-lg:has(span:has-text("${eventName}"))`).first()
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
  // Click the close button or press Escape
  await page.keyboard.press('Escape')
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

test.describe('SDK Events Debug Page', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    await testPage.goto(`file://${TEST_PAGE_PATH}`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Enable test mode to disable shadow DOM for easier testing
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ SDK Events test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) {
      await testPage.close()
    }
  })

  test('should display all SDK event types in the panel', async ({ extensionId, extensionUrl }) => {
    console.log('🧪 Test: Display all SDK event types')

    // Inject sidebar
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
    console.log('  ✓ Sidebar injected')

    // Inject SDK plugin script into the page to intercept SDK events
    const sdkPluginPath = extensionUrl('inject-sdk-plugin.js')
    await testPage.evaluate((scriptUrl) => {
      const script = document.createElement('script')
      script.src = scriptUrl
      script.onload = () => console.log('[Test] SDK plugin script loaded')
      script.onerror = () => console.error('[Test] Failed to load SDK plugin script')
      document.head.appendChild(script)
    }, sdkPluginPath)
    await testPage.waitForTimeout(1000) // Wait for SDK plugin to initialize
    console.log('  ✓ SDK plugin injected')

    // Open Events Debug Page
    await openEventsDebugPage(testPage)
    console.log('  ✓ Opened Events Debug Page')

    // Initially should show "No events captured yet"
    const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')
    await expect(frame.locator('text=No events captured yet')).toBeVisible()
    console.log('  ✓ Empty state visible')

    // Trigger all events
    await testPage.click('#trigger-all')
    console.log('  ✓ Triggered all SDK events')

    // Wait for events to appear
    await testPage.waitForTimeout(1000)

    // Check that events appeared
    const events = await getEventsFromPanel(testPage)
    console.log(`  ✓ Found ${events.length} events in panel`)

    // Verify all event types are present
    const eventTypes = ['ready', 'refresh', 'publish', 'exposure', 'goal', 'finalize', 'error']
    for (const eventType of eventTypes) {
      const found = events.some(e => e.eventName === eventType)
      expect(found).toBeTruthy()
      console.log(`  ✓ Event type "${eventType}" found`)
    }

    // Check event count in status bar
    const count = await getEventCount(testPage)
    expect(count).toBe(7)
    console.log(`  ✓ Status bar shows ${count} events`)

    // Take screenshot showing all events
    await testPage.screenshot({ path: 'tests/screenshots/sdk-events-all.png', fullPage: true })
    console.log('  ✓ Screenshot saved to tests/screenshots/sdk-events-all.png')
  })

  test('should display events with correct color coding', async ({ page }) => {
    console.log('🧪 Test: Event color coding')

    await openEventsDebugPage(testPage)

    // Trigger specific events
    await testPage.click('#trigger-error')
    await testPage.click('#trigger-ready')
    await testPage.click('#trigger-exposure')
    await testPage.waitForTimeout(500)

    const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')

    // Check error event has red color
    const errorBadge = frame.locator('span.px-3.py-1:has-text("error")').first()
    await expect(errorBadge).toHaveClass(/text-red-600/)
    console.log('  ✓ Error event has red color')

    // Check ready event has green color
    const readyBadge = frame.locator('span.px-3.py-1:has-text("ready")').first()
    await expect(readyBadge).toHaveClass(/text-green-600/)
    console.log('  ✓ Ready event has green color')

    // Check exposure event has orange color
    const exposureBadge = frame.locator('span.px-3.py-1:has-text("exposure")').first()
    await expect(exposureBadge).toHaveClass(/text-orange-600/)
    console.log('  ✓ Exposure event has orange color')
  })

  test('should open event viewer modal when clicking on event', async ({ page }) => {
    console.log('🧪 Test: Open event viewer modal')

    await openEventsDebugPage(testPage)

    // Trigger an exposure event
    await testPage.click('#trigger-exposure')
    await testPage.waitForTimeout(500)

    // Click on the event card
    await clickEventCard(testPage, 'exposure')
    console.log('  ✓ Clicked on exposure event card')

    // Check that event viewer modal opened
    const isOpen = await isEventViewerOpen(testPage)
    expect(isOpen).toBeTruthy()
    console.log('  ✓ Event viewer modal opened')

    // Verify modal content
    const content = await getEventViewerContent(testPage)
    expect(content.title).toContain('exposure')
    expect(content.json).toContain('test_experiment')
    console.log('  ✓ Event viewer shows correct content')

    // Close modal
    await closeEventViewer(testPage)
    await testPage.waitForTimeout(300)

    const isStillOpen = await isEventViewerOpen(testPage)
    expect(isStillOpen).toBeFalsy()
    console.log('  ✓ Event viewer closed')
  })

  test('should pause and resume event capture', async ({ page }) => {
    console.log('🧪 Test: Pause and resume event capture')

    await openEventsDebugPage(testPage)
    const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')

    // Trigger an event
    await testPage.click('#trigger-ready')
    await testPage.waitForTimeout(300)

    let count = await getEventCount(testPage)
    expect(count).toBe(1)
    console.log('  ✓ First event captured')

    // Click pause button
    const pauseButton = frame.locator('button[title="Pause"]')
    await pauseButton.click()
    await testPage.waitForTimeout(200)
    console.log('  ✓ Clicked pause button')

    // Verify pause indicator
    await expect(frame.locator('text=Event capture paused')).toBeVisible()
    console.log('  ✓ Pause indicator visible')

    // Trigger another event while paused
    await testPage.click('#trigger-refresh')
    await testPage.waitForTimeout(300)

    // Count should still be 1 (event not captured)
    count = await getEventCount(testPage)
    expect(count).toBe(1)
    console.log('  ✓ Event not captured while paused')

    // Resume capture
    const resumeButton = frame.locator('button[title="Resume"]')
    await resumeButton.click()
    await testPage.waitForTimeout(200)
    console.log('  ✓ Clicked resume button')

    // Trigger another event
    await testPage.click('#trigger-publish')
    await testPage.waitForTimeout(300)

    // Count should now be 2
    count = await getEventCount(testPage)
    expect(count).toBe(2)
    console.log('  ✓ Event captured after resume')
  })

  test('should clear all events', async ({ page }) => {
    console.log('🧪 Test: Clear all events')

    await openEventsDebugPage(testPage)
    const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')

    // Trigger multiple events
    await testPage.click('#trigger-all')
    await testPage.waitForTimeout(1000)

    let count = await getEventCount(testPage)
    expect(count).toBe(7)
    console.log(`  ✓ ${count} events captured`)

    // Click clear button
    const clearButton = frame.locator('button[title="Clear all events"]')
    await clearButton.click()
    await testPage.waitForTimeout(300)
    console.log('  ✓ Clicked clear button')

    // Verify empty state
    await expect(frame.locator('text=No events captured yet')).toBeVisible()
    console.log('  ✓ Empty state visible')

    count = await getEventCount(testPage)
    expect(count).toBe(0)
    console.log('  ✓ Event count is 0')
  })

  test('should display event data preview in cards', async ({ page }) => {
    console.log('🧪 Test: Event data preview')

    await openEventsDebugPage(testPage)

    // Trigger goal event with properties
    await testPage.click('#trigger-goal')
    await testPage.waitForTimeout(500)

    const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')
    const eventCard = frame.locator('.p-4.border.rounded-lg:has(span:has-text("goal"))').first()

    // Check that data preview is visible
    const dataPreview = eventCard.locator('.text-sm.text-gray-600.font-mono')
    await expect(dataPreview).toBeVisible()

    const previewText = await dataPreview.textContent()
    expect(previewText).toContain('conversion')
    expect(previewText).toContain('99.99')
    console.log('  ✓ Event data preview visible with correct content')
  })

  test('should show events in reverse chronological order', async ({ page }) => {
    console.log('🧪 Test: Event order')

    await openEventsDebugPage(testPage)

    // Trigger events in specific order
    await testPage.click('#trigger-ready')
    await testPage.waitForTimeout(100)
    await testPage.click('#trigger-refresh')
    await testPage.waitForTimeout(100)
    await testPage.click('#trigger-publish')
    await testPage.waitForTimeout(500)

    const events = await getEventsFromPanel(testPage)

    // Should be in reverse order (newest first)
    expect(events[0].eventName).toBe('publish')
    expect(events[1].eventName).toBe('refresh')
    expect(events[2].eventName).toBe('ready')
    console.log('  ✓ Events displayed in reverse chronological order')
  })

  test('should format timestamps correctly', async ({ page }) => {
    console.log('🧪 Test: Timestamp formatting')

    await openEventsDebugPage(testPage)

    await testPage.click('#trigger-ready')
    await testPage.waitForTimeout(500)

    const events = await getEventsFromPanel(testPage)
    expect(events.length).toBe(1)

    // Timestamp should be in HH:MM:SS.mmm format
    const timestampRegex = /\d{2}:\d{2}:\d{2}\.\d{3}/
    expect(events[0].timestamp).toMatch(timestampRegex)
    console.log(`  ✓ Timestamp formatted correctly: ${events[0].timestamp}`)
  })
})
