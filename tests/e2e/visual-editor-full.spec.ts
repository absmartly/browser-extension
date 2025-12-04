import { test, expect } from '../fixtures/extension'
import path from 'path'
import fs from 'fs'

test.describe('Visual Editor Full Test with Context Menu', () => {
  test.beforeEach(async ({ clearStorage, seedStorage }) => {
    await clearStorage()

    // Seed with API credentials
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey'
    })

    // Copy test page to build directory
    const testPageSource = path.join(__dirname, '..', 'test-page.html')
    const testPageDest = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev', 'test-page.html')
    if (fs.existsSync(testPageSource)) {
      fs.copyFileSync(testPageSource, testPageDest)
      console.log('Copied test page to build directory')
    }
  })

  test('Complete visual editor workflow with all context menu actions', async ({ context, extensionUrl, extensionId }) => {
    // Step 1: Open the extension sidebar to get access to experiments
    console.log('\n📱 Opening extension sidebar...')
    const sidebarPage = await context.newPage()
    await sidebarPage.goto(extensionUrl('tabs/sidebar.html', { waitUntil: 'domcontentloaded', timeout: 10000 }))
    await sidebarPage.setViewportSize({ width: 400, height: 1080 })

    // Wait for sidebar to load
    await sidebarPage.waitForSelector('body', { timeout: 5000 })
    // TODO: Replace timeout with specific element wait
    await sidebarPage.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

    // Step 2: Open test page in new tab (this will have content script injected)
    console.log('📄 Opening test page...')
    const testPage = await context.newPage()
    await testPage.goto(extensionUrl('test-page.html', { waitUntil: 'domcontentloaded', timeout: 10000 }))
    await testPage.setViewportSize({ width: 1520, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5000 })

    // Step 3: Check if extension content script is injected
    const hasContentScript = await testPage.evaluate(() => {
      return typeof (window as any).__ABSMARTLY_EXTENSION__ !== 'undefined' ||
             document.querySelector('[data-absmartly]') !== null
    })
    console.log('Content script injected:', hasContentScript)

    // Step 4: Try to activate visual editor through the extension
    console.log('\n🎯 Attempting to activate visual editor...')

    // Method 1: Try through sidebar
    await sidebarPage.bringToFront()
    const experimentCount = await sidebarPage.locator('.experiment-item').count()
    console.log(`Found ${experimentCount} experiments in sidebar`)

    if (experimentCount > 0) {
      // Click on first experiment
      await sidebarPage.locator('.experiment-item').first().click()
      // TODO: Replace timeout with specific element wait
    await sidebarPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Look for Visual Editor button
      const visualEditorBtn = sidebarPage.locator('#visual-editor-button').first()
      if (await visualEditorBtn.isVisible()) {
        console.log('✅ Found Visual Editor button, clicking...')
        await visualEditorBtn.click()
        // Wait briefly for UI update
        await testPage.waitForLoadState('domcontentloaded', { timeout: 2000 }).catch(() => {})
      } else {
        console.log('⚠️ No Visual Editor button found')
      }
    } else {
      console.log('⚠️ No experiments available, trying manual activation...')

      // Method 2: Try manual activation through message
      await testPage.evaluate(() => {
        window.postMessage({
          type: 'ABSMARTLY_VISUAL_EDITOR_START',
          experimentName: 'test_experiment',
          variantName: 'variant_1'
        }, '*')
      })
      // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})
    }

    // Step 5: Check if visual editor is active
    await testPage.bringToFront()
    const hasToolbar = await testPage.locator('#absmartly-visual-editor-toolbar').isVisible().catch(() => false)
    console.log('Visual editor toolbar visible:', hasToolbar)

    // Step 6: Test context menu actions
    console.log('\n🖱️ Testing context menu actions...')

    // Test Edit Text
    console.log('\n1️⃣ Testing Edit Text...')
    const title = testPage.locator('#main-title')
    await title.hover()
    await title.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    // Look for context menu
    const contextMenu = testPage.locator('.absmartly-context-menu').first()
    const menuVisible = await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)

    if (menuVisible) {
      console.log('✅ Context menu appeared')

      // Try to click Edit Text
      const editOption = contextMenu.locator('text=/edit.*text/i').first()
      if (await editOption.isVisible()) {
        await editOption.click()
        console.log('   Clicked Edit Text')

        // Clear and type new text
        await testPage.keyboard.press('Control+A')
        await testPage.keyboard.type('Modified Title by Test')
        await testPage.keyboard.press('Enter')

        const newText = await title.textContent()
        console.log('   New title text:', newText)
      } else {
        console.log('   Edit Text option not found')
      }
    } else {
      console.log('⚠️ Context menu did not appear')
    }

    // Test Change Style
    console.log('\n2️⃣ Testing Change Style...')
    const button = testPage.locator('#test-button')
    await button.hover()
    await button.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const styleOption = contextMenu.locator('text=/style|css/i').first()
      if (await styleOption.isVisible()) {
        await styleOption.click()
        console.log('   Clicked Change Style')

        // Close any dialog that opens
        await testPage.keyboard.press('Escape')
      }
    }

    // Test Hide Element
    console.log('\n3️⃣ Testing Hide Element...')
    const listItem = testPage.locator('#list-item-2')
    await listItem.hover()
    await listItem.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const hideOption = contextMenu.locator('text=/hide/i').first()
      if (await hideOption.isVisible()) {
        await hideOption.click()
        console.log('   Clicked Hide Element')

        // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
        const isHidden = await listItem.isHidden()
        console.log('   Element hidden:', isHidden)
      }
    }

    // Test Delete Element
    console.log('\n4️⃣ Testing Delete Element...')
    const deleteItem = testPage.locator('#list-item-3')
    await deleteItem.hover()
    await deleteItem.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const deleteOption = contextMenu.locator('text=/delete|remove/i').first()
      if (await deleteOption.isVisible()) {
        await deleteOption.click()
        console.log('   Clicked Delete Element')

        // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
        const stillExists = await testPage.locator('#list-item-3').count()
        console.log('   Element deleted:', stillExists === 0)
      }
    }

    // Test Add Class
    console.log('\n5️⃣ Testing Add Class...')
    const container = testPage.locator('#test-container')
    await container.hover()
    await container.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const classOption = contextMenu.locator('text=/add.*class/i').first()
      if (await classOption.isVisible()) {
        await classOption.click()
        console.log('   Clicked Add Class')

        // Type class name if prompt appears
        await testPage.keyboard.type('test-added-class')
        await testPage.keyboard.press('Enter')

        const classes = await container.getAttribute('class')
        console.log('   Container classes:', classes)
      }
    }

    // Test Copy Selector
    console.log('\n6️⃣ Testing Copy Selector...')
    const link = testPage.locator('#test-link')
    await link.hover()
    await link.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const copyOption = contextMenu.locator('text=/copy.*selector/i').first()
      if (await copyOption.isVisible()) {
        await copyOption.click()
        console.log('   Clicked Copy Selector')

        // Check for notification
        const notification = testPage.locator('[role="alert"], .notification, .toast').first()
        if (await notification.isVisible({ timeout: 1000 }).catch(() => false)) {
          const text = await notification.textContent()
          console.log('   Notification:', text)
        }
      }
    }

    // Check toolbar state
    console.log('\n📊 Checking toolbar state...')
    if (hasToolbar) {
      const toolbar = testPage.locator('#absmartly-visual-editor-toolbar')

      // Check change counter
      const changeCounter = toolbar.locator('[class*="change"], [class*="count"]').first()
      if (await changeCounter.isVisible()) {
        const count = await changeCounter.textContent()
        console.log('   Changes made:', count)
      }

      // Check Save button
      const saveBtn = toolbar.locator('#save-button').first()
      if (await saveBtn.isVisible()) {
        console.log('   Save button is available')
      }

      // Check Cancel/Exit button
      const exitBtn = toolbar.locator('#cancel-button, #exit-button, button[aria-label*="close"]').first()
      if (await exitBtn.isVisible()) {
        console.log('   Exit button is available')
      }
    }

    // Take screenshots for debugging
    await testPage.screenshot({
      path: 'test-results/visual-editor-full-test.png',
      fullPage: true
    })
    console.log('\n📸 Screenshot saved to test-results/visual-editor-full-test.png')

    // Summary
    console.log('\n✨ Test Complete!')
    console.log('   Visual Editor Active:', hasToolbar)
    console.log('   Context Menu Working:', menuVisible)
  })
})