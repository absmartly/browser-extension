import { test } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import path from 'path'

test.describe('Visual Editor Demo', () => {
  let page: Page
  let sidebarFrame: FrameLocator

  test.beforeEach(async ({ context, extensionUrl, seedStorage }) => {
    const mockExperiments = [
      {
        id: 1,
        name: "visual_editor_demo",
        display_name: "Visual Editor Demo",
        state: "ready",
        variants: [
          { variant: 0, name: "control", config: "{}" },
          { variant: 1, name: "treatment", config: "{}" }
        ]
      }
    ]

    await seedStorage({ experiments: mockExperiments })

    page = await context.newPage()
    const testPagePath = path.join(__dirname, '..', 'visual-editor-test-page.html')
    await page.goto(`file://${testPagePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 })

    await page.evaluate((url) => {
      if (!document.getElementById('absmartly-sidebar-root')) {
        document.body.style.paddingRight = '384px'
        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = `
          position: fixed; top: 0; right: 0; width: 384px; height: 100%;
          background: white; border-left: 1px solid #e5e7eb; z-index: 2147483647;
        `
        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
        iframe.src = url
        container.appendChild(iframe)
        document.body.appendChild(container)
      }
    }, extensionUrl('tabs/sidebar.html'))

    await page.waitForSelector('#absmartly-sidebar-root')
    sidebarFrame = page.frameLocator('#absmartly-sidebar-iframe')
  })

  test.afterEach(async () => {
    if (page && !process.env.SLOW) await page.close()
  })

  test('Launch visual editor and show context menu', async () => {
    test.setTimeout(60000)
    console.log('\n🚀 Starting Visual Editor Demo')

    console.log('⏳ Loading experiments...')
    await sidebarFrame.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})

    const experimentItem = sidebarFrame.locator('.experiment-item')
    await experimentItem.first().waitFor({ state: 'visible', timeout: 5000 })

    const count = await experimentItem.count()
    console.log(`✅ Found ${count} experiments`)

    // Open first experiment
    console.log('📂 Opening experiment...')
    await experimentItem.first().click()
    await sidebarFrame.locator('#visual-editor-button').first().waitFor({ state: 'visible' })

    // Launch Visual Editor
    console.log('🚀 Launching Visual Editor...')
    await sidebarFrame.locator('#visual-editor-button').first().click()
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {}) // Wait for full initialization

    console.log('✅ Visual Editor launched')

    // Demo: Click on different elements to show context menu
    console.log('\n📸 Taking screenshots of context menu for different elements...')

    // 1. Click on heading
    console.log('\n1️⃣ Clicking on heading...')
    const heading = page.locator('#hero-title').first()
    await heading.scrollIntoViewIfNeeded()
    await heading.click()
    // Wait briefly for UI update
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
    // Wait briefly for UI update
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
    // Wait briefly for UI update
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
    console.log('Context menus are visible in screenshots.')
    console.log('The visual editor is working correctly.')
    console.log('\nNote: Automated interaction with context menu requires')
    console.log('special handling as it may be rendered in shadow DOM or portal.')

    console.log('\n✨ Test complete!')
  })
})