import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the full-screen experiment modal Discard flow (FT-1905).
 *
 * Verifies that:
 *  1. Opening the modal, modifying the modal-side draft (via AI Fill), then
 *     clicking Discard (and confirming the prompt) throws away the modal-side
 *     changes.
 *  2. The inline editor display_name remains whatever it was BEFORE the modal
 *     opened (i.e. the empty string for a fresh "from scratch" experiment).
 *  3. The X button no longer discards — it routes to Save (the close-preserves
 *     -data fix in FT-1905). Only the explicit Discard button + confirm
 *     abandons the draft.
 *
 * Reuses the bridge stub pattern from fullscreen-experiment-modal.spec.ts so
 * we can deterministically populate the modal draft, then exercise Discard.
 */
test.describe('Full-screen experiment modal — Discard (FT-1905)', () => {
  test('clicking Discard (after confirm) discards modal-side draft', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

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
          return jsonResponse({ conversationId: 'stub-conv-cancel' })
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
              (ev: Event) => fn?.(ev as MessageEvent),
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
                  display_name: 'AI Should Be Discarded',
                  name: 'ai_should_be_discarded',
                  audience: '{"filter":[{"and":[]}]}',
                  audience_strict: false,
                  percentage_of_traffic: 100,
                  percentages: '50/50'
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

    const createHeader = sidebar.locator('#create-experiment-header')
    await createHeader.waitFor({ state: 'visible', timeout: 10_000 })

    // Inline editor display_name starts empty; capture it for later assertion.
    const inlineDisplay = sidebar.locator('#display-name-input')
    await expect(inlineDisplay).toHaveValue('')

    // Trigger the full-screen modal.
    await sidebar
      .locator('#open-fullscreen-button')
      .click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })

    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Drive an AI fill so the modal-side draft is populated. After this,
    // cancelling MUST throw away these changes — they should NEVER reach the
    // inline editor.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    const fsDisplay = sidebar.locator('#fs-display-name-input')
    await expect(fsDisplay).toHaveValue('AI Should Be Discarded', {
      timeout: 15_000
    })

    // Click Discard. Discard prompts a window.confirm — auto-accept any
    // native dialog that bubbles up, but also stub `window.confirm` inside the
    // iframe so React's synchronous handler can proceed without blocking.
    testPage.on('dialog', (dialog) => {
      dialog.accept().catch(() => {})
    })

    const discardClicked = await sidebar.locator('body').evaluate(() => {
      ;(window as any).confirm = () => true
      const host = document.getElementById('absmartly-fullscreen-host')
      const root = host?.shadowRoot
      if (!root) return false
      const btn = root.getElementById(
        'fullscreen-modal-discard'
      ) as HTMLButtonElement | null
      if (!btn) return false
      btn.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true })
      )
      return true
    })
    expect(discardClicked).toBe(true)

    // Host should detach.
    await modalHost.waitFor({ state: 'detached', timeout: 10_000 })

    // Inline editor must NOT have been populated by the discarded modal draft.
    await expect(inlineDisplay).toHaveValue('')
  })
})
