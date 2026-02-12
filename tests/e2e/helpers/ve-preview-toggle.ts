/**
 * Test individual DOM change checkbox toggles in preview mode
 */
import { expect, type Page, type FrameLocator } from '@playwright/test'
import { log, click } from '../utils/test-helpers'

export async function testIndividualPreviewToggle(sidebar: FrameLocator, testPage: Page) {
  log('Testing individual DOM change toggle in preview mode')

  // Take screenshot before starting
  await testPage.screenshot({ path: 'test-results/preview-toggle-start.png', fullPage: true })
  log('Screenshot saved: preview-toggle-start.png')

  // Verify we have DOM change checkboxes from earlier tests
  const firstCheckbox = sidebar.locator('#dom-change-checkbox-0')
  await firstCheckbox.waitFor({ state: 'visible', timeout: 5000 })
  log('Found DOM change checkboxes')

  // Check if preview is already enabled by looking at DOM markers (not toolbar, which only appears in VE mode)
  const previewMarkersPresent = await testPage.evaluate(() => {
    return document.querySelectorAll('[data-absmartly-modified]').length > 0
  })
  log(`Preview currently enabled: ${previewMarkersPresent}`)

  // If preview is not enabled, turn it on
  if (!previewMarkersPresent) {
    log('Enabling preview mode')
    const previewToggle = sidebar.locator('#preview-variant-1')
    await previewToggle.click()
    // Wait for DOM changes to be applied (markers added)
    await testPage.waitForFunction(() => {
      return document.querySelectorAll('[data-absmartly-modified]').length > 0
    }, { timeout: 5000 })
    log('Preview mode enabled (DOM changes applied)')
  } else {
    log('Preview already enabled, continuing...')
  }

  // Use the first DOM change checkbox
  const firstChangeCheckbox = sidebar.locator('#dom-change-checkbox-0')

  // Step 1: Verify change is initially applied (checkbox checked)
  const initiallyChecked = await firstChangeCheckbox.isChecked()
  expect(initiallyChecked).toBe(true)
  log('✓ Change initially checked and applied')

  // Step 2: Uncheck the change - it should disappear from page
  await click(sidebar, firstChangeCheckbox)

  // Wait for checkbox to become unchecked
  await expect(firstChangeCheckbox).not.toBeChecked()
  log('✓ Change unchecked')

  // Step 3: Check it again - it should reappear
  await click(sidebar, firstChangeCheckbox)

  // Wait for checkbox to become checked
  await expect(firstChangeCheckbox).toBeChecked()
  log('✓ Change re-checked and re-applied')

  // Step 4: Uncheck again to verify it works multiple times
  await click(sidebar, firstChangeCheckbox)

  // Wait for checkbox to become unchecked
  await expect(firstChangeCheckbox).not.toBeChecked()
  log('✓ Change can be toggled multiple times')

  // Step 5: Check one more time to leave it enabled
  await click(sidebar, firstChangeCheckbox)

  // Wait for checkbox to become checked
  await expect(firstChangeCheckbox).toBeChecked()

  log('✅ Individual preview toggle test passed')
}

