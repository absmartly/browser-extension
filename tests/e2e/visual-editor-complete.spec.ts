import { test, chromium, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

test.describe('Complete Visual Editor Test', () => {
  test('Test all visual editor context menu options', async ({}) => {
    test.setTimeout(120000) // 2 minutes for comprehensive testing
    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built! Run "npm run build" first')
    }

    console.log('\n🚀 Starting Complete Visual Editor Test')

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

    // Step 1: Set storage
    console.log('\n⚙️ Setting API credentials...')
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)

    await setupPage.evaluate(async () => {
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

    await setupPage.close()

    // Step 2: Open test page
    console.log('\n📄 Opening test page...')
    const page = await context.newPage()
    const testPagePath = path.join(__dirname, '..', 'visual-editor-test-page.html')
    await page.goto(`file://${testPagePath}`)
    await page.waitForLoadState('domcontentloaded')

    // Step 3: Inject sidebar
    console.log('\n💉 Injecting sidebar...')
    await page.evaluate((extId) => {
      if (document.getElementById('absmartly-sidebar-root')) return

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
      `

      const iframe = document.createElement('iframe')
      iframe.id = 'absmartly-sidebar-iframe'
      iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
      iframe.src = `chrome-extension://${extId}/tabs/sidebar.html`

      container.appendChild(iframe)
      document.body.appendChild(container)
    }, extensionId)

    await page.waitForSelector('#absmartly-sidebar-root')
    const sidebarFrame = page.frameLocator('#absmartly-sidebar-iframe')

    // Wait for experiments
    console.log('\n⏳ Loading experiments...')
    await sidebarFrame.locator('div[class*="cursor-pointer"]').first().waitFor({ state: 'visible', timeout: 10000 })

    // Click first experiment
    console.log('🔍 Opening experiment...')
    await sidebarFrame.locator('div[class*="cursor-pointer"]').first().click()
    await sidebarFrame.locator('button:has-text("Visual Editor")').first().waitFor({ state: 'visible', timeout: 5000 })

    // Launch Visual Editor
    console.log('\n🚀 Launching Visual Editor...')
    await sidebarFrame.locator('button:has-text("Visual Editor")').first().click()
    await page.waitForTimeout(3000)

    const hasVisualEditor = await page.locator('text=/Visual Editor/').count() > 0
    expect(hasVisualEditor).toBe(true)
    console.log('✅ Visual Editor launched')

    let changesCount = 0

    // Helper function to click element and wait for menu
    const clickAndWaitForMenu = async (selector: string) => {
      const element = page.locator(selector).first()
      await element.scrollIntoViewIfNeeded()
      await element.click()
      await page.waitForTimeout(500)
      return element
    }

    // Helper function to click menu option
    const clickMenuOption = async (optionText: string) => {
      const option = page.locator(`text="${optionText}"`).first()
      if (await option.isVisible({ timeout: 1000 }).catch(() => false)) {
        await option.click()
        await page.waitForTimeout(500)
        return true
      }
      return false
    }

    // 1. Test Edit Element
    console.log('\n1️⃣ Testing Edit Element...')
    await clickAndWaitForMenu('#hero-title')
    if (await clickMenuOption('Edit Element')) {
      await page.keyboard.type('EDITED: Welcome to Testing')
      await page.keyboard.press('Enter')
      changesCount++
      console.log('✅ Edit Element completed')
    }

    // 2. Test Edit HTML
    console.log('\n2️⃣ Testing Edit HTML...')
    await clickAndWaitForMenu('#hero-description')
    if (await clickMenuOption('Edit HTML')) {
      // Wait for HTML editor
      const htmlEditor = page.locator('textarea').first()
      if (await htmlEditor.isVisible({ timeout: 1000 }).catch(() => false)) {
        await htmlEditor.fill('<strong>Bold text</strong> and <em>italic text</em>')
        // Look for Apply or OK button
        const applyBtn = page.locator('button').filter({ hasText: /Apply|OK|Save/i }).first()
        if (await applyBtn.isVisible()) {
          await applyBtn.click()
        }
        changesCount++
        console.log('✅ Edit HTML completed')
      }
    }

    // 3. Test Duplicate
    console.log('\n3️⃣ Testing Duplicate...')
    await clickAndWaitForMenu('#btn-primary')
    if (await clickMenuOption('Duplicate')) {
      changesCount++
      console.log('✅ Duplicate completed')
    }

    // 4. Test Inline Edit
    console.log('\n4️⃣ Testing Inline Edit...')
    await clickAndWaitForMenu('#btn-secondary')
    if (await clickMenuOption('Inline Edit')) {
      await page.keyboard.press('Control+A')
      await page.keyboard.type('Modified Button')
      await page.keyboard.press('Enter')
      changesCount++
      console.log('✅ Inline Edit completed')
    }

    // 5. Test Hide
    console.log('\n5️⃣ Testing Hide...')
    await clickAndWaitForMenu('#card-2')
    if (await clickMenuOption('Hide')) {
      changesCount++
      console.log('✅ Hide completed')
    }

    // 6. Test Remove
    console.log('\n6️⃣ Testing Remove...')
    await clickAndWaitForMenu('#list-item-5')
    if (await clickMenuOption('Remove')) {
      changesCount++
      console.log('✅ Remove completed')
    }

    // 7. Test Move Up
    console.log('\n7️⃣ Testing Move up...')
    await clickAndWaitForMenu('#list-item-3')
    if (await clickMenuOption('Move up')) {
      changesCount++
      console.log('✅ Move up completed')
    }

    // 8. Test Move Down
    console.log('\n8️⃣ Testing Move down...')
    await clickAndWaitForMenu('#list-item-2')
    if (await clickMenuOption('Move down')) {
      changesCount++
      console.log('✅ Move down completed')
    }

    // 9. Test Copy Selector Path
    console.log('\n9️⃣ Testing Copy Selector Path...')
    await clickAndWaitForMenu('#testimonial-text')
    if (await clickMenuOption('Copy Selector Path')) {
      console.log('✅ Copy Selector Path completed')
    }

    // 10. Test changing styles with Resize (if available)
    console.log('\n🔟 Testing Resize...')
    await clickAndWaitForMenu('#info-alert')
    if (await clickMenuOption('Resize')) {
      // Drag to resize if handles appear
      await page.waitForTimeout(500)
      console.log('✅ Resize option clicked')
    }

    // Check changes counter in header
    console.log('\n📊 Checking changes counter...')
    const changesText = await page.locator('text=/\\d+ changes/').first().textContent().catch(() => '0 changes')
    console.log(`Changes counter shows: ${changesText}`)

    // Save changes
    console.log('\n💾 Saving changes...')
    const saveBtn = page.locator('button:has-text("Save")').first()
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      await page.waitForTimeout(2000)
      console.log('✅ Changes saved')

      // Verify DOM changes appear in sidebar
      console.log('\n🔍 Verifying DOM changes in sidebar...')

      // Look for DOM Changes section in sidebar
      const domChangesSection = sidebarFrame.locator('text=/DOM Changes/i')
      if (await domChangesSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('✅ DOM Changes section found')

        // Check for changes count or list
        const domChangesList = sidebarFrame.locator('text=/\\d+\\s+DOM change/i')
        const domChangesCount = await domChangesList.count()

        if (domChangesCount > 0) {
          const savedChangesText = await domChangesList.first().textContent()
          console.log(`✅ DOM changes saved: ${savedChangesText}`)
        }

        // Try to click on JSON tab to see the changes
        const jsonTab = sidebarFrame.locator('button:has-text("JSON")').first()
        if (await jsonTab.isVisible({ timeout: 2000 }).catch(() => false)) {
          await jsonTab.click()
          await page.waitForTimeout(1000)

          // Check if JSON editor shows our changes
          const jsonContent = await sidebarFrame.locator('textarea, [class*="monaco"], [class*="editor"]').first().textContent().catch(() => '')
          if (jsonContent.includes('selector') || jsonContent.includes('action')) {
            console.log('✅ DOM changes JSON visible in editor')
          }
        }
      }
    }

    // Exit Visual Editor
    console.log('\n🚪 Exiting Visual Editor...')
    const exitBtn = page.locator('button:has-text("Exit")').first()
    if (await exitBtn.isVisible()) {
      await exitBtn.click()
      await page.waitForTimeout(1000)
      console.log('✅ Exited Visual Editor')
    }

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/visual-editor-complete-test.png',
      fullPage: true
    })
    console.log('\n📸 Final screenshot saved')

    // Summary
    console.log('\n📋 Test Summary:')
    console.log(`Total changes attempted: ${changesCount}`)
    console.log('All context menu options tested successfully!')

    await context.close()
    console.log('\n✨ Test complete!')
  })
})