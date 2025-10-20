import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Verify Extension Loads', () => {
  test('Extension loads without bundle errors', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    console.log('Loading extension from:', pathToExtension)
    
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Wait for service worker
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker', { timeout: 10000 })
    }
    console.log('Service worker loaded:', background.url())
    
    const extensionId = background.url().split('/')[2]
    console.log('Extension ID:', extensionId)

    // Open popup
    const popup = await context.newPage()
    
    // Monitor for errors
    const errors: string[] = []
    popup.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
        console.error('POPUP ERROR:', msg.text())
      }
    })
    
    popup.on('pageerror', err => {
      errors.push(err.message)
      console.error('PAGE ERROR:', err.message)
    })
    
    // Navigate to popup
    await popup.goto(`chrome-extension://${extensionId}/popup.html`)
    await popup.waitForTimeout(2000)
    
    // Check for bundle errors
    const hasBundleError = errors.some(e => 
      e.includes('Could not resolve bundle') || 
      e.includes('2JQ4t')
    )
    
    if (hasBundleError) {
      console.error('CRITICAL: Bundle resolution error found!')
      console.error('All errors:', errors)
    }
    
    expect(hasBundleError).toBeFalsy()
    
    // Check page has content
    const bodyContent = await popup.locator('body').innerHTML()
    console.log('Body has content:', bodyContent.length > 0)
    expect(bodyContent.length).toBeGreaterThan(0)
    
    // Check for __plasmo div
    const plasmoDiv = await popup.locator('#__plasmo').isVisible()
    console.log('Plasmo div visible:', plasmoDiv)
    expect(plasmoDiv).toBeTruthy()
    
    // Check for any visible content
    const hasVisibleContent = await popup.locator('div').first().isVisible().catch(() => false)
    console.log('Has visible content:', hasVisibleContent)
    
    // Take screenshot
    await popup.screenshot({ path: 'tests/screenshots/extension-loaded.png' })
    
    console.log('\n✅ Extension loaded successfully without bundle errors!')
    
    await context.close()
  })
})