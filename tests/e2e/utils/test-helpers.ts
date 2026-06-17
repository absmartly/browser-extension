import { type Page, type FrameLocator, type Locator, expect } from '@playwright/test'

/**
 * Injects the extension sidebar into a test page
 * The sidebar iframe gets proper extension context because it's loaded via chrome.runtime.getURL()
 * @param page - Playwright page object
 * @param extensionUrl - Function to get extension URLs
 * @returns The sidebar frame locator
 */
export async function injectSidebar(page: Page, extensionUrl: (path: string) => string): Promise<FrameLocator> {
  const sidebarUrl = extensionUrl('tabs/sidebar.html')

  await page.evaluate((url) => {
    const existingSidebar = document.getElementById('absmartly-sidebar-root') as HTMLElement
    if (existingSidebar) {
      return
    }

    const originalPadding = document.body.style.paddingRight || '0px'
    document.body.setAttribute('data-absmartly-original-padding-right', originalPadding)
    document.body.style.transition = 'padding-right 0.3s ease-in-out'
    document.body.style.paddingRight = '384px'

    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed;
      top: 0;
      right: 0;
      width: 384px;
      height: 100vh;
      background-color: white;
      border-left: 1px solid #e5e7eb;
      box-shadow: -4px 0 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
      font-size: 14px;
      line-height: 1.5;
      color: #111827;
      transform: translateX(0);
      transition: transform 0.3s ease-in-out;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `
    iframe.src = url

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, sidebarUrl)

  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  // Wait for body to be visible — empty <body><div id="__plasmo"></div></body> has 0 height
  // and is "not visible" until React mounts and renders content. The 30s ceiling tolerates
  // parallel-worker CPU contention (the 2 MB sidebar bundle can be slow to parse under load);
  // in the happy path the wait completes in ~1 s.
  await sidebar.locator('body').waitFor({ state: 'visible', timeout: 30000 })

  // …and then for a real view to render. ExtensionUI shows
  // `<div role="status" aria-label="Loading">` while its top-level config
  // load is in flight, after which it renders ListView (#nav-settings) or
  // the welcome screen (#configure-settings-button). Tests that immediately
  // look for #nav-settings would otherwise race the spinner under workers=4.
  await sidebar
    .locator('#nav-settings, #configure-settings-button')
    .first()
    .waitFor({ state: 'visible', timeout: 20000 })

  return sidebar
}

/**
 * Injects a minimal version of the sidebar (without extra styling)
 * Useful when you just need the sidebar functionality without full styling
 */
export async function injectSidebarMinimal(page: Page, extensionUrl: (path: string) => string): Promise<FrameLocator> {
  await page.evaluate((extUrl) => {
    document.body.style.paddingRight = '384px'

    const container = document.createElement('div')
    container.id = 'absmartly-sidebar-root'
    container.style.cssText = `
      position: fixed; top: 0; right: 0; width: 384px; height: 100vh;
      background-color: white; border-left: 1px solid #e5e7eb;
      z-index: 2147483647;
    `

    const iframe = document.createElement('iframe')
    iframe.id = 'absmartly-sidebar-iframe'
    iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
    iframe.src = extUrl

    container.appendChild(iframe)
    document.body.appendChild(container)
  }, extensionUrl('tabs/sidebar.html'))

  const sidebar = page.frameLocator('#absmartly-sidebar-iframe')
  // Same rationale as injectSidebar — wait for React to render so the body has a height.
  await sidebar.locator('body').waitFor({ state: 'visible', timeout: 30000 })

  return sidebar
}

export async function debugWait(ms: number = 1000): Promise<void> {
  if (process.env.SLOW === '1') {
    await new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * Sets up console logging for a page
 * Useful for debugging test failures
 * @param page - Playwright page object
 * @param filter - Optional filter function to only log certain messages
 */
export function setupConsoleLogging(
  page: Page,
  filter?: (msg: { type: string; text: string }) => boolean
): Array<{ type: string; text: string }> {
  const messages: Array<{ type: string; text: string }> = []
  const DEBUG_MODE = process.env.DEBUG === '1' || process.env.PWDEBUG === '1'

  page.on('console', (msg) => {
    const msgType = msg.type()
    const msgText = msg.text()
    const message = { type: msgType, text: msgText }

    messages.push(message)

    if (DEBUG_MODE) {
      if (!filter || filter(message)) {
        console.log(`  📝 [${msgType}] ${msgText}`)
      }
    }
  })

  return messages
}

/**
 * Waits for an experiment to be available in the list
 * @param sidebar - Sidebar frame locator
 * @returns Whether experiments are available
 */
export async function waitForExperiments(sidebar: FrameLocator): Promise<boolean> {
  const experimentItem = sidebar.locator('[data-testid="experiment-list-item"]').first()

  return await experimentItem.isVisible({ timeout: 10000 }).catch(() => false)
}

/**
 * Dispatches a synthetic click via MouseEvent on an element inside a FrameLocator
 * Useful when regular .click() is flaky due to overlay/positioning, or when
 * we want to simulate a bubbling/cancelable event like the app expects.
 *
 * @param frame - FrameLocator containing the target element
 * @param selector - CSS selector for the target element
 * @param waitVisibleTimeout - Optional timeout to wait for visibility
 */
export async function click(
  target: FrameLocator | Page,
  selectorOrLocator: string | Locator,
  waitVisibleTimeout: number = 5000
): Promise<void> {
  let locator: Locator
  if (typeof selectorOrLocator === 'string') {
    if ('locator' in target && typeof (target as any).locator === 'function') {
      // Works for both Page and FrameLocator
      locator = (target as any).locator(selectorOrLocator)
    } else {
      throw new Error('Invalid target passed to click helper')
    }
  } else {
    locator = selectorOrLocator
  }

  await locator.waitFor({ state: 'visible', timeout: waitVisibleTimeout })
  await locator.evaluate((el: Element) => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

/**
 * Sets up test page with sidebar injection, viewport, and console logging
 * Centralizes beforeEach setup logic
 * @param page - Playwright page object
 * @param extensionUrl - Function to get extension URLs
 * @param testPageUrl - URL to navigate to (defaults to /visual-editor-test.html)
 * @returns Object containing sidebar and console messages
 */
export async function setupTestPage(
  page: Page,
  extensionUrl: (path: string) => string,
  testPageUrl: string = '/visual-editor-test.html'
): Promise<{ sidebar: FrameLocator; allMessages: Array<{ type: string; text: string }> }> {
  const allMessages: Array<{ type: string; text: string }> = []

  page.on('console', (msg) => {
    allMessages.push({ type: msg.type(), text: msg.text() })
  })

  await page.goto(`${testPageUrl}?use_shadow_dom_for_visual_editor_context_menu=0`, {
    waitUntil: 'domcontentloaded',
    timeout: 10000
  })

  await page.setViewportSize({ width: 1920, height: 1080 })
  await page.waitForSelector('body', { timeout: 5000 })

  await page.evaluate(() => {
    (window as any).__absmartlyTestMode = true
  })

  const sidebar = await injectSidebar(page, extensionUrl)

  return { sidebar, allMessages }
}

/**
 * Generic logging function with elapsed time and log level filtering
 * @param message - Message to log
 * @param level - Log level: 'debug', 'info', or 'error' (default: 'info')
 */
let testStartTime = Date.now()

export function initializeTestLogging(): void {
  testStartTime = Date.now()
}

export function log(message: string, level: 'debug' | 'info' | 'error' = 'info'): void {
  const LOG_LEVELS = { debug: 0, info: 1, error: 2 }
  const CURRENT_LOG_LEVEL = process.env.DEBUG === '1' || process.env.PWDEBUG === '1' ? LOG_LEVELS.debug : LOG_LEVELS.info

  if (LOG_LEVELS[level] >= CURRENT_LOG_LEVEL) {
    const elapsed = ((Date.now() - testStartTime) / 1000).toFixed(3)
    console.log(`[+${elapsed}s] ${message}`)
  }
}

/**
 * Right-click helper for triggering context menus
 * @param page - Playwright page or frame
 * @param selector - CSS selector for element to right-click
 */
export async function rightClickElement(
  target: Page | FrameLocator,
  selector: string
): Promise<void> {
  let locator: Locator
  if ('locator' in target && typeof (target as any).locator === 'function') {
    locator = (target as any).locator(selector)
  } else {
    throw new Error('Invalid target passed to rightClickElement helper')
  }

  await locator.waitFor({ state: 'visible', timeout: 5000 })
  await locator.click({ button: 'right' })
  // Wait for context menu to appear
  await ('url' in target
    ? target.locator('#absmartly-menu-container')
    : (target as FrameLocator).locator('#absmartly-menu-container')
  ).waitFor({ state: 'attached', timeout: 2000 }).catch(() => {})
}

/**
 * AI Fill bridge stub for full-screen modal e2e tests.
 *
 * Installs a fake window.fetch + window.EventSource via addInitScript so
 * the ClaudeCodeBridgeClient protocol resolves deterministically without a
 * real bridge process. Two emit modes are supported:
 *  - emit: { kind: 'tool_result', input } — resolves AI fill with `input`
 *  - emit: { kind: 'error', error }       — rejects AI fill with `error`
 *
 * Applies to all frames in the BrowserContext, including the chrome-extension
 * sidebar iframe where AI fill code actually runs.
 */
export interface InstallAIFillBridgeOptions {
  conversationId?: string
  toolName?: string
  emit:
    | { kind: 'tool_result'; input: Record<string, unknown> }
    | { kind: 'error'; error: string }
  /** Delay before emitting (ms). Default 30. */
  emitDelayMs?: number
}

export async function installAIFillBridgeStub(
  context: { addInitScript: (fn: any, arg?: any) => Promise<void> },
  options: InstallAIFillBridgeOptions
): Promise<void> {
  const conversationId = options.conversationId || 'stub-conv-1'
  const toolName = options.toolName || 'fill_experiment_fields'
  const delay = options.emitDelayMs ?? 30
  await context.addInitScript(
    ({
      conversationId,
      toolName,
      emit,
      delay
    }: {
      conversationId: string
      toolName: string
      emit:
        | { kind: 'tool_result'; input: Record<string, unknown> }
        | { kind: 'error'; error: string }
      delay: number
    }) => {
      const realFetch = window.fetch.bind(window)

      function jsonResponse(body: unknown, status = 200): Response {
        return new Response(JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' }
        })
      }

      window.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
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
          return jsonResponse({ conversationId })
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
          const payload =
            emit.kind === 'tool_result'
              ? {
                  type: 'tool_result',
                  tool_name: toolName,
                  input: emit.input
                }
              : { type: 'error', error: emit.error }
          target.dispatchEvent(
            new MessageEvent('message', { data: JSON.stringify(payload) })
          )
        }, delay)
        return target
      }
      FakeEventSource.CONNECTING = 0
      FakeEventSource.OPEN = 1
      FakeEventSource.CLOSED = 2
      ;(window as any).EventSource = FakeEventSource
    },
    { conversationId, toolName, emit: options.emit, delay }
  )
}

/**
 * Stubs `chrome.runtime.sendMessage` for ABSMARTLY_CAPTURE_VISIBLE_TAB
 * inside the sidebar iframe. The stub returns `{ok: true, dataUrl: ...}`,
 * cycling through the supplied data URLs in order so each call returns the
 * next. The `n`-th call uses `dataUrls[n % dataUrls.length]`.
 *
 * Other sendMessage calls fall through to the real implementation.
 *
 * Must be installed BEFORE the sidebar iframe loads so the patch is in
 * place when ExperimentEditor mounts.
 */
export async function installCaptureVisibleTabStub(
  context: { addInitScript: (fn: any, arg?: any) => Promise<void> },
  dataUrls: string[]
): Promise<void> {
  await context.addInitScript((urls: string[]) => {
    // Wait for chrome.runtime to exist (it's available in chrome-extension://
    // pages by the time addInitScript runs at documentStart).
    const tryPatch = () => {
      const c = (window as any).chrome
      if (!c?.runtime?.sendMessage) {
        setTimeout(tryPatch, 1)
        return
      }
      const reg = ((window as any).__absmartlyRuntimeStubs ||= {
        original: c.runtime.sendMessage.bind(c.runtime),
        handlers: [] as Array<(msg: any) => any>
      })
      // Install (or update) the dispatcher only once.
      if (!(window as any).__absmartlyRuntimeStubInstalled) {
        ;(window as any).__absmartlyRuntimeStubInstalled = true
        try {
          c.runtime.sendMessage = function (...args: any[]) {
            const msg = args[0]
            for (const h of reg.handlers) {
              const result = h(msg)
              if (result !== undefined) return result
            }
            return reg.original(...args)
          }
        } catch (e) {
          // If chrome.runtime.sendMessage is non-writable in this context,
          // fall back to defineProperty.
          try {
            Object.defineProperty(c.runtime, 'sendMessage', {
              configurable: true,
              writable: true,
              value: function (...args: any[]) {
                const msg = args[0]
                for (const h of reg.handlers) {
                  const result = h(msg)
                  if (result !== undefined) return result
                }
                return reg.original(...args)
              }
            })
          } catch {
            console.error(
              '[absmartly-test] failed to patch chrome.runtime.sendMessage',
              e
            )
          }
        }
      }

      let nextIndex = 0
      ;(window as any).__captureCalls = 0
      reg.handlers.push((msg: any) => {
        if (
          msg &&
          typeof msg === 'object' &&
          msg.type === 'ABSMARTLY_CAPTURE_VISIBLE_TAB'
        ) {
          const dataUrl = urls[nextIndex % urls.length]
          nextIndex += 1
          ;(window as any).__captureCalls += 1
          return Promise.resolve({ ok: true, dataUrl })
        }
        return undefined
      })
    }
    tryPatch()
  }, dataUrls)
}

/**
 * Stubs `chrome.runtime.sendMessage` for `type: "API_OPERATION"` calls based
 * on a map keyed by `operation.op`. Each entry is one of:
 *  - `{ data: ... }` — return `{success: true, data}` immediately
 *  - `{ error: ... }` — return `{success: false, error}` immediately
 * Calls whose op is not in the map fall through to the real implementation.
 *
 * The stub also pushes every captured invocation onto `window.__apiOpCalls`
 * for later inspection in the test (e.g. asserting that `createExperiment`
 * was called with the expected payload).
 *
 * Must be installed BEFORE the sidebar iframe loads.
 */
export interface APIOpStub {
  data?: unknown
  error?: string
}

/**
 * Convenience: install a CHECK_AUTH stub returning a fake authenticated user.
 * Required for any test that needs `isAuthenticated=true` (e.g. for editor
 * resources to load) without real API credentials.
 */
export async function installAuthStub(
  context: { addInitScript: (fn: any, arg?: any) => Promise<void> },
  user: { id?: number; email?: string; first_name?: string } = {}
): Promise<void> {
  await context.addInitScript((u: any) => {
    const tryPatch = () => {
      const c = (window as any).chrome
      if (!c?.runtime?.sendMessage) {
        setTimeout(tryPatch, 1)
        return
      }
      const reg = ((window as any).__absmartlyRuntimeStubs ||= {
        original: c.runtime.sendMessage.bind(c.runtime),
        handlers: [] as Array<(msg: any) => any>
      })
      if (!(window as any).__absmartlyRuntimeStubInstalled) {
        ;(window as any).__absmartlyRuntimeStubInstalled = true
        try {
          c.runtime.sendMessage = function (...args: any[]) {
            const msg = args[0]
            for (const h of reg.handlers) {
              const result = h(msg)
              if (result !== undefined) return result
            }
            return reg.original(...args)
          }
        } catch (e) {
          try {
            Object.defineProperty(c.runtime, 'sendMessage', {
              configurable: true,
              writable: true,
              value: function (...args: any[]) {
                const msg = args[0]
                for (const h of reg.handlers) {
                  const result = h(msg)
                  if (result !== undefined) return result
                }
                return reg.original(...args)
              }
            })
          } catch {
            console.error(
              '[absmartly-test] failed to patch chrome.runtime.sendMessage',
              e
            )
          }
        }
      }
      reg.handlers.push((msg: any) => {
        if (msg && typeof msg === 'object' && msg.type === 'CHECK_AUTH') {
          return Promise.resolve({
            success: true,
            data: {
              user: {
                id: u.id ?? 1,
                user_id: u.id ?? 1,
                email: u.email || 'tester@absmartly.test',
                first_name: u.first_name || 'Test'
              }
            }
          })
        }
        return undefined
      })
    }
    tryPatch()
  }, user)
}

export async function installAPIOperationStub(
  context: { addInitScript: (fn: any, arg?: any) => Promise<void> },
  ops: Record<string, APIOpStub>
): Promise<void> {
  await context.addInitScript((opsMap: Record<string, APIOpStub>) => {
    const tryPatch = () => {
      const c = (window as any).chrome
      if (!c?.runtime?.sendMessage) {
        setTimeout(tryPatch, 1)
        return
      }
      const reg = ((window as any).__absmartlyRuntimeStubs ||= {
        original: c.runtime.sendMessage.bind(c.runtime),
        handlers: [] as Array<(msg: any) => any>
      })
      if (!(window as any).__absmartlyRuntimeStubInstalled) {
        ;(window as any).__absmartlyRuntimeStubInstalled = true
        try {
          c.runtime.sendMessage = function (...args: any[]) {
            const msg = args[0]
            for (const h of reg.handlers) {
              const result = h(msg)
              if (result !== undefined) return result
            }
            return reg.original(...args)
          }
        } catch (e) {
          try {
            Object.defineProperty(c.runtime, 'sendMessage', {
              configurable: true,
              writable: true,
              value: function (...args: any[]) {
                const msg = args[0]
                for (const h of reg.handlers) {
                  const result = h(msg)
                  if (result !== undefined) return result
                }
                return reg.original(...args)
              }
            })
          } catch {
            console.error(
              '[absmartly-test] failed to patch chrome.runtime.sendMessage',
              e
            )
          }
        }
      }

      ;(window as any).__apiOpCalls = (window as any).__apiOpCalls || []
      reg.handlers.push((msg: any) => {
        if (
          msg &&
          typeof msg === 'object' &&
          msg.type === 'API_OPERATION' &&
          msg.operation
        ) {
          const op = msg.operation.op
          ;(window as any).__apiOpCalls.push({
            op,
            params: msg.operation.params
          })
          if (op in opsMap) {
            const stub = opsMap[op]
            if (stub.error) {
              return Promise.resolve({ success: false, error: stub.error })
            }
            return Promise.resolve({ success: true, data: stub.data })
          }
        }
        return undefined
      })
    }
    tryPatch()
  }, ops)
}

