import { test, expect } from '../fixtures/extension'
import { injectSidebar, setupTestPage } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Claude API Key Authentication', () => {
  test('should display Claude API Key input in settings', async ({ context, extensionUrl }) => {
    const page = await context.newPage()

    // Load content page first, then inject sidebar
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // Navigate to settings
    const settingsButton = sidebar.locator('button:has-text("Settings"), a:has-text("Settings")').first()
    await settingsButton.click()

    // Verify Claude API Configuration section exists
    await expect(sidebar.locator('text=Claude API Configuration')).toBeVisible()

    // Verify API Key label is visible
    await expect(sidebar.locator('text=Claude API Key')).toBeVisible()

    // Verify API Key input field exists
    const apiKeyInput = sidebar.locator('input[placeholder*="sk-"]')
    await expect(apiKeyInput).toBeVisible()

    await page.close()
  })

  test('should allow entering and saving Claude API Key', async ({ context, extensionUrl }) => {
    const page = await context.newPage()

    // Load content page first, then inject sidebar
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // Navigate to settings
    const settingsButton = sidebar.locator('button:has-text("Settings"), a:has-text("Settings")').first()
    await settingsButton.click()

    // Enter an API key
    const apiKeyInput = sidebar.locator('input[placeholder*="sk-"]')
    await apiKeyInput.fill('sk-ant-test-key-12345678901234567890')

    // Save settings
    const saveButton = sidebar.locator('button:has-text("Save"), #save-settings-button').first()
    await saveButton.click()

    // Navigate back to settings to verify persistence
    await settingsButton.click()

    // Verify API key is still populated
    const savedApiKeyInput = sidebar.locator('input[placeholder*="sk-"]')
    await expect(savedApiKeyInput).toHaveValue('sk-ant-test-key-12345678901234567890')

    await page.close()
  })

  test('should persist Claude API Key across page reloads', async ({ context, extensionUrl }) => {
    const page = await context.newPage()

    // Load content page first, then inject sidebar
    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    // Navigate to settings
    const settingsButton = sidebar.locator('button:has-text("Settings"), a:has-text("Settings")').first()
    await settingsButton.click()

    // Enter an API key
    const apiKeyInput = sidebar.locator('input[placeholder*="sk-"]')
    await apiKeyInput.fill('sk-ant-persistent-key-123')

    // Save settings
    const saveButton = sidebar.locator('button:has-text("Save"), #save-settings-button').first()
    await saveButton.click()

    // Reload the page
    await page.reload()

    // Navigate to settings again
    const reloadedSidebar = page.frameLocator('#absmartly-sidebar-iframe')
    const reloadedSettingsButton = reloadedSidebar.locator('button:has-text("Settings"), a:has-text("Settings")').first()
    await reloadedSettingsButton.click()

    // Verify API key is still populated
    const savedApiKeyInput = reloadedSidebar.locator('input[placeholder*="sk-"]')
    await expect(savedApiKeyInput).toHaveValue('sk-ant-persistent-key-123')

    await page.close()
  })
})
