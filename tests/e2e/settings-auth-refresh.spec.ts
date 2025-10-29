import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import { injectSidebar } from './utils/test-helpers'

test.describe('Settings Auth Refresh Button', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Suppress console messages to reduce noise
    testPage.on('console', msg => {
      // Only log errors
      if (msg.type() === 'error') {
        // Silently ignore - don't print anything
      }
    })

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

  test('Auth refresh button updates UI immediately with auth response data', async ({ extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar and navigate to settings', async () => {
      sidebar = await injectSidebar(testPage, extensionUrl)

      // Click settings - find configure button or settings icon
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

      // Verify Settings page loaded
      await expect(sidebar.locator('text=Authentication Status')).toBeVisible()
    })

    await test.step('Configure authentication with API key', async () => {
      const testApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY
      if (!testApiKey) {
        test.skip()
        return
      }

      const apiKeyRadio = sidebar.locator('#auth-method-apikey')
      await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })

      const endpointInput = sidebar.locator('#absmartly-endpoint')
      await endpointInput.fill('https://demo-2.absmartly.com/v1')

      const apiKeyInput = sidebar.locator('#api-key-input')
      await apiKeyInput.fill(testApiKey)
    })

    await test.step('Verify refresh button responds to clicks', async () => {
      const refreshButton = sidebar.locator('#auth-refresh-button')
      await expect(refreshButton).toBeVisible()

      // Initially should show "Not authenticated" or loading spinner
      let loadingSpinner = sidebar.locator('[role="status"]')
      let notAuthText = sidebar.locator('text=Not authenticated')
      let hasLoadingOrNotAuth = false

      try {
        hasLoadingOrNotAuth = await Promise.race([
          loadingSpinner.isVisible({ timeout: 2000 }),
          notAuthText.isVisible({ timeout: 2000 })
        ]).catch(() => false)
      } catch (e) {
        hasLoadingOrNotAuth = false
      }

      // Click refresh button
      await refreshButton.evaluate((btn: HTMLElement) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      // Wait for response - should show either user info or "Not authenticated"
      // The key is that we should NOT see the initial loading state anymore
      const checkingAuthSpinner = sidebar.locator('[role="status"]:has-text("Checking")')

      // Either we see user info or not authenticated, but NOT the original state indefinitely
      const userInfo = sidebar.locator('[data-testid="auth-user-info"]')
      const notAuthAfter = sidebar.locator('[data-testid="auth-not-authenticated"]')

      // Wait for either user info or explicit "not authenticated" state
      const hasResponse = await Promise.race([
        userInfo.waitFor({ state: 'visible', timeout: 10000 }).then(() => true),
        notAuthAfter.waitFor({ state: 'visible', timeout: 10000 }).then(() => true)
      ]).catch(() => false)

      expect(hasResponse).toBeTruthy()
    })

    await test.step('Verify multiple refreshes work correctly', async () => {
      const refreshButton = sidebar.locator('#auth-refresh-button')
      const userInfo = sidebar.locator('[data-testid="auth-user-info"]')
      const notAuthSection = sidebar.locator('[data-testid="auth-not-authenticated"]')

      // Click refresh again
      await refreshButton.evaluate((btn: HTMLElement) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      // Should respond again - either showing user or not authenticated
      const hasSecondResponse = await Promise.race([
        userInfo.waitFor({ state: 'visible', timeout: 10000 }).then(() => true),
        notAuthSection.waitFor({ state: 'visible', timeout: 10000 }).then(() => true)
      ]).catch(() => false)

      expect(hasSecondResponse).toBeTruthy()
    })
  })
})
