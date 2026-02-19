import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Settings Authentication Tests', () => {
  test('should show authenticated user data with API Key authentication', async ({ context, extensionUrl, seedStorage }) => {
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey'
    })

    const page = await context.newPage()
    const { sidebar } = await setupTestPage(page, extensionUrl, TEST_PAGE_URL)

    const configureButton = sidebar.locator('#configure-settings-button')
    const hasWelcomeScreen = await configureButton.isVisible().catch(() => false)

    if (hasWelcomeScreen) {
      await configureButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    } else {
      const settingsButton = sidebar.locator('#nav-settings')
      await settingsButton.waitFor({ state: 'visible', timeout: 5000 })
      await settingsButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    }

    await expect(sidebar.locator('#absmartly-endpoint')).toBeVisible({ timeout: 5000 })

    const refreshButton = sidebar.locator('#auth-refresh-button')
    await refreshButton.waitFor({ state: 'visible', timeout: 5000 })
    await refreshButton.evaluate((btn: HTMLElement) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
    await authUserInfo.waitFor({ state: 'visible', timeout: 10000 })

    const authStatusSection = sidebar.locator('#authentication-status-heading')
    expect(await authStatusSection.isVisible()).toBeTruthy()
    expect(await authUserInfo.isVisible()).toBeTruthy()

    console.log('Authenticated user data displayed with API Key authentication')

    await page.close()
  })

  test('should switch between auth methods', async ({ context, extensionUrl, seedStorage }) => {
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey'
    })

    const page = await context.newPage()
    const { sidebar } = await setupTestPage(page, extensionUrl, TEST_PAGE_URL)

    const configureButton = sidebar.locator('#configure-settings-button')
    const hasWelcomeScreen = await configureButton.isVisible().catch(() => false)

    if (hasWelcomeScreen) {
      await configureButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    } else {
      const settingsButton = sidebar.locator('#nav-settings')
      await settingsButton.waitFor({ state: 'visible', timeout: 5000 })
      await settingsButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    }

    await expect(sidebar.locator('#absmartly-endpoint')).toBeVisible({ timeout: 5000 })

    const jwtRadio = sidebar.locator('#auth-method-jwt')
    await jwtRadio.evaluate((radio: HTMLInputElement) => {
      radio.click()
    })

    // In JWT mode, the API key label shows "(Optional)"
    const apiKeyInput = sidebar.locator('#api-key-input')
    await apiKeyInput.waitFor({ state: 'visible', timeout: 3000 })
    await sidebar.locator('#api-key-input').waitFor({ state: 'visible', timeout: 3000 })
    await expect(sidebar.locator('text=API Key (Optional)')).toBeVisible({ timeout: 3000 })
    console.log('JWT mode: API key labeled as Optional')

    const apiKeyRadio = sidebar.locator('#auth-method-apikey')
    await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
      radio.click()
    })

    // In API Key mode, the label shows "(Required)"
    await expect(sidebar.locator('text=API Key (Required)')).toBeVisible({ timeout: 3000 })
    console.log('API Key mode: API key labeled as Required')

    const testApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-api-key'
    await apiKeyInput.fill(testApiKey)

    await jwtRadio.evaluate((radio: HTMLInputElement) => {
      radio.click()
    })

    // Switching back to JWT mode, label changes back to "(Optional)"
    await expect(sidebar.locator('text=API Key (Optional)')).toBeVisible({ timeout: 3000 })
    console.log('Switching back to JWT: API key labeled as Optional again')

    const saveButton = sidebar.locator('#save-settings-button')
    await saveButton.waitFor({ state: 'visible', timeout: 5000 })
    await saveButton.evaluate((btn: HTMLElement) =>
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    )

    const authStatusSection = sidebar.locator('#authentication-status-heading')
    await expect(authStatusSection).toBeVisible({ timeout: 5000 })
    console.log('Auth status section visible after save')

    await page.close()
  })
})