export async function testAttributeChanges(sidebar: FrameLocator, testPage: Page) {
  log('Testing attribute changes in preview mode')

  // We should already be in the variant view from previous test
  // Just verify we can see DOM changes
  const firstCheckbox = sidebar.locator('#dom-change-checkbox-0')
  await firstCheckbox.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {})
  log('DOM changes visible')

  // Add a new DOM change for attributes
  log('Looking for Add DOM Change button')

  // Scroll to the Add DOM Change button
  const addChangeButton = sidebar.locator('#add-dom-change-button')
  await addChangeButton.scrollIntoViewIfNeeded()
  log('Scrolled to Add DOM Change button')

  await testPage.screenshot({ path: 'test-results/before-add-change-click.png', fullPage: true })
  log('Screenshot saved: before-add-change-click.png')

  log('Clicking Add DOM Change button')
  await click(sidebar, addChangeButton)

  await testPage.screenshot({ path: 'test-results/after-add-change-click.png', fullPage: true })
  log('Screenshot saved: after-add-change-click.png')

  // Select a test element
  // IDs are now unique per variant and change: dom-change-selector-{variantIdx}-{changeIdx}
  // For new changes in variant 1 (Variant B), the IDs will be: dom-change-selector-1-new
  log('Waiting for selector input to appear')
  const selectorInput = sidebar.locator('#dom-change-selector-1-new')
  await selectorInput.waitFor({ state: 'visible', timeout: 10000 })
  log('Selector input is visible')
  await selectorInput.fill('#main-title')
  log('Filled selector input')

  // Change type to 'attribute'
  const typeSelect = sidebar.locator('#dom-change-type-1-new')
  await typeSelect.waitFor({ state: 'visible' })
  await typeSelect.selectOption('attribute')

  log('Selected attribute change type')

  // Find the first attribute input (should already exist)
  const firstKeyInput = sidebar.locator('input[placeholder="attribute"]').first()
  await firstKeyInput.waitFor({ state: 'visible', timeout: 5000 })
  log('First attribute key input visible')

  // Fill the first attribute - use real attribute (title for tooltip)
  await firstKeyInput.fill('title')
  const firstValueInput = sidebar.locator('input[placeholder="value"]').first()
  await firstValueInput.fill('Modified Section Title')
  log('Filled first attribute: title=Modified Section Title')

  // Click "+ Add attribute..." to add another attribute
  // Using the ID: add-attribute-{variantIdx}-{changeIdx}
  // For new change in variant 1, the ID will be: add-attribute-1-new
  const addAttributeButton = sidebar.locator('#add-attribute-1-new')
  await addAttributeButton.waitFor({ state: 'visible' })
  await click(sidebar, addAttributeButton)
  log('Clicked + Add attribute...')

  // Fill the second attribute (use .nth(1) to get the second one) - use real attribute (data-experiment)
  const secondKeyInput = sidebar.locator('input[placeholder="attribute"]').nth(1)
  await secondKeyInput.waitFor({ state: 'visible' })
  await secondKeyInput.fill('data-experiment')
  const secondValueInput = sidebar.locator('input[placeholder="value"]').nth(1)
  await secondValueInput.fill('attribute-test')
  log('Filled second attribute: data-experiment=attribute-test')

  log('Added attribute properties')

  // Take a screenshot before saving
  await testPage.screenshot({ path: 'test-results/before-save-attribute-change.png', fullPage: true })
  log('Screenshot saved: before-save-attribute-change.png')

  // Save the change by clicking the save button (green checkmark)
  // Using the ID: dom-change-save-{variantIdx}-{changeIdx}
  // For new change in variant 1, the ID will be: dom-change-save-1-new
  const saveButton = sidebar.locator('#dom-change-save-1-new')
  await click(sidebar, saveButton)

  log('Saved attribute change')

  // Take screenshot before enabling preview
  await testPage.screenshot({ path: 'test-results/before-preview-attribute.png', fullPage: true })
  log('Screenshot saved: before-preview-attribute.png')

  // Check if preview is already enabled (by checking for DOM markers, not toolbar)
  const previewAlreadyEnabled = await testPage.evaluate(() => {
    return document.querySelectorAll('[data-absmartly-modified]').length > 0
  })
  log(`Preview already enabled: ${previewAlreadyEnabled}`)

  // Get the preview toggle locator (needed later for turning preview off)
  const previewToggle = sidebar.locator('#preview-variant-1')

  // Only enable preview if not already enabled
  if (!previewAlreadyEnabled) {
    log('Enabling preview mode')
    await previewToggle.waitFor({ state: 'visible' })
    await click(sidebar, previewToggle)

    // Wait for DOM changes to be applied
    await testPage.waitForFunction(() => {
      return document.querySelectorAll('[data-absmartly-modified]').length > 0
    }, { timeout: 5000 })
    log('Preview mode enabled (DOM changes applied)')
  } else {
    log('Preview already enabled, skipping toggle')
  }

  // Take screenshot right after enabling preview
  await testPage.screenshot({ path: 'test-results/after-preview-click-attribute.png', fullPage: true })
  log('Screenshot saved: after-preview-click-attribute.png')

  // Check if page is still alive
  const pageAlive = await testPage.evaluate(() => true).catch(() => false)
  log(`Page alive after preview enable: ${pageAlive}`)

  if (!pageAlive) {
    log('ERROR: Page crashed after enabling preview!')
    throw new Error('Page crashed after enabling preview mode')
  }

  // Wait for main title element
  log('Waiting for main title element...')
  const mainTitleExists = await testPage.evaluate(() => document.getElementById('main-title') !== null)
  log(`Main title exists: ${mainTitleExists}`)

  if (!mainTitleExists) {
    log('ERROR: Main title element not found')
    await testPage.screenshot({ path: 'test-results/main-title-missing.png', fullPage: true })
    log('Screenshot saved: main-title-missing.png')
    throw new Error('Main title element not found')
  }
  log('Main title element found on page')

  // Verify attributes are applied on the test page
  const mainTitle = testPage.locator('#main-title')
  await mainTitle.waitFor({ state: 'visible', timeout: 5000 })
  log('Main title is visible')

  const titleAttr = await mainTitle.getAttribute('title')
  const dataAttr = await mainTitle.getAttribute('data-experiment')
  log(`Attributes found: title=${titleAttr}, data-experiment=${dataAttr}`)

  expect(titleAttr).toBe('Modified Section Title')
  expect(dataAttr).toBe('attribute-test')

  log('✓ Attributes correctly applied in preview')

  // Toggle the attribute change off (it will be the last one added)
  // Count how many checkboxes exist and use the last index
  let lastIndex = 0
  for (let i = 0; i < 20; i++) {
    const checkbox = sidebar.locator(`#dom-change-checkbox-${i}`)
    const exists = await checkbox.isVisible().catch(() => false)
    if (exists) {
      lastIndex = i
    } else {
      break
    }
  }

  const lastCheckbox = sidebar.locator(`#dom-change-checkbox-${lastIndex}`)
  await click(sidebar, lastCheckbox)

  // Verify attributes are removed
  const titleAttrAfterToggle = await mainTitle.getAttribute('title')
  const dataAttrAfterToggle = await mainTitle.getAttribute('data-experiment')

  // Attributes should be removed (or null if they weren't there before)
  log(`Attributes after toggle: title=${titleAttrAfterToggle}, data-experiment=${dataAttrAfterToggle}`)

  // Turn preview off
  await click(sidebar, previewToggle)

  log('✅ Attribute changes test passed')
}
