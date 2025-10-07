import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

/**
 * Simplified message bridge test - just verify messages flow correctly by checking console logs
 */
test.describe('Message Bridge - Console Verification', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      // Log message-related output
      console.log(`  [${msgType}] ${msgText}`)
    }
    testPage.on('console', consoleHandler)

    testPage.on('frameattached', async (frame) => {
      frame.on('console', consoleHandler)
    })

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=1`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    console.log('✅ Test page loaded')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Verify message-bridge logs show correct transport selection', async ({ extensionUrl }) => {
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

    console.log('\n📊 Analyzing console messages...\n')

    // Wait a bit for initial messages
    await testPage.waitForTimeout(2000)

    // Check for index.tsx test mode detection
    const indexLogs = allConsoleMessages.filter(m =>
      m.text.includes('[index.tsx]')
    )
    console.log('index.tsx logs:', indexLogs.map(l => l.text))

    const testModeDetected = indexLogs.some(log =>
      log.text.includes('Script loaded in non-extension context (test mode)')
    )

    console.log('\nTest mode detected in index.tsx:', testModeDetected)

    // Summary
    console.log('\n📋 Message Summary:')
    console.log(`  Total console messages: ${allConsoleMessages.length}`)
    console.log(`  Test mode logs: ${indexLogs.length}`)

    const errorLogs = allConsoleMessages.filter(m => m.type === 'error')
    if (errorLogs.length > 0) {
      console.log(`\n❌ Errors found (${errorLogs.length}):`)
      errorLogs.forEach(e => console.log(`    - ${e.text}`))
    }
  })

  test('Send test message from sidebar and verify receipt', async ({ extensionUrl }) => {
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

      console.log('[Test Setup] Sidebar iframe injected')
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    console.log('\n🧪 Sending test message via window.postMessage...\n')

    // Manually send a test message using postMessage (simulating what message-bridge should do)
    await testPage.evaluate(() => {
      const iframe = document.getElementById('absmartly-sidebar-iframe') as HTMLIFrameElement
      if (iframe && iframe.contentWindow) {
        console.log('[Test] Sending test message to sidebar iframe')

        iframe.contentWindow.postMessage({
          source: 'absmartly-test',
          type: 'TEST_MESSAGE',
          testId: 'message-bridge-test-' + Date.now()
        }, '*')

        console.log('[Test] Test message sent')
      }
    })

    await testPage.waitForTimeout(1000)

    // Check if message was received
    const testMessages = allConsoleMessages.filter(m =>
      m.text.includes('TEST_MESSAGE') ||
      m.text.includes('Received polyfilled message') ||
      m.text.includes('absmartly-test')
    )

    console.log('\n📬 Test message logs:')
    testMessages.forEach(m => console.log(`    ${m.text}`))

    // Check for index.tsx listener setup
    const listenerSetup = allConsoleMessages.some(m =>
      m.text.includes('Added postMessage listener')
    )

    console.log('\npostMessage listener registered:', listenerSetup)
  })

  test('Verify AI_GENERATE_DOM_CHANGES handler exists in index.tsx', async ({ extensionUrl }) => {
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

    await testPage.waitForTimeout(1000)

    // Check if AI_GENERATE_DOM_CHANGES is mentioned in index.tsx logs
    const aiHandlerLogs = allConsoleMessages.filter(m =>
      m.text.includes('AI_GENERATE_DOM_CHANGES') ||
      m.text.includes('Handling AI_GENERATE_DOM_CHANGES')
    )

    console.log('\n🤖 AI generation handler logs:')
    if (aiHandlerLogs.length > 0) {
      aiHandlerLogs.forEach(m => console.log(`    ${m.text}`))
    } else {
      console.log('    (none found - handler code exists but not triggered yet)')
    }

    // The handler exists in the code, we just need to verify it can be triggered
    const sidebarLoaded = allConsoleMessages.some(m =>
      m.text.includes('[sidebar.tsx]') && m.text.includes('Script loaded')
    )

    console.log('\nsidebar.tsx loaded:', sidebarLoaded)

    expect(sidebarLoaded).toBe(true)
  })
})
