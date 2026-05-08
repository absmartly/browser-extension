import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the AI Fill error path inside the full-screen modal (FT-1905).
 *
 * Verifies that:
 *  1. When the bridge emits an SSE event of `{type: "error", error: "..."}`,
 *     the AIFillButton catches the rejected promise and renders #ai-fill-error
 *     with a non-empty message.
 *  2. The modal-side draft is NOT mutated by the failed AI fill — i.e. the
 *     fs-display-name-input remains empty.
 */
test.describe('Full-screen experiment modal — AI Fill error (FT-1905)', () => {
  test('bridge error surfaces in #ai-fill-error and leaves draft untouched', async ({
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
          return jsonResponse({ conversationId: 'stub-conv-error' })
        }
        if (/\/conversations\/[^/]+\/messages$/.test(urlStr)) {
          return jsonResponse({})
        }
        if (/\/conversations\/[^/]+\/(refresh|chunks|xpath)$/.test(urlStr)) {
          return jsonResponse({})
        }
        return realFetch(input as any, init as any)
      }) as typeof window.fetch

      // EventSource stub that emits an "error" event instead of a tool_result.
      const ERROR_MESSAGE = 'AI bridge exploded: synthetic test failure'
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
                type: 'error',
                error: ERROR_MESSAGE
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

    await sidebar.locator('button[title="Create New Experiment"]').click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    await sidebar
      .locator('#create-experiment-header')
      .waitFor({ state: 'visible', timeout: 10_000 })

    await sidebar
      .locator('#open-fullscreen-button')
      .click()

    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })

    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })

    // Trigger AI Fill → Skip & Fill. The stubbed EventSource will emit an
    // error event causing the provider to reject, which the AIFillButton
    // catch handler should render into #ai-fill-error.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    const errorEl = sidebar.locator('#ai-fill-error')
    await errorEl.waitFor({ state: 'visible', timeout: 10_000 })
    const errorText = (await errorEl.textContent())?.trim() || ''
    expect(errorText.length).toBeGreaterThan(0)
    expect(errorText).toContain('synthetic test failure')

    // Modal draft remains empty — display-name input should not have been
    // populated by the failed fill.
    await expect(sidebar.locator('#fs-display-name-input')).toHaveValue('')
  })
})
