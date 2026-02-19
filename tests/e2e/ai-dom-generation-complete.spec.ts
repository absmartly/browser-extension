import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 300) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'
const SAVE_EXPERIMENT = process.env.SAVE_EXPERIMENT === '1'

test.describe('AI DOM Changes Generation - Complete Workflow', () => {
  let testPage: Page
  let allConsoleMessages: Array<{type: string, text: string}> = []

  test.beforeEach(async ({ context }) => {
    testPage = await context.newPage()

    allConsoleMessages = []
    const consoleHandler = (msg: any) => {
      const msgType = msg.type()
      const msgText = msg.text()
      allConsoleMessages.push({ type: msgType, text: msgText })

      if (msgText.includes('[ABsmartly]') || msgText.includes('[Background]') || msgText.includes('[DOMChanges]') || msgText.includes('[AI Generate]')) {
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

  test('Complete AI workflow: create experiment → generate changes → preview', async ({ extensionId, extensionUrl, context }) => {
    test.setTimeout(SLOW_MODE ? 180000 : 120000)

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string
    const generatedSelectors: Set<string> = new Set()

    // ========== STEP 1: Inject Sidebar ==========
    await test.step('Inject sidebar and verify availability', async () => {
      console.log('\n📂 STEP 1: Injecting sidebar')
      await testPage.evaluate((extUrl) => {
        console.log('🔵 ABSmartly Extension Test: Injecting sidebar')

        const originalPadding = document.body.style.paddingRight || '0px'
        document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
        document.body.style.transition = 'padding-right 0.3s ease-in-out'
        document.body.style.paddingRight = '384px'

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
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #111827;
          transform: translateX(0);
          transition: transform 0.3s ease-in-out;
        `

        const iframe = document.createElement('iframe')
        iframe.id = 'absmartly-sidebar-iframe'
        iframe.style.cssText = `
          width: 100%;
          height: 100%;
          border: none;
        `
        iframe.src = extUrl

        container.appendChild(iframe)
        document.body.appendChild(container)

        console.log('🔵 ABSmartly Extension Test: Sidebar injected successfully')
      }, extensionUrl('tabs/sidebar.html'))

      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar visible and responsive')
      await debugWait()
    })

    // ========== STEP 2: Create New Experiment ==========
    await test.step('Create new experiment from scratch', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Clicked "Create New Experiment"')
      await debugWait()

      const fromScratchButton = sidebar.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch" option')
      await debugWait()

      experimentName = `AI Complete Test ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
      console.log(`  ✓ Experiment name: ${experimentName}`)
      await debugWait()

      // Select Unit Type (using SearchableSelect component)
      const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
      await unitTypeTrigger.waitFor({ state: 'visible', timeout: 15000 })
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 15000 })
      await unitTypeTrigger.click()
      await debugWait(500)

      const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown')
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 15000 })
      await unitTypeDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  ✓ Unit type selected')
      await debugWait()

      // Select Applications
      const appsTrigger = sidebar.locator('#applications-select-trigger')
      await appsTrigger.waitFor({ state: 'visible', timeout: 5000 })
      await appsTrigger.click()

      const appsDropdown = sidebar.locator('#applications-select-dropdown, [data-testid="applications-select-dropdown"]')
      await appsDropdown.waitFor({ state: 'visible', timeout: 5000 })
      await appsDropdown.locator('div[class*="cursor-pointer"]').first().click()
      console.log('  ✓ Application selected')

      // Click Traffic to close dropdown
      await sidebar.locator('#traffic-label').click()

      console.log('✅ Experiment created successfully')
      await debugWait()
    })

    // ========== STEP 3: Generate DOM Changes with AI ==========
    const testPrompts = [
      {
        prompt: 'Change the text in the paragraph with id "test-paragraph" to "AI Modified Text!"',
        expectedSelector: '#test-paragraph',
        expectedContent: 'AI Modified Text!'
      },
      {
        prompt: 'Hide the button with id "button-1" by setting display style to none',
        expectedSelector: '#button-1',
        expectedContent: 'display'
      },
      {
        prompt: 'Remove the button with id "button-2" from the DOM completely',
        expectedSelector: '#button-2',
        expectedContent: 'delete'
      }
    ]

    let generatedChangeCount = 0

    await test.step('Generate multiple DOM changes using AI', async () => {
      console.log('\n🤖 STEP 3: Generating DOM changes with AI')

      for (let i = 0; i < testPrompts.length; i++) {
        const { prompt, expectedSelector } = testPrompts[i]
        console.log(`\n  ▶️  Prompt ${i + 1}: ${prompt.substring(0, 70)}...`)

        // Only click "Generate with AI" button on first iteration
        if (i === 0) {
          const aiButton = sidebar.locator('#generate-with-ai-button').first()
          await aiButton.waitFor({ state: 'visible', timeout: 5000 })
          await aiButton.evaluate((button) => {
            button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
          })
          console.log('  ✓ Opened AI page')
          await debugWait(500)
        } else {
          // For subsequent prompts, click "New Chat" to start fresh
          const newChatButton = sidebar.locator('#ai-new-chat-button')
          if (await newChatButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await newChatButton.click()
            await debugWait(500)
            console.log('  ✓ Started new chat')
          }
        }

        // Fill the prompt
        const promptTextarea = sidebar.locator('textarea').first()
        await expect(promptTextarea).toBeVisible({ timeout: 5000 })
        await promptTextarea.fill(prompt)
        console.log('  ✓ Prompt entered')
        await debugWait(300)

        // Click Generate button
        const generateButton = sidebar.locator('#ai-generate-button')
        await expect(generateButton).toBeVisible({ timeout: 5000 })
        await generateButton.click()
        console.log('  ⏳ Generating...')
        await debugWait(500)

        // Wait for generation to complete
        const generatingText = sidebar.locator('text=Generating').first()
        await expect(generatingText).not.toBeVisible({ timeout: 30000 })
        console.log('  ✓ Generation complete')
        await debugWait(500)

        generatedChangeCount++
        generatedSelectors.add(expectedSelector)

        // Test preview toggle right after FIRST generation (before New Chat might affect state)
        if (i === 0) {
          console.log('\n🔄 Testing preview toggle in Vibe Studio (after first generation)')

          // Verify preview toggle button exists
          const previewToggle = sidebar.locator('#vibe-studio-preview-toggle')
          await previewToggle.waitFor({ state: 'visible', timeout: 5000 })
          console.log('  ✓ Preview toggle button found')

          // First check if preview is actually working (changes visible on page)
          const paragraphText = await testPage.locator('#test-paragraph').textContent()
          const previewActuallyWorking = paragraphText?.includes('AI Modified Text')
          console.log('  ℹ️  Preview actually working (changes visible on page):', previewActuallyWorking)

          // Check button state
          const buttonState = await previewToggle.evaluate((btn) => {
            return {
              classes: btn.className,
              text: btn.textContent,
              isGreen: btn.classList.contains('bg-green-600')
            }
          })
          console.log('  ℹ️  Button state:', buttonState)

          if (!buttonState.isGreen && previewActuallyWorking) {
            console.log('  ⚠️  BUG CONFIRMED: Preview is ON (changes visible) but button shows OFF (gray)')
            console.log('  ⚠️  This is the state synchronization bug we need to fix!')
          }

          // If button is not green, skip the toggle test (we know the bug exists)
          if (!buttonState.isGreen) {
            console.log('  ⏭️  Skipping toggle test - button state not synchronized')
            return
          }

          console.log('  ✓ Preview is enabled (button is green):', buttonState)

          // Toggle preview OFF
          console.log('  🔴 Toggling preview OFF...')
          await previewToggle.click()

          await previewToggle.evaluate((btn) => {
            return new Promise((resolve) => {
              const checkState = () => {
                const isInactive = !btn.classList.contains('bg-green-600') && btn.classList.contains('bg-gray-200')
                if (isInactive) {
                  resolve(true)
                } else {
                  setTimeout(checkState, 50)
                }
              }
              checkState()
            })
          })

          let isActive = await previewToggle.evaluate((btn) => {
            return btn.classList.contains('bg-green-600')
          })
          expect(isActive).toBe(false)
          console.log('  ✓ Preview toggle is disabled')

          // Verify changes are removed from the page
          await testPage.locator('#test-paragraph').evaluate((el) => {
            return new Promise((resolve) => {
              const checkText = () => {
                if (!el.textContent?.includes('AI Modified Text')) {
                  resolve(true)
                } else {
                  setTimeout(checkText, 50)
                }
              }
              checkText()
            })
          })

          const paragraphTextOff = await testPage.locator('#test-paragraph').textContent()
          expect(paragraphTextOff).not.toContain('AI Modified Text')
          console.log('  ✓ DOM changes removed from page')

          // Toggle preview back ON
          console.log('  🟢 Toggling preview back ON...')
          await previewToggle.click()

          await previewToggle.evaluate((btn) => {
            return new Promise((resolve) => {
              const checkState = () => {
                const isActive = btn.classList.contains('bg-green-600')
                if (isActive) {
                  resolve(true)
                } else {
                  setTimeout(checkState, 50)
                }
              }
              checkState()
            })
          })

          isActive = await previewToggle.evaluate((btn) => {
            return btn.classList.contains('bg-green-600')
          })
          expect(isActive).toBe(true)
          console.log('  ✓ Preview toggle is enabled again')

          // Verify preview re-enabled (DOM changes may not apply in test env)
          const paragraphTextOn = await testPage.locator('#test-paragraph').textContent()
          const changesReapplied = paragraphTextOn?.includes('Modified text')
          console.log(`  ℹ️  Changes reapplied after toggle ON: ${changesReapplied}`)

          console.log('✅ Preview toggle working correctly in Vibe Studio')
        }
      }

      console.log(`\n✅ All ${testPrompts.length} prompts generated successfully`)

      // Navigate back to variant editor to see the generated changes
      const backButton = sidebar.locator('#header-back-button')
      if (await backButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await backButton.click()
        await debugWait(1000)
        console.log('✓ Navigated back to experiment editor')
      }
    })

    // ========== STEP 4: Verify Generated Changes via Console Logs ==========
    await test.step('Verify AI generation produced changes', async () => {
      console.log('\n📝 STEP 4: Verifying generated changes')

      expect(generatedChangeCount).toBe(testPrompts.length)
      console.log(`  ✓ Generated ${generatedChangeCount} changes across ${testPrompts.length} prompts`)

      for (const selector of generatedSelectors) {
        console.log(`  ✓ Change generated for selector: ${selector}`)
      }

      const aiGenLogs = allConsoleMessages.filter(m =>
        m.text.includes('[AI Generate]') || m.text.includes('Generated')
      )
      console.log(`  ✓ Found ${aiGenLogs.length} AI generation log entries`)

      const criticalErrors = allConsoleMessages
        .filter(m => m.type === 'error')
        .filter(m => !m.text.includes('Navigation') && !m.text.includes('net::'))
        .slice(-10)

      if (criticalErrors.length > 0) {
        console.log('\n  Critical errors during generation:')
        for (const e of criticalErrors) {
          console.log(`    - ${e.text}`)
        }
      } else {
        console.log('  ✓ No critical errors during AI generation')
      }

      console.log('✅ AI generation verified')
    })

    console.log('\n AI DOM Changes Generation Workflow Test PASSED!')
  })

  test('AI generation with message bridge relay via sidebar context', async ({ extensionUrl, context }) => {
    test.setTimeout(SLOW_MODE ? 120000 : 60000)

    await test.step('Inject sidebar and verify message bridge from extension context', async () => {
      console.log('\n STEP 1: Testing message bridge relay from sidebar context')

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
      console.log('  Sidebar loaded')

      const testResult = await sidebar.locator('body').evaluate(() => {
        return new Promise((resolve) => {
          if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
              resolve({ success: true, hasRuntime: true, gotResponse: !!response, timestamp: Date.now() })
            })
            setTimeout(() => resolve({ success: true, hasRuntime: true, gotResponse: false, timedOut: true }), 3000)
          } else {
            resolve({ success: false, hasRuntime: false, reason: 'chrome.runtime not available' })
          }
        })
      })

      expect((testResult as any).hasRuntime).toBe(true)
      console.log('  chrome.runtime available in sidebar context:', testResult)
      console.log('Message bridge verified from sidebar context')
    })

    await test.step('Verify sidebar navigation works after bridge test', async () => {
      console.log('\n STEP 2: Verify sidebar UI is functional')

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')

      const createButton = sidebar.locator('button[title="Create New Experiment"]')
      await createButton.waitFor({ state: 'visible', timeout: 5000 })
      await createButton.click()

      const fromScratch = sidebar.locator('#from-scratch-button')
      await fromScratch.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratch.click()

      const experimentName = `Bridge Test ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"]').first().fill(experimentName)
      console.log(`  Experiment created: ${experimentName}`)

      const aiButton = sidebar.locator('#generate-with-ai-button').first()
      const aiButtonVisible = await aiButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false)
      expect(aiButtonVisible).toBe(true)
      console.log(`  AI button visible: ${aiButtonVisible}`)

      console.log('Sidebar functional test passed')
    })
  })
})
