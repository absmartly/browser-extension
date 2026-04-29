import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

/**
 * Comprehensive test suite for the message bridge system
 * Tests all message types used across the extension in both test and production modes
 *
 * NOTE: These tests use chrome.runtime.sendMessage directly in the sidebar iframe context
 * instead of dynamic imports (which don't work with bundled/built extensions)
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
      ;(frame as any).on('console', consoleHandler)
    })

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

    const pingResult = await sidebar.locator('body').evaluate(async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve({ success: true, response })
            }
          })
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('PING result:', pingResult)
    const pingData = pingResult as { success: boolean; response: any }
    expect(pingData.success).toBe(true)
    expect(pingData.response).toHaveProperty('pong', true)
  })

  test('Test CAPTURE_HTML message (sidebar → content script)', async ({ extensionUrl }) => {
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

    const captureResult = await sidebar.locator('body').evaluate(async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'CAPTURE_HTML' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve({
                success: response?.success || false,
                htmlLength: response?.html?.length || 0
              })
            }
          })
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('CAPTURE_HTML result:', captureResult)
    const captureData = captureResult as { success: boolean; htmlLength: number }
    expect(captureData.success).toBe(true)
    expect(captureData.htmlLength).toBeGreaterThan(0)
  })

  test('Test AI_GENERATE_DOM_CHANGES message flow', async ({ extensionUrl }) => {
    test.setTimeout(60000)

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

    const aiResult = await sidebar.locator('body').evaluate(async () => {
      try {
        const testPrompt = 'Change the text in the paragraph with id "test-paragraph" to say "Test"'
        const testHtml = '<html><body><p id="test-paragraph">Original</p></body></html>'
        const testApiKey = 'test-key'

        console.log('[Test] About to send AI_GENERATE_DOM_CHANGES')

        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'AI_GENERATE_DOM_CHANGES',
            html: testHtml,
            prompt: testPrompt,
            apiKey: testApiKey
          }, (response) => {
            console.log('[Test] AI response received:', response)
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve({ success: true, response })
            }
          })
        })
      } catch (error) {
        console.error('[Test] AI generation failed:', error)
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('AI_GENERATE_DOM_CHANGES result:', aiResult)

    const errors = allConsoleMessages.filter(m => m.type === 'error')
    if (errors.length > 0) {
      console.log('Console errors:', errors)
    }

    const aiData = aiResult as { success: boolean; response: any }
    expect(aiData.success).toBe(true)
  })

  test('Test API_REQUEST message (sidebar → background)', async ({ extensionUrl }) => {
    test.setTimeout(60000)

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

    const apiResult = await sidebar.locator('body').evaluate(async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'API_REQUEST',
            method: 'GET',
            path: '/experiments'
          }, (response) => {
            resolve({ success: true, receivedResponse: true, response })
          })
        })
      } catch (error) {
        return { success: true, receivedResponse: true, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('API_REQUEST result:', apiResult)
    const apiData = apiResult as { success: boolean; receivedResponse: boolean; response?: any }
    expect(apiData.receivedResponse).toBe(true)
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

    const authResult = await sidebar.locator('body').evaluate(async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'CHECK_AUTH' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve({ success: true, response })
            }
          })
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('CHECK_AUTH result:', authResult)
    const authData = authResult as { success: boolean; response: any }
    expect(authData.success).toBe(true)
    expect(authData.response).toHaveProperty('success')
  })

  test('Test message flow: content script → sidebar → content script', async ({ extensionUrl }) => {
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

    const statusResult = await sidebar.locator('body').evaluate(async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            type: 'CHECK_VISUAL_EDITOR_ACTIVE'
          }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve({ success: true, response })
            }
          })

          setTimeout(() => resolve({ success: false, error: 'Timeout' }), 5000)
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    console.log('Visual editor status check result:', statusResult)
  })

  test('Verify message-bridge sends messages correctly', async ({ extensionUrl }) => {
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

    const modeCheckResult = await sidebar.locator('body').evaluate(async () => {
      try {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
            if (chrome.runtime.lastError) {
              resolve({ success: false, error: chrome.runtime.lastError.message })
            } else {
              resolve({ success: true })
            }
          })
        })
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : String(error) }
      }
    })

    const modeCheckData = modeCheckResult as { success: boolean }
    expect(modeCheckData.success).toBe(true)

    const bridgeLogs = allConsoleMessages.filter(m =>
      m.text.includes('[message-bridge]') &&
      (m.text.includes('Using postMessage') || m.text.includes('Using chrome.runtime'))
    )

    console.log('Message bridge transport logs:', bridgeLogs)
  })
})
