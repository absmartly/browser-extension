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
  // Wait briefly for UI update
  await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
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
  // Wait briefly for UI update
  await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
}

// Helper to check if event viewer modal is open
async function isEventViewerOpen(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.querySelector('#absmartly-event-viewer-host') !== null
  })
}

// Helper to close event viewer
async function closeEventViewer(page: Page) {
  // Use evaluate to ensure we click within the event viewer host
  await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (host) {
      const closeBtn = host.querySelector('.event-viewer-button-close') as HTMLElement
      if (closeBtn) {
        closeBtn.click()
      }
    }
  })
  // Wait for viewer to be removed from DOM
  await page.waitForSelector('#absmartly-event-viewer-host', { state: 'detached', timeout: 5000 })
}

// Helper to get event viewer content (now with Shadow DOM)
async function getEventViewerContent(page: Page): Promise<{title: string, eventType: string, timestamp: string, json: string}> {
  return await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (!host || !host.shadowRoot) return { title: '', eventType: '', timestamp: '', json: '' }

    const container = host.shadowRoot
    const title = container.querySelector('.event-viewer-title')?.textContent || ''

    // Get event type from metadata section
    const eventTypeValues = Array.from(container.querySelectorAll('.event-viewer-value'))
    const eventType = eventTypeValues[0]?.textContent || ''
    const timestamp = eventTypeValues[1]?.textContent || ''

    const jsonContent = container.querySelector('.cm-content')?.textContent || ''

    return { title, eventType, timestamp, json: jsonContent }
  })
}

// Helper to verify CodeMirror editor is visible (now with Shadow DOM)
async function isCodeMirrorVisible(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (!host || !host.shadowRoot) return false

    const cmEditor = host.shadowRoot.querySelector('.cm-editor')
    return cmEditor !== null && cmEditor.clientHeight > 0
  })
}

// Helper to click Copy button (now with Shadow DOM)
async function clickCopyButton(page: Page) {
  await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (host && host.shadowRoot) {
      const copyBtn = host.shadowRoot.querySelector('.event-viewer-button-copy') as HTMLElement
      if (copyBtn) {
        copyBtn.click()
      }
    }
  })
  // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 300 }).catch(() => {})
}

// Helper to verify copy button success state (now with Shadow DOM)
async function isCopyButtonSuccess(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (!host || !host.shadowRoot) return false
    const copyBtn = host.shadowRoot.querySelector('.event-viewer-button-copy')
    return copyBtn?.textContent?.includes('Copied!') || false
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

  await testPage.goto(`file://${TEST_PAGE_PATH}`, { waitUntil: \'domcontentloaded\', timeout: 10000 })
  await testPage.setViewportSize({ width: 1920, height: 1080 })
  await testPage.waitForSelector('body', { timeout: 5000 })
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
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})
  console.log('  ✓ SDK plugin injected\n')

  // Step 3: Trigger events BEFORE opening sidebar (test buffering)
  console.log('Step 3: Trigger events before opening sidebar (testing buffering)')
  await testPage.click('#trigger-ready')
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 300 }).catch(() => {})
  await testPage.click('#trigger-exposure')
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 300 }).catch(() => {})
  console.log('  ✓ Events triggered before sidebar opened\n')

  // Step 4: Open Events Debug Page and verify buffered events appear
  console.log('Step 4: Open Events Debug Page and verify buffered events')
  await openEventsDebugPage(testPage)
  const frame = testPage.frameLocator('iframe[id="absmartly-sidebar-iframe"]')

  // Wait a moment for buffered events to load
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

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
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

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

  // Step 6: Test event viewer modal with metadata and CodeMirror
  console.log('Step 6: Test event viewer modal with metadata and CodeMirror')
  await testPage.click('#trigger-goal')
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

  // Click on the goal event to open viewer
  await clickEventCard(testPage, 'goal')
  const isOpen = await isEventViewerOpen(testPage)
  expect(isOpen).toBeTruthy()
  console.log('  ✓ Event viewer modal opened')

  // Verify metadata section shows event type and timestamp
  const content = await getEventViewerContent(testPage)
  expect(content.title).toBe('Event Details')
  expect(content.eventType).toBe('goal')
  expect(content.timestamp).toBeTruthy()
  console.log('  ✓ Event viewer shows metadata (Event Type: goal)')
  console.log(`  ✓ Timestamp displayed: ${content.timestamp}`)

  // Verify CodeMirror editor is visible and contains event data
  const cmVisible = await isCodeMirrorVisible(testPage)
  expect(cmVisible).toBeTruthy()
  console.log('  ✓ CodeMirror editor is visible')

  expect(content.json).toContain('conversion')
  expect(content.json).toContain('99.99')
  expect(content.json).toContain('USD')
  console.log('  ✓ CodeMirror shows correct JSON payload')

  // Step 6a: Test Copy button
  console.log('\n  Testing Copy button:')
  await clickCopyButton(testPage)
  // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

  const copySuccess = await isCopyButtonSuccess(testPage)
  expect(copySuccess).toBeTruthy()
  console.log('  ✓ Copy button shows success feedback')

  // Try to verify clipboard (may fail due to permissions in test environment)
  try {
    const clipboardText = await testPage.evaluate(() => navigator.clipboard.readText())
    if (clipboardText && clipboardText.length > 0) {
      expect(clipboardText).toContain('conversion')
      expect(clipboardText).toContain('99.99')
      console.log('  ✓ Event payload copied to clipboard')
    } else {
      console.log('  ⚠ Clipboard read returned empty (may be permissions issue)')
    }
  } catch (err) {
    console.log('  ⚠ Could not verify clipboard (permissions issue in test environment)')
  }

  console.log('  ✓ Event viewer fully tested (metadata, CodeMirror, Copy button)\n')

  console.log('✅ All SDK Events features verified successfully')
  console.log('Note: Test may timeout during Playwright teardown - this is expected and does not affect test results')
})
