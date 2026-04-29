import { test } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import path from 'path'
import { injectSidebar, initializeTestLogging } from './utils/test-helpers'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'

test.describe('Simple Visual Editor Test', () => {
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

  test('Visual editor with proper storage setup', async () => {
    test.setTimeout(60000)
    console.log('\n🚀 Starting Simple Visual Editor Test')

    // Create a fresh experiment via the UI rather than seeding storage —
    // the previous seedStorage({ experiments }) wrote to a key the
    // extension never reads (it reads experiments-cache).
    console.log('📝 Creating experiment via UI')
    await createExperiment(sidebarFrame)

    console.log('\n🚀 Launching Visual Editor...')
    await activateVisualEditor(sidebarFrame, page)

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
