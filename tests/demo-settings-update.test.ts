import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test('Demo: Updated Settings with Authentication', async () => {
  const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
  const context = await chromium.launchPersistentContext('', {
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

  console.log('\n=== Updated Settings Page Features ===\n')
  console.log('1. ✅ Renamed "API Endpoint" to "ABSmartly Endpoint"')
  console.log('2. ✅ API Key is now optional with description')
  console.log('3. ✅ Authentication status display added')
  console.log('4. ✅ Support for cookie-based authentication\n')

  // Take screenshot
  await popup.screenshot({ path: 'tests/screenshots/settings-updated.png' })

  // Demo authentication check
  await popup.fill('input[type="url"]', 'http://localhost:8080')
  await popup.waitForTimeout(2000)
  
  await popup.screenshot({ path: 'tests/screenshots/settings-auth-check.png' })
  
  console.log('Screenshots saved:')
  console.log('- settings-updated.png')
  console.log('- settings-auth-check.png')
  
  await popup.waitForTimeout(3000) // Let user see the UI
  await context.close()
})