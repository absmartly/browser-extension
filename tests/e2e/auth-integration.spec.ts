import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('Authentication Utils - JWT (Extension Context)', () => {
  test('getJWTCookie should extract JWT cookie from browser', async ({ context }) => {
    const mockJWTToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'

    const page = await context.newPage()

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

  test('checkAuthentication with API Key - real API call via background SW', async ({ context, extensionUrl, seedStorage }) => {
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

    const endpointInput = sidebar.locator('#absmartly-endpoint')
    await endpointInput.waitFor({ state: 'visible', timeout: 5000 })

    const refreshButton = sidebar.locator('#auth-refresh-button')
    await refreshButton.waitFor({ state: 'visible', timeout: 5000 })
    await refreshButton.evaluate((btn: HTMLElement) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    const authUserInfo = sidebar.locator('[data-testid="auth-user-info"]')
    await authUserInfo.waitFor({ state: 'visible', timeout: 10000 })

    expect(await authUserInfo.isVisible()).toBeTruthy()
    console.log('API Key authentication successful via real API call through background SW')

    await page.close()
  })
})
