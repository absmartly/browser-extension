import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'
import { injectSidebar, debugWait } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

test.describe('AI Conversation Switching', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      if (msgText.includes('[AIDOMChangesPage]') || msgText.includes('[ConversationStorage]') || msgText.includes('[Background]')) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }
    testPage.on('console', consoleHandler)

    testPage.on('frameattached', async (frame) => {
      frame.on('console', consoleHandler)
    })

    const [serviceWorker] = context.serviceWorkers()
    if (serviceWorker) {
      serviceWorker.on('console', (msg: any) => {
        console.log(`  🔧 [ServiceWorker] [${msg.type()}] ${msg.text()}`)
      })
    } else {
      context.on('serviceworker', (worker) => {
        worker.on('console', (msg: any) => {
          console.log(`  🔧 [ServiceWorker] [${msg.type()}] ${msg.text()}`)
        })
      })
    }

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=1`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded (test mode enabled)')
  })

  test.afterEach(async ({ clearStorage }) => {
    if (testPage) {
      await clearStorage().catch(() => {})
      await testPage.close()
    }
  })

  // TODO: SKIPPED - Test hangs during experiment creation (180s timeout)
  // Redundant with ai-conversation-history.spec.ts which tests same functionality
  // Uses forbidden debugWait() pattern
  // To fix: Rewrite using proper waits, reduce timeout to <10s, or remove if duplicate
  test.skip('should load and switch between multiple conversations', async ({ extensionUrl, seedStorage, getStorage }) => {
    test.setTimeout(SLOW_MODE ? 240000 : 180000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    const conversationIds: string[] = []

    await test.step('Setup: Pre-populate storage with 3 conversations', async () => {
      console.log('\n💾 STEP 1: Creating 3 conversations in storage')

      const conversations = []
      const baseTime = Date.now()

      for (let i = 0; i < 3; i++) {
        const convId = `conv-${i + 1}-${Math.random().toString(36).substring(7)}`
        const sessionId = `session-${i + 1}-${Math.random().toString(36).substring(7)}`

        const messages = [
          {
            role: 'user',
            content: `Conversation ${i + 1}: User message`,
            timestamp: baseTime - (3 - i) * 60000,
            id: `msg-user-${i}`
          },
          {
            role: 'assistant',
            content: `Conversation ${i + 1}: Assistant response`,
            timestamp: baseTime - (3 - i) * 60000 + 5000,
            id: `msg-assistant-${i}`
          }
        ]

        conversations.push({
          id: convId,
          variantName: 'A',
          messages,
          conversationSession: {
            id: sessionId,
            htmlSent: true,
            messages: []
          },
          createdAt: baseTime - (3 - i) * 60000,
          updatedAt: baseTime - (3 - i) * 60000 + 5000,
          messageCount: 2,
          firstUserMessage: `Conversation ${i + 1}: User message`,
          isActive: i === 2
        })

        console.log(`[TEST SETUP] Created conversation ${i + 1}: ${convId}`)
      }

      const storageData = {
        conversations,
        version: 1
      }

      await seedStorage({
        'ai-conversations-A': JSON.stringify(storageData)
      })

      console.log(`[TEST SETUP] Saved ${conversations.length} conversations to storage`)
      console.log('✅ 3 conversations pre-populated')
    })

    await test.step('Load AI page and verify active conversation', async () => {
      console.log('\n🤖 STEP 2: Loading AI page')

      await injectSidebar(testPage, extensionUrl)
      await debugWait()

      const experimentName = `Conversation Switching Test ${Date.now()}`
      await sidebar.locator('#create-experiment-button').click()
      await debugWait()

      const nameInput = sidebar.locator('#experiment-name-input')
      await nameInput.waitFor({ state: 'visible' })
      await nameInput.fill(experimentName)

      await sidebar.locator('#save-experiment-button').click()
      await debugWait(500)

      const generateButton = sidebar.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible' })
      await generateButton.click()
      await debugWait(500)

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ AI page loaded')

      await debugWait(1000)

      const messages = await sidebar.locator('.chat-message').count()
      console.log(`✅ Active conversation loaded with ${messages} messages`)
      expect(messages).toBeGreaterThan(0)

      const loadedLogs = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Loaded active conversation:')
      )
      expect(loadedLogs.length).toBeGreaterThan(0)

      await testPage.screenshot({ path: 'test-results/conv-switch-1-active-loaded.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-1-active-loaded.png')
    })

    await test.step('Open conversation history dropdown', async () => {
      console.log('\n📜 STEP 3: Opening conversation history')

      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.waitFor({ state: 'visible' })
      await historyButton.click()
      await debugWait(500)

      const dropdownTitle = sidebar.locator('text=Conversation History')
      await dropdownTitle.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Conversation history dropdown opened')

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemCount = await conversationItems.count()
      console.log(`✅ Found ${itemCount} conversations in list`)
      expect(itemCount).toBe(3)

      await testPage.screenshot({ path: 'test-results/conv-switch-2-history-open.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-2-history-open.png')
    })

    await test.step('Load a different conversation from history', async () => {
      console.log('\n🔄 STEP 4: Loading conversation 2')

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const secondConversation = conversationItems.nth(1)

      const conversationId = await secondConversation.getAttribute('id')
      console.log(`Loading conversation with id attribute: ${conversationId}`)

      await secondConversation.click()
      await debugWait(1000)

      const dropdownTitle = sidebar.locator('text=Conversation History')
      await dropdownTitle.waitFor({ state: 'hidden', timeout: 5000 })
      console.log('✅ Dropdown closed after selection')

      await debugWait(1000)

      const messages = await sidebar.locator('.chat-message').count()
      console.log(`✅ Loaded conversation now shows ${messages} messages`)

      const messageTexts = await sidebar.locator('.chat-message').allTextContents()
      const hasConversation2 = messageTexts.some(text => text.includes('Conversation 2'))

      if (hasConversation2) {
        console.log('✅ Conversation 2 content verified in messages')
      } else {
        console.log(`ℹ️  Message contents: ${messageTexts.join(' | ')}`)
      }

      await testPage.screenshot({ path: 'test-results/conv-switch-3-conv2-loaded.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-3-conv2-loaded.png')
    })

    await test.step('Verify active badge moved to loaded conversation', async () => {
      console.log('\n🏷️  STEP 5: Verifying active badge moved')

      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.click()
      await debugWait(500)

      const dropdownTitle = sidebar.locator('text=Conversation History')
      await dropdownTitle.waitFor({ state: 'visible', timeout: 5000 })

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemTexts = await conversationItems.allTextContents()

      const activeBadgeCount = itemTexts.filter(text => text.includes('Active')).length
      console.log(`Active badge appears ${activeBadgeCount} times`)
      expect(activeBadgeCount).toBe(1)

      const secondConvText = await conversationItems.nth(1).textContent()
      if (secondConvText?.includes('Active')) {
        console.log('✅ Active badge is on conversation 2 (the one we loaded)')
      } else {
        console.log(`ℹ️  Second conversation text: ${secondConvText}`)
      }

      await testPage.screenshot({ path: 'test-results/conv-switch-4-active-badge.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-4-active-badge.png')

      await testPage.keyboard.press('Escape')
      await debugWait(300)
    })

    await test.step('Load another conversation', async () => {
      console.log('\n🔄 STEP 6: Loading conversation 1')

      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.click()
      await debugWait(500)

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const firstConversation = conversationItems.first()

      await firstConversation.click()
      await debugWait(1000)

      const messages = await sidebar.locator('.chat-message').count()
      console.log(`✅ Conversation 1 now shows ${messages} messages`)

      const messageTexts = await sidebar.locator('.chat-message').allTextContents()
      const hasConversation1 = messageTexts.some(text => text.includes('Conversation 1'))

      if (hasConversation1) {
        console.log('✅ Conversation 1 content verified')
      }

      await testPage.screenshot({ path: 'test-results/conv-switch-5-conv1-loaded.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-5-conv1-loaded.png')
    })

    await test.step('Verify conversation persists across switching', async () => {
      console.log('\n💾 STEP 7: Verifying storage state')

      const allStorage = await getStorage()
      const conversationsJson = allStorage['ai-conversations-A'] as string
      expect(conversationsJson).toBeTruthy()

      const storage = JSON.parse(conversationsJson)
      expect(storage).toBeTruthy()
      expect(storage.conversations).toBeDefined()
      expect(storage.conversations.length).toBe(3)

      const activeConversations = storage.conversations.filter((c: any) => c.isActive)
      expect(activeConversations.length).toBe(1)
      console.log(`✅ Only one conversation is marked as active: ${activeConversations[0].id}`)

      const allHaveMessages = storage.conversations.every((c: any) => c.messages.length >= 2)
      expect(allHaveMessages).toBe(true)
      console.log('✅ All conversations still have their messages')
    })

    console.log('\n✅ Conversation switching test completed successfully!')
  })

  // TODO: SKIPPED - Same issues as first test (hanging, forbidden debugWait(), 180s timeout)
  // Redundant with ai-conversation-history.spec.ts test "New Chat button"
  test.skip('should start new chat while preserving old conversations', async ({ extensionUrl, getStorage }) => {
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Create first conversation', async () => {
      console.log('\n📝 STEP 1: Creating first conversation')

      await injectSidebar(testPage, extensionUrl)
      await debugWait()

      const experimentName = `New Chat Test ${Date.now()}`
      await sidebar.locator('#create-experiment-button').click()
      await debugWait()

      const nameInput = sidebar.locator('#experiment-name-input')
      await nameInput.waitFor({ state: 'visible' })
      await nameInput.fill(experimentName)

      await sidebar.locator('#save-experiment-button').click()
      await debugWait(500)

      const generateButton = sidebar.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible' })
      await generateButton.click()
      await debugWait(500)

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ AI page loaded')

      await debugWait(1000)

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('First conversation message')

      const generateBtn = sidebar.locator('#ai-generate-button')
      await generateBtn.click()

      await sidebar.locator('.chat-message').first().waitFor({ state: 'visible', timeout: 60000 })
      console.log('✅ First message sent and received')

      await debugWait(1000)
    })

    await test.step('Click New Chat button', async () => {
      console.log('\n🆕 STEP 2: Starting new chat')

      const newChatButton = sidebar.locator('button[title="New Chat"]')
      await newChatButton.waitFor({ state: 'visible' })
      await newChatButton.click()
      await debugWait(1000)

      const messages = await sidebar.locator('.chat-message').count()
      console.log(`✅ Message count after new chat: ${messages}`)
      expect(messages).toBe(0)

      const promptTextarea = sidebar.locator('#ai-prompt')
      const inputValue = await promptTextarea.inputValue()
      expect(inputValue).toBe('')
      console.log('✅ Prompt cleared for new chat')

      const newChatLogs = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] New chat session:')
      )
      expect(newChatLogs.length).toBeGreaterThan(0)
      console.log('✅ New chat session created')

      await testPage.screenshot({ path: 'test-results/conv-switch-new-1-cleared.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-new-1-cleared.png')
    })

    await test.step('Send message in new chat', async () => {
      console.log('\n💬 STEP 3: Sending message in new chat')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Second conversation message')

      const generateBtn = sidebar.locator('#ai-generate-button')
      await generateBtn.click()

      await sidebar.locator('.chat-message').first().waitFor({ state: 'visible', timeout: 60000 })
      console.log('✅ Message sent in new conversation')

      await debugWait(1000)
    })

    await test.step('Verify both conversations exist in storage', async () => {
      console.log('\n💾 STEP 4: Verifying both conversations in storage')

      const allStorage = await getStorage()
      const conversationsJson = allStorage['ai-conversations-A'] as string
      expect(conversationsJson).toBeTruthy()

      const storage = JSON.parse(conversationsJson)
      expect(storage).toBeTruthy()
      expect(storage.conversations).toBeDefined()
      expect(storage.conversations.length).toBe(2)
      console.log('✅ Both conversations exist in storage')

      const firstConvContent = storage.conversations.find((c: any) =>
        c.messages.some((m: any) => m.content.includes('First conversation'))
      )
      const secondConvContent = storage.conversations.find((c: any) =>
        c.messages.some((m: any) => m.content.includes('Second conversation'))
      )

      expect(firstConvContent).toBeTruthy()
      expect(secondConvContent).toBeTruthy()
      console.log('✅ Both conversations have correct content')

      const activeConversations = storage.conversations.filter((c: any) => c.isActive)
      expect(activeConversations.length).toBe(1)
      expect(activeConversations[0].messages.some((m: any) => m.content.includes('Second conversation'))).toBe(true)
      console.log('✅ Second (newest) conversation is marked as active')
    })

    await test.step('Load old conversation and verify it still works', async () => {
      console.log('\n🔄 STEP 5: Loading first conversation back')

      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.click()
      await debugWait(500)

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemCount = await conversationItems.count()
      expect(itemCount).toBe(2)
      console.log('✅ Both conversations appear in history')

      const firstConvInList = conversationItems.filter({ hasText: /First conversation/i }).first()
      const hasFirstConv = await firstConvInList.isVisible({ timeout: 3000 }).catch(() => false)

      if (hasFirstConv) {
        await firstConvInList.click()
        await debugWait(1000)
        console.log('✅ Loaded first conversation by content')
      } else {
        const allItems = conversationItems
        const secondItem = allItems.nth(1)
        await secondItem.click()
        await debugWait(1000)
        console.log('✅ Loaded first conversation by position')
      }

      const messages = await sidebar.locator('.chat-message').count()
      console.log(`✅ First conversation shows ${messages} messages`)
      expect(messages).toBeGreaterThan(0)

      await testPage.screenshot({ path: 'test-results/conv-switch-new-2-first-loaded.png', fullPage: true })
      console.log('Screenshot saved: conv-switch-new-2-first-loaded.png')
    })

    console.log('\n✅ New chat preservation test completed successfully!')
  })
})
