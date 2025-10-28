import { type Page, type FrameLocator, expect } from '@playwright/test'
import { log, debugWait } from '../utils/test-helpers'

/**
 * Verification helpers for Visual Editor tests
 */

/**
 * Verify changes appear in sidebar after VE closes
 */
export async function verifySidebarHasChanges(sidebar: FrameLocator, minExpectedChanges: number = 4): Promise<void> {
  log('\n📝 Verifying changes in sidebar', 'info')

  // Wait for DOM change cards to appear
  try {
    await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 10000 })
  } catch (err) {
    log('DOM change cards did not appear within 10 seconds', 'error')
    throw err
  }

  const changeCards = await sidebar.locator('.dom-change-card').count()
  log(`Found ${changeCards} DOM change cards in sidebar`, 'info')

  expect(changeCards).toBeGreaterThanOrEqual(minExpectedChanges)

  // Get the text content of all cards to verify change types
  const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
  const allText = cardsText.join(' ')

  log('DOM changes verified in sidebar', 'info')
  await debugWait()
}

/**
 * Verify DOM changes structure and content
 */
export async function verifyDOMChangesStructure(
  page: Page,
  expectedChanges: {
    paragraphText?: string
    button1Hidden?: boolean
    button2Hidden?: boolean
    containerHTML?: string
  }
): Promise<void> {
  log('Verifying DOM changes structure', 'debug')

  const appliedChanges = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')

    return {
      paragraphText: paragraph?.textContent?.trim(),
      button1Display: button1 ? window.getComputedStyle(button1).display : null,
      button2Display: button2 ? window.getComputedStyle(button2).display : null,
      testContainerHTML: testContainer?.innerHTML?.trim()
    }
  })

  if (expectedChanges.paragraphText) {
    expect(appliedChanges.paragraphText).toBe(expectedChanges.paragraphText)
  }

  if (expectedChanges.button1Hidden) {
    expect(appliedChanges.button1Display).toBe('none')
  }

  if (expectedChanges.button2Hidden) {
    expect(appliedChanges.button2Display).toBe('none')
  }

  if (expectedChanges.containerHTML) {
    expect(appliedChanges.testContainerHTML).toContain(expectedChanges.containerHTML)
  }

  log('DOM changes structure verified', 'debug')
}

/**
 * Verify markers are present on changed elements
 */
export async function verifyMarkersOnPage(
  page: Page,
  expectedMarkerCount: number = 1
): Promise<{ markedElementsCount: number; originalValuesCount: number }> {
  log('Verifying markers on page', 'debug')

  const markerState = await page.evaluate(() => {
    const markedElements = document.querySelectorAll('[data-absmartly-experiment]')
    const elementsWithOriginals = document.querySelectorAll('[data-absmartly-original]')

    return {
      markedElementsCount: markedElements.length,
      elementsWithOriginalsCount: elementsWithOriginals.length
    }
  })

  if (expectedMarkerCount > 0) {
    expect(markerState.markedElementsCount).toBeGreaterThanOrEqual(expectedMarkerCount)
    expect(markerState.elementsWithOriginalsCount).toBeGreaterThan(0)
  }

  log(`Markers verified: ${markerState.markedElementsCount} marked, ${markerState.elementsWithOriginalsCount} with originals`, 'debug')

  return markerState
}

/**
 * Verify preview toggle functionality
 */
export async function verifyPreviewToggle(
  sidebar: FrameLocator,
  page: Page,
  shouldBeEnabled: boolean = true
): Promise<{ changesApplied: boolean; toolbarVisible: boolean }> {
  log(`Verifying preview toggle is ${shouldBeEnabled ? 'enabled' : 'disabled'}`, 'debug')

  // Check if DOM changes were applied
  const enabledStates = await page.evaluate(() => {
    const modifiedElements = document.querySelectorAll('[data-absmartly-modified]')
    const experimentMarkers = document.querySelectorAll('[data-absmartly-experiment]')

    return {
      modifiedCount: modifiedElements.length,
      experimentMarkersCount: experimentMarkers.length
    }
  })

  const changesApplied = enabledStates.modifiedCount > 0 && enabledStates.experimentMarkersCount > 0

  // Check if toolbar appeared
  const toolbarVisible = await page.evaluate(() => {
    const toolbar = document.getElementById('absmartly-preview-header')
    return toolbar !== null
  })

  if (shouldBeEnabled) {
    expect(changesApplied).toBe(true)
    expect(toolbarVisible).toBe(true)
  } else {
    expect(changesApplied).toBe(false)
    expect(toolbarVisible).toBe(false)
  }

  log(`Preview toggle verified: changes=${changesApplied}, toolbar=${toolbarVisible}`, 'debug')
  await debugWait()

  return { changesApplied, toolbarVisible }
}
