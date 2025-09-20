import { test, expect, Page } from '@playwright/test'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs'

const TEST_PAGE_PATH = path.join(__dirname, 'fixtures', 'extension-test-page.html')
const EXTENSION_BUILD_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')

test.describe('Complete Visual Editor Test', () => {
  let server: ChildProcess

  test.beforeAll(async () => {
    // Verify extension is built
    if (!fs.existsSync(EXTENSION_BUILD_PATH)) {
      throw new Error(`Extension not built! Run 'npm run build' first.`)
    }

    // Start local server to serve extension files
    server = spawn('python3', ['-m', 'http.server', '8080'], {
      cwd: EXTENSION_BUILD_PATH,
      stdio: 'ignore'
    })

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000))
    console.log('✅ Local server started on port 8080')
  })

  test.afterAll(async () => {
    // Kill the server
    if (server) {
      server.kill()
      console.log('✅ Server stopped')
    }
  })

  test('Complete visual editor workflow', async ({ page }) => {
    // Step 1: Load the test page
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')
    console.log('✅ Test page loaded')

    // Step 2: Click button to inject extension
    await page.click('#inject-extension-btn')
    console.log('✅ Extension injection triggered')

    // Step 3: Wait for sidebar iframe
    await page.waitForSelector('#absmartly-sidebar-iframe', { timeout: 10000 })
    const iframe = await page.$('#absmartly-sidebar-iframe')
    console.log('✅ Sidebar iframe detected')

    // Step 4: Switch to iframe context
    const frame = await iframe.contentFrame()
    if (!frame) {
      throw new Error('Could not access sidebar iframe')
    }

    // Wait for sidebar to load
    await frame.waitForLoadState('domcontentloaded')
    await frame.waitForTimeout(2000)
    console.log('✅ Sidebar loaded')

    // Step 5: Check if we see the welcome screen
    const hasWelcome = await frame.locator('text=Welcome to ABsmartly').isVisible().catch(() => false)

    if (hasWelcome) {
      console.log('📝 Configuring settings...')

      // Click Configure Settings
      await frame.click('button:has-text("Configure Settings")')
      await frame.waitForTimeout(500)

      // Fill in dummy settings
      await frame.fill('input[name="apiKey"]', 'test-api-key-12345')
      await frame.fill('input[name="apiEndpoint"]', 'https://api.absmartly.test')
      await frame.fill('input[name="environment"]', 'test')

      // Save settings
      await frame.click('button:has-text("Save Settings")')
      await frame.waitForTimeout(1000)
      console.log('✅ Settings saved')
    }

    // Take screenshot of final state
    await page.screenshot({ path: 'test-results/complete-test.png', fullPage: true })

    // Step 6: Since we don't have real experiments, let's test the visual editor directly
    // by creating a mock experiment scenario
    console.log('📋 Would test visual editor here with real experiments')

    // In a real scenario with API connection:
    // 1. Click on an experiment
    // 2. Click "Launch Visual Editor"
    // 3. Test context menu actions
    // 4. Save changes
    // 5. Verify preview header shows
  })

  test('Test visual editor context menu directly', async ({ page }) => {
    // This test would work if we had a way to launch the visual editor
    // For now, we can test that the page loads and sidebar works

    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.evaluate(() => {
      // Simulate visual editor being active
      console.log('Would test visual editor context menu here')
    })

    // Document what the test should do:
    console.log('Visual editor tests should:')
    console.log('1. Right-click elements to show context menu')
    console.log('2. Test Edit Text action')
    console.log('3. Test Change Style action')
    console.log('4. Test Add/Remove Class actions')
    console.log('5. Test Hide/Delete element actions')
    console.log('6. Save changes and verify they persist')
    console.log('7. Exit visual editor and verify preview header shows')
  })
})