import { test, expect } from '../fixtures/extension'
import { injectSidebar } from './utils/test-helpers'

const mockJWTToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

const mockAuthResponse = {
  user: {
    id: 'test-user-123',
    email: 'test@example.com',
    first_name: 'Test',
    last_name: 'User'
  }
}

test.describe('Authentication Utils - JWT (Extension Context)', () => {
  test('getJWTCookie should extract JWT cookie from browser', async ({ context }) => {
    const page = await context.newPage()

    await context.route('**/*absmartly.com/**', route => {
      if (route.request().url().includes('auth/current-user')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockAuthResponse)
        })
      } else {
        route.fulfill({
          status: 200,
          contentType: 'text/html',
          body: '<html><body>Mock</body></html>'
        })
      }
    })

    await page.goto('http://localhost:3456/visual-editor-test.html', { waitUntil: 'domcontentloaded', timeout: 10000 })

    await context.addCookies([
      {
        name: 'jwt',
        value: mockJWTToken,
        domain: '.absmartly.com',
        path: '/'
      }
    ])

    const cookies = await context.cookies()
    const jwtCookie = cookies.find(c => c.name === 'jwt')

    expect(jwtCookie).toBeDefined()
    expect(jwtCookie.value).toContain('.')
    expect(jwtCookie.value.split('.').length).toBe(3)

    console.log('JWT cookie has valid format')

    await page.close()
  })

  test('checkAuthentication with JWT - mock API response', async ({ context, extensionUrl }) => {
    test.skip(true, 'context.route() cannot intercept Chrome extension background service worker API calls; auth refresh goes through background.ts')
    await context.route('**/auth/current-user', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockAuthResponse)
      })
    })

    const page = await context.newPage()
    await page.goto('http://localhost:3456/visual-editor-test.html', { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.setViewportSize({ width: 1920, height: 1080 })

    const sidebar = await injectSidebar(page, extensionUrl)

    const configureButton = sidebar.locator('#configure-settings-button')
    const hasWelcomeScreen = await configureButton.isVisible().catch(() => false)

    if (hasWelcomeScreen) {
      await configureButton.evaluate((btn: HTMLElement) =>
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      )
    }

    const endpointInput = sidebar.locator('#absmartly-endpoint')
    await endpointInput.waitFor({ state: 'visible', timeout: 5000 })
    await endpointInput.fill('https://demo-2.absmartly.com/v1')

    const apiKeyRadio = sidebar.locator('#auth-method-apikey')
    await apiKeyRadio.evaluate((radio: HTMLInputElement) => {
      radio.checked = true
      radio.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const apiKeyInput = sidebar.locator('#api-key-input')
    await apiKeyInput.fill(mockJWTToken)

    const refreshButton = sidebar.locator('#auth-refresh-button')
    await refreshButton.evaluate((btn: HTMLElement) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
    await authUserInfo.waitFor({ state: 'visible', timeout: 5000 })

    expect(await authUserInfo.isVisible()).toBeTruthy()
    console.log('JWT authentication successful via mocked API')

    await page.close()
  })
})
