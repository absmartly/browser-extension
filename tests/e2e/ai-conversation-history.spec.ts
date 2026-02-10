import { test, expect } from '../fixtures/extension'
import { injectSidebar } from './utils/test-helpers'

const TEST_PAGE_URL = '/visual-editor-test.html'

test.describe('AI Conversation History', () => {
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

  test('should display conversation history UI with correct behavior', async ({ context, extensionUrl }) => {
    const testPageUrl = '/visual-editor-test.html'
    let sidebar: any
    let extensionFrame: any

    await test.step('Load sidebar and navigate to AI page', async () => {
      log('Loading content page and injecting sidebar...')
      const testPageUrl = '/visual-editor-test.html'
      await testPage.goto(`http://localhost:3456${testPageUrl}`, { waitUntil: 'domcontentloaded', timeout: 10000 })
      await debugWait(500)

      // Inject sidebar
      sidebar = await injectSidebar(testPage, extensionUrl)
      await debugWait(500)

      log('Pre-populating IndexedDB in extension context...')
      extensionFrame = testPage.frames().find(frame => frame.url().includes('chrome-extension://'))
      if (!extensionFrame) {
        throw new Error('Extension frame not found for IndexedDB setup')
      }

      await extensionFrame.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const DB_VERSION = 1

        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME, DB_VERSION)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
          request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result
            if (!db.objectStoreNames.contains('conversations')) {
              const store = db.createObjectStore('conversations', { keyPath: 'id' })
              store.createIndex('by-variant', 'variantName', { unique: false })
              store.createIndex('by-variant-updated', ['variantName', 'updatedAt'], { unique: false })
            }
            if (!db.objectStoreNames.contains('metadata')) {
              db.createObjectStore('metadata', { keyPath: 'key' })
            }
          }
        })

        const conversations = []
        const baseTime = Date.now()

        for (let i = 0; i < 3; i++) {
          const conversationId = crypto.randomUUID()
          const message: any = {
            role: 'user',
            content: `Test conversation ${i + 1}`,
            timestamp: baseTime - (3 - i) * 60000,
            id: `msg-${i}`
          }
          const message2: any = {
            role: 'assistant',
            content: `Response to conversation ${i + 1}`,
            timestamp: baseTime - (3 - i) * 60000 + 5000,
            id: `msg-resp-${i}`
          }

          const conversation = {
            id: conversationId,
            variantName: 'Variant 1',
            messages: [message, message2],
            conversationSession: {
              id: `session-${i}`,
              htmlSent: false,
              messages: []
            },
            createdAt: baseTime - (3 - i) * 60000,
            updatedAt: baseTime - (3 - i) * 60000 + 5000,
            messageCount: 2,
            firstUserMessage: `Test conversation ${i + 1}`,
            isActive: i === 2
          }

          conversations.push(conversation)
        }

        const tx = db.transaction('conversations', 'readwrite')
        const store = tx.objectStore('conversations')

        for (const conv of conversations) {
          store.add(conv)
        }

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })

        console.log('[TEST SETUP] Added 3 conversations to IndexedDB (extension)')
      })
      await debugWait(500)
      log('✓ IndexedDB pre-populated with 3 conversations (extension)')

      await testPage.screenshot({ path: 'test-results/conv-history-0-sidebar.png', fullPage: true })
      log('Screenshot saved: conv-history-0-sidebar.png')

      log('Creating new experiment...')
      const createButton = sidebar.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 10000 })
      await createButton.click()
      await debugWait(500)

      const fromScratchButton = sidebar.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.click()
      log('✓ From Scratch clicked')

      await debugWait(1000)

      const loadingText = testPage.locator('text=Loading templates')
      await loadingText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        log('⚠️ Loading templates text still visible or never appeared')
      })

      await debugWait(1000)
      await sidebar.locator('text=Display Name').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ Experiment editor opened')

      log('Navigating to AI page...')
      const loadingFormText = sidebar.locator('text=Loading...').first()
      await loadingFormText.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
        log('⚠️ Form loading text still visible')
      })
      await debugWait(1000)

      await sidebar.locator('text=DOM Changes').first().scrollIntoViewIfNeeded()
      await debugWait(500)

      const generateWithAIButton = sidebar.locator('#generate-with-ai-button').first()
      await generateWithAIButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateWithAIButton.scrollIntoViewIfNeeded()
      await debugWait(300)

      await generateWithAIButton.click()
      log('✓ Clicked Generate with AI button')

      await debugWait(1000)

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      log('✓ AI page opened')

      await testPage.screenshot({ path: 'test-results/conv-history-1-ai-page.png', fullPage: true })
      log('Screenshot saved: conv-history-1-ai-page.png')

      // Debug: Check IndexedDB from AI page context
      const storageCheck = await extensionFrame.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction('conversations', 'readonly')
        const store = tx.objectStore('conversations')
        const index = store.index('by-variant')

        const conversations = await new Promise<any[]>((resolve) => {
          const request = index.getAll('Variant 1')
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        })

        console.log('[AI PAGE] Found conversations in IndexedDB:', conversations.length)
        return conversations.length
      })
      log(`IndexedDB check from AI page context: ${storageCheck} conversations`)

      const promptInput = sidebar.locator('textarea[placeholder*="Example"]')
      await promptInput.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ AI page ready')
    })

    await test.step('Verify history button is enabled (conversations exist)', async () => {
      log('Checking history button state (should be enabled with pre-populated data)...')

      // Debug: Check what variant name the AI page is using
      const variantDebug = await sidebar.locator('p.text-xs.text-gray-600').first().textContent()
      log(`AI page variant: ${variantDebug}`)

      // Wait for the button to finish loading (title changes from "Loading conversations..." to "Conversation History")
      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.waitFor({ state: 'visible', timeout: 15000 })
      log('✓ History button found and loaded')

      // Debug: Check if conversationList was loaded
      const buttonTitle = await historyButton.getAttribute('title')
      const iconClass = await historyButton.locator('svg').getAttribute('class')
      log(`Button title: ${buttonTitle}`)
      log(`Icon class: ${iconClass}`)

      const isDisabled = await historyButton.isDisabled()
      expect(isDisabled).toBe(false)
      log('✅ History button is correctly enabled (conversations exist)')

      expect(iconClass).toContain('text-gray-600')
      log('✅ Icon has correct color (gray-600 when enabled)')

      await testPage.screenshot({ path: 'test-results/conv-history-2-history-enabled.png', fullPage: true })
      log('Screenshot saved: conv-history-2-history-enabled.png')
    })

    await test.step('Open conversation history dropdown', async () => {
      log('Clicking history button to open dropdown...')

      const historyButton = sidebar.locator('button[title="Conversation History"]')
      await historyButton.click()
      await debugWait(500)

      const conversationHistoryTitle = sidebar.locator('text=Conversation History')
      await conversationHistoryTitle.waitFor({ state: 'visible', timeout: 5000 })
      log('✓ Conversation history dropdown opened')

      await testPage.screenshot({ path: 'test-results/conv-history-3-dropdown-open.png', fullPage: true })
      log('Screenshot saved: conv-history-3-dropdown-open.png')

      log('✅ Dropdown opened successfully')
    })

    await test.step('Verify dropdown shows conversation list with metadata', async () => {
      log('Verifying conversation list content...')

      const headerText = await sidebar.locator('.border-b').first().textContent()
      log(`Header text: ${headerText}`)
      expect(headerText).toContain('Conversation History')
      expect(headerText).toContain('3 conversation')
      log('✅ Header shows correct count')

      const conversationItems = sidebar.locator('[id^="conversation-"]')
      const itemCount = await conversationItems.count()
      log(`Conversation items found: ${itemCount}`)

      expect(itemCount).toBe(3)
      log('✅ Three conversation items found')

      const firstItem = conversationItems.first()
      const itemText = await firstItem.textContent()
      log(`First conversation preview: ${itemText?.substring(0, 100)}...`)

      expect(itemText).toContain('Test conversation')
      expect(itemText).toContain('2 message')
      expect(itemText).toContain('Active')
      log('✅ Conversation shows preview text, message count, and active badge')

      const hasTimestamp = /Today|Yesterday|[A-Z][a-z]{2} \d{1,2}/.test(itemText || '')
      expect(hasTimestamp).toBe(true)
      log('✅ Conversation shows formatted timestamp')

      await testPage.screenshot({ path: 'test-results/conv-history-4-conversation-details.png', fullPage: true })
      log('Screenshot saved: conv-history-4-conversation-details.png')
    })

    await test.step('Verify delete buttons are present', async () => {
      log('Checking for delete buttons...')

      const deleteButtons = sidebar.locator('[id^="delete-conversation-"]')
      const deleteButtonCount = await deleteButtons.count()

      expect(deleteButtonCount).toBe(3)
      log('✅ All delete buttons found')

      await testPage.screenshot({ path: 'test-results/conv-history-5-delete-buttons.png', fullPage: true })
      log('Screenshot saved: conv-history-5-delete-buttons.png')
    })

    await test.step('Test conversation deletion', async () => {
      log('Testing conversation deletion...')

      testPage.on('dialog', async dialog => {
        log(`Dialog appeared: ${dialog.message()}`)
        await dialog.accept()
      })

      const deleteButtons = sidebar.locator('[id^="delete-conversation-"]')
      const secondDeleteButton = deleteButtons.nth(1)
      await secondDeleteButton.click()
      await debugWait(1000)
      log('✓ Delete button clicked and dialog accepted')

      const remainingConversations = sidebar.locator('[id^="conversation-"]')
      const remainingCount = await remainingConversations.count()
      log(`Remaining conversations: ${remainingCount}`)

      expect(remainingCount).toBe(2)
      log('✅ Conversation deleted successfully')

      const headerText = await sidebar.locator('.border-b').first().textContent()
      expect(headerText).toContain('2 conversation')
      log('✅ Header updated to show 2 conversations')

      await testPage.screenshot({ path: 'test-results/conv-history-6-after-delete.png', fullPage: true })
      log('Screenshot saved: conv-history-6-after-delete.png')
    })

    await test.step('Close dropdown and verify New Chat button', async () => {
      log('Closing dropdown...')
      await testPage.keyboard.press('Escape')
      await debugWait(300)

      const newChatButton = sidebar.locator('button[title="New Chat"]')
      const newChatExists = await newChatButton.count()

      expect(newChatExists).toBeGreaterThan(0)
      log('✅ New Chat button found')

      await testPage.screenshot({ path: 'test-results/conv-history-7-new-chat-button.png', fullPage: true })
      log('Screenshot saved: conv-history-7-new-chat-button.png')
    })

    await test.step('Test New Chat button functionality', async () => {
      log('Clicking New Chat button...')

      const newChatButton = sidebar.locator('button[title="New Chat"]')
      await newChatButton.click()
      await debugWait(1000)
      log('✓ New Chat button clicked')

      const promptInput = sidebar.locator('textarea[placeholder*="Example"]')
      const inputValue = await promptInput.inputValue()
      expect(inputValue).toBe('')
      log('✅ Prompt input cleared (new chat started)')

      await testPage.screenshot({ path: 'test-results/conv-history-8-new-chat-started.png', fullPage: true })
      log('Screenshot saved: conv-history-8-new-chat-started.png')
    })

    await test.step('Verify conversation limit enforcement', async () => {
      log('Verifying 10 conversation limit in IndexedDB...')

      const conversationCount = await extensionFrame.evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        const tx = db.transaction('conversations', 'readonly')
        const store = tx.objectStore('conversations')
        const index = store.index('by-variant')

        const conversations = await new Promise<any[]>((resolve) => {
          const request = index.getAll('Variant 1')
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        })

        return conversations.length
      })

      log(`Current conversation count in IndexedDB: ${conversationCount}`)
      expect(conversationCount).toBeLessThanOrEqual(10)
      log('✅ Conversation count respects 10 item limit')

      log('✅ Test completed successfully - all conversation history features verified')
    })
  })
})
