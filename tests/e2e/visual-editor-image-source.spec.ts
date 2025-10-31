import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'

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
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    await testPage.goto('data:text/html,' + encodeURIComponent(createTestPage()))
    await testPage.waitForLoadState('domcontentloaded')
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should show "Change image source" for img elements', async () => {
    const img = await testPage.locator('#product-image')
    await img.click({ button: 'right' })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const menuExists = await testPage.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      if (!menuHost) return {
        hasChangeImageSource: false,
        hasMoveUp: false,
        hasMoveDown: false
      }

      const shadowRoot = (menuHost as any).shadowRoot
      if (!shadowRoot) return {
        hasChangeImageSource: false,
        hasMoveUp: false,
        hasMoveDown: false
      }

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

  test('should show "Change image source" for background-image elements', async () => {
    const heroBanner = await testPage.locator('#hero-banner')
    await heroBanner.click({ button: 'right' })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const menuExists = await testPage.evaluate(() => {
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

  test('should NOT show "Change image source" for regular elements', async () => {
    const regularDiv = await testPage.locator('#regular-div')
    await regularDiv.click({ button: 'right' })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const menuExists = await testPage.evaluate(() => {
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

  test('should NOT show "Move up" or "Move down" in context menu', async () => {
    const regularDiv = await testPage.locator('#regular-div')
    await regularDiv.click({ button: 'right' })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const result = await testPage.evaluate(() => {
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

  test('should change img src when new URL is provided', async () => {
    const originalSrc = await testPage.locator('#product-image').getAttribute('src')

    await testPage.locator('#product-image').click({ button: 'right' })
    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    await testPage.evaluate(() => {
      const menuHost = document.getElementById('absmartly-menu-host')
      const shadowRoot = (menuHost as any)?.shadowRoot
      const menuItems = shadowRoot?.querySelectorAll('.menu-item')

      if (menuItems) {
        for (const item of menuItems) {
          const label = item.querySelector('.menu-label')?.textContent
          if (label === 'Change image source') {
            (item as HTMLElement).click()
            break
          }
        }
      }
    })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const newUrl = 'https://via.placeholder.com/200x150/95E1D3/FFFFFF?text=New+Image'
    await testPage.evaluate((url) => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const input = shadowRoot?.querySelector('input')
      if (input) {
        input.value = url
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, newUrl)

    await testPage.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const applyButton = shadowRoot?.querySelector('.dialog-button-apply')
      if (applyButton) {
        (applyButton as HTMLElement).click()
      }
    })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const newSrc = await testPage.locator('#product-image').getAttribute('src')
    expect(newSrc).toBe(newUrl)
    expect(newSrc).not.toBe(originalSrc)
  })

  test('should change background-image when new URL is provided', async () => {
    const originalBg = await testPage.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    await testPage.locator('#hero-banner').click({ button: 'right' })
    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    await testPage.evaluate(() => {
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

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const newUrl = 'https://via.placeholder.com/300x200/F38181/FFFFFF?text=New+BG'
    await testPage.evaluate((url) => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const input = shadowRoot?.querySelector('input')
      if (input) {
        input.value = url
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, newUrl)

    await testPage.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const applyButton = shadowRoot?.querySelector('.dialog-button-apply')
      if (applyButton) {
        (applyButton as HTMLElement).click()
      }
    })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const newBg = await testPage.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    expect(newBg).toContain(newUrl)
    expect(newBg).not.toBe(originalBg)
  })

  test('should not change when dialog is cancelled', async () => {
    const originalSrc = await testPage.locator('#product-image').getAttribute('src')

    await testPage.locator('#product-image').click({ button: 'right' })
    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    await testPage.evaluate(() => {
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

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    await testPage.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const cancelButton = shadowRoot?.querySelector('.dialog-button-cancel')
      if (cancelButton) {
        (cancelButton as HTMLElement).click()
      }
    })

    await testPage.waitForLoadState('domcontentloaded').catch(() => {})

    const finalSrc = await testPage.locator('#product-image').getAttribute('src')
    expect(finalSrc).toBe(originalSrc)
  })
})
