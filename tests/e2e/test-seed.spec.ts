import { test, expect } from '../fixtures/extension'

test.describe('Seed Test', () => {
  test('Can navigate to seed page', async ({ context, extensionUrl }) => {
    console.log('\n🧪 Testing seed page navigation')

    const page = await context.newPage()

    // Listen for console messages
    page.on('console', msg => console.log('PAGE LOG:', msg.text()))
    page.on('pageerror', err => console.log('PAGE ERROR:', err))

    const seedUrl = extensionUrl('tests/seed.html')
    console.log('Seed URL:', seedUrl)

    try {
      await page.goto(seedUrl, { timeout: 10000, waitUntil: 'load' })
      console.log('✅ Navigated to seed page')

      await page.waitForTimeout(1000) // Give scripts time to execute

      const title = await page.title()
      console.log('Page title:', title)

      const bodyText = await page.evaluate(() => document.body.textContent)
      console.log('Body text:', bodyText?.substring(0, 200))

      const hasSeedFunction = await page.evaluate(() => {
        return typeof (window as any).seed === 'function'
      })
      console.log('Has seed function:', hasSeedFunction)

      expect(hasSeedFunction).toBeTruthy()
    } catch (error) {
      console.error('❌ Failed to navigate:', error)
      throw error
    } finally {
      await page.close()
    }
  })
})
