import { test, expect } from '../fixtures/extension'
import {
  installAPIOperationStub,
  installAuthStub,
  setupTestPage
} from './utils/test-helpers'

/**
 * E2E coverage for the FT-1905 modal additions:
 *  - BUG 1 follow-up: typing inside the RichTextEditor results in characters
 *    actually appearing (proves the controlled-value fix works end-to-end).
 *  - BUG 4: adding a group and a rule in the visual audience filter editor
 *    and the underlying audience JSON updates.
 *  - BUG 5: selecting a metric in the new metrics selector.
 */

const FAKE_METRICS = [
  { metric_id: 1, name: 'Conversion Rate', description: 'Signups / sessions' },
  { metric_id: 2, name: 'Revenue per User' },
  { metric_id: 3, name: 'Bounce Rate' }
]

const FAKE_HYPOTHESIS_FIELD = {
  id: 7,
  custom_section_field_id: 7,
  title: 'Hypothesis',
  type: 'text',
  required: false,
  archived: false
}

test.describe('Full-screen modal — new sections (FT-1905)', () => {
  test('opens modal, adds an audience group, picks a primary metric, types in rich text editor', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    await installAuthStub(context)
    await installAPIOperationStub(context, {
      listApplications: { data: [] },
      listUnitTypes: { data: [{ unit_type_id: 1, name: 'user_id' }] },
      listMetrics: { data: FAKE_METRICS },
      listExperimentTags: { data: [] },
      listUsers: { data: [] },
      listTeams: { data: [] },
      listCustomSectionFields: { data: [FAKE_HYPOTHESIS_FIELD] }
    })

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(
      testPage,
      extensionUrl,
      '/visual-editor-test.html'
    )

    // Open the Create-experiment flow → From scratch.
    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratch = sidebar.locator('#from-scratch-button')
    await fromScratch.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratch.click()

    // Wait for inline editor, then open the fullscreen modal.
    await sidebar
      .locator('#create-experiment-header')
      .waitFor({ state: 'visible', timeout: 10_000 })
    await sidebar
      .locator('#open-fullscreen-button')
      .waitFor({ state: 'visible', timeout: 10_000 })
    await sidebar.locator('#open-fullscreen-button').click()
    await sidebar
      .locator('#absmartly-fullscreen-host')
      .waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // --- BUG 4: visual audience filter editor ---
    const audienceEditor = sidebar.locator('#audience-filter-editor')
    await audienceEditor.waitFor({ state: 'visible', timeout: 5_000 })
    // Empty state visible.
    await sidebar
      .locator('#audience-filter-empty')
      .waitFor({ state: 'visible', timeout: 5_000 })
    // Add a group. Playwright's `.click()` is unreliable on elements inside
    // the modal's open shadow root (the host has `all: initial` set), so we
    // dispatch the click via the shadow root explicitly. (Locator-based
    // assertions like waitFor still work because Playwright's locator engine
    // pierces shadow DOM.)
    const clickInShadow = async (id: string) =>
      sidebar.locator('body').evaluate((_, eid) => {
        const host = document.getElementById('absmartly-fullscreen-host')
        const el = host?.shadowRoot?.getElementById(eid) as HTMLElement | null
        if (!el) return false
        el.dispatchEvent(
          new MouseEvent('click', { bubbles: true, cancelable: true })
        )
        return true
      }, id)

    expect(await clickInShadow('audience-filter-add-group')).toBe(true)
    await sidebar
      .locator('#audience-group-0')
      .waitFor({ state: 'visible', timeout: 5_000 })
    // The first rule exists with default eq operator.
    await sidebar
      .locator('#audience-rule-0-0-path')
      .waitFor({ state: 'visible', timeout: 5_000 })
    await sidebar.locator('#audience-rule-0-0-path').fill('country')
    await sidebar.locator('#audience-rule-0-0-value').fill('US')
    // Path/value persisted.
    await expect(sidebar.locator('#audience-rule-0-0-path')).toHaveValue(
      'country'
    )
    await expect(sidebar.locator('#audience-rule-0-0-value')).toHaveValue('US')

    // --- BUG 5: metrics selector ---
    const metricsSelector = sidebar.locator('#metrics-selector')
    await metricsSelector.waitFor({ state: 'visible', timeout: 5_000 })
    expect(await clickInShadow('metrics-selector-primary-add')).toBe(true)
    await sidebar
      .locator('#metrics-selector-primary-picker')
      .waitFor({ state: 'visible', timeout: 5_000 })
    expect(
      await clickInShadow('metrics-selector-primary-picker-option-1')
    ).toBe(true)
    // The selected primary card should now be visible.
    await sidebar
      .locator('#metrics-selector-primary-1')
      .waitFor({ state: 'visible', timeout: 5_000 })
    await expect(
      sidebar.locator('#metrics-selector-primary-1')
    ).toContainText('Conversion Rate')

    // --- BUG 1 follow-up: typing in the RichTextEditor renders characters ---
    // Hypothesis is rendered as a text custom field → RichTextEditor (Lexical
    // contenteditable). Directly type via the keyboard primitives: focus the
    // contenteditable, then drive page.keyboard.type which delivers OS-level
    // input events even inside a closed-ish shadow root. We assert the
    // characters render into the editor.
    const richInput = sidebar.locator('#cfe-input-7')
    await richInput.waitFor({ state: 'visible', timeout: 5_000 })
    // Focus then type via the page keyboard. The contenteditable is inside
    // the modal's open shadow root; focus() inside an evaluate works even
    // when click() doesn't, because focus is a direct DOM call.
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const el = host?.shadowRoot?.getElementById(
        'cfe-input-7'
      ) as HTMLElement | null
      el?.focus()
      // Place the caret inside the editor so Lexical has a selection to
      // insert into. We use the Selection API rooted in the host's owner
      // document.
      if (el) {
        const doc = el.ownerDocument
        const sel = doc.getSelection()
        if (sel) {
          sel.removeAllRanges()
          const range = doc.createRange()
          range.selectNodeContents(el)
          range.collapse(false)
          sel.addRange(range)
        }
      }
    })
    await testPage.keyboard.type('hello rich text', { delay: 5 })
    // The Lexical editor renders the typed text inside the contenteditable.
    await expect(richInput).toContainText('hello rich text', { timeout: 10_000 })

    // --- Real-user click pattern: clicking the bordered wrapper (NOT the
    // contenteditable directly) must also focus the editor. This regression
    // failed in the wild after the resize wrapper was added — clicks on the
    // border area landed on the non-editable wrapper and the editor stayed
    // unfocused, so users typed and "nothing happened".
    await richInput.evaluate((el) => {
      // Clear so we can verify the next chunk starts from empty.
      el.textContent = ''
    })
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const wrapper = host?.shadowRoot?.getElementById(
        'cfe-input-7-resize-wrapper'
      ) as HTMLElement | null
      if (!wrapper) throw new Error('resize wrapper not found')
      // Dispatch a synthetic mousedown on the wrapper itself (not bubbling
      // up from the contenteditable). This mirrors a click on the border /
      // padding area outside the contenteditable's content box.
      const rect = wrapper.getBoundingClientRect()
      wrapper.dispatchEvent(
        new MouseEvent('mousedown', {
          bubbles: true,
          clientX: rect.left + 1,
          clientY: rect.top + 1,
        })
      )
    })
    await testPage.keyboard.type('after click', { delay: 5 })
    await expect(richInput).toContainText('after click', { timeout: 5_000 })
  })

  test('real user click + keystrokes into RichTextEditor — no JS focus/selection pre-seed', async ({
    context,
    extensionUrl
  }) => {
    // Reproduce the user's actual experience: open the modal, click the
    // RichTextEditor contenteditable like a real user would (no JS focus(),
    // no manual Selection.addRange) and type. The characters must appear.
    //
    // Pre-fix this test failed: the modal lives inside an open shadow root,
    // and Lexical's `internalCreateRangeSelection` reads the active selection
    // via `window.getSelection()`. In Chromium that returns a range scoped
    // to the iframe document (anchor at <body>) instead of the shadow root's
    // own selection, so Lexical concluded "no RangeSelection" and the
    // beforeinput handler silently dropped every keystroke. The fix patches
    // the iframe window's getSelection() to forward to the shadow root's
    // Selection whenever the active element is inside the shadow host.
    test.setTimeout(60_000)

    await installAuthStub(context)
    await installAPIOperationStub(context, {
      listApplications: { data: [] },
      listUnitTypes: { data: [{ unit_type_id: 1, name: 'user_id' }] },
      listMetrics: { data: FAKE_METRICS },
      listExperimentTags: { data: [] },
      listUsers: { data: [] },
      listTeams: { data: [] },
      listCustomSectionFields: { data: [FAKE_HYPOTHESIS_FIELD] }
    })

    const testPage = await context.newPage()
    const { sidebar } = await setupTestPage(
      testPage,
      extensionUrl,
      '/visual-editor-test.html'
    )

    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratch = sidebar.locator('#from-scratch-button')
    await fromScratch.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratch.click()
    await sidebar
      .locator('#create-experiment-header')
      .waitFor({ state: 'visible', timeout: 10_000 })
    await sidebar
      .locator('#open-fullscreen-button')
      .waitFor({ state: 'visible', timeout: 10_000 })
    await sidebar.locator('#open-fullscreen-button').click()
    await sidebar
      .locator('#absmartly-fullscreen-host')
      .waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    const richInput = sidebar.locator('#cfe-input-7')
    await richInput.waitFor({ state: 'visible', timeout: 5_000 })

    // Real-user click: scroll the editor into view, then drive Playwright's
    // .click() directly on the contenteditable. No JS focus(), no manual
    // Selection range. This is what mouse-clicking the editor in real Chrome
    // would do.
    await richInput.scrollIntoViewIfNeeded()
    await richInput.click()

    // Type via the OS-level keyboard. If the editor lost focus / Lexical
    // can't find the selection, the keystrokes will go nowhere and the
    // assertion below will fail — that's the bug we're guarding against.
    await testPage.keyboard.type('hello world', { delay: 10 })

    await expect(richInput).toContainText('hello world', { timeout: 5_000 })
  })
})
