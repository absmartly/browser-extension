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
  log('\n🚫 Testing VE protection - all buttons should be disabled')

  const allVEButtons = sidebar.locator('button:has-text("Visual Editor")')
  const buttonCount = await allVEButtons.count()
  log(`  Found ${buttonCount} Visual Editor buttons`)

  // Check ALL buttons are disabled
  for (let i = 0; i < buttonCount; i++) {
    const button = allVEButtons.nth(i)
    const isDisabled = await button.isDisabled()
    const title = await button.getAttribute('title')
    log(`  Button ${i} disabled: ${isDisabled}, title: "${title}"`)

    // Verify all buttons are disabled
    expect(isDisabled).toBe(true)
    expect(title).toMatch(/Visual Editor is (already active for this variant|active for variant)/)
  }
  log('  ✅ All VE buttons correctly disabled when VE is active')

  await debugWait()
}

/**
 * Verify changes appear in sidebar after VE closes.
 * This checks that DOM change cards are present and verifies specific changes.
 */
export async function verifySidebarHasChanges(sidebar: FrameLocator, minExpectedChanges: number = 4): Promise<void> {
  log('\n📝 STEP 7: Verifying changes in sidebar...')

  // Debug: Check if DOM changes InlineEditor component is even mounted
  const inlineEditorExists = await sidebar.locator('[data-testid="dom-changes-inline-editor"], .dom-changes-editor').count()
  log(`  Inline editor exists: ${inlineEditorExists > 0}`)

  // Debug: Check the sidebar HTML structure
  const sidebarHTML = await sidebar.locator('body').innerHTML()
  log(`  Sidebar HTML length: ${sidebarHTML.length} characters`)
  log(`  Sidebar HTML: ${sidebarHTML.substring(0, 500)}...`)

  // Debug: Look for any elements that might contain changes
  const anyChangeElements = await sidebar.locator('[class*="change"], [class*="card"]').count()
  log(`  Elements with 'change' or 'card' in class: ${anyChangeElements}`)

  // Wait for DOM change cards to appear in the sidebar
  // The changes are displayed as cards, not in a Monaco editor
  try {
    // Wait for at least one DOM change card to appear (no need to scroll, they should be visible)
    await sidebar.locator('.dom-change-card').first().waitFor({ timeout: 10000 })
  } catch (err) {
    log('⚠️  DOM change cards did not appear within 10000ms')
    log('  Searching for any elements with "dom-change" in class...')
    const anyDomChangeElements = await sidebar.locator('[class*="dom-change"]').count()
    log(`  Found ${anyDomChangeElements} elements with "dom-change" in class`)

    // Debug: Check if changes are in the data but not rendered
    const sidebarText = await sidebar.locator('body').innerText()
    log('  Sidebar contains "Undo test":', sidebarText.includes('Undo test'))
    log('  Sidebar contains "display:none":', sidebarText.includes('display:none'))

    throw err // Re-throw to fail the test
  }

  // Count the number of DOM change cards
  const changeCards = await sidebar.locator('.dom-change-card').count()
  log(`Found ${changeCards} DOM change cards in sidebar`)

  // Verify we have the expected changes after squashing
  // (text [squashed from multiple edits], hide, delete, html)
  // Note: Multiple text edits to same element are squashed into one
  expect(changeCards).toBeGreaterThanOrEqual(minExpectedChanges)

  // Get the text content of all cards to verify change types
  const cardsText = await sidebar.locator('.dom-change-card').allTextContents()
  const allText = cardsText.join(' ')

  log('DOM Change cards content:', allText.substring(0, 400))
  log('\nSearching for HTML change...')
  log('Looking for: #test-container and "<h2>HTML Edited!</h2><p>New paragraph content</p>"')
  log('Has #test-container:', allText.includes('#test-container'))
  log('Has "<h2>HTML Edited!</h2><p>New paragraph content</p>":', allText.includes('HTML Edited!'))

  // Verify each specific change we made is present with correct details
  log('\n  Verifying individual changes:')

  // 1. Edit Text on #test-paragraph - should contain "Text undo test" (final text after undo/redo test)
  const hasEditText = allText.includes('#test-paragraph') && allText.includes('Text undo test')
  log(`  ${hasEditText ? '✓' : '✗'} Edit Text: #test-paragraph → "Text undo test"`)
  expect(hasEditText).toBeTruthy()

  // 2. Hide #button-1 - should contain style with display:none
  const hasHide = allText.includes('#button-1') && allText.includes('display') && allText.includes('none')
  log(`  ${hasHide ? '✓' : '✗'} Hide: #button-1 → display:none`)
  expect(hasHide).toBeTruthy()

  // 3. Delete/Remove #button-2
  const hasDelete = allText.includes('#button-2') && (allText.toLowerCase().includes('delete') || allText.toLowerCase().includes('remove'))
  log(`  ${hasDelete ? '✓' : '✗'} Delete/Remove: #button-2`)
  expect(hasDelete).toBeTruthy()

  // 4. Edit HTML on #test-container - should have HTML change type
  const hasEditHTML = allText.includes('#test-container') && (allText.includes('HTML') || allText.includes('html'))
  log(`  ${hasEditHTML ? '✓' : '✗'} Edit HTML: #test-container → HTML change`)
  expect(hasEditHTML).toBeTruthy()

  log('\n✅ All expected changes verified in sidebar')

  log('\n🎉 Visual editor complete workflow test PASSED!')
  log('✅ Successfully tested:')
  log('  • Edit Text - Modified paragraph text')
  log('  • Hide - Hid button element')
  log('  • Delete - Deleted button element')
  log('  • Edit HTML - Modified heading HTML')
  log('  • Save to sidebar - Changes synced to DOM editor')
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
  log('\n🔍 STEP 6.5: Verifying changes and markers after VE exit')

  const postVEState = await page.evaluate(() => {
    const paragraph = document.querySelector('#test-paragraph')
    const button1 = document.querySelector('#button-1')
    const button2 = document.querySelector('#button-2')
    const testContainer = document.querySelector('#test-container')

    // Count elements with markers
    const markedElements = document.querySelectorAll('[data-absmartly-experiment]')
    const elementsWithOriginals = document.querySelectorAll('[data-absmartly-original]')

    return {
      // Verify changes are still applied
      paragraphText: paragraph?.textContent?.trim(),
      button1Display: button1 ? window.getComputedStyle(button1).display : null,
      button2Display: button2 ? window.getComputedStyle(button2).display : null,
      testContainerHTML: testContainer?.innerHTML?.trim(),
      // Verify markers are present
      markedElementsCount: markedElements.length,
      elementsWithOriginalsCount: elementsWithOriginals.length,
      // Get marker details for debugging
      experimentNames: Array.from(markedElements).map(el =>
        (el as HTMLElement).dataset.absmartlyExperiment
      )
    }
  })

  log('  Post-VE state:', postVEState)

  // Verify changes are still applied (text should be "Bold HTML test" after HTML undo/redo test)
  expect(postVEState.paragraphText).toBe('Bold HTML test')
  expect(postVEState.button1Display).toBe('none')
  expect(postVEState.button2Display).toBe('none')
  expect(postVEState.testContainerHTML).toContain('HTML Edited!')
  log('  ✓ All changes still applied after VE exit')

  // Verify markers are present (preview mode is still active)
  expect(postVEState.markedElementsCount).toBeGreaterThan(0)
  log(`  ✓ Preview markers present: ${postVEState.markedElementsCount} elements marked`)

  // Verify original values are preserved
  expect(postVEState.elementsWithOriginalsCount).toBeGreaterThan(0)
  log(`  ✓ Original values preserved: ${postVEState.elementsWithOriginalsCount} elements with data-absmartly-original`)

  await debugWait()
}

/**
 * Helper to click the save button and wait for changes to be saved.
 * This is a convenience wrapper that handles the common pattern of clicking save
 * and waiting for the operation to complete.
 */
export async function clickSaveButton(page: Page): Promise<void> {
  log('Clicking save button...')

  // Find and click the save button in the VE toolbar
  const saveButton = page.locator('[data-action="save"]')
  await saveButton.waitFor({ state: 'visible' })
  await saveButton.click()

  // Wait a moment for the save operation to complete
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-action="save"]') as HTMLButtonElement
    return button && !button.hasAttribute('disabled')
  })

  log('Save button clicked and changes saved')
}
