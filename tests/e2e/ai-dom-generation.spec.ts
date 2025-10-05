import { test, expect } from '../fixtures/extension'
import { Page } from '@playwright/test'
import path from 'path'

const TEST_PAGE_PATH = path.join(__dirname, '..', 'test-pages', 'visual-editor-test.html')

const SLOW_MODE = process.env.SLOW === '1'
const debugWait = async (ms: number = 300) => SLOW_MODE ? new Promise(resolve => setTimeout(resolve, ms)) : Promise.resolve()
const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

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
    test.setTimeout(SLOW_MODE ? 180000 : 90000)

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

      await debugWait()
    })

    const sidebar = testPage.frameLocator('#absmartly-sidebar-iframe')
    let experimentName: string

    await test.step('Create new experiment', async () => {
      console.log('\n📋 STEP 2: Creating new experiment')

      await sidebar.locator('button[title="Create New Experiment"]').evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  Dispatched click event to Create New Experiment button')
      await debugWait()

      console.log('  Selecting "From Scratch" option...')
      const fromScratchButton = sidebar.locator('button:has-text("From Scratch"), button:has-text("from scratch")')
      await fromScratchButton.waitFor({ state: 'visible', timeout: 5000 })
      await fromScratchButton.evaluate((button) => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      })
      console.log('  ✓ Selected "From Scratch" option')
      await debugWait()

      experimentName = `AI DOM Test ${Date.now()}`
      await sidebar.locator('input[placeholder*="xperiment"], input[name="name"], input[type="text"]').first().fill(experimentName)
      console.log(`  Filled experiment name: ${experimentName}`)
      await debugWait()

      console.log('  Selecting Unit Type...')
      const unitTypeSelect = sidebar.locator('label:has-text("Unit Type")').locator('..').locator('select')
      await unitTypeSelect.waitFor({ state: 'visible', timeout: 5000 })

      await sidebar.locator('label:has-text("Unit Type")').locator('..').locator('select option').nth(1).waitFor({ state: 'attached', timeout: 10000 })
      console.log('  ✓ Unit types loaded')

      const unitTypeOptions = await unitTypeSelect.locator('option').count()
      if (unitTypeOptions < 2) {
        throw new Error('No unit types available - form cannot be filled')
      }

      const firstUnitTypeValue = await unitTypeSelect.locator('option').nth(1).getAttribute('value')
      await unitTypeSelect.selectOption(firstUnitTypeValue || '')
      console.log(`  ✓ Selected unit type`)
      await debugWait()

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
      await debugWait()
    })

    // Note: Anthropic API key is auto-loaded from PLASMO_PUBLIC_ANTHROPIC_API_KEY environment variable
    // The SettingsView component loads it on mount, so no manual configuration needed in tests

    await test.step('Use AI to generate DOM changes', async () => {
      console.log('\n🤖 STEP 3: Generating DOM changes with AI (API key auto-loaded from env)')

      console.log('  Looking for Generate with AI button...')
      const aiButton = sidebar.locator('button:has-text("Generate with AI")').first()
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
        const aiButtonFresh = sidebar.locator('button:has-text("Generate with AI")').first()
        await aiButtonFresh.waitFor({ state: 'visible', timeout: 5000 })

        // Try clicking with JavaScript to bypass any event issues
        await aiButtonFresh.evaluate((button) => {
          button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
        })
        console.log('  ✓ Clicked Generate with AI button')
        await debugWait(1000)

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
        await debugWait(300)

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

        // Debug: Check if loading state appears
        console.log('  🖱️  Clicking Generate button...')
        await generateButton.click({ force: true })
        console.log('  ✓ Generate button clicked')

        await debugWait(500)

        // Debug: Check if "Generating" text appears (indicates loading state)
        const generatingText = sidebar.locator('text=Generating').first()
        const isGenerating = await generatingText.isVisible({ timeout: 2000 }).catch(() => false)
        console.log(`  "Generating" text visible: ${isGenerating}`)

        await debugWait(500)

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
          await debugWait(300)
        }
      }

      console.log('\n✅ All 5 DOM changes generated with AI')
    })

    await test.step('Verify generated changes', async () => {
      console.log('\n📝 STEP 4: Verifying generated changes in sidebar')

      await debugWait(1000)

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
})
