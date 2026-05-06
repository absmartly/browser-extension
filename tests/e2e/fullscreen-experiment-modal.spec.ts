import { test, expect } from '../fixtures/extension'
import { setupTestPage } from './utils/test-helpers'

/**
 * E2E test for the full-screen experiment modal (FT-1905).
 *
 * Verifies that:
 *  1. Clicking "Open in full screen" mounts a body-level host inside the
 *     sidebar iframe document (NOT inside the React tree of the inline editor).
 *  2. The modal exposes the audience editor and the AI Fill button.
 *  3. Clicking AI Fill → Skip & Fill, with the bridge fetch/SSE protocol
 *     stubbed in the page context, drives the form fields from the AI tool
 *     result.
 *  4. Saving the modal detaches the host and propagates the AI-filled values
 *     back to the inline editor.
 *
 * The test stubs window.fetch and window.EventSource via addInitScript so the
 * bridge protocol is satisfied without a real claude-code-bridge process. All
 * bridge endpoints used by ClaudeCodeBridgeClient are covered:
 *   - GET  /health                                  (port discovery)
 *   - POST /conversations                           (createConversation)
 *   - POST /conversations/<id>/messages             (sendMessage)
 *   - SSE  /conversations/<id>/stream               (streamResponses)
 */
test.describe('Full-screen experiment modal (FT-1905)', () => {
  test('opens body-level modal, AI Fill populates fields, save propagates to inline editor', async ({
    context,
    extensionUrl
  }) => {
    test.setTimeout(60_000)

    // Stub the bridge protocol (fetch + EventSource) before any page script
    // runs. Applies to all frames in this BrowserContext, including the
    // chrome-extension sidebar iframe where the AI fill code actually runs.
    await context.addInitScript(() => {
      const realFetch = window.fetch.bind(window)

      function jsonResponse(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      }

      ;(window as any).__bridgeStubCalls = [] as string[]

      window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const urlStr =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.toString()
              : (input as Request).url
        ;(window as any).__bridgeStubCalls.push(`${(init?.method || 'GET').toUpperCase()} ${urlStr}`)

        // Bridge port discovery / health check.
        if (/\/health$/.test(urlStr)) {
          return jsonResponse({
            ok: true,
            authenticated: true,
            subscriptionType: 'pro',
            claudeProcess: 'stub'
          })
        }
        // Create a conversation.
        if (/\/conversations\/?$/.test(urlStr)) {
          return jsonResponse({ conversationId: 'stub-conv-1' })
        }
        // Send a message.
        if (/\/conversations\/[^/]+\/messages$/.test(urlStr)) {
          return jsonResponse({})
        }
        // Refresh / chunks / xpath are unused in this flow but stub for safety.
        if (/\/conversations\/[^/]+\/(refresh|chunks|xpath)$/.test(urlStr)) {
          return jsonResponse({})
        }
        return realFetch(input as any, init as any)
      }) as typeof window.fetch

      // EventSource stub: emits a single tool_result for fill_experiment_fields,
      // then closes. Mirrors what the BridgeProvider waits for.
      const FakeEventSource: any = function (this: any, url: string) {
        const target = new EventTarget() as any
        target.url = url
        target.readyState = 1 // OPEN
        target.close = () => {
          target.readyState = 2
        }
        // onmessage assignment hook (BridgeClient sets eventSource.onmessage =)
        Object.defineProperty(target, 'onmessage', {
          configurable: true,
          set(fn: ((ev: MessageEvent) => void) | null) {
            this._onmessage = fn
            target.addEventListener('message', (ev: Event) => {
              fn?.(ev as MessageEvent)
            }, { once: false })
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
                  hypothesis: 'We believe the new layout improves engagement.',
                  prediction: '+3% conversion lift',
                  description: 'Filled by the AI end-to-end test.',
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
      // Match the EventSource constants spec.
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
    await sidebar
      .locator('button[title="Create New Experiment"]')
      .click()
    const fromScratchButton = sidebar.locator('#from-scratch-button')
    await fromScratchButton.waitFor({ state: 'visible', timeout: 10_000 })
    await fromScratchButton.click()

    // The inline editor is now showing the create-experiment form.
    const createHeader = sidebar.locator('#create-experiment-header')
    await createHeader.waitFor({ state: 'visible', timeout: 10_000 })

    // Trigger the full-screen modal.
    const openFsButton = sidebar.locator('#open-fullscreen-button')
    await openFsButton.waitFor({ state: 'visible', timeout: 10_000 })
    await openFsButton.click()

    // The modal mounts a host on document.body of the sidebar iframe — it must
    // be findable from the FrameLocator and must NOT be a descendant of the
    // inline editor's #create-experiment-header parent.
    const modalHost = sidebar.locator('#absmartly-fullscreen-host')
    await modalHost.waitFor({ state: 'attached', timeout: 10_000 })

    // Confirm the host is a direct child of <body> (not nested in the editor).
    const isDirectBodyChild = await modalHost.evaluate(
      (el) => el.parentElement?.tagName === 'BODY'
    )
    expect(isDirectBodyChild).toBe(true)

    // Modal contents — Playwright pierces the open shadow root automatically.
    await sidebar
      .locator('#fullscreen-experiment-modal')
      .waitFor({ state: 'visible', timeout: 10_000 })
    await sidebar
      .locator('#audience-editor-textarea')
      .waitFor({ state: 'visible', timeout: 5_000 })
    await sidebar
      .locator('#ai-fill-button')
      .waitFor({ state: 'visible', timeout: 5_000 })

    // Click AI Fill → Skip & Fill.
    await sidebar.locator('#ai-fill-button').click()
    const skipButton = sidebar.locator('#ai-fill-prompt-skip')
    await skipButton.waitFor({ state: 'visible', timeout: 5_000 })
    await skipButton.click()

    // Wait for the AI fill to populate the modal fields.
    const fsDisplay = sidebar.locator('#fs-display-name-input')
    const fsName = sidebar.locator('#fs-experiment-name-input')
    await expect(fsDisplay).toHaveValue('AI-Generated Test', { timeout: 15_000 })
    await expect(fsName).toHaveValue('ai_generated_test', { timeout: 15_000 })

    // Save the modal. The host element has `style="all: initial"` and an
    // open shadow root; descendant CSS locators don't pierce shadow DOM
    // reliably for `document.querySelectorAll`, so dispatch the click via
    // the shadow root explicitly. (`sidebar.locator('#fullscreen-modal-save')`
    // works for assertions because Playwright's locator engine does pierce,
    // but `.click()` has surfaced flakiness in this configuration.)
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

    // Host must detach (close() calls host.remove()).
    await modalHost.waitFor({ state: 'detached', timeout: 10_000 })

    // Inline editor receives the AI-filled values.
    const inlineDisplay = sidebar.locator('#display-name-input')
    await expect(inlineDisplay).toHaveValue('AI-Generated Test', {
      timeout: 5_000
    })
  })
})
