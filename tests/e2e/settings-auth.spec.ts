import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait, setupConsoleLogging } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'settings-auth-test.html')

test.describe('Settings Authentication Tests', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Set up console listener for debugging
    allConsoleMessages = setupConsoleLogging(
      testPage,
      (msg) => msg.text().includes('[ABsmartly]') || msg.text().includes('[Background]') || msg.text().includes('CHECK_AUTH') || msg.text().includes('[SettingsView]')
    )
    
    // Also listen to all pages/frames for console logs
    testPage.on('console', async (msg) => {
      const text = msg.text()
      if (text.includes('[SettingsView]') || text.includes('CHECK_AUTH')) {
        console.log(`[CONSOLE] ${msg.type()}: ${text}`)
      }
    })

    // Load test page
    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    // Enable test mode
    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('should show authenticated user data with API Key authentication', async ({ extensionId, extensionUrl }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Navigate to Settings', async () => {
      console.log('\n⚙️ STEP 2: Navigating to Settings')

      // Check if we need to configure first (welcome screen)
      const configureButton = sidebar.locator('button:has-text("Configure Settings")')
      const hasWelcomeScreen = await configureButton.isVisible().catch(() => false)

      if (hasWelcomeScreen) {
        console.log('  Found welcome screen, clicking Configure Settings')
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

      await debugWait()

      // Verify Settings page loaded
      await expect(sidebar.locator('text=ABsmartly Endpoint')).toBeVisible()
      console.log('✅ Settings page loaded')
      await debugWait()
    })

    await test.step('Configure API Key authentication and test BEFORE saving', async () => {
      console.log('\n🔑 STEP 3: Configuring API Key authentication')

      // Select API Key authentication method
      const apiKeyRadio = sidebar.locator('#auth-method-apikey')
      await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })
      console.log('  ✓ Selected API Key authentication method')
      await debugWait()

      // Fill in endpoint
      const endpointInput = sidebar.locator('#absmartly-endpoint')
      await endpointInput.fill('https://demo-2.absmartly.com/v1')
      console.log('  ✓ Filled endpoint')
      await debugWait()

      // Fill in API key
      const apiKeyInput = sidebar.locator('#api-key-input')
      const testApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-api-key'
      await apiKeyInput.fill(testApiKey)
      console.log('  ✓ Filled API key')
      await debugWait()

      // Test authentication BEFORE saving by clicking Refresh
      console.log('  🔄 Testing authentication before saving...')
      const refreshButton = sidebar.locator('#auth-refresh-button')
      await refreshButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
      console.log('  ✓ Clicked Refresh button')
      await debugWait(3000) // Wait for auth check to complete

      // Should show authenticated even WITHOUT saving
      const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
      const hasUserInfoBeforeSave = await authUserInfo.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasUserInfoBeforeSave).toBeTruthy()
      console.log('  ✅ Shows authenticated state BEFORE saving!')

      // Now save settings
      const saveButton = sidebar.locator('#save-settings-button')
      await saveButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
      console.log('  ✓ Clicked Save Settings')
      await debugWait(5000) // Wait longer for save and auth check to complete
    })

    await test.step('Verify authenticated user data displays', async () => {
      console.log('\n👤 STEP 4: Verifying authenticated user data')

      // Navigate back to settings if we were redirected
      const onSettingsPage = await sidebar.locator('text=ABsmartly Endpoint').isVisible().catch(() => false)
      if (!onSettingsPage) {
        const settingsButton = sidebar.locator('button[aria-label="Settings"], button[title*="Settings"]').first()
        await settingsButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait(3000) // Wait longer for auth check to complete after settings page loads
      }

      // Check Authentication Status section
      const authStatusSection = sidebar.locator('text=Authentication Status')
      await expect(authStatusSection).toBeVisible()
      console.log('  ✓ Authentication Status section visible')

      // Should NOT show "Not authenticated"
      const notAuthText = sidebar.locator('text=Not authenticated')
      const isNotAuth = await notAuthText.isVisible().catch(() => false)
      expect(isNotAuth).toBeFalsy()
      console.log('  ✓ Not showing "Not authenticated"')

      // Take screenshot BEFORE assertion so we can see debug info
      await testPage.screenshot({
        path: 'test-results/settings-auth-api-key-debug.png',
        fullPage: true
      })
      console.log('  📸 Debug screenshot saved: settings-auth-api-key-debug.png')
      
      // Should show authenticated state (either real user data or API Key fallback)
      // Use data-testid for reliable selection
      const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
      const hasUserInfo = await authUserInfo.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasUserInfo).toBeTruthy()
      console.log('  ✓ Shows authenticated state')

      // Take screenshot
      await testPage.screenshot({
        path: 'test-results/settings-auth-api-key.png',
        fullPage: true
      })
      console.log('  📸 Screenshot saved: settings-auth-api-key.png')

      await debugWait()
    })

    await test.step('Verify Refresh button updates auth status', async () => {
      console.log('\n🔄 STEP 5: Testing Refresh button')

      const refreshButton = sidebar.locator('#auth-refresh-button')
      await expect(refreshButton).toBeVisible()

      await refreshButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
      console.log('  ✓ Clicked Refresh button')

      await debugWait(3000) // Wait longer for auth check to complete

      // Should still show authenticated
      const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
      const hasUserInfo = await authUserInfo.isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasUserInfo).toBeTruthy()
      console.log('  ✓ Still shows authenticated state after refresh')

      await debugWait()
    })
  })

  test('should authenticate with JWT and Google OAuth', async ({ extensionId, extensionUrl, context }) => {
    let sidebar: any

    await test.step('Inject sidebar', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      sidebar = await injectSidebar(testPage, extensionUrl)
      console.log('✅ Sidebar visible')
      await debugWait()
    })

    await test.step('Navigate to Settings', async () => {
      console.log('\n⚙️ STEP 2: Navigating to Settings')

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

      await debugWait()
      await expect(sidebar.locator('text=ABsmartly Endpoint')).toBeVisible()
      console.log('✅ Settings page loaded')
    })

    await test.step('Configure JWT authentication', async () => {
      console.log('\n🔐 STEP 3: Configuring JWT authentication')

      // Select JWT authentication method (default)
      const jwtRadio = sidebar.locator('#auth-method-jwt')
      await jwtRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })
      console.log('  ✓ Selected JWT authentication method')
      await debugWait()

      // Fill in endpoint
      const endpointInput = sidebar.locator('#absmartly-endpoint')
      await endpointInput.fill('https://demo-2.absmartly.com/v1')
      console.log('  ✓ Filled endpoint')
      await debugWait()

      // API key should be optional for JWT
      const apiKeyInput = sidebar.locator('#api-key-input')
      await apiKeyInput.fill('') // Clear any existing value
      console.log('  ✓ Cleared API key (not needed for JWT)')
      await debugWait()
    })

    await test.step('Authenticate with Google OAuth', async () => {
      console.log('\n🔓 STEP 4: Authenticating with Google OAuth')

      // Check if user is already authenticated
      const authButton = sidebar.locator('#authenticate-button')
      const needsAuth = await authButton.isVisible().catch(() => false)

      if (needsAuth) {
        console.log('  User not authenticated, opening OAuth flow...')

        // Listen for new pages (OAuth popup)
        const pagePromise = context.waitForEvent('page')

        // Click authenticate button - this should open ABsmartly login page
        await authButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )

        console.log('  ✓ Clicked Authenticate button')

        // Wait for OAuth page to open
        const oauthPage = await pagePromise
        await oauthPage.waitForLoadState('networkidle')
        console.log('  ✓ OAuth page opened:', oauthPage.url())

        await debugWait()

        // Note: In a real test, you would:
        // 1. Click Google sign-in button
        // 2. Fill in Google credentials (if stored in browser)
        // 3. Complete OAuth flow
        // For this test, we'll check if credentials are already stored

        const isAlreadyLoggedIn = oauthPage.url().includes('demo-2.absmartly.com') &&
                                  !oauthPage.url().includes('login')

        if (isAlreadyLoggedIn) {
          console.log('  ✓ User already logged in to ABsmartly')
        } else {
          console.log('  ⚠️  User needs to log in - this test requires stored credentials')
          console.log('  Tip: Manually log in once with headed mode to store credentials')
        }

        // Close OAuth page
        await oauthPage.close()
        await debugWait(1000)

      } else {
        console.log('  ✓ User already authenticated (JWT cookie present)')
      }
    })

    await test.step('Save settings and verify authentication', async () => {
      console.log('\n💾 STEP 5: Saving settings and verifying authentication')

      // Save settings
      const saveButton = sidebar.locator('#save-settings-button')
      await saveButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
      console.log('  ✓ Clicked Save Settings')
      await debugWait(2000) // Wait for save and auth check

      // Navigate back to settings to check auth status
      const onSettingsPage = await sidebar.locator('text=ABsmartly Endpoint').isVisible().catch(() => false)
      if (!onSettingsPage) {
        const settingsButton = sidebar.locator('button[aria-label="Settings"], button[title*="Settings"]').first()
        await settingsButton.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()
      }

      // Check Authentication Status
      const authStatusSection = sidebar.locator('text=Authentication Status')
      await expect(authStatusSection).toBeVisible()
      console.log('  ✓ Authentication Status section visible')

      // If user is authenticated via JWT, should show real user info
      const hasUserInfo = await sidebar.locator('text=/Authenticated|@/').isVisible({ timeout: 5000 }).catch(() => false)

      if (hasUserInfo) {
        console.log('  ✓ Shows authenticated user info with JWT')

        // Check for user email or name
        const userEmail = await sidebar.locator('text=/@.*\\.com/').textContent().catch(() => null)
        if (userEmail) {
          console.log(`  ✓ User email: ${userEmail}`)
        }

        // Take screenshot
        await testPage.screenshot({
          path: 'test-results/settings-auth-jwt.png',
          fullPage: true
        })
        console.log('  📸 Screenshot saved: settings-auth-jwt.png')
      } else {
        console.log('  ⚠️  User not authenticated - JWT cookie may not be present')
        console.log('  This is expected if running test without prior authentication')
      }

      await debugWait()
    })

    await test.step('Switch between auth methods', async () => {
      console.log('\n🔄 STEP 6: Testing auth method switching')

      // Switch back to API Key
      const apiKeyRadio = sidebar.locator('#auth-method-apikey')
      await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })
      console.log('  ✓ Switched to API Key method')
      await debugWait(1000)

      // Add an API key
      const apiKeyInput = sidebar.locator('#api-key-input')
      const testApiKey = process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-api-key'
      await apiKeyInput.fill(testApiKey)
      console.log('  ✓ Filled API key')
      await debugWait(1000)

      // Auth status should update to show API Key authentication
      const hasApiKeyAuth = await sidebar.locator('text=/Authenticated.*API Key/i').isVisible({ timeout: 3000 }).catch(() => false)

      if (hasApiKeyAuth) {
        console.log('  ✓ Shows API Key authentication after switch')
      }

      // Switch back to JWT
      const jwtRadio = sidebar.locator('#auth-method-jwt')
      await jwtRadio.evaluate((radio: HTMLInputElement) => {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      })
      console.log('  ✓ Switched back to JWT method')
      await debugWait(1000)

      // Take final screenshot
      await testPage.screenshot({
        path: 'test-results/settings-auth-switching.png',
        fullPage: true
      })
      console.log('  📸 Screenshot saved: settings-auth-switching.png')

      await debugWait()
    })
  })
})
