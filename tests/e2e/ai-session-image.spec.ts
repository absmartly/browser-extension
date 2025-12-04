import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'
import { TEST_IMAGES } from '../../src/lib/__tests__/test-images'
import { injectSidebar, debugWait } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'
const SAVE_EXPERIMENT = process.env.SAVE_EXPERIMENT === '1'

test.describe('AI Session & Image Handling', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      if (msgText.includes('[AIDOMChangesPage]') || msgText.includes('[Background]') || msgText.includes('[AI Generate]') || msgText.includes('[Bridge]')) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }
    testPage.on('console', consoleHandler)

    testPage.on('frameattached', async (frame) => {
      frame.on('console', consoleHandler)
    })

    // Listen to service worker console logs
    const [serviceWorker] = context.serviceWorkers()
    if (serviceWorker) {
      console.log('✅ Service worker found, attaching console listener')
      serviceWorker.on('console', (msg: any) => {
        console.log(`  🔧 [ServiceWorker] [${msg.type()}] ${msg.text()}`)
      })
    } else {
      console.log('⚠️  No service worker found yet, waiting...')
      context.on('serviceworker', (worker) => {
        console.log('✅ Service worker attached, setting up console listener')
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
    console.log(`  📋 Console messages so far: ${allConsoleMessages.length}`)
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test.skip('Session initialization, image upload, and persistence', async ({ extensionId, extensionUrl, context }) => {
    // TODO: Rewrite this test to use proper experiment creation helpers
    // Current issue: Uses incorrect selectors (#create-experiment-button, #experiment-name-input, #save-experiment-button)
    // These IDs don't exist in the actual components
    // Should use: createExperiment() and activateVisualEditor() helpers from ve-experiment-setup.ts
    // Also depends on fix-102 (AI page navigation) to be resolved first
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string
    let firstSessionId: string
    let secondSessionId: string

    // ========== STEP 1: Inject Sidebar ==========
    await test.step('Inject sidebar and verify availability', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      const sidebarFrame = await injectSidebar(testPage, extensionUrl)
      await debugWait()
      console.log('✅ Sidebar loaded and visible')
    })

    // ========== STEP 2: Create Test Experiment ==========
    await test.step('Create test experiment', async () => {
      console.log('\n📝 STEP 2: Creating test experiment')

      experimentName = `E2E Session Test ${Date.now()}`
      await sidebar.locator('#create-experiment-button').click()
      await debugWait()

      const nameInput = sidebar.locator('#experiment-name-input')
      await nameInput.waitFor({ state: 'visible' })
      await nameInput.fill(experimentName)

      await sidebar.locator('#save-experiment-button').click()
      await debugWait(500)

      console.log(`✅ Created experiment: ${experimentName}`)
    })

    // ========== STEP 3: Navigate to AI DOM Changes Page ==========
    await test.step('Navigate to AI DOM changes page for variant 0', async () => {
      console.log('\n🤖 STEP 3: Navigating to AI DOM changes page')

      const generateButton = sidebar.locator('#generate-with-ai-button').first()
      await generateButton.waitFor({ state: 'visible' })
      await generateButton.click()
      await debugWait(500)

      await sidebar.locator('text=AI DOM Generator').waitFor({ state: 'visible', timeout: 10000 })
      console.log('✅ AI DOM Generator page loaded')
    })

    // ========== STEP 4: Verify Session Initialized ==========
    await test.step('Verify session initialized on mount', async () => {
      console.log('\n🔑 STEP 4: Verifying session initialization')

      await debugWait(1000)

      const sessionInitMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Session initialized:')
      )

      expect(sessionInitMessages.length).toBeGreaterThan(0)
      console.log(`✅ Found ${sessionInitMessages.length} session initialization messages`)

      const match = sessionInitMessages[0].text.match(/Session initialized: ([a-f0-9-]+)/)
      expect(match).toBeTruthy()
      firstSessionId = match![1]
      console.log(`✅ Session ID: ${firstSessionId}`)
    })

    // ========== STEP 5: Upload Image ==========
    await test.step('Upload HELLO test image', async () => {
      console.log('\n📷 STEP 5: Uploading test image')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.waitFor({ state: 'visible' })

      await testPage.evaluate((imageDataUri) => {
        const iframe = document.querySelector('#absmartly-sidebar-iframe') as HTMLIFrameElement
        if (!iframe || !iframe.contentDocument) {
          throw new Error('Iframe not found')
        }

        const textarea = iframe.contentDocument.querySelector('#ai-prompt') as HTMLTextAreaElement
        if (!textarea) {
          throw new Error('Textarea not found')
        }

        const dataTransfer = new DataTransfer()
        const blob = fetch(imageDataUri).then(r => r.blob())
        blob.then(b => {
          const file = new File([b], 'test-image.png', { type: 'image/png' })

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
        })
      }, TEST_IMAGES.HELLO)

      await debugWait(1000)

      const imagePreview = sidebar.locator('img[alt^="Attachment"]')
      await imagePreview.waitFor({ state: 'visible', timeout: 5000 })
      console.log('✅ Image uploaded and preview visible')
    })

    // ========== STEP 6: Generate with Image ==========
    await test.step('Generate DOM changes with image', async () => {
      console.log('\n🤖 STEP 6: Generating DOM changes with image')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('What text do you see in this image?')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('.chat-message').last().waitFor({ state: 'visible', timeout: 60000 })
      console.log('✅ Response received')

      await debugWait(1000)

      const imageMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('Sending message with') && msg.text.includes('image')
      )
      expect(imageMessages.length).toBeGreaterThan(0)
      console.log(`✅ Found ${imageMessages.length} messages about sending images`)
    })

    // ========== STEP 7: Verify Session Persisted ==========
    await test.step('Verify session ID remained the same', async () => {
      console.log('\n🔑 STEP 7: Verifying session persistence')

      await debugWait(500)

      const sessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:') && msg.text.includes(firstSessionId)
      )

      expect(sessionMessages.length).toBeGreaterThan(0)
      console.log(`✅ Session ${firstSessionId} was reused`)
    })

    // ========== STEP 8: Send Second Message ==========
    await test.step('Send second message without image', async () => {
      console.log('\n💬 STEP 8: Sending second message')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Change the button color to blue')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('.chat-message').last().waitFor({ state: 'visible', timeout: 60000 })
      console.log('✅ Second response received')

      await debugWait(1000)

      const sessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:') && msg.text.includes(firstSessionId)
      )

      expect(sessionMessages.length).toBeGreaterThan(0)
      console.log(`✅ Same session ${firstSessionId} used for second message`)
    })

    // ========== STEP 9: Click New Chat ==========
    await test.step('Click "New Chat" button', async () => {
      console.log('\n🆕 STEP 9: Starting new chat')

      const newChatButton = sidebar.locator('button[title="New Chat"]')
      await newChatButton.waitFor({ state: 'visible' })
      await newChatButton.click()

      await debugWait(1000)

      const newSessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] New chat session:')
      )

      expect(newSessionMessages.length).toBeGreaterThan(0)
      const match = newSessionMessages[0].text.match(/New chat session: ([a-f0-9-]+)/)
      expect(match).toBeTruthy()
      secondSessionId = match![1]

      expect(secondSessionId).not.toBe(firstSessionId)
      console.log(`✅ New session created: ${secondSessionId}`)
      console.log(`✅ Different from first session: ${firstSessionId}`)
    })

    // ========== STEP 10: Verify New Session ==========
    await test.step('Verify new session is used', async () => {
      console.log('\n🔑 STEP 10: Verifying new session usage')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Test new session')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('.chat-message').last().waitFor({ state: 'visible', timeout: 60000 })
      console.log('✅ Response received in new session')

      await debugWait(1000)

      const newSessionUsageMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:') && msg.text.includes(secondSessionId)
      )

      expect(newSessionUsageMessages.length).toBeGreaterThan(0)
      console.log(`✅ New session ${secondSessionId} is being used`)
    })

    console.log('\n✅ All steps completed successfully!')
  })
})
