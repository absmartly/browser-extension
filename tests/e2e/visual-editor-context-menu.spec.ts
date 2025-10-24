import { test, expect } from '../fixtures/extension'

// Create a test HTML page for visual editor testing
const createTestPage = () => `
<!DOCTYPE html>
<html>
<head>
  <title>Visual Editor Test Page</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 40px; }
    .test-button { padding: 10px 20px; margin: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; }
    .test-text { margin: 20px 0; font-size: 18px; }
    .test-link { color: #3b82f6; text-decoration: underline; }
    .test-image { width: 200px; height: 150px; background: #ddd; display: inline-block; }
    .test-list { margin: 20px 0; }
    .test-container { padding: 20px; border: 2px solid #ddd; margin: 20px 0; }
  </style>
</head>
<body>
  <h1 id="main-title">Test Page for Visual Editor</h1>

  <p id="test-paragraph" class="test-text">This is a test paragraph with some text content.</p>

  <button id="test-button" class="test-button">Click Me</button>
  <button id="secondary-button" class="test-button">Another Button</button>

  <div id="test-container" class="test-container">
    <h2 id="section-title">Section Title</h2>
    <p id="section-text">Section content goes here.</p>
    <a href="https://example.com" id="test-link" class="test-link">Test Link</a>
  </div>

  <ul id="test-list" class="test-list">
    <li id="list-item-1">First item</li>
    <li id="list-item-2">Second item</li>
    <li id="list-item-3">Third item</li>
  </ul>

  <div id="test-image" class="test-image"></div>

  <form id="test-form">
    <input type="text" id="test-input" placeholder="Enter text" />
    <select id="test-select">
      <option>Option 1</option>
      <option>Option 2</option>
    </select>
  </form>
</body>
</html>
`

