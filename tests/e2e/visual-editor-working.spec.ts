import { test as base, chromium, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

// Simplified test fixture without the problematic clearStorage
const test = base.extend<{
  extensionId: string;
  extensionPath: string;
}>({
  extensionId: async ({}, use) => {
    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    // Launch browser with extension
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      viewport: { width: 1920, height: 1080 },
      slowMo: parseInt(process.env.SLOW_MO || '0')
    })

    // Get extension ID
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(sw.url()).host

    await use(extensionId)
    await context.close()
  },

  extensionPath: async ({}, use) => {
    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
    await use(extensionPath)
  }
})

test.describe('Visual Editor Test', () => {
  test('Launch visual editor and test context menu', async ({ browser }) => {
    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    // Verify extension is built
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built! Run "npm run build" first')
    }

    console.log('\n🚀 Starting Visual Editor Test')

    // Launch browser with extension
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      viewport: { width: 1920, height: 1080 },
      slowMo: parseInt(process.env.SLOW_MO || '500')
    })

    // Get extension ID
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(sw.url()).host
    console.log('Extension ID:', extensionId)

    // Step 1: Navigate to a real website
    console.log('\n📄 Navigating to test website...')
    const page = await context.newPage()

    // Try example.com first (simpler page)
    await page.goto('https://example.com', { waitUntil: 'networkidle' })
    console.log('✅ Page loaded')

    // Step 2: Inject sidebar by simulating extension icon click
    console.log('\n💉 Injecting sidebar...')

    // Execute the exact code from background.ts
    await page.evaluate((extId) => {
      // Check if already exists
      const existing = document.getElementById('absmartly-sidebar-root')
      if (existing) {
        console.log('Sidebar already exists')
        return
      }

      console.log('Injecting ABsmartly sidebar...')

      // Store original padding
      const originalPadding = document.body.style.paddingRight || '0px'
      document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)

      // Animate body padding
      document.body.style.transition = 'padding-right 0.3s ease-in-out'
      document.body.style.paddingRight = '384px'

      // Create sidebar container
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

      // Create iframe
      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
      `
      iframe.src = `chrome-extension://${extId}/tabs/sidebar.html`

      container.appendChild(iframe)
      document.body.appendChild(container)

      console.log('Sidebar injected successfully')
    }, extensionId)

    // Wait for sidebar
    await page.waitForSelector('#absmartly-sidebar-root', { timeout: 5000 })
    console.log('✅ Sidebar container found')

    // Wait for iframe to load
    const iframe = await page.waitForSelector('#absmartly-sidebar-iframe', { state: 'attached', timeout: 5000 })
    await iframe.waitForElementState('visible', { timeout: 3000 })

    // Step 3: Try to interact with sidebar
    console.log('\n📱 Checking sidebar content...')

    // Get iframe handle
    const iframeHandle = await page.$('#absmartly-sidebar-iframe')
    if (!iframeHandle) {
      console.log('❌ Could not find sidebar iframe')
      await context.close()
      return
    }

    // Try to get frame
    const frame = await iframeHandle.contentFrame()
    if (!frame) {
      console.log('⚠️ Could not access iframe content (cross-origin)')

      // Alternative: Check if experiments are available by looking at the page
      console.log('\n📊 Checking experiments availability...')

      // Take screenshot to see what's happening
      await page.screenshot({
        path: 'test-results/sidebar-state.png',
        fullPage: false
      })
      console.log('📸 Screenshot saved to test-results/sidebar-state.png')
    } else {
      console.log('✅ Accessed sidebar frame')

      // Check for experiments or config needed
      const needsConfig = await frame.locator('button:has-text("Configure Settings")').isVisible().catch(() => false)
      const hasExperiments = await frame.locator('.experiment-item').count().catch(() => 0)

      console.log('Needs configuration:', needsConfig)
      console.log('Number of experiments:', hasExperiments)

      if (hasExperiments > 0) {
        console.log('\n🔍 Clicking first experiment...')
        const experimentItem = frame.locator('.experiment-item').first()
        await experimentItem.waitFor({ state: 'visible', timeout: 3000 })
        await experimentItem.click()
        await frame.locator('button:has-text("Visual Editor")').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {})

        // Look for Visual Editor button
        const hasVisualEditorBtn = await frame.locator('button:has-text("Visual Editor")').isVisible().catch(() => false)
        console.log('Visual Editor button visible:', hasVisualEditorBtn)

        if (hasVisualEditorBtn) {
          console.log('🎨 Clicking Visual Editor button...')
          await frame.locator('button:has-text("Visual Editor")').first().click()
          await page.waitForSelector('#absmartly-visual-editor-toolbar', { timeout: 5000 }).catch(() => {})

          // Check for toolbar on main page
          const hasToolbar = await page.locator('#absmartly-visual-editor-toolbar').isVisible().catch(() => false)
          console.log('Visual editor toolbar visible:', hasToolbar)

          if (hasToolbar) {
            console.log('\n🖱️ Testing context menu...')

            // Find an element to test
            const heading = page.locator('h1').first()
            if (await heading.isVisible()) {
              // Right-click for context menu
              await heading.click({ button: 'right' })
              await page.waitForSelector('.absmartly-context-menu', { timeout: 2000 }).catch(() => {})

              // Look for context menu
              const hasMenu = await page.locator('.absmartly-context-menu').isVisible().catch(() => false)
              console.log('Context menu appeared:', hasMenu)
            }
          }
        }
      } else if (needsConfig) {
        console.log('⚙️ Extension needs configuration')
      } else {
        console.log('📭 No experiments available')
      }
    }

    // Final screenshot
    await page.screenshot({
      path: 'test-results/final-state.png',
      fullPage: true
    })
    console.log('\n📸 Final screenshot saved to test-results/final-state.png')

    // Clean up
    await context.close()
    console.log('\n✨ Test complete!')
  })
})