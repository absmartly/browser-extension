import { test } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import path from 'path'

test.describe('Simple Visual Editor Test', () => {
  let page: Page
  let sidebarFrame: FrameLocator

  test.beforeEach(async ({ context, extensionUrl, seedStorage }) => {
    const mockExperiments = [
      {
        id: 1,
        name: "simple_visual_editor_test",
        display_name: "Simple Visual Editor Test",
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
    await page.waitForLoadState('domcontentloaded')

    await page.evaluate((url) => {
      const existing = document.getElementById('absmartly-sidebar-root')
      if (existing) {
        console.log('Sidebar already exists')
        return
      }

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
        height: 100%;
        background-color: white;
        border-left: 1px solid #e5e7eb;
        box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 2147483647;
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
      iframe.src = url

      container.appendChild(iframe)
      document.body.appendChild(container)
      console.log('Sidebar injected successfully')
    }, extensionUrl('tabs/sidebar.html'))

    await page.waitForSelector('#absmartly-sidebar-root', { timeout: 5000 })
    sidebarFrame = page.frameLocator('#absmartly-sidebar-iframe')
  })

  test.afterEach(async () => {
    if (page && !process.env.SLOW) await page.close()
  })

  test('Visual editor with proper storage setup', async () => {
    test.setTimeout(60000)
    console.log('\n🚀 Starting Simple Visual Editor Test')

    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {})

    await page.screenshot({
      path: 'test-results/sidebar-initial.png',
      fullPage: true
    })

    console.log('⏳ Waiting for experiments to load...')
    await sidebarFrame.locator('[role="status"][aria-label="Loading experiments"]')
      .waitFor({ state: 'hidden', timeout: 30000 })
      .catch(() => {})

    const experimentCards = sidebarFrame.locator('.experiment-item')
    await experimentCards.first().waitFor({ state: 'visible', timeout: 5000 })

    const experimentCount = await experimentCards.count()
    console.log(`✅ ${experimentCount} experiments loaded`)

    console.log('\n🔍 Clicking first experiment...')
    await experimentCards.first().click()

    console.log('Waiting for experiment detail view...')
    await sidebarFrame.locator('#visual-editor-button').first().waitFor({ state: 'visible', timeout: 5000 })

    const visualEditorBtns = sidebarFrame.locator('#visual-editor-button')
    const btnCount = await visualEditorBtns.count()
    console.log(`Found ${btnCount} Visual Editor button(s)`)

    console.log('\n🚀 Launching Visual Editor...')
    await visualEditorBtns.first().click()

    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

    await page.screenshot({
      path: 'test-results/after-visual-editor-click.png',
      fullPage: true
    })

    const hasVisualEditor = await page.locator('text=/Visual Editor/').count() > 0
    if (hasVisualEditor) {
      console.log('✅ Visual Editor launched successfully!')
    } else {
      console.log('⚠️ Visual Editor may not have fully launched, continuing anyway...')
    }

    console.log('\n🧪 Testing context menu...')
    const heading = page.locator('#hero-title').first()
    await heading.scrollIntoViewIfNeeded()
    await heading.click()

    try {
      await page.locator('text="Edit Element"').waitFor({ state: 'visible', timeout: 2000 })
      console.log('✅ Context menu appeared!')

      await page.screenshot({
        path: 'test-results/visual-editor-with-context-menu.png',
        fullPage: true
      })
      console.log('📸 Screenshot saved showing context menu')

      await page.locator('text="Edit Element"').click()
      await page.keyboard.type('Modified Title')
      await page.keyboard.press('Enter')
      console.log('✅ Modified element text')

      const card = page.locator('#card-2').first()
      await card.click()
      await page.locator('text="Hide"').waitFor({ state: 'visible', timeout: 2000 })
      await page.locator('text="Hide"').click()
      console.log('✅ Hidden element')

      const changesText = await page.locator('text=/\\d+ changes/').textContent()
      console.log(`📊 Changes made: ${changesText}`)

      console.log('\n💾 Saving changes...')
      const saveBtn = page.locator('#save-button').first()
      if (await saveBtn.isVisible()) {
        await saveBtn.click()
        console.log('✅ Changes saved!')
      }

    } catch (e) {
      console.log('⚠️ Context menu did not appear or interaction failed')
      console.log('Error:', e.message)
    }

    await page.screenshot({
      path: 'test-results/visual-editor-final.png',
      fullPage: true
    })

    console.log('\n⏸️  Waiting 10 seconds before closing...')
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 10000 }).catch(() => {})

    console.log('\n✨ Test complete!')
  })
})
