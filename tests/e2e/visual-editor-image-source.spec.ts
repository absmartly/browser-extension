import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { setupTestPage, log, initializeTestLogging, debugWait } from './utils/test-helpers'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

async function waitForContextMenuWithShadowRoot(testPage: Page, timeout = 5000): Promise<boolean> {
  return await testPage.waitForFunction(() => {
    const menuHost = document.getElementById('absmartly-menu-host')
    return menuHost && menuHost.shadowRoot !== null
  }, { timeout }).then(() => true).catch(() => false)
}

async function getMenuItems(testPage: Page): Promise<string[]> {
  return await testPage.evaluate(() => {
    const menuHost = document.getElementById('absmartly-menu-host')
    if (!menuHost || !menuHost.shadowRoot) return []

    const menuItems = menuHost.shadowRoot.querySelectorAll('.menu-item')
    return Array.from(menuItems).map((item: any) =>
      item.querySelector('.menu-label')?.textContent || ''
    ).filter(Boolean)
  })
}

test.describe('Visual Editor - Change Image Source', () => {
  let testPage: Page
  let sidebar: FrameLocator

  test.beforeEach(async ({ context, extensionUrl }) => {
    initializeTestLogging()

    testPage = await context.newPage()

    const result = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    sidebar = result.sidebar

    await debugWait()

    await sidebar.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})

    const experimentName = await createExperiment(sidebar)
    log(`Created experiment: ${experimentName}`)

    await activateVisualEditor(sidebar, testPage)
    log('Visual editor activated')

    await debugWait()
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should show "Change image source" for img elements', async () => {
    const img = testPage.locator('#product-image')
    await img.waitFor({ state: 'visible', timeout: 5000 })

    log('Right-clicking on img element')
    await img.click({ button: 'right' })

    const menuAppeared = await waitForContextMenuWithShadowRoot(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)
    log(`Menu items: ${JSON.stringify(menuItems)}`)

    expect(menuItems).toContain('Change image source')
    expect(menuItems).not.toContain('Move up')
    expect(menuItems).not.toContain('Move down')
  })

  test('should show "Change image source" for background-image elements', async () => {
    const heroBanner = testPage.locator('#hero-banner')
    await heroBanner.waitFor({ state: 'visible', timeout: 5000 })

    log('Right-clicking on background-image element')
    await heroBanner.click({ button: 'right' })

    const menuAppeared = await waitForContextMenuWithShadowRoot(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)
    log(`Menu items: ${JSON.stringify(menuItems)}`)

    expect(menuItems).toContain('Change image source')
  })

  test('should NOT show "Change image source" for regular elements', async () => {
    const regularDiv = testPage.locator('#test-container')
    await regularDiv.waitFor({ state: 'visible', timeout: 5000 })

    log('Right-clicking on regular div')
    await regularDiv.click({ button: 'right' })

    const menuAppeared = await waitForContextMenuWithShadowRoot(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)
    log(`Menu items: ${JSON.stringify(menuItems)}`)

    expect(menuItems).not.toContain('Change image source')
  })

  test('should NOT show "Move up" or "Move down" in context menu', async () => {
    const regularDiv = testPage.locator('#test-container')
    await regularDiv.waitFor({ state: 'visible', timeout: 5000 })

    await regularDiv.click({ button: 'right' })

    const menuAppeared = await waitForContextMenuWithShadowRoot(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)

    expect(menuItems).not.toContain('Move up')
    expect(menuItems).not.toContain('Move down')
  })

  test('should change img src when new URL is provided', async () => {
    const img = testPage.locator('#product-image')
    const originalSrc = await img.getAttribute('src')

    await img.click({ button: 'right' })
    await waitForContextMenuWithShadowRoot(testPage)

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

    await testPage.waitForFunction(() => {
      return document.getElementById('absmartly-image-dialog-host') !== null
    }, { timeout: 5000 })

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

    await testPage.waitForFunction((url) => {
      const img = document.getElementById('product-image') as HTMLImageElement
      return img && img.src === url
    }, newUrl, { timeout: 5000 })

    const newSrc = await img.getAttribute('src')
    expect(newSrc).toBe(newUrl)
    expect(newSrc).not.toBe(originalSrc)
  })

  test('should change background-image when new URL is provided', async () => {
    const heroBanner = testPage.locator('#hero-banner')

    const originalBg = await testPage.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    await heroBanner.click({ button: 'right' })
    await waitForContextMenuWithShadowRoot(testPage)

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

    await testPage.waitForFunction(() => {
      return document.getElementById('absmartly-image-dialog-host') !== null
    }, { timeout: 5000 })

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

    await testPage.waitForFunction((url) => {
      const el = document.getElementById('hero-banner') as HTMLElement
      const bgImage = el?.style.backgroundImage || ''
      return bgImage.includes(url)
    }, newUrl, { timeout: 5000 })

    const newBg = await testPage.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    expect(newBg).toContain(newUrl)
    expect(newBg).not.toBe(originalBg)
  })

  test('should not change when dialog is cancelled', async () => {
    const img = testPage.locator('#product-image')
    const originalSrc = await img.getAttribute('src')

    await img.click({ button: 'right' })
    await waitForContextMenuWithShadowRoot(testPage)

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

    await testPage.waitForFunction(() => {
      return document.getElementById('absmartly-image-dialog-host') !== null
    }, { timeout: 5000 })

    await testPage.evaluate(() => {
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const shadowRoot = (dialogHost as any)?.shadowRoot
      const cancelButton = shadowRoot?.querySelector('.dialog-button-cancel')
      if (cancelButton) {
        (cancelButton as HTMLElement).click()
      }
    })

    await debugWait(500)

    const finalSrc = await img.getAttribute('src')
    expect(finalSrc).toBe(originalSrc)
  })
})
