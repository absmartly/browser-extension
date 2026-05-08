import { test, expect } from '../fixtures/extension'
import {
  installAIFillBridgeStub,
  installAPIOperationStub,
  installAuthStub,
  setupTestPage
} from './utils/test-helpers'

/**
 * E2E test for FT-1905: AI-fill maps `applications` and `tags` (by name)
 * onto application_ids / tag_ids in the modal draft.
 *
 * 1. Mock the workspace listApplications / listExperimentTags so the modal
 *    has a name → id map to look up against.
 * 2. AI Fill emits `applications: ["Web"]` and `tags: ["promo"]`.
 * 3. Save the modal (round-trips back into inline editor formData).
 * 4. Re-open the modal and verify the Applications and Tags multi-select
 *    triggers display the resolved names — confirming application_ids /
 *    tag_ids contain the matched ids.
 */

test.describe('Full-screen experiment modal — applications/tags (FT-1905)', () => {
  test('AI-mapped applications and tags appear in modal draft after save', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    const APPLICATION_WEB = {
      application_id: 42,
      id: 42,
      name: 'Web'
    }
    const TAG_PROMO = {
      experiment_tag_id: 77,
      id: 77,
      tag: 'promo',
      name: 'promo'
    }

    await installAuthStub(context)
    await installAPIOperationStub(context, {
      listApplications: { data: [APPLICATION_WEB] },
      listExperimentTags: { data: [TAG_PROMO] },
      listUnitTypes: { data: [{ unit_type_id: 1, name: 'user_id' }] },
      listMetrics: { data: [] },
      listUsers: { data: [] },
      listTeams: { data: [] },
      listCustomSectionFields: { data: [] },
      listExperiments: {
        data: { experiments: [], total: 0, hasMore: false }
      }
    })

    await installAIFillBridgeStub(context, {
      conversationId: 'stub-conv-apps-tags',
      emit: {
        kind: 'tool_result',
        input: {
          display_name: 'Apps Tags',
          name: 'apps_tags',
          audience: '{"filter":[{"and":[]}]}',
          audience_strict: false,
          percentage_of_traffic: 100,
          percentages: '50/50',
          applications: ['Web'],
          tags: ['promo']
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

    // AI Fill → Skip & Fill.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    await expect(sidebar.locator('#fs-display-name-input')).toHaveValue(
      'Apps Tags',
      { timeout: 15_000 }
    )

    // Verify the multi-select triggers reflect the AI-mapped names. There
    // are two #applications-select-trigger elements (one in the inline
    // editor, one in the modal), so scope to the modal via its testid.
    const inModal = sidebar.locator('[data-testid="fullscreen-modal"]')

    const appsTrigger = inModal.locator('#applications-select-trigger')
    await appsTrigger.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(appsTrigger).toContainText('Web', { timeout: 5_000 })

    // Tags trigger likewise.
    const tagsTrigger = inModal.locator('#tags-select-trigger')
    await tagsTrigger.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(tagsTrigger).toContainText('promo', { timeout: 5_000 })

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

    // Re-open the modal and confirm the resolved names persisted —
    // application_ids / tag_ids round-tripped through formData.
    await sidebar.locator('#open-fullscreen-button').click()
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    const inModal2 = sidebar.locator('[data-testid="fullscreen-modal"]')
    const appsTrigger2 = inModal2.locator('#applications-select-trigger')
    await appsTrigger2.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(appsTrigger2).toContainText('Web', { timeout: 5_000 })

    const tagsTrigger2 = inModal2.locator('#tags-select-trigger')
    await tagsTrigger2.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(tagsTrigger2).toContainText('promo', { timeout: 5_000 })
  })
})
