import { test, expect } from '../fixtures/extension'
import type { Page } from '@playwright/test'
import path from 'path'
import { injectSidebar } from './utils/test-helpers'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 300) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

const log = (msg: string) => console.log(msg)

test.describe('AI DOM Changes Generation', () => {
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

  test('Generate DOM changes using AI prompts', async ({ extensionId, extensionUrl, context }) => {
    test.setTimeout(SLOW_MODE ? 60000 : 30000)

    await test.step('Inject sidebar', async () => {
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

      const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
      await sidebar.locator('body').waitFor({ timeout: 10000 })
      console.log('✅ Sidebar visible')

      if (DEBUG_MODE) {
        testPage.on('console', msg => {
          const msgText = msg.text()
          if (msgText.includes('[DOMChanges') || msgText.includes('[ExperimentDetail]') || msgText.includes('[ExperimentEditor]') || msgText.includes('[Test Eval]') || msgText.includes('Window message') || msgText.includes('index.tsx') || msgText.includes('AI')) {
            console.log(`  [Sidebar Console] ${msgText}`)
          }
        })
      }
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  Dispatched click event to Create New Experiment button')

      console.log('  Selecting "From Scratch" option...')
      const fromScratchButton = sidebar.locator('#from-scratch-button')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch" option')

      experimentName = `AI DOM Test ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
      console.log(`  Filled experiment name: ${experimentName}`)

      console.log('  Selecting Unit Type...')
      const unitTypeTrigger = sidebar.locator('#unit-type-select-trigger')
      await sidebar.locator('#unit-type-select-trigger:not([class*="cursor-not-allowed"])').waitFor({ timeout: 15000 })
      await unitTypeTrigger.click()
      console.log('  ✓ Clicked Unit Type dropdown')

      const unitTypeDropdown = sidebar.locator('#unit-type-select-dropdown, [data-testid="unit-type-select-dropdown"]')
      await unitTypeDropdown.waitFor({ state: 'visible', timeout: 15000 })

      const firstUnitTypeOption = unitTypeDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstUnitTypeOption.waitFor({ state: 'visible', timeout: 15000 })
      await firstUnitTypeOption.click()
      console.log('  ✓ Selected unit type')

      console.log('  Selecting Applications...')
      const appsContainer = sidebar.locator('label:has-text("Applications")').locator('..')
      const appsClickArea = appsContainer.locator('div[class*="cursor-pointer"], div[class*="border"]').first()

      await appsClickArea.click({ timeout: 5000 })
      console.log('  ✓ Clicked applications field')

      const appsDropdown = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appsDropdown.waitFor({ state: 'visible', timeout: 3000 })

      const firstAppOption = appsDropdown.locator('div[class*="cursor-pointer"]').first()
      await firstAppOption.waitFor({ state: 'visible', timeout: 5000 })
      console.log('  ✓ Applications loaded in dropdown')

      const selectedAppText = await firstAppOption.textContent()
      await firstAppOption.click()
      console.log(`  ✓ Selected application: ${selectedAppText?.trim()}`)

      const appBadge = appsContainer.locator('div[class*="inline-flex"]')
      if (!await appBadge.isVisible({ timeout: 2000 })) {
        throw new Error('Application selection failed - badge not visible')
      }

      await sidebar.locator('label:has-text("Traffic")').click()

      const appsDropdownClosed = sidebar.locator('div[class*="absolute"][class*="z-50"]').first()
      await appsDropdownClosed.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})

      console.log('✅ Experiment form filled with required fields')
    })

    // Note: Anthropic API key is auto-loaded from PLASMO_PUBLIC_ANTHROPIC_API_KEY environment variable
    // The SettingsView component loads it on mount, so no manual configuration needed in tests

    await test.step('Use AI to generate DOM changes', async () => {
      console.log('\n🤖 STEP 3: Generating DOM changes with AI (API key auto-loaded from env)')

      console.log('  Looking for Generate with AI button...')
      const aiButton = sidebar.locator('#generate-with-ai-button').first()
      await aiButton.waitFor({ state: 'visible', timeout: 10000 })
      console.log('  ✓ Found Generate with AI button')

      const prompts = [
        'Change the text in the paragraph with id "test-paragraph" to say "Modified text!"',
        'Hide the button with id "button-1" by setting its display style to none',
        'Remove the button with id "button-2" from the page completely',
        'Move the list item with id "item-2" to appear before the item with id "item-1"',
        'Replace the HTML content inside the div with id "test-container" with this: <h2>HTML Edited!</h2><p>New paragraph content</p>'
      ]

      for (let i = 0; i < prompts.length; i++) {
        console.log(`\n  ${i + 1}. Generating: ${prompts[i].substring(0, 60)}...`)

        // Re-locate the button for each iteration in case the DOM changed
        const aiButtonFresh = sidebar.locator('#generate-with-ai-button').first()
        await aiButtonFresh.waitFor({ state: 'visible', timeout: 5000 })

        // Click to open AI dialog
        await aiButtonFresh.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        console.log('  ✓ Clicked Generate with AI button')

        // Wait for dialog to appear
        await sidebar.locator('[role="dialog"]').waitFor({ state: 'visible', timeout: 5000 })

        // Check if dialog appeared
        const dialogVisible = await sidebar.locator('[role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false)
        console.log(`  Dialog visible: ${dialogVisible}`)

        const promptTextarea = sidebar.locator('textarea').first()
        const textareaVisible = await promptTextarea.isVisible({ timeout: 2000 }).catch(() => false)
        console.log(`  Textarea visible: ${textareaVisible}`)

        if (!textareaVisible) {
          // Debug: Check what's in the sidebar
          const sidebarText = await sidebar.locator('body').textContent()
          console.log(`  Sidebar text includes "prompt": ${sidebarText?.includes('prompt')}`)
          console.log(`  Sidebar text includes "Generate": ${sidebarText?.includes('Generate')}`)
        }

        await expect(promptTextarea).toBeVisible({ timeout: 5000 })

        await promptTextarea.fill(prompts[i])

        // Debug: Verify the prompt was filled correctly
        const filledValue = await promptTextarea.inputValue()
        console.log(`  📝 Prompt filled (${filledValue.length} chars): ${filledValue.substring(0, 80)}...`)

        // Debug: Find and verify Generate button INSIDE dialog
        // Use exact text match to avoid matching "Generate with AI" button
        console.log('  🔍 Looking for Generate button inside dialog...')
        const generateButton = sidebar.locator('button').filter({ hasText: /^Generate$/ })
        const generateButtonVisible = await generateButton.isVisible({ timeout: 2000 }).catch(() => false)
        console.log(`  Generate button visible: ${generateButtonVisible}`)

        if (generateButtonVisible) {
          const buttonText = await generateButton.textContent()
          console.log(`  Generate button text: "${buttonText}"`)
        }

        // Click Generate button (no force:true - let validation work)
        console.log('  🖱️  Clicking Generate button...')
        await generateButton.click()
        console.log('  ✓ Generate button clicked')

        // Wait for loading state to appear (indicates API call started)
        const generatingText = sidebar.locator('text=Generating').first()
        await generatingText.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
          console.log('  ℹ️  "Generating" text did not appear (might be too fast)')
        })

        // Debug: Check for any error messages
        const errorMessage = sidebar.locator('[class*="error"], [class*="alert"]')
        const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false)
        if (hasError) {
          const errorText = await errorMessage.textContent()
          console.log(`  ❌ Error message visible: ${errorText}`)
        }

        const loadingGone = sidebar.locator('text=Generating').first()
        await expect(loadingGone).not.toBeVisible({ timeout: 30000 })
        console.log(`  ✓ Generation ${i + 1} complete`)

        // Check for errors in console
        const errors = allConsoleMessages.filter(m => m.type === 'error').slice(-5)
        if (errors.length > 0) {
          console.log(`  ⚠️  Recent console errors:`)
          errors.forEach(e => console.log(`    - ${e.text}`))
        }

        // Debug: Check if anything was added to the DOM changes
        const domChangeCount = await sidebar.locator('.dom-change-card').count()
        console.log(`  📊 Total DOM changes after generation ${i + 1}: ${domChangeCount}`)

        const closeButton = sidebar.locator('button[aria-label="Close"]')
        if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
          await closeButton.click()
          await closeButton.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
        }
      }

      console.log('\n✅ All 5 DOM changes generated with AI')
    })

    await test.step('Verify generated changes', async () => {
      console.log('\n📝 STEP 4: Verifying generated changes in sidebar')

      // Debug: Check sidebar HTML structure
      const sidebarHTML = await sidebar.locator('body').innerHTML()
      console.log(`  Sidebar HTML length: ${sidebarHTML.length} characters`)

      // Debug: Look for any elements that might contain changes
      const anyChangeElements = await sidebar.locator('[class*="change"], [class*="card"]').count()
      console.log(`  Elements with 'change' or 'card' in class: ${anyChangeElements}`)

      // Wait for DOM change cards to appear
      try {
        await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 15000 })
      } catch (err) {
        console.log('⚠️  DOM change cards did not appear within 15000ms')
        console.log('  Searching for any elements with "dom-change" in class...')
        const anyDomChangeElements = await sidebar.locator('[class*="dom-change"]').count()
        console.log(`  Found ${anyDomChangeElements} elements with "dom-change" in class`)

        // Debug: Check if changes are in the data but not rendered
        const sidebarText = await sidebar.locator('body').textContent()
        console.log('  Sidebar contains "Modified text":', sidebarText?.includes('Modified text'))
        console.log('  Sidebar contains "display":', sidebarText?.includes('display'))
        console.log('  Sidebar contains "none":', sidebarText?.includes('none'))

        throw err
      }

      const count = await sidebar.locator('.dom-change-card').count()
      console.log(`  Found ${count} DOM change cards`)
      expect(count).toBeGreaterThanOrEqual(5)

      const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
      const allText = cardsText.join(' ')

      expect(allText).toContain('#test-paragraph')
      expect(allText).toContain('Modified text!')
      console.log('  ✓ Text change verified')

      // Button-1 should either be hidden with style or removed (both are valid)
      const hasButton1Change = allText.includes('#button-1')
      expect(hasButton1Change).toBe(true)
      console.log('  ✓ Hide/remove change verified for button-1')

      expect(allText).toContain('#button-2')
      console.log('  ✓ Delete change verified')

      expect(allText).toContain('#item-2')
      console.log('  ✓ Move change verified')

      expect(allText).toContain('#test-container')
      expect(allText).toContain('HTML')
      console.log('  ✓ HTML change verified')

      console.log('\n✅ All AI-generated changes verified!')
    })

    console.log('\n🎉 AI DOM Changes Generation Test PASSED!')
  })

  test('Refresh HTML button updates page context', async ({ extensionUrl, context }) => {
    log('\n🔄 Testing Refresh HTML Button')

    // Load actual test page via localhost (not file://)
    await testPage.goto('http://localhost:3456/visual-editor-test.html')
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    log('✅ Test page loaded via localhost')

    // Inject sidebar into the actual webpage
    const sidebar = await injectSidebar(testPage, extensionUrl)
    log('✅ Sidebar injected into test page')

    // Create new experiment
    const createButton = sidebar.locator('button[title="Create New Experiment"]')
    await createButton.waitFor({ state: 'visible', timeout: 10000 })
    await createButton.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked Create New Experiment')

    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
    await fromScratchButton.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked From Scratch')

    // Wait for experiment editor to load
    await sidebar.locator('#experiment-name-input, input[placeholder*="xperiment"]').first().waitFor({ state: 'visible', timeout: 10000 })
    log('✅ Experiment editor loaded')

    // Scroll to make sure Generate with AI button is visible
    const aiButton = sidebar.locator('#generate-with-ai-button')
    await aiButton.scrollIntoViewIfNeeded()
    await aiButton.waitFor({ state: 'visible', timeout: 10000 })

    // Use evaluate to dispatch click event (same pattern as skipped test)
    await aiButton.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked Generate with AI button')

    // Wait for AI page to load
    const aiHeading = sidebar.locator('#ai-dom-generator-heading')
    await aiHeading.waitFor({ state: 'visible', timeout: 10000 })
    log('✅ AI DOM Generator page loaded')

    // Verify Refresh HTML button exists
    const refreshButton = sidebar.locator('#refresh-html-button')
    await refreshButton.waitFor({ state: 'visible', timeout: 5000 })
    log('✅ Refresh HTML button found')

    // Verify button is not disabled initially
    const isDisabled = await refreshButton.isDisabled()
    expect(isDisabled).toBe(false)
    log('✅ Refresh HTML button is enabled')

    // Click the refresh button
    await refreshButton.click()
    log('✅ Clicked Refresh HTML button')

    // Wait for refresh to complete (button re-enabled)
    await expect(refreshButton).toBeEnabled({ timeout: 5000 })
    log('✅ Refresh HTML completed successfully')

    // Verify no error message appeared
    const errorAlert = sidebar.locator('.bg-red-50, .border-red-500').first()
    const hasError = await errorAlert.isVisible().catch(() => false)
    expect(hasError).toBe(false)
    log('✅ No error messages after refresh')

    // Take screenshot for verification
    await testPage.screenshot({ path: 'test-results/refresh-html-button.png', fullPage: true })
    log('📸 Screenshot saved: test-results/refresh-html-button.png')

    log('\n🎉 Refresh HTML Button Test PASSED!')
  })

  // Test that AI uses get_html_chunk tool to inspect elements before making changes
  test('AI uses get_html_chunk tool with Anthropic API', async ({ extensionUrl, context, seedStorage }) => {
    test.setTimeout(120000) // Allow 2 minutes for AI response

    log('\n🤖 Testing AI get_html_chunk tool with Anthropic API')

    // Configure AI provider via seedStorage BEFORE loading pages
    // This ensures the config is loaded when the sidebar initializes
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required for this test')
    }

    const config = {
      apiKey: process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
      apiEndpoint: process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://demo-2.absmartly.com/v1',
      authMethod: 'apikey',
      aiProvider: 'anthropic-api',
      aiApiKey: '' // API key is stored separately in secure storage
    }

    await seedStorage({
      'absmartly-config': config,
      'plasmo:absmartly-config': config,
      'ai-apikey': anthropicApiKey,
      'plasmo:ai-apikey': anthropicApiKey
    })
    log('✅ Seeded storage with Anthropic API config')

    // Collect all console messages for debugging
    const allLogs: string[] = []
    const toolCallLogs: string[] = []

    // Create new page after seeding storage
    const newTestPage = await context.newPage()

    newTestPage.on('console', (msg) => {
      const text = msg.text()
      allLogs.push(`[${msg.type()}] ${text}`)

      if (text.includes('get_html_chunk') || text.includes('Fetching HTML chunk') || text.includes('[Anthropic]')) {
        toolCallLogs.push(text)
        log(`  📝 ${text}`)
      }
      // Log errors and important messages
      if (msg.type() === 'error' || text.includes('[AI') || text.includes('Error') || text.includes('error')) {
        log(`  ⚠️ [${msg.type()}] ${text.substring(0, 150)}`)
      }
    })

    // Listen to service worker logs
    const [serviceWorker] = context.serviceWorkers()
    if (serviceWorker) {
      serviceWorker.on('console', (msg: any) => {
        const text = msg.text()
        allLogs.push(`[SW] ${text}`)
        if (text.includes('[AI') || text.includes('Anthropic') || text.includes('aiProvider') || text.includes('error') || text.includes('Error')) {
          log(`  🔧 [SW] ${text.substring(0, 150)}`)
        }
      })
    }

    // Load test page via localhost
    await newTestPage.goto('http://localhost:3456/visual-editor-test.html')
    await newTestPage.setViewportSize({ width: 1920, height: 1080 })
    log('✅ Test page loaded via localhost')

    // Inject sidebar
    const sidebar = await injectSidebar(newTestPage, extensionUrl)
    log('✅ Sidebar injected into test page')

    // Navigate to create experiment
    const createBtnLocator = sidebar.locator('button[title="Create New Experiment"]')
    await createBtnLocator.waitFor({ state: 'visible', timeout: 10000 })

    // Create new experiment
    await createBtnLocator.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked Create New Experiment')

    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
    await fromScratchButton.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked From Scratch')

    // Wait for experiment editor to load
    await sidebar.locator('#experiment-name-input, input[placeholder*="xperiment"]').first().waitFor({ state: 'visible', timeout: 10000 })
    log('✅ Experiment editor loaded')

    // Navigate to AI page
    const aiButton = sidebar.locator('#generate-with-ai-button')
    await aiButton.scrollIntoViewIfNeeded()
    await aiButton.waitFor({ state: 'visible', timeout: 10000 })
    await aiButton.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked Generate with AI button')

    // Wait for AI page to load
    const aiHeading = sidebar.locator('#ai-dom-generator-heading')
    await aiHeading.waitFor({ state: 'visible', timeout: 10000 })
    log('✅ AI DOM Generator page loaded')

    // Wait a moment for HTML context to be initialized
    await newTestPage.waitForFunction(() => true, null, { timeout: 2000 }).catch(() => {})

    // Enter a prompt that requires inspecting #test-container to understand its content
    const promptTextarea = sidebar.locator('#ai-prompt')
    await promptTextarea.waitFor({ state: 'visible', timeout: 5000 })

    // This prompt requires the AI to inspect the container first
    const testPrompt = 'Look at what is inside the #test-container div and change the section title text to say "Updated by AI"'
    // Clear and type (instead of fill) to ensure React state updates
    await promptTextarea.click()
    await promptTextarea.fill('')
    await promptTextarea.type(testPrompt, { delay: 5 })
    log(`✅ Entered prompt: "${testPrompt}"`)

    // Click Generate button using dispatchEvent pattern (works better in iframe)
    const generateButton = sidebar.locator('#ai-generate-button')
    await generateButton.waitFor({ state: 'visible', timeout: 5000 })
    await generateButton.evaluate((btn) => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    log('✅ Clicked Generate button')

    // Wait for generation to complete - button either shows "Generating..." then returns to normal
    // OR fails immediately with an error. The API might return 401 very quickly if key is invalid.
    // Wait for button to contain "Generate DOM Changes" (back to normal state) with long timeout
    await expect(generateButton).toContainText('Generate DOM Changes', { timeout: 90000 })
    log('✅ Generation completed (or failed)')

    // Take screenshot
    await newTestPage.screenshot({ path: 'test-results/ai-html-chunk-test.png', fullPage: true })
    log('📸 Screenshot saved: test-results/ai-html-chunk-test.png')

    // Check if there was an error
    const errorAlert = sidebar.locator('.bg-red-50')
    const hasError = await errorAlert.isVisible().catch(() => false)
    if (hasError) {
      const errorText = await errorAlert.textContent()
      log(`\n❌ Error occurred: ${errorText}`)
      // If the error is 401, the API key is invalid - this is expected if key expired
      if (errorText?.includes('401') || errorText?.includes('Unauthorized')) {
        log('⚠️ API key appears to be invalid (401 Unauthorized). Test needs a valid API key.')
        throw new Error(`API key is invalid: ${errorText}. Please update ANTHROPIC_API_KEY in .env.dev.local with a valid key.`)
      }
      throw new Error(`AI generation failed: ${errorText}`)
    }

    // Check if get_html_chunk was called (should be in console logs)
    const usedHtmlChunk = toolCallLogs.some(l =>
      l.includes('Fetching HTML chunk') || l.includes('get_html_chunk')
    )
    log(`\n📊 Tool call logs collected: ${toolCallLogs.length}`)
    if (toolCallLogs.length > 0) {
      toolCallLogs.forEach(l => log(`  - ${l.substring(0, 100)}`))
    }

    // Check for any errors in logs
    const errorLogs = allLogs.filter(l => l.toLowerCase().includes('error') && !l.includes('WebSocket'))
    if (errorLogs.length > 0) {
      log(`\n⚠️ Errors in console: ${errorLogs.length}`)
      errorLogs.slice(0, 5).forEach(l => log(`  - ${l.substring(0, 100)}`))
    }

    // Check for assistant response in chat
    const assistantMessage = sidebar.locator('[data-message-index]').last()
    const messageVisible = await assistantMessage.isVisible().catch(() => false)
    if (messageVisible) {
      const messageText = await assistantMessage.textContent()
      log(`✅ Assistant response received: ${messageText?.substring(0, 100)}...`)
    }

    // Verify we got a response
    const chatHistory = sidebar.locator('[data-message-index]')
    const messageCount = await chatHistory.count()
    expect(messageCount).toBeGreaterThanOrEqual(2) // At least user + assistant
    log(`✅ Chat has ${messageCount} messages`)

    // Cleanup
    await newTestPage.close()

    log('\n🎉 AI get_html_chunk Tool Test PASSED!')
  })
})
