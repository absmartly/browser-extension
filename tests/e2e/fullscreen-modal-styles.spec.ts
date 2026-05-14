import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the full-screen experiment modal stylesheet bridge (FT-1905).
 *
 * Bug being defended against: the modal is mounted on the sidebar iframe's
 * document.body inside an open shadow root with `all: initial`. Without
 * pulling Tailwind into that shadow root, every utility class on
 * AudienceEditor / CustomFieldsEditor / VariantScreenshots / AIFillButton
 * renders with UA defaults — a silent visual regression that no other test
 * catches.
 *
 * This test opens the modal and asserts that the AIFillButton's
 * `bg-purple-600` Tailwind class actually paints — i.e. its computed
 * background-color is the expected Tailwind purple, NOT the UA default
 * (transparent / rgba(0, 0, 0, 0)).
 */
test.describe('Full-screen experiment modal — styles (FT-1905)', () => {
  test('Tailwind classes apply inside the modal shadow root', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(30_000)

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

    const createHeader = sidebar.locator('#create-experiment-header')
    await createHeader.waitFor({ state: 'visible', timeout: 10_000 })

    // Trigger the full-screen modal.
    await sidebar.locator('#open-fullscreen-button').click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })

    // Wait for the AI Fill button — it's the marker Tailwind class is loaded.
    const aiFillButton = sidebar.locator('#ai-fill-button')
    await aiFillButton.waitFor({ state: 'visible', timeout: 10_000 })

    // Read the computed background-color of the AI Fill button. Tailwind's
    // `bg-purple-600` resolves to rgb(147, 51, 234). If the stylesheet hasn't
    // made it into the shadow root the button paints with the UA default of
    // rgba(0, 0, 0, 0) (transparent).
    const aiFillBg = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.getElementById('ai-fill-button')
      if (!btn) return null
      return getComputedStyle(btn).backgroundColor
    })

    expect(aiFillBg).toBe('rgb(147, 51, 234)')

    // Sanity check: at least one stylesheet (style or link) was cloned into
    // the shadow root. This catches the regression where the cloning helper
    // silently no-ops.
    const stylesheetCount = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const root = host?.shadowRoot
      if (!root) return 0
      return root.querySelectorAll('style, link[rel="stylesheet"]').length
    })
    expect(stylesheetCount).toBeGreaterThan(0)
  })
})
