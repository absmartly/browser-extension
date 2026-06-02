import { test as base, expect } from '../fixtures/extension'
import { chromium, type BrowserContext } from '@playwright/test'
import path from 'path'
import fs from 'fs'
import {
  installAIFillBridgeStub,
  installAPIOperationStub,
  installAuthStub,
  installCaptureVisibleTabStub,
  setupTestPage
} from './utils/test-helpers'

/**
 * Capture spec for FT-1905 documentation assets — not committed to the
 * feature branch.
 *
 * Drives the full-screen experiment modal end-to-end, taking nine screenshots
 * (saved to /tmp/ft1905-assets/screenshots/) at meaningful states. Recording
 * is forced ON via a custom `context` fixture override (the base extension
 * fixture launches a persistent context without recordVideo, so the project-
 * level `video: 'on'` setting wouldn't propagate). Intended to be run with
 * SLOW=1 SLOW_MO=400 for paced video frames.
 */

const TINY_BEFORE =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAEEAQB9pXc1AAAAAElFTkSuQmCC'
const TINY_AFTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII='

const SCREENSHOT_DIR = '/tmp/ft1905-assets/screenshots'
const VIDEO_DIR = '/tmp/ft1905-assets/video-raw'

// Override the base `context` fixture to launch a persistent context with
// recordVideo enabled. We mirror the upstream fixture's seeding logic so
// existing helpers (setupTestPage, etc.) still work.
const EXTENSION_BUILD_NAME = process.env.CI
  ? 'chrome-mv3-prod'
  : 'chrome-mv3-dev'

const test = base.extend<{ context: BrowserContext }>({
  context: async ({}, use) => {
    const extPath = path.join(
      __dirname,
      '..',
      '..',
      'build',
      EXTENSION_BUILD_NAME
    )
    if (!fs.existsSync(extPath)) {
      throw new Error(
        `Extension build directory not found: ${extPath}. Run 'npm run build:dev' first.`
      )
    }

    fs.mkdirSync(VIDEO_DIR, { recursive: true })

    const headed =
      process.env.HEADED === '1' || process.env.SLOW === '1'

    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      headless: !headed,
      args: [
        `--disable-extensions-except=${extPath}`,
        `--load-extension=${extPath}`,
        '--enable-file-cookies'
      ],
      slowMo: process.env.SLOW_MO
        ? parseInt(process.env.SLOW_MO)
        : undefined,
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: VIDEO_DIR,
        size: { width: 1920, height: 1080 }
      }
    })

    // Seed minimal config so the extension boots — we don't need the full
    // editor-resources cache here because installAPIOperationStub takes over
    // for resource fetches.
    let [sw] = context.serviceWorkers()
    if (!sw) sw = await context.waitForEvent('serviceworker')
    const seedExtId = new URL(sw.url()).host
    const seedPage = await context.newPage()
    await seedPage.goto(
      `chrome-extension://${seedExtId}/tests/seed.html`
    )
    await seedPage.waitForFunction(
      () => typeof (window as any).seed === 'function',
      { timeout: 5000 }
    )
    const defaultConfig = {
      apiKey: '',
      apiEndpoint: '',
      authMethod: 'apikey',
      domChangesFieldName: '__dom_changes',
      vibeStudioEnabled: true,
      aiProvider: 'claude-subscription',
      aiApiKey: '',
      llmModel: 'claude-sonnet-4-5',
      providerModels: {},
      providerEndpoints: {}
    }
    await seedPage.evaluate(
      (data) => (window as any).seed(data),
      {
        'absmartly-config': defaultConfig,
        'plasmo:absmartly-config': defaultConfig
      }
    )
    await seedPage.close()

    await use(context)
    await Promise.race([
      context.close(),
      new Promise<void>((resolve) => setTimeout(resolve, 30000))
    ])
  }
})

