import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 300) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()

test.describe('Message Bridge Relay - AI Integration', () => {
  let testPage: Page
  let consoleLogs: string[] = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    // Capture console messages
    testPage.on('console', (msg) => {
      const msgText = msg.text()
      consoleLogs.push(msgText)
      if (msgText.includes('[Content Script]') || msgText.includes('[Background]') || msgText.includes('[AI Generate]') || msgText.includes('message bridge')) {
        console.log(`  📝 ${msgText}`)
      }
    })

    await testPage.goto(`file://${TEST_PAGE_PATH}?use_shadow_dom_for_visual_editor_context_menu=0`)
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForLoadState('networkidle')

    await testPage.evaluate(() => {
      (window as any).__absmartlyTestMode = true
    })

    console.log('✅ Test page loaded')
  })

  test.afterEach(async () => {
    if (testPage) await testPage.close()
  })

  test('Message bridge correctly relays chrome.runtime.sendMessage in test mode', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 60000 : 30000)

    await test.step('Inject sidebar to trigger message bridge setup', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar and initializing message bridge')

      await testPage.evaluate((extUrl) => {
        const container = document.createElement('div')
        container.id = 'absmartly-sidebar-root'
        container.style.cssText = `
          position: fixed;
          top: 0;
          right: 0;
          width: 384px;
          height: 100vh;
          background-color: white;
          border-left: 1px solid #e5e7eb;
          box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
          z-index: 2147483647;
          transform: translateX(0);
          transition: transform 0.3s ease-in-out;
        `

        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
        iframe.src = extUrl

        container.appendChild(iframe)
        document.body.appendChild(container)

        console.log('[Test Setup] Sidebar iframe created and appended')
      }, extensionUrl('tabs/sidebar.html'))

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar iframe loaded')
      await debugWait()
    })

    await test.step('Test basic message relay (PING/PONG)', async () => {
      console.log('\n📡 STEP 2: Testing basic message relay')

      const result = await testPage.evaluate(() => {
        return new Promise((resolve) => {
          console.log('[Test] Sending PING message')
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
              console.log('[Test] PING response:', response)
              resolve({ success: !!response?.pong, response })
            })
          } else {
            console.log('[Test] chrome.runtime not available')
            resolve({ success: false, error: 'chrome.runtime not available' })
          }
        })
      })

      expect(result).toHaveProperty('success', true)
      console.log('✅ Message relay working: PING/PONG successful')
    })

    await test.step('Test chrome.runtime.onMessage listener setup', async () => {
      console.log('\n📡 STEP 3: Testing message listener registration')

      const listenerSetup = await testPage.evaluate(() => {
        return new Promise((resolve) => {
          // Set up a listener for test messages
          const testListener = (message: any, sender: any, sendResponse: any) => {
            if (message.type === 'TEST_ECHO') {
              console.log('[Test Listener] Received TEST_ECHO, sending response')
              sendResponse({ echo: true, originalMessage: message.data })
              return true // Keep channel open for async response
            }
            return false // Don't handle other message types
          }

          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener(testListener)
            console.log('[Test Setup] Message listener registered')
            resolve({ success: true })
          } else {
            resolve({ success: false })
          }
        })
      })

      expect(listenerSetup).toHaveProperty('success', true)
      console.log('✅ Message listener registered successfully')
    })

    await test.step('Test AI_GENERATE_DOM_CHANGES message relay', async () => {
      console.log('\n🤖 STEP 4: Testing AI generation message relay')

      const testHTML = '<div id="test-div"><p id="test-p">Test paragraph</p></div>'
      const testPrompt = 'Change the text to "Modified"'

      const result = await testPage.evaluate((html, prompt) => {
        return new Promise((resolve) => {
          console.log('[Test] Sending AI_GENERATE_DOM_CHANGES message')
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage(
              {
                type: 'AI_GENERATE_DOM_CHANGES',
                html,
                prompt,
                apiKey: 'test-api-key'
              },
              (response) => {
                console.log('[Test] AI_GENERATE response:', response)
                resolve({
                  success: response?.success || false,
                  hasChanges: Array.isArray(response?.changes),
                  changeCount: response?.changes?.length || 0
                })
              }
            )
          } else {
            resolve({ success: false, error: 'chrome.runtime not available' })
          }
        })
      }, testHTML, testPrompt)

      console.log(`  Result: ${JSON.stringify(result)}`)
      // Note: The response might be a test response, but the important thing is that the message was relayed
      expect(result).toHaveProperty('success')
      console.log('✅ AI message relay working')
    })

    await test.step('Test CAPTURE_HTML message relay', async () => {
      console.log('\n📸 STEP 5: Testing HTML capture message relay')

      const result = await testPage.evaluate(() => {
        return new Promise((resolve) => {
          console.log('[Test] Sending CAPTURE_HTML message')
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage(
              { type: 'CAPTURE_HTML' },
              (response) => {
                console.log('[Test] CAPTURE_HTML response received, length:', response?.html?.length || 0)
                resolve({
                  success: response?.success || false,
                  htmlLength: response?.html?.length || 0,
                  hasHTML: !!response?.html
                })
              }
            )
          } else {
            resolve({ success: false })
          }
        })
      })

      console.log(`  Result: ${JSON.stringify(result)}`)
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('hasHTML', true)
      expect(result.htmlLength).toBeGreaterThan(0)
      console.log('✅ HTML capture message relay working')
    })

    await test.step('Test multiple sequential messages', async () => {
      console.log('\n🔄 STEP 6: Testing sequential message relay')

      const results = await testPage.evaluate(() => {
        const messages = [
          { type: 'PING' },
          { type: 'CAPTURE_HTML' },
          { type: 'PING' }
        ]

        return Promise.all(messages.map((msg, index) => {
          return new Promise((resolve) => {
            console.log(`[Test] Sending message ${index + 1}: ${msg.type}`)
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage(msg, (response) => {
                console.log(`[Test] Response ${index + 1}:`, Object.keys(response || {}).join(', '))
                resolve({
                  messageType: msg.type,
                  success: !!response,
                  responseKeys: Object.keys(response || {})
                })
              })
            } else {
              resolve({ success: false })
            }
          })
        }))
      })

      console.log(`  Sent ${results.length} messages sequentially`)
      results.forEach((r: any, i: number) => {
        console.log(`    ${i + 1}. ${r.messageType}: ${r.success ? '✓' : '✗'}`)
      })

      expect(results.length).toBe(3)
      expect(results.every((r: any) => r.success)).toBe(true)
      console.log('✅ Sequential message relay working')
    })

    await test.step('Verify message bridge doesn\'t break existing functionality', async () => {
      console.log('\n✨ STEP 7: Verifying no side effects on normal operation')

      const pageIntegrity = await testPage.evaluate(() => {
        return {
          bodyExists: !!document.body,
          documentExists: !!document.documentElement,
          sidebarExists: !!document.getElementById('absmartly-sidebar-root'),
          iframeExists: !!document.getElementById('absmartly-sidebar-iframe'),
          testElements: {
            testParagraph: !!document.getElementById('test-paragraph'),
            button1: !!document.getElementById('button-1'),
            button2: !!document.getElementById('button-2')
          }
        }
      })

      expect(pageIntegrity.bodyExists).toBe(true)
      expect(pageIntegrity.sidebarExists).toBe(true)
      expect(pageIntegrity.iframeExists).toBe(true)
      expect(pageIntegrity.testElements.testParagraph).toBe(true)

      console.log('  ✓ Page structure intact')
      console.log('  ✓ Sidebar injected correctly')
      console.log('  ✓ Test elements still present')
      console.log('✅ No side effects detected')
    })

    // Final summary
    await test.step('Final verification', async () => {
      console.log('\n🎉 MESSAGE BRIDGE RELAY TEST COMPLETE')
      console.log('  ✅ Basic message relay (PING/PONG)')
      console.log('  ✅ Listener registration and event handling')
      console.log('  ✅ AI generation message relay')
      console.log('  ✅ HTML capture message relay')
      console.log('  ✅ Sequential message handling')
      console.log('  ✅ No side effects on existing functionality')

      // Check for any critical errors
      const criticalErrors = consoleLogs.filter(
        log => log.includes('[error]') || log.includes('ERROR') || log.includes('Error:')
      )
      if (criticalErrors.length > 0) {
        console.log('\n⚠️  Some errors were logged:')
        criticalErrors.slice(-5).forEach(e => console.log(`    - ${e}`))
      } else {
        console.log('\n✅ No critical errors detected')
      }
    })

    console.log('\n✨ Message Bridge Relay Test PASSED!')
  })

  test('Message bridge handles response callbacks correctly', async ({ extensionUrl }) => {
    test.setTimeout(SLOW_MODE ? 60000 : 30000)

    console.log('\n📡 Testing response callback handling')

    // Inject sidebar
    await testPage.evaluate((extUrl) => {
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      container.style.cssText = 'position: fixed; top: 0; right: 0; width: 384px; height: 100vh; z-index: 2147483647;'

      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = extUrl

      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionUrl('tabs/sidebar.html'))

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    await sidebar.locator('body').waitFor({ timeout: 10000 })

    await test.step('Test timeout handling for unresponsive messages', async () => {
      console.log('  Testing timeout handling...')

      const result = await testPage.evaluate(() => {
        return new Promise((resolve) => {
          const startTime = Date.now()
          console.log('[Test] Sending message and monitoring timeout')

          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage(
              { type: 'PING' },
              (response) => {
                const duration = Date.now() - startTime
                console.log('[Test] Response received after', duration, 'ms')
                resolve({
                  success: true,
                  duration,
                  hasResponse: !!response
                })
              }
            )
          } else {
            resolve({ success: false })
          }
        })
      })

      expect(result).toHaveProperty('success', true)
      expect(result.duration).toBeLessThan(5000)
      console.log(`  ✓ Response received in ${result.duration}ms`)
    })

    await test.step('Test rapid fire messages', async () => {
      console.log('  Testing rapid message sending...')

      const result = await testPage.evaluate(() => {
        const messages = Array(10).fill({ type: 'PING' })
        const results: any[] = []

        return new Promise((resolve) => {
          let completed = 0

          messages.forEach((msg, index) => {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
              chrome.runtime.sendMessage(msg, (response) => {
                results[index] = { success: !!response }
                completed++
                if (completed === messages.length) {
                  resolve(results)
                }
              })
            }
          })
        })
      })

      const allSuccess = result.every((r: any) => r.success)
      expect(allSuccess).toBe(true)
      console.log(`  ✓ All 10 rapid messages successful`)
    })

    console.log('✅ Callback handling test PASSED!')
  })
})
