import { type Page, type FrameLocator, expect } from '@playwright/test'
import { log, debugWait } from '../utils/test-helpers'

/**
 * Verification helpers for Visual Editor tests
 */

/**
 * Verify that all Visual Editor buttons are disabled when VE is active.
 * This ensures only one VE instance can be active at a time.
 */
export async function verifyVEProtection(sidebar: FrameLocator): Promise<void> {
  const allVEButtons = sidebar.locator('button:has-text("Visual Editor")')
  const buttonCount = await allVEButtons.count()

  // Check ALL buttons are disabled
  for (let i = 0; i < buttonCount; i++) {
    const button = allVEButtons.nth(i)
    const isDisabled = await button.isDisabled()
    const title = await button.getAttribute('title')

    // Verify all buttons are disabled
    expect(isDisabled).toBe(true)
    expect(title).toMatch(/Visual Editor is (already active for this variant|active for variant)/)
  }
  log('  ✓ All VE buttons disabled when VE is active')

  await debugWait()
}

/**
 * Verify changes appear in sidebar after VE closes.
 * This checks that DOM change cards are present and verifies specific changes.
 */
export async function verifySidebarHasChanges(sidebar: FrameLocator, minExpectedChanges: number = 4): Promise<void> {
  // Wait for DOM change cards to appear in the sidebar
  await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 10000 })

  // Count the number of DOM change cards
  const changeCards = await sidebar.locator('.dom-change-card').count()
  expect(changeCards).toBeGreaterThanOrEqual(minExpectedChanges)

  // Get the text content of all cards to verify change types
  const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
  const allText = cardsText.join(' ')

  // Verify each specific change we made is present with correct details
  const hasEditText = allText.includes('#test-paragraph') && allText.includes('Text undo test')
  log(`  ${hasEditText ? '✓' : '✗'} Edit Text: #test-paragraph → "Text undo test"`)
  expect(hasEditText).toBeTruthy()

  const hasHide = allText.includes('#button-1') && allText.includes('display') && allText.includes('none')
  log(`  ${hasHide ? '✓' : '✗'} Hide: #button-1 → display:none`)
  expect(hasHide).toBeTruthy()

  const hasDelete = allText.includes('#button-2') && (allText.toLowerCase().includes('delete') || allText.toLowerCase().includes('remove'))
  log(`  ${hasDelete ? '✓' : '✗'} Delete/Remove: #button-2`)
  expect(hasDelete).toBeTruthy()

  const hasEditHTML = allText.includes('#test-container') && (allText.includes('HTML') || allText.includes('html'))
  log(`  ${hasEditHTML ? '✓' : '✗'} Edit HTML: #test-container → HTML change`)
  expect(hasEditHTML).toBeTruthy()

  log('  ✓ All expected changes verified in sidebar')
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

/**
 * Verify that changes and markers persist after exiting the Visual Editor.
 * This ensures that all DOM changes remain applied and data attributes are present.
 */
export async function verifyChangesAfterVEExit(page: Page): Promise<void> {
  const postVEState = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')

    // Count elements with markers
    const markedElements = document.querySelectorAll('[data-absmartly-experiment]')
    const elementsWithOriginals = document.querySelectorAll('[data-absmartly-original]')

    return {
      paragraphText: paragraph?.textContent?.trim(),
      button1Display: button1 ? window.getComputedStyle(button1).display : null,
      button2Display: button2 ? window.getComputedStyle(button2).display : null,
      testContainerHTML: testContainer?.innerHTML?.trim(),
      markedElementsCount: markedElements.length,
      elementsWithOriginalsCount: elementsWithOriginals.length,
      experimentNames: Array.from(markedElements).map(el =>
        (el as HTMLElement).dataset.absmartlyExperiment
      )
    }
  })

  expect(postVEState.paragraphText).toBe('Bold HTML test')
  expect(postVEState.button1Display).toBe('none')
  expect(postVEState.button2Display).toBe('none')
  expect(postVEState.testContainerHTML).toContain('HTML Edited!')
  expect(postVEState.markedElementsCount).toBeGreaterThan(0)
  expect(postVEState.elementsWithOriginalsCount).toBeGreaterThan(0)

  log('  ✓ Changes and markers verified after VE exit')

  await debugWait()
}

/**
 * Helper to click the save button and wait for changes to be saved.
 * This is a convenience wrapper that handles the common pattern of clicking save
 * and waiting for the operation to complete.
 */
export async function clickSaveButton(page: Page): Promise<void> {
  const saveButton = page.locator('[data-action="save"]')
  await saveButton.waitFor({ state: 'visible' })
  await saveButton.click()

  await page.waitForFunction(() => {
    const button = document.querySelector('[data-action="save"]') as HTMLButtonElement
    return button && !button.hasAttribute('disabled')
  })

  log('  ✓ Changes saved')
}
