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
  log('  ✓ Preview is disabled')

  await page.screenshot({ path: 'test-results/preview-toggle-before-enable.png', fullPage: true })

  await click(sidebar, '#preview-variant-1', 5000)
  await debugWait(2000)

  await page.screenshot({ path: 'test-results/preview-toggle-after-enable.png', fullPage: true })

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

  const changesApplied = enabledStates.modifiedCount > 0 && enabledStates.experimentMarkersCount > 0
  log(`  ${changesApplied ? '✓' : '✗'} DOM changes applied`)

  const toolbarVisibleAfterEnable = await page.evaluate(() => {
    const toolbar = document.getElementById('absmartly-preview-header')
    console.log('  [Page] Preview toolbar check:', toolbar !== null)
    return toolbar !== null
  })

  log(`  ${toolbarVisibleAfterEnable ? '✓' : '✗'} Preview toolbar appeared`)

  expect(enabledStates.modifiedCount).toBeGreaterThan(0)
  expect(enabledStates.experimentMarkersCount).toBeGreaterThan(0)
  expect(toolbarVisibleAfterEnable).toBe(true, 'Preview toolbar should appear when preview toggle is enabled')

  // Second click: DISABLE preview
  await click(sidebar, '#preview-variant-1', 5000)
  await debugWait(2000)

  await page.screenshot({ path: 'test-results/preview-toggle-after-disable.png', fullPage: true })

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

  const changesReverted = disabledStates.modifiedCount === 0 && disabledStates.experimentMarkersCount === 0
  log(`  ${changesReverted ? '✓' : '✗'} DOM changes reverted`)

  const toolbarVisibleAfterDisable = await page.evaluate(() => {
    const toolbar = document.getElementById('absmartly-preview-header')
    return toolbar !== null
  })

  log(`  ${!toolbarVisibleAfterDisable ? '✓' : '✗'} Preview toolbar disappeared`)

  expect(disabledStates.modifiedCount).toBe(0)
  expect(disabledStates.experimentMarkersCount).toBe(0)
  expect(toolbarVisibleAfterDisable).toBe(false, 'Preview toolbar should disappear when preview toggle is disabled')

  log('\n✅ Preview toggle test completed')
  await debugWait()
}
