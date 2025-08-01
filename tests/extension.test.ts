import { test, expect, chromium } from '@playwright/test'
import path from 'path'

test.describe('ABSmartly Extension Tests', () => {
  test('Extension loads and popup opens', async () => {
    // Launch Chrome with the extension
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
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
    
    // Navigate to the extension popup
    const page = await context.newPage()
    await page.goto(`chrome-extension://${extensionId}/popup.html`)
    
    // Check if popup loads
    await expect(page.locator('h1')).toContainText('ABSmartly')
    
    // Check for settings button
    const settingsButton = page.locator('button[aria-label="Settings"]')
    await expect(settingsButton).toBeVisible()
    
    // Click settings
    await settingsButton.click()
    
    // Check settings view loads
    await expect(page.locator('h2')).toContainText('ABSmartly Settings')
    
    await context.close()
  })

  test('Visual editor content script works', async () => {
    const pathToExtension = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`
      ]
    })

    // Navigate to a test page
    const page = await context.newPage()
    await page.goto('https://example.com')
    
    // Wait for content script to load
    await page.waitForTimeout(2000)
    
    // Check if visual editor button is injected
    const visualEditorButton = page.locator('#absmartly-visual-editor-button')
    await expect(visualEditorButton).toBeVisible()
    
    // Click visual editor button
    await visualEditorButton.click()
    
    // Check if visual editor panel opens
    const editorPanel = page.locator('#absmartly-visual-editor')
    await expect(editorPanel).toBeVisible()
    
    await context.close()
  })
})