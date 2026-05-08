import { test, expect } from '../fixtures/extension'
import {
  installAIFillBridgeStub,
  installCaptureVisibleTabStub,
  setupTestPage
} from './utils/test-helpers'

/**
 * E2E test for the variant screenshot capture flow inside the full-screen
 * modal (FT-1905).
 *
 * The AIFillButton's captureScreenshots() loop calls window.requestAnimationFrame
 * twice per variant and reads via chrome.runtime.sendMessage:ABSMARTLY_CAPTURE_VISIBLE_TAB.
 * We:
 *   1. Patch chrome.runtime.sendMessage in the sidebar iframe to return two
 *      distinct data URLs (BEFORE and AFTER) so capture flows through the
 *      AIFillButton.captureScreenshots loop without invoking the real
 *      background service worker.
 *   2. Seed `aiDomChangesState` in chrome.storage.local so the
 *      ExperimentEditor's effect injects DOM changes into "Variant 1". This
 *      is the trigger for `variantDomChanges` having entries — without it
 *      captureScreenshots is a no-op.
 *   3. Open the modal, run AI Fill → Skip & Fill, and verify:
 *      - #variant-screenshots renders below the form
 *      - the variant-1 thumbnail is visible
 *      - clicking the thumbnail mounts #screenshot-viewer with the AFTER url
 *      - #screenshot-viewer-toggle switches to BEFORE
 *      - #screenshot-viewer-close detaches the viewer
 */

const TINY_BEFORE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAEEAQB9pXc1AAAAAElFTkSuQmCC'
const TINY_AFTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

test.describe('Full-screen experiment modal — screenshot capture (FT-1905)', () => {
  test('captures variant screenshots, viewer toggles BEFORE/AFTER, and closes', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    // Stub captureVisibleTab in every frame BEFORE the sidebar mounts. The
    // first call returns BEFORE, the second AFTER (one variant with DOM changes).
    await installCaptureVisibleTabStub(context, [TINY_BEFORE, TINY_AFTER])

    // Stub the AI bridge so AI Fill resolves quickly. The actual AI result
    // doesn't need to set any fields — we only care that captureScreenshots
    // ran and surfaced the screenshots state.
    await installAIFillBridgeStub(context, {
      conversationId: 'stub-conv-screenshots',
      emit: {
        kind: 'tool_result',
        input: {
          display_name: 'Screenshot Test',
          name: 'screenshot_test',
          audience: '{"filter":[{"and":[]}]}',
          audience_strict: false,
          percentage_of_traffic: 100,
          percentages: '50/50'
        }
      }
    })

    // Seed chrome.storage.local with aiDomChangesState so the
    // ExperimentEditor's effect injects DOM changes into "Variant 1". Plasmo
    // Storage with area:'local' reads JSON-serialized values from
    // chrome.storage.local with no key prefix, so a direct .set is enough.
    await context.addInitScript(() => {
      const tryInject = () => {
        const c = (window as any).chrome
        if (!c?.storage?.local) {
          setTimeout(tryInject, 1)
          return
        }
        const aiState = {
          variantName: 'Variant 1',
          changes: [
            {
              selector: 'h1',
              type: 'text',
              value: 'Variant 1 heading'
            }
          ]
        }
        c.storage.local.set({
          aiDomChangesState: JSON.stringify(aiState)
        })
      }
      tryInject()
    })

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(
      testPage,
      extensionUrl,
      '/visual-editor-test.html'
    )

    // Open Create-experiment dropdown then "From scratch".
    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    await sidebar
      .locator('#create-experiment-header')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // The aiDomChangesState effect runs after currentVariants stabilizes.
    // Wait for it to flush by polling for a window-level marker. We'll use a
    // simpler signal: open the modal and assert variantDomChanges produced
    // a screenshot via the capture stub. If the seed didn't take, AI Fill
    // would not invoke captureVisibleTab and the count check below would fail.

    await sidebar
      .locator('#open-fullscreen-button')
      .click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Run AI Fill → Skip & Fill.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    // The AI result populates display_name, signalling the round-trip is
    // complete and captureScreenshots ran first.
    await expect(sidebar.locator('#fs-display-name-input')).toHaveValue(
      'Screenshot Test',
      { timeout: 15_000 }
    )

    // Variant screenshots section should render with the variant-1 thumb.
    const screenshots = sidebar.locator('#variant-screenshots')
    await screenshots.waitFor({ state: 'visible', timeout: 10_000 })

    const thumb = sidebar.locator('[data-testid="variant-thumb-1"]')
    await thumb.waitFor({ state: 'visible', timeout: 5_000 })

    // Open the viewer by dispatching a click via the shadow root (Playwright
    // .click() is flaky on shadow-rooted hosts in this configuration — same
    // pattern as the Save/Cancel buttons).
    const opened = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.querySelector(
        '[data-testid="variant-thumb-1"]'
      ) as HTMLButtonElement | null
      if (!btn) return false
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return true
    })
    expect(opened).toBe(true)

    const viewer = sidebar.locator('#screenshot-viewer')
    await viewer.waitFor({ state: 'visible', timeout: 5_000 })

    // After opening, the viewer defaults to AFTER — verify src ends with the
    // AFTER data URL we returned from the second captureVisibleTab call.
    const viewerImg = sidebar.locator('#screenshot-viewer-img')
    await expect(viewerImg).toHaveAttribute('src', TINY_AFTER, {
      timeout: 5_000
    })

    // Click the toggle button to switch to BEFORE.
    const toggled = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.getElementById(
        'screenshot-viewer-toggle'
      ) as HTMLButtonElement | null
      if (!btn) return false
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return true
    })
    expect(toggled).toBe(true)
    await expect(viewerImg).toHaveAttribute('src', TINY_BEFORE, {
      timeout: 5_000
    })

    // Close the viewer.
    const closed = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.getElementById(
        'screenshot-viewer-close'
      ) as HTMLButtonElement | null
      if (!btn) return false
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return true
    })
    expect(closed).toBe(true)
    await viewer.waitFor({ state: 'detached', timeout: 5_000 })
  })
})
