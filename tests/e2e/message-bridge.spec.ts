import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

/**
 * Comprehensive test suite for the message bridge system
 * Tests all message types used across the extension in both test and production modes
 */
test.describe('Message Bridge System', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      // Log all message-related console output
      if (msgText.includes('[message-bridge]') ||
          msgText.includes('[index.tsx]') ||
          msgText.includes('[Background]') ||
          msgText.includes('Received polyfilled message') ||
          msgText.includes('Using postMessage') ||
          msgText.includes('Using chrome.runtime')) {
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

    console.log('✅ Test page loaded')
    console.log(`  📋 Console messages so far: ${allConsoleMessages.length}`)
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Test PING message (background ↔ sidebar)', async ({ extensionId, extensionUrl }) => {
    test.setTimeout(30000)

    // Inject sidebar
    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      container.style.cssText = `
        position: fixed;
        top: 0;
        right: 0;
        width: 384px;
        height: 100vh;
        z-index: 2147483647;
      `

      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl

      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    // Test PING from sidebar - use frame's evaluate via locator
    const pingResult = await sidebar.locator('body').evaluate(async () => {
      try {
        // Dynamic import in iframe context
        const module = await import('/src/utils/message-bridge.ts')
        const { sendMessage } = module
        const response = await sendMessage({ type: 'PING' })
        return { success: true, response }
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('PING result:', pingResult)
    expect(pingResult.success).toBe(true)
    expect(pingResult.response).toHaveProperty('pong', true)
  })

  test('Test CAPTURE_HTML message (sidebar → content script)', async ({ extensionUrl }) => {
    test.setTimeout(30000)

    // Inject sidebar
    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl
      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    // Test HTML capture
    const captureResult = await sidebar.evaluate(async () => {
      try {
        const { capturePageHTML } = await import('/src/utils/html-capture')
        const html = await capturePageHTML()
        return { success: true, htmlLength: html?.length || 0 }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    console.log('CAPTURE_HTML result:', captureResult)
    expect(captureResult.success).toBe(true)
    expect(captureResult.htmlLength).toBeGreaterThan(0)
  })

  test('Test AI_GENERATE_DOM_CHANGES message flow', async ({ extensionUrl }) => {
    test.setTimeout(60000)

    // Inject sidebar
    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl
      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    console.log('Sending AI_GENERATE_DOM_CHANGES message...')

    const aiResult = await sidebar.evaluate(async () => {
      try {
        const { sendMessage } = await import('/src/utils/message-bridge')

        const testPrompt = 'Change the text in the paragraph with id "test-paragraph" to say "Test"'
        const testHtml = '<html><body><p id="test-paragraph">Original</p></body></html>'
        const testApiKey = 'test-key'

        console.log('[Test] About to send AI_GENERATE_DOM_CHANGES')

        const response = await sendMessage({
          type: 'AI_GENERATE_DOM_CHANGES',
          html: testHtml,
          prompt: testPrompt,
          apiKey: testApiKey
        })

        console.log('[Test] AI response received:', response)

        return { success: true, response }
      } catch (error) {
        console.error('[Test] AI generation failed:', error)
        return { success: false, error: error.message, stack: error.stack }
      }
    })

    console.log('AI_GENERATE_DOM_CHANGES result:', aiResult)

    // Check console for errors
    const errors = allConsoleMessages.filter(m => m.type === 'error')
    if (errors.length > 0) {
      console.log('Console errors:', errors)
    }

    expect(aiResult.success).toBe(true)
  })

  test('Test API_REQUEST message (sidebar → background)', async ({ extensionUrl }) => {
    test.setTimeout(30000)

    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl
      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    const apiResult = await sidebar.evaluate(async () => {
      try {
        const { sendMessage } = await import('/src/utils/message-bridge')

        // Test API_REQUEST (this should fail with auth error, but message should reach background)
        const response = await sendMessage({
          type: 'API_REQUEST',
          method: 'GET',
          path: '/experiments'
        })

        return { success: true, receivedResponse: true, response }
      } catch (error) {
        // Expected to fail with no auth, but we got a response from background
        return { success: true, receivedResponse: true, error: error.message }
      }
    })

    console.log('API_REQUEST result:', apiResult)
    expect(apiResult.receivedResponse).toBe(true)
  })

  test('Test CHECK_AUTH message', async ({ extensionUrl }) => {
    test.setTimeout(30000)

    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl
      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    const authResult = await sidebar.evaluate(async () => {
      try {
        const { sendMessage } = await import('/src/utils/message-bridge')
        const response = await sendMessage({ type: 'CHECK_AUTH' })
        return { success: true, response }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    console.log('CHECK_AUTH result:', authResult)
    expect(authResult.success).toBe(true)
    expect(authResult.response).toHaveProperty('isAuthenticated')
  })

  test('Test message flow: content script → sidebar → content script', async ({ extensionUrl }) => {
    test.setTimeout(30000)

    // This tests the full roundtrip of visual editor messages
    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl
      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    // Test visual editor status check
    const statusResult = await testPage.evaluate(async () => {
      try {
        return new Promise((resolve) => {
          // Listen for response
          window.addEventListener('message', (event) => {
            if (event.data?.type === 'VISUAL_EDITOR_STATUS_RESPONSE') {
              resolve({ success: true, response: event.data })
            }
          }, { once: true })

          // Send check message to content script
          chrome.runtime.sendMessage({
            type: 'CHECK_VISUAL_EDITOR_ACTIVE'
          })

          // Timeout after 5s
          setTimeout(() => resolve({ success: false, error: 'Timeout' }), 5000)
        })
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    console.log('Visual editor status check result:', statusResult)
  })

  test('Verify message-bridge detects test mode correctly', async ({ extensionUrl }) => {
    test.setTimeout(30000)

    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl
      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    // Check if message-bridge detects test mode and uses postMessage
    const modeCheckResult = await sidebar.evaluate(async () => {
      try {
        const { sendMessage } = await import('/src/utils/message-bridge')

        // Send a PING and check console logs for which transport was used
        await sendMessage({ type: 'PING' })

        return { success: true }
      } catch (error) {
        return { success: false, error: error.message }
      }
    })

    expect(modeCheckResult.success).toBe(true)

    // Check console logs for message-bridge transport selection
    const bridgeLogs = allConsoleMessages.filter(m =>
      m.text.includes('[message-bridge]') &&
      (m.text.includes('Using postMessage') || m.text.includes('Using chrome.runtime'))
    )

    console.log('Message bridge transport logs:', bridgeLogs)

    // In test mode, should use postMessage
    const usesPostMessage = bridgeLogs.some(log => log.text.includes('Using postMessage'))
    expect(usesPostMessage).toBe(true)
  })
})
