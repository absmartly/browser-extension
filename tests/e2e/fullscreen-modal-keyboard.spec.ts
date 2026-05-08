import { test, expect } from '../fixtures/extension'
import {
  installAIFillBridgeStub,
  installCaptureVisibleTabStub,
  setupTestPage
} from './utils/test-helpers'

/**
 * E2E test for keyboard handling in the FT-1905 modal flow:
 *  1. Pressing Escape on the modal does NOT close the modal (current product
 *     behaviour — closing must be explicit via Cancel/Save).
 *  2. Pressing Escape on the ScreenshotViewer DOES close the viewer (its
 *     own keydown handler handles Escape and only the viewer is dismissed).
 */

const TINY_BEFORE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAEEAQB9pXc1AAAAAElFTkSuQmCC'
const TINY_AFTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

test.describe('Full-screen experiment modal — keyboard (FT-1905)', () => {
  test('Escape does NOT close the modal but DOES close ScreenshotViewer', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    await installCaptureVisibleTabStub(context, [TINY_BEFORE, TINY_AFTER])
    await installAIFillBridgeStub(context, {
      conversationId: 'stub-conv-keyboard',
      emit: {
        kind: 'tool_result',
        input: {
          display_name: 'Keyboard Test',
          name: 'keyboard_test',
          audience: '{"filter":[{"and":[]}]}',
          audience_strict: false,
          percentage_of_traffic: 100,
          percentages: '50/50'
        }
      }
    })

    // Seed aiDomChangesState so a screenshot is captured (giving us a
    // VariantScreenshots thumbnail and therefore the ability to mount a
    // ScreenshotViewer).
    await context.addInitScript(() => {
      const tryInject = () => {
        const c = (window as any).chrome
        if (!c?.storage?.local) {
          setTimeout(tryInject, 1)
          return
        }
        c.storage.local.set({
          aiDomChangesState: JSON.stringify({
            variantName: 'Variant 1',
            changes: [{ selector: 'h1', type: 'text', value: 'kbd' }]
          })
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

    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    await sidebar
      .locator('#create-experiment-header')
      .waitFor({ state: 'visible', timeout: 10_000 })

    await sidebar.locator('#open-fullscreen-button').click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    const modal = sidebar.locator('#fullscreen-experiment-modal')
    await modal.waitFor({ state: 'visible', timeout: 10_000 })

    // Press Escape inside the iframe document. The modal should NOT close;
    // host stays attached.
    await sidebar.locator('body').evaluate(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
          cancelable: true
        })
      )
      // Also dispatch on window in case a handler listens there.
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
          cancelable: true
        })
      )
    })

    // Modal must still be visible (and the host attached) — give the React
    // tree a tick to react to the synthetic keydown so a hypothetical
    // close handler could run before we assert.
    await sidebar.locator('body').evaluate(
      () => new Promise<void>((r) => requestAnimationFrame(() => r()))
    )
    await expect(modalHost).toBeAttached()
    await expect(modal).toBeVisible()

    // Now drive AI Fill so screenshots populate, then open the viewer.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    await expect(sidebar.locator('#fs-display-name-input')).toHaveValue(
      'Keyboard Test',
      { timeout: 15_000 }
    )

    const thumb = sidebar.locator('[data-testid="variant-thumb-1"]')
    await thumb.waitFor({ state: 'visible', timeout: 10_000 })

    // Open viewer.
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.querySelector(
        '[data-testid="variant-thumb-1"]'
      ) as HTMLButtonElement | null
      btn?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
    })
    const viewer = sidebar.locator('#screenshot-viewer')
    await viewer.waitFor({ state: 'visible', timeout: 5_000 })

    // The ScreenshotViewer attaches its keydown listener to window. Dispatch
    // an Escape from inside the iframe's window — the viewer detaches.
    await sidebar.locator('body').evaluate(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          bubbles: true,
          cancelable: true
        })
      )
    })

    await viewer.waitFor({ state: 'detached', timeout: 5_000 })

    // The underlying modal should still be visible — Escape on the viewer
    // dismisses only the viewer, not the modal.
    await expect(modal).toBeVisible()
  })
})
