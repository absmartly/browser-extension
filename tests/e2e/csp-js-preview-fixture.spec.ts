import { test, expect } from '../fixtures/extension'
import { type Page } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'

const TARGET_URL = 'https://example.com/absmartly-csp-preview-test'

/**
 * The CSP fallback path (inline <script> injection with a sentinel check,
 * plus `absmartly:js-error` CustomEvent dispatch) lives in
 * `@absmartly/sdk-plugins` and is only available once a release with the
 * new executeUserJavaScript helper is on npm. The extension's bundled SDK
 * bridge is in public/absmartly-sdk-bridge.bundle.js; peek at it to
 * decide whether the installed plugin supports the fallback so tests that
 * depend on it skip cleanly instead of failing on older installs.
 */
function sdkBridgeSupportsCspFallback(): boolean {
  try {
    const bundlePath = path.resolve(__dirname, '..', '..', 'public', 'absmartly-sdk-bridge.bundle.js')
    if (!fs.existsSync(bundlePath)) return false
    const contents = fs.readFileSync(bundlePath, 'utf8')
    return contents.includes('executeUserJavaScript') && contents.includes('absmartly:js-error')
  } catch {
    return false
  }
}

const fixturePage = () => `
<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>CSP preview fixture</title>
</head>
<body>
<div id="csp-probe" data-state="initial">probe</div>
</body>
</html>
`

async function servePageWithCsp(
  page: Page,
  cspHeaderValue: string
): Promise<void> {
  await page.route(TARGET_URL, async (route) => {
    const headers: Record<string, string> = {
      'content-type': 'text/html; charset=utf-8',
      'content-security-policy': cspHeaderValue
    }
    await route.fulfill({
      status: 200,
      headers,
      body: fixturePage()
    })
  })
}

async function injectSdkBridge(page: Page, extensionUrl: (p: string) => string): Promise<void> {
  const url = extensionUrl('absmartly-sdk-bridge.bundle.js')
  const loaded = await page.evaluate((bundleUrl) => {
    return new Promise<boolean>((resolve) => {
      const script = document.createElement('script')
      script.src = bundleUrl
      script.onload = () => resolve(true)
      script.onerror = (e) => {
        // eslint-disable-next-line no-console
        console.log(`__ABSMARTLY_BUNDLE_LOAD_FAILED__:${String(e)}`)
        resolve(false)
      }
      document.documentElement.appendChild(script)
    })
  }, url)
  if (!loaded) {
    // eslint-disable-next-line no-console
    console.log('[test] SDK bridge bundle failed to load (likely blocked by page CSP script-src)')
  }
}

async function postPreviewJsChange(
  page: Page,
  code: string,
  experimentName = '__csp_fixture__'
): Promise<void> {
  await page.evaluate(
    ({ value, name }) => {
      window.postMessage(
        {
          source: 'absmartly-extension',
          type: 'PREVIEW_CHANGES',
          payload: {
            changes: [
              {
                selector: '#csp-probe',
                type: 'javascript',
                value
              }
            ],
            experimentName: name,
            variantName: 'test-variant'
          }
        },
        window.location.origin
      )
    },
    { value: code, name: experimentName }
  )
}

async function readProbeState(page: Page, timeoutMs = 4000): Promise<string> {
  return page.evaluate((limit) => {
    return new Promise<string>((resolve) => {
      const start = Date.now()
      const check = () => {
        const el = document.getElementById('csp-probe')
        const state = el?.getAttribute('data-state') ?? 'missing'
        if (state !== 'initial' || Date.now() - start > limit) {
          resolve(state)
          return
        }
        setTimeout(check, 50)
      }
      check()
    })
  }, timeoutMs)
}

function captureAbsmartlyPageMessages(page: Page): { messages: Array<{ type: string; payload: any }> } {
  const captured: Array<{ type: string; payload: any }> = []
  page.on('console', (msg) => {
    const text = msg.text()
    const match = text.match(/^__ABSMARTLY_PAGE_MSG__:(.+)$/)
    if (match) {
      try {
        captured.push(JSON.parse(match[1]))
      } catch {
        // ignore
      }
    } else if (msg.type() === 'error' || /Refused|Content Security Policy|CSP/i.test(text)) {
      // eslint-disable-next-line no-console
      console.log(`[page ${msg.type()}] ${text.slice(0, 250)}`)
    }
  })
  page.on('pageerror', (err) => {
    // eslint-disable-next-line no-console
    console.log(`[pageerror] ${err.message.slice(0, 250)}`)
  })
  return { messages: captured }
}

