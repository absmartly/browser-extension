import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for FT-1905: changes made to the VariantList inside the modal
 * propagate to the inline editor's variant list.
 *
 * The modal renders its own VariantList. Renaming "Variant 1" → "Treatment"
 * in the modal triggers onVariantsChange (wired through to the inline
 * editor's handleVariantsChange — see ExperimentEditor.tsx). After we save
 * and close the modal, the inline editor's variant-name input for index 1
 * should display "Treatment".
 *
 * Note: The modal's VariantList is INSIDE the shadow root, so all
 * interactions need to address shadow DOM. We dispatch synthetic input
 * events through the shadow root for the rename.
 */

test.describe('Full-screen experiment modal — variants (FT-1905)', () => {
  test('renaming a variant in the modal propagates to inline editor on save', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

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

    // Confirm initial state of the inline editor's Variant 1 row.
    const inlineVariant1 = sidebar.locator('#variant-name-input-1')
    await inlineVariant1.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(inlineVariant1).toHaveValue('Variant 1')

    // Open the modal.
    await sidebar.locator('#open-fullscreen-button').click()
    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Wait for the modal's variant-name input for index 1 to render. There
    // are two `#variant-name-input-1` elements once the modal is open (one
    // in the inline editor, one in the modal); scope to the modal.
    const inModal = sidebar.locator('[data-testid="fullscreen-modal"]')
    const modalVariant1 = inModal.locator('#variant-name-input-1')
    await modalVariant1.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(modalVariant1).toHaveValue('Variant 1')

    // Rename to "Treatment". Dispatch a native input event via the shadow
    // root to ensure React's synthetic event handlers run consistently.
    const renamed = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const input = host?.shadowRoot?.getElementById(
        'variant-name-input-1'
      ) as HTMLInputElement | null
      if (!input) return false
      // React tracks input values via a hidden setter; bypass it so the
      // change event is recognized.
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set
      setter?.call(input, 'Treatment')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
      return true
    })
    expect(renamed).toBe(true)

    // Confirm the rename took inside the modal.
    await expect(modalVariant1).toHaveValue('Treatment', { timeout: 5_000 })

    // Save the modal.
    const saveClicked = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.getElementById(
        'fullscreen-modal-save'
      ) as HTMLButtonElement | null
      btn?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return !!btn
    })
    expect(saveClicked).toBe(true)
    await modalHost.waitFor({ state: 'detached', timeout: 10_000 })

    // The inline editor's variant 1 input now reflects the modal-driven
    // rename.
    await expect(inlineVariant1).toHaveValue('Treatment', { timeout: 5_000 })
  })
})
