import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import { setupTestPage, log, initializeTestLogging, debugWait } from './utils/test-helpers'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

async function waitForContextMenu(testPage: Page, timeout = 5000): Promise<boolean> {
  return await testPage.waitForFunction(() => {
    const menuContainer = document.querySelector('.menu-container')
    if (menuContainer) return true
    const menuHost = document.getElementById('absmartly-menu-host')
    return menuHost !== null && (menuHost.shadowRoot !== null || menuHost.querySelector('.menu-container') !== null)
  }, { timeout }).then(() => true).catch(() => false)
}

async function getMenuItems(testPage: Page): Promise<string[]> {
  return await testPage.evaluate(() => {
    const menuContainer = document.querySelector('.menu-container')
    if (menuContainer) {
      const items = menuContainer.querySelectorAll('.menu-item')
      return Array.from(items).map((item: any) =>
        item.querySelector('.menu-label')?.textContent || ''
      ).filter(Boolean)
    }
    const menuHost = document.getElementById('absmartly-menu-host')
    if (menuHost && menuHost.shadowRoot) {
      const items = menuHost.shadowRoot.querySelectorAll('.menu-item')
      return Array.from(items).map((item: any) =>
        item.querySelector('.menu-label')?.textContent || ''
      ).filter(Boolean)
    }
    return []
  })
}

async function clickMenuItem(testPage: Page, label: string): Promise<void> {
  await testPage.evaluate((targetLabel) => {
    function findAndClick(root: ParentNode): boolean {
      const items = root.querySelectorAll('.menu-item')
      for (const item of items) {
        const menuLabel = item.querySelector('.menu-label')?.textContent
        if (menuLabel === targetLabel) {
          (item as HTMLElement).click()
          return true
        }
      }
      return false
    }
    const menuContainer = document.querySelector('.menu-container')
    if (menuContainer && findAndClick(menuContainer)) return
    const menuHost = document.getElementById('absmartly-menu-host')
    if (menuHost?.shadowRoot) findAndClick(menuHost.shadowRoot)
  }, label)
}

async function interactWithDialog(testPage: Page, action: 'apply' | 'cancel', inputValue?: string): Promise<void> {
  if (inputValue !== undefined) {
    await testPage.evaluate((url) => {
      function findInput(root: ParentNode): HTMLInputElement | null {
        return root.querySelector('input') as HTMLInputElement | null
      }
      const dialogHost = document.getElementById('absmartly-image-dialog-host')
      const input = dialogHost?.shadowRoot
        ? findInput(dialogHost.shadowRoot)
        : dialogHost ? findInput(dialogHost) : null
      if (input) {
        input.value = url
        input.dispatchEvent(new Event('input', { bubbles: true }))
      }
    }, inputValue)
  }

  const buttonClass = action === 'apply' ? '.dialog-button-apply' : '.dialog-button-cancel'
  await testPage.evaluate((cls) => {
    const dialogHost = document.getElementById('absmartly-image-dialog-host')
    const root = dialogHost?.shadowRoot || dialogHost
    const button = root?.querySelector(cls) as HTMLElement
    if (button) button.click()
  }, buttonClass)
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
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const img = testPage.locator('#product-image')
    await img.waitFor({ state: 'visible', timeout: 5000 })

    log('Right-clicking on img element')
    await img.click({ button: 'right' })

    const menuAppeared = await waitForContextMenu(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)
    log(`Menu items: ${JSON.stringify(menuItems)}`)

    expect(menuItems).toContain('Change image source')
    expect(menuItems).not.toContain('Move up')
    expect(menuItems).not.toContain('Move down')
  })

  test('should show "Change image source" for background-image elements', async () => {
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const heroBanner = testPage.locator('#hero-banner')
    await heroBanner.waitFor({ state: 'visible', timeout: 5000 })

    log('Right-clicking on background-image element')
    await heroBanner.click({ button: 'right' })

    const menuAppeared = await waitForContextMenu(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)
    log(`Menu items: ${JSON.stringify(menuItems)}`)

    expect(menuItems).toContain('Change image source')
  })

  test('should NOT show "Change image source" for regular elements', async () => {
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const regularDiv = testPage.locator('#test-container')
    await regularDiv.waitFor({ state: 'visible', timeout: 5000 })

    log('Right-clicking on regular div')
    await regularDiv.click({ button: 'right' })

    const menuAppeared = await waitForContextMenu(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)
    log(`Menu items: ${JSON.stringify(menuItems)}`)

    expect(menuItems).not.toContain('Change image source')
  })

  test('should NOT show "Move up" or "Move down" in context menu', async () => {
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const regularDiv = testPage.locator('#test-container')
    await regularDiv.waitFor({ state: 'visible', timeout: 5000 })

    await regularDiv.click({ button: 'right' })

    const menuAppeared = await waitForContextMenu(testPage)
    expect(menuAppeared).toBe(true)

    const menuItems = await getMenuItems(testPage)

    expect(menuItems).not.toContain('Move up')
    expect(menuItems).not.toContain('Move down')
  })

  test('should change img src when new URL is provided', async () => {
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const img = testPage.locator('#product-image')
    const originalSrc = await img.getAttribute('src')

    await img.click({ button: 'right' })
    await waitForContextMenu(testPage)
    await clickMenuItem(testPage, 'Change image source')

    await testPage.waitForFunction(() => {
      return document.getElementById('absmartly-image-dialog-host') !== null
    }, { timeout: 5000 })

    const newUrl = 'https://via.placeholder.com/200x150/95E1D3/FFFFFF?text=New+Image'
    await interactWithDialog(testPage, 'apply', newUrl)

    await testPage.waitForFunction((url) => {
      const img = document.getElementById('product-image') as HTMLImageElement
      return img && img.src === url
    }, newUrl, { timeout: 5000 })

    const newSrc = await img.getAttribute('src')
    expect(newSrc).toBe(newUrl)
    expect(newSrc).not.toBe(originalSrc)
  })

  test('should change background-image when new URL is provided', async () => {
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const heroBanner = testPage.locator('#hero-banner')

    const originalBg = await testPage.evaluate(() => {
      const el = document.getElementById('hero-banner') as HTMLElement
      return el?.style.backgroundImage || ''
    })

    await heroBanner.click({ button: 'right' })
    await waitForContextMenu(testPage)
    await clickMenuItem(testPage, 'Change image source')

    await testPage.waitForFunction(() => {
      return document.getElementById('absmartly-image-dialog-host') !== null
    }, { timeout: 5000 })

    const newUrl = 'https://via.placeholder.com/300x200/F38181/FFFFFF?text=New+BG'
    await interactWithDialog(testPage, 'apply', newUrl)

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
    test.skip(true, 'Visual editor context menu requires full VE activation pipeline with real API experiment creation')
    const img = testPage.locator('#product-image')
    const originalSrc = await img.getAttribute('src')

    await img.click({ button: 'right' })
    await waitForContextMenu(testPage)
    await clickMenuItem(testPage, 'Change image source')

    await testPage.waitForFunction(() => {
      return document.getElementById('absmartly-image-dialog-host') !== null
    }, { timeout: 5000 })

    await interactWithDialog(testPage, 'cancel')
    await debugWait(500)

    const finalSrc = await img.getAttribute('src')
    expect(finalSrc).toBe(originalSrc)
  })
})
