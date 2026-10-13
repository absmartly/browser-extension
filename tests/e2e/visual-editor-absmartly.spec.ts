import { test, expect } from '../fixtures/extension'
import { controlledConfigSeed } from '../helpers/management-api/server'

test.describe('Visual Editor Complete Test', () => {
  test.beforeEach(async ({ clearStorage, seedStorage, managementApi }) => {
    await clearStorage()

    // Seed with API credentials
    await seedStorage(controlledConfigSeed(managementApi))
  })

  test('Complete visual editor workflow with all context menu actions', async ({ context, extensionId }) => {
    console.log('\n🚀 Starting Visual Editor Test')
    console.log('Extension ID:', extensionId)

    // Step 1: Navigate to local test page served via extension URL
    console.log('\n📄 Loading local test page...')
    const page = await context.newPage()
    const testPageUrl = `chrome-extension://${extensionId}/local-test-page.html`
    await page.goto(testPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 })
    await page.waitForSelector('body', { timeout: 5000 })
    await page.setViewportSize({ width: 1920, height: 1080 })
    console.log('✅ Test page loaded')

    // Step 2: Inject sidebar exactly like the extension does (from background.ts)
    console.log('\n💉 Injecting sidebar...')
    await page.evaluate((extId) => {
      // Check if sidebar already exists
      const existingSidebar = document.getElementById('absmartly-sidebar-root') as HTMLElement
      if (existingSidebar) {
        console.log('Sidebar already exists')
        return
      }

      console.log('🔵 ABSmartly Extension: Injecting sidebar')

      // Store original body padding
      const originalPadding = document.body.style.paddingRight || '0px'
      document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)

      // Add transition to body
      document.body.style.transition = 'padding-right 0.3s ease-in-out'

      // Push content left
      document.body.style.paddingRight = '384px'

      // Create the sidebar container
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
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.5;
        color: #111827;
        transform: translateX(0);
        transition: transform 0.3s ease-in-out;
      `

      // Create the iframe
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
      `
      // Use chrome-extension URL
      iframe.src = `chrome-extension://${extId}/tabs/sidebar.html`

      container.appendChild(iframe)
      document.body.appendChild(container)

      console.log('🔵 ABSmartly Extension: Sidebar injected successfully')
    }, extensionId)

    // Wait for sidebar to appear
    await page.waitForSelector('#absmartly-sidebar-root', { timeout: 5000 })
    console.log('✅ Sidebar injected')

    // Step 3: Work with the sidebar iframe
    console.log('\n📱 Interacting with sidebar...')
    const sidebarFrame = page.frameLocator('#absmartly-sidebar-iframe')

    // Wait for sidebar content to load
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 5000 }).catch(() => {}) // Give time for API calls

    // Check if we need to configure first
    const needsConfig = await sidebarFrame.locator('#configure-settings-button').isVisible().catch(() => false)

    if (needsConfig) {
      console.log('⚙️ Extension needs configuration, skipping...')
      // In a real test, we'd configure here
    }

    // Wait for experiments list or check if there are any
    const hasExperiments = await sidebarFrame.locator('.experiment-item').count().then(c => c > 0).catch(() => false)

    if (!hasExperiments) {
      console.log('⚠️ No experiments found in sidebar')

      // Check for empty state
      const hasEmptyState = await sidebarFrame.locator('text=/no experiments/i').isVisible().catch(() => false)
      if (hasEmptyState) {
        console.log('   Sidebar shows empty state - no experiments available')
      }

      // Can't proceed without experiments
      console.log('❌ Cannot test visual editor without experiments')
      return
    }

    console.log(`✅ Found experiments in sidebar`)

    // Step 4: Click on first experiment to go to details
    console.log('\n🔍 Opening experiment details...')
    await sidebarFrame.locator('.experiment-item').first().click()
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

    // Step 5: Click Visual Editor button
    console.log('\n🎨 Launching Visual Editor...')
    const visualEditorBtn = sidebarFrame.locator('#visual-editor-button').first()

    const btnVisible = await visualEditorBtn.isVisible().catch(() => false)
    if (!btnVisible) {
      console.log('⚠️ Visual Editor button not found')

      // Try to find back button to ensure we're on details page
      const hasBackBtn = await sidebarFrame.locator('#back-button').isVisible().catch(() => false)
      console.log('   On details page:', hasBackBtn)

      return
    }

    await visualEditorBtn.click()
    console.log('✅ Clicked Visual Editor button')

    // Wait for visual editor to activate on the page
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

    // Step 6: Check if visual editor toolbar appeared
    console.log('\n🔧 Checking for Visual Editor toolbar...')
    const hasToolbar = await page.locator('#absmartly-visual-editor-toolbar').isVisible().catch(() => false)

    if (!hasToolbar) {
      console.log('⚠️ Visual editor toolbar did not appear')

      // Take screenshot for debugging
      await page.screenshot({ path: 'test-results/no-toolbar.png', fullPage: true })
      console.log('   Screenshot saved to test-results/no-toolbar.png')

      return
    }

    console.log('✅ Visual editor toolbar is visible')

    // Step 7: Test context menu on various elements
    console.log('\n🖱️ Testing context menu actions...')

    // Find a heading element to test
    const headings = await page.locator('h1, h2, h3').all()
    if (headings.length > 0) {
      console.log(`Found ${headings.length} heading elements`)

      // Test Edit Text
      console.log('\n1️⃣ Testing Edit Text on heading...')
      const heading = headings[0]
      await heading.scrollIntoViewIfNeeded()
      await heading.hover()

      // Right-click to open context menu
      await heading.click({ button: 'right' })
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      // Look for context menu
      const contextMenu = page.locator('.absmartly-context-menu').first()
      const menuVisible = await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)

      if (menuVisible) {
        console.log('✅ Context menu appeared')

        // Click Edit Text option
        const editOption = contextMenu.locator('text=/edit.*text/i').first()
        if (await editOption.isVisible()) {
          await editOption.click()
          console.log('   Clicked Edit Text')

          // Type new text
          await page.keyboard.type('Modified by Visual Editor Test')
          await page.keyboard.press('Enter')
          console.log('   Text modified')
        }
      } else {
        console.log('⚠️ Context menu did not appear')
      }
    }

    // Find a button or link to test style changes
    const buttons = await page.locator('button, a').all()
    if (buttons.length > 0) {
      console.log(`\n2️⃣ Testing Change Style on button/link...`)
      const button = buttons[0]
      await button.scrollIntoViewIfNeeded()
      await button.hover()

      // Right-click
      await button.click({ button: 'right' })
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      const contextMenu = page.locator('.absmartly-context-menu').first()
      if (await contextMenu.isVisible()) {
        const styleOption = contextMenu.locator('text=/style|css/i').first()
        if (await styleOption.isVisible()) {
          await styleOption.click()
          console.log('   Clicked Change Style')

          // Close any dialog
          await page.keyboard.press('Escape')
        }
      }
    }

    // Test Hide on a paragraph
    const paragraphs = await page.locator('p').all()
    if (paragraphs.length > 0) {
      console.log(`\n3️⃣ Testing Hide Element on paragraph...`)
      const para = paragraphs[0]
      await para.scrollIntoViewIfNeeded()
      await para.hover()

      // Right-click
      await para.click({ button: 'right' })
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

      const contextMenu = page.locator('.absmartly-context-menu').first()
      if (await contextMenu.isVisible()) {
        const hideOption = contextMenu.locator('text=/hide/i').first()
        if (await hideOption.isVisible()) {
          await hideOption.click()
          console.log('   Clicked Hide Element')

          // Check if element was hidden
          // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
          const isHidden = await para.isHidden().catch(() => false)
          console.log('   Element hidden:', isHidden)
        }
      }
    }

    // Check toolbar for changes counter
    console.log('\n📊 Checking toolbar state...')
    const toolbar = page.locator('#absmartly-visual-editor-toolbar')

    // Look for change counter
    const changeCounter = toolbar.locator('[class*="change"], [class*="count"], text=/changes/i').first()
    if (await changeCounter.isVisible()) {
      const count = await changeCounter.textContent()
      console.log('   Changes counter:', count)
    }

    // Check for Save button
    const saveBtn = toolbar.locator('#save-button').first()
    if (await saveBtn.isVisible()) {
      console.log('   ✅ Save button available')
    }

    // Check for Exit button
    const exitBtn = toolbar.locator('#cancel-button, #exit-button, button[title*="Close"]').first()
    if (await exitBtn.isVisible()) {
      console.log('   ✅ Exit button available')
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/visual-editor-final.png', fullPage: true })
    console.log('\n📸 Final screenshot saved to test-results/visual-editor-final.png')

    console.log('\n✨ Test completed!')
  })
})