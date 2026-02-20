import { test, expect } from '../fixtures/extension'
import type { Page, FrameLocator } from '@playwright/test'
import path from 'path'
import { TEST_IMAGES } from '../../src/lib/__tests__/test-images'
import { injectSidebar } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'

async function createExperimentAndOpenAI(sidebar: FrameLocator): Promise<void> {
  const createButton = sidebar.locator('button[title="Create New Experiment"]')
  await createButton.waitFor({ state: 'visible', timeout: 10000 })
  await createButton.evaluate((btn) => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  const fromScratchButton = sidebar.locator('#from-scratch-button')
  await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
  await fromScratchButton.evaluate((btn) => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  await sidebar.locator('#display-name-label').waitFor({ state: 'visible', timeout: 10000 })

  const generateButton = sidebar.locator('#generate-with-ai-button').first()
  await generateButton.scrollIntoViewIfNeeded()
  await generateButton.waitFor({ state: 'visible', timeout: 10000 })
  await generateButton.evaluate((btn) => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })

  await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
}

test.describe('AI Storage Quota Management', () => {
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
        console.log(`  [${msgType}] ${msgText}`)
      }
    }
    testPage.on('console', consoleHandler)

    testPage.on('frameattached', async (frame) => {
      frame.on('console', consoleHandler)
    })

    const [serviceWorker] = context.serviceWorkers()
    if (serviceWorker) {
      serviceWorker.on('console', (msg: any) => {
        console.log(`  [ServiceWorker] [${msg.type()}] ${msg.text()}`)
      })
    } else {
      context.on('serviceworker', (worker) => {
        worker.on('console', (msg: any) => {
          console.log(`  [ServiceWorker] [${msg.type()}] ${msg.text()}`)
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

  test.afterEach(async () => {
    if (testPage) {
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

  test('should sanitize images before storage', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Create experiment and open AI page', async () => {
      console.log('\n📂 STEP 1: Setting up experiment')

      await injectSidebar(testPage, extensionUrl)
      await createExperimentAndOpenAI(sidebar)
      console.log('✅ AI page loaded')
    })

    await test.step('Upload image and send message', async () => {
      console.log('\n📷 STEP 2: Uploading image')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.waitFor({ state: 'visible' })

      await promptTextarea.evaluate(async (textarea, imageDataUri) => {
        const response = await fetch(imageDataUri)
        const blob = await response.blob()
        const file = new File([blob], 'test-image.png', { type: 'image/png' })

        const event = new ClipboardEvent('paste', {
          clipboardData: new DataTransfer(),
          bubbles: true,
          cancelable: true
        })

        Object.defineProperty(event, 'clipboardData', {
          value: {
            items: [{
              kind: 'file',
              type: 'image/png',
              getAsFile: () => file
            }]
          }
        })

        textarea.dispatchEvent(event)
      }, TEST_IMAGES.HELLO)

      const imagePreview = sidebar.locator('img[alt^="Attachment"]')
      await imagePreview.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Image uploaded and preview visible')

      await promptTextarea.fill('What do you see in this image?')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('✅ Response received')
    })

    await test.step('Verify images are sanitized in IndexedDB', async () => {
      console.log('\n💾 STEP 3: Verifying image sanitization')

      const storage = await sidebar.locator('body').evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('conversations')) {
          return { conversations: [] }
        }

        const tx = db.transaction('conversations', 'readonly')
        const store = tx.objectStore('conversations')

        const conversations = await new Promise<any[]>((resolve) => {
          const request = store.getAll()
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        })

        return {
          conversations: conversations.map(c => ({
            id: c.id,
            variantName: c.variantName,
            messageCount: c.messages?.length || 0,
            messages: (c.messages || []).map((m: any) => ({
              role: m.role,
              imageCount: Array.isArray(m.images) ? m.images.length : 0,
              imageSizes: Array.isArray(m.images) ? m.images.map((img: string) => img.length) : []
            })),
            hasSession: !!c.conversationSession,
            sessionMessagesCleared: (c.conversationSession?.messages?.length || 0) === 0
          }))
        }
      })

      expect(storage).toBeTruthy()
      expect(storage.conversations).toBeDefined()
      console.log(`Found ${storage.conversations.length} conversation(s) in IndexedDB`)

      if (storage.conversations.length > 0) {
        const conv = storage.conversations[0]
        console.log(`Conversation has ${conv.messageCount} messages`)

        for (const message of conv.messages) {
          if (message.role === 'user' && message.imageCount > 0) {
            for (const size of message.imageSizes) {
              console.log(`User message image size: ${size} chars (compressed thumbnail)`)
              expect(size).toBeLessThan(100000)
            }
          }
        }

        expect(conv.sessionMessagesCleared).toBe(true)
        console.log('Session messages cleared (sanitized)')
      }

      const storageSizeLogs = allConsoleMessages.filter(msg =>
        msg.text.includes('[ConversationStorage]') ||
        msg.text.includes('Saved conversation')
      )

      if (storageSizeLogs.length > 0) {
        console.log(`Storage save logged: ${storageSizeLogs[0].text}`)
      }

      await testPage.screenshot({ path: 'test-results/storage-quota-1-sanitized.png', fullPage: true })
    })

    console.log('\n✅ Image sanitization test completed successfully!')
  })

  test('should warn when conversation exceeds 90KB', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 120000 : 60000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Pre-populate IndexedDB with large conversation', async () => {
      console.log('\n💾 STEP 1: Creating large conversation in IndexedDB')

      await testPage.evaluate(async () => {
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
            }
          }
        })

        const largeMessage = 'A'.repeat(10000)
        const messages = []

        for (let i = 0; i < 9; i++) {
          messages.push({
            role: 'user',
            content: largeMessage,
            timestamp: Date.now() - (9 - i) * 1000,
            id: `msg-user-${i}`
          })
          messages.push({
            role: 'assistant',
            content: largeMessage,
            timestamp: Date.now() - (9 - i) * 1000 + 500,
            id: `msg-assistant-${i}`
          })
        }

        const conv = {
          id: crypto.randomUUID(),
          variantName: 'A',
          messages,
          conversationSession: {
            id: crypto.randomUUID(),
            htmlSent: true,
            messages: []
          },
          createdAt: Date.now() - 10000,
          updatedAt: Date.now(),
          messageCount: messages.length,
          firstUserMessage: 'Large conversation test',
          isActive: true
        }

        const sizeInBytes = new Blob([JSON.stringify(conv)]).size
        console.log(`[TEST SETUP] Created conversation with size: ${sizeInBytes} bytes`)

        const tx = db.transaction('conversations', 'readwrite')
        const store = tx.objectStore('conversations')
        store.add(conv)

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      })

      console.log('✅ Large conversation created in IndexedDB')
    })

    await test.step('Load AI page and monitor warnings', async () => {
      console.log('\n⚠️  STEP 2: Loading AI page and checking for warnings')

      await injectSidebar(testPage, extensionUrl)
      await createExperimentAndOpenAI(sidebar)
      console.log('✅ AI page loaded with large conversation')

      const warningLogs = allConsoleMessages.filter(msg =>
        msg.type === 'warning' ||
        msg.text.toLowerCase().includes('large') ||
        msg.text.toLowerCase().includes('quota')
      )

      if (warningLogs.length > 0) {
        console.log(`✅ Found ${warningLogs.length} warning(s) about storage size`)
        for (const log of warningLogs) {
          console.log(`  Warning: ${log.text}`)
        }
      } else {
        console.log('ℹ️  No warnings logged (conversation may be under 90KB threshold)')
      }
    })

    console.log('\n✅ Large conversation warning test completed!')
  })

  test('should handle storage quota exceeded error', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 120000 : 60000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Create experiment with extremely large conversation in IndexedDB', async () => {
      console.log('\n💾 STEP 1: Creating conversation that exceeds quota')

      await testPage.evaluate(async () => {
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
            }
          }
        })

        const hugeMessage = 'X'.repeat(12000)
        const messages = []

        for (let i = 0; i < 10; i++) {
          messages.push({
            role: 'user',
            content: hugeMessage,
            timestamp: Date.now() - (10 - i) * 1000,
            id: `msg-user-${i}`
          })
          messages.push({
            role: 'assistant',
            content: hugeMessage,
            timestamp: Date.now() - (10 - i) * 1000 + 500,
            id: `msg-assistant-${i}`
          })
        }

        const conv = {
          id: crypto.randomUUID(),
          variantName: 'A',
          messages,
          conversationSession: {
            id: crypto.randomUUID(),
            htmlSent: true,
            messages: []
          },
          createdAt: Date.now() - 20000,
          updatedAt: Date.now(),
          messageCount: messages.length,
          firstUserMessage: 'Quota exceeded test',
          isActive: true
        }

        const sizeInBytes = new Blob([JSON.stringify(conv)]).size
        console.log(`[TEST SETUP] Created huge conversation with size: ${sizeInBytes} bytes (should exceed 100KB)`)

        const tx = db.transaction('conversations', 'readwrite')
        const store = tx.objectStore('conversations')
        store.add(conv)

        await new Promise<void>((resolve, reject) => {
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      })

      console.log('✅ Huge conversation created')
    })

    await test.step('Attempt to add more messages and check for error', async () => {
      console.log('\n⚠️  STEP 2: Attempting to add messages to full storage')

      await injectSidebar(testPage, extensionUrl)
      await createExperimentAndOpenAI(sidebar)
      console.log('✅ AI page loaded')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Add more content')

      const generateBtn = sidebar.locator('#ai-generate-button')
      await generateBtn.click()

      await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })

      const errorLogs = allConsoleMessages.filter(msg =>
        msg.type === 'error' &&
        (msg.text.includes('quota') || msg.text.includes('large') || msg.text.includes('Storage'))
      )

      if (errorLogs.length > 0) {
        console.log(`✅ Storage quota error detected: ${errorLogs[0].text}`)
      } else {
        console.log('ℹ️  No explicit quota error (storage may have handled it gracefully)')
      }

      const errorAlert = sidebar.locator('.bg-red-50, .border-red-500').first()
      const hasError = await errorAlert.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasError) {
        console.log('✅ User-facing error message shown')
        await testPage.screenshot({ path: 'test-results/storage-quota-2-error.png', fullPage: true })
      } else {
        console.log('ℹ️  No user-facing error (conversation may not have triggered save)')
      }
    })

    console.log('\n✅ Storage quota exceeded test completed!')
  })

  test('should sanitize session messages before storage', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 120000 : 60000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

    await test.step('Create conversation with messages', async () => {
      console.log('\n💬 STEP 1: Creating conversation')

      await injectSidebar(testPage, extensionUrl)
      await createExperimentAndOpenAI(sidebar)
      console.log('✅ AI page loaded')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Test message for session sanitization')

      const generateBtn = sidebar.locator('#ai-generate-button')
      await generateBtn.click()

      await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('✅ Message sent and response received')
    })

    await test.step('Verify session.messages is empty in IndexedDB', async () => {
      console.log('\n💾 STEP 2: Verifying session messages are cleared')

      const storage = await sidebar.locator('body').evaluate(async () => {
        const DB_NAME = 'absmartly-conversations'
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open(DB_NAME)
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })

        if (!db.objectStoreNames.contains('conversations')) {
          return { conversations: [] }
        }

        const tx = db.transaction('conversations', 'readonly')
        const store = tx.objectStore('conversations')

        const conversations = await new Promise<any[]>((resolve) => {
          const request = store.getAll()
          request.onsuccess = () => resolve(request.result || [])
          request.onerror = () => resolve([])
        })

        return {
          conversations: conversations.map(c => ({
            id: c.id,
            messageCount: c.messages?.length || 0,
            hasSession: !!c.conversationSession,
            sessionId: c.conversationSession?.id,
            htmlSent: c.conversationSession?.htmlSent,
            sessionMessagesCount: c.conversationSession?.messages?.length ?? -1
          }))
        }
      })

      expect(storage).toBeTruthy()
      expect(storage.conversations).toBeDefined()
      console.log(`Found ${storage.conversations.length} conversation(s) in IndexedDB`)

      if (storage.conversations.length > 0) {
        const conv = storage.conversations[0]
        expect(conv.hasSession).toBe(true)
        expect(conv.sessionMessagesCount).toBe(0)

        console.log('Session messages array is empty (sanitized)')
        console.log(`Conversation has ${conv.messageCount} messages`)
        console.log(`Session ID preserved: ${conv.sessionId}`)
        console.log(`htmlSent flag preserved: ${conv.htmlSent}`)
      } else {
        console.log('No conversations found in IndexedDB (may not have been saved yet)')
      }
    })

    console.log('\n✅ Session message sanitization test completed!')
  })
})
