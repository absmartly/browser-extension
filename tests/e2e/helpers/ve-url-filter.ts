import { type Page, type FrameLocator, expect } from '@playwright/test'
import { log, debugWait } from '../utils/test-helpers'

/**
 * Tests URL filter functionality and verifies the JSON payload contains the filter configuration
 *
 * This test:
 * - Expands Variant 1 if collapsed
 * - Disables preview mode if enabled
 * - Opens URL Filtering section
 * - Sets filter mode to "simple"
 * - Adds a path pattern (/test-path/*)
 * - Opens JSON editor
 * - Verifies the URL filter is present in the JSON payload
 *
 * @param sidebar - The sidebar FrameLocator
 * @param page - The test page
 */
export async function testURLFilterAndPayload(sidebar: FrameLocator, page: Page): Promise<void> {
  log('\n🔗 STEP 7.5: Adding URL filter and verifying JSON payload')

  // Take screenshot to see current state
  await page.screenshot({ path: 'test-results/before-url-filter-test.png', fullPage: true })
  log('  📸 Screenshot: before-url-filter-test.png')

  // Scroll sidebar to top to ensure Variant 1 is visible
  await sidebar.locator('body').evaluate(el => el.scrollTop = 0)

  // First, expand Variant 1 section if collapsed
  const variant1Toggle = sidebar.locator('#variant-toggle-1')
  await variant1Toggle.waitFor({ state: 'attached', timeout: 3000 })

  // Check if variant is collapsed by checking the button text
  const isCollapsed = await variant1Toggle.evaluate((btn) => {
    return btn.textContent?.includes('▶') || false
  })

  if (isCollapsed) {
    await variant1Toggle.click()
    // Wait for URL Filtering button to appear after expansion
    await sidebar.locator('#url-filtering-toggle-variant-1').waitFor({ state: 'visible', timeout: 3000 })
    log('  ✓ Expanded Variant 1 section')
  } else {
    log('  ✓ Variant 1 already expanded')
  }

  // Disable preview using ID if enabled
  const variant1PreviewToggle = sidebar.locator('[data-testid="preview-toggle-variant-1"]')
  const toggleExists = await variant1PreviewToggle.isVisible({ timeout: 2000 }).catch(() => false)

  if (toggleExists) {
    const isEnabled = await variant1PreviewToggle.evaluate((btn) => {
      return btn.className.includes('bg-blue-600')
    })

    if (isEnabled) {
      await variant1PreviewToggle.click()
      log('  ✓ Disabled preview mode for Variant 1')
    } else {
      log('  ✓ Preview already disabled for Variant 1')
    }
  }

  // Use ID to find and expand URL Filtering section
  const urlFilterButton = sidebar.locator('#url-filtering-toggle-variant-1')
  await urlFilterButton.waitFor({ state: 'visible', timeout: 3000 })
  await urlFilterButton.click()

  // Wait for mode select to appear after expansion
  const modeSelect = sidebar.locator('#url-filter-mode-variant-1')
  await modeSelect.waitFor({ state: 'visible', timeout: 3000 })
  log('  ✓ Expanded URL Filtering section')

  // Select "simple" mode
  await modeSelect.selectOption('simple')
  log('  ✓ Selected simple URL filter mode')

  // Wait for pattern input to appear after mode change
  const patternInput = sidebar.locator('#url-filter-pattern-variant-1-0')
  await patternInput.waitFor({ state: 'visible', timeout: 3000 })

  // Fill pattern
  await patternInput.fill('/test-path/*')
  await patternInput.blur()
  log('  ✓ Updated URL filter pattern to: /test-path/*')

  // Wait for debounce (500ms in URLFilterSection) + React state update to trigger save
  // TODO: Replace timeout with specific element wait
  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

  // Debug: Check what's in the sidebar's variant config
  const variantConfigDebug = await page.evaluate(() => {
    const allIframes = Array.from(document.querySelectorAll('iframe')).map(f => f.id || f.src)
    const sidebarFrame = document.querySelector('iframe#absmartly-sidebar-iframe') as HTMLIFrameElement

    if (!sidebarFrame) {
      return `Sidebar iframe not found. Found iframes: ${JSON.stringify(allIframes)}`
    }

    if (!sidebarFrame.contentDocument) {
      return 'Sidebar iframe found but contentDocument is null (cross-origin or not loaded)'
    }

    // Access React fiber to get variant data
    const variantElement = sidebarFrame.contentDocument.querySelector('[data-testid="preview-toggle-variant-1"]')?.closest('div')
    if (!variantElement) return 'No variant element found in sidebar'

    const fiber = Object.keys(variantElement).find(key => key.startsWith('__reactFiber$'))
    if (!fiber) return 'No React fiber found on variant element'

    // @ts-ignore
    let node = variantElement[fiber]
    let depth = 0
    while (node && depth < 20) {
      if (node.memoizedProps?.variant) {
        return JSON.stringify(node.memoizedProps.variant.config, null, 2)
      }
      node = node.return
      depth++
    }
    return 'No variant config found in fiber tree (searched 20 levels)'
  })
  log('  🔍 Variant config from sidebar React state:')
  log(variantConfigDebug)

  // Now open the JSON editor for variant 1 to verify the URL filter is in the payload
  log('  Opening JSON editor to verify URL filter...')

  // Use ID to find JSON button for variant 1
  const jsonButton = sidebar.locator('#json-editor-button-variant-1')
  await jsonButton.waitFor({ state: 'visible', timeout: 3000 })
  await jsonButton.click()
  log('  ✓ Clicked JSON editor button for Variant 1')

  // The CodeMirror editor appears in the page, not in the sidebar
  // Look for the json-editor-title class or CodeMirror container
  const jsonEditorInPage = page.locator('.json-editor-title, .cm-editor').first()
  await jsonEditorInPage.waitFor({ state: 'visible', timeout: 3000 })
  const editorVisible = await jsonEditorInPage.isVisible({ timeout: 10000 }).catch(() => false)
  log(`  JSON editor visible in page: ${editorVisible}`)

  if (!editorVisible) {
    await page.screenshot({ path: 'test-results/json-editor-not-found.png', fullPage: true })
    throw new Error('JSON editor did not open')
  }

  log('  ✓ JSON editor modal opened')

  // Take screenshot of JSON editor
  await page.screenshot({ path: 'test-results/json-editor-opened.png', fullPage: true })
  log('  📸 Screenshot: json-editor-opened.png')

  // Get the JSON editor content from CodeMirror
  const jsonContent = await page.evaluate(() => {
    // CodeMirror 6 stores content in the editor state
    const cmEditor = document.querySelector('.cm-content')
    return cmEditor ? cmEditor.textContent : ''
  })

  log('  📄 JSON editor content preview:')
  log(jsonContent.substring(0, 500)) // Show first 500 chars

  // Verify the URL filter is present in the JSON
  const hasUrlFilter = jsonContent.includes('urlFilter') || jsonContent.includes('url_filter')
  expect(hasUrlFilter).toBeTruthy()
  log('  ✓ JSON contains urlFilter field')

  const hasInclude = jsonContent.includes('include')
  expect(hasInclude).toBeTruthy()
  log('  ✓ JSON contains include array')

  const hasPathPattern = jsonContent.includes('/test-path/*')
  expect(hasPathPattern).toBeTruthy()
  log('  ✓ JSON contains the path pattern: /test-path/*')

  const hasMatchType = jsonContent.includes('matchType') && jsonContent.includes('path')
  expect(hasMatchType).toBeTruthy()
  log('  ✓ JSON contains matchType: path')

  // Close the JSON editor modal - look for Cancel or Close button in the page
  const closeButton = page.locator('button:has-text("Cancel"), button:has-text("Close")').first()
  await closeButton.click()
  log('  ✓ Closed JSON editor')

  // Wait for editor to disappear
  await jsonEditorInPage.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})

  log('✅ URL filter test PASSED!')
  log('  • Added URL filter with path pattern: /test-path/*')
  log('  • Verified JSON payload contains urlFilter configuration')
  log('  • Verified include array with pattern')
  log('  • Verified matchType is set to path')
  await debugWait()
}
