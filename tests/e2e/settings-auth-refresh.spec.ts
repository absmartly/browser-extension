import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'
import { UNAUTHORIZED } from '../helpers/management-api/server'

// Settings authentication status against the controlled management API: the
// refresh button issues a real worker request to /auth/current-user and the
// UI reflects that exact response (user, then an expired credential).
test.describe('Settings Auth Refresh Button', () => {
  test('Auth refresh button updates UI immediately with auth response data', async ({ context, extensionUrl, managementApi }) => {
    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(testPage, extensionUrl, '/visual-editor-test.html')

    await test.step('Open settings', async () => {
      await sidebar.locator('#nav-settings').click()
      await expect(sidebar.locator('text=Authentication Status')).toBeVisible()
    })

    await test.step('Shows the authenticated fixture user', async () => {
      await expect(sidebar.locator('[data-testid="auth-user-email"]')).toHaveText(managementApi.state.user.email)
      expect(managementApi.callsTo('GET', '/auth/current-user').length).toBeGreaterThan(0)
    })

    await test.step('Refresh reflects a revoked credential', async () => {
      const before = managementApi.callsTo('GET', '/auth/current-user').length
      managementApi.override(({ url }) => url.pathname === '/auth/current-user' ? UNAUTHORIZED : undefined)
      await sidebar.locator('#auth-refresh-button').click()
      await expect(sidebar.locator('[data-testid="auth-not-authenticated"]')).toBeVisible()
      await expect(sidebar.locator('[data-testid="auth-user-email"]')).toHaveCount(0)
      expect(managementApi.callsTo('GET', '/auth/current-user').length).toBeGreaterThan(before)
    })

    await test.step('Refresh recovers when the credential is valid again', async () => {
      managementApi.reset()
      await sidebar.locator('#auth-refresh-button').click()
      await expect(sidebar.locator('[data-testid="auth-user-email"]')).toHaveText(managementApi.state.user.email)
    })
  })
})
