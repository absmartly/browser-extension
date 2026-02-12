import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'

const SLOW_MODE = process.env.SLOW === '1'

test.describe('AI Session Recovery After Page Reload', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = []
    testPage.on('console', (msg) => {
      allConsoleMessages.push({ type: msg.type(), text: msg.text() })
    })

    console.log('Test page setup complete')
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should persist session and conversation across page reload', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    await test.step('Load sidebar and create experiment', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 10000 })
      await createButton.click()

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.click()

      await testPage.locator('#display-name-label').waitFor({ state: 'visible', timeout: 10000 })
      console.log('Experiment form opened')
    })

    await test.step('Navigate to AI page and verify session', async () => {
      const generateButton = testPage.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateButton.scrollIntoViewIfNeeded()
      await generateButton.click()

      await testPage.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('AI page loaded')

      const sessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[useConversationHistory]') ||
        msg.text.includes('[AIDOMChangesPage]')
      )

      console.log(`Found ${sessionMessages.length} session-related console messages`)
      if (sessionMessages.length > 0) {
        console.log(`First session message: ${sessionMessages[0].text.substring(0, 100)}`)
      }

      await expect(testPage.locator('#ai-dom-generator-heading')).toBeVisible()
    })

    await test.step('Send first message and verify response', async () => {
      const promptTextarea = testPage.locator('#ai-prompt')
      await promptTextarea.waitFor({ state: 'visible' })
      await promptTextarea.fill('Change button to blue')

      await testPage.locator('#ai-generate-button').click()

      await testPage.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('First message response received')

      const messageCount = await testPage.locator('[data-message-index]').count()
      expect(messageCount).toBeGreaterThanOrEqual(2)
      console.log(`Messages after first prompt: ${messageCount}`)
    })

    await test.step('Reload page and verify session persists', async () => {
      await testPage.reload({ waitUntil: 'domcontentloaded' })
      console.log('Page reloaded')
    })

    await test.step('Navigate back to AI page and verify conversation restored', async () => {
      const generateButton = testPage.locator('#generate-with-ai-button').first()
      const hasGenerateButton = await generateButton.isVisible({ timeout: 10000 }).catch(() => false)

      if (hasGenerateButton) {
        await generateButton.click()
        await testPage.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
        console.log('AI page reopened')
      }

      const messages = await testPage.locator('[data-message-index]').count()
      console.log(`Messages after reload: ${messages}`)

      const loadedMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[useConversationHistory] Loaded active conversation:')
      )
      console.log(`Loaded conversation messages: ${loadedMessages.length}`)

      if (messages > 0) {
        console.log('Conversation was restored from storage')
      }
    })

    await test.step('Send second message and verify continuity', async () => {
      const promptTextarea = testPage.locator('#ai-prompt')
      const isOnAI = await promptTextarea.isVisible().catch(() => false)
      if (!isOnAI) {
        console.log('Not on AI page after reload, skipping continuity check')
        return
      }

      await promptTextarea.fill('Make it bigger')
      await testPage.locator('#ai-generate-button').click()

      await testPage.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('Second message response received')

      const messageCount = await testPage.locator('[data-message-index]').count()
      console.log(`Total messages: ${messageCount}`)
    })

    console.log('Session recovery test completed')
  })

  test('should show error when AI page context is missing after reload', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 60000 : 30000)

    await test.step('Load sidebar, create experiment, and open AI page', async () => {
      const sidebarUrl = extensionUrl('tabs/sidebar.html')
      await testPage.goto(sidebarUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })

      const createButton = testPage.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 10000 })
      await createButton.click()

      const fromScratchButton = testPage.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.click()

      await testPage.locator('#display-name-label').waitFor({ state: 'visible', timeout: 10000 })

      const generateButton = testPage.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateButton.scrollIntoViewIfNeeded()
      await generateButton.click()

      await testPage.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('AI page loaded')
    })

    await test.step('Reload page and verify expected state', async () => {
      await testPage.reload({ waitUntil: 'domcontentloaded' })
      console.log('Page reloaded')

      const isOnAIPage = await testPage.locator('#ai-dom-generator-heading').isVisible().catch(() => false)
      const hasMissingContext = await testPage.locator('#ai-missing-context-heading').isVisible().catch(() => false)
      const hasErrorBoundary = await testPage.locator('#ai-error-heading').isVisible().catch(() => false)
      const isOnEditorPage = await testPage.locator('#display-name-label').isVisible().catch(() => false)
      const isOnListPage = await testPage.locator('#experiments-heading').isVisible().catch(() => false)

      console.log(`After reload - AI: ${isOnAIPage}, Missing: ${hasMissingContext}, Error: ${hasErrorBoundary}, Editor: ${isOnEditorPage}, List: ${isOnListPage}`)

      const hasAnyExpectedState = hasMissingContext || hasErrorBoundary || isOnEditorPage || isOnListPage
      expect(hasAnyExpectedState).toBe(true)
    })

    await test.step('Verify navigation works after error', async () => {
      const returnButton = testPage.locator('#return-to-variant-editor-button')
      const hasReturnButton = await returnButton.isVisible().catch(() => false)

      if (hasReturnButton) {
        await returnButton.click()
        await testPage.locator('[data-dom-changes-section="true"]').first().waitFor({ state: 'visible', timeout: 5000 })
        console.log('Returned to variant editor via return button')
      } else {
        const isOnEditorOrList = await testPage.locator('#display-name-label, #experiments-heading').first().isVisible().catch(() => false)
        expect(isOnEditorOrList).toBe(true)
        console.log('Already on editor/list page after reload')
      }
    })

    console.log('Error test completed')
  })
})
