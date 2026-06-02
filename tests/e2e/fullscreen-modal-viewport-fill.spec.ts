import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the full-screen modal viewport-fill behaviour (FT-1905).
 *
 * The sidebar lives inside an iframe whose host container
 * (#absmartly-sidebar-root) is anchored to the right at a fixed 384px width.
 * The full-screen modal mounts on document.body INSIDE the iframe — so
 * without resizing the container the modal would be clipped to 384px.
 *
 * The fix: when the modal opens, the editor sends ABSMARTLY_SIDEBAR_RESIZE to
 * the background script, which uses chrome.scripting.executeScript to expand
 * #absmartly-sidebar-root to 100vw. On close it restores the saved width.
 *
 * This spec verifies that round-trip by measuring the HOST PAGE container —
 * NOT the iframe contents — across the open/close lifecycle.
 */
test.describe('Full-screen modal viewport fill (FT-1905)', () => {
  test('expands sidebar container to viewport on open and restores on close', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    const testPage = await context.newPage()
    const viewport = testPage.viewportSize()
    expect(viewport).not.toBeNull()
    const viewportWidth = viewport!.width

    const { sidebar } = await setupTestPage(
      testPage,
      extensionUrl,
      '/visual-editor-test.html'
    )

    // 1) Baseline: the sidebar container should be at its default 384px.
    const initialWidth = await testPage.evaluate(() => {
      const el = document.getElementById('absmartly-sidebar-root')
      return el ? el.getBoundingClientRect().width : -1
    })
    expect(initialWidth).toBeGreaterThan(300)
    expect(initialWidth).toBeLessThan(420)

    // Open the inline create-experiment editor.
    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    const createHeader = sidebar.locator('#create-experiment-header')
    await createHeader.waitFor({ state: 'visible', timeout: 10_000 })

    // 2) Click "Open in full screen". The host-page container should expand
    //    to ~viewport width before/while the modal mounts.
    const openFsButton = sidebar.locator('#open-fullscreen-button')
    await openFsButton.waitFor({ state: 'visible', timeout: 10_000 })
    await openFsButton.click()

    // Wait for the modal host to attach so we know the open flow completed.
    await sidebar
      .locator('#absmartly-fullscreen-host')
      .waitFor({ state: 'attached', timeout: 10_000 })

    // Wait for the container to actually grow — there's a CSS transition,
    // so poll until the width crosses 95% of the viewport.
    await testPage.waitForFunction(
      (vw) => {
        const el = document.getElementById('absmartly-sidebar-root')
        return !!el && el.getBoundingClientRect().width >= vw * 0.95
      },
      viewportWidth,
      { timeout: 5_000 }
    )

    const expandedWidth = await testPage.evaluate(() => {
      const el = document.getElementById('absmartly-sidebar-root')
      return el ? el.getBoundingClientRect().width : -1
    })
    expect(expandedWidth).toBeGreaterThanOrEqual(viewportWidth * 0.95)

    // 3) Close the modal via Escape (no save). The container should restore.
    await sidebar.locator('#fullscreen-experiment-modal').waitFor({
      state: 'visible',
      timeout: 10_000
    })

    // Trigger the close (X) button inside the shadow root — most reliable
    // across the shadow-DOM boundary.
    const closeClicked = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.getElementById(
        'fullscreen-modal-close'
      ) as HTMLButtonElement | null
      if (!btn) return false
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return true
    })
    expect(closeClicked).toBe(true)

    await sidebar
      .locator('#absmartly-fullscreen-host')
      .waitFor({ state: 'detached', timeout: 10_000 })

    // 4) The container should shrink back near its original width. Wait for
    //    the CSS transition (0.2s) to finish — measure two stable samples in
    //    a row to confirm it has settled.
    await testPage.waitForFunction(
      () => {
        const el = document.getElementById("absmartly-sidebar-root")
        if (!el) return false
        const w = el.getBoundingClientRect().width
        const last = (window as any).__absmartlyLastWidth as
          | number
          | undefined
        ;(window as any).__absmartlyLastWidth = w
        return w < 500 && last !== undefined && Math.abs(w - last) < 1
      },
      undefined,
      { timeout: 5_000, polling: 50 }
    )

    const restoredWidth = await testPage.evaluate(() => {
      const el = document.getElementById('absmartly-sidebar-root')
      return el ? el.getBoundingClientRect().width : -1
    })
    expect(restoredWidth).toBeLessThan(500)
    expect(restoredWidth).toBeGreaterThan(300)
  })
})
