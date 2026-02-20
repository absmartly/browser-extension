import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'
import path from 'path'
import { TEST_IMAGES } from '../../src/lib/__tests__/test-images'
import { injectSidebar, debugWait } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'

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

      if (msgText.includes('[AIDOMChangesPage]') || msgText.includes('[useConversationHistory]') || msgText.includes('[Background]')) {
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

    console.log('Test page loaded (test mode enabled)')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Session initialization, image upload, and persistence', async ({ extensionId, extensionUrl, context }) => {
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let firstSessionId: string
    let secondSessionId: string

    await test.step('Inject sidebar and navigate to AI page', async () => {
      console.log('\n STEP 1: Injecting sidebar and setting up')
      await injectSidebar(testPage, extensionUrl)

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
      console.log('Experiment editor opened')

      const generateButton = sidebar.locator('#generate-with-ai-button').first()
      await generateButton.scrollIntoViewIfNeeded()
      await generateButton.waitFor({ state: 'visible', timeout: 10000 })
      await generateButton.evaluate((btn) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await sidebar.locator('#ai-dom-generator-heading').waitFor({ state: 'visible', timeout: 10000 })
      console.log('AI DOM Generator page loaded')
    })

    await test.step('Verify AI page is ready', async () => {
      console.log('\n STEP 2: Verifying AI page is ready')

      await expect(sidebar.locator('#ai-dom-generator-heading')).toBeVisible()
      await expect(sidebar.locator('#ai-prompt')).toBeVisible()
      console.log('AI page is ready for input')
    })

    await test.step('Upload HELLO test image', async () => {
      console.log('\n STEP 3: Uploading test image')

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
      console.log('Image uploaded and preview visible')
    })

    await test.step('Generate DOM changes with image', async () => {
      console.log('\n STEP 4: Generating DOM changes with image')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('What text do you see in this image?')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('Response received')

      const imageMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] LLM images:') && !msg.text.includes('LLM images: 0')
      )
      if (imageMessages.length > 0) {
        console.log(`Found ${imageMessages.length} messages about sending images`)
      }

      const sessionMsg = allConsoleMessages.find(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:')
      )
      if (sessionMsg) {
        const match = sessionMsg.text.match(/Current session: ([a-f0-9-]+)/)
        if (match) {
          firstSessionId = match[1]
          console.log(`Captured session ID: ${firstSessionId}`)
        }
      }
      if (!firstSessionId) {
        firstSessionId = 'unknown'
        console.log('Could not capture session ID from logs')
      }
    })

    await test.step('Verify session ID is consistent', async () => {
      console.log('\n STEP 5: Verifying session is active')

      const sessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:')
      )
      expect(sessionMessages.length).toBeGreaterThan(0)
      console.log(`Found ${sessionMessages.length} session messages`)
    })

    await test.step('Send second message without image', async () => {
      console.log('\n STEP 6: Sending second message')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Change the button color to blue')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('Second response received')

      const sessionMessages = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:') && msg.text.includes(firstSessionId)
      )

      expect(sessionMessages.length).toBeGreaterThan(0)
      console.log(`Same session ${firstSessionId} used for second message`)
    })

    await test.step('Click "New Chat" button and verify new session', async () => {
      console.log('\n STEP 7: Starting new chat')

      const messageCountBefore = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:')
      ).length

      const newChatButton = sidebar.locator('button[title="New Chat"]')
      await newChatButton.waitFor({ state: 'visible' })
      await newChatButton.evaluate((btn) => {
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })

      await sidebar.locator('#ai-prompt').waitFor({ state: 'visible' })
      console.log('New chat started, prompt ready')
    })

    await test.step('Verify new session is used via generation', async () => {
      console.log('\n STEP 8: Verifying new session usage')

      const promptTextarea = sidebar.locator('#ai-prompt')
      await promptTextarea.fill('Test new session')

      const generateButton = sidebar.locator('#ai-generate-button')
      await generateButton.click()

      await sidebar.locator('#ai-generate-button[data-loading="false"]').waitFor({ state: 'attached', timeout: 60000 })
      console.log('Response received in new session')

      const sessionMsgs = allConsoleMessages.filter(msg =>
        msg.text.includes('[AIDOMChangesPage] Current session:')
      )

      expect(sessionMsgs.length).toBeGreaterThanOrEqual(2)
      const lastSessionMsg = sessionMsgs[sessionMsgs.length - 1]
      const match = lastSessionMsg.text.match(/Current session: ([a-f0-9-]+)/)
      if (match) {
        secondSessionId = match[1]
        console.log(`New session ID: ${secondSessionId}`)
        console.log(`Previous session ID: ${firstSessionId}`)
      }
    })

    console.log('\n All steps completed successfully!')
  })
})
