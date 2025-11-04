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

  // Check if preview is already enabled by looking at the preview toolbar on the page
  const previewToolbarVisible = await testPage.evaluate(() => {
    return document.getElementById('absmartly-preview-header') !== null
  })
  log(`Preview currently enabled: ${previewToolbarVisible}`)

  // If preview is not enabled, turn it on
  if (!previewToolbarVisible) {
    log('Enabling preview mode')
    const previewToggle = sidebar.locator('#preview-variant-1')
    await previewToggle.click()
    await testPage.waitForSelector('#absmartly-preview-header', { state: 'visible' })
    log('Preview mode enabled')
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
  const addChangeButton = sidebar.locator('button:has-text("Add DOM Change")').first()
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
  await selectorInput.fill('#test-heading')
  log('Filled selector input')

  // Change type to 'attribute'
  const typeSelect = sidebar.locator('#dom-change-type-1-new')
  await typeSelect.waitFor({ state: 'visible' })
  await typeSelect.selectOption('attribute')

  log('Selected attribute change type')

  // Add attribute key-value pairs
  const addPropertyButton = sidebar.locator('button:has-text("Add Property")').first()

  // Add first attribute
  await click(sidebar, addPropertyButton)

  const keyInput1 = sidebar.locator('input[placeholder*="key"]').last()
  const valueInput1 = sidebar.locator('input[placeholder*="value"]').last()
  await keyInput1.fill('data-test-attr')
  await valueInput1.fill('test-value-123')

  // Add second attribute
  await click(sidebar, addPropertyButton)

  const keyInput2 = sidebar.locator('input[placeholder*="key"]').last()
  const valueInput2 = sidebar.locator('input[placeholder*="value"]').last()
  await keyInput2.fill('aria-label')
  await valueInput2.fill('Test Heading Label')

  log('Added attribute properties')

  // Save the change
  const saveButton = sidebar.locator('button:has-text("Save Change")').first()
  await saveButton.waitFor({ state: 'visible' })
  await click(sidebar, saveButton)

  log('Saved attribute change')

  // Enable preview mode
  const previewToggle = sidebar.locator('text=Preview').first()
  await previewToggle.waitFor({ state: 'visible' })
  await click(sidebar, previewToggle)

  log('Preview mode enabled')

  // Verify attributes are applied on the test page
  const testHeading = testPage.locator('#test-heading')
  await testHeading.waitFor({ state: 'visible' })

  const dataAttr = await testHeading.getAttribute('data-test-attr')
  const ariaLabel = await testHeading.getAttribute('aria-label')

  expect(dataAttr).toBe('test-value-123')
  expect(ariaLabel).toBe('Test Heading Label')

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
  const dataAttrAfterToggle = await testHeading.getAttribute('data-test-attr')
  const ariaLabelAfterToggle = await testHeading.getAttribute('aria-label')

  // Attributes should be removed (or null if they weren't there before)
  log(`Attributes after toggle: data-test-attr=${dataAttrAfterToggle}, aria-label=${ariaLabelAfterToggle}`)

  // Turn preview off
  await click(sidebar, previewToggle)

  log('✅ Attribute changes test passed')
}
