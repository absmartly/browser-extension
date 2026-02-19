import { test, expect } from '../fixtures/extension'
import { setupTestPage, injectSidebar, click, debugWait, log, initializeTestLogging } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('IndexedDB Conversation Persistence', () => {
  let testPage: any

  test.beforeEach(async ({ context, seedStorage }) => {
    initializeTestLogging()
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey'
    })
    testPage = await context.newPage()
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) {
      await testPage.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        await new Promise<void>((resolve) => {
          const request = indexedDB.deleteDatabase(DB_NAME)
          request.onsuccess = () => resolve()
          request.onerror = () => resolve()
        })
      }).catch(() => {})
      await testPage.close()
    }
  })

  test('should persist conversations to IndexedDB', async ({ context, extensionUrl }) => {
    test.skip(true, 'Requires AI generation with real API and full extension context for conversation persistence across reloads')
    test.setTimeout(process.env.SLOW === '1' ? 120000 : 60000)

    let sidebar: any

    await test.step('Setup page and sidebar', async () => {
      log('Setting up test page and sidebar...')

      const result = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
      sidebar = result.sidebar

      log('✓ Test page and sidebar loaded')
    })

    await test.step('Navigate to AI page', async () => {
      log('Creating new experiment...')

      await click(sidebar, 'button[title="Create New Experiment"]', 10000)
      await debugWait()

      log('Clicking "From Scratch"...')
      await click(sidebar, '#from-scratch-button', 5000)
      await debugWait()
      log('✓ From Scratch clicked')

      await sidebar.locator('#display-name-label').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Experiment editor opened')

      log('Navigating to AI page...')
      const domChangesHeading = sidebar.locator('#dom-changes-heading').first()
      await domChangesHeading.scrollIntoViewIfNeeded().catch(() => {})
      await debugWait()

      const generateWithAIButton = sidebar.locator('#generate-with-ai-button').first()
      await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateWithAIButton.scrollIntoViewIfNeeded().catch(() => {})
      await debugWait()

      await click(sidebar, generateWithAIButton)
      log('✓ Clicked Generate with AI button')
      await debugWait()

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ AI page opened')

      const promptInput = sidebar.locator('textarea[placeholder*="Example"]')
      await promptInput.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ AI page ready')
    })

    await test.step('Create conversations by sending prompts (real user behavior)', async () => {
      log('Creating conversations by sending prompts...')

      const prompts = [
        'Make the main heading blue',
        'Change the button text to "Click Me"',
        'Hide the footer element'
      ]

      for (let i = 0; i < prompts.length; i++) {
        const prompt = prompts[i]
        log(`Sending prompt ${i + 1}: "${prompt}"`)

        const promptTextarea = sidebar.locator('textarea[placeholder*="Example"]').first()
        await promptTextarea.waitFor({ state: 'visible', timeout: 5000 })
        await promptTextarea.fill(prompt)
        log('  ✓ Prompt entered')
        await debugWait()

        const generateButton = sidebar.locator('#ai-generate-button')
        await generateButton.waitFor({ state: 'visible', timeout: 5000 })
        await click(sidebar, generateButton)
        log('  ⏳ Generating...')
        await debugWait()

        const generatingText = sidebar.locator('text=Generating').first()
        await generatingText.waitFor({ state: 'hidden', timeout: 30000 }).catch(() => {
          log('  ⚠️ Generation text did not disappear')
        })
        log('  ✓ Generation complete')
        await debugWait()

        const closeButton = sidebar.locator('button[aria-label="Close"]')
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click()
          await debugWait()
        }

        if (i < prompts.length - 1) {
          const newChatButton = sidebar.locator('button[title="New Chat"]')
          if (await newChatButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await click(sidebar, newChatButton)
            log('  ✓ Started new chat for next prompt')
            await debugWait()
          }
        }
      }

      log(`✅ Created ${prompts.length} conversations via real prompts`)
    })

    await test.step('Verify conversations automatically saved to IndexedDB', async () => {
      log('Verifying conversations were automatically saved to IndexedDB...')

      await testPage.screenshot({
        path: 'test-results/before-history-check.png',
        fullPage: true
      })

      const historyButton = sidebar.locator('button[title="Conversation History"]')

      try {
        await historyButton.waitFor({ state: 'visible', timeout: 10000 })
      } catch (e) {
        await testPage.screenshot({
          path: 'test-results/history-button-missing.png',
          fullPage: true
        })
        log('ERROR: History button not visible')

        const pageAlive = await testPage.evaluate(() => true).catch(() => false)
        log(`Page alive: ${pageAlive}`)

        throw new Error('History button not visible - see screenshot')
      }

      const isDisabled = await historyButton.isDisabled()
      log(`History button disabled: ${isDisabled}`)

      if (isDisabled) {
        log('⚠️ History button is disabled - checking if conversations were saved...')

        const savedCount = await sidebar.locator('body').evaluate(async () => {
          const DB_NAME = 'absmartly-conversations'
          try {
            const db = await new Promise<IDBDatabase>((resolve, reject) => {
              const request = indexedDB.open(DB_NAME)
              request.onsuccess = () => resolve(request.result)
              request.onerror = () => reject(request.error)
            })

            const tx = db.transaction('conversations', 'readonly')
            const store = tx.objectStore('conversations')
            const allRequest = store.getAll()

            return await new Promise<number>((resolve) => {
              allRequest.onsuccess = () => resolve(allRequest.result?.length || 0)
              allRequest.onerror = () => resolve(0)
            })
          } catch (e) {
            return 0
          }
        })

        log(`Conversations found in IndexedDB: ${savedCount}`)
      }

      expect(isDisabled).toBe(false)
      log('✅ History button is enabled (conversations exist in IndexedDB)')

      await click(sidebar, historyButton)
      await debugWait()

      const conversationHistoryTitle = sidebar.locator('#conversation-history-title')
      await conversationHistoryTitle.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ Conversation history dropdown opened')

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemCount = await conversationItems.count()
      log(`Conversation items found: ${itemCount}`)

      expect(itemCount).toBeGreaterThanOrEqual(1)
      log(`✅ ${itemCount} conversation(s) loaded from IndexedDB`)

      await testPage.screenshot({
        path: 'test-results/indexeddb-persistence-1.png',
        fullPage: true
      })
      log('Screenshot saved: indexeddb-persistence-1.png')
    })

    await test.step('Verify persistence across page reloads', async () => {
      log('Reloading page to test persistence...')

      await testPage.screenshot({
        path: 'test-results/before-reload.png',
        fullPage: true
      })
      log('Screenshot saved: before-reload.png')

      await testPage.reload({ waitUntil: 'domcontentloaded' })
      await debugWait()

      const pageAlive = await testPage.evaluate(() => true).catch(() => false)
      log(`Page alive after reload: ${pageAlive}`)

      if (!pageAlive) {
        throw new Error('Page crashed immediately after reload!')
      }

      await testPage.screenshot({
        path: 'test-results/after-reload.png',
        fullPage: true
      })
      log('Screenshot saved: after-reload.png')

      log('Checking if sidebar iframe exists after reload...')
      const sidebarIframeExists = await testPage.locator('#absmartly-sidebar-iframe').isVisible({ timeout: 2000 }).catch(() => false)
      log(`Sidebar iframe exists: ${sidebarIframeExists}`)

      if (!sidebarIframeExists) {
        log('Sidebar iframe was destroyed during reload. Re-injecting...')
        sidebar = await injectSidebar(testPage, extensionUrl)
        log('✓ Sidebar re-injected')
      } else {
        log('Re-acquiring sidebar frame locator after reload...')
        sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

        log('Waiting for sidebar to reload...')
        await sidebar.locator('body').waitFor({ state: 'visible', timeout: 10000 })
        log('✓ Sidebar body visible')
      }

      await testPage.screenshot({
        path: 'test-results/after-sidebar-reinjection.png',
        fullPage: true
      })
      log('Screenshot saved: after-sidebar-reinjection.png')

      log('Checking what page the sidebar loaded...')

      await sidebar.locator('#experiments-heading, #ai-dom-generator-heading, #configure-settings-button, [data-testid="experiment-list"]').first().waitFor({ state: 'visible', timeout: 10000 }).catch(() => {})

      const experimentList = sidebar.locator('[data-testid="experiment-list"]').first()
      const expHeading = sidebar.locator('#experiments-heading').first()
      const aiPageTitle = sidebar.locator('#ai-dom-generator-heading').first()
      const welcomeScreen = sidebar.locator('#configure-settings-button').first()

      const isOnExpList = await experimentList.isVisible().catch(() => false) || await expHeading.isVisible().catch(() => false)
      const isOnAI = await aiPageTitle.isVisible().catch(() => false)
      const isOnWelcome = await welcomeScreen.isVisible().catch(() => false)

      log(`After reinjection - Experiment list: ${isOnExpList}, AI page: ${isOnAI}, Welcome: ${isOnWelcome}`)

      if (isOnWelcome) {
        log('Sidebar loaded on welcome page - credentials may have been lost. Navigating to settings...')
        await welcomeScreen.evaluate((btn: HTMLElement) =>
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        )
        await debugWait()
      }

      if (!isOnExpList && !isOnAI && !isOnWelcome) {
        await testPage.screenshot({
          path: 'test-results/sidebar-unexpected-page.png',
          fullPage: true
        })
        log('ERROR: Sidebar not on expected page - screenshot saved')
        throw new Error('Sidebar not on experiment list or AI page after reload')
      }

      let needsNavigation = true

      if (isOnAI) {
        log('Sidebar already on AI page - checking if it needs reinitialization...')

        const reinitMessage = sidebar.locator('#ai-reinit-message').first()
        const needsReinit = await reinitMessage.isVisible({ timeout: 2000 }).catch(() => false)

        if (needsReinit) {
          log('AI page needs reinitialization - will navigate from experiment list')

          const returnButton = sidebar.locator('#return-to-variant-editor-button').first()
          await returnButton.waitFor({ state: 'visible', timeout: 5000 })
          await click(sidebar, returnButton)
          await debugWait()
          log('✓ Returned from broken AI page')

          await sidebar.locator('#dom-changes-heading').waitFor({ state: 'visible', timeout: 5000 })
          log('✓ Back at variant editor (experiment detail page)')
          needsNavigation = true
        } else {
          log('AI page appears functional - no navigation needed')
          needsNavigation = false
        }
      }

      if (needsNavigation) {
        log('Navigating to AI page...')

        const experimentListEl = sidebar.locator('[data-testid="experiment-list"]').first()
        const expHeadingEl = sidebar.locator('#experiments-heading').first()
        const domChangesSection = sidebar.locator('#dom-changes-heading').first()

        const isOnExpListInner = await experimentListEl.isVisible({ timeout: 2000 }).catch(() => false) || await expHeadingEl.isVisible({ timeout: 2000 }).catch(() => false)
        const isOnDetailPage = await domChangesSection.isVisible({ timeout: 2000 }).catch(() => false)

        if (isOnExpListInner) {
          log('Starting from experiment list - waiting for experiments to load...')
          const firstExperiment = sidebar.locator('[data-testid="experiment-card"]').first()
          await firstExperiment.waitFor({ state: 'visible', timeout: 15000 })
          await click(sidebar, firstExperiment)
          await debugWait()
          log('✓ Clicked experiment')

          await sidebar.locator('#dom-changes-heading').waitFor({ state: 'visible', timeout: 10000 })
          log('✓ Experiment detail page loaded')
        } else if (isOnDetailPage) {
          log('Already on experiment detail page')
        } else {
          log('ERROR: Unknown starting page')
          throw new Error('Cannot navigate - unknown page state')
        }

        const generateWithAIButton = sidebar.locator('#generate-with-ai-button').first()
        await generateWithAIButton.scrollIntoViewIfNeeded().catch(() => {})
        await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
        await click(sidebar, generateWithAIButton)
        await debugWait()

        await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
        log('✓ AI page reopened after reload')
      }

      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.waitFor({ state: 'visible', timeout: 5000 })

      const isDisabled = await historyButton.isDisabled()
      expect(isDisabled).toBe(false)

      await click(sidebar, historyButton)
      await debugWait()

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemCount = await conversationItems.count()

      expect(itemCount).toBeGreaterThanOrEqual(1)
      log(`✅ ${itemCount} conversation(s) persisted after page reload`)

      await testPage.screenshot({
        path: 'test-results/indexeddb-persistence-2.png',
        fullPage: true
      })
      log('Screenshot saved: indexeddb-persistence-2.png')
    })
  })
})
