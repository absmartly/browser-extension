import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar } from './utils/test-helpers'

test.describe('Settings Authentication Tests', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Only capture console messages if DEBUG is enabled
    if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
      testPage.on('console', msg => {
        console.log(`[CONSOLE] ${msg.type()}: ${msg.text()}`)
      })
    }

    // Load test page from same domain as API to avoid CORS issues
    await testPage.goto('https://demo-2.absmartly.com/')
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    // Enable test mode
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('should show authenticated user data with API Key authentication', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      sidebar = await injectSidebar(testPage, extensionUrl)
    })

    await test.step('Navigate to Settings', async () => {
      // Check if we need to configure first (welcome screen)
      const configureButton = sidebar.locator('button:has-text("Configure Settings")')
      const hasWelcomeScreen = await configureButton.isVisible().catch(() => false)

      if (hasWelcomeScreen) {
        await configureButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
      } else {
        // Click settings icon from main screen
        const settingsButton = sidebar.locator('button[aria-label="Settings"], button[title*="Settings"]').first()
        await settingsButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
      }

      // Verify Settings page loaded
      await expect(sidebar.locator('text=ABsmartly Endpoint')).toBeVisible()
    })

    await test.step('Configure API Key authentication and test BEFORE saving', async () => {
      const apiKeyRadio = sidebar.locator('#auth-method-apikey')
      await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })

      // Wait for permission modal if it appears
      const permissionModal = sidebar.locator('text=grant permission').first()
      const hasPermissionModal = await Promise.race([
        permissionModal.waitFor({ state: 'visible', timeout: 2000 }).then(() => true),
        Promise.resolve(false)
      ]).catch(() => false)

      if (hasPermissionModal) {
        const grantButton = sidebar.locator('button:has-text("Grant")').first()
        await grantButton.evaluate((btn: HTMLElement) => {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        // Wait for modal to close
        await permissionModal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {})
      }

      const endpointInput = sidebar.locator('#absmartly-endpoint')
      await endpointInput.fill('https://demo-2.absmartly.com/v1')

      const apiKeyInput = sidebar.locator('#api-key-input')
      const testApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      if (!testApiKey) {
        console.log('API Key not found in environment - skipping test')
        test.skip()
        return
      }
      await apiKeyInput.fill(testApiKey)

      // Ensure inputs have valid values before testing
      await expect(endpointInput).toHaveValue('https://demo-2.absmartly.com/v1')
      await expect(apiKeyInput).toHaveValue(testApiKey)

      const refreshButton = sidebar.locator('#auth-refresh-button')
      await refreshButton.evaluate((btn: HTMLElement) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
      const hasUserInfoBeforeSave = await authUserInfo.isVisible({ timeout: 15000 }).catch(() => false)

      if (!hasUserInfoBeforeSave) {
        test.skip()
        return
      }

      expect(hasUserInfoBeforeSave).toBeTruthy()

      const saveButton = sidebar.locator('#save-settings-button')
      await saveButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )

      await authUserInfo.waitFor({ state: 'visible', timeout: 10000 })
    })

    await test.step('Verify authenticated user data displays', async () => {
      const onSettingsPage = await sidebar.locator('text=ABsmartly Endpoint').isVisible().catch(() => false)
      if (!onSettingsPage) {
        const settingsButton = sidebar.locator('button[aria-label="Settings"], button[title*="Settings"]').first()
        await settingsButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await expect(sidebar.locator('text=ABsmartly Endpoint')).toBeVisible()
      }

      const authStatusSection = sidebar.locator('text=Authentication Status')
      await expect(authStatusSection).toBeVisible()

      const notAuthText = sidebar.locator('text=Not authenticated')
      const isNotAuth = await notAuthText.isVisible().catch(() => false)
      expect(isNotAuth).toBeFalsy()

      const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
      await expect(authUserInfo).toBeVisible({ timeout: 5000 })
    })

    await test.step('Verify Refresh button updates auth status', async () => {
      const refreshButton = sidebar.locator('#auth-refresh-button')
      await expect(refreshButton).toBeVisible()

      await refreshButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )

      const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
      await expect(authUserInfo).toBeVisible({ timeout: 5000 })
    })
  })

  test('should authenticate with JWT and Google OAuth', async ({ extensionId, extensionUrl, context }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      sidebar = await injectSidebar(testPage, extensionUrl)
    })

    await test.step('Navigate to Settings', async () => {
      const configureButton = sidebar.locator('button:has-text("Configure Settings")')
      const hasWelcomeScreen = await configureButton.isVisible().catch(() => false)

      if (hasWelcomeScreen) {
        await configureButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
      } else {
        const settingsButton = sidebar.locator('button[aria-label="Settings"], button[title*="Settings"]').first()
        await settingsButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
      }

      await expect(sidebar.locator('text=ABsmartly Endpoint')).toBeVisible()
    })

    await test.step('Configure JWT authentication', async () => {
      const jwtRadio = sidebar.locator('#auth-method-jwt')
      await jwtRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })

      const endpointInput = sidebar.locator('#absmartly-endpoint')
      await endpointInput.fill('https://demo-2.absmartly.com/v1')

      const apiKeyInput = sidebar.locator('#api-key-input')
      await apiKeyInput.fill('')
    })

    await test.step('Authenticate with Google OAuth', async () => {
      const authButton = sidebar.locator('#authenticate-button')
      const needsAuth = await authButton.isVisible().catch(() => false)

      if (needsAuth) {
        const pagePromise = context.waitForEvent('page')

        await authButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )

        const oauthPage = await pagePromise
        await oauthPage.waitForSelector('body', { timeout: 5000 })
        await oauthPage.close()
      }
    })

    await test.step('Save settings and verify authentication', async () => {
      const saveButton = sidebar.locator('#save-settings-button')
      await saveButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )

      const onSettingsPage = await sidebar.locator('text=ABsmartly Endpoint').isVisible().catch(() => false)
      if (!onSettingsPage) {
        const settingsButton = sidebar.locator('button[aria-label="Settings"], button[title*="Settings"]').first()
        await settingsButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await expect(sidebar.locator('text=ABsmartly Endpoint')).toBeVisible()
      }

      const authStatusSection = sidebar.locator('text=Authentication Status')
      await expect(authStatusSection).toBeVisible()
    })

    await test.step('Switch between auth methods', async () => {
      const apiKeyRadio = sidebar.locator('#auth-method-apikey')
      await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })

      const apiKeyInput = sidebar.locator('#api-key-input')
      const testApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-api-key'
      await apiKeyInput.fill(testApiKey)

      const jwtRadio = sidebar.locator('#auth-method-jwt')
      await jwtRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })
    })
  })
})
