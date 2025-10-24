import { test, expect, chromium } from '@playwright/test'
import type { Page, BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Path to the built extension
const EXTENSION_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')

test.describe('Visual Editor Tests with Real Extension', () => {
  let context: BrowserContext
  let page: Page

  test.beforeAll(async () => {
    // Check if extension build exists
    if (!fs.existsSync(EXTENSION_PATH)) {
      throw new Error(`Extension not built. Run 'npm run build' first. Path: ${EXTENSION_PATH}`)
    }

    // Load the extension in a persistent context
    context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--enable-file-cookies',
        '--auto-open-devtools-for-tabs'
      ],
      slowMo: 500 // Slow down actions by 500ms
    })

    console.log('✅ Extension loaded')
  })

  test.afterAll(async () => {
    await context?.close()
  })

  test('Open extension popup and navigate to experiment', async () => {
    // Get extension ID
    let extensionId = ''
    const backgroundPages = context.backgroundPages()
    if (backgroundPages.length > 0) {
      const url = backgroundPages[0].url()
      extensionId = url.split('://')[1].split('/')[0]
      console.log('Extension ID:', extensionId)
    }

    // Open extension popup
    page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    console.log('✅ Extension popup opened')

    // Wait for either welcome page or experiment list
    const hasWelcome = await page.locator('text=Welcome to ABSmartly').isVisible().catch(() => false)

    if (hasWelcome) {
      console.log('📝 Configuring extension settings...')

      // Click configure button
      await page.click('button:has-text("Configure Settings")')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      // Fill in settings
      await page.fill('input[name="apiKey"]', 'test-api-key')
      await page.fill('input[name="apiEndpoint"]', 'https://api.absmartly.test')
      await page.fill('input[name="environment"]', 'test')

      // Save settings
      await page.click('button:has-text("Save Settings")')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      console.log('✅ Settings configured')
    }

    // Check if there are experiments
    const hasExperiments = await page.locator('.experiment-item').count() > 0

    if (hasExperiments) {
      console.log('📋 Found experiments in the list')

      // Click on first experiment
      await page.click('.experiment-item:first-child')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Look for Launch Visual Editor button
      const hasVisualEditorButton = await page.locator('button:has-text("Launch Visual Editor")').isVisible().catch(() => false)

      if (hasVisualEditorButton) {
        console.log('✅ Visual Editor button found')
        // Would click it here, but we need a real webpage for that
      }
    } else {
      console.log('ℹ️ No experiments found. Would need API connection to test further.')
    }

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/extension-popup.png' })
  })

  test('Test visual editor on real webpage', async () => {
    // Create a test page
    const testPage = await context.newPage()
    await testPage.goto('https://example.com', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    console.log('✅ Test page loaded')

    // Open extension popup in another tab
    let extensionId = ''
    const backgroundPages = context.backgroundPages()
    if (backgroundPages.length > 0) {
      const url = backgroundPages[0].url()
      extensionId = url.split('://')[1].split('/')[0]
    }

    const popupPage = await context.newPage()
    await popupPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`, { waitUntil: 'domcontentloaded', timeout: 10000 })

    // Here you would:
    // 1. Navigate to an experiment
    // 2. Click "Launch Visual Editor"
    // 3. Switch back to testPage
    // 4. Verify visual editor is loaded
    // 5. Test context menu actions

    console.log('📝 Would test visual editor functionality here with real extension')

    await testPage.screenshot({ path: 'test-results/test-page-with-extension.png' })
  })
})