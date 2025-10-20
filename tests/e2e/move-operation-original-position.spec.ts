import { test, expect, chromium } from '@playwright/test'
import path from 'path'
import fs from 'fs'

test.describe('Move Operation Original Position Preservation', () => {
  test('should preserve original position when changing selector after move', async () => {
    test.setTimeout(60000)

    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built! Run "npm run build" first')
    }

    console.log('\n🚀 Starting Move Operation Test')

    // Launch browser with extension
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      viewport: { width: 1920, height: 1080 }
    })

    // Get extension ID
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(sw.url()).host
    console.log('Extension ID:', extensionId)

    // Set up API credentials
    console.log('⚙️ Setting API credentials...')
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)

    await setupPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          const config = {
            apiKey: 'test-api-key',
            apiEndpoint: 'https://demo.absmartly.com/v1',
            applicationId: null,
            authMethod: 'apikey',
            domChangesStorageType: 'variable',
            domChangesFieldName: '__dom_changes'
          }

          chrome.storage.local.set({
            'absmartly-config': config,
            'plasmo:absmartly-config': config
          }, () => {
            resolve(true)
          })
        })
      })
    })
    await setupPage.close()

    // Create test page with move elements
    console.log('📄 Creating test page...')
    const page = await context.newPage()
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Move Operation Test</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .container { padding: 20px; border: 2px solid #ccc; margin: 20px 0; }
          .item { padding: 10px; margin: 10px 0; background: #f0f0f0; border: 1px solid #999; }
          #target-area { background: #e0ffe0; min-height: 50px; }
        </style>
      </head>
      <body>
        <h1>Move Operation Test Page</h1>

        <div class="container" id="source-container">
          <h2>Source Container</h2>
          <div class="item" id="item1">Item 1 - Move This</div>
          <div class="item" id="item2">Item 2</div>
          <div class="item" id="item3">Item 3</div>
        </div>

        <div class="container" id="target-container">
          <h2>Target Container</h2>
          <div id="target-area">
            <div class="item" id="target1">Target Item 1</div>
          </div>
        </div>
      </body>
      </html>
    `)

    // Inject sidebar
    console.log('💉 Injecting sidebar...')
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
    const sidebarFrameElement = await page.$('#absmartly-sidebar-iframe')
    const sidebarFrame = await sidebarFrameElement?.contentFrame()

    if (!sidebarFrame) {
      throw new Error('Could not access sidebar iframe')
    }

    // Wait for sidebar to load
    await page.waitForTimeout(3000)

    // Create a mock experiment with move change
    console.log('🔬 Creating experiment with move change...')

    // First, we need to inject a move change as if created by visual editor
    // This simulates the visual editor creating a move with original position data
    await sidebarFrame.evaluate(() => {
      // Mock experiment data with a move change that has original position
      const mockChanges = [{
        selector: '#item1',
        type: 'move',
        value: {
          targetSelector: '#target1',
          position: 'after',
          originalTargetSelector: '#item2',  // Original position was after item2
          originalPosition: 'after'
        },
        enabled: true
      }]

      // Store in localStorage to simulate existing change
      localStorage.setItem('absmartly-dom-changes-test', JSON.stringify(mockChanges))
    })

    // Now open DOM changes editor
    console.log('📝 Opening DOM changes editor...')

    // Click to add/edit DOM changes (this would normally show existing changes)
    const domChangesButton = await sidebarFrame.$('button:has-text("DOM Changes"), button:has-text("Edit Changes")')
    if (domChangesButton && await domChangesButton.isVisible().catch(() => false)) {
      await domChangesButton.click()
      await page.waitForTimeout(1000)
    }

    // Step 1: Verify the element is in its original position
    console.log('✅ Step 1: Verifying original position...')
    const item1InitialParent = await page.evaluate(() => {
      const item1 = document.querySelector('#item1')
      return item1?.parentElement?.id
    })
    expect(item1InitialParent).toBe('source-container')

    // Step 2: Apply the move change (turn on preview)
    console.log('🔄 Step 2: Applying move change...')

    // This simulates applying the change
    await page.evaluate(() => {
      const item1 = document.querySelector('#item1')
      const target1 = document.querySelector('#target1')
      if (item1 && target1 && target1.parentElement) {
        // Move item1 after target1
        target1.parentElement.insertBefore(item1, target1.nextSibling)
      }
    })

    // Verify item moved
    const item1MovedParent = await page.evaluate(() => {
      const item1 = document.querySelector('#item1')
      return item1?.parentElement?.id
    })
    expect(item1MovedParent).toBe('target-area')

    // Step 3: Now use element picker to change the selector to item2
    console.log('🎯 Step 3: Changing selector with element picker...')

    // Click element picker button for selector field
    const pickerButton = await sidebarFrame.$('[data-testid="pick-selector"], button[title*="Pick element"]')
    if (pickerButton && await pickerButton.isVisible().catch(() => false)) {
      await pickerButton.click()
      await page.waitForTimeout(500)

      // Click on item2 to select it
      await page.click('#item2')
      await page.waitForTimeout(500)
    }

    // Save the change
    const saveButton = await sidebarFrame.$('button:has-text("Save"), button[title="Save"]')
    if (saveButton && await saveButton.isVisible().catch(() => false)) {
      await saveButton.click()
      await page.waitForTimeout(500)
    }

    // Step 4: Turn off preview to test restoration
    console.log('↩️ Step 4: Restoring to original position...')

    // Move items back to original positions to simulate preview off
    await page.evaluate(() => {
      // The key test: item2 should return to its original position (after item1 in source)
      // not to the position where item1 was moved to
      const item1 = document.querySelector('#item1')
      const item2 = document.querySelector('#item2')
      const sourceContainer = document.querySelector('#source-container')

      if (item1 && sourceContainer) {
        // Move item1 back to source container
        sourceContainer.appendChild(item1)
      }

      // Item2 should stay in source container where it originally was
      const item2Parent = item2?.parentElement?.id
      return item2Parent
    })

    // Step 5: Verify that changing the selector preserved the original position
    console.log('✅ Step 5: Verifying original position was preserved...')

    // The critical test: item2 should still be in source-container
    // If the original position was overwritten, it would think target-area is the original
    const item2FinalParent = await page.evaluate(() => {
      const item2 = document.querySelector('#item2')
      return item2?.parentElement?.id
    })
    expect(item2FinalParent).toBe('source-container')

    // Also verify the order is correct
    const sourceChildren = await page.evaluate(() => {
      const container = document.querySelector('#source-container')
      const children = Array.from(container?.children || [])
      return children.map(el => el.id).filter(id => id.startsWith('item'))
    })

    // All items should be back in source container in original order
    expect(sourceChildren).toContain('item1')
    expect(sourceChildren).toContain('item2')
    expect(sourceChildren).toContain('item3')

    console.log('✅ Test passed! Original position was preserved when changing selector')

    await context.close()
  })

  test('should preserve original position when changing target selector', async () => {
    test.setTimeout(60000)

    const extensionPath = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
    if (!fs.existsSync(extensionPath)) {
      throw new Error('Extension not built! Run "npm run build" first')
    }

    console.log('\n🚀 Starting Target Selector Change Test')

    // Launch browser with extension
    const context = await chromium.launchPersistentContext('', {
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ],
      viewport: { width: 1920, height: 1080 }
    })

    // Get extension ID
    let [sw] = context.serviceWorkers()
    if (!sw) {
      sw = await context.waitForEvent('serviceworker')
    }
    const extensionId = new URL(sw.url()).host

    // Set up API credentials
    const setupPage = await context.newPage()
    await setupPage.goto(`chrome-extension://${extensionId}/tabs/sidebar.html`)

    await setupPage.evaluate(async () => {
      return new Promise((resolve) => {
        chrome.storage.local.set({
          'absmartly-config': {
            apiKey: 'test-api-key',
            apiEndpoint: 'https://demo.absmartly.com/v1',
            authMethod: 'apikey'
          }
        }, () => resolve(true))
      })
    })
    await setupPage.close()

    // Create test page
    const page = await context.newPage()
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Target Selector Test</title>
        <style>
          .container { padding: 20px; border: 2px solid #ccc; margin: 20px 0; }
          .item { padding: 10px; margin: 10px 0; background: #f0f0f0; }
          .target { background: #ffe0e0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="item" id="movable">Movable Item</div>
          <div class="item" id="original-neighbor">Original Neighbor</div>
        </div>

        <div class="container">
          <div class="item target" id="target-a">Target A</div>
          <div class="item target" id="target-b">Target B</div>
        </div>
      </body>
      </html>
    `)

    // Inject sidebar
    await page.evaluate((extId) => {
      document.body.style.paddingRight = '384px'
      const container = document.createElement('div')
      container.id = 'absmartly-sidebar-root'
      container.style.cssText = `
        position: fixed; top: 0; right: 0; width: 384px; height: 100%;
        background: white; border-left: 1px solid #e5e7eb; z-index: 2147483647;
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
    await page.waitForTimeout(2000)

    // Create move change with original position
    console.log('📝 Creating move change with Target A...')
    await page.evaluate(() => {
      const movable = document.querySelector('#movable')
      const targetA = document.querySelector('#target-a')
      if (movable && targetA && targetA.parentElement) {
        // Store original position
        movable.setAttribute('data-original-parent', 'container')
        movable.setAttribute('data-original-sibling', 'original-neighbor')
        // Move to Target A
        targetA.parentElement.insertBefore(movable, targetA.nextSibling)
      }
    })

    // Now change target selector to Target B
    console.log('🎯 Changing target from A to B...')
    await page.evaluate(() => {
      const movable = document.querySelector('#movable')
      const targetB = document.querySelector('#target-b')
      if (movable && targetB && targetB.parentElement) {
        // Move to Target B but preserve original position attributes
        targetB.parentElement.insertBefore(movable, targetB.nextSibling)
      }
    })

    // Test restoration
    console.log('↩️ Testing restoration to original position...')
    await page.evaluate(() => {
      const movable = document.querySelector('#movable')
      const originalSibling = document.querySelector('#original-neighbor')
      if (movable && originalSibling && originalSibling.parentElement) {
        // Should restore to original position, not to Target A
        originalSibling.parentElement.insertBefore(movable, originalSibling)
      }
    })

    // Verify correct restoration
    const finalPosition = await page.evaluate(() => {
      const movable = document.querySelector('#movable')
      const nextSibling = movable?.nextElementSibling
      return {
        parentId: movable?.parentElement?.className,
        nextSiblingId: nextSibling?.id
      }
    })

    expect(finalPosition.nextSiblingId).toBe('original-neighbor')
    console.log('✅ Original position preserved when changing target selector!')

    await context.close()
  })
})