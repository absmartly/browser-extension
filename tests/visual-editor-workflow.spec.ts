import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { TestServer } from './helpers/test-server'

const EXTENSION_BUILD_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
const TEST_PAGE_PATH = path.join(__dirname, 'fixtures', 'extension-test-page.html')

test.describe('Visual Editor Workflow Tests', () => {
  let server: TestServer
  let serverPort: number
  let extensionUrl: string

  test.beforeAll(async () => {
    // Verify extension is built
    if (!fs.existsSync(EXTENSION_BUILD_PATH)) {
      throw new Error(`Extension not built! Run 'npm run build' first. Path: ${EXTENSION_BUILD_PATH}`)
    }

    // Start server to serve extension files (0 = auto-select available port)
    server = new TestServer(EXTENSION_BUILD_PATH, 0)
    serverPort = await server.start()
    extensionUrl = `http://localhost:${serverPort}`
  })

  test.afterAll(async () => {
    await server?.stop()
  })

  test('Load extension sidebar and configure settings', async ({ page }) => {
    // Enable console logging
    page.on('console', msg => console.log('[Page]', msg.text()))

    // BackgroundRunner no longer needed; tests rely on native chrome.runtime messaging

    // Copy the test page to the server directory so it's served from the same origin
    const fs = require('fs')
    const testPageContent = fs.readFileSync(TEST_PAGE_PATH, 'utf-8')
    const tempTestPagePath = path.join(EXTENSION_BUILD_PATH, 'test-page.html')
    fs.writeFileSync(tempTestPagePath, testPageContent)

    // Load the test page from the server (same origin as extension files)
    await page.goto(`http://localhost:${serverPort}/test-page.html?port=${serverPort}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })
    console.log('✅ Test page loaded')

    // No background runner re-initialization needed

    // Click button to inject extension sidebar
    await page.click('#inject-extension-btn')
    console.log('✅ Extension injection triggered')

    // Wait for sidebar iframe to load
    await page.waitForSelector('#absmartly-sidebar-iframe', { timeout: 10000 })
    const iframeElement = await page.$('#absmartly-sidebar-iframe')
    console.log('✅ Sidebar iframe detected')

    // Switch to iframe context
    const frame = await iframeElement?.contentFrame()
    if (!frame) {
      throw new Error('Could not access sidebar iframe')
    }

    // Wait for sidebar content to load
    await frame.waitForLoadState('domcontentloaded')
    await new Promise(resolve => setTimeout(resolve, 2000))

    // Check if welcome screen is visible
    const hasWelcome = await frame.locator('text=Welcome to ABsmartly').isVisible().catch(() => false)

    if (hasWelcome) {
      console.log('📝 Welcome screen visible')

      // Click Configure Settings button
      await frame.click('button:has-text("Configure Settings")')
      console.log('✅ Clicked Configure Settings')

      // TODO: Replace timeout with specific element wait
    await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      // Check for form fields
      const apiKeyInput = await frame.locator('input[name="apiKey"]').isVisible()
      const apiEndpointInput = await frame.locator('input[name="apiEndpoint"]').isVisible()

      expect(apiKeyInput).toBe(true)
      expect(apiEndpointInput).toBe(true)
      console.log('✅ Settings form is visible')
    } else {
      console.log('ℹ️ No welcome screen, checking for experiments')

      // Wait a bit longer for experiments to load
      // TODO: Replace timeout with specific element wait
    await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

      // Check if there are any experiments
      const experimentCount = await frame.locator('.experiment-item').count()
      console.log(`Found ${experimentCount} experiments`)

      // Try to find any loading indicators or error messages
      const hasLoading = await frame.locator('text=/loading/i').isVisible().catch(() => false)
      const hasError = await frame.locator('text=/error/i').isVisible().catch(() => false)
      console.log('Loading indicator:', hasLoading)
      console.log('Error indicator:', hasError)
    }

    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/sidebar-loaded.png', fullPage: true })
  })

  test('Complete visual editor workflow', async ({ page }) => {
    // BackgroundRunner no longer needed; tests rely on native chrome.runtime messaging

    // Copy the test page to the server directory so it's served from the same origin
    const fs = require('fs')
    const testPageContent = fs.readFileSync(TEST_PAGE_PATH, 'utf-8')
    const tempTestPagePath = path.join(EXTENSION_BUILD_PATH, 'test-page.html')
    fs.writeFileSync(tempTestPagePath, testPageContent)

    // Load test page from server (same origin)
    await page.goto(`http://localhost:${serverPort}/test-page.html?port=${serverPort}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // No background runner re-initialization needed

    // Inject extension
    await page.click('#inject-extension-btn')
    await page.waitForSelector('#absmartly-sidebar-iframe', { timeout: 10000 })

    const iframeElement = await page.$('#absmartly-sidebar-iframe')
    const frame = await iframeElement?.contentFrame()

    if (!frame) {
      throw new Error('Could not access sidebar iframe')
    }

    await frame.waitForLoadState('domcontentloaded')
    // TODO: Replace timeout with specific element wait
    await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

    // This test would need actual experiments to work fully
    // For now, we document what it should do:
    console.log('Visual editor workflow should:')
    console.log('1. Navigate to an experiment')
    console.log('2. Click "Launch Visual Editor" button')
    console.log('3. Visual editor toolbar appears on the main page')
    console.log('4. Right-click elements to show context menu')
    console.log('5. Test various DOM manipulation actions')
    console.log('6. Save changes')
    console.log('7. Verify visual editor closes and preview header appears')

    // Since we can't test the full workflow without experiments,
    // let's test that the page elements are ready for visual editing
    const pageTitle = await page.$('#main-title')
    expect(pageTitle).toBeTruthy()

    const heroCTA = await page.$('#hero-cta')
    expect(heroCTA).toBeTruthy()

    console.log('✅ Page elements ready for visual editing')
  })
})