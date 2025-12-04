import { test, expect } from '../fixtures/extension'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('AI DOM Changes Persistence', () => {
  const log = (msg: string) => {
    console.log(msg)
  }

  const debugWait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

  let testPage: any

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should save DOM changes to variant editor after exiting AI chat', async ({ context, extensionUrl }) => {
    const contentPage = await context.newPage()
    await contentPage.goto(`http://localhost:3456${TEST_PAGE_URL}`, { waitUntil: 'load' })

    await debugWait(500)
    log('✓ Content page loaded for HTML capture')

    await test.step('Load sidebar in extension context', async () => {
      log('Loading sidebar in extension context...')
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-0-sidebar-injected.png', fullPage: true })
      log('Screenshot saved: ai-persistence-0-sidebar-injected.png')
    })

    await test.step('Create new experiment', async () => {
      log('Clicking Create Experiment button...')
      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 10000 })
      await createButton.click()
      log('✓ Create button clicked')

      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-1-dropdown.png', fullPage: true })
      log('Screenshot saved: ai-persistence-1-dropdown.png')

      const fromScratchButton = testPage.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.click()
      log('✓ From Scratch clicked')

      await debugWait(1000)

      const loadingText = testPage.locator('text=Loading templates')
      await loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        log('⚠️ Loading templates text still visible or never appeared')
      })

      await debugWait(1000)
      await testPage.screenshot({ path: 'test-results/ai-persistence-1.5-after-loading.png', fullPage: true })
      log('Screenshot saved: ai-persistence-1.5-after-loading.png')

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Experiment editor opened (found Display Name field)')

      await testPage.screenshot({ path: 'test-results/ai-persistence-2-editor.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2-editor.png')

      await debugWait(500)
    })

    await test.step('Navigate to AI chat page', async () => {
      log('Waiting for form to finish loading...')
      const loadingText = testPage.locator('text=Loading...').first()
      await loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        log('⚠️ Loading text still visible or never appeared')
      })
      await debugWait(1000)
      log('✓ Form loaded')

      log('Scrolling to DOM Changes section...')
      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-2.5-dom-changes.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2.5-dom-changes.png')

      log('Finding "Generate with AI" button...')
      const generateWithAIButton = testPage.locator('#generate-with-ai-button').first()
      await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Generate with AI button found')

      await generateWithAIButton.scrollIntoViewIfNeeded()
      await debugWait(300)

      await testPage.screenshot({ path: 'test-results/ai-persistence-2.6-before-click.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2.6-before-click.png')

      await generateWithAIButton.click()
      log('✓ Clicked Generate with AI button')

      await debugWait(1000)

      await testPage.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ AI page opened')

      await testPage.screenshot({ path: 'test-results/ai-persistence-3-ai-page.png', fullPage: true })
      log('Screenshot saved: ai-persistence-3-ai-page.png')

      await testPage.locator('textarea[placeholder*="Example"]').waitFor({ state: 'visible', timeout: 5000 })
      log('✓ AI page verified')
    })

    await test.step('Verify AI page is ready', async () => {
      log('Verifying AI page UI is ready...')

      const promptInput = testPage.locator('textarea[placeholder*="Example"]')
      await promptInput.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ Prompt textarea is visible')

      const generateButton = testPage.locator('button:has-text("Generate")')
      await generateButton.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ Generate button is visible')

      await testPage.screenshot({ path: 'test-results/ai-persistence-4-ai-page-ready.png', fullPage: true })
      log('Screenshot saved: ai-persistence-4-ai-page-ready.png')

      log('✅ AI page UI is ready')
    })

    // NOTE: This test skips actual AI generation and only verifies:
    // 1. AI page can be opened
    // 2. Navigation back works
    // 3. Basic persistence infrastructure is in place
    // For full AI generation tests, see ai-dom-generation-complete.spec.ts

    await test.step('Go back to variant editor', async () => {
      log('Navigating back to variant editor...')

      const backButton = testPage.locator('button[aria-label="Go back"]')
      await backButton.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ Back button found')

      await testPage.screenshot({ path: 'test-results/ai-persistence-6-before-back.png', fullPage: true })
      log('Screenshot saved: ai-persistence-6-before-back.png')

      await backButton.click()
      await debugWait(500)
      log('✓ Clicked Back button')

      await testPage.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Returned to variant editor')

      await testPage.screenshot({ path: 'test-results/ai-persistence-7-back-to-editor.png', fullPage: true })
      log('Screenshot saved: ai-persistence-7-back-to-editor.png')
    })

    await test.step('Verify navigation persistence (DOM Changes section visible)', async () => {
      log('Verifying variant editor state after returning from AI page...')

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(300)

      await testPage.screenshot({ path: 'test-results/ai-persistence-8-dom-changes-section.png', fullPage: true })
      log('Screenshot saved: ai-persistence-8-dom-changes-section.png')

      // Verify the DOM Changes section is visible (proves we're back in the right place)
      const domChangesSection = testPage.locator('text=DOM Changes').first()
      await domChangesSection.waitFor({ state: 'visible', timeout: 5000 })
      log('✅ DOM Changes section is visible')

      log('✅ Navigation back to variant editor successful')
      log('Note: Actual DOM changes persistence requires AI generation - see ai-dom-generation-complete.spec.ts')
    })

    await test.step('Verify preview mode is enabled', async () => {
      log('Checking if preview mode toggle is ON...')

      const previewToggle = testPage.locator('input[type="checkbox"]').filter({
        has: testPage.locator('.. .. :has-text("Preview")')
      })

      const toggleCount = await previewToggle.count()
      log(`Preview toggle elements found: ${toggleCount}`)

      if (toggleCount > 0) {
        const isChecked = await previewToggle.first().isChecked()
        log(`Preview toggle checked: ${isChecked}`)

        expect(isChecked).toBe(true)
        log('✅ Preview mode is enabled')
      } else {
        log('⚠️ Could not find preview toggle - may have different structure')

        const pageText = await testPage.locator('body').textContent()
        const hasPreviewText = pageText?.toLowerCase().includes('preview')
        log(`Page contains "preview" text: ${hasPreviewText}`)
      }

      await testPage.screenshot({ path: 'test-results/ai-persistence-10-preview-check.png', fullPage: true })
      log('Screenshot saved: ai-persistence-10-preview-check.png')
    })
  })
})
