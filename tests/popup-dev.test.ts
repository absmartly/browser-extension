import { test, expect, chromium, type BrowserContext } from '@playwright/test'
import path from 'path'

test.describe('Debug Dev Extension', () => {
  test('Check dev build errors', async () => {
    // Use dev build for better error messages
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
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
      if (msg.type() === 'error') {
        msg.args().forEach(async (arg, i) => {
          console.log(`  Arg ${i}:`, await arg.jsonValue())
        })
      }
    })
    
    // Listen for page errors
    page.on('pageerror', error => {
      console.log(`Page error: ${error.message}`)
      console.log(`Stack: ${error.stack}`)
    })
    
    const popupUrl = `chrome-extension://${extensionId}/popup.html`
    console.log('Navigating to:', popupUrl)
    
    await page.goto(popupUrl)
    await page.waitForTimeout(5000) // Wait longer for errors
    
    // Check page title
    const title = await page.title()
    console.log('Page title:', title)
    
    // Get full page HTML
    const html = await page.content()
    console.log('Full HTML:', html)
    
    // Check for any visible content
    const bodyText = await page.evaluate(() => document.body.innerText)
    console.log('Body text:', bodyText)
    
    await context.close()
  })
})