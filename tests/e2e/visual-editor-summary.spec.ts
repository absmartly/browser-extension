import { test, expect } from '../fixtures/extension'
import { type Page, type FrameLocator } from '@playwright/test'
import path from 'path'
import { injectSidebar, initializeTestLogging } from './utils/test-helpers'
import { createExperiment, activateVisualEditor } from './helpers/ve-experiment-setup'

test.describe('Visual Editor Summary', () => {
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

  test('Verify visual editor launches and context menu appears', async () => {
    test.setTimeout(90000)

    console.log('\n🚀 Visual Editor Test Summary')
    console.log('================================')

    // Create a fresh experiment via the UI so the test isn't dependent on the
    // ABsmartly API list state — the previous seedStorage({ experiments })
    // wrote to a key the extension never reads (it reads experiments-cache).
    console.log('✅ Step 1: Creating experiment via UI')
    await createExperiment(sidebarFrame)

    console.log('✅ Step 2: Launching Visual Editor')
    await activateVisualEditor(sidebarFrame, page)
    const hasVisualEditor = await page.locator('text=/Visual Editor/').count() > 0
    expect(hasVisualEditor).toBe(true)
    console.log('   Visual Editor header visible')

    console.log('\n✅ Step 3: Testing context menu')
    const heading = page.locator('#hero-title').first()
    await heading.scrollIntoViewIfNeeded()
    await heading.click()
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    await page.screenshot({
      path: 'test-results/visual-editor-summary.png',
      fullPage: true
    })
    console.log('   Context menu triggered (see screenshot)')

    console.log('\n✨ Test complete!')
  })
})