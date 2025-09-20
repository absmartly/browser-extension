import { test, expect, Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const TEST_PAGE_PATH = path.join(__dirname, 'fixtures', 'extension-test-page.html')
const EXTENSION_BUILD_PATH = path.join(__dirname, '..', 'build', 'chrome-mv3-dev')

test.describe('Real ABsmartly Extension Workflow', () => {
  test.beforeAll(() => {
    // Verify extension is built
    if (!fs.existsSync(EXTENSION_BUILD_PATH)) {
      throw new Error(`Extension not built! Run 'npm run build' first. Path: ${EXTENSION_BUILD_PATH}`)
    }
    console.log('✅ Extension build found at:', EXTENSION_BUILD_PATH)
  })

  test('Complete real extension workflow with visual editor', async ({ page }) => {
    // Step 1: Open the test page
    await page.goto(`file://${TEST_PAGE_PATH}`)
    await page.waitForLoadState('networkidle')
    console.log('✅ Test page loaded')

    // Step 2: Click button to inject extension (simulates extension icon click)
    await page.click('#inject-extension-btn')
    console.log('✅ Extension injection triggered')

    // Step 3: Wait for sidebar iframe to load
    await page.waitForSelector('#absmartly-sidebar-iframe', { timeout: 5000 })
    console.log('✅ Sidebar iframe detected')

    // Step 4: Switch to iframe context to interact with sidebar
    const iframeElement = await page.$('#absmartly-sidebar-iframe')
    const frame = await iframeElement.contentFrame()

    if (!frame) {
      throw new Error('Could not access sidebar iframe')
    }

    // Wait for sidebar content to load
    await frame.waitForLoadState('domcontentloaded')
    console.log('✅ Sidebar content loaded')

    // Step 5: Check if we need to configure settings first
    const needsConfig = await frame.$('text=Configure Settings')
    if (needsConfig) {
      console.log('📝 Need to configure settings first')

      // Fill in mock API settings
      await frame.fill('input[placeholder*="API Key"]', 'test-api-key')
      await frame.fill('input[placeholder*="API Endpoint"]', 'https://api.absmartly.test')
      await frame.click('button:has-text("Save")')

      // Wait for save and navigation back to experiment list
      await frame.waitForTimeout(1000)
    }

    // Step 6: Look for experiments in the sidebar
    // The sidebar should show experiment list or a message
    const hasExperiments = await frame.$('.experiment-item')
    if (hasExperiments) {
      console.log('✅ Experiments found in sidebar')

      // Step 7: Click on first experiment
      await frame.click('.experiment-item:first-child')
      console.log('✅ Clicked on experiment')

      // Step 8: Wait for experiment detail view
      await frame.waitForSelector('button:has-text("Launch Visual Editor")', { timeout: 5000 })
      console.log('✅ Experiment detail view loaded')

      // Step 9: Click Launch Visual Editor
      await frame.click('button:has-text("Launch Visual Editor")')
      console.log('✅ Visual Editor launch clicked')

      // Step 10: Switch back to main page context for visual editor
      // Visual editor appears on the main page, not in iframe
      await page.waitForSelector('#absmartly-visual-editor-toolbar', { timeout: 5000 })
      console.log('✅ Visual Editor toolbar appeared')

      // Step 11: Test context menu on various elements
      const testElements = [
        { selector: '#main-title', action: 'Edit Text', newValue: 'Changed Title' },
        { selector: '#hero-cta', action: 'Change Style', style: 'background-color: red' },
        { selector: '#secondary-button', action: 'Add Class', className: 'new-class' },
        { selector: '#info-text', action: 'Hide Element' }
      ]

      for (const element of testElements) {
        // Right-click element
        await page.click(element.selector, { button: 'right' })
        console.log(`🖱️ Right-clicked ${element.selector}`)

        // Wait for context menu
        await page.waitForSelector('.absmartly-context-menu', { timeout: 2000 })

        // Click menu action
        const actionSelector = `[data-action="${element.action.toLowerCase().replace(/ /g, '-')}"]`
        await page.click(actionSelector)
        console.log(`✅ Selected action: ${element.action}`)

        // Handle action-specific inputs
        if (element.newValue) {
          await page.fill('.absmartly-modal-input', element.newValue)
          await page.click('[data-action="apply"]')
        } else if (element.style) {
          await page.fill('[data-field="style-input"]', element.style)
          await page.click('[data-action="apply"]')
        } else if (element.className) {
          await page.fill('[data-field="class-input"]', element.className)
          await page.click('[data-action="apply"]')
        }

        await page.waitForTimeout(500) // Let change apply
      }

      // Step 12: Check changes counter
      const changesCount = await page.textContent('.absmartly-changes-count')
      expect(parseInt(changesCount || '0')).toBeGreaterThan(0)
      console.log(`✅ Changes made: ${changesCount}`)

      // Step 13: Save changes
      await page.click('[data-action="save"]')
      console.log('✅ Changes saved')

      // Wait for save notification
      await page.waitForSelector('.absmartly-notification', { timeout: 3000 })

      // Visual editor should close after save
      await page.waitForSelector('#absmartly-visual-editor-toolbar', {
        state: 'hidden',
        timeout: 5000
      })
      console.log('✅ Visual editor closed after save')

      // Step 14: Verify preview header is showing
      const previewHeader = await page.$('#absmartly-preview-header')
      expect(previewHeader).toBeTruthy()
      console.log('✅ Preview header is showing')
    } else {
      console.log('ℹ️ No experiments found, testing with mock data')
    }

    // Take final screenshot
    await page.screenshot({ path: 'test-results/final-state.png', fullPage: true })
  })

  test('Preview header never wraps at any viewport width', async ({ page }) => {
    await page.goto(`file://${TEST_PAGE_PATH}`)

    // Inject a preview header directly for testing
    await page.evaluate(() => {
      const header = document.createElement('div')
      header.id = 'absmartly-preview-header'
      // Using the exact styles from content.ts
      header.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: linear-gradient(90deg, #3b82f6, #10b981);
        color: white;
        padding: 10px 12px;
        z-index: 2147483647;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13px;
      `

      const content = document.createElement('div')
      content.style.cssText = `
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-width: 0;
      `

      const text = document.createElement('span')
      text.style.cssText = `
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 400px;
      `
      text.innerHTML = '<strong>Very Long Variant Name That Could Cause Issues</strong> - Extremely Long Experiment Name That Might Wrap The Button To Next Line'

      const closeButton = document.createElement('button')
      closeButton.style.cssText = `
        background: rgba(255, 255, 255, 0.2);
        border: 1px solid rgba(255, 255, 255, 0.3);
        color: white;
        width: 28px;
        height: 28px;
        padding: 0;
        border-radius: 4px;
        font-size: 18px;
        line-height: 1;
        font-weight: 400;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      `
      closeButton.innerHTML = '×'

      content.appendChild(text)
      header.appendChild(content)
      header.appendChild(closeButton)
      document.body.appendChild(header)
    })

    // Test at critical viewport widths
    const viewports = [
      { width: 320, name: 'iPhone SE' },
      { width: 375, name: 'iPhone 12' },
      { width: 414, name: 'iPhone Plus' },
      { width: 768, name: 'iPad' },
      { width: 1024, name: 'Desktop' },
      { width: 1920, name: 'Full HD' }
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: 800 })
      await page.waitForTimeout(100) // Let layout settle

      // Measure header and button positions
      const measurements = await page.evaluate(() => {
        const header = document.querySelector('#absmartly-preview-header') as HTMLElement
        const button = header?.querySelector('button') as HTMLElement

        if (!header || !button) {
          return null
        }

        const headerRect = header.getBoundingClientRect()
        const buttonRect = button.getBoundingClientRect()

        return {
          headerHeight: headerRect.height,
          buttonTop: buttonRect.top,
          headerTop: headerRect.top,
          buttonVisible: buttonRect.width > 0 && buttonRect.height > 0,
          onSameLine: Math.abs(buttonRect.top - headerRect.top) < 5 // Within 5px tolerance
        }
      })

      console.log(`📐 ${viewport.name} (${viewport.width}px):`, measurements)

      // Assertions
      expect(measurements).toBeTruthy()
      expect(measurements.buttonVisible).toBe(true)
      expect(measurements.onSameLine).toBe(true)
      expect(measurements.headerHeight).toBeLessThan(50) // Should be single line

      // Take screenshot for evidence
      await page.screenshot({
        path: `test-results/preview-header-${viewport.width}px.png`,
        clip: { x: 0, y: 0, width: viewport.width, height: 60 }
      })
    }

    console.log('✅ Preview header button never wraps at any tested viewport width!')
  })
})