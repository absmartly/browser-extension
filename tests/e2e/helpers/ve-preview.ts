import { type Page, type FrameLocator, expect } from '@playwright/test'
import { debugWait, click, log } from '../utils/test-helpers'

/**
 * Tests the preview mode toggle functionality
 * Verifies that clicking the preview toggle:
 * 1. First click: Enables preview - applies DOM changes, adds markers, and shows toolbar
 * 2. Second click: Disables preview - reverts changes, removes markers, and hides toolbar
 *
 * @param sidebar - The sidebar frame locator
 * @param page - The test page where preview changes are applied
 */
export async function testPreviewToggle(sidebar: FrameLocator, page: Page): Promise<void> {
  log('\n👁️ Testing preview mode toggle')

  // NOTE: Preview is now disabled after clicking Exit Preview in step 7
  // So the first click will ENABLE preview, and second click will DISABLE it

  // Listen for console messages from the page to debug (only in DEBUG mode)
  if (process.env.DEBUG === '1' || process.env.PWDEBUG === '1') {
    page.on('console', msg => {
      if (msg.text().includes('[ABsmartly Page]') || msg.text().includes('PREVIEW') || msg.text().includes('[VisualEditor]') || msg.text().includes('Visual Editor Content Script')) {
        log(`  [Page Console] ${msg.text()}`)
      }
    })
  }

  // Verify preview is currently disabled (from Exit Preview button in step 7)
  log('  Verifying preview is currently disabled...')
  const initialPreviewState = await page.evaluate(() => {
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')
    return {
      modifiedElementsCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length
    }
  })
  expect(initialPreviewState.modifiedElementsCount).toBe(0)
  expect(initialPreviewState.experimentMarkersCount).toBe(0)
  log('  ✓ Preview is disabled (no markers present)')

  // Take screenshot before enabling preview
  await page.screenshot({ path: 'test-results/preview-toggle-before-enable.png', fullPage: true })
  log('  📸 Screenshot: preview-toggle-before-enable.png')

  // Capture current state while preview is disabled
  log('  Capturing element states with preview disabled...')
  const previewDisabledStates = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')

    return {
      paragraphText: paragraph?.textContent,
      paragraphVisible: paragraph ? window.getComputedStyle(paragraph).display !== 'none' : false,
      button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
      button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
      testContainerHTML: testContainer?.innerHTML?.trim(),
      toolbarExists: document.getElementById('absmartly-preview-header') !== null
    }
  })
  log('  States captured:', previewDisabledStates)
  log('  Toolbar visible before toggle:', previewDisabledStates.toolbarExists)

  // First click: ENABLE preview (apply changes and add markers)
  log('\n  ▶ Click 1: ENABLING preview mode via sidebar toggle...')

  // Click the button directly using the click helper for better React event handling
  log('  Attempting to click preview toggle button...')
  await click(sidebar, '#preview-variant-1', 5000)
  log('  ✓ Clicked preview toggle button')
  await debugWait(2000) // Wait for changes to apply and toolbar to appear

  // Take screenshot after enabling preview
  await page.screenshot({ path: 'test-results/preview-toggle-after-enable.png', fullPage: true })
  log('  📸 Screenshot: preview-toggle-after-enable.png')

  // FIRST: Check if DOM changes were actually applied (markers and modified elements)
  log('  Checking if DOM changes were applied...')
  const enabledStates = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')

    return {
      paragraphText: paragraph?.textContent,
      button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
      button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
      testContainerHTML: testContainer?.innerHTML?.trim(),
      modifiedCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length
    }
  })

  log('  States after enabling:', enabledStates)
  log(`  Modified elements: ${enabledStates.modifiedCount}`)
  log(`  Experiment markers: ${enabledStates.experimentMarkersCount}`)

  const changesApplied = enabledStates.modifiedCount > 0 && enabledStates.experimentMarkersCount > 0
  if (changesApplied) {
    log('  ✅ DOM changes WERE applied successfully')
  } else {
    log('  ❌ DOM changes were NOT applied')
  }

  // SECOND: Check if toolbar appeared
  log('  Checking if Preview toolbar appeared...')
  const toolbarVisibleAfterEnable = await page.evaluate(() => {
    const toolbar = document.getElementById('absmartly-preview-header')
    console.log('  [Page] Preview toolbar check:', toolbar !== null)
    return toolbar !== null
  })

  if (!toolbarVisibleAfterEnable) {
    log('  ❌ Preview toolbar did NOT appear after clicking toggle')
    const toolbarCheckState = await page.evaluate(() => {
      const toolbar = document.getElementById('absmartly-preview-header')
      const banner = document.getElementById('absmartly-visual-editor-banner-host')
      const allDivs = Array.from(document.querySelectorAll('div[id*="absmartly"]')).map(d => d.id)
      return {
        toolbarExists: toolbar !== null,
        bannerExists: banner !== null,
        absmartlyElements: allDivs
      }
    })
    log('  Debug state:', JSON.stringify(toolbarCheckState, null, 2))
  } else {
    log('  ✅ Preview toolbar appeared')
  }

  // Verify that changes were applied (this is the key functionality)
  expect(enabledStates.modifiedCount).toBeGreaterThan(0)
  expect(enabledStates.experimentMarkersCount).toBeGreaterThan(0)
  log('  ✓ Preview mode toggle applied DOM changes successfully')

  // Verify that toolbar appeared (this is a UI requirement)
  expect(toolbarVisibleAfterEnable).toBe(true, 'Preview toolbar should appear when preview toggle is enabled')

  // Second click: DISABLE preview
  log('\n  ▶ Click 2: DISABLING preview mode via sidebar toggle...')

  await click(sidebar, '#preview-variant-1', 5000)
  log('  ✓ Clicked preview toggle button (disable)')
  await debugWait(2000) // Wait for changes to revert and toolbar to disappear

  // Take screenshot after disabling preview
  await page.screenshot({ path: 'test-results/preview-toggle-after-disable.png', fullPage: true })
  log('  📸 Screenshot: preview-toggle-after-disable.png')

  // FIRST: Check if DOM changes were reverted (markers and modified elements removed)
  log('  Checking if DOM changes were reverted...')
  const disabledStates = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')

    return {
      paragraphText: paragraph?.textContent,
      button1Visible: button1 ? window.getComputedStyle(button1).display !== 'none' : false,
      button2Visible: button2 ? window.getComputedStyle(button2).display !== 'none' : false,
      testContainerHTML: testContainer?.innerHTML?.trim(),
      modifiedCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length
    }
  })

  log('  States after disabling:', disabledStates)
  log(`  Modified elements: ${disabledStates.modifiedCount}`)
  log(`  Experiment markers: ${disabledStates.experimentMarkersCount}`)

  const changesReverted = disabledStates.modifiedCount === 0 && disabledStates.experimentMarkersCount === 0
  if (changesReverted) {
    log('  ✅ DOM changes WERE reverted successfully')
  } else {
    log('  ❌ DOM changes were NOT reverted')
  }

  // SECOND: Check if toolbar disappeared
  log('  Checking if Preview toolbar disappeared...')
  const toolbarVisibleAfterDisable = await page.evaluate(() => {
    const toolbar = document.getElementById('absmartly-preview-header')
    return toolbar !== null
  })

  if (!toolbarVisibleAfterDisable) {
    log('  ✅ Preview toolbar disappeared')
  } else {
    log('  ❌ Preview toolbar is still visible')
  }

  // Verify that changes were reverted (this is the key functionality)
  expect(disabledStates.modifiedCount).toBe(0)
  expect(disabledStates.experimentMarkersCount).toBe(0)
  log('  ✓ Preview mode toggle reverted DOM changes successfully')

  // Verify that toolbar disappeared (this is a UI requirement)
  expect(toolbarVisibleAfterDisable).toBe(false, 'Preview toolbar should disappear when preview toggle is disabled')

  log('\n✅ Preview toggle functionality test COMPLETED!')
  log('  • Click 1: Enable preview - toolbar appeared ✓')
  log('  • Click 1: Enable preview - markers and changes applied ✓')
  log('  • Click 2: Disable preview - toolbar disappeared ✓')
  log('  • Click 2: Disable preview - markers removed and changes reverted ✓')
  await debugWait()
}
