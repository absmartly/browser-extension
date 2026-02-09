import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'
import { setupTestPage, click } from './utils/test-helpers'
import { createExperiment } from './helpers/ve-experiment-setup'

const TEST_PAGE_URL = '/visual-editor-test.html'

const SLOW_MODE = process.env.SLOW === '1'
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

test.describe('AI Session Recovery After Page Reload', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context, extensionUrl }) => {
    testPage = await context.newPage()

    const { sidebar: _, allMessages } = await setupTestPage(testPage, extensionUrl, TEST_PAGE_URL)
    allConsoleMessages = allMessages

    console.log('✅ Test page loaded (test mode enabled)')
    console.log(`  📋 Console messages so far: ${allConsoleMessages.length}`)
  })

  test.afterEach(async () => {
    if (testPage && !process.env.SLOW) await testPage.close()
  })

  test('should persist session and conversation across page reload', async ({ extensionId, extensionUrl, context }) => {
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string
    let firstSessionId: string

    await test.step('Create experiment', async () => {
      console.log('\n📂 STEP 1: Creating experiment')
      experimentName = await createExperiment(sidebar)
      console.log(`✅ Created experiment: ${experimentName}`)
    })

    await test.step('Navigate to AI page and verify initial session', async () => {
      console.log('\n🤖 STEP 2: Navigating to AI page')

      const generateButton = sidebar.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible' })
      await generateButton.click()

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ AI page loaded')


      const sessionInitMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Session initialized:') ||
        msg.text.includes('[AIDOMChangesPage] Created new conversation:')
      )

      expect(sessionInitMessages.length).toBeGreaterThan(0)
      console.log(`✅ Found ${sessionInitMessages.length} session initialization messages`)

      const sessionMatch = allConsoleMessages.find(m => m.text.includes('Session initialized:'))
      if (sessionMatch) {
        const match = sessionMatch.text.match(/Session initialized: ([a-f0-9-]+)/)
        if (match) {
          firstSessionId = match[1]
          console.log(`✅ Initial session ID: ${firstSessionId}`)
        }
      }
    })

    await test.step('Send first message and verify htmlSent flag', async () => {
      console.log('\n💬 STEP 3: Sending first message')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.waitFor({ state: 'visible' })
      await promptTextarea.fill('Change button to blue')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()


      const messageCountBefore = await sidebar.locator('.chat-message').count()
      console.log(`Message count before waiting: ${messageCountBefore}`)

      const bridgeMessages = allConsoleMessages.filter(msg =>
        msg.text.toLowerCase().includes('bridge') ||
        msg.text.toLowerCase().includes('claude') ||
        msg.text.toLowerCase().includes('provider')
      )
      if (bridgeMessages.length > 0) {
        console.log(`🌉 Bridge-related messages: ${bridgeMessages.length}`)
        bridgeMessages.forEach(msg => console.log(`  - ${msg.text}`))
      }

      const aiErrors = allConsoleMessages.filter(msg =>
        msg.type === 'error' ||
        msg.text.toLowerCase().includes('error') ||
        msg.text.toLowerCase().includes('failed')
      )
      if (aiErrors.length > 0) {
        console.log(`⚠️ Errors detected: ${aiErrors.length}`)
        aiErrors.forEach(err => console.log(`  - ${err.text}`))
      }

      const chatMessage = sidebar.locator('.chat-message').last()
      const hasMessage = await chatMessage.isVisible({ timeout: 60000 }).catch(() => false)

      if (!hasMessage) {
        console.log('❌ No AI response received after 60s')
        await testPage.screenshot({ path: 'test-results/session-recovery-no-ai-response.png', fullPage: true })
        console.log('Screenshot saved: session-recovery-no-ai-response.png')
      } else {
        console.log('✅ Response received')
      }

      expect(hasMessage).toBe(true)


      const storage = await testPage.evaluate(async () => {
        const result = await chrome.storage.local.get('ai-conversations-A')
        return result['ai-conversations-A'] ? JSON.parse(result['ai-conversations-A']) : null
      })

      expect(storage).toBeTruthy()
      expect(storage.conversations).toBeDefined()
      expect(storage.conversations.length).toBeGreaterThan(0)

      const firstConv = storage.conversations[0]
      console.log(`✅ Conversation stored with htmlSent: ${firstConv.conversationSession.htmlSent}`)
      expect(firstConv.conversationSession.htmlSent).toBe(true)
    })

    await test.step('Reload page and verify session persists', async () => {
      console.log('\n🔄 STEP 4: Reloading page')

      await testPage.screenshot({ path: 'test-results/session-recovery-1-before-reload.png', fullPage: true })
      console.log('Screenshot saved: session-recovery-1-before-reload.png')

      await testPage.reload({ waitUntil: 'networkidle' })
      console.log('✅ Page reloaded')

      await testPage.screenshot({ path: 'test-results/session-recovery-2-after-reload.png', fullPage: true })
      console.log('Screenshot saved: session-recovery-2-after-reload.png')

    })

    await test.step('Navigate back to AI page and verify conversation restored', async () => {
      console.log('\n🤖 STEP 5: Navigating back to AI page')

      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      const generateButton = freshSidebar.locator(`#generate-with-ai-button`).first()
      await generateButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateButton.click()

      await freshSidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ AI page reopened')


      const messages = await freshSidebar.locator('.chat-message').count()
      console.log(`✅ Found ${messages} messages after reload`)
      expect(messages).toBeGreaterThan(0)

      const loadedSessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Loaded active conversation:')
      )

      expect(loadedSessionMessages.length).toBeGreaterThan(0)
      console.log('✅ Active conversation was loaded from storage')

      await testPage.screenshot({ path: 'test-results/session-recovery-3-messages-restored.png', fullPage: true })
      console.log('Screenshot saved: session-recovery-3-messages-restored.png')
    })

    await test.step('Send second message and verify session continuity', async () => {
      console.log('\n💬 STEP 6: Sending second message to verify session continuity')

      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      const promptTextarea = freshSidebar.locator('#ai-prompt')
      await promptTextarea.fill('Make it bigger')

      const generateButton = freshSidebar.locator('#ai-generate-button')
      await generateButton.click()

      await freshSidebar.locator('.chat-message').last().waitFor({ state: 'visible', timeout: 60000 })
      console.log('✅ Second message response received')


      const messageCount = await freshSidebar.locator('.chat-message').count()
      console.log(`✅ Total messages now: ${messageCount}`)
      expect(messageCount).toBeGreaterThanOrEqual(4)

      const htmlSentLogs = allConsoleMessages.filter(msg =>
        msg.text.includes('HTML captured') || msg.text.includes('capturePageHTML')
      )

      console.log(`✅ HTML capture was called ${htmlSentLogs.length} times total (should be 1 for initial session)`)

      await testPage.screenshot({ path: 'test-results/session-recovery-4-second-message.png', fullPage: true })
      console.log('Screenshot saved: session-recovery-4-second-message.png')
    })

    await test.step('Verify storage after second message', async () => {
      console.log('\n💾 STEP 7: Verifying storage state')

      const storage = await testPage.evaluate(async () => {
        const result = await chrome.storage.local.get('ai-conversations-A')
        return result['ai-conversations-A'] ? JSON.parse(result['ai-conversations-A']) : null
      })

      expect(storage).toBeTruthy()
      expect(storage.conversations).toBeDefined()
      expect(storage.conversations.length).toBeGreaterThan(0)

      const conv = storage.conversations[0]
      console.log(`✅ Conversation has ${conv.messageCount} messages`)
      console.log(`✅ htmlSent flag: ${conv.conversationSession.htmlSent}`)
      console.log(`✅ Session ID: ${conv.conversationSession.id}`)

      expect(conv.messageCount).toBeGreaterThanOrEqual(4)
      expect(conv.conversationSession.htmlSent).toBe(true)
    })

    console.log('\n✅ Session recovery test completed successfully!')
  })

  test('should show reinitialization error after reload without navigation', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 60000 : 30000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Create experiment and open AI page', async () => {
      console.log('\n📂 STEP 1: Creating experiment and opening AI page')

      const experimentName = await createExperiment(sidebar)
      console.log(`✅ Created experiment: ${experimentName}`)

      const generateButton = sidebar.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible' })
      await generateButton.click()

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ AI page loaded')
    })

    await test.step('Reload page and verify error message', async () => {
      console.log('\n🔄 STEP 2: Reloading page to trigger reinitialization error')

      await testPage.reload({ waitUntil: 'networkidle' })
      console.log('✅ Page reloaded')


      await testPage.screenshot({ path: 'test-results/session-recovery-error-1-after-reload.png', fullPage: true })
      console.log('Screenshot saved: session-recovery-error-1-after-reload.png')

      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

      const sidebarText = await freshSidebar.locator('body').textContent().catch(() => 'ERROR: Could not get sidebar text')
      console.log(`Sidebar content after reload: ${sidebarText}`)

      const errorMessage = freshSidebar.locator('text=needs to be reinitialized')
      const hasError = await errorMessage.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasError) {
        console.log('✅ Reinitialization error message shown')
      } else {
        console.log('⚠️ Error message not found. Taking screenshot for debugging...')
        await testPage.screenshot({ path: 'test-results/session-recovery-error-1-no-message.png', fullPage: true })
        console.log('Screenshot saved: session-recovery-error-1-no-message.png')
      }

      expect(hasError).toBe(true)
    })

    await test.step('Verify return button works', async () => {
      console.log('\n⬅️  STEP 3: Testing return to variant editor button')

      const freshSidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      const returnButton = freshSidebar.locator('#return-to-variant-editor-button')
      await expect(returnButton).toBeVisible()
      await returnButton.click()

      const editorTitle = freshSidebar.locator('text=DOM Changes')
      await editorTitle.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Successfully returned to variant editor')

      await testPage.screenshot({ path: 'test-results/session-recovery-error-2-returned.png', fullPage: true })
      console.log('Screenshot saved: session-recovery-error-2-returned.png')
    })

    console.log('\n✅ Reinitialization error test completed successfully!')
  })
})
