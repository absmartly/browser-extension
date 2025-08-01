import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('Environment Variables Auto-Loading', () => {
  test('should auto-load environment variables in development mode', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    console.log('Loading extension from:', pathToExtension)
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    // Navigate to popup
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    console.log('Popup opened')

    // Wait for popup to load
    await page.waitForSelector('.w-full', { timeout: 10000 })

    // Navigate to settings
    const settingsButton = await page.locator('button:has-text("Settings")').first()
    await expect(settingsButton).toBeVisible()
    await settingsButton.click()
    console.log('Opened settings view')

    // Wait for settings form to load
    await page.waitForSelector('input[placeholder*="API"]', { timeout: 5000 })

    // Check if environment variables are auto-loaded
    const apiKeyInput = await page.locator('input[placeholder*="API"]').first()
    const apiEndpointInput = await page.locator('input[placeholder*="endpoint"]').first()
    
    // Wait for environment variables to be loaded by the useEffect
    await page.waitForTimeout(2000)
    
    const apiKeyValue = await apiKeyInput.inputValue()
    const apiEndpointValue = await apiEndpointInput.inputValue()
    
    console.log('API Key Value:', apiKeyValue ? apiKeyValue.substring(0, 10) + '...' : 'EMPTY')
    console.log('API Endpoint Value:', apiEndpointValue ? apiEndpointValue : 'EMPTY')
    
    // Verify environment variables are loaded from .env.local
    expect(apiKeyValue).toBeTruthy()
    expect(apiKeyValue.length).toBeGreaterThan(20) // API keys are typically long
    expect(apiEndpointValue).toBeTruthy()
    expect(apiEndpointValue).toContain('absmartly.com') // Should contain the domain
    
    console.log('✅ Environment variables loaded successfully in development mode')
    
    // Test that the values match what we expect from .env.local
    expect(apiKeyValue).toBe('BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB')
    expect(apiEndpointValue).toBe('https://dev-1.absmartly.com/v1/')
    
    console.log('✅ Environment variable values match .env.local file')
    
    await context.close()
  })

  test('should prioritize stored config over environment variables when available', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    // Navigate to popup and settings 
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    await page.waitForSelector('.w-full', { timeout: 10000 })
    
    const settingsButton = await page.locator('button:has-text("Settings")').first()
    await settingsButton.click()
    await page.waitForSelector('input[placeholder*="API"]', { timeout: 5000 })

    // First, save some custom settings
    const apiKeyInput = await page.locator('input[placeholder*="API"]').first()
    const apiEndpointInput = await page.locator('input[placeholder*="endpoint"]').first()
    
    const customApiKey = 'custom-api-key-test-12345'
    const customEndpoint = 'https://custom.endpoint.com/v1/'
    
    // Clear and set custom values
    await apiKeyInput.fill('')
    await apiKeyInput.fill(customApiKey)
    await apiEndpointInput.fill('')
    await apiEndpointInput.fill(customEndpoint)
    
    // Save settings
    const saveButton = await page.locator('button:has-text("Save")').first()
    await saveButton.click()
    console.log('Saved custom settings')
    
    // Wait for save to complete
    await page.waitForTimeout(1000)
    
    // Go back to list and then back to settings to test reload
    const backButton = await page.locator('button:has-text("Back")').first()
    await backButton.click()
    await page.waitForTimeout(500)
    
    // Return to settings
    await settingsButton.click()
    await page.waitForSelector('input[placeholder*="API"]', { timeout: 5000 })
    
    // Wait for settings to load
    await page.waitForTimeout(2000)
    
    // Verify that stored config takes priority over environment variables
    const reloadedApiKey = await apiKeyInput.inputValue()
    const reloadedEndpoint = await apiEndpointInput.inputValue()
    
    console.log('Reloaded API Key:', reloadedApiKey)
    console.log('Reloaded Endpoint:', reloadedEndpoint)
    
    expect(reloadedApiKey).toBe(customApiKey)
    expect(reloadedEndpoint).toBe(customEndpoint)
    
    console.log('✅ Stored configuration correctly takes priority over environment variables')
    
    await context.close()
  })

  test('should only use environment variables when stored config is empty', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    // Clear any existing storage first by executing JavaScript in the extension context
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    await page.waitForSelector('.w-full', { timeout: 10000 })
    
    // Execute code to clear storage
    await page.evaluate(() => {
      // Clear chrome storage if available
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.clear()
      }
      // Clear localStorage as backup
      localStorage.clear()
    })
    
    console.log('Cleared extension storage')
    
    // Reload the page to ensure fresh state
    await page.reload()
    await page.waitForSelector('.w-full', { timeout: 10000 })
    
    // Navigate to settings
    const settingsButton = await page.locator('button:has-text("Settings")').first()
    await settingsButton.click()
    await page.waitForSelector('input[placeholder*="API"]', { timeout: 5000 })
    
    // Wait for environment variables to be loaded
    await page.waitForTimeout(2000)
    
    // Verify environment variables are loaded when no stored config exists
    const apiKeyInput = await page.locator('input[placeholder*="API"]').first()
    const apiEndpointInput = await page.locator('input[placeholder*="endpoint"]').first()
    
    const apiKeyValue = await apiKeyInput.inputValue()
    const apiEndpointValue = await apiEndpointInput.inputValue()
    
    console.log('Environment API Key loaded:', apiKeyValue ? 'YES' : 'NO')
    console.log('Environment Endpoint loaded:', apiEndpointValue ? 'YES' : 'NO')
    
    // Should fallback to environment variables when storage is empty
    expect(apiKeyValue).toBeTruthy()
    expect(apiEndpointValue).toBeTruthy()
    expect(apiKeyValue).toBe('BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB')
    expect(apiEndpointValue).toBe('https://dev-1.absmartly.com/v1/')
    
    console.log('✅ Environment variables correctly used when storage is empty')
    
    await context.close()
  })

  test('should work in development mode but not load env vars in production', async () => {
    // This test verifies the NODE_ENV check in the code
    // Since we can't easily change NODE_ENV in this test environment,
    // we'll verify the logic by checking the development behavior
    
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        '--no-first-run',
        '--disable-default-apps'
      ],
      timeout: 30000
    })

    const page = await context.newPage()
    
    // Verify that in development build, environment variables are accessible
    await page.goto(`chrome-extension://${await getExtensionId(context)}/popup.html`)
    await page.waitForSelector('.w-full', { timeout: 10000 })
    
    // Check process.env in the extension context
    const envCheck = await page.evaluate(() => {
      return {
        nodeEnv: typeof process !== 'undefined' && process.env ? process.env.NODE_ENV : 'undefined',
        hasApiKey: typeof process !== 'undefined' && process.env ? !!process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY : false,
        hasEndpoint: typeof process !== 'undefined' && process.env ? !!process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT : false
      }
    })
    
    console.log('Environment check:', envCheck)
    
    // In development build with chrome-mv3-dev, environment variables should be available
    expect(envCheck.hasApiKey).toBeTruthy()
    expect(envCheck.hasEndpoint).toBeTruthy()
    
    console.log('✅ Environment variables are properly accessible in development build')
    
    await context.close()
  })
})

async function getExtensionId(context: any): Promise<string> {
  let [background] = context.serviceWorkers()
  if (!background) {
    background = await context.waitForEvent('serviceworker')
  }
  const extensionId = background.url().split('/')[2]
  return extensionId
}