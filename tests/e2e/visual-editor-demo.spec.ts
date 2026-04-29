import { test } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import path from 'path'
import { injectSidebar, initializeTestLogging } from './utils/test-helpers'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'

test.describe('Visual Editor Demo', () => {
  let page: Page
  let sidebarFrame: FrameLocator

  test.beforeEach(async ({ context, extensionUrl }) => {
    initializeTestLogging()

    page = await context.newPage()
    const testPagePath = path.join(__dirname, '..', 'visual-editor-test-page.html')
    await page.goto(`file://${testPagePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 })

    sidebarFrame = await injectSidebar(page, extensionUrl)
  })

  test.afterEach(async () => {
    if (page && !process.env.SLOW) await page.close()
  })

  test('Launch visual editor and show context menu', async () => {
    test.setTimeout(60000)
    console.log('\n🚀 Starting Visual Editor Demo')

    // Create a fresh experiment via the UI so the demo doesn't depend on the
    // ABsmartly API list state. The form is filled but not saved — the visual
    // editor button on the unsaved-experiment screen still launches the VE.
    console.log('📝 Creating experiment via UI...')
    await createExperiment(sidebarFrame)

    console.log('🚀 Launching Visual Editor...')
    await activateVisualEditor(sidebarFrame, page)
    console.log('✅ Visual Editor launched')

    // Demo: Click on different elements to show context menu
    console.log('\n📸 Taking screenshots of context menu for different elements...')

    // 1. Click on heading
    console.log('\n1️⃣ Clicking on heading...')
    const heading = page.locator('#hero-title').first()
    await heading.scrollIntoViewIfNeeded()
    await heading.click()
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    await page.screenshot({
      path: 'test-results/context-menu-heading.png',
      fullPage: false,
      clip: { x: 100, y: 100, width: 800, height: 600 }
    })
    console.log('📸 Screenshot: context-menu-heading.png')

    // Close the context menu so the next target isn't blocked by the menu host
    await page.keyboard.press('Escape')

    // 2. Click on button
    console.log('\n2️⃣ Clicking on button...')
    const button = page.locator('#btn-primary').first()
    await button.scrollIntoViewIfNeeded()
    await button.click()
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    await page.screenshot({
      path: 'test-results/context-menu-button.png',
      fullPage: false,
      clip: { x: 100, y: 200, width: 800, height: 600 }
    })
    console.log('📸 Screenshot: context-menu-button.png')

    await page.keyboard.press('Escape')

    // 3. Click on card
    console.log('\n3️⃣ Clicking on card...')
    const card = page.locator('#card-1').first()
    await card.scrollIntoViewIfNeeded()
    await card.click()
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    await page.screenshot({
      path: 'test-results/context-menu-card.png',
      fullPage: false,
      clip: { x: 100, y: 300, width: 800, height: 600 }
    })
    console.log('📸 Screenshot: context-menu-card.png')

    // Full page screenshot
    await page.screenshot({
      path: 'test-results/visual-editor-demo-full.png',
      fullPage: true
    })
    console.log('\n📸 Full page screenshot: visual-editor-demo-full.png')

    console.log('\n✅ Demo complete!')
  })
})
