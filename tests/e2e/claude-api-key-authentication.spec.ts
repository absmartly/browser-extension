import { test, expect } from '../fixtures/extension'
import { setupTestPage, injectSidebar } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Claude API Key Authentication', () => {
  test('should display AI API Key input in settings', async ({ context, extensionUrl }) => {
    const page = await context.newPage()

    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    const settingsButton = sidebar.locator('#nav-settings')
    await settingsButton.waitFor({ state: 'visible', timeout: 5000 })
    await settingsButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    const providerSelect = sidebar.locator('#ai-provider-select')
    await providerSelect.waitFor({ state: 'visible', timeout: 5000 })
    await expect(providerSelect).toBeVisible()

    await providerSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(apiKeyInput).toBeVisible()

    await page.close()
  })

  test('should allow entering and saving Claude API Key', async ({ context, extensionUrl }) => {
    const page = await context.newPage()

    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    const settingsButton = sidebar.locator('#nav-settings')
    await settingsButton.waitFor({ state: 'visible', timeout: 5000 })
    await settingsButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    const providerSelect = sidebar.locator('#ai-provider-select')
    await providerSelect.waitFor({ state: 'visible', timeout: 5000 })
    await providerSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiKeyInput.fill('sk-ant-test-key-12345678901234567890')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    await settingsButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    const savedApiKeyInput = sidebar.locator('#ai-api-key')
    await savedApiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(savedApiKeyInput).toHaveValue('sk-ant-test-key-12345678901234567890')

    await page.close()
  })

  test('should persist Claude API Key across page reloads', async ({ context, extensionUrl }) => {
    test.skip(true, 'Chrome extension storage persistence not available when sidebar is re-injected via injectSidebar after page reload')
    const page = await context.newPage()

    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    const settingsButton = sidebar.locator('#nav-settings')
    await settingsButton.waitFor({ state: 'visible', timeout: 5000 })
    await settingsButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    const providerSelect = sidebar.locator('#ai-provider-select')
    await providerSelect.waitFor({ state: 'visible', timeout: 5000 })
    await providerSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiKeyInput.fill('sk-ant-persistent-key-123')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    await page.reload({ waitUntil: 'domcontentloaded' })

    const reloadedSidebar = await injectSidebar(page, extensionUrl)

    const configureButton = reloadedSidebar.locator('#configure-settings-button')
    const reloadedSettingsButton = reloadedSidebar.locator('#nav-settings')
    const hasWelcome = await configureButton.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasWelcome) {
      await configureButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    } else {
      await reloadedSettingsButton.waitFor({ state: 'visible', timeout: 10000 })
      await reloadedSettingsButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    }

    const savedProviderSelect = reloadedSidebar.locator('#ai-provider-select')
    await savedProviderSelect.waitFor({ state: 'visible', timeout: 5000 })
    await savedProviderSelect.selectOption('anthropic-api')

    const savedApiKeyInput = reloadedSidebar.locator('#ai-api-key')
    await savedApiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(savedApiKeyInput).toHaveValue('sk-ant-persistent-key-123')

    await page.close()
  })
})
