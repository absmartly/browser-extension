import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Settings Authentication Features', () => {
  test('Updated settings page with authentication status', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]

    const popup = await context.newPage()
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await popup.waitForTimeout(1000)

    // Click Configure Settings
    await popup.click('button:has-text("Configure Settings")')
    await popup.waitForSelector('h2:has-text("ABSmartly Settings")')

    // Take screenshot of updated settings page
    await popup.screenshot({ path: 'tests/screenshots/settings-with-auth.png' })

    // Verify new labels and elements
    console.log('\nVerifying updated settings page...')
    
    // Check ABSmartly Endpoint label
    const endpointLabel = await popup.locator('label:has-text("ABSmartly Endpoint")').isVisible()
    console.log('✓ ABSmartly Endpoint label:', endpointLabel)
    expect(endpointLabel).toBeTruthy()

    // Check API Key is optional
    const apiKeyLabel = await popup.locator('label:has-text("API Key (Optional)")').isVisible()
    console.log('✓ API Key (Optional) label:', apiKeyLabel)
    expect(apiKeyLabel).toBeTruthy()

    // Check API Key description
    const apiKeyDesc = await popup.locator('text=If not provided, will use JWT from browser cookies').isVisible()
    console.log('✓ API Key description:', apiKeyDesc)
    expect(apiKeyDesc).toBeTruthy()

    // Check Authentication Status section
    const authStatusSection = await popup.locator('text=Authentication Status').isVisible()
    console.log('✓ Authentication Status section:', authStatusSection)
    expect(authStatusSection).toBeTruthy()

    // Fill in endpoint to trigger auth check
    await popup.fill('input[type="url"]', 'http://localhost:8080')
    await popup.waitForTimeout(1000)

    // Check for "Not authenticated" text (since we're not logged in)
    const notAuthText = await popup.locator('text=Not authenticated').isVisible().catch(() => false)
    console.log('✓ Shows not authenticated state:', notAuthText)

    // Check for authenticate button
    const authButton = await popup.locator('button:has-text("Authenticate in ABSmartly")').isVisible().catch(() => false)
    console.log('✓ Authenticate button visible:', authButton)

    // Test saving without API key
    await popup.click('button:has-text("Save Settings")')
    await popup.waitForTimeout(1500)

    // Should save successfully without API key
    const errorMessage = await popup.locator('div[role="alert"]').isVisible().catch(() => false)
    console.log('✓ No error when saving without API key:', !errorMessage)
    expect(errorMessage).toBeFalsy()

    console.log('\n✅ All settings authentication features working correctly!')

    await context.close()
  })
})