async function installPageMessageCapture(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.addEventListener('message', (event) => {
      const data: any = event.data
      if (data && data.source === 'absmartly-page' && typeof data.type === 'string') {
        try {
          // eslint-disable-next-line no-console
          console.log(`__ABSMARTLY_PAGE_MSG__:${JSON.stringify({ type: data.type, payload: data.payload })}`)
        } catch {
          // ignore
        }
      }
    })
  })
}

test.describe('JS DOM-change preview under various host-page CSPs', () => {
  test('executes via primary new Function() path when the page allows unsafe-eval', async ({ context, extensionUrl }) => {
    const page = await context.newPage()

    await servePageWithCsp(
      page,
      "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' chrome-extension: https:; style-src 'self' 'unsafe-inline' https:;"
    )
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

    await injectSdkBridge(page, extensionUrl)
    await postPreviewJsChange(
      page,
      'element.setAttribute("data-state", "eval-path-executed")'
    )

    const finalState = await readProbeState(page)
    expect(finalState).toBe('eval-path-executed')

    await page.close()
  })

  test('falls back to inline <script> injection when unsafe-eval is blocked but unsafe-inline is allowed', async ({ context, extensionUrl }) => {
    test.skip(
      !sdkBridgeSupportsCspFallback(),
      'Requires @absmartly/sdk-plugins with executeUserJavaScript + absmartly:js-error dispatch (unreleased as of 1.3.1). Re-enable once the plugin release ships.'
    )
    const page = await context.newPage()

    await servePageWithCsp(
      page,
      "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' chrome-extension: https:; style-src 'self' 'unsafe-inline' https:;"
    )
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

    // Capture page console + errors so failures are diagnosable.
    await installPageMessageCapture(page)
    captureAbsmartlyPageMessages(page)

    await injectSdkBridge(page, extensionUrl)
    await postPreviewJsChange(
      page,
      'element.setAttribute("data-state", "inline-fallback-executed")'
    )

    const finalState = await readProbeState(page)
    expect(finalState).toBe('inline-fallback-executed')

    await page.close()
  })

  test('broadcasts PREVIEW_JS_ERROR with reason=csp when both eval and inline are blocked', async ({ context, extensionUrl }) => {
    test.skip(
      !sdkBridgeSupportsCspFallback(),
      'Requires @absmartly/sdk-plugins with executeUserJavaScript + absmartly:js-error dispatch (unreleased as of 1.3.1). Re-enable once the plugin release ships.'
    )
    const page = await context.newPage()

    await servePageWithCsp(
      page,
      "default-src 'self' https: data: blob:; script-src 'self' chrome-extension: https:; style-src 'self' 'unsafe-inline' https:;"
    )
    await page.goto(TARGET_URL, { waitUntil: 'domcontentloaded' })

    await installPageMessageCapture(page)
    const capture = captureAbsmartlyPageMessages(page)

    await injectSdkBridge(page, extensionUrl)
    await postPreviewJsChange(
      page,
      'element.setAttribute("data-state", "never-runs")'
    )

    await expect.poll(
      () => capture.messages.some((m) => m.type === 'PREVIEW_JS_ERROR' && m.payload?.reason === 'csp'),
      { timeout: 5000, message: 'expected PREVIEW_JS_ERROR with reason=csp to be emitted' }
    ).toBe(true)

    const finalState = await readProbeState(page, 1500)
    expect(finalState).toBe('initial')

    const jsError = capture.messages.find((m) => m.type === 'PREVIEW_JS_ERROR')
    expect(jsError?.payload?.selector).toBe('#csp-probe')

    const cspProbe = capture.messages.find((m) => m.type === 'PREVIEW_CSP_PROBE')
    expect(cspProbe).toBeDefined()
    expect(cspProbe?.payload?.jsBlocked).toBe(true)

    await page.close()
  })
})
