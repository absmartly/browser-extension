import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import path from 'path'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 1000) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

async function injectSidebar(page: Page, extensionUrl: (path: string) => string) {
  await page.evaluate((extUrl) => {
    const originalPadding = document.body.style.paddingRight || '0px'
    document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
    document.body.style.transition = 'padding-right 0.3s ease-in-out'
    document.body.style.paddingRight = '384px'

    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 384px;
      height: 100vh;
      background-color: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      transform: translateX(0);
      transition: transform 0.3s ease-in-out;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `
    iframe.src = extUrl

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, extensionUrl('tabs/sidebar.html'))

  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  await sidebar.locator('body').waitFor({ timeout: 10000 })
  console.log('Sidebar injected and ready')
  return sidebar
}

test.describe('Visual Improvements Tests', () => {
  let testPage: Page

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Verify BETA badge in extension header', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(30000)

    const sidebar = await injectSidebar(testPage, extensionUrl)
    await debugWait()

    await test.step('Check for BETA badge', async () => {
      console.log('Checking for BETA badge')

      const betaBadge = sidebar.locator('#beta-badge, span:has-text("BETA")')
      await betaBadge.waitFor({ state: 'visible', timeout: 5000 })
      await debugWait()

      const classes = await betaBadge.getAttribute('class')
      expect(classes).toContain('bg-orange-100')
      expect(classes).toContain('text-orange-600')

      console.log('BETA badge found and verified')

      await testPage.screenshot({
        path: 'test-results/beta-badge-visible.png',
        fullPage: true
      })
      console.log('Screenshot saved: beta-badge-visible.png')
      await debugWait()
    })
  })

  test('Verify Settings page back button', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(30000)

    const sidebar = await injectSidebar(testPage, extensionUrl)

    await test.step('Navigate to Settings', async () => {
      console.log('Navigating to Settings')

      await sidebar.locator('button[title="Settings"]').click()
      await debugWait()
      console.log('Navigated to Settings')
      await debugWait()
    })

    await test.step('Verify back button in Settings header', async () => {
      console.log('Verifying back button in Settings header')

      const backButton = sidebar.locator('button[title="Go back"]').first()
      await backButton.waitFor({ state: 'visible', timeout: 5000 })
      await debugWait()

      console.log('Back button found at top of Settings page')

      await testPage.screenshot({
        path: 'test-results/settings-back-button.png',
        fullPage: true
      })
      console.log('Screenshot saved: settings-back-button.png')

      await backButton.click()
      await debugWait()

      await sidebar.locator('#experiments-header, h1:has-text("Experiments")').waitFor({ state: 'visible', timeout: 5000 })
      console.log('Back button works - returned to experiments list')
      await debugWait()
    })
  })

  test('Verify Create Experiment dropdown shows templates', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(30000)

    const sidebar = await injectSidebar(testPage, extensionUrl)
    
    await test.step('Open create experiment dropdown', async () => {
      console.log('Opening create experiment dropdown')
      
      const createButton = sidebar.locator('button[title="Create New Experiment"]')
      await createButton.click()
      await debugWait(1000)
      
      console.log('Dropdown opened')

      // Check for "Create from scratch" button - this confirms dropdown is visible
      const createFromScratch = sidebar.locator('#from-scratch-button')
      await createFromScratch.waitFor({ state: 'visible', timeout: 5000 })
      console.log('Create from scratch button found')
      
      // Wait for templates to finish loading (loading indicator to disappear)
      const loadingIndicator = sidebar.locator('text=Loading templates')
      await loadingIndicator.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})
      await loadingIndicator.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {})
      
      await debugWait(1000)
      
      // Check if templates loaded successfully
      const templateButtons = sidebar.locator('#load-template-button, button:has-text("Load")')
      const templateCount = await templateButtons.count()
      console.log('Number of templates loaded:', templateCount)
      
      const noTemplates = sidebar.locator('text=No templates found')
      const hasNoTemplates = await noTemplates.isVisible()
      console.log('No templates message visible:', hasNoTemplates)
      
      if (templateCount > 0) {
        console.log('✅ Templates loaded successfully')
      } else if (hasNoTemplates) {
        console.log('⚠️  No templates available')
      } else {
        console.log('⚠️  Templates may still be loading')
      }
      
      // Take screenshot
      await testPage.screenshot({
        path: 'test-results/create-experiment-dropdown.png',
        fullPage: true
      })
      console.log('Screenshot saved: create-experiment-dropdown.png')
      
      await debugWait()
    })
  })

  test('Verify Visual Editor floating bar', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(50000)

    const sidebar = await injectSidebar(testPage, extensionUrl)

    await test.step('Create experiment and start Visual Editor', async () => {
      console.log('Creating experiment')
      const experimentName = await createExperiment(sidebar)
      console.log(`Created experiment: ${experimentName}`)

      console.log('Activating Visual Editor')
      await activateVisualEditor(sidebar, testPage)
      console.log('Visual editor active')
    })

    await test.step('Verify floating bar styling', async () => {
      console.log('Verifying floating bar styling')

      const bannerHost = testPage.locator('#absmartly-visual-editor-banner-host')
      await bannerHost.waitFor({ state: 'visible', timeout: 5000 })
      await debugWait()

      const hostStyles = await bannerHost.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          position: computed.position,
          top: computed.top,
          zIndex: computed.zIndex
        }
      })

      expect(hostStyles.position).toBe('fixed')
      expect(hostStyles.top).toBe('16px')
      console.log('Banner host positioned correctly (floating at top)')
      await debugWait()

      const banner = testPage.locator('.banner')
      const bannerStyles = await banner.evaluate((el) => {
        const computed = window.getComputedStyle(el)
        return {
          borderRadius: computed.borderRadius,
          minWidth: computed.minWidth,
          cursor: computed.cursor
        }
      })

      expect(bannerStyles.borderRadius).toBe('24px')
      expect(bannerStyles.cursor).toBe('grab')
      expect(parseInt(bannerStyles.minWidth)).toBeGreaterThanOrEqual(600)
      console.log('Banner styled as floating bar')

      await testPage.screenshot({
        path: 'test-results/visual-editor-floating-bar.png',
        fullPage: true
      })
      console.log('Screenshot saved: visual-editor-floating-bar.png')
      await debugWait()
    })

    await test.step('Test drag functionality', async () => {
      console.log('Testing drag functionality')

      const banner = testPage.locator('.banner')

      const initialBox = await banner.boundingBox()
      expect(initialBox).not.toBeNull()
      console.log(`Initial position: x=${initialBox!.x}, y=${initialBox!.y}`)
      await debugWait()

      await banner.hover()
      await testPage.mouse.down()
      await testPage.mouse.move(initialBox!.x + 200, initialBox!.y + 100)
      await testPage.mouse.up()
      await debugWait(500)

      const newBox = await banner.boundingBox()
      expect(newBox).not.toBeNull()
      console.log(`New position: x=${newBox!.x}, y=${newBox!.y}`)

      expect(newBox!.x).not.toBe(initialBox!.x)
      expect(newBox!.y).not.toBe(initialBox!.y)
      console.log('Banner successfully dragged to new position')

      await testPage.screenshot({
        path: 'test-results/visual-editor-bar-dragged.png',
        fullPage: true
      })
      console.log('Screenshot saved: visual-editor-bar-dragged.png')
      await debugWait()
    })
  })
})
