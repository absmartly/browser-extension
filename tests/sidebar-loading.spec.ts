import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import { TestServer } from './helpers/test-server'

const EXTENSION_BUILD_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
const TEST_PAGE_PATH = path.join(__dirname, 'fixtures', 'extension-test-page.html')

test.describe('Sidebar Loading Tests', () => {
  let server: TestServer
  let serverPort: number

  test.beforeAll(async () => {
    // Verify extension is built
    if (!fs.existsSync(EXTENSION_BUILD_PATH)) {
      throw new Error(`Extension not built! Run 'npm run build' first.`)
    }

    // Start server to serve extension files
    server = new TestServer(EXTENSION_BUILD_PATH, 0)
    serverPort = await server.start()
  })

  test.afterAll(async () => {
    await server?.stop()
  })

  test('Sidebar loads and can be toggled', async ({ page }) => {
    // Load test page
    await page.goto(`file://${TEST_PAGE_PATH}?port=${serverPort}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Click button to inject extension
    await page.click('#inject-extension-btn')

    // Wait for sidebar to appear
    await page.waitForSelector('#absmartly-sidebar-root', { timeout: 5000 })
    const sidebar = await page.$('#absmartly-sidebar-root')
    expect(sidebar).toBeTruthy()

    // Check sidebar is visible (transform is 0)
    const transform1 = await page.evaluate(() => {
      const sidebar = document.getElementById('absmartly-sidebar-root')
      return sidebar?.style.transform
    })
    expect(transform1).toBe('translateX(0px)')

    // Click button again to hide sidebar
    await page.click('#inject-extension-btn')
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    // Check sidebar is hidden (transform is 400px)
    const transform2 = await page.evaluate(() => {
      const sidebar = document.getElementById('absmartly-sidebar-root')
      return sidebar?.style.transform
    })
    expect(transform2).toBe('translateX(400px)')

    // Click button again to show sidebar
    await page.click('#inject-extension-btn')
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    // Check sidebar is visible again
    const transform3 = await page.evaluate(() => {
      const sidebar = document.getElementById('absmartly-sidebar-root')
      return sidebar?.style.transform
    })
    expect(transform3).toBe('translateX(0px)')
  })

  test('Sidebar iframe loads extension UI', async ({ page }) => {
    // Load test page
    await page.goto(`file://${TEST_PAGE_PATH}?port=${serverPort}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })

    // Click button to inject extension
    await page.click('#inject-extension-btn')

    // Wait for sidebar iframe
    await page.waitForSelector('#absmartly-sidebar-iframe', { timeout: 5000 })

    // Check iframe has correct src
    const iframeSrc = await page.evaluate(() => {
      const iframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
      return iframe?.src
    })
    expect(iframeSrc).toContain('/tabs/sidebar.html')

    // Get iframe content
    const iframeElement = await page.$('#absmartly-sidebar-iframe')
    const frame = await iframeElement?.contentFrame()

    if (frame) {
      // Wait for React app to load
      await frame.waitForLoadState('domcontentloaded')
      // TODO: Replace timeout with specific element wait
    await frame.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

      // Check for either welcome screen or experiment list
      const hasWelcome = await frame.locator('text=Welcome to ABsmartly').isVisible().catch(() => false)
      const hasSettings = await frame.locator('button:has-text("Configure Settings")').isVisible().catch(() => false)
      const hasExperimentList = await frame.locator('[class*="experiment"]').isVisible().catch(() => false)

      // At least one of these should be visible
      const hasContent = hasWelcome || hasSettings || hasExperimentList
      expect(hasContent).toBeTruthy()
    }
  })
})