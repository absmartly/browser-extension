import { test, expect } from '../fixtures/extension'
import {
  installAPIOperationStub,
  installAuthStub,
  injectSidebarMinimal
} from './utils/test-helpers'

/**
 * E2E test: opening the FT-1905 modal in EDIT mode.
 *
 * The ExperimentEditor switches the modal mode to "edit" when
 * `experiment?.id` is truthy. The simplest way to reach that state in the
 * sidebar without wiring up a Detail-view edit button is to seed
 * `sidebarState` to view='edit' with a known experiment id, then stub the
 * `getExperiment` API operation to return the fake experiment.
 *
 * Verifies:
 *  - modal title says "Edit Experiment"
 *  - Save button says "Update Experiment"
 */

test.describe('Full-screen experiment modal — edit mode (FT-1905)', () => {
  test('modal title is "Edit Experiment" and Save button is "Update Experiment"', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    const FAKE_EXPERIMENT = {
      id: 123,
      name: 'existing_experiment',
      display_name: 'Existing Experiment',
      state: 'created',
      status: 'created',
      percentage_of_traffic: 100,
      percentages: '50/50',
      audience: '{"filter":[{"and":[]}]}',
      audience_strict: false,
      nr_variants: 2,
      iteration: 1,
      unit_type: { unit_type_id: 1 },
      unit_type_id: 1,
      applications: [],
      experiment_tags: [],
      owners: [],
      teams: [],
      variants: [
        { variant: 0, name: 'Control', config: '{}', is_control: true },
        { variant: 1, name: 'Variant 1', config: '{}', is_control: false }
      ]
    }

    await installAuthStub(context)
    await installAPIOperationStub(context, {
      getExperiment: { data: FAKE_EXPERIMENT },
      listExperiments: {
        data: { experiments: [FAKE_EXPERIMENT], total: 1, hasMore: false }
      },
      listApplications: { data: [] },
      listUnitTypes: { data: [{ unit_type_id: 1, name: 'user_id' }] },
      listMetrics: { data: [] },
      listExperimentTags: { data: [] },
      listUsers: { data: [] },
      listTeams: { data: [] },
      listCustomSectionFields: { data: [] }
    })

    // Force the sidebarState read to return our edit-mode seed BEFORE
    // useSidebarState's restoration effect resolves. We can't just write
    // the value to chrome.storage.local — useSidebarState has a sibling
    // save effect that fires synchronously on mount and clobbers it with
    // {selectedExperiment: null}. Instead, intercept chrome.storage.local
    // .get('sidebarState') in the iframe so the first successful read
    // returns our seeded value. The save effect that runs afterward will
    // then store {selectedExperiment: 0|123, ...} based on the restored
    // experiment, which is fine.
    await context.addInitScript(() => {
      const tryPatch = () => {
        const c = (window as any).chrome
        if (!c?.storage?.local) {
          setTimeout(tryPatch, 1)
          return
        }
        const seed = JSON.stringify({
          view: 'edit',
          selectedExperiment: 123,
          timestamp: Date.now()
        })
        const realGet = c.storage.local.get.bind(c.storage.local)
        c.storage.local.get = function (...args: any[]) {
          const arg = args[0]
          // Plasmo Storage.get(key) calls chrome.storage.local.get([nsKey])
          // — single string or array.
          const wantsSidebarState =
            arg === 'sidebarState' ||
            (Array.isArray(arg) && arg.includes('sidebarState')) ||
            (arg && typeof arg === 'object' && 'sidebarState' in arg)
          if (wantsSidebarState) {
            return Promise.resolve({ sidebarState: seed })
          }
          return realGet(...args)
        }
      }
      tryPatch()
    })

    const testPage = await context.newPage()

    await testPage.goto(
      `/visual-editor-test.html?use_shadow_dom_for_visual_editor_context_menu=0`,
      { waitUntil: 'domcontentloaded', timeout: 10_000 }
    )
    await testPage.setViewportSize({ width: 1920, height: 1080 })
    await testPage.waitForSelector('body', { timeout: 5_000 })
    await testPage.evaluate(() => {
      ;(window as any).__absmartlyTestMode = true
    })

    // Custom sidebar inject — injectSidebarMinimal does not wait for the
    // list view's #nav-settings (which is what setupTestPage waits for);
    // we're restoring straight into edit mode so neither list-view nor
    // welcome-screen anchors will appear.
    const sidebar = await injectSidebarMinimal(testPage, extensionUrl)

    // Once view='edit' the editor renders with experiment.id=123. The
    // header is "Edit Experiment".
    const editHeader = sidebar.locator('#create-experiment-header')
    await editHeader.waitFor({ state: 'visible', timeout: 15_000 })
    await expect(editHeader).toHaveText('Edit Experiment')

    // Open the full-screen modal.
    await sidebar.locator('#open-fullscreen-button').click()
    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Modal title says "Edit Experiment".
    const modalTitle = sidebar.locator('#fullscreen-modal-title')
    await modalTitle.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(modalTitle).toHaveText('Edit Experiment')

    // Save button says "Update Experiment".
    const saveButton = sidebar.locator('#fullscreen-modal-save')
    await saveButton.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(saveButton).toHaveText('Update Experiment')
  })
})
