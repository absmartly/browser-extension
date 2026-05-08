import { test, expect } from '../fixtures/extension'
import {
  installAIFillBridgeStub,
  installAPIOperationStub,
  installAuthStub,
  setupTestPage
} from './utils/test-helpers'

/**
 * E2E test for the custom-fields AI fill round-trip in the FT-1905 modal.
 *
 * 1. Mock the workspace `listCustomSectionFields` API to return one
 *    "hypothesis" custom field.
 * 2. Open the modal and verify the field input renders with id
 *    `cfe-input-hypothesis`.
 * 3. AI Fill returns `custom_fields: [{ field_name: "hypothesis", value: ... }]`.
 *    Verify the input now shows that value.
 * 4. Save the modal — this writes back into the inline editor's formData.
 *    Re-open the modal and verify the hypothesis input still shows the
 *    AI-filled value (proves customFieldValues survived the save round-trip
 *    and the parent's setFormData picked it up).
 *
 * Note: we don't drive the inline-editor form submit because that requires
 * a UnitType selection (fragile SearchableSelect dropdown interaction). The
 * round-trip into the inline state + back into a freshly-opened modal is
 * sufficient to prove formData.customFieldValues is updated. The actual API
 * payload shape is covered by the unit test in
 * src/hooks/__tests__/useExperimentSave-customFields.test.ts.
 */

test.describe('Full-screen experiment modal — custom fields (FT-1905)', () => {
  test('AI-filled hypothesis flows from modal to inline editor and persists round-trip', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    const HYPOTHESIS_FIELD = {
      id: 7,
      name: 'hypothesis',
      title: 'Hypothesis',
      type: 'text',
      required: false,
      archived: false,
      order_index: 0,
      default_value: '',
      help_text: '',
      placeholder: ''
    }

    const HYPOTHESIS_VALUE = 'We believe the new layout improves engagement.'

    // Stub auth (so editor resources load) and API ops we expect:
    // listCustomSectionFields → return our hypothesis field.
    await installAuthStub(context)
    await installAPIOperationStub(context, {
      listCustomSectionFields: { data: [HYPOTHESIS_FIELD] },
      // The other resource calls happen on the editor mount — return empty
      // arrays so they resolve cleanly without contacting the real backend.
      listExperiments: {
        data: { experiments: [], total: 0, hasMore: false }
      },
      listApplications: { data: [] },
      listUnitTypes: { data: [{ unit_type_id: 1, name: 'user_id' }] },
      listMetrics: { data: [] },
      listExperimentTags: { data: [] },
      listUsers: { data: [] },
      listTeams: { data: [] }
    })

    // AI fill returns the hypothesis via custom_fields.
    await installAIFillBridgeStub(context, {
      conversationId: 'stub-conv-cfe',
      emit: {
        kind: 'tool_result',
        input: {
          display_name: 'CFE Test',
          name: 'cfe_test',
          audience: '{"filter":[{"and":[]}]}',
          audience_strict: false,
          percentage_of_traffic: 100,
          percentages: '50/50',
          custom_fields: [
            { field_name: 'hypothesis', value: HYPOTHESIS_VALUE }
          ]
        }
      }
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
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // The hypothesis input should render — getCustomSectionFields was
    // intercepted to return our field.
    const hypothesisInput = sidebar.locator('#cfe-input-hypothesis')
    await hypothesisInput.waitFor({ state: 'visible', timeout: 10_000 })
    await expect(hypothesisInput).toHaveValue('')

    // Run AI Fill → Skip & Fill.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    // The hypothesis input should be populated by the AI result.
    await expect(hypothesisInput).toHaveValue(HYPOTHESIS_VALUE, {
      timeout: 15_000
    })
    await expect(sidebar.locator('#fs-display-name-input')).toHaveValue(
      'CFE Test'
    )

    // Save the modal (synthetic click — same shadow-host pattern).
    const saveClicked = await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const btn = host?.shadowRoot?.getElementById(
        'fullscreen-modal-save'
      ) as HTMLButtonElement | null
      if (!btn) return false
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return true
    })
    expect(saveClicked).toBe(true)

    // Host detaches.
    await modalHost.waitFor({ state: 'detached', timeout: 10_000 })

    // The inline editor should now have the AI-filled display_name.
    await expect(sidebar.locator('#display-name-input')).toHaveValue(
      'CFE Test',
      { timeout: 5_000 }
    )

    // Re-open the modal and verify the hypothesis value survives. This
    // proves customFieldValues was applied to formData and is round-tripped
    // back into a fresh draft.
    await sidebar.locator('#open-fullscreen-button').click()
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    const hypothesisInput2 = sidebar.locator('#cfe-input-hypothesis')
    await hypothesisInput2.waitFor({ state: 'visible', timeout: 10_000 })
    await expect(hypothesisInput2).toHaveValue(HYPOTHESIS_VALUE, {
      timeout: 5_000
    })
  })
})
