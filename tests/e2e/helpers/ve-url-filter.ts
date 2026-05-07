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
  await page.screenshot({ path: 'test-results/before-url-filter-test.png', fullPage: true })

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
    await sidebar.locator('#url-filtering-toggle-variant-1').waitFor({ state: 'visible', timeout: 3000 })
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
    }
  }

  const urlFilterButton = sidebar.locator('#url-filtering-toggle-variant-1')
  await urlFilterButton.waitFor({ state: 'visible', timeout: 3000 })
  await urlFilterButton.click()

  const modeSelect = sidebar.locator('#url-filter-mode-variant-1')
  await modeSelect.waitFor({ state: 'visible', timeout: 3000 })
  await modeSelect.selectOption('simple')

  const patternInput = sidebar.locator('#url-filter-pattern-variant-1-0')
  await patternInput.waitFor({ state: 'visible', timeout: 3000 })
  await patternInput.fill('/test-path/*')
  await patternInput.blur()

  await page.waitForFunction(() => document.readyState === 'complete', { timeout: 1000 }).catch(() => {})

  const jsonButton = sidebar.locator('#json-editor-button-variant-1')
  await jsonButton.waitFor({ state: 'visible', timeout: 3000 })
  await jsonButton.click()

  const jsonEditorInPage = page.locator('.json-editor-title, .cm-editor').first()
  await jsonEditorInPage.waitFor({ state: 'visible', timeout: 3000 })
  const editorVisible = await jsonEditorInPage.isVisible({ timeout: 10000 }).catch(() => false)

  if (!editorVisible) {
    await page.screenshot({ path: 'test-results/json-editor-not-found.png', fullPage: true })
    throw new Error('JSON editor did not open')
  }

  await page.screenshot({ path: 'test-results/json-editor-opened.png', fullPage: true })

  // CodeMirror v6 virtualizes — `.cm-content.textContent` only contains the
  // currently rendered (visible) lines. The variant config can run long
  // enough to push `urlFilter` below the viewport, in which case
  // textContent misses it. Reach the EditorView via the cmView property
  // CodeMirror attaches to the content element and read state.doc for the
  // full source.
  // CodeMirror v6 virtualizes — `.cm-content.textContent` only contains the
  // currently rendered (visible) lines. The variant config can run long
  // enough to push `urlFilter` below the viewport, in which case
  // textContent misses it. Scroll cm-scroller through the document and
  // accumulate the rendered text at each scroll position so we observe
  // the full doc regardless of viewport size.
  const jsonContent = await page.evaluate(async () => {
    const scroller = document.querySelector(".cm-scroller") as HTMLElement | null
    const content = document.querySelector(".cm-content")
    if (!scroller || !content) return ""

    const seen = new Set<string>()
    const collect = () => {
      content.querySelectorAll(".cm-line").forEach((line) => {
        seen.add(line.textContent ?? "")
      })
    }

    collect()
    const totalHeight = scroller.scrollHeight
    const step = scroller.clientHeight || 200
    for (let y = 0; y <= totalHeight; y += step) {
      scroller.scrollTop = y
      // Yield once so CodeMirror's measure pass renders the new viewport.
      await new Promise(requestAnimationFrame)
      collect()
    }
    scroller.scrollTop = 0

    return Array.from(seen).join("\n")
  })

  const hasUrlFilter = jsonContent.includes('urlFilter') || jsonContent.includes('url_filter')
  expect(hasUrlFilter).toBeTruthy()

  const hasInclude = jsonContent.includes('include')
  expect(hasInclude).toBeTruthy()

  const hasPathPattern = jsonContent.includes('/test-path/*')
  expect(hasPathPattern).toBeTruthy()

  const hasMatchType = jsonContent.includes('matchType') && jsonContent.includes('path')
  expect(hasMatchType).toBeTruthy()

  log('  ✓ URL filter verified in JSON payload')

  const closeButton = page.locator('#json-editor-close-button')
  await closeButton.click()

  await jsonEditorInPage.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {})
  await debugWait()
}
