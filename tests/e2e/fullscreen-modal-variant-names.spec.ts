import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for FT-1905: AI-suggested variant names from the AI fill flow
 * propagate through the modal's onVariantsChange and end up displayed in the
 * inline editor's VariantList after Save.
 *
 * The bridge protocol is stubbed via addInitScript so the AI tool returns
 * `variants: [{name: "Original"}, {name: "New CTA Copy"}]` along with the
 * draft fields. After AI Fill → Skip & Fill the modal's variant-name inputs
 * should display the renamed values. After clicking Save and the modal
 * detaches, the inline editor's `#variant-name-input-{index}` should also
 * reflect the renames.
 */
test.describe('Full-screen experiment modal — AI-suggested variant names (FT-1905)', () => {
  test('AI Fill renames variants and propagates to inline editor on save', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    // Stub bridge + EventSource so AI Fill returns a tool_result with variants.
    await context.addInitScript(() => {
      const realFetch = window.fetch.bind(window)

      function jsonResponse(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      }

      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url
        if (/\/health$/.test(urlStr)) {
          return jsonResponse({
            ok: true,
            authenticated: true,
            subscriptionType: 'pro',
            claudeProcess: 'stub'
          })
        }
        if (/\/conversations\/?$/.test(urlStr)) {
          return jsonResponse({ conversationId: 'stub-conv-1' })
        }
        if (/\/conversations\/[^/]+\/messages$/.test(urlStr)) {
          return jsonResponse({})
        }
        if (/\/conversations\/[^/]+\/(refresh|chunks|xpath)$/.test(urlStr)) {
          return jsonResponse({})
        }
        return realFetch(input as any, init as any)
      }) as typeof window.fetch

      const FakeEventSource: any = function (this: any, url: string) {
        const target = new EventTarget() as any
        target.url = url
        target.readyState = 1
        target.close = () => {
          target.readyState = 2
        }
        Object.defineProperty(target, 'onmessage', {
          configurable: true,
          set(fn: ((ev: MessageEvent) => void) | null) {
            this._onmessage = fn
            target.addEventListener(
              'message',
              (ev: Event) => {
                fn?.(ev as MessageEvent)
              },
              { once: false }
            )
          },
          get() {
            return (this as any)._onmessage || null
          }
        })
        Object.defineProperty(target, 'onerror', {
          configurable: true,
          set(fn: any) {
            ;(this as any)._onerror = fn
          },
          get() {
            return (this as any)._onerror || null
          }
        })
        Object.defineProperty(target, 'onopen', {
          configurable: true,
          set(fn: any) {
            ;(this as any)._onopen = fn
          },
          get() {
            return (this as any)._onopen || null
          }
        })
        setTimeout(() => {
          target.dispatchEvent(
            new MessageEvent('message', {
              data: JSON.stringify({
                type: 'tool_result',
                tool_name: 'fill_experiment_fields',
                input: {
                  display_name: 'AI-Generated Test',
                  name: 'ai_generated_test',
                  variants: [
                    { name: 'Original' },
                    { name: 'New CTA Copy' }
                  ]
                }
              })
            })
          )
        }, 30)
        return target
      }
      FakeEventSource.CONNECTING = 0
      FakeEventSource.OPEN = 1
      FakeEventSource.CLOSED = 2
      ;(window as any).EventSource = FakeEventSource
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

    // Sanity check: inline editor's Variant 1 starts as "Variant 1".
    const inlineVariant0 = sidebar.locator('#variant-name-input-0')
    const inlineVariant1 = sidebar.locator('#variant-name-input-1')
    await inlineVariant1.waitFor({ state: 'visible', timeout: 5_000 })
    await expect(inlineVariant0).toHaveValue('Control')
    await expect(inlineVariant1).toHaveValue('Variant 1')

    // Open the modal.
    await sidebar.locator('#open-fullscreen-button').click()
    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Trigger AI Fill → Skip & Fill.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    // Wait for draft fields to populate so we know the tool_result arrived.
    const fsDisplay = sidebar.locator('#fs-display-name-input')
    await expect(fsDisplay).toHaveValue('AI-Generated Test', {
      timeout: 15_000
    })

    // Modal's variant inputs reflect the AI-suggested names.
    const inModal = sidebar.locator('[data-testid="fullscreen-modal"]')
    const modalVariant0 = inModal.locator('#variant-name-input-0')
    const modalVariant1 = inModal.locator('#variant-name-input-1')
    await expect(modalVariant0).toHaveValue('Original', { timeout: 5_000 })
    await expect(modalVariant1).toHaveValue('New CTA Copy', { timeout: 5_000 })

    // Save the modal (dispatch via the shadow root to avoid Playwright click
    // flakiness on a host with `style="all: initial"`).
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

    // The inline editor now shows the AI-renamed variants.
    await expect(inlineVariant0).toHaveValue('Original', { timeout: 5_000 })
    await expect(inlineVariant1).toHaveValue('New CTA Copy', { timeout: 5_000 })
  })
})