test.describe('FT-1905 capture — full-screen modal walkthrough', () => {
  test('captures all nine documentation screenshots in one continuous run', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    const HYPOTHESIS_FIELD = {
      id: 7,
      title: 'Hypothesis',
      type: 'text',
      required: false,
      archived: false,
      order_index: 0,
      default_value: '',
      help_text: '',
      placeholder: ''
    }

    const HYPOTHESIS_VALUE =
      'We believe the new hero layout will increase engagement on mobile users.'

    // 1) Stubs: auth so editor resources load, API ops so resource fetches
    //    resolve, captureVisibleTab so the variant-screenshot strip renders,
    //    and the AI fill bridge so AI Fill returns deterministic payload.
    await installAuthStub(context)
    await installAPIOperationStub(context, {
      listCustomSectionFields: { data: [HYPOTHESIS_FIELD] },
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
    await installCaptureVisibleTabStub(context, [TINY_BEFORE, TINY_AFTER])
    await installAIFillBridgeStub(context, {
      conversationId: 'stub-conv-capture',
      emit: {
        kind: 'tool_result',
        input: {
          display_name: 'Hero CTA Variant Test',
          name: 'hero_cta_variant_test',
          audience: '{"filter":[{"and":[]}]}',
          audience_strict: false,
          percentage_of_traffic: 100,
          percentages: '50/50',
          custom_fields: [
            { field_id: 7, value: HYPOTHESIS_VALUE }
          ]
        }
      }
    })

    // Seed aiDomChangesState so the editor injects DOM changes into
    // "Variant 1" — the trigger for variantDomChanges so the screenshot
    // capture loop actually runs.
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
            changes: [
              { selector: 'h1', type: 'text', value: 'Variant 1 heading' }
            ]
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

    // -------------------------------------------------------------------
    // 1) Open the inline create-experiment form (in the sidebar).
    // -------------------------------------------------------------------
    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    const createHeader = sidebar.locator('#create-experiment-header')
    await createHeader.waitFor({ state: 'visible', timeout: 10_000 })

    // Ensure the open-fullscreen button is in view before we capture.
    const openFsButton = sidebar.locator('#open-fullscreen-button')
    await openFsButton.waitFor({ state: 'visible', timeout: 10_000 })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/01-sidebar-create-form.png`,
      fullPage: true
    })
    console.log('[capture] saved 01-sidebar-create-form.png')

    // -------------------------------------------------------------------
    // 2) Open the modal and capture the empty form state.
    // -------------------------------------------------------------------
    await openFsButton.click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    const modal = sidebar.locator('#fullscreen-experiment-modal')
    await modal.waitFor({ state: 'visible', timeout: 10_000 })

    // Wait for an inner field to settle so the layout is stable.
    await sidebar
      .locator('#fs-display-name-input')
      .waitFor({ state: 'visible', timeout: 5_000 })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/02-modal-opened-empty.png`,
      fullPage: true
    })
    console.log('[capture] saved 02-modal-opened-empty.png')

    // -------------------------------------------------------------------
    // 3) Scroll the modal body to show the audience editor + a custom field.
    // -------------------------------------------------------------------
    const audienceFilter = sidebar.locator('#audience-filter-editor')
    await audienceFilter.waitFor({ state: 'visible', timeout: 5_000 })
    const hypothesisInput = sidebar.locator('#cfe-input-7')
    await hypothesisInput.waitFor({ state: 'visible', timeout: 5_000 })

    // Scroll inside the modal body (open shadow root) to bring the audience
    // editor into view, then the hypothesis input. scrollIntoView only works
    // on elements reachable from the same root, so do it via the host's
    // shadowRoot.
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const root = host?.shadowRoot
      const aud = root?.getElementById('audience-editor')
      aud?.scrollIntoView({ behavior: 'auto', block: 'start' })
    })

    // Give scroll a frame to commit before screenshotting.
    await audienceFilter.waitFor({ state: 'visible' })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/03-modal-audience-and-custom-fields.png`,
      fullPage: true
    })
    console.log('[capture] saved 03-modal-audience-and-custom-fields.png')

    // -------------------------------------------------------------------
    // 4) Open the AI Fill prompt dialog.
    // -------------------------------------------------------------------
    // Scroll back to the top so the AI Fill button (header) and the dialog
    // both render in a sensible spot.
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const body = host?.shadowRoot?.getElementById('fullscreen-modal-body')
      if (body) body.scrollTop = 0
    })

    await sidebar.locator('#ai-fill-button').click()
    const promptDialog = sidebar.locator('#ai-fill-prompt-dialog')
    await promptDialog.waitFor({ state: 'visible', timeout: 5_000 })
    // Also wait for the textarea — confirms the dialog rendered, not just
    // attached.
    await sidebar
      .locator('#ai-fill-prompt-textarea')
      .waitFor({ state: 'visible', timeout: 5_000 })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/04-ai-fill-prompt-dialog.png`,
      fullPage: true
    })
    console.log('[capture] saved 04-ai-fill-prompt-dialog.png')

    // -------------------------------------------------------------------
    // 5) Skip & Fill → AI populates form. Capture populated state.
    // -------------------------------------------------------------------
    await sidebar.locator('#ai-fill-prompt-skip').click()

    const displayNameInput = sidebar.locator('#fs-display-name-input')
    await expect(displayNameInput).toHaveValue('Hero CTA Variant Test', {
      timeout: 15_000
    })
    await expect(sidebar.locator('#fs-experiment-name-input')).toHaveValue(
      'hero_cta_variant_test',
      { timeout: 5_000 }
    )
    // Hypothesis populated via custom_fields (RichTextEditor is contenteditable)
    await expect(sidebar.locator('#cfe-input-7')).toContainText(
      HYPOTHESIS_VALUE,
      { timeout: 5_000 }
    )

    // Scroll to the top of the modal so the AI-populated header fields are
    // visible at the top of the screenshot.
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const body = host?.shadowRoot?.getElementById('fullscreen-modal-body')
      if (body) body.scrollTop = 0
    })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/05-modal-after-ai-fill.png`,
      fullPage: true
    })
    console.log('[capture] saved 05-modal-after-ai-fill.png')

    // -------------------------------------------------------------------
    // 6) Scroll to the #variant-screenshots strip and capture it.
    // -------------------------------------------------------------------
    const screenshotsStrip = sidebar.locator('#variant-screenshots')
    await screenshotsStrip.waitFor({ state: 'visible', timeout: 10_000 })

    const thumb = sidebar.locator('[data-testid="variant-thumb-1"]')
    await thumb.waitFor({ state: 'visible', timeout: 5_000 })

    // Bring the screenshots strip into view inside the modal body.
    await sidebar.locator('body').evaluate(() => {
      const host = document.getElementById('absmartly-fullscreen-host')
      const root = host?.shadowRoot
      const strip = root?.getElementById('variant-screenshots')
      strip?.scrollIntoView({ behavior: 'auto', block: 'center' })
    })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/06-variant-screenshots-strip.png`,
      fullPage: true
    })
    console.log('[capture] saved 06-variant-screenshots-strip.png')

    // -------------------------------------------------------------------
    // 7) Open the screenshot viewer (defaults to AFTER).
    // -------------------------------------------------------------------
    const openedViewer = await sidebar.locator('body').evaluate(() => {
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
    expect(openedViewer).toBe(true)

    const viewer = sidebar.locator('#screenshot-viewer')
    await viewer.waitFor({ state: 'visible', timeout: 5_000 })
    const viewerImg = sidebar.locator('#screenshot-viewer-img')
    await expect(viewerImg).toHaveAttribute('src', TINY_AFTER, {
      timeout: 5_000
    })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/07-screenshot-viewer-after.png`,
      fullPage: true
    })
    console.log('[capture] saved 07-screenshot-viewer-after.png')

    // -------------------------------------------------------------------
    // 8) Toggle to BEFORE.
    // -------------------------------------------------------------------
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

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/08-screenshot-viewer-before.png`,
      fullPage: true
    })
    console.log('[capture] saved 08-screenshot-viewer-before.png')

    // Close the viewer before saving.
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

    // -------------------------------------------------------------------
    // 9) Save the modal → returns to inline editor with AI-filled fields.
    // -------------------------------------------------------------------
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
    await modalHost.waitFor({ state: 'detached', timeout: 10_000 })

    const inlineDisplay = sidebar.locator('#display-name-input')
    await expect(inlineDisplay).toHaveValue('Hero CTA Variant Test', {
      timeout: 5_000
    })

    await testPage.screenshot({
      path: `${SCREENSHOT_DIR}/09-modal-saved-inline-editor.png`,
      fullPage: true
    })
    console.log('[capture] saved 09-modal-saved-inline-editor.png')
  })
})
