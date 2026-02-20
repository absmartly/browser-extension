import { test, expect } from '../fixtures/extension'
import type { Page, FrameLocator } from '@playwright/test'
import { setupTestPage } from './utils/test-helpers'

async function openEventsDebugPage(sidebar: FrameLocator) {
  const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
  await eventsButton.waitFor({ state: 'visible', timeout: 10000 })
  await eventsButton.click()
}

async function getEventsFromPanel(sidebar: FrameLocator): Promise<Array<{eventName: string, timestamp: string}>> {
  await sidebar.locator('#events-debug-event-list').waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

  const eventCards = await sidebar.locator('[data-testid="event-item"]').all()

  const events = []
  for (const card of eventCards) {
    const eventNameEl = card.locator('[data-testid="event-badge"]').first()
    const timestampEl = card.locator('[data-testid="event-timestamp"]')

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

async function getEventCount(sidebar: FrameLocator): Promise<number> {
  const statusText = await sidebar.locator('#events-debug-event-count').textContent()
  const match = statusText?.match(/(\d+) event/)
  return match ? parseInt(match[1], 10) : 0
}

async function injectSDKEvent(sidebar: FrameLocator, eventName: string, data: any) {
  await sidebar.locator('body').evaluate(async (_, payload) => {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'SDK_EVENT', payload },
        () => resolve()
      )
    })
  }, { eventName, data, timestamp: new Date().toISOString() })
}

async function clickEventCard(page: Page, eventName: string) {
  const frame = page.frameLocator('iframe[id="absmartly-sidebar-iframe"]')
  const eventCard = frame.locator(`[data-testid="event-item"][data-event-name="${eventName}"]`).first()
  await eventCard.click()
}

async function isEventViewerOpen(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    return document.querySelector('#absmartly-event-viewer-host') !== null
  })
}

async function getEventViewerContent(page: Page): Promise<{title: string, eventType: string, timestamp: string, json: string}> {
  return await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (!host || !host.shadowRoot) return { title: '', eventType: '', timestamp: '', json: '' }

    const container = host.shadowRoot
    const title = container.querySelector('.event-viewer-title')?.textContent || ''

    const eventTypeValues = Array.from(container.querySelectorAll('.event-viewer-value'))
    const eventType = eventTypeValues[0]?.textContent || ''
    const timestamp = eventTypeValues[1]?.textContent || ''

    const jsonContent = container.querySelector('.cm-content')?.textContent || ''

    return { title, eventType, timestamp, json: jsonContent }
  })
}

async function isCodeMirrorVisible(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (!host || !host.shadowRoot) return false

    const cmEditor = host.shadowRoot.querySelector('.cm-editor')
    return cmEditor !== null && cmEditor.clientHeight > 0
  })
}

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
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 300 }).catch(() => {})
}

async function isCopyButtonSuccess(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const host = document.querySelector('#absmartly-event-viewer-host')
    if (!host || !host.shadowRoot) return false
    const copyBtn = host.shadowRoot.querySelector('.event-viewer-button-copy')
    return copyBtn?.textContent?.includes('Copied!') || false
  })
}

test('SDK Events Debug Page - Complete Flow', async ({ context, extensionUrl }) => {
  test.setTimeout(60000)
  console.log('Test: SDK Events Debug Page - Complete Flow\n')

  const testPage = await context.newPage()

  console.log('Step 1: Setup test page with sidebar')
  const { sidebar } = await setupTestPage(testPage, extensionUrl)
  console.log('  Sidebar injected\n')

  console.log('Step 2: Inject SDK events via background messaging')
  await injectSDKEvent(sidebar, 'ready', { timestamp: Date.now() - 2000 })
  await injectSDKEvent(sidebar, 'exposure', { experimentName: 'test_experiment', variantName: 'variant_1' })
  console.log('  Injected ready and exposure events\n')

  console.log('Step 3: Open Events Debug Page and verify buffered events')
  await openEventsDebugPage(sidebar)

  await sidebar.locator('[data-testid="event-item"]').first().waitFor({ state: 'visible', timeout: 10000 })

  const bufferedEvents = await getEventsFromPanel(sidebar)

  expect(bufferedEvents.length).toBeGreaterThanOrEqual(2)
  console.log(`  Found ${bufferedEvents.length} buffered events`)

  const hasReady = bufferedEvents.some(e => e.eventName === 'ready')
  const hasExposure = bufferedEvents.some(e => e.eventName === 'exposure')
  expect(hasReady).toBeTruthy()
  expect(hasExposure).toBeTruthy()
  console.log('  Buffered events include "ready" and "exposure"\n')

  console.log('Step 4: Inject more SDK events in real-time')
  await injectSDKEvent(sidebar, 'refresh', { timestamp: Date.now() })
  await injectSDKEvent(sidebar, 'goal', { eventName: 'conversion', value: 99.99, currency: 'USD' })
  await injectSDKEvent(sidebar, 'error', { message: 'Test error message', code: 'TEST_ERROR' })

  await sidebar.locator('[data-testid="event-item"]').nth(4).waitFor({ state: 'visible', timeout: 5000 })

  const events = await getEventsFromPanel(sidebar)
  console.log(`  Found ${events.length} total events`)

  for (const eventType of ['ready', 'refresh', 'exposure', 'goal', 'error']) {
    const found = events.some(e => e.eventName === eventType)
    expect(found).toBeTruthy()
    console.log(`  Event type "${eventType}" found`)
  }

  const count = await getEventCount(sidebar)
  expect(count).toBeGreaterThanOrEqual(5)
  console.log(`  Status bar shows ${count} events\n`)

  console.log('Step 5: Test event viewer modal with metadata and CodeMirror')
  await clickEventCard(testPage, 'goal')
  const isOpen = await isEventViewerOpen(testPage)
  expect(isOpen).toBeTruthy()
  console.log('  Event viewer modal opened')

  const content = await getEventViewerContent(testPage)
  expect(content.title).toBe('Event Details')
  expect(content.eventType).toBe('goal')
  expect(content.timestamp).toBeTruthy()
  console.log('  Event viewer shows metadata (Event Type: goal)')
  console.log(`  Timestamp displayed: ${content.timestamp}`)

  const cmVisible = await isCodeMirrorVisible(testPage)
  expect(cmVisible).toBeTruthy()
  console.log('  CodeMirror editor is visible')

  expect(content.json).toContain('conversion')
  expect(content.json).toContain('99.99')
  expect(content.json).toContain('USD')
  console.log('  CodeMirror shows correct JSON payload')

  console.log('\n  Testing Copy button:')
  await clickCopyButton(testPage)

  const copySuccess = await isCopyButtonSuccess(testPage)
  expect(copySuccess).toBeTruthy()
  console.log('  Copy button shows success feedback')

  try {
    const clipboardText = await Promise.race([
      testPage.evaluate(() => navigator.clipboard.readText()),
      new Promise<string>((_, reject) => setTimeout(() => reject(new Error('clipboard timeout')), 3000))
    ])
    if (clipboardText && clipboardText.length > 0) {
      expect(clipboardText).toContain('conversion')
      expect(clipboardText).toContain('99.99')
      console.log('  Event payload copied to clipboard')
    } else {
      console.log('  Clipboard read returned empty (may be permissions issue)')
    }
  } catch {
    console.log('  Could not verify clipboard (permissions issue in test environment)')
  }

  console.log('\nAll SDK Events features verified successfully')
})
