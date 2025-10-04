import { test, expect, Page } from '@playwright/test'
import path from 'path'

const TEST_URL = 'http://localhost:8080'
const EXTENSION_PATH = path.join(__dirname, '../../build/chrome-mv3-dev')

test.describe('Events Debug Page', () => {
  let extensionId: string

  test.beforeEach(async ({ page, context }) => {
    // Load extension
    await test.step('Load extension', async () => {
      const extensions = context.backgroundPages()
      if (extensions.length > 0) {
        const background = extensions[0]
        extensionId = background.url().split('/')[2]
      }
    })

    // Navigate to test page
    await test.step('Navigate to test page', async () => {
      await page.goto(TEST_URL)
      await page.waitForLoadState('networkidle')
    })
  })

  test('opens Events Debug Page via toolbar button', async ({ page }) => {
    await test.step('Open extension sidebar', async () => {
      // Open sidebar by injecting and clicking the extension button
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)
    })

    await test.step('Click Events Debug button', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      // Find and click the bolt icon button
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await expect(eventsButton).toBeVisible({ timeout: 5000 })

      // Use dispatchEvent for headless mode compatibility
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      await page.waitForTimeout(500)
    })

    await test.step('Verify Events Debug Page is displayed', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=SDK Events')).toBeVisible()
      await expect(sidebar.locator('text=Event Details')).toBeVisible()
      await expect(sidebar.locator('text=No events captured yet')).toBeVisible()
      await expect(sidebar.locator('text=0 events captured')).toBeVisible()
    })
  })

  test('captures and displays SDK events in real-time', async ({ page }) => {
    await test.step('Open Events Debug Page', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Trigger SDK ready event', async () => {
      // Simulate SDK event via postMessage
      await page.evaluate(() => {
        window.postMessage({
          source: 'absmartly-page',
          type: 'SDK_EVENT',
          payload: {
            eventName: 'ready',
            data: { experiments: ['exp1', 'exp2'] },
            timestamp: new Date().toISOString()
          }
        }, '*')
      })
      await page.waitForTimeout(500)
    })

    await test.step('Verify event appears in list', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=ready')).toBeVisible()
      await expect(sidebar.locator('text=1 event captured')).toBeVisible()
    })

    await test.step('Trigger exposure event', async () => {
      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Verify both events displayed', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=exposure')).toBeVisible()
      await expect(sidebar.locator('text=2 events captured')).toBeVisible()

      // Verify newest first (exposure should appear before ready)
      const eventBadges = sidebar.locator('.px-2.py-1.text-xs.font-semibold.rounded')
      const firstEvent = eventBadges.first()
      await expect(firstEvent).toHaveText('exposure')
    })
  })

  test('displays event details when clicked', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page with event', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)

      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Click event to view details', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      const eventItem = sidebar.locator('text=exposure').first()
      await eventItem.evaluate((el) => {
        const container = el.closest('div[class*="cursor-pointer"]')
        if (container) {
          container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
      })
      await page.waitForTimeout(500)
    })

    await test.step('Verify event details displayed', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      // Check Event Type section
      await expect(sidebar.locator('text=Event Type')).toBeVisible()

      // Check Timestamp section
      await expect(sidebar.locator('text=Timestamp')).toBeVisible()

      // Check Event Data section
      await expect(sidebar.locator('text=Event Data')).toBeVisible()
      await expect(sidebar.locator('text="experiment"')).toBeVisible()
      await expect(sidebar.locator('text="test_exp"')).toBeVisible()
    })

    await test.step('Verify event is highlighted', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      const eventItem = sidebar.locator('text=exposure').first()
      const container = eventItem.locator('..')
      await expect(container).toHaveClass(/bg-blue-50/)
    })
  })

  test('pause and resume functionality', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Click pause button', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      const pauseButton = sidebar.locator('button[title="Pause"]')
      await expect(pauseButton).toBeVisible()
      await pauseButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Verify paused state', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=Event capture paused')).toBeVisible()
      await expect(sidebar.locator('button[title="Resume"]')).toBeVisible()
    })

    await test.step('Trigger event while paused', async () => {
      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Verify event not captured while paused', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=0 events captured')).toBeVisible()
      await expect(sidebar.locator('text=ready')).not.toBeVisible()
    })

    await test.step('Click resume button', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      const resumeButton = sidebar.locator('button[title="Resume"]')
      await resumeButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Verify resumed state', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=Event capture paused')).not.toBeVisible()
      await expect(sidebar.locator('button[title="Pause"]')).toBeVisible()
    })

    await test.step('Trigger event after resume', async () => {
      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Verify event captured after resume', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=exposure')).toBeVisible()
      await expect(sidebar.locator('text=1 event captured')).toBeVisible()
    })
  })

  test('clear events functionality', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page with events', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)

      // Add multiple events
      await page.evaluate(() => {
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
      await page.waitForTimeout(200)

      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Verify events exist', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=2 events captured')).toBeVisible()
    })

    await test.step('Click clear button', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      const clearButton = sidebar.locator('button[title="Clear all events"]')
      await expect(clearButton).toBeVisible()
      await clearButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Verify events cleared', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=No events captured yet')).toBeVisible()
      await expect(sidebar.locator('text=0 events captured')).toBeVisible()
      await expect(sidebar.locator('text=ready')).not.toBeVisible()
      await expect(sidebar.locator('text=exposure')).not.toBeVisible()
    })
  })

  test('displays color-coded event types', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Trigger different event types', async () => {
      const eventTypes = ['error', 'ready', 'refresh', 'publish', 'exposure', 'goal', 'finalize']

      for (const eventName of eventTypes) {
        await page.evaluate((name) => {
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
        await page.waitForTimeout(100)
      }

      await page.waitForTimeout(500)
    })

    await test.step('Verify all event types displayed', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=7 events captured')).toBeVisible()

      // Verify each event type appears
      const eventTypes = ['error', 'ready', 'refresh', 'publish', 'exposure', 'goal', 'finalize']
      for (const eventName of eventTypes) {
        await expect(sidebar.locator(`text=${eventName}`).first()).toBeVisible()
      }
    })

    await test.step('Verify color coding', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      // Check that different events have different color classes
      const errorBadge = sidebar.locator('text=error').first()
      await expect(errorBadge).toHaveClass(/text-red-600/)

      const readyBadge = sidebar.locator('text=ready').first()
      await expect(readyBadge).toHaveClass(/text-green-600/)

      const exposureBadge = sidebar.locator('text=exposure').first()
      await expect(exposureBadge).toHaveClass(/text-orange-600/)
    })
  })

  test('formats timestamps correctly', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page with event', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)

      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Verify timestamp format in list', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      // Should show time in HH:MM:SS.mmm format
      const timestamp = sidebar.locator('text=/\\d{2}:\\d{2}:\\d{2}\\.\\d{3}/')
      await expect(timestamp).toBeVisible()
    })

    await test.step('Click event and verify full timestamp in details', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      const eventItem = sidebar.locator('text=ready').first()
      await eventItem.evaluate((el) => {
        const container = el.closest('div[class*="cursor-pointer"]')
        if (container) {
          container.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        }
      })
      await page.waitForTimeout(500)

      // Should show full date/time
      await expect(sidebar.locator('text=/1\\/1\\/2025/')).toBeVisible()
    })
  })

  test('handles events without data', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Trigger event with null data', async () => {
      await page.evaluate(() => {
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
      await page.waitForTimeout(500)
    })

    await test.step('Verify event captured', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=finalize')).toBeVisible()
      await expect(sidebar.locator('text=1 event captured')).toBeVisible()
    })
  })

  test('ignores non-SDK events', async ({ page }) => {
    await test.step('Setup: Open Events Debug Page', async () => {
      await page.evaluate(() => {
        const event = new CustomEvent('absmartly-extension-open')
        window.dispatchEvent(event)
      })
      await page.waitForTimeout(1000)

      const sidebar = page.frameLocator('iframe[id*="plasmo"]')
      const eventsButton = sidebar.locator('button[aria-label="Events Debug"]')
      await eventsButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })
      await page.waitForTimeout(500)
    })

    await test.step('Send non-SDK event', async () => {
      await page.evaluate(() => {
        window.postMessage({
          source: 'other-source',
          type: 'SOME_EVENT',
          payload: {}
        }, '*')
      })
      await page.waitForTimeout(500)
    })

    await test.step('Verify event not captured', async () => {
      const sidebar = page.frameLocator('iframe[id*="plasmo"]')

      await expect(sidebar.locator('text=No events captured yet')).toBeVisible()
      await expect(sidebar.locator('text=0 events captured')).toBeVisible()
    })
  })
})
