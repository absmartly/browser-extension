import { test, expect } from '../fixtures/extension'

const createTestPage = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Image Source Test Page</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .test-img { width: 200px; height: 150px; margin: 20px; }
    .test-bg {
      width: 300px;
      height: 200px;
      margin: 20px;
      background-size: cover;
      background-position: center;
    }
    .test-div { padding: 20px; margin: 20px; background: #f0f0f0; }
  </style>
</head>
<body>
  <h1>Image Source Change Test</h1>

  <img id="product-image" class="test-img" src="https://via.placeholder.com/200x150/FF6B6B/FFFFFF?text=Original" alt="Product" />

  <div id="hero-banner" class="test-bg" style="background-image: url('https://via.placeholder.com/300x200/4ECDC4/FFFFFF?text=Hero+BG');">
  </div>

  <div id="regular-div" class="test-div">
    <p>Regular div without image</p>
  </div>
</body>
</html>
`

test.describe('Visual Editor - Change Image Source', () => {
  test.beforeEach(async ({ clearStorage, seedStorage }) => {
    await clearStorage()

    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'test-key',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey'
    })
  })

  test('should show "Change image source" for img elements', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    // Wait for page to load
    await page.waitForLoadState('domcontentloaded')

    // Right-click on the img element
    const img = await page.locator('#product-image')
    await img.click({ button: 'right' })

    // Wait for context menu
    await page.waitForTimeout(500)

    // Check if the menu exists in shadow DOM
    const menuExists = await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (!menuHost) return false

      const shadowRoot = (menuHost as any).shadowRoot
      if (!shadowRoot) return false

      const menuItems = shadowRoot.querySelectorAll('.menu-item')
      const labels = Array.from(menuItems).map((item: any) =>
        item.querySelector('.menu-label')?.textContent
      )

      return {
        hasChangeImageSource: labels.includes('Change image source'),
        hasMoveUp: labels.includes('Move up'),
        hasMoveDown: labels.includes('Move down')
      }
    })

    expect(menuExists.hasChangeImageSource).toBe(true)
    expect(menuExists.hasMoveUp).toBe(false)
    expect(menuExists.hasMoveDown).toBe(false)
  })

  test('should show "Change image source" for background-image elements', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    await page.waitForLoadState('domcontentloaded')

    // Right-click on the element with background-image
    const heroBanner = await page.locator('#hero-banner')
    await heroBanner.click({ button: 'right' })

    await page.waitForTimeout(500)

    const menuExists = await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (!menuHost) return false

      const shadowRoot = (menuHost as any).shadowRoot
      if (!shadowRoot) return false

      const menuItems = shadowRoot.querySelectorAll('.menu-item')
      const labels = Array.from(menuItems).map((item: any) =>
        item.querySelector('.menu-label')?.textContent
      )

      return labels.includes('Change image source')
    })

    expect(menuExists).toBe(true)
  })

  test('should NOT show "Change image source" for regular elements', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    await page.waitForLoadState('domcontentloaded')

    // Right-click on regular div
    const regularDiv = await page.locator('#regular-div')
    await regularDiv.click({ button: 'right' })

    await page.waitForTimeout(500)

    const menuExists = await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (!menuHost) return false

      const shadowRoot = (menuHost as any).shadowRoot
      if (!shadowRoot) return false

      const menuItems = shadowRoot.querySelectorAll('.menu-item')
      const labels = Array.from(menuItems).map((item: any) =>
        item.querySelector('.menu-label')?.textContent
      )

      return labels.includes('Change image source')
    })

    expect(menuExists).toBe(false)
  })

  test('should NOT show "Move up" or "Move down" in context menu', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    await page.waitForLoadState('domcontentloaded')

    const regularDiv = await page.locator('#regular-div')
    await regularDiv.click({ button: 'right' })

    await page.waitForTimeout(500)

    const result = await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (!menuHost) return { hasMoveUp: false, hasMoveDown: false }

      const shadowRoot = (menuHost as any).shadowRoot
      if (!shadowRoot) return { hasMoveUp: false, hasMoveDown: false }

      const menuItems = shadowRoot.querySelectorAll('.menu-item')
      const labels = Array.from(menuItems).map((item: any) =>
        item.querySelector('.menu-label')?.textContent
      )

      return {
        hasMoveUp: labels.includes('Move up'),
        hasMoveDown: labels.includes('Move down')
      }
    })

    expect(result.hasMoveUp).toBe(false)
    expect(result.hasMoveDown).toBe(false)
  })

  test('should change img src when new URL is provided', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    await page.waitForLoadState('domcontentloaded')

    // Get original src
    const originalSrc = await page.locator('#product-image').getAttribute('src')

    // Right-click on img
    await page.locator('#product-image').click({ button: 'right' })
    await page.waitForTimeout(500)

    // Click "Change image source" in context menu
    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      const shadowRoot = (menuHost as any)?.shadowRoot
      const menuItems = shadowRoot?.querySelectorAll('.menu-item')

      for (const item of menuItems) {
        const label = item.querySelector('.menu-label')?.textContent
        if (label === 'Change image source') {
          (item as HTMLElement).click()
          break
        }
      }
    })

    // Wait for dialog to appear
    await page.waitForTimeout(500)

    // Enter new URL in dialog
    const newUrl = 'https://via.placeholder.com/200x150/95E1D3/FFFFFF?text=New+Image'
    await page.evaluate((url) => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const input = shadowRoot?.querySelector('input')
      if (input) {
        input.value = url
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, newUrl)

    // Click Apply button
    await page.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const applyButton = shadowRoot?.querySelector('.dialog-button-apply')
      if (applyButton) {
        (applyButton as HTMLElement).click()
      }
    })

    // Wait for change to apply
    await page.waitForTimeout(500)

    // Verify src changed
    const newSrc = await page.locator('#product-image').getAttribute('src')
    expect(newSrc).toBe(newUrl)
    expect(newSrc).not.toBe(originalSrc)
  })

  test('should change background-image when new URL is provided', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    await page.waitForLoadState('domcontentloaded')

    // Get original background-image
    const originalBg = await page.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    // Right-click on hero banner
    await page.locator('#hero-banner').click({ button: 'right' })
    await page.waitForTimeout(500)

    // Click "Change image source"
    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      const shadowRoot = (menuHost as any)?.shadowRoot
      const menuItems = shadowRoot?.querySelectorAll('.menu-item')

      for (const item of menuItems) {
        const label = item.querySelector('.menu-label')?.textContent
        if (label === 'Change image source') {
          (item as HTMLElement).click()
          break
        }
      }
    })

    await page.waitForTimeout(500)

    // Enter new URL
    const newUrl = 'https://via.placeholder.com/300x200/F38181/FFFFFF?text=New+BG'
    await page.evaluate((url) => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const input = shadowRoot?.querySelector('input')
      if (input) {
        input.value = url
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, newUrl)

    // Click Apply
    await page.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const applyButton = shadowRoot?.querySelector('.dialog-button-apply')
      if (applyButton) {
        (applyButton as HTMLElement).click()
      }
    })

    await page.waitForTimeout(500)

    // Verify background-image changed
    const newBg = await page.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    expect(newBg).toContain(newUrl)
    expect(newBg).not.toBe(originalBg)
  })

  test('should not change when dialog is cancelled', async ({ context }) => {
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))

    await page.waitForLoadState('domcontentloaded')

    const originalSrc = await page.locator('#product-image').getAttribute('src')

    // Right-click and open dialog
    await page.locator('#product-image').click({ button: 'right' })
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      const shadowRoot = (menuHost as any)?.shadowRoot
      const menuItems = shadowRoot?.querySelectorAll('.menu-item')

      for (const item of menuItems) {
        const label = item.querySelector('.menu-label')?.textContent
        if (label === 'Change image source') {
          (item as HTMLElement).click()
          break
        }
      }
    })

    await page.waitForTimeout(500)

    // Click Cancel button
    await page.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const cancelButton = shadowRoot?.querySelector('.dialog-button-cancel')
      if (cancelButton) {
        (cancelButton as HTMLElement).click()
      }
    })

    await page.waitForTimeout(500)

    // Verify src unchanged
    const finalSrc = await page.locator('#product-image').getAttribute('src')
    expect(finalSrc).toBe(originalSrc)
  })
})
