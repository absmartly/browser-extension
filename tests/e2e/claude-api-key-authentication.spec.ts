import { test, expect } from '../fixtures/extension'
import { setupTestPage, injectSidebar } from './utils/test-helpers'
import type { FrameLocator } from '@playwright/test'

const TEST_PAGE_URL = '/visual-editor-test.html'

// SettingsView's `loading` flag stays true while useSettingsForm.loadConfig
// runs — and that path awaits checkAuthStatus(), which under workers=4 +
// prod-bundle CI can exceed 5s. While loading is true the AI provider
// section isn't rendered, so #ai-provider-select waits time out.
async function openSettings(sidebar: FrameLocator): Promise<void> {
  const settingsButton = sidebar.locator('#nav-settings')
  await settingsButton.waitFor({ state: 'visible', timeout: 5000 })
  await settingsButton.evaluate((btn: HTMLElement) =>
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  )
  await sidebar
    .locator('[aria-label="Loading settings"]')
    .waitFor({ state: 'hidden', timeout: 15000 })
    .catch(() => {})
}

test.describe('Claude API Key Authentication', () => {
  test('should display AI API Key input in settings', async ({ context, extensionUrl, seedStorage }) => {
    // Same explicit seed as the other two tests so vibeStudioEnabled is
    // present and the AI section renders deterministically under workers=4.
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-config': {
        apiKey: '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
        authMethod: 'apikey',
        vibeStudioEnabled: true,
        domChangesFieldName: '__dom_changes'
      }
    })

    const page = await context.newPage()

    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    await openSettings(sidebar)

    const providerSelect = sidebar.locator('#ai-provider-select')
    await providerSelect.waitFor({ state: 'visible', timeout: 5000 })
    await expect(providerSelect).toBeVisible()

    await providerSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(apiKeyInput).toBeVisible()

    await page.close()
  })

  test('should allow entering and saving Claude API Key', async ({ context, extensionUrl, seedStorage }) => {
    // Same rationale as test #69 below: seed the new-format config
    // explicitly so vibeStudioEnabled is set and the SettingsView "API key
    // required" validator has a value. The shared fixture seeds these too,
    // but Plasmo Storage's prod-build serialization can race the test
    // setup under workers=4 — be explicit.
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-config': {
        apiKey: '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
        authMethod: 'apikey',
        vibeStudioEnabled: true,
        domChangesFieldName: '__dom_changes'
      }
    })

    const page = await context.newPage()

    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    await openSettings(sidebar)

    // The shared seed should already populate the absmartly apiKey field,
    // but under workers=4 the form's loadConfig race occasionally leaves
    // it blank. Fill explicitly so validateForm passes deterministically.
    const absmartlyApiKeyField = sidebar.locator('#api-key-input')
    if (await absmartlyApiKeyField.isVisible({ timeout: 5000 }).catch(() => false)) {
      const currentValue = await absmartlyApiKeyField.inputValue()
      if (!currentValue) {
        await absmartlyApiKeyField.fill(process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB')
      }
    }

    const providerSelect = sidebar.locator('#ai-provider-select')
    await providerSelect.waitFor({ state: 'visible', timeout: 5000 })
    await providerSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiKeyInput.fill('sk-ant-test-key-12345678901234567890')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    // Save runs validateForm + validateEndpointReachable (which round-trips
    // through the background SW and can take 5-15s under workers=4). Only
    // after that does it navigate back to list view. Generous ceiling here.
    await sidebar.locator('#nav-settings').waitFor({ state: 'visible', timeout: 30000 })

    await openSettings(sidebar)

    const savedApiKeyInput = sidebar.locator('#ai-api-key')
    await savedApiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await expect(savedApiKeyInput).toHaveValue('sk-ant-test-key-12345678901234567890')

    await page.close()
  })

  test('should persist Claude API Key across page reloads', async ({ context, extensionUrl, seedStorage }) => {
    // Previous tests in this file seed via the legacy `absmartly-apikey` /
    // `absmartly-endpoint` keys that seed.js converts to a partial config.
    // That conversion omits `vibeStudioEnabled`, which gates the AI provider
    // section in SettingsView — so #ai-provider-select never rendered and
    // the test timed out waiting for it. Seed the new-format config
    // directly with vibeStudioEnabled=true so the AI section shows up.
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-config': {
        apiKey: '',
        apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
        authMethod: 'apikey',
        vibeStudioEnabled: true,
        domChangesFieldName: '__dom_changes'
      }
    })

    const page = await context.newPage()

    await setupTestPage(page, extensionUrl, TEST_PAGE_URL)
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')

    await openSettings(sidebar)

    // Same defensive fill as test #58 — the seeded apiKey may not always
    // propagate into the form's apiKey state under workers=4.
    const absmartlyApiKeyField = sidebar.locator('#api-key-input')
    if (await absmartlyApiKeyField.isVisible({ timeout: 5000 }).catch(() => false)) {
      const currentValue = await absmartlyApiKeyField.inputValue()
      if (!currentValue) {
        await absmartlyApiKeyField.fill(process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB')
      }
    }

    const providerSelect = sidebar.locator('#ai-provider-select')
    await providerSelect.waitFor({ state: 'visible', timeout: 5000 })
    await providerSelect.selectOption('anthropic-api')

    const apiKeyInput = sidebar.locator('#ai-api-key')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 5000 })
    await apiKeyInput.fill('sk-ant-persistent-key-123')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.click()

    // Wait for save to complete - same logic as test #58: validateEndpointReachable
    // can take 10s+ under workers=4. After that, view goes to list/welcome.
    await sidebar.locator('#experiments-heading, [data-testid="experiment-list"], #configure-settings-button').first().waitFor({ state: 'visible', timeout: 30000 })

    await page.reload({ waitUntil: 'domcontentloaded' })

    const reloadedSidebar = await injectSidebar(page, extensionUrl)

    const configureButton = reloadedSidebar.locator('#configure-settings-button')
    const hasWelcome = await configureButton.isVisible({ timeout: 3000 }).catch(() => false)

    if (hasWelcome) {
      await configureButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
      await reloadedSidebar
        .locator('[aria-label="Loading settings"]')
        .waitFor({ state: 'hidden', timeout: 15000 })
        .catch(() => {})
    } else {
      await openSettings(reloadedSidebar)
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
