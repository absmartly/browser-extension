import { test, expect } from '../fixtures/extension'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'variable-sync-test.html')

test.describe('Simple Smoke Test', () => {
  test('Extension loads and sidebar is accessible', async ({ context, extensionId, extensionUrl }) => {
    console.log('\n🚀 Starting smoke test')
    console.log('Extension ID:', extensionId)

    const page = await context.newPage()
    await page.goto(`file://${TEST_PAGE_PATH}`)
    console.log('✅ Test page loaded')

    // Inject sidebar
    await page.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      container.style.cssText = 'position: fixed; top: 0; right: 0; width: 384px; height: 100vh; z-index: 999999;'

      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl

      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    console.log('✅ Sidebar injected')

    // Wait for iframe to load
    const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })
    console.log('✅ Sidebar iframe loaded')

    // Check if sidebar content is visible
    const sidebarBody = await sidebar.locator('body').textContent()
    console.log('Sidebar content length:', sidebarBody?.length || 0)

    expect(sidebarBody).toBeTruthy()
    expect(sidebarBody!.length).toBeGreaterThan(0)

    console.log('✅ Smoke test passed!')

    await page.close()
  })
})
