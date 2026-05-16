import { type Page, type FrameLocator, expect } from '@playwright/test'
import { log } from '../utils/test-helpers'

/**
 * Verifies that URL filter pattern inputs (in both simple and advanced modes)
 * fill nearly the full row width inside the URL Filtering panel (FT-1927).
 *
 * Assumes:
 * - The URL Filtering section is already expanded.
 * - Simple mode is active with at least one pattern (e.g. `/test-path/*`).
 *
 * Steps:
 * 1. Measure the simple-mode pattern input vs. the mode-select width.
 *    The input should be within ~60px of the select's full width.
 * 2. Switch the mode dropdown to "advanced" and verify the include-pattern
 *    input fills the row similarly.
 * 3. Click "+ Add Exclude Pattern" so an exclude input appears, then verify
 *    its width against the mode-select reference.
 * 4. Take a screenshot of the final state.
 *
 * @param sidebar - The sidebar FrameLocator.
 * @param page - The test page (used for screenshots).
 */
export async function verifyURLFilterInputsFullWidth(
  sidebar: FrameLocator,
  page: Page
): Promise<void> {
  await page.screenshot({
    path: 'test-results/url-filter-width-before.png',
    fullPage: true
  })
  log('Screenshot saved: url-filter-width-before.png')

  // The mode select fills the panel width (className includes "w-full"); use
  // its width as the "full available width" reference inside the panel.
  const modeSelect = sidebar.locator('#url-filter-mode-variant-1')
  await modeSelect.waitFor({ state: 'visible', timeout: 3000 })
  const modeBox = await modeSelect.boundingBox()
  if (!modeBox) throw new Error('Could not measure mode-select bounding box')
  log(`  mode-select width: ${modeBox.width.toFixed(1)}px`)

  // 1. Simple-mode pattern input — should fill the row (row contains input + X button).
  const simpleInput = sidebar.locator('#url-filter-pattern-variant-1-0')
  await simpleInput.waitFor({ state: 'visible', timeout: 3000 })
  const simpleBox = await simpleInput.boundingBox()
  if (!simpleBox) throw new Error('Could not measure simple-mode pattern input')
  log(`  simple-mode input width: ${simpleBox.width.toFixed(1)}px`)

  expect(
    simpleBox.width,
    `simple-mode pattern input should fill the row (got ${simpleBox.width.toFixed(1)}px, mode-select is ${modeBox.width.toFixed(1)}px)`
  ).toBeGreaterThan(modeBox.width - 60)
  log('  ✓ simple-mode pattern input fills row width')

  // 2. Switch to advanced mode.
  await modeSelect.selectOption('advanced')

  const includeInput = sidebar.locator('#url-filter-include-pattern-variant-1-0')
  await includeInput.waitFor({ state: 'visible', timeout: 3000 })

  await page.screenshot({
    path: 'test-results/url-filter-width-advanced.png',
    fullPage: true
  })
  log('Screenshot saved: url-filter-width-advanced.png')

  const includeBox = await includeInput.boundingBox()
  if (!includeBox) throw new Error('Could not measure advanced include input')
  log(`  advanced include input width: ${includeBox.width.toFixed(1)}px`)

  expect(
    includeBox.width,
    `advanced-mode include input should fill the row (got ${includeBox.width.toFixed(1)}px, mode-select is ${modeBox.width.toFixed(1)}px)`
  ).toBeGreaterThan(modeBox.width - 60)
  log('  ✓ advanced-mode include input fills row width')

  // 3. Click "+ Add Exclude Pattern" so an exclude input appears.
  const addExcludeBtn = sidebar.locator('#url-filter-add-exclude-variant-1')
  await addExcludeBtn.waitFor({ state: 'visible', timeout: 3000 })
  await addExcludeBtn.click()

  const excludeInput = sidebar.locator('#url-filter-exclude-pattern-variant-1-0')
  await excludeInput.waitFor({ state: 'visible', timeout: 3000 })

  const excludeBox = await excludeInput.boundingBox()
  if (!excludeBox) throw new Error('Could not measure advanced exclude input')
  log(`  advanced exclude input width: ${excludeBox.width.toFixed(1)}px`)

  expect(
    excludeBox.width,
    `advanced-mode exclude input should fill the row (got ${excludeBox.width.toFixed(1)}px, mode-select is ${modeBox.width.toFixed(1)}px)`
  ).toBeGreaterThan(modeBox.width - 60)
  log('  ✓ advanced-mode exclude input fills row width')

  await page.screenshot({
    path: 'test-results/url-filter-width-verified.png',
    fullPage: true
  })
  log('Screenshot saved: url-filter-width-verified.png')

  // Restore the URL filter section to its original state (simple mode with
  // `/test-path/*` and no excludes) so subsequent test steps see the same
  // setup as before this helper ran. The simplePatterns array is preserved
  // across mode changes; switching the dropdown back fires updateURLFilter
  // and clears the exclude-related state from the persisted config.
  await modeSelect.selectOption('simple')
  await simpleInput.waitFor({ state: 'visible', timeout: 3000 })

  // Commit the URL filter synchronously by blurring the pattern input
  // (bypasses the 500ms autosave debounce) before the next test step runs.
  await simpleInput.focus()
  await simpleInput.blur()

  // Wait for the React state to settle — the variant config is published via
  // the autosave effect which schedules a setTimeout with 500ms debounce.
  // We need to be sure the autosave has fully fired before the next test
  // step starts, so it doesn't race with subsequent UI clicks. Wait on a
  // page-side flag we set ourselves (Plasmo runs the sidebar in an iframe;
  // a microtask-style wait on a DOM mutation is the most reliable signal).
  await sidebar.locator('#json-editor-button-variant-1').click()
  const jsonEditor = page.locator('.cm-editor').first()
  await jsonEditor.waitFor({ state: 'visible', timeout: 3000 })
  // Reading the JSON forces the variant config to be materialised; close.
  const closeButton = page.locator('#json-editor-close-button')
  await closeButton.click()
  await jsonEditor.waitFor({ state: 'hidden', timeout: 3000 })

  // Collapse the URL filtering panel to match the state expected by
  // subsequent test steps.
  const urlFilteringToggle = sidebar.locator('#url-filtering-toggle-variant-1')
  await urlFilteringToggle.click()
  await sidebar
    .locator('#url-filter-mode-variant-1')
    .waitFor({ state: 'hidden', timeout: 3000 })

  log('  ✓ URL filter restored to simple mode and panel collapsed')
}
