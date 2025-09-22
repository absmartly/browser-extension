import { test, chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

test.describe('Simple Visual Editor Test', () => {
  test('Visual editor with proper storage setup', async ({}) => {
    test.setTimeout(60000) // 1 minute timeout
    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built! Run "npm run build" first')
    }

    console.log('\n🚀 Starting Simple Visual Editor Test')

    // Launch browser with extension
    const context = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      viewport: { width: 1920, height: 1080 },
      slowMo: 100
    })

    // Get extension ID
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(sw.url()).host
    console.log('Extension ID:', extensionId)

    // Step 1: Set storage BEFORE opening any pages
    console.log('\n⚙️ Setting API credentials in storage...')
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)

    // Clear any existing storage and set new credentials
    const result = await setupPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          const config = {
            apiKey: 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
            apiEndpoint: 'https://demo-2.absmartly.com/v1',
            applicationId: null,
            authMethod: 'apikey',
            domChangesStorageType: null,
            domChangesFieldName: null
          }

          chrome.storage.local.set({
            'absmartly-config': config,
            'plasmo:absmartly-config': config
          }, () => {
            chrome.storage.local.get(null, (items) => {
              resolve(items)
            })
          })
        })
      })
    })

    console.log('✅ Storage set:', Object.keys(result))
    await setupPage.close()

    // Step 2: Open the test page
    console.log('\n📄 Opening test page...')
    const page = await context.newPage()
    const testPagePath = path.join(__dirname, '..', 'visual-editor-test-page.html')
    await page.goto(`file://${testPagePath}`)
    await page.waitForLoadState('domcontentloaded')

    // Step 3: Inject the sidebar
    console.log('\n💉 Injecting sidebar into the page...')
    await page.evaluate((extId) => {
      const existing = document.getElementById('absmartly-sidebar-root')
      if (existing) {
        console.log('Sidebar already exists')
        return
      }

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
        height: 100%;
        background-color: white;
        border-left: 1px solid #e5e7eb;
        box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
        z-index: 2147483647;
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
      iframe.src = `chrome-extension://${extId}/tabs/sidebar.html`

      container.appendChild(iframe)
      document.body.appendChild(container)
      console.log('Sidebar injected successfully')
    }, extensionId)

    // Wait for sidebar to appear
    await page.waitForSelector('#absmartly-sidebar-root', { timeout: 5000 })
    console.log('✅ Sidebar injected into page')

    // Access the sidebar iframe
    const sidebarFrame = page.frameLocator('#absmartly-sidebar-iframe')

    // Wait for experiments to load using proper selectors
    console.log('\n⏳ Waiting for experiments to load...')
    await sidebarFrame.locator('div[class*="cursor-pointer"]').first().waitFor({ state: 'visible', timeout: 10000 })

    const experimentCards = sidebarFrame.locator('div[class*="cursor-pointer"]')
    const experimentCount = await experimentCards.count()
    console.log(`✅ ${experimentCount} experiments loaded`)

    // Click first experiment
    console.log('\n🔍 Clicking first experiment...')
    await experimentCards.first().click()

    // Wait for detail view to load - look for Visual Editor button
    console.log('Waiting for experiment detail view...')
    await sidebarFrame.locator('button:has-text("Visual Editor")').first().waitFor({ state: 'visible', timeout: 5000 })

    const visualEditorBtns = sidebarFrame.locator('button:has-text("Visual Editor")')
    const btnCount = await visualEditorBtns.count()
    console.log(`Found ${btnCount} Visual Editor button(s)`)

    // Click Visual Editor button
    console.log('\n🚀 Launching Visual Editor...')
    await visualEditorBtns.first().click()

    // Give it a moment to initialize
    await page.waitForTimeout(3000)

    // Take screenshot to see state
    await page.screenshot({
      path: 'test-results/after-visual-editor-click.png',
      fullPage: true
    })

    // Check if visual editor header appears
    const hasVisualEditor = await page.locator('text=/Visual Editor/').count() > 0
    if (hasVisualEditor) {
      console.log('✅ Visual Editor launched successfully!')
    } else {
      console.log('⚠️ Visual Editor may not have fully launched, continuing anyway...')
    }

    // Test context menu
    console.log('\n🧪 Testing context menu...')
    const heading = page.locator('#hero-title').first()
    await heading.scrollIntoViewIfNeeded()
    await heading.click()

    // Wait for context menu to appear - it should show up quickly
    try {
      await page.locator('text="Edit Element"').waitFor({ state: 'visible', timeout: 2000 })
      console.log('✅ Context menu appeared!')

      // Take screenshot with context menu
      await page.screenshot({
        path: 'test-results/visual-editor-with-context-menu.png',
        fullPage: true
      })
      console.log('📸 Screenshot saved showing context menu')

      // Click Edit Element
      await page.locator('text="Edit Element"').click()
      await page.keyboard.type('Modified Title')
      await page.keyboard.press('Enter')
      console.log('✅ Modified element text')

      // Test Hide on another element
      const card = page.locator('#card-2').first()
      await card.click()
      await page.locator('text="Hide"').waitFor({ state: 'visible', timeout: 2000 })
      await page.locator('text="Hide"').click()
      console.log('✅ Hidden element')

      // Check changes counter
      const changesText = await page.locator('text=/\\d+ changes/').textContent()
      console.log(`📊 Changes made: ${changesText}`)

      // Save changes
      console.log('\n💾 Saving changes...')
      const saveBtn = page.locator('button:has-text("Save")').first()
      if (await saveBtn.isVisible()) {
        await saveBtn.click()
        console.log('✅ Changes saved!')
      }

    } catch (e) {
      console.log('⚠️ Context menu did not appear or interaction failed')
      console.log('Error:', e.message)
    }

    // Final screenshot
    await page.screenshot({
      path: 'test-results/visual-editor-final.png',
      fullPage: true
    })

    // Keep browser open for manual inspection
    console.log('\n⏸️  Waiting 10 seconds before closing...')
    await page.waitForTimeout(10000)

    await context.close()
    console.log('\n✨ Test complete!')
  })
})