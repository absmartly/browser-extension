import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Debug Extension Loading', () => {
  test('Check extension popup errors', async () => {
    // Launch Chrome with the extension
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-prod')
    const context = await chromium.launchPersistentContext('', {
      headless: true,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Get the extension ID
    let [background] = context.serviceWorkers()
    if (!background) {
      background = await context.waitForEvent('serviceworker')
    }
    const extensionId = background.url().split('/')[2]
    console.log('Extension ID:', extensionId)

    // Open popup
    const page = await context.newPage()
    
    // Listen for console messages
    page.on('console', msg => {
      console.log(`Console ${msg.type()}: ${msg.text()}`)
    })
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log(`Page error: ${error.message}`)
    })
    
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    console.log('Navigating to:', popupUrl)
    
    await page.goto(popupUrl)
    await page.waitForTimeout(3000) // Wait for any errors to appear
    
    // Check if React root exists
    const reactRoot = await page.evaluate(() => {
      const root = document.getElementById('__plasmo')
      return {
        exists: !!root,
        innerHTML: root?.innerHTML || 'no root',
        childNodes: root?.childNodes.length || 0
      }
    })
    console.log('React root:', reactRoot)
    
    // Check if scripts loaded
    const scripts = await page.evaluate(() => {
      return Array.from(document.scripts).map(s => ({
        src: s.src,
        loaded: (s as any).readyState === 'complete' || !(s as any).readyState
      }))
    })
    console.log('Scripts:', scripts)
    
    // Take screenshot
    await page.screenshot({ path: 'tests/screenshots/debug-popup.png' })
    
    // Get page content
    const content = await page.content()
    console.log('Page content length:', content.length)
    console.log('Body content:', await page.evaluate(() => document.body.innerHTML))
    
    await context.close()
  })
})