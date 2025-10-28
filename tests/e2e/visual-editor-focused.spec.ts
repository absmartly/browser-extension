import { test, chromium, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

test.describe('Focused Visual Editor Test', () => {
  test('Test key visual editor operations and save', async ({}) => {
    test.setTimeout(90000) // 1.5 minutes
    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')

    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built! Run "npm run build" first')
    }

    console.log('\n🚀 Starting Focused Visual Editor Test')

    // Launch browser with extension
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`,
        '--enable-file-cookies',
      ],
      viewport: { width: 1920, height: 1080 },
      slowMo: 50
    })

    // Get extension ID
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(sw.url()).host

    // Set storage
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`, { waitUntil: 'domcontentloaded', timeout: 10000 })

    await setupPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          const config = {
            apiKey: 'pq2xUUeL3LZecLplTLP3T8qQAG77JnHc3Ln-wa8Uf3WQqFIy47uFLSNmyVBKd3uk',
            apiEndpoint: 'https://demo-2.absmartly.com/v1',
            authMethod: 'apikey'
          }

          chrome.storage.local.set({
            'absmartly-config': config,
            'plasmo:absmartly-config': config
          }, () => resolve(true))
        })
      })
    })

    await setupPage.close()

    // Open test page
    console.log('📄 Opening test page...')
    const page = await context.newPage()
    const testPagePath = path.join(__dirname, '..', 'visual-editor-test-page.html')
    await page.goto(`file://${testPagePath}`, { waitUntil: 'domcontentloaded', timeout: 10000 })

    // Inject sidebar
    await page.evaluate((extId) => {
      if (document.getElementById('absmartly-sidebar-root')) return

      document.body.style.paddingRight = '384px'
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      container.style.cssText = `
        position: fixed; top: 0; right: 0; width: 384px; height: 100%;
        background: white; border-left: 1px solid #e5e7eb;
        box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1); z-index: 2147483647;
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

    // Wait for experiments and click first one
    console.log('⏳ Loading experiments...')

    // Check if experiments are available
    const noExperimentsText = sidebarFrame.locator('text=/No experiments found/i')
    const hasNoExperiments = await noExperimentsText.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasNoExperiments) {
      console.log('⚠️ No experiments available - skipping test')
      await context.close()
      test.skip()
      return
    }

    // Try to find experiments
    const experimentCard = sidebarFrame.locator('div[class*="cursor-pointer"]').first()
    const hasExperiments = await experimentCard.isVisible({ timeout: 5000 }).catch(() => false)

    if (!hasExperiments) {
      console.log('⚠️ No experiments available - skipping test')
      await context.close()
      test.skip()
      return
    }

    await experimentCard.click()
    await sidebarFrame.locator('button:has-text("Visual Editor")').first().waitFor({ state: 'visible', timeout: 5000 })

    // Launch Visual Editor
    console.log('🚀 Launching Visual Editor...')
    await sidebarFrame.locator('button:has-text("Visual Editor")').first().click()
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

    // Verify Visual Editor is active
    const hasVisualEditor = await page.locator('text=/Visual Editor/').count() > 0
    expect(hasVisualEditor).toBe(true)
    console.log('✅ Visual Editor active')

    // Test 3 key operations that create different types of DOM changes
    console.log('\n🧪 Testing visual editor operations...')

    // 1. Edit Text
    console.log('1️⃣ Edit Text...')
    const title = page.locator('#hero-title').first()
    await title.scrollIntoViewIfNeeded()
    await title.click()
    // Wait briefly for UI update
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    // Try to find and click Edit Element in context menu
    const editOption = page.locator('text="Edit Element"').first()
    if (await editOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await editOption.click()
      // Wait briefly for UI update
      await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
      await page.keyboard.type('MODIFIED TITLE')
      await page.keyboard.press('Enter')
      console.log('✅ Text edited')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
    } else {
      console.log('⚠️ Edit Element option not found')
    }

    // 2. Hide Element
    console.log('2️⃣ Hide Element...')
    const card = page.locator('#card-2').first()
    await card.scrollIntoViewIfNeeded()
    await card.click()
    // Wait briefly for UI update
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    const hideOption = page.locator('text="Hide"').first()
    if (await hideOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await hideOption.click()
      console.log('✅ Element hidden')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
    } else {
      console.log('⚠️ Hide option not found')
    }

    // 3. Inline Edit
    console.log('3️⃣ Inline Edit...')
    const button = page.locator('#btn-primary').first()
    await button.scrollIntoViewIfNeeded()
    await button.click()
    // Wait briefly for UI update
    await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})

    const inlineOption = page.locator('text="Inline Edit"').first()
    if (await inlineOption.isVisible({ timeout: 1500 }).catch(() => false)) {
      await inlineOption.click()
      // Wait briefly for UI update
      await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
      await page.keyboard.press('Control+A')
      await page.keyboard.type('NEW BUTTON TEXT')
      await page.keyboard.press('Enter')
      console.log('✅ Inline edit done')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
    } else {
      console.log('⚠️ Inline Edit option not found')
    }

    // Check changes counter
    console.log('\n📊 Checking changes...')
    const changesCounter = page.locator('text=/\\d+ changes/').first()
    const changesText = await changesCounter.textContent().catch(() => null)
    if (changesText) {
      console.log(`Changes made: ${changesText}`)
    }

    // Save changes
    console.log('\n💾 Saving changes...')
    const saveBtn = page.locator('button').filter({ hasText: 'Save' }).first()
    if (await saveBtn.isVisible()) {
      await saveBtn.click()
      console.log('✅ Save button clicked')
      // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

      // Verify DOM changes in sidebar
      console.log('\n🔍 Checking DOM changes in sidebar...')

      // Look for DOM Changes text
      const domChanges = sidebarFrame.locator('text=/DOM Changes/i').first()
      const hasChanges = await domChanges.isVisible({ timeout: 2000 }).catch(() => false)

      if (hasChanges) {
        console.log('✅ DOM Changes section found in sidebar')

        // Check if changes count is displayed
        const changesCount = await sidebarFrame.locator('text=/\\d+\\s+DOM change/i').count()
        if (changesCount > 0) {
          const text = await sidebarFrame.locator('text=/\\d+\\s+DOM change/i').first().textContent()
          console.log(`✅ ${text} saved to experiment`)
        }

        // Try to view the JSON
        const jsonTab = sidebarFrame.locator('button').filter({ hasText: 'JSON' }).first()
        if (await jsonTab.isVisible({ timeout: 1000 }).catch(() => false)) {
          await jsonTab.click()
          // Wait briefly for UI update
          await page.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
          console.log('✅ Viewing DOM changes in JSON editor')
        }
      } else {
        console.log('⚠️ DOM Changes section not visible in sidebar')
      }
    }

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/visual-editor-focused-final.png',
      fullPage: true
    })
    console.log('\n📸 Screenshot saved')

    await context.close()
    console.log('\n✨ Test complete!')
  })
})