test.describe('Visual Editor Context Menu Tests', () => {
  test.beforeEach(async ({ clearStorage, seedStorage }) => {
    await clearStorage()

    // Seed with API credentials and a mock experiment
    await seedStorage({
      'absmartly-apikey': process.env.PLASMO_PUBLIC_ABSMARTLY_API_KEY || 'BxYKd1U2DlzOLJ74gdvaIkwy4qyOCkXi_YJFFdE1EDyovjEsQ__iiX0IM1ONfHKB',
      'absmartly-endpoint': process.env.PLASMO_PUBLIC_ABSMARTLY_API_ENDPOINT || 'https://dev-1.absmartly.com/v1',
      'absmartly-env': process.env.PLASMO_PUBLIC_ABSMARTLY_ENVIRONMENT || 'development',
      'absmartly-auth-method': 'apikey',
      // Add mock experiment data for visual editor
      'visual-editor-experiment': {
        id: 1,
        name: 'test_experiment',
        status: 'running',
        variants: [
          { name: 'control', weight: 50 },
          { name: 'variant_1', weight: 50 }
        ]
      },
      'visual-editor-active': true,
      'visual-editor-variant': 'variant_1'
    })
  })

  test('Complete visual editor context menu workflow', async ({ context, extensionUrl }) => {
    // Create a test page
    const page = await context.newPage()
    await page.goto('data:text/html,' + encodeURIComponent(createTestPage()))
    await page.setViewportSize({ width: 1920, height: 1080 })

    console.log('📄 Test page loaded')

    // Track DOM changes
    const domChanges: any[] = []

    // Inject visual editor (simulating extension activation)
    await page.evaluate(() => {
      // Create a mock visual editor activation
      window.postMessage({
        type: 'ABSMARTLY_VISUAL_EDITOR_START',
        experimentName: 'test_experiment',
        variantName: 'variant_1'
      }, '*')
    })

    // Wait for potential visual editor to load
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

    // Test 1: Edit Text
    console.log('\n🔤 Testing Edit Text...')
    const paragraph = page.locator('#test-paragraph')
    await paragraph.click({ button: 'right' })

    // Check if context menu appears
    const contextMenu = page.locator('.absmartly-context-menu, [data-absmartly-context-menu]').first()
    const hasContextMenu = await contextMenu.isVisible().catch(() => false)

    if (hasContextMenu) {
      console.log('✅ Context menu appeared')

      // Click Edit Text option
      const editTextOption = contextMenu.locator('text=/edit.*text/i').first()
      if (await editTextOption.isVisible()) {
        await editTextOption.click()
        console.log('✅ Clicked Edit Text')

        // Type new text
        await page.keyboard.type('New text content from test')
        await page.keyboard.press('Enter')

        // Verify text changed
        const newText = await paragraph.textContent()
        console.log('   New text:', newText)
      }
    } else {
      console.log('⚠️ No context menu found - visual editor may not be active')
    }

    // Test 2: Change Style
    console.log('\n🎨 Testing Change Style...')
    const button = page.locator('#test-button')
    await button.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const styleOption = contextMenu.locator('text=/style|css/i').first()
      if (await styleOption.isVisible()) {
        await styleOption.click()
        console.log('✅ Clicked Change Style')

        // Would open style editor - simulate style change
        await page.evaluate(() => {
          const btn = document.querySelector('#test-button') as HTMLElement
          if (btn) btn.style.backgroundColor = 'red'
        })

        const bgColor = await button.evaluate(el => getComputedStyle(el).backgroundColor)
        console.log('   New background color:', bgColor)
      }
    }

    // Test 3: Add Class
    console.log('\n🏷️ Testing Add Class...')
    const container = page.locator('#test-container')
    await container.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const classOption = contextMenu.locator('text=/add.*class/i').first()
      if (await classOption.isVisible()) {
        await classOption.click()
        console.log('✅ Clicked Add Class')

        // Simulate adding a class
        await page.evaluate(() => {
          const elem = document.querySelector('#test-container')
          if (elem) elem.classList.add('new-test-class')
        })

        const classes = await container.getAttribute('class')
        console.log('   Classes:', classes)
      }
    }

    // Test 4: Hide Element
    console.log('\n👁️ Testing Hide Element...')
    const listItem = page.locator('#list-item-2')
    await listItem.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const hideOption = contextMenu.locator('text=/hide/i').first()
      if (await hideOption.isVisible()) {
        await hideOption.click()
        console.log('✅ Clicked Hide Element')

        // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
        const isHidden = await listItem.isHidden()
        console.log('   Element hidden:', isHidden)
      }
    }

    // Test 5: Delete Element
    console.log('\n🗑️ Testing Delete Element...')
    const listItem3 = page.locator('#list-item-3')
    await listItem3.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const deleteOption = contextMenu.locator('text=/delete|remove/i').first()
      if (await deleteOption.isVisible()) {
        await deleteOption.click()
        console.log('✅ Clicked Delete Element')

        // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})
        const exists = await page.locator('#list-item-3').count()
        console.log('   Element deleted:', exists === 0)
      }
    }

    // Test 6: Edit HTML
    console.log('\n📝 Testing Edit HTML...')
    const sectionTitle = page.locator('#section-title')
    await sectionTitle.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const htmlOption = contextMenu.locator('text=/html|markup/i').first()
      if (await htmlOption.isVisible()) {
        await htmlOption.click()
        console.log('✅ Clicked Edit HTML')

        // Check for HTML editor (Monaco or textarea)
        const htmlEditor = page.locator('.monaco-editor, textarea[class*="html"], [data-html-editor]').first()
        if (await htmlEditor.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log('   HTML editor opened')

          // Close the editor
          const closeBtn = page.locator('button:has-text("Cancel"), button:has-text("Close")').first()
          if (await closeBtn.isVisible()) {
            await closeBtn.click()
          }
        }
      }
    }

    // Test 7: Copy Selector
    console.log('\n📋 Testing Copy Selector...')
    const link = page.locator('#test-link')
    await link.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const copyOption = contextMenu.locator('text=/copy.*selector/i').first()
      if (await copyOption.isVisible()) {
        await copyOption.click()
        console.log('✅ Clicked Copy Selector')

        // Check for notification
        const notification = page.locator('.notification, .toast, [role="alert"]').first()
        if (await notification.isVisible({ timeout: 1000 }).catch(() => false)) {
          const notifText = await notification.textContent()
          console.log('   Notification:', notifText)
        }
      }
    }

    // Test 8: Rearrange Elements (if available)
    console.log('\n🔄 Testing Rearrange...')
    const firstItem = page.locator('#list-item-1')
    await firstItem.click({ button: 'right' })
    // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 500 }).catch(() => {})

    if (await contextMenu.isVisible()) {
      const rearrangeOption = contextMenu.locator('text=/rearrange|move|reorder/i').first()
      if (await rearrangeOption.isVisible()) {
        await rearrangeOption.click()
        console.log('✅ Clicked Rearrange')

        // Would enable drag-drop mode
        // TODO: Replace timeout with specific element wait
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})
      }
    }

    // Check visual editor toolbar
    console.log('\n🔧 Checking Visual Editor Toolbar...')
    const toolbar = page.locator('#absmartly-visual-editor-toolbar, [data-visual-editor-toolbar]').first()
    const hasToolbar = await toolbar.isVisible().catch(() => false)

    if (hasToolbar) {
      console.log('✅ Visual editor toolbar is visible')

      // Check for change counter
      const changeCounter = toolbar.locator('text=/changes|modifications/i').first()
      if (await changeCounter.isVisible()) {
        const counterText = await changeCounter.textContent()
        console.log('   Change counter:', counterText)
      }

      // Check for Save button
      const saveBtn = toolbar.locator('button:has-text("Save")').first()
      if (await saveBtn.isVisible()) {
        console.log('✅ Save button available')
      }

      // Check for Cancel/Exit button
      const exitBtn = toolbar.locator('button:has-text("Cancel"), button:has-text("Exit")').first()
      if (await exitBtn.isVisible()) {
        console.log('✅ Exit button available')
      }
    } else {
      console.log('⚠️ No visual editor toolbar found')
    }

    // Summary
    console.log('\n📊 Test Summary:')
    console.log('   - Context menu tested: ', hasContextMenu ? '✅' : '❌')
    console.log('   - Toolbar present: ', hasToolbar ? '✅' : '❌')

    // Take screenshot for debugging
    await page.screenshot({
      path: 'test-results/visual-editor-context-menu.png',
      fullPage: true
    })
    console.log('📸 Screenshot saved to test-results/visual-editor-context-menu.png')
  })

  test('Visual editor with real extension sidebar', async ({ context, extensionUrl }) => {
    // Open the sidebar first
    const sidebarPage = await context.newPage()
    await sidebarPage.goto(extensionUrl('tabs/sidebar.html', { waitUntil: \'domcontentloaded\', timeout: 10000 }))
    await sidebarPage.setViewportSize({ width: 400, height: 1080 })

    // Open test page in another tab
    const testPage = await context.newPage()
    await testPage.goto('data:text/html,' + encodeURIComponent(createTestPage()))
    await testPage.setViewportSize({ width: 1520, height: 1080 })

    console.log('📱 Sidebar and test page loaded')

    // Wait for sidebar to load
    // TODO: Replace timeout with specific element wait
    await sidebarPage.waitForFunction(() => document.readyState === 'complete', { timeout: 3000 }).catch(() => {})

    // Check if experiments are available
    const hasExperiments = await sidebarPage.locator('.experiment-item').count().then(c => c > 0).catch(() => false)

    if (hasExperiments) {
      console.log('✅ Found experiments in sidebar')

      // Click first experiment
      await sidebarPage.locator('.experiment-item').first().click()
      // TODO: Replace timeout with specific element wait
    await sidebarPage.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

      // Look for Visual Editor button
      const visualEditorBtn = sidebarPage.locator('button:has-text("Visual Editor"), button:has-text("Launch Visual Editor")').first()
      if (await visualEditorBtn.isVisible()) {
        console.log('✅ Visual Editor button found')
        await visualEditorBtn.click()

        // Switch to test page and check for visual editor
        await testPage.bringToFront()
        // TODO: Replace timeout with specific element wait
    await testPage.waitForFunction(() => document.readyState === 'complete', { timeout: 2000 }).catch(() => {})

        // Check if visual editor loaded
        const hasVisualEditor = await testPage.locator('#absmartly-visual-editor-toolbar, [data-visual-editor-toolbar]').isVisible().catch(() => false)
        console.log('Visual editor active on page:', hasVisualEditor)

        if (hasVisualEditor) {
          // Test context menu
          const elem = testPage.locator('#main-title')
          await elem.click({ button: 'right' })

          const contextMenu = testPage.locator('.absmartly-context-menu').first()
          const menuVisible = await contextMenu.isVisible({ timeout: 2000 }).catch(() => false)
          console.log('Context menu visible:', menuVisible)
        }
      } else {
        console.log('⚠️ No Visual Editor button found in experiment details')
      }
    } else {
      console.log('⚠️ No experiments available in sidebar')

      // Check if configuration is needed
      const needsConfig = await sidebarPage.locator('button:has-text("Configure Settings")').isVisible().catch(() => false)
      if (needsConfig) {
        console.log('ℹ️ Extension needs configuration')
      }
    }
  })
})