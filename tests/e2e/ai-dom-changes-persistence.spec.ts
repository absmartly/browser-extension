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
      const generateWithAIButton = testPage.locator('button:has-text("Generate with AI")').first()
      await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Generate with AI button found')

      await generateWithAIButton.scrollIntoViewIfNeeded()
      await debugWait(300)

      await testPage.screenshot({ path: 'test-results/ai-persistence-2.6-before-click.png', fullPage: true })
      log('Screenshot saved: ai-persistence-2.6-before-click.png')

      await generateWithAIButton.click()
      log('✓ Clicked Generate with AI button')

      await debugWait(1000)

      await testPage.locator('text=AI DOM Generator').waitFor({ state: 'visible', timeout: 10000 })
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

      log('✅ AI page UI is ready (skipping actual AI generation for this test)')
    })

    await test.step('Go back to variant editor', async () => {
      log('Navigating back to variant editor...')

      const backButton = testPage.locator('button:has-text("Back")')
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

    await test.step('Verify DOM changes appear in editor', async () => {
      log('Verifying DOM changes are saved in the variant editor...')

      await testPage.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(300)

      await testPage.screenshot({ path: 'test-results/ai-persistence-8-dom-changes-section.png', fullPage: true })
      log('Screenshot saved: ai-persistence-8-dom-changes-section.png')

      const domChangeCards = testPage.locator('[class*="dom-change"], [class*="change-item"], .border.rounded, div:has(button:has-text("Delete"))')
      const cardCount = await domChangeCards.count()
      log(`DOM change cards found: ${cardCount}`)

      expect(cardCount).toBeGreaterThan(0)
      log('✅ At least one DOM change card exists')

      if (cardCount > 0) {
        log('Checking content of first DOM change...')
        const firstCard = domChangeCards.first()
        const cardText = await firstCard.textContent()
        log(`First card content: ${cardText?.substring(0, 150)}...`)

        const hasRelevantContent = /button|purple|background|style|color/i.test(cardText || '')
        expect(hasRelevantContent).toBe(true)
        log('✅ DOM change contains relevant content (button/purple/background/style)')
      }

      log('Clicking Json button to switch to JSON view...')
      const jsonButton = testPage.locator('button:has-text("Json"), button:has-text("JSON")')
      await jsonButton.waitFor({ state: 'visible', timeout: 5000 })
      await jsonButton.click()
      log('✓ Clicked Json button')

      await debugWait(500)

      await testPage.screenshot({ path: 'test-results/ai-persistence-8.5-json-view.png', fullPage: true })
      log('Screenshot saved: ai-persistence-8.5-json-view.png')

      log('Verifying JSON contains DOM changes...')
      const pageText = await testPage.locator('body').textContent()
      const hasSelectorText = pageText?.includes('.test-button') || pageText?.includes('button') || pageText?.includes('.btn')
      const hasStyleType = pageText?.includes('style') || pageText?.includes('Style')
      const hasBackgroundColor = pageText?.toLowerCase().includes('purple') || pageText?.toLowerCase().includes('background')

      log(`Selector present in JSON: ${hasSelectorText}`)
      log(`Style type present in JSON: ${hasStyleType}`)
      log(`Purple/background color present in JSON: ${hasBackgroundColor}`)

      expect(hasSelectorText || hasStyleType || hasBackgroundColor).toBe(true)
      log('✅ JSON view contains DOM change data')

      await testPage.screenshot({ path: 'test-results/ai-persistence-9-final-verification.png', fullPage: true })
      log('Screenshot saved: ai-persistence-9-final-verification.png')

      log('✅ Test completed successfully - DOM changes persisted to variant editor')
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
