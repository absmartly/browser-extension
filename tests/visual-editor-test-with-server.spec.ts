import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

test.describe('Visual Editor Tests with Local Server', () => {
  test('Load sidebar through local server', async ({ page }) => {
    // Load the sidebar directly from the local server
    await page.goto('http://localhost:8080/tabs/sidebar.html', { waitUntil: 'domcontentloaded', timeout: 10000 })

    // Wait for the sidebar to load
    await page.waitForSelector('body', { timeout: 5000 })

    // Check if the sidebar content is loaded
    const hasContent = await page.locator('#__plasmo').isVisible().catch(() => false)
    console.log('Sidebar container visible:', hasContent)

    // Wait a bit for React to render
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

    // Check for any visible text
    const bodyText = await page.textContent('body')
    console.log('Body text:', bodyText)

    // Take screenshot
    await page.screenshot({ path: 'test-results/sidebar-server.png', fullPage: true })

    // Check for welcome screen or experiment list
    const hasWelcome = await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false)
    const hasSettings = await page.locator('text=Configure Settings').isVisible().catch(() => false)
    const hasExperiments = await page.locator('.experiment-item').count() > 0

    console.log('Has welcome:', hasWelcome)
    console.log('Has settings:', hasSettings)
    console.log('Has experiments:', hasExperiments)

    // Try to check for any error messages
    const errors = await page.locator('.error, [class*="error"]').allTextContents().catch(() => [])
    if (errors.length > 0) {
      console.log('Error messages found:', errors)
    }

    // Check console for errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text())
      }
    })

    // Check network for failed requests
    page.on('requestfailed', request => {
      console.log('Failed request:', request.url())
    })

    // Wait a bit more
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})
  })